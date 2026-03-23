"""restore runs worker fields revision

Revision ID: 20260317_runs_worker_fields
Revises:
Create Date: 2026-03-17
"""

from alembic import op
import sqlalchemy as sa


revision = "20260317_runs_worker_fields"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "runs" not in inspector.get_table_names():
        return

    existing_columns = {column["name"]
                        for column in inspector.get_columns("runs")}
    run_columns = [
        ("pid", sa.Column("pid", sa.Integer(), nullable=True)),
        ("stop_requested_at", sa.Column(
            "stop_requested_at", sa.DateTime(), nullable=True)),
        ("killed_at", sa.Column("killed_at", sa.DateTime(), nullable=True)),
        ("config_snapshot", sa.Column("config_snapshot", sa.Text(), nullable=True)),
        ("log_excerpt", sa.Column("log_excerpt", sa.Text(), nullable=True)),
        ("error_message", sa.Column("error_message", sa.Text(), nullable=True)),
        ("worker_id", sa.Column("worker_id", sa.String(length=255), nullable=True)),
        ("worker_name", sa.Column("worker_name", sa.String(length=255), nullable=True)),
        ("worker_ip", sa.Column("worker_ip", sa.String(length=64), nullable=True)),
        ("worker_last_seen_at", sa.Column(
            "worker_last_seen_at", sa.DateTime(), nullable=True)),
    ]

    for column_name, column in run_columns:
        if column_name not in existing_columns:
            op.add_column("runs", column)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "runs" not in inspector.get_table_names():
        return

    existing_columns = {column["name"]
                        for column in inspector.get_columns("runs")}
    for column_name in [
        "worker_last_seen_at",
        "worker_ip",
        "worker_name",
        "worker_id",
        "error_message",
        "log_excerpt",
        "config_snapshot",
        "killed_at",
        "stop_requested_at",
        "pid",
    ]:
        if column_name in existing_columns:
            op.drop_column("runs", column_name)
