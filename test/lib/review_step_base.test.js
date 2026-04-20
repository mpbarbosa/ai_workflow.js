import { jest } from '@jest/globals';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { ReviewStepBase } from '../../src/lib/review_step_base.js';

describe('review_step_base', () => {
  test('_getLastSuccessfulRunCommit reads the last successful run hash from commit history', async () => {
    const workflowDir = await fs.mkdtemp(path.join(os.tmpdir(), 'review-step-base-history-'));

    try {
      await fs.writeFile(
        path.join(workflowDir, 'commit_history.json'),
        JSON.stringify(
          {
            version: '1.0.0',
            lastRunCommit: 'abc1234',
            runs: [
              { hash: 'abc1234', runId: 'workflow_success', timestamp: '2026-01-01T00:00:00Z' },
            ],
          },
          null,
          2
        ),
        'utf8'
      );

      const base = new ReviewStepBase();
      expect(base._getLastSuccessfulRunCommit(workflowDir)).toBe('abc1234');
    } finally {
      await fs.rm(workflowDir, { recursive: true, force: true });
    }
  });

  test('_getFilesSinceLastSuccessfulRun merges committed and uncommitted files before filtering', async () => {
    const base = new ReviewStepBase({
      gitOps: {
        getChangedFilesSince: jest.fn().mockReturnValue([
          { file: 'src/app.js', status: 'modified' },
          { file: '.ai_workflow/logs/run.json', status: 'modified' },
          { file: 'src/old.js', status: 'deleted' },
        ]),
        status: jest.fn().mockResolvedValue({
          staged: [{ file: 'src/app.js', status: 'modified' }],
          unstaged: [{ file: 'src/new.js', status: 'modified' }],
          untracked: [{ file: 'README.md', status: 'untracked' }],
        }),
      },
    });
    base._getLastSuccessfulRunCommit = jest.fn().mockReturnValue('abc1234');
    const filterFn = jest.fn((files) => files.filter((file) => file.endsWith('.js')));

    const result = await base._getFilesSinceLastSuccessfulRun('/project', {}, filterFn);

    expect(result).toEqual({
      available: true,
      files: ['src/app.js', 'src/new.js'],
      baselineHash: 'abc1234',
    });
    expect(filterFn).toHaveBeenCalledWith(['src/app.js', 'src/new.js', 'README.md']);
  });

  test('_resolveAnalysisScope prefers sourceFiles overrides before git or full scans', async () => {
    const fileOps = {
      listDirectoryRecursive: jest.fn(),
    };
    const base = new ReviewStepBase({ fileOps });
    base._getFilesSinceLastSuccessfulRun = jest.fn();
    const filterFn = jest.fn((files) => files);

    const result = await base._resolveAnalysisScope(
      '/project',
      {
        sourceFiles: ['/project/src/app.js', 'src/util.js'],
      },
      {
        extensions: ['.js'],
        filterFn,
      }
    );

    expect(result).toEqual({
      analysisMode: 'override',
      baselineHash: null,
      relativeFiles: ['src/app.js', 'src/util.js'],
    });
    expect(filterFn).toHaveBeenCalledWith(['src/app.js', 'src/util.js']);
    expect(base._getFilesSinceLastSuccessfulRun).not.toHaveBeenCalled();
    expect(fileOps.listDirectoryRecursive).not.toHaveBeenCalled();
  });

  test('_resolveAnalysisScope uses full scan when incremental scope is unavailable', async () => {
    const fileOps = {
      listDirectoryRecursive: jest.fn().mockResolvedValue(['/project/src/index.js', 'src/util.ts']),
    };
    const base = new ReviewStepBase({ fileOps });
    base._getFilesSinceLastSuccessfulRun = jest.fn().mockResolvedValue({
      available: false,
      files: [],
    });
    const filterFn = jest.fn((files) => files.filter((file) => file.endsWith('.js')));

    const result = await base._resolveAnalysisScope(
      '/project',
      {},
      {
        extensions: ['.js', '.ts'],
        filterFn,
      }
    );

    expect(result).toEqual({
      analysisMode: 'full-scan',
      baselineHash: null,
      relativeFiles: ['src/index.js'],
    });
    expect(fileOps.listDirectoryRecursive).toHaveBeenCalledWith('/project', {
      extensions: ['.js', '.ts'],
      exclude: ['node_modules', 'dist', 'build', 'coverage', '.git'],
    });
  });

  test('_buildSkipResult returns mode-aware skip messages only when no relevant files remain', () => {
    const base = new ReviewStepBase();
    const isRelevantFn = (files) => files.some((file) => file.endsWith('.js'));

    expect(
      base._buildSkipResult(['README.md'], isRelevantFn, {
        emptyMessage: 'No JS files found',
        sinceLastRunMessage: 'No JS files changed since last successful run',
        analysisMode: 'since-last-successful-run',
      })
    ).toEqual({
      success: true,
      skipped: true,
      message: 'No JS files changed since last successful run',
    });

    expect(
      base._buildSkipResult(['src/index.js'], isRelevantFn, {
        emptyMessage: 'No JS files found',
        sinceLastRunMessage: 'No JS files changed since last successful run',
        analysisMode: 'full-scan',
      })
    ).toBeNull();
  });
});
