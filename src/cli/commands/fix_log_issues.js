/**
 * @fileoverview CLI Fix Log Issues Command
 * @module cli/commands/fix_log_issues
 *
 * Implements the 'fix-log-issues' command: reads workflow log files,
 * extracts issues, validates them against the actual codebase, and
 * outputs a structured Markdown fix plan.
 *
 * Architecture: v2.0.0 Pattern
 * - Pure functions for option validation, path resolution, and display formatting
 * - Impure wrapper for filesystem I/O, log reading, and output
 *
 * @version 2.0.0
 * @since 2026-03-12
 */

import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { logger } from '../../core/logger.js';
import {
  discoverLogFiles,
  extractIssues,
  filterBySeverity,
  validateFileReferences,
  generateFixPlan,
  formatFixPlanMarkdown,
  SEVERITY,
} from '../../lib/log_parser.js';

// ============================================================================
// PURE FUNCTIONS - Option Validation & Formatting
// ============================================================================

/**
 * Validate fix-log-issues command options.
 * @pure
 * @param {Object} options - Command options
 * @returns {{ isValid: boolean, errors: string[] }}
 */
export function validateFixLogOptions(options) {
  const errors = [];
  const validSeverities = ['critical', 'warning', 'all'];

  if (options.severity && !validSeverities.includes(options.severity)) {
    errors.push(
      `Invalid --severity value '${options.severity}'. Must be one of: ${validSeverities.join(', ')}`
    );
  }

  if (options.logDir && typeof options.logDir !== 'string') {
    errors.push('--log-dir must be a string path');
  }

  if (options.output && typeof options.output !== 'string') {
    errors.push('--output must be a string path');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Resolve the log directory from options, with fallback to workflow directory default.
 * @pure
 * @param {Object} options - Command options
 * @param {string} cwd - Current working directory
 * @returns {string} Resolved absolute path to the log directory
 */
export function resolveLogDirectory(options, cwd) {
  const base = options.projectRoot || cwd;

  if (options.logDir) {
    return path.isAbsolute(options.logDir) ? options.logDir : path.resolve(base, options.logDir);
  }

  const workflowDir = options.workflowDir || '.ai_workflow';
  return path.resolve(base, workflowDir, 'logs');
}

/**
 * Resolve the project root from options or cwd.
 * @pure
 * @param {Object} options - Command options
 * @param {string} cwd - Current working directory
 * @returns {string} Resolved absolute project root path
 */
export function resolveProjectRoot(options, cwd) {
  if (!options.projectRoot) return cwd;
  return path.isAbsolute(options.projectRoot)
    ? options.projectRoot
    : path.resolve(cwd, options.projectRoot);
}

/**
 * Format a terminal summary line for an issue count.
 * @pure
 * @param {number} critical - Count of critical issues
 * @param {number} warning - Count of warning issues
 * @param {number} total - Total issue count
 * @returns {string[]} Lines for terminal output
 */
export function formatIssueSummary(critical, warning, total) {
  const lines = [];

  if (total === 0) {
    lines.push(chalk.green('✅  No issues found in the selected log files.'));
    return lines;
  }

  lines.push(chalk.white.bold(`Found ${total} issue(s):`));
  if (critical > 0) lines.push(chalk.red(`  🔴 Critical: ${critical}`));
  if (warning > 0) lines.push(chalk.yellow(`  ⚠️  Warning:  ${warning}`));
  const info = total - critical - warning;
  if (info > 0) lines.push(chalk.gray(`  ℹ️  Info:     ${info}`));

  return lines;
}

// ============================================================================
// IMPURE WRAPPER - Command Entry Point
// ============================================================================

/**
 * Execute the fix-log-issues command.
 * @param {Object} options - Command options
 * @param {string} [options.logDir] - Path to log directory
 * @param {string} [options.projectRoot] - Project root directory
 * @param {string} [options.workflowDir] - Workflow directory (default: .ai_workflow)
 * @param {string} [options.output] - Path to write Markdown fix plan
 * @param {boolean} [options.latest] - Use only the most recent log run
 * @param {string} [options.severity] - Filter severity (critical|warning|all)
 * @param {boolean} [options.dryRun] - Preview without writing to output file
 * @param {boolean} [options.verbose] - Enable verbose output
 * @returns {Promise<void>}
 */
export async function fixLogIssuesCommand(options = {}) {
  const cwd = process.cwd();

  // Validate options
  const validation = validateFixLogOptions(options);
  if (!validation.isValid) {
    validation.errors.forEach((err) => logger.error(`  ${err}`));
    process.exit(1);
  }

  const logDir = resolveLogDirectory(options, cwd);
  const projectRoot = resolveProjectRoot(options, cwd);
  const severity = options.severity || 'all';
  const latestOnly = options.latest || false;
  const dryRun = options.dryRun || false;

  console.log('');
  console.log(chalk.cyan.bold('Fix Log Issues'));
  console.log(chalk.gray('─'.repeat(60)));
  console.log(chalk.gray(`Log directory:  ${logDir}`));
  console.log(chalk.gray(`Project root:   ${projectRoot}`));
  console.log(chalk.gray(`Severity filter: ${severity}`));
  if (latestOnly) console.log(chalk.gray('Mode:           latest run only'));
  console.log('');

  // Discover log files
  const spinner = ora('Discovering log files...').start();
  const runs = discoverLogFiles(logDir, latestOnly, fs);

  if (runs.length === 0) {
    spinner.fail(chalk.yellow(`No workflow log runs found in: ${logDir}`));
    process.exit(0);
  }

  const allLogFiles = runs.flatMap((r) => r.files);
  spinner.succeed(`Found ${runs.length} run(s), ${allLogFiles.length} log file(s)`);

  // Parse log files
  const parseSpinner = ora('Parsing log files for issues...').start();
  let allIssues = [];
  const runLabel = runs.map((r) => path.basename(r.runDir)).join(', ');

  for (const file of allLogFiles) {
    try {
      const content = fs.readFileSync(file, 'utf-8');
      const issues = extractIssues(content);
      allIssues.push(...issues);
      if (options.verbose) {
        logger.debug(`  ${path.basename(file)}: ${issues.length} issue(s)`);
      }
    } catch (err) {
      logger.warn(`Could not read log file: ${file} (${err.message})`);
    }
  }

  parseSpinner.succeed(
    `Parsed ${allLogFiles.length} file(s), found ${allIssues.length} raw issue(s)`
  );

  // Filter by severity
  const filtered = filterBySeverity(allIssues, severity);

  // Validate file references against codebase
  const validationSpinner = ora('Validating file references against codebase...').start();
  const validated = validateFileReferences(filtered, projectRoot, fs);
  validationSpinner.succeed('File reference validation complete');

  // Generate plan
  const plan = generateFixPlan(validated, projectRoot, logDir, runLabel);

  // Print summary to terminal
  console.log('');
  const summaryLines = formatIssueSummary(
    plan.counts[SEVERITY.CRITICAL] || 0,
    plan.counts[SEVERITY.WARNING] || 0,
    plan.totalIssues
  );
  summaryLines.forEach((line) => console.log(line));

  // Print issues to terminal (abbreviated)
  if (plan.totalIssues > 0 && !options.quiet) {
    console.log('');
    console.log(chalk.white.bold('Issues:'));
    console.log(chalk.gray('─'.repeat(60)));

    plan.sortedIssues.forEach((issue, idx) => {
      const severityColor =
        issue.severity === SEVERITY.CRITICAL
          ? chalk.red
          : issue.severity === SEVERITY.WARNING
            ? chalk.yellow
            : chalk.gray;

      const stepInfo = issue.stepId ? chalk.gray(` [${issue.stepId}]`) : '';
      console.log(
        `  ${idx + 1}. ${severityColor(`[${issue.severity.toUpperCase()}]`)}${stepInfo} ${issue.message}`
      );
    });
  }

  // Generate and write/display Markdown fix plan
  const markdown = formatFixPlanMarkdown(plan, new Date().toISOString());

  if (options.output) {
    if (dryRun) {
      console.log('');
      console.log(chalk.yellow(`[dry-run] Would write fix plan to: ${options.output}`));
    } else {
      try {
        const outputPath = path.isAbsolute(options.output)
          ? options.output
          : path.resolve(cwd, options.output);
        fs.mkdirSync(path.dirname(outputPath), { recursive: true });
        fs.writeFileSync(outputPath, markdown, 'utf-8');
        console.log('');
        console.log(chalk.green(`✅  Fix plan written to: ${outputPath}`));
      } catch (err) {
        logger.error(`Failed to write output file: ${err.message}`);
      }
    }
  } else {
    // No output file specified — print Markdown to stdout (after the summary)
    console.log('');
    console.log(chalk.gray('─'.repeat(60)));
    console.log(markdown);
  }

  // Exit with code 1 if critical issues found
  if ((plan.counts[SEVERITY.CRITICAL] || 0) > 0) {
    process.exit(1);
  }
}

export default {
  fixLogIssuesCommand,
  validateFixLogOptions,
  resolveLogDirectory,
  resolveProjectRoot,
  formatIssueSummary,
};
