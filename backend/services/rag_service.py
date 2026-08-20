import os
import re
import math
import json
import urllib.request
from typing import List, Dict, Any, Tuple
from sqlalchemy.orm import Session

try:
    import models
except ImportError:
    from backend import models

try:
    import chromadb
    CHROMA_AVAILABLE = True
except ImportError:
    CHROMA_AVAILABLE = False

class RagService:
    def __init__(self):
        self.ollama_host = os.getenv("OLLAMA_HOST", "http://host.docker.internal:11434")
        self.embed_model = os.getenv("OLLAMA_EMBED_MODEL", "nomic-embed-text")

        # Initialize ChromaDB Vector Database
        self.chroma_path = os.getenv("CHROMA_DB_PATH", os.path.join(os.path.dirname(__file__), "..", "chroma_db"))
        self.collection = None
        if CHROMA_AVAILABLE:
            try:
                os.makedirs(self.chroma_path, exist_ok=True)
                self.chroma_client = chromadb.PersistentClient(path=self.chroma_path)
                self.collection = self.chroma_client.get_or_create_collection(
                    name="rag_knowledge_base",
                    metadata={"hnsw:space": "cosine"}
                )
                print(f"ChromaDB Vector Database initialized at '{self.chroma_path}'.")
            except Exception as e:
                print(f"Error initializing ChromaDB: {e}")
                self.collection = None

    def rewrite_query(self, query: str) -> Dict[str, Any]:
        """
        Cleans up and expands query into semantic query and exact keyword search tokens.
        """
        cleaned = re.sub(r'[^\w\s\-]', ' ', query)
        tokens = [t.lower() for t in cleaned.split() if len(t) > 1]
        exact_codes = re.findall(r'\b[A-Z0-9]{2,}\-[0-9]{3,}\b|\b[A-Z]{3,}[0-9]{2,}\b|\b\d{4}\b', query, re.IGNORECASE)
        
        stop_words = {'what', 'is', 'the', 'how', 'do', 'i', 'can', 'a', 'an', 'to', 'for', 'of', 'in', 'on', 'with', 'about', 'your', 'my', 'me', 'tell', 'show'}
        keywords = [t for t in tokens if t not in stop_words]

        return {
            "original_query": query,
            "rewritten_query": " ".join(keywords) if keywords else query,
            "tokens": keywords,
            "exact_codes": exact_codes
        }

    def chunk_text(self, text: str, chunk_size: int = 500, overlap: int = 100) -> List[str]:
        """
        Splits text into overlapping chunks of chunk_size characters.
        """
        chunks = []
        if not text:
            return chunks

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
        Generates embedding vector using the dedicated Ollama embed model via /api/embed.
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
                embeddings = res_json.get("embeddings", [])
                return embeddings[0] if embeddings else []
        except Exception as e:
            print(f"Error generating embedding via Ollama ({self.embed_model}): {str(e)}")
            return []

    def compute_cosine_similarity(self, vec1: List[float], vec2: List[float]) -> float:
        """
        Computes cosine similarity between two embedding vectors.
        """
        if not vec1 or not vec2 or len(vec1) != len(vec2):
            return 0.0
        dot_product = sum(a * b for a, b in zip(vec1, vec2))
        magnitude1 = math.sqrt(sum(a * a for a in vec1))
        magnitude2 = math.sqrt(sum(b * b for b in vec2))
        if magnitude1 == 0 or magnitude2 == 0:
            return 0.0
        return dot_product / (magnitude1 * magnitude2)

    def bm25_search(self, query_info: Dict[str, Any], chunks: List[models.DocumentChunk]) -> List[Tuple[float, models.DocumentChunk]]:
        """
        Computes BM25 / Keyword exact-matching score for all chunks.
        """
        tokens = query_info["tokens"]
        exact_codes = [c.lower() for c in query_info["exact_codes"]]

        if not tokens and not exact_codes:
            return [(0.0, chunk) for chunk in chunks]

        N = len(chunks)
        if N == 0:
            return []

        avgdl = sum(len(c.content.split()) for c in chunks) / N if N > 0 else 1.0
        k1 = 1.5
        b = 0.75

        doc_freq = {}
        for token in tokens:
            doc_freq[token] = sum(1 for c in chunks if token in c.content.lower())

        scored_chunks = []
        for chunk in chunks:
            content_lower = chunk.content.lower()
            chunk_tokens = content_lower.split()
            doc_len = len(chunk_tokens)

            score = 0.0

            for code in exact_codes:
                if code in content_lower:
                    score += 10.0

            for token in tokens:
                tf = content_lower.count(token)
                if tf > 0:
                    df = doc_freq.get(token, 1)
                    idf = math.log((N - df + 0.5) / (df + 0.5) + 1.0)
                    numerator = tf * (k1 + 1)
                    denominator = tf + k1 * (1 - b + b * (doc_len / (avgdl or 1.0)))
                    score += idf * (numerator / denominator)

            scored_chunks.append((score, chunk))

        scored_chunks.sort(key=lambda x: x[0], reverse=True)
        return scored_chunks

    def reciprocal_rank_fusion(
        self, 
        semantic_ranked: List[Tuple[float, models.DocumentChunk]], 
        bm25_ranked: List[Tuple[float, models.DocumentChunk]], 
        k: int = 60
    ) -> List[Dict[str, Any]]:
        """
        Combines Vector Ranks and BM25 Keyword Ranks using RRF formula:
        RRF_score(d) = 1 / (k + rank_semantic(d)) + 1 / (k + rank_bm25(d))
        """
        rrf_scores: Dict[int, Dict[str, Any]] = {}

        for rank, (score, chunk) in enumerate(semantic_ranked, start=1):
            chunk_id = chunk.id
            if chunk_id not in rrf_scores:
                rrf_scores[chunk_id] = {
                    "chunk": chunk,
                    "semantic_score": score,
                    "semantic_rank": rank,
                    "bm25_score": 0.0,
                    "bm25_rank": 999,
                    "rrf_score": 0.0
                }
            rrf_scores[chunk_id]["rrf_score"] += 1.0 / (k + rank)

        for rank, (score, chunk) in enumerate(bm25_ranked, start=1):
            chunk_id = chunk.id
            if chunk_id not in rrf_scores:
                rrf_scores[chunk_id] = {
                    "chunk": chunk,
                    "semantic_score": 0.0,
                    "semantic_rank": 999,
                    "bm25_score": score,
                    "bm25_rank": rank,
                    "rrf_score": 0.0
                }
            else:
                rrf_scores[chunk_id]["bm25_score"] = score
                rrf_scores[chunk_id]["bm25_rank"] = rank

            rrf_scores[chunk_id]["rrf_score"] += 1.0 / (k + rank)

        results = list(rrf_scores.values())
        results.sort(key=lambda x: x["rrf_score"], reverse=True)
        return results

    def rerank_chunks(self, query_info: Dict[str, Any], candidates: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Second-pass Relevance Reranker.
        """
        tokens = query_info["tokens"]
        exact_codes = query_info["exact_codes"]

        reranked = []
        for candidate in candidates:
            chunk: models.DocumentChunk = candidate["chunk"]
            content_lower = chunk.content.lower()

            rerank_score = candidate["rrf_score"] * 100.0

            for code in exact_codes:
                if code.lower() in content_lower:
                    rerank_score += 50.0

            token_matches = sum(1 for t in tokens if t in content_lower)
            if tokens:
                density = token_matches / len(tokens)
                rerank_score += density * 30.0

            if candidate["semantic_score"] > 0.4:
                rerank_score += candidate["semantic_score"] * 20.0

            candidate_copy = dict(candidate)
            candidate_copy["rerank_score"] = round(rerank_score, 4)
            reranked.append(candidate_copy)

        reranked.sort(key=lambda x: x["rerank_score"], reverse=True)
        return reranked

    def index_document(self, db: Session, filename: str, content: str) -> models.Document:
        """
        Chunks document content, generates embeddings, and saves to SQLite and ChromaDB Vector DB.
        """
        existing_docs = db.query(models.Document).filter(models.Document.filename == filename).all()
        for old_doc in existing_docs:
            db.delete(old_doc)
        db.commit()

        # Sync deletion with ChromaDB
        if self.collection:
            try:
                self.collection.delete(where={"filename": filename})
            except Exception as e:
                print(f"ChromaDB collection deletion note: {e}")

        doc = models.Document(filename=filename)
        db.add(doc)
        db.commit()
        db.refresh(doc)

        chunks = self.chunk_text(content)
        chroma_ids = []
        chroma_embeddings = []
        chroma_documents = []
        chroma_metadatas = []

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
            db.refresh(db_chunk)

            if self.collection and embedding:
                chroma_ids.append(f"chunk_{db_chunk.id}")
                chroma_embeddings.append(embedding)
                chroma_documents.append(chunk_text)
                chroma_metadatas.append({
                    "filename": filename,
                    "document_id": str(doc.id),
                    "chunk_id": db_chunk.id
                })

        # Add vectors to ChromaDB Persistent Collection
        if self.collection and chroma_ids:
            try:
                self.collection.add(
                    ids=chroma_ids,
                    embeddings=chroma_embeddings,
                    documents=chroma_documents,
                    metadatas=chroma_metadatas
                )
                print(f"Indexed {len(chroma_ids)} vector embeddings for '{filename}' in ChromaDB.")
            except Exception as e:
                print(f"Error adding vectors to ChromaDB: {e}")

        return doc

    def retrieve_hybrid(self, db: Session, query: str, limit: int = 3) -> Dict[str, Any]:
        """
        Performs Hybrid Retrieval using ChromaDB Vector Search + BM25 Keyword Search + RRF + Reranker.
        """
        all_chunks = db.query(models.DocumentChunk).all()
        if not all_chunks:
            return {
                "query_info": self.rewrite_query(query),
                "chunks": [],
                "raw_candidates": []
            }

        query_info = self.rewrite_query(query)
        chunk_map = {c.id: c for c in all_chunks}
        semantic_scored: List[Tuple[float, models.DocumentChunk]] = []

        # 1. Vector Search using ChromaDB HNSW Index
        query_embedding = self.get_embedding(query)
        if self.collection and query_embedding:
            try:
                chroma_results = self.collection.query(
                    query_embeddings=[query_embedding],
                    n_results=min(20, len(all_chunks)),
                    include=['embeddings', 'documents', 'metadatas', 'distances']
                )

                if chroma_results and chroma_results.get('metadatas') and chroma_results['metadatas'][0]:
                    metadatas = chroma_results['metadatas'][0]
                    distances = chroma_results['distances'][0] if chroma_results.get('distances') else [0.0] * len(metadatas)

                    for meta, dist in zip(metadatas, distances):
                        cid = meta.get('chunk_id')
                        if cid in chunk_map:
                            # Cosine distance in ChromaDB is in range [0, 2], similarity = 1 - (dist / 2) or max(0, 1 - dist)
                            similarity = max(0.0, 1.0 - dist)
                            semantic_scored.append((similarity, chunk_map[cid]))
            except Exception as e:
                print(f"ChromaDB query error, falling back to SQLite vector search: {e}")

        # Fallback Vector Search if ChromaDB not active
        if not semantic_scored and query_embedding:
            for chunk in all_chunks:
                try:
                    chunk_emb = json.loads(chunk.embedding_json)
                    if chunk_emb:
                        sim = self.compute_cosine_similarity(query_embedding, chunk_emb)
                        semantic_scored.append((sim, chunk))
                except Exception:
                    continue
            semantic_scored.sort(key=lambda x: x[0], reverse=True)

        # 2. BM25 Keyword Search
        bm25_scored = self.bm25_search(query_info, all_chunks)

        # 3. Reciprocal Rank Fusion (RRF)
        rrf_candidates = self.reciprocal_rank_fusion(semantic_scored[:20], bm25_scored[:20])

        # 4. Reranking Pass
        reranked_candidates = self.rerank_chunks(query_info, rrf_candidates)

        # 5. Format output (with minimum relevance threshold check)
        final_results = []
        for item in reranked_candidates[:limit]:
            if item["semantic_score"] >= 0.18 or item["bm25_score"] > 0.1:
                chunk: models.DocumentChunk = item["chunk"]
                final_results.append({
                    "id": chunk.id,
                    "document_id": chunk.document_id,
                    "filename": chunk.document.filename,
                    "content": chunk.content,
                    "score": item["rerank_score"],
                    "semantic_score": item["semantic_score"],
                    "bm25_score": item["bm25_score"],
                    "rrf_score": item["rrf_score"]
                })

        return {
            "query_info": query_info,
            "chunks": final_results,
            "raw_candidates": reranked_candidates[:10]
        }

    def retrieve(self, db: Session, query: str, limit: int = 3) -> List[Dict[str, Any]]:
        """
        Backward-compatible retrieve method.
        """
        res = self.retrieve_hybrid(db, query, limit=limit)
        return res["chunks"]

    def classify_failure(
        self, 
        query: str, 
        retrieved_chunks: List[Dict[str, Any]], 
        llm_response: str
    ) -> Dict[str, Any]:
        """
        Classifies failure modes based on Week 4 Taxonomy.
        """
        if not retrieved_chunks:
            return {
                "classification": "RETRIEVAL_FAILURE",
                "subtype": "Embedding / Key Missing Failure",
                "reason": "No relevant document chunks were found in the knowledge base.",
                "remedy": "Add missing reference document or use BM25 keyword search."
            }

        max_semantic_score = max((c.get("semantic_score", 0.0) for c in retrieved_chunks), default=0.0)
        max_rerank_score = max((c.get("score", 0.0) for c in retrieved_chunks), default=0.0)

        if max_semantic_score < 0.15 and max_rerank_score < 5.0:
            return {
                "classification": "RETRIEVAL_FAILURE",
                "subtype": "Low Relevance / Top-K Miss",
                "reason": "Retrieved chunks have low similarity scores to the user's question.",
                "remedy": "Increase Top-K limit or refine chunking size."
            }

        if "⚠️ **Ollama is not responding.**" in llm_response or "Error during streaming" in llm_response:
            return {
                "classification": "GENERATION_FAILURE",
                "subtype": "LLM Service Disruption",
                "reason": "Local LLM container is unavailable or crashed during response generation.",
                "remedy": "Ensure Ollama container is running and model is pulled."
            }

        if "i don't know" in llm_response.lower() or "no information" in llm_response.lower():
            if max_semantic_score > 0.4:
                return {
                    "classification": "GENERATION_FAILURE",
                    "subtype": "Context Ignoring",
                    "reason": "Retrieved chunks contained relevant context, but LLM failed to extract the answer.",
                    "remedy": "Improve system prompt instructions to force context extraction."
                }

        return {
            "classification": "SUCCESS",
            "subtype": "Verified Hybrid RAG Generation",
            "reason": "Relevant document chunks were fetched and used by LLM.",
            "remedy": "None required."
        }

    def evaluate_retrieval_metrics(self, db: Session, test_cases: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Calculates Hit-Rate@K and Mean Reciprocal Rank (MRR) for test benchmarks.
        """
        total_queries = len(test_cases)
        if total_queries == 0:
            return {"hit_rate_at_3": 0.0, "mrr": 0.0, "total_queries": 0}

        hits_at_3 = 0
        reciprocal_ranks = []

        for case in test_cases:
            query = case.get("query", "")
            target_filename = case.get("expected_filename", "").lower()
            target_keyword = case.get("expected_keyword", "").lower()

            hybrid_res = self.retrieve_hybrid(db, query, limit=5)
            chunks = hybrid_res["chunks"]

            hit_rank = 0
            for idx, c in enumerate(chunks, start=1):
                fn = c["filename"].lower()
                ct = c["content"].lower()

                if (target_filename and target_filename in fn) or (target_keyword and target_keyword in ct):
                    hit_rank = idx
                    break

            if hit_rank > 0 and hit_rank <= 3:
                hits_at_3 += 1

            if hit_rank > 0:
                reciprocal_ranks.append(1.0 / hit_rank)
            else:
                reciprocal_ranks.append(0.0)

        hit_rate_3 = hits_at_3 / total_queries
        mrr = sum(reciprocal_ranks) / total_queries if reciprocal_ranks else 0.0

        return {
            "hit_rate_at_3": round(hit_rate_3 * 100, 1),
            "mrr": round(mrr, 3),
            "total_queries": total_queries
        }
