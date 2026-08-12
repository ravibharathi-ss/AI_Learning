import os
import re
import math
import json
import urllib.request
import uuid
from typing import List, Dict
from sqlalchemy.orm import Session
import models

class RagService:
    def __init__(self):
        self.ollama_host = os.getenv("OLLAMA_HOST", "http://host.docker.internal:11434")
        # Use a dedicated lightweight embedding model, NOT the chat model
        self.embed_model = os.getenv("OLLAMA_EMBED_MODEL", "nomic-embed-text")

    def chunk_text(self, text: str, chunk_size: int = 500, overlap: int = 100) -> List[str]:
        """
        Splits text into overlapping chunks of chunk_size characters.
        """
        chunks = []
        if not text:
            return chunks

        # Normalize whitespace
        text = re.sub(r'\s+', ' ', text).strip()

        start = 0
        while start < len(text):
            end = start + chunk_size
            chunks.append(text[start:end])
            start += chunk_size - overlap
            if start >= len(text) - overlap:
                break
        return chunks

    def get_embedding(self, text: str) -> List[float]:
        """
        Generates embedding vector using the dedicated Ollama embed model.
        Uses the /api/embed endpoint (Ollama v0.3.6+) which works with
        nomic-embed-text and other dedicated embedding models.
        """
        url = f"{self.ollama_host}/api/embed"
        payload = {
            "model": self.embed_model,
            "input": text
        }

        try:
            data = json.dumps(payload).encode("utf-8")
            req = urllib.request.Request(
                url,
                data=data,
                headers={"Content-Type": "application/json"},
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=30) as response:
                res_json = json.loads(response.read().decode("utf-8"))
                # /api/embed returns {"embeddings": [[...]]}
                embeddings = res_json.get("embeddings", [])
                return embeddings[0] if embeddings else []
        except Exception as e:
            print(f"Error generating embedding via Ollama ({self.embed_model}): {str(e)}")
            return []

    def compute_cosine_similarity(self, vec1: List[float], vec2: List[float]) -> float:
        """
        Computes cosine similarity between two vectors.
        """
        if not vec1 or not vec2:
            return 0.0
        dot_product = sum(a * b for a, b in zip(vec1, vec2))
        magnitude1 = math.sqrt(sum(a * a for a in vec1))
        magnitude2 = math.sqrt(sum(b * b for b in vec2))
        if magnitude1 == 0 or magnitude2 == 0:
            return 0.0
        return dot_product / (magnitude1 * magnitude2)

    def index_document(self, db: Session, filename: str, content: str) -> models.Document:
        """
        Chunks the document content, generates embeddings locally, and saves them to SQLite.
        """
        # 1. Create document database entry
        doc = models.Document(filename=filename)
        db.add(doc)
        db.commit()
        db.refresh(doc)

        # 2. Chunk text
        chunks = self.chunk_text(content)

        # 3. Save chunks and embeddings
        for chunk_text in chunks:
            embedding = self.get_embedding(chunk_text)
            embedding_json = json.dumps(embedding)

            db_chunk = models.DocumentChunk(
                document_id=doc.id,
                content=chunk_text,
                embedding_json=embedding_json
            )
            db.add(db_chunk)

        db.commit()
        return doc

    def retrieve(self, db: Session, query: str, limit: int = 3) -> List[Dict]:
        """
        Queries all document chunks, computes cosine similarity with query embedding, and returns top chunks.
        """
        all_chunks = db.query(models.DocumentChunk).all()
        if not all_chunks:
            return []

        # Generate query embedding
        query_embedding = self.get_embedding(query)
        if not query_embedding:
            return []

        scored_chunks = []
        for chunk in all_chunks:
            try:
                chunk_embedding = json.loads(chunk.embedding_json)
                if chunk_embedding:
                    score = self.compute_cosine_similarity(query_embedding, chunk_embedding)
                    scored_chunks.append((score, chunk))
            except Exception as e:
                print(f"Error parsing embedding for chunk {chunk.id}: {e}")
                continue

        # Sort by score descending
        scored_chunks.sort(key=lambda x: x[0], reverse=True)

        results = []
        for score, chunk in scored_chunks[:limit]:
            if score > 0.1:  # Simple threshold to filter out unrelated chunks
                results.append({
                    "id": chunk.id,
                    "document_id": chunk.document_id,
                    "filename": chunk.document.filename,
                    "content": chunk.content,
                    "score": score
                })
        return results
