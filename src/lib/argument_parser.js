/**
 * Argument Parser Module (Pure Functions + Wrapper)
 * @version 2.0.0
 * @description CLI argument parsing with referential transparency
 * @module lib/argument_parser
 * Part of: AI Workflow Automation v1.1.0
 */

import { logger } from '../core/logger.js';
import { ValidationError } from '../utils/errors.js';

/**
 * PURE FUNCTIONS - All referentially transparent
 */

/**
 * Parse raw arguments array (PURE)
 * @param {string[]} args - Raw argument array
 * @returns {Object} Parsed arguments { flags, options, positional }
 */
export function parseArguments(args) {
  if (!Array.isArray(args)) {
    return { flags: [], options: {}, positional: [] };
  }

  const result = {
    flags: [],
    options: {},
    positional: [],
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    // Long flag: --flag or --flag=value
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');
      if (value !== undefined) {
        result.options[key] = value;
      } else if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
        result.options[key] = args[++i];
      } else {
        result.flags.push(key);
      }
    }
    // Short flag: -f or -f value
    else if (arg.startsWith('-') && arg.length > 1) {
      const flags = arg.slice(1).split('');
      for (let j = 0; j < flags.length; j++) {
        const flag = flags[j];
        // Last flag might have a value
        if (j === flags.length - 1 && i + 1 < args.length && !args[i + 1].startsWith('-')) {
          result.options[flag] = args[++i];
        } else {
          result.flags.push(flag);
        }
      }
    }
    // Positional argument
    else {
      result.positional.push(arg);
    }
  }

  return result;
}

/**
 * Validate parsed arguments against schema (PURE)
 * @param {Object} parsed - Parsed arguments
 * @param {Object} schema - Validation schema
 * @returns {Object} { valid: boolean, errors: string[] }
 */
export function validateArguments(parsed, schema) {
  const errors = [];

  if (!schema || typeof schema !== 'object') {
    return { valid: true, errors: [] };
  }

  // Validate required flags
  if (schema.flags) {
    for (const [name, config] of Object.entries(schema.flags)) {
      if (config.required && !parsed.flags.includes(name)) {
        errors.push(`Required flag missing: --${name}`);
      }
    }
  }

  // Validate required options
  if (schema.options) {
    for (const [name, config] of Object.entries(schema.options)) {
      const value = parsed.options[name];

      if (config.required && value === undefined) {
        errors.push(`Required option missing: --${name}`);
      }

      if (value !== undefined && config.type) {
        const typeError = validateType(value, config.type, name);
        if (typeError) {
          errors.push(typeError);
        }
      }

      if (value !== undefined && config.choices) {
        if (!config.choices.includes(value)) {
          errors.push(`Invalid value for --${name}: must be one of ${config.choices.join(', ')}`);
        }
      }
    }
  }

  // Validate positional arguments
  if (schema.positional) {
    const required = schema.positional.filter((p) => p.required);
    if (parsed.positional.length < required.length) {
      errors.push(`Expected at least ${required.length} positional argument(s)`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate value type (PURE)
 * @param {*} value - Value to validate
 * @param {string} type - Expected type
 * @param {string} name - Argument name
 * @returns {string|null} Error message or null
 */
export function validateType(value, type, name) {
  switch (type) {
    case 'string':
      if (typeof value !== 'string') {
        return `--${name} must be a string`;
      }
      break;
    case 'number':
      if (isNaN(Number(value))) {
        return `--${name} must be a number`;
      }
      break;
    case 'boolean':
      if (value !== 'true' && value !== 'false') {
        return `--${name} must be true or false`;
      }
      break;
    case 'integer':
      if (!Number.isInteger(Number(value))) {
        return `--${name} must be an integer`;
      }
      break;
  }
  return null;
}

/**
 * Coerce values to specified types (PURE)
 * @param {Object} parsed - Parsed arguments
 * @param {Object} schema - Validation schema
 * @returns {Object} Arguments with coerced types
 */
export function coerceTypes(parsed, schema) {
  if (!schema || !schema.options) {
    return parsed;
  }

  const result = { ...parsed, options: { ...parsed.options } };

  for (const [name, config] of Object.entries(schema.options)) {
    const value = result.options[name];
    if (value === undefined || !config.type) {
      continue;
    }

    switch (config.type) {
      case 'number':
      case 'integer':
        result.options[name] = Number(value);
        break;
      case 'boolean':
        result.options[name] = value === 'true' || value === true;
        break;
      // string remains as-is
    }
  }

  return result;
}

/**
 * Apply default values (PURE)
 * @param {Object} parsed - Parsed arguments
 * @param {Object} schema - Validation schema
 * @returns {Object} Arguments with defaults applied
 */
export function applyDefaults(parsed, schema) {
  if (!schema || !schema.options) {
    return parsed;
  }

  const result = { ...parsed, options: { ...parsed.options } };

  for (const [name, config] of Object.entries(schema.options)) {
    if (result.options[name] === undefined && config.default !== undefined) {
      result.options[name] = config.default;
    }
  }

  return result;
}

/**
 * Generate help text from schema (PURE)
 * @param {Object} schema - Argument schema
 * @param {string} programName - Program name
 * @returns {string} Formatted help text
 */
export function generateHelpText(schema, programName = 'program') {
  const lines = [];

  // Usage line
  let usage = `Usage: ${programName}`;
  if (schema.options) {
    usage += ' [options]';
  }
  if (schema.positional) {
    schema.positional.forEach((pos) => {
      usage += pos.required ? ` <${pos.name}>` : ` [${pos.name}]`;
    });
  }
  lines.push(usage);
  lines.push('');

  // Description
  if (schema.description) {
    lines.push(schema.description);
    lines.push('');
  }

  // Positional arguments
  if (schema.positional && schema.positional.length > 0) {
    lines.push('Arguments:');
    schema.positional.forEach((pos) => {
      const required = pos.required ? '(required)' : '(optional)';
      lines.push(`  ${pos.name.padEnd(20)} ${pos.description || ''} ${required}`);
    });
    lines.push('');
  }

  // Options
  if (schema.options) {
    lines.push('Options:');
    for (const [name, config] of Object.entries(schema.options)) {
      let optLine = '  ';
      if (config.alias) {
        optLine += `-${config.alias}, `;
      }
      optLine += `--${name}`;
      if (config.type && config.type !== 'boolean') {
        optLine += ` <${config.type}>`;
      }
      optLine = optLine.padEnd(30);
      optLine += config.description || '';
      if (config.default !== undefined) {
        optLine += ` (default: ${config.default})`;
      }
      lines.push(optLine);
    }
    lines.push('');
  }

  // Flags
  if (schema.flags) {
    lines.push('Flags:');
    for (const [name, config] of Object.entries(schema.flags)) {
      let flagLine = '  ';
      if (config.alias) {
        flagLine += `-${config.alias}, `;
      }
      flagLine += `--${name}`;
      flagLine = flagLine.padEnd(30);
      flagLine += config.description || '';
      lines.push(flagLine);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Normalize aliases to full names (PURE)
 * @param {Object} parsed - Parsed arguments
 * @param {Object} schema - Validation schema
 * @returns {Object} Arguments with aliases normalized
 */
export function normalizeAliases(parsed, schema) {
  if (!schema) {
    return parsed;
  }

  const result = {
    flags: [...parsed.flags],
    options: { ...parsed.options },
    positional: [...parsed.positional],
  };

  // Map aliases to full names for options
  if (schema.options) {
    for (const [name, config] of Object.entries(schema.options)) {
      if (config.alias && result.options[config.alias] !== undefined) {
        result.options[name] = result.options[config.alias];
        delete result.options[config.alias];
      }
    }
  }

  // Map aliases to full names for flags
  if (schema.flags) {
    for (const [name, config] of Object.entries(schema.flags)) {
      if (config.alias) {
        const aliasIndex = result.flags.indexOf(config.alias);
        if (aliasIndex !== -1) {
          result.flags[aliasIndex] = name;
        }
      }
    }
  }

  return result;
}

/**
 * IMPURE WRAPPER CLASS - Handles I/O and side effects
 */

export class ArgumentParser {
  constructor(schema, options = {}) {
    this.schema = schema || {};
    this.programName = options.programName || 'program';
    this.verbose = options.verbose || false;
  }

  /**
   * Parse command line arguments
   * @param {string[]} args - Arguments to parse (defaults to process.argv.slice(2))
   * @returns {Object} Parsed and validated arguments
   * @throws {ValidationError} If validation fails
   */
  parse(args = process.argv.slice(2)) {
    try {
      if (this.verbose) {
        logger.debug(`Parsing arguments: ${args.join(' ')}`);
      }

      // Parse raw arguments
      let parsed = parseArguments(args);

      // Normalize aliases
      parsed = normalizeAliases(parsed, this.schema);

      // Apply defaults
      parsed = applyDefaults(parsed, this.schema);

      // Coerce types
      parsed = coerceTypes(parsed, this.schema);

      // Validate
      const validation = validateArguments(parsed, this.schema);
      if (!validation.valid) {
        throw new ValidationError(validation.errors.join('\n'));
      }

      // Check for help flag
      if (parsed.flags.includes('help') || parsed.flags.includes('h')) {
        this.showHelp();
        process.exit(0);
      }

      if (this.verbose) {
        logger.success('Arguments parsed successfully');
      }

      return parsed;
    } catch (error) {
      if (error instanceof ValidationError) {
        logger.error('Argument validation failed:');
        logger.error(error.message);
        this.showHelp();
        process.exit(1);
        return; // Prevent re-throw if process.exit is mocked
      }
      throw error;
    }
  }

  /**
   * Display help text
   */
  showHelp() {
    const helpText = generateHelpText(this.schema, this.programName);
    console.log(helpText);
  }

  /**
   * Add help flag to schema
   * @returns {ArgumentParser} This parser for chaining
   */
  withHelp() {
    if (!this.schema.flags) {
      this.schema.flags = {};
    }
    this.schema.flags.help = {
      alias: 'h',
      description: 'Display this help message',
    };
    return this;
  }

  /**
   * Set program name
   * @param {string} name - Program name
   * @returns {ArgumentParser} This parser for chaining
   */
  setProgramName(name) {
    this.programName = name;
    return this;
  }

  /**
   * Validate arguments without parsing
   * @param {Object} parsed - Parsed arguments
   * @returns {boolean} True if valid
   * @throws {ValidationError} If validation fails
   */
  validate(parsed) {
    const validation = validateArguments(parsed, this.schema);
    if (!validation.valid) {
      throw new ValidationError(validation.errors.join('\n'));
    }
    return true;
  }
}
