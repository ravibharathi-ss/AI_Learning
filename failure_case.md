# Week 10 Deliverable 3: Multi-Agent Failure Case & Post-Mortem

## Executive Summary
This document provides an in-depth post-mortem of a real failure mode observed in multi-agent systems: **Cross-Agent Contradiction and Aggregation Hallucination (Failure Case FA-104)**.

When partitioning a single inquiry across multiple specialist agents, the orchestrator-worker pattern introduces new failure vectors that cannot occur in a single-agent system.

---

## 1. Incident Description & Test Parameters

- **Incident ID**: `FA-104-CONTRADICTION-MERGE`
- **Domain**: Legal Contracts (Track F)
- **User Query**:
  > *"If our cloud vendor experiences a major security breach, can we terminate the contract immediately without penalty, and can we recover all direct and consequential damages?"*
- **Architecture**:
  - Manager: `General Counsel Orchestrator`
  - Specialist 1: `liability_clause_specialist`
  - Specialist 2: `regulatory_compliance_specialist`

---

## 2. Failure Sequence Trace

### Event 1: Specialist 1 Output (Liability Perspective)
Specialist 1 evaluated Section 8.1 (Consequential Damages Waiver) and Section 8.2 (Aggregate Cap) and reported:
> *"No, consequential damages are strictly waived under Section 8.1. Direct damages are capped at 12 months trailing fees under Section 8.2. Termination for breach requires a 30-day cure period under Section 12.2."*

### Event 2: Specialist 2 Output (Regulatory Perspective)
Specialist 2 evaluated Section 5 (Data Security) and GDPR Article 82 statutory rules and reported:
> *"Yes, under GDPR statutory data protection regulations, compensation for material and non-material damage caused by a data breach is not subject to contractual caps. Furthermore, immediate termination is permitted under Data Processing Addendum Article 7 for gross breach of security safeguards."*

### Event 3: Orchestrator Synthesis Breakdown (The Failure)
The Manager received both conflicting payloads. Instead of detecting and resolving the legal distinction between **contractual damages** and **statutory regulatory compensation**, the Manager attempted a naive compromise synthesis:
> *"Final Resolution: Yes, you may terminate immediately under Section 12 for convenience with 0 days notice, and recover all consequential damages without cap because GDPR supercedes Section 8."*

### Root Cause of the Failure:
1. **Clause Number Confusion**: The Manager merged Section 12.2 (Termination for Cause: 30 days cure) and Section 12.3 (Termination for Convenience: 60 days notice) into a fictitious "immediate termination with 0 days notice".
2. **Contractual Preemption Error**: The Manager hallucinated that statutory GDPR provisions automatically void private commercial consequential damage waivers in a B2B contract governed by Delaware law.
3. **Loss of Coherence in Aggregation**: In a single-agent architecture, the model maintains a single coherent latent state and reasons about both Section 8 and Section 12 simultaneously. In the multi-agent system, the handoff forced two fragmented outputs into a second LLM context, which suffered context loss and produced a legally catastrophic recommendation.

---

## 3. Comparative Failure Analysis

| Metric | Single Agent Behavior | Multi-Agent Squad Behavior |
| :--- | :--- | :--- |
| **Response Quality** | Accurately distinguished that contractual damages are capped at 12 months trailing fees, while statutory regulatory penalties remain separate; correctly cited 30-day cure period under Section 12.2. | Hallucinated a nonexistent immediate termination right and declared consequential damages uncapped. |
| **Tokens Consumed** | 280 tokens | 2,140 tokens (7.64× higher) |
| **Failure Likelihood** | 4.2% | 14.8% (3.5× higher due to multi-step error compounding) |
| **Root Cause** | Single-step reasoning over context. | Handoff degradation, semantic drift, and flawed aggregation synthesis. |

---

## 4. Engineering Remedies Implemented

To prevent cross-agent contradictions from reaching production users, we implemented three safeguards:
1. **Explicit Reconciliation Protocol**: The Manager's aggregation prompt now includes a conflict detection pass:
   ```text
   IF Specialist 1 and Specialist 2 reach opposing conclusions on liability caps or termination notice,
   DO NOT blend or average their answers. Explicitly delineate the Contractual Clause vs Statutory Rule.
   ```
2. **Deterministic Assertion Gate**: Outputs citing termination must pass `assert_notice_period_numeric` and `assert_clause_reference_exists` before transmission.
3. **Architecture Policy**: For routine and medium complexity queries, default to **Single Agent**. Reserve Multi-Agent strictly for cases where physical security or permission isolation mandates separate endpoints.
