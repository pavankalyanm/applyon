"""add external_page_contexts table

Revision ID: 20260318_context_ai
Revises: 20260318_outreach
Create Date: 2026-03-18

"""
from alembic import op
import sqlalchemy as sa

revision = "20260318_context_ai"
down_revision = "20260318_outreach"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    table_names = set(inspector.get_table_names())

    if "external_page_contexts" in table_names:
        return

    op.create_table(
        "external_page_contexts",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("domain", sa.String(length=255), nullable=False),
        sa.Column("page_fingerprint", sa.String(length=64), nullable=False),
        sa.Column("dom_snapshot", sa.JSON(), nullable=False),
        sa.Column("ai_instructions", sa.JSON(), nullable=False),
        sa.Column("times_used", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_seen_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "domain", "page_fingerprint"),
    )
    op.create_index(
        op.f("ix_external_page_contexts_id"),
        "external_page_contexts",
        ["id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_external_page_contexts_user_id"),
        "external_page_contexts",
        ["user_id"],
        unique=False,
    )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    table_names = set(inspector.get_table_names())

    if "external_page_contexts" not in table_names:
        return

    op.drop_index(
        op.f("ix_external_page_contexts_user_id"),
        table_name="external_page_contexts",
    )
    op.drop_index(
        op.f("ix_external_page_contexts_id"),
        table_name="external_page_contexts",
    )
    op.drop_table("external_page_contexts")
