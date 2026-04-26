import os
import sys
from pathlib import Path

from dotenv import load_dotenv

from main import main


def _inject_bundled_config() -> None:
    if not getattr(sys, "frozen", False):
        return
    config_path = Path(sys._MEIPASS) / "config.env"
    if not config_path.exists():
        return
    with open(config_path, encoding="utf-8") as f:
        for raw in f:
            line = raw.strip()
            if not line or line.startswith("#"):
                continue
            if "=" not in line:
                continue
            key, _, value = line.partition("=")
            key = key.strip()
            value = value.strip()
            if key and key not in os.environ:
                os.environ[key] = value


def resolve_base_dir() -> Path:
    candidates = []

    if getattr(sys, "frozen", False):
        exe_dir = Path(sys.executable).resolve().parent
        candidates.extend([
            exe_dir,
            exe_dir.parent,
        ])

    file_dir = Path(__file__).resolve().parent
    candidates.extend([
        file_dir,
        file_dir.parent,
        Path.cwd(),
        Path.home() / "Library" / "Application Support" / "TradeOps",
        Path.home() / ".tradeops",
        Path.home(),
    ])

    for candidate in candidates:
        if (candidate / ".env_local").exists() or (candidate / "config.env").exists():
            return candidate

    app_support = Path.home() / "Library" / "Application Support" / "TradeOps"
    app_support.mkdir(parents=True, exist_ok=True)
    return app_support


_inject_bundled_config()

BASE_DIR = resolve_base_dir()
load_dotenv(BASE_DIR / "config.env", override=True)
load_dotenv(BASE_DIR / ".env_local", override=True)

os.chdir(BASE_DIR)

if __name__ == "__main__":
    main()
