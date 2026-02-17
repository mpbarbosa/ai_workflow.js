/**
 * @fileoverview JQ Wrapper Module - Safe JSON operations with jq command
 * @module lib/jq_wrapper
 * @version 2.0.0
 * @description
 * Provides safe wrapper for jq command execution with validation, logging,
 * and error handling. Prevents common jq errors like empty --argjson values.
 *
 * Architecture: Pure functions + impure wrapper (v2.0.0)
 * - Pure functions: JSON validation, sanitization, argument parsing
 * - Impure wrapper: JqWrapper class for command execution and I/O
 *
 * Part of: Tests & Documentation Workflow Automation (JavaScript/Node.js)
 * Migrated from: src/workflow/lib/jq_wrapper.sh (v1.0.1)
 */

import { execSync } from 'child_process';
import logger from '../core/logger.js';
import { ExecutionError } from '../utils/errors.js';

// ============================================================================
// PURE FUNCTIONS - Exported for testing and reuse
// ============================================================================

/**
 * Validate if a string is well-formed JSON
 * @pure
 * @param {string} jsonString - JSON string to validate
 * @returns {boolean} True if valid JSON, false otherwise
 * @example
 * validateJson('{"foo": "bar"}') // true
 * validateJson('{invalid}') // false
 * validateJson('') // false
 */
function validateJson(jsonString) {
  if (typeof jsonString !== 'string' || jsonString.trim() === '') {
    return false;
  }

  try {
    JSON.parse(jsonString);
    return true;
  } catch {
    return false;
  }
}

/**
 * Sanitize a value for use with jq --argjson flag
 * Ensures value is a valid JSON primitive (number, boolean, null, or object/array)
 * @pure
 * @param {*} value - Value to sanitize
 * @param {*} defaultValue - Default value if sanitization fails (default: 0)
 * @returns {number|boolean|null|string} Sanitized JSON primitive
 * @example
 * sanitizeArgjsonValue(42) // 42
 * sanitizeArgjsonValue('true') // true
 * sanitizeArgjsonValue('invalid', 0) // 0
 * sanitizeArgjsonValue({foo: 'bar'}) // '{"foo":"bar"}'
 */
function sanitizeArgjsonValue(value, defaultValue = 0) {
  // Handle null/undefined
  if (value === null) return null;
  if (value === undefined) return defaultValue;

  // Handle booleans
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;

  // Handle numbers
  if (typeof value === 'number') {
    return isNaN(value) || !isFinite(value) ? defaultValue : value;
  }

  // Handle string numbers
  if (typeof value === 'string') {
    const trimmed = value.trim();

    // Boolean strings
    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;
    if (trimmed === 'null') return null;

    // Empty string
    if (trimmed === '') return defaultValue;

    // Number strings
    const num = Number(trimmed);
    if (!isNaN(num) && isFinite(num)) return num;

    // Try to parse as JSON (object/array)
    try {
      return JSON.parse(trimmed);
    } catch {
      // Invalid - return default
      return defaultValue;
    }
  }

  // Handle objects/arrays - stringify them
  if (typeof value === 'object') {
    try {
      return JSON.parse(JSON.stringify(value)); // Deep clone and validate
    } catch {
      return defaultValue;
    }
  }

  // Unknown type
  return defaultValue;
}

/**
 * Parse jq command arguments to extract --argjson pairs
 * @pure
 * @param {string[]} args - jq command arguments
 * @returns {Object} Object with { argjsonPairs: Array<{name, value}>, otherArgs: string[] }
 * @example
 * parseJqArguments(['--argjson', 'count', '5', '.foo'])
 * // { argjsonPairs: [{name: 'count', value: '5'}], otherArgs: ['.foo'] }
 */
function parseJqArguments(args) {
  const argjsonPairs = [];
  const otherArgs = [];
  let i = 0;

  while (i < args.length) {
    const arg = args[i];

    if (arg === '--argjson') {
      // Next two args are variable name and value
      const name = args[i + 1];
      const value = args[i + 2];

      if (name !== undefined && value !== undefined) {
        argjsonPairs.push({ name, value });
        i += 3; // Skip flag, name, and value
      } else {
        // Missing name or value - treat as other arg
        otherArgs.push(arg);
        i++;
      }
    } else {
      otherArgs.push(arg);
      i++;
    }
  }

  return { argjsonPairs, otherArgs };
}

/**
 * Validate --argjson argument pairs
 * @pure
 * @param {Array<{name: string, value: string}>} argjsonPairs - Parsed --argjson pairs
 * @returns {Object} Object with { valid: boolean, errors: string[] }
 * @example
 * validateArgjsonPairs([{name: 'count', value: '5'}])
 * // { valid: true, errors: [] }
 * validateArgjsonPairs([{name: 'count', value: ''}])
 * // { valid: false, errors: ['--argjson variable "count" has empty value'] }
 */
function validateArgjsonPairs(argjsonPairs) {
  const errors = [];

  for (const { name, value } of argjsonPairs) {
    // Check for empty value
    if (value === '' || value === null || value === undefined) {
      errors.push(`--argjson variable "${name}" has empty value`);
      continue;
    }

    // Basic JSON validation (must be: number, string, boolean, null, object, or array)
    const trimmedValue = String(value).trim();
    const jsonPrimitivePattern = /^(-?\d+\.?\d*|".*"|true|false|null|\{.*\}|\[.*\])$/;

    if (!jsonPrimitivePattern.test(trimmedValue)) {
      errors.push(`--argjson variable "${name}" value "${value}" may not be valid JSON`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Build jq command string from arguments
 * @pure
 * @param {string[]} args - jq command arguments
 * @returns {string} Command string
 * @example
 * buildJqCommand(['-n', '--arg', 'name', 'test', '{name: $name}'])
 * // 'jq -n --arg name test {name: $name}'
 */
function buildJqCommand(args) {
  // Escape arguments that contain spaces or special characters
  const escapedArgs = args.map((arg) => {
    if (typeof arg !== 'string') arg = String(arg);

    // If arg contains spaces or special chars, quote it
    if (/[\s'"$`\\]/.test(arg)) {
      return `'${arg.replace(/'/g, "'\\''")}'`; // Escape single quotes
    }
    return arg;
  });

  return `jq ${escapedArgs.join(' ')}`;
}

// ============================================================================
// IMPURE WRAPPER CLASS - Side effects isolated here
// ============================================================================

/**
 * JqWrapper - Safe jq command execution with validation and logging
 * @class
 * @description
 * Wraps jq command execution with:
 * - Argument validation (prevents empty --argjson)
 * - Debug logging (when enabled)
 * - Clear error messages with context
 * - Graceful error handling
 */
class JqWrapper {
  /**
   * Create a JqWrapper instance
   * @param {Object} options - Configuration options
   * @param {boolean} [options.debug=false] - Enable debug logging
   * @param {string} [options.callerContext='unknown'] - Caller context for logging
   */
  constructor(options = {}) {
    this.debug = options.debug || false;
    this.callerContext = options.callerContext || 'unknown';
  }

  /**
   * Execute jq command with validation
   * @param {string[]} args - jq command arguments
   * @param {Object} options - Execution options
   * @param {boolean} [options.throwOnError=true] - Throw error on validation failure
   * @returns {string} jq command output
   * @throws {ExecutionError} If validation fails and throwOnError is true
   * @example
   * const wrapper = new JqWrapper({ debug: true });
   * const result = wrapper.execute(['-n', '--argjson', 'count', '5', '{count: $count}']);
   */
  execute(args, options = {}) {
    const throwOnError = options.throwOnError !== false;

    // Log entry
    if (this.debug) {
      logger.debug(`jq_safe called from: ${this.callerContext}`);
      logger.debug(`Arguments: ${args.join(' ')}`);
    }

    // Parse arguments
    const { argjsonPairs } = parseJqArguments(args);

    // Validate --argjson arguments
    const validation = validateArgjsonPairs(argjsonPairs);

    if (!validation.valid) {
      const errorMsg = `jq_safe validation failed in ${this.callerContext}:\n${validation.errors.map((e) => `  - ${e}`).join('\n')}`;

      logger.error(errorMsg);

      if (throwOnError) {
        const error = new ExecutionError(errorMsg);
        error.code = 'JQ_VALIDATION_ERROR';
        error.context = this.callerContext;
        throw error;
      }

      return '';
    }

    // Check if jq is available
    try {
      execSync('which jq', { stdio: 'ignore' });
    } catch {
      const errorMsg = 'jq command not found';
      logger.error(errorMsg);

      if (throwOnError) {
        const error = new ExecutionError(errorMsg);
        error.code = 'JQ_NOT_FOUND';
        error.context = this.callerContext;
        throw error;
      }

      return '';
    }

    // Build and execute command
    const command = buildJqCommand(args);

    try {
      const result = execSync(command, {
        encoding: 'utf8',
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      });

      if (this.debug) {
        logger.debug(`jq_safe completed successfully in ${this.callerContext}`);
      }

      return result;
    } catch (error) {
      const errorMsg = `jq_safe failed in ${this.callerContext}: ${error.message}`;
      logger.error(errorMsg);

      if (throwOnError) {
        const error = new ExecutionError(errorMsg);
        error.code = 'JQ_EXECUTION_ERROR';
        error.context = this.callerContext;
        throw error;
      }

      return '';
    }
  }

  /**
   * Execute jq command and parse result as JSON
   * @param {string[]} args - jq command arguments
   * @param {Object} options - Execution options
   * @returns {*} Parsed JSON result
   * @throws {ExecutionError} If execution or parsing fails
   * @example
   * const wrapper = new JqWrapper();
   * const obj = wrapper.executeAndParse(['-n', '{foo: "bar"}']);
   * // { foo: 'bar' }
   */
  executeAndParse(args, options = {}) {
    const result = this.execute(args, options);

    try {
      return JSON.parse(result);
    } catch (parseError) {
      const errorMsg = `Failed to parse jq output as JSON: ${parseError.message}`;
      logger.error(errorMsg);

      const error = new ExecutionError(errorMsg);
      error.code = 'JQ_PARSE_ERROR';
      error.context = this.callerContext;
      error.output = result;
      throw error;
    }
  }

  /**
   * Validate JSON string using jq
   * @param {string} jsonString - JSON string to validate
   * @returns {boolean} True if valid, false otherwise
   * @example
   * const wrapper = new JqWrapper();
   * wrapper.validateJsonWithJq('{"foo": "bar"}') // true
   * wrapper.validateJsonWithJq('{invalid}') // false
   */
  validateJsonWithJq(jsonString) {
    try {
      // Use stdin to avoid command injection
      execSync('jq -e . >/dev/null 2>&1', {
        input: jsonString,
        stdio: ['pipe', 'ignore', 'ignore'],
        shell: '/bin/bash',
      });
      return true;
    } catch {
      return false;
    }
  }
}

// ============================================================================
// MODULE EXPORTS
// ============================================================================

export {
  // Pure functions
  validateJson,
  sanitizeArgjsonValue,
  parseJqArguments,
  validateArgjsonPairs,
  buildJqCommand,
  // Impure wrapper
  JqWrapper,
};
