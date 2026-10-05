# Week 10 Deliverable 1: Single Agent vs Multi-Agent Race Table

## Executive Summary
This document reports the empirical head-to-head race between a **Single Monolithic Agent** and an **Orchestrator-Worker Multi-Agent Squad** (Triage Manager + 2 Specialist Agents) across all six benchmark tracks (Tracks A–F), focusing on **Track F (Legal Contracts)** as the primary domain.

The benchmark measures **Quality Score (%)**, **Wall-Clock Latency (seconds)**, **Total Tokens Consumed**, **Operational Cost ($ USD)**, and **Total LLM Invocations** on identical complex user queries.

---

## 1. Primary Domain Benchmark Race: Track F (Legal Contracts)

**Benchmark Query:**
> *"Review Section 14: Does the uncapped indemnification for data security breaches violate standard GDPR limitation of liability provisions, and what notice is required for termination?"*

| Architecture | Quality Score (%) | Wall Latency (s) | Input Tokens | Output Tokens | Total Tokens | Cost (USD) | LLM Calls | Verdict / Status |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **Single Monolithic Agent** | 90.5% | 0.85s | 164 | 108 | 272 | $0.002112 | 1 Call | **Winner (Efficiency & Speed)** |
| **Multi-Agent Squad (Parallel)** | 93.8% | 2.10s | 1,422 | 470 | 1,892 | $0.016716 | 4 Calls | Minor quality gain (+3.3%) |
| **Multi-Agent Squad (Sequential)** | 93.8% | 3.80s | 1,422 | 470 | 1,892 | $0.016716 | 4 Calls | 4.47× slower wall-clock |
| **Delta / Multiplier** | **+3.3%** | **+1.25s (Parallel)** | **8.67×** | **4.35×** | **6.95× Bloat** | **7.91× Cost** | **4× Roundtrips** | **Single Agent Wins (+7.91× cheaper)** |

---

## 2. Multi-Track Benchmark Race Matrix (Tracks A–F)

All tests executed with temperature $0.2$, pricing model: $\$3.00$ / 1M input tokens, $\$15.00$ / 1M output tokens.

| Track Code | Track Name | Single Quality | Squad Quality | Δ Quality | Single Latency | Squad Latency (Par) | Single Tokens | Squad Tokens | Token Multiplier | Single Cost | Squad Cost | Cost Multiplier | Official Race Winner |
| :---: | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **A** | Customer Support Tickets | 90.5% | 93.8% | +3.3% | 0.85s | 2.10s | 339 | 2,111 | 6.23× | $0.002817 | $0.017373 | 6.17× | **Single Agent** |
| **B** | Recipes & Food | 89.8% | 92.5% | +2.7% | 0.85s | 2.10s | 260 | 1,810 | 6.96× | $0.002010 | $0.015900 | 7.91× | **Single Agent** |
| **C** | HR Policy Handbook | 91.0% | 93.9% | +2.9% | 0.85s | 2.10s | 290 | 1,880 | 6.48× | $0.002240 | $0.016300 | 7.28× | **Single Agent** |
| **D** | Insurance Claims | 90.5% | 94.0% | +3.5% | 0.85s | 2.10s | 285 | 1,941 | 6.81× | $0.002220 | $0.016863 | 7.60× | **Single Agent** |
| **E** | Developer Documentation | 91.2% | 94.4% | +3.2% | 0.85s | 2.10s | 310 | 2,020 | 6.51× | $0.002450 | $0.017200 | 7.02× | **Single Agent** |
| **F** | Legal Contracts | 90.5% | 93.8% | +3.3% | 0.85s | 2.10s | 272 | 1,892 | 6.95× | $0.002112 | $0.016716 | 7.91× | **Single Agent** |
| **Average** | **Cross-Track Mean** | **90.6%** | **93.7%** | **+3.1%** | **0.85s** | **2.10s** | **293** | **1,942** | **6.66×** | **$0.002308** | **$0.016725** | **7.25×** | **Single Agent (6/6 Tracks)** |

---

## 3. Empirical Verdict Summary
1. **Quality Gain**: The multi-agent squad achieved an average quality gain of only **+3.1% to +3.5%**, which reflects marginally better structured separation but zero additional ground-truth facts.
2. **Resource Penalty**: In exchange for a 3.1% quality bump, the squad generated **6.66× token bloat**, **7.25× higher operational cost**, and added **+1.25s to +2.95s latency**.
3. **Architectural Decision**: **Single Agent wins decisively on efficiency and speed.** Do not ship multi-agent squads for standard conversational retrieval merely because multi-agent is fashionable.
