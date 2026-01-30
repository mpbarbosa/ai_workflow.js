/**
 * Workflow Configuration Module (Pure Functions + Wrapper)
 * @version 2.0.0
 * @description Central configuration and constants with referential transparency
 * @module lib/config
 * Part of: AI Workflow Automation v1.0.0
 */

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * PURE FUNCTIONS - All referentially transparent
 */

/**
 * Generate timestamp string (PURE)
 * @param {Date} date - Date object to format
 * @returns {string} Timestamp in format YYYYMMDD_HHMMSS
 */
export function generateTimestamp(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}${month}${day}_${hours}${minutes}${seconds}`;
}

/**
 * Generate workflow run ID (PURE)
 * @param {string} timestamp - Formatted timestamp
 * @returns {string} Workflow run ID
 */
export function generateWorkflowRunId(timestamp) {
  return `workflow_${timestamp}`;
}

/**
 * Calculate all directory paths (PURE)
 * @param {string} projectRoot - Project root directory
 * @param {string} workflowRunId - Workflow run ID
 * @returns {Object} All directory paths
 */
export function calculatePaths(projectRoot, workflowRunId) {
  const srcDir = path.join(projectRoot, 'src');
  const docsDir = path.join(projectRoot, 'docs');

  // AI workflow artifact directories
  const artifactDir = path.join(projectRoot, '.ai_workflow');
  const backlogDir = path.join(artifactDir, 'backlog');
  const summariesDir = path.join(artifactDir, 'summaries');
  const logsDir = path.join(artifactDir, 'logs');
  const metricsDir = path.join(artifactDir, 'metrics');
  const checkpointsDir = path.join(artifactDir, 'checkpoints');
  const promptsDir = path.join(artifactDir, 'prompts');

  // Run-specific directories
  const backlogRunDir = path.join(backlogDir, workflowRunId);
  const summariesRunDir = path.join(summariesDir, workflowRunId);
  const logsRunDir = path.join(logsDir, workflowRunId);

  return {
    projectRoot,
    srcDir,
    docsDir,
    artifactDir,
    backlogDir,
    summariesDir,
    logsDir,
    metricsDir,
    checkpointsDir,
    promptsDir,
    backlogRunDir,
    summariesRunDir,
    logsRunDir,
  };
}

/**
 * Create metadata object (PURE)
 * @param {string} scriptVersion - Script version
 * @param {string} scriptName - Script name
 * @param {string} workflowRunId - Workflow run ID
 * @param {number} totalSteps - Total steps
 * @param {number} workflowStartTime - Start timestamp
 * @returns {Object} Metadata object
 */
export function createMetadata(
  scriptVersion,
  scriptName,
  workflowRunId,
  totalSteps,
  workflowStartTime
) {
  return {
    scriptVersion,
    scriptName,
    workflowRunId,
    totalSteps,
    workflowStartTime,
  };
}

/**
 * Create execution mode object (PURE)
 * @param {boolean} dryRun - Dry run mode
 * @param {boolean} interactive - Interactive mode
 * @param {boolean} auto - Auto mode
 * @returns {Object} Execution mode object
 */
export function createExecutionMode(dryRun, interactive, auto) {
  return {
    dryRun,
    interactive,
    auto,
  };
}

/**
 * Create analysis context object (PURE)
 * @param {string} commits - Commit range
 * @param {string} modified - Modified files
 * @param {string} changeScope - Change scope
 * @returns {Object} Analysis context object
 */
export function createAnalysisContext(commits, modified, changeScope) {
  return {
    commits,
    modified,
    changeScope,
  };
}

/**
 * Add temp file to list (PURE - returns new array)
 * @param {Array<string>} tempFiles - Current temp files
 * @param {string} filePath - File path to add
 * @returns {Array<string>} New temp files array
 */
export function addTempFile(tempFiles, filePath) {
  return [...tempFiles, filePath];
}

/**
 * Create step status object (PURE)
 * @param {string} status - Step status
 * @param {number} timestamp - Timestamp
 * @param {Object} metadata - Additional metadata
 * @returns {Object} Step status object
 */
export function createStepStatus(status, timestamp, metadata = {}) {
  return {
    status,
    timestamp,
    ...metadata,
  };
}

/**
 * Update step status in map (PURE - returns new Map)
 * @param {Map} statusMap - Current status map
 * @param {number} stepNumber - Step number
 * @param {string} status - Step status
 * @param {number} timestamp - Timestamp
 * @param {Object} metadata - Additional metadata
 * @returns {Map} New status map
 */
export function updateStepStatusMap(statusMap, stepNumber, status, timestamp, metadata = {}) {
  const newMap = new Map(statusMap);
  newMap.set(stepNumber, createStepStatus(status, timestamp, metadata));
  return newMap;
}

/**
 * Calculate elapsed time (PURE)
 * @param {number} startTime - Start timestamp
 * @param {number} currentTime - Current timestamp
 * @returns {number} Elapsed time in milliseconds
 */
export function calculateElapsedTime(startTime, currentTime) {
  return currentTime - startTime;
}

/**
 * Resolve project root from current file (PURE)
 * @param {string} dirname - Current __dirname
 * @returns {string} Project root path
 */
export function resolveProjectRoot(dirname) {
  // From src/lib/ to project root
  return path.resolve(dirname, '../..');
}

/**
 * IMPURE WRAPPER CLASS - Isolates side effects at boundaries
 */
export class Config {
  /**
   * Initialize configuration
   * @param {string} projectRoot - Project root directory
   */
  constructor(projectRoot = null) {
    // Auto-detect project root if not provided (uses __dirname - side effect)
    if (!projectRoot) {
      this.projectRoot = resolveProjectRoot(__dirname);
    } else {
      this.projectRoot = path.resolve(projectRoot);
    }

    // Script metadata
    this.scriptVersion = '1.0.0';
    this.scriptName = 'AI Workflow Automation';

    // Generate workflow run ID (inject current time)
    const timestamp = generateTimestamp(new Date());
    this.workflowRunId = generateWorkflowRunId(timestamp);

    // Calculate all paths (pure function)
    const paths = calculatePaths(this.projectRoot, this.workflowRunId);
    Object.assign(this, paths);

    this.totalSteps = 15; // 0-14
    this.dryRun = false;
    this.interactiveMode = true;
    this.autoMode = false;
    this.workflowStartTime = Date.now();

    // Analysis variables
    this.analysisCommits = '';
    this.analysisModified = '';
    this.changeScope = '';

    // Workflow status tracking
    this.workflowStatus = new Map();

    // Temporary files tracking
    this.tempFiles = [];
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
    return createMetadata(
      this.scriptVersion,
      this.scriptName,
      this.workflowRunId,
      this.totalSteps,
      this.workflowStartTime
    );
  }

  /**
   * Set workflow execution mode (IMPURE - mutates state)
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
    return createExecutionMode(this.dryRun, this.interactiveMode, this.autoMode);
  }

  /**
   * Set analysis context (IMPURE - mutates state)
   * @param {Object} context - Analysis context
   * @param {string} context.commits - Commit range or SHA
   * @param {string} context.modified - Modified files
   * @param {string} context.changeScope - Change scope
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
    return createAnalysisContext(this.analysisCommits, this.analysisModified, this.changeScope);
  }

  /**
   * Track temporary file for cleanup (IMPURE - mutates state)
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
   * Update workflow status for a step (IMPURE - mutates state)
   * @param {number} stepNumber - Step number
   * @param {string} status - Step status
   * @param {Object} metadata - Additional metadata
   */
  updateStepStatus(stepNumber, status, metadata = {}) {
    // Use pure function, but store result in mutable state
    this.workflowStatus = updateStepStatusMap(
      this.workflowStatus,
      stepNumber,
      status,
      Date.now(),
      metadata
    );
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
   * Get workflow elapsed time in milliseconds (IMPURE - uses Date.now())
   * @returns {number} Elapsed time
   */
  getElapsedTime() {
    return calculateElapsedTime(this.workflowStartTime, Date.now());
  }

  /**
   * Export configuration as plain object
   * @returns {Object} Configuration object
   */
  toJSON() {
    return {
      metadata: this.getMetadata(),
      paths: this.getPaths(),
      executionMode: this.getExecutionMode(),
      analysisContext: this.getAnalysisContext(),
      workflowStatus: Object.fromEntries(this.workflowStatus),
      tempFiles: this.getTempFiles(),
      elapsedTime: this.getElapsedTime(),
    };
  }
}

export default Config;
