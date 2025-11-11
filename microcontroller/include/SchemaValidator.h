#ifndef SCHEMA_VALIDATOR_H
#define SCHEMA_VALIDATOR_H

#include <Arduino.h>
#include <ArduinoJson.h>
#include <SdFat.h>

enum ValidationResult {
    VALIDATION_OK,
    VALIDATION_ERROR_MISSING_FIELD,
    VALIDATION_ERROR_TYPE_MISMATCH,
    VALIDATION_ERROR_OUT_OF_RANGE,
    VALIDATION_ERROR_PATTERN_MISMATCH,
    VALIDATION_ERROR_UNKNOWN_FIELD,
    VALIDATION_ERROR_PARSE_FAILED
};

struct FieldSchema {
    char name[64];
    char type[32];
    bool required;
    bool autoFill;
    float minValue;
    float maxValue;
    char pattern[128];
};

class SchemaValidator {
public:
    SchemaValidator();
    ~SchemaValidator();

    bool loadSchema(const char* schemaPath, SdFat& sd);
    bool loadSchemaFromJson(const char* jsonSchema);

    ValidationResult validate(const char* topic, const char* payload);
    ValidationResult validate(const char* topic, JsonDocument& doc);

    const char* getErrorMessage() const;
    bool isEnabled() const;
    void setEnabled(bool enabled);

    bool topicMatches(const char* topic, const char* pattern);

private:
    bool parseSchema(JsonDocument& doc);
    ValidationResult validateField(const char* fieldName, JsonVariant value, const FieldSchema& schema);
    bool matchesPattern(const char* value, const char* pattern);
    bool validateType(JsonVariant value, const char* type);

    FieldSchema* fields;
    size_t fieldCount;
    char topicPattern[128];
    char schemaName[64];
    char errorMessage[256];
    bool enabled;
    bool loaded;
};

#endif // SCHEMA_VALIDATOR_H
