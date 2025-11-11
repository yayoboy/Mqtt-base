# CRITICAL ISSUES IN SERVER IMPLEMENTATION

## Issue #1: Database Backend Module Not Found Error

### Impact: CRITICAL - Application Crashes

**Problem**: The DatabaseManager imports database backends that don't exist.

**Code (src/database/manager.ts, lines 35-50)**:
```typescript
switch (backendType) {
  case 'timescaledb':
  case 'postgresql':
    const { PostgreSQLBackend } = await import('./backends/postgresql');
    // ❌ FILE DOES NOT EXIST: src/database/backends/postgresql.ts
    this.backend = new PostgreSQLBackend(this.config);
    break;

  case 'influxdb':
    const { InfluxDBBackend } = await import('./backends/influxdb');
    // ❌ FILE DOES NOT EXIST: src/database/backends/influxdb.ts
    this.backend = new InfluxDBBackend(this.config);
    break;

  case 'sqlite':
    const { SQLiteBackend } = await import('./backends/sqlite');
    // ✓ THIS FILE EXISTS
    this.backend = new SQLiteBackend(this.config);
    break;
}
```

**Error When Used**:
```
Error: Cannot find module '/path/to/server/src/database/backends/postgresql.ts'
    at ESMLoader.resolve
    at processResolveFilename
```

**Why This Happens**:
- config.example.json shows PostgreSQL/TimescaleDB as valid options
- README.md documents PostgreSQL configuration
- Code tries to import the backends
- Implementation files were never created

**Consequence**:
- Using `"primary": "postgresql"` or `"primary": "timescaledb"` in config → RUNTIME CRASH
- Using `"primary": "influxdb"` → RUNTIME CRASH
- Using `"primary": "sqlite"` → Works fine

**Fix Required**:
1. Either implement the 3 missing backends (~600 lines total)
2. Or remove the references and only support SQLite
3. Or add fallback/validation before import

---

## Issue #2: Zero Authentication Implementation

### Impact: CRITICAL - No Security

**Problem**: Auth config exists but no implementation logic.

**Config (config.example.json, lines 91-95)**:
```json
"auth": {
  "enabled": false,
  "jwtSecret": "",
  "jwtExpiry": "24h"
}
```

**API Routes (src/api/routes.ts)**:
```typescript
// GET /api/data endpoint - ZERO authentication checks
fastify.get('/api/data', async (request, reply) => {
  const { topic, start, end, limit = 1000 } = request.query as any;
  // No credentials validation
  // No token verification
  // No API key checking
  // Just returns data to anyone
});
```

**Missing Implementation**:
- No JWT token validation
- No user authentication
- No API key support
- No authorization checks
- No rate limiting
- No CORS security headers

**TypeScript Interfaces Show Intent (src/config.ts)**:
```typescript
auth?: {
  enabled: boolean;
  jwtSecret: string;
  jwtExpiry: string;
};
```

But nowhere in the code is this actually used.

**Consequence**:
- If exposed publicly, anyone can:
  - Query all telemetry data
  - Access system statistics
  - List all schemas
  - See buffer status
- No access control
- No audit trail

**Fix Required**: ~150 lines of authentication middleware + JWT logic

---

## Issue #3: Prometheus Metrics - Configured But Not Implemented

### Impact: HIGH - No Monitoring

**Installed Dependencies** (package.json, line 50):
```json
"pino": "^8.17.1",           // ✓ Used for logging
"prometheus-client": "^14",  // ❌ Installed but never imported or used
```

**Config Promises Metrics** (config.example.json, lines 157-162):
```json
"monitoring": {
  "prometheus": {
    "enabled": true,
    "port": 9090,
    "path": "/metrics"
  }
}
```

**README Documents Metrics** (README.md, lines 171-180):
```
## Monitoring

Prometheus metrics available at `/metrics`

Key metrics:
- `mqtt_messages_received_total`
- `mqtt_messages_stored_total`
- `buffer_usage_percent`
- `storage_write_latency_seconds`
```

**Actual Implementation**:
```typescript
// src/monitoring/service.ts (40 lines - stub only)
export class MonitoringService {
  async start() {
    logger.info('Monitoring service started');  // Just logs, doesn't setup metrics
  }

  getStats() {
    return {
      uptime: Date.now() - this.startTime,
      memory: process.memoryUsage(),
      // Basic stats only
    };
  }
}
```

**What's Missing**:
- No Prometheus endpoint registration
- No metrics collection
- No Counter/Gauge/Histogram exports
- No `/metrics` HTTP endpoint
- No metric labels
- No Grafana integration support

**Consequence**:
- Cannot monitor system with Prometheus/Grafana
- Cannot track performance metrics
- Cannot set up alerts
- Blind to system health

**Fix Required**: ~150 lines to implement metrics endpoint + collectors

---

## Issue #4: Retention Scheduler Missing

### Impact: HIGH - Storage Bloat

**Config Promises Retention** (config.example.json, lines 137-156):
```json
"retention": {
  "enabled": true,
  "policies": [
    {
      "name": "raw_data",
      "duration": "90d",
      "resolution": "raw"
    },
    {
      "name": "aggregated_5m",
      "duration": "365d",
      "resolution": "5m"
    }
  ]
}
```

**No Implementation**:
```typescript
// src/storage/manager.ts - Does NOT enforce retention
constructor(
  private database: DatabaseManager,
  private buffer: MessageBuffer,
  private config: StorageConfig  // ← Has retention config available
) {
  super();
}

async start(): Promise<void> {
  if (this.running) return;
  this.running = true;
  
  this.flushTimer = setInterval(
    () => this.processBuffer(),
    5000  // Only flushes buffer, never cleans up old data
  );
}

// ❌ No retention enforcement
// ❌ No data deletion based on age
// ❌ No aggregation of old data
```

**Consequence**:
- Data accumulates indefinitely
- Disk fills up over time
- No automatic cleanup
- No data downsample to lower resolution
- Exceeds storage capacity → Service fails

**Example**:
```
Day 1:   1 million events stored
Day 30:  30 million events (if 1M/day rate)
Day 90:  90 million events (hits 90-day policy)
         But policy is never enforced!
         Still storing all 90M rows
Day 180: 180 million events
         Database becomes slow, disk full
         Service hangs or crashes
```

**Fix Required**: ~100 lines for scheduler + cleanup logic

---

## Issue #5: Compression Configured But Never Applied

### Impact: MEDIUM - Storage Waste

**Config Enables Compression** (config.example.json, lines 108-113):
```json
"storage": {
  "compression": {
    "enabled": true,
    "algorithm": "zstd",  // Zstandard compression
    "level": 3
  }
}
```

**Libraries Installed** (package.json):
```json
"zstd-codec": "^0.1.5",    // ✓ Installed
"lz4": "^0.6.5",           // ✓ Installed
// (gzip is built-in Node.js)
```

**StorageManager Code**:
```typescript
constructor(
  private database: DatabaseManager,
  private buffer: MessageBuffer,
  private config: StorageConfig  // ← Has compression config
) {
  super();
}

private async processBuffer(): Promise<void> {
  const messages = await this.buffer.getBatch();
  
  // Data goes straight to database without compression
  const success = await this.database.storeBatch(messages);
  
  // ❌ Compression configuration is never read
  // ❌ Data is never compressed before storage
  // ❌ No algorithm selection logic
  // ❌ No compression level used
}
```

**SQLite Storage**:
```typescript
async storeBatch(messages: any[]): Promise<boolean> {
  const stmt = this.db.prepare(`
    INSERT INTO messages (topic, payload, timestamp, received_at)
    VALUES (?, ?, ?, ?)
  `);
  
  // Payload stored as-is
  stmt.run(
    msg.topic,
    JSON.stringify(msg.payload),  // ❌ Raw JSON, not compressed
    msg.timestamp.toISOString(),
    msg.receivedAt.toISOString()
  );
}
```

**Consequence**:
- Storage space wasted by 50-80% (compression ratio not achieved)
- Larger database file
- Slower queries (more data to read)
- Higher I/O costs
- Hits storage limits faster

**Example**:
```
Without compression:  100MB per million events
With zstd (level 3):  20-30MB per million events (70% savings)

1 year of data:
  Uncompressed: 36.5GB
  Compressed:   7-11GB
  Difference:   25-30GB wasted!
```

**Fix Required**: ~50 lines to select and apply compression

---

## Issue #6: WebSocket Real-Time Broken

### Impact: MEDIUM - Real-Time Features Don't Work

**WebSocket Manager** (src/websocket/manager.ts, 51 lines):
```typescript
private setupWebSocket() {
  this.fastify.get(this.config.path, { websocket: true }, (connection, req) => {
    this.connections.add(connection);
    logger.info('WebSocket client connected');

    connection.socket.on('message', (message: any) => {
      logger.debug('WebSocket message received', message.toString());
      // ❌ Message received but completely ignored
      // ❌ No parsing of subscription requests
      // ❌ No topic filtering
      // ❌ No message broadcasting
    });

    connection.socket.on('close', () => {
      this.connections.delete(connection);
      logger.info('WebSocket client disconnected');
    });
  });
}

broadcast(data: any) {
  const message = JSON.stringify(data);
  for (const conn of this.connections) {
    try {
      conn.socket.send(message);
      // Broadcasting exists but is never called from anywhere
    }
  }
}
```

**Missing Functionality**:
```typescript
// ❌ Client sends: { type: 'subscribe', topics: ['sensors/+/temp'] }
// ✓ Received but ignored

// ❌ No subscription tracking
// ❌ No topic pattern matching
// ❌ No message filtering by topic
// ❌ No routing to subscribers
// ❌ Broadcast() method exists but never called
```

**How It Should Work**:
1. Client connects to `/ws`
2. Client sends: `{ type: 'subscribe', topics: ['sensors/+/temp'] }`
3. Server stores subscription
4. When MQTT message arrives on `sensors/room1/temp`:
   - Server checks subscriptions
   - Routes to matching subscribers
   - Sends: `{ type: 'telemetry', topic: '...', payload: {...} }`

**Current Behavior**:
1. Client connects to `/ws` ✓
2. Client sends subscription message... 
3. Server logs it and does nothing ❌

**Consequence**:
- No real-time data streaming to clients
- WebSocket is useless (connection only)
- Users cannot see live updates
- Feature is promised but broken

**Raspberry Pi Has This** (websocket_manager.py, 100+ lines):
- Subscription tracking
- Topic pattern matching
- Broadcasting to subscribers
- Connection lifecycle management

---

## Issue #7: No Web Dashboard / HTML UI

### Impact: CRITICAL - No User Access

**README Promises Dashboard**:
```
## Quick Start
Visit http://localhost:3000 to access the dashboard
```

**Actual Implementation**:
- No HTML files
- No static directory
- No Fastify static middleware
- No dashboard routes
- No UI for data visualization
- No configuration UI

**Raspberry Pi Has** (web/__init__.py + templates):
```python
@self.app.get("/", response_class=HTMLResponse)
async def dashboard(request: Request):
    return self.templates.TemplateResponse("dashboard.html", {
        "request": request,
        "title": "MQTT Telemetry Dashboard"
    })
```

With:
- HTML dashboard
- Charts/graphs
- Real-time updates
- Schema manager
- Statistics display

**Server Missing**:
- Dashboard HTML (~200 lines)
- JavaScript for charts
- CSS styling
- Template integration
- Static file serving

**Consequence**:
- No browser-based data access
- No visual analytics
- Only programmatic API access
- Requires external dashboard tool

---

## Issue #8: No Data Export Capability

### Impact: CRITICAL - Cannot Get Data Out

**Missing Endpoints**:
```
GET /api/export?format=csv&topic=...&start=...&end=...
GET /api/export?format=json&topic=...&start=...&end=...
```

**What Users Need**:
- Extract data for analysis in Excel/R/Python
- Backup data for archival
- Move data to other systems
- Generate reports

**Current Workaround**:
- Query via REST API (limited by pagination)
- Manual processing
- No bulk export

**Raspberry Pi Has** (web/__init__.py, lines 131-156):
```python
@self.app.get("/api/export")
async def export_data(
    format: str = "json",
    topic: Optional[str] = None,
    start: Optional[str] = None,
    end: Optional[str] = None,
    limit: int = 10000
):
    data = await self.database.query({...})
    
    if format == "csv":
        return await self._export_csv(data)
    elif format == "json":
        return {"data": data}
```

**Fix Required**: ~100 lines for CSV/JSON export

---

## Summary of Critical Code Issues

| Issue | Severity | Impact | Lines | Time |
|-------|----------|--------|-------|------|
| Database Crashes | CRITICAL | Runtime failure | 200+ | 1 week |
| No Authentication | CRITICAL | Zero security | 150+ | 1 week |
| No Prometheus | HIGH | No monitoring | 150+ | 1 week |
| No Retention | HIGH | Storage bloat | 100+ | 1 week |
| No Web UI | CRITICAL | No user access | 300+ | 2 weeks |
| Compression Unused | MEDIUM | Wasted space | 50+ | 2 days |
| WebSocket Broken | MEDIUM | No real-time | 150+ | 1 week |
| No Export | CRITICAL | Can't get data | 100+ | 3 days |

**Total**: ~1,200 lines, 8-9 weeks minimum

