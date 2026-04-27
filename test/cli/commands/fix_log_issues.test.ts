/**
 * @fileoverview Tests for CLI Fix Log Issues Command
 * @module test/cli/commands/fix_log_issues.test
 */

import { describe, test, expect } from '@jest/globals';
import {
  validateFixLogOptions,
  resolveLogDirectory,
  resolveProjectRoot,
  formatIssueSummary,
  buildFixLogPrompt,
} from '../../../src/cli/commands/fix_log_issues.js';

// ============================================================================
// validateFixLogOptions
// ============================================================================

describe('validateFixLogOptions', () => {
  test('is valid with no options', () => {
    const result = validateFixLogOptions({});
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('is valid with severity=critical', () => {
    const result = validateFixLogOptions({ severity: 'critical' });
    expect(result.isValid).toBe(true);
  });

  test('is valid with severity=warning', () => {
    const result = validateFixLogOptions({ severity: 'warning' });
    expect(result.isValid).toBe(true);
  });

  test('is valid with severity=all', () => {
    const result = validateFixLogOptions({ severity: 'all' });
    expect(result.isValid).toBe(true);
  });

  test('is invalid with unknown severity', () => {
    const result = validateFixLogOptions({ severity: 'error' });
    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toContain('Invalid --severity');
  });

  test('is valid with logDir string', () => {
    const result = validateFixLogOptions({ logDir: '/some/path' });
    expect(result.isValid).toBe(true);
  });

  test('is invalid when logDir is not a string', () => {
    const result = validateFixLogOptions({ logDir: 123 });
    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toContain('--log-dir');
  });

  test('is invalid when output is not a string', () => {
    const result = validateFixLogOptions({ output: true });
    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toContain('--output');
  });

  test('is valid with all valid options combined', () => {
    const result = validateFixLogOptions({
      severity: 'warning',
      logDir: '/path/to/logs',
      output: '/path/to/output.md',
      latest: true,
      dryRun: true,
    });
    expect(result.isValid).toBe(true);
  });

  test('returns errors array', () => {
    const result = validateFixLogOptions({ severity: 'bad' });
    expect(Array.isArray(result.errors)).toBe(true);
  });
});

// ============================================================================
// resolveLogDirectory
// ============================================================================

describe('resolveLogDirectory', () => {
  const cwd = '/home/user/project';

  test('uses explicit logDir when absolute', () => {
    const result = resolveLogDirectory({ logDir: '/absolute/logs' }, cwd);
    expect(result).toBe('/absolute/logs');
  });

  test('resolves relative logDir against cwd', () => {
    const result = resolveLogDirectory({ logDir: 'custom/logs' }, cwd);
    expect(result).toBe('/home/user/project/custom/logs');
  });

  test('resolves relative logDir against projectRoot when set', () => {
    const result = resolveLogDirectory({ logDir: 'logs', projectRoot: '/other/root' }, cwd);
    expect(result).toBe('/other/root/logs');
  });

  test('defaults to .ai_workflow/logs relative to cwd', () => {
    const result = resolveLogDirectory({}, cwd);
    expect(result).toBe('/home/user/project/.ai_workflow/logs');
  });

  test('uses workflowDir option for default resolution', () => {
    const result = resolveLogDirectory({ workflowDir: '.workflow' }, cwd);
    expect(result).toBe('/home/user/project/.workflow/logs');
  });

  test('uses projectRoot with default workflowDir when no logDir', () => {
    const result = resolveLogDirectory({ projectRoot: '/proj' }, cwd);
    expect(result).toBe('/proj/.ai_workflow/logs');
  });
});

// ============================================================================
// resolveProjectRoot
// ============================================================================

describe('resolveProjectRoot', () => {
  const cwd = '/home/user/project';

  test('returns cwd when projectRoot not set', () => {
    expect(resolveProjectRoot({}, cwd)).toBe(cwd);
  });

  test('returns absolute projectRoot as-is', () => {
    expect(resolveProjectRoot({ projectRoot: '/other/project' }, cwd)).toBe('/other/project');
  });

  test('resolves relative projectRoot against cwd', () => {
    expect(resolveProjectRoot({ projectRoot: '../other' }, cwd)).toBe('/home/user/other');
  });
});

// ============================================================================
// formatIssueSummary
// ============================================================================

describe('formatIssueSummary', () => {
  test('returns no-issues message when total is 0', () => {
    const lines = formatIssueSummary(0, 0, 0);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('No issues found');
  });

  test('shows total issue count', () => {
    const lines = formatIssueSummary(2, 5, 7);
    expect(lines.join('\n')).toContain('7');
  });

  test('shows critical count when > 0', () => {
    const lines = formatIssueSummary(2, 3, 5);
    expect(lines.join('\n')).toContain('2');
  });

  test('shows warning count when > 0', () => {
    const lines = formatIssueSummary(1, 4, 5);
    expect(lines.join('\n')).toContain('4');
  });

  test('omits critical line when critical count is 0', () => {
    const lines = formatIssueSummary(0, 3, 3);
    const text = lines.join('\n');
    expect(text).not.toContain('Critical: 0');
  });

  test('returns array of strings', () => {
    const lines = formatIssueSummary(1, 2, 3);
    expect(Array.isArray(lines)).toBe(true);
    lines.forEach((line) => expect(typeof line).toBe('string'));
  });

  test('shows info count when there are remaining issues beyond critical+warning', () => {
    const lines = formatIssueSummary(1, 1, 3); // 1 info = 3 - 1 - 1
    const text = lines.join('\n');
    expect(text).toContain('1'); // info count
  });
});

// ============================================================================
// buildFixLogPrompt
// ============================================================================

describe('buildFixLogPrompt', () => {
  const entries = [
    { filePath: '/logs/run/workflow.log', content: 'step_01 completed' },
    { filePath: '/logs/run/prompts/step_09/response.md', content: '# Prompt Log\n## Response\nChange name to hyphenated.' },
  ];

  test('returns a string', () => {
    const prompt = buildFixLogPrompt(entries, '/project');
    expect(typeof prompt).toBe('string');
    expect(prompt.length).toBeGreaterThan(0);
  });

  test('includes the project root path', () => {
    const prompt = buildFixLogPrompt(entries, '/my/project');
    expect(prompt).toContain('/my/project');
  });

  test('includes the file count', () => {
    const prompt = buildFixLogPrompt(entries, '/project');
    expect(prompt).toContain('2 files');
  });

  test('embeds each file path as a heading', () => {
    const prompt = buildFixLogPrompt(entries, '/project');
    expect(prompt).toContain('workflow.log');
    expect(prompt).toContain('response.md');
  });

  test('embeds file content in code blocks', () => {
    const prompt = buildFixLogPrompt(entries, '/project');
    expect(prompt).toContain('step_01 completed');
    expect(prompt).toContain('Change name to hyphenated.');
  });

  test('returns empty-entries prompt gracefully', () => {
    const prompt = buildFixLogPrompt([], '/project');
    expect(typeof prompt).toBe('string');
    expect(prompt).toContain('0 files');
  });
});
