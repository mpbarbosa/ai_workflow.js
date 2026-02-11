/**
 * @fileoverview CLI Config Command
 * @module cli/commands/config
 *
 * Implements the 'config' command for managing workflow configuration.
 *
 * Architecture: v2.0.0 Pattern
 * - Pure functions for config operations
 * - Impure wrapper for file I/O
 *
 * @version 1.0.0
 * @since 2026-02-10
 */

import chalk from 'chalk';
import { logger } from '../../core/logger.js';
import { Config } from '../../lib/config.js';

// ============================================================================
// PURE FUNCTIONS - Config Operations
// ============================================================================

/**
 * Validate config command action
 * @pure
 * @param {string} action - Action to perform
 * @param {Array<string>} args - Additional arguments
 * @returns {Object} Validation result
 */
export function validateConfigAction(action, args) {
  const errors = [];
  const validActions = ['show', 'validate', 'get', 'set'];

  if (!validActions.includes(action)) {
    errors.push(`Invalid action: ${action}. Valid actions: ${validActions.join(', ')}`);
  }

  if (action === 'get' && args.length !== 1) {
    errors.push('get action requires exactly one argument: key');
  }

  if (action === 'set' && args.length !== 2) {
    errors.push('set action requires exactly two arguments: key value');
  }

  return {
    isValid: errors.length === 0,
    errors,
    action,
  };
}

/**
 * Get nested config value by key path
 * @pure
 * @param {Object} config - Configuration object
 * @param {string} keyPath - Dot-separated key path (e.g., 'project.name')
 * @returns {*} Config value or undefined
 */
export function getConfigValue(config, keyPath) {
  if (!config || !keyPath) {
    return undefined;
  }

  const keys = keyPath.split('.');
  let value = config;

  for (const key of keys) {
    if (value && typeof value === 'object' && key in value) {
      value = value[key];
    } else {
      return undefined;
    }
  }

  return value;
}

/**
 * Format config value for display
 * @pure
 * @param {*} value - Config value
 * @returns {string} Formatted value
 */
export function formatConfigValue(value) {
  if (value === null || value === undefined) {
    return chalk.gray('(not set)');
  }

  if (typeof value === 'object') {
    return JSON.stringify(value, null, 2);
  }

  return String(value);
}

/**
 * Format validation errors
 * @pure
 * @param {Array<Object>} errors - Validation errors
 * @returns {string} Formatted error list
 */
export function formatValidationErrors(errors) {
  if (!errors || errors.length === 0) {
    return 'No errors';
  }

  const lines = ['Validation errors:'];
  errors.forEach((err, index) => {
    lines.push(`  ${index + 1}. ${err.path || 'config'}: ${err.message}`);
  });

  return lines.join('\n');
}

// ============================================================================
// IMPURE WRAPPER - Command Execution
// ============================================================================

/**
 * Execute the config show action
 * @param {Config} configManager - Config manager instance
 * @param {Object} options - Command options
 * @returns {Promise<void>}
 */
async function showConfig(configManager, options) {
  try {
    const config = configManager.getAll();

    console.log();
    console.log(chalk.cyan.bold('Current Configuration'));
    console.log(chalk.gray('─'.repeat(60)));
    console.log();
    console.log(JSON.stringify(config, null, 2));
    console.log();

    if (options.verbose) {
      console.log(chalk.gray(`Config file: ${configManager.configPath}`));
      console.log();
    }
  } catch (error) {
    throw new Error(`Failed to show config: ${error.message}`);
  }
}

/**
 * Execute the config validate action
 * @param {Config} configManager - Config manager instance
 * @returns {Promise<void>}
 */
async function validateConfig(configManager) {
  try {
    const result = configManager.validate();

    console.log();
    if (result.isValid) {
      console.log(chalk.green('✓ Configuration is valid'));
    } else {
      console.log(chalk.red('✗ Configuration has errors:'));
      console.log();
      console.log(formatValidationErrors(result.errors));
    }
    console.log();

    process.exit(result.isValid ? 0 : 1);
  } catch (error) {
    throw new Error(`Failed to validate config: ${error.message}`);
  }
}

/**
 * Execute the config get action
 * @param {Config} configManager - Config manager instance
 * @param {string} key - Config key to get
 * @returns {Promise<void>}
 */
async function getConfigKey(configManager, key) {
  try {
    const config = configManager.getAll();
    const value = getConfigValue(config, key);

    console.log();
    if (value === undefined) {
      console.log(chalk.yellow(`Key not found: ${key}`));
    } else {
      console.log(formatConfigValue(value));
    }
    console.log();
  } catch (error) {
    throw new Error(`Failed to get config value: ${error.message}`);
  }
}

/**
 * Execute the config set action
 * @param {Config} configManager - Config manager instance
 * @param {string} key - Config key to set
 * @param {string} value - Config value to set
 * @returns {Promise<void>}
 */
async function setConfigKey(configManager, key, value) {
  try {
    // Parse value if it looks like JSON
    let parsedValue = value;
    if (value.startsWith('{') || value.startsWith('[')) {
      try {
        parsedValue = JSON.parse(value);
      } catch {
        // Keep as string if not valid JSON
      }
    } else if (value === 'true' || value === 'false') {
      parsedValue = value === 'true';
    } else if (!isNaN(value)) {
      parsedValue = Number(value);
    }

    configManager.set(key, parsedValue);

    console.log();
    console.log(chalk.green(`✓ Set ${key} = ${formatConfigValue(parsedValue)}`));
    console.log();
  } catch (error) {
    throw new Error(`Failed to set config value: ${error.message}`);
  }
}

/**
 * Execute the config command
 * @param {string} action - Action to perform (show, validate, get, set)
 * @param {Array<string>} args - Additional arguments
 * @param {Object} options - Command options
 * @returns {Promise<void>}
 */
export async function configCommand(action, args, options) {
  try {
    // Validate action
    const validation = validateConfigAction(action, args);
    if (!validation.isValid) {
      logger.error(chalk.red('Invalid action:'));
      validation.errors.forEach((err) => logger.error(chalk.red(`  - ${err}`)));
      process.exit(1);
    }

    // Display banner
    console.log();
    console.log(chalk.blue('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    console.log(chalk.blue('  Configuration'));
    console.log(chalk.blue('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));

    // Load config
    const configPath = options.config || '.workflow-config.yaml';
    const configManager = new Config(configPath);

    // Execute action
    switch (action) {
      case 'show':
        await showConfig(configManager, options);
        break;
      case 'validate':
        await validateConfig(configManager);
        break;
      case 'get':
        await getConfigKey(configManager, args[0]);
        break;
      case 'set':
        await setConfigKey(configManager, args[0], args[1]);
        break;
      default:
        throw new Error(`Unknown action: ${action}`);
    }

    process.exit(0);
  } catch (error) {
    logger.error(chalk.red(`Error: ${error.message}`));
    if (options.verbose && error.stack) {
      logger.error(chalk.gray(error.stack));
    }
    process.exit(1);
  }
}

export default {
  configCommand,
  validateConfigAction,
  getConfigValue,
  formatConfigValue,
  formatValidationErrors,
};
