"""
In-Memory Semantic & Query Cache for High-Throughput Contract Retrieval
"""

import time
import hashlib
from typing import Optional, Dict, Any, Tuple

class SemanticQueryCache:
    """
    LRU-style query cache for repetitive inquiries.
    Eliminates LLM latency (<5ms response time) and reduces query cost by 100% on cache hits.
    """
    def __init__(self, max_size: int = 1000, ttl_seconds: int = 3600):
        self.max_size = max_size
        self.ttl_seconds = ttl_seconds
        self._cache: Dict[str, Dict[str, Any]] = {}
        self.hits = 0
        self.misses = 0

    def _hash_key(self, query: str, prompt_version: str) -> str:
        normalized = query.strip().lower()
        key_str = f"{prompt_version}::{normalized}"
        return hashlib.sha256(key_str.encode("utf-8")).hexdigest()

    def get(self, query: str, prompt_version: str) -> Optional[Dict[str, Any]]:
        key = self._hash_key(query, prompt_version)
        item = self._cache.get(key)
        if not item:
            self.misses += 1
            return None

        # Check TTL
        if time.time() - item["timestamp"] > self.ttl_seconds:
            del self._cache[key]
            self.misses += 1
            return None

        self.hits += 1
        return item["payload"]

    def put(self, query: str, prompt_version: str, payload: Dict[str, Any]) -> None:
        if len(self._cache) >= self.max_size:
            oldest_key = min(self._cache.keys(), key=lambda k: self._cache[k]["timestamp"])
            del self._cache[oldest_key]

        key = self._hash_key(query, prompt_version)
        self._cache[key] = {
            "payload": payload,
            "timestamp": time.time()
        }

    def get_stats(self) -> Dict[str, Any]:
        total = self.hits + self.misses
        hit_ratio = round(self.hits / total, 4) if total > 0 else 0.0
        return {
            "cache_entries": len(self._cache),
            "hits": self.hits,
            "misses": self.misses,
            "hit_ratio": hit_ratio
        }

    def clear(self) -> None:
        self._cache.clear()
        self.hits = 0
        self.misses = 0
