// test/check-version-consistency.test.js

import fs from 'fs';
import path from 'path';

// Mock fs and path modules
jest.mock('fs');
jest.mock('path');

const {
  getPackageVersion,
  findMarkdownFiles,
  extractVersionReferences,
  checkVersionConsistency,
  autoFixInconsistencies,
} = await import('../scripts/check-version-consistency.js');

describe('check-version-consistency.js', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getPackageVersion', () => {
    it('should return the version from package.json (happy path)', () => {
      fs.readFileSync.mockReturnValue(JSON.stringify({ version: '1.2.3' }));
      path.join.mockReturnValue('/project/package.json');
      expect(getPackageVersion()).toBe('1.2.3');
    });

    it('should throw error if package.json cannot be read', () => {
      fs.readFileSync.mockImplementation(() => { throw new Error('fail'); });
      path.join.mockReturnValue('/project/package.json');
      expect(() => getPackageVersion()).toThrow(/Failed to read package.json/);
    });

    it('should throw error if package.json is invalid JSON', () => {
      fs.readFileSync.mockReturnValue('not-json');
      path.join.mockReturnValue('/project/package.json');
      expect(() => getPackageVersion()).toThrow(/Failed to read package.json/);
    });
  });

  describe('findMarkdownFiles', () => {
    it('should find markdown files recursively (happy path)', () => {
      fs.readdirSync.mockImplementation((dir) => {
        if (dir === '/root') return ['a.md', 'sub', 'b.txt'];
        if (dir === '/root/sub') return ['c.md'];
        return [];
      });
      fs.statSync.mockImplementation((filePath) => ({
        isDirectory: () => filePath.endsWith('sub'),
      }));
      path.join.mockImplementation((...args) => args.join('/'));
      const files = findMarkdownFiles('/root');
      expect(files).toContain('/root/a.md');
      expect(files).toContain('/root/sub/c.md');
      expect(files).not.toContain('/root/b.txt');
    });

    it('should skip node_modules and hidden directories', () => {
      fs.readdirSync.mockReturnValue(['.hidden', 'node_modules', 'file.md']);
      fs.statSync.mockImplementation((filePath) => ({
        isDirectory: () => filePath.endsWith('.hidden') || filePath.endsWith('node_modules'),
      }));
      path.join.mockImplementation((...args) => args.join('/'));
      const files = findMarkdownFiles('/root');
      expect(files).toContain('/root/file.md');
      expect(files).not.toContain('/root/.hidden/file.md');
      expect(files).not.toContain('/root/node_modules/file.md');
    });
  });

  describe('extractVersionReferences', () => {
    it('should extract multiple version patterns from markdown', () => {
      fs.readFileSync.mockReturnValue(
        'Version: 1.2.3\nversion: v1.2.3\nv1.2.3\n@1.2.3\n[1.2.3]\nVersion: 2.0.0'
      );
      const versions = extractVersionReferences('/fake.md');
      expect(versions.has('1.2.3')).toBe(true);
      expect(versions.has('2.0.0')).toBe(true);
    });

    it('should return empty set if no version found', () => {
      fs.readFileSync.mockReturnValue('No version here');
      const versions = extractVersionReferences('/fake.md');
      expect(versions.size).toBe(0);
    });

    it('should handle edge case with malformed version', () => {
      fs.readFileSync.mockReturnValue('Version: not.a.version');
      const versions = extractVersionReferences('/fake.md');
      expect(versions.size).toBe(0);
    });
  });

  describe('checkVersionConsistency', () => {
    beforeEach(() => {
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.endsWith('package.json')) return JSON.stringify({ version: '1.2.3' });
        if (filePath.endsWith('README.md')) return 'Version: 1.2.3';
        if (filePath.endsWith('CHANGELOG.md')) return 'Version: 1.2.3';
        if (filePath.endsWith('docs.md')) return 'Version: 2.0.0';
        return '';
      });
      fs.readdirSync.mockReturnValue(['README.md', 'CHANGELOG.md', 'docs.md']);
      fs.statSync.mockImplementation((filePath) => ({
        isDirectory: () => false,
      }));
      path.join.mockImplementation((...args) => args.join('/'));
    });

    it('should return 0 if all versions are consistent', () => {
      fs.readFileSync.mockImplementation((filePath) => 'Version: 1.2.3');
      expect(checkVersionConsistency()).toBe(0);
    });

    it('should return 1 if there are inconsistencies', () => {
      fs.readFileSync.mockImplementation((filePath) => {
        if (filePath.endsWith('package.json')) return JSON.stringify({ version: '1.2.3' });
        if (filePath.endsWith('README.md')) return 'Version: 1.2.3';
        if (filePath.endsWith('CHANGELOG.md')) return 'Version: 2.0.0';
        return '';
      });
      expect(checkVersionConsistency()).toBe(1);
    });

    it('should handle no markdown files gracefully', () => {
      fs.readdirSync.mockReturnValue([]);
      expect(checkVersionConsistency()).toBe(0);
    });
  });

  describe('autoFixInconsistencies', () => {
    it('should fix outdated version strings in files', () => {
      fs.readFileSync.mockReturnValue('Version: 2.0.0');
      let written = '';
      fs.writeFileSync.mockImplementation((file, content) => { written = content; });
      const inconsistencies = [{ file: '/fake.md', versions: ['2.0.0'] }];
      const results = autoFixInconsistencies(inconsistencies, '1.2.3');
      expect(results[0].fixed).toBe(true);
      expect(written).toContain('1.2.3');
    });

    it('should skip files if version string not found', () => {
      fs.readFileSync.mockReturnValue('No version here');
      fs.writeFileSync.mockImplementation(() => {});
      const inconsistencies = [{ file: '/fake.md', versions: ['2.0.0'] }];
      const results = autoFixInconsistencies(inconsistencies, '1.2.3');
      expect(results[0].fixed).toBe(false);
      expect(results[0].error).toMatch(/not replaceable/);
    });

    it('should handle error during file write', () => {
      fs.readFileSync.mockReturnValue('Version: 2.0.0');
      fs.writeFileSync.mockImplementation(() => { throw new Error('write fail'); });
      const inconsistencies = [{ file: '/fake.md', versions: ['2.0.0'] }];
      const results = autoFixInconsistencies(inconsistencies, '1.2.3');
      expect(results[0].fixed).toBe(false);
      expect(results[0].error).toMatch(/write fail/);
    });
  });
});
