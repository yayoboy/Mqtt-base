#ifndef CONFIG_H
#define CONFIG_H

// WiFi Configuration
#define WIFI_SSID "your-ssid"
#define WIFI_PASSWORD "your-password"
#define WIFI_TIMEOUT_MS 20000

// MQTT Configuration
#define MQTT_BROKER "broker.example.com"
#define MQTT_PORT 1883
#define MQTT_USERNAME ""
#define MQTT_PASSWORD ""
#define MQTT_CLIENT_ID "telemetry-device"
#define MQTT_KEEPALIVE 60
#define MQTT_RECONNECT_DELAY_MS 5000

// TLS/SSL (set to 1 to enable)
#define MQTT_USE_TLS 0
#define MQTT_TLS_INSECURE 0  // Set to 1 to skip certificate verification (not recommended)

// SD Card Configuration
#define SD_CS_PIN 5
#define SD_MOSI_PIN 23
#define SD_MISO_PIN 19
#define SD_SCK_PIN 18
#define SD_SPI_SPEED SD_SCK_MHZ(25)

// Storage Configuration
#define STORAGE_BASE_PATH "/telemetry"
#define STORAGE_FILE_PREFIX "data"
#define STORAGE_FILE_EXTENSION ".jsonl"
#define STORAGE_MAX_FILE_SIZE_MB 10
#define STORAGE_COMPRESSION_ENABLED 1

// Buffer Configuration
#define BUFFER_SIZE 1000
#define BUFFER_HIGH_WATER_MARK 800  // Start aggressive flushing
#define BUFFER_CRITICAL_MARK 950    // Drop oldest messages

// Schema Configuration
#define SCHEMA_PATH "/schemas"
#define SCHEMA_VALIDATION_ENABLED 1
#define SCHEMA_AUTO_DISCOVERY 1

// FreeRTOS Task Configuration
#define MQTT_TASK_STACK_SIZE 4096
#define MQTT_TASK_PRIORITY 2
#define STORAGE_TASK_STACK_SIZE 4096
#define STORAGE_TASK_PRIORITY 1
#define WATCHDOG_TASK_STACK_SIZE 2048
#define WATCHDOG_TASK_PRIORITY 3

// Performance Tuning
#define STORAGE_FLUSH_INTERVAL_MS 5000
#define STORAGE_BATCH_SIZE 50
#define MQTT_PROCESS_INTERVAL_MS 100

// Health Monitoring
#define HEALTH_CHECK_INTERVAL_MS 30000
#define HEALTH_TOPIC "health/status"
#define MEMORY_WARNING_THRESHOLD_KB 50
#define STORAGE_WARNING_THRESHOLD_MB 100

// Debug Configuration
#define DEBUG_ENABLED 1
#define DEBUG_SERIAL_SPEED 115200
#define DEBUG_VERBOSE 0

// Time Synchronization
#define NTP_SERVER "pool.ntp.org"
#define NTP_TIMEZONE_OFFSET 0  // UTC offset in hours
#define NTP_SYNC_INTERVAL_MS 3600000  // 1 hour

// Data Retention
#define DATA_RETENTION_DAYS 30
#define DATA_CLEANUP_HOUR 3  // 3 AM

// Error Handling
#define MAX_RETRIES 3
#define RETRY_BACKOFF_MS 1000
#define ERROR_LED_PIN 2

#endif // CONFIG_H
