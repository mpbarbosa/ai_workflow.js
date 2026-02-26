/**
 * @fileoverview Tests for Commit History Module
 * @version 2.0.0
 */

import {
  readCommitHistory,
  createEmptyHistory,
  getLastRunCommit,
  createRunEntry,
  appendRunEntry,
  capHistory,
  serializeHistory,
  isValidCommitHash,
  CommitHistory,
  COMMIT_HISTORY_VERSION,
  DEFAULT_MAX_RUNS,
} from '../../src/lib/commit_history.js';

import { existsSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import os from 'os';

// ============================================================================
// PURE FUNCTION TESTS
// ============================================================================

describe('commit_history - Pure Functions', () => {
  // ---- createEmptyHistory ----
  describe('createEmptyHistory', () => {
    test('returns correct shape', () => {
      const h = createEmptyHistory();
      expect(h.version).toBe(COMMIT_HISTORY_VERSION);
      expect(h.lastRunCommit).toBeNull();
      expect(h.runs).toEqual([]);
    });

    test('is deterministic', () => {
      expect(createEmptyHistory()).toEqual(createEmptyHistory());
    });
  });

  // ---- readCommitHistory ----
  describe('readCommitHistory', () => {
    test('parses valid JSON content', () => {
      const content = JSON.stringify({
        version: '1.0.0',
        lastRunCommit: 'abc123def456abc123def456abc123def456abc1',
        runs: [
          {
            hash: 'abc123def456abc123def456abc123def456abc1',
            runId: 'wf_1',
            timestamp: '2026-01-01T00:00:00.000Z',
          },
        ],
      });
      const h = readCommitHistory(content);
      expect(h.lastRunCommit).toBe('abc123def456abc123def456abc123def456abc1');
      expect(h.runs).toHaveLength(1);
    });

    test('returns empty history for empty string', () => {
      expect(readCommitHistory('')).toEqual(createEmptyHistory());
    });

    test('returns empty history for null', () => {
      expect(readCommitHistory(null)).toEqual(createEmptyHistory());
    });

    test('returns empty history for invalid JSON', () => {
      expect(readCommitHistory('{bad json')).toEqual(createEmptyHistory());
    });

    test('returns empty history for non-object JSON', () => {
      expect(readCommitHistory('"string"')).toEqual(createEmptyHistory());
    });

    test('normalises missing fields', () => {
      const h = readCommitHistory(JSON.stringify({}));
      expect(h.version).toBe(COMMIT_HISTORY_VERSION);
      expect(h.lastRunCommit).toBeNull();
      expect(h.runs).toEqual([]);
    });

    test('ignores non-string lastRunCommit', () => {
      const content = JSON.stringify({ lastRunCommit: 12345, runs: [] });
      const h = readCommitHistory(content);
      expect(h.lastRunCommit).toBeNull();
    });
  });

  // ---- getLastRunCommit ----
  describe('getLastRunCommit', () => {
    test('returns hash when present', () => {
      expect(getLastRunCommit({ lastRunCommit: 'abc1234', runs: [] })).toBe('abc1234');
    });

    test('returns null when not set', () => {
      expect(getLastRunCommit({ lastRunCommit: null, runs: [] })).toBeNull();
    });

    test('returns null for undefined input', () => {
      expect(getLastRunCommit(undefined)).toBeNull();
    });

    test('returns null for null input', () => {
      expect(getLastRunCommit(null)).toBeNull();
    });
  });

  // ---- createRunEntry ----
  describe('createRunEntry', () => {
    test('returns expected shape', () => {
      const entry = createRunEntry('abc1234', 'wf_1', '2026-01-01T00:00:00.000Z');
      expect(entry).toEqual({
        hash: 'abc1234',
        runId: 'wf_1',
        timestamp: '2026-01-01T00:00:00.000Z',
      });
    });

    test('coerces null values to empty strings', () => {
      const entry = createRunEntry(null, null, null);
      expect(entry.hash).toBe('');
      expect(entry.runId).toBe('');
      expect(entry.timestamp).toBe('');
    });

    test('is deterministic', () => {
      const a = createRunEntry('x', 'y', 'z');
      const b = createRunEntry('x', 'y', 'z');
      expect(a).toEqual(b);
    });
  });

  // ---- appendRunEntry ----
  describe('appendRunEntry', () => {
    test('adds entry and updates lastRunCommit', () => {
      const h = createEmptyHistory();
      const updated = appendRunEntry(h, 'abc1234', 'wf_1', '2026-01-01T00:00:00.000Z');
      expect(updated.lastRunCommit).toBe('abc1234');
      expect(updated.runs).toHaveLength(1);
      expect(updated.runs[0].hash).toBe('abc1234');
    });

    test('does not mutate the original history', () => {
      const h = createEmptyHistory();
      appendRunEntry(h, 'abc1234', 'wf_1', '2026-01-01T00:00:00.000Z');
      expect(h.runs).toHaveLength(0);
      expect(h.lastRunCommit).toBeNull();
    });

    test('appends multiple entries in order', () => {
      let h = createEmptyHistory();
      h = appendRunEntry(h, 'aaaaaaa', 'wf_1', 'ts1');
      h = appendRunEntry(h, 'bbbbbbb', 'wf_2', 'ts2');
      expect(h.runs).toHaveLength(2);
      expect(h.lastRunCommit).toBe('bbbbbbb');
      expect(h.runs[0].hash).toBe('aaaaaaa');
      expect(h.runs[1].hash).toBe('bbbbbbb');
    });

    test('handles null history gracefully', () => {
      const updated = appendRunEntry(null, 'abc1234', 'wf_1', 'ts');
      expect(updated.lastRunCommit).toBe('abc1234');
    });
  });

  // ---- capHistory ----
  describe('capHistory', () => {
    test('does not trim when under limit', () => {
      const h = {
        version: '1.0.0',
        lastRunCommit: 'z',
        runs: [{ hash: 'a' }, { hash: 'b' }],
      };
      const capped = capHistory(h, 5);
      expect(capped.runs).toHaveLength(2);
    });

    test('trims oldest entries when over limit', () => {
      const runs = Array.from({ length: 10 }, (_, i) => ({ hash: `run${i}` }));
      const h = { version: '1.0.0', lastRunCommit: 'run9', runs };
      const capped = capHistory(h, 3);
      expect(capped.runs).toHaveLength(3);
      expect(capped.runs[0].hash).toBe('run7');
      expect(capped.runs[2].hash).toBe('run9');
    });

    test('preserves lastRunCommit unchanged', () => {
      const runs = Array.from({ length: 60 }, (_, i) => ({ hash: `r${i}` }));
      const h = { version: '1.0.0', lastRunCommit: 'special', runs };
      const capped = capHistory(h, DEFAULT_MAX_RUNS);
      expect(capped.lastRunCommit).toBe('special');
      expect(capped.runs).toHaveLength(DEFAULT_MAX_RUNS);
    });

    test('uses DEFAULT_MAX_RUNS when no limit specified', () => {
      const runs = Array.from({ length: 60 }, (_, i) => ({ hash: `r${i}` }));
      const h = { version: '1.0.0', lastRunCommit: 'x', runs };
      const capped = capHistory(h);
      expect(capped.runs).toHaveLength(DEFAULT_MAX_RUNS);
    });

    test('handles null input', () => {
      expect(capHistory(null)).toEqual(createEmptyHistory());
    });
  });

  // ---- isValidCommitHash ----
  describe('isValidCommitHash', () => {
    test('accepts 7-char short hash', () => {
      expect(isValidCommitHash('abc1234')).toBe(true);
    });

    test('accepts 40-char full hash', () => {
      expect(isValidCommitHash('a'.repeat(40))).toBe(true);
    });

    test('rejects fewer than 7 chars', () => {
      expect(isValidCommitHash('abc12')).toBe(false);
    });

    test('rejects non-hex characters', () => {
      expect(isValidCommitHash('xyz1234')).toBe(false);
    });

    test('rejects empty string', () => {
      expect(isValidCommitHash('')).toBe(false);
    });

    test('rejects null', () => {
      expect(isValidCommitHash(null)).toBe(false);
    });
  });

  // ---- serializeHistory ----
  describe('serializeHistory', () => {
    test('produces valid JSON', () => {
      const h = createEmptyHistory();
      const json = serializeHistory(h);
      expect(() => JSON.parse(json)).not.toThrow();
    });

    test('round-trips through readCommitHistory', () => {
      const original = {
        version: '1.0.0',
        lastRunCommit: 'abc1234',
        runs: [{ hash: 'abc1234', runId: 'wf_1', timestamp: 'ts' }],
      };
      const serialized = serializeHistory(original);
      const parsed = readCommitHistory(serialized);
      expect(parsed).toEqual(original);
    });
  });
});

// ============================================================================
// INTEGRATION TESTS (CommitHistory class)
// ============================================================================

describe('CommitHistory - Integration', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = join(
      os.tmpdir(),
      `commit_history_test_${Date.now()}_${Math.random().toString(36).slice(2)}`
    );
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(tmpDir)) {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('throws when workflowDir is missing', () => {
    expect(() => new CommitHistory({})).toThrow('CommitHistory requires options.workflowDir');
  });

  test('load() returns empty history when file does not exist', () => {
    const ch = new CommitHistory({ workflowDir: tmpDir });
    const h = ch.load();
    expect(h.lastRunCommit).toBeNull();
    expect(h.runs).toHaveLength(0);
  });

  test('getLastRunCommit() returns null on first run', () => {
    const ch = new CommitHistory({ workflowDir: tmpDir });
    expect(ch.getLastRunCommit()).toBeNull();
  });

  test('save() persists hash and getLastRunCommit() returns it', () => {
    const ch = new CommitHistory({ workflowDir: tmpDir });
    ch.save('abc123def456abc123def456abc123def456abc1', 'wf_1');
    const ch2 = new CommitHistory({ workflowDir: tmpDir });
    expect(ch2.getLastRunCommit()).toBe('abc123def456abc123def456abc123def456abc1');
  });

  test('save() with invalid hash does not write', () => {
    const ch = new CommitHistory({ workflowDir: tmpDir });
    ch.save('invalid!hash', 'wf_1');
    expect(existsSync(`${tmpDir}/commit_history.json`)).toBe(false);
  });

  test('save() accumulates multiple run entries', () => {
    const ch = new CommitHistory({ workflowDir: tmpDir });
    ch.save('aaaaaaa1aaaaaaa1aaaaaaa1aaaaaaa1aaaaaaa1', 'wf_1', '2026-01-01T00:00:00.000Z');
    ch.save('bbbbbbb1bbbbbbb1bbbbbbb1bbbbbbb1bbbbbbb1', 'wf_2', '2026-01-02T00:00:00.000Z');

    const ch2 = new CommitHistory({ workflowDir: tmpDir });
    const h = ch2.load();
    expect(h.runs).toHaveLength(2);
    expect(h.lastRunCommit).toBe('bbbbbbb1bbbbbbb1bbbbbbb1bbbbbbb1bbbbbbb1');
  });

  test('load() recovers from corrupted file with empty history', () => {
    writeFileSync(join(tmpDir, 'commit_history.json'), '{bad json', 'utf8');
    const ch = new CommitHistory({ workflowDir: tmpDir });
    const h = ch.load();
    expect(h.lastRunCommit).toBeNull();
  });

  test('save() respects maxRuns cap', () => {
    const ch = new CommitHistory({ workflowDir: tmpDir, maxRuns: 3 });
    const hashes = [
      'aaaaaaa1aaaaaaa1aaaaaaa1aaaaaaa1aaaaaaa1',
      'bbbbbbb1bbbbbbb1bbbbbbb1bbbbbbb1bbbbbbb1',
      'ccccccc1ccccccc1ccccccc1ccccccc1ccccccc1',
      'ddddddd1ddddddd1ddddddd1ddddddd1ddddddd1',
    ];
    for (const hash of hashes) {
      ch.save(hash, 'wf');
    }
    const ch2 = new CommitHistory({ workflowDir: tmpDir, maxRuns: 3 });
    const h = ch2.load();
    expect(h.runs).toHaveLength(3);
    expect(h.runs[0].hash).toBe('bbbbbbb1bbbbbbb1bbbbbbb1bbbbbbb1bbbbbbb1');
  });

  test('save() creates workflowDir if missing', () => {
    const nested = join(tmpDir, 'deep', 'dir');
    const ch = new CommitHistory({ workflowDir: nested });
    ch.save('abc123def456abc123def456abc123def456abc1', 'wf_1');
    expect(existsSync(`${nested}/commit_history.json`)).toBe(true);
  });
});
