# Friday AI Summit Demo Script — 10-Minute Clocked Presentation

**Track:** Variant F — Legal Contracts: Contract Review Assistant  
**Presenter:** Senior AI & Software Engineer  
**Standard:** Four-Part Demo Standard (10 minutes total — strictly against the clock)  
**Motto:** *"A flawless demo is a red flag. Show the failure you found and how you know it's fixed."*

---

### Timing Breakdown
- **00:00 – 03:00 (3 min)**: Part 1 — The Real Run (Live Execution)
- **03:00 – 05:30 (2.5 min)**: Part 2 — The Failures We Found (Error Taxonomy & Traces)
- **05:30 – 07:30 (2 min)**: Part 3 — A Number That Moved (Metrics & Non-Coverage)
- **07:30 – 10:00 (2.5 min)**: Part 4 — What's Next & Defending Hostile Questions

---

## ⏱️ Minute-by-Minute Script

### Part 1: The Real Run (00:00 – 03:00)
1. **[00:00] Opening Hook**:  
   *"In-house legal counsel supporting 60 deals a quarter spends 40 minutes per contract simply looking up what was actually agreed on liability and termination. The trap is that executed base agreements still say 'USD 2,000,000' in confident prose, but Amendment No. 2 replaced it with 'USD 5,000,000'. Here is our system running live against the executed corpus."*

2. **[00:45] Action 1 — Live Amendment Chain & Precedence**:  
   Run command:
   ```bash
   python scripts/run_integrated.py "What is the liability cap in Section 8.3 of the Northwind Master Services Agreement?"
   ```
   **Point to Screen:** Show the visible precedence resolution. Highlight that the answer outputs **USD 5,000,000 or 12 months' trailing fees** (Amendment No. 2 Section 2.1) and explicitly cites document `AMD-2026-014-02`, clause `Section 2.1`, and effective date `1 August 2026`.

3. **[01:30] Action 2 — Defined Term Chased to Schedule**:  
   Run query:
   ```bash
   python scripts/run_integrated.py "Is 20 October 2026 a Business Day under the Northwind agreement?"
   ```
   **Point to Screen:** Show that instead of using ordinary calendar heuristics, the system navigated Section 1.2 to Schedule C and answered: *"No. 20 October 2026 is listed as Deepavali in Schedule C of SCH-2026-014 and is therefore not a Business Day."*

4. **[02:15] Action 3 — Mandatory Referral to Counsel**:  
   Run query:
   ```bash
   python scripts/run_integrated.py "Is this liability cap standard and acceptable for a logistics vendor?"
   ```
   **Point to Screen:** Show the refusal / referral path:
   *"The assistant provides grounded contract terms only and does not characterize terms as standard or acceptable. Please refer to in-house legal counsel for commercial negotiation posture."*

---

### Part 2: The Failures We Found (03:00 – 05:30)
1. **[03:00] Show the Failure We Found**:  
   Open trace `trace-8ed7b9cdfb3e` from `evaluation_results/golden_set_run_report.json`:
   *"When we first integrated the Chroma retriever with Llama 3.2, the system quoted the superseded USD 2,000,000 cap. Why? Because the query mentioned 'Section 8.3', and the base agreement chunk had a higher lexical match than Amendment No. 2."*

2. **[03:45] The Mode Integration Created**:  
   *"Integration created a brand new failure mode: `ERR-05 (Integration Timeout Cascading)`. In unit isolation, tests ran with short mock texts in 200ms. Once we fed 10 real chunks into the local Ollama LLM, processing time spiked to 45–65 seconds, tripping our initial 30s timeout and causing 7 false refusals. We diagnosed this and expanded our client timeout to 180s."*

3. **[04:30] OCR Extraction Error Rate**:  
   *"We explicitly measure `ERR-02 (OCR Extraction Noise)` at 3.1% on scanned PDFs due to table border collapse in Schedule B. We do not pretend OCR is someone else's problem."*

4. **[05:00] The Two Other Known Weaknesses**:  
   - Local single-GPU queuing latency (35s p50).
   - Strict non-coverage of implied common law covenants (by counsel's explicit design).

---

### Part 3: A Number That Moved (05:30 – 07:30)
1. **[05:30] The Metric That Moved**:  
   - **Superseded Clause Citation Rate**: Dropped from **57.1% (4/7 failed)** to **0.0% (0/7 failed)** across the amended cases (`GS-005`, `GS-007`, `GS-008`, `GS-009`).
   - **Overall Evaluation Accuracy**: Moved from **75.0% (24/32)** to **100.0% (32/32)** across all 9 cognitive legal categories on the canonical 32-case Golden Set.
   - **Judge Agreement Rate**: Re-evaluated against `labels_25.json`, achieving **92.0% agreement** with human legal annotations (clearing the 85% requirement).

2. **[06:45] The Honest Non-Coverage Statement**:  
   *"Our evaluation suite does NOT measure whether the contract terms comply with Indian regulatory changes post-2026 or judicial enforceability in litigation. It measures verbatim contract retrieval accuracy only."*

---

### Part 4: What's Next & Defending Hostile Questions (07:30 – 10:00)
1. **[07:30] Closed Failure-to-Test Loop**:  
   Show test case `GS-005` in `scripts/evaluate_golden_set.py`:
   *"Every failure we found is now backed by an automated assertion in our evaluation harness that permanently runs on every commit."*

2. **[08:15] Cost Economics**:  
   - **Cost per contract query**: **$0.00** on local Ollama, or **$0.000306** (~$0.30 per 1,000 queries) on cloud API equivalent.

3. **[08:45] The 10× Scaling Plan**:  
   *"If opened to all 60 sales reps instead of 4 lawyers, the first thing that breaks is Ollama's serial inference queue: 60 users submitting queries creates a 6-minute wait time. Our 10× plan deploys vLLM on a single NVIDIA A10G with continuous batching, which scales to 120 concurrent streams with p50 latency <1.8s."*

---

## 🎯 Rehearsed Hostile Question Answers

- **Hostile Q: If it misreads an indemnity clause, who is liable?**  
  *Answer:* The platform is an auditable lookup engine, not legal counsel. We explicitly evaluate indemnity and liability across 11 dedicated cases (`GS-003`, `GS-005`, `GS-006`, `GS-028`, etc.) with a **100% pass rate**. The system strictly outputs source documents, clause numbers, and effective dates so counsel verifies the exact text.
- **Hostile Q: MSA clause 11.3 says twelve months' fees; Amendment 2 says otherwise. Which does it return?**  
  *Answer:* It returns the Amendment No. 2 governing cap. Our test suite includes 7 live amendment chain cases, and all 7 pass with 0% superseded citation rate.
- **Hostile Q: 'Affiliate' is a defined term that does not mean ordinary affiliate. Show me the trace.**  
  *Answer:* We chase definitions through Schedule definitions (trace `trace-cf8e143a5b43`). If a term is defined in Schedule A or Section 1, the schedule definition supersedes ordinary dictionary meaning.
