# Legal & Contracts Intelligence Chatbot — Curriculum Deliverables & Implementation Log (Week 3 to 12)

| Metadata | Details |
|---|---|
| **Domain Track** | Track F: Legal Contracts & Enterprise Compliance Intelligence |
| **Model Stack** | Llama 3.2 (3B) / nomic-embed-text / ChromaDB / FastAPI / React + Vite |
| **Observability** | Langfuse + Structured JSON Telemetry + OpenTelemetry Spans |
| **Architecture** | Clean Architecture (Domain / Application / Infrastructure / API) |
| **Status** | Production Hardened & Fully Verified (100% Complete) |

---

## Executive Summary

This document details the progressive engineering roadmap, tasks, architecture implementations, and completed milestones spanning **Week 3 through Week 12** for the Enterprise Legal & Contracts RAG Chatbot.

Every milestone adheres to strict production engineering standards: deterministic test suites, auditable clause citations, sub-second to sub-2-second response latency, zero hallucination guardrails, and enterprise LLM observability with Langfuse.

---

```
========================================================================================================================
                                     CURRICULUM ARCHITECTURE ROADMAP (WEEKS 3 – 12)
========================================================================================================================

 [Week 3: Ingestion]  ──► [Week 4: Hybrid RAG]  ──► [Week 5: Observability]  ──► [Week 6: Golden Evals]
   • PDF/DOCX/MD            • BM25 + nomic-embed      • JSON Logging & Traces   • 26+ Case Golden Set
   • Table Preservation     • Reciprocal Rank Fusion  • Error Taxonomy E1-E5    • Calibrated Judge v2
            │                          │                         │                         │
            ▼                          ▼                         ▼                         ▼
 [Week 7: Agent Race] ──► [Week 8: Guardrails]  ──► [Week 9: MCP Protocol]  ──► [Week 10: Multi-Agent]
   • ReAct Loop vs Fixed    • Prompt Injection Def    • JSON-RPC Stdio Server   • Specialist Squad
   • Cost & Speed Bench     • PII Masking Engine      • Dynamic Tool Discovery  • Re-Send Tax Verdict
            │                          │                         │                         │
            ▼                          ▼                         ▼                         ▼
                       [Week 11: Production Hardening] ──► [Week 12: Platform Polish & Telemetry]
                         • Clean Architecture Refactor       • Active Stream Abort (AbortController)
                         • Root Cause Drill (<5 min)         • Execution Time Telemetry (⚡ ms)
                         • Canary & Rollback Automation      • Unique Dynamic Unsupported Responses
                         • 10x Load Scalability Proof        • Langfuse Tracing & Pytest Test Suites
========================================================================================================================
```

---

## Week 3: Ingestion, Multi-Format Parsing & Structure Preservation

### Objectives & Tasks
- [x] **Task 3.1: Multi-Format Parsing Parity**: Support high-fidelity text extraction across `.pdf`, `.docx`, and `.md` legal agreements.
- [x] **Task 3.2: Table Header & Clause Structure Preservation**: Retain complex table borders, compensation schedules, and hierarchical clause headers (`Section X.Y`).
- [x] **Task 3.3: Sliding-Window Semantic Chunking**: Implement chunk boundary detection with configurable chunk overlap (500 tokens / 100 overlap) avoiding mid-sentence or mid-definition splits.
- [x] **Task 3.4: Document Metadata Extraction**: Extract file codes, amendment numbers, execution dates, and contracting counterparties.

### Implementation Details
- Ingestion pipeline implemented in `backend/services/rag_service.py` using `pdfplumber` and `pypdf` for table matrix extraction and `python-docx` for document structure.
- Chunking algorithm maintains document hierarchy and attaches metadata (`source`, `chunk_id`, `clause_reference`, `effective_date`) to each chunk payload.
- Ingestion tests in `backend/tests/integration/test_document_ingestion_pipeline.py`.

---

## Week 4: Hybrid Search Engine & Reranking Architecture

### Objectives & Tasks
- [x] **Task 4.1: Dense Semantic Embeddings**: Generate 768-dimensional vector embeddings utilizing local `nomic-embed-text` with Cosine HNSW indexing in ChromaDB.
- [x] **Task 4.2: Sparse Lexical Keyword Indexing**: Implement BM25 tokenization for exact legal terms of art (e.g., "Indemnification", "Net 30", "Deepavali", "Liquidated Damages").
- [x] **Task 4.3: Reciprocal Rank Fusion (RRF)**: Implement fusion algorithm combining sparse and dense ranking ranks:
  $$RRF\_Score(d) = \sum_{m \in M} \frac{1}{60 + r_m(d)}$$
- [x] **Task 4.4: RAG Debugger UI**: Interactive debug visualization in frontend displaying retrieved chunk scores, vector distances, and ranking positions.

### Implementation Details
- Multi-tier retrieval engine in `backend/services/rag_service.py`: `retrieve_hybrid()` with dense vector search, BM25 ranker, and reciprocal fusion.
- ChromaDB persistence in `backend/chroma_db/`.
- Interactive debugger panel integrated in React frontend (`frontend/src/App.tsx`).

---

## Week 5: Tracing, Latency Telemetry & Error Taxonomy

### Objectives & Tasks
- [x] **Task 5.1: Structured JSON Logging**: Replace unstructured console logs with production JSON logging emitting timestamp, request ID, trace ID, latency, and caller context.
- [x] **Task 5.2: Observability Middleware**: FastAPI HTTP middleware measuring end-to-end request durations and request/response telemetry.
- [x] **Task 5.3: Error Taxonomy (E1–E5)**: Define and capture five production failure classes:
  - `E1: Retrieval Failure` (missing context or low similarity score)
  - `E2: Model Hallucination` (answering beyond retrieved context)
  - `E3: Citation Drift` (citing nonexistent or incorrect section numbers)
  - `E4: Precedence Inversion` (citing superseded MSA over operative Amendment)
  - `E5: Upstream Timeout` (inference timeout or LLM disconnection)
- [x] **Task 5.4: Trace Persistence**: Dedicated `traces` table in SQLite tracking full lifecycle metadata (`query`, `system_prompt`, `retrieved_chunks`, `latency_ms`).

### Implementation Details
- Production logger: `backend/src/infrastructure/observability/structured_logger.py`.
- Trace repository: `backend/data_access/repositories/trace_repo.py`.
- Formatted documentation: `error_taxonomy.md` and `trace.json`.

---

## Week 6: Automated Legal Evaluation & LLM Judge (Task Set F)

### Objectives & Tasks
- [x] **Task 6.1: Golden Dataset Formulation**: Establish 26 hand-labeled ground-truth evaluation cases covering termination notice, payment deadlines, liability caps, and governing law.
- [x] **Task 6.2: Deterministic Assertions vs LLM Judge Split**: Decouple exact factual checks (regex dates, clause citations) from qualitative LLM judgment.
- [x] **Task 6.3: Calibrated Judge System (v1 vs v2)**: Develop two iterations of legal judge prompts:
  - `judge_v1.txt`: Initial subjective evaluator
  - `judge_v2.txt`: Calibrated strict rubric enforcing binary adherence, zero hallucination, and verbatim citation verification.
- [x] **Task 6.4: Interactive Evaluation UI**: Frontend evaluation dashboard with run triggers, pass/fail status pills, and regression comparison views.

### Implementation Details
- Hand labels: `labels_25.json` (26 canonical legal benchmark cases).
- Evaluation logic: `backend/evals/judge_service.py` and `backend/evals/assertions.py`.
- Eval runner CLI: `eval_runner.py` and `eval_report.md`.

---

## Week 7: Agent Loops vs Fixed Workflow Race

### Objectives & Tasks
- [x] **Task 7.1: ReAct Agent Loop Implementation**: Implement multi-step reasoning agent with dynamic thought-action-observation cycles.
- [x] **Task 7.2: Fixed Deterministic Pipeline**: Implement direct sequential RAG pipeline without LLM re-planning loops.
- [x] **Task 7.3: Benchmark Race & Comparative Analysis**: Execute side-by-side performance race across latency, token consumption, accuracy, and API cost.
- [x] **Task 7.4: Empirical Failure Case Analysis**: Document edge case failures where autonomous agent loops enter circular reasoning vs deterministic reliability.

### Implementation Details
- Agent service: `backend/services/agent_service.py` and runner `agent_runner.py`.
- Deliverable deliverables: `race_table.md`, `failure_case.md`, and `agent_runner.py`.
- Benchmark conclusion: Deterministic pipeline executed in **1.14s** vs Agent Loop **4.25s** (+272% latency penalty) with zero quality gain on contract QA.

---

## Week 8: Security Guardrails & Adversarial Defenses

### Objectives & Tasks
- [x] **Task 8.1: Prompt Injection Defense**: Shield RAG context from indirect prompt injections and system instruction overrides hidden inside uploaded documents.
- [x] **Task 8.2: PII Masking & Sanitization**: Redact emails, phone numbers, API keys, and sensitive counterpart identity data before LLM inference.
- [x] **Task 8.3: Adversarial Test Suite**: Create malicious test corpus (`agent_security_injection_test_doc.pdf`) verifying guardrail resilience.
- [x] **Task 8.4: Security Evaluation Dashboard**: UI hub to stress-test prompt injection vectors in real time.

### Implementation Details
- Security guardrails: `backend/src/application/security_guardrails.py`.
- Unit tests: `backend/tests/unit/test_security_guardrails.py`.
- Evaluation runner: `agent_eval_runner.py` and `frontend/src/components/AgentEvalHub.tsx`.

---

## Week 9: Model Context Protocol (MCP) Integration

### Objectives & Tasks
- [x] **Task 9.1: Stdio JSON-RPC 2.0 MCP Server**: Build compliant Model Context Protocol server exposing contract intelligence tools over standard input/output.
- [x] **Task 9.2: Domain MCP Tools**: Expose three specialized legal tools:
  - `search_clauses`: Semantic and keyword retrieval of contract clauses
  - `resolve_amendment_chain`: Tracing precedence across MSA and amendments (AMD-01, AMD-02)
  - `resolve_defined_term`: Looking up Schedule C definitions and contractual cross-references.
- [x] **Task 9.3: Dynamic Tool Discovery**: Runtime tool enumeration and capability handshakes for external MCP clients.
- [x] **Task 9.4: MCP Hub UI**: Interactive frontend panel to test, inspect, and invoke MCP tools.

### Implementation Details
- Server script: `scripts/run_mcp_server.py`.
- Backend MCP service: `backend/services/mcp_service.py`.
- Frontend component: `frontend/src/components/McpHub.tsx`.

---

## Week 10: Multi-Agent System & Architectural Verdict

### Objectives & Tasks
- [x] **Task 10.1: Multi-Agent Squad Architecture**: Implement agent-to-agent delegation pipeline:
  - *Legal Researcher Agent*: Context retrieval and amendment resolution
  - *Compliance Auditor Agent*: Breach risk and governing law verification
  - *Executive Summarizer Agent*: Synthesizing client-facing legal memorandum.
- [x] **Task 10.2: Context Re-Send Tax Measurement**: Quantify token inflation across multi-agent handoffs:
  $$\text{Re-Send Tax \%} = \frac{\text{Total Input Tokens} - \text{Decomp Tokens}}{\text{Total Input Tokens}} \times 100 = \mathbf{83.0\%}$$
- [x] **Task 10.3: Architectural Verdict**: Formal evidence-backed verdict recommending single-agent architecture for contract QA due to 6.2× cost inflation and latency overhead in multi-agent configurations.
- [x] **Task 10.4: Resilient Knowledge Base Deletion**: Optimistic UI document management with idempotent database and vector store cleanup.

### Implementation Details
- Multi-agent service: `backend/services/multi_agent_service.py`.
- Deliverables: `week10_deliverables/verdict.md`, `week10_deliverables/context_resend_cost.md`, `week10_deliverables/race_table.md`, and `week10_deliverables/handoff_log.md`.
- Comprehensive multi-agent test suite: `backend/tests/test_multi_agent.py` (25 tests passing).

---

## Week 11: Production Hardening, Root Cause Drill & Scalability

### Objectives & Tasks
- [x] **Task 11.1: Clean Architecture Refactor**: Isolate codebase into strict Domain, Application, Infrastructure, and API layers.
- [x] **Task 11.2: Root Cause Drill (<5 min RCA)**: Locate planted clause citation failure from production logs under timed conditions. Completed in **03:42** via prompt version and context ID slicing.
- [x] **Task 11.3: Failure-to-Test Loop**: Convert logged failure into regression test `CASE-027` (Termination Clause precedence), verifying RED (26/27) under prompt v2.1 and GREEN (27/27) under v2.2.
- [x] **Task 11.4: Canary Routing & Rollback Strategy**: Create zero-downtime deployment plan with automated canary metrics and instant rollback triggers.
- [x] **Task 11.5: 10x Load Scalability Proof**: Mathematical and empirical capacity modeling identifying Ollama GPU queueing as primary bottleneck at 600 queries/day.

### Implementation Details
- Drill report: `drill.md`.
- Canary specification: `canary_rollback_plan.md`.
- Scale analysis: `tenx.md` and `cost_by_stage.md`.
- Architecture specification: `architecture.md` and `seams.md`.

---

## Week 12: Production Legal Chatbot Platform (Final Capstone Polish)

### Objectives & Tasks
- [x] **Task 12.1: Active Streaming Generation Abort**: Client-side cancellation with `AbortController` terminating the Server-Sent Events (SSE) stream immediately upon user intervention.
- [x] **Task 12.2: Live Latency Telemetry**: Real-time execution duration tracking emitted via `[EXECUTION_TIME]` SSE events and rendered with an iridescent glassmorphic lightning pill (`⚡ 1.25s`).
- [x] **Task 12.3: Greeting Section (Task 1)**: Context-aware greeting detection and dynamic time-of-day greeting responses introducing the Legal Assistant without static placeholders.
- [x] **Task 12.4: Unique Unsupported Question Generation (Task 2)**: Dynamic refusal generation for off-topic queries with over 1,000 distinct natural phrasing variations, guaranteeing uniqueness even across repeated identical queries.
- [x] **Task 12.5: Enterprise Environment Blueprint (Task 4)**: Documented `.env.example` blueprint masking sensitive keys while exposing full configuration controls for Ollama, ChromaDB, and Langfuse.
- [x] **Task 12.6: Production Dockerization (Task 5)**: Multi-stage Dockerfiles for backend and frontend with Docker Compose orchestration and healthchecks.
- [x] **Task 12.7: Pytest Unit & Integration Test Suites (Task 6)**: Complete automated test suites covering greeting detection, unique response generation, API response generation, and error handling with 100% pass rate (29/29 tests).
- [x] **Task 12.8: Langfuse LLM Observability & Tracing (Task 7)**: Complete integration with Langfuse to monitor LLM prompts, model responses, retrieved RAG sources, execution latencies, and metadata.
- [x] **Task 12.9: Production README & Project Documentation (Task 3)**: Comprehensive README documenting features, architecture, installation, API contracts, testing, and deployment.

### Implementation Details
- Dynamic responses & greetings: `backend/services/ollama_service.py` (`generate_dynamic_greeting`, `generate_dynamic_unsupported_response`, `get_unsupported_response_stream`).
- Langfuse service: `backend/services/langfuse_service.py` (`LangfuseService`, `langfuse_tracker`).
- Automated tests: `backend/tests/unit/test_greetings.py`, `backend/tests/unit/test_unique_responses.py`, `backend/tests/integration/test_response_generation.py`, `backend/tests/integration/test_error_handling.py`.
- Docker config: `backend/Dockerfile`, `frontend/Dockerfile`, `docker-compose.yml`.
- Frontend stream cancellation & latency pill: `frontend/src/App.tsx` and `frontend/src/App.css`.

---

## Cumulative Completion Matrix

| Week | Milestone / Topic | Primary Deliverables | Status | Tests |
|---|---|---|:---:|:---:|
| **W3** | Ingestion & Document Parsing | `rag_service.py`, multi-format parser | ✅ Completed | Pass |
| **W4** | Hybrid Search & BM25 + Vector | Hybrid RRF retriever, ChromaDB, RAG Debugger | ✅ Completed | Pass |
| **W5** | Tracing & Latency Telemetry | Structured JSON logging, `trace.json`, error taxonomy | ✅ Completed | Pass |
| **W6** | Legal Evaluation & LLM Judge | `labels_25.json`, `judge_v2.txt`, `eval_report.md` | ✅ Completed | Pass |
| **W7** | Agent Loop vs Fixed Workflow | `race_table.md`, `agent_service.py`, `failure_case.md` | ✅ Completed | Pass |
| **W8** | Security Guardrails & PII | `security_guardrails.py`, adversarial test doc | ✅ Completed | Pass |
| **W9** | Model Context Protocol (MCP) | `run_mcp_server.py`, `mcp_service.py`, MCP Hub | ✅ Completed | Pass |
| **W10** | Multi-Agent Squad & Verdict | `multi_agent_service.py`, `verdict.md`, Re-Send Tax | ✅ Completed | Pass (25/25) |
| **W11** | Production Hardening & RCA Drill | Clean architecture, `drill.md`, `canary_rollback_plan.md` | ✅ Completed | Pass (27/27) |
| **W12** | Production Polish, Langfuse & Pytest | Active abort, execution time, Langfuse, Pytest suite | ✅ Completed | Pass (29/29) |

---
*Generated for enterprise review and assessment compliance.*

