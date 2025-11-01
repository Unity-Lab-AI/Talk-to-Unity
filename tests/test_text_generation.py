import requests


def test_public_page_contains_call_to_action():
    response = requests.get("http://www.unityailab.com/Talk-to-Unity", timeout=15)
    response.raise_for_status()
    html = response.text
    assert "Tap or click anywhere to unmute" in html
