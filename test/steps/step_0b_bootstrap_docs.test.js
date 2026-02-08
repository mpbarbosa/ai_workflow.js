/**
 * Tests for Step 0b: Bootstrap Documentation
 * @group steps
 */

import { jest } from '@jest/globals';
import {
  Step0bBootstrapDocs,
  DOC_TYPES,
  shouldBootstrapDocs,
  identifyMissingDocs,
  categorizeMissingDocs,
  filterSourceFiles,
  countFilesByExtension,
  determinePrimaryLanguage,
  buildTechnicalWriterPrompt,
  formatGapAnalysisReport,
} from '../../src/steps/step_0b_bootstrap_docs.js';

describe('Step 0b: Bootstrap Documentation', () => {
  // ========================================================================
  // PURE FUNCTIONS - Gap Analysis
  // ========================================================================

  describe('shouldBootstrapDocs', () => {
    test('returns true if README is too small', () => {
      const stats = {
        docCount: 5,
        readmeSize: 200,
        hasChangelog: true,
        hasDocsDir: true,
      };
      expect(shouldBootstrapDocs(stats)).toBe(true);
    });

    test('returns true if docs directory missing', () => {
      const stats = {
        docCount: 5,
        readmeSize: 1000,
        hasChangelog: true,
        hasDocsDir: false,
      };
      expect(shouldBootstrapDocs(stats)).toBe(true);
    });

    test('returns true if too few docs', () => {
      const stats = {
        docCount: 1,
        readmeSize: 1000,
        hasChangelog: true,
        hasDocsDir: true,
      };
      expect(shouldBootstrapDocs(stats)).toBe(true);
    });

    test('returns true if CHANGELOG missing', () => {
      const stats = {
        docCount: 5,
        readmeSize: 1000,
        hasChangelog: false,
        hasDocsDir: true,
      };
      expect(shouldBootstrapDocs(stats)).toBe(true);
    });

    test('returns false if all criteria met', () => {
      const stats = {
        docCount: 5,
        readmeSize: 1000,
        hasChangelog: true,
        hasDocsDir: true,
      };
      expect(shouldBootstrapDocs(stats)).toBe(false);
    });
  });

  describe('identifyMissingDocs', () => {
    test('identifies missing documentation files', () => {
      const existing = ['README.md', 'docs/API.md'];
      const missing = identifyMissingDocs(existing);

      expect(missing).toContain('CHANGELOG.md');
      expect(missing).toContain('CONTRIBUTING.md');
      expect(missing).toContain('LICENSE');
      expect(missing).not.toContain('README.md');
    });

    test('returns all docs if none exist', () => {
      const missing = identifyMissingDocs([]);
      expect(missing.length).toBe(Object.keys(DOC_TYPES).length);
    });

    test('returns empty if all docs exist', () => {
      const existing = Object.values(DOC_TYPES);
      const missing = identifyMissingDocs(existing);
      expect(missing).toEqual([]);
    });
  });

  describe('categorizeMissingDocs', () => {
    test('categorizes README as critical', () => {
      const missing = ['README.md', 'CHANGELOG.md', 'docs/API.md'];
      const categorized = categorizeMissingDocs(missing);

      expect(categorized.critical).toContain('README.md');
      expect(categorized.important).toContain('CHANGELOG.md');
      expect(categorized.optional).toContain('docs/API.md');
    });

    test('handles empty list', () => {
      const categorized = categorizeMissingDocs([]);
      expect(categorized.critical).toEqual([]);
      expect(categorized.important).toEqual([]);
      expect(categorized.optional).toEqual([]);
    });
  });

  describe('filterSourceFiles', () => {
    test('filters by source extensions', () => {
      const files = ['src/app.js', 'test/app.test.js', 'README.md', 'src/utils.py', 'package.json'];
      const source = filterSourceFiles(files);

      expect(source).toContain('src/app.js');
      expect(source).toContain('test/app.test.js');
      expect(source).toContain('src/utils.py');
      expect(source).not.toContain('README.md');
      expect(source).not.toContain('package.json');
    });

    test('handles empty list', () => {
      expect(filterSourceFiles([])).toEqual([]);
    });
  });

  describe('countFilesByExtension', () => {
    test('counts files by extension', () => {
      const files = ['app.js', 'utils.js', 'test.py', 'main.py', 'script.sh'];
      const counts = countFilesByExtension(files);

      expect(counts['.js']).toBe(2);
      expect(counts['.py']).toBe(2);
      expect(counts['.sh']).toBe(1);
    });

    test('handles empty list', () => {
      const counts = countFilesByExtension([]);
      expect(counts).toEqual({});
    });
  });

  describe('determinePrimaryLanguage', () => {
    test('identifies JavaScript as primary', () => {
      const counts = { '.js': 10, '.py': 3, '.sh': 1 };
      expect(determinePrimaryLanguage(counts)).toBe('JavaScript');
    });

    test('identifies Python as primary', () => {
      const counts = { '.js': 3, '.py': 15, '.sh': 1 };
      expect(determinePrimaryLanguage(counts)).toBe('Python');
    });

    test('handles unknown extension', () => {
      const counts = { '.xyz': 10 };
      expect(determinePrimaryLanguage(counts)).toBe('Unknown');
    });
  });

  // ========================================================================
  // PURE FUNCTIONS - Prompt Building
  // ========================================================================

  describe('buildTechnicalWriterPrompt', () => {
    test('builds complete prompt', () => {
      const context = {
        projectName: 'My Project',
        projectDescription: 'A test project',
        primaryLanguage: 'JavaScript',
        docCount: 2,
        sourceCount: 50,
        missingDocs: ['CHANGELOG.md', 'CONTRIBUTING.md'],
      };

      const prompt = buildTechnicalWriterPrompt(context);

      expect(prompt).toContain('My Project');
      expect(prompt).toContain('A test project');
      expect(prompt).toContain('JavaScript');
      expect(prompt).toContain('CHANGELOG.md');
      expect(prompt).toContain('CONTRIBUTING.md');
      expect(prompt).toContain('Senior Technical Writer');
      expect(prompt).toContain('**README.md** should include');
    });
  });

  describe('formatGapAnalysisReport', () => {
    test('formats complete report', () => {
      const data = {
        stats: {
          docCount: 2,
          sourceCount: 50,
          readmeSize: 1200,
          hasChangelog: false,
          hasDocsDir: true,
        },
        categorized: {
          critical: ['README.md'],
          important: ['CHANGELOG.md', 'CONTRIBUTING.md'],
          optional: ['docs/API.md'],
        },
        missingDocs: ['README.md', 'CHANGELOG.md', 'CONTRIBUTING.md', 'docs/API.md'],
        timestamp: '2026-02-08 13:30:00',
      };

      const report = formatGapAnalysisReport(data);

      expect(report).toContain('Step 0b: Documentation Gap Analysis Report');
      expect(report).toContain('Documentation Files**: 2');
      expect(report).toContain('Source Files**: 50');
      expect(report).toContain('Total Missing Documentation**: 4');
      expect(report).toContain('README.md');
      expect(report).toContain('CHANGELOG.md');
    });

    test('handles no missing docs', () => {
      const data = {
        stats: {
          docCount: 10,
          sourceCount: 50,
          readmeSize: 2000,
          hasChangelog: true,
          hasDocsDir: true,
        },
        categorized: { critical: [], important: [], optional: [] },
        missingDocs: [],
        timestamp: '2026-02-08 13:30:00',
      };

      const report = formatGapAnalysisReport(data);
      expect(report).toContain('Total Missing Documentation**: 0');
      expect(report).toContain('sufficient documentation coverage');
    });
  });

  // ========================================================================
  // STEP0BBOOTSTRAPDOCS - Integration Tests
  // ========================================================================

  describe('Step0bBootstrapDocs', () => {
    let mockFileOps;
    let mockBacklog;
    let mockLogger;

    beforeEach(() => {
      mockFileOps = {
        readFile: jest.fn(),
        writeFile: jest.fn(),
      };
      mockBacklog = {
        saveStepSummary: jest.fn(),
        saveStepIssues: jest.fn(),
      };
      mockLogger = {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        success: jest.fn(),
      };
    });

    test('constructs with default options', () => {
      const step = new Step0bBootstrapDocs();
      expect(step).toBeInstanceOf(Step0bBootstrapDocs);
      expect(step.dryRun).toBe(false);
    });

    test('constructs with custom options', () => {
      const step = new Step0bBootstrapDocs({
        fileOps: mockFileOps,
        backlog: mockBacklog,
        logger: mockLogger,
        dryRun: true,
        projectRoot: '/custom/root',
      });
      expect(step.fileOps).toBe(mockFileOps);
      expect(step.dryRun).toBe(true);
      expect(step.projectRoot).toBe('/custom/root');
    });

    test('executes dry-run mode', async () => {
      const step = new Step0bBootstrapDocs({
        backlog: mockBacklog,
        logger: mockLogger,
        dryRun: true,
      });

      const result = await step.execute();

      expect(result.success).toBe(true);
      expect(result.dryRun).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith('[DRY RUN] Documentation gap analysis preview:');
    });

    test('skips when sufficient docs exist', async () => {
      const step = new Step0bBootstrapDocs({
        backlog: mockBacklog,
        logger: mockLogger,
      });

      step.gatherProjectStats = jest.fn().mockResolvedValue({
        docCount: 10,
        sourceCount: 50,
        readmeSize: 2000,
        hasChangelog: true,
        hasDocsDir: true,
      });

      const result = await step.execute();

      expect(result.success).toBe(true);
      expect(result.skipped).toBe(true);
      expect(result.reason).toBe('sufficient documentation exists');
      expect(mockBacklog.saveStepSummary).toHaveBeenCalledWith(
        '0b',
        'Bootstrap_Docs',
        expect.stringContaining('Skipped'),
        '⏭️'
      );
    });

    test('executes successful gap analysis', async () => {
      const step = new Step0bBootstrapDocs({
        backlog: mockBacklog,
        logger: mockLogger,
      });

      step.gatherProjectStats = jest.fn().mockResolvedValue({
        docCount: 2,
        sourceCount: 50,
        readmeSize: 400,
        hasChangelog: false,
        hasDocsDir: true,
      });

      step.listExistingDocs = jest.fn().mockResolvedValue(['README.md', 'docs/API.md']);

      const result = await step.execute();

      expect(result.success).toBe(true);
      expect(result.missingDocs).toBeDefined();
      expect(result.categorized).toBeDefined();
      expect(mockBacklog.saveStepSummary).toHaveBeenCalled();
      expect(mockLogger.success).toHaveBeenCalledWith(
        expect.stringContaining('Step 0b: Documentation gap analysis completed')
      );
    });

    test('handles errors gracefully', async () => {
      const step = new Step0bBootstrapDocs({
        backlog: mockBacklog,
        logger: mockLogger,
      });

      step.gatherProjectStats = jest.fn().mockRejectedValue(new Error('File system error'));

      const result = await step.execute();

      expect(result.success).toBe(false);
      expect(result.error).toBe('File system error');
      expect(mockBacklog.saveStepIssues).toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });
});
