"""Entry point for the stub Playwright CLI used by the test suite.

The real Playwright package exposes a command line interface that is
invoked via ``python -m playwright``.  The GitHub workflow exercises the
``install`` command to ensure the necessary browser binaries are
present.  In this project we ship a very small stub of the library, so
we emulate the CLI enough for the workflow to succeed.
"""

from __future__ import annotations

import sys
from typing import Iterable


def _format_args(args: Iterable[str]) -> str:
    return " ".join(args) if args else "<no arguments>"


def main() -> int:
    """Handle invocations from ``python -m playwright``.

    The workflow only calls ``install`` with optional arguments.  To keep
    behaviour predictable we simply acknowledge the request and exit with
    a success status code.  Other commands are treated as no-ops so that
    developers running the stub do not encounter unexpected failures.
    """

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
