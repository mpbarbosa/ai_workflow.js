/**
 * Tests for Step 02_5 Heuristics Module
 * @group steps
 */

import { jest } from '@jest/globals';
import {
  HeuristicsAnalyzer,
  SIMILARITY_THRESHOLDS,
  calculateFileHash,
  findExactDuplicates,
  levenshteinDistance,
  extractDocumentTitle,
  normalizeTitle,
  calculateTitleSimilarity,
  extractSignificantWords,
  calculateJaccardSimilarity,
  calculateContentSimilarity,
  calculateSizeSimilarity,
  calculateCombinedSimilarity,
  findRedundantPairs,
} from '../../../src/steps/step_02_5_lib/heuristics.js';

describe('Step 02_5 Heuristics Module', () => {
  // ==========================================================================
  // PURE FUNCTIONS - Hashing
  // ==========================================================================

  describe('calculateFileHash', () => {
    test('generates consistent hash for same content', () => {
      const content = 'Hello World';
      const hash1 = calculateFileHash(content);
      const hash2 = calculateFileHash(content);
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA256 = 64 hex chars
    });

    test('generates different hashes for different content', () => {
      const hash1 = calculateFileHash('Hello');
      const hash2 = calculateFileHash('World');
      expect(hash1).not.toBe(hash2);
    });

    test('handles empty string', () => {
      const hash = calculateFileHash('');
      expect(hash).toHaveLength(64);
    });
  });

  describe('findExactDuplicates', () => {
    test('identifies duplicate files', () => {
      const hashes = new Map([
        ['file1.md', 'hash123'],
        ['file2.md', 'hash456'],
        ['file3.md', 'hash123'], // duplicate of file1
        ['file4.md', 'hash789'],
      ]);

      const duplicates = findExactDuplicates(hashes);

      expect(duplicates).toHaveLength(1);
      expect(duplicates[0]).toEqual(expect.arrayContaining(['file1.md', 'file3.md']));
    });

    test('returns empty array if no duplicates', () => {
      const hashes = new Map([
        ['file1.md', 'hash1'],
        ['file2.md', 'hash2'],
        ['file3.md', 'hash3'],
      ]);

      const duplicates = findExactDuplicates(hashes);
      expect(duplicates).toEqual([]);
    });

    test('handles multiple duplicate groups', () => {
      const hashes = new Map([
        ['file1.md', 'hashA'],
        ['file2.md', 'hashA'],
        ['file3.md', 'hashB'],
        ['file4.md', 'hashB'],
        ['file5.md', 'hashC'],
      ]);

      const duplicates = findExactDuplicates(hashes);
      expect(duplicates).toHaveLength(2);
    });
  });

  // ==========================================================================
  // PURE FUNCTIONS - Levenshtein Distance
  // ==========================================================================

  describe('levenshteinDistance', () => {
    test('returns 0 for identical strings', () => {
      expect(levenshteinDistance('hello', 'hello')).toBe(0);
    });

    test('returns length for completely different strings', () => {
      expect(levenshteinDistance('abc', 'xyz')).toBe(3);
    });

    test('handles empty strings', () => {
      expect(levenshteinDistance('', 'hello')).toBe(5);
      expect(levenshteinDistance('hello', '')).toBe(5);
      expect(levenshteinDistance('', '')).toBe(0);
    });

    test('calculates insertion distance', () => {
      expect(levenshteinDistance('cat', 'cats')).toBe(1);
    });

    test('calculates deletion distance', () => {
      expect(levenshteinDistance('cats', 'cat')).toBe(1);
    });

    test('calculates substitution distance', () => {
      expect(levenshteinDistance('cat', 'bat')).toBe(1);
    });

    test('handles complex edits', () => {
      expect(levenshteinDistance('kitten', 'sitting')).toBe(3);
    });

    test('uses approximation for very long strings', () => {
      const long1 = 'a'.repeat(1500);
      const long2 = 'b'.repeat(1500);
      const distance = levenshteinDistance(long1, long2);
      expect(distance).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // PURE FUNCTIONS - Title Similarity
  // ==========================================================================

  describe('extractDocumentTitle', () => {
    test('extracts H1 heading from markdown', () => {
      const content = '# My Title\n\nSome content';
      expect(extractDocumentTitle(content, 'file.md')).toBe('My Title');
    });

    test('falls back to filename without extension', () => {
      const content = 'No heading here';
      expect(extractDocumentTitle(content, 'my-document.md')).toBe('my-document');
    });

    test('handles multiple headings', () => {
      const content = '# First Title\n## Second\n# Third';
      expect(extractDocumentTitle(content, 'file.md')).toBe('First Title');
    });
  });

  describe('normalizeTitle', () => {
    test('converts to lowercase', () => {
      expect(normalizeTitle('HELLO')).toBe('hello');
    });

    test('removes special characters', () => {
      expect(normalizeTitle('Hello-World!')).toBe('hello world');
    });

    test('normalizes whitespace', () => {
      expect(normalizeTitle('Hello   World')).toBe('hello world');
    });

    test('trims whitespace', () => {
      expect(normalizeTitle('  Hello World  ')).toBe('hello world');
    });
  });

  describe('calculateTitleSimilarity', () => {
    test('returns 1.0 for identical titles', () => {
      expect(calculateTitleSimilarity('Hello World', 'Hello World')).toBe(1.0);
    });

    test('returns high similarity for minor differences', () => {
      const similarity = calculateTitleSimilarity('Hello World', 'Hello Worlds');
      expect(similarity).toBeGreaterThan(0.9);
    });

    test('returns low similarity for very different titles', () => {
      const similarity = calculateTitleSimilarity('Hello', 'Goodbye');
      expect(similarity).toBeLessThan(0.5);
    });

    test('handles empty titles', () => {
      expect(calculateTitleSimilarity('', '')).toBe(1.0); // Empty titles are identical
    });
  });

  // ==========================================================================
  // PURE FUNCTIONS - Content Similarity
  // ==========================================================================

  describe('extractSignificantWords', () => {
    test('extracts words 4+ characters', () => {
      const content = 'The quick brown fox jumps';
      const words = extractSignificantWords(content);
      expect(words.has('quick')).toBe(true);
      expect(words.has('brown')).toBe(true);
      expect(words.has('jumps')).toBe(true);
      expect(words.has('fox')).toBe(false); // only 3 chars
    });

    test('filters stopwords', () => {
      const content = 'The quick brown fox with the lazy dog';
      const words = extractSignificantWords(content);
      expect(words.has('quick')).toBe(true);
      expect(words.has('the')).toBe(false); // stopword
      expect(words.has('with')).toBe(false); // stopword
    });

    test('normalizes to lowercase', () => {
      const content = 'HELLO World';
      const words = extractSignificantWords(content);
      expect(words.has('hello')).toBe(true);
      expect(words.has('world')).toBe(true);
      expect(words.has('HELLO')).toBe(false);
    });

    test('handles empty content', () => {
      const words = extractSignificantWords('');
      expect(words.size).toBe(0);
    });
  });

  describe('calculateJaccardSimilarity', () => {
    test('returns 1.0 for identical sets', () => {
      const set1 = new Set(['hello', 'world']);
      const set2 = new Set(['hello', 'world']);
      expect(calculateJaccardSimilarity(set1, set2)).toBe(1.0);
    });

    test('returns 0.0 for completely different sets', () => {
      const set1 = new Set(['hello']);
      const set2 = new Set(['world']);
      expect(calculateJaccardSimilarity(set1, set2)).toBe(0.0);
    });

    test('calculates partial overlap', () => {
      const set1 = new Set(['hello', 'world', 'foo']);
      const set2 = new Set(['hello', 'world', 'bar']);
      // Intersection: {hello, world} = 2
      // Union: {hello, world, foo, bar} = 4
      // Similarity = 2/4 = 0.5
      expect(calculateJaccardSimilarity(set1, set2)).toBe(0.5);
    });

    test('handles empty sets', () => {
      const set1 = new Set();
      const set2 = new Set();
      expect(calculateJaccardSimilarity(set1, set2)).toBe(1.0);
    });
  });

  describe('calculateContentSimilarity', () => {
    test('returns high similarity for similar content', () => {
      const content1 = 'The quick brown fox jumps over the lazy dog';
      const content2 = 'The quick brown fox leaps over the lazy dog';
      const similarity = calculateContentSimilarity(content1, content2);
      expect(similarity).toBeGreaterThan(0.5); // Adjusted threshold
    });

    test('returns low similarity for different content', () => {
      const content1 = 'JavaScript programming language';
      const content2 = 'Python data science framework';
      const similarity = calculateContentSimilarity(content1, content2);
      expect(similarity).toBeLessThan(0.5);
    });
  });

  // ==========================================================================
  // PURE FUNCTIONS - Size Similarity
  // ==========================================================================

  describe('calculateSizeSimilarity', () => {
    test('returns 1.0 for identical sizes', () => {
      expect(calculateSizeSimilarity(1000, 1000)).toBe(1.0);
    });

    test('returns ratio for different sizes', () => {
      expect(calculateSizeSimilarity(500, 1000)).toBe(0.5);
      expect(calculateSizeSimilarity(1000, 500)).toBe(0.5);
    });

    test('handles zero sizes', () => {
      expect(calculateSizeSimilarity(0, 0)).toBe(1.0);
      expect(calculateSizeSimilarity(0, 100)).toBe(0.0);
    });

    test('returns high similarity for close sizes', () => {
      expect(calculateSizeSimilarity(990, 1000)).toBeGreaterThan(0.98);
    });
  });

  // ==========================================================================
  // PURE FUNCTIONS - Combined Similarity
  // ==========================================================================

  describe('calculateCombinedSimilarity', () => {
    test('calculates weighted average correctly', () => {
      const metrics = { title: 0.8, content: 0.6, size: 0.9 };
      const weights = { title: 0.3, content: 0.5, size: 0.2 };
      // Expected: 0.8*0.3 + 0.6*0.5 + 0.9*0.2 = 0.24 + 0.30 + 0.18 = 0.72
      expect(calculateCombinedSimilarity(metrics, weights)).toBeCloseTo(0.72, 2);
    });

    test('uses default weights', () => {
      const metrics = { title: 1.0, content: 1.0, size: 1.0 };
      expect(calculateCombinedSimilarity(metrics)).toBe(1.0);
    });

    test('throws error if weights do not sum to 1.0', () => {
      const metrics = { title: 0.5, content: 0.5, size: 0.5 };
      const badWeights = { title: 0.5, content: 0.5, size: 0.5 };
      expect(() => calculateCombinedSimilarity(metrics, badWeights)).toThrow(
        'Weights must sum to 1.0'
      );
    });
  });

  describe('findRedundantPairs', () => {
    test('identifies redundant document pairs', () => {
      const files = [
        { path: 'doc1.md', content: '# Doc 1\nHello world test', size: 100 },
        { path: 'doc2.md', content: '# Doc 1\nHello world test', size: 100 },
        { path: 'doc3.md', content: '# Different\nCompletely different', size: 200 },
      ];

      const pairs = findRedundantPairs(files, 0.5);

      expect(pairs.length).toBeGreaterThan(0);
      expect(pairs[0]).toHaveProperty('file1');
      expect(pairs[0]).toHaveProperty('file2');
      expect(pairs[0]).toHaveProperty('similarity');
      expect(pairs[0]).toHaveProperty('metrics');
    });

    test('filters by threshold', () => {
      const files = [
        { path: 'doc1.md', content: '# Title\nContent here', size: 100 },
        { path: 'doc2.md', content: '# Title\nContent here', size: 100 },
      ];

      const highThreshold = findRedundantPairs(files, 0.99);
      const lowThreshold = findRedundantPairs(files, 0.5);

      expect(highThreshold.length).toBeLessThanOrEqual(lowThreshold.length);
    });

    test('sorts by similarity descending', () => {
      const files = [
        { path: 'doc1.md', content: '# A\nSome content', size: 100 },
        { path: 'doc2.md', content: '# A\nSome content words', size: 110 },
        { path: 'doc3.md', content: '# B\nDifferent stuff', size: 200 },
      ];

      const pairs = findRedundantPairs(files, 0.3);

      for (let i = 1; i < pairs.length; i++) {
        expect(pairs[i - 1].similarity).toBeGreaterThanOrEqual(pairs[i].similarity);
      }
    });

    test('returns empty array if no pairs above threshold', () => {
      const files = [
        { path: 'doc1.md', content: '# A\nSome content', size: 100 },
        { path: 'doc2.md', content: '# B\nDifferent stuff', size: 200 },
      ];

      const pairs = findRedundantPairs(files, 0.99);
      expect(pairs).toEqual([]);
    });
  });

  // ==========================================================================
  // HEURISTICS ANALYZER - Integration Tests
  // ==========================================================================

  describe('HeuristicsAnalyzer', () => {
    let mockLogger;
    let analyzer;

    beforeEach(() => {
      mockLogger = {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      };
      analyzer = new HeuristicsAnalyzer({ logger: mockLogger });
    });

    test('constructs with default options', () => {
      const defaultAnalyzer = new HeuristicsAnalyzer();
      expect(defaultAnalyzer.threshold).toBe(SIMILARITY_THRESHOLDS.HIGH);
    });

    test('constructs with custom options', () => {
      const customAnalyzer = new HeuristicsAnalyzer({
        threshold: 0.75,
        weights: { title: 0.4, content: 0.4, size: 0.2 },
      });
      expect(customAnalyzer.threshold).toBe(0.75);
      expect(customAnalyzer.weights.title).toBe(0.4);
    });

    test('findDuplicates identifies exact duplicates', () => {
      const contents = new Map([
        ['file1.md', 'Hello World'],
        ['file2.md', 'Hello World'], // duplicate
        ['file3.md', 'Different content'],
      ]);

      const duplicates = analyzer.findDuplicates(contents);

      expect(duplicates.length).toBeGreaterThan(0);
      expect(mockLogger.info).toHaveBeenCalled();
    });

    test('findRedundant identifies similar documents', () => {
      const fileData = new Map([
        ['doc1.md', { content: '# Title\nSome content here', size: 100 }],
        ['doc2.md', { content: '# Title\nSome content here', size: 100 }],
        ['doc3.md', { content: '# Different\nOther stuff', size: 200 }],
      ]);

      const redundant = analyzer.findRedundant(fileData);

      expect(redundant.length).toBeGreaterThan(0);
      expect(mockLogger.info).toHaveBeenCalled();
    });

    test('getSummary returns statistics', () => {
      const duplicates = [
        ['file1.md', 'file2.md'],
        ['file3.md', 'file4.md'],
      ];
      const redundant = [
        { file1: 'a.md', file2: 'b.md', similarity: 0.9 },
        { file1: 'c.md', file2: 'd.md', similarity: 0.8 },
      ];

      const summary = analyzer.getSummary(duplicates, redundant);

      expect(summary.exactDuplicates.groups).toBe(2);
      expect(summary.exactDuplicates.files).toBe(2);
      expect(summary.redundantPairs.count).toBe(2);
      expect(summary.redundantPairs.avgSimilarity).toBeCloseTo(0.85, 2);
    });

    test('getSummary handles empty results', () => {
      const summary = analyzer.getSummary([], []);

      expect(summary.exactDuplicates.groups).toBe(0);
      expect(summary.exactDuplicates.files).toBe(0);
      expect(summary.redundantPairs.count).toBe(0);
      expect(summary.redundantPairs.avgSimilarity).toBe(0);
    });
  });
});
