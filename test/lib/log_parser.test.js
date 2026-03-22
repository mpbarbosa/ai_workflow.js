/**
 * @fileoverview Tests for Log Parser Module
 * @module test/lib/log_parser.test
 */

import { describe, test, expect } from '@jest/globals';
import {
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
} from '../../src/lib/log_parser.js';

// ============================================================================
// Test fixtures
// ============================================================================

const CRITICAL_PERF_LINE =
  "[2026-03-12T18:14:20.129Z] ✗ [CRITICAL] Operation 'step_02' took 39.8s (memory: 162.12MB)";

const WARNING_PERF_LINE =
  "[2026-03-12T18:13:40.288Z] ⚠ [WARNING] Operation 'step_04' took 14.7s (memory: 42.76MB)";

const WARNING_NPM_LINE =
  '[2026-03-12T18:16:28.577Z] ⚠ npm install --dry-run failed — possible unresolvable lockfile entries';

const WARNING_TEST_LINE =
  '[2026-03-12T19:07:30.134Z] ⚠ [step_08] Test runner produced no output (possible crash) — retrying with --ci flag';

const WARNING_STEP_ISSUES_LINE =
  '[2026-03-12T19:06:59.553Z] ⚠ Step 2 completed - 11 issue(s) found';

const WARNING_COVERAGE_LINE = '[2026-03-12T19:07:25.329Z] ⚠ No coverage reports found';

const WARNING_AI_QUALITY_LINE =
  '[2026-03-12T19:06:40.460Z] ⚠ Step 4 AI response quality low: AI response mentions only 2/14 files (14% < 30% threshold)';

const WARNING_LINTING_LINE = '[2026-03-12T19:08:13.540Z] ⚠ Found 231 markdown linting violations';

const WARNING_ANTI_PATTERN_LINE =
  '[2026-03-12T19:08:14.819Z] ⚠ Detected 17 anti-pattern occurrences';

const INFO_LINE = '[2026-03-12T18:13:22.050Z] Stage: full';
const DEBUG_LINE = '[2026-03-12T18:13:22.142Z] [DEBUG] Registered step: step_00';
const SEPARATOR_LINE = '[2026-03-12T18:13:22.049Z] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';

const SAMPLE_LOG_CONTENT = [
  SEPARATOR_LINE,
  INFO_LINE,
  SEPARATOR_LINE,
  CRITICAL_PERF_LINE,
  WARNING_PERF_LINE,
  WARNING_NPM_LINE,
  WARNING_TEST_LINE,
  WARNING_STEP_ISSUES_LINE,
  WARNING_COVERAGE_LINE,
  WARNING_AI_QUALITY_LINE,
  WARNING_LINTING_LINE,
  WARNING_ANTI_PATTERN_LINE,
  DEBUG_LINE,
].join('\n');

// ============================================================================
// parseLogLine
// ============================================================================

describe('parseLogLine', () => {
  test('extracts timestamp from standard log line', () => {
    const result = parseLogLine(CRITICAL_PERF_LINE);
    expect(result.timestamp).toBe('2026-03-12T18:14:20.129Z');
  });

  test('identifies CRITICAL severity', () => {
    const result = parseLogLine(CRITICAL_PERF_LINE);
    expect(result.severity).toBe(SEVERITY.CRITICAL);
  });

  test('identifies WARNING severity from [WARNING] prefix', () => {
    const result = parseLogLine(WARNING_PERF_LINE);
    expect(result.severity).toBe(SEVERITY.WARNING);
  });

  test('identifies WARNING severity from ⚠ prefix', () => {
    const result = parseLogLine(WARNING_NPM_LINE);
    expect(result.severity).toBe(SEVERITY.WARNING);
  });

  test('returns null severity for INFO line', () => {
    const result = parseLogLine(INFO_LINE);
    expect(result.severity).toBeNull();
  });

  test('returns null severity for separator line', () => {
    const result = parseLogLine(SEPARATOR_LINE);
    expect(result.severity).toBeNull();
  });

  test('extracts step ID from message', () => {
    const result = parseLogLine(CRITICAL_PERF_LINE);
    expect(result.stepId).toBe('step_02');
  });

  test('extracts step ID from bracketed [step_08]', () => {
    const result = parseLogLine(WARNING_TEST_LINE);
    expect(result.stepId).toBe('step_08');
  });

  test('returns null stepId when no step mentioned', () => {
    const result = parseLogLine(WARNING_NPM_LINE);
    expect(result.stepId).toBeNull();
  });

  test('returns null timestamp for line without timestamp', () => {
    const result = parseLogLine('plain message without timestamp');
    expect(result.timestamp).toBeNull();
  });

  test('handles empty string', () => {
    const result = parseLogLine('');
    expect(result.message).toBe('');
    expect(result.severity).toBeNull();
  });

  test('handles non-string input gracefully', () => {
    const result = parseLogLine(null);
    expect(result.message).toBe('');
    expect(result.timestamp).toBeNull();
  });

  test('includes raw property with original line', () => {
    const result = parseLogLine(CRITICAL_PERF_LINE);
    expect(result.raw).toBe(CRITICAL_PERF_LINE);
  });
});

// ============================================================================
// extractIssues
// ============================================================================

describe('extractIssues', () => {
  test('extracts all issue types from sample log', () => {
    const issues = extractIssues(SAMPLE_LOG_CONTENT);
    expect(issues.length).toBeGreaterThan(0);
  });

  test('extracts critical performance issue', () => {
    const issues = extractIssues(CRITICAL_PERF_LINE);
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe(SEVERITY.CRITICAL);
    expect(issues[0].category).toBe(CATEGORY.PERFORMANCE);
    expect(issues[0].stepId).toBe('step_02');
  });

  test('extracts warning performance issue', () => {
    const issues = extractIssues(WARNING_PERF_LINE);
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe(SEVERITY.WARNING);
    expect(issues[0].category).toBe(CATEGORY.PERFORMANCE);
    expect(issues[0].stepId).toBe('step_04');
  });

  test('extracts npm dependency warning', () => {
    const issues = extractIssues(WARNING_NPM_LINE);
    expect(issues).toHaveLength(1);
    expect(issues[0].category).toBe(CATEGORY.DEPENDENCY);
    expect(issues[0].severity).toBe(SEVERITY.WARNING);
  });

  test('extracts test runner crash as critical', () => {
    const issues = extractIssues(WARNING_TEST_LINE);
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe(SEVERITY.CRITICAL);
    expect(issues[0].category).toBe(CATEGORY.TEST_FAILURE);
  });

  test('extracts step issues warning', () => {
    const issues = extractIssues(WARNING_STEP_ISSUES_LINE);
    expect(issues).toHaveLength(1);
    expect(issues[0].category).toBe(CATEGORY.STEP_ISSUES);
  });

  test('extracts coverage warning', () => {
    const issues = extractIssues(WARNING_COVERAGE_LINE);
    expect(issues).toHaveLength(1);
    expect(issues[0].category).toBe(CATEGORY.COVERAGE);
  });

  test('extracts AI quality warning', () => {
    const issues = extractIssues(WARNING_AI_QUALITY_LINE);
    expect(issues).toHaveLength(1);
    expect(issues[0].category).toBe(CATEGORY.AI_QUALITY);
  });

  test('extracts linting warning', () => {
    const issues = extractIssues(WARNING_LINTING_LINE);
    expect(issues).toHaveLength(1);
    expect(issues[0].category).toBe(CATEGORY.LINTING);
  });

  test('extracts anti-pattern warning', () => {
    const issues = extractIssues(WARNING_ANTI_PATTERN_LINE);
    expect(issues).toHaveLength(1);
    expect(issues[0].category).toBe(CATEGORY.ANTI_PATTERN);
  });

  test('ignores info and debug lines', () => {
    const issues = extractIssues(INFO_LINE + '\n' + DEBUG_LINE + '\n' + SEPARATOR_LINE);
    expect(issues).toHaveLength(0);
  });

  test('returns empty array for empty content', () => {
    expect(extractIssues('')).toEqual([]);
  });

  test('returns empty array for null', () => {
    expect(extractIssues(null)).toEqual([]);
  });

  test('each issue has required fields', () => {
    const issues = extractIssues(CRITICAL_PERF_LINE);
    expect(issues[0]).toHaveProperty('severity');
    expect(issues[0]).toHaveProperty('category');
    expect(issues[0]).toHaveProperty('message');
    expect(issues[0]).toHaveProperty('suggestedFix');
    expect(issues[0]).toHaveProperty('raw');
  });

  test('multiple issues from multi-line log', () => {
    const issues = extractIssues(SAMPLE_LOG_CONTENT);
    const criticals = issues.filter((i) => i.severity === SEVERITY.CRITICAL);
    const warnings = issues.filter((i) => i.severity === SEVERITY.WARNING);
    expect(criticals.length).toBeGreaterThanOrEqual(1);
    expect(warnings.length).toBeGreaterThanOrEqual(1);
  });
});

// ============================================================================
// collectFilesRecursive
// ============================================================================

describe('collectFilesRecursive', () => {
  const makeFs = (tree) => ({
    readdirSync: (dir) => Object.keys(tree[dir] || {}),
    statSync: (p) => ({
      isDirectory: () => tree[p] !== undefined && typeof tree[p] === 'object',
    }),
  });

  test('returns files matching extensions in flat dir', () => {
    const tree = {
      '/run': { 'workflow.log': null, 'step_01.log': null, 'README.md': null },
    };
    const result = collectFilesRecursive('/run', ['.log'], makeFs(tree));
    expect(result).toHaveLength(2);
    expect(result.every((f) => f.endsWith('.log'))).toBe(true);
  });

  test('recurses into subdirectories', () => {
    const tree = {
      '/run': { steps: {}, prompts: {} },
      '/run/steps': { 'step_01.log': null },
      '/run/prompts': { step_01: {} },
      '/run/prompts/step_01': { 'response.md': null },
    };
    const result = collectFilesRecursive('/run', ['.log', '.md'], makeFs(tree));
    expect(result).toHaveLength(2);
    expect(result.some((f) => f.endsWith('.log'))).toBe(true);
    expect(result.some((f) => f.endsWith('.md'))).toBe(true);
  });

  test('returns empty array when readdirSync throws', () => {
    const fs = {
      readdirSync: () => {
        throw new Error('EACCES');
      },
      statSync: () => ({}),
    };
    expect(collectFilesRecursive('/bad', ['.log'], fs)).toEqual([]);
  });

  test('skips entries where statSync throws', () => {
    let calls = 0;
    const fs = {
      readdirSync: () => ['ok.log', 'bad.log'],
      statSync: (p) => {
        calls++;
        if (p.endsWith('bad.log')) throw new Error('EPERM');
        return { isDirectory: () => false };
      },
    };
    const result = collectFilesRecursive('/run', ['.log'], fs);
    expect(result).toHaveLength(1);
    expect(calls).toBe(2);
  });
});

// ============================================================================
// discoverLogFiles
// ============================================================================

describe('discoverLogFiles', () => {
  const mockFs = (dirs, files = ['workflow.log']) => ({
    existsSync: (p) => {
      return dirs.some((d) => p.endsWith(d) || p.includes(d)) || p.includes('/logs');
    },
    readdirSync: (p) => {
      const base = p.split('/').pop();
      if (base === 'logs') return dirs;
      if (dirs.includes(base)) return files;
      return [];
    },
    statSync: (p) => ({
      isDirectory: () => dirs.some((d) => p.endsWith(d)),
    }),
  });

  test('returns empty array when log dir does not exist', () => {
    const fs = { existsSync: () => false };
    expect(discoverLogFiles('/nonexistent/logs', false, fs)).toEqual([]);
  });

  test('discovers run directories matching workflow_YYYYMMDD_HHMMSS pattern', () => {
    const fs = mockFs(['workflow_20260312_151321', 'workflow_20260312_114822']);
    const result = discoverLogFiles('/fake/logs', false, fs);
    expect(result).toHaveLength(2);
  });

  test('filters directories not matching the pattern', () => {
    const fs = mockFs(['not_a_run', 'workflow_20260312_151321']);
    const result = discoverLogFiles('/fake/logs', false, fs);
    // Only 1 valid run dir
    expect(result).toHaveLength(1);
  });

  test('returns only latest run when latestOnly=true', () => {
    const fs = mockFs(['workflow_20260312_151321', 'workflow_20260312_114822']);
    const result = discoverLogFiles('/fake/logs', true, fs);
    expect(result).toHaveLength(1);
  });

  test('returns run objects with runDir and files properties', () => {
    const fs = mockFs(['workflow_20260312_151321']);
    const result = discoverLogFiles('/fake/logs', false, fs);
    expect(result[0]).toHaveProperty('runDir');
    expect(result[0]).toHaveProperty('files');
    expect(Array.isArray(result[0].files)).toBe(true);
  });

  test('returns empty array when readdirSync throws', () => {
    const fs = {
      existsSync: () => true,
      readdirSync: () => {
        throw new Error('EACCES');
      },
    };
    expect(discoverLogFiles('/fake/logs', false, fs)).toEqual([]);
  });

  test('includes .md files from prompts subdirectory', () => {
    const run = 'workflow_20260312_151321';
    const fs = {
      existsSync: () => true,
      readdirSync: (p) => {
        if (p.endsWith('logs')) return [run];
        if (p.endsWith(run)) return ['steps', 'prompts'];
        if (p.endsWith('steps')) return ['step_01.log'];
        if (p.endsWith('prompts')) return ['step_01'];
        if (p.endsWith('step_01')) return ['response.md'];
        return [];
      },
      statSync: (p) => ({
        isDirectory: () =>
          p.endsWith(run) || p.endsWith('steps') || p.endsWith('prompts') || p.endsWith('step_01'),
      }),
    };
    const result = discoverLogFiles('/fake/logs', false, fs);
    expect(result).toHaveLength(1);
    expect(result[0].files.some((f) => f.endsWith('.log'))).toBe(true);
    expect(result[0].files.some((f) => f.endsWith('.md'))).toBe(true);
  });
});

// ============================================================================
// suggestFix
// ============================================================================

describe('suggestFix', () => {
  test('returns string for every known category', () => {
    Object.values(CATEGORY).forEach((cat) => {
      const fix = suggestFix(cat, SEVERITY.WARNING);
      expect(typeof fix).toBe('string');
      expect(fix.length).toBeGreaterThan(0);
    });
  });

  test('returns different fix for critical vs warning performance', () => {
    const critical = suggestFix(CATEGORY.PERFORMANCE, SEVERITY.CRITICAL);
    const warning = suggestFix(CATEGORY.PERFORMANCE, SEVERITY.WARNING);
    expect(critical).not.toBe(warning);
  });

  test('returns general fix for unknown category', () => {
    const fix = suggestFix('unknown_category', SEVERITY.WARNING);
    expect(typeof fix).toBe('string');
    expect(fix.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// filterBySeverity
// ============================================================================

describe('filterBySeverity', () => {
  const mixedIssues = [
    { severity: SEVERITY.CRITICAL, message: 'c1' },
    { severity: SEVERITY.WARNING, message: 'w1' },
    { severity: SEVERITY.WARNING, message: 'w2' },
    { severity: SEVERITY.INFO, message: 'i1' },
  ];

  test('returns all issues for severity=all', () => {
    expect(filterBySeverity(mixedIssues, 'all')).toHaveLength(4);
  });

  test('returns all issues when severity is falsy', () => {
    expect(filterBySeverity(mixedIssues, null)).toHaveLength(4);
    expect(filterBySeverity(mixedIssues, '')).toHaveLength(4);
  });

  test('returns only critical issues for severity=critical', () => {
    const result = filterBySeverity(mixedIssues, 'critical');
    expect(result).toHaveLength(1);
    expect(result[0].severity).toBe(SEVERITY.CRITICAL);
  });

  test('returns critical + warning for severity=warning', () => {
    const result = filterBySeverity(mixedIssues, 'warning');
    expect(result).toHaveLength(3);
    expect(result.every((i) => i.severity !== SEVERITY.INFO)).toBe(true);
  });

  test('returns empty array for non-array input', () => {
    expect(filterBySeverity(null, 'all')).toEqual([]);
    expect(filterBySeverity(undefined, 'all')).toEqual([]);
  });
});

// ============================================================================
// sortIssuesByPriority
// ============================================================================

describe('sortIssuesByPriority', () => {
  const issues = [
    { severity: SEVERITY.INFO, timestamp: '2026-03-12T10:00:00.000Z', message: 'info' },
    { severity: SEVERITY.CRITICAL, timestamp: '2026-03-12T10:01:00.000Z', message: 'critical' },
    { severity: SEVERITY.WARNING, timestamp: '2026-03-12T10:02:00.000Z', message: 'warning' },
  ];

  test('puts critical issues first', () => {
    const sorted = sortIssuesByPriority(issues);
    expect(sorted[0].severity).toBe(SEVERITY.CRITICAL);
  });

  test('puts info issues last', () => {
    const sorted = sortIssuesByPriority(issues);
    expect(sorted[sorted.length - 1].severity).toBe(SEVERITY.INFO);
  });

  test('does not mutate the original array', () => {
    const original = [...issues];
    sortIssuesByPriority(issues);
    expect(issues[0].severity).toBe(original[0].severity);
  });

  test('returns empty array for non-array input', () => {
    expect(sortIssuesByPriority(null)).toEqual([]);
  });

  test('handles empty array', () => {
    expect(sortIssuesByPriority([])).toEqual([]);
  });
});

// ============================================================================
// validateFileReferences
// ============================================================================

describe('validateFileReferences', () => {
  const existsFs = { existsSync: () => true };
  const noExistsFs = { existsSync: () => false };

  test('adds fileExists=true when file exists', () => {
    const issues = [{ message: 'Check src/lib/config.js for issues', raw: '' }];
    const result = validateFileReferences(issues, '/project', existsFs);
    expect(result[0].fileExists).toBe(true);
  });

  test('adds fileExists=false when file does not exist', () => {
    const issues = [{ message: 'Check src/lib/missing.js for issues', raw: '' }];
    const result = validateFileReferences(issues, '/project', noExistsFs);
    expect(result[0].fileExists).toBe(false);
  });

  test('does not add fileExists when no file path found', () => {
    const issues = [{ message: 'npm install failed', raw: '' }];
    const result = validateFileReferences(issues, '/project', existsFs);
    expect(result[0].fileExists).toBeUndefined();
  });

  test('returns empty array for non-array input', () => {
    expect(validateFileReferences(null, '/project', existsFs)).toEqual([]);
  });

  test('preserves all existing issue fields', () => {
    const issues = [
      {
        message: 'src/index.js issue',
        raw: '',
        severity: SEVERITY.WARNING,
        category: CATEGORY.GENERAL,
      },
    ];
    const result = validateFileReferences(issues, '/project', existsFs);
    expect(result[0].severity).toBe(SEVERITY.WARNING);
    expect(result[0].category).toBe(CATEGORY.GENERAL);
  });
});

// ============================================================================
// generateFixPlan
// ============================================================================

describe('generateFixPlan', () => {
  const sampleIssues = [
    {
      severity: SEVERITY.CRITICAL,
      category: CATEGORY.PERFORMANCE,
      message: 'Critical perf',
      stepId: 'step_02',
      timestamp: '2026-03-12T18:14:20.129Z',
      suggestedFix: 'Fix it',
      raw: '',
    },
    {
      severity: SEVERITY.WARNING,
      category: CATEGORY.DEPENDENCY,
      message: 'npm failed',
      stepId: null,
      timestamp: '2026-03-12T18:16:28.577Z',
      suggestedFix: 'Fix dep',
      raw: '',
    },
  ];

  test('returns plan with correct total', () => {
    const plan = generateFixPlan(sampleIssues, '/project', '/logs', 'run1');
    expect(plan.totalIssues).toBe(2);
  });

  test('counts issues by severity', () => {
    const plan = generateFixPlan(sampleIssues, '/project', '/logs', 'run1');
    expect(plan.counts[SEVERITY.CRITICAL]).toBe(1);
    expect(plan.counts[SEVERITY.WARNING]).toBe(1);
  });

  test('groups issues by category', () => {
    const plan = generateFixPlan(sampleIssues, '/project', '/logs', 'run1');
    expect(plan.byCategory[CATEGORY.PERFORMANCE]).toHaveLength(1);
    expect(plan.byCategory[CATEGORY.DEPENDENCY]).toHaveLength(1);
  });

  test('sorts issues with critical first', () => {
    const plan = generateFixPlan(sampleIssues, '/project', '/logs', 'run1');
    expect(plan.sortedIssues[0].severity).toBe(SEVERITY.CRITICAL);
  });

  test('preserves projectRoot, logDir, runLabel', () => {
    const plan = generateFixPlan(sampleIssues, '/project', '/logs', 'run1');
    expect(plan.projectRoot).toBe('/project');
    expect(plan.logDir).toBe('/logs');
    expect(plan.runLabel).toBe('run1');
  });

  test('handles empty issues array', () => {
    const plan = generateFixPlan([], '/project', '/logs', 'run1');
    expect(plan.totalIssues).toBe(0);
    expect(plan.counts[SEVERITY.CRITICAL]).toBe(0);
    expect(Object.keys(plan.byCategory)).toHaveLength(0);
  });
});

// ============================================================================
// formatFixPlanMarkdown
// ============================================================================

describe('formatFixPlanMarkdown', () => {
  const samplePlan = {
    projectRoot: '/home/user/myproject',
    logDir: '/home/user/myproject/.ai_workflow/logs',
    runLabel: 'workflow_20260312_151321',
    totalIssues: 2,
    counts: { [SEVERITY.CRITICAL]: 1, [SEVERITY.WARNING]: 1, [SEVERITY.INFO]: 0 },
    byCategory: {},
    sortedIssues: [
      {
        severity: SEVERITY.CRITICAL,
        category: CATEGORY.PERFORMANCE,
        message: 'step_02 critical perf',
        stepId: 'step_02',
        timestamp: '2026-03-12T18:14:20.129Z',
        suggestedFix: 'Optimize step_02',
        raw: 'raw line here',
      },
      {
        severity: SEVERITY.WARNING,
        category: CATEGORY.DEPENDENCY,
        message: 'npm failed',
        stepId: null,
        timestamp: null,
        suggestedFix: 'Run npm install',
        raw: '⚠ npm failed',
      },
    ],
  };

  test('returns a string', () => {
    const md = formatFixPlanMarkdown(samplePlan, '2026-03-12T18:00:00.000Z');
    expect(typeof md).toBe('string');
  });

  test('includes # AI Workflow Fix Plan heading', () => {
    const md = formatFixPlanMarkdown(samplePlan, '2026-03-12T18:00:00.000Z');
    expect(md).toContain('# AI Workflow Fix Plan');
  });

  test('includes summary table', () => {
    const md = formatFixPlanMarkdown(samplePlan, '2026-03-12T18:00:00.000Z');
    expect(md).toContain('## Summary');
    expect(md).toContain('Critical');
    expect(md).toContain('Warning');
  });

  test('includes critical issues section', () => {
    const md = formatFixPlanMarkdown(samplePlan, '2026-03-12T18:00:00.000Z');
    expect(md).toContain('Critical Issues');
  });

  test('includes suggested fix text', () => {
    const md = formatFixPlanMarkdown(samplePlan, '2026-03-12T18:00:00.000Z');
    expect(md).toContain('Optimize step_02');
  });

  test('includes project and log directory paths', () => {
    const md = formatFixPlanMarkdown(samplePlan, '2026-03-12T18:00:00.000Z');
    expect(md).toContain('/home/user/myproject');
    expect(md).toContain('.ai_workflow/logs');
  });

  test('shows no-issues message for empty plan', () => {
    const emptyPlan = {
      ...samplePlan,
      totalIssues: 0,
      counts: { [SEVERITY.CRITICAL]: 0, [SEVERITY.WARNING]: 0, [SEVERITY.INFO]: 0 },
      sortedIssues: [],
    };
    const md = formatFixPlanMarkdown(emptyPlan, '2026-03-12T18:00:00.000Z');
    expect(md).toContain('No issues found');
  });

  test('includes raw log entry in details block', () => {
    const md = formatFixPlanMarkdown(samplePlan, '2026-03-12T18:00:00.000Z');
    expect(md).toContain('raw line here');
  });
});
