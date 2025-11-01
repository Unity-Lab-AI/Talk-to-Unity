from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]


def strip_css_comments(css: str) -> str:
    return re.sub(r"/\*.*?\*/", "", css, flags=re.S)


def test_voice_theme_uses_layered_gradients():
    css = strip_css_comments((ROOT / "AI" / "ai.css").read_text())
    assert "body[data-app-state='experience'] {" in css
    assert "radial-gradient" in css
    assert "linear-gradient" in css
    assert "backdrop-filter" in css


def test_experience_background_uses_dark_gradient():
    css = (ROOT / "AI" / "ai.css").read_text()
    assert "background: radial-gradient" in css
    assert "#020617" in css
    assert "#01030f" in css


def test_voice_stage_has_glass_shell():
    css = (ROOT / "AI" / "ai.css").read_text()
    selector = "body[data-app-state='experience'] .voice-stage {"
    assert selector in css
    start = css.index(selector)
    end = css.index('}', start)
    block = css[start:end]
    assert "radial-gradient" in block
    assert "border-radius" in block
    assert "border: 1px solid" in block


def test_root_style_defines_solid_theme():
    css = strip_css_comments((ROOT / "style.css").read_text())
    assert "--background-color" in css
    assert "background: var(--background-color" in css
    assert "--surface-color" in css
    assert "--surface-highlight" in css
