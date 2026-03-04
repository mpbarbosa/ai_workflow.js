/**
 * @fileoverview Step 10 Partition Cache (v2.0.0)
 * @module lib/step10_partition_cache
 *
 * Partitions a project's source-file list into semantic groups and rotates
 * which partition is sent to the AI on each workflow run. This keeps the
 * per-run prompt size small (≤ MAX_PARTITION_SIZE files) while guaranteeing
 * full coverage across successive runs.
 *
 * Architecture: v2.0.0 Referential Transparency
 * - Pure functions: grouping, packing, selection, hashing (deterministic, no I/O)
 * - Impure wrapper: file I/O, state persistence, lifecycle management
 */

import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import logger from '../core/logger.js';

// ============================================================================
// CONSTANTS
// ============================================================================

export const CACHE_VERSION = 1;
export const MAX_PARTITION_SIZE = 5;
export const CACHE_FILENAME = 'step_10_partition.json';
export const DEFAULT_CACHE_DIR = '.ai_workflow/.step_cache';
export const QUALITY_EXEMPT_THRESHOLD = 95;
export const QUALITY_STATE_FILENAME = 'step_10_quality.json';

// ============================================================================
// PURE FUNCTIONS
// ============================================================================

/**
 * Compute a short SHA-256 hash of a sorted file list.
 * Used to detect when the file set has changed between runs.
 *
 * @param {string[]} files - List of file paths
 * @returns {string} 8-char hex digest
 */
export function computeFilesHash(files) {
  const sorted = [...files].sort().join('\n');
  return crypto.createHash('sha256').update(sorted).digest('hex').slice(0, 8);
}

/**
 * Group files by their top-two path segments (e.g. "src/core", "__tests__").
 * Files at the root level (no directory) are grouped under "(root)".
 *
 * @param {string[]} files - List of relative file paths
 * @returns {Object.<string, string[]>} Map of group key → file paths
 */
export function groupFilesByDirectory(files) {
  const groups = {};
  for (const file of files) {
    const parts = file.split('/');
    const key = parts.length >= 3 ? `${parts[0]}/${parts[1]}` : parts[0] || '(root)';
    if (!groups[key]) groups[key] = [];
    groups[key].push(file);
  }
  return groups;
}

/**
 * Pack directory groups into balanced partitions, each containing at most
 * `maxSize` files. Groups are kept together when possible; a group that
 * exceeds `maxSize` on its own is split across consecutive partitions.
 *
 * @param {Object.<string, string[]>} groups - Output of groupFilesByDirectory
 * @param {number} [maxSize=MAX_PARTITION_SIZE] - Max files per partition
 * @returns {Array<{ label: string, files: string[] }>} Ordered partition list
 */
export function buildPartitions(groups, maxSize = MAX_PARTITION_SIZE) {
  const partitions = [];
  let current = { labels: [], files: [] };

  const flush = () => {
    if (current.files.length > 0) {
      partitions.push({ label: current.labels.join(', '), files: [...current.files] });
      current = { labels: [], files: [] };
    }
  };

  for (const [groupKey, groupFiles] of Object.entries(groups)) {
    // If this group alone overflows, split it first
    if (groupFiles.length > maxSize) {
      flush();
      for (let i = 0; i < groupFiles.length; i += maxSize) {
        const slice = groupFiles.slice(i, i + maxSize);
        const suffix = i > 0 ? ` (${Math.floor(i / maxSize) + 1})` : '';
        partitions.push({ label: `${groupKey}${suffix}`, files: slice });
      }
      continue;
    }

    // Would the group overflow the current partition?
    if (current.files.length + groupFiles.length > maxSize) {
      flush();
    }

    current.labels.push(groupKey);
    current.files.push(...groupFiles);
  }

  flush();
  return partitions;
}

/**
 * Select the partition at the given index (wraps around with modulo).
 *
 * @param {Array<{ label: string, files: string[] }>} partitions
 * @param {number} index - Desired partition index
 * @returns {{ label: string, files: string[], index: number, total: number }}
 */
export function selectPartition(partitions, index) {
  if (partitions.length === 0) return { label: '(empty)', files: [], index: 0, total: 0 };
  const safeIndex = ((index % partitions.length) + partitions.length) % partitions.length;
  const p = partitions[safeIndex];
  return { label: p.label, files: p.files, index: safeIndex, total: partitions.length };
}

/**
 * Compute the next rotation index.
 *
 * @param {number} current - Current partition index
 * @param {number} total - Total number of partitions
 * @returns {number} Next index (wraps around)
 */
export function nextPartitionIndex(current, total) {
  if (total <= 0) return 0;
  return (current + 1) % total;
}

/**
 * Create a new cache entry to be persisted.
 *
 * @param {number} partitionIndex - Current partition index
 * @param {Array<{ label: string, files: string[] }>} partitions - All partitions
 * @param {string} filesHash - Hash of the full file list
 * @param {number} now - Current timestamp (ms since epoch)
 * @returns {Object} Cache entry
 */
export function createCacheEntry(partitionIndex, partitions, filesHash, now) {
  return {
    version: CACHE_VERSION,
    partitionIndex,
    totalPartitions: partitions.length,
    filesHash,
    partitionLabels: partitions.map((p) => p.label),
    updatedAt: new Date(now).toISOString(),
  };
}

/**
 * Determine whether a cached entry is still valid for the current file set.
 * Validity requires: same version, same filesHash, and a non-zero partition count.
 *
 * @param {Object|null} entry - Loaded cache entry (or null)
 * @param {string} currentHash - Hash of the current file list
 * @returns {boolean}
 */
export function isCacheValid(entry, currentHash) {
  if (!entry || typeof entry !== 'object') return false;
  if (entry.version !== CACHE_VERSION) return false;
  if (entry.filesHash !== currentHash) return false;
  if (!Number.isInteger(entry.partitionIndex)) return false;
  if (!Number.isInteger(entry.totalPartitions) || entry.totalPartitions <= 0) return false;
  return true;
}

// ============================================================================
// QUALITY-TRACKING PURE FUNCTIONS
// ============================================================================

/**
 * Convert a linter issue count to a 0–100 quality score.
 * 0 issues → 100 (perfect). Each issue subtracts 3 points.
 *
 * @param {number} issueCount - Number of linter issues for the file
 * @returns {number} Score in [0, 100]
 */
export function scoreFromIssueCount(issueCount) {
  if (typeof issueCount !== 'number' || issueCount < 0) return 0;
  return Math.max(0, 100 - issueCount * 3);
}

/**
 * Determine whether a file is exempt from the review rotation.
 * A file is exempt when its score is above QUALITY_EXEMPT_THRESHOLD **and**
 * it has not been recently modified.  Modified files always re-enter rotation.
 *
 * @param {number|undefined} score - Current quality score (undefined = never reviewed)
 * @param {string} filePath - Relative file path
 * @param {string[]} recentlyModified - Files modified in the current workflow run
 * @returns {boolean}
 */
export function isFileExempt(score, filePath, recentlyModified) {
  const modified = Array.isArray(recentlyModified) ? recentlyModified : [];
  if (modified.includes(filePath)) return false; // modified → always back in rotation
  return typeof score === 'number' && score > QUALITY_EXEMPT_THRESHOLD;
}

/**
 * Sort files by review priority (ascending = highest priority first):
 *   1. Recently modified files
 *   2. Unreviewed files (no score yet)
 *   3. Files with lowest quality score
 *
 * @param {string[]} files - File list to sort
 * @param {Object} fileScores - Map of filePath → { score: number, ... }
 * @param {string[]} recentlyModified - Recently modified file paths
 * @returns {string[]} Sorted copy of files
 */
export function sortByPriority(files, fileScores, recentlyModified) {
  const recent = new Set(Array.isArray(recentlyModified) ? recentlyModified : []);
  const scores = fileScores || {};
  return [...files].sort((a, b) => {
    const aRecent = recent.has(a);
    const bRecent = recent.has(b);
    if (aRecent !== bRecent) return aRecent ? -1 : 1;

    const aScore = scores[a]?.score;
    const bScore = scores[b]?.score;
    const aReviewed = typeof aScore === 'number';
    const bReviewed = typeof bScore === 'number';
    if (!aReviewed && !bReviewed) return 0;
    if (!aReviewed) return -1; // unreviewed before reviewed
    if (!bReviewed) return 1;
    return aScore - bScore; // lowest quality first
  });
}

/**
 * Filter out exempt files then sort by priority.
 * Exempt files (score > QUALITY_EXEMPT_THRESHOLD AND not recently modified)
 * are excluded from the rotation this run.
 *
 * @param {string[]} allFiles - Full source file list
 * @param {Object} fileScores - Map of filePath → { score: number, ... }
 * @param {string[]} recentlyModified - Recently modified file paths
 * @returns {string[]} Priority-sorted active candidates
 */
export function filterAndPrioritize(allFiles, fileScores, recentlyModified) {
  const scores = fileScores || {};
  const active = allFiles.filter(
    (f) => !isFileExempt(scores[f]?.score, f, recentlyModified)
  );
  return sortByPriority(active, scores, recentlyModified);
}

/**
 * Merge new per-file issue counts into the existing quality-score map.
 *
 * @param {Object} currentScores - Existing fileScores map
 * @param {Object} newIssues - Map of filePath → issueCount from the linter
 * @param {string[]} reviewedFiles - Files that were part of this review run
 * @param {number} now - Current timestamp (ms since epoch)
 * @returns {Object} Updated fileScores map (immutable — new object)
 */
export function mergeFileScores(currentScores, newIssues, reviewedFiles, now) {
  const updated = { ...(currentScores || {}) };
  const isoNow = new Date(now).toISOString();
  for (const filePath of reviewedFiles) {
    const issueCount = newIssues[filePath] ?? 0;
    updated[filePath] = {
      score: scoreFromIssueCount(issueCount),
      issueCount,
      lastAnalyzed: isoNow,
    };
  }
  return updated;
}

/**
 * Create a fresh quality-state object.
 *
 * @param {Object} [fileScores={}] - Initial per-file scores
 * @returns {{ version: number, fileScores: Object }}
 */
export function createQualityState(fileScores) {
  return { version: 1, fileScores: fileScores || {} };
}

/**
 * Manages the partition rotation state for Step 10.
 *
 * Usage:
 *   const cache = new Step10PartitionCache({ cacheDir: '.ai_workflow/.step_cache' });
 *   const { label, files, index, total } = await cache.getCurrentPartition(sourceFiles);
 *   // ... run AI on `files` ...
 *   await cache.advance(sourceFiles);
 */
export class Step10PartitionCache {
  /**
   * @param {Object} [options]
   * @param {string} [options.cacheDir] - Directory for the state file
   * @param {number} [options.maxPartitionSize] - Max files per partition
   * @param {string} [options.cacheFilename] - Override the partition state filename
   * @param {string} [options.qualityStateFilename] - Override the quality state filename
   */
  constructor(options = {}) {
    this.cacheDir = options.cacheDir || DEFAULT_CACHE_DIR;
    this.maxPartitionSize = options.maxPartitionSize || MAX_PARTITION_SIZE;
    this._cacheFile = path.join(this.cacheDir, options.cacheFilename || CACHE_FILENAME);
    this._qualityStateFile = path.join(this.cacheDir, options.qualityStateFilename || QUALITY_STATE_FILENAME);
    this._entry = null;
  }

  /**
   * Load the persisted partition state from disk.
   * Returns null on missing or corrupt files (safe fallback).
   *
   * @returns {Promise<Object|null>}
   */
  async load() {
    try {
      const raw = await fs.readFile(this._cacheFile, 'utf8');
      this._entry = JSON.parse(raw);
      return this._entry;
    } catch {
      this._entry = null;
      return null;
    }
  }

  /**
   * Save a cache entry to disk.
   *
   * @param {Object} entry - Entry produced by createCacheEntry
   * @returns {Promise<void>}
   */
  async save(entry) {
    await fs.mkdir(this.cacheDir, { recursive: true });
    await fs.writeFile(this._cacheFile, JSON.stringify(entry, null, 2), 'utf8');
    this._entry = entry;
  }

  /**
   * Get the partition to review this run.
   *
   * - If the file set has changed (hash mismatch), rebuilds all partitions and
   *   starts from index 0.
   * - Otherwise, returns the partition at the stored index (without advancing).
   *
   * @param {string[]} files - Full deduplicated source file list
   * @returns {Promise<{ label: string, files: string[], index: number, total: number }>}
   */
  async getCurrentPartition(files) {
    const filesHash = computeFilesHash(files);
    await this.load();

    const groups = groupFilesByDirectory(files);
    const partitions = buildPartitions(groups, this.maxPartitionSize);

    if (isCacheValid(this._entry, filesHash)) {
      const idx = this._entry.partitionIndex;
      logger.debug(
        `[Step10Partition] Using cached index ${idx}/${this._entry.totalPartitions - 1}`
      );
      return selectPartition(partitions, idx);
    }

    // File set changed or no cache — reset to 0 and rebuild
    logger.debug('[Step10Partition] File set changed or no cache — resetting partition index to 0');
    const entry = createCacheEntry(0, partitions, filesHash, Date.now());
    await this.save(entry);
    return selectPartition(partitions, 0);
  }

  /**
   * Advance the rotation index and persist for the next run.
   * Call this after a successful AI review of the current partition.
   *
   * @param {string[]} files - Full deduplicated source file list (to recompute hash)
   * @returns {Promise<number>} The new partition index
   */
  async advance(files) {
    const filesHash = computeFilesHash(files);
    const groups = groupFilesByDirectory(files);
    const partitions = buildPartitions(groups, this.maxPartitionSize);

    const currentIdx = this._entry?.partitionIndex ?? 0;
    const newIdx = nextPartitionIndex(currentIdx, partitions.length);

    const entry = createCacheEntry(newIdx, partitions, filesHash, Date.now());
    await this.save(entry);
    logger.debug(
      `[Step10Partition] Advanced index ${currentIdx} → ${newIdx}/${partitions.length - 1}`
    );
    return newIdx;
  }

  // --------------------------------------------------------------------------
  // Quality-state methods
  // --------------------------------------------------------------------------

  /**
   * Load the quality state from disk.
   * Returns a fresh empty state on missing / corrupt file.
   *
   * @returns {Promise<{ version: number, fileScores: Object }>}
   */
  async loadQualityState() {
    try {
      const raw = await fs.readFile(this._qualityStateFile, 'utf8');
      this._qualityState = JSON.parse(raw);
    } catch {
      this._qualityState = createQualityState({});
    }
    return this._qualityState;
  }

  /**
   * Persist quality state to disk.
   *
   * @param {{ version: number, fileScores: Object }} state
   * @returns {Promise<void>}
   */
  async saveQualityState(state) {
    await fs.mkdir(this.cacheDir, { recursive: true });
    await fs.writeFile(this._qualityStateFile, JSON.stringify(state, null, 2), 'utf8');
    this._qualityState = state;
  }

  /**
   * Return the priority-sorted, exempt-filtered list of files to review this run.
   *
   * Ordering: recently modified → unreviewed → lowest quality score.
   * Files with score > QUALITY_EXEMPT_THRESHOLD that are NOT in recentlyModified
   * are excluded — they re-enter rotation automatically once they are modified.
   *
   * @param {string[]} allFiles - Full deduplicated source file list
   * @param {string[]} [recentlyModified=[]] - Files modified in the current run
   * @returns {Promise<string[]>} Priority-ordered active candidates
   */
  async getActiveCandidates(allFiles, recentlyModified = []) {
    await this.loadQualityState();
    const fileScores = this._qualityState?.fileScores || {};
    const candidates = filterAndPrioritize(allFiles, fileScores, recentlyModified);
    const exemptCount = allFiles.length - candidates.length;
    if (exemptCount > 0) {
      logger.debug(
        `[Step10Partition] ${exemptCount} file(s) exempt (score > ${QUALITY_EXEMPT_THRESHOLD})`
      );
    }
    return candidates;
  }

  /**
   * Update per-file quality scores after a review run and persist.
   *
   * @param {Object} perFileIssues - Map of relativeFilePath → linter issue count
   * @param {string[]} reviewedFiles - Files included in the partition that was reviewed
   * @returns {Promise<void>}
   */
  async updateQualityScores(perFileIssues, reviewedFiles) {
    await this.loadQualityState();
    const current = this._qualityState?.fileScores || {};
    const updated = mergeFileScores(current, perFileIssues, reviewedFiles, Date.now());
    await this.saveQualityState(createQualityState(updated));
    logger.debug(
      `[Step10Partition] Quality scores updated for ${reviewedFiles.length} file(s)`
    );
  }
}
