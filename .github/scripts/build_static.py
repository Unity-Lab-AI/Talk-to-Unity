#!/usr/bin/env python3
import json
import shutil
from pathlib import Path

def copy_static_files(dist: Path) -> list[str]:
    copied: list[str] = []
    patterns = ["*.html", "*.css", "*.js"]
    for pattern in patterns:
        for source in Path(".").glob(pattern):
            if source.is_file():
                destination = dist / source.name
                shutil.copy2(source, destination)
                copied.append(str(source))
    extra_files = [Path("ai-instruct.txt")]
    for file_path in extra_files:
        if file_path.exists() and file_path.is_file():
            destination = dist / file_path.name
            shutil.copy2(file_path, destination)
            copied.append(str(file_path))

    directories = [Path("assets"), Path("AI")]
    for directory in directories:
        if not directory.exists() or not directory.is_dir():
            continue

        target_dir = dist / directory.name
        if target_dir.exists():
            shutil.rmtree(target_dir)
        shutil.copytree(directory, target_dir)
        copied.append(str(directory))
    return copied

def main() -> int:
    dist = Path("dist")
    if dist.exists():
        shutil.rmtree(dist)
    dist.mkdir(parents=True, exist_ok=True)

    result = {"status": "success", "copied": []}
    exit_code = 0
    try:
        result["copied"] = copy_static_files(dist)
        if not result["copied"]:
            result["status"] = "warning"
            result["message"] = "No static files were copied into the dist directory."
            print("::warning::No static files were copied into dist")
        else:
            print(f"Copied {len(result['copied'])} static files into dist")
    except Exception as exc:  # noqa: BLE001
        result["status"] = "failure"
        result["message"] = str(exc)
        print(f"::error::Static site build failed: {exc}")
        exit_code = 1
    Path("build-results.json").write_text(json.dumps(result))
    return exit_code

if __name__ == "__main__":
    raise SystemExit(main())
