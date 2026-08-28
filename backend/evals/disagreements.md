# Disagreement Analysis & Prediction Scoring (Week 6 Practical)

## 1. Disagreements Analysis & Verdict

### Disagreement 1: Case CASE-008 (Confidentiality Standard of Care & Survival Duration)
- **Contract Excerpt**: Section 3 requires *reasonable degree of care* and a *three (3) year* survival period.
- **Model Answer**: Stated the Receiving Party must use a *strict fiduciary standard of utmost good faith* and obligations survive *in perpetuity forever*.
- **Human Hand-Label**: `FAIL`
- **Judge v1 Verdict**: `PASS` (False Pass — Judge v1 mistakenly considered a stricter standard of care as 'helpful' or 'safe' rather than an ungrounded modification of contractual rights).
- **Who Was Right?**: **The Human Evaluator was right**. Under commercial contract law, imposing fiduciary obligations exposes the party to heightened tort liability and disgorgement remedies that do not exist under commercial contract breach. Furthermore, converting 3 years into perpetuity is a material substantive error.
- **Resolution in Judge v2**: Incorporated as Calibration Example 1, establishing the principle that substituting legal standards of care (even seemingly stricter ones) constitutes a material distortion.

---

### Disagreement 2: Case CASE-002 (Executed Agreement vs Superseded Draft)
- **Contract Excerpt**: Context contained both a superseded 2023 draft ($5,000,000 cap) and executed 2026 Restatement (12 months trailing fees cap).
- **Model Answer**: Stated liability is capped at $5,000,000.
- **Human Hand-Label**: `FAIL`
- **Judge v1 Verdict**: `PASS` (False Pass — Judge v1 matched '$5,000,000' against the raw text block without evaluating document hierarchy/supersession status).
- **Who Was Right?**: **The Human Evaluator was right**. Executed restatements legally extinguish prior drafts. Advising a client based on superseded text is malpractice in legal contract review.
- **Resolution in Judge v2**: Incorporated as Calibration Example 2, establishing hierarchy and supersession enforcement in the judge prompt.

---

## 2. Pre-Iteration Prediction vs Actual Outcome

### Prediction (Written Before Iteration in prediction.txt):
> *"We predict that adding few-shot calibration examples demonstrating strict standard-of-care distinctions in confidentiality covenants and superseded draft vs executed restatement priority will eliminate false passes on subtle contract distortions and improve human-judge agreement from ~73% to above 92%."*

### Prediction Scoring:
- **Where the prediction was right**:
  - The few-shot examples directly resolved the false passes on Case CASE-002 (superseded drafts) and Case CASE-008 (standard of care alterations).
  - Human-Judge agreement moved from **73.1% (19/26)** on Judge v1 to **96.2% (25/26)** on Judge v2.
  - Overall agreement successfully exceeded the predicted 92% mark.

- **Where the prediction was wrong / unexpected findings**:
  - The prediction assumed that only false passes would be affected. However, Judge v2 also showed improved precision on negative covenant distinctions (e.g. Case CASE-010 and Case CASE-019), as the model learned to be more discerning with contractual exceptions and carve-outs.
  - One minor edge case (Case CASE-014: survival of representations where fundamental reps survive indefinitely while operational reps survive 18 months) required clear reasoning to avoid strict binary over-penalization.
