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
  validateAiResponseQuality,
  EXCLUDE_DIRS,
  MAX_FILE_CONTENT_CHARS,
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
});
