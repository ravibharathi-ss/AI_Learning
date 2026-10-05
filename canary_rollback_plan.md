# Week 11 Deliverable 4: Prompt Version Bump, Canary & Rollback Plan

## 1. Prompt Version Bump Record

- **Previous Production Version**: `contract_qa_v2.1` (`v2.1`)
- **New Production Version**: `contract_qa_v2.2` (`v2.2`)
- **Layer Modified**: Prompt Layer (with Retrieval-Layer clause header tagging)
- **Author**: AI Engineering Squad (Track F: Legal Contracts)
- **Date**: October 5, 2026

### Diff Between Versions:
```diff
--- contract_qa_v2.1 (Baseline)
+++ contract_qa_v2.2 (Calibrated)
@@ -1,3 +1,8 @@
 You are an expert Legal Contract Assistant. Answer inquiries regarding the provided
-contract documents accurately. Cite relevant section numbers when answering.
+contract documents.
+CRITICAL CLAUSE CITATION RULES:
+1. When asked about Termination for Convenience or Cause, you must strictly cite the Term and Termination
+section (e.g., Section 12 or Article 6) and verbatim notice days.
+2. NEVER confuse Section 14 (Limitation of Liability or Sublicensing) with Termination provisions.
+3. If an amendment supersedes an earlier draft, always cite the executed restatement.
+4. Always cite the exact Section number and title before stating the legal rule.
```

---

## 2. Two-Line Canary Deployment & Rollback Plan

### Line 1: Canary Deployment Rule
> *"Route 10% of production traffic to `PROMPT_VERSION=v2.2` via feature flag `legal_qa_v2_2`, asserting 100% pass on deterministic citation verification (`assert_clause_reference_exists`) before auto-promoting to 100% over 60 minutes."*

### Line 2: Immediate Rollback Plan
> *"If `assert_clause_reference_exists` failures or HTTP 5xx errors exceed 0.5% in the canary slice, automatically flip feature flag `legal_qa_v2_2=false` to revert 100% of traffic to `v2.1` in under 5 seconds with zero container restart."*
