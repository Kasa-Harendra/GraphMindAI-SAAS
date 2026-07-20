import logging

# MongoDB
from motor.motor_asyncio import AsyncIOMotorClient

# Redis
import redis.asyncio as aioredis
from redis.asyncio import Redis as AsyncRedis

# Settings
from app.core.config import settings

logger = logging.getLogger(__name__)

# --- Database Clients ---
class DatabaseClients:
    mongo: AsyncIOMotorClient = None
    redis: AsyncRedis = None

db = DatabaseClients()

async def connect_to_databases():
    """Initialize connections to MongoDB and Redis."""
    logger.info("Connecting to databases...")

    # MongoDB
    db.mongo = AsyncIOMotorClient(settings.MONGODB_URI)
    
    # Assert TTL Index on notifications collection (7 days = 604800 seconds)
    import pymongo
    await db.mongo[settings.MONGODB_DB_NAME]["notifications"].create_index(
        [("created_at", pymongo.ASCENDING)],
        expireAfterSeconds=604800
    )

    # Redis
    db.redis = aioredis.from_url(settings.REDIS_URL, decode_responses=True)

    logger.info("Successfully connected to all databases.")

async def close_database_connections():
    """Close connections to all databases."""
    logger.info("Closing database connections...")

    if db.mongo:
        db.mongo.close()
    if db.redis:
        await db.redis.close()

    logger.info("All database connections closed.")

async def fetch_user_settings(user_id: str) -> dict:
    """Helper to fetch raw user settings from DB"""
    db_name = settings.MONGODB_DB_NAME
    if not db.mongo:
        return {}
    doc = await db.mongo[db_name]["user_settings"].find_one({"_id": user_id})
    return doc.get("settings", {}) if doc else {}
