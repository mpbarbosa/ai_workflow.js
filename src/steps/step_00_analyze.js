/**
 * @fileoverview Step 0: Pre-Analysis (v2.0.0)
 * @module steps/step_00_analyze
 *
 * Analyzes git state and captures change context before workflow execution.
 * Detects project kind, tech stack, change scope, and validates test infrastructure.
 *
 * Architecture: v2.0.0 Referential Transparency
 * - Pure functions for analysis logic
 * - Impure wrapper class for git operations and I/O
 *
 * **Source**: Migrated from ai_workflow v3.2.7 `step_00_analyze.sh`
 *
 * @version 2.0.0
 * @since 2026-02-08
 */

import { logger } from '../core/logger.js';

/**
 * Change scope classifications
 * @constant
 */
export const CHANGE_SCOPE = {
  DOCUMENTATION_ONLY: 'documentation-only',
  TESTS_ONLY: 'tests-only',
  SOURCE_CODE: 'source-code',
  CONFIGURATION: 'configuration',
  FULL_STACK: 'full-stack',
  CODE_AND_TESTS: 'code-and-tests',
  CODE_AND_DOCS: 'code-and-docs',
  MIXED_CHANGES: 'mixed-changes',
  NO_CHANGES: 'no-changes',
};

/**
 * File categories for classification
 * @constant
 */
export const FILE_CATEGORY = {
  DOCUMENTATION: 'documentation',
  TEST: 'test',
  SOURCE: 'source',
  CONFIG: 'config',
  WORKFLOW_ARTIFACT: 'workflow_artifact',
};

// ============================================================================
// PURE FUNCTIONS - File Classification
// ============================================================================

/**
 * Classify file by category
 * @pure
 * @param {string} filePath - File path to classify
 * @returns {string} Category from FILE_CATEGORY
 */
export function classifyFile(filePath) {
  // Skip workflow artifacts
  if (
    filePath.startsWith('.ai_workflow/') ||
    /^src\/workflow\/(backlog|logs|summaries|metrics|\.checkpoints|\.ai_cache)\//.test(filePath)
  ) {
    return FILE_CATEGORY.WORKFLOW_ARTIFACT;
  }

  // Documentation files
  if (
    filePath.startsWith('docs/') ||
    filePath === 'README.md' ||
    filePath === 'CHANGELOG.md' ||
    filePath.endsWith('.md')
  ) {
    return FILE_CATEGORY.DOCUMENTATION;
  }

  // Test files
  if (
    /^tests?\//.test(filePath) ||
    /^test\//.test(filePath) ||
    /test.*\.(sh|js|py|go|rb|ts|tsx)$/.test(filePath) ||
    /_test\.(sh|js|py|go|rb|ts|tsx)$/.test(filePath) ||
    /\.test\.(sh|js|py|go|rb|ts|tsx)$/.test(filePath) ||
    /\.spec\.(sh|js|py|go|rb|ts|tsx)$/.test(filePath)
  ) {
    return FILE_CATEGORY.TEST;
  }

  // Configuration files
  if (/\.(yaml|yml|json|toml|ini|conf|config)$/.test(filePath)) {
    return FILE_CATEGORY.CONFIG;
  }

  // Source code files
  if (
    filePath.startsWith('src/') ||
    filePath.startsWith('lib/') ||
    /\.(sh|js|py|go|rb|java|rs|ts|tsx|c|cpp|h|hpp)$/.test(filePath)
  ) {
    return FILE_CATEGORY.SOURCE;
  }

  return FILE_CATEGORY.CONFIG; // Default to config for unclassified files
}

/**
 * Classify multiple files and count by category
 * @pure
 * @param {Array<string>} files - List of file paths
 * @returns {Object} Count by category and categorized file lists
 */
export function classifyFiles(files) {
  const counts = {
    [FILE_CATEGORY.DOCUMENTATION]: 0,
    [FILE_CATEGORY.TEST]: 0,
    [FILE_CATEGORY.SOURCE]: 0,
    [FILE_CATEGORY.CONFIG]: 0,
    [FILE_CATEGORY.WORKFLOW_ARTIFACT]: 0,
  };

  const categorizedFiles = {
    [FILE_CATEGORY.DOCUMENTATION]: [],
    [FILE_CATEGORY.TEST]: [],
    [FILE_CATEGORY.SOURCE]: [],
    [FILE_CATEGORY.CONFIG]: [],
    [FILE_CATEGORY.WORKFLOW_ARTIFACT]: [],
  };

  for (const file of files) {
    const category = classifyFile(file);
    if (category !== FILE_CATEGORY.WORKFLOW_ARTIFACT) {
      counts[category]++;
      categorizedFiles[category].push(file);
    }
  }

  return { counts, categorizedFiles };
}

// ============================================================================
// PURE FUNCTIONS - Change Scope Detection
// ============================================================================

/**
 * Determine change scope based on file counts
 * @pure
 * @param {Object} counts - File counts by category
 * @param {number} totalModified - Total modified files
 * @returns {string} Change scope from CHANGE_SCOPE
 */
export function determineChangeScope(counts, totalModified) {
  const { documentation: docs = 0, test: tests = 0, source: src = 0, config: cfg = 0 } = counts;

  // No changes
  if (totalModified === 0) {
    return CHANGE_SCOPE.NO_CHANGES;
  }

  // Documentation only
  if (docs > 0 && tests === 0 && src === 0 && cfg === 0) {
    return CHANGE_SCOPE.DOCUMENTATION_ONLY;
  }

  // Tests only
  if (tests > 0 && docs === 0 && src === 0 && cfg === 0) {
    return CHANGE_SCOPE.TESTS_ONLY;
  }

  // Source code only
  if (src > 0 && tests === 0 && docs === 0 && cfg === 0) {
    return CHANGE_SCOPE.SOURCE_CODE;
  }

  // Configuration only
  if (cfg > 0 && src === 0 && tests === 0 && docs === 0) {
    return CHANGE_SCOPE.CONFIGURATION;
  }

  // Full stack (code + tests + docs)
  if (src > 0 && tests > 0 && docs > 0) {
    return CHANGE_SCOPE.FULL_STACK;
  }

  // Code and tests
  if (src > 0 && tests > 0) {
    return CHANGE_SCOPE.CODE_AND_TESTS;
  }

  // Code and docs
  if (src > 0 && docs > 0) {
    return CHANGE_SCOPE.CODE_AND_DOCS;
  }

  // Mixed changes (any other combination)
  return CHANGE_SCOPE.MIXED_CHANGES;
}

// ============================================================================
// PURE FUNCTIONS - Analysis Result Formatting
// ============================================================================

/**
 * Format analysis result for display
 * @pure
 * @param {Object} analysis - Analysis result
 * @returns {string} Formatted summary
 */
export function formatAnalysisSummary(analysis) {
  const { commitsAhead, modifiedFiles, changeScope, fileCounts, projectKind, techStack } = analysis;

  let summary = `Pre-analysis complete:\n`;
  summary += `  • Commits ahead: ${commitsAhead}\n`;
  summary += `  • Modified files: ${modifiedFiles}\n`;
  summary += `  • Change scope: ${changeScope}\n`;

  if (fileCounts) {
    summary += `  • Documentation: ${fileCounts.documentation || 0} files\n`;
    summary += `  • Tests: ${fileCounts.test || 0} files\n`;
    summary += `  • Source: ${fileCounts.source || 0} files\n`;
    summary += `  • Config: ${fileCounts.config || 0} files\n`;
  }

  if (projectKind && projectKind.kind !== 'unknown') {
    summary += `  • Project kind: ${projectKind.description || projectKind.kind} (${projectKind.confidence}% confidence)\n`;
  }

  if (techStack && techStack.primaryLanguage) {
    summary += `  • Language: ${techStack.primaryLanguage}\n`;
    if (techStack.buildSystem) {
      summary += `  • Build system: ${techStack.buildSystem}\n`;
    }
    if (techStack.testFramework) {
      summary += `  • Test framework: ${techStack.testFramework}\n`;
    }
  }

  return summary;
}

/**
 * Create backlog entry content for Step 0
 * @pure
 * @param {Object} analysis - Analysis result
 * @param {string} gitStatus - Git status output
 * @returns {string} Markdown content for backlog
 */
export function createBacklogContent(analysis, gitStatus = '') {
  const {
    commitsAhead,
    modifiedFiles,
    changeScope,
    fileCounts,
    projectKind,
    techStack,
    smokeTest,
  } = analysis;

  let content = `### Repository Analysis

**Commits Ahead:** ${commitsAhead}
**Modified Files:** ${modifiedFiles}
**Change Scope:** ${changeScope}

#### File Breakdown
- Documentation: ${fileCounts?.documentation || 0}
- Tests: ${fileCounts?.test || 0}
- Source: ${fileCounts?.source || 0}
- Config: ${fileCounts?.config || 0}
`;

  if (techStack && techStack.primaryLanguage) {
    content += `
### Tech Stack

**Language:** ${techStack.primaryLanguage}
**Build System:** ${techStack.buildSystem || 'none'}
**Test Framework:** ${techStack.testFramework || 'none'}
**Package File:** ${techStack.packageFile || 'none'}
`;
  }

  if (projectKind && projectKind.kind !== 'unknown') {
    content += `
### Project Kind

**Type:** ${projectKind.description || projectKind.kind}
**Confidence:** ${projectKind.confidence}%
**Identifier:** ${projectKind.kind}
`;
  }

  if (smokeTest) {
    content += `
### Test Infrastructure Pre-Validation

**Status:** ${smokeTest.status}
**Details:** ${smokeTest.details}

This early validation helps catch test infrastructure issues before Step 7, potentially saving 30+ minutes of workflow execution time.
`;
  }

  if (gitStatus) {
    content += `
### Modified Files List

\`\`\`
${gitStatus}
\`\`\`
`;
  }

  return content;
}

// ============================================================================
// IMPURE WRAPPER - Step0Analyzer Class
// ============================================================================

/**
 * Step 0: Pre-Analysis Executor
 * Orchestrates git analysis, project detection, and context capture
 * @class
 */
export class Step0Analyzer {
  /**
   * Create Step0Analyzer instance
   * @param {Object} deps - Dependencies
   * @param {Object} deps.gitOps - GitAutomation instance
   * @param {Object} deps.projectDetection - ProjectKindDetection instance
   * @param {Object} deps.techStackDetection - TechStackDetection instance
   * @param {Object} deps.configManager - ConfigManager instance
   * @param {Object} deps.backlogManager - BacklogManager instance
   */
  constructor(deps = {}) {
    this.gitOps = deps.gitOps;
    this.projectDetection = deps.projectDetection;
    this.techStackDetection = deps.techStackDetection;
    this.configManager = deps.configManager;
    this.backlogManager = deps.backlogManager;
  }

  /**
   * Execute Step 0: Pre-Analysis
   * @async
   * @param {string} projectRoot - Project root directory
   * @returns {Promise<Object>} Analysis result
   */
  async execute(projectRoot) {
    try {
      logger.info('Step 0: Pre-Analysis - Analyzing Recent Changes');

      // Get git state
      const commitsAhead = await this.gitOps.getCommitsAhead();
      const modifiedFiles = await this.gitOps.getTotalChanges();
      const modifiedFilesList = await this.gitOps.getModifiedFiles();

      logger.info(`Commits ahead of remote: ${commitsAhead}`);
      logger.info(`Modified files: ${modifiedFiles}`);

      // Classify files
      const { counts, categorizedFiles } = classifyFiles(modifiedFilesList);

      // Determine change scope
      const changeScope = determineChangeScope(counts, modifiedFiles);

      // Project kind detection
      let projectKind = null;
      if (this.projectDetection) {
        // Try config first
        const configKind = await this.configManager.getProjectKind();
        if (configKind && configKind !== 'null') {
          projectKind = {
            kind: configKind,
            confidence: 100,
            source: 'config',
            description: await this.projectDetection.getKindDescription(configKind),
          };
          logger.success(`Project kind from config: ${projectKind.description} (configured)`);
        } else {
          // Auto-detect
          logger.info('No project kind in config, auto-detecting...');
          const detected = await this.projectDetection.detect(projectRoot);
          projectKind = {
            ...detected,
            source: 'auto-detected',
          };
          if (detected.kind !== 'unknown' && detected.confidence > 50) {
            logger.info(
              `Auto-detected project kind: ${detected.description} (${detected.confidence}% confidence)`
            );
          } else {
            logger.info('Project kind: Could not determine with confidence');
          }
        }
      }

      // Tech stack detection
      let techStack = null;
      if (this.techStackDetection) {
        techStack = await this.techStackDetection.detect(projectRoot);
        if (techStack.primaryLanguage) {
          logger.info(`Detected language: ${techStack.primaryLanguage}`);
          logger.info(`Build system: ${techStack.buildSystem || 'none'}`);
          logger.info(`Test framework: ${techStack.testFramework || 'none'}`);
        }
      }

      // Test infrastructure smoke test (TODO: Implement in future)
      const smokeTest = null;

      // Build analysis result
      const analysis = {
        commitsAhead,
        modifiedFiles,
        modifiedFilesList,
        changeScope,
        fileCounts: counts,
        categorizedFiles,
        projectKind,
        techStack,
        smokeTest,
        timestamp: Date.now(),
      };

      // Log summary
      const summary = formatAnalysisSummary(analysis);
      logger.success(summary);

      // Save to backlog
      if (this.backlogManager) {
        const gitStatus = await this.gitOps.getStatusOutput();
        const backlogContent = createBacklogContent(analysis, gitStatus);
        await this.backlogManager.saveStepIssues(0, 'Pre_Analysis', backlogContent);
        await this.backlogManager.saveStepSummary(
          0,
          'Pre_Analysis',
          `Analyzed ${modifiedFiles} modified files across ${commitsAhead} commits. Change scope: ${changeScope}.`,
          '✅'
        );
      }

      return {
        success: true,
        analysis,
      };
    } catch (error) {
      logger.error(`Step 0 failed: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get step metadata
   * @returns {Object} Step metadata
   */
  getMetadata() {
    return {
      id: 0,
      name: 'Pre-Analysis',
      description: 'Analyze git state and capture change context',
      category: 'analysis',
      estimatedDuration: 10, // seconds
      canSkip: false, // Never skip Step 0
      dependencies: [],
    };
  }
}

export default Step0Analyzer;
