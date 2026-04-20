import path from 'path';
import { FileOperations } from './file_operations.js';
import { Backlog } from './backlog.js';
import { AiHelper } from './ai_helpers.js';
import { AiCache } from './ai_cache.js';
import { CommitHistory } from './commit_history.js';

/**
 * Shared base class for review steps that support incremental git scoping.
 */
export class ReviewStepBase {
  constructor(options = {}) {
    this.fileOps = options.fileOps || new FileOperations();
    this.backlog = options.backlog || new Backlog();
    this.aiHelper = options.aiHelper || new AiHelper({ promptsDir: options.promptsDir ?? null });
    this.aiCache = options.aiCache || new AiCache();
    this.gitOps = options.gitOps || null;
  }

  _getLastSuccessfulRunCommit(workflowDir) {
    const commitHistory = new CommitHistory({ workflowDir });
    return commitHistory.getLastRunCommit();
  }

  _normalizeScopedFiles(projectRoot, files, filterFn) {
    return filterFn(
      (Array.isArray(files) ? files : []).map((file) =>
        path.isAbsolute(file) ? path.relative(projectRoot, file) : file
      )
    );
  }

  async _getFilesSinceLastSuccessfulRun(projectRoot, options = {}, filterFn) {
    if (
      !this.gitOps ||
      typeof this.gitOps.getChangedFilesSince !== 'function' ||
      typeof this.gitOps.status !== 'function'
    ) {
      return { available: false, files: [] };
    }

    const rawWorkflowDir = options.workflowDir || '.ai_workflow';
    const workflowDir = path.isAbsolute(rawWorkflowDir)
      ? rawWorkflowDir
      : path.join(projectRoot, rawWorkflowDir);
    const baselineHash = this._getLastSuccessfulRunCommit(workflowDir);

    if (!baselineHash) {
      return { available: false, files: [] };
    }

    let committedChangedFiles;
    try {
      committedChangedFiles = this.gitOps
        .getChangedFilesSince(baselineHash)
        .filter((file) => file.status !== 'deleted' && !file.file?.startsWith('.ai_workflow/'));
    } catch {
      return { available: false, files: [] };
    }

    const status = await this.gitOps.status();
    const uncommittedFiles = [
      ...(status.staged || []),
      ...(status.unstaged || []),
      ...(status.untracked || []),
    ].filter((file) => file.status !== 'deleted');

    const seenPaths = new Set(committedChangedFiles.map((file) => file.file));
    const mergedFiles = [
      ...committedChangedFiles,
      ...uncommittedFiles.filter((file) => !seenPaths.has(file.file)),
    ];

    return {
      available: true,
      files: filterFn(mergedFiles.map((file) => file.file || file)),
      baselineHash,
    };
  }

  async _resolveAnalysisScope(projectRoot, options = {}, { extensions, filterFn }) {
    let analysisMode = 'full-scan';
    let baselineHash = null;
    let relativeFiles;

    if (Array.isArray(options.sourceFiles)) {
      analysisMode = 'override';
      relativeFiles = this._normalizeScopedFiles(projectRoot, options.sourceFiles, filterFn);
    } else {
      const successfulScope = await this._getFilesSinceLastSuccessfulRun(
        projectRoot,
        options,
        filterFn
      );

      if (successfulScope.available) {
        analysisMode = 'since-last-successful-run';
        baselineHash = successfulScope.baselineHash;
        relativeFiles = successfulScope.files;
      } else if (Array.isArray(options.modifiedFiles) && options.modifiedFiles.length > 0) {
        analysisMode = 'modified-files';
        relativeFiles = this._normalizeScopedFiles(projectRoot, options.modifiedFiles, filterFn);
      } else {
        const allFiles = await this.fileOps.listDirectoryRecursive(projectRoot, {
          extensions,
          exclude: ['node_modules', 'dist', 'build', 'coverage', '.git'],
        });

        relativeFiles = this._normalizeScopedFiles(projectRoot, allFiles, filterFn);
      }
    }

    return { analysisMode, baselineHash, relativeFiles };
  }

  _buildSkipResult(files, isRelevantFn, { emptyMessage, sinceLastRunMessage, analysisMode }) {
    if (isRelevantFn(files)) {
      return null;
    }

    return {
      success: true,
      skipped: true,
      message: analysisMode === 'since-last-successful-run' ? sinceLastRunMessage : emptyMessage,
    };
  }
}

export default ReviewStepBase;
