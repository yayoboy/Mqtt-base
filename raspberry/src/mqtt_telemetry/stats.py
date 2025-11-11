"""
Statistics tracking
"""

from typing import Dict, Any, Set
from datetime import datetime
import time
import threading


class Statistics:
    """Thread-safe statistics tracker"""

    def __init__(self):
        self._stats: Dict[str, Any] = {
            "messages_received": 0,
            "messages_stored": 0,
            "messages_dropped": 0,
            "validation_errors": 0,
            "storage_errors": 0,
            "processing_errors": 0,
            "mqtt_connects": 0,
            "mqtt_disconnects": 0,
            "buffer_usage": 0.0,
            "uptime": 0,
        }
        self._subscriptions: Set[str] = set()
        self._start_time = time.time()
        self._lock = threading.Lock()

    def increment(self, key: str, value: int = 1):
        """Increment a counter"""
        with self._lock:
            if key in self._stats:
                self._stats[key] += value
            else:
                self._stats[key] = value

    def set(self, key: str, value: Any):
        """Set a value"""
        with self._lock:
            self._stats[key] = value

    def add(self, key: str, value: Any):
        """Add to a value (alias for increment for numeric values)"""
        self.increment(key, value)

    def get(self, key: str, default: Any = None) -> Any:
        """Get a statistic value"""
        with self._lock:
            return self._stats.get(key, default)

    def get_all(self) -> Dict[str, Any]:
        """Get all statistics"""
        with self._lock:
            stats = self._stats.copy()
            stats["subscriptions"] = list(self._subscriptions)
            stats["start_time"] = datetime.fromtimestamp(self._start_time).isoformat()
            return stats

    def add_subscription(self, topic: str):
        """Add a topic subscription"""
        with self._lock:
            self._subscriptions.add(topic)

    def remove_subscription(self, topic: str):
        """Remove a topic subscription"""
        with self._lock:
            self._subscriptions.discard(topic)

    def uptime(self) -> float:
        """Get uptime in seconds"""
        return time.time() - self._start_time

    def reset(self):
        """Reset all statistics"""
        with self._lock:
            for key in self._stats:
                if isinstance(self._stats[key], (int, float)):
                    self._stats[key] = 0
            self._start_time = time.time()
