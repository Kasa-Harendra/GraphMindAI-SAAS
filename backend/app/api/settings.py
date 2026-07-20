"""
Settings API — GET/PUT for user-scoped LLM provider configuration.
Settings are persisted in MongoDB `user_settings` collection.
"""
from typing import Optional
import os
import logging
from fastapi import APIRouter, Depends

from app.core.config import settings as global_settings, Settings
from app.core.security import get_current_user
from app.core.db import db, fetch_user_settings

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("", response_model=Settings)
async def get_settings(current_user: dict = Depends(get_current_user)):
    """Return current user settings, falling back to system defaults."""
    user_settings = await fetch_user_settings(current_user["_id"])
    
    # Merge user settings over global defaults
    merged_data = global_settings.model_dump()
    if not user_settings:
        # Default for new users
        merged_data["provider"] = "default"
        merged_data["chat_provider"] = "default"
    else:
        merged_data.update(user_settings)
        
    result = Settings(**merged_data)
    
    # Mask the API keys
    if result.api_key:
        result.api_key = "•" * 8 + result.api_key[-4:] if len(result.api_key) > 4 else "••••"
    if result.chat_api_key:
        result.chat_api_key = "•" * 8 + result.chat_api_key[-4:] if len(result.chat_api_key) > 4 else "••••"
        
    return result


@router.put("", response_model=Settings)
async def save_settings(body: Settings, current_user: dict = Depends(get_current_user)):
    """Persist updated settings to user_settings in MongoDB."""
    new_data = body.model_dump()
    user_settings = await fetch_user_settings(current_user["_id"])

    # If user submitted a masked key, keep the existing one
    if new_data.get("api_key") and new_data["api_key"].startswith("•"):
        new_data["api_key"] = user_settings.get("api_key", global_settings.api_key)
        
    if new_data.get("chat_api_key") and new_data["chat_api_key"].startswith("•"):
        new_data["chat_api_key"] = user_settings.get("chat_api_key", global_settings.chat_api_key)

    # Persist to MongoDB
    db_name = global_settings.MONGODB_DB_NAME
    await db.mongo[db_name]["user_settings"].update_one(
        {"_id": current_user["_id"]},
        {"$set": {"settings": new_data}},
        upsert=True
    )

    # Return the updated masked settings
    result = Settings(**new_data)
    if result.api_key:
        result.api_key = "•" * 8 + result.api_key[-4:] if len(result.api_key) > 4 else "••••"
    if result.chat_api_key:
        result.chat_api_key = "•" * 8 + result.chat_api_key[-4:] if len(result.chat_api_key) > 4 else "••••"
        
    return result
