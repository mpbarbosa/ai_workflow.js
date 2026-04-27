/**
 * @fileoverview CLI Clean Command
 * @module cli/commands/clean
 *
 * Implements the 'clean' command for cleaning workflow artifacts.
 *
 * Architecture: v2.0.0 Pattern
 * - Pure functions for filtering and calculation
 * - Impure wrapper for file operations
 *
 * @version 1.0.0
 * @since 2026-02-10
 */
import chalk from 'chalk';
import ora from 'ora';
import { logger } from '../../core/logger.js';
import { CleanupManager } from '../../lib/cleanup_handlers.js';
// ============================================================================
// PURE FUNCTIONS - Command Logic
// ============================================================================
/**
 * Validate clean command options
 * @pure
 */
export function validateCleanOptions(options) {
    const errors = [];
    // If --all is specified, individual flags should not be set
    if (options.all && (options.artifacts || options.cache || options.checkpoints)) {
        errors.push('Cannot use --all with other flags');
    }
    // At least one option must be specified
    if (!options.all && !options.artifacts && !options.cache && !options.checkpoints) {
        errors.push('Must specify at least one cleanup option (--all, --artifacts, --cache, --checkpoints)');
    }
    return {
        isValid: errors.length === 0,
        errors,
    };
}
/**
 * Determine what to clean based on options
 * @pure
 */
export function determineCleanupTargets(options) {
    if (options.all) {
        return {
            artifacts: true,
            cache: true,
            checkpoints: true,
            sessions: true,
            metrics: true,
        };
    }
    return {
        artifacts: options.artifacts || false,
        cache: options.cache || false,
        checkpoints: options.checkpoints || false,
        sessions: false,
        metrics: false,
    };
}
/**
 * Format cleanup result for display
 * @pure
 */
export function formatCleanupResult(result) {
    if (!result) {
        return 'No cleanup result';
    }
    const filesDeleted = result.filesDeleted ?? 0;
    const bytesFreed = result.bytesFreed ?? 0;
    const lines = [];
    if (filesDeleted > 0) {
        lines.push(`Deleted ${filesDeleted} file(s)`);
    }
    if (bytesFreed > 0) {
        const mb = (bytesFreed / (1024 * 1024)).toFixed(2);
        lines.push(`Freed ${mb} MB`);
    }
    if (lines.length === 0) {
        return 'Nothing to clean';
    }
    return lines.join(', ');
}
// ============================================================================
// IMPURE WRAPPER - Command Execution
// ============================================================================
/**
 * Execute the clean command
 */
export async function cleanCommand(options) {
    let spinner = null;
    try {
        // Validate options
        const validation = validateCleanOptions(options);
        if (!validation.isValid) {
            logger.error(chalk.red('Invalid options:'));
            validation.errors.forEach((err) => logger.error(chalk.red(`  - ${err}`)));
            process.exit(1);
        }
        const workflowDir = options.workflowDir || '.ai_workflow';
        const targets = determineCleanupTargets(options);
        // Display what will be cleaned
        console.log();
        console.log(chalk.blue('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
        console.log(chalk.blue(`  Cleaning Workflow ${options.dryRun ? '(Dry Run)' : ''}`));
        console.log(chalk.blue('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
        console.log();
        console.log(chalk.cyan('Cleanup targets:'));
        if (targets.artifacts)
            console.log(chalk.white('  - Workflow artifacts'));
        if (targets.cache)
            console.log(chalk.white('  - Cache files'));
        if (targets.checkpoints)
            console.log(chalk.white('  - Checkpoints'));
        if (targets.sessions)
            console.log(chalk.white('  - Sessions'));
        if (targets.metrics)
            console.log(chalk.white('  - Metrics'));
        console.log();
        if (options.dryRun) {
            console.log(chalk.yellow('Dry run mode: No files will be deleted'));
            console.log();
        }
        // Create cleanup manager
        const cleanupManager = new CleanupManager(workflowDir);
        // Setup spinner
        if (!options.verbose && !options.dryRun) {
            spinner = ora('Cleaning...').start();
        }
        // Perform cleanup
        let totalFilesDeleted = 0;
        let totalBytesFreed = 0;
        if (targets.artifacts || targets.all) {
            const result = await cleanupManager.cleanupArtifacts({
                dryRun: options.dryRun,
                olderThanDays: options.olderThanDays || 0,
            });
            totalFilesDeleted += result.filesDeleted || 0;
            totalBytesFreed += result.bytesFreed || 0;
            if (options.verbose) {
                console.log(chalk.gray(`Artifacts: ${formatCleanupResult(result)}`));
            }
        }
        if (targets.cache || targets.all) {
            const result = await cleanupManager.cleanupCache({
                dryRun: options.dryRun,
            });
            totalFilesDeleted += result.filesDeleted || 0;
            totalBytesFreed += result.bytesFreed || 0;
            if (options.verbose) {
                console.log(chalk.gray(`Cache: ${formatCleanupResult(result)}`));
            }
        }
        if (targets.checkpoints || targets.all) {
            const result = await cleanupManager.cleanupCheckpoints({
                dryRun: options.dryRun,
                keepLast: options.keepLast || 5,
            });
            totalFilesDeleted += result.filesDeleted || 0;
            totalBytesFreed += result.bytesFreed || 0;
            if (options.verbose) {
                console.log(chalk.gray(`Checkpoints: ${formatCleanupResult(result)}`));
            }
        }
        // Stop spinner
        if (spinner) {
            spinner.succeed('Cleanup complete');
        }
        // Display summary
        console.log();
        if (options.dryRun) {
            console.log(chalk.yellow(`Would delete ${totalFilesDeleted} file(s)`));
            if (totalBytesFreed > 0) {
                const mb = (totalBytesFreed / (1024 * 1024)).toFixed(2);
                console.log(chalk.yellow(`Would free ${mb} MB`));
            }
        }
        else {
            console.log(chalk.green(`✓ Deleted ${totalFilesDeleted} file(s)`));
            if (totalBytesFreed > 0) {
                const mb = (totalBytesFreed / (1024 * 1024)).toFixed(2);
                console.log(chalk.green(`✓ Freed ${mb} MB`));
            }
        }
        console.log();
        process.exit(0);
    }
    catch (error) {
        // Stop spinner on error
        if (spinner) {
            spinner.fail('Cleanup failed');
        }
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(chalk.red(`Error: ${errorMessage}`));
        if (options.verbose && error instanceof Error && error.stack) {
            logger.error(chalk.gray(error.stack));
        }
        process.exit(1);
    }
}
const cleanCommandExports = {
    cleanCommand,
    validateCleanOptions,
    determineCleanupTargets,
    formatCleanupResult,
};
export default cleanCommandExports;
