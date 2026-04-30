/**
 * Tests for Step 1: Documentation Validation
 * @group steps
 */

import {
  Step1DocumentationAnalyzer,
  buildStep1PromptPartitions,
  buildStep1FileContentsBlock,
  buildStep1ScopedDocContextBlock,
  validateDocumentationCounts,
  checkVersionReferences,
  classifyChangedFiles,
  buildStep1SynthesisPrompt,
  consolidateStep1DocAnalysis,
  isLowSignalStep1Evidence,
  rankStep1EvidenceFile,
  selectStep1FinalAnalysisContent,
  selectStep1EvidenceFiles,
  shouldRunAiAnalysis,
  selectStep1DocumentationModel,
  calculateStep1ParallelTimeoutBudget,
  readProjectConventions,
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

  describe('calculateStep1ParallelTimeoutBudget', () => {
    test('covers AiHelper timeout retries plus fallback slack', () => {
      const budget = calculateStep1ParallelTimeoutBudget({
        model: 'gpt-4.1',
        timeout: 120000,
        maxRetries: 3,
        baseDelay: 1000,
        maxDelay: 30000,
        fallbackModel: 'claude-haiku-4.5',
      });

      expect(budget).toBe(798000);
    });

    test('skips fallback allowance when fallback model is disabled', () => {
      const budget = calculateStep1ParallelTimeoutBudget({
        model: 'gpt-4.1',
        timeout: 120000,
        maxRetries: 2,
        baseDelay: 1000,
        maxDelay: 30000,
        fallbackModel: null,
      });

      expect(budget).toBe(376000);
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

    test('excludes copilot instructions from generic step 1 ownership', () => {
      const result = classifyChangedFiles([
        '.github/copilot-instructions.md',
        'README.md',
        'package.json',
      ]);

      expect(result.documentation).toEqual(['README.md']);
      expect(result.config).toEqual(['package.json']);
      expect(result.counts.total).toBe(2);
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

  describe('selectStep1DocumentationModel', () => {
    test('prefers gpt-4.1 when it is available', () => {
      expect(selectStep1DocumentationModel([{ id: 'claude-sonnet-4.6' }, { id: 'gpt-4.1' }])).toBe(
        'gpt-4.1'
      );
    });

    test('falls back to the next recommended model when gpt-4.1 is unavailable', () => {
      expect(selectStep1DocumentationModel([{ id: 'claude-sonnet-4.6' }])).toBe(
        'claude-sonnet-4.6'
      );
    });

    test('uses the supplied fallback when no recommended model is available', () => {
      expect(selectStep1DocumentationModel([{ id: 'claude-haiku-4.5' }], 'claude-haiku-4.5')).toBe(
        'claude-haiku-4.5'
      );
    });
  });

  describe('Step 1 evidence scoping', () => {
    test('marks generated and transient workflow artifacts as low-signal evidence', () => {
      expect(isLowSignalStep1Evidence('assets/js/index.js')).toBe(true);
      expect(isLowSignalStep1Evidence('.playwright-mcp/page.yml')).toBe(true);
      expect(isLowSignalStep1Evidence('.mcp.json')).toBe(true);
      expect(isLowSignalStep1Evidence('src/index.ts')).toBe(false);
      expect(isLowSignalStep1Evidence('package.json')).toBe(false);
    });

    test('prioritizes source evidence for API docs and filters low-signal files', () => {
      const selected = selectStep1EvidenceFiles(['docs/API.md'], {
        documentation: ['README.md', 'docs/API.md'],
        source: ['src/shared.ts', 'assets/js/shared.js'],
        config: ['package.json', '.playwright-mcp/page.yml'],
      });

      expect(selected).toContain('docs/API.md');
      expect(selected).toContain('README.md');
      expect(selected).toContain('src/shared.ts');
      expect(selected).toContain('package.json');
      expect(selected).not.toContain('assets/js/shared.js');
      expect(selected).not.toContain('.playwright-mcp/page.yml');
      expect(
        rankStep1EvidenceFile('src/shared.ts', 'api', new Set(['docs/API.md']))
      ).toBeGreaterThan(rankStep1EvidenceFile('package.json', 'api', new Set(['docs/API.md'])));
    });

    test('prefers key config and static pages over source churn for README docs', () => {
      const selected = selectStep1EvidenceFiles(['README.md'], {
        documentation: ['README.md', 'CHANGELOG.md'],
        source: ['src/index.ts', 'assets/js/index.js'],
        config: ['package.json', 'index.html', '.mcp.json'],
      });

      expect(selected).toEqual(
        expect.arrayContaining(['README.md', 'CHANGELOG.md', 'package.json', 'index.html'])
      );
      expect(selected).not.toContain('assets/js/index.js');
      expect(selected).not.toContain('.mcp.json');
    });
  });

  describe('Step 1 partition consolidation', () => {
    test('collapses repeated no-update partition responses into one summary', () => {
      const content = [
        '#### Partition 1 of 2',
        '',
        'No updates required — docs are current.',
        '',
        '#### Partition 2 of 2',
        '',
        'No updates required — docs are current.',
      ].join('\n');

      expect(consolidateStep1DocAnalysis(content, ['README.md'])).toBe(
        'No updates required — consolidated across 2 prompt partition(s) for README.md. The visible evidence did not identify documentation-impacting changes for the scoped documentation files.'
      );
    });

    test('collapses repeated inconclusive responses into one summary', () => {
      const content = [
        '#### Partition 1 of 2',
        '',
        'Inconclusive — missing direct file content.',
        '',
        '#### Partition 2 of 2',
        '',
        'Not applicable — visible files are unrelated to README.md.',
      ].join('\n');

      expect(consolidateStep1DocAnalysis(content, ['README.md'])).toBe(
        'Inconclusive — consolidated across 2 prompt partition(s) for README.md. The visible evidence was incomplete, tangential, or out of scope for a confident documentation verdict.'
      );
    });

    test('treats mixed "not applicable" and "no updates required" sections as inconclusive', () => {
      const content = [
        '#### Partition 1 of 2',
        '',
        'Not applicable',
        '',
        'Visible evidence is tangential. No updates required for README.md.',
        '',
        '#### Partition 2 of 2',
        '',
        'Not applicable — visible files are unrelated to README.md.',
      ].join('\n');

      expect(consolidateStep1DocAnalysis(content, ['README.md'])).toBe(
        'Inconclusive — consolidated across 2 prompt partition(s) for README.md. The visible evidence was incomplete, tangential, or out of scope for a confident documentation verdict.'
      );
    });

    test('treats mixed "no updates required" and "inconclusive" sections as inconclusive', () => {
      const content = [
        '#### Partition 1 of 2',
        '',
        'README.md\n\nVerdict: No updates required',
        '',
        '#### Partition 2 of 2',
        '',
        'README.md\n\nVerdict: Inconclusive',
      ].join('\n');

      expect(consolidateStep1DocAnalysis(content, ['README.md'])).toBe(
        'Inconclusive — consolidated across 2 prompt partition(s) for README.md. At least one partition had incomplete, tangential, or support-only evidence, so Step 1 cannot safely collapse the full result to "No updates required".'
      );
    });

    test('buildStep1SynthesisPrompt includes guardrails for planned items and guessed metadata', () => {
      const prompt = buildStep1SynthesisPrompt({
        changedFiles: ['ROADMAP.md', 'package.json'],
        docFiles: ['README.md'],
        scopedDocEntries: [
          {
            relativePath: 'README.md',
            content: '## Current Implementation Status\n- Steps: step_00 through step_23',
          },
        ],
        partitionFindings: 'README.md: Specific edit required',
        totalPartitions: 2,
      });

      expect(prompt).toContain(
        'Do not promote roadmap-only or planned items into released/current-state docs'
      );
      expect(prompt).toContain(
        'When adjacent metadata lines form a summary block (for example version, tests, coverage, and last-updated lines)'
      );
      expect(prompt).toContain('Never invent or infer release dates or "Last updated" dates');
    });

    test('buildStep1SynthesisPrompt omits empty project context sections', () => {
      const prompt = buildStep1SynthesisPrompt({
        changedFiles: ['ROADMAP.md'],
        docFiles: ['README.md'],
        projectInfo: {
          language: undefined,
          projectKind: undefined,
        },
        scopedDocEntries: [
          {
            relativePath: 'README.md',
            content: '# README',
          },
        ],
        partitionFindings: 'README.md: No updates required',
        totalPartitions: 2,
      });

      expect(prompt).not.toContain('**Project Context**');
    });

    test('selectStep1FinalAnalysisContent keeps partition findings when synthesis overstates certainty on omitted docs', () => {
      const combined = [
        '#### Partition 1 of 2',
        '',
        'README.md\n\nVerdict: Inconclusive',
        '',
        '#### Partition 2 of 2',
        '',
        'README.md\n\nVerdict: No updates required',
      ].join('\n');
      const synthesis = 'README.md\n\nVerdict: No updates required';
      const scopedDocEntries = [
        {
          relativePath: 'README.md',
          content: [
            '# Title',
            ...Array.from({ length: 800 }, (_, i) => `line ${i}`),
            'footer',
          ].join('\n'),
        },
      ];

      expect(selectStep1FinalAnalysisContent(combined, synthesis, scopedDocEntries)).toBe(combined);
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

    test('widens the parallel timeout budget to match AiHelper retry policy', async () => {
      const validateCalls = [];
      mockGitOps.getModifiedFiles = () => Promise.resolve(['README.md']);
      mockIncrementalProcessor.detectChangedDocs = (files) => Promise.resolve(files);
      mockParallelProcessor.config = { timeout: 300000 };
      mockParallelProcessor.validate = () => {
        validateCalls.push(mockParallelProcessor.config.timeout);
        return Promise.resolve({
          validatedFiles: 1,
          totalFiles: 1,
          categories: {},
          errors: [],
          success: true,
        });
      };
      analyzer = new Step1DocumentationAnalyzer({
        gitOps: mockGitOps,
        fileOps: mockFileOps,
        backlog: mockBacklog,
        incrementalProcessor: mockIncrementalProcessor,
        parallelProcessor: mockParallelProcessor,
        aiHelper: {
          config: {
            model: 'gpt-4.1',
            timeout: 120000,
            maxRetries: 3,
            baseDelay: 1000,
            maxDelay: 30000,
            fallbackModel: 'claude-haiku-4.5',
          },
          initialize: () => Promise.resolve(true),
        },
        aiCache: {
          init: () => Promise.resolve(),
          withFileChangeGuard: (_key, _files, fn) => fn(),
        },
      });

      await analyzer.execute('/project', { enableParallel: true });

      expect(validateCalls).toEqual([798000]);
    });

    test('fails when parallel processing returns incomplete analysis', async () => {
      mockGitOps.getModifiedFiles = () => Promise.resolve(['docs/a.md']);
      mockIncrementalProcessor.detectChangedDocs = (files) => Promise.resolve(files);
      mockParallelProcessor.validate = () =>
        Promise.resolve({
          validatedFiles: 0,
          totalFiles: 1,
          categories: {},
          errors: [{ category: 'readme', error: 'Timeout' }],
          success: false,
        });

      await expect(analyzer.execute('/project', { enableParallel: true })).rejects.toThrow(
        'Timeout'
      );
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
      let capturedPrompts;
      let capturedOptions;
      let mockAiHelper;
      let mockAiCache;

      beforeEach(() => {
        capturedPrompt = null;
        capturedPrompts = [];
        capturedOptions = null;

        mockAiHelper = {
          initialize: () => Promise.resolve(true),
          getAvailableModels: () => [{ id: 'claude-sonnet-4.6' }],
          executeRequest: (prompt, options) => {
            capturedPrompt = prompt;
            capturedPrompts.push(prompt);
            capturedOptions = options;
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
          withFileChangeGuard: (_stepId, _fileContents, fn) => fn(),
        };

        mockFileOps.readFile = (path) => {
          if (path.includes('ai_helpers')) {
            // Return minimal YAML so buildYamlStepPrompt produces a prompt
            return Promise.resolve(`
doc_analysis_prompt:
  role_prefix: "You are a documentation specialist."
  task_template: |
    {partition_header}
    {partition_scope_note}
    **Changed files**: {changed_files}
    **Documentation to review**: {doc_files}
    **File Paths**:
    {file_paths_in_request}
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

      test('prompt excludes low-signal generated and transient files from README evidence', async () => {
        mockGitOps.getModifiedFiles = () =>
          Promise.resolve([
            'README.md',
            'src/index.ts',
            'assets/js/index.js',
            '.playwright-mcp/page.yml',
            'package.json',
          ]);
        mockIncrementalProcessor.detectChangedDocs = (files) => Promise.resolve([files[0]]);
        mockFileOps.readFile = (path) => {
          if (path.includes('ai_helpers')) {
            return Promise.resolve(`
doc_analysis_prompt:
  role_prefix: "You are a documentation specialist."
  task_template: |
    **Changed files**: {changed_files}
    **Documentation to review**: {doc_files}
    **File Paths**:
    {file_paths_in_request}
    **File Contents**:
    {file_contents}
  approach: "Analyze ONLY the documentation files listed. Read the file contents provided above."
`);
          }
          if (path.includes('README.md')) return Promise.resolve('# Demo');
          if (path.includes('src/index.ts')) return Promise.resolve('export const demo = true;');
          if (path.includes('package.json'))
            return Promise.resolve(JSON.stringify({ name: 'demo', version: '0.4.8' }));
          return Promise.resolve('');
        };

        await analyzer.execute('/project', { enableParallel: true });

        expect(capturedPrompt).toContain('README.md');
        expect(capturedPrompt).toContain('package.json');
        expect(capturedPrompt).not.toContain('assets/js/index.js');
        expect(capturedPrompt).not.toContain('.playwright-mcp/page.yml');
      });

      test('uses the preferred documentation model for the AI request', async () => {
        mockGitOps.getModifiedFiles = () => Promise.resolve(['README.md']);
        mockIncrementalProcessor.detectChangedDocs = (files) => Promise.resolve(files);

        await analyzer.execute('/project', { enableParallel: true });

        expect(capturedOptions).toMatchObject({
          persona: 'documentation_expert',
          model: 'claude-sonnet-4.6',
        });
      });

      test('splits oversized Step 1 evidence across multiple AI prompts without truncation', async () => {
        const longReadme = Array.from({ length: 1800 }, (_, index) => `line ${index}`).join('\n');

        mockGitOps.getModifiedFiles = () => Promise.resolve(['README.md', 'package.json']);
        mockIncrementalProcessor.detectChangedDocs = (files) => Promise.resolve(files);
        mockFileOps.readFile = (path) => {
          if (path.includes('ai_helpers')) {
            return Promise.resolve(`
doc_analysis_prompt:
  role_prefix: "You are a documentation specialist."
  task_template: |
    {partition_header}
    {partition_scope_note}
    **Changed files**: {changed_files}
    **Documentation to review**: {doc_files}
    **File Paths**:
    {file_paths_in_request}
    **File Contents**:
    {file_contents}
  approach: "Analyze ONLY the documentation files listed. Read the file contents provided above."
`);
          }
          if (path.includes('README.md')) return Promise.resolve(longReadme);
          if (path.includes('package.json'))
            return Promise.resolve(JSON.stringify({ name: 'demo', version: '0.4.8' }));
          return Promise.resolve('');
        };

        await analyzer.execute('/project', { enableParallel: true });

        expect(capturedPrompts.length).toBeGreaterThan(1);
        expect(capturedPrompts.some((prompt) => prompt.includes('Partition 1 of'))).toBe(true);
        expect(capturedPrompts.some((prompt) => prompt.includes('README.md (part 1/'))).toBe(true);
        expect(capturedPrompts.some((prompt) => prompt.includes('README.md (part 2/'))).toBe(true);
        expect(
          capturedPrompts.some((prompt) =>
            prompt.includes('This request covers 1 of 1 scoped documentation target(s)')
          )
        ).toBe(true);
        expect(
          capturedPrompts.some((prompt) => prompt.includes('...(truncated — remainder omitted)'))
        ).toBe(false);
        expect(
          capturedPrompts.some(
            (prompt) =>
              prompt.includes('## Scoped Documentation Targets') &&
              prompt.includes('## Direct Documentation Target Excerpts')
          )
        ).toBe(true);
        expect(
          capturedPrompts.some((prompt) => prompt.includes('whole-scope synthesis review'))
        ).toBe(true);
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

  describe('Step 1 prompt partition helpers', () => {
    test('buildStep1PromptPartitions keeps complete oversized content across partitions', () => {
      const longContent = Array.from({ length: 1200 }, (_, index) => `line ${index}`).join('\n');
      const partitions = buildStep1PromptPartitions(
        [{ relativePath: 'README.md', content: longContent }],
        9000,
        1000
      );

      expect(partitions.length).toBeGreaterThan(1);
      expect(partitions[0].entries[0].relativePath).toBe('README.md (part 1/11)');
      expect(partitions.at(-1)?.entries.at(-1)?.relativePath).toBe('README.md (part 11/11)');
      expect(
        partitions
          .flatMap((partition) => partition.entries.map((entry) => entry.content))
          .join('\n')
      ).toBe(longContent);
      expect(buildStep1FileContentsBlock(partitions[0].entries)).toContain(
        '### `README.md (part 1/11)`'
      );
    });

    test('buildStep1ScopedDocContextBlock preserves both head and tail context for oversized docs', () => {
      const content = [
        '# Title',
        'intro',
        ...Array.from({ length: 600 }, (_, i) => `line ${i}`),
        'footer',
      ].join('\n');

      const block = buildStep1ScopedDocContextBlock([{ relativePath: 'README.md', content }], 120);

      expect(block).toContain('### `README.md`');
      expect(block).toContain('# Title');
      expect(block).toContain('footer');
      expect(block).toContain('[middle omitted');
    });
  });

  describe('readProjectConventions', () => {
    test('prefers repo authority docs in priority order and combines available files', async () => {
      const mockFileOps = {
        readFile: (path) => {
          if (path.endsWith('/.github/copilot-instructions.md')) {
            return Promise.resolve('# Copilot Instructions\nUse npm run lint.');
          }
          if (path.endsWith('/.github/CONTRIBUTING.md')) {
            return Promise.resolve('# Contributing\nUse conventional commits.');
          }
          if (path.endsWith('/CONTRIBUTING.md')) {
            return Promise.resolve('# Root Contributing\nLegacy entry point.');
          }
          return Promise.reject(new Error('ENOENT'));
        },
      };

      const result = await readProjectConventions(mockFileOps, '/project');

      expect(result).toContain('### .github/copilot-instructions.md');
      expect(result).toContain('### .github/CONTRIBUTING.md');
      expect(result).toContain('### CONTRIBUTING.md');
      expect(result.indexOf('.github/copilot-instructions.md')).toBeLessThan(
        result.indexOf('.github/CONTRIBUTING.md')
      );
    });

    test('deduplicates repeated convention content before injecting it into prompts', async () => {
      const repeated = ['## CONTRIBUTING', '', '- Run `npm test`'].join('\n');
      const mockFileOps = {
        readFile: (path) => {
          if (path.endsWith('/.github/copilot-instructions.md')) {
            return Promise.resolve('# Copilot Instructions\n- Keep docs aligned.');
          }
          if (path.endsWith('/CONTRIBUTING.md')) {
            return Promise.resolve(`${repeated}\n\n---\n\n${repeated}`);
          }
          return Promise.reject(new Error('ENOENT'));
        },
      };

      const result = await readProjectConventions(mockFileOps, '/project');

      expect(result).toContain('### .github/copilot-instructions.md');
      expect(result).toContain('### .github/CONTRIBUTING.md');
      expect(result.match(/Run `npm test`/g)).toHaveLength(1);
    });

    test('returns empty string when no authority docs are present', async () => {
      const mockFileOps = {
        readFile: () => Promise.reject(new Error('ENOENT')),
      };

      await expect(readProjectConventions(mockFileOps, '/project')).resolves.toBe('');
    });
  });
});
