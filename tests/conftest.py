from __future__ import annotations

import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import build


@pytest.fixture(scope="session")
def built_site(tmp_path_factory: pytest.TempPathFactory) -> Path:
    output_dir = tmp_path_factory.mktemp("site")
    build.build(output_dir)
    return output_dir


@pytest.fixture(scope="session")
def app_js(built_site: Path) -> str:
    return (built_site / "AI" / "app.js").read_text(encoding="utf-8")
