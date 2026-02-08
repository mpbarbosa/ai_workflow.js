/**
 * Tests for Step 02_5 Consolidation Module
 */

import { jest } from '@jest/globals';
import {
  selectKeepFile,
  buildConsolidationPlan,
  generateArchivePath,
  generateArchiveDirectories,
  calculateConsolidationStats,
  formatConsolidationAction,
  ConsolidationManager,
} from '../../../src/steps/step_02_5_lib/consolidation.js';

describe('Consolidation Module - Pure Functions', () => {
  describe('selectKeepFile', () => {
    test('empty array returns null keep', () => {
      const result = selectKeepFile([]);
      expect(result.keep).toBeNull();
      expect(result.remove).toEqual([]);
    });

    test('single file returns it as keep', () => {
      const result = selectKeepFile(['docs/README.md']);
      expect(result.keep).toBe('docs/README.md');
      expect(result.remove).toEqual([]);
    });

    test('prefers shorter path depth', () => {
      const files = ['docs/api/guide.md', 'docs/guide.md', 'docs/api/v2/guide.md'];
      const result = selectKeepFile(files);
      expect(result.keep).toBe('docs/guide.md');
      expect(result.remove).toHaveLength(2);
      expect(result.remove).toContain('docs/api/guide.md');
      expect(result.remove).toContain('docs/api/v2/guide.md');
    });

    test('prefers alphabetically first when same depth', () => {
      const files = ['docs/api/zebra.md', 'docs/api/alpha.md', 'docs/api/beta.md'];
      const result = selectKeepFile(files);
      expect(result.keep).toBe('docs/api/alpha.md');
      expect(result.remove).toHaveLength(2);
    });

    test('handles mixed depths and names', () => {
      const files = ['a/b/c/file.md', 'x/file.md', 'a/file.md'];
      const result = selectKeepFile(files);
      expect(result.keep).toBe('a/file.md');
      expect(result.remove).toContain('x/file.md');
      expect(result.remove).toContain('a/b/c/file.md');
    });
  });

  describe('buildConsolidationPlan', () => {
    test('empty groups returns empty plan', () => {
      const plan = buildConsolidationPlan([]);
      expect(plan).toEqual([]);
    });

    test('single group with one file returns empty plan', () => {
      const plan = buildConsolidationPlan([['docs/README.md']]);
      expect(plan).toEqual([]);
    });

    test('single group with duplicates returns action', () => {
      const groups = [['docs/api/guide.md', 'docs/guide.md']];
      const plan = buildConsolidationPlan(groups);
      expect(plan).toHaveLength(1);
      expect(plan[0].keep).toBe('docs/guide.md');
      expect(plan[0].remove).toEqual(['docs/api/guide.md']);
      expect(plan[0].count).toBe(1);
    });

    test('multiple groups returns multiple actions', () => {
      const groups = [
        ['docs/a.md', 'docs/api/a.md'],
        ['docs/b.md', 'docs/v2/b.md', 'docs/api/v2/b.md'],
      ];
      const plan = buildConsolidationPlan(groups);
      expect(plan).toHaveLength(2);
      expect(plan[0].keep).toBe('docs/a.md');
      expect(plan[0].count).toBe(1);
      expect(plan[1].keep).toBe('docs/b.md');
      expect(plan[1].count).toBe(2);
    });

    test('ignores empty groups', () => {
      const groups = [[], ['docs/a.md', 'docs/api/a.md'], []];
      const plan = buildConsolidationPlan(groups);
      expect(plan).toHaveLength(1);
    });
  });

  describe('generateArchivePath', () => {
    test('generates correct path', () => {
      const path = generateArchivePath(
        'docs/README.md',
        '.ai_workflow/archive/docs',
        'original',
        '20260208_143000'
      );
      expect(path).toBe('.ai_workflow/archive/docs/20260208_143000/original/README.md');
    });

    test('preserves filename only', () => {
      const path = generateArchivePath(
        'docs/api/guide/index.md',
        '/archive',
        'outdated',
        '20260101_000000'
      );
      expect(path).toBe('/archive/20260101_000000/outdated/index.md');
    });

    test('handles different categories', () => {
      const original = generateArchivePath('file.md', '/ar', 'original', '20260101_000000');
      const consolidated = generateArchivePath('file.md', '/ar', 'consolidated', '20260101_000000');
      const outdated = generateArchivePath('file.md', '/ar', 'outdated', '20260101_000000');

      expect(original).toContain('/original/');
      expect(consolidated).toContain('/consolidated/');
      expect(outdated).toContain('/outdated/');
    });
  });

  describe('generateArchiveDirectories', () => {
    test('generates all required directories', () => {
      const dirs = generateArchiveDirectories('.ai_workflow/archive', '20260208_143000');
      expect(dirs.root).toBe('.ai_workflow/archive/20260208_143000');
      expect(dirs.original).toBe('.ai_workflow/archive/20260208_143000/original');
      expect(dirs.consolidated).toBe('.ai_workflow/archive/20260208_143000/consolidated');
      expect(dirs.outdated).toBe('.ai_workflow/archive/20260208_143000/outdated');
    });

    test('handles different root paths', () => {
      const dirs = generateArchiveDirectories('/tmp/archive', '20260101_000000');
      expect(dirs.root).toBe('/tmp/archive/20260101_000000');
      expect(dirs.original).toBe('/tmp/archive/20260101_000000/original');
    });
  });

  describe('calculateConsolidationStats', () => {
    test('empty actions returns zeros', () => {
      const stats = calculateConsolidationStats([]);
      expect(stats.totalGroups).toBe(0);
      expect(stats.filesRemoved).toBe(0);
      expect(stats.filesKept).toBe(0);
    });

    test('single action calculates correctly', () => {
      const actions = [
        {
          keep: 'docs/a.md',
          remove: ['docs/api/a.md', 'docs/v2/a.md'],
          count: 2,
        },
      ];
      const stats = calculateConsolidationStats(actions);
      expect(stats.totalGroups).toBe(1);
      expect(stats.filesRemoved).toBe(2);
      expect(stats.filesKept).toBe(1);
    });

    test('multiple actions sum correctly', () => {
      const actions = [
        { keep: 'a.md', remove: ['a1.md'], count: 1 },
        { keep: 'b.md', remove: ['b1.md', 'b2.md', 'b3.md'], count: 3 },
        { keep: 'c.md', remove: ['c1.md', 'c2.md'], count: 2 },
      ];
      const stats = calculateConsolidationStats(actions);
      expect(stats.totalGroups).toBe(3);
      expect(stats.filesRemoved).toBe(6);
      expect(stats.filesKept).toBe(3);
    });
  });

  describe('formatConsolidationAction', () => {
    test('formats action correctly', () => {
      const action = {
        keep: 'docs/guide.md',
        remove: ['docs/api/guide.md', 'docs/v2/guide.md'],
        count: 2,
      };
      const formatted = formatConsolidationAction(action);
      expect(formatted).toContain('Keep: docs/guide.md');
      expect(formatted).toContain('Remove (2):');
      expect(formatted).toContain('- docs/api/guide.md');
      expect(formatted).toContain('- docs/v2/guide.md');
    });

    test('handles single file removal', () => {
      const action = {
        keep: 'a.md',
        remove: ['b.md'],
        count: 1,
      };
      const formatted = formatConsolidationAction(action);
      expect(formatted).toContain('Remove (1):');
      expect(formatted).toContain('- b.md');
    });
  });
});

describe('ConsolidationManager - Integration', () => {
  let mockFileOps;
  let manager;

  beforeEach(() => {
    mockFileOps = {
      createDirectory: jest.fn().mockResolvedValue(undefined),
      copyFile: jest.fn().mockResolvedValue(undefined),
      removeFile: jest.fn().mockResolvedValue(undefined),
    };

    manager = new ConsolidationManager({
      fileOps: mockFileOps,
      archiveRoot: '.ai_workflow/archive/docs',
      logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
    });
  });

  describe('generateTimestamp', () => {
    test('generates timestamp in correct format', () => {
      const timestamp = manager.generateTimestamp(1707397800000);
      expect(timestamp).toMatch(/^\d{8}_\d{6}$/);
      // Timestamp uses local time, so just check format
      expect(timestamp).toHaveLength(15); // YYYYMMDD_HHMMSS
      expect(timestamp.charAt(8)).toBe('_');
    });

    test('uses current time when not provided', () => {
      const timestamp = manager.generateTimestamp();
      expect(timestamp).toMatch(/^\d{8}_\d{6}$/);
    });

    test('pads single digit values', () => {
      // Use a date that tests padding: 2024-01-05 01:02:03 UTC (consistent across timezones)
      const date = new Date(Date.UTC(2024, 0, 5, 1, 2, 3));
      const timestamp = manager.generateTimestamp(date.getTime());
      expect(timestamp).toMatch(/^\d{8}_\d{6}$/);
      // Should have properly padded digits
      expect(timestamp.charAt(8)).toBe('_');
    });
  });

  describe('createArchiveDirectories', () => {
    test('creates all required directories', async () => {
      const dirs = await manager.createArchiveDirectories('20260208_143000');

      expect(mockFileOps.createDirectory).toHaveBeenCalledTimes(3);
      expect(mockFileOps.createDirectory).toHaveBeenCalledWith(
        expect.stringContaining('/original'),
        { recursive: true }
      );
      expect(mockFileOps.createDirectory).toHaveBeenCalledWith(
        expect.stringContaining('/consolidated'),
        { recursive: true }
      );
      expect(mockFileOps.createDirectory).toHaveBeenCalledWith(
        expect.stringContaining('/outdated'),
        { recursive: true }
      );

      expect(dirs.root).toBe('.ai_workflow/archive/docs/20260208_143000');
    });

    test('dry run skips directory creation', async () => {
      manager.dryRun = true;
      const dirs = await manager.createArchiveDirectories('20260208_143000');

      expect(mockFileOps.createDirectory).not.toHaveBeenCalled();
      expect(dirs.root).toBe('.ai_workflow/archive/docs/20260208_143000');
    });

    test('handles directory creation errors', async () => {
      mockFileOps.createDirectory.mockRejectedValue(new Error('Permission denied'));

      await expect(manager.createArchiveDirectories('20260208_143000')).rejects.toThrow(
        'Permission denied'
      );
    });
  });

  describe('archiveFile', () => {
    test('archives file successfully', async () => {
      const archivePath = await manager.archiveFile(
        'docs/README.md',
        '.ai_workflow/archive/20260208_143000',
        'original'
      );

      expect(mockFileOps.copyFile).toHaveBeenCalledWith(
        'docs/README.md',
        '.ai_workflow/archive/20260208_143000/original/README.md'
      );
      expect(archivePath).toBe('.ai_workflow/archive/20260208_143000/original/README.md');
    });

    test('dry run skips archiving', async () => {
      manager.dryRun = true;
      const archivePath = await manager.archiveFile('docs/README.md', '/archive', 'outdated');

      expect(mockFileOps.copyFile).not.toHaveBeenCalled();
      expect(archivePath).toContain('README.md');
    });

    test('handles archive errors', async () => {
      mockFileOps.copyFile.mockRejectedValue(new Error('File not found'));

      await expect(manager.archiveFile('missing.md', '/archive', 'original')).rejects.toThrow(
        'File not found'
      );
    });
  });

  describe('consolidateDuplicates', () => {
    test('consolidates duplicate groups', async () => {
      const groups = [
        ['docs/guide.md', 'docs/api/guide.md'],
        ['docs/README.md', 'docs/v2/README.md', 'docs/api/v2/README.md'],
      ];

      const result = await manager.consolidateDuplicates(groups, '20260208_143000');

      expect(result.archived).toHaveLength(3); // 1 + 2 files archived
      expect(result.removed).toHaveLength(3); // Same files removed
      expect(result.kept).toHaveLength(2); // 2 groups = 2 kept
      expect(result.stats.totalGroups).toBe(2);
      expect(result.stats.filesRemoved).toBe(3);
    });

    test('dry run simulates consolidation', async () => {
      manager.dryRun = true;
      const groups = [['docs/a.md', 'docs/api/a.md']];

      const result = await manager.consolidateDuplicates(groups, '20260208_143000');

      expect(mockFileOps.removeFile).not.toHaveBeenCalled();
      expect(result.archived).toHaveLength(1);
      expect(result.removed).toHaveLength(0); // Not removed in dry run
    });

    test('continues on individual file errors', async () => {
      mockFileOps.copyFile.mockRejectedValueOnce(new Error('Copy failed'));

      const groups = [['docs/a.md', 'docs/b.md', 'docs/c.md']];
      const result = await manager.consolidateDuplicates(groups, '20260208_143000');

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].error).toBe('Copy failed');
    });

    test('empty groups returns empty result', async () => {
      const result = await manager.consolidateDuplicates([], '20260208_143000');

      expect(result.archived).toEqual([]);
      expect(result.removed).toEqual([]);
      expect(result.kept).toEqual([]);
      expect(result.stats.totalGroups).toBe(0);
    });
  });

  describe('archiveOutdatedFiles', () => {
    test('archives outdated files', async () => {
      const outdated = ['docs/old_guide.md', 'docs/deprecated.md'];

      const result = await manager.archiveOutdatedFiles(outdated, '20260208_143000');

      expect(mockFileOps.copyFile).toHaveBeenCalledTimes(2);
      expect(result.archived).toHaveLength(2);
      expect(result.archived).toContain('docs/old_guide.md');
      expect(result.archived).toContain('docs/deprecated.md');
    });

    test('dry run simulates archiving', async () => {
      manager.dryRun = true;
      await manager.archiveOutdatedFiles(['docs/old.md'], '20260208_143000');

      expect(mockFileOps.copyFile).not.toHaveBeenCalled();
    });

    test('handles archive errors gracefully', async () => {
      mockFileOps.copyFile.mockRejectedValueOnce(new Error('Archive failed'));

      const result = await manager.archiveOutdatedFiles(
        ['docs/a.md', 'docs/b.md'],
        '20260208_143000'
      );

      expect(result.errors).toHaveLength(1);
      expect(result.archived).toHaveLength(1); // Second file succeeded
    });

    test('empty array returns empty result', async () => {
      const result = await manager.archiveOutdatedFiles([], '20260208_143000');

      expect(result.archived).toEqual([]);
      expect(result.errors).toEqual([]);
    });
  });

  describe('formatSummary', () => {
    test('formats consolidation summary', () => {
      const result = {
        stats: { totalGroups: 3, filesRemoved: 5, filesKept: 3 },
        archived: ['a.md', 'b.md', 'c.md', 'd.md', 'e.md'],
        errors: [],
      };

      const summary = manager.formatSummary(result);

      expect(summary).toContain('Groups Consolidated: 3');
      expect(summary).toContain('Files Removed: 5');
      expect(summary).toContain('Files Kept: 3');
      expect(summary).toContain('Files Archived: 5');
    });

    test('includes errors in summary', () => {
      const result = {
        stats: { totalGroups: 1, filesRemoved: 1, filesKept: 1 },
        archived: [],
        errors: [
          { file: 'a.md', error: 'Error 1' },
          { file: 'b.md', error: 'Error 2' },
        ],
      };

      const summary = manager.formatSummary(result);

      expect(summary).toContain('Errors: 2');
      expect(summary).toContain('a.md: Error 1');
      expect(summary).toContain('b.md: Error 2');
    });

    test('limits error display to 5', () => {
      const errors = Array.from({ length: 10 }, (_, i) => ({
        file: `file${i}.md`,
        error: `Error ${i}`,
      }));
      const result = { stats: {}, archived: [], errors };

      const summary = manager.formatSummary(result);

      expect(summary).toContain('Errors: 10');
      expect((summary.match(/file\d+\.md/g) || []).length).toBe(5);
    });
  });

  describe('previewConsolidation', () => {
    test('generates preview with statistics', () => {
      const groups = [
        ['docs/a.md', 'docs/api/a.md'],
        ['docs/b.md', 'docs/v2/b.md'],
      ];

      const preview = manager.previewConsolidation(groups);

      expect(preview).toContain('Total Groups: 2');
      expect(preview).toContain('Files to Remove: 2');
      expect(preview).toContain('Files to Keep: 2');
    });

    test('shows first 5 actions', () => {
      const groups = Array.from({ length: 10 }, (_, i) => [
        `docs/file${i}.md`,
        `docs/api/file${i}.md`,
      ]);

      const preview = manager.previewConsolidation(groups);

      expect(preview).toContain('First 5 actions:');
      expect(preview).toContain('... and 5 more groups');
    });

    test('no ellipsis when 5 or fewer groups', () => {
      const groups = [
        ['docs/a.md', 'docs/api/a.md'],
        ['docs/b.md', 'docs/v2/b.md'],
      ];

      const preview = manager.previewConsolidation(groups);

      expect(preview).not.toContain('... and');
    });
  });
});
