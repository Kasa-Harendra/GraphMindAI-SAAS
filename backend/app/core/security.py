import logging
from typing import Optional
from fastapi import Request, HTTPException, Security
from fastapi.security import APIKeyCookie
from app.core.db import db
from app.core.config import settings
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

# NextAuth stores the session token in this cookie
# In production with HTTPS, it's usually prefixed with __Secure-
cookie_scheme = APIKeyCookie(name="next-auth.session-token", auto_error=False)
secure_cookie_scheme = APIKeyCookie(name="__Secure-next-auth.session-token", auto_error=False)

async def get_current_user(
    request: Request,
    token: Optional[str] = Security(cookie_scheme),
    secure_token: Optional[str] = Security(secure_cookie_scheme)
):
    """
    Extracts the NextAuth session token from cookies, validates it against MongoDB,
    and returns the corresponding User.
    """
    session_token = secure_token or token
    
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated. Missing session token.")

    if not db.mongo:
        raise HTTPException(status_code=503, detail="Database not available")

    # Get database instance
    mongo_db = db.mongo[settings.MONGODB_DB_NAME]

    # Find the session
    session = await mongo_db.sessions.find_one({"sessionToken": session_token})
    
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session token.")
        
    # Check expiry (NextAuth saves expires as Date object)
    expires = session.get("expires")
    if expires and expires.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired.")

    # Find the user
    user = await mongo_db.users.find_one({"_id": session["userId"]})
    
    if not user:
        raise HTTPException(status_code=401, detail="User not found.")

    return user
