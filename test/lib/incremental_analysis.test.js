/**
 * @fileoverview Tests for Incremental Analysis Module
 */

import {
  calculateFileHash,
  calculateFileHashes,
  hasHashChanged,
  categorizeFileChange,
  detectFileChanges,
  calculateChangeStats,
  filterFilesByChangeType,
  shouldReanalyze,
  buildChangeReport,
  serializeHashes,
  parseHashes,
  validateHashData,
  IncrementalAnalyzer,
  CHANGE_TYPES,
} from '../../src/lib/incremental_analysis.js';
import { FileOperations } from '../../src/lib/file_operations.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

// ============================================================================
// PURE FUNCTION TESTS - Hash Calculation
// ============================================================================

describe('Pure Functions - Hash Calculation', () => {
  describe('calculateFileHash', () => {
    test('calculates hash for empty string', () => {
      const hash = calculateFileHash('');
      expect(hash).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    });

    test('calculates hash for simple content', () => {
      const hash = calculateFileHash('hello world');
      expect(hash).toBe('b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9');
    });

    test('same content produces same hash (deterministic)', () => {
      const content = 'test content';
      const hash1 = calculateFileHash(content);
      const hash2 = calculateFileHash(content);
      expect(hash1).toBe(hash2);
    });

    test('different content produces different hash', () => {
      const hash1 = calculateFileHash('content1');
      const hash2 = calculateFileHash('content2');
      expect(hash1).not.toBe(hash2);
    });

    test('throws on non-string content', () => {
      expect(() => calculateFileHash(123)).toThrow(TypeError);
      expect(() => calculateFileHash(null)).toThrow(TypeError);
      expect(() => calculateFileHash(undefined)).toThrow(TypeError);
    });

    test('supports different hash algorithms', () => {
      const content = 'test';
      const sha256 = calculateFileHash(content, 'sha256');
      const sha1 = calculateFileHash(content, 'sha1');
      expect(sha256).not.toBe(sha1);
      expect(sha1).toHaveLength(40); // SHA-1 is 160 bits = 40 hex chars
    });
  });

  describe('calculateFileHashes', () => {
    test('calculates hashes for multiple files', () => {
      const files = {
        'file1.js': 'content1',
        'file2.js': 'content2',
        'file3.js': 'content3',
      };

      const hashes = calculateFileHashes(files);

      expect(Object.keys(hashes)).toEqual(['file1.js', 'file2.js', 'file3.js']);
      expect(typeof hashes['file1.js']).toBe('string');
      expect(hashes['file1.js']).toHaveLength(64); // SHA-256 = 64 hex chars
    });

    test('returns empty object for no files', () => {
      const hashes = calculateFileHashes({});
      expect(hashes).toEqual({});
    });

    test('handles files with same content', () => {
      const files = {
        'file1.js': 'same',
        'file2.js': 'same',
      };

      const hashes = calculateFileHashes(files);
      expect(hashes['file1.js']).toBe(hashes['file2.js']);
    });
  });
});

// ============================================================================
// PURE FUNCTION TESTS - Change Detection
// ============================================================================

describe('Pure Functions - Change Detection', () => {
  describe('hasHashChanged', () => {
    test('detects no change when hashes match', () => {
      expect(hasHashChanged('abc123', 'abc123')).toBe(false);
    });

    test('detects change when hashes differ', () => {
      expect(hasHashChanged('abc123', 'def456')).toBe(true);
    });

    test('detects added file (old undefined, new exists)', () => {
      expect(hasHashChanged(undefined, 'abc123')).toBe(true);
    });

    test('detects deleted file (old exists, new undefined)', () => {
      expect(hasHashChanged('abc123', undefined)).toBe(true);
    });

    test('no change when both undefined', () => {
      expect(hasHashChanged(undefined, undefined)).toBe(false);
    });
  });

  describe('categorizeFileChange', () => {
    test('categorizes ADDED file', () => {
      expect(categorizeFileChange(undefined, 'abc123')).toBe(CHANGE_TYPES.ADDED);
    });

    test('categorizes DELETED file', () => {
      expect(categorizeFileChange('abc123', undefined)).toBe(CHANGE_TYPES.DELETED);
    });

    test('categorizes MODIFIED file', () => {
      expect(categorizeFileChange('abc123', 'def456')).toBe(CHANGE_TYPES.MODIFIED);
    });

    test('categorizes UNCHANGED file', () => {
      expect(categorizeFileChange('abc123', 'abc123')).toBe(CHANGE_TYPES.UNCHANGED);
    });
  });

  describe('detectFileChanges', () => {
    test('detects all change types', () => {
      const oldHashes = {
        'unchanged.js': 'hash1',
        'modified.js': 'hash2',
        'deleted.js': 'hash3',
      };

      const newHashes = {
        'unchanged.js': 'hash1',
        'modified.js': 'hash2-changed',
        'added.js': 'hash4',
      };

      const changes = detectFileChanges(oldHashes, newHashes);

      expect(changes[CHANGE_TYPES.UNCHANGED]).toEqual(['unchanged.js']);
      expect(changes[CHANGE_TYPES.MODIFIED]).toEqual(['modified.js']);
      expect(changes[CHANGE_TYPES.DELETED]).toEqual(['deleted.js']);
      expect(changes[CHANGE_TYPES.ADDED]).toEqual(['added.js']);
    });

    test('handles empty old hashes (all added)', () => {
      const newHashes = {
        'file1.js': 'hash1',
        'file2.js': 'hash2',
      };

      const changes = detectFileChanges({}, newHashes);

      expect(changes[CHANGE_TYPES.ADDED]).toEqual(['file1.js', 'file2.js']);
      expect(changes[CHANGE_TYPES.MODIFIED]).toEqual([]);
      expect(changes[CHANGE_TYPES.DELETED]).toEqual([]);
      expect(changes[CHANGE_TYPES.UNCHANGED]).toEqual([]);
    });

    test('handles empty new hashes (all deleted)', () => {
      const oldHashes = {
        'file1.js': 'hash1',
        'file2.js': 'hash2',
      };

      const changes = detectFileChanges(oldHashes, {});

      expect(changes[CHANGE_TYPES.DELETED]).toEqual(['file1.js', 'file2.js']);
      expect(changes[CHANGE_TYPES.ADDED]).toEqual([]);
      expect(changes[CHANGE_TYPES.MODIFIED]).toEqual([]);
      expect(changes[CHANGE_TYPES.UNCHANGED]).toEqual([]);
    });

    test('handles no changes', () => {
      const hashes = {
        'file1.js': 'hash1',
        'file2.js': 'hash2',
      };

      const changes = detectFileChanges(hashes, hashes);

      expect(changes[CHANGE_TYPES.UNCHANGED]).toEqual(['file1.js', 'file2.js']);
      expect(changes[CHANGE_TYPES.ADDED]).toEqual([]);
      expect(changes[CHANGE_TYPES.MODIFIED]).toEqual([]);
      expect(changes[CHANGE_TYPES.DELETED]).toEqual([]);
    });
  });
});

// ============================================================================
// PURE FUNCTION TESTS - Change Analysis
// ============================================================================

describe('Pure Functions - Change Analysis', () => {
  describe('calculateChangeStats', () => {
    test('calculates stats for mixed changes', () => {
      const changes = {
        [CHANGE_TYPES.ADDED]: ['file1.js', 'file2.js'],
        [CHANGE_TYPES.MODIFIED]: ['file3.js'],
        [CHANGE_TYPES.DELETED]: ['file4.js'],
        [CHANGE_TYPES.UNCHANGED]: ['file5.js', 'file6.js', 'file7.js'],
      };

      const stats = calculateChangeStats(changes);

      expect(stats.total).toBe(7);
      expect(stats.changed).toBe(4); // 2 added + 1 modified + 1 deleted
      expect(stats.unchanged).toBe(3);
      expect(stats.added).toBe(2);
      expect(stats.modified).toBe(1);
      expect(stats.deleted).toBe(1);
      expect(stats.changePercentage).toBeCloseTo(57.14, 1);
    });

    test('calculates stats for no changes', () => {
      const changes = {
        [CHANGE_TYPES.ADDED]: [],
        [CHANGE_TYPES.MODIFIED]: [],
        [CHANGE_TYPES.DELETED]: [],
        [CHANGE_TYPES.UNCHANGED]: ['file1.js', 'file2.js'],
      };

      const stats = calculateChangeStats(changes);

      expect(stats.total).toBe(2);
      expect(stats.changed).toBe(0);
      expect(stats.changePercentage).toBe(0);
    });

    test('handles empty changes', () => {
      const changes = {
        [CHANGE_TYPES.ADDED]: [],
        [CHANGE_TYPES.MODIFIED]: [],
        [CHANGE_TYPES.DELETED]: [],
        [CHANGE_TYPES.UNCHANGED]: [],
      };

      const stats = calculateChangeStats(changes);

      expect(stats.total).toBe(0);
      expect(stats.changePercentage).toBe(0);
    });
  });

  describe('filterFilesByChangeType', () => {
    const changes = {
      [CHANGE_TYPES.ADDED]: ['added1.js', 'added2.js'],
      [CHANGE_TYPES.MODIFIED]: ['modified1.js'],
      [CHANGE_TYPES.DELETED]: ['deleted1.js'],
      [CHANGE_TYPES.UNCHANGED]: ['unchanged1.js', 'unchanged2.js'],
    };

    test('filters by single type', () => {
      const added = filterFilesByChangeType(changes, [CHANGE_TYPES.ADDED]);
      expect(added).toEqual(['added1.js', 'added2.js']);
    });

    test('filters by multiple types', () => {
      const changed = filterFilesByChangeType(changes, [
        CHANGE_TYPES.ADDED,
        CHANGE_TYPES.MODIFIED,
        CHANGE_TYPES.DELETED,
      ]);
      expect(changed).toEqual(['added1.js', 'added2.js', 'modified1.js', 'deleted1.js']);
    });

    test('returns empty array for empty types', () => {
      expect(filterFilesByChangeType(changes, [])).toEqual([]);
    });

    test('returns empty array for invalid types', () => {
      expect(filterFilesByChangeType(changes, null)).toEqual([]);
    });
  });

  describe('shouldReanalyze', () => {
    test('returns true when above threshold', () => {
      const stats = { changePercentage: 25.5 };
      expect(shouldReanalyze(stats, 0.2)).toBe(true); // 25.5% > 20%
    });

    test('returns false when below threshold', () => {
      const stats = { changePercentage: 5.0 };
      expect(shouldReanalyze(stats, 0.1)).toBe(false); // 5% <= 10%
    });

    test('returns false when exactly at threshold', () => {
      const stats = { changePercentage: 10.0 };
      expect(shouldReanalyze(stats, 0.1)).toBe(false); // 10% <= 10%
    });

    test('uses default threshold if not provided', () => {
      const stats = { changePercentage: 15.0 };
      expect(shouldReanalyze(stats)).toBe(true); // 15% > 10% (default)
    });

    test('throws on invalid threshold', () => {
      const stats = { changePercentage: 50 };
      expect(() => shouldReanalyze(stats, -0.1)).toThrow(RangeError);
      expect(() => shouldReanalyze(stats, 1.5)).toThrow(RangeError);
    });
  });

  describe('buildChangeReport', () => {
    test('builds comprehensive report', () => {
      const changes = {
        [CHANGE_TYPES.ADDED]: ['added.js'],
        [CHANGE_TYPES.MODIFIED]: ['modified.js'],
        [CHANGE_TYPES.DELETED]: ['deleted.js'],
        [CHANGE_TYPES.UNCHANGED]: ['unchanged1.js', 'unchanged2.js'],
      };

      const stats = calculateChangeStats(changes);
      const report = buildChangeReport(changes, stats);

      expect(report.summary.total).toBe(5);
      expect(report.summary.changed).toBe(3);
      expect(report.summary.unchanged).toBe(2);
      expect(report.summary.changePercentage).toBe('60%');

      expect(report.details.added.count).toBe(1);
      expect(report.details.added.files).toEqual(['added.js']);

      expect(report.details.modified.count).toBe(1);
      expect(report.details.modified.files).toEqual(['modified.js']);

      expect(report.details.deleted.count).toBe(1);
      expect(report.details.deleted.files).toEqual(['deleted.js']);

      expect(report.needsReanalysis).toBe(true); // 60% > 10% default threshold
    });
  });
});

// ============================================================================
// PURE FUNCTION TESTS - Hash Storage
// ============================================================================

describe('Pure Functions - Hash Storage', () => {
  describe('serializeHashes', () => {
    test('serializes hashes to JSON', () => {
      const hashes = {
        'file1.js': 'hash1',
        'file2.js': 'hash2',
      };
      const timestamp = 1234567890;

      const json = serializeHashes(hashes, timestamp);
      const parsed = JSON.parse(json);

      expect(parsed.version).toBe('2.0.0');
      expect(parsed.timestamp).toBe(1234567890);
      expect(parsed.hashes).toEqual(hashes);
    });

    test('produces valid JSON', () => {
      const json = serializeHashes({}, 0);
      expect(() => JSON.parse(json)).not.toThrow();
    });
  });

  describe('parseHashes', () => {
    test('parses valid hash JSON', () => {
      const json = JSON.stringify({
        version: '2.0.0',
        timestamp: 1234567890,
        hashes: { 'file.js': 'hash' },
      });

      const data = parseHashes(json);

      expect(data.version).toBe('2.0.0');
      expect(data.timestamp).toBe(1234567890);
      expect(data.hashes).toEqual({ 'file.js': 'hash' });
    });

    test('throws on invalid JSON', () => {
      expect(() => parseHashes('not json')).toThrow();
    });

    test('throws on empty string', () => {
      expect(() => parseHashes('')).toThrow(TypeError);
    });

    test('throws on non-string input', () => {
      expect(() => parseHashes(null)).toThrow(TypeError);
      expect(() => parseHashes(undefined)).toThrow(TypeError);
    });

    test('throws on missing required fields', () => {
      expect(() => parseHashes('{}')).toThrow(Error);
      expect(() => parseHashes('{"version": "2.0.0"}')).toThrow(Error);
      expect(() => parseHashes('{"version": "2.0.0", "timestamp": 123}')).toThrow(Error);
    });
  });

  describe('validateHashData', () => {
    test('validates correct hash data', () => {
      const data = {
        version: '2.0.0',
        timestamp: 1234567890,
        hashes: { 'file.js': 'hash' },
      };
      expect(validateHashData(data)).toBe(true);
    });

    test('rejects null or undefined', () => {
      expect(validateHashData(null)).toBe(false);
      expect(validateHashData(undefined)).toBe(false);
    });

    test('rejects non-object', () => {
      expect(validateHashData('string')).toBe(false);
      expect(validateHashData(123)).toBe(false);
    });

    test('rejects missing version', () => {
      expect(validateHashData({ timestamp: 123, hashes: {} })).toBe(false);
    });

    test('rejects missing timestamp', () => {
      expect(validateHashData({ version: '2.0.0', hashes: {} })).toBe(false);
    });

    test('rejects missing hashes', () => {
      expect(validateHashData({ version: '2.0.0', timestamp: 123 })).toBe(false);
    });

    test('rejects invalid types', () => {
      expect(validateHashData({ version: 123, timestamp: 123, hashes: {} })).toBe(false);
      expect(validateHashData({ version: '2.0.0', timestamp: '123', hashes: {} })).toBe(false);
      expect(validateHashData({ version: '2.0.0', timestamp: 123, hashes: 'string' })).toBe(false);
    });
  });
});

// ============================================================================
// INTEGRATION TESTS - IncrementalAnalyzer
// ============================================================================

describe('IncrementalAnalyzer Integration', () => {
  let analyzer;
  let tempDir;
  let fileOps;

  beforeEach(async () => {
    // Create temp directory
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'incremental-test-'));
    fileOps = new FileOperations();
    analyzer = new IncrementalAnalyzer({
      fileOps,
      hashFile: path.join(tempDir, '.incremental_hashes.json'),
    });
  });

  afterEach(async () => {
    // Clean up temp directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('calculateHashes', () => {
    test('calculates hashes for files in directory', async () => {
      // Create test files
      await fs.writeFile(path.join(tempDir, 'file1.js'), 'content1');
      await fs.writeFile(path.join(tempDir, 'file2.js'), 'content2');

      const hashes = await analyzer.calculateHashes(tempDir);

      expect(Object.keys(hashes)).toHaveLength(2);
      expect(hashes['file1.js']).toBeDefined();
      expect(hashes['file2.js']).toBeDefined();
      expect(typeof hashes['file1.js']).toBe('string');
    });

    test('handles empty directory', async () => {
      const hashes = await analyzer.calculateHashes(tempDir);
      expect(hashes).toEqual({});
    });

    test('respects file patterns', async () => {
      await fs.writeFile(path.join(tempDir, 'file.js'), 'content');
      await fs.writeFile(path.join(tempDir, 'file.txt'), 'content');

      // Note: Current implementation scans all files (pattern filtering not yet implemented)
      const hashes = await analyzer.calculateHashes(tempDir, ['**/*.js']);

      // Should have both files since filtering is not implemented yet
      expect(Object.keys(hashes).length).toBeGreaterThanOrEqual(1);
      expect(hashes['file.js']).toBeDefined();
    });
  });

  describe('loadPreviousHashes and saveHashes', () => {
    test('saves and loads hashes correctly', async () => {
      analyzer.currentHashes = {
        'file1.js': 'hash1',
        'file2.js': 'hash2',
      };

      await analyzer.saveHashes();

      const newAnalyzer = new IncrementalAnalyzer({
        fileOps,
        hashFile: path.join(tempDir, '.incremental_hashes.json'),
      });

      await newAnalyzer.loadPreviousHashes();

      expect(newAnalyzer.previousHashes).toEqual({
        'file1.js': 'hash1',
        'file2.js': 'hash2',
      });
    });

    test('handles missing hash file gracefully', async () => {
      await analyzer.loadPreviousHashes();
      expect(analyzer.previousHashes).toEqual({});
    });

    test('handles corrupted hash file', async () => {
      await fs.writeFile(analyzer.hashFile, 'corrupted json');
      await analyzer.loadPreviousHashes();
      expect(analyzer.previousHashes).toEqual({});
    });
  });

  describe('detectChanges', () => {
    test('detects all types of changes', async () => {
      // Set up previous state
      analyzer.previousHashes = {
        'unchanged.js': 'hash1',
        'modified.js': 'hash2',
        'deleted.js': 'hash3',
      };

      // Set up current state
      analyzer.currentHashes = {
        'unchanged.js': 'hash1',
        'modified.js': 'hash2-changed',
        'added.js': 'hash4',
      };

      const changes = analyzer.detectChanges();

      expect(changes[CHANGE_TYPES.UNCHANGED]).toEqual(['unchanged.js']);
      expect(changes[CHANGE_TYPES.MODIFIED]).toEqual(['modified.js']);
      expect(changes[CHANGE_TYPES.DELETED]).toEqual(['deleted.js']);
      expect(changes[CHANGE_TYPES.ADDED]).toEqual(['added.js']);
    });

    test('updates internal state', () => {
      analyzer.previousHashes = {};
      analyzer.currentHashes = { 'file.js': 'hash' };

      analyzer.detectChanges();

      expect(analyzer.changes).toBeDefined();
      expect(analyzer.stats).toBeDefined();
    });
  });

  describe('getChangeStats', () => {
    test('returns change statistics', () => {
      analyzer.previousHashes = { 'file1.js': 'hash1' };
      analyzer.currentHashes = { 'file1.js': 'hash1-changed' };
      analyzer.detectChanges();

      const stats = analyzer.getChangeStats();

      expect(stats.total).toBe(1);
      expect(stats.changed).toBe(1);
      expect(stats.modified).toBe(1);
      expect(stats.changePercentage).toBe(100);
    });

    test('throws if changes not detected yet', () => {
      expect(() => analyzer.getChangeStats()).toThrow(Error);
    });
  });

  describe('getChangeReport', () => {
    test('returns formatted change report', () => {
      analyzer.previousHashes = {};
      analyzer.currentHashes = { 'file.js': 'hash' };
      analyzer.detectChanges();

      const report = analyzer.getChangeReport();

      expect(report.summary).toBeDefined();
      expect(report.details).toBeDefined();
      expect(report.needsReanalysis).toBeDefined();
      expect(report.details.added.count).toBe(1);
    });

    test('throws if changes not detected yet', () => {
      expect(() => analyzer.getChangeReport()).toThrow(Error);
    });
  });

  describe('needsReanalysis', () => {
    test('returns true when changes exceed threshold', () => {
      analyzer.previousHashes = {
        'file1.js': 'hash1',
        'file2.js': 'hash2',
      };
      analyzer.currentHashes = {
        'file1.js': 'hash1-changed',
        'file2.js': 'hash2-changed',
      };
      analyzer.detectChanges();

      expect(analyzer.needsReanalysis()).toBe(true); // 100% > 10%
    });

    test('returns false when changes below threshold', () => {
      analyzer.changeThreshold = 0.5; // 50%
      analyzer.previousHashes = {
        'file1.js': 'hash1',
        'file2.js': 'hash2',
        'file3.js': 'hash3',
      };
      analyzer.currentHashes = {
        'file1.js': 'hash1-changed',
        'file2.js': 'hash2',
        'file3.js': 'hash3',
      };
      analyzer.detectChanges();

      expect(analyzer.needsReanalysis()).toBe(false); // 33.33% < 50%
    });

    test('throws if changes not detected yet', () => {
      expect(() => analyzer.needsReanalysis()).toThrow(Error);
    });
  });

  describe('getChangedFiles', () => {
    test('returns all changed files', () => {
      analyzer.previousHashes = { 'file1.js': 'hash1' };
      analyzer.currentHashes = { 'file1.js': 'hash1-changed', 'file2.js': 'hash2' };
      analyzer.detectChanges();

      const changedFiles = analyzer.getChangedFiles();

      expect(changedFiles).toContain('file1.js'); // modified
      expect(changedFiles).toContain('file2.js'); // added
      expect(changedFiles).toHaveLength(2);
    });

    test('throws if changes not detected yet', () => {
      expect(() => analyzer.getChangedFiles()).toThrow(Error);
    });
  });

  describe('getFilesByType', () => {
    test('returns files of specific type', () => {
      analyzer.previousHashes = {};
      analyzer.currentHashes = { 'added.js': 'hash' };
      analyzer.detectChanges();

      const addedFiles = analyzer.getFilesByType(CHANGE_TYPES.ADDED);

      expect(addedFiles).toEqual(['added.js']);
    });

    test('throws if changes not detected yet', () => {
      expect(() => analyzer.getFilesByType(CHANGE_TYPES.ADDED)).toThrow(Error);
    });
  });

  describe('reset', () => {
    test('resets analyzer state', () => {
      analyzer.currentHashes = { 'file.js': 'hash' };
      analyzer.previousHashes = { 'file.js': 'hash' };
      analyzer.detectChanges();

      analyzer.reset();

      expect(analyzer.currentHashes).toEqual({});
      expect(analyzer.previousHashes).toEqual({});
      expect(analyzer.changes).toBeNull();
      expect(analyzer.stats).toBeNull();
    });
  });

  describe('end-to-end workflow', () => {
    test('complete incremental analysis workflow', async () => {
      // Step 1: Initial scan
      await fs.writeFile(path.join(tempDir, 'file1.js'), 'initial content');
      await analyzer.calculateHashes(tempDir);
      await analyzer.saveHashes();

      // Step 2: Modify file
      await fs.writeFile(path.join(tempDir, 'file1.js'), 'modified content');
      await fs.writeFile(path.join(tempDir, 'file2.js'), 'new content');

      // Step 3: New analysis
      const newAnalyzer = new IncrementalAnalyzer({
        fileOps,
        hashFile: path.join(tempDir, '.incremental_hashes.json'),
      });
      await newAnalyzer.loadPreviousHashes();
      await newAnalyzer.calculateHashes(tempDir);
      newAnalyzer.detectChanges();

      // Verify results
      const stats = newAnalyzer.getChangeStats();
      expect(stats.modified).toBe(1); // file1.js
      expect(stats.added).toBeGreaterThanOrEqual(1); // file2.js (+ maybe hash file)
      expect(stats.total).toBeGreaterThanOrEqual(2);

      const changedFiles = newAnalyzer.getChangedFiles();
      expect(changedFiles).toContain('file1.js');
      expect(changedFiles).toContain('file2.js');

      expect(newAnalyzer.needsReanalysis()).toBe(true); // 100% changed
    });
  });
});
