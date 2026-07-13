from pathlib import Path
from playwright.sync_api import sync_playwright


BASE_URL = "http://127.0.0.1:5173"
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
DESKTOP_ALGORITHM_IDS = (
    "astar",
    "bidirectional-astar",
    "theta",
    "jps-plus",
    "dstar-lite",
    "flow-field",
)
CORE_ALGORITHM_IDS = ("astar", "jps", "dijkstra", "bfs", "greedy")


def cell_center(box, cols, rows, x, y):
    return (
        box["x"] + (x + 0.5) * box["width"] / cols,
        box["y"] + (y + 0.5) * box["height"] / rows,
    )


def expanded_by_algorithm(page):
    return {
        card.get_attribute("data-algorithm-id"): int(
            card.locator(".metric--emphasize strong").inner_text().replace(",", "")
        )
        for card in page.locator(".algorithm-card").all()
    }


def picker_selected_ids(dialog):
    return [
        button.get_attribute("data-picker-algorithm-id")
        for button in dialog.locator(
            '[data-picker-algorithm-id][aria-pressed="true"]'
        ).all()
    ]


def stub_external_fonts(context):
    context.route(
        "https://fonts.googleapis.com/**",
        lambda route: route.fulfill(status=200, content_type="text/css", body=""),
    )
    context.route(
        "https://fonts.gstatic.com/**",
        lambda route: route.fulfill(status=204, body=""),
    )


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True, executable_path=CHROME)
    context = browser.new_context(
        viewport={"width": 1440, "height": 1000},
        device_scale_factor=1,
        reduced_motion="no-preference",
    )
    stub_external_fonts(context)
    page = context.new_page()
    console_errors = []
    external_resource_errors = []

    def record_console(message):
        if message.type != "error":
            return
        source_url = message.location.get("url", "")
        if (
            "Failed to load resource" in message.text
            and ("fonts.googleapis.com" in source_url or "fonts.gstatic.com" in source_url)
        ):
            external_resource_errors.append({"url": source_url, "message": message.text})
            return
        console_errors.append(message.text)

    page.on("console", record_console)
    page.on("pageerror", lambda error: console_errors.append(str(error)))

    # Reconnaissance: render first, wait for all app JavaScript, then inspect the live page.
    page.goto(BASE_URL, wait_until="domcontentloaded")
    page.wait_for_load_state("networkidle")
    page.screenshot(path="/tmp/route-lab-edit.png", full_page=True)
    assert page.title() == "ROUTE/LAB · 路径规划观测台"
    assert page.locator("canvas.grid-canvas").count() == 1
    assert page.get_by_role(
        "button", name="选择算法并开始", exact=True
    ).is_enabled()

    # Edit the actual canvas: add one waypoint and verify fast drag interpolation.
    canvas = page.locator("canvas.grid-canvas")
    box = canvas.bounding_box()
    assert box is not None
    page.get_by_role("button", name="添加途径点 4").click()
    x, y = cell_center(box, 24, 15, 4, 4)
    page.mouse.click(x, y)
    assert page.locator(".readout").nth(1).locator("strong").inner_text() == "03"

    page.get_by_role("button", name="障碍画笔 1").click()
    drag_start = cell_center(box, 24, 15, 0, 0)
    drag_end = cell_center(box, 24, 15, 10, 0)
    page.mouse.move(*drag_start)
    page.mouse.down()
    page.mouse.move(*drag_end, steps=1)
    page.mouse.up()
    assert page.locator(".readout").nth(2).locator("strong").inner_text() == "059"

    # Choose a six-runner formation, including every newly added algorithm.
    selected_count = len(DESKTOP_ALGORITHM_IDS)
    page.get_by_role("button", name="选择算法并开始", exact=True).click()
    picker = page.get_by_role("dialog", name="选择本轮执行算法", exact=True)
    picker.wait_for(state="visible")
    picker.screenshot(path="/tmp/route-lab-picker.png")
    picker.get_by_role("button", name="清空", exact=True).click()
    picker_confirm = picker.locator(".algorithm-picker-confirm")
    assert picker_selected_ids(picker) == []
    assert picker_confirm.is_disabled()
    assert "运行 0 个算法" in picker_confirm.inner_text()

    for algorithm_id in DESKTOP_ALGORITHM_IDS:
        option = picker.locator(
            f'[data-picker-algorithm-id="{algorithm_id}"]'
        )
        assert option.get_attribute("aria-pressed") == "false"
        option.click()

    assert picker_selected_ids(picker) == list(DESKTOP_ALGORITHM_IDS)
    assert picker_confirm.is_enabled()
    assert f"运行 {selected_count} 个算法" in picker_confirm.inner_text()
    picker_confirm.click()
    page.wait_for_selector(".algorithm-card")
    assert page.locator(".algorithm-card").count() == selected_count
    assert page.locator("canvas.grid-canvas").count() == selected_count
    assert set(expanded_by_algorithm(page)) == set(DESKTOP_ALGORITHM_IDS)
    page.wait_for_timeout(850)
    expanded_before_pause = expanded_by_algorithm(page)
    assert all(value > 0 for value in expanded_before_pause.values())

    # Pause must freeze all counters; one synchronized step must advance active runners once.
    page.get_by_role("button", name="暂停").click()
    page.wait_for_timeout(200)
    paused_values = expanded_by_algorithm(page)
    page.wait_for_timeout(350)
    paused_values_later = expanded_by_algorithm(page)
    assert paused_values_later == paused_values

    page.get_by_role("button", name="所有算法单步前进").click()
    page.wait_for_timeout(100)
    stepped_values = expanded_by_algorithm(page)
    deltas = [stepped_values[algorithm] - value for algorithm, value in paused_values.items()]
    assert all(delta in (0, 1) for delta in deltas)
    assert any(delta == 1 for delta in deltas)
    page.screenshot(path="/tmp/route-lab-running.png", full_page=True)

    # Finished cards move to the front and keep their locked finish ranks.
    page.get_by_role("button", name="0.5×", exact=True).click()
    page.get_by_role("button", name="播放").click()
    page.wait_for_selector(".algorithm-card .finish-rank", timeout=10_000)
    page.get_by_role("button", name="暂停").click()
    flip_animation_count = page.locator(".algorithm-card").evaluate_all(
        """cards => cards.flatMap(card => card.getAnimations())
            .filter(animation => {
                const frames = animation.effect?.getKeyframes?.() ?? []
                return frames.some(frame =>
                    typeof frame.transform === 'string' && frame.transform.includes('translate(')
                )
            }).length"""
    )
    assert flip_animation_count > 0, flip_animation_count
    page.wait_for_timeout(1400)
    first_rank_labels = page.locator(".algorithm-card .finish-rank").all_inner_texts()
    assert 0 < len(first_rank_labels) < selected_count
    assert first_rank_labels == [f"#{rank:02d}" for rank in range(1, len(first_rank_labels) + 1)]
    locked_finishers = [
        page.locator(".algorithm-card").nth(index).get_attribute("data-algorithm-id")
        for index in range(len(first_rank_labels))
    ]
    assert page.locator(".final-report").count() == 0
    first_unfinished = page.locator(".algorithm-card:not(.algorithm-card--ranked)").first
    auto_scroll_state = first_unfinished.evaluate(
        """element => {
            const rect = element.getBoundingClientRect()
            return {
                algorithm: element.dataset.algorithmId,
                top: rect.top,
                viewport: window.innerHeight,
                scrollY: window.scrollY,
            }
        }"""
    )
    assert auto_scroll_state["scrollY"] > 0, auto_scroll_state
    assert 78 <= auto_scroll_state["top"] < auto_scroll_state["viewport"] * 0.55, auto_scroll_state

    page.get_by_role("button", name="8×", exact=True).click()
    page.get_by_role("button", name="播放").click()
    page.wait_for_selector(".phase-indicator--complete", timeout=30_000)
    rank_labels = page.locator(".algorithm-card .finish-rank").all_inner_texts()
    assert rank_labels == [
        f"#{rank:02d}" for rank in range(1, selected_count + 1)
    ]
    assert [
        page.locator(".algorithm-card").nth(index).get_attribute("data-algorithm-id")
        for index in range(len(locked_finishers))
    ] == locked_finishers

    # Final telemetry appears below all cards, animates its ranking, and mirrors card metrics.
    final_report = page.locator(".final-report")
    final_report.wait_for(state="visible")
    assert page.locator(".final-rank-item").count() == selected_count
    assert page.locator(".final-chart-card").count() == 4
    assert all(
        page.locator(f'.final-chart-card[data-metric="{metric}"] .final-chart-row').count()
        == selected_count
        for metric in ("expansions", "cpu", "cost", "queue")
    )
    ranking_animation = page.locator(".final-rank-item").first.evaluate(
        "element => getComputedStyle(element).animationName"
    )
    assert "final-rank-reveal" in ranking_animation, ranking_animation

    card_bottom = max(
        box["y"] + box["height"]
        for box in [card.bounding_box() for card in page.locator(".algorithm-card").all()]
        if box is not None
    )
    report_box = final_report.bounding_box()
    assert report_box is not None and report_box["y"] >= card_bottom - 1, (report_box, card_bottom)

    card_expansions = expanded_by_algorithm(page)
    chart_expansions = {
        row.get_attribute("data-algorithm-id"): int(float(row.get_attribute("data-value")))
        for row in page.locator('.final-chart-card[data-metric="expansions"] .final-chart-row').all()
    }
    assert chart_expansions == card_expansions

    page.wait_for_timeout(1400)
    final_scroll_state = final_report.evaluate(
        """element => {
            const rect = element.getBoundingClientRect()
            return { top: rect.top, bottom: rect.bottom, viewport: innerHeight, scrollY }
        }"""
    )
    assert final_scroll_state["scrollY"] > auto_scroll_state["scrollY"], final_scroll_state
    assert final_scroll_state["top"] < final_scroll_state["viewport"] * 0.5, final_scroll_state
    assert final_scroll_state["bottom"] > 0, final_scroll_state
    page.screenshot(path="/tmp/route-lab-final.png", full_page=True)

    # Restart clears the frozen report and rank state immediately.
    page.get_by_role("button", name="0.5×", exact=True).click()
    page.get_by_role("button", name="重新运行").click()
    page.get_by_role("button", name="暂停").click()
    assert page.locator(".final-report").count() == 0
    assert page.locator(".finish-rank").count() == 0

    # A sealed route must finish as unreachable, not be summarized as a successful run.
    page.get_by_role("button", name="返回编辑").click()
    page.wait_for_selector(".editor-map-frame")
    page.get_by_role("button", name="清空障碍").click()
    blocked_canvas = page.locator("canvas.grid-canvas")
    blocked_box = blocked_canvas.bounding_box()
    assert blocked_box is not None
    wall_start = cell_center(blocked_box, 24, 15, 6, 0)
    wall_end = cell_center(blocked_box, 24, 15, 6, 14)
    page.mouse.move(*wall_start)
    page.mouse.down()
    page.mouse.move(*wall_end, steps=1)
    page.mouse.up()
    assert page.locator(".readout").nth(2).locator("strong").inner_text() == "015"
    page.get_by_role("button", name="选择算法并开始", exact=True).click()
    persisted_picker = page.get_by_role(
        "dialog", name="选择本轮执行算法", exact=True
    )
    persisted_picker.wait_for(state="visible")
    assert picker_selected_ids(persisted_picker) == list(DESKTOP_ALGORITHM_IDS)
    persisted_confirm = persisted_picker.locator(".algorithm-picker-confirm")
    assert persisted_confirm.is_enabled()
    assert f"运行 {selected_count} 个算法" in persisted_confirm.inner_text()
    persisted_confirm.click()
    page.get_by_role("button", name="8×", exact=True).click()
    page.wait_for_selector(".phase-indicator--complete", timeout=30_000)
    assert "路线不可达" in page.locator(".analysis-callout-title").inner_text()
    assert "无可行路径" in page.locator(".analysis-callout").inner_text()
    page.wait_for_selector(".final-report")
    failed_cost_rows = page.locator(
        '.final-chart-card[data-metric="cost"] .final-chart-row[data-status="failed"]'
    )
    assert failed_cost_rows.count() == selected_count
    assert all(row.get_attribute("data-value") is None for row in failed_cost_rows.all())
    assert "NaN" not in page.locator(".final-report").inner_text()
    assert "Infinity" not in page.locator(".final-report").inner_text()

    # Responsive smoke check on a narrow viewport.
    mobile_context = browser.new_context(
        viewport={"width": 390, "height": 844},
        device_scale_factor=2,
        is_mobile=True,
        has_touch=True,
        reduced_motion="no-preference",
    )
    stub_external_fonts(mobile_context)
    mobile = mobile_context.new_page()
    mobile.goto(BASE_URL, wait_until="domcontentloaded")
    mobile.wait_for_load_state("networkidle")
    mobile.screenshot(path="/tmp/route-lab-mobile.png", full_page=True)
    dimensions = mobile.evaluate(
        "({ scroll: document.documentElement.scrollWidth, inner: window.innerWidth })"
    )
    assert dimensions["scroll"] <= dimensions["inner"] + 1, dimensions
    assert mobile.get_by_role(
        "button", name="选择算法并开始", exact=True
    ).is_visible()
    assert mobile.locator(".route-section").is_visible()
    assert mobile.locator(".movement-section").is_visible()
    touch_action = mobile.locator("canvas.grid-canvas").evaluate(
        "element => getComputedStyle(element).touchAction"
    )
    assert "pan-y" in touch_action, touch_action

    mobile.get_by_role("button", name="选择算法并开始", exact=True).click()
    mobile_picker = mobile.get_by_role(
        "dialog", name="选择本轮执行算法", exact=True
    )
    mobile_picker.wait_for(state="visible")
    mobile.wait_for_timeout(500)
    mobile.screenshot(path="/tmp/route-lab-picker-mobile.png")
    mobile_picker_dimensions = mobile.evaluate(
        "({ scroll: document.documentElement.scrollWidth, inner: window.innerWidth })"
    )
    assert (
        mobile_picker_dimensions["scroll"] <= mobile_picker_dimensions["inner"] + 1
    ), mobile_picker_dimensions
    mobile_picker.get_by_role("button", name="仅基础", exact=True).click()
    mobile_selected_count = len(CORE_ALGORITHM_IDS)
    assert picker_selected_ids(mobile_picker) == list(CORE_ALGORITHM_IDS)
    mobile_confirm = mobile_picker.locator(".algorithm-picker-confirm")
    assert f"运行 {mobile_selected_count} 个算法" in mobile_confirm.inner_text()
    mobile_confirm.click()
    mobile.wait_for_selector(".algorithm-card")
    assert mobile.locator(".algorithm-card").count() == mobile_selected_count
    assert mobile.locator("canvas.grid-canvas").count() == mobile_selected_count
    assert mobile.locator(".ranking-section").is_visible()
    assert "扩展" in mobile.locator(".live-table-head").inner_text()
    mobile.get_by_role("button", name="8×", exact=True).click()
    mobile.wait_for_selector(".phase-indicator--complete", timeout=30_000, state="attached")
    mobile.wait_for_selector(".final-report")
    assert mobile.locator(".final-rank-item").count() == mobile_selected_count
    assert all(
        mobile.locator(
            f'.final-chart-card[data-metric="{metric}"] .final-chart-row'
        ).count()
        == mobile_selected_count
        for metric in ("expansions", "cpu", "cost", "queue")
    )
    mobile.wait_for_timeout(1400)
    final_mobile_dimensions = mobile.evaluate(
        "({ scroll: document.documentElement.scrollWidth, inner: window.innerWidth })"
    )
    assert final_mobile_dimensions["scroll"] <= final_mobile_dimensions["inner"] + 1, final_mobile_dimensions
    mobile.screenshot(path="/tmp/route-lab-final-mobile.png", full_page=True)

    assert console_errors == [], console_errors
    print(
        {
            "editing_canvas": 1,
            "comparison_canvases": selected_count,
            "expanded_after_850ms": expanded_before_pause,
            "single_step": stepped_values,
            "auto_scroll": auto_scroll_state,
            "final_scroll": final_scroll_state,
            "flip_animations": flip_animation_count,
            "final_charts": 4,
            "mobile_width": dimensions,
            "mobile_picker_width": mobile_picker_dimensions,
            "mobile_algorithms": mobile_selected_count,
            "final_mobile_width": final_mobile_dimensions,
            "mobile_touch_action": touch_action,
            "unreachable_summary": "passed",
            "ignored_external_font_errors": len(external_resource_errors),
            "console_errors": console_errors,
        }
    )
    mobile_context.close()
    context.close()
    browser.close()
