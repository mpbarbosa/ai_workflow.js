/**
 * @fileoverview Step 17: Workflow Summary and Reporting (v2.0.0)
 * @module steps/step_17_summary
 *
 * Aggregates workflow execution results, calculates metrics, and generates
 * comprehensive summary reports with recommendations for improvements.
 *
 * Architecture: v2.0.0 Referential Transparency
 * - Pure functions for aggregation, calculation, and formatting logic
 * - Impure wrapper class for file I/O and artifact reading
 *
 * **Source**: Migrated from ai_workflow v4.0.1 `workflow_summary.sh`
 *
 * @version 2.0.0
 * @since 2026-02-10
 */

import fs from 'fs/promises';
import path from 'path';
import { logger } from '../core/logger.js';
import { STEP_KIND } from './step_contract.js';
import { colors } from '../core/colors.js';

// ============================================================================
// CONSTANTS
// ============================================================================

export const PHASE_NAMES = Object.freeze({
  0: 'Initialization',
  1: 'Documentation',
  2: 'Validation',
  3: 'Testing',
  4: 'Quality',
  5: 'Finalization',
});

export const PERFORMANCE_THRESHOLDS = Object.freeze({
  bottleneckSeconds: 300, // 5 minutes
  slowStepSeconds: 120, // 2 minutes
  acceptableCacheHitRate: 0.6, // 60%
  goodCacheHitRate: 0.8, // 80%
});

export const RECOMMENDATION_TYPES = Object.freeze({
  PERFORMANCE: 'performance',
  CACHING: 'caching',
  SKIPPING: 'skipping',
  PARALLELIZATION: 'parallelization',
  OPTIMIZATION: 'optimization',
});

// ============================================================================
// PURE FUNCTIONS - Result Aggregation
// ============================================================================

/**
 * Aggregate step results from metrics data
 * @pure
 * @param {Object} metrics - Metrics data from current_run.json
 * @returns {Array<Object>} Array of step results
 */
export function aggregateStepResults(metrics) {
  if (!metrics || !metrics.steps) {
    return [];
  }

  const results = [];
  for (const [stepId, stepData] of Object.entries(metrics.steps)) {
    results.push({
      stepId,
      name: stepData.name || `Unknown_${stepId}`,
      status: stepData.status || 'unknown',
      startTime: stepData.start_time || 0,
      endTime: stepData.end_time || 0,
      duration: stepData.duration_seconds || 0,
      timestamp: stepData.timestamp || '',
    });
  }

  // Sort by start time
  return results.sort((a, b) => a.startTime - b.startTime);
}

/**
 * Calculate workflow metrics from step results
 * @pure
 * @param {Array<Object>} stepResults - Step results array
 * @param {Object} workflowMetadata - Workflow metadata (start time, end time, etc.)
 * @returns {Object} Calculated metrics
 */
export function calculateWorkflowMetrics(stepResults, workflowMetadata = {}) {
  const totalSteps = stepResults.length;
  const successfulSteps = stepResults.filter((s) => s.status === 'success').length;
  const failedSteps = stepResults.filter((s) => s.status === 'failed').length;
  const skippedSteps = stepResults.filter((s) => s.status === 'skipped').length;

  const totalDuration = stepResults.reduce((sum, step) => sum + step.duration, 0);
  const avgDuration = totalSteps > 0 ? totalDuration / totalSteps : 0;

  const successRate = totalSteps > 0 ? (successfulSteps / totalSteps) * 100 : 0;

  return {
    totalSteps,
    successfulSteps,
    failedSteps,
    skippedSteps,
    totalDuration,
    avgDuration,
    successRate,
    startTime: workflowMetadata.start_time || '',
    endTime: workflowMetadata.end_time || '',
    workflowRunId: workflowMetadata.workflow_run_id || 'unknown',
    version: workflowMetadata.version || 'unknown',
    mode: workflowMetadata.mode || 'unknown',
  };
}

/**
 * Generate execution timeline data
 * @pure
 * @param {Array<Object>} stepResults - Step results array
 * @returns {Object} Timeline data with phases
 */
export function generateExecutionTimeline(stepResults) {
  const timeline = {
    steps: stepResults.map((step) => ({
      id: step.stepId,
      name: step.name,
      status: step.status,
      duration: step.duration,
      startTime: step.startTime,
      endTime: step.endTime,
    })),
    phases: groupStepsByPhase(stepResults),
  };

  return timeline;
}

/**
 * Group steps by phase
 * @pure
 * @param {Array<Object>} stepResults - Step results array
 * @returns {Object} Steps grouped by phase
 */
export function groupStepsByPhase(stepResults) {
  const phases = {
    initialization: [],
    documentation: [],
    validation: [],
    testing: [],
    quality: [],
    finalization: [],
  };

  for (const step of stepResults) {
    // Handle hex step IDs (step_0a, step_0b, etc.)
    if (step.stepId.startsWith('step_0')) {
      phases.initialization.push(step);
    } else {
      // Parse numeric part (step_1, step_10, etc.)
      const match = step.stepId.match(/step_(\d+)/);
      if (!match) continue;

      const stepNum = parseInt(match[1], 10);

      if (stepNum >= 1 && stepNum <= 2) {
        phases.documentation.push(step);
      } else if (stepNum >= 3 && stepNum <= 5) {
        phases.validation.push(step);
      } else if (stepNum >= 6 && stepNum <= 8) {
        phases.testing.push(step);
      } else if (stepNum >= 9 && stepNum <= 11) {
        phases.quality.push(step);
      } else {
        phases.finalization.push(step);
      }
    }
  }

  return phases;
}

/**
 * Detect bottlenecks in workflow execution
 * @pure
 * @param {Array<Object>} stepResults - Step results array
 * @param {number} threshold - Threshold in seconds for bottleneck detection
 * @returns {Array<Object>} Bottleneck steps
 */
export function detectBottlenecks(
  stepResults,
  threshold = PERFORMANCE_THRESHOLDS.bottleneckSeconds
) {
  return stepResults
    .filter((step) => step.duration >= threshold && step.status === 'success')
    .sort((a, b) => b.duration - a.duration);
}

/**
 * Calculate cache efficiency metrics
 * @pure
 * @param {Object} metrics - Metrics data
 * @returns {Object} Cache efficiency data
 */
export function calculateCacheEfficiency(metrics) {
  const cacheHits = metrics.cache_hits || 0;
  const cacheMisses = metrics.cache_misses || 0;
  const totalRequests = cacheHits + cacheMisses;
  const hitRate = totalRequests > 0 ? cacheHits / totalRequests : 0;

  return {
    cacheHits,
    cacheMisses,
    totalRequests,
    hitRate,
    quality:
      hitRate >= PERFORMANCE_THRESHOLDS.goodCacheHitRate
        ? 'excellent'
        : hitRate >= PERFORMANCE_THRESHOLDS.acceptableCacheHitRate
          ? 'good'
          : 'poor',
  };
}

/**
 * Generate improvement recommendations
 * @pure
 * @param {Object} metrics - Calculated workflow metrics
 * @param {Array<Object>} stepResults - Step results array
 * @param {Object} cacheEfficiency - Cache efficiency data
 * @returns {Array<Object>} Array of recommendations
 */
export function generateRecommendations(metrics, stepResults, cacheEfficiency) {
  const recommendations = [];

  // Bottleneck recommendations
  const bottlenecks = detectBottlenecks(stepResults);
  if (bottlenecks.length > 0) {
    recommendations.push({
      type: RECOMMENDATION_TYPES.PERFORMANCE,
      priority: 'high',
      title: 'Performance Bottlenecks Detected',
      description: `${bottlenecks.length} step(s) took longer than ${PERFORMANCE_THRESHOLDS.bottleneckSeconds} seconds`,
      impact: 'high',
      suggestion: `Review steps: ${bottlenecks.map((s) => s.name).join(', ')}`,
      details: bottlenecks.map((s) => `${s.name}: ${s.duration}s`),
    });
  }

  // Slow step recommendations
  const slowSteps = stepResults.filter(
    (s) =>
      s.duration >= PERFORMANCE_THRESHOLDS.slowStepSeconds &&
      s.duration < PERFORMANCE_THRESHOLDS.bottleneckSeconds
  );
  if (slowSteps.length > 0) {
    recommendations.push({
      type: RECOMMENDATION_TYPES.OPTIMIZATION,
      priority: 'medium',
      title: 'Slow Steps Detected',
      description: `${slowSteps.length} step(s) took longer than ${PERFORMANCE_THRESHOLDS.slowStepSeconds} seconds`,
      impact: 'medium',
      suggestion: 'Consider optimizing or parallelizing these steps',
      details: slowSteps.map((s) => `${s.name}: ${s.duration}s`),
    });
  }

  // Cache efficiency recommendations
  if (cacheEfficiency.quality === 'poor') {
    recommendations.push({
      type: RECOMMENDATION_TYPES.CACHING,
      priority: 'high',
      title: 'Low Cache Hit Rate',
      description: `Cache hit rate is ${(cacheEfficiency.hitRate * 100).toFixed(1)}% (below ${PERFORMANCE_THRESHOLDS.acceptableCacheHitRate * 100}%)`,
      impact: 'high',
      suggestion: 'Review caching strategy and increase cache TTL',
      details: [
        `Cache hits: ${cacheEfficiency.cacheHits}`,
        `Cache misses: ${cacheEfficiency.cacheMisses}`,
      ],
    });
  }

  // Failed steps recommendations
  if (metrics.failedSteps > 0) {
    const failedStepsList = stepResults.filter((s) => s.status === 'failed');
    recommendations.push({
      type: RECOMMENDATION_TYPES.OPTIMIZATION,
      priority: 'critical',
      title: 'Failed Steps Detected',
      description: `${metrics.failedSteps} step(s) failed during execution`,
      impact: 'critical',
      suggestion: 'Review error logs and fix failing steps',
      details: failedStepsList.map((s) => s.name),
    });
  }

  // Success rate recommendations
  if (metrics.successRate < 80 && metrics.successRate > 0) {
    recommendations.push({
      type: RECOMMENDATION_TYPES.OPTIMIZATION,
      priority: 'high',
      title: 'Low Success Rate',
      description: `Workflow success rate is ${metrics.successRate.toFixed(1)}% (below 80%)`,
      impact: 'high',
      suggestion: 'Investigate and fix issues causing step failures or skips',
      details: [
        `Successful: ${metrics.successfulSteps}`,
        `Failed: ${metrics.failedSteps}`,
        `Skipped: ${metrics.skippedSteps}`,
      ],
    });
  }

  // Parallelization opportunities
  const sequentialSteps = identifyParallelizationOpportunities(stepResults);
  if (sequentialSteps.length > 0) {
    recommendations.push({
      type: RECOMMENDATION_TYPES.PARALLELIZATION,
      priority: 'medium',
      title: 'Parallelization Opportunities',
      description: `${sequentialSteps.length} step group(s) could potentially run in parallel`,
      impact: 'medium',
      suggestion: 'Review step dependencies and enable parallel execution where safe',
      details: sequentialSteps,
    });
  }

  return recommendations;
}

/**
 * Identify steps that could potentially run in parallel
 * @pure
 * @param {Array<Object>} stepResults - Step results array
 * @returns {Array<string>} Step groups that could be parallelized
 */
export function identifyParallelizationOpportunities(stepResults) {
  const opportunities = [];

  // Check validation phase (steps 3-5)
  const validationSteps = stepResults.filter((s) => {
    if (!s.stepId) return false;
    const match = s.stepId.match(/step_(\d+)/);
    if (!match) return false;
    const num = parseInt(match[1], 10);
    return num >= 3 && num <= 5;
  });
  if (validationSteps.length >= 2) {
    opportunities.push(`Validation phase: ${validationSteps.map((s) => s.name).join(', ')}`);
  }

  // Check quality phase (steps 10-11)
  const qualitySteps = stepResults.filter((s) => {
    if (!s.stepId) return false;
    const match = s.stepId.match(/step_(\d+)/);
    if (!match) return false;
    const num = parseInt(match[1], 10);
    return num >= 10 && num <= 11;
  });
  if (qualitySteps.length >= 2) {
    opportunities.push(`Quality phase: ${qualitySteps.map((s) => s.name).join(', ')}`);
  }

  return opportunities;
}

// ============================================================================
// PURE FUNCTIONS - Report Formatting
// ============================================================================

/**
 * Format summary report as markdown
 * @pure
 * @param {Object} metrics - Calculated workflow metrics
 * @param {Object} timeline - Execution timeline
 * @param {Array<Object>} recommendations - Improvement recommendations
 * @returns {string} Markdown formatted report
 */
export function formatSummaryReport(metrics, timeline, recommendations) {
  const sections = [];

  // Header
  sections.push('# Workflow Summary Report\n');
  sections.push(`**Workflow Run ID:** ${metrics.workflowRunId}`);
  sections.push(`**Version:** ${metrics.version}`);
  sections.push(`**Mode:** ${metrics.mode}`);
  sections.push(`**Start Time:** ${metrics.startTime}`);
  sections.push(`**End Time:** ${metrics.endTime}`);
  sections.push(`**Total Duration:** ${formatDuration(metrics.totalDuration)}\n`);

  // Executive Summary
  sections.push('---\n');
  sections.push('## Executive Summary\n');
  sections.push(formatExecutiveSummary(metrics));

  // Step Execution Timeline
  sections.push('\n---\n');
  sections.push('## Execution Timeline\n');
  sections.push(formatTimeline(timeline));

  // Phase Breakdown
  sections.push('\n---\n');
  sections.push('## Phase Breakdown\n');
  sections.push(formatPhaseBreakdown(timeline.phases));

  // Performance Metrics
  sections.push('\n---\n');
  sections.push('## Performance Metrics\n');
  sections.push(formatPerformanceMetrics(metrics));

  // Recommendations
  if (recommendations.length > 0) {
    sections.push('\n---\n');
    sections.push('## Recommendations\n');
    sections.push(formatRecommendations(recommendations));
  }

  // Footer
  sections.push('\n---\n');
  sections.push(`*Generated by AI Workflow Automation v${metrics.version}*\n`);
  sections.push(`*Report generated at: ${new Date().toISOString()}*\n`);

  return sections.join('\n');
}

/**
 * Format executive summary section
 * @pure
 * @param {Object} metrics - Workflow metrics
 * @returns {string} Formatted executive summary
 */
export function formatExecutiveSummary(metrics) {
  const statusEmoji = metrics.failedSteps > 0 ? '❌' : metrics.successRate === 100 ? '✅' : '⚠️';

  const lines = [];
  lines.push(`**Overall Status:** ${statusEmoji} ${getOverallStatusText(metrics)}`);
  lines.push(`**Success Rate:** ${metrics.successRate.toFixed(1)}%`);
  lines.push(`**Total Steps:** ${metrics.totalSteps}`);
  lines.push(`**Successful:** ${metrics.successfulSteps} ✅`);
  if (metrics.failedSteps > 0) lines.push(`**Failed:** ${metrics.failedSteps} ❌`);
  if (metrics.skippedSteps > 0) lines.push(`**Skipped:** ${metrics.skippedSteps} ⏭️`);
  lines.push(`**Average Step Duration:** ${formatDuration(metrics.avgDuration)}`);

  return lines.join('\n');
}

/**
 * Get overall status text from metrics
 * @pure
 * @param {Object} metrics - Workflow metrics
 * @returns {string} Status text
 */
export function getOverallStatusText(metrics) {
  if (metrics.failedSteps > 0) {
    return 'Failed - Some steps encountered errors';
  }
  if (metrics.successRate === 100) {
    return 'Success - All steps completed successfully';
  }
  if (metrics.skippedSteps > 0) {
    return 'Partial Success - Some steps were skipped';
  }
  return 'Completed';
}

/**
 * Format execution timeline
 * @pure
 * @param {Object} timeline - Timeline data
 * @returns {string} Formatted timeline
 */
export function formatTimeline(timeline) {
  const lines = [];

  for (const step of timeline.steps) {
    const statusIcon = getStatusIcon(step.status);
    const duration = formatDuration(step.duration);
    lines.push(`- ${statusIcon} **${step.name}** (${step.id}): ${duration}`);
  }

  return lines.join('\n');
}

/**
 * Format phase breakdown section
 * @pure
 * @param {Object} phases - Phases data
 * @returns {string} Formatted phase breakdown
 */
export function formatPhaseBreakdown(phases) {
  const lines = [];

  for (const [phaseName, steps] of Object.entries(phases)) {
    if (steps.length === 0) continue;

    const phaseDuration = steps.reduce((sum, step) => sum + step.duration, 0);
    const successCount = steps.filter((s) => s.status === 'success').length;

    lines.push(`### ${capitalize(phaseName)} Phase`);
    lines.push(`**Steps:** ${steps.length}`);
    lines.push(`**Successful:** ${successCount}/${steps.length}`);
    lines.push(`**Duration:** ${formatDuration(phaseDuration)}`);
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Format performance metrics section
 * @pure
 * @param {Object} metrics - Workflow metrics
 * @returns {string} Formatted metrics
 */
export function formatPerformanceMetrics(metrics) {
  const lines = [];

  lines.push('| Metric | Value |');
  lines.push('|--------|-------|');
  lines.push(`| Total Duration | ${formatDuration(metrics.totalDuration)} |`);
  lines.push(`| Average Step Duration | ${formatDuration(metrics.avgDuration)} |`);
  lines.push(`| Total Steps | ${metrics.totalSteps} |`);
  lines.push(`| Success Rate | ${metrics.successRate.toFixed(1)}% |`);

  return lines.join('\n');
}

/**
 * Format recommendations section
 * @pure
 * @param {Array<Object>} recommendations - Recommendations array
 * @returns {string} Formatted recommendations
 */
export function formatRecommendations(recommendations) {
  const lines = [];

  // Sort by priority
  const sorted = [...recommendations].sort((a, b) => {
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  for (const rec of sorted) {
    const icon = getPriorityIcon(rec.priority);
    lines.push(`### ${icon} ${rec.title}`);
    lines.push(`**Priority:** ${rec.priority.toUpperCase()}`);
    lines.push(`**Type:** ${rec.type}`);
    lines.push(`**Description:** ${rec.description}`);
    lines.push(`**Suggestion:** ${rec.suggestion}`);

    if (rec.details && rec.details.length > 0) {
      lines.push('\n**Details:**');
      for (const detail of rec.details) {
        lines.push(`- ${detail}`);
      }
    }

    lines.push('');
  }

  return lines.join('\n');
}

// ============================================================================
// PURE FUNCTIONS - Utility Helpers
// ============================================================================

/**
 * Format duration in seconds to human-readable string
 * @pure
 * @param {number} seconds - Duration in seconds
 * @returns {string} Formatted duration
 */
export function formatDuration(seconds) {
  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes < 60) {
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (remainingMinutes > 0) {
    return `${hours}h ${remainingMinutes}m`;
  }

  return `${hours}h`;
}

/**
 * Get status icon for step status
 * @pure
 * @param {string} status - Step status
 * @returns {string} Status icon
 */
export function getStatusIcon(status) {
  const icons = {
    success: '✅',
    failed: '❌',
    skipped: '⏭️',
    unknown: '❓',
  };
  return icons[status] || icons.unknown;
}

/**
 * Get priority icon
 * @pure
 * @param {string} priority - Priority level
 * @returns {string} Priority icon
 */
export function getPriorityIcon(priority) {
  const icons = {
    critical: '🔴',
    high: '🟠',
    medium: '🟡',
    low: '🟢',
  };
  return icons[priority] || '⚪';
}

/**
 * Capitalize first letter of string
 * @pure
 * @param {string} str - String to capitalize
 * @returns {string} Capitalized string
 */
export function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ============================================================================
// IMPURE WRAPPER CLASS - WorkflowSummary
// ============================================================================

/**
 * Workflow Summary Generator
 * Handles file I/O and orchestrates summary generation
 */
export class WorkflowSummary {
  static stepKind = STEP_KIND.CONTEXT;

  constructor(workflowDir = '.ai_workflow') {
    this.workflowDir = workflowDir;
    this.metricsDir = path.join(workflowDir, 'metrics');
    this.summariesDir = path.join(workflowDir, 'summaries');
  }

  /**
   * Generate workflow summary report
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} Generated summary data
   */
  async generateSummary(options = {}) {
    try {
      logger.info('Generating workflow summary report...');

      // Read workflow artifacts
      const metrics = await this.readMetrics();
      // Prefer the caller-supplied runId over what's stored in the (possibly stale) metrics file
      const workflowRunId =
        options.workflowRunId || metrics.workflow_run_id || `workflow_${Date.now()}`;

      // Aggregate and calculate
      const stepResults = aggregateStepResults(metrics);
      const workflowMetrics = calculateWorkflowMetrics(stepResults, {
        start_time: metrics.start_time,
        end_time: metrics.end_time || new Date().toISOString(),
        workflow_run_id: workflowRunId,
        version: metrics.version,
        mode: metrics.mode,
      });

      const timeline = generateExecutionTimeline(stepResults);
      const cacheEfficiency = calculateCacheEfficiency(metrics);
      const recommendations = generateRecommendations(
        workflowMetrics,
        stepResults,
        cacheEfficiency
      );

      // Generate report
      const report = formatSummaryReport(workflowMetrics, timeline, recommendations);

      // Write report to file
      if (!options.dryRun) {
        await this.writeSummaryReport(report, workflowRunId);
      }

      logger.info(`${colors.green}✓${colors.reset} Workflow summary generated successfully`);

      return {
        metrics: workflowMetrics,
        timeline,
        cacheEfficiency,
        recommendations,
        report,
      };
    } catch (error) {
      logger.error(`Failed to generate workflow summary: ${error.message}`);
      throw error;
    }
  }

  /**
   * Read metrics from current_run.json
   * @returns {Promise<Object>} Metrics data
   */
  async readMetrics() {
    const metricsPath = path.join(this.metricsDir, 'current_run.json');

    try {
      const content = await fs.readFile(metricsPath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      logger.warn(`Could not read metrics file: ${error.message}`);
      return { steps: {} };
    }
  }

  /**
   * Write summary report to file
   * @param {string} report - Markdown report content
   * @param {string} workflowRunId - Workflow run ID
   * @returns {Promise<string>} Path to written report
   */
  async writeSummaryReport(report, workflowRunId) {
    const summaryDir = path.join(this.summariesDir, workflowRunId);
    const reportPath = path.join(summaryDir, 'workflow_summary.md');

    // Ensure directory exists
    await fs.mkdir(summaryDir, { recursive: true });

    // Write report
    await fs.writeFile(reportPath, report, 'utf-8');

    logger.info(`Summary report written to: ${reportPath}`);

    return reportPath;
  }

  /**
   * Execute step 17 (main entry point for workflow orchestrator)
   * @param {Object} context - Execution context
   * @returns {Promise<Object>} Execution result
   */
  async execute(context = {}) {
    try {
      const summary = await this.generateSummary(context);

      return {
        success: true,
        summary,
        message: 'Workflow summary generated successfully',
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: 'Failed to generate workflow summary',
      };
    }
  }
}

/**
 * Main execution function for step 17
 * @param {Object} context - Execution context
 * @returns {Promise<Object>} Execution result
 */
export async function executeStep17(context = {}) {
  const summary = new WorkflowSummary(context.workflowDir);
  return await summary.execute(context);
}

export default WorkflowSummary;
