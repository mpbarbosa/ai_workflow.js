/**
 * Tests for Step 02_5 Documentation Optimizer (Main Orchestrator)
 */

import { jest } from '@jest/globals';
import {
  DEFAULT_CONFIG,
  PHASES,
  mergeConfig,
  validateConfig,
  createInitialState,
  updateState,
  aggregateResults,
  calculateExecutionTime,
  DocumentationOptimizer,
} from '../../src/steps/step_02_5_doc_optimize.js';

describe('Documentation Optimizer - Pure Functions', () => {
  describe('mergeConfig', () => {
    test('returns default config when no user config', () => {
      const config = mergeConfig();
      expect(config.docsDir).toBe('docs');
      expect(config.similarityThreshold).toBe(0.8);
    });

    test('merges user config with defaults', () => {
      const userConfig = { docsDir: 'documentation', similarityThreshold: 0.9 };
      const config = mergeConfig(userConfig);
      expect(config.docsDir).toBe('documentation');
      expect(config.similarityThreshold).toBe(0.9);
      expect(config.dryRun).toBe(false); // Default preserved
    });

    test('merges exclude patterns', () => {
      const userConfig = { excludePatterns: ['*.tmp'] };
      const config = mergeConfig(userConfig);
      expect(config.excludePatterns).toContain('CHANGELOG.md'); // Default
      expect(config.excludePatterns).toContain('*.tmp'); // User
    });
  });

  describe('validateConfig', () => {
    test('validates correct config', () => {
      const config = { ...DEFAULT_CONFIG };
      const result = validateConfig(config);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    test('rejects missing docsDir', () => {
      const config = { ...DEFAULT_CONFIG, docsDir: '' };
      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('docsDir must be a non-empty string');
    });

    test('rejects invalid similarityThreshold', () => {
      const config = { ...DEFAULT_CONFIG, similarityThreshold: 1.5 };
      const result = validateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('rejects negative outdatedThresholdMonths', () => {
      const config = { ...DEFAULT_CONFIG, outdatedThresholdMonths: -1 };
      const result = validateConfig(config);
      expect(result.valid).toBe(false);
    });
  });

  describe('createInitialState', () => {
    test('creates initial state with config', () => {
      const config = { ...DEFAULT_CONFIG };
      const state = createInitialState(config);
      expect(state.config).toBe(config);
      expect(state.phase).toBeNull();
      expect(state.files).toEqual([]);
      expect(state.errors).toEqual([]);
    });
  });

  describe('updateState', () => {
    test('returns new state with updates', () => {
      const state = { phase: null, files: [] };
      const updated = updateState(state, { phase: PHASES.HEURISTICS, files: ['a.md'] });
      expect(updated.phase).toBe(PHASES.HEURISTICS);
      expect(updated.files).toEqual(['a.md']);
      expect(updated).not.toBe(state); // Immutable
    });

    test('does not mutate original state', () => {
      const state = { files: [] };
      const updated = updateState(state, { files: ['a.md'] });
      expect(state.files).toEqual([]);
      expect(updated.files).toEqual(['a.md']);
    });
  });

  describe('aggregateResults', () => {
    test('aggregates workflow results', () => {
      const state = {
        files: ['a.md', 'b.md', 'c.md'],
        exactDuplicates: ['a.md'],
        redundantPairs: [{ file1: 'b.md', file2: 'c.md' }],
        outdatedFiles: ['d.md'],
        edgeCases: [],
        errors: [],
      };

      const results = aggregateResults(state);

      expect(results.totalFiles).toBe(3);
      expect(results.exactDuplicates).toEqual(['a.md']);
      expect(results.filesOptimized).toBe(2); // 1 duplicate + 1 outdated
    });
  });

  describe('calculateExecutionTime', () => {
    test('calculates time in seconds', () => {
      const start = 1000000;
      const end = 1005500;
      expect(calculateExecutionTime(start, end)).toBe(6); // Rounded
    });

    test('handles same start and end', () => {
      expect(calculateExecutionTime(1000, 1000)).toBe(0);
    });
  });
});

describe('DocumentationOptimizer - Integration', () => {
  let optimizer;
  let mockFileOps;
  let mockHeuristics;
  let mockGitAnalyzer;
  let mockVersionAnalyzer;
  let mockConsolidation;
  let mockReporting;
  let mockAiAnalyzer;

  beforeEach(() => {
    mockFileOps = {
      directoryExists: jest.fn(),
      listFiles: jest.fn(),
    };

    mockHeuristics = {
      analyzeDocuments: jest.fn(),
    };

    mockGitAnalyzer = {
      analyzeDocuments: jest.fn(),
    };

    mockVersionAnalyzer = {
      analyzeDocuments: jest.fn(),
    };

    mockConsolidation = {
      generateTimestamp: jest.fn().mockReturnValue('20260208_140000'),
      consolidateDuplicates: jest.fn(),
      archiveOutdatedFiles: jest.fn(),
    };

    mockReporting = {
      generateAndDisplay: jest.fn(),
    };

    mockAiAnalyzer = {
      analyzeEdgeCases: jest.fn(),
    };

    optimizer = new DocumentationOptimizer({
      fileOps: mockFileOps,
      heuristics: mockHeuristics,
      gitAnalyzer: mockGitAnalyzer,
      versionAnalyzer: mockVersionAnalyzer,
      consolidation: mockConsolidation,
      reporting: mockReporting,
      aiAnalyzer: mockAiAnalyzer,
      logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), step: jest.fn() },
    });
  });

  describe('initialize', () => {
    test('initializes with valid config', () => {
      const result = optimizer.initialize({ docsDir: 'documentation' });
      expect(result.valid).toBe(true);
      expect(optimizer.state.config.docsDir).toBe('documentation');
    });

    test('rejects invalid config', () => {
      const result = optimizer.initialize({ similarityThreshold: 2.0 });
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('shouldSkip', () => {
    beforeEach(() => {
      optimizer.initialize();
    });

    test('skips when directory does not exist', async () => {
      mockFileOps.directoryExists.mockResolvedValue(false);

      const result = await optimizer.shouldSkip();

      expect(result.skip).toBe(true);
      expect(result.reason).toContain('not found');
    });

    test('skips when too few files', async () => {
      mockFileOps.directoryExists.mockResolvedValue(true);
      mockFileOps.listFiles.mockResolvedValue(['a.md', 'b.md']); // Only 2 files

      const result = await optimizer.shouldSkip();

      expect(result.skip).toBe(true);
      expect(result.reason).toContain('too small');
    });

    test('does not skip when enough files', async () => {
      mockFileOps.directoryExists.mockResolvedValue(true);
      mockFileOps.listFiles.mockResolvedValue(['a.md', 'b.md', 'c.md', 'd.md', 'e.md']);

      const result = await optimizer.shouldSkip();

      expect(result.skip).toBe(false);
      expect(optimizer.state.files).toHaveLength(5);
    });
  });

  describe('runHeuristicsAnalysis', () => {
    beforeEach(() => {
      optimizer.initialize();
      optimizer.state.files = ['a.md', 'b.md', 'c.md'];
    });

    test('runs heuristics analysis successfully', async () => {
      mockHeuristics.analyzeDocuments.mockResolvedValue({
        exactDuplicates: ['a.md'],
        redundantPairs: [{ file1: 'b.md', file2: 'c.md', similarity: 0.85 }],
      });

      await optimizer.runHeuristicsAnalysis();

      expect(optimizer.state.exactDuplicates).toEqual(['a.md']);
      expect(optimizer.state.redundantPairs).toHaveLength(1);
      expect(optimizer.state.phase).toBe(PHASES.HEURISTICS);
    });

    test('handles heuristics analysis errors', async () => {
      mockHeuristics.analyzeDocuments.mockRejectedValue(new Error('Analysis failed'));

      await expect(optimizer.runHeuristicsAnalysis()).rejects.toThrow('Analysis failed');
      expect(optimizer.state.errors).toHaveLength(1);
    });
  });

  describe('runGitHistoryAnalysis', () => {
    beforeEach(() => {
      optimizer.initialize();
      optimizer.state.files = ['a.md', 'b.md'];
    });

    test('runs git history analysis successfully', async () => {
      mockGitAnalyzer.analyzeDocuments.mockResolvedValue({
        outdatedFiles: ['a.md'],
      });

      await optimizer.runGitHistoryAnalysis();

      expect(optimizer.state.outdatedFiles).toEqual(['a.md']);
      expect(optimizer.state.phase).toBe(PHASES.GIT_HISTORY);
    });

    test('continues on git analysis errors', async () => {
      mockGitAnalyzer.analyzeDocuments.mockRejectedValue(new Error('Git failed'));

      await optimizer.runGitHistoryAnalysis(); // Should not throw

      expect(optimizer.state.errors).toHaveLength(1);
    });
  });

  describe('runVersionAnalysis', () => {
    beforeEach(() => {
      optimizer.initialize();
      optimizer.state.files = ['a.md', 'b.md'];
      optimizer.state.outdatedFiles = ['a.md'];
    });

    test('merges outdated files from version analysis', async () => {
      mockVersionAnalyzer.analyzeDocuments.mockResolvedValue({
        outdatedFiles: ['b.md'],
      });

      await optimizer.runVersionAnalysis();

      expect(optimizer.state.outdatedFiles).toHaveLength(2);
      expect(optimizer.state.outdatedFiles).toContain('a.md');
      expect(optimizer.state.outdatedFiles).toContain('b.md');
    });
  });

  describe('runAiEdgeCaseAnalysis', () => {
    beforeEach(() => {
      optimizer.initialize();
      optimizer.state.redundantPairs = [{ file1: 'a.md', file2: 'b.md', similarity: 0.75 }];
    });

    test('runs AI analysis on edge cases', async () => {
      mockAiAnalyzer.analyzeEdgeCases.mockResolvedValue({
        results: [{ pair: {}, updatedScore: 0.9, originalScore: 0.75 }],
        summary: { promoted: 1, demoted: 0, errors: 0 },
      });

      await optimizer.runAiEdgeCaseAnalysis();

      expect(mockAiAnalyzer.analyzeEdgeCases).toHaveBeenCalled();
      expect(optimizer.state.phase).toBe(PHASES.AI_EDGE_CASES);
    });

    test('skips when no redundant pairs', async () => {
      optimizer.state.redundantPairs = [];

      await optimizer.runAiEdgeCaseAnalysis();

      expect(mockAiAnalyzer.analyzeEdgeCases).not.toHaveBeenCalled();
    });

    test('skips when no AI analyzer', async () => {
      optimizer.aiAnalyzer = null;

      await optimizer.runAiEdgeCaseAnalysis();

      expect(mockAiAnalyzer.analyzeEdgeCases).not.toHaveBeenCalled();
    });
  });

  describe('displaySummary', () => {
    beforeEach(() => {
      optimizer.initialize();
      optimizer.state.files = ['a.md', 'b.md', 'c.md'];
      optimizer.state.exactDuplicates = ['a.md'];
      optimizer.state.outdatedFiles = ['b.md'];
    });

    test('displays and returns summary', () => {
      const summary = optimizer.displaySummary();

      expect(summary.totalFiles).toBe(3);
      expect(summary.exactDuplicates).toEqual(['a.md']);
      expect(summary.filesOptimized).toBe(2);
    });
  });

  describe('executeOptimizations', () => {
    beforeEach(() => {
      optimizer.initialize();
      optimizer.state.exactDuplicates = ['a.md', 'b.md'];
      optimizer.state.outdatedFiles = ['c.md'];
    });

    test('executes consolidation and archiving', async () => {
      mockConsolidation.consolidateDuplicates.mockResolvedValue({
        archived: ['a.md', 'b.md'],
        removed: ['a.md', 'b.md'],
      });

      mockConsolidation.archiveOutdatedFiles.mockResolvedValue({
        archived: ['c.md'],
      });

      const result = await optimizer.executeOptimizations();

      expect(result.consolidation.archived).toEqual(['a.md', 'b.md']);
      expect(result.archive.archived).toEqual(['c.md']);
      expect(result.timestamp).toBe('20260208_140000');
    });

    test('handles optimization errors', async () => {
      mockConsolidation.consolidateDuplicates.mockRejectedValue(new Error('Consolidation failed'));

      await expect(optimizer.executeOptimizations()).rejects.toThrow('Consolidation failed');
      expect(optimizer.state.errors).toHaveLength(1);
    });
  });

  describe('generateReport', () => {
    beforeEach(() => {
      optimizer.initialize();
      optimizer.state.files = ['a.md', 'b.md'];
      optimizer.state.exactDuplicates = ['a.md'];
    });

    test('generates optimization report', async () => {
      const optimizationResults = {
        consolidation: { archived: ['a.md'], removed: ['a.md'] },
        archive: { archived: [] },
        timestamp: '20260208_140000',
      };

      mockReporting.generateAndDisplay.mockResolvedValue({
        reportPath: '/path/to/report.md',
        metrics: {},
      });

      const result = await optimizer.generateReport(optimizationResults);

      expect(mockReporting.generateAndDisplay).toHaveBeenCalled();
      expect(result.reportPath).toBe('/path/to/report.md');
    });
  });

  describe('run', () => {
    test('runs complete workflow successfully', async () => {
      mockFileOps.directoryExists.mockResolvedValue(true);
      mockFileOps.listFiles.mockResolvedValue(['a.md', 'b.md', 'c.md', 'd.md', 'e.md']);

      mockHeuristics.analyzeDocuments.mockResolvedValue({
        exactDuplicates: ['a.md'],
        redundantPairs: [],
      });

      mockGitAnalyzer.analyzeDocuments.mockResolvedValue({ outdatedFiles: ['b.md'] });
      mockVersionAnalyzer.analyzeDocuments.mockResolvedValue({ outdatedFiles: [] });

      mockConsolidation.consolidateDuplicates.mockResolvedValue({
        archived: ['a.md'],
        removed: ['a.md'],
      });
      mockConsolidation.archiveOutdatedFiles.mockResolvedValue({ archived: ['b.md'] });
      mockReporting.generateAndDisplay.mockResolvedValue({ reportPath: '/report.md', metrics: {} });

      const result = await optimizer.run();

      expect(result.success).toBe(true);
      expect(result.summary.totalFiles).toBe(5);
      expect(result.executionTime).toBeGreaterThanOrEqual(0);
    });

    test('skips when directory not found', async () => {
      mockFileOps.directoryExists.mockResolvedValue(false);

      const result = await optimizer.run();

      expect(result.success).toBe(true);
      expect(result.skipped).toBe(true);
    });

    test('handles workflow errors gracefully', async () => {
      mockFileOps.directoryExists.mockResolvedValue(true);
      mockFileOps.listFiles.mockResolvedValue(['a.md', 'b.md', 'c.md', 'd.md', 'e.md']);
      mockHeuristics.analyzeDocuments.mockRejectedValue(new Error('Fatal error'));

      const result = await optimizer.run();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Fatal error');
      expect(result.executionTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getState', () => {
    test('returns current state', () => {
      optimizer.initialize();
      const state = optimizer.getState();
      expect(state).toBe(optimizer.state);
    });
  });
});
