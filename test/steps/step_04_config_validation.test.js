/**
 * Tests for Step 4: Configuration Validation
 * @group steps
 */

import {
  Step4ConfigAnalyzer,
  isConfigFile,
  getConfigType,
  stripJsonComments,
  validateJsonSyntax,
  validateYamlSyntax,
  validateConfigSyntax,
  scanForSecrets,
  checkConfigBestPractices,
  formatConfigReport,
  buildFileContentsBlock,
  buildPackageLockPromptSummary,
  summarizeConfigContentForPrompt,
  buildConfigPromptPartitions,
  assessPromptEvidence,
  groupConfigFilesList,
  validateAiResponseQuality,
  validateAiResponseEvidenceHandling,
  normalizeAiResponseForPartialEvidence,
  EXCLUDE_DIRS,
  GENERATED_CONFIG_REPLACEMENTS,
  MAX_FILE_CONTENT_CHARS,
  MAX_PROMPT_ENTRY_CHARS,
  MIN_FILE_MENTION_RATIO,
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

  describe('stripJsonComments', () => {
    // ── Basic comment removal ──────────────────────────────────────────────

    test('removes line comments', () => {
      const content = '{\n  "name": "test" // this is a comment\n}';
      expect(JSON.parse(stripJsonComments(content))).toEqual({ name: 'test' });
    });

    test('removes block comments', () => {
      const content = '{\n  /* block comment */\n  "name": "test"\n}';
      expect(JSON.parse(stripJsonComments(content))).toEqual({ name: 'test' });
    });

    test('removes multiple line comments', () => {
      const content = '{\n  "a": 1, // first\n  "b": 2 // second\n}';
      expect(JSON.parse(stripJsonComments(content))).toEqual({ a: 1, b: 2 });
    });

    test('removes multiple block comments', () => {
      const content = '{ /* one */ "a": 1, /* two */ "b": 2 }';
      expect(JSON.parse(stripJsonComments(content))).toEqual({ a: 1, b: 2 });
    });

    test('preserves line numbers (block comment replaced with spaces)', () => {
      const stripped = stripJsonComments('{\n  /* line1\n  line2 */\n  "a": 1\n}');
      // block comment content replaced by spaces to keep line count intact
      expect(stripped.split('\n').length).toBe(5);
    });

    test('multi-line block comment preserves all inner newlines', () => {
      const content = '{\n  /*\n   * line 2\n   * line 3\n   */\n  "x": 1\n}';
      const stripped = stripJsonComments(content);
      expect(stripped.split('\n').length).toBe(7);
      expect(JSON.parse(stripped)).toEqual({ x: 1 });
    });

    test('leaves plain JSON unchanged', () => {
      const content = '{"name": "test"}';
      expect(stripJsonComments(content)).toBe(content);
    });

    // ── BUG FIX: string-literal awareness ─────────────────────────────────
    // Before the fix, /* or // inside a string value was treated as a comment
    // start, silently deleting content and producing corrupt JSON.

    test('[BUG FIX] does not treat /* inside a string key as a comment start', () => {
      // "@/*" is a TypeScript path alias key — the /* MUST NOT be stripped
      const content =
        '{\n  "paths": {\n    "@/*": ["src/*"]\n  },\n  /* real comment */\n  "strict": true\n}';
      const parsed = JSON.parse(stripJsonComments(content));
      expect(parsed.paths['@/*']).toEqual(['src/*']);
      expect(parsed.strict).toBe(true);
    });

    test('[BUG FIX] does not treat /* inside a string value as a comment start', () => {
      // Jest collectCoverageFrom globs contain /* patterns
      const content = '{"include": ["src/**/*.js", "!node_modules/**"], "strict": true}';
      const parsed = JSON.parse(stripJsonComments(content));
      expect(parsed.include).toEqual(['src/**/*.js', '!node_modules/**']);
      expect(parsed.strict).toBe(true);
    });

    test('[BUG FIX] does not treat // inside a string value as a comment start', () => {
      const content = '{"url": "https://example.com", "ok": true}';
      const parsed = JSON.parse(stripJsonComments(content));
      expect(parsed.url).toBe('https://example.com');
      expect(parsed.ok).toBe(true);
    });

    test('[BUG FIX] /* in string key does not consume content up to next */', () => {
      // Exact pattern from guia_turistico tsconfig.json that triggered the bug:
      // "@/*" key appears before a "/* Output */" block comment — without the fix
      // the regex consumed everything between them as a single "comment".
      const content = [
        '{',
        '  "compilerOptions": {',
        '    "paths": {',
        '      "@/*": ["src/*"]',
        '    }',
        '  },',
        '  /* Output */',
        '  "outDir": "./dist"',
        '}',
      ].join('\n');
      const parsed = JSON.parse(stripJsonComments(content));
      expect(parsed.compilerOptions.paths['@/*']).toEqual(['src/*']);
      expect(parsed.outDir).toBe('./dist');
    });

    test('[BUG FIX] multiple glob patterns in the same string array all preserved', () => {
      const content = '{"files": ["src/**/*", "!dist/**/*", "!node_modules/**/*"], "ok": true}';
      const parsed = JSON.parse(stripJsonComments(content));
      expect(parsed.files).toHaveLength(3);
      expect(parsed.files[0]).toBe('src/**/*');
      expect(parsed.files[1]).toBe('!dist/**/*');
    });

    test('[BUG FIX] URL in string followed by real line comment', () => {
      // The // in the URL must not swallow the real comment or the next key
      const content = '{\n  "homepage": "https://example.com", // website\n  "private": true\n}';
      const parsed = JSON.parse(stripJsonComments(content));
      expect(parsed.homepage).toBe('https://example.com');
      expect(parsed.private).toBe(true);
    });

    // ── Escape sequences inside strings ───────────────────────────────────

    test('handles escaped double-quote inside a string (does not end string early)', () => {
      const content = '{"msg": "say \\"hello\\"", "ok": true}';
      const parsed = JSON.parse(stripJsonComments(content));
      expect(parsed.msg).toBe('say "hello"');
      expect(parsed.ok).toBe(true);
    });

    test('handles backslash-backslash followed by closing quote', () => {
      // "\\\\" in source is the string \\, so the " after it closes the string
      const content = '{"path": "C:\\\\Users\\\\foo", "ok": true}';
      const parsed = JSON.parse(stripJsonComments(content));
      expect(parsed.path).toBe('C:\\Users\\foo');
      expect(parsed.ok).toBe(true);
    });

    test('handles escaped backslash before escaped quote: \\\\"', () => {
      // Content: {"k": "a\\\"b"} — the \\\" is \ then escaped "
      const content = '{"k": "a\\\\\\"b", "ok": true}';
      const parsed = JSON.parse(stripJsonComments(content));
      expect(parsed.k).toBe('a\\"b');
      expect(parsed.ok).toBe(true);
    });

    test('string containing literal /* and */ is preserved unchanged', () => {
      // A value that embeds "/* docs */" as plain text — not a comment
      const content = '{"note": "see /* docs */ inline", "ok": true}';
      const parsed = JSON.parse(stripJsonComments(content));
      expect(parsed.note).toBe('see /* docs */ inline');
      expect(parsed.ok).toBe(true);
    });

    // ── Edge cases ────────────────────────────────────────────────────────

    test('handles empty string value', () => {
      const content = '{"empty": "", "ok": true}';
      expect(JSON.parse(stripJsonComments(content))).toEqual({ empty: '', ok: true });
    });

    test('handles empty object', () => {
      expect(JSON.parse(stripJsonComments('{}'))).toEqual({});
    });

    test('handles empty input', () => {
      expect(stripJsonComments('')).toBe('');
    });

    test('line comment at end of file without trailing newline is dropped safely', () => {
      // Without a newline after the comment the loop must not hang or throw
      const content = '{"a": 1} // trailing comment — no newline';
      const stripped = stripJsonComments(content);
      // The content before the comment must still produce valid JSON
      expect(JSON.parse(stripped.trim())).toEqual({ a: 1 });
    });

    test('block comment at end of file without */ is handled safely', () => {
      // Unterminated block comment — parser stops; what came before is preserved
      const content = '{"a": 1} /* unterminated';
      const stripped = stripJsonComments(content);
      expect(JSON.parse(stripped.trim())).toEqual({ a: 1 });
    });

    test('string with /* followed immediately by */ does not interfere with later real comment', () => {
      const content = '{"glob": "**/*", /* actual comment */ "ok": true}';
      const parsed = JSON.parse(stripJsonComments(content));
      expect(parsed.glob).toBe('**/*');
      expect(parsed.ok).toBe(true);
    });

    test('numeric, boolean and null values are not affected', () => {
      const content = '/* header */\n{"n": 42, "b": true, "nil": null}';
      const parsed = JSON.parse(stripJsonComments(content));
      expect(parsed).toEqual({ n: 42, b: true, nil: null });
    });

    test('unicode and emoji inside strings are preserved', () => {
      const content = '{"emoji": "✅ done", "ok": true}';
      const parsed = JSON.parse(stripJsonComments(content));
      expect(parsed.emoji).toBe('✅ done');
    });

    test('deeply nested JSON with comments at every level', () => {
      const content = [
        '{',
        '  /* root comment */',
        '  "a": {',
        '    // nested comment',
        '    "b": {',
        '      "paths": {"@/*": ["src/*"]} /* inline */',
        '    }',
        '  }',
        '}',
      ].join('\n');
      const parsed = JSON.parse(stripJsonComments(content));
      expect(parsed.a.b.paths['@/*']).toEqual(['src/*']);
    });
  });

  describe('validateJsonSyntax', () => {
    test('validates correct JSON', () => {
      const content = '{"name": "test", "version": "1.0.0"}';
      const result = validateJsonSyntax(content);

      expect(result.valid).toBe(true);
    });

    test('accepts JSONC with line comments (tsconfig.json style)', () => {
      const content =
        '{\n  "compilerOptions": {\n    // enable strict mode\n    "strict": true\n  }\n}';
      const result = validateJsonSyntax(content);

      expect(result.valid).toBe(true);
    });

    test('accepts JSONC with block comments', () => {
      const content = '{\n  /* project config */\n  "name": "test"\n}';
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

    // ── Real-world config patterns (regression suite for the bug fix) ──────

    test('[BUG FIX] tsconfig.json with @/* path alias and block comment', () => {
      // This exact pattern caused false-positive syntax errors before the fix
      const content = [
        '{',
        '  "compilerOptions": {',
        '    "baseUrl": ".",',
        '    "paths": {',
        '      "@/*": ["src/*"]',
        '    },',
        '    /* Output */',
        '    "outDir": "./dist",',
        '    "strict": true',
        '  }',
        '}',
      ].join('\n');
      expect(validateJsonSyntax(content).valid).toBe(true);
    });

    test('[BUG FIX] jest config with collectCoverageFrom glob array', () => {
      const content = JSON.stringify({
        collectCoverageFrom: [
          'src/**/*.js',
          '!src/**/*.test.js',
          '!src/**/*.spec.js',
          '!node_modules/**',
          '!coverage/**',
        ],
        testMatch: ['**/__tests__/**/*.js', '**/*.test.js'],
      });
      expect(validateJsonSyntax(content).valid).toBe(true);
    });

    test('[BUG FIX] package.json with npm scripts containing shell commands', () => {
      const content = JSON.stringify({
        scripts: {
          test: 'jest --coverage',
          build: 'tsc && cp -r public/* dist/',
          deploy: "npm run build && echo '✅ done'",
        },
      });
      expect(validateJsonSyntax(content).valid).toBe(true);
    });

    test('[BUG FIX] package.json with repository URL containing //', () => {
      const content = JSON.stringify({
        name: 'my-pkg',
        repository: { type: 'git', url: 'https://github.com/org/repo.git' },
        homepage: 'https://org.github.io/repo/',
      });
      expect(validateJsonSyntax(content).valid).toBe(true);
    });

    test('[BUG FIX] .vscode/settings.json with exclude globs and line comments', () => {
      const content = [
        '{',
        '  // VS Code settings',
        '  "files.exclude": {',
        '    "**/.git": true,',
        '    "**/node_modules/**": true,',
        '    "dist/**/*": false',
        '  },',
        '  /* editor */',
        '  "editor.tabSize": 2',
        '}',
      ].join('\n');
      expect(validateJsonSyntax(content).valid).toBe(true);
    });

    test('[BUG FIX] eslint config JSON with parser options and glob patterns', () => {
      const content = JSON.stringify({
        ignorePatterns: ['dist/**/*', 'node_modules/**/*', 'coverage/**/*'],
        rules: { 'no-console': 'warn' },
      });
      expect(validateJsonSyntax(content).valid).toBe(true);
    });

    test('returns error object with message on invalid JSONC', () => {
      const content = '{\n  "a": /* unclosed\n  "b": 1\n}';
      const result = validateJsonSyntax(content);
      // Unterminated block comment — parser stops early, resulting in invalid JSON
      expect(result.valid).toBe(false);
      expect(result.error).toBeTruthy();
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

    test('does not false-positive on glob patterns containing /* */ sequences', () => {
      // tsconfig.json-style: "src/**/*" contains /**/ which the old regex matched as a block comment
      const tsconfigLike = JSON.stringify({
        include: ['src/**/*', 'helpers/**/*'],
        exclude: ['node_modules', 'dist'],
      });
      expect(checkConfigBestPractices(tsconfigLike, 'json')).toHaveLength(0);

      // jest.config.json-style: glob testMatch patterns span across strings when joined
      const jestLike = JSON.stringify({
        testMatch: ['**/*.test.ts', '**/*.test.tsx'],
        collectCoverageFrom: ['src/**/*.{ts,tsx}', 'helpers/**/*.ts'],
      });
      expect(checkConfigBestPractices(jestLike, 'json')).toHaveLength(0);
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

    test('replaces generated ai_helpers.yaml with workflow config files for validation and AI reporting', async () => {
      const seenReads = [];
      let seenPrompt = '';
      const aiHelper = {
        initialize: () => Promise.resolve(true),
        executeRequest: (prompt) => {
          seenPrompt = prompt;
          return Promise.resolve({
            content:
              'Checked .workflow_core/.workflow-config.yaml and .workflow-config.yaml for the generated helper bundle context.',
          });
        },
      };
      const aiCache = {
        init: () => Promise.resolve(),
        withFileChangeGuard: (_stepId, _fileContents, fn) => fn(),
      };

      mockGitOps.getModifiedFiles = () =>
        Promise.resolve(['.workflow_core/config/ai_helpers.yaml']);
      mockFileOps.readFile = (filePath) => {
        seenReads.push(filePath);
        if (filePath.endsWith('.workflow_core/.workflow-config.yaml')) {
          return Promise.resolve('workflow:\n  settings:\n    auto_mode: false');
        }
        if (filePath.endsWith('.workflow-config.yaml')) {
          return Promise.resolve('project:\n  name: ai_workflow.js');
        }
        return Promise.reject(new Error(`unexpected read: ${filePath}`));
      };

      analyzer = new Step4ConfigAnalyzer({
        fileOps: mockFileOps,
        backlog: mockBacklog,
        gitOps: mockGitOps,
        aiHelper,
        aiCache,
      });

      const result = await analyzer.execute('/project');

      expect(result.success).toBe(true);
      expect(result.filesChecked).toBe(2);
      expect(
        seenReads.filter((filePath) => filePath.endsWith('.workflow_core/.workflow-config.yaml'))
          .length
      ).toBeGreaterThan(0);
      expect(
        seenReads.filter((filePath) => filePath.endsWith('.workflow-config.yaml')).length
      ).toBeGreaterThan(0);
      expect(seenPrompt).toContain('.workflow_core/.workflow-config.yaml');
      expect(seenPrompt).toContain('.workflow-config.yaml');
      expect(seenPrompt).not.toContain('.workflow_core/config/ai_helpers.yaml');
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

    test('partitions oversized AI config scope instead of sending truncated content', async () => {
      const longYaml = [
        'workflow:',
        `  note: "${'x'.repeat(MAX_PROMPT_ENTRY_CHARS * 2 + 1200)}"`,
      ].join('\n');
      let savedContent = '';
      const seenPrompts = [];
      const aiHelper = {
        initialize: () => Promise.resolve(true),
        executeRequest: (prompt) => {
          seenPrompts.push(prompt);
          return Promise.resolve({
            content: 'No issues detected in the visible entries for this partition.',
          });
        },
      };
      const aiCache = {
        init: () => Promise.resolve(),
        withFileChangeGuard: (_stepId, _fileContents, fn) => fn(),
      };

      mockGitOps.getModifiedFiles = () =>
        Promise.resolve(['.workflow-config.yaml', 'package.json', '.github/workflows/ci.yml']);
      mockFileOps.readFile = (filePath) => {
        if (filePath.endsWith('.workflow-config.yaml')) return Promise.resolve(longYaml);
        if (filePath.endsWith('package.json'))
          return Promise.resolve('{"name":"test","version":"1.0.0"}');
        if (filePath.endsWith('.github/workflows/ci.yml'))
          return Promise.resolve('name: CI\non: push');
        return Promise.reject(new Error('not found'));
      };
      mockBacklog.saveStepSummary = (_step, _title, content) => {
        savedContent = content;
        return Promise.resolve();
      };

      analyzer = new Step4ConfigAnalyzer({
        fileOps: mockFileOps,
        backlog: mockBacklog,
        gitOps: mockGitOps,
        aiHelper,
        aiCache,
      });

      await analyzer.execute('/project');

      expect(seenPrompts).toHaveLength(2);
      expect(seenPrompts[0]).toContain('- Partition: 1/2');
      expect(seenPrompts[1]).toContain('.workflow-config.yaml (part 3/3)');
      expect(seenPrompts.join('\n')).not.toContain('[truncated');
      expect(savedContent).toContain('### Partition 1 of 2');
      expect(savedContent).toContain('### Partition 2 of 2');
      expect(savedContent).not.toContain('Validation note');
    });

    test('keeps generated package-lock content compact in AI prompt context', async () => {
      const lockfile = JSON.stringify({
        name: 'test',
        version: '1.0.0',
        lockfileVersion: 3,
        packages: {
          '': {
            dependencies: { react: '^19.0.0' },
            devDependencies: { typescript: '^5.8.0' },
          },
          'node_modules/react': { version: '19.0.0' },
          'node_modules/typescript': { version: '5.8.2' },
        },
      });
      let seenPrompt = '';
      const aiHelper = {
        initialize: () => Promise.resolve(true),
        executeRequest: (prompt) => {
          seenPrompt = prompt;
          return Promise.resolve({
            content: 'All configuration files validated successfully.',
          });
        },
      };
      const aiCache = {
        init: () => Promise.resolve(),
        withFileChangeGuard: (_stepId, _fileContents, fn) => fn(),
      };

      mockGitOps.getModifiedFiles = () => Promise.resolve(['package-lock.json']);
      mockFileOps.readFile = (filePath) => {
        if (filePath.endsWith('package-lock.json')) return Promise.resolve(lockfile);
        return Promise.reject(new Error('not found'));
      };

      analyzer = new Step4ConfigAnalyzer({
        fileOps: mockFileOps,
        backlog: mockBacklog,
        gitOps: mockGitOps,
        aiHelper,
        aiCache,
      });

      await analyzer.execute('/project');

      expect(seenPrompt).toContain('[generated npm lockfile summary]');
      expect(seenPrompt).toContain('"rootDependencies"');
      expect(seenPrompt).not.toContain('"node_modules/react"');
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

    test('EXCLUDE_DIRS includes venv/.venv/env to prevent virtualenv files being sent to AI', () => {
      expect(EXCLUDE_DIRS).toContain('venv');
      expect(EXCLUDE_DIRS).toContain('.venv');
      expect(EXCLUDE_DIRS).toContain('env');
    });
  });

  // ========================================================================
  // END-TO-END: Real-world config file content through the full pipeline
  // Exercises stripJsonComments → validateJsonSyntax → Step4ConfigAnalyzer
  // ========================================================================

  describe('End-to-end: real-world config content through Step4ConfigAnalyzer', () => {
    let analyzer;
    let mockFileOps;
    let mockBacklog;
    let mockGitOps;

    // Realistic file content fixtures matching the files that triggered the bug
    const FIXTURES = {
      'tsconfig.json': [
        '{',
        '  "compilerOptions": {',
        '    "target": "ES2020",',
        '    "baseUrl": ".",',
        '    "paths": {',
        '      "@/*": ["src/*"],',
        '      "@components/*": ["src/components/*"]',
        '    },',
        '    /* Output */',
        '    "outDir": "./dist",',
        '    "rootDir": "./src",',
        '    // strict mode enabled',
        '    "strict": true',
        '  }',
        '}',
      ].join('\n'),

      'package.json': JSON.stringify(
        {
          name: 'guia-turistico',
          version: '1.0.0',
          scripts: {
            test: 'jest --coverage',
            build: 'tsc',
            deploy: "npm run build && echo '✅ done'",
            'ci:test-local': './.github/scripts/test-workflow-locally.sh',
          },
          jest: {
            collectCoverageFrom: [
              'src/**/*.js',
              '!src/**/*.test.js',
              '!node_modules/**',
              '!coverage/**',
            ],
          },
          repository: { url: 'https://github.com/org/guia_turistico.git' },
        },
        null,
        2
      ),

      '.vscode/settings.json': [
        '{',
        '  // VS Code workspace settings',
        '  "files.exclude": {',
        '    "**/.git": true,',
        '    "**/node_modules/**": true,',
        '    "dist/**/*": false',
        '  },',
        '  /* editor preferences */',
        '  "editor.tabSize": 2,',
        '  "editor.formatOnSave": true',
        '}',
      ].join('\n'),

      '.eslintrc.json': JSON.stringify({
        ignorePatterns: ['dist/**/*', 'node_modules/**/*'],
        rules: { 'no-console': 'warn', 'no-unused-vars': 'error' },
      }),
    };

    beforeEach(() => {
      mockFileOps = {
        readFile: (filePath) => {
          const name = Object.keys(FIXTURES).find((k) => filePath.endsWith(k));
          return name ? Promise.resolve(FIXTURES[name]) : Promise.reject(new Error('not found'));
        },
        glob: () => Promise.resolve([]),
      };

      mockBacklog = { saveStepSummary: () => Promise.resolve() };

      mockGitOps = {
        getModifiedFiles: () =>
          Promise.resolve([
            'tsconfig.json',
            'package.json',
            '.vscode/settings.json',
            '.eslintrc.json',
          ]),
      };

      analyzer = new Step4ConfigAnalyzer({
        fileOps: mockFileOps,
        backlog: mockBacklog,
        gitOps: mockGitOps,
        aiHelper: { initialize: () => Promise.resolve(false) },
      });
    });

    test('[BUG FIX] tsconfig.json with @/* path alias is not reported as a syntax error', async () => {
      mockGitOps.getModifiedFiles = () => Promise.resolve(['tsconfig.json']);
      const result = await analyzer.execute('/project');
      expect(result.success).toBe(true);
      expect(result.syntaxErrors).toHaveLength(0);
    });

    test('[BUG FIX] package.json with jest glob config is not reported as a syntax error', async () => {
      mockGitOps.getModifiedFiles = () => Promise.resolve(['package.json']);
      const result = await analyzer.execute('/project');
      expect(result.success).toBe(true);
      expect(result.syntaxErrors).toHaveLength(0);
    });

    test('[BUG FIX] .vscode/settings.json with glob excludes is not reported as a syntax error', async () => {
      mockGitOps.getModifiedFiles = () => Promise.resolve(['.vscode/settings.json']);
      const result = await analyzer.execute('/project');
      expect(result.success).toBe(true);
      expect(result.syntaxErrors).toHaveLength(0);
    });

    test('[BUG FIX] all four real-world config files validate without syntax errors', async () => {
      const result = await analyzer.execute('/project');
      expect(result.success).toBe(true);
      expect(result.filesChecked).toBe(4);
      expect(result.syntaxErrors).toHaveLength(0);
    });

    test('genuinely invalid JSON is still caught alongside valid files', async () => {
      mockGitOps.getModifiedFiles = () =>
        Promise.resolve(['tsconfig.json', 'package.json', 'broken.json']);
      mockFileOps.readFile = (filePath) => {
        if (filePath.endsWith('broken.json')) return Promise.resolve('{"bad":}');
        const name = Object.keys(FIXTURES).find((k) => filePath.endsWith(k));
        return name ? Promise.resolve(FIXTURES[name]) : Promise.reject(new Error('not found'));
      };

      const result = await analyzer.execute('/project');

      expect(result.success).toBe(true);
      expect(result.syntaxErrors).toHaveLength(1);
      expect(result.syntaxErrors[0].file).toContain('broken.json');
      // Valid files must not be included in errors
      expect(result.syntaxErrors.map((e) => e.file).join(',')).not.toContain('tsconfig');
      expect(result.syntaxErrors.map((e) => e.file).join(',')).not.toContain('package');
    });

    test('result report mentions the correct file count', async () => {
      let savedReport = '';
      mockBacklog.saveStepSummary = (_step, _title, content) => {
        savedReport = content;
        return Promise.resolve();
      };

      await analyzer.execute('/project');

      expect(savedReport).toContain('4'); // files checked
    });

    test('[BUG FIX] venv/ config files are excluded from discovery', async () => {
      // getModifiedFiles returns empty → triggers glob fallback
      // Glob fallback must not include venv/ paths
      mockGitOps.getModifiedFiles = () => Promise.resolve([]);
      // Mock glob to simulate returning a venv file alongside a real config file
      const originalGlob = mockFileOps.glob;
      mockFileOps.glob = (pattern, opts) => {
        const ignore = opts?.ignore ?? [];
        // Verify venv is in the ignore list
        const ignoresVenv = ignore.some((g) => g.includes('venv'));
        if (!ignoresVenv) {
          // Return venv file to expose bug if exclude is missing
          return Promise.resolve([
            'venv/lib/python3.13/site-packages/setuptools/config/distutils.schema.json',
            'package.json',
          ]);
        }
        return originalGlob ? originalGlob(pattern, opts) : Promise.resolve([]);
      };
      const result = await analyzer.execute('/project');
      expect(result.success).toBe(true);
    });
  });

  // ========================================================================
  // PURE FUNCTIONS - buildFileContentsBlock
  // ========================================================================

  describe('buildFileContentsBlock', () => {
    test('returns empty string for empty input', () => {
      expect(buildFileContentsBlock([])).toBe('');
      expect(buildFileContentsBlock(null)).toBe('');
    });

    test('formats a single file with header and fenced block', () => {
      const result = buildFileContentsBlock([
        { relativePath: 'package.json', content: '{"name":"x"}' },
      ]);
      expect(result).toContain('--- package.json ---');
      expect(result).toContain('{"name":"x"}');
      expect(result).toContain('```');
    });

    test('joins multiple files with double newline', () => {
      const entries = [
        { relativePath: 'a.yml', content: 'key: val' },
        { relativePath: 'b.json', content: '{}' },
      ];
      const result = buildFileContentsBlock(entries);
      expect(result).toContain('--- a.yml ---');
      expect(result).toContain('--- b.json ---');
    });

    test('truncates content exceeding maxChars', () => {
      const longContent = 'x'.repeat(MAX_FILE_CONTENT_CHARS + 100);
      const result = buildFileContentsBlock(
        [{ relativePath: 'big.yml', content: longContent }],
        MAX_FILE_CONTENT_CHARS
      );
      expect(result).toContain('[truncated');
      expect(result).toContain('100 more chars');
    });

    test('does not truncate content within maxChars', () => {
      const shortContent = 'x'.repeat(50);
      const result = buildFileContentsBlock([{ relativePath: 'small.yml', content: shortContent }]);
      expect(result).not.toContain('[truncated');
    });

    test('custom maxChars parameter is respected', () => {
      const content = 'abcdefghij'; // 10 chars
      const result = buildFileContentsBlock([{ relativePath: 'f.yml', content }], 5);
      expect(result).toContain('[truncated');
      expect(result).toContain('5 more chars');
    });
  });

  describe('buildPackageLockPromptSummary', () => {
    test('extracts root dependency versions without dumping full generated keys', () => {
      const summary = buildPackageLockPromptSummary(
        JSON.stringify({
          name: 'demo',
          version: '1.0.0',
          lockfileVersion: 3,
          packages: {
            '': {
              dependencies: { react: '^19.0.0' },
              devDependencies: { typescript: '^5.8.0' },
            },
            'node_modules/react': { version: '19.0.0' },
            'node_modules/typescript': { version: '5.8.2' },
          },
        })
      );

      expect(summary).toContain('[generated npm lockfile summary]');
      expect(summary).toContain('"react": "19.0.0"');
      expect(summary).toContain('"typescript": "5.8.2"');
      expect(summary).not.toContain('"node_modules/react"');
    });
  });

  describe('summarizeConfigContentForPrompt', () => {
    test('summarizes package-lock.json but leaves regular config files unchanged', () => {
      const lockSummary = summarizeConfigContentForPrompt(
        'package-lock.json',
        JSON.stringify({ lockfileVersion: 3, packages: { '': {} } })
      );
      const plainYaml = summarizeConfigContentForPrompt('.github/workflows/ci.yml', 'name: CI');

      expect(lockSummary).toContain('[generated npm lockfile summary]');
      expect(plainYaml).toBe('name: CI');
    });
  });

  describe('buildConfigPromptPartitions', () => {
    test('splits oversized entries into labeled parts and groups them into prompt-safe partitions', () => {
      const partitions = buildConfigPromptPartitions(
        [
          { relativePath: 'package.json', content: '{"name":"demo"}' },
          {
            relativePath: '.workflow-config.yaml',
            content: 'workflow:\n' + '  note: "' + 'x'.repeat(MAX_PROMPT_ENTRY_CHARS + 1000) + '"',
          },
        ],
        MAX_PROMPT_ENTRY_CHARS + 500,
        MAX_PROMPT_ENTRY_CHARS
      );

      expect(partitions).toHaveLength(2);
      expect(partitions[0].entries[0].relativePath).toBe('package.json');
      expect(partitions[0].entries[1].relativePath).toContain('.workflow-config.yaml (part 1/2)');
      expect(partitions[1].entries[0].relativePath).toContain('.workflow-config.yaml (part 2/2)');
      expect(partitions[0].scopePaths).toEqual(['package.json', '.workflow-config.yaml']);
    });
  });

  // ========================================================================
  // PURE FUNCTIONS - groupConfigFilesList
  // ========================================================================

  describe('groupConfigFilesList', () => {
    test('documents generated config replacement mapping for ai_helpers.yaml', () => {
      expect(GENERATED_CONFIG_REPLACEMENTS['.workflow_core/config/ai_helpers.yaml']).toEqual([
        '.workflow_core/.workflow-config.yaml',
        '.workflow-config.yaml',
      ]);
    });

    test('returns empty string for empty input', () => {
      expect(groupConfigFilesList([])).toBe('');
      expect(groupConfigFilesList(null)).toBe('');
    });

    test('groups root-level files under "Root"', () => {
      const result = groupConfigFilesList(['package.json', 'tsconfig.json']);
      expect(result).toBe('**Root**: package.json, tsconfig.json');
    });

    test('groups files by parent directory', () => {
      const result = groupConfigFilesList([
        'package.json',
        '.github/workflows/test.yml',
        '.github/workflows/lint.yml',
        '.github/dependabot.yml',
      ]);
      expect(result).toContain('**Root**: package.json');
      expect(result).toContain('**.github/workflows**: test.yml, lint.yml');
      expect(result).toContain('**.github**: dependabot.yml');
    });

    test('preserves insertion order of directories', () => {
      const paths = ['a/x.json', 'b/y.yaml', 'a/z.json'];
      const result = groupConfigFilesList(paths);
      const lines = result.split('\n');
      expect(lines[0]).toBe('**a**: x.json, z.json');
      expect(lines[1]).toBe('**b**: y.yaml');
    });

    test('handles deeply nested paths', () => {
      const result = groupConfigFilesList(['.github/actions/security-check/action.yml']);
      expect(result).toBe('**.github/actions/security-check**: action.yml');
    });

    test('keeps partition suffixes attached to filenames instead of directory labels', () => {
      const result = groupConfigFilesList([
        '.workflow_core/config/ai_helpers.yaml (part 64/98)',
        '.workflow_core/config/ai_helpers.yaml (part 65/98)',
      ]);
      expect(result).toBe(
        '**.workflow_core/config**: ai_helpers.yaml (part 64/98), ai_helpers.yaml (part 65/98)'
      );
    });
  });

  // ========================================================================
  // PURE FUNCTIONS - assessPromptEvidence / evidence handling
  // ========================================================================

  describe('assessPromptEvidence', () => {
    test('reports full evidence when every listed file is present and untruncated', () => {
      const result = assessPromptEvidence(
        ['package.json'],
        [{ relativePath: 'package.json', content: '{"name":"x"}' }],
        MAX_FILE_CONTENT_CHARS
      );

      expect(result.hasPartialEvidence).toBe(false);
      expect(result.truncatedFiles).toEqual([]);
      expect(result.unavailableFiles).toEqual([]);
    });

    test('reports truncated and unavailable files separately', () => {
      const result = assessPromptEvidence(
        ['package.json', 'ci.yml'],
        [{ relativePath: 'package.json', content: 'x'.repeat(MAX_FILE_CONTENT_CHARS + 1) }],
        MAX_FILE_CONTENT_CHARS
      );

      expect(result.hasPartialEvidence).toBe(true);
      expect(result.truncatedFiles).toEqual(['package.json']);
      expect(result.unavailableFiles).toEqual(['ci.yml']);
    });
  });

  // ========================================================================
  // PURE FUNCTIONS - validateAiResponseQuality
  // ========================================================================

  describe('validateAiResponseQuality', () => {
    test('returns adequate=true when no files to check', () => {
      const r = validateAiResponseQuality('any response', []);
      expect(r.adequate).toBe(true);
      expect(r.coverage).toBe(1);
    });

    test('returns adequate=false for empty response', () => {
      const r = validateAiResponseQuality('', ['package.json']);
      expect(r.adequate).toBe(false);
      expect(r.reason).toContain('empty response');
    });

    test('returns adequate=false for whitespace-only response', () => {
      const r = validateAiResponseQuality('   ', ['package.json']);
      expect(r.adequate).toBe(false);
    });

    test('detects file mentions by basename', () => {
      const r = validateAiResponseQuality(
        'I reviewed package.json and found no issues.',
        ['.github/workflows/test.yml', 'package.json'],
        0.5
      );
      // 'test.yml' is basename of the first file
      // response mentions 'package.json' — 1 out of 2 = 50% which equals threshold
      expect(r.coverage).toBeGreaterThanOrEqual(0.5);
    });

    test('returns adequate=false when fewer than minRatio files are mentioned', () => {
      const r = validateAiResponseQuality(
        'All files look fine.',
        ['package.json', 'test.yml', 'bump-sw-cache.yml'],
        MIN_FILE_MENTION_RATIO
      );
      // None of the filenames appear in the response text
      expect(r.adequate).toBe(false);
      expect(r.coverage).toBe(0);
    });

    test('returns adequate=true when sufficient files are mentioned', () => {
      const files = ['package.json', 'test.yml', 'dependency-audit.yml'];
      const response = 'Checked package.json: ok. test.yml: ok. dependency-audit.yml: ok.';
      const r = validateAiResponseQuality(response, files);
      expect(r.adequate).toBe(true);
      expect(r.coverage).toBe(1);
    });

    test('coverage field reflects actual fraction', () => {
      const files = ['a.yml', 'b.yml', 'c.yml', 'd.yml'];
      const response = 'Reviewed a.yml and b.yml only.';
      const r = validateAiResponseQuality(response, files, 0.0);
      expect(r.coverage).toBeCloseTo(0.5);
    });
  });

  describe('validateAiResponseEvidenceHandling', () => {
    test('returns adequate=true when all evidence is present in full', () => {
      const result = validateAiResponseEvidenceHandling(
        'All configuration files validated successfully.',
        ['package.json'],
        [{ relativePath: 'package.json', content: '{"name":"x"}' }]
      );

      expect(result.adequate).toBe(true);
      expect(result.hasPartialEvidence).toBe(false);
    });

    test('returns adequate=false for unqualified success claims over truncated evidence', () => {
      const result = validateAiResponseEvidenceHandling(
        'All configuration files validated successfully.\n\nNo issues detected.',
        ['package.json'],
        [{ relativePath: 'package.json', content: 'x'.repeat(MAX_FILE_CONTENT_CHARS + 1) }]
      );

      expect(result.adequate).toBe(false);
      expect(result.reason).toContain('partial evidence');
      expect(result.reason).toContain('truncated: package.json');
    });

    test('allows excerpt-limited conclusions when partial evidence is acknowledged', () => {
      const result = validateAiResponseEvidenceHandling(
        'No issues detected in the visible excerpts; the truncated remainder is inconclusive.',
        ['package.json'],
        [{ relativePath: 'package.json', content: 'x'.repeat(MAX_FILE_CONTENT_CHARS + 1) }]
      );

      expect(result.adequate).toBe(true);
      expect(result.hasPartialEvidence).toBe(true);
    });
  });

  describe('normalizeAiResponseForPartialEvidence', () => {
    test('rewrites unsafe global-success phrases to excerpt-limited wording', () => {
      const normalized = normalizeAiResponseForPartialEvidence(
        'All configuration files validated successfully.\n\nNo issues detected.',
        { hasPartialEvidence: true }
      );

      expect(normalized).toContain('Configuration validation remains inconclusive');
      expect(normalized).toContain('No issues detected in the visible excerpts');
    });
  });

  // ========================================================================
  // withFileChangeGuard integration — Step 4 AI skip behavior
  // ========================================================================

  describe('Step4ConfigAnalyzer.execute — file-change-guard skip behavior', () => {
    let mockFileOps;
    let mockBacklog;
    let mockGitOps;
    let mockAiHelper;
    let mockAiCache;
    let analyzer;
    let aiCallCount;

    const FILES = ['package.json'];
    const FILE_CONTENT = '{"name":"test"}';

    beforeEach(() => {
      aiCallCount = 0;

      mockFileOps = {
        readFile: (p) => {
          if (p.endsWith('package.json')) return Promise.resolve(FILE_CONTENT);
          if (p.endsWith('.yaml') || p.endsWith('.yml'))
            return Promise.reject(new Error('not found'));
          return Promise.reject(new Error('not found'));
        },
        glob: () => Promise.resolve([]),
      };

      mockBacklog = { saveStepSummary: () => Promise.resolve() };

      mockGitOps = {
        getModifiedFiles: () => Promise.resolve(FILES),
      };

      mockAiHelper = {
        initialize: () => Promise.resolve(true),
        executeRequest: () => {
          aiCallCount++;
          return Promise.resolve({ content: `AI response #${aiCallCount}` });
        },
      };

      // Simulate withFileChangeGuard: first call hits AI, subsequent calls with same
      // fileContents return cached result.
      let storedHash = null;
      let storedResponse = null;
      mockAiCache = {
        init: () => Promise.resolve(),
        withFileChangeGuard: async (stepId, fileContents, fn) => {
          const hash = fileContents.sort().join('|');
          if (hash === storedHash && storedResponse !== null) {
            return storedResponse;
          }
          const result = await fn();
          storedHash = hash;
          storedResponse = result;
          return result;
        },
      };

      analyzer = new Step4ConfigAnalyzer({
        fileOps: mockFileOps,
        backlog: mockBacklog,
        gitOps: mockGitOps,
        aiHelper: mockAiHelper,
        aiCache: mockAiCache,
      });
    });

    test('calls AI on first execution', async () => {
      await analyzer.execute('/project');
      expect(aiCallCount).toBeGreaterThanOrEqual(1);
    });

    test('skips AI call on second execution with unchanged files', async () => {
      await analyzer.execute('/project');
      const countAfterFirst = aiCallCount;

      await analyzer.execute('/project');

      expect(aiCallCount).toBe(countAfterFirst); // no new AI calls
    });

    test('calls AI again when file content changes between executions', async () => {
      await analyzer.execute('/project');
      const countAfterFirst = aiCallCount;

      // Simulate file change
      mockFileOps.readFile = (p) => {
        if (p.endsWith('package.json')) return Promise.resolve('{"name":"changed"}');
        return Promise.reject(new Error('not found'));
      };

      await analyzer.execute('/project');

      expect(aiCallCount).toBeGreaterThan(countAfterFirst);
    });
  });

  describe('Step4ConfigAnalyzer - alternatives directive', () => {
    test('returns empty alternatives when flag is false', async () => {
      const analyzer = new Step4ConfigAnalyzer({
        fileOps: {
          glob: () => Promise.resolve([]),
          readFile: () => Promise.reject(new Error('not found')),
        },
        backlog: { saveStepSummary: () => Promise.resolve() },
        techStack: { detectTechStack: () => Promise.resolve({ primaryLanguage: 'javascript' }) },
        aiHelper: { initialize: () => Promise.resolve(false) },
      });
      const result = await analyzer.execute('/project');
      expect(result.alternatives).toEqual([]);
      expect(result.recommendedAlternative).toBeNull();
    });

    test('appends alternatives directive to prompt and parses result', async () => {
      let capturedPrompt = '';
      const structuredResponse = [
        'ALTERNATIVE 1: Strict JSON validation\n  Description: Reject all comments\n  Trade-offs: Clean but verbose',
        'ALTERNATIVE 2: Lenient JSON validation\n  Description: Allow comments\n  Trade-offs: Easier to maintain',
        'RECOMMENDED: 1 — strict is safer in CI',
      ].join('\n');
      const mockAiHelper = {
        initialize: () => Promise.resolve(true),
        executeRequest: (prompt) => {
          capturedPrompt = prompt;
          return Promise.resolve({ content: structuredResponse });
        },
      };
      const mockAiCache = {
        init: () => Promise.resolve(),
        withFileChangeGuard: (_key, _files, fn) => fn(),
      };
      const analyzer = new Step4ConfigAnalyzer({
        fileOps: {
          glob: (pattern) =>
            pattern.includes('json') ? Promise.resolve(['package.json']) : Promise.resolve([]),
          readFile: () => Promise.resolve('{"name":"test"}'),
          stat: () => Promise.resolve({}),
        },
        backlog: { saveStepSummary: () => Promise.resolve() },
        techStack: { detectTechStack: () => Promise.resolve({ primaryLanguage: 'javascript' }) },
        gitOps: { getModifiedFiles: () => Promise.resolve([]) },
        aiHelper: mockAiHelper,
        aiCache: mockAiCache,
      });
      const result = await analyzer.execute('/project', { alternatives: 2 });
      expect(capturedPrompt).toMatch(/ALTERNATIVE/i);
      expect(result.alternatives).toHaveLength(2);
      expect(result.recommendedAlternative).toBeTruthy();
    });
  });
});
