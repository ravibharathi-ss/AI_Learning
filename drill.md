# Week 11 Support Drill: Investigation & Time-to-Find Report

## Executive Summary
- **Target Incident**: Planted bad clause-citation answer in production contract logs.
- **Vague Complaint**: *"A lawyer said it cited the wrong clause on termination, maybe Thursday."*
- **Trace ID Found**: `trace-w11-plant-7f89b2`
- **Logged Timestamp**: Thursday, 2026-10-01 at 14:23:18.412 UTC
- **Time-to-Find**: **03:42** (3 minutes, 42 seconds) — **PASS** (under 5:00 threshold)
- **Official Timer**: **Karthik Narayanan (Senior QA & Evaluator)**
- **Decisive Slicing Strategy**: Time slice (`2026-10-01`) + Output Keyword regex (`Section 14` + `termination`).

---

## 1. Timeline of the Live Drill

| Stop-watch (mm:ss) | Action / Log Query Executed | Traces Returned | Diagnostic Outcome / Analysis |
| :---: | :--- | :---: | :--- |
| **00:00** | Clock started by Karthik Narayanan. Received vague complaint note: *"a lawyer said it cited the wrong clause on termination, maybe Thursday."* | ~2,400 total logs | Cannot scan 2,400 raw traces manually. Need to slice immediately. |
| **00:35** | **Slice 1: Time Slice (Thursday `2026-10-01`)**<br>`SELECT * FROM traces WHERE date(timestamp) = '2026-10-01'` | 164 traces | Narrowed from 2,400 to 164 traces. Still too large to read through in under 4 minutes. |
| **01:10** | **Slice 2: User Slice**<br>Attempted query for `user_role = 'lawyer'` or `user_id LIKE '%lawyer%'` | 0 traces | **Dead end**: External counsel logged in with email `alex.vance@legalpartners.com`; role wasn't indexed in top-level user filter. |
| **01:45** | **Slice 3: Cost Outlier Slice**<br>`SELECT * FROM traces WHERE cost_usd > 0.005 AND date(timestamp) = '2026-10-01'` | 3 traces | **Dead end**: All 3 were massive multi-page drafting summaries, none related to termination. The target query had normal token length (~577 tokens, $0.0028). |
| **02:15** | **Slice 4: Input Keyword Slice**<br>`SELECT * FROM traces WHERE query ILIKE '%terminat%' AND date(timestamp) = '2026-10-01'` | 8 traces | **Major breakthrough**: Found 8 queries regarding contract termination asked on Thursday. |
| **03:10** | **Slice 5: Output Inspection Slice**<br>Examined the 8 candidate answers for clause citations. Detected candidate where query asked about *Termination for Convenience* (governed by Section 12.3 in the MSA), but the answer cited: *"Under Section 14.2 of the agreement, either party may terminate for convenience upon thirty (30) days..."* | 1 trace | **Target Identified**: `trace-w11-plant-7f89b2`. |
| **03:42** | Extracted full trace payload (`trace.json`) and verified per-span latency, tokens, cost, prompt version (`v2.1`), and retrieved context IDs. Stop-watch halted. | **1 Confirmed Trace** | **Drill Complete: 03:42.** |

---

## 2. Root Cause Analysis of the Time Spent

### What cost us 3 minutes and 42 seconds?
1. **Searching Outputs via Free-Text**:  
   The complaint described the *output* (*"cited the wrong clause on termination"*), not the input question. Most log indices only index inputs (`query`). Because the cited clause reference was buried inside the unstructured text of `llm_response`, we had to manually read through the 8 candidate outputs.
2. **Missing Field**: **`cited_clause`** (or `clause_tags`).  
   In baseline logging schema `v2.1`, the system logged raw text but did **NOT extract or index the cited clause number** into a dedicated metadata column.

---

## 3. Bonus Challenge: Wiring the Drill Shut

### The Architectural Improvement
We added a deterministic regex extractor and database index for `cited_clause` in `models.py` and `trace_repo.py`:
```python
# Extracted automatically during response generation and indexed in DB
cited_clause = Column(String(100), index=True, nullable=True) # e.g. "Section 14.2"
```

### Second Drill Verification (Beating Our Own Time)
Squadmate Karthik Narayanan planted a second flawed answer:
- **Second Plant**: Thursday afternoon query citing *"Section 15.4 for governing law"* when the contract specified Section 15.1.
- **Query Executed**:
  ```sql
  SELECT * FROM traces 
  WHERE date(timestamp) = '2026-10-01' 
    AND cited_clause = 'Section 15.4';
  ```
- **Time-to-Find (Second Drill)**: **00:19** (19 seconds)!
- **Time Reduction**: **03:42 $\rightarrow$ 00:19** (**91.4% faster diagnosis**).
- **The One Field That Closed the Gap**: **`cited_clause`**.
