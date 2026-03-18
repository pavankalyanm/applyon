from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from .db import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), nullable=False, unique=True, index=True)
    password_hash = Column(String(255), nullable=False)
    name = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow,
                        onupdate=datetime.utcnow, nullable=False)

    configs = relationship("Config", back_populates="user", uselist=False)
    runs = relationship("Run", back_populates="user")
    job_applications = relationship("JobApplication", back_populates="user")
    resumes = relationship("Resume", back_populates="user")


class Config(Base):
    """
    Stores serialized versions of existing config/*.py for each user.
    """

    __tablename__ = "configs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"),
                     nullable=False, unique=True)

    personals = Column(Text, nullable=True)  # JSON string
    questions = Column(Text, nullable=True)
    search = Column(Text, nullable=True)
    settings = Column(Text, nullable=True)
    resume = Column(Text, nullable=True)
    other = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow,
                        onupdate=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="configs")


class Run(Base):
    __tablename__ = "runs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"),
                     nullable=False, index=True)

    # pending/running/stopping/stopped/success/failed
    status = Column(String(20), nullable=False, default="pending")
    started_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    finished_at = Column(DateTime, nullable=True)
    pid = Column(Integer, nullable=True)
    stop_requested_at = Column(DateTime, nullable=True)
    killed_at = Column(DateTime, nullable=True)

    config_snapshot = Column(Text, nullable=True)  # JSON
    log_excerpt = Column(Text, nullable=True)
    error_message = Column(Text, nullable=True)

    user = relationship("User", back_populates="runs")
    job_applications = relationship("JobApplication", back_populates="run")


class Resume(Base):
    __tablename__ = "resumes"

    id = Column(String(36), primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    label = Column(String(255), nullable=False)
    path = Column(Text, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow,
                        onupdate=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="resumes")


class JobApplication(Base):
    __tablename__ = "job_applications"

    id = Column(Integer, primary_key=True, index=True)
    run_id = Column(Integer, ForeignKey("runs.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"),
                     nullable=False, index=True)

    job_id = Column(String(64), nullable=True, index=True)
    title = Column(String(255), nullable=True)
    company = Column(String(255), nullable=True)
    location = Column(String(255), nullable=True)
    work_style = Column(String(255), nullable=True)

    date_posted = Column(DateTime, nullable=True)
    date_applied = Column(DateTime, nullable=True)

    # easy_apply / external
    application_type = Column(String(20), nullable=True)
    application_provider = Column(String(50), nullable=True)
    application_stage = Column(String(30), nullable=True)
    review_required = Column(Boolean, nullable=False, default=False)
    status = Column(String(20), nullable=False,
                    default="applied")  # applied/skipped/failed
    # applied/assessment/interview/rejected
    pipeline_status = Column(String(20), nullable=False, default="applied")
    reason_skipped = Column(Text, nullable=True)

    job_link = Column(Text, nullable=True)
    external_link = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow,
                        onupdate=datetime.utcnow, nullable=False)

    run = relationship("Run", back_populates="job_applications")
    user = relationship("User", back_populates="job_applications")
