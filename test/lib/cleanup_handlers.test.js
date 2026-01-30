/**
 * Tests for cleanup_handlers.js
 * @description Comprehensive tests for cleanup operations
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import {
  shouldCleanByAge,
  shouldCleanBySize,
  filterByAge,
  filterBySize,
  calculateTotalSize,
  sortByOldest,
  sortByLargest,
  selectFilesForSizeLimit,
  formatDuration,
  formatSize,
  generateCleanupSummary,
  CleanupManager,
} from '../../src/lib/cleanup_handlers.js';

/**
 * PURE FUNCTION TESTS
 */

describe('shouldCleanByAge (pure function)', () => {
  test('returns true when file exceeds max age', () => {
    const fileTime = 1000;
    const currentTime = 10000;
    const maxAge = 5000;
    expect(shouldCleanByAge(fileTime, currentTime, maxAge)).toBe(true);
  });

  test('returns false when file is within max age', () => {
    const fileTime = 8000;
    const currentTime = 10000;
    const maxAge = 5000;
    expect(shouldCleanByAge(fileTime, currentTime, maxAge)).toBe(false);
  });

  test('returns false for invalid inputs', () => {
    expect(shouldCleanByAge('invalid', 1000, 5000)).toBe(false);
    expect(shouldCleanByAge(1000, 'invalid', 5000)).toBe(false);
    expect(shouldCleanByAge(1000, 2000, 'invalid')).toBe(false);
  });

  test('returns false for negative or zero max age', () => {
    expect(shouldCleanByAge(1000, 2000, 0)).toBe(false);
    expect(shouldCleanByAge(1000, 2000, -100)).toBe(false);
  });
});

describe('shouldCleanBySize (pure function)', () => {
  test('returns true when file exceeds max size', () => {
    expect(shouldCleanBySize(1024, 512)).toBe(true);
  });

  test('returns false when file is within max size', () => {
    expect(shouldCleanBySize(512, 1024)).toBe(false);
  });

  test('returns false for invalid inputs', () => {
    expect(shouldCleanBySize('invalid', 1024)).toBe(false);
    expect(shouldCleanBySize(1024, 'invalid')).toBe(false);
  });

  test('returns false for negative or zero max size', () => {
    expect(shouldCleanBySize(1024, 0)).toBe(false);
    expect(shouldCleanBySize(1024, -100)).toBe(false);
  });
});

describe('filterByAge (pure function)', () => {
  test('filters files older than max age', () => {
    const files = [
      { path: 'file1.txt', mtime: 1000 },
      { path: 'file2.txt', mtime: 8000 },
      { path: 'file3.txt', mtime: 2000 },
    ];
    const currentTime = 10000;
    const maxAge = 5000;
    const result = filterByAge(files, currentTime, maxAge);
    expect(result).toHaveLength(2);
    expect(result[0].path).toBe('file1.txt');
    expect(result[1].path).toBe('file3.txt');
  });

  test('handles Date objects for mtime', () => {
    const files = [
      { path: 'file1.txt', mtime: new Date(1000) },
      { path: 'file2.txt', mtime: new Date(8000) },
    ];
    const currentTime = 10000;
    const maxAge = 5000;
    const result = filterByAge(files, currentTime, maxAge);
    expect(result).toHaveLength(1);
    expect(result[0].path).toBe('file1.txt');
  });

  test('returns empty array for non-array input', () => {
    expect(filterByAge(null, 1000, 5000)).toEqual([]);
    expect(filterByAge(undefined, 1000, 5000)).toEqual([]);
    expect(filterByAge('invalid', 1000, 5000)).toEqual([]);
  });

  test('filters out files without mtime', () => {
    const files = [
      { path: 'file1.txt', mtime: 1000 },
      { path: 'file2.txt' }, // No mtime
    ];
    const result = filterByAge(files, 10000, 5000);
    expect(result).toHaveLength(1);
  });
});

describe('filterBySize (pure function)', () => {
  test('filters files larger than max size', () => {
    const files = [
      { path: 'file1.txt', size: 1024 },
      { path: 'file2.txt', size: 512 },
      { path: 'file3.txt', size: 2048 },
    ];
    const result = filterBySize(files, 1000);
    expect(result).toHaveLength(2);
    expect(result[0].path).toBe('file1.txt');
    expect(result[1].path).toBe('file3.txt');
  });

  test('returns empty array for non-array input', () => {
    expect(filterBySize(null, 1024)).toEqual([]);
    expect(filterBySize(undefined, 1024)).toEqual([]);
  });

  test('filters out files without size', () => {
    const files = [
      { path: 'file1.txt', size: 1024 },
      { path: 'file2.txt' }, // No size
    ];
    const result = filterBySize(files, 512);
    expect(result).toHaveLength(1);
  });
});

describe('calculateTotalSize (pure function)', () => {
  test('calculates total size of files', () => {
    const files = [{ size: 100 }, { size: 200 }, { size: 300 }];
    expect(calculateTotalSize(files)).toBe(600);
  });

  test('returns 0 for empty array', () => {
    expect(calculateTotalSize([])).toBe(0);
  });

  test('returns 0 for non-array input', () => {
    expect(calculateTotalSize(null)).toBe(0);
    expect(calculateTotalSize(undefined)).toBe(0);
  });

  test('ignores files without size property', () => {
    const files = [{ size: 100 }, {}, { size: 200 }];
    expect(calculateTotalSize(files)).toBe(300);
  });
});

describe('sortByOldest (pure function)', () => {
  test('sorts files by mtime (oldest first)', () => {
    const files = [
      { path: 'file2.txt', mtime: 3000 },
      { path: 'file1.txt', mtime: 1000 },
      { path: 'file3.txt', mtime: 2000 },
    ];
    const result = sortByOldest(files);
    expect(result[0].path).toBe('file1.txt');
    expect(result[1].path).toBe('file3.txt');
    expect(result[2].path).toBe('file2.txt');
  });

  test('handles Date objects for mtime', () => {
    const files = [
      { path: 'file2.txt', mtime: new Date(3000) },
      { path: 'file1.txt', mtime: new Date(1000) },
    ];
    const result = sortByOldest(files);
    expect(result[0].path).toBe('file1.txt');
  });

  test('does not mutate original array', () => {
    const files = [
      { path: 'file2.txt', mtime: 2000 },
      { path: 'file1.txt', mtime: 1000 },
    ];
    const original = [...files];
    sortByOldest(files);
    expect(files).toEqual(original);
  });

  test('returns empty array for non-array input', () => {
    expect(sortByOldest(null)).toEqual([]);
  });
});

describe('sortByLargest (pure function)', () => {
  test('sorts files by size (largest first)', () => {
    const files = [
      { path: 'file2.txt', size: 200 },
      { path: 'file3.txt', size: 300 },
      { path: 'file1.txt', size: 100 },
    ];
    const result = sortByLargest(files);
    expect(result[0].path).toBe('file3.txt');
    expect(result[1].path).toBe('file2.txt');
    expect(result[2].path).toBe('file1.txt');
  });

  test('does not mutate original array', () => {
    const files = [
      { path: 'file2.txt', size: 200 },
      { path: 'file1.txt', size: 100 },
    ];
    const original = [...files];
    sortByLargest(files);
    expect(files).toEqual(original);
  });

  test('returns empty array for non-array input', () => {
    expect(sortByLargest(null)).toEqual([]);
  });
});

describe('selectFilesForSizeLimit (pure function)', () => {
  test('selects oldest files to meet size limit', () => {
    const files = [
      { path: 'file1.txt', size: 100, mtime: 1000 },
      { path: 'file2.txt', size: 200, mtime: 2000 },
      { path: 'file3.txt', size: 300, mtime: 3000 },
    ];
    const currentSize = 600;
    const targetSize = 300;
    const result = selectFilesForSizeLimit(files, currentSize, targetSize);
    expect(result).toHaveLength(2);
    expect(result[0].path).toBe('file1.txt');
    expect(result[1].path).toBe('file2.txt');
  });

  test('returns empty array when already under limit', () => {
    const files = [{ path: 'file1.txt', size: 100, mtime: 1000 }];
    const result = selectFilesForSizeLimit(files, 100, 200);
    expect(result).toEqual([]);
  });

  test('returns empty array for non-array input', () => {
    expect(selectFilesForSizeLimit(null, 1000, 500)).toEqual([]);
  });
});

describe('formatDuration (pure function)', () => {
  test('formats milliseconds to seconds', () => {
    expect(formatDuration(5000)).toBe('5s');
  });

  test('formats milliseconds to minutes', () => {
    expect(formatDuration(120000)).toBe('2m');
  });

  test('formats milliseconds to hours', () => {
    expect(formatDuration(7200000)).toBe('2h');
  });

  test('formats milliseconds to days', () => {
    expect(formatDuration(86400000)).toBe('1d');
  });

  test('returns 0s for invalid input', () => {
    expect(formatDuration(-100)).toBe('0s');
    expect(formatDuration('invalid')).toBe('0s');
  });
});

describe('formatSize (pure function)', () => {
  test('formats bytes', () => {
    expect(formatSize(500)).toBe('500.0B');
  });

  test('formats kilobytes', () => {
    expect(formatSize(1024)).toBe('1.0KB');
  });

  test('formats megabytes', () => {
    expect(formatSize(1048576)).toBe('1.0MB');
  });

  test('formats gigabytes', () => {
    expect(formatSize(1073741824)).toBe('1.0GB');
  });

  test('returns 0B for invalid input', () => {
    expect(formatSize(-100)).toBe('0B');
    expect(formatSize('invalid')).toBe('0B');
  });
});

describe('generateCleanupSummary (pure function)', () => {
  test('generates cleanup summary', () => {
    const summary = generateCleanupSummary(5, 1024, 1000);
    expect(summary.filesDeleted).toBe(5);
    expect(summary.spaceFreed).toBe(1024);
    expect(summary.duration).toBe(1000);
    expect(summary.spaceFreedFormatted).toBe('1.0KB');
    expect(summary.durationFormatted).toBe('1s');
  });

  test('handles zero values', () => {
    const summary = generateCleanupSummary(0, 0, 0);
    expect(summary.filesDeleted).toBe(0);
    expect(summary.spaceFreed).toBe(0);
    expect(summary.duration).toBe(0);
  });
});

/**
 * INTEGRATION TESTS - CleanupManager class
 */

describe('CleanupManager class', () => {
  let tempDir;
  let cleanupManager;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cleanup-test-'));
    cleanupManager = new CleanupManager({ dryRun: false, verbose: false });
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  test('creates cleanup manager with default options', () => {
    const manager = new CleanupManager();
    expect(manager).toBeInstanceOf(CleanupManager);
    expect(manager.dryRun).toBe(false);
    expect(manager.verbose).toBe(false);
  });

  test('creates cleanup manager with custom options', () => {
    const manager = new CleanupManager({ dryRun: true, verbose: true });
    expect(manager.dryRun).toBe(true);
    expect(manager.verbose).toBe(true);
  });

  test('cleanByAge removes old files', async () => {
    // Create test files
    const file1 = path.join(tempDir, 'old.txt');
    const file2 = path.join(tempDir, 'new.txt');
    await fs.writeFile(file1, 'old content');
    await fs.writeFile(file2, 'new content');

    // Make file1 appear old
    const oldTime = Date.now() - 10000;
    await fs.utimes(file1, new Date(oldTime), new Date(oldTime));

    // Clean files older than 5 seconds
    const summary = await cleanupManager.cleanByAge(tempDir, 5000);

    expect(summary.filesDeleted).toBeGreaterThan(0);
    expect(
      await fs
        .access(file2)
        .then(() => true)
        .catch(() => false)
    ).toBe(true);
  });

  test('cleanBySize removes large files', async () => {
    // Create test files
    const smallFile = path.join(tempDir, 'small.txt');
    const largeFile = path.join(tempDir, 'large.txt');
    await fs.writeFile(smallFile, 'small');
    await fs.writeFile(largeFile, 'x'.repeat(2000));

    // Clean files larger than 1KB
    const summary = await cleanupManager.cleanBySize(tempDir, 1024);

    expect(summary.filesDeleted).toBe(1);
    expect(
      await fs
        .access(smallFile)
        .then(() => true)
        .catch(() => false)
    ).toBe(true);
    expect(
      await fs
        .access(largeFile)
        .then(() => true)
        .catch(() => false)
    ).toBe(false);
  });

  test('cleanToSizeLimit removes oldest files to meet limit', async () => {
    // Create test files
    for (let i = 1; i <= 3; i++) {
      const file = path.join(tempDir, `file${i}.txt`);
      await fs.writeFile(file, 'x'.repeat(100));
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    // Clean to 150 bytes (should remove 2 oldest files)
    const summary = await cleanupManager.cleanToSizeLimit(tempDir, 150);

    expect(summary.filesDeleted).toBeGreaterThan(0);
    expect(summary.spaceFreed).toBeGreaterThan(0);
  });

  test('cleanEmptyDirectories removes empty dirs', async () => {
    // Create empty directory
    const emptyDir = path.join(tempDir, 'empty');
    await fs.mkdir(emptyDir);

    // Create non-empty directory
    const nonEmptyDir = path.join(tempDir, 'nonempty');
    await fs.mkdir(nonEmptyDir);
    await fs.writeFile(path.join(nonEmptyDir, 'file.txt'), 'content');

    const summary = await cleanupManager.cleanEmptyDirectories(tempDir);

    expect(summary.filesDeleted).toBe(1);
    expect(
      await fs
        .access(nonEmptyDir)
        .then(() => true)
        .catch(() => false)
    ).toBe(true);
    expect(
      await fs
        .access(emptyDir)
        .then(() => true)
        .catch(() => false)
    ).toBe(false);
  });

  test('cleanByPattern removes matching files', async () => {
    // Create test files
    await fs.writeFile(path.join(tempDir, 'test.log'), 'log');
    await fs.writeFile(path.join(tempDir, 'test.txt'), 'text');
    await fs.writeFile(path.join(tempDir, 'data.log'), 'log');

    // Clean all .log files
    const summary = await cleanupManager.cleanByPattern(tempDir, /\.log$/);

    expect(summary.filesDeleted).toBe(2);
    expect(
      await fs
        .access(path.join(tempDir, 'test.txt'))
        .then(() => true)
        .catch(() => false)
    ).toBe(true);
  });

  test('dry run mode does not delete files', async () => {
    const dryRunManager = new CleanupManager({ dryRun: true });
    const file = path.join(tempDir, 'test.txt');
    await fs.writeFile(file, 'content');

    const oldTime = Date.now() - 10000;
    await fs.utimes(file, new Date(oldTime), new Date(oldTime));

    const summary = await dryRunManager.cleanByAge(tempDir, 5000);

    expect(summary.filesDeleted).toBe(1);
    // File should still exist in dry run mode
    expect(
      await fs
        .access(file)
        .then(() => true)
        .catch(() => false)
    ).toBe(true);
  });

  test('returns empty summary when no files to clean', async () => {
    const summary = await cleanupManager.cleanByAge(tempDir, 5000);
    expect(summary.filesDeleted).toBe(0);
    expect(summary.spaceFreed).toBe(0);
  });
});
