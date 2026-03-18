from fastapi import APIRouter, Depends
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from . import db, models, schemas
from .auth import get_current_user


router = APIRouter(prefix="/outreaches", tags=["outreaches"])


@router.get("", response_model=schemas.OutreachesList)
def list_outreaches(
    skip: int = 0,
    limit: int = 50,
    search: str | None = None,
    status: str | None = None,
    current_user: models.User = Depends(get_current_user),
    session: Session = Depends(db.get_session),
):
    q = (
        session.query(models.OutreachEvent)
        .options(joinedload(models.OutreachEvent.recruiter_contact))
        .filter(models.OutreachEvent.user_id == current_user.id)
    )

    if search:
        like = f"%{search.strip()}%"
        q = q.outerjoin(models.RecruiterContact, models.OutreachEvent.recruiter_contact_id == models.RecruiterContact.id)
        q = q.filter(
            or_(
                models.OutreachEvent.role.ilike(like),
                models.OutreachEvent.company_filter.ilike(like),
                models.OutreachEvent.search_context.ilike(like),
                models.OutreachEvent.recruiter_profile_url.ilike(like),
                models.RecruiterContact.name.ilike(like),
                models.RecruiterContact.company.ilike(like),
                models.RecruiterContact.email.ilike(like),
            )
        )

    if status:
        q = q.filter(models.OutreachEvent.status == status)

    total = q.count()
    items = (
        q.order_by(models.OutreachEvent.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return schemas.OutreachesList(items=items, total=total)
