# Schema Configuration Guide

## Overview

The MQTT Telemetry System uses a flexible schema system to validate and process incoming telemetry data. Schemas define the structure, data types, validation rules, and storage configuration for your telemetry messages.

## Schema Format

Schemas are defined in YAML or JSON format and shared across all platform implementations.

## Basic Structure

```yaml
name: schema_name
version: 1.0.0
description: Human-readable description
topic_pattern: mqtt/topic/+/pattern
format: json

fields:
  - name: field_name
    type: string
    required: true
    description: Field description

storage:
  table: table_name
  retention: 90d

validation:
  strict: true
```

## Field Types

### Supported Types

| Type      | Description          | Example                  |
|-----------|----------------------|--------------------------|
| string    | Text data            | "sensor_01"              |
| integer   | Whole numbers        | 42                       |
| float     | Decimal numbers      | 23.5                     |
| double    | Double precision     | 3.14159265359            |
| boolean   | True/False           | true                     |
| timestamp | ISO 8601 datetime    | "2024-01-01T12:00:00Z"   |
| array     | List of values       | [1, 2, 3]                |
| object    | Nested object        | {"key": "value"}         |
| binary    | Binary data (base64) | "SGVsbG8="               |

### Field Configuration

```yaml
fields:
  - name: temperature
    type: float
    required: true
    unit: celsius
    description: Temperature reading
    default: 20.0
    auto_fill: false
    validation:
      min: -50
      max: 100
```

## Validation Rules

### Numeric Validation

```yaml
- name: temperature
  type: float
  validation:
    min: -50        # Minimum value
    max: 100        # Maximum value
```

### String Validation

```yaml
- name: device_id
  type: string
  validation:
    pattern: "^[A-Z0-9]{8}$"  # Regex pattern
    min_length: 8
    max_length: 8
```

### Enum Validation

```yaml
- name: status
  type: string
  validation:
    enum: ["active", "idle", "error"]
```

## Computed Fields

Computed fields are calculated from other fields:

```yaml
computed_fields:
  - name: temperature_fahrenheit
    type: float
    expression: "(temperature * 9/5) + 32"
    description: Temperature in Fahrenheit

  - name: power
    type: float
    expression: "voltage * current"
    description: Power in watts
```

### Expression Syntax

Supported operations:
- Arithmetic: `+`, `-`, `*`, `/`, `^` (power)
- Functions: `sqrt()`, `abs()`, `ceil()`, `floor()`
- Field references: Use field names directly

## Topic Patterns

### MQTT Wildcards

- `+` - Single level wildcard
- `#` - Multi-level wildcard

```yaml
# Match: sensors/temp01/temperature
topic_pattern: "sensors/+/temperature"

# Match: sensors/temp01/data, sensors/temp01/data/raw
topic_pattern: "sensors/+/data/#"

# Match: vehicles/truck01/gps
topic_pattern: "vehicles/+/gps"
```

## Storage Configuration

```yaml
storage:
  table: temperature_readings
  retention: 90d            # Keep data for 90 days
  compression: true         # Enable compression
  index:                    # Database indexes
    - device_id
    - timestamp
  aggregations:
    - interval: 5m          # 5 minute aggregation
      functions: [avg, min, max]
    - interval: 1h          # 1 hour aggregation
      functions: [avg, min, max, stddev]
    - interval: 1d          # 1 day aggregation
      functions: [avg, min, max, stddev, sum]
```

### Retention Formats

- `d` - days (e.g., `90d`)
- `w` - weeks (e.g., `12w`)
- `m` - months (e.g., `6m`)
- `y` - years (e.g., `2y`)

### Aggregation Intervals

- `s` - seconds (e.g., `30s`)
- `m` - minutes (e.g., `5m`)
- `h` - hours (e.g., `1h`)
- `d` - days (e.g., `1d`)

### Aggregation Functions

- `avg` - Average
- `min` - Minimum
- `max` - Maximum
- `sum` - Sum
- `count` - Count
- `stddev` - Standard deviation
- `median` - Median
- `percentile` - Percentile (e.g., p95)

## Validation Configuration

```yaml
validation:
  strict: true              # Reject invalid messages
  allow_extra_fields: false # Allow fields not in schema
  coerce_types: true        # Try to convert types automatically
```

## Complete Example: Temperature Sensor

```yaml
name: temperature_sensor
version: 1.0.0
description: Temperature and humidity sensor telemetry
topic_pattern: sensors/+/temperature
format: json

fields:
  - name: device_id
    type: string
    required: true
    description: Unique device identifier
    validation:
      pattern: "^[A-Z0-9]{8}$"

  - name: temperature
    type: float
    required: true
    unit: celsius
    description: Temperature reading
    validation:
      min: -50
      max: 100

  - name: humidity
    type: float
    required: false
    unit: percent
    description: Relative humidity
    validation:
      min: 0
      max: 100

  - name: pressure
    type: float
    required: false
    unit: hPa
    description: Atmospheric pressure
    validation:
      min: 800
      max: 1200

  - name: timestamp
    type: timestamp
    required: true
    auto_fill: true
    description: Measurement timestamp

  - name: battery_level
    type: integer
    required: false
    unit: percent
    validation:
      min: 0
      max: 100

computed_fields:
  - name: temperature_fahrenheit
    type: float
    expression: "(temperature * 9/5) + 32"
    description: Temperature in Fahrenheit

  - name: heat_index
    type: float
    expression: "temperature + (0.5 * humidity / 100 * (temperature - 14.4))"
    description: Calculated heat index

  - name: dew_point
    type: float
    expression: "temperature - ((100 - humidity) / 5)"
    description: Approximate dew point

storage:
  table: temperature_readings
  retention: 90d
  compression: true
  index:
    - device_id
    - timestamp
  aggregations:
    - interval: 5m
      functions: [avg, min, max]
    - interval: 1h
      functions: [avg, min, max, stddev]
    - interval: 1d
      functions: [avg, min, max, stddev, sum]

validation:
  strict: true
  allow_extra_fields: false
  coerce_types: true
```

## Complete Example: GPS Tracker

```yaml
name: gps_tracker
version: 2.0.0
description: GPS tracking telemetry for vehicles
topic_pattern: vehicles/+/gps
format: json

fields:
  - name: vehicle_id
    type: string
    required: true
    description: Vehicle identifier

  - name: latitude
    type: double
    required: true
    unit: degrees
    validation:
      min: -90
      max: 90

  - name: longitude
    type: double
    required: true
    unit: degrees
    validation:
      min: -180
      max: 180

  - name: altitude
    type: float
    required: false
    unit: meters

  - name: speed
    type: float
    required: true
    unit: km/h
    validation:
      min: 0
      max: 300

  - name: heading
    type: float
    required: false
    unit: degrees
    validation:
      min: 0
      max: 360

  - name: satellites
    type: integer
    required: false
    description: Number of GPS satellites

  - name: accuracy
    type: float
    required: false
    unit: meters
    description: Position accuracy

  - name: timestamp
    type: timestamp
    required: true
    auto_fill: true

computed_fields:
  - name: speed_mph
    type: float
    expression: "speed * 0.621371"
    description: Speed in miles per hour

  - name: speed_ms
    type: float
    expression: "speed / 3.6"
    description: Speed in meters per second

storage:
  table: gps_positions
  retention: 180d
  compression: true
  index:
    - vehicle_id
    - timestamp
  aggregations:
    - interval: 1m
      functions: [avg]
    - interval: 5m
      functions: [avg, max]

validation:
  strict: true
  allow_extra_fields: true
  coerce_types: true
```

## Schema Loading

### Microcontroller

```cpp
telemetry.loadSchema("/schemas/temperature_sensor.yaml");
```

### Raspberry Pi

```python
from mqtt_telemetry import SchemaValidator

validator = SchemaValidator(schema_path="../shared/schemas")
```

### Server

```typescript
const validator = new SchemaValidator({
  path: '../shared/schemas',
  validationEnabled: true
});
```

## Best Practices

1. **Versioning**: Always version your schemas
2. **Backward Compatibility**: Avoid breaking changes
3. **Required Fields**: Mark only truly essential fields as required
4. **Auto-Fill**: Use auto_fill for timestamp fields
5. **Units**: Always specify units for physical quantities
6. **Validation**: Add reasonable min/max values
7. **Description**: Document all fields
8. **Testing**: Test schemas with sample data
9. **Retention**: Set appropriate retention policies
10. **Indexing**: Index frequently queried fields

## Schema Evolution

When updating schemas:

1. Increment version number
2. Add new optional fields (don't make existing fields required)
3. Don't remove required fields
4. Don't change field types
5. Use computed fields for transformations
6. Document changes in description

## Troubleshooting

### Message Rejected

Check:
- Field names match exactly
- Types are correct
- Required fields are present
- Values are within validation ranges

### Performance Issues

- Add indexes to frequently queried fields
- Use appropriate retention policies
- Enable compression for large messages
- Use aggregations instead of raw data queries
