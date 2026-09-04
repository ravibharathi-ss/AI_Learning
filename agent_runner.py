#!/usr/bin/env python3
"""
Week 7 Module 4: Agent Loops — and When Not to Use Them
Single-command CLI Evaluation Runner for Agent vs Fixed Workflow Race
"""

import sys
import os
from pathlib import Path

# Add backend to sys.path
backend_path = Path(__file__).resolve().parent / "backend"
if str(backend_path) not in sys.path:
    sys.path.insert(0, str(backend_path))

from services.agent_service import AgentService


def print_banner(title: str):
    print("\n" + "=" * 85)
    print(f" {title.center(83)} ")
    print("=" * 85)


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
    print_banner("WEEK 7 MODULE 4: AGENT LOOPS VS FIXED WORKFLOW RACE SUITE")
    
    service = AgentService()
    suite = service.run_benchmark_suite()
    
    print(f"\n[1] AGENT VS FIXED WORKFLOW RACE METRICS BY TRACK (TRACKS A-F)")
    
    headers = [
        "Track", "Topic", "Agent Time", "Fixed Time", "Speedup", 
        "Agent Cost", "Fixed Cost", "Cost Savings", "Race Winner"
    ]
    rows = []
    
    for item in suite["results"]:
        t_code = item["track_code"]
        t_name = item["track_name"]
        a_res = item["agent_result"]
        f_res = item["fixed_result"]
        m_comp = item["metrics_comparison"]
        
        rows.append([
            f"Track {t_code}",
            t_name[:20],
            f"{a_res['total_latency_ms']}ms",
            f"{f_res['total_latency_ms']}ms",
            f"{m_comp['latency']['speedup_multiplier']}x faster",
            f"${a_res['cost_dollars']:.5f}",
            f"${f_res['cost_dollars']:.5f}",
            f"{m_comp['cost']['fixed_savings_pct']}% cheaper",
            item["race_winner"]
        ])
        
    print_table(headers, rows)
    
    print_banner("AGGREGATE BENCHMARK SUMMARY")
    agg = suite["aggregate_summary"]
    print(f"  * Average Fixed Workflow Speedup:   {agg['avg_fixed_speedup']}")
    print(f"  * Average Fixed Workflow Cost Saving: {agg['avg_fixed_cost_savings']}")
    print(f"  * Fixed Workflow Reliability:       {agg['fixed_reliability_avg']}")
    print(f"  * Agent Loop Reliability:          {agg['agent_reliability_avg']}")
    print(f"\n  [VERDICT]: {agg['overall_verdict']}")
    
    print_banner("DETAILED REACTION & STEP INSPECTOR DEMO (TRACK A - CUSTOMER SUPPORT)")
    track_a_res = suite["results"][0]["agent_result"]
    print(f"  Query: \"{track_a_res['query']}\"")
    print(f"  Execution Mode: {track_a_res['execution_mode']}")
    print(f"  Total Steps: {track_a_res['total_steps']} | Total Tokens: {track_a_res['total_tokens']}")
    
    print("\n--- VISIBLE AGENT STEP TRAJECTORY ---")
    for step in track_a_res["steps"]:
        print(f"\n  [Step {step['step_index']}] Timestamp: {step['timestamp']} | Latency: {step['latency_ms']}ms | Tokens: {step['tokens_used']}")
        print(f"    Thought:     {step['thought']}")
        print(f"    Action Tool: {step['action_tool']} ({step['tool_input']})")
        print(f"    Observation: {step['observation']}")
        
    print(f"\n  [FINAL ANSWER]: {track_a_res['final_answer']}")
    
    print_banner("SHIP RECOMMENDATION & DECISION FRAMEWORK")
    print(f"  {suite['results'][0]['ship_recommendation']}")
    print("=" * 85 + "\n")


if __name__ == "__main__":
    main()
