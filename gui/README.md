# MQTT Telemetry GUI

Desktop application for MQTT Telemetry System built with Electron, React, and shadcn/ui.

## Features

- **Real-time Dashboard**: Live telemetry monitoring with interactive charts
- **Schema Management**: Create, edit, and manage telemetry schemas visually
- **Data Explorer**: Query and analyze historical data
- **Connection Management**: Configure and monitor MQTT connections
- **Export Tools**: Export data in multiple formats (CSV, JSON, Excel)
- **Dark Mode**: Beautiful dark and light themes
- **Cross-Platform**: Runs on Windows, macOS, and Linux

## Development

### Prerequisites

- Node.js 18+
- npm or yarn

### Setup

```bash
cd gui
npm install
```

### Run in Development

```bash
npm run electron:dev
```

This will start both the Vite dev server and Electron.

### Build for Production

```bash
npm run electron:build
```

This creates platform-specific installers in the `release` directory.

## Project Structure

```
gui/
├── electron/          # Electron main process
│   ├── main.ts       # Main entry point
│   └── preload.ts    # Preload script
├── src/              # React application
│   ├── components/   # React components
│   ├── lib/          # Utilities
│   ├── hooks/        # Custom hooks
│   ├── stores/       # State management (Zustand)
│   ├── App.tsx       # Main app component
│   └── main.tsx      # React entry point
├── package.json
└── vite.config.ts
```

## Key Technologies

- **Electron**: Cross-platform desktop framework
- **React 18**: UI library
- **shadcn/ui**: Component library built on Radix UI
- **Tailwind CSS**: Utility-first CSS framework
- **Recharts**: Charts and data visualization
- **Zustand**: State management
- **Vite**: Build tool and dev server

## Components

### Dashboard
Real-time monitoring with:
- Live telemetry charts
- System statistics
- Connection status
- Buffer and storage metrics

### Schema Manager
Visual schema editor:
- Create/edit schemas
- Field validation rules
- Import/export schemas
- Live preview

### Data Explorer
Query interface:
- Time range selection
- Topic filtering
- Data visualization
- Export functionality

### Settings
Configuration panel:
- MQTT broker settings
- Database configuration
- UI preferences
- Plugin management

## Screenshots

(Screenshots will be added here)

## License

MIT
