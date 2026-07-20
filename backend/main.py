import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.core.db import connect_to_databases, close_database_connections, db
from app.api import documents, chat, graphs, settings, analytics, notifications

# Setup basic logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await connect_to_databases()
    yield
    # Shutdown
    await close_database_connections()

app = FastAPI(
    title="GraphMind AI API",
    description="Enterprise Multimodal Knowledge Graph Intelligence Platform",
    version="2.0.0",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"], # Must be exact for credentials
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "GraphMind AI API Gateway is running"}

from fastapi import Depends
from app.core.security import get_current_user

app.include_router(documents.router, prefix="/api/v1/documents", tags=["Documents"], dependencies=[Depends(get_current_user)])
app.include_router(chat.router,      prefix="/api/v1/chat",      tags=["Chat"], dependencies=[Depends(get_current_user)])
app.include_router(graphs.router,    prefix="/api/v1/graphs",    tags=["Graphs"], dependencies=[Depends(get_current_user)])
app.include_router(settings.router,  prefix="/api/v1/settings",  tags=["Settings"], dependencies=[Depends(get_current_user)])
app.include_router(analytics.router, prefix="/api/v1/analytics", tags=["Analytics"], dependencies=[Depends(get_current_user)])
app.include_router(notifications.router, prefix="/api/v1/notifications", tags=["Notifications"], dependencies=[Depends(get_current_user)])

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

@app.get("/health/dbs", tags=["Health"])
async def db_health_check():
    """Verify connections to MongoDB and Redis."""
    status = {
        "mongodb": "disconnected",
        "redis": "disconnected"
    }
    
    try:
        # MongoDB
        if db.mongo:
            await db.mongo.admin.command('ping')
            status["mongodb"] = "connected"
            
        # Redis
        if db.redis:
            db.redis.ping()
            status["redis"] = "connected"
            
    except Exception as e:
        logger.error(f"Database health check failed: {str(e)}")
        raise HTTPException(status_code=503, detail={"status": "degraded", "services": status, "error": str(e)})

    return {"status": "all systems operational", "services": status}
