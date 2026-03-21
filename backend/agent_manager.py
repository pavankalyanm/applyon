"""
Tracks connected Jobcook agents (one WebSocket per user).
Used by routes_runs to dispatch run commands to the agent instead of spawning
a local subprocess.
"""
from __future__ import annotations

import asyncio
import json
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from fastapi import WebSocket

# user_id → WebSocket
_agents: dict[int, "WebSocket"] = {}


def register(user_id: int, ws: "WebSocket") -> None:
    _agents[user_id] = ws


def unregister(user_id: int) -> None:
    _agents.pop(user_id, None)


def is_connected(user_id: int) -> bool:
    return user_id in _agents


async def send(user_id: int, payload: dict) -> bool:
    """Send a JSON payload to the agent. Returns False if not connected."""
    ws = _agents.get(user_id)
    if ws is None:
        return False
    try:
        await ws.send_text(json.dumps(payload))
        return True
    except Exception:
        unregister(user_id)
        return False
