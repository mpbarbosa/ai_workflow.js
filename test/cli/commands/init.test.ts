/**
 * @fileoverview Tests for CLI Init Command
 * @module test/cli/commands/init.test
 */

import { describe, test, expect } from '@jest/globals';
import {
  getProjectTemplates,
  generateConfigTemplate,
  validateInitOptions,
  generateTechStackDefaults,
  generateStructureDefaults,
  formatConfigPreview,
} from '../../../src/cli/commands/init.js';
import type {
  InitAnswers,
  InitCommandOptions,
  ProjectTemplate,
  WorkflowConfig,
} from '../../../src/cli/commands/init.js';

interface InitAnswersInput
  extends Pick<InitAnswers, 'projectName' | 'projectKind' | 'primaryLanguage'> {
  description?: string;
  buildSystem?: string;
  testFramework?: string | null;
  testCommand?: string;
  lintCommand?: string;
  sourceDirs?: string[];
  testDirs?: string[];
  docsDirs?: string[];
}

function createInitAnswers(input: InitAnswersInput): InitAnswers {
  return input as InitAnswers;
}

function findTemplateByName(
  templates: ProjectTemplate[],
  templateName: ProjectTemplate['name']
): ProjectTemplate | undefined {
  return templates.find((template: ProjectTemplate): boolean => template.name === templateName);
}

describe('Init Command - Pure Functions', (): void => {
  describe('getProjectTemplates', (): void => {
    test('should return list of templates', (): void => {
      const templates = getProjectTemplates();
      expect(Array.isArray(templates)).toBe(true);
      expect(templates.length).toBeGreaterThan(0);
    });

    test('should have nodejs_api template', (): void => {
      const templates = getProjectTemplates();
      const nodejs = findTemplateByName(templates, 'nodejs_api');
      expect(nodejs).toBeDefined();
      expect(nodejs?.description).toContain('Node.js');
    });

    test('should have generic template', (): void => {
      const templates = getProjectTemplates();
      const generic = findTemplateByName(templates, 'generic');
      expect(generic).toBeDefined();
    });
  });

  describe('generateTechStackDefaults', (): void => {
    test('should return defaults for javascript', (): void => {
      const defaults = generateTechStackDefaults('javascript');
      expect(defaults.build_system).toBe('npm');
      expect(defaults.test_framework).toBe('jest');
      expect(defaults.test_command).toBe('npm test');
      expect(defaults.lint_command).toBeDefined();
    });

    test('should return defaults for python', (): void => {
      const defaults = generateTechStackDefaults('python');
      expect(defaults.build_system).toBe('pip');
      expect(defaults.test_framework).toBe('pytest');
      expect(defaults.test_command).toBe('pytest');
    });

    test('should return defaults for go', (): void => {
      const defaults = generateTechStackDefaults('go');
      expect(defaults.test_command).toContain('go test');
    });

    test('should return defaults for bash', (): void => {
      const defaults = generateTechStackDefaults('bash');
      expect(defaults.test_framework).toBe('bats');
    });

    test('should return fallback defaults for unknown language', (): void => {
      const defaults = generateTechStackDefaults('cobol');
      expect(defaults.build_system).toBe('none');
      expect(defaults.test_framework).toBeNull();
    });
  });

  describe('generateStructureDefaults', (): void => {
    test('should return structure defaults for javascript', (): void => {
      const structure = generateStructureDefaults('javascript');
      expect(structure.source_dirs).toContain('src');
      expect(Array.isArray(structure.test_dirs)).toBe(true);
      expect(Array.isArray(structure.docs_dirs)).toBe(true);
    });

    test('should return structure defaults for python', (): void => {
      const structure = generateStructureDefaults('python');
      expect(structure.source_dirs).toContain('src');
      expect(structure.test_dirs).toContain('tests');
    });

    test('should return structure defaults for java', (): void => {
      const structure = generateStructureDefaults('java');
      expect(structure.source_dirs).toContain('src/main/java');
      expect(structure.test_dirs).toContain('src/test/java');
    });

    test('should return fallback defaults for unknown language', (): void => {
      const structure = generateStructureDefaults('cobol');
      expect(structure.source_dirs).toContain('src');
      expect(structure.test_dirs).toContain('tests');
    });
  });

  describe('formatConfigPreview', (): void => {
    test('should return YAML string', (): void => {
      const config: WorkflowConfig = generateConfigTemplate(
        createInitAnswers({
          projectName: 'test',
          projectKind: 'generic',
          primaryLanguage: 'javascript',
          description: 'test',
        })
      );
      const preview = formatConfigPreview(config);
      expect(typeof preview).toBe('string');
      expect(preview).toContain('project:');
      expect(preview).toContain('test');
    });

    test('should handle complex objects', (): void => {
      const config: WorkflowConfig = generateConfigTemplate(
        createInitAnswers({
          projectName: 'my-project',
          projectKind: 'nodejs_api',
          primaryLanguage: 'javascript',
          description: 'My project',
          buildSystem: 'npm',
          testFramework: 'jest',
          testCommand: 'npm test',
          sourceDirs: ['src'],
          testDirs: ['test'],
          docsDirs: ['docs'],
        })
      );
      const preview = formatConfigPreview(config);
      expect(preview).toContain('tech_stack:');
      expect(preview).toContain('structure:');
    });
  });

  describe('generateConfigTemplate', (): void => {
    test('should generate config with all base fields', (): void => {
      const answers = createInitAnswers({
        projectName: 'MyProject',
        projectKind: 'nodejs_api',
        primaryLanguage: 'javascript',
        description: 'My awesome project',
      });

      const config = generateConfigTemplate(answers);
      expect(config.project.name).toBe('MyProject');
      expect(config.project.kind).toBe('nodejs_api');
      expect(config.project.primary_language).toBe('javascript');
      expect(config.project.description).toBe('My awesome project');
    });

    test('should include tech_stack section', (): void => {
      const answers = createInitAnswers({
        projectName: 'MyProject',
        projectKind: 'nodejs_api',
        primaryLanguage: 'javascript',
        buildSystem: 'npm',
        testFramework: 'jest',
        testCommand: 'npm test',
        lintCommand: 'npm run lint',
      });

      const config = generateConfigTemplate(answers);
      expect(config.tech_stack).toBeDefined();
      expect(config.tech_stack.build_system).toBe('npm');
      expect(config.tech_stack.test_command).toBe('npm test');
      expect(config.tech_stack.lint_command).toBe('npm run lint');
    });

    test('should omit lint_command from tech_stack when not provided', (): void => {
      const answers = createInitAnswers({
        projectName: 'MyProject',
        projectKind: 'generic',
        primaryLanguage: 'javascript',
        lintCommand: '',
      });

      const config = generateConfigTemplate(answers);
      expect(config.tech_stack.lint_command).toBeUndefined();
    });

    test('should include structure section', (): void => {
      const answers = createInitAnswers({
        projectName: 'MyProject',
        projectKind: 'nodejs_api',
        primaryLanguage: 'javascript',
        sourceDirs: ['src', 'lib'],
        testDirs: ['test'],
        docsDirs: ['docs'],
      });

      const config = generateConfigTemplate(answers);
      expect(config.structure).toBeDefined();
      expect(config.structure.source_dirs).toEqual(['src', 'lib']);
      expect(config.structure.test_dirs).toEqual(['test']);
      expect(config.structure.docs_dirs).toEqual(['docs']);
    });

    test('should use language defaults for structure when not provided', (): void => {
      const answers = createInitAnswers({
        projectName: 'MyProject',
        projectKind: 'python_app',
        primaryLanguage: 'python',
      });

      const config = generateConfigTemplate(answers);
      expect(config.structure.source_dirs).toContain('src');
      expect(config.structure.test_dirs).toContain('tests');
    });

    test('should generate default description if not provided', (): void => {
      const answers = createInitAnswers({
        projectName: 'MyProject',
        projectKind: 'react_spa',
        primaryLanguage: 'typescript',
      });

      const config = generateConfigTemplate(answers);
      expect(config.project.description).toBe('MyProject project');
    });

    test('should include workflow stages', (): void => {
      const answers = createInitAnswers({
        projectName: 'Test',
        projectKind: 'generic',
        primaryLanguage: 'javascript',
      });

      const config = generateConfigTemplate(answers);
      expect(config.workflow.stages.quick).toBeDefined();
      expect(config.workflow.stages.medium).toBeDefined();
      expect(config.workflow.stages.full).toBeDefined();
    });

    test('should include validation settings', (): void => {
      const answers = createInitAnswers({
        projectName: 'Test',
        projectKind: 'generic',
        primaryLanguage: 'javascript',
      });

      const config = generateConfigTemplate(answers);
      expect(config.validation.documentation).toBeDefined();
      expect(config.validation.testing).toBeDefined();
    });
  });

  describe('validateInitOptions', (): void => {
    test('should be valid without template', (): void => {
      const options: InitCommandOptions = {};
      const result = validateInitOptions(options);
      expect(result.isValid).toBe(true);
    });

    test('should be valid with valid template', (): void => {
      const options: InitCommandOptions = { template: 'nodejs_api' };
      const result = validateInitOptions(options);
      expect(result.isValid).toBe(true);
    });

    test('should be invalid with invalid template', (): void => {
      const options: InitCommandOptions = { template: 'invalid_template' };
      const result = validateInitOptions(options);
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('Invalid template: invalid_template');
    });
  });
});
