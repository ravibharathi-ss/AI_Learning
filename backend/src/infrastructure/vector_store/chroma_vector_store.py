"""
ChromaDB Vector Store Implementation of IVectorStore
"""

import os
from typing import List, Dict, Any, Optional
from domain.interfaces.vector_store import IVectorStore, VectorRecord, SearchResult

try:
    import chromadb
    CHROMA_AVAILABLE = True
except ImportError:
    CHROMA_AVAILABLE = False

class ChromaVectorStore(IVectorStore):
    def __init__(self, persist_directory: str = "./chroma_db", collection_name: str = "rag_knowledge_base"):
        self.persist_directory = persist_directory
        self.collection_name = collection_name
        self.client = None
        self.collection = None
        self._fallback_records: Dict[str, VectorRecord] = {}

        if CHROMA_AVAILABLE:
            try:
                os.makedirs(persist_directory, exist_ok=True)
                self.client = chromadb.PersistentClient(path=persist_directory)
                self.collection = self.client.get_or_create_collection(
                    name=collection_name,
                    metadata={"hnsw:space": "cosine"}
                )
            except Exception as e:
                print(f"Warning: ChromaDB initialization failed ({e}), using memory fallback.")
                self.collection = None

    def upsert(self, records: List[VectorRecord]) -> bool:
        if not records:
            return True

        if self.collection:
            try:
                ids = [r.id for r in records]
                embeddings = [r.vector for r in records]
                documents = [r.document_text for r in records]
                metadatas = [r.metadata for r in records]
                self.collection.upsert(
                    ids=ids,
                    embeddings=embeddings,
                    documents=documents,
                    metadatas=metadatas
                )
                return True
            except Exception as e:
                print(f"ChromaDB upsert error: {e}")
                if "expecting embedding with dimension" in str(e) and self.client:
                    try:
                        self.client.delete_collection(self.collection_name)
                        self.collection = self.client.create_collection(
                            name=self.collection_name,
                            metadata={"hnsw:space": "cosine"}
                        )
                        self.collection.upsert(
                            ids=ids,
                            embeddings=embeddings,
                            documents=documents,
                            metadatas=metadatas
                        )
                        return True
                    except Exception as retry_e:
                        print(f"ChromaDB recreate error: {retry_e}")

        # Fallback in-memory
        for r in records:
            self._fallback_records[r.id] = r
        return True

    def search(
        self,
        query_vector: List[float],
        top_k: int = 5,
        filters: Optional[Dict[str, Any]] = None,
        min_score: float = 0.0
    ) -> List[SearchResult]:
        if not query_vector:
            return []

        results: List[SearchResult] = []

        if self.collection:
            try:
                query_kwargs: Dict[str, Any] = {
                    "query_embeddings": [query_vector],
                    "n_results": top_k,
                    "include": ["embeddings", "documents", "metadatas", "distances"]
                }
                if filters:
                    query_kwargs["where"] = filters

                chroma_res = self.collection.query(**query_kwargs)
                if chroma_res and chroma_res.get("ids") and chroma_res["ids"][0]:
                    ids = chroma_res["ids"][0]
                    docs = chroma_res["documents"][0] if chroma_res.get("documents") else [""] * len(ids)
                    metas = chroma_res["metadatas"][0] if chroma_res.get("metadatas") else [{}] * len(ids)
                    dists = chroma_res["distances"][0] if chroma_res.get("distances") else [0.0] * len(ids)

                    for cid, doc, meta, dist in zip(ids, docs, metas, dists):
                        similarity = max(0.0, 1.0 - dist)
                        if similarity >= min_score:
                            results.append(SearchResult(
                                chunk_id=cid,
                                document_id=str(meta.get("document_id", "")),
                                content=doc,
                                score=round(similarity, 4),
                                metadata=meta
                            ))
                    return results
            except Exception as e:
                print(f"ChromaDB search error: {e}")

        # Fallback cosine search over in-memory records
        import math
        for r in self._fallback_records.values():
            if filters and any(r.metadata.get(k) != v for k, v in filters.items()):
                continue
            dot = sum(a * b for a, b in zip(query_vector, r.vector))
            m1 = math.sqrt(sum(a * a for a in query_vector))
            m2 = math.sqrt(sum(b * b for b in r.vector))
            sim = dot / (m1 * m2) if (m1 > 0 and m2 > 0) else 0.0
            if sim >= min_score:
                results.append(SearchResult(
                    chunk_id=r.id,
                    document_id=str(r.metadata.get("document_id", "")),
                    content=r.document_text,
                    score=round(sim, 4),
                    metadata=r.metadata
                ))

        results.sort(key=lambda x: x.score, reverse=True)
        return results[:top_k]

    def delete(self, document_id: str) -> bool:
        deleted = False
        if self.collection:
            try:
                self.collection.delete(where={"document_id": document_id})
                deleted = True
            except Exception as e:
                print(f"ChromaDB delete error: {e}")

        to_remove = [k for k, v in self._fallback_records.items() if str(v.metadata.get("document_id")) == document_id]
        for k in to_remove:
            del self._fallback_records[k]
            deleted = True
        return deleted

    def count(self) -> int:
        if self.collection:
            try:
                return self.collection.count()
            except Exception:
                pass
        return len(self._fallback_records)
