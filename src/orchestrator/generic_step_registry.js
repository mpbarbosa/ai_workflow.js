/**
 * @fileoverview Generic step registry helpers shared by registry implementations
 * @module orchestrator/generic_step_registry
 */

import {
  matchStepRequirements as matchOlindaStepRequirements,
  filterStepsByEnabled as filterOlindaStepsByEnabled,
  sortStepsById as sortOlindaStepsById,
  validateStepDependencies as validateOlindaStepDependencies,
} from './olinda_step_registry.js';

/**
 * Checks if a step's requirements are met in the given context
 *
 * @param {Object} step - Step definition with requirements
 * @param {Object} context - Execution context with available resources
 * @returns {Object} Result with met flag and missing requirements
 * @pure
 */
export function matchStepRequirements(step, context) {
  return matchOlindaStepRequirements(step, context || {});
}

/**
 * Filters steps by tags (all tags must match)
 *
 * @param {Array<Object>} steps - Array of step definitions
 * @param {Array<string>} tags - Tags to filter by
 * @returns {Array<Object>} Filtered steps
 * @pure
 */
export function filterStepsByTags(steps, tags) {
  if (!tags || tags.length === 0) {
    return steps;
  }

  return steps.filter((step) => {
    const stepTags = step.tags || [];
    return tags.every((tag) => stepTags.includes(tag));
  });
}

/**
 * Filters steps by enabled status
 *
 * @param {Array<Object>} steps - Array of step definitions
 * @param {boolean} [enabledOnly=true] - Only return enabled steps
 * @returns {Array<Object>} Filtered steps
 * @pure
 */
export function filterStepsByEnabled(steps, enabledOnly = true) {
  return filterOlindaStepsByEnabled(steps, enabledOnly);
}

/**
 * Finds steps by phase
 *
 * @param {Array<Object>} steps - Array of step definitions
 * @param {string} phase - Phase to filter by
 * @returns {Array<Object>} Steps in the specified phase
 * @pure
 */
export function findStepsByPhase(steps, phase) {
  if (phase === undefined) {
    return [];
  }

  return steps.filter((step) => step.phase === phase);
}

/**
 * Sorts steps by their ID (natural ordering for step_00, step_01, etc.)
 *
 * @param {Array<Object>} steps - Array of step definitions
 * @returns {Array<Object>} Sorted steps
 * @pure
 */
export function sortStepsById(steps) {
  return sortOlindaStepsById(steps);
}

/**
 * Validates that all step dependencies exist in the registry
 *
 * @param {Array<Object>} steps - Array of step definitions
 * @returns {Object} Validation result with errors
 * @pure
 */
export function validateStepDependencies(steps) {
  return validateOlindaStepDependencies(
    steps.map((step) => (Array.isArray(step.dependencies) ? step : { ...step, dependencies: [] }))
  );
}
