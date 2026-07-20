"""
LLM Provider Service — supports Ollama (default), OpenAI, Anthropic, Google.
Settings are loaded directly from app.core.config.settings.
"""
import os
import logging
import sys
from pathlib import Path
from typing import Optional

from langchain_core.language_models import BaseChatModel
from langchain_ollama.embeddings import OllamaEmbeddings

if __package__ in (None, ""):
    sys.path.append(str(Path(__file__).resolve().parents[2]))

from app.core.config import settings

logger = logging.getLogger(__name__)


def get_llm(override: Optional[dict] = None, purpose: str = "default") -> BaseChatModel:
    """
    Build a LangChain chat model based on current settings.
    Priority: override (per-request) > config.settings
    If purpose == 'chat', it uses chat_provider, chat_model etc.
    """
    cfg = settings.model_dump()
    if override:
        cfg.update(override)

    if purpose == "chat":
        provider = cfg.get("chat_provider", cfg.get("provider", "default")).lower()
        model = cfg.get("chat_model", cfg.get("model", settings.OLLAMA_MODEL))
        api_key = cfg.get("chat_api_key", cfg.get("api_key", ""))
        # For default/ollama, if base_url is empty, fallback to system config
        base_url = cfg.get("chat_base_url") or cfg.get("base_url") or settings.OLLAMA_BASE_URL
        temperature = float(cfg.get("chat_temperature", cfg.get("temperature", 0.0)))
    else:
        provider = cfg.get("provider", "default").lower()
        model = cfg.get("model", settings.OLLAMA_MODEL)
        api_key = cfg.get("api_key", "")
        # For default/ollama, if base_url is empty, fallback to system config
        base_url = cfg.get("base_url") or settings.OLLAMA_BASE_URL
        temperature = float(cfg.get("temperature", 0.0))

    logger.info(f"Building LLM (purpose={purpose}): provider={provider}, model={model}")

    if provider == "groq":
        from langchain_groq import ChatGroq
        return ChatGroq(
            model=model or "llama3-8b-8192",
            api_key=api_key,
            temperature=temperature,
        )

    if provider == "openai":
        from langchain_openai import ChatOpenAI
        return ChatOpenAI(
            model=model or "gpt-4o",
            api_key=api_key,
            temperature=temperature,
            streaming=True,
        )

    elif provider == "anthropic":
        from langchain_anthropic import ChatAnthropic
        return ChatAnthropic(
            model=model or "claude-3-5-sonnet-20241022",
            api_key=api_key,
            temperature=temperature,
            streaming=True,
        )

    elif provider == "google":
        from langchain_google_genai import ChatGoogleGenerativeAI
        return ChatGoogleGenerativeAI(
            model=model or "gemini-2.0-flash",
            google_api_key=api_key,
            temperature=temperature,
        )

    else:
        # Default / Ollama
        from langchain_ollama import ChatOllama
        return ChatOllama(
            base_url=base_url,
            model=model or settings.OLLAMA_MODEL,
            temperature=temperature,
        )


def get_embeddings(override: Optional[dict] = None) -> OllamaEmbeddings:
    """Return Ollama embeddings (always local, no external API needed)."""
    cfg = settings.model_dump()
    if override:
        cfg.update(override)
        
    base_url = cfg.get("base_url") or settings.OLLAMA_BASE_URL
    return OllamaEmbeddings(base_url=base_url, model=settings.OLLAMA_EMBEDDING_MODEL)