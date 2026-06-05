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
import * as fs from 'node:fs/promises';
import chalk from 'chalk';
// @ts-expect-error - js-yaml types may not be bundled in all environments.
import yaml from 'js-yaml';
import { logger } from '../../core/logger.js';
// @ts-expect-error - legacy JS module is untyped in the current TypeScript setup.
import { Config } from '../../lib/config.js';
// @ts-expect-error - legacy JS module is untyped in the current TypeScript setup.
import { getCanonicalWorkflowSteps } from '../../orchestrator/workflow_step_catalog.js';
// @ts-ignore - workflow_execution_plan is a plain JS module without type declarations.
import {
  haveSameDependencySet,
  classifyDependencyOverrideSeverity,
} from '../../orchestrator/workflow_execution_plan.js';
const VALID_ACTIONS = ['show', 'validate', 'get', 'set', 'fix-deps'];
const VALID_FIX_DEPS_MODES = ['comment', 'restore', 'remove-disabled'];
function isRecord(value) {
  return typeof value === 'object' && value !== null;
}
function getErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
function createConfigManager(configPath) {
  return new Config(configPath);
}
function parseConfigInput(value) {
  if (value.startsWith('{') || value.startsWith('[')) {
    try {
      return JSON.parse(value);
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
export function validateConfigAction(action, args) {
  const errors = [];
  if (!VALID_ACTIONS.includes(action)) {
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
 * Build the canonical dependency map from the step catalog.
 */
export function buildCanonicalDepMap() {
  const steps = getCanonicalWorkflowSteps();
  const map = new Map();
  for (const step of steps) {
    map.set(step.id, step.dependencies);
  }
  return map;
}
/**
 * Compute the set of changes fix-deps would apply without mutating the config.
 */
export function computeFixDepsChanges(config, mode) {
  const steps = config?.workflow?.steps;
  if (!Array.isArray(steps)) return [];
  const canonicalDepMap = buildCanonicalDepMap();
  const changes = [];
  for (const step of steps) {
    const stepId = step.id;
    if (!stepId) continue;
    if (mode === 'remove-disabled') {
      if (step.enabled === false && step.dependencies !== undefined) {
        changes.push({
          stepId,
          severity: 'NOISE',
          description: `remove 'dependencies' key (step is disabled)`,
        });
      }
      continue;
    }
    const configDeps = step.dependencies;
    if (configDeps === undefined) continue;
    const canonicalDeps = canonicalDepMap.get(stepId);
    if (!canonicalDeps) continue;
    const isCanonical = haveSameDependencySet(configDeps, canonicalDeps);
    if (isCanonical) continue;
    if (step.dependency_comment) continue; // Already documented
    const severity = classifyDependencyOverrideSeverity({
      stepId,
      stepEnabled: step.enabled !== false,
      canonicalDependencies: canonicalDeps,
      rawConfiguredDependencies: configDeps,
      removedDependencies: [],
    });
    if (mode === 'restore') {
      changes.push({
        stepId,
        severity,
        description: `restore canonical deps ${JSON.stringify(canonicalDeps)} (was ${JSON.stringify(configDeps)})`,
      });
    } else {
      // comment (default)
      changes.push({
        stepId,
        severity,
        description: `add placeholder dependency_comment`,
      });
    }
  }
  return changes;
}
/**
 * Apply fix-deps changes to the parsed config object in place.
 */
export function applyFixDepsChanges(config, mode, canonicalDepMap) {
  const steps = config?.workflow?.steps;
  if (!Array.isArray(steps)) return 0;
  let fixCount = 0;
  for (const step of steps) {
    const stepId = step.id;
    if (!stepId) continue;
    if (mode === 'remove-disabled') {
      if (step.enabled === false && step.dependencies !== undefined) {
        delete step.dependencies;
        delete step.dependency_comment;
        fixCount++;
      }
      continue;
    }
    const configDeps = step.dependencies;
    if (configDeps === undefined) continue;
    const canonicalDeps = canonicalDepMap.get(stepId);
    if (!canonicalDeps) continue;
    const isCanonical = haveSameDependencySet(configDeps, canonicalDeps);
    if (isCanonical) continue;
    if (step.dependency_comment) continue;
    if (mode === 'restore') {
      step.dependencies = canonicalDeps;
      delete step.dependency_comment;
    } else {
      // comment (default)
      step.dependency_comment =
        'FIXME: explain why this dependency override is required for this project.';
    }
    fixCount++;
  }
  return fixCount;
}
/**
 * Get nested config value by key path.
 */
export function getConfigValue(config, keyPath) {
  if (!config || !keyPath) {
    return undefined;
  }
  const keys = keyPath.split('.');
  let value = config;
  for (const key of keys) {
    if (isRecord(value) && key in value) {
      value = value[key];
    } else {
      return undefined;
    }
  }
  return value;
}
/**
 * Format config value for display.
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
 * Format validation errors.
 */
export function formatValidationErrors(errors) {
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
    throw new Error(`Failed to show config: ${getErrorMessage(error)}`, { cause: error });
  }
}
/**
 * Execute the config validate action.
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
    throw new Error(`Failed to validate config: ${getErrorMessage(error)}`, { cause: error });
  }
}
/**
 * Execute the config get action.
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
    throw new Error(`Failed to get config value: ${getErrorMessage(error)}`, { cause: error });
  }
}
/**
 * Execute the config set action.
 */
async function setConfigKey(configManager, key, value) {
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
 * Execute the config fix-deps action.
 *
 * Scans .workflow-config.yaml for dependency overrides that lack dependency_comment
 * and either adds placeholder comments (default), restores canonical deps, or
 * removes the dependencies key from disabled steps — based on --mode.
 */
async function fixDepsConfig(configPath, options) {
  const mode = VALID_FIX_DEPS_MODES.includes(options.mode) ? options.mode : 'comment';
  const dryRun = options.dryRun ?? false;
  let rawContent;
  try {
    rawContent = await fs.readFile(configPath, 'utf8');
  } catch (error) {
    throw new Error(`Cannot read config file: ${configPath}`, { cause: error });
  }
  let config;
  try {
    config = yaml.load(rawContent);
  } catch (error) {
    throw new Error(`YAML parse error in ${configPath}: ${getErrorMessage(error)}`, {
      cause: error,
    });
  }
  if (!config?.workflow?.steps || !Array.isArray(config.workflow.steps)) {
    console.log(chalk.yellow('⚠ No workflow.steps found in config — nothing to fix'));
    return;
  }
  // Preview changes first (always)
  const changes = computeFixDepsChanges(config, mode);
  if (changes.length === 0) {
    console.log(chalk.green('✓ No undocumented dependency overrides found — nothing to fix'));
    return;
  }
  const bySeverity = {};
  for (const c of changes) {
    if (!bySeverity[c.severity]) bySeverity[c.severity] = [];
    bySeverity[c.severity].push(c);
  }
  console.log();
  console.log(chalk.cyan(`Changes to apply — mode: ${mode} (${changes.length} step(s)):`));
  for (const sev of ['CORRECTNESS', 'STRUCTURAL', 'DOCUMENTATION', 'NOISE']) {
    const group = bySeverity[sev] || [];
    if (group.length === 0) continue;
    const color =
      sev === 'CORRECTNESS'
        ? chalk.red
        : sev === 'STRUCTURAL'
          ? chalk.yellow
          : sev === 'DOCUMENTATION'
            ? chalk.cyan
            : chalk.gray;
    console.log(color(`  [${sev}] ${group.length} step(s):`));
    group.forEach((c) => console.log(chalk.gray(`    • ${c.stepId}: ${c.description}`)));
  }
  console.log();
  if (dryRun) {
    console.log(chalk.yellow('--dry-run: no changes written to disk'));
    return;
  }
  // Apply changes to the parsed object
  const canonicalDepMap = buildCanonicalDepMap();
  const fixCount = applyFixDepsChanges(config, mode, canonicalDepMap);
  // Serialize back to YAML preserving key order
  const newYaml = yaml.dump(config, {
    lineWidth: -1,
    noRefs: true,
    sortKeys: false,
    indent: 2,
  });
  await fs.writeFile(configPath, newYaml, 'utf8');
  console.log(chalk.green(`✓ Applied ${fixCount} fix(es) to ${configPath}`));
  if (mode === 'comment') {
    console.log(
      chalk.gray(
        "  Search for 'FIXME:' in the file and replace each placeholder with a real justification."
      )
    );
  }
}
/**
 * Execute the config command.
 */
export async function configCommand(action, args, options) {
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
      case 'fix-deps':
        await fixDepsConfig(configPath, options);
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
  buildCanonicalDepMap,
  computeFixDepsChanges,
  applyFixDepsChanges,
};
export { configCommandModule };
export default configCommandModule;
