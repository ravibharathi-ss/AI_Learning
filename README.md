# Enterprise Legal & Contracts Intelligence Platform

An enterprise-grade, grounded Retrieval-Augmented Generation (RAG) platform tailored for legal agreement ingestion, semantic clause analysis, strict citation verification, multi-agent evaluation, and LLM observability. Built with **Clean Architecture** to ensure testability, security, and zero hallucination risk.

---

## 🌟 Key Application Features & Implemented Tasks

| Task | Feature | Status | Description |
|---|---|:---:|---|
| **Task 1** | **Greeting Section** | ✅ Implemented | Dynamic, context-aware greeting generation for "Hello", "Hi", "Good Morning", etc., with time-of-day awareness and zero static placeholders. |
| **Task 2** | **Unique Response Generation** | ✅ Implemented | Dynamic refusal generation for unsupported/off-topic questions. Generates over 1,000 unique natural variations so even repeated queries are uniquely phrased. |
| **Task 3** | **README Documentation** | ✅ Implemented | Complete architectural blueprint, installation guide, project directory tree, and execution instructions. |
| **Task 4** | **Environment Configuration** | ✅ Implemented | Safe `.env.example` blueprint defining all required environment variables without leaking credentials. |
| **Task 5** | **Docker Integration** | ✅ Implemented | Production multi-stage Dockerfiles and `docker-compose.yml` orchestrating Ollama, FastAPI Backend, and React Frontend with healthchecks. |
| **Task 6** | **Pytest Implementation** | ✅ Implemented | Automated unit and integration test suites testing greeting detection, response uniqueness, application endpoints, and error handling. |
| **Task 7** | **Langfuse Integration** | ✅ Implemented | Complete LLM observability tracking prompts, model outputs, execution latencies, retrieved RAG chunks, and session metadata. |
| **Task 8** | **Curriculum Deliverables Log** | ✅ Implemented | Dedicated [`week_3_to_12_tasks.md`](week_3_to_12_tasks.md) documenting tasks, architectures, benchmarks, and completions from Week 3 to 12. |

---

## 📂 Project Directory Structure

```
ChatBot/
├── .env.example                               # Root environment blueprint (Task 4)
├── docker-compose.yml                         # Multi-container orchestration (Task 5)
├── pytest.ini                                 # Pytest configuration & test paths (Task 6)
├── README.md                                  # Enterprise documentation (Task 3)
├── week_3_to_12_tasks.md                      # Curriculum deliverables log (Task 8)
├── architecture.md                            # Single-page architecture diagram
├── canary_rollback_plan.md                    # Zero-downtime canary deployment plan
├── trace.json                                 # Sample production trace with spans
│
├── backend/                                   # FastAPI Clean Architecture Backend
│   ├── .env.example                           # Backend environment template
│   ├── Dockerfile                             # Multi-stage hardened Python container
│   ├── requirements.txt                       # Backend Python dependencies
│   ├── main.py                                # FastAPI API application & streaming SSE
│   ├── database.py                            # SQLAlchemy database engine & sessions
│   ├── models.py                              # Core database entities
│   ├── schemas.py                             # Pydantic v2 validation models
│   ├── chatbot.db                             # SQLite local database
│   │
│   ├── services/                              # Core Domain Services
│   │   ├── ollama_service.py                  # LLM inference, dynamic greetings & unique responses
│   │   ├── rag_service.py                     # Hybrid RAG retrieval (BM25 + ChromaDB)
│   │   ├── langfuse_service.py                # Langfuse LLM observability & tracing (Task 7)
│   │   ├── mcp_service.py                     # Model Context Protocol engine
│   │   └── multi_agent_service.py             # Agent-to-Agent squad delegation
│   │
│   ├── src/                                   # Clean Architecture Layers
│   │   ├── domain/                            # Enterprise business rules & entities
│   │   ├── application/                       # Ingestion & search use cases, security guardrails
│   │   └── infrastructure/                    # ChromaDB, OpenTelemetry, structured JSON logger
│   │
│   └── tests/                                 # Automated Pytest Suites (Task 6)
│       ├── conftest.py                        # Path resolution & test fixtures
│       ├── test_multi_agent.py                # Multi-agent squad tests (25 tests)
│       ├── unit/                              # Unit test cases
│       │   ├── test_greetings.py              # Task 1 Greeting detection & variety
│       │   ├── test_unique_responses.py       # Task 2 Unsupported query variety
│       │   ├── test_chunking.py               # Document chunking tests
│       │   └── test_security_guardrails.py    # Injection & PII sanitization
│       └── integration/                       # Integration test cases
│           ├── test_response_generation.py    # Application endpoints & streaming
│           ├── test_error_handling.py         # 404, 422, and degradation tests
│           └── test_document_ingestion_pipeline.py
│
├── frontend/                                  # React + Vite + TypeScript Frontend
│   ├── Dockerfile                             # Multi-stage Nginx container
│   ├── package.json                           # Frontend dependencies
│   ├── vite.config.ts                         # Vite configuration
│   └── src/
│       ├── App.tsx                            # Main chat interface with active abort & execution time
│       ├── App.css                            # Glassmorphic AI theme, pulsing wave & skeleton loader
│       └── components/                        # UI sub-components (Sidebar, McpHub, etc.)
│
├── shared-corpus/                             # Standard 6-Contract Shared Legal Corpus
└── tests/                                     # Root tests & REST Client collections (.http)
    ├── unit/                                  # Unit tests mirror
    ├── integration/                           # Integration tests mirror
    └── api/                                   # Ready-to-run HTTP test files
```

---

## ⚙️ Installation & Configuration

### Prerequisites
- **Python**: 3.11+
- **Node.js**: 18+ and `npm`
- **Ollama**: (Local or Docker) with `llama3.2` and `nomic-embed-text` pulled
- **Docker & Docker Compose**: (Optional, for containerized run)

### Step 1: Clone & Configure Environment Variables
Copy the blueprint `.env.example` to `.env`:
```bash
cp .env.example .env
```
Key configuration parameters:
```ini
# Application
ENVIRONMENT=production
HOST=0.0.0.0
PORT=8000

# LLM & Embeddings (Local Ollama)
OLLAMA_BASE_URL=http://127.0.0.1:11434/v1
OLLAMA_MODEL=llama3.2
OLLAMA_EMBED_MODEL=nomic-embed-text

# Langfuse Observability (Task 7)
LANGFUSE_ENABLED=true
LANGFUSE_PUBLIC_KEY=pk-lf-your-public-key
LANGFUSE_SECRET_KEY=sk-lf-your-secret-key
LANGFUSE_HOST=https://cloud.langfuse.com
```

---

## 🚀 Application Execution

### Option A: Local Execution (Development Mode)

#### 1. Start Ollama and Pull Required Models
```bash
ollama pull llama3.2
ollama pull nomic-embed-text
```

#### 2. Start the FastAPI Backend
```bash
cd backend
python -m venv .venv

# On Windows:
.venv\Scripts\activate
# On Linux/macOS:
# source .venv/bin/activate

pip install -r requirements.txt
python main.py
```
*Backend runs at `http://localhost:8000` (Swagger docs at `http://localhost:8000/docs`).*

#### 3. Start the React Frontend
In a separate terminal:
```bash
cd frontend
npm install
npm run dev
```
*Frontend runs at `http://localhost:5173`.*

---

### Option B: Containerized Execution (Docker Compose)

Launch the full stack (Ollama + Backend + Frontend) in one command:
```bash
docker-compose up --build -d
```
Container endpoints:
- **Frontend Web UI**: `http://localhost:80`
- **FastAPI Backend**: `http://localhost:8000`
- **API Health Check**: `http://localhost:8000/health`
- **Ollama Engine**: `http://localhost:11434`

---

## 🧪 Automated Testing with Pytest (Task 6)

The application includes comprehensive unit and integration test suites validating functionality, response generation, uniqueness, error handling, and security:

```bash
# Run all unit and integration tests
pytest backend/tests/unit backend/tests/integration -v

# Run Task 1 Greeting Section tests
pytest backend/tests/unit/test_greetings.py -v

# Run Task 2 Unique Response Generation tests
pytest backend/tests/unit/test_unique_responses.py -v

# Run API Integration & Stream Generation tests
pytest backend/tests/integration/test_response_generation.py -v

# Run Error Handling & Edge Case tests
pytest backend/tests/integration/test_error_handling.py -v

# Run Multi-Agent Squad tests (25 tests)
pytest backend/tests/test_multi_agent.py -v
```

---

## 📊 Langfuse LLM Observability & Monitoring (Task 7)

The application natively integrates with [Langfuse](https://langfuse.com) to provide full-lifecycle tracing:

1. **Prompt & Generation Tracking**: Every chat turn and RAG retrieval records input prompts, output responses, model version, and token metrics.
2. **Retrieval Spans**: Context chunks, document IDs, similarity scores, and section citations are captured as dedicated spans inside each trace.
3. **Execution Latency**: End-to-end wall-clock time and LLM generation time are recorded in milliseconds.
4. **Graceful Fallback**: If Langfuse credentials are not provided or `LANGFUSE_ENABLED=false`, the service operates in non-blocking no-op mode without throwing exceptions or delaying user responses.

---

## 🔒 Security & Guardrails

- **Zero Hallucination Refusal**: Unrelated queries are strictly refused with dynamic, polite responses without fabrications.
- **Prompt Injection Shield**: Adversarial inputs and delimiter hijacking inside documents are blocked before reaching the LLM context.
- **PII Masking**: Customer emails, telephone numbers, and credentials are obfuscated via regex sanitizers.
- **Session Privacy**: Conversations are isolated per user session via `X-Session-ID` header protection.
