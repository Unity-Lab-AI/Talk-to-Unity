from pathlib import Path

from playwright.sync_api import sync_playwright


REPO_ROOT = Path(__file__).resolve().parent.parent
LANDING_URL = REPO_ROOT.joinpath("index.html").resolve().as_uri()


def test_landing_page_structure():
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        context = browser.new_context(ignore_https_errors=True)
        page = context.new_page()
        page.goto(LANDING_URL, wait_until="load")

        title = page.locator("#landing-title")
        assert title.inner_text().strip().lower() == "let’s make sure every light is green"

        landing = page.locator("#landing")
        assert landing.is_visible()

        badge = page.locator(".landing-badge")
        assert badge.inner_text().strip().lower() == "unity voice lab check-in"

        links = page.locator(".landing-link")
        assert links.count() == 2
        assert "back to unity ai lab" in links.nth(0).inner_text().strip().lower()
        assert "view the project on github" in links.nth(1).inner_text().strip().lower()

        dependency_items = page.locator(".dependency-item")
        assert dependency_items.count() == 4
        statuses = page.locator(".dependency-status")
        assert statuses.count() == 4
        for idx in range(statuses.count()):
            status_text = statuses.nth(idx).inner_text().strip().lower()
            assert status_text in {"checking…", "checking...", "ready", "check settings"}

        launch_button = page.locator("#launch-app")
        assert launch_button.inner_text().strip() == "Talk to Unity"
        state_attr = launch_button.get_attribute("data-state") or ""
        assert state_attr in {"warn", "pending", "ready"}

        context.close()
        browser.close()
