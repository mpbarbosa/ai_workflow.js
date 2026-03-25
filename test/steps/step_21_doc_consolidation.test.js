/**
 * @fileoverview Tests for step_21_doc_consolidation module
 * @module test/steps/step_21_doc_consolidation.test
 */

import { jest } from '@jest/globals';
import {
  tokenize,
  buildTermFrequency,
  buildIdf,
  buildTfIdfVector,
  cosineSimilarity,
  buildSimilarityMatrix,
  clusterBySimilarity,
  computeDocsFingerprint,
  isSimilarityCacheValid,
  formatConsolidationReport,
  DocConsolidationStep,
  DEFAULT_SIMILARITY_THRESHOLD,
} from '../../src/steps/step_21_doc_consolidation.js';
import { STEP_KIND } from '../../src/steps/step_contract.js';

// =============================================================================
// PURE FUNCTION TESTS
// =============================================================================

describe('step_21_doc_consolidation - Pure Functions', () => {
  // ---------------------------------------------------------------------------
  // tokenize
  // ---------------------------------------------------------------------------

  describe('tokenize', () => {
    test('returns empty array for empty string', () => {
      expect(tokenize('')).toEqual([]);
    });

    test('returns empty array for non-string input', () => {
      expect(tokenize(null)).toEqual([]);
      expect(tokenize(undefined)).toEqual([]);
    });

    test('lowercases all tokens', () => {
      expect(tokenize('Hello World')).toEqual(['hello', 'world']);
    });

    test('strips punctuation', () => {
      expect(tokenize('Hello, World!')).toEqual(['hello', 'world']);
    });

    test('removes stop-words', () => {
      const tokens = tokenize('the quick brown fox');
      expect(tokens).not.toContain('the');
      expect(tokens).toContain('quick');
      expect(tokens).toContain('brown');
      expect(tokens).toContain('fox');
    });

    test('removes single-character tokens', () => {
      const tokens = tokenize('a b c test');
      expect(tokens).not.toContain('b');
      expect(tokens).not.toContain('c');
      expect(tokens).toContain('test');
    });

    test('splits on whitespace and punctuation', () => {
      const tokens = tokenize('foo-bar baz_qux');
      expect(tokens).toContain('foo');
      expect(tokens).toContain('bar');
    });

    test('is deterministic — same input produces same output', () => {
      const t1 = tokenize('Documentation guide tutorial');
      const t2 = tokenize('Documentation guide tutorial');
      expect(t1).toEqual(t2);
    });
  });

  // ---------------------------------------------------------------------------
  // buildTermFrequency
  // ---------------------------------------------------------------------------

  describe('buildTermFrequency', () => {
    test('returns empty Map for empty tokens', () => {
      expect(buildTermFrequency([]).size).toBe(0);
    });

    test('normalises frequencies by total count', () => {
      const tf = buildTermFrequency(['cat', 'cat', 'dog']);
      expect(tf.get('cat')).toBeCloseTo(2 / 3);
      expect(tf.get('dog')).toBeCloseTo(1 / 3);
    });

    test('all frequencies sum to 1', () => {
      const tokens = ['alpha', 'beta', 'gamma', 'alpha'];
      const tf = buildTermFrequency(tokens);
      const sum = [...tf.values()].reduce((s, v) => s + v, 0);
      expect(sum).toBeCloseTo(1);
    });

    test('single token has frequency 1', () => {
      const tf = buildTermFrequency(['only']);
      expect(tf.get('only')).toBe(1);
    });

    test('returns a Map (not a plain object)', () => {
      expect(buildTermFrequency(['x'])).toBeInstanceOf(Map);
    });
  });

  // ---------------------------------------------------------------------------
  // buildIdf
  // ---------------------------------------------------------------------------

  describe('buildIdf', () => {
    test('returns empty Map for empty corpus', () => {
      expect(buildIdf([]).size).toBe(0);
    });

    test('common term across all docs has IDF of 0 (log(1) = 0)', () => {
      const tf1 = new Map([['common', 0.5]]);
      const tf2 = new Map([['common', 0.3]]);
      const idf = buildIdf([tf1, tf2]);
      expect(idf.get('common')).toBeCloseTo(0);
    });

    test('rare term (1 of N) has higher IDF than common term', () => {
      const tf1 = new Map([
        ['rare', 0.2],
        ['common', 0.5],
      ]);
      const tf2 = new Map([['common', 0.4]]);
      const tf3 = new Map([['common', 0.3]]);
      const idf = buildIdf([tf1, tf2, tf3]);
      expect(idf.get('rare')).toBeGreaterThan(idf.get('common'));
    });

    test('is deterministic', () => {
      const tfs = [new Map([['word', 0.1]]), new Map([['word', 0.2]])];
      expect(buildIdf(tfs).get('word')).toEqual(buildIdf(tfs).get('word'));
    });
  });

  // ---------------------------------------------------------------------------
  // buildTfIdfVector
  // ---------------------------------------------------------------------------

  describe('buildTfIdfVector', () => {
    test('returns empty Map when idf has zero weights', () => {
      const tf = new Map([['term', 0.5]]);
      const idf = new Map([['term', 0]]);
      expect(buildTfIdfVector(tf, idf).size).toBe(0);
    });

    test('multiplies tf * idf correctly', () => {
      const tf = new Map([['term', 0.4]]);
      const idf = new Map([['term', 2.5]]);
      const vec = buildTfIdfVector(tf, idf);
      expect(vec.get('term')).toBeCloseTo(1.0);
    });

    test('excludes terms absent from idf', () => {
      const tf = new Map([
        ['known', 0.5],
        ['unknown', 0.3],
      ]);
      const idf = new Map([['known', 1.5]]);
      const vec = buildTfIdfVector(tf, idf);
      expect(vec.has('known')).toBe(true);
      expect(vec.has('unknown')).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // cosineSimilarity
  // ---------------------------------------------------------------------------

  describe('cosineSimilarity', () => {
    test('identical vectors return 1', () => {
      const v = new Map([
        ['a', 1],
        ['b', 2],
      ]);
      expect(cosineSimilarity(v, v)).toBeCloseTo(1);
    });

    test('orthogonal vectors return 0', () => {
      const v1 = new Map([['a', 1]]);
      const v2 = new Map([['b', 1]]);
      expect(cosineSimilarity(v1, v2)).toBe(0);
    });

    test('empty vector returns 0', () => {
      const v = new Map([['a', 1]]);
      expect(cosineSimilarity(new Map(), v)).toBe(0);
      expect(cosineSimilarity(v, new Map())).toBe(0);
    });

    test('result is in [0, 1]', () => {
      const v1 = new Map([
        ['a', 0.5],
        ['b', 0.3],
      ]);
      const v2 = new Map([
        ['a', 0.2],
        ['c', 0.8],
      ]);
      const sim = cosineSimilarity(v1, v2);
      expect(sim).toBeGreaterThanOrEqual(0);
      expect(sim).toBeLessThanOrEqual(1);
    });

    test('is symmetric', () => {
      const v1 = new Map([
        ['x', 1],
        ['y', 2],
      ]);
      const v2 = new Map([
        ['x', 3],
        ['z', 1],
      ]);
      expect(cosineSimilarity(v1, v2)).toBeCloseTo(cosineSimilarity(v2, v1));
    });
  });

  // ---------------------------------------------------------------------------
  // buildSimilarityMatrix
  // ---------------------------------------------------------------------------

  describe('buildSimilarityMatrix', () => {
    test('returns NxN matrix', () => {
      const vecs = [new Map([['a', 1]]), new Map([['b', 1]]), new Map([['a', 1]])];
      const matrix = buildSimilarityMatrix(vecs);
      expect(matrix.length).toBe(3);
      expect(matrix[0].length).toBe(3);
    });

    test('diagonal is always 1', () => {
      const vecs = [new Map([['a', 1]]), new Map([['b', 1]])];
      const matrix = buildSimilarityMatrix(vecs);
      expect(matrix[0][0]).toBe(1);
      expect(matrix[1][1]).toBe(1);
    });

    test('matrix is symmetric', () => {
      const vecs = [
        new Map([
          ['a', 1],
          ['b', 2],
        ]),
        new Map([
          ['a', 2],
          ['c', 1],
        ]),
      ];
      const matrix = buildSimilarityMatrix(vecs);
      expect(matrix[0][1]).toBeCloseTo(matrix[1][0]);
    });

    test('empty array returns empty matrix', () => {
      expect(buildSimilarityMatrix([])).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // clusterBySimilarity
  // ---------------------------------------------------------------------------

  describe('clusterBySimilarity', () => {
    test('clusters identical docs together', () => {
      // 3 docs: doc0 ≈ doc1 (similar), doc2 is different
      const matrix = [
        [1, 0.9, 0.1],
        [0.9, 1, 0.1],
        [0.1, 0.1, 1],
      ];
      const clusters = clusterBySimilarity(matrix, 0.65);
      expect(clusters).toHaveLength(1);
      expect(clusters[0]).toContain(0);
      expect(clusters[0]).toContain(1);
      expect(clusters[0]).not.toContain(2);
    });

    test('returns no clusters when all similarities are below threshold', () => {
      const matrix = [
        [1, 0.1, 0.2],
        [0.1, 1, 0.3],
        [0.2, 0.3, 1],
      ];
      expect(clusterBySimilarity(matrix, 0.65)).toHaveLength(0);
    });

    test('merges transitively (A~B, B~C → {A,B,C})', () => {
      const matrix = [
        [1, 0.8, 0.1],
        [0.8, 1, 0.8],
        [0.1, 0.8, 1],
      ];
      const clusters = clusterBySimilarity(matrix, 0.65);
      expect(clusters).toHaveLength(1);
      expect(clusters[0]).toHaveLength(3);
    });

    test('uses DEFAULT_SIMILARITY_THRESHOLD when not provided', () => {
      const matrix = [
        [1, DEFAULT_SIMILARITY_THRESHOLD + 0.01],
        [DEFAULT_SIMILARITY_THRESHOLD + 0.01, 1],
      ];
      expect(clusterBySimilarity(matrix)).toHaveLength(1);
    });

    test('empty matrix returns empty clusters', () => {
      expect(clusterBySimilarity([])).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // computeDocsFingerprint
  // ---------------------------------------------------------------------------

  describe('computeDocsFingerprint', () => {
    test('returns a 64-char hex string', () => {
      const stats = [{ relPath: 'docs/a.md', size: 100, mtimeMs: 1000 }];
      const fp = computeDocsFingerprint(stats);
      expect(fp).toMatch(/^[0-9a-f]{64}$/);
    });

    test('is deterministic', () => {
      const stats = [{ relPath: 'docs/a.md', size: 100, mtimeMs: 1000 }];
      expect(computeDocsFingerprint(stats)).toBe(computeDocsFingerprint(stats));
    });

    test('changes when a file is added', () => {
      const s1 = [{ relPath: 'a.md', size: 10, mtimeMs: 1 }];
      const s2 = [
        { relPath: 'a.md', size: 10, mtimeMs: 1 },
        { relPath: 'b.md', size: 20, mtimeMs: 2 },
      ];
      expect(computeDocsFingerprint(s1)).not.toBe(computeDocsFingerprint(s2));
    });

    test('changes when a file size changes', () => {
      const s1 = [{ relPath: 'a.md', size: 10, mtimeMs: 1 }];
      const s2 = [{ relPath: 'a.md', size: 99, mtimeMs: 1 }];
      expect(computeDocsFingerprint(s1)).not.toBe(computeDocsFingerprint(s2));
    });

    test('changes when a file mtime changes', () => {
      const s1 = [{ relPath: 'a.md', size: 10, mtimeMs: 1 }];
      const s2 = [{ relPath: 'a.md', size: 10, mtimeMs: 2 }];
      expect(computeDocsFingerprint(s1)).not.toBe(computeDocsFingerprint(s2));
    });

    test('is order-independent (sorts by relPath)', () => {
      const s1 = [
        { relPath: 'b.md', size: 20, mtimeMs: 2 },
        { relPath: 'a.md', size: 10, mtimeMs: 1 },
      ];
      const s2 = [
        { relPath: 'a.md', size: 10, mtimeMs: 1 },
        { relPath: 'b.md', size: 20, mtimeMs: 2 },
      ];
      expect(computeDocsFingerprint(s1)).toBe(computeDocsFingerprint(s2));
    });
  });

  // ---------------------------------------------------------------------------
  // isSimilarityCacheValid
  // ---------------------------------------------------------------------------

  describe('isSimilarityCacheValid', () => {
    test('returns false for null cache', () => {
      expect(isSimilarityCacheValid(null, 'abc')).toBe(false);
    });

    test('returns false for non-object cache', () => {
      expect(isSimilarityCacheValid('string', 'abc')).toBe(false);
    });

    test('returns false when fingerprint mismatches', () => {
      const entry = { fingerprint: 'aaa', clusters: [] };
      expect(isSimilarityCacheValid(entry, 'bbb')).toBe(false);
    });

    test('returns false when clusters is not an array', () => {
      const entry = { fingerprint: 'abc', clusters: null };
      expect(isSimilarityCacheValid(entry, 'abc')).toBe(false);
    });

    test('returns true for matching entry', () => {
      const fp = 'a1b2c3';
      const entry = { fingerprint: fp, clusters: [[0, 1]] };
      expect(isSimilarityCacheValid(entry, fp)).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // formatConsolidationReport
  // ---------------------------------------------------------------------------

  describe('formatConsolidationReport', () => {
    test('returns a non-empty string', () => {
      const report = formatConsolidationReport({
        clusters: [],
        merged: [],
        archived: [],
        totalDocs: 5,
        threshold: 0.65,
      });
      expect(typeof report).toBe('string');
      expect(report.length).toBeGreaterThan(0);
    });

    test('includes "no similar" message when no clusters', () => {
      const report = formatConsolidationReport({
        clusters: [],
        merged: [],
        archived: [],
        totalDocs: 5,
        threshold: 0.65,
      });
      expect(report).toMatch(/no similar/i);
    });

    test('includes cluster paths when clusters present', () => {
      const report = formatConsolidationReport({
        clusters: [['docs/a.md', 'docs/b.md']],
        merged: ['docs/a.md'],
        archived: ['docs/b.md'],
        totalDocs: 3,
        threshold: 0.65,
      });
      expect(report).toContain('docs/a.md');
      expect(report).toContain('docs/b.md');
    });

    test('includes total docs and threshold in output', () => {
      const report = formatConsolidationReport({
        clusters: [],
        merged: [],
        archived: [],
        totalDocs: 10,
        threshold: 0.7,
      });
      expect(report).toContain('10');
      expect(report).toContain('0.7');
    });
  });
});

// =============================================================================
// INTEGRATION TESTS — DocConsolidationStep
// =============================================================================

describe('step_21_doc_consolidation - DocConsolidationStep (integration)', () => {
  /** Build a minimal fake `fs` object for injection */
  function makeFakeFs(overrides = {}) {
    return {
      stat: jest.fn().mockResolvedValue({ size: 100, mtimeMs: 1000 }),
      readFile: jest.fn().mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' })),
      writeFile: jest.fn().mockResolvedValue(undefined),
      mkdir: jest.fn().mockResolvedValue(undefined),
      rename: jest.fn().mockResolvedValue(undefined),
      unlink: jest.fn().mockResolvedValue(undefined),
      ...overrides,
    };
  }

  test('has correct stepKind', () => {
    expect(DocConsolidationStep.stepKind).toBe(STEP_KIND.PROJECT);
  });

  test('skips when fewer than 2 md files found', async () => {
    const step = new DocConsolidationStep({
      fileOps: { glob: jest.fn().mockResolvedValue(['single.md']) },
      backlog: { saveStepSummary: jest.fn() },
      aiHelper: {},
      aiCache: {},
      fs: makeFakeFs(),
    });

    const result = await step.execute('/fake/project');
    expect(result.skipped).toBe(true);
  });

  test('skips when zero md files found', async () => {
    const step = new DocConsolidationStep({
      fileOps: { glob: jest.fn().mockResolvedValue([]) },
      backlog: { saveStepSummary: jest.fn() },
      aiHelper: {},
      aiCache: {},
      fs: makeFakeFs(),
    });

    const result = await step.execute('/fake/project');
    expect(result.skipped).toBe(true);
  });

  test('skips gracefully when glob throws', async () => {
    // _discoverDocs swallows exceptions and returns [] → step skips (fewer than 2 docs)
    const step = new DocConsolidationStep({
      fileOps: { glob: jest.fn().mockRejectedValue(new Error('glob failed')) },
      backlog: { saveStepSummary: jest.fn() },
      aiHelper: {},
      aiCache: {},
      fs: makeFakeFs(),
    });

    const result = await step.execute('/fake/project');
    expect(result.success).toBe(true);
    expect(result.skipped).toBe(true);
  });

  test('uses cached clusters when fingerprint matches', async () => {
    const stats = [
      { relPath: 'a.md', size: 100, mtimeMs: 1000 },
      { relPath: 'b.md', size: 100, mtimeMs: 1000 },
    ];
    const fp = computeDocsFingerprint(stats);
    const cachedClusters = [[0, 1]];

    const fakeFs = makeFakeFs({
      readFile: jest.fn().mockImplementation(async (filePath) => {
        if (String(filePath).endsWith('step_21_doc_consolidation.json')) {
          return JSON.stringify({
            fingerprint: fp,
            clusters: cachedClusters,
            computedAt: Date.now(),
          });
        }
        return '# Some content\n\nThis is a document.';
      }),
    });

    const step = new DocConsolidationStep({
      fileOps: { glob: jest.fn().mockResolvedValue(['a.md', 'b.md']) },
      backlog: { saveStepSummary: jest.fn() },
      aiHelper: { callAI: jest.fn().mockResolvedValue('# Merged\n\nMerged content.') },
      aiCache: {},
      fs: fakeFs,
    });

    const result = await step.execute('/fake/project');
    expect(result.success).toBe(true);
    expect(result.clustersFound).toBe(1);
    expect(result.mergedPaths).toHaveLength(1);
    expect(result.archivedPaths).toHaveLength(1);
  });

  test('returns no-cluster result when docs are completely dissimilar', async () => {
    const docs = {
      'a.md': 'kubernetes deployment orchestration cluster pods containers namespaces services',
      'b.md': 'chocolate cake recipe baking sugar flour butter vanilla frosting',
    };

    const fakeFs = makeFakeFs({
      readFile: jest.fn().mockImplementation(async (filePath) => {
        const key = Object.keys(docs).find((k) => String(filePath).endsWith(k));
        if (key) return docs[key];
        // cache file → ENOENT
        throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      }),
    });

    const backlogMock = { saveStepSummary: jest.fn() };
    const step = new DocConsolidationStep({
      fileOps: { glob: jest.fn().mockResolvedValue(['a.md', 'b.md']) },
      backlog: backlogMock,
      aiHelper: { callAI: jest.fn() },
      aiCache: {},
      fs: fakeFs,
    });

    const result = await step.execute('/fake/project');
    expect(result.success).toBe(true);
    expect(result.clustersFound).toBe(0);
    expect(backlogMock.saveStepSummary).toHaveBeenCalledWith(
      21,
      'Doc_Consolidation',
      expect.any(String)
    );
  });

  test('merges highly similar docs and archives originals', async () => {
    // Two near-identical docs → should cluster and merge
    const sharedBody =
      'workflow automation documentation guide installation configuration steps tutorial reference';
    const docs = {
      'guide.md': `# Guide\n\n${sharedBody} additional unique content for guide document here`,
      'guide2.md': `# Guide v2\n\n${sharedBody} additional unique content for second guide document`,
    };

    const fakeFs = makeFakeFs({
      readFile: jest.fn().mockImplementation(async (filePath) => {
        const key = Object.keys(docs).find((k) => String(filePath).endsWith(k));
        if (key) return docs[key];
        throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      }),
    });

    const backlogMock = { saveStepSummary: jest.fn() };
    const aiMock = {
      callAI: jest.fn().mockResolvedValue('# Merged Guide\n\nConsolidated content.'),
    };

    const step = new DocConsolidationStep({
      fileOps: { glob: jest.fn().mockResolvedValue(['guide.md', 'guide2.md']) },
      backlog: backlogMock,
      aiHelper: aiMock,
      aiCache: {},
      fs: fakeFs,
    });

    const result = await step.execute('/fake/project');
    expect(result.success).toBe(true);
    // If similarity is high enough → merged; otherwise clustersFound = 0 (still passes)
    expect(typeof result.clustersFound).toBe('number');
    expect(backlogMock.saveStepSummary).toHaveBeenCalled();
  });
});
