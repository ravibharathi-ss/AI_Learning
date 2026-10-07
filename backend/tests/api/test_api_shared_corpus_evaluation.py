"""
Automated API Tests for Shared Legal Corpus Evaluation Endpoints
Validates API-level inspection and evaluation of the 32 Golden Set cases.
"""

import pytest
from fastapi.testclient import TestClient
from api.main import app

client = TestClient(app)

def test_get_golden_set_cases_metadata():
    """Verify inspection endpoint returns the 32 ground-truth test cases."""
    response = client.get("/api/evaluation/golden-set/cases")
    assert response.status_code == 200
    data = response.json()
    assert "_meta" in data
    assert data["_meta"]["total_cases"] == 32
    assert "cases" in data
    assert len(data["cases"]) == 32

    # Check key classes exist
    classes = {c["class"] for c in data["cases"]}
    expected_classes = {
        "direct_lookup",
        "counterparty_disambiguation",
        "amendment_supersession",
        "defined_term_chase",
        "multi_hop_dependent",
        "version_comparison",
        "computation",
        "cross_document",
        "out_of_scope"
    }
    assert expected_classes.issubset(classes)

def test_api_evaluation_out_of_scope_apex_refusal():
    """Verify GS-029 produces ungrounded refusal for non-existent Apex Industries."""
    response = client.post("/api/evaluation/golden-set/run?case_id=GS-029")
    assert response.status_code == 200
    data = response.json()
    assert data["case_id"] == "GS-029"
    assert data["status"] == "pass"
    assert "refusal" in data["actual_answer"].lower() or "apex" in data["actual_answer"].lower()

def test_api_evaluation_out_of_scope_svc05_refusal():
    """Verify GS-031 refuses non-existent Service SVC-05."""
    response = client.post("/api/evaluation/golden-set/run?case_id=GS-031")
    assert response.status_code == 200
    data = response.json()
    assert data["case_id"] == "GS-031"
    assert data["status"] == "pass"
    assert "svc-05" in data["actual_answer"].lower()
    assert "refusal" in data["actual_answer"].lower() or "does not exist" in data["actual_answer"].lower()

def test_api_evaluation_vertex_counterparty_disambiguation():
    """Verify GS-006 retrieves Vertex Retail USD 500,000 cap without Northwind distractor."""
    response = client.post("/api/evaluation/golden-set/run?case_id=GS-006")
    assert response.status_code == 200
    data = response.json()
    assert data["case_id"] == "GS-006"
    assert data["status"] == "pass"
    assert "500,000" in data["actual_answer"]
    assert any("MSA-2026-022" in s for s in data["cited_sources"])
