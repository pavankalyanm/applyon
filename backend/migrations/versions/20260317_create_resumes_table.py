"""create resumes table and migrate legacy resume metadata

Revision ID: 20260317_resumes_table
Revises: 20260317_job_pipeline
Create Date: 2026-03-17
"""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path

from alembic import op
import sqlalchemy as sa


revision = "20260317_resumes_table"
down_revision = "20260317_job_pipeline"
branch_labels = None
depends_on = None


def _parse_created_at(value: str | None) -> datetime:
    if not value:
        return datetime.utcnow()
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).replace(tzinfo=None)
    except Exception:
        return datetime.utcnow()


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    table_names = set(inspector.get_table_names())

    if "resumes" not in table_names:
        op.create_table(
            "resumes",
            sa.Column("id", sa.String(length=36), nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("label", sa.String(length=255), nullable=False),
            sa.Column("path", sa.Text(), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_resumes_id"), "resumes", ["id"], unique=False)
        op.create_index(op.f("ix_resumes_user_id"), "resumes", ["user_id"], unique=False)

    if "configs" not in table_names:
        return

    configs_columns = {column["name"] for column in inspector.get_columns("configs")}
    if "resume" not in configs_columns:
        return

    existing_resume_ids = {
        row[0]
        for row in bind.execute(sa.text("SELECT id FROM resumes")).fetchall()
    }

    rows = bind.execute(sa.text("SELECT id, user_id, resume FROM configs WHERE resume IS NOT NULL")).fetchall()
    for config_id, user_id, raw_resume in rows:
        try:
            data = json.loads(raw_resume)
        except Exception:
            continue
        if not isinstance(data, dict):
            continue

        items = data.get("items")
        if isinstance(items, list):
            for item in items:
                if not isinstance(item, dict):
                    continue
                resume_id = str(item.get("id") or "").strip()
                path = str(item.get("path") or "").strip()
                if not resume_id or not path or resume_id in existing_resume_ids:
                    continue
                label = str(item.get("label") or Path(path).name or "Resume").strip() or "Resume"
                created_at = _parse_created_at(item.get("created_at"))
                bind.execute(
                    sa.text(
                        """
                        INSERT INTO resumes (id, user_id, label, path, created_at, updated_at)
                        VALUES (:id, :user_id, :label, :path, :created_at, :updated_at)
                        """
                    ),
                    {
                        "id": resume_id,
                        "user_id": user_id,
                        "label": label,
                        "path": path,
                        "created_at": created_at,
                        "updated_at": created_at,
                    },
                )
                existing_resume_ids.add(resume_id)

        default_resume_id = data.get("default_resume_id")
        if not default_resume_id and isinstance(items, list) and items:
            first_item = items[0]
            if isinstance(first_item, dict):
                default_resume_id = first_item.get("id")

        bind.execute(
            sa.text("UPDATE configs SET resume = :resume WHERE id = :config_id"),
            {
                "config_id": config_id,
                "resume": json.dumps({"default_resume_id": default_resume_id}),
            },
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "resumes" not in inspector.get_table_names():
        return

    existing_indexes = {index["name"] for index in inspector.get_indexes("resumes")}
    if op.f("ix_resumes_user_id") in existing_indexes:
        op.drop_index(op.f("ix_resumes_user_id"), table_name="resumes")
    if op.f("ix_resumes_id") in existing_indexes:
        op.drop_index(op.f("ix_resumes_id"), table_name="resumes")
    op.drop_table("resumes")
