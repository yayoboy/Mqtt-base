#ifndef CONFIG_PLATFORMS_H
#define CONFIG_PLATFORMS_H

// Platform detection and configuration

// ESP32 Family
#if defined(ESP32)
    #define PLATFORM_ESP32
    #include <WiFi.h>
    #include <WiFiClient.h>
    #define HAS_WIFI
    #define HAS_FREERTOS
    #define DEFAULT_SPI_SPEED SD_SCK_MHZ(25)

// ESP32-S3
#elif defined(CONFIG_IDF_TARGET_ESP32S3)
    #define PLATFORM_ESP32S3
    #include <WiFi.h>
    #include <WiFiClient.h>
    #define HAS_WIFI
    #define HAS_FREERTOS
    #define DEFAULT_SPI_SPEED SD_SCK_MHZ(40)

// ESP32-C3
#elif defined(CONFIG_IDF_TARGET_ESP32C3)
    #define PLATFORM_ESP32C3
    #include <WiFi.h>
    #include <WiFiClient.h>
    #define HAS_WIFI
    #define HAS_FREERTOS
    #define DEFAULT_SPI_SPEED SD_SCK_MHZ(25)

// Raspberry Pi Pico / RP2040
#elif defined(ARDUINO_ARCH_RP2040)
    #define PLATFORM_RP2040
    #include <WiFi.h>
    #include <WiFiClient.h>
    #define HAS_WIFI
    #define HAS_FREERTOS  // Pico SDK has FreeRTOS support
    #define DEFAULT_SPI_SPEED SD_SCK_MHZ(20)

    // RP2040 specific
    #ifndef LED_BUILTIN
        #define LED_BUILTIN 25
    #endif

// STM32 Family
#elif defined(STM32F4xx) || defined(STM32F7xx) || defined(STM32H7xx)
    #define PLATFORM_STM32
    #define HAS_FREERTOS
    #define DEFAULT_SPI_SPEED SD_SCK_MHZ(18)

    // STM32 Ethernet support
    #if defined(USE_ETHERNET)
        #include <Ethernet.h>
        #define HAS_ETHERNET
    #endif

// Arduino with Ethernet Shield
#elif defined(ARDUINO_AVR_MEGA2560) || defined(ARDUINO_AVR_UNO)
    #define PLATFORM_AVR
    #include <Ethernet.h>
    #define HAS_ETHERNET
    #define DEFAULT_SPI_SPEED SD_SCK_MHZ(4)

#else
    #warning "Unknown platform - using generic configuration"
    #define PLATFORM_GENERIC
    #define DEFAULT_SPI_SPEED SD_SCK_MHZ(10)
#endif

// FreeRTOS Task Configuration
#ifdef HAS_FREERTOS
    #ifndef MQTT_TASK_STACK_SIZE
        #define MQTT_TASK_STACK_SIZE 4096
    #endif
    #ifndef MQTT_TASK_PRIORITY
        #define MQTT_TASK_PRIORITY 2
    #endif
    #ifndef STORAGE_TASK_STACK_SIZE
        #define STORAGE_TASK_STACK_SIZE 4096
    #endif
    #ifndef STORAGE_TASK_PRIORITY
        #define STORAGE_TASK_PRIORITY 1
    #endif
    #ifndef WATCHDOG_TASK_STACK_SIZE
        #define WATCHDOG_TASK_STACK_SIZE 2048
    #endif
    #ifndef WATCHDOG_TASK_PRIORITY
        #define WATCHDOG_TASK_PRIORITY 3
    #endif
#endif

// Default SD Card Pins
#ifndef SD_CS_PIN
    #if defined(PLATFORM_ESP32)
        #define SD_CS_PIN 5
        #define SD_MOSI_PIN 23
        #define SD_MISO_PIN 19
        #define SD_SCK_PIN 18
    #elif defined(PLATFORM_RP2040)
        #define SD_CS_PIN 17
        #define SD_MOSI_PIN 19
        #define SD_MISO_PIN 16
        #define SD_SCK_PIN 18
    #elif defined(PLATFORM_STM32)
        #define SD_CS_PIN PA4
        #define SD_MOSI_PIN PA7
        #define SD_MISO_PIN PA6
        #define SD_SCK_PIN PA5
    #else
        #define SD_CS_PIN 10
    #endif
#endif

// Memory constraints
#if defined(PLATFORM_AVR)
    #define BUFFER_SIZE 100
    #define MAX_MESSAGE_SIZE 256
#elif defined(PLATFORM_RP2040)
    #define BUFFER_SIZE 2000
    #define MAX_MESSAGE_SIZE 1024
#else
    #define BUFFER_SIZE 1000
    #define MAX_MESSAGE_SIZE 1024
#endif

// Debug output
#if defined(DEBUG_ENABLED)
    #define DEBUG_PRINT(x) Serial.print(x)
    #define DEBUG_PRINTLN(x) Serial.println(x)
    #define DEBUG_PRINTF(x, ...) Serial.printf(x, __VA_ARGS__)
#else
    #define DEBUG_PRINT(x)
    #define DEBUG_PRINTLN(x)
    #define DEBUG_PRINTF(x, ...)
#endif

#endif // CONFIG_PLATFORMS_H
