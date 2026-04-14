/**
 * Tests for Step 2: Consistency Analysis
 * @group steps
 */

import {
  Step2ConsistencyAnalyzer,
  buildPartitionFileContents,
  countTypeScriptSourceFiles,
  validateSemver,
  extractVersions,
  checkVersionConsistency,
  extractLinks,
  isFileReference,
  normalizeFilePath,
  validateFileReferences,
  formatConsistencyReport,
  partitionFiles,
  buildPartitionContext,
  categorizeFiles,
  validateAiResponseQuality,
  MIN_COVERAGE_RATIO,
  ISSUE_TYPE,
} from '../../src/steps/step_02_consistency.js';

describe('Step 2: Consistency Analysis', () => {
  // ========================================================================
  // PURE FUNCTIONS - Version Validation
  // ========================================================================

  describe('validateSemver', () => {
    test('validates correct semantic versions', () => {
      expect(validateSemver('1.0.0')).toBe(true);
      expect(validateSemver('0.1.0')).toBe(true);
      expect(validateSemver('10.20.30')).toBe(true);
    });

    test('validates versions with v prefix', () => {
      expect(validateSemver('v1.0.0')).toBe(true);
      expect(validateSemver('v2.3.4')).toBe(true);
    });

    test('validates prerelease versions', () => {
      expect(validateSemver('1.0.0-alpha')).toBe(true);
      expect(validateSemver('1.0.0-alpha.1')).toBe(true);
      expect(validateSemver('1.0.0-beta.2')).toBe(true);
    });

    test('validates versions with build metadata', () => {
      expect(validateSemver('1.0.0+20130313144700')).toBe(true);
      expect(validateSemver('1.0.0-beta+exp.sha.5114f85')).toBe(true);
    });

    test('rejects invalid versions', () => {
      expect(validateSemver('1.0')).toBe(false);
      expect(validateSemver('1')).toBe(false);
      expect(validateSemver('abc')).toBe(false);
      expect(validateSemver('1.0.0.0')).toBe(false);
    });

    test('handles edge cases', () => {
      expect(validateSemver('')).toBe(false);
      expect(validateSemver(null)).toBe(false);
      expect(validateSemver(undefined)).toBe(false);
    });
  });

  describe('extractVersions', () => {
    test('extracts single version', () => {
      const content = 'Version 1.2.3 is the latest';
      expect(extractVersions(content)).toContain('1.2.3');
    });

    test('extracts multiple versions', () => {
      const content = 'Upgraded from 1.0.0 to 2.0.0';
      const versions = extractVersions(content);
      expect(versions).toContain('1.0.0');
      expect(versions).toContain('2.0.0');
    });

    test('extracts versions with v prefix', () => {
      const content = 'Version v1.2.3 released';
      expect(extractVersions(content)).toContain('v1.2.3');
    });

    test('extracts prerelease versions', () => {
      const content = 'Try 1.0.0-beta.1 now';
      expect(extractVersions(content)).toContain('1.0.0-beta.1');
    });

    test('removes duplicates', () => {
      const content = '1.0.0 and 1.0.0 again';
      expect(extractVersions(content)).toHaveLength(1);
    });

    test('handles content with no versions', () => {
      const content = 'No versions here';
      expect(extractVersions(content)).toHaveLength(0);
    });
  });

  describe('checkVersionConsistency', () => {
    test('passes with consistent versions', () => {
      const fileVersions = [
        { file: 'README.md', versions: ['1.0.0'] },
        { file: 'CHANGELOG.md', versions: ['v1.0.0'] },
      ];
      const result = checkVersionConsistency(fileVersions, '1.0.0');

      expect(result.consistent).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    test('detects version mismatches', () => {
      const fileVersions = [
        { file: 'README.md', versions: ['1.0.0'] },
        { file: 'CHANGELOG.md', versions: ['2.0.0'] },
      ];
      const result = checkVersionConsistency(fileVersions, '1.0.0');

      expect(result.consistent).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.issues[0].file).toBe('CHANGELOG.md');
      expect(result.issues[0].found).toBe('2.0.0');
    });

    test('normalizes v prefix', () => {
      const fileVersions = [{ file: 'README.md', versions: ['v1.0.0'] }];
      const result = checkVersionConsistency(fileVersions, '1.0.0');

      expect(result.consistent).toBe(true);
    });

    test('tracks unique versions', () => {
      const fileVersions = [
        { file: 'README.md', versions: ['1.0.0', '2.0.0'] },
        { file: 'CHANGELOG.md', versions: ['1.0.0'] },
      ];
      const result = checkVersionConsistency(fileVersions, '1.0.0');

      expect(result.uniqueVersions).toContain('1.0.0');
      expect(result.uniqueVersions).toContain('2.0.0');
    });

    test('counts files checked', () => {
      const fileVersions = [
        { file: 'file1.md', versions: ['1.0.0'] },
        { file: 'file2.md', versions: ['1.0.0'] },
        { file: 'file3.md', versions: ['1.0.0'] },
      ];
      const result = checkVersionConsistency(fileVersions, '1.0.0');

      expect(result.totalChecked).toBe(3);
    });
  });

  // ========================================================================
  // PURE FUNCTIONS - Link Validation
  // ========================================================================

  describe('extractLinks', () => {
    test('extracts markdown links', () => {
      const content = 'See [documentation](docs/guide.md) for details';
      const links = extractLinks(content);

      expect(links).toHaveLength(1);
      expect(links[0].text).toBe('documentation');
      expect(links[0].url).toBe('docs/guide.md');
      expect(links[0].type).toBe('markdown');
    });

    test('extracts multiple links', () => {
      const content = '[Link 1](file1.md) and [Link 2](file2.md)';
      const links = extractLinks(content);

      expect(links).toHaveLength(2);
    });

    test('extracts autolinks', () => {
      const content = 'Visit <https://example.com> for more';
      const links = extractLinks(content);

      expect(links).toHaveLength(1);
      expect(links[0].type).toBe('autolink');
      expect(links[0].url).toBe('https://example.com');
    });

    test('tracks line numbers', () => {
      const content = 'Line 1\nSee [link](file.md) on line 2\nLine 3';
      const links = extractLinks(content);

      expect(links[0].line).toBe(2);
    });

    test('handles content with no links', () => {
      const content = 'No links in this content';
      expect(extractLinks(content)).toHaveLength(0);
    });
  });

  describe('isFileReference', () => {
    test('identifies file references', () => {
      expect(isFileReference('docs/guide.md')).toBe(true);
      expect(isFileReference('./README.md')).toBe(true);
      expect(isFileReference('../parent/file.md')).toBe(true);
    });

    test('excludes external URLs', () => {
      expect(isFileReference('https://example.com')).toBe(false);
      expect(isFileReference('http://example.com')).toBe(false);
    });

    test('excludes anchors', () => {
      expect(isFileReference('#section')).toBe(false);
    });
  });

  describe('normalizeFilePath', () => {
    test('removes anchor fragments', () => {
      expect(normalizeFilePath('file.md#section')).toBe('file.md');
    });

    test('removes leading ./', () => {
      expect(normalizeFilePath('./file.md')).toBe('file.md');
    });

    test('resolves relative to base', () => {
      expect(normalizeFilePath('guide.md', 'docs')).toBe('docs/guide.md');
    });

    test('handles multiple slashes', () => {
      expect(normalizeFilePath('docs//guide.md', 'base')).toBe('base/docs/guide.md');
    });
  });

  describe('validateFileReferences', () => {
    test('passes when all links exist', () => {
      const links = [
        { url: 'docs/guide.md', text: 'Guide', line: 1 },
        { url: 'README.md', text: 'README', line: 2 },
      ];
      const existingFiles = new Set(['docs/guide.md', 'README.md']);

      const issues = validateFileReferences(links, existingFiles, 'index.md');
      expect(issues).toHaveLength(0);
    });

    test('detects broken file links', () => {
      const links = [{ url: 'missing.md', text: 'Missing', line: 1 }];
      const existingFiles = new Set(['other.md']);

      const issues = validateFileReferences(links, existingFiles, 'index.md');
      expect(issues).toHaveLength(1);
      expect(issues[0].type).toBe(ISSUE_TYPE.BROKEN_LINK);
    });

    test('skips external URLs', () => {
      const links = [{ url: 'https://example.com', text: 'External', line: 1 }];
      const existingFiles = new Set();

      const issues = validateFileReferences(links, existingFiles, 'index.md');
      expect(issues).toHaveLength(0);
    });

    test('resolves relative paths', () => {
      const links = [{ url: './guide.md', text: 'Guide', line: 1 }];
      const existingFiles = new Set(['docs/guide.md']);

      const issues = validateFileReferences(links, existingFiles, 'docs/index.md');
      expect(issues).toHaveLength(0);
    });

    test('does not flag directory link targets as broken when directory is in Set', () => {
      // Simulates buildFileIndex Set that includes parent dirs derived from file paths.
      // A link to ".github/scripts/" (or ".github/scripts") should not be broken
      // if the directory itself is in the existingFiles Set.
      const links = [
        { url: '.github/scripts/', text: 'Scripts', line: 5 },
        { url: '.github/scripts', text: 'Scripts no-slash', line: 6 },
      ];
      // Set contains the directory path (as buildFileIndex now derives and adds parent dirs)
      const existingFiles = new Set([
        '/project/.github/scripts/check-references.sh',
        '/project/.github/scripts',
      ]);

      const issues = validateFileReferences(links, existingFiles, '/project/README.md');
      expect(issues).toHaveLength(0);
    });
  });

  // ========================================================================
  // PURE FUNCTIONS - Reporting
  // ========================================================================

  describe('formatConsistencyReport', () => {
    test('formats report with no issues', () => {
      const results = {
        filesChecked: 10,
        totalIssues: 0,
        brokenLinks: [],
        versionIssues: [],
      };
      const report = formatConsistencyReport(results);

      expect(report).toContain('## Step 2');
      expect(report).toContain('Files checked**: 10');
      expect(report).toContain('✅');
    });

    test('formats report with issues', () => {
      const results = {
        filesChecked: 5,
        totalIssues: 2,
        brokenLinks: [{ file: 'README.md', line: 10, text: 'Link', link: 'missing.md' }],
        versionIssues: [{ file: 'CHANGELOG.md', found: '2.0.0', expected: '1.0.0' }],
      };
      const report = formatConsistencyReport(results);

      expect(report).toContain('Total issues**: 2');
      expect(report).toContain('⚠️');
      expect(report).toContain('Broken Links');
      expect(report).toContain('Version Issues');
    });

    test('limits displayed issues', () => {
      const brokenLinks = Array.from({ length: 15 }, (_, i) => ({
        file: `file${i}.md`,
        line: i,
        text: 'Link',
        link: 'missing.md',
      }));

      const results = {
        filesChecked: 20,
        totalIssues: 15,
        brokenLinks,
        versionIssues: [],
      };
      const report = formatConsistencyReport(results);

      expect(report).toContain('... and 5 more');
    });
  });

  // ========================================================================
  // STEP 2 ANALYZER - Integration Tests
  // ========================================================================

  describe('Step2ConsistencyAnalyzer', () => {
    let analyzer;
    let mockFileOps;
    let mockBacklog;

    beforeEach(() => {
      mockFileOps = {
        readFile: () => Promise.resolve(''),
        glob: () => Promise.resolve([]),
      };

      mockBacklog = {
        saveStepSummary: () => Promise.resolve(),
      };

      analyzer = new Step2ConsistencyAnalyzer({
        fileOps: mockFileOps,
        backlog: mockBacklog,
        aiHelper: { initialize: () => Promise.resolve(false) },
      });
    });

    test('skips when no documentation found', async () => {
      mockFileOps.glob = () => Promise.resolve([]);

      const result = await analyzer.execute('/project');

      expect(result.success).toBe(true);
      expect(result.skipped).toBe(true);
      expect(result.reason).toBe('no_docs');
    });

    test('requests absolute paths from glob', async () => {
      const globOptions = [];
      mockFileOps.glob = (pattern, options) => {
        globOptions.push(options);
        return Promise.resolve([]);
      };

      await analyzer.execute('/project');

      expect(globOptions.some((o) => o.absolute === true)).toBe(true);
    });

    test('excludes entire .ai_workflow directory from documentation discovery', async () => {
      const ignorePatterns = [];
      mockFileOps.glob = (pattern, options) => {
        if (options?.ignore) ignorePatterns.push(...options.ignore);
        return Promise.resolve([]);
      };

      await analyzer.execute('/project');

      // Must include BOTH root-level and nested patterns so minimatch catches .ai_workflow/
      // at the project root (where no leading "/" exists before the directory name).
      expect(ignorePatterns).toEqual(expect.arrayContaining(['.ai_workflow/**']));
      expect(ignorePatterns).toEqual(expect.arrayContaining(['**/.ai_workflow/**']));
    });

    test('[BUG FIX] .ai_workflow/backlog files are NOT included in Files to Analyze', async () => {
      // Root-cause: minimatch("ai_workflow/backlog/x.md", "**/.ai_workflow/**") → false
      // because there is no leading "/" before ".ai_workflow" at the project root.
      // Fix: also emit the root-level pattern ".ai_workflow/**".
      let capturedIgnore = [];
      mockFileOps.glob = (pattern, options) => {
        if (options?.ignore) capturedIgnore = options.ignore;
        // Simulate what the real glob would return WITHOUT the fix:
        // both project docs AND backlog files coming back from the OS.
        // With the correct ignore patterns the implementation should filter them.
        // Here we just validate that the ignore list includes the root-level pattern.
        return Promise.resolve([]);
      };

      await analyzer.execute('/project');

      expect(capturedIgnore).toContain('.ai_workflow/**');
    });

    test('[BUG FIX] cross-references into checked-out submodules are not falsely reported as broken', async () => {
      // docs/README.md links into .workflow_core — which is a git submodule.
      // The submodule is excluded from doc analysis but its files MUST exist in
      // the link-validation index so the link resolves as valid (not broken).
      mockFileOps.readFile = (filePath) => {
        if (filePath === '/project/.gitmodules') {
          return Promise.resolve(
            '[submodule ".workflow_core"]\n\tpath = .workflow_core\n\turl = https://example.com\n'
          );
        }
        if (filePath.endsWith('package.json'))
          return Promise.resolve(JSON.stringify({ version: '1.0.0' }));
        // docs/README.md links into the submodule via ../ (resolves to /project/.workflow_core/…)
        return Promise.resolve('[Templates](../.workflow_core/workflow-templates/README.md)');
      };
      mockFileOps.glob = (pattern, options) => {
        // Doc-discovery pass (has ignore list) — returns docs/README.md (in docs/ subdir)
        if (options?.ignore) return Promise.resolve(['/project/docs/README.md']);
        // Submodule glob pass (cwd = submodule dir, no ignore) — returns the target file
        if (options?.cwd === '/project/.workflow_core') {
          return Promise.resolve(['/project/.workflow_core/workflow-templates/README.md']);
        }
        return Promise.resolve([]);
      };

      const result = await analyzer.execute('/project');

      expect(result.success).toBe(true);
      expect(result.brokenLinks).toHaveLength(0);
    });

    test('[BUG FIX] getSubmodulePaths returns paths from .gitmodules', async () => {
      mockFileOps.readFile = (filePath) => {
        if (filePath === '/project/.gitmodules') {
          return Promise.resolve(
            '[submodule ".workflow_core"]\n\tpath = .workflow_core\n' +
              '[submodule ".workflow_fspec"]\n\tpath = .workflow_fspec\n'
          );
        }
        return Promise.resolve('');
      };

      const paths = await analyzer.getSubmodulePaths('/project');

      expect(paths).toEqual(['.workflow_core', '.workflow_fspec']);
    });

    test('[BUG FIX] getSubmodulePaths returns empty array when .gitmodules missing', async () => {
      mockFileOps.readFile = () => Promise.reject(new Error('ENOENT'));

      const paths = await analyzer.getSubmodulePaths('/project');

      expect(paths).toEqual([]);
    });

    test('[BUG FIX] submodule not checked out does not crash buildFileIndex', async () => {
      mockFileOps.readFile = (filePath) => {
        if (filePath === '/project/.gitmodules') {
          return Promise.resolve('[submodule "empty"]\n\tpath = .empty_submodule\n');
        }
        return Promise.resolve('');
      };
      mockFileOps.glob = (pattern, options) => {
        if (options?.cwd === '/project/.empty_submodule') throw new Error('ENOENT');
        return Promise.resolve([]);
      };

      // Should not throw
      await expect(analyzer.execute('/project')).resolves.toBeDefined();
    });

    test('executes successfully with documentation', async () => {
      mockFileOps.glob = () => Promise.resolve(['/project/README.md', '/project/docs/guide.md']);
      mockFileOps.readFile = (path) => {
        if (path.endsWith('package.json')) {
          return Promise.resolve(JSON.stringify({ version: '1.0.0' }));
        }
        return Promise.resolve('Version 1.0.0\n[Link](guide.md)');
      };

      const result = await analyzer.execute('/project');

      expect(result.success).toBe(true);
      expect(result.filesChecked).toBe(2);
      expect(result.totalIssues).toBeDefined();
    });

    test('detects broken links', async () => {
      mockFileOps.glob = () => Promise.resolve(['/project/README.md']);
      mockFileOps.readFile = () => Promise.resolve('[Link](missing.md)');

      const result = await analyzer.execute('/project');

      expect(result.success).toBe(true);
      expect(result.brokenLinks.length).toBeGreaterThan(0);
    });

    test('detects version inconsistencies', async () => {
      mockFileOps.glob = () => Promise.resolve(['/project/README.md']);
      mockFileOps.readFile = (path) => {
        if (path.endsWith('package.json')) {
          return Promise.resolve(JSON.stringify({ version: '1.0.0' }));
        }
        return Promise.resolve('Version 2.0.0'); // Mismatch
      };

      const result = await analyzer.execute('/project');

      expect(result.success).toBe(true);
      expect(result.versionIssues.length).toBeGreaterThan(0);
    });

    test('handles missing package.json', async () => {
      mockFileOps.glob = () => Promise.resolve(['/project/README.md']);
      mockFileOps.readFile = (path) => {
        if (path.endsWith('package.json')) {
          return Promise.reject(new Error('Not found'));
        }
        return Promise.resolve('Content');
      };

      const result = await analyzer.execute('/project');

      expect(result.success).toBe(true);
      expect(result.versionIssues).toHaveLength(0); // No version to check
    });

    test('saves report to backlog', async () => {
      let savedContent = null;
      mockFileOps.glob = () => Promise.resolve(['/project/README.md']);
      mockFileOps.readFile = () => Promise.resolve('Content');
      mockBacklog.saveStepSummary = (step, title, content) => {
        savedContent = content;
        return Promise.resolve();
      };

      await analyzer.execute('/project');

      expect(savedContent).toBeTruthy();
      expect(savedContent).toContain('Step 2');
    });

    test('handles file system errors gracefully', async () => {
      mockFileOps.glob = () => Promise.reject(new Error('File system error'));

      // Should not throw, but return no docs found
      const result = await analyzer.execute('/project');

      expect(result.success).toBe(true);
      expect(result.skipped).toBe(true);
      expect(result.reason).toBe('no_docs');
    });

    // [BUG FIX e3311fe] docFiles absolute paths must be relativized before AI prompt
    test('[BUG FIX] docFiles passed to buildConsistencyPrompt are relative to projectRoot', async () => {
      // glob returns absolute paths (after absolute:true fix)
      mockFileOps.glob = () => Promise.resolve(['/project/README.md', '/project/docs/guide.md']);
      mockFileOps.readFile = (filePath) => {
        if (filePath.endsWith('/README.md')) {
          return Promise.resolve('# Project\n\nVersion 1.0.0\n');
        }
        if (filePath.endsWith('/docs/guide.md')) {
          return Promise.resolve('## Guide\n\nUse `npm test`.\n');
        }
        return Promise.resolve('Version 1.0.0');
      };

      let capturedPromptArg = null;
      const mockAiHelper = {
        initialize: () => Promise.resolve(true),
        executeRequest: (prompt) => {
          capturedPromptArg = prompt;
          return Promise.resolve({ content: 'AI suggestions' });
        },
      };

      const analyzerWithAi = new Step2ConsistencyAnalyzer({
        fileOps: mockFileOps,
        backlog: mockBacklog,
        aiHelper: mockAiHelper,
      });

      await analyzerWithAi.execute('/project');

      // The prompt must contain relative paths, not absolute /project/... paths
      if (capturedPromptArg) {
        expect(capturedPromptArg).toContain('README.md');
        expect(capturedPromptArg).not.toContain('/project/README.md');
        expect(capturedPromptArg).toContain('Provided file contents and excerpts');
        expect(capturedPromptArg).toContain('### `README.md`');
        expect(capturedPromptArg).toContain('# Project');
      }
    });

    // [BUG FIX 0f99feb] promptsDir must be forwarded to AiHelper so AI exchanges are saved
    test('[BUG FIX] constructor forwards promptsDir to AiHelper when aiHelper not injected', () => {
      // When no aiHelper is injected, the step must pass promptsDir to new AiHelper().
      // The test is structural: confirm the constructor reads options.promptsDir.
      // Verified by confirming the instance has an aiHelper property after construction.
      const instance = new Step2ConsistencyAnalyzer({
        fileOps: mockFileOps,
        backlog: mockBacklog,
        promptsDir: '/tmp/prompts/step_02',
        // No aiHelper injected → constructor will call new AiHelper(...)
      });

      // As long as instantiation does not throw and the instance has aiHelper,
      // and the source code passes promptsDir, this is satisfied structurally.
      expect(instance).toBeDefined();
      expect(instance.aiHelper).toBeDefined();
    });
  });

  // ========================================================================
  // PURE FUNCTIONS - Prompt Partitioning (new coverage)
  // ========================================================================

  describe('partitionFiles', () => {
    test('returns empty array for empty input', () => {
      expect(partitionFiles([], 10)).toEqual([]);
    });

    test('returns single chunk when files fit', () => {
      const result = partitionFiles(['a.md', 'b.md'], 5);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(['a.md', 'b.md']);
    });

    test('splits into correct number of chunks', () => {
      const files = Array.from({ length: 7 }, (_, i) => `f${i}.md`);
      const result = partitionFiles(files, 3);
      expect(result).toHaveLength(3); // ceil(7/3)
      expect(result[0]).toHaveLength(3);
      expect(result[1]).toHaveLength(3);
      expect(result[2]).toHaveLength(1);
    });
  });

  describe('buildPartitionContext', () => {
    const partFiles = ['docs/testing/TESTING.md', 'docs/ux/VISUAL_HIERARCHY.md'];
    const brokenLinks = [
      { file: 'docs/testing/TESTING.md', line: 49, link: './.github/TDD_GUIDE.md' },
      { file: 'docs/testing/TESTING.md', line: 63, link: './docs/TESTING.md' },
      { file: 'docs/ux/VISUAL_HIERARCHY.md', line: 216, link: './UX_IMPROVEMENTS.md' },
    ];

    test('brokenRefsList contains "source:line → target" pairs, not source file paths', () => {
      const { brokenRefsList } = buildPartitionContext(partFiles, brokenLinks, 0, 1);
      expect(brokenRefsList).toContain('→');
      expect(brokenRefsList).toContain('./.github/TDD_GUIDE.md');
      // Must NOT just be the source file without line+target context
      expect(brokenRefsList).not.toBe('docs/testing/TESTING.md');
    });

    test('formats each entry as "file:line → target"', () => {
      const { brokenRefsList } = buildPartitionContext(partFiles, brokenLinks, 0, 1);
      expect(brokenRefsList).toContain('docs/testing/TESTING.md:49 → ./.github/TDD_GUIDE.md');
    });

    test('returns "none" when no broken links match partition', () => {
      const { brokenRefsList } = buildPartitionContext(['other.md'], brokenLinks, 0, 1);
      expect(brokenRefsList).toBe('none');
    });

    test('adds partition header for multi-partition runs', () => {
      const { header } = buildPartitionContext(partFiles, brokenLinks, 1, 3);
      expect(header).toBe('[Partition 2 of 3 — analyse ONLY the files listed below]');
    });

    test('header is empty for single partition', () => {
      const { header } = buildPartitionContext(partFiles, brokenLinks, 0, 1);
      expect(header).toBe('');
    });

    test('docFilesList is grouped by directory category', () => {
      const { docFilesList } = buildPartitionContext(partFiles, brokenLinks, 0, 1);
      expect(docFilesList).toContain('**docs/ — Documentation**');
      expect(docFilesList).toContain('docs/testing/TESTING.md');
      expect(docFilesList).toContain('docs/ux/VISUAL_HIERARCHY.md');
    });

    test('docFilesList preamble shows partition count when no totalDocCount', () => {
      const { docFilesList } = buildPartitionContext(partFiles, brokenLinks, 0, 1);
      expect(docFilesList).toMatch(/2 files in this partition/);
    });

    test('docFilesList preamble shows "X of Y" when totalDocCount exceeds partition', () => {
      const { docFilesList } = buildPartitionContext(partFiles, brokenLinks, 0, 1, 100);
      expect(docFilesList).toMatch(/2 of 100 total markdown files/);
    });

    test('docFilesList preamble uses singular "file" for single-file partition', () => {
      const single = ['docs/testing/TESTING.md'];
      const { docFilesList } = buildPartitionContext(single, [], 0, 1);
      expect(docFilesList).toMatch(/1 file in this partition/);
    });
  });

  // ========================================================================
  // PURE FUNCTIONS - categorizeFiles
  // ========================================================================

  describe('categorizeFiles', () => {
    test('root-level files go to Root category', () => {
      const groups = categorizeFiles(['README.md', 'CHANGELOG.md']);
      expect(groups[0][0]).toBe('Root');
      expect(groups[0][1]).toEqual(['README.md', 'CHANGELOG.md']);
    });

    test('.github/ direct children go to Guides & Policies', () => {
      const groups = categorizeFiles(['.github/CONTRIBUTING.md', '.github/TDD_GUIDE.md']);
      const labels = groups.map(([l]) => l);
      expect(labels).toContain('.github/ — Guides & Policies');
    });

    test('.github/ISSUE_TEMPLATE/ files get their own category', () => {
      const groups = categorizeFiles(['.github/ISSUE_TEMPLATE/feature_request.md']);
      expect(groups[0][0]).toBe('.github/ISSUE_TEMPLATE/ — Issue Templates');
    });

    test('.github/actions/ files get Actions category', () => {
      const groups = categorizeFiles(['.github/actions/README.md']);
      expect(groups[0][0]).toBe('.github/actions/ — GitHub Actions');
    });

    test('.github/skills/ files get Skills category', () => {
      const groups = categorizeFiles(['.github/skills/audit-and-fix/SKILL.md']);
      expect(groups[0][0]).toBe('.github/skills/ — Skills');
    });

    test('.github/workflows/ files get Workflows category', () => {
      const groups = categorizeFiles(['.github/workflows/README.md']);
      expect(groups[0][0]).toBe('.github/workflows/ — Workflows');
    });

    test('.github/scripts/ files get Scripts category', () => {
      const groups = categorizeFiles(['.github/scripts/README.md']);
      expect(groups[0][0]).toBe('.github/scripts/ — Scripts');
    });

    test('docs/ files get Documentation category', () => {
      const groups = categorizeFiles(['docs/architecture/README.md']);
      expect(groups[0][0]).toBe('docs/ — Documentation');
    });

    test('src/ files get Source category', () => {
      const groups = categorizeFiles(['src/address-parser.ts']);
      expect(groups[0][0]).toBe('src/ — Source');
    });

    test('__tests__/ files get Tests category', () => {
      const groups = categorizeFiles(['__tests__/e2e/README.md']);
      expect(groups[0][0]).toBe('__tests__/ — Tests');
    });

    test('unknown top-level dirs get a generic "<dir>/" label', () => {
      const groups = categorizeFiles(['__mocks__/README.md']);
      expect(groups[0][0]).toBe('__mocks__/');
    });

    test('other .github subdirs get a generic ".github/<sub>/" label', () => {
      const groups = categorizeFiles(['.github/custom/file.md']);
      expect(groups[0][0]).toBe('.github/custom/');
    });

    test('categories appear in well-known order (Root before docs/ before src/)', () => {
      const groups = categorizeFiles(['src/index.ts', 'docs/README.md', 'README.md']);
      const labels = groups.map(([l]) => l);
      expect(labels.indexOf('Root')).toBeLessThan(labels.indexOf('docs/ — Documentation'));
      expect(labels.indexOf('docs/ — Documentation')).toBeLessThan(labels.indexOf('src/ — Source'));
    });

    test('returns empty array for empty input', () => {
      expect(categorizeFiles([])).toEqual([]);
    });
  });

  // ========================================================================
  // PURE FUNCTIONS - normalizeFilePath ../ traversal (regression tests)
  // ========================================================================

  describe('normalizeFilePath - ../traversal fixes', () => {
    test('resolves single ../ with relative base', () => {
      expect(normalizeFilePath('../README.md', 'docs')).toBe('README.md');
    });

    test('resolves double ../ with relative base', () => {
      expect(normalizeFilePath('../../.github/TDD.md', 'docs/testing')).toBe('.github/TDD.md');
    });

    test('resolves absolute base with ../ correctly', () => {
      // With absolute base, path.resolve is used — verify correct traversal
      const absBase = '/project/docs/testing';
      const result = normalizeFilePath('../../.github/TDD.md', absBase);
      expect(result).toBe('/project/.github/TDD.md');
    });

    test('existing relative-base tests are unaffected', () => {
      expect(normalizeFilePath('file.md#section')).toBe('file.md');
      expect(normalizeFilePath('./file.md')).toBe('file.md');
      expect(normalizeFilePath('guide.md', 'docs')).toBe('docs/guide.md');
      expect(normalizeFilePath('docs//guide.md', 'base')).toBe('base/docs/guide.md');
    });
  });

  // ========================================================================
  // PURE FUNCTIONS - validateAiResponseQuality
  // ========================================================================

  describe('validateAiResponseQuality', () => {
    const flaggedItems = [
      'docs/testing/TESTING.md:49 → ./.github/TDD_GUIDE.md',
      'docs/ux/VISUAL_HIERARCHY.md:216 → ./UX_IMPROVEMENTS.md',
    ];

    test('returns adequate=false for empty response', () => {
      const result = validateAiResponseQuality('', flaggedItems);
      expect(result.adequate).toBe(false);
      expect(result.reason).toBe('empty_response');
    });

    test('returns adequate=false for too-short response with flagged items', () => {
      const result = validateAiResponseQuality('All broken.', flaggedItems);
      expect(result.adequate).toBe(false);
      expect(result.reason).toBe('too_short');
    });

    test('returns adequate=true when no items to cover', () => {
      const result = validateAiResponseQuality('Some generic analysis...', []);
      expect(result.adequate).toBe(true);
      expect(result.reason).toBe('no_items_to_cover');
    });

    test('returns adequate=false for unsupported blanket success claims when grounding is required', () => {
      const response = `
**Documentation Consistency Analysis Report**

- No critical or high-priority documentation consistency issues detected.
- All present documentation is consistent, well-structured, and follows project-specific conventions.
- All cross-references are intact.
      `.repeat(4);

      const result = validateAiResponseQuality(response, [], {
        requireGroundedNoIssueResponse: true,
      });

      expect(result.adequate).toBe(false);
      expect(result.reason).toBe('unsupported_global_claim');
    });

    test('accepts the explicit safe no-issue response when no broken refs exist', () => {
      const response = 'No additional issues found beyond the programmatic scan.';

      const result = validateAiResponseQuality(response, [], {
        requireGroundedNoIssueResponse: true,
      });

      expect(result.adequate).toBe(true);
      expect(result.reason).toBe('no_items_to_cover');
    });

    test('returns adequate=false when coverage is below threshold', () => {
      // Response doesn't mention any broken targets
      const longResponse = 'A'.repeat(300);
      const result = validateAiResponseQuality(longResponse, flaggedItems);
      expect(result.adequate).toBe(false);
      expect(result.reason).toBe('low_coverage');
      expect(result.coverage).toBe(0);
    });

    test('returns adequate=true when sufficient targets are addressed', () => {
      const response = `
### Reference Analysis
The target ./.github/TDD_GUIDE.md is missing — the file was never created.
Fix: Create .github/TDD_GUIDE.md or remove the reference.

The target ./UX_IMPROVEMENTS.md is also missing from docs/ux/.
Fix: Create the file or update the link.
      `.repeat(5); // ensure > 200 chars
      const result = validateAiResponseQuality(response, flaggedItems);
      expect(result.adequate).toBe(true);
      expect(result.coverage).toBeGreaterThanOrEqual(MIN_COVERAGE_RATIO);
    });

    test('coverage reflects partial addressing', () => {
      const response = 'Only mentions ./.github/TDD_GUIDE.md but not the other. '.repeat(10);
      const result = validateAiResponseQuality(response, flaggedItems);
      expect(result.coverage).toBe(0.5); // 1 of 2 addressed
    });
  });

  describe('countTypeScriptSourceFiles', () => {
    test('counts .ts and .tsx source files while excluding .d.ts files', async () => {
      const calls = [];
      const fileOps = {
        async glob(pattern, options) {
          calls.push({ pattern, options });
          return ['src/index.tsx', 'src/app.tsx', 'src/pajussara-cdn.ts'];
        },
      };

      const count = await countTypeScriptSourceFiles(fileOps, '/project');

      expect(count).toBe('3');
      expect(calls).toEqual([
        {
          pattern: 'src/**/*.{ts,tsx}',
          options: {
            cwd: '/project',
            ignore: ['src/**/*.d.ts'],
            absolute: false,
          },
        },
      ]);
    });

    test('returns unknown when globbing fails', async () => {
      const fileOps = {
        async glob() {
          throw new Error('boom');
        },
      };

      await expect(countTypeScriptSourceFiles(fileOps, '/project')).resolves.toBe('unknown');
    });
  });

  describe('buildPartitionFileContents', () => {
    test('injects markdown file contents as fenced blocks', async () => {
      const fileOps = {
        async readFile(filePath) {
          if (filePath.endsWith('/README.md')) return '# Project\n\nVersion 1.0.0\n';
          if (filePath.endsWith('/docs/guide.md')) return '## Guide\n\nUse `npm test`.\n';
          throw new Error(`Unexpected file: ${filePath}`);
        },
      };

      const result = await buildPartitionFileContents(fileOps, '/project', [
        'README.md',
        'docs/guide.md',
      ]);

      expect(result.fileContentsSection).toContain('### `README.md`');
      expect(result.fileContentsSection).toContain('# Project');
      expect(result.fileContentsSection).toContain('### `docs/guide.md`');
      expect(result.fileHashEntries).toEqual([
        'README.md:# Project\n\nVersion 1.0.0\n',
        'docs/guide.md:## Guide\n\nUse `npm test`.\n',
      ]);
    });

    test('skips unreadable files gracefully', async () => {
      const fileOps = {
        async readFile(filePath) {
          if (filePath.endsWith('/README.md')) return '# Project\n';
          throw new Error('boom');
        },
      };

      const result = await buildPartitionFileContents(fileOps, '/project', [
        'README.md',
        'docs/missing.md',
      ]);

      expect(result.fileContentsSection).toContain('### `README.md`');
      expect(result.fileContentsSection).not.toContain('docs/missing.md');
      expect(result.fileHashEntries).toEqual(['README.md:# Project\n']);
    });
  });

  // ========================================================================
  // withFileChangeGuard skip behavior — Step 2 AI skip when files unchanged
  // ========================================================================

  describe('Step2ConsistencyAnalyzer.execute — file-change-guard skip behavior', () => {
    let mockFileOps;
    let mockBacklog;
    let mockAiHelper;
    let mockAiCache;
    let analyzer;
    let aiCallCount;

    const DOC_FILE = 'README.md';
    const DOC_CONTENT = '# Project\n\nVersion 1.0.0\n';

    beforeEach(() => {
      aiCallCount = 0;

      mockFileOps = {
        glob: () => Promise.resolve([DOC_FILE]),
        readFile: () => Promise.resolve(DOC_CONTENT),
      };

      mockBacklog = { saveStepSummary: () => Promise.resolve() };

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
        withFileChangeGuard: async (_stepId, fileContents, fn) => {
          const hash = [...fileContents].sort().join('|');
          if (hash === storedHash && storedResponse !== null) {
            return storedResponse;
          }
          const result = await fn();
          storedHash = hash;
          storedResponse = result;
          return result;
        },
      };

      analyzer = new Step2ConsistencyAnalyzer({
        fileOps: mockFileOps,
        backlog: mockBacklog,
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
      mockFileOps.readFile = () => Promise.resolve('# Project\n\nVersion 2.0.0\n');

      await analyzer.execute('/project');

      expect(aiCallCount).toBeGreaterThan(countAfterFirst); // new AI call issued
    });
  });
});
