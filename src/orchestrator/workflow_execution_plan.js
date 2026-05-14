/**
 * @fileoverview Workflow execution planning and dependency rules
 * @module orchestrator/workflow_execution_plan
 */

import path from 'path';
import { logger } from '../core/logger.js';
import {
  DEFAULT_TERMINAL_BRANCH_DEPENDENCIES,
  ORDER_LOCKED_CANONICAL_DEPENDENCIES,
  ORDER_LOCKED_TERMINAL_DEPENDENCIES,
  TERMINAL_FINALIZATION_STEP_ORDER,
  WORKFLOW_STAGES,
  enforceTerminalStepOrder,
  getStepsForStage,
} from './workflow_step_catalog.js';

export function normalizeWorkflowConfigStepId(stepId) {
  if (typeof stepId !== 'string') {
    return null;
  }

  const trimmed = stepId.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith('step_')) {
    return trimmed;
  }

  const normalized = trimmed.replace(/\s+/g, '');
  if (!/^[0-9a-z_]+$/i.test(normalized)) {
    return null;
  }

  return `step_${normalized.toLowerCase()}`;
}

export function buildWorkflowConfigStepIndex(workflowConfig) {
  const configuredSteps = workflowConfig?.workflow?.steps;
  if (!Array.isArray(configuredSteps)) {
    return {};
  }

  const validPhases = new Set(['analysis', 'validation', 'testing', 'quality', 'finalization']);
  const index = {};

  for (const step of configuredSteps) {
    const stepId = normalizeWorkflowConfigStepId(step?.id);
    if (!stepId) {
      continue;
    }

    const dependencies = Array.isArray(step.dependencies)
      ? step.dependencies.map(normalizeWorkflowConfigStepId).filter(Boolean)
      : undefined;
    const phase = validPhases.has(step.phase) ? step.phase : undefined;
    const dependencyComment =
      typeof step.dependency_comment === 'string' && step.dependency_comment.trim()
        ? step.dependency_comment.trim()
        : undefined;
    const priority = Number.isFinite(step.priority) ? Number(step.priority) : undefined;
    const maxStepWallTime =
      Number.isFinite(step.max_step_wall_time) && Number(step.max_step_wall_time) > 0
        ? Number(step.max_step_wall_time)
        : undefined;

    index[stepId] = {
      enabled: step.enabled !== false,
      dependencies,
      phase,
      critical: step.required === true ? true : step.optional === true ? false : undefined,
      name: typeof step.name === 'string' ? step.name : undefined,
      description: typeof step.description === 'string' ? step.description : undefined,
      dependencyComment,
      priority,
      maxStepWallTime,
    };
  }

  return index;
}

export function getDisabledWorkflowConfigStepIds(workflowConfig) {
  const configuredSteps = workflowConfig?.workflow?.steps;
  if (!Array.isArray(configuredSteps)) {
    return [];
  }

  return configuredSteps
    .filter((step) => step?.enabled === false)
    .map((step) => normalizeWorkflowConfigStepId(step?.id))
    .filter(Boolean);
}

export function normalizeDependencyList(dependencies = []) {
  if (!Array.isArray(dependencies)) {
    return [];
  }

  return [...new Set(dependencies.filter((dependencyId) => typeof dependencyId === 'string'))];
}

export function haveSameDependencySet(left = [], right = []) {
  const normalizedLeft = normalizeDependencyList(left);
  const normalizedRight = normalizeDependencyList(right);

  if (normalizedLeft.length !== normalizedRight.length) {
    return false;
  }

  const rightSet = new Set(normalizedRight);
  return normalizedLeft.every((dependencyId) => rightSet.has(dependencyId));
}

export function formatRuntimeStepName(step = {}) {
  const canonicalName = step.canonicalName || step.metadata?.canonicalName || step.name || step.id;
  const aliasName =
    step.aliasName ||
    (step.name && step.name !== canonicalName ? step.name : null) ||
    (step.metadata?.canonicalName && step.name && step.name !== step.metadata.canonicalName
      ? step.name
      : null);

  return aliasName ? `${aliasName} [canonical: ${canonicalName}]` : canonicalName;
}

function describeDependencyOverride(step = {}) {
  const effectiveDependencies = Array.isArray(step.dependencies) ? step.dependencies : [];
  const canonicalDependencies = Array.isArray(step.canonicalDependencies)
    ? step.canonicalDependencies
    : Array.isArray(step.metadata?.canonicalDependencies)
      ? step.metadata.canonicalDependencies
      : effectiveDependencies;

  const addedDependencies = effectiveDependencies.filter(
    (dependencyId) => !canonicalDependencies.includes(dependencyId)
  );
  const removedDependencies = canonicalDependencies.filter(
    (dependencyId) => !effectiveDependencies.includes(dependencyId)
  );

  if (addedDependencies.length === 0 && removedDependencies.length === 0) {
    return null;
  }

  const parts = [];
  if (addedDependencies.length > 0) {
    parts.push(`added ${addedDependencies.join(', ')}`);
  }
  if (removedDependencies.length > 0) {
    parts.push(`removed ${removedDependencies.join(', ')}`);
  }
  if (step.metadata?.dependencyComment) {
    parts.push(`reason: ${step.metadata.dependencyComment}`);
  }
  return parts.join('; ');
}

export function formatDependencyList(dependencies = []) {
  if (!Array.isArray(dependencies) || dependencies.length === 0) {
    return '[]';
  }

  return `[${dependencies.join(', ')}]`;
}

function buildLockedDependencyRemediationDetail(
  stepId,
  lockedMissing = [],
  disabledSet = new Set()
) {
  const disabledLockedMissing = lockedMissing.filter((dependencyId) =>
    disabledSet.has(dependencyId)
  );

  if (stepId === 'step_11' && disabledLockedMissing.includes('step_13')) {
    return (
      ' If you disabled step_13 because markdown lint tooling is unavailable, re-enable ' +
      'step_10 and step_13 instead — step_10 records a skipped result when no linter is ' +
      'configured, and step_13 records a skipped result when mdl is not installed.'
    );
  }

  return '';
}

export function buildWorkflowConfigDependencyOverrideError({
  configPath,
  stepId,
  stepName,
  stepEnabled = true,
  canonicalDependencies = [],
  rawConfiguredDependencies = [],
  effectiveDependencies = [],
  removedDependencies = [],
}) {
  const stepLabel =
    typeof stepName === 'string' && stepName.trim().length > 0 ? `${stepId} (${stepName})` : stepId;
  const restoreSnippet =
    canonicalDependencies.length > 0
      ? [
          'dependencies:',
          ...canonicalDependencies.map((dependencyId) => `  - ${dependencyId}`),
        ].join('\n')
      : 'dependencies: []';
  const overrideSnippetDependencies =
    effectiveDependencies.length > 0 ? effectiveDependencies : rawConfiguredDependencies;
  const overrideSnippet = [
    'dependencies:',
    ...overrideSnippetDependencies.map((dependencyId) => `  - ${dependencyId}`),
    'dependency_comment: "Explain why this dependency override is required for this project."',
  ].join('\n');
  const effectiveDependencyDetail = !haveSameDependencySet(
    rawConfiguredDependencies,
    effectiveDependencies
  )
    ? ` Effective dependencies after canonical enforcement: ${formatDependencyList(effectiveDependencies)}.`
    : '';
  const removedDependencyDetail =
    removedDependencies.length > 0
      ? ` Ignored unsafe dependency override(s): ${formatDependencyList(removedDependencies)}.`
      : '';
  const disabledStepDetail = stepEnabled
    ? ''
    : ' The step is disabled in .workflow-config.yaml, but disabled steps still require dependency_comment when they override canonical dependencies.';
  const disabledRemoveKeyOption = stepEnabled
    ? ''
    : '\nOr, since this step is disabled and will never execute, simply remove the dependencies key — canonical dependencies apply but never run:\n# (remove the dependencies key from this step entry)';
  return (
    `[WorkflowConfig] Step ${stepLabel} in ${configPath} overrides canonical dependencies ` +
    `without dependency_comment. Canonical dependencies: ${formatDependencyList(canonicalDependencies)}. ` +
    `Raw configured dependencies: ${formatDependencyList(rawConfiguredDependencies)}.` +
    effectiveDependencyDetail +
    removedDependencyDetail +
    disabledStepDetail +
    `Restore the canonical dependencies, for example:\n${restoreSnippet}\n` +
    `Or, if the override is intentional, keep the effective dependencies and add dependency_comment, for example:\n${overrideSnippet}` +
    disabledRemoveKeyOption
  );
}

export function buildWorkflowConfigDependencyOverrideDiagnostic({
  stepId,
  stepName,
  stepEnabled = true,
  canonicalDependencies = [],
  rawConfiguredDependencies = [],
  effectiveDependencies = [],
  removedDependencies = [],
  addedDependencies = [],
}) {
  const stepLabel =
    typeof stepName === 'string' && stepName.trim().length > 0 ? `${stepId} (${stepName})` : stepId;
  const parts = [
    `[WorkflowConfig] Invalid dependency override for ${stepLabel}`,
    `canonical=${formatDependencyList(canonicalDependencies)}`,
    `raw=${formatDependencyList(rawConfiguredDependencies)}`,
  ];

  if (!haveSameDependencySet(rawConfiguredDependencies, effectiveDependencies)) {
    parts.push(`effective=${formatDependencyList(effectiveDependencies)}`);
  }
  if (addedDependencies.length > 0) {
    parts.push(`added_prerequisites=${formatDependencyList(addedDependencies)}`);
  }
  if (removedDependencies.length > 0) {
    parts.push(`removed_unsafe=${formatDependencyList(removedDependencies)}`);
  }
  if (!stepEnabled) {
    parts.push('step_enabled=false');
  }
  parts.push(
    'dependency_comment=missing (check for typos: dependencyComment, dependency_comments, dep_comment)'
  );

  return parts.join(' | ');
}

export function getConfiguredStepsForStage(stage, workflowConfig) {
  const configuredSteps = workflowConfig?.workflow?.steps;
  const defaultStageSteps = getStepsForStage(stage);
  const mandatoryStageSteps = getMandatoryStepIdsForStage(stage, defaultStageSteps);
  if (!Array.isArray(configuredSteps) || configuredSteps.length === 0) {
    return defaultStageSteps;
  }

  const enabledConfiguredStepIds = configuredSteps
    .map((step) => ({
      id: normalizeWorkflowConfigStepId(step?.id),
      enabled: step?.enabled !== false,
    }))
    .filter((step) => step.id)
    .filter((step) => step.enabled)
    .map((step) => step.id);

  if (stage === WORKFLOW_STAGES.FULL) {
    return enforceTerminalStepOrder([...enabledConfiguredStepIds, ...mandatoryStageSteps]);
  }

  const configuredStepIds = new Set(
    configuredSteps.map((step) => normalizeWorkflowConfigStepId(step?.id)).filter(Boolean)
  );
  const disabledStepIds = new Set(
    configuredSteps
      .filter((step) => step?.enabled === false)
      .map((step) => normalizeWorkflowConfigStepId(step?.id))
      .filter(Boolean)
  );
  const configuredDefaultStageSteps = defaultStageSteps.filter(
    (stepId) => !disabledStepIds.has(stepId) && configuredStepIds.has(stepId)
  );

  return enforceTerminalStepOrder([
    ...(configuredDefaultStageSteps.length > 0
      ? configuredDefaultStageSteps
      : enabledConfiguredStepIds),
    ...mandatoryStageSteps,
  ]);
}

export function normalizeLegacyWorkflowStageStepDefinitions(workflowConfig) {
  const configuredStages = workflowConfig?.workflow?.stages;
  if (!configuredStages || typeof configuredStages !== 'object') {
    return { workflowConfig, warnings: [] };
  }

  let normalizedConfig = workflowConfig;
  let normalizedStages = configuredStages;
  const warnings = [];

  for (const stage of Object.values(WORKFLOW_STAGES)) {
    const stageConfig = normalizedStages?.[stage];
    if (!stageConfig || !Object.prototype.hasOwnProperty.call(stageConfig, 'steps')) {
      continue;
    }

    if (!Array.isArray(stageConfig.steps)) {
      continue;
    }

    const configuredStepIds = stageConfig.steps.map(normalizeWorkflowConfigStepId).filter(Boolean);
    const canonicalStepIds = getStepsForStage(stage);

    if (!haveSameDependencySet(configuredStepIds, canonicalStepIds)) {
      continue;
    }

    if (normalizedConfig === workflowConfig) {
      normalizedStages = { ...configuredStages };
      normalizedConfig = {
        ...workflowConfig,
        workflow: {
          ...workflowConfig.workflow,
          stages: normalizedStages,
        },
      };
    }

    const nextStageConfig = { ...stageConfig };
    delete nextStageConfig.steps;
    normalizedStages[stage] = nextStageConfig;
    warnings.push(
      `[WorkflowConfig] Ignoring redundant legacy workflow.stages.${stage}.steps because it exactly matches the canonical ${stage} stage. Remove the 'steps:' key from .workflow-config.yaml to silence this warning.`
    );
  }

  return { workflowConfig: normalizedConfig, warnings };
}

export function validateWorkflowStageStepDefinitions(workflowConfig) {
  const configuredStages = workflowConfig?.workflow?.stages;
  if (!configuredStages || typeof configuredStages !== 'object') {
    return { valid: true, errors: [] };
  }

  const errors = [];

  for (const stage of Object.values(WORKFLOW_STAGES)) {
    const stageConfig = configuredStages?.[stage];
    if (!stageConfig || !Object.prototype.hasOwnProperty.call(stageConfig, 'steps')) {
      continue;
    }

    if (!Array.isArray(stageConfig.steps)) {
      errors.push(
        `[WorkflowConfig] workflow.stages.${stage}.steps must be an array of step IDs or be omitted. ` +
          'Execution planning derives from workflow.steps plus canonical stage rules.'
      );
      continue;
    }

    const configuredStepIds = stageConfig.steps.map(normalizeWorkflowConfigStepId).filter(Boolean);
    const canonicalStepIds = getStepsForStage(stage);
    if (haveSameDependencySet(configuredStepIds, canonicalStepIds)) {
      continue;
    }

    errors.push(
      `[WorkflowConfig] workflow.stages.${stage}.steps does not control execution order and must not redefine the ${stage} stage. ` +
        'Execution planning derives from workflow.steps plus canonical stage rules. ' +
        `Configured stage steps: ${formatDependencyList(configuredStepIds)}. ` +
        `Canonical ${stage} stage steps: ${formatDependencyList(canonicalStepIds)}. ` +
        `Remove the 'steps:' key from workflow.stages.${stage} entirely — only 'enabled: true|false' is supported here. ` +
        `To disable individual steps, set 'enabled: false' on the relevant entries under workflow.steps.`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function sanitizeWorkflowConfigDependencies(
  stepId,
  dependencies = [],
  defaultDependencies = [],
  options = {}
) {
  if (!Array.isArray(dependencies)) {
    return undefined;
  }

  const disabledSet = new Set(
    Array.isArray(options?.disabledStepIds)
      ? options.disabledStepIds.filter((id) => typeof id === 'string')
      : []
  );

  const deduped = [
    ...new Set(dependencies.filter((dependencyId) => typeof dependencyId === 'string')),
  ];

  const lockedTerminalDeps = ORDER_LOCKED_TERMINAL_DEPENDENCIES[stepId] || [];
  const branchTerminalDeps = (DEFAULT_TERMINAL_BRANCH_DEPENDENCIES[stepId] || []).filter(
    (depId) => !disabledSet.has(depId)
  );
  const requiredDependencies = [
    ...lockedTerminalDeps,
    ...branchTerminalDeps,
    ...(ORDER_LOCKED_CANONICAL_DEPENDENCIES[stepId] || []),
  ];

  if (requiredDependencies.length > 0) {
    const retained = deduped.filter(
      (dependencyId) =>
        !TERMINAL_FINALIZATION_STEP_ORDER.includes(dependencyId) ||
        requiredDependencies.includes(dependencyId)
    );
    const defaultTerminalBranchSet = new Set(DEFAULT_TERMINAL_BRANCH_DEPENDENCIES[stepId] || []);
    const filteredDefaults = (defaultDependencies || []).filter(
      (depId) => !(disabledSet.has(depId) && defaultTerminalBranchSet.has(depId))
    );
    return [...new Set([...retained, ...filteredDefaults, ...requiredDependencies])];
  }

  return deduped.filter((dependencyId) => !TERMINAL_FINALIZATION_STEP_ORDER.includes(dependencyId));
}

export function validatePlannedStepDependencies(
  stepIds = [],
  dependencyIndex = {},
  availableStepIds = stepIds,
  options = {}
) {
  const plannedStepIds = Array.isArray(stepIds)
    ? stepIds.filter((stepId) => typeof stepId === 'string' && stepId.length > 0)
    : [];
  const plannedSet = new Set(plannedStepIds);
  const availableSet = new Set(
    Array.isArray(availableStepIds)
      ? availableStepIds.filter((stepId) => typeof stepId === 'string' && stepId.length > 0)
      : []
  );
  const disabledSet = new Set(
    Array.isArray(options?.disabledStepIds)
      ? options.disabledStepIds.filter((stepId) => typeof stepId === 'string' && stepId.length > 0)
      : []
  );
  const errors = [];

  for (const stepId of plannedStepIds) {
    const dependencies = Array.isArray(dependencyIndex?.[stepId]) ? dependencyIndex[stepId] : [];
    const missingDependencies = dependencies.filter(
      (dependencyId) =>
        typeof dependencyId === 'string' &&
        dependencyId.length > 0 &&
        availableSet.has(dependencyId) &&
        !plannedSet.has(dependencyId)
    );

    if (missingDependencies.length > 0) {
      const disabledDependencies = missingDependencies.filter((dependencyId) =>
        disabledSet.has(dependencyId)
      );
      const disabledDetail =
        disabledDependencies.length > 0
          ? `Disabled in .workflow-config.yaml: ${disabledDependencies.join(', ')}. `
          : '';
      const lockedDependencySet = new Set([
        ...(ORDER_LOCKED_TERMINAL_DEPENDENCIES[stepId] || []),
        ...(ORDER_LOCKED_CANONICAL_DEPENDENCIES[stepId] || []),
      ]);
      const lockedMissing = missingDependencies.filter((depId) => lockedDependencySet.has(depId));
      const disabledLockedMissing = lockedMissing.filter((dependencyId) =>
        disabledSet.has(dependencyId)
      );
      const hasComment =
        options?.stepsWithDependencyComment instanceof Set &&
        options.stepsWithDependencyComment.has(stepId);
      const lockedDependencyDetail =
        lockedMissing.length > 0
          ? ` Locked canonical prerequisite(s) for ${stepId}: ${formatDependencyList(lockedMissing)}.`
          : '';
      const effectiveDependencyDetail =
        dependencies.length > 0
          ? ` Effective dependencies for ${stepId}: ${formatDependencyList(dependencies)}.`
          : '';
      const dependentStepsToDisable = collectDependentClosure(
        [stepId],
        dependencyIndex,
        plannedStepIds
      );
      const dependentDisableDetail =
        dependentStepsToDisable.length > 0
          ? `If you keep ${formatDependencyList(disabledLockedMissing)} disabled, also disable enabled dependent step(s): ${formatDependencyList(dependentStepsToDisable)}. `
          : '';
      const lockedDependencyRemediationDetail = buildLockedDependencyRemediationDetail(
        stepId,
        lockedMissing,
        disabledSet
      );
      const defaultTerminalBranchMissingSet = new Set(
        DEFAULT_TERMINAL_BRANCH_DEPENDENCIES[stepId] || []
      );
      const absentDefaultTerminalMissing = missingDependencies.filter(
        (depId) => defaultTerminalBranchMissingSet.has(depId) && !disabledSet.has(depId)
      );
      const remediationHint =
        lockedMissing.length > 0
          ? `${disabledLockedMissing.length > 0 ? `The current .workflow-config.yaml disables required prerequisite step(s): ${disabledLockedMissing.join(', ')} while keeping ${stepId} enabled. ` : ''}` +
            `Re-enable the prerequisite step(s) or disable ${stepId} and every enabled dependent that relies on it. ` +
            dependentDisableDetail +
            lockedDependencyRemediationDetail +
            `Note: ${lockedMissing.join(', ')} cannot be removed via dependency_comment because canonical dependency enforcement restores them.`
          : absentDefaultTerminalMissing.length > 0
            ? `${absentDefaultTerminalMissing.join(', ')} is a default terminal branch prerequisite for ${stepId} that is absent from your config (not listed with 'enabled: false'). Add it to .workflow-config.yaml with 'enabled: false' so canonical enforcement recognizes it as intentionally excluded. A dependency_comment alone does not suppress re-injection — the step must be explicitly disabled.`
            : hasComment
              ? `${stepId} already has a dependency_comment. To skip a disabled prerequisite, remove it ` +
                `from the dependencies array — dependency_comment suppresses the canonical-deviation ` +
                `warning for omitted deps, not for deps that are still listed.`
              : `Re-enable the prerequisite step(s), disable ${stepId}, or override its dependencies with dependency_comment.`;
      errors.push(
        `[WorkflowConfig] Selected step ${stepId} depends on step(s) excluded from the execution plan: ${missingDependencies.join(', ')}. ` +
          `${disabledDetail}${lockedDependencyDetail}${remediationHint}${effectiveDependencyDetail}`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function formatExecutionPlanDependencies(step = {}, planStepIds = []) {
  const dependencies = Array.isArray(step.dependencies)
    ? step.dependencies.filter((dependencyId) => typeof dependencyId === 'string' && dependencyId)
    : [];
  if (dependencies.length === 0) {
    return '(none)';
  }

  const planIds =
    planStepIds instanceof Set
      ? planStepIds
      : new Set(
          Array.isArray(planStepIds)
            ? planStepIds.filter((stepId) => typeof stepId === 'string' && stepId)
            : []
        );

  return dependencies
    .map((dependencyId) =>
      planIds.has(dependencyId) ? dependencyId : `${dependencyId} [excluded]`
    )
    .join(', ');
}

export function logEffectiveExecutionPlan(
  steps = [],
  header = 'Configured workflow step set (pre-sort):'
) {
  if (!Array.isArray(steps) || steps.length === 0) {
    return;
  }

  const planIds = new Set(steps.map((step) => step.id));

  logger.info(header);
  steps.forEach((step, index) => {
    const dependencyList = formatExecutionPlanDependencies(step, planIds);
    const dependencyOverride = describeDependencyOverride(step);
    const detailSuffix = dependencyOverride ? ` | dependency override: ${dependencyOverride}` : '';
    logger.info(
      `  ${index + 1}. ${step.id} — ${formatRuntimeStepName(step)} | deps: ${dependencyList}${detailSuffix}`
    );
  });
}

export function buildExecutionPlanPreview(stepIds = [], stepRegistry) {
  if (!Array.isArray(stepIds) || !stepRegistry) {
    return [];
  }

  return stepIds
    .map((stepId) => {
      const step = stepRegistry.get(stepId);
      if (!step) {
        return null;
      }

      return {
        id: step.id,
        name: step.name,
        canonicalName: step.metadata?.canonicalName || step.name,
        dependencies: step.dependencies || [],
      };
    })
    .filter(Boolean);
}

function normalizeProfileSkipStepId(stepNumber) {
  if (typeof stepNumber === 'string') {
    const trimmed = stepNumber.trim();
    if (trimmed.startsWith('step_')) {
      return trimmed;
    }
  }

  if (typeof stepNumber !== 'number' || !Number.isFinite(stepNumber)) {
    return null;
  }

  if (Number.isInteger(stepNumber)) {
    return `step_${String(stepNumber).padStart(2, '0')}`;
  }

  const normalized = String(stepNumber).replace('.', '_');
  const [major, ...rest] = normalized.split('_');
  if (!/^\d+$/.test(major) || rest.some((part) => !/^\d+$/.test(part))) {
    return null;
  }

  return `step_${String(major).padStart(2, '0')}${rest.length > 0 ? `_${rest.join('_')}` : ''}`;
}

export function normalizeProfileFocusStepIds(stepNumbers, availableStepIds = []) {
  if (!Array.isArray(stepNumbers)) {
    return [];
  }

  const availableSet = new Set(availableStepIds);
  return stepNumbers
    .map(normalizeProfileSkipStepId)
    .filter((stepId) => stepId && (availableSet.size === 0 || availableSet.has(stepId)));
}

export function filterProfileFocusStepIdsForContext(focusStepIds, workflowConfig) {
  if (!Array.isArray(focusStepIds) || focusStepIds.length === 0) {
    return [];
  }

  const projectKind = workflowConfig?.project?.kind || null;

  return focusStepIds.filter((stepId) => {
    if (stepId !== 'step_14') {
      return true;
    }

    return ['workflow-automation', 'bash-automation-framework', 'configuration_library'].includes(
      projectKind
    );
  });
}

export function getMandatoryStepIdsForStage(stage, availableStepIds = []) {
  const availableSet = new Set(availableStepIds);
  const mandatorySteps =
    stage === WORKFLOW_STAGES.FULL
      ? ['step_17', 'step_0f', 'step_12']
      : ['step_17', 'step_0f', 'step_12'];
  return mandatorySteps.filter((stepId) => availableSet.has(stepId));
}

function collectDependencyClosure(rootStepIds, dependencyIndex = {}) {
  const required = new Set();
  const queue = Array.isArray(rootStepIds) ? [...rootStepIds] : [];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || required.has(current)) {
      continue;
    }

    required.add(current);
    const dependencies = Array.isArray(dependencyIndex?.[current]) ? dependencyIndex[current] : [];
    queue.push(...dependencies);
  }

  return required;
}

function collectDependentClosure(rootStepIds, dependencyIndex = {}, availableStepIds = []) {
  const roots = new Set(
    (Array.isArray(rootStepIds) ? rootStepIds : []).filter(
      (stepId) => typeof stepId === 'string' && stepId.length > 0
    )
  );
  if (roots.size === 0) {
    return [];
  }

  const availableSet =
    Array.isArray(availableStepIds) && availableStepIds.length > 0
      ? new Set(
          availableStepIds.filter((stepId) => typeof stepId === 'string' && stepId.length > 0)
        )
      : null;
  const reverseDependencies = new Map();

  for (const [stepId, dependencies] of Object.entries(dependencyIndex || {})) {
    if (
      typeof stepId !== 'string' ||
      stepId.length === 0 ||
      (availableSet && !availableSet.has(stepId))
    ) {
      continue;
    }

    for (const dependencyId of Array.isArray(dependencies) ? dependencies : []) {
      if (typeof dependencyId !== 'string' || dependencyId.length === 0) {
        continue;
      }
      if (availableSet && !availableSet.has(dependencyId)) {
        continue;
      }

      const dependents = reverseDependencies.get(dependencyId) || [];
      dependents.push(stepId);
      reverseDependencies.set(dependencyId, dependents);
    }
  }

  const seen = new Set();
  const queue = [...roots];

  while (queue.length > 0) {
    const current = queue.shift();
    for (const dependentId of reverseDependencies.get(current) || []) {
      if (roots.has(dependentId) || seen.has(dependentId)) {
        continue;
      }

      seen.add(dependentId);
      queue.push(dependentId);
    }
  }

  if (availableSet) {
    return availableStepIds.filter((stepId) => seen.has(stepId));
  }

  return [...seen];
}

export function filterStepIdsByProfile(
  stepIds,
  skippedStepNumbers = [],
  dependencyIndex = {},
  focusedStepNumbers = 'all',
  preservedStepIds = []
) {
  const orderedStepIds = Array.isArray(stepIds)
    ? stepIds.filter((stepId) => typeof stepId === 'string' && stepId.length > 0)
    : [];

  if (orderedStepIds.length === 0) {
    return [];
  }

  const originalSet = new Set(orderedStepIds);
  const focusAll = focusedStepNumbers === 'all';
  const focusStepIds = normalizeProfileFocusStepIds(focusedStepNumbers, orderedStepIds);
  const preservedIds = normalizeProfileFocusStepIds(preservedStepIds, orderedStepIds);
  const requiredForFocus =
    focusStepIds.length > 0 ? collectDependencyClosure(focusStepIds, dependencyIndex) : new Set();
  const requiredForPreserved =
    !focusAll && preservedIds.length > 0
      ? collectDependencyClosure(preservedIds, dependencyIndex)
      : new Set();
  const requiredStepIds =
    requiredForFocus.size > 0 || requiredForPreserved.size > 0
      ? new Set([...requiredForFocus, ...requiredForPreserved])
      : null;
  const protectedStepIds = new Set(
    focusAll ? preservedIds : [...requiredForPreserved, ...preservedIds]
  );
  const skippedStepIds = new Set(
    (Array.isArray(skippedStepNumbers) ? skippedStepNumbers : [])
      .map(normalizeProfileSkipStepId)
      .filter((stepId) => stepId && originalSet.has(stepId))
      .filter((stepId) => !protectedStepIds.has(stepId))
      .filter((stepId) => !requiredStepIds?.has(stepId))
  );

  const baselineStepIds =
    requiredStepIds && requiredStepIds.size > 0
      ? orderedStepIds.filter((stepId) => requiredStepIds.has(stepId))
      : orderedStepIds;

  if (skippedStepIds.size === 0) {
    return baselineStepIds;
  }

  const keptStepIds = new Set(baselineStepIds.filter((stepId) => !skippedStepIds.has(stepId)));
  let changed = true;

  while (changed) {
    changed = false;

    for (const stepId of baselineStepIds) {
      if (!keptStepIds.has(stepId)) {
        continue;
      }

      const dependencies = Array.isArray(dependencyIndex?.[stepId]) ? dependencyIndex[stepId] : [];
      const hasMissingPlannedDependency = dependencies.some(
        (dependencyId) => originalSet.has(dependencyId) && !keptStepIds.has(dependencyId)
      );

      if (hasMissingPlannedDependency && !protectedStepIds.has(stepId)) {
        keptStepIds.delete(stepId);
        changed = true;
      }
    }
  }

  return enforceTerminalStepOrder(baselineStepIds.filter((stepId) => keptStepIds.has(stepId)));
}

export function detectWorkflowConfigStructure(
  topLevelEntries = [],
  fallbackLanguage = 'javascript'
) {
  const directoryNames = Array.isArray(topLevelEntries)
    ? topLevelEntries
        .filter((entry) => entry && typeof entry === 'object' && entry.isDirectory === true)
        .map((entry) => entry.name)
    : [];
  const directorySet = new Set(directoryNames);

  const byLanguage = {
    javascript: {
      source_dirs: ['src', 'lib', 'app', 'bin'],
      test_dirs: ['test', 'tests', '__tests__'],
      docs_dirs: ['docs'],
    },
    typescript: {
      source_dirs: ['src', 'lib', 'app', 'bin'],
      test_dirs: ['test', 'tests', '__tests__'],
      docs_dirs: ['docs'],
    },
    python: {
      source_dirs: ['src'],
      test_dirs: ['tests', 'test'],
      docs_dirs: ['docs'],
    },
    bash: {
      source_dirs: ['bin', 'lib', 'scripts'],
      test_dirs: ['tests', 'test'],
      docs_dirs: ['docs'],
    },
    go: {
      source_dirs: ['cmd', 'internal', 'pkg'],
      test_dirs: ['tests', 'test'],
      docs_dirs: ['docs'],
    },
    java: {
      source_dirs: ['src'],
      test_dirs: ['src/test/java', 'test'],
      docs_dirs: ['docs'],
    },
    ruby: {
      source_dirs: ['lib'],
      test_dirs: ['spec', 'test'],
      docs_dirs: ['docs'],
    },
    rust: {
      source_dirs: ['src'],
      test_dirs: ['tests', 'test'],
      docs_dirs: ['docs'],
    },
    markdown: {
      source_dirs: [],
      test_dirs: [],
      docs_dirs: ['docs'],
    },
  };

  const defaults = byLanguage[fallbackLanguage] || byLanguage.javascript;
  const selectDirs = (preferredDirs, fallbackDirs) => {
    const found = preferredDirs.filter((dir) => directorySet.has(dir));
    return found.length > 0 ? found : fallbackDirs;
  };

  return {
    source_dirs: selectDirs(defaults.source_dirs, defaults.source_dirs.slice(0, 1)),
    test_dirs: selectDirs(defaults.test_dirs, defaults.test_dirs.slice(0, 1)),
    docs_dirs: selectDirs(defaults.docs_dirs, defaults.docs_dirs.slice(0, 1)),
  };
}

export function buildGeneratedWorkflowConfig({
  projectRoot,
  projectKind = 'generic',
  techStack = {},
  structure,
}) {
  const projectName = path.basename(projectRoot || process.cwd());
  const primaryLanguage = techStack.primary_language || techStack.primaryLanguage || 'javascript';
  const configStructure = structure || detectWorkflowConfigStructure([], primaryLanguage);
  const lintCommand =
    typeof techStack.lint_command === 'string' && techStack.lint_command.trim().length > 0
      ? techStack.lint_command.trim()
      : null;

  return {
    project: {
      name: projectName,
      kind: projectKind,
      primary_language: primaryLanguage,
      description: `${projectName} project`,
    },
    tech_stack: {
      primary_language: primaryLanguage,
      build_system: techStack.build_system || 'none',
      test_framework: techStack.test_framework || null,
      test_command: techStack.test_command || '',
      ...(lintCommand ? { lint_command: lintCommand } : {}),
    },
    structure: configStructure,
  };
}
