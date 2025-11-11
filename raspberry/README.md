# MQTT Telemetry - Raspberry Pi Version

Python-based MQTT telemetry storage system for Raspberry Pi with web interface.

## Features

- Async/await non-blocking operations
- Multiple storage backends (SQLite, PostgreSQL, USB, SD card)
- Built-in web interface for monitoring
- Schema validation with custom rules
- Data compression and encryption
- REST API for data access
- Lightweight and efficient
- Easy deployment as system service

## Requirements

- Raspberry Pi 3 or newer (tested on Pi 4 and Pi 5)
- Python 3.8+
- 100MB free disk space
- Network connectivity (WiFi or Ethernet)

## Installation

### Quick Install

```bash
curl -sSL https://raw.githubusercontent.com/your-repo/install.sh | bash
```

### Manual Install

```bash
cd raspberry
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

## Configuration

Create `config.yaml`:

```yaml
mqtt:
  broker: broker.example.com
  port: 1883
  username: ""
  password: ""
  client_id: raspberry-telemetry

storage:
  backend: sqlite  # sqlite, postgresql, filesystem
  path: /mnt/usb/telemetry  # For filesystem backend
  database_url: ""  # For PostgreSQL

schema:
  path: ../shared/schemas
  validation_enabled: true

web:
  enabled: true
  host: 0.0.0.0
  port: 8080

logging:
  level: INFO
  file: /var/log/mqtt-telemetry.log
```

## Usage

### Command Line

```bash
# Start with config file
python -m mqtt_telemetry --config config.yaml

# Start with custom schema
python -m mqtt_telemetry --schema ../shared/schemas/temperature_sensor.yaml

# Enable debug mode
python -m mqtt_telemetry --config config.yaml --debug
```

### As Python Library

```python
from mqtt_telemetry import MqttTelemetryClient

client = MqttTelemetryClient(
    broker="broker.example.com",
    storage_backend="sqlite",
    storage_path="/data/telemetry.db"
)

# Subscribe to topics
client.subscribe("sensors/+/temperature")

# Start processing
client.run()
```

### As System Service

```bash
sudo ./install-service.sh
sudo systemctl start mqtt-telemetry
sudo systemctl enable mqtt-telemetry
```

## Web Interface

Access the web interface at `http://raspberry-pi-ip:8080`

Features:
- Real-time telemetry dashboard
- Schema management
- Data export
- System statistics
- Configuration editor

## API Endpoints

### REST API

- `GET /api/data` - Query telemetry data
- `GET /api/schemas` - List schemas
- `POST /api/schemas` - Upload new schema
- `GET /api/stats` - System statistics
- `GET /api/health` - Health check

### WebSocket

- `ws://raspberry-pi-ip:8080/ws` - Real-time data stream

## Storage Options

### SQLite (Default)
- Best for: Small to medium deployments
- Location: Configurable (SD card or USB)
- Max throughput: ~1000 msg/sec

### PostgreSQL
- Best for: High-volume deployments
- Location: Local or remote database
- Max throughput: ~5000 msg/sec

### Filesystem
- Best for: Simple logging, debugging
- Location: SD card or USB drive
- Format: JSONL (one JSON per line)

## Performance Tuning

See [PERFORMANCE.md](PERFORMANCE.md) for optimization tips.

## Troubleshooting

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
