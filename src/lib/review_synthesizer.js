/**
 * Review synthesizer — merges AI review results from multiple evidence slices.
 *
 * @module lib/review_synthesizer
 */

/**
 * Extract bullet-point signals from a markdown AI review.
 * Returns the text content of each list item (leading marker stripped).
 *
 * @param {string} reviewText
 * @returns {string[]}
 */
export function extractSignals(reviewText) {
  if (!reviewText) return [];
  return reviewText
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^[-*]\s+\S|^\d+\.\s+\S/.test(line))
    .map((line) => line.replace(/^(?:[-*]|\d+\.)\s+/, ''));
}

/**
 * Normalize a signal for cross-review comparison.
 * Strips code spans, bold markers, and collapses whitespace.
 *
 * @param {string} signal
 * @returns {string}
 */
function normalizeSignal(signal) {
  return signal
    .toLowerCase()
    .replace(/`[^`]*`/g, '')
    .replace(/\*\*[^*]*\*\*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Find signals that appear verbatim (after normalization) in more than one review.
 * Returns the set of normalized signal strings that are duplicated.
 *
 * @param {string[]} reviews
 * @returns {Set<string>}
 */
export function findDuplicateSignals(reviews) {
  const seen = new Map();
  const duplicates = new Set();

  reviews.forEach((review, reviewIndex) => {
    for (const signal of extractSignals(review)) {
      const key = normalizeSignal(signal);
      if (!key) continue;
      if (seen.has(key)) {
        if (seen.get(key) !== reviewIndex) duplicates.add(key);
      } else {
        seen.set(key, reviewIndex);
      }
    }
  });

  return duplicates;
}

/**
 * Merge multiple slice review texts into a single document.
 *
 * - Zero reviews → empty string.
 * - One review → returned as-is (no wrapper).
 * - Multiple reviews → each wrapped in a `### <label>` section, joined by `---`.
 *
 * @param {string[]} reviews
 * @param {{ sliceLabel?: (index: number) => string }} [opts]
 * @returns {string}
 */
export function mergeReviews(reviews, opts = {}) {
  const nonEmpty = (reviews ?? []).filter((r) => r?.trim());
  if (nonEmpty.length === 0) return '';
  if (nonEmpty.length === 1) return nonEmpty[0];

  const label = opts.sliceLabel ?? ((i) => `Slice ${i + 1}`);

  return nonEmpty.map((text, i) => `### ${label(i)}\n\n${text}`).join('\n\n---\n\n');
}
