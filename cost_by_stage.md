# Week 11 Deliverable 5: Cost per Query Broken Down by Stage

## 1. Per-Request Stage Attribution for `trace-w11-plant-7f89b2`

Pricing Model Benchmark (Enterprise Standard LLM & Embeddings):
- **Input Tokens**: $\$3.00$ per 1,000,000 tokens ($\$0.0000030$ / token)
- **Output Tokens**: $\$15.00$ per 1,000,000 tokens ($\$0.0000150$ / token)
- **Embedding Tokens**: $\$0.10$ per 1,000,000 tokens ($\$0.0000001$ / token)

---

### Detailed Stage Breakdown Table

| Execution Stage | Operations Performed | Input Tokens | Output Tokens | Total Tokens | Latency (ms) | Stage Cost (USD) | % of Query Cost |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Stage 1: Retrieval** | • Query semantic embedding (`nomic-embed-text`)<br>• ChromaDB Cosine Nearest Neighbor search<br>• Fetching 2 chunks (Section 12 + Section 14) | 28 | 0 | 28 | 142 ms | **$0.0000028** | **0.1%** |
| **Stage 2: Generation** | • Contract System Prompt `v2.1` (120 tokens)<br>• Retrieved Contract Context chunks (312 tokens)<br>• User Inquiry (25 tokens)<br>• Model Completion response (92 tokens) | 457 | 92 | 549 | 1,890 ms | **$0.0028320** | **99.9%** |
| **Stage 3: Tools / Checks** | • Deterministic regex clause extraction<br>• `assert_clause_reference_exists`<br>• `assert_notice_period_numeric`<br>• SQLite Trace & Span commit | 0 | 0 | 0 | 0 ms | **$0.0000000** | **0.0%** |
| **Total Pipeline** | **End-to-End Request Execution** | **485** | **92** | **577** | **2,032 ms** | **$0.0028348** | **100.0%** |

---

## 2. Key Cost Findings

1. **Generation Dominates 99.9% of Total Request Cost**:
   - Retrieval accounts for less than **one-tenth of one percent (0.1%)** of the operational cost.
   - 457 input tokens at $\$3.00/\text{M} = \$0.001371$.
   - 92 output tokens at $\$15.00/\text{M} = \$0.001461$.
   - Because generation tokens are billed at 5× the rate of input tokens, the 92 output tokens represent over 51% of total query expenditure.

2. **Deterministic Assertions Cost Exactly Zero**:
   - Running the four deterministic assertions (`assert_clause_reference_exists`, `assert_notice_period_numeric`, `assert_defined_terms_valid`, `assert_effective_date_parseable`) takes **0 tokens** and **less than 2ms of CPU time**.
   - Replacing LLM-as-a-judge with deterministic assertions saves $100\%$ of post-processing cost.

---

## 3. Cost Optimization: Prompt Caching & Prefix Sharing

In high-volume legal review, the system prompt (120 tokens) and the master contract text (312 tokens) remain identical across consecutive queries:
- **Without Prompt Caching**: 457 input tokens billed at standard rate: $\$0.001371$.
- **With Prompt Caching (e.g. Anthropic / OpenAI / vLLM Prefix Caching)**:
  - Cache Read (432 tokens) at $\$0.75/\text{M}$: $\$0.000324$.
  - Uncached User Query (25 tokens) at $\$3.00/\text{M}$: $\$0.000075$.
  - Cached Input Cost: $\$0.000399$ (**70.9% input cost reduction**).
- **Optimized Total Cost per Query**: **$0.001860** (down from $0.002835).
