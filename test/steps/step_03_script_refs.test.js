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
  buildDocCoverageMap,
  formatDocCoverageMap,
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

    test('finds script in extraDocs when not in README', () => {
      const readme = 'No scripts here';
      const extraDocs = [{ path: 'docs/API.md', content: 'See deploy.sh for deployment' }];
      expect(isScriptDocumented('scripts/deploy.sh', readme, extraDocs)).toBe(true);
    });

    test('returns false when not in README or extraDocs', () => {
      const readme = 'No scripts here';
      const extraDocs = [{ path: 'docs/API.md', content: 'Only mentions build.sh' }];
      expect(isScriptDocumented('deploy.sh', readme, extraDocs)).toBe(false);
    });

    test('handles empty extraDocs gracefully', () => {
      const readme = 'Use deploy.sh';
      expect(isScriptDocumented('deploy.sh', readme, [])).toBe(true);
    });
  });

  // ========================================================================
  // PURE FUNCTIONS - Doc Coverage Map
  // ========================================================================

  describe('buildDocCoverageMap', () => {
    const docFiles = [
      { path: 'README.md', content: 'Use deploy.sh and cdn-delivery.sh here' },
      { path: 'docs/API.md', content: 'See scripts/deploy.sh for details' },
    ];

    test('marks script as found when mentioned in a doc file', () => {
      const map = buildDocCoverageMap(['scripts/deploy.sh'], docFiles);
      expect(map[0].script).toBe('scripts/deploy.sh');
      expect(map[0].foundIn).toContain('README.md');
      expect(map[0].foundIn).toContain('docs/API.md');
      expect(map[0].missingFrom).toHaveLength(0);
    });

    test('marks script as missing from docs where it is absent', () => {
      const map = buildDocCoverageMap(['cdn-delivery.sh'], docFiles);
      expect(map[0].foundIn).toContain('README.md');
      expect(map[0].missingFrom).toContain('docs/API.md');
    });

    test('marks script as missing from all docs when not mentioned anywhere', () => {
      const map = buildDocCoverageMap(['colors.sh'], docFiles);
      expect(map[0].foundIn).toHaveLength(0);
      expect(map[0].missingFrom).toEqual(['README.md', 'docs/API.md']);
    });

    test('returns empty array for empty script list', () => {
      expect(buildDocCoverageMap([], docFiles)).toEqual([]);
    });

    test('returns empty foundIn and missingFrom for empty docFiles', () => {
      const map = buildDocCoverageMap(['deploy.sh'], []);
      expect(map[0].foundIn).toHaveLength(0);
      expect(map[0].missingFrom).toHaveLength(0);
    });
  });

  describe('formatDocCoverageMap', () => {
    test('formats a fully documented script correctly', () => {
      const map = [{ script: 'deploy.sh', foundIn: ['README.md', 'docs/API.md'], missingFrom: [] }];
      const output = formatDocCoverageMap(map);
      expect(output).toContain('deploy.sh');
      expect(output).toContain('documented in [README.md, docs/API.md]');
      expect(output).not.toContain('MISSING');
    });

    test('formats a partially documented script correctly', () => {
      const map = [{ script: 'cdn-delivery.sh', foundIn: ['README.md'], missingFrom: ['docs/API.md'] }];
      const output = formatDocCoverageMap(map);
      expect(output).toContain('documented in [README.md]');
      expect(output).toContain('MISSING from [docs/API.md]');
    });

    test('formats a fully undocumented script correctly', () => {
      const map = [{ script: 'colors.sh', foundIn: [], missingFrom: ['README.md'] }];
      const output = formatDocCoverageMap(map);
      expect(output).toContain('NOT found in any doc file');
    });

    test('handles multiple scripts', () => {
      const map = [
        { script: 'a.sh', foundIn: ['README.md'], missingFrom: [] },
        { script: 'b.sh', foundIn: [], missingFrom: ['README.md'] },
      ];
      const output = formatDocCoverageMap(map);
      expect(output).toContain('a.sh');
      expect(output).toContain('b.sh');
    });
  });


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
        aiHelper: { initialize: () => Promise.resolve(false) },
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

    test('ignores cross-language references to avoid false positives', async () => {
      // bash project with .ts and .js references in README → should not flag as missing
      mockTechStack.detectTechStack = () => Promise.resolve({ primaryLanguage: 'bash' });
      mockFileOps.glob = () => Promise.resolve(['scripts/deploy.sh']);
      // README references a .ts file and a .sh file that doesn't exist
      mockFileOps.readFile = () => Promise.resolve('Run `src/api.ts` and `./scripts/missing.sh`');

      const result = await analyzer.execute('/project');

      expect(result.success).toBe(true);
      // Only the missing .sh reference should be flagged, not the .ts reference
      expect(result.missingReferences.every((r) => r.reference.endsWith('.sh'))).toBe(true);
      expect(result.referencesChecked).toBe(1); // only the .sh reference
    });

    // [BUG FIX fdfb34d] filter by detected language extension
    test('[BUG FIX] TypeScript project ignores .sh script references in README', async () => {
      mockTechStack.detectTechStack = () => Promise.resolve({ primaryLanguage: 'typescript' });
      mockFileOps.glob = () => Promise.resolve(['src/api.ts', 'src/server.ts']);
      // README references a shell script — must not be flagged as missing
      mockFileOps.readFile = () => Promise.resolve('Run `./scripts/deploy.sh` to deploy.');

      const result = await analyzer.execute('/project');

      expect(result.success).toBe(true);
      expect(result.missingReferences).toHaveLength(0);
    });

    test('[BUG FIX] Python project ignores .js script references in README', async () => {
      mockTechStack.detectTechStack = () => Promise.resolve({ primaryLanguage: 'python' });
      mockFileOps.glob = () => Promise.resolve(['src/main.py', 'src/utils.py']);
      // README references a JS file — must not be flagged
      mockFileOps.readFile = () => Promise.resolve('Frontend built with `src/app.js`.');

      const result = await analyzer.execute('/project');

      expect(result.success).toBe(true);
      expect(result.missingReferences).toHaveLength(0);
    });

    test('[BUG FIX] only same-language missing references are reported', async () => {
      // bash project: .sh ref is missing but .py ref must be ignored
      mockTechStack.detectTechStack = () => Promise.resolve({ primaryLanguage: 'bash' });
      mockFileOps.glob = () => Promise.resolve(['scripts/setup.sh']); // only setup exists
      mockFileOps.readFile = () =>
        Promise.resolve('Run `scripts/setup.sh` and `scripts/deploy.sh` and `src/helper.py`');

      const result = await analyzer.execute('/project');

      expect(result.success).toBe(true);
      const flaggedRefs = result.missingReferences.map((r) => r.reference);
      expect(flaggedRefs).toContain('scripts/deploy.sh'); // .sh is missing → flagged
      expect(flaggedRefs.every((r) => r.endsWith('.sh'))).toBe(true); // no .py
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
