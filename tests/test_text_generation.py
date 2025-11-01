def test_public_page_contains_call_to_action():
    from pathlib import Path

    repo_root = Path(__file__).resolve().parent.parent
    html = (repo_root / "index.html").read_text(encoding="utf-8")
    assert "Launch Unity Voice Lab" in html
