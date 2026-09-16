#!/usr/bin/env python3
"""
Week 9 Module 5: MCP, Multi-Agent & A2A Evaluation Runner
Single-command CLI script to test MCP Handshake, Tool Discovery (tools/list),
Tool Calling (tools/call), Protocol Logging, and Agent Execution with zero code modification!
"""

import sys
import os
import json
from pathlib import Path

# Add backend to sys.path
backend_path = Path(__file__).resolve().parent / "backend"
if str(backend_path) not in sys.path:
    sys.path.insert(0, str(backend_path))

from services.mcp_service import MCPManager, MCPAgentRunner


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
    print_banner("WEEK 9 MODULE 5: MCP (MODEL CONTEXT PROTOCOL) & A2A EVALUATION SUITE")

    mcp_mgr = MCPManager()
    agent_runner = MCPAgentRunner(mcp_manager=mcp_mgr)

    # 1. Active MCP Servers List
    print("\n[1] ACTIVE DOMAIN MCP SERVERS (TRACKS A-F)")
    headers = ["Server ID", "Name", "Track", "Version", "Transport", "Tools Count", "Status"]
    rows = []
    for srv in mcp_mgr.servers.values():
        rows.append([
            srv.server_id,
            srv.name[:32],
            f"Track {srv.track_code}" if srv.track_code else "Custom",
            srv.version,
            srv.transport_type,
            len(srv._tools),
            srv.status
        ])
    print_table(headers, rows)

    # 2. RAW MCP Handshake Inspection
    print_banner("MCP PROTOCOL HANDSHAKE INSPECTION (initialize & notifications/initialized)")
    handshake_res = mcp_mgr.perform_handshake("mcp-server-track-a")
    print(f"Server ID: {handshake_res['server_id']}")
    print("\n---> INBOUND REQUEST ('initialize'):")
    print(json.dumps(handshake_res['initialize_request'], indent=2))
    print("\n<--- OUTBOUND RESPONSE ('initialize' Result):")
    print(json.dumps(handshake_res['initialize_response'], indent=2))

    # 3. Dynamic Tool Discovery over MCP (tools/list)
    print_banner("DYNAMIC TOOL DISCOVERY OVER MCP ('tools/list') — ZERO AGENT CODE CHANGE")
    print("Issuing JSON-RPC 'tools/list' request across all connected MCP Servers...")
    discovered = mcp_mgr.discover_tools()
    
    headers_disc = ["Tool Name", "Server Name", "Track", "Description"]
    rows_disc = []
    for t in discovered:
        rows_disc.append([
            t["name"],
            t["server_name"][:28],
            f"Track {t['track_code']}" if t.get('track_code') else "Custom",
            t["description"][:45] + "..."
        ])
    print_table(headers_disc, rows_disc)

    # 4. Single Tool Call over MCP (tools/call)
    print_banner("DIRECT TOOL EXECUTION OVER MCP ('tools/call')")
    call_res = mcp_mgr.call_tool("lookup_ticket_db", {"order_id": "#90214"})
    print(f"Tool Name:  lookup_ticket_db")
    print(f"MCP Server: {call_res['server_name']}")
    print("\n---> REQUEST Payload ('tools/call'):")
    print(json.dumps(call_res['request'], indent=2))
    print("\n<--- RESPONSE Payload:")
    print(json.dumps(call_res['response'], indent=2))

    # 5. Agent Run with 2nd Tool Plugged In
    print_banner("AGENT RUN WITH DYNAMIC 2ND MCP SERVER PLUGGED IN")
    print("Testing mentor requirement: Can a second tool be added without changing agent code?")
    agent_res = agent_runner.run_agent_mcp(
        query="My order #90214 custom headset is damaged and I want a full refund.",
        track_code="A",
        include_second_server=True
    )

    print(f"Query: \"{agent_res['query']}\"")
    print(f"Discovery Mode: {agent_res['mcp_discovery_mode']}")
    print(f"Discovered Tools Count: {agent_res['discovered_tools_count']}")
    print(f"Connected Servers: {', '.join(agent_res['connected_servers'])}")
    print(f"2nd Server Plugged: {agent_res['second_server_plugged']}")
    print(f"Total Steps: {agent_res['total_steps']} | Latency: {agent_res['total_latency_ms']}ms | Cost: ${agent_res['cost_dollars']:.6f}")

    print("\n--- AGENT STEP TRAJECTORY VIA MCP SOCKETS ---")
    for s in agent_res["steps"]:
        print(f"\n  [Step {s['step_index']}] Timestamp: {s['timestamp']} | Server: {s['mcp_server']}")
        print(f"    Thought:     {s['thought']}")
        print(f"    Action Tool: {s['action_tool']} ({s['tool_input']})")
        print(f"    Observation: {s['observation']}")

    print(f"\n[FINAL ANSWER]: {agent_res['final_answer']}")

    # 6. Plain Explanation: Where does AI run?
    print_banner("MENTOR CONCEPTUAL CHECK: WHERE DOES THE AI ACTUALLY RUN?")
    arch = agent_res["mcp_architecture_explanation"]
    print(f"  * AI Location:     {arch['ai_location']}")
    print(f"  * Server Location: {arch['server_location']}")
    print(f"  * Why It Matters:  {arch['why_it_matters']}")
    print("=" * 90 + "\n")


if __name__ == "__main__":
    main()
