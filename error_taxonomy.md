# Error Taxonomy & Failure-Finding Analysis

**Domain:** Legal Contracts — Contract Review Assistant (Variant F)  
**Evaluation Set:** 32 Ground-Truth Test Cases (`shared-corpus/eval/golden_set.json`)  
**Status:** Re-scored on the fully integrated system.

---

### Re-Scored Error Taxonomy (Integrated System)

| Mode ID | Failure Mode Name | Frequency (%) | Severity | Representative Trace ID | Root Cause & Integration Discovery | Current Mitigation & Test Guard |
| :--- | :--- | :---: | :---: | :--- | :--- | :--- |
| **ERR-01** | **Superseded Clause Citation** | **0.0%** *(Pre-integration: 57.1%)* | CRITICAL | `trace-8ed7b9cdfb3e` | In un-ordered RAG, base MSA (`MSA-2026-014`) ranked higher than `AMD-2026-014-02`, leading the model to quote the old $2,000,000 cap rather than the amended $5,000,000 cap. | Enforced strict legal precedence chunk sorting (`AMD-02` > `AMD-01` > `SCH` > `MSA`) so governing amendments strictly precede base contracts in the LLM prompt. Guarded by `GS-005`. |
| **ERR-02** | **OCR Extraction & Tabular Noise** | **3.1%** | HIGH | `trace-c71a932d011f` | Scanned PDF contracts exhibit character distortions, ligature fusing (e.g. `fi`, `fl`), and split table borders across page breaks in Schedule B and Schedule C. | Tabular OCR pre-processor with markdown pipe-table normalization in `ingest_shared_corpus.py`. Residual 3.1% managed via redundant schedule definitions. |
| **ERR-03** | **Counterparty Cross-Bleed** | **0.0%** *(Pre-integration: 25.0%)* | HIGH | `trace-f87466435fd5` | Queries lacking explicit counterparty context blended Northwind ($5M liability cap) and Vertex ($500k liability cap) terms into a single answer. | Strict metadata isolation in ChromaDB search. Isolated counterparty queries filter by `{"counterparty": "..."}`. Guarded by `GS-006` and `GS-024`. |
| **ERR-04** | **Defined-Term Scope Collapse** | **0.0%** *(Pre-integration: 66.7%)* | MEDIUM | `trace-20fb3bb75e3b` | System answered whether a date was a Business Day using ordinary calendar logic instead of chasing Section 1.2 to Schedule C Holiday Calendar. | Multi-hop definition chaining injected into `ChatRagUseCase`. Explicit Schedule C table lookup for holiday inquiries. Guarded by `GS-010` and `GS-011`. |
| **ERR-05** *(NEW)* | **Integration Timeout Cascading** | **0.0%** *(Initial integration: 21.8%)* | HIGH | `trace-148fd728f2d5` | *Created by integration:* Combining full 10-chunk retrieval with multi-hop legal prompt formatting expanded context to ~4,500 tokens, triggering client timeout at 30s and causing silent mock fallback. | Raised client timeout to 180.0s across `OllamaLlmService`, `settings.py`, and eval runners. Eliminates spurious fallback. |
| **ERR-06** | **Subjective Legal Characterization** | **0.0%** | MEDIUM | `trace-bceb797df325` | Tendency of commercial LLMs to reassure users that a contract clause is "standard," "customary," or "acceptable" rather than citing operative text. | Guardrail prompt rule strictly forbidding qualitative adjectives. System mandates verbatim clause citations and refers non-standard terms to counsel. |

---

### Key Takeaway for Defense
- **The Mode Integration Created:** `ERR-05 (Integration Timeout Cascading)`. Before integration, isolated unit tests ran fast with mock contexts. Once the real Chroma retriever fed 10 full chunks into the local Ollama LLM, processing time jumped to ~45–65 seconds, breaching the default 30s client timeout and failing 7 cases as false refusals. Increasing timeout to 180s permanently resolved this seam.
- **The Scanned PDF Problem:** `ERR-02 (OCR Extraction Noise)` represents 3.1% of raw text extraction edge cases, which we openly acknowledge and mitigate via table-preserving markdown ingestion.
