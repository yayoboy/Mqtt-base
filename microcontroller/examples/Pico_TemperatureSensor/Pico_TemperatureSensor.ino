/*
 * Temperature Sensor Example for RP2040 (Raspberry Pi Pico W)
 *
 * This example demonstrates using the MqttTelemetryStorage library
 * with a DHT22 temperature/humidity sensor on Raspberry Pi Pico W.
 *
 * Hardware Required:
 * - Raspberry Pi Pico W
 * - DHT22 temperature/humidity sensor
 * - SD card module (SPI)
 *
 * Connections:
 * DHT22:
 *   VCC  -> 3.3V
 *   DATA -> GPIO 15
 *   GND  -> GND
 *
 * SD Card:
 *   CS   -> GPIO 17
 *   MOSI -> GPIO 19
 *   MISO -> GPIO 16
 *   SCK  -> GPIO 18
 *   VCC  -> 3.3V
 *   GND  -> GND
 */

#include <MqttTelemetry.h>

#ifdef PLATFORM_RP2040
#include <WiFi.h>
#include <DHT.h>

// WiFi credentials
const char* ssid = "your-ssid";
const char* password = "your-password";

// MQTT settings
const char* mqtt_broker = "broker.example.com";
const char* device_id = "PICO001";

// DHT22 sensor
#define DHT_PIN 15
#define DHT_TYPE DHT22
DHT dht(DHT_PIN, DHT_TYPE);

// Telemetry instance
MqttTelemetry telemetry;

// Variables
unsigned long lastReading = 0;
const unsigned long readingInterval = 5000; // 5 seconds

void setup() {
    Serial.begin(115200);
    delay(2000);

    Serial.println("\n=== RP2040 Temperature Sensor ===");
    Serial.printf("Device ID: %s\n", device_id);

    // Initialize DHT sensor
    dht.begin();

    // Configure telemetry
    telemetry.setWiFiCredentials(ssid, password);
    telemetry.setMqttBroker(mqtt_broker, 1883);

    // Set custom SD pins for RP2040
    // Already defined in config_platforms.h, but can override here

    // Initialize
    if (!telemetry.begin("/schemas/temperature_sensor.yaml")) {
        Serial.println("Failed to initialize!");
        while(1) {
            digitalWrite(LED_BUILTIN, HIGH);
            delay(100);
            digitalWrite(LED_BUILTIN, LOW);
            delay(100);
        }
    }

    Serial.println("System ready!");
    digitalWrite(LED_BUILTIN, HIGH);
}

void loop() {
    telemetry.update();

    // Read and publish sensor data
    if (millis() - lastReading >= readingInterval) {
        lastReading = millis();

        float temp = dht.readTemperature();
        float humidity = dht.readHumidity();

        if (!isnan(temp) && !isnan(humidity)) {
            // Create JSON payload
            char payload[256];
            snprintf(payload, sizeof(payload),
                    "{\"device_id\":\"%s\",\"temperature\":%.1f,\"humidity\":%.1f,\"timestamp\":%lu}",
                    device_id, temp, humidity, millis());

            // Publish to MQTT
            String topic = "sensors/" + String(device_id) + "/temperature";

            Serial.printf("Publishing: %s\n", payload);

            // The library will automatically validate and store
            // Data is buffered and written to SD card asynchronously

            // Blink LED on reading
            digitalWrite(LED_BUILTIN, LOW);
            delay(50);
            digitalWrite(LED_BUILTIN, HIGH);
        } else {
            Serial.println("Failed to read sensor!");
        }
    }

    // Check buffer status
    if (telemetry.isBufferFull()) {
        Serial.println("WARNING: Buffer full!");
    }

    delay(10);
}

#else
void setup() {
    Serial.begin(115200);
    Serial.println("This example is for RP2040 (Raspberry Pi Pico) only!");
}
void loop() {}
#endif
