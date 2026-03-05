/**
 * Tests for Step 1: Documentation Validation
 * @group steps
 */

import {
  Step1DocumentationAnalyzer,
  validateDocumentationCounts,
  checkVersionReferences,
  classifyChangedFiles,
  shouldRunAiAnalysis,
} from '../../src/steps/step_01_documentation.js';

describe('Step 1: Documentation Validation', () => {
  // ========================================================================
  // PURE FUNCTIONS - Documentation Counts
  // ========================================================================

  describe('validateDocumentationCounts', () => {
    test('passes with valid counts', () => {
      const counts = { markdown: 10, readme: 1, docs: 5 };
      const result = validateDocumentationCounts(counts);

      expect(result.success).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    test('fails with no documentation files', () => {
      const counts = { markdown: 0, readme: 0, docs: 0 };
      const result = validateDocumentationCounts(counts);

      expect(result.success).toBe(false);
      expect(result.issues).toContain('No documentation files found');
      expect(result.issues).toContain('No README file found in project root');
    });

    test('warns about missing README', () => {
      const counts = { markdown: 5, readme: 0, docs: 3 };
      const result = validateDocumentationCounts(counts);

      expect(result.success).toBe(false);
      expect(result.issues).toContain('No README file found in project root');
    });

    test('warns about multiple READMEs', () => {
      const counts = { markdown: 10, readme: 3, docs: 5 };
      const result = validateDocumentationCounts(counts);

      expect(result.success).toBe(false);
      expect(result.issues).toContain('Multiple README files found (3)');
    });

    test('returns counts in result', () => {
      const counts = { markdown: 5, readme: 1, docs: 3 };
      const result = validateDocumentationCounts(counts);

      expect(result.counts).toEqual(counts);
    });
  });

  // ========================================================================
  // PURE FUNCTIONS - Version References
  // ========================================================================

  describe('checkVersionReferences', () => {
    test('finds version with v prefix', () => {
      const content = 'Version v1.2.3 is the latest';
      const result = checkVersionReferences(content, '1.2.3');

      expect(result.found).toContain('v1.2.3');
      expect(result.hasMismatches).toBe(false);
    });

    test('finds version without prefix', () => {
      const content = 'Version 1.2.3 is the latest';
      const result = checkVersionReferences(content, '1.2.3');

      expect(result.found).toContain('1.2.3');
      expect(result.hasMismatches).toBe(false);
    });

    test('finds prerelease versions', () => {
      const content = 'Version 1.2.3-alpha.1 is available';
      const result = checkVersionReferences(content, '1.2.3-alpha.1');

      expect(result.found).toContain('1.2.3-alpha.1');
      expect(result.hasMismatches).toBe(false);
    });

    test('detects version mismatches', () => {
      const content = 'Using version 1.0.0 and 1.2.3';
      const result = checkVersionReferences(content, '2.0.0');

      expect(result.hasMismatches).toBe(true);
      expect(result.mismatches).toContain('1.0.0');
      expect(result.mismatches).toContain('1.2.3');
    });

    test('handles multiple occurrences of same version', () => {
      const content = 'v1.2.3 is great. Version 1.2.3 rocks!';
      const result = checkVersionReferences(content, '1.2.3');

      expect(result.found).toHaveLength(2); // v1.2.3 and 1.2.3
      expect(result.hasMismatches).toBe(false);
    });

    test('handles content with no versions', () => {
      const content = 'This is a document without version numbers';
      const result = checkVersionReferences(content, '1.2.3');

      expect(result.found).toHaveLength(0);
      expect(result.hasMismatches).toBe(false);
    });
  });

  // ========================================================================
  // PURE FUNCTIONS - File Classification
  // ========================================================================

  describe('classifyChangedFiles', () => {
    test('classifies documentation files', () => {
      const files = ['README.md', 'docs/guide.md', 'CONTRIBUTING.md'];
      const result = classifyChangedFiles(files);

      expect(result.documentation).toEqual(files);
      expect(result.counts.documentation).toBe(3);
    });

    test('classifies source files', () => {
      const files = ['src/index.js', 'src/utils.mjs'];
      const result = classifyChangedFiles(files);

      expect(result.source).toEqual(files);
      expect(result.counts.source).toBe(2);
    });

    test('classifies test files', () => {
      const files = ['test/unit.test.js', 'src/foo.test.js'];
      const result = classifyChangedFiles(files);

      expect(result.tests).toEqual(files);
      expect(result.counts.tests).toBe(2);
    });

    test('classifies config files', () => {
      const files = ['package.json', 'config.yaml', '.eslintrc.yml'];
      const result = classifyChangedFiles(files);

      expect(result.config).toEqual(files);
      expect(result.counts.config).toBe(3);
    });

    test('handles mixed file types', () => {
      const files = [
        'README.md',
        'src/index.js',
        'test/unit.test.js',
        'package.json',
        'docs/api.md',
      ];
      const result = classifyChangedFiles(files);

      expect(result.counts.documentation).toBe(2);
      expect(result.counts.source).toBe(1);
      expect(result.counts.tests).toBe(1);
      expect(result.counts.config).toBe(1);
      expect(result.counts.total).toBe(5);
    });

    test('handles empty file list', () => {
      const result = classifyChangedFiles([]);

      expect(result.counts.total).toBe(0);
      expect(result.counts.documentation).toBe(0);
    });
  });

  // ========================================================================
  // PURE FUNCTIONS - AI Analysis Decision
  // ========================================================================

  describe('shouldRunAiAnalysis', () => {
    test('returns true for changes with source code', () => {
      const classification = {
        counts: { total: 5, source: 3, documentation: 2, tests: 0, config: 0 },
      };
      expect(shouldRunAiAnalysis(classification)).toBe(true);
    });

    test('returns false for no changes', () => {
      const classification = {
        counts: { total: 0, source: 0, documentation: 0, tests: 0, config: 0 },
      };
      expect(shouldRunAiAnalysis(classification)).toBe(false);
    });

    test('skips docs-only when configured', () => {
      const classification = {
        counts: { total: 2, source: 0, documentation: 2, tests: 0, config: 0 },
      };
      expect(shouldRunAiAnalysis(classification, { skipDocsOnly: true })).toBe(false);
    });

    test('allows docs-only by default', () => {
      const classification = {
        counts: { total: 2, source: 0, documentation: 2, tests: 0, config: 0 },
      };
      expect(shouldRunAiAnalysis(classification)).toBe(true);
    });

    test('requires source when configured', () => {
      const classification = {
        counts: { total: 2, source: 0, documentation: 1, tests: 1, config: 0 },
      };
      expect(shouldRunAiAnalysis(classification, { requireSource: true })).toBe(false);
    });

    test('passes when source exists and required', () => {
      const classification = {
        counts: { total: 3, source: 1, documentation: 1, tests: 1, config: 0 },
      };
      expect(shouldRunAiAnalysis(classification, { requireSource: true })).toBe(true);
    });
  });

  // ========================================================================
  // STEP 1 ANALYZER - Integration Tests
  // ========================================================================

  describe('Step1DocumentationAnalyzer', () => {
    let analyzer;
    let mockGitOps;
    let mockFileOps;
    let mockBacklog;
    let mockIncrementalProcessor;
    let mockParallelProcessor;

    beforeEach(() => {
      // Create mock dependencies with plain functions
      mockGitOps = {
        getModifiedFiles: () => Promise.resolve([]),
      };

      mockFileOps = {
        readFile: () => Promise.resolve(''),
      };

      mockBacklog = {
        saveStepSummary: () => Promise.resolve(),
      };

      mockIncrementalProcessor = {
        detectChangedDocs: () => Promise.resolve([]),
      };

      mockParallelProcessor = {
        validate: () =>
          Promise.resolve({
            validatedFiles: 0,
            totalFiles: 0,
            categories: {},
            errors: [],
            success: true,
          }),
        getStatistics: () => ({ totalDuration: 0, speedup: null }),
      };

      analyzer = new Step1DocumentationAnalyzer({
        gitOps: mockGitOps,
        fileOps: mockFileOps,
        backlog: mockBacklog,
        incrementalProcessor: mockIncrementalProcessor,
        parallelProcessor: mockParallelProcessor,
        aiHelper: { initialize: () => Promise.resolve(false) },
      });
    });

    test('skips when no changes detected', async () => {
      mockGitOps.getModifiedFiles = () => Promise.resolve([]);

      const result = await analyzer.execute('/project');

      expect(result.success).toBe(true);
      expect(result.skipped).toBe(true);
      expect(result.reason).toBe('no_changes');
    });

    test('executes successfully with changes', async () => {
      mockGitOps.getModifiedFiles = () => Promise.resolve(['README.md', 'src/index.js']);
      mockIncrementalProcessor.detectChangedDocs = () => Promise.resolve(['README.md']);
      mockParallelProcessor.validate = () =>
        Promise.resolve({
          validatedFiles: 1,
          totalFiles: 1,
          categories: {},
          errors: [],
          success: true,
        });
      mockParallelProcessor.getStatistics = () => ({ totalDuration: 100, speedup: null });

      const result = await analyzer.execute('/project');

      expect(result.success).toBe(true);
      expect(result.classification).toBeDefined();
      expect(result.filesProcessed).toBe(1);
    });

    test('handles incremental detection', async () => {
      mockGitOps.getModifiedFiles = () => Promise.resolve(['docs/a.md', 'docs/b.md', 'docs/c.md']);
      mockIncrementalProcessor.detectChangedDocs = (files) => Promise.resolve([files[0]]); // Only first file changed

      const result = await analyzer.execute('/project', { enableIncremental: true });

      expect(result.success).toBe(true);
      expect(result.filesProcessed).toBe(1); // Only 1 doc actually processed
    });

    test('skips when all docs unchanged', async () => {
      mockGitOps.getModifiedFiles = () => Promise.resolve(['docs/a.md', 'docs/b.md']);
      mockIncrementalProcessor.detectChangedDocs = () => Promise.resolve([]); // All unchanged

      const result = await analyzer.execute('/project', { enableIncremental: true });

      expect(result.success).toBe(true);
      expect(result.skipped).toBe(true);
      expect(result.reason).toBe('docs_unchanged');
    });

    test('runs validation checks', async () => {
      mockGitOps.getModifiedFiles = () => Promise.resolve(['README.md']);
      mockIncrementalProcessor.detectChangedDocs = (files) => Promise.resolve(files); // Return the file
      mockFileOps.readFile = (path) => {
        if (path.endsWith('package.json')) {
          return Promise.resolve(JSON.stringify({ version: '1.0.0' }));
        }
        return Promise.resolve('Version 1.0.0');
      };

      const result = await analyzer.execute('/project', { enableParallel: false });

      expect(result.success).toBe(true);
      expect(result.validation).toBeDefined();
      expect(result.validation.success).toBe(true);
    });

    test('detects version mismatches', async () => {
      mockGitOps.getModifiedFiles = () => Promise.resolve(['README.md']);
      mockIncrementalProcessor.detectChangedDocs = (files) => Promise.resolve(files); // Return the file
      mockFileOps.readFile = (path) => {
        if (path.endsWith('package.json')) {
          return Promise.resolve(JSON.stringify({ version: '2.0.0' }));
        }
        return Promise.resolve('Version 1.0.0'); // Mismatch
      };

      const result = await analyzer.execute('/project', { enableParallel: false });

      expect(result.success).toBe(true);
      expect(result.validation.versionRefs.success).toBe(false);
      expect(result.validation.versionRefs.issues.length).toBeGreaterThan(0);
    });

    test('handles parallel processing', async () => {
      mockGitOps.getModifiedFiles = () => Promise.resolve(['docs/a.md', 'docs/b.md']);
      mockIncrementalProcessor.detectChangedDocs = (files) => Promise.resolve(files); // All changed
      mockParallelProcessor.validate = () =>
        Promise.resolve({
          validatedFiles: 2,
          totalFiles: 2,
          categories: {},
          errors: [],
          success: true,
        });
      mockParallelProcessor.getStatistics = () => ({
        totalDuration: 200,
        speedup: { speedup: 1.8 },
      });

      const result = await analyzer.execute('/project', { enableParallel: true });

      expect(result.success).toBe(true);
      expect(result.analysis).toBeDefined();
      expect(result.analysis.stats.processed).toBe(2);
    });

    test('handles errors gracefully', async () => {
      mockGitOps.getModifiedFiles = () => Promise.reject(new Error('Git error'));

      await expect(analyzer.execute('/project')).rejects.toThrow('Git error');
    });

    test('formats backlog content correctly', () => {
      const classification = {
        counts: { total: 5, documentation: 2, source: 2, tests: 1, config: 0 },
      };
      const validation = { success: true, totalIssues: 0 };
      const analysis = { stats: { processed: 2, totalTime: 150 } };

      const content = analyzer.formatBacklogContent(classification, validation, analysis);

      expect(content).toContain('## Step 1: Documentation Analysis');
      expect(content).toContain('**Total**: 5');
      expect(content).toContain('✅ All validation checks passed');
      expect(content).toContain('**Files processed**: 2');
    });

    test('saves to backlog', async () => {
      let savedContent = null;
      mockGitOps.getModifiedFiles = () => Promise.resolve(['README.md']);
      mockIncrementalProcessor.detectChangedDocs = (files) => Promise.resolve(files); // Return the file
      mockBacklog.saveStepSummary = (step, title, content) => {
        savedContent = content;
        return Promise.resolve();
      };

      await analyzer.execute('/project', { enableParallel: false });

      expect(savedContent).toBeTruthy();
      expect(savedContent).toContain('Step 1');
    });

    // ========================================================================
    // REGRESSION TESTS — File content injection (prevent @workspace hallucination)
    // ========================================================================

    describe('file content injection regression', () => {
      let capturedPrompt;
      let mockAiHelper;
      let mockAiCache;

      beforeEach(() => {
        capturedPrompt = null;

        mockAiHelper = {
          initialize: () => Promise.resolve(true),
          executeRequest: (prompt) => {
            capturedPrompt = prompt;
            return Promise.resolve({
              success: true,
              content: 'No updates needed',
              text: 'No updates needed',
            });
          },
        };

        mockAiCache = {
          init: () => Promise.resolve(),
          withCache: (_prompt, _ctx, fn) => fn(),
        };

        mockFileOps.readFile = (path) => {
          if (path.includes('ai_helpers')) {
            // Return minimal YAML so buildYamlStepPrompt produces a prompt
            return Promise.resolve(`
doc_analysis_prompt:
  role_prefix: "You are a documentation specialist."
  task_template: |
    **Changed files**: {changed_files}
    **Documentation to review**: {doc_files}
    **File Contents**: {file_contents}
  approach: "Analyze ONLY the documentation files listed. Read the file contents provided above."
`);
          }
          if (path.includes('README.md')) return Promise.resolve('# My Project\n\nVersion 0.4.8');
          if (path.includes('CONTRIBUTING.md'))
            return Promise.resolve('# Contributing\n\nPlease read this.');
          if (path.includes('package.json'))
            return Promise.resolve(JSON.stringify({ version: '0.4.8' }));
          return Promise.resolve('');
        };

        mockParallelProcessor.validate = async (files, categoryFn) => {
          // Actually invoke the category function to trigger prompt building
          for (const file of files) {
            await categoryFn('readme', [file]);
          }
          return {
            validatedFiles: files.length,
            totalFiles: files.length,
            categories: {},
            errors: [],
            success: true,
          };
        };

        analyzer = new Step1DocumentationAnalyzer({
          gitOps: mockGitOps,
          fileOps: mockFileOps,
          backlog: mockBacklog,
          incrementalProcessor: mockIncrementalProcessor,
          parallelProcessor: mockParallelProcessor,
          aiHelper: mockAiHelper,
          aiCache: mockAiCache,
        });
      });

      test('prompt contains actual file content, not just filenames', async () => {
        mockGitOps.getModifiedFiles = () => Promise.resolve(['README.md', 'CONTRIBUTING.md']);
        mockIncrementalProcessor.detectChangedDocs = (files) => Promise.resolve(files);

        await analyzer.execute('/project', { enableParallel: true });

        expect(capturedPrompt).not.toBeNull();
        // Actual file content must appear in the prompt
        expect(capturedPrompt).toMatch(/My Project|Contributing|0\.4\.8/);
      });

      test('prompt does NOT contain @workspace instruction', async () => {
        mockGitOps.getModifiedFiles = () => Promise.resolve(['README.md']);
        mockIncrementalProcessor.detectChangedDocs = (files) => Promise.resolve(files);

        await analyzer.execute('/project', { enableParallel: true });

        expect(capturedPrompt).not.toBeNull();
        expect(capturedPrompt).not.toContain('@workspace');
      });

      test('gracefully continues when a file cannot be read', async () => {
        mockGitOps.getModifiedFiles = () => Promise.resolve(['README.md', 'MISSING.md']);
        mockIncrementalProcessor.detectChangedDocs = (files) => Promise.resolve(files);

        const originalReadFile = mockFileOps.readFile;
        mockFileOps.readFile = (path) => {
          if (path.includes('MISSING.md')) return Promise.reject(new Error('ENOENT'));
          return originalReadFile(path);
        };

        // Should not throw even when one file is unreadable
        const result = await analyzer.execute('/project', { enableParallel: true });
        expect(result.success).toBe(true);
      });
    });
  });
});
