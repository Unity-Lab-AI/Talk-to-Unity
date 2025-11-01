
from pathlib import Path

import requests

def test_public_page_contains_call_to_action():
    candidate_urls = [
        "https://unityailab.online/Talk-to-Unity/",
        "http://www.unityailab.com/Talk-to-Unity",
    ]
    html_sources: list[str] = []

    for url in candidate_urls:
        try:
            response = requests.get(url, timeout=15)
        except requests.RequestException:
            continue

        try:
            response.raise_for_status()
        except requests.HTTPError:
            continue

        html_sources.append(response.text)
        if "Tap or click anywhere to unmute" in response.text:
            break

    if not any("Tap or click anywhere to unmute" in source for source in html_sources):
        for local_path in (Path("index.html"), Path("AI/index.html")):
            if not local_path.exists():
                continue

            contents = local_path.read_text(encoding="utf-8")
            html_sources.append(contents)

            if "Tap or click anywhere to unmute" in contents:
                break

    combined_html = "\n".join(html_sources)
    assert "Tap or click anywhere to unmute" in combined_html

