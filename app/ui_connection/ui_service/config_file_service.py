from __future__ import annotations

import sys
from pathlib import Path
import yaml


BASE_DIR = Path(__file__).resolve().parents[2]


def _persistent_dir() -> Path:
    """User-writable location for env files when running as a packaged app."""
    target = Path.home() / "Library" / "Application Support" / "TradeOps"
    target.mkdir(parents=True, exist_ok=True)
    return target


def _resolve_env_local_path() -> Path:
    if getattr(sys, "frozen", False):
        return _persistent_dir() / ".env_local"
    return BASE_DIR / ".env_local"


def _resolve_config_env_path() -> Path:
    if getattr(sys, "frozen", False):
        return _persistent_dir() / "config.env"
    return BASE_DIR / "config.env"


def _resolve_exchange_yaml_path() -> Path:
    if getattr(sys, "frozen", False):
        target = _persistent_dir() / "exchanges.yaml"
        if not target.exists():
            # Seed from bundled copy on first read
            bundled = Path(sys._MEIPASS) / "config" / "exchanges.yaml"
            if bundled.exists():
                target.write_text(bundled.read_text(encoding="utf-8"), encoding="utf-8")
        return target
    return BASE_DIR / "config" / "exchanges.yaml"


ENV_LOCAL_PATH = _resolve_env_local_path()
CONFIG_ENV_PATH = _resolve_config_env_path()
EXCHANGE_YAML_PATH = _resolve_exchange_yaml_path()


def _detect_tws_path() -> str:
    if sys.platform != "darwin":
        return ""
    for root in [Path.home() / "Applications", Path("/Applications")]:
        if not root.exists():
            continue
        for tws_dir in sorted(root.glob("Trader Workstation*"), reverse=True):
            if tws_dir.is_dir():
                inner = tws_dir / "Trader Workstation.app"
                if inner.exists():
                    return str(inner)
                if tws_dir.suffix == ".app":
                    return str(tws_dir)
    return ""


def _read_env_file(path: Path) -> dict[str, str]:
    result: dict[str, str] = {}
    if not path.exists():
        return result

    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        result[key.strip()] = value.strip()
    return result


def _write_env_file(path: Path, updates: dict[str, str]) -> None:
    lines = path.read_text(encoding="utf-8").splitlines() if path.exists() else []
    updated_keys = set()
    new_lines: list[str] = []

    for raw_line in lines:
        stripped = raw_line.strip()
        if not stripped or stripped.startswith("#") or "=" not in raw_line:
            new_lines.append(raw_line)
            continue

        key, _ = raw_line.split("=", 1)
        key = key.strip()

        if key in updates:
            new_lines.append(f"{key}={updates[key]}")
            updated_keys.add(key)
        else:
            new_lines.append(raw_line)

    for key, value in updates.items():
        if key not in updated_keys:
            new_lines.append(f"{key}={value}")

    path.write_text("\n".join(new_lines) + "\n", encoding="utf-8")


def read_env_local() -> dict[str, str]:
    data = _read_env_file(ENV_LOCAL_PATH)

    ibkr_mode = data.get("IBKR_MODE", "PAPER").strip().upper()
    data["IBKR_MODE"] = ibkr_mode
    data["IBKR_PORT"] = "7496" if ibkr_mode == "LIVE" else "7497"

    # Auto-fill TWS_APP_PATH if user hasn't configured it yet
    if not data.get("TWS_APP_PATH"):
        detected = _detect_tws_path()
        if detected:
            data["TWS_APP_PATH"] = detected

    return data


def write_env_local(updates: dict[str, str]) -> dict[str, str]:
    current = _read_env_file(ENV_LOCAL_PATH)
    merged = {**current, **updates}

    ibkr_mode = merged.get("IBKR_MODE", "PAPER").strip().upper()
    merged["IBKR_MODE"] = ibkr_mode
    merged["IBKR_PORT"] = "7496" if ibkr_mode == "LIVE" else "7497"

    writable = {
        "APP_TIMEZONE": merged.get("APP_TIMEZONE", ""),
        "IBKR_MODE": merged.get("IBKR_MODE", "PAPER"),
        "IBKR_PORT": merged.get("IBKR_PORT", "7497"),
        "APP_LOCK_PASSWORD": merged.get("APP_LOCK_PASSWORD", ""),
        "TWS_APP_PATH": merged.get("TWS_APP_PATH", ""),
    }

    _write_env_file(ENV_LOCAL_PATH, writable)
    return read_env_local()


def read_config_env() -> dict[str, str]:
    return _read_env_file(CONFIG_ENV_PATH)


def write_config_env(updates: dict[str, str]) -> dict[str, str]:
    current = _read_env_file(CONFIG_ENV_PATH)
    merged = {**current, **updates}
    _write_env_file(CONFIG_ENV_PATH, merged)
    return read_config_env()


def read_exchange_yaml() -> list[dict]:
    if not EXCHANGE_YAML_PATH.exists():
        return []
    raw = EXCHANGE_YAML_PATH.read_text(encoding="utf-8")
    parsed = yaml.safe_load(raw) or []
    return parsed


def write_exchange_yaml(rows: list[dict]) -> list[dict]:
    EXCHANGE_YAML_PATH.write_text(
        yaml.safe_dump(rows, sort_keys=False, allow_unicode=True),
        encoding="utf-8",
    )
    return read_exchange_yaml()
