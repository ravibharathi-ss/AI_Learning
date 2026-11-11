"""
Integration Tests for Application Error Handling
Tests 404 responses on non-existent conversations/messages, malformed payloads,
and graceful degradation.
"""

import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

class TestErrorHandlingIntegration:

    def test_get_non_existent_conversation_returns_404(self):
        """Validates that querying a non-existent conversation returns HTTP 404."""
        resp = client.get("/api/conversations/non-existent-uuid-1234/messages")
        assert resp.status_code == 404
        assert "not found" in resp.json().get("detail", "").lower()

    def test_post_message_to_non_existent_conversation_returns_404(self):
        """Validates that posting to a non-existent conversation returns HTTP 404."""
        resp = client.post("/api/conversations/non-existent-uuid-1234/messages", json={"content": "test"})
        assert resp.status_code == 404

    def test_stream_non_existent_message_returns_404(self):
        """Validates that streaming a non-existent message id returns HTTP 404."""
        resp = client.get("/api/conversations/dummy-conv/messages/99999999/stream")
        assert resp.status_code == 404

    def test_post_feedback_on_invalid_message_returns_404(self):
        """Validates that submitting feedback on a non-existent message returns HTTP 404."""
        resp = client.post("/api/messages/99999999/feedback", json={"rating": "thumbs_up"})
        assert resp.status_code == 404

    def test_post_message_with_empty_payload_fails_validation(self):
        """Validates that sending malformed JSON fails with 422 Unprocessable Entity."""
        resp = client.post("/api/conversations/some-id/messages", json={})
        assert resp.status_code == 422
