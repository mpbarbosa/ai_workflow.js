/**
 * Tests for Step 02_5 Git Analysis Module
 * @group steps
 */

import { jest } from '@jest/globals';
import {
  GitAnalyzer,
  GIT_THRESHOLDS,
  parseGitLog,
  extractLastModified,
  countRecentCommits,
  calculateAgeMonths,
  isRecentlyModified,
  determineStalenessLevel,
  calculateStalenessScore,
  countFileReferences,
  findReferencingFiles,
  buildFileAnalysis,
  filterByStalenessLevel,
  sortByStalenesScore,
  generateSummaryStats,
} from '../../../src/steps/step_02_5_lib/git_analysis.js';

describe('Step 02_5 Git Analysis Module', () => {
  // ==========================================================================
  // PURE FUNCTIONS - Git Log Parsing
  // ==========================================================================

  describe('parseGitLog', () => {
    test('parses git log output', () => {
      const logOutput = `1704067200|abc123|John Doe|Initial commit
1706659200|def456|Jane Smith|Update docs`;

      const commits = parseGitLog(logOutput);

      expect(commits).toHaveLength(2);
      expect(commits[0]).toEqual({
        timestamp: 1704067200,
        hash: 'abc123',
        author: 'John Doe',
        subject: 'Initial commit',
      });
      expect(commits[1]).toEqual({
        timestamp: 1706659200,
        hash: 'def456',
        author: 'Jane Smith',
        subject: 'Update docs',
      });
    });

    test('handles empty output', () => {
      expect(parseGitLog('')).toEqual([]);
      expect(parseGitLog('   ')).toEqual([]);
    });

    test('ignores malformed lines', () => {
      const logOutput = `1704067200|abc123|John Doe|Initial commit
invalid line
1706659200|def456|Jane Smith|Update docs`;

      const commits = parseGitLog(logOutput);
      expect(commits).toHaveLength(2);
    });
  });

  describe('extractLastModified', () => {
    test('extracts timestamp from first commit', () => {
      const commits = [
        { timestamp: 1706659200, hash: 'def456', author: 'Jane', subject: 'Update' },
        { timestamp: 1704067200, hash: 'abc123', author: 'John', subject: 'Initial' },
      ];

      expect(extractLastModified(commits)).toBe(1706659200);
    });

    test('returns 0 for empty commits', () => {
      expect(extractLastModified([])).toBe(0);
    });
  });

  describe('countRecentCommits', () => {
    test('counts commits within time period', () => {
      const currentTime = 1709251200; // 2024-03-01
      const commits = [
        { timestamp: 1706659200 }, // 2024-01-31 (1 month ago)
        { timestamp: 1704067200 }, // 2024-01-01 (2 months ago)
        { timestamp: 1701475200 }, // 2023-12-02 (3 months ago)
        { timestamp: 1698883200 }, // 2023-11-02 (4 months ago)
      ];

      expect(countRecentCommits(commits, currentTime, 2)).toBe(2);
      expect(countRecentCommits(commits, currentTime, 3)).toBe(3);
      expect(countRecentCommits(commits, currentTime, 6)).toBe(4);
    });

    test('returns 0 for no recent commits', () => {
      const currentTime = 1709251200;
      const commits = [{ timestamp: 1672531200 }]; // 2023-01-01 (old)

      expect(countRecentCommits(commits, currentTime, 1)).toBe(0);
    });
  });

  // ==========================================================================
  // PURE FUNCTIONS - Staleness Detection
  // ==========================================================================

  describe('calculateAgeMonths', () => {
    test('calculates age in months', () => {
      const currentTime = 1709251200; // 2024-03-01
      const timestamp = 1704067200; // 2024-01-01

      expect(calculateAgeMonths(timestamp, currentTime)).toBe(2);
    });

    test('returns 0 for timestamp 0', () => {
      expect(calculateAgeMonths(0, 1709251200)).toBe(0);
    });

    test('handles exact month boundaries', () => {
      const currentTime = 1709251200;
      const sixMonthsAgo = currentTime - 6 * 30 * 24 * 60 * 60;

      expect(calculateAgeMonths(sixMonthsAgo, currentTime)).toBe(6);
    });
  });

  describe('isRecentlyModified', () => {
    test('returns true for recent files', () => {
      const currentTime = 1709251200;
      const threeMonthsAgo = currentTime - 3 * 30 * 24 * 60 * 60;

      expect(isRecentlyModified(threeMonthsAgo, currentTime, 6)).toBe(true);
    });

    test('returns false for stale files', () => {
      const currentTime = 1709251200;
      const eightMonthsAgo = currentTime - 8 * 30 * 24 * 60 * 60;

      expect(isRecentlyModified(eightMonthsAgo, currentTime, 6)).toBe(false);
    });

    test('returns true for untracked files', () => {
      expect(isRecentlyModified(0, 1709251200, 6)).toBe(true);
    });
  });

  describe('determineStalenessLevel', () => {
    test('returns fresh for recent files', () => {
      expect(determineStalenessLevel(2)).toBe('fresh');
    });

    test('returns stale for moderately old files', () => {
      expect(determineStalenessLevel(8)).toBe('stale');
    });

    test('returns outdated for old files', () => {
      expect(determineStalenessLevel(14)).toBe('outdated');
    });

    test('returns abandoned for very old files', () => {
      expect(determineStalenessLevel(20)).toBe('abandoned');
    });

    test('uses custom thresholds', () => {
      const thresholds = { STALE_MONTHS: 3, OUTDATED_MONTHS: 6, ABANDONED_MONTHS: 12 };
      expect(determineStalenessLevel(4, thresholds)).toBe('stale');
    });
  });

  describe('calculateStalenessScore', () => {
    test('returns low score for fresh active files', () => {
      const score = calculateStalenessScore(2, 5, 3);
      expect(score).toBeLessThan(30);
    });

    test('returns high score for old inactive files', () => {
      const score = calculateStalenessScore(18, 0, 0);
      expect(score).toBeGreaterThan(70);
    });

    test('factors in commit activity', () => {
      const noCommits = calculateStalenessScore(10, 0, 0);
      const manyCommits = calculateStalenessScore(10, 10, 0);
      expect(noCommits).toBeGreaterThan(manyCommits);
    });

    test('factors in reference count', () => {
      const noRefs = calculateStalenessScore(10, 0, 0);
      const manyRefs = calculateStalenessScore(10, 0, 10);
      expect(noRefs).toBeGreaterThan(manyRefs);
    });

    test('caps score at 100', () => {
      const score = calculateStalenessScore(100, 0, 0);
      expect(score).toBeLessThanOrEqual(100);
    });
  });

  // ==========================================================================
  // PURE FUNCTIONS - Reference Counting
  // ==========================================================================

  describe('countFileReferences', () => {
    test('counts markdown link references', () => {
      const content = `
# Documentation
See [guide](docs/guide.md) and [API](api.md).
Also check [guide](guide.md) again.
      `;

      expect(countFileReferences(content, 'guide.md')).toBe(2);
      expect(countFileReferences(content, 'api.md')).toBe(1);
    });

    test('returns 0 for no references', () => {
      const content = '# No links here';
      expect(countFileReferences(content, 'guide.md')).toBe(0);
    });

    test('handles path variations', () => {
      const content = '[guide](../docs/guide.md) and [another](./guide.md)';
      expect(countFileReferences(content, 'guide.md')).toBe(2);
    });
  });

  describe('findReferencingFiles', () => {
    test('finds files that reference target', () => {
      const fileContents = new Map([
        ['doc1.md', 'See [API](api.md) for details'],
        ['doc2.md', 'Check the [API documentation](api.md)'],
        ['doc3.md', 'No references here'],
        ['api.md', 'Self reference [API](api.md)'],
      ]);

      const refs = findReferencingFiles(fileContents, 'api.md');

      expect(refs).toHaveLength(2);
      expect(refs).toContain('doc1.md');
      expect(refs).toContain('doc2.md');
      expect(refs).not.toContain('api.md'); // Excludes self
    });

    test('returns empty array if no references', () => {
      const fileContents = new Map([
        ['doc1.md', 'No links'],
        ['doc2.md', 'Also no links'],
      ]);

      const refs = findReferencingFiles(fileContents, 'api.md');
      expect(refs).toEqual([]);
    });
  });

  // ==========================================================================
  // PURE FUNCTIONS - Analysis Results
  // ==========================================================================

  describe('buildFileAnalysis', () => {
    test('builds complete analysis report', () => {
      const data = {
        lastModified: 1704067200,
        ageMonths: 10,
        commitCount: 2,
        referenceCount: 3,
        currentTime: 1709251200,
      };

      const analysis = buildFileAnalysis('docs/api.md', data);

      expect(analysis.file).toBe('docs/api.md');
      expect(analysis.lastModified).toBe(1704067200);
      expect(analysis.ageMonths).toBe(10);
      expect(analysis.commitCount).toBe(2);
      expect(analysis.referenceCount).toBe(3);
      expect(analysis.stalenessLevel).toBe('stale');
      expect(analysis.stalenessScore).toBeGreaterThan(0);
      expect(analysis.isOutdated).toBe(false);
      expect(analysis.isAbandoned).toBe(false);
    });

    test('identifies outdated files', () => {
      const data = {
        lastModified: 1672531200,
        ageMonths: 14,
        commitCount: 0,
        referenceCount: 0,
      };

      const analysis = buildFileAnalysis('old.md', data);
      expect(analysis.isOutdated).toBe(true);
      expect(analysis.stalenessLevel).toBe('outdated');
    });

    test('identifies abandoned files', () => {
      const data = {
        lastModified: 1640995200,
        ageMonths: 20,
        commitCount: 0,
        referenceCount: 0,
      };

      const analysis = buildFileAnalysis('abandoned.md', data);
      expect(analysis.isAbandoned).toBe(true);
      expect(analysis.stalenessLevel).toBe('abandoned');
    });
  });

  describe('filterByStalenessLevel', () => {
    test('filters analyses by level', () => {
      const analyses = [
        { file: 'fresh.md', stalenessLevel: 'fresh' },
        { file: 'stale.md', stalenessLevel: 'stale' },
        { file: 'outdated.md', stalenessLevel: 'outdated' },
      ];

      expect(filterByStalenessLevel(analyses, 'stale')).toHaveLength(1);
      expect(filterByStalenessLevel(analyses, 'fresh')).toHaveLength(1);
    });

    test('returns empty array if no matches', () => {
      const analyses = [{ file: 'fresh.md', stalenessLevel: 'fresh' }];
      expect(filterByStalenessLevel(analyses, 'abandoned')).toEqual([]);
    });
  });

  describe('sortByStalenesScore', () => {
    test('sorts by score descending', () => {
      const analyses = [
        { file: 'a.md', stalenessScore: 30 },
        { file: 'b.md', stalenessScore: 80 },
        { file: 'c.md', stalenessScore: 50 },
      ];

      const sorted = sortByStalenesScore(analyses);

      expect(sorted[0].stalenessScore).toBe(80);
      expect(sorted[1].stalenessScore).toBe(50);
      expect(sorted[2].stalenessScore).toBe(30);
    });

    test('does not modify original array', () => {
      const analyses = [
        { file: 'a.md', stalenessScore: 30 },
        { file: 'b.md', stalenessScore: 80 },
      ];

      sortByStalenesScore(analyses);

      expect(analyses[0].stalenessScore).toBe(30); // Original unchanged
    });
  });

  describe('generateSummaryStats', () => {
    test('generates complete statistics', () => {
      const analyses = [
        { ageMonths: 2, stalenessLevel: 'fresh', stalenessScore: 10 },
        { ageMonths: 8, stalenessLevel: 'stale', stalenessScore: 50 },
        { ageMonths: 14, stalenessLevel: 'outdated', stalenessScore: 80 },
      ];

      const summary = generateSummaryStats(analyses);

      expect(summary.totalFiles).toBe(3);
      expect(summary.byLevel.fresh).toBe(1);
      expect(summary.byLevel.stale).toBe(1);
      expect(summary.byLevel.outdated).toBe(1);
      expect(summary.avgAgeMonths).toBe(8);
      expect(summary.avgStalenessScore).toBeCloseTo(47, 0);
    });

    test('handles empty analyses', () => {
      const summary = generateSummaryStats([]);

      expect(summary.totalFiles).toBe(0);
      expect(summary.avgAgeMonths).toBe(0);
      expect(summary.avgStalenessScore).toBe(0);
    });
  });

  // ==========================================================================
  // GIT ANALYZER - Integration Tests
  // ==========================================================================

  describe('GitAnalyzer', () => {
    let mockGitAutomation;
    let mockFileOps;
    let mockLogger;
    let analyzer;

    beforeEach(() => {
      mockGitAutomation = {
        executeGitCommand: jest.fn(),
      };
      mockFileOps = {
        readFile: jest.fn(),
      };
      mockLogger = {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      };

      analyzer = new GitAnalyzer({
        gitAutomation: mockGitAutomation,
        fileOps: mockFileOps,
        logger: mockLogger,
      });
    });

    test('constructs with default options', () => {
      const defaultAnalyzer = new GitAnalyzer({});
      expect(defaultAnalyzer.thresholds).toEqual(GIT_THRESHOLDS);
    });

    test('getFileHistory retrieves git log', async () => {
      mockGitAutomation.executeGitCommand.mockResolvedValue({
        stdout: '1704067200|abc123|John|Initial\n1706659200|def456|Jane|Update',
      });

      const commits = await analyzer.getFileHistory('docs/api.md');

      expect(commits).toHaveLength(2);
      expect(mockGitAutomation.executeGitCommand).toHaveBeenCalledWith(
        ['log', '--format=%ct|%h|%an|%s', '--', 'docs/api.md'],
        { captureOutput: true }
      );
    });

    test('getFileHistory handles errors gracefully', async () => {
      mockGitAutomation.executeGitCommand.mockRejectedValue(new Error('Git error'));

      const commits = await analyzer.getFileHistory('missing.md');

      expect(commits).toEqual([]);
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    test('analyzeFiles processes multiple files', async () => {
      mockGitAutomation.executeGitCommand.mockResolvedValue({
        stdout: '1704067200|abc123|John|Initial',
      });
      mockFileOps.readFile.mockResolvedValue('# Doc\nSome content');

      const files = ['doc1.md', 'doc2.md'];
      const currentTime = 1709251200;

      const analyses = await analyzer.analyzeFiles(files, currentTime);

      expect(analyses).toHaveLength(2);
      expect(analyses[0].file).toBe('doc1.md');
      expect(analyses[1].file).toBe('doc2.md');
      expect(mockLogger.info).toHaveBeenCalled();
    });

    test('getOutdatedFiles filters outdated', () => {
      const analyses = [
        { file: 'fresh.md', isOutdated: false },
        { file: 'old.md', isOutdated: true },
        { file: 'stale.md', isOutdated: false },
      ];

      const outdated = analyzer.getOutdatedFiles(analyses);

      expect(outdated).toHaveLength(1);
      expect(outdated[0].file).toBe('old.md');
    });

    test('getAbandonedFiles filters abandoned', () => {
      const analyses = [
        { file: 'fresh.md', isAbandoned: false },
        { file: 'abandoned.md', isAbandoned: true },
      ];

      const abandoned = analyzer.getAbandonedFiles(analyses);

      expect(abandoned).toHaveLength(1);
      expect(abandoned[0].file).toBe('abandoned.md');
    });

    test('getSummary returns statistics', () => {
      const analyses = [
        { ageMonths: 2, stalenessLevel: 'fresh', stalenessScore: 10 },
        { ageMonths: 8, stalenessLevel: 'stale', stalenessScore: 50 },
      ];

      const summary = analyzer.getSummary(analyses);

      expect(summary.totalFiles).toBe(2);
      expect(summary.avgAgeMonths).toBe(5);
    });

    test('formatResults generates display output', () => {
      const analyses = [
        {
          file: 'doc1.md',
          ageMonths: 10,
          stalenessLevel: 'stale',
          stalenessScore: 60,
        },
        {
          file: 'doc2.md',
          ageMonths: 5,
          stalenessLevel: 'fresh',
          stalenessScore: 20,
        },
      ];

      const output = analyzer.formatResults(analyses, 5);

      expect(output).toContain('Git Analysis Summary');
      expect(output).toContain('Total Files: 2');
      expect(output).toContain('doc1.md');
      expect(output).toContain('60/100');
    });
  });
});
