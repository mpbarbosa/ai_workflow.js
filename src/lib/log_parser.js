/**
 * @fileoverview Workflow Log Parser
 * @module lib/log_parser
 *
 * Parses AI workflow log files to extract, categorize, validate, and
 * generate fix plans for reported issues.
 *
 * Architecture: v2.0.0 Pattern
 * - Pure functions for all parsing, categorization, and plan generation
 * - Filesystem access injected as a parameter for testability
 *
 * @version 2.0.0
 * @since 2026-03-12
 */

import path from 'path';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Severity levels in priority order (highest first) */
export const SEVERITY = Object.freeze({
  CRITICAL: 'critical',
  WARNING: 'warning',
  INFO: 'info',
});

/** Issue category identifiers */
export const CATEGORY = Object.freeze({
  PERFORMANCE: 'performance',
  TEST_FAILURE: 'test_failure',
  DEPENDENCY: 'dependency',
  COVERAGE: 'coverage',
  AI_QUALITY: 'ai_quality',
  LINTING: 'linting',
  ANTI_PATTERN: 'anti_pattern',
  FILE_REFERENCE: 'file_reference',
  STEP_ISSUES: 'step_issues',
  GENERAL: 'general',
});

/** Severity priority for sorting (lower = higher priority) */
const SEVERITY_PRIORITY = {
  [SEVERITY.CRITICAL]: 0,
  [SEVERITY.WARNING]: 1,
  [SEVERITY.INFO]: 2,
};

/** Severity emoji for Markdown output */
const SEVERITY_EMOJI = {
  [SEVERITY.CRITICAL]: '🔴',
  [SEVERITY.WARNING]: '⚠️',
  [SEVERITY.INFO]: 'ℹ️',
};

/** Category labels for Markdown output */
const CATEGORY_LABELS = {
  [CATEGORY.PERFORMANCE]: 'Performance',
  [CATEGORY.TEST_FAILURE]: 'Test Failure',
  [CATEGORY.DEPENDENCY]: 'Dependency',
  [CATEGORY.COVERAGE]: 'Coverage',
  [CATEGORY.AI_QUALITY]: 'AI Quality',
  [CATEGORY.LINTING]: 'Linting',
  [CATEGORY.ANTI_PATTERN]: 'Anti-Pattern',
  [CATEGORY.FILE_REFERENCE]: 'File Reference',
  [CATEGORY.STEP_ISSUES]: 'Step Issues',
  [CATEGORY.GENERAL]: 'General',
};

// ============================================================================
// LOG LINE PARSING
// ============================================================================

/**
 * Parse a single log line into its components.
 * @pure
 * @param {string} line - Raw log line
 * @returns {{ timestamp: string|null, severity: string|null, message: string, stepId: string|null, raw: string }}
 */
export function parseLogLine(line) {
  if (typeof line !== 'string') {
    return { timestamp: null, severity: null, message: '', stepId: null, raw: '' };
  }

  // Extract timestamp: [2026-03-12T18:13:22.049Z]
  const timestampMatch = line.match(/^\[(\d{4}-\d{2}-\d{2}T[\d:.]+Z)\]\s*/);
  const timestamp = timestampMatch ? timestampMatch[1] : null;
  const afterTimestamp = timestampMatch ? line.slice(timestampMatch[0].length) : line;

  // Determine severity from message content
  let severity = null;
  if (/✗\s*\[CRITICAL\]/.test(afterTimestamp)) {
    severity = SEVERITY.CRITICAL;
  } else if (/⚠\s*\[WARNING\]/.test(afterTimestamp) || afterTimestamp.startsWith('⚠')) {
    severity = SEVERITY.WARNING;
  }

  // Extract step ID if present: step_XX or [step_XX]
  const stepMatch = afterTimestamp.match(/\bstep_([0-9a-f_]+)\b/i);
  const stepId = stepMatch ? `step_${stepMatch[1]}` : null;

  return {
    timestamp,
    severity,
    message: afterTimestamp.trim(),
    stepId,
    raw: line,
  };
}

// ============================================================================
// ISSUE EXTRACTION
// ============================================================================

/**
 * Patterns that identify issues worth extracting from logs.
 * Each entry: { pattern, severity, category, extractMessage }
 */
const ISSUE_PATTERNS = [
  // Critical performance
  {
    pattern: /✗\s*\[CRITICAL\]\s*Operation '(step_[^']+)' took ([\d.]+)s \(memory: ([\d.]+MB)\)/,
    severity: SEVERITY.CRITICAL,
    category: CATEGORY.PERFORMANCE,
    extractMessage: (m) =>
      `Operation '${m[1]}' exceeded critical threshold: ${m[2]}s elapsed, ${m[3]} memory used`,
    extractStep: (m) => m[1],
  },
  // Warning performance
  {
    pattern: /⚠\s*\[WARNING\]\s*Operation '(step_[^']+)' took ([\d.]+)s \(memory: ([\d.]+MB)\)/,
    severity: SEVERITY.WARNING,
    category: CATEGORY.PERFORMANCE,
    extractMessage: (m) =>
      `Operation '${m[1]}' exceeded warning threshold: ${m[2]}s elapsed, ${m[3]} memory used`,
    extractStep: (m) => m[1],
  },
  // Test runner crash / no output
  {
    pattern: /⚠\s*\[(step_[^\]]+)\]\s*Test runner produced no output/,
    severity: SEVERITY.CRITICAL,
    category: CATEGORY.TEST_FAILURE,
    extractMessage: (m) => `${m[1]}: Test runner produced no output (possible crash or OOM kill)`,
    extractStep: (m) => m[1],
  },
  // Step completed with issues
  {
    pattern: /⚠\s*Step (\d+) completed - (\d+) issue\(s\) found/,
    severity: SEVERITY.WARNING,
    category: CATEGORY.STEP_ISSUES,
    extractMessage: (m) => `Step ${m[1]} completed with ${m[2]} issue(s) detected`,
    extractStep: () => null,
  },
  // Step test runner exit code 1
  {
    pattern: /⚠\s*Step (\d+) completed - test runner exited with code 1/,
    severity: SEVERITY.CRITICAL,
    category: CATEGORY.TEST_FAILURE,
    extractMessage: (m) =>
      `Step ${m[1]}: test runner exited with code 1 — ${m[0].replace(/^⚠\s*/, '')}`,
    extractStep: () => null,
  },
  // npm install failure
  {
    pattern: /⚠\s*npm install --dry-run failed/,
    severity: SEVERITY.WARNING,
    category: CATEGORY.DEPENDENCY,
    extractMessage: () => 'npm install --dry-run failed — possible unresolvable lockfile entries',
    extractStep: () => null,
  },
  // No coverage reports
  {
    pattern: /⚠\s*No coverage reports found/,
    severity: SEVERITY.WARNING,
    category: CATEGORY.COVERAGE,
    extractMessage: () => 'No coverage reports found — test coverage cannot be verified',
    extractStep: () => null,
  },
  // AI response quality low
  {
    pattern: /⚠\s*Step (\d+) AI response quality low: (.+)/,
    severity: SEVERITY.WARNING,
    category: CATEGORY.AI_QUALITY,
    extractMessage: (m) => `Step ${m[1]} AI response quality low: ${m[2]}`,
    extractStep: () => null,
  },
  // Markdown linting violations
  {
    pattern: /⚠\s*Found (\d+) markdown linting violations/,
    severity: SEVERITY.WARNING,
    category: CATEGORY.LINTING,
    extractMessage: (m) => `Found ${m[1]} markdown linting violations`,
    extractStep: () => null,
  },
  // Anti-pattern occurrences
  {
    pattern: /⚠\s*Detected (\d+) anti-pattern occurrences/,
    severity: SEVERITY.WARNING,
    category: CATEGORY.ANTI_PATTERN,
    extractMessage: (m) => `Detected ${m[1]} anti-pattern occurrence(s) in codebase`,
    extractStep: () => null,
  },
];

/**
 * Suggested fix actions by category.
 * @pure
 * @param {string} category - Issue category
 * @param {string} severity - Issue severity
 * @returns {string} Suggested fix action
 */
export function suggestFix(category, severity) {
  const fixes = {
    [CATEGORY.PERFORMANCE]:
      severity === SEVERITY.CRITICAL
        ? 'Investigate the step for performance bottlenecks. Consider splitting the operation, adding caching, or increasing timeout thresholds in .workflow-config.yaml.'
        : 'Monitor this step — consider optimizing if the trend continues across multiple runs.',
    [CATEGORY.TEST_FAILURE]:
      'Run the test suite manually (`npm test`) to reproduce the failure. Check for OOM conditions, missing test dependencies, or environment issues.',
    [CATEGORY.DEPENDENCY]:
      'Run `npm install` to refresh the lockfile. Check for incompatible version ranges in package.json. Consider running `npm audit fix`.',
    [CATEGORY.COVERAGE]:
      'Ensure test commands produce coverage reports. Verify jest/vitest coverage configuration in package.json or jest.config.json.',
    [CATEGORY.AI_QUALITY]:
      'Review the AI prompt for this step. The AI response may not be referencing enough project files — check ai_prompt_builder configuration.',
    [CATEGORY.LINTING]:
      'Run `npm run lint:md` or `markdownlint --fix` on the affected files. Review .markdownlint.json configuration.',
    [CATEGORY.ANTI_PATTERN]:
      'Review flagged files for anti-pattern usage. Run step_13 manually to get the list of affected files and apply suggested refactors.',
    [CATEGORY.FILE_REFERENCE]:
      'The referenced file no longer exists on disk. Update or remove references in documentation, configuration, or test files.',
    [CATEGORY.STEP_ISSUES]:
      'Inspect the detailed step log for specific issue descriptions. Re-run the step in isolation using `ai-workflow run --stage quick`.',
    [CATEGORY.GENERAL]:
      'Review the log entry in context and investigate the relevant step or module.',
  };

  return fixes[category] || fixes[CATEGORY.GENERAL];
}

/**
 * Extract all issues from log file content.
 * @pure
 * @param {string} logContent - Raw log file content
 * @returns {Array<{timestamp: string|null, severity: string, category: string, message: string, stepId: string|null, suggestedFix: string, raw: string}>}
 */
export function extractIssues(logContent) {
  if (!logContent || typeof logContent !== 'string') {
    return [];
  }

  const issues = [];
  const lines = logContent.split('\n');

  for (const line of lines) {
    const parsed = parseLogLine(line);

    for (const { pattern, severity, category, extractMessage, extractStep } of ISSUE_PATTERNS) {
      const match = parsed.message.match(pattern) || line.match(pattern);
      if (match) {
        const message = extractMessage(match);
        const stepId = extractStep(match) || parsed.stepId;
        issues.push({
          timestamp: parsed.timestamp,
          severity,
          category,
          message,
          stepId,
          suggestedFix: suggestFix(category, severity),
          raw: line.trim(),
        });
        break; // Only match first pattern per line
      }
    }
  }

  return issues;
}

// ============================================================================
// LOG FILE DISCOVERY
// ============================================================================

/**
 * Recursively collect files from a directory matching an extension filter.
 * @pure
 * @param {string} dir - Directory to walk
 * @param {string[]} extensions - Allowed file extensions (e.g. ['.log', '.md'])
 * @param {{ readdirSync: Function, statSync: Function }} fs - Filesystem interface
 * @returns {string[]} Absolute file paths
 */
export function collectFilesRecursive(dir, extensions, fs) {
  let results = [];
  let entries;
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return results;
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry);
    try {
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        results = results.concat(collectFilesRecursive(fullPath, extensions, fs));
      } else if (extensions.some((ext) => entry.endsWith(ext))) {
        results.push(fullPath);
      }
    } catch {
      // skip unreadable entries
    }
  }

  return results;
}

/**
 * Discover log files within a log directory, including prompt logs (prompts/**\/*.md).
 * @pure
 * @param {string} logDir - Path to log directory
 * @param {boolean} latestOnly - Whether to use only the most recent run folder
 * @param {{ readdirSync: Function, statSync: Function, existsSync: Function }} fs - Filesystem interface
 * @returns {Array<{ runDir: string, files: string[] }>} Discovered run directories and their log files
 */
export function discoverLogFiles(logDir, latestOnly, fs) {
  if (!fs.existsSync(logDir)) {
    return [];
  }

  let entries;
  try {
    entries = fs.readdirSync(logDir);
  } catch {
    return [];
  }

  // Filter to workflow run directories (workflow_YYYYMMDD_HHMMSS pattern)
  const runDirs = entries
    .filter((entry) => /^workflow_\d{8}_\d{6}$/.test(entry))
    .map((entry) => ({
      name: entry,
      fullPath: path.join(logDir, entry),
    }))
    .filter(({ fullPath }) => {
      try {
        return fs.statSync(fullPath).isDirectory();
      } catch {
        return false;
      }
    })
    .sort((a, b) => b.name.localeCompare(a.name)); // Most recent first

  const selected = latestOnly ? runDirs.slice(0, 1) : runDirs;

  return selected.map(({ name, fullPath }) => {
    // Collect .log and .md files recursively (includes prompts/**/*.md)
    const files = collectFilesRecursive(fullPath, ['.log', '.md'], fs);
    return { runDir: path.join(logDir, name), files };
  });
}

// ============================================================================
// FILTERING & SORTING
// ============================================================================

/**
 * Filter issues by minimum severity level.
 * @pure
 * @param {Array} issues - All extracted issues
 * @param {string} severity - Minimum severity: 'critical' | 'warning' | 'all'
 * @returns {Array} Filtered issues
 */
export function filterBySeverity(issues, severity) {
  if (!Array.isArray(issues)) return [];

  if (severity === 'all' || !severity) return issues;

  const minPriority = SEVERITY_PRIORITY[severity] ?? SEVERITY_PRIORITY[SEVERITY.WARNING];
  return issues.filter((issue) => {
    const issuePriority = SEVERITY_PRIORITY[issue.severity] ?? SEVERITY_PRIORITY[SEVERITY.INFO];
    return issuePriority <= minPriority;
  });
}

/**
 * Sort issues by priority: severity (critical first), then timestamp.
 * @pure
 * @param {Array} issues - Issues to sort
 * @returns {Array} Sorted copy of issues
 */
export function sortIssuesByPriority(issues) {
  if (!Array.isArray(issues)) return [];

  return [...issues].sort((a, b) => {
    const aPriority = SEVERITY_PRIORITY[a.severity] ?? SEVERITY_PRIORITY[SEVERITY.INFO];
    const bPriority = SEVERITY_PRIORITY[b.severity] ?? SEVERITY_PRIORITY[SEVERITY.INFO];

    if (aPriority !== bPriority) return aPriority - bPriority;

    // Secondary sort: timestamp descending (most recent first)
    if (a.timestamp && b.timestamp) {
      return a.timestamp.localeCompare(b.timestamp);
    }
    return 0;
  });
}

// ============================================================================
// FILE REFERENCE VALIDATION
// ============================================================================

/**
 * Validate file paths referenced within log messages against the actual codebase.
 * Appends a `fileExists` boolean to issues that contain a detectable file path.
 * @pure
 * @param {Array} issues - Issues to validate
 * @param {string} projectRoot - Root directory of the project
 * @param {{ existsSync: Function }} fs - Filesystem interface
 * @returns {Array} Issues with optional `fileExists` and `referencedFile` fields
 */
export function validateFileReferences(issues, projectRoot, fs) {
  if (!Array.isArray(issues)) return [];

  // Match absolute paths or relative paths (with src/, test/, docs/ prefix)
  const pathPattern = /(?:\/[^\s,'"]+|(?:src|test|docs|lib|bin)\/[^\s,'"]+\.[a-z]{1,5})/g;

  return issues.map((issue) => {
    const matches = (issue.message + ' ' + issue.raw).match(pathPattern);
    if (!matches || matches.length === 0) return issue;

    // Take the first plausible file reference
    const candidate = matches[0];
    const resolved = path.isAbsolute(candidate) ? candidate : path.join(projectRoot, candidate);

    try {
      const exists = fs.existsSync(resolved);
      return { ...issue, referencedFile: resolved, fileExists: exists };
    } catch {
      return issue;
    }
  });
}

// ============================================================================
// FIX PLAN GENERATION
// ============================================================================

/**
 * Generate a structured fix plan from a list of issues.
 * @pure
 * @param {Array} issues - Sorted and filtered issues
 * @param {string} projectRoot - Project root path for context
 * @param {string} logDir - Log directory for context
 * @param {string} runLabel - Human-readable run identifier (e.g. run folder name)
 * @returns {{ projectRoot: string, logDir: string, runLabel: string, totalIssues: number, counts: Object, byCategory: Object, sortedIssues: Array }}
 */
export function generateFixPlan(issues, projectRoot, logDir, runLabel) {
  const sortedIssues = sortIssuesByPriority(issues);

  const counts = {
    [SEVERITY.CRITICAL]: 0,
    [SEVERITY.WARNING]: 0,
    [SEVERITY.INFO]: 0,
  };

  const byCategory = {};

  for (const issue of sortedIssues) {
    counts[issue.severity] = (counts[issue.severity] || 0) + 1;

    if (!byCategory[issue.category]) {
      byCategory[issue.category] = [];
    }
    byCategory[issue.category].push(issue);
  }

  return {
    projectRoot,
    logDir,
    runLabel,
    totalIssues: sortedIssues.length,
    counts,
    byCategory,
    sortedIssues,
  };
}

/**
 * Format a fix plan as Markdown.
 * @pure
 * @param {Object} plan - Plan object from generateFixPlan
 * @param {string} generatedAt - ISO timestamp string for the report date
 * @returns {string} Markdown content
 */
export function formatFixPlanMarkdown(plan, generatedAt) {
  const lines = [];
  const date = generatedAt ? new Date(generatedAt).toLocaleString() : new Date().toLocaleString();

  lines.push('# AI Workflow Fix Plan');
  lines.push('');
  lines.push(`**Generated:** ${date}`);
  if (plan.runLabel) lines.push(`**Log run:** ${plan.runLabel}`);
  if (plan.logDir) lines.push(`**Log directory:** \`${plan.logDir}\``);
  if (plan.projectRoot) lines.push(`**Project:** \`${plan.projectRoot}\``);
  lines.push('');
  lines.push('---');
  lines.push('');

  // Summary
  lines.push('## Summary');
  lines.push('');
  lines.push(`| Severity | Count |`);
  lines.push(`|----------|-------|`);
  lines.push(`| 🔴 Critical | ${plan.counts[SEVERITY.CRITICAL] || 0} |`);
  lines.push(`| ⚠️ Warning | ${plan.counts[SEVERITY.WARNING] || 0} |`);
  lines.push(`| ℹ️ Info | ${plan.counts[SEVERITY.INFO] || 0} |`);
  lines.push(`| **Total** | **${plan.totalIssues}** |`);
  lines.push('');

  if (plan.totalIssues === 0) {
    lines.push('✅ No issues found in the log files.');
    return lines.join('\n');
  }

  lines.push('---');
  lines.push('');

  // Issues by severity group
  const severityGroups = [
    { severity: SEVERITY.CRITICAL, label: 'Critical Issues' },
    { severity: SEVERITY.WARNING, label: 'Warning Issues' },
    { severity: SEVERITY.INFO, label: 'Info' },
  ];

  for (const { severity, label } of severityGroups) {
    const groupIssues = plan.sortedIssues.filter((i) => i.severity === severity);
    if (groupIssues.length === 0) continue;

    const emoji = SEVERITY_EMOJI[severity];
    lines.push(`## ${emoji} ${label} (${groupIssues.length})`);
    lines.push('');

    groupIssues.forEach((issue, idx) => {
      const categoryLabel = CATEGORY_LABELS[issue.category] || issue.category;
      lines.push(`### ${idx + 1}. ${categoryLabel}: ${issue.message}`);
      lines.push('');
      if (issue.timestamp) lines.push(`**Timestamp:** \`${issue.timestamp}\``);
      if (issue.stepId) lines.push(`**Step:** \`${issue.stepId}\``);
      lines.push(`**Category:** ${categoryLabel}`);
      if (issue.referencedFile !== undefined) {
        const existsNote = issue.fileExists ? '✅ exists' : '❌ missing on disk';
        lines.push(`**Referenced file:** \`${issue.referencedFile}\` (${existsNote})`);
      }
      lines.push('');
      lines.push(`**Suggested fix:**`);
      lines.push(`> ${issue.suggestedFix}`);
      lines.push('');
      lines.push(`<details><summary>Raw log entry</summary>`);
      lines.push('');
      lines.push('```');
      lines.push(issue.raw);
      lines.push('```');
      lines.push('</details>');
      lines.push('');
    });

    lines.push('---');
    lines.push('');
  }

  return lines.join('\n');
}

export default {
  SEVERITY,
  CATEGORY,
  parseLogLine,
  extractIssues,
  collectFilesRecursive,
  discoverLogFiles,
  suggestFix,
  filterBySeverity,
  sortIssuesByPriority,
  validateFileReferences,
  generateFixPlan,
  formatFixPlanMarkdown,
};
