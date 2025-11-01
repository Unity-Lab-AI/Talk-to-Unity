from __future__ import annotations

from pathlib import Path


def test_landing_assets_are_copied(built_site: Path) -> None:
    for asset in ("index.html", "landing.js", "style.css", "ai-instruct.txt"):
        asset_path = built_site / asset
        assert asset_path.exists(), f"Missing landing asset in build output: {asset_path}"


def test_ai_application_assets_are_copied(built_site: Path) -> None:
    ai_dir = built_site / "AI"
    assert (ai_dir / "index.html").exists(), "AI index.html missing from build output"
    assert (ai_dir / "app.js").exists(), "AI app.js missing from build output"
    assert (ai_dir / "ai.css").exists(), "AI stylesheet missing from build output"


def test_ai_application_page_includes_new_redirect(built_site: Path) -> None:
    ai_index = (built_site / "AI" / "index.html").read_text(encoding="utf-8")
    assert "checks-passed=true" in ai_index
    assert "Unity Voice Lab" in ai_index
    assert '<script defer src="./app.js"></script>' in ai_index


def test_ai_styles_reflect_refined_layout(built_site: Path) -> None:
    ai_css = (built_site / "AI" / "ai.css").read_text(encoding="utf-8")
    assert "body[data-app-state='experience'] .voice-stage" in ai_css
    assert "border-radius" in ai_css
    assert "compatibility-notice" in ai_css
