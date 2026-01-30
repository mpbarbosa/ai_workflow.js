/**
 * Workflow Metrics Collection Module (Pure Functions + Wrapper)
 * @version 2.0.0
 * @description Track duration, success rate, and step timing with referential transparency
 * @module lib/metrics
 * Part of: AI Workflow Automation v1.0.0
 */

import fs from 'fs/promises';
import path from 'path';

/**
 * PURE FUNCTIONS - All referentially transparent
 */

/**
 * Format ISO timestamp (PURE)
 * @param {number} epochMs - Epoch time in milliseconds
 * @returns {string} ISO timestamp string
 */
export function formatISOTimestamp(epochMs) {
  return new Date(epochMs).toISOString();
}

/**
 * Convert epoch ms to seconds (PURE)
 * @param {number} epochMs - Epoch time in milliseconds
 * @returns {number} Epoch time in seconds
 */
export function convertToEpochSeconds(epochMs) {
  return Math.floor(epochMs / 1000);
}

/**
 * Get execution mode string (PURE)
 * @param {Object} executionMode - Execution mode object
 * @returns {string} Mode string
 */
export function getExecutionModeString(executionMode) {
  if (executionMode.dryRun) return 'dry-run';
  if (executionMode.auto) return 'auto';
  if (executionMode.interactive) return 'interactive';
  return 'unknown';
}

/**
 * Calculate duration (PURE)
 * @param {number} startTime - Start time in ms
 * @param {number} endTime - End time in ms
 * @returns {number} Duration in ms
 */
export function calculateDuration(startTime, endTime) {
  return endTime - startTime;
}

/**
 * Add step timing to map (PURE - returns new Map)
 * @param {Map} timingMap - Current timing map
 * @param {number} stepNumber - Step number
 * @param {number} time - Time value
 * @returns {Map} New timing map
 */
export function addStepTiming(timingMap, stepNumber, time) {
  const newMap = new Map(timingMap);
  newMap.set(stepNumber, time);
  return newMap;
}

/**
 * Update step counters (PURE - returns new counters)
 * @param {Object} counters - Current counters
 * @param {string} status - Step status
 * @returns {Object} New counters object
 */
export function updateStepCounters(counters, status) {
  const newCounters = { ...counters };
  if (status === 'passed') {
    newCounters.stepsCompleted++;
  } else if (status === 'failed') {
    newCounters.stepsFailed++;
  } else if (status === 'skipped') {
    newCounters.stepsSkipped++;
  }
  return newCounters;
}

/**
 * Format duration for display (PURE)
 * @param {number} ms - Duration in milliseconds
 * @returns {string} Formatted duration
 */
export function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(0);
  return `${minutes}m ${seconds}s`;
}

/**
 * Get status emoji (PURE)
 * @param {string} status - Step status
 * @returns {string} Emoji
 */
export function getStatusEmoji(status) {
  if (status === 'passed') return '✅';
  if (status === 'failed') return '❌';
  return '⏭️';
}

/**
 * Create initial metrics data (PURE)
 * @param {string} workflowRunId - Workflow run ID
 * @param {string} startTime - ISO start time
 * @param {number} startEpoch - Start epoch seconds
 * @param {string} version - Script version
 * @param {string} mode - Execution mode
 * @returns {Object} Initial metrics data
 */
export function createInitialMetricsData(workflowRunId, startTime, startEpoch, version, mode) {
  return {
    workflow_run_id: workflowRunId,
    start_time: startTime,
    start_epoch: startEpoch,
    version,
    mode,
    steps: {},
  };
}

/**
 * Create metrics data object (PURE)
 * @param {Object} params - All parameters
 * @returns {Object} Complete metrics data
 */
export function createMetricsData({
  workflowRunId,
  startEpoch,
  endEpoch,
  duration,
  version,
  mode,
  success,
  stepsCompleted,
  stepsFailed,
  stepsSkipped,
  stepDurations,
  stepStatuses,
  stepStartTimes,
  stepEndTimes,
}) {
  const steps = {};
  for (const [stepNum, duration] of stepDurations.entries()) {
    steps[stepNum] = {
      duration_ms: duration,
      status: stepStatuses.get(stepNum),
      start_time: stepStartTimes.get(stepNum),
      end_time: stepEndTimes.get(stepNum),
    };
  }

  return {
    workflow_run_id: workflowRunId,
    start_time: formatISOTimestamp(startEpoch),
    end_time: formatISOTimestamp(endEpoch),
    start_epoch: convertToEpochSeconds(startEpoch),
    end_epoch: convertToEpochSeconds(endEpoch),
    duration_ms: duration,
    version,
    mode,
    success,
    steps_completed: stepsCompleted,
    steps_failed: stepsFailed,
    steps_skipped: stepsSkipped,
    steps,
  };
}

/**
 * Generate metrics summary markdown (PURE)
 * @param {Object} params - Summary parameters
 * @returns {string} Markdown content
 */
export function generateMetricsSummary({
  workflowRunId,
  timestamp,
  duration,
  success,
  stepsCompleted,
  stepsFailed,
  stepsSkipped,
  stepDurations,
  stepStatuses,
}) {
  let content = `# Workflow Metrics Summary

**Last Run:** ${workflowRunId}
**Generated:** ${timestamp}

---

## Current Run

- **Duration:** ${formatDuration(duration)}
- **Status:** ${success ? '✅ Success' : '❌ Failed'}
- **Steps Completed:** ${stepsCompleted}
- **Steps Failed:** ${stepsFailed}
- **Steps Skipped:** ${stepsSkipped}

### Step Durations

| Step | Duration | Status |
|------|----------|--------|
`;

  for (const [stepNum, stepDuration] of stepDurations.entries()) {
    const status = stepStatuses.get(stepNum);
    const emoji = getStatusEmoji(status);
    content += `| ${stepNum} | ${formatDuration(stepDuration)} | ${emoji} ${status} |\n`;
  }

  content += '\n---\n\n*See history.jsonl for complete historical data*\n';

  return content;
}

/**
 * IMPURE WRAPPER CLASS - Isolates side effects at boundaries
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
   * Initialize metrics collection (IMPURE - file I/O)
   * @returns {Promise<void>}
   */
  async initMetrics() {
    const metricsDir = this.config.metricsDir;

    await fs.mkdir(metricsDir, { recursive: true });

    this.metricsCurrentFile = path.join(metricsDir, 'current_run.json');
    this.metricsHistoryFile = path.join(metricsDir, 'history.jsonl');
    this.metricsSummaryFile = path.join(metricsDir, 'summary.md');

    // Use pure function to create initial data
    const metadata = this.config.getMetadata();
    const executionMode = this.config.getExecutionMode();
    const now = Date.now();

    const initialData = createInitialMetricsData(
      metadata.workflowRunId,
      formatISOTimestamp(now),
      convertToEpochSeconds(now),
      metadata.scriptVersion,
      getExecutionModeString(executionMode)
    );

    await fs.writeFile(this.metricsCurrentFile, JSON.stringify(initialData, null, 2), 'utf8');

    try {
      await fs.access(this.metricsHistoryFile);
    } catch {
      await fs.writeFile(this.metricsHistoryFile, '', 'utf8');
    }

    this.workflowStartEpoch = now;
  }

  /**
   * Start timing a step (IMPURE - uses Date.now())
   * @param {number} stepNumber - Step number
   */
  startStepTimer(stepNumber) {
    this.stepStartTimes = addStepTiming(this.stepStartTimes, stepNumber, Date.now());
  }

  /**
   * End timing a step and record duration (IMPURE - uses Date.now())
   * @param {number} stepNumber - Step number
   * @param {string} status - Step status
   */
  endStepTimer(stepNumber, status = 'passed') {
    const endTime = Date.now();
    this.stepEndTimes = addStepTiming(this.stepEndTimes, stepNumber, endTime);
    this.stepStatuses = addStepTiming(this.stepStatuses, stepNumber, status);

    const startTime = this.stepStartTimes.get(stepNumber);
    if (startTime) {
      const duration = calculateDuration(startTime, endTime);
      this.stepDurations = addStepTiming(this.stepDurations, stepNumber, duration);
    }

    // Update counters using pure function
    const counters = {
      stepsCompleted: this.workflowStepsCompleted,
      stepsFailed: this.workflowStepsFailed,
      stepsSkipped: this.workflowStepsSkipped,
    };
    const newCounters = updateStepCounters(counters, status);
    this.workflowStepsCompleted = newCounters.stepsCompleted;
    this.workflowStepsFailed = newCounters.stepsFailed;
    this.workflowStepsSkipped = newCounters.stepsSkipped;
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
   * Mark workflow as complete (IMPURE - uses Date.now())
   * @param {boolean} success - Whether workflow succeeded
   */
  markWorkflowComplete(success = true) {
    this.workflowEndEpoch = Date.now();
    this.workflowDuration = calculateDuration(this.workflowStartEpoch, this.workflowEndEpoch);
    this.workflowSuccess = success;
  }

  /**
   * Save metrics to current run file (IMPURE - file I/O)
   * @returns {Promise<void>}
   */
  async saveCurrentMetrics() {
    if (!this.metricsCurrentFile) {
      throw new Error('Metrics not initialized. Call initMetrics() first.');
    }

    const metadata = this.config.getMetadata();
    const executionMode = this.config.getExecutionMode();

    // Use pure function to create data
    const data = createMetricsData({
      workflowRunId: metadata.workflowRunId,
      startEpoch: this.workflowStartEpoch,
      endEpoch: this.workflowEndEpoch,
      duration: this.workflowDuration,
      version: metadata.scriptVersion,
      mode: getExecutionModeString(executionMode),
      success: this.workflowSuccess,
      stepsCompleted: this.workflowStepsCompleted,
      stepsFailed: this.workflowStepsFailed,
      stepsSkipped: this.workflowStepsSkipped,
      stepDurations: this.stepDurations,
      stepStatuses: this.stepStatuses,
      stepStartTimes: this.stepStartTimes,
      stepEndTimes: this.stepEndTimes,
    });

    await fs.writeFile(this.metricsCurrentFile, JSON.stringify(data, null, 2), 'utf8');
  }

  /**
   * Append current metrics to history (IMPURE - file I/O)
   * @returns {Promise<void>}
   */
  async appendToHistory() {
    if (!this.metricsHistoryFile) {
      throw new Error('Metrics not initialized. Call initMetrics() first.');
    }

    const currentData = await fs.readFile(this.metricsCurrentFile, 'utf8');
    const metrics = JSON.parse(currentData);

    await fs.appendFile(this.metricsHistoryFile, JSON.stringify(metrics) + '\n', 'utf8');
  }

  /**
   * Generate metrics summary markdown (IMPURE - file I/O)
   * @returns {Promise<void>}
   */
  async generateSummary() {
    if (!this.metricsSummaryFile) {
      throw new Error('Metrics not initialized. Call initMetrics() first.');
    }

    const metadata = this.config.getMetadata();

    // Use pure function to generate content
    const content = generateMetricsSummary({
      workflowRunId: metadata.workflowRunId,
      timestamp: new Date().toLocaleString(),
      duration: this.workflowDuration,
      success: this.workflowSuccess,
      stepsCompleted: this.workflowStepsCompleted,
      stepsFailed: this.workflowStepsFailed,
      stepsSkipped: this.workflowStepsSkipped,
      stepDurations: this.stepDurations,
      stepStatuses: this.stepStatuses,
    });

    await fs.writeFile(this.metricsSummaryFile, content, 'utf8');
  }

  /**
   * Format duration for display (delegates to pure function)
   * @param {number} ms - Duration in milliseconds
   * @returns {string} Formatted duration
   */
  formatDuration(ms) {
    return formatDuration(ms);
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
