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
    assets_dir = Path("assets")
    if assets_dir.exists() and assets_dir.is_dir():
        target_dir = dist / assets_dir.name
        if target_dir.exists():
            shutil.rmtree(target_dir)
        shutil.copytree(assets_dir, target_dir)
        copied.append(str(assets_dir))
    return copied

def main() -> int:
    dist = Path("dist")
    if dist.exists():
        shutil.rmtree(dist)
    dist.mkdir(parents=True, exist_ok=True)

    result = {"status": "success", "copied": []}
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
    Path("build-results.json").write_text(json.dumps(result))
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
