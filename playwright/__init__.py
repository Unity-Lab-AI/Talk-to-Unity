"""Compatibility wrapper around the real Playwright package.

The repository ships a lightweight stub so local contributors can run the
tests without downloading the official Playwright browsers.  When the
actual Playwright package is installed we prefer that implementation so
the end-to-end checks exercise the real browser APIs.  If the import
fails we fall back to the stub contained in the repository.
"""

from __future__ import annotations

import importlib
import sys
from pathlib import Path
from types import ModuleType


def _import_real_playwright() -> ModuleType | None:
    """Attempt to import the genuine Playwright package.

    The stub lives inside the repository, so importing ``playwright``
    would normally resolve to this module.  To probe for the real package
    we temporarily remove the repository path from ``sys.path``.
    """

    repo_root = Path(__file__).resolve().parent.parent
    original_path: list[str] = list(sys.path)
    sanitized: list[str] = []
    for entry in original_path:
        resolved = Path(entry or ".").resolve()
        if resolved == repo_root:
            continue
        sanitized.append(entry)

    existing = sys.modules.pop("playwright", None)
    try:
        sys.path = sanitized
        return importlib.import_module("playwright")
    except ImportError:
        return None
    finally:
        sys.path = original_path
        if existing is not None:
            sys.modules["playwright"] = existing


_REAL_PLAYWRIGHT = _import_real_playwright()

if isinstance(_REAL_PLAYWRIGHT, ModuleType):
    # Re-export everything from the genuine package so downstream
    # imports see the official behaviour.
    sys.modules[__name__] = _REAL_PLAYWRIGHT
    globals().update(_REAL_PLAYWRIGHT.__dict__)
else:
    from .sync_api import Error, sync_playwright  # noqa: F401

    __all__ = ["Error", "sync_playwright"]

