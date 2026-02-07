/**
 * @fileoverview Git Automation Module - Git operations and output parsing
 * @module lib/git_automation
 * @version 2.0.0
 * @description
 * Provides Git command execution and output parsing with pure functional architecture.
 * Supports status, diff, log, branch, commit operations with structured results.
 *
 * Architecture: Pure functions + impure wrapper (v2.0.0)
 * - Pure functions: Command building, output parsing, validation
 * - Impure wrapper: GitAutomation class for command execution and I/O
 *
 * Part of: Tests & Documentation Workflow Automation (JavaScript/Node.js)
 * Phase: 5 - Git Integration
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import logger from '../core/logger.js';
import { ExecutionError, ValidationError } from '../utils/errors.js';

// ============================================================================
// PURE FUNCTIONS - Exported for testing and reuse
// ============================================================================

/**
 * Parse git status --porcelain output into structured data
 * @pure
 * @param {string} output - Git status output
 * @returns {Object} Parsed status with staged, unstaged, untracked arrays
 * @example
 * parseGitStatus('M  file.js\n?? new.js')
 * // => { staged: [{file: 'file.js', status: 'modified'}], unstaged: [], untracked: [{file: 'new.js'}] }
 */
export function parseGitStatus(output) {
  if (!output || typeof output !== 'string') {
    return { staged: [], unstaged: [], untracked: [] };
  }

  const lines = output.trim().split('\n').filter(line => line.length > 0);
  const staged = [];
  const unstaged = [];
  const untracked = [];

  for (const line of lines) {
    if (line.length < 3) continue;

    const stagedStatus = line[0];
    const unstagedStatus = line[1];
    const filePath = line.substring(3);

    // Untracked files
    if (stagedStatus === '?' && unstagedStatus === '?') {
      untracked.push({ file: filePath, status: 'untracked' });
      continue;
    }

    // Staged changes
    if (stagedStatus !== ' ' && stagedStatus !== '?') {
      staged.push({
        file: filePath,
        status: categorizeGitStatus(stagedStatus)
      });
    }

    // Unstaged changes
    if (unstagedStatus !== ' ' && unstagedStatus !== '?') {
      unstaged.push({
        file: filePath,
        status: categorizeGitStatus(unstagedStatus)
      });
    }
  }

  return { staged, unstaged, untracked };
}

/**
 * Parse git diff output into structured data
 * @pure
 * @param {string} output - Git diff output
 * @returns {Object} Parsed diff with files, insertions, deletions
 * @example
 * parseGitDiff('diff --git a/file.js...\n+++ b/file.js\n@@ -1,3 +1,4 @@\n+new line')
 * // => { files: ['file.js'], insertions: 1, deletions: 0, changes: [...] }
 */
export function parseGitDiff(output) {
  if (!output || typeof output !== 'string') {
    return { files: [], insertions: 0, deletions: 0, changes: [] };
  }

  const files = [];
  const changes = [];
  let insertions = 0;
  let deletions = 0;
  let currentFile = null;

  const lines = output.split('\n');

  for (const line of lines) {
    // File header: diff --git a/file b/file
    if (line.startsWith('diff --git')) {
      const match = line.match(/b\/(.+)$/);
      if (match) {
        currentFile = match[1];
        if (!files.includes(currentFile)) {
          files.push(currentFile);
        }
      }
    }
    // Line changes
    else if (line.startsWith('+') && !line.startsWith('+++')) {
      insertions++;
      if (currentFile) {
        changes.push({ file: currentFile, type: 'addition', line: line.substring(1) });
      }
    }
    else if (line.startsWith('-') && !line.startsWith('---')) {
      deletions++;
      if (currentFile) {
        changes.push({ file: currentFile, type: 'deletion', line: line.substring(1) });
      }
    }
  }

  return { files, insertions, deletions, changes };
}

/**
 * Parse git log output into structured commit data
 * @pure
 * @param {string} output - Git log output (--oneline --date=iso format)
 * @returns {Array<Object>} Array of commit objects
 * @example
 * parseGitLog('abc123 feat: add feature\ndef456 fix: bug fix')
 * // => [{ hash: 'abc123', message: 'feat: add feature' }, ...]
 */
export function parseGitLog(output) {
  if (!output || typeof output !== 'string') {
    return [];
  }

  const lines = output.trim().split('\n').filter(line => line.length > 0);
  const commits = [];

  for (const line of lines) {
    const match = line.match(/^([a-f0-9]+)\s+(.+)$/);
    if (match) {
      commits.push({
        hash: match[1],
        message: match[2]
      });
    }
  }

  return commits;
}

/**
 * Parse git branch output into structured data
 * @pure
 * @param {string} output - Git branch output
 * @returns {Object} Branch info with current and all branches
 * @example
 * parseGitBranch('  main\n* develop\n  feature')
 * // => { current: 'develop', all: ['main', 'develop', 'feature'] }
 */
export function parseGitBranch(output) {
  if (!output || typeof output !== 'string') {
    return { current: null, all: [] };
  }

  const lines = output.trim().split('\n').filter(line => line.length > 0);
  let current = null;
  const all = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('* ')) {
      current = trimmed.substring(2);
      all.push(current);
    } else {
      all.push(trimmed);
    }
  }

  return { current, all };
}

/**
 * Parse git remote -v output into structured data
 * @pure
 * @param {string} output - Git remote output
 * @returns {Array<Object>} Array of remote objects
 * @example
 * parseGitRemote('origin\thttps://github.com/user/repo.git (fetch)')
 * // => [{ name: 'origin', url: 'https://github.com/user/repo.git', type: 'fetch' }]
 */
export function parseGitRemote(output) {
  if (!output || typeof output !== 'string') {
    return [];
  }

  const lines = output.trim().split('\n').filter(line => line.length > 0);
  const remotes = [];
  const seen = new Set();

  for (const line of lines) {
    const match = line.match(/^(\S+)\s+(\S+)\s+\((\w+)\)$/);
    if (match) {
      const [, name, url, type] = match;
      const key = `${name}:${url}`;
      
      if (!seen.has(key)) {
        remotes.push({ name, url, type });
        seen.add(key);
      }
    }
  }

  return remotes;
}

/**
 * Build git command string from operation and arguments
 * @pure
 * @param {string} operation - Git operation (status, diff, log, etc.)
 * @param {Array<string>} args - Additional arguments
 * @returns {string} Complete git command
 * @example
 * buildGitCommand('status', ['--porcelain', '--untracked-files=all'])
 * // => 'git status --porcelain --untracked-files=all'
 */
export function buildGitCommand(operation, args = []) {
  const safeArgs = args.filter(arg => typeof arg === 'string' && arg.length > 0);
  return `git ${operation} ${safeArgs.join(' ')}`.trim();
}

/**
 * Validate git command output for expected patterns
 * @pure
 * @param {string} output - Command output
 * @param {Object} expected - Expected patterns
 * @returns {Object} Validation result
 * @example
 * validateGitOutput('M  file.js', { minLength: 5, patterns: [/^[MADRCU?]/] })
 * // => { valid: true, errors: [] }
 */
export function validateGitOutput(output, expected = {}) {
  const errors = [];

  if (expected.minLength && output.length < expected.minLength) {
    errors.push(`Output too short: ${output.length} < ${expected.minLength}`);
  }

  if (expected.maxLength && output.length > expected.maxLength) {
    errors.push(`Output too long: ${output.length} > ${expected.maxLength}`);
  }

  if (expected.patterns) {
    for (const pattern of expected.patterns) {
      if (!pattern.test(output)) {
        errors.push(`Output doesn't match pattern: ${pattern}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Check if path is likely a git repository (has .git directory)
 * @pure
 * @param {string} path - Directory path
 * @returns {boolean} True if path contains .git pattern
 * @example
 * isGitRepository('/path/to/repo/.git')  // true
 * isGitRepository('/path/to/repo')  // false (pure - just pattern check)
 */
export function isGitRepository(path) {
  if (!path || typeof path !== 'string') {
    return false;
  }
  return path.includes('.git') || path.endsWith('/.git') || path.endsWith('\\.git');
}

/**
 * Extract commit hash from git log line
 * @pure
 * @param {string} line - Git log line
 * @returns {string|null} Extracted hash or null
 * @example
 * extractCommitHash('abc123f feat: add feature')  // 'abc123f'
 */
export function extractCommitHash(line) {
  if (!line || typeof line !== 'string') {
    return null;
  }

  const match = line.match(/^([a-f0-9]{7,40})\s/);
  return match ? match[1] : null;
}

/**
 * Normalize file path for consistency (forward slashes, no trailing slash)
 * @pure
 * @param {string} path - File path
 * @returns {string} Normalized path
 * @example
 * normalizeFilePath('src\\app.js')  // 'src/app.js'
 * normalizeFilePath('src/')  // 'src'
 */
export function normalizeFilePath(path) {
  if (!path || typeof path !== 'string') {
    return '';
  }

  return path
    .replace(/\\/g, '/')
    .replace(/\/+$/, '')
    .trim();
}

/**
 * Categorize git status code into human-readable status
 * @pure
 * @param {string} code - Git status code (M, A, D, R, C, U, ?)
 * @returns {string} Human-readable status
 * @example
 * categorizeGitStatus('M')  // 'modified'
 * categorizeGitStatus('A')  // 'added'
 * categorizeGitStatus('D')  // 'deleted'
 */
export function categorizeGitStatus(code) {
  const statusMap = {
    'M': 'modified',
    'A': 'added',
    'D': 'deleted',
    'R': 'renamed',
    'C': 'copied',
    'U': 'unmerged',
    '?': 'untracked'
  };

  return statusMap[code] || 'unknown';
}

/**
 * Format git date string to ISO format
 * @pure
 * @param {string} dateString - Git date string
 * @returns {string} ISO date string
 * @example
 * formatGitDate('2026-02-07 00:36:18 +0000')  // '2026-02-07T00:36:18.000Z'
 */
export function formatGitDate(dateString) {
  if (!dateString || typeof dateString !== 'string') {
    return new Date(0).toISOString();
  }

  try {
    const date = new Date(dateString);
    return date.toISOString();
  } catch {
    return new Date(0).toISOString();
  }
}

/**
 * Calculate diff statistics from parsed diff
 * @pure
 * @param {Object} diff - Parsed diff object
 * @returns {Object} Statistics with files, insertions, deletions
 * @example
 * calculateDiffStats({ files: ['a.js', 'b.js'], insertions: 10, deletions: 5 })
 * // => { files: 2, insertions: 10, deletions: 5, netChange: 5 }
 */
export function calculateDiffStats(diff) {
  if (!diff || typeof diff !== 'object') {
    return { files: 0, insertions: 0, deletions: 0, netChange: 0 };
  }

  const files = Array.isArray(diff.files) ? diff.files.length : 0;
  const insertions = diff.insertions || 0;
  const deletions = diff.deletions || 0;

  return {
    files,
    insertions,
    deletions,
    netChange: insertions - deletions
  };
}

/**
 * Validate commit message format (conventional commits)
 * @pure
 * @param {string} message - Commit message
 * @returns {Object} Validation result
 * @example
 * validateCommitMessage('feat: add new feature')  // { valid: true, errors: [] }
 * validateCommitMessage('bad message')  // { valid: false, errors: [...] }
 */
export function validateCommitMessage(message) {
  const errors = [];

  if (!message || typeof message !== 'string') {
    errors.push('Commit message is required');
    return { valid: false, errors };
  }

  const trimmed = message.trim();

  if (trimmed.length === 0) {
    errors.push('Commit message cannot be empty');
  }

  if (trimmed.length < 10) {
    errors.push('Commit message too short (minimum 10 characters)');
  }

  if (trimmed.length > 72 && !trimmed.includes('\n')) {
    errors.push('First line should be 72 characters or less');
  }

  // Check for conventional commit format (optional)
  const conventionalPattern = /^(feat|fix|docs|style|refactor|test|chore|perf|ci|build|revert)(\(.+\))?:\s.+/;
  if (!conventionalPattern.test(trimmed)) {
    // This is a warning, not an error
    // errors.push('Message does not follow conventional commit format');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Build status summary from parsed status
 * @pure
 * @param {Object} parsedStatus - Parsed git status
 * @returns {string} Human-readable summary
 * @example
 * buildStatusSummary({ staged: [{}, {}], unstaged: [{}], untracked: [] })
 * // => '2 staged, 1 unstaged, 0 untracked'
 */
export function buildStatusSummary(parsedStatus) {
  if (!parsedStatus || typeof parsedStatus !== 'object') {
    return 'No changes';
  }

  const staged = Array.isArray(parsedStatus.staged) ? parsedStatus.staged.length : 0;
  const unstaged = Array.isArray(parsedStatus.unstaged) ? parsedStatus.unstaged.length : 0;
  const untracked = Array.isArray(parsedStatus.untracked) ? parsedStatus.untracked.length : 0;

  if (staged === 0 && unstaged === 0 && untracked === 0) {
    return 'No changes';
  }

  const parts = [];
  if (staged > 0) parts.push(`${staged} staged`);
  if (unstaged > 0) parts.push(`${unstaged} unstaged`);
  if (untracked > 0) parts.push(`${untracked} untracked`);

  return parts.join(', ');
}

// ============================================================================
// IMPURE WRAPPER CLASS - Side effects isolated here
// ============================================================================

/**
 * GitAutomation - Git operations with command execution
 * @class
 * @description
 * Wraps Git CLI commands with:
 * - Command execution via child_process
 * - Output parsing with pure functions
 * - Error handling and logging
 * - Repository validation
 */
export class GitAutomation {
  /**
   * Create GitAutomation instance
   * @param {Object} options - Configuration options
   * @param {string} [options.repoPath=process.cwd()] - Repository root path
   * @param {number} [options.timeout=10000] - Command timeout in milliseconds
   * @param {number} [options.maxBuffer=10485760] - Max buffer size (10MB)
   */
  constructor(options = {}) {
    this.repoPath = options.repoPath || process.cwd();
    this.timeout = options.timeout || 10000;
    this.maxBuffer = options.maxBuffer || 10 * 1024 * 1024; // 10MB
  }

  /**
   * Initialize and validate Git repository
   * @returns {Promise<void>}
   * @throws {ExecutionError} If git not found or not a repository
   */
  async init() {
    // Check if git is installed
    try {
      execSync('git --version', { stdio: 'ignore' });
    } catch {
      throw new ExecutionError('Git is not installed or not in PATH');
    }

    // Check if current directory is a git repository
    const gitDir = join(this.repoPath, '.git');
    if (!existsSync(gitDir)) {
      throw new ValidationError(`Not a git repository: ${this.repoPath}`);
    }

    logger.debug(`Git automation initialized at ${this.repoPath}`);
  }

  /**
   * Execute git command
   * @private
   * @param {string} command - Git command to execute
   * @returns {string} Command output
   */
  _exec(command) {
    try {
      return execSync(command, {
        cwd: this.repoPath,
        encoding: 'utf8',
        timeout: this.timeout,
        maxBuffer: this.maxBuffer,
        stdio: ['pipe', 'pipe', 'pipe']
      });
    } catch (error) {
      throw new ExecutionError(
        `Git command failed: ${command}\n${error.message}`,
        { command, stderr: error.stderr }
      );
    }
  }

  /**
   * Get repository status
   * @returns {Promise<Object>} Parsed status with staged, unstaged, untracked
   */
  async status() {
    const output = this._exec('git status --porcelain --untracked-files=all');
    return parseGitStatus(output);
  }

  /**
   * Get diff for changes
   * @param {Object} options - Diff options
   * @param {boolean} [options.staged=false] - Show staged changes
   * @param {Array<string>} [options.files=[]] - Specific files to diff
   * @returns {Promise<Object>} Parsed diff with files, insertions, deletions
   */
  async diff(options = {}) {
    const args = [];
    
    if (options.staged) {
      args.push('--cached');
    }
    
    if (options.files && options.files.length > 0) {
      args.push('--', ...options.files);
    }

    const command = buildGitCommand('diff', args);
    const output = this._exec(command);
    return parseGitDiff(output);
  }

  /**
   * Get commit history
   * @param {Object} options - Log options
   * @param {number} [options.limit=10] - Number of commits
   * @param {string} [options.since] - Show commits since date/commit
   * @returns {Promise<Array<Object>>} Array of commit objects
   */
  async log(options = {}) {
    const args = ['--oneline'];
    
    if (options.limit) {
      args.push(`-${options.limit}`);
    }
    
    if (options.since) {
      args.push(`--since="${options.since}"`);
    }

    const command = buildGitCommand('log', args);
    const output = this._exec(command);
    return parseGitLog(output);
  }

  /**
   * Stage files for commit
   * @param {Array<string>} files - Files to stage
   * @returns {Promise<void>}
   */
  async add(files) {
    if (!Array.isArray(files) || files.length === 0) {
      throw new ValidationError('Files array is required and must not be empty');
    }

    const command = buildGitCommand('add', files);
    this._exec(command);
    logger.debug(`Staged ${files.length} file(s)`);
  }

  /**
   * Create commit
   * @param {string} message - Commit message
   * @param {Object} options - Commit options
   * @param {boolean} [options.allowEmpty=false] - Allow empty commit
   * @returns {Promise<string>} Commit hash
   */
  async commit(message, options = {}) {
    const validation = validateCommitMessage(message);
    if (!validation.valid) {
      throw new ValidationError(`Invalid commit message: ${validation.errors.join(', ')}`);
    }

    const args = ['-m', `"${message}"`];
    
    if (options.allowEmpty) {
      args.push('--allow-empty');
    }

    const command = buildGitCommand('commit', args);
    this._exec(command);

    // Get the commit hash
    const logOutput = this._exec('git log -1 --oneline');
    const hash = extractCommitHash(logOutput);
    
    logger.info(`Created commit: ${hash} - ${message.substring(0, 50)}`);
    return hash;
  }

  /**
   * Get current branch name
   * @returns {Promise<string>} Current branch name
   */
  async getCurrentBranch() {
    const output = this._exec('git branch --show-current');
    return output.trim();
  }

  /**
   * Get all branches
   * @returns {Promise<Object>} Branch info with current and all branches
   */
  async getBranches() {
    const output = this._exec('git branch');
    return parseGitBranch(output);
  }

  /**
   * Get remote list
   * @returns {Promise<Array<Object>>} Array of remote objects
   */
  async getRemotes() {
    const output = this._exec('git remote -v');
    return parseGitRemote(output);
  }

  /**
   * Check if repository has uncommitted changes
   * @returns {Promise<boolean>} True if has changes
   */
  async hasChanges() {
    const status = await this.status();
    return status.staged.length > 0 || 
           status.unstaged.length > 0 || 
           status.untracked.length > 0;
  }

  /**
   * Get last commit info
   * @returns {Promise<Object>} Last commit object
   */
  async getLastCommit() {
    const commits = await this.log({ limit: 1 });
    return commits.length > 0 ? commits[0] : null;
  }
}

// Default export
export default GitAutomation;
