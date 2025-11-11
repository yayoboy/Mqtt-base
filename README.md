# MQTT Telemetry Storage System

A comprehensive, multi-platform MQTT telemetry storage system with customizable schemas, supporting microcontrollers, Raspberry Pi, and full-featured servers.

## 🚀 Features

### Core Features
- **Customizable Schema Management** - Define and validate custom telemetry schemas
- **Multi-Platform Support** - MCU, Raspberry Pi, and server implementations
- **Non-Blocking Storage** - Asynchronous operations for all platforms
- **Multiple Database Support** - SQLite, PostgreSQL, TimescaleDB, InfluxDB
- **Data Compression** - Automatic compression to save storage space
- **Offline Mode** - Local buffering with automatic sync
- **Real-time Monitoring** - WebSocket streaming and live dashboards
- **Security** - TLS/SSL, authentication, encryption at rest

### Platform-Specific Features

#### 🔧 Microcontroller Version
- Non-blocking SD/MicroSD/TF card storage
- FreeRTOS task management
- Minimal memory footprint
- Buffer management for unstable connections
- C/C++ implementation

#### 🍓 Raspberry Pi Version
- Python library/package
- SD card or USB storage
- Web interface for monitoring
- Lightweight database support
- Easy deployment

#### 💻 Server Version (Full-Featured)
- Multiple database backends
- Electron GUI with shadcn/ui
- REST API and GraphQL support
- Advanced analytics and reporting
- Plugin system for extensibility
- Multi-tenant support

## 📁 Project Structure

```
Mqtt-base/
├── microcontroller/     # MCU implementation (C/C++)
├── raspberry/           # Raspberry Pi version (Python)
├── server/             # Full server version (TypeScript/Node.js)
├── shared/             # Shared schema definitions and utilities
├── gui/                # Electron desktop application
├── docs/               # Documentation
└── examples/           # Usage examples
```

## 🛠️ Quick Start

### Microcontroller
See [microcontroller/README.md](microcontroller/README.md)

### Raspberry Pi
```bash
cd raspberry
pip install -r requirements.txt
python -m mqtt_telemetry --config config.yaml
```

### Server
```bash
cd server
npm install
npm run dev
```

### GUI Application
```bash
cd gui
npm install
npm run electron:dev
```

## 📖 Documentation

- [Architecture Overview](docs/ARCHITECTURE.md)
- [Schema Configuration](docs/SCHEMA.md)
- [API Reference](docs/API.md)
- [Deployment Guide](docs/DEPLOYMENT.md)

## 🔧 Configuration

See example configurations in each platform directory:
- `microcontroller/config.example.h`
- `raspberry/config.example.yaml`
- `server/config.example.json`

## 🤝 Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](docs/CONTRIBUTING.md)

## 📄 License

MIT License - see [LICENSE](LICENSE)

## 👤 Author

yayoboy <esoglobine@gmail.com>
