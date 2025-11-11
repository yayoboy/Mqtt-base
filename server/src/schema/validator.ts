/**
 * Schema Validator
 */

import { readdir, readFile } from 'fs/promises';
import { join, extname } from 'path';
import * as yaml from 'js-yaml';
import Ajv, { ValidateFunction } from 'ajv';
import { SchemaConfig } from '../config';
import { logger } from '../utils/logger';

export interface ValidationResult {
  valid: boolean;
  error?: string;
  errors?: string[];
}

export interface Schema {
  name: string;
  version: string;
  topicPattern?: string;
  fields: any[];
  [key: string]: any;
}

export class SchemaValidator {
  private schemas: Map<string, Schema> = new Map();
  private topicPatterns: Map<string, string> = new Map();
  private ajv: Ajv;
  private validators: Map<string, ValidateFunction> = new Map();

  constructor(private config: SchemaConfig) {
    this.ajv = new Ajv({ allErrors: true });
  }

  async initialize(): Promise<void> {
    if (!this.config.validationEnabled) {
      logger.info('Schema validation disabled');
      return;
    }

    await this.loadSchemas();
    logger.info(`Loaded ${this.schemas.size} schemas`);
  }

  private async loadSchemas(): Promise<void> {
    try {
      const files = await readdir(this.config.path, { recursive: true });

      for (const file of files) {
        const fullPath = join(this.config.path, file.toString());
        const ext = extname(fullPath);

        if (['.yaml', '.yml', '.json'].includes(ext)) {
          try {
            await this.loadSchema(fullPath);
          } catch (error) {
            logger.error(`Failed to load schema ${fullPath}`, error);
          }
        }
      }
    } catch (error) {
      logger.error('Failed to load schemas', error);
    }
  }

  private async loadSchema(filePath: string): Promise<void> {
    const content = await readFile(filePath, 'utf-8');

    let schema: Schema;

    if (filePath.endsWith('.json')) {
      schema = JSON.parse(content);
    } else {
      schema = yaml.load(content) as Schema;
    }

    this.addSchema(schema);
  }

  addSchema(schema: Schema): void {
    this.schemas.set(schema.name, schema);

    if (schema.topicPattern) {
      this.topicPatterns.set(schema.topicPattern, schema.name);
    }

    // Create AJV validator
    const ajvSchema = this.convertToAjvSchema(schema);
    const validator = this.ajv.compile(ajvSchema);
    this.validators.set(schema.name, validator);

    logger.debug(`Added schema: ${schema.name}`);
  }

  private convertToAjvSchema(schema: Schema): any {
    // Convert our schema format to JSON Schema
    const properties: any = {};
    const required: string[] = [];

    for (const field of schema.fields) {
      properties[field.name] = {
        type: this.mapFieldType(field.type),
      };

      if (field.required && !field.autoFill) {
        required.push(field.name);
      }

      // Add validation rules
      if (field.validation) {
        if (field.validation.min !== undefined) {
          properties[field.name].minimum = field.validation.min;
        }
        if (field.validation.max !== undefined) {
          properties[field.name].maximum = field.validation.max;
        }
        if (field.validation.pattern) {
          properties[field.name].pattern = field.validation.pattern;
        }
        if (field.validation.enum) {
          properties[field.name].enum = field.validation.enum;
        }
      }
    }

    return {
      type: 'object',
      properties,
      required,
      additionalProperties: schema.validation?.allowExtraFields ?? false,
    };
  }

  private mapFieldType(type: string): string {
    const typeMap: Record<string, string> = {
      integer: 'integer',
      float: 'number',
      double: 'number',
      string: 'string',
      boolean: 'boolean',
      array: 'array',
      object: 'object',
      timestamp: 'string',
    };

    return typeMap[type] || 'string';
  }

  async validate(topic: string, payload: string): Promise<ValidationResult> {
    if (!this.config.validationEnabled) {
      return { valid: true };
    }

    try {
      // Find matching schema
      const schema = this.findSchemaForTopic(topic);

      if (!schema) {
        // No schema found
        if (this.config.strictMode) {
          return {
            valid: false,
            error: `No schema found for topic: ${topic}`,
          };
        }
        return { valid: true };
      }

      // Parse payload
      let data: any;
      try {
        data = JSON.parse(payload);
      } catch {
        return {
          valid: false,
          error: 'Invalid JSON payload',
        };
      }

      // Validate with AJV
      const validator = this.validators.get(schema.name);
      if (!validator) {
        return { valid: true };
      }

      const valid = validator(data);

      if (!valid && validator.errors) {
        const errors = validator.errors.map(err =>
          `${err.instancePath} ${err.message}`
        );

        return {
          valid: this.config.strictMode ? false : true,
          error: errors.join('; '),
          errors,
        };
      }

      return { valid: true };

    } catch (error) {
      logger.error('Validation error', error);
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private findSchemaForTopic(topic: string): Schema | undefined {
    for (const [pattern, schemaName] of this.topicPatterns.entries()) {
      if (this.topicMatchesPattern(topic, pattern)) {
        return this.schemas.get(schemaName);
      }
    }
    return undefined;
  }

  private topicMatchesPattern(topic: string, pattern: string): boolean {
    // Convert MQTT wildcards to regex
    const regexPattern = pattern
      .replace(/\+/g, '[^/]+')
      .replace(/#/g, '.*');

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(topic);
  }

  getSchema(name: string): Schema | undefined {
    return this.schemas.get(name);
  }

  listSchemas(): Schema[] {
    return Array.from(this.schemas.values());
  }
}
