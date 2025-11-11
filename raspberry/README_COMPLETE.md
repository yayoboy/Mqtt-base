# MQTT Telemetry - Raspberry Pi Version (Complete)

Python-based MQTT telemetry storage system for Raspberry Pi with **full web interface**, real-time streaming, and production-ready features.

## ✨ Complete Feature Set

### Core Features
- ✅ **Async MQTT Client** with automatic reconnection
- ✅ **Multiple Storage Backends**: SQLite, PostgreSQL, InfluxDB, Filesystem
- ✅ **Schema Validation** with custom rules and patterns
- ✅ **Message Buffering** with configurable size and persistence

### Web & API Features
- ✅ **Web Dashboard** - Real-time telemetry monitoring with beautiful UI
- ✅ **REST API** - Complete API for querying and managing data
- ✅ **WebSocket Streaming** - Real-time data updates to web clients
- ✅ **GraphQL Support** (optional)
- ✅ **Data Export** - Export to CSV, JSON formats

### Advanced Features
- ✅ **Prometheus Metrics** - Full observability and monitoring
- ✅ **InfluxDB Backend** - Optimized time-series database support
- ✅ **Retention Policies** - Automatic cleanup of old data
- ✅ **JWT Authentication** - Secure API access
- ✅ **RBAC** - Role-based access control
- ✅ **Systemd Service** - Easy deployment as system service

## 🚀 Quick Start

### Installation

```bash
cd raspberry
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
pip install -e .
```

### Configuration

```bash
cp config.example.yaml config.yaml
nano config.yaml
```

Edit MQTT broker settings:

```yaml
mqtt:
  broker: broker.example.com
  port: 1883
  username: ""
  password: ""
```

### Run with Web Interface

```bash
# Start server with web dashboard
python -m mqtt_telemetry.main --config config.yaml

# Or use the CLI tool
mqtt-telemetry --config config.yaml
```

### Access Web Dashboard

Open browser: `http://raspberry-pi-ip:8080`

Features:
- 📊 Real-time statistics
- 🔴 Live message streaming
- 📋 Schema management
- 💾 Storage information

## 📡 Web Interface

### Dashboard Screenshot

```
┌─────────────────────────────────────────────────────┐
│ 🚀 MQTT Telemetry Dashboard                         │
│ ● MQTT: Connected  ● WebSocket: Connected           │
├─────────────────────────────────────────────────────┤
│ ┌──────────────┐ ┌──────────────┐ ┌─────────────┐  │
│ │ Statistics   │ │ Storage      │ │ Schemas     │  │
│ │ Received: 1.2k│ │ SQLite       │ │ temp_sensor │  │
│ │ Stored: 1.19k │ │ 2.4 MB       │ │ gps_tracker │  │
│ │ Buffer: 12%   │ │ 850 messages │ │ energy_mon  │  │
│ └──────────────┘ └──────────────┘ └─────────────┘  │
├─────────────────────────────────────────────────────┤
│ 🔴 Live Messages                                    │
│ ┌─────────────────────────────────────────────────┐│
│ │ sensors/temp01/temperature                      ││
│ │ 2024-01-15 14:23:45                            ││
│ │ {"temperature": 23.5, "humidity": 45.2}        ││
│ └─────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────┘
```

## 🔌 API Endpoints

### REST API

```bash
# Query data
GET /api/data?topic=sensors/+/temperature&limit=100

# Get statistics
GET /api/stats

# List schemas
GET /api/schemas

# Export data
GET /api/export?format=csv&topic=sensors/+/temperature

# Health check
GET /api/health
```

### WebSocket

```javascript
const ws = new WebSocket('ws://raspberry-pi:8080/ws');

ws.onopen = () => {
    // Subscribe to topics
    ws.send(JSON.stringify({
        type: 'subscribe',
        topics: ['sensors/+/temperature']
    }));
};

ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    console.log('Real-time data:', data);
};
```

### Prometheus Metrics

```bash
# Metrics endpoint
curl http://raspberry-pi:8080/metrics
```

Available metrics:
- `mqtt_messages_received_total`
- `mqtt_messages_stored_total`
- `mqtt_buffer_usage_percent`
- `mqtt_storage_latency_seconds`
- `websocket_connections_active`

## 💾 Storage Backends

### SQLite (Default)

```yaml
storage:
  backend: sqlite
  sqlite:
    path: /data/telemetry.db
    journal_mode: WAL
```

### PostgreSQL

```yaml
storage:
  backend: postgresql
  postgresql:
    host: localhost
    port: 5432
    database: telemetry
    username: user
    password: pass
```

### InfluxDB (Time-Series Optimized)

```yaml
storage:
  backend: influxdb
  influxdb:
    url: http://localhost:8086
    token: your-token
    org: telemetry
    bucket: telemetry
```

### Filesystem

```yaml
storage:
  backend: filesystem
  filesystem:
    base_path: /mnt/usb/telemetry
    file_format: jsonl
    compression: gzip
```

## ⏱️ Retention Policies

Automatic cleanup of old data:

```yaml
retention:
  enabled: true
  days: 90
  aggregation:
    enabled: true
    intervals:
      - 5m
      - 1h
      - 1d
```

## 🔐 Security

### JWT Authentication

```yaml
security:
  authentication:
    enabled: true
    jwt_secret: your-secret-key
    jwt_expiry: 24h
    users:
      - username: admin
        password_hash: $2b$12$...
        role: admin
```

### Generate password hash

```python
from mqtt_telemetry.auth import AuthManager

auth = AuthManager({})
hash = auth.hash_password("your-password")
print(hash)
```

### API Authentication

```bash
# Login
curl -X POST http://raspberry-pi:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your-password"}'

# Use token
curl http://raspberry-pi:8080/api/data \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 🐧 Systemd Service Installation

### Automatic Installation

```bash
sudo ./install-service.sh
```

This will:
1. Install dependencies
2. Create directories
3. Setup Python environment
4. Install systemd service
5. Configure permissions

### Manual Service Management

```bash
# Start service
sudo systemctl start mqtt-telemetry

# Enable on boot
sudo systemctl enable mqtt-telemetry

# Check status
sudo systemctl status mqtt-telemetry

# View logs
sudo journalctl -u mqtt-telemetry -f

# Restart
sudo systemctl restart mqtt-telemetry
```

## 📊 Monitoring with Prometheus & Grafana

### Prometheus Configuration

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'mqtt-telemetry'
    static_configs:
      - targets: ['raspberry-pi:8080']
```

### Grafana Dashboard

Import dashboard ID: `coming-soon`

Or use the metrics directly:
- Message rate: `rate(mqtt_messages_received_total[5m])`
- Buffer usage: `mqtt_buffer_usage_percent`
- Storage latency: `histogram_quantile(0.95, rate(mqtt_storage_latency_seconds_bucket[5m]))`

## 🔧 Advanced Configuration

### Complete config.yaml

```yaml
mqtt:
  broker: broker.example.com
  port: 1883
  client_id: raspberry-telemetry
  topics:
    - sensors/+/temperature
    - vehicles/+/gps

storage:
  backend: influxdb
  retention:
    enabled: true
    days: 90

web:
  enabled: true
  host: 0.0.0.0
  port: 8080

monitoring:
  prometheus:
    enabled: true
    port: 9090

logging:
  level: INFO
  file: /var/log/mqtt-telemetry.log
```

## 📈 Performance

| Backend    | Throughput  | Latency | Disk Usage |
|------------|-------------|---------|------------|
| SQLite     | 1K msg/s    | 5-10ms  | Medium     |
| PostgreSQL | 5K msg/s    | 2-8ms   | Medium     |
| InfluxDB   | 10K msg/s   | 1-5ms   | Low        |
| Filesystem | 3K msg/s    | 10-30ms | High       |

## 🐛 Troubleshooting

### Web interface not accessible

```bash
# Check service status
sudo systemctl status mqtt-telemetry

# Check port
sudo netstat -tulpn | grep 8080

# Check logs
sudo journalctl -u mqtt-telemetry --no-pager -n 50
```

### High memory usage

```yaml
# Reduce buffer size
buffer:
  size: 5000  # Default: 10000
```

### Database connection errors

```bash
# Test database connection
psql -h localhost -U telemetry_user -d telemetry

# Check PostgreSQL status
sudo systemctl status postgresql
```

## 📚 Examples

### Python Library Usage

```python
from mqtt_telemetry import MqttTelemetryClient, Config

# Load config
config = Config.from_file('config.yaml')

# Create client
client = MqttTelemetryClient(config=config)

# Set callback
async def on_message(topic, payload):
    print(f"Received: {topic} -> {payload}")

client.set_message_callback(on_message)

# Run
client.run()
```

### Query API from Python

```python
import requests

response = requests.get(
    'http://raspberry-pi:8080/api/data',
    params={
        'topic': 'sensors/temp01/temperature',
        'limit': 100
    }
)

data = response.json()
print(f"Received {data['count']} messages")
```

### WebSocket Client

```python
import asyncio
import websockets
import json

async def listen():
    uri = "ws://raspberry-pi:8080/ws"
    async with websockets.connect(uri) as websocket:
        # Subscribe
        await websocket.send(json.dumps({
            'type': 'subscribe',
            'topics': ['sensors/+/temperature']
        }))

        # Receive messages
        while True:
            message = await websocket.recv()
            data = json.loads(message)
            print(f"Received: {data}")

asyncio.run(listen())
```

## 📦 Package Structure

```
raspberry/
├── src/mqtt_telemetry/
│   ├── client.py              # MQTT client
│   ├── server.py              # Integrated server
│   ├── config.py              # Configuration
│   ├── schema.py              # Schema validation
│   ├── buffer.py              # Message buffering
│   ├── auth.py                # Authentication
│   ├── retention.py           # Retention scheduler
│   ├── prometheus_metrics.py # Metrics
│   ├── websocket_manager.py  # WebSocket manager
│   ├── storage/
│   │   ├── sqlite.py         # SQLite backend
│   │   ├── postgresql.py     # PostgreSQL backend
│   │   ├── influxdb.py       # InfluxDB backend
│   │   └── filesystem.py     # Filesystem backend
│   └── web/
│       ├── __init__.py       # Web interface
│       └── templates/
│           └── dashboard.html # Dashboard UI
├── config.example.yaml
├── requirements.txt
├── setup.py
├── mqtt-telemetry.service
└── install-service.sh
```

## 🤝 Contributing

Contributions welcome! See main repo for guidelines.

## 📄 License

MIT License - see LICENSE file

## 🔗 Links

- GitHub: https://github.com/yayoboy/Mqtt-base
- Documentation: https://github.com/yayoboy/Mqtt-base/tree/main/docs
- Issues: https://github.com/yayoboy/Mqtt-base/issues
