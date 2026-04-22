import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from uvicorn import run


def resolve_base_dir() -> Path:
    candidates = []

    if getattr(sys, "frozen", False):
        exe_dir = Path(sys.executable).resolve().parent
        candidates.extend([
            exe_dir,          # bundled binary yanına koyulursa
            exe_dir.parent,   # app/dist -> app
        ])

    file_dir = Path(__file__).resolve().parent
    candidates.extend([
        file_dir,
        file_dir.parent,
        Path.cwd(),
    ])

    for candidate in candidates:
        if (candidate / ".env_local").exists() or (candidate / "config.env").exists():
            return candidate

    return file_dir


BASE_DIR = resolve_base_dir()

load_dotenv(BASE_DIR / ".env_local", override=False)
load_dotenv(BASE_DIR / "config.env", override=False)

os.chdir(BASE_DIR)

if __name__ == "__main__":
    run(
        "ui_connection.ui_api.main_api:app",
        host="127.0.0.1",
        port=8000,
        reload=False,
    )