"""Backend-side bot runner.

- Reads the latest per-user config snapshot from the database at run start.
- Writes a single runtime JSON snapshot file for the bot process.
- Runs `bot/runAiBot.py` with `BOT_CONFIG_PATH` pointing to that snapshot.
- Captures stdout and stores a rolling excerpt on the Run.

This is designed to evolve into a separate worker service later.
"""

from __future__ import annotations

import json
import os
import re
import signal
import shutil
import subprocess
import sys
import threading
import time
import queue
from datetime import datetime
from pathlib import Path
from typing import Optional

from sqlalchemy import MetaData, Table, and_, select

from . import db, models


PROJECT_ROOT = Path(__file__).parent.parent
BOT_DIR = PROJECT_ROOT / "bot"
BOT_ENTRY = BOT_DIR / "runAiBot.py"
RUNTIME_DIR = PROJECT_ROOT / "bot_runtime"


def _makedirs(path: Path) -> None:
    """mkdir -p with subprocess fallback for filesystems where os.stat returns ENOTSUP."""
    try:
        path.mkdir(parents=True, exist_ok=True)
    except OSError:
        import subprocess, sys
        if sys.platform != "win32":
            subprocess.run(["mkdir", "-p", str(path)], check=True)
        else:
            raise
_run_stream_lock = threading.Lock()
_run_stream_subscribers: dict[int, set[queue.Queue]] = {}


def dumps_json(value: object) -> str:
    return json.dumps(value)


def _serialize_datetime(value: Optional[datetime]) -> Optional[str]:
    return value.isoformat() if value else None


def _serialize_run_record(run: models.Run) -> dict:
    return {
        "id": run.id,
        "status": run.status,
        "run_type": run.run_type or "apply",
        "started_at": _serialize_datetime(run.started_at),
        "finished_at": _serialize_datetime(run.finished_at),
        "error_message": run.error_message,
        "log_excerpt": run.log_excerpt,
        "config_snapshot": None,
    }


def _sanitize_snapshot_for_persistence(snapshot: dict) -> dict:
    sanitized = json.loads(json.dumps(snapshot))
    sanitized.pop("context_ai_cache", None)
    secrets = sanitized.get("secrets")
    if isinstance(secrets, dict):
        secrets = dict(secrets)
        if "llm_api_key" in secrets:
            secrets["llm_api_key"] = "***redacted***"
        sanitized["secrets"] = secrets
    return sanitized


def subscribe_run_stream(user_id: int) -> queue.Queue:
    q: queue.Queue = queue.Queue()
    with _run_stream_lock:
        _run_stream_subscribers.setdefault(user_id, set()).add(q)
    return q


def unsubscribe_run_stream(user_id: int, q: queue.Queue) -> None:
    with _run_stream_lock:
        subscribers = _run_stream_subscribers.get(user_id)
        if not subscribers:
            return
        subscribers.discard(q)
        if not subscribers:
            _run_stream_subscribers.pop(user_id, None)


def publish_run_stream_event(user_id: int, payload: dict) -> None:
    with _run_stream_lock:
        subscribers = list(_run_stream_subscribers.get(user_id, set()))
    for q in subscribers:
        try:
            q.put_nowait(payload)
        except Exception:
            continue


def publish_run_snapshot(run_id: int, event_type: str = "run_updated") -> None:
    try:
        with db.session_scope() as session:
            run = session.query(models.Run).filter(models.Run.id == run_id).one_or_none()
            if run is None:
                return
            payload = {
                "type": event_type,
                "run": _serialize_run_record(run),
            }
            publish_run_stream_event(run.user_id, payload)
    except Exception as exc:
        print(f"[bot_runner] Failed to publish run snapshot for {run_id}: {exc}", file=sys.stderr)


def get_serialized_runs_for_user(user_id: int) -> list[dict]:
    with db.session_scope() as session:
        runs = (
            session.query(models.Run)
            .filter(models.Run.user_id == user_id)
            .order_by(models.Run.started_at.desc())
            .all()
        )
        return [_serialize_run_record(run) for run in runs]


def _user_runtime_dir(user_id: int) -> Path:
    return RUNTIME_DIR / f"user_{user_id}"


def _run_stop_file(user_id: int, run_id: int) -> Path:
    d = _user_runtime_dir(user_id) / "runs"
    _makedirs(d)
    return d / f"run_{run_id}.stop"


def _run_config_file(user_id: int, run_id: int) -> Path:
    d = _user_runtime_dir(user_id) / "runs"
    _makedirs(d)
    return d / f"run_{run_id}.config.json"


def _load_config_section(raw_value: Optional[str], section_name: str) -> dict:
    if not raw_value:
        raise RuntimeError(
            f"Backend config section '{section_name}' is missing. "
            "Update it in the dashboard (or via the /config API) and retry."
        )
    try:
        data = json.loads(raw_value)
    except Exception as exc:
        raise RuntimeError(
            f"Backend config section '{section_name}' is not valid JSON: {exc}. "
            "Fix it in the dashboard (or via the /config API) and retry."
        ) from exc
    if not isinstance(data, dict):
        raise RuntimeError(
            f"Backend config section '{section_name}' must be a JSON object (key/value). "
            "Fix it in the dashboard (or via the /config API) and retry."
        )
    return data


def _load_optional_config_section(raw_value: Optional[str], section_name: str) -> dict:
    if not raw_value:
        return {}
    return _load_config_section(raw_value, section_name)


def _build_run_config_snapshot(user_id: int, run_type: str = "apply", run_input: Optional[dict] = None) -> dict:
    with db.session_scope() as session:
        cfg = session.query(models.Config).filter(models.Config.user_id == user_id).one_or_none()
        if cfg is None:
            raise RuntimeError(
                "No backend config found for this user. Complete onboarding (or save via /config) and retry."
            )

        settings = dict(_load_config_section(cfg.settings, "settings"))
        secrets = settings.pop("secrets", None)
        if not isinstance(secrets, dict) or not secrets:
            raise RuntimeError(
                "Backend config section 'secrets' is missing. "
                "Update Secrets in the dashboard (Onboarding/Settings) and retry."
            )

        # If a provider-specific API key exists in the backend environment, prefer it over DB storage.
        try:
            provider = str(secrets.get("ai_provider", "")).lower()
        except Exception:
            provider = ""
        provider_env_keys = {
            "openai": "OPENAI_API_KEY",
            "groq": "GROQ_API_KEY",
            "deepseek": "DEEPSEEK_API_KEY",
            "gemini": "GEMINI_API_KEY",
        }
        env_key_name = provider_env_keys.get(provider)
        if env_key_name:
            env_api_key = os.getenv(env_key_name, "").strip()
            if env_api_key:
                secrets["llm_api_key"] = env_api_key

        # Merge resume-derived default path into questions so the bot uses the selected resume
        questions = dict(_load_config_section(cfg.questions, "questions"))
        resume_cfg = _load_optional_config_section(cfg.resume, "resume")
        try:
            default_resume_id = resume_cfg.get("default_resume_id")
            default_resume = None
            if default_resume_id:
                default_resume = (
                    session.query(models.Resume)
                    .filter(models.Resume.user_id == user_id, models.Resume.id == default_resume_id)
                    .one_or_none()
                )
            if default_resume is None:
                default_resume = (
                    session.query(models.Resume)
                    .filter(models.Resume.user_id == user_id)
                    .order_by(models.Resume.created_at.desc())
                    .first()
                )

            selected_resume_path = default_resume.path if default_resume else ""
            selected_resume_id = default_resume.id if default_resume else None
            questions["default_resume_path"] = selected_resume_path
            resume_cfg = {
                "default_resume_id": selected_resume_id,
                "selected_resume_path": selected_resume_path,
                # agent uses this to download the file locally before starting the bot
                "resume_id": selected_resume_id,
            }
        except Exception:
            questions["default_resume_path"] = ""
            resume_cfg = {
                "default_resume_id": resume_cfg.get("default_resume_id"),
                "selected_resume_path": "",
            }

        sent_profile_urls = [
            row[0]
            for row in (
                session.query(models.OutreachEvent.recruiter_profile_url)
                .filter(
                    models.OutreachEvent.user_id == user_id,
                    models.OutreachEvent.status == "sent",
                    models.OutreachEvent.recruiter_profile_url.isnot(None),
                )
                .distinct()
                .all()
            )
            if row and row[0]
        ]
        sent_member_ids = [
            row[0]
            for row in (
                session.query(models.RecruiterContact.linkedin_member_id)
                .join(
                    models.OutreachEvent,
                    models.OutreachEvent.recruiter_contact_id == models.RecruiterContact.id,
                )
                .filter(
                    models.RecruiterContact.user_id == user_id,
                    models.RecruiterContact.linkedin_member_id.isnot(None),
                    models.OutreachEvent.status == "sent",
                )
                .distinct()
                .all()
            )
            if row and row[0]
        ]

        # If context AI is enabled, pre-load cached page contexts for this user
        use_context_ai = bool(settings.get("use_context_ai", False))
        context_ai_cache: dict = {}
        if use_context_ai:
            page_contexts = (
                session.query(models.ExternalPageContext)
                .filter(models.ExternalPageContext.user_id == user_id)
                .all()
            )
            for ctx in page_contexts:
                cache_key = f"{ctx.domain}:{ctx.page_fingerprint}"
                context_ai_cache[cache_key] = {
                    "domain": ctx.domain,
                    "page_fingerprint": ctx.page_fingerprint,
                    "dom_snapshot": ctx.dom_snapshot,
                    "ai_instructions": ctx.ai_instructions,
                    "times_used": ctx.times_used,
                }

        return {
            "personals": _load_config_section(cfg.personals, "personals"),
            "questions": questions,
            "search": _load_config_section(cfg.search, "search"),
            "settings": settings,
            "resume": resume_cfg,
            "outreach": {
                **_load_optional_config_section(cfg.outreach, "outreach"),
                **(run_input or {}),
                "run_type": run_type,
                "sent_recruiter_profile_urls": sent_profile_urls,
                "sent_recruiter_member_ids": sent_member_ids,
            },
            "other": _load_optional_config_section(cfg.other, "other"),
            "secrets": secrets,
            "context_ai_cache": context_ai_cache,
        }


def start_run(run_id: int) -> None:
    thread = threading.Thread(target=_run_worker, args=(run_id,), daemon=True)
    thread.start()


def _mark_run_failed(run_id: int, error_message: str) -> None:
    try:
        with db.session_scope() as session:
            run = session.query(models.Run).filter(models.Run.id == run_id).one_or_none()
            if run is None:
                return
            run.finished_at = datetime.utcnow()
            run.status = "failed"
            run.error_message = error_message[:2000]
            session.commit()
        publish_run_snapshot(run_id, "run_failed")
    except Exception as exc:
        print(f"[bot_runner] Failed to mark run {run_id} as failed: {exc}", file=sys.stderr)


def _persist_run_logs(run_id: int, log_lines: list[str]) -> None:
    try:
        with db.session_scope() as session:
            run = session.query(models.Run).filter(models.Run.id == run_id).one_or_none()
            if run is None:
                return
            run.log_excerpt = "\n".join(log_lines)
            session.commit()
        publish_run_snapshot(run_id, "run_updated")
    except Exception as exc:
        print(f"[bot_runner] Failed to persist logs for run {run_id}: {exc}", file=sys.stderr)


def _coerce_json_payload(value: object) -> object:
    return json.loads(json.dumps(value))


def _persist_page_context_event(user_id: int, ev: dict) -> None:
    domain = str(ev.get("domain") or "").strip()
    page_fingerprint = str(ev.get("page_fingerprint") or ev.get("fingerprint") or "").strip()
    dom_snapshot = ev.get("dom_snapshot")
    ai_instructions = ev.get("ai_instructions")
    if not domain or not page_fingerprint or dom_snapshot is None:
        return
    if not isinstance(ai_instructions, (list, dict)):
        return

    try:
        dom_snapshot = _coerce_json_payload(dom_snapshot)
        ai_instructions = _coerce_json_payload(ai_instructions)
    except Exception:
        return

    now = datetime.utcnow()
    with db.session_scope() as session:
        existing = (
            session.query(models.ExternalPageContext)
            .filter(
                models.ExternalPageContext.user_id == user_id,
                models.ExternalPageContext.domain == domain,
                models.ExternalPageContext.page_fingerprint == page_fingerprint,
            )
            .one_or_none()
        )
        if existing is None:
            ctx = models.ExternalPageContext(
                user_id=user_id,
                domain=domain,
                page_fingerprint=page_fingerprint,
                dom_snapshot=dom_snapshot,
                ai_instructions=ai_instructions,
                times_used=1,
                last_seen_at=now,
                created_at=now,
            )
            session.add(ctx)
        else:
            existing.dom_snapshot = dom_snapshot
            existing.ai_instructions = ai_instructions
            existing.times_used = (existing.times_used or 0) + 1
            existing.last_seen_at = now


def _persist_job_event(run_id: int, user_id: int, ev: dict) -> None:
    kind = ev.get("event")
    if kind == "learned_answer":
        _persist_learned_answer_event(user_id, ev)
        return
    if kind == "page_context":
        _persist_page_context_event(user_id, ev)
        return
    if kind == "outreach_settings_update":
        _persist_outreach_settings_update(user_id, ev)
        return
    if kind and str(kind).startswith("outreach_"):
        _persist_outreach_event(run_id, user_id, ev)
        return

    metadata = MetaData()
    jobs_table = Table("job_applications", metadata, autoload_with=db.engine)
    available = set(jobs_table.columns.keys())

    if kind not in {"job_progress", "job_review_required", "job_applied", "job_failed"}:
        return

    provider = ev.get("application_provider")
    if not provider:
        provider = "linkedin_easy_apply" if ev.get("application_link") == "Easy Applied" else "external"

    stage = ev.get("application_stage")
    if not stage:
        if kind == "job_review_required":
            stage = "review_pending"
        elif kind == "job_applied":
            stage = "submitted"
        elif kind == "job_failed":
            stage = "failed"
        else:
            stage = "detected"

    status = ev.get("status")
    if not status:
        status = "failed" if kind == "job_failed" else "applied"

    review_required = bool(ev.get("review_required"))

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
        "application_type": "easy_apply" if provider == "linkedin_easy_apply" else "external",
        "application_provider": provider,
        "application_stage": stage,
        "review_required": review_required,
        "status": status,
        "pipeline_status": ev.get("pipeline_status") or ("rejected" if kind == "job_failed" else "applied"),
        "reason_skipped": ev.get("reason"),
        "job_link": ev.get("job_link"),
        "external_link": ev.get("external_link") or ev.get("application_link"),
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }
    filtered_values = {key: value for key, value in values.items() if key in available}

    with db.engine.begin() as connection:
        lookup_conditions = [
            jobs_table.c.run_id == run_id,
            jobs_table.c.user_id == user_id,
        ]
        if ev.get("job_id") and "job_id" in available:
            lookup_conditions.append(jobs_table.c.job_id == ev.get("job_id"))
        elif ev.get("job_link") and "job_link" in available:
            lookup_conditions.append(jobs_table.c.job_link == ev.get("job_link"))
        elif (ev.get("external_link") or ev.get("application_link")) and "external_link" in available:
            lookup_conditions.append(
                jobs_table.c.external_link == (ev.get("external_link") or ev.get("application_link"))
            )
        else:
            if "title" in available:
                lookup_conditions.append(jobs_table.c.title == ev.get("title"))
            if "company" in available:
                lookup_conditions.append(jobs_table.c.company == ev.get("company"))

        existing_id = connection.execute(
            select(jobs_table.c.id).where(and_(*lookup_conditions)).order_by(jobs_table.c.id.desc()).limit(1)
        ).scalar_one_or_none()

        if existing_id is None:
            connection.execute(jobs_table.insert().values(**filtered_values))
            return

        updates = {key: value for key, value in filtered_values.items() if key not in {"created_at"}}
        if kind in {"job_progress", "job_review_required"} and "date_applied" in updates and updates["date_applied"] is None:
            updates.pop("date_applied")
        connection.execute(
            jobs_table.update().where(jobs_table.c.id == existing_id).values(**updates)
        )


def _resolve_python_path(env: dict[str, str]) -> str:
    configured = (env.get("BOT_PYTHON") or env.get("PYTHON") or "").strip()
    if configured:
        if os.path.isfile(configured):
            return configured
        resolved = shutil.which(configured)
        if resolved:
            return resolved
    return sys.executable or "python"


def _process_is_alive(pid: int) -> bool:
    if not pid:
        return False
    try:
        os.kill(pid, 0)
        return True
    except OSError:
        return False


def _mark_run_stopped_now(run_id: int) -> None:
    with db.session_scope() as session:
        run = session.query(models.Run).filter(models.Run.id == run_id).one_or_none()
        if run is None or run.finished_at is not None:
            return
        run.status = "stopped"
        run.finished_at = datetime.utcnow()
        session.commit()
    publish_run_snapshot(run_id, "run_stopped")


def _validate_backend_config_imports(*, python_exe: str, project_root: Path, env: dict[str, str]) -> tuple[bool, str]:
    """
    Ensure the backend runtime snapshot is importable through `config.*`.
    """
    cmd = [
        python_exe,
        "-c",
        (
            "import config.personals, config.questions, config.search, config.settings, config.resume, config.other, config.secrets; "
            "import config.outreach; "
            "print('OK')"
        ),
    ]
    check = subprocess.run(
        cmd,
        cwd=str(project_root),
        env=env,
        text=True,
        capture_output=True,
    )
    if check.returncode == 0:
        return True, (check.stdout or "").strip()
    out = (check.stdout or "").strip()
    err = (check.stderr or "").strip()
    msg = "\n".join([x for x in [out, err] if x])
    return False, (msg or f"Config import validation failed with code {check.returncode}")


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


def _normalize_learned_question(value: object) -> str:
    text = str(value or "").strip().lower()
    text = re.sub(r"\s+", " ", text)
    return text


def _persist_learned_answer_event(user_id: int, ev: dict) -> None:
    question = str(ev.get("question") or ev.get("label") or "").strip()
    answer = str(ev.get("answer") or "").strip()
    if not question or not answer:
        return

    question_type = str(ev.get("question_type") or "text").strip().lower() or "text"
    provider = str(ev.get("provider") or ev.get("application_provider") or "").strip().lower()
    normalized_question = _normalize_learned_question(question)
    if not normalized_question:
        return

    try:
        options = ev.get("options")
        if not isinstance(options, list):
            options = []
        clean_options = [str(option).strip() for option in options if str(option).strip()]
    except Exception:
        clean_options = []

    now = datetime.utcnow().isoformat() + "Z"
    with db.session_scope() as session:
        cfg = session.query(models.Config).filter(models.Config.user_id == user_id).one_or_none()
        if cfg is None:
            cfg = models.Config(user_id=user_id)
            session.add(cfg)
            session.flush()

        other = _load_optional_config_section(cfg.other, "other")
        learned_answers = other.get("learned_answers")
        if not isinstance(learned_answers, list):
            learned_answers = []

        existing_entry = None
        for item in learned_answers:
            if not isinstance(item, dict):
                continue
            if (
                _normalize_learned_question(item.get("normalized_question") or item.get("question")) == normalized_question
                and str(item.get("question_type") or "text").strip().lower() == question_type
                and str(item.get("provider") or "").strip().lower() == provider
            ):
                existing_entry = item
                break

        if existing_entry is None:
            existing_entry = {
                "question": question,
                "normalized_question": normalized_question,
                "answer": answer,
                "question_type": question_type,
                "provider": provider,
                "options": clean_options,
                "created_at": now,
                "updated_at": now,
                "usage_count": 1,
                "source": "manual_external_review",
            }
            learned_answers.append(existing_entry)
        else:
            existing_entry["question"] = question
            existing_entry["normalized_question"] = normalized_question
            existing_entry["answer"] = answer
            existing_entry["question_type"] = question_type
            existing_entry["provider"] = provider
            if clean_options:
                existing_entry["options"] = clean_options
            existing_entry["updated_at"] = now
            existing_entry["usage_count"] = int(existing_entry.get("usage_count") or 0) + 1

        other["learned_answers"] = learned_answers[-300:]
        cfg.other = json.dumps(other)
        session.add(cfg)


def _persist_outreach_event(run_id: int, user_id: int, ev: dict) -> None:
    event_name = str(ev.get("event") or "")
    recruiter_name = str(ev.get("recruiter_name") or "").strip() or None
    recruiter_profile_url = str(ev.get("recruiter_profile_url") or "").strip() or None
    recruiter_email = str(ev.get("recruiter_email") or "").strip() or None
    recruiter_company = str(ev.get("recruiter_company") or ev.get("company_filter") or "").strip() or None
    recruiter_headline = str(ev.get("recruiter_headline") or "").strip() or None
    recruiter_location = str(ev.get("recruiter_location") or "").strip() or None
    recruiter_member_id = str(ev.get("recruiter_member_id") or "").strip() or None

    if not recruiter_profile_url:
        return

    sent_at = _parse_event_datetime(ev.get("sent_at"))
    now = datetime.utcnow()
    with db.session_scope() as session:
        contact = (
            session.query(models.RecruiterContact)
            .filter(
                models.RecruiterContact.user_id == user_id,
                models.RecruiterContact.linkedin_profile_url == recruiter_profile_url,
            )
            .one_or_none()
        )
        if contact is None:
            contact = models.RecruiterContact(
                user_id=user_id,
                linkedin_profile_url=recruiter_profile_url,
            )
            session.add(contact)
            session.flush()

        contact.name = recruiter_name or contact.name
        contact.headline = recruiter_headline or contact.headline
        contact.company = recruiter_company or contact.company
        contact.location = recruiter_location or contact.location
        contact.email = recruiter_email or contact.email
        contact.linkedin_member_id = recruiter_member_id or contact.linkedin_member_id

        event = (
            session.query(models.OutreachEvent)
            .filter(
                models.OutreachEvent.run_id == run_id,
                models.OutreachEvent.user_id == user_id,
                models.OutreachEvent.recruiter_profile_url == recruiter_profile_url,
            )
            .order_by(models.OutreachEvent.id.desc())
            .one_or_none()
        )

        if event is None:
            event = models.OutreachEvent(
                user_id=user_id,
                run_id=run_id,
                recruiter_contact_id=contact.id,
                recruiter_profile_url=recruiter_profile_url,
                created_at=now,
            )
            session.add(event)

        event.recruiter_contact_id = contact.id
        event.role = ev.get("role") or event.role
        event.company_filter = ev.get("company_filter") or event.company_filter
        event.search_context = ev.get("search_context") or event.search_context
        event.message_input = ev.get("message_input") or event.message_input
        event.message_sent = ev.get("message_sent") or event.message_sent
        event.used_ai = bool(ev.get("used_ai")) if ev.get("used_ai") is not None else event.used_ai
        event.action_type = str(ev.get("action_type") or event.action_type or "message")
        status = str(ev.get("status") or "").strip()
        if not status:
            if event_name == "outreach_sent":
                status = "sent"
            elif event_name == "outreach_failed":
                status = "failed"
            elif event_name == "outreach_review_required":
                status = "review_pending"
            elif event_name == "outreach_discovered":
                status = "drafted"
            else:
                status = event.status or "drafted"
        event.status = status
        event.reason = ev.get("reason") or event.reason
        event.recruiter_email = recruiter_email or event.recruiter_email
        event.sent_at = sent_at or event.sent_at
        event.updated_at = now


def _persist_outreach_settings_update(user_id: int, ev: dict) -> None:
    updates = ev.get("updates")
    if not isinstance(updates, dict) or not updates:
        return

    with db.session_scope() as session:
        cfg = session.query(models.Config).filter(models.Config.user_id == user_id).one_or_none()
        if cfg is None:
            cfg = models.Config(user_id=user_id)
            session.add(cfg)
            session.flush()

        outreach = _load_optional_config_section(cfg.outreach, "outreach")
        outreach.update(updates)
        cfg.outreach = json.dumps(outreach)
        session.add(cfg)


def _run_worker(run_id: int) -> None:
    try:
        snapshot: dict
        with db.session_scope() as session:
            run = session.query(models.Run).filter(models.Run.id == run_id).one_or_none()
            if run is None:
                return
            user = session.query(models.User).filter(models.User.id == run.user_id).one()
            run_input = None
            if run.run_input:
                try:
                    parsed_run_input = json.loads(run.run_input)
                    if isinstance(parsed_run_input, dict):
                        run_input = parsed_run_input
                except Exception:
                    run_input = None
            snapshot = _build_run_config_snapshot(user.id, run.run_type or "apply", run_input)
            run.status = "running"
            run.started_at = datetime.utcnow()
            run.config_snapshot = json.dumps(_sanitize_snapshot_for_persistence(snapshot))
            session.commit()
        publish_run_snapshot(run_id, "run_started")

        config_path = _run_config_file(user.id, run_id)
        config_path.write_text(json.dumps(snapshot), encoding="utf-8")

        env = os.environ.copy()
        env["PYTHONPATH"] = f"{BOT_DIR}:{env.get('PYTHONPATH', '')}"
        env["BOT_STOP_FILE"] = str(_run_stop_file(user.id, run_id))
        env["BOT_CONFIG_PATH"] = str(config_path)
        if bool(snapshot.get("settings", {}).get("run_in_background")):
            env["BOT_DISABLE_DIALOGS"] = "1"
        else:
            env.pop("BOT_DISABLE_DIALOGS", None)
        env["PYTHONUNBUFFERED"] = "1"

        python_exe = _resolve_python_path(env)

        ok, detail = _validate_backend_config_imports(
            python_exe=python_exe,
            project_root=PROJECT_ROOT,
            env=env,
        )
        if not ok:
            _mark_run_failed(run_id, detail)
            return

        cmd = [python_exe, "-u", str(BOT_ENTRY)]
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
        publish_run_snapshot(run_id, "run_finished")

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
    publish_run_snapshot(run_id, "run_stopping")
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
    publish_run_snapshot(run_id, "run_stopping")
    _run_stop_file(user_id, run_id).write_text("stop", encoding="utf-8")
    if not pid:
        _mark_run_stopped_now(run_id)
        return
    try:
        os.killpg(pid, signal.SIGTERM)
    except Exception:
        try:
            os.kill(pid, signal.SIGTERM)
        except Exception:
            _mark_run_stopped_now(run_id)
            return
    deadline = time.monotonic() + 2.0
    while time.monotonic() < deadline:
        if not _process_is_alive(pid):
            break
        time.sleep(0.1)
    try:
        os.killpg(pid, signal.SIGKILL)
    except Exception:
        try:
            os.kill(pid, signal.SIGKILL)
        except Exception:
            if not _process_is_alive(pid):
                _mark_run_stopped_now(run_id)
            return
    deadline = time.monotonic() + 2.0
    while time.monotonic() < deadline:
        if not _process_is_alive(pid):
            _mark_run_stopped_now(run_id)
            return
        time.sleep(0.1)
