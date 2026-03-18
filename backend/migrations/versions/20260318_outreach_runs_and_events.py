"""add outreach config, run typing, and outreach tables

Revision ID: 20260318_outreach
Revises: 20260317_config_other
Create Date: 2026-03-18
"""

from alembic import op
import sqlalchemy as sa


revision = "20260318_outreach"
down_revision = "20260317_config_other"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    if "configs" in tables:
        config_columns = {column["name"] for column in inspector.get_columns("configs")}
        if "outreach" not in config_columns:
            op.add_column("configs", sa.Column("outreach", sa.Text(), nullable=True))

    if "runs" in tables:
        run_columns = {column["name"] for column in inspector.get_columns("runs")}
        if "run_type" not in run_columns:
            op.add_column("runs", sa.Column("run_type", sa.String(length=30), nullable=False, server_default="apply"))
            op.alter_column("runs", "run_type", server_default=None)
        if "run_input" not in run_columns:
            op.add_column("runs", sa.Column("run_input", sa.Text(), nullable=True))

    if "recruiter_contacts" not in tables:
        op.create_table(
            "recruiter_contacts",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
            sa.Column("linkedin_profile_url", sa.Text(), nullable=False),
            sa.Column("linkedin_member_id", sa.String(length=128), nullable=True),
            sa.Column("name", sa.String(length=255), nullable=True),
            sa.Column("headline", sa.Text(), nullable=True),
            sa.Column("company", sa.String(length=255), nullable=True),
            sa.Column("location", sa.String(length=255), nullable=True),
            sa.Column("email", sa.String(length=255), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
        )
        op.create_index("ix_recruiter_contacts_user_id", "recruiter_contacts", ["user_id"])
        op.create_index("ix_recruiter_contacts_linkedin_member_id", "recruiter_contacts", ["linkedin_member_id"])

    if "outreach_events" not in tables:
        op.create_table(
            "outreach_events",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
            sa.Column("run_id", sa.Integer(), sa.ForeignKey("runs.id"), nullable=False),
            sa.Column("recruiter_contact_id", sa.Integer(), sa.ForeignKey("recruiter_contacts.id"), nullable=True),
            sa.Column("role", sa.String(length=255), nullable=True),
            sa.Column("company_filter", sa.String(length=255), nullable=True),
            sa.Column("search_context", sa.Text(), nullable=True),
            sa.Column("message_input", sa.Text(), nullable=True),
            sa.Column("message_sent", sa.Text(), nullable=True),
            sa.Column("used_ai", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("action_type", sa.String(length=50), nullable=False, server_default="message"),
            sa.Column("status", sa.String(length=30), nullable=False, server_default="drafted"),
            sa.Column("reason", sa.Text(), nullable=True),
            sa.Column("recruiter_profile_url", sa.Text(), nullable=True),
            sa.Column("recruiter_email", sa.String(length=255), nullable=True),
            sa.Column("sent_at", sa.DateTime(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
        )
        op.create_index("ix_outreach_events_user_id", "outreach_events", ["user_id"])
        op.create_index("ix_outreach_events_run_id", "outreach_events", ["run_id"])
        op.create_index("ix_outreach_events_recruiter_contact_id", "outreach_events", ["recruiter_contact_id"])


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    if "outreach_events" in tables:
        op.drop_index("ix_outreach_events_recruiter_contact_id", table_name="outreach_events")
        op.drop_index("ix_outreach_events_run_id", table_name="outreach_events")
        op.drop_index("ix_outreach_events_user_id", table_name="outreach_events")
        op.drop_table("outreach_events")

    if "recruiter_contacts" in tables:
        op.drop_index("ix_recruiter_contacts_linkedin_member_id", table_name="recruiter_contacts")
        op.drop_index("ix_recruiter_contacts_user_id", table_name="recruiter_contacts")
        op.drop_table("recruiter_contacts")

    if "runs" in tables:
        run_columns = {column["name"] for column in inspector.get_columns("runs")}
        if "run_input" in run_columns:
            op.drop_column("runs", "run_input")
        if "run_type" in run_columns:
            op.drop_column("runs", "run_type")

    if "configs" in tables:
        config_columns = {column["name"] for column in inspector.get_columns("configs")}
        if "outreach" in config_columns:
            op.drop_column("configs", "outreach")
