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
// @ts-expect-error - legacy JS module is untyped in the current TypeScript setup.
import { Config } from '../../lib/config.js';

export type ConfigAction = 'show' | 'validate' | 'get' | 'set';

export interface ConfigCommandValidationResult {
  isValid: boolean;
  errors: string[];
  action: string;
}

export interface ConfigValidationIssue {
  path?: string;
  message: string;
}

export interface ConfigCommandOptions {
  config?: string;
  verbose?: boolean;
}

export type ConfigValue =
  | string
  | number
  | boolean
  | null
  | ConfigRecord
  | ConfigValue[];

export interface ConfigRecord {
  [key: string]: ConfigValue | undefined;
}

export interface WorkflowConfigManager {
  configPath: string;
  getAll(): ConfigRecord;
  validate(): {
    isValid: boolean;
    errors: ConfigValidationIssue[];
  };
  set(key: string, value: ConfigValue): void;
}

const VALID_ACTIONS: ConfigAction[] = ['show', 'validate', 'get', 'set'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function createConfigManager(configPath: string): WorkflowConfigManager {
  return new Config(configPath) as unknown as WorkflowConfigManager;
}

function parseConfigInput(value: string): ConfigValue {
  if (value.startsWith('{') || value.startsWith('[')) {
    try {
      return JSON.parse(value) as ConfigValue;
    } catch {
      return value;
    }
  }

  if (value === 'true' || value === 'false') {
    return value === 'true';
  }

  if (!Number.isNaN(Number(value))) {
    return Number(value);
  }

  return value;
}

// ============================================================================
// PURE FUNCTIONS - Config Operations
// ============================================================================

/**
 * Validate config command action.
 */
export function validateConfigAction(
  action: string,
  args: string[]
): ConfigCommandValidationResult {
  const errors: string[] = [];

  if (!VALID_ACTIONS.includes(action as ConfigAction)) {
    errors.push(`Invalid action: ${action}. Valid actions: ${VALID_ACTIONS.join(', ')}`);
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
 * Get nested config value by key path.
 */
export function getConfigValue<T = ConfigValue>(
  config: ConfigRecord | null | undefined,
  keyPath: string
): T | undefined {
  if (!config || !keyPath) {
    return undefined;
  }

  const keys = keyPath.split('.');
  let value: unknown = config;

  for (const key of keys) {
    if (isRecord(value) && key in value) {
      value = value[key];
    } else {
      return undefined;
    }
  }

  return value as T | undefined;
}

/**
 * Format config value for display.
 */
export function formatConfigValue(value: ConfigValue | undefined): string {
  if (value === null || value === undefined) {
    return chalk.gray('(not set)');
  }

  if (typeof value === 'object') {
    return JSON.stringify(value, null, 2);
  }

  return String(value);
}

/**
 * Format validation errors.
 */
export function formatValidationErrors(
  errors: ConfigValidationIssue[] | string[] | null | undefined
): string {
  if (!errors || errors.length === 0) {
    return 'No errors';
  }

  const lines = ['Validation errors:'];
  errors.forEach((error, index) => {
    if (typeof error === 'string') {
      lines.push(`  ${index + 1}. config: ${error}`);
      return;
    }

    lines.push(`  ${index + 1}. ${error.path || 'config'}: ${error.message}`);
  });

  return lines.join('\n');
}

// ============================================================================
// IMPURE WRAPPER - Command Execution
// ============================================================================

/**
 * Execute the config show action.
 */
async function showConfig(
  configManager: WorkflowConfigManager,
  options: ConfigCommandOptions
): Promise<void> {
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
    throw new Error(`Failed to show config: ${getErrorMessage(error)}`, { cause: error });
  }
}

/**
 * Execute the config validate action.
 */
async function validateConfig(configManager: WorkflowConfigManager): Promise<void> {
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
    throw new Error(`Failed to validate config: ${getErrorMessage(error)}`, { cause: error });
  }
}

/**
 * Execute the config get action.
 */
async function getConfigKey(configManager: WorkflowConfigManager, key: string): Promise<void> {
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
    throw new Error(`Failed to get config value: ${getErrorMessage(error)}`, { cause: error });
  }
}

/**
 * Execute the config set action.
 */
async function setConfigKey(
  configManager: WorkflowConfigManager,
  key: string,
  value: string
): Promise<void> {
  try {
    const parsedValue = parseConfigInput(value);

    configManager.set(key, parsedValue);

    console.log();
    console.log(chalk.green(`✓ Set ${key} = ${formatConfigValue(parsedValue)}`));
    console.log();
  } catch (error) {
    throw new Error(`Failed to set config value: ${getErrorMessage(error)}`, { cause: error });
  }
}

/**
 * Execute the config command.
 */
export async function configCommand(
  action: string,
  args: string[],
  options: ConfigCommandOptions
): Promise<void> {
  try {
    const validation = validateConfigAction(action, args);
    if (!validation.isValid) {
      logger.error(chalk.red('Invalid action:'));
      validation.errors.forEach((error) => logger.error(chalk.red(`  - ${error}`)));
      process.exit(1);
    }

    console.log();
    console.log(chalk.blue('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    console.log(chalk.blue('  Configuration'));
    console.log(chalk.blue('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));

    const configPath = options.config || '.workflow-config.yaml';
    const configManager = createConfigManager(configPath);

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
    logger.error(chalk.red(`Error: ${getErrorMessage(error)}`));
    if (options.verbose && error instanceof Error && error.stack) {
      logger.error(chalk.gray(error.stack));
    }
    process.exit(1);
  }
}

const configCommandModule = {
  configCommand,
  validateConfigAction,
  getConfigValue,
  formatConfigValue,
  formatValidationErrors,
};

export { configCommandModule };
export default configCommandModule;
