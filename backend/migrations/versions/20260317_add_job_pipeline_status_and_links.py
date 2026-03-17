"""add job pipeline status and links

Revision ID: 20260317_job_pipeline
Revises:
Create Date: 2026-03-17
"""

from alembic import op
import sqlalchemy as sa


revision = "20260317_job_pipeline"
down_revision = "20260317_runs_worker_fields"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "job_applications" not in inspector.get_table_names():
        return

    existing_columns = {column["name"] for column in inspector.get_columns("job_applications")}
    added_pipeline_status = False

    if "pipeline_status" not in existing_columns:
        op.add_column(
            "job_applications",
            sa.Column("pipeline_status", sa.String(length=20), nullable=False, server_default="applied"),
        )
        added_pipeline_status = True

    if "job_link" not in existing_columns:
        op.add_column("job_applications", sa.Column("job_link", sa.Text(), nullable=True))

    if added_pipeline_status:
        op.execute(
            """
            UPDATE job_applications
            SET pipeline_status = CASE
                WHEN status = 'failed' THEN 'rejected'
                ELSE 'applied'
            END
            """
        )
        op.alter_column("job_applications", "pipeline_status", server_default=None)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "job_applications" not in inspector.get_table_names():
        return

    existing_columns = {column["name"] for column in inspector.get_columns("job_applications")}
    if "job_link" in existing_columns:
        op.drop_column("job_applications", "job_link")
    if "pipeline_status" in existing_columns:
        op.drop_column("job_applications", "pipeline_status")
