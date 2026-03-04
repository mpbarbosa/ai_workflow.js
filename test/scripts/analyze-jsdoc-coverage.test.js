// scripts/analyze-jsdoc-coverage.test.js

import * as jsdocModule from '../../scripts/analyze-jsdoc-coverage.js';
import { writeFileSync, unlinkSync, mkdirSync, rmdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const tmp = tmpdir();

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
        'export function bar() {}',
      ];
      expect(hasJSDoc(lines, 10)).toBe(true);
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
        'export function bar() {}',
        '/**',
        ' * Not for foo',
        ' */',
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
    afterEach(() => {
      stats.totalFiles = 0;
      stats.totalExports = 0;
      stats.documentedExports = 0;
      stats.undocumentedExports = [];
      stats.fileStats = [];
    });

    it('should count documented and undocumented exports', async () => {
      // hasJSDoc scans forward from (index-10), stopping on first export//** found.
      // To avoid cross-contamination, documented exports come first (closely grouped),
      // then 11+ blank lines so undocumented exports' windows don't include any '/**'.
      const fileContent = [
        '/**',
        ' * Foo docs',
        ' */',
        'export function foo() {}',
        '/**',
        ' * Bar docs',
        ' */',
        'export class Bar {}',
        ...Array(11).fill(''),
        '/**',
        ' * Baz docs',
        ' */',
        'export const baz = 1;',
        ...Array(12).fill(''),
        'export function noDoc() {}',
        'export class NoDocClass {}',
        'export const noDocConst = 2;',
      ].join('\n');
      const filePath = join(tmp, 'jsdoc-test-file.js');
      writeFileSync(filePath, fileContent);

      const result = await analyzeFile(filePath);
      expect(result.exports).toBe(6);
      expect(result.documented).toBe(3);
      expect(result.undocumented).toEqual(
        expect.arrayContaining(['noDoc', 'NoDocClass', 'noDocConst'])
      );
      unlinkSync(filePath);
    });

    it('should handle files with no exports', async () => {
      const fileContent = `
function foo() {}
const bar = 1;
      `;
      const filePath = join(tmp, 'jsdoc-test-file2.js');
      writeFileSync(filePath, fileContent);

      const result = await analyzeFile(filePath);
      expect(result.exports).toBe(0);
      expect(result.documented).toBe(0);
      expect(result.undocumented).toEqual([]);
      unlinkSync(filePath);
    });
  });

  describe('findJSFiles', () => {
    it('should find .js files recursively', async () => {
      const dir = join(tmp, 'jsdoc-find-test');
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, 'a.js'), '');
      writeFileSync(join(dir, 'b.txt'), '');
      const subdir = join(dir, 'sub');
      mkdirSync(subdir, { recursive: true });
      writeFileSync(join(subdir, 'c.js'), '');

      const files = await findJSFiles(dir);
      expect(files).toEqual(
        expect.arrayContaining([
          join(dir, 'a.js'),
          join(subdir, 'c.js'),
        ])
      );
      unlinkSync(join(dir, 'a.js'));
      unlinkSync(join(dir, 'b.txt'));
      unlinkSync(join(subdir, 'c.js'));
      rmdirSync(subdir);
      rmdirSync(dir);
    });

    it('should skip node_modules and coverage directories', async () => {
      const dir = join(tmp, 'jsdoc-skip-test');
      mkdirSync(dir, { recursive: true });
      const nm = join(dir, 'node_modules');
      const cov = join(dir, 'coverage');
      mkdirSync(nm, { recursive: true });
      mkdirSync(cov, { recursive: true });
      writeFileSync(join(nm, 'skip.js'), '');
      writeFileSync(join(cov, 'skip.js'), '');
      writeFileSync(join(dir, 'keep.js'), '');

      const files = await findJSFiles(dir);
      expect(files).toEqual([join(dir, 'keep.js')]);
      unlinkSync(join(nm, 'skip.js'));
      unlinkSync(join(cov, 'skip.js'));
      unlinkSync(join(dir, 'keep.js'));
      rmdirSync(nm);
      rmdirSync(cov);
      rmdirSync(dir);
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
