import initModule, {
  getProjectTemplates,
  validateInitOptions,
  generateTechStackDefaults,
  generateStructureDefaults,
  formatConfigPreview,
  generateConfigTemplate,
  initCommand,
  ProjectTemplate,
  InitCommandOptions,
  InitAnswers,
  WorkflowConfig,
} from '../../src/cli/commands/init';

describe('cli/commands/init', () => {
  describe('getProjectTemplates', () => {
    it('should return an array of project templates', () => {
      const templates = getProjectTemplates();
      expect(Array.isArray(templates)).toBe(true);
      templates.forEach((tpl: ProjectTemplate) => {
        expect(typeof tpl.name).toBe('string');
        expect(typeof tpl.description).toBe('string');
      });
    });
  });

  describe('validateInitOptions', () => {
    it('should validate correct options as valid', () => {
      const options: InitCommandOptions = { name: 'my-app', projectRoot: '/tmp', interactive: true };
      const result = validateInitOptions(options);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should return errors for missing required fields', () => {
      const options: InitCommandOptions = {};
      const result = validateInitOptions(options);
      expect(result.isValid).toBe(false);
      expect(Array.isArray(result.errors)).toBe(true);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle invalid types gracefully', () => {
      // @ts-expect-error
      const options: InitCommandOptions = { name: 123, force: 'yes' };
      const result = validateInitOptions(options);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('generateTechStackDefaults', () => {
    it('should return defaults for a known language', () => {
      const defaults = generateTechStackDefaults('javascript');
      expect(defaults).toHaveProperty('build_system');
      expect(defaults).toHaveProperty('test_framework');
      expect(defaults).toHaveProperty('test_command');
      expect(defaults).toHaveProperty('lint_command');
    });

    it('should handle unknown language gracefully', () => {
      const defaults = generateTechStackDefaults('unknownlang');
      expect(defaults).toHaveProperty('build_system');
      expect(defaults).toHaveProperty('test_framework');
      expect(defaults).toHaveProperty('test_command');
      expect(defaults).toHaveProperty('lint_command');
    });
  });

  describe('generateStructureDefaults', () => {
    it('should return structure defaults for a known language', () => {
      const structure = generateStructureDefaults('typescript');
      expect(Array.isArray(structure.source_dirs)).toBe(true);
      expect(Array.isArray(structure.test_dirs)).toBe(true);
      expect(Array.isArray(structure.docs_dirs)).toBe(true);
    });

    it('should handle unknown language gracefully', () => {
      const structure = generateStructureDefaults('foo');
      expect(Array.isArray(structure.source_dirs)).toBe(true);
      expect(Array.isArray(structure.test_dirs)).toBe(true);
      expect(Array.isArray(structure.docs_dirs)).toBe(true);
    });
  });

  describe('formatConfigPreview', () => {
    it('should return a YAML string for a valid config', () => {
      const config: WorkflowConfig = generateConfigTemplate({
        projectName: 'TestApp',
        projectKind: 'library',
        primaryLanguage: 'javascript',
        description: 'A test app',
        buildSystem: 'npm',
        testFramework: 'jest',
        testCommand: 'npm test',
        lintCommand: 'npm run lint',
        sourceDirs: ['src'],
        testDirs: ['test'],
        docsDirs: ['docs'],
      });
      const yaml = formatConfigPreview(config);
      expect(typeof yaml).toBe('string');
      expect(yaml).toMatch(/project:/);
      expect(yaml).toMatch(/tech_stack:/);
    });

    it('should handle empty config gracefully', () => {
      // @ts-expect-error
      const yaml = formatConfigPreview({});
      expect(typeof yaml).toBe('string');
    });
  });

  describe('generateConfigTemplate', () => {
    it('should generate a valid WorkflowConfig from answers', () => {
      const answers: InitAnswers = {
        projectName: 'MyProject',
        projectKind: 'app',
        primaryLanguage: 'typescript',
        description: 'desc',
        buildSystem: 'tsc',
        testFramework: 'jest',
        testCommand: 'npm test',
        lintCommand: 'npm run lint',
        sourceDirs: ['src'],
        testDirs: ['test'],
        docsDirs: ['docs'],
      };
      const config = generateConfigTemplate(answers);
      expect(config).toHaveProperty('project');
      expect(config).toHaveProperty('tech_stack');
      expect(config).toHaveProperty('structure');
      expect(config).toHaveProperty('workflow');
      expect(config).toHaveProperty('validation');
    });

    it('should handle missing optional fields', () => {
      const answers: InitAnswers = {
        projectName: 'MyProject',
        projectKind: 'app',
        primaryLanguage: 'typescript',
        description: 'desc',
        buildSystem: 'tsc',
        testFramework: null,
        testCommand: '',
        lintCommand: '',
        sourceDirs: [],
        testDirs: [],
        docsDirs: [],
      };
      const config = generateConfigTemplate(answers);
      expect(config).toBeDefined();
    });
  });

  describe('initCommand', () => {
    it('should resolve without error for valid options', async () => {
      const options: InitCommandOptions = {
        name: 'my-app',
        projectRoot: '/tmp',
        interactive: false,
        force: true,
        quiet: true,
      };
      await expect(initCommand(options)).resolves.toBeUndefined();
    });

    it('should reject or throw for invalid options', async () => {
      // @ts-expect-error
      const options: InitCommandOptions = { name: '' };
      await expect(initCommand(options)).rejects.toBeDefined();
    });

    it('should handle missing options gracefully', async () => {
      // @ts-expect-error
      await expect(initCommand()).rejects.toBeDefined();
    });
  });
});
