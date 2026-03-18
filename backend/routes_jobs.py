from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_

from . import db, models, schemas
from .auth import get_current_user


router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.get("", response_model=schemas.JobsList)
def list_jobs(
    skip: int = 0,
    limit: int = 50,
    search: str | None = None,
    pipeline_status: str | None = Query(default=None),
    status: str | None = Query(default=None),
    provider: str | None = Query(default=None),
    current_user: models.User = Depends(get_current_user),
    session: Session = Depends(db.get_session),
):
    q = session.query(models.JobApplication).filter(models.JobApplication.user_id == current_user.id)

    if search:
        like = f"%{search.strip()}%"
        q = q.filter(
            or_(
                models.JobApplication.title.ilike(like),
                models.JobApplication.company.ilike(like),
                models.JobApplication.location.ilike(like),
                models.JobApplication.job_id.ilike(like),
            )
        )

    if pipeline_status:
        q = q.filter(models.JobApplication.pipeline_status == pipeline_status)

    if status:
        q = q.filter(models.JobApplication.status == status)

    if provider:
        q = q.filter(models.JobApplication.application_provider == provider)

    total = q.count()
    items = (
        q.order_by(models.JobApplication.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return schemas.JobsList(items=items, total=total)


@router.patch("/{job_id}", response_model=schemas.JobApplicationOut)
def update_job(
    job_id: int,
    payload: schemas.JobApplicationUpdate,
    current_user: models.User = Depends(get_current_user),
    session: Session = Depends(db.get_session),
):
    allowed_statuses = {"applied", "assessment", "interview", "rejected"}
    if payload.pipeline_status not in allowed_statuses:
        raise HTTPException(status_code=400, detail="Invalid pipeline status")

    job = (
        session.query(models.JobApplication)
        .filter(models.JobApplication.id == job_id, models.JobApplication.user_id == current_user.id)
        .one_or_none()
    )
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")

    job.pipeline_status = payload.pipeline_status
    session.commit()
    session.refresh(job)
    return job
