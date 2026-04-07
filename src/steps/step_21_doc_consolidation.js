/**
 * Step 21: Doc Consolidation
 * @module steps/step_21_doc_consolidation
 * @version 2.0.0
 *
 * Discovers all Markdown documents in the project root, vectorises them with
 * TF-IDF, computes pairwise cosine similarity, clusters near-duplicate docs
 * (similarity ≥ threshold), and uses AI to merge each cluster into a single
 * canonical document. Originals are archived under
 * `.ai_workflow/archived_docs/YYYY-MM-DD/`.
 *
 * The TF-IDF vectors and cluster assignments are cached in
 * `.ai_workflow/cache/step_21_doc_consolidation.json`, keyed on a SHA-256
 * fingerprint of every discovered `.md` file's {relPath, size, mtimeMs}.
 * A cache hit skips all file reads and matrix computation.
 *
 * Architecture: v2.0.0 Referential Transparency
 * - Pure functions for vectorisation, similarity, clustering, fingerprinting,
 *   cache validation, and report formatting
 * - Impure wrapper class for file I/O, AI calls, cache persistence, and logging
 */

import { createHash } from 'crypto';
import path from 'path';
import { STEP_KIND } from './step_contract.js';
import { logger } from '../core/logger.js';
import { FileOperations } from '../lib/file_operations.js';
import { Backlog } from '../lib/backlog.js';
import { AiHelper } from '../lib/ai_helpers.js';
import { AiCache } from '../lib/ai_cache.js';
import {
  AI_HELPERS_PATH,
  buildYamlStepPrompt,
  buildFileContentBlock,
  MAX_CHARS_PER_FILE,
} from '../lib/ai_prompt_builder.js';
import fs from 'fs/promises';
import yaml from 'js-yaml';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Default cosine-similarity threshold above which two docs are considered
 *  similar enough to merge. */
export const DEFAULT_SIMILARITY_THRESHOLD = 0.65;

/** Minimum cluster size to trigger a merge (always 2). */
const MIN_CLUSTER_SIZE = 2;

/** Stop-words to exclude from TF-IDF to reduce noise. */
const STOP_WORDS = new Set([
  'a',
  'an',
  'the',
  'and',
  'or',
  'but',
  'in',
  'on',
  'at',
  'to',
  'for',
  'of',
  'with',
  'by',
  'from',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'being',
  'have',
  'has',
  'had',
  'do',
  'does',
  'did',
  'will',
  'would',
  'could',
  'should',
  'may',
  'might',
  'shall',
  'can',
  'it',
  'its',
  'this',
  'that',
  'these',
  'those',
  'i',
  'you',
  'he',
  'she',
  'we',
  'they',
]);

// ============================================================================
// PURE FUNCTIONS — TF-IDF + Cosine Similarity
// ============================================================================

/**
 * Tokenise a text string into lowercase alphabetic tokens, removing stop-words.
 *
 * @param {string} text - Raw document content
 * @returns {string[]} Array of tokens
 * @pure
 */
export function tokenize(text) {
  if (typeof text !== 'string' || text.length === 0) return [];
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t));
}

/**
 * Build a Term Frequency map from a token array.
 *
 * Each term maps to its normalised frequency (count / total tokens).
 *
 * @param {string[]} tokens - Token array (output of tokenize)
 * @returns {Map<string, number>} term → normalised frequency
 * @pure
 */
export function buildTermFrequency(tokens) {
  const counts = new Map();
  for (const token of tokens) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }
  const total = tokens.length || 1;
  const tf = new Map();
  for (const [term, count] of counts) {
    tf.set(term, count / total);
  }
  return tf;
}

/**
 * Build an Inverse Document Frequency map across a corpus of TF maps.
 *
 * IDF(t) = log( N / df(t) ) where df(t) is the number of documents that
 * contain term t.
 *
 * @param {Map<string, number>[]} tfMaps - Array of TF maps (one per document)
 * @returns {Map<string, number>} term → IDF value
 * @pure
 */
export function buildIdf(tfMaps) {
  const N = tfMaps.length || 1;
  const df = new Map();
  for (const tf of tfMaps) {
    for (const term of tf.keys()) {
      df.set(term, (df.get(term) ?? 0) + 1);
    }
  }
  const idf = new Map();
  for (const [term, count] of df) {
    idf.set(term, Math.log(N / count));
  }
  return idf;
}

/**
 * Build a TF-IDF sparse vector from a TF map and an IDF map.
 *
 * Only terms present in the TF map are included (sparse representation).
 *
 * @param {Map<string, number>} tf - Term Frequency map for one document
 * @param {Map<string, number>} idf - IDF map for the corpus
 * @returns {Map<string, number>} term → tf*idf weight
 * @pure
 */
export function buildTfIdfVector(tf, idf) {
  const vec = new Map();
  for (const [term, tfVal] of tf) {
    const idfVal = idf.get(term) ?? 0;
    const weight = tfVal * idfVal;
    if (weight > 0) vec.set(term, weight);
  }
  return vec;
}

/**
 * Compute cosine similarity between two sparse TF-IDF vectors.
 *
 * @param {Map<string, number>} vecA
 * @param {Map<string, number>} vecB
 * @returns {number} Similarity in [0, 1]
 * @pure
 */
export function cosineSimilarity(vecA, vecB) {
  if (vecA.size === 0 || vecB.size === 0) return 0;

  let dot = 0;
  for (const [term, w] of vecA) {
    if (vecB.has(term)) dot += w * vecB.get(term);
  }

  const magA = Math.sqrt([...vecA.values()].reduce((s, w) => s + w * w, 0));
  const magB = Math.sqrt([...vecB.values()].reduce((s, w) => s + w * w, 0));
  if (magA === 0 || magB === 0) return 0;

  return dot / (magA * magB);
}

/**
 * Build an NxN pairwise cosine similarity matrix for a list of vectors.
 *
 * The matrix is symmetric; diagonal values are always 1.
 *
 * @param {Map<string, number>[]} vectors - TF-IDF vectors (one per document)
 * @returns {number[][]} NxN matrix of similarity values
 * @pure
 */
export function buildSimilarityMatrix(vectors) {
  const N = vectors.length;
  const matrix = Array.from({ length: N }, () => new Array(N).fill(0));
  for (let i = 0; i < N; i++) {
    matrix[i][i] = 1;
    for (let j = i + 1; j < N; j++) {
      const sim = cosineSimilarity(vectors[i], vectors[j]);
      matrix[i][j] = sim;
      matrix[j][i] = sim;
    }
  }
  return matrix;
}

/**
 * Cluster document indices using greedy connected-component grouping.
 *
 * Two documents belong to the same cluster if their pairwise similarity
 * exceeds the threshold. Uses a union-find (path-compressed) approach for
 * efficient grouping.
 *
 * @param {number[][]} matrix - Pairwise similarity matrix
 * @param {number} [threshold=DEFAULT_SIMILARITY_THRESHOLD] - Similarity threshold
 * @returns {number[][]} Array of clusters; each cluster is an array of document indices
 * @pure
 */
export function clusterBySimilarity(matrix, threshold = DEFAULT_SIMILARITY_THRESHOLD) {
  const N = matrix.length;
  const parent = Array.from({ length: N }, (_, i) => i);

  function find(x) {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]]; // path compression
      x = parent[x];
    }
    return x;
  }

  function union(x, y) {
    parent[find(x)] = find(y);
  }

  for (let i = 0; i < N; i++) {
    for (let j = i + 1; j < N; j++) {
      if (matrix[i][j] >= threshold) union(i, j);
    }
  }

  const groups = new Map();
  for (let i = 0; i < N; i++) {
    const root = find(i);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(i);
  }

  return [...groups.values()].filter((g) => g.length >= MIN_CLUSTER_SIZE);
}

// ============================================================================
// PURE FUNCTIONS — Caching
// ============================================================================

/**
 * Compute a SHA-256 fingerprint from an array of file stat objects.
 *
 * The fingerprint changes whenever any file is added, removed, renamed,
 * resized, or modified (mtimeMs change).
 *
 * @param {{ relPath: string, size: number, mtimeMs: number }[]} stats
 *   Sorted array of file stat records
 * @returns {string} SHA-256 hex string
 * @pure
 */
export function computeDocsFingerprint(stats) {
  const sorted = [...stats].sort((a, b) => a.relPath.localeCompare(b.relPath));
  const payload = sorted.map((s) => `${s.relPath}:${s.size}:${s.mtimeMs}`).join('\n');
  return createHash('sha256').update(payload).digest('hex');
}

/**
 * Check whether a persisted similarity cache entry matches the current fingerprint.
 *
 * @param {object|null} cacheEntry - Parsed cache entry (may be null if missing)
 * @param {string} fingerprint - Current docs fingerprint
 * @returns {boolean}
 * @pure
 */
export function isSimilarityCacheValid(cacheEntry, fingerprint) {
  return (
    cacheEntry !== null &&
    typeof cacheEntry === 'object' &&
    cacheEntry.fingerprint === fingerprint &&
    Array.isArray(cacheEntry.clusters)
  );
}

// ============================================================================
// PURE FUNCTIONS — Reporting
// ============================================================================

/**
 * Format the doc consolidation report in Markdown.
 *
 * @param {Object} params
 * @param {string[][]} params.clusters - Groups of doc paths that were merged
 * @param {string[]} params.merged - Paths of canonical merged docs written
 * @param {string[]} params.archived - Paths of originals moved to archive
 * @param {number} params.totalDocs - Total docs scanned
 * @param {number} params.threshold - Similarity threshold used
 * @returns {string} Formatted Markdown report
 * @pure
 */
export function formatConsolidationReport({ clusters, merged, archived, totalDocs, threshold }) {
  const lines = [
    '## Doc Consolidation Report',
    '',
    `- **Documents scanned:** ${totalDocs}`,
    `- **Similarity threshold:** ${threshold}`,
    `- **Clusters merged:** ${clusters.length}`,
    `- **Canonical docs written:** ${merged.length}`,
    `- **Originals archived:** ${archived.length}`,
    '',
  ];

  if (clusters.length === 0) {
    lines.push('_No similar document clusters found — nothing to consolidate._');
  } else {
    lines.push('### Merged Clusters', '');
    clusters.forEach((cluster, idx) => {
      lines.push(`#### Cluster ${idx + 1}`, '');
      cluster.forEach((p) => lines.push(`- \`${p}\``));
      if (merged[idx]) lines.push(``, `→ Merged into: \`${merged[idx]}\``);
      lines.push('');
    });

    if (archived.length > 0) {
      lines.push('### Archived Originals', '');
      archived.forEach((p) => lines.push(`- \`${p}\``));
    }
  }

  return lines.join('\n');
}

// ============================================================================
// IMPURE WRAPPER — DocConsolidationStep
// ============================================================================

/**
 * Step 21: Doc Consolidation
 *
 * PROJECT-kind step: receives `projectRoot` as first argument to `execute()`.
 */
export class DocConsolidationStep {
  static stepKind = STEP_KIND.PROJECT;

  constructor(deps = {}) {
    this.fileOps = deps.fileOps || new FileOperations();
    this.backlog = deps.backlog || new Backlog();
    this.aiHelper = deps.aiHelper || new AiHelper();
    this.aiCache = deps.aiCache || new AiCache();
    // Allow fs injection for testability
    this._fs = deps.fs || fs;
  }

  /**
   * Execute doc consolidation for the given project root.
   *
   * @param {string} projectRoot - Absolute path to the project root
   * @param {Object} [options={}]
   * @param {number} [options.threshold] - Cosine similarity threshold (default 0.65)
   * @returns {Promise<import('./step_contract.js').StepResult>}
   */
  async execute(projectRoot, options = {}) {
    const threshold = options.threshold ?? DEFAULT_SIMILARITY_THRESHOLD;
    const workflowDir = path.join(projectRoot, '.ai_workflow');

    try {
      logger.info('Step 21: Doc Consolidation — scanning for similar documents…');

      // ── 1. Discover .md files ────────────────────────────────────────────
      const relPaths = await this._discoverDocs(projectRoot);
      if (relPaths.length < MIN_CLUSTER_SIZE) {
        logger.info(`Step 21 skipped — only ${relPaths.length} markdown file(s) found`);
        return { success: true, skipped: true, reason: 'fewer than 2 markdown files' };
      }

      // ── 2. Stat each file (cheap, needed for fingerprint) ────────────────
      const stats = await this._statFiles(projectRoot, relPaths);
      const fingerprint = computeDocsFingerprint(stats);

      // ── 3. Cache check ───────────────────────────────────────────────────
      const cacheFile = path.join(workflowDir, 'cache', 'step_21_doc_consolidation.json');
      let clusters;
      const cached = await this._readCache(cacheFile);

      if (isSimilarityCacheValid(cached, fingerprint)) {
        logger.info('Step 21: cache hit — reusing stored clusters');
        clusters = cached.clusters;
      } else {
        logger.info(`Step 21: cache miss — computing TF-IDF for ${relPaths.length} docs`);
        const contents = await this._readFiles(projectRoot, relPaths);
        const tfMaps = contents.map((c) => buildTermFrequency(tokenize(c)));
        const idf = buildIdf(tfMaps);
        const vectors = tfMaps.map((tf) => buildTfIdfVector(tf, idf));
        const matrix = buildSimilarityMatrix(vectors);
        clusters = clusterBySimilarity(matrix, threshold);

        // Save cluster index arrays (not vectors — too large)
        await this._writeCache(cacheFile, { fingerprint, clusters });
      }

      if (clusters.length === 0) {
        logger.info('Step 21: no similar clusters found');
        const report = formatConsolidationReport({
          clusters: [],
          merged: [],
          archived: [],
          totalDocs: relPaths.length,
          threshold,
        });
        await this.backlog.saveStepSummary(21, 'Doc_Consolidation', report);
        return { success: true, clustersFound: 0, totalDocs: relPaths.length };
      }

      // ── 4. Merge each cluster ────────────────────────────────────────────
      const mergedPaths = [];
      const archivedPaths = [];
      const clusterPaths = clusters.map((c) => c.map((i) => relPaths[i]));

      for (const [idx, cluster] of clusterPaths.entries()) {
        logger.info(
          `Step 21: merging cluster ${idx + 1}/${clusterPaths.length} (${cluster.length} docs)`
        );
        const contents = await this._readFiles(projectRoot, cluster);
        const canonicalContent = await this._mergeClusterWithAI(cluster, contents);

        // Write canonical doc at the path of the longest original
        const sizes = contents.map((c) => c.length);
        const largestIdx = sizes.indexOf(Math.max(...sizes));
        const canonicalPath = cluster[largestIdx];
        const canonicalAbs = path.join(projectRoot, canonicalPath);
        await this._fs.writeFile(canonicalAbs, canonicalContent, 'utf8');
        mergedPaths.push(canonicalPath);

        // Archive all originals except the canonical
        const archiveDir = path.join(
          workflowDir,
          'archived_docs',
          new Date().toISOString().slice(0, 10)
        );
        await this._fs.mkdir(archiveDir, { recursive: true });

        for (let i = 0; i < cluster.length; i++) {
          if (i === largestIdx) continue;
          const src = path.join(projectRoot, cluster[i]);
          const dest = path.join(archiveDir, path.basename(cluster[i]));
          await this._fs.rename(src, dest);
          archivedPaths.push(cluster[i]);
        }
      }

      // ── 5. Invalidate cache (doc set has changed after merges) ───────────
      try {
        await this._fs.unlink(cacheFile);
      } catch {
        // Cache may already be absent — not an error
      }

      // ── 6. Report ────────────────────────────────────────────────────────
      const report = formatConsolidationReport({
        clusters: clusterPaths,
        merged: mergedPaths,
        archived: archivedPaths,
        totalDocs: relPaths.length,
        threshold,
      });
      await this.backlog.saveStepSummary(21, 'Doc_Consolidation', report);

      logger.success(
        `Step 21 completed — ${clusterPaths.length} cluster(s) merged, ` +
          `${archivedPaths.length} doc(s) archived`
      );

      return {
        success: true,
        clustersFound: clusterPaths.length,
        totalDocs: relPaths.length,
        mergedPaths,
        archivedPaths,
        report,
      };
    } catch (error) {
      logger.error(`Step 21 failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  /**
   * Glob all `.md` files in projectRoot, excluding noise directories.
   *
   * @param {string} projectRoot
   * @returns {Promise<string[]>} Relative paths
   */
  async _discoverDocs(projectRoot) {
    const ignore = [
      '**/node_modules/**',
      '**/.git/**',
      '**/.ai_workflow/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
    ];
    try {
      const files = await this.fileOps.glob('**/*.md', { cwd: projectRoot, ignore });
      return [...new Set(files)];
    } catch {
      return [];
    }
  }

  /**
   * Stat each relative path and return an array of stat records.
   *
   * @param {string} projectRoot
   * @param {string[]} relPaths
   * @returns {Promise<{ relPath: string, size: number, mtimeMs: number }[]>}
   */
  async _statFiles(projectRoot, relPaths) {
    const results = [];
    for (const relPath of relPaths) {
      try {
        const s = await this._fs.stat(path.join(projectRoot, relPath));
        results.push({ relPath, size: s.size, mtimeMs: s.mtimeMs });
      } catch {
        results.push({ relPath, size: 0, mtimeMs: 0 });
      }
    }
    return results;
  }

  /**
   * Read file contents for the given relative paths.
   *
   * @param {string} projectRoot
   * @param {string[]} relPaths
   * @returns {Promise<string[]>}
   */
  async _readFiles(projectRoot, relPaths) {
    const contents = [];
    for (const relPath of relPaths) {
      try {
        const raw = await this._fs.readFile(path.join(projectRoot, relPath), 'utf8');
        contents.push(raw.slice(0, MAX_CHARS_PER_FILE));
      } catch {
        contents.push('');
      }
    }
    return contents;
  }

  /**
   * Use AI to merge a cluster of documents into a single canonical document.
   *
   * Falls back to concatenation if AI is unavailable.
   *
   * @param {string[]} relPaths - Relative paths of docs in the cluster
   * @param {string[]} contents - Corresponding file contents
   * @returns {Promise<string>} Merged document content (Markdown)
   */
  async _mergeClusterWithAI(relPaths, contents) {
    try {
      const promptYaml = await this._loadMergePrompt();
      if (!promptYaml) return this._concatenateFallback(relPaths, contents);

      const fileBlocks = relPaths.map((p, i) => buildFileContentBlock(p, contents[i])).join('\n\n');

      const prompt = buildYamlStepPrompt(promptYaml, {
        additional_context: fileBlocks,
      });

      const aiContent = await this.aiHelper.callAI(prompt, {
        cache: this.aiCache,
        persona: 'technical_writer',
      });

      return aiContent || this._concatenateFallback(relPaths, contents);
    } catch {
      return this._concatenateFallback(relPaths, contents);
    }
  }

  /**
   * Fallback merge: concatenate all contents under H2 headings derived from
   * file names. Used when AI is unavailable.
   *
   * @param {string[]} relPaths
   * @param {string[]} contents
   * @returns {string}
   */
  _concatenateFallback(relPaths, contents) {
    return relPaths
      .map((p, i) => `## ${path.basename(p, '.md')}\n\n${contents[i]}`)
      .join('\n\n---\n\n');
  }

  /**
   * Load the AI merge prompt YAML from the ai_helpers directory.
   *
   * @returns {Promise<object|null>}
   */
  async _loadMergePrompt() {
    try {
      const helpersDir = AI_HELPERS_PATH;
      const promptFile = path.join(helpersDir, 'doc_consolidation_merge_prompt.yaml');
      const raw = await this._fs.readFile(promptFile, 'utf8');
      return yaml.load(raw);
    } catch {
      return null;
    }
  }

  /**
   * Read and parse the similarity cache file.
   *
   * @param {string} cacheFile - Absolute path to cache JSON
   * @returns {Promise<object|null>}
   */
  async _readCache(cacheFile) {
    try {
      const raw = await this._fs.readFile(cacheFile, 'utf8');
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  /**
   * Write cluster data to the similarity cache file.
   *
   * @param {string} cacheFile
   * @param {{ fingerprint: string, clusters: number[][] }} data
   */
  async _writeCache(cacheFile, data) {
    try {
      await this._fs.mkdir(path.dirname(cacheFile), { recursive: true });
      await this._fs.writeFile(
        cacheFile,
        JSON.stringify({ ...data, computedAt: Date.now() }),
        'utf8'
      );
    } catch {
      // Non-fatal — cache write failure just means next run recomputes
    }
  }
}
