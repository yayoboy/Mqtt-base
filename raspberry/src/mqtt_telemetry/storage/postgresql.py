"""
PostgreSQL storage backend
"""

import asyncpg
import json
from typing import List, Dict, Any, Optional
from datetime import datetime
import logging

from .base import StorageBackend, StorageInfo

logger = logging.getLogger(__name__)


class PostgreSQLStorage(StorageBackend):
    """PostgreSQL storage backend"""

    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)
        self.pool: Optional[asyncpg.Pool] = None

    async def initialize(self):
        """Initialize PostgreSQL connection pool"""
        pg_config = self.config.get("postgresql", {})

        self.pool = await asyncpg.create_pool(
            host=pg_config.get("host", "localhost"),
            port=pg_config.get("port", 5432),
            database=pg_config.get("database", "telemetry"),
            user=pg_config.get("username", "postgres"),
            password=pg_config.get("password", ""),
            min_size=1,
            max_size=pg_config.get("pool_size", 10)
        )

        # Create tables
        await self._create_tables()

        logger.info("PostgreSQL storage initialized")

    async def _create_tables(self):
        """Create database tables"""
        async with self.pool.acquire() as conn:
            # Create messages table
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS messages (
                    id BIGSERIAL PRIMARY KEY,
                    topic TEXT NOT NULL,
                    payload JSONB NOT NULL,
                    timestamp TIMESTAMPTZ NOT NULL,
                    received_at TIMESTAMPTZ NOT NULL,
                    created_at TIMESTAMPTZ DEFAULT NOW()
                )
            """)

            # Create indexes
            await conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_messages_topic
                ON messages(topic)
            """)

            await conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_messages_timestamp
                ON messages(timestamp)
            """)

            # Create index on JSONB payload for faster queries
            await conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_messages_payload
                ON messages USING GIN (payload)
            """)

    async def store_message(self, message: Dict[str, Any]) -> bool:
        """Store single message"""
        try:
            async with self.pool.acquire() as conn:
                await conn.execute(
                    """
                    INSERT INTO messages (topic, payload, timestamp, received_at)
                    VALUES ($1, $2, $3, $4)
                    """,
                    message["topic"],
                    json.dumps(message["payload"]),
                    message["timestamp"],
                    message["received_at"]
                )

            return True

        except Exception as e:
            logger.error(f"Failed to store message: {e}")
            return False

    async def store_batch(self, messages: List[Dict[str, Any]]) -> bool:
        """Store multiple messages"""
        try:
            async with self.pool.acquire() as conn:
                await conn.executemany(
                    """
                    INSERT INTO messages (topic, payload, timestamp, received_at)
                    VALUES ($1, $2, $3, $4)
                    """,
                    [
                        (
                            msg["topic"],
                            json.dumps(msg["payload"]),
                            msg["timestamp"],
                            msg["received_at"]
                        )
                        for msg in messages
                    ]
                )

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
        conditions = []
        params = []
        param_count = 1

        if topic:
            conditions.append(f"topic = ${param_count}")
            params.append(topic)
            param_count += 1

        if start_time:
            conditions.append(f"timestamp >= ${param_count}")
            params.append(start_time)
            param_count += 1

        if end_time:
            conditions.append(f"timestamp <= ${param_count}")
            params.append(end_time)
            param_count += 1

        where_clause = " AND ".join(conditions) if conditions else "TRUE"
        query = f"""
            SELECT topic, payload, timestamp, received_at
            FROM messages
            WHERE {where_clause}
            ORDER BY timestamp DESC
            LIMIT ${param_count}
        """
        params.append(limit)

        async with self.pool.acquire() as conn:
            rows = await conn.fetch(query, *params)

            messages = []
            for row in rows:
                messages.append({
                    "topic": row["topic"],
                    "payload": json.loads(row["payload"]),
                    "timestamp": row["timestamp"],
                    "received_at": row["received_at"]
                })

            return messages

    async def get_info(self) -> StorageInfo:
        """Get storage info"""
        async with self.pool.acquire() as conn:
            # Count messages
            total = await conn.fetchval("SELECT COUNT(*) FROM messages")

            # Get time range
            time_range = await conn.fetchrow(
                "SELECT MIN(timestamp) as oldest, MAX(timestamp) as newest FROM messages"
            )

            # Get table size
            size = await conn.fetchval("""
                SELECT pg_total_relation_size('messages')
            """)

        return StorageInfo(
            backend_type="postgresql",
            total_messages=total or 0,
            total_size_bytes=size or 0,
            oldest_message=time_range["oldest"] if time_range else None,
            newest_message=time_range["newest"] if time_range else None
        )

    async def cleanup(self, before: datetime) -> int:
        """Delete messages before timestamp"""
        async with self.pool.acquire() as conn:
            result = await conn.execute(
                "DELETE FROM messages WHERE timestamp < $1",
                before
            )

            # Extract number of deleted rows
            deleted = int(result.split()[-1]) if result else 0

            logger.info(f"Cleaned up {deleted} messages before {before}")
            return deleted

    async def close(self):
        """Close connection pool"""
        if self.pool:
            await self.pool.close()
            logger.info("PostgreSQL storage closed")
