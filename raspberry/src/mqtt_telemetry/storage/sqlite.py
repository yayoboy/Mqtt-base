"""
SQLite storage backend
"""

import aiosqlite
import json
from typing import List, Dict, Any, Optional
from datetime import datetime
from pathlib import Path
import logging

from .base import StorageBackend, StorageInfo

logger = logging.getLogger(__name__)


class SQLiteStorage(StorageBackend):
    """SQLite storage backend"""

    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)
        self.db_path = config.get("sqlite", {}).get("path", "/tmp/telemetry.db")
        self.db: Optional[aiosqlite.Connection] = None

    async def initialize(self):
        """Initialize SQLite database"""
        # Ensure directory exists
        Path(self.db_path).parent.mkdir(parents=True, exist_ok=True)

        # Open database
        self.db = await aiosqlite.connect(self.db_path)

        # Set journal mode
        journal_mode = self.config.get("sqlite", {}).get("journal_mode", "WAL")
        await self.db.execute(f"PRAGMA journal_mode={journal_mode}")

        # Set synchronous mode
        sync_mode = self.config.get("sqlite", {}).get("synchronous", "NORMAL")
        await self.db.execute(f"PRAGMA synchronous={sync_mode}")

        # Create tables
        await self._create_tables()

        logger.info(f"SQLite storage initialized: {self.db_path}")

    async def _create_tables(self):
        """Create database tables"""
        await self.db.execute("""
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                topic TEXT NOT NULL,
                payload TEXT NOT NULL,
                timestamp DATETIME NOT NULL,
                received_at DATETIME NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Create indexes
        await self.db.execute("""
            CREATE INDEX IF NOT EXISTS idx_topic ON messages(topic)
        """)

        await self.db.execute("""
            CREATE INDEX IF NOT EXISTS idx_timestamp ON messages(timestamp)
        """)

        await self.db.commit()

    async def store_message(self, message: Dict[str, Any]) -> bool:
        """Store single message"""
        try:
            payload_json = json.dumps(message["payload"])

            await self.db.execute(
                """
                INSERT INTO messages (topic, payload, timestamp, received_at)
                VALUES (?, ?, ?, ?)
                """,
                (
                    message["topic"],
                    payload_json,
                    message["timestamp"],
                    message["received_at"]
                )
            )

            await self.db.commit()
            return True

        except Exception as e:
            logger.error(f"Failed to store message: {e}")
            return False

    async def store_batch(self, messages: List[Dict[str, Any]]) -> bool:
        """Store multiple messages"""
        try:
            data = [
                (
                    msg["topic"],
                    json.dumps(msg["payload"]),
                    msg["timestamp"],
                    msg["received_at"]
                )
                for msg in messages
            ]

            await self.db.executemany(
                """
                INSERT INTO messages (topic, payload, timestamp, received_at)
                VALUES (?, ?, ?, ?)
                """,
                data
            )

            await self.db.commit()
            logger.debug(f"Stored batch of {len(messages)} messages")
            return True

        except Exception as e:
            logger.error(f"Failed to store batch: {e}")
            return False

    async def query(
        self,
        topic: Optional[str] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        limit: int = 1000
    ) -> List[Dict[str, Any]]:
        """Query messages"""
        query = "SELECT topic, payload, timestamp, received_at FROM messages WHERE 1=1"
        params = []

        if topic:
            query += " AND topic = ?"
            params.append(topic)

        if start_time:
            query += " AND timestamp >= ?"
            params.append(start_time)

        if end_time:
            query += " AND timestamp <= ?"
            params.append(end_time)

        query += " ORDER BY timestamp DESC LIMIT ?"
        params.append(limit)

        async with self.db.execute(query, params) as cursor:
            rows = await cursor.fetchall()

            messages = []
            for row in rows:
                messages.append({
                    "topic": row[0],
                    "payload": json.loads(row[1]),
                    "timestamp": row[2],
                    "received_at": row[3]
                })

            return messages

    async def get_info(self) -> StorageInfo:
        """Get storage info"""
        # Count messages
        async with self.db.execute("SELECT COUNT(*) FROM messages") as cursor:
            row = await cursor.fetchone()
            total_messages = row[0] if row else 0

        # Get database size
        db_size = Path(self.db_path).stat().st_size if Path(self.db_path).exists() else 0

        # Get time range
        async with self.db.execute(
            "SELECT MIN(timestamp), MAX(timestamp) FROM messages"
        ) as cursor:
            row = await cursor.fetchone()
            oldest = row[0] if row and row[0] else None
            newest = row[1] if row and row[1] else None

        # Get free space
        import shutil
        stat = shutil.disk_usage(Path(self.db_path).parent)
        free_space = stat.free
        total_space = stat.total
        free_percent = (free_space / total_space * 100) if total_space > 0 else 0

        return StorageInfo(
            backend_type="sqlite",
            total_messages=total_messages,
            total_size_bytes=db_size,
            free_space_bytes=free_space,
            free_space_percent=free_percent,
            oldest_message=oldest,
            newest_message=newest
        )

    async def cleanup(self, before: datetime) -> int:
        """Delete messages before timestamp"""
        cursor = await self.db.execute(
            "DELETE FROM messages WHERE timestamp < ?",
            (before,)
        )

        deleted = cursor.rowcount
        await self.db.commit()

        logger.info(f"Cleaned up {deleted} messages before {before}")
        return deleted

    async def close(self):
        """Close database"""
        if self.db:
            await self.db.close()
            logger.info("SQLite storage closed")
