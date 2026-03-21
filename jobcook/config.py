"""
Stores Jobcook agent config (API URL + token) in ~/.jobcook/config.json
"""
from __future__ import annotations

import json
from pathlib import Path

CONFIG_DIR = Path.home() / ".jobcook"
CONFIG_FILE = CONFIG_DIR / "config.json"


def load() -> dict:
    if not CONFIG_FILE.exists():
        return {}
    try:
        return json.loads(CONFIG_FILE.read_text())
    except Exception:
        return {}


def save(data: dict) -> None:
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    CONFIG_FILE.write_text(json.dumps(data, indent=2))
    CONFIG_FILE.chmod(0o600)


def get_api_url() -> str | None:
    return load().get("api_url")


def get_token() -> str | None:
    return load().get("token")


def set_credentials(api_url: str, token: str) -> None:
    data = load()
    data["api_url"] = api_url.rstrip("/")
    data["token"] = token
    save(data)


def clear() -> None:
    if CONFIG_FILE.exists():
        CONFIG_FILE.unlink()
