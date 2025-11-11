#include "MqttTelemetry.h"
#include <time.h>

MqttTelemetry::MqttTelemetry()
    : mqttClient(nullptr),
      buffer(nullptr),
      validator(nullptr),
      storage(nullptr),
      status(STATUS_INITIALIZING),
      mqttPort(MQTT_PORT),
      userMessageCallback(nullptr),
      userErrorCallback(nullptr),
      mqttTaskHandle(nullptr),
      storageTaskHandle(nullptr),
      watchdogTaskHandle(nullptr),
      bufferMutex(nullptr),
      statsMutex(nullptr),
      lastReconnectAttempt(0),
      lastHealthCheck(0),
      lastStatsUpdate(0),
      initialized(false),
      sdMounted(false) {

    // Initialize stats
    memset(&stats, 0, sizeof(TelemetryStats));

    // Copy default configuration
    strncpy(wifiSSID, WIFI_SSID, sizeof(wifiSSID) - 1);
    strncpy(wifiPassword, WIFI_PASSWORD, sizeof(wifiPassword) - 1);
    strncpy(mqttBroker, MQTT_BROKER, sizeof(mqttBroker) - 1);
    strncpy(mqttClientId, MQTT_CLIENT_ID, sizeof(mqttClientId) - 1);
    strncpy(mqttUsername, MQTT_USERNAME, sizeof(mqttUsername) - 1);
    strncpy(mqttPassword, MQTT_PASSWORD, sizeof(mqttPassword) - 1);
}

MqttTelemetry::~MqttTelemetry() {
    end();
}

bool MqttTelemetry::begin(const char* schemaPath) {
    if (initialized) {
        return true;
    }

    Serial.println("Starting MQTT Telemetry...");

    // Create mutexes
    bufferMutex = xSemaphoreCreateMutex();
    statsMutex = xSemaphoreCreateMutex();

    if (!bufferMutex || !statsMutex) {
        if (userErrorCallback) {
            userErrorCallback("Failed to create mutexes", -1);
        }
        return false;
    }

    // Initialize circular buffer
    buffer = new CircularBuffer(BUFFER_SIZE);
    if (!buffer) {
        if (userErrorCallback) {
            userErrorCallback("Failed to allocate buffer", -2);
        }
        return false;
    }

    // Initialize validator
    validator = new SchemaValidator();
    if (!validator) {
        if (userErrorCallback) {
            userErrorCallback("Failed to create validator", -3);
        }
        return false;
    }

    // Setup WiFi
    setupWiFi();
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("WiFi connection failed, continuing anyway...");
    }

    // Setup SD card
    setupSD();

    // Load schema if provided
    if (schemaPath && sdMounted) {
        SdFat sd;
        if (sd.begin(SD_CS_PIN, SD_SPI_SPEED)) {
            if (!validator->loadSchema(schemaPath, sd)) {
                Serial.println("Warning: Failed to load schema");
            }
        }
    }

    // Initialize storage manager
    storage = new StorageManager();
    if (!storage) {
        if (userErrorCallback) {
            userErrorCallback("Failed to create storage manager", -4);
        }
        return false;
    }

    // Setup MQTT
    setupMQTT();

    // Create FreeRTOS tasks
    setupTasks();

    initialized = true;
    status = STATUS_RUNNING;

    Serial.println("MQTT Telemetry started successfully");
    return true;
}

void MqttTelemetry::end() {
    if (!initialized) {
        return;
    }

    // Delete tasks
    if (mqttTaskHandle) {
        vTaskDelete(mqttTaskHandle);
        mqttTaskHandle = nullptr;
    }
    if (storageTaskHandle) {
        vTaskDelete(storageTaskHandle);
        storageTaskHandle = nullptr;
    }
    if (watchdogTaskHandle) {
        vTaskDelete(watchdogTaskHandle);
        watchdogTaskHandle = nullptr;
    }

    // Cleanup
    if (mqttClient) {
        mqttClient->disconnect();
        delete mqttClient;
        mqttClient = nullptr;
    }

    if (storage) {
        storage->flush();
        storage->end();
        delete storage;
        storage = nullptr;
    }

    if (buffer) {
        delete buffer;
        buffer = nullptr;
    }

    if (validator) {
        delete validator;
        validator = nullptr;
    }

    // Delete mutexes
    if (bufferMutex) {
        vSemaphoreDelete(bufferMutex);
        bufferMutex = nullptr;
    }
    if (statsMutex) {
        vSemaphoreDelete(statsMutex);
        statsMutex = nullptr;
    }

    WiFi.disconnect();
    initialized = false;
}

void MqttTelemetry::update() {
    // This is called from main loop
    // Most work is done in FreeRTOS tasks
    updateStats();
}

void MqttTelemetry::setupWiFi() {
    Serial.print("Connecting to WiFi: ");
    Serial.println(wifiSSID);

    status = STATUS_WIFI_CONNECTING;
    WiFi.mode(WIFI_STA);
    WiFi.begin(wifiSSID, wifiPassword);

    unsigned long startAttempt = millis();
    while (WiFi.status() != WL_CONNECTED &&
           millis() - startAttempt < WIFI_TIMEOUT_MS) {
        delay(500);
        Serial.print(".");
    }

    if (WiFi.status() == WL_CONNECTED) {
        Serial.println("\nWiFi connected!");
        Serial.print("IP address: ");
        Serial.println(WiFi.localIP());

        // Sync time via NTP
        configTime(NTP_TIMEZONE_OFFSET * 3600, 0, NTP_SERVER);
    } else {
        Serial.println("\nWiFi connection failed!");
        status = STATUS_ERROR;
    }
}

void MqttTelemetry::setupMQTT() {
    mqttClient = new PubSubClient(wifiClient);
    mqttClient->setServer(mqttBroker, mqttPort);
    mqttClient->setKeepAlive(MQTT_KEEPALIVE);
    mqttClient->setBufferSize(MQTT_MAX_PACKET_SIZE);

    // Set callback using lambda
    mqttClient->setCallback([this](char* topic, uint8_t* payload, unsigned int length) {
        this->mqttCallback(topic, payload, length);
    });
}

void MqttTelemetry::setupSD() {
    Serial.println("Initializing SD card...");

    SdFat sd;
    if (sd.begin(SD_CS_PIN, SD_SPI_SPEED)) {
        sdMounted = true;
        Serial.println("SD card initialized");

        if (storage) {
            storage->begin(sd);
        }
    } else {
        Serial.println("SD card initialization failed!");
        status = STATUS_SD_ERROR;
        sdMounted = false;
    }
}

void MqttTelemetry::setupTasks() {
    // Create MQTT task
    xTaskCreate(
        mqttTaskWrapper,
        "MQTT Task",
        MQTT_TASK_STACK_SIZE,
        this,
        MQTT_TASK_PRIORITY,
        &mqttTaskHandle
    );

    // Create Storage task
    xTaskCreate(
        storageTaskWrapper,
        "Storage Task",
        STORAGE_TASK_STACK_SIZE,
        this,
        STORAGE_TASK_PRIORITY,
        &storageTaskHandle
    );

    // Create Watchdog task
    xTaskCreate(
        watchdogTaskWrapper,
        "Watchdog Task",
        WATCHDOG_TASK_STACK_SIZE,
        this,
        WATCHDOG_TASK_PRIORITY,
        &watchdogTaskHandle
    );
}

void MqttTelemetry::mqttTaskWrapper(void* parameter) {
    MqttTelemetry* instance = static_cast<MqttTelemetry*>(parameter);
    instance->mqttTask();
}

void MqttTelemetry::storageTaskWrapper(void* parameter) {
    MqttTelemetry* instance = static_cast<MqttTelemetry*>(parameter);
    instance->storageTask();
}

void MqttTelemetry::watchdogTaskWrapper(void* parameter) {
    MqttTelemetry* instance = static_cast<MqttTelemetry*>(parameter);
    instance->watchdogTask();
}

void MqttTelemetry::mqttTask() {
    while (true) {
        if (!mqttClient->connected()) {
            reconnectMQTT();
        }

        if (mqttClient->connected()) {
            mqttClient->loop();
        }

        vTaskDelay(pdMS_TO_TICKS(MQTT_PROCESS_INTERVAL_MS));
    }
}

void MqttTelemetry::storageTask() {
    while (true) {
        BufferedMessage message;

        if (xSemaphoreTake(bufferMutex, pdMS_TO_TICKS(100)) == pdTRUE) {
            if (!buffer->isEmpty()) {
                if (buffer->pop(message)) {
                    xSemaphoreGive(bufferMutex);

                    // Write to storage
                    if (storage && sdMounted) {
                        if (storage->writeMessage(message.topic, message.payload, message.timestamp)) {
                            if (xSemaphoreTake(statsMutex, pdMS_TO_TICKS(10)) == pdTRUE) {
                                stats.messagesStored++;
                                xSemaphoreGive(statsMutex);
                            }
                        } else {
                            if (xSemaphoreTake(statsMutex, pdMS_TO_TICKS(10)) == pdTRUE) {
                                stats.storageErrors++;
                                xSemaphoreGive(statsMutex);
                            }
                        }
                    }
                } else {
                    xSemaphoreGive(bufferMutex);
                }
            } else {
                xSemaphoreGive(bufferMutex);
            }
        }

        vTaskDelay(pdMS_TO_TICKS(100));
    }
}

void MqttTelemetry::watchdogTask() {
    while (true) {
        checkHealth();
        vTaskDelay(pdMS_TO_TICKS(HEALTH_CHECK_INTERVAL_MS));
    }
}

void MqttTelemetry::mqttCallback(char* topic, uint8_t* payload, unsigned int length) {
    handleMessage(topic, payload, length);
}

void MqttTelemetry::handleMessage(const char* topic, const uint8_t* payload, unsigned int length) {
    if (xSemaphoreTake(statsMutex, pdMS_TO_TICKS(10)) == pdTRUE) {
        stats.messagesReceived++;
        xSemaphoreGive(statsMutex);
    }

    // Call user callback
    if (userMessageCallback) {
        userMessageCallback(topic, payload, length);
    }

    // Validate if enabled
    if (validator && validator->isEnabled()) {
        char payloadStr[length + 1];
        memcpy(payloadStr, payload, length);
        payloadStr[length] = '\0';

        ValidationResult result = validator->validate(topic, payloadStr);
        if (result != VALIDATION_OK) {
            if (xSemaphoreTake(statsMutex, pdMS_TO_TICKS(10)) == pdTRUE) {
                stats.validationErrors++;
                xSemaphoreGive(statsMutex);
            }
            return; // Drop invalid message
        }
    }

    // Add to buffer
    if (xSemaphoreTake(bufferMutex, pdMS_TO_TICKS(100)) == pdTRUE) {
        if (buffer->isFull()) {
            // Buffer full - remove oldest
            buffer->removeOldest();
            if (xSemaphoreTake(statsMutex, pdMS_TO_TICKS(10)) == pdTRUE) {
                stats.messagesDropped++;
                xSemaphoreGive(statsMutex);
            }
        }

        buffer->push(topic, payload, length);
        xSemaphoreGive(bufferMutex);
    }
}

void MqttTelemetry::reconnectMQTT() {
    if (WiFi.status() != WL_CONNECTED) {
        reconnectWiFi();
        return;
    }

    unsigned long now = millis();
    if (now - lastReconnectAttempt < MQTT_RECONNECT_DELAY_MS) {
        return;
    }

    lastReconnectAttempt = now;
    status = STATUS_MQTT_CONNECTING;

    Serial.print("Attempting MQTT connection...");

    bool connected = false;
    if (strlen(mqttUsername) > 0) {
        connected = mqttClient->connect(mqttClientId, mqttUsername, mqttPassword);
    } else {
        connected = mqttClient->connect(mqttClientId);
    }

    if (connected) {
        Serial.println("connected");
        status = STATUS_RUNNING;

        if (xSemaphoreTake(statsMutex, pdMS_TO_TICKS(10)) == pdTRUE) {
            stats.mqttReconnects++;
            xSemaphoreGive(statsMutex);
        }
    } else {
        Serial.print("failed, rc=");
        Serial.println(mqttClient->state());
        status = STATUS_ERROR;
    }
}

void MqttTelemetry::reconnectWiFi() {
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("Reconnecting to WiFi...");
        WiFi.disconnect();
        WiFi.begin(wifiSSID, wifiPassword);
    }
}

void MqttTelemetry::updateStats() {
    if (xSemaphoreTake(statsMutex, pdMS_TO_TICKS(10)) == pdTRUE) {
        stats.uptime = millis() / 1000;
        stats.freeHeap = ESP.getFreeHeap();
        stats.bufferUsagePercent = buffer ? buffer->usagePercent() : 0;
        xSemaphoreGive(statsMutex);
    }
}

void MqttTelemetry::checkHealth() {
    // Check memory
    size_t freeHeap = ESP.getFreeHeap();
    if (freeHeap < (MEMORY_WARNING_THRESHOLD_KB * 1024)) {
        Serial.printf("WARNING: Low memory! Free heap: %zu bytes\n", freeHeap);
    }

    // Check storage
    if (sdMounted) {
        uint64_t freeSpace = getSDFreeSpace() / (1024 * 1024); // MB
        if (freeSpace < STORAGE_WARNING_THRESHOLD_MB) {
            Serial.printf("WARNING: Low storage! Free space: %llu MB\n", freeSpace);
        }
    }

    // Check buffer
    if (buffer && buffer->usagePercent() > 80) {
        Serial.printf("WARNING: Buffer usage high: %.1f%%\n", buffer->usagePercent());
    }
}

bool MqttTelemetry::subscribe(const char* topic, uint8_t qos) {
    if (mqttClient && mqttClient->connected()) {
        return mqttClient->subscribe(topic, qos);
    }
    return false;
}

TelemetryStatus MqttTelemetry::getStatus() {
    return status;
}

TelemetryStats MqttTelemetry::getStats() {
    TelemetryStats statsCopy;
    if (xSemaphoreTake(statsMutex, pdMS_TO_TICKS(100)) == pdTRUE) {
        statsCopy = stats;
        xSemaphoreGive(statsMutex);
    }
    return statsCopy;
}

bool MqttTelemetry::isConnected() {
    return mqttClient && mqttClient->connected();
}

bool MqttTelemetry::isSDMounted() {
    return sdMounted;
}

uint64_t MqttTelemetry::getSDFreeSpace() {
    if (!sdMounted) return 0;
    SdFat sd;
    if (sd.begin(SD_CS_PIN, SD_SPI_SPEED)) {
        return sd.vol()->freeClusterCount() * sd.vol()->bytesPerCluster();
    }
    return 0;
}

uint64_t MqttTelemetry::getSDTotalSpace() {
    if (!sdMounted) return 0;
    SdFat sd;
    if (sd.begin(SD_CS_PIN, SD_SPI_SPEED)) {
        return sd.vol()->clusterCount() * sd.vol()->bytesPerCluster();
    }
    return 0;
}

bool MqttTelemetry::isBufferFull() {
    return buffer && buffer->isFull();
}

void MqttTelemetry::setMessageCallback(MessageCallback callback) {
    userMessageCallback = callback;
}

void MqttTelemetry::setErrorCallback(ErrorCallback callback) {
    userErrorCallback = callback;
}
