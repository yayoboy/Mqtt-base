"""
Data retention scheduler
Automatic cleanup of old data
"""

import asyncio
from datetime import datetime, timedelta
from typing import Optional
import logging

logger = logging.getLogger(__name__)


class RetentionScheduler:
    """Schedules and executes data retention policies"""

    def __init__(self, storage, config: dict):
        self.storage = storage
        self.config = config.get('retention', {})
        self.enabled = self.config.get('enabled', False)
        self.policies = self.config.get('policies', [])
        self.check_interval = 3600  # 1 hour
        self.running = False
        self.task: Optional[asyncio.Task] = None

    async def start(self):
        """Start retention scheduler"""
        if not self.enabled:
            logger.info("Retention policies disabled")
            return

        if not self.policies:
            logger.warning("No retention policies configured")
            return

        self.running = True
        self.task = asyncio.create_task(self._scheduler_loop())
        logger.info(f"Retention scheduler started with {len(self.policies)} policies")

    async def stop(self):
        """Stop retention scheduler"""
        if self.task:
            self.running = False
            self.task.cancel()
            try:
                await self.task
            except asyncio.CancelledError:
                pass
            logger.info("Retention scheduler stopped")

    async def _scheduler_loop(self):
        """Main scheduler loop"""
        while self.running:
            try:
                await self._run_retention_policies()
                await asyncio.sleep(self.check_interval)

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in retention scheduler: {e}")
                await asyncio.sleep(60)  # Wait a minute on error

    async def _run_retention_policies(self):
        """Execute all retention policies"""
        logger.info("Running retention policies")

        for policy in self.policies:
            try:
                await self._execute_policy(policy)
            except Exception as e:
                logger.error(f"Error executing policy '{policy.get('name')}': {e}")

    async def _execute_policy(self, policy: dict):
        """Execute a single retention policy"""
        name = policy.get('name', 'unnamed')
        duration = policy.get('duration', '90d')
        resolution = policy.get('resolution', 'raw')

        logger.debug(f"Executing retention policy: {name}")

        # Parse duration
        before = self._parse_duration(duration)

        if resolution == 'raw':
            # Delete raw data
            deleted = await self.storage.cleanup(before)
            logger.info(f"Policy '{name}': Deleted {deleted} messages before {before}")

        else:
            # For aggregated data, we might want different handling
            # This is a placeholder for aggregation-aware retention
            logger.debug(f"Policy '{name}': Aggregated data retention not yet implemented")

    def _parse_duration(self, duration: str) -> datetime:
        """
        Parse duration string to datetime

        Formats:
        - 90d (90 days)
        - 12w (12 weeks)
        - 6m (6 months)
        - 2y (2 years)
        """
        unit = duration[-1]
        value = int(duration[:-1])

        now = datetime.now()

        if unit == 'd':
            return now - timedelta(days=value)
        elif unit == 'w':
            return now - timedelta(weeks=value)
        elif unit == 'm':
            return now - timedelta(days=value * 30)  # Approximate
        elif unit == 'y':
            return now - timedelta(days=value * 365)  # Approximate
        else:
            raise ValueError(f"Invalid duration format: {duration}")

    async def run_now(self):
        """Run retention policies immediately (for testing/manual trigger)"""
        logger.info("Running retention policies (manual trigger)")
        await self._run_retention_policies()

    def get_status(self) -> dict:
        """Get retention scheduler status"""
        return {
            "enabled": self.enabled,
            "running": self.running,
            "policies": len(self.policies),
            "check_interval": self.check_interval,
            "policies_config": self.policies
        }
