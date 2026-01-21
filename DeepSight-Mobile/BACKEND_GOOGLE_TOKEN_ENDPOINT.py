"""
=============================================================================
Google Token Authentication Endpoint for DeepSight Backend
=============================================================================

INSTRUCTIONS:
1. Copy this code to your backend repository (deep-sight-backend-v3)
2. Add it to your auth routes (e.g., app/routers/auth.py)
3. Install httpx if not already installed: pip install httpx
4. Redeploy your backend on Railway

This endpoint is REQUIRED for mobile app Google OAuth to work.
The mobile app gets a Google access token via expo-auth-session,
then exchanges it for your session tokens via this endpoint.

=============================================================================
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import httpx

# Adjust these imports to match your project structure
# from app.core.security import create_access_token, create_refresh_token
# from app.models.user import User
# from app.database import get_db
# from sqlalchemy.orm import Session


class GoogleTokenRequest(BaseModel):
    """Request body for Google token exchange"""
    access_token: str


# Add this route to your auth router
# If your auth routes are at /api/auth, the full path will be /api/auth/google/token

# @router.post("/google/token")
async def google_token_login(request: GoogleTokenRequest):
    """
    Exchange a Google access token for session tokens.

    Mobile OAuth Flow:
    1. Mobile app uses expo-auth-session to get Google access_token
    2. Mobile app sends access_token to this endpoint
    3. We verify the token with Google's userinfo API
    4. We find or create the user in our database
    5. We return our session tokens and user info
    """

    # 1. Verify the Google access token
    async with httpx.AsyncClient() as client:
        response = await client.get(
            'https://www.googleapis.com/oauth2/v3/userinfo',
            headers={'Authorization': f'Bearer {request.access_token}'},
            timeout=10.0
        )

        if response.status_code != 200:
            raise HTTPException(
                status_code=401,
                detail="Invalid Google access token"
            )

        google_info = response.json()

    email = google_info.get('email')
    if not email:
        raise HTTPException(
            status_code=400,
            detail="Could not get email from Google account"
        )

    # 2. Find or create user in your database
    # REPLACE THIS with your actual database logic:
    #
    # user = db.query(User).filter(User.email == email).first()
    # if not user:
    #     user = User(
    #         email=email,
    #         username=google_info.get('name', email.split('@')[0]),
    #         google_id=google_info.get('sub'),
    #         profile_picture=google_info.get('picture'),
    #         email_verified=True,
    #         auth_provider='google'
    #     )
    #     db.add(user)
    #     db.commit()
    #     db.refresh(user)

    # 3. Generate your session tokens
    # REPLACE THIS with your actual token generation:
    #
    # access_token = create_access_token({"sub": str(user.id)})
    # refresh_token = create_refresh_token({"sub": str(user.id)})

    # 4. Return the response
    # REPLACE THIS with your actual response:
    #
    # return {
    #     "access_token": access_token,
    #     "refresh_token": refresh_token,
    #     "user": user.to_dict()
    # }

    # PLACEHOLDER - Remove this and use your actual implementation above
    raise HTTPException(status_code=501, detail="Endpoint not fully implemented")


# =============================================================================
# COMPLETE EXAMPLE (copy and adapt to your project):
# =============================================================================
"""
# In app/routers/auth.py (or wherever your auth routes are):

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
import httpx

from app.database import get_db
from app.models.user import User
from app.core.security import create_access_token, create_refresh_token

router = APIRouter(prefix="/auth", tags=["auth"])


class GoogleTokenRequest(BaseModel):
    access_token: str


@router.post("/google/token")
async def google_token_login(
    request: GoogleTokenRequest,
    db: Session = Depends(get_db)
):
    # Verify Google token
    async with httpx.AsyncClient() as client:
        response = await client.get(
            'https://www.googleapis.com/oauth2/v3/userinfo',
            headers={'Authorization': f'Bearer {request.access_token}'}
        )
        if response.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid Google token")
        google_info = response.json()

    email = google_info.get('email')
    if not email:
        raise HTTPException(status_code=400, detail="Email not found")

    # Find or create user
    user = db.query(User).filter(User.email == email).first()

    if not user:
        user = User(
            email=email,
            username=google_info.get('name', email.split('@')[0]),
            google_id=google_info.get('sub'),
            profile_picture=google_info.get('picture'),
            email_verified=True,
            auth_provider='google',
            plan='free',
            credits=100
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        # Update Google ID if not set
        if not user.google_id:
            user.google_id = google_info.get('sub')
            user.profile_picture = google_info.get('picture')
            db.commit()

    # Generate session tokens
    access_token = create_access_token(data={"sub": str(user.id)})
    refresh_token = create_refresh_token(data={"sub": str(user.id)})

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "user": {
            "id": str(user.id),
            "email": user.email,
            "username": user.username,
            "profile_picture": user.profile_picture,
            "plan": user.plan,
            "credits": user.credits,
            "email_verified": user.email_verified
        }
    }
"""
