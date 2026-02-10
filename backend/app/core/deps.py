from typing import Optional
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from app.core.config import settings
from app.core.security import hash_password
from app.db import get_session
from app.models import User


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)

GUEST_EMAIL = "guest@clarity.local"


def get_or_create_guest_user(session: Session) -> User:
    user = session.exec(select(User).where(User.email == GUEST_EMAIL)).first()
    if user:
        return user
    user = User(email=GUEST_EMAIL, hashed_password=hash_password("guest"))
    session.add(user)
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        existing = session.exec(select(User).where(User.email == GUEST_EMAIL)).first()
        if existing:
            return existing
        raise
    session.refresh(user)
    return user


def get_current_user(
    token: Optional[str] = Depends(oauth2_scheme),
    session: Session = Depends(get_session),
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not token:
        return get_or_create_guest_user(session)
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
        subject = payload.get("sub")
        if not subject:
            raise credentials_exception
        user_id = UUID(subject)
    except (JWTError, ValueError):
        raise credentials_exception

    user = session.exec(select(User).where(User.id == user_id)).first()
    if not user:
        raise credentials_exception
    return user
