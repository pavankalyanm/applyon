import asyncio
import json
import queue

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from datetime import datetime

from . import db, models, schemas
from .auth import get_current_user, get_current_user_from_token
from . import bot_runner


router = APIRouter(prefix="/runs", tags=["runs"])


@router.get("/stream")
async def stream_runs(
    token: str = Query(...),
    session: Session = Depends(db.get_session),
):
    current_user = get_current_user_from_token(token, session)
    initial_runs = bot_runner.get_serialized_runs_for_user(current_user.id)
    subscriber = bot_runner.subscribe_run_stream(current_user.id)

    async def event_generator():
        try:
            yield f"data: {json.dumps({'type': 'runs_snapshot', 'runs': initial_runs})}\n\n"
            while True:
                try:
                    payload = await asyncio.to_thread(subscriber.get, True, 15.0)
                    yield f"data: {json.dumps(payload)}\n\n"
                except queue.Empty:
                    yield "event: ping\ndata: {}\n\n"
        finally:
            bot_runner.unsubscribe_run_stream(current_user.id, subscriber)

    return StreamingResponse(event_generator(), media_type="text/event-stream")


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
def create_run(
    payload: schemas.RunCreate | None = None,
    current_user: models.User = Depends(get_current_user),
    session: Session = Depends(db.get_session),
):
    """
    Create a Run row and trigger the bot_runner in background.
    """
    payload = payload or schemas.RunCreate()
    run = models.Run(
        user_id=current_user.id,
        status="pending",
        run_type=payload.run_type or "apply",
        run_input=None if payload.run_input is None else bot_runner.dumps_json(payload.run_input),
        started_at=datetime.utcnow(),
    )
    session.add(run)
    session.commit()
    session.refresh(run)

    # Start the bot asynchronously
    bot_runner.start_run(run.id)
    bot_runner.publish_run_snapshot(run.id, "run_created")

    return run


@router.post("/outreach", response_model=schemas.RunOut)
def create_outreach_run(
    payload: schemas.RunCreate,
    current_user: models.User = Depends(get_current_user),
    session: Session = Depends(db.get_session),
):
    payload.run_type = "outreach"
    return create_run(payload=payload, current_user=current_user, session=session)


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
