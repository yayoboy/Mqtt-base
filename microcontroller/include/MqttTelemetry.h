#ifndef MQTT_TELEMETRY_H
#define MQTT_TELEMETRY_H

#include <Arduino.h>
#include <PubSubClient.h>
#include <WiFi.h>
#include <SdFat.h>
#include <ArduinoJson.h>
#include "config.h"
#include "CircularBuffer.h"
#include "SchemaValidator.h"
#include "StorageManager.h"

enum TelemetryStatus {
    STATUS_INITIALIZING,
    STATUS_WIFI_CONNECTING,
    STATUS_MQTT_CONNECTING,
    STATUS_RUNNING,
    STATUS_ERROR,
    STATUS_BUFFER_FULL,
    STATUS_SD_ERROR
};

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

class MqttTelemetry {
public:
    MqttTelemetry();
    ~MqttTelemetry();

    // Initialization
    bool begin(const char* schemaPath = nullptr);
    void end();

    // Main loop - call regularly
    void update();

    // MQTT Control
    bool connect();
    void disconnect();
    bool isConnected();
    bool subscribe(const char* topic, uint8_t qos = 0);
    bool unsubscribe(const char* topic);

    // Schema Management
    bool loadSchema(const char* schemaPath);
    bool validateMessage(const char* topic, const char* payload);

    // Configuration
    void setWiFiCredentials(const char* ssid, const char* password);
    void setMqttBroker(const char* broker, uint16_t port);
    void setMqttCredentials(const char* username, const char* password);

    // Status and Statistics
    TelemetryStatus getStatus();
    TelemetryStats getStats();
    void resetStats();

    // Buffer Control
    void flushBuffer();
    size_t getBufferSize();
    bool isBufferFull();

    // Storage Management
    bool mountSD();
    void unmountSD();
    bool isSDMounted();
    uint64_t getSDFreeSpace();
    uint64_t getSDTotalSpace();

    // Callbacks
    typedef void (*MessageCallback)(const char* topic, const uint8_t* payload, unsigned int length);
    typedef void (*ErrorCallback)(const char* error, int code);

    void setMessageCallback(MessageCallback callback);
    void setErrorCallback(ErrorCallback callback);

private:
    // Internal methods
    void setupWiFi();
    void setupMQTT();
    void setupSD();
    void setupTasks();

    void mqttCallback(char* topic, uint8_t* payload, unsigned int length);
    void reconnectMQTT();
    void reconnectWiFi();

    static void mqttTaskWrapper(void* parameter);
    static void storageTaskWrapper(void* parameter);
    static void watchdogTaskWrapper(void* parameter);

    void mqttTask();
    void storageTask();
    void watchdogTask();

    void handleMessage(const char* topic, const uint8_t* payload, unsigned int length);
    void updateStats();
    void checkHealth();

    // Member variables
    WiFiClient wifiClient;
    PubSubClient* mqttClient;
    CircularBuffer* buffer;
    SchemaValidator* validator;
    StorageManager* storage;

    TelemetryStatus status;
    TelemetryStats stats;

    char wifiSSID[64];
    char wifiPassword[64];
    char mqttBroker[128];
    uint16_t mqttPort;
    char mqttUsername[64];
    char mqttPassword[64];
    char mqttClientId[64];

    MessageCallback userMessageCallback;
    ErrorCallback userErrorCallback;

    TaskHandle_t mqttTaskHandle;
    TaskHandle_t storageTaskHandle;
    TaskHandle_t watchdogTaskHandle;

    SemaphoreHandle_t bufferMutex;
    SemaphoreHandle_t statsMutex;

    unsigned long lastReconnectAttempt;
    unsigned long lastHealthCheck;
    unsigned long lastStatsUpdate;

    bool initialized;
    bool sdMounted;
};

#endif // MQTT_TELEMETRY_H
