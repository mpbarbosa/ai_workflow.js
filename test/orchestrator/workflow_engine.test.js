/**
 * Tests for Workflow Engine Module
 *
 * @jest-environment node
 */

import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  validateWorkflowConfig,
  buildExecutionPlan,
  shouldExecuteStep,
  mergeStepResults,
  calculateWorkflowProgress,
  validateStepDefinition,
  createExecutionContext,
  parseWorkflowFile,
  WorkflowEngine,
} from '../../src/orchestrator/workflow_engine.js';

describe('Workflow Engine Module - Pure Functions', () => {
  describe('validateWorkflowConfig', () => {
    test('validates valid config', () => {
      const config = {
        name: 'test-workflow',
        version: '1.0.0',
        steps: [
          { id: 'step1', name: 'Step 1' },
          { id: 'step2', name: 'Step 2', dependencies: ['step1'] },
        ],
      };

      const result = validateWorkflowConfig(config);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    test('requires config to be object', () => {
      const result = validateWorkflowConfig(null);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Config must be an object');
    });

    test('requires name field', () => {
      const config = { version: '1.0.0', steps: [] };
      const result = validateWorkflowConfig(config);

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('name'))).toBe(true);
    });

    test('requires version field', () => {
      const config = { name: 'test', steps: [] };
      const result = validateWorkflowConfig(config);

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('version'))).toBe(true);
    });

    test('requires steps array', () => {
      const config = { name: 'test', version: '1.0.0' };
      const result = validateWorkflowConfig(config);

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('Steps'))).toBe(true);
    });

    test('requires at least one step', () => {
      const config = { name: 'test', version: '1.0.0', steps: [] };
      const result = validateWorkflowConfig(config);

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('at least one step'))).toBe(true);
    });

    test('validates step structure', () => {
      const config = {
        name: 'test',
        version: '1.0.0',
        steps: [{ name: 'Step 1' }], // Missing id
      };

      const result = validateWorkflowConfig(config);

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('id'))).toBe(true);
    });

    test('validates dependencies array', () => {
      const config = {
        name: 'test',
        version: '1.0.0',
        steps: [{ id: 'step1', name: 'Step 1', dependencies: 'invalid' }],
      };

      const result = validateWorkflowConfig(config);

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('dependencies'))).toBe(true);
    });
  });

  describe('buildExecutionPlan', () => {
    test('returns empty array for empty input', () => {
      expect(buildExecutionPlan([])).toEqual([]);
      expect(buildExecutionPlan(null)).toEqual([]);
    });

    test('orders steps by dependencies', () => {
      const steps = [
        { id: 'step3', name: 'Step 3', dependencies: ['step1', 'step2'] },
        { id: 'step2', name: 'Step 2', dependencies: ['step1'] },
        { id: 'step1', name: 'Step 1', dependencies: [] },
      ];

      const plan = buildExecutionPlan(steps);

      expect(plan[0].id).toBe('step1');
      expect(plan[1].id).toBe('step2');
      expect(plan[2].id).toBe('step3');
    });

    test('handles independent steps', () => {
      const steps = [
        { id: 'step1', name: 'Step 1' },
        { id: 'step2', name: 'Step 2' },
      ];

      const plan = buildExecutionPlan(steps);

      expect(plan).toHaveLength(2);
    });

    test('throws on circular dependencies', () => {
      const steps = [
        { id: 'step1', name: 'Step 1', dependencies: ['step2'] },
        { id: 'step2', name: 'Step 2', dependencies: ['step1'] },
      ];

      expect(() => buildExecutionPlan(steps)).toThrow('Circular dependency');
    });

    test('handles complex dependency graph', () => {
      const steps = [
        { id: 'd', name: 'D', dependencies: ['b', 'c'] },
        { id: 'c', name: 'C', dependencies: ['a'] },
        { id: 'b', name: 'B', dependencies: ['a'] },
        { id: 'a', name: 'A', dependencies: [] },
      ];

      const plan = buildExecutionPlan(steps);

      expect(plan[0].id).toBe('a');
      const bIndex = plan.findIndex((s) => s.id === 'b');
      const cIndex = plan.findIndex((s) => s.id === 'c');
      const dIndex = plan.findIndex((s) => s.id === 'd');

      expect(bIndex).toBeLessThan(dIndex);
      expect(cIndex).toBeLessThan(dIndex);
    });

    test('ignores undefined dependencies', () => {
      const steps = [{ id: 'step1', name: 'Step 1', dependencies: ['nonexistent'] }];

      const plan = buildExecutionPlan(steps);

      expect(plan).toHaveLength(1);
      expect(plan[0].id).toBe('step1');
    });
  });

  describe('shouldExecuteStep', () => {
    test('returns false for invalid step', () => {
      expect(shouldExecuteStep(null)).toBe(false);
      expect(shouldExecuteStep(undefined)).toBe(false);
    });

    test('returns false if step.skip is true', () => {
      const step = { id: 'step1', skip: true };
      expect(shouldExecuteStep(step)).toBe(false);
    });

    test('returns false if step.enabled is false', () => {
      const step = { id: 'step1', enabled: false };
      expect(shouldExecuteStep(step)).toBe(false);
    });

    test('evaluates function conditions', () => {
      const step1 = { id: 'step1', condition: () => true };
      const step2 = { id: 'step2', condition: () => false };

      expect(shouldExecuteStep(step1)).toBe(true);
      expect(shouldExecuteStep(step2)).toBe(false);
    });

    test('evaluates string conditions', () => {
      const step1 = { id: 'step1', condition: 'hasChanges' };
      const step2 = { id: 'step2', condition: 'noChanges' };

      expect(shouldExecuteStep(step1, { hasChanges: true })).toBe(true);
      expect(shouldExecuteStep(step2, { noChanges: false })).toBe(false);
    });

    test('evaluates nested property conditions', () => {
      const step = { id: 'step1', condition: 'context.state.ready' };
      const context = { context: { state: { ready: true } } };

      expect(shouldExecuteStep(step, context)).toBe(true);
    });

    test('defaults to true for steps without conditions', () => {
      const step = { id: 'step1', name: 'Step 1' };
      expect(shouldExecuteStep(step)).toBe(true);
    });
  });

  describe('mergeStepResults', () => {
    test('handles empty array', () => {
      const result = mergeStepResults([]);

      expect(result.total).toBe(0);
      expect(result.succeeded).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.skipped).toBe(0);
    });

    test('handles non-array input', () => {
      const result = mergeStepResults(null);

      expect(result.total).toBe(0);
    });

    test('counts successful steps', () => {
      const results = [
        { stepId: 's1', success: true },
        { stepId: 's2', success: true },
        { stepId: 's3', success: true },
      ];

      const summary = mergeStepResults(results);

      expect(summary.total).toBe(3);
      expect(summary.succeeded).toBe(3);
      expect(summary.failed).toBe(0);
    });

    test('counts failed steps', () => {
      const results = [
        { stepId: 's1', success: false },
        { stepId: 's2', success: false },
      ];

      const summary = mergeStepResults(results);

      expect(summary.total).toBe(2);
      expect(summary.succeeded).toBe(0);
      expect(summary.failed).toBe(2);
    });

    test('counts skipped steps', () => {
      const results = [
        { stepId: 's1', success: true, skipped: true },
        { stepId: 's2', success: true, skipped: true },
      ];

      const summary = mergeStepResults(results);

      expect(summary.total).toBe(2);
      expect(summary.skipped).toBe(2);
    });

    test('counts mixed results', () => {
      const results = [
        { stepId: 's1', success: true },
        { stepId: 's2', success: false },
        { stepId: 's3', success: true, skipped: true },
      ];

      const summary = mergeStepResults(results);

      expect(summary.total).toBe(3);
      expect(summary.succeeded).toBe(1);
      expect(summary.failed).toBe(1);
      expect(summary.skipped).toBe(1);
    });
  });

  describe('calculateWorkflowProgress', () => {
    test('returns 0 for zero total', () => {
      expect(calculateWorkflowProgress(5, 0)).toBe(0);
    });

    test('returns 0 for zero completed', () => {
      expect(calculateWorkflowProgress(0, 10)).toBe(0);
    });

    test('returns 100 when completed equals total', () => {
      expect(calculateWorkflowProgress(10, 10)).toBe(100);
    });

    test('returns 100 when completed exceeds total', () => {
      expect(calculateWorkflowProgress(15, 10)).toBe(100);
    });

    test('calculates percentage correctly', () => {
      expect(calculateWorkflowProgress(3, 10)).toBe(30);
      expect(calculateWorkflowProgress(5, 10)).toBe(50);
      expect(calculateWorkflowProgress(7, 10)).toBe(70);
    });

    test('rounds to nearest integer', () => {
      expect(calculateWorkflowProgress(1, 3)).toBe(33);
      expect(calculateWorkflowProgress(2, 3)).toBe(67);
    });
  });

  describe('validateStepDefinition', () => {
    test('validates valid step', () => {
      const step = { id: 'step1', name: 'Step 1' };
      const result = validateStepDefinition(step);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    test('requires step to be object', () => {
      const result = validateStepDefinition(null);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Step must be an object');
    });

    test('requires id field', () => {
      const step = { name: 'Step 1' };
      const result = validateStepDefinition(step);

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('id'))).toBe(true);
    });

    test('requires name field', () => {
      const step = { id: 'step1' };
      const result = validateStepDefinition(step);

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('name'))).toBe(true);
    });

    test('validates timeout', () => {
      const step = { id: 'step1', name: 'Step 1', timeout: -100 };
      const result = validateStepDefinition(step);

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('timeout'))).toBe(true);
    });

    test('validates retries', () => {
      const step = { id: 'step1', name: 'Step 1', retries: -1 };
      const result = validateStepDefinition(step);

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('retries'))).toBe(true);
    });
  });

  describe('createExecutionContext', () => {
    test('creates context with defaults', () => {
      const workflow = { name: 'test', version: '1.0.0' };
      const context = createExecutionContext(workflow);

      expect(context.workflowName).toBe('test');
      expect(context.workflowVersion).toBe('1.0.0');
      expect(context.dryRun).toBe(false);
      expect(context.environment).toBe('development');
    });

    test('includes custom options', () => {
      const workflow = { name: 'test', version: '1.0.0' };
      const options = {
        dryRun: true,
        environment: 'production',
        config: { key: 'value' },
      };

      const context = createExecutionContext(workflow, options);

      expect(context.dryRun).toBe(true);
      expect(context.environment).toBe('production');
      expect(context.config.key).toBe('value');
    });

    test('preserves extra orchestrator fields (e.g. projectType)', () => {
      const workflow = { name: 'test', version: '1.0.0' };
      const options = { projectType: 'nodejs_api', workflowDir: '/tmp/wf', auto: true };

      const context = createExecutionContext(workflow, options);

      expect(context.projectType).toBe('nodejs_api');
      expect(context.workflowDir).toBe('/tmp/wf');
      expect(context.auto).toBe(true);
    });

    test('state and results are always fresh objects regardless of options', () => {
      const workflow = { name: 'test', version: '1.0.0' };
      const options = { state: { old: true }, results: [{ old: true }] };

      const context = createExecutionContext(workflow, options);

      expect(context.state).toEqual({});
      expect(context.results).toEqual([]);
    });

    test('uses workflow id or name', () => {
      const workflow1 = { id: 'wf1', name: 'test', version: '1.0.0' };
      const workflow2 = { name: 'test', version: '1.0.0' };

      const context1 = createExecutionContext(workflow1);
      const context2 = createExecutionContext(workflow2);

      expect(context1.workflowId).toBe('wf1');
      expect(context2.workflowId).toBe('test');
    });
  });
});

describe('Workflow Engine Module - parseWorkflowFile', () => {
  const validWorkflow = { name: 'w', version: '1.0.0', steps: [{ id: 's1', name: 'S1' }] };

  test('parses valid JSON', () => {
    const result = parseWorkflowFile(JSON.stringify(validWorkflow), 'workflow.json');
    expect(result).toEqual(validWorkflow);
  });

  test('parses valid YAML (.yaml)', () => {
    const content = `name: w\nversion: "1.0.0"\nsteps:\n  - id: s1\n    name: S1\n`;
    const result = parseWorkflowFile(content, 'workflow.yaml');
    expect(result.name).toBe('w');
    expect(result.steps[0].id).toBe('s1');
  });

  test('parses valid YAML (.yml)', () => {
    const content = `name: w\nversion: "1.0.0"\nsteps:\n  - id: s1\n    name: S1\n`;
    const result = parseWorkflowFile(content, 'workflow.yml');
    expect(result.name).toBe('w');
  });

  test('throws SystemError for invalid JSON', () => {
    expect(() => parseWorkflowFile('{ bad json }', 'wf.json')).toThrow(
      'Failed to parse workflow JSON'
    );
  });

  test('throws SystemError for invalid YAML', () => {
    expect(() => parseWorkflowFile('key: [unclosed', 'wf.yaml')).toThrow(
      'Failed to parse workflow YAML'
    );
  });

  test('throws SystemError when YAML parses to non-object', () => {
    expect(() => parseWorkflowFile('just a string', 'wf.yaml')).toThrow(
      'did not parse to an object'
    );
  });

  test('throws SystemError for unsupported extension', () => {
    expect(() => parseWorkflowFile('{}', 'wf.toml')).toThrow('Unsupported workflow file extension');
  });

  test('throws SystemError for missing extension', () => {
    expect(() => parseWorkflowFile('{}', 'workflow')).toThrow(
      'Unsupported workflow file extension'
    );
  });
});

describe('Workflow Engine Module - WorkflowEngine Class', () => {
  let engine;

  beforeEach(() => {
    engine = new WorkflowEngine({ dryRun: false });
  });

  describe('constructor', () => {
    test('creates instance with defaults', () => {
      const engine = new WorkflowEngine();

      expect(engine.options.dryRun).toBe(false);
      expect(engine.options.maxRetries).toBe(3);
      expect(engine.workflow).toBe(null);
    });

    test('accepts custom options', () => {
      const engine = new WorkflowEngine({
        dryRun: true,
        maxRetries: 5,
        defaultTimeout: 60000,
      });

      expect(engine.options.dryRun).toBe(true);
      expect(engine.options.maxRetries).toBe(5);
      expect(engine.options.defaultTimeout).toBe(60000);
    });
  });

  describe('loadWorkflow', () => {
    test('loads valid workflow', async () => {
      const workflow = {
        name: 'test-workflow',
        version: '1.0.0',
        steps: [
          { id: 'step1', name: 'Step 1' },
          { id: 'step2', name: 'Step 2', dependencies: ['step1'] },
        ],
      };

      await engine.loadWorkflow(workflow);

      expect(engine.workflow).toBe(workflow);
      expect(engine.executionPlan).toHaveLength(2);
      expect(engine.executionPlan[0].id).toBe('step1');
    });

    test('throws on invalid workflow', async () => {
      const workflow = { name: 'test' }; // Missing version and steps

      await expect(engine.loadWorkflow(workflow)).rejects.toThrow('Invalid workflow configuration');
    });

    test('emits workflow:loaded event', async () => {
      const workflow = {
        name: 'test',
        version: '1.0.0',
        steps: [{ id: 'step1', name: 'Step 1' }],
      };

      let loadedEventCalled = false;
      const loadedEvent = () => {
        loadedEventCalled = true;
      };
      engine.on('workflow:loaded', loadedEvent);

      await engine.loadWorkflow(workflow);

      expect(loadedEventCalled).toBe(true);
    });

    test('throws for unsupported file extension', async () => {
      await expect(engine.loadWorkflow('./workflow.toml')).rejects.toThrow(
        'Unsupported workflow file extension'
      );
    });

    test('loads workflow from JSON file', async () => {
      const workflow = {
        name: 'file-workflow',
        version: '1.0.0',
        steps: [{ id: 'step1', name: 'Step 1' }],
      };
      const tmpPath = join(tmpdir(), `wf-test-${Date.now()}.json`);
      await writeFile(tmpPath, JSON.stringify(workflow), 'utf8');
      try {
        await engine.loadWorkflow(tmpPath);
        expect(engine.workflow.name).toBe('file-workflow');
      } finally {
        await unlink(tmpPath).catch(() => {});
      }
    });

    test('loads workflow from YAML file', async () => {
      const tmpPath = join(tmpdir(), `wf-test-${Date.now()}.yaml`);
      const yamlContent = `name: yaml-workflow\nversion: "1.0.0"\nsteps:\n  - id: step1\n    name: Step 1\n`;
      await writeFile(tmpPath, yamlContent, 'utf8');
      try {
        await engine.loadWorkflow(tmpPath);
        expect(engine.workflow.name).toBe('yaml-workflow');
      } finally {
        await unlink(tmpPath).catch(() => {});
      }
    });

    test('throws readable error when file does not exist', async () => {
      await expect(engine.loadWorkflow('/nonexistent/path/workflow.json')).rejects.toThrow(
        'Failed to read workflow file'
      );
    });

    test('throws on invalid JSON in file', async () => {
      const tmpPath = join(tmpdir(), `wf-test-${Date.now()}.json`);
      await writeFile(tmpPath, '{ bad json }', 'utf8');
      try {
        await expect(engine.loadWorkflow(tmpPath)).rejects.toThrow('Failed to parse workflow JSON');
      } finally {
        await unlink(tmpPath).catch(() => {});
      }
    });

    test('throws ValidationError for valid JSON with invalid workflow schema', async () => {
      const tmpPath = join(tmpdir(), `wf-test-${Date.now()}.json`);
      await writeFile(tmpPath, JSON.stringify({ name: 'no-steps' }), 'utf8');
      try {
        await expect(engine.loadWorkflow(tmpPath)).rejects.toThrow(
          'Invalid workflow configuration'
        );
      } finally {
        await unlink(tmpPath).catch(() => {});
      }
    });
  });

  describe('executeWorkflow', () => {
    test('throws if workflow not loaded', async () => {
      await expect(engine.executeWorkflow()).rejects.toThrow('No workflow loaded');
    });

    test('executes simple workflow', async () => {
      const workflow = {
        name: 'simple',
        version: '1.0.0',
        steps: [
          { id: 'step1', name: 'Step 1' },
          { id: 'step2', name: 'Step 2' },
        ],
      };

      await engine.loadWorkflow(workflow);
      const result = await engine.executeWorkflow();

      expect(result.success).toBe(true);
      expect(result.summary.total).toBe(2);
      expect(result.summary.succeeded).toBe(2);
    });

    test('executes workflow with handlers', async () => {
      const handler1 = async () => 'output1';
      const handler2 = async () => 'output2';

      const workflow = {
        name: 'with-handlers',
        version: '1.0.0',
        steps: [
          { id: 'step1', name: 'Step 1', handler: handler1 },
          { id: 'step2', name: 'Step 2', handler: handler2 },
        ],
      };

      await engine.loadWorkflow(workflow);
      const result = await engine.executeWorkflow();

      expect(typeof handler1).toBe('function');
      expect(typeof handler2).toBe('function');
      expect(result.summary.succeeded).toBe(2);
    });

    test('handles step failures', async () => {
      const workflow = {
        name: 'with-failure',
        version: '1.0.0',
        steps: [
          { id: 'step1', name: 'Step 1', handler: () => Promise.reject(new Error('Failed')) },
          { id: 'step2', name: 'Step 2' },
        ],
      };

      await engine.loadWorkflow(workflow);
      const result = await engine.executeWorkflow();

      expect(result.success).toBe(false);
      expect(result.summary.failed).toBe(1);
    });

    test('treats step returning {success: false} as failed', async () => {
      const workflow = {
        name: 'soft-failure',
        version: '1.0.0',
        steps: [
          {
            id: 'step1',
            name: 'Step 1',
            handler: async () => ({ success: false, error: 'Soft failure' }),
          },
          { id: 'step2', name: 'Step 2', critical: false },
        ],
      };

      await engine.loadWorkflow(workflow);
      const result = await engine.executeWorkflow();

      const step1Result = result.results.find((r) => r.stepId === 'step1');
      expect(step1Result.success).toBe(false);
    });

    test('treats step returning {success: true} as succeeded', async () => {
      const workflow = {
        name: 'explicit-success',
        version: '1.0.0',
        steps: [
          {
            id: 'step1',
            name: 'Step 1',
            handler: async () => ({ success: true, data: 'ok' }),
          },
        ],
      };

      await engine.loadWorkflow(workflow);
      const result = await engine.executeWorkflow();

      const step1Result = result.results.find((r) => r.stepId === 'step1');
      expect(step1Result.success).toBe(true);
    });

    test('skips steps with skip:true', async () => {
      const workflow = {
        name: 'with-skip',
        version: '1.0.0',
        steps: [
          { id: 'step1', name: 'Step 1' },
          { id: 'step2', name: 'Step 2', skip: true },
        ],
      };

      await engine.loadWorkflow(workflow);
      const result = await engine.executeWorkflow();

      expect(result.summary.skipped).toBe(1);
      expect(result.summary.succeeded).toBe(1);
    });

    test('supports startFromStep option', async () => {
      const workflow = {
        name: 'start-from',
        version: '1.0.0',
        steps: [
          { id: 'step1', name: 'Step 1' },
          { id: 'step2', name: 'Step 2' },
          { id: 'step3', name: 'Step 3' },
        ],
      };

      await engine.loadWorkflow(workflow);
      const result = await engine.executeWorkflow({ startFromStep: 'step2' });

      expect(result.summary.total).toBe(2);
    });

    test('supports stopAtStep option', async () => {
      const workflow = {
        name: 'stop-at',
        version: '1.0.0',
        steps: [
          { id: 'step1', name: 'Step 1' },
          { id: 'step2', name: 'Step 2' },
          { id: 'step3', name: 'Step 3' },
        ],
      };

      await engine.loadWorkflow(workflow);
      const result = await engine.executeWorkflow({ stopAtStep: 'step2' });

      expect(result.summary.total).toBe(2);
    });

    test('handles dry run mode', async () => {
      let handlerCalled = false;
      const handler = async () => {
        handlerCalled = true;
      };
      const workflow = {
        name: 'dry-run',
        version: '1.0.0',
        steps: [{ id: 'step1', name: 'Step 1', handler }],
      };

      const dryEngine = new WorkflowEngine({ dryRun: true });
      await dryEngine.loadWorkflow(workflow);
      const result = await dryEngine.executeWorkflow();

      expect(handlerCalled).toBe(false);
      expect(result.summary.succeeded).toBe(1);
      expect(result.results[0].dryRun).toBe(true);
    });

    test('emits workflow events', async () => {
      let startEventCalled = false;
      const startEvent = () => {
        startEventCalled = true;
      };
      let completeEventCalled = false;
      const completeEvent = () => {
        completeEventCalled = true;
      };

      const workflow = {
        name: 'events',
        version: '1.0.0',
        steps: [{ id: 'step1', name: 'Step 1' }],
      };

      engine.on('workflow:start', startEvent);
      engine.on('workflow:complete', completeEvent);

      await engine.loadWorkflow(workflow);
      await engine.executeWorkflow();

      expect(startEventCalled).toBe(true);
      expect(completeEventCalled).toBe(true);
    });

    test('merges contextUpdate from step output into shared context', async () => {
      const workflow = {
        name: 'ctx-update',
        version: '1.0.0',
        steps: [
          {
            id: 'step_00',
            name: 'Pre-Analysis',
            handler: async () => ({
              success: true,
              analysis: { projectKind: { kind: 'nodejs_api' } },
              contextUpdate: { projectType: 'nodejs_api' },
            }),
          },
          {
            id: 'step_01',
            name: 'Next Step',
            handler: async (ctx) => ({ success: true, capturedType: ctx.projectType }),
          },
        ],
      };

      await engine.loadWorkflow(workflow);
      const result = await engine.executeWorkflow();

      // step_01 should have seen projectType written by step_00's contextUpdate
      expect(result.results[1].output.capturedType).toBe('nodejs_api');
    });
  });

  describe('executeStep', () => {
    beforeEach(async () => {
      const workflow = {
        name: 'test',
        version: '1.0.0',
        steps: [{ id: 'step1', name: 'Step 1' }],
      };
      await engine.loadWorkflow(workflow);
    });

    test('executes step successfully', async () => {
      const step = { id: 'step1', name: 'Step 1' };
      const result = await engine.executeStep(step, {});

      expect(result.success).toBe(true);
      expect(result.stepId).toBe('step1');
    });

    test('emits step events', async () => {
      let startEventCalled = false;
      const startEvent = () => {
        startEventCalled = true;
      };
      let completeEventCalled = false;
      const completeEvent = () => {
        completeEventCalled = true;
      };

      engine.on('step:start', startEvent);
      engine.on('step:complete', completeEvent);

      const step = { id: 'step1', name: 'Step 1' };
      await engine.executeStep(step, {});

      expect(startEventCalled).toBe(true);
      expect(completeEventCalled).toBe(true);
    });

    test('handles step errors', async () => {
      const step = {
        id: 'step1',
        name: 'Step 1',
        handler: () => Promise.reject(new Error('Test error')),
      };

      const result = await engine.executeStep(step, {});

      expect(result.success).toBe(false);
      expect(result.error.message).toBe('Test error');
    });
  });

  describe('getStatus', () => {
    test('returns idle state when no workflow', () => {
      const status = engine.getStatus();

      expect(status.state).toBe('idle');
      expect(status.workflow).toBe(null);
    });

    test('returns workflow info after loading', async () => {
      const workflow = {
        name: 'test',
        version: '1.0.0',
        steps: [{ id: 'step1', name: 'Step 1' }],
      };

      await engine.loadWorkflow(workflow);
      const status = engine.getStatus();

      expect(status.workflow.name).toBe('test');
      expect(status.workflow.version).toBe('1.0.0');
      expect(status.total).toBe(1);
    });

    test('calculates progress', async () => {
      const workflow = {
        name: 'test',
        version: '1.0.0',
        steps: [
          { id: 'step1', name: 'Step 1' },
          { id: 'step2', name: 'Step 2' },
        ],
      };

      await engine.loadWorkflow(workflow);
      engine.results = [{ stepId: 'step1', success: true }];

      const status = engine.getStatus();

      expect(status.completed).toBe(1);
      expect(status.total).toBe(2);
      expect(status.progress).toBe(50);
    });
  });
});
