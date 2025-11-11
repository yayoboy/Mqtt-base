# MQTT Telemetry Server

Full-featured MQTT telemetry server with multiple database support, REST API, GraphQL, and WebSocket streaming.

## Features

- **Multiple Database Backends**: PostgreSQL, TimescaleDB, InfluxDB, SQLite
- **REST API**: Query and manage telemetry data
- **GraphQL API**: Flexible data querying
- **WebSocket**: Real-time data streaming
- **Schema Validation**: Custom schema validation with hot-reloading
- **Data Compression**: Multiple compression algorithms (gzip, zstd, lz4)
- **Encryption**: At-rest and in-transit encryption
- **Aggregation**: Automatic data aggregation at multiple time intervals
- **Retention Policies**: Automatic data cleanup
- **Monitoring**: Prometheus metrics and health checks
- **Plugin System**: Extensible architecture
- **Multi-Tenant**: Support for multiple isolated tenants

## Quick Start

### Installation

```bash
cd server
npm install
```

### Configuration

Copy the example configuration:

```bash
cp config.example.json config.json
```

Edit `config.json` with your settings.

### Development

```bash
npm run dev
```

### Production

```bash
npm run build
npm start
```

## API Endpoints

### REST API

- `GET /api/data` - Query telemetry data
- `GET /api/schemas` - List all schemas
- `GET /api/schemas/:name` - Get specific schema
- `GET /api/stats` - System statistics
- `GET /api/buffer` - Buffer status
- `GET /health` - Health check

### GraphQL

GraphQL playground available at `/graphql`

```graphql
query {
  messages(
    topic: "sensors/temp01/temperature"
    startTime: "2024-01-01T00:00:00Z"
    limit: 100
  ) {
    topic
    payload
    timestamp
  }
}
```

### WebSocket

Connect to `/ws` for real-time data streaming.

## Database Configuration

### TimescaleDB (Recommended for time-series data)

```json
{
  "database": {
    "primary": "timescaledb",
    "timescaledb": {
      "host": "localhost",
      "port": 5432,
      "database": "telemetry",
      "username": "user",
      "password": "password",
      "compression": true,
      "retentionDays": 365
    }
  }
}
```

### InfluxDB

```json
{
  "database": {
    "primary": "influxdb",
    "influxdb": {
      "url": "http://localhost:8086",
      "token": "your-token",
      "org": "telemetry",
      "bucket": "telemetry"
    }
  }
}
```

### SQLite (Development)

```json
{
  "database": {
    "primary": "sqlite",
    "sqlite": {
      "path": "./data/telemetry.db"
    }
  }
}
```

## Environment Variables

```bash
# MQTT
MQTT_BROKER=mqtt://broker.example.com:1883
MQTT_USERNAME=user
MQTT_PASSWORD=password

# API
API_PORT=3000
API_HOST=0.0.0.0

# Database
DATABASE_URL=postgresql://user:pass@localhost/telemetry

# Logging
LOG_LEVEL=info

# Configuration file
CONFIG_PATH=./config.json
```

## Docker

```bash
docker build -t mqtt-telemetry-server .
docker run -p 3000:3000 -v $(pwd)/config.json:/app/config.json mqtt-telemetry-server
```

## Performance

- **Throughput**: Up to 50,000 messages/second (with TimescaleDB)
- **Latency**: < 10ms average (database dependent)
- **Memory**: ~200MB base + buffer size
- **CPU**: Scales linearly with message rate

## Monitoring

Prometheus metrics available at `/metrics`

Key metrics:
- `mqtt_messages_received_total`
- `mqtt_messages_stored_total`
- `buffer_usage_percent`
- `storage_write_latency_seconds`

## License

MIT
