/**
 * @fileoverview CLI Prompts Utilities
 * @module cli/prompts
 *
 * Reusable prompt patterns using Inquirer for consistent user interaction.
 *
 * Architecture: v2.0.0 Pattern
 * - Pure functions for prompt configuration
 * - Impure wrappers for user interaction
 *
 * @version 1.0.0
 * @since 2026-02-11
 */

import inquirer from 'inquirer';
import chalk from 'chalk';

// ============================================================================
// PURE FUNCTIONS - Prompt Configuration
// ============================================================================

/**
 * Create confirmation prompt configuration
 * @pure
 * @param {string} message - Prompt message
 * @param {boolean} defaultValue - Default value
 * @returns {Object} Prompt configuration
 */
export function createConfirmPrompt(message, defaultValue = false) {
  return {
    type: 'confirm',
    name: 'confirmed',
    message,
    default: defaultValue,
  };
}

/**
 * Create input prompt configuration
 * @pure
 * @param {string} message - Prompt message
 * @param {string} defaultValue - Default value
 * @param {Function} validate - Validation function
 * @returns {Object} Prompt configuration
 */
export function createInputPrompt(message, defaultValue = '', validate = null) {
  const config = {
    type: 'input',
    name: 'value',
    message,
    default: defaultValue,
  };

  if (validate) {
    config.validate = validate;
  }

  return config;
}

/**
 * Create list prompt configuration
 * @pure
 * @param {string} message - Prompt message
 * @param {Array<string|Object>} choices - List of choices
 * @param {string} defaultValue - Default value
 * @returns {Object} Prompt configuration
 */
export function createListPrompt(message, choices, defaultValue = null) {
  return {
    type: 'list',
    name: 'selected',
    message,
    choices,
    default: defaultValue,
  };
}

/**
 * Create checkbox prompt configuration
 * @pure
 * @param {string} message - Prompt message
 * @param {Array<string|Object>} choices - List of choices
 * @returns {Object} Prompt configuration
 */
export function createCheckboxPrompt(message, choices) {
  return {
    type: 'checkbox',
    name: 'selected',
    message,
    choices,
  };
}

/**
 * Format choice with description
 * @pure
 * @param {string} name - Choice name
 * @param {string} value - Choice value
 * @param {string} description - Choice description
 * @returns {Object} Formatted choice
 */
export function formatChoice(name, value, description = null) {
  const choice = { name, value };
  if (description) {
    choice.name = `${name} ${chalk.gray(`(${description})`)}`;
  }
  return choice;
}

// ============================================================================
// IMPURE WRAPPERS - User Interaction
// ============================================================================

/**
 * Prompt for confirmation
 * @param {string} message - Confirmation message
 * @param {boolean} defaultValue - Default value
 * @returns {Promise<boolean>} User's response
 */
export async function confirmAction(message, defaultValue = false) {
  const prompt = createConfirmPrompt(message, defaultValue);
  const answer = await inquirer.prompt([prompt]);
  return answer.confirmed;
}

/**
 * Prompt for text input
 * @param {string} message - Input prompt message
 * @param {string} defaultValue - Default value
 * @param {Function} validate - Validation function
 * @returns {Promise<string>} User's input
 */
export async function promptInput(message, defaultValue = '', validate = null) {
  const prompt = createInputPrompt(message, defaultValue, validate);
  const answer = await inquirer.prompt([prompt]);
  return answer.value;
}

/**
 * Prompt for selection from list
 * @param {string} message - Selection prompt message
 * @param {Array<string|Object>} choices - List of choices
 * @param {string} defaultValue - Default value
 * @returns {Promise<*>} Selected value
 */
export async function promptSelect(message, choices, defaultValue = null) {
  const prompt = createListPrompt(message, choices, defaultValue);
  const answer = await inquirer.prompt([prompt]);
  return answer.selected;
}

/**
 * Prompt for multiple selections
 * @param {string} message - Selection prompt message
 * @param {Array<string|Object>} choices - List of choices
 * @returns {Promise<Array>} Selected values
 */
export async function promptMultiSelect(message, choices) {
  const prompt = createCheckboxPrompt(message, choices);
  const answer = await inquirer.prompt([prompt]);
  return answer.selected;
}

/**
 * Prompt to continue or abort
 * @param {string} operation - Operation description
 * @returns {Promise<boolean>} True if user wants to continue
 */
export async function confirmContinue(operation = 'operation') {
  return confirmAction(chalk.yellow(`This ${operation} will make changes. Continue?`), false);
}

/**
 * Prompt to overwrite existing file
 * @param {string} filePath - File path
 * @returns {Promise<boolean>} True if user wants to overwrite
 */
export async function confirmOverwrite(filePath) {
  return confirmAction(
    chalk.yellow(`File ${chalk.cyan(filePath)} already exists. Overwrite?`),
    false
  );
}

/**
 * Prompt for project name with validation
 * @param {string} defaultName - Default project name
 * @returns {Promise<string>} Project name
 */
export async function promptProjectName(defaultName = 'my-project') {
  const validate = (input) => {
    if (!input || input.trim().length === 0) {
      return 'Project name is required';
    }
    if (!/^[a-z0-9_-]+$/i.test(input)) {
      return 'Project name must contain only letters, numbers, hyphens, and underscores';
    }
    return true;
  };

  return promptInput('Project name:', defaultName, validate);
}

/**
 * Prompt for stage selection
 * @param {string} defaultStage - Default stage
 * @returns {Promise<string>} Selected stage
 */
export async function promptStageSelection(defaultStage = 'medium') {
  const choices = [
    formatChoice('Quick', 'quick', 'Fast validation - 3 steps'),
    formatChoice('Medium', 'medium', 'Standard workflow - 6 steps'),
    formatChoice('Full', 'full', 'Complete workflow - 10 steps'),
  ];

  return promptSelect('Select workflow stage:', choices, defaultStage);
}

/**
 * Prompt for cleanup targets
 * @returns {Promise<Array<string>>} Selected cleanup targets
 */
export async function promptCleanupTargets() {
  const choices = [
    { name: 'Workflow Artifacts', value: 'artifacts', checked: true },
    { name: 'Cache Files', value: 'cache', checked: true },
    { name: 'Checkpoints', value: 'checkpoints', checked: false },
    { name: 'Sessions', value: 'sessions', checked: false },
    { name: 'Metrics', value: 'metrics', checked: false },
  ];

  return promptMultiSelect('Select items to clean:', choices);
}

export default {
  // Pure functions
  createConfirmPrompt,
  createInputPrompt,
  createListPrompt,
  createCheckboxPrompt,
  formatChoice,
  // Impure wrappers
  confirmAction,
  promptInput,
  promptSelect,
  promptMultiSelect,
  confirmContinue,
  confirmOverwrite,
  promptProjectName,
  promptStageSelection,
  promptCleanupTargets,
};
