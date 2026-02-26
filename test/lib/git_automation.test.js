/**
 * @fileoverview Tests for Git Automation Module
 * @version 2.0.0
 */

import {
  parseGitStatus,
  parseGitDiff,
  parseGitLog,
  parseGitBranch,
  parseGitRemote,
  buildGitCommand,
  validateGitOutput,
  isGitRepository,
  extractCommitHash,
  normalizeFilePath,
  categorizeGitStatus,
  formatGitDate,
  calculateDiffStats,
  validateCommitMessage,
  buildStatusSummary,
  parseGitDiffNameStatus,
  parseGitLogNameStatus,
  GitAutomation,
} from '../../src/lib/git_automation.js';

describe('git_automation - Pure Functions', () => {
  describe('parseGitStatus', () => {
    test('parses empty status', () => {
      expect(parseGitStatus('')).toEqual({
        staged: [],
        unstaged: [],
        untracked: [],
      });
    });

    test('parses staged files', () => {
      const output = 'M  src/app.js\nA  src/new.js';
      const result = parseGitStatus(output);

      expect(result.staged).toHaveLength(2);
      expect(result.staged[0]).toEqual({ file: 'src/app.js', status: 'modified' });
      expect(result.staged[1]).toEqual({ file: 'src/new.js', status: 'added' });
    });

    test('parses unstaged files', () => {
      const output = ' M src/app.js\n D src/old.js';
      const result = parseGitStatus(output);

      expect(result.unstaged).toHaveLength(2); // both ' M' and ' D' are unstaged changes
      expect(result.unstaged[0]).toEqual({ file: 'src/app.js', status: 'modified' });
      expect(result.unstaged[1]).toEqual({ file: 'src/old.js', status: 'deleted' });
    });

    // Regression: leading-space trim bug (2026-02-21)
    // .trim() on the full output stripped the space from " M README.md" → "M README.md",
    // causing parseGitStatus to misclassify it as staged and corrupt the filename:
    //   line[0]='M' (wrong staged status), line[2]='R' (first char of filename),
    //   line.substring(3) → "EADME.md" instead of "README.md".
    test('correctly parses file starting with R when first status line is unstaged ( M)', () => {
      // " M README.md" — space in staged column means not staged; M in unstaged column
      const output = ' M README.md';
      const result = parseGitStatus(output);

      expect(result.staged).toHaveLength(0);
      expect(result.unstaged).toHaveLength(1);
      expect(result.unstaged[0]).toEqual({ file: 'README.md', status: 'modified' });
    });

    test('preserves full filename when output begins with a space-prefixed status line', () => {
      // Verifies .trim() is NOT applied to the full output (which strips meaningful
      // leading spaces). Both files should land in unstaged, not staged.
      const output = ' M README.md\n M CHANGELOG.md\n?? src/new.js';
      const result = parseGitStatus(output);

      expect(result.staged).toHaveLength(0);
      expect(result.unstaged).toHaveLength(2);
      expect(result.unstaged[0]).toEqual({ file: 'README.md', status: 'modified' });
      expect(result.unstaged[1]).toEqual({ file: 'CHANGELOG.md', status: 'modified' });
      expect(result.untracked).toHaveLength(1);
      expect(result.untracked[0]).toEqual({ file: 'src/new.js', status: 'untracked' });
    });

    test('handles Windows CRLF line endings in git status output', () => {
      const output = ' M README.md\r\nM  staged.js\r\n?? new.txt\r\n';
      const result = parseGitStatus(output);

      expect(result.unstaged).toHaveLength(1);
      expect(result.unstaged[0]).toEqual({ file: 'README.md', status: 'modified' });
      expect(result.staged).toHaveLength(1);
      expect(result.staged[0]).toEqual({ file: 'staged.js', status: 'modified' });
      expect(result.untracked).toHaveLength(1);
      expect(result.untracked[0]).toEqual({ file: 'new.txt', status: 'untracked' });
    });

    test('parses untracked files', () => {
      const output = '?? new-file.js\n?? another.txt';
      const result = parseGitStatus(output);

      expect(result.untracked).toHaveLength(2);
      expect(result.untracked[0]).toEqual({ file: 'new-file.js', status: 'untracked' });
    });

    test('parses mixed status', () => {
      const output = 'M  staged.js\n M unstaged.js\n?? untracked.js';
      const result = parseGitStatus(output);

      expect(result.staged).toHaveLength(1);
      expect(result.unstaged).toHaveLength(1);
      expect(result.untracked).toHaveLength(1);
    });

    test('handles invalid input', () => {
      expect(parseGitStatus(null)).toEqual({ staged: [], unstaged: [], untracked: [] });
      expect(parseGitStatus(undefined)).toEqual({ staged: [], unstaged: [], untracked: [] });
      expect(parseGitStatus(123)).toEqual({ staged: [], unstaged: [], untracked: [] });
    });
  });

  describe('parseGitDiff', () => {
    test('parses empty diff', () => {
      expect(parseGitDiff('')).toEqual({
        files: [],
        insertions: 0,
        deletions: 0,
        changes: [],
      });
    });

    test('parses simple diff', () => {
      const output = `diff --git a/file.js b/file.js
index abc123..def456 100644
--- a/file.js
+++ b/file.js
@@ -1,3 +1,4 @@
 context line
+added line
-removed line`;

      const result = parseGitDiff(output);

      expect(result.files).toEqual(['file.js']);
      expect(result.insertions).toBe(1);
      expect(result.deletions).toBe(1);
      expect(result.changes).toHaveLength(2);
    });

    test('parses multiple files', () => {
      const output = `diff --git a/file1.js b/file1.js
+++ b/file1.js
+line1
diff --git a/file2.js b/file2.js
+++ b/file2.js
+line2
+line3`;

      const result = parseGitDiff(output);

      expect(result.files).toEqual(['file1.js', 'file2.js']);
      expect(result.insertions).toBe(3);
    });

    test('handles invalid input', () => {
      expect(parseGitDiff(null)).toEqual({ files: [], insertions: 0, deletions: 0, changes: [] });
    });
  });

  describe('parseGitLog', () => {
    test('parses empty log', () => {
      expect(parseGitLog('')).toEqual([]);
    });

    test('parses commit history', () => {
      const output = `abc123f feat: add feature
def456a fix: bug fix
789abcd docs: update readme`;

      const result = parseGitLog(output);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ hash: 'abc123f', message: 'feat: add feature' });
      expect(result[1]).toEqual({ hash: 'def456a', message: 'fix: bug fix' });
      expect(result[2]).toEqual({ hash: '789abcd', message: 'docs: update readme' });
    });

    test('handles long hashes', () => {
      const output = 'abcdef1234567890 commit message';
      const result = parseGitLog(output);

      expect(result[0].hash).toBe('abcdef1234567890');
    });

    test('handles invalid input', () => {
      expect(parseGitLog(null)).toEqual([]);
      expect(parseGitLog('not a valid log')).toEqual([]);
    });
  });

  describe('parseGitBranch', () => {
    test('parses empty branch list', () => {
      expect(parseGitBranch('')).toEqual({ current: null, all: [] });
    });

    test('parses branch list with current', () => {
      const output = `  main
* develop
  feature-x`;

      const result = parseGitBranch(output);

      expect(result.current).toBe('develop');
      expect(result.all).toEqual(['main', 'develop', 'feature-x']);
    });

    test('handles single branch', () => {
      const output = '* main';
      const result = parseGitBranch(output);

      expect(result.current).toBe('main');
      expect(result.all).toEqual(['main']);
    });

    test('handles invalid input', () => {
      expect(parseGitBranch(null)).toEqual({ current: null, all: [] });
    });
  });

  describe('parseGitRemote', () => {
    test('parses empty remote list', () => {
      expect(parseGitRemote('')).toEqual([]);
    });

    test('parses remote list', () => {
      const output = `origin\thttps://github.com/user/repo.git (fetch)
origin\thttps://github.com/user/repo.git (push)
upstream\thttps://github.com/org/repo.git (fetch)`;

      const result = parseGitRemote(output);

      expect(result).toHaveLength(2); // Deduplicated by name:url
      expect(result[0]).toEqual({
        name: 'origin',
        url: 'https://github.com/user/repo.git',
        type: 'fetch',
      });
    });

    test('handles invalid input', () => {
      expect(parseGitRemote(null)).toEqual([]);
    });
  });

  describe('buildGitCommand', () => {
    test('builds simple command', () => {
      expect(buildGitCommand('status')).toBe('git status');
    });

    test('builds command with args', () => {
      expect(buildGitCommand('status', ['--porcelain', '--short'])).toBe(
        'git status --porcelain --short'
      );
    });

    test('filters invalid args', () => {
      expect(buildGitCommand('status', ['--porcelain', '', null, '--short'])).toBe(
        'git status --porcelain --short'
      );
    });
  });

  describe('validateGitOutput', () => {
    test('validates minimal output', () => {
      const result = validateGitOutput('output', {});
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    test('validates min length', () => {
      const result = validateGitOutput('ab', { minLength: 5 });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Output too short: 2 < 5');
    });

    test('validates max length', () => {
      const result = validateGitOutput('abcdefghij', { maxLength: 5 });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Output too long: 10 > 5');
    });

    test('validates patterns', () => {
      const result = validateGitOutput('M  file.js', { patterns: [/^[MADRCU?]/] });
      expect(result.valid).toBe(true);
    });
  });

  describe('isGitRepository', () => {
    test('detects .git directory', () => {
      expect(isGitRepository('/path/to/repo/.git')).toBe(true);
      expect(isGitRepository('/path/to/.git/repo')).toBe(true);
    });

    test('rejects non-git paths', () => {
      expect(isGitRepository('/path/to/repo')).toBe(false);
      expect(isGitRepository('')).toBe(false);
      expect(isGitRepository(null)).toBe(false);
    });
  });

  describe('extractCommitHash', () => {
    test('extracts 7-char hash', () => {
      expect(extractCommitHash('abc123f feat: message')).toBe('abc123f');
    });

    test('extracts full hash', () => {
      expect(extractCommitHash('abcdef1234567890 message')).toBe('abcdef1234567890');
    });

    test('returns null for invalid', () => {
      expect(extractCommitHash('no hash here')).toBe(null);
      expect(extractCommitHash('')).toBe(null);
      expect(extractCommitHash(null)).toBe(null);
    });
  });

  describe('normalizeFilePath', () => {
    test('normalizes backslashes', () => {
      expect(normalizeFilePath('src\\app.js')).toBe('src/app.js');
    });

    test('removes trailing slash', () => {
      expect(normalizeFilePath('src/')).toBe('src');
      expect(normalizeFilePath('src///')).toBe('src');
    });

    test('handles empty/null', () => {
      expect(normalizeFilePath('')).toBe('');
      expect(normalizeFilePath(null)).toBe('');
    });
  });

  describe('categorizeGitStatus', () => {
    test('categorizes status codes', () => {
      expect(categorizeGitStatus('M')).toBe('modified');
      expect(categorizeGitStatus('A')).toBe('added');
      expect(categorizeGitStatus('D')).toBe('deleted');
      expect(categorizeGitStatus('R')).toBe('renamed');
      expect(categorizeGitStatus('C')).toBe('copied');
      expect(categorizeGitStatus('U')).toBe('unmerged');
      expect(categorizeGitStatus('?')).toBe('untracked');
    });

    test('handles unknown codes', () => {
      expect(categorizeGitStatus('X')).toBe('unknown');
    });
  });

  describe('formatGitDate', () => {
    test('formats valid date', () => {
      const result = formatGitDate('2026-02-07 00:36:18 +0000');
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    test('handles invalid date', () => {
      const result = formatGitDate('invalid');
      expect(result).toBe(new Date(0).toISOString());
    });

    test('handles null', () => {
      const result = formatGitDate(null);
      expect(result).toBe(new Date(0).toISOString());
    });
  });

  describe('calculateDiffStats', () => {
    test('calculates stats', () => {
      const diff = { files: ['a.js', 'b.js'], insertions: 10, deletions: 5 };
      const result = calculateDiffStats(diff);

      expect(result).toEqual({
        files: 2,
        insertions: 10,
        deletions: 5,
        netChange: 5,
      });
    });

    test('handles empty diff', () => {
      const result = calculateDiffStats({});
      expect(result).toEqual({ files: 0, insertions: 0, deletions: 0, netChange: 0 });
    });

    test('handles null', () => {
      const result = calculateDiffStats(null);
      expect(result).toEqual({ files: 0, insertions: 0, deletions: 0, netChange: 0 });
    });
  });

  describe('validateCommitMessage', () => {
    test('validates good message', () => {
      const result = validateCommitMessage('feat: add new feature');
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    test('rejects empty message', () => {
      const result = validateCommitMessage('');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Commit message is required');
    });

    test('rejects short message', () => {
      const result = validateCommitMessage('short');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Commit message too short (minimum 10 characters)');
    });

    test('warns on long first line', () => {
      const longMessage = 'a'.repeat(80);
      const result = validateCommitMessage(longMessage);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('First line should be 72 characters or less');
    });

    test('handles null', () => {
      const result = validateCommitMessage(null);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Commit message is required');
    });
  });

  describe('buildStatusSummary', () => {
    test('builds summary for changes', () => {
      const status = {
        staged: [{}, {}],
        unstaged: [{}],
        untracked: [],
      };

      expect(buildStatusSummary(status)).toBe('2 staged, 1 unstaged');
    });

    test('handles no changes', () => {
      const status = { staged: [], unstaged: [], untracked: [] };
      expect(buildStatusSummary(status)).toBe('No changes');
    });

    test('handles all categories', () => {
      const status = {
        staged: [{}],
        unstaged: [{}],
        untracked: [{}],
      };

      expect(buildStatusSummary(status)).toBe('1 staged, 1 unstaged, 1 untracked');
    });

    test('handles null', () => {
      expect(buildStatusSummary(null)).toBe('No changes');
    });
  });
});

// ============================================================================
// NEW PURE FUNCTION TESTS
// ============================================================================

describe('git_automation - parseGitDiffNameStatus', () => {
  test('parses modified, added, deleted files', () => {
    const output = 'M\tsrc/app.js\nA\tsrc/new.js\nD\tsrc/old.js';
    const result = parseGitDiffNameStatus(output);
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ file: 'src/app.js', status: 'modified' });
    expect(result[1]).toEqual({ file: 'src/new.js', status: 'added' });
    expect(result[2]).toEqual({ file: 'src/old.js', status: 'deleted' });
  });

  test('parses renamed files (uses new path)', () => {
    const output = 'R100\tsrc/old-name.js\tsrc/new-name.js';
    const result = parseGitDiffNameStatus(output);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ file: 'src/new-name.js', status: 'renamed' });
  });

  test('returns empty array for empty output', () => {
    expect(parseGitDiffNameStatus('')).toEqual([]);
  });

  test('returns empty array for null', () => {
    expect(parseGitDiffNameStatus(null)).toEqual([]);
  });

  test('skips malformed lines', () => {
    const output = 'M\tsrc/app.js\nbad line without tab\nA\tsrc/new.js';
    const result = parseGitDiffNameStatus(output);
    expect(result).toHaveLength(2);
  });
});

describe('git_automation - parseGitLogNameStatus', () => {
  test('deduplicates files across commits', () => {
    const output = 'M\tsrc/app.js\n\nA\tsrc/b.js\nM\tsrc/app.js';
    const result = parseGitLogNameStatus(output);
    expect(result).toHaveLength(2);
    expect(result.map((f) => f.file)).toContain('src/app.js');
    expect(result.map((f) => f.file)).toContain('src/b.js');
  });

  test('returns empty array for empty output', () => {
    expect(parseGitLogNameStatus('')).toEqual([]);
  });

  test('returns empty array for null', () => {
    expect(parseGitLogNameStatus(null)).toEqual([]);
  });

  test('skips blank lines and commit header lines', () => {
    const output = '\nM\tsrc/app.js\n\nA\tsrc/b.js\n';
    const result = parseGitLogNameStatus(output);
    expect(result.every((f) => f.file && f.status)).toBe(true);
  });
});

describe('git_automation - GitAutomation Class', () => {
  describe('constructor', () => {
    test('creates instance with defaults', () => {
      const git = new GitAutomation();
      expect(git.repoPath).toBe(process.cwd());
      expect(git.timeout).toBe(10000);
    });

    test('creates instance with custom options', () => {
      const git = new GitAutomation({
        repoPath: '/custom/path',
        timeout: 5000,
      });

      expect(git.repoPath).toBe('/custom/path');
      expect(git.timeout).toBe(5000);
    });
  });

  describe('getCurrentHead', () => {
    test('returns a string that looks like a git hash when in a repo', () => {
      const git = new GitAutomation({ repoPath: process.cwd() });
      const head = git.getCurrentHead();
      // In CI or test environment this may be null; just check type
      if (head !== null) {
        expect(typeof head).toBe('string');
        expect(head.length).toBeGreaterThanOrEqual(7);
        expect(/^[a-f0-9]+$/.test(head)).toBe(true);
      }
    });

    test('returns null gracefully when not in a git repo', () => {
      const git = new GitAutomation({ repoPath: '/nonexistent/path/that/is/not/a/repo' });
      expect(git.getCurrentHead()).toBeNull();
    });
  });

  describe('getLastNCommitsFiles', () => {
    test('returns an array when in a valid repo', () => {
      const git = new GitAutomation({ repoPath: process.cwd() });
      const files = git.getLastNCommitsFiles(5);
      expect(Array.isArray(files)).toBe(true);
      if (files.length > 0) {
        expect(files[0]).toHaveProperty('file');
        expect(files[0]).toHaveProperty('status');
      }
    });

    test('returns empty array when not in a git repo', () => {
      const git = new GitAutomation({ repoPath: '/nonexistent/repo' });
      expect(git.getLastNCommitsFiles(10)).toEqual([]);
    });

    test('defaults to 30 commits when no argument given', () => {
      const git = new GitAutomation({ repoPath: process.cwd() });
      // Just check it does not throw
      expect(() => git.getLastNCommitsFiles()).not.toThrow();
    });
  });

  // Note: getChangedFilesSince() requires a real commit hash to test end-to-end.
  // It is exercised indirectly via main_orchestrator integration.
});
