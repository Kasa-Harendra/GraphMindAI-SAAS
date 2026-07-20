from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime

# --- Common Schemas ---
class DocumentBase(BaseModel):
    filename: str
    file_type: str
    source_url: Optional[str] = None
    author: Optional[str] = None

class DocumentCreate(DocumentBase):
    pass

class DocumentResponse(DocumentBase):
    id: str
    upload_date: datetime
    status: str
    chunk_count: int
    extra_metadata: Optional[Dict[str, Any]] = None

    class Config:
        from_attributes = True

# --- Graph Entities ---
class GraphNode(BaseModel):
    id: str
    label: str
    properties: Dict[str, Any] = Field(default_factory=dict)
    
class GraphEdge(BaseModel):
    source: str
    target: str
    type: str
    properties: Dict[str, Any] = Field(default_factory=dict)

class GraphData(BaseModel):
    nodes: List[GraphNode]
    edges: List[GraphEdge]

# --- Chat & Queries ---
class ChatQuery(BaseModel):
    query: str
    session_id: str
    context_filters: Optional[Dict[str, Any]] = None

class ChatResponse(BaseModel):
    response: str
    citations: List[str] = Field(default_factory=list)
    graph_context: Optional[GraphData] = None
