import os
import logging
import time
import uuid
from typing import List, Dict, Any, Optional
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter

# Loaders
from langchain_community.document_loaders import (
    PyPDFLoader,
    Docx2txtLoader,
    WebBaseLoader,
    YoutubeLoader,
    UnstructuredMarkdownLoader,
    NotebookLoader,
    WhatsAppChatLoader,
    JSONLoader,
    UnstructuredImageLoader
)
# Note: GithubFileLoader is in langchain_community.document_loaders
from langchain_community.document_loaders import GithubFileLoader

from app.core.db import db
from app.core.config import settings
from app.services.llm import get_embeddings

logger = logging.getLogger(__name__)

def load_document(file_path_or_url: str, file_type: str, extra_args: Optional[Dict[str, Any]] = None) -> List[Document]:
    """Factory to load documents based on file type using Langchain loaders."""
    extra_args = extra_args or {}
    
    try:
        if file_type == "pdf":
            loader = PyPDFLoader(file_path_or_url)
        elif file_type == "docx":
            loader = Docx2txtLoader(file_path_or_url)
        elif file_type == "web":
            loader = WebBaseLoader(file_path_or_url)
        elif file_type == "youtube":
            print(file_path_or_url)
            loader = YoutubeLoader.from_youtube_url(file_path_or_url, add_video_info=False)
        elif file_type == "github":
            loader = GithubFileLoader(
                repo=extra_args.get("repo", ""),
                access_token=extra_args.get("access_token", ""),
                github_api_url="https://api.github.com",
                file_filter=lambda file_path: file_path.endswith(".py") or file_path.endswith(".md")
            )
        elif file_type == "markdown" or file_type == "md":
            loader = UnstructuredMarkdownLoader(file_path_or_url)
        elif file_type == "ipynb":
            loader = NotebookLoader(file_path_or_url, include_outputs=True, max_output_length=20, remove_newline=True)
        elif file_type == "whatsapp":
            loader = WhatsAppChatLoader(file_path_or_url)
        elif file_type == "json":
            loader = JSONLoader(file_path=file_path_or_url, jq_schema=".", text_content=False)
        elif file_type in ["jpg", "jpeg", "png", "image"]:
            loader = UnstructuredImageLoader(file_path_or_url)
        elif file_type == "txt":
            from langchain_community.document_loaders import TextLoader
            loader = TextLoader(file_path_or_url)
        else:
            raise ValueError(f"Unsupported file type: {file_type}")
        
        return loader.load()
    except Exception as e:
        logger.error(f"Error loading {file_type} from {file_path_or_url}: {str(e)}")
        raise

async def process_and_store_document(
    doc_id: str,
    file_path: str,
    file_type: str,
    metadata_updates: Dict[str, Any] = None
):
    """
    Main pipeline: Load -> Chunk -> Store Chunks -> Embed -> Store Embeddings (all in MongoDB)
    """
    logger.info(f"Processing document {doc_id} of type {file_type}")
    db_name = settings.MONGODB_DB_NAME
    
    # 1. Load
    start_time = time.time()
    docs = load_document(file_path, file_type, metadata_updates)
    load_duration = time.time() - start_time
    logger.info(f"Loaded {len(docs)} document pages in {load_duration:.2f}s")
    
    # 2. Chunk
    start_time = time.time()
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=3000,
        chunk_overlap=300,
        length_function=len,
        is_separator_regex=False,
    )
    chunks = text_splitter.split_documents(docs)
    chunk_duration = time.time() - start_time
    logger.info(f"Split document into {len(chunks)} chunks in {chunk_duration:.2f}s.")
    
    # 3. Update graph record with chunk count
    start_time = time.time()
    await db.mongo[db_name]["graphs"].update_one(
        {"_id": doc_id},
        {"$set": {"chunk_count": len(chunks)}}
    )
    db_duration = time.time() - start_time
    logger.info(f"Updated graph metadata in {db_duration:.2f}s")
    
    # 4. Save chunks to graph_chunks collection
    start_time = time.time()
    chunks_data = []
    chunk_ids = []
    for i, chunk in enumerate(chunks):
        chunk_id = str(uuid.uuid4())
        chunk_ids.append(chunk_id)
        chunks_data.append({
            "_id": chunk_id,
            "graph_id": doc_id,
            "chunk_index": i,
            "page_content": chunk.page_content,
            "metadata": chunk.metadata
        })
    
    if chunks_data:
        await db.mongo[db_name]["graph_chunks"].insert_many(chunks_data)
    mongo_duration = time.time() - start_time
    logger.info(f"Stored {len(chunks_data)} chunks in MongoDB in {mongo_duration:.2f}s")
        
    # 5. Generate embeddings and store in graph_embeddings collection
    start_time = time.time()
    if chunks:
        embeddings_model = get_embeddings()
        texts = [c.page_content for c in chunks]
        
        logger.info(f"Generating embeddings for {len(texts)} chunks...")
        vectors = await embeddings_model.aembed_documents(texts)
        
        embedding_docs = []
        for i, (vector, chunk, chunk_id) in enumerate(zip(vectors, chunks, chunk_ids)):
            embedding_docs.append({
                "_id": str(uuid.uuid4()),
                "graph_id": doc_id,
                "chunk_id": chunk_id,
                "chunk_index": i,
                "embedding": vector,
                "page_content": chunk.page_content,
                "metadata": chunk.metadata
            })
        
        if embedding_docs:
            await db.mongo[db_name]["graph_embeddings"].insert_many(embedding_docs)
            logger.info(f"Stored {len(embedding_docs)} embeddings in MongoDB.")
    
    embed_duration = time.time() - start_time
    logger.info(f"Embedded and stored in MongoDB in {embed_duration:.2f}s")
        
    logger.info(f"Document {doc_id} pipeline step 1/2 finished.")
    return len(chunks)
