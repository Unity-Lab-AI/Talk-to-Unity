#!/usr/bin/env python3
import json
import subprocess
import sys
from pathlib import Path

def main() -> int:
    tests_dir = Path("tests")
    results = []
    exit_code = 0

    if not tests_dir.exists():
        print("::warning::No tests directory found at ./tests")
    else:
        test_files = sorted(tests_dir.glob("test_*.py"))
        if not test_files:
            print("::warning::No tests matching pattern 'test_*.py' found in ./tests")
        for test_file in test_files:
            print(f"Running pytest on {test_file}")
            completed = subprocess.run([
                sys.executable,
                "-m",
                "pytest",
                str(test_file),
            ])
            status = "passed" if completed.returncode == 0 else "failed"
            results.append({
                "name": test_file.name,
                "path": str(test_file),
                "status": status,
            })
            if completed.returncode != 0:
                exit_code = completed.returncode
                print(f"::warning::Test {test_file.name} failed with exit code {completed.returncode}")

    payload = {
        "tests": results,
        "overall_status": "passed" if exit_code == 0 else "failed",
    }
    Path("test-results.json").write_text(json.dumps(payload))

    if exit_code != 0:
        print("::warning::One or more tests failed. See pytest output above for details.")
    else:
        print("All tests passed.")

    return 0


if __name__ == "__main__":
    sys.exit(main())
