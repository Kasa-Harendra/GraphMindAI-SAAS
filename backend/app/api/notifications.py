import asyncio
import json
import logging
from typing import List, Optional
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.core.security import get_current_user
from app.core.db import db

router = APIRouter()
logger = logging.getLogger(__name__)

async def notification_generator(user_id: str):
    """
    Async generator that listens to the user's specific Redis channel and yields SSE events.
    """
    channel_name = f"user:notifications:{user_id}"
    
    if not db.redis:
        logger.error("Redis is not connected; cannot stream notifications.")
        yield f"data: {json.dumps({'type': 'ERROR', 'message': 'Redis disconnected'})}\n\n"
        return

    pubsub = db.redis.pubsub()
    await pubsub.subscribe(channel_name)
    logger.info(f"User {user_id} subscribed to notifications on channel: {channel_name}")

    try:
        # Initial connection success message
        yield f"data: {json.dumps({'type': 'CONNECTED', 'message': 'Listening for notifications...'})}\n\n"
        
        async for message in pubsub.listen():
            if message["type"] == "message":
                data = message["data"]
                # Send the data as an SSE event
                yield f"data: {data}\n\n"
    except asyncio.CancelledError:
        logger.info(f"Notification stream cancelled by client {user_id}")
    except Exception as e:
        logger.error(f"Error in notification stream for {user_id}: {e}")
    finally:
        await pubsub.unsubscribe(channel_name)
        await pubsub.close()
        logger.info(f"Closed notification stream for {user_id}")

@router.get("/stream")
async def stream_notifications(current_user: dict = Depends(get_current_user)):
    """SSE endpoint for real-time notifications."""
    user_id = current_user["_id"]
    return StreamingResponse(
        notification_generator(user_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )

class NotificationResponse(BaseModel):
    id: str
    type: str
    message: str
    status: Optional[str] = None
    doc_id: Optional[str] = None
    timestamp: int
    read: bool

@router.get("/", response_model=List[NotificationResponse])
async def get_notifications(current_user: dict = Depends(get_current_user)):
    """Fetch the latest 50 notifications for the current user."""
    user_id = current_user["_id"]
    from app.core.config import settings
    
    cursor = db.mongo[settings.MONGODB_DB_NAME]["notifications"].find({"user_id": user_id}).sort("created_at", -1).limit(50)
    docs = await cursor.to_list(length=50)
    
    result = []
    for doc in docs:
        result.append(NotificationResponse(
            id=str(doc["_id"]),
            type=doc.get("type", "INFO"),
            message=doc.get("message", ""),
            status=doc.get("status"),
            doc_id=doc.get("doc_id"),
            timestamp=int(doc["created_at"].timestamp() * 1000) if "created_at" in doc else 0,
            read=doc.get("read", False)
        ))
    return result

@router.patch("/mark-read")
async def mark_notifications_read(current_user: dict = Depends(get_current_user)):
    """Mark all notifications as read for the current user."""
    user_id = current_user["_id"]
    from app.core.config import settings
    
    await db.mongo[settings.MONGODB_DB_NAME]["notifications"].update_many(
        {"user_id": user_id, "read": False},
        {"$set": {"read": True}}
    )
    return {"status": "success"}
