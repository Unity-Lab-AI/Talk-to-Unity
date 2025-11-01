"""Command line entry point that prefers the real Playwright CLI."""

from __future__ import annotations

import importlib
import sys
from pathlib import Path
from types import ModuleType
from typing import Iterable


def _import_real_cli() -> ModuleType | None:
    """Try to import the genuine ``playwright.__main__`` module."""

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
        return importlib.import_module("playwright.__main__")
    except ImportError:
        return None
    finally:
        sys.path = original_path
        if existing is not None:
            sys.modules["playwright"] = existing


_REAL_CLI = _import_real_cli()

if _REAL_CLI and hasattr(_REAL_CLI, "main"):

    def main() -> int:  # pragma: no cover - exercised via CLI
        return _REAL_CLI.main()

else:

    def _format_args(args: Iterable[str]) -> str:
        return " ".join(args) if args else "<no arguments>"

    def main() -> int:  # pragma: no cover - exercised via CLI
        """Handle invocations from ``python -m playwright``."""

        argv = sys.argv[1:]
        if argv and argv[0] == "install":
            print(
                "Playwright stub: skipping browser installation for arguments:",
                _format_args(argv[1:]),
            )
            return 0

        print(
            "Playwright stub: no CLI actions required for arguments:",
            _format_args(argv),
        )
        return 0


if __name__ == "__main__":  # pragma: no cover - exercised via CLI
    sys.exit(main())
