/**
 * Step 11: Context Analysis
 * @module steps/step_11_context
 * @version 2.0.0
 *
 * Analyzes workflow context and provides strategic recommendations.
 */

import { logger } from '../core/logger.js';
import { FileOperations } from '../lib/file_operations.js';
import { Backlog } from '../lib/backlog.js';
import { GitAutomation } from '../lib/git_automation.js';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Impact score thresholds
 */
export const IMPACT_THRESHOLDS = {
  low: 0,
  medium: 3,
  high: 5,
};

/**
 * Completion rate thresholds
 */
export const COMPLETION_THRESHOLDS = {
  poor: 50,
  moderate: 75,
  good: 90,
};

// ============================================================================
// PURE FUNCTIONS - Context Analysis
// ============================================================================

/**
 * Calculate workflow completion rate
 * @pure
 * @param {number} completed - Number of completed steps
 * @param {number} total - Total number of steps
 * @returns {number} Completion percentage
 */
export function calculateCompletionRate(completed, total) {
  if (total === 0) return 0;
  return Math.round((completed / total) * 100);
}

/**
 * Determine workflow completion status
 * @pure
 * @param {number} completionRate - Completion percentage
 * @returns {string} Status: excellent, good, moderate, poor
 */
export function determineCompletionStatus(completionRate) {
  if (completionRate >= COMPLETION_THRESHOLDS.good) return 'excellent';
  if (completionRate >= COMPLETION_THRESHOLDS.moderate) return 'good';
  if (completionRate >= COMPLETION_THRESHOLDS.poor) return 'moderate';
  return 'poor';
}

/**
 * Calculate change impact score
 * @pure
 * @param {Object} changes - Change statistics
 * @returns {number} Impact score
 */
export function calculateImpactScore(changes) {
  let score = 0;

  // Modified files impact
  if (changes.modifiedFiles > 10) {
    score += 3;
  } else if (changes.modifiedFiles > 5) {
    score += 2;
  } else if (changes.modifiedFiles > 0) {
    score += 1;
  }

  // Critical file modifications
  if (changes.dependenciesModified) {
    score += 2;
  }

  if (changes.scriptsModified) {
    score += 1;
  }

  if (changes.configModified) {
    score += 1;
  }

  return score;
}

/**
 * Determine change impact level
 * @pure
 * @param {number} impactScore - Impact score
 * @returns {string} Impact level: low, medium, high
 */
export function determineImpactLevel(impactScore) {
  if (impactScore >= IMPACT_THRESHOLDS.high) return 'high';
  if (impactScore >= IMPACT_THRESHOLDS.medium) return 'medium';
  return 'low';
}

/**
 * Aggregate workflow issues
 * @pure
 * @param {Object[]} stepResults - Array of step results
 * @returns {Object} Issue summary
 */
export function aggregateIssues(stepResults) {
  const summary = {
    total: 0,
    critical: 0,
    warnings: 0,
    passed: 0,
  };

  stepResults.forEach((result) => {
    if (result.success === false) {
      summary.critical++;
      summary.total++;
    } else if (result.warnings && result.warnings.length > 0) {
      summary.warnings++;
      summary.total++;
    } else if (result.success === true) {
      summary.passed++;
    }
  });

  return summary;
}

/**
 * Calculate workflow duration
 * @pure
 * @param {number} startTime - Start timestamp (ms)
 * @param {number} endTime - End timestamp (ms)
 * @returns {number} Duration in seconds
 */
export function calculateDuration(startTime, endTime) {
  return Math.round((endTime - startTime) / 1000);
}

/**
 * Format duration as human-readable string
 * @pure
 * @param {number} durationSeconds - Duration in seconds
 * @returns {string} Formatted duration
 */
export function formatDuration(durationSeconds) {
  if (durationSeconds < 60) {
    return `${durationSeconds}s`;
  }

  const minutes = Math.floor(durationSeconds / 60);
  const seconds = durationSeconds % 60;

  if (minutes < 60) {
    return `${minutes}m ${seconds}s`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return `${hours}h ${remainingMinutes}m ${seconds}s`;
}

// ============================================================================
// PURE FUNCTIONS - Reporting
// ============================================================================

/**
 * Format context analysis report
 * @pure
 * @param {Object} context - Context analysis results
 * @returns {string} Formatted report
 */
export function formatContextReport(context) {
  const {
    completionRate = 0,
    completionStatus = 'unknown',
    completedSteps = 0,
    totalSteps = 0,
    gitStatus = {},
    changeImpact = 'low',
    impactScore = 0,
    issues = {},
    duration = 0,
  } = context;

  let report = '# Workflow Context Analysis\n\n';

  // Workflow Completion
  report += '## Workflow Completion\n\n';
  report += `- **Completion Rate**: ${completionRate}%\n`;
  report += `- **Steps Completed**: ${completedSteps}/${totalSteps}\n`;

  if (completionStatus === 'excellent') {
    report += '- **Status**: ✅ Excellent - workflow nearly complete\n\n';
  } else if (completionStatus === 'good') {
    report += '- **Status**: 👍 Good - workflow progressing well\n\n';
  } else if (completionStatus === 'moderate') {
    report += '- **Status**: ⚠️ Moderate - more steps needed\n\n';
  } else {
    report += '- **Status**: 🚨 Poor - significant work remaining\n\n';
  }

  // Git Repository State
  if (gitStatus.isGitRepo) {
    report += '## Git Repository State\n\n';
    report += `- **Branch**: ${gitStatus.branch || 'unknown'}\n`;
    report += `- **Modified Files**: ${gitStatus.modifiedFiles || 0}\n`;
    report += `- **Untracked Files**: ${gitStatus.untrackedFiles || 0}\n`;
    report += `- **Staged Files**: ${gitStatus.stagedFiles || 0}\n`;

    if (gitStatus.commitsAhead > 0) {
      report += `- **Commits Ahead**: ${gitStatus.commitsAhead}\n`;
    }

    report += '\n';
  }

  // Change Impact
  report += '## Change Impact Assessment\n\n';
  report += `- **Impact Level**: ${changeImpact.toUpperCase()}\n`;
  report += `- **Impact Score**: ${impactScore}\n\n`;

  if (changeImpact === 'high') {
    report += '🚨 **High impact changes** - comprehensive testing recommended\n\n';
  } else if (changeImpact === 'medium') {
    report += '⚠️ **Medium impact changes** - standard testing sufficient\n\n';
  } else {
    report += '✅ **Low impact changes** - minimal testing required\n\n';
  }

  // Issues Summary
  report += '## Issues & Warnings\n\n';
  report += `- **Total Issues**: ${issues.total || 0}\n`;
  report += `- **Critical**: ${issues.critical || 0}\n`;
  report += `- **Warnings**: ${issues.warnings || 0}\n`;
  report += `- **Passed**: ${issues.passed || 0}\n\n`;

  if (issues.critical > 0) {
    report += '🚨 **Critical issues detected** - immediate attention required\n\n';
  } else if (issues.warnings > 0) {
    report += '⚠️ **Warnings present** - review recommended\n\n';
  } else {
    report += '✅ **No critical issues** - workflow healthy\n\n';
  }

  // Workflow Metrics
  report += '## Workflow Metrics\n\n';
  report += `- **Duration**: ${formatDuration(duration)}\n\n`;

  // Recommendations
  report += '## 💡 Recommendations\n\n';

  if (issues.critical > 0) {
    report += '1. **Fix critical issues** before proceeding\n';
    report += '2. Review error logs and step outputs\n';
  }

  if (completionRate < 100) {
    report += '3. Complete remaining workflow steps\n';
  }

  if (gitStatus.modifiedFiles > 0 || gitStatus.stagedFiles > 0) {
    report += '4. Review and commit changes\n';
  }

  if (changeImpact === 'high') {
    report += '5. Run comprehensive test suite\n';
    report += '6. Perform manual validation of critical changes\n';
  }

  report += '\n';

  return report;
}

// ============================================================================
// STEP 11 ANALYZER - Integration
// ============================================================================

/**
 * Step 11 analyzer for context analysis
 */
export class Step11ContextAnalyzer {
  constructor(options = {}) {
    this.fileOps = options.fileOps || new FileOperations();
    this.backlog = options.backlog || new Backlog();
    this.git = options.git || new GitAutomation();
    this.startTime = options.startTime || Date.now();
  }

  /**
   * Execute Step 11 context analysis
   * @param {string} projectRoot - Project root directory
   * @param {Object} workflowContext - Workflow context
   * @returns {Promise<Object>} Analysis result
   */
  async execute(projectRoot, workflowContext = {}) {
    try {
      logger.info('Step 11: Context Analysis');

      // Phase 1: Analyze workflow completion
      const { completedSteps = 0, totalSteps = 11 } = workflowContext;
      const completionRate = calculateCompletionRate(completedSteps, totalSteps);
      const completionStatus = determineCompletionStatus(completionRate);

      logger.info(`Workflow completion: ${completionRate}% (${completedSteps}/${totalSteps})`);

      // Phase 2: Analyze git repository state
      const gitStatus = await this.analyzeGitStatus(projectRoot);

      if (gitStatus.isGitRepo) {
        logger.info(
          `Git state: ${gitStatus.modifiedFiles} modified, ${gitStatus.stagedFiles} staged`
        );
      }

      // Phase 3: Calculate change impact
      const changes = {
        modifiedFiles: gitStatus.modifiedFiles || 0,
        dependenciesModified: await this.checkDependenciesModified(projectRoot),
        scriptsModified: await this.checkScriptsModified(projectRoot),
        configModified: await this.checkConfigModified(projectRoot),
      };

      const impactScore = calculateImpactScore(changes);
      const changeImpact = determineImpactLevel(impactScore);

      logger.info(`Change impact: ${changeImpact} (score: ${impactScore})`);

      // Phase 4: Aggregate issues
      const stepResults = workflowContext.stepResults || [];
      const issues = aggregateIssues(stepResults);

      logger.info(`Issues: ${issues.total} total, ${issues.critical} critical`);

      // Phase 5: Calculate workflow metrics
      const endTime = Date.now();
      const duration = calculateDuration(this.startTime, endTime);

      logger.info(`Workflow duration: ${formatDuration(duration)}`);

      // Phase 6: Generate report
      const contextData = {
        completionRate,
        completionStatus,
        completedSteps,
        totalSteps,
        gitStatus,
        changeImpact,
        impactScore,
        issues,
        duration,
      };

      const report = formatContextReport(contextData);
      await this.backlog.saveStepSummary(11, 'Context Analysis', report);

      const success = issues.critical === 0;

      if (success) {
        logger.success('Step 11 completed - workflow context analyzed!');
      } else {
        logger.warn('Step 11 completed with critical issues');
      }

      return {
        success,
        ...contextData,
      };
    } catch (error) {
      logger.error(`Step 11 failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Analyze git repository status
   * @param {string} projectRoot - Project root directory
   * @returns {Promise<Object>} Git status
   */
  async analyzeGitStatus(projectRoot) {
    try {
      const isGitRepo = await this.git.isRepository(projectRoot);

      if (!isGitRepo) {
        return { isGitRepo: false };
      }

      const status = await this.git.status(projectRoot);

      return {
        isGitRepo: true,
        branch: status.branch || 'unknown',
        modifiedFiles: status.modified?.length || 0,
        untrackedFiles: status.untracked?.length || 0,
        stagedFiles: status.staged?.length || 0,
        commitsAhead: status.ahead || 0,
      };
    } catch {
      return { isGitRepo: false };
    }
  }

  /**
   * Check if dependencies were modified
   * @param {string} projectRoot - Project root directory
   * @returns {Promise<boolean>} True if dependencies modified
   */
  async checkDependenciesModified(projectRoot) {
    try {
      const status = await this.git.status(projectRoot);
      const allFiles = [
        ...(status.modified || []),
        ...(status.staged || []),
        ...(status.untracked || []),
      ];

      return allFiles.some(
        (file) =>
          file.includes('package.json') ||
          file.includes('requirements.txt') ||
          file.includes('go.mod') ||
          file.includes('Cargo.toml')
      );
    } catch {
      return false;
    }
  }

  /**
   * Check if scripts were modified
   * @param {string} projectRoot - Project root directory
   * @returns {Promise<boolean>} True if scripts modified
   */
  async checkScriptsModified(projectRoot) {
    try {
      const status = await this.git.status(projectRoot);
      const allFiles = [
        ...(status.modified || []),
        ...(status.staged || []),
        ...(status.untracked || []),
      ];

      return allFiles.some((file) => file.endsWith('.sh') || file.includes('scripts/'));
    } catch {
      return false;
    }
  }

  /**
   * Check if config files were modified
   * @param {string} projectRoot - Project root directory
   * @returns {Promise<boolean>} True if config modified
   */
  async checkConfigModified(projectRoot) {
    try {
      const status = await this.git.status(projectRoot);
      const allFiles = [
        ...(status.modified || []),
        ...(status.staged || []),
        ...(status.untracked || []),
      ];

      return allFiles.some(
        (file) =>
          file.endsWith('.yaml') ||
          file.endsWith('.yml') ||
          file.endsWith('.json') ||
          file.endsWith('.toml') ||
          file.includes('.config')
      );
    } catch {
      return false;
    }
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default Step11ContextAnalyzer;
