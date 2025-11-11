"""
Filesystem storage backend
"""

import json
import gzip
import aiofiles
from pathlib import Path
from typing import List, Dict, Any, Optional
from datetime import datetime
import logging

from .base import StorageBackend, StorageInfo

logger = logging.getLogger(__name__)


class FilesystemStorage(StorageBackend):
    """Filesystem storage backend"""

    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)
        fs_config = config.get("filesystem", {})
        self.base_path = Path(fs_config.get("base_path", "/tmp/telemetry"))
        self.file_format = fs_config.get("file_format", "jsonl")
        self.compression = fs_config.get("compression", "none")
        self.max_file_size = fs_config.get("max_file_size_mb", 100) * 1024 * 1024
        self.current_file: Optional[Path] = None
        self.current_file_size = 0

    async def initialize(self):
        """Initialize filesystem storage"""
        # Create base directory
        self.base_path.mkdir(parents=True, exist_ok=True)

        # Create initial file
        await self._create_new_file()

        logger.info(f"Filesystem storage initialized: {self.base_path}")

    async def _create_new_file(self):
        """Create a new storage file"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        extension = self._get_extension()
        filename = f"telemetry_{timestamp}.{extension}"

        self.current_file = self.base_path / filename
        self.current_file_size = 0

        logger.info(f"Created new file: {self.current_file}")

    def _get_extension(self) -> str:
        """Get file extension based on format and compression"""
        ext = self.file_format

        if self.compression == "gzip":
            ext += ".gz"
        elif self.compression == "zstd":
            ext += ".zst"
        elif self.compression == "lz4":
            ext += ".lz4"

        return ext

    async def store_message(self, message: Dict[str, Any]) -> bool:
        """Store single message"""
        return await self.store_batch([message])

    async def store_batch(self, messages: List[Dict[str, Any]]) -> bool:
        """Store multiple messages"""
        try:
            # Check if file rotation is needed
            if self.current_file_size >= self.max_file_size:
                await self._create_new_file()

            # Format messages
            lines = []
            for msg in messages:
                line = self._format_message(msg)
                lines.append(line)

            data = "\n".join(lines) + "\n"

            # Write to file
            if self.compression == "gzip":
                await self._write_compressed_gzip(data)
            else:
                await self._write_uncompressed(data)

            self.current_file_size += len(data.encode())

            logger.debug(f"Stored {len(messages)} messages to {self.current_file}")
            return True

        except Exception as e:
            logger.error(f"Failed to store batch: {e}")
            return False

    def _format_message(self, message: Dict[str, Any]) -> str:
        """Format message based on file format"""
        if self.file_format == "jsonl":
            return json.dumps({
                "topic": message["topic"],
                "payload": message["payload"],
                "timestamp": message["timestamp"].isoformat(),
                "received_at": message["received_at"].isoformat()
            })
        elif self.file_format == "csv":
            # Simple CSV format
            return f"{message['topic']},{message['timestamp'].isoformat()},{json.dumps(message['payload'])}"
        else:
            # JSON array format
            return json.dumps(message)

    async def _write_uncompressed(self, data: str):
        """Write uncompressed data"""
        async with aiofiles.open(self.current_file, 'a') as f:
            await f.write(data)

    async def _write_compressed_gzip(self, data: str):
        """Write gzip compressed data"""
        compressed = gzip.compress(data.encode())

        async with aiofiles.open(self.current_file, 'ab') as f:
            await f.write(compressed)

    async def query(
        self,
        topic: Optional[str] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        limit: int = 1000
    ) -> List[Dict[str, Any]]:
        """Query messages from files"""
        messages = []

        # Read all .jsonl files
        for file_path in sorted(self.base_path.glob("*.jsonl*"), reverse=True):
            try:
                if file_path.suffix == ".gz":
                    async with aiofiles.open(file_path, 'rb') as f:
                        data = await f.read()
                        content = gzip.decompress(data).decode()
                else:
                    async with aiofiles.open(file_path, 'r') as f:
                        content = await f.read()

                for line in content.strip().split('\n'):
                    if not line:
                        continue

                    msg = json.loads(line)

                    # Apply filters
                    if topic and msg.get("topic") != topic:
                        continue

                    msg_time = datetime.fromisoformat(msg["timestamp"])

                    if start_time and msg_time < start_time:
                        continue

                    if end_time and msg_time > end_time:
                        continue

                    messages.append(msg)

                    if len(messages) >= limit:
                        return messages

            except Exception as e:
                logger.error(f"Error reading file {file_path}: {e}")

        return messages

    async def get_info(self) -> StorageInfo:
        """Get storage info"""
        total_messages = 0
        total_size = 0
        oldest = None
        newest = None

        # Scan all files
        for file_path in self.base_path.glob("*"):
            if file_path.is_file():
                total_size += file_path.stat().st_size

                # Count messages (approximate for compressed files)
                try:
                    if file_path.suffix == ".jsonl":
                        async with aiofiles.open(file_path, 'r') as f:
                            content = await f.read()
                            lines = content.count('\n')
                            total_messages += lines

                except Exception:
                    pass

        # Get free space
        import shutil
        stat = shutil.disk_usage(self.base_path)
        free_space = stat.free
        total_space = stat.total
        free_percent = (free_space / total_space * 100) if total_space > 0 else 0

        return StorageInfo(
            backend_type="filesystem",
            total_messages=total_messages,
            total_size_bytes=total_size,
            free_space_bytes=free_space,
            free_space_percent=free_percent,
            oldest_message=oldest,
            newest_message=newest
        )

    async def cleanup(self, before: datetime) -> int:
        """Delete old files"""
        deleted = 0

        for file_path in self.base_path.glob("*"):
            if file_path.is_file():
                # Get file timestamp from name
                try:
                    timestamp_str = file_path.stem.split('_', 1)[1]
                    file_time = datetime.strptime(timestamp_str, "%Y%m%d_%H%M%S")

                    if file_time < before:
                        file_path.unlink()
                        deleted += 1
                        logger.info(f"Deleted old file: {file_path}")

                except Exception:
                    pass

        return deleted

    async def close(self):
        """Close storage"""
        logger.info("Filesystem storage closed")
