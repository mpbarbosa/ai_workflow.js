/**
 * @fileoverview Project-specialized step registry - wires generic helpers to app logging and errors
 * @module orchestrator/step_registry
 * @version 2.0.0
 *
 * Provides the project-specific registry class while re-exporting generic helper
 * functions from step_definition.js and generic_step_registry.js.
 */

import { logger } from '../core/logger.js';
import { ValidationError, SystemError } from '../utils/errors.js';
import {
  createStepDefinition,
  validateStepMetadata,
  groupStepsByPhase,
} from './step_definition.js';
import {
  matchStepRequirements,
  filterStepsByTags,
  filterStepsByEnabled,
  findStepsByPhase,
  sortStepsById,
  validateStepDependencies,
} from './generic_step_registry.js';

export {
  createStepDefinition,
  validateStepMetadata,
  groupStepsByPhase,
  matchStepRequirements,
  filterStepsByTags,
  filterStepsByEnabled,
  findStepsByPhase,
  sortStepsById,
  validateStepDependencies,
};

/**
 * Step Registry - Manages workflow step definitions
 *
 * Impure wrapper class that provides:
 * - Step registration and storage
 * - Step lookup and querying
 * - Dynamic step loading
 * - Registry validation
 *
 * Side effects:
 * - Maintains in-memory step registry (mutable Map)
 * - Console logging via logger
 * - File system I/O (loadStepsFromDirectory - future)
 *
 * @class
 */
export class StepRegistry {
  constructor() {
    this.steps = new Map();
    this.registrationOrder = [];
  }

  #requireStep(stepId) {
    const step = this.steps.get(stepId);
    if (!step) {
      throw new ValidationError(`Step '${stepId}' not found`);
    }

    return step;
  }

  /**
   * Registers a step in the registry
   *
   * @param {string} stepId - Unique step identifier
   * @param {Object} definition - Step definition (will be validated)
   * @returns {Object} Validated and registered step definition
   * @throws {ValidationError} If step already exists or definition is invalid
   */
  register(stepId, definition) {
    if (this.steps.has(stepId)) {
      throw new ValidationError(`Step '${stepId}' is already registered`);
    }

    const metadata = {
      ...definition,
      id: stepId,
      registered: Date.now(),
    };

    const step = createStepDefinition(metadata);
    this.steps.set(stepId, step);
    this.registrationOrder.push(stepId);

    logger.debug(`Registered canonical workflow step definition for planning: ${stepId}`);
    return step;
  }

  /**
   * Updates an existing step definition
   *
   * @param {string} stepId - Step identifier
   * @param {Object} updates - Partial step definition updates
   * @returns {Object} Updated step definition
   * @throws {ValidationError} If step doesn't exist
   */
  update(stepId, updates) {
    const existing = this.#requireStep(stepId);
    const metadata = {
      ...existing,
      ...updates,
      id: stepId,
    };

    const step = createStepDefinition(metadata);
    this.steps.set(stepId, step);

    logger.debug(`Updated step: ${stepId}`);
    return step;
  }

  /**
   * Unregisters a step from the registry
   *
   * @param {string} stepId - Step identifier
   * @returns {boolean} True if step was unregistered
   */
  unregister(stepId) {
    const deleted = this.steps.delete(stepId);
    if (deleted) {
      const index = this.registrationOrder.indexOf(stepId);
      if (index > -1) {
        this.registrationOrder.splice(index, 1);
      }
      logger.debug(`Unregistered step: ${stepId}`);
    }
    return deleted;
  }

  /**
   * Gets a step definition by ID
   *
   * @param {string} stepId - Step identifier
   * @returns {Object|null} Step definition or null if not found
   */
  get(stepId) {
    return this.steps.get(stepId) || null;
  }

  /**
   * Checks if a step is registered
   *
   * @param {string} stepId - Step identifier
   * @returns {boolean} True if step exists
   */
  has(stepId) {
    return this.steps.has(stepId);
  }

  /**
   * Lists all steps with optional filtering
   *
   * @param {Object} [filter={}] - Filter options
   * @param {string} [filter.phase] - Filter by phase
   * @param {Array<string>} [filter.tags] - Filter by tags (all must match)
   * @param {boolean} [filter.enabledOnly=true] - Only enabled steps
   * @returns {Array<Object>} Filtered step definitions
   */
  list(filter = {}) {
    let steps = Array.from(this.steps.values());

    if (filter.phase) {
      steps = findStepsByPhase(steps, filter.phase);
    }

    if (filter.tags && filter.tags.length > 0) {
      steps = filterStepsByTags(steps, filter.tags);
    }

    if (filter.enabledOnly !== false) {
      steps = filterStepsByEnabled(steps);
    }

    return sortStepsById(steps);
  }

  /**
   * Gets steps grouped by phase
   *
   * @returns {Object} Steps grouped by phase
   */
  getByPhase() {
    const steps = Array.from(this.steps.values());
    return groupStepsByPhase(steps);
  }

  /**
   * Gets steps in registration order
   *
   * @returns {Array<Object>} Steps in registration order
   */
  getInOrder() {
    return this.registrationOrder.map((id) => this.steps.get(id)).filter(Boolean);
  }

  /**
   * Validates all registered steps
   *
   * @returns {Object} Validation result with any errors
   */
  validateAll() {
    const steps = Array.from(this.steps.values());
    const result = validateStepDependencies(steps);

    if (!result.valid) {
      logger.warn(`Step registry validation failed: ${result.errors.join('; ')}`);
    } else {
      logger.debug('Step registry validation passed');
    }

    return result;
  }

  /**
   * Checks step requirements against context
   *
   * @param {string} stepId - Step identifier
   * @param {Object} context - Execution context
   * @returns {Object} Requirement check result
   * @throws {ValidationError} If step doesn't exist
   */
  checkRequirements(stepId, context) {
    return matchStepRequirements(this.#requireStep(stepId), context);
  }

  /**
   * Clears all registered steps
   */
  clear() {
    this.steps.clear();
    this.registrationOrder = [];
    logger.debug('Cleared step registry');
  }

  /**
   * Gets registry statistics
   *
   * @returns {Object} Registry statistics
   */
  getStats() {
    const steps = Array.from(this.steps.values());
    const phases = groupStepsByPhase(steps);

    return {
      total: steps.length,
      enabled: filterStepsByEnabled(steps).length,
      disabled: steps.filter((s) => s.enabled === false).length,
      critical: steps.filter((s) => s.critical === true).length,
      byPhase: Object.fromEntries(Object.entries(phases).map(([k, v]) => [k, v.length])),
    };
  }

  /**
   * Loads steps from a directory (future implementation)
   *
   * @param {string} dir - Directory path
   * @throws {SystemError} Not yet implemented
   */
  loadStepsFromDirectory(dir) {
    throw new SystemError(`loadStepsFromDirectory not yet implemented: ${dir}`);
  }
}
