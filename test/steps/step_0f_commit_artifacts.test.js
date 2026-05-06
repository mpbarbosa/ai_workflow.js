// test/steps/step_0f_commit_artifacts.test.js

import { jest } from '@jest/globals';
import {
  hasArtifactFiles,
  buildSummaryMessage,
  Step0fCommitArtifacts,
} from '../../src/steps/step_0f_commit_artifacts.js';
import { logger } from '../../src/core/logger.js';

describe('hasArtifactFiles', () => {
  it('returns false for non-array input', () => {
    expect(hasArtifactFiles(null)).toBe(false);
    expect(hasArtifactFiles(undefined)).toBe(false);
    expect(hasArtifactFiles('not-an-array')).toBe(false);
    expect(hasArtifactFiles({})).toBe(false);
  });

  it('returns false for empty array', () => {
    expect(hasArtifactFiles([])).toBe(false);
  });

  it('returns true if any file is a workflow artifact', () => {
    expect(hasArtifactFiles(['src/index.js', '.ai_workflow/artifact.txt'])).toBe(true);
  });

  it('returns false if no files are workflow artifacts', () => {
    expect(hasArtifactFiles(['src/index.js', 'README.md'])).toBe(false);
  });
});

describe('buildSummaryMessage', () => {
  it('returns correct message for committed result', () => {
    expect(buildSummaryMessage({ committed: true, files: ['a', 'b'] })).toBe(
      'Committed 2 artifact file(s)'
    );
    expect(buildSummaryMessage({ committed: true, files: [] })).toBe(
      'Committed 0 artifact file(s)'
    );
    expect(buildSummaryMessage({ committed: true })).toBe('Committed 0 artifact file(s)');
  });

  it('returns correct message for no_files reason', () => {
    expect(buildSummaryMessage({ committed: false, reason: 'no_files' })).toBe(
      'No artifact files to commit'
    );
  });

  it('returns correct message for filtered reason', () => {
    expect(buildSummaryMessage({ committed: false, reason: 'filtered' })).toBe(
      'No eligible artifact files after filtering'
    );
  });

  it('returns correct message for disabled reason', () => {
    expect(buildSummaryMessage({ committed: false, reason: 'disabled' })).toBe(
      'Auto-commit is disabled'
    );
  });

  it('returns correct message for no_git reason', () => {
    expect(buildSummaryMessage({ committed: false, reason: 'no_git' })).toBe('Git not available');
  });

  it('returns default skipped message for unknown reason', () => {
    expect(buildSummaryMessage({ committed: false, reason: 'other' })).toBe('Skipped: other');
  });

  it('returns default skipped message if reason is missing', () => {
    expect(buildSummaryMessage({ committed: false })).toBe('Skipped: unknown');
  });
});

describe('Step0fCommitArtifacts', () => {
  let mockGitOps, mockAutoCommit, step, loggerInfoSpy, loggerErrorSpy;

  beforeEach(() => {
    mockGitOps = {
      status: jest.fn(),
    };
    mockAutoCommit = {
      commitArtifacts: jest.fn(),
    };
    loggerInfoSpy = jest.spyOn(logger, 'info').mockImplementation(() => {});
    loggerErrorSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});
    step = new Step0fCommitArtifacts({ gitOps: mockGitOps, autoCommit: mockAutoCommit });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns skipped result if no artifact files to commit', async () => {
    mockGitOps.status.mockResolvedValue({
      staged: [{ file: 'src/index.js' }],
      unstaged: [{ file: 'README.md' }],
      untracked: [],
    });

    const result = await step.execute('/project/root');
    expect(result).toEqual({ success: true, skipped: true, reason: 'no_artifact_files' });
    expect(loggerInfoSpy).toHaveBeenCalledWith('Step 0f: No workflow artifact files to commit');
  });

  it('commits artifact files and returns success result', async () => {
    mockGitOps.status.mockResolvedValue({
      staged: [{ file: '.ai_workflow/artifact1.txt' }],
      unstaged: [{ file: 'src/index.js' }],
      untracked: ['.ai_workflow/artifact2.txt'],
    });
    mockAutoCommit.commitArtifacts.mockResolvedValue({
      committed: true,
      files: ['.ai_workflow/artifact1.txt', '.ai_workflow/artifact2.txt'],
    });

    const result = await step.execute('/project/root');
    expect(result.success).toBe(true);
    expect(result.committed).toBe(true);
    expect(result.files).toEqual(['.ai_workflow/artifact1.txt', '.ai_workflow/artifact2.txt']);
    expect(result.summary).toBe('Committed 2 artifact file(s)');
    expect(loggerInfoSpy).toHaveBeenCalledWith('Found 2 artifact file(s) to commit');
    expect(loggerInfoSpy).toHaveBeenCalledWith('Committed 2 artifact file(s)');
  });

  it('handles autoCommit returning no commit', async () => {
    mockGitOps.status.mockResolvedValue({
      staged: [{ file: '.ai_workflow/artifact1.txt' }],
      unstaged: [],
      untracked: [],
    });
    mockAutoCommit.commitArtifacts.mockResolvedValue({
      committed: false,
      reason: 'filtered',
      files: [],
    });

    const result = await step.execute('/project/root');
    expect(result.success).toBe(true);
    expect(result.committed).toBe(false);
    expect(result.files).toEqual([]);
    expect(result.summary).toBe('No eligible artifact files after filtering');
    expect(loggerInfoSpy).toHaveBeenCalledWith('Found 1 artifact file(s) to commit');
    expect(loggerInfoSpy).toHaveBeenCalledWith('No eligible artifact files after filtering');
  });

  it('skips artifact commits after earlier critical failures by default', async () => {
    const result = await step.execute('/project/root', {
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
    expect(mockGitOps.status).not.toHaveBeenCalled();
    expect(mockAutoCommit.commitArtifacts).not.toHaveBeenCalled();
  });

  it('handles errors thrown during execution', async () => {
    mockGitOps.status.mockRejectedValue(new Error('Git failure'));
    const result = await step.execute('/project/root');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Git failure');
    expect(loggerErrorSpy).toHaveBeenCalledWith('Step 0f failed: Git failure');
  });

  it('handles empty status object gracefully', async () => {
    mockGitOps.status.mockResolvedValue({});
    const result = await step.execute('/project/root');
    expect(result).toEqual({ success: true, skipped: true, reason: 'no_artifact_files' });
  });

  it('handles missing staged/unstaged/untracked arrays', async () => {
    mockGitOps.status.mockResolvedValue({
      staged: null,
      unstaged: undefined,
      untracked: undefined,
    });
    const result = await step.execute('/project/root');
    expect(result).toEqual({ success: true, skipped: true, reason: 'no_artifact_files' });
  });

  it('uses dryRun option in autoCommit if provided', () => {
    const stepDry = new Step0fCommitArtifacts({ gitOps: mockGitOps, dryRun: true });
    expect(stepDry.autoCommit.dryRun).toBe(true);
  });
});
