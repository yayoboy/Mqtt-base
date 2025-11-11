# API Reference

## REST API

Base URL: `http://localhost:3000/api`

### Authentication

Most endpoints require authentication:

```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     http://localhost:3000/api/data
```

### Endpoints

#### Query Data

**GET /api/data**

Query telemetry data with filters.

**Parameters:**
- `topic` (string, optional): Filter by MQTT topic
- `start` (ISO 8601, optional): Start of time range
- `end` (ISO 8601, optional): End of time range
- `limit` (number, optional): Maximum results (default: 1000)
- `offset` (number, optional): Pagination offset

**Example:**
```bash
curl "http://localhost:3000/api/data?topic=sensors/temp01/temperature&start=2024-01-01T00:00:00Z&limit=100"
```

**Response:**
```json
{
  "data": [
    {
      "topic": "sensors/temp01/temperature",
      "payload": {
        "temperature": 23.5,
        "humidity": 45.2
      },
      "timestamp": "2024-01-01T12:00:00Z",
      "receivedAt": "2024-01-01T12:00:00.123Z"
    }
  ],
  "count": 100
}
```

#### List Schemas

**GET /api/schemas**

List all loaded schemas.

**Response:**
```json
{
  "schemas": [
    {
      "name": "temperature_sensor",
      "version": "1.0.0",
      "topicPattern": "sensors/+/temperature",
      "fields": [...]
    }
  ]
}
```

#### Get Schema

**GET /api/schemas/:name**

Get specific schema by name.

**Response:**
```json
{
  "name": "temperature_sensor",
  "version": "1.0.0",
  "description": "Temperature sensor schema",
  "fields": [
    {
      "name": "temperature",
      "type": "float",
      "required": true
    }
  ]
}
```

#### System Statistics

**GET /api/stats**

Get system statistics.

**Response:**
```json
{
  "uptime": 3600000,
  "memory": {
    "rss": 100000000,
    "heapTotal": 50000000,
    "heapUsed": 30000000
  },
  "buffer": {
    "size": 1234,
    "usage": 24.68
  },
  "mqtt": {
    "connected": true,
    "stats": {
      "messagesReceived": 12345,
      "messagesValid": 12300,
      "messagesInvalid": 45
    }
  },
  "storage": {
    "messagesStored": 12000,
    "batchesProcessed": 120,
    "errors": 0
  }
}
```

#### Buffer Status

**GET /api/buffer**

Get buffer status.

**Response:**
```json
{
  "size": 1234,
  "usagePercent": 24.68,
  "dropped": 5
}
```

#### Health Check

**GET /health**

Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T12:00:00Z",
  "uptime": 3600,
  "memory": {...},
  "mqtt": true,
  "buffer": {
    "size": 1234,
    "usage": 24.68
  }
}
```

## GraphQL API

GraphQL endpoint: `http://localhost:3000/graphql`

GraphQL Playground: `http://localhost:3000/graphql` (development mode)

### Schema

```graphql
type Message {
  topic: String!
  payload: JSON!
  timestamp: String!
  receivedAt: String!
}

type Schema {
  name: String!
  version: String!
  topicPattern: String
  fields: [Field!]!
}

type Field {
  name: String!
  type: String!
  required: Boolean
}

type Query {
  messages(
    topic: String
    startTime: String
    endTime: String
    limit: Int
  ): [Message!]!

  schemas: [Schema!]!
  schema(name: String!): Schema
}
```

### Queries

#### Get Messages

```graphql
query GetMessages {
  messages(
    topic: "sensors/temp01/temperature"
    startTime: "2024-01-01T00:00:00Z"
    limit: 100
  ) {
    topic
    payload
    timestamp
    receivedAt
  }
}
```

#### Get Schemas

```graphql
query GetSchemas {
  schemas {
    name
    version
    topicPattern
    fields {
      name
      type
      required
    }
  }
}
```

## WebSocket API

WebSocket endpoint: `ws://localhost:3000/ws`

### Connect

```javascript
const ws = new WebSocket('ws://localhost:3000/ws');

ws.onopen = () => {
  console.log('Connected');

  // Subscribe to topics
  ws.send(JSON.stringify({
    type: 'subscribe',
    topics: ['sensors/+/temperature']
  }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Received:', data);
};
```

### Message Types

#### Subscribe

```json
{
  "type": "subscribe",
  "topics": ["sensors/+/temperature", "vehicles/+/gps"]
}
```

#### Unsubscribe

```json
{
  "type": "unsubscribe",
  "topics": ["sensors/+/temperature"]
}
```

#### Telemetry Message

```json
{
  "type": "telemetry",
  "data": {
    "topic": "sensors/temp01/temperature",
    "payload": {
      "temperature": 23.5
    },
    "timestamp": "2024-01-01T12:00:00Z"
  }
}
```

## Rate Limiting

Default rate limits:
- 100 requests per minute per IP
- 1000 requests per hour per IP

Rate limit headers:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640000000
```

## Error Responses

### Error Format

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "details": {
      "field": "topic",
      "issue": "Required field missing"
    }
  }
}
```

### Error Codes

- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `429` - Too Many Requests
- `500` - Internal Server Error

## Client Libraries

### JavaScript/TypeScript

```typescript
import axios from 'axios';

const client = axios.create({
  baseURL: 'http://localhost:3000/api',
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN'
  }
});

// Query data
const response = await client.get('/data', {
  params: {
    topic: 'sensors/temp01/temperature',
    limit: 100
  }
});
```

### Python

```python
import requests

client = requests.Session()
client.headers.update({
    'Authorization': 'Bearer YOUR_TOKEN'
})

# Query data
response = client.get('http://localhost:3000/api/data', params={
    'topic': 'sensors/temp01/temperature',
    'limit': 100
})

data = response.json()
```

### cURL

```bash
# Query data
curl -H "Authorization: Bearer YOUR_TOKEN" \
     "http://localhost:3000/api/data?topic=sensors/temp01/temperature&limit=100"

# Get stats
curl http://localhost:3000/api/stats

# Health check
curl http://localhost:3000/health
```

## Prometheus Metrics

Metrics endpoint: `http://localhost:9090/metrics`

### Available Metrics

- `mqtt_messages_received_total` - Total messages received
- `mqtt_messages_valid_total` - Total valid messages
- `mqtt_messages_invalid_total` - Total invalid messages
- `buffer_size` - Current buffer size
- `buffer_usage_percent` - Buffer usage percentage
- `storage_messages_stored_total` - Total messages stored
- `storage_write_latency_seconds` - Storage write latency
- `http_requests_total` - HTTP requests by endpoint
- `http_request_duration_seconds` - HTTP request duration

### Example Queries

```promql
# Message rate (messages per second)
rate(mqtt_messages_received_total[5m])

# Average buffer usage
avg_over_time(buffer_usage_percent[1h])

# Storage write latency P95
histogram_quantile(0.95, rate(storage_write_latency_seconds_bucket[5m]))
```
