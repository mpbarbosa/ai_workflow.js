/**
 * @fileoverview Unit tests for Step10PartitionCache (v2.0.0)
 * @module test/lib/step10_partition_cache
 *
 * Tests all pure functions and the impure wrapper class for the
 * partition rotation cache that reduces per-run AI token usage in Step 10.
 */

import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { jest } from '@jest/globals'; // eslint-disable-line no-unused-vars

import {
  computeFilesHash,
  groupFilesByDirectory,
  buildPartitions,
  selectPartition,
  nextPartitionIndex,
  createCacheEntry,
  isCacheValid,
  scoreFromIssueCount,
  isFileExempt,
  sortByPriority,
  filterAndPrioritize,
  mergeFileScores,
  createQualityState,
  Step10PartitionCache,
  CACHE_VERSION,
  MAX_PARTITION_SIZE,
  CACHE_FILENAME,
  QUALITY_EXEMPT_THRESHOLD,
  QUALITY_STATE_FILENAME,
} from '../../src/lib/step10_partition_cache.js';

// ============================================================================
// Pure Function Tests
// ============================================================================

describe('computeFilesHash', () => {
  test('returns 8-char hex string', () => {
    const hash = computeFilesHash(['a.js', 'b.js']);
    expect(hash).toMatch(/^[0-9a-f]{8}$/);
  });

  test('is deterministic', () => {
    const files = ['src/core/a.js', 'src/utils/b.js'];
    expect(computeFilesHash(files)).toBe(computeFilesHash(files));
  });

  test('is order-independent (sorts internally)', () => {
    expect(computeFilesHash(['b.js', 'a.js'])).toBe(computeFilesHash(['a.js', 'b.js']));
  });

  test('differs for different file sets', () => {
    expect(computeFilesHash(['a.js'])).not.toBe(computeFilesHash(['b.js']));
  });

  test('handles empty array', () => {
    const hash = computeFilesHash([]);
    expect(hash).toMatch(/^[0-9a-f]{8}$/);
  });
});

describe('groupFilesByDirectory', () => {
  test('groups by top-two path segments', () => {
    const files = ['src/core/a.js', 'src/core/b.js', 'src/utils/c.js'];
    const groups = groupFilesByDirectory(files);
    expect(groups['src/core']).toEqual(['src/core/a.js', 'src/core/b.js']);
    expect(groups['src/utils']).toEqual(['src/utils/c.js']);
  });

  test('uses single segment for top-level dirs', () => {
    const files = ['__tests__/a.test.js', '__tests__/b.test.js'];
    const groups = groupFilesByDirectory(files);
    expect(groups['__tests__']).toEqual(files);
  });

  test('uses single segment for root-level files', () => {
    const files = ['eslint.config.js', 'vite.config.js'];
    const groups = groupFilesByDirectory(files);
    expect(groups['eslint.config.js']).toEqual(['eslint.config.js']);
    expect(groups['vite.config.js']).toEqual(['vite.config.js']);
  });

  test('returns empty object for empty input', () => {
    expect(groupFilesByDirectory([])).toEqual({});
  });
});

describe('buildPartitions', () => {
  const sampleGroups = {
    'src/core': ['src/core/a.js', 'src/core/b.js'],
    'src/utils': ['src/utils/c.js', 'src/utils/d.js', 'src/utils/e.js'],
    __tests__: ['__tests__/a.test.js'],
  };

  test('all files appear exactly once', () => {
    const partitions = buildPartitions(sampleGroups, 50);
    const allFiles = partitions.flatMap((p) => p.files);
    const originalFiles = Object.values(sampleGroups).flat();
    expect(allFiles.sort()).toEqual(originalFiles.sort());
  });

  test('no partition exceeds maxSize', () => {
    const partitions = buildPartitions(sampleGroups, 3);
    for (const p of partitions) {
      expect(p.files.length).toBeLessThanOrEqual(3);
    }
  });

  test('groups are kept together when they fit', () => {
    const partitions = buildPartitions(sampleGroups, 50);
    // With size 50, everything fits in one partition
    expect(partitions).toHaveLength(1);
    expect(partitions[0].label).toContain('src/core');
  });

  test('splits large groups across partitions', () => {
    const bigGroup = { 'src/big': Array.from({ length: 10 }, (_, i) => `src/big/f${i}.js`) };
    const partitions = buildPartitions(bigGroup, 3);
    for (const p of partitions) {
      expect(p.files.length).toBeLessThanOrEqual(3);
    }
    const totalFiles = partitions.flatMap((p) => p.files).length;
    expect(totalFiles).toBe(10);
  });

  test('returns empty array for empty groups', () => {
    expect(buildPartitions({}, 50)).toEqual([]);
  });

  test('each partition has a label string', () => {
    const partitions = buildPartitions(sampleGroups, 2);
    for (const p of partitions) {
      expect(typeof p.label).toBe('string');
      expect(p.label.length).toBeGreaterThan(0);
    }
  });
});

describe('selectPartition', () => {
  const partitions = [
    { label: 'src/core', files: ['a.js'] },
    { label: 'src/utils', files: ['b.js'] },
    { label: '__tests__', files: ['c.js'] },
  ];

  test('selects correct partition by index', () => {
    const result = selectPartition(partitions, 1);
    expect(result.label).toBe('src/utils');
    expect(result.files).toEqual(['b.js']);
    expect(result.index).toBe(1);
    expect(result.total).toBe(3);
  });

  test('wraps around when index exceeds total', () => {
    const result = selectPartition(partitions, 5); // 5 % 3 = 2
    expect(result.index).toBe(2);
    expect(result.label).toBe('__tests__');
  });

  test('handles index 0', () => {
    expect(selectPartition(partitions, 0).label).toBe('src/core');
  });

  test('handles empty partitions', () => {
    const result = selectPartition([], 0);
    expect(result.files).toEqual([]);
    expect(result.total).toBe(0);
  });
});

describe('nextPartitionIndex', () => {
  test('increments by 1', () => {
    expect(nextPartitionIndex(0, 3)).toBe(1);
    expect(nextPartitionIndex(1, 3)).toBe(2);
  });

  test('wraps around to 0', () => {
    expect(nextPartitionIndex(2, 3)).toBe(0);
  });

  test('returns 0 when total is 0', () => {
    expect(nextPartitionIndex(0, 0)).toBe(0);
  });
});

describe('createCacheEntry', () => {
  const partitions = [
    { label: 'src/core', files: ['a.js'] },
    { label: 'src/utils', files: ['b.js'] },
  ];

  test('creates valid entry structure', () => {
    const entry = createCacheEntry(1, partitions, 'abc12345', 1000000);
    expect(entry.version).toBe(CACHE_VERSION);
    expect(entry.partitionIndex).toBe(1);
    expect(entry.totalPartitions).toBe(2);
    expect(entry.filesHash).toBe('abc12345');
    expect(entry.partitionLabels).toEqual(['src/core', 'src/utils']);
    expect(typeof entry.updatedAt).toBe('string');
  });

  test('is deterministic given same inputs', () => {
    const e1 = createCacheEntry(0, partitions, 'hash', 12345);
    const e2 = createCacheEntry(0, partitions, 'hash', 12345);
    expect(e1).toEqual(e2);
  });
});

describe('isCacheValid', () => {
  const validEntry = {
    version: CACHE_VERSION,
    partitionIndex: 0,
    totalPartitions: 3,
    filesHash: 'abc12345',
  };

  test('returns true for a valid matching entry', () => {
    expect(isCacheValid(validEntry, 'abc12345')).toBe(true);
  });

  test('returns false when filesHash differs', () => {
    expect(isCacheValid(validEntry, 'different')).toBe(false);
  });

  test('returns false for wrong version', () => {
    expect(isCacheValid({ ...validEntry, version: 99 }, 'abc12345')).toBe(false);
  });

  test('returns false for null entry', () => {
    expect(isCacheValid(null, 'abc12345')).toBe(false);
  });

  test('returns false for non-integer partitionIndex', () => {
    expect(isCacheValid({ ...validEntry, partitionIndex: 'bad' }, 'abc12345')).toBe(false);
  });

  test('returns false for zero totalPartitions', () => {
    expect(isCacheValid({ ...validEntry, totalPartitions: 0 }, 'abc12345')).toBe(false);
  });
});

// ============================================================================
// Wrapper Class Integration Tests
// ============================================================================

describe('Step10PartitionCache', () => {
  let tmpDir;
  const sampleFiles = [
    'src/core/a.js',
    'src/core/b.js',
    'src/utils/c.js',
    'src/utils/d.js',
    '__tests__/e.test.js',
  ];

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'step10-test-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  test('constructs with default options', () => {
    const cache = new Step10PartitionCache();
    expect(cache.maxPartitionSize).toBe(MAX_PARTITION_SIZE);
  });

  test('constructs with custom options', () => {
    const cache = new Step10PartitionCache({ cacheDir: '/tmp/test', maxPartitionSize: 10 });
    expect(cache.maxPartitionSize).toBe(10);
  });

  test('load returns null when file does not exist', async () => {
    const cache = new Step10PartitionCache({ cacheDir: tmpDir });
    const result = await cache.load();
    expect(result).toBeNull();
  });

  test('save persists and load retrieves entry', async () => {
    const cache = new Step10PartitionCache({ cacheDir: tmpDir });
    const entry = {
      version: CACHE_VERSION,
      partitionIndex: 1,
      totalPartitions: 3,
      filesHash: 'aabbccdd',
      partitionLabels: [],
      updatedAt: new Date().toISOString(),
    };
    await cache.save(entry);
    const loaded = await cache.load();
    expect(loaded).toEqual(entry);
  });

  test('getCurrentPartition returns a partition with files', async () => {
    const cache = new Step10PartitionCache({ cacheDir: tmpDir, maxPartitionSize: 50 });
    const result = await cache.getCurrentPartition(sampleFiles);
    expect(result.files.length).toBeGreaterThan(0);
    expect(result.total).toBeGreaterThan(0);
    expect(typeof result.label).toBe('string');
  });

  test('getCurrentPartition starts at index 0 with no prior state', async () => {
    const cache = new Step10PartitionCache({ cacheDir: tmpDir, maxPartitionSize: 2 });
    const result = await cache.getCurrentPartition(sampleFiles);
    expect(result.index).toBe(0);
  });

  test('getCurrentPartition reuses cached index on same file set', async () => {
    const cache = new Step10PartitionCache({ cacheDir: tmpDir, maxPartitionSize: 2 });
    const r1 = await cache.getCurrentPartition(sampleFiles);
    await cache.advance(sampleFiles); // advance to 1
    const r2 = await cache.getCurrentPartition(sampleFiles);
    expect(r2.index).toBe(1);
    expect(r2.index).not.toBe(r1.index);
  });

  test('getCurrentPartition resets to 0 when file set changes', async () => {
    const cache = new Step10PartitionCache({ cacheDir: tmpDir, maxPartitionSize: 2 });
    await cache.getCurrentPartition(sampleFiles);
    await cache.advance(sampleFiles); // now at 1
    // Different file set
    const result = await cache.getCurrentPartition(['other/a.js', 'other/b.js']);
    expect(result.index).toBe(0);
  });

  test('advance increments the stored index', async () => {
    const cache = new Step10PartitionCache({ cacheDir: tmpDir, maxPartitionSize: 2 });
    await cache.getCurrentPartition(sampleFiles);
    const newIdx = await cache.advance(sampleFiles);
    expect(newIdx).toBe(1);
    // Verify it persisted
    const loaded = await cache.load();
    expect(loaded.partitionIndex).toBe(1);
  });

  test('advance wraps around when at last partition', async () => {
    const cache = new Step10PartitionCache({ cacheDir: tmpDir, maxPartitionSize: 50 });
    // With maxPartitionSize=50, all 5 files fit in 1 partition
    await cache.getCurrentPartition(sampleFiles); // sets index=0
    const newIdx = await cache.advance(sampleFiles); // 0 → 0 (wraps, only 1 partition)
    expect(newIdx).toBe(0);
  });

  test('state file is created in cacheDir with correct filename', async () => {
    const cache = new Step10PartitionCache({ cacheDir: tmpDir });
    await cache.getCurrentPartition(sampleFiles);
    const filePath = path.join(tmpDir, CACHE_FILENAME);
    const stat = await fs.stat(filePath);
    expect(stat.isFile()).toBe(true);
  });

  test('handles corrupt state file gracefully (falls back to index 0)', async () => {
    const cache = new Step10PartitionCache({ cacheDir: tmpDir });
    await fs.mkdir(tmpDir, { recursive: true });
    await fs.writeFile(path.join(tmpDir, CACHE_FILENAME), 'NOT_JSON', 'utf8');
    const result = await cache.getCurrentPartition(sampleFiles);
    expect(result.index).toBe(0);
  });
});

// ============================================================================
// Quality-Tracking Pure Function Tests
// ============================================================================

describe('scoreFromIssueCount', () => {
  test('0 issues → 100 (perfect score)', () => {
    expect(scoreFromIssueCount(0)).toBe(100);
  });

  test('1 issue → 97', () => {
    expect(scoreFromIssueCount(1)).toBe(97);
  });

  test('2 issues → 94', () => {
    expect(scoreFromIssueCount(2)).toBe(94);
  });

  test('33+ issues → 0 (floor at 0)', () => {
    expect(scoreFromIssueCount(34)).toBe(0);
    expect(scoreFromIssueCount(100)).toBe(0);
  });

  test('negative input → 0', () => {
    expect(scoreFromIssueCount(-1)).toBe(0);
  });

  test('non-number → 0', () => {
    expect(scoreFromIssueCount('abc')).toBe(0);
    expect(scoreFromIssueCount(null)).toBe(0);
  });
});

describe('isFileExempt', () => {
  test('score > threshold and not recently modified → exempt', () => {
    expect(isFileExempt(96, 'src/foo.js', [])).toBe(true);
    expect(isFileExempt(100, 'src/foo.js', [])).toBe(true);
  });

  test('score exactly at threshold (95) → not exempt', () => {
    expect(isFileExempt(95, 'src/foo.js', [])).toBe(false);
  });

  test('score below threshold → not exempt', () => {
    expect(isFileExempt(80, 'src/foo.js', [])).toBe(false);
    expect(isFileExempt(0, 'src/foo.js', [])).toBe(false);
  });

  test('score > threshold but recently modified → NOT exempt (back in rotation)', () => {
    expect(isFileExempt(100, 'src/foo.js', ['src/foo.js'])).toBe(false);
  });

  test('undefined score → not exempt (never reviewed)', () => {
    expect(isFileExempt(undefined, 'src/foo.js', [])).toBe(false);
  });
});

describe('sortByPriority', () => {
  const scores = {
    'src/bad.js': { score: 50 },
    'src/good.js': { score: 97 },
    'src/ok.js': { score: 80 },
  };

  test('recently modified files come first', () => {
    const files = ['src/bad.js', 'src/good.js', 'src/ok.js'];
    const sorted = sortByPriority(files, scores, ['src/good.js']);
    expect(sorted[0]).toBe('src/good.js');
  });

  test('within non-modified: lowest quality score first', () => {
    const files = ['src/ok.js', 'src/bad.js', 'src/good.js'];
    const sorted = sortByPriority(files, scores, []);
    expect(sorted[0]).toBe('src/bad.js'); // score 50 (worst)
    expect(sorted[1]).toBe('src/ok.js');  // score 80
    expect(sorted[2]).toBe('src/good.js'); // score 97
  });

  test('unreviewed files (no score) come before reviewed', () => {
    const files = ['src/reviewed.js', 'src/new.js'];
    const s = { 'src/reviewed.js': { score: 60 } };
    const sorted = sortByPriority(files, s, []);
    expect(sorted[0]).toBe('src/new.js');
  });
});

describe('filterAndPrioritize', () => {
  const scores = {
    'src/clean.js': { score: 100 },
    'src/dirty.js': { score: 50 },
    'src/mid.js': { score: 90 },
  };

  test('exempt files are excluded when not modified', () => {
    const files = ['src/clean.js', 'src/dirty.js', 'src/mid.js'];
    const candidates = filterAndPrioritize(files, scores, []);
    expect(candidates).not.toContain('src/clean.js'); // score 100 > 95 → exempt
    expect(candidates).toContain('src/dirty.js');
    expect(candidates).toContain('src/mid.js');
  });

  test('modified exempt files re-enter rotation at top', () => {
    const files = ['src/clean.js', 'src/dirty.js'];
    const candidates = filterAndPrioritize(files, scores, ['src/clean.js']);
    expect(candidates[0]).toBe('src/clean.js'); // modified → first
    expect(candidates).toContain('src/dirty.js');
  });

  test('empty file list returns empty array', () => {
    expect(filterAndPrioritize([], scores, [])).toEqual([]);
  });
});

describe('mergeFileScores', () => {
  test('adds new scores for reviewed files', () => {
    const result = mergeFileScores({}, { 'src/a.js': 0 }, ['src/a.js'], 1000);
    expect(result['src/a.js'].score).toBe(100);
    expect(result['src/a.js'].issueCount).toBe(0);
    expect(result['src/a.js'].lastAnalyzed).toBeDefined();
  });

  test('updates existing scores', () => {
    const current = { 'src/a.js': { score: 50, issueCount: 10, lastAnalyzed: '2025-01-01T00:00:00.000Z' } };
    const result = mergeFileScores(current, { 'src/a.js': 2 }, ['src/a.js'], 2000);
    expect(result['src/a.js'].score).toBe(94); // 100 - 2*3
    expect(result['src/a.js'].issueCount).toBe(2);
  });

  test('files not in reviewedFiles but in newIssues are not updated', () => {
    const result = mergeFileScores({}, { 'src/a.js': 5 }, ['src/b.js'], 1000);
    expect(result['src/a.js']).toBeUndefined();
    expect(result['src/b.js'].score).toBe(100); // 0 issues (not in newIssues)
  });

  test('preserves scores for files not in this review run', () => {
    const current = { 'src/old.js': { score: 70 } };
    const result = mergeFileScores(current, {}, ['src/new.js'], 1000);
    expect(result['src/old.js'].score).toBe(70); // unchanged
    expect(result['src/new.js']).toBeDefined();
  });
});

describe('createQualityState', () => {
  test('creates state with version 1', () => {
    const state = createQualityState({ 'src/a.js': { score: 80 } });
    expect(state.version).toBe(1);
    expect(state.fileScores['src/a.js'].score).toBe(80);
  });

  test('defaults to empty fileScores', () => {
    const state = createQualityState();
    expect(state.fileScores).toEqual({});
  });
});

// ============================================================================
// Step10PartitionCache quality method integration tests
// ============================================================================

describe('Step10PartitionCache quality methods', () => {
  let tmpDir;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'step10-quality-test-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  test('loadQualityState returns empty state when file missing', async () => {
    const cache = new Step10PartitionCache({ cacheDir: tmpDir });
    const state = await cache.loadQualityState();
    expect(state.version).toBe(1);
    expect(state.fileScores).toEqual({});
  });

  test('saveQualityState persists state and loadQualityState reads it back', async () => {
    const cache = new Step10PartitionCache({ cacheDir: tmpDir });
    const state = createQualityState({ 'src/a.js': { score: 80, issueCount: 7, lastAnalyzed: '2026-01-01T00:00:00.000Z' } });
    await cache.saveQualityState(state);

    const loaded = await cache.loadQualityState();
    expect(loaded.fileScores['src/a.js'].score).toBe(80);
  });

  test('getActiveCandidates excludes high-quality files not recently modified', async () => {
    const cache = new Step10PartitionCache({ cacheDir: tmpDir });
    // Pre-seed quality state
    await cache.saveQualityState(createQualityState({
      'src/clean.js': { score: 100, issueCount: 0, lastAnalyzed: '2026-01-01T00:00:00.000Z' },
      'src/dirty.js': { score: 50,  issueCount: 10, lastAnalyzed: '2026-01-01T00:00:00.000Z' },
    }));

    const candidates = await cache.getActiveCandidates(
      ['src/clean.js', 'src/dirty.js'],
      []
    );
    expect(candidates).not.toContain('src/clean.js'); // exempt
    expect(candidates).toContain('src/dirty.js');
  });

  test('getActiveCandidates re-includes modified exempt files', async () => {
    const cache = new Step10PartitionCache({ cacheDir: tmpDir });
    await cache.saveQualityState(createQualityState({
      'src/clean.js': { score: 100, issueCount: 0, lastAnalyzed: '2026-01-01T00:00:00.000Z' },
    }));

    const candidates = await cache.getActiveCandidates(
      ['src/clean.js', 'src/other.js'],
      ['src/clean.js'] // recently modified → back in rotation
    );
    expect(candidates).toContain('src/clean.js');
  });

  test('updateQualityScores persists per-file scores', async () => {
    const cache = new Step10PartitionCache({ cacheDir: tmpDir });
    await cache.updateQualityScores({ 'src/a.js': 3, 'src/b.js': 0 }, ['src/a.js', 'src/b.js']);

    const state = await cache.loadQualityState();
    expect(state.fileScores['src/a.js'].score).toBe(91); // 100 - 3*3
    expect(state.fileScores['src/b.js'].score).toBe(100);
  });

  test('QUALITY_EXEMPT_THRESHOLD is ' + QUALITY_EXEMPT_THRESHOLD, () => {
    expect(QUALITY_EXEMPT_THRESHOLD).toBe(95);
  });

  test('QUALITY_STATE_FILENAME is ' + QUALITY_STATE_FILENAME, () => {
    expect(QUALITY_STATE_FILENAME).toBe('step_10_quality.json');
  });
});
