/**
 * Step 02_5 Submodule: Heuristics
 * Purpose: Similarity detection algorithms for documentation optimization
 * Version: 2.0.0
 * Architecture: Referential transparency (pure functions + impure wrapper)
 */

import crypto from 'crypto';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Default similarity thresholds
 */
export const SIMILARITY_THRESHOLDS = {
  EXACT_MATCH: 1.0,
  VERY_HIGH: 0.9,
  HIGH: 0.85,
  MEDIUM: 0.7,
  LOW: 0.5,
};

/**
 * Similarity weight configuration
 */
export const SIMILARITY_WEIGHTS = {
  title: 0.3,
  content: 0.5,
  size: 0.2,
};

/**
 * Common stopwords to exclude from content analysis
 */
const STOPWORDS = new Set([
  'the',
  'and',
  'for',
  'are',
  'but',
  'not',
  'you',
  'all',
  'can',
  'has',
  'was',
  'were',
  'been',
  'have',
  'this',
  'that',
  'with',
  'from',
  'they',
  'what',
  'their',
  'would',
  'make',
  'like',
  'time',
  'just',
  'know',
  'take',
  'into',
  'year',
  'your',
  'some',
  'them',
  'than',
  'then',
  'only',
  'over',
  'also',
  'back',
  'after',
  'work',
  'first',
  'well',
  'even',
  'want',
  'these',
  'most',
]);

// ============================================================================
// PURE FUNCTIONS - Hashing
// ============================================================================

/**
 * Calculate SHA256 hash of content
 * @param {string} content - File content
 * @returns {string} - Hex hash string
 */
export function calculateFileHash(content) {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

/**
 * Find exact duplicates based on content hash
 * @param {Map<string, string>} fileHashes - Map of filename -> hash
 * @returns {Array<Array<string>>} - Groups of duplicate files [[file1, file2], ...]
 */
export function findExactDuplicates(fileHashes) {
  const hashToFiles = new Map();

  // Group files by hash
  for (const [file, hash] of fileHashes.entries()) {
    if (!hashToFiles.has(hash)) {
      hashToFiles.set(hash, []);
    }
    hashToFiles.get(hash).push(file);
  }

  // Return groups with duplicates (more than 1 file)
  return Array.from(hashToFiles.values()).filter((files) => files.length > 1);
}

// ============================================================================
// PURE FUNCTIONS - Levenshtein Distance
// ============================================================================

/**
 * Calculate Levenshtein distance between two strings
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} - Edit distance
 */
export function levenshteinDistance(str1, str2) {
  const len1 = str1.length;
  const len2 = str2.length;

  // Fast path: empty strings
  if (len1 === 0) return len2;
  if (len2 === 0) return len1;

  // For very long strings, use approximation to avoid memory issues
  if (len1 > 1000 || len2 > 1000) {
    return approximateEditDistance(str1, str2);
  }

  // Dynamic programming matrix
  const matrix = Array(len1 + 1)
    .fill(null)
    .map(() => Array(len2 + 1).fill(0));

  // Initialize first row and column
  for (let i = 0; i <= len1; i++) matrix[i][0] = i;
  for (let j = 0; j <= len2; j++) matrix[0][j] = j;

  // Fill matrix
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // deletion
        matrix[i][j - 1] + 1, // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return matrix[len1][len2];
}

/**
 * Approximate edit distance for very long strings
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} - Approximate edit distance
 */
function approximateEditDistance(str1, str2) {
  // Use character frequency difference as approximation
  const freq1 = new Map();
  const freq2 = new Map();

  for (const char of str1) {
    freq1.set(char, (freq1.get(char) || 0) + 1);
  }
  for (const char of str2) {
    freq2.set(char, (freq2.get(char) || 0) + 1);
  }

  // Calculate total frequency difference
  let distance = 0;
  const allChars = new Set([...freq1.keys(), ...freq2.keys()]);

  for (const char of allChars) {
    const count1 = freq1.get(char) || 0;
    const count2 = freq2.get(char) || 0;
    distance += Math.abs(count1 - count2);
  }

  return distance;
}

// ============================================================================
// PURE FUNCTIONS - Title Similarity
// ============================================================================

/**
 * Extract document title from markdown content
 * @param {string} content - Markdown content
 * @param {string} filename - Filename as fallback
 * @returns {string} - Document title
 */
export function extractDocumentTitle(content, filename) {
  // Try to find H1 heading (# Title)
  const h1Match = content.match(/^#\s+(.+)$/m);
  if (h1Match) {
    return h1Match[1].trim();
  }

  // Fallback to filename without extension
  return filename.replace(/\.md$/i, '');
}

/**
 * Normalize title for comparison (lowercase, remove special chars)
 * @param {string} title - Raw title
 * @returns {string} - Normalized title
 */
export function normalizeTitle(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calculate title similarity between two titles
 * @param {string} title1 - First title
 * @param {string} title2 - Second title
 * @returns {number} - Similarity score (0.0 to 1.0)
 */
export function calculateTitleSimilarity(title1, title2) {
  const norm1 = normalizeTitle(title1);
  const norm2 = normalizeTitle(title2);

  // Fast path: identical titles
  if (norm1 === norm2) return 1.0;

  const distance = levenshteinDistance(norm1, norm2);
  const maxLen = Math.max(norm1.length, norm2.length);

  // Avoid division by zero
  if (maxLen === 0) return 0.0;

  // Similarity = 1 - (distance / max_length)
  return Math.max(0.0, 1.0 - distance / maxLen);
}

// ============================================================================
// PURE FUNCTIONS - Content Similarity
// ============================================================================

/**
 * Extract significant words from content (alphanumeric, 4+ chars, no stopwords)
 * @param {string} content - Document content
 * @returns {Set<string>} - Set of significant words
 */
export function extractSignificantWords(content) {
  const words = new Set();
  const matches = content.match(/\b[a-zA-Z]{4,}\b/g) || [];

  for (const word of matches) {
    const normalized = word.toLowerCase();
    if (!STOPWORDS.has(normalized)) {
      words.add(normalized);
    }
  }

  return words;
}

/**
 * Calculate Jaccard similarity coefficient between two sets
 * @param {Set} set1 - First set
 * @param {Set} set2 - Second set
 * @returns {number} - Jaccard coefficient (0.0 to 1.0)
 */
export function calculateJaccardSimilarity(set1, set2) {
  // Fast path: empty sets
  if (set1.size === 0 && set2.size === 0) return 1.0;
  if (set1.size === 0 || set2.size === 0) return 0.0;

  // Calculate intersection
  const intersection = new Set([...set1].filter((x) => set2.has(x)));

  // Calculate union
  const union = new Set([...set1, ...set2]);

  // Jaccard = |intersection| / |union|
  return intersection.size / union.size;
}

/**
 * Calculate content similarity using word overlap
 * @param {string} content1 - First document content
 * @param {string} content2 - Second document content
 * @returns {number} - Similarity score (0.0 to 1.0)
 */
export function calculateContentSimilarity(content1, content2) {
  const words1 = extractSignificantWords(content1);
  const words2 = extractSignificantWords(content2);

  return calculateJaccardSimilarity(words1, words2);
}

// ============================================================================
// PURE FUNCTIONS - Size Similarity
// ============================================================================

/**
 * Calculate size similarity between two documents
 * @param {number} size1 - First document size in bytes
 * @param {number} size2 - Second document size in bytes
 * @returns {number} - Similarity score (0.0 to 1.0)
 */
export function calculateSizeSimilarity(size1, size2) {
  if (size1 === 0 && size2 === 0) return 1.0;
  if (size1 === 0 || size2 === 0) return 0.0;

  const min = Math.min(size1, size2);
  const max = Math.max(size1, size2);

  return min / max;
}

// ============================================================================
// PURE FUNCTIONS - Combined Similarity
// ============================================================================

/**
 * Calculate weighted combined similarity score
 * @param {Object} metrics - Similarity metrics
 * @param {number} metrics.title - Title similarity (0-1)
 * @param {number} metrics.content - Content similarity (0-1)
 * @param {number} metrics.size - Size similarity (0-1)
 * @param {Object} weights - Weight configuration
 * @returns {number} - Combined similarity score (0.0 to 1.0)
 */
export function calculateCombinedSimilarity(metrics, weights = SIMILARITY_WEIGHTS) {
  const { title, content, size } = metrics;
  const { title: wTitle, content: wContent, size: wSize } = weights;

  // Ensure weights sum to 1.0
  const totalWeight = wTitle + wContent + wSize;
  if (Math.abs(totalWeight - 1.0) > 0.01) {
    throw new Error(`Weights must sum to 1.0, got ${totalWeight.toFixed(2)}`);
  }

  return title * wTitle + content * wContent + size * wSize;
}

/**
 * Find redundant document pairs above similarity threshold
 * @param {Array<Object>} files - Array of file objects with {path, content, size}
 * @param {number} threshold - Similarity threshold (0.0 to 1.0)
 * @param {Object} weights - Weight configuration
 * @returns {Array<Object>} - Array of redundant pairs [{file1, file2, similarity, metrics}]
 */
export function findRedundantPairs(files, threshold, weights = SIMILARITY_WEIGHTS) {
  const pairs = [];

  // Compare each pair of files
  for (let i = 0; i < files.length; i++) {
    for (let j = i + 1; j < files.length; j++) {
      const file1 = files[i];
      const file2 = files[j];

      // Extract titles
      const title1 = extractDocumentTitle(file1.content, file1.path);
      const title2 = extractDocumentTitle(file2.content, file2.path);

      // Calculate individual metrics
      const metrics = {
        title: calculateTitleSimilarity(title1, title2),
        content: calculateContentSimilarity(file1.content, file2.content),
        size: calculateSizeSimilarity(file1.size, file2.size),
      };

      // Calculate combined similarity
      const similarity = calculateCombinedSimilarity(metrics, weights);

      // Add to results if above threshold
      if (similarity >= threshold) {
        pairs.push({
          file1: file1.path,
          file2: file2.path,
          similarity: Math.round(similarity * 100) / 100,
          metrics: {
            title: Math.round(metrics.title * 100) / 100,
            content: Math.round(metrics.content * 100) / 100,
            size: Math.round(metrics.size * 100) / 100,
          },
        });
      }
    }
  }

  // Sort by similarity descending
  return pairs.sort((a, b) => b.similarity - a.similarity);
}

// ============================================================================
// HEURISTICS ANALYZER - Impure Wrapper Class
// ============================================================================

/**
 * Heuristics analyzer for document similarity detection
 * Manages file I/O and analysis coordination
 */
export class HeuristicsAnalyzer {
  constructor(options = {}) {
    this.threshold = options.threshold || SIMILARITY_THRESHOLDS.HIGH;
    this.weights = options.weights || SIMILARITY_WEIGHTS;
    this.logger = options.logger || console;
    this.fileOps = options.fileOps || null;
  }

  /**
   * Analyze documents for exact duplicates and redundant pairs
   * @param {Array<string>} filePaths - Array of file paths
   * @param {number} [threshold] - Similarity threshold override
   * @returns {Promise<{exactDuplicates: Array, redundantPairs: Array}>}
   */
  async analyzeDocuments(filePaths, threshold) {
    const effectiveThreshold = threshold !== undefined ? threshold : this.threshold;
    const fileContents = new Map();
    const fileData = new Map();

    for (const file of filePaths) {
      try {
        const content = this.fileOps
          ? await this.fileOps.readFile(file)
          : (await import('fs/promises')).readFile(file, 'utf8');
        fileContents.set(file, content);
        fileData.set(file, { content, size: content.length });
      } catch (error) {
        this.logger.warn(`Could not read ${file}: ${error.message}`);
      }
    }

    const savedThreshold = this.threshold;
    this.threshold = effectiveThreshold;
    const exactDuplicates = this.findDuplicates(fileContents);
    const redundantPairs = this.findRedundant(fileData);
    this.threshold = savedThreshold;

    return { exactDuplicates, redundantPairs };
  }

  /**
   * Analyze files for exact duplicates
   * @param {Map<string, string>} fileContents - Map of filename -> content
   * @returns {Array<Array<string>>} - Groups of duplicate files
   */
  findDuplicates(fileContents) {
    this.logger.info('Calculating content hashes...');

    const hashes = new Map();
    for (const [file, content] of fileContents.entries()) {
      hashes.set(file, calculateFileHash(content));
    }

    const duplicates = findExactDuplicates(hashes);

    this.logger.info(
      `Found ${duplicates.length} duplicate groups (${duplicates.reduce((sum, group) => sum + group.length - 1, 0)} redundant files)`
    );

    return duplicates;
  }

  /**
   * Analyze files for similar (redundant) documents
   * @param {Map<string, Object>} fileData - Map of filename -> {content, size}
   * @returns {Array<Object>} - Redundant pairs
   */
  findRedundant(fileData) {
    this.logger.info('Analyzing document similarity...');

    // Convert map to array format
    const files = Array.from(fileData.entries()).map(([path, data]) => ({
      path,
      content: data.content,
      size: data.size,
    }));

    const pairs = findRedundantPairs(files, this.threshold, this.weights);

    this.logger.info(
      `Found ${pairs.length} redundant pairs above ${(this.threshold * 100).toFixed(0)}% similarity`
    );

    return pairs;
  }

  /**
   * Get summary statistics
   * @param {Array} duplicates - Duplicate groups
   * @param {Array} redundant - Redundant pairs
   * @returns {Object} - Statistics summary
   */
  getSummary(duplicates, redundant) {
    return {
      exactDuplicates: {
        groups: duplicates.length,
        files: duplicates.reduce((sum, group) => sum + group.length - 1, 0),
      },
      redundantPairs: {
        count: redundant.length,
        avgSimilarity:
          redundant.length > 0
            ? Math.round(
                (redundant.reduce((sum, p) => sum + p.similarity, 0) / redundant.length) * 100
              ) / 100
            : 0,
      },
    };
  }
}
