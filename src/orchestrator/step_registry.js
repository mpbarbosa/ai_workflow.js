/**
 * @fileoverview Step Registry - Manages workflow step definitions and metadata
 * @module orchestrator/step_registry
 * @version 2.0.0
 *
 * Provides a registry system for managing workflow steps with metadata, requirements,
 * and validation. Follows referential transparency pattern with pure functions for
 * business logic and StepRegistry class for I/O and state management.
 *
 * Architecture:
 * - Pure functions: Step validation, filtering, grouping, requirement matching
 * - Impure wrapper: StepRegistry class for registration and lookup
 */

import { logger } from '../core/logger.js';
import { ValidationError, SystemError } from '../utils/errors.js';

/**
 * Creates a validated step definition from metadata
 *
 * @param {Object} metadata - Step metadata
 * @param {string} metadata.id - Unique step identifier (e.g., 'step_00_analyze')
 * @param {string} metadata.name - Human-readable name
 * @param {string} metadata.description - Step description
 * @param {string} [metadata.phase='execution'] - Workflow phase (analysis, validation, testing, quality, finalization)
 * @param {Array<string>} [metadata.dependencies=[]] - Step IDs this depends on
 * @param {Array<string>} [metadata.tags=[]] - Categorization tags
 * @param {boolean} [metadata.critical=false] - Critical step flag
 * @param {boolean} [metadata.enabled=true] - Enabled flag
 * @param {number} [metadata.timeout=300] - Timeout in seconds
 * @param {Object} [metadata.requirements={}] - Step requirements
 * @param {Function} [metadata.handler] - Execution handler function
 * @returns {Object} Validated step definition
 * @throws {ValidationError} If metadata is invalid
 * @pure
 */
export function createStepDefinition(metadata) {
  const errors = validateStepMetadata(metadata);
  if (errors.length > 0) {
    throw new ValidationError(`Invalid step metadata: ${errors.join(', ')}`);
  }

  return {
    id: metadata.id,
    name: metadata.name,
    description: metadata.description,
    phase: metadata.phase || 'execution',
    dependencies: metadata.dependencies || [],
    tags: metadata.tags || [],
    critical: metadata.critical || false,
    enabled: metadata.enabled !== false,
    timeout: metadata.timeout || 300,
    requirements: metadata.requirements || {},
    handler: metadata.handler,
    metadata: {
      registered: metadata.registered || null,
      version: metadata.version || '1.0.0',
      ...metadata.metadata,
    },
  };
}

/**
 * Validates step metadata structure and values
 *
 * @param {Object} metadata - Step metadata to validate
 * @returns {Array<string>} Array of validation error messages (empty if valid)
 * @pure
 */
export function validateStepMetadata(metadata) {
  const errors = [];

  if (!metadata || typeof metadata !== 'object') {
    errors.push('metadata must be an object');
    return errors;
  }

  // Required fields
  if (!metadata.id || typeof metadata.id !== 'string') {
    errors.push('id is required and must be a string');
  } else if (!/^[a-z0-9_]+$/.test(metadata.id)) {
    errors.push('id must contain only lowercase letters, numbers, and underscores');
  }

  if (!metadata.name || typeof metadata.name !== 'string') {
    errors.push('name is required and must be a string');
  }

  if (!metadata.description || typeof metadata.description !== 'string') {
    errors.push('description is required and must be a string');
  }

  // Optional fields with type validation
  if (metadata.phase !== undefined) {
    const validPhases = [
      'analysis',
      'validation',
      'testing',
      'quality',
      'finalization',
      'execution',
    ];
    if (!validPhases.includes(metadata.phase)) {
      errors.push(`phase must be one of: ${validPhases.join(', ')}`);
    }
  }

  if (metadata.dependencies !== undefined) {
    if (!Array.isArray(metadata.dependencies)) {
      errors.push('dependencies must be an array');
    } else if (!metadata.dependencies.every((d) => typeof d === 'string')) {
      errors.push('all dependencies must be strings');
    }
  }

  if (metadata.tags !== undefined) {
    if (!Array.isArray(metadata.tags)) {
      errors.push('tags must be an array');
    } else if (!metadata.tags.every((t) => typeof t === 'string')) {
      errors.push('all tags must be strings');
    }
  }

  if (metadata.critical !== undefined && typeof metadata.critical !== 'boolean') {
    errors.push('critical must be a boolean');
  }

  if (metadata.enabled !== undefined && typeof metadata.enabled !== 'boolean') {
    errors.push('enabled must be a boolean');
  }

  if (metadata.timeout !== undefined) {
    if (typeof metadata.timeout !== 'number') {
      errors.push('timeout must be a number');
    } else if (metadata.timeout <= 0) {
      errors.push('timeout must be greater than 0');
    }
  }

  if (metadata.requirements !== undefined && typeof metadata.requirements !== 'object') {
    errors.push('requirements must be an object');
  }

  if (metadata.handler !== undefined && typeof metadata.handler !== 'function') {
    errors.push('handler must be a function');
  }

  return errors;
}

/**
 * Checks if a step's requirements are met in the given context
 *
 * @param {Object} step - Step definition with requirements
 * @param {Object} context - Execution context with available resources
 * @returns {Object} Result with met flag and missing requirements
 * @pure
 */
export function matchStepRequirements(step, context) {
  const result = {
    met: true,
    missing: [],
  };

  if (!step.requirements || Object.keys(step.requirements).length === 0) {
    return result;
  }

  const { requirements } = step;
  const ctx = context || {};

  // Check file requirements
  if (requirements.files && Array.isArray(requirements.files)) {
    const availableFiles = ctx.files || [];
    const missingFiles = requirements.files.filter((f) => !availableFiles.includes(f));
    if (missingFiles.length > 0) {
      result.met = false;
      result.missing.push(...missingFiles.map((f) => `file:${f}`));
    }
  }

  // Check tool requirements
  if (requirements.tools && Array.isArray(requirements.tools)) {
    const availableTools = ctx.tools || [];
    const missingTools = requirements.tools.filter((t) => !availableTools.includes(t));
    if (missingTools.length > 0) {
      result.met = false;
      result.missing.push(...missingTools.map((t) => `tool:${t}`));
    }
  }

  // Check config requirements
  if (requirements.config && typeof requirements.config === 'object') {
    const config = ctx.config || {};
    for (const [key, value] of Object.entries(requirements.config)) {
      if (config[key] !== value) {
        result.met = false;
        result.missing.push(`config:${key}=${value}`);
      }
    }
  }

  // Check environment requirements
  if (requirements.env && Array.isArray(requirements.env)) {
    const env = ctx.env || {};
    const missingEnv = requirements.env.filter((e) => !env[e]);
    if (missingEnv.length > 0) {
      result.met = false;
      result.missing.push(...missingEnv.map((e) => `env:${e}`));
    }
  }

  return result;
}

/**
 * Groups steps by their workflow phase
 *
 * @param {Array<Object>} steps - Array of step definitions
 * @returns {Object} Steps grouped by phase
 * @pure
 */
export function groupStepsByPhase(steps) {
  const groups = {
    analysis: [],
    validation: [],
    testing: [],
    quality: [],
    finalization: [],
    execution: [],
  };

  for (const step of steps) {
    const phase = step.phase || 'execution';
    if (groups[phase]) {
      groups[phase].push(step);
    } else {
      groups.execution.push(step);
    }
  }

  return groups;
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
  if (!enabledOnly) {
    return steps;
  }

  return steps.filter((step) => step.enabled !== false);
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
  return [...steps].sort((a, b) => {
    // Extract numeric part from step IDs like 'step_00_analyze'
    const aNum = parseInt(a.id.match(/\d+/)?.[0] || '999', 10);
    const bNum = parseInt(b.id.match(/\d+/)?.[0] || '999', 10);
    return aNum - bNum;
  });
}

/**
 * Validates that all step dependencies exist in the registry
 *
 * @param {Array<Object>} steps - Array of step definitions
 * @returns {Object} Validation result with errors
 * @pure
 */
export function validateStepDependencies(steps) {
  const result = {
    valid: true,
    errors: [],
  };

  const stepIds = new Set(steps.map((s) => s.id));

  for (const step of steps) {
    if (step.dependencies && step.dependencies.length > 0) {
      for (const dep of step.dependencies) {
        if (!stepIds.has(dep)) {
          result.valid = false;
          result.errors.push(`Step '${step.id}' depends on non-existent step '${dep}'`);
        }
      }
    }
  }

  return result;
}

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

    logger.debug(`Registered step: ${stepId}`);
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
    if (!this.steps.has(stepId)) {
      throw new ValidationError(`Step '${stepId}' not found`);
    }

    const existing = this.steps.get(stepId);
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
    const step = this.get(stepId);
    if (!step) {
      throw new ValidationError(`Step '${stepId}' not found`);
    }

    return matchStepRequirements(step, context);
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
