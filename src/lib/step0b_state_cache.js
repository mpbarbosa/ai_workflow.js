/**
 * @fileoverview Step 0b Doc-State Fingerprint Cache (v2.0.0)
 * @module lib/step0b_state_cache
 *
 * Caches the documentation file-set fingerprint after a step_0b AI run that
 * produced no generated files ("no_files_generated"). On subsequent runs, if
 * the fingerprint matches and the cache is within TTL, the AI phase is skipped
 * entirely — saving tokens when nothing has changed.
 *
 * Architecture: v2.0.0 Referential Transparency
 * - Pure functions: fingerprint computation, validity checks, entry creation
 * - Impure wrapper: file I/O, cache persistence, lifecycle management
 */

import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import logger from '../core/logger.js';

// ============================================================================
// CONSTANTS
// ============================================================================

export const CACHE_VERSION = 1;
export const DEFAULT_TTL_SECONDS = 86400; // 24 hours
export const CACHE_FILENAME = 'step_0b_state.json';
export const DEFAULT_CACHE_DIR = '.ai_workflow/.step_cache';

/** Outcome value written after a 0-file AI run */
export const OUTCOME_NO_FILES = 'no_files_generated';

// ============================================================================
// PURE FUNCTIONS
// ============================================================================

/**
 * Compute a deterministic SHA-256 fingerprint for a set of documentation files.
 *
 * @pure
 * @param {Array<{path: string, content: string}>} docEntries - Sorted doc file entries
 * @returns {string} 64-char hex fingerprint
 */
export function computeDocFingerprint(docEntries) {
  // Sort by path to ensure determinism regardless of discovery order
  const sorted = [...docEntries].sort((a, b) => a.path.localeCompare(b.path));
  const payload = sorted
    .map((e) => `${e.path}:${crypto.createHash('sha256').update(e.content).digest('hex')}`)
    .join('\n');
  return crypto.createHash('sha256').update(payload).digest('hex');
}

/**
 * Determine whether a persisted cache entry is still valid.
 *
 * @pure
 * @param {Object|null} entry - Parsed cache entry (or null if absent/corrupt)
 * @param {string} currentFingerprint - Fingerprint of the current doc set
 * @param {number} nowMs - Current epoch in milliseconds
 * @param {number} [ttlSeconds] - TTL in seconds (default 24 h)
 * @returns {boolean} True when the AI phase can be safely skipped
 */
export function isCacheValid(entry, currentFingerprint, nowMs, ttlSeconds = DEFAULT_TTL_SECONDS) {
  if (!entry || typeof entry !== 'object') return false;
  if (entry.version !== CACHE_VERSION) return false;
  if (entry.lastOutcome !== OUTCOME_NO_FILES) return false;
  if (entry.fingerprint !== currentFingerprint) return false;

  const ageSeconds = (nowMs - entry.timestamp) / 1000;
  return ageSeconds >= 0 && ageSeconds < ttlSeconds;
}

/**
 * Create a cache entry object to be persisted.
 *
 * @pure
 * @param {string} fingerprint - Doc-set fingerprint
 * @param {string} outcome - Outcome string (use OUTCOME_NO_FILES constant)
 * @param {number} docCount - Number of doc files at time of cache
 * @param {number} nowMs - Current epoch in milliseconds
 * @param {number} [ttlSeconds] - TTL in seconds
 * @returns {Object} Cache entry
 */
export function createCacheEntry(
  fingerprint,
  outcome,
  docCount,
  nowMs,
  ttlSeconds = DEFAULT_TTL_SECONDS
) {
  return {
    version: CACHE_VERSION,
    fingerprint,
    lastOutcome: outcome,
    docCount,
    timestamp: nowMs,
    ttlSeconds,
  };
}

/**
 * Parse a raw JSON string into a cache entry, returning null on any error.
 *
 * @pure
 * @param {string} raw - Raw JSON string
 * @returns {Object|null} Parsed entry or null
 */
export function parseCacheEntry(raw) {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    return null;
  } catch {
    return null;
  }
}

/**
 * Decide whether the AI phase should be skipped.
 * Convenience wrapper combining fingerprint + validity check.
 *
 * @pure
 * @param {Object|null} entry - Parsed cache entry
 * @param {Array<{path: string, content: string}>} docEntries - Current doc entries
 * @param {number} nowMs - Current epoch in milliseconds
 * @param {number} [ttlSeconds] - TTL override
 * @returns {{ skip: boolean, fingerprint: string }} Decision + current fingerprint
 */
export function shouldSkipAiPhase(entry, docEntries, nowMs, ttlSeconds = DEFAULT_TTL_SECONDS) {
  const fingerprint = computeDocFingerprint(docEntries);
  return { skip: isCacheValid(entry, fingerprint, nowMs, ttlSeconds), fingerprint };
}

// ============================================================================
// IMPURE WRAPPER — Step0bStateCache
// ============================================================================

/**
 * Manages the on-disk doc-state cache for step_0b.
 *
 * All file I/O is best-effort: errors are logged but never bubble up to
 * callers, so the step always proceeds safely even if the cache is broken.
 */
export class Step0bStateCache {
  /**
   * @param {Object} [options]
   * @param {string} [options.cacheDir] - Directory for the cache file
   * @param {number} [options.ttlSeconds] - Cache TTL in seconds (default 24 h)
   */
  constructor(options = {}) {
    this.cacheDir = options.cacheDir || DEFAULT_CACHE_DIR;
    this.ttlSeconds = options.ttlSeconds || DEFAULT_TTL_SECONDS;
    this.cacheFile = path.join(this.cacheDir, CACHE_FILENAME);
  }

  /**
   * Check whether the AI phase can be skipped for the given doc entries.
   *
   * @param {Array<{path: string, content: string}>} docEntries - Current doc files
   * @returns {Promise<{ skip: boolean, fingerprint: string }>}
   */
  async check(docEntries) {
    const nowMs = Date.now();
    let entry = null;

    try {
      const raw = await fs.readFile(this.cacheFile, 'utf8');
      entry = parseCacheEntry(raw);
    } catch {
      // Cache absent or unreadable — treat as miss
    }

    const result = shouldSkipAiPhase(entry, docEntries, nowMs, this.ttlSeconds);

    if (result.skip) {
      logger.info(
        `Step 0b: doc-state cache HIT — skipping AI phase (fingerprint ${result.fingerprint.slice(0, 8)}…)`
      );
    } else {
      logger.debug(`Step 0b: doc-state cache MISS — will run AI phase`);
    }

    return result;
  }

  /**
   * Persist the current doc-set fingerprint after a 0-file AI run.
   *
   * @param {Array<{path: string, content: string}>} docEntries - Doc files
   * @param {string} [fingerprint] - Pre-computed fingerprint (optional, avoids re-computation)
   * @returns {Promise<void>}
   */
  async persist(docEntries, fingerprint = null) {
    try {
      const fp = fingerprint || computeDocFingerprint(docEntries);
      const entry = createCacheEntry(
        fp,
        OUTCOME_NO_FILES,
        docEntries.length,
        Date.now(),
        this.ttlSeconds
      );
      await fs.mkdir(this.cacheDir, { recursive: true });
      await fs.writeFile(this.cacheFile, JSON.stringify(entry, null, 2), 'utf8');
      logger.debug(`Step 0b: doc-state cache persisted (fingerprint ${fp.slice(0, 8)}…)`);
    } catch (err) {
      logger.debug(`Step 0b: doc-state cache persist failed (non-fatal): ${err.message}`);
    }
  }

  /**
   * Invalidate (delete) the cache file.
   * Called when files were actually generated so the next run re-evaluates.
   *
   * @returns {Promise<void>}
   */
  async invalidate() {
    try {
      await fs.unlink(this.cacheFile);
      logger.debug('Step 0b: doc-state cache invalidated');
    } catch {
      // Already absent — no-op
    }
  }
}

export default Step0bStateCache;
