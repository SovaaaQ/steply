from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_client_today, get_current_user
from app.core.rate_limit import is_rate_limited
from app.core.security import create_access_token, get_password_hash, verify_password
from app.db.session import get_db
from app.models import User
from app.schemas import AuthResponse, UserCreate, UserLogin, UserRead
from app.services.gamification import refresh_user_gamification

router = APIRouter(prefix="/auth", tags=["auth"])

AUTH_RATE_LIMIT_WINDOW_SECONDS = 300
LOGIN_RATE_LIMIT = 10
REGISTER_RATE_LIMIT = 5


def build_auth_response(user: User) -> AuthResponse:
    return AuthResponse(
        access_token=create_access_token(user.id),
        user=UserRead.model_validate(user),
    )


def _client_host(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def _check_auth_rate_limit(
    request: Request,
    *,
    scope: str,
    email: str,
    limit: int,
) -> None:
    key = f"{scope}:{_client_host(request)}:{email.lower()}"
    if is_rate_limited(key, limit=limit, window_seconds=AUTH_RATE_LIMIT_WINDOW_SECONDS):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many authentication attempts. Try again later",
        )


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def register(
    payload: UserCreate,
    request: Request,
    db: Session = Depends(get_db),
    client_today: date = Depends(get_client_today),
) -> AuthResponse:
    _check_auth_rate_limit(
        request,
        scope="register",
        email=payload.email,
        limit=REGISTER_RATE_LIMIT,
    )
    existing_user = db.scalar(select(User).where(User.email == payload.email.lower()))
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User with this email already exists",
        )

    user = User(
        email=payload.email.lower(),
        full_name=payload.full_name,
        hashed_password=get_password_hash(payload.password),
    )
    db.add(user)
    db.flush()
    refresh_user_gamification(db, user, today=client_today)
    db.commit()
    db.refresh(user)
    return build_auth_response(user)


@router.post("/login", response_model=AuthResponse)
def login(payload: UserLogin, request: Request, db: Session = Depends(get_db)) -> AuthResponse:
    _check_auth_rate_limit(
        request,
        scope="login",
        email=payload.email,
        limit=LOGIN_RATE_LIMIT,
    )
    user = db.scalar(select(User).where(User.email == payload.email.lower()))
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    return build_auth_response(user)


@router.get("/me", response_model=UserRead)
def me(current_user: User = Depends(get_current_user)) -> User:
    return current_user
