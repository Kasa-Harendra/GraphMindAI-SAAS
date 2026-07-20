"""
Graphs API — CRUD for knowledge graph metadata + MongoDB-based node/edge queries.
All data lives in MongoDB collections: graphs, graph_entities, graph_chunks, graph_embeddings.
"""
import uuid
import logging
from typing import List, Optional
from datetime import datetime

from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.core.db import db
from app.core.config import settings
from app.core.security import get_current_user

router = APIRouter()
logger = logging.getLogger(__name__)


class GraphCreate(BaseModel):
    name: str
    source_type: str
    source_label: str


class GraphRename(BaseModel):
    name: str


class GraphOut(BaseModel):
    id: str
    name: str
    source_type: str
    source_label: str
    status: str
    node_count: int
    edge_count: int
    created_at: str


def _doc_to_graph_out(d: dict) -> GraphOut:
    """Helper to convert a MongoDB graphs document to GraphOut response."""
    created_at = d.get("created_at")
    if isinstance(created_at, datetime):
        created_at_str = created_at.isoformat()
    elif created_at:
        created_at_str = str(created_at)
    else:
        created_at_str = datetime.utcnow().isoformat()

    return GraphOut(
        id=str(d.get("_id")),
        name=d.get("name", d.get("filename", "Untitled")),
        source_type=d.get("source_type", d.get("file_type", "unknown")),
        source_label=d.get("source_label", d.get("source_url", d.get("filename", ""))),
        status=d.get("status", "processing"),
        node_count=d.get("node_count", 0),
        edge_count=d.get("edge_count", 0),
        created_at=created_at_str
    )


@router.get("", response_model=List[GraphOut])
async def list_graphs(current_user: dict = Depends(get_current_user)):
    """List all knowledge graphs for the current user."""
    print("Entering list_graphs...")
    db_name = settings.MONGODB_DB_NAME
    docs = await db.mongo[db_name]["graphs"].find({"user_id": current_user["_id"]}).to_list(length=None)
    return [_doc_to_graph_out(d) for d in docs]


@router.get("/{graph_id}", response_model=GraphOut)
async def get_graph(graph_id: str, current_user: dict = Depends(get_current_user)):
    """Get a single knowledge graph."""
    print(f"Entering get_graph... graph_id={graph_id}")
    db_name = settings.MONGODB_DB_NAME
    doc = await db.mongo[db_name]["graphs"].find_one({"_id": graph_id, "user_id": current_user["_id"]})
    if not doc:
        raise HTTPException(status_code=404, detail="Graph not found")
    return _doc_to_graph_out(doc)


@router.patch("/{graph_id}", response_model=GraphOut)
async def rename_graph(graph_id: str, body: GraphRename):
    """Rename a knowledge graph."""
    print(f"Entering rename_graph... graph_id={graph_id}")
    db_name = settings.MONGODB_DB_NAME
    doc = await db.mongo[db_name]["graphs"].find_one({"_id": graph_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Graph not found")

    await db.mongo[db_name]["graphs"].update_one(
        {"_id": graph_id},
        {"$set": {"name": body.name, "filename": body.name}}
    )
    doc["name"] = body.name
    doc["filename"] = body.name
    return _doc_to_graph_out(doc)


@router.delete("/{graph_id}", status_code=204)
async def delete_graph(graph_id: str):
    """
    Delete a knowledge graph and ALL associated data from MongoDB.
    Cleans up: graphs, graph_entities, graph_chunks, graph_embeddings,
    graph_documents, graph_metadata, ingestion_jobs.
    """
    print(f"Entering delete_graph... graph_id={graph_id}")
    logger.info(f"Deleting all data for graph {graph_id}...")
    db_name = settings.MONGODB_DB_NAME

    doc = await db.mongo[db_name]["graphs"].find_one({"_id": graph_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Graph not found")

    # Cancel celery task if it exists
    celery_task_id = doc.get("celery_task_id")
    if celery_task_id and doc.get("status") == "processing":
        try:
            from app.worker import celery_app
            logger.info(f"Revoking celery task {celery_task_id} for graph {graph_id}")
            celery_app.control.revoke(celery_task_id, terminate=True, signal="SIGKILL")
        except Exception as e:
            logger.warning(f"Failed to revoke celery task {celery_task_id}: {e}")

    # Delete from all related collections
    collections_to_clean = [
        ("graph_entities", "graph_id"),
        ("graph_chunks", "graph_id"),
        ("graph_embeddings", "graph_id"),
        ("graph_documents", "graph_id"),
        ("graph_metadata", "graph_id"),
        ("ingestion_jobs", "graph_id"),
        ("graph_analytics", "graph_id"),
    ]

    for collection_name, field_name in collections_to_clean:
        try:
            result = await db.mongo[db_name][collection_name].delete_many({field_name: graph_id})
            if result.deleted_count > 0:
                logger.info(f"Deleted {result.deleted_count} docs from {collection_name}.")
        except Exception as e:
            logger.warning(f"Cleanup of {collection_name} failed (non-fatal): {e}")

    # Delete the graph record itself
    await db.mongo[db_name]["graphs"].delete_one({"_id": graph_id})
    logger.info(f"Successfully deleted graph {graph_id}.")


@router.get("/{graph_id}/nodes")
async def get_graph_nodes(graph_id: str, limit: int = 200):
    """Fetch nodes for a graph from graph_entities collection."""
    print(f"Entering get_graph_nodes... graph_id={graph_id}")
    db_name = settings.MONGODB_DB_NAME

    try:
        cursor = db.mongo[db_name]["graph_entities"].find(
            {"graph_id": graph_id}
        ).limit(limit)
        entities = await cursor.to_list(length=limit)

        nodes = []
        for entity in entities:
            nodes.append({
                "id": str(entity["_id"]),
                "label": entity.get("entity", entity.get("_id", "Unknown")),
                "type": entity.get("type", "Node"),
                "properties": {
                    "entity": entity.get("entity"),
                    "type": entity.get("type"),
                    **(entity.get("attributes", {}))
                },
            })
        return {"nodes": nodes, "count": len(nodes)}
    except Exception as e:
        logger.error(f"MongoDB node fetch error: {e}")
        return {"nodes": [], "error": str(e)}


@router.get("/{graph_id}/edges")
async def get_graph_edges(graph_id: str, limit: int = 500):
    """Derive edges from graph_entities relationships."""
    print(f"Entering get_graph_edges... graph_id={graph_id}")
    db_name = settings.MONGODB_DB_NAME

    try:
        cursor = db.mongo[db_name]["graph_entities"].find(
            {"graph_id": graph_id}
        )
        entities = await cursor.to_list(length=None)

        # Build a UUID -> entity name lookup
        id_to_name = {str(e["_id"]): e.get("entity", str(e["_id"])) for e in entities}

        edges = []
        edge_count = 0
        for entity in entities:
            source_id = str(entity["_id"])
            relationships = entity.get("relationships", {})
            target_ids = relationships.get("target_ids", [])
            types = relationships.get("types", [])

            for i, target_id in enumerate(target_ids):
                if edge_count >= limit:
                    break
                rel_type = types[i] if i < len(types) else "RELATED_TO"
                edges.append({
                    "id": f"{source_id}-{target_id}-{i}",
                    "source": source_id,
                    "target": str(target_id),
                    "label": rel_type,
                    "properties": {
                        "source_name": id_to_name.get(source_id, source_id),
                        "target_name": id_to_name.get(str(target_id), str(target_id)),
                    },
                })
                edge_count += 1

        return {"edges": edges, "count": len(edges)}
    except Exception as e:
        logger.error(f"MongoDB edge fetch error: {e}")
        return {"edges": [], "error": str(e)}


@router.get("/{graph_id}/export")
async def export_graph(graph_id: str):
    """Export full graph as JSON (nodes + edges)."""
    print(f"Entering export_graph... graph_id={graph_id}")
    nodes_resp = await get_graph_nodes(graph_id, limit=10000)
    edges_resp = await get_graph_edges(graph_id, limit=50000)

    db_name = settings.MONGODB_DB_NAME
    doc = await db.mongo[db_name]["graphs"].find_one({"_id": graph_id})

    graph_meta = {
        "id": graph_id,
        "name": doc.get("name", doc.get("filename")) if doc else "Unknown Graph"
    }

    export_data = {
        "graph": graph_meta,
        "nodes": nodes_resp.get("nodes", []),
        "edges": edges_resp.get("edges", []),
        "exported_at": datetime.utcnow().isoformat(),
    }

    return JSONResponse(
        content=export_data,
        headers={"Content-Disposition": f'attachment; filename="graph-{graph_id[:8]}.json"'}
    )
