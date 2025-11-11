#include "SchemaValidator.h"
#include <regex.h>

SchemaValidator::SchemaValidator()
    : fields(nullptr), fieldCount(0), enabled(true), loaded(false) {
    memset(topicPattern, 0, sizeof(topicPattern));
    memset(schemaName, 0, sizeof(schemaName));
    memset(errorMessage, 0, sizeof(errorMessage));
}

SchemaValidator::~SchemaValidator() {
    if (fields) {
        delete[] fields;
    }
}

bool SchemaValidator::loadSchema(const char* schemaPath, SdFat& sd) {
    File file = sd.open(schemaPath);
    if (!file) {
        snprintf(errorMessage, sizeof(errorMessage), "Failed to open schema file: %s", schemaPath);
        return false;
    }

    // Read file content
    size_t fileSize = file.size();
    char* buffer = new char[fileSize + 1];
    if (!buffer) {
        file.close();
        snprintf(errorMessage, sizeof(errorMessage), "Failed to allocate memory for schema");
        return false;
    }

    file.read(buffer, fileSize);
    buffer[fileSize] = '\0';
    file.close();

    bool result = loadSchemaFromJson(buffer);
    delete[] buffer;

    return result;
}

bool SchemaValidator::loadSchemaFromJson(const char* jsonSchema) {
    StaticJsonDocument<4096> doc;
    DeserializationError error = deserializeJson(doc, jsonSchema);

    if (error) {
        snprintf(errorMessage, sizeof(errorMessage), "Schema parse error: %s", error.c_str());
        return false;
    }

    return parseSchema(doc);
}

bool SchemaValidator::parseSchema(JsonDocument& doc) {
    // Get schema name
    if (doc.containsKey("name")) {
        strncpy(schemaName, doc["name"], sizeof(schemaName) - 1);
    }

    // Get topic pattern
    if (doc.containsKey("topic_pattern")) {
        strncpy(topicPattern, doc["topic_pattern"], sizeof(topicPattern) - 1);
    }

    // Parse fields
    if (!doc.containsKey("fields")) {
        snprintf(errorMessage, sizeof(errorMessage), "Schema missing 'fields' array");
        return false;
    }

    JsonArray fieldsArray = doc["fields"].as<JsonArray>();
    fieldCount = fieldsArray.size();

    if (fieldCount == 0) {
        snprintf(errorMessage, sizeof(errorMessage), "Schema has no fields");
        return false;
    }

    // Allocate field array
    if (fields) {
        delete[] fields;
    }
    fields = new FieldSchema[fieldCount];

    // Parse each field
    size_t idx = 0;
    for (JsonObject field : fieldsArray) {
        FieldSchema& fs = fields[idx++];

        strncpy(fs.name, field["name"] | "", sizeof(fs.name) - 1);
        strncpy(fs.type, field["type"] | "string", sizeof(fs.type) - 1);
        fs.required = field["required"] | false;
        fs.autoFill = field["auto_fill"] | false;

        if (field.containsKey("validation")) {
            JsonObject validation = field["validation"];
            fs.minValue = validation["min"] | -INFINITY;
            fs.maxValue = validation["max"] | INFINITY;

            if (validation.containsKey("pattern")) {
                strncpy(fs.pattern, validation["pattern"], sizeof(fs.pattern) - 1);
            }
        } else {
            fs.minValue = -INFINITY;
            fs.maxValue = INFINITY;
            fs.pattern[0] = '\0';
        }
    }

    loaded = true;
    return true;
}

ValidationResult SchemaValidator::validate(const char* topic, const char* payload) {
    if (!enabled || !loaded) {
        return VALIDATION_OK;
    }

    // Check topic pattern
    if (strlen(topicPattern) > 0 && !topicMatches(topic, topicPattern)) {
        snprintf(errorMessage, sizeof(errorMessage), "Topic does not match pattern");
        return VALIDATION_ERROR_PARSE_FAILED;
    }

    // Parse JSON
    StaticJsonDocument<2048> doc;
    DeserializationError error = deserializeJson(doc, payload);

    if (error) {
        snprintf(errorMessage, sizeof(errorMessage), "JSON parse error: %s", error.c_str());
        return VALIDATION_ERROR_PARSE_FAILED;
    }

    return validate(topic, doc);
}

ValidationResult SchemaValidator::validate(const char* topic, JsonDocument& doc) {
    if (!enabled || !loaded) {
        return VALIDATION_OK;
    }

    // Validate each field
    for (size_t i = 0; i < fieldCount; i++) {
        const FieldSchema& fs = fields[i];

        if (!doc.containsKey(fs.name)) {
            if (fs.required && !fs.autoFill) {
                snprintf(errorMessage, sizeof(errorMessage), "Missing required field: %s", fs.name);
                return VALIDATION_ERROR_MISSING_FIELD;
            }
            continue;
        }

        JsonVariant value = doc[fs.name];
        ValidationResult result = validateField(fs.name, value, fs);

        if (result != VALIDATION_OK) {
            return result;
        }
    }

    return VALIDATION_OK;
}

ValidationResult SchemaValidator::validateField(const char* fieldName, JsonVariant value,
                                                const FieldSchema& schema) {
    // Check type
    if (!validateType(value, schema.type)) {
        snprintf(errorMessage, sizeof(errorMessage), "Type mismatch for field: %s", fieldName);
        return VALIDATION_ERROR_TYPE_MISMATCH;
    }

    // Validate numeric ranges
    if (strcmp(schema.type, "integer") == 0 || strcmp(schema.type, "float") == 0 ||
        strcmp(schema.type, "double") == 0) {
        float numValue = value.as<float>();

        if (numValue < schema.minValue || numValue > schema.maxValue) {
            snprintf(errorMessage, sizeof(errorMessage),
                    "Value out of range for field: %s (%.2f not in [%.2f, %.2f])",
                    fieldName, numValue, schema.minValue, schema.maxValue);
            return VALIDATION_ERROR_OUT_OF_RANGE;
        }
    }

    // Validate string patterns
    if (strcmp(schema.type, "string") == 0 && strlen(schema.pattern) > 0) {
        const char* strValue = value.as<const char*>();
        if (!matchesPattern(strValue, schema.pattern)) {
            snprintf(errorMessage, sizeof(errorMessage),
                    "Pattern mismatch for field: %s", fieldName);
            return VALIDATION_ERROR_PATTERN_MISMATCH;
        }
    }

    return VALIDATION_OK;
}

bool SchemaValidator::validateType(JsonVariant value, const char* type) {
    if (strcmp(type, "string") == 0) {
        return value.is<const char*>();
    } else if (strcmp(type, "integer") == 0) {
        return value.is<int>();
    } else if (strcmp(type, "float") == 0 || strcmp(type, "double") == 0) {
        return value.is<float>() || value.is<double>();
    } else if (strcmp(type, "boolean") == 0) {
        return value.is<bool>();
    } else if (strcmp(type, "array") == 0) {
        return value.is<JsonArray>();
    } else if (strcmp(type, "object") == 0) {
        return value.is<JsonObject>();
    }

    return true; // Unknown type, accept
}

bool SchemaValidator::matchesPattern(const char* value, const char* pattern) {
    // Simple pattern matching - for full regex, use regex.h
    // This is a simplified version for embedded systems
    return strstr(value, pattern) != nullptr;
}

bool SchemaValidator::topicMatches(const char* topic, const char* pattern) {
    // MQTT topic matching with wildcards
    // + matches single level
    // # matches multiple levels

    const char* t = topic;
    const char* p = pattern;

    while (*t && *p) {
        if (*p == '#') {
            return true; // # matches everything remaining
        }

        if (*p == '+') {
            // Skip to next /
            while (*t && *t != '/') {
                t++;
            }
            // Skip past + in pattern
            p++;
            continue;
        }

        if (*t != *p) {
            return false;
        }

        t++;
        p++;
    }

    return (*t == '\0' && *p == '\0');
}

const char* SchemaValidator::getErrorMessage() const {
    return errorMessage;
}

bool SchemaValidator::isEnabled() const {
    return enabled;
}

void SchemaValidator::setEnabled(bool en) {
    enabled = en;
}
