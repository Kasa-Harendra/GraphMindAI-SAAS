from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime

class GraphDocument(BaseModel):
    """Represents a graph record in the 'graphs' collection."""
    id: str = Field(alias="_id")
    name: str
    source_type: str
    source_label: str = ""
    status: str = "processing"  # processing, completed, failed
    node_count: int = 0
    edge_count: int = 0
    chunk_count: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)
    filename: Optional[str] = None
    file_type: Optional[str] = None
    source_url: Optional[str] = None
    author: Optional[str] = None

    class Config:
        populate_by_name = True

class UserSession(BaseModel):
    id: str
    user_id: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    last_active: Optional[datetime] = None
