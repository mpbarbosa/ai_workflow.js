// test/scripts/check-version-consistency.test.js

import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// ---------------------------------------------------------------------------
// Mock 'fs' named imports BEFORE importing the module under test
// ---------------------------------------------------------------------------
const mockReadFileSync = jest.fn();
const mockWriteFileSync = jest.fn();
const mockReaddirSync = jest.fn();
const mockStatSync = jest.fn();

jest.unstable_mockModule('fs', () => ({
  readFileSync: mockReadFileSync,
  writeFileSync: mockWriteFileSync,
  readdirSync: mockReaddirSync,
  statSync: mockStatSync,
}));

// Import AFTER mocking
const {
  getPackageVersion,
  findMarkdownFiles,
  extractVersionReferences,
  checkVersionConsistency,
  autoFixInconsistencies,
} = await import('../../scripts/check-version-consistency.js');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeStat({ isDir = false } = {}) {
  return { isDirectory: () => isDir };
}

describe('check-version-consistency.js', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Suppress console output in tests
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  // -------------------------------------------------------------------------
  describe('getPackageVersion', () => {
    it('returns the version string from package.json', () => {
      mockReadFileSync.mockReturnValue(JSON.stringify({ version: '1.2.3' }));
      expect(getPackageVersion()).toBe('1.2.3');
    });

    it('throws if readFileSync fails', () => {
      mockReadFileSync.mockImplementation(() => { throw new Error('ENOENT'); });
      expect(() => getPackageVersion()).toThrow(/Failed to read package\.json/);
    });

    it('throws if package.json contains invalid JSON', () => {
      mockReadFileSync.mockReturnValue('not-json');
      expect(() => getPackageVersion()).toThrow(/Failed to read package\.json/);
    });
  });

  // -------------------------------------------------------------------------
  describe('findMarkdownFiles', () => {
    it('returns markdown files found recursively', () => {
      mockReaddirSync.mockImplementation((dir) => {
        if (dir.endsWith('root')) return ['a.md', 'sub', 'b.txt'];
        if (dir.endsWith('sub')) return ['c.md'];
        return [];
      });
      mockStatSync.mockImplementation((p) => makeStat({ isDir: p.endsWith('sub') }));

      const files = findMarkdownFiles('/root');
      expect(files.some((f) => f.endsWith('a.md'))).toBe(true);
      expect(files.some((f) => f.endsWith('c.md'))).toBe(true);
      expect(files.every((f) => f.endsWith('.md'))).toBe(true);
    });

    it('skips node_modules and hidden directories', () => {
      mockReaddirSync.mockReturnValue(['.git', 'node_modules', 'readme.md']);
      mockStatSync.mockImplementation((p) =>
        makeStat({ isDir: p.endsWith('.git') || p.endsWith('node_modules') })
      );

      const files = findMarkdownFiles('/root');
      expect(files.length).toBe(1);
      expect(files[0]).toMatch(/readme\.md$/);
    });

    it('returns empty array when directory has no markdown files', () => {
      mockReaddirSync.mockReturnValue(['index.js', 'config.yaml']);
      mockStatSync.mockReturnValue(makeStat({ isDir: false }));
      expect(findMarkdownFiles('/root')).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  describe('extractVersionReferences', () => {
    it('extracts versions matching all supported patterns', () => {
      mockReadFileSync.mockReturnValue(
        'Version: 1.2.3\nversion: v2.0.0\nv3.1.4\n@4.0.0\n[5.6.7]'
      );
      const versions = extractVersionReferences('/fake.md');
      expect(versions.has('1.2.3')).toBe(true);
      expect(versions.has('2.0.0')).toBe(true);
      expect(versions.has('3.1.4')).toBe(true);
      expect(versions.has('4.0.0')).toBe(true);
      expect(versions.has('5.6.7')).toBe(true);
    });

    it('returns empty set when no versions are present', () => {
      mockReadFileSync.mockReturnValue('No versions here at all.');
      expect(extractVersionReferences('/fake.md').size).toBe(0);
    });

    it('deduplicates the same version seen multiple times', () => {
      mockReadFileSync.mockReturnValue('v1.0.0 and v1.0.0 again');
      const versions = extractVersionReferences('/fake.md');
      expect(versions.size).toBe(1);
      expect(versions.has('1.0.0')).toBe(true);
    });

    it('ignores strings that look like versions but are not (e.g. x.y.z)', () => {
      mockReadFileSync.mockReturnValue('Version: not.a.ver');
      expect(extractVersionReferences('/fake.md').size).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  describe('checkVersionConsistency', () => {
    it('returns 0 when all version references match package.json', () => {
      mockReadFileSync.mockReturnValue(JSON.stringify({ version: '1.2.3' }));
      mockReaddirSync.mockReturnValue(['readme.md']);
      mockStatSync.mockReturnValue(makeStat({ isDir: false }));
      // readme.md content consistent with package.json
      mockReadFileSync
        .mockReturnValueOnce(JSON.stringify({ version: '1.2.3' })) // package.json
        .mockReturnValue('Version: 1.2.3');                          // readme.md

      expect(checkVersionConsistency()).toBe(0);
    });

    it('returns 1 when an outdated version is found', () => {
      mockReaddirSync.mockReturnValue(['old.md']);
      mockStatSync.mockReturnValue(makeStat({ isDir: false }));
      mockReadFileSync
        .mockReturnValueOnce(JSON.stringify({ version: '2.0.0' })) // package.json
        .mockReturnValue('Version: 1.0.0');                         // old.md

      expect(checkVersionConsistency()).toBe(1);
    });

    it('returns 0 when no markdown files contain version references', () => {
      mockReaddirSync.mockReturnValue([]);
      mockReadFileSync.mockReturnValue(JSON.stringify({ version: '1.2.3' }));
      expect(checkVersionConsistency()).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  describe('autoFixInconsistencies', () => {
    it('replaces outdated version and marks as fixed', () => {
      mockReadFileSync.mockReturnValue('Version: 2.0.0');
      mockWriteFileSync.mockImplementation(() => {});

      const results = autoFixInconsistencies([{ file: '/f.md', versions: ['2.0.0'] }], '3.0.0');
      expect(results[0].fixed).toBe(true);
      expect(mockWriteFileSync).toHaveBeenCalledWith('/f.md', expect.stringContaining('3.0.0'), 'utf-8');
    });

    it('marks as not-fixed when version string is not found in file', () => {
      mockReadFileSync.mockReturnValue('No version here');
      mockWriteFileSync.mockImplementation(() => {});

      const results = autoFixInconsistencies([{ file: '/f.md', versions: ['9.9.9'] }], '3.0.0');
      expect(results[0].fixed).toBe(false);
      expect(results[0].error).toMatch(/not found in file content/);
    });

    it('records error and marks as not-fixed when writeFileSync throws', () => {
      mockReadFileSync.mockReturnValue('Version: 2.0.0');
      mockWriteFileSync.mockImplementation(() => { throw new Error('disk full'); });

      const results = autoFixInconsistencies([{ file: '/f.md', versions: ['2.0.0'] }], '3.0.0');
      expect(results[0].fixed).toBe(false);
      expect(results[0].error).toMatch(/disk full/);
    });

    it('processes multiple files and returns a result per file', () => {
      mockReadFileSync
        .mockReturnValueOnce('Version: 1.0.0')  // first file — fixable
        .mockReturnValue('nothing');             // second file — not fixable
      mockWriteFileSync.mockImplementation(() => {});

      const inconsistencies = [
        { file: '/a.md', versions: ['1.0.0'] },
        { file: '/b.md', versions: ['1.0.0'] },
      ];
      const results = autoFixInconsistencies(inconsistencies, '2.0.0');
      expect(results).toHaveLength(2);
      expect(results[0].fixed).toBe(true);
      expect(results[1].fixed).toBe(false);
    });
  });
});
