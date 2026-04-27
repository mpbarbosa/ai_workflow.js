/**
 * @fileoverview Tests for CLI Run Command
 * @module test/cli/commands/run.test
 */

import { describe, expect, test } from '@jest/globals';
import {
  createOrchestratorOptions,
  formatWorkflowResult,
  validateRunOptions,
} from '../../../src/cli/commands/run.js';
import type {
  RunCommandOptions,
  RunCommandResult,
  RunOrchestratorOptions,
} from '../../../src/cli/commands/run.js';
import { WORKFLOW_STAGES } from '../../../src/orchestrator/main_orchestrator.js';

interface WorkflowResultInput extends Pick<RunCommandResult, 'duration' | 'results' | 'success'> {
  summary?: RunCommandResult['summary'];
}

function createWorkflowResult(input: WorkflowResultInput): RunCommandResult {
  return input;
}

describe('CLI Run Command - Pure Functions', (): void => {
  describe('validateRunOptions', (): void => {
    test('should validate correct options', (): void => {
      const options: RunCommandOptions = {
        stage: 'quick',
        auto: true,
        config: '.workflow-config.yaml',
      };

      const result = validateRunOptions(options);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    test('should reject invalid stage', (): void => {
      const options: RunCommandOptions = {
        stage: 'invalid-stage',
      };

      const result = validateRunOptions(options);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Invalid stage');
    });

    test('should accept valid stages', (): void => {
      const stages: string[] = ['quick', 'medium', 'full'];

      stages.forEach((stage: string): void => {
        const options: RunCommandOptions = { stage };
        const result = validateRunOptions(options);
        expect(result.isValid).toBe(true);
      });
    });

    test('should reject non-string config path', (): void => {
      const options: RunCommandOptions = {
        config: 123,
      };

      const result = validateRunOptions(options);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Config path must be a string');
    });
  });

  describe('createOrchestratorOptions', (): void => {
    test('should create orchestrator options from CLI options', (): void => {
      const cliOptions: RunCommandOptions = {
        stage: 'quick',
        auto: true,
        dryRun: false,
        workflowDir: '.test_workflow',
        projectRoot: '/test/project',
      };

      const result: RunOrchestratorOptions = createOrchestratorOptions(cliOptions);

      expect(result.workflowDir).toBe('.test_workflow');
      expect(result.projectRoot).toBe('/test/project');
      expect(result.stage).toBe('quick');
      expect(result.auto).toBe(true);
      expect(result.dryRun).toBe(false);
    });

    test('should use defaults for missing options', (): void => {
      const result: RunOrchestratorOptions = createOrchestratorOptions({});

      expect(result.workflowDir).toBe('.ai_workflow');
      expect(result.projectRoot).toBe(process.cwd());
      expect(result.stage).toBe(WORKFLOW_STAGES.FULL);
      expect(result.auto).toBe(false);
      expect(result.dryRun).toBe(false);
    });

    test('should handle custom project root path', (): void => {
      const cliOptions: RunCommandOptions = {
        projectRoot: '/home/user/my-project',
      };

      const result: RunOrchestratorOptions = createOrchestratorOptions(cliOptions);

      expect(result.projectRoot).toBe('/home/user/my-project');
      expect(result.workflowDir).toBe('.ai_workflow');
    });

    test('should handle custom workflow directory', (): void => {
      const cliOptions: RunCommandOptions = {
        workflowDir: '.custom_ai_workflow',
      };

      const result: RunOrchestratorOptions = createOrchestratorOptions(cliOptions);

      expect(result.workflowDir).toBe('.custom_ai_workflow');
      expect(result.projectRoot).toBe(process.cwd());
    });

    test('should handle both custom project root and workflow dir', (): void => {
      const cliOptions: RunCommandOptions = {
        projectRoot: '/path/to/project',
        workflowDir: '.custom_workflow',
      };

      const result: RunOrchestratorOptions = createOrchestratorOptions(cliOptions);

      expect(result.projectRoot).toBe('/path/to/project');
      expect(result.workflowDir).toBe('.custom_workflow');
    });

    test('should handle relative project root paths', (): void => {
      const cliOptions: RunCommandOptions = {
        projectRoot: './my-project',
      };

      const result: RunOrchestratorOptions = createOrchestratorOptions(cliOptions);

      expect(result.projectRoot).toBe('./my-project');
    });

    test('should handle absolute workflow directory paths', (): void => {
      const cliOptions: RunCommandOptions = {
        workflowDir: '/tmp/workflow_artifacts',
      };

      const result: RunOrchestratorOptions = createOrchestratorOptions(cliOptions);

      expect(result.workflowDir).toBe('/tmp/workflow_artifacts');
    });
  });

  describe('formatWorkflowResult', (): void => {
    test('should format successful result', (): void => {
      const result: RunCommandResult = createWorkflowResult({
        success: true,
        duration: 5432,
        results: {
          summary: {
            succeeded: 10,
            total: 10,
          },
        },
      });

      const formatted = formatWorkflowResult(result);

      expect(formatted).toContain('completed successfully');
      expect(formatted).toContain('10/10');
      expect(formatted).toContain('5s');
    });

    test('should format failed result', (): void => {
      const result: RunCommandResult = createWorkflowResult({
        success: false,
        duration: 3210,
        results: {
          summary: {
            failed: 2,
            total: 10,
          },
        },
      });

      const formatted = formatWorkflowResult(result);

      expect(formatted).toContain('failed');
      expect(formatted).toContain('2 error');
      expect(formatted).toContain('3s');
    });

    test('should handle null result', (): void => {
      const formatted = formatWorkflowResult(null);

      expect(formatted).toBe('No result available');
    });

    test('should handle result without summary', (): void => {
      const result: RunCommandResult = createWorkflowResult({
        success: true,
        duration: 1000,
        results: {},
      });

      const formatted = formatWorkflowResult(result);

      expect(formatted).toContain('completed successfully');
      expect(formatted).toContain('0/0');
    });
  });

  describe('validateRunOptions - alternatives', (): void => {
    test('accepts --alternatives absent (false)', (): void => {
      const options: RunCommandOptions = { alternatives: false };
      const result = validateRunOptions(options);
      expect(result.isValid).toBe(true);
    });

    test('accepts --alternatives bare flag (true)', (): void => {
      const options: RunCommandOptions = { alternatives: true };
      const result = validateRunOptions(options);
      expect(result.isValid).toBe(true);
    });

    test('accepts --alternatives with numeric string', (): void => {
      const options: RunCommandOptions = { alternatives: '3' };
      const result = validateRunOptions(options);
      expect(result.isValid).toBe(true);
    });

    test('rejects --alternatives with value less than 2', (): void => {
      const options: RunCommandOptions = { alternatives: '1' };
      const result = validateRunOptions(options);
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toMatch(/at least 2/);
    });
  });

  describe('createOrchestratorOptions - alternatives', (): void => {
    test('alternatives is false when flag absent', (): void => {
      const result: RunOrchestratorOptions = createOrchestratorOptions({});
      expect(result.alternatives).toBe(false);
    });

    test('alternatives defaults to 2 when bare flag passed', (): void => {
      const options: RunCommandOptions = { alternatives: true };
      const result: RunOrchestratorOptions = createOrchestratorOptions(options);
      expect(result.alternatives).toBe(2);
    });

    test('alternatives coerced to integer from string', (): void => {
      const options: RunCommandOptions = { alternatives: '4' };
      const result: RunOrchestratorOptions = createOrchestratorOptions(options);
      expect(result.alternatives).toBe(4);
    });

    test('alternatives clamped to minimum 2 for values below threshold', (): void => {
      const options: RunCommandOptions = { alternatives: '1' };
      const result: RunOrchestratorOptions = createOrchestratorOptions(options);
      expect(result.alternatives).toBe(2);
    });
  });
});
