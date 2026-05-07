/**
 * @fileoverview Step definition helpers - phase rules and metadata normalization
 * @module orchestrator/step_definition
 */

import { ValidationError } from '../utils/errors.js';

export const WORKFLOW_PHASES = Object.freeze([
  'analysis',
  'validation',
  'testing',
  'quality',
  'finalization',
  'execution',
]);

function buildDefaultPhaseGroups() {
  return Object.fromEntries(WORKFLOW_PHASES.map((phase) => [phase, []]));
}

function validateRequiredFields(metadata, errors) {
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
}

function validatePhase(metadata, errors) {
  if (metadata.phase !== undefined && !WORKFLOW_PHASES.includes(metadata.phase)) {
    errors.push(`phase must be one of: ${WORKFLOW_PHASES.join(', ')}`);
  }
}

function validateStringArrayField(metadata, fieldName, errors) {
  if (metadata[fieldName] === undefined) {
    return;
  }

  if (!Array.isArray(metadata[fieldName])) {
    errors.push(`${fieldName} must be an array`);
    return;
  }

  if (!metadata[fieldName].every((value) => typeof value === 'string')) {
    errors.push(`all ${fieldName} must be strings`);
  }
}

function validateBooleanField(metadata, fieldName, errors) {
  if (metadata[fieldName] !== undefined && typeof metadata[fieldName] !== 'boolean') {
    errors.push(`${fieldName} must be a boolean`);
  }
}

function validateTimeout(metadata, errors) {
  if (metadata.timeout === undefined) {
    return;
  }

  if (typeof metadata.timeout !== 'number') {
    errors.push('timeout must be a number');
  } else if (metadata.timeout <= 0) {
    errors.push('timeout must be greater than 0');
  }
}

function buildStepMetadata(metadata) {
  return {
    registered: metadata.registered || null,
    version: metadata.version || '1.0.0',
    ...metadata.metadata,
  };
}

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
    metadata: buildStepMetadata(metadata),
  };
}

export function validateStepMetadata(metadata) {
  const errors = [];

  if (!metadata || typeof metadata !== 'object') {
    errors.push('metadata must be an object');
    return errors;
  }

  validateRequiredFields(metadata, errors);
  validatePhase(metadata, errors);
  validateStringArrayField(metadata, 'dependencies', errors);
  validateStringArrayField(metadata, 'tags', errors);
  validateBooleanField(metadata, 'critical', errors);
  validateBooleanField(metadata, 'enabled', errors);
  validateTimeout(metadata, errors);

  if (metadata.requirements !== undefined && typeof metadata.requirements !== 'object') {
    errors.push('requirements must be an object');
  }

  if (metadata.handler !== undefined && typeof metadata.handler !== 'function') {
    errors.push('handler must be a function');
  }

  return errors;
}

export function groupStepsByPhase(steps) {
  const groups = buildDefaultPhaseGroups();

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
