import os

from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse
from pathlib import Path
from dotenv import load_dotenv

from . import db, models, schemas
from .auth import get_current_user
from .routes_auth import router as auth_router
from .routes_config import router as config_router
from .routes_runs import router as runs_router
from .routes_jobs import router as jobs_router
from .routes_resumes import router as resumes_router
from .routes_outreaches import router as outreaches_router
from .routes_agent import router as agent_router


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


INSTALL_SCRIPT = Path(__file__).resolve().parents[1] / "install.sh"
INSTALL_BAT = Path(__file__).resolve().parents[1] / "install.bat"


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/install", response_class=PlainTextResponse)
def get_install_script():
    """Serve the Jobcook install script for macOS/Linux. Usage: curl -sSL https://applyflowai.com/install | sh"""
    if not INSTALL_SCRIPT.exists():
        return PlainTextResponse("Install script not found.", status_code=404)
    return PlainTextResponse(
        INSTALL_SCRIPT.read_text(),
        media_type="text/x-shellscript",
        headers={"Content-Disposition": "inline; filename=install.sh"},
    )


@app.get("/install.bat", response_class=PlainTextResponse)
def get_install_bat():
    """Serve the Jobcook install script for Windows CMD."""
    if not INSTALL_BAT.exists():
        return PlainTextResponse("Install script not found.", status_code=404)
    return PlainTextResponse(
        INSTALL_BAT.read_text(),
        media_type="text/plain",
        headers={"Content-Disposition": "attachment; filename=install.bat"},
    )


@app.get("/me", response_model=schemas.UserOut)
def me(current_user: models.User = Depends(get_current_user)):
    return current_user


app.include_router(auth_router)
app.include_router(config_router)
app.include_router(runs_router)
app.include_router(jobs_router)
app.include_router(resumes_router)
app.include_router(outreaches_router)
app.include_router(agent_router)
