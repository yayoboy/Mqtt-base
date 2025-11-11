"""
InfluxDB storage backend
Optimized for time-series data
"""

from influxdb_client import InfluxDBClient, Point, WritePrecision
from influxdb_client.client.write_api import SYNCHRONOUS
from typing import List, Dict, Any, Optional
from datetime import datetime
import logging

from .base import StorageBackend, StorageInfo

logger = logging.getLogger(__name__)


class InfluxDBStorage(StorageBackend):
    """InfluxDB storage backend for time-series data"""

    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)
        influx_config = config.get('influxdb', {})

        self.url = influx_config.get('url', 'http://localhost:8086')
        self.token = influx_config.get('token')
        self.org = influx_config.get('org', 'telemetry')
        self.bucket = influx_config.get('bucket', 'telemetry')
        self.batch_size = influx_config.get('batch_size', 1000)

        self.client: Optional[InfluxDBClient] = None
        self.write_api = None
        self.query_api = None

    async def initialize(self):
        """Initialize InfluxDB connection"""
        try:
            self.client = InfluxDBClient(
                url=self.url,
                token=self.token,
                org=self.org
            )

            self.write_api = self.client.write_api(write_options=SYNCHRONOUS)
            self.query_api = self.client.query_api()

            # Verify connection
            health = self.client.health()
            if health.status != "pass":
                raise Exception(f"InfluxDB health check failed: {health.message}")

            logger.info(f"InfluxDB storage initialized: {self.url}")

        except Exception as e:
            logger.error(f"Failed to initialize InfluxDB: {e}")
            raise

    async def store_message(self, message: Dict[str, Any]) -> bool:
        """Store single message"""
        try:
            point = self._message_to_point(message)
            self.write_api.write(bucket=self.bucket, org=self.org, record=point)
            return True

        except Exception as e:
            logger.error(f"Failed to store message: {e}")
            return False

    async def store_batch(self, messages: List[Dict[str, Any]]) -> bool:
        """Store multiple messages"""
        try:
            points = [self._message_to_point(msg) for msg in messages]
            self.write_api.write(bucket=self.bucket, org=self.org, record=points)

            logger.debug(f"Stored batch of {len(messages)} messages")
            return True

        except Exception as e:
            logger.error(f"Failed to store batch: {e}")
            return False

    def _message_to_point(self, message: Dict[str, Any]) -> Point:
        """Convert message to InfluxDB Point"""
        topic = message.get('topic', 'unknown')
        payload = message.get('payload', {})
        timestamp = message.get('timestamp', datetime.now())

        # Create point with measurement name from topic
        measurement = topic.replace('/', '_')
        point = Point(measurement).time(timestamp, WritePrecision.NS)

        # Add topic as tag
        point.tag("topic", topic)

        # Extract device_id or similar as tag if present
        if 'device_id' in payload:
            point.tag("device_id", str(payload['device_id']))

        if 'vehicle_id' in payload:
            point.tag("vehicle_id", str(payload['vehicle_id']))

        # Add payload fields
        for key, value in payload.items():
            if key not in ['device_id', 'vehicle_id']:  # Skip tags
                if isinstance(value, (int, float)):
                    point.field(key, float(value))
                elif isinstance(value, bool):
                    point.field(key, value)
                elif isinstance(value, str):
                    point.field(key, value)

        return point

    async def query(
        self,
        topic: Optional[str] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        limit: int = 1000
    ) -> List[Dict[str, Any]]:
        """Query messages from InfluxDB"""
        try:
            # Build Flux query
            query = f'from(bucket: "{self.bucket}")'

            # Time range
            if start_time:
                query += f' |> range(start: {start_time.isoformat()}Z'
                if end_time:
                    query += f', stop: {end_time.isoformat()}Z'
                query += ')'
            else:
                query += ' |> range(start: -7d)'  # Default last 7 days

            # Filter by topic if specified
            if topic:
                measurement = topic.replace('/', '_')
                query += f' |> filter(fn: (r) => r._measurement == "{measurement}")'

            # Limit
            query += f' |> limit(n: {limit})'

            # Execute query
            tables = self.query_api.query(query, org=self.org)

            # Convert results
            messages = []
            for table in tables:
                for record in table.records:
                    messages.append({
                        'topic': record.values.get('topic'),
                        'timestamp': record.get_time(),
                        'field': record.get_field(),
                        'value': record.get_value()
                    })

            return messages

        except Exception as e:
            logger.error(f"Query error: {e}")
            return []

    async def get_info(self) -> StorageInfo:
        """Get storage information"""
        try:
            # Get bucket info
            buckets_api = self.client.buckets_api()
            bucket = buckets_api.find_bucket_by_name(self.bucket)

            # Count approximate messages
            query = f'''
                from(bucket: "{self.bucket}")
                  |> range(start: 0)
                  |> count()
            '''

            tables = self.query_api.query(query, org=self.org)
            total_messages = sum(
                record.get_value()
                for table in tables
                for record in table.records
            )

            return StorageInfo(
                backend_type="influxdb",
                total_messages=total_messages,
                total_size_bytes=0,  # InfluxDB doesn't easily expose this
                oldest_message=None,
                newest_message=None
            )

        except Exception as e:
            logger.error(f"Error getting storage info: {e}")
            return StorageInfo(
                backend_type="influxdb",
                total_messages=0,
                total_size_bytes=0
            )

    async def cleanup(self, before: datetime) -> int:
        """Delete messages before timestamp"""
        try:
            # Use InfluxDB delete API
            delete_api = self.client.delete_api()

            predicate = f'_time < {before.isoformat()}Z'

            delete_api.delete(
                start=datetime(1970, 1, 1),
                stop=before,
                predicate=predicate,
                bucket=self.bucket,
                org=self.org
            )

            logger.info(f"Deleted messages before {before}")
            return 0  # InfluxDB doesn't return count

        except Exception as e:
            logger.error(f"Cleanup error: {e}")
            return 0

    async def close(self):
        """Close InfluxDB connection"""
        if self.client:
            self.client.close()
            logger.info("InfluxDB storage closed")
