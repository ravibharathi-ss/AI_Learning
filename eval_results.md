# Week 11 Deliverable: Evaluation Suite Output (Before vs After Fix)

## 1. Summary of Results

| Metric | Before Fix (`contract_qa_v2.1`) | After Fix (`contract_qa_v2.2`) | Delta / Outcome |
| :--- | :---: | :---: | :---: |
| **Suite Pass Count** | **26 / 27** | **27 / 27** | **+1 Test Passed (Loop Closed)** |
| **Suite Status** | <span style="color:red;font-weight:bold;">RED (Failure Caught)</span> | <span style="color:green;font-weight:bold;">GREEN (100% Clean)</span> | **Bug Eliminated** |
| **Pass Rate (%)** | 96.3% | 100.0% | +3.7% |
| **Planted Case CASE-027** | **FAIL** (Cited Section 14.2 + 30 days) | **PASS** (Cites Section 12.3 + 60 days) | Validated Verbatim |
| **Regression Cases (1-26)** | 26 / 26 PASS | 26 / 26 PASS | Zero Silent Regressions |

---

## 2. Console Output: Run 1 — Before Fix (Prompt v2.1) [RED]

```text
=====================================================================================
 EVALUATION RUN 1: BEFORE FIX (Prompt Version: contract_qa_v2.1)
=====================================================================================
Suite Pass Count: 26 / 27 (RED)
Total Cases: 27
Passed: 26 | Failed: 1 (Failure: CASE-027)

Failed Case Detail:
- ID: CASE-027 (Thursday Lawyer Termination Citation Complaint)
- Query: "What is the notice period and procedure for terminating our Cloud Master Services Agreement for convenience?"
- Context: Section 12.3 (Termination for Convenience: 60 days written notice) | Section 14.1 (Assignment/Sublicensing)
- Model Answer (v2.1): "Under Section 14.2 of the agreement, either party may terminate for convenience upon thirty (30) days prior written notice."
- Deterministic Assertion 1 (Clause Reference Exists): FAIL (Section 14.2 does not exist in contract)
- Deterministic Assertion 4 (Notice Period Numeric): 30 days (FAIL: Contract requires 60 days)
- Human Judge Verdict: FAIL
=====================================================================================
```

---

## 3. Console Output: Run 2 — After Fix (Prompt v2.2) [GREEN]

```text
=====================================================================================
 EVALUATION RUN 2: AFTER FIX (Prompt Version: contract_qa_v2.2)
=====================================================================================
Suite Pass Count: 27 / 27 (GREEN)
Total Cases: 27
Passed: 27 | Failed: 0 (Zero Failures!)

Resolved Case Detail:
- ID: CASE-027 (Thursday Lawyer Termination Citation Complaint)
- Model Answer (v2.2): "Under Section 12.3 of the Master Services Agreement, Customer may terminate the Agreement or any active Service Order for convenience without cause at any time upon providing at least sixty (60) days prior written notice to Provider."
- Deterministic Assertion 1 (Clause Reference Exists): PASS (Section 12.3 exists in contract)
- Deterministic Assertion 4 (Notice Period Numeric): PASS (60 days exactly matches Section 12.3)
- Substantive Legal Correctness: PASS
- Full Suite Verification: All 26 pre-existing legal test cases remain 100% green.
=====================================================================================
```
