"""
Web interface module for Raspberry Pi version
FastAPI-based web server with HTML dashboard
"""

from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect, Depends, HTTPException, status
from fastapi.responses import HTMLResponse, JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional, List
import json
from datetime import datetime, timedelta
import logging

from .auth import AuthManager
from .websocket_manager import WebSocketManager as WSManager

logger = logging.getLogger(__name__)

security = HTTPBearer()


class WebInterface:
    """Web interface manager"""

    def __init__(self, app: FastAPI, config: dict, dependencies: dict):
        self.app = app
        self.config = config
        self.database = dependencies.get('database')
        self.schema_validator = dependencies.get('schema_validator')
        self.buffer = dependencies.get('buffer')
        self.stats = dependencies.get('stats')

        # Auth manager
        self.auth = AuthManager(config.get('security', {}))

        # WebSocket manager
        self.ws_manager = WSManager()

        # Setup templates
        self.templates = Jinja2Templates(directory="src/mqtt_telemetry/web/templates")

        # Register routes
        self._register_routes()

    def _register_routes(self):
        """Register all web routes"""

        # Dashboard
        @self.app.get("/", response_class=HTMLResponse)
        async def dashboard(request: Request):
            return self.templates.TemplateResponse("dashboard.html", {
                "request": request,
                "title": "MQTT Telemetry Dashboard"
            })

        # API: Query data
        @self.app.get("/api/data")
        async def query_data(
            topic: Optional[str] = None,
            start: Optional[str] = None,
            end: Optional[str] = None,
            limit: int = 1000,
            credentials: HTTPAuthorizationCredentials = Depends(security)
        ):
            # Verify token if auth enabled
            if self.config.get('security', {}).get('authentication', {}).get('enabled'):
                user = await self.auth.verify_token(credentials.credentials)
                if not user:
                    raise HTTPException(status_code=401, detail="Invalid token")

            # Parse dates
            start_time = datetime.fromisoformat(start) if start else None
            end_time = datetime.fromisoformat(end) if end else None

            # Query database
            data = await self.database.query({
                'topic': topic,
                'startTime': start_time,
                'endTime': end_time,
                'limit': limit
            })

            return {
                "data": data,
                "count": len(data),
                "query": {
                    "topic": topic,
                    "start": start,
                    "end": end,
                    "limit": limit
                }
            }

        # API: List schemas
        @self.app.get("/api/schemas")
        async def list_schemas():
            schemas = self.schema_validator.list_schemas()
            return {"schemas": schemas}

        # API: Get schema
        @self.app.get("/api/schemas/{name}")
        async def get_schema(name: str):
            schema = self.schema_validator.get_schema(name)
            if not schema:
                raise HTTPException(status_code=404, detail="Schema not found")
            return schema

        # API: System stats
        @self.app.get("/api/stats")
        async def get_stats():
            return {
                "stats": self.stats.get_all() if self.stats else {},
                "buffer": {
                    "size": len(self.buffer) if self.buffer else 0,
                    "usage": self.buffer.usage_percent() if self.buffer else 0
                }
            }

        # API: Health check
        @self.app.get("/api/health")
        async def health_check():
            return {
                "status": "ok",
                "timestamp": datetime.now().isoformat(),
                "uptime": self.stats.uptime() if self.stats else 0
            }

        # API: Export data
        @self.app.get("/api/export")
        async def export_data(
            format: str = "json",
            topic: Optional[str] = None,
            start: Optional[str] = None,
            end: Optional[str] = None,
            limit: int = 10000
        ):
            # Parse dates
            start_time = datetime.fromisoformat(start) if start else None
            end_time = datetime.fromisoformat(end) if end else None

            # Query data
            data = await self.database.query({
                'topic': topic,
                'startTime': start_time,
                'endTime': end_time,
                'limit': limit
            })

            if format == "csv":
                return await self._export_csv(data)
            elif format == "json":
                return {"data": data}
            else:
                raise HTTPException(status_code=400, detail="Invalid format")

        # WebSocket endpoint
        @self.app.websocket("/ws")
        async def websocket_endpoint(websocket: WebSocket):
            await self.ws_manager.connect(websocket)
            try:
                while True:
                    data = await websocket.receive_text()
                    message = json.loads(data)

                    if message.get('type') == 'subscribe':
                        topics = message.get('topics', [])
                        for topic in topics:
                            await self.ws_manager.subscribe(websocket, topic)

                    elif message.get('type') == 'unsubscribe':
                        topics = message.get('topics', [])
                        for topic in topics:
                            await self.ws_manager.unsubscribe(websocket, topic)

            except WebSocketDisconnect:
                self.ws_manager.disconnect(websocket)

        # Authentication endpoints
        @self.app.post("/api/auth/login")
        async def login(credentials: dict):
            token = await self.auth.login(
                credentials.get('username'),
                credentials.get('password')
            )
            if not token:
                raise HTTPException(status_code=401, detail="Invalid credentials")
            return {"token": token}

        @self.app.post("/api/auth/refresh")
        async def refresh_token(
            credentials: HTTPAuthorizationCredentials = Depends(security)
        ):
            token = await self.auth.refresh_token(credentials.credentials)
            if not token:
                raise HTTPException(status_code=401, detail="Invalid token")
            return {"token": token}

    async def _export_csv(self, data: list) -> FileResponse:
        """Export data as CSV"""
        import csv
        import io

        output = io.StringIO()
        if not data:
            return JSONResponse({"data": []})

        writer = csv.DictWriter(output, fieldnames=data[0].keys())
        writer.writeheader()
        writer.writerows(data)

        # Return as file
        return FileResponse(
            output.getvalue(),
            media_type="text/csv",
            filename=f"telemetry_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        )

    async def broadcast_message(self, topic: str, payload: dict):
        """Broadcast message to WebSocket clients"""
        await self.ws_manager.broadcast({
            "type": "telemetry",
            "topic": topic,
            "payload": payload,
            "timestamp": datetime.now().isoformat()
        })
