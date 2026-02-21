/**
 * @fileoverview Tests for Git Submodules Module
 * @version 2.0.0
 */

import {
  parseSubmoduleStatus,
  parseSubmoduleConfig,
  hasSubmodules,
  isSubmoduleInitialized,
  isSubmoduleModified,
  hasSubmoduleMergeConflict,
  getSubmodulesByStatus,
  categorizeSubmodules,
  buildSubmoduleCommand,
  validateSubmodulePath,
  formatSubmoduleSummary,
  GitSubmodules,
  SUBMODULE_STATUS,
  SUBMODULE_COMMANDS,
} from '../../src/lib/git_submodules.js';

// ============================================================================
// Pure Function Tests
// ============================================================================

describe('parseSubmoduleStatus', () => {
  const COMMIT = 'abc123def456abc123def456abc123def456abc123d';
  const SHORT = COMMIT.slice(0, 40);

  test('returns empty array for empty input', () => {
    expect(parseSubmoduleStatus('')).toEqual([]);
    expect(parseSubmoduleStatus(null)).toEqual([]);
    expect(parseSubmoduleStatus(undefined)).toEqual([]);
  });

  test('parses initialized submodule (space prefix)', () => {
    const output = ` ${SHORT} .workflow_core (heads/main)`;
    const result = parseSubmoduleStatus(output);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      status: SUBMODULE_STATUS.INITIALIZED,
      commit: SHORT,
      path: '.workflow_core',
      branch: 'heads/main',
    });
  });

  test('parses uninitialized submodule (- prefix)', () => {
    const output = `-${SHORT} .workflow_core`;
    const result = parseSubmoduleStatus(output);
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe(SUBMODULE_STATUS.UNINITIALIZED);
    expect(result[0].branch).toBeNull();
  });

  test('parses modified submodule (+ prefix)', () => {
    const output = `+${SHORT} vendor/lib (v1.2.0)`;
    const result = parseSubmoduleStatus(output);
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe(SUBMODULE_STATUS.MODIFIED);
    expect(result[0].branch).toBe('v1.2.0');
  });

  test('parses merge conflict submodule (U prefix)', () => {
    const output = `U${SHORT} vendor/lib`;
    const result = parseSubmoduleStatus(output);
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe(SUBMODULE_STATUS.MERGE_CONFLICT);
  });

  test('parses multiple submodules', () => {
    const commit2 = '1234567890123456789012345678901234567890';
    const output = [` ${SHORT} .workflow_core (heads/main)`, `-${commit2} vendor/lib`].join('\n');
    const result = parseSubmoduleStatus(output);
    expect(result).toHaveLength(2);
    expect(result[0].status).toBe(SUBMODULE_STATUS.INITIALIZED);
    expect(result[1].status).toBe(SUBMODULE_STATUS.UNINITIALIZED);
  });

  test('ignores blank lines', () => {
    const output = `\n ${SHORT} .workflow_core (main)\n\n`;
    expect(parseSubmoduleStatus(output)).toHaveLength(1);
  });

  test('ignores malformed lines', () => {
    const output = `not-a-valid-line\n ${SHORT} .workflow_core`;
    const result = parseSubmoduleStatus(output);
    expect(result).toHaveLength(1);
  });
});

// ============================================================================

describe('parseSubmoduleConfig', () => {
  test('returns empty array for empty input', () => {
    expect(parseSubmoduleConfig('')).toEqual([]);
    expect(parseSubmoduleConfig(null)).toEqual([]);
  });

  test('parses single submodule config', () => {
    const output = [
      'submodule..workflow_core.path=.workflow_core',
      'submodule..workflow_core.url=https://github.com/mpbarbosa/ai_workflow_core.git',
    ].join('\n');
    const result = parseSubmoduleConfig(output);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      name: '.workflow_core',
      path: '.workflow_core',
      url: 'https://github.com/mpbarbosa/ai_workflow_core.git',
      branch: null,
    });
  });

  test('parses submodule with branch', () => {
    const output = [
      'submodule.vendor.path=vendor/lib',
      'submodule.vendor.url=https://github.com/example/vendor.git',
      'submodule.vendor.branch=stable',
    ].join('\n');
    const result = parseSubmoduleConfig(output);
    expect(result).toHaveLength(1);
    expect(result[0].branch).toBe('stable');
  });

  test('parses multiple submodule configs', () => {
    const output = [
      'submodule.a.path=lib/a',
      'submodule.a.url=https://example.com/a.git',
      'submodule.b.path=lib/b',
      'submodule.b.url=https://example.com/b.git',
    ].join('\n');
    const result = parseSubmoduleConfig(output);
    expect(result).toHaveLength(2);
  });
});

// ============================================================================

describe('hasSubmodules', () => {
  test('returns true when config output is non-empty', () => {
    expect(hasSubmodules('submodule..workflow_core.path=.workflow_core')).toBe(true);
  });

  test('returns false for empty string', () => {
    expect(hasSubmodules('')).toBe(false);
  });

  test('returns false for whitespace-only string', () => {
    expect(hasSubmodules('   \n  ')).toBe(false);
  });

  test('returns false for non-string', () => {
    expect(hasSubmodules(null)).toBe(false);
    expect(hasSubmodules(undefined)).toBe(false);
  });
});

// ============================================================================

describe('isSubmoduleInitialized', () => {
  test('returns true for initialized status', () => {
    expect(isSubmoduleInitialized({ status: SUBMODULE_STATUS.INITIALIZED })).toBe(true);
  });

  test('returns true for modified status', () => {
    expect(isSubmoduleInitialized({ status: SUBMODULE_STATUS.MODIFIED })).toBe(true);
  });

  test('returns false for uninitialized status', () => {
    expect(isSubmoduleInitialized({ status: SUBMODULE_STATUS.UNINITIALIZED })).toBe(false);
  });

  test('returns false for null/undefined', () => {
    expect(isSubmoduleInitialized(null)).toBe(false);
    expect(isSubmoduleInitialized(undefined)).toBe(false);
  });
});

// ============================================================================

describe('isSubmoduleModified', () => {
  test('returns true only for modified status', () => {
    expect(isSubmoduleModified({ status: SUBMODULE_STATUS.MODIFIED })).toBe(true);
    expect(isSubmoduleModified({ status: SUBMODULE_STATUS.INITIALIZED })).toBe(false);
    expect(isSubmoduleModified({ status: SUBMODULE_STATUS.UNINITIALIZED })).toBe(false);
  });
});

// ============================================================================

describe('hasSubmoduleMergeConflict', () => {
  test('returns true only for merge_conflict status', () => {
    expect(hasSubmoduleMergeConflict({ status: SUBMODULE_STATUS.MERGE_CONFLICT })).toBe(true);
    expect(hasSubmoduleMergeConflict({ status: SUBMODULE_STATUS.INITIALIZED })).toBe(false);
  });
});

// ============================================================================

describe('getSubmodulesByStatus', () => {
  const submodules = [
    { status: SUBMODULE_STATUS.INITIALIZED, path: 'a' },
    { status: SUBMODULE_STATUS.UNINITIALIZED, path: 'b' },
    { status: SUBMODULE_STATUS.MODIFIED, path: 'c' },
    { status: SUBMODULE_STATUS.INITIALIZED, path: 'd' },
  ];

  test('filters by initialized', () => {
    const result = getSubmodulesByStatus(submodules, SUBMODULE_STATUS.INITIALIZED);
    expect(result).toHaveLength(2);
    expect(result.map((s) => s.path)).toEqual(['a', 'd']);
  });

  test('filters by uninitialized', () => {
    expect(getSubmodulesByStatus(submodules, SUBMODULE_STATUS.UNINITIALIZED)).toHaveLength(1);
  });

  test('returns empty array for non-array input', () => {
    expect(getSubmodulesByStatus(null, SUBMODULE_STATUS.INITIALIZED)).toEqual([]);
  });
});

// ============================================================================

describe('categorizeSubmodules', () => {
  test('categorizes all status types', () => {
    const submodules = [
      { status: SUBMODULE_STATUS.INITIALIZED, path: 'a' },
      { status: SUBMODULE_STATUS.UNINITIALIZED, path: 'b' },
      { status: SUBMODULE_STATUS.MODIFIED, path: 'c' },
      { status: SUBMODULE_STATUS.MERGE_CONFLICT, path: 'd' },
    ];
    const result = categorizeSubmodules(submodules);
    expect(result.initialized).toHaveLength(1);
    expect(result.uninitialized).toHaveLength(1);
    expect(result.modified).toHaveLength(1);
    expect(result.conflicts).toHaveLength(1);
  });

  test('returns empty groups for non-array', () => {
    const result = categorizeSubmodules(null);
    expect(result).toMatchObject({
      initialized: [],
      uninitialized: [],
      modified: [],
      conflicts: [],
    });
  });
});

// ============================================================================

describe('buildSubmoduleCommand', () => {
  test('builds basic command', () => {
    expect(buildSubmoduleCommand('status')).toBe('git submodule status');
  });

  test('builds command with flags', () => {
    expect(buildSubmoduleCommand('update', ['--init', '--recursive'])).toBe(
      'git submodule update --init --recursive'
    );
  });

  test('builds command with path', () => {
    expect(buildSubmoduleCommand('init', [], '.workflow_core')).toBe(
      'git submodule init .workflow_core'
    );
  });

  test('builds command with flags and path', () => {
    expect(buildSubmoduleCommand('deinit', ['--force'], 'vendor/lib')).toBe(
      'git submodule deinit --force vendor/lib'
    );
  });
});

// ============================================================================

describe('validateSubmodulePath', () => {
  test('accepts valid paths', () => {
    expect(validateSubmodulePath('.workflow_core').valid).toBe(true);
    expect(validateSubmodulePath('vendor/lib').valid).toBe(true);
    expect(validateSubmodulePath('third_party/dep').valid).toBe(true);
  });

  test('rejects empty/null path', () => {
    expect(validateSubmodulePath('').valid).toBe(false);
    expect(validateSubmodulePath(null).valid).toBe(false);
    expect(validateSubmodulePath(undefined).valid).toBe(false);
  });

  test('rejects path traversal', () => {
    expect(validateSubmodulePath('../outside').valid).toBe(false);
    expect(validateSubmodulePath('lib/../other').valid).toBe(false);
  });
});

// ============================================================================

describe('formatSubmoduleSummary', () => {
  test('returns message for empty array', () => {
    expect(formatSubmoduleSummary([])).toBe('No submodules found.');
    expect(formatSubmoduleSummary(null)).toBe('No submodules found.');
  });

  test('includes path and status icons', () => {
    const submodules = [
      {
        status: SUBMODULE_STATUS.INITIALIZED,
        path: '.workflow_core',
        commit: 'abc1234567890000000000000000000000000000',
        branch: 'main',
      },
      {
        status: SUBMODULE_STATUS.UNINITIALIZED,
        path: 'vendor/lib',
        commit: 'def1234567890000000000000000000000000000',
        branch: null,
      },
    ];
    const summary = formatSubmoduleSummary(submodules);
    expect(summary).toContain('.workflow_core');
    expect(summary).toContain('vendor/lib');
    expect(summary).toContain('✅');
    expect(summary).toContain('⚠️');
    expect(summary).toContain('initialized');
    expect(summary).toContain('uninitialized');
  });

  test('includes correct commit short hash', () => {
    const submodules = [
      {
        status: SUBMODULE_STATUS.INITIALIZED,
        path: 'lib',
        commit: 'abcdef1234567890000000000000000000000000',
        branch: null,
      },
    ];
    const summary = formatSubmoduleSummary(submodules);
    expect(summary).toContain('abcdef1'); // first 7 chars
  });
});

// ============================================================================
// Constants Tests
// ============================================================================

describe('SUBMODULE_STATUS constants', () => {
  test('has expected values', () => {
    expect(SUBMODULE_STATUS.INITIALIZED).toBe('initialized');
    expect(SUBMODULE_STATUS.UNINITIALIZED).toBe('uninitialized');
    expect(SUBMODULE_STATUS.MODIFIED).toBe('modified');
    expect(SUBMODULE_STATUS.MERGE_CONFLICT).toBe('merge_conflict');
  });
});

describe('SUBMODULE_COMMANDS constants', () => {
  test('contains all required commands', () => {
    expect(SUBMODULE_COMMANDS.status).toContain('git submodule status');
    expect(SUBMODULE_COMMANDS.init).toContain('git submodule init');
    expect(SUBMODULE_COMMANDS.update).toContain('--init --recursive');
    expect(SUBMODULE_COMMANDS.sync).toContain('git submodule sync');
    expect(SUBMODULE_COMMANDS.foreach).toContain('git submodule foreach');
    expect(SUBMODULE_COMMANDS.hasConfig).toContain('--file .gitmodules');
  });
});

// ============================================================================
// GitSubmodules Class Tests (with injected mock executor)
// ============================================================================

/**
 * Creates a simple call-tracking mock function.
 * Avoids relying on jest globals (which may not be available in ESM contexts).
 */
function trackFn(impl) {
  const calls = [];
  const fn = async function (...args) {
    calls.push(args);
    return impl(...args);
  };
  fn.mock = { calls };
  return fn;
}

function makeExecutor(responses = {}) {
  const execute = trackFn(async (command) => {
    for (const [pattern, output] of Object.entries(responses)) {
      if (command.includes(pattern)) {
        if (output instanceof Error) throw output;
        return { stdout: output, stderr: '' };
      }
    }
    return { stdout: '', stderr: '' };
  });
  return { execute };
}

const SAMPLE_COMMIT = 'abc123def456abc123def456abc123def456abc1';
const SAMPLE_STATUS_OUTPUT = ` ${SAMPLE_COMMIT} .workflow_core (heads/main)`;
const UNINITIALIZED_STATUS = `-${SAMPLE_COMMIT} .workflow_core`;
const MODIFIED_STATUS = `+${SAMPLE_COMMIT} .workflow_core (heads/main)`;

describe('GitSubmodules class', () => {
  describe('constructor', () => {
    test('uses process.cwd() as default repoPath', () => {
      const sm = new GitSubmodules();
      expect(sm.repoPath).toBe(process.cwd());
    });

    test('accepts custom options', () => {
      const sm = new GitSubmodules({ repoPath: '/tmp/repo', timeout: 5000 });
      expect(sm.repoPath).toBe('/tmp/repo');
      expect(sm.timeout).toBe(5000);
    });
  });

  describe('hasAny()', () => {
    test('returns true when .gitmodules has entries', async () => {
      const executor = makeExecutor({
        '--file .gitmodules': 'submodule..workflow_core.path=.workflow_core',
      });
      const sm = new GitSubmodules({ executor });
      expect(await sm.hasAny()).toBe(true);
    });

    test('returns false when command fails (no .gitmodules)', async () => {
      const executor = makeExecutor({
        '--file .gitmodules': new Error('no such file'),
      });
      const sm = new GitSubmodules({ executor });
      expect(await sm.hasAny()).toBe(false);
    });
  });

  describe('getAll()', () => {
    test('returns parsed submodule list', async () => {
      const executor = makeExecutor({ 'submodule status': SAMPLE_STATUS_OUTPUT });
      const sm = new GitSubmodules({ executor });
      const result = await sm.getAll();
      expect(result).toHaveLength(1);
      expect(result[0].path).toBe('.workflow_core');
      expect(result[0].status).toBe(SUBMODULE_STATUS.INITIALIZED);
    });

    test('returns empty array when status fails', async () => {
      const executor = makeExecutor({ 'submodule status': new Error('not a repo') });
      const sm = new GitSubmodules({ executor });
      expect(await sm.getAll()).toEqual([]);
    });
  });

  describe('getConfig()', () => {
    test('returns parsed submodule configs', async () => {
      const executor = makeExecutor({
        '--file .gitmodules':
          'submodule..workflow_core.path=.workflow_core\nsubmodule..workflow_core.url=https://github.com/x/y.git',
      });
      const sm = new GitSubmodules({ executor });
      const result = await sm.getConfig();
      expect(result).toHaveLength(1);
      expect(result[0].path).toBe('.workflow_core');
    });
  });

  describe('init()', () => {
    test('runs git submodule init', async () => {
      const executor = makeExecutor({ 'submodule init': '' });
      const sm = new GitSubmodules({ executor });
      const result = await sm.init();
      expect(result.success).toBe(true);
      expect(executor.execute.mock.calls[0][0]).toContain('git submodule init');
    });

    test('runs git submodule init with path', async () => {
      const executor = makeExecutor({ 'submodule init': '' });
      const sm = new GitSubmodules({ executor });
      await sm.init('.workflow_core');
      expect(executor.execute.mock.calls[0][0]).toContain('.workflow_core');
    });

    test('throws ValidationError for invalid path', async () => {
      const sm = new GitSubmodules({ executor: makeExecutor({}) });
      await expect(sm.init('../outside')).rejects.toThrow();
    });
  });

  describe('update()', () => {
    test('runs git submodule update --init --recursive by default', async () => {
      const executor = makeExecutor({ 'submodule update': '' });
      const sm = new GitSubmodules({ executor });
      const result = await sm.update();
      expect(result.success).toBe(true);
      const cmd = executor.execute.mock.calls[0][0];
      expect(cmd).toContain('--init');
      expect(cmd).toContain('--recursive');
    });

    test('supports remote update', async () => {
      const executor = makeExecutor({ 'submodule update': '' });
      const sm = new GitSubmodules({ executor });
      await sm.update({ remote: true, init: false, recursive: false });
      const cmd = executor.execute.mock.calls[0][0];
      expect(cmd).toContain('--remote');
      expect(cmd).toContain('--merge');
    });

    test('supports path-limited update', async () => {
      const executor = makeExecutor({ 'submodule update': '' });
      const sm = new GitSubmodules({ executor });
      await sm.update({ path: '.workflow_core' });
      expect(executor.execute.mock.calls[0][0]).toContain('.workflow_core');
    });
  });

  describe('sync()', () => {
    test('runs git submodule sync', async () => {
      const executor = makeExecutor({ 'submodule sync': '' });
      const sm = new GitSubmodules({ executor });
      const result = await sm.sync();
      expect(result.success).toBe(true);
      expect(executor.execute.mock.calls[0][0]).toContain('git submodule sync');
    });

    test('runs recursive sync', async () => {
      const executor = makeExecutor({ 'submodule sync': '' });
      const sm = new GitSubmodules({ executor });
      await sm.sync({ recursive: true });
      expect(executor.execute.mock.calls[0][0]).toContain('--recursive');
    });
  });

  describe('foreach()', () => {
    test('runs git submodule foreach with command', async () => {
      const executor = makeExecutor({ 'submodule foreach': 'output' });
      const sm = new GitSubmodules({ executor });
      const result = await sm.foreach('git pull');
      expect(result.success).toBe(true);
      expect(executor.execute.mock.calls[0][0]).toContain('git pull');
    });

    test('supports recursive foreach', async () => {
      const executor = makeExecutor({ 'submodule foreach': '' });
      const sm = new GitSubmodules({ executor });
      await sm.foreach('git status', true);
      expect(executor.execute.mock.calls[0][0]).toContain('--recursive');
    });

    test('throws for empty command', async () => {
      const sm = new GitSubmodules({ executor: makeExecutor({}) });
      await expect(sm.foreach('')).rejects.toThrow();
    });
  });

  describe('add()', () => {
    test('adds a submodule', async () => {
      const executor = makeExecutor({ 'submodule add': '' });
      const sm = new GitSubmodules({ executor });
      const result = await sm.add('https://github.com/x/y.git', 'vendor/y');
      expect(result.success).toBe(true);
      const cmd = executor.execute.mock.calls[0][0];
      expect(cmd).toContain('https://github.com/x/y.git');
      expect(cmd).toContain('vendor/y');
    });

    test('supports branch option', async () => {
      const executor = makeExecutor({ 'submodule add': '' });
      const sm = new GitSubmodules({ executor });
      await sm.add('https://github.com/x/y.git', 'vendor/y', { branch: 'stable' });
      expect(executor.execute.mock.calls[0][0]).toContain('-b');
      expect(executor.execute.mock.calls[0][0]).toContain('stable');
    });

    test('throws for invalid path', async () => {
      const sm = new GitSubmodules({ executor: makeExecutor({}) });
      await expect(sm.add('https://example.com/y.git', '../outside')).rejects.toThrow();
    });

    test('throws for empty URL', async () => {
      const sm = new GitSubmodules({ executor: makeExecutor({}) });
      await expect(sm.add('', 'vendor/y')).rejects.toThrow();
    });
  });

  describe('deinit()', () => {
    test('deinits a submodule', async () => {
      const executor = makeExecutor({ 'submodule deinit': '' });
      const sm = new GitSubmodules({ executor });
      const result = await sm.deinit('.workflow_core');
      expect(result.success).toBe(true);
      expect(executor.execute.mock.calls[0][0]).toContain('.workflow_core');
    });

    test('supports force deinit', async () => {
      const executor = makeExecutor({ 'submodule deinit': '' });
      const sm = new GitSubmodules({ executor });
      await sm.deinit('.workflow_core', true);
      expect(executor.execute.mock.calls[0][0]).toContain('--force');
    });
  });

  describe('initAndUpdate()', () => {
    test('runs update and returns parsed submodules', async () => {
      const executor = makeExecutor({
        'submodule update': '',
        'submodule status': SAMPLE_STATUS_OUTPUT,
      });
      const sm = new GitSubmodules({ executor });
      const result = await sm.initAndUpdate();
      expect(result.success).toBe(true);
      expect(result.submodules).toHaveLength(1);
    });
  });

  describe('ensureInitialized()', () => {
    test('does nothing when all submodules are already initialized', async () => {
      const executor = makeExecutor({ 'submodule status': SAMPLE_STATUS_OUTPUT });
      const sm = new GitSubmodules({ executor });
      const result = await sm.ensureInitialized();
      expect(result.success).toBe(true);
      expect(result.initialized).toHaveLength(0);
      expect(result.alreadyReady).toContain('.workflow_core');
    });

    test('initializes uninitialized submodules', async () => {
      let callCount = 0;
      const mockExecutor = {
        execute: trackFn(async (cmd) => {
          if (cmd.includes('submodule status')) {
            callCount++;
            // First call: uninitialized; second call (after update): initialized
            return {
              stdout: callCount === 1 ? UNINITIALIZED_STATUS : SAMPLE_STATUS_OUTPUT,
            };
          }
          return { stdout: '' };
        }),
      };
      const sm = new GitSubmodules({ executor: mockExecutor });
      const result = await sm.ensureInitialized();
      expect(result.success).toBe(true);
      expect(result.initialized).toContain('.workflow_core');
    });

    test('includes modified submodules in alreadyReady', async () => {
      const executor = makeExecutor({ 'submodule status': MODIFIED_STATUS });
      const sm = new GitSubmodules({ executor });
      const result = await sm.ensureInitialized();
      expect(result.alreadyReady).toContain('.workflow_core');
    });
  });
});
