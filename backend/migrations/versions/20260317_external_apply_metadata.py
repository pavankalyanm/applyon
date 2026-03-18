"""add external apply metadata columns

Revision ID: 20260317_external_apply_metadata
Revises: 20260317_resumes_table
Create Date: 2026-03-17
"""

from alembic import op
import sqlalchemy as sa


revision = "20260317_external_apply_metadata"
down_revision = "20260317_resumes_table"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "job_applications" not in inspector.get_table_names():
        return

    existing_columns = {column["name"] for column in inspector.get_columns("job_applications")}
    has_provider = "application_provider" in existing_columns
    has_stage = "application_stage" in existing_columns
    has_review = "review_required" in existing_columns

    if not has_provider:
        op.add_column("job_applications", sa.Column("application_provider", sa.String(length=50), nullable=True))
        has_provider = True
    if not has_stage:
        op.add_column("job_applications", sa.Column("application_stage", sa.String(length=30), nullable=True))
        has_stage = True
    if not has_review:
        op.add_column(
            "job_applications",
            sa.Column("review_required", sa.Boolean(), nullable=False, server_default=sa.false()),
        )
        op.alter_column("job_applications", "review_required", server_default=None)
        has_review = True

    if has_provider:
        op.execute(
            """
            UPDATE job_applications
            SET application_provider = CASE
                WHEN application_type = 'easy_apply' OR external_link IS NULL OR external_link = 'Easy Applied'
                    THEN 'linkedin_easy_apply'
                ELSE 'external'
            END
            WHERE application_provider IS NULL
            """
        )
    if has_stage:
        op.execute(
            """
            UPDATE job_applications
            SET application_stage = CASE
                WHEN status = 'failed' THEN 'failed'
                ELSE 'submitted'
            END
            WHERE application_stage IS NULL
            """
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "job_applications" not in inspector.get_table_names():
        return

    existing_columns = {column["name"] for column in inspector.get_columns("job_applications")}
    if "review_required" in existing_columns:
        op.drop_column("job_applications", "review_required")
    if "application_stage" in existing_columns:
        op.drop_column("job_applications", "application_stage")
    if "application_provider" in existing_columns:
        op.drop_column("job_applications", "application_provider")
