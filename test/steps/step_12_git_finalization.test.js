/**
 * Tests for Step 12: Git Finalization
 * @group steps
 */

import { jest } from '@jest/globals';
import {
  Step12GitFinalization,
  COMMIT_TYPES,
  parseGitStatus,
  categorizeFiles,
  inferCommitType,
  calculateImpactScore,
  generateCommitMessage,
  parseDiffSummary,
  parseCommitCounts,
  hasSubmodules,
  parseSubmoduleStatus,
  formatGitReport,
} from '../../src/steps/step_12_git_finalization.js';

describe('Step 12: Git Finalization', () => {
  // ========================================================================
  // PURE FUNCTIONS - Git State Analysis
  // ========================================================================

  describe('parseGitStatus', () => {
    test('parses empty status', () => {
      const result = parseGitStatus('');
      expect(result.modified).toEqual([]);
      expect(result.staged).toEqual([]);
      expect(result.untracked).toEqual([]);
      expect(result.deleted).toEqual([]);
    });

    test('parses modified files', () => {
      const output = ' M src/file1.js\n M src/file2.js';
      const result = parseGitStatus(output);
      expect(result.modified).toEqual(['src/file1.js', 'src/file2.js']);
    });

    test('parses untracked files', () => {
      const output = '?? new-file.js\n?? another.js';
      const result = parseGitStatus(output);
      expect(result.untracked).toEqual(['new-file.js', 'another.js']);
    });

    test('parses deleted files', () => {
      const output = ' D old-file.js\nD  removed.js';
      const result = parseGitStatus(output);
      expect(result.deleted).toEqual(['old-file.js', 'removed.js']);
    });

    test('parses staged files', () => {
      const output = 'M  staged-file.js\nA  new-staged.js';
      const result = parseGitStatus(output);
      expect(result.staged).toEqual(['staged-file.js', 'new-staged.js']);
    });

    test('parses mixed status', () => {
      const output = 'M  staged.js\n M modified.js\n?? untracked.js\n D deleted.js';
      const result = parseGitStatus(output);
      expect(result.staged.length).toBeGreaterThan(0);
      expect(result.modified).toContain('modified.js');
      expect(result.untracked).toContain('untracked.js');
      expect(result.deleted).toContain('deleted.js');
    });
  });

  describe('categorizeFiles', () => {
    test('categorizes empty list', () => {
      const result = categorizeFiles([]);
      expect(result.documentation).toBe(0);
      expect(result.tests).toBe(0);
      expect(result.scripts).toBe(0);
      expect(result.code).toBe(0);
      expect(result.config).toBe(0);
    });

    test('categorizes documentation files', () => {
      const files = ['README.md', 'docs/guide.md', 'CHANGELOG.txt'];
      const result = categorizeFiles(files);
      expect(result.documentation).toBe(3);
    });

    test('categorizes test files', () => {
      const files = ['src/app.test.js', 'test/utils.spec.ts', 'tests/integration.test.py'];
      const result = categorizeFiles(files);
      expect(result.tests).toBe(3);
    });

    test('categorizes script files', () => {
      const files = ['deploy.sh', 'scripts/build.bash', 'setup.ps1'];
      const result = categorizeFiles(files);
      expect(result.scripts).toBe(3);
    });

    test('categorizes code files', () => {
      const files = ['src/index.js', 'lib/utils.py', 'main.go', 'App.java'];
      const result = categorizeFiles(files);
      expect(result.code).toBe(4);
    });

    test('categorizes config files', () => {
      const files = ['package.json', 'config.yaml', 'settings.toml'];
      const result = categorizeFiles(files);
      expect(result.config).toBe(3);
    });

    test('categorizes mixed files', () => {
      const files = [
        'README.md',
        'src/index.js',
        'test/app.test.js',
        'deploy.sh',
        'config.json',
        'unknown.xyz',
      ];
      const result = categorizeFiles(files);
      expect(result.documentation).toBe(1);
      expect(result.code).toBe(1);
      expect(result.tests).toBe(1);
      expect(result.scripts).toBe(1);
      expect(result.config).toBe(1);
      expect(result.other).toBe(1);
    });
  });

  describe('inferCommitType', () => {
    test('infers feat for code+tests', () => {
      const categories = { code: 2, tests: 1, documentation: 0, scripts: 0, config: 0 };
      const result = inferCommitType(categories);
      expect(result.type).toBe(COMMIT_TYPES.feat);
      expect(result.scope).toBe('implementation+tests');
    });

    test('infers feat for code only', () => {
      const categories = { code: 3, tests: 0, documentation: 0, scripts: 0, config: 0 };
      const result = inferCommitType(categories);
      expect(result.type).toBe(COMMIT_TYPES.feat);
      expect(result.scope).toBe('implementation');
    });

    test('infers test for tests only', () => {
      const categories = { code: 0, tests: 2, documentation: 0, scripts: 0, config: 0 };
      const result = inferCommitType(categories);
      expect(result.type).toBe(COMMIT_TYPES.test);
      expect(result.scope).toBe('testing');
    });

    test('infers docs for documentation only', () => {
      const categories = { code: 0, tests: 0, documentation: 3, scripts: 0, config: 0 };
      const result = inferCommitType(categories);
      expect(result.type).toBe(COMMIT_TYPES.docs);
      expect(result.scope).toBe('documentation');
    });

    test('infers chore for scripts', () => {
      const categories = { code: 0, tests: 0, documentation: 0, scripts: 2, config: 0 };
      const result = inferCommitType(categories);
      expect(result.type).toBe(COMMIT_TYPES.chore);
      expect(result.scope).toBe('automation');
    });

    test('infers chore for config', () => {
      const categories = { code: 0, tests: 0, documentation: 0, scripts: 0, config: 1 };
      const result = inferCommitType(categories);
      expect(result.type).toBe(COMMIT_TYPES.chore);
      expect(result.scope).toBe('configuration');
    });

    test('infers chore for no changes', () => {
      const categories = { code: 0, tests: 0, documentation: 0, scripts: 0, config: 0 };
      const result = inferCommitType(categories);
      expect(result.type).toBe(COMMIT_TYPES.chore);
      expect(result.scope).toBe('general');
    });
  });

  describe('calculateImpactScore', () => {
    test('calculates zero for empty categories', () => {
      const categories = { documentation: 0, tests: 0, scripts: 0, code: 0, config: 0 };
      expect(calculateImpactScore(categories)).toBe(0);
    });

    test('calculates score for code changes (weight 5)', () => {
      const categories = { code: 2, tests: 0, documentation: 0, scripts: 0, config: 0 };
      expect(calculateImpactScore(categories)).toBe(10); // 2 * 5
    });

    test('calculates score for test changes (weight 3)', () => {
      const categories = { code: 0, tests: 3, documentation: 0, scripts: 0, config: 0 };
      expect(calculateImpactScore(categories)).toBe(9); // 3 * 3
    });

    test('calculates combined score', () => {
      const categories = { code: 1, tests: 1, documentation: 2, scripts: 1, config: 1 };
      // code: 1*5=5, tests: 1*3=3, docs: 2*1=2, scripts: 1*2=2, config: 1*1=1
      expect(calculateImpactScore(categories)).toBe(13);
    });
  });

  // ========================================================================
  // PURE FUNCTIONS - Commit Message Generation
  // ========================================================================

  describe('generateCommitMessage', () => {
    test('generates basic commit message', () => {
      const options = {
        type: 'feat',
        scope: 'implementation',
        description: 'add new feature',
        modifiedCount: 5,
        categories: { code: 3, tests: 2 },
        totalChanges: 5,
      };
      const message = generateCommitMessage(options);
      expect(message).toContain('feat(implementation): add new feature');
      expect(message).toContain('Modified files: 5');
      expect(message).toContain('Code: 3 files');
      expect(message).toContain('Tests: 2 files');
    });

    test('generates message without scope', () => {
      const options = {
        type: 'docs',
        description: 'update documentation',
        modifiedCount: 2,
        categories: { documentation: 2 },
        totalChanges: 2,
      };
      const message = generateCommitMessage(options);
      expect(message).toContain('docs: update documentation');
    });

    test('includes version footer', () => {
      const options = {
        type: 'chore',
        scope: 'automation',
        description: 'update scripts',
        version: '1.2.0',
      };
      const message = generateCommitMessage(options);
      expect(message).toContain('[workflow-automation v1.2.0]');
    });

    test('includes change scope', () => {
      const options = {
        type: 'feat',
        scope: 'api',
        description: 'add endpoint',
        changeScope: 'User authentication',
        modifiedCount: 3,
        totalChanges: 3,
      };
      const message = generateCommitMessage(options);
      expect(message).toContain('Scope: User authentication');
    });
  });

  describe('parseDiffSummary', () => {
    test('parses empty diff', () => {
      const result = parseDiffSummary('');
      expect(result.filesChanged).toBe(0);
      expect(result.insertions).toBe(0);
      expect(result.deletions).toBe(0);
    });

    test('parses diff with insertions only', () => {
      const output = '3 files changed, 45 insertions(+)';
      const result = parseDiffSummary(output);
      expect(result.filesChanged).toBe(3);
      expect(result.insertions).toBe(45);
      expect(result.deletions).toBe(0);
    });

    test('parses diff with deletions only', () => {
      const output = '2 files changed, 30 deletions(-)';
      const result = parseDiffSummary(output);
      expect(result.filesChanged).toBe(2);
      expect(result.insertions).toBe(0);
      expect(result.deletions).toBe(30);
    });

    test('parses diff with insertions and deletions', () => {
      const output = '5 files changed, 120 insertions(+), 80 deletions(-)';
      const result = parseDiffSummary(output);
      expect(result.filesChanged).toBe(5);
      expect(result.insertions).toBe(120);
      expect(result.deletions).toBe(80);
    });
  });

  describe('parseCommitCounts', () => {
    test('parses zero commits', () => {
      const result = parseCommitCounts('0', '0');
      expect(result.ahead).toBe(0);
      expect(result.behind).toBe(0);
    });

    test('parses commits ahead', () => {
      const result = parseCommitCounts('3', '0');
      expect(result.ahead).toBe(3);
      expect(result.behind).toBe(0);
    });

    test('parses commits behind', () => {
      const result = parseCommitCounts('0', '5');
      expect(result.ahead).toBe(0);
      expect(result.behind).toBe(5);
    });

    test('parses commits ahead and behind', () => {
      const result = parseCommitCounts('2', '4');
      expect(result.ahead).toBe(2);
      expect(result.behind).toBe(4);
    });
  });

  describe('hasSubmodules', () => {
    test('returns false for empty output', () => {
      expect(hasSubmodules('')).toBe(false);
      expect(hasSubmodules('   \n  ')).toBe(false);
    });

    test('returns true for submodule config', () => {
      const output = 'submodule.lib/vendor.url=https://github.com/example/vendor.git';
      expect(hasSubmodules(output)).toBe(true);
    });
  });

  describe('parseSubmoduleStatus', () => {
    test('parses empty status', () => {
      const result = parseSubmoduleStatus('');
      expect(result).toEqual([]);
    });

    test('parses initialized submodule', () => {
      const output = 'abc123def456abc123def456abc123def456abc123d lib/vendor (heads/main)';
      const result = parseSubmoduleStatus(output);
      expect(result).toHaveLength(1);
      expect(result[0].commit).toBe('abc123def456abc123def456abc123def456abc123d');
      expect(result[0].path).toBe('lib/vendor');
      expect(result[0].branch).toBe('heads/main');
      expect(result[0].status).toBe('initialized');
    });

    test('parses uninitialized submodule', () => {
      const output = '-abc123def456abc123def456abc123def456abc123d lib/vendor';
      const result = parseSubmoduleStatus(output);
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('-');
      expect(result[0].path).toBe('lib/vendor');
    });

    test('parses modified submodule', () => {
      const output = '+abc123def456abc123def456abc123def456abc123d lib/vendor (heads/main)';
      const result = parseSubmoduleStatus(output);
      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('+');
    });

    test('parses multiple submodules', () => {
      const output =
        'abc123def456abc123def456abc123def456abc123d lib/vendor1 (main)\n+def456abc789def456abc789def456abc789def456a lib/vendor2 (dev)';
      const result = parseSubmoduleStatus(output);
      expect(result).toHaveLength(2);
      expect(result[0].path).toBe('lib/vendor1');
      expect(result[0].status).toBe('initialized');
      expect(result[1].path).toBe('lib/vendor2');
      expect(result[1].status).toBe('+');
    });
  });

  // ========================================================================
  // PURE FUNCTIONS - Report Generation
  // ========================================================================

  describe('formatGitReport', () => {
    test('formats basic report', () => {
      const data = {
        branch: 'main',
        commitsAhead: 1,
        commitsBehind: 0,
        commitType: 'feat',
        commitScope: 'implementation',
        modifiedCount: 5,
        totalChanges: 5,
      };
      const report = formatGitReport(data);
      expect(report).toContain('### Git Finalization Summary');
      expect(report).toContain('**Branch:** main');
      expect(report).toContain('**Commits Ahead:** 1');
      expect(report).toContain('**Commit Type:** feat(implementation)');
      expect(report).toContain('**Modified Files:** 5');
    });

    test('includes categories breakdown', () => {
      const data = {
        branch: 'develop',
        commitsAhead: 2,
        commitsBehind: 0,
        commitType: 'chore',
        commitScope: 'automation',
        modifiedCount: 10,
        totalChanges: 10,
        categories: {
          documentation: 2,
          tests: 3,
          scripts: 2,
          code: 3,
          config: 0,
        },
      };
      const report = formatGitReport(data);
      expect(report).toContain('### Change Breakdown');
      expect(report).toContain('Documentation: 2 files');
      expect(report).toContain('Tests: 3 files');
      expect(report).toContain('Scripts: 2 files');
      expect(report).toContain('Code: 3 files');
    });

    test('includes commit message', () => {
      const data = {
        branch: 'main',
        commitsAhead: 1,
        commitsBehind: 0,
        commitType: 'docs',
        commitScope: 'documentation',
        modifiedCount: 2,
        totalChanges: 2,
        commitMessage: 'docs(documentation): update README\n\nDetailed changes...',
      };
      const report = formatGitReport(data);
      expect(report).toContain('### Commit Message');
      expect(report).toContain('docs(documentation): update README');
    });

    test('includes push status success', () => {
      const data = {
        branch: 'main',
        commitsAhead: 1,
        commitsBehind: 0,
        commitType: 'feat',
        commitScope: 'api',
        modifiedCount: 5,
        totalChanges: 5,
        pushed: true,
      };
      const report = formatGitReport(data);
      expect(report).toContain('**Push Status:** ✅ Pushed successfully');
    });

    test('includes push status failure', () => {
      const data = {
        branch: 'main',
        commitsAhead: 1,
        commitsBehind: 0,
        commitType: 'feat',
        commitScope: 'api',
        modifiedCount: 5,
        totalChanges: 5,
        pushed: false,
      };
      const report = formatGitReport(data);
      expect(report).toContain('**Push Status:** ❌ Push failed');
    });
  });

  // ========================================================================
  // STEP12GITFINALIZATION - Integration Tests
  // ========================================================================

  describe('Step12GitFinalization', () => {
    let mockExecutor;
    let mockBacklog;
    let mockLogger;

    beforeEach(() => {
      mockExecutor = {
        executeCommand: jest.fn(),
      };
      mockBacklog = {
        saveStepSummary: jest.fn(),
        saveStepIssues: jest.fn(),
      };
      mockLogger = {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        step: jest.fn(),
      };
    });

    test('constructs with default options', () => {
      const step = new Step12GitFinalization();
      expect(step).toBeInstanceOf(Step12GitFinalization);
      expect(step.dryRun).toBe(false);
      expect(step.interactiveMode).toBe(false);
    });

    test('constructs with custom options', () => {
      const step = new Step12GitFinalization({
        executor: mockExecutor,
        backlogManager: mockBacklog,
        logger: mockLogger,
        dryRun: true,
        aiEnabled: true,
      });
      expect(step.executor).toBe(mockExecutor);
      expect(step.backlogManager).toBe(mockBacklog);
      expect(step.logger).toBe(mockLogger);
      expect(step.dryRun).toBe(true);
      expect(step.aiEnabled).toBe(true);
    });

    test('executes dry-run mode', async () => {
      const step = new Step12GitFinalization({
        backlogManager: mockBacklog,
        logger: mockLogger,
        dryRun: true,
      });

      const result = await step.execute();

      expect(result.success).toBe(true);
      expect(result.dryRun).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith('[DRY RUN] Git operations preview:');
      expect(mockBacklog.saveStepSummary).toHaveBeenCalled();
    });

    test('handles no changes scenario', async () => {
      mockExecutor.executeCommand = jest
        .fn()
        .mockResolvedValueOnce({ stdout: 'main' }) // current branch
        .mockResolvedValueOnce({ stdout: '0' }) // commits ahead
        .mockResolvedValueOnce({ stdout: '0' }) // commits behind
        .mockResolvedValueOnce({ stdout: '' }) // git status (no changes)
        .mockRejectedValueOnce(new Error('no submodules')); // submodules check

      const step = new Step12GitFinalization({
        executor: mockExecutor,
        backlogManager: mockBacklog,
        logger: mockLogger,
      });

      const result = await step.execute();

      expect(result.success).toBe(true);
      expect(result.noChanges).toBe(true);
      expect(result.branch).toBe('main');
      expect(mockBacklog.saveStepSummary).toHaveBeenCalledWith(
        '12',
        'Git_Finalization',
        expect.stringContaining('No changes to commit'),
        '✅'
      );
    });
  });
});
