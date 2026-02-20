/**
 * Tests for Step 16: Version Update
 * @group steps
 */

import { jest } from '@jest/globals';
import {
  Step16VersionUpdate,
  BUMP_TYPES,
  extractVersion,
  parseVersion,
  incrementVersion,
  detectVersionPatterns,
  replaceVersion,
  determineHeuristicBumpType,
  parseAiBumpRecommendation,
  buildVersionBumpPrompt,
  calculateUpdateStats,
  formatVersionUpdateReport,
} from '../../src/steps/step_16_version_update.js';

describe('Step 16: Version Update', () => {
  // ========================================================================
  // PURE FUNCTIONS - Version Parsing
  // ========================================================================

  describe('extractVersion', () => {
    test('extracts version from string', () => {
      expect(extractVersion('version: 1.2.3')).toBe('1.2.3');
      expect(extractVersion('v2.0.5')).toBe('2.0.5');
      expect(extractVersion('"version": "10.15.99"')).toBe('10.15.99');
    });

    test('returns null for no version', () => {
      expect(extractVersion('no version here')).toBeNull();
      expect(extractVersion('')).toBeNull();
    });
  });

  describe('parseVersion', () => {
    test('parses valid semantic version', () => {
      expect(parseVersion('1.2.3')).toEqual({ major: 1, minor: 2, patch: 3 });
      expect(parseVersion('0.0.1')).toEqual({ major: 0, minor: 0, patch: 1 });
      expect(parseVersion('10.20.30')).toEqual({ major: 10, minor: 20, patch: 30 });
    });

    test('returns null for invalid version', () => {
      expect(parseVersion('1.2')).toBeNull();
      expect(parseVersion('v1.2.3')).toBeNull();
      expect(parseVersion('invalid')).toBeNull();
    });
  });

  describe('incrementVersion', () => {
    test('increments major version', () => {
      expect(incrementVersion('1.2.3', BUMP_TYPES.major)).toBe('2.0.0');
      expect(incrementVersion('5.10.15', BUMP_TYPES.major)).toBe('6.0.0');
    });

    test('increments minor version', () => {
      expect(incrementVersion('1.2.3', BUMP_TYPES.minor)).toBe('1.3.0');
      expect(incrementVersion('5.10.15', BUMP_TYPES.minor)).toBe('5.11.0');
    });

    test('increments patch version', () => {
      expect(incrementVersion('1.2.3', BUMP_TYPES.patch)).toBe('1.2.4');
      expect(incrementVersion('5.10.15', BUMP_TYPES.patch)).toBe('5.10.16');
    });

    test('returns original for invalid bump type', () => {
      expect(incrementVersion('1.2.3', 'invalid')).toBe('1.2.3');
    });
  });

  describe('detectVersionPatterns', () => {
    test('detects version patterns in content', () => {
      const content = `const VERSION = "1.2.3";
// @version 2.0.0
export const version = '3.5.7';`;

      const patterns = detectVersionPatterns(content);
      expect(patterns).toHaveLength(3);
      expect(patterns[0].version).toBe('1.2.3');
      expect(patterns[0].line).toBe(1);
      expect(patterns[1].version).toBe('2.0.0');
      expect(patterns[2].version).toBe('3.5.7');
    });

    test('returns empty array for no patterns', () => {
      const content = 'No versions here';
      expect(detectVersionPatterns(content)).toEqual([]);
    });
  });

  describe('replaceVersion', () => {
    test('replaces all occurrences of version', () => {
      const content = 'version: 1.0.0\nVersion 1.0.0 released\nv1.0.0';
      const result = replaceVersion(content, '1.0.0', '2.0.0');
      expect(result).toBe('version: 2.0.0\nVersion 2.0.0 released\nv2.0.0');
    });

    test('handles dots in version correctly', () => {
      const content = 'version: 1.2.3';
      const result = replaceVersion(content, '1.2.3', '1.2.4');
      expect(result).toBe('version: 1.2.4');
    });
  });

  // ========================================================================
  // PURE FUNCTIONS - Bump Type Determination
  // ========================================================================

  describe('determineHeuristicBumpType', () => {
    test('returns major for large deletions', () => {
      const stats = {
        modifiedCount: 5,
        addedCount: 0,
        deletedCount: 0,
        insertions: 100,
        deletions: 600,
      };
      expect(determineHeuristicBumpType(stats)).toBe(BUMP_TYPES.major);
    });

    test('returns major for many modified files', () => {
      const stats = {
        modifiedCount: 25,
        addedCount: 0,
        deletedCount: 0,
        insertions: 100,
        deletions: 50,
      };
      expect(determineHeuristicBumpType(stats)).toBe(BUMP_TYPES.major);
    });

    test('returns minor for new files', () => {
      const stats = {
        modifiedCount: 5,
        addedCount: 3,
        deletedCount: 0,
        insertions: 50,
        deletions: 10,
      };
      expect(determineHeuristicBumpType(stats)).toBe(BUMP_TYPES.minor);
    });

    test('returns minor for significant insertions', () => {
      const stats = {
        modifiedCount: 5,
        addedCount: 0,
        deletedCount: 0,
        insertions: 150,
        deletions: 10,
      };
      expect(determineHeuristicBumpType(stats)).toBe(BUMP_TYPES.minor);
    });

    test('returns patch for small changes', () => {
      const stats = {
        modifiedCount: 3,
        addedCount: 0,
        deletedCount: 0,
        insertions: 50,
        deletions: 10,
      };
      expect(determineHeuristicBumpType(stats)).toBe(BUMP_TYPES.patch);
    });
  });

  describe('parseAiBumpRecommendation', () => {
    test('parses standard format', () => {
      const response = `Bump Type: minor
Reasoning: Added new feature X which enhances functionality.
Confidence: high`;

      const result = parseAiBumpRecommendation(response);
      expect(result).toEqual({
        bumpType: 'minor',
        reasoning: 'Added new feature X which enhances functionality.',
        confidence: 'high',
      });
    });

    test('parses alternative format', () => {
      const response = 'I recommend a major version bump due to breaking changes.';
      const result = parseAiBumpRecommendation(response);
      expect(result).not.toBeNull();
      expect(result.bumpType).toBe('major');
    });

    test('returns null for no bump type', () => {
      const response = 'No clear recommendation provided';
      expect(parseAiBumpRecommendation(response)).toBeNull();
    });
  });

  describe('buildVersionBumpPrompt', () => {
    test('builds complete prompt', () => {
      const context = {
        modifiedFiles: ['src/app.js', 'README.md'],
        gitStats: { summary: '2 files changed, 50 insertions(+), 10 deletions(-)' },
        preAnalysis: 'Some pre-analysis data',
      };

      const prompt = buildVersionBumpPrompt(context);
      expect(prompt).toContain('Version Manager');
      expect(prompt).toContain('src/app.js');
      expect(prompt).toContain('README.md');
      expect(prompt).toContain('2 files changed');
      expect(prompt).toContain('Pre-Analysis Results');
      expect(prompt).toContain('MAJOR (X.0.0)');
      expect(prompt).toContain('Bump Type:');
    });

    test('handles many files', () => {
      const context = {
        modifiedFiles: Array.from({ length: 30 }, (_, i) => `file${i}.js`),
        gitStats: { summary: '30 files changed' },
      };

      const prompt = buildVersionBumpPrompt(context);
      expect(prompt).toContain('file0.js');
      expect(prompt).toContain('... and 10 more files');
    });
  });

  describe('calculateUpdateStats', () => {
    test('calculates statistics from updates', () => {
      const updates = [
        { success: true },
        { success: true },
        { success: false, skipped: true },
        { success: false, skipped: false },
      ];

      const stats = calculateUpdateStats(updates);
      expect(stats).toEqual({ updated: 2, skipped: 1, failed: 1 });
    });

    test('handles empty updates', () => {
      expect(calculateUpdateStats([])).toEqual({ updated: 0, skipped: 0, failed: 0 });
    });
  });

  describe('formatVersionUpdateReport', () => {
    test('formats complete report', () => {
      const data = {
        oldVersion: '1.2.3',
        newVersion: '1.3.0',
        bumpType: 'minor',
        stats: { updated: 2, skipped: 1, failed: 0 },
        updates: [
          { file: 'package.json', success: true },
          { file: 'README.md', success: true },
          { file: 'test.js', success: false, skipped: true },
        ],
        timestamp: '2026-02-08 13:20:00',
      };

      const report = formatVersionUpdateReport(data);
      expect(report).toContain('Step 16: Semantic Version Update Report');
      expect(report).toContain('Previous Version**: 1.2.3');
      expect(report).toContain('New Version**: 1.3.0');
      expect(report).toContain('Bump Type**: minor');
      expect(report).toContain('Files Updated**: 2');
      expect(report).toContain('package.json');
      expect(report).toContain('README.md');
    });
  });

  // ========================================================================
  // STEP16VERSIONUPDATE - Integration Tests
  // ========================================================================

  describe('Step16VersionUpdate', () => {
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
        step: jest.fn(),
      };
    });

    test('constructs with default options', () => {
      const step = new Step16VersionUpdate();
      expect(step).toBeInstanceOf(Step16VersionUpdate);
      expect(step.dryRun).toBe(false);
    });

    test('constructs with custom options', () => {
      const step = new Step16VersionUpdate({
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
      const step = new Step16VersionUpdate({
        backlog: mockBacklog,
        logger: mockLogger,
        dryRun: true,
      });

      const result = await step.execute();

      expect(result.success).toBe(true);
      expect(result.dryRun).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith('[DRY RUN] Version update preview:');
    });

    test('skips when no modified files', async () => {
      const step = new Step16VersionUpdate({
        backlog: mockBacklog,
        logger: mockLogger,
      });

      const result = await step.execute({ modifiedFiles: [] });

      expect(result.success).toBe(true);
      expect(result.skipped).toBe(true);
      expect(result.reason).toBe('no modified files');
      expect(mockBacklog.saveStepSummary).toHaveBeenCalledWith(
        '16',
        'Version_Update',
        'Skipped: No modified files',
        '⏭️'
      );
    });

    test('skips when no version found', async () => {
      const step = new Step16VersionUpdate({
        backlog: mockBacklog,
        logger: mockLogger,
      });

      step.detectCurrentVersion = jest.fn().mockResolvedValue(null);

      const result = await step.execute({
        modifiedFiles: ['src/app.js'],
        gitStats: {},
      });

      expect(result.success).toBe(true);
      expect(result.skipped).toBe(true);
      expect(result.reason).toBe('no version found');
    });

    test('executes successful version update', async () => {
      const step = new Step16VersionUpdate({
        backlog: mockBacklog,
        logger: mockLogger,
      });

      step.detectCurrentVersion = jest.fn().mockResolvedValue('1.2.3');
      step.updateVersionsInFiles = jest.fn().mockResolvedValue([
        { file: 'package.json', success: true },
        { file: 'README.md', success: true },
      ]);

      const result = await step.execute({
        modifiedFiles: ['src/app.js', 'README.md'],
        gitStats: {
          modifiedCount: 2,
          addedCount: 0,
          deletedCount: 0,
          insertions: 50,
          deletions: 10,
        },
      });

      expect(result.success).toBe(true);
      expect(result.oldVersion).toBe('1.2.3');
      expect(result.newVersion).toBe('1.2.4'); // patch bump
      expect(result.bumpType).toBe('patch');
      expect(result.stats.updated).toBe(2);
      expect(mockBacklog.saveStepSummary).toHaveBeenCalled();
      expect(mockLogger.success).toHaveBeenCalledWith(
        expect.stringContaining('Step 16: Version update completed')
      );
    });

    test('handles errors gracefully', async () => {
      const step = new Step16VersionUpdate({
        backlog: mockBacklog,
        logger: mockLogger,
      });

      step.detectCurrentVersion = jest.fn().mockRejectedValue(new Error('Read error'));

      const result = await step.execute({
        modifiedFiles: ['src/app.js'],
        gitStats: {},
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Read error');
      expect(mockBacklog.saveStepIssues).toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });
});
