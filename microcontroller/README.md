# MQTT Telemetry - Microcontroller Version

Non-blocking MQTT telemetry storage for microcontrollers with SD card support.

## Features

- Non-blocking SD/MicroSD/TF card writes
- FreeRTOS task-based architecture
- Minimal memory footprint (< 50KB RAM)
- Circular buffer for unstable connections
- Schema validation
- Data compression (optional)
- Battery-efficient operation

## Supported Platforms

- ESP32 / ESP32-S3 / ESP32-C3
- STM32 series (with FreeRTOS)
- Arduino (limited features)
- Raspberry Pi Pico W

## Hardware Requirements

- Microcontroller with at least 512KB flash, 100KB RAM
- SD card module (SPI interface)
- MQTT connectivity (WiFi/Ethernet/Cellular)

## Dependencies

- FreeRTOS
- PubSubClient (MQTT)
- SdFat library
- ArduinoJson (for schema parsing)

## Quick Start

### PlatformIO

```ini
[env:esp32]
platform = espressif32
board = esp32dev
framework = arduino
lib_deps =
    knolleary/PubSubClient
    greiman/SdFat
    bblanchon/ArduinoJson
```

### Configuration

Edit `include/config.h`:

```cpp
#define WIFI_SSID "your-ssid"
#define WIFI_PASSWORD "your-password"
#define MQTT_BROKER "broker.example.com"
#define MQTT_PORT 1883
#define SD_CS_PIN 5
```

### Build and Upload

```bash
cd microcontroller
pio run --target upload
```

## Usage Example

```cpp
#include "MqttTelemetry.h"

MqttTelemetry telemetry;

void setup() {
    telemetry.begin("/schemas/temperature_sensor.yaml");
}

void loop() {
    // Data is automatically stored when received
    telemetry.update();
}
```

## Memory Usage

- Flash: ~200KB
- RAM: ~45KB (with 10KB buffer)
- Stack per task: 4KB

## Performance

- Write speed: ~500 messages/sec (SD card dependent)
- Buffer capacity: Configurable (default 1000 messages)
- Power consumption: ~80mA active, ~15mA sleep

## Configuration Options

See [include/config.h](include/config.h) for all options.

## Troubleshooting

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
