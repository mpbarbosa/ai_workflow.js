// scripts/validate-exports.test.js

import { readFileSync, writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import {
  extractExports,
  extractReExports,
} from './validate-exports.js';

describe('extractExports', () => {
  const tempFile = join(__dirname, 'temp-module.js');

  afterEach(() => {
    try { unlinkSync(tempFile); } catch {}
  });

  it('should extract exported classes', () => {
    writeFileSync(tempFile, 'export class MyClass {}\n');
    const exports = extractExports(tempFile);
    expect(exports.has('MyClass')).toBe(true);
  });

  it('should extract exported functions (sync and async)', () => {
    writeFileSync(tempFile, 'export function foo() {}\nexport async function bar() {}\n');
    const exports = extractExports(tempFile);
    expect(exports.has('foo')).toBe(true);
    expect(exports.has('bar')).toBe(true);
  });

  it('should extract exported variables (const, let, var)', () => {
    writeFileSync(tempFile, 'export const a = 1;\nexport let b = 2;\nexport var c = 3;\n');
    const exports = extractExports(tempFile);
    expect(exports.has('a')).toBe(true);
    expect(exports.has('b')).toBe(true);
    expect(exports.has('c')).toBe(true);
  });

  it('should extract named exports from export { ... }', () => {
    writeFileSync(tempFile, 'const x = 1, y = 2;\nexport { x, y };\n');
    const exports = extractExports(tempFile);
    expect(exports.has('x')).toBe(true);
    expect(exports.has('y')).toBe(true);
  });

  it('should extract named exports with "as" alias', () => {
    writeFileSync(tempFile, 'const z = 3;\nexport { z as zz };\n');
    const exports = extractExports(tempFile);
    expect(exports.has('z')).toBe(true);
    expect(exports.has('zz')).toBe(false);
  });

  it('should extract default exports', () => {
    writeFileSync(tempFile, 'export default MyClass;\nclass MyClass {}\n');
    const exports = extractExports(tempFile);
    expect(exports.has('default')).toBe(true);
    expect(exports.has('MyClass')).toBe(true);
  });

  it('should handle files with no exports', () => {
    writeFileSync(tempFile, 'const a = 1;\n');
    const exports = extractExports(tempFile);
    expect(exports.size).toBe(0);
  });

  it('should not fail on malformed export statements', () => {
    writeFileSync(tempFile, 'export { , , };\nexport class \nexport function \n');
    const exports = extractExports(tempFile);
    expect(exports.size).toBe(0);
  });
});

describe('extractReExports', () => {
  const tempIndex = join(__dirname, 'temp-index.js');

  afterEach(() => {
    try { unlinkSync(tempIndex); } catch {}
  });

  it('should extract named re-exports from index.js', () => {
    writeFileSync(tempIndex, "export { Foo, Bar } from './foo';\n");
    const reExports = extractReExports(tempIndex);
    expect(reExports).toEqual([
      { exportName: 'Foo', modulePath: './foo', lineNumber: 1 },
      { exportName: 'Bar', modulePath: './foo', lineNumber: 1 },
    ]);
  });

  it('should extract re-exports with "as" alias', () => {
    writeFileSync(tempIndex, "export { Baz as Qux } from './baz';\n");
    const reExports = extractReExports(tempIndex);
    expect(reExports).toEqual([
      { exportName: 'Baz', modulePath: './baz', lineNumber: 1 },
    ]);
  });

  it('should handle multiple re-exports on different lines', () => {
    writeFileSync(
      tempIndex,
      "export { A } from './a';\nexport { B, C } from './b';\n"
    );
    const reExports = extractReExports(tempIndex);
    expect(reExports).toEqual([
      { exportName: 'A', modulePath: './a', lineNumber: 1 },
      { exportName: 'B', modulePath: './b', lineNumber: 2 },
      { exportName: 'C', modulePath: './b', lineNumber: 2 },
    ]);
  });

  it('should ignore lines that are not re-exports', () => {
    writeFileSync(
      tempIndex,
      "import { X } from './x';\nconst Y = 2;\nexport default Z;\n"
    );
    const reExports = extractReExports(tempIndex);
    expect(reExports).toEqual([]);
  });

  it('should handle empty index.js', () => {
    writeFileSync(tempIndex, '');
    const reExports = extractReExports(tempIndex);
    expect(reExports).toEqual([]);
  });

  it('should handle malformed re-export lines gracefully', () => {
    writeFileSync(tempIndex, "export { } from './empty';\nexport {,} from './bad';\n");
    const reExports = extractReExports(tempIndex);
    expect(reExports).toEqual([]);
  });
});
