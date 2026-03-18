from datetime import datetime
from typing import Optional, Any, List

from pydantic import BaseModel, EmailStr


class UserOut(BaseModel):
    id: int
    email: Optional[EmailStr] = None
    name: Optional[str] = None

    class Config:
        from_attributes = True


class ConfigPayload(BaseModel):
    personals: Optional[Any] = None
    questions: Optional[Any] = None
    search: Optional[Any] = None
    settings: Optional[Any] = None
    resume: Optional[Any] = None
    other: Optional[Any] = None


class ConfigOut(ConfigPayload):
    id: int

    class Config:
        from_attributes = True


class RunOut(BaseModel):
    id: int
    status: str
    started_at: datetime
    finished_at: Optional[datetime] = None
    error_message: Optional[str] = None

    class Config:
        from_attributes = True


class RunDetail(RunOut):
    log_excerpt: Optional[str] = None
    config_snapshot: Optional[str] = None


class JobApplicationOut(BaseModel):
    id: int
    run_id: int
    job_id: Optional[str] = None
    title: Optional[str] = None
    company: Optional[str] = None
    location: Optional[str] = None
    work_style: Optional[str] = None
    date_posted: Optional[datetime] = None
    date_applied: Optional[datetime] = None
    application_type: Optional[str] = None
    application_provider: Optional[str] = None
    application_stage: Optional[str] = None
    review_required: bool = False
    status: str
    pipeline_status: str
    reason_skipped: Optional[str] = None
    job_link: Optional[str] = None
    external_link: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class JobApplicationUpdate(BaseModel):
    pipeline_status: str


class JobsList(BaseModel):
    items: List[JobApplicationOut]
    total: int
