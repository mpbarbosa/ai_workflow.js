/**
 * @fileoverview Main Workflow Orchestrator (v2.0.0)
 * @module orchestrator/main_orchestrator
 *
 * High-level workflow coordinator that integrates all 20 workflow steps
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
import { Metrics } from '../lib/metrics.js';
import { Backlog } from '../lib/backlog.js';
import { GitAutomation } from '../lib/git_automation.js';
import { ProjectKindDetector } from '../lib/project_kind_detection.js';
import { ProjectKindConfigManager } from '../lib/project_kind_config.js';
import { TechStackDetector } from '../lib/tech_stack.js';
import { WorkflowSummary } from '../steps/step_17_summary.js';

// Import all workflow steps
import { Step0Analyzer } from '../steps/step_00_analyze.js';
import { Step1DocumentationAnalyzer } from '../steps/step_01_documentation.js';
import { Step2ConsistencyAnalyzer } from '../steps/step_02_consistency.js';
import { DocumentationOptimizer } from '../steps/step_02_5_doc_optimize.js';
import { Step3ScriptAnalyzer } from '../steps/step_03_script_refs.js';
import { Step4ConfigAnalyzer } from '../steps/step_04_config_validation.js';
import { Step5DirectoryAnalyzer } from '../steps/step_05_directory.js';
import { Step6TestReviewer } from '../steps/step_06_test_review.js';
import { Step7TestGenerator } from '../steps/step_07_test_gen.js';
import { Step8TestExecutor } from '../steps/step_08_test_exec.js';
import { Step9DependencyValidator } from '../steps/step_09_dependencies.js';
import { Step0bBootstrapDocs } from '../steps/step_0b_bootstrap_docs.js';
import { Step10CodeQualityAnalyzer } from '../steps/step_10_code_quality.js';
import { Step11ContextAnalyzer } from '../steps/step_11_context.js';
import { Step12GitFinalization } from '../steps/step_12_git_finalization.js';
import { Step13MarkdownLint } from '../steps/step_13_markdown_lint.js';
import { Step14PromptEngineer } from '../steps/step_14_prompt_engineer.js';
import { Step15UxAnalysis } from '../steps/step_15_ux_analysis.js';
import { Step16VersionUpdate } from '../steps/step_16_version_update.js';

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
      'step_02', // Consistency
      'step_04', // Config validation
      'step_05', // Directory structure
    ],
    [WORKFLOW_STAGES.MEDIUM]: [
      'step_00',
      'step_01',
      'step_02',
      'step_02_5', // Doc optimization
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
      'step_02',
      'step_02_5',
      'step_03',
      'step_04',
      'step_05',
      'step_06',
      'step_07',
      'step_08',
      'step_09', // Dependencies
      'step_10',
      'step_11', // Context
      'step_12', // Git finalization
      'step_13',
      'step_14', // Prompt engineer
      'step_15', // UX analysis
      'step_16', // Version update
      'step_17', // Summary
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
    this.workflowDir = options.workflowDir || '.ai_workflow';
    this.projectRoot = options.projectRoot || process.cwd();
    this.stage = options.stage || WORKFLOW_STAGES.FULL;
    this.auto = options.auto || false;
    this.noParallel = options.noParallel || false;
    this.resumeFromCheckpoint = options.resumeFromCheckpoint || null;
    this.sdkSmokeTest = options.sdkSmokeTest || false;

    // Validate config
    const validation = validateOrchestratorConfig(options);
    if (!validation.isValid) {
      throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
    }

    // Initialize components
    this.configManager = new Config(this.workflowDir);
    this.metricsCollector = new Metrics(this.workflowDir);
    this.checkpointManager = new CheckpointManager(this.workflowDir);
    this.stepRegistry = new StepRegistry();
    this.workflowEngine = new WorkflowEngine({
      projectRoot: this.projectRoot,
    });
    this.summaryGenerator = new WorkflowSummary(this.workflowDir);
    this.backlogManager = new Backlog(this.configManager); // Pass Config instance, not string
    this.gitOps = new GitAutomation(this.projectRoot);
    this.projectDetection = new ProjectKindDetector(this.projectRoot);
    this.projectKindConfig = new ProjectKindConfigManager({ projectRoot: this.projectRoot });
    this.techStackDetection = new TechStackDetector(this.projectRoot);

    // State
    this.currentStep = null;
    this.results = { steps: {} };
    this.startTime = null;
  }

  /**
   * Register all 20 workflow steps
   */
  registerAllSteps() {
    logger.info('Registering workflow steps...');

    const steps = [
      {
        id: 'step_00',
        name: 'Pre-Analysis',
        description: 'Analyze git state and project context',
        class: Step0Analyzer,
        dependencies: [],
      },
      {
        id: 'step_0b',
        name: 'Bootstrap Documentation',
        description: 'Generate initial documentation',
        class: Step0bBootstrapDocs,
        dependencies: ['step_00'],
      },
      {
        id: 'step_01',
        name: 'Documentation Updates',
        description: 'Validate and update documentation',
        class: Step1DocumentationAnalyzer,
        dependencies: ['step_00'],
      },
      {
        id: 'step_02',
        name: 'Consistency Analysis',
        description: 'Check code and documentation consistency',
        class: Step2ConsistencyAnalyzer,
        dependencies: ['step_01'],
      },
      {
        id: 'step_02_5',
        name: 'Documentation Optimization',
        description: 'Optimize documentation size and quality',
        class: DocumentationOptimizer,
        dependencies: ['step_02'],
      },
      {
        id: 'step_03',
        name: 'Script References',
        description: 'Validate script references',
        class: Step3ScriptAnalyzer,
        dependencies: ['step_02'],
      },
      {
        id: 'step_04',
        name: 'Configuration Validation',
        description: 'Validate project configuration',
        class: Step4ConfigAnalyzer,
        dependencies: ['step_00'],
      },
      {
        id: 'step_05',
        name: 'Directory Structure',
        description: 'Validate directory structure',
        class: Step5DirectoryAnalyzer,
        dependencies: ['step_04'],
      },
      {
        id: 'step_06',
        name: 'Test Review',
        description: 'Review existing tests',
        class: Step6TestReviewer,
        dependencies: ['step_05'],
      },
      {
        id: 'step_07',
        name: 'Test Generation',
        description: 'Generate new tests',
        class: Step7TestGenerator,
        dependencies: ['step_06'],
      },
      {
        id: 'step_08',
        name: 'Test Execution',
        description: 'Execute test suite',
        class: Step8TestExecutor,
        dependencies: ['step_07'],
      },
      {
        id: 'step_09',
        name: 'Dependency Analysis',
        description: 'Analyze and validate dependencies',
        class: Step9DependencyValidator,
        dependencies: ['step_08'],
      },
      {
        id: 'step_10',
        name: 'Code Quality',
        description: 'Analyze code quality',
        class: Step10CodeQualityAnalyzer,
        dependencies: ['step_09'],
      },
      {
        id: 'step_11',
        name: 'Context Management',
        description: 'Manage workflow context',
        class: Step11ContextAnalyzer,
        dependencies: ['step_10'],
      },
      {
        id: 'step_12',
        name: 'Git Finalization',
        description: 'Finalize git operations',
        class: Step12GitFinalization,
        dependencies: ['step_11'],
        critical: false,
      },
      {
        id: 'step_13',
        name: 'Markdown Linting',
        description: 'Lint markdown files',
        class: Step13MarkdownLint,
        dependencies: ['step_12'],
      },
      {
        id: 'step_14',
        name: 'Prompt Engineering',
        description: 'Analyze and optimize AI prompts',
        class: Step14PromptEngineer,
        dependencies: ['step_13'],
      },
      {
        id: 'step_15',
        name: 'UX Analysis',
        description: 'Analyze UX and accessibility',
        class: Step15UxAnalysis,
        dependencies: ['step_14'],
      },
      {
        id: 'step_16',
        name: 'Version Update',
        description: 'Update semantic versions',
        class: Step16VersionUpdate,
        dependencies: ['step_15'],
      },
      {
        id: 'step_17',
        name: 'Workflow Summary',
        description: 'Generate workflow summary report',
        class: WorkflowSummary,
        dependencies: ['step_16'],
      },
    ];

    for (const step of steps) {
      this.stepRegistry.register(step.id, {
        name: step.name,
        description: step.description,
        handler: step.class,
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
      workflowDirWritable: true, // TODO: Add actual check
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

      // Open log file for this run so all logger output is persisted
      const logsRunDir = path.join(
        this.projectRoot,
        '.ai_workflow',
        'logs',
        this.configManager.workflowRunId
      );
      logger.setLogFile(path.join(logsRunDir, 'workflow.log'));
      this.logsRunDir = logsRunDir;

      logger.info(`${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
      logger.info(`${colors.blue}  AI Workflow Automation - Starting${colors.reset}`);
      logger.info(`${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
      logger.info(`Stage: ${this.stage}`);
      logger.info(`Mode: ${this.auto ? 'auto' : 'interactive'}`);

      // Health checks
      const healthResults = await this.healthCheck();
      if (!healthResults.passed) {
        throw new Error('Health checks failed - cannot proceed');
      }

      // Register all steps
      this.registerAllSteps();

      // Determine steps to execute
      const stepsToExecute = getStepsForStage(this.stage);
      logger.info(`Executing ${stepsToExecute.length} steps for stage: ${this.stage}`);

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
      };

      // Setup event listeners for progress tracking
      const stepsLogDir = path.join(logsRunDir, 'steps');
      this.workflowEngine.on('step:start', ({ step }) => {
        this.currentStep = step.id;
        logger.openStepLogFile(path.join(stepsLogDir, `${step.id}.log`));
        logger.info(`\n${colors.cyan}→ Starting: ${step.name}${colors.reset}`);
      });

      this.workflowEngine.on('step:complete', ({ step, result }) => {
        const durationStr = result.duration ? `(${Math.round(result.duration / 1000)}s)` : '';
        logger.info(`${colors.green}✓ Completed: ${step.name}${colors.reset} ${durationStr}`);
        logger.closeStepLogFile();
      });

      this.workflowEngine.on('step:error', ({ step, error }) => {
        logger.error(`${colors.red}✗ Failed: ${step.name} - ${error.message}${colors.reset}`);
        logger.closeStepLogFile();
      });

      this.workflowEngine.on('step:skipped', ({ step, result }) => {
        logger.openStepLogFile(path.join(stepsLogDir, `${step.id}.log`));
        logger.info(`${colors.yellow}⊘ Skipped: ${step.name} - ${result.reason}${colors.reset}`);
        logger.closeStepLogFile();
      });

      // Load and execute workflow
      await this.workflowEngine.loadWorkflow(workflow);
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

      logger.closeLogFile();

      return {
        success: engineResult.success,
        workflow,
        results: this.results,
        summary,
        duration,
      };
    } catch (error) {
      logger.error(`${colors.red}✗ Workflow failed: ${error.message}${colors.reset}`);
      logger.closeLogFile();

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
        const ExecutorClass = stepDef.handler;
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
          logger, // ensure steps using options.logger write to the run log file
          enableParallel: !this.noParallel,
          sdkSmokeTest: this.sdkSmokeTest,
          promptsDir: this.logsRunDir ? path.join(this.logsRunDir, 'prompts', stepId) : null,
        };

        // Create executor instance with dependencies
        const executor = new ExecutorClass(commonDeps);

        // Execute step
        if (typeof executor.execute !== 'function') {
          throw new Error(`Executor for ${stepId} does not have an execute method`);
        }

        // Ensure projectRoot is always defined (fallback to this.projectRoot)
        const projectRoot = context.projectRoot || this.projectRoot || process.cwd();

        // Dispatch by step kind:
        //   ProjectStep → execute(projectRoot: string)
        //   ContextStep → execute(context: { projectRoot, ... })
        const kind = ExecutorClass.stepKind ?? STEP_KIND.PROJECT;
        const result =
          kind === STEP_KIND.CONTEXT
            ? await executor.execute({ projectRoot, ...context })
            : await executor.execute(projectRoot);

        return result;
      } catch (error) {
        logger.error(`Error executing step ${stepId}: ${error.message}`);
        throw error;
      }
    };
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
      await this.checkpointManager.save(workflow.id, {
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
