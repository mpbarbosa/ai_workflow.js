/**
 * Tests for Step 3: Script Reference Validation
 * @group steps
 */

import {
  Step3ScriptAnalyzer,
  getScriptPatterns,
  getScriptDirectories,
  extractScriptReferences,
  validateScriptReferences,
  validateShebang,
  isScriptDocumented,
  formatScriptReport,
  SCRIPT_ISSUE_TYPE,
} from '../../src/steps/step_03_script_refs.js';

describe('Step 3: Script Reference Validation', () => {
  // ========================================================================
  // PURE FUNCTIONS - Pattern Detection
  // ========================================================================

  describe('getScriptPatterns', () => {
    test('returns bash patterns', () => {
      expect(getScriptPatterns('bash')).toEqual(['*.sh']);
    });

    test('returns python patterns', () => {
      expect(getScriptPatterns('python')).toEqual(['*.py']);
    });

    test('returns javascript patterns', () => {
      expect(getScriptPatterns('javascript')).toEqual(['*.js', '*.mjs']);
    });

    test('defaults to bash for unknown language', () => {
      expect(getScriptPatterns('unknown')).toEqual(['*.sh']);
    });

    test('handles case insensitivity', () => {
      expect(getScriptPatterns('PYTHON')).toEqual(['*.py']);
    });
  });

  describe('getScriptDirectories', () => {
    test('returns bash directories', () => {
      expect(getScriptDirectories('bash')).toEqual(['.', 'scripts', 'src/scripts', 'src/workflow']);
    });

    test('returns python directories', () => {
      expect(getScriptDirectories('python')).toEqual(['scripts', 'src']);
    });

    test('defaults to scripts for unknown language', () => {
      expect(getScriptDirectories('unknown')).toEqual(['scripts']);
    });
  });

  // ========================================================================
  // PURE FUNCTIONS - Reference Extraction
  // ========================================================================

  describe('extractScriptReferences', () => {
    test('extracts inline script references', () => {
      const content = 'Run `./scripts/build.sh` to build';
      const refs = extractScriptReferences(content);

      expect(refs).toContain('scripts/build.sh');
    });

    test('extracts multiple references', () => {
      const content = 'Use `./build.sh` and `./test.sh`';
      const refs = extractScriptReferences(content);

      expect(refs).toContain('build.sh');
      expect(refs).toContain('test.sh');
    });

    test('extracts references from code blocks', () => {
      const content = '```bash\n./scripts/deploy.sh\n```';
      const refs = extractScriptReferences(content);

      expect(refs).toContain('scripts/deploy.sh');
    });

    test('extracts python script references', () => {
      const content = 'Run `./scripts/analyze.py` for analysis';
      const refs = extractScriptReferences(content);

      expect(refs).toContain('scripts/analyze.py');
    });

    test('removes duplicate references', () => {
      const content = 'Use `./build.sh` and `./build.sh` again';
      const refs = extractScriptReferences(content);

      expect(refs).toHaveLength(1);
    });

    test('handles content with no references', () => {
      const content = 'This is a document without script references';
      expect(extractScriptReferences(content)).toHaveLength(0);
    });
  });

  describe('validateScriptReferences', () => {
    test('passes when all references exist', () => {
      const references = ['build.sh', 'test.sh'];
      const existing = new Set(['build.sh', 'test.sh', 'deploy.sh']);

      const issues = validateScriptReferences(references, existing);
      expect(issues).toHaveLength(0);
    });

    test('detects missing references', () => {
      const references = ['build.sh', 'missing.sh'];
      const existing = new Set(['build.sh']);

      const issues = validateScriptReferences(references, existing);
      expect(issues).toHaveLength(1);
      expect(issues[0].reference).toBe('missing.sh');
      expect(issues[0].type).toBe(SCRIPT_ISSUE_TYPE.MISSING_REFERENCE);
    });

    test('normalizes paths with ./', () => {
      const references = ['./build.sh'];
      const existing = new Set(['build.sh']);

      const issues = validateScriptReferences(references, existing);
      expect(issues).toHaveLength(0);
    });
  });

  // ========================================================================
  // PURE FUNCTIONS - Script Validation
  // ========================================================================

  describe('validateShebang', () => {
    test('validates bash shebang', () => {
      const content = '#!/bin/bash\necho "Hello"';
      const result = validateShebang(content, '.sh');

      expect(result.valid).toBe(true);
    });

    test('validates env bash shebang', () => {
      const content = '#!/usr/bin/env bash\necho "Hello"';
      const result = validateShebang(content, '.sh');

      expect(result.valid).toBe(true);
    });

    test('validates python shebang', () => {
      const content = '#!/usr/bin/env python3\nprint("Hello")';
      const result = validateShebang(content, '.py');

      expect(result.valid).toBe(true);
    });

    test('detects missing shebang', () => {
      const content = 'echo "No shebang"';
      const result = validateShebang(content, '.sh');

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('missing_shebang');
    });

    test('detects invalid shebang', () => {
      const content = '#!/bin/zsh\necho "Wrong shell"';
      const result = validateShebang(content, '.sh');

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('invalid_shebang');
    });

    test('allows scripts without required shebang', () => {
      const content = 'const x = 1;';
      const result = validateShebang(content, '.js');

      expect(result.valid).toBe(true);
      expect(result.reason).toBe('not_required');
    });
  });

  describe('isScriptDocumented', () => {
    test('finds script by name', () => {
      const readme = 'Use build.sh to build the project';
      expect(isScriptDocumented('scripts/build.sh', readme)).toBe(true);
    });

    test('finds script by full path', () => {
      const readme = 'Run ./scripts/build.sh';
      expect(isScriptDocumented('scripts/build.sh', readme)).toBe(true);
    });

    test('handles path with ./ prefix', () => {
      const readme = 'Execute `./build.sh`';
      expect(isScriptDocumented('./build.sh', readme)).toBe(true);
    });

    test('returns false when not documented', () => {
      const readme = 'No mention of any scripts';
      expect(isScriptDocumented('build.sh', readme)).toBe(false);
    });
  });

  // ========================================================================
  // PURE FUNCTIONS - Reporting
  // ========================================================================

  describe('formatScriptReport', () => {
    test('formats report with no issues', () => {
      const results = {
        scriptsFound: 5,
        referencesChecked: 3,
        totalIssues: 0,
        missingReferences: [],
        nonExecutable: [],
        undocumented: [],
      };
      const report = formatScriptReport(results);

      expect(report).toContain('## Step 3');
      expect(report).toContain('Scripts found**: 5');
      expect(report).toContain('✅');
    });

    test('formats report with issues', () => {
      const results = {
        scriptsFound: 5,
        referencesChecked: 3,
        totalIssues: 3,
        missingReferences: [{ reference: './missing.sh', normalized: 'missing.sh' }],
        nonExecutable: ['scripts/test.sh'],
        undocumented: ['scripts/deploy.sh'],
      };
      const report = formatScriptReport(results);

      expect(report).toContain('Total issues**: 3');
      expect(report).toContain('⚠️');
      expect(report).toContain('Missing References');
      expect(report).toContain('Non-Executable Scripts');
      expect(report).toContain('Undocumented Scripts');
    });

    test('limits displayed issues', () => {
      const missingRefs = Array.from({ length: 15 }, (_, i) => ({
        reference: `missing${i}.sh`,
        normalized: `missing${i}.sh`,
      }));

      const results = {
        scriptsFound: 20,
        referencesChecked: 15,
        totalIssues: 15,
        missingReferences: missingRefs,
        nonExecutable: [],
        undocumented: [],
      };
      const report = formatScriptReport(results);

      expect(report).toContain('... and 5 more');
    });
  });

  // ========================================================================
  // STEP 3 ANALYZER - Integration Tests
  // ========================================================================

  describe('Step3ScriptAnalyzer', () => {
    let analyzer;
    let mockFileOps;
    let mockBacklog;
    let mockTechStack;

    beforeEach(() => {
      mockFileOps = {
        glob: () => Promise.resolve([]),
        readFile: () => Promise.resolve(''),
        stat: () => Promise.resolve({ mode: 0o755 }),
      };

      mockBacklog = {
        saveStepSummary: () => Promise.resolve(),
      };

      mockTechStack = {
        detectTechStack: () => Promise.resolve({ primaryLanguage: 'bash' }),
      };

      analyzer = new Step3ScriptAnalyzer({
        fileOps: mockFileOps,
        backlog: mockBacklog,
        techStack: mockTechStack,
      });
    });

    test('skips when no scripts found', async () => {
      mockFileOps.glob = () => Promise.resolve([]);

      const result = await analyzer.execute('/project');

      expect(result.success).toBe(true);
      expect(result.skipped).toBe(true);
      expect(result.reason).toBe('no_scripts');
    });

    test('executes successfully with scripts', async () => {
      mockFileOps.glob = () => Promise.resolve(['scripts/build.sh', 'scripts/test.sh']);
      mockFileOps.readFile = () =>
        Promise.resolve('Run `./scripts/build.sh` and `./scripts/test.sh`');

      const result = await analyzer.execute('/project');

      expect(result.success).toBe(true);
      expect(result.scriptsFound).toBe(2);
      expect(result.totalIssues).toBe(0);
    });

    test('detects missing references', async () => {
      mockFileOps.glob = () => Promise.resolve(['scripts/build.sh']);
      mockFileOps.readFile = () => Promise.resolve('Run `./scripts/missing.sh`');

      const result = await analyzer.execute('/project');

      expect(result.success).toBe(true);
      expect(result.missingReferences.length).toBeGreaterThan(0);
    });

    test('detects non-executable scripts', async () => {
      mockFileOps.glob = () => Promise.resolve(['scripts/build.sh']);
      mockFileOps.readFile = () => Promise.resolve('');
      mockFileOps.stat = () => Promise.resolve({ mode: 0o644 }); // Not executable

      const result = await analyzer.execute('/project');

      expect(result.success).toBe(true);
      expect(result.nonExecutable).toContain('scripts/build.sh');
    });

    test('detects undocumented scripts', async () => {
      mockFileOps.glob = () => Promise.resolve(['scripts/build.sh', 'scripts/hidden.sh']);
      mockFileOps.readFile = () => Promise.resolve('Only mentions build.sh');

      const result = await analyzer.execute('/project');

      expect(result.success).toBe(true);
      expect(result.undocumented).toContain('scripts/hidden.sh');
    });

    test('handles different languages', async () => {
      mockTechStack.detectTechStack = () => Promise.resolve({ primaryLanguage: 'python' });
      mockFileOps.glob = () => Promise.resolve(['scripts/analyze.py']);
      mockFileOps.readFile = () => Promise.resolve('Run analyze.py');

      const result = await analyzer.execute('/project');

      expect(result.success).toBe(true);
      expect(result.scriptsFound).toBe(1);
    });

    test('saves report to backlog', async () => {
      let savedContent = null;
      mockFileOps.glob = () => Promise.resolve(['scripts/build.sh']);
      mockFileOps.readFile = () => Promise.resolve('Run build.sh');
      mockBacklog.saveStepSummary = (step, title, content) => {
        savedContent = content;
        return Promise.resolve();
      };

      await analyzer.execute('/project');

      expect(savedContent).toBeTruthy();
      expect(savedContent).toContain('Step 3');
    });

    test('handles errors gracefully', async () => {
      mockTechStack.detectTechStack = () => Promise.reject(new Error('Detection failed'));

      // Should still work with default language
      const result = await analyzer.execute('/project');

      expect(result.success).toBe(true);
      expect(result.skipped).toBe(true); // No scripts found
    });
  });
});
