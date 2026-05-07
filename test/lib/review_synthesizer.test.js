/**
 * Tests for ReviewSynthesizer
 *
 * @jest-environment node
 */

import {
  extractSignals,
  findDuplicateSignals,
  mergeReviews,
} from '../../src/lib/review_synthesizer.js';

// ---------------------------------------------------------------------------
// extractSignals
// ---------------------------------------------------------------------------

describe('extractSignals', () => {
  test('returns empty array for falsy input', () => {
    expect(extractSignals('')).toEqual([]);
    expect(extractSignals(null)).toEqual([]);
    expect(extractSignals(undefined)).toEqual([]);
  });

  test('extracts dash list items', () => {
    const text = '- Add a test for null input\n- Use beforeEach for shared setup';
    expect(extractSignals(text)).toEqual([
      'Add a test for null input',
      'Use beforeEach for shared setup',
    ]);
  });

  test('extracts asterisk list items', () => {
    const text = '* Rename vague test name\n* Extract repeated setup';
    expect(extractSignals(text)).toEqual(['Rename vague test name', 'Extract repeated setup']);
  });

  test('extracts numbered list items', () => {
    const text = '1. First signal\n2. Second signal\n10. Tenth signal';
    expect(extractSignals(text)).toEqual(['First signal', 'Second signal', 'Tenth signal']);
  });

  test('ignores heading lines and plain paragraphs', () => {
    const text = '## Section\nSome prose here.\n- A real signal';
    expect(extractSignals(text)).toEqual(['A real signal']);
  });

  test('ignores list markers with no content', () => {
    const text = '- \n* \n- valid';
    expect(extractSignals(text)).toEqual(['valid']);
  });
});

// ---------------------------------------------------------------------------
// findDuplicateSignals
// ---------------------------------------------------------------------------

describe('findDuplicateSignals', () => {
  test('returns empty set when no reviews', () => {
    expect(findDuplicateSignals([])).toEqual(new Set());
  });

  test('returns empty set for a single review', () => {
    const review = '- Use `beforeEach` for setup\n- Add edge case for null';
    expect(findDuplicateSignals([review])).toEqual(new Set());
  });

  test('returns empty set when no signals overlap', () => {
    const r1 = '- Add null test';
    const r2 = '- Extract fixture into beforeEach';
    expect(findDuplicateSignals([r1, r2])).toEqual(new Set());
  });

  test('detects identical signal appearing in two different reviews', () => {
    const signal = 'Add a test for the null case';
    const r1 = `- ${signal}\n- Something unique`;
    const r2 = `- Another unique line\n- ${signal}`;
    const dups = findDuplicateSignals([r1, r2]);
    expect(dups.has(signal.toLowerCase())).toBe(true);
  });

  test('normalizes code spans before comparing', () => {
    const r1 = '- Use `beforeEach` for shared setup';
    const r2 = '- Use  for shared setup'; // code span stripped → same after normalization
    const dups = findDuplicateSignals([r1, r2]);
    expect(dups.size).toBe(1);
  });

  test('does not flag a signal that appears twice in the SAME review', () => {
    const review = '- Duplicate line\n- Duplicate line';
    expect(findDuplicateSignals([review])).toEqual(new Set());
  });

  test('detects signal shared across three reviews', () => {
    const shared = 'Replace expect(arr.length) with toHaveLength';
    const reviews = [`- ${shared}\n- Unique A`, `- Unique B`, `- Unique C\n- ${shared}`];
    const dups = findDuplicateSignals(reviews);
    expect(dups.has(shared.toLowerCase())).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// mergeReviews
// ---------------------------------------------------------------------------

describe('mergeReviews', () => {
  test('returns empty string for empty array', () => {
    expect(mergeReviews([])).toBe('');
  });

  test('returns empty string when all reviews are blank', () => {
    expect(mergeReviews(['', '  ', '\n'])).toBe('');
  });

  test('returns single review unchanged', () => {
    const review = '## Summary\n\n- Signal A\n- Signal B';
    expect(mergeReviews([review])).toBe(review);
  });

  test('skips empty reviews among non-empty ones (single survivor)', () => {
    const review = '- Only real review';
    expect(mergeReviews(['', review, ''])).toBe(review);
  });

  test('wraps multiple reviews with default slice labels', () => {
    const r1 = 'Review one content';
    const r2 = 'Review two content';
    const result = mergeReviews([r1, r2]);
    expect(result).toContain('### Slice 1');
    expect(result).toContain('Review one content');
    expect(result).toContain('### Slice 2');
    expect(result).toContain('Review two content');
    expect(result).toContain('---');
  });

  test('uses custom sliceLabel function', () => {
    const r1 = 'content A';
    const r2 = 'content B';
    const result = mergeReviews([r1, r2], {
      sliceLabel: (i) => `Custom ${i}`,
    });
    expect(result).toContain('### Custom 0');
    expect(result).toContain('### Custom 1');
  });

  test('continuation label names the absent artifact path', () => {
    const initial = 'Initial review content';
    const continuation = 'Continuation review content';
    const absentPath = 'src/__tests__/large.test.ts';

    const result = mergeReviews([initial, continuation], {
      sliceLabel: (i) => (i === 0 ? 'Slice 1' : `Continuation: ${absentPath}`),
    });
    expect(result).toContain('### Slice 1');
    expect(result).toContain(`### Continuation: ${absentPath}`);
    expect(result).toContain('Initial review content');
    expect(result).toContain('Continuation review content');
  });

  test('handles null/undefined entries gracefully', () => {
    const review = 'Valid content';
    expect(mergeReviews([null, review, undefined])).toBe(review);
  });
});

// ---------------------------------------------------------------------------
// acceptance: continuation slice findings appear in merged output
// ---------------------------------------------------------------------------

describe('Phase 5 acceptance — continuation merging', () => {
  test('absent artifact findings appear in merged result', () => {
    const initialReview = '- Finding from initial slice for small.test.js';
    const continuationReview = '- Finding from continuation slice for large.test.js';

    const absentPath = 'src/__tests__/large.test.js';
    const result = mergeReviews([initialReview, continuationReview], {
      sliceLabel: (i) => (i === 0 ? 'Slice 1' : `Continuation: ${absentPath}`),
    });

    expect(result).toContain('Finding from initial slice');
    expect(result).toContain('Finding from continuation slice');
    expect(result).toContain(absentPath);
  });

  test('noContinuation: single review returned as-is without slice header', () => {
    // When only one review is passed (continuation skipped), no wrapper added
    const singleReview = '- Only finding from initial slice';
    expect(mergeReviews([singleReview])).toBe(singleReview);
  });
});
