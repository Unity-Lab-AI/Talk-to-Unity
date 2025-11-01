import re


def test_auto_start_without_landing_section(app_js: str) -> None:
    assert "const shouldAutoStartExperience = !launchButton && !landingSection;" in app_js
    assert "if (shouldAutoStartExperience)" in app_js
    assert "void startApplication();" in app_js


def test_app_js_defines_expected_functions(app_js: str) -> None:
    function_names = set(re.findall(r"function[ \t]+(\w+)", app_js))
    expected = {
        "formatDependencyList",
        "setStatusMessage",
        "updateLaunchButtonState",
        "ensureCompatibilityBanner",
        "showRecheckInProgress",
        "resolveAssetPath",
        "setLaunchButtonState",
        "evaluateDependencies",
        "updateDependencyUI",
        "startApplication",
        "setMutedState",
        "applyTheme",
        "setCircleState",
        "loadSystemPrompt",
        "setupSpeechRecognition",
        "initializeVoiceControl",
        "requestMicPermission",
        "updateMuteIndicator",
        "showMicrophonePermissionRequest",
        "attemptUnmute",
        "handleMuteToggle",
        "isLikelyUrlSegment",
        "removeMarkdownLinkTargets",
        "removeCommandArtifacts",
        "sanitizeForSpeech",
        "sanitizeImageUrl",
        "shouldRequestFallbackImage",
        "cleanFallbackPrompt",
        "buildFallbackImagePrompt",
        "buildPollinationsImageUrl",
        "extractImageUrl",
        "escapeRegExp",
        "removeImageReferences",
        "normalizeCommandValue",
        "parseAiDirectives",
        "executeAiCommand",
        "speak",
        "handleVoiceCommand",
        "isUnityDomain",
        "shouldUseUnityReferrer",
        "getAIResponse",
        "getImageUrl",
        "updateHeroImage",
        "copyImageToClipboard",
        "saveImage",
        "openImageInNewTab",
    }
    missing = sorted(expected - function_names)
    assert not missing, f"Missing functions from app.js: {missing}"


def test_start_application_sets_app_state(app_js: str) -> None:
    match = re.search(r"async function startApplication\([^)]*\)\s*{(.*?)}\s*async function", app_js, re.S)
    assert match, "startApplication definition not found"
    body = match.group(1)
    assert "appStarted = true;" in body or "appStarted = !0" in body
    assert "bodyElement.dataset.appState = 'experience';" in body


def test_set_muted_state_announces_changes(app_js: str) -> None:
    match = re.search(r"async function setMutedState\([^)]*\)\s*{(.*?)}\s*async function", app_js, re.S)
    assert match, "setMutedState definition not found"
    body = match.group(1)
    assert "isMuted = muted;" in body or "isMuted = true;" in body
    assert "updateMuteIndicator();" in body
    assert "announce" in body
