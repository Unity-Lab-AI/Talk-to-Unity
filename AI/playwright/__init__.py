"""Lightweight Playwright stub for unit tests.

This project relies on Playwright's high-level API in its tests but the
full browser stack is unavailable in the execution environment.  The
real Playwright package is comparatively heavy and requires a Chromium
binary together with several system dependencies.  To keep the test
suite runnable we provide a focused stub that implements the very small
subset of the Playwright API exercised by the tests.

Only the synchronous API is implemented at the moment; the real project
code does not depend on Playwright at runtime.
"""

from .sync_api import sync_playwright  # noqa: F401
