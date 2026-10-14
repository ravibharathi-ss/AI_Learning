# One-Page Architecture Sketch — Contract Review Assistant (Variant F)

```
========================================================================================================================
                                      CONTRACT REVIEW ASSISTANT — ARCHITECTURE
========================================================================================================================

                                        [ Legal Counsel / Sales User ]
                                                      │
                                                      │ 1. HTTP JSON Request (Query + Counterparty)
                                                      ▼
 ┌────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
 │  API GATEWAY / FASTAPI RUNTIME (backend/src/api/main.py :8000)                                                    │
 │  • /api/chat        • /api/documents     • /api/contracts/query    • /api/evaluation                               │
 │  • /health/ready    • /api/traces        • /api/mcp/tools/call     • OpenTelemetry Context Propagation            │
 └────────────────────────────────────────────────────┬───────────────────────────────────────────────────────────────┘
                                                      │
                                                      ▼
 ┌────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
 │  APPLICATION & ORCHESTRATION LAYER (backend/src/application/)                                                     │
 │                                                                                                                    │
 │   [ SecurityGuardrails ] ──► Threat Sanitizer & PII Masking (Redacts emails, phone numbers, secret keys)           │
 │            │                                                                                                       │
 │            ▼                                                                                                       │
 │   [ ChatRagUseCase / Agent Loop ] ──► Orchestrates Multi-Tool Legal Reasoning:                                    │
 │            │                          1. Counterparty Disambiguation                                               │
 │            │                          2. Legal Precedence Sorting (AMD-02 > AMD-01 > SCH > MSA)                    │
 │            │                          3. Schedule C Defined-Term Chasing                                           │
 │            │                                                                                                       │
 └────────────┼───────────────────────────────────────────────────────────────────────┬───────────────────────────────┘
              │                                                                       │
              ▼                                                                       ▼
 ┌──────────────────────────────────────────────┐              ┌──────────────────────────────────────────────────────┐
 │  LOCAL EMBEDDING & VECTOR STORAGE            │              │  MODEL CONTEXT PROTOCOL (MCP) INTERFACE              │
 │                                              │              │                                                      │
 │  [ nomic-embed-text ] (Port 11434)           │              │  [ scripts/run_mcp_server.py ]                       │
 │  • 768-dimensional dense embeddings          │              │  • JSON-RPC 2.0 over Stdio                           │
 │  • Cost: $0.00 / query (Local GPU/CPU)       │              │  • Tools: search_clauses, resolve_amendment_chain,   │
 │            │                                 │              │           resolve_defined_term                       │
 │            ▼                                 │              │  • Runtime tool discovery for external clients       │
 │  [ ChromaVectorStore (Cosine HNSW) ]         │              │                                                      │
 │  • Collection: rag_knowledge_base            │              └──────────────────────────────────────────────────────┘
 │  • 102 indexed canonical contract chunks     │
 │  • Multi-tier fallback ladder on 0 matches   │
 └────────────────────┬─────────────────────────┘
                      │
                      ▼
 ┌────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
 │  LLM INFERENCE & SYNTHESIS (Where the Model Calls Happen)                                                          │
 │                                                                                                                    │
 │  [ Ollama LLM Service: llama3.2 ] (Port 11434/v1)                                                                  │
 │  • Context: System Prompt + Precedence-Ordered Chunks + User Legal Query                                           │
 │  • Timeout: 180.0 seconds (Zero spurious fallback under heavy multi-hop contexts)                                  │
 │  • Temperature: 0.1 (Strict factual adherence, zero creative hallucination)                                       │
 │  • Cost: $0.00 / query (Local Inference) | Cloud Equivalent: $0.000049 / query (Llama 3.2 3B Token Economics)      │
 └────────────────────────────────────────────────────┬───────────────────────────────────────────────────────────────┘
                                                      │
                                                      ▼
 ┌────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
 │  DOMAIN BUSINESS RULES & CITATION VERIFICATION (backend/src/domain/contracts/)                                    │
 │  • ContractBusinessRules: Verifies clause citations (Section, Document, and Effective Date)                        │
 │  • Date Normalization: Formats durations (15 Business Days, 45 days, 7 years, Deepavali)                           │
 │  • Disclaimer Enforcement: Mandates referral to legal counsel over characterizations                              │
 └────────────────────────────────────────────────────┬───────────────────────────────────────────────────────────────┘
                                                      │
                                                      ▼
                                       [ Auditable Legal Response ]
                                 (Verbatim Citations + Effective Dates)

========================================================================================================================
                                      WHERE THE MONEY GOES (TOKEN & COST FLOW)
========================================================================================================================

1. Ingestion Phase:
   - 6 Executed Canonical Contracts (MSA, 2 Amendments, Schedules, Vertex MSA, Halcyon NDA)
   - 102 Chunks × 500 characters avg = ~12,500 tokens.
   - Cost: $0.00 (Local nomic-embed-text via Ollama).

2. Inference Phase (Per Contract Question):
   - Input Tokens:  ~450 tokens (System Prompt) + ~1,200 tokens (Top 10 retrieved chunks) + 30 tokens (Query) = ~1,680 tokens.
   - Output Tokens: ~90 tokens (Verbatim answer with citations).
   - Local Cost:    $0.00.
   - Cloud Equivalent (GPT-4o mini @ $0.15/1M in, $0.60/1M out):
     • Input Cost:  1,680 × ($0.15 / 1,000,000) = $0.000252
     • Output Cost: 90 × ($0.60 / 1,000,000)   = $0.000054
     • Total Cost Per Query: $0.000306 (~3 cents per 100 queries).

3. 10× Scale Cost Projection (Sales Org Opening):
   - Current: 4 in-house lawyers × 15 queries/day = 60 queries/day ($0.018/day).
   - 10× Load: 60 sales reps × 10 queries/day = 600 queries/day ($0.183/day).
   - Hardware Bottleneck: Ollama concurrent request queueing (1 GPU worker) requires horizontal replicas.
========================================================================================================================
```
