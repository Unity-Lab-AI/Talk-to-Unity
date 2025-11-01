"""Build the Talk to Unity static site bundle.

This script prepares the distributable assets by copying the landing
experience, the AI application, and supporting files into a target
output directory. The workflow jobs call this script to ensure both
pages are included before running tests or publishing the bundle.
"""

from __future__ import annotations

import argparse
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent

FILES_TO_COPY = [
    "index.html",
    "landing.js",
    "style.css",
    "ai-instruct.txt",
]

DIRECTORIES_TO_COPY = [
    "AI",
    "tests",
]


def build(output_dir: str | Path = "dist") -> Path:
    """Build the static site bundle into ``output_dir``.

    Args:
        output_dir: Destination directory for the build. Relative paths
            are resolved from the repository root.

    Returns:
        The absolute :class:`Path` to the created output directory.
    """

    destination = Path(output_dir)
    if not destination.is_absolute():
        destination = ROOT / destination

    if destination.exists():
        shutil.rmtree(destination)
    destination.mkdir(parents=True)

    for file_name in FILES_TO_COPY:
        source = ROOT / file_name
        if not source.exists():
            raise FileNotFoundError(f"Missing required file: {source}")
        shutil.copy2(source, destination / source.name)

    for directory in DIRECTORIES_TO_COPY:
        source_dir = ROOT / directory
        if not source_dir.exists():
            raise FileNotFoundError(f"Missing required directory: {source_dir}")
        shutil.copytree(source_dir, destination / directory)

    return destination


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build the Talk to Unity static site bundle.")
    parser.add_argument(
        "--output",
        default="dist",
        help="Destination directory for build artifacts (default: dist)",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    output_path = build(args.output)
    print(f"Built Talk to Unity site in {output_path}")


if __name__ == "__main__":
    main()
