/**
 * Workflow Metrics Collection Module
 * @version 1.0.0
 * @description Track duration, success rate, and step timing for workflow automation
 * @module lib/metrics
 * Part of: AI Workflow Automation v1.0.0
 */

import fs from 'fs/promises';
import path from 'path';

/**
 * Metrics collector for workflow execution
 */
export class Metrics {
  /**
   * Create metrics collector
   * @param {Object} config - Configuration instance
   */
  constructor(config) {
    this.config = config;

    // Step timing tracking
    this.stepStartTimes = new Map();
    this.stepEndTimes = new Map();
    this.stepDurations = new Map();
    this.stepStatuses = new Map();

    // Workflow-level metrics
    this.workflowStartEpoch = 0;
    this.workflowEndEpoch = 0;
    this.workflowDuration = 0;
    this.workflowSuccess = false;
    this.workflowStepsCompleted = 0;
    this.workflowStepsFailed = 0;
    this.workflowStepsSkipped = 0;

    // File paths
    this.metricsCurrentFile = null;
    this.metricsHistoryFile = null;
    this.metricsSummaryFile = null;
  }

  /**
   * Initialize metrics collection
   * Creates necessary directories and files
   * @returns {Promise<void>}
   */
  async initMetrics() {
    const metricsDir = this.config.metricsDir;

    // Create metrics directory
    await fs.mkdir(metricsDir, { recursive: true });

    // Set file paths
    this.metricsCurrentFile = path.join(metricsDir, 'current_run.json');
    this.metricsHistoryFile = path.join(metricsDir, 'history.jsonl');
    this.metricsSummaryFile = path.join(metricsDir, 'summary.md');

    // Initialize current run file
    const metadata = this.config.getMetadata();
    const executionMode = this.config.getExecutionMode();

    const initialData = {
      workflow_run_id: metadata.workflowRunId,
      start_time: new Date().toISOString(),
      start_epoch: Math.floor(Date.now() / 1000),
      version: metadata.scriptVersion,
      mode: this._getExecutionModeString(executionMode),
      steps: {},
    };

    await fs.writeFile(this.metricsCurrentFile, JSON.stringify(initialData, null, 2), 'utf8');

    // Initialize history file if it doesn't exist
    try {
      await fs.access(this.metricsHistoryFile);
    } catch {
      await fs.writeFile(this.metricsHistoryFile, '', 'utf8');
    }

    this.workflowStartEpoch = Date.now();
  }

  /**
   * Get execution mode as string
   * @private
   */
  _getExecutionModeString(executionMode) {
    if (executionMode.dryRun) return 'dry-run';
    if (executionMode.auto) return 'auto';
    if (executionMode.interactive) return 'interactive';
    return 'unknown';
  }

  /**
   * Start timing a step
   * @param {number} stepNumber - Step number
   */
  startStepTimer(stepNumber) {
    this.stepStartTimes.set(stepNumber, Date.now());
  }

  /**
   * End timing a step and record duration
   * @param {number} stepNumber - Step number
   * @param {string} status - Step status (passed|failed|skipped)
   */
  endStepTimer(stepNumber, status = 'passed') {
    const endTime = Date.now();
    this.stepEndTimes.set(stepNumber, endTime);
    this.stepStatuses.set(stepNumber, status);

    const startTime = this.stepStartTimes.get(stepNumber);
    if (startTime) {
      const duration = endTime - startTime;
      this.stepDurations.set(stepNumber, duration);
    }

    // Update workflow counters
    if (status === 'passed') {
      this.workflowStepsCompleted++;
    } else if (status === 'failed') {
      this.workflowStepsFailed++;
    } else if (status === 'skipped') {
      this.workflowStepsSkipped++;
    }
  }

  /**
   * Get step duration
   * @param {number} stepNumber - Step number
   * @returns {number|null} Duration in ms or null
   */
  getStepDuration(stepNumber) {
    return this.stepDurations.get(stepNumber) || null;
  }

  /**
   * Get step status
   * @param {number} stepNumber - Step number
   * @returns {string|null} Status or null
   */
  getStepStatus(stepNumber) {
    return this.stepStatuses.get(stepNumber) || null;
  }

  /**
   * Mark workflow as complete
   * @param {boolean} success - Whether workflow succeeded
   */
  markWorkflowComplete(success = true) {
    this.workflowEndEpoch = Date.now();
    this.workflowDuration = this.workflowEndEpoch - this.workflowStartEpoch;
    this.workflowSuccess = success;
  }

  /**
   * Save metrics to current run file
   * @returns {Promise<void>}
   */
  async saveCurrentMetrics() {
    if (!this.metricsCurrentFile) {
      throw new Error('Metrics not initialized. Call initMetrics() first.');
    }

    const metadata = this.config.getMetadata();
    const executionMode = this.config.getExecutionMode();

    const steps = {};
    for (const [stepNum, duration] of this.stepDurations.entries()) {
      steps[stepNum] = {
        duration_ms: duration,
        status: this.stepStatuses.get(stepNum),
        start_time: this.stepStartTimes.get(stepNum),
        end_time: this.stepEndTimes.get(stepNum),
      };
    }

    const data = {
      workflow_run_id: metadata.workflowRunId,
      start_time: new Date(this.workflowStartEpoch).toISOString(),
      end_time: new Date(this.workflowEndEpoch).toISOString(),
      start_epoch: Math.floor(this.workflowStartEpoch / 1000),
      end_epoch: Math.floor(this.workflowEndEpoch / 1000),
      duration_ms: this.workflowDuration,
      version: metadata.scriptVersion,
      mode: this._getExecutionModeString(executionMode),
      success: this.workflowSuccess,
      steps_completed: this.workflowStepsCompleted,
      steps_failed: this.workflowStepsFailed,
      steps_skipped: this.workflowStepsSkipped,
      steps,
    };

    await fs.writeFile(this.metricsCurrentFile, JSON.stringify(data, null, 2), 'utf8');
  }

  /**
   * Append current metrics to history
   * @returns {Promise<void>}
   */
  async appendToHistory() {
    if (!this.metricsHistoryFile) {
      throw new Error('Metrics not initialized. Call initMetrics() first.');
    }

    // Read current metrics
    const currentData = await fs.readFile(this.metricsCurrentFile, 'utf8');
    const metrics = JSON.parse(currentData);

    // Append as single line JSON
    await fs.appendFile(this.metricsHistoryFile, JSON.stringify(metrics) + '\n', 'utf8');
  }

  /**
   * Generate metrics summary markdown
   * @returns {Promise<void>}
   */
  async generateSummary() {
    if (!this.metricsSummaryFile) {
      throw new Error('Metrics not initialized. Call initMetrics() first.');
    }

    const metadata = this.config.getMetadata();

    let content = `# Workflow Metrics Summary

**Last Run:** ${metadata.workflowRunId}
**Generated:** ${new Date().toLocaleString()}

---

## Current Run

- **Duration:** ${this.formatDuration(this.workflowDuration)}
- **Status:** ${this.workflowSuccess ? '✅ Success' : '❌ Failed'}
- **Steps Completed:** ${this.workflowStepsCompleted}
- **Steps Failed:** ${this.workflowStepsFailed}
- **Steps Skipped:** ${this.workflowStepsSkipped}

### Step Durations

| Step | Duration | Status |
|------|----------|--------|
`;

    for (const [stepNum, duration] of this.stepDurations.entries()) {
      const status = this.stepStatuses.get(stepNum);
      const statusEmoji = status === 'passed' ? '✅' : status === 'failed' ? '❌' : '⏭️';
      content += `| ${stepNum} | ${this.formatDuration(duration)} | ${statusEmoji} ${status} |\n`;
    }

    content += '\n---\n\n*See history.jsonl for complete historical data*\n';

    await fs.writeFile(this.metricsSummaryFile, content, 'utf8');
  }

  /**
   * Format duration for display
   * @param {number} ms - Duration in milliseconds
   * @returns {string} Formatted duration
   */
  formatDuration(ms) {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
    const minutes = Math.floor(ms / 60000);
    const seconds = ((ms % 60000) / 1000).toFixed(0);
    return `${minutes}m ${seconds}s`;
  }

  /**
   * Get all metrics as object
   * @returns {Object} All metrics data
   */
  getAllMetrics() {
    return {
      workflow: {
        startEpoch: this.workflowStartEpoch,
        endEpoch: this.workflowEndEpoch,
        duration: this.workflowDuration,
        success: this.workflowSuccess,
        stepsCompleted: this.workflowStepsCompleted,
        stepsFailed: this.workflowStepsFailed,
        stepsSkipped: this.workflowStepsSkipped,
      },
      steps: Object.fromEntries(
        Array.from(this.stepDurations.keys()).map((stepNum) => [
          stepNum,
          {
            duration: this.stepDurations.get(stepNum),
            status: this.stepStatuses.get(stepNum),
            startTime: this.stepStartTimes.get(stepNum),
            endTime: this.stepEndTimes.get(stepNum),
          },
        ])
      ),
    };
  }
}

export default Metrics;
