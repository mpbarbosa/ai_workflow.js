/**
 * Tests for ArtifactRepository
 *
 * @jest-environment node
 */

import { extToLanguage, loadArtifacts } from '../../src/lib/artifact_repository.js';

// ---------------------------------------------------------------------------
// extToLanguage
// ---------------------------------------------------------------------------

describe('extToLanguage', () => {
  test.each([
    ['js', 'javascript'],
    ['mjs', 'javascript'],
    ['cjs', 'javascript'],
    ['ts', 'typescript'],
    ['tsx', 'typescript'],
    ['py', 'python'],
    ['go', 'go'],
    ['rb', 'ruby'],
    ['rs', 'rust'],
    ['java', 'java'],
    ['sh', 'bash'],
    ['bats', 'bash'],
    ['json', 'json'],
    ['yaml', 'yaml'],
    ['yml', 'yaml'],
    ['md', 'markdown'],
  ])('maps .%s to %s', (ext, expected) => {
    expect(extToLanguage(ext)).toBe(expected);
  });

  test('returns ext unchanged for unknown extensions', () => {
    expect(extToLanguage('xyz')).toBe('xyz');
  });

  test('returns empty string for undefined', () => {
    expect(extToLanguage(undefined)).toBe('');
  });

  test('is case-insensitive', () => {
    expect(extToLanguage('JS')).toBe('javascript');
    expect(extToLanguage('TS')).toBe('typescript');
  });
});

// ---------------------------------------------------------------------------
// loadArtifacts — helpers
// ---------------------------------------------------------------------------

// Simple fileOps that maps absolute path → content
function mockFileOps(contentByAbsPath) {
  return {
    readFile: async (absPath) => {
      if (Object.prototype.hasOwnProperty.call(contentByAbsPath, absPath)) {
        return contentByAbsPath[absPath];
      }
      throw new Error(`ENOENT: ${absPath}`);
    },
  };
}

// ---------------------------------------------------------------------------
// loadArtifacts
// ---------------------------------------------------------------------------

describe('loadArtifacts — basic', () => {
  const root = '/project';

  test('returns an artifact for each readable file', async () => {
    const fileOps = mockFileOps({
      '/project/a.js': 'const a = 1;',
      '/project/b.ts': 'export const b = 2;',
    });
    const result = await loadArtifacts(['a.js', 'b.ts'], [], { projectRoot: root, fileOps });
    expect(result).toHaveLength(2);
    expect(result.map((a) => a.path)).toEqual(['a.js', 'b.ts']);
  });

  test('skips unreadable files', async () => {
    const fileOps = mockFileOps({
      '/project/good.js': 'ok',
      // bad.js is not in the map → throws
    });
    const result = await loadArtifacts(['good.js', 'bad.js'], [], { projectRoot: root, fileOps });
    expect(result).toHaveLength(1);
    expect(result[0].path).toBe('good.js');
  });

  test('sets content, language, byteSize', async () => {
    const content = 'const x = 42;';
    const fileOps = mockFileOps({ '/project/src/foo.js': content });
    const [artifact] = await loadArtifacts(['src/foo.js'], [], { projectRoot: root, fileOps });
    expect(artifact.content).toBe(content);
    expect(artifact.language).toBe('javascript');
    expect(artifact.byteSize).toBe(Buffer.byteLength(content, 'utf8'));
  });

  test('sets isModified when path is in modifiedFiles', async () => {
    const fileOps = mockFileOps({
      '/project/changed.ts': 'a',
      '/project/unchanged.ts': 'b',
    });
    const result = await loadArtifacts(['changed.ts', 'unchanged.ts'], ['changed.ts'], {
      projectRoot: root,
      fileOps,
    });
    const byPath = Object.fromEntries(result.map((a) => [a.path, a]));
    expect(byPath['changed.ts'].isModified).toBe(true);
    expect(byPath['unchanged.ts'].isModified).toBe(false);
  });

  test('assigns priority by sort position (0 = first)', async () => {
    const fileOps = mockFileOps({
      '/project/a.js': 'a',
      '/project/b.js': 'b',
      '/project/c.js': 'c',
    });
    const result = await loadArtifacts(['a.js', 'b.js', 'c.js'], [], {
      projectRoot: root,
      fileOps,
    });
    expect(result[0].priority).toBe(0);
    expect(result[1].priority).toBe(1);
    expect(result[2].priority).toBe(2);
  });
});

describe('loadArtifacts — priority ordering', () => {
  const root = '/project';

  test('modified files sort before unmodified files', async () => {
    const fileOps = mockFileOps({
      '/project/old.js': 'old',
      '/project/new.js': 'new',
      '/project/also_old.js': 'also old',
    });
    const result = await loadArtifacts(['old.js', 'new.js', 'also_old.js'], ['new.js'], {
      projectRoot: root,
      fileOps,
    });
    expect(result[0].path).toBe('new.js');
    expect(result[0].isModified).toBe(true);
  });

  test('multiple modified files all precede unmodified ones', async () => {
    const fileOps = mockFileOps({
      '/project/a.js': 'a',
      '/project/b.js': 'b',
      '/project/c.js': 'c',
      '/project/d.js': 'd',
    });
    const result = await loadArtifacts(['a.js', 'b.js', 'c.js', 'd.js'], ['b.js', 'd.js'], {
      projectRoot: root,
      fileOps,
    });
    const modifiedPaths = result.filter((a) => a.isModified).map((a) => a.path);
    const unmodifiedPaths = result.filter((a) => !a.isModified).map((a) => a.path);
    // All modified artifacts appear before all unmodified ones
    const lastModifiedIdx = result.findLastIndex((a) => a.isModified);
    const firstUnmodifiedIdx = result.findIndex((a) => !a.isModified);
    expect(modifiedPaths.length).toBe(2);
    expect(unmodifiedPaths.length).toBe(2);
    expect(lastModifiedIdx).toBeLessThan(firstUnmodifiedIdx);
  });

  test('handles absolute paths in the input directly', async () => {
    const fileOps = mockFileOps({ '/absolute/path.js': 'abs' });
    const result = await loadArtifacts(['/absolute/path.js'], [], {
      projectRoot: root,
      fileOps,
    });
    expect(result).toHaveLength(1);
    expect(result[0].path).toBe('/absolute/path.js');
  });

  test('returns empty array for empty input', async () => {
    const result = await loadArtifacts([], [], { projectRoot: root, fileOps: mockFileOps({}) });
    expect(result).toEqual([]);
  });
});
