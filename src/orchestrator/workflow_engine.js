/**
 * Workflow Engine Module
 *
 * Core workflow orchestration engine for executing the 15-step AI-powered
 * development pipeline with dependency management, error recovery, and
 * checkpoint support.
 *
 * Architecture: v2.0.0 Referential Transparency
 * - Pure functions: Workflow validation, execution planning, progress calculation
 * - Impure wrapper: Workflow execution, state management, event emission
 *
 * @module orchestrator/workflow_engine
 * @version 2.0.0
 */

import EventEmitter from 'events';
import fs from 'fs/promises';
import { extname } from 'path';
import yaml from 'js-yaml';
import { logger } from '../core/logger.js';
import { ValidationError, SystemError } from '../utils/errors.js';

// ==============================================================================
// PURE FUNCTIONS - Workflow Logic
// ==============================================================================

/**
 * Validates workflow configuration structure and required fields.
 *
 * @param {Object} config - Workflow configuration
 * @returns {Object} Validation result with isValid, errors array
 *
 * @pure
 *
 * @example
 * const result = validateWorkflowConfig({ name: 'test', steps: [] });
 * // => { isValid: true, errors: [] }
 */
export function validateWorkflowConfig(config) {
  const errors = [];

  if (!config || typeof config !== 'object') {
    return { isValid: false, errors: ['Config must be an object'] };
  }

  // Required fields
  if (!config.name || typeof config.name !== 'string') {
    errors.push('Workflow name is required and must be a string');
  }

  if (!config.version || typeof config.version !== 'string') {
    errors.push('Workflow version is required');
  }

  if (!Array.isArray(config.steps)) {
    errors.push('Steps must be an array');
  } else if (config.steps.length === 0) {
    errors.push('Workflow must have at least one step');
  } else {
    // Validate each step
    config.steps.forEach((step, index) => {
      if (!step.id) {
        errors.push(`Step ${index} missing required field: id`);
      }
      if (!step.name) {
        errors.push(`Step ${index} missing required field: name`);
      }
      if (step.dependencies && !Array.isArray(step.dependencies)) {
        errors.push(`Step ${step.id || index}: dependencies must be an array`);
      }
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Builds execution plan from steps based on dependencies.
 * Returns ordered array of steps for sequential execution.
 *
 * @param {Array<Object>} steps - Array of step definitions
 * @returns {Array<Object>} Ordered execution plan
 *
 * @pure
 *
 * @example
 * const steps = [
 *   { id: 'step2', dependencies: ['step1'] },
 *   { id: 'step1', dependencies: [] }
 * ];
 * buildExecutionPlan(steps);
 * // => [{ id: 'step1', ... }, { id: 'step2', ... }]
 */
export function buildExecutionPlan(steps) {
  if (!Array.isArray(steps) || steps.length === 0) {
    return [];
  }

  // Create a copy to avoid mutation
  const stepsCopy = steps.map((s, index) => ({ ...s, __originalOrder: index }));

  // Build dependency map
  const stepMap = new Map();
  stepsCopy.forEach((step) => {
    stepMap.set(step.id, {
      ...step,
      dependencies: step.dependencies || [],
    });
  });
  const { dependencyMap } = buildDependencyMaps(stepsCopy);
  const orderMap = new Map(stepsCopy.map((step) => [step.id, step.__originalOrder]));

  // Topological sort (Kahn's algorithm)
  const result = [];
  const inDegree = new Map();

  // Calculate in-degrees
  stepsCopy.forEach((step) => {
    inDegree.set(step.id, 0);
  });

  stepsCopy.forEach((step) => {
    (step.dependencies || []).forEach((depId) => {
      if (stepMap.has(depId)) {
        inDegree.set(step.id, (inDegree.get(step.id) || 0) + 1);
      }
    });
  });

  // Find steps with no dependencies
  const queue = [];
  stepsCopy.forEach((step) => {
    if (inDegree.get(step.id) === 0) {
      queue.push(step);
    }
  });
  sortReadyQueue(queue, dependencyMap, orderMap);

  // Process queue
  while (queue.length > 0) {
    const current = queue.shift();
    const cleanStep = { ...current };
    delete cleanStep.__originalOrder;
    result.push(cleanStep);

    // Find steps that depend on current
    stepsCopy.forEach((step) => {
      if ((step.dependencies || []).includes(current.id)) {
        const newDegree = inDegree.get(step.id) - 1;
        inDegree.set(step.id, newDegree);

        if (newDegree === 0) {
          queue.push(step);
          sortReadyQueue(queue, dependencyMap, orderMap);
        }
      }
    });
  }

  // Check for cycles
  if (result.length !== stepsCopy.length) {
    throw new ValidationError('Circular dependency detected in workflow steps');
  }

  return result;
}

/**
 * Determines if a step should be executed based on conditions.
 *
 * @param {Object} step - Step definition
 * @param {Object} context - Execution context
 * @returns {boolean} True if step should execute
 *
 * @pure
 *
 * @example
 * shouldExecuteStep({ skip: false }, {})  // => true
 * shouldExecuteStep({ skip: true }, {})   // => false
 */
export function shouldExecuteStep(step, context = {}) {
  if (!step || typeof step !== 'object') {
    return false;
  }

  // Check if explicitly skipped
  if (step.skip === true) {
    return false;
  }

  // Check if step is disabled
  if (step.enabled === false) {
    return false;
  }

  // Check conditions
  if (step.condition && typeof step.condition === 'function') {
    return step.condition(context);
  }

  if (step.condition && typeof step.condition === 'string') {
    // Simple condition evaluation (e.g., "context.hasChanges")
    try {
      return evalCondition(step.condition, context);
    } catch {
      return true; // Default to executing if condition evaluation fails
    }
  }

  return true;
}

/**
 * Evaluates a simple condition string against context.
 *
 * @param {string} condition - Condition string
 * @param {Object} context - Context object
 * @returns {boolean} Evaluation result
 *
 * @pure
 * @private
 */
function evalCondition(condition, context) {
  // Simple property access (e.g., "hasChanges", "isProduction")
  if (condition.includes('.')) {
    const parts = condition.split('.');
    let value = context;
    for (const part of parts) {
      value = value?.[part];
    }
    return Boolean(value);
  }

  return Boolean(context[condition]);
}

function formatExecutionStepName(step = {}) {
  const canonicalName = step.canonicalName || step.name || step.id;
  const aliasName = step.aliasName || (step.name && step.name !== canonicalName ? step.name : null);
  return aliasName ? `${aliasName} [canonical: ${canonicalName}]` : canonicalName;
}

export function formatExecutionPlanLines(steps = []) {
  if (!Array.isArray(steps) || steps.length === 0) {
    return [];
  }

  return steps.map((step, index) => {
    const dependencySuffix =
      Array.isArray(step?.dependencies) && step.dependencies.length > 0
        ? ` | deps: ${step.dependencies.join(', ')}`
        : '';
    return `  ${index + 1}. ${formatExecutionStepName(step)} (${step.id})${dependencySuffix}`;
  });
}

function buildDependencyMaps(steps = []) {
  const dependencyMap = new Map();
  const reverseDependencyMap = new Map();

  for (const step of steps) {
    dependencyMap.set(step.id, []);
    reverseDependencyMap.set(step.id, []);
  }

  for (const step of steps) {
    for (const dependencyId of step.dependencies || []) {
      if (!dependencyMap.has(dependencyId)) {
        continue;
      }
      dependencyMap.get(dependencyId).push(step);
      reverseDependencyMap.get(step.id).push(dependencyId);
    }
  }

  return { dependencyMap, reverseDependencyMap };
}

function getStepPriority(step, dependencyMap = new Map(), memo = new Map()) {
  if (!step?.id) {
    return Number.NEGATIVE_INFINITY;
  }
  if (memo.has(step.id)) {
    return memo.get(step.id);
  }

  const downstream = dependencyMap.get(step.id) || [];
  const explicitPriority =
    typeof step.priority === 'number'
      ? step.priority
      : typeof step.metadata?.priority === 'number'
        ? step.metadata.priority
        : 0;
  const downstreamWeight = downstream.reduce(
    (sum, dependentStep) => sum + getStepPriority(dependentStep, dependencyMap, memo),
    0
  );
  const priority =
    explicitPriority + (step.critical !== false ? 10_000 : 0) + downstream.length * 100 + downstreamWeight;

  memo.set(step.id, priority);
  return priority;
}

function sortReadyQueue(queue, dependencyMap, orderMap) {
  const memo = new Map();
  queue.sort((left, right) => {
    const priorityDelta =
      getStepPriority(right, dependencyMap, memo) - getStepPriority(left, dependencyMap, memo);
    if (priorityDelta !== 0) {
      return priorityDelta;
    }
    return (orderMap.get(left.id) ?? 0) - (orderMap.get(right.id) ?? 0);
  });
}

function collectDependentCone(stepId, dependencyMap = new Map()) {
  const blocked = new Set();
  const queue = [...(dependencyMap.get(stepId) || [])];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current?.id || blocked.has(current.id)) {
      continue;
    }
    blocked.add(current.id);
    queue.push(...(dependencyMap.get(current.id) || []));
  }

  return blocked;
}

/**
 * Merges results from multiple step executions.
 *
 * @param {Array<Object>} results - Array of step results
 * @returns {Object} Merged result summary
 *
 * @pure
 *
 * @example
 * mergeStepResults([
 *   { stepId: 's1', success: true },
 *   { stepId: 's2', success: false }
 * ]);
 * // => { total: 2, succeeded: 1, failed: 1, skipped: 0, ... }
 */
export function mergeStepResults(results) {
  if (!Array.isArray(results)) {
    return {
      total: 0,
      succeeded: 0,
      failed: 0,
      skipped: 0,
      results: [],
    };
  }

  const summary = {
    total: results.length,
    succeeded: 0,
    failed: 0,
    skipped: 0,
    results: results.map((r) => ({ ...r })),
  };

  results.forEach((result) => {
    if (result.skipped) {
      summary.skipped++;
    } else if (result.success) {
      summary.succeeded++;
    } else {
      summary.failed++;
    }
  });

  return summary;
}

/**
 * Calculates workflow progress as percentage.
 *
 * @param {number} completed - Number of completed steps
 * @param {number} total - Total number of steps
 * @returns {number} Progress percentage (0-100)
 *
 * @pure
 *
 * @example
 * calculateWorkflowProgress(3, 10)  // => 30
 * calculateWorkflowProgress(10, 10) // => 100
 */
export function calculateWorkflowProgress(completed, total) {
  if (total <= 0) return 0;
  if (completed >= total) return 100;
  if (completed <= 0) return 0;

  return Math.round((completed / total) * 100);
}

/**
 * Validates step definition structure.
 *
 * @param {Object} step - Step definition
 * @returns {Object} Validation result
 *
 * @pure
 */
export function validateStepDefinition(step) {
  const errors = [];

  if (!step || typeof step !== 'object') {
    return { isValid: false, errors: ['Step must be an object'] };
  }

  if (!step.id || typeof step.id !== 'string') {
    errors.push('Step must have an id (string)');
  }

  if (!step.name || typeof step.name !== 'string') {
    errors.push('Step must have a name (string)');
  }

  if (step.timeout && (typeof step.timeout !== 'number' || step.timeout <= 0)) {
    errors.push('Step timeout must be a positive number');
  }

  if (step.retries && (typeof step.retries !== 'number' || step.retries < 0)) {
    errors.push('Step retries must be a non-negative number');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Creates a workflow execution context.
 *
 * @param {Object} workflow - Workflow configuration
 * @param {Object} options - Execution options
 * @returns {Object} Execution context
 *
 * @pure
 */
export function createExecutionContext(workflow, options = {}) {
  return {
    ...options, // preserve extra orchestrator fields (projectType, workflowDir, auto, …)
    workflowId: workflow.id || workflow.name,
    workflowName: workflow.name,
    workflowVersion: workflow.version,
    startTime: options.startTime || Date.now(),
    dryRun: options.dryRun || false,
    projectRoot: options.projectRoot || process.cwd(),
    environment: options.environment || 'development',
    config: options.config || {},
    state: {}, // always fresh
    results: [], // always fresh
  };
}

// ==============================================================================
// IMPURE WRAPPER CLASS - Workflow Engine
// ==============================================================================

/**
 * Parses workflow file content based on file extension.
 * Supports JSON (.json) and YAML (.yaml, .yml) formats.
 *
 * @param {string} content - Raw file content
 * @param {string} filePath - File path (used to determine format)
 * @returns {Object} Parsed workflow configuration
 *
 * @throws {SystemError} If the file extension is unsupported or content cannot be parsed
 *
 * @pure
 */
export function parseWorkflowFile(content, filePath) {
  const ext = extname(filePath).toLowerCase();

  if (ext === '.json') {
    try {
      return JSON.parse(content);
    } catch (err) {
      throw new SystemError(`Failed to parse workflow JSON from ${filePath}: ${err.message}`);
    }
  }

  if (ext === '.yaml' || ext === '.yml') {
    try {
      const parsed = yaml.load(content);
      if (parsed === null || typeof parsed !== 'object') {
        throw new SystemError(`Workflow YAML in ${filePath} did not parse to an object`);
      }
      return parsed;
    } catch (err) {
      if (err instanceof SystemError) throw err;
      throw new SystemError(`Failed to parse workflow YAML from ${filePath}: ${err.message}`);
    }
  }

  throw new SystemError(
    `Unsupported workflow file extension "${ext}" in ${filePath}. Use .json, .yaml, or .yml`
  );
}

/**
 * Serializes a workflow object to a string in the specified format.
 *
 * Pure function — no I/O. Inverse of parseWorkflowFile.
 *
 * @param {Object} workflow - Workflow configuration object
 * @param {'json'|'yaml'|'yml'} format - Output format
 * @returns {string} Serialized workflow content
 * @throws {SystemError} If format is unsupported or serialization fails
 * @pure
 */
export function serializeWorkflow(workflow, format) {
  const normalized = (format || '').toLowerCase().replace(/^\./, '');

  if (normalized === 'json') {
    try {
      return JSON.stringify(workflow, null, 2);
    } catch (err) {
      throw new SystemError(`Failed to serialize workflow to JSON: ${err.message}`);
    }
  }

  if (normalized === 'yaml' || normalized === 'yml') {
    try {
      return yaml.dump(workflow, { lineWidth: -1 });
    } catch (err) {
      throw new SystemError(`Failed to serialize workflow to YAML: ${err.message}`);
    }
  }

  throw new SystemError(
    `Unsupported serialization format "${format}". Use "json", "yaml", or "yml".`
  );
}

/**
 * Workflow Engine for orchestrating step execution.
 * Handles workflow loading, execution, state management, and event emission.
 *
 * @class
 * @extends EventEmitter
 *
 * @fires WorkflowEngine#step:start
 * @fires WorkflowEngine#step:complete
 * @fires WorkflowEngine#step:error
 * @fires WorkflowEngine#step:skipped
 * @fires WorkflowEngine#ai:stream:chunk - Emitted per token when streaming is enabled.
 *   Payload: `{ stepId, stepName, persona, delta, tokenIndex }`
 * @fires WorkflowEngine#ai:stream:end - Emitted once per AI request when streaming ends.
 *   Payload: `{ stepId, stepName, totalTokens, durationMs, tokensPerSec }`
 *
 * @example
 * const engine = new WorkflowEngine({ dryRun: false });
 * engine.on('step:start', ({ step }) => console.log(`Starting ${step.name}`));
 * await engine.loadWorkflow('./workflow.json');
 * const result = await engine.executeWorkflow();
 */
export class WorkflowEngine extends EventEmitter {
  /**
   * Creates Workflow Engine instance.
   *
   * @param {Object} [options={}] - Engine options
   * @param {boolean} [options.dryRun=false] - Dry run mode
   * @param {string} [options.projectRoot] - Project root directory
   * @param {number} [options.defaultTimeout=300000] - Default step timeout (5 min)
   * @param {number} [options.maxRetries=3] - Default max retries per step
   */
  constructor(options = {}) {
    super();

    this.options = {
      dryRun: options.dryRun || false,
      projectRoot: options.projectRoot || process.cwd(),
      defaultTimeout: options.defaultTimeout || 300000, // 5 minutes
      maxRetries: options.maxRetries || 3,
      ...options,
    };

    this.workflow = null;
    this.executionPlan = null;
    this.context = null;
    this.currentStep = null;
    this.results = [];
    this.aborted = false;
  }

  /**
   * Abort workflow execution. The currently-running step will finish, then
   * the loop exits cleanly. Safe to call multiple times.
   */
  abort() {
    if (!this.aborted) {
      this.aborted = true;
      this.emit('workflow:aborted', { currentStep: this.currentStep });
    }
  }

  /**
   * Loads workflow configuration.
   *
   * @param {Object|string} workflowOrPath - Workflow object or path to file
   * @returns {Promise<Object>} Loaded workflow
   *
   * @throws {ValidationError} If workflow is invalid
   */
  async loadWorkflow(workflowOrPath) {
    logger.info('Loading workflow configuration...');

    let workflow;

    if (typeof workflowOrPath === 'string') {
      const ext = extname(workflowOrPath).toLowerCase();
      if (!['.json', '.yaml', '.yml'].includes(ext)) {
        throw new SystemError(
          `Unsupported workflow file extension "${ext || '(none)'}". Use .json, .yaml, or .yml.`
        );
      }
      let content;
      try {
        content = await fs.readFile(workflowOrPath, 'utf8');
      } catch (err) {
        throw new SystemError(`Failed to read workflow file "${workflowOrPath}": ${err.message}`);
      }
      workflow = parseWorkflowFile(content, workflowOrPath);
    } else {
      workflow = workflowOrPath;
    }

    // Validate workflow
    const validation = validateWorkflowConfig(workflow);
    if (!validation.isValid) {
      logger.error(`Workflow validation failed: ${validation.errors.join(', ')}`);
      throw new ValidationError(`Invalid workflow configuration: ${validation.errors.join('; ')}`);
    }

    // Store workflow
    this.workflow = workflow;

    // Build execution plan
    this.executionPlan = buildExecutionPlan(workflow.steps);

    logger.success(`Workflow loaded: ${workflow.name} v${workflow.version}`);
    logger.info(`Execution plan: ${this.executionPlan.length} steps`);
    if (this.executionPlan.length > 0) {
      logger.info('Resolved execution queue:');
      formatExecutionPlanLines(this.executionPlan).forEach((line) => logger.info(line));
    }

    this.emit('workflow:loaded', { workflow, executionPlan: this.executionPlan });

    return workflow;
  }

  /**
   * Saves the currently loaded workflow to a file.
   *
   * The output format is determined by the file extension (.json, .yaml, .yml).
   *
   * @param {string} filePath - Destination file path
   * @returns {Promise<void>}
   * @throws {SystemError} If no workflow is loaded, extension is unsupported, or write fails
   *
   * @example
   * await engine.loadWorkflow('./workflow.yaml');
   * // ... modify engine.workflow ...
   * await engine.saveWorkflow('./workflow-updated.json');
   */
  async saveWorkflow(filePath) {
    if (!this.workflow) {
      throw new SystemError('No workflow loaded. Call loadWorkflow() first.');
    }

    const ext = extname(filePath).toLowerCase();
    if (!['.json', '.yaml', '.yml'].includes(ext)) {
      throw new SystemError(
        `Unsupported workflow file extension "${ext || '(none)'}". Use .json, .yaml, or .yml.`
      );
    }

    const format = ext.replace('.', ''); // '.json' → 'json'
    const content = serializeWorkflow(this.workflow, format);

    try {
      await fs.writeFile(filePath, content, 'utf8');
    } catch (err) {
      throw new SystemError(`Failed to write workflow file "${filePath}": ${err.message}`);
    }

    logger.success(`Workflow saved to ${filePath}`);
  }

  /**
   * Executes the loaded workflow.
   *
   * @param {Object} [options={}] - Execution options
   * @param {string} [options.startFromStep] - Step ID to start from
   * @param {string} [options.stopAtStep] - Step ID to stop at
   * @param {Object} [options.context] - Additional context
   * @returns {Promise<Object>} Execution results
   *
   * @throws {SystemError} If workflow not loaded
   */
  async executeWorkflow(options = {}) {
    if (!this.workflow) {
      throw new SystemError('No workflow loaded. Call loadWorkflow() first.');
    }

    logger.info(`Starting workflow execution: ${this.workflow.name}`);

    // Create execution context
    this.context = createExecutionContext(this.workflow, {
      ...this.options,
      ...options,
      startTime: Date.now(),
    });

    this.results = [];
    this.aborted = false;

    this.emit('workflow:start', { workflow: this.workflow, context: this.context });

    const startTime = Date.now();
    const { dependencyMap, reverseDependencyMap } = buildDependencyMaps(this.executionPlan);
    const blockedSteps = new Map();

    try {
      // Execute steps in order
      for (const step of this.executionPlan) {
        // Check if we should start from a specific step
        if (options.startFromStep && !this._isAfterOrEqual(step.id, options.startFromStep)) {
          logger.debug(`Skipping step ${step.id} (before start point)`);
          continue;
        }

        const blockedBy = blockedSteps.get(step.id);
        if (blockedBy) {
          const result = {
            stepId: step.id,
            stepName: step.name,
            success: true,
            skipped: true,
            reason: `Blocked by failed critical dependency: ${blockedBy}`,
            blockedBy,
            duration: 0,
          };
          this.results.push(result);
          this.context.results.push(result);
          this.emit('step:skipped', { step, result });
          continue;
        }

        const failedDependency = (reverseDependencyMap.get(step.id) || []).find((dependencyId) =>
          this.results.some((result) => result.stepId === dependencyId && result.success === false)
        );
        if (failedDependency) {
          const result = {
            stepId: step.id,
            stepName: step.name,
            success: true,
            skipped: true,
            reason: `Blocked by failed dependency: ${failedDependency}`,
            blockedBy: failedDependency,
            duration: 0,
          };
          this.results.push(result);
          this.context.results.push(result);
          this.emit('step:skipped', { step, result });
          continue;
        }

        // Execute step
        const result = await this.executeStep(step, this.context);
        this.results.push(result);

        // Update context state
        this.context.results.push(result);

        // Propagate any context fields the step wants to share with later steps
        if (result.output?.contextUpdate) {
          Object.assign(this.context, result.output.contextUpdate);
        }

        // Check if workflow was aborted (e.g. via Ctrl+C)
        if (this.aborted) {
          logger.warn('Workflow aborted by user.');
          break;
        }

        // Check if we should stop
        if (options.stopAtStep && step.id === options.stopAtStep) {
          logger.info(`Stopping at step ${step.id} as requested`);
          break;
        }

        // Stop on critical failure if configured
        if (!result.success && step.critical !== false) {
          const dependencyCone = collectDependentCone(step.id, dependencyMap);
          dependencyCone.forEach((dependentStepId) => {
            if (!blockedSteps.has(dependentStepId)) {
              blockedSteps.set(dependentStepId, step.id);
            }
          });

          if (dependencyCone.size === 0) {
            logger.error(`Critical step ${step.id} failed. Stopping workflow.`);
            break;
          }

          logger.error(
            `Critical step ${step.id} failed. Blocking dependent steps: ${[...dependencyCone].join(', ')}.`
          );
        }
      }

      const duration = Date.now() - startTime;
      const summary = mergeStepResults(this.results);

      if (this.aborted) {
        logger.warn(`Workflow aborted after ${duration}ms`);
        this.emit('workflow:complete', { results: this.results, summary, duration, aborted: true });
        return {
          success: false,
          aborted: true,
          summary,
          results: this.results,
          duration,
          context: this.context,
        };
      }

      if (summary.failed === 0) {
        logger.success(`Workflow completed successfully in ${duration}ms`);
      } else {
        logger.warn(`Workflow finished with failures in ${duration}ms`);
      }
      logger.info(`Results: ${summary.succeeded}/${summary.total} steps succeeded`);

      this.emit('workflow:complete', { results: this.results, summary, duration });

      return {
        success: summary.failed === 0,
        summary,
        results: this.results,
        duration,
        context: this.context,
      };
    } catch (error) {
      logger.error(`Workflow execution failed: ${error.message}`);
      this.emit('workflow:error', { error, results: this.results });

      throw error;
    }
  }

  /**
   * Executes a single workflow step.
   *
   * @param {Object} step - Step definition
   * @param {Object} context - Execution context
   * @returns {Promise<Object>} Step result
   */
  async executeStep(step, context) {
    logger.info(`Executing step: ${formatExecutionStepName(step)} (${step.id})`);

    this.currentStep = step;
    const startTime = Date.now();

    this.emit('step:start', { step, context });

    try {
      // Check if step should be executed
      if (!shouldExecuteStep(step, context)) {
        logger.info(`Step ${step.id} skipped (condition not met)`);

        const result = {
          stepId: step.id,
          stepName: step.name,
          success: true,
          skipped: true,
          reason: 'Condition not met',
          duration: 0,
        };

        this.emit('step:skipped', { step, result });
        return result;
      }

      // Dry run mode
      if (this.options.dryRun) {
        logger.info(`[DRY RUN] Would execute step: ${step.name}`);

        const result = {
          stepId: step.id,
          stepName: step.name,
          success: true,
          dryRun: true,
          duration: 0,
        };

        this.emit('step:complete', { step, result });
        return result;
      }

      // Execute step handler if provided
      if (typeof step.handler === 'function') {
        const output = await step.handler(context);

        const duration = Date.now() - startTime;
        const maxStepWallTimeSeconds =
          typeof step.max_step_wall_time === 'number'
            ? step.max_step_wall_time
            : typeof step.metadata?.maxStepWallTime === 'number'
              ? step.metadata.maxStepWallTime
              : null;
        const result = {
          stepId: step.id,
          stepName: step.name,
          success: output?.success !== false,
          skipped: output?.skipped === true,
          reason: output?.reason,
          output,
          duration,
          degraded: output?.degraded === true,
          warnings: Array.isArray(output?.warnings) ? output.warnings : undefined,
        };
        if (maxStepWallTimeSeconds && duration > maxStepWallTimeSeconds * 1000) {
          result.budgetExceeded = {
            budgetMs: maxStepWallTimeSeconds * 1000,
            durationMs: duration,
          };
          this.emit('step:budget_exceeded', {
            step,
            result,
            budgetMs: maxStepWallTimeSeconds * 1000,
            durationMs: duration,
          });
        }

        if (result.skipped) {
          logger.info(`Step ${step.id} skipped in ${duration}ms`);
        } else if (!result.success) {
          logger.error(`Step ${step.id} completed with failure in ${duration}ms`);
        } else if (result.output?.degraded === true) {
          logger.warn(`Step ${step.id} completed with degradation in ${duration}ms`);
        } else {
          logger.success(`Step ${step.id} completed in ${duration}ms`);
        }
        this.emit('step:complete', { step, result });

        return result;
      }

      // No handler - just mark as complete
      const duration = Date.now() - startTime;
      const result = {
        stepId: step.id,
        stepName: step.name,
        success: true,
        duration,
      };

      this.emit('step:complete', { step, result });
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      logger.error(`Step ${step.id} failed: ${error.message}`);

      const result = {
        stepId: step.id,
        stepName: step.name,
        success: false,
        error: {
          message: error.message,
          name: error.name,
          stack: error.stack,
        },
        duration,
      };

      this.emit('step:error', { step, error, result });

      return result;
    } finally {
      this.currentStep = null;
    }
  }

  /**
   * Gets current workflow status.
   *
   * @returns {Object} Status information
   */
  getStatus() {
    if (!this.workflow) {
      return { state: 'idle', workflow: null };
    }

    const completed = this.results.length;
    const total = this.executionPlan?.length || 0;
    const progress = calculateWorkflowProgress(completed, total);

    return {
      state: this.currentStep ? 'running' : 'idle',
      workflow: {
        name: this.workflow.name,
        version: this.workflow.version,
      },
      currentStep: this.currentStep,
      progress,
      completed,
      total,
      results: this.results,
    };
  }

  /**
   * Checks if stepA is after or equal to stepB in execution plan.
   *
   * @private
   * @param {string} stepA - First step ID
   * @param {string} stepB - Second step ID
   * @returns {boolean} True if stepA is after or equal to stepB
   */
  _isAfterOrEqual(stepA, stepB) {
    const indexA = this.executionPlan.findIndex((s) => s.id === stepA);
    const indexB = this.executionPlan.findIndex((s) => s.id === stepB);
    return indexA >= indexB;
  }
}
