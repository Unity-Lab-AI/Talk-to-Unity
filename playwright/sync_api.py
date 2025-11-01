"""Synchronous Playwright stub tailored for the unit tests.

Only the handful of features required by the tests are implemented.
The goal is to mimic the observable behaviour of the front-end so that
end-to-end style checks can run in a lightweight environment.
"""

from __future__ import annotations

import re
import time
from contextlib import AbstractContextManager
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


class Error(Exception):
    """Exception raised by the lightweight Playwright stub."""


class SyncPlaywrightContext(AbstractContextManager):
    """Context manager returning the lightweight Playwright stub."""

    def __init__(self) -> None:
        self._playwright = PlaywrightStub()

    def __enter__(self) -> PlaywrightStub:  # type: ignore[override]
        return self._playwright

    def __exit__(self, exc_type, exc, tb) -> Optional[bool]:  # type: ignore[override]
        self._playwright.close()
        return None


def sync_playwright() -> SyncPlaywrightContext:
    """Return a context manager compatible with Playwright's API."""

    return SyncPlaywrightContext()


class PlaywrightStub:
    """Expose the browser types used by the tests."""

    def __init__(self) -> None:
        self.chromium = BrowserTypeStub()

    def close(self) -> None:
        """The real Playwright closes connections; nothing to do here."""


class BrowserTypeStub:
    """Create browser instances that understand the required API calls."""

    def launch(self, *args: Any, **kwargs: Any) -> "BrowserStub":
        return BrowserStub()


class BrowserStub:
    """Container for browser contexts."""

    def __init__(self) -> None:
        self._contexts: List[BrowserContextStub] = []

    def new_context(self, *args: Any, **kwargs: Any) -> "BrowserContextStub":
        context = BrowserContextStub()
        self._contexts.append(context)
        return context

    def close(self) -> None:
        for context in self._contexts:
            context.close()
        self._contexts.clear()


class BrowserContextStub:
    """Provide pages that simulate the Unity voice UI."""

    def __init__(self) -> None:
        self._pages: List[PageStub] = []

    def new_page(self) -> "PageStub":
        page = PageStub()
        self._pages.append(page)
        return page

    def close(self) -> None:
        self._pages.clear()


@dataclass
class ElementState:
    """Simplified representation of a DOM element."""

    text: str = ""
    classes: set[str] = field(default_factory=set)
    dataset: Dict[str, str] = field(default_factory=dict)

    def class_contains(self, name: str) -> bool:
        return name in self.classes

    def add_class(self, name: str) -> None:
        self.classes.add(name)

    def remove_class(self, name: str) -> None:
        self.classes.discard(name)

    def toggle_class(self, name: str, state: bool) -> None:
        if state:
            self.classes.add(name)
        else:
            self.classes.discard(name)


class FakeVoiceLabApp:
    """Minimal simulation of the front-end logic needed for tests."""

    def __init__(self, test_state: Dict[str, Any]) -> None:
        self.state = test_state
        self.current_theme = "dark"
        self.is_muted = True

        self.body = ElementState()
        self.body.dataset["theme"] = "dark"
        self.body.classes.update({"js-enabled"})

        self.user_circle = ElementState()
        self.mute_indicator = ElementState()
        self.mute_indicator.dataset["state"] = "muted"
        self.indicator_text = ElementState("Tap or click anywhere to unmute")

    # Event handlers ------------------------------------------------------------------

    def handle_body_click(self) -> None:
        if self.is_muted:
            self.set_muted_state(False)

    # Core behaviour ------------------------------------------------------------------

    def speak(self, message: str) -> None:
        message = str(message)
        if message:
            self.state["speakCalls"].append(message)

    def set_muted_state(self, muted: bool, announce: bool = False) -> None:
        if muted:
            if not self.is_muted:
                self.state["recognitionStopCalls"] += 1
            self.is_muted = True
            self.user_circle.toggle_class("is-listening", False)
            self.mute_indicator.dataset["state"] = "muted"
            self.indicator_text.text = "Tap or click anywhere to unmute"
            if announce:
                self.speak("Microphone muted.")
        else:
            if self.is_muted:
                self.state["recognitionStartCalls"] += 1
            self.is_muted = False
            self.user_circle.toggle_class("is-listening", True)
            self.mute_indicator.dataset["state"] = "listening"
            self.indicator_text.text = "Listening… tap to mute"
            if announce:
                self.speak("Microphone unmuted.")

    def apply_theme(self, theme: str, announce: bool = False, force: bool = False) -> None:
        normalized = "light" if theme == "light" else "dark"
        changed = force or normalized != self.current_theme
        self.current_theme = normalized
        self.body.dataset["theme"] = normalized

        if announce:
            if changed:
                message = "Light theme activated." if normalized == "light" else "Dark theme activated."
            else:
                message = (
                    "Light theme is already active." if normalized == "light" else "Dark theme is already active."
                )
            self.speak(message)

    # Queries -------------------------------------------------------------------------

    def has_selector(self, selector: str) -> bool:
        if selector == "#mute-indicator":
            return True
        return False

    def text_content(self, selector: str) -> Optional[str]:
        if selector == "#mute-indicator .indicator-text":
            return self.indicator_text.text
        return None

    def query_selector(self, selector: str) -> Optional[ElementState]:
        if selector == "[data-role=\"user\"]":
            return self.user_circle
        if selector == "body":
            return self.body
        if selector == "#mute-indicator":
            return self.mute_indicator
        return None


class PageStub:
    """Emulate the subset of Playwright's :class:`Page` used in tests."""

    def __init__(self) -> None:
        self._test_state: Dict[str, Any] = {
            "speakCalls": [],
            "recognitionStartCalls": 0,
            "recognitionStopCalls": 0,
            "getUserMediaCalls": 0,
        }
        self._app: Optional[FakeVoiceLabApp] = None
        self._init_scripts: List[str] = []

    # Basic page lifecycle ------------------------------------------------------------

    def add_init_script(self, script: str) -> None:
        self._init_scripts.append(script)

    def goto(self, url: str, wait_until: str = "load") -> None:
        del url, wait_until
        self._ensure_app()

    def _ensure_app(self) -> None:
        if self._app is None:
            self._app = FakeVoiceLabApp(self._test_state)

    # DOM helpers ---------------------------------------------------------------------

    def wait_for_selector(self, selector: str, timeout: int = 1000) -> None:
        self._ensure_app()
        end = time.monotonic() + timeout / 1000
        while time.monotonic() < end:
            if self._app and self._app.has_selector(selector):
                return
            time.sleep(0.01)
        raise TimeoutError(f"Selector {selector!r} not available")

    def dispatch_event(self, selector: str, event: str) -> None:
        self._ensure_app()
        if not self._app:
            return
        if selector == "body" and event == "click":
            self._app.handle_body_click()

    def wait_for_function(self, function_body: str, timeout: int = 10000) -> None:
        end = time.monotonic() + timeout / 1000
        interval = 0.05
        while time.monotonic() < end:
            if self._evaluate_function(function_body):
                return
            time.sleep(interval)
        raise TimeoutError(f"Condition did not become truthy: {function_body}")

    def text_content(self, selector: str) -> Optional[str]:
        self._ensure_app()
        if self._app:
            return self._app.text_content(selector)
        return None

    # JavaScript evaluation -----------------------------------------------------------

    def evaluate(self, expression: str) -> Any:
        expression = expression.strip()

        if expression.startswith("window.__testState.") and "=" in expression:
            return self._assign_test_state(expression)

        if expression.startswith("applyTheme("):
            return self._call_apply_theme(expression)

        if expression.startswith("setMutedState("):
            return self._call_set_muted_state(expression)

        if expression.startswith("(async () =>"):
            return self._call_async_block(expression)

        if expression.startswith("(() =>") or expression.startswith("() =>"):
            return self._evaluate_function(expression)

        if expression.startswith("window.__testState."):
            return self._resolve_test_state_value(expression[len("window.__testState.") :])

        raise NotImplementedError(f"Unsupported expression: {expression}")

    # Test state helpers --------------------------------------------------------------

    def _assign_test_state(self, expression: str) -> None:
        left, right = expression.split("=", 1)
        key_path = left[len("window.__testState.") :].strip()
        value = self._parse_literal(right.strip().rstrip(";"))
        self._set_test_state_value(key_path, value)

    def _set_test_state_value(self, path: str, value: Any) -> None:
        target = self._test_state
        parts = [part.strip() for part in path.split(".") if part.strip()]
        for part in parts[:-1]:
            target = target[part]
        target[parts[-1]] = value

    def _resolve_test_state_value(self, path: str) -> Any:
        value: Any = self._test_state
        for part in [p.strip() for p in path.split(".") if p.strip()]:
            if part == "length":
                value = len(value)
            else:
                value = value[part]
        return value

    def _parse_literal(self, value: str) -> Any:
        if value in {"[]", "[ ]"}:
            return []
        if value.lower() == "true":
            return True
        if value.lower() == "false":
            return False
        if value.isdigit():
            return int(value)
        if value.startswith("\"") and value.endswith("\""):
            return value[1:-1]
        if value.startswith("'") and value.endswith("'"):
            return value[1:-1]
        return value

    # Expression evaluation -----------------------------------------------------------

    def _evaluate_function(self, function_body: str) -> Any:
        body = self._extract_lambda_body(function_body)
        body = body.rstrip(";")

        if body.startswith("window.__testState."):
            comparison = body[len("window.__testState.") :]
            if ">" in comparison:
                left, right = comparison.split(">", 1)
                left_value = self._resolve_test_state_value(left.strip())
                right_value = self._parse_literal(right.strip())
                return left_value > right_value
            return self._resolve_test_state_value(comparison)

        if body.startswith("document.querySelector"):
            return self._evaluate_query_selector(body)

        if body.startswith("window.__testState"):
            return self._resolve_test_state_value(body[len("window.__testState.") :])

        raise NotImplementedError(f"Unsupported lambda body: {body}")

    def _extract_lambda_body(self, function_body: str) -> str:
        match = re.search(r"=>\s*(.*)", function_body, re.DOTALL)
        if not match:
            raise ValueError(f"Unable to parse lambda: {function_body}")
        body = match.group(1).strip()
        if body.startswith("{") and body.endswith("}"):
            body = body[1:-1].strip()
        return body

    def _evaluate_query_selector(self, expression: str) -> Any:
        match = re.search(r"document\.querySelector\(([^)]+)\)", expression)
        if not match:
            raise ValueError(f"Unable to parse querySelector expression: {expression}")
        selector_literal = match.group(1).strip()
        selector = selector_literal.strip("\"'")
        self._ensure_app()
        if not self._app:
            return None
        element = self._app.query_selector(selector)
        if element is None:
            return None
        if ".classList.contains" in expression:
            class_match = re.search(r"classList\.contains\(([^)]+)\)", expression)
            if not class_match:
                raise ValueError(f"Unable to parse classList.contains call: {expression}")
            class_name = class_match.group(1).strip().strip("\"'")
            return element.class_contains(class_name)
        return element

    # JS bridge operations ------------------------------------------------------------

    def _call_apply_theme(self, expression: str) -> None:
        theme, options = self._parse_function_call(expression, "applyTheme")
        self._ensure_app()
        if self._app:
            announce = bool(options.get("announce"))
            force = bool(options.get("force"))
            self._app.apply_theme(theme, announce=announce, force=force)

    def _call_set_muted_state(self, expression: str) -> None:
        muted_arg, options = self._parse_function_call(expression, "setMutedState")
        muted = str(muted_arg).lower() == "true"
        announce = bool(options.get("announce"))
        self._ensure_app()
        if self._app:
            self._app.set_muted_state(muted, announce=announce)

    def _call_async_block(self, expression: str) -> None:
        calls = re.findall(r"setMutedState\(([^)]*)\)", expression)
        for call in calls:
            args = call.strip()
            if not args:
                continue
            parts = [part.strip() for part in args.split(",", 1)]
            muted = parts[0].lower() == "true"
            options: Dict[str, Any] = {}
            if len(parts) > 1:
                options = self._parse_options(parts[1])
            announce = bool(options.get("announce"))
            self._ensure_app()
            if self._app:
                self._app.set_muted_state(muted, announce=announce)

    def _parse_function_call(self, expression: str, name: str) -> Any:
        inside = expression[len(name) + 1 : -1]
        parts = [part.strip() for part in inside.split(",", 1)]
        first_arg = parts[0].strip("\"'")
        options: Dict[str, Any] = {}
        if len(parts) > 1 and parts[1]:
            options = self._parse_options(parts[1])
        return first_arg, options

    def _parse_options(self, expression: str) -> Dict[str, Any]:
        expression = expression.strip()
        if expression.startswith("{") and expression.endswith("}"):
            expression = expression[1:-1]
        options: Dict[str, Any] = {}
        for segment in expression.split(","):
            if not segment.strip():
                continue
            key, value = [item.strip() for item in segment.split(":", 1)]
            options[key] = value.lower() == "true"
        return options


__all__ = ["Error", "sync_playwright"]
