from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from . import db, models
from .auth import hash_password, verify_password, create_access_token, get_current_user


router = APIRouter(prefix="/auth", tags=["auth"])


class SignupIn(BaseModel):
    email: EmailStr
    password: str
    name: str | None = None


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


@router.post("/signup", response_model=TokenOut)
def signup(payload: SignupIn, session: Session = Depends(db.get_session)):
    existing = session.query(models.User).filter(models.User.email == payload.email).one_or_none()
    if existing is not None:
        raise HTTPException(status_code=400, detail="Email already registered")

    user = models.User(
        email=payload.email,
        password_hash=hash_password(payload.password),
        name=payload.name,
    )
    session.add(user)
    session.commit()
    session.refresh(user)

    token = create_access_token(user_id=user.id, email=user.email)
    return TokenOut(access_token=token)


@router.post("/login", response_model=TokenOut)
def login(payload: LoginIn, session: Session = Depends(db.get_session)):
    user = session.query(models.User).filter(models.User.email == payload.email).one_or_none()
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    token = create_access_token(user_id=user.id, email=user.email)
    return TokenOut(access_token=token)


@router.get("/me")
def me(current_user: models.User = Depends(get_current_user)):
    return {"id": current_user.id, "email": current_user.email, "name": current_user.name}

