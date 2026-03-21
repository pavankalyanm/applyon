from __future__ import annotations

import json
import os
from functools import lru_cache


def _config_path() -> str:
    path = (os.getenv("BOT_CONFIG_PATH") or "").strip()
    if not path:
        raise RuntimeError(
            "BOT_CONFIG_PATH is not set. This bot must be launched by the backend so it can use the latest saved config."
        )
    return path


@lru_cache(maxsize=1)
def load_runtime_config() -> dict:
    path = _config_path()
    try:
        with open(path, "r", encoding="utf-8") as file:
            data = json.load(file)
    except FileNotFoundError as exc:
        raise RuntimeError(
            f"Runtime config file was not found at '{path}'. Start the bot from the backend and retry."
        ) from exc
    except Exception as exc:
        raise RuntimeError(
            f"Runtime config file at '{path}' could not be parsed as JSON: {exc}"
        ) from exc

    if not isinstance(data, dict):
        raise RuntimeError("Runtime config payload must be a JSON object.")
    return data


def get_section(section_name: str) -> dict:
    data = load_runtime_config()
    section = data.get(section_name)
    if not isinstance(section, dict):
        raise RuntimeError(
            f"Runtime config section '{section_name}' is missing or invalid in '{_config_path()}'."
        )
    return section


def export_section(section_name: str, namespace: dict, defaults: dict | None = None) -> None:
    section = get_section(section_name)
    if defaults:
        merged = {**defaults, **section}
    else:
        merged = section
    namespace.update(merged)
    namespace["__all__"] = sorted(merged.keys())
