/**
 * Tests for Step 4: Configuration Validation
 * @group steps
 */

import {
  Step4ConfigAnalyzer,
  isConfigFile,
  getConfigType,
  validateJsonSyntax,
  validateYamlSyntax,
  validateConfigSyntax,
  scanForSecrets,
  checkConfigBestPractices,
  formatConfigReport,
  EXCLUDE_DIRS,
} from '../../src/steps/step_04_config_validation.js';

describe('Step 4: Configuration Validation', () => {
  // ========================================================================
  // PURE FUNCTIONS - File Classification
  // ========================================================================

  describe('isConfigFile', () => {
    test('identifies JSON files', () => {
      expect(isConfigFile('package.json')).toBe(true);
      expect(isConfigFile('config/settings.json')).toBe(true);
    });

    test('identifies YAML files', () => {
      expect(isConfigFile('.github/workflows/ci.yaml')).toBe(true);
      expect(isConfigFile('docker-compose.yml')).toBe(true);
    });

    test('identifies env files', () => {
      expect(isConfigFile('.env')).toBe(true);
      expect(isConfigFile('.env.local')).toBe(true);
      expect(isConfigFile('.env.example')).toBe(true);
    });

    test('identifies Docker files', () => {
      expect(isConfigFile('Dockerfile')).toBe(true);
      expect(isConfigFile('.dockerignore')).toBe(true);
    });

    test('identifies editor config', () => {
      expect(isConfigFile('.editorconfig')).toBe(true);
      expect(isConfigFile('.nvmrc')).toBe(true);
    });

    test('rejects non-config files', () => {
      expect(isConfigFile('src/index.js')).toBe(false);
      expect(isConfigFile('README.md')).toBe(false);
    });
  });

  describe('getConfigType', () => {
    test('returns correct type for JSON', () => {
      expect(getConfigType('package.json')).toBe('json');
    });

    test('returns correct type for YAML', () => {
      expect(getConfigType('.github/workflows/ci.yaml')).toBe('ci');
      expect(getConfigType('config.yml')).toBe('yaml');
    });

    test('returns correct type for Docker', () => {
      expect(getConfigType('Dockerfile')).toBe('docker');
    });

    test('returns unknown for unrecognized files', () => {
      expect(getConfigType('random.txt')).toBe('unknown');
    });
  });

  // ========================================================================
  // PURE FUNCTIONS - Syntax Validation
  // ========================================================================

  describe('validateJsonSyntax', () => {
    test('validates correct JSON', () => {
      const content = '{"name": "test", "version": "1.0.0"}';
      const result = validateJsonSyntax(content);

      expect(result.valid).toBe(true);
    });

    test('detects invalid JSON', () => {
      const content = '{"name": "test",}'; // Trailing comma
      const result = validateJsonSyntax(content);

      expect(result.valid).toBe(false);
      expect(result.error).toBeTruthy();
    });

    test('detects malformed JSON', () => {
      const content = '{"name": "test"'; // Missing closing brace
      const result = validateJsonSyntax(content);

      expect(result.valid).toBe(false);
    });
  });

  describe('validateYamlSyntax', () => {
    test('validates correct YAML', () => {
      const content = 'name: test\nversion: 1.0.0';
      const result = validateYamlSyntax(content);

      expect(result.valid).toBe(true);
    });

    test('detects tabs in YAML', () => {
      const content = 'name:\ttest';
      const result = validateYamlSyntax(content);

      expect(result.valid).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.issues[0].message).toContain('tabs');
    });

    test('detects odd indentation', () => {
      const content = '   name: test'; // 3 spaces
      const result = validateYamlSyntax(content);

      expect(result.valid).toBe(false);
      expect(result.issues[0].message).toContain('indentation');
    });

    test('allows even indentation', () => {
      const content = '  name: test\n  version: 1.0.0';
      const result = validateYamlSyntax(content);

      expect(result.valid).toBe(true);
    });
  });

  describe('validateConfigSyntax', () => {
    test('validates JSON type', () => {
      const content = '{"key": "value"}';
      const result = validateConfigSyntax(content, 'json');

      expect(result.valid).toBe(true);
    });

    test('validates YAML type', () => {
      const content = 'key: value';
      const result = validateConfigSyntax(content, 'yaml');

      expect(result.valid).toBe(true);
    });

    test('allows other types', () => {
      const result = validateConfigSyntax('content', 'toml');
      expect(result.valid).toBe(true);
      expect(result.note).toBeTruthy();
    });
  });

  // ========================================================================
  // PURE FUNCTIONS - Security Scanning
  // ========================================================================

  describe('scanForSecrets', () => {
    test('detects AWS keys', () => {
      const content = 'AWS_KEY=AKIAIOSFODNN7EXAMPLE';
      const findings = scanForSecrets(content, 'config.env');

      expect(findings.length).toBeGreaterThan(0);
      expect(findings[0].secretType).toBe('AWS Key');
    });

    test('detects API keys', () => {
      const content = 'api_key: abc123xyz789abc123xyz789'; // 28 chars
      const findings = scanForSecrets(content, 'config.yaml');

      expect(findings.length).toBeGreaterThan(0);
      expect(findings[0].secretType).toContain('API Key');
    });

    test('detects private keys', () => {
      const content = '-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQ';
      const findings = scanForSecrets(content, 'key.pem');

      expect(findings.length).toBeGreaterThan(0);
      expect(findings[0].secretType).toBe('Private Key');
    });

    test('skips .env.example files', () => {
      const content = 'api_key: your_api_key_here';
      const findings = scanForSecrets(content, '.env.example');

      expect(findings).toHaveLength(0);
    });

    test('tracks line numbers', () => {
      const content = 'foo: bar\napi_key: abc123xyz789abc123xyz789\nbaz: qux'; // 28 chars
      const findings = scanForSecrets(content, 'config.yaml');

      expect(findings[0].line).toBe(2);
    });

    test('provides preview', () => {
      const content = 'api_key: abc123xyz789abc123xyz789'; // 28 chars
      const findings = scanForSecrets(content, 'config.yaml');

      expect(findings[0].preview).toBeTruthy();
    });
  });

  describe('checkConfigBestPractices', () => {
    test('detects comments in JSON', () => {
      const content = '{\n  // Comment\n  "key": "value"\n}';
      const issues = checkConfigBestPractices(content, 'json');

      expect(issues.length).toBeGreaterThan(0);
      expect(issues[0].message).toContain('comments');
    });

    test('detects trailing commas in JSON', () => {
      const content = '{"key": "value",}';
      const issues = checkConfigBestPractices(content, 'json');

      expect(issues.length).toBeGreaterThan(0);
      expect(issues[0].message).toContain('trailing commas');
    });

    test('detects yes/no in YAML', () => {
      const content = 'enabled: yes\ndisabled: no';
      const issues = checkConfigBestPractices(content, 'yaml');

      expect(issues.length).toBeGreaterThan(0);
      expect(issues[0].message).toContain('true/false');
    });

    test('returns empty for valid config', () => {
      const content = '{"key": "value"}';
      const issues = checkConfigBestPractices(content, 'json');

      expect(issues).toHaveLength(0);
    });
  });

  // ========================================================================
  // PURE FUNCTIONS - Reporting
  // ========================================================================

  describe('formatConfigReport', () => {
    test('formats report with no issues', () => {
      const results = {
        filesChecked: 5,
        syntaxErrors: [],
        securityFindings: [],
        bestPracticeIssues: [],
      };
      const report = formatConfigReport(results);

      expect(report).toContain('## Step 4');
      expect(report).toContain('Files checked**: 5');
      expect(report).toContain('✅');
    });

    test('formats report with issues', () => {
      const results = {
        filesChecked: 3,
        syntaxErrors: [{ file: 'config.json', line: 10, error: 'Unexpected token' }],
        securityFindings: [
          { file: '.env', line: 5, secretType: 'API Key', preview: 'api_key=abc123' },
        ],
        bestPracticeIssues: [{ message: 'Use true/false instead of yes/no' }],
      };
      const report = formatConfigReport(results);

      expect(report).toContain('⚠️');
      expect(report).toContain('Syntax Errors');
      expect(report).toContain('Security Findings');
      expect(report).toContain('Best Practice Issues');
    });

    test('limits displayed errors', () => {
      const syntaxErrors = Array.from({ length: 15 }, (_, i) => ({
        file: `file${i}.json`,
        line: i,
        error: 'Error',
      }));

      const results = {
        filesChecked: 15,
        syntaxErrors,
        securityFindings: [],
        bestPracticeIssues: [],
      };
      const report = formatConfigReport(results);

      expect(report).toContain('... and 5 more');
    });
  });

  // ========================================================================
  // STEP 4 ANALYZER - Integration Tests
  // ========================================================================

  describe('Step4ConfigAnalyzer', () => {
    let analyzer;
    let mockFileOps;
    let mockBacklog;
    let mockGitOps;

    beforeEach(() => {
      mockFileOps = {
        readFile: () => Promise.resolve(''),
        glob: () => Promise.resolve([]),
      };

      mockBacklog = {
        saveStepSummary: () => Promise.resolve(),
      };

      mockGitOps = {
        getModifiedFiles: () => Promise.resolve([]),
      };

      analyzer = new Step4ConfigAnalyzer({
        fileOps: mockFileOps,
        backlog: mockBacklog,
        gitOps: mockGitOps,
        aiHelper: { initialize: () => Promise.resolve(false) },
      });
    });

    test('skips when no config files found', async () => {
      mockGitOps.getModifiedFiles = () => Promise.resolve(['src/index.js', 'README.md']);

      const result = await analyzer.execute('/project');

      expect(result.success).toBe(true);
      expect(result.skipped).toBe(true);
      expect(result.reason).toBe('no_config_files');
    });

    test('executes successfully with config files', async () => {
      mockGitOps.getModifiedFiles = () => Promise.resolve(['package.json', 'config.yaml']);
      mockFileOps.readFile = (path) => {
        if (path.endsWith('.json')) {
          return Promise.resolve('{"name": "test"}');
        }
        return Promise.resolve('name: test');
      };

      const result = await analyzer.execute('/project');

      expect(result.success).toBe(true);
      expect(result.filesChecked).toBe(2);
    });

    test('detects syntax errors', async () => {
      mockGitOps.getModifiedFiles = () => Promise.resolve(['config.json']);
      mockFileOps.readFile = () => Promise.resolve('{"name":}'); // Invalid JSON

      const result = await analyzer.execute('/project');

      expect(result.success).toBe(true);
      expect(result.syntaxErrors.length).toBeGreaterThan(0);
    });

    test('detects security findings', async () => {
      mockGitOps.getModifiedFiles = () => Promise.resolve(['.env']);
      mockFileOps.readFile = (path) => {
        if (path.endsWith('.env')) {
          return Promise.resolve('API_KEY=abc123xyz789abc123xyz789'); // 28 chars
        }
        return Promise.resolve('');
      };

      const result = await analyzer.execute('/project');

      expect(result.success).toBe(true);
      expect(result.securityFindings.length).toBeGreaterThan(0);
    });

    test('detects best practice issues', async () => {
      mockGitOps.getModifiedFiles = () => Promise.resolve(['config.json']);
      mockFileOps.readFile = () => Promise.resolve('{"name": "test",}'); // Trailing comma

      const result = await analyzer.execute('/project');

      expect(result.success).toBe(true);
      expect(result.bestPracticeIssues.length).toBeGreaterThan(0);
    });

    test('saves report to backlog', async () => {
      let savedContent = null;
      mockGitOps.getModifiedFiles = () => Promise.resolve(['package.json']);
      mockFileOps.readFile = () => Promise.resolve('{"name": "test"}');
      mockBacklog.saveStepSummary = (step, title, content) => {
        savedContent = content;
        return Promise.resolve();
      };

      await analyzer.execute('/project');

      expect(savedContent).toBeTruthy();
      expect(savedContent).toContain('Step 4');
    });

    test('handles git operation failures gracefully', async () => {
      mockGitOps.getModifiedFiles = () => Promise.reject(new Error('Git error'));
      mockFileOps.glob = () => Promise.resolve(['package.json']);
      mockFileOps.readFile = () => Promise.resolve('{"name": "test"}');

      const result = await analyzer.execute('/project');

      expect(result.success).toBe(true);
      expect(result.filesChecked).toBe(1);
    });

    // Bug A regression: .ai_cache files from git must be excluded
    test('excludes .ai_cache files found via git-modified path', async () => {
      mockGitOps.getModifiedFiles = () =>
        Promise.resolve(['.ai_workflow/.ai_cache/index.json', 'package.json']);
      mockFileOps.readFile = () => Promise.resolve('{"name": "test"}');

      const result = await analyzer.execute('/project');

      expect(result.success).toBe(true);
      expect(result.filesChecked).toBe(1); // only package.json
    });

    // Bug B regression: git paths are resolved to absolute before readFile
    test('resolves relative git paths to absolute before reading', async () => {
      const seenPaths = [];
      mockGitOps.getModifiedFiles = () => Promise.resolve(['package.json']);
      mockFileOps.readFile = (p) => {
        seenPaths.push(p);
        return Promise.resolve('{"name": "test"}');
      };

      await analyzer.execute('/project');

      expect(seenPaths[0]).toBe('/project/package.json');
    });

    // Bug C regression: unreadable files must not be counted as syntax errors
    test('does not count read failures as syntax errors', async () => {
      mockGitOps.getModifiedFiles = () => Promise.resolve(['package.json']);
      mockFileOps.readFile = () => Promise.reject(new Error('Only absolute paths are allowed'));

      const result = await analyzer.execute('/project');

      expect(result.success).toBe(true);
      expect(result.syntaxErrors).toHaveLength(0);
    });

    // EXCLUDE_DIRS export
    test('EXCLUDE_DIRS includes .ai_cache', () => {
      expect(EXCLUDE_DIRS).toContain('.ai_cache');
    });
  });
});
