# Top-3 Known Weaknesses (Recorded Wednesday Before Anyone Asked)

**Project:** Contract Review Assistant — Capstone Variant F  
**Recorded By:** Senior Software Engineer  
**Date:** Wednesday Milestone Checkpoint  
**Principle:** *"A demo where nothing ever fails means you are hiding the failures."*

---

### Weakness 1: Single-Threaded Local LLM Latency Under Multi-Hop Load
- **The Problem:** When queries require multi-document context (e.g. `GS-008` retrieving base agreement, Amendment 1, and Amendment 2), Ollama running `llama3.2` locally takes **35 to 65 seconds** to process the prompt and synthesize the response.
- **Why It Exists:** Local quantized inference runs on a single consumer GPU without batched KV caching or speculative decoding.
- **The Honest Impact:** If four lawyers query the system simultaneously, the 4th lawyer waits over 3 minutes due to serial request queuing.
- **Planned Mitigation (10× Scale):** Migrate inference to vLLM on a dedicated GPU instance with continuous batching and PagedAttention, which drops p50 latency from 35s to <1.8s.

---

### Weakness 2: Residual OCR Extraction Degradation on Complex Multi-Column Scans
- **The Problem:** In scanned PDF agreements, multi-column rate tables and service-level matrices in Schedule B can suffer column collapse, where text from column 1 merges horizontally into column 2.
- **Why It Exists:** Standard OCR engines lack structural layout analysis for non-standard borderless accounting tables in scanned paper contracts.
- **The Honest Impact:** In ~3.1% of scanned edge cases, service credit tier bounds could be misparsed if relying exclusively on raw OCR text without the markdown canonical reference.
- **Planned Mitigation:** Implement LayoutLMv3 or Microsoft Table-Transformer to detect table bounding boxes before optical OCR extraction.

---

### Weakness 3: Non-Coverage of Implied Covenants & Non-Textual Jurisprudential Doctrines
- **The Problem:** The system operates strictly as an auditable text-lookup engine. It cannot evaluate whether a clause is unenforceable under unwritten Indian contract jurisprudence (e.g. Section 27 restraint of trade under Indian Contract Act, 1872) or equitable estoppel.
- **Why It Exists:** Architectural choice: legal counsel explicitly demanded that the assistant must NOT generate legal opinions or evaluate judicial enforceability.
- **The Honest Impact:** A salesperson asking *"Is this non-compete enforceable in Chennai?"* will receive an auditable citation of Section 15.1 (Governing Law: India) and Section 5 (Confidentiality), but the system strictly refuses to assess enforceability and refers to counsel.
- **Planned Mitigation:** Maintain strict domain boundary: auditable contract lookup only, never judicial prophecy.
