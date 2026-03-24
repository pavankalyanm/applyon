"""
Jobcook agent — connects to the backend via WebSocket, receives commands,
runs the bot locally, and streams logs back.
"""
from __future__ import annotations

import asyncio
import json
import platform
import ssl
import tempfile
from pathlib import Path
from urllib.request import Request, urlopen

import certifi
import websockets
import websockets.exceptions

# Use certifi's CA bundle so macOS/Windows Python can verify public certs
_ssl_ctx = ssl.create_default_context(cafile=certifi.where())

from . import __version__
from .runner import RunnerManager

RECONNECT_DELAY = 5  # seconds between reconnect attempts

# Temp files created for downloaded resumes — kept for the process lifetime
_resume_tmp_files: list[tempfile.NamedTemporaryFile] = []


def _download_resume(api_url: str, token: str, resume_id: str) -> str | None:
    """Download resume PDF from backend to a local temp file. Returns local path or None."""
    url = f"{api_url.rstrip('/')}/resumes/{resume_id}/download"
    try:
        req = Request(url, headers={"Authorization": f"Bearer {token}"})
        with urlopen(req, context=_ssl_ctx, timeout=30) as resp:
            data = resp.read()
        tmp = tempfile.NamedTemporaryFile(suffix=".pdf", delete=False)
        tmp.write(data)
        tmp.flush()
        _resume_tmp_files.append(tmp)
        return tmp.name
    except Exception:
        return None


async def run(api_url: str, token: str, on_status: callable | None = None) -> None:
    """
    Main agent loop. Connects to backend, handles commands, auto-reconnects.
    on_status(msg: str) is called with human-readable status updates.
    """
    # Strip /api suffix — WebSocket is at root /agent/ws, not /api/agent/ws
    ws_base = api_url.rstrip("/")
    if ws_base.endswith("/api"):
        ws_base = ws_base[:-4]
    ws_url = ws_base.replace("https://", "wss://").replace("http://", "ws://")
    ws_url = f"{ws_url}/agent/ws?token={token}"
    runner = RunnerManager()

    def status(msg: str) -> None:
        if on_status:
            on_status(msg)

    while True:
        try:
            status(f"Connecting to {api_url} ...")
            async with websockets.connect(ws_url, ssl=_ssl_ctx, ping_interval=30, ping_timeout=10) as ws:
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

                        # Download resume to local temp file so the bot can read it
                        resume_id = config.get("resume", {}).get("resume_id")
                        if resume_id:
                            local_path = _download_resume(api_url, token, resume_id)
                            if local_path:
                                config["resume"]["selected_resume_path"] = local_path
                                if "questions" in config:
                                    config["questions"]["default_resume_path"] = local_path

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
