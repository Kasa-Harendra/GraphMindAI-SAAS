from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional, Literal

HOST_NAME = "localhost"

class Settings(BaseSettings):
    PROJECT_NAME: str = "GraphMind AI API"

    # MongoDB Settings (PRIMARY DATA STORE)
    MONGODB_URI: str = f"mongodb://{HOST_NAME}:27020/?directConnection=true"
    MONGODB_DB_NAME: str = "graphmind_db"

    # Redis Settings (Celery broker + cache)
    REDIS_URL: str = f"redis://{HOST_NAME}:6380/0"

    # Ollama Defaults (fallback if specific provider not set)
    OLLAMA_BASE_URL: str = f"http://{HOST_NAME}:11434"
    OLLAMA_MODEL: str = "gpt-oss:20b"
    OLLAMA_EMBEDDING_MODEL: str = "embeddinggemma:latest"
    OLLAMA_EMBEDDING_DIMENSION: int = 768

    # Model switch
    USE_OLLAMA: bool = True
    GROQ_API_KEY: Optional[str] = None


    # LLM Settings
    provider: Literal["default", "openai", "anthropic", "google"] = "default"
    model: str = "gpt-oss:20b"
    api_key: Optional[str] = None
    base_url: str = f"http://{HOST_NAME}:11434"
    temperature: float = 0.0

    # Chat LLM settings
    chat_provider: Literal["default", "openai", "anthropic", "google"] = "default"
    chat_model: str = "llama3.2:3b"
    chat_api_key: Optional[str] = None
    chat_base_url: str = f"http://{HOST_NAME}:11434"
    chat_temperature: float = 0.0

    # Graph settings
    max_graph_depth: int = 5
    max_neighborhood_size: int = 50
    auto_link_graphs: bool = True
    graph_cache_ttl: int = 3600

    # Security
    jwt_auth: bool = True
    rate_limiting: bool = True
    api_throttling: bool = False
    audit_logs: bool = True

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

settings = Settings()
