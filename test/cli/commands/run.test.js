/**
 * @fileoverview Tests for CLI Run Command
 * @module test/cli/commands/run
 */

import {
  validateRunOptions,
  createOrchestratorOptions,
  formatWorkflowResult,
} from '../../../src/cli/commands/run.js';
import { WORKFLOW_STAGES } from '../../../src/orchestrator/main_orchestrator.js';

describe('CLI Run Command - Pure Functions', () => {
  describe('validateRunOptions', () => {
    test('should validate correct options', () => {
      const options = {
        stage: 'quick',
        auto: true,
        config: '.workflow-config.yaml',
      };

      const result = validateRunOptions(options);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    test('should reject invalid stage', () => {
      const options = {
        stage: 'invalid-stage',
      };

      const result = validateRunOptions(options);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Invalid stage');
    });

    test('should accept valid stages', () => {
      const stages = ['quick', 'medium', 'full'];

      stages.forEach((stage) => {
        const result = validateRunOptions({ stage });
        expect(result.isValid).toBe(true);
      });
    });

    test('should reject non-string config path', () => {
      const options = {
        config: 123,
      };

      const result = validateRunOptions(options);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Config path must be a string');
    });
  });

  describe('createOrchestratorOptions', () => {
    test('should create orchestrator options from CLI options', () => {
      const cliOptions = {
        stage: 'quick',
        auto: true,
        dryRun: false,
        workflowDir: '.test_workflow',
        projectRoot: '/test/project',
      };

      const result = createOrchestratorOptions(cliOptions);

      expect(result.workflowDir).toBe('.test_workflow');
      expect(result.projectRoot).toBe('/test/project');
      expect(result.stage).toBe('quick');
      expect(result.auto).toBe(true);
      expect(result.dryRun).toBe(false);
    });

    test('should use defaults for missing options', () => {
      const result = createOrchestratorOptions({});

      expect(result.workflowDir).toBe('.ai_workflow');
      expect(result.projectRoot).toBe(process.cwd());
      expect(result.stage).toBe(WORKFLOW_STAGES.FULL);
      expect(result.auto).toBe(false);
      expect(result.dryRun).toBe(false);
    });

    test('should handle custom project root path', () => {
      const cliOptions = {
        projectRoot: '/home/user/my-project',
      };

      const result = createOrchestratorOptions(cliOptions);

      expect(result.projectRoot).toBe('/home/user/my-project');
      expect(result.workflowDir).toBe('.ai_workflow'); // Uses default
    });

    test('should handle custom workflow directory', () => {
      const cliOptions = {
        workflowDir: '.custom_ai_workflow',
      };

      const result = createOrchestratorOptions(cliOptions);

      expect(result.workflowDir).toBe('.custom_ai_workflow');
      expect(result.projectRoot).toBe(process.cwd()); // Uses default
    });

    test('should handle both custom project root and workflow dir', () => {
      const cliOptions = {
        projectRoot: '/path/to/project',
        workflowDir: '.custom_workflow',
      };

      const result = createOrchestratorOptions(cliOptions);

      expect(result.projectRoot).toBe('/path/to/project');
      expect(result.workflowDir).toBe('.custom_workflow');
    });

    test('should handle relative project root paths', () => {
      const cliOptions = {
        projectRoot: './my-project',
      };

      const result = createOrchestratorOptions(cliOptions);

      expect(result.projectRoot).toBe('./my-project');
    });

    test('should handle absolute workflow directory paths', () => {
      const cliOptions = {
        workflowDir: '/tmp/workflow_artifacts',
      };

      const result = createOrchestratorOptions(cliOptions);

      expect(result.workflowDir).toBe('/tmp/workflow_artifacts');
    });
  });

  describe('formatWorkflowResult', () => {
    test('should format successful result', () => {
      const result = {
        success: true,
        duration: 5432,
        results: {
          summary: {
            succeeded: 10,
            total: 10,
          },
        },
      };

      const formatted = formatWorkflowResult(result);

      expect(formatted).toContain('completed successfully');
      expect(formatted).toContain('10/10');
      expect(formatted).toContain('5s');
    });

    test('should format failed result', () => {
      const result = {
        success: false,
        duration: 3210,
        results: {
          summary: {
            failed: 2,
            total: 10,
          },
        },
      };

      const formatted = formatWorkflowResult(result);

      expect(formatted).toContain('failed');
      expect(formatted).toContain('2 error');
      expect(formatted).toContain('3s');
    });

    test('should handle null result', () => {
      const formatted = formatWorkflowResult(null);

      expect(formatted).toBe('No result available');
    });

    test('should handle result without summary', () => {
      const result = {
        success: true,
        duration: 1000,
        results: {},
      };

      const formatted = formatWorkflowResult(result);

      expect(formatted).toContain('completed successfully');
      expect(formatted).toContain('0/0');
    });
  });
});
