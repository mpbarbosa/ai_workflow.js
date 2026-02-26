/**
 * @fileoverview Commit History Module - Persist and query git commit hash history
 * @module lib/commit_history
 * @version 2.0.0
 * @description
 * Tracks the HEAD commit hash at the end of each ai_workflow.js execution.
 * On the next run, the stored hash is used to compute exactly which files
 * changed since the previous run via `git diff --name-status <hash>..HEAD`.
 *
 * Architecture: Pure functions + impure wrapper (v2.0.0)
 * - Pure functions: History data manipulation (no I/O, deterministic)
 * - Impure wrapper: CommitHistory class for file I/O
 *
 * Storage: <workflowDir>/commit_history.json
 * Part of: AI Workflow Automation (JavaScript/Node.js)
 * Phase: 5 - Git Integration (extension)
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { logger } from '../core/logger.js';

// ============================================================================
// CONSTANTS
// ============================================================================

export const COMMIT_HISTORY_VERSION = '1.0.0';
export const DEFAULT_MAX_RUNS = 50;
export const COMMIT_HISTORY_FILENAME = 'commit_history.json';

// ============================================================================
// PURE FUNCTIONS - Exported for testing and reuse
// ============================================================================

/**
 * Parse raw JSON content into a commit history object.
 * Returns a safe empty history on any parse error.
 *
 * @pure
 * @param {string} content - Raw JSON string from the history file
 * @returns {Object} Commit history object { version, lastRunCommit, runs }
 * @example
 * readCommitHistory('{"version":"1.0.0","lastRunCommit":"abc","runs":[]}')
 * // => { version: '1.0.0', lastRunCommit: 'abc', runs: [] }
 */
export function readCommitHistory(content) {
  if (!content || typeof content !== 'string') {
    return createEmptyHistory();
  }

  try {
    const parsed = JSON.parse(content);
    if (!parsed || typeof parsed !== 'object') {
      return createEmptyHistory();
    }

    return {
      version: parsed.version || COMMIT_HISTORY_VERSION,
      lastRunCommit: typeof parsed.lastRunCommit === 'string' ? parsed.lastRunCommit : null,
      runs: Array.isArray(parsed.runs) ? parsed.runs : [],
    };
  } catch {
    return createEmptyHistory();
  }
}

/**
 * Create an empty (initial) commit history object.
 *
 * @pure
 * @returns {Object} Empty history { version, lastRunCommit: null, runs: [] }
 */
export function createEmptyHistory() {
  return {
    version: COMMIT_HISTORY_VERSION,
    lastRunCommit: null,
    runs: [],
  };
}

/**
 * Get the commit hash from the most recent run, or null if no history exists.
 *
 * @pure
 * @param {Object} history - Commit history object
 * @returns {string|null} The last recorded commit hash, or null
 * @example
 * getLastRunCommit({ lastRunCommit: 'abc123', runs: [] })
 * // => 'abc123'
 */
export function getLastRunCommit(history) {
  if (!history || typeof history !== 'object') {
    return null;
  }
  return typeof history.lastRunCommit === 'string' ? history.lastRunCommit : null;
}

/**
 * Create a single run entry to append to the history.
 *
 * @pure
 * @param {string} hash - Git commit hash (HEAD at time of run)
 * @param {string} runId - Workflow run ID
 * @param {string} timestamp - ISO 8601 timestamp
 * @returns {Object} Run entry { hash, runId, timestamp }
 * @example
 * createRunEntry('abc123', 'workflow_1', '2026-02-21T19:35:37.327Z')
 * // => { hash: 'abc123', runId: 'workflow_1', timestamp: '2026-02-21T19:35:37.327Z' }
 */
export function createRunEntry(hash, runId, timestamp) {
  return {
    hash: String(hash || ''),
    runId: String(runId || ''),
    timestamp: String(timestamp || ''),
  };
}

/**
 * Append a new run entry to the history, updating lastRunCommit.
 * Returns a new history object (immutable).
 *
 * @pure
 * @param {Object} history - Current commit history
 * @param {string} hash - New HEAD commit hash
 * @param {string} runId - Workflow run ID
 * @param {string} timestamp - ISO 8601 timestamp
 * @returns {Object} Updated history object
 * @example
 * appendRunEntry({ version: '1.0.0', lastRunCommit: null, runs: [] }, 'abc', 'wf_1', '2026-...')
 * // => { version: '1.0.0', lastRunCommit: 'abc', runs: [{ hash: 'abc', runId: 'wf_1', ... }] }
 */
export function appendRunEntry(history, hash, runId, timestamp) {
  const base = history && typeof history === 'object' ? history : createEmptyHistory();
  const entry = createRunEntry(hash, runId, timestamp);
  return {
    ...base,
    lastRunCommit: String(hash || ''),
    runs: [...(Array.isArray(base.runs) ? base.runs : []), entry],
  };
}

/**
 * Cap the runs array to the last `maxRuns` entries.
 * Older entries are discarded; `lastRunCommit` is not affected.
 *
 * @pure
 * @param {Object} history - Commit history object
 * @param {number} [maxRuns=DEFAULT_MAX_RUNS] - Maximum number of run entries to keep
 * @returns {Object} History with capped runs array
 * @example
 * capHistory({ lastRunCommit: 'z', runs: ['a','b','c'] }, 2)
 * // => { lastRunCommit: 'z', runs: ['b','c'] }
 */
export function capHistory(history, maxRuns = DEFAULT_MAX_RUNS) {
  if (!history || typeof history !== 'object') {
    return createEmptyHistory();
  }

  const runs = Array.isArray(history.runs) ? history.runs : [];
  const max = typeof maxRuns === 'number' && maxRuns > 0 ? maxRuns : DEFAULT_MAX_RUNS;

  return {
    ...history,
    runs: runs.length > max ? runs.slice(runs.length - max) : runs,
  };
}

/**
 * Serialize a commit history object to JSON string.
 *
 * @pure
 * @param {Object} history - Commit history object
 * @returns {string} Pretty-printed JSON string
 */
export function serializeHistory(history) {
  return JSON.stringify(history, null, 2);
}

/**
 * Validate that a string looks like a git commit hash (7–40 hex characters).
 *
 * @pure
 * @param {string} hash - Hash to validate
 * @returns {boolean} True if it looks like a valid commit hash
 * @example
 * isValidCommitHash('abc123f')  // true
 * isValidCommitHash('xyz')      // false
 */
export function isValidCommitHash(hash) {
  if (!hash || typeof hash !== 'string') {
    return false;
  }
  return /^[a-f0-9]{7,40}$/.test(hash.trim());
}

// ============================================================================
// IMPURE WRAPPER CLASS - Side effects isolated here
// ============================================================================

/**
 * CommitHistory - Persist and query git commit hash history for a project
 * @class
 * @description
 * Reads and writes `commit_history.json` inside the workflow directory.
 * Use `load()` to read from disk, `save(hash, runId)` to persist the current HEAD.
 */
export class CommitHistory {
  /**
   * @param {Object} options
   * @param {string} options.workflowDir - Path to the .ai_workflow directory
   * @param {number} [options.maxRuns=50] - Maximum run entries to keep
   */
  constructor(options = {}) {
    if (!options.workflowDir) {
      throw new Error('CommitHistory requires options.workflowDir');
    }
    this.workflowDir = options.workflowDir;
    this.maxRuns = options.maxRuns || DEFAULT_MAX_RUNS;
    this.filePath = `${this.workflowDir}/${COMMIT_HISTORY_FILENAME}`;
    this._history = null;
  }

  /**
   * Load commit history from disk.
   * If the file does not exist, initializes an empty history.
   * @returns {Object} The loaded (or empty) history object
   */
  load() {
    if (!existsSync(this.filePath)) {
      this._history = createEmptyHistory();
      logger.debug('[CommitHistory] No history file found — starting fresh');
      return this._history;
    }

    try {
      const content = readFileSync(this.filePath, 'utf8');
      this._history = readCommitHistory(content);
      logger.debug(`[CommitHistory] Loaded history; lastRunCommit=${this._history.lastRunCommit}`);
    } catch (err) {
      logger.warn(`[CommitHistory] Failed to read history file: ${err.message} — starting fresh`);
      this._history = createEmptyHistory();
    }

    return this._history;
  }

  /**
   * Get the commit hash from the previous ai_workflow.js run.
   * Must call `load()` first.
   * @returns {string|null} Previous HEAD hash, or null on first run
   */
  getLastRunCommit() {
    if (!this._history) {
      this.load();
    }
    return getLastRunCommit(this._history);
  }

  /**
   * Persist the current HEAD hash as the end-of-run marker.
   * Creates the workflow directory if it does not exist.
   *
   * @param {string} hash - Current HEAD commit hash
   * @param {string} runId - Workflow run ID (e.g. 'workflow_1708539337327')
   * @param {string} [timestamp] - ISO timestamp; defaults to now
   */
  save(hash, runId, timestamp = new Date().toISOString()) {
    if (!isValidCommitHash(hash)) {
      logger.warn(`[CommitHistory] Invalid hash "${hash}" — skipping save`);
      return;
    }

    if (!this._history) {
      this.load();
    }

    let updated = appendRunEntry(this._history, hash, runId, timestamp);
    updated = capHistory(updated, this.maxRuns);
    this._history = updated;

    try {
      const dir = dirname(this.filePath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      writeFileSync(this.filePath, serializeHistory(updated), 'utf8');
      logger.debug(`[CommitHistory] Saved hash=${hash} runId=${runId}`);
    } catch (err) {
      logger.warn(`[CommitHistory] Failed to save history: ${err.message}`);
    }
  }
}

export default CommitHistory;
