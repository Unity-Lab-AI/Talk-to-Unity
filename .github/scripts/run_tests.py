#!/usr/bin/env python3
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path


def truncate(text: str, limit: int = 4000) -> str:
    if len(text) <= limit:
        return text
    return text[: limit - 3] + "..."


def run_pytest() -> dict[str, object]:
    cmd = [sys.executable, "-m", "pytest", "tests"]
    process = subprocess.run(cmd, capture_output=True, text=True)

    stdout = process.stdout.strip()
    stderr = process.stderr.strip()

    result: dict[str, object] = {
        "status": "success" if process.returncode == 0 else "failure",
        "exit_code": process.returncode,
        "command": " ".join(cmd),
        "stdout": truncate(stdout),
        "stderr": truncate(stderr),
    }

    summary_line = ""
    for line in reversed(stdout.splitlines()):
        if line.startswith("=") and line.endswith("="):
            summary_line = line.strip("=").strip()
            break
        if any(token in line for token in ("passed", "failed", "error", "skipped")):
            summary_line = line.strip()
            break
    if summary_line:
        result["summary"] = summary_line

    if result["status"] == "failure":
        result.setdefault("message", "Pytest exited with a non-zero status code.")
        print("::error::Pytest failed")

    if stdout:
        print(stdout)
    if stderr:
        print(stderr, file=sys.stderr)

    return result


def main() -> int:
    result = run_pytest()
    Path("test-results.json").write_text(json.dumps(result))
    return int(result.get("exit_code", 0))


if __name__ == "__main__":
    raise SystemExit(main())
