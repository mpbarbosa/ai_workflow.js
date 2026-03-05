// test/scripts/validate-exports.test.js

import { writeFileSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { extractExports, extractReExports } from '../../scripts/validate-exports.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('extractExports', () => {
  const tempFile = join(__dirname, 'temp-module.js');

  afterEach(() => {
    try {
      unlinkSync(tempFile);
    } catch {
      // ignore ENOENT
    }
  });

  it('extracts exported classes', () => {
    writeFileSync(tempFile, 'export class MyClass {}\n');
    const exports = extractExports(tempFile);
    expect(exports.has('MyClass')).toBe(true);
  });

  it('extracts exported functions (sync and async)', () => {
    writeFileSync(tempFile, 'export function foo() {}\nexport async function bar() {}\n');
    const exports = extractExports(tempFile);
    expect(exports.has('foo')).toBe(true);
    expect(exports.has('bar')).toBe(true);
  });

  it('extracts exported variables (const, let, var)', () => {
    writeFileSync(tempFile, 'export const a = 1;\nexport let b = 2;\nexport var c = 3;\n');
    const exports = extractExports(tempFile);
    expect(exports.has('a')).toBe(true);
    expect(exports.has('b')).toBe(true);
    expect(exports.has('c')).toBe(true);
  });

  it('extracts named exports from export { ... }', () => {
    writeFileSync(tempFile, 'const x = 1, y = 2;\nexport { x, y };\n');
    const exports = extractExports(tempFile);
    expect(exports.has('x')).toBe(true);
    expect(exports.has('y')).toBe(true);
  });

  it('extracts the source name (not alias) from "export { z as zz }"', () => {
    writeFileSync(tempFile, 'const z = 3;\nexport { z as zz };\n');
    const exports = extractExports(tempFile);
    expect(exports.has('z')).toBe(true);
    expect(exports.has('zz')).toBe(false);
  });

  it('extracts default exports (adds both "default" and the name)', () => {
    writeFileSync(tempFile, 'export default MyClass;\nclass MyClass {}\n');
    const exports = extractExports(tempFile);
    expect(exports.has('default')).toBe(true);
    expect(exports.has('MyClass')).toBe(true);
  });

  it('returns empty set for files with no exports', () => {
    writeFileSync(tempFile, 'const a = 1;\n');
    const exports = extractExports(tempFile);
    expect(exports.size).toBe(0);
  });

  it('does not add empty strings for malformed export { , , } statements', () => {
    writeFileSync(tempFile, 'export { , , };\nexport class \nexport function \n');
    const exports = extractExports(tempFile);
    expect(exports.size).toBe(0);
  });
});

describe('extractReExports', () => {
  const tempIndex = join(__dirname, 'temp-index.js');

  afterEach(() => {
    try {
      unlinkSync(tempIndex);
    } catch {
      // ignore ENOENT
    }
  });

  it('extracts named re-exports from index.js', () => {
    writeFileSync(tempIndex, "export { Foo, Bar } from './foo';\n");
    const reExports = extractReExports(tempIndex);
    expect(reExports).toEqual([
      { exportName: 'Foo', modulePath: './foo', lineNumber: 1 },
      { exportName: 'Bar', modulePath: './foo', lineNumber: 1 },
    ]);
  });

  it('extracts the source name (not alias) from "export { Baz as Qux }"', () => {
    writeFileSync(tempIndex, "export { Baz as Qux } from './baz';\n");
    const reExports = extractReExports(tempIndex);
    expect(reExports).toEqual([{ exportName: 'Baz', modulePath: './baz', lineNumber: 1 }]);
  });

  it('handles multiple re-exports on different lines', () => {
    writeFileSync(tempIndex, "export { A } from './a';\nexport { B, C } from './b';\n");
    const reExports = extractReExports(tempIndex);
    expect(reExports).toEqual([
      { exportName: 'A', modulePath: './a', lineNumber: 1 },
      { exportName: 'B', modulePath: './b', lineNumber: 2 },
      { exportName: 'C', modulePath: './b', lineNumber: 2 },
    ]);
  });

  it('ignores import statements and non-re-export lines', () => {
    writeFileSync(tempIndex, "import { X } from './x';\nconst Y = 2;\nexport default Z;\n");
    const reExports = extractReExports(tempIndex);
    expect(reExports).toEqual([]);
  });

  it('returns empty array for empty file', () => {
    writeFileSync(tempIndex, '');
    const reExports = extractReExports(tempIndex);
    expect(reExports).toEqual([]);
  });

  it('skips empty export braces without adding empty-name entries', () => {
    writeFileSync(tempIndex, "export { } from './empty';\nexport {,} from './bad';\n");
    const reExports = extractReExports(tempIndex);
    expect(reExports).toEqual([]);
  });
});
