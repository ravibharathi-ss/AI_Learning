"""
API Tests: Health Check Endpoints
Tests /health, /health/live, and /health/ready without frontend dependency.
"""

from fastapi.testclient import TestClient
from api.main import app

client = TestClient(app)

def test_api_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["data"]["status"] == "healthy"
    assert data["data"]["database"] == "connected"

def test_api_liveness_probe():
    response = client.get("/health/live")
    assert response.status_code == 200
    assert response.json()["status"] == "alive"

def test_api_readiness_probe():
    response = client.get("/health/ready")
    assert response.status_code == 200
    assert response.json()["status"] == "ready"

def test_api_diagnostics_endpoint():
    response = client.get("/api/diagnostics")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "operational"
    assert "components" in data
    assert "database" in data["components"]
    assert "vector_store" in data["components"]
