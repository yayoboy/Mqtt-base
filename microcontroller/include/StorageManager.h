#ifndef STORAGE_MANAGER_H
#define STORAGE_MANAGER_H

#include <Arduino.h>
#include <SdFat.h>
#include "config.h"

struct StorageStats {
    uint32_t filesCreated;
    uint32_t writesCompleted;
    uint32_t writesFailed;
    uint64_t bytesWritten;
    uint32_t compressionRatio;
};

class StorageManager {
public:
    StorageManager();
    ~StorageManager();

    bool begin(SdFat& sd);
    void end();

    bool writeMessage(const char* topic, const char* payload, unsigned long timestamp);
    bool writeBatch(const char* topic, const char** payloads, size_t count);

    bool flush();
    bool rotate();

    uint64_t getFreeSpace();
    uint64_t getTotalSpace();
    StorageStats getStats();

    void setCompressionEnabled(bool enabled);
    void setMaxFileSize(size_t sizeMB);
    void setBasePath(const char* path);

private:
    bool createNewFile();
    bool ensureDirectoryExists(const char* path);
    bool compressData(const char* input, char* output, size_t* outputSize);
    String generateFileName();
    void cleanupOldFiles();

    SdFat* sd;
    File currentFile;

    char basePath[128];
    char currentFileName[256];
    size_t currentFileSize;
    size_t maxFileSize;

    bool compressionEnabled;
    bool initialized;

    StorageStats stats;
    unsigned long lastFlush;
};

#endif // STORAGE_MANAGER_H
