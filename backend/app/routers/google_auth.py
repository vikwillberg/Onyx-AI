"""Google OAuth2 login flow.

Requires GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.
The redirect URI must be registered in Google Cloud Console.
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from sqlmodel import Session, select

from app.core.config import settings
from app.core.security import create_access_token
from app.db import get_session
from app.models import User

router = APIRouter()

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"


@router.get("/google/login")
def google_login(request: Request):
    """Redirect user to Google OAuth consent screen."""
    if not settings.google_client_id:
        raise HTTPException(status_code=501, detail="Google OAuth not configured")

    redirect_uri = settings.google_redirect_uri or str(request.url_for("google_callback"))
    params = {
        "client_id": settings.google_client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "offline",
        "prompt": "select_account",
    }
    query = "&".join(f"{k}={v}" for k, v in params.items())
    return RedirectResponse(f"{GOOGLE_AUTH_URL}?{query}")


@router.get("/google/callback", name="google_callback")
async def google_callback(
    code: str,
    request: Request,
    session: Session = Depends(get_session),
):
    """Handle Google OAuth callback, create/find user, redirect with JWT."""
    import httpx

    if not settings.google_client_id or not settings.google_client_secret:
        raise HTTPException(status_code=501, detail="Google OAuth not configured")

    redirect_uri = settings.google_redirect_uri or str(request.url_for("google_callback"))

    # Exchange code for tokens
    async with httpx.AsyncClient() as client:
        token_resp = await client.post(GOOGLE_TOKEN_URL, data={
            "code": code,
            "client_id": settings.google_client_id,
            "client_secret": settings.google_client_secret,
            "redirect_uri": redirect_uri,
            "grant_type": "authorization_code",
        })
        if token_resp.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to exchange code for token")
        tokens = token_resp.json()

        # Get user info
        userinfo_resp = await client.get(GOOGLE_USERINFO_URL, headers={
            "Authorization": f"Bearer {tokens['access_token']}"
        })
        if userinfo_resp.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to fetch user info")
        userinfo = userinfo_resp.json()

    google_id = userinfo.get("id")
    email = userinfo.get("email")
    name = userinfo.get("name", "")

    if not email:
        raise HTTPException(status_code=400, detail="No email from Google")

    # Find existing user by google_id or email
    user = session.exec(select(User).where(User.google_id == google_id)).first()
    if not user:
        user = session.exec(select(User).where(User.email == email)).first()

    if user:
        # Update google_id and display_name if needed
        if not user.google_id:
            user.google_id = google_id
        if name and not user.display_name:
            user.display_name = name
        session.add(user)
        session.commit()
        session.refresh(user)
    else:
        # Create new user
        user = User(
            email=email,
            google_id=google_id,
            display_name=name,
            hashed_password="",  # Google users don't have a password
        )
        session.add(user)
        session.commit()
        session.refresh(user)

    # Create JWT and redirect to frontend
    access_token = create_access_token(str(user.id))
    return RedirectResponse(f"/?token={access_token}")
