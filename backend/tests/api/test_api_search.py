"""
API Tests: Semantic Search & Vector Retrieval
"""

from fastapi.testclient import TestClient
from api.main import app

client = TestClient(app)

def test_api_search_relevant_query():
    resp = client.post("/api/search", json={
        "query": "notice period for termination for convenience",
        "top_k": 3,
        "similarity_threshold": 0.1
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "results" in data
    assert "total_results" in data

def test_api_search_validation_empty_query():
    resp = client.post("/api/search", json={"query": ""})
    assert resp.status_code == 422
