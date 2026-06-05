// test/steps/step_10_ai_review.test.js

import {
  prioritizeSourceFiles,
  isStep10GeneratedArtifactPath,
  isStep10CodeReviewableFile,
  isErrorResilienceReviewableFile,
  buildFileContentMap,
  buildPromptFileEntries,
  buildCodePromptSlices,
  formatFileContentMap,
} from '../../src/steps/step_10_ai_review.js';

describe('prioritizeSourceFiles', () => {
  it('returns empty array for non-array input', () => {
    expect(prioritizeSourceFiles(null)).toEqual([]);
    expect(prioritizeSourceFiles(undefined)).toEqual([]);
    expect(prioritizeSourceFiles({})).toEqual([]);
  });
  it('sorts source files before test files', () => {
    const files = [
      'src/foo.js',
      'test/foo.test.js',
      'src/bar.js',
      'test/bar.spec.js',
      'src/baz.js',
    ];
    const result = prioritizeSourceFiles(files);
    expect(result.slice(0, 3)).toEqual(['src/bar.js', 'src/baz.js', 'src/foo.js']);
    expect(result.slice(3)).toEqual(['test/bar.spec.js', 'test/foo.test.js']);
  });
});

describe('isStep10GeneratedArtifactPath', () => {
  it('returns false for non-string or empty input', () => {
    expect(isStep10GeneratedArtifactPath(null)).toBe(false);
    expect(isStep10GeneratedArtifactPath('')).toBe(false);
  });
  it('detects generated artifact paths', () => {
    expect(isStep10GeneratedArtifactPath('dist/main.js')).toBe(true);
    expect(isStep10GeneratedArtifactPath('node_modules/foo.js')).toBe(true);
    expect(isStep10GeneratedArtifactPath('docs/api/assets/navigation.js')).toBe(true);
    expect(isStep10GeneratedArtifactPath('docs/api/html/classes/GeoPosition.html')).toBe(true);
    expect(isStep10GeneratedArtifactPath('docs/api-generated/scripts/linenumber.js')).toBe(true);
    expect(isStep10GeneratedArtifactPath('assets/js/app.js')).toBe(true);
    expect(isStep10GeneratedArtifactPath('public/v1/assets/main-Bn4g5hbK.js')).toBe(true);
    expect(isStep10GeneratedArtifactPath('src/app.min.js')).toBe(true);
    expect(isStep10GeneratedArtifactPath('src/app.js')).toBe(false);
  });
});

describe('isStep10CodeReviewableFile', () => {
  it('returns false for non-string or empty input', () => {
    expect(isStep10CodeReviewableFile(null)).toBe(false);
    expect(isStep10CodeReviewableFile('')).toBe(false);
  });
  it('returns false for generated artifact paths', () => {
    expect(isStep10CodeReviewableFile('dist/main.js')).toBe(false);
    expect(isStep10CodeReviewableFile('docs/api/assets/navigation.js')).toBe(false);
    expect(isStep10CodeReviewableFile('docs/api-generated/scripts/linenumber.js')).toBe(false);
  });
  it('returns true for reviewable extensions', () => {
    expect(isStep10CodeReviewableFile('src/foo.js')).toBe(true);
    expect(isStep10CodeReviewableFile('src/foo.ts')).toBe(true);
    expect(isStep10CodeReviewableFile('src/foo.py')).toBe(true);
    expect(isStep10CodeReviewableFile('src/foo.txt')).toBe(false);
  });
});

describe('isErrorResilienceReviewableFile', () => {
  it('returns false for non-reviewable files', () => {
    expect(isErrorResilienceReviewableFile('foo.txt')).toBe(false);
    expect(isErrorResilienceReviewableFile('dist/main.js')).toBe(false);
  });
  it('returns false for .d.ts files', () => {
    expect(isErrorResilienceReviewableFile('src/types.d.ts')).toBe(false);
  });
  it('returns true for reviewable source files', () => {
    expect(isErrorResilienceReviewableFile('src/foo.js')).toBe(true);
    expect(isErrorResilienceReviewableFile('src/foo.ts')).toBe(true);
  });
});

describe('buildFileContentMap', () => {
  it('returns empty array for invalid input', () => {
    expect(buildFileContentMap(null)).toEqual([]);
    expect(buildFileContentMap(undefined)).toEqual([]);
    expect(buildFileContentMap('string')).toEqual([]);
  });
  it('returns capped excerpts and truncation flag', () => {
    const files = {
      'src/a.js': 'a'.repeat(10),
      'src/b.js': 'b'.repeat(1000),
    };
    const result = buildFileContentMap(files, { maxCharsPerFile: 20, maxFiles: 2 });
    expect(result).toHaveLength(2);
    expect(result[0]).toHaveProperty('path', 'src/a.js');
    expect(result[0]).toHaveProperty('excerpt', 'a'.repeat(10));
    expect(result[0]).toHaveProperty('truncated', false);
    expect(result[1]).toHaveProperty('truncated', true);
    expect(result[1].excerpt.length).toBe(20);
  });
  it('respects maxFiles option', () => {
    const files = {
      'src/a.js': 'a',
      'src/b.js': 'b',
      'src/c.js': 'c',
    };
    const result = buildFileContentMap(files, { maxFiles: 2 });
    expect(result.length).toBe(2);
  });
});

describe('buildPromptFileEntries', () => {
  it('returns empty array for invalid input', () => {
    expect(buildPromptFileEntries(null)).toEqual([]);
    expect(buildPromptFileEntries(undefined)).toEqual([]);
    expect(buildPromptFileEntries('string')).toEqual([]);
  });
  it('returns single entry for small file', () => {
    const files = { 'src/a.js': 'abc' };
    const result = buildPromptFileEntries(files, { maxCharsPerEntry: 10 });
    expect(result).toEqual([{ displayPath: 'src/a.js', sourcePath: 'src/a.js', excerpt: 'abc' }]);
  });
  it('splits large file into multiple entries', () => {
    const files = { 'src/a.js': 'a'.repeat(25) };
    const result = buildPromptFileEntries(files, { maxCharsPerEntry: 10 });
    expect(result.length).toBe(3);
    expect(result[0].displayPath).toMatch(/\(part 1\/3\)$/);
    expect(result[1].displayPath).toMatch(/\(part 2\/3\)$/);
    expect(result[2].displayPath).toMatch(/\(part 3\/3\)$/);
  });
  it('skips empty or non-string content', () => {
    const files = { 'src/a.js': '', 'src/b.js': null };
    expect(buildPromptFileEntries(files)).toEqual([]);
  });
});

describe('buildCodePromptSlices', () => {
  it('returns empty array for no entries', () => {
    expect(buildCodePromptSlices({}, {})).toEqual([]);
  });
  it('splits entries by maxPromptChars and maxEntriesPerSlice', () => {
    const files = {
      'src/a.js': 'a'.repeat(1000),
      'src/b.js': 'b'.repeat(1000),
      'src/c.js': 'c'.repeat(1000),
      'src/d.js': 'd'.repeat(1000),
      'src/e.js': 'e'.repeat(1000),
    };
    const slices = buildCodePromptSlices(files, {
      maxCharsPerEntry: 500,
      maxPromptChars: 1200,
      maxEntriesPerSlice: 2,
    });
    expect(slices.length).toBeGreaterThan(1);
    slices.forEach((slice) => {
      expect(slice.entries.length).toBeLessThanOrEqual(2);
      const totalChars = slice.entries.reduce((sum, e) => sum + e.excerpt.length, 0);
      expect(totalChars).toBeLessThanOrEqual(1200);
    });
  });
});

describe('formatFileContentMap', () => {
  it('returns message for empty or invalid input', () => {
    expect(formatFileContentMap(null)).toBe('(no source files provided)');
    expect(formatFileContentMap([])).toBe('(no source files provided)');
  });
  it('formats content map as markdown', () => {
    const map = [
      { path: 'src/a.js', excerpt: 'abc', truncated: false },
      { path: 'src/b.js', excerpt: 'def', truncated: true },
    ];
    const result = formatFileContentMap(map);
    expect(result).toMatch(/### src\/a\.js/);
    expect(result).toMatch(/### src\/b\.js \[truncated\]/);
    expect(result).toContain('```');
    expect(result).toContain('abc');
    expect(result).toContain('def');
  });
});
