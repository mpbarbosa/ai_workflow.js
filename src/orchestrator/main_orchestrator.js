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
import { WorkflowProfileManager } from '../lib/workflow_profiles.js';
import { AiHelper } from '../lib/ai_helpers.js';
import { DocsOnlyOptimizer } from '../lib/docs_only_optimization.js';
import { CodeChangesOptimizer } from '../lib/code_changes_optimization.js';
import { FullChangesOptimizer } from '../lib/full_changes_optimization.js';
import { MLOptimizer } from '../lib/ml_optimization.js';
import { CommitHistory, isValidCommitHash } from '../lib/commit_history.js';
import { fileURLToPath } from 'url';

// ============================================================================
// CONSTANTS
// ============================================================================

export const WORKFLOW_STAGES = Object.freeze({
  QUICK: 'quick', // Fast validation (docs, config, basic checks)
  MEDIUM: 'medium', // Add tests and quality checks
  FULL: 'full', // Complete workflow with all steps
});

export const HEALTH_CHECK_CATEGORIES = Object.freeze({
  ENVIRONMENT: 'environment',
  CONFIGURATION: 'configuration',
  DEPENDENCIES: 'dependencies',
  FILESYSTEM: 'filesystem',
});

const STEP_EXECUTOR_LOADERS = Object.freeze({
  step_00: () => import('../steps/step_00_analyze.js').then(({ Step0Analyzer }) => Step0Analyzer),
  step_0b: () =>
    import('../steps/step_0b_bootstrap_docs.js').then(
      ({ Step0bBootstrapDocs }) => Step0bBootstrapDocs
    ),
  step_01: () =>
    import('../steps/step_01_documentation.js').then(
      ({ Step1DocumentationAnalyzer }) => Step1DocumentationAnalyzer
    ),
  step_01_5: () =>
    import('../steps/step_01_5_copilot_instructions.js').then(
      ({ Step1_5CopilotInstructionsValidator }) => Step1_5CopilotInstructionsValidator
    ),
  step_02: () =>
    import('../steps/step_02_consistency.js').then(
      ({ Step2ConsistencyAnalyzer }) => Step2ConsistencyAnalyzer
    ),
  step_02_5: () =>
    import('../steps/step_02_5_doc_optimize.js').then(
      ({ DocumentationOptimizer }) => DocumentationOptimizer
    ),
  step_03: () =>
    import('../steps/step_03_script_refs.js').then(
      ({ Step3ScriptAnalyzer }) => Step3ScriptAnalyzer
    ),
  step_04: () =>
    import('../steps/step_04_config_validation.js').then(
      ({ Step4ConfigAnalyzer }) => Step4ConfigAnalyzer
    ),
  step_05: () =>
    import('../steps/step_05_directory.js').then(
      ({ Step5DirectoryAnalyzer }) => Step5DirectoryAnalyzer
    ),
  step_06: () =>
    import('../steps/step_06_test_review.js').then(({ Step6TestReviewer }) => Step6TestReviewer),
  step_07: () =>
    import('../steps/step_07_test_gen.js').then(({ Step7TestGenerator }) => Step7TestGenerator),
  step_08: () =>
    import('../steps/step_08_test_exec.js').then(({ Step8TestExecutor }) => Step8TestExecutor),
  step_09: () =>
    import('../steps/step_09_dependencies.js').then(
      ({ Step9DependencyValidator }) => Step9DependencyValidator
    ),
  step_10: () =>
    import('../steps/step_10_code_quality.js').then(
      ({ Step10CodeQualityAnalyzer }) => Step10CodeQualityAnalyzer
    ),
  step_11: () =>
    import('../steps/step_11_context.js').then(
      ({ Step11ContextAnalyzer }) => Step11ContextAnalyzer
    ),
  step_11_5: () =>
    import('../steps/step_11_5_aws_lbs_validation.js').then(
      ({ Step11_5AwsLbsValidator }) => Step11_5AwsLbsValidator
    ),
  step_11_6: () =>
    import('../steps/step_11_6_aws_serverless_review.js').then(
      ({ Step11_6AwsServerlessReviewer }) => Step11_6AwsServerlessReviewer
    ),
  step_12: () =>
    import('../steps/step_12_git_finalization.js').then(
      ({ Step12GitFinalization }) => Step12GitFinalization
    ),
  step_13: () =>
    import('../steps/step_13_markdown_lint.js').then(
      ({ Step13MarkdownLint }) => Step13MarkdownLint
    ),
  step_14: () =>
    import('../steps/step_14_prompt_engineer.js').then(
      ({ Step14PromptEngineer }) => Step14PromptEngineer
    ),
  step_15: () =>
    import('../steps/step_15_ux_analysis.js').then(({ Step15UxAnalysis }) => Step15UxAnalysis),
  step_16: () =>
    import('../steps/step_16_version_update.js').then(
      ({ Step16VersionUpdate }) => Step16VersionUpdate
    ),
  step_17: () =>
    import('../steps/step_17_summary.js').then(({ WorkflowSummary }) => WorkflowSummary),
  step_18: () =>
    import('../steps/step_18_debugging.js').then(({ Step18Debugging }) => Step18Debugging),
  step_19: () =>
    import('../steps/step_19_typescript_review.js').then(
      ({ Step19TypescriptReview }) => Step19TypescriptReview
    ),
  step_20: () =>
    import('../steps/step_20_async_perf_review.js').then(
      ({ Step20AsyncPerfReview }) => Step20AsyncPerfReview
    ),
  step_21: () =>
    import('../steps/step_21_doc_consolidation.js').then(
      ({ DocConsolidationStep }) => DocConsolidationStep
    ),
  step_22: () =>
    import('../steps/step_22_accessibility_review.js').then(
      ({ Step22AccessibilityReview }) => Step22AccessibilityReview
    ),
  step_23: () =>
    import('../steps/step_23_perf_review.js').then(({ Step23PerfReview }) => Step23PerfReview),
  step_0f: () =>
    import('../steps/step_0f_commit_artifacts.js').then(
      ({ Step0fCommitArtifacts }) => Step0fCommitArtifacts
    ),
});

function isClassConstructor(value) {
  return typeof value === 'function' && /^class\s/.test(Function.prototype.toString.call(value));
}

// ============================================================================
// PURE FUNCTIONS - Configuration and Planning
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
 * Determine which steps to execute based on stage
 * @pure
 * @param {string} stage - Workflow stage (quick/medium/full)
 * @returns {Array<string>} Array of step IDs to execute
 */
export function getStepsForStage(stage) {
  const stages = {
    [WORKFLOW_STAGES.QUICK]: [
      'step_00', // Pre-analysis
      'step_01', // Documentation
      'step_01_5', // Copilot instructions validation
      'step_02', // Consistency
      'step_04', // Config validation
      'step_05', // Directory structure
    ],
    [WORKFLOW_STAGES.MEDIUM]: [
      'step_00',
      'step_01',
      'step_01_5', // Copilot instructions validation
      'step_02',
      'step_02_5', // Doc optimization
      'step_21', // Doc consolidation
      'step_03', // Script refs
      'step_04',
      'step_05',
      'step_06', // Test review
      'step_07', // Test generation
      'step_08', // Test execution
      'step_10', // Code quality
      'step_13', // Markdown lint
    ],
    [WORKFLOW_STAGES.FULL]: [
      'step_00',
      'step_0b', // Bootstrap docs
      'step_01',
      'step_01_5', // Copilot instructions validation
      'step_02',
      'step_02_5',
      'step_21', // Doc consolidation
      'step_03',
      'step_04',
      'step_05',
      'step_06',
      'step_07',
      'step_08',
      'step_09', // Dependencies
      'step_10',
      'step_11', // Context
      'step_11_5', // AWS LBS Validation
      'step_11_6', // AWS Serverless AI Review
      'step_13',
      'step_14', // Prompt engineer
      'step_15', // UX analysis
      'step_16', // Version update
      'step_18', // Debugging analysis
      'step_19', // TypeScript review (Strider)
      'step_20', // Async performance review
      'step_22', // Accessibility review
      'step_23', // Performance review
      'step_17', // Summary
      'step_0f', // Commit artifacts
      'step_12', // Git finalization (must run last)
    ],
  };

  return stages[stage] || stages[WORKFLOW_STAGES.FULL];
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

/**
 * Perform health checks
 * @pure
 * @param {Object} environment - Environment data
 * @returns {Object} Health check results
 */
export function performHealthChecks(environment) {
  const checks = {};

  // Environment checks
  checks[HEALTH_CHECK_CATEGORIES.ENVIRONMENT] = {
    nodeVersion: environment.nodeVersion || 'unknown',
    platform: environment.platform || 'unknown',
    passed: !!environment.nodeVersion,
  };

  // Configuration checks
  checks[HEALTH_CHECK_CATEGORIES.CONFIGURATION] = {
    configLoaded: !!environment.config,
    workflowDirExists: !!environment.workflowDir,
    passed: !!environment.config && !!environment.workflowDir,
  };

  // Filesystem checks
  checks[HEALTH_CHECK_CATEGORIES.FILESYSTEM] = {
    workflowDirWritable: environment.workflowDirWritable !== false,
    passed: environment.workflowDirWritable !== false,
  };

  const allPassed = Object.values(checks).every((check) => check.passed);

  return {
    passed: allPassed,
    checks,
  };
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
    this.resumeFromCheckpoint = options.resumeFromCheckpoint || null;
    this.sdkSmokeTest = options.sdkSmokeTest || false;
    this.alternatives = options.alternatives || false;
    // When true, each step receives a streaming AiHelper whose token deltas are
    // forwarded to workflowEngine as 'ai:stream:chunk' events for TUI display.
    this.streamingEnabled = !!(options.verbose || options.streamingEnabled);

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
        const SummaryGenerator = await this._resolveStepExecutor(
          'step_17',
          STEP_EXECUTOR_LOADERS.step_17
        );
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
    this.mlOptimizer = new MLOptimizer();

    // State
    this.currentStep = null;
    this.results = { steps: {} };
    this.startTime = null;
  }

  /**
   * Register all workflow steps
   */
  registerAllSteps() {
    logger.info('Registering workflow steps...');

    const steps = [
      {
        id: 'step_00',
        name: 'Pre-Analysis',
        description: 'Analyze git state and project context',
        handler: STEP_EXECUTOR_LOADERS.step_00,
        dependencies: [],
      },
      {
        id: 'step_0b',
        name: 'Bootstrap Documentation',
        description: 'Generate initial documentation',
        handler: STEP_EXECUTOR_LOADERS.step_0b,
        dependencies: ['step_00'],
      },
      {
        id: 'step_01',
        name: 'Documentation Updates',
        description: 'Validate and update documentation',
        handler: STEP_EXECUTOR_LOADERS.step_01,
        dependencies: ['step_00'],
      },
      {
        id: 'step_01_5',
        name: 'Copilot Instructions Validation',
        description: 'Audit and refresh .github/copilot-instructions.md against live repo facts',
        handler: STEP_EXECUTOR_LOADERS.step_01_5,
        dependencies: ['step_01'],
      },
      {
        id: 'step_02',
        name: 'Consistency Analysis',
        description: 'Check code and documentation consistency',
        handler: STEP_EXECUTOR_LOADERS.step_02,
        dependencies: ['step_01_5'],
      },
      {
        id: 'step_02_5',
        name: 'Documentation Optimization',
        description: 'Optimize documentation size and quality',
        handler: STEP_EXECUTOR_LOADERS.step_02_5,
        dependencies: ['step_02'],
      },
      {
        id: 'step_21',
        name: 'Doc Consolidation',
        description:
          'Find similar markdown docs via Cosine Similarity/TF-IDF and AI-merge them into canonical documents',
        handler: STEP_EXECUTOR_LOADERS.step_21,
        dependencies: ['step_02_5'],
      },
      {
        id: 'step_03',
        name: 'Script References',
        description: 'Validate script references',
        handler: STEP_EXECUTOR_LOADERS.step_03,
        dependencies: ['step_02'],
      },
      {
        id: 'step_04',
        name: 'Configuration Validation',
        description: 'Validate project configuration',
        handler: STEP_EXECUTOR_LOADERS.step_04,
        dependencies: ['step_00'],
      },
      {
        id: 'step_05',
        name: 'Directory Structure',
        description: 'Validate directory structure',
        handler: STEP_EXECUTOR_LOADERS.step_05,
        dependencies: ['step_04'],
      },
      {
        id: 'step_06',
        name: 'Test Review',
        description: 'Review existing tests',
        handler: STEP_EXECUTOR_LOADERS.step_06,
        dependencies: ['step_05'],
      },
      {
        id: 'step_07',
        name: 'Test Generation',
        description: 'Generate new tests',
        handler: STEP_EXECUTOR_LOADERS.step_07,
        dependencies: ['step_06'],
      },
      {
        id: 'step_08',
        name: 'Test Execution',
        description: 'Execute test suite',
        handler: STEP_EXECUTOR_LOADERS.step_08,
        dependencies: ['step_07'],
      },
      {
        id: 'step_09',
        name: 'Dependency Analysis',
        description: 'Analyze and validate dependencies',
        handler: STEP_EXECUTOR_LOADERS.step_09,
        dependencies: ['step_08'],
      },
      {
        id: 'step_10',
        name: 'Code Quality',
        description: 'Analyze code quality',
        handler: STEP_EXECUTOR_LOADERS.step_10,
        dependencies: ['step_09'],
      },
      {
        id: 'step_11',
        name: 'Context Management',
        description: 'Manage workflow context',
        handler: STEP_EXECUTOR_LOADERS.step_11,
        dependencies: ['step_10'],
      },
      {
        id: 'step_11_5',
        name: 'AWS LBS Validation',
        description:
          'Validate aws_lbs_backend_setup projects: shell scripts, Lambda structure, AWS config',
        handler: STEP_EXECUTOR_LOADERS.step_11_5,
        dependencies: ['step_11'],
      },
      {
        id: 'step_11_6',
        name: 'AWS Serverless AI Review',
        description: 'AI-powered deployment readiness review for aws_lbs_backend_setup projects',
        handler: STEP_EXECUTOR_LOADERS.step_11_6,
        dependencies: ['step_11_5'],
      },
      {
        id: 'step_13',
        name: 'Markdown Linting',
        description: 'Lint markdown files',
        handler: STEP_EXECUTOR_LOADERS.step_13,
        dependencies: ['step_11'],
      },
      {
        id: 'step_14',
        name: 'Prompt Engineering',
        description: 'Analyze and optimize AI prompts',
        handler: STEP_EXECUTOR_LOADERS.step_14,
        dependencies: ['step_13'],
      },
      {
        id: 'step_15',
        name: 'UX Analysis',
        description: 'Analyze UX and accessibility',
        handler: STEP_EXECUTOR_LOADERS.step_15,
        dependencies: ['step_14'],
      },
      {
        id: 'step_16',
        name: 'Version Update',
        description: 'Update semantic versions',
        handler: STEP_EXECUTOR_LOADERS.step_16,
        dependencies: ['step_15'],
      },
      {
        id: 'step_18',
        name: 'Debugging Analysis',
        description: 'AI-powered debugging analysis (observer, async, data-structure personas)',
        handler: STEP_EXECUTOR_LOADERS.step_18,
        dependencies: ['step_16'],
      },
      {
        id: 'step_19',
        name: 'TypeScript Review',
        description:
          'AI-powered TypeScript review using the "Strider" TypeScript Developer persona',
        handler: STEP_EXECUTOR_LOADERS.step_19,
        dependencies: ['step_18'],
      },
      {
        id: 'step_20',
        name: 'Async Performance Review',
        description:
          'AI-powered async performance review (overfetching, event loop, memory leaks, promise anti-patterns)',
        handler: STEP_EXECUTOR_LOADERS.step_20,
        dependencies: ['step_19'],
      },
      {
        id: 'step_22',
        name: 'Accessibility Review',
        description:
          'AI-powered WCAG 2.1 AA/AAA accessibility review (ARIA, keyboard navigation, colour contrast, reduced-motion)',
        handler: STEP_EXECUTOR_LOADERS.step_22,
        dependencies: ['step_21'],
      },
      {
        id: 'step_23',
        name: 'Performance Review',
        description:
          'AI-powered performance review (algorithmic complexity, sync I/O, memory hotspots, missing memoization)',
        handler: STEP_EXECUTOR_LOADERS.step_23,
        dependencies: ['step_22'],
      },
      {
        id: 'step_17',
        name: 'Workflow Summary',
        description: 'Generate workflow summary report',
        handler: STEP_EXECUTOR_LOADERS.step_17,
        dependencies: ['step_20', 'step_23'],
      },
      {
        id: 'step_0f',
        name: 'Commit Artifacts',
        description: 'Commit workflow artifacts generated during the run',
        handler: STEP_EXECUTOR_LOADERS.step_0f,
        dependencies: ['step_17'],
      },
      {
        id: 'step_12',
        name: 'Git Finalization',
        description: 'Stage, commit and push all modifications',
        handler: STEP_EXECUTOR_LOADERS.step_12,
        dependencies: ['step_0f'],
        critical: false,
      },
    ];

    for (const step of steps) {
      this.stepRegistry.register(step.id, {
        name: step.name,
        description: step.description,
        handler: step.handler,
        dependencies: step.dependencies,
        required: true,
        critical: step.critical !== undefined ? step.critical : true,
      });
    }

    logger.info(`${colors.green}✓${colors.reset} Registered ${steps.length} workflow steps`);
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
      logger.setLogFile(path.join(logsRunDir, 'workflow.log'));
      this.logsRunDir = logsRunDir;

      logger.info(`${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
      logger.info(`${colors.blue}  AI Workflow Automation - Starting${colors.reset}`);
      logger.info(`${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
      logger.info(`Stage: ${this.stage}`);
      logger.info(`Mode: ${this.auto ? 'auto' : 'interactive'}`);

      // Detect workflow profile
      let detectedProfile = await this.profileManager.detectProfile();
      logger.info(`Profile: ${detectedProfile}`);

      // Health checks
      const healthResults = await this.healthCheck();
      if (!healthResults.passed) {
        throw new Error('Health checks failed - cannot proceed');
      }

      // Initialize metrics (creates current_run.json so step_17 can read it)
      await this.metricsCollector.initMetrics();

      // Register all steps
      this.registerAllSteps();

      // Determine steps to execute
      const stepsToExecute = getStepsForStage(this.stage);
      logger.info(`Executing ${stepsToExecute.length} steps for stage: ${this.stage}`);

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

        // If git status saw 0 changes but CommitHistory has committed changes,
        // re-derive the profile so steps get the correct context.
        if (allChangedFiles.length > 0 && this.profileManager.changeCounts?.total === 0) {
          this.profileManager.refreshWithFiles(allChangedFiles);
          detectedProfile = this.profileManager.currentProfile;
          logger.info(
            `[CommitHistory] Profile updated to '${detectedProfile}' based on ${allChangedFiles.length} committed file(s)`
          );
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

      // Create workflow definition with step handlers
      const workflow = {
        id: `workflow_${Date.now()}`,
        name: 'AI Workflow Automation',
        version: '2.0.0',
        steps: stepsToExecute.map((stepId) => {
          const stepDef = this.stepRegistry.get(stepId);
          return {
            id: stepId,
            name: stepDef.name,
            dependencies: stepDef.dependencies || [],
            handler: this._createStepHandler(stepId, stepDef),
            critical: stepDef.critical !== false,
          };
        }),
      };

      // Execute workflow
      logger.info(`\n${colors.blue}Starting workflow execution...${colors.reset}\n`);

      const executionContext = {
        ...context,
        workflowDir: this.workflowDir,
        projectRoot: this.projectRoot,
        auto: this.auto,
        workflowRunId: this.configManager.workflowRunId,
        modifiedFiles: allChangedFiles,
        projectType:
          (await this.projectDetection.detectProjectKind(this.projectRoot))?.kind ?? null,
        // Req 9: ensure AI prompt context fields are populated for all steps
        scope: context.scope || detectedProfile || '',
        projectDescription:
          context.projectDescription ||
          this.configManager?.getConfig?.()?.project_description ||
          this.configManager?.getConfig?.()?.project?.description ||
          path.basename(this.projectRoot),
        alternatives: this.alternatives,
      };

      // Setup event listeners for progress tracking
      const stepsLogDir = path.join(logsRunDir, 'steps');
      const mlPredictions = new Map();
      this.workflowEngine.on('step:start', ({ step }) => {
        this.currentStep = step.id;
        this.performanceTracker.startTimer(step.id);
        // ML: record prediction for this step
        try {
          if (this.mlOptimizer.initialized) {
            const pred = this.mlOptimizer.predict(step.id, {
              profile: this.profileManager.currentProfile,
            });
            mlPredictions.set(step.id, pred);
            if (pred.prediction === 'skip') {
              logger.debug(
                `[MLOptimizer] ${step.id}: predicted skippable (confidence ${pred.confidence.toFixed(2)})`
              );
            }
          }
        } catch {
          /* ML optimizer advisory only */
        }
        logger.openStepLogFile(path.join(stepsLogDir, `${step.id}.log`));
        logger.info(`\n${colors.cyan}→ Starting: ${step.name}${colors.reset}`);
      });

      this.workflowEngine.on('step:complete', ({ step, result }) => {
        const perfMetrics = this.performanceTracker.endTimer(step.id);
        this.performanceMonitor.checkMetrics(step.id, perfMetrics || {});
        // ML: record outcome
        try {
          if (this.mlOptimizer.initialized && mlPredictions.has(step.id)) {
            this.mlOptimizer.recordOutcome(
              step.id,
              { profile: this.profileManager.currentProfile },
              mlPredictions.get(step.id),
              result.success ? 'success' : 'failure'
            );
          }
        } catch {
          /* ML optimizer advisory only */
        }
        const durationStr = result.duration ? `(${Math.round(result.duration / 1000)}s)` : '';
        logger.info(`${colors.green}✓ Completed: ${step.name}${colors.reset} ${durationStr}`);
        logger.closeStepLogFile();
      });

      this.workflowEngine.on('step:error', ({ step, error }) => {
        // ML: record failure outcome
        try {
          if (this.mlOptimizer.initialized && mlPredictions.has(step.id)) {
            this.mlOptimizer.recordOutcome(
              step.id,
              { profile: this.profileManager.currentProfile },
              mlPredictions.get(step.id),
              'failure'
            );
          }
        } catch {
          /* ML optimizer advisory only */
        }
        logger.error(`${colors.red}✗ Failed: ${step.name} - ${error.message}${colors.reset}`);
        logger.closeStepLogFile();
      });

      this.workflowEngine.on('step:skipped', ({ step, result }) => {
        logger.openStepLogFile(path.join(stepsLogDir, `${step.id}.log`));
        logger.info(`${colors.yellow}⊘ Skipped: ${step.name} - ${result.reason}${colors.reset}`);
        logger.closeStepLogFile();
      });

      // Initialize ML optimizer (non-blocking)
      await this.mlOptimizer.initialize().catch(() => {});

      // Load and execute workflow
      await this.workflowEngine.loadWorkflow(workflow);
      this.performanceTracker.startTimer('workflow_total');
      const engineResult = await this.workflowEngine.executeWorkflow(executionContext);

      // Store results
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

      // Save checkpoint
      await this.checkpointManager.save(workflow, {
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

      // Generate summary — pass the current run ID explicitly to avoid reading a stale metrics file
      logger.info(`\n${colors.blue}Generating workflow summary...${colors.reset}`);
      const summary = await this.summaryGenerator.generateSummary({
        workflowRunId: this.configManager.workflowRunId,
      });

      // Calculate metrics
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
      logger.info(
        `Steps: ${engineResult.summary.succeeded}/${engineResult.summary.total} succeeded`
      );
      logger.info(`${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);

      // Persist the HEAD captured at workflow start so the next run diffs
      // against real source changes, not artifact commits made during this run.
      try {
        const headToSave = headAtWorkflowStart || this.gitOps.getCurrentHead();
        if (headToSave) {
          commitHistory.save(headToSave, workflow.id);
        }
      } catch {
        // Non-critical — never block completion
      }

      await logger.closeLogFile();

      return {
        success: engineResult.success,
        workflow,
        results: this.results,
        summary,
        duration,
      };
    } catch (error) {
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
          executor: executorModule,
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
        let projectVersion = null;
        try {
          const pkgRaw = await fs.readFile(path.join(this.projectRoot, 'package.json'), 'utf8');
          projectVersion = JSON.parse(pkgRaw).version || null;
        } catch {
          // package.json absent or unreadable — leave projectVersion null
        }
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
            projectVersion,
            workflowVersion,
            workflowCoreVersion,
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
            projectVersion,
            workflowVersion,
            workflowCoreVersion,
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
      const allSteps = getStepsForStage(this.stage);
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
      this.registerAllSteps();

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
    const total = getStepsForStage(this.stage).length;
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
