/**
 * @fileoverview CLI Status Command
 * @module cli/commands/status
 *
 * Implements the 'status' command for displaying workflow status.
 *
 * Architecture: v2.0.0 Pattern
 * - Pure functions for formatting
 * - Impure wrapper for file I/O
 *
 * @version 1.0.0
 * @since 2026-02-10
 */
import chalk from 'chalk';
import { logger } from '../../core/logger.js';
// @ts-expect-error - legacy JS checkpoint manager module is untyped in the current TypeScript setup.
import { CheckpointManager } from '../../orchestrator/checkpoint_manager.js';
function getStepCount(steps) {
    return steps?.length ?? 0;
}
// ============================================================================
// PURE FUNCTIONS - Formatting Logic
// ============================================================================
/**
 * Format workflow status for display
 * @pure
 */
export function formatWorkflowStatus(status) {
    if (!status) {
        return 'No workflow status available';
    }
    const lines = [];
    lines.push(chalk.cyan.bold('Workflow Status'));
    lines.push(chalk.gray('─'.repeat(60)));
    lines.push('');
    if (status.checkpoints && status.checkpoints.length > 0) {
        const latest = status.checkpoints[0];
        lines.push(chalk.white(`Latest Checkpoint: ${latest.workflowId}`));
        lines.push(chalk.gray(`  Date: ${new Date(latest.timestamp).toLocaleString()}`));
        lines.push(chalk.gray(`  Progress: ${latest.metadata?.progress || 0}%`));
        lines.push(chalk.gray(`  Steps: ${latest.state.completedSteps?.length ?? 0}/${latest.metadata?.totalSteps || 0}`));
    }
    else {
        lines.push(chalk.yellow('No checkpoints found'));
    }
    lines.push('');
    if (status.metrics) {
        lines.push(chalk.cyan.bold('Recent Metrics'));
        lines.push(chalk.gray('─'.repeat(60)));
        lines.push('');
        lines.push(chalk.white(`Total Executions: ${status.metrics.totalExecutions || 0}`));
        lines.push(chalk.white(`Average Duration: ${status.metrics.avgDuration || 0}s`));
        lines.push(chalk.white(`Success Rate: ${status.metrics.successRate || 0}%`));
    }
    return lines.join('\n');
}
/**
 * Calculate summary statistics
 * @pure
 */
export function calculateSummaryStats(checkpoints, metrics) {
    const metricsList = metrics ?? [];
    return {
        totalCheckpoints: checkpoints?.length ?? 0,
        totalExecutions: metricsList.length,
        latestCheckpoint: checkpoints?.[0] ?? null,
        avgDuration: metricsList.reduce((sum, metric) => sum + (metric.duration || 0), 0) /
            (metricsList.length || 1) || 0,
        successRate: ((metricsList.filter((metric) => metric.success).length || 0) / (metricsList.length || 1)) *
            100 || 0,
    };
}
// ============================================================================
// IMPURE WRAPPER - Command Execution
// ============================================================================
/**
 * Execute the status command
 */
export async function statusCommand(options = {}) {
    try {
        const workflowDir = options.workflowDir || '.ai_workflow';
        console.log();
        console.log(chalk.blue('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
        console.log(chalk.blue('  Workflow Status'));
        console.log(chalk.blue('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
        console.log();
        // Load checkpoints
        const checkpointManager = new CheckpointManager(workflowDir);
        let checkpoints = [];
        try {
            checkpoints = await checkpointManager.list();
            // Sort by timestamp descending
            checkpoints.sort((leftCheckpoint, rightCheckpoint) => Number(new Date(rightCheckpoint.timestamp)) - Number(new Date(leftCheckpoint.timestamp)));
        }
        catch {
            logger.warn(chalk.yellow('Could not load checkpoints'));
        }
        // Display status
        if (checkpoints.length === 0) {
            console.log(chalk.yellow('No workflow checkpoints found'));
            console.log(chalk.gray('Run a workflow first: ai-workflow run'));
            console.log();
            process.exit(0);
        }
        // Display latest checkpoint
        const latest = checkpoints[0];
        console.log(chalk.cyan.bold('Latest Checkpoint'));
        console.log(chalk.gray('─'.repeat(60)));
        console.log(chalk.white(`ID: ${latest.workflowId}`));
        console.log(chalk.white(`Date: ${new Date(latest.timestamp).toLocaleString()}`));
        console.log(chalk.white(`Progress: ${latest.metadata?.progress || 0}%`));
        console.log(chalk.white(`Steps Completed: ${getStepCount(latest.state.completedSteps)}/${latest.metadata?.totalSteps || 0}`));
        const failedStepsCount = getStepCount(latest.state.failedSteps);
        if (failedStepsCount > 0) {
            console.log(chalk.red(`Failed Steps: ${failedStepsCount}`));
        }
        console.log();
        // Display checkpoint history
        if (checkpoints.length > 1) {
            console.log(chalk.cyan.bold('Checkpoint History'));
            console.log(chalk.gray('─'.repeat(60)));
            console.log(chalk.gray(`Total checkpoints: ${checkpoints.length}`));
            console.log(chalk.gray(`Oldest: ${new Date(checkpoints[checkpoints.length - 1].timestamp).toLocaleString()}`));
            console.log();
        }
        // Display quick actions
        console.log(chalk.cyan.bold('Quick Actions'));
        console.log(chalk.gray('─'.repeat(60)));
        console.log(chalk.white('Resume latest:  ') + chalk.cyan('ai-workflow resume --latest'));
        console.log(chalk.white('List all:       ') + chalk.cyan('ai-workflow resume --list'));
        console.log(chalk.white('Run new:        ') + chalk.cyan('ai-workflow run'));
        console.log();
        process.exit(0);
    }
    catch (error) {
        const errorDetails = error instanceof Error ? error : new Error(String(error));
        logger.error(chalk.red(`Error: ${errorDetails.message}`));
        if (options.verbose && errorDetails.stack) {
            logger.error(chalk.gray(errorDetails.stack));
        }
        process.exit(1);
    }
}
export default { statusCommand, formatWorkflowStatus, calculateSummaryStats };
