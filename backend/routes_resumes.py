from __future__ import annotations

import os
import uuid
import json
from datetime import datetime
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from . import db, models
from .auth import get_current_user


router = APIRouter(prefix="/resumes", tags=["resumes"])


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


def _storage_root() -> Path:
    base = os.getenv("RESUME_STORAGE_DIR", "./storage/resumes")
    root = Path(base).expanduser().absolute()
    _makedirs(root)
    return root


def _load_resume_config(cfg: models.Config | None) -> dict[str, Any]:
    if cfg is None or not cfg.resume:
        return {"default_resume_id": None}
    try:
        data = json.loads(cfg.resume)
        if not isinstance(data, dict):
            return {"default_resume_id": None}
        return data
    except Exception:
        return {"default_resume_id": None}


def _save_resume_config(cfg: models.Config, default_resume_id: str | None) -> None:
    cfg.resume = json.dumps({"default_resume_id": default_resume_id})


def _serialize_resume(item: models.Resume) -> dict[str, Any]:
    return {
        "id": item.id,
        "label": item.label,
        "path": item.path,
        "created_at": item.created_at.isoformat() + "Z",
    }


def _build_response(cfg: models.Config | None, items: list[models.Resume]) -> dict[str, Any]:
    resume_cfg = _load_resume_config(cfg)
    return {
        "items": [_serialize_resume(item) for item in items],
        "default_resume_id": resume_cfg.get("default_resume_id"),
    }


@router.get("")
def list_resumes(
    current_user: models.User = Depends(get_current_user),
    session: Session = Depends(db.get_session),
):
    """
    Return the list of stored resumes for the current user.
    """
    cfg = session.query(models.Config).filter(models.Config.user_id == current_user.id).one_or_none()
    items = (
        session.query(models.Resume)
        .filter(models.Resume.user_id == current_user.id)
        .order_by(models.Resume.created_at.desc())
        .all()
    )
    return _build_response(cfg, items)


@router.post("")
async def upload_resume(
    file: UploadFile = File(...),
    current_user: models.User = Depends(get_current_user),
    session: Session = Depends(db.get_session),
):
    """
    Upload a resume file and store its metadata in Config.resume.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="Missing filename")

    cfg = session.query(models.Config).filter(models.Config.user_id == current_user.id).one_or_none()
    if cfg is None:
        cfg = models.Config(user_id=current_user.id)
        session.add(cfg)
        session.flush()

    resume_cfg = _load_resume_config(cfg)

    storage_root = _storage_root()
    user_dir = storage_root / f"user_{current_user.id}"
    user_dir.mkdir(parents=True, exist_ok=True)

    ext = Path(file.filename).suffix or ""
    resume_id = str(uuid.uuid4())
    stored_name = f"{resume_id}{ext}"
    stored_path = user_dir / stored_name

    content = await file.read()
    try:
        stored_path.write_bytes(content)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {exc}") from exc

    created_at = datetime.utcnow()
    resume = models.Resume(
        id=resume_id,
        user_id=current_user.id,
        label=file.filename,
        path=str(stored_path),
        created_at=created_at,
        updated_at=created_at,
    )
    session.add(resume)

    default_resume_id = resume_cfg.get("default_resume_id") or resume_id
    _save_resume_config(cfg, default_resume_id)
    session.add(cfg)
    session.commit()

    items = (
        session.query(models.Resume)
        .filter(models.Resume.user_id == current_user.id)
        .order_by(models.Resume.created_at.desc())
        .all()
    )
    return _build_response(cfg, items)


@router.delete("/{resume_id}")
def delete_resume(
    resume_id: str,
    current_user: models.User = Depends(get_current_user),
    session: Session = Depends(db.get_session),
):
    """
    Delete a stored resume and its file if present.
    """
    cfg = session.query(models.Config).filter(models.Config.user_id == current_user.id).one_or_none()
    resume = (
        session.query(models.Resume)
        .filter(models.Resume.id == resume_id, models.Resume.user_id == current_user.id)
        .one_or_none()
    )
    if resume is None:
        raise HTTPException(status_code=404, detail="Resume not found")

    try:
        Path(resume.path).unlink(missing_ok=True)
    except Exception:
        pass

    session.delete(resume)
    session.flush()

    remaining = (
        session.query(models.Resume)
        .filter(models.Resume.user_id == current_user.id)
        .order_by(models.Resume.created_at.desc())
        .all()
    )

    if cfg is None:
        cfg = models.Config(user_id=current_user.id)
        session.add(cfg)
        session.flush()

    default_resume_id = _load_resume_config(cfg).get("default_resume_id")
    if default_resume_id == resume_id:
        default_resume_id = remaining[0].id if remaining else None

    _save_resume_config(cfg, default_resume_id)
    session.add(cfg)
    session.commit()

    return _build_response(cfg, remaining)


@router.post("/{resume_id}/default")
def set_default_resume(
    resume_id: str,
    current_user: models.User = Depends(get_current_user),
    session: Session = Depends(db.get_session),
):
    """
    Mark a resume as the default for future runs.
    """
    cfg = session.query(models.Config).filter(models.Config.user_id == current_user.id).one_or_none()
    resume = (
        session.query(models.Resume)
        .filter(models.Resume.id == resume_id, models.Resume.user_id == current_user.id)
        .one_or_none()
    )
    if resume is None:
        raise HTTPException(status_code=404, detail="Resume not found")

    if cfg is None:
        cfg = models.Config(user_id=current_user.id)
        session.add(cfg)
        session.flush()

    _save_resume_config(cfg, resume_id)
    session.add(cfg)
    session.commit()

    items = (
        session.query(models.Resume)
        .filter(models.Resume.user_id == current_user.id)
        .order_by(models.Resume.created_at.desc())
        .all()
    )
    return _build_response(cfg, items)
