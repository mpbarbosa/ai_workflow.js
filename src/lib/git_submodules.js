/**
 * @fileoverview Git Submodules Module - Full git submodule lifecycle management
 * @module lib/git_submodules
 * @version 2.0.0
 * @description
 * Provides comprehensive git submodule operations following the v2.0.0
 * referential transparency architecture: pure functions for parsing/validation
 * and an impure wrapper class (GitSubmodules) for I/O operations.
 *
 * Supports: status, init, update, sync, add, deinit, foreach operations.
 *
 * Architecture: Pure functions + impure wrapper (v2.0.0)
 * - Pure functions: Command building, output parsing, state validation
 * - Impure wrapper: GitSubmodules class for command execution and I/O
 *
 * Part of: Tests & Documentation Workflow Automation (JavaScript/Node.js)
 * Phase: 5 - Git Integration
 */

import { execSync } from 'child_process';
import logger from '../core/logger.js';
import { ExecutionError, ValidationError } from '../utils/errors.js';

// ============================================================================
// CONSTANTS
// ============================================================================

export const SUBMODULE_STATUS = {
  INITIALIZED: 'initialized',
  UNINITIALIZED: 'uninitialized',
  MODIFIED: 'modified',
  MERGE_CONFLICT: 'merge_conflict',
};

export const SUBMODULE_COMMANDS = {
  status: 'git submodule status',
  statusRecursive: 'git submodule status --recursive',
  init: 'git submodule init',
  update: 'git submodule update --init --recursive',
  updateRemote: 'git submodule update --remote --merge',
  sync: 'git submodule sync',
  syncRecursive: 'git submodule sync --recursive',
  foreach: 'git submodule foreach',
  foreachRecursive: 'git submodule foreach --recursive',
  hasConfig: 'git config --file .gitmodules --list',
};

// ============================================================================
// PURE FUNCTIONS - Exported for testing and reuse
// ============================================================================

/**
 * Parse `git submodule status` output into structured data.
 * Status prefix characters:
 *   ' '  - initialized, commit matches registered
 *   '-'  - uninitialized (not yet checked out)
 *   '+'  - checked out, but different commit than registered
 *   'U'  - merge conflicts
 * @pure
 * @param {string} output - Raw output from `git submodule status`
 * @returns {Array<Object>} Array of submodule objects
 * @example
 * parseSubmoduleStatus(' abc123 .workflow_core (heads/main)')
 * // => [{ status: 'initialized', commit: 'abc123', path: '.workflow_core', branch: 'heads/main' }]
 */
export function parseSubmoduleStatus(output) {
  if (!output || typeof output !== 'string') return [];

  // Do NOT trim the full output — the leading space is a status character.
  const lines = output.split('\n').filter((l) => l.trim().length > 0);

  return lines
    .map((line) => {
      // Format: [status_char]<commit> <path> [(<branch>)]
      const match = line.match(/^([ \-+U])([0-9a-f]{40})\s+(\S+)(?:\s+\(([^)]+)\))?/);
      if (!match) return null;

      const [, statusChar, commit, path, branch] = match;
      const statusMap = {
        ' ': SUBMODULE_STATUS.INITIALIZED,
        '-': SUBMODULE_STATUS.UNINITIALIZED,
        '+': SUBMODULE_STATUS.MODIFIED,
        U: SUBMODULE_STATUS.MERGE_CONFLICT,
      };

      return {
        status: statusMap[statusChar] || SUBMODULE_STATUS.INITIALIZED,
        commit,
        path,
        branch: branch || null,
      };
    })
    .filter(Boolean);
}

/**
 * Parse `.gitmodules` config output into structured submodule definitions.
 * @pure
 * @param {string} output - Output from `git config --file .gitmodules --list`
 * @returns {Array<Object>} Array of submodule config objects { name, path, url, branch }
 * @example
 * parseSubmoduleConfig('submodule..workflow_core.url=https://github.com/x/y.git\nsubmodule..workflow_core.path=.workflow_core')
 * // => [{ name: '.workflow_core', path: '.workflow_core', url: 'https://...', branch: null }]
 */
export function parseSubmoduleConfig(output) {
  if (!output || typeof output !== 'string') return [];

  const entries = {};

  output
    .trim()
    .split('\n')
    .filter((l) => l.trim().length > 0)
    .forEach((line) => {
      const eqIdx = line.indexOf('=');
      if (eqIdx === -1) return;
      const key = line.slice(0, eqIdx);
      const value = line.slice(eqIdx + 1);

      // key: submodule.<name>.<field>
      const keyMatch = key.match(/^submodule\.(.+)\.(url|path|branch|update|shallow)$/);
      if (!keyMatch) return;

      const [, name, field] = keyMatch;
      if (!entries[name]) entries[name] = { name, path: null, url: null, branch: null };
      entries[name][field] = value;
    });

  return Object.values(entries);
}

/**
 * Check whether the submodule config output indicates any submodules exist.
 * @pure
 * @param {string} configOutput - Output from `git config --file .gitmodules --list`
 * @returns {boolean}
 */
export function hasSubmodules(configOutput) {
  return typeof configOutput === 'string' && configOutput.trim().length > 0;
}

/**
 * Check whether a parsed submodule is uninitialized (not yet checked out).
 * @pure
 * @param {Object} submodule - Parsed submodule object
 * @returns {boolean}
 */
export function isSubmoduleInitialized(submodule) {
  if (!submodule) return false;
  return submodule.status !== SUBMODULE_STATUS.UNINITIALIZED;
}

/**
 * Check whether a parsed submodule is at a different commit than registered.
 * @pure
 * @param {Object} submodule - Parsed submodule object
 * @returns {boolean}
 */
export function isSubmoduleModified(submodule) {
  return submodule?.status === SUBMODULE_STATUS.MODIFIED;
}

/**
 * Check whether a parsed submodule has merge conflicts.
 * @pure
 * @param {Object} submodule - Parsed submodule object
 * @returns {boolean}
 */
export function hasSubmoduleMergeConflict(submodule) {
  return submodule?.status === SUBMODULE_STATUS.MERGE_CONFLICT;
}

/**
 * Filter submodules by status.
 * @pure
 * @param {Array<Object>} submodules - Parsed submodule list
 * @param {string} status - One of SUBMODULE_STATUS values
 * @returns {Array<Object>} Filtered submodules
 */
export function getSubmodulesByStatus(submodules, status) {
  if (!Array.isArray(submodules)) return [];
  return submodules.filter((s) => s.status === status);
}

/**
 * Categorize submodules into groups by state.
 * @pure
 * @param {Array<Object>} submodules - Parsed submodule list
 * @returns {Object} { initialized, uninitialized, modified, conflicts }
 */
export function categorizeSubmodules(submodules) {
  if (!Array.isArray(submodules)) {
    return { initialized: [], uninitialized: [], modified: [], conflicts: [] };
  }
  return {
    initialized: getSubmodulesByStatus(submodules, SUBMODULE_STATUS.INITIALIZED),
    uninitialized: getSubmodulesByStatus(submodules, SUBMODULE_STATUS.UNINITIALIZED),
    modified: getSubmodulesByStatus(submodules, SUBMODULE_STATUS.MODIFIED),
    conflicts: getSubmodulesByStatus(submodules, SUBMODULE_STATUS.MERGE_CONFLICT),
  };
}

/**
 * Build a git submodule command string.
 * @pure
 * @param {string} operation - Submodule operation (e.g. 'update', 'init', 'sync')
 * @param {string[]} [flags=[]] - Additional flags (e.g. ['--init', '--recursive'])
 * @param {string} [path=''] - Optional path argument
 * @returns {string} Full command string
 * @example
 * buildSubmoduleCommand('update', ['--init', '--recursive'])
 * // => 'git submodule update --init --recursive'
 */
export function buildSubmoduleCommand(operation, flags = [], path = '') {
  const parts = ['git submodule', operation, ...flags];
  if (path) parts.push(path);
  return parts.filter(Boolean).join(' ');
}

/**
 * Validate a submodule path (must be non-empty, no traversal).
 * @pure
 * @param {string} path - Submodule path
 * @returns {{ valid: boolean, error: string|null }}
 */
export function validateSubmodulePath(path) {
  if (!path || typeof path !== 'string' || path.trim().length === 0) {
    return { valid: false, error: 'Submodule path must be a non-empty string' };
  }
  if (path.includes('..')) {
    return { valid: false, error: 'Submodule path must not contain path traversal (..)' };
  }
  return { valid: true, error: null };
}

/**
 * Format a human-readable summary of submodule states.
 * @pure
 * @param {Array<Object>} submodules - Parsed submodule list
 * @returns {string} Summary string
 */
export function formatSubmoduleSummary(submodules) {
  if (!Array.isArray(submodules) || submodules.length === 0) {
    return 'No submodules found.';
  }
  const { initialized, uninitialized, modified, conflicts } = categorizeSubmodules(submodules);
  const lines = [`Submodules (${submodules.length} total):`];

  submodules.forEach((s) => {
    const icon =
      s.status === SUBMODULE_STATUS.INITIALIZED
        ? '✅'
        : s.status === SUBMODULE_STATUS.UNINITIALIZED
          ? '⚠️'
          : s.status === SUBMODULE_STATUS.MODIFIED
            ? '🔄'
            : '❌';
    const branch = s.branch ? ` (${s.branch})` : '';
    lines.push(`  ${icon} ${s.path}${branch} @ ${s.commit.slice(0, 7)}`);
  });

  const summary = [];
  if (initialized.length) summary.push(`${initialized.length} initialized`);
  if (uninitialized.length) summary.push(`${uninitialized.length} uninitialized`);
  if (modified.length) summary.push(`${modified.length} modified`);
  if (conflicts.length) summary.push(`${conflicts.length} with conflicts`);
  if (summary.length) lines.push(`  Summary: ${summary.join(', ')}`);

  return lines.join('\n');
}

// ============================================================================
// IMPURE WRAPPER CLASS
// ============================================================================

/**
 * GitSubmodules - Manages git submodule lifecycle operations.
 *
 * Uses execSync internally; pass an `executor` option to inject a mock
 * (for testing or integration with the workflow engine).
 *
 * @example
 * const sm = new GitSubmodules({ repoPath: '/path/to/repo' });
 * await sm.initAndUpdate();
 * const submodules = await sm.getAll();
 */
export class GitSubmodules {
  /**
   * @param {Object} [options]
   * @param {string}   [options.repoPath=process.cwd()] - Repository root
   * @param {number}   [options.timeout=30000]          - Command timeout (ms)
   * @param {Object}   [options.executor]               - Injectable executor (for testing)
   * @param {Object}   [options.logger]                 - Injectable logger
   */
  constructor(options = {}) {
    this.repoPath = options.repoPath || process.cwd();
    this.timeout = options.timeout || 30000;
    this._executor = options.executor || null;
    this._log = options.logger || logger;
  }

  // --------------------------------------------------------------------------
  // Public API
  // --------------------------------------------------------------------------

  /**
   * Initialize registered submodules (runs `git submodule init [path]`).
   * @param {string} [submodulePath=''] - Limit to a specific submodule path
   * @returns {Promise<{ success: boolean, output: string }>}
   */
  async init(submodulePath = '') {
    if (submodulePath) {
      const validation = validateSubmodulePath(submodulePath);
      if (!validation.valid) throw new ValidationError(validation.error);
    }
    const cmd = buildSubmoduleCommand('init', [], submodulePath);
    this._log.debug(`Running: ${cmd}`);
    const output = await this._exec(cmd);
    this._log.info(`Submodule init complete${submodulePath ? ` (${submodulePath})` : ''}`);
    return { success: true, output };
  }

  /**
   * Update submodules (`git submodule update --init --recursive [path]`).
   * @param {Object}  [options]
   * @param {boolean} [options.init=true]      - Pass --init flag
   * @param {boolean} [options.recursive=true] - Pass --recursive flag
   * @param {boolean} [options.remote=false]   - Pass --remote --merge (track upstream)
   * @param {string}  [options.path='']        - Limit to a specific submodule path
   * @returns {Promise<{ success: boolean, output: string }>}
   */
  async update(options = {}) {
    const { init = true, recursive = true, remote = false, path: submodulePath = '' } = options;

    if (submodulePath) {
      const validation = validateSubmodulePath(submodulePath);
      if (!validation.valid) throw new ValidationError(validation.error);
    }

    const flags = [];
    if (init) flags.push('--init');
    if (recursive) flags.push('--recursive');
    if (remote) flags.push('--remote', '--merge');

    const cmd = buildSubmoduleCommand('update', flags, submodulePath);
    this._log.debug(`Running: ${cmd}`);
    const output = await this._exec(cmd);
    this._log.info(`Submodule update complete${submodulePath ? ` (${submodulePath})` : ''}`);
    return { success: true, output };
  }

  /**
   * Sync submodule URLs from `.gitmodules` (`git submodule sync [--recursive] [path]`).
   * @param {Object}  [options]
   * @param {boolean} [options.recursive=false] - Sync recursively
   * @param {string}  [options.path='']         - Limit to a specific submodule path
   * @returns {Promise<{ success: boolean, output: string }>}
   */
  async sync(options = {}) {
    const { recursive = false, path: submodulePath = '' } = options;

    if (submodulePath) {
      const validation = validateSubmodulePath(submodulePath);
      if (!validation.valid) throw new ValidationError(validation.error);
    }

    const flags = recursive ? ['--recursive'] : [];
    const cmd = buildSubmoduleCommand('sync', flags, submodulePath);
    this._log.debug(`Running: ${cmd}`);
    const output = await this._exec(cmd);
    this._log.info(`Submodule sync complete${submodulePath ? ` (${submodulePath})` : ''}`);
    return { success: true, output };
  }

  /**
   * Get current status of all submodules (parsed).
   * @returns {Promise<Array<Object>>} Parsed submodule list
   */
  async getAll() {
    try {
      const output = await this._exec(SUBMODULE_COMMANDS.status);
      return parseSubmoduleStatus(output);
    } catch {
      // Repo has no submodules or git submodule status failed
      return [];
    }
  }

  /**
   * Check whether the repository has any configured submodules.
   * @returns {Promise<boolean>}
   */
  async hasAny() {
    try {
      const output = await this._exec(SUBMODULE_COMMANDS.hasConfig);
      return hasSubmodules(output);
    } catch {
      return false;
    }
  }

  /**
   * Get submodule configuration from `.gitmodules`.
   * @returns {Promise<Array<Object>>} Parsed submodule configs
   */
  async getConfig() {
    try {
      const output = await this._exec(SUBMODULE_COMMANDS.hasConfig);
      return parseSubmoduleConfig(output);
    } catch {
      return [];
    }
  }

  /**
   * Run a shell command inside each submodule directory.
   * (`git submodule foreach [--recursive] <command>`)
   * @param {string}  command            - Shell command to run in each submodule
   * @param {boolean} [recursive=false]  - Recurse into nested submodules
   * @returns {Promise<{ success: boolean, output: string }>}
   */
  async foreach(command, recursive = false) {
    if (!command || typeof command !== 'string') {
      throw new ValidationError('foreach requires a non-empty command string');
    }
    const base = recursive ? SUBMODULE_COMMANDS.foreachRecursive : SUBMODULE_COMMANDS.foreach;
    const cmd = `${base} "${command.replace(/"/g, '\\"')}"`;
    this._log.debug(`Running: ${cmd}`);
    const output = await this._exec(cmd);
    return { success: true, output };
  }

  /**
   * Add a new submodule (`git submodule add [-b <branch>] <url> <path>`).
   * @param {string} url            - Remote URL of the submodule
   * @param {string} submodulePath  - Local path for the submodule
   * @param {Object} [options]
   * @param {string} [options.branch] - Branch to track
   * @returns {Promise<{ success: boolean, output: string }>}
   */
  async add(url, submodulePath, options = {}) {
    if (!url || typeof url !== 'string') {
      throw new ValidationError('Submodule URL must be a non-empty string');
    }
    const validation = validateSubmodulePath(submodulePath);
    if (!validation.valid) throw new ValidationError(validation.error);

    const flags = [];
    if (options.branch) flags.push('-b', options.branch);

    const cmd = `git submodule add ${flags.join(' ')} ${url} ${submodulePath}`.trim();
    this._log.debug(`Running: ${cmd}`);
    const output = await this._exec(cmd);
    this._log.info(`Submodule added: ${submodulePath} -> ${url}`);
    return { success: true, output };
  }

  /**
   * Deinitialize a submodule (`git submodule deinit [--force] <path>`).
   * @param {string}  submodulePath - Path of the submodule to deinit
   * @param {boolean} [force=false] - Pass --force flag
   * @returns {Promise<{ success: boolean, output: string }>}
   */
  async deinit(submodulePath, force = false) {
    const validation = validateSubmodulePath(submodulePath);
    if (!validation.valid) throw new ValidationError(validation.error);

    const flags = force ? ['--force'] : [];
    const cmd = buildSubmoduleCommand('deinit', flags, submodulePath);
    this._log.debug(`Running: ${cmd}`);
    const output = await this._exec(cmd);
    this._log.info(`Submodule deinitialized: ${submodulePath}`);
    return { success: true, output };
  }

  /**
   * Initialize and update all submodules recursively.
   * Convenience wrapper for the most common workflow operation.
   * @returns {Promise<{ success: boolean, submodules: Array<Object>, output: string }>}
   */
  async initAndUpdate() {
    this._log.info('Initializing and updating all submodules recursively...');
    const output = await this._exec(SUBMODULE_COMMANDS.update);
    const submodules = await this.getAll();
    this._log.info(formatSubmoduleSummary(submodules));
    return { success: true, submodules, output };
  }

  /**
   * Ensure all submodules are initialized; init+update any that are not.
   * @returns {Promise<{ success: boolean, initialized: Array<string>, alreadyReady: Array<string> }>}
   */
  async ensureInitialized() {
    const submodules = await this.getAll();
    const categories = categorizeSubmodules(submodules);

    const alreadyReady = [
      ...categories.initialized.map((s) => s.path),
      ...categories.modified.map((s) => s.path),
    ];
    const toInit = categories.uninitialized.map((s) => s.path);

    if (toInit.length === 0) {
      this._log.debug('All submodules already initialized');
      return { success: true, initialized: [], alreadyReady };
    }

    this._log.info(
      `Initializing ${toInit.length} uninitialized submodule(s): ${toInit.join(', ')}`
    );
    await this.update({ init: true, recursive: true });

    return { success: true, initialized: toInit, alreadyReady };
  }

  // --------------------------------------------------------------------------
  // Private helpers
  // --------------------------------------------------------------------------

  /**
   * Execute a command, using injected executor if provided.
   * @private
   * @param {string} command
   * @returns {Promise<string>}
   */
  async _exec(command) {
    if (this._executor) {
      if (typeof this._executor.execute === 'function') {
        const result = await this._executor.execute(command, {
          shell: true,
          cwd: this.repoPath,
        });
        return result.stdout || '';
      }
      if (typeof this._executor.executeCommand === 'function') {
        const result = await this._executor.executeCommand(command, {
          shell: true,
          cwd: this.repoPath,
        });
        return result.stdout || '';
      }
    }

    try {
      return execSync(command, {
        cwd: this.repoPath,
        encoding: 'utf8',
        timeout: this.timeout,
        maxBuffer: 10 * 1024 * 1024,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch (error) {
      throw new ExecutionError(`Git submodule command failed: ${command}\n${error.message}`, {
        command,
        stderr: error.stderr,
      });
    }
  }
}

export default GitSubmodules;
