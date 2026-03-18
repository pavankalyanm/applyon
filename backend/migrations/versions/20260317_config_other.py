"""add configs.other for learned answers

Revision ID: 20260317_config_other
Revises: 20260317_external_apply_metadata
Create Date: 2026-03-17
"""

from alembic import op
import sqlalchemy as sa


revision = "20260317_config_other"
down_revision = "20260317_external_apply_metadata"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "configs" not in inspector.get_table_names():
        return
    existing_columns = {column["name"] for column in inspector.get_columns("configs")}
    if "other" not in existing_columns:
        op.add_column("configs", sa.Column("other", sa.Text(), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "configs" not in inspector.get_table_names():
        return
    existing_columns = {column["name"] for column in inspector.get_columns("configs")}
    if "other" in existing_columns:
        op.drop_column("configs", "other")
