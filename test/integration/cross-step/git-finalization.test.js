/**
 * @fileoverview Cross-step: git finalization integration tests
 * @module test/integration/cross-step/git-finalization.test.js
 *
 * Tests git automation pure functions used by step_12 (git finalization):
 * buildGitCommand, calculateDiffStats. Also tests real git state in an
 * initialised temp repo created from the nodejs-api fixture.
 *
 * @version 1.0.0
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { execSync } from 'child_process';
import {
  parseGitStatus,
  parseGitLog,
  buildGitCommand,
  validateCommitMessage,
  categorizeGitStatus,
  calculateDiffStats,
  normalizeFilePath,
} from '../../../src/lib/git_automation.js';
import { createTempProject, cleanupTempProject } from '../../helpers/integration.js';

let tempDir;

beforeEach(async () => {
  tempDir = await createTempProject('nodejs-api', { initGit: true });
});
afterEach(async () => {
  await cleanupTempProject(tempDir);
});

// ---------------------------------------------------------------------------
// parseGitStatus
// ---------------------------------------------------------------------------

describe('parseGitStatus', () => {
  test('parses empty status output', () => {
    const result = parseGitStatus('');
    expect(typeof result).toBe('object');
    expect(result.staged).toHaveLength(0);
    expect(result.unstaged).toHaveLength(0);
    expect(result.untracked).toHaveLength(0);
  });

  test('parses modified file status (unstaged)', () => {
    const output = ' M src/routes/users.js\n';
    const result = parseGitStatus(output);
    expect(result.unstaged.length).toBeGreaterThan(0);
  });

  test('parses added file status (staged)', () => {
    const output = 'A  src/routes/new.js\n';
    const result = parseGitStatus(output);
    expect(result.staged.length).toBeGreaterThan(0);
  });

  test('parses deleted file status (staged)', () => {
    const output = 'D  src/routes/old.js\n';
    const result = parseGitStatus(output);
    expect(result.staged.length).toBeGreaterThan(0);
  });

  test('returns staged objects with file field', () => {
    const output = 'M  src/index.js\n';
    const result = parseGitStatus(output);
    const item = result.staged[0];
    expect(item?.file).toBeDefined();
  });

  test('handles multiple files', () => {
    const output = 'M  src/index.js\nA  src/new.js\nD  src/old.js\n';
    const result = parseGitStatus(output);
    const totalFiles = result.staged.length + result.unstaged.length + result.untracked.length;
    expect(totalFiles).toBeGreaterThanOrEqual(3);
  });
});

// ---------------------------------------------------------------------------
// categorizeGitStatus
// ---------------------------------------------------------------------------

describe('categorizeGitStatus', () => {
  test('M is modified', () => {
    const cat = categorizeGitStatus('M');
    expect(cat).toMatch(/modified|changed|updated/i);
  });

  test('A is added', () => {
    const cat = categorizeGitStatus('A');
    expect(cat).toMatch(/added|new/i);
  });

  test('D is deleted', () => {
    const cat = categorizeGitStatus('D');
    expect(cat).toMatch(/deleted|removed/i);
  });

  test('unknown code returns a string', () => {
    const cat = categorizeGitStatus('?');
    expect(typeof cat).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// buildGitCommand
// ---------------------------------------------------------------------------

describe('buildGitCommand', () => {
  test('returns a string', () => {
    const cmd = buildGitCommand('status', []);
    expect(typeof cmd).toBe('string');
  });

  test('status command includes "status"', () => {
    const cmd = buildGitCommand('status', []);
    expect(cmd).toContain('status');
  });

  test('commit command includes "commit"', () => {
    const cmd = buildGitCommand('commit', ['-m', 'test']);
    expect(cmd).toContain('commit');
  });

  test('args are included in command', () => {
    const cmd = buildGitCommand('log', ['--oneline', '-5']);
    expect(cmd).toContain('--oneline');
  });
});

// ---------------------------------------------------------------------------
// validateCommitMessage
// ---------------------------------------------------------------------------

describe('validateCommitMessage', () => {
  test('conventional commit is valid', () => {
    const result = validateCommitMessage('feat: add users route');
    expect(result.valid).toBe(true);
  });

  test('empty message is invalid', () => {
    const result = validateCommitMessage('');
    expect(result.valid).toBe(false);
  });

  test('null message is handled gracefully', () => {
    const result = validateCommitMessage(null);
    expect(typeof result.valid).toBe('boolean');
  });

  test('very long message may trigger a warning', () => {
    const long = 'x'.repeat(200);
    const result = validateCommitMessage(long);
    expect(typeof result.valid).toBe('boolean');
  });

  test('chore: prefix is valid', () => {
    const result = validateCommitMessage('chore: update deps');
    expect(result.valid).toBe(true);
  });

  test('fix: prefix is valid', () => {
    const result = validateCommitMessage('fix: handle null pointer');
    expect(result.valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// calculateDiffStats
// ---------------------------------------------------------------------------

describe('calculateDiffStats', () => {
  const sampleDiff = {
    files: [{ filename: 'src/index.js' }, { filename: 'src/routes/users.js' }],
    insertions: 5,
    deletions: 2,
  };

  test('returns an object', () => {
    const stats = calculateDiffStats(sampleDiff);
    expect(typeof stats).toBe('object');
    expect(stats).not.toBeNull();
  });

  test('insertions count is positive', () => {
    const stats = calculateDiffStats(sampleDiff);
    expect(stats.insertions).toBeGreaterThan(0);
  });

  test('deletions count is positive', () => {
    const stats = calculateDiffStats(sampleDiff);
    expect(stats.deletions).toBeGreaterThan(0);
  });

  test('null diff returns zero stats', () => {
    const stats = calculateDiffStats(null);
    expect(stats.insertions).toBe(0);
    expect(stats.deletions).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// normalizeFilePath
// ---------------------------------------------------------------------------

describe('normalizeFilePath', () => {
  test('converts backslashes to forward slashes', () => {
    const result = normalizeFilePath('src\\routes\\users.js');
    expect(result).toContain('/');
    expect(result).not.toContain('\\');
  });

  test('forward-slash path remains unchanged', () => {
    const result = normalizeFilePath('src/routes/users.js');
    expect(result).toBe('src/routes/users.js');
  });
});

// ---------------------------------------------------------------------------
// Real git repo in temp dir
// ---------------------------------------------------------------------------

describe('real git repo in temp fixture', () => {
  test('git status runs without error in temp dir', () => {
    expect(() => {
      execSync('git status --porcelain', { cwd: tempDir, stdio: 'pipe' });
    }).not.toThrow();
  });

  test('git log has at least one commit (the fixture commit)', () => {
    const log = execSync('git log --oneline', { cwd: tempDir, stdio: 'pipe' }).toString();
    expect(log.trim().length).toBeGreaterThan(0);
  });

  test('parseGitStatus on empty working tree returns empty status', () => {
    const statusOutput = execSync('git status --porcelain', {
      cwd: tempDir,
      stdio: 'pipe',
    }).toString();
    const result = parseGitStatus(statusOutput);
    expect(typeof result).toBe('object');
    expect(result.staged.length + result.unstaged.length + result.untracked.length).toBe(0);
  });

  test('parseGitLog on real log output returns array', () => {
    const logOutput = execSync('git log --format="%H %s"', {
      cwd: tempDir,
      stdio: 'pipe',
    }).toString();
    const result = parseGitLog(logOutput);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });
});
