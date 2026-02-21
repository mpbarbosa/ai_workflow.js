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
import { AiHelper } from '../lib/ai_helpers.js';
import { AiCache } from '../lib/ai_cache.js';
import {
  buildStructuredPrompt,
  injectProjectContext,
  buildYamlStepPrompt,
  AI_HELPERS_PATH,
} from '../lib/ai_prompt_builder.js';
import yaml from 'js-yaml';

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
    categories = {},
    changeScope = '',
    totalChanges = 0,
    version = '',
  } = options;

  const header = scope ? `${type}(${scope}): ${description}` : `${type}: ${description}`;

  const body = `
Workflow automation completed comprehensive validation and updates.

Changes:
- Modified files: ${modifiedCount}
- Documentation: ${categories.documentation || 0} files
- Tests: ${categories.tests || 0} files
- Scripts: ${categories.scripts || 0} files
- Code: ${categories.code || 0} files
${changeScope ? `\nScope: ${changeScope}` : ''}
Total changes: ${totalChanges} files
`.trim();

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

// ============================================================================
// IMPURE WRAPPER CLASS - Step12GitFinalization
// ============================================================================

export class Step12GitFinalization {
  static stepKind = STEP_KIND.CONTEXT;

  constructor(options = {}) {
    this.executor = options.executor || null;
    this.backlogManager = options.backlogManager || null;
    this.gitAutomation = options.gitAutomation || null;
    this.logger = options.logger || console;
    this.dryRun = options.dryRun || false;
    this.interactiveMode = options.interactiveMode || false;
    this.aiEnabled = options.aiEnabled || false;
    this.projectRoot = options.projectRoot || null;
    this.aiHelper = options.aiHelper || new AiHelper();
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

      // Phase 2: Process submodules if any
      if (gitState.hasSubmodules) {
        await this._processSubmodules(gitState);
      }

      // Phase 3: Check if commit needed
      if (gitState.totalChanges === 0) {
        return this._handleNoChanges(gitState);
      }

      // Phase 4: Stage changes
      await this._stageChanges(gitState);

      // Phase 5: Generate commit message
      const commitMessage = await this._generateCommitMessage(gitState);

      // Phase 6: Commit changes
      await this._commitChanges(commitMessage);

      // Phase 7: Push to remote (commitsAhead + 1 because we just created a new commit)
      const pushResult = await this._pushToRemote({
        ...gitState,
        commitsAhead: gitState.commitsAhead + 1,
      });

      // Phase 8: Generate report
      return this._generateReport(gitState, commitMessage, pushResult);
    } catch (error) {
      this.logger.error(`Git finalization failed: ${error.message}`);
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

    // Categorize files
    const allFiles = [...status.modified, ...status.untracked, ...status.deleted];
    const categories = categorizeFiles(allFiles);

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
  async _stageChanges(_gitState) {
    this.logger.info('Staging all changes...');
    await this._executeGit('git add -A');
    this.logger.info('Changes staged successfully');
  }

  /**
   * Generate commit message
   * @private
   */
  async _generateCommitMessage(gitState) {
    this.logger.info('Generating commit message...');

    // Heuristic conventional commit message as base
    const baseMessage = generateCommitMessage({
      type: gitState.commitType,
      scope: gitState.commitScope,
      description: 'update tests and documentation',
      modifiedCount: gitState.modifiedCount,
      categories: gitState.categories,
      totalChanges: gitState.totalChanges,
      version: '1.2.0',
    });

    // AI-powered commit message refinement
    const aiAvailable = await this.aiHelper.initialize();
    if (aiAvailable) {
      try {
        await this.aiCache.init();
        const cats = gitState.categories || {};
        let prompt;
        try {
          const yamlContent = await fsPromises.readFile(AI_HELPERS_PATH, 'utf-8');
          const parsedYaml = yaml.load(yamlContent);
          prompt = buildYamlStepPrompt(parsedYaml, 'step11_git_commit_prompt', {
            commit_type: gitState.commitType,
            commit_scope: gitState.commitScope,
            modified_count: String(gitState.modifiedCount),
            docs_count: String(cats.documentation || 0),
            tests_count: String(cats.tests || 0),
            code_count: String(cats.code || 0),
            config_count: String(cats.config || 0),
            total_changes: String(gitState.totalChanges),
            base_message: baseMessage,
          });
        } catch {
          /* fallback to generic prompt */
        }
        if (!prompt) {
          const role = `You are an expert Git commit message writer following the Conventional Commits specification.`;
          const task = `Generate a concise, accurate git commit message for these changes:
- Type: ${gitState.commitType}(${gitState.commitScope})
- Modified files: ${gitState.modifiedCount} (docs: ${cats.documentation || 0}, tests: ${cats.tests || 0}, code: ${cats.code || 0}, config: ${cats.config || 0})
- Total changes: ${gitState.totalChanges}
- Base message: ${baseMessage}`;
          const approach = `Output ONLY the commit message (subject + optional body). Follow Conventional Commits. Subject ≤72 chars.`;
          prompt = injectProjectContext(buildStructuredPrompt({ role, task, approach }), {});
        }
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
    } finally {
      await fsPromises.unlink(tmpFile).catch(() => {});
    }
    this.logger.info('Changes committed successfully');
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
      await this._executeGit(`git push origin ${branch}`);
      this.logger.info('Successfully pushed to remote');
      return { pushed: true };
    } catch (error) {
      this.logger.error(`Push failed: ${error.message}`);
      return { pushed: false, error: error.message };
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

  /**
   * Execute git command
   * @private
   */
  async _executeGit(command) {
    const cwd = this._projectRoot || process.cwd();
    if (this.executor && typeof this.executor.execute === 'function') {
      const result = await this.executor.execute(command, { shell: true, cwd });
      return result.stdout || '';
    }

    // Fallback: use executor module functions if available
    const executor = this.executor;
    if (executor && typeof executor.executeCommand === 'function') {
      const result = await executor.executeCommand(command, { shell: true, cwd });
      return result.stdout || '';
    }

    throw new Error('No executor available for git commands');
  }
}
