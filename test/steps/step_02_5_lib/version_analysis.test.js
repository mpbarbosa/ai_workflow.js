/**
 * Tests for Step 02_5 Version Analysis Module
 * @group steps
 */

import { jest } from '@jest/globals';
import {
  VersionAnalyzer,
  VERSION_THRESHOLDS,
  extractVersionReferences,
  parseVersion,
  formatVersion,
  compareVersions,
  calculateVersionGap,
  findOldestVersion,
  findNewestVersion,
  isVersionOutdated,
  calculateVersionStaleness,
  buildVersionAnalysis,
  filterOutdatedFiles,
  sortByVersionStaleness,
  generateVersionSummary,
} from '../../../src/steps/step_02_5_lib/version_analysis.js';

describe('Step 02_5 Version Analysis Module', () => {
  // ==========================================================================
  // PURE FUNCTIONS - Version Extraction
  // ==========================================================================

  describe('extractVersionReferences', () => {
    test('extracts version references', () => {
      const content = `
# API Documentation v1.2.3
Updated for version 2.0.0
See @3.1.0 for details
[1.7.0] is the minimum
      `;

      const versions = extractVersionReferences(content);

      expect(versions).toContain('1.2.3');
      expect(versions).toContain('2.0.0');
      expect(versions).toContain('3.1.0');
      expect(versions).toContain('1.7.0');
    });

    test('returns unique versions sorted', () => {
      const content = 'v1.2.3 and 1.2.3 and version 2.0.0';
      const versions = extractVersionReferences(content);

      expect(versions).toEqual(['1.2.3', '2.0.0']);
    });

    test('returns empty array if no versions', () => {
      const content = 'No versions here';
      expect(extractVersionReferences(content)).toEqual([]);
    });
  });

  describe('parseVersion', () => {
    test('parses semantic version', () => {
      expect(parseVersion('1.2.3')).toEqual({ major: 1, minor: 2, patch: 3 });
    });

    test('handles v prefix', () => {
      expect(parseVersion('v1.2.3')).toEqual({ major: 1, minor: 2, patch: 3 });
      expect(parseVersion('V2.0.0')).toEqual({ major: 2, minor: 0, patch: 0 });
    });

    test('defaults missing parts to 0', () => {
      expect(parseVersion('1.2')).toEqual({ major: 1, minor: 2, patch: 0 });
      expect(parseVersion('1')).toEqual({ major: 1, minor: 0, patch: 0 });
    });

    test('handles invalid versions', () => {
      expect(parseVersion('invalid')).toEqual({ major: 0, minor: 0, patch: 0 });
    });
  });

  describe('formatVersion', () => {
    test('formats version object to string', () => {
      expect(formatVersion({ major: 1, minor: 2, patch: 3 })).toBe('1.2.3');
    });

    test('handles zero values', () => {
      expect(formatVersion({ major: 2, minor: 0, patch: 0 })).toBe('2.0.0');
    });
  });

  // ==========================================================================
  // PURE FUNCTIONS - Version Comparison
  // ==========================================================================

  describe('compareVersions', () => {
    test('compares major versions', () => {
      expect(compareVersions('1.0.0', '2.0.0')).toBe(-1);
      expect(compareVersions('2.0.0', '1.0.0')).toBe(1);
    });

    test('compares minor versions', () => {
      expect(compareVersions('1.1.0', '1.2.0')).toBe(-1);
      expect(compareVersions('1.2.0', '1.1.0')).toBe(1);
    });

    test('compares patch versions', () => {
      expect(compareVersions('1.0.1', '1.0.2')).toBe(-1);
      expect(compareVersions('1.0.2', '1.0.1')).toBe(1);
    });

    test('returns 0 for equal versions', () => {
      expect(compareVersions('1.2.3', '1.2.3')).toBe(0);
      expect(compareVersions('v1.2.3', '1.2.3')).toBe(0);
    });
  });

  describe('calculateVersionGap', () => {
    test('calculates major gap', () => {
      const gap = calculateVersionGap('1.0.0', '3.0.0');
      expect(gap.major).toBe(2);
      expect(gap.minor).toBe(0);
      expect(gap.patch).toBe(0);
    });

    test('calculates minor gap', () => {
      const gap = calculateVersionGap('1.2.0', '1.7.0');
      expect(gap.major).toBe(0);
      expect(gap.minor).toBe(5);
      expect(gap.patch).toBe(0);
    });

    test('calculates patch gap', () => {
      const gap = calculateVersionGap('1.0.1', '1.0.5');
      expect(gap.major).toBe(0);
      expect(gap.minor).toBe(0);
      expect(gap.patch).toBe(4);
    });

    test('handles negative gaps', () => {
      const gap = calculateVersionGap('2.0.0', '1.0.0');
      expect(gap.major).toBe(-1);
    });
  });

  describe('findOldestVersion', () => {
    test('finds oldest version', () => {
      const versions = ['2.0.0', '1.7.0', '3.1.0', '1.2.3'];
      expect(findOldestVersion(versions)).toBe('1.2.3');
    });

    test('returns null for empty array', () => {
      expect(findOldestVersion([])).toBeNull();
    });

    test('handles single version', () => {
      expect(findOldestVersion(['1.0.0'])).toBe('1.0.0');
    });
  });

  describe('findNewestVersion', () => {
    test('finds newest version', () => {
      const versions = ['2.0.0', '1.7.0', '3.1.0', '1.2.3'];
      expect(findNewestVersion(versions)).toBe('3.1.0');
    });

    test('returns null for empty array', () => {
      expect(findNewestVersion([])).toBeNull();
    });

    test('handles single version', () => {
      expect(findNewestVersion(['2.5.0'])).toBe('2.5.0');
    });
  });

  // ==========================================================================
  // PURE FUNCTIONS - Outdatedness Detection
  // ==========================================================================

  describe('isVersionOutdated', () => {
    test('returns true for major version gap', () => {
      const versions = ['1.0.0', '1.7.0'];
      const current = '3.0.0';
      expect(isVersionOutdated(versions, current)).toBe(true);
    });

    test('returns true for minor version gap', () => {
      const versions = ['2.1.0'];
      const current = '2.7.0';
      const thresholds = { MAJOR_GAP: 2, MINOR_GAP: 5 };
      expect(isVersionOutdated(versions, current, thresholds)).toBe(true);
    });

    test('returns false for recent versions', () => {
      const versions = ['2.8.0', '2.9.0'];
      const current = '3.0.0';
      expect(isVersionOutdated(versions, current)).toBe(false);
    });

    test('returns false for empty versions', () => {
      expect(isVersionOutdated([], '3.0.0')).toBe(false);
    });
  });

  describe('calculateVersionStaleness', () => {
    test('calculates high score for old major version', () => {
      const versions = ['1.0.0'];
      const current = '4.0.0';
      const score = calculateVersionStaleness(versions, current);
      expect(score).toBeGreaterThanOrEqual(60);
    });

    test('calculates medium score for minor gap', () => {
      const versions = ['2.0.0'];
      const current = '2.8.0';
      const score = calculateVersionStaleness(versions, current);
      expect(score).toBeGreaterThan(20);
      expect(score).toBeLessThan(60);
    });

    test('calculates low score for patch gap', () => {
      const versions = ['3.0.5'];
      const current = '3.0.10';
      const score = calculateVersionStaleness(versions, current);
      expect(score).toBeLessThan(20);
    });

    test('returns 0 for empty versions', () => {
      expect(calculateVersionStaleness([], '3.0.0')).toBe(0);
    });

    test('caps score at 100', () => {
      const versions = ['1.0.0'];
      const current = '10.20.30';
      const score = calculateVersionStaleness(versions, current);
      expect(score).toBeLessThanOrEqual(100);
    });
  });

  // ==========================================================================
  // PURE FUNCTIONS - Analysis Results
  // ==========================================================================

  describe('buildVersionAnalysis', () => {
    test('builds analysis for file with versions', () => {
      const data = {
        versions: ['1.7.0', '2.0.0', '1.2.3'],
        currentVersion: '3.0.0',
        thresholds: VERSION_THRESHOLDS,
      };

      const analysis = buildVersionAnalysis('docs/api.md', data);

      expect(analysis.file).toBe('docs/api.md');
      expect(analysis.hasVersions).toBe(true);
      expect(analysis.versions).toEqual(['1.7.0', '2.0.0', '1.2.3']);
      expect(analysis.oldestVersion).toBe('1.2.3');
      expect(analysis.newestVersion).toBe('2.0.0');
      expect(analysis.versionGap.major).toBe(2);
      expect(analysis.isOutdated).toBe(true);
      expect(analysis.stalenessScore).toBeGreaterThan(0);
    });

    test('builds analysis for file without versions', () => {
      const data = {
        versions: [],
        currentVersion: '3.0.0',
        thresholds: VERSION_THRESHOLDS,
      };

      const analysis = buildVersionAnalysis('docs/guide.md', data);

      expect(analysis.hasVersions).toBe(false);
      expect(analysis.oldestVersion).toBeNull();
      expect(analysis.isOutdated).toBe(false);
      expect(analysis.stalenessScore).toBe(0);
    });
  });

  describe('filterOutdatedFiles', () => {
    test('filters outdated files', () => {
      const analyses = [
        { file: 'a.md', isOutdated: false },
        { file: 'b.md', isOutdated: true },
        { file: 'c.md', isOutdated: true },
      ];

      const outdated = filterOutdatedFiles(analyses);

      expect(outdated).toHaveLength(2);
      expect(outdated[0].file).toBe('b.md');
      expect(outdated[1].file).toBe('c.md');
    });

    test('returns empty array if none outdated', () => {
      const analyses = [{ file: 'a.md', isOutdated: false }];
      expect(filterOutdatedFiles(analyses)).toEqual([]);
    });
  });

  describe('sortByVersionStaleness', () => {
    test('sorts by staleness score descending', () => {
      const analyses = [
        { file: 'a.md', stalenessScore: 30 },
        { file: 'b.md', stalenessScore: 80 },
        { file: 'c.md', stalenessScore: 50 },
      ];

      const sorted = sortByVersionStaleness(analyses);

      expect(sorted[0].stalenessScore).toBe(80);
      expect(sorted[1].stalenessScore).toBe(50);
      expect(sorted[2].stalenessScore).toBe(30);
    });

    test('does not modify original array', () => {
      const analyses = [
        { file: 'a.md', stalenessScore: 30 },
        { file: 'b.md', stalenessScore: 80 },
      ];

      sortByVersionStaleness(analyses);

      expect(analyses[0].stalenessScore).toBe(30); // Original unchanged
    });
  });

  describe('generateVersionSummary', () => {
    test('generates complete summary', () => {
      const analyses = [
        {
          hasVersions: true,
          versions: ['1.0.0', '1.7.0'],
          isOutdated: true,
          stalenessScore: 80,
        },
        {
          hasVersions: true,
          versions: ['2.0.0'],
          isOutdated: false,
          stalenessScore: 20,
        },
        { hasVersions: false, versions: [], isOutdated: false, stalenessScore: 0 },
      ];

      const summary = generateVersionSummary(analyses);

      expect(summary.totalFiles).toBe(3);
      expect(summary.filesWithVersions).toBe(2);
      expect(summary.filesWithoutVersions).toBe(1);
      expect(summary.outdatedFiles).toBe(1);
      expect(summary.avgStalenessScore).toBe(50);
      expect(summary.commonVersions.length).toBeGreaterThan(0);
    });

    test('handles empty analyses', () => {
      const summary = generateVersionSummary([]);

      expect(summary.totalFiles).toBe(0);
      expect(summary.avgStalenessScore).toBe(0);
    });
  });

  // ==========================================================================
  // VERSION ANALYZER - Integration Tests
  // ==========================================================================

  describe('VersionAnalyzer', () => {
    let mockFileOps;
    let mockLogger;
    let analyzer;

    beforeEach(() => {
      mockFileOps = {
        readFile: jest.fn(),
      };
      mockLogger = {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      };

      analyzer = new VersionAnalyzer({
        fileOps: mockFileOps,
        currentVersion: '3.0.0',
        logger: mockLogger,
      });
    });

    test('constructs with default options', () => {
      const defaultAnalyzer = new VersionAnalyzer({});
      expect(defaultAnalyzer.currentVersion).toBe('0.0.0');
      expect(defaultAnalyzer.thresholds).toEqual(VERSION_THRESHOLDS);
    });

    test('detectProjectVersion reads package.json', async () => {
      mockFileOps.readFile.mockResolvedValue('{"version": "2.5.0"}');

      const version = await analyzer.detectProjectVersion('/project');

      expect(version).toBe('2.5.0');
      expect(mockLogger.info).toHaveBeenCalledWith('Detected version from package.json: 2.5.0');
    });

    test('detectProjectVersion falls back to pyproject.toml', async () => {
      mockFileOps.readFile
        .mockRejectedValueOnce(new Error('Not found'))
        .mockResolvedValueOnce('version = "1.8.0"');

      const version = await analyzer.detectProjectVersion('/project');

      expect(version).toBe('1.8.0');
    });

    test('detectProjectVersion falls back to CHANGELOG.md', async () => {
      mockFileOps.readFile
        .mockRejectedValueOnce(new Error('Not found'))
        .mockRejectedValueOnce(new Error('Not found'))
        .mockResolvedValueOnce('## [2.1.0] - 2024-01-01');

      const version = await analyzer.detectProjectVersion('/project');

      expect(version).toBe('2.1.0');
    });

    test('detectProjectVersion returns 0.0.0 if not found', async () => {
      mockFileOps.readFile.mockRejectedValue(new Error('Not found'));

      const version = await analyzer.detectProjectVersion('/project');

      expect(version).toBe('0.0.0');
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    test('analyzeFiles processes multiple files', async () => {
      mockFileOps.readFile
        .mockResolvedValueOnce('# API v1.2.3\nFor version 2.0.0')
        .mockResolvedValueOnce('# Guide v2.5.0');

      const files = ['api.md', 'guide.md'];
      const analyses = await analyzer.analyzeFiles(files);

      expect(analyses).toHaveLength(2);
      expect(analyses[0].hasVersions).toBe(true);
      expect(analyses[0].versions).toContain('1.2.3');
      expect(mockLogger.info).toHaveBeenCalled();
    });

    test('analyzeFiles handles read errors', async () => {
      mockFileOps.readFile.mockRejectedValue(new Error('Read error'));

      const files = ['missing.md'];
      const analyses = await analyzer.analyzeFiles(files);

      expect(analyses).toEqual([]);
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    test('getOutdatedFiles filters outdated', () => {
      const analyses = [
        { file: 'fresh.md', isOutdated: false },
        { file: 'old.md', isOutdated: true },
      ];

      const outdated = analyzer.getOutdatedFiles(analyses);

      expect(outdated).toHaveLength(1);
      expect(outdated[0].file).toBe('old.md');
    });

    test('getSummary returns statistics', () => {
      const analyses = [
        { hasVersions: true, versions: ['1.0.0'], isOutdated: true, stalenessScore: 60 },
        { hasVersions: false, versions: [], isOutdated: false, stalenessScore: 0 },
      ];

      const summary = analyzer.getSummary(analyses);

      expect(summary.totalFiles).toBe(2);
      expect(summary.filesWithVersions).toBe(1);
    });

    test('formatResults generates display output', () => {
      const analyses = [
        {
          file: 'doc.md',
          hasVersions: true,
          versions: ['1.0.0'],
          oldestVersion: '1.0.0',
          versionGap: { major: 2, minor: 0, patch: 0 },
          isOutdated: true,
          stalenessScore: 80,
        },
      ];

      const output = analyzer.formatResults(analyses);

      expect(output).toContain('Version Analysis Summary');
      expect(output).toContain('Total Files: 1');
      expect(output).toContain('doc.md');
      expect(output).toContain('80/100');
    });
  });
});
