/**
 * @fileoverview Tests for CLI Help Utilities
 * @module test/cli/help.test
 */

import { describe, test, expect } from '@jest/globals';
import {
  getCommandExamples,
  getCommonUseCases,
  getWorkflowStages,
  getConfigOptions,
  formatExample,
  formatUseCase,
} from '../../src/cli/help.js';

describe('CLI Help - Pure Functions', () => {
  describe('getCommandExamples', () => {
    test('should return examples for run command', () => {
      const examples = getCommandExamples('run');
      expect(examples.length).toBeGreaterThan(0);
      expect(examples[0]).toHaveProperty('description');
      expect(examples[0]).toHaveProperty('command');
    });

    test('should return examples for all commands', () => {
      const commands = ['run', 'resume', 'status', 'init', 'config', 'clean'];
      commands.forEach((cmd) => {
        const examples = getCommandExamples(cmd);
        expect(examples.length).toBeGreaterThan(0);
      });
    });

    test('should return empty array for unknown command', () => {
      const examples = getCommandExamples('unknown');
      expect(examples).toEqual([]);
    });
  });

  describe('getCommonUseCases', () => {
    test('should return use cases', () => {
      const useCases = getCommonUseCases();
      expect(useCases.length).toBeGreaterThan(0);
      expect(useCases[0]).toHaveProperty('title');
      expect(useCases[0]).toHaveProperty('description');
      expect(useCases[0]).toHaveProperty('steps');
    });

    test('should include Quick Validation use case', () => {
      const useCases = getCommonUseCases();
      const quickValidation = useCases.find((uc) => uc.title === 'Quick Validation');
      expect(quickValidation).toBeDefined();
      expect(quickValidation.steps).toBeInstanceOf(Array);
    });
  });

  describe('getWorkflowStages', () => {
    test('should return all stages', () => {
      const stages = getWorkflowStages();
      expect(stages).toHaveProperty('quick');
      expect(stages).toHaveProperty('medium');
      expect(stages).toHaveProperty('full');
    });

    test('should include stage details', () => {
      const stages = getWorkflowStages();
      const quick = stages.quick;
      expect(quick).toHaveProperty('name');
      expect(quick).toHaveProperty('description');
      expect(quick).toHaveProperty('steps');
      expect(quick).toHaveProperty('duration');
      expect(quick).toHaveProperty('includes');
    });
  });

  describe('getConfigOptions', () => {
    test('should return config options', () => {
      const options = getConfigOptions();
      expect(options.length).toBeGreaterThan(0);
      expect(options[0]).toHaveProperty('key');
      expect(options[0]).toHaveProperty('type');
      expect(options[0]).toHaveProperty('required');
      expect(options[0]).toHaveProperty('description');
    });

    test('should include project.name option', () => {
      const options = getConfigOptions();
      const projectName = options.find((opt) => opt.key === 'project.name');
      expect(projectName).toBeDefined();
      expect(projectName.required).toBe(true);
    });
  });

  describe('formatExample', () => {
    test('should format example', () => {
      const example = {
        description: 'Run full workflow',
        command: 'ai-workflow run',
      };
      const formatted = formatExample(example);
      expect(formatted).toContain('Run full workflow');
      expect(formatted).toContain('ai-workflow run');
    });
  });

  describe('formatUseCase', () => {
    test('should format use case', () => {
      const useCase = {
        title: 'Quick Validation',
        description: 'Run a quick check',
        steps: ['Step 1', 'Step 2'],
      };
      const formatted = formatUseCase(useCase);
      expect(formatted).toContain('Quick Validation');
      expect(formatted).toContain('Run a quick check');
      expect(formatted).toContain('Step 1');
      expect(formatted).toContain('Step 2');
    });
  });
});
