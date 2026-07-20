import os
import asyncio
import logging
from celery import Celery
from celery.signals import (
    after_setup_logger,
    after_setup_task_logger,
    setup_logging,
    task_failure,
    task_postrun,
    task_prerun,
    task_success,
)

@setup_logging.connect
def config_loggers(*args, **kwargs):
    logger = logging.getLogger()
    logger.setLevel(logging.INFO)
    
    formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    
    # Console handler
    ch = logging.StreamHandler()
    ch.setFormatter(formatter)
    logger.addHandler(ch)
    
    # File handler
    fh = logging.FileHandler('celery.log')
    fh.setFormatter(formatter)
    logger.addHandler(fh)
    logging.getLogger("celery").setLevel(logging.INFO)
    logging.getLogger("celery.app.trace").setLevel(logging.INFO)


@after_setup_logger.connect
def configure_root_logger(logger, *args, **kwargs):
    logger.setLevel(logging.INFO)


@after_setup_task_logger.connect
def configure_task_logger(logger, *args, **kwargs):
    logger.setLevel(logging.INFO)

from app.core.config import settings
from app.core.db import connect_to_databases, close_database_connections, db
from app.services.document_processor import process_and_store_document
from app.services.graph_builder import extract_and_store_graph

# Initialize Celery
celery_app = Celery(
    "graphmind_worker",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    worker_hijack_root_logger=False,
    worker_redirect_stdouts=True,
    worker_redirect_stdouts_level="INFO",
)

logger = logging.getLogger(__name__)


@task_prerun.connect
def log_task_start(sender=None, task_id=None, args=None, kwargs=None, **extra):
    logger.info("Starting %s task_id=%s args=%s kwargs=%s", sender.name if sender else "unknown", task_id, args, kwargs)


@task_success.connect
def log_task_success(sender=None, result=None, **extra):
    logger.info("Finished %s successfully result=%s", sender.name if sender else "unknown", result)


@task_failure.connect
def log_task_failure(sender=None, task_id=None, exception=None, einfo=None, **extra):
    logger.exception(
        "Task %s failed task_id=%s error=%s",
        sender.name if sender else "unknown",
        task_id,
        exception,
    )


@task_postrun.connect
def log_task_end(sender=None, task_id=None, state=None, **extra):
    logger.info("Task %s ended task_id=%s state=%s", sender.name if sender else "unknown", task_id, state)

async def run_document_pipeline(doc_id: str, file_path: str, file_type: str, metadata_updates: dict = None, user_id: str = None):
    """
    Async wrapper to run the full document ingestion pipeline.
    """
    logger.info("Pipeline started for document %s file_type=%s file_path=%s user_id=%s", doc_id, file_type, file_path, user_id)
    await connect_to_databases()
    db_name = settings.MONGODB_DB_NAME
    
    try:
        # Update ingestion job status
        from datetime import datetime
        await db.mongo[db_name]["ingestion_jobs"].update_one(
            {"_id": doc_id},
            {"$set": {
                "graph_id": doc_id,
                "status": "processing",
                "started_at": datetime.utcnow(),
            }},
            upsert=True
        )
        logger.info("Marked ingestion job as processing for document %s", doc_id)
        
        # 1. Process and Store Document (Load -> Chunk -> Embed -> MongoDB)
        logger.info("Stage 1/2: processing and storing document %s", doc_id)
        logger.info(f"{file_path}", )
        
        num_chunks = await process_and_store_document(
            doc_id=doc_id,
            file_path=file_path,
            file_type=file_type,
            metadata_updates=metadata_updates
        )
        logger.info("Stage 1/2 complete for document %s chunks=%s", doc_id, num_chunks)
        
        # 2. Extract Graph (Chunks -> LLM -> graph_entities in MongoDB)
        logger.info("Stage 2/2: loading chunks for graph extraction document %s", doc_id)
        cursor = db.mongo[db_name]["graph_chunks"].find({"graph_id": doc_id}).sort("chunk_index", 1)
        chunks_data = await cursor.to_list(length=None)
        
        total_nodes = 0
        total_edges = 0
        if chunks_data:
            logger.info("Found %s chunks for graph extraction document %s", len(chunks_data), doc_id)
            from langchain_core.documents import Document
            docs = [Document(page_content=c["page_content"], metadata=c.get("metadata", {})) for c in chunks_data]
            
            # Execute graph extraction via MongoDBGraphStore
            total_nodes, total_edges = await extract_and_store_graph(docs, doc_id, metadata_updates, user_id)
        else:
            logger.info("No chunks found for graph extraction document %s", doc_id)
            
        # Update graph status to completed
        await db.mongo[db_name]["graphs"].update_one(
            {"_id": doc_id},
            {"$set": {
                "status": "completed",
                "node_count": total_nodes,
                "edge_count": total_edges
            }}
        )
        
        # Update ingestion job
        await db.mongo[db_name]["ingestion_jobs"].update_one(
            {"_id": doc_id},
            {"$set": {
                "status": "completed",
                "completed_at": datetime.utcnow()
            }}
        )
            
        logger.info(f"Pipeline completed successfully for document {doc_id}")
        
        if user_id and db.redis:
            import json
            from bson import ObjectId
            
            notif_doc = {
                "user_id": user_id,
                "type": "SUCCESS",
                "message": f"Knowledge graph extraction complete for document: {doc_id}",
                "doc_id": doc_id,
                "status": "completed",
                "read": False,
                "created_at": datetime.utcnow()
            }
            res = await db.mongo[db_name]["notifications"].insert_one(notif_doc)
            
            payload = json.dumps({
                "id": str(res.inserted_id),
                "type": "SUCCESS",
                "message": notif_doc["message"],
                "doc_id": doc_id,
                "status": "completed",
                "timestamp": int(notif_doc["created_at"].timestamp() * 1000)
            })
            await db.redis.publish(f"user:notifications:{user_id}", payload)
            logger.info(f"Published success notification for {user_id}")
            
    except Exception as e:
        error_msg = str(e)
        if "401" in error_msg or "authentication" in error_msg.lower():
            error_msg = "Authentication Error: Please check your API Key in Settings."
        elif "429" in error_msg or "rate limit" in error_msg.lower():
            error_msg = "Rate Limit Exceeded: You have hit the API limits for this provider."
        elif "not found" in error_msg.lower() or "model" in error_msg.lower():
            error_msg = f"Model Error: The requested model might be invalid or unavailable. Details: {str(e)}"
            
        logger.error(f"Pipeline failed for document {doc_id}: {error_msg}")
        from datetime import datetime
        await db.mongo[db_name]["graphs"].update_one(
            {"_id": doc_id},
            {"$set": {"status": "failed"}}
        )
        await db.mongo[db_name]["ingestion_jobs"].update_one(
            {"_id": doc_id},
            {"$set": {
                "status": "failed",
                "completed_at": datetime.utcnow(),
                "error": error_msg
            }}
        )
        
        if user_id and db.redis:
            import json
            from bson import ObjectId
            
            notif_doc = {
                "user_id": user_id,
                "type": "ERROR",
                "message": f"Knowledge graph extraction failed for document {doc_id}",
                "doc_id": doc_id,
                "status": "failed",
                "error": error_msg,
                "read": False,
                "created_at": datetime.utcnow()
            }
            res = await db.mongo[db_name]["notifications"].insert_one(notif_doc)
            
            payload = json.dumps({
                "id": str(res.inserted_id),
                "type": "ERROR",
                "message": notif_doc["message"],
                "doc_id": doc_id,
                "status": "failed",
                "error": error_msg,
                "timestamp": int(notif_doc["created_at"].timestamp() * 1000)
            })
            await db.redis.publish(f"user:notifications:{user_id}", payload)
            logger.info(f"Published failure notification for {user_id}")
            
    finally:
        await close_database_connections()

@celery_app.task(name="process_document_task")
def process_document_task(doc_id: str, file_path: str, file_type: str, metadata_updates: dict = None, user_id: str = None):
    """
    Celery task entrypoint for document processing.
    Runs the async pipeline inside an event loop.
    """
    logger.info(f"Received process_document_task for {doc_id}")
    asyncio.run(run_document_pipeline(doc_id, file_path, file_type, metadata_updates, user_id))
    return {"status": "success", "doc_id": doc_id}
