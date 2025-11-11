"""
Schema validation module
"""

import json
import yaml
from pathlib import Path
from typing import Dict, Any, Optional, List
from dataclasses import dataclass
import jsonschema
from jsonschema import validate, ValidationError
import logging
import re

logger = logging.getLogger(__name__)


@dataclass
class ValidationResult:
    """Result of schema validation"""
    valid: bool
    error: Optional[str] = None
    errors: List[str] = None


class SchemaValidator:
    """Schema validator for telemetry messages"""

    def __init__(self, schema_path: Optional[str] = None, enabled: bool = True):
        self.enabled = enabled
        self.schemas: Dict[str, Dict[str, Any]] = {}
        self.topic_patterns: Dict[str, str] = {}  # topic_pattern -> schema_name

        if schema_path:
            self.load_schemas_from_directory(schema_path)

    def load_schemas_from_directory(self, directory: str):
        """Load all schemas from directory"""
        path = Path(directory)

        if not path.exists():
            logger.warning(f"Schema directory not found: {directory}")
            return

        # Load schema files
        for schema_file in path.rglob("*.yaml"):
            try:
                self.load_schema_file(str(schema_file))
            except Exception as e:
                logger.error(f"Failed to load schema {schema_file}: {e}")

        for schema_file in path.rglob("*.yml"):
            try:
                self.load_schema_file(str(schema_file))
            except Exception as e:
                logger.error(f"Failed to load schema {schema_file}: {e}")

        logger.info(f"Loaded {len(self.schemas)} schemas")

    def load_schema_file(self, file_path: str):
        """Load schema from file"""
        with open(file_path, 'r') as f:
            if file_path.endswith('.json'):
                schema = json.load(f)
            else:
                schema = yaml.safe_load(f)

        self.add_schema(schema)

    def add_schema(self, schema: Dict[str, Any]):
        """Add schema to validator"""
        name = schema.get("name")
        if not name:
            raise ValueError("Schema must have a 'name' field")

        self.schemas[name] = schema

        # Register topic pattern
        if "topic_pattern" in schema:
            self.topic_patterns[schema["topic_pattern"]] = name

        logger.debug(f"Added schema: {name}")

    def validate(self, topic: str, payload: str) -> ValidationResult:
        """
        Validate message against schema

        Args:
            topic: MQTT topic
            payload: Message payload (JSON string)

        Returns:
            ValidationResult
        """
        if not self.enabled:
            return ValidationResult(valid=True)

        try:
            # Parse payload
            data = json.loads(payload)

            # Find matching schema
            schema = self._find_schema_for_topic(topic)
            if not schema:
                logger.debug(f"No schema found for topic: {topic}")
                return ValidationResult(valid=True)

            # Validate fields
            result = self._validate_fields(data, schema)

            return result

        except json.JSONDecodeError as e:
            return ValidationResult(
                valid=False,
                error=f"Invalid JSON: {e}"
            )
        except Exception as e:
            logger.error(f"Validation error: {e}")
            return ValidationResult(
                valid=False,
                error=str(e)
            )

    def _find_schema_for_topic(self, topic: str) -> Optional[Dict[str, Any]]:
        """Find schema matching the topic"""
        for pattern, schema_name in self.topic_patterns.items():
            if self._topic_matches_pattern(topic, pattern):
                return self.schemas.get(schema_name)
        return None

    def _topic_matches_pattern(self, topic: str, pattern: str) -> bool:
        """Check if topic matches MQTT pattern with wildcards"""
        # Convert MQTT wildcards to regex
        # + matches single level
        # # matches multiple levels

        regex_pattern = pattern.replace("+", "[^/]+")
        regex_pattern = regex_pattern.replace("#", ".*")
        regex_pattern = f"^{regex_pattern}$"

        return bool(re.match(regex_pattern, topic))

    def _validate_fields(self, data: Dict[str, Any], schema: Dict[str, Any]) -> ValidationResult:
        """Validate data fields against schema"""
        errors = []

        fields = schema.get("fields", [])
        validation_config = schema.get("validation", {})
        strict = validation_config.get("strict", True)
        allow_extra = validation_config.get("allow_extra_fields", False)

        # Check required fields
        for field_def in fields:
            field_name = field_def["name"]
            required = field_def.get("required", False)
            auto_fill = field_def.get("auto_fill", False)

            if required and not auto_fill and field_name not in data:
                errors.append(f"Missing required field: {field_name}")
                continue

            if field_name not in data:
                continue

            # Validate field value
            value = data[field_name]
            field_errors = self._validate_field_value(value, field_def)
            errors.extend(field_errors)

        # Check for extra fields
        if not allow_extra:
            expected_fields = {f["name"] for f in fields}
            extra_fields = set(data.keys()) - expected_fields

            if extra_fields:
                errors.append(f"Unexpected fields: {', '.join(extra_fields)}")

        if errors:
            return ValidationResult(
                valid=False if strict else True,
                error="; ".join(errors),
                errors=errors
            )

        return ValidationResult(valid=True)

    def _validate_field_value(self, value: Any, field_def: Dict[str, Any]) -> List[str]:
        """Validate individual field value"""
        errors = []
        field_name = field_def["name"]
        field_type = field_def.get("type", "string")

        # Type validation
        type_valid = self._check_type(value, field_type)
        if not type_valid:
            errors.append(f"Type mismatch for {field_name}: expected {field_type}")
            return errors

        # Validation rules
        if "validation" in field_def:
            validation = field_def["validation"]

            # Numeric range
            if "min" in validation:
                if isinstance(value, (int, float)) and value < validation["min"]:
                    errors.append(
                        f"{field_name} below minimum: {value} < {validation['min']}"
                    )

            if "max" in validation:
                if isinstance(value, (int, float)) and value > validation["max"]:
                    errors.append(
                        f"{field_name} above maximum: {value} > {validation['max']}"
                    )

            # String length
            if "min_length" in validation:
                if isinstance(value, str) and len(value) < validation["min_length"]:
                    errors.append(
                        f"{field_name} too short: {len(value)} < {validation['min_length']}"
                    )

            if "max_length" in validation:
                if isinstance(value, str) and len(value) > validation["max_length"]:
                    errors.append(
                        f"{field_name} too long: {len(value)} > {validation['max_length']}"
                    )

            # Pattern matching
            if "pattern" in validation:
                if isinstance(value, str):
                    if not re.match(validation["pattern"], value):
                        errors.append(
                            f"{field_name} does not match pattern: {validation['pattern']}"
                        )

            # Enum values
            if "enum" in validation:
                if value not in validation["enum"]:
                    errors.append(
                        f"{field_name} not in allowed values: {validation['enum']}"
                    )

        return errors

    def _check_type(self, value: Any, expected_type: str) -> bool:
        """Check if value matches expected type"""
        type_map = {
            "string": str,
            "integer": int,
            "float": (float, int),
            "double": (float, int),
            "boolean": bool,
            "array": list,
            "object": dict
        }

        expected_python_type = type_map.get(expected_type)
        if expected_python_type is None:
            return True  # Unknown type, accept

        return isinstance(value, expected_python_type)

    def get_schema(self, name: str) -> Optional[Dict[str, Any]]:
        """Get schema by name"""
        return self.schemas.get(name)

    def list_schemas(self) -> List[str]:
        """List all loaded schema names"""
        return list(self.schemas.keys())
