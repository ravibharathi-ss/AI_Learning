"""
Strongly-Typed Application and RAG Configuration
Uses Pydantic Settings with environment variable overrides.
"""

import os
from pathlib import Path
from typing import List
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

class AppSettings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Enterprise Legal & Contracts Intelligence Platform"
    environment: str = Field(default="production", env="ENVIRONMENT")
    debug: bool = Field(default=False, env="DEBUG")
    host: str = Field(default="0.0.0.0", env="HOST")
    port: int = Field(default=8000, env="PORT")
    cors_origins: List[str] = Field(default=["*"], env="CORS_ORIGINS")
    api_prefix: str = "/api"

class RagSettings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Document Chunking Configuration
    chunk_size: int = Field(default=500, env="RAG_CHUNK_SIZE")
    chunk_overlap: int = Field(default=100, env="RAG_CHUNK_OVERLAP")
    
    # Retrieval Configuration
    top_k: int = Field(default=3, env="RAG_TOP_K")
    similarity_threshold: float = Field(default=0.50, env="RAG_SIMILARITY_THRESHOLD")
    enable_reranking: bool = Field(default=True, env="RAG_ENABLE_RERANKING")
    enable_bm25_hybrid: bool = Field(default=True, env="RAG_ENABLE_BM25_HYBRID")

class EmbeddingSettings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    provider: str = Field(default="ollama", env="EMBEDDING_PROVIDER")
    model: str = Field(default="nomic-embed-text", env="OLLAMA_EMBED_MODEL")
    ollama_host: str = Field(default="http://127.0.0.1:11434", env="OLLAMA_HOST")
    timeout_seconds: float = Field(default=15.0, env="EMBEDDING_TIMEOUT")

class LlmSettings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    provider: str = Field(default="ollama", env="LLM_PROVIDER")
    model: str = Field(default="llama3.2", env="OLLAMA_MODEL")
    ollama_base_url: str = Field(default="http://127.0.0.1:11434/v1", env="OLLAMA_BASE_URL")
    temperature: float = Field(default=0.2, env="LLM_TEMPERATURE")
    max_tokens: int = Field(default=512, env="LLM_MAX_TOKENS")
    timeout_seconds: float = Field(default=30.0, env="LLM_TIMEOUT")
    openai_api_key: str = Field(default="", env="OPENAI_API_KEY")
    groq_api_key: str = Field(default="", env="GROQ_API_KEY")

class VectorStoreSettings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    provider: str = Field(default="chromadb", env="VECTOR_STORE_PROVIDER")
    collection_name: str = Field(default="rag_knowledge_base", env="CHROMA_COLLECTION")
    persist_directory: str = Field(
        default=str((Path(__file__).resolve().parent.parent.parent.parent / "chroma_db").as_posix()),
        env="CHROMA_DB_PATH"
    )

class SecuritySettings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    max_file_size_mb: int = Field(default=25, env="MAX_FILE_SIZE_MB")
    allowed_file_extensions: List[str] = [".pdf", ".txt", ".md", ".json"]
    enable_prompt_injection_guard: bool = Field(default=True, env="ENABLE_INJECTION_GUARD")
    enable_pii_masking: bool = Field(default=True, env="ENABLE_PII_MASKING")

class Settings(BaseSettings):
    app: AppSettings = AppSettings()
    rag: RagSettings = RagSettings()
    embedding: EmbeddingSettings = EmbeddingSettings()
    llm: LlmSettings = LlmSettings()
    vector_store: VectorStoreSettings = VectorStoreSettings()
    security: SecuritySettings = SecuritySettings()

# Global singleton settings instance
settings = Settings()
