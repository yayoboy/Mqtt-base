"""
Storage backends
"""

from .base import StorageBackend, StorageInfo
from .sqlite import SQLiteStorage
from .postgresql import PostgreSQLStorage
from .filesystem import FilesystemStorage
from .influxdb import InfluxDBStorage

__all__ = [
    "StorageBackend",
    "StorageInfo",
    "SQLiteStorage",
    "PostgreSQLStorage",
    "FilesystemStorage",
    "InfluxDBStorage",
    "get_storage_backend",
]


def get_storage_backend(backend_type: str, config: dict) -> StorageBackend:
    """
    Factory function to create storage backend

    Args:
        backend_type: Type of backend (sqlite, postgresql, filesystem, influxdb)
        config: Configuration dictionary

    Returns:
        StorageBackend instance
    """
    backends = {
        "sqlite": SQLiteStorage,
        "postgresql": PostgreSQLStorage,
        "filesystem": FilesystemStorage,
        "influxdb": InfluxDBStorage,
    }

    backend_class = backends.get(backend_type.lower())
    if not backend_class:
        raise ValueError(f"Unknown storage backend: {backend_type}")

    return backend_class(config)
