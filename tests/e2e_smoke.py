from pathlib import Path
from playwright.sync_api import sync_playwright


BASE_URL = "http://127.0.0.1:5173"
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"


def cell_center(box, cols, rows, x, y):
    return (
        box["x"] + (x + 0.5) * box["width"] / cols,
        box["y"] + (y + 0.5) * box["height"] / rows,
    )


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True, executable_path=CHROME)
    context = browser.new_context(viewport={"width": 1440, "height": 1000}, device_scale_factor=1)
    page = context.new_page()
    console_errors = []
    page.on("console", lambda message: console_errors.append(message.text) if message.type == "error" else None)
    page.on("pageerror", lambda error: console_errors.append(str(error)))

    # Reconnaissance: render first, wait for all app JavaScript, then inspect the live page.
    page.goto(BASE_URL, wait_until="domcontentloaded")
    page.wait_for_load_state("networkidle")
    page.screenshot(path="/tmp/route-lab-edit.png", full_page=True)
    assert page.title() == "ROUTE/LAB · 路径规划观测台"
    assert page.locator("canvas.grid-canvas").count() == 1
    assert page.get_by_role("button", name="锁定并开始").is_enabled()

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

    # Start all four runners from the frozen scenario and verify live telemetry.
    page.get_by_role("button", name="锁定并开始").click()
    page.wait_for_selector(".algorithm-card")
    assert page.locator(".algorithm-card").count() == 4
    assert page.locator("canvas.grid-canvas").count() == 4
    page.wait_for_timeout(850)
    expanded_before_pause = [
        int(text.replace(",", ""))
        for text in page.locator(".algorithm-card .metric--emphasize strong").all_inner_texts()
    ]
    assert all(value > 0 for value in expanded_before_pause)

    # Pause must freeze all counters; one synchronized step must advance active runners once.
    page.get_by_role("button", name="暂停").click()
    page.wait_for_timeout(200)
    paused_values = [
        int(text.replace(",", ""))
        for text in page.locator(".algorithm-card .metric--emphasize strong").all_inner_texts()
    ]
    page.wait_for_timeout(350)
    paused_values_later = [
        int(text.replace(",", ""))
        for text in page.locator(".algorithm-card .metric--emphasize strong").all_inner_texts()
    ]
    assert paused_values_later == paused_values

    page.get_by_role("button", name="所有算法单步前进").click()
    page.wait_for_timeout(100)
    stepped_values = [
        int(text.replace(",", ""))
        for text in page.locator(".algorithm-card .metric--emphasize strong").all_inner_texts()
    ]
    assert all(after - before in (0, 1) for before, after in zip(paused_values, stepped_values))
    assert any(after - before == 1 for before, after in zip(paused_values, stepped_values))
    page.screenshot(path="/tmp/route-lab-running.png", full_page=True)

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
    page.get_by_role("button", name="锁定并开始").click()
    page.get_by_role("button", name="8×", exact=True).click()
    page.wait_for_selector(".phase-indicator--complete", timeout=10_000)
    assert "路线不可达" in page.locator(".analysis-callout-title").inner_text()
    assert "无可行路径" in page.locator(".analysis-callout").inner_text()

    # Responsive smoke check on a narrow viewport.
    mobile_context = browser.new_context(
        viewport={"width": 390, "height": 844},
        device_scale_factor=2,
        is_mobile=True,
        has_touch=True,
    )
    mobile = mobile_context.new_page()
    mobile.goto(BASE_URL, wait_until="domcontentloaded")
    mobile.wait_for_load_state("networkidle")
    mobile.screenshot(path="/tmp/route-lab-mobile.png", full_page=True)
    dimensions = mobile.evaluate(
        "({ scroll: document.documentElement.scrollWidth, inner: window.innerWidth })"
    )
    assert dimensions["scroll"] <= dimensions["inner"] + 1, dimensions
    assert mobile.get_by_role("button", name="锁定并开始").is_visible()
    assert mobile.locator(".route-section").is_visible()
    assert mobile.locator(".movement-section").is_visible()
    touch_action = mobile.locator("canvas.grid-canvas").evaluate(
        "element => getComputedStyle(element).touchAction"
    )
    assert "pan-y" in touch_action, touch_action

    mobile.get_by_role("button", name="锁定并开始").click()
    mobile.wait_for_selector(".algorithm-card")
    assert mobile.locator(".ranking-section").is_visible()
    assert "扩展" in mobile.locator(".live-table-head").inner_text()

    assert console_errors == [], console_errors
    print(
        {
            "editing_canvas": 1,
            "comparison_canvases": 4,
            "expanded_after_850ms": expanded_before_pause,
            "single_step": stepped_values,
            "mobile_width": dimensions,
            "mobile_touch_action": touch_action,
            "unreachable_summary": "passed",
            "console_errors": console_errors,
        }
    )
    mobile_context.close()
    context.close()
    browser.close()
