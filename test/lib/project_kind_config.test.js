import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import {
  MANDATORY_CODE_GUIDE_FILES,
  parseYaml,
  extractProjectKindConfig,
  mergeConfigurations,
  validateProjectStructure,
  hasCodeFiles,
  extractConfigSection,
  ProjectKindConfigManager,
} from '../../src/lib/project_kind_config.js';

// ============================================================================
// PURE FUNCTION TESTS
// ============================================================================

describe('Project Kind Configuration - Pure Functions', () => {
  describe('parseYaml', () => {
    it('should parse valid YAML', () => {
      const yaml = 'name: Test\nvalue: 42';
      const result = parseYaml(yaml);

      expect(result).toEqual({ name: 'Test', value: 42 });
    });

    it('should parse nested YAML', () => {
      const yaml = 'parent:\n  child: value\n  count: 3';
      const result = parseYaml(yaml);

      expect(result).toEqual({ parent: { child: 'value', count: 3 } });
    });

    it('should return null for invalid YAML', () => {
      const yaml = 'invalid: [\n  unclosed';
      const result = parseYaml(yaml);

      expect(result).toBeNull();
    });

    it('should return null for null input', () => {
      expect(parseYaml(null)).toBeNull();
    });

    it('should return null for non-string input', () => {
      expect(parseYaml(123)).toBeNull();
    });
  });

  describe('extractProjectKindConfig', () => {
    const mockParsedYaml = {
      project_kinds: {
        nodejs_api: {
          name: 'Node.js API',
          validation: { required_files: ['package.json'] },
        },
        python_app: {
          name: 'Python App',
          validation: { required_files: ['requirements.txt'] },
        },
      },
    };

    it('should extract nodejs_api config', () => {
      const result = extractProjectKindConfig(mockParsedYaml, 'nodejs_api');

      expect(result).toEqual({
        name: 'Node.js API',
        validation: { required_files: ['package.json'] },
      });
    });

    it('should extract python_app config', () => {
      const result = extractProjectKindConfig(mockParsedYaml, 'python_app');

      expect(result).toEqual({
        name: 'Python App',
        validation: { required_files: ['requirements.txt'] },
      });
    });

    it('should return null for non-existent project kind', () => {
      const result = extractProjectKindConfig(mockParsedYaml, 'unknown_kind');

      expect(result).toBeNull();
    });

    it('should return null for null parsed YAML', () => {
      const result = extractProjectKindConfig(null, 'nodejs_api');

      expect(result).toBeNull();
    });

    it('should return null for invalid project kind', () => {
      const result = extractProjectKindConfig(mockParsedYaml, null);

      expect(result).toBeNull();
    });
  });

  describe('mergeConfigurations', () => {
    it('should merge flat configurations', () => {
      const base = { a: 1, b: 2 };
      const overrides = { b: 3, c: 4 };

      const result = mergeConfigurations(base, overrides);

      expect(result).toEqual({ a: 1, b: 3, c: 4 });
    });

    it('should deep merge nested objects', () => {
      const base = {
        testing: { framework: 'jest', coverage: 80 },
        quality: { linters: ['eslint'] },
      };
      const overrides = {
        testing: { coverage: 90 },
        deployment: { type: 'docker' },
      };

      const result = mergeConfigurations(base, overrides);

      expect(result).toEqual({
        testing: { framework: 'jest', coverage: 90 },
        quality: { linters: ['eslint'] },
        deployment: { type: 'docker' },
      });
    });

    it('should override arrays completely', () => {
      const base = { items: [1, 2, 3] };
      const overrides = { items: [4, 5] };

      const result = mergeConfigurations(base, overrides);

      expect(result).toEqual({ items: [4, 5] });
    });

    it('should skip null/undefined overrides', () => {
      const base = { a: 1, b: 2 };
      const overrides = { b: null, c: undefined };

      const result = mergeConfigurations(base, overrides);

      expect(result).toEqual({ a: 1, b: 2 });
    });

    it('should return base when no overrides', () => {
      const base = { a: 1, b: 2 };

      const result = mergeConfigurations(base, null);

      expect(result).toEqual({ a: 1, b: 2 });
    });

    it('should return overrides when no base', () => {
      const overrides = { a: 1, b: 2 };

      const result = mergeConfigurations(null, overrides);

      expect(result).toEqual({ a: 1, b: 2 });
    });
  });

  describe('validateProjectStructure', () => {
    it('should validate project with all required files', () => {
      const files = ['package.json', 'README.md', 'index.js', ...MANDATORY_CODE_GUIDE_FILES];
      const dirs = ['src', 'tests'];
      const rules = {
        required_files: ['package.json', 'README.md'],
        required_directories: ['src', 'tests'],
      };

      const result = validateProjectStructure(files, dirs, rules);

      expect(result.valid).toBe(true);
      expect(result.missingFiles).toEqual([]);
      expect(result.missingDirs).toEqual([]);
    });

    it('should detect missing required files', () => {
      const files = ['index.js'];
      const dirs = ['src'];
      const rules = {
        required_files: ['package.json', 'README.md'],
        required_directories: ['src'],
      };

      const result = validateProjectStructure(files, dirs, rules);

      expect(result.valid).toBe(false);
      expect(result.missingFiles).toEqual([
        '.github/HIGH_COHESION_GUIDE.md',
        '.github/LOW_COUPLING_GUIDE.md',
        'package.json',
        'README.md',
      ]);
    });

    it('should detect missing required directories', () => {
      const files = ['package.json'];
      const dirs = [];
      const rules = {
        required_files: ['package.json'],
        required_directories: ['src', 'tests'],
      };

      const result = validateProjectStructure(files, dirs, rules);

      expect(result.valid).toBe(false);
      expect(result.missingDirs).toEqual(['src', 'tests']);
    });

    it('should validate file patterns', () => {
      const files = ['script1.sh', 'script2.sh', 'README.md', ...MANDATORY_CODE_GUIDE_FILES];
      const dirs = ['src'];
      const rules = {
        required_files: ['*.sh'],
        required_directories: ['src'],
      };

      const result = validateProjectStructure(files, dirs, rules);

      expect(result.valid).toBe(true);
    });

    it('should detect missing file patterns', () => {
      const files = ['README.md'];
      const dirs = ['src'];
      const rules = {
        required_files: ['*.sh'],
        required_directories: ['src'],
      };

      const result = validateProjectStructure(files, dirs, rules);

      expect(result.valid).toBe(false);
      expect(result.missingFiles).toEqual(['*.sh']);
    });

    it('should require cohesion guides even when validation rules are null', () => {
      const result = validateProjectStructure(['file.js'], ['src'], null);

      expect(result.valid).toBe(false);
      expect(result.missingFiles).toEqual(MANDATORY_CODE_GUIDE_FILES);
    });

    it('should handle empty validation rules and still require mandatory guides for code', () => {
      const result = validateProjectStructure(['file.js'], ['src'], {});

      expect(result.valid).toBe(false);
      expect(result.missingFiles).toEqual(MANDATORY_CODE_GUIDE_FILES);
    });

    it('should not require cohesion guides for projects without code files', () => {
      const result = validateProjectStructure(['README.md'], ['docs'], {});

      expect(result.valid).toBe(true);
      expect(result.missingFiles).toEqual([]);
    });
  });

  describe('hasCodeFiles', () => {
    it('detects projects with code files', () => {
      expect(hasCodeFiles(['README.md', 'src/index.js'])).toBe(true);
    });

    it('ignores projects without code files', () => {
      expect(hasCodeFiles(['README.md', 'docs/ARCHITECTURE.md'])).toBe(false);
    });
  });

  describe('extractConfigSection', () => {
    const config = {
      testing: { framework: 'jest', coverage: 80 },
      quality: { linters: ['eslint'] },
      build: { required: true },
    };

    it('should extract testing section', () => {
      const result = extractConfigSection(config, 'testing');

      expect(result).toEqual({ framework: 'jest', coverage: 80 });
    });

    it('should extract quality section', () => {
      const result = extractConfigSection(config, 'quality');

      expect(result).toEqual({ linters: ['eslint'] });
    });

    it('should return null for non-existent section', () => {
      const result = extractConfigSection(config, 'deployment');

      expect(result).toBeNull();
    });

    it('should return null for null config', () => {
      const result = extractConfigSection(null, 'testing');

      expect(result).toBeNull();
    });

    it('should return null for invalid section name', () => {
      const result = extractConfigSection(config, null);

      expect(result).toBeNull();
    });
  });
});

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

describe('Project Kind Configuration - Integration', () => {
  let tempDir;
  let manager;

  beforeEach(async () => {
    // Create temp directory
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'test-project-kind-config-'));

    // Create mock .workflow_core structure with project_kinds.yaml
    const workflowCoreDir = path.join(tempDir, '.workflow_core');
    const configDir = path.join(workflowCoreDir, 'config');
    await fs.mkdir(configDir, { recursive: true });

    // Create mock project_kinds.yaml
    const mockYaml = `
project_kinds:
  nodejs_api:
    name: "Node.js API"
    validation:
      required_files:
        - "package.json"
      required_directories:
        - "src"
    testing:
      test_framework: "jest"
      test_directory: "test"
      coverage_threshold: 80
    quality:
      linters:
        - name: "eslint"
          enabled: true
      documentation_required: true
    ai_guidance:
      testing_standards:
        - "Write unit tests for all functions"
        - "Use Jest best practices"
    deployment:
      type: "container"
      requires_build: true
  
  shell_script_automation:
    name: "Shell Script Automation"
    validation:
      required_files:
        - "*.sh"
      required_directories:
        - "src"
    testing:
      test_framework: "bash_unit"
      test_directory: "tests"
      coverage_threshold: 0
    quality:
      linters:
        - name: "shellcheck"
          enabled: true
`;

    await fs.writeFile(path.join(configDir, 'project_kinds.yaml'), mockYaml);

    // Initialize manager
    manager = new ProjectKindConfigManager({
      projectRoot: tempDir,
      verbose: false,
    });
  });

  afterEach(async () => {
    // Cleanup temp directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should load nodejs_api configuration', async () => {
    const config = await manager.loadConfig('nodejs_api');

    expect(config).not.toBeNull();
    expect(config.name).toBe('Node.js API');
    expect(config.testing.test_framework).toBe('jest');
  });

  it('should load shell_script_automation configuration', async () => {
    const config = await manager.loadConfig('shell_script_automation');

    expect(config).not.toBeNull();
    expect(config.name).toBe('Shell Script Automation');
    expect(config.testing.test_framework).toBe('bash_unit');
  });

  it('should return null for non-existent project kind', async () => {
    const config = await manager.loadConfig('unknown_kind');

    expect(config).toBeNull();
  });

  it('should cache loaded configurations', async () => {
    const config1 = await manager.loadConfig('nodejs_api');
    const config2 = await manager.loadConfig('nodejs_api');

    expect(config1).toBe(config2); // Same reference = cached
  });

  it('should get validation rules for nodejs_api', async () => {
    const rules = await manager.getValidationRules('nodejs_api');

    expect(rules).not.toBeNull();
    expect(rules.required_files).toContain('package.json');
    expect(rules.required_directories).toContain('src');
  });

  it('should get testing config for nodejs_api', async () => {
    const testing = await manager.getTestingConfig('nodejs_api');

    expect(testing).not.toBeNull();
    expect(testing.test_framework).toBe('jest');
    expect(testing.coverage_threshold).toBe(80);
  });

  it('should get quality standards for nodejs_api', async () => {
    const quality = await manager.getQualityStandards('nodejs_api');

    expect(quality).not.toBeNull();
    expect(quality.linters[0].name).toBe('eslint');
    expect(quality.documentation_required).toBe(true);
  });

  it('should get AI guidance for nodejs_api', async () => {
    const guidance = await manager.getAIGuidance('nodejs_api');

    expect(guidance).not.toBeNull();
    expect(guidance.testing_standards).toContain('Write unit tests for all functions');
  });

  it('should get deployment config for nodejs_api', async () => {
    const deployment = await manager.getDeploymentConfig('nodejs_api');

    expect(deployment).not.toBeNull();
    expect(deployment.type).toBe('container');
    expect(deployment.requires_build).toBe(true);
  });

  it('should merge user overrides with base config', async () => {
    const overrides = {
      testing: { coverage_threshold: 90 },
      custom_field: 'custom_value',
    };

    const merged = await manager.loadConfigWithOverrides('nodejs_api', overrides);

    expect(merged.testing.test_framework).toBe('jest'); // From base
    expect(merged.testing.coverage_threshold).toBe(90); // Overridden
    expect(merged.custom_field).toBe('custom_value'); // Added
  });

  it('should validate project with required files', async () => {
    // Create required files
    await fs.writeFile(path.join(tempDir, 'package.json'), '{}');
    await fs.mkdir(path.join(tempDir, 'src'), { recursive: true });
    await fs.mkdir(path.join(tempDir, '.github'), { recursive: true });

    // Add a file to src so it's not empty
    await fs.writeFile(path.join(tempDir, 'src', 'index.js'), 'console.log("test");');
    await fs.writeFile(path.join(tempDir, '.github', 'HIGH_COHESION_GUIDE.md'), '# guide');
    await fs.writeFile(path.join(tempDir, '.github', 'LOW_COUPLING_GUIDE.md'), '# guide');

    // Get validation rules first to check what's expected
    const rules = await manager.getValidationRules('nodejs_api');

    const result = await manager.validateProject('nodejs_api');

    // Debug output
    if (!result.valid) {
      console.error('Expected rules:', rules);
      console.error('Validation result:', result);

      // List what files actually exist
      const allFiles = await fs.readdir(tempDir);
      console.error('Actual files in tempDir:', allFiles);
    }

    expect(result.valid).toBe(true);
    expect(result.missingFiles).toEqual([]);
  });

  it('should detect missing required files in validation', async () => {
    // Don't create package.json
    await fs.mkdir(path.join(tempDir, 'src'), { recursive: true });

    const result = await manager.validateProject('nodejs_api');

    expect(result.valid).toBe(false);
    expect(result.missingFiles).toContain('package.json');
  });

  it('should get list of supported project kinds', async () => {
    const kinds = await manager.getSupportedProjectKinds();

    expect(kinds).toContain('nodejs_api');
    expect(kinds).toContain('shell_script_automation');
    expect(kinds.length).toBe(2);
  });

  it('should clear configuration cache', async () => {
    await manager.loadConfig('nodejs_api');
    expect(manager.configCache.size).toBe(1);

    manager.clearCache();
    expect(manager.configCache.size).toBe(0);
  });

  it('should get project kind from .workflow-config.yaml', async () => {
    // Create a test .workflow-config.yaml in project root
    const configPath = path.join(tempDir, '.workflow-config.yaml');
    const configContent = `project:
  name: 'test-project'
  kind: 'cli_tool'
  version: '1.0.0'`;

    await fs.writeFile(configPath, configContent, 'utf-8');

    const projectKind = await manager.getProjectKind();
    expect(projectKind).toBe('cli_tool');

    // Cleanup
    await fs.unlink(configPath);
  });

  it('should return null when .workflow-config.yaml does not exist', async () => {
    const projectKind = await manager.getProjectKind();
    expect(projectKind).toBeNull();
  });

  it('should return null when project.kind is not in config', async () => {
    const configPath = path.join(tempDir, '.workflow-config.yaml');
    const configContent = `project:
  name: 'test-project'
  version: '1.0.0'`;

    await fs.writeFile(configPath, configContent, 'utf-8');

    const projectKind = await manager.getProjectKind();
    expect(projectKind).toBeNull();

    // Cleanup
    await fs.unlink(configPath);
  });
});
