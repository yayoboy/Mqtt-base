"""
Configuration management
"""

import yaml
from pathlib import Path
from typing import Dict, Any, Optional
import os


class Config:
    """Configuration container"""

    def __init__(self, data: Dict[str, Any]):
        self._data = data

    @classmethod
    def from_file(cls, path: str) -> "Config":
        """Load configuration from YAML file"""
        with open(path, 'r') as f:
            data = yaml.safe_load(f)
        return cls(data)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Config":
        """Create configuration from dictionary"""
        return cls(data)

    @classmethod
    def default(cls) -> "Config":
        """Create default configuration"""
        return cls({
            "mqtt": {
                "broker": "localhost",
                "port": 1883,
                "keepalive": 60,
                "topics": []
            },
            "storage": {
                "backend": "sqlite",
                "sqlite": {
                    "path": "/tmp/telemetry.db"
                }
            },
            "schema": {
                "validation_enabled": True,
                "strict_mode": False
            },
            "buffer": {
                "size": 10000,
                "flush_interval_sec": 5,
                "batch_size": 100
            },
            "web": {
                "enabled": False,
                "host": "0.0.0.0",
                "port": 8080
            },
            "logging": {
                "level": "INFO",
                "console": True
            },
            "monitoring": {
                "health_check": {
                    "interval_sec": 30
                }
            }
        })

    @property
    def mqtt(self) -> Dict[str, Any]:
        return self._data.get("mqtt", {})

    @property
    def storage(self) -> Dict[str, Any]:
        return self._data.get("storage", {})

    @property
    def schema(self) -> Dict[str, Any]:
        return self._data.get("schema", {})

    @property
    def buffer(self) -> Dict[str, Any]:
        return self._data.get("buffer", {})

    @property
    def web(self) -> Dict[str, Any]:
        return self._data.get("web", {})

    @property
    def logging(self) -> Dict[str, Any]:
        return self._data.get("logging", {})

    @property
    def monitoring(self) -> Dict[str, Any]:
        return self._data.get("monitoring", {})

    @property
    def security(self) -> Dict[str, Any]:
        return self._data.get("security", {})

    def get(self, key: str, default: Any = None) -> Any:
        """Get configuration value by key"""
        keys = key.split(".")
        value = self._data

        for k in keys:
            if isinstance(value, dict):
                value = value.get(k)
                if value is None:
                    return default
            else:
                return default

        return value

    def set(self, key: str, value: Any):
        """Set configuration value"""
        keys = key.split(".")
        data = self._data

        for k in keys[:-1]:
            if k not in data:
                data[k] = {}
            data = data[k]

        data[keys[-1]] = value

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return self._data.copy()

    def save(self, path: str):
        """Save configuration to file"""
        with open(path, 'w') as f:
            yaml.safe_dump(self._data, f, default_flow_style=False)
