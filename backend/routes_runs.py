from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime

from . import db, models, schemas
from .auth import get_current_user
from . import bot_runner


router = APIRouter(prefix="/runs", tags=["runs"])


@router.get("", response_model=list[schemas.RunOut])
def list_runs(current_user: models.User = Depends(get_current_user), session: Session = Depends(db.get_session)):
    runs = (
        session.query(models.Run)
        .filter(models.Run.user_id == current_user.id)
        .order_by(models.Run.started_at.desc())
        .all()
    )
    return runs


@router.get("/{run_id}", response_model=schemas.RunDetail)
def get_run(run_id: int, current_user: models.User = Depends(get_current_user), session: Session = Depends(db.get_session)):
    run = (
        session.query(models.Run)
        .filter(models.Run.id == run_id, models.Run.user_id == current_user.id)
        .one_or_none()
    )
    if run is None:
        raise HTTPException(status_code=404, detail="Run not found")
    return run


@router.post("", response_model=schemas.RunOut)
def create_run(current_user: models.User = Depends(get_current_user), session: Session = Depends(db.get_session)):
    """
    Create a Run row and trigger the bot_runner in background.
    """
    run = models.Run(user_id=current_user.id, status="pending",
                     started_at=datetime.utcnow())
    session.add(run)
    session.commit()
    session.refresh(run)

    # Start the bot asynchronously
    bot_runner.start_run(run.id)

    return run


@router.post("/{run_id}/stop")
def stop_run(run_id: int, current_user: models.User = Depends(get_current_user), session: Session = Depends(db.get_session)):
    run = session.query(models.Run).filter(
        models.Run.id == run_id, models.Run.user_id == current_user.id).one_or_none()
    if run is None:
        raise HTTPException(status_code=404, detail="Run not found")
    bot_runner.request_stop(run_id)
    return {"status": "stopping"}


@router.post("/{run_id}/kill")
def kill_run(run_id: int, current_user: models.User = Depends(get_current_user), session: Session = Depends(db.get_session)):
    run = session.query(models.Run).filter(
        models.Run.id == run_id, models.Run.user_id == current_user.id).one_or_none()
    if run is None:
        raise HTTPException(status_code=404, detail="Run not found")
    bot_runner.force_kill(run_id)
    return {"status": "stopping"}
