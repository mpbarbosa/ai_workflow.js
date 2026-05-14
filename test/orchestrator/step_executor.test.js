/**
 * @fileoverview Tests for Step Executor Module
 * @module test/orchestrator/step_executor
 */

import {
  validateStepInput,
  validateStepOutput,
  calculateTimeout,
  shouldRetryStep,
  calculateRetryDelay,
  formatStepResult,
  createExecutionContext,
  isTimedOut,
  buildErrorMessage,
  StepExecutor,
} from '../../src/orchestrator/step_executor.js';
import { StepExecutorValidationError } from 'olinda_orchestrator';
import { ValidationError, SystemError } from '../../src/utils/errors.js';

describe('Step Executor Module', () => {
  // ============================================================================
  // Pure Function Tests
  // ============================================================================

  describe('Pure Functions - validateStepInput', () => {
    test('returns valid for no schema', () => {
      const result = validateStepInput({ data: 'test' });

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    test('validates required fields', () => {
      const schema = { requiredFields: ['name', 'value'] };
      const result = validateStepInput({ name: 'test' }, schema);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required field: value');
    });

    test('validates field types', () => {
      const schema = { types: { age: 'number' } };
      const result = validateStepInput({ age: 'twenty' }, schema);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('must be number'))).toBe(true);
    });

    test('runs custom validator', () => {
      const schema = {
        validate: (input) => (input.value > 0 ? true : 'Value must be positive'),
      };
      const result = validateStepInput({ value: -5 }, schema);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Value must be positive');
    });

    test('passes valid input', () => {
      const schema = {
        requiredFields: ['name'],
        types: { name: 'string' },
      };
      const result = validateStepInput({ name: 'test' }, schema);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });
  });

  describe('Pure Functions - validateStepOutput', () => {
    test('returns valid for no schema', () => {
      const result = validateStepOutput({ data: 'test' });

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    test('validates required output fields', () => {
      const schema = { requiredFields: ['result', 'status'] };
      const result = validateStepOutput({ result: 'ok' }, schema);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required output field: status');
    });

    test('validates success flag', () => {
      const schema = { requireSuccess: true };
      const result = validateStepOutput({ success: false }, schema);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Step did not report success');
    });

    test('runs custom validator', () => {
      const schema = {
        validate: (output) => (output.count > 0 ? true : 'Count must be positive'),
      };
      const result = validateStepOutput({ count: 0 }, schema);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Count must be positive');
    });
  });

  describe('Pure Functions - calculateTimeout', () => {
    test('uses step timeout if provided', () => {
      const step = { timeout: 600 };
      const result = calculateTimeout(step, 300);

      expect(result).toBe(600000); // 600 seconds = 600000ms
    });

    test('uses base timeout if step has no timeout', () => {
      const step = {};
      const result = calculateTimeout(step, 300);

      expect(result).toBe(300000); // 300 seconds
    });

    test('defaults to 300 seconds', () => {
      const step = {};
      const result = calculateTimeout(step);

      expect(result).toBe(300000);
    });
  });

  describe('Pure Functions - shouldRetryStep', () => {
    test('returns false if max retries exceeded', () => {
      const error = new Error('Test error');
      const result = shouldRetryStep(error, 3, 3);

      expect(result).toBe(false);
    });

    test('returns false for ValidationError', () => {
      const error = new ValidationError('Invalid input');
      const result = shouldRetryStep(error, 0, 3);

      expect(result).toBe(false);
    });

    test('returns false for olinda_orchestrator validation errors', () => {
      const error = new StepExecutorValidationError('Invalid input');
      const result = shouldRetryStep(error, 0, 3);

      expect(result).toBe(false);
    });

    test('returns true for system errors', () => {
      const error = new SystemError('Connection failed');
      const result = shouldRetryStep(error, 0, 3);

      expect(result).toBe(true);
    });

    test('returns true for generic errors', () => {
      const error = new Error('Unknown error');
      const result = shouldRetryStep(error, 1, 3);

      expect(result).toBe(true);
    });
  });

  describe('Pure Functions - calculateRetryDelay', () => {
    test('calculates exponential backoff', () => {
      expect(calculateRetryDelay(0, 1000)).toBe(1000); // 2^0 * 1000
      expect(calculateRetryDelay(1, 1000)).toBe(2000); // 2^1 * 1000
      expect(calculateRetryDelay(2, 1000)).toBe(4000); // 2^2 * 1000
      expect(calculateRetryDelay(3, 1000)).toBe(8000); // 2^3 * 1000
    });

    test('uses default base delay', () => {
      expect(calculateRetryDelay(0)).toBe(1000);
      expect(calculateRetryDelay(1)).toBe(2000);
    });
  });

  describe('Pure Functions - formatStepResult', () => {
    test('formats successful result', () => {
      const step = { id: 'step1', name: 'Test Step' };
      const execution = {
        success: true,
        duration: 1500,
        output: { data: 'result' },
        timestamp: 1000,
      };

      const result = formatStepResult(step, execution);

      expect(result.stepId).toBe('step1');
      expect(result.name).toBe('Test Step');
      expect(result.success).toBe(true);
      expect(result.duration).toBe(1500);
      expect(result.output).toEqual({ data: 'result' });
      expect(result.attempts).toBe(1);
    });

    test('formats failed result', () => {
      const step = { id: 'step1', name: 'Test Step' };
      const execution = {
        success: false,
        error: 'Execution failed',
        duration: 500,
      };

      const result = formatStepResult(step, execution);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Execution failed');
    });

    test('handles skipped result', () => {
      const step = { id: 'step1', name: 'Test Step' };
      const execution = { skipped: true };

      const result = formatStepResult(step, execution);

      expect(result.skipped).toBe(true);
    });
  });

  describe('Pure Functions - createExecutionContext', () => {
    test('creates basic context', () => {
      const step = { id: 'step1', name: 'Test', phase: 'testing' };
      const context = createExecutionContext(step);

      expect(context.step).toBe(step);
      expect(context.metadata.stepId).toBe('step1');
      expect(context.metadata.phase).toBe('testing');
    });

    test('includes global context', () => {
      const step = { id: 'step1', name: 'Test' };
      const global = { projectRoot: '/path' };
      const context = createExecutionContext(step, global);

      expect(context.global).toBe(global);
    });

    test('includes previous results', () => {
      const step = { id: 'step2', name: 'Test' };
      const results = { step1: { success: true } };
      const context = createExecutionContext(step, {}, results);

      expect(context.results).toBe(results);
    });
  });

  describe('Pure Functions - isTimedOut', () => {
    test('returns false when not timed out', () => {
      const startTime = Date.now();
      const result = isTimedOut(startTime, 5000);

      expect(result).toBe(false);
    });

    test('returns true when timed out', () => {
      const startTime = Date.now() - 6000;
      const result = isTimedOut(startTime, 5000);

      expect(result).toBe(true);
    });
  });

  describe('Pure Functions - buildErrorMessage', () => {
    test('builds message without retries', () => {
      const step = { id: 'step1', name: 'Test' };
      const error = new Error('Failed');
      const message = buildErrorMessage(step, error, 1);

      expect(message).toBe("Step 'step1' failed: Failed");
    });

    test('builds message with retries', () => {
      const step = { id: 'step1', name: 'Test' };
      const error = new Error('Failed');
      const message = buildErrorMessage(step, error, 3);

      expect(message).toBe("Step 'step1' failed (after 3 attempts): Failed");
    });
  });

  // ============================================================================
  // StepExecutor Class Tests
  // ============================================================================

  describe('StepExecutor Class - Constructor', () => {
    test('initializes with default options', () => {
      const executor = new StepExecutor();

      expect(executor.options.baseTimeout).toBe(300);
      expect(executor.options.maxRetries).toBe(3);
      expect(executor.options.retryDelay).toBe(1000);
      expect(executor.executionHistory).toEqual([]);
    });

    test('accepts custom options', () => {
      const executor = new StepExecutor({
        baseTimeout: 600,
        maxRetries: 5,
        retryDelay: 2000,
      });

      expect(executor.options.baseTimeout).toBe(600);
      expect(executor.options.maxRetries).toBe(5);
      expect(executor.options.retryDelay).toBe(2000);
    });
  });

  describe('StepExecutor Class - execute', () => {
    test('executes step successfully', async () => {
      const executor = new StepExecutor();
      const step = {
        id: 'step1',
        name: 'Test Step',
        handler: async () => ({ data: 'success' }),
      };

      const result = await executor.execute(step);

      expect(result.success).toBe(true);
      expect(result.stepId).toBe('step1');
      expect(result.output).toEqual({ data: 'success' });
    });

    test('throws error for missing handler', async () => {
      const executor = new StepExecutor();
      const step = { id: 'step1', name: 'Test' };

      await expect(executor.execute(step)).rejects.toThrow(ValidationError);
    });

    test('validates input with schema', async () => {
      const executor = new StepExecutor();
      const step = {
        id: 'step1',
        name: 'Test',
        handler: async () => ({}),
        inputSchema: { requiredFields: ['name'] },
      };

      await expect(executor.execute(step, {})).rejects.toThrow(ValidationError);
    });

    test('validates output with schema', async () => {
      const executor = new StepExecutor();
      const step = {
        id: 'step1',
        name: 'Test',
        handler: async () => ({}),
        outputSchema: { requiredFields: ['result'] },
      };

      await expect(executor.execute(step, {})).rejects.toThrow(ValidationError);
    });

    test('records execution history', async () => {
      const executor = new StepExecutor();
      const step = {
        id: 'step1',
        name: 'Test',
        handler: async () => ({}),
      };

      await executor.execute(step);

      expect(executor.executionHistory).toHaveLength(1);
      expect(executor.executionHistory[0].stepId).toBe('step1');
    });

    test('emits step:start event', async () => {
      const executor = new StepExecutor();
      const step = {
        id: 'step1',
        name: 'Test',
        handler: async () => ({}),
      };

      let eventData;
      executor.on('step:start', (data) => {
        eventData = data;
      });

      await executor.execute(step);

      expect(eventData.stepId).toBe('step1');
    });

    test('emits step:complete event', async () => {
      const executor = new StepExecutor();
      const step = {
        id: 'step1',
        name: 'Test',
        handler: async () => ({}),
      };

      let eventData;
      executor.on('step:complete', (data) => {
        eventData = data;
      });

      await executor.execute(step);

      expect(eventData.success).toBe(true);
    });

    test('handles step timeout', async () => {
      const executor = new StepExecutor({ baseTimeout: 1 });
      const step = {
        id: 'step1',
        name: 'Test',
        handler: async () => {
          await new Promise((resolve) => setTimeout(resolve, 2000));
        },
      };

      await expect(executor.execute(step)).rejects.toThrow(SystemError);
    });
  });

  describe('StepExecutor Class - executeWithRetry', () => {
    test('succeeds on first attempt', async () => {
      const executor = new StepExecutor();
      const step = {
        id: 'step1',
        name: 'Test',
        handler: async () => ({ success: true }),
      };

      const result = await executor.executeWithRetry(step);

      expect(result.success).toBe(true);
      expect(result.attempts).toBe(1);
    });

    test('retries on failure', async () => {
      const executor = new StepExecutor({ retryDelay: 10 });
      let attempts = 0;
      const step = {
        id: 'step1',
        name: 'Test',
        handler: async () => {
          attempts++;
          if (attempts < 2) {
            throw new Error('Temporary failure');
          }
          return { success: true };
        },
      };

      const result = await executor.executeWithRetry(step);

      expect(result.success).toBe(true);
      expect(result.attempts).toBe(2);
    });

    test('exhausts retries and fails', async () => {
      const executor = new StepExecutor({ maxRetries: 2, retryDelay: 10 });
      const step = {
        id: 'step1',
        name: 'Test',
        handler: async () => {
          throw new Error('Permanent failure');
        },
      };

      await expect(executor.executeWithRetry(step)).rejects.toThrow(SystemError);
    });

    test('does not retry ValidationError', async () => {
      const executor = new StepExecutor({ maxRetries: 3, retryDelay: 10 });
      const step = {
        id: 'step1',
        name: 'Test',
        handler: async () => {
          throw new ValidationError('Invalid');
        },
      };

      await expect(executor.executeWithRetry(step)).rejects.toThrow();
      // ValidationError is not retried, so only 1 execution attempt
      expect(executor.executionHistory).toHaveLength(1);
    });

    test('emits step:retry event', async () => {
      const executor = new StepExecutor({ retryDelay: 10 });
      let retryCount = 0;
      let attempts = 0;

      const step = {
        id: 'step1',
        name: 'Test',
        handler: async () => {
          attempts++;
          if (attempts < 2) {
            throw new Error('Fail once');
          }
          return {};
        },
      };

      executor.on('step:retry', () => {
        retryCount++;
      });

      await executor.executeWithRetry(step);

      expect(retryCount).toBe(1);
    });
  });

  describe('StepExecutor Class - executeInParallel', () => {
    test('executes multiple steps in parallel', async () => {
      const executor = new StepExecutor();
      const steps = [
        { id: 'step1', name: 'Test1', handler: async () => ({ result: 1 }) },
        { id: 'step2', name: 'Test2', handler: async () => ({ result: 2 }) },
        { id: 'step3', name: 'Test3', handler: async () => ({ result: 3 }) },
      ];

      const results = await executor.executeInParallel(steps);

      expect(results).toHaveLength(3);
      expect(results.every((r) => r.success)).toBe(true);
    });

    test('continues execution if one step fails', async () => {
      const executor = new StepExecutor();
      const steps = [
        { id: 'step1', name: 'Test1', handler: async () => ({ result: 1 }) },
        {
          id: 'step2',
          name: 'Test2',
          handler: async () => {
            throw new Error('Failed');
          },
        },
        { id: 'step3', name: 'Test3', handler: async () => ({ result: 3 }) },
      ];

      const results = await executor.executeInParallel(steps);

      expect(results).toHaveLength(3);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[2].success).toBe(true);
    });
  });

  describe('StepExecutor Class - validateExecution', () => {
    test('validates successful execution', () => {
      const executor = new StepExecutor();
      const step = { id: 'step1', name: 'Test' };
      const result = { success: true };

      const validation = executor.validateExecution(step, result);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toEqual([]);
    });

    test('detects failed execution', () => {
      const executor = new StepExecutor();
      const step = { id: 'step1', name: 'Test' };
      const result = { success: false };

      const validation = executor.validateExecution(step, result);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Step execution failed');
    });

    test('validates critical step failure', () => {
      const executor = new StepExecutor();
      const step = { id: 'step1', name: 'Test', critical: true };
      const result = { success: false };

      const validation = executor.validateExecution(step, result);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Critical step failed');
    });

    test('validates expected output', () => {
      const executor = new StepExecutor();
      const step = { id: 'step1', name: 'Test', expectedOutput: ['data', 'status'] };
      const result = { success: true, output: { data: 'test' } };

      const validation = executor.validateExecution(step, result);

      expect(validation.valid).toBe(false);
      expect(validation.errors.some((e) => e.includes('status'))).toBe(true);
    });
  });

  describe('StepExecutor Class - getHistory', () => {
    test('returns execution history', async () => {
      const executor = new StepExecutor();
      const step = {
        id: 'step1',
        name: 'Test',
        handler: async () => ({}),
      };

      await executor.execute(step);
      const history = executor.getHistory();

      expect(history).toHaveLength(1);
      expect(history[0].stepId).toBe('step1');
    });

    test('returns copy of history', async () => {
      const executor = new StepExecutor();
      const step = {
        id: 'step1',
        name: 'Test',
        handler: async () => ({}),
      };

      await executor.execute(step);
      const history1 = executor.getHistory();
      const history2 = executor.getHistory();

      expect(history1).not.toBe(history2);
      expect(history1).toEqual(history2);
    });
  });

  describe('StepExecutor Class - getStats', () => {
    test('calculates statistics', async () => {
      const executor = new StepExecutor();
      const steps = [
        { id: 'step1', name: 'Test1', handler: async () => ({}) },
        {
          id: 'step2',
          name: 'Test2',
          handler: async () => {
            throw new Error('Failed');
          },
        },
      ];

      await executor.execute(steps[0]);
      try {
        await executor.execute(steps[1]);
      } catch {
        // Expected
      }

      const stats = executor.getStats();

      expect(stats.total).toBe(2);
      expect(stats.successful).toBe(1);
      expect(stats.failed).toBe(1);
      expect(stats.successRate).toBe(50);
    });

    test('handles empty history', () => {
      const executor = new StepExecutor();
      const stats = executor.getStats();

      expect(stats.total).toBe(0);
      expect(stats.successRate).toBe(0);
      expect(stats.averageDuration).toBe(0);
    });
  });

  describe('StepExecutor Class - clearHistory', () => {
    test('clears execution history', async () => {
      const executor = new StepExecutor();
      const step = {
        id: 'step1',
        name: 'Test',
        handler: async () => ({}),
      };

      await executor.execute(step);
      expect(executor.executionHistory).toHaveLength(1);

      executor.clearHistory();
      expect(executor.executionHistory).toHaveLength(0);
    });
  });
});
