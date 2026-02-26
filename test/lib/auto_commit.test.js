/**
 * @fileoverview Tests for Auto Commit Module
 * Tests both pure functions and AutoCommit class
 */

import {
  generateCommitMessage,
  categorizeArtifacts,
  shouldAutoCommit,
  buildCommitScope,
  formatCommitBody,
  calculateCommitPriority,
  validateArtifactPath,
  mergeCommitOptions,
  extractCommitMetadata,
  shouldSkipCI,
  AutoCommit,
} from '../../src/lib/auto_commit.js';

// ============================================================================
// PURE FUNCTION TESTS
// ============================================================================

describe('auto_commit - Pure Functions', () => {
  describe('generateCommitMessage', () => {
    test('generates message for docs', () => {
      const categories = { docs: ['README.md'], metrics: [], logs: [] };
      const result = generateCommitMessage(categories);
      expect(result).toContain('docs(docs)');
      expect(result).toContain('[skip ci]');
    });

    test('generates message for metrics', () => {
      const categories = { docs: [], metrics: ['m.json'], logs: [] };
      const result = generateCommitMessage(categories);
      expect(result).toContain('chore(metrics)');
      expect(result).toContain('metrics');
    });

    test('generates message for mixed artifacts', () => {
      const categories = { docs: ['a.md'], metrics: ['b.json'], logs: [] };
      const result = generateCommitMessage(categories);
      expect(result).toContain('chore(workflow)');
      expect(result).toContain('docs and metrics');
    });

    test('handles empty categories', () => {
      const result = generateCommitMessage({});
      expect(result).toContain('update artifacts');
    });

    test('handles null input', () => {
      const result = generateCommitMessage(null);
      expect(result).toContain('update artifacts');
    });
  });

  describe('categorizeArtifacts', () => {
    test('categorizes metrics files', () => {
      const files = ['.ai_workflow/metrics/step1.json'];
      const result = categorizeArtifacts(files);
      expect(result.metrics).toEqual(files);
    });

    test('categorizes log files', () => {
      const files = ['.ai_workflow/logs/workflow.log'];
      const result = categorizeArtifacts(files);
      expect(result.logs).toEqual(files);
    });

    test('categorizes summary files', () => {
      const files = ['.ai_workflow/summaries/step1.md'];
      const result = categorizeArtifacts(files);
      expect(result.summaries).toEqual(files);
    });

    test('categorizes documentation files', () => {
      const files = ['docs/api.md', 'README.md'];
      const result = categorizeArtifacts(files);
      expect(result.docs).toEqual(files);
    });

    test('categorizes test files', () => {
      const files = ['test/app.test.js'];
      const result = categorizeArtifacts(files);
      expect(result.tests).toEqual(files);
    });

    test('categorizes mixed files', () => {
      const files = ['.ai_workflow/metrics/m.json', 'docs/api.md', '.ai_workflow/logs/log.txt'];
      const result = categorizeArtifacts(files);
      expect(result.metrics).toHaveLength(1);
      expect(result.docs).toHaveLength(1);
      expect(result.logs).toHaveLength(1);
    });

    test('handles empty array', () => {
      const result = categorizeArtifacts([]);
      expect(result.docs).toEqual([]);
    });

    test('handles null input', () => {
      const result = categorizeArtifacts(null);
      expect(result.docs).toEqual([]);
    });
  });

  describe('shouldAutoCommit', () => {
    test('allows workflow artifacts', () => {
      expect(shouldAutoCommit('.ai_workflow/metrics/m.json')).toBe(true);
      expect(shouldAutoCommit('docs/api.md')).toBe(true);
    });

    test('rejects non-artifacts', () => {
      expect(shouldAutoCommit('src/app.js')).toBe(false);
      expect(shouldAutoCommit('package.json')).toBe(false);
    });

    test('respects enabled flag', () => {
      const config = { enabled: false };
      expect(shouldAutoCommit('.ai_workflow/metrics/m.json', config)).toBe(false);
    });

    test('respects exclude patterns', () => {
      const config = { exclude: ['logs'] };
      expect(shouldAutoCommit('.ai_workflow/logs/log.txt', config)).toBe(false);
    });

    test('respects include patterns', () => {
      const config = { include: ['metrics'] };
      expect(shouldAutoCommit('.ai_workflow/metrics/m.json', config)).toBe(true);
      expect(shouldAutoCommit('.ai_workflow/logs/log.txt', config)).toBe(false);
    });

    test('handles null input', () => {
      expect(shouldAutoCommit(null)).toBe(false);
    });
  });

  describe('buildCommitScope', () => {
    test('returns docs for docs-only', () => {
      const categories = { docs: ['a.md'], metrics: [], tests: [] };
      expect(buildCommitScope(categories)).toBe('docs');
    });

    test('returns tests for tests-only', () => {
      const categories = { docs: [], metrics: [], tests: ['a.test.js'] };
      expect(buildCommitScope(categories)).toBe('tests');
    });

    test('returns metrics for metrics-only', () => {
      const categories = { docs: [], metrics: ['a.json'], tests: [] };
      expect(buildCommitScope(categories)).toBe('metrics');
    });

    test('returns workflow for mixed', () => {
      const categories = { docs: ['a.md'], metrics: ['b.json'], tests: [] };
      expect(buildCommitScope(categories)).toBe('workflow');
    });

    test('handles null input', () => {
      expect(buildCommitScope(null)).toBe('workflow');
    });
  });

  describe('formatCommitBody', () => {
    test('formats commit body with files', () => {
      const details = { files: ['a.json', 'b.md'], step: 5 };
      const result = formatCommitBody(details);
      expect(result).toContain('Files updated:');
      expect(result).toContain('- a.json');
      expect(result).toContain('Step: 5');
    });

    test('limits file list to 10', () => {
      const files = Array.from({ length: 15 }, (_, i) => `file${i}.json`);
      const result = formatCommitBody({ files });
      expect(result).toContain('and 5 more');
    });

    test('includes metadata footer', () => {
      const details = { files: ['a.json'], step: 3, timestamp: '2026-01-01' };
      const result = formatCommitBody(details);
      expect(result).toContain('Auto-committed by ai_workflow.js');
      expect(result).toContain('Step: 3');
      expect(result).toContain('Timestamp: 2026-01-01');
    });

    test('handles null input', () => {
      const result = formatCommitBody(null);
      expect(result).toBe('');
    });
  });

  describe('calculateCommitPriority', () => {
    test('returns high for test files', () => {
      const files = ['test-results.json', 'coverage.json'];
      expect(calculateCommitPriority(files)).toBe('high');
    });

    test('returns medium for metrics', () => {
      const files = ['.ai_workflow/metrics/m.json'];
      expect(calculateCommitPriority(files)).toBe('medium');
    });

    test('returns low for docs', () => {
      const files = ['docs/api.md'];
      expect(calculateCommitPriority(files)).toBe('low');
    });

    test('returns low for empty', () => {
      expect(calculateCommitPriority([])).toBe('low');
    });

    test('handles null input', () => {
      expect(calculateCommitPriority(null)).toBe('low');
    });
  });

  describe('validateArtifactPath', () => {
    test('validates workflow artifacts', () => {
      expect(validateArtifactPath('.ai_workflow/metrics/m.json')).toBe(true);
      expect(validateArtifactPath('docs/api.md')).toBe(true);
      expect(validateArtifactPath('coverage/index.html')).toBe(true);
    });

    test('rejects non-artifacts', () => {
      expect(validateArtifactPath('src/app.js')).toBe(false);
      expect(validateArtifactPath('package.json')).toBe(false);
    });

    test('handles null input', () => {
      expect(validateArtifactPath(null)).toBe(false);
    });
  });

  describe('mergeCommitOptions', () => {
    test('merges user options with defaults', () => {
      const user = { message: 'custom' };
      const defaults = { message: 'default', skipCI: true };
      const result = mergeCommitOptions(user, defaults);
      expect(result.message).toBe('custom');
      expect(result.skipCI).toBe(true);
    });

    test('handles null user options', () => {
      const defaults = { message: 'default' };
      const result = mergeCommitOptions(null, defaults);
      expect(result.message).toBe('default');
    });

    test('merges exclude/include arrays', () => {
      const user = { exclude: ['logs'] };
      const defaults = { exclude: ['temp'] };
      const result = mergeCommitOptions(user, defaults);
      expect(result.exclude).toEqual(['logs']);
    });
  });

  describe('extractCommitMetadata', () => {
    test('extracts step number from filename', () => {
      const files = ['.ai_workflow/metrics/step5.json'];
      const result = extractCommitMetadata(files);
      expect(result.stepNumber).toBe(5);
      expect(result.fileCount).toBe(1);
    });

    test('extracts from various formats', () => {
      expect(extractCommitMetadata(['step_3.json']).stepNumber).toBe(3);
      expect(extractCommitMetadata(['step-7.json']).stepNumber).toBe(7);
    });

    test('handles no step number', () => {
      const result = extractCommitMetadata(['metrics.json']);
      expect(result.stepNumber).toBeNull();
    });

    test('includes timestamp', () => {
      const result = extractCommitMetadata(['file.json']);
      expect(result.timestamp).toBeTruthy();
      expect(typeof result.timestamp).toBe('string');
    });

    test('handles null input', () => {
      const result = extractCommitMetadata(null);
      expect(result.stepNumber).toBeNull();
      expect(result.fileCount).toBe(0);
    });
  });

  describe('shouldSkipCI', () => {
    test('returns true for docs/metrics only', () => {
      const categories = { docs: ['a.md'], metrics: ['b.json'] };
      expect(shouldSkipCI(categories)).toBe(true);
    });

    test('returns false for test files', () => {
      const categories = { tests: ['a.test.js'], docs: [] };
      expect(shouldSkipCI(categories)).toBe(false);
    });

    test('returns false for code files', () => {
      const categories = { code: ['src/app.js'], docs: [] };
      expect(shouldSkipCI(categories)).toBe(false);
    });

    test('handles null input', () => {
      expect(shouldSkipCI(null)).toBe(true);
    });
  });
});

// ============================================================================
// AUTO COMMIT CLASS TESTS
// ============================================================================

describe('auto_commit - AutoCommit Class', () => {
  describe('constructor', () => {
    test('creates instance with defaults', () => {
      const autoCommit = new AutoCommit();
      expect(autoCommit.enabled).toBe(true);
      expect(autoCommit.dryRun).toBe(false);
      expect(autoCommit.commitHistory).toEqual([]);
    });

    test('creates instance with custom options', () => {
      const mockGit = { commit: async () => {} };
      const autoCommit = new AutoCommit({
        gitAutomation: mockGit,
        enabled: false,
        dryRun: true,
      });
      expect(autoCommit.gitAutomation).toBe(mockGit);
      expect(autoCommit.enabled).toBe(false);
      expect(autoCommit.dryRun).toBe(true);
    });
  });

  describe('commitArtifacts', () => {
    test('commits valid artifacts', async () => {
      const mockGit = {
        add: async () => {},
        commit: async () => {},
      };

      const autoCommit = new AutoCommit({ gitAutomation: mockGit });
      const files = ['.ai_workflow/metrics/m.json'];

      const result = await autoCommit.commitArtifacts(files);
      expect(result.committed).toBe(true);
      expect(result.files).toEqual(files);
    });

    test('returns disabled when disabled', async () => {
      const autoCommit = new AutoCommit({ enabled: false });
      const result = await autoCommit.commitArtifacts([]);
      expect(result.committed).toBe(false);
      expect(result.reason).toBe('disabled');
    });

    test('returns no_git when no GitAutomation', async () => {
      const autoCommit = new AutoCommit();
      const result = await autoCommit.commitArtifacts([]);
      expect(result.committed).toBe(false);
      expect(result.reason).toBe('no_git');
    });

    test('returns no_files for empty array', async () => {
      const mockGit = { add: async () => {}, commit: async () => {} };
      const autoCommit = new AutoCommit({ gitAutomation: mockGit });
      const result = await autoCommit.commitArtifacts([]);
      expect(result.committed).toBe(false);
      expect(result.reason).toBe('no_files');
    });

    test('filters non-artifact files', async () => {
      const mockGit = { add: async () => {}, commit: async () => {} };
      const autoCommit = new AutoCommit({ gitAutomation: mockGit });
      const files = ['src/app.js', 'package.json'];
      const result = await autoCommit.commitArtifacts(files);
      expect(result.committed).toBe(false);
      expect(result.reason).toBe('filtered');
    });

    test('respects dry run mode', async () => {
      const mockGit = { add: async () => {}, commit: async () => {} };
      const autoCommit = new AutoCommit({
        gitAutomation: mockGit,
        dryRun: true,
      });
      const files = ['.ai_workflow/metrics/m.json'];
      const result = await autoCommit.commitArtifacts(files);
      expect(result.committed).toBe(false);
      expect(result.reason).toBe('dry_run');
    });

    test('passes all files as a single array to git.add, not one-by-one', async () => {
      // GitAutomation.add() requires an array. Previously commitArtifacts called
      // add(file) per-file (string), which threw "Files array is required".
      const addCalls = [];
      const mockGit = {
        add: async (arg) => {
          addCalls.push(arg);
        },
        commit: async () => {},
      };
      const files = ['.ai_workflow/metrics/a.json', '.ai_workflow/logs/b.txt'];
      const autoCommit = new AutoCommit({ gitAutomation: mockGit });
      const result = await autoCommit.commitArtifacts(files);
      expect(result.committed).toBe(true);
      // add() must have been called exactly once with the full array
      expect(addCalls).toHaveLength(1);
      expect(Array.isArray(addCalls[0])).toBe(true);
      expect(addCalls[0]).toEqual(expect.arrayContaining(files));
    });

    test('uses force:true when staging so .gitignored artifacts are included', async () => {
      // Artifact dirs like .ai_workflow/.ai_cache may be in .gitignore.
      // commitArtifacts must pass { force: true } to git.add so ignored
      // files are staged without error.
      const addOptions = [];
      const mockGit = {
        add: async (_files, opts) => {
          addOptions.push(opts);
        },
        commit: async () => {},
      };
      const files = ['.ai_workflow/.ai_cache/index.json'];
      const autoCommit = new AutoCommit({ gitAutomation: mockGit });
      await autoCommit.commitArtifacts(files);
      expect(addOptions[0]).toEqual(expect.objectContaining({ force: true }));
    });

    test('handles commit errors', async () => {
      const mockGit = {
        add: async () => {
          throw new Error('Git error');
        },
        commit: async () => {},
      };
      const autoCommit = new AutoCommit({ gitAutomation: mockGit });
      const files = ['.ai_workflow/metrics/m.json'];
      const result = await autoCommit.commitArtifacts(files);
      expect(result.committed).toBe(false);
      expect(result.reason).toBe('error');
    });

    test('tracks commit in history', async () => {
      const mockGit = {
        add: async () => {},
        commit: async () => {},
      };
      const autoCommit = new AutoCommit({ gitAutomation: mockGit });
      const files = ['.ai_workflow/metrics/m.json'];
      await autoCommit.commitArtifacts(files);

      expect(autoCommit.commitHistory).toHaveLength(1);
      expect(autoCommit.commitHistory[0].files).toEqual(files);
    });
  });

  describe('commitDocs', () => {
    test('commits documentation files', async () => {
      const mockGit = {
        status: async () => ({
          staged: [{ file: 'docs/api.md' }],
          unstaged: [{ file: 'docs/guide.md' }],
        }),
        add: async () => {},
        commit: async () => {},
      };
      const autoCommit = new AutoCommit({ gitAutomation: mockGit });
      const result = await autoCommit.commitDocs();
      expect(result.committed).toBe(true);
      expect(result.files).toContain('docs/api.md');
    });

    test('handles no git', async () => {
      const autoCommit = new AutoCommit();
      const result = await autoCommit.commitDocs();
      expect(result.committed).toBe(false);
      expect(result.reason).toBe('no_git');
    });
  });

  describe('commitMetrics', () => {
    test('commits metrics files', async () => {
      const mockGit = {
        status: async () => ({
          staged: [{ file: '.ai_workflow/metrics/m.json' }],
          unstaged: [],
        }),
        add: async () => {},
        commit: async () => {},
      };
      const autoCommit = new AutoCommit({ gitAutomation: mockGit });
      const result = await autoCommit.commitMetrics();
      expect(result.committed).toBe(true);
      expect(result.files).toContain('.ai_workflow/metrics/m.json');
    });
  });

  describe('commitSummaries', () => {
    test('commits summary files', async () => {
      const mockGit = {
        status: async () => ({
          staged: [],
          unstaged: [{ file: '.ai_workflow/summaries/s.md' }],
        }),
        add: async () => {},
        commit: async () => {},
      };
      const autoCommit = new AutoCommit({ gitAutomation: mockGit });
      const result = await autoCommit.commitSummaries();
      expect(result.committed).toBe(true);
      expect(result.files).toContain('.ai_workflow/summaries/s.md');
    });
  });

  describe('commitAll', () => {
    test('commits all artifacts', async () => {
      const mockGit = {
        status: async () => ({
          staged: [{ file: '.ai_workflow/metrics/m.json' }],
          unstaged: [{ file: 'docs/api.md' }],
        }),
        add: async () => {},
        commit: async () => {},
      };
      const autoCommit = new AutoCommit({ gitAutomation: mockGit });
      const result = await autoCommit.commitAll();
      expect(result.committed).toBe(true);
      expect(result.files.length).toBeGreaterThan(0);
    });
  });

  describe('scheduleCommit', () => {
    test('schedules delayed commit', async () => {
      const mockGit = {
        status: async () => ({ staged: [], unstaged: [] }),
        add: async () => {},
        commit: async () => {},
      };
      const autoCommit = new AutoCommit({ gitAutomation: mockGit });

      const promise = autoCommit.scheduleCommit(100);
      expect(promise).toBeInstanceOf(Promise);

      const result = await promise;
      expect(result).toHaveProperty('committed');
    }, 10000);
  });

  describe('getCommitHistory', () => {
    test('returns commit history', async () => {
      const mockGit = {
        add: async () => {},
        commit: async () => {},
      };
      const autoCommit = new AutoCommit({ gitAutomation: mockGit });

      await autoCommit.commitArtifacts(['.ai_workflow/metrics/m.json']);

      const history = autoCommit.getCommitHistory();
      expect(history).toHaveLength(1);
      expect(history[0]).toHaveProperty('timestamp');
      expect(history[0]).toHaveProperty('files');
    });

    test('returns empty array initially', () => {
      const autoCommit = new AutoCommit();
      expect(autoCommit.getCommitHistory()).toEqual([]);
    });
  });
});
