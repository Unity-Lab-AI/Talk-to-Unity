#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
from typing import Any


def load_result(path: Path) -> dict[str, Any] | None:
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text())
    except json.JSONDecodeError:
        return {"status": "unknown", "message": f"Unable to parse {path.name}."}


def format_section(title: str, data: dict[str, Any]) -> str:
    status = str(data.get("status", "unknown")).title()
    lines = [f"### {title}", "", f"- Status: **{status}**"]

    message = data.get("message") or data.get("summary")
    if message:
        lines.append(f"- Details: {message}")

    exit_code = data.get("exit_code")
    if exit_code is not None:
        lines.append(f"- Exit code: `{exit_code}`")

    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description="Write a workflow summary.")
    parser.add_argument("--include-build", action="store_true", help="Include build results")
    parser.add_argument("--include-tests", action="store_true", help="Include test results")
    args = parser.parse_args()

    summary_sections: list[str] = []
    if args.include_build:
        data = load_result(Path("build-results.json"))
        if data:
            summary_sections.append(format_section("Static site build", data))
    if args.include_tests:
        data = load_result(Path("test-results.json"))
        if data:
            summary_sections.append(format_section("Test suite", data))

    if not summary_sections:
        return 0

    summary_content = "\n\n".join(summary_sections) + "\n"

    summary_file = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary_file:
        Path(summary_file).write_text(summary_content)
    else:
        print(summary_content)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
