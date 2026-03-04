// scripts/analyze-jsdoc-coverage.test.js

import * as jsdocModule from './analyze-jsdoc-coverage.js';

describe('analyze-jsdoc-coverage.js core functions', () => {
  const {
    hasJSDoc,
    extractExportName,
    analyzeFile,
    findJSFiles,
    stats,
  } = jsdocModule;

  describe('hasJSDoc', () => {
    it('should detect JSDoc immediately above export', () => {
      const lines = [
        '/**',
        ' * My function',
        ' */',
        'export function foo() {}',
      ];
      expect(hasJSDoc(lines, 3)).toBe(true);
    });

    it('should detect JSDoc up to 10 lines above', () => {
      const lines = [
        '/**',
        ' * My function',
        ' */',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        'export function bar() {}',
      ];
      expect(hasJSDoc(lines, 11)).toBe(true);
    });

    it('should return false if no JSDoc present', () => {
      const lines = [
        '// Not a JSDoc',
        'export function baz() {}',
      ];
      expect(hasJSDoc(lines, 1)).toBe(false);
    });

    it('should stop searching if another export/function/class is encountered', () => {
      const lines = [
        '/**',
        ' * Not for foo',
        ' */',
        'export function bar() {}',
        '',
        'export function foo() {}',
      ];
      expect(hasJSDoc(lines, 5)).toBe(false);
    });
  });

  describe('extractExportName', () => {
    it('should extract function name from export', () => {
      expect(extractExportName('export function foo() {}')).toBe('foo');
      expect(extractExportName('export async function bar() {}')).toBe('bar');
    });

    it('should extract class name from export', () => {
      expect(extractExportName('export class MyClass {}')).toBe('MyClass');
    });

    it('should extract const name from export', () => {
      expect(extractExportName('export const myVar = 1;')).toBe('myVar');
    });

    it('should return null for non-export lines', () => {
      expect(extractExportName('function foo() {}')).toBeNull();
      expect(extractExportName('class Bar {}')).toBeNull();
      expect(extractExportName('const baz = 1;')).toBeNull();
    });
  });

  describe('analyzeFile', () => {
    const fs = require('fs');
    const path = require('path');
    const tmp = require('os').tmpdir();

    afterEach(() => {
      stats.totalFiles = 0;
      stats.totalExports = 0;
      stats.documentedExports = 0;
      stats.undocumentedExports = [];
      stats.fileStats = [];
    });

    it('should count documented and undocumented exports', async () => {
      const fileContent = `
/**
 * Foo docs
 */
export function foo() {}

/**
 * Bar docs
 */
export class Bar {}

/**
 * Baz docs
 */
export const baz = 1;

export function noDoc() {}
export class NoDocClass {}
export const noDocConst = 2;
      `;
      const filePath = path.join(tmp, 'jsdoc-test-file.js');
      fs.writeFileSync(filePath, fileContent);

      const result = await analyzeFile(filePath);
      expect(result.exports).toBe(6);
      expect(result.documented).toBe(3);
      expect(result.undocumented).toEqual(
        expect.arrayContaining(['noDoc', 'NoDocClass', 'noDocConst'])
      );
      fs.unlinkSync(filePath);
    });

    it('should handle files with no exports', async () => {
      const fileContent = `
function foo() {}
const bar = 1;
      `;
      const filePath = path.join(tmp, 'jsdoc-test-file2.js');
      fs.writeFileSync(filePath, fileContent);

      const result = await analyzeFile(filePath);
      expect(result.exports).toBe(0);
      expect(result.documented).toBe(0);
      expect(result.undocumented).toEqual([]);
      fs.unlinkSync(filePath);
    });
  });

  describe('findJSFiles', () => {
    const fs = require('fs');
    const path = require('path');
    const tmp = require('os').tmpdir();

    it('should find .js files recursively', async () => {
      const dir = path.join(tmp, 'jsdoc-find-test');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'a.js'), '');
      fs.writeFileSync(path.join(dir, 'b.txt'), '');
      const subdir = path.join(dir, 'sub');
      fs.mkdirSync(subdir, { recursive: true });
      fs.writeFileSync(path.join(subdir, 'c.js'), '');

      const files = await findJSFiles(dir);
      expect(files).toEqual(
        expect.arrayContaining([
          path.join(dir, 'a.js'),
          path.join(subdir, 'c.js'),
        ])
      );
      fs.unlinkSync(path.join(dir, 'a.js'));
      fs.unlinkSync(path.join(dir, 'b.txt'));
      fs.unlinkSync(path.join(subdir, 'c.js'));
      fs.rmdirSync(subdir);
      fs.rmdirSync(dir);
    });

    it('should skip node_modules and coverage directories', async () => {
      const dir = path.join(tmp, 'jsdoc-skip-test');
      fs.mkdirSync(dir, { recursive: true });
      const nm = path.join(dir, 'node_modules');
      const cov = path.join(dir, 'coverage');
      fs.mkdirSync(nm, { recursive: true });
      fs.mkdirSync(cov, { recursive: true });
      fs.writeFileSync(path.join(nm, 'skip.js'), '');
      fs.writeFileSync(path.join(cov, 'skip.js'), '');
      fs.writeFileSync(path.join(dir, 'keep.js'), '');

      const files = await findJSFiles(dir);
      expect(files).toEqual([path.join(dir, 'keep.js')]);
      fs.unlinkSync(path.join(nm, 'skip.js'));
      fs.unlinkSync(path.join(cov, 'skip.js'));
      fs.unlinkSync(path.join(dir, 'keep.js'));
      fs.rmdirSync(nm);
      fs.rmdirSync(cov);
      fs.rmdirSync(dir);
    });
  });

  describe('stats object', () => {
    it('should initialize with zeros and empty arrays', () => {
      expect(stats.totalFiles).toBe(0);
      expect(stats.totalExports).toBe(0);
      expect(stats.documentedExports).toBe(0);
      expect(Array.isArray(stats.undocumentedExports)).toBe(true);
      expect(Array.isArray(stats.fileStats)).toBe(true);
    });
  });
});
