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
  isWorktreeClean,
  shouldCreateTag,
  buildTagCommand,
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

    test('preserves leading dots in file paths', () => {
      const output = 'M  .github/skills/sync-workflow-config/SKILL.md';
      const result = parseGitStatus(output);
      expect(result.staged).toEqual(['.github/skills/sync-workflow-config/SKILL.md']);
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

  describe('isWorktreeClean', () => {
    test('returns true when no tracked or untracked changes remain', () => {
      expect(isWorktreeClean({ modified: [], staged: [], untracked: [], deleted: [] })).toBe(true);
    });

    test('returns false when any change bucket is non-empty', () => {
      expect(
        isWorktreeClean({ modified: ['src/file.js'], staged: [], untracked: [], deleted: [] })
      ).toBe(false);
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
        projectFileCount: 5,
        categories: { code: 3, tests: 2 },
        totalChanges: 5,
      };
      const message = generateCommitMessage(options);
      expect(message).toContain('feat(implementation): add new feature');
      expect(message).toContain('Changed project files: 5');
      expect(message).toContain('Code: 3 files');
      expect(message).toContain('Tests: 2 files');
      expect(message).toContain(
        'Workflow automation summarized the staged changes available to Step 12.'
      );
      expect(message).not.toContain('completed comprehensive validation');
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
        projectFileCount: 3,
        totalChanges: 3,
      };
      const message = generateCommitMessage(options);
      expect(message).toContain('Scope: User authentication');
    });

    test('notes staged artifact count when it exceeds project file count', () => {
      const options = {
        type: 'docs',
        scope: 'documentation',
        description: 'update docs',
        projectFileCount: 2,
        stagedFileCount: 5,
        totalChanges: 2,
      };
      const message = generateCommitMessage(options);
      expect(message).toContain('Changed project files: 2');
      expect(message).toContain('All staged files: 5 (includes workflow artifacts)');
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

    test('skips git finalization after earlier critical failures by default', async () => {
      const step = new Step12GitFinalization({
        executor: mockExecutor,
        backlogManager: mockBacklog,
        logger: mockLogger,
      });

      const result = await step.execute({
        criticalStepIds: ['step_08'],
        results: [{ stepId: 'step_08', stepName: 'Test Execution', success: false }],
      });

      expect(result).toEqual(
        expect.objectContaining({
          success: true,
          skipped: true,
          blockedByFailures: ['step_08'],
        })
      );
      expect(mockExecutor.executeCommand).not.toHaveBeenCalled();
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

    test('pushes to remote after commit even when commitsAhead was 0 before commit', async () => {
      // Simulate repo in sync with remote (commitsAhead=0) before new commit
      mockExecutor.executeCommand = jest
        .fn()
        .mockResolvedValueOnce({ stdout: 'main' }) // current branch
        .mockResolvedValueOnce({ stdout: '0' }) // commits ahead (stale: before new commit)
        .mockResolvedValueOnce({ stdout: '0' }) // commits behind
        .mockResolvedValueOnce({ stdout: 'M  src/lib/foo.js' }) // git status (has changes)
        .mockRejectedValueOnce(new Error('no submodules')) // submodules check
        .mockResolvedValueOnce({ stdout: '' }) // git rm --cached volatile workflow state
        .mockResolvedValueOnce({ stdout: '' }) // git add -A
        .mockResolvedValueOnce({ stdout: '' }) // git add -f .ai_workflow/.step_cache/
        .mockResolvedValueOnce({ stdout: '' }) // git commit
        .mockResolvedValueOnce({ stdout: '' }) // git tag v<current>
        .mockResolvedValueOnce({ stdout: '' }) // git push origin v<current>
        .mockResolvedValueOnce({ stdout: '' }) // git add -f .ai_workflow/ (pre-push stage)
        .mockResolvedValueOnce({ stdout: 'No local changes to save' }) // git stash
        .mockResolvedValueOnce({ stdout: '' }) // git pull --rebase
        .mockResolvedValueOnce({ stdout: '' }); // git push origin main

      const mockAiHelper = { initialize: jest.fn().mockResolvedValue(false) };

      const step = new Step12GitFinalization({
        executor: mockExecutor,
        backlogManager: mockBacklog,
        logger: mockLogger,
        aiHelper: mockAiHelper,
      });

      const result = await step.execute();

      expect(result.success).toBe(true);
      // Verify both pull and push were called
      const calls = mockExecutor.executeCommand.mock.calls.map((c) => c[0]);
      expect(calls.some((cmd) => cmd.includes('git pull --rebase'))).toBe(true);
      expect(calls.some((cmd) => cmd.includes('git push origin'))).toBe(true);
      expect(result.pushed).toBe(true);
    });

    test('fails when git finalization leaves the worktree dirty', async () => {
      const mockAiHelper = { initialize: jest.fn().mockResolvedValue(false) };
      const step = new Step12GitFinalization({
        executor: mockExecutor,
        backlogManager: mockBacklog,
        logger: mockLogger,
        aiHelper: mockAiHelper,
      });
      jest
        .spyOn(step, '_ensureCleanWorktree')
        .mockRejectedValue(
          new Error('Step 12 postcondition failed: target repo worktree is not clean')
        );

      await expect(step.execute()).rejects.toThrow(
        'Step 12 postcondition failed: target repo worktree is not clean'
      );
    });

    // [BUG FIX 9a42860] promptsDir must be forwarded to AiHelper
    test('[BUG FIX] promptsDir option is accepted without error', () => {
      const step = new Step12GitFinalization({
        promptsDir: '/tmp/prompts/step_12',
      });
      expect(step).toBeDefined();
      expect(step.aiHelper).toBeDefined();
    });

    test('stages after generating the commit message', async () => {
      const step = new Step12GitFinalization({
        executor: mockExecutor,
        backlogManager: mockBacklog,
        logger: mockLogger,
        aiHelper: { initialize: jest.fn().mockResolvedValue(false) },
      });
      const events = [];
      jest.spyOn(step, '_analyzeGitState').mockResolvedValue({
        branch: 'main',
        commitsAhead: 0,
        commitsBehind: 0,
        status: parseGitStatus('M  src/lib/foo.js'),
        categories: { documentation: 0, tests: 0, scripts: 0, code: 1, config: 0, other: 0 },
        commitType: 'feat',
        commitScope: 'implementation',
        totalChanges: 1,
        projectChangeCount: 1,
        modifiedCount: 1,
        hasSubmodules: false,
      });
      jest.spyOn(step, '_generateCommitMessage').mockImplementation(async () => {
        events.push('generate');
        return 'feat(implementation): update implementation';
      });
      jest.spyOn(step, '_stageChanges').mockImplementation(async () => {
        events.push('stage');
      });
      jest.spyOn(step, '_commitChanges').mockResolvedValue(true);
      jest.spyOn(step, '_readProjectVersion').mockResolvedValue('');
      jest.spyOn(step, '_tagVersion').mockResolvedValue(undefined);
      jest.spyOn(step, '_pushToRemote').mockResolvedValue({ pushed: false, reason: 'up-to-date' });
      jest.spyOn(step, '_ensureCleanWorktree').mockResolvedValue(undefined);
      jest.spyOn(step, '_generateReport').mockReturnValue({
        success: true,
        branch: 'main',
        pushed: false,
      });

      const result = await step.execute();

      expect(result.success).toBe(true);
      expect(events).toEqual(['generate', 'stage']);
    });

    // Automated commits run pre-commit hooks to enforce quality gates
    test('git commit runs pre-commit hooks', async () => {
      mockExecutor.executeCommand = jest
        .fn()
        .mockResolvedValueOnce({ stdout: 'main' }) // current branch
        .mockResolvedValueOnce({ stdout: '0' }) // commits ahead
        .mockResolvedValueOnce({ stdout: '0' }) // commits behind
        .mockResolvedValueOnce({ stdout: 'M  src/lib/foo.js' }) // git status
        .mockRejectedValueOnce(new Error('no submodules')) // submodules
        .mockResolvedValueOnce({ stdout: '' }) // git rm --cached volatile workflow state
        .mockResolvedValueOnce({ stdout: '' }) // git add -A
        .mockResolvedValueOnce({ stdout: '' }) // git add -f .ai_workflow/.step_cache/
        .mockResolvedValueOnce({ stdout: '' }) // git commit
        .mockResolvedValueOnce({ stdout: 'No local changes to save' }) // git stash
        .mockResolvedValueOnce({ stdout: '' }) // git pull --rebase
        .mockResolvedValueOnce({ stdout: '' }); // git push

      const mockAiHelper = { initialize: jest.fn().mockResolvedValue(false) };
      const step = new Step12GitFinalization({
        executor: mockExecutor,
        backlogManager: mockBacklog,
        logger: mockLogger,
        aiHelper: mockAiHelper,
      });

      await step.execute();

      const calls = mockExecutor.executeCommand.mock.calls.map((c) => c[0]);
      const commitCall = calls.find((cmd) => cmd.includes('git commit'));
      expect(commitCall).toBeDefined();
      expect(commitCall).not.toContain('--no-verify');
    });

    // "nothing to commit" must be treated as success, not an error
    test('handles "nothing to commit" from git gracefully', async () => {
      const nothingToCommitError = Object.assign(new Error('Command failed: git commit -F ...'), {
        stderr: 'nothing to commit, working tree clean',
        exitCode: 1,
      });

      mockExecutor.executeCommand = jest
        .fn()
        .mockResolvedValueOnce({ stdout: 'main' }) // current branch
        .mockResolvedValueOnce({ stdout: '0' }) // commits ahead
        .mockResolvedValueOnce({ stdout: '0' }) // commits behind
        .mockResolvedValueOnce({ stdout: 'M  src/lib/foo.js' }) // git status
        .mockRejectedValueOnce(new Error('no submodules')) // submodules
        .mockResolvedValueOnce({ stdout: '' }) // git rm --cached volatile workflow state
        .mockResolvedValueOnce({ stdout: '' }) // git add -A
        .mockResolvedValueOnce({ stdout: '' }) // git add -f .ai_workflow/.step_cache/
        .mockRejectedValueOnce(nothingToCommitError); // git commit fails

      const mockAiHelper = { initialize: jest.fn().mockResolvedValue(false) };
      const step = new Step12GitFinalization({
        executor: mockExecutor,
        backlogManager: mockBacklog,
        logger: mockLogger,
        aiHelper: mockAiHelper,
      });

      const result = await step.execute();
      expect(result.success).toBe(true);
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    // When submodules are present, dirty changes inside them must be committed
    // before `git add -A` in the parent can capture the updated pointer.
    test('commits dirty changes inside submodules before staging the parent repo', async () => {
      // git config --file .gitmodules --list returns non-empty → hasSubmodules = true
      const submoduleConfigOutput =
        '[submodule ".workflow_core"]\n\tpath = .workflow_core\n\turl = ...';

      mockExecutor.executeCommand = jest
        .fn()
        .mockResolvedValueOnce({ stdout: 'main' }) // current branch
        .mockResolvedValueOnce({ stdout: '1' }) // commits ahead
        .mockResolvedValueOnce({ stdout: '0' }) // commits behind
        .mockResolvedValueOnce({ stdout: 'M  src/lib/foo.js' }) // git status
        .mockResolvedValueOnce({ stdout: submoduleConfigOutput }) // git config --file .gitmodules
        .mockResolvedValueOnce({ stdout: '' }) // git submodule update --init (processSubmodules)
        .mockResolvedValueOnce({ stdout: '' }) // _stageSubmoduleChanges: git submodule foreach git add -A
        .mockResolvedValueOnce({ stdout: '' }) // _stageSubmoduleChanges: git submodule foreach commit
        .mockResolvedValueOnce({ stdout: '' }) // git rm --cached volatile workflow state
        .mockResolvedValueOnce({ stdout: '' }) // git add -A (parent)
        .mockResolvedValueOnce({ stdout: '' }) // git add -f .ai_workflow/.step_cache/
        .mockResolvedValueOnce({ stdout: '' }) // git commit
        .mockResolvedValueOnce({ stdout: 'No local changes to save' }) // git stash
        .mockResolvedValueOnce({ stdout: '' }) // git pull --rebase
        .mockResolvedValueOnce({ stdout: '' }); // git push

      const mockAiHelper = { initialize: jest.fn().mockResolvedValue(false) };
      const step = new Step12GitFinalization({
        executor: mockExecutor,
        backlogManager: mockBacklog,
        logger: mockLogger,
        aiHelper: mockAiHelper,
      });

      const result = await step.execute();

      expect(result.success).toBe(true);
      const calls = mockExecutor.executeCommand.mock.calls.map((c) => c[0]);
      // Submodule foreach add must appear before the parent git add -A
      const foreachAddIdx = calls.findIndex((cmd) => cmd.includes('submodule foreach git add'));
      const parentAddIdx = calls.findIndex((cmd) => cmd === 'git add -A');
      expect(foreachAddIdx).toBeGreaterThanOrEqual(0);
      expect(foreachAddIdx).toBeLessThan(parentAddIdx);
    });

    // Even if submodule commits fail (e.g. identity not configured), staging must continue
    test('continues parent staging when submodule commit fails', async () => {
      const submoduleConfigOutput = '[submodule ".workflow_core"]\n\tpath = .workflow_core';

      mockExecutor.executeCommand = jest
        .fn()
        .mockResolvedValueOnce({ stdout: 'main' }) // current branch
        .mockResolvedValueOnce({ stdout: '1' }) // commits ahead
        .mockResolvedValueOnce({ stdout: '0' }) // commits behind
        .mockResolvedValueOnce({ stdout: 'M  src/lib/foo.js' }) // git status
        .mockResolvedValueOnce({ stdout: submoduleConfigOutput }) // git config --file .gitmodules
        .mockResolvedValueOnce({ stdout: '' }) // git submodule update --init
        .mockResolvedValueOnce({ stdout: '' }) // git submodule foreach git add -A
        .mockRejectedValueOnce(new Error('Committer identity unknown')) // submodule commit fails
        .mockResolvedValueOnce({ stdout: '' }) // git rm --cached volatile workflow state
        .mockResolvedValueOnce({ stdout: '' }) // git add -A (parent) — must still run
        .mockResolvedValueOnce({ stdout: '' }) // git add -f .ai_workflow/.step_cache/
        .mockResolvedValueOnce({ stdout: '' }) // git commit
        .mockResolvedValueOnce({ stdout: 'No local changes to save' }) // git stash
        .mockResolvedValueOnce({ stdout: '' }) // git pull --rebase
        .mockResolvedValueOnce({ stdout: '' }); // git push

      const mockAiHelper = { initialize: jest.fn().mockResolvedValue(false) };
      const step = new Step12GitFinalization({
        executor: mockExecutor,
        backlogManager: mockBacklog,
        logger: mockLogger,
        aiHelper: mockAiHelper,
      });

      const result = await step.execute();

      // Step must still succeed — submodule commit failure is only a warning
      expect(result.success).toBe(true);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Could not commit changes inside one or more submodules')
      );
      // Parent git add -A must have been called
      const calls = mockExecutor.executeCommand.mock.calls.map((c) => c[0]);
      expect(calls).toContain('git add -A');
    });

    // When there are unstaged changes before pull --rebase (e.g. gitignored files
    // that weren't staged), stash must be called to allow the rebase to proceed.
    test('stashes and pops unstaged changes around git pull --rebase', async () => {
      mockExecutor.executeCommand = jest
        .fn()
        .mockResolvedValueOnce({ stdout: 'main' }) // current branch
        .mockResolvedValueOnce({ stdout: '1' }) // commits ahead
        .mockResolvedValueOnce({ stdout: '0' }) // commits behind
        .mockResolvedValueOnce({ stdout: 'M  src/lib/foo.js' }) // git status
        .mockRejectedValueOnce(new Error('no submodules')) // submodules
        .mockResolvedValueOnce({ stdout: '' }) // git rm --cached volatile workflow state
        .mockResolvedValueOnce({ stdout: '' }) // git add -A
        .mockResolvedValueOnce({ stdout: '' }) // git add -f .ai_workflow/.step_cache/
        .mockResolvedValueOnce({ stdout: '' }) // git commit
        .mockResolvedValueOnce({ stdout: '' }) // git tag v<current>
        .mockResolvedValueOnce({ stdout: '' }) // git push origin v<current>
        .mockResolvedValueOnce({ stdout: '' }) // git add -f .ai_workflow/ (pre-push stage)
        .mockResolvedValueOnce({ stdout: 'Saved working directory' }) // git stash — has changes
        .mockResolvedValueOnce({ stdout: '' }) // git pull --rebase
        .mockResolvedValueOnce({ stdout: '' }) // git stash pop
        .mockResolvedValueOnce({ stdout: '' }); // git push

      const mockAiHelper = { initialize: jest.fn().mockResolvedValue(false) };
      const step = new Step12GitFinalization({
        executor: mockExecutor,
        backlogManager: mockBacklog,
        logger: mockLogger,
        aiHelper: mockAiHelper,
      });

      const result = await step.execute();
      expect(result.success).toBe(true);
      const calls = mockExecutor.executeCommand.mock.calls.map((c) => c[0]);
      expect(calls.some((cmd) => cmd.includes('git stash'))).toBe(true);
      expect(calls.some((cmd) => cmd.includes('git stash pop'))).toBe(true);
      // stash must appear before pull, pop must appear after pull
      const stashIdx = calls.findIndex((cmd) => cmd === 'git stash --include-untracked');
      const pullIdx = calls.findIndex((cmd) => cmd.includes('git pull --rebase'));
      const popIdx = calls.findIndex((cmd) => cmd.includes('git stash pop'));
      expect(stashIdx).toBeLessThan(pullIdx);
      expect(popIdx).toBeGreaterThan(pullIdx);
    });

    test('tags current version and pushes tag after commit', async () => {
      mockExecutor.executeCommand = jest
        .fn()
        .mockResolvedValueOnce({ stdout: 'main' }) // current branch
        .mockResolvedValueOnce({ stdout: '0' }) // commits ahead
        .mockResolvedValueOnce({ stdout: '0' }) // commits behind
        .mockResolvedValueOnce({ stdout: 'M  src/lib/foo.js' }) // git status
        .mockRejectedValueOnce(new Error('no submodules')) // submodules
        .mockResolvedValueOnce({ stdout: '' }) // git rm --cached volatile workflow state
        .mockResolvedValueOnce({ stdout: '' }) // git add -A
        .mockResolvedValueOnce({ stdout: '' }) // git add -f .ai_workflow/.step_cache/
        .mockResolvedValueOnce({ stdout: '' }) // git commit
        .mockResolvedValueOnce({ stdout: '' }) // git tag v1.2.3
        .mockResolvedValueOnce({ stdout: '' }) // git push origin v1.2.3
        .mockResolvedValueOnce({ stdout: 'No local changes to save' }) // git stash
        .mockResolvedValueOnce({ stdout: '' }) // git pull --rebase
        .mockResolvedValueOnce({ stdout: '' }); // git push origin main

      const mockAiHelper = { initialize: jest.fn().mockResolvedValue(false) };
      const step = new Step12GitFinalization({
        executor: mockExecutor,
        backlogManager: mockBacklog,
        logger: mockLogger,
        aiHelper: mockAiHelper,
      });

      jest
        .spyOn(step, '_readProjectMeta')
        .mockResolvedValue({ version: '1.2.3', name: 'test', description: '' });

      const result = await step.execute();

      expect(result.success).toBe(true);
      const calls = mockExecutor.executeCommand.mock.calls.map((c) => c[0]);
      expect(calls.some((cmd) => cmd === 'git tag v1.2.3')).toBe(true);
      expect(calls.some((cmd) => cmd === 'git push origin v1.2.3')).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith('Tagged release: v1.2.3');
      expect(mockLogger.info).toHaveBeenCalledWith('Pushed tag v1.2.3 to remote');
    });

    test('skips tagging when no version is available', async () => {
      mockExecutor.executeCommand = jest
        .fn()
        .mockResolvedValueOnce({ stdout: 'main' }) // current branch
        .mockResolvedValueOnce({ stdout: '0' }) // commits ahead
        .mockResolvedValueOnce({ stdout: '0' }) // commits behind
        .mockResolvedValueOnce({ stdout: 'M  src/lib/foo.js' }) // git status
        .mockRejectedValueOnce(new Error('no submodules')) // submodules
        .mockResolvedValueOnce({ stdout: '' }) // git rm --cached volatile workflow state
        .mockResolvedValueOnce({ stdout: '' }) // git add -A
        .mockResolvedValueOnce({ stdout: '' }) // git add -f .ai_workflow/.step_cache/
        .mockResolvedValueOnce({ stdout: '' }) // git commit
        // no tag call expected
        .mockResolvedValueOnce({ stdout: 'No local changes to save' }) // git stash
        .mockResolvedValueOnce({ stdout: '' }) // git pull --rebase
        .mockResolvedValueOnce({ stdout: '' }); // git push origin main

      const mockAiHelper = { initialize: jest.fn().mockResolvedValue(false) };
      const step = new Step12GitFinalization({
        executor: mockExecutor,
        backlogManager: mockBacklog,
        logger: mockLogger,
        aiHelper: mockAiHelper,
      });

      jest
        .spyOn(step, '_readProjectMeta')
        .mockResolvedValue({ version: '', name: 'test', description: '' });

      const result = await step.execute();

      expect(result.success).toBe(true);
      const calls = mockExecutor.executeCommand.mock.calls.map((c) => c[0]);
      expect(calls.some((cmd) => cmd.startsWith('git tag'))).toBe(false);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Skipping git tag: no valid version found in package.json'
      );
    });

    test('skips tagging when tag already exists', async () => {
      mockExecutor.executeCommand = jest
        .fn()
        .mockResolvedValueOnce({ stdout: 'main' }) // current branch
        .mockResolvedValueOnce({ stdout: '0' }) // commits ahead
        .mockResolvedValueOnce({ stdout: '0' }) // commits behind
        .mockResolvedValueOnce({ stdout: 'M  src/lib/foo.js' }) // git status
        .mockRejectedValueOnce(new Error('no submodules')) // submodules
        .mockResolvedValueOnce({ stdout: '' }) // git rm --cached volatile workflow state
        .mockResolvedValueOnce({ stdout: '' }) // git add -A
        .mockResolvedValueOnce({ stdout: '' }) // git add -f .ai_workflow/.step_cache/
        .mockResolvedValueOnce({ stdout: '' }) // git commit
        .mockRejectedValueOnce(
          Object.assign(new Error('tag already exists'), {
            stderr: 'fatal: tag already exists',
          })
        ) // git tag v1.2.3 — already exists
        .mockResolvedValueOnce({ stdout: 'No local changes to save' }) // git stash
        .mockResolvedValueOnce({ stdout: '' }) // git pull --rebase
        .mockResolvedValueOnce({ stdout: '' }); // git push origin main

      const mockAiHelper = { initialize: jest.fn().mockResolvedValue(false) };
      const step = new Step12GitFinalization({
        executor: mockExecutor,
        backlogManager: mockBacklog,
        logger: mockLogger,
        aiHelper: mockAiHelper,
      });

      jest
        .spyOn(step, '_readProjectMeta')
        .mockResolvedValue({ version: '1.2.3', name: 'test', description: '' });

      const result = await step.execute();

      expect(result.success).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith('Tag v1.2.3 already exists — skipping');
    });
  });

  // ==========================================================================
  // BUG FIX TESTS
  // Fix 1 (920796e): scope git add -f to .step_cache/ and untrack volatile state
  // Fix 2 (774e26c): remove --no-verify to enforce quality gates
  // ==========================================================================

  describe('[BUG FIX 920796e] scoped staging: keep .step_cache/ only and untrack volatile state', () => {
    let mockExecutor;
    let mockBacklog;
    let mockLogger;

    beforeEach(() => {
      mockExecutor = { executeCommand: jest.fn() };
      mockBacklog = { saveStepSummary: jest.fn(), saveStepIssues: jest.fn() };
      mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), step: jest.fn() };
    });

    // ── Unit: exact force-add targets ────────────────────────────────────────

    test('[unit] force-adds only .ai_workflow/.step_cache/', async () => {
      mockExecutor.executeCommand = jest
        .fn()
        .mockResolvedValueOnce({ stdout: 'main' }) // branch
        .mockResolvedValueOnce({ stdout: '0' }) // ahead
        .mockResolvedValueOnce({ stdout: '0' }) // behind
        .mockResolvedValueOnce({ stdout: 'M src/foo.js' }) // status
        .mockRejectedValueOnce(new Error('no submodules')) // submodules
        .mockResolvedValueOnce({ stdout: '' }) // git rm --cached volatile workflow state
        .mockResolvedValueOnce({ stdout: '' }) // git add -A
        .mockResolvedValueOnce({ stdout: '' }) // git add -f .step_cache/
        .mockResolvedValueOnce({ stdout: '' }) // git commit
        .mockResolvedValueOnce({ stdout: 'No local changes to save' }) // stash
        .mockResolvedValueOnce({ stdout: '' }) // pull
        .mockResolvedValueOnce({ stdout: '' }); // push

      const step = new Step12GitFinalization({
        executor: mockExecutor,
        backlogManager: mockBacklog,
        logger: mockLogger,
        aiHelper: { initialize: jest.fn().mockResolvedValue(false) },
      });
      await step.execute();

      const calls = mockExecutor.executeCommand.mock.calls.map((c) => c[0]);
      const forceAdds = calls.filter((cmd) => cmd.includes('git add -f'));
      const untrackCommand = calls.find((cmd) =>
        cmd.includes('git rm --cached -r --ignore-unmatch')
      );

      expect(forceAdds).toHaveLength(1);
      expect(forceAdds[0]).toBe('git add -f .ai_workflow/.step_cache/');
      expect(untrackCommand).toContain('.ai_workflow/.ai_cache');
      expect(untrackCommand).toContain('.ai_workflow/commit_history.json');
      expect(untrackCommand).toContain('.ai_workflow/.ml_model.json');
    });

    test('[unit] does NOT force-add the broad .ai_workflow/ directory', async () => {
      mockExecutor.executeCommand = jest
        .fn()
        .mockResolvedValueOnce({ stdout: 'main' })
        .mockResolvedValueOnce({ stdout: '0' })
        .mockResolvedValueOnce({ stdout: '0' })
        .mockResolvedValueOnce({ stdout: 'M src/foo.js' })
        .mockRejectedValueOnce(new Error('no submodules'))
        .mockResolvedValueOnce({ stdout: '' }) // git rm --cached volatile workflow state
        .mockResolvedValueOnce({ stdout: '' }) // git add -A
        .mockResolvedValueOnce({ stdout: '' }) // git add -f .step_cache/
        .mockResolvedValueOnce({ stdout: '' }) // git commit
        .mockResolvedValueOnce({ stdout: 'No local changes to save' })
        .mockResolvedValueOnce({ stdout: '' })
        .mockResolvedValueOnce({ stdout: '' });

      const step = new Step12GitFinalization({
        executor: mockExecutor,
        backlogManager: mockBacklog,
        logger: mockLogger,
        aiHelper: { initialize: jest.fn().mockResolvedValue(false) },
      });
      await step.execute();

      const calls = mockExecutor.executeCommand.mock.calls.map((c) => c[0]);
      const broadForceAdd = calls.find((cmd) => /git add -f \.ai_workflow\/$/.test(cmd));
      expect(broadForceAdd).toBeUndefined();
    });

    test('[unit] does NOT force-add logs/, checkpoints/, or other subdirectories', async () => {
      mockExecutor.executeCommand = jest
        .fn()
        .mockResolvedValueOnce({ stdout: 'main' })
        .mockResolvedValueOnce({ stdout: '0' })
        .mockResolvedValueOnce({ stdout: '0' })
        .mockResolvedValueOnce({ stdout: 'M src/foo.js' })
        .mockRejectedValueOnce(new Error('no submodules'))
        .mockResolvedValueOnce({ stdout: '' }) // git rm --cached volatile workflow state
        .mockResolvedValueOnce({ stdout: '' })
        .mockResolvedValueOnce({ stdout: '' })
        .mockResolvedValueOnce({ stdout: '' })
        .mockResolvedValueOnce({ stdout: 'No local changes to save' })
        .mockResolvedValueOnce({ stdout: '' })
        .mockResolvedValueOnce({ stdout: '' });

      const step = new Step12GitFinalization({
        executor: mockExecutor,
        backlogManager: mockBacklog,
        logger: mockLogger,
        aiHelper: { initialize: jest.fn().mockResolvedValue(false) },
      });
      await step.execute();

      const calls = mockExecutor.executeCommand.mock.calls.map((c) => c[0]);
      const forbiddenForceAdds = calls.filter(
        (cmd) =>
          cmd.includes('git add -f') &&
          (cmd.includes('logs/') ||
            cmd.includes('checkpoints/') ||
            cmd.includes('summaries/') ||
            cmd.includes('metrics/'))
      );
      expect(forbiddenForceAdds).toHaveLength(0);
    });

    // ── Integration: partial failure of force-add targets ────────────────────

    test('[integration] continues when .step_cache/ does not exist (force-add throws)', async () => {
      mockExecutor.executeCommand = jest
        .fn()
        .mockResolvedValueOnce({ stdout: 'main' })
        .mockResolvedValueOnce({ stdout: '0' })
        .mockResolvedValueOnce({ stdout: '0' })
        .mockResolvedValueOnce({ stdout: 'M src/foo.js' })
        .mockRejectedValueOnce(new Error('no submodules'))
        .mockResolvedValueOnce({ stdout: '' }) // git rm --cached volatile workflow state
        .mockResolvedValueOnce({ stdout: '' }) // git add -A
        .mockRejectedValueOnce(new Error('pathspec .ai_workflow/.step_cache/ did not match')) // .step_cache/ missing
        .mockResolvedValueOnce({ stdout: '' }) // git commit
        .mockResolvedValueOnce({ stdout: 'No local changes to save' })
        .mockResolvedValueOnce({ stdout: '' })
        .mockResolvedValueOnce({ stdout: '' });

      const step = new Step12GitFinalization({
        executor: mockExecutor,
        backlogManager: mockBacklog,
        logger: mockLogger,
        aiHelper: { initialize: jest.fn().mockResolvedValue(false) },
      });

      const result = await step.execute();

      expect(result.success).toBe(true);
      const calls = mockExecutor.executeCommand.mock.calls.map((c) => c[0]);
      expect(calls.some((cmd) => cmd.includes('git rm --cached -r --ignore-unmatch'))).toBe(true);
    });

    test('[integration] untracks volatile workflow state before staging project files', async () => {
      mockExecutor.executeCommand = jest
        .fn()
        .mockResolvedValueOnce({ stdout: 'main' })
        .mockResolvedValueOnce({ stdout: '0' })
        .mockResolvedValueOnce({ stdout: '0' })
        .mockResolvedValueOnce({ stdout: 'M src/foo.js' })
        .mockRejectedValueOnce(new Error('no submodules'))
        .mockResolvedValueOnce({ stdout: '' }) // git rm --cached volatile workflow state
        .mockResolvedValueOnce({ stdout: '' }) // git add -A
        .mockResolvedValueOnce({ stdout: '' }) // .step_cache/ succeeds
        .mockResolvedValueOnce({ stdout: '' }) // git commit
        .mockResolvedValueOnce({ stdout: 'No local changes to save' })
        .mockResolvedValueOnce({ stdout: '' })
        .mockResolvedValueOnce({ stdout: '' });

      const step = new Step12GitFinalization({
        executor: mockExecutor,
        backlogManager: mockBacklog,
        logger: mockLogger,
        aiHelper: { initialize: jest.fn().mockResolvedValue(false) },
      });

      const result = await step.execute();

      expect(result.success).toBe(true);
      const calls = mockExecutor.executeCommand.mock.calls.map((c) => c[0]);
      const untrackIndex = calls.findIndex((cmd) =>
        cmd.includes('git rm --cached -r --ignore-unmatch')
      );
      const addIndex = calls.findIndex((cmd) => cmd === 'git add -A');
      expect(untrackIndex).toBeGreaterThanOrEqual(0);
      expect(untrackIndex).toBeLessThan(addIndex);
    });

    test('[integration] succeeds when .step_cache/ is absent', async () => {
      mockExecutor.executeCommand = jest
        .fn()
        .mockResolvedValueOnce({ stdout: 'main' })
        .mockResolvedValueOnce({ stdout: '0' })
        .mockResolvedValueOnce({ stdout: '0' })
        .mockResolvedValueOnce({ stdout: 'M src/foo.js' })
        .mockRejectedValueOnce(new Error('no submodules'))
        .mockResolvedValueOnce({ stdout: '' }) // git rm --cached volatile workflow state
        .mockResolvedValueOnce({ stdout: '' }) // git add -A
        .mockRejectedValueOnce(new Error('pathspec did not match')) // .step_cache/ missing
        .mockResolvedValueOnce({ stdout: '' }) // git commit still runs
        .mockResolvedValueOnce({ stdout: 'No local changes to save' })
        .mockResolvedValueOnce({ stdout: '' })
        .mockResolvedValueOnce({ stdout: '' });

      const step = new Step12GitFinalization({
        executor: mockExecutor,
        backlogManager: mockBacklog,
        logger: mockLogger,
        aiHelper: { initialize: jest.fn().mockResolvedValue(false) },
      });

      const result = await step.execute();

      expect(result.success).toBe(true);
      const calls = mockExecutor.executeCommand.mock.calls.map((c) => c[0]);
      expect(calls.some((cmd) => cmd.includes('git commit'))).toBe(true);
    });

    // ── Functional: regression guard against broad force-add ─────────────────

    test('[functional] never issues git add -f with a path covering logs/', async () => {
      // This test is the regression guard: if .ai_workflow/ ever re-appears as
      // a broad force-add target it would capture logs/ (gitignored), which
      // must never happen.
      const seenForceAdds = [];
      mockExecutor.executeCommand = jest.fn().mockImplementation((cmd) => {
        if (cmd.includes('git add -f')) seenForceAdds.push(cmd);
        return Promise.resolve({ stdout: '' });
      });

      const step = new Step12GitFinalization({
        executor: mockExecutor,
        backlogManager: mockBacklog,
        logger: mockLogger,
        aiHelper: { initialize: jest.fn().mockResolvedValue(false) },
      });

      // inject a minimal git state to reach _stageChanges
      mockExecutor.executeCommand = jest.fn().mockImplementation((cmd) => {
        if (cmd.includes('git add -f')) seenForceAdds.push(cmd);
        if (cmd.includes('rev-parse') || cmd.includes('branch'))
          return Promise.resolve({ stdout: 'main' });
        if (cmd.includes('rev-list') && cmd.includes('HEAD..'))
          return Promise.resolve({ stdout: '0' });
        if (cmd.includes('rev-list') && cmd.includes('..HEAD'))
          return Promise.resolve({ stdout: '0' });
        if (cmd.includes('status')) {
          const statusOutput = seenForceAdds.length === 0 ? 'M src/foo.js' : '';
          return Promise.resolve({ stdout: statusOutput });
        }
        if (cmd.includes('submodule')) return Promise.reject(new Error('no submodules'));
        return Promise.resolve({ stdout: '' });
      });

      await step.execute();

      const logsViolation = seenForceAdds.find(
        (cmd) =>
          // broad .ai_workflow/ would match .ai_workflow/logs/ among others
          /git add -f \.ai_workflow\/$/.test(cmd) || /git add -f \.ai_workflow\/logs/.test(cmd)
      );
      expect(logsViolation).toBeUndefined();
    });
  });

  describe('[BUG FIX 774e26c] git commit must not use --no-verify', () => {
    let mockExecutor;
    let mockBacklog;
    let mockLogger;

    beforeEach(() => {
      mockExecutor = { executeCommand: jest.fn() };
      mockBacklog = { saveStepSummary: jest.fn(), saveStepIssues: jest.fn() };
      mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), step: jest.fn() };
    });

    // ── Unit: commit command format ───────────────────────────────────────────

    test('[unit] commit command uses -F <tmpfile> without --no-verify', async () => {
      mockExecutor.executeCommand = jest
        .fn()
        .mockResolvedValueOnce({ stdout: 'main' })
        .mockResolvedValueOnce({ stdout: '0' })
        .mockResolvedValueOnce({ stdout: '0' })
        .mockResolvedValueOnce({ stdout: 'M src/foo.js' })
        .mockRejectedValueOnce(new Error('no submodules'))
        .mockResolvedValueOnce({ stdout: '' }) // git rm --cached volatile workflow state
        .mockResolvedValueOnce({ stdout: '' }) // git add -A
        .mockResolvedValueOnce({ stdout: '' }) // force-add .step_cache/
        .mockResolvedValueOnce({ stdout: '' }) // git commit
        .mockResolvedValueOnce({ stdout: 'No local changes to save' })
        .mockResolvedValueOnce({ stdout: '' })
        .mockResolvedValueOnce({ stdout: '' });

      const step = new Step12GitFinalization({
        executor: mockExecutor,
        backlogManager: mockBacklog,
        logger: mockLogger,
        aiHelper: { initialize: jest.fn().mockResolvedValue(false) },
      });

      await step.execute();

      const calls = mockExecutor.executeCommand.mock.calls.map((c) => c[0]);
      const commitCmd = calls.find((cmd) => /^git commit/.test(cmd));
      expect(commitCmd).toBeDefined();
      expect(commitCmd).toContain('-F ');
      expect(commitCmd).not.toContain('--no-verify');
    });

    // ── Integration: pre-commit hook failure propagates ───────────────────────

    test('[integration] pre-commit hook failure is NOT swallowed (propagates as thrown error)', async () => {
      const hookError = Object.assign(new Error('Command failed: git commit -F ...'), {
        stderr: 'pre-commit hook failed with exit code 1',
        exitCode: 1,
      });

      mockExecutor.executeCommand = jest
        .fn()
        .mockResolvedValueOnce({ stdout: 'main' })
        .mockResolvedValueOnce({ stdout: '0' })
        .mockResolvedValueOnce({ stdout: '0' })
        .mockResolvedValueOnce({ stdout: 'M src/foo.js' })
        .mockRejectedValueOnce(new Error('no submodules'))
        .mockResolvedValueOnce({ stdout: '' }) // git rm --cached volatile workflow state
        .mockResolvedValueOnce({ stdout: '' }) // git add -A
        .mockResolvedValueOnce({ stdout: '' }) // force-add .step_cache/
        .mockRejectedValueOnce(hookError); // pre-commit hook blocks commit

      const step = new Step12GitFinalization({
        executor: mockExecutor,
        backlogManager: mockBacklog,
        logger: mockLogger,
        aiHelper: { initialize: jest.fn().mockResolvedValue(false) },
      });

      // execute() re-throws non-"nothing to commit" errors — the step fails
      await expect(step.execute()).rejects.toThrow('pre-commit hook failed');
    });

    test('[integration] "nothing to commit" error is still treated as success', async () => {
      // Regression: "nothing to commit" must remain a soft success even when
      // pre-commit hooks are not bypassed.
      const nothingToCommit = Object.assign(new Error('Command failed: git commit -F ...'), {
        stderr: 'nothing to commit, working tree clean',
        exitCode: 1,
      });

      mockExecutor.executeCommand = jest
        .fn()
        .mockResolvedValueOnce({ stdout: 'main' })
        .mockResolvedValueOnce({ stdout: '0' })
        .mockResolvedValueOnce({ stdout: '0' })
        .mockResolvedValueOnce({ stdout: 'M src/foo.js' })
        .mockRejectedValueOnce(new Error('no submodules'))
        .mockResolvedValueOnce({ stdout: '' })
        .mockResolvedValueOnce({ stdout: '' })
        .mockResolvedValueOnce({ stdout: '' })
        .mockRejectedValueOnce(nothingToCommit);

      const step = new Step12GitFinalization({
        executor: mockExecutor,
        backlogManager: mockBacklog,
        logger: mockLogger,
        aiHelper: { initialize: jest.fn().mockResolvedValue(false) },
      });

      const result = await step.execute();
      expect(result.success).toBe(true);
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    test('[integration] "nothing added to commit" variant is treated as success', async () => {
      const nothingAdded = Object.assign(new Error('Command failed: git commit -F ...'), {
        stderr: 'nothing added to commit but untracked files present',
        exitCode: 1,
      });

      mockExecutor.executeCommand = jest
        .fn()
        .mockResolvedValueOnce({ stdout: 'main' })
        .mockResolvedValueOnce({ stdout: '0' })
        .mockResolvedValueOnce({ stdout: '0' })
        .mockResolvedValueOnce({ stdout: 'M src/foo.js' })
        .mockRejectedValueOnce(new Error('no submodules'))
        .mockResolvedValueOnce({ stdout: '' })
        .mockResolvedValueOnce({ stdout: '' })
        .mockResolvedValueOnce({ stdout: '' })
        .mockRejectedValueOnce(nothingAdded);

      const step = new Step12GitFinalization({
        executor: mockExecutor,
        backlogManager: mockBacklog,
        logger: mockLogger,
        aiHelper: { initialize: jest.fn().mockResolvedValue(false) },
      });

      const result = await step.execute();
      expect(result.success).toBe(true);
    });

    test('[integration] rethrown commit errors carry stderr detail in the message', async () => {
      const rootCause = Object.assign(new Error('Command failed: git commit -F ...'), {
        stderr: 'fatal: unable to write new index file',
        exitCode: 128,
      });

      mockExecutor.executeCommand = jest
        .fn()
        .mockResolvedValueOnce({ stdout: 'main' })
        .mockResolvedValueOnce({ stdout: '0' })
        .mockResolvedValueOnce({ stdout: '0' })
        .mockResolvedValueOnce({ stdout: 'M src/foo.js' })
        .mockRejectedValueOnce(new Error('no submodules'))
        .mockResolvedValueOnce({ stdout: '' })
        .mockResolvedValueOnce({ stdout: '' })
        .mockResolvedValueOnce({ stdout: '' })
        .mockRejectedValueOnce(rootCause);

      const step = new Step12GitFinalization({
        executor: mockExecutor,
        backlogManager: mockBacklog,
        logger: mockLogger,
        aiHelper: { initialize: jest.fn().mockResolvedValue(false) },
      });

      // The rethrown error must include the stderr detail so the root cause
      // is visible in logs. execute() propagates it further.
      await expect(step.execute()).rejects.toThrow('unable to write new index file');
    });

    // ── Functional: quality gate enforcement contract ─────────────────────────

    test('[functional] ALL git commit calls in a full workflow run omit --no-verify', async () => {
      // Collect every git commit invocation across a complete execute() cycle
      // and assert none use --no-verify.
      const commitCalls = [];
      mockExecutor.executeCommand = jest.fn().mockImplementation((cmd) => {
        if (/^git commit/.test(cmd)) commitCalls.push(cmd);
        if (cmd.includes('submodule') && !cmd.includes('foreach') && !cmd.includes('update')) {
          return Promise.reject(new Error('no submodules'));
        }
        if (cmd.includes('status')) {
          const statusOutput = commitCalls.length === 0 ? 'M src/foo.js' : '';
          return Promise.resolve({ stdout: statusOutput });
        }
        return Promise.resolve({ stdout: '' });
      });

      const step = new Step12GitFinalization({
        executor: mockExecutor,
        backlogManager: mockBacklog,
        logger: mockLogger,
        aiHelper: { initialize: jest.fn().mockResolvedValue(false) },
      });

      await step.execute();

      expect(commitCalls.length).toBeGreaterThan(0);
      commitCalls.forEach((cmd) => {
        expect(cmd).not.toContain('--no-verify');
      });
    });
  });

  // ==========================================================================
  // PURE FUNCTIONS - Tagging
  // ==========================================================================

  describe('shouldCreateTag', () => {
    test('returns true for valid semver', () => {
      expect(shouldCreateTag('1.2.3')).toBe(true);
    });
    test('returns true for semver with pre-release', () => {
      expect(shouldCreateTag('1.0.0-beta.1')).toBe(true);
    });
    test('returns false for empty string', () => {
      expect(shouldCreateTag('')).toBe(false);
    });
    test('returns false for null', () => {
      expect(shouldCreateTag(null)).toBe(false);
    });
    test('returns false for non-semver string', () => {
      expect(shouldCreateTag('not-a-version')).toBe(false);
    });
  });

  describe('buildTagCommand', () => {
    test('builds tag command with v prefix', () => {
      expect(buildTagCommand('1.2.3')).toBe('git tag v1.2.3');
    });
    test('trims whitespace from version', () => {
      expect(buildTagCommand('  2.0.0  ')).toBe('git tag v2.0.0');
    });
  });
});
