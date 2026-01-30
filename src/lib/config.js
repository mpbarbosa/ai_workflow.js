/**
 * Workflow Configuration Module
 * Purpose: Central configuration and constants for workflow automation
 * Part of: AI Workflow Automation v1.0.0
 */

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Configuration class for workflow automation
 */
export class Config {
  /**
   * Initialize configuration
   * @param {string} projectRoot - Project root directory
   */
  constructor(projectRoot = null) {
    // Auto-detect project root if not provided
    if (!projectRoot) {
      // Default: go up from src/lib/ to project root
      this.projectRoot = path.resolve(__dirname, '../..');
    } else {
      this.projectRoot = path.resolve(projectRoot);
    }

    // Script metadata
    this.scriptVersion = '1.0.0';
    this.scriptName = 'AI Workflow Automation';

    // Workflow tracking
    this.workflowRunId = `workflow_${this._generateTimestamp()}`;

    // Initialize directory paths (needs workflowRunId)
    this._initializePaths();

    this.totalSteps = 15; // 0-14
    this.dryRun = false;
    this.interactiveMode = true;
    this.autoMode = false;
    this.workflowStartTime = Date.now();

    // Analysis variables (populated during execution)
    this.analysisCommits = '';
    this.analysisModified = '';
    this.changeScope = '';

    // Workflow status tracking
    this.workflowStatus = new Map();

    // Temporary files tracking for cleanup
    this.tempFiles = [];
  }

  /**
   * Initialize directory paths relative to project root
   * @private
   */
  _initializePaths() {
    this.srcDir = path.join(this.projectRoot, 'src');
    this.docsDir = path.join(this.projectRoot, 'docs');

    // AI workflow artifact directories
    this.artifactDir = path.join(this.projectRoot, '.ai_workflow');
    this.backlogDir = path.join(this.artifactDir, 'backlog');
    this.summariesDir = path.join(this.artifactDir, 'summaries');
    this.logsDir = path.join(this.artifactDir, 'logs');
    this.metricsDir = path.join(this.artifactDir, 'metrics');
    this.checkpointsDir = path.join(this.artifactDir, 'checkpoints');
    this.promptsDir = path.join(this.artifactDir, 'prompts');

    // Run-specific directories (created per workflow execution)
    this.backlogRunDir = path.join(this.backlogDir, this.workflowRunId);
    this.summariesRunDir = path.join(this.summariesDir, this.workflowRunId);
    this.logsRunDir = path.join(this.logsDir, this.workflowRunId);
  }

  /**
   * Generate timestamp for workflow run ID
   * @returns {string} Timestamp in format YYYYMMDD_HHMMSS
   * @private
   */
  _generateTimestamp() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `${year}${month}${day}_${hours}${minutes}${seconds}`;
  }

  /**
   * Get all directory paths as an object
   * @returns {Object} Directory paths
   */
  getPaths() {
    return {
      projectRoot: this.projectRoot,
      srcDir: this.srcDir,
      docsDir: this.docsDir,
      artifactDir: this.artifactDir,
      backlogDir: this.backlogDir,
      summariesDir: this.summariesDir,
      logsDir: this.logsDir,
      metricsDir: this.metricsDir,
      checkpointsDir: this.checkpointsDir,
      promptsDir: this.promptsDir,
      backlogRunDir: this.backlogRunDir,
      summariesRunDir: this.summariesRunDir,
      logsRunDir: this.logsRunDir,
    };
  }

  /**
   * Get workflow metadata
   * @returns {Object} Workflow metadata
   */
  getMetadata() {
    return {
      scriptVersion: this.scriptVersion,
      scriptName: this.scriptName,
      workflowRunId: this.workflowRunId,
      totalSteps: this.totalSteps,
      workflowStartTime: this.workflowStartTime,
    };
  }

  /**
   * Set workflow execution mode
   * @param {Object} options - Execution mode options
   * @param {boolean} options.dryRun - Dry run mode
   * @param {boolean} options.interactive - Interactive mode
   * @param {boolean} options.auto - Auto mode
   */
  setExecutionMode({ dryRun, interactive, auto }) {
    if (dryRun !== undefined) this.dryRun = dryRun;
    if (interactive !== undefined) this.interactiveMode = interactive;
    if (auto !== undefined) this.autoMode = auto;
  }

  /**
   * Get workflow execution mode
   * @returns {Object} Execution mode settings
   */
  getExecutionMode() {
    return {
      dryRun: this.dryRun,
      interactive: this.interactiveMode,
      auto: this.autoMode,
    };
  }

  /**
   * Set analysis context (commits, modified files, change scope)
   * @param {Object} context - Analysis context
   * @param {string} context.commits - Commit range or SHA
   * @param {string} context.modified - Modified files
   * @param {string} context.changeScope - Change scope (docs|code|mixed|full)
   */
  setAnalysisContext({ commits, modified, changeScope }) {
    if (commits !== undefined) this.analysisCommits = commits;
    if (modified !== undefined) this.analysisModified = modified;
    if (changeScope !== undefined) this.changeScope = changeScope;
  }

  /**
   * Get analysis context
   * @returns {Object} Analysis context
   */
  getAnalysisContext() {
    return {
      commits: this.analysisCommits,
      modified: this.analysisModified,
      changeScope: this.changeScope,
    };
  }

  /**
   * Track temporary file for cleanup
   * @param {string} filePath - Path to temporary file
   */
  trackTempFile(filePath) {
    this.tempFiles.push(filePath);
  }

  /**
   * Get list of temporary files
   * @returns {Array<string>} Temporary file paths
   */
  getTempFiles() {
    return [...this.tempFiles];
  }

  /**
   * Update workflow status for a step
   * @param {number} stepNumber - Step number
   * @param {string} status - Step status (pending|running|passed|failed|skipped)
   * @param {Object} metadata - Additional metadata
   */
  updateStepStatus(stepNumber, status, metadata = {}) {
    this.workflowStatus.set(stepNumber, {
      status,
      timestamp: Date.now(),
      ...metadata,
    });
  }

  /**
   * Get workflow status for a step
   * @param {number} stepNumber - Step number
   * @returns {Object|null} Step status object or null
   */
  getStepStatus(stepNumber) {
    return this.workflowStatus.get(stepNumber) || null;
  }

  /**
   * Get all workflow status
   * @returns {Map} All step statuses
   */
  getAllStatus() {
    return new Map(this.workflowStatus);
  }

  /**
   * Get workflow elapsed time in milliseconds
   * @returns {number} Elapsed time
   */
  getElapsedTime() {
    return Date.now() - this.workflowStartTime;
  }

  /**
   * Export configuration as plain object (for serialization)
   * @returns {Object} Configuration object
   */
  toJSON() {
    return {
      metadata: this.getMetadata(),
      paths: this.getPaths(),
      executionMode: this.getExecutionMode(),
      analysisContext: this.getAnalysisContext(),
      workflowStatus: Object.fromEntries(this.workflowStatus),
      elapsedTime: this.getElapsedTime(),
    };
  }
}

/**
 * Create and export a singleton config instance
 * Can be overridden by creating a new Config instance
 */
export const config = new Config();

export default config;
