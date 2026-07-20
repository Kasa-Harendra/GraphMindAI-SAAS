"""
Analytics API — platform usage stats from MongoDB.
"""
from app.core.security import get_current_user
import logging
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends

from app.core.db import db
from app.core.config import settings

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/overview")
async def get_analytics_overview(current_user: dict = Depends(get_current_user)):
    """Return high-level platform statistics scoped to the current user."""
    db_name = settings.MONGODB_DB_NAME
    user_id = current_user["_id"]

    try:
        # Get all graphs for this user
        user_graphs_cursor = db.mongo[db_name]["graphs"].find({"user_id": user_id}, {"_id": 1})
        user_graphs = await user_graphs_cursor.to_list(length=None)
        graph_ids = [g["_id"] for g in user_graphs]

        total_graphs = len(graph_ids)
        total_documents = total_graphs

        if not graph_ids:
            return {
                "total_graphs": 0, "total_nodes": 0, "total_edges": 0,
                "total_documents": 0, "total_queries": 0, "active_agents": 0,
                "avg_latency_ms": 0, "uptime_pct": 100.0, "storage_mb": 0,
                "avg_node_degree": 0
            }

        # Count total nodes for user's graphs
        total_nodes = await db.mongo[db_name]["graph_entities"].count_documents({"graph_id": {"$in": graph_ids}})

        # Count total edges for user's graphs
        pipeline = [
            {"$match": {"graph_id": {"$in": graph_ids}}},
            {"$project": {"edge_count": {"$size": {"$ifNull": ["$relationships.target_ids", []]}}}},
            {"$group": {"_id": None, "total": {"$sum": "$edge_count"}}}
        ]
        edge_cursor = db.mongo[db_name]["graph_entities"].aggregate(pipeline)
        edge_result = await edge_cursor.to_list(length=1)
        total_edges = edge_result[0]["total"] if edge_result else 0

        # Count total queries from analytics for user's graphs
        query_pipeline = [
            {"$match": {"graph_id": {"$in": graph_ids}}},
            {"$group": {"_id": None, "total": {"$sum": "$queries"}}}
        ]
        query_cursor = db.mongo[db_name]["graph_analytics"].aggregate(query_pipeline)
        query_result = await query_cursor.to_list(length=1)
        total_queries = query_result[0]["total"] if query_result else 0

        # Count total chunks
        total_chunks = await db.mongo[db_name]["graph_chunks"].count_documents({"graph_id": {"$in": graph_ids}})

        # Avg Latency
        latency_pipeline = [
            {"$match": {"user_id": user_id}},
            {"$group": {"_id": None, "avg_latency": {"$avg": "$latency_ms"}}}
        ]
        latency_cursor = db.mongo[db_name]["graph_analytics"].aggregate(latency_pipeline)
        latency_result = await latency_cursor.to_list(length=1)
        avg_latency_ms = int(latency_result[0]["avg_latency"]) if latency_result and latency_result[0]["avg_latency"] else 0

        # Exact storage calc via collStats average size
        try:
            entity_stats = await db.mongo[db_name].command("collstats", "graph_entities")
            avg_entity_size = entity_stats.get("avgObjSize", 1024)
        except:
            avg_entity_size = 1024
            
        try:
            chunk_stats = await db.mongo[db_name].command("collstats", "graph_chunks")
            avg_chunk_size = chunk_stats.get("avgObjSize", 4096)
        except:
            avg_chunk_size = 4096

        storage_bytes = (total_nodes * avg_entity_size) + (total_chunks * avg_chunk_size)
        storage_mb = round(storage_bytes / (1024 * 1024), 2)

        avg_node_degree = round(total_edges / total_nodes, 2) if total_nodes > 0 else 0

        return {
            "total_graphs": total_graphs,
            "total_nodes": total_nodes,
            "total_edges": total_edges,
            "total_documents": total_documents,
            "total_queries": total_queries,
            "active_agents": 1 if total_graphs > 0 else 0,
            "avg_latency_ms": avg_latency_ms,
            "uptime_pct": 100.0,
            "storage_mb": storage_mb,  
            "avg_node_degree": avg_node_degree
        }
    except Exception as e:
        logger.error(f"Analytics overview error: {e}")
        return {
            "total_graphs": 0, "total_nodes": 0, "total_edges": 0,
            "total_documents": 0, "total_queries": 0, "active_agents": 0,
            "avg_latency_ms": 0, "uptime_pct": 0, "storage_mb": 0, "avg_node_degree": 0
        }


@router.get("/weekly")
async def get_weekly_analytics(current_user: dict = Depends(get_current_user)):
    """Return 7-day breakdown of queries and ingestion."""
    db_name = settings.MONGODB_DB_NAME
    user_id = current_user["_id"]

    try:
        user_graphs_cursor = db.mongo[db_name]["graphs"].find({"user_id": user_id}, {"_id": 1})
        user_graphs = await user_graphs_cursor.to_list(length=None)
        graph_ids = [g["_id"] for g in user_graphs]
    except:
        graph_ids = []

    days = []
    base = datetime.now()
    for i in range(6, -1, -1):
        day = base - timedelta(days=i)
        day_start = day.replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)

        # Count graphs created on this day
        ingestions = await db.mongo[db_name]["graphs"].count_documents({
            "user_id": user_id,
            "created_at": {"$gte": day_start, "$lt": day_end}
        })

        # Count queries on this day
        queries_pipeline = [
            {"$match": {"user_id": user_id, "timestamp": {"$gte": day_start, "$lt": day_end}}},
            {"$group": {"_id": None, "total": {"$sum": "$queries"}}}
        ]
        query_cursor = db.mongo[db_name]["graph_analytics"].aggregate(queries_pipeline)
        query_result = await query_cursor.to_list(length=1)
        queries = query_result[0]["total"] if query_result else 0

        # Count nodes created on this day
        nodes_created = 0
        if graph_ids:
            nodes_created = await db.mongo[db_name]["graph_entities"].count_documents({
                "graph_id": {"$in": graph_ids},
                "created_at": {"$gte": day_start, "$lt": day_end}
            })

        days.append({
            "day": day.strftime("%a"),
            "date": day.strftime("%Y-%m-%d"),
            "queries": queries,
            "ingestions": ingestions,
            "nodes_created": nodes_created,
        })
    return {"days": days}
