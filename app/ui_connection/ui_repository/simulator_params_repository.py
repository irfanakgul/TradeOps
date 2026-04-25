from __future__ import annotations

from pathlib import Path

from config.settings import ENV_LOCAL_PATH


SIM_PARAM_KEYS = [
    "SIM_IBKR_MODE",
    "SIM_IBKR_HOST",
    "SIM_IBKR_PORT",
    "SIM_IBKR_CLIENT_ID",
]


def read_env_local_lines() -> list[str]:
    if not ENV_LOCAL_PATH.exists():
        return []
    return ENV_LOCAL_PATH.read_text(encoding="utf-8").splitlines()


def write_env_local_lines(lines: list[str]) -> None:
    ENV_LOCAL_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")


def read_simulator_params() -> dict:
    lines = read_env_local_lines()
    values = {key: "" for key in SIM_PARAM_KEYS}

    for line in lines:
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue

        key, value = stripped.split("=", 1)
        key = key.strip()
        value = value.strip()

        if key in values:
            values[key] = value

    if not values["SIM_IBKR_MODE"]:
        values["SIM_IBKR_MODE"] = "PAPER"
    if not values["SIM_IBKR_HOST"]:
        values["SIM_IBKR_HOST"] = "127.0.0.1"
    if not values["SIM_IBKR_PORT"]:
        values["SIM_IBKR_PORT"] = "7497"
    if not values["SIM_IBKR_CLIENT_ID"]:
        values["SIM_IBKR_CLIENT_ID"] = "1"

    return values


def update_simulator_params(params: dict) -> None:
    current = read_simulator_params()
    next_values = {
        key: str(params.get(key, current.get(key, ""))).strip()
        for key in SIM_PARAM_KEYS
    }

    lines = read_env_local_lines()
    found = set()
    updated_lines = []

    for line in lines:
        stripped = line.strip()

        if not stripped or stripped.startswith("#") or "=" not in stripped:
            updated_lines.append(line)
            continue

        key, _ = stripped.split("=", 1)
        key = key.strip()

        if key in SIM_PARAM_KEYS:
            updated_lines.append(f"{key}={next_values[key]}")
            found.add(key)
        else:
            updated_lines.append(line)

    missing = [key for key in SIM_PARAM_KEYS if key not in found]

    if missing:
        updated_lines.append("")
        updated_lines.append("# TEST/SIM ibkr connection info")
        for key in missing:
            updated_lines.append(f"{key}={next_values[key]}")

    write_env_local_lines(updated_lines)