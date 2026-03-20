"""
Jobcook agent — connects to the backend via WebSocket, receives commands,
runs the bot locally, and streams logs back.
"""
from __future__ import annotations

import asyncio
import json
import platform

import websockets
import websockets.exceptions

from . import __version__
from .runner import RunnerManager

RECONNECT_DELAY = 5  # seconds between reconnect attempts


async def run(api_url: str, token: str, on_status: callable | None = None) -> None:
    """
    Main agent loop. Connects to backend, handles commands, auto-reconnects.
    on_status(msg: str) is called with human-readable status updates.
    """
    ws_url = api_url.replace("https://", "wss://").replace("http://", "ws://")
    ws_url = f"{ws_url}/agent/ws?token={token}"
    runner = RunnerManager()

    def status(msg: str) -> None:
        if on_status:
            on_status(msg)

    while True:
        try:
            status(f"Connecting to {api_url} ...")
            async with websockets.connect(ws_url, ping_interval=30, ping_timeout=10) as ws:
                status("Connected. Jobcook agent is running.")

                await ws.send(json.dumps({
                    "type": "agent_ready",
                    "version": __version__,
                    "platform": platform.system(),
                }))

                loop = asyncio.get_running_loop()

                async for raw in ws:
                    try:
                        msg = json.loads(raw)
                    except Exception:
                        continue

                    msg_type = msg.get("type")

                    if msg_type == "start_run":
                        run_id = msg["run_id"]
                        config = msg["config"]
                        status(f"Starting run #{run_id} ...")

                        async def send_log(line: str, _rid=run_id) -> None:
                            try:
                                await ws.send(json.dumps({
                                    "type": "log",
                                    "run_id": _rid,
                                    "line": line,
                                }))
                            except Exception:
                                pass

                        async def send_done(exit_code: int, _rid=run_id) -> None:
                            try:
                                await ws.send(json.dumps({
                                    "type": "run_finished",
                                    "run_id": _rid,
                                    "exit_code": exit_code,
                                }))
                            except Exception:
                                pass
                            runner.remove(_rid)
                            status(f"Run #{_rid} finished (exit {exit_code})")

                        runner.start(run_id, config, send_log, send_done, loop)

                    elif msg_type == "stop_run":
                        run_id = msg["run_id"]
                        status(f"Stopping run #{run_id} ...")
                        runner.stop(run_id)

                    elif msg_type == "kill_run":
                        run_id = msg["run_id"]
                        status(f"Force-killing run #{run_id} ...")
                        runner.kill(run_id)

                    elif msg_type == "ping":
                        await ws.send(json.dumps({"type": "pong"}))

        except websockets.exceptions.InvalidStatus as exc:
            code = exc.response.status_code if exc.response else "?"
            if code == 401:
                status("Authentication failed — check your token. Retrying in 30s...")
                await asyncio.sleep(30)
            else:
                status(f"Connection rejected (HTTP {code}). Retrying in {RECONNECT_DELAY}s...")
                await asyncio.sleep(RECONNECT_DELAY)

        except (websockets.exceptions.ConnectionClosed, OSError) as exc:
            status(f"Disconnected: {exc}. Reconnecting in {RECONNECT_DELAY}s...")
            await asyncio.sleep(RECONNECT_DELAY)

        except Exception as exc:
            status(f"Unexpected error: {exc}. Reconnecting in {RECONNECT_DELAY}s...")
            await asyncio.sleep(RECONNECT_DELAY)
