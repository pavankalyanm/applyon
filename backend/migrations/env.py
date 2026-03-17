from logging.config import fileConfig
import os
import sys
from pathlib import Path
from dotenv import load_dotenv
from sqlalchemy import engine_from_config, pool
from alembic import context

BASE_DIR = Path(__file__).resolve().parents[1]
ENV_PATH = BASE_DIR / ".env"
if ENV_PATH.exists():
    load_dotenv(ENV_PATH)
sys.path.append(str(BASE_DIR.parent))  # add project root so `import backend` works

from backend import db, models  # noqa: E402

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Use the same metadata as the app
target_metadata = models.Base.metadata

def get_url() -> str:
    # Prefer DATABASE_URL env var (same as backend/db.py)
    return os.getenv("DATABASE_URL", db.DB_URL)


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well.  By skipping the Engine creation
    we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.

    """
    url = get_url() or config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode.

    In this scenario we need to create an Engine
    and associate a connection with the context.

    """
    config_section = config.get_section(config.config_ini_section, {}) or {}
    connectable = engine_from_config(
        {**config_section, "sqlalchemy.url": get_url() or config_section.get("sqlalchemy.url")},
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection, target_metadata=target_metadata
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
