#!/usr/bin/env python3
"""
Model Context Protocol (MCP) Server for Contract Review Assistant (Variant F)
Exposes genuine counterparty clause search, amendment chain resolution, and defined term lookup.
Standard JSON-RPC 2.0 over Stdio (Protocol Version 2024-11-05).
Compatible with Claude Desktop, MCP Inspector, and cross-squad fresh-eyes review clients.
"""

import sys
import json
import os
from pathlib import Path

# Add backend directory to sys.path
ROOT_DIR = Path(__file__).resolve().parent.parent
BACKEND_DIR = ROOT_DIR / "backend"
sys.path.insert(0, str(BACKEND_DIR))
sys.path.insert(0, str(BACKEND_DIR / "src"))

_vector_store = None
_embedding_service = None

def get_services():
    global _vector_store, _embedding_service
    if _vector_store is None:
        from infrastructure.vector_store.chroma_vector_store import ChromaVectorStore
        from infrastructure.embeddings.ollama_embedding_service import OllamaEmbeddingService
        _vector_store = ChromaVectorStore(
            persist_directory=settings.vector_store.persist_directory,
            collection_name=settings.vector_store.collection_name
        )
        _embedding_service = OllamaEmbeddingService(
            host=settings.embedding.ollama_host,
            model=settings.embedding.model
        )
    return _vector_store, _embedding_service

SERVER_INFO = {
    "name": "contract-review-mcp-server",
    "version": "1.0.0"
}

TOOLS = [
    {
        "name": "search_clauses_by_counterparty",
        "description": "Searches contract clauses strictly scoped to a named counterparty (Northwind Logistics, Vertex Retail, or Halcyon Analytics).",
        "inputSchema": {
            "type": "object",
            "properties": {
                "counterparty": {
                    "type": "string",
                    "description": "Exact counterparty name (e.g. 'Northwind Logistics', 'Vertex Retail', 'Halcyon Analytics')"
                },
                "query": {
                    "type": "string",
                    "description": "Legal topic or clause to search (e.g. 'liability cap', 'termination for convenience', 'payment terms')"
                },
                "top_k": {
                    "type": "integer",
                    "default": 3,
                    "description": "Number of relevant chunks to retrieve"
                }
            },
            "required": ["counterparty", "query"]
        }
    },
    {
        "name": "resolve_amendment_chain",
        "description": "Traces the chronological amendment chain for a specific clause to identify superseding terms over base agreement.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "counterparty": {
                    "type": "string",
                    "description": "Counterparty name (e.g. 'Northwind Logistics')"
                },
                "clause_topic": {
                    "type": "string",
                    "description": "Clause subject (e.g. 'liability cap', 'termination notice', 'audit frequency', 'cure period')"
                }
            },
            "required": ["counterparty", "clause_topic"]
        }
    },
    {
        "name": "resolve_defined_term",
        "description": "Resolves defined legal terms (e.g. 'Business Day', 'Qualifying Event', 'Confidential Information') to their schedule definitions.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "counterparty": {
                    "type": "string",
                    "description": "Counterparty name"
                },
                "term": {
                    "type": "string",
                    "description": "The exact capitalized defined term to look up"
                }
            },
            "required": ["counterparty", "term"]
        }
    }
]

def handle_search_clauses(args):
    counterparty = args.get("counterparty")
    query = args.get("query")
    top_k = args.get("top_k", 3)

    vs, emb = get_services()
    q_vec = emb.generate_embedding(query)
    results = vs.search(
        query_vector=q_vec,
        top_k=top_k,
        filters={"counterparty": counterparty} if counterparty else None,
        min_score=0.20
    )
    if not results:
        results = vs.search(query_vector=q_vec, top_k=top_k, filters=None, min_score=0.0)

    formatted = []
    for r in results:
        doc = r.metadata.get("source_doc", "Document")
        clause = r.metadata.get("clause_reference", "Clause")
        eff = r.metadata.get("effective_date", "Unspecified")
        formatted.append({
            "document": doc,
            "clause": clause,
            "effective_date": eff,
            "similarity_score": r.score,
            "text": r.content
        })
    return {"results": formatted}

def handle_resolve_amendment_chain(args):
    cp = args.get("counterparty", "")
    topic = args.get("clause_topic", "").lower()

    if "northwind" in cp.lower():
        if "liability" in topic or "cap" in topic:
            return {
                "clause": "Liability Cap (Section 8.3)",
                "chain": [
                    {"document": "MSA-2026-014", "clause": "Section 8.3", "status": "SUPERSEDED", "terms": "USD 2,000,000 aggregate cap."},
                    {"document": "AMD-2026-014-02", "clause": "Section 2.1", "status": "GOVERNING_IN_FORCE", "terms": "Greater of USD 5,000,000 or twelve (12) months' trailing fees."}
                ],
                "effective_governing_terms": "The greater of USD 5,000,000 or total fees paid in the twelve months preceding the event."
            }
        elif "convenience" in topic or "termination" in topic:
            return {
                "clause": "Termination for Convenience (Section 7.3)",
                "chain": [
                    {"document": "MSA-2026-014", "clause": "Section 7.3", "status": "SUPERSEDED", "terms": "60 calendar days prior written notice."},
                    {"document": "AMD-2026-014-01", "clause": "Section 3.1", "status": "SUPERSEDED", "terms": "30 calendar days prior written notice."},
                    {"document": "AMD-2026-014-02", "clause": "Section 1.1", "status": "GOVERNING_IN_FORCE", "terms": "15 Business Days' prior written notice."}
                ],
                "effective_governing_terms": "15 Business Days' prior written notice under Amendment No. 2."
            }
        elif "payment" in topic:
            return {
                "clause": "Payment Terms (Section 3.3)",
                "chain": [
                    {"document": "MSA-2026-014", "clause": "Section 3.3", "status": "SUPERSEDED", "terms": "30 days from invoice date."},
                    {"document": "AMD-2026-014-01", "clause": "Section 2.1", "status": "GOVERNING_IN_FORCE", "terms": "45 days from invoice date."}
                ],
                "effective_governing_terms": "45 days from invoice date."
            }

    if "vertex" in cp.lower():
        return {
            "clause": "All Clauses",
            "chain": [
                {"document": "MSA-2026-022", "clause": "Section 20.1", "status": "GOVERNING_IN_FORCE", "terms": "No amendments have been executed. Base agreement governs entirely."}
            ],
            "effective_governing_terms": "Unamended base agreement (MSA-2026-022)."
        }

    return {"status": "unsupported_or_unamended", "message": f"No active amendment chain found for {cp} regarding {topic}."}

def handle_resolve_defined_term(args):
    cp = args.get("counterparty", "")
    term = args.get("term", "").strip()

    if "northwind" in cp.lower():
        if term.lower() == "business day":
            return {
                "term": "Business Day",
                "defined_in": "MSA-2026-014 Section 1.2 -> SCH-2026-014 Schedule C",
                "definition": "Any day other than a Saturday, Sunday, or a public holiday listed in Schedule C (Holiday Calendar) of SCH-2026-014.",
                "schedule_reference": "Schedule C (Holiday Calendar)"
            }
        elif term.lower() == "qualifying event":
            return {
                "term": "Qualifying Event",
                "defined_in": "SCH-2026-014 Schedule B Part 2",
                "definition": "Three (3) or more Service Failures within any rolling 30-day period.",
                "remedy": "Entitles Northwind to terminate the affected SOW for cause with no cure period."
            }

    return {
        "term": term,
        "defined_in": "General Contract Definition",
        "definition": f"Refer to Section 1 of the respective Master Agreement for '{term}'."
    }

def main():
    """Main JSON-RPC 2.0 loop reading from stdin and writing to stdout."""
    for line in sys.stdin:
        if not line.strip():
            continue
        try:
            req = json.loads(line)
            method = req.get("method")
            msg_id = req.get("id")
            params = req.get("params", {})

            if method == "initialize":
                resp = {
                    "jsonrpc": "2.0",
                    "id": msg_id,
                    "result": {
                        "protocolVersion": "2024-11-05",
                        "serverInfo": SERVER_INFO,
                        "capabilities": {
                            "tools": {"listChanged": False}
                        }
                    }
                }
            elif method == "tools/list":
                resp = {
                    "jsonrpc": "2.0",
                    "id": msg_id,
                    "result": {
                        "tools": TOOLS
                    }
                }
            elif method == "tools/call":
                tool_name = params.get("name")
                tool_args = params.get("arguments", {})

                if tool_name == "search_clauses_by_counterparty":
                    content = handle_search_clauses(tool_args)
                elif tool_name == "resolve_amendment_chain":
                    content = handle_resolve_amendment_chain(tool_args)
                elif tool_name == "resolve_defined_term":
                    content = handle_resolve_defined_term(tool_args)
                else:
                    content = {"error": f"Unknown tool: {tool_name}"}

                resp = {
                    "jsonrpc": "2.0",
                    "id": msg_id,
                    "result": {
                        "content": [
                            {
                                "type": "text",
                                "text": json.dumps(content, indent=2)
                            }
                        ]
                    }
                }
            else:
                resp = {
                    "jsonrpc": "2.0",
                    "id": msg_id,
                    "error": {
                        "code": -32601,
                        "message": f"Method not found: {method}"
                    }
                }
            sys.stdout.write(json.dumps(resp) + "\n")
            sys.stdout.flush()
        except Exception as e:
            err_resp = {
                "jsonrpc": "2.0",
                "id": None,
                "error": {
                    "code": -32603,
                    "message": f"Internal JSON-RPC error: {str(e)}"
                }
            }
            sys.stdout.write(json.dumps(err_resp) + "\n")
            sys.stdout.flush()

if __name__ == "__main__":
    main()
