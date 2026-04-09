/**
 * @fileoverview Tests for Main Workflow Orchestrator (v2.0.0)
 * @version 2.0.0
 */

import {
  validateOrchestratorConfig,
  getStepsForStage,
  calculateProgress,
  determineWorkflowStatus,
  performHealthChecks,
  MainOrchestrator,
  WORKFLOW_STAGES,
  HEALTH_CHECK_CATEGORIES,
} from '../../src/orchestrator/main_orchestrator.js';

import fs from 'fs/promises';
import path from 'path';

// ============================================================================
// PURE FUNCTION TESTS
// ============================================================================

describe('Main Orchestrator - Pure Functions', () => {
  describe('validateOrchestratorConfig', () => {
    test('should validate valid configuration', () => {
      const config = {
        workflowDir: '.ai_workflow',
        stage: 'full',
        auto: true,
      };

      const result = validateOrchestratorConfig(config);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    test('should reject non-object config', () => {
      const result = validateOrchestratorConfig(null);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Config must be an object');
    });

    test('should reject invalid stage', () => {
      const config = {
        stage: 'invalid',
      };

      const result = validateOrchestratorConfig(config);

      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('Invalid stage');
    });

    test('should reject non-string workflowDir', () => {
      const config = {
        workflowDir: 123,
      };

      const result = validateOrchestratorConfig(config);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('workflowDir must be a string');
    });

    test('should reject non-boolean auto', () => {
      const config = {
        auto: 'yes',
      };

      const result = validateOrchestratorConfig(config);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('auto must be a boolean');
    });

    test('should reject non-string resumeFromCheckpoint', () => {
      const config = {
        resumeFromCheckpoint: 123,
      };

      const result = validateOrchestratorConfig(config);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('resumeFromCheckpoint must be a string (checkpoint ID)');
    });
  });

  describe('getStepsForStage', () => {
    test('should return quick validation steps', () => {
      const steps = getStepsForStage(WORKFLOW_STAGES.QUICK);

      expect(steps).toHaveLength(5);
      expect(steps).toContain('step_00');
      expect(steps).toContain('step_01');
      expect(steps).toContain('step_02');
      expect(steps).toContain('step_04');
      expect(steps).toContain('step_05');
    });

    test('should return medium validation steps', () => {
      const steps = getStepsForStage(WORKFLOW_STAGES.MEDIUM);

      expect(steps).toHaveLength(13);
      expect(steps).toContain('step_08'); // Test execution
      expect(steps).toContain('step_10'); // Code quality
      expect(steps).toContain('step_21'); // Doc consolidation
    });

    test('should return full workflow steps', () => {
      const steps = getStepsForStage(WORKFLOW_STAGES.FULL);

      expect(steps).toHaveLength(29); // All 29 steps
      expect(steps).toContain('step_00');
      expect(steps).toContain('step_0b');
      expect(steps).toContain('step_0f');
      expect(steps).toContain('step_17'); // Summary
      expect(steps).toContain('step_21'); // Doc consolidation
    });

    test('should default to full workflow for invalid stage', () => {
      const steps = getStepsForStage('invalid');

      expect(steps).toHaveLength(29);
    });
  });

  describe('calculateProgress', () => {
    test('should handle zero total', () => {
      expect(calculateProgress(0, 0)).toBe(0);
      expect(calculateProgress(5, 0)).toBe(0);
    });

    test('should round to nearest integer', () => {
      expect(calculateProgress(1, 3)).toBe(33);
      expect(calculateProgress(2, 3)).toBe(67);
    });
  });

  describe('determineWorkflowStatus', () => {
    test('should return success for all passed steps', () => {
      const results = {
        steps: {
          step1: { status: 'success' },
          step2: { status: 'success' },
        },
      };

      expect(determineWorkflowStatus(results)).toBe('success');
    });

    test('should return failed if any step failed', () => {
      const results = {
        steps: {
          step1: { status: 'success' },
          step2: { status: 'failed' },
        },
      };

      expect(determineWorkflowStatus(results)).toBe('failed');
    });

    test('should return partial if some steps skipped', () => {
      const results = {
        steps: {
          step1: { status: 'success' },
          step2: { status: 'skipped' },
        },
      };

      expect(determineWorkflowStatus(results)).toBe('partial');
    });

    test('should return skipped if all steps skipped', () => {
      const results = {
        steps: {
          step1: { status: 'skipped' },
          step2: { status: 'skipped' },
        },
      };

      expect(determineWorkflowStatus(results)).toBe('skipped');
    });

    test('should return unknown for invalid results', () => {
      expect(determineWorkflowStatus(null)).toBe('unknown');
      expect(determineWorkflowStatus({})).toBe('unknown');
    });
  });

  describe('performHealthChecks', () => {
    test('should pass all checks with valid environment', () => {
      const environment = {
        nodeVersion: 'v18.0.0',
        platform: 'linux',
        config: {},
        workflowDir: '.ai_workflow',
        workflowDirWritable: true,
      };

      const results = performHealthChecks(environment);

      expect(results.passed).toBe(true);
      expect(results.checks[HEALTH_CHECK_CATEGORIES.ENVIRONMENT].passed).toBe(true);
      expect(results.checks[HEALTH_CHECK_CATEGORIES.CONFIGURATION].passed).toBe(true);
      expect(results.checks[HEALTH_CHECK_CATEGORIES.FILESYSTEM].passed).toBe(true);
    });

    test('should fail environment check without node version', () => {
      const environment = {
        platform: 'linux',
        config: {},
        workflowDir: '.ai_workflow',
        workflowDirWritable: true,
      };

      const results = performHealthChecks(environment);

      expect(results.passed).toBe(false);
      expect(results.checks[HEALTH_CHECK_CATEGORIES.ENVIRONMENT].passed).toBe(false);
    });

    test('should fail configuration check without config', () => {
      const environment = {
        nodeVersion: 'v18.0.0',
        platform: 'linux',
        workflowDirWritable: true,
      };

      const results = performHealthChecks(environment);

      expect(results.passed).toBe(false);
      expect(results.checks[HEALTH_CHECK_CATEGORIES.CONFIGURATION].passed).toBe(false);
    });

    test('should fail filesystem check if not writable', () => {
      const environment = {
        nodeVersion: 'v18.0.0',
        platform: 'linux',
        config: {},
        workflowDir: '.ai_workflow',
        workflowDirWritable: false,
      };

      const results = performHealthChecks(environment);

      expect(results.passed).toBe(false);
      expect(results.checks[HEALTH_CHECK_CATEGORIES.FILESYSTEM].passed).toBe(false);
    });
  });

  describe('Constants', () => {
    test('WORKFLOW_STAGES should be frozen', () => {
      expect(Object.isFrozen(WORKFLOW_STAGES)).toBe(true);
    });

    test('HEALTH_CHECK_CATEGORIES should be frozen', () => {
      expect(Object.isFrozen(HEALTH_CHECK_CATEGORIES)).toBe(true);
    });

    test('WORKFLOW_STAGES should have correct values', () => {
      expect(WORKFLOW_STAGES.QUICK).toBe('quick');
      expect(WORKFLOW_STAGES.MEDIUM).toBe('medium');
      expect(WORKFLOW_STAGES.FULL).toBe('full');
    });
  });
});

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

describe('Main Orchestrator - Integration Tests', () => {
  let orchestrator;
  const testDir = path.join(process.cwd(), '.test_orchestrator');

  beforeEach(async () => {
    // Create test directory
    await fs.mkdir(path.join(testDir, 'metrics'), { recursive: true });
    await fs.mkdir(path.join(testDir, 'summaries'), { recursive: true });
    await fs.mkdir(path.join(testDir, 'checkpoints'), { recursive: true });
  });

  afterEach(async () => {
    // Clean up test directory
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('MainOrchestrator Construction', () => {
    test('should create orchestrator with default options', () => {
      orchestrator = new MainOrchestrator();

      expect(orchestrator.workflowDir).toBe(path.join(process.cwd(), '.ai_workflow'));
      expect(orchestrator.stage).toBe(WORKFLOW_STAGES.FULL);
      expect(orchestrator.auto).toBe(false);
    });

    test('should create orchestrator with custom options', () => {
      orchestrator = new MainOrchestrator({
        workflowDir: testDir,
        stage: WORKFLOW_STAGES.QUICK,
        auto: true,
      });

      expect(orchestrator.workflowDir).toBe(testDir);
      expect(orchestrator.stage).toBe(WORKFLOW_STAGES.QUICK);
      expect(orchestrator.auto).toBe(true);
    });

    test('should throw error for invalid config', () => {
      expect(() => {
        new MainOrchestrator({ stage: 'invalid' });
      }).toThrow('Invalid configuration');
    });

    test('should initialize all components', () => {
      orchestrator = new MainOrchestrator({ workflowDir: testDir });

      expect(orchestrator.configManager).toBeDefined();
      expect(orchestrator.metricsCollector).toBeDefined();
      expect(orchestrator.checkpointManager).toBeDefined();
      expect(orchestrator.stepRegistry).toBeDefined();
      expect(orchestrator.workflowEngine).toBeDefined();
      expect(orchestrator.summaryGenerator).toBeDefined();
    });
  });

  describe('Step Registration', () => {
    beforeEach(() => {
      orchestrator = new MainOrchestrator({ workflowDir: testDir });
    });

    test('should register all 29 workflow steps', () => {
      orchestrator.registerAllSteps();

      const stepCount = orchestrator.stepRegistry.list().length;
      expect(stepCount).toBe(29);
    });

    test('should register steps with correct metadata', () => {
      orchestrator.registerAllSteps();

      const step0 = orchestrator.stepRegistry.get('step_00');
      expect(step0.name).toBe('Pre-Analysis');
      expect(step0.dependencies).toEqual([]);

      const step1 = orchestrator.stepRegistry.get('step_01');
      expect(step1.name).toBe('Documentation Updates');
      expect(step1.dependencies).toContain('step_00');
    });
  });

  describe('Health Checks', () => {
    beforeEach(() => {
      orchestrator = new MainOrchestrator({ workflowDir: testDir });
    });

    test('should perform health checks successfully', async () => {
      const results = await orchestrator.healthCheck();

      expect(results.passed).toBe(true);
      expect(results.checks).toBeDefined();
    });
  });

  describe('Status Tracking', () => {
    beforeEach(() => {
      orchestrator = new MainOrchestrator({
        workflowDir: testDir,
        stage: WORKFLOW_STAGES.QUICK,
      });
    });

    test('should track workflow status', () => {
      const status = orchestrator.getStatus();

      expect(status).toHaveProperty('currentStep');
      expect(status).toHaveProperty('completed');
      expect(status).toHaveProperty('total');
      expect(status).toHaveProperty('progress');
      expect(status).toHaveProperty('status');
      expect(status).toHaveProperty('duration');
    });

    test('should calculate progress correctly', () => {
      orchestrator.results.steps = {
        step_00: { status: 'success' },
        step_01: { status: 'success' },
      };

      const status = orchestrator.getStatus();

      expect(status.completed).toBe(2);
      expect(status.total).toBe(5); // Quick stage has 5 steps
      expect(status.progress).toBe(40);
    });
  });

  describe('Workflow Execution', () => {
    beforeEach(() => {
      orchestrator = new MainOrchestrator({
        workflowDir: testDir,
        stage: WORKFLOW_STAGES.QUICK, // Use quick stage for faster tests
      });

      // Mock the summary generator
      orchestrator.summaryGenerator.generateSummary = async () => ({
        success: true,
        summary: 'Test summary',
      });

      // Mock checkpoint save
      orchestrator.checkpointManager.save = async () => true;

      // Mock the WorkflowEngine methods with manual mocks
      const mockLoadWorkflow = async () => ({
        id: 'test-workflow',
        name: 'Test Workflow',
        version: '2.0.0',
      });

      const mockExecuteWorkflow = async () => ({
        success: true,
        summary: {
          total: 5,
          succeeded: 5,
          failed: 0,
          skipped: 0,
        },
        results: [
          { stepId: 'step_00', stepName: 'Project Analysis', success: true, duration: 100 },
          { stepId: 'step_01', stepName: 'Documentation Updates', success: true, duration: 200 },
          { stepId: 'step_02', stepName: 'Consistency Check', success: true, duration: 150 },
          { stepId: 'step_04', stepName: 'Config Validation', success: true, duration: 50 },
          { stepId: 'step_0b', stepName: 'Bootstrap Docs', success: true, duration: 75 },
        ],
        duration: 575,
      });

      orchestrator.workflowEngine.loadWorkflow = mockLoadWorkflow;
      orchestrator.workflowEngine.executeWorkflow = mockExecuteWorkflow;
    });

    test('should execute workflow successfully', async () => {
      const result = await orchestrator.execute();

      expect(result.success).toBe(true);
      expect(result).toHaveProperty('workflow');
      expect(result).toHaveProperty('results');
      expect(result).toHaveProperty('duration');
      expect(result.results.status).toBe('success');
    });

    test('should handle workflow failure', async () => {
      orchestrator.workflowEngine.executeWorkflow = async () => ({
        success: false,
        summary: {
          total: 5,
          succeeded: 3,
          failed: 2,
          skipped: 0,
        },
        results: [
          { stepId: 'step_00', stepName: 'Project Analysis', success: true, duration: 100 },
          {
            stepId: 'step_01',
            stepName: 'Documentation Updates',
            success: false,
            duration: 200,
            error: { message: 'Test error' },
          },
          { stepId: 'step_02', stepName: 'Consistency Check', success: true, duration: 150 },
        ],
        duration: 450,
      });

      const result = await orchestrator.execute();

      expect(result.success).toBe(false);
      expect(result.results.status).toBe('failed');
      expect(result.results.summary.failed).toBe(2);
    });
  });

  describe('Workflow Resume', () => {
    beforeEach(() => {
      orchestrator = new MainOrchestrator({
        workflowDir: testDir,
        stage: WORKFLOW_STAGES.QUICK,
      });

      // Mock checkpoint manager with proper checkpoint structure
      orchestrator.checkpointManager.load = async (checkpointId) => {
        if (checkpointId === 'missing-checkpoint') {
          return null;
        }
        // Default: partial completion (2 of 5 steps done)
        return {
          version: '1.0.0',
          workflowId: 'test-workflow',
          workflowVersion: '2.0.0',
          timestamp: Date.now(),
          state: {
            currentStep: null,
            completedSteps: ['step_00', 'step_01'],
            failedSteps: [],
            skippedSteps: [],
            results: {
              step_00: { status: 'success', duration: 100 },
              step_01: { status: 'success', duration: 200 },
            },
            context: {},
          },
          metadata: {
            totalSteps: 5,
            progress: 40,
          },
        };
      };

      orchestrator.checkpointManager.save = async () => true;

      // Default workflow engine mocks
      orchestrator.workflowEngine.loadWorkflow = async () => ({
        id: 'test-workflow',
        name: 'Test Workflow (Resumed)',
        version: '2.0.0',
      });

      orchestrator.workflowEngine.executeWorkflow = async () => ({
        success: true,
        summary: {
          total: 3,
          succeeded: 3,
          failed: 0,
          skipped: 0,
        },
        results: [
          { stepId: 'step_02', stepName: 'Consistency Check', success: true, duration: 150 },
          { stepId: 'step_04', stepName: 'Config Validation', success: true, duration: 50 },
          { stepId: 'step_0b', stepName: 'Bootstrap Docs', success: true, duration: 75 },
        ],
        duration: 275,
      });
    });

    test('should resume workflow from checkpoint', async () => {
      const result = await orchestrator.resume('test-checkpoint');

      expect(result.success).toBe(true);
      expect(result.resumed).toBe(true);
      expect(result).toHaveProperty('workflow');
      expect(result).toHaveProperty('results');
    });

    test('should handle missing checkpoint', async () => {
      const result = await orchestrator.resume('missing-checkpoint');

      expect(result.success).toBe(false);
      expect(result.resumed).toBe(false);
      expect(result.error).toContain('Checkpoint not found');
    });

    test('should skip execution if all steps completed', async () => {
      const completeOrchestrator = new MainOrchestrator({
        workflowDir: testDir,
        stage: WORKFLOW_STAGES.QUICK,
      });

      // Pre-set the results to simulate all steps complete
      completeOrchestrator.results = {
        steps: {
          step_00: { status: 'success', duration: 100 },
          step_01: { status: 'success', duration: 200 },
          step_02: { status: 'success', duration: 150 },
          step_04: { status: 'success', duration: 50 },
          step_0b: { status: 'success', duration: 75 },
        },
      };

      // Mock checkpoint load to return a valid structure
      completeOrchestrator.checkpointManager.load = async () => ({
        version: '1.0.0',
        workflowId: 'test-workflow',
        workflowVersion: '2.0.0',
        timestamp: Date.now(),
        state: {
          currentStep: null,
          completedSteps: ['step_00', 'step_01', 'step_02', 'step_04', 'step_05'],
          failedSteps: [],
          skippedSteps: [],
          results: completeOrchestrator.results.steps,
          context: {},
        },
        metadata: {
          totalSteps: 5,
          progress: 100,
        },
      });

      // Track if step registration happens
      let registrationHappened = false;
      const originalRegister = completeOrchestrator.registerAllSteps.bind(completeOrchestrator);
      completeOrchestrator.registerAllSteps = function () {
        registrationHappened = true;
        return originalRegister();
      };

      const result = await completeOrchestrator.resume('complete-checkpoint');

      // Should return success
      expect(result.success).toBe(true);
      expect(result.resumed).toBe(true);

      // Step registration should not happen since all steps complete
      expect(registrationHappened).toBe(false);
    });
  });

  describe('Error Handling and Event Listeners', () => {
    let orchestrator;
    const testDir = '.ai_workflow/test-orchestrator-errors';

    beforeEach(async () => {
      // Clean up test directory
      await fs.rm(testDir, { recursive: true, force: true });
      await fs.mkdir(testDir, { recursive: true });

      orchestrator = new MainOrchestrator({
        workflowDir: testDir,
        stage: 'quick',
        auto: true,
      });
    });

    afterEach(async () => {
      await fs.rm(testDir, { recursive: true, force: true });
    });

    test('should handle health check failures', async () => {
      // The healthCheck method collects its own environment,
      // so we can't easily make it fail. Instead, test the pure function directly.
      const invalidEnv = {}; // Missing all required fields

      const result = performHealthChecks(invalidEnv);

      // Health check should fail due to missing environment info
      expect(result.passed).toBe(false);
      expect(result.checks).toHaveProperty('environment');
      expect(result.checks.environment.passed).toBe(false);
    });

    test('should emit step:start event', (done) => {
      let eventEmitted = false;

      orchestrator.workflowEngine.on('step:start', ({ step }) => {
        eventEmitted = true;
        expect(step).toHaveProperty('id');
        expect(step).toHaveProperty('name');
        done();
      });

      // Manually trigger event to test listener
      orchestrator.workflowEngine.emit('step:start', {
        step: { id: 'test-step', name: 'Test Step' },
      });

      // Safety timeout
      setTimeout(() => {
        if (!eventEmitted) {
          done(new Error('Event not emitted'));
        }
      }, 100);
    });

    test('should emit step:complete event with duration', (done) => {
      let eventEmitted = false;

      orchestrator.workflowEngine.on('step:complete', ({ step, result }) => {
        eventEmitted = true;
        expect(step).toHaveProperty('name');
        expect(result).toHaveProperty('duration');
        done();
      });

      orchestrator.workflowEngine.emit('step:complete', {
        step: { id: 'test-step', name: 'Test Step' },
        result: { success: true, duration: 1500 },
      });

      setTimeout(() => {
        if (!eventEmitted) {
          done(new Error('Event not emitted'));
        }
      }, 100);
    });

    test('should emit step:error event', (done) => {
      let eventEmitted = false;

      orchestrator.workflowEngine.on('step:error', ({ step, error }) => {
        eventEmitted = true;
        expect(step).toHaveProperty('name');
        expect(error).toHaveProperty('message');
        done();
      });

      orchestrator.workflowEngine.emit('step:error', {
        step: { id: 'test-step', name: 'Test Step' },
        error: new Error('Test error'),
      });

      setTimeout(() => {
        if (!eventEmitted) {
          done(new Error('Event not emitted'));
        }
      }, 100);
    });

    test('should emit step:skipped event', (done) => {
      let eventEmitted = false;

      orchestrator.workflowEngine.on('step:skipped', ({ step, result }) => {
        eventEmitted = true;
        expect(step).toHaveProperty('name');
        expect(result).toHaveProperty('reason');
        done();
      });

      orchestrator.workflowEngine.emit('step:skipped', {
        step: { id: 'test-step', name: 'Test Step' },
        result: { skipped: true, reason: 'No changes detected' },
      });

      setTimeout(() => {
        if (!eventEmitted) {
          done(new Error('Event not emitted'));
        }
      }, 100);
    });

    test('should handle error in _createStepHandler when executor missing', async () => {
      const stepHandler = orchestrator._createStepHandler('test-step', {});

      await expect(stepHandler({})).rejects.toThrow('No executor class found');
    });

    test('should handle error when executor lacks execute method', async () => {
      class InvalidExecutor {}

      const stepHandler = orchestrator._createStepHandler('test-step', {
        handler: InvalidExecutor,
      });

      await expect(stepHandler({})).rejects.toThrow('does not have an execute method');
    });
  });

  describe('Health Check Edge Cases', () => {
    test('should show warnings for failed health checks', async () => {
      // Create environment with missing config
      const env = {
        nodeVersion: process.version,
        cwd: process.cwd(),
        // Missing config field
      };

      const result = performHealthChecks(env);

      // Should show warnings for failed checks
      expect(result.passed).toBe(false);
      expect(result.checks.configuration.passed).toBe(false);
    });
  });

  // ============================================================================
  // REGRESSION TESTS - Bug Fixes from 2026-02-17
  // ============================================================================

  describe('Regression Tests - Step Registration and Execution', () => {
    let orchestrator;
    const testDir = '.ai_workflow/test-regression';

    beforeEach(async () => {
      await fs.rm(testDir, { recursive: true, force: true });
      await fs.mkdir(testDir, { recursive: true });

      orchestrator = new MainOrchestrator({
        workflowDir: testDir,
        stage: WORKFLOW_STAGES.QUICK,
        auto: true,
      });
    });

    afterEach(async () => {
      await fs.rm(testDir, { recursive: true, force: true });
    });

    describe('Bug Fix: Executor field name mismatch', () => {
      test('should register steps with "handler" field, not "executor"', () => {
        // Register all steps
        orchestrator.registerAllSteps();

        // Check that step_00 is registered
        const step = orchestrator.stepRegistry.get('step_00');

        expect(step).toBeDefined();
        expect(step).toHaveProperty('handler');
        expect(step.handler).toBeDefined();

        // The old bug: stepDef.executor was undefined
        // This should NOT exist in the step definition
        expect(step.executor).toBeUndefined();
      });

      test('should create step handler that accesses handler field correctly', async () => {
        // Mock executor class
        class MockStepExecutor {
          async execute(_context) {
            return { success: true, data: 'test' };
          }
        }

        // Register step with handler (correct field name)
        orchestrator.stepRegistry.register('test_mock_step', {
          name: 'Mock Test Step',
          description: 'Test step for regression',
          handler: MockStepExecutor,
          dependencies: [],
        });

        const stepDef = orchestrator.stepRegistry.get('test_mock_step');

        // Create handler using the private method
        const handler = orchestrator._createStepHandler('test_mock_step', stepDef);

        // Execute the handler
        const result = await handler({ workflowDir: testDir });

        expect(result).toEqual({ success: true, data: 'test' });
      });

      test('should throw error when handler field is missing (old bug scenario)', async () => {
        // Simulate the old bug: step registered with wrong field name
        orchestrator.stepRegistry.register('test_broken_step', {
          name: 'Broken Step',
          description: 'Step with wrong field name',
          // Missing 'handler' field - this was the bug
          dependencies: [],
        });

        const stepDef = orchestrator.stepRegistry.get('test_broken_step');
        const handler = orchestrator._createStepHandler('test_broken_step', stepDef);

        // Should throw error about missing executor
        await expect(handler({})).rejects.toThrow(
          'No executor class found for step: test_broken_step'
        );
      });

      test('should register all 24 workflow steps with handler field', () => {
        orchestrator.registerAllSteps();

        const expectedSteps = [
          'step_00',
          'step_0b',
          'step_01',
          'step_02',
          'step_02_5',
          'step_03',
          'step_04',
          'step_05',
          'step_06',
          'step_07',
          'step_08',
          'step_09',
          'step_10',
          'step_11',
          'step_12',
          'step_0f',
          'step_13',
          'step_14',
          'step_15',
          'step_16',
          'step_17',
          'step_20',
          'step_22',
          'step_23',
        ];

        for (const stepId of expectedSteps) {
          const step = orchestrator.stepRegistry.get(stepId);

          expect(step).toBeDefined();
          expect(step).toHaveProperty('handler');
          expect(typeof step.handler).toBe('function');

          // Verify the old bug is fixed: no 'executor' field
          expect(step.executor).toBeUndefined();
        }
      });
    });

    describe('Bug Fix: Checkpoint save with wrong parameters', () => {
      test('should call checkpoint.save with workflow object, not workflow.id string', async () => {
        // Mock the checkpoint manager save method
        let savedWorkflowParam = null;
        let savedStateParam = null;

        orchestrator.checkpointManager.save = async (workflow, state) => {
          savedWorkflowParam = workflow;
          savedStateParam = state;
          return 'checkpoint-id-123';
        };

        // Mock workflow engine
        orchestrator.workflowEngine.loadWorkflow = async (workflow) => workflow;
        orchestrator.workflowEngine.executeWorkflow = async () => ({
          success: true,
          summary: { total: 1, succeeded: 1, failed: 0, skipped: 0 },
          results: [{ stepId: 'step_00', stepName: 'Pre-Analysis', success: true, duration: 100 }],
        });

        // Mock summary generator
        orchestrator.summaryGenerator.generateSummary = async () => 'Test summary';

        // Execute workflow
        await orchestrator.execute();

        // Verify checkpoint save was called with correct parameters
        expect(savedWorkflowParam).toBeDefined();
        expect(savedWorkflowParam).toBeInstanceOf(Object);

        // The old bug: workflow.id was passed as string
        // Now it should be the full workflow object with id, name, version, steps
        expect(savedWorkflowParam).toHaveProperty('id');
        expect(savedWorkflowParam).toHaveProperty('name');
        expect(savedWorkflowParam).toHaveProperty('version');
        expect(savedWorkflowParam).toHaveProperty('steps');
        expect(Array.isArray(savedWorkflowParam.steps)).toBe(true);

        // Verify state parameter structure
        expect(savedStateParam).toBeDefined();
        expect(savedStateParam).toHaveProperty('timestamp');
        expect(savedStateParam).toHaveProperty('completedSteps');
        expect(savedStateParam).toHaveProperty('failedSteps');
        expect(savedStateParam).toHaveProperty('skippedSteps');
        expect(Array.isArray(savedStateParam.completedSteps)).toBe(true);
      });

      test('should pass correct state structure to checkpoint save', async () => {
        let capturedState = null;

        orchestrator.checkpointManager.save = async (workflow, state) => {
          capturedState = state;
          return 'checkpoint-id';
        };

        orchestrator.workflowEngine.loadWorkflow = async (workflow) => workflow;
        orchestrator.workflowEngine.executeWorkflow = async () => ({
          success: true,
          summary: { total: 2, succeeded: 1, failed: 1, skipped: 0 },
          results: [
            { stepId: 'step_00', stepName: 'Pre-Analysis', status: 'success', duration: 100 },
            { stepId: 'step_01', stepName: 'Documentation', status: 'failed', duration: 50 },
          ],
        });

        orchestrator.summaryGenerator.generateSummary = async () => 'Summary';

        await orchestrator.execute();

        // Verify state structure matches createCheckpointData expectations
        expect(capturedState).toHaveProperty('timestamp');
        expect(typeof capturedState.timestamp).toBe('number');

        expect(capturedState).toHaveProperty('completedSteps');
        expect(Array.isArray(capturedState.completedSteps)).toBe(true);

        expect(capturedState).toHaveProperty('failedSteps');
        expect(Array.isArray(capturedState.failedSteps)).toBe(true);

        expect(capturedState).toHaveProperty('skippedSteps');
        expect(Array.isArray(capturedState.skippedSteps)).toBe(true);

        // The old bug: state had wrong structure with results object instead of step arrays
        // Now completedSteps should contain actual step IDs
        expect(capturedState.completedSteps).toContain('step_00');
        expect(capturedState.failedSteps).toContain('step_01');
      });

      test('should create valid checkpoint data that passes validation', async () => {
        let checkpointData = null;

        // Capture the checkpoint data before validation
        orchestrator.checkpointManager.save = async (workflow, state) => {
          // Manually create checkpoint data like the save method does
          const checkpoint = {
            version: '1.0.0',
            workflowId: workflow.id || workflow.name,
            workflowVersion: workflow.version || '1.0.0',
            timestamp: state.timestamp || Date.now(),
            state: {
              currentStep: state.currentStep || null,
              completedSteps: state.completedSteps || [],
              failedSteps: state.failedSteps || [],
              skippedSteps: state.skippedSteps || [],
              results: state.results || {},
              context: state.context || {},
            },
            metadata: {
              totalSteps: workflow.steps?.length || 0,
              progress: state.progress || 0,
            },
          };

          checkpointData = checkpoint;
          return 'checkpoint-id';
        };

        orchestrator.workflowEngine.loadWorkflow = async (w) => w;
        orchestrator.workflowEngine.executeWorkflow = async () => ({
          success: true,
          summary: { total: 1, succeeded: 1, failed: 0, skipped: 0 },
          results: [{ stepId: 'step_00', status: 'success' }],
        });
        orchestrator.summaryGenerator.generateSummary = async () => 'Summary';

        await orchestrator.execute();

        // Verify checkpoint data has all required fields
        expect(checkpointData).toBeDefined();
        expect(checkpointData).toHaveProperty('version');
        expect(checkpointData).toHaveProperty('workflowId');
        expect(checkpointData).toHaveProperty('timestamp');
        expect(checkpointData).toHaveProperty('state');

        // The old bug: workflowId was missing from checkpoint
        expect(checkpointData.workflowId).toBeDefined();
        expect(typeof checkpointData.workflowId).toBe('string');
        expect(checkpointData.workflowId.length).toBeGreaterThan(0);
      });
    });

    describe('Integration: Full workflow execution with regression fixes', () => {
      test('should pass logger in commonDeps so injected-logger steps write to the log file', async () => {
        // Steps like step_0b, step_12, step_13, step_14, step_15, step_16 use
        // `this.logger = options.logger || console/new Logger()`.  Without logger
        // in commonDeps those steps silently drop their output (console-only).
        const receivedDeps = {};

        class LoggerCapturingStep {
          constructor(deps) {
            Object.assign(receivedDeps, deps);
          }
          execute() {
            return Promise.resolve({ success: true });
          }
        }

        const stepDef = { handler: LoggerCapturingStep };
        const handler = orchestrator._createStepHandler('log_test_step', stepDef);
        await handler({ projectRoot: process.cwd() });

        // logger must be forwarded so injected-logger steps can write to the run log file
        expect(receivedDeps).toHaveProperty('logger');
        expect(typeof receivedDeps.logger.info).toBe('function');
        expect(typeof receivedDeps.logger.error).toBe('function');
        expect(typeof receivedDeps.logger.warn).toBe('function');
      });

      test('should execute workflow end-to-end with correct step registration and checkpointing', async () => {
        let stepHandlerCalled = false;
        let checkpointSaved = false;

        // Mock step executor
        class IntegrationTestExecutor {
          async execute(_context) {
            stepHandlerCalled = true;
            return { success: true };
          }
        }

        // Register a test step
        orchestrator.stepRegistry.register('integration_test_step', {
          name: 'Integration Test',
          description: 'Test step for integration',
          handler: IntegrationTestExecutor, // Correct field name
          dependencies: [],
        });

        // Mock checkpoint save
        orchestrator.checkpointManager.save = async (workflow, _state) => {
          checkpointSaved = true;

          // Verify workflow is object, not string
          expect(typeof workflow).toBe('object');
          expect(workflow).toHaveProperty('id');
          expect(workflow).toHaveProperty('steps');

          return 'integration-checkpoint';
        };

        // Setup workflow with our test step
        orchestrator.workflowEngine.loadWorkflow = async (workflow) => workflow;
        orchestrator.workflowEngine.executeWorkflow = async (context) => {
          // Execute the step handler
          const stepDef = orchestrator.stepRegistry.get('integration_test_step');
          const handler = orchestrator._createStepHandler('integration_test_step', stepDef);
          await handler(context);

          return {
            success: true,
            summary: { total: 1, succeeded: 1, failed: 0, skipped: 0 },
            results: [{ stepId: 'integration_test_step', status: 'success' }],
          };
        };

        orchestrator.summaryGenerator.generateSummary = async () => 'Summary';

        // Execute workflow
        const result = await orchestrator.execute();

        // Verify both fixes are working
        expect(stepHandlerCalled).toBe(true); // Step handler was called (fix #1)
        expect(checkpointSaved).toBe(true); // Checkpoint was saved (fix #2)
        expect(result.success).toBe(true);
      });
    });
  });

  // ============================================================================
  // REGRESSION TESTS — Bug Fixes 2026-02-26
  // CommitHistory: save HEAD at workflow START; skip artifact-only diffs
  // ============================================================================

  describe('Regression Tests - CommitHistory: start HEAD + artifact-only fallback', () => {
    const testDir = '.ai_workflow/test-commit-history-fix';

    /** Minimal git-ops mock with sensible defaults. Override per test as needed. */
    const makeGitMock = (overrides = {}) => ({
      getCurrentHead: () => 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      getChangedFilesSince: () => [],
      getLastNCommitsFiles: () => [],
      status: async () => ({ staged: [], unstaged: [], untracked: [] }),
      ...overrides,
    });

    /** Wire the workflow engine + downstream dependencies to no-ops. */
    const mockWorkflow = (orc, captureCtx = null) => {
      orc.workflowEngine.loadWorkflow = async (w) => w;
      orc.workflowEngine.executeWorkflow = async (ctx) => {
        if (captureCtx) captureCtx.value = ctx;
        return {
          success: true,
          summary: { total: 1, succeeded: 1, failed: 0, skipped: 0 },
          results: [{ stepId: 'step_00', stepName: 'Pre-Analysis', success: true, duration: 100 }],
        };
      };
      orc.summaryGenerator.generateSummary = async () => 'Summary';
      orc.checkpointManager.save = async () => 'cp-id';
    };

    let orchestrator;

    beforeEach(async () => {
      await fs.rm(testDir, { recursive: true, force: true });
      await fs.mkdir(testDir, { recursive: true });

      orchestrator = new MainOrchestrator({
        workflowDir: testDir,
        stage: WORKFLOW_STAGES.QUICK,
        auto: true,
      });
    });

    afterEach(async () => {
      await fs.rm(testDir, { recursive: true, force: true });
    });

    // ──────────────────────────────────────────────────────────────────────────
    // Bug 1 — HEAD saved is start-of-run, not post-commit HEAD
    // ──────────────────────────────────────────────────────────────────────────

    describe('Bug 1: HEAD captured at workflow start is persisted', () => {
      test('saves start-of-run HEAD, not post-commit HEAD, to commit_history.json', async () => {
        let callCount = 0;
        orchestrator.gitOps = makeGitMock({
          getCurrentHead: () => {
            callCount += 1;
            // First call = before steps run; second call = fallback at end (after commits)
            return callCount === 1
              ? 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
              : 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
          },
          getLastNCommitsFiles: () => [{ file: 'src/app.js', status: 'modified' }],
        });
        mockWorkflow(orchestrator);

        await orchestrator.execute();

        const history = JSON.parse(await fs.readFile(`${testDir}/commit_history.json`, 'utf8'));
        // Must record the FIRST call value (before any workflow commits)
        expect(history.lastRunCommit).toBe('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
      });

      test('uses start HEAD even if getCurrentHead would fail after commits', async () => {
        let callCount = 0;
        orchestrator.gitOps = makeGitMock({
          getCurrentHead: () => {
            callCount += 1;
            if (callCount === 1) return 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
            throw new Error('git unavailable after commits');
          },
          getLastNCommitsFiles: () => [{ file: 'src/app.js', status: 'modified' }],
        });
        mockWorkflow(orchestrator);

        await orchestrator.execute();

        const history = JSON.parse(await fs.readFile(`${testDir}/commit_history.json`, 'utf8'));
        expect(history.lastRunCommit).toBe('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
      });

      test('does not create commit_history.json when getCurrentHead always fails', async () => {
        orchestrator.gitOps = makeGitMock({
          getCurrentHead: () => {
            throw new Error('no git repo');
          },
          getLastNCommitsFiles: () => [],
        });
        mockWorkflow(orchestrator);

        await orchestrator.execute();

        const exists = await fs
          .access(`${testDir}/commit_history.json`)
          .then(() => true)
          .catch(() => false);
        expect(exists).toBe(false);
      });
    });

    // ──────────────────────────────────────────────────────────────────────────
    // Bug 2 — Artifact-only diffs fall back to last 30 commits
    // ──────────────────────────────────────────────────────────────────────────

    describe('Bug 2: Artifact-only diff falls back to last 30 commits', () => {
      const PRIOR_COMMIT = 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef';
      const ARTIFACT_ONLY = [
        { file: '.ai_workflow/backlog/workflow_001/step_00.md', status: 'deleted' },
        { file: '.ai_workflow/.ai_cache/index.json', status: 'modified' },
        { file: '.ai_workflow/commit_history.json', status: 'modified' },
      ];
      const SOURCE_FILES = [
        { file: 'src/core/colors.js', status: 'modified' },
        { file: 'src/lib/config.js', status: 'modified' },
      ];

      beforeEach(async () => {
        // Seed a commit_history.json so the diff path is taken (not first-run)
        await fs.writeFile(
          `${testDir}/commit_history.json`,
          JSON.stringify({ version: '1.0.0', lastRunCommit: PRIOR_COMMIT, runs: [] })
        );
      });

      test('falls back to last 30 commits when diff contains only artifact files', async () => {
        const ctx = {};
        orchestrator.gitOps = makeGitMock({
          getChangedFilesSince: () => ARTIFACT_ONLY,
          getLastNCommitsFiles: () => SOURCE_FILES,
        });
        mockWorkflow(orchestrator, ctx);

        await orchestrator.execute();

        expect(ctx.value.modifiedFiles).toContain('src/core/colors.js');
        expect(ctx.value.modifiedFiles).toContain('src/lib/config.js');
        expect(ctx.value.modifiedFiles).not.toContain('.ai_workflow/commit_history.json');
      });

      test('keeps source files and strips artifact files when diff is mixed', async () => {
        const ctx = {};
        orchestrator.gitOps = makeGitMock({
          getChangedFilesSince: () => [
            ...ARTIFACT_ONLY,
            { file: 'src/app.js', status: 'modified' },
          ],
          getLastNCommitsFiles: () => SOURCE_FILES,
        });
        mockWorkflow(orchestrator, ctx);

        await orchestrator.execute();

        expect(ctx.value.modifiedFiles).toContain('src/app.js');
        expect(ctx.value.modifiedFiles).not.toContain('.ai_workflow/commit_history.json');
      });

      test('falls back to last 30 commits when getChangedFilesSince throws', async () => {
        const ctx = {};
        orchestrator.gitOps = makeGitMock({
          getChangedFilesSince: () => {
            throw new Error('unknown revision');
          },
          getLastNCommitsFiles: () => SOURCE_FILES,
        });
        mockWorkflow(orchestrator, ctx);

        await orchestrator.execute();

        expect(ctx.value.modifiedFiles).toContain('src/core/colors.js');
      });

      test('uses last 30 commits and never calls getChangedFilesSince when no prior hash', async () => {
        // Override commit_history.json to have null lastRunCommit
        await fs.writeFile(
          `${testDir}/commit_history.json`,
          JSON.stringify({ version: '1.0.0', lastRunCommit: null, runs: [] })
        );
        const ctx = {};
        let diffCallCount = 0;
        orchestrator.gitOps = makeGitMock({
          getChangedFilesSince: () => {
            diffCallCount++;
            return [];
          },
          getLastNCommitsFiles: () => SOURCE_FILES,
        });
        mockWorkflow(orchestrator, ctx);

        await orchestrator.execute();

        expect(diffCallCount).toBe(0);
        expect(ctx.value.modifiedFiles).toContain('src/core/colors.js');
      });
    });

    // ──────────────────────────────────────────────────────────────────────────
    // Integration: Both fixes together across two consecutive runs
    // ──────────────────────────────────────────────────────────────────────────

    describe('Integration: consecutive runs — start HEAD + artifact-only fallback', () => {
      test('run 2 uses start-of-run hash from run 1 and falls back past artifact commit', async () => {
        const START_HASH = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
        const POST_ARTIFACT_HASH = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

        // ── Run 1 ──────────────────────────────────────────────────────────
        let run1Calls = 0;
        orchestrator.gitOps = makeGitMock({
          getCurrentHead: () => {
            run1Calls++;
            return run1Calls === 1 ? START_HASH : POST_ARTIFACT_HASH;
          },
          getLastNCommitsFiles: () => [{ file: 'src/app.js', status: 'modified' }],
        });
        mockWorkflow(orchestrator);
        await orchestrator.execute();

        // Verify Run 1 recorded START_HASH (not post-commit hash)
        const hist1 = JSON.parse(await fs.readFile(`${testDir}/commit_history.json`, 'utf8'));
        expect(hist1.lastRunCommit).toBe(START_HASH);

        // ── Run 2 ──────────────────────────────────────────────────────────
        const orchestrator2 = new MainOrchestrator({
          workflowDir: testDir,
          stage: WORKFLOW_STAGES.QUICK,
          auto: true,
        });
        const ctx2 = {};
        mockWorkflow(orchestrator2, ctx2);

        // Run 2: diff(START_HASH → HEAD) returns only artifact files
        // (the artifact commit happened between runs)
        let capturedDiffHash = null;
        const diffResult = [{ file: '.ai_workflow/commit_history.json', status: 'modified' }];
        orchestrator2.gitOps = makeGitMock({
          getCurrentHead: () => POST_ARTIFACT_HASH,
          getChangedFilesSince: (hash) => {
            capturedDiffHash = hash;
            return diffResult;
          },
          getLastNCommitsFiles: () => [{ file: 'src/app.js', status: 'modified' }],
        });

        await orchestrator2.execute();

        expect(capturedDiffHash).toBe(START_HASH); // must diff from run-1's start, not its post-commit
        // Artifact file filtered out; fallback gives real source file
        expect(ctx2.value.modifiedFiles).toContain('src/app.js');
        expect(ctx2.value.modifiedFiles).not.toContain('.ai_workflow/commit_history.json');
      });
    });
  });

  describe('healthCheck, abort, and getStatus', () => {
    const localTestDir = path.join(process.cwd(), '.test_health_abort');

    beforeEach(async () => {
      await fs.mkdir(path.join(localTestDir, 'metrics'), { recursive: true });
      await fs.mkdir(path.join(localTestDir, 'summaries'), { recursive: true });
      await fs.mkdir(path.join(localTestDir, 'checkpoints'), { recursive: true });
    });

    afterEach(async () => {
      await fs.rm(localTestDir, { recursive: true, force: true });
    });

    test('healthCheck returns results with passed flag', async () => {
      const orch = new MainOrchestrator({ workflowDir: localTestDir });
      const result = await orch.healthCheck();
      expect(result).toHaveProperty('passed');
      expect(result).toHaveProperty('checks');
    });

    test('healthCheck reports workflowDirWritable=true for a writable dir', async () => {
      const orch = new MainOrchestrator({ workflowDir: localTestDir });
      const result = await orch.healthCheck();
      expect(result.checks.filesystem.workflowDirWritable).toBe(true);
    });

    test('healthCheck reports workflowDirWritable=false for a non-existent dir', async () => {
      const orch = new MainOrchestrator({ workflowDir: '/nonexistent/path/abc123' });
      const result = await orch.healthCheck();
      expect(result.checks.filesystem.workflowDirWritable).toBe(false);
    });

    test('abort delegates to workflowEngine.abort()', () => {
      const orch = new MainOrchestrator({ workflowDir: localTestDir });
      let abortCalled = false;
      orch.workflowEngine.abort = () => {
        abortCalled = true;
      };
      orch.abort();
      expect(abortCalled).toBe(true);
    });

    test('getStatus returns status object with expected shape', () => {
      const orch = new MainOrchestrator({ workflowDir: localTestDir });
      const status = orch.getStatus();
      expect(status).toHaveProperty('currentStep');
      expect(status).toHaveProperty('completed');
      expect(status).toHaveProperty('total');
      expect(status).toHaveProperty('progress');
      expect(status).toHaveProperty('status');
      expect(status).toHaveProperty('duration');
    });

    test('getStatus reflects result updates', () => {
      const orch = new MainOrchestrator({ workflowDir: localTestDir });
      orch.results.steps['step_00'] = { success: true };
      orch.currentStep = 'step_01';
      const status = orch.getStatus();
      expect(status.currentStep).toBe('step_01');
      expect(status.completed).toBe(1);
    });
  });

  describe('healthCheck failure warnings and execute error path', () => {
    const localTestDir = path.join(process.cwd(), '.test_execute_fail');

    beforeEach(async () => {
      await fs.mkdir(path.join(localTestDir, 'metrics'), { recursive: true });
      await fs.mkdir(path.join(localTestDir, 'summaries'), { recursive: true });
      await fs.mkdir(path.join(localTestDir, 'checkpoints'), { recursive: true });
    });

    afterEach(async () => {
      await fs.rm(localTestDir, { recursive: true, force: true });
    });

    test('healthCheck warns when config check fails', async () => {
      const orch = new MainOrchestrator({ workflowDir: localTestDir });
      // Null out configManager so the config health check fails
      orch.configManager = null;
      const result = await orch.healthCheck();
      expect(result.passed).toBe(false);
      expect(result.checks.configuration.passed).toBe(false);
    });

    test('execute returns failure when health checks fail', async () => {
      const orch = new MainOrchestrator({ workflowDir: localTestDir });
      // Override healthCheck to return failure
      orch.healthCheck = async () => ({ passed: false, checks: {} });
      const result = await orch.execute({});
      expect(result.success).toBe(false);
      expect(result.error).toContain('Health checks failed');
    });

    test('resume emits step events during workflow execution', async () => {
      const orch = new MainOrchestrator({ workflowDir: localTestDir, stage: 'quick' });

      orch.checkpointManager.load = async () => ({
        workflowId: 'event-test-workflow',
        state: {
          completedSteps: ['step_00', 'step_01'],
          failedSteps: [],
          skippedSteps: [],
          results: {},
          context: {},
        },
      });
      orch.checkpointManager.save = async () => true;
      orch.workflowEngine.loadWorkflow = async () => ({});

      // Override executeWorkflow to emit step events so handlers are covered
      orch.workflowEngine.executeWorkflow = async () => {
        orch.workflowEngine.emit('step:start', { step: { id: 'step_02', name: 'Step 2' } });
        orch.workflowEngine.emit('step:complete', {
          step: { id: 'step_02', name: 'Step 2' },
          result: { success: true, duration: 100 },
        });
        orch.workflowEngine.emit('step:error', {
          step: { id: 'step_04', name: 'Step 4' },
          error: new Error('test error'),
        });
        return {
          success: true,
          summary: { total: 2, succeeded: 1, failed: 1, skipped: 0 },
          results: [],
          duration: 100,
        };
      };

      const result = await orch.resume('event-test-checkpoint');
      expect(result.success).toBe(true);
      expect(result.resumed).toBe(true);
    });

    test('execute emits step events during workflow execution', async () => {
      const orch = new MainOrchestrator({ workflowDir: localTestDir, stage: 'quick', auto: true });

      // Override health check to pass without real system checks
      orch.healthCheck = async () => ({
        passed: true,
        checks: { configuration: { passed: true }, environment: { passed: true } },
      });

      orch.checkpointManager.save = async () => 'checkpoint-id';
      orch.workflowEngine.loadWorkflow = async (w) => w;

      // executeWorkflow emits all four step event types so execute() handlers are covered
      orch.workflowEngine.executeWorkflow = async () => {
        orch.workflowEngine.emit('step:start', { step: { id: 'step_00', name: 'Step 0' } });
        orch.workflowEngine.emit('step:complete', {
          step: { id: 'step_00', name: 'Step 0' },
          result: { success: true, duration: 200 },
        });
        orch.workflowEngine.emit('step:error', {
          step: { id: 'step_01', name: 'Step 1' },
          error: new Error('simulated error'),
        });
        orch.workflowEngine.emit('step:skipped', {
          step: { id: 'step_02', name: 'Step 2' },
          result: { reason: 'not needed' },
        });
        return {
          success: true,
          summary: { total: 3, succeeded: 1, failed: 1, skipped: 1 },
          results: [],
          duration: 500,
        };
      };

      orch.summaryGenerator.generateSummary = async () => 'Summary';

      const result = await orch.execute({});
      expect(result.success).toBe(true);
    });
  });
});
