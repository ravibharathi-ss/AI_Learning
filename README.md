# Enterprise Legal & Contracts Intelligence Platform

An enterprise-grade, grounded Retrieval-Augmented Generation (RAG) platform tailored for legal agreement ingestion, semantic clause analysis, strict citation verification, and canary prompt engineering. Built with **Clean Architecture** to ensure testability, security, and zero hallucination risk.

---

## 🚫 No UI-Based Testing or Debugging Dashboards

This repository enforces an **API-first, code-level testable architecture**.

- **No Developer Testing Dashboards**: Modules such as RAG Retrieval, Error Analysis, Legal Judge, Agent Loops, Agent Security, MCP Studio, and Multi-Agent are **not tested through visual UI dashboards or buttons**.
- **The Frontend UI is strictly a client**: The React frontend exists solely for standard end-user interaction (Legal Assistant Chat and Knowledge Base document browsing). It is **never** required for testing, debugging, or validating system functionality.
- **Antigravity-Native Code Debugging**: Developers and AI assistants (Antigravity) inspect, trace, benchmark, and debug the entire application directly through:
  1. REST API endpoints
  2. Automated test suites (`pytest backend/tests`)
  3. Structured JSON diagnostic logs (`trace_id`, `correlation_id`, durations, token counts)
  4. Ready-to-use HTTP request collections (`tests/api/*.http`)
  5. Safe diagnostic endpoints (`/api/diagnostics`, `/health/ready`, `/api/documents/{id}/status`)

---

## 🏛️ Clean Architecture & Module Boundaries

Every capability is isolated behind clear service abstractions and domain interfaces:

```
                    ┌─────────────────────────┐
                    │  Developer / Antigravity│
                    │   (Code / Tests / APIs) │
                    └────────────┬────────────┘
                                 │ HTTP / Code
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                      FastAPI Backend API                         │
│  /health/ready    /api/documents    /api/search    /api/chat    │
│  /api/contracts   /api/traces       /api/diagnostics            │
├─────────────────────────────────────────────────────────────────┤
│                     Application Layer                           │
│  - IngestDocumentUseCase       - SearchUseCase                 │
│  - ChatRagUseCase              - ContractBusinessRules          │
├─────────────────────────────────────────────────────────────────┤
│                       Domain Layer                              │
│  - Entities: Document, DocumentChunk                            │
│  - Value Objects: Citation, TokenUsage                          │
│  - Interfaces: IVectorStore, IEmbeddingService, ILLMService     │
├─────────────────────────────────────────────────────────────────┤
│                    Infrastructure Layer                         │
│  - ChromaVectorStore (Cosine HNSW with auto-recovery)           │
│  - OllamaEmbeddingService (nomic-embed-text) & Offline Fallback │
│  - OllamaLlmService (Llama 3.2) & Heuristic Fallback            │
│  - SqliteDocumentRepository (SQLAlchemy ORM)                   │
│  - RequestTracer (OpenTelemetry Stage Spans & Token Telemetry)  │
│  - StructuredLogger (JSON Contextual Logs with Trace IDs)       │
│  - SecurityGuardrails (Injection Sanitizer & PII Masking)       │
└─────────────────────────────────────────────────────────────────┘
```

### Module Abstraction Mappings:

| Module | Interface / Domain Abstraction | Concrete Service / Use Case | Primary API Endpoint | Automated Test File |
| :--- | :--- | :--- | :--- | :--- |
| **RAG & Grounded Q&A** | `ILLMService`, `IEmbeddingService` | `ChatRagUseCase` | `POST /api/chat` | `tests/api/test_api_chat_rag.py` |
| **Retrieval & Search** | `IVectorStore` | `ChromaVectorStore`, `SearchUseCase` | `POST /api/search` | `tests/api/test_api_search.py`, `tests/unit/test_retrieval_ranking.py` |
| **Document Ingestion** | `IDocumentRepository` | `IngestDocumentUseCase`, `PdfDocumentParser` | `POST /api/documents` | `tests/api/test_api_documents.py`, `tests/integration/test_document_ingestion_pipeline.py` |
| **Document Chunking** | *Domain Boundary* | `TextChunker` | Internal / Use Case | `tests/unit/test_chunking.py` |
| **Security Guardrails**| *Domain Security* | `SecurityGuardrails` | Pre-execution hook | `tests/unit/test_security_guardrails.py` |
| **Contracts & Canary** | `ContractBusinessRules` | `CanaryRouter` | `POST /api/contracts/query` | `tests/api/test_api_chat_rag.py` |
| **Multi-Agent Squads** | `IAgentService` | `MultiAgentService` | `POST /api/agent/run` | `tests/test_multi_agent.py` |
| **Model Context Protocol**| *Tool Socket* | `McpService` | `POST /api/mcp/tools/call` | `tests/test_multi_agent.py` |

---

## 🔄 Grounded RAG Execution Flow

```
User Query (API)
       │
       ▼
[ Security Guardrails ] ────► Rejects prompt injection & sanitizes input
       │
       ▼
[ Query Embedding ] ────────► 768-dim vector (Ollama nomic-embed-text)
       │
       ▼
[ Vector Search ] ──────────► ChromaDB Cosine Similarity
       │
       ├─► (No chunks >= similarity_threshold) ──► Rejection: "Information could not be found"
       │                                            (Zero Hallucination Guarantee)
       ▼
[ Grounded Prompt Construction ] ─► System Prompt + Reference Documents
       │
       ▼
[ LLM Generation ] ─────────► Llama 3.2 inference
       │
       ▼
[ Citation Extraction ] ────► Verifies cited Section & maps to source chunks
       │
       ▼
[ Structured Telemetry ] ───► Logs JSON trace event & saves OpenTelemetry spans
       │
       ▼
HTTP 200 Response with Answer & Verified Sources
```

---

## 🔍 Structured Logging for Antigravity Code-Level Debugging

All operations emit structured, machine-parsable JSON logs with operational metadata. Sensitive keys (`api_key`, `tokens`, `passwords`, `bearer`) are automatically redacted:

```json
{
  "timestamp": "2026-10-07T12:45:00.123Z",
  "event": "rag_response_generated",
  "status": "success",
  "trace_id": "trace-4a9b2c1f8e",
  "correlation_id": "corr-4a9b2c1f8e",
  "operation": "chat_rag_qa",
  "duration_ms": 142,
  "metadata": {
    "is_grounded": true,
    "cited_clause": "Section 12.3",
    "citation_count": 1,
    "total_tokens": 577,
    "cost_usd": 0.002751
  }
}
```

Key lifecycle events logged for AI-assisted debugging in Antigravity:
- `rag_request_received`: Incoming query, user ID, prompt version.
- `security_violation_blocked`: Threat classification (e.g., prompt injection).
- `vector_search_completed`: Retrieved chunk count, similarity threshold.
- `rag_response_ungrounded_refusal`: Explicit refusal when information is absent.
- `rag_response_generated`: Grounded synthesis completion with token economics.
- `document_processing_started`: Ingestion trigger with file size and type.
- `chunking_completed`: Total chunks produced preserving clause boundaries.
- `document_indexing_completed`: Vector upsert completion into ChromaDB.

---

## 🩺 Safe Developer Diagnostic Endpoints

Safe operational metadata is exposed for API inspection:

- `GET /health`: Basic health and component status.
- `GET /health/live`: Kubernetes / container liveness probe.
- `GET /health/ready`: Deep readiness probe checking SQLite, ChromaDB, and configuration.
- `GET /api/diagnostics`: Operational diagnostics exposing component providers, collection names, and active security policies without leaking credentials.
- `GET /api/documents/{id}/status`: Ingestion status, indexed chunk counts, and processing state.
- `GET /api/traces`: OpenTelemetry request traces, span breakdown, latency breakdown, and token costs.

---

## 🏃 Running Automated Tests

All tests run in **100% isolated offline environments** with **zero paid API dependencies**.

```bash
# Run the complete test suite
pytest backend/tests -v

# Run only Unit tests
pytest backend/tests/unit -v

# Run only Integration tests
pytest backend/tests/integration -v

# Run only API-level tests
pytest backend/tests/api -v

# Run specific RAG Grounding & Anti-Hallucination verification
pytest backend/tests/api/test_api_chat_rag.py -v
```

---

## 🛠️ Developer HTTP Test Collections (`tests/api/`)

Developers using **VS Code REST Client**, **JetBrains HTTP Client**, or **Bruno** can execute the complete platform lifecycle via the `.http` files located in [`tests/api/`](file:///d:/Program%20files/ChatBot/tests/api):

- [`tests/api/health.http`](file:///d:/Program%20files/ChatBot/tests/api/health.http): Health, liveness, readiness, and diagnostics.
- [`tests/api/documents.http`](file:///d:/Program%20files/ChatBot/tests/api/documents.http): Multipart document upload, chunking, status, and deletion.
- [`tests/api/search.http`](file:///d:/Program%20files/ChatBot/tests/api/search.http): Semantic and hybrid keyword search.
- [`tests/api/chat.http`](file:///d:/Program%20files/ChatBot/tests/api/chat.http): Grounded Q&A, citations, zero-hallucination refusal, and prompt injection defense.
- [`tests/api/agents.http`](file:///d:/Program%20files/ChatBot/tests/api/agents.http): Multi-agent discovery, agent loop benchmark races, and A2A simulation.
- [`tests/api/mcp.http`](file:///d:/Program%20files/ChatBot/tests/api/mcp.http): MCP server registration and tool execution.
- [`tests/api/evaluation.http`](file:///d:/Program%20files/ChatBot/tests/api/evaluation.http): Grounded evaluation suite and legal judge calibration.

---

## 🚀 Deployment (Docker Compose)

```bash
docker-compose up --build -d
```

- **Backend API**: `http://localhost:8000`
- **Swagger Docs**: `http://localhost:8000/docs`
- **Frontend App**: `http://localhost:80`
- **Readiness Check**: `http://localhost:8000/health/ready`
