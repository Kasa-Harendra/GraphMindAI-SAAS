"""
Graph Builder Service — Extracts entities from documents using MongoDBGraphStore
and stores them in the graph_entities collection in MongoDB.
"""
import os
import uuid
import logging
import time
from datetime import datetime, timezone
from typing import List, Tuple

from langchain_core.documents import Document
from langchain_mongodb.graphrag.graph import MongoDBGraphStore
from pymongo import UpdateOne
from langchain_core.messages import SystemMessage
from langchain_core.prompts.chat import ChatPromptTemplate, HumanMessagePromptTemplate
from langchain_mongodb.graphrag.prompts import ENTITY_EXTRACTION_INSTRUCTIONS

from app.services.llm import get_llm
from app.core.config import settings

logger = logging.getLogger(__name__)

def build_custom_prompt(node_limit: int, focus_topic: str = None) -> ChatPromptTemplate:
    focus_instruction = ""
    if focus_topic and focus_topic.strip():
        focus_instruction = f"\\n5. **Focus Topic:** Prioritize extracting entities, relationships, and attributes strongly related to: '{focus_topic.strip()}'. Ignore irrelevant information."

    instructions = ENTITY_EXTRACTION_INSTRUCTIONS + f"""
### EXTRACTION GUIDELINES (STRICT)
1. **Identify the Root Entity:** First, identify the primary subject or "root entity" of the text (e.g., the main person, project, organization, or concept the text revolves around). Ensure this root entity is extracted with high precision.
2. **Proper Entities Only:** Extract ONLY proper nouns, specific concepts, technologies, or named entities. DO NOT extract generic nouns, adjectives, or passing filler words.
3. **Relationships & Attributes:** Carefully map how secondary entities relate specifically to the root entity or each other. Avoid vague relationship types. Include meaningful attributes for each entity.
4. **Sparsity & Relevance:** Do not extract content in extreme detail. Limit extraction to a MAXIMUM of {node_limit} key entities per chunk. Ignore minor details and passing mentions to ensure a clean, sparse knowledge graph.{focus_instruction}

### STRICT JSON SCHEMA ENFORCEMENT
You MUST output a valid JSON object matching the exact structure below.
Do not output markdown code blocks unless they contain strictly this JSON object.
Do not include any preamble or postamble text. Your output must begin with `{{` and end with `}}`.

You MUST include a brief `description` and a list of `possible_variations` (aliases/alternative names) inside the `attributes` object for EVERY entity.

Example of expected strictly formatted JSON:
```
{{
  "entities": [
    {{
      "_id": "John Doe",
      "type": "Person",
      "attributes": {{
        "description": "Senior Software Engineer at ACME Corp.",
        "possible_variations": ["J. Doe", "Jonathan Doe", "Johnny"],
        "age": 30,
        "role": "Engineer"
      }},
      "relationships": {{
        "target_ids": ["ACME Corp"],
        "types": ["employee"],
        "attributes": [{{"since": 2015}}]
      }}
    }}
  ]
}}
```
"""
    return ChatPromptTemplate.from_messages([
        SystemMessage(content=instructions),
        HumanMessagePromptTemplate.from_template("{input_document}")
    ])


class MultiTenantMongoDBGraphStore(MongoDBGraphStore):
    """
    Subclass of MongoDBGraphStore that:
    - Uses UUID _id instead of entity name
    - Stores entity name in a separate 'entity' field
    - Tags every node with graph_id and workspace_id for multi-tenancy
    """
    def __init__(self, graph_id: str, workspace_id: str = "default", *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.graph_id = graph_id
        self.workspace_id = workspace_id

    def _resolve_uuid(self, entity_name: str) -> str:
        existing = self.collection.find_one(
            {"entity": entity_name, "graph_id": self.graph_id},
            {"_id": 1}
        )
        if existing:
            return existing["_id"]
        return str(uuid.uuid4())

    def _write_entities(self, entities):
        # Phase 1: Resolve or generate UUIDs
        name_to_uuid = {}
        for entity in entities:
            name = entity["_id"]
            name_to_uuid[name] = self._resolve_uuid(name)

        for entity in entities:
            relationships = entity.get("relationships", {})
            for target_name in relationships.get("target_ids", []):
                if target_name not in name_to_uuid:
                    name_to_uuid[target_name] = self._resolve_uuid(target_name)

        # Phase 2: Build upsert operations
        operations = []
        for entity in entities:
            name = entity["_id"]
            entity_uuid = name_to_uuid[name]

            relationships = entity.get("relationships", {})
            target_names = relationships.get("target_ids", [])
            types = relationships.get("types", [])
            rel_attributes = relationships.get("attributes", [])

            target_uuids = [name_to_uuid[t] for t in target_names]

            operations.append(
                UpdateOne(
                    filter={"_id": entity_uuid},
                    update={
                        "$setOnInsert": {
                            "_id": entity_uuid,
                            "entity": name,
                            "type": entity.get("type", "Unknown"),
                            "graph_id": self.graph_id,
                            "workspace_id": self.workspace_id,
                            "created_at": datetime.now(timezone.utc)
                        },
                        "$addToSet": {
                            **{
                                f"attributes.{k}": {"$each": v} if isinstance(v, list) else v
                                for k, v in entity.get("attributes", {}).items()
                            },
                        },
                        "$push": {
                            "relationships.target_ids": {"$each": target_uuids},
                            "relationships.types": {"$each": types},
                            "relationships.attributes": {"$each": rel_attributes},
                        },
                    },
                    upsert=True,
                )
            )

        if operations:
            return self.collection.bulk_write(operations)
        return None

    def similarity_search(self, input_document: str):
        entity_names = self.extract_entity_names(input_document)
        uuid_ids = []
        import re
        for name in entity_names:
            regex_pattern = f"^{re.escape(name)}$"
            doc = self.collection.find_one(
                {
                    "graph_id": self.graph_id,
                    "$or": [
                        {"entity": {"$regex": regex_pattern, "$options": "i"}},
                        {"attributes.possible_variations": {"$regex": regex_pattern, "$options": "i"}}
                    ]
                },
                {"_id": 1}
            )
            if doc:
                uuid_ids.append(doc["_id"])
        return self.related_entities(uuid_ids)


def get_graph_store(graph_id: str, workspace_id: str = "default", metadata_updates: dict = None, user_settings: dict = None) -> MultiTenantMongoDBGraphStore:
    """
    Factory to create a MultiTenantMongoDBGraphStore instance.
    All graphs share the single 'graph_entities' collection.
    """
    llm = get_llm(override=user_settings)
    
    # Determine node limits from extraction level
    extraction_level = (metadata_updates or {}).get("extraction_level", "Medium")
    node_limit = 15
    if extraction_level == "Low":
        node_limit = 5
    elif extraction_level == "High":
        node_limit = 25
        
    focus_topic = (metadata_updates or {}).get("focus_topic", None)
    
    dynamic_prompt = build_custom_prompt(node_limit=node_limit, focus_topic=focus_topic)

    return MultiTenantMongoDBGraphStore(
        graph_id=graph_id,
        workspace_id=workspace_id,
        connection_string=settings.MONGODB_URI,
        database_name=settings.MONGODB_DB_NAME,
        collection_name="graph_entities",
        entity_extraction_model=llm,
        entity_prompt=dynamic_prompt,
        # allowed_entity_types=["Person", "Organization", "Location", "Concept", "Technology", "Event"],
        # allowed_relationship_types=["RELATED_TO", "PART_OF", "USES", "LOCATED_IN", "WORKS_FOR"],
        # validate=True,
        validation_action="warn",
        max_depth=(user_settings or {}).get("max_graph_depth", 5)
    )


async def extract_and_store_graph(docs: List[Document], graph_id: str, metadata_updates: dict = None, user_id: str = None) -> Tuple[int, int]:
    """
    Extracts entities and relationships from documents using the LLM
    and stores them in the graph_entities collection in MongoDB.
    
    Returns (node_count, edge_count).
    """
    logger.info(f"Extracting graph {graph_id} from {len(docs)} document chunks...")

    try:
        from app.core.db import fetch_user_settings
        user_settings = await fetch_user_settings(user_id) if user_id else {}
        
        start_time = time.time()
        graph_store = get_graph_store(graph_id, metadata_updates=metadata_updates, user_settings=user_settings)
        
        logger.info(f"Running MongoDBGraphStore entity extraction for {len(docs)} chunks...")
        graph_store.add_documents(docs)
        
        llm_duration = time.time() - start_time
        logger.info(f"Entity extraction + storage completed in {llm_duration:.2f}s.")

        # Count what was stored
        from pymongo import MongoClient
        sync_client = MongoClient(settings.MONGODB_URI)
        collection = sync_client[settings.MONGODB_DB_NAME]["graph_entities"]
        
        node_count = collection.count_documents({"graph_id": graph_id})
        
        # Count edges by aggregating relationship arrays
        pipeline = [
            {"$match": {"graph_id": graph_id}},
            {"$project": {"edge_count": {"$size": {"$ifNull": ["$relationships.target_ids", []]}}}},
            {"$group": {"_id": None, "total": {"$sum": "$edge_count"}}}
        ]
        edge_result = list(collection.aggregate(pipeline))
        edge_count = edge_result[0]["total"] if edge_result else 0
        
        sync_client.close()
        
        logger.info(f"Stored {node_count} nodes and {edge_count} edges for graph {graph_id}.")
        logger.info(f"Graph extraction pipeline finished.")
        return node_count, edge_count
        
    except Exception as e:
        logger.error(f"Failed to extract and store graph: {str(e)}")
        raise
