from __future__ import annotations

from pathlib import Path
import yaml


BASE_DIR = Path(__file__).resolve().parents[2]
ENV_LOCAL_PATH = BASE_DIR / ".env_local"
CONFIG_ENV_PATH = BASE_DIR / "config.env"
EXCHANGE_YAML_PATH = BASE_DIR / "config" / "exchanges.yaml"


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

    data = yaml.safe_load(EXCHANGE_YAML_PATH.read_text(encoding="utf-8")) or {}
    return data.get("EXCHANGES", [])


def write_exchange_yaml(updated_exchanges: list[dict]) -> list[dict]:
    payload = {"EXCHANGES": updated_exchanges}
    EXCHANGE_YAML_PATH.write_text(
        yaml.safe_dump(payload, sort_keys=False, allow_unicode=True),
        encoding="utf-8",
    )
    return read_exchange_yaml()