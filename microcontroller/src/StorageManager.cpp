#include "StorageManager.h"
#include <time.h>

StorageManager::StorageManager()
    : sd(nullptr),
      currentFileSize(0),
      maxFileSize(STORAGE_MAX_FILE_SIZE_MB * 1024 * 1024),
      compressionEnabled(STORAGE_COMPRESSION_ENABLED),
      initialized(false),
      lastFlush(0) {

    strncpy(basePath, STORAGE_BASE_PATH, sizeof(basePath) - 1);
    memset(&stats, 0, sizeof(StorageStats));
    memset(currentFileName, 0, sizeof(currentFileName));
}

StorageManager::~StorageManager() {
    end();
}

bool StorageManager::begin(SdFat& sdCard) {
    sd = &sdCard;

    // Ensure base directory exists
    if (!ensureDirectoryExists(basePath)) {
        Serial.println("Failed to create base directory");
        return false;
    }

    // Create initial file
    if (!createNewFile()) {
        Serial.println("Failed to create initial storage file");
        return false;
    }

    initialized = true;
    return true;
}

void StorageManager::end() {
    if (currentFile) {
        currentFile.flush();
        currentFile.close();
    }
    initialized = false;
}

bool StorageManager::writeMessage(const char* topic, const char* payload,
                                  unsigned long timestamp) {
    if (!initialized || !currentFile) {
        return false;
    }

    // Check if file rotation is needed
    if (currentFileSize >= maxFileSize) {
        if (!rotate()) {
            stats.writesFailed++;
            return false;
        }
    }

    // Create JSON line
    char line[2048];
    int len = snprintf(line, sizeof(line),
                      "{\"topic\":\"%s\",\"payload\":%s,\"timestamp\":%lu}\n",
                      topic, payload, timestamp);

    if (len <= 0 || len >= sizeof(line)) {
        stats.writesFailed++;
        return false;
    }

    // Write to file
    size_t written = currentFile.write(line, len);
    if (written != len) {
        stats.writesFailed++;
        return false;
    }

    currentFileSize += written;
    stats.bytesWritten += written;
    stats.writesCompleted++;

    // Periodic flush
    if (millis() - lastFlush > STORAGE_FLUSH_INTERVAL_MS) {
        flush();
    }

    return true;
}

bool StorageManager::writeBatch(const char* topic, const char** payloads, size_t count) {
    if (!initialized) {
        return false;
    }

    bool allSuccess = true;
    for (size_t i = 0; i < count; i++) {
        if (!writeMessage(topic, payloads[i], millis())) {
            allSuccess = false;
        }
    }

    flush();
    return allSuccess;
}

bool StorageManager::flush() {
    if (!currentFile) {
        return false;
    }

    currentFile.flush();
    lastFlush = millis();
    return true;
}

bool StorageManager::rotate() {
    // Close current file
    if (currentFile) {
        currentFile.flush();
        currentFile.close();
    }

    // Create new file
    return createNewFile();
}

bool StorageManager::createNewFile() {
    if (!sd) {
        return false;
    }

    String fileName = generateFileName();
    snprintf(currentFileName, sizeof(currentFileName), "%s/%s",
            basePath, fileName.c_str());

    currentFile = sd->open(currentFileName, FILE_WRITE);
    if (!currentFile) {
        Serial.print("Failed to create file: ");
        Serial.println(currentFileName);
        return false;
    }

    currentFileSize = 0;
    stats.filesCreated++;

    Serial.print("Created new storage file: ");
    Serial.println(currentFileName);

    // Cleanup old files
    cleanupOldFiles();

    return true;
}

String StorageManager::generateFileName() {
    char buffer[64];
    time_t now = time(nullptr);
    struct tm* timeinfo = localtime(&now);

    snprintf(buffer, sizeof(buffer), "%s_%04d%02d%02d_%02d%02d%02d%s",
            STORAGE_FILE_PREFIX,
            timeinfo->tm_year + 1900,
            timeinfo->tm_mon + 1,
            timeinfo->tm_mday,
            timeinfo->tm_hour,
            timeinfo->tm_min,
            timeinfo->tm_sec,
            STORAGE_FILE_EXTENSION);

    return String(buffer);
}

bool StorageManager::ensureDirectoryExists(const char* path) {
    if (!sd) {
        return false;
    }

    if (sd->exists(path)) {
        return true;
    }

    return sd->mkdir(path);
}

void StorageManager::cleanupOldFiles() {
    // TODO: Implement cleanup of files older than DATA_RETENTION_DAYS
    // This would require directory listing and file timestamp checking
}

uint64_t StorageManager::getFreeSpace() {
    if (!sd) {
        return 0;
    }
    return sd->vol()->freeClusterCount() * sd->vol()->bytesPerCluster();
}

uint64_t StorageManager::getTotalSpace() {
    if (!sd) {
        return 0;
    }
    return sd->vol()->clusterCount() * sd->vol()->bytesPerCluster();
}

StorageStats StorageManager::getStats() {
    return stats;
}

void StorageManager::setCompressionEnabled(bool enabled) {
    compressionEnabled = enabled;
}

void StorageManager::setMaxFileSize(size_t sizeMB) {
    maxFileSize = sizeMB * 1024 * 1024;
}

void StorageManager::setBasePath(const char* path) {
    strncpy(basePath, path, sizeof(basePath) - 1);
}
