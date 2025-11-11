#include <Arduino.h>
#include "MqttTelemetry.h"
#include "config.h"

MqttTelemetry telemetry;

// Callback when message is received
void onMessage(const char* topic, const uint8_t* payload, unsigned int length) {
    Serial.print("Message received on topic: ");
    Serial.println(topic);
}

// Callback for errors
void onError(const char* error, int code) {
    Serial.print("Error [");
    Serial.print(code);
    Serial.print("]: ");
    Serial.println(error);
}

void printStats() {
    TelemetryStats stats = telemetry.getStats();

    Serial.println("\n=== Telemetry Statistics ===");
    Serial.printf("Uptime: %lu seconds\n", stats.uptime);
    Serial.printf("Messages Received: %lu\n", stats.messagesReceived);
    Serial.printf("Messages Stored: %lu\n", stats.messagesStored);
    Serial.printf("Messages Dropped: %lu\n", stats.messagesDropped);
    Serial.printf("Validation Errors: %lu\n", stats.validationErrors);
    Serial.printf("Storage Errors: %lu\n", stats.storageErrors);
    Serial.printf("MQTT Reconnects: %lu\n", stats.mqttReconnects);
    Serial.printf("Free Heap: %zu bytes\n", stats.freeHeap);
    Serial.printf("Buffer Usage: %.1f%%\n", stats.bufferUsagePercent);

    if (telemetry.isSDMounted()) {
        uint64_t freeSpace = telemetry.getSDFreeSpace();
        uint64_t totalSpace = telemetry.getSDTotalSpace();
        Serial.printf("SD Free Space: %.2f GB / %.2f GB\n",
                      freeSpace / 1073741824.0,
                      totalSpace / 1073741824.0);
    }
    Serial.println("===========================\n");
}

void setup() {
    Serial.begin(DEBUG_SERIAL_SPEED);
    while (!Serial && millis() < 3000); // Wait for serial or timeout

    Serial.println("\n\n=== MQTT Telemetry System ===");
    Serial.println("Version: 1.0.0");
    Serial.println("Platform: " + String(ARDUINO_BOARD));
    Serial.println("============================\n");

    // Set callbacks
    telemetry.setMessageCallback(onMessage);
    telemetry.setErrorCallback(onError);

    // Initialize telemetry system
    Serial.println("Initializing telemetry system...");
    if (!telemetry.begin("/schemas/temperature_sensor.yaml")) {
        Serial.println("Failed to initialize telemetry system!");
        Serial.println("System halted. Please check configuration.");
        while (1) {
            delay(1000);
        }
    }

    Serial.println("Telemetry system initialized successfully!");
    Serial.println("Subscribing to topics...");

    // Subscribe to topics
    telemetry.subscribe("sensors/+/temperature");
    telemetry.subscribe("sensors/+/humidity");
    telemetry.subscribe("vehicles/+/gps");

    Serial.println("System ready!");
}

unsigned long lastStatsReport = 0;
const unsigned long statsInterval = 30000; // 30 seconds

void loop() {
    // Main telemetry update - handles MQTT, storage, etc.
    telemetry.update();

    // Periodic stats reporting
    if (millis() - lastStatsReport > statsInterval) {
        printStats();
        lastStatsReport = millis();
    }

    // Check buffer status
    if (telemetry.isBufferFull()) {
        Serial.println("WARNING: Buffer is full! Consider increasing buffer size or improving storage performance.");
    }

    // Small delay to prevent watchdog issues
    delay(10);
}
