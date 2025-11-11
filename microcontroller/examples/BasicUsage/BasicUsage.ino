/*
 * Basic Usage Example
 *
 * This example demonstrates basic usage of the MqttTelemetryStorage library
 * for ESP32, RP2040 (Raspberry Pi Pico), and STM32.
 *
 * Hardware Required:
 * - ESP32/RP2040/STM32 board
 * - SD card module (SPI)
 * - WiFi/Ethernet connection
 *
 * Connections:
 * SD Card Module -> Board
 * CS   -> Pin defined in config (default: 5 for ESP32, 17 for RP2040)
 * MOSI -> Pin defined in config
 * MISO -> Pin defined in config
 * SCK  -> Pin defined in config
 * VCC  -> 3.3V
 * GND  -> GND
 */

#include <MqttTelemetry.h>

// WiFi credentials (for ESP32/RP2040 with WiFi)
const char* ssid = "your-ssid";
const char* password = "your-password";

// MQTT broker settings
const char* mqtt_broker = "broker.example.com";
const int mqtt_port = 1883;

// Create telemetry instance
MqttTelemetry telemetry;

void setup() {
    Serial.begin(115200);
    delay(2000);

    Serial.println("=== MQTT Telemetry Storage ===");
    Serial.println("Platform: " + String(ARDUINO_BOARD));

    // Configure WiFi
    telemetry.setWiFiCredentials(ssid, password);

    // Configure MQTT
    telemetry.setMqttBroker(mqtt_broker, mqtt_port);

    // Initialize telemetry system
    Serial.println("Initializing...");
    if (!telemetry.begin()) {
        Serial.println("Failed to initialize!");
        while(1) delay(1000);
    }

    Serial.println("Initialized successfully!");

    // Subscribe to topics
    telemetry.subscribe("sensors/+/temperature");
    telemetry.subscribe("sensors/+/humidity");

    Serial.println("Ready to receive data!");
}

void loop() {
    // Update telemetry system (handles MQTT, storage, etc.)
    telemetry.update();

    // Print statistics every 10 seconds
    static unsigned long lastStats = 0;
    if (millis() - lastStats > 10000) {
        lastStats = millis();

        TelemetryStats stats = telemetry.getStats();

        Serial.println("\n=== Statistics ===");
        Serial.printf("Messages Received: %lu\n", stats.messagesReceived);
        Serial.printf("Messages Stored: %lu\n", stats.messagesStored);
        Serial.printf("Messages Dropped: %lu\n", stats.messagesDropped);
        Serial.printf("Buffer Usage: %.1f%%\n", stats.bufferUsagePercent);
        Serial.printf("Free Heap: %zu bytes\n", stats.freeHeap);

        if (telemetry.isSDMounted()) {
            uint64_t free = telemetry.getSDFreeSpace();
            uint64_t total = telemetry.getSDTotalSpace();
            Serial.printf("SD Card: %.2f MB / %.2f MB\n",
                         free / 1048576.0, total / 1048576.0);
        }
        Serial.println("==================\n");
    }

    delay(10);
}
