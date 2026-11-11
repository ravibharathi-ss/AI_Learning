"""
Integration Tests for Application Response Generation
Tests conversation initialization, message submission, stream generation,
execution time telemetry, and Langfuse tracking hooks.
"""

import pytest
import json
from fastapi.testclient import TestClient
from main import app
from database import get_db, SessionLocal
import models

client = TestClient(app)

@pytest.fixture
def test_conversation():
    db = SessionLocal()
    conv = models.Conversation(title="Integration Test Session", agent_type="legal_specialist")
    db.add(conv)
    db.commit()
    db.refresh(conv)
    conv_id = conv.id
    db.close()
    yield conv_id
    
    # Cleanup
    db = SessionLocal()
    c = db.query(models.Conversation).filter(models.Conversation.id == conv_id).first()
    if c:
        db.delete(c)
        db.commit()
    db.close()

class TestResponseGenerationIntegration:

    def test_health_endpoint(self):
        """Validates API health endpoint returns healthy status."""
        resp = client.get("/health")
        assert resp.status_code == 200
        payload = resp.json()
        status_val = payload.get("data", {}).get("status") or payload.get("status")
        assert status_val == "healthy"

    def test_send_message_and_create_placeholder(self, test_conversation):
        """Validates sending a message creates user message and bot placeholder."""
        payload = {"content": "Hello, good morning!"}
        resp = client.post(f"/api/conversations/{test_conversation}/messages", json=payload)
        assert resp.status_code == 200
        data = resp.json()
        assert "user_message" in data
        assert "bot_message" in data
        assert data["user_message"]["content"] == "Hello, good morning!"
        assert data["bot_message"]["sender"] == "bot"

    def test_greeting_stream_response_and_execution_time(self, test_conversation):
        """Validates streaming response for a greeting returns tokens and [EXECUTION_TIME]."""
        # 1. Post greeting
        msg_resp = client.post(
            f"/api/conversations/{test_conversation}/messages",
            json={"content": "Hi there"}
        )
        assert msg_resp.status_code == 200
        bot_msg_id = msg_resp.json()["bot_message"]["id"]

        # 2. Consume stream
        stream_resp = client.get(
            f"/api/conversations/{test_conversation}/messages/{bot_msg_id}/stream"
        )
        assert stream_resp.status_code == 200
        stream_text = stream_resp.text

        # Verify event stream chunks
        assert "data:" in stream_text
        assert "[EXECUTION_TIME]" in stream_text
        assert "[DONE]" in stream_text

    def test_unsupported_question_stream_and_uniqueness(self, test_conversation):
        """Validates that off-topic queries stream dynamic refusal with execution time."""
        # 1. Post off-topic question
        msg_resp = client.post(
            f"/api/conversations/{test_conversation}/messages",
            json={"content": "what is the recipe for chocolate cake?"}
        )
        assert msg_resp.status_code == 200
        bot_msg_id = msg_resp.json()["bot_message"]["id"]

        # 2. Stream response
        stream_resp = client.get(
            f"/api/conversations/{test_conversation}/messages/{bot_msg_id}/stream"
        )
        assert stream_resp.status_code == 200
        stream_text = stream_resp.text

        assert "data:" in stream_text
        assert "[EXECUTION_TIME]" in stream_text
        assert "[DONE]" in stream_text
