"""
Simple TTL cache for price data and other frequently accessed values.
"""
import time
from typing import Any, Optional


class TTLCache:
    """In-memory cache with per-key TTL expiration."""

    def __init__(self):
        self._store: dict[str, tuple[Any, float]] = {}

    def get(self, key: str, ttl: int = 60) -> Optional[Any]:
        """Get a cached value. Returns None if expired or not found."""
        if key in self._store:
            value, ts = self._store[key]
            if time.time() - ts < ttl:
                return value
            del self._store[key]
        return None

    def set(self, key: str, value: Any) -> None:
        """Set a cached value with current timestamp."""
        self._store[key] = (value, time.time())

    def delete(self, key: str) -> None:
        """Remove a key from cache."""
        self._store.pop(key, None)

    def clear(self) -> None:
        """Clear entire cache."""
        self._store.clear()


# Global cache instance
cache = TTLCache()
