import os

from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
from dotenv import load_dotenv
from alembic.config import Config as AlembicConfig
from alembic import command as alembic_command

from . import db, models, schemas
from .auth import get_current_user
from .routes_auth import router as auth_router
from .routes_config import router as config_router
from .routes_runs import router as runs_router
from .routes_jobs import router as jobs_router


BASE_DIR = Path(__file__).resolve().parent
env_path = BASE_DIR / ".env"
if env_path.exists():
    load_dotenv(env_path)

app = FastAPI(title="Auto Job Applier API")

# CORS for local + LAN frontend dev
# NOTE: We keep allow_credentials=True, so we can't use allow_origins=["*"].
cors_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]
extra_origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "").split(",") if o.strip()]
cors_origins.extend(extra_origins)
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    # Allow typical LAN dev origins (Vite default port 5173).
    allow_origin_regex=r"^http://(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(:5173)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    # Apply latest Alembic migrations (creates tables if missing, updates schema if changed)
    alembic_cfg = AlembicConfig(str(BASE_DIR / "alembic.ini"))
    alembic_command.upgrade(alembic_cfg, "head")


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/me", response_model=schemas.UserOut)
def me(current_user: models.User = Depends(get_current_user)):
    return current_user


app.include_router(auth_router)
app.include_router(config_router)
app.include_router(runs_router)
app.include_router(jobs_router)
