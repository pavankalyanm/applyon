import os
from contextlib import contextmanager
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base, Session


BASE_DIR = Path(__file__).resolve().parent
ENV_PATH = BASE_DIR / ".env"
if ENV_PATH.exists():
    load_dotenv(ENV_PATH)


DB_URL = os.getenv(
    "DATABASE_URL",
    # Example: mysql+pymysql://user:password@localhost:3306/auto_job_applier
    "mysql+pymysql://root:@localhost:3306/easy-apply",
)

engine = create_engine(DB_URL, echo=False, future=True)
SessionLocal = sessionmaker(
    bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)

Base = declarative_base()


def get_session() -> Session:
    return SessionLocal()


@contextmanager
def session_scope() -> Session:
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
