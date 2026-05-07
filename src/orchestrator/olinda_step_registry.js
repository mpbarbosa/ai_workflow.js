/**
 * Vendored from `olinda_orchestrator/src/step_registry.ts` v0.4.1.
 *
 * The upstream module now imports helper functions from
 * `generic_step_registry.ts`. This repository keeps those helpers inlined here
 * because `tsconfig.json` compiles this file directly with `allowJs=false`,
 * while the local legacy `generic_step_registry.js` still serves the older
 * phase-based registry implementation.
 */
/** Thrown when a step definition fails validation (bad input from the caller). */
export class StepRegistryValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'StepRegistryValidationError';
  }
}
/** Thrown for internal registry failures unrelated to caller-provided input. */
export class StepRegistrySystemError extends Error {
  constructor(message) {
    super(message);
    this.name = 'StepRegistrySystemError';
  }
}
function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}
/** Steps whose IDs contain no numeric component sort after all numbered steps. */
const NUMERIC_SORT_FALLBACK = 999;
function getStage(input) {
  return input.stage ?? input.phase ?? 'default';
}
function getStepMetadataExtras(metadata) {
  return Object.entries(metadata).reduce((extras, [key, value]) => {
    if (key !== 'registeredAt' && key !== 'version') {
      extras[key] = value;
    }
    return extras;
  }, {});
}
export function validateStepMetadata(metadata) {
  const errors = [];
  if (!isRecord(metadata)) {
    errors.push('metadata must be an object');
    return errors;
  }
  if (typeof metadata.id !== 'string' || metadata.id.length === 0) {
    errors.push('id is required and must be a string');
  } else if (!/^[a-z0-9_]+$/.test(metadata.id)) {
    errors.push('id must contain only lowercase letters, numbers, and underscores');
  }
  if (typeof metadata.name !== 'string' || metadata.name.length === 0) {
    errors.push('name is required and must be a string');
  }
  if (typeof metadata.description !== 'string' || metadata.description.length === 0) {
    errors.push('description is required and must be a string');
  }
  if (metadata.stage !== undefined && !isNonEmptyString(metadata.stage)) {
    errors.push('stage must be a non-empty string');
  }
  if (metadata.phase !== undefined && !isNonEmptyString(metadata.phase)) {
    errors.push('phase must be a non-empty string');
  }
  if (
    typeof metadata.stage === 'string' &&
    typeof metadata.phase === 'string' &&
    metadata.stage !== metadata.phase
  ) {
    errors.push('stage and phase must match when both are provided');
  }
  if (metadata.dependencies !== undefined) {
    if (!Array.isArray(metadata.dependencies)) {
      errors.push('dependencies must be an array');
    } else if (!metadata.dependencies.every((dependency) => typeof dependency === 'string')) {
      errors.push('all dependencies must be strings');
    }
  }
  if (metadata.tags !== undefined) {
    if (!Array.isArray(metadata.tags)) {
      errors.push('tags must be an array');
    } else if (!metadata.tags.every((tag) => typeof tag === 'string')) {
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
  if (metadata.requirements !== undefined && !isRecord(metadata.requirements)) {
    errors.push('requirements must be an object');
  }
  if (metadata.execute !== undefined && typeof metadata.execute !== 'function') {
    errors.push('execute must be a function');
  }
  if (metadata.handler !== undefined && typeof metadata.handler !== 'function') {
    errors.push('handler must be a function');
  }
  return errors;
}
/**
 * Creates a normalized `StepDefinition` from loose input, applying all defaults.
 * @throws {StepRegistryValidationError} when the input fails validation.
 */
export function createStepDefinition(metadata) {
  const errors = validateStepMetadata(metadata);
  if (errors.length > 0) {
    throw new StepRegistryValidationError(`Invalid step metadata: ${errors.join(', ')}`);
  }
  return {
    id: metadata.id,
    name: metadata.name,
    description: metadata.description,
    stage: getStage(metadata),
    dependencies: metadata.dependencies ?? [],
    tags: metadata.tags ?? [],
    critical: metadata.critical ?? false,
    enabled: metadata.enabled !== false,
    timeout: metadata.timeout ?? 300,
    requirements: metadata.requirements ?? {},
    execute: metadata.execute ?? metadata.handler,
    metadata: {
      registeredAt: metadata.registeredAt ?? metadata.registered ?? null,
      version: metadata.version ?? '1.0.0',
      ...(metadata.metadata ?? {}),
    },
  };
}
export function matchStepRequirements(step, context = {}) {
  const result = {
    met: true,
    missing: [],
  };
  const requirements = step.requirements;
  if (!requirements || Object.keys(requirements).length === 0) {
    return result;
  }
  if (requirements.files && Array.isArray(requirements.files)) {
    const availableFiles = context.files ?? [];
    const missingFiles = requirements.files.filter((file) => !availableFiles.includes(file));
    if (missingFiles.length > 0) {
      result.met = false;
      result.missing.push(...missingFiles.map((file) => `file:${file}`));
    }
  }
  if (requirements.tools && Array.isArray(requirements.tools)) {
    const availableTools = context.tools ?? [];
    const missingTools = requirements.tools.filter((tool) => !availableTools.includes(tool));
    if (missingTools.length > 0) {
      result.met = false;
      result.missing.push(...missingTools.map((tool) => `tool:${tool}`));
    }
  }
  if (requirements.config && isRecord(requirements.config)) {
    const config = context.config ?? {};
    for (const [key, value] of Object.entries(requirements.config)) {
      if (config[key] !== value) {
        result.met = false;
        result.missing.push(`config:${key}=${String(value)}`);
      }
    }
  }
  if (requirements.env && Array.isArray(requirements.env)) {
    const env = context.env ?? {};
    const missingEnv = requirements.env.filter((variable) => !env[variable]);
    if (missingEnv.length > 0) {
      result.met = false;
      result.missing.push(...missingEnv.map((variable) => `env:${variable}`));
    }
  }
  return result;
}
/** Groups steps by their `stage`, returning a map of stage name -> step array. */
export function groupStepsByStage(steps) {
  const groups = {};
  for (const step of steps) {
    groups[step.stage] ??= [];
    groups[step.stage].push(step);
  }
  return groups;
}
/**
 * @deprecated Use `groupStepsByStage` instead. `phase` is a legacy alias for `stage`.
 */
export function groupStepsByPhase(steps) {
  return groupStepsByStage(steps);
}
/**
 * Returns only the steps that match all of the provided tags.
 * Returns all steps when `tags` is empty or omitted.
 */
export function filterStepsByTags(steps, tags) {
  if (!tags || tags.length === 0) {
    return steps;
  }
  return steps.filter((step) => tags.every((tag) => step.tags.includes(tag)));
}
/**
 * Returns only enabled steps when `enabledOnly` is true (the default).
 * Pass `false` to return all steps regardless of their `enabled` flag.
 */
export function filterStepsByEnabled(steps, enabledOnly = true) {
  if (!enabledOnly) {
    return steps;
  }
  return steps.filter((step) => step.enabled !== false);
}
/** Returns all steps whose `stage` matches the given value. */
export function findStepsByStage(steps, stage) {
  return steps.filter((step) => step.stage === stage);
}
/**
 * @deprecated Use `findStepsByStage` instead. `phase` is a legacy alias for `stage`.
 */
export function findStepsByPhase(steps, phase) {
  return findStepsByStage(steps, phase);
}
/**
 * Returns a sorted copy of `steps` ordered by the first numeric run in each ID.
 * Steps with no numeric component in their ID sort after all numbered steps.
 */
export function sortStepsById(steps) {
  return [...steps].sort((left, right) => {
    const leftNumber = parseInt(left.id.match(/\d+/)?.[0] ?? String(NUMERIC_SORT_FALLBACK), 10);
    const rightNumber = parseInt(right.id.match(/\d+/)?.[0] ?? String(NUMERIC_SORT_FALLBACK), 10);
    return leftNumber - rightNumber;
  });
}
/**
 * Validates that every dependency declared on each step refers to a known step ID.
 * Returns `{ valid: true, errors: [] }` when all dependencies resolve.
 */
export function validateStepDependencies(steps) {
  const result = {
    valid: true,
    errors: [],
  };
  const stepIds = new Set(steps.map((step) => step.id));
  for (const step of steps) {
    const dependencies = Array.isArray(step.dependencies) ? step.dependencies : [];
    for (const dependency of dependencies) {
      if (!stepIds.has(dependency)) {
        result.valid = false;
        result.errors.push(`Step '${step.id}' depends on non-existent step '${dependency}'`);
      }
    }
  }
  return result;
}
export class StepRegistry {
  steps = new Map();
  registrationOrder = [];
  /**
   * Registers a new step under `stepId` with the provided definition.
   * @throws {StepRegistryValidationError} when `stepId` is already registered or the definition is invalid.
   */
  register(stepId, definition) {
    if (this.steps.has(stepId)) {
      throw new StepRegistryValidationError(`Step '${stepId}' is already registered`);
    }
    const step = createStepDefinition({
      ...definition,
      id: stepId,
      registeredAt: Date.now(),
    });
    this.steps.set(stepId, step);
    this.registrationOrder.push(stepId);
    return step;
  }
  /**
   * Applies partial updates to an existing step, preserving all unspecified fields.
   * @throws {StepRegistryValidationError} when `stepId` is not found or the updated definition is invalid.
   */
  update(stepId, updates) {
    const existing = this.steps.get(stepId);
    if (!existing) {
      throw new StepRegistryValidationError(`Step '${stepId}' not found`);
    }
    const step = createStepDefinition({
      id: stepId,
      name: updates.name ?? existing.name,
      description: updates.description ?? existing.description,
      stage: updates.stage ?? updates.phase ?? existing.stage,
      dependencies: updates.dependencies ?? existing.dependencies,
      tags: updates.tags ?? existing.tags,
      critical: updates.critical ?? existing.critical,
      enabled: updates.enabled ?? existing.enabled,
      timeout: updates.timeout ?? existing.timeout,
      requirements: updates.requirements ?? existing.requirements,
      execute: updates.execute ?? updates.handler ?? existing.execute,
      registeredAt: existing.metadata.registeredAt,
      version: updates.version ?? existing.metadata.version,
      metadata: {
        ...getStepMetadataExtras(existing.metadata),
        ...(updates.metadata ?? {}),
      },
    });
    this.steps.set(stepId, step);
    return step;
  }
  /** Removes `stepId` from the registry. Returns `true` if the step existed and was removed. */
  unregister(stepId) {
    const deleted = this.steps.delete(stepId);
    if (deleted) {
      this.registrationOrder = this.registrationOrder.filter(
        (registeredId) => registeredId !== stepId
      );
    }
    return deleted;
  }
  /** Returns the step definition for `stepId`, or `null` if not found. */
  get(stepId) {
    return this.steps.get(stepId) ?? null;
  }
  /** Returns `true` when `stepId` is registered. */
  has(stepId) {
    return this.steps.has(stepId);
  }
  /**
   * Returns registered steps that match the filter, sorted by numeric ID order.
   * Defaults to returning only enabled steps; pass `{ enabledOnly: false }` to include disabled ones.
   */
  list(filter = {}) {
    let steps = Array.from(this.steps.values());
    const stage = filter.stage ?? filter.phase;
    if (stage) {
      steps = findStepsByStage(steps, stage);
    }
    if (filter.tags && filter.tags.length > 0) {
      steps = filterStepsByTags(steps, filter.tags);
    }
    if (filter.enabledOnly !== false) {
      steps = filterStepsByEnabled(steps);
    }
    return sortStepsById(steps);
  }
  /** Returns all registered steps grouped by their `stage` value. */
  getByStage() {
    return groupStepsByStage(Array.from(this.steps.values()));
  }
  /**
   * @deprecated Use `getByStage()` instead. `phase` is a legacy alias for `stage`.
   */
  getByPhase() {
    return this.getByStage();
  }
  /** Returns all registered steps in the order they were registered. */
  getInOrder() {
    return this.registrationOrder
      .map((stepId) => this.steps.get(stepId))
      .filter((step) => step !== undefined);
  }
  /** Validates all inter-step dependency references; returns errors for missing dependencies. */
  validateAll() {
    return validateStepDependencies(Array.from(this.steps.values()));
  }
  /**
   * Checks whether the requirements declared on `stepId` are satisfied by `context`.
   * @throws {StepRegistryValidationError} when `stepId` is not found.
   */
  checkRequirements(stepId, context = {}) {
    const step = this.get(stepId);
    if (!step) {
      throw new StepRegistryValidationError(`Step '${stepId}' not found`);
    }
    return matchStepRequirements(step, context);
  }
  /** Removes all steps and resets registration order. */
  clear() {
    this.steps.clear();
    this.registrationOrder = [];
  }
  /** Returns aggregate counts for the registered steps (total, enabled, disabled, critical, by stage). */
  getStats() {
    const steps = Array.from(this.steps.values());
    const byStage = steps.reduce((counts, step) => {
      counts[step.stage] = (counts[step.stage] ?? 0) + 1;
      return counts;
    }, {});
    return {
      total: steps.length,
      enabled: filterStepsByEnabled(steps).length,
      disabled: steps.filter((step) => step.enabled === false).length,
      critical: steps.filter((step) => step.critical === true).length,
      byStage,
    };
  }
  /**
   * Not yet implemented - placeholder for future directory-based step discovery.
   * @throws {StepRegistrySystemError} always, until this method is implemented.
   */
  loadStepsFromDirectory(dir) {
    throw new StepRegistrySystemError(`loadStepsFromDirectory not yet implemented: ${dir}`);
  }
}
