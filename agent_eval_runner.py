#!/usr/bin/env python3
"""
Week 8 Module 4: Agent Failure Modes, Trajectory Evals & Security Runner
Single-command CLI script testing Failure Taxonomy, Trajectory Sequence Alignment,
Outcome vs Trajectory Gap Detection, Prompt Injection Attack & Defense, and Before/After Benchmarking!
"""

import sys
import os
import json
from pathlib import Path

# Add backend to sys.path
backend_path = Path(__file__).resolve().parent / "backend"
if str(backend_path) not in sys.path:
    sys.path.insert(0, str(backend_path))

from services.agent_eval_service import AgentEvalService


def print_banner(title: str):
    print("\n" + "=" * 90)
    print(f" {title.center(88)} ")
    print("=" * 90)


def print_table(headers, rows):
    col_widths = [len(h) for h in headers]
    for row in rows:
        for i, val in enumerate(row):
            col_widths[i] = max(col_widths[i], len(str(val)))
            
    header_str = " | ".join(h.ljust(col_widths[i]) for i, h in enumerate(headers))
    separator = "-+-".join("-" * col_widths[i] for i in range(len(headers)))
    
    print(header_str)
    print(separator)
    for row in rows:
        print(" | ".join(str(val).ljust(col_widths[i]) for i, val in enumerate(row)))


def main():
    print_banner("WEEK 8 MODULE 4: AGENT FAILURE MODES & TRAJECTORY EVALUATION SUITE")

    service = AgentEvalService()

    # 1. Failure Modes Taxonomy
    print("\n[1] AGENT FAILURE MODES CATALOG & REMEDIES")
    headers = ["ID", "Name", "Severity", "Description Summary"]
    rows = []
    for fm in service.get_failure_taxonomy():
        rows.append([
            fm["id"],
            fm["name"],
            fm["severity"],
            fm["description"][:52] + "..."
        ])
    print_table(headers, rows)

    # 2. Outcome vs Trajectory Gap Detection (Lucky Right Answer Test)
    print_banner("OUTCOME VS TRAJECTORY GAP INSPECTION (LUCKY RIGHT ANSWER TEST)")
    gap_test = service.evaluate_trajectory(
        query="My order #90214 custom headset is damaged and I want a full refund.",
        actual_trajectory=["calculate_refund_amount"],  # Skipped ticket db & return policy check!
        final_answer="Under Final Sale rules, refund amount is $0.00.",
        track_code="A"
    )

    print(f"Query: \"{gap_test['query']}\"")
    print(f"Expected Tool Sequence: {gap_test['expected_sequence']}")
    print(f"Actual Tool Trajectory: {gap_test['actual_trajectory']}")
    print(f"Tool Sequence Aligned:  {gap_test['sequence_aligned']}")
    print(f"Outcome Text Correct:   {gap_test['outcome_correct']}")
    print(f"OUTCOME VS TRAJECTORY GAP: {gap_test['outcome_vs_trajectory_gap']}")
    print(f"Classification:         {gap_test['gap_classification']}")
    print(f"[EXPLANATION]: {gap_test['explanation']}")

    # 3. Prompt Injection Security Lab (Unprotected vs Protected)
    print_banner("PROMPT INJECTION SECURITY LAB (INDIRECT CONTEXT HIJACKING)")
    
    # Test A: Unprotected
    unprotected_res = service.test_prompt_injection(attack_type="indirect", track_code="A", defense_enabled=False)
    print("\n--- TEST A: DEFENSE DISABLED (UNPROTECTED) ---")
    print(f"Attack Type:       {unprotected_res['attack_type'].upper()}")
    print(f"Indirect Payload:  \"{unprotected_res['retrieved_doc_context']}\"")
    print(f"Attack Successful: {unprotected_res['attack_successful']}")
    print(f"Agent Response:    {unprotected_res['final_agent_response']}")

    # Test B: Protected
    protected_res = service.test_prompt_injection(attack_type="indirect", track_code="A", defense_enabled=True)
    print("\n--- TEST B: DEFENSE ENABLED (PROTECTED) ---")
    print(f"Attack Detected:   {protected_res['attack_detected']}")
    print(f"Mitigation Mode:   {protected_res['mitigation_applied']}")
    print(f"Attack Successful: {protected_res['attack_successful']}")
    print(f"Agent Response:    {protected_res['final_agent_response']}")
    print(f"[SECURITY RECOMMENDATION]: {protected_res['security_recommendation']}")

    # 4. Before-and-After Improvement Benchmark
    print_banner("BEFORE-AND-AFTER MITIGATION BENCHMARK (FAILURE RATE % REDUCTION)")
    bm = service.run_mitigation_benchmark()

    print(f"Total Cases Tested:           {bm['total_cases_tested']}")
    print(f"Baseline Failure Rate:        {bm['baseline_failure_rate_pct']}%")
    print(f"Post-Mitigation Failure Rate: {bm['post_mitigation_failure_rate_pct']}%")
    print(f"Failure Rate Reduction:       {bm['failure_rate_reduction_pct']}%")
    
    headers_bm = ["Track", "Name", "Baseline Fail %", "Mitigated Fail %", "Top Mode Closed"]
    rows_bm = []
    for r in bm["track_results"]:
        rows_bm.append([
            f"Track {r['track_code']}",
            r["track_name"][:25],
            f"{r['baseline_failure_rate_pct']}%",
            f"{r['post_mitigation_failure_rate_pct']}%",
            r["top_mode_closed"][:35]
        ])
    print_table(headers_bm, rows_bm)

    print(f"\n[MENTOR VERDICT]: {bm['mentor_verdict']}")
    print("=" * 90 + "\n")


if __name__ == "__main__":
    main()
