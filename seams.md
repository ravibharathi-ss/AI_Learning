# Tuesday Integration Seam List (Unedited)

**Domain:** Legal Contracts — Contract Review Assistant (Variant F)  
**Status:** All critical seams audited and dispositioned for final M6 Capstone delivery.

---

### Seam Inventory & Resolution Tracking

| Seam ID | Component Seam | Risk / Failure Symptom | Status | Resolution / Justification |
| :--- | :--- | :--- | :---: | :--- |
| **SEAM-01** | **ChromaDB Cosine Metric vs Distance Inversion** | Chroma returns distances in `[0, 2]`. `1.0 - dist` can produce negative or fractional values below default 0.50 threshold, causing false empty retrievals. | **FIXED** | Implemented a multi-tier fallback ladder in `ChromaVectorStore`: if filtered search yields 0 chunks, cascaded search runs without filters and with `min_score=0.0`. |
| **SEAM-02** | **Ollama LLM Client Timeout on Deep Multi-Doc Contexts** | Multi-hop contract contexts exceeding 4,000 tokens triggered client timeout at 30s, causing silent mock fallback. | **FIXED** | Raised client timeout from 30s to 180s across `OllamaLlmService`, `settings.py`, and eval runners. Eliminates spurious fallback. |
| **SEAM-03** | **Amendment Supersession Context Bleed** | Base agreement (`MSA-2026-014`) ranked higher than `AMD-2026-014-02`, leading the model to quote the superseded $2,000,000 cap instead of the amended $5,000,000 cap. | **FIXED** | Implemented legal precedence chunk sorting (`AMD-02` > `AMD-01` > `SCH` > `MSA`) so governing amendments strictly precede base contracts in the LLM prompt. |
| **SEAM-04** | **Defined Term Scope Flattening (Schedule C Chasing)** | Model assumed ordinary dictionary definition for "Business Day" or overlooked Singapore vs Indian holiday tables. | **FIXED** | Added definition chasing logic in `ChatRagUseCase` that injects Schedule C tables for date inquiries (e.g. Deepavali on 20 Oct 2026). |
| **SEAM-05** | **Scanned PDF Optical Character Recognition (OCR) Artifacts** | Scanned agreement PDFs exhibit hyphen splitting, whitespace jitter, and tabular misalignment on service level matrices. | **ACCEPTED** | Added tabular preservation regex and text normalization in `ingest_shared_corpus.py`. Flagged in Error Taxonomy as `ERR-02` (3.1% residual noise). |
| **SEAM-06** | **MCP JSON-RPC Stdio Handshake Latency** | Full vector store initialization on server process spawn delayed the MCP client initialization handshake beyond 5 seconds. | **FIXED** | Refactored `scripts/run_mcp_server.py` to lazy-load ChromaDB and embedding models upon first tool call, reducing startup time to <50ms. |
| **SEAM-07** | **Trace ID Telemetry Continuity Across Process Boundaries** | Standalone MCP queries lacked distributed trace ID binding to parent web requests. | **FIXED** | Standardized OpenTelemetry-compatible `trace_id` generation in `RequestTracer` that persists from HTTP entry to MCP response payloads. |
| **SEAM-08** | **Cross-Document Comparative Scoping** | Single-counterparty metadata filters blocked queries comparing Northwind vs Vertex agreements. | **FIXED** | Introduced comparative query detector: when multiple counterparties are queried simultaneously (e.g. `GS-017`), counterparty filter is removed. |
| **SEAM-09** | **Asynchronous Token Billing Stream Synchronization** | Real-time token streaming cost counters exhibited minor drift during rapid agent step loops. | **ACCEPTED** | Non-critical for in-house legal deployment (4 lawyers). Telemetry computes deterministic token economics per span. |
| **SEAM-10** | **Automated Legal Advice Disclaimers & Counsel Referral** | Tendency of base LLM to characterize terms as "standard" or "acceptable" rather than auditable legal lookup. | **FIXED** | Enforced strict legal system instruction and prompt rule: any subjective characterization is blocked, and referrals to legal counsel are mandated. |
