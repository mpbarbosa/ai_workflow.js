/**
 * @fileoverview Tests for CLI Init Command
 * @module test/cli/commands/init.test
 */

import { describe, test, expect } from '@jest/globals';
import {
  getProjectTemplates,
  generateConfigTemplate,
  validateInitOptions,
} from '../../../src/cli/commands/init.js';

describe('Init Command - Pure Functions', () => {
  describe('getProjectTemplates', () => {
    test('should return list of templates', () => {
      const templates = getProjectTemplates();
      expect(Array.isArray(templates)).toBe(true);
      expect(templates.length).toBeGreaterThan(0);
    });

    test('should have nodejs_api template', () => {
      const templates = getProjectTemplates();
      const nodejs = templates.find((t) => t.name === 'nodejs_api');
      expect(nodejs).toBeDefined();
      expect(nodejs.description).toContain('Node.js');
    });

    test('should have generic template', () => {
      const templates = getProjectTemplates();
      const generic = templates.find((t) => t.name === 'generic');
      expect(generic).toBeDefined();
    });
  });

  describe('generateConfigTemplate', () => {
    test('should generate config with all fields', () => {
      const answers = {
        projectName: 'MyProject',
        projectKind: 'nodejs_api',
        primaryLanguage: 'javascript',
        description: 'My awesome project',
      };

      const config = generateConfigTemplate(answers);
      expect(config.project.name).toBe('MyProject');
      expect(config.project.kind).toBe('nodejs_api');
      expect(config.project.primary_language).toBe('javascript');
      expect(config.project.description).toBe('My awesome project');
    });

    test('should generate default description if not provided', () => {
      const answers = {
        projectName: 'MyProject',
        projectKind: 'react_spa',
        primaryLanguage: 'typescript',
      };

      const config = generateConfigTemplate(answers);
      expect(config.project.description).toBe('MyProject project');
    });

    test('should include workflow stages', () => {
      const answers = {
        projectName: 'Test',
        projectKind: 'generic',
        primaryLanguage: 'javascript',
      };

      const config = generateConfigTemplate(answers);
      expect(config.workflow.stages.quick).toBeDefined();
      expect(config.workflow.stages.medium).toBeDefined();
      expect(config.workflow.stages.full).toBeDefined();
    });

    test('should include validation settings', () => {
      const answers = {
        projectName: 'Test',
        projectKind: 'generic',
        primaryLanguage: 'javascript',
      };

      const config = generateConfigTemplate(answers);
      expect(config.validation.documentation).toBeDefined();
      expect(config.validation.testing).toBeDefined();
    });
  });

  describe('validateInitOptions', () => {
    test('should be valid without template', () => {
      const result = validateInitOptions({});
      expect(result.isValid).toBe(true);
    });

    test('should be valid with valid template', () => {
      const result = validateInitOptions({ template: 'nodejs_api' });
      expect(result.isValid).toBe(true);
    });

    test('should be invalid with invalid template', () => {
      const result = validateInitOptions({ template: 'invalid_template' });
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('Invalid template: invalid_template');
    });
  });
});
