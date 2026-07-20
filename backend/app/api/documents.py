import os
import uuid
import shutil
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from app.core.db import db
from app.core.config import settings
from app.core.security import get_current_user
from app.worker import process_document_task
from datetime import datetime
from pydantic import BaseModel
from typing import Optional

class UploadUrlRequest(BaseModel):
    source_url: str
    source_type: str
    name: str
    extraction_level: Optional[str] = "Medium"
    focus_topic: Optional[str] = None

router = APIRouter()

# Directory to temporarily store uploads before Celery processes them
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    source_url: Optional[str] = Form(None),
    author: Optional[str] = Form(None),
    extraction_level: Optional[str] = Form("Medium"),
    focus_topic: Optional[str] = Form(None),
    current_user: dict = Depends(get_current_user)
):
    """
    Upload a document for ingestion. Supports PDFs, TXT, DOCX, etc.
    """
    print(f"Entering upload_document... filename={file.filename if file else 'None'}")
    doc_id = str(uuid.uuid4())
    
    # Save file to disk
    file_ext = file.filename.split('.')[-1].lower() if '.' in file.filename else "unknown"
    file_path = os.path.join(UPLOAD_DIR, f"{doc_id}_{file.filename}")
    
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not save file: {str(e)}")

    file_type = file_ext
    db_name = settings.MONGODB_DB_NAME
    
    # Create graph record in 'graphs' collection
    graph_doc = {
        "_id": doc_id,
        "name": file.filename,
        "source_type": file_type,
        "source_label": source_url or file.filename,
        "status": "processing",
        "node_count": 0,
        "edge_count": 0,
        "chunk_count": 0,
        "created_at": datetime.utcnow(),
        "author": author,
        "source_url": source_url,
        "filename": file.filename,
        "file_type": file_type,
        "user_id": current_user["_id"],
        "extraction_level": extraction_level,
        "focus_topic": focus_topic
    }
    
    await db.mongo[db_name]["graphs"].insert_one(graph_doc)
    
    # Store original document reference
    await db.mongo[db_name]["graph_documents"].insert_one({
        "_id": str(uuid.uuid4()),
        "graph_id": doc_id,
        "filename": file.filename,
        "file_type": file_type,
        "file_path": file_path,
        "source_url": source_url,
        "uploaded_at": datetime.utcnow()
    })
    
    # Dispatch to Celery
    task = process_document_task.delay(
        doc_id=doc_id,
        file_path=file_path,
        file_type=file_type,
        metadata_updates={
            "source_url": source_url, 
            "author": author,
            "extraction_level": extraction_level,
            "focus_topic": focus_topic
        },
        user_id=current_user["_id"]
    )
    
    await db.mongo[db_name]["graphs"].update_one(
        {"_id": doc_id},
        {"$set": {"celery_task_id": task.id}}
    )
    
    return {
        "id": doc_id,
        "filename": file.filename,
        "file_type": file_type,
        "source_url": source_url,
        "upload_date": graph_doc["created_at"].isoformat(),
        "status": "processing",
        "chunk_count": 0,
    }

@router.post("/upload-url")
async def upload_url(req: UploadUrlRequest, current_user: dict = Depends(get_current_user)):
    """
    Ingest a document from a URL (e.g. YouTube, GitHub, Web).
    """
    print(f"Entering upload_url... url={req.source_url}")
    doc_id = str(uuid.uuid4())
    db_name = settings.MONGODB_DB_NAME
    
    graph_doc = {
        "_id": doc_id,
        "name": req.name,
        "source_type": req.source_type,
        "source_label": req.source_url,
        "status": "processing",
        "node_count": 0,
        "edge_count": 0,
        "chunk_count": 0,
        "created_at": datetime.utcnow(),
        "source_url": req.source_url,
        "filename": req.name,
        "file_type": req.source_type,
        "user_id": current_user["_id"],
        "extraction_level": req.extraction_level,
        "focus_topic": req.focus_topic
    }
    
    await db.mongo[db_name]["graphs"].insert_one(graph_doc)
    
    # Dispatch to Celery (no file_path for URL ingestion)
    task = process_document_task.delay(
        doc_id=doc_id,
        file_path=req.source_url,
        file_type=req.source_type,
        metadata_updates={
            "source_url": req.source_url,
            "extraction_level": req.extraction_level,
            "focus_topic": req.focus_topic
        },
        user_id=current_user["_id"]
    )
    
    await db.mongo[db_name]["graphs"].update_one(
        {"_id": doc_id},
        {"$set": {"celery_task_id": task.id}}
    )
    
    return {"task_id": doc_id, "message": "URL ingestion started"}
