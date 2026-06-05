/**
 * Tests for Step 5: Directory Structure Validation
 * @group steps
 */

import fs from 'fs/promises';
import {
  Step5DirectoryAnalyzer,
  shouldStayInRoot,
  categorizeMisplacedDoc,
  getTargetDir,
  shouldIncludeDir,
  extractCriticalDirs,
  getDefaultCriticalDirs,
  isDirectoryDocumented,
  validateDirectoryStructure,
  buildDirectoryDocumentationContext,
  buildDirectoryDocumentationExcerpts,
  buildAuthoritativeConfigContext,
  buildPromptDirectoryTree,
  hasIncompleteDirectoryPromptEvidence,
  formatDirectoryReport,
  DIR_CATEGORIES,
  ISSUE_TYPE,
  EXCLUDED_DIR_PATHS,
  AUTHORITATIVE_CONFIG_FILES,
} from '../../src/steps/step_05_directory.js';

describe('Step 5: Directory Structure Validation', () => {
  // ========================================================================
  // PURE FUNCTIONS - File Classification
  // ========================================================================

  describe('shouldStayInRoot', () => {
    test('allows README.md in root', () => {
      expect(shouldStayInRoot('README.md')).toBe(true);
    });

    test('allows CHANGELOG.md in root', () => {
      expect(shouldStayInRoot('CHANGELOG.md')).toBe(true);
    });

    test('allows conventional project docs in root', () => {
      expect(shouldStayInRoot('CONTRIBUTING.md')).toBe(true);
      expect(shouldStayInRoot('CLAUDE.md')).toBe(true);
      expect(shouldStayInRoot('ROADMAP.md')).toBe(true);
    });

    test('rejects other markdown files', () => {
      expect(shouldStayInRoot('SOME_DOC.md')).toBe(false);
      expect(shouldStayInRoot('guide.md')).toBe(false);
    });
  });

  describe('categorizeDocFile', () => {
    test('categorizes workflow files', () => {
      expect(categorizeMisplacedDoc('WORKFLOW_GUIDE.md')).toBe(DIR_CATEGORIES.WORKFLOW);
      expect(categorizeMisplacedDoc('PIPELINE_EXECUTION.md')).toBe(DIR_CATEGORIES.WORKFLOW);
    });

    test('categorizes test files', () => {
      expect(categorizeMisplacedDoc('TEST_COVERAGE.md')).toBe(DIR_CATEGORIES.TEST);
      expect(categorizeMisplacedDoc('SPEC_GUIDE.md')).toBe(DIR_CATEGORIES.TEST);
    });

    test('categorizes bugfix files', () => {
      expect(categorizeMisplacedDoc('BUGFIX_REPORT.md')).toBe(DIR_CATEGORIES.BUGFIX);
      expect(categorizeMisplacedDoc('ISSUE_123.md')).toBe(DIR_CATEGORIES.BUGFIX);
    });

    test('categorizes implementation files', () => {
      expect(categorizeMisplacedDoc('IMPLEMENTATION_PLAN.md')).toBe(DIR_CATEGORIES.IMPLEMENTATION);
      expect(categorizeMisplacedDoc('MIGRATION_GUIDE.md')).toBe(DIR_CATEGORIES.IMPLEMENTATION);
    });

    test('categorizes analysis files', () => {
      expect(categorizeMisplacedDoc('ANALYSIS_REPORT.md')).toBe(DIR_CATEGORIES.ANALYSIS);
      expect(categorizeMisplacedDoc('REVIEW_NOTES.md')).toBe(DIR_CATEGORIES.ANALYSIS);
    });

    test('categorizes guide files', () => {
      expect(categorizeMisplacedDoc('GUIDE.md')).toBe(DIR_CATEGORIES.GUIDE);
      expect(categorizeMisplacedDoc('TUTORIAL.md')).toBe(DIR_CATEGORIES.GUIDE);
      expect(categorizeMisplacedDoc('CONTRIBUTING.md')).toBe(DIR_CATEGORIES.GUIDE);
    });

    test('categorizes architecture files', () => {
      expect(categorizeMisplacedDoc('ARCHITECTURE.md')).toBe(DIR_CATEGORIES.ARCHITECTURE);
      expect(categorizeMisplacedDoc('DESIGN_PATTERNS.md')).toBe(DIR_CATEGORIES.ARCHITECTURE);
    });

    test('categorizes report files', () => {
      expect(categorizeMisplacedDoc('DELIVERABLE.md')).toBe(DIR_CATEGORIES.REPORT);
      expect(categorizeMisplacedDoc('PHASE_1.md')).toBe(DIR_CATEGORIES.REPORT);
    });

    test('defaults to uncategorized', () => {
      expect(categorizeMisplacedDoc('RANDOM_FILE.md')).toBe(DIR_CATEGORIES.UNCATEGORIZED);
    });
  });

  describe('getTargetDir', () => {
    test('returns correct directory for workflow', () => {
      expect(getTargetDir(DIR_CATEGORIES.WORKFLOW)).toBe('docs/workflow-automation');
    });

    test('returns correct directory for test', () => {
      expect(getTargetDir(DIR_CATEGORIES.TEST)).toBe('docs/testing');
    });

    test('returns misc for uncategorized', () => {
      expect(getTargetDir(DIR_CATEGORIES.UNCATEGORIZED)).toBe('docs/misc');
    });

    test('returns misc for unknown category', () => {
      expect(getTargetDir('unknown')).toBe('docs/misc');
    });
  });

  describe('shouldIncludeDir', () => {
    test('includes regular directories', () => {
      expect(shouldIncludeDir('src')).toBe(true);
      expect(shouldIncludeDir('docs')).toBe(true);
      expect(shouldIncludeDir('lib')).toBe(true);
    });

    test('excludes node_modules', () => {
      expect(shouldIncludeDir('node_modules')).toBe(false);
      expect(shouldIncludeDir('src/node_modules')).toBe(false);
    });

    test('excludes .git', () => {
      expect(shouldIncludeDir('.git')).toBe(false);
      expect(shouldIncludeDir('project/.git')).toBe(false);
    });

    test('excludes coverage', () => {
      expect(shouldIncludeDir('coverage')).toBe(false);
    });

    test('excludes build directories', () => {
      expect(shouldIncludeDir('dist')).toBe(false);
      expect(shouldIncludeDir('build')).toBe(false);
    });

    test('excludes directories matching EXCLUDED_DIR_PATHS prefix', () => {
      for (const prefix of EXCLUDED_DIR_PATHS) {
        expect(shouldIncludeDir(prefix)).toBe(false);
        expect(shouldIncludeDir(`${prefix}/sub`)).toBe(false);
        expect(shouldIncludeDir(`${prefix}/sub/deep`)).toBe(false);
      }
    });

    test('does not exclude sibling directories with similar names', () => {
      // e.g. docs/api/html is excluded but docs/api itself is not
      expect(shouldIncludeDir('docs/api')).toBe(true);
      expect(shouldIncludeDir('docs')).toBe(true);
    });
  });

  // ========================================================================
  // PURE FUNCTIONS - Directory Validation
  // ========================================================================

  describe('extractCriticalDirs', () => {
    test('extracts directories from config', () => {
      const config = {
        structure: {
          src_dirs: ['src', 'lib'],
          test_dirs: ['test', 'tests'],
          docs_dirs: ['docs'],
        },
      };

      const result = extractCriticalDirs(config);
      expect(result).toContain('src');
      expect(result).toContain('lib');
      expect(result).toContain('test');
      expect(result).toContain('tests');
      expect(result).toContain('docs');
    });

    test('handles missing config', () => {
      expect(extractCriticalDirs(null)).toEqual([]);
      expect(extractCriticalDirs({})).toEqual([]);
    });

    test('removes duplicates', () => {
      const config = {
        structure: {
          src_dirs: ['src', 'src'],
          test_dirs: ['test'],
        },
      };

      const result = extractCriticalDirs(config);
      expect(result.filter((d) => d === 'src')).toHaveLength(1);
    });

    test('handles empty arrays', () => {
      const config = {
        structure: {
          src_dirs: [],
          test_dirs: [],
          docs_dirs: [],
        },
      };

      expect(extractCriticalDirs(config)).toEqual([]);
    });
  });

  describe('getDefaultCriticalDirs', () => {
    test('returns empty array when no known directories exist', () => {
      const result = getDefaultCriticalDirs([]);
      expect(result).toEqual([]);
    });

    test('includes .github when it exists', () => {
      const result = getDefaultCriticalDirs(['.github', 'src']);
      expect(result).toContain('.github');
      expect(result).toContain('src');
    });

    test('does not include .github when it does not exist', () => {
      const result = getDefaultCriticalDirs(['src', 'docs']);
      expect(result).not.toContain('.github');
    });

    test('includes existing standard directories', () => {
      const existing = ['src', 'docs', 'test'];
      const result = getDefaultCriticalDirs(existing);

      expect(result).toContain('src');
      expect(result).toContain('docs');
      expect(result).toContain('test');
    });

    test('excludes non-existing directories', () => {
      const existing = ['src'];
      const result = getDefaultCriticalDirs(existing);

      expect(result).toContain('src');
      expect(result).not.toContain('lib');
      expect(result).not.toContain('bin');
    });
  });

  describe('isDirectoryDocumented', () => {
    test('returns true if directory is in any doc', () => {
      const docs = ['This project has a src/ directory', 'Other content'];
      expect(isDirectoryDocumented('src', docs)).toBe(true);
    });

    test('returns true if directory is listed in an INDEX.md inventory', () => {
      const docs = [
        {
          path: 'INDEX.md',
          content: ['## Repository Layout', 'ai_workflow_fspec/', '└── docs/'].join('\n'),
        },
      ];
      expect(isDirectoryDocumented('docs', docs)).toBe(true);
    });

    test('returns false if directory is not in docs', () => {
      const docs = ['This project has a src/ directory'];
      expect(isDirectoryDocumented('lib', docs)).toBe(false);
    });

    test('handles empty docs', () => {
      expect(isDirectoryDocumented('src', [])).toBe(false);
    });
  });

  describe('validateDirectoryStructure', () => {
    test('detects missing critical directories', () => {
      const result = validateDirectoryStructure({
        existingDirs: ['src', 'docs'],
        criticalDirs: ['src', 'docs', 'test'],
        docEvidence: [],
      });

      expect(result.missingCritical).toBe(1);
      expect(result.issues).toContainEqual({
        type: ISSUE_TYPE.MISSING_CRITICAL,
        directory: 'test',
        message: 'Expected directory missing: test',
      });
    });

    test('detects undocumented directories', () => {
      const result = validateDirectoryStructure({
        existingDirs: ['src', 'lib'],
        criticalDirs: ['src'],
        docEvidence: ['Project has src directory'],
      });

      expect(result.undocumented).toBe(1);
      expect(
        result.issues.some((i) => i.type === ISSUE_TYPE.UNDOCUMENTED && i.directory === 'lib')
      ).toBe(true);
    });

    test('detects documented but missing directories', () => {
      const result = validateDirectoryStructure({
        existingDirs: ['src'],
        criticalDirs: ['src', 'lib'],
        docEvidence: ['Project has src and lib directories'],
      });

      expect(result.docMismatch).toBe(1);
      expect(
        result.issues.some((i) => i.type === ISSUE_TYPE.DOC_MISMATCH && i.directory === 'lib')
      ).toBe(true);
    });

    test('returns no issues for valid structure', () => {
      const result = validateDirectoryStructure({
        existingDirs: ['src', 'docs'],
        criticalDirs: ['src', 'docs'],
        docEvidence: ['Project has src and docs directories'],
      });

      expect(result.issues).toHaveLength(0);
      expect(result.missingCritical).toBe(0);
      expect(result.undocumented).toBe(0);
      expect(result.docMismatch).toBe(0);
    });

    test('skips excluded directories', () => {
      const result = validateDirectoryStructure({
        existingDirs: ['src', 'node_modules', '.git'],
        criticalDirs: ['src'],
        docEvidence: ['Project has src'],
      });

      // node_modules and .git should not be flagged as undocumented
      expect(result.undocumented).toBe(0);
    });
  });

  describe('buildDirectoryDocumentationExcerpts', () => {
    test('includes later directory structure evidence beyond the doc head', () => {
      const lines = Array.from({ length: 140 }, (_, index) => `line ${index + 1}`);
      lines[110] = '## Directory Structure';
      lines[111] = '```';
      lines[112] = 'ai_workflow_core/';
      lines[113] = '├── docs/';
      lines[114] = '│   └── misc/';
      lines[115] = '```';

      const excerpt = buildDirectoryDocumentationExcerpts(
        [{ path: 'docs/ARCHITECTURE.md', content: lines.join('\n') }],
        ['docs/misc']
      );

      expect(excerpt).toContain('### docs/ARCHITECTURE.md');
      expect(excerpt).toContain('misc/');
      expect(excerpt).toContain('... [excerpt omitted]');
    });

    test('prioritizes structural inventories over an oversized README excerpt', () => {
      const readme = Array.from({ length: 220 }, (_, index) => `README line ${index + 1}`).join(
        '\n'
      );
      const excerpt = buildDirectoryDocumentationExcerpts(
        [
          { path: 'README.md', content: readme },
          {
            path: 'docs/ARCHITECTURE.md',
            content: ['# Architecture', '## Directory Structure', '- `src/composables/`'].join(
              '\n'
            ),
          },
          {
            path: '.github/SKILLS.md',
            content: [
              '# Skills',
              '| Skill | Purpose |',
              '| Sync version | Propagate versions |',
            ].join('\n'),
          },
        ],
        ['src/composables', '.github/skills/sync-version'],
        1200
      );

      expect(excerpt).toContain('### docs/ARCHITECTURE.md');
      expect(excerpt).toContain('src/composables/');
      expect(excerpt).toContain('### .github/SKILLS.md');
      expect(excerpt).toContain('Sync version');
    });

    test('preserves targeted directory evidence from a long architecture tree', () => {
      const lines = Array.from({ length: 180 }, (_, index) => `line ${index + 1}`);
      lines[0] = '# Architecture';
      lines[25] = '## Directory Structure';
      lines[26] = '```text';
      lines[27] = 'paraty_geocore.js/';
      lines[28] = '├── src/';
      lines[29] = '├── docs/';
      lines[30] = '├── test/';
      lines[31] = '├── .claude/';
      lines[32] = '│   └── README.md';
      lines[33] = '```';

      const excerpt = buildDirectoryDocumentationExcerpts(
        [{ path: 'docs/ARCHITECTURE.md', content: lines.join('\n') }],
        ['.claude'],
        1200
      );

      expect(excerpt).toContain('### docs/ARCHITECTURE.md');
      expect(excerpt).toContain('.claude/');
      expect(excerpt).toContain('README.md');
    });
  });

  describe('buildDirectoryDocumentationContext', () => {
    test('includes full prioritized file contents without excerpt markers', () => {
      const context = buildDirectoryDocumentationContext([
        {
          path: 'README.md',
          content: ['# Project', 'README line 2'].join('\n'),
        },
        {
          path: 'docs/ARCHITECTURE.md',
          content: ['# Architecture', '## Directory Structure', '- `src/composables/`'].join('\n'),
        },
      ]);

      expect(context).toContain('### docs/ARCHITECTURE.md');
      expect(context).toContain('## Directory Structure');
      expect(context).toContain('### README.md');
      expect(context).toContain('README line 2');
      expect(context).not.toContain('[excerpt omitted]');
      expect(context).not.toContain('[excerpt truncated]');
    });

    test('marks truncated documentation context as incomplete evidence', () => {
      const context = buildDirectoryDocumentationContext(
        [{ path: 'README.md', content: 'A'.repeat(64) }],
        40
      );

      expect(context).toContain('... [truncated]');
      expect(hasIncompleteDirectoryPromptEvidence(context)).toBe(true);
    });
  });

  describe('buildPromptDirectoryTree', () => {
    test('returns the full ordered tree by default', () => {
      const dirTree = buildPromptDirectoryTree(['docs', 'src', 'src/components', 'tests', 'zzz'], {
        structure: {
          source_dirs: ['src'],
          test_dirs: ['tests'],
          docs_dirs: ['docs'],
        },
      });

      expect(dirTree.split('\n')).toEqual(['docs', 'src', 'tests', 'zzz', 'src/components']);
      expect(dirTree).not.toContain('[truncated:');
    });

    test('prioritizes config-defined directories and makes truncation explicit', () => {
      const dirTree = buildPromptDirectoryTree(
        [
          '.github',
          '.github/skills',
          '__tests__',
          '__tests__/helpers',
          'docs',
          'public',
          'src',
          'src/components',
          'src/components/views',
          'src/html',
          'src/views',
          'tests',
          'zzz',
        ],
        {
          structure: {
            source_dirs: ['src'],
            test_dirs: ['tests', '__tests__'],
            docs_dirs: ['docs'],
            ui_dirs: ['src/components/views', 'src/html', 'src/views'],
            static_assets: ['public/service-worker.js'],
          },
        },
        5
      );

      expect(dirTree.split('\n').slice(0, 5)).toEqual([
        '__tests__',
        'docs',
        'src',
        'tests',
        'src/components',
      ]);
      expect(dirTree).toContain('... [truncated:');
    });

    test('returns none when there are no directories to show', () => {
      expect(buildPromptDirectoryTree([], null)).toBe('none');
    });

    test('does not promote parent directories solely from static asset file requirements', () => {
      const dirTree = buildPromptDirectoryTree(
        ['docs', 'public', 'public/pwa', 'src', 'tests'],
        {
          structure: {
            source_dirs: ['src'],
            test_dirs: ['tests'],
            docs_dirs: ['docs'],
            static_assets: ['public/pwa/manifest.json'],
          },
        },
        3
      );

      expect(dirTree.split('\n').slice(0, 3)).toEqual(['docs', 'src', 'tests']);
      expect(dirTree.split('\n').slice(0, 3)).not.toContain('public/pwa');
    });
  });

  describe('buildAuthoritativeConfigContext', () => {
    test('returns empty string for empty input', () => {
      expect(buildAuthoritativeConfigContext([])).toBe('');
      expect(buildAuthoritativeConfigContext(null)).toBe('');
    });

    test('wraps yaml files in a yaml fenced block', () => {
      const result = buildAuthoritativeConfigContext([
        { path: '.workflow-config.yaml', content: 'version: 1.0.0\n' },
      ]);
      expect(result).toContain('### .workflow-config.yaml');
      expect(result).toContain('```yaml');
      expect(result).toContain('version: 1.0.0');
    });

    test('wraps js files in a js fenced block', () => {
      const result = buildAuthoritativeConfigContext([
        { path: 'vitest.config.js', content: 'export default { test: {} };\n' },
      ]);
      expect(result).toContain('### vitest.config.js');
      expect(result).toContain('```js');
      expect(result).toContain('export default');
    });

    test('wraps package.json in a json fenced block', () => {
      const result = buildAuthoritativeConfigContext([
        { path: 'package.json', content: '{ "version": "1.2.3" }\n' },
      ]);
      expect(result).toContain('### package.json');
      expect(result).toContain('```json');
      expect(result).toContain('"version": "1.2.3"');
    });

    test('separates multiple files with a blank line', () => {
      const result = buildAuthoritativeConfigContext([
        { path: '.workflow-config.yaml', content: 'a: 1' },
        { path: 'vitest.config.js', content: 'b = 2' },
      ]);
      expect(result).toContain('### .workflow-config.yaml');
      expect(result).toContain('### vitest.config.js');
      // two fenced blocks separated by blank line
      expect(result.match(/```/g)).toHaveLength(4);
    });

    test('marks truncated config context as incomplete evidence', () => {
      const result = buildAuthoritativeConfigContext(
        [{ path: '.workflow-config.yaml', content: `key: ${'x'.repeat(64)}` }],
        20
      );

      expect(result).toContain('... [truncated]');
      expect(hasIncompleteDirectoryPromptEvidence(result)).toBe(true);
    });
  });

  describe('AUTHORITATIVE_CONFIG_FILES', () => {
    test('includes .workflow-config.yaml as first entry', () => {
      expect(AUTHORITATIVE_CONFIG_FILES[0]).toBe('.workflow-config.yaml');
    });

    test('includes package.json for version cross-checking', () => {
      expect(AUTHORITATIVE_CONFIG_FILES).toContain('package.json');
    });

    test('includes common test runner configs', () => {
      expect(AUTHORITATIVE_CONFIG_FILES).toContain('vitest.config.js');
      expect(AUTHORITATIVE_CONFIG_FILES).toContain('jest.config.js');
    });
  });

  // ========================================================================
  // PURE FUNCTIONS - Reporting
  // ========================================================================

  describe('formatDirectoryReport', () => {
    test('formats report with no issues', () => {
      const results = {
        totalDirs: 5,
        misplacedDocs: 0,
        organizedDocs: 0,
        structureIssues: [],
        missingCritical: 0,
        undocumented: 0,
        docMismatch: 0,
      };

      const report = formatDirectoryReport(results);

      expect(report).toContain('Directory Structure Validation');
      expect(report).toContain('**Total Directories**: 5');
      expect(report).toContain('All Checks Passed');
    });

    test('formats report with misplaced docs', () => {
      const results = {
        totalDirs: 5,
        misplacedDocs: 3,
        organizedDocs: 2,
        structureIssues: [],
      };

      const report = formatDirectoryReport(results);

      expect(report).toContain('**Misplaced Documentation**: 3 file(s)');
      expect(report).toContain('**Organized Files**: 2 file(s)');
      expect(report).toContain('Documentation Organized');
    });

    test('formats report with critical issues', () => {
      const results = {
        totalDirs: 5,
        misplacedDocs: 0,
        organizedDocs: 0,
        structureIssues: [
          { type: ISSUE_TYPE.MISSING_CRITICAL, directory: 'test', message: 'Missing: test' },
        ],
        missingCritical: 1,
        undocumented: 0,
        docMismatch: 0,
      };

      const report = formatDirectoryReport(results);

      expect(report).toContain('Critical Issues');
      expect(report).toContain('**1** critical directories missing');
    });

    test('formats report with multiple issue types', () => {
      const results = {
        totalDirs: 5,
        misplacedDocs: 0,
        organizedDocs: 0,
        structureIssues: [
          { type: ISSUE_TYPE.MISSING_CRITICAL, directory: 'test', message: 'Missing: test' },
          { type: ISSUE_TYPE.UNDOCUMENTED, directory: 'lib', message: 'Undocumented: lib' },
        ],
        missingCritical: 1,
        undocumented: 1,
        docMismatch: 0,
      };

      const report = formatDirectoryReport(results);

      expect(report).toContain('Missing Critical: 1');
      expect(report).toContain('Undocumented: 1');
      expect(report).toContain('Issues Found');
    });

    test('truncates long issue lists', () => {
      const issues = Array(15)
        .fill(null)
        .map((_, i) => ({
          type: ISSUE_TYPE.UNDOCUMENTED,
          directory: `dir${i}`,
          message: `Undocumented: dir${i}`,
        }));

      const results = {
        totalDirs: 20,
        misplacedDocs: 0,
        organizedDocs: 0,
        structureIssues: issues,
        undocumented: 15,
      };

      const report = formatDirectoryReport(results);

      expect(report).toContain('... and 5 more');
    });

    test('includes degraded evidence warnings in the report', () => {
      const report = formatDirectoryReport({
        totalDirs: 2,
        misplacedDocs: 1,
        organizedDocs: 0,
        structureIssues: [],
        warnings: ['Project-kind guidance unavailable'],
      });

      expect(report).toContain('Evidence Limitations');
      expect(report).toContain('Project-kind guidance unavailable');
    });
  });

  // ========================================================================
  // STEP 5 ANALYZER - Integration Tests
  // ========================================================================

  describe('Step5DirectoryAnalyzer', () => {
    let analyzer;
    let mockFileOps;
    let mockBacklog;
    let mockGitOps;
    let mockConfig;

    beforeEach(() => {
      mockFileOps = {
        readFile: () => Promise.resolve(''),
        listDirectory: () => Promise.resolve([]),
      };

      mockBacklog = {
        saveStepSummary: () => Promise.resolve(),
      };

      mockGitOps = {
        getModifiedFiles: () => Promise.resolve([]),
      };

      mockConfig = {
        load: () => Promise.resolve({}),
      };

      analyzer = new Step5DirectoryAnalyzer({
        fileOps: mockFileOps,
        backlog: mockBacklog,
        gitOps: mockGitOps,
        config: mockConfig,
        aiHelper: { initialize: () => Promise.resolve(false) },
      });

      // Default: no subdirectories
      analyzer._listDirsRecursive = () => Promise.resolve([]);
    });

    test('executes successfully with no misplaced docs', async () => {
      mockFileOps.listDirectory = () =>
        Promise.resolve(['/project/README.md', '/project/package.json']);
      analyzer._listDirsRecursive = () =>
        Promise.resolve(['/project/src', '/project/docs', '/project/test']);

      mockFileOps.readFile = () => Promise.resolve('Project has src, docs, and test directories');

      mockConfig.load = () =>
        Promise.resolve({
          structure: { src_dirs: ['src'], test_dirs: ['test'], docs_dirs: ['docs'] },
        });

      const result = await analyzer.execute('/project');

      expect(result.success).toBe(true);
      expect(result.misplacedDocs).toBe(0);
      expect(result.totalDirs).toBe(3);
    });

    test('detects misplaced documentation', async () => {
      mockFileOps.listDirectory = () =>
        Promise.resolve([
          '/project/README.md',
          '/project/GUIDE.md',
          '/project/ANALYSIS.md',
          '/project/package.json',
        ]);
      analyzer._listDirsRecursive = () => Promise.resolve(['/project/src']);

      const result = await analyzer.execute('/project');

      expect(result.success).toBe(true);
      expect(result.misplacedDocs).toBe(2);
    });

    test('detects missing critical directories', async () => {
      mockFileOps.listDirectory = () => Promise.resolve([]);
      analyzer._listDirsRecursive = () => Promise.resolve(['/project/src']);

      mockConfig.load = () =>
        Promise.resolve({
          structure: { src_dirs: ['src'], test_dirs: ['test'], docs_dirs: ['docs'] },
        });

      const result = await analyzer.execute('/project');

      expect(result.success).toBe(true);
      expect(result.missingCritical).toBeGreaterThan(0);
    });

    test('validateStructure reads architecture docs before flagging undocumented directories', async () => {
      analyzer._listDirsRecursive = () => Promise.resolve(['/project/docs', '/project/docs/misc']);
      mockFileOps.readFile = (filePath) => {
        if (filePath === '/project/docs/ARCHITECTURE.md') {
          return Promise.resolve(
            ['## Directory Structure', 'ai_workflow_core/', '├── docs/', '│   └── misc/'].join('\n')
          );
        }
        return Promise.reject(new Error('missing'));
      };

      const result = await analyzer.validateStructure('/project');

      expect(result.undocumented).toBe(0);
      expect(result.issues).toEqual([]);
      expect(result.documentationFiles).toEqual([
        expect.objectContaining({ path: 'docs/ARCHITECTURE.md' }),
      ]);
    });

    test('validateStructure reads INDEX.md before flagging documented directories', async () => {
      analyzer._listDirsRecursive = () => Promise.resolve(['/project/docs']);
      mockFileOps.readFile = (filePath) => {
        if (filePath === '/project/INDEX.md') {
          return Promise.resolve(
            ['## Repository Layout', 'ai_workflow_fspec/', '└── docs/'].join('\n')
          );
        }
        return Promise.reject(new Error('missing'));
      };

      const result = await analyzer.validateStructure('/project');

      expect(result.undocumented).toBe(0);
      expect(result.issues).toEqual([]);
      expect(result.documentationFiles).toEqual([expect.objectContaining({ path: 'INDEX.md' })]);
    });

    test('collectDocumentationFiles reads shared and directory-local index files', async () => {
      const seenPaths = [];
      mockFileOps.readFile = (filePath) => {
        seenPaths.push(filePath);
        if (
          [
            '/project/.github/SKILLS.md',
            '/project/.github/skills/README.md',
            '/project/.github/skills/INDEX.md',
            '/project/docs/INDEX.md',
          ].includes(filePath)
        ) {
          return Promise.resolve(`# ${filePath}`);
        }
        return Promise.reject(new Error('missing'));
      };

      const docs = await analyzer.collectDocumentationFiles('/project', ['.github/skills', 'docs']);

      expect(seenPaths).toEqual(
        expect.arrayContaining([
          '/project/.github/SKILLS.md',
          '/project/.github/skills/README.md',
          '/project/.github/skills/INDEX.md',
          '/project/docs/INDEX.md',
        ])
      );
      expect(docs).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: '.github/SKILLS.md' }),
          expect.objectContaining({ path: '.github/skills/README.md' }),
          expect.objectContaining({ path: '.github/skills/INDEX.md' }),
          expect.objectContaining({ path: 'docs/INDEX.md' }),
        ])
      );
    });

    test('saves report to backlog', async () => {
      let savedTitle = '';
      mockBacklog.saveStepSummary = (step, title) => {
        savedTitle = title;
        return Promise.resolve();
      };

      await analyzer.execute('/project');

      expect(savedTitle).toBe('Directory Structure Validation');
    });

    test('handles errors gracefully', async () => {
      mockFileOps.listDirectory = () => Promise.reject(new Error('File system error'));
      analyzer._listDirsRecursive = () => Promise.reject(new Error('File system error'));

      // The execute method catches the error in organizeMisplacedDocs
      // and returns success: false would need to be re-thrown
      // For now, it's returning success with empty results
      const result = await analyzer.execute('/project');

      // Since we catch errors in sub-methods, this should still succeed
      // but with zero results
      expect(result.success).toBe(true);
      expect(result.totalDirs).toBe(0);
    });

    test('marks results degraded when project-kind guidance is unavailable during AI review', async () => {
      analyzer = new Step5DirectoryAnalyzer({
        fileOps: mockFileOps,
        backlog: mockBacklog,
        gitOps: mockGitOps,
        config: mockConfig,
        aiHelper: {
          initialize: () => Promise.resolve(true),
          executeRequest: () => Promise.resolve({ content: 'Keep docs grouped under docs/.' }),
        },
        aiCache: {
          init: () => Promise.resolve(),
          withFileChangeGuard: (_cacheKey, _entries, callback) => callback(),
        },
        projectKindConfig: {
          loadProjectKindsYaml: () => Promise.resolve(false),
          getProjectKind: () => Promise.resolve('library'),
          getAIGuidance: () => Promise.resolve(null),
        },
      });
      analyzer._listDirsRecursive = () => Promise.resolve(['/project/src']);
      mockFileOps.listDirectory = () =>
        Promise.resolve(['/project/README.md', '/project/GUIDE.md', '/project/package.json']);
      mockFileOps.readFile = () => Promise.resolve('Project has src and docs directories.');

      const result = await analyzer.execute('/project');

      expect(result.success).toBe(true);
      expect(result.degraded).toBe(true);
      expect(result.warnings).toEqual(
        expect.arrayContaining([
          expect.stringContaining('Project-kind directory guidance was unavailable'),
        ])
      );
    });

    test('passes directory-review validation context to the AI helper when prompt evidence is truncated', async () => {
      const executeCalls = [];
      const executeRequest = (prompt, requestOptions) => {
        executeCalls.push({ prompt, requestOptions });
        return Promise.resolve({ content: 'Inconclusive from the visible evidence.' });
      };
      analyzer = new Step5DirectoryAnalyzer({
        fileOps: mockFileOps,
        backlog: mockBacklog,
        gitOps: mockGitOps,
        config: mockConfig,
        aiHelper: {
          initialize: () => Promise.resolve(true),
          executeRequest,
        },
        aiCache: {
          init: () => Promise.resolve(),
          withFileChangeGuard: (_cacheKey, _entries, callback) => callback(),
        },
        projectKindConfig: {
          loadProjectKindsYaml: () => Promise.resolve(true),
          getProjectKind: () => Promise.resolve('library'),
          getAIGuidance: () => Promise.resolve({ directory_standards: [] }),
        },
      });
      analyzer._listDirsRecursive = () =>
        Promise.resolve(Array.from({ length: 305 }, (_, index) => `/project/dir-${index}`));
      mockFileOps.listDirectory = () =>
        Promise.resolve([
          '/project/README.md',
          '/project/package.json',
          '/project/.workflow-config.yaml',
        ]);
      mockFileOps.readFile = async (filePath) => {
        if (filePath.endsWith('README.md')) {
          return Promise.resolve('# README\n' + 'x'.repeat(25_000));
        }
        if (filePath.endsWith('package.json')) {
          return Promise.resolve('{ "version": "1.2.3" }');
        }
        if (filePath.endsWith('.workflow-config.yaml')) {
          return Promise.resolve('structure:\n  source_dirs:\n    - src');
        }
        if (
          filePath.endsWith('/.workflow_core/config/ai_helpers.yaml') ||
          filePath.endsWith('/.workflow_core/config/prompt_roles.yaml')
        ) {
          return fs.readFile(filePath, 'utf8');
        }
        return Promise.reject(new Error('missing'));
      };

      await analyzer.execute('/project', { language: 'typescript' });

      expect(executeCalls).toHaveLength(1);
      expect(executeCalls[0]).toEqual(
        expect.objectContaining({
          prompt: expect.any(String),
          requestOptions: expect.objectContaining({
            persona: 'architecture_reviewer',
            responseType: 'directory_review',
            validationContext: { hasIncompleteEvidence: true },
          }),
        })
      );
    });
  });
});
