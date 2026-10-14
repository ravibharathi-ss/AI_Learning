# Formal Capstone Evaluation Report — Contract Review Assistant (Variant F)

**Date of Execution:** 2026-10-14  
**Evaluator:** Automated Clean Architecture Evaluation Harness (`scripts/evaluate_golden_set.py`)  
**Corpus:** Shared Executed Commercial Contract Corpus (`shared-corpus/`)  
**Total Canonical Test Cases:** 32 Ground-Truth Cases across 9 Cognitive Legal Categories  
**Report JSON Source:** `evaluation_results/golden_set_run_report.json`  

---

## 1. Executive Summary

| Metric | Target Standard | Achieved Score | Status |
| :--- | :---: | :---: | :---: |
| **Overall Accuracy** | ≥ 85.0% | **100.0%** (32 / 32 Passed) | **EXCEEDED** |
| **Judge Agreement Rate (Human Labels)** | ≥ 85.0% | **92.0%** (23 / 25 Labels) | **EXCEEDED** |
| **Superseded Clause Citation Rate** | 0.0% | **0.0%** (0 / 7 Leaked) | **EXCEEDED** |
| **Average Latency (Full Local RAG)** | < 60,000 ms | **34,778 ms** | **PASSED** |
| **Cost Per Contract Question** | < $0.01 | **$0.000306** (Local $0.00) | **EXCEEDED** |

---

## 2. Category & Taxonomy Breakdown

### Full Category Performance Table (n = 32)

| Category / Class | Total (n) | Passed | Failed | Accuracy Rate |
| :--- | :---: | :---: | :---: | :---: |
| `direct_lookup` | 8 | 8 | 0 | **100.0%** |
| `amendment_supersession` | 7 | 7 | 0 | **100.0%** |
| `counterparty_disambiguation` | 4 | 4 | 0 | **100.0%** |
| `defined_term_chase` | 3 | 3 | 0 | **100.0%** |
| `multi_hop_dependent` | 2 | 2 | 0 | **100.0%** |
| `version_comparison` | 1 | 1 | 0 | **100.0%** |
| `cross_document` | 1 | 1 | 0 | **100.0%** |
| `computation` | 2 | 2 | 0 | **100.0%** |
| `out_of_scope` | 4 | 4 | 0 | **100.0%** |
| **TOTAL** | **32** | **32** | **0** | **100.0%** |

---

## 3. High-Risk Clauses Broken Out Separately

As required by the Capstone defense rubric, high-risk clauses (Indemnity and Limitation of Liability) are isolated and analyzed independently rather than blended into the average:

| High-Risk Clause Area | Applicable Cases | Passed / Total | Specific Accuracy | Key Findings & Verifications |
| :--- | :--- | :---: | :---: | :--- |
| **Limitation of Liability** | `GS-005`, `GS-006`, `GS-028` | **3 / 3** | **100.0%** | • Correctly returned Northwind amended cap (greater of $5M or 12 mo fees; Amendment 2).<br>• Correctly returned Vertex unamended cap ($500,000 aggregate over life).<br>• Correctly returned Halcyon cap (€50,000) while explicitly noting Section 3 confidentiality breach exception is uncapped. |
| **Indemnity & Insurance** | `GS-003`, `GS-013`, `GS-014` | **3 / 3** | **100.0%** | • Correctly cited professional indemnity insurance amount ($1,000,000 per claim) and duration (Term + 2 years thereafter).<br>• Correctly identified service level escalation and immediate termination remedies for breach. |

---

## 4. Validated Legal Judge Agreement

The automated evaluation judge was calibrated against human hand-labels from `backend/evals/labels_25.json`:
- **Evaluated Pairs:** 25 Hand-Labeled Test Instances
- **Judge Agreement:** 23 / 25
- **Agreement Percentage:** **92.0%** (Exceeds the 85.0% requirement)
- **Disagreements Analyzed:** The 2 edge-case disagreements involved phrasing variance regarding parenthetical numbers (e.g. *"90 calendar days"* vs *"90 days"*), which were harmonized via regex normalization in `golden_set_evaluator.py`.

---

## 5. Explicit Statement of Non-Coverage

> **Important Non-Coverage Disclosure:**  
> This evaluation suite tests factual retrieval, amendment supersession, defined-term resolution, and arithmetic accuracy of operative contract text across the 6 canonical executed agreements.  
> **It explicitly does NOT cover:**
> 1. Judicial enforceability or statutory compliance under post-2026 common law jurisprudence.
> 2. Handwritten or un-OCR'd marginal notes on executed PDF copies.
> 3. Dynamic multi-party indemnification cross-claims outside the 4 executed counterparties.
