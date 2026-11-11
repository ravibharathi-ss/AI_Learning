# Curriculum Tasks & Implementation Log (Week 3 to 12)

| Metadata | Description |
|---|---|
| **Domain Track** | Track F: Enterprise Legal & Contracts Intelligence Platform |
| **Model Stack** | Llama 3.2 (3B) / nomic-embed-text / ChromaDB / FastAPI / React + Vite |
| **Observability** | Langfuse + Structured JSON Telemetry + OpenTelemetry Spans |
| **Primary Working Branch** | `main` |

---

## Week 3 to 12 Implementation Matrix

| week | task | implemented | if choice oriented which branch implemented the research |
| :---: | :--- | :---: | :--- |
| **Week 3** | **Multi-Format Legal Document Ingestion & Structure Preservation**<br>• Ingest `.pdf`, `.docx`, and `.md` legal contracts with format parity.<br>• Preserve hierarchical clause headers (`Section X.Y`) and compensation table structures.<br>• Sliding-window semantic chunking (500 tokens / 100 overlap) avoiding split clauses.<br>• Metadata extraction: execution dates, counterparties, amendment identifiers. | Yes | `main`<br>*(Researched parser libraries: `pdfplumber` + `python-docx` selected over raw text split for zero table/clause loss)* |
| **Week 4** | **Hybrid Search Engine & Reranking Architecture**<br>• Dense vector embeddings (768-dim `nomic-embed-text`) with Cosine HNSW indexing in ChromaDB.<br>• Sparse lexical indexing with BM25 for legal terms of art ("Indemnification", "Net 30").<br>• Reciprocal Rank Fusion (RRF) combining dense & sparse scores ($k=60$).<br>• RAG Debugger dashboard showing scores, distances, and ranking positions. | Yes | `main`<br>*(Researched Dense-only vs BM25 Sparse vs Hybrid RRF; Hybrid RRF chosen for 100% clause recall)* |
| **Week 5** | **Observability, Latency Telemetry & Error Taxonomy**<br>• Structured JSON logging with request ID, trace ID, latency, and caller context.<br>• HTTP middleware measuring end-to-end request latency.<br>• Error Taxonomy classification: E1 (Retrieval), E2 (Hallucination), E3 (Citation Drift), E4 (Precedence Inversion), E5 (Timeout).<br>• Persistent OpenTelemetry trace logging in SQLite database (`trace.json`). | Yes | `main`<br>*(Researched OpenTelemetry SDK vs custom structured JSON logging; integrated hybrid JSON trace spans)* |
| **Week 6** | **Automated Legal Evaluation & Calibrated LLM Judge (Task Set F)**<br>• 26-case Golden Set with blind hand-labels (`labels_25.json`).<br>• Decoupled deterministic assertions (dates, citations) from qualitative LLM judgment.<br>• Calibrated judge prompts: `judge_v1.txt` (subjective) vs `judge_v2.txt` (calibrated binary rubric).<br>• Interactive frontend evaluation UI with pass/fail telemetry and regression diffs. | Yes | `main`<br>*(Researched Subjective LLM Judge vs Calibrated Deterministic Split; calibrated prompt v2 eliminated judge drift)* |
| **Week 7** | **Agent Loops vs Fixed Deterministic Workflow Race**<br>• Autonomous ReAct Agent Loop with multi-step dynamic thought-action-observation cycles.<br>• Fixed sequential deterministic RAG pipeline.<br>• Benchmark performance race across latency, token cost, and factual grounding (`race_table.md`).<br>• Empirical edge-case failure analysis on circular reasoning (`failure_case.md`). | Yes | `main`<br>*(Researched ReAct Agent Loop vs Fixed Workflow; Fixed Workflow won with 272% speedup and identical legal accuracy)* |
| **Week 8** | **Security Guardrails, Prompt Injection Defense & PII Redaction**<br>• Shield context from indirect prompt injections and system overrides in documents.<br>• Automated PII sanitization masking emails, phone numbers, and sensitive client keys.<br>• Adversarial test suite (`agent_security_injection_test_doc.pdf`).<br>• Live security evaluation hub in frontend. | Yes | `main`<br>*(Researched Model-based LLM guardrails vs Deterministic regex sanitizer + delimiter boundary isolation; deterministic sanitizer chosen for zero latency)* |
| **Week 9** | **Model Context Protocol (MCP) Integration**<br>• Compliant Model Context Protocol server over JSON-RPC 2.0 stdio socket (`scripts/run_mcp_server.py`).<br>• Domain tools: `search_clauses`, `resolve_amendment_chain`, and `resolve_defined_term`.<br>• Runtime tool discovery and capability negotiation for external MCP clients.<br>• Interactive MCP Hub UI with collapsible side navigation. | Yes | `main`<br>*(Researched HTTP REST tool wrappers vs Standard JSON-RPC 2.0 Stdio MCP Protocol; official Stdio protocol chosen)* |
| **Week 10** | **Multi-Agent System & Context Re-Send Tax Verdict**<br>• Agent-to-Agent (A2A) delegation squad: Legal Researcher, Compliance Auditor, and Executive Summarizer.<br>• Measured Context Re-Send Tax ($83.0\%$ token inflation across LLM handoffs).<br>• Architectural Verdict: Single Monolithic Agent outperforms Multi-Agent Squad for contract QA by 6.2× cost efficiency.<br>• Resilient knowledge base deletion with optimistic UI updates. | Yes | `main`<br>*(Researched Multi-Agent Specialist Squad vs Single Monolithic Agent; Empirical verdict kept Single Agent for production)* |
| **Week 11** | **Production Hardening, Root Cause Drill & Scalability Proof**<br>• Clean Architecture refactor: Domain, Application, Infrastructure, and API layers.<br>• Production RCA drill: Located planted clause citation bug from logs in **03:42** (<5 min SLA).<br>• Failure-to-test loop: Created test `CASE-027`, verified RED (26/27) under v2.1 & GREEN (27/27) under v2.2.<br>• Canary deployment plan with automated rollback criteria (`canary_rollback_plan.md`).<br>• 10x scalability load proof identifying Ollama GPU queueing bottleneck (`tenx.md`). | Yes | `main`<br>*(Researched Prompt Engineering v2.2 fix vs ChromaDB re-indexing; Prompt fix selected with canary rollback plan)* |
| **Week 12** | **Production Legal Chatbot Platform (Final Capstone Polish)**<br>• **Task 1: Greeting Section** — Context-aware detection (`Hi`, `Hello`, `Good morning`) & dynamic time-aware greetings without static text.<br>• **Task 2: Unique Response Generation** — Dynamic streaming refusal for unsupported questions with >1,000 distinct variations ensuring uniqueness even across repeated queries.<br>• **Task 3: README Documentation** — Enterprise documentation covering architecture, setup, Docker, APIs, and Pytest.<br>• **Task 4: Environment Configuration** — Complete `.env.example` blueprint for Ollama, ChromaDB, and Langfuse.<br>• **Task 5: Docker Integration** — Multi-stage containers & `docker-compose.yml` with health checks.<br>• **Task 6: Pytest Implementation** — Comprehensive unit and integration test suites (29/29 tests passing).<br>• **Task 7: Langfuse Integration** — LLM prompt, output, source chunk, and latency monitoring with non-blocking fallback.<br>• **Active Stream Cancellation** — Stop running generation via client-side `AbortController`.<br>• **Real-Time Execution Time** — Latency telemetry emitted via `[EXECUTION_TIME]` and styled with iridescent lightning badge (`⚡ 1.25s`). | Yes | `main`<br>*(Researched Client-side `AbortController` cancellation vs server socket drops; Langfuse SDK integration vs raw HTTP tracing)* |

---

## Detailed Task Breakdown by Week

### Week 3: Ingestion & Document Parsing Parity
- **Tasks**: Multi-format parsing (`.pdf`, `.docx`, `.md`), table preservation, semantic chunking, metadata extraction.
- **Implementation**: Implemented in [`backend/services/rag_service.py`](file:///d:/Program%20files/ChatBot/backend/services/rag_service.py) and [`shared-corpus/`](file:///d:/Program%20files/ChatBot/shared-corpus/).
- **Research Branch**: `main` — Researched `pdfplumber` vs `pypdf` vs `python-docx`; adopted hybrid parser with table structure preservation.

### Week 4: Hybrid Search Engine & Reranking
- **Tasks**: Dense vector embeddings with ChromaDB, sparse BM25 indexing, Reciprocal Rank Fusion (RRF), RAG Debugger UI.
- **Implementation**: Implemented in [`backend/services/rag_service.py`](file:///d:/Program%20files/ChatBot/backend/services/rag_service.py) (`retrieve_hybrid`) and [`frontend/src/App.tsx`](file:///d:/Program%20files/ChatBot/frontend/src/App.tsx).
- **Research Branch**: `main` — Benchmarked dense semantic search against sparse BM25; RRF combined both to prevent missed keyword clauses.

### Week 5: Tracing, Latency Telemetry & Error Taxonomy
- **Tasks**: Structured JSON logging, latency middleware, E1–E5 error taxonomy, OpenTelemetry trace persistence.
- **Implementation**: Implemented in [`backend/src/infrastructure/observability/`](file:///d:/Program%20files/ChatBot/backend/src/infrastructure/observability/), [`error_taxonomy.md`](file:///d:/Program%20files/ChatBot/error_taxonomy.md), and [`trace.json`](file:///d:/Program%20files/ChatBot/trace.json).
- **Research Branch**: `main` — Compared OpenTelemetry exporters with standard JSON output; selected contextual structured JSON with correlation IDs.

### Week 6: Automated Legal Evaluation & LLM Judge
- **Tasks**: 26-case Golden Set, deterministic assertions, calibrated judge prompts (v1 vs v2), evaluation UI.
- **Implementation**: Implemented in [`backend/evals/judge_service.py`](file:///d:/Program%20files/ChatBot/backend/evals/judge_service.py), [`labels_25.json`](file:///d:/Program%20files/ChatBot/labels_25.json), and [`eval_report.md`](file:///d:/Program%20files/ChatBot/eval_report.md).
- **Research Branch**: `main` — Evaluated subjective judge v1 vs calibrated rubric v2; prompt v2 eliminated non-deterministic judge drift.

### Week 7: Agent Loops vs Fixed Workflow Race
- **Tasks**: ReAct agent loops, fixed workflow pipeline, side-by-side benchmark race, failure case analysis.
- **Implementation**: Implemented in [`backend/services/agent_service.py`](file:///d:/Program%20files/ChatBot/backend/services/agent_service.py), [`agent_runner.py`](file:///d:/Program%20files/ChatBot/agent_runner.py), and [`race_table.md`](file:///d:/Program%20files/ChatBot/race_table.md).
- **Research Branch**: `main` — ReAct loops added 272% latency without improving accuracy; deterministic fixed workflow selected as default.

### Week 8: Security Guardrails & Adversarial Defenses
- **Tasks**: Prompt injection defense, PII sanitization, adversarial test corpus, security eval UI.
- **Implementation**: Implemented in [`backend/src/application/security_guardrails.py`](file:///d:/Program%20files/ChatBot/backend/src/application/security_guardrails.py) and [`agent_eval_runner.py`](file:///d:/Program%20files/ChatBot/agent_eval_runner.py).
- **Research Branch**: `main` — Researched LLM-based guardrail agents vs fast regex/delimiter filters; regex filters chose for zero latency overhead.

### Week 9: Model Context Protocol (MCP) Integration
- **Tasks**: JSON-RPC 2.0 stdio MCP server, domain legal tools, dynamic tool discovery, MCP Hub UI.
- **Implementation**: Implemented in [`scripts/run_mcp_server.py`](file:///d:/Program%20files/ChatBot/scripts/run_mcp_server.py) and [`backend/services/mcp_service.py`](file:///d:/Program%20files/ChatBot/backend/services/mcp_service.py).
- **Research Branch**: `main` — Standardized on official Model Context Protocol (MCP) over custom REST endpoints.

### Week 10: Multi-Agent System & Context Re-Send Tax
- **Tasks**: Multi-agent specialist squad, Context Re-Send Tax quantification, architectural verdict.
- **Implementation**: Implemented in [`backend/services/multi_agent_service.py`](file:///d:/Program%20files/ChatBot/backend/services/multi_agent_service.py) and [`week10_deliverables/verdict.md`](file:///d:/Program%20files/ChatBot/week10_deliverables/verdict.md).
- **Research Branch**: `main` — Empirical benchmark proved 83% re-send token tax; single monolithic agent retained for contract Q&A.

### Week 11: Production Hardening, RCA Drill & Scalability
- **Tasks**: Clean architecture refactoring, sub-5min RCA drill, failure-to-test loop, canary rollback plan, 10x scale proof.
- **Implementation**: Implemented in [`architecture.md`](file:///d:/Program%20files/ChatBot/architecture.md), [`drill.md`](file:///d:/Program%20files/ChatBot/drill.md), [`canary_rollback_plan.md`](file:///d:/Program%20files/ChatBot/canary_rollback_plan.md), and [`tenx.md`](file:///d:/Program%20files/ChatBot/tenx.md).
- **Research Branch**: `main` — Prompt v2.2 fix verified with RED&rarr;GREEN progression; canary deployment plan specified.

### Week 12: Production Legal Chatbot Platform (Final Capstone Polish)
- **Tasks**: Tasks 1 through 8 (Dynamic greetings, unique unsupported responses, README, environment config, Docker, Pytest, Langfuse integration, active streaming abort, execution time telemetry).
- **Implementation**: Implemented in [`backend/main.py`](file:///d:/Program%20files/ChatBot/backend/main.py), [`backend/services/ollama_service.py`](file:///d:/Program%20files/ChatBot/backend/services/ollama_service.py), [`backend/services/langfuse_service.py`](file:///d:/Program%20files/ChatBot/backend/services/langfuse_service.py), [`backend/tests/`](file:///d:/Program%20files/ChatBot/backend/tests/), and [`frontend/src/App.tsx`](file:///d:/Program%20files/ChatBot/frontend/src/App.tsx).
- **Research Branch**: `main` — Implemented dynamic non-repetitive response generation and native Langfuse SDK tracing with non-blocking graceful fallback.
