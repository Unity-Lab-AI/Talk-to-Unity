from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]


def strip_css_comments(css: str) -> str:
    return re.sub(r"/\*.*?\*/", "", css, flags=re.S)


def test_voice_theme_uses_solid_colors():
    css = strip_css_comments((ROOT / "AI" / "ai.css").read_text())
    assert "body[data-app-state='experience'] {" in css
    assert "var(--background-color)" in css
    assert "radial-gradient" not in css
    assert "linear-gradient" not in css


def test_experience_background_is_flat():
    css = (ROOT / "AI" / "ai.css").read_text()
    selector = "body[data-app-state='experience'] {"
    assert selector in css
    start = css.index(selector)
    end = css.index('}', start)
    block = css[start:end]
    assert "background: var(--background-color);" in block
    assert "radial-gradient" not in block


def test_voice_stage_uses_solid_shell():
    css = (ROOT / "AI" / "ai.css").read_text()
    selector = "body[data-app-state='experience'] .voice-stage {"
    assert selector in css
    start = css.index(selector)
    end = css.index('}', start)
    block = css[start:end]
    assert "background: var(--surface-color);" in block
    assert "radial-gradient" not in block
    assert "border-radius" in block
    assert "border: 1px solid" in block


def test_root_style_defines_solid_theme():
    css = strip_css_comments((ROOT / "style.css").read_text())
    assert "--background-color" in css
    assert "background: var(--background-color" in css
    assert "--surface-color" in css
    assert "--surface-highlight" in css
