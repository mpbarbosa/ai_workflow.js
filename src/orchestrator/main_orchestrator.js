/**
 * @fileoverview Main Workflow Orchestrator (v2.0.0)
 * @module orchestrator/main_orchestrator
 *
 * High-level workflow coordinator that integrates all registered workflow steps
 * and provides complete workflow automation with checkpoint/resume, health
 * checks, and multi-stage pipeline support.
 *
 * Architecture: v2.0.0 Referential Transparency
 * - Pure functions for configuration validation and planning
 * - Impure wrapper class for execution coordination and I/O
 *
 * @version 2.0.0
 * @since 2026-02-10
 */

import { logger } from '../core/logger.js';
import { colors } from '../core/colors.js';
import executorModule from '../core/executor.js';
import { STEP_KIND } from '../steps/step_contract.js';
import { WorkflowEngine } from './workflow_engine.js';
import { StepRegistry } from './step_registry.js';
import { CheckpointManager } from './checkpoint_manager.js';
import { Config } from '../lib/config.js';
import path from 'path';
import fs from 'fs/promises';
import { Metrics } from '../lib/metrics.js';
import { Backlog } from '../lib/backlog.js';
import { GitAutomation } from '../lib/git_automation.js';
import { ProjectKindDetector } from '../lib/project_kind_detection.js';
import { ProjectKindConfigManager } from '../lib/project_kind_config.js';
import { TechStackDetector } from '../lib/tech_stack.js';
import { FileOperations } from '../lib/file_operations.js';
import { PerformanceTracker } from '../lib/performance.js';
import { PerformanceMonitor, DEFAULT_THRESHOLDS } from '../lib/performance_monitoring.js';
import { WorkflowProfileManager, categorizeChanges } from '../lib/workflow_profiles.js';
import { AiHelper } from '../lib/ai_helpers.js';
import { readProjectVersionFromPackage } from '../lib/project_version.js';
import { DocsOnlyOptimizer } from '../lib/docs_only_optimization.js';
import { CodeChangesOptimizer } from '../lib/code_changes_optimization.js';
import { FullChangesOptimizer } from '../lib/full_changes_optimization.js';
import { MLOptimizer } from '../lib/ml_optimization.js';
import { CommitHistory, isValidCommitHash } from '../lib/commit_history.js';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';
import {
  DEFAULT_TERMINAL_BRANCH_DEPENDENCIES,
  ORDER_LOCKED_CANONICAL_DEPENDENCIES,
  WORKFLOW_STAGES,
  TERMINAL_FINALIZATION_STEP_ORDER,
  enforceTerminalStepOrder,
  getCanonicalWorkflowSteps,
  getStepsForStage,
} from './workflow_step_catalog.js';
import {
  HEALTH_CHECK_CATEGORIES,
  PRE_FLIGHT_GIT_STASH_REQUIREMENT_MESSAGE,
  detectPreflightPackageManager,
  getPreflightQualityCommands,
  parseTestFailureCount,
  performHealthChecks,
  readPreflightBaseline,
  runPreflightQualitySuites,
  writePreflightBaseline,
  writePreflightFailureArtifact,
} from './preflight_quality_runner.js';
import {
  buildExecutionPlanPreview,
  buildGeneratedWorkflowConfig,
  buildWorkflowConfigDependencyOverrideDiagnostic,
  buildWorkflowConfigDependencyOverrideError,
  buildWorkflowConfigStepIndex,
  classifyDependencyOverrideSeverity,
  detectWorkflowConfigStructure,
  filterProfileFocusStepIdsForContext,
  filterStepIdsByProfile,
  formatExecutionPlanDependencies,
  formatDependencyList,
  formatRuntimeStepName,
  getConfiguredStepsForStage,
  getDisabledWorkflowConfigStepIds,
  getMandatoryStepIdsForStage,
  haveSameDependencySet,
  logEffectiveExecutionPlan,
  normalizeDependencyList,
  normalizeLegacyWorkflowStageStepDefinitions,
  normalizeProfileFocusStepIds,
  normalizeWorkflowConfigStepId,
  sanitizeWorkflowConfigDependencies,
  validatePlannedStepDependencies,
  validateWorkflowStageStepDefinitions,
} from './workflow_execution_plan.js';

export {
  WORKFLOW_STAGES,
  HEALTH_CHECK_CATEGORIES,
  TERMINAL_FINALIZATION_STEP_ORDER,
  detectPreflightPackageManager,
  getPreflightQualityCommands,
  parseTestFailureCount,
  getStepsForStage,
  normalizeWorkflowConfigStepId,
  buildWorkflowConfigStepIndex,
  getConfiguredStepsForStage,
  getDisabledWorkflowConfigStepIds,
  validateWorkflowStageStepDefinitions,
  normalizeLegacyWorkflowStageStepDefinitions,
  filterStepIdsByProfile,
  enforceTerminalStepOrder,
  sanitizeWorkflowConfigDependencies,
  validatePlannedStepDependencies,
  formatExecutionPlanDependencies,
  detectWorkflowConfigStructure,
  buildGeneratedWorkflowConfig,
  performHealthChecks,
};

function isClassConstructor(value) {
  return typeof value === 'function' && /^class\s/.test(Function.prototype.toString.call(value));
}

function attachWorkflowFailureContext(error, context = {}) {
  if (!error || typeof error !== 'object') {
    return error;
  }

  error.workflowFailureContext = {
    failedPhase: context.failedPhase || 'unknown',
    workflowStepsStarted: !!context.workflowStepsStarted,
    executedSteps: Array.isArray(context.executedSteps) ? context.executedSteps : [],
    executionPlanBuilt: !!context.executionPlanBuilt,
    failedCommand: context.failedCommand || null,
  };

  return error;
}

function buildWorkflowFailureRunState(error, fallbackContext = {}) {
  const context = error?.workflowFailureContext || fallbackContext;
  return {
    failed_phase: context.failedPhase || 'unknown',
    workflow_steps_started: !!context.workflowStepsStarted,
    executed_steps: Array.isArray(context.executedSteps) ? context.executedSteps : [],
    execution_plan_built: !!context.executionPlanBuilt,
    failed_command: context.failedCommand || null,
  };
}

function buildPreflightSummary({
  detectedProfile = null,
  changeCounts = null,
  failedPhase = 'preflight',
  workflowStepsStarted = false,
  executedSteps = [],
  executionPlanBuilt = false,
  failedCommand = null,
  failureKind = null,
  message = null,
  advisoryMessage = null,
  noAiReviewPromptsIssued = false,
  dependencyOverrides = null,
}) {
  return {
    timestamp: new Date().toISOString(),
    detectedProfile,
    changeCounts,
    preflightPassed: false,
    failedPhase,
    workflowStepsStarted: !!workflowStepsStarted,
    executionPlanBuilt: !!executionPlanBuilt,
    executedSteps: Array.isArray(executedSteps) ? executedSteps : [],
    noAiReviewPromptsIssued: !!noAiReviewPromptsIssued,
    failedCommand: failedCommand ?? null,
    failureKind: failureKind ?? null,
    message: message ?? null,
    advisoryMessage: advisoryMessage ?? null,
    dependencyOverrides: Array.isArray(dependencyOverrides) ? dependencyOverrides : null,
  };
}

async function writePreflightSummary(logsRunDir, summary) {
  if (!logsRunDir) {
    return;
  }

  const summaryPath = path.join(logsRunDir, 'preflight', 'summary.json');
  await fs
    .mkdir(path.dirname(summaryPath), { recursive: true })
    .then(() => fs.writeFile(summaryPath, JSON.stringify(summary, null, 2), 'utf8'))
    .catch(() => {});
}

function logPreflightFailure(qualityChecks) {
  if (qualityChecks.failureKind === 'test-parser-anomaly') {
    logger.error(
      `${colors.red}✗${colors.reset} Pre-flight anomaly: parsed test-failure summary conflicts with process exit code: ${qualityChecks.failedCommand}`
    );
    if (typeof qualityChecks.parsedFailureCount === 'number') {
      logger.error(`Parsed test failures: ${qualityChecks.parsedFailureCount} (exit code: 0)`);
    }
    if (qualityChecks.failureEvidence?.matchedLine) {
      const lineSuffix = qualityChecks.failureEvidence.matchedLineNumber
        ? ` [line ${qualityChecks.failureEvidence.matchedLineNumber}]`
        : '';
      logger.error(
        `Matched summary line${lineSuffix}: ${qualityChecks.failureEvidence.matchedLine}`
      );
    }
    if (qualityChecks.failureEvidence?.summaryExcerpt) {
      logger.error(`Final Jest summary excerpt:\n${qualityChecks.failureEvidence.summaryExcerpt}`);
    }
  } else {
    logger.error(
      `${colors.red}✗${colors.reset} Pre-flight quality suites failed: ${qualityChecks.failedCommand}`
    );
    if (qualityChecks.firstFailingTest) {
      logger.error(`First failing test: ${qualityChecks.firstFailingTest}`);
    }
  }

  if (qualityChecks.failureOutput && qualityChecks.failureKind !== 'test-parser-anomaly') {
    logger.error(qualityChecks.failureOutput);
  }
  if (qualityChecks.failureKind === 'git-stash-present') {
    logger.error(
      'To resolve:\n' +
        '  git stash show -p   — inspect stash contents\n' +
        '  git stash pop       — apply and remove the stash\n' +
        '  git stash drop      — discard without applying'
    );
  }
  if (qualityChecks.failureArtifact) {
    logger.error(`Full pre-flight failure output saved to: ${qualityChecks.failureArtifact}`);
  }
  if (qualityChecks.failureArtifactError) {
    logger.warn(
      `Failed to persist full pre-flight failure output: ${qualityChecks.failureArtifactError}`
    );
  }
}

// ============================================================================
// PURE FUNCTIONS - Configuration and State
// ============================================================================

/**
 * Validate orchestrator configuration
 * @pure
 * @param {Object} config - Orchestrator configuration
 * @returns {Object} Validation result { isValid, errors }
 */
export function validateOrchestratorConfig(config) {
  const errors = [];

  if (!config || typeof config !== 'object') {
    return { isValid: false, errors: ['Config must be an object'] };
  }

  // Workflow directory
  if (config.workflowDir && typeof config.workflowDir !== 'string') {
    errors.push('workflowDir must be a string');
  }

  // Stage validation
  if (config.stage && !Object.values(WORKFLOW_STAGES).includes(config.stage)) {
    errors.push(
      `Invalid stage: ${config.stage}. Must be one of: ${Object.values(WORKFLOW_STAGES).join(', ')}`
    );
  }

  // Auto mode
  if (config.auto !== undefined && typeof config.auto !== 'boolean') {
    errors.push('auto must be a boolean');
  }

  // Checkpoint resume
  if (config.resumeFromCheckpoint && typeof config.resumeFromCheckpoint !== 'string') {
    errors.push('resumeFromCheckpoint must be a string (checkpoint ID)');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Calculate progress percentage
 * @pure
 * @param {number} completed - Number of completed steps
 * @param {number} total - Total number of steps
 * @returns {number} Progress percentage (0-100)
 */
export function calculateProgress(completed, total) {
  if (total === 0) return 0;
  return Math.round((completed / total) * 100);
}

export function buildMlChangeStats(changedFiles = []) {
  const normalizedFiles = Array.isArray(changedFiles)
    ? changedFiles.filter((filePath) => typeof filePath === 'string' && filePath.length > 0)
    : [];
  const counts = categorizeChanges(normalizedFiles);
  const nonDocsFiles = counts.code + counts.tests + counts.infrastructure + counts.other;

  return {
    changed: counts.total,
    added: 0,
    modified: counts.total,
    deleted: 0,
    codeFiles: nonDocsFiles,
    docsFiles: counts.docs,
    testFiles: counts.tests,
    changePercentage: counts.total > 0 ? 100 : 0,
  };
}

/**
 * Determine overall workflow status
 * @pure
 * @param {Object} results - Workflow execution results
 * @returns {string} Status (success, failed, partial)
 */
export function determineWorkflowStatus(results) {
  if (!results || !results.steps) return 'unknown';

  const steps = Object.values(results.steps);
  const failed = steps.filter((s) => s.status === 'failed').length;
  const skipped = steps.filter((s) => s.status === 'skipped').length;
  const total = steps.length;

  if (failed > 0) return 'failed';
  if (skipped > 0 && skipped < total) return 'partial';
  if (skipped === total) return 'skipped';
  return 'success';
}

// ============================================================================
// IMPURE WRAPPER CLASS - MainOrchestrator
// ============================================================================

/**
 * Main Workflow Orchestrator
 * Coordinates all 20 workflow steps with full lifecycle management
 */
export class MainOrchestrator {
  constructor(options = {}) {
    // Configuration
    // NOTE: projectRoot must be resolved before workflowDir so that a relative
    // workflowDir (the common default '.ai_workflow') is anchored to the target
    // project, not to process.cwd() (which is the directory the CLI was invoked
    // from — often the ai_workflow.js repo itself, not the project being analysed).
    this.projectRoot = options.projectRoot || process.cwd();
    const rawWorkflowDir = options.workflowDir || '.ai_workflow';
    // Resolve relative workflowDir against projectRoot so that all workflow
    // artifacts (logs, checkpoints, summaries) land inside the target project
    // regardless of where the CLI is invoked from.
    this.workflowDir = path.isAbsolute(rawWorkflowDir)
      ? rawWorkflowDir
      : path.join(this.projectRoot, rawWorkflowDir);
    this.stage = options.stage || WORKFLOW_STAGES.FULL;
    this.auto = options.auto || false;
    this.noParallel = options.noParallel || false;
    this.allowFinalizeOnFailure = options.allowFinalizeOnFailure || false;
    this.resumeFromCheckpoint = options.resumeFromCheckpoint || null;
    this.sdkSmokeTest = options.sdkSmokeTest || false;
    this.alternatives = options.alternatives || false;
    // When true, each step receives a streaming AiHelper whose token deltas are
    // forwarded to workflowEngine as 'ai:stream:chunk' events for TUI display.
    this.streamingEnabled = !!(options.verbose || options.streamingEnabled);
    // AI provider to use for all steps: 'copilot' (default) or 'claude'.
    this.aiProvider = options.provider || 'copilot';

    // Validate config
    const validation = validateOrchestratorConfig(options);
    if (!validation.isValid) {
      throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
    }

    // Initialize components
    this.configManager = new Config(this.projectRoot);
    this.metricsCollector = new Metrics(this.configManager);
    this.checkpointManager = new CheckpointManager({
      checkpointDir: path.join(this.workflowDir, 'checkpoints'),
    });
    this.stepRegistry = new StepRegistry();
    this.workflowEngine = new WorkflowEngine({
      projectRoot: this.projectRoot,
    });
    this.summaryGenerator = {
      generateSummary: async (options = {}) => {
        const summaryStepHandler = getCanonicalWorkflowSteps().find(
          (step) => step.id === 'step_17'
        )?.handler;
        const SummaryGenerator = await this._resolveStepExecutor('step_17', summaryStepHandler);
        const generator = new SummaryGenerator(this.workflowDir);
        return generator.generateSummary(options);
      },
    };
    this.backlogManager = new Backlog(this.configManager); // Pass Config instance, not string
    this.gitOps = new GitAutomation({ repoPath: this.projectRoot });
    this.projectDetection = new ProjectKindDetector(this.projectRoot);
    this.projectKindConfig = new ProjectKindConfigManager({ projectRoot: this.projectRoot });
    this.techStackDetection = new TechStackDetector(this.projectRoot);

    // Phase 8: Performance tracking
    this.performanceTracker = new PerformanceTracker();
    this.performanceMonitor = new PerformanceMonitor({
      thresholds: DEFAULT_THRESHOLDS,
      onAlert: (alert) => {
        logger.warn(`[Performance] ${alert.severity.toUpperCase()}: ${alert.message}`);
      },
    });
    this.profileManager = new WorkflowProfileManager({
      gitAutomation: this.gitOps,
    });
    this.mlOptimizer = new MLOptimizer({
      modelFile: path.join(this.workflowDir, '.ml_model.json'),
    });

    // State
    this.currentStep = null;
    this.results = { steps: {} };
    this.startTime = null;
    this.projectWorkflowConfig = null;
  }

  /**
   * Register all workflow steps
   */
  registerAllSteps(projectWorkflowConfig = null) {
    logger.info(
      'Loading canonical workflow step definitions for preflight validation (execution has not started)...'
    );

    const steps = getCanonicalWorkflowSteps();

    for (const step of steps) {
      this.stepRegistry.register(step.id, {
        name: step.name,
        description: step.description,
        handler: step.handler,
        dependencies: step.dependencies,
        required: true,
        critical: step.critical !== undefined ? step.critical : true,
        metadata: {
          canonicalName: step.name,
          canonicalDescription: step.description,
          canonicalDependencies: [...step.dependencies],
        },
      });
    }

    this._applyProjectWorkflowOverrides(projectWorkflowConfig);

    logger.info(
      `${colors.green}✓${colors.reset} Loaded ${steps.length} canonical workflow step definitions for validation and planning`
    );
  }

  async _loadProjectWorkflowConfig() {
    const configPath = path.join(this.projectRoot, '.workflow-config.yaml');

    try {
      const configContent = await fs.readFile(configPath, 'utf8');
      const parsed = yaml.load(configContent);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
      return null;
    }
  }

  async _ensureProjectWorkflowConfig() {
    const existingConfig = await this._loadProjectWorkflowConfig();
    if (existingConfig) {
      const { workflowConfig, warnings } =
        normalizeLegacyWorkflowStageStepDefinitions(existingConfig);
      warnings.forEach((warning) => logger.warn(warning));
      return workflowConfig;
    }

    const [techStack, kindResult, topLevelEntries] = await Promise.all([
      this.techStackDetection.detectTechStack(this.projectRoot),
      this.projectDetection.detectProjectKind(this.projectRoot),
      fs.readdir(this.projectRoot, { withFileTypes: true }).catch(() => []),
    ]);

    const structure = detectWorkflowConfigStructure(
      topLevelEntries.map((entry) => ({
        name: entry.name,
        isDirectory: entry.isDirectory(),
      })),
      techStack?.primary_language || techStack?.primaryLanguage || 'javascript'
    );
    const generatedConfig = buildGeneratedWorkflowConfig({
      projectRoot: this.projectRoot,
      projectKind: kindResult?.kind && kindResult.kind !== 'unknown' ? kindResult.kind : 'generic',
      techStack,
      structure,
    });
    const configPath = path.join(this.projectRoot, '.workflow-config.yaml');
    const yamlContent = yaml.dump(generatedConfig, { lineWidth: -1, noRefs: true });

    await fs.writeFile(configPath, yamlContent, 'utf8');
    logger.info(
      '[WorkflowConfig] Generated missing .workflow-config.yaml from detected project facts'
    );
    logger.info(
      '[WorkflowConfig] Generated config starts from the canonical workflow graph. Override workflow.steps sparingly, preserve canonical dependencies by default, and use dependency_comment only for evidence-bound exceptions.'
    );

    return generatedConfig;
  }

  _applyProjectWorkflowOverrides(projectWorkflowConfig = null) {
    const stageStepValidation = validateWorkflowStageStepDefinitions(projectWorkflowConfig);
    if (!stageStepValidation.valid) {
      throw attachWorkflowFailureContext(new Error(stageStepValidation.errors.join('\n\n')), {
        failedPhase: 'preflight_config_validation',
        workflowStepsStarted: false,
        executedSteps: [],
        executionPlanBuilt: false,
        failedCommand: null,
      });
    }

    const overrides = buildWorkflowConfigStepIndex(projectWorkflowConfig);
    const disabledConfigStepIds = getDisabledWorkflowConfigStepIds(projectWorkflowConfig);
    const configPath = path.join(this.projectRoot, '.workflow-config.yaml');
    const pendingUpdates = [];
    const previewUpdates = new Map();
    const pendingErrors = [];
    const pendingDiagnostics = [];
    const allDependencyOverrides = [];

    for (const [stepId, override] of Object.entries(overrides)) {
      if (!this.stepRegistry.has(stepId)) {
        logger.warn(`[WorkflowConfig] Ignoring unknown configured step: ${stepId}`);
        continue;
      }

      const updates = {
        enabled: override.enabled,
      };

      if (override.dependencies) {
        const existingStep = this.stepRegistry.get(stepId);
        const canonicalDependencies = Array.isArray(existingStep?.metadata?.canonicalDependencies)
          ? existingStep.metadata.canonicalDependencies
          : existingStep?.dependencies || [];
        const rawConfiguredDependencies = normalizeDependencyList(override.dependencies);
        const sanitizedDependencies = sanitizeWorkflowConfigDependencies(
          stepId,
          rawConfiguredDependencies,
          existingStep?.dependencies || [],
          { disabledStepIds: disabledConfigStepIds }
        );
        const removedDependencies = rawConfiguredDependencies.filter(
          (dependencyId) => !sanitizedDependencies.includes(dependencyId)
        );
        const addedDependencies = sanitizedDependencies.filter(
          (dependencyId) => !rawConfiguredDependencies.includes(dependencyId)
        );
        const semanticallyOverridesCanonical = !haveSameDependencySet(
          rawConfiguredDependencies,
          canonicalDependencies
        );
        if (semanticallyOverridesCanonical) {
          allDependencyOverrides.push({ stepId, commentPresent: !!override.dependencyComment });
        }
        if (removedDependencies.length > 0) {
          logger.warn(
            `[WorkflowConfig] Removed unsafe dependency override(s) from ${stepId}: ${removedDependencies.join(', ')}`
          );
        }
        if (addedDependencies.length > 0) {
          // P2: Distinguish between enabled vs disabled terminal branch prerequisites so the
          // advisory gives the correct remediation action in each case.
          // - ENABLED steps absent from config.dependencies → add them explicitly to suppress advisory
          // - DISABLED steps absent from config        → list them with 'enabled: false' to suppress re-injection
          const allTerminalAbsent = (DEFAULT_TERMINAL_BRANCH_DEPENDENCIES[stepId] || []).filter(
            (depId) => addedDependencies.includes(depId)
          );
          const enabledTerminalAbsent = allTerminalAbsent.filter(
            (depId) => !disabledConfigStepIds.includes(depId)
          );
          const disabledTerminalAbsent = allTerminalAbsent.filter((depId) =>
            disabledConfigStepIds.includes(depId)
          );
          const hintParts = [];
          if (enabledTerminalAbsent.length > 0) {
            hintParts.push(
              `${enabledTerminalAbsent.join(', ')} is a default terminal branch prerequisite absent from your config —` +
                ` add it explicitly to ${stepId}.dependencies to suppress this advisory.`
            );
          }
          if (disabledTerminalAbsent.length > 0) {
            hintParts.push(
              `${disabledTerminalAbsent.join(', ')} is a disabled default terminal branch prerequisite absent from your config —` +
                ` add it with 'enabled: false' to suppress this re-injection.`
            );
          }
          const absentHint = hintParts.length > 0 ? ` ${hintParts.join(' ')}` : '';
          logger.warn(
            `[WorkflowConfig] Canonical dependency enforcement adjusted ${stepId}: requested ${formatDependencyList(rawConfiguredDependencies)}; effective ${formatDependencyList(sanitizedDependencies)}. Added prerequisite(s): ${formatDependencyList(addedDependencies)}.${absentHint}`
          );
        }
        updates.dependencies = semanticallyOverridesCanonical
          ? sanitizedDependencies
          : normalizeDependencyList(canonicalDependencies);
        if (semanticallyOverridesCanonical) {
          if (!override.dependencyComment) {
            previewUpdates.set(stepId, {
              ...updates,
              dependencies: sanitizedDependencies,
            });
            pendingDiagnostics.push(
              buildWorkflowConfigDependencyOverrideDiagnostic({
                stepId,
                stepName: existingStep?.name,
                stepEnabled: override.enabled,
                canonicalDependencies,
                rawConfiguredDependencies,
                effectiveDependencies: sanitizedDependencies,
                removedDependencies,
                addedDependencies,
              })
            );
            pendingErrors.push(
              buildWorkflowConfigDependencyOverrideError({
                configPath,
                stepId,
                stepName: existingStep?.name,
                stepEnabled: override.enabled,
                canonicalDependencies,
                rawConfiguredDependencies,
                effectiveDependencies: sanitizedDependencies,
                removedDependencies,
              })
            );
            continue;
          }

          updates.metadata = {
            ...(existingStep?.metadata || {}),
            dependencyComment: override.dependencyComment,
          };

          // P1: Detect when dependency_comment describes early/parallel behaviour that
          // canonical enforcement has negated by injecting a locked prerequisite.
          // Example: "kicked off early from step_00" but step_08 was re-injected as a
          // locked prerequisite, meaning the step actually runs after the full pipeline.
          const lockedDepsAdded = addedDependencies.filter((depId) =>
            (ORDER_LOCKED_CANONICAL_DEPENDENCIES[stepId] || []).includes(depId)
          );
          if (
            lockedDepsAdded.length > 0 &&
            /\b(early|fast signal|parallel from|kicked off early|independent parallel|provides fast)\b/i.test(
              override.dependencyComment
            )
          ) {
            logger.warn(
              `[WorkflowConfig] COMMENT_MISMATCH: ${stepId}.dependency_comment claims early or parallel ` +
                `execution, but canonical enforcement added locked prerequisite(s) ${formatDependencyList(lockedDepsAdded)} ` +
                `that anchor this step later in the pipeline. ` +
                `Update dependency_comment to reflect the actual effective execution order ` +
                `(includes locked chain: ${formatDependencyList(lockedDepsAdded)}).`
            );
          }
        }
      }
      if (override.phase) {
        updates.phase = override.phase;
      }
      if (typeof override.critical === 'boolean') {
        updates.critical = override.critical;
      }
      if (typeof override.priority === 'number') {
        updates.priority = override.priority;
      }
      if (typeof override.maxStepWallTime === 'number') {
        updates.max_step_wall_time = override.maxStepWallTime;
      }
      if (override.name) {
        updates.name = override.name;
      }
      if (override.description) {
        updates.description = override.description;
      }

      previewUpdates.set(stepId, updates);
      pendingUpdates.push([stepId, updates]);
    }

    if (pendingErrors.length > 0) {
      if (pendingDiagnostics.length > 0) {
        logger.error(
          '[WorkflowConfig] Dependency override validation failed. Raw vs effective dependency diagnostics:'
        );
        pendingDiagnostics.forEach((diagnostic) => logger.error(diagnostic));

        // Triage summary: group violations by severity so operators fix the most dangerous first
        const severityCounts = { CORRECTNESS: 0, STRUCTURAL: 0, DOCUMENTATION: 0, NOISE: 0 };
        const severityExamples = { CORRECTNESS: [], STRUCTURAL: [], DOCUMENTATION: [], NOISE: [] };
        for (const { stepId, commentPresent } of allDependencyOverrides) {
          if (commentPresent) continue;
          const step = this.stepRegistry.get(stepId);
          const existingStep = step || {};
          const canonicalDeps = Array.isArray(existingStep?.metadata?.canonicalDependencies)
            ? existingStep.metadata.canonicalDependencies
            : existingStep?.dependencies || [];
          const override =
            (buildWorkflowConfigStepIndex(projectWorkflowConfig) || {})[stepId] || {};
          const rawDeps = normalizeDependencyList(override.dependencies || []);
          const sanitized = sanitizeWorkflowConfigDependencies(stepId, rawDeps, canonicalDeps, {
            disabledStepIds: disabledConfigStepIds,
          });
          const removed = rawDeps.filter((d) => !sanitized.includes(d));
          const severity = classifyDependencyOverrideSeverity({
            stepId,
            stepEnabled: override.enabled !== false,
            canonicalDependencies: canonicalDeps,
            rawConfiguredDependencies: rawDeps,
            removedDependencies: removed,
          });
          severityCounts[severity]++;
          if (severityExamples[severity].length < 3) severityExamples[severity].push(stepId);
        }
        const lines = ['[WorkflowConfig] Triage summary — fix in this order:'];
        if (severityCounts.CORRECTNESS > 0) {
          lines.push(
            `  [CORRECTNESS] ${severityCounts.CORRECTNESS} step(s): locked chain violations or unsafe cycles (e.g. ${severityExamples.CORRECTNESS.join(', ')})`
          );
        }
        if (severityCounts.STRUCTURAL > 0) {
          lines.push(
            `  [STRUCTURAL]  ${severityCounts.STRUCTURAL} step(s): non-locked chain bypasses (e.g. ${severityExamples.STRUCTURAL.join(', ')})`
          );
        }
        if (severityCounts.DOCUMENTATION > 0) {
          lines.push(
            `  [DOCUMENTATION] ${severityCounts.DOCUMENTATION} step(s): only additions, just need dependency_comment (e.g. ${severityExamples.DOCUMENTATION.join(', ')})`
          );
        }
        if (severityCounts.NOISE > 0) {
          lines.push(
            `  [NOISE]       ${severityCounts.NOISE} disabled step(s): remove 'dependencies:' key to silence (e.g. ${severityExamples.NOISE.join(', ')})`
          );
        }
        lines.push(
          "  Quick fix: run 'ai-workflow config fix-deps' to add placeholder dependency_comment to all overrides"
        );
        logger.error(lines.join('\n'));
      }
      if (disabledConfigStepIds.length > 0) {
        logger.info(
          `[WorkflowConfig] Disabled steps in .workflow-config.yaml: ${disabledConfigStepIds.join(', ')}`
        );
      }
      logEffectiveExecutionPlan(
        getConfiguredStepsForStage(this.stage, projectWorkflowConfig)
          .map((stepId) => {
            const step = this.stepRegistry.get(stepId);
            if (!step) {
              return null;
            }
            const updates = previewUpdates.get(stepId) || {};
            return {
              id: step.id,
              name: updates.name || step.name,
              canonicalName: step.metadata?.canonicalName || step.name,
              dependencies: updates.dependencies || step.dependencies || [],
              metadata: {
                ...(step.metadata || {}),
                ...(updates.metadata || {}),
              },
            };
          })
          .filter(Boolean),
        'Effective configured workflow step set before dependency override validation failure:'
      );
      const thrownError = attachWorkflowFailureContext(new Error(pendingErrors.join('\n\n')), {
        failedPhase: 'preflight_config_validation',
        workflowStepsStarted: false,
        executedSteps: [],
        executionPlanBuilt: false,
        failedCommand: null,
      });
      thrownError.dependencyOverrides = allDependencyOverrides;
      throw thrownError;
    }

    for (const [stepId, updates] of pendingUpdates) {
      this.stepRegistry.update(stepId, updates);
    }
  }

  /**
   * Perform pre-flight health checks
   * @returns {Promise<Object>} Health check results
   */
  async healthCheck() {
    logger.info('Performing health checks...');

    const environment = {
      nodeVersion: process.version,
      platform: process.platform,
      config: this.configManager,
      workflowDir: this.workflowDir,
      workflowDirWritable: await fs
        .access(this.workflowDir, 0o2)
        .then(() => true)
        .catch(() => false),
    };

    const results = performHealthChecks(environment);

    if (results.passed) {
      const qualityChecks = await this._runPreflightQualitySuites(
        this.projectRoot,
        this.profileManager?.changeCounts ?? null
      );
      results.checks[HEALTH_CHECK_CATEGORIES.PREFLIGHT] = qualityChecks;

      if (qualityChecks.hasForceExitWarning) {
        logger.warn(
          `${colors.yellow}⚠${colors.reset} Jest force-exited to kill async handles — ` +
            `add --detectOpenHandles to your test script to identify the source`
        );
      }

      if (qualityChecks.skipped) {
        logger.info(`Skipping pre-flight quality suites: ${qualityChecks.message}`);
      } else if (qualityChecks.passed) {
        logger.info(
          `${colors.green}✓${colors.reset} Pre-flight quality suites passed (${qualityChecks.commands.map((check) => check.name).join(', ')})`
        );
      } else if (qualityChecks.advisory) {
        logger.warn(
          `${colors.yellow}⚠${colors.reset} Pre-flight advisory (pre-existing failures): ${qualityChecks.advisoryMessage}`
        );
        logger.warn(`  Workflow continuing. Fix the flagged tests to clear this advisory.`);
      } else {
        results.passed = false;
        logPreflightFailure(qualityChecks);
      }
    }

    if (results.passed) {
      logger.info(`${colors.green}✓${colors.reset} All health checks passed`);
    } else {
      logger.warn(`${colors.yellow}⚠${colors.reset} Some health checks failed`);
      Object.entries(results.checks).forEach(([category, check]) => {
        if (!check.passed) {
          logger.warn(`  - ${category}: ${JSON.stringify(check)}`);
        }
      });
    }

    return results;
  }

  /**
   * Run only the preflight phases without executing any workflow steps.
   * Designed for `ai-workflow validate` — provides sub-second feedback on
   * .workflow-config.yaml errors and git-stash / environment health issues
   * without building an execution plan or launching any step handlers.
   *
   * @param {Object} [options]
   * @param {boolean} [options.configValidation=true]  Run config validation phase
   * @param {boolean} [options.healthChecks=true]      Run health-check phase (git stash, lint, test)
   * @returns {Promise<{configPassed: boolean, healthPassed: boolean}>}
   * @throws {Error} Enriched with workflowFailureContext when a phase fails
   */
  async runPreflight(options = {}) {
    const runConfig = options.configValidation !== false;
    const runHealth = options.healthChecks !== false;

    try {
      await fs.access(this.projectRoot);
    } catch {
      throw new Error(`Project root does not exist: ${this.projectRoot}`);
    }

    // Set up logsRunDir so preflight artifact writing (git-stash.log, summary.json) works.
    if (!this.logsRunDir) {
      this.logsRunDir = path.join(this.workflowDir, 'logs', this.configManager.workflowRunId);
    }

    let configPassed = true;
    let healthPassed = true;

    if (runConfig) {
      this.projectWorkflowConfig = await this._ensureProjectWorkflowConfig();
      logger.info(
        'Validating .workflow-config.yaml step overrides against canonical workflow order...'
      );
      logger.info('Preflight config validation only — no workflow steps have started yet.');
      logger.info(PRE_FLIGHT_GIT_STASH_REQUIREMENT_MESSAGE);
      this.registerAllSteps(this.projectWorkflowConfig);

      const disabledConfiguredStepIds = getDisabledWorkflowConfigStepIds(
        this.projectWorkflowConfig
      );
      const configuredDependencyIndex = Object.fromEntries(
        this.stepRegistry.list().map((step) => [step.id, step.dependencies || []])
      );
      const stageConfiguredSteps = getConfiguredStepsForStage(
        this.stage,
        this.projectWorkflowConfig
      );
      const stepsWithDependencyComment = new Set(
        (this.projectWorkflowConfig?.workflow?.steps || [])
          .filter((s) => typeof s?.dependency_comment === 'string' && s.dependency_comment.trim())
          .map((s) => normalizeWorkflowConfigStepId(s?.id))
          .filter(Boolean)
      );
      const configuredPlanValidation = validatePlannedStepDependencies(
        stageConfiguredSteps,
        configuredDependencyIndex,
        getStepsForStage(this.stage),
        { disabledStepIds: disabledConfiguredStepIds, stepsWithDependencyComment }
      );
      if (!configuredPlanValidation.valid) {
        throw attachWorkflowFailureContext(new Error(configuredPlanValidation.errors.join('\n')), {
          failedPhase: 'preflight_config_validation',
          workflowStepsStarted: false,
          executedSteps: [],
          executionPlanBuilt: false,
          failedCommand: null,
        });
      }
      logger.info('Workflow configuration overrides validated.');
    }

    if (runHealth) {
      if (!this.projectWorkflowConfig) {
        this.projectWorkflowConfig = await this._ensureProjectWorkflowConfig();
        this.registerAllSteps(this.projectWorkflowConfig);
      }
      // Best-effort profile detection for change-count context in advisory logic.
      try {
        await this.profileManager.detectProfile();
      } catch {
        // Non-critical — health checks proceed without change-count context.
      }
      const healthResults = await this.healthCheck();
      if (!healthResults.passed) {
        const preflightCheck = healthResults.checks[HEALTH_CHECK_CATEGORIES.PREFLIGHT];
        throw attachWorkflowFailureContext(
          new Error(preflightCheck?.message || 'Health checks failed — cannot proceed'),
          {
            failedPhase: 'preflight_health_checks',
            workflowStepsStarted: false,
            executedSteps: [],
            executionPlanBuilt: false,
            failedCommand: preflightCheck?.failedCommand ?? null,
          }
        );
      }
    }

    return { configPassed, healthPassed };
  }

  async _runPreflightQualitySuites(projectRoot, changeCounts = null) {
    const preflightTestCommand =
      this.configManager?.getConfig?.()?.tech_stack?.preflight_test_command ?? null;
    return runPreflightQualitySuites({
      projectRoot,
      workflowDir: this.workflowDir,
      logsRunDir: this.logsRunDir,
      changeCounts,
      preflightTestCommand,
      logger,
    });
  }

  async _writePreflightFailureArtifact(suiteName, command, output) {
    return writePreflightFailureArtifact(this.logsRunDir, suiteName, command, output);
  }

  async _readPreflightBaseline() {
    return readPreflightBaseline(this.workflowDir);
  }

  async _writePreflightBaseline(testFailureCount) {
    return writePreflightBaseline(this.workflowDir, testFailureCount);
  }

  _buildExecutableWorkflow(stepsToExecute = []) {
    return {
      id: `workflow_${Date.now()}`,
      name: 'AI Workflow Automation',
      version: '2.0.0',
      steps: stepsToExecute.map((stepId) => {
        const stepDef = this.stepRegistry.get(stepId);
        const canonicalName = stepDef.metadata?.canonicalName || stepDef.name;
        const canonicalDescription = stepDef.metadata?.canonicalDescription || stepDef.description;
        const canonicalDependencies = Array.isArray(stepDef.metadata?.canonicalDependencies)
          ? stepDef.metadata.canonicalDependencies
          : stepDef.dependencies || [];
        const aliasName = stepDef.name !== canonicalName ? stepDef.name : null;
        return {
          id: stepId,
          name: stepDef.name,
          aliasName,
          canonicalName,
          description: stepDef.description,
          canonicalDescription,
          dependencies: stepDef.dependencies || [],
          canonicalDependencies,
          handler: this._createStepHandler(stepId, stepDef),
          critical: stepDef.critical !== false,
        };
      }),
    };
  }

  async _buildWorkflowExecutionContext(
    context,
    detectedProfile,
    allChangedFiles,
    healthResults,
    workflow
  ) {
    const changeStats = buildMlChangeStats(allChangedFiles);
    return {
      ...context,
      workflowDir: this.workflowDir,
      projectRoot: this.projectRoot,
      auto: this.auto,
      workflowRunId: this.configManager.workflowRunId,
      modifiedFiles: allChangedFiles,
      projectType:
        this.projectWorkflowConfig?.project?.type ||
        (await this.projectDetection.detectProjectKind(this.projectRoot))?.kind ||
        null,
      scope: context.scope || detectedProfile || '',
      projectDescription:
        context.projectDescription ||
        this.projectWorkflowConfig?.project?.description ||
        this.configManager?.getConfig?.()?.project_description ||
        this.configManager?.getConfig?.()?.project?.description ||
        path.basename(this.projectRoot),
      alternatives: this.alternatives,
      preflightCheck: healthResults.checks[HEALTH_CHECK_CATEGORIES.PREFLIGHT] || null,
      resumeCommandHint: 'ai-workflow resume --latest',
      changeStats,
      criticalStepIds: workflow.steps
        .filter((step) => step.critical !== false)
        .map((step) => step.id),
      allowFinalizeOnFailure: this.allowFinalizeOnFailure,
      configFiles: this.projectWorkflowConfig?.structure?.config_files ?? null,
    };
  }

  _attachWorkflowRunListeners(logsRunDir, mlContextBase) {
    const stepsLogDir = path.join(logsRunDir, 'steps');
    const mlPredictions = new Map();

    this.workflowEngine.on('step:start', ({ step }) => {
      this.currentStep = step.id;
      this.performanceTracker.startTimer(step.id);
      try {
        if (this.mlOptimizer.initialized) {
          const prediction = this.mlOptimizer.predict(step.id, {
            ...mlContextBase,
          });
          mlPredictions.set(step.id, prediction);
          if (prediction.prediction === 'skip') {
            logger.debug(
              `[MLOptimizer] ${step.id}: predicted skippable (confidence ${prediction.confidence.toFixed(2)})`
            );
          }
        }
      } catch {
        /* ML optimizer advisory only */
      }
      logger.openStepLogFile(path.join(stepsLogDir, `${step.id}.log`));
      logger.info(`\n${colors.cyan}→ Starting: ${formatRuntimeStepName(step)}${colors.reset}`);
    });

    this.workflowEngine.on('step:complete', ({ step, result }) => {
      const perfMetrics = this.performanceTracker.endTimer(step.id);
      this.performanceMonitor.checkMetrics(step.id, perfMetrics || {});
      try {
        if (this.mlOptimizer.initialized && mlPredictions.has(step.id)) {
          this.mlOptimizer.recordOutcome(
            step.id,
            {
              ...mlContextBase,
              previousResults: this.workflowEngine.results[
                this.workflowEngine.results.length - 1
              ] || {
                success: true,
              },
            },
            mlPredictions.get(step.id),
            result.success ? 'success' : 'failure'
          );
        }
      } catch {
        /* ML optimizer advisory only */
      }
      const durationStr = result.duration ? `(${Math.round(result.duration / 1000)}s)` : '';
      const degraded = result.output?.degraded === true;
      if (result.skipped) {
        logger.info(
          `${colors.yellow}⊘ Skipped: ${formatRuntimeStepName(step)}${colors.reset} ${durationStr}`
        );
      } else if (!result.success) {
        logger.info(
          `${colors.red}✗ Completed with failure: ${formatRuntimeStepName(step)}${colors.reset} ${durationStr}`
        );
      } else if (degraded) {
        logger.info(
          `${colors.yellow}⚠ Completed with degradation: ${formatRuntimeStepName(step)}${colors.reset} ${durationStr}`
        );
      } else {
        logger.info(
          `${colors.green}✓ Completed: ${formatRuntimeStepName(step)}${colors.reset} ${durationStr}`
        );
      }
      logger.closeStepLogFile();
    });

    this.workflowEngine.on('step:budget_exceeded', ({ step, budgetMs, durationMs }) => {
      logger.warn(
        `${colors.yellow}⚠ BUDGET_EXCEEDED: ${formatRuntimeStepName(step)} (${Math.round(
          durationMs / 1000
        )}s > ${Math.round(budgetMs / 1000)}s)${colors.reset}`
      );
    });

    this.workflowEngine.on('step:error', ({ step, error }) => {
      try {
        if (this.mlOptimizer.initialized && mlPredictions.has(step.id)) {
          this.mlOptimizer.recordOutcome(
            step.id,
            {
              ...mlContextBase,
              previousResults: this.workflowEngine.results[
                this.workflowEngine.results.length - 1
              ] || {
                success: true,
              },
            },
            mlPredictions.get(step.id),
            'failure'
          );
        }
      } catch {
        /* ML optimizer advisory only */
      }
      logger.error(
        `${colors.red}✗ Failed: ${formatRuntimeStepName(step)} - ${error.message}${colors.reset}`
      );
      logger.closeStepLogFile();
    });

    this.workflowEngine.on('step:skipped', ({ step, result }) => {
      logger.openStepLogFile(path.join(stepsLogDir, `${step.id}.log`));
      logger.info(
        `${colors.yellow}⊘ Skipped: ${formatRuntimeStepName(step)} - ${result.reason}${colors.reset}`
      );
      logger.closeStepLogFile();
    });
  }

  async _storeWorkflowRunResults(workflow, engineResult, executionContext) {
    this.results = {
      workflowId: workflow.id,
      status: engineResult.success ? 'success' : 'failed',
      steps: engineResult.results.reduce((acc, result) => {
        acc[result.stepId] = result;
        return acc;
      }, {}),
      startTime: this.startTime,
      endTime: Date.now(),
      summary: engineResult.summary,
    };

    return this.checkpointManager.save(workflow, {
      stage: this.stage,
      results: this.results.steps,
      context: executionContext,
      completedSteps: Object.keys(this.results.steps).filter(
        (stepId) => this.results.steps[stepId].status === 'success'
      ),
      failedSteps: Object.keys(this.results.steps).filter(
        (stepId) => this.results.steps[stepId].status === 'failed'
      ),
      skippedSteps: Object.keys(this.results.steps).filter(
        (stepId) => this.results.steps[stepId].status === 'skipped'
      ),
      timestamp: Date.now(),
    });
  }

  async _finalizeWorkflowRun(workflow, engineResult, commitHistory, headAtWorkflowStart) {
    const executedStepIds = new Set((engineResult.results || []).map((result) => result.stepId));
    const summaryLogLabel = executedStepIds.has('step_17')
      ? 'Refreshing workflow summary...'
      : 'Generating workflow summary...';
    logger.info(`\n${colors.blue}${summaryLogLabel}${colors.reset}`);
    const summary = await this.summaryGenerator.generateSummary({
      workflowRunId: this.configManager.workflowRunId,
      stepResults: engineResult.results,
      startTime: this.startTime ? new Date(this.startTime).toISOString() : undefined,
      endTime: new Date().toISOString(),
    });
    this.results.generatedSummary = summary;

    const duration = Date.now() - this.startTime;
    const totalPerfMetrics = this.performanceTracker.endTimer('workflow_total');
    if (totalPerfMetrics) {
      logger.debug(`[Performance] Total workflow: ${totalPerfMetrics.durationFormatted}`);
    }
    logger.info(`\n${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    if (engineResult.success) {
      logger.info(`${colors.green}✓ Workflow completed successfully${colors.reset}`);
    } else {
      logger.warn(`${colors.yellow}⚠ Workflow completed with failures${colors.reset}`);
    }
    logger.info(`Duration: ${Math.round(duration / 1000)}s`);
    logger.info(`Steps: ${engineResult.summary.succeeded}/${engineResult.summary.total} succeeded`);
    logger.info(`${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);

    if (engineResult.success) {
      try {
        const headToSave = headAtWorkflowStart || this.gitOps.getCurrentHead();
        if (headToSave) {
          commitHistory.save(headToSave, workflow.id);
        }
      } catch {
        // Non-critical — never block completion
      }
    }

    await this.mlOptimizer.saveModel().catch(() => {});
    await logger.closeLogFile();

    return {
      success: engineResult.success,
      workflow,
      results: this.results,
      summary,
      duration,
    };
  }

  /**
   * Abort the running workflow (e.g. on SIGINT). The current step finishes,
   * then execution stops cleanly.
   */
  abort() {
    this.workflowEngine.abort();
  }

  /**
   * Execute the workflow
   * @param {Object} context - Execution context
   * @returns {Promise<Object>} Workflow results
   */
  async execute(context = {}) {
    let workflowExecutionStarted = false;
    let executionPlanBuilt = false;
    let detectedProfile = null;

    try {
      this.startTime = Date.now();

      // Guard: project root must exist before any I/O (metrics, logs, etc.).
      // fs.mkdir with { recursive: true } would otherwise silently create the
      // directory, hiding typos / non-existent paths from the caller.
      try {
        await fs.access(this.projectRoot);
      } catch {
        throw new Error(`Project root does not exist: ${this.projectRoot}`);
      }

      // Open log file for this run so all logger output is persisted.
      // Use this.workflowDir so that tests passing a custom workflowDir
      // (e.g. a temp directory) don't pollute the real .ai_workflow/logs folder.
      const logsRunDir = path.join(this.workflowDir, 'logs', this.configManager.workflowRunId);
      await logger.setLogFile(path.join(logsRunDir, 'workflow.log'));
      this.logsRunDir = logsRunDir;

      logger.info(`${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
      logger.info(`${colors.blue}  AI Workflow Automation - Starting${colors.reset}`);
      logger.info(`${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
      logger.info(`Stage: ${this.stage}`);
      logger.info(`Mode: ${this.auto ? 'auto' : 'interactive'}`);

      this.projectWorkflowConfig = await this._ensureProjectWorkflowConfig();
      const disabledConfiguredStepIds = getDisabledWorkflowConfigStepIds(
        this.projectWorkflowConfig
      );

      // Register all steps and apply repo-local workflow overrides before
      // any profile work or pre-flight suites so deterministic config errors
      // fail before the run appears to have started executing.
      logger.info(
        'Validating .workflow-config.yaml step overrides against canonical workflow order...'
      );
      logger.info('Preflight config validation only — no workflow steps have started yet.');
      logger.info(PRE_FLIGHT_GIT_STASH_REQUIREMENT_MESSAGE);
      this.registerAllSteps(this.projectWorkflowConfig);
      const configuredDependencyIndex = Object.fromEntries(
        this.stepRegistry.list().map((step) => [step.id, step.dependencies || []])
      );
      const stageConfiguredSteps = getConfiguredStepsForStage(
        this.stage,
        this.projectWorkflowConfig
      );
      const stepsWithDependencyComment = new Set(
        (this.projectWorkflowConfig?.workflow?.steps || [])
          .filter((s) => typeof s?.dependency_comment === 'string' && s.dependency_comment.trim())
          .map((s) => normalizeWorkflowConfigStepId(s?.id))
          .filter(Boolean)
      );
      const configuredPlanValidation = validatePlannedStepDependencies(
        stageConfiguredSteps,
        configuredDependencyIndex,
        getStepsForStage(this.stage),
        { disabledStepIds: disabledConfiguredStepIds, stepsWithDependencyComment }
      );
      if (!configuredPlanValidation.valid) {
        logEffectiveExecutionPlan(
          buildExecutionPlanPreview(stageConfiguredSteps, this.stepRegistry),
          'Effective configured workflow step set before validation failure:'
        );
        throw attachWorkflowFailureContext(new Error(configuredPlanValidation.errors.join('\n')), {
          failedPhase: 'preflight_config_validation',
          workflowStepsStarted: false,
          executedSteps: [],
          executionPlanBuilt: false,
          failedCommand: null,
        });
      }
      logger.info('Workflow configuration overrides validated.');
      if (disabledConfiguredStepIds.length > 0) {
        const configuredSteps = this.projectWorkflowConfig?.workflow?.steps ?? [];
        for (const stepId of disabledConfiguredStepIds) {
          const rawStep = configuredSteps.find(
            (s) => normalizeWorkflowConfigStepId(s?.id) === stepId
          );
          const reason = typeof rawStep?.reason === 'string' ? `: ${rawStep.reason}` : '';
          logger.info(`[Config] ${stepId} excluded — disabled in .workflow-config.yaml${reason}`);
        }
      }

      // Detect workflow profile
      detectedProfile = await this.profileManager.detectProfile();
      logger.info(`Preliminary profile selected for preflight: ${detectedProfile}`);

      // Health checks
      const healthResults = await this.healthCheck();
      if (!healthResults.passed) {
        const preflightCheck = healthResults.checks[HEALTH_CHECK_CATEGORIES.PREFLIGHT];
        if (this.logsRunDir) {
          await writePreflightSummary(
            this.logsRunDir,
            buildPreflightSummary({
              detectedProfile,
              changeCounts: this.profileManager?.changeCounts ?? null,
              failedPhase: 'preflight_health_checks',
              workflowStepsStarted: false,
              executionPlanBuilt: false,
              executedSteps: [],
              noAiReviewPromptsIssued: true,
              failedCommand: preflightCheck?.failedCommand ?? null,
              failureKind: preflightCheck?.failureKind ?? null,
              message: preflightCheck?.message ?? null,
              advisoryMessage: preflightCheck?.advisoryMessage ?? null,
            })
          );
        }
        throw attachWorkflowFailureContext(new Error('Health checks failed - cannot proceed'), {
          failedPhase: 'preflight_health_checks',
          workflowStepsStarted: false,
          executedSteps: [],
          executionPlanBuilt: false,
          failedCommand: preflightCheck?.failedCommand,
        });
      }

      logEffectiveExecutionPlan(
        buildExecutionPlanPreview(stageConfiguredSteps, this.stepRegistry),
        'Configured workflow step set (preflight passed, subject to profile filtering after merged change detection):'
      );

      // Initialize metrics (creates current_run.json so step_17 can read it)
      await this.metricsCollector.initMetrics();

      // ── Commit-history-aware change detection ──────────────────────────────
      // Load the commit hash persisted by the previous ai_workflow.js run.
      // If a valid hash is found, diff against HEAD to get committed changes.
      // On first run (no history) or on an invalid hash, fall back to the
      // last 30 commits so the workflow always has a meaningful file set.
      const commitHistory = new CommitHistory({ workflowDir: this.workflowDir });
      const lastRunCommit = commitHistory.getLastRunCommit();
      // Capture HEAD before any workflow commits (step_0f, step_12) so the
      // next run's diff reflects real source changes, not artifact commits.
      const headAtWorkflowStart = (() => {
        try {
          return this.gitOps.getCurrentHead();
        } catch {
          return null;
        }
      })();
      let committedChangedFiles = [];

      if (lastRunCommit && isValidCommitHash(lastRunCommit)) {
        try {
          committedChangedFiles = this.gitOps.getChangedFilesSince(lastRunCommit);
          // Filter out .ai_workflow/ artifact files — they are internal bookkeeping,
          // not real source changes that steps should process.
          const sourceChanges = committedChangedFiles.filter(
            (f) => !f.file?.startsWith('.ai_workflow/')
          );
          if (sourceChanges.length === 0 && committedChangedFiles.length > 0) {
            // Only artifact files changed (e.g., step_0f/step_12 committed logs).
            // Fall back to last 30 commits so steps have a meaningful file set.
            logger.info(
              `[CommitHistory] Changes since ${lastRunCommit.substring(0, 7)} are artifact-only — falling back to last 30 commits`
            );
            committedChangedFiles = this.gitOps.getLastNCommitsFiles(30);
          } else {
            committedChangedFiles = sourceChanges;
            logger.info(
              `[CommitHistory] ${committedChangedFiles.length} file(s) changed since last run (${lastRunCommit.substring(0, 7)})`
            );
          }
        } catch {
          logger.warn(
            `[CommitHistory] Hash ${lastRunCommit.substring(0, 7)} not found — falling back to last 30 commits`
          );
          committedChangedFiles = this.gitOps.getLastNCommitsFiles(30);
        }
      } else {
        logger.info('[CommitHistory] No previous run detected — using last 30 commits as baseline');
        committedChangedFiles = this.gitOps.getLastNCommitsFiles(30);
      }
      // ──────────────────────────────────────────────────────────────────────

      // Merge committed + uncommitted changes into a single file list used both
      // for optimizer hints and as the modifiedFiles passed to all steps.
      let allChangedFiles = committedChangedFiles
        .filter((f) => f.status !== 'deleted')
        .map((f) => f.file || f);

      // Run change-type optimizer for savings estimate (advisory only)
      try {
        const status = await this.gitOps.status();
        // Merge committed changes (since last run) with current uncommitted changes,
        // deduplicating by file path so each file appears once.
        const uncommittedFiles = [
          ...(status.staged || []),
          ...(status.unstaged || []),
          ...(status.untracked || []),
        ];
        const seenPaths = new Set(committedChangedFiles.map((f) => f.file));
        const mergedFiles = [
          ...committedChangedFiles,
          ...uncommittedFiles.filter((f) => !seenPaths.has(f.file)),
        ].filter((f) => f.status !== 'deleted');
        const changedFiles = mergedFiles.map((f) => f.file || f);
        allChangedFiles = changedFiles;

        // Re-derive the profile from the merged change set so the execution plan,
        // downstream context, and optimizer all use the same evidence source.
        if (allChangedFiles.length > 0) {
          const previousProfile = detectedProfile;
          this.profileManager.refreshWithFiles(allChangedFiles);
          detectedProfile = this.profileManager.currentProfile;
          if (detectedProfile !== previousProfile) {
            logger.info(
              `[CommitHistory] Profile updated to '${detectedProfile}' based on ${allChangedFiles.length} merged changed file(s)`
            );
          }
        }

        if (changedFiles.length > 0) {
          let optimizer;
          if (detectedProfile === 'docs_only') {
            optimizer = new DocsOnlyOptimizer();
            const optimizerAnalysis = optimizer.analyze(changedFiles, stepsToExecute);
            if (optimizerAnalysis.timeSavings > 0) {
              logger.info(`[Optimizer] Estimated time savings: ${optimizerAnalysis.timeSavings}s`);
            }
          } else if (detectedProfile === 'code_changes' || detectedProfile === 'test_changes') {
            optimizer = new CodeChangesOptimizer();
            const codeChanges = changedFiles.map((f) => ({ path: f }));
            const optimizerAnalysis = optimizer.analyze(codeChanges, stepsToExecute);
            if (optimizerAnalysis.timeSaved > 0) {
              logger.info(`[Optimizer] Estimated time savings: ${optimizerAnalysis.timeSaved}s`);
            }
          } else {
            optimizer = new FullChangesOptimizer();
            const fullChanges = changedFiles.map((f) => ({ path: f, type: 'modified' }));
            const optimizerAnalysis = await optimizer.analyze(fullChanges, stepsToExecute);
            if (optimizerAnalysis && optimizerAnalysis.summary) {
              logger.info(`[Optimizer] Full changes analysis: ${optimizerAnalysis.summary}`);
            }
          }
        }
      } catch {
        // Optimizer is advisory only — never block execution
      }

      // Determine steps to execute after profile reconciliation so the final plan
      // uses the same merged change set as the optimizer and step context.
      const configuredStepsForStage = getConfiguredStepsForStage(
        this.stage,
        this.projectWorkflowConfig
      );
      const dependencyIndex = Object.fromEntries(
        this.stepRegistry.list().map((step) => [step.id, step.dependencies || []])
      );
      const profileSkipSteps = this.profileManager.getSkipSteps();
      const profileFocusSteps = this.profileManager.getFocusSteps();
      const normalizedFocusStepIds = normalizeProfileFocusStepIds(
        profileFocusSteps,
        configuredStepsForStage
      );
      const eligibleFocusStepIds = filterProfileFocusStepIdsForContext(
        normalizedFocusStepIds,
        this.projectWorkflowConfig
      );
      const mandatoryStepIds = getMandatoryStepIdsForStage(this.stage, configuredStepsForStage);
      let stepsToExecute;
      if (normalizedFocusStepIds.length > 0 && eligibleFocusStepIds.length === 0) {
        logger.warn(
          `[Profile] Focused plan for '${detectedProfile}' has no runtime-eligible target steps for this project — falling back to the stage-default execution plan`
        );
        stepsToExecute = configuredStepsForStage;
      } else {
        if (eligibleFocusStepIds.length !== normalizedFocusStepIds.length) {
          const droppedFocusStepIds = normalizedFocusStepIds.filter(
            (stepId) => !eligibleFocusStepIds.includes(stepId)
          );
          logger.info(
            `[Profile] Dropping ineligible focus step(s): ${droppedFocusStepIds.join(', ')}`
          );
        }
        stepsToExecute = filterStepIdsByProfile(
          configuredStepsForStage,
          profileSkipSteps,
          dependencyIndex,
          profileFocusSteps === 'all' ? 'all' : eligibleFocusStepIds,
          mandatoryStepIds
        );
      }
      if (
        eligibleFocusStepIds.length > 0 &&
        !eligibleFocusStepIds.every((stepId) => stepsToExecute.includes(stepId))
      ) {
        logger.warn(
          `[Profile] Focused plan for '${detectedProfile}' could not preserve all target steps — falling back to the stage-default execution plan`
        );
        stepsToExecute = configuredStepsForStage;
      }
      if (stepsToExecute.length !== configuredStepsForStage.length) {
        logger.info(
          `[Profile] Filtered execution plan for '${detectedProfile}': ${configuredStepsForStage.length} → ${stepsToExecute.length} step(s)`
        );
      }
      const selectedPlanValidation = validatePlannedStepDependencies(
        stepsToExecute,
        dependencyIndex,
        getStepsForStage(this.stage),
        { disabledStepIds: disabledConfiguredStepIds, stepsWithDependencyComment }
      );
      if (!selectedPlanValidation.valid) {
        logEffectiveExecutionPlan(
          buildExecutionPlanPreview(stepsToExecute, this.stepRegistry),
          'Effective workflow step set before profile-filtered validation failure:'
        );
        throw attachWorkflowFailureContext(new Error(selectedPlanValidation.errors.join('\n')), {
          failedPhase: 'execution_plan_validation',
          workflowStepsStarted: false,
          executedSteps: [],
          executionPlanBuilt: false,
          failedCommand: null,
        });
      }
      logger.info(`Executing ${stepsToExecute.length} steps for stage: ${this.stage}`);

      const workflow = this._buildExecutableWorkflow(stepsToExecute);
      executionPlanBuilt = true;
      logEffectiveExecutionPlan(workflow.steps);

      workflowExecutionStarted = true;
      logger.info(`\n${colors.blue}Starting workflow execution...${colors.reset}\n`);

      const mlContextBase = {
        profile: this.profileManager.currentProfile,
        changeStats: buildMlChangeStats(allChangedFiles),
      };
      const executionContext = await this._buildWorkflowExecutionContext(
        context,
        detectedProfile,
        allChangedFiles,
        healthResults,
        workflow
      );
      this._attachWorkflowRunListeners(logsRunDir, mlContextBase);

      // Initialize ML optimizer (non-blocking)
      await this.mlOptimizer.initialize().catch(() => {});

      // Load and execute workflow
      await this.workflowEngine.loadWorkflow(workflow);
      this.performanceTracker.startTimer('workflow_total');
      const engineResult = await this.workflowEngine.executeWorkflow(executionContext);
      const checkpointId = await this._storeWorkflowRunResults(
        workflow,
        engineResult,
        executionContext
      );
      if (!engineResult.success) {
        logger.warn(
          `Checkpoint saved. After fixing the issue, resume with: ai-workflow resume ${checkpointId}`
        );
      }
      return this._finalizeWorkflowRun(workflow, engineResult, commitHistory, headAtWorkflowStart);
    } catch (error) {
      if (!workflowExecutionStarted) {
        const runState = buildWorkflowFailureRunState(error, {
          failedPhase: workflowExecutionStarted ? 'workflow_execution' : 'preflight',
          workflowStepsStarted: workflowExecutionStarted,
          executedSteps: Object.keys(this.results?.steps || {}),
          executionPlanBuilt,
          failedCommand: null,
        });
        if (runState.failed_phase !== 'preflight_health_checks') {
          await writePreflightSummary(
            this.logsRunDir,
            buildPreflightSummary({
              detectedProfile,
              changeCounts: this.profileManager?.changeCounts ?? null,
              failedPhase: runState.failed_phase,
              workflowStepsStarted: runState.workflow_steps_started,
              executedSteps: runState.executed_steps,
              executionPlanBuilt: runState.execution_plan_built,
              failedCommand: runState.failed_command,
              message: error?.message ?? null,
              noAiReviewPromptsIssued: true,
              dependencyOverrides: Array.isArray(error?.dependencyOverrides)
                ? error.dependencyOverrides
                : null,
            })
          );
        }
        logger.error(
          `${colors.red}✗ Preflight validation failed before workflow execution (0 steps executed)${colors.reset}`
        );
        logger.error('No AI review prompts were issued in this run.');
      }
      logger.error(
        `[RunState] ${JSON.stringify(
          buildWorkflowFailureRunState(error, {
            failedPhase: workflowExecutionStarted ? 'workflow_execution' : 'preflight',
            workflowStepsStarted: workflowExecutionStarted,
            executedSteps: Object.keys(this.results?.steps || {}),
            executionPlanBuilt,
            failedCommand: null,
          })
        )}`
      );
      logger.error(`${colors.red}✗ Workflow terminated before completion${colors.reset}`);
      logger.error(`${colors.red}✗ Workflow failed: ${error.message}${colors.reset}`);
      await logger.closeLogFile();

      return {
        success: false,
        error: error.message,
        results: this.results,
        duration: Date.now() - (this.startTime || Date.now()),
      };
    }
  }

  /**
   * Create a step handler function from step definition
   * @private
   * @param {string} stepId - Step ID
   * @param {Object} stepDef - Step definition from registry
   * @returns {Function} Step handler function
   */
  _createStepHandler(stepId, stepDef) {
    return async (context) => {
      try {
        // Get executor class
        const ExecutorClass = await this._resolveStepExecutor(stepId, stepDef.handler);
        if (!ExecutorClass) {
          throw new Error(`No executor class found for step: ${stepId}`);
        }

        // Build common dependencies for all steps
        const commonDeps = {
          executor: {
            execute: executorModule,
          },
          gitOps: this.gitOps,
          projectDetection: this.projectDetection,
          projectKindConfig: this.projectKindConfig,
          techStackDetection: this.techStackDetection,
          configManager: this.configManager,
          backlogManager: this.backlogManager,
          backlog: this.backlogManager,
          metricsCollector: this.metricsCollector,
          fileOps: new FileOperations({ logger }),
          logger, // ensure steps using options.logger write to the run log file
          enableParallel: !this.noParallel,
          sdkSmokeTest: this.sdkSmokeTest,
          promptsDir: this.logsRunDir ? path.join(this.logsRunDir, 'prompts', stepId) : null,
        };

        // Read project version from target project's package.json (non-fatal).
        // Stamped into every prompt log header so validators can tell which
        // project version the AI findings apply to.
        const projectVersion = await readProjectVersionFromPackage(this.projectRoot);
        commonDeps.projectVersion = projectVersion;

        // Read ai_workflow.js tool version and workflow_core submodule version (non-fatal).
        // Both are stamped into prompt log headers alongside the project version.
        const toolRoot = path.resolve(fileURLToPath(import.meta.url), '../../..');
        let workflowVersion = null;
        try {
          const toolPkgRaw = await fs.readFile(path.join(toolRoot, 'package.json'), 'utf8');
          workflowVersion = JSON.parse(toolPkgRaw).version || null;
        } catch {
          // tool package.json absent or unreadable — leave workflowVersion null
        }
        let workflowCoreVersion = null;
        try {
          const corePkgRaw = await fs.readFile(
            path.join(toolRoot, '.workflow_core', 'package.json'),
            'utf8'
          );
          workflowCoreVersion = JSON.parse(corePkgRaw).version || null;
        } catch {
          // .workflow_core absent or unreadable — leave workflowCoreVersion null
        }

        // Always inject a pre-configured AiHelper so that:
        // (a) project version is stamped into every prompt log header, and
        // (b) when streaming is enabled, token deltas are forwarded to the TUI.
        // Steps use 'options.aiHelper || new AiHelper(...)' so they pick this up for free.
        if (this.streamingEnabled) {
          const engine = this.workflowEngine;
          const stepName = stepDef.name;
          let tokenIndex = 0;
          const streamStart = Date.now();
          commonDeps.aiHelper = new AiHelper({
            promptsDir: commonDeps.promptsDir,
            workingDirectory: this.projectRoot,
            projectVersion,
            workflowVersion,
            workflowCoreVersion,
            provider: this.aiProvider,
            streamingCallback: (delta, meta = {}) => {
              engine.emit('ai:stream:chunk', {
                stepId,
                stepName,
                persona: meta.persona ?? 'default',
                delta,
                tokenIndex: tokenIndex++,
              });
            },
          });
          // Wire stream-end emission to the step:complete event for this step.
          // We use a one-time listener keyed by stepId so it fires once then detaches.
          const onStepComplete = ({ step: completedStep }) => {
            if (completedStep?.id !== stepId) return;
            engine.off('step:complete', onStepComplete);
            engine.off('step:error', onStepComplete);
            const durationMs = Date.now() - streamStart;
            engine.emit('ai:stream:end', {
              stepId,
              stepName,
              totalTokens: tokenIndex,
              durationMs,
              tokensPerSec: tokenIndex > 0 ? Math.round((tokenIndex / durationMs) * 1000) : 0,
            });
          };
          engine.on('step:complete', onStepComplete);
          engine.on('step:error', onStepComplete);
        } else {
          // Non-streaming: inject a plain AiHelper with version fields so that
          // all versions are stamped into prompt log headers.
          commonDeps.aiHelper = new AiHelper({
            promptsDir: commonDeps.promptsDir,
            workingDirectory: this.projectRoot,
            projectVersion,
            workflowVersion,
            workflowCoreVersion,
            provider: this.aiProvider,
          });
        }

        // Create executor instance with dependencies
        const executor = new ExecutorClass(commonDeps);

        // Execute step
        if (typeof executor.execute !== 'function') {
          throw new Error(`Executor for ${stepId} does not have an execute method`);
        }

        // Ensure projectRoot is always defined (fallback to this.projectRoot)
        const projectRoot = context.projectRoot || this.projectRoot || process.cwd();

        // Dispatch by step kind:
        //   ProjectStep → execute(projectRoot: string, context: Object)
        //   ContextStep → execute(context: { projectRoot, ... })
        // context.results contains previous step outputs (indexed by stepId via .find())
        // and is used by steps like step_11_6 that depend on a prior step's output.
        const kind = ExecutorClass.stepKind ?? STEP_KIND.PROJECT;
        const result =
          kind === STEP_KIND.CONTEXT
            ? await executor.execute({ projectRoot, ...context })
            : await executor.execute(projectRoot, context);

        return result;
      } catch (error) {
        logger.error(`Error executing step ${stepId}: ${error.message}`);
        throw error;
      }
    };
  }

  async _resolveStepExecutor(stepId, handler) {
    if (!handler) {
      return null;
    }

    if (isClassConstructor(handler)) {
      return handler;
    }

    const ExecutorClass = await handler();
    if (typeof ExecutorClass !== 'function') {
      throw new Error(`Invalid executor loader for step: ${stepId}`);
    }

    return ExecutorClass;
  }

  /**
   * Resume workflow from checkpoint
   * @param {string} checkpointId - Checkpoint ID to resume from
   * @returns {Promise<Object>} Workflow results
   */
  async resume(checkpointId) {
    try {
      logger.info(
        `${colors.blue}Resuming workflow from checkpoint: ${checkpointId}${colors.reset}`
      );

      // Load checkpoint
      const checkpoint = await this.checkpointManager.load(checkpointId);

      if (!checkpoint) {
        throw new Error(`Checkpoint not found: ${checkpointId}`);
      }

      // Restore state from checkpoint
      this.results = { steps: checkpoint.state.results || {} };
      // Note: Stage is not stored in checkpoint, keep current stage

      // Get completed steps from checkpoint
      const completedSteps = checkpoint.state.completedSteps || [];
      logger.info(`Found ${completedSteps.length} completed steps in checkpoint`);

      // Determine remaining steps before registering (optimization)
      this.projectWorkflowConfig = await this._ensureProjectWorkflowConfig();
      const allSteps = getConfiguredStepsForStage(this.stage, this.projectWorkflowConfig);
      const remainingSteps = allSteps.filter((stepId) => !completedSteps.includes(stepId));

      if (remainingSteps.length === 0) {
        logger.info(`${colors.green}All steps already completed${colors.reset}`);
        return {
          success: true,
          workflow: { id: checkpoint.workflowId },
          results: this.results,
          resumed: true,
        };
      }

      // Register all steps (only if we have remaining work)
      this.registerAllSteps(this.projectWorkflowConfig);
      const disabledConfiguredStepIds = getDisabledWorkflowConfigStepIds(
        this.projectWorkflowConfig
      );
      const dependencyIndex = Object.fromEntries(
        this.stepRegistry.list().map((step) => [step.id, step.dependencies || []])
      );
      const stepsWithDependencyComment = new Set(
        (this.projectWorkflowConfig?.workflow?.steps || [])
          .filter((s) => typeof s?.dependency_comment === 'string' && s.dependency_comment.trim())
          .map((s) => normalizeWorkflowConfigStepId(s?.id))
          .filter(Boolean)
      );
      const selectedPlanValidation = validatePlannedStepDependencies(
        allSteps,
        dependencyIndex,
        getStepsForStage(this.stage),
        { disabledStepIds: disabledConfiguredStepIds, stepsWithDependencyComment }
      );
      if (!selectedPlanValidation.valid) {
        throw new Error(selectedPlanValidation.errors.join('\n'));
      }

      logger.info(`Resuming with ${remainingSteps.length} remaining steps`);

      // Create workflow definition for remaining steps
      const workflow = {
        id: checkpoint.workflowId,
        name: 'AI Workflow Automation (Resumed)',
        version: '2.0.0',
        steps: remainingSteps.map((stepId) => {
          const stepDef = this.stepRegistry.get(stepId);
          return {
            id: stepId,
            name: stepDef.name,
            dependencies: stepDef.dependencies || [],
            handler: this._createStepHandler(stepId, stepDef),
          };
        }),
      };

      // Setup event listeners
      this.workflowEngine.on('step:start', ({ step }) => {
        this.currentStep = step.id;
        logger.info(`\n${colors.cyan}→ Starting: ${step.name}${colors.reset}`);
      });

      this.workflowEngine.on('step:complete', ({ step, result }) => {
        const durationStr = result.duration ? `(${Math.round(result.duration / 1000)}s)` : '';
        logger.info(`${colors.green}✓ Completed: ${step.name}${colors.reset} ${durationStr}`);

        // Update results
        this.results.steps[step.id] = result;
      });

      this.workflowEngine.on('step:error', ({ step, error }) => {
        logger.error(`${colors.red}✗ Failed: ${step.name} - ${error.message}${colors.reset}`);
      });

      // Execute remaining steps
      this.startTime = Date.now();
      await this.workflowEngine.loadWorkflow(workflow);
      const engineResult = await this.workflowEngine.executeWorkflow({
        workflowDir: this.workflowDir,
        projectRoot: this.projectRoot,
        auto: this.auto,
        projectType:
          this.projectWorkflowConfig?.project?.type ||
          (await this.projectDetection.detectProjectKind(this.projectRoot))?.kind ||
          null,
        projectDescription:
          this.projectWorkflowConfig?.project?.description || path.basename(this.projectRoot),
      });

      // Merge results
      engineResult.results.forEach((result) => {
        this.results.steps[result.stepId] = result;
      });

      this.results.status = engineResult.success ? 'success' : 'failed';
      this.results.endTime = Date.now();

      // Save final checkpoint
      await this.checkpointManager.save(workflow, {
        workflowId: workflow.id,
        stage: this.stage,
        results: this.results,
        timestamp: Date.now(),
      });

      logger.info(`\n${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
      logger.info(`${colors.green}✓ Workflow resumed and completed${colors.reset}`);
      logger.info(`${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);

      return {
        success: engineResult.success,
        workflow,
        results: this.results,
        resumed: true,
        duration: Date.now() - this.startTime,
      };
    } catch (error) {
      logger.error(`${colors.red}Failed to resume workflow: ${error.message}${colors.reset}`);

      return {
        success: false,
        error: error.message,
        resumed: false,
      };
    }
  }

  /**
   * Get current workflow status
   * @returns {Object} Current status
   */
  getStatus() {
    const completed = Object.keys(this.results.steps).length;
    const total = getConfiguredStepsForStage(this.stage, this.projectWorkflowConfig).length;
    const progress = calculateProgress(completed, total);
    const status = determineWorkflowStatus(this.results);

    return {
      currentStep: this.currentStep,
      completed,
      total,
      progress,
      status,
      duration: Date.now() - (this.startTime || Date.now()),
    };
  }
}

export default MainOrchestrator;
