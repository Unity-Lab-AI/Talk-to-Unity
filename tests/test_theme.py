from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]


def strip_css_comments(css: str) -> str:
    return re.sub(r"/\*.*?\*/", "", css, flags=re.S)


def test_voice_theme_has_no_legacy_gradients():
    css = strip_css_comments((ROOT / "AI" / "ai.css").read_text())
    assert "linear-gradient" not in css
    assert "backdrop-filter" not in css


def test_experience_background_is_flat_black():
    css = (ROOT / "AI" / "ai.css").read_text()
    assert "body[data-app-state='experience'] {" in css
    assert "background: #000000;" in css


def test_voice_stage_uses_transparent_shell():
    css = (ROOT / "AI" / "ai.css").read_text()
    assert ".voice-stage" in css
    assert "background: transparent;" in css
    assert "border: none;" in css


def test_root_style_is_single_tone():
    css = strip_css_comments((ROOT / "style.css").read_text())
    assert "--background-color: #000000;" in css
    assert "background: var(--background-color);" in css
    assert "linear-gradient" not in css
