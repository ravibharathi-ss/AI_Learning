"""
API Tests: Document Ingestion, Status, Retrieval & Deletion
Validates complete document lifecycle directly through HTTP endpoints without UI.
"""

import io
from fastapi.testclient import TestClient
from api.main import app

client = TestClient(app)

def test_document_lifecycle_api():
    # 1. Upload valid document
    file_content = (
        b"Section 1.1 Definitions and Scope.\n\n"
        b"Section 12.3 Termination for Convenience: Sixty (60) days prior written notice is required."
    )
    files = {"file": ("api_test_contract.txt", io.BytesIO(file_content), "text/plain")}

    upload_resp = client.post("/api/documents", files=files)
    assert upload_resp.status_code == 201
    upload_data = upload_resp.json()
    assert "document_id" in upload_data
    doc_id = upload_data["document_id"]
    assert upload_data["status"] == "completed"

    # 2. Get document status & detail
    get_resp = client.get(f"/api/documents/{doc_id}")
    assert get_resp.status_code == 200
    doc_detail = get_resp.json()
    assert doc_detail["id"] == doc_id
    assert doc_detail["chunk_count"] >= 1
    assert len(doc_detail["chunks"]) >= 1

    # 2b. Diagnostic status endpoint
    status_resp = client.get(f"/api/documents/{doc_id}/status")
    assert status_resp.status_code == 200
    status_data = status_resp.json()
    assert status_data["document_id"] == doc_id
    assert status_data["status"] == "completed"
    assert status_data["indexed"] is True

    # 3. List documents
    list_resp = client.get("/api/documents")
    assert list_resp.status_code == 200
    docs = list_resp.json()
    assert any(d["id"] == doc_id for d in docs)

    # 4. Process document endpoint
    proc_resp = client.post(f"/api/documents/{doc_id}/process", json={"chunk_size": 300})
    assert proc_resp.status_code == 200
    assert proc_resp.json()["status"] == "completed"

    # 5. Delete document
    del_resp = client.delete(f"/api/documents/{doc_id}")
    assert del_resp.status_code == 204

    # 6. Verify deleted (404)
    after_del = client.get(f"/api/documents/{doc_id}")
    assert after_del.status_code == 404

def test_upload_invalid_file_extension():
    files = {"file": ("malicious_script.exe", io.BytesIO(b"binary executable"), "application/octet-stream")}
    resp = client.post("/api/documents", files=files)
    assert resp.status_code == 400
    assert "Unsupported file extension" in resp.json()["detail"]

def test_upload_empty_document():
    files = {"file": ("empty.txt", io.BytesIO(b""), "text/plain")}
    resp = client.post("/api/documents", files=files)
    assert resp.status_code in [400, 422]
