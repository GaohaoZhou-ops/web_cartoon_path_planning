from pathlib import Path
from playwright.sync_api import sync_playwright


BASE_URL = "http://127.0.0.1:5173"
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
DESKTOP_ALGORITHM_IDS = (
    "flow-field",
    "field-dstar",
    "lpa-star",
    "ad-star",
    "rrt-star",
    "prm",
)
CORE_ALGORITHM_IDS = ("astar", "jps", "dijkstra", "bfs", "greedy")
ALGORITHM_CATEGORIES = {
    "static-grid": (
        "astar",
        "bidirectional-astar",
        "theta",
        "dijkstra",
        "bfs",
        "greedy",
    ),
    "dynamic-replanning": (
        "dstar-lite",
        "field-dstar",
        "lpa-star",
        "ad-star",
    ),
    "game-pathfinding": ("jps", "jps-plus", "flow-field", "hpa-star"),
    "continuous-navigation": (
        "hybrid-astar",
        "state-lattice",
        "fast-marching",
        "rrt-star",
        "prm",
    ),
    "local-trajectory": ("teb", "dwa", "vfh", "potential-field", "trajopt"),
}


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


def chart_results(page, metric):
    return [
        {
            "status": row.get_attribute("data-status"),
            "value": (
                float(value)
                if (value := row.get_attribute("data-value")) is not None
                else None
            ),
        }
        for row in page.locator(
            f'.final-chart-card[data-metric="{metric}"] .final-chart-row'
        ).all()
    ]


def assert_chart_best_first(results):
    assert results
    assert all(
        result["status"] in ("complete", "failed") for result in results
    ), results
    statuses = [result["status"] for result in results]
    assert statuses == sorted(statuses, key=lambda status: status != "complete"), statuses

    for status in ("complete", "failed"):
        values = [
            result["value"] for result in results if result["status"] == status
        ]
        populated = [value for value in values if value is not None]
        assert populated == sorted(populated), values
        assert values == populated + [None] * (len(values) - len(populated)), values


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

    # Resize automatically, reject invalid drafts, preserve route nodes, and undo atomically.
    grid_cols = page.get_by_label("地图列数", exact=True)
    grid_rows = page.get_by_label("地图行数", exact=True)
    assert grid_cols.input_value() == "24"
    assert grid_rows.input_value() == "15"
    assert grid_cols.get_attribute("min") == "5"
    assert grid_rows.get_attribute("min") == "5"
    assert grid_cols.get_attribute("max") == "100"
    assert grid_rows.get_attribute("max") == "100"
    assert page.get_by_role("button", name="应用尺寸", exact=True).count() == 0

    grid_cols.fill("101")
    assert grid_cols.get_attribute("aria-invalid") == "true"
    page.wait_for_timeout(550)
    assert page.locator(".readout").first.locator("strong").inner_text() == "24×15"
    grid_cols.press("Escape")
    assert grid_cols.input_value() == "24"

    grid_cols.fill("4")
    assert grid_cols.get_attribute("aria-invalid") == "true"
    page.locator(".stage-heading").click()
    assert grid_cols.input_value() == "24"
    assert page.locator(".readout").first.locator("strong").inner_text() == "24×15"

    grid_cols.fill("30")
    assert page.locator(".grid-size-control").get_attribute("aria-busy") == "true"
    grid_cols.press("Escape")
    page.wait_for_timeout(550)
    assert grid_cols.input_value() == "24"
    assert page.locator(".readout").first.locator("strong").inner_text() == "24×15"

    grid_cols.fill("5")
    grid_rows.fill("5")
    page.wait_for_function(
        "document.querySelector('.readout strong')?.textContent?.trim() === '5×5'"
    )
    assert page.locator(".readout").first.locator("strong").inner_text() == "5×5"
    assert page.locator(".map-coordinates--top > span").count() == 5
    assert page.locator(".map-coordinates--left > span").count() == 5
    assert page.get_by_role(
        "button", name="选择算法并开始", exact=True
    ).is_enabled()
    assert not page.locator(".route-node--start").get_attribute("class").endswith("is-missing")
    assert not page.locator(".route-node--end").get_attribute("class").endswith("is-missing")
    assert "X 02 · Y 04" in page.locator(".route-node--start small").inner_text()
    assert "X 04 · Y 03" in page.locator(".route-node--end small").inner_text()
    resized_block_count = int(
        page.locator(".readout").nth(2).locator("strong").inner_text()
    )
    assert 0 <= resized_block_count < 25
    page.screenshot(path="/tmp/route-lab-grid-size.png", full_page=True)

    page.get_by_role("button", name="撤销", exact=True).click()
    page.wait_for_function(
        "document.querySelector('.readout strong')?.textContent?.trim() === '24×15'"
    )
    page.wait_for_timeout(550)
    assert grid_cols.input_value() == "24"
    assert grid_rows.input_value() == "15"
    assert page.locator(".readout").first.locator("strong").inner_text() == "24×15"
    assert page.locator(".readout").nth(2).locator("strong").inner_text() == "048"
    assert page.locator(".map-coordinates--top > span").count() == 24
    assert page.locator(".map-coordinates--left > span").count() == 15
    assert page.get_by_role(
        "button", name="选择算法并开始", exact=True
    ).is_enabled()

    # An immediate canvas click flushes the pending size first and must not edit the old grid.
    race_canvas_box = page.locator("canvas.grid-canvas").bounding_box()
    assert race_canvas_box is not None
    grid_cols.fill("6")
    grid_rows.fill("5")
    race_x, race_y = cell_center(race_canvas_box, 24, 15, 0, 0)
    page.mouse.click(race_x, race_y)
    page.wait_for_function(
        "document.querySelector('.readout strong')?.textContent?.trim() === '6×5'"
    )
    page.get_by_role("button", name="撤销", exact=True).click()
    page.wait_for_function(
        """document.querySelector('.readout strong')?.textContent?.trim() === '24×15'
            && document.querySelector('#grid-cols')?.value === '24'
            && document.querySelector('#grid-rows')?.value === '15'"""
    )
    assert page.locator(".readout").nth(2).locator("strong").inner_text() == "048"

    extreme_grid_boxes = {}
    for cols, rows in ((5, 100), (100, 5)):
        grid_cols.fill(str(cols))
        grid_rows.fill(str(rows))
        grid_rows.press("Enter")
        page.wait_for_function(
            f"document.querySelector('.readout strong')?.textContent?.trim() === '{cols}×{rows}'"
        )
        grid_box = page.locator("canvas.grid-canvas").bounding_box()
        assert grid_box is not None
        assert grid_box["height"] <= min(1000 * 0.72, 900) + 1, grid_box
        assert abs(grid_box["width"] / grid_box["height"] - cols / rows) < 0.01, grid_box
        assert page.locator(".editor-grid-viewport").get_attribute(
            "data-compact-overlays"
        ) == "true"
        assert page.locator(".map-overlay:visible").count() == 0
        extreme_grid_boxes[f"{cols}x{rows}"] = grid_box
        page.get_by_role("button", name="撤销", exact=True).click()
        page.wait_for_function(
            """document.querySelector('.readout strong')?.textContent?.trim() === '24×15'
                && document.querySelector('#grid-cols')?.value === '24'
                && document.querySelector('#grid-rows')?.value === '15'"""
        )
        assert grid_cols.input_value() == "24"
        assert grid_rows.input_value() == "15"
    assert page.locator(".map-overlay:visible").count() == 2

    # Runtime cards use the same compact-overlay rule on an extreme aspect ratio.
    grid_cols.fill("100")
    grid_rows.fill("5")
    grid_rows.press("Enter")
    page.wait_for_function(
        "document.querySelector('.readout strong')?.textContent?.trim() === '100×5'"
    )
    extreme_canvas = page.locator("canvas.grid-canvas")
    extreme_canvas_box = extreme_canvas.bounding_box()
    assert extreme_canvas_box is not None
    assert page.get_by_role(
        "button", name="选择算法并开始", exact=True
    ).is_enabled()
    page.get_by_role("button", name="选择算法并开始", exact=True).click()
    compact_picker = page.get_by_role("dialog", name="选择本轮执行算法", exact=True)
    compact_picker.get_by_role("button", name="清空", exact=True).click()
    compact_picker.locator('[data-picker-algorithm-id="astar"]').click()
    compact_picker.locator(".algorithm-picker-confirm").click()
    page.wait_for_selector(".algorithm-card")
    assert page.locator(
        '.algorithm-canvas-wrap[data-compact-overlays="true"]'
    ).count() == 1
    assert page.locator(".segment-badge:visible").count() == 0
    assert page.locator(".canvas-legend:visible").count() == 0
    page.get_by_role("button", name="8×", exact=True).click()
    page.wait_for_selector(".phase-indicator--complete", timeout=10_000)
    assert page.locator(
        '.algorithm-card[data-algorithm-id="astar"].algorithm-card--complete'
    ).count() == 1
    page.get_by_role("button", name="2×", exact=True).click()
    page.get_by_role("button", name="返回编辑", exact=True).click()
    page.get_by_role("button", name="撤销", exact=True).click()
    page.wait_for_function(
        """document.querySelector('.readout strong')?.textContent?.trim() === '24×15'
            && document.querySelector('#grid-cols')?.value === '24'
            && document.querySelector('#grid-rows')?.value === '15'"""
    )
    assert grid_cols.input_value() == "24"
    assert grid_rows.input_value() == "15"

    # The explicit random-obstacle action also preserves a complete route.
    page.get_by_role("button", name="随机障碍", exact=True).click()
    page.get_by_role("button", name="选择算法并开始", exact=True).click()
    reachable_picker = page.get_by_role("dialog", name="选择本轮执行算法", exact=True)
    assert picker_selected_ids(reachable_picker) == ["astar"]
    reachable_picker.locator(".algorithm-picker-confirm").click()
    page.get_by_role("button", name="8×", exact=True).click()
    page.wait_for_selector(".phase-indicator--complete", timeout=10_000)
    assert page.locator(
        '.algorithm-card[data-algorithm-id="astar"].algorithm-card--complete'
    ).count() == 1
    page.get_by_role("button", name="2×", exact=True).click()
    page.get_by_role("button", name="返回编辑", exact=True).click()
    page.get_by_role("button", name="撤销", exact=True).click()
    page.wait_for_function(
        "document.querySelector('.readout strong')?.textContent?.trim() === '24×15'"
    )
    assert page.locator(".readout").nth(2).locator("strong").inner_text() == "048"

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

    # Verify the complete categorized catalog, then choose a six-runner formation.
    selected_count = len(DESKTOP_ALGORITHM_IDS)
    page.get_by_role("button", name="选择算法并开始", exact=True).click()
    picker = page.get_by_role("dialog", name="选择本轮执行算法", exact=True)
    picker.wait_for(state="visible")
    assert picker.locator("[data-picker-algorithm-id]").count() == 24
    for category_id, algorithm_ids in ALGORITHM_CATEGORIES.items():
        category = picker.locator(
            f'[data-picker-category-id="{category_id}"]'
        )
        assert category.count() == 1
        assert [
            option.get_attribute("data-picker-algorithm-id")
            for option in category.locator("[data-picker-algorithm-id]").all()
        ] == list(algorithm_ids)
    picker.screenshot(path="/tmp/route-lab-picker.png")
    picker.get_by_role("button", name="清空", exact=True).click()
    picker_confirm = picker.locator(".algorithm-picker-confirm")
    assert picker_selected_ids(picker) == []
    assert picker_confirm.is_disabled()
    assert "运行 0 个算法" in picker_confirm.inner_text()

    static_toggle = picker.locator(
        '[data-picker-category-toggle="static-grid"]'
    )
    static_toggle.click()
    assert set(picker_selected_ids(picker)) == set(
        ALGORITHM_CATEGORIES["static-grid"]
    )
    assert "清除此类" in static_toggle.inner_text()
    static_toggle.click()
    assert picker_selected_ids(picker) == []

    local_toggle = picker.locator(
        '[data-picker-category-toggle="local-trajectory"]'
    )
    local_toggle.click()
    assert set(picker_selected_ids(picker)) == set(
        ALGORITHM_CATEGORIES["local-trajectory"]
    )
    local_toggle.click()
    assert picker_selected_ids(picker) == []

    for algorithm_id in DESKTOP_ALGORITHM_IDS:
        option = picker.locator(
            f'[data-picker-algorithm-id="{algorithm_id}"]'
        )
        assert option.get_attribute("aria-pressed") == "false"
        option.click()

    assert set(picker_selected_ids(picker)) == set(DESKTOP_ALGORITHM_IDS)
    assert picker_confirm.is_enabled()
    assert f"运行 {selected_count} 个算法" in picker_confirm.inner_text()
    picker_confirm.click()
    page.wait_for_selector(".algorithm-card")
    assert page.locator(".algorithm-card").count() == selected_count
    assert page.locator("canvas.grid-canvas").count() == selected_count
    assert set(expanded_by_algorithm(page)) == set(DESKTOP_ALGORITHM_IDS)
    page.wait_for_timeout(850)
    expanded_before_pause = expanded_by_algorithm(page)
    assert all(
        expanded_before_pause[algorithm] > 0
        for algorithm in DESKTOP_ALGORITHM_IDS
        if algorithm != "prm"
    )
    assert "采样" in page.locator(
        '.algorithm-card[data-algorithm-id="prm"] .algorithm-action'
    ).inner_text()

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
    page.get_by_role("button", name="8×", exact=True).click()
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
    finished_card_order = [
        card.get_attribute("data-algorithm-id")
        for card in page.locator(".algorithm-card").all()
    ]
    assert [
        page.locator(".algorithm-card").nth(index).get_attribute("data-algorithm-id")
        for index in range(len(locked_finishers))
    ] == locked_finishers

    # Final telemetry appears below all cards, animates its ranking, and mirrors card metrics.
    final_report = page.locator(".final-report")
    final_report.wait_for(state="visible")
    assert page.locator(".final-rank-item").count() == selected_count
    assert [
        item.get_attribute("data-algorithm-id")
        for item in page.locator(".final-rank-item").all()
    ] == finished_card_order
    assert page.locator(".final-chart-card").count() == 4
    assert all(
        page.locator(f'.final-chart-card[data-metric="{metric}"] .final-chart-row').count()
        == selected_count
        for metric in ("expansions", "cpu", "cost", "queue")
    )
    for metric in ("expansions", "cpu", "cost", "queue"):
        assert_chart_best_first(chart_results(page, metric))
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
    page.get_by_role("button", name="障碍画笔 1").click()
    blocked_canvas = page.locator("canvas.grid-canvas")
    blocked_canvas.scroll_into_view_if_needed()
    blocked_box = blocked_canvas.bounding_box()
    assert blocked_box is not None
    wall_start = cell_center(blocked_box, 24, 15, 6, 0)
    wall_end = cell_center(blocked_box, 24, 15, 6, 14)
    page.mouse.move(*wall_start)
    page.mouse.down()
    page.mouse.move(*wall_end, steps=14)
    page.mouse.up()
    blocked_count = page.locator(".readout").nth(2).locator("strong").inner_text()
    assert blocked_count == "015", blocked_count
    page.get_by_role("button", name="选择算法并开始", exact=True).click()
    persisted_picker = page.get_by_role(
        "dialog", name="选择本轮执行算法", exact=True
    )
    persisted_picker.wait_for(state="visible")
    assert set(picker_selected_ids(persisted_picker)) == set(DESKTOP_ALGORITHM_IDS)
    persisted_confirm = persisted_picker.locator(".algorithm-picker-confirm")
    assert persisted_confirm.is_enabled()
    assert f"运行 {selected_count} 个算法" in persisted_confirm.inner_text()
    persisted_confirm.click()
    page.get_by_role("button", name="8×", exact=True).click()
    page.wait_for_selector(".phase-indicator--complete", timeout=30_000)
    assert "预算未连通" in page.locator(".analysis-callout-title").inner_text()
    assert "未完成" in page.locator(".analysis-callout").inner_text()
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
    assert mobile.get_by_label("地图列数", exact=True).is_visible()
    assert mobile.get_by_label("地图行数", exact=True).is_visible()
    assert mobile.get_by_label("地图列数", exact=True).get_attribute("min") == "5"
    assert mobile.get_by_label("地图列数", exact=True).get_attribute("max") == "100"
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
    mobile_last_option = mobile_picker.locator(
        '[data-picker-algorithm-id="trajopt"]'
    )
    mobile_last_option.scroll_into_view_if_needed()
    assert mobile_last_option.is_visible()
    assert mobile_picker.locator(".algorithm-picker-footer").is_visible()
    mobile.screenshot(path="/tmp/route-lab-picker-mobile-last-group.png")
    mobile_picker.get_by_role("button", name="仅基础", exact=True).click()
    mobile_selected_count = len(CORE_ALGORITHM_IDS)
    assert set(picker_selected_ids(mobile_picker)) == set(CORE_ALGORITHM_IDS)
    mobile_confirm = mobile_picker.locator(".algorithm-picker-confirm")
    assert f"运行 {mobile_selected_count} 个算法" in mobile_confirm.inner_text()
    mobile_confirm.click()
    mobile.wait_for_selector(".algorithm-card")
    assert mobile.locator(".algorithm-card").count() == mobile_selected_count
    assert mobile.locator("canvas.grid-canvas").count() == mobile_selected_count
    assert mobile.locator(".ranking-section").is_visible()
    assert "工作" in mobile.locator(".live-table-head").inner_text()
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
    for metric in ("expansions", "cpu", "cost", "queue"):
        assert_chart_best_first(chart_results(mobile, metric))
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
            "grid_resize": "passed",
            "extreme_grid_boxes": extreme_grid_boxes,
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
