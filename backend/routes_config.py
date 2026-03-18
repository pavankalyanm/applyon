from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
import json

from . import db, models, schemas
from .auth import get_current_user


router = APIRouter(prefix="/config", tags=["config"])


def _loads_or_none(value: str | None):
    if value is None:
        return None
    try:
        return json.loads(value)
    except Exception:
        # Fallback to raw string if legacy/invalid JSON is stored
        return value


def _resume_payload_or_none(value: str | None):
    parsed = _loads_or_none(value)
    if not isinstance(parsed, dict):
        return None
    return {"default_resume_id": parsed.get("default_resume_id")}


@router.get("", response_model=schemas.ConfigOut)
def get_config(
    current_user: models.User = Depends(get_current_user),
    session: Session = Depends(db.get_session),
):
    """
    Return the user's config with JSON columns parsed into objects.
    """
    cfg = session.query(models.Config).filter(models.Config.user_id == current_user.id).one_or_none()
    if cfg is None:
        cfg = models.Config(user_id=current_user.id)
        session.add(cfg)
        session.commit()
        session.refresh(cfg)

    return schemas.ConfigOut(
        id=cfg.id,
        personals=_loads_or_none(cfg.personals),
        questions=_loads_or_none(cfg.questions),
        search=_loads_or_none(cfg.search),
        settings=_loads_or_none(cfg.settings),
        resume=_resume_payload_or_none(cfg.resume),
        other=_loads_or_none(cfg.other),
    )


@router.put("", response_model=schemas.ConfigOut)
def update_config(
    payload: schemas.ConfigPayload,
    current_user: models.User = Depends(get_current_user),
    session: Session = Depends(db.get_session),
):
    """
    Upsert the user's config, storing section payloads as JSON strings.
    """
    cfg = session.query(models.Config).filter(models.Config.user_id == current_user.id).one_or_none()
    if cfg is None:
        cfg = models.Config(user_id=current_user.id)
        session.add(cfg)

    if payload.personals is not None:
        cfg.personals = json.dumps(payload.personals)
    if payload.questions is not None:
        cfg.questions = json.dumps(payload.questions)
    if payload.search is not None:
        cfg.search = json.dumps(payload.search)
    if payload.settings is not None:
        cfg.settings = json.dumps(payload.settings)
    if payload.resume is not None:
        default_resume_id = None
        if isinstance(payload.resume, dict):
            default_resume_id = payload.resume.get("default_resume_id")
        cfg.resume = json.dumps({"default_resume_id": default_resume_id})
    if payload.other is not None:
        cfg.other = json.dumps(payload.other)

    session.commit()
    session.refresh(cfg)

    return get_config(current_user=current_user, session=session)
