/**
 * Tests for File Operations Module
 * @version 2.0.0
 * Part of: AI Workflow Automation v1.1.0
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import {
  validatePath,
  filterByExtension,
  filterByPattern,
  sortByModificationTime,
  buildFileMetadata,
  calculateRelativePath,
  FileOperations,
} from '../../src/lib/file_operations.js';
import { FileSystemError } from '../../src/utils/errors.js';

/**
 * PURE FUNCTION TESTS - Deterministic, no I/O
 */

describe('Pure Functions - validatePath', () => {
  test('accepts valid absolute paths', () => {
    expect(validatePath('/home/user/file.txt')).toEqual({ valid: true });
    expect(validatePath('/var/log/app.log')).toEqual({ valid: true });
  });

  test('rejects relative paths', () => {
    const result = validatePath('relative/path.txt');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('absolute');
  });

  test('rejects directory traversal', () => {
    const result = validatePath('/home/user/../etc/passwd');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('traversal');
  });

  test('rejects empty or invalid paths', () => {
    expect(validatePath('').valid).toBe(false);
    expect(validatePath(null).valid).toBe(false);
    expect(validatePath(undefined).valid).toBe(false);
    expect(validatePath(123).valid).toBe(false);
  });

  test('normalizes paths before validation', () => {
    expect(validatePath('/home/user/./file.txt')).toEqual({ valid: true });
  });
});

describe('Pure Functions - filterByExtension', () => {
  const files = [
    '/path/to/file1.js',
    '/path/to/file2.json',
    '/path/to/file3.txt',
    '/path/to/file4.js',
    '/path/to/file5.md',
  ];

  test('filters files by single extension', () => {
    const result = filterByExtension(files, ['.js']);
    expect(result).toHaveLength(2);
    expect(result).toEqual(['/path/to/file1.js', '/path/to/file4.js']);
  });

  test('filters files by multiple extensions', () => {
    const result = filterByExtension(files, ['.js', '.json']);
    expect(result).toHaveLength(3);
    expect(result).toContain('/path/to/file1.js');
    expect(result).toContain('/path/to/file2.json');
  });

  test('handles extensions without leading dot', () => {
    const result = filterByExtension(files, ['js', 'md']);
    expect(result).toHaveLength(3);
    expect(result).toContain('/path/to/file5.md');
  });

  test('returns empty array for invalid input', () => {
    expect(filterByExtension(null, ['.js'])).toEqual([]);
    expect(filterByExtension(files, null)).toEqual([]);
    expect(filterByExtension('not-array', ['.js'])).toEqual([]);
  });

  test('returns empty array when no files match', () => {
    const result = filterByExtension(files, ['.py']);
    expect(result).toEqual([]);
  });
});

describe('Pure Functions - filterByPattern', () => {
  const files = [
    '/path/to/test_file.js',
    '/path/to/main.js',
    '/path/to/test_helper.js',
    '/path/to/utils.js',
  ];

  test('filters files by regex pattern', () => {
    const result = filterByPattern(files, /test_/);
    expect(result).toHaveLength(2);
    expect(result).toContain('/path/to/test_file.js');
    expect(result).toContain('/path/to/test_helper.js');
  });

  test('filters files by string pattern', () => {
    const result = filterByPattern(files, 'main');
    expect(result).toHaveLength(1);
    expect(result).toEqual(['/path/to/main.js']);
  });

  test('returns empty array for invalid input', () => {
    expect(filterByPattern(null, /test/)).toEqual([]);
    expect(filterByPattern('not-array', /test/)).toEqual([]);
  });

  test('returns all files if pattern matches all', () => {
    const result = filterByPattern(files, /\.js$/);
    expect(result).toHaveLength(4);
  });
});

describe('Pure Functions - sortByModificationTime', () => {
  const now = new Date('2026-01-30T00:00:00Z');
  const oneHourAgo = new Date('2026-01-29T23:00:00Z');
  const twoDaysAgo = new Date('2026-01-28T00:00:00Z');

  const files = [
    { path: '/file1.txt', mtime: now },
    { path: '/file2.txt', mtime: twoDaysAgo },
    { path: '/file3.txt', mtime: oneHourAgo },
  ];

  test('sorts files ascending (oldest first)', () => {
    const result = sortByModificationTime(files, true);
    expect(result[0].path).toBe('/file2.txt');
    expect(result[1].path).toBe('/file3.txt');
    expect(result[2].path).toBe('/file1.txt');
  });

  test('sorts files descending (newest first)', () => {
    const result = sortByModificationTime(files, false);
    expect(result[0].path).toBe('/file1.txt');
    expect(result[1].path).toBe('/file3.txt');
    expect(result[2].path).toBe('/file2.txt');
  });

  test('does not mutate original array', () => {
    const original = [...files];
    sortByModificationTime(files, true);
    expect(files).toEqual(original);
  });

  test('handles invalid input gracefully', () => {
    expect(sortByModificationTime(null, true)).toEqual([]);
    expect(sortByModificationTime('not-array', true)).toEqual([]);
  });

  test('handles files with invalid mtime', () => {
    const filesWithInvalid = [
      { path: '/file1.txt', mtime: now },
      { path: '/file2.txt', mtime: 'invalid' },
      { path: '/file3.txt', mtime: null },
    ];
    const result = sortByModificationTime(filesWithInvalid, true);
    expect(result).toHaveLength(3);
  });
});

describe('Pure Functions - buildFileMetadata', () => {
  test('builds complete metadata object', () => {
    const mockStats = {
      size: 1024,
      isFile: () => true,
      isDirectory: () => false,
      isSymbolicLink: () => false,
      birthtime: new Date('2026-01-01'),
      mtime: new Date('2026-01-30'),
      atime: new Date('2026-01-30'),
    };

    const metadata = buildFileMetadata('/path/to/file.txt', mockStats);

    expect(metadata).toEqual({
      path: '/path/to/file.txt',
      size: 1024,
      isFile: true,
      isDirectory: false,
      isSymbolicLink: false,
      created: mockStats.birthtime,
      modified: mockStats.mtime,
      accessed: mockStats.atime,
    });
  });

  test('handles directory stats', () => {
    const mockStats = {
      size: 4096,
      isFile: () => false,
      isDirectory: () => true,
      isSymbolicLink: () => false,
      birthtime: new Date('2026-01-01'),
      mtime: new Date('2026-01-30'),
      atime: new Date('2026-01-30'),
    };

    const metadata = buildFileMetadata('/path/to/dir', mockStats);
    expect(metadata.isDirectory).toBe(true);
    expect(metadata.isFile).toBe(false);
  });
});

describe('Pure Functions - calculateRelativePath', () => {
  test('calculates relative path correctly', () => {
    const result = calculateRelativePath('/home/user/project', '/home/user/project/src/index.js');
    expect(result).toBe('src/index.js');
  });

  test('handles paths at same level', () => {
    const result = calculateRelativePath('/home/user/project', '/home/user/other');
    expect(result).toBe('../other');
  });

  test('handles identical paths', () => {
    const result = calculateRelativePath('/home/user/project', '/home/user/project');
    expect(result).toBe('');
  });
});

/**
 * INTEGRATION TESTS - Real file I/O
 */

describe('FileOperations Integration Tests', () => {
  let tempDir;
  let fileOps;

  beforeEach(async () => {
    // Create temporary directory for testing
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fileops-test-'));
    fileOps = new FileOperations({ verbose: false });
  });

  afterEach(async () => {
    // Clean up temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('readFile and writeFile', () => {
    test('writes and reads file successfully', async () => {
      const filePath = path.join(tempDir, 'test.txt');
      const content = 'Hello, World!';

      await fileOps.writeFile(filePath, content);
      const readContent = await fileOps.readFile(filePath);

      expect(readContent).toBe(content);
    });

    test('creates parent directories automatically', async () => {
      const filePath = path.join(tempDir, 'nested', 'deep', 'file.txt');
      await fileOps.writeFile(filePath, 'content');

      expect(await fileOps.exists(filePath)).toBe(true);
    });

    test('throws error for invalid path on read', async () => {
      await expect(fileOps.readFile('relative/path.txt')).rejects.toThrow(FileSystemError);
    });

    test('throws error for non-existent file', async () => {
      const filePath = path.join(tempDir, 'nonexistent.txt');
      await expect(fileOps.readFile(filePath)).rejects.toThrow(FileSystemError);
    });

    test('handles dry-run mode for write', async () => {
      const dryRunOps = new FileOperations({ dryRun: true });
      const filePath = path.join(tempDir, 'dryrun.txt');

      await dryRunOps.writeFile(filePath, 'content');

      expect(await fileOps.exists(filePath)).toBe(false);
    });
  });

  describe('exists and stat', () => {
    test('exists returns true for existing file', async () => {
      const filePath = path.join(tempDir, 'exists.txt');
      await fileOps.writeFile(filePath, 'content');

      expect(await fileOps.exists(filePath)).toBe(true);
    });

    test('exists returns false for non-existent file', async () => {
      const filePath = path.join(tempDir, 'nonexistent.txt');
      expect(await fileOps.exists(filePath)).toBe(false);
    });

    test('stat returns file metadata', async () => {
      const filePath = path.join(tempDir, 'stat.txt');
      const content = 'test content';
      await fileOps.writeFile(filePath, content);

      const metadata = await fileOps.stat(filePath);

      expect(metadata.path).toBe(filePath);
      expect(metadata.size).toBe(content.length);
      expect(metadata.isFile).toBe(true);
      expect(metadata.isDirectory).toBe(false);
      expect(metadata.modified).toBeTruthy();
      expect(metadata.created).toBeTruthy();
      expect(metadata.accessed).toBeTruthy();
    });

    test('stat throws error for non-existent file', async () => {
      const filePath = path.join(tempDir, 'nonexistent.txt');
      await expect(fileOps.stat(filePath)).rejects.toThrow(FileSystemError);
    });
  });

  describe('listDirectory', () => {
    beforeEach(async () => {
      // Create test files
      await fileOps.writeFile(path.join(tempDir, 'file1.js'), 'content');
      await fileOps.writeFile(path.join(tempDir, 'file2.json'), 'content');
      await fileOps.writeFile(path.join(tempDir, 'file3.txt'), 'content');
      await fileOps.writeFile(path.join(tempDir, 'test_file.js'), 'content');
    });

    test('lists all files in directory', async () => {
      const files = await fileOps.listDirectory(tempDir);
      expect(files).toHaveLength(4);
    });

    test('filters by extension', async () => {
      const files = await fileOps.listDirectory(tempDir, { extensions: ['.js'] });
      expect(files).toHaveLength(2);
      expect(files.every((f) => f.endsWith('.js'))).toBe(true);
    });

    test('filters by pattern', async () => {
      const files = await fileOps.listDirectory(tempDir, { pattern: /test_/ });
      expect(files).toHaveLength(1);
      expect(files[0]).toContain('test_file.js');
    });

    test('throws error for non-existent directory', async () => {
      const dirPath = path.join(tempDir, 'nonexistent');
      await expect(fileOps.listDirectory(dirPath)).rejects.toThrow(FileSystemError);
    });
  });

  describe('listDirectoryRecursive', () => {
    beforeEach(async () => {
      // Create nested structure
      await fileOps.writeFile(path.join(tempDir, 'root.js'), 'content');
      await fileOps.writeFile(path.join(tempDir, 'nested', 'file1.js'), 'content');
      await fileOps.writeFile(path.join(tempDir, 'nested', 'deep', 'file2.js'), 'content');
      await fileOps.writeFile(path.join(tempDir, 'other', 'file3.txt'), 'content');
    });

    test('lists all files recursively', async () => {
      const files = await fileOps.listDirectoryRecursive(tempDir);
      expect(files.length).toBeGreaterThanOrEqual(4);
    });

    test('filters by extension recursively', async () => {
      const files = await fileOps.listDirectoryRecursive(tempDir, { extensions: ['.js'] });
      expect(files).toHaveLength(3);
      expect(files.every((f) => f.endsWith('.js'))).toBe(true);
    });

    test('includes directories when requested', async () => {
      const entries = await fileOps.listDirectoryRecursive(tempDir, {
        includeDirectories: true,
      });
      expect(entries.length).toBeGreaterThan(4);
    });

    test('excludes specified directories', async () => {
      await fileOps.writeFile(path.join(tempDir, 'node_modules', 'pkg', 'index.js'), 'content');
      const files = await fileOps.listDirectoryRecursive(tempDir, { exclude: ['node_modules'] });
      expect(files.every((f) => !f.includes('node_modules'))).toBe(true);
    });
  });

  describe('copyFile', () => {
    test('copies file successfully', async () => {
      const sourcePath = path.join(tempDir, 'source.txt');
      const destPath = path.join(tempDir, 'dest.txt');
      const content = 'copy me';

      await fileOps.writeFile(sourcePath, content);
      await fileOps.copyFile(sourcePath, destPath);

      expect(await fileOps.exists(destPath)).toBe(true);
      expect(await fileOps.readFile(destPath)).toBe(content);
      expect(await fileOps.exists(sourcePath)).toBe(true); // Original still exists
    });

    test('creates destination directory if needed', async () => {
      const sourcePath = path.join(tempDir, 'source.txt');
      const destPath = path.join(tempDir, 'nested', 'dest.txt');

      await fileOps.writeFile(sourcePath, 'content');
      await fileOps.copyFile(sourcePath, destPath);

      expect(await fileOps.exists(destPath)).toBe(true);
    });

    test('handles dry-run mode', async () => {
      const dryRunOps = new FileOperations({ dryRun: true });
      const sourcePath = path.join(tempDir, 'source.txt');
      const destPath = path.join(tempDir, 'dest.txt');

      await fileOps.writeFile(sourcePath, 'content');
      await dryRunOps.copyFile(sourcePath, destPath);

      expect(await fileOps.exists(destPath)).toBe(false);
    });
  });

  describe('moveFile', () => {
    test('moves file successfully', async () => {
      const sourcePath = path.join(tempDir, 'source.txt');
      const destPath = path.join(tempDir, 'dest.txt');
      const content = 'move me';

      await fileOps.writeFile(sourcePath, content);
      await fileOps.moveFile(sourcePath, destPath);

      expect(await fileOps.exists(destPath)).toBe(true);
      expect(await fileOps.readFile(destPath)).toBe(content);
      expect(await fileOps.exists(sourcePath)).toBe(false); // Original removed
    });

    test('handles dry-run mode', async () => {
      const dryRunOps = new FileOperations({ dryRun: true });
      const sourcePath = path.join(tempDir, 'source.txt');
      const destPath = path.join(tempDir, 'dest.txt');

      await fileOps.writeFile(sourcePath, 'content');
      await dryRunOps.moveFile(sourcePath, destPath);

      expect(await fileOps.exists(sourcePath)).toBe(true);
      expect(await fileOps.exists(destPath)).toBe(false);
    });
  });

  describe('deleteFile', () => {
    test('deletes file successfully', async () => {
      const filePath = path.join(tempDir, 'delete.txt');

      await fileOps.writeFile(filePath, 'content');
      expect(await fileOps.exists(filePath)).toBe(true);

      await fileOps.deleteFile(filePath);
      expect(await fileOps.exists(filePath)).toBe(false);
    });

    test('handles dry-run mode', async () => {
      const dryRunOps = new FileOperations({ dryRun: true });
      const filePath = path.join(tempDir, 'delete.txt');

      await fileOps.writeFile(filePath, 'content');
      await dryRunOps.deleteFile(filePath);

      expect(await fileOps.exists(filePath)).toBe(true);
    });

    test('throws error for non-existent file', async () => {
      const filePath = path.join(tempDir, 'nonexistent.txt');
      await expect(fileOps.deleteFile(filePath)).rejects.toThrow(FileSystemError);
    });
  });

  describe('createDirectory and deleteDirectory', () => {
    test('creates directory successfully', async () => {
      const dirPath = path.join(tempDir, 'newdir');

      await fileOps.createDirectory(dirPath);
      expect(await fileOps.exists(dirPath)).toBe(true);

      const metadata = await fileOps.stat(dirPath);
      expect(metadata.isDirectory).toBe(true);
    });

    test('creates nested directories', async () => {
      const dirPath = path.join(tempDir, 'nested', 'deep', 'dir');

      await fileOps.createDirectory(dirPath);
      expect(await fileOps.exists(dirPath)).toBe(true);
    });

    test('does not throw error if directory exists', async () => {
      const dirPath = path.join(tempDir, 'existing');

      await fileOps.createDirectory(dirPath);
      await expect(fileOps.createDirectory(dirPath)).resolves.not.toThrow();
    });

    test('deletes directory successfully', async () => {
      const dirPath = path.join(tempDir, 'deleteme');

      await fileOps.createDirectory(dirPath);
      await fileOps.writeFile(path.join(dirPath, 'file.txt'), 'content');

      await fileOps.deleteDirectory(dirPath);
      expect(await fileOps.exists(dirPath)).toBe(false);
    });

    test('handles dry-run mode for create', async () => {
      const dryRunOps = new FileOperations({ dryRun: true });
      const dirPath = path.join(tempDir, 'dryrun');

      await dryRunOps.createDirectory(dirPath);
      expect(await fileOps.exists(dirPath)).toBe(false);
    });

    test('handles dry-run mode for delete', async () => {
      const dryRunOps = new FileOperations({ dryRun: true });
      const dirPath = path.join(tempDir, 'keepme');

      await fileOps.createDirectory(dirPath);
      await dryRunOps.deleteDirectory(dirPath);

      expect(await fileOps.exists(dirPath)).toBe(true);
    });
  });
});
