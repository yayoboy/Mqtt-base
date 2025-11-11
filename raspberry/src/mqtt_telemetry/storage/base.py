"""
Base storage backend interface
"""

from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
from dataclasses import dataclass
from datetime import datetime


@dataclass
class StorageInfo:
    """Storage backend information"""
    backend_type: str
    total_messages: int
    total_size_bytes: int
    free_space_bytes: Optional[int] = None
    free_space_percent: Optional[float] = None
    oldest_message: Optional[datetime] = None
    newest_message: Optional[datetime] = None


class StorageBackend(ABC):
    """Abstract base class for storage backends"""

    def __init__(self, config: Dict[str, Any]):
        self.config = config

    @abstractmethod
    async def initialize(self):
        """Initialize the storage backend"""
        pass

    @abstractmethod
    async def store_message(self, message: Dict[str, Any]) -> bool:
        """
        Store a single message

        Args:
            message: Message dictionary

        Returns:
            True if successful
        """
        pass

    @abstractmethod
    async def store_batch(self, messages: List[Dict[str, Any]]) -> bool:
        """
        Store multiple messages

        Args:
            messages: List of message dictionaries

        Returns:
            True if successful
        """
        pass

    @abstractmethod
    async def query(
        self,
        topic: Optional[str] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        limit: int = 1000
    ) -> List[Dict[str, Any]]:
        """
        Query stored messages

        Args:
            topic: Filter by topic
            start_time: Start of time range
            end_time: End of time range
            limit: Maximum number of results

        Returns:
            List of messages
        """
        pass

    @abstractmethod
    async def get_info(self) -> StorageInfo:
        """
        Get storage information

        Returns:
            StorageInfo object
        """
        pass

    @abstractmethod
    async def cleanup(self, before: datetime) -> int:
        """
        Clean up old messages

        Args:
            before: Delete messages before this time

        Returns:
            Number of messages deleted
        """
        pass

    @abstractmethod
    async def close(self):
        """Close the storage backend"""
        pass
