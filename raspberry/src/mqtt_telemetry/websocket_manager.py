"""
WebSocket manager for real-time data streaming
"""

from fastapi import WebSocket
from typing import Dict, Set, List
import json
import asyncio
import logging

logger = logging.getLogger(__name__)


class WebSocketManager:
    """Manages WebSocket connections and subscriptions"""

    def __init__(self):
        # Active connections
        self.active_connections: List[WebSocket] = []

        # Topic subscriptions: {websocket: set(topics)}
        self.subscriptions: Dict[WebSocket, Set[str]] = {}

    async def connect(self, websocket: WebSocket):
        """Accept new WebSocket connection"""
        await websocket.accept()
        self.active_connections.append(websocket)
        self.subscriptions[websocket] = set()
        logger.info(f"WebSocket client connected. Total: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        """Remove WebSocket connection"""
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        if websocket in self.subscriptions:
            del self.subscriptions[websocket]
        logger.info(f"WebSocket client disconnected. Total: {len(self.active_connections)}")

    async def subscribe(self, websocket: WebSocket, topic: str):
        """Subscribe WebSocket to a topic"""
        if websocket in self.subscriptions:
            self.subscriptions[websocket].add(topic)
            logger.debug(f"Client subscribed to: {topic}")

    async def unsubscribe(self, websocket: WebSocket, topic: str):
        """Unsubscribe WebSocket from a topic"""
        if websocket in self.subscriptions:
            self.subscriptions[websocket].discard(topic)
            logger.debug(f"Client unsubscribed from: {topic}")

    async def broadcast(self, message: dict):
        """Broadcast message to all subscribed clients"""
        topic = message.get('topic', '')

        for connection in self.active_connections[:]:  # Copy to avoid modification during iteration
            try:
                # Check if client is subscribed to this topic
                subscribed_topics = self.subscriptions.get(connection, set())

                if not subscribed_topics or self._topic_matches(topic, subscribed_topics):
                    await connection.send_text(json.dumps(message))

            except Exception as e:
                logger.error(f"Error sending to client: {e}")
                self.disconnect(connection)

    def _topic_matches(self, topic: str, patterns: Set[str]) -> bool:
        """Check if topic matches any subscription pattern"""
        for pattern in patterns:
            if self._mqtt_topic_match(topic, pattern):
                return True
        return False

    def _mqtt_topic_match(self, topic: str, pattern: str) -> bool:
        """MQTT topic matching with wildcards"""
        import re

        # Convert MQTT wildcards to regex
        regex_pattern = pattern.replace('+', '[^/]+').replace('#', '.*')
        regex_pattern = f'^{regex_pattern}$'

        return bool(re.match(regex_pattern, topic))

    async def send_personal_message(self, message: dict, websocket: WebSocket):
        """Send message to specific client"""
        try:
            await websocket.send_text(json.dumps(message))
        except Exception as e:
            logger.error(f"Error sending personal message: {e}")
            self.disconnect(websocket)

    def get_connection_count(self) -> int:
        """Get number of active connections"""
        return len(self.active_connections)
