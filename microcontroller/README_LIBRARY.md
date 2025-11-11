# MqttTelemetryStorage Library

Arduino/PlatformIO library for MQTT telemetry storage with SD card support.

## Features

- 📡 **MQTT Client** with automatic reconnection
- 💾 **Non-blocking SD card storage**
- ✅ **Schema validation** with custom rules
- 🔄 **Circular buffer** for unstable connections
- ⚡ **FreeRTOS tasks** for ESP32 and RP2040
- 🎯 **Multi-platform**: ESP32, RP2040 (Pico), STM32

## Supported Boards

### ESP32 Family
- ESP32
- ESP32-S3
- ESP32-C3

### RP2040 (Raspberry Pi Pico)
- Raspberry Pi Pico
- Raspberry Pi Pico W (with WiFi)

### STM32
- STM32F4xx
- STM32F7xx
- STM32H7xx

### Arduino (Limited features)
- Arduino Mega 2560
- Arduino with Ethernet Shield

## Installation

### Arduino IDE

1. Download the library as ZIP
2. In Arduino IDE: Sketch → Include Library → Add .ZIP Library
3. Select the downloaded ZIP file

### PlatformIO

Add to `platformio.ini`:

```ini
lib_deps =
    https://github.com/yayoboy/Mqtt-base.git#microcontroller
```

Or manually:

```bash
pio lib install "MqttTelemetryStorage"
```

## Quick Start

### Basic Example

```cpp
#include <MqttTelemetry.h>

MqttTelemetry telemetry;

void setup() {
    Serial.begin(115200);

    // Configure WiFi
    telemetry.setWiFiCredentials("ssid", "password");

    // Configure MQTT
    telemetry.setMqttBroker("broker.example.com", 1883);

    // Initialize
    if (!telemetry.begin()) {
        Serial.println("Failed to initialize!");
        while(1);
    }

    // Subscribe to topics
    telemetry.subscribe("sensors/+/temperature");
}

void loop() {
    telemetry.update();
    delay(10);
}
```

### RP2040 (Raspberry Pi Pico W) Example

```cpp
#include <MqttTelemetry.h>
#include <WiFi.h>

MqttTelemetry telemetry;

void setup() {
    Serial.begin(115200);

    // Pico W has built-in WiFi
    telemetry.setWiFiCredentials("ssid", "password");
    telemetry.setMqttBroker("broker.example.com", 1883);

    // SD card pins for Pico (already configured by default)
    // CS=17, MOSI=19, MISO=16, SCK=18

    if (!telemetry.begin("/schemas/temperature_sensor.yaml")) {
        while(1) {
            digitalWrite(LED_BUILTIN, HIGH);
            delay(100);
            digitalWrite(LED_BUILTIN, LOW);
            delay(100);
        }
    }

    telemetry.subscribe("sensors/+/temperature");
}

void loop() {
    telemetry.update();

    // Your sensor reading code here

    delay(10);
}
```

## Hardware Connections

### SD Card Module (SPI)

#### ESP32
```
SD Module → ESP32
CS   → GPIO 5
MOSI → GPIO 23
MISO → GPIO 19
SCK  → GPIO 18
VCC  → 3.3V
GND  → GND
```

#### RP2040 (Raspberry Pi Pico)
```
SD Module → Pico
CS   → GPIO 17
MOSI → GPIO 19
MISO → GPIO 16
SCK  → GPIO 18
VCC  → 3.3V
GND  → GND
```

#### STM32
```
SD Module → STM32
CS   → PA4
MOSI → PA7
MISO → PA6
SCK  → PA5
VCC  → 3.3V
GND  → GND
```

## API Reference

### MqttTelemetry Class

#### Initialization

```cpp
bool begin(const char* schemaPath = nullptr)
```
Initialize the telemetry system.

#### Configuration

```cpp
void setWiFiCredentials(const char* ssid, const char* password)
void setMqttBroker(const char* broker, uint16_t port)
void setMqttCredentials(const char* username, const char* password)
```

#### MQTT Operations

```cpp
bool connect()
void disconnect()
bool isConnected()
bool subscribe(const char* topic, uint8_t qos = 0)
bool unsubscribe(const char* topic)
```

#### Schema Management

```cpp
bool loadSchema(const char* schemaPath)
bool validateMessage(const char* topic, const char* payload)
```

#### Status & Statistics

```cpp
TelemetryStatus getStatus()
TelemetryStats getStats()
void resetStats()
```

#### Storage

```cpp
bool mountSD()
void unmountSD()
bool isSDMounted()
uint64_t getSDFreeSpace()
uint64_t getSDTotalSpace()
void flushBuffer()
```

#### Callbacks

```cpp
typedef void (*MessageCallback)(const char* topic, const uint8_t* payload, unsigned int length);
typedef void (*ErrorCallback)(const char* error, int code);

void setMessageCallback(MessageCallback callback)
void setErrorCallback(ErrorCallback callback)
```

### TelemetryStats Structure

```cpp
struct TelemetryStats {
    uint32_t messagesReceived;
    uint32_t messagesStored;
    uint32_t messagesDropped;
    uint32_t validationErrors;
    uint32_t storageErrors;
    uint32_t mqttReconnects;
    uint32_t uptime;
    size_t freeHeap;
    float bufferUsagePercent;
};
```

## Schema Configuration

Create a schema file on the SD card (e.g., `/schemas/temperature_sensor.yaml`):

```yaml
name: temperature_sensor
version: 1.0.0
topic_pattern: sensors/+/temperature
format: json

fields:
  - name: device_id
    type: string
    required: true

  - name: temperature
    type: float
    required: true
    validation:
      min: -50
      max: 100

  - name: timestamp
    type: timestamp
    required: true
    auto_fill: true

storage:
  file_prefix: temp_data
  max_file_size_mb: 10
  compression: true
```

## Platform-Specific Notes

### ESP32
- Uses WiFi library
- FreeRTOS with 3 tasks (MQTT, Storage, Watchdog)
- ~50KB RAM usage

### RP2040 (Raspberry Pi Pico)
- Pico W has built-in WiFi (CYW43)
- FreeRTOS support via Pico SDK
- Use Arduino-Pico core: https://github.com/earlephilhower/arduino-pico
- ~40KB RAM usage
- Default LED on GPIO 25

### STM32
- Use STM32duino core
- FreeRTOS support
- May need Ethernet shield for network connectivity

## Examples

See the `examples/` folder for complete examples:

- **BasicUsage**: Simple MQTT telemetry storage
- **Pico_TemperatureSensor**: RP2040 with DHT22 sensor
- **GpsTracker**: GPS tracking with NEO-6M
- **CustomSchema**: Custom schema validation

## Troubleshooting

### SD Card Not Detected
- Check wiring connections
- Verify SD card is formatted as FAT32
- Try lower SPI speed
- Check SD card is inserted correctly

### WiFi Connection Failed
- Verify SSID and password
- Check signal strength
- Ensure 2.4GHz network (not 5GHz)

### MQTT Connection Failed
- Verify broker address and port
- Check firewall settings
- Test with MQTT client (mosquitto_sub)

### Buffer Full
- Increase `BUFFER_SIZE` in config
- Reduce message rate
- Check SD card write speed
- Verify storage task is running

### Pico W Specific Issues
- Install Arduino-Pico core (not Arduino-mbed)
- Enable WiFi in Tools → Board menu
- Use latest Pico SDK

## Memory Usage

| Platform | Flash  | RAM   |
|----------|--------|-------|
| ESP32    | ~200KB | ~50KB |
| RP2040   | ~180KB | ~40KB |
| STM32    | ~190KB | ~45KB |

## Performance

| Platform | Throughput | Write Latency |
|----------|------------|---------------|
| ESP32    | 500 msg/s  | 10-50ms      |
| RP2040   | 400 msg/s  | 15-60ms      |
| STM32    | 450 msg/s  | 12-55ms      |

*Performance depends on SD card speed and MQTT message size*

## License

MIT License - see LICENSE file

## Author

yayoboy <esoglobine@gmail.com>

## Links

- GitHub: https://github.com/yayoboy/Mqtt-base
- Issues: https://github.com/yayoboy/Mqtt-base/issues
- Documentation: https://github.com/yayoboy/Mqtt-base/tree/main/docs

## Contributing

Contributions are welcome! Please read CONTRIBUTING.md
