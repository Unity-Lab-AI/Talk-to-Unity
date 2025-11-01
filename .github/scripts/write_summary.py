#!/usr/bin/env python3
"""Aggregate CI results into a GitHub Actions step summary."""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
from typing import Any


def load_json(path: Path) -> dict[str, Any] | None:
    if not path.exists() or not path.is_file():
        return None
    try:
        return json.loads(path.read_text())
    except json.JSONDecodeError as exc:  # noqa: TRY003
        print(f"::warning::Unable to parse JSON from {path}: {exc}")
        return None


def render_tests_section(data: dict[str, Any] | None) -> list[str]:
    lines = ["## Test Results", ""]
    if not data:
        lines.append("No test results were produced.")
        return lines

    tests = data.get("tests") or []
    if not tests:
        lines.append("No tests were discovered under /tests.")
        return lines

    lines.append(f"Processed {len(tests)} test file(s).")
    lines.append("")
    lines.append("| Test file | Status |")
    lines.append("| --- | --- |")
    for entry in tests:
        name = entry.get("name", "unknown")
        status = (entry.get("status") or "unknown").lower()
        if status == "passed":
            emoji = "✅"
        elif status == "failed":
            emoji = "❌"
        else:
            emoji = "⚠️"
        lines.append(f"| {name} | {emoji} {status.title()} |")
    return lines


def render_build_section(data: dict[str, Any] | None) -> list[str]:
    lines = ["## Build Status", ""]
    if not data:
        lines.append("No build output was produced.")
        return lines

    status = (data.get("status") or "unknown").lower()
    message = data.get("message")
    copied = data.get("copied") or []

    if status == "success":
        emoji = "✅"
    elif status == "warning":
        emoji = "⚠️"
    else:
        emoji = "❌"
    lines.append(f"Overall build result: {emoji} {status.title()}")

    if copied:
        lines.append("")
        lines.append("### Copied static files")
        for item in copied:
            lines.append(f"- {item}")

    if message:
        lines.append("")
        lines.append(f"Details: {message}")

    return lines


def append_summary(sections: list[list[str]]) -> None:
    summary_path = os.environ.get("GITHUB_STEP_SUMMARY")
    text = "\n".join(line for section in sections for line in (*section, ""))
    print(text)
    if summary_path:
        with open(summary_path, "a", encoding="utf-8") as handle:
            handle.write(text + "\n")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Aggregate CI results into a GitHub Actions step summary.",
    )
    parser.add_argument(
        "--include-tests",
        action="store_true",
        help="Include the tests section in the summary.",
    )
    parser.add_argument(
        "--include-build",
        action="store_true",
        help="Include the build section in the summary.",
    )
    args = parser.parse_args()
    if not args.include_tests and not args.include_build:
        args.include_tests = True
        args.include_build = True
    return args


def main() -> None:
    args = parse_args()
    repo_root = Path(".")
    tests_data = load_json(repo_root / "test-results.json")
    build_data = load_json(repo_root / "build-results.json")

    sections: list[list[str]] = []
    if args.include_tests:
        sections.append(render_tests_section(tests_data))
    if args.include_build and (build_data or (repo_root / "build-results.json").exists()):
        sections.append(render_build_section(build_data))

    append_summary(sections)


if __name__ == "__main__":
    main()
