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
    outreach: Optional[Any] = None
    other: Optional[Any] = None


class ConfigOut(ConfigPayload):
    id: int

    class Config:
        from_attributes = True


class RunOut(BaseModel):
    id: int
    status: str
    run_type: str
    started_at: datetime
    finished_at: Optional[datetime] = None
    error_message: Optional[str] = None

    class Config:
        from_attributes = True


class RunDetail(RunOut):
    log_excerpt: Optional[str] = None
    config_snapshot: Optional[str] = None


class RunCreate(BaseModel):
    run_type: str = "apply"
    run_input: Optional[Any] = None


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


class RecruiterContactOut(BaseModel):
    id: int
    name: Optional[str] = None
    headline: Optional[str] = None
    company: Optional[str] = None
    location: Optional[str] = None
    email: Optional[str] = None
    linkedin_profile_url: str

    class Config:
        from_attributes = True


class OutreachEventOut(BaseModel):
    id: int
    run_id: int
    role: Optional[str] = None
    company_filter: Optional[str] = None
    search_context: Optional[str] = None
    message_input: Optional[str] = None
    message_sent: Optional[str] = None
    used_ai: bool = False
    action_type: str
    status: str
    reason: Optional[str] = None
    recruiter_profile_url: Optional[str] = None
    recruiter_email: Optional[str] = None
    sent_at: Optional[datetime] = None
    created_at: datetime
    recruiter_contact: Optional[RecruiterContactOut] = None

    class Config:
        from_attributes = True


class OutreachesList(BaseModel):
    items: List[OutreachEventOut]
    total: int
