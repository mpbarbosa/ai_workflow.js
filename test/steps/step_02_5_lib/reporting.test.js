/**
 * Tests for Step 02_5 Reporting Module
 */

import { jest } from '@jest/globals';
import {
  DEFAULT_RECOMMENDATIONS,
  calculateTotalSize,
  calculateSizeSavings,
  estimateTokenSavings,
  calculateOptimizationMetrics,
  formatTimestamp,
  formatFileList,
  formatRedundantPairs,
  formatSummarySection,
  formatActionsSection,
  formatRecommendationsSection,
  formatArchiveSection,
  generateOptimizationReport,
  formatConsoleSummary,
  ReportingManager,
} from '../../../src/steps/step_02_5_lib/reporting.js';

describe('Reporting Module - Pure Functions', () => {
  describe('calculateTotalSize', () => {
    test('empty array returns 0', () => {
      expect(calculateTotalSize([])).toBe(0);
    });

    test('calculates sum of file sizes', () => {
      const files = [
        { path: 'a.md', size: 1024 },
        { path: 'b.md', size: 2048 },
        { path: 'c.md', size: 512 },
      ];
      expect(calculateTotalSize(files)).toBe(3584);
    });

    test('handles missing size property', () => {
      const files = [{ path: 'a.md', size: 1024 }, { path: 'b.md' }, { path: 'c.md', size: 512 }];
      expect(calculateTotalSize(files)).toBe(1536);
    });

    test('handles zero sizes', () => {
      const files = [
        { path: 'a.md', size: 0 },
        { path: 'b.md', size: 0 },
      ];
      expect(calculateTotalSize(files)).toBe(0);
    });
  });

  describe('calculateSizeSavings', () => {
    test('calculates savings correctly', () => {
      const result = calculateSizeSavings(10240, 5120);
      expect(result.bytes).toBe(5120);
      expect(result.kilobytes).toBe(5);
      expect(result.percentage).toBe(50);
    });

    test('handles zero before size', () => {
      const result = calculateSizeSavings(0, 0);
      expect(result.bytes).toBe(0);
      expect(result.kilobytes).toBe(0);
      expect(result.percentage).toBe(0);
    });

    test('handles negative savings (after > before)', () => {
      const result = calculateSizeSavings(1000, 2000);
      expect(result.bytes).toBe(0); // Clamped to 0
      expect(result.percentage).toBe(0);
    });

    test('rounds kilobytes correctly', () => {
      const result = calculateSizeSavings(1500, 500);
      expect(result.bytes).toBe(1000);
      expect(result.kilobytes).toBe(1); // 1000 / 1024 ≈ 0.98 → 1
    });

    test('calculates percentage correctly', () => {
      const result = calculateSizeSavings(100000, 75000);
      expect(result.percentage).toBe(25);
    });
  });

  describe('estimateTokenSavings', () => {
    test('estimates tokens from bytes', () => {
      expect(estimateTokenSavings(4000)).toBe(1000);
    });

    test('rounds to nearest integer', () => {
      expect(estimateTokenSavings(4001)).toBe(1000);
      expect(estimateTokenSavings(4003)).toBe(1001);
    });

    test('handles zero bytes', () => {
      expect(estimateTokenSavings(0)).toBe(0);
    });
  });

  describe('calculateOptimizationMetrics', () => {
    test('calculates complete metrics', () => {
      const data = {
        totalFiles: 50,
        exactDuplicates: ['a.md', 'b.md'],
        redundantPairs: [{ file1: 'c.md', file2: 'd.md' }],
        outdatedFiles: ['e.md', 'f.md', 'g.md'],
        archivedFiles: ['a.md', 'e.md', 'f.md', 'g.md'],
        beforeSize: 10240,
        afterSize: 5120,
      };

      const metrics = calculateOptimizationMetrics(data);

      expect(metrics.totalFiles).toBe(50);
      expect(metrics.exactDuplicatesFound).toBe(2);
      expect(metrics.redundantPairsFound).toBe(1);
      expect(metrics.outdatedFilesFound).toBe(3);
      expect(metrics.filesRemoved).toBe(4);
      expect(metrics.sizeSavings.bytes).toBe(5120);
      expect(metrics.tokenSavings).toBe(1280);
    });

    test('handles empty data', () => {
      const metrics = calculateOptimizationMetrics({});
      expect(metrics.totalFiles).toBe(0);
      expect(metrics.exactDuplicatesFound).toBe(0);
      expect(metrics.filesRemoved).toBe(0);
    });

    test('handles partial data', () => {
      const data = {
        totalFiles: 10,
        exactDuplicates: ['a.md'],
      };

      const metrics = calculateOptimizationMetrics(data);
      expect(metrics.totalFiles).toBe(10);
      expect(metrics.exactDuplicatesFound).toBe(1);
      expect(metrics.redundantPairsFound).toBe(0);
    });
  });

  describe('formatTimestamp', () => {
    test('formats timestamp correctly', () => {
      const timestamp = new Date(2024, 1, 8, 14, 30, 45).getTime();
      const formatted = formatTimestamp(timestamp);
      expect(formatted).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
      expect(formatted).toContain('2024-02-08');
    });

    test('pads single digits', () => {
      const timestamp = new Date(2024, 0, 5, 1, 2, 3).getTime();
      const formatted = formatTimestamp(timestamp);
      expect(formatted).toMatch(/2024-01-05 01:02:03/);
    });
  });

  describe('formatFileList', () => {
    test('formats file list', () => {
      const files = ['docs/README.md', 'docs/guide.md'];
      const formatted = formatFileList(files);
      expect(formatted).toContain('- `docs/README.md`');
      expect(formatted).toContain('- `docs/guide.md`');
    });

    test('returns none text for empty array', () => {
      expect(formatFileList([])).toBe('None');
      expect(formatFileList([], 'Empty')).toBe('Empty');
    });

    test('handles null/undefined', () => {
      expect(formatFileList(null)).toBe('None');
      expect(formatFileList(undefined)).toBe('None');
    });
  });

  describe('formatRedundantPairs', () => {
    test('formats pairs correctly', () => {
      const pairs = [
        { file1: 'a.md', file2: 'b.md', similarity: 0.85 },
        { file1: 'c.md', file2: 'd.md', similarity: 0.92 },
      ];
      const formatted = formatRedundantPairs(pairs);
      expect(formatted).toContain('`a.md` ↔ `b.md` (similarity: 85%)');
      expect(formatted).toContain('`c.md` ↔ `d.md` (similarity: 92%)');
    });

    test('rounds similarity to integer percentage', () => {
      const pairs = [{ file1: 'a.md', file2: 'b.md', similarity: 0.876 }];
      const formatted = formatRedundantPairs(pairs);
      expect(formatted).toContain('88%');
    });

    test('returns none text for empty array', () => {
      expect(formatRedundantPairs([])).toBe('None');
      expect(formatRedundantPairs([], 'No pairs')).toBe('No pairs');
    });
  });

  describe('formatSummarySection', () => {
    test('includes all metrics', () => {
      const metrics = {
        totalFiles: 50,
        exactDuplicatesFound: 5,
        redundantPairsFound: 3,
        outdatedFilesFound: 7,
        filesRemoved: 10,
        sizeSavings: { kilobytes: 15, percentage: 25 },
        tokenSavings: 1000,
      };

      const summary = formatSummarySection(metrics, 'Test Project', Date.now());

      expect(summary).toContain('# Documentation Optimization Report');
      expect(summary).toContain('Test Project');
      expect(summary).toContain('Total files analyzed:** 50');
      expect(summary).toContain('Exact duplicates found:** 5');
      expect(summary).toContain('Files removed/archived:** 10');
      expect(summary).toContain('Size reduction:** 15KB (25%)');
      expect(summary).toContain('~1000 tokens');
    });

    test('includes timestamp', () => {
      const timestamp = new Date(2024, 1, 8, 14, 30, 0).getTime();
      const metrics = {
        totalFiles: 0,
        exactDuplicatesFound: 0,
        redundantPairsFound: 0,
        outdatedFilesFound: 0,
        filesRemoved: 0,
        sizeSavings: { kilobytes: 0, percentage: 0 },
        tokenSavings: 0,
      };
      const summary = formatSummarySection(metrics, 'Test', timestamp);
      expect(summary).toMatch(/2024-02-08 14:30:00/);
    });
  });

  describe('formatActionsSection', () => {
    test('includes all action types', () => {
      const data = {
        exactDuplicates: ['a.md', 'b.md'],
        outdatedFiles: ['c.md'],
        redundantPairs: [{ file1: 'd.md', file2: 'e.md', similarity: 0.85 }],
      };

      const actions = formatActionsSection(data);

      expect(actions).toContain('## Actions Taken');
      expect(actions).toContain('### Exact Duplicates Consolidated');
      expect(actions).toContain('`a.md`');
      expect(actions).toContain('### Outdated Files Archived');
      expect(actions).toContain('`c.md`');
      expect(actions).toContain('### Redundant Pairs');
      expect(actions).toContain('`d.md` ↔ `e.md`');
    });

    test('handles empty data', () => {
      const actions = formatActionsSection({});
      expect(actions).toContain('None');
    });
  });

  describe('formatRecommendationsSection', () => {
    test('uses default recommendations when none provided', () => {
      const recs = formatRecommendationsSection();
      expect(recs).toContain('## Recommendations');
      DEFAULT_RECOMMENDATIONS.forEach((rec) => {
        expect(recs).toContain(rec);
      });
    });

    test('uses custom recommendations', () => {
      const custom = ['Custom rec 1', 'Custom rec 2'];
      const recs = formatRecommendationsSection(custom);
      expect(recs).toContain('Custom rec 1');
      expect(recs).toContain('Custom rec 2');
      expect(recs).not.toContain(DEFAULT_RECOMMENDATIONS[0]);
    });

    test('formats as bullet list', () => {
      const recs = formatRecommendationsSection(['Test']);
      expect(recs).toContain('- Test');
    });
  });

  describe('formatArchiveSection', () => {
    test('includes archive path', () => {
      const section = formatArchiveSection('.ai_workflow/archive/docs');
      expect(section).toContain('## Archive Location');
      expect(section).toContain('`.ai_workflow/archive/docs`');
      expect(section).toContain('To restore files');
    });
  });

  describe('generateOptimizationReport', () => {
    test('generates complete report', () => {
      const data = {
        metrics: {
          totalFiles: 50,
          exactDuplicatesFound: 5,
          redundantPairsFound: 3,
          outdatedFilesFound: 7,
          filesRemoved: 10,
          sizeSavings: { kilobytes: 15, percentage: 25 },
          tokenSavings: 1000,
        },
        projectName: 'Test Project',
        timestamp: Date.now(),
        exactDuplicates: ['a.md'],
        outdatedFiles: ['b.md'],
        redundantPairs: [{ file1: 'c.md', file2: 'd.md', similarity: 0.85 }],
        archiveDir: '/archive',
        recommendations: ['Test recommendation'],
      };

      const report = generateOptimizationReport(data);

      expect(report).toContain('# Documentation Optimization Report');
      expect(report).toContain('## Summary');
      expect(report).toContain('## Actions Taken');
      expect(report).toContain('## Recommendations');
      expect(report).toContain('## Archive Location');
    });

    test('includes all data in report', () => {
      const data = {
        metrics: {
          totalFiles: 10,
          filesRemoved: 2,
          sizeSavings: { kilobytes: 5, percentage: 10 },
          tokenSavings: 100,
        },
        projectName: 'Test',
        timestamp: Date.now(),
        exactDuplicates: ['test.md'],
        outdatedFiles: [],
        redundantPairs: [],
        archiveDir: '/test',
        recommendations: [],
      };

      const report = generateOptimizationReport(data);

      expect(report).toContain('Test');
      expect(report).toContain('`test.md`');
      expect(report).toContain('/test');
    });
  });

  describe('formatConsoleSummary', () => {
    test('formats for console output', () => {
      const metrics = {
        totalFiles: 50,
        filesRemoved: 10,
        sizeSavings: { kilobytes: 15, percentage: 25 },
        tokenSavings: 1000,
      };

      const summary = formatConsoleSummary(metrics);

      expect(summary).toContain('📊 Optimization Complete!');
      expect(summary).toContain('Files analyzed: 50');
      expect(summary).toContain('Files optimized: 10');
      expect(summary).toContain('Size saved: 15KB (25%)');
      expect(summary).toContain('Token savings: ~1000');
    });
  });
});

describe('ReportingManager - Integration', () => {
  let mockFileOps;
  let manager;

  beforeEach(() => {
    mockFileOps = {
      writeFile: jest.fn().mockResolvedValue(undefined),
    };

    manager = new ReportingManager({
      fileOps: mockFileOps,
      projectName: 'Test Project',
      logger: { info: jest.fn(), error: jest.fn() },
    });
  });

  describe('calculateMetrics', () => {
    test('calculates metrics from data', () => {
      const data = {
        totalFiles: 50,
        exactDuplicates: ['a.md', 'b.md'],
        redundantPairs: [],
        outdatedFiles: ['c.md'],
        archivedFiles: ['a.md', 'c.md'],
        beforeSize: 10000,
        afterSize: 8000,
      };

      const metrics = manager.calculateMetrics(data);

      expect(metrics.totalFiles).toBe(50);
      expect(metrics.exactDuplicatesFound).toBe(2);
      expect(metrics.filesRemoved).toBe(2);
      expect(metrics.sizeSavings.bytes).toBe(2000);
    });
  });

  describe('generateReport', () => {
    test('generates and saves report', async () => {
      const data = {
        totalFiles: 50,
        exactDuplicates: ['a.md'],
        redundantPairs: [],
        outdatedFiles: ['b.md'],
        archivedFiles: ['a.md', 'b.md'],
        beforeSize: 10000,
        afterSize: 8000,
        archiveDir: '/archive',
      };

      const result = await manager.generateReport(data, '/output/report.md');

      expect(mockFileOps.writeFile).toHaveBeenCalledWith(
        '/output/report.md',
        expect.stringContaining('# Documentation Optimization Report')
      );

      expect(result.reportPath).toBe('/output/report.md');
      expect(result.metrics).toBeDefined();
      expect(result.content).toContain('Test Project');
    });

    test('handles write errors', async () => {
      mockFileOps.writeFile.mockRejectedValue(new Error('Write failed'));

      const data = { totalFiles: 10, archivedFiles: [], beforeSize: 0, afterSize: 0 };

      await expect(manager.generateReport(data, '/output/report.md')).rejects.toThrow(
        'Write failed'
      );
    });

    test('includes custom recommendations', async () => {
      const data = {
        totalFiles: 10,
        archivedFiles: [],
        beforeSize: 0,
        afterSize: 0,
        recommendations: ['Custom rec 1', 'Custom rec 2'],
      };

      const result = await manager.generateReport(data, '/output/report.md');

      expect(result.content).toContain('Custom rec 1');
      expect(result.content).toContain('Custom rec 2');
    });
  });

  describe('displaySummary', () => {
    test('displays console summary', () => {
      const metrics = {
        totalFiles: 50,
        filesRemoved: 10,
        sizeSavings: { kilobytes: 15, percentage: 25 },
        tokenSavings: 1000,
      };

      manager.displaySummary(metrics);

      expect(manager.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('📊 Optimization Complete!')
      );
      expect(manager.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Files analyzed: 50')
      );
    });
  });

  describe('generateAndDisplay', () => {
    test('generates report and displays summary', async () => {
      const data = {
        totalFiles: 50,
        exactDuplicates: ['a.md'],
        archivedFiles: ['a.md'],
        beforeSize: 10000,
        afterSize: 8000,
      };

      const result = await manager.generateAndDisplay(data, '/output/report.md');

      expect(mockFileOps.writeFile).toHaveBeenCalled();
      expect(manager.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('📊 Optimization Complete!')
      );
      expect(manager.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Full report: /output/report.md')
      );
      expect(result.reportPath).toBe('/output/report.md');
    });
  });
});
