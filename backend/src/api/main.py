"""
Production Enterprise API Entry Point
Clean Architecture Application Assembly with Routers, Middleware & Diagnostics.
"""

import sys
from pathlib import Path

# Add backend directory and src to sys.path
backend_dir = Path(__file__).resolve().parent.parent.parent
src_dir = Path(__file__).resolve().parent.parent
for p in [str(backend_dir), str(src_dir)]:
    if p not in sys.path:
        sys.path.insert(0, p)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine, Base
from infrastructure.configuration.settings import settings
from api.middleware.error_handler import global_exception_handler

# Ensure DB schema is initialized
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.app.app_name,
    description="Enterprise Clean Architecture RAG Engine with Document Ingestion, Grounded Answering, and Observability.",
    version="2.2.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.app.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register Global Exception Handler
app.add_exception_handler(Exception, global_exception_handler)

# Mount Clean Architecture Routers
from api.routers.health import router as health_router
from api.routers.documents import router as documents_router
from api.routers.search import router as search_router
from api.routers.chat import router as chat_router
from api.routers.traces import router as traces_router
from api.routers.contracts import router as contracts_router

app.include_router(health_router)
app.include_router(documents_router)
app.include_router(search_router)
app.include_router(chat_router)
app.include_router(traces_router)
app.include_router(contracts_router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api.main:app", host=settings.app.host, port=settings.app.port, reload=settings.app.debug)
