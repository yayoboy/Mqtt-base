/*
 * Custom Schema Example
 *
 * This example shows how to use custom schemas without SD card storage.
 * Useful for testing schema validation before deploying.
 */

#include <MqttTelemetry.h>

const char* ssid = "your-ssid";
const char* password = "your-password";
const char* mqtt_broker = "broker.example.com";

MqttTelemetry telemetry;

// Define custom schema in code (no SD card needed for testing)
const char* customSchema = R"({
  "name": "custom_sensor",
  "version": "1.0.0",
  "topic_pattern": "custom/+/data",
  "fields": [
    {
      "name": "sensor_id",
      "type": "string",
      "required": true
    },
    {
      "name": "value",
      "type": "float",
      "required": true,
      "validation": {
        "min": 0,
        "max": 100
      }
    },
    {
      "name": "unit",
      "type": "string",
      "required": false
    }
  ]
})";

void onMessage(const char* topic, const uint8_t* payload, unsigned int length) {
    Serial.print("Message on ");
    Serial.print(topic);
    Serial.print(": ");

    for (unsigned int i = 0; i < length; i++) {
        Serial.print((char)payload[i]);
    }
    Serial.println();
}

void onError(const char* error, int code) {
    Serial.printf("Error [%d]: %s\n", code, error);
}

void setup() {
    Serial.begin(115200);
    delay(2000);

    Serial.println("=== Custom Schema Example ===");

    // Set callbacks
    telemetry.setMessageCallback(onMessage);
    telemetry.setErrorCallback(onError);

    // Configure
    telemetry.setWiFiCredentials(ssid, password);
    telemetry.setMqttBroker(mqtt_broker, 1883);

    // Initialize without SD card schema (will use in-memory validation)
    if (!telemetry.begin()) {
        Serial.println("Failed to initialize!");
        while(1) delay(1000);
    }

    // Load custom schema from string
    if (!telemetry.loadSchema(customSchema)) {
        Serial.println("Failed to load custom schema!");
    } else {
        Serial.println("Custom schema loaded successfully!");
    }

    // Subscribe
    telemetry.subscribe("custom/+/data");

    Serial.println("Ready!");
}

void loop() {
    telemetry.update();

    // Simulate sending test data every 5 seconds
    static unsigned long lastTest = 0;
    if (millis() - lastTest > 5000) {
        lastTest = millis();

        // Test valid message
        const char* validMsg = "{\"sensor_id\":\"SENSOR01\",\"value\":50.5,\"unit\":\"celsius\"}";
        Serial.println("\nTesting valid message:");
        bool valid = telemetry.validateMessage("custom/test/data", validMsg);
        Serial.printf("Validation result: %s\n", valid ? "VALID" : "INVALID");

        // Test invalid message (value out of range)
        const char* invalidMsg = "{\"sensor_id\":\"SENSOR01\",\"value\":150.5}";
        Serial.println("\nTesting invalid message (out of range):");
        valid = telemetry.validateMessage("custom/test/data", invalidMsg);
        Serial.printf("Validation result: %s\n", valid ? "VALID" : "INVALID");

        // Print stats
        TelemetryStats stats = telemetry.getStats();
        Serial.printf("\nValidation errors: %lu\n", stats.validationErrors);
    }

    delay(10);
}
