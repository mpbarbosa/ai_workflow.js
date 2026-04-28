/**
 * Step 02_5: Documentation Optimization
 * Main orchestrator for the documentation optimization workflow
 * Version: 2.0.0
 * Architecture: Referential transparency (pure functions + impure wrapper)
 */

import { STEP_KIND } from './step_contract.js';
import path from 'path';
import { FileOperations } from '../lib/file_operations.js';
import { HeuristicsAnalyzer } from './step_02_5_lib/heuristics.js';
import { GitAnalyzer } from './step_02_5_lib/git_analysis.js';
import { VersionAnalyzer } from './step_02_5_lib/version_analysis.js';
import { ConsolidationManager } from './step_02_5_lib/consolidation.js';
import { ReportingManager } from './step_02_5_lib/reporting.js';
import defaultLogger from '../core/logger.js';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Default configuration
 */
export const DEFAULT_CONFIG = {
  docsDir: 'docs',
  archiveDir: '.ai_workflow/archive/docs',
  outdatedThresholdMonths: 12,
  similarityThreshold: 0.8,
  confidenceAuto: 0.9,
  confidenceAi: 0.5,
  dryRun: false,
  interactive: true,
  minFiles: 5,
  excludePatterns: ['CHANGELOG.md', 'LICENSE*', 'CONTRIBUTING.md', 'CODE_OF_CONDUCT.md'],
  // Maximum files to archive in a single run without AI validation.
  // If the candidate set exceeds this and no AI analyzer is available, archival is skipped.
  maxOutdatedArchivalWithoutAI: 50,
};

/**
 * Workflow phases
 */
export const PHASES = {
  HEURISTICS: 'heuristics',
  GIT_HISTORY: 'git_history',
  VERSION_ANALYSIS: 'version_analysis',
  AI_EDGE_CASES: 'ai_edge_cases',
  SUMMARY: 'summary',
  OPTIMIZATION: 'optimization',
  REPORTING: 'reporting',
};

// ============================================================================
// PURE FUNCTIONS - Configuration
// ============================================================================

/**
 * Merge user config with defaults
 * @param {Object} userConfig - User configuration
 * @returns {Object} - Merged configuration
 */
export function mergeConfig(userConfig = {}) {
  return {
    ...DEFAULT_CONFIG,
    ...userConfig,
    excludePatterns: [...DEFAULT_CONFIG.excludePatterns, ...(userConfig.excludePatterns || [])],
  };
}

/**
 * Validate configuration
 * @param {Object} config - Configuration to validate
 * @returns {Object} - {valid: boolean, errors: Array<string>}
 */
export function validateConfig(config) {
  const errors = [];

  if (!config.docsDir || typeof config.docsDir !== 'string') {
    errors.push('docsDir must be a non-empty string');
  }

  if (config.similarityThreshold < 0 || config.similarityThreshold > 1) {
    errors.push('similarityThreshold must be between 0 and 1');
  }

  if (config.outdatedThresholdMonths < 0) {
    errors.push('outdatedThresholdMonths must be non-negative');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================================================================
// PURE FUNCTIONS - Workflow State
// ============================================================================

/**
 * Create initial workflow state
 * @param {Object} config - Configuration
 * @returns {Object} - Initial state
 */
export function createInitialState(config) {
  return {
    config,
    phase: null,
    files: [],
    exactDuplicates: [],
    redundantPairs: [],
    outdatedFiles: [],
    edgeCases: [],
    errors: [],
    startTime: null,
    endTime: null,
  };
}

/**
 * Update workflow state
 * @param {Object} state - Current state
 * @param {Object} updates - Updates to apply
 * @returns {Object} - New state (immutable)
 */
export function updateState(state, updates) {
  return { ...state, ...updates };
}

// ============================================================================
// PURE FUNCTIONS - Result Aggregation
// ============================================================================

/**
 * Aggregate optimization results
 * @param {Object} state - Workflow state
 * @returns {Object} - Aggregated results
 */
export function aggregateResults(state) {
  return {
    totalFiles: state.files.length,
    exactDuplicates: state.exactDuplicates,
    redundantPairs: state.redundantPairs,
    outdatedFiles: state.outdatedFiles,
    edgeCases: state.edgeCases,
    filesOptimized: state.exactDuplicates.length + state.outdatedFiles.length,
    errors: state.errors,
  };
}

/**
 * Calculate execution time
 * @param {number} startTime - Start timestamp (ms)
 * @param {number} endTime - End timestamp (ms)
 * @returns {number} - Execution time in seconds
 */
export function calculateExecutionTime(startTime, endTime) {
  return Math.round((endTime - startTime) / 1000);
}

// ============================================================================
// DOCUMENTATION OPTIMIZER - Impure Wrapper Class
// ============================================================================

/**
 * Main orchestrator for documentation optimization workflow
 * Coordinates all submodules and manages workflow execution
 */
export class DocumentationOptimizer {
  static stepKind = STEP_KIND.PROJECT;

  constructor(options = {}) {
    this.logger = options.logger || defaultLogger;

    const fileOps = options.fileOps || new FileOperations({ logger: this.logger });
    const gitAutomation = options.gitOps || options.gitAutomation;

    this.fileOps = fileOps;
    this.heuristics =
      options.heuristics || new HeuristicsAnalyzer({ logger: this.logger, fileOps });
    this.gitAnalyzer =
      options.gitAnalyzer || new GitAnalyzer({ gitAutomation, fileOps, logger: this.logger });
    this.versionAnalyzer =
      options.versionAnalyzer || new VersionAnalyzer({ fileOps, logger: this.logger });
    this.consolidation =
      options.consolidation || new ConsolidationManager({ fileOps, logger: this.logger });
    this.reporting = options.reporting || new ReportingManager({ fileOps, logger: this.logger });
    this.aiAnalyzer = options.aiAnalyzer || null; // optional

    this.state = null;
  }

  /**
   * Initialize workflow with configuration
   * @param {Object} userConfig - User configuration
   * @returns {Object} - Validation result
   */
  initialize(userConfig = {}) {
    const config = mergeConfig(userConfig);
    const validation = validateConfig(config);

    if (!validation.valid) {
      this.logger.error('Configuration validation failed:', validation.errors);
      return validation;
    }

    this.state = createInitialState(config);

    // Resolve archiveDir to absolute — FileOperations requires absolute paths
    const projectRoot = config.projectRoot || process.cwd();
    this.consolidation.archiveRoot = path.isAbsolute(config.archiveDir)
      ? config.archiveDir
      : path.join(projectRoot, config.archiveDir);

    this.logger.info('Documentation optimization initialized');
    return validation;
  }

  /**
   * Check if documentation directory exists and has enough files
   * @returns {Promise<Object>} - {skip: boolean, reason?: string}
   */
  async shouldSkip() {
    const { docsDir, minFiles, projectRoot } = this.state.config;
    const absDocsDir = projectRoot ? path.join(projectRoot, docsDir) : docsDir;

    // Check if directory exists
    const exists = await this.fileOps.exists(absDocsDir);
    if (!exists) {
      return { skip: true, reason: `Documentation directory not found: ${docsDir}` };
    }

    // Count markdown files
    const files = await this.fileOps.listDirectoryRecursive(absDocsDir, {
      extensions: ['.md'],
    });
    this.state = updateState(this.state, { files });

    if (files.length < minFiles) {
      return {
        skip: true,
        reason: `Documentation base too small (${files.length} files, minimum ${minFiles})`,
      };
    }

    return { skip: false };
  }

  /**
   * Phase 1: Heuristics analysis
   * @returns {Promise<void>}
   */
  async runHeuristicsAnalysis() {
    this.logger.info(`Phase 1: Heuristics Analysis (${this.state.files.length} files)`);
    this.state = updateState(this.state, { phase: PHASES.HEURISTICS });

    try {
      const { exactDuplicates, redundantPairs } = await this.heuristics.analyzeDocuments(
        this.state.files,
        this.state.config.similarityThreshold
      );

      this.state = updateState(this.state, { exactDuplicates, redundantPairs });
      this.logger.info(
        `Found ${exactDuplicates.length} exact duplicates, ${redundantPairs.length} redundant pairs`
      );
    } catch (error) {
      this.logger.error(`Heuristics analysis failed: ${error.message}`);
      this.state.errors.push({ phase: PHASES.HEURISTICS, error: error.message });
      throw error;
    }
  }

  /**
   * Phase 2: Git history analysis
   * @returns {Promise<void>}
   */
  async runGitHistoryAnalysis() {
    this.logger.info('Phase 2: Git History Analysis');
    this.state = updateState(this.state, { phase: PHASES.GIT_HISTORY });

    try {
      const { outdatedFiles } = await this.gitAnalyzer.analyzeDocuments(
        this.state.files,
        this.state.config.outdatedThresholdMonths
      );

      this.state = updateState(this.state, { outdatedFiles });
      this.logger.info(`Found ${outdatedFiles.length} outdated files`);
    } catch (error) {
      this.logger.warn(`Git history analysis failed (non-fatal): ${error.message}`);
      this.state.errors.push({ phase: PHASES.GIT_HISTORY, error: error.message });
    }
  }

  /**
   * Phase 3: Version reference analysis
   * @returns {Promise<void>}
   */
  async runVersionAnalysis() {
    this.logger.info('Phase 3: Version Reference Analysis');
    this.state = updateState(this.state, { phase: PHASES.VERSION_ANALYSIS });

    try {
      // Ensure the analyzer knows the actual project version before scanning.
      // It defaults to '0.0.0' which makes every comparison a no-op.
      if (this.versionAnalyzer.currentVersion === '0.0.0') {
        const projectRoot = this.state.config.projectRoot || process.cwd();
        const detected = await this.versionAnalyzer.detectProjectVersion(projectRoot);
        this.versionAnalyzer.currentVersion = detected;
      }

      const { outdatedFiles } = await this.versionAnalyzer.analyzeDocuments(this.state.files);

      // Merge with existing outdated files (union)
      const allOutdated = [...new Set([...this.state.outdatedFiles, ...outdatedFiles])];
      this.state = updateState(this.state, { outdatedFiles: allOutdated });

      this.logger.info(`Version analysis complete (${allOutdated.length} total outdated)`);
    } catch (error) {
      this.logger.warn(`Version analysis failed (non-fatal): ${error.message}`);
      this.state.errors.push({ phase: PHASES.VERSION_ANALYSIS, error: error.message });
    }
  }

  /**
   * Phase 4: AI edge case analysis
   * @returns {Promise<void>}
   */
  async runAiEdgeCaseAnalysis() {
    if (!this.aiAnalyzer) {
      this.logger.info('Phase 4: AI Edge Case Analysis (skipped - no AI analyzer)');
      return;
    }

    if (this.state.redundantPairs.length === 0) {
      this.logger.info('Phase 4: AI Edge Case Analysis (skipped - no redundant pairs)');
      return;
    }

    this.logger.info('Phase 4: AI Edge Case Analysis');
    this.state = updateState(this.state, { phase: PHASES.AI_EDGE_CASES });

    try {
      const { results, summary } = await this.aiAnalyzer.analyzeEdgeCases(
        this.state.redundantPairs
      );

      // Update redundant pairs with AI-adjusted confidence scores
      const updatedPairs = this.state.redundantPairs.map((pair) => {
        const aiResult = results.find((r) => r.pair === pair);
        if (aiResult && !aiResult.error) {
          return { ...pair, similarity: aiResult.updatedScore, aiAnalyzed: true };
        }
        return pair;
      });

      this.state = updateState(this.state, { redundantPairs: updatedPairs, edgeCases: results });
      this.logger.info(
        `AI analysis: ${summary.promoted} promoted, ${summary.demoted} demoted, ${summary.errors} errors`
      );
    } catch (error) {
      this.logger.warn(`AI edge case analysis failed (non-fatal): ${error.message}`);
      this.state.errors.push({ phase: PHASES.AI_EDGE_CASES, error: error.message });
    }
  }

  /**
   * Phase 5: Display summary
   * @returns {Object} - Summary data
   */
  displaySummary() {
    this.logger.info('Phase 5: Optimization Summary');
    this.state = updateState(this.state, { phase: PHASES.SUMMARY });

    const summary = aggregateResults(this.state);

    this.logger.info(`
📊 Analysis Results:
───────────────────
  Total files analyzed: ${summary.totalFiles}
  Exact duplicates: ${summary.exactDuplicates.length}
  Redundant pairs: ${summary.redundantPairs.length}
  Outdated files: ${summary.outdatedFiles.length}
  Files to optimize: ${summary.filesOptimized}
`);

    return summary;
  }

  /**
   * Phase 6: Execute optimizations
   * @returns {Promise<Object>} - Optimization results
   */
  async executeOptimizations() {
    if (this.state.config.dryRun) {
      this.logger.info('Phase 6: Applying Optimizations (DRY RUN)');
    } else {
      this.logger.info('Phase 6: Applying Optimizations');
    }

    this.state = updateState(this.state, { phase: PHASES.OPTIMIZATION });

    const timestamp = this.consolidation.generateTimestamp();

    try {
      // Group exact duplicates by hash
      const duplicateGroups = this.groupDuplicatesByHash(this.state.exactDuplicates);

      // Consolidate duplicates
      const consolidationResult = await this.consolidation.consolidateDuplicates(
        duplicateGroups,
        timestamp
      );

      // Archive outdated files
      const archiveResult = await this.consolidation.archiveOutdatedFiles(
        this.state.outdatedFiles,
        timestamp
      );

      return {
        consolidation: consolidationResult,
        archive: archiveResult,
        timestamp,
      };
    } catch (error) {
      this.logger.error(`Optimization execution failed: ${error.message}`);
      this.state.errors.push({ phase: PHASES.OPTIMIZATION, error: error.message });
      throw error;
    }
  }

  /**
   * Phase 7: Generate report
   * @param {Object} optimizationResults - Results from executeOptimizations
   * @returns {Promise<Object>} - Report result
   */
  async generateReport(optimizationResults) {
    this.logger.info('Phase 7: Generating Report');
    this.state = updateState(this.state, { phase: PHASES.REPORTING });

    const archiveRoot = path.resolve(this.consolidation.archiveRoot);
    const reportPath = path.join(
      archiveRoot,
      optimizationResults.timestamp,
      'optimization_report.md'
    );

    const reportData = {
      totalFiles: this.state.files.length,
      exactDuplicates: this.state.exactDuplicates,
      redundantPairs: this.state.redundantPairs,
      outdatedFiles: this.state.outdatedFiles,
      archivedFiles: [
        ...optimizationResults.consolidation.archived,
        ...optimizationResults.archive.archived,
      ],
      beforeSize: 0, // Would need to calculate from file sizes
      afterSize: 0, // Would need to calculate from file sizes
      archiveDir: path.join(this.consolidation.archiveRoot, optimizationResults.timestamp),
    };

    return await this.reporting.generateAndDisplay(reportData, reportPath);
  }

  /**
   * Run complete optimization workflow
   * @param {Object} userConfig - User configuration
   * @returns {Promise<Object>} - Workflow result
   */
  async run(userConfig = {}) {
    const startTime = Date.now();

    // Initialize
    const validation = this.initialize(userConfig);
    if (!validation.valid) {
      return { success: false, errors: validation.errors };
    }

    this.state = updateState(this.state, { startTime });

    this.logger.step('Step 2.5: Documentation Optimization');

    try {
      // Check if should skip
      const skipCheck = await this.shouldSkip();
      if (skipCheck.skip) {
        this.logger.info(skipCheck.reason);
        return { success: true, skipped: true, reason: skipCheck.reason };
      }

      // Run analysis phases
      await this.runHeuristicsAnalysis();
      await this.runGitHistoryAnalysis();
      await this.runVersionAnalysis();
      await this.runAiEdgeCaseAnalysis();

      // Display summary
      const summary = this.displaySummary();

      // Execute optimizations (if not dry-run)
      let optimizationResults = null;
      let reportResult = null;

      if (summary.filesOptimized > 0) {
        const maxWithoutAI = this.state.config.maxOutdatedArchivalWithoutAI;
        const outdatedCount = this.state.outdatedFiles.length;
        if (!this.aiAnalyzer && outdatedCount > maxWithoutAI) {
          this.logger.warn(
            `⚠ Archival skipped: ${outdatedCount} outdated files identified but no AI analyzer ` +
              `is available to validate them. Only ${maxWithoutAI} files may be archived ` +
              `without AI review (maxOutdatedArchivalWithoutAI). ` +
              `Provide an AI analyzer or lower the candidate count before re-running.`
          );
          this.state.errors.push({
            phase: PHASES.OPTIMIZATION,
            error: `Archival blocked: ${outdatedCount} candidates exceed maxOutdatedArchivalWithoutAI (${maxWithoutAI}) and no AI analyzer is configured.`,
          });
        } else {
          optimizationResults = await this.executeOptimizations();
          reportResult = await this.generateReport(optimizationResults);
        }
      } else {
        this.logger.info('No optimizations needed');
      }

      // Finalize
      const endTime = Date.now();
      this.state = updateState(this.state, { endTime });

      const executionTime = calculateExecutionTime(startTime, endTime);
      this.logger.info(`✓ Workflow complete (${executionTime}s)`);

      return {
        success: true,
        summary,
        optimizationResults,
        reportResult,
        executionTime,
        errors: this.state.errors,
      };
    } catch (error) {
      const endTime = Date.now();
      this.state = updateState(this.state, { endTime });

      this.logger.error(`✗ Workflow failed: ${error.message}`);

      return {
        success: false,
        error: error.message,
        errors: this.state.errors,
        executionTime: calculateExecutionTime(startTime, endTime),
      };
    }
  }

  /**
   * Helper: Group exact duplicates by content hash
   * @param {Array<Array<string>>} duplicates - Duplicate file groups (already grouped by heuristics)
   * @returns {Array<Array<string>>} - Grouped duplicates
   */
  groupDuplicatesByHash(duplicates) {
    // exactDuplicates from heuristics is already Array<Array<string>> (groups of duplicate files)
    return duplicates.length > 0 ? duplicates : [];
  }

  /**
   * Execute step (orchestrator interface)
   * @param {string} projectRoot - Project root directory
   * @returns {Promise<Object>} - Step result
   */
  async execute(projectRoot) {
    return this.run({ projectRoot });
  }

  /**
   * Get current workflow state
   * @returns {Object} - Current state
   */
  getState() {
    return this.state;
  }
}
