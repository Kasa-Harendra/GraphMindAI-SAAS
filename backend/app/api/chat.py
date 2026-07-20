"""
Chat API — SSE streaming chat endpoint backed by the configured LLM.
Supports GraphRAG context retrieval from MongoDB graph_entities.
"""
import asyncio
import json
import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.services.llm import get_llm
from app.core.config import settings
from app.core.security import get_current_user
from app.core.db import db

router = APIRouter()
logger = logging.getLogger(__name__)


class ChatMessage(BaseModel):
    role: str   # "user" | "assistant"
    content: str


class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    graph_ids: List[str] = []
    # Optional per-request provider override
    provider: Optional[str] = None
    model: Optional[str] = None
    api_key: Optional[str] = None


async def _get_graph_context_parallel(graph_ids: List[str], query: str, user_id: str) -> str:
    """
    Retrieve Hybrid context (Graph + Vector) from MongoDB in parallel using asyncio.
    """
    if not graph_ids:
        return ""

    try:
        import time
        from app.services.graph_builder import get_graph_store
        from app.services.llm import get_embeddings
        from app.core.db import db, fetch_user_settings
        from app.core.config import settings
        
        user_settings = await fetch_user_settings(user_id)
        
        logger.info(f"Starting parallel HYBRID retrieval for {len(graph_ids)} graphs. Query: '{query}'")
        start_time = time.time()

        # 1. Generate embedding for vector search
        embeddings_model = get_embeddings(override=user_settings)
        query_vector = await embeddings_model.aembed_query(query)
        
        async def get_hybrid_for_graph(graph_id: str) -> Optional[str]:
            # Step A: Graph Summary (Runs in thread pool)
            def _get_graph_summary():
                try:
                    store = get_graph_store(graph_id, user_settings=user_settings)
                    ans = store.chat_response(query)
                    if ans and hasattr(ans, "content") and ans.content:
                        return ans.content
                    return None
                except Exception as e:
                    logger.warning(f"Failed graph chat_response for {graph_id}: {e}")
                    return None
            
            # Step B: Vector Search (Async)
            async def _get_vector_context():
                try:
                    pipeline = [
                        {
                            "$vectorSearch": {
                                "index": "vector_index", 
                                "path": "embedding",
                                "queryVector": query_vector,
                                "numCandidates": 50,
                                "limit": 3,
                                "filter": {"graph_id": graph_id}
                            }
                        },
                        {"$project": {"_id": 0, "page_content": 1, "score": {"$meta": "vectorSearchScore"}}}
                    ]
                    docs = await db.mongo[settings.MONGODB_DB_NAME]["graph_embeddings"].aggregate(pipeline).to_list(length=3)
                    if docs:
                        return "\n\n".join([d["page_content"] for d in docs])
                    return None
                except Exception as e:
                    logger.warning(f"Failed vector search for {graph_id}: {e}")
                    return None

            # Run both concurrently for this specific graph
            graph_summary_task = asyncio.to_thread(_get_graph_summary)
            vector_context_task = _get_vector_context()
            
            graph_res, vector_res = await asyncio.gather(graph_summary_task, vector_context_task)
            
            parts = [f"=== Context from Graph/Workspace '{graph_id}' ==="]
            if graph_res:
                parts.append(f"--- Graph Entity Summary ---\n{graph_res}")
            if vector_res:
                parts.append(f"--- Vector Semantic Context ---\n{vector_res}")
                
            if len(parts) > 1:
                return "\n\n".join(parts)
            return None

        # Run hybrid retrieval in parallel for all requested graphs
        tasks = [get_hybrid_for_graph(gid) for gid in graph_ids]
        results = await asyncio.gather(*tasks)

        context_parts = [res for res in results if res]
        final_context = "\n\n".join(context_parts) if context_parts else ""
        print(final_context)
        
        elapsed = time.time() - start_time
        logger.info(f"Parallel HYBRID retrieval finished in {elapsed:.2f}s. Total context length: {len(final_context)} chars.")
        return final_context
    except Exception as e:
        logger.exception(f"Parallel graph context retrieval failed: {e}")
        return ""


async def generate_sse_stream(request: ChatRequest, user_id: str):
    """
    Async generator that yields SSE-formatted chunks from the LLM.
    """
    import time
    from datetime import datetime, timezone
    
    stream_start_time = time.time()
    from app.core.db import fetch_user_settings
    user_settings = await fetch_user_settings(user_id)
    
    override = user_settings.copy()
    if request.provider:
        override["chat_provider"] = request.provider
    if request.model:
        override["chat_model"] = request.model
    if request.api_key:
        override["chat_api_key"] = request.api_key

    try:
        llm = get_llm(override or None, purpose="chat")
    except Exception as e:
        logger.error(f"Failed to instantiate LLM: {e}")
        yield f"data: {json.dumps({'error': f'Model configuration error: {str(e)}', 'done': True})}\\n\\n"
        return

    # Build LangChain messages
    from langchain_core.messages import HumanMessage, AIMessage, SystemMessage

    # Get graph context if graph_ids are provided
    graph_context = ""
    if request.graph_ids and request.messages:
        last_user_msg = next((m.content for m in reversed(request.messages) if m.role == "user"), "")
        if last_user_msg:
            logger.info("Initiating parallel graph context retrieval before LLM streaming...")
            graph_context = await _get_graph_context_parallel(request.graph_ids, last_user_msg, user_id)

    system_prompt = (
        "You are GraphMind AI, an expert knowledge graph reasoning assistant. "
        "You have access to the user's knowledge graphs. "
        "Answer questions using graph-based reasoning. "
        "Be concise, accurate, and cite relevant graph nodes when possible."
    )
    
    if graph_context:
        system_prompt += f"\n\nRelevant Knowledge Graph Context:\n{graph_context}"

    lc_messages = [SystemMessage(content=system_prompt)]
    for msg in request.messages:
        if msg.role == "user":
            lc_messages.append(HumanMessage(content=msg.content))
        else:
            lc_messages.append(AIMessage(content=msg.content))

    # Stream tokens
    try:
        async for chunk in llm.astream(lc_messages):
            delta = chunk.content if hasattr(chunk, "content") else str(chunk)
            if delta:
                payload = json.dumps({"delta": delta, "done": False})
                yield f"data: {payload}\n\n"

        # Send done signal with citations for all graphs queried
        citations = [f"Graph: {gid[:8]}..." for gid in request.graph_ids]
        done_payload = json.dumps({"delta": "", "done": True, "citations": citations})
        yield f"data: {done_payload}\n\n"
        
        # Log telemetry
        try:
            latency_ms = int((time.time() - stream_start_time) * 1000)
            analytics_docs = []
            now = datetime.now(timezone.utc)
            # Log for each graph individually so aggregations are easier
            for gid in request.graph_ids:
                analytics_docs.append({
                    "graph_id": gid,
                    "user_id": user_id,
                    "latency_ms": latency_ms,
                    "timestamp": now,
                    "queries": 1
                })
            # Also log a global query if no graphs were selected
            if not analytics_docs:
                analytics_docs.append({
                    "graph_id": None,
                    "user_id": user_id,
                    "latency_ms": latency_ms,
                    "timestamp": now,
                    "queries": 1
                })
            await db.mongo[settings.MONGODB_DB_NAME]["graph_analytics"].insert_many(analytics_docs)
        except Exception as e:
            logger.error(f"Failed to log telemetry: {e}")

    except Exception as e:
        logger.error(f"Chat stream error: {e}")
        # Identify common errors
        error_msg = str(e)
        if "401" in error_msg or "authentication" in error_msg.lower():
            error_msg = "Authentication Error: Please check your API Key in Settings."
        elif "429" in error_msg or "rate limit" in error_msg.lower():
            error_msg = "Rate Limit Exceeded: You have hit the API limits for this provider."
        elif "not found" in error_msg.lower() or "model" in error_msg.lower():
            error_msg = f"Model Error: The requested model might be invalid or unavailable. Details: {str(e)}"
            
        error_payload = json.dumps({"error": error_msg, "done": True})
        yield f"data: {error_payload}\\n\\n"


@router.post("/stream")
async def chat_stream(request: ChatRequest, current_user: dict = Depends(get_current_user)):
    """SSE streaming chat endpoint."""
    # Verify graph ownership
    if request.graph_ids:
        db_name = settings.MONGODB_DB_NAME
        user_id = current_user["_id"]
        valid_graphs = await db.mongo[db_name]["graphs"].find(
            {"_id": {"$in": request.graph_ids}, "user_id": user_id},
            {"_id": 1}
        ).to_list(length=None)
        
        valid_graph_ids = [g["_id"] for g in valid_graphs]
        if len(valid_graph_ids) != len(request.graph_ids):
            raise HTTPException(status_code=403, detail="Unauthorized access to one or more graphs")

    return StreamingResponse(
        generate_sse_stream(request, user_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
