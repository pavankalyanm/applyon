"""Backend-side bot runner.

- Writes per-user `config/*.py` override files from DB JSON.
- Runs `bot/runAiBot.py` with `PYTHONPATH` pointing to:
  1) per-user override dir (so `import config.*` resolves to overrides)
  2) `bot/` (so `import modules.*` and fallback `config.*` work)
- Captures stdout and stores a rolling excerpt on the Run.

This is designed to evolve into a separate worker service later.
"""

from __future__ import annotations

import json
import os
import signal
import shutil
import subprocess
import sys
import threading
import time
from datetime import datetime
from pathlib import Path
from typing import Optional

from sqlalchemy import MetaData, Table

from . import db, models


PROJECT_ROOT = Path(__file__).resolve().parents[1]
BOT_DIR = PROJECT_ROOT / "bot"
BOT_ENTRY = BOT_DIR / "runAiBot.py"
RUNTIME_DIR = PROJECT_ROOT / "bot_runtime"


def _user_runtime_dir(user_id: int) -> Path:
    return RUNTIME_DIR / f"user_{user_id}"

def _run_stop_file(user_id: int, run_id: int) -> Path:
    d = _user_runtime_dir(user_id) / "runs"
    d.mkdir(parents=True, exist_ok=True)
    return d / f"run_{run_id}.stop"


def _user_config_dir(user_id: int) -> Path:
    return _user_runtime_dir(user_id) / "config"


def _write_user_configs(user: models.User) -> None:
    cfg_dir = _user_config_dir(user.id)
    cfg_dir.mkdir(parents=True, exist_ok=True)

    with db.session_scope() as session:
        cfg = session.query(models.Config).filter(models.Config.user_id == user.id).one_or_none()
        if cfg is None:
            return

        def write_if_present(module_name: str, value: Optional[str]) -> None:
            if not value:
                return
            target = cfg_dir / f"{module_name}.py"
            data = json.loads(value)
            if isinstance(data, dict):
                lines = [f"# Auto-generated overrides for user {user.id}"]
                for k, v in data.items():
                    lines.append(f"{k} = {json.dumps(v, ensure_ascii=False)}")
                target.write_text("\n".join(lines), encoding="utf-8")

        write_if_present("personals", cfg.personals)
        write_if_present("questions", cfg.questions)
        write_if_present("search", cfg.search)
        write_if_present("settings", cfg.settings)
        write_if_present("resume", cfg.resume)


def start_run(run_id: int) -> None:
    thread = threading.Thread(target=_run_worker, args=(run_id,), daemon=True)
    thread.start()


def _mark_run_failed(run_id: int, error_message: str) -> None:
    with db.session_scope() as session:
        run = session.query(models.Run).filter(models.Run.id == run_id).one_or_none()
        if run is None:
            return
        run.finished_at = datetime.utcnow()
        run.status = "failed"
        run.error_message = error_message[:2000]
        session.commit()


def _persist_run_logs(run_id: int, log_lines: list[str]) -> None:
    with db.session_scope() as session:
        run = session.query(models.Run).filter(models.Run.id == run_id).one_or_none()
        if run is None:
            return
        run.log_excerpt = "\n".join(log_lines)
        session.commit()


def _persist_job_event(run_id: int, user_id: int, ev: dict) -> None:
    metadata = MetaData()
    jobs_table = Table("job_applications", metadata, autoload_with=db.engine)
    available = set(jobs_table.columns.keys())

    kind = ev.get("event")
    if kind not in {"job_applied", "job_failed"}:
        return

    values = {
        "run_id": run_id,
        "user_id": user_id,
        "job_id": ev.get("job_id"),
        "title": ev.get("title"),
        "company": ev.get("company"),
        "location": ev.get("location"),
        "work_style": ev.get("work_style"),
        "date_posted": _parse_event_datetime(ev.get("date_posted")),
        "date_applied": _parse_event_datetime(ev.get("date_applied")),
        "application_type": "easy_apply" if ev.get("application_link") == "Easy Applied" else "external",
        "status": "applied" if kind == "job_applied" else "failed",
        "pipeline_status": "applied" if kind == "job_applied" else "rejected",
        "reason_skipped": ev.get("reason"),
        "job_link": ev.get("job_link"),
        "external_link": ev.get("external_link") or ev.get("application_link"),
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }
    filtered_values = {key: value for key, value in values.items() if key in available}

    with db.engine.begin() as connection:
        connection.execute(jobs_table.insert().values(**filtered_values))


def _resolve_python_path(env: dict[str, str]) -> str:
    configured = (env.get("BOT_PYTHON") or env.get("PYTHON") or "").strip()
    if configured:
        if os.path.isfile(configured):
            return configured
        resolved = shutil.which(configured)
        if resolved:
            return resolved
    return sys.executable or "python"


def _parse_event_datetime(value: object) -> Optional[datetime]:
    if value is None:
        return None
    raw = str(value).strip()
    if not raw or raw.lower() in {"unknown", "pending", "none", "n/a"}:
        return None
    try:
        dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError:
        for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
            try:
                dt = datetime.strptime(raw, fmt)
                break
            except ValueError:
                continue
        else:
            return None
    if dt.tzinfo is not None:
        dt = dt.astimezone().replace(tzinfo=None)
    return dt


def _run_worker(run_id: int) -> None:
    try:
        with db.session_scope() as session:
            run = session.query(models.Run).filter(models.Run.id == run_id).one_or_none()
            if run is None:
                return
            user = session.query(models.User).filter(models.User.id == run.user_id).one()
            run.status = "running"
            run.started_at = datetime.utcnow()
            session.commit()

        _write_user_configs(user)

        env = os.environ.copy()
        override_parent = str(_user_runtime_dir(user.id))
        env["PYTHONPATH"] = f"{override_parent}:{BOT_DIR}:{env.get('PYTHONPATH', '')}"
        env["BOT_STOP_FILE"] = str(_run_stop_file(user.id, run_id))
        env["PYTHONUNBUFFERED"] = "1"

        cmd = [_resolve_python_path(env), "-u", str(BOT_ENTRY)]
        process = subprocess.Popen(
            cmd,
            cwd=str(PROJECT_ROOT),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            env=env,
            text=True,
            bufsize=1,
            start_new_session=True,
        )
        with db.session_scope() as session:
            run = session.query(models.Run).filter(models.Run.id == run_id).one_or_none()
            if run is not None:
                run.pid = process.pid
                session.commit()

        log_lines: list[str] = []
        last_persist_at = 0.0
        assert process.stdout is not None
        for line in process.stdout:
            raw = line.rstrip("\n")
            log_lines.append(raw)
            if len(log_lines) > 200:
                log_lines.pop(0)
            now = time.monotonic()
            if raw.startswith("[STEP]") or (now - last_persist_at) >= 1.0:
                _persist_run_logs(run_id, log_lines)
                last_persist_at = now
            if raw.startswith("EVENT:"):
                try:
                    event = json.loads(raw[len("EVENT:") :])
                    _persist_job_event(run_id, user.id, event)
                except Exception as exc:
                    log_lines.append(f"[DB] Failed to persist job event: {exc}")
                    if len(log_lines) > 200:
                        log_lines.pop(0)
                    _persist_run_logs(run_id, log_lines)
                    pass

        process.wait()
        exit_code = process.returncode

        with db.session_scope() as session:
            run = session.query(models.Run).filter(models.Run.id == run_id).one_or_none()
            if run is None:
                return
            run.finished_at = datetime.utcnow()
            was_stopped = bool(run.stop_requested_at or run.killed_at)
            run.status = "stopped" if was_stopped else ("success" if exit_code == 0 else "failed")
            run.log_excerpt = "\n".join(log_lines)
            if exit_code != 0 and not run.error_message:
                run.error_message = f"Process exited with code {exit_code}"
            session.commit()

    except Exception as exc:
        _mark_run_failed(run_id, f"Run worker failed: {exc}")

def request_stop(run_id: int) -> None:
    """Graceful stop: create stop file; bot should exit on next check."""
    with db.session_scope() as session:
        run = session.query(models.Run).filter(models.Run.id == run_id).one_or_none()
        if run is None:
            return
        run.stop_requested_at = datetime.utcnow()
        run.status = "stopping"
        user_id = run.user_id
        session.commit()
    _run_stop_file(user_id, run_id).write_text("stop", encoding="utf-8")


def force_kill(run_id: int) -> None:
    """Hard stop: send SIGTERM then SIGKILL (best-effort)."""
    with db.session_scope() as session:
        run = session.query(models.Run).filter(models.Run.id == run_id).one_or_none()
        if run is None:
            return
        pid = run.pid
        user_id = run.user_id
        run.killed_at = datetime.utcnow()
        run.status = "stopping"
        session.commit()
    _run_stop_file(user_id, run_id).write_text("stop", encoding="utf-8")
    if not pid:
        with db.session_scope() as session:
            run = session.query(models.Run).filter(models.Run.id == run_id).one_or_none()
            if run is not None and run.finished_at is None:
                run.status = "stopped"
                run.finished_at = datetime.utcnow()
                session.commit()
        return
    try:
        os.killpg(pid, signal.SIGTERM)
    except Exception:
        try:
            os.kill(pid, signal.SIGTERM)
        except Exception:
            return
    deadline = time.monotonic() + 2.0
    while time.monotonic() < deadline:
        try:
            os.killpg(pid, 0)
            time.sleep(0.1)
        except Exception:
            break
    try:
        os.killpg(pid, signal.SIGKILL)
    except Exception:
        try:
            os.kill(pid, signal.SIGKILL)
        except Exception:
            return
