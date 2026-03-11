/**
 * Tests for Step 16: Version Update
 * @group steps
 */

import { jest } from '@jest/globals';
import {
  Step16VersionUpdate,
  BUMP_TYPES,
  CHECK_VERSION_SCRIPT,
  extractVersion,
  parseVersion,
  incrementVersion,
  detectVersionPatterns,
  replaceVersion,
  isVersionConfigFile,
  replaceVersionConfig,
  isServiceWorkerFile,
  updateServiceWorkerCacheName,
  determineHeuristicBumpType,
  parseAiBumpRecommendation,
  buildVersionBumpPrompt,
  calculateUpdateStats,
  formatVersionUpdateReport,
  parseConsistencyCheckOutput,
  buildDefaultVersionConstant,
  deriveVersionConstantName,
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

    // A — prerelease support
    test('extracts prerelease version', () => {
      expect(extractVersion('version: 0.9.0-alpha')).toBe('0.9.0-alpha');
      expect(extractVersion('"version": "1.0.0-beta.1"')).toBe('1.0.0-beta.1');
      expect(extractVersion('0.11.0-rc.2')).toBe('0.11.0-rc.2');
    });
  });

  describe('parseVersion', () => {
    test('parses valid semantic version', () => {
      expect(parseVersion('1.2.3')).toEqual({ major: 1, minor: 2, patch: 3, prerelease: null });
      expect(parseVersion('0.0.1')).toEqual({ major: 0, minor: 0, patch: 1, prerelease: null });
      expect(parseVersion('10.20.30')).toEqual({
        major: 10,
        minor: 20,
        patch: 30,
        prerelease: null,
      });
    });

    test('returns null for invalid version', () => {
      expect(parseVersion('1.2')).toBeNull();
      expect(parseVersion('v1.2.3')).toBeNull();
      expect(parseVersion('invalid')).toBeNull();
    });

    // A — prerelease support
    test('parses prerelease version', () => {
      expect(parseVersion('0.9.0-alpha')).toEqual({
        major: 0,
        minor: 9,
        patch: 0,
        prerelease: 'alpha',
      });
      expect(parseVersion('1.0.0-beta.1')).toEqual({
        major: 1,
        minor: 0,
        patch: 0,
        prerelease: 'beta.1',
      });
      expect(parseVersion('2.3.4-rc.2')).toEqual({
        major: 2,
        minor: 3,
        patch: 4,
        prerelease: 'rc.2',
      });
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

    // A — prerelease support
    test('preserves prerelease suffix on patch bump', () => {
      expect(incrementVersion('0.9.0-alpha', BUMP_TYPES.patch)).toBe('0.9.1-alpha');
      expect(incrementVersion('1.0.0-beta.1', BUMP_TYPES.patch)).toBe('1.0.1-beta.1');
    });

    test('preserves prerelease suffix on minor bump', () => {
      expect(incrementVersion('0.9.0-alpha', BUMP_TYPES.minor)).toBe('0.10.0-alpha');
      expect(incrementVersion('1.2.3-rc.2', BUMP_TYPES.minor)).toBe('1.3.0-rc.2');
    });

    test('preserves prerelease suffix on major bump', () => {
      expect(incrementVersion('0.11.0-alpha', BUMP_TYPES.major)).toBe('1.0.0-alpha');
      expect(incrementVersion('1.0.0-rc.1', BUMP_TYPES.major)).toBe('2.0.0-rc.1');
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
  // PURE FUNCTIONS - JS Version Config File Support
  // ========================================================================

  describe('isVersionConfigFile', () => {
    const validConfig = `export const VERSION = '1.0.0';\nexport const BUILD_DATE = '2026-01-01';`;

    test('returns true for files with VERSION and BUILD_DATE exports', () => {
      expect(isVersionConfigFile(validConfig)).toBe(true);
    });

    test('returns false when BUILD_DATE is missing', () => {
      expect(isVersionConfigFile(`export const VERSION = '1.0.0';`)).toBe(false);
    });

    test('returns false when VERSION is missing', () => {
      expect(isVersionConfigFile(`export const BUILD_DATE = '2026-01-01';`)).toBe(false);
    });

    test('returns false for empty content', () => {
      expect(isVersionConfigFile('')).toBe(false);
    });
  });

  describe('replaceVersionConfig', () => {
    const content = [
      `export const VERSION = '0.9.0-alpha';`,
      `export const BUILD_DATE = '2026-02-11';`,
    ].join('\n');

    test('updates VERSION constant', () => {
      const result = replaceVersionConfig(content, '0.11.1-alpha', '2026-02-23');
      expect(result).toContain(`export const VERSION = '0.11.1-alpha';`);
    });

    test('updates BUILD_DATE constant', () => {
      const result = replaceVersionConfig(content, '0.11.1-alpha', '2026-02-23');
      expect(result).toContain(`export const BUILD_DATE = '2026-02-23';`);
    });

    test('works with double-quoted strings', () => {
      const dqContent = `export const VERSION = "0.9.0-alpha";\nexport const BUILD_DATE = "2026-02-11";`;
      const result = replaceVersionConfig(dqContent, '0.11.1-alpha', '2026-02-23');
      expect(result).toContain(`export const VERSION = "0.11.1-alpha";`);
      expect(result).toContain(`export const BUILD_DATE = "2026-02-23";`);
    });

    test('does not modify unrelated content', () => {
      const full = `${content}\nexport const VERSION_STRING = \`Guia v\${VERSION}\`;`;
      const result = replaceVersionConfig(full, '0.11.1-alpha', '2026-02-23');
      expect(result).toContain('VERSION_STRING');
    });
  });

  // ========================================================================
  // PURE FUNCTIONS - Service Worker Cache Name Support
  // ========================================================================

  describe('isServiceWorkerFile', () => {
    test('detects file with CACHE_NAME constant', () => {
      const sw = `const CACHE_NAME = 'my-app-v1.0.0-20260101';\nself.addEventListener('install', () => {});`;
      expect(isServiceWorkerFile(sw)).toBe(true);
    });

    test('detects single-quoted CACHE_NAME', () => {
      expect(
        isServiceWorkerFile(`const CACHE_NAME = 'guia-turistico-v0.9.0-alpha-20260223c';`)
      ).toBe(true);
    });

    test('detects double-quoted CACHE_NAME', () => {
      expect(isServiceWorkerFile(`const CACHE_NAME = "app-v1.0.0";`)).toBe(true);
    });

    test('returns false for regular JS files without CACHE_NAME', () => {
      expect(isServiceWorkerFile(`export const VERSION = '1.0.0';`)).toBe(false);
      expect(isServiceWorkerFile(`const name = 'my-app';`)).toBe(false);
      expect(isServiceWorkerFile('')).toBe(false);
    });
  });

  describe('updateServiceWorkerCacheName', () => {
    const swContent = `/**\n * @version 0.9.0-alpha\n */\nconst CACHE_NAME = 'guia-turistico-v0.9.0-alpha-20260223c';\n`;

    test('updates version and date in CACHE_NAME', () => {
      const result = updateServiceWorkerCacheName(
        swContent,
        '0.9.0-alpha',
        '0.11.3-alpha',
        '20260223'
      );
      expect(result).toContain(`CACHE_NAME = 'guia-turistico-v0.11.3-alpha-20260223'`);
    });

    test('does not change other version references (e.g. @version jsdoc)', () => {
      const result = updateServiceWorkerCacheName(
        swContent,
        '0.9.0-alpha',
        '0.11.3-alpha',
        '20260223'
      );
      expect(result).toContain('@version 0.9.0-alpha');
    });

    test('handles cache name with commit hash suffix', () => {
      const content = `const CACHE_NAME = 'app-v0.9.0-alpha-20260101-1981f9e';`;
      const result = updateServiceWorkerCacheName(
        content,
        '0.9.0-alpha',
        '0.11.3-alpha',
        '20260223'
      );
      expect(result).toContain(`CACHE_NAME = 'app-v0.11.3-alpha-20260223'`);
    });

    test('returns unchanged content when old version not in CACHE_NAME', () => {
      const content = `const CACHE_NAME = 'app-v2.0.0-20260101';`;
      const result = updateServiceWorkerCacheName(
        content,
        '0.9.0-alpha',
        '0.11.3-alpha',
        '20260223'
      );
      expect(result).toBe(content);
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
        newVersion: '1.7.0',
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
      expect(report).toContain('New Version**: 1.7.0');
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
      const step = new Step16VersionUpdate({
        aiHelper: { initialize: () => Promise.resolve(false) },
      });
      expect(step).toBeInstanceOf(Step16VersionUpdate);
      expect(step.dryRun).toBe(false);
    });

    test('constructs with custom options', () => {
      const step = new Step16VersionUpdate({
        aiHelper: { initialize: () => Promise.resolve(false) },
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
        aiHelper: { initialize: () => Promise.resolve(false) },
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
        aiHelper: { initialize: () => Promise.resolve(false) },
        backlog: mockBacklog,
        logger: mockLogger,
      });

      const result = await step.execute({ modifiedFiles: [] });

      expect(result.success).toBe(true);
      expect(result.skipped).toBe(true);
      expect(result.reason).toBe('no modified files');
      expect(mockLogger.warn).toHaveBeenCalledWith('Step 16: No modified files to process');
      expect(mockBacklog.saveStepSummary).toHaveBeenCalledWith(
        '16',
        'Version_Update',
        'Skipped: No modified files',
        '⏭️'
      );
    });

    test('skips when no version found', async () => {
      const step = new Step16VersionUpdate({
        aiHelper: { initialize: () => Promise.resolve(false) },
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
        aiHelper: { initialize: () => Promise.resolve(false) },
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
      expect(mockLogger.info).toHaveBeenCalledWith(
        '[VERSION BUMP] previous: 1.2.3 → next: 1.2.4 (patch)'
      );
      expect(mockBacklog.saveStepSummary).toHaveBeenCalled();
      expect(mockLogger.success).toHaveBeenCalledWith(
        expect.stringContaining('Step 16: Version update completed')
      );
    });

    test('handles errors gracefully', async () => {
      const step = new Step16VersionUpdate({
        aiHelper: { initialize: () => Promise.resolve(false) },
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

    // B — ENOENT → skipped not failed
    describe('updateVersionsInFiles', () => {
      test('skips non-existent files (ENOENT) instead of failing', async () => {
        const enoentError = Object.assign(new Error('no such file or directory'), {
          code: 'ENOENT',
        });
        const step = new Step16VersionUpdate({
          aiHelper: { initialize: () => Promise.resolve(false) },
          fileOps: {
            readFile: jest.fn().mockRejectedValue(enoentError),
            writeFile: jest.fn(),
          },
          backlog: mockBacklog,
          logger: mockLogger,
          projectRoot: '/fake/root',
        });

        const results = await step.updateVersionsInFiles(['missing.js'], '1.0.0', '1.0.1');
        const skipped = results.filter((r) => r.skipped);
        const failed = results.filter((r) => r.success === false);
        expect(skipped.length).toBeGreaterThan(0);
        expect(failed.length).toBe(0);
      });

      test('still records failure for non-ENOENT errors', async () => {
        const ioError = new Error('permission denied');
        const step = new Step16VersionUpdate({
          aiHelper: { initialize: () => Promise.resolve(false) },
          fileOps: {
            readFile: jest.fn().mockRejectedValue(ioError),
            writeFile: jest.fn(),
          },
          backlog: mockBacklog,
          logger: mockLogger,
          projectRoot: '/fake/root',
        });

        const results = await step.updateVersionsInFiles([], '1.0.0', '1.0.1');
        // METADATA_FILES are all attempted; all should fail (not skipped)
        const failed = results.filter((r) => r.success === false);
        expect(failed.length).toBeGreaterThan(0);
      });

      test('includes project-declared extra files in update candidates', async () => {
        const readMock = jest.fn().mockImplementation((path) => {
          if (path.endsWith('package.json')) return Promise.resolve('{"version":"1.0.0"}');
          if (path.includes('extra-file.js')) return Promise.resolve('version: 1.0.0');
          return Promise.reject(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));
        });
        const writeMock = jest.fn().mockResolvedValue(undefined);

        const step = new Step16VersionUpdate({
          aiHelper: { initialize: () => Promise.resolve(false) },
          fileOps: { readFile: readMock, writeFile: writeMock },
          backlog: mockBacklog,
          logger: mockLogger,
          projectRoot: '/fake/root',
        });

        const results = await step.updateVersionsInFiles([], '1.0.0', '1.0.1', ['extra-file.js']);
        const updated = results.filter((r) => r.success);
        // package.json and extra-file.js should both be updated
        expect(updated.some((r) => r.file.includes('extra-file.js'))).toBe(true);
      });
    });

    // C — check:version integration
    describe('runVersionConsistencyCheck', () => {
      test('returns ran:false when check:version script absent', async () => {
        const step = new Step16VersionUpdate({
          aiHelper: { initialize: () => Promise.resolve(false) },
          fileOps: {
            readFile: jest.fn().mockResolvedValue('{"scripts":{}}'),
            writeFile: jest.fn(),
          },
          backlog: mockBacklog,
          logger: mockLogger,
          projectRoot: '/fake/root',
        });

        const result = await step.runVersionConsistencyCheck();
        expect(result).toEqual({ ran: false });
      });

      test('returns ran:false when package.json unreadable', async () => {
        const step = new Step16VersionUpdate({
          aiHelper: { initialize: () => Promise.resolve(false) },
          fileOps: {
            readFile: jest.fn().mockRejectedValue(new Error('ENOENT')),
            writeFile: jest.fn(),
          },
          backlog: mockBacklog,
          logger: mockLogger,
          projectRoot: '/fake/root',
        });

        const result = await step.runVersionConsistencyCheck();
        expect(result).toEqual({ ran: false });
      });

      test('exports CHECK_VERSION_SCRIPT constant', () => {
        expect(CHECK_VERSION_SCRIPT).toBe('check:version');
      });
    });

    // D — versionConfig.files passed through execute()
    test('passes versionConfig.files to updateVersionsInFiles', async () => {
      const step = new Step16VersionUpdate({
        aiHelper: { initialize: () => Promise.resolve(false) },
        backlog: mockBacklog,
        logger: mockLogger,
      });

      step.detectCurrentVersion = jest.fn().mockResolvedValue('1.0.0');
      step.updateVersionsInFiles = jest
        .fn()
        .mockResolvedValue([{ file: 'package.json', success: true }]);
      step.updateVersionConfigFiles = jest.fn().mockResolvedValue([]);
      step.updateServiceWorkerFiles = jest.fn().mockResolvedValue([]);
      step.loadServiceWorkerFilesFromWorkflowConfig = jest.fn().mockResolvedValue([]);
      step.runVersionConsistencyCheck = jest.fn().mockResolvedValue({ ran: false });
      step._scanForVersionFiles = jest.fn().mockResolvedValue([]);

      await step.execute({
        modifiedFiles: ['src/app.js'],
        gitStats: {
          modifiedCount: 1,
          addedCount: 0,
          deletedCount: 0,
          insertions: 10,
          deletions: 2,
        },
        versionConfig: { files: ['src/config/defaults.js', 'docs/INDEX.md'] },
      });

      expect(step.updateVersionsInFiles).toHaveBeenCalledWith(
        expect.any(Array),
        '1.0.0',
        expect.any(String),
        expect.arrayContaining(['src/config/defaults.js', 'docs/INDEX.md'])
      );
    });

    // E — updateServiceWorkerFiles
    describe('updateServiceWorkerFiles', () => {
      const swContent = `const CACHE_NAME = 'app-v0.9.0-alpha-20260101';\nself.addEventListener('install', () => {});`;

      test('updates CACHE_NAME in a service worker file', async () => {
        const writeFile = jest.fn().mockResolvedValue(undefined);
        const step = new Step16VersionUpdate({
          aiHelper: { initialize: () => Promise.resolve(false) },
          fileOps: {
            readFile: jest.fn().mockResolvedValue(swContent),
            writeFile,
          },
          backlog: mockBacklog,
          logger: mockLogger,
          projectRoot: '/fake/root',
        });

        const results = await step.updateServiceWorkerFiles(
          ['service-worker.js'],
          '0.9.0-alpha',
          '0.11.3-alpha'
        );

        expect(results).toHaveLength(1);
        expect(results[0].success).toBe(true);
        expect(writeFile).toHaveBeenCalledTimes(1);
        const written = writeFile.mock.calls[0][1];
        expect(written).toContain('v0.11.3-alpha-');
      });

      test('skips file when CACHE_NAME not found', async () => {
        const step = new Step16VersionUpdate({
          aiHelper: { initialize: () => Promise.resolve(false) },
          fileOps: {
            readFile: jest.fn().mockResolvedValue(`export const foo = 'bar';`),
            writeFile: jest.fn(),
          },
          backlog: mockBacklog,
          logger: mockLogger,
          projectRoot: '/fake/root',
        });

        const results = await step.updateServiceWorkerFiles(
          ['sw.js'],
          '0.9.0-alpha',
          '0.11.3-alpha'
        );
        expect(results[0].skipped).toBe(true);
      });

      test('skips missing file gracefully', async () => {
        const err = new Error('ENOENT: no such file');
        err.code = 'ENOENT';
        const step = new Step16VersionUpdate({
          aiHelper: { initialize: () => Promise.resolve(false) },
          fileOps: { readFile: jest.fn().mockRejectedValue(err), writeFile: jest.fn() },
          backlog: mockBacklog,
          logger: mockLogger,
          projectRoot: '/fake/root',
        });

        const results = await step.updateServiceWorkerFiles(
          ['missing.js'],
          '0.9.0-alpha',
          '0.11.3-alpha'
        );
        expect(results[0].skipped).toBe(true);
        expect(results[0].reason).toBe('file not found');
      });

      test('does not write in dry-run mode', async () => {
        const writeFile = jest.fn();
        const step = new Step16VersionUpdate({
          aiHelper: { initialize: () => Promise.resolve(false) },
          fileOps: { readFile: jest.fn().mockResolvedValue(swContent), writeFile },
          backlog: mockBacklog,
          logger: mockLogger,
          projectRoot: '/fake/root',
          dryRun: true,
        });

        await step.updateServiceWorkerFiles(['service-worker.js'], '0.9.0-alpha', '0.11.3-alpha');
        expect(writeFile).not.toHaveBeenCalled();
      });
    });

    // F — versionConfig.serviceWorkerFiles passed through execute()
    test('passes versionConfig.serviceWorkerFiles to updateServiceWorkerFiles', async () => {
      const step = new Step16VersionUpdate({
        aiHelper: { initialize: () => Promise.resolve(false) },
        backlog: mockBacklog,
        logger: mockLogger,
      });

      step.detectCurrentVersion = jest.fn().mockResolvedValue('1.0.0');
      step.updateVersionsInFiles = jest.fn().mockResolvedValue([]);
      step.updateVersionConfigFiles = jest.fn().mockResolvedValue([]);
      step.updateServiceWorkerFiles = jest
        .fn()
        .mockResolvedValue([{ file: 'service-worker.js', success: true }]);
      step.loadServiceWorkerFilesFromWorkflowConfig = jest.fn().mockResolvedValue([]);
      step.runVersionConsistencyCheck = jest.fn().mockResolvedValue({ ran: false });

      await step.execute({
        modifiedFiles: ['src/app.js'],
        gitStats: {
          modifiedCount: 1,
          addedCount: 0,
          deletedCount: 0,
          insertions: 10,
          deletions: 2,
        },
        versionConfig: { serviceWorkerFiles: ['service-worker.js', 'public/service-worker.js'] },
      });

      expect(step.updateServiceWorkerFiles).toHaveBeenCalledWith(
        ['service-worker.js', 'public/service-worker.js'],
        '1.0.0',
        expect.any(String)
      );
    });
  });

  // ========================================================================
  // PURE FUNCTIONS - Consistency Check Auto-Fix
  // ========================================================================

  describe('parseConsistencyCheckOutput', () => {
    test('returns empty array for empty/null input', () => {
      expect(parseConsistencyCheckOutput('')).toEqual([]);
      expect(parseConsistencyCheckOutput(null)).toEqual([]);
      expect(parseConsistencyCheckOutput(undefined)).toEqual([]);
    });

    test('parses "Version mismatch in <file> … Found: <ver>" pattern', () => {
      const output = [
        'Checking .github/copilot-instructions.md...',
        '❌ Version mismatch in .github/copilot-instructions.md',
        'Expected: 0.11.7-alpha',
        'Found: 0.11.2-alpha',
      ].join('\n');
      const result = parseConsistencyCheckOutput(output);
      expect(result.length).toBeGreaterThan(0);
      const entry = result.find((r) => r.file.includes('copilot-instructions'));
      expect(entry).toBeDefined();
      expect(entry.foundVersions).toContain('0.11.2-alpha');
      expect(entry.missingFile).toBe(false);
    });

    test('parses "❌ <file> not found" pattern', () => {
      const output = '❌ src/config/defaults.js not found';
      const result = parseConsistencyCheckOutput(output);
      expect(result.length).toBe(1);
      expect(result[0].file).toBe('src/config/defaults.js');
      expect(result[0].missingFile).toBe(true);
      expect(result[0].foundVersions).toEqual([]);
    });

    test('parses multi-file output with multiple mismatches', () => {
      const output = [
        '❌ Version mismatch in docs/INDEX.md',
        'Expected: 0.11.7-alpha',
        'Found: 0.9.0-alpha',
        '',
        '❌ src/config/defaults.js not found',
        '',
        '❌ Version mismatch in .github/copilot-instructions.md',
        'Expected: 0.11.7-alpha',
        'Found: 0.11.2-alpha',
      ].join('\n');
      const result = parseConsistencyCheckOutput(output);
      const indexEntry = result.find((r) => r.file === 'docs/INDEX.md');
      expect(indexEntry).toBeDefined();
      expect(indexEntry.foundVersions).toContain('0.9.0-alpha');

      const missingEntry = result.find((r) => r.file === 'src/config/defaults.js');
      expect(missingEntry).toBeDefined();
      expect(missingEntry.missingFile).toBe(true);
    });

    test('parses "Outdated: <ver>" pattern with preceding file name', () => {
      const output = [
        'Checking README.md',
        '  Outdated: 1.2.3',
      ].join('\n');
      const result = parseConsistencyCheckOutput(output);
      const entry = result.find((r) => r.file === 'README.md');
      expect(entry).toBeDefined();
      expect(entry.foundVersions).toContain('1.2.3');
    });

    test('returns no duplicates for same file mentioned multiple times', () => {
      const output = [
        '❌ Version mismatch in README.md Found: 0.9.0',
        '❌ Version mismatch in README.md Found: 0.9.0',
      ].join('\n');
      const result = parseConsistencyCheckOutput(output);
      const readmeEntries = result.filter((r) => r.file === 'README.md');
      expect(readmeEntries.length).toBe(1);
    });
  });

  describe('buildDefaultVersionConstant', () => {
    test('generates a valid export const for a simple constant name', () => {
      const content = buildDefaultVersionConstant('GUIA_VERSION', '0.11.7-alpha');
      expect(content).toContain("export const GUIA_VERSION = '0.11.7-alpha';");
    });

    test('sanitises dangerous characters in constant name', () => {
      const content = buildDefaultVersionConstant('MY-VERSION.JS', '1.0.0');
      expect(content).toMatch(/export const MY_VERSION_JS = '1\.0\.0';/);
    });

    test('returns a string with a newline at the end', () => {
      const content = buildDefaultVersionConstant('V', '2.0.0');
      expect(content.endsWith('\n')).toBe(true);
    });
  });

  describe('deriveVersionConstantName', () => {
    test('derives VERSION from version.js', () => {
      expect(deriveVersionConstantName('src/config/version.js')).toBe('VERSION');
    });

    test('derives DEFAULTS_VERSION from defaults.js', () => {
      expect(deriveVersionConstantName('src/config/defaults.js')).toBe('DEFAULTS_VERSION');
    });

    test('works with a flat filename', () => {
      expect(deriveVersionConstantName('app.js')).toBe('APP_VERSION');
    });
  });

  describe('autoFixConsistencyIssues', () => {
    let step;
    let mockFileOps;

    beforeEach(() => {
      mockFileOps = {
        readFile: jest.fn(),
        writeFile: jest.fn().mockResolvedValue(undefined),
      };
      step = new Step16VersionUpdate({
        fileOps: mockFileOps,
        backlog: { saveStepSummary: jest.fn(), saveStepIssues: jest.fn() },
        logger: { info: jest.fn(), success: jest.fn(), warn: jest.fn(), error: jest.fn() },
        dryRun: false,
        projectRoot: '/project',
      });
    });

    test('updates file with stale version string', async () => {
      const output = [
        '❌ Version mismatch in docs/INDEX.md',
        'Expected: 0.11.7-alpha',
        'Found: 0.9.0-alpha',
      ].join('\n');

      mockFileOps.readFile.mockResolvedValue('Version: 0.9.0-alpha\nSome content');

      const results = await step.autoFixConsistencyIssues(output, '0.11.7-alpha');
      const updated = results.find((r) => r.file === 'docs/INDEX.md');
      expect(updated).toBeDefined();
      expect(updated.action).toBe('updated');
      expect(mockFileOps.writeFile).toHaveBeenCalledWith(
        '/project/docs/INDEX.md',
        expect.stringContaining('0.11.7-alpha')
      );
    });

    test('creates missing JS constant file', async () => {
      const output = '❌ src/config/defaults.js not found';
      mockFileOps.writeFile.mockResolvedValue(undefined);

      const results = await step.autoFixConsistencyIssues(output, '0.11.7-alpha');
      const created = results.find((r) => r.file === 'src/config/defaults.js');
      expect(created).toBeDefined();
      expect(created.action).toBe('created');
      expect(mockFileOps.writeFile).toHaveBeenCalledWith(
        '/project/src/config/defaults.js',
        expect.stringContaining("export const DEFAULTS_VERSION = '0.11.7-alpha';")
      );
    });

    test('skips file when content has no replaceable version string', async () => {
      const output = '❌ Version mismatch in README.md\nFound: 9.9.9-alpha';
      // File does NOT contain 9.9.9-alpha
      mockFileOps.readFile.mockResolvedValue('Some docs without the version');

      const results = await step.autoFixConsistencyIssues(output, '0.11.7-alpha');
      const entry = results.find((r) => r.file === 'README.md');
      expect(entry).toBeDefined();
      expect(entry.action).toBe('skipped');
    });

    test('skips in dryRun mode without writing files', async () => {
      step.dryRun = true;
      const output = '❌ Version mismatch in docs/INDEX.md\nFound: 0.9.0-alpha';
      mockFileOps.readFile.mockResolvedValue('Version 0.9.0-alpha content');

      const results = await step.autoFixConsistencyIssues(output, '0.11.7-alpha');
      const entry = results.find((r) => r.file === 'docs/INDEX.md');
      expect(entry.action).toBe('updated');
      expect(mockFileOps.writeFile).not.toHaveBeenCalled();
    });

    test('handles empty consistency output gracefully', async () => {
      const results = await step.autoFixConsistencyIssues('', '0.11.7-alpha');
      expect(results).toEqual([]);
    });
  });
});
