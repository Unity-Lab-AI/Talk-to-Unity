from pathlib import Path

import pytest
from playwright.sync_api import Error, sync_playwright


REPO_ROOT = Path(__file__).resolve().parent.parent
SITE_URL = REPO_ROOT.joinpath("AI", "index.html").resolve().as_uri()


STUB_SCRIPT = """
(() => {
    const state = {
        speakCalls: [],
        recognitionStartCalls: 0,
        recognitionStopCalls: 0,
        getUserMediaCalls: 0
    };

    Object.defineProperty(window, "__testState", {
        value: state,
        configurable: false,
        writable: false
    });

    class TestRecognition {
        constructor() {
            this.continuous = true;
            this.lang = "en-US";
            this.interimResults = false;
            this.maxAlternatives = 1;
            this._isActive = false;
        }

        start() {
            if (this._isActive) {
                return;
            }

            this._isActive = true;
            state.recognitionStartCalls += 1;

            const trigger = (callback) => {
                if (typeof callback === "function") {
                    try {
                        callback.call(this);
                    } catch (error) {
                        console.error("Test stub callback error", error);
                    }
                }
            };

            setTimeout(() => {
                trigger(this.onstart);
                trigger(this.onaudiostart);
                trigger(this.onspeechstart);
            }, 0);
        }

        stop() {
            if (!this._isActive) {
                return;
            }

            this._isActive = false;
            state.recognitionStopCalls += 1;

            const trigger = (callback) => {
                if (typeof callback === "function") {
                    try {
                        callback.call(this);
                    } catch (error) {
                        console.error("Test stub callback error", error);
                    }
                }
            };

            setTimeout(() => {
                trigger(this.onspeechend);
                trigger(this.onend);
            }, 0);
        }
    }

    window.SpeechRecognition = TestRecognition;
    window.webkitSpeechRecognition = TestRecognition;

    const synth = window.speechSynthesis;
    if (synth) {
        try {
            synth.getVoices = () => [];
        } catch (error) {
            console.warn("Unable to override getVoices", error);
        }

        try {
            Object.defineProperty(synth, "speaking", {
                configurable: true,
                get() {
                    return false;
                }
            });
        } catch (error) {
            console.warn("Unable to redefine speaking property", error);
        }

        const stubbedSpeak = (utterance) => {
            const spoken =
                typeof utterance === "string"
                    ? utterance
                    : typeof utterance?.text === "string"
                    ? utterance.text
                    : "";
            state.speakCalls.push(spoken);
        };

        try {
            synth.speak = stubbedSpeak;
        } catch (error) {
            try {
                Object.defineProperty(synth, "speak", {
                    configurable: true,
                    writable: true,
                    value: stubbedSpeak
                });
            } catch (defineError) {
                console.warn("Unable to override speechSynthesis.speak", defineError);
            }
        }

        try {
            synth.cancel = () => {};
        } catch (error) {
            console.warn("Unable to override speechSynthesis.cancel", error);
        }
    }

    if (!navigator.mediaDevices) {
        navigator.mediaDevices = {};
    }

    navigator.mediaDevices.getUserMedia = function () {
        state.getUserMediaCalls += 1;
        return Promise.resolve({
            getTracks() {
                return [
                    {
                        stop() {}
                    }
                ];
            }
        });
    };
})();
"""


def launch_chromium(playwright):
    try:
        return playwright.chromium.launch()
    except Error as exc:
        message = str(exc)
        if "Executable doesn't exist" in message:
            pytest.skip('Playwright Chromium browser is not installed in this environment.')
        raise


@pytest.fixture
def loaded_page():
    with sync_playwright() as playwright:
        browser = launch_chromium(playwright)
        context = browser.new_context(ignore_https_errors=True)
        page = context.new_page()
        page.add_init_script(STUB_SCRIPT)
        page.goto(SITE_URL, wait_until="load")
        page.wait_for_selector("#mute-indicator")
        yield page
        context.close()
        browser.close()


def test_unmute_flow_triggers_recognition_and_updates_indicator(loaded_page):
    page = loaded_page
    page.evaluate("window.__testState.recognitionStartCalls = 0")
    page.dispatch_event("body", "click")
    page.wait_for_function(
        "() => window.__testState.recognitionStartCalls > 0",
        timeout=10_000,
    )

    indicator_text = page.text_content("#mute-indicator .indicator-text")
    assert indicator_text is not None
    assert "Listening" in indicator_text

    user_is_listening = page.evaluate(
        """() => document.querySelector('[data-role="user"]').classList.contains('is-listening')"""
    )
    assert user_is_listening is True


def test_unmute_requests_microphone_permission_once(loaded_page):
    page = loaded_page
    page.evaluate("window.__testState.getUserMediaCalls = 0")
    page.dispatch_event("body", "click")
    page.wait_for_function("() => window.__testState.getUserMediaCalls === 1")


def test_voice_prompts_announce_theme_changes(loaded_page):
    page = loaded_page
    page.evaluate("window.__testState.speakCalls = []")

    page.evaluate("applyTheme('light', {announce: true, force: true})")
    page.wait_for_function("() => window.__testState.speakCalls.length > 0")
    speak_calls = page.evaluate("() => window.__testState.speakCalls")
    assert any("Light theme" in call for call in speak_calls)

    page.evaluate("window.__testState.speakCalls = []")
    page.evaluate("applyTheme('dark', {announce: true, force: true})")
    page.wait_for_function("() => window.__testState.speakCalls.length > 0")
    speak_calls = page.evaluate("() => window.__testState.speakCalls")
    assert any("Dark theme" in call for call in speak_calls)


def test_muting_announces_status_over_tts(loaded_page):
    page = loaded_page
    page.evaluate("window.__testState.speakCalls = []")
    page.evaluate(
        "(async () => { await setMutedState(false); await setMutedState(true, {announce: true}); })()"
    )
    page.wait_for_function("() => window.__testState.speakCalls.length > 0")
    speak_calls = page.evaluate("() => window.__testState.speakCalls")
    assert any("Microphone muted" in call for call in speak_calls)
