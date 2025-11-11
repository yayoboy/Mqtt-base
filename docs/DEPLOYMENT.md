# Deployment Guide

## Quick Start

### Microcontroller (ESP32)

1. **Install PlatformIO**
```bash
pip install platformio
```

2. **Configure WiFi and MQTT**
```cpp
// Edit microcontroller/include/config.h
#define WIFI_SSID "your-ssid"
#define WIFI_PASSWORD "your-password"
#define MQTT_BROKER "broker.example.com"
```

3. **Build and Upload**
```bash
cd microcontroller
pio run --target upload
pio device monitor
```

### Raspberry Pi

1. **Install Python Dependencies**
```bash
cd raspberry
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

2. **Configure**
```bash
cp config.example.yaml config.yaml
# Edit config.yaml with your settings
```

3. **Run**
```bash
python -m mqtt_telemetry --config config.yaml
```

4. **Install as Service**
```bash
sudo ./install-service.sh
sudo systemctl start mqtt-telemetry
sudo systemctl enable mqtt-telemetry
```

### Server

1. **Install Dependencies**
```bash
cd server
npm install
```

2. **Configure**
```bash
cp config.example.json config.json
# Edit config.json
```

3. **Development**
```bash
npm run dev
```

4. **Production**
```bash
npm run build
npm start
```

### GUI Application

1. **Install Dependencies**
```bash
cd gui
npm install
```

2. **Development**
```bash
npm run electron:dev
```

3. **Build**
```bash
npm run electron:build
```

## Docker Deployment

### Server with Docker

**Dockerfile:**
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --production

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
```

**docker-compose.yml:**
```yaml
version: '3.8'

services:
  mqtt-telemetry:
    build: ./server
    ports:
      - "3000:3000"
    environment:
      - MQTT_BROKER=mqtt://mqtt:1883
      - DATABASE_URL=postgresql://postgres:password@postgres:5432/telemetry
    depends_on:
      - postgres
      - mqtt
    volumes:
      - ./config.json:/app/config.json
      - ./data:/app/data

  postgres:
    image: timescale/timescaledb:latest-pg15
    environment:
      - POSTGRES_PASSWORD=password
      - POSTGRES_DB=telemetry
    volumes:
      - postgres-data:/var/lib/postgresql/data

  mqtt:
    image: eclipse-mosquitto:latest
    ports:
      - "1883:1883"
    volumes:
      - ./mosquitto.conf:/mosquitto/config/mosquitto.conf

volumes:
  postgres-data:
```

**Run:**
```bash
docker-compose up -d
```

## Production Deployment

### TimescaleDB Setup

1. **Install TimescaleDB**
```bash
# Ubuntu/Debian
sudo apt-get install postgresql-15 postgresql-15-timescaledb-2

# Configure
sudo timescaledb-tune
```

2. **Create Database**
```sql
CREATE DATABASE telemetry;
\c telemetry
CREATE EXTENSION IF NOT EXISTS timescaledb;
```

3. **Create Hypertable**
```sql
CREATE TABLE messages (
    time TIMESTAMPTZ NOT NULL,
    topic TEXT NOT NULL,
    payload JSONB NOT NULL,
    device_id TEXT
);

SELECT create_hypertable('messages', 'time');

CREATE INDEX idx_messages_topic ON messages(topic, time DESC);
CREATE INDEX idx_messages_device ON messages(device_id, time DESC);
```

4. **Configure Compression**
```sql
ALTER TABLE messages SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'topic'
);

SELECT add_compression_policy('messages', INTERVAL '7 days');
```

5. **Configure Retention**
```sql
SELECT add_retention_policy('messages', INTERVAL '90 days');
```

### InfluxDB Setup

1. **Install InfluxDB 2.x**
```bash
wget https://dl.influxdata.com/influxdb/releases/influxdb2-2.7.4-amd64.deb
sudo dpkg -i influxdb2-2.7.4-amd64.deb
sudo systemctl start influxdb
```

2. **Setup**
```bash
influx setup
# Create organization: telemetry
# Create bucket: telemetry
```

3. **Configure**
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

### Nginx Reverse Proxy

```nginx
upstream mqtt_telemetry {
    server localhost:3000;
}

server {
    listen 80;
    server_name telemetry.example.com;

    location / {
        proxy_pass http://mqtt_telemetry;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /ws {
        proxy_pass http://mqtt_telemetry;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

### SSL/TLS with Let's Encrypt

```bash
sudo certbot --nginx -d telemetry.example.com
```

### Systemd Service (Server)

**/etc/systemd/system/mqtt-telemetry.service:**
```ini
[Unit]
Description=MQTT Telemetry Server
After=network.target postgresql.service

[Service]
Type=simple
User=telemetry
WorkingDirectory=/opt/mqtt-telemetry/server
Environment="NODE_ENV=production"
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl start mqtt-telemetry
sudo systemctl enable mqtt-telemetry
```

## High Availability Setup

### Load Balancer

```nginx
upstream mqtt_telemetry_cluster {
    least_conn;
    server 10.0.1.10:3000;
    server 10.0.1.11:3000;
    server 10.0.1.12:3000;
}

server {
    listen 80;

    location / {
        proxy_pass http://mqtt_telemetry_cluster;
    }
}
```

### Database Replication

**PostgreSQL Streaming Replication:**

Primary:
```ini
# postgresql.conf
wal_level = replica
max_wal_senders = 3
```

Standby:
```ini
# recovery.conf
standby_mode = 'on'
primary_conninfo = 'host=primary port=5432 user=replicator'
```

## Monitoring

### Prometheus

**prometheus.yml:**
```yaml
scrape_configs:
  - job_name: 'mqtt-telemetry'
    static_configs:
      - targets: ['localhost:9090']
```

### Grafana Dashboard

1. Add Prometheus data source
2. Import dashboard from `docs/grafana-dashboard.json`

## Backup

### Database Backup

```bash
# PostgreSQL
pg_dump telemetry | gzip > backup_$(date +%Y%m%d).sql.gz

# Automated backup
0 2 * * * pg_dump telemetry | gzip > /backups/telemetry_$(date +\%Y\%m\%d).sql.gz
```

### Application Backup

```bash
# Backup configuration and data
tar -czf backup.tar.gz config.json data/ logs/
```

## Scaling

### Horizontal Scaling

1. Deploy multiple server instances
2. Use load balancer
3. Share Redis for buffer persistence
4. Use PostgreSQL/TimescaleDB for storage

### Vertical Scaling

- Increase server resources (CPU, RAM)
- Tune database parameters
- Increase buffer size
- Enable compression

## Security Checklist

- [ ] Enable TLS for MQTT
- [ ] Use SSL for database connections
- [ ] Enable authentication
- [ ] Configure firewall rules
- [ ] Use strong passwords
- [ ] Enable encryption at rest
- [ ] Configure backup retention
- [ ] Set up monitoring alerts
- [ ] Regular security updates
- [ ] Audit logs enabled

## Performance Tuning

### Buffer Size

```json
{
  "buffer": {
    "size": 100000,  // Increase for high throughput
    "batchSize": 1000
  }
}
```

### Database Connection Pool

```json
{
  "database": {
    "postgresql": {
      "poolSize": 50  // Adjust based on load
    }
  }
}
```

### Compression

```json
{
  "storage": {
    "compression": {
      "enabled": true,
      "algorithm": "zstd",
      "level": 3
    }
  }
}
```

## Troubleshooting

### High Memory Usage

- Reduce buffer size
- Enable compression
- Check for memory leaks
- Restart service periodically

### Slow Queries

- Add database indexes
- Enable query caching
- Use aggregations
- Optimize retention policies

### Connection Issues

- Check firewall rules
- Verify MQTT broker
- Check SSL certificates
- Review authentication settings

### Data Loss

- Check buffer overflow
- Verify disk space
- Review logs for errors
- Ensure persistence enabled

## Maintenance

### Regular Tasks

- Monitor disk space
- Review logs
- Update dependencies
- Backup configuration
- Test disaster recovery
- Review metrics

### Database Maintenance

```sql
-- Vacuum (PostgreSQL)
VACUUM ANALYZE messages;

-- Reindex
REINDEX TABLE messages;

-- Check table size
SELECT pg_size_pretty(pg_total_relation_size('messages'));
```

## Support

For issues and questions:
- GitHub Issues: https://github.com/yayoboy/Mqtt-base/issues
- Documentation: https://docs.mqtt-telemetry.org
- Email: esoglobine@gmail.com
