/**
 * Step 12: Git Finalization
 * @module steps/step_12_git_finalization
 * @version 2.0.0
 *
 * Purpose: Stage changes, generate commit messages, and push to remote
 * Features:
 * - Git state analysis and change categorization
 * - Submodule detection and processing
 * - AI-powered commit message generation
 * - Conventional commit message inference
 * - Atomic staging and push operations
 *
 * Architecture: v2.0.0 Referential Transparency
 * - Pure functions for git analysis and message generation
 * - Impure wrapper class for I/O operations
 */

import { STEP_KIND } from './step_contract.js';
import { promises as fsPromises } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import GitSubmodules, {
  categorizeSubmodules,
  formatSubmoduleSummary,
} from '../lib/git_submodules.js';
import { normalizeExecutor } from '../core/executor.js';
import { AiHelper } from '../lib/ai_helpers.js';
import { AiCache } from '../lib/ai_cache.js';
import { buildYamlStepPrompt, loadResolvedAiHelpers } from '../lib/ai_prompt_builder.js';
import { buildStepPromptWithFallback } from './step_execution_helpers.js';

// ============================================================================
// CONSTANTS
// ============================================================================

export const COMMIT_TYPES = {
  feat: 'feat',
  fix: 'fix',
  docs: 'docs',
  test: 'test',
  chore: 'chore',
  refactor: 'refactor',
  style: 'style',
  perf: 'perf',
};

export const CHANGE_CATEGORIES = {
  documentation: { pattern: /\.(md|txt|rst|adoc)$/i, weight: 1 },
  tests: { pattern: /\.(test|spec|tests)\.(js|ts|py|go|java|rb|php)$/i, weight: 3 },
  scripts: { pattern: /\.(sh|bash|zsh|ps1|cmd|bat)$/i, weight: 2 },
  code: { pattern: /\.(js|ts|py|go|java|rb|php|c|cpp|rs|swift|kt)$/i, weight: 5 },
  config: { pattern: /\.(json|yaml|yml|toml|ini|xml|conf|config)$/i, weight: 1 },
};

export const GIT_OPERATIONS = {
  status: 'git status --porcelain',
  statusShort: 'git status --short',
  diff: 'git diff --stat',
  diffSummary: 'git diff --shortstat',
  log: 'git log --oneline -n 10',
  commitsAhead: 'git rev-list --count @{u}..HEAD',
  commitsBehind: 'git rev-list --count HEAD..@{u}',
  currentBranch: 'git branch --show-current',
  hasSubmodules: 'git config --file .gitmodules --list',
  submoduleStatus: 'git submodule status',
};

// ============================================================================
// PURE FUNCTIONS - Git State Analysis
// ============================================================================

/**
 * Parse git status porcelain output
 * @pure
 * @param {string} statusOutput - Git status --porcelain output
 * @returns {Object} Parsed status with file lists
 */
export function parseGitStatus(statusOutput) {
  const lines = statusOutput.split('\n').filter((l) => l.trim());

  const status = {
    modified: [],
    staged: [],
    untracked: [],
    deleted: [],
  };

  lines.forEach((line) => {
    const code = line.substring(0, 2);
    const file = line.substring(3).trim();

    if (code[0] === 'M' || code[1] === 'M') {
      status.modified.push(file);
    }
    if (code[0] !== ' ' && code[0] !== '?') {
      status.staged.push(file);
    }
    if (code === '??') {
      status.untracked.push(file);
    }
    if (code.includes('D')) {
      status.deleted.push(file);
    }
  });

  return status;
}

/**
 * Categorize files by type
 * @pure
 * @param {Array<string>} files - List of file paths
 * @returns {Object} Categorized file counts
 */
export function categorizeFiles(files) {
  const categories = {
    documentation: 0,
    tests: 0,
    scripts: 0,
    code: 0,
    config: 0,
    other: 0,
  };

  files.forEach((file) => {
    let categorized = false;

    for (const [category, { pattern }] of Object.entries(CHANGE_CATEGORIES)) {
      if (pattern.test(file)) {
        categories[category]++;
        categorized = true;
        break;
      }
    }

    if (!categorized) {
      categories.other++;
    }
  });

  return categories;
}

const PROMPT_ARTIFACT_DIRS = /^(\.ai_workflow\/|\.jest-cache\/|node_modules\/|\.git\/)/;

/**
 * Build the project-file scope used in Step 12 prompts and heuristics.
 * @pure
 * @param {Object} status - Parsed git status
 * @returns {{ allFiles: string[], relevantFiles: string[], changedFiles: string }}
 */
export function collectPromptScopedFiles(status = {}) {
  const allFiles = [
    ...new Set([
      ...(status.modified || []),
      ...(status.staged || []),
      ...(status.untracked || []),
      ...(status.deleted || []),
    ]),
  ];
  const relevantFiles = allFiles.filter((file) => !PROMPT_ARTIFACT_DIRS.test(file));

  return {
    allFiles,
    relevantFiles,
    changedFiles: relevantFiles.length > 0 ? relevantFiles.join('\n') : '(none)',
  };
}

/**
 * Infer commit type from file changes
 * @pure
 * @param {Object} categories - Categorized file counts
 * @returns {Object} Commit type and scope
 */
export function inferCommitType(categories) {
  const { code, tests, documentation, scripts, config } = categories;

  // Prioritized inference
  if (code > 0 && tests > 0) {
    return { type: COMMIT_TYPES.feat, scope: 'implementation+tests' };
  }
  if (code > 0) {
    return { type: COMMIT_TYPES.feat, scope: 'implementation' };
  }
  if (tests > 0) {
    return { type: COMMIT_TYPES.test, scope: 'testing' };
  }
  if (documentation > 0) {
    return { type: COMMIT_TYPES.docs, scope: 'documentation' };
  }
  if (scripts > 0) {
    return { type: COMMIT_TYPES.chore, scope: 'automation' };
  }
  if (config > 0) {
    return { type: COMMIT_TYPES.chore, scope: 'configuration' };
  }

  return { type: COMMIT_TYPES.chore, scope: 'general' };
}

/**
 * Build a concise heuristic commit description from categorized project files.
 *
 * @pure
 * @param {Object} categories - Categorized file counts
 * @returns {string} Human-readable description
 */
export function summarizeCommitDescription(categories = {}) {
  const parts = [];

  if ((categories.code || 0) > 0) parts.push('implementation');
  if ((categories.tests || 0) > 0) parts.push('tests');
  if ((categories.documentation || 0) > 0) parts.push('documentation');
  if ((categories.scripts || 0) > 0) parts.push('automation');
  if ((categories.config || 0) > 0) parts.push('configuration');

  if (parts.length === 0) return 'update project files';
  if (parts.length === 1) return `update ${parts[0]}`;
  if (parts.length === 2) return `update ${parts[0]} and ${parts[1]}`;
  return `update ${parts.slice(0, -1).join(', ')}, and ${parts.at(-1)}`;
}

/**
 * Calculate total weighted impact score
 * @pure
 * @param {Object} categories - Categorized file counts
 * @returns {number} Weighted impact score
 */
export function calculateImpactScore(categories) {
  let score = 0;

  for (const [category, count] of Object.entries(categories)) {
    const weight = CHANGE_CATEGORIES[category]?.weight || 1;
    score += count * weight;
  }

  return score;
}

// ============================================================================
// PURE FUNCTIONS - Commit Message Generation
// ============================================================================

/**
 * Generate conventional commit message
 * @pure
 * @param {Object} options - Message generation options
 * @returns {string} Formatted commit message
 */
export function generateCommitMessage(options) {
  const {
    type,
    scope,
    description,
    modifiedCount = 0,
    projectFileCount = 0,
    stagedFileCount = 0,
    categories = {},
    changeScope = '',
    totalChanges = 0,
    version = '',
  } = options;

  const header = scope ? `${type}(${scope}): ${description}` : `${type}: ${description}`;
  const visibleProjectFiles = projectFileCount || totalChanges || modifiedCount;
  const visibleStagedFiles = stagedFileCount || 0;
  const body = [
    'Workflow automation summarized the staged changes available to Step 12.',
    '',
    'Changes:',
    `- Changed project files: ${visibleProjectFiles}`,
    `- Documentation: ${categories.documentation || 0} files`,
    `- Tests: ${categories.tests || 0} files`,
    `- Scripts: ${categories.scripts || 0} files`,
    `- Code: ${categories.code || 0} files`,
    ...(changeScope ? [`Scope: ${changeScope}`] : []),
    ...(visibleStagedFiles > visibleProjectFiles
      ? [`- All staged files: ${visibleStagedFiles} (includes workflow artifacts)`]
      : []),
  ].join('\n');

  const footer = version ? `[workflow-automation v${version}]` : '';

  return [header, '', body, footer].filter((s) => s).join('\n');
}

/**
 * Parse git diff summary output
 * @pure
 * @param {string} diffOutput - Git diff --shortstat output
 * @returns {Object} Parsed diff statistics
 */
export function parseDiffSummary(diffOutput) {
  const stats = {
    filesChanged: 0,
    insertions: 0,
    deletions: 0,
  };

  const match = diffOutput.match(
    /(\d+)\s+files?\s+changed(?:,\s+(\d+)\s+insertions?\(\+\))?(?:,\s+(\d+)\s+deletions?\(-\))?/
  );

  if (match) {
    stats.filesChanged = parseInt(match[1], 10) || 0;
    stats.insertions = parseInt(match[2], 10) || 0;
    stats.deletions = parseInt(match[3], 10) || 0;
  }

  return stats;
}

/**
 * Parse commits ahead/behind
 * @pure
 * @param {string} aheadOutput - Rev-list count output for ahead
 * @param {string} behindOutput - Rev-list count output for behind
 * @returns {Object} Commits ahead and behind
 */
export function parseCommitCounts(aheadOutput, behindOutput) {
  return {
    ahead: parseInt(aheadOutput.trim(), 10) || 0,
    behind: parseInt(behindOutput.trim(), 10) || 0,
  };
}

/**
 * Check if submodules exist in output
 * @pure
 * @param {string} submoduleOutput - Git submodule status output
 * @returns {boolean} True if submodules exist
 */
export function hasSubmodules(submoduleOutput) {
  return submoduleOutput.trim().length > 0;
}

/**
 * Parse submodule status output
 * @pure
 * @param {string} statusOutput - Git submodule status output
 * @returns {Array<Object>} Parsed submodule information
 */
export function parseSubmoduleStatus(statusOutput) {
  const lines = statusOutput
    .trim()
    .split('\n')
    .filter((l) => l);
  const submodules = [];

  lines.forEach((line) => {
    // Format: [status]<commit> <path> [(<branch>)]
    // status: '' (normal), '-' (uninit), '+' (modified), 'U' (merge conflicts)
    const match = line.match(/^([+-U\s]?)([0-9a-f]+)\s+(.+?)(?:\s+\((.+)\))?$/);
    if (match) {
      const statusChar = match[1].trim();
      submodules.push({
        status: statusChar || 'initialized',
        commit: match[2],
        path: match[3],
        branch: match[4] || '',
      });
    }
  });

  return submodules;
}

// ============================================================================
// PURE FUNCTIONS - Tagging
// ============================================================================

/**
 * Determine whether a version string is valid for tagging
 * @pure
 * @param {string} version - Semver version string (e.g. "1.2.3")
 * @returns {boolean} True if the version is non-empty and looks like a semver
 */
export function shouldCreateTag(version) {
  if (!version || typeof version !== 'string') return false;
  return /^\d+\.\d+\.\d/.test(version.trim());
}

/**
 * Build the git tag command for a given version
 * @pure
 * @param {string} version - Semver version string (e.g. "1.2.3")
 * @returns {string} Git tag command string
 */
export function buildTagCommand(version) {
  return `git tag v${version.trim()}`;
}

// ============================================================================
// PURE FUNCTIONS - Report Generation
// ============================================================================

/**
 * Format git finalization report
 * @pure
 * @param {Object} data - Report data
 * @returns {string} Formatted markdown report
 */
export function formatGitReport(data) {
  const {
    branch,
    commitsAhead,
    commitsBehind,
    commitType,
    commitScope,
    modifiedCount,
    totalChanges,
    categories,
    commitMessage,
    pushed,
  } = data;

  const sections = [];

  sections.push('### Git Finalization Summary\n');
  sections.push(`**Branch:** ${branch}`);
  sections.push(`**Commits Ahead:** ${commitsAhead}`);
  sections.push(`**Commits Behind:** ${commitsBehind}`);
  sections.push(`**Commit Type:** ${commitType}(${commitScope})`);
  sections.push(`**Modified Files:** ${modifiedCount}`);
  sections.push(`**Total Changes:** ${totalChanges}\n`);

  if (categories) {
    sections.push('### Change Breakdown\n');
    sections.push(`- Documentation: ${categories.documentation || 0} files`);
    sections.push(`- Tests: ${categories.tests || 0} files`);
    sections.push(`- Scripts: ${categories.scripts || 0} files`);
    sections.push(`- Code: ${categories.code || 0} files`);
    sections.push(`- Config: ${categories.config || 0} files\n`);
  }

  if (commitMessage) {
    sections.push('### Commit Message\n');
    sections.push('```');
    sections.push(commitMessage);
    sections.push('```\n');
  }

  if (pushed !== undefined) {
    sections.push(`**Push Status:** ${pushed ? '✅ Pushed successfully' : '❌ Push failed'}`);
  }

  return sections.join('\n');
}

export function isWorktreeClean(status = {}) {
  return (
    (status.modified || []).length === 0 &&
    (status.staged || []).length === 0 &&
    (status.untracked || []).length === 0 &&
    (status.deleted || []).length === 0
  );
}

// ============================================================================
// IMPURE WRAPPER CLASS - Step12GitFinalization
// ============================================================================

export class Step12GitFinalization {
  static stepKind = STEP_KIND.CONTEXT;

  constructor(options = {}) {
    this.executor = normalizeExecutor(options.executor);
    this.backlogManager = options.backlogManager || null;
    this.gitAutomation = options.gitAutomation || null;
    this.logger = options.logger || console;
    this.dryRun = options.dryRun || false;
    this.interactiveMode = options.interactiveMode || false;
    this.aiEnabled = options.aiEnabled || false;
    this.projectRoot = options.projectRoot || null;
    this.aiHelper = options.aiHelper || new AiHelper({ promptsDir: options.promptsDir });
    this.aiCache = options.aiCache || new AiCache();
  }

  /**
   * Execute git finalization workflow
   * @param {Object} context - Workflow context
   * @returns {Promise<Object>} Finalization results
   */
  async execute(context = {}) {
    this.logger.step('Step 12: Git Finalization');

    // Resolve projectRoot from context or constructor option
    this._projectRoot = context.projectRoot || this.projectRoot || process.cwd();

    if (this.dryRun) {
      return this._executeDryRun();
    }

    try {
      // Phase 1: Analyze git state
      const gitState = await this._analyzeGitState(context);

      // Soft-block: warn if upstream test generation found untested files
      const step07Result = Array.isArray(context.results)
        ? context.results.find((r) => r.stepId === 'step_07')
        : undefined;
      if (step07Result?.untestedFiles?.length > 0) {
        this.logger.warn(
          `⚠ Test coverage gap: ${step07Result.untestedFiles.length} file(s) have no tests — ` +
            `pushing anyway (resolve coverage gaps before next release)`
        );
      }

      // Phase 2: Process submodules if any
      if (gitState.hasSubmodules) {
        await this._processSubmodules(gitState);
      }

      // Phase 3: Check if commit needed
      if (gitState.totalChanges === 0) {
        const result = await this._handleNoChanges(gitState);
        await this._ensureCleanWorktree();
        return result;
      }

      // Phase 4: Stage changes
      await this._stageChanges(gitState);

      // Phase 5: Generate commit message
      const commitMessage = await this._generateCommitMessage(gitState);

      // Phase 6: Commit changes
      const committed = await this._commitChanges(commitMessage);

      // Phase 6b: Tag the current version (if version is available)
      const projectVersion = await this._readProjectVersion();
      await this._tagVersion(projectVersion);

      // Phase 7: Push to remote (only increment commitsAhead when a new commit was created)
      const pushResult = await this._pushToRemote({
        ...gitState,
        commitsAhead: committed ? gitState.commitsAhead + 1 : gitState.commitsAhead,
      });

      await this._ensureCleanWorktree();

      // Phase 8: Generate report
      return this._generateReport(gitState, commitMessage, pushResult);
    } catch (error) {
      const detail = error.stderr ? `: ${error.stderr.trim()}` : '';
      this.logger.error(`Git finalization failed: ${error.message}${detail}`);
      throw error;
    }
  }

  /**
   * Execute dry-run mode
   * @private
   */
  async _executeDryRun() {
    this.logger.info('[DRY RUN] Git operations preview:');
    this.logger.info('  - Would check for submodules and process them');
    this.logger.info('  - Would check for changes to commit');
    this.logger.info('  - Would stage changes if any exist');
    this.logger.info('  - Would generate commit message');
    this.logger.info('  - Would commit and push to origin');
    this.logger.info('  - Would tag current version and push tag');

    if (this.backlogManager) {
      await this.backlogManager.saveStepSummary(
        '12',
        'Git_Finalization',
        'Dry run mode - no git operations performed.',
        '✅'
      );
    }

    return {
      success: true,
      dryRun: true,
      message: 'Dry run completed',
    };
  }

  /**
   * Analyze git repository state
   * @private
   */
  async _analyzeGitState(_context) {
    this.logger.info('Analyzing git repository state...');

    // Get branch info
    const branchOutput = await this._executeGit(GIT_OPERATIONS.currentBranch);
    const branch = branchOutput.trim();

    // Get commit counts
    let commitsAhead = 0;
    let commitsBehind = 0;
    try {
      const aheadOutput = await this._executeGit(GIT_OPERATIONS.commitsAhead);
      const behindOutput = await this._executeGit(GIT_OPERATIONS.commitsBehind);
      const counts = parseCommitCounts(aheadOutput, behindOutput);
      commitsAhead = counts.ahead;
      commitsBehind = counts.behind;
    } catch {
      // No upstream branch - this is fine
    }

    // Get status
    const statusOutput = await this._executeGit(GIT_OPERATIONS.status);
    const status = parseGitStatus(statusOutput);

    const { allFiles, relevantFiles } = collectPromptScopedFiles(status);
    const categories = categorizeFiles(relevantFiles);

    // Infer commit type
    const { type, scope } = inferCommitType(categories);

    // Check for submodules
    let hasSubmodulesFlag = false;
    try {
      const submoduleConfig = await this._executeGit(GIT_OPERATIONS.hasSubmodules);
      hasSubmodulesFlag = hasSubmodules(submoduleConfig);
    } catch {
      // No submodules
    }

    const totalChanges = allFiles.length;

    this.logger.info(`Branch: ${branch} (ahead: ${commitsAhead}, behind: ${commitsBehind})`);
    this.logger.info(`Changes: ${totalChanges} files`);
    this.logger.info(`Inferred commit type: ${type}(${scope})`);

    return {
      branch,
      commitsAhead,
      commitsBehind,
      status,
      categories,
      commitType: type,
      commitScope: scope,
      totalChanges,
      projectChangeCount: relevantFiles.length,
      modifiedCount: status.modified.length,
      hasSubmodules: hasSubmodulesFlag,
    };
  }

  /**
   * Process git submodules: detect state, init uninitialized, log summary.
   * @private
   * @param {Object} _gitState - Current git state (unused directly; submodule state is fetched fresh)
   * @returns {Promise<Object>} Result with submodule summary
   */
  async _processSubmodules(_gitState) {
    this.logger.info('Processing submodules...');

    const sm = new GitSubmodules({
      repoPath: this._projectRoot,
      executor: this.executor,
      logger: this.logger,
    });

    try {
      const submodules = await sm.getAll();

      if (submodules.length === 0) {
        this.logger.debug('No submodules found in status output');
        return { success: true, submodules: [] };
      }

      this.logger.info(formatSubmoduleSummary(submodules));

      const { uninitialized, conflicts } = categorizeSubmodules(submodules);

      if (conflicts.length > 0) {
        this.logger.warn(
          `${conflicts.length} submodule(s) have merge conflicts: ${conflicts.map((s) => s.path).join(', ')}`
        );
      }

      if (uninitialized.length > 0) {
        this.logger.info(
          `Initializing ${uninitialized.length} uninitialized submodule(s): ${uninitialized.map((s) => s.path).join(', ')}`
        );
        await sm.update({ init: true, recursive: true });
        this.logger.info('Submodule initialization complete');
      }

      return { success: true, submodules };
    } catch (error) {
      this.logger.warn(`Submodule processing failed: ${error.message}`);
      return { success: false, error: error.message, submodules: [] };
    }
  }

  /**
   * Handle case when no changes exist
   * @private
   */
  async _handleNoChanges(gitState) {
    this.logger.info('No changes to commit');

    if (gitState.commitsAhead > 0) {
      this.logger.info(`Local is ${gitState.commitsAhead} commit(s) ahead of remote — pushing...`);
      const pushResult = await this._pushToRemote(gitState);

      if (this.backlogManager) {
        const summary = pushResult.pushed
          ? `No new changes. Pushed ${gitState.commitsAhead} existing commit(s) to origin/${gitState.branch}.`
          : `No new changes. Push to ${gitState.branch} failed: ${pushResult.error || 'unknown error'}.`;

        await this.backlogManager.saveStepSummary(
          '12',
          'Git_Finalization',
          summary,
          pushResult.pushed ? '✅' : '⚠️'
        );
      }

      return {
        success: true,
        noChanges: true,
        branch: gitState.branch,
        pushed: pushResult.pushed,
      };
    }

    if (this.backlogManager) {
      await this.backlogManager.saveStepSummary(
        '12',
        'Git_Finalization',
        `No changes to commit. Repository up to date with origin/${gitState.branch}.`,
        '✅'
      );
    }

    return {
      success: true,
      noChanges: true,
      branch: gitState.branch,
    };
  }

  /**
   * Stage all changes
   * @private
   */
  async _stageChanges(gitState) {
    this.logger.info('Staging all changes...');
    // Commit any dirty changes inside submodules before staging the parent repo.
    // Without this, `git add -A` in the parent can only record a pointer change
    // for a submodule that already has a new HEAD commit — it cannot capture
    // uncommitted working-tree changes inside the submodule.
    if (gitState.hasSubmodules) {
      await this._stageSubmoduleChanges();
    }
    await this._executeGit('git add -A');
    // Force-add only the specific .ai_workflow/ artifacts that are intentionally
    // tracked despite being gitignored in target projects. Broad force-adding
    // (.ai_workflow/) would bypass gitignore for logs/, checkpoints/, and other
    // ephemeral subdirectories that must never be committed.
    for (const target of ['.ai_workflow/.step_cache/', '.ai_workflow/commit_history.json']) {
      try {
        await this._executeGit(`git add -f ${target}`);
      } catch {
        // path may not exist in all project setups — ignore
      }
    }
    this.logger.info('Changes staged successfully');
  }

  /**
   * Stage and commit any dirty changes inside submodules so the parent repo
   * can pick up the updated submodule pointers via `git add -A`.
   * @private
   */
  async _stageSubmoduleChanges() {
    // Stage within all submodules
    await this._executeGit('git submodule foreach git add -A');

    // Commit staged changes in each submodule.
    // The shell condition `git diff --cached --quiet || git commit ...` means:
    //   • if nothing is staged (diff exits 0) → skip commit
    //   • if there are staged changes (diff exits non-0) → commit them
    try {
      await this._executeGit(
        'git submodule foreach \'git diff --cached --quiet || git commit --no-verify -m "chore: sync submodule [automated]"\''
      );
      this.logger.debug('Submodule changes committed');
    } catch {
      // One or more submodules could not be committed (e.g. identity not set).
      // Log and continue — the parent staging will still include whatever the
      // submodule pointer currently points to.
      this.logger.warn('Could not commit changes inside one or more submodules');
    }
  }

  /**
   * Read project metadata from package.json
   * @private
   * @returns {Promise<Object>} { version, name, description }
   */
  async _readProjectMeta() {
    try {
      const pkgPath = join(this._projectRoot || process.cwd(), 'package.json');
      const pkgContent = await fsPromises.readFile(pkgPath, 'utf-8');
      const pkg = JSON.parse(pkgContent);
      return {
        version: pkg.version || '',
        name: pkg.name || '',
        description: pkg.description || '',
      };
    } catch {
      return { version: '', name: '', description: '' };
    }
  }

  /**
   * Read project semver from package.json
   * @private
   * @returns {Promise<string>} Version string or empty string if unavailable
   */
  async _readProjectVersion() {
    const meta = await this._readProjectMeta();
    return meta.version;
  }

  /**
   * Gather git context data for the commit prompt
   * @private
   * @returns {Promise<Object>} { diffSummary, diffSample, gitLog, changedFiles }
   */
  async _gatherGitContext(gitState) {
    // Exclude artifact/third-party directories from the AI prompt context.
    // .ai_workflow/ and .jest-cache/ are intentionally committed but binary/artifact
    // content adds noise without useful context for commit message generation.
    // git diff HEAD returns files alphabetically, so without this filter the 100-line
    // diff budget is consumed by .ai_workflow/ artifact additions before reaching
    // actual source file diffs.
    const { allFiles, relevantFiles, changedFiles } = collectPromptScopedFiles(gitState.status);

    let diffSummary;
    let diffSample;
    let gitLog;

    try {
      diffSummary = await this._executeGit('git diff --shortstat HEAD');
    } catch {
      diffSummary = `${gitState.totalChanges} files changed`;
    }

    try {
      // Scope the diff to project-relevant files only so the 100-line sample
      // shows meaningful code changes rather than .ai_workflow/ artifact additions.
      const diffTarget =
        relevantFiles.length > 0 ? `-- ${relevantFiles.map((f) => `"${f}"`).join(' ')}` : '';
      const rawDiff = await this._executeGit(`git diff HEAD ${diffTarget}`);
      // Limit to first 100 lines to keep prompt size reasonable
      diffSample = rawDiff.split('\n').slice(0, 100).join('\n');
    } catch {
      diffSample = '(diff unavailable)';
    }

    try {
      gitLog = await this._executeGit('git log --oneline -n 10');
    } catch {
      gitLog = '(log unavailable)';
    }

    // diffSummary reflects all staged files (including workflow artifacts added by
    // git add .) and may exceed gitState.totalChanges (project-level files only).
    const diffNote =
      diffSummary && allFiles.length > relevantFiles.length && relevantFiles.length > 0
        ? ` (${relevantFiles.length} project files + workflow artifacts)`
        : '';

    return {
      changedFiles,
      projectFileCount: relevantFiles.length,
      stagedFileCount: allFiles.length,
      diffSummary: diffSummary.trim()
        ? `${diffSummary.trim()}${diffNote}`
        : `${gitState.totalChanges} files changed`,
      diffSample: diffSample || '(diff unavailable)',
      gitLog: gitLog.trim() || '(log unavailable)',
    };
  }

  /**
   * Generate commit message
   * @private
   */
  async _generateCommitMessage(gitState) {
    this.logger.info('Generating commit message...');

    const projectMeta = await this._readProjectMeta();
    const {
      version: projectVersion,
      name: projectName,
      description: projectDescription,
    } = projectMeta;
    const { allFiles, relevantFiles, changedFiles } = collectPromptScopedFiles(gitState.status);
    const projectFileCount = relevantFiles.length || gitState.projectChangeCount || 0;
    const stagedFileCount = allFiles.length || projectFileCount;
    const commitDescription = summarizeCommitDescription(gitState.categories);

    // Heuristic conventional commit message as base
    const baseMessage = generateCommitMessage({
      type: gitState.commitType,
      scope: gitState.commitScope,
      description: commitDescription,
      modifiedCount: gitState.modifiedCount,
      projectFileCount,
      stagedFileCount,
      categories: gitState.categories,
      totalChanges: projectFileCount,
      version: projectVersion,
    });

    // AI-powered commit message refinement
    const aiAvailable = await this.aiHelper.initialize();
    if (aiAvailable) {
      try {
        await this.aiCache.init();
        const gitCtx = await this._gatherGitContext(gitState).catch(() => ({
          changedFiles,
          projectFileCount,
          stagedFileCount,
          diffSummary: `${projectFileCount} files changed`,
          diffSample: '(diff unavailable)',
          gitLog: '(log unavailable)',
        }));
        const cats = gitState.categories || {};
        const changeScope = `${gitState.commitType}(${gitState.commitScope}): ${projectFileCount} project files changed (docs: ${cats.documentation || 0}, tests: ${cats.tests || 0}, code: ${cats.code || 0}, config: ${cats.config || 0})`;

        const prompt = await buildStepPromptWithFallback({
          buildPrompt: async () => {
            const parsedYaml = await loadResolvedAiHelpers(null);
            // commit_types comes from the YAML config block itself
            const commitTypesText = parsedYaml?.step12_git_commit_prompt?.commit_types || '';
            return buildYamlStepPrompt(parsedYaml, 'step12_git_commit_prompt', {
              project_name: projectName,
              project_description: projectDescription,
              script_version: projectVersion,
              change_scope: changeScope,
              git_context: gitCtx.gitLog,
              changed_files: gitCtx.changedFiles,
              diff_summary: gitCtx.diffSummary,
              git_analysis_content: baseMessage,
              diff_sample: gitCtx.diffSample,
              commit_types: commitTypesText,
            });
          },
          fallbackRole: `You are an expert Git commit message writer following the Conventional Commits specification.`,
          fallbackTask: `Generate a concise, accurate git commit message for these changes:
- Type: ${gitState.commitType}(${gitState.commitScope})
- Changed project files: ${projectFileCount} (docs: ${cats.documentation || 0}, tests: ${cats.tests || 0}, code: ${cats.code || 0}, config: ${cats.config || 0})
${stagedFileCount > projectFileCount ? `- All staged files: ${stagedFileCount} (includes workflow artifacts)\n` : ''}- Changed Files list is the authoritative project-file scope
- Base message: ${baseMessage}`,
          fallbackApproach: `Output ONLY the commit message (subject + optional body). Follow Conventional Commits. Subject ≤72 chars.`,
          fallbackProjectContext: {},
        });
        const cacheKey = `step_12|${gitState.commitType}|${gitState.modifiedCount}|${gitState.totalChanges}`;
        const response = await this.aiCache.withCache(prompt, cacheKey, () =>
          this.aiHelper.executeRequest(prompt, { persona: 'git_specialist' })
        );
        if (response?.content?.trim()) {
          this.logger.info('AI commit message generated');
          return response.content.trim();
        }
      } catch (err) {
        this.logger.warn(`AI commit message generation failed: ${err.message} — using heuristic`);
      }
    }

    this.logger.info('Commit message generated (heuristic)');
    return baseMessage;
  }

  /**
   * Commit changes
   * @private
   */
  async _commitChanges(message) {
    this.logger.info('Creating commit...');
    // Write message to a temp file to avoid shell-parsing issues with multiline strings
    const tmpFile = join(tmpdir(), `workflow_commit_${Date.now()}.txt`);
    try {
      await fsPromises.writeFile(tmpFile, message, 'utf-8');
      await this._executeGit(`git commit -F "${tmpFile}"`);
    } catch (err) {
      // "nothing to commit" is not an error — the step is still successful
      const errText = `${err.message} ${err.stderr ?? ''}`.toLowerCase();
      if (errText.includes('nothing to commit') || errText.includes('nothing added to commit')) {
        this.logger.info('Nothing to commit — working tree already clean');
        return false;
      }
      // Re-throw with stderr included so the root cause is visible in the log
      const detail = err.stderr ? `: ${err.stderr.trim()}` : '';
      throw new Error(`${err.message}${detail}`, { cause: err });
    } finally {
      await fsPromises.unlink(tmpFile).catch(() => {});
    }
    this.logger.info('Changes committed successfully');
    return true;
  }

  /**
   * Push to remote repository
   * @private
   */
  async _pushToRemote(gitState) {
    const { branch, commitsAhead } = gitState;

    if (commitsAhead === 0) {
      this.logger.info(`Local branch is up to date with origin/${branch}`);
      return { pushed: false, reason: 'up-to-date' };
    }

    this.logger.info(`Pushing to origin/${branch}...`);

    try {
      // Stash all changes (staged + unstaged + untracked) before rebasing.
      // git pull --rebase refuses to run when the index contains uncommitted
      // changes, so we must clear it entirely — including any .ai_workflow/
      // files that were written after the last commit.
      let stashed = false;
      try {
        const stashOut = await this._executeGit('git stash push --include-untracked');
        stashed = typeof stashOut === 'string' && !stashOut.includes('No local changes to save');
      } catch {
        // stash failure is non-fatal — attempt the pull anyway
      }

      // Pull latest remote changes before pushing to avoid non-fast-forward rejection
      await this._executeGit(`git pull --rebase origin ${branch}`);

      if (stashed) {
        try {
          await this._executeGit('git stash pop');
        } catch {
          this.logger.warn('git stash pop failed after pull — stash may need manual attention');
        }
      }

      await this._executeGit(`git push origin ${branch}`);
      // Reopen log file descriptors now — git stash/pull/pop may have atomically
      // renamed log files, orphaning the open fd. Reopening here ensures the
      // push-result log lines below are written to the visible file.
      this.logger.reopenLogFiles?.();
      this.logger.info('Successfully pushed to remote');
      return { pushed: true };
    } catch (error) {
      this.logger.reopenLogFiles?.();
      const detail = error.stderr ? `: ${error.stderr.trim()}` : '';
      this.logger.error(`Push failed: ${error.message}${detail}`);
      return { pushed: false, error: `${error.message}${detail}` };
    } finally {
      // Final reopen to cover any edge cases not handled above.
      this.logger.reopenLogFiles?.();
    }
  }

  /**
   * Create an annotated git tag for the current project version.
   * Skips gracefully if the version is missing, invalid, or the tag already exists.
   * @private
   * @param {string} version - Semver version string (e.g. "1.2.3")
   */
  async _tagVersion(version) {
    if (!shouldCreateTag(version)) {
      this.logger.info('Skipping git tag: no valid version found in package.json');
      return;
    }
    const tagName = `v${version.trim()}`;
    const cmd = buildTagCommand(version);
    try {
      await this._executeGit(cmd);
      this.logger.info(`Tagged release: ${tagName}`);
      // Push the tag to remote
      try {
        await this._executeGit(`git push origin ${tagName}`);
        this.logger.info(`Pushed tag ${tagName} to remote`);
      } catch (pushErr) {
        this.logger.warn(`Failed to push tag ${tagName}: ${pushErr.message}`);
      }
    } catch (err) {
      const msg = `${err.message} ${err.stderr ?? ''}`.toLowerCase();
      if (msg.includes('already exists')) {
        this.logger.info(`Tag ${tagName} already exists — skipping`);
      } else {
        this.logger.warn(`Failed to create tag ${tagName}: ${err.message}`);
      }
    }
  }

  /**
   * Generate final report
   * @private
   */
  async _generateReport(gitState, commitMessage, pushResult) {
    const reportData = {
      branch: gitState.branch,
      commitsAhead: gitState.commitsAhead + 1, // +1 for new commit
      commitsBehind: gitState.commitsBehind,
      commitType: gitState.commitType,
      commitScope: gitState.commitScope,
      modifiedCount: gitState.modifiedCount,
      totalChanges: gitState.totalChanges,
      categories: gitState.categories,
      commitMessage,
      pushed: pushResult.pushed,
    };

    const report = formatGitReport(reportData);

    if (this.backlogManager) {
      await this.backlogManager.saveStepIssues('12', 'Git_Finalization', report);

      const summary = pushResult.pushed
        ? `Changes committed and pushed successfully to ${gitState.branch}. ${gitState.modifiedCount} files modified.`
        : `Changes committed locally. Push to ${gitState.branch} ${pushResult.reason === 'up-to-date' ? 'not needed' : 'failed'}.`;

      await this.backlogManager.saveStepSummary(
        '12',
        'Git_Finalization',
        summary,
        pushResult.pushed || pushResult.reason === 'up-to-date' ? '✅' : '⚠️'
      );
    }

    return {
      success: true,
      branch: gitState.branch,
      commitMessage,
      pushed: pushResult.pushed,
      report,
    };
  }

  async _ensureCleanWorktree() {
    const finalStatusOutput = await this._executeGit(GIT_OPERATIONS.status);
    const finalStatus = parseGitStatus(finalStatusOutput);
    if (!isWorktreeClean(finalStatus)) {
      throw new Error('Step 12 postcondition failed: target repo worktree is not clean');
    }
  }

  /**
   * Execute git command
   * @private
   */
  async _executeGit(command) {
    const cwd = this._projectRoot || process.cwd();
    if (this.executor && typeof this.executor.execute === 'function') {
      const result = await this.executor.execute(command, { shell: true, cwd });
      return result?.stdout || '';
    }

    // Fallback: executor may be the raw execute function (default export)
    if (typeof this.executor === 'function') {
      const result = await this.executor(command, { shell: true, cwd });
      return result?.stdout || '';
    }

    // Fallback: use executor module functions if available
    const executor = this.executor;
    if (executor && typeof executor.executeCommand === 'function') {
      const result = await executor.executeCommand(command, { shell: true, cwd });
      return result?.stdout || '';
    }

    throw new Error('No executor available for git commands');
  }
}
