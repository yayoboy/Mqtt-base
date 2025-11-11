"""
Message buffer for async processing
"""

import asyncio
from typing import List, Dict, Any, Optional
from collections import deque
import logging

logger = logging.getLogger(__name__)


class MessageBuffer:
    """
    Circular buffer for MQTT messages

    Provides thread-safe buffering with automatic flushing.
    """

    def __init__(
        self,
        size: int = 10000,
        flush_interval: float = 5.0,
        batch_size: int = 100
    ):
        self.size = size
        self.flush_interval = flush_interval
        self.batch_size = batch_size

        self._buffer: deque = deque(maxlen=size)
        self._lock = asyncio.Lock()
        self._not_empty = asyncio.Event()

        self._dropped_count = 0

        logger.info(
            f"Buffer initialized: size={size}, "
            f"flush_interval={flush_interval}s, batch_size={batch_size}"
        )

    async def push(self, message: Dict[str, Any]) -> bool:
        """
        Add message to buffer

        Args:
            message: Message dictionary

        Returns:
            True if added, False if buffer is full and message was dropped
        """
        async with self._lock:
            if len(self._buffer) >= self.size:
                # Buffer full - drop oldest or reject
                self._dropped_count += 1
                logger.warning(
                    f"Buffer full! Dropped {self._dropped_count} messages total"
                )
                return False

            self._buffer.append(message)
            self._not_empty.set()
            return True

    async def get_batch(self, timeout: Optional[float] = None) -> List[Dict[str, Any]]:
        """
        Get batch of messages from buffer

        Args:
            timeout: Max time to wait for messages

        Returns:
            List of messages (up to batch_size)
        """
        try:
            # Wait for messages with timeout
            await asyncio.wait_for(self._not_empty.wait(), timeout=timeout)
        except asyncio.TimeoutError:
            pass

        async with self._lock:
            if not self._buffer:
                self._not_empty.clear()
                return []

            # Get up to batch_size messages
            batch = []
            for _ in range(min(self.batch_size, len(self._buffer))):
                if self._buffer:
                    batch.append(self._buffer.popleft())

            # Clear event if buffer is now empty
            if not self._buffer:
                self._not_empty.clear()

            return batch

    async def flush(self) -> List[Dict[str, Any]]:
        """
        Flush all messages from buffer

        Returns:
            All buffered messages
        """
        async with self._lock:
            messages = list(self._buffer)
            self._buffer.clear()
            self._not_empty.clear()
            return messages

    def usage_percent(self) -> float:
        """Get buffer usage percentage"""
        return (len(self._buffer) / self.size) * 100

    def __len__(self) -> int:
        """Get current buffer size"""
        return len(self._buffer)

    @property
    def is_empty(self) -> bool:
        """Check if buffer is empty"""
        return len(self._buffer) == 0

    @property
    def is_full(self) -> bool:
        """Check if buffer is full"""
        return len(self._buffer) >= self.size

    @property
    def dropped_count(self) -> int:
        """Get count of dropped messages"""
        return self._dropped_count
