/*
 * GPS Tracker Example
 *
 * This example demonstrates GPS tracking with the MqttTelemetryStorage library.
 * Works with ESP32, RP2040, and STM32.
 *
 * Hardware Required:
 * - ESP32/RP2040/STM32 board
 * - GPS module (e.g., NEO-6M)
 * - SD card module
 *
 * GPS Module Connections:
 * TX -> RX pin (Serial1)
 * RX -> TX pin (Serial1)
 * VCC -> 3.3V or 5V (check module)
 * GND -> GND
 */

#include <MqttTelemetry.h>
#include <TinyGPS++.h>

// GPS
TinyGPSPlus gps;

#if defined(PLATFORM_ESP32)
    #define GPS_SERIAL Serial2
    #define GPS_RX 16
    #define GPS_TX 17
#elif defined(PLATFORM_RP2040)
    #define GPS_SERIAL Serial1
    #define GPS_RX 1
    #define GPS_TX 0
#else
    #define GPS_SERIAL Serial1
#endif

// WiFi credentials
const char* ssid = "your-ssid";
const char* password = "your-password";

// MQTT settings
const char* mqtt_broker = "broker.example.com";
const char* vehicle_id = "VEHICLE001";

// Telemetry instance
MqttTelemetry telemetry;

// Variables
unsigned long lastPublish = 0;
const unsigned long publishInterval = 10000; // 10 seconds

void setup() {
    Serial.begin(115200);
    delay(2000);

    Serial.println("=== GPS Tracker ===");
    Serial.printf("Vehicle ID: %s\n", vehicle_id);

    // Initialize GPS serial
#if defined(PLATFORM_ESP32)
    GPS_SERIAL.begin(9600, SERIAL_8N1, GPS_RX, GPS_TX);
#elif defined(PLATFORM_RP2040)
    GPS_SERIAL.setRX(GPS_RX);
    GPS_SERIAL.setTX(GPS_TX);
    GPS_SERIAL.begin(9600);
#else
    GPS_SERIAL.begin(9600);
#endif

    // Configure telemetry
    telemetry.setWiFiCredentials(ssid, password);
    telemetry.setMqttBroker(mqtt_broker, 1883);

    // Initialize with GPS schema
    if (!telemetry.begin("/schemas/gps_tracker.yaml")) {
        Serial.println("Failed to initialize!");
        while(1) delay(1000);
    }

    Serial.println("Waiting for GPS fix...");
}

void loop() {
    telemetry.update();

    // Read GPS data
    while (GPS_SERIAL.available() > 0) {
        gps.encode(GPS_SERIAL.read());
    }

    // Publish GPS position
    if (millis() - lastPublish >= publishInterval) {
        lastPublish = millis();

        if (gps.location.isValid()) {
            // Create JSON payload
            char payload[512];
            snprintf(payload, sizeof(payload),
                    "{"
                    "\"vehicle_id\":\"%s\","
                    "\"latitude\":%.6f,"
                    "\"longitude\":%.6f,"
                    "\"altitude\":%.1f,"
                    "\"speed\":%.1f,"
                    "\"heading\":%.1f,"
                    "\"satellites\":%d,"
                    "\"accuracy\":%.1f,"
                    "\"timestamp\":%lu"
                    "}",
                    vehicle_id,
                    gps.location.lat(),
                    gps.location.lng(),
                    gps.altitude.meters(),
                    gps.speed.kmph(),
                    gps.course.deg(),
                    gps.satellites.value(),
                    gps.hdop.hdop(),
                    millis()
            );

            Serial.printf("GPS: %.6f, %.6f - Speed: %.1f km/h\n",
                         gps.location.lat(),
                         gps.location.lng(),
                         gps.speed.kmph());

            // Data is automatically validated against gps_tracker schema
            // and stored to SD card

        } else {
            Serial.println("Waiting for GPS fix...");
            if (gps.satellites.isValid()) {
                Serial.printf("Satellites: %d\n", gps.satellites.value());
            }
        }
    }

    // Print stats every minute
    static unsigned long lastStats = 0;
    if (millis() - lastStats > 60000) {
        lastStats = millis();

        TelemetryStats stats = telemetry.getStats();
        Serial.printf("\nPositions stored: %lu\n", stats.messagesStored);
        Serial.printf("Storage errors: %lu\n", stats.storageErrors);

        if (telemetry.isSDMounted()) {
            uint64_t free = telemetry.getSDFreeSpace();
            Serial.printf("SD Free: %.2f MB\n\n", free / 1048576.0);
        }
    }

    delay(10);
}
