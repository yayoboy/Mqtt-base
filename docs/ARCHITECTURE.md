# Architecture Overview

## System Architecture

The MQTT Telemetry Storage System is designed as a multi-tier, cross-platform solution with three distinct implementations optimized for different hardware and use cases.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     MQTT Broker                              │
│                  (External Service)                          │
└────────────────┬─────────────────────────────────────────────┘
                 │
                 │ MQTT Protocol
                 │
    ┌────────────┼────────────┬──────────────────┐
    │            │            │                  │
    ▼            ▼            ▼                  ▼
┌────────┐  ┌────────┐  ┌─────────┐      ┌──────────┐
│  MCU   │  │Raspberry│  │ Server  │      │   GUI    │
│Version │  │   Pi    │  │ Version │      │ Desktop  │
└────────┘  └────────┘  └─────────┘      └──────────┘
     │           │            │                 │
     ▼           ▼            ▼                 ▼
┌────────┐  ┌────────┐  ┌──────────┐    ┌──────────┐
│SD Card │  │SQLite/ │  │TimescaleDB│    │ Server   │
│Storage │  │USB     │  │InfluxDB  │    │  API     │
└────────┘  └────────┘  └──────────┘    └──────────┘
```

## Component Architecture

### 1. Microcontroller Version

**Target**: ESP32, STM32, Raspberry Pi Pico
**Language**: C/C++
**Framework**: FreeRTOS

```
┌─────────────────────────────────────────────────┐
│            Microcontroller Application          │
├─────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐     │
│  │  MQTT    │  │ Schema   │  │ Circular │     │
│  │  Client  │→ │Validator │→ │ Buffer   │     │
│  └──────────┘  └──────────┘  └──────────┘     │
│                                    │            │
│                                    ▼            │
│  ┌──────────────────────────────────────────┐  │
│  │         Storage Manager                  │  │
│  │  - Non-blocking writes                   │  │
│  │  - File rotation                         │  │
│  │  - Compression (optional)                │  │
│  └──────────────────────────────────────────┘  │
│                     │                           │
│                     ▼                           │
│           ┌──────────────────┐                 │
│           │   SD/TF Card     │                 │
│           │   (SPI/SDIO)     │                 │
│           └──────────────────┘                 │
└─────────────────────────────────────────────────┘
```

**Key Features**:
- Non-blocking operations using FreeRTOS tasks
- Circular buffer (1000-10000 messages)
- Minimal memory footprint (~50KB RAM)
- Watchdog monitoring
- Power-efficient operation

### 2. Raspberry Pi Version

**Target**: Raspberry Pi 3/4/5
**Language**: Python 3.8+
**Framework**: asyncio

```
┌──────────────────────────────────────────────────┐
│         Python Application Layer                 │
├──────────────────────────────────────────────────┤
│                                                   │
│  ┌────────────┐        ┌──────────────┐         │
│  │  MQTT      │   →    │   Schema     │         │
│  │  Client    │        │   Validator  │         │
│  │  (async)   │        │   (Ajv)      │         │
│  └────────────┘        └──────────────┘         │
│         │                      │                 │
│         └──────────┬───────────┘                 │
│                    ▼                             │
│         ┌──────────────────┐                     │
│         │  Message Buffer  │                     │
│         │  (async deque)   │                     │
│         └──────────────────┘                     │
│                    │                             │
│         ┌──────────┴──────────┐                  │
│         ▼                     ▼                  │
│  ┌──────────────┐      ┌──────────────┐         │
│  │   Storage    │      │   Web API    │         │
│  │   Backend    │      │  (FastAPI)   │         │
│  └──────────────┘      └──────────────┘         │
│         │                     │                  │
│         ▼                     ▼                  │
│  ┌──────────────┐      ┌──────────────┐         │
│  │  SQLite /    │      │  WebSocket   │         │
│  │  PostgreSQL  │      │  Streaming   │         │
│  └──────────────┘      └──────────────┘         │
└──────────────────────────────────────────────────┘
```

**Key Features**:
- Async/await for high concurrency
- Multiple storage backends
- Built-in web interface
- REST API
- Real-time WebSocket streaming
- Lightweight (~100MB RAM)

### 3. Server Version

**Target**: Linux/Windows/macOS servers
**Language**: TypeScript/Node.js
**Framework**: Fastify

```
┌───────────────────────────────────────────────────────────┐
│              Server Application                            │
├───────────────────────────────────────────────────────────┤
│                                                            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐               │
│  │  MQTT    │→ │ Schema   │→ │ Message  │               │
│  │  Client  │  │Validator │  │ Buffer   │               │
│  └──────────┘  └──────────┘  └──────────┘               │
│                                    │                      │
│                     ┌──────────────┴──────────────┐      │
│                     ▼                             ▼      │
│         ┌────────────────────┐        ┌──────────────┐   │
│         │  Storage Manager   │        │  Monitoring  │   │
│         │  - Compression     │        │  Service     │   │
│         │  - Encryption      │        │              │   │
│         │  - Aggregation     │        └──────────────┘   │
│         └────────────────────┘                           │
│                     │                                     │
│         ┌───────────┼───────────────┐                    │
│         ▼           ▼               ▼                    │
│    ┌────────┐  ┌────────┐    ┌──────────┐              │
│    │TimeScale│ │InfluxDB│    │  Redis   │              │
│    │   DB    │  │        │    │  Cache   │              │
│    └────────┘  └────────┘    └──────────┘              │
│                                                           │
│  ┌────────────────────────────────────────────────────┐  │
│  │              API Layer                             │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐        │  │
│  │  │  REST    │  │ GraphQL  │  │WebSocket │        │  │
│  │  │   API    │  │   API    │  │ Streaming│        │  │
│  │  └──────────┘  └──────────┘  └──────────┘        │  │
│  └────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────┘
```

**Key Features**:
- High-performance async I/O
- Multiple database support
- REST + GraphQL APIs
- Real-time WebSocket
- Data aggregation
- Retention policies
- Plugin system
- Multi-tenant support
- Prometheus metrics

### 4. GUI Application

**Platform**: Electron (Cross-platform desktop)
**Framework**: React + shadcn/ui
**Language**: TypeScript

```
┌─────────────────────────────────────────────────┐
│          Electron Desktop App                    │
├─────────────────────────────────────────────────┤
│                                                  │
│  ┌───────────────────────────────────────────┐  │
│  │        React Application                  │  │
│  │                                           │  │
│  │  ┌──────────┐  ┌──────────┐  ┌────────┐ │  │
│  │  │Dashboard │  │ Schema   │  │  Data  │ │  │
│  │  │          │  │ Manager  │  │Explorer│ │  │
│  │  └──────────┘  └──────────┘  └────────┘ │  │
│  │                                           │  │
│  │  ┌──────────────────────────────────────┐│  │
│  │  │   State Management (Zustand)         ││  │
│  │  └──────────────────────────────────────┘│  │
│  └───────────────────────────────────────────┘  │
│                     │                            │
│                     ▼                            │
│         ┌────────────────────────┐               │
│         │   API Client           │               │
│         │   - REST               │               │
│         │   - WebSocket          │               │
│         └────────────────────────┘               │
│                     │                            │
│                     ▼                            │
│         ┌────────────────────────┐               │
│         │   Server Backend       │               │
│         └────────────────────────┘               │
└─────────────────────────────────────────────────┘
```

## Data Flow

### Message Processing Pipeline

```
MQTT Message
     │
     ▼
[Receive & Parse]
     │
     ▼
[Schema Validation]
     │
     ├─ Valid ─────────┐
     │                 ▼
     │         [Add to Buffer]
     │                 │
     │                 ▼
     │         [Batch Processing]
     │                 │
     │                 ▼
     │         [Compression (optional)]
     │                 │
     │                 ▼
     │         [Encryption (optional)]
     │                 │
     │                 ▼
     │         [Database Write]
     │                 │
     │                 ▼
     │         [Aggregation (optional)]
     │
     └─ Invalid ───→ [Log & Drop]
```

## Schema System

The schema system is shared across all platforms:

```
Schema Definition (YAML/JSON)
     │
     ├─→ [Microcontroller] → JSON parsing → Validation
     │
     ├─→ [Raspberry Pi]    → YAML parsing → Ajv validation
     │
     └─→ [Server]          → TypeScript    → Ajv validation
```

## Deployment Models

### 1. Edge Deployment (MCU)
- Device collects and stores locally
- Periodic sync to cloud when connected
- Offline-first architecture

### 2. Local Deployment (Raspberry Pi)
- Gateway for multiple edge devices
- Local storage with web interface
- Optional cloud sync

### 3. Cloud Deployment (Server)
- Centralized data collection
- High availability setup
- Load balanced
- Database clustering

### 4. Hybrid Deployment
```
[Edge Devices] → [Local Gateway] → [Cloud Server]
     MCU              RPi             Server
```

## Performance Characteristics

| Platform      | Throughput      | Latency    | Memory  |
|---------------|-----------------|------------|---------|
| MCU           | 500 msg/s       | 10-50ms    | ~50KB   |
| Raspberry Pi  | 5,000 msg/s     | 5-20ms     | ~100MB  |
| Server        | 50,000 msg/s    | 1-10ms     | ~500MB  |

## Security Architecture

```
┌─────────────────────────────────────────────┐
│          Security Layers                     │
├─────────────────────────────────────────────┤
│                                              │
│  Transport:  TLS 1.3 (MQTT/HTTP/WebSocket)  │
│  Auth:       JWT / OAuth2 / API Keys        │
│  Storage:    AES-256-GCM encryption         │
│  Access:     RBAC (Role-Based Access)       │
│  Audit:      Comprehensive logging          │
│                                              │
└─────────────────────────────────────────────┘
```

## Scalability

- **Horizontal**: Add more server instances behind load balancer
- **Vertical**: Increase resources per instance
- **Database**: Use TimescaleDB for time-series optimization
- **Caching**: Redis for hot data
- **Sharding**: Topic-based or tenant-based sharding

## Technology Stack

| Component    | Microcontroller | Raspberry Pi  | Server         | GUI           |
|--------------|-----------------|---------------|----------------|---------------|
| Language     | C/C++           | Python 3.8+   | TypeScript     | TypeScript    |
| Runtime      | FreeRTOS        | CPython       | Node.js 18+    | Electron      |
| MQTT Client  | PubSubClient    | paho-mqtt     | mqtt.js        | mqtt.js       |
| Database     | SD Card (files) | SQLite/PG     | Multiple       | N/A           |
| Web Server   | N/A             | FastAPI       | Fastify        | N/A           |
| UI Framework | N/A             | Jinja2        | N/A            | React         |
