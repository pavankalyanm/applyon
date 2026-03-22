"""
WebSocket endpoint for the Jobcook agent.

The agent connects here, receives run commands, and streams logs back.
All log/event persistence reuses the existing bot_runner functions.
"""
from __future__ import annotations

import asyncio
import json
import sys
from datetime import datetime

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from . import agent_manager, bot_runner, db, models
from .auth import get_current_user_from_token

router = APIRouter(tags=["agent"])

# Tracks pending delayed-cleanup tasks per user so they can be cancelled on reconnect
_cleanup_tasks: dict[int, asyncio.Task] = {}


@router.websocket("/agent/ws")
async def agent_ws(websocket: WebSocket, token: str = Query(...)) -> None:
    # Authenticate
    try:
        with db.session_scope() as session:
            user = get_current_user_from_token(token, session)
            user_id = user.id
    except Exception:
        await websocket.close(code=4001)
        return

    # Cancel any pending orphan-cleanup for this user — agent reconnected in time
    pending = _cleanup_tasks.pop(user_id, None)
    if pending:
        pending.cancel()

    await websocket.accept()
    agent_manager.register(user_id, websocket)

    # Notify any pending runs that the agent is now online
    bot_runner.publish_run_stream_event(user_id, {"type": "agent_connected"})

    log_buffers: dict[int, list[str]] = {}

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw)
            except Exception:
                continue

            msg_type = msg.get("type")

            # ── agent heartbeat ──────────────────────────────────────────────
            if msg_type == "agent_ready":
                pass  # already registered above

            elif msg_type == "pong":
                pass

            # ── log line from bot stdout ─────────────────────────────────────
            elif msg_type == "log":
                run_id = msg.get("run_id")
                line = msg.get("line", "")
                if not run_id:
                    continue

                buf = log_buffers.setdefault(run_id, [])
                buf.append(line)
                if len(buf) > 200:
                    buf.pop(0)

                # Persist logs and handle EVENT: lines same as local bot_runner
                if line.startswith("[STEP]") or len(buf) % 5 == 0:
                    bot_runner._persist_run_logs(run_id, buf)

                if line.startswith("EVENT:"):
                    try:
                        event = json.loads(line[len("EVENT:"):])
                        bot_runner._persist_job_event(run_id, user_id, event)
                    except Exception as exc:
                        print(f"[agent_ws] Failed to persist event: {exc}", file=sys.stderr)

            # ── run finished ─────────────────────────────────────────────────
            elif msg_type == "run_finished":
                run_id = msg.get("run_id")
                exit_code = msg.get("exit_code", -1)
                if not run_id:
                    continue

                buf = log_buffers.pop(run_id, [])
                bot_runner._persist_run_logs(run_id, buf)

                try:
                    with db.session_scope() as session:
                        run = (
                            session.query(models.Run)
                            .filter(models.Run.id == run_id, models.Run.user_id == user_id)
                            .one_or_none()
                        )
                        if run and run.finished_at is None:
                            run.finished_at = datetime.utcnow()
                            was_stopped = bool(run.stop_requested_at or run.killed_at)
                            run.status = (
                                "stopped" if was_stopped
                                else ("success" if exit_code == 0 else "failed")
                            )
                            if exit_code != 0 and not run.error_message:
                                run.error_message = f"Process exited with code {exit_code}"
                            session.commit()
                    bot_runner.publish_run_snapshot(run_id, "run_finished")
                except Exception as exc:
                    print(f"[agent_ws] Failed to finish run {run_id}: {exc}", file=sys.stderr)

    except WebSocketDisconnect:
        pass
    except Exception as exc:
        print(f"[agent_ws] Error for user {user_id}: {exc}", file=sys.stderr)
    finally:
        agent_manager.unregister(user_id)
        bot_runner.publish_run_stream_event(user_id, {"type": "agent_disconnected"})
        # Schedule orphan cleanup with a 15-second grace period so brief
        # reconnects (e.g. Chrome extension service worker restarts) don't
        # incorrectly fail active runs.
        task = asyncio.create_task(_delayed_fail_orphans(user_id, delay=15))
        _cleanup_tasks[user_id] = task


async def _delayed_fail_orphans(user_id: int, delay: int = 15) -> None:
    """Wait `delay` seconds, then fail orphaned runs if the agent hasn't reconnected."""
    try:
        await asyncio.sleep(delay)
        if not agent_manager.is_connected(user_id):
            _fail_orphaned_runs(user_id)
    except asyncio.CancelledError:
        pass  # Agent reconnected within the grace window
    finally:
        _cleanup_tasks.pop(user_id, None)


def _fail_orphaned_runs(user_id: int) -> None:
    """If the agent disconnects mid-run, mark those runs as failed."""
    try:
        with db.session_scope() as session:
            orphans = (
                session.query(models.Run)
                .filter(
                    models.Run.user_id == user_id,
                    models.Run.status.in_(["pending", "running", "stopping"]),
                    models.Run.finished_at.is_(None),
                )
                .all()
            )
            for run in orphans:
                run.status = "failed"
                run.finished_at = datetime.utcnow()
                run.error_message = "Agent disconnected during run."
            session.commit()
        for run in orphans:
            bot_runner.publish_run_snapshot(run.id, "run_failed")
    except Exception as exc:
        print(f"[agent_ws] Failed to clean up orphaned runs: {exc}", file=sys.stderr)
