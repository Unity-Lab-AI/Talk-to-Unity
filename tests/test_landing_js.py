from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
LANDING_JS = (ROOT / "landing.js").read_text()


def test_landing_js_defines_expected_functions():
    function_names = set(re.findall(r"function[ \t]+(\w+)", LANDING_JS))
    expected = {
        "formatDependencyList",
        "getDependencyStatuses",
        "setStatusMessage",
        "updateLaunchButtonState",
        "showRecheckInProgress",
        "setLaunchButtonState",
        "evaluateDependencies",
        "updateDependencyUI",
    }
    missing = sorted(expected - function_names)
    assert not missing, f"Missing landing.js functions: {missing}"


def test_landing_evaluate_dependencies_tracks_missing_items():
    match = re.search(r"function evaluateDependencies\([^)]*\)\s*{(.*?)}\s*function", LANDING_JS, re.S)
    assert match, "evaluateDependencies definition not found"
    body = match.group(1)
    assert "const results = dependencyChecks.map" in body
    assert "const missing = results.filter" in body
    assert "updateDependencyUI(results, allMet" in body


def test_landing_dom_ready_hooks_present():
    assert "document.addEventListener('DOMContentLoaded'" in LANDING_JS
    assert "launchButton?.addEventListener('click'" in LANDING_JS
    assert "recheckButton?.addEventListener('click'" in LANDING_JS
