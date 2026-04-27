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
import type {
  FixLogCommandOptions,
  FixLogOptionsValidationResult,
  LogEntry,
} from '../../../src/cli/commands/fix_log_issues.js';

describe('validateFixLogOptions', (): void => {
  test('is valid with no options', (): void => {
    const result: FixLogOptionsValidationResult = validateFixLogOptions({});
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('is valid with severity=critical', (): void => {
    const result: FixLogOptionsValidationResult = validateFixLogOptions({ severity: 'critical' });
    expect(result.isValid).toBe(true);
  });

  test('is valid with severity=warning', (): void => {
    const result: FixLogOptionsValidationResult = validateFixLogOptions({ severity: 'warning' });
    expect(result.isValid).toBe(true);
  });

  test('is valid with severity=all', (): void => {
    const result: FixLogOptionsValidationResult = validateFixLogOptions({ severity: 'all' });
    expect(result.isValid).toBe(true);
  });

  test('is invalid with unknown severity', (): void => {
    const result: FixLogOptionsValidationResult = validateFixLogOptions({ severity: 'error' as never });
    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toContain('Invalid --severity');
  });

  test('is valid with logDir string', (): void => {
    const result: FixLogOptionsValidationResult = validateFixLogOptions({ logDir: '/some/path' });
    expect(result.isValid).toBe(true);
  });

  test('is invalid when logDir is not a string', (): void => {
    const result: FixLogOptionsValidationResult = validateFixLogOptions({ logDir: 123 as never });
    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toContain('--log-dir');
  });

  test('is invalid when output is not a string', (): void => {
    const result: FixLogOptionsValidationResult = validateFixLogOptions({ output: true as never });
    expect(result.isValid).toBe(false);
    expect(result.errors[0]).toContain('--output');
  });

  test('is valid with all valid options combined', (): void => {
    const result: FixLogOptionsValidationResult = validateFixLogOptions({
      severity: 'warning',
      logDir: '/path/to/logs',
      output: '/path/to/output.md',
      latest: true,
      dryRun: true,
    });
    expect(result.isValid).toBe(true);
  });

  test('returns errors array', (): void => {
    const result: FixLogOptionsValidationResult = validateFixLogOptions({ severity: 'bad' as never });
    expect(Array.isArray(result.errors)).toBe(true);
  });
});

describe('resolveLogDirectory', (): void => {
  const cwd = '/home/user/project';

  test('uses explicit logDir when absolute', (): void => {
    const result = resolveLogDirectory({ logDir: '/absolute/logs' }, cwd);
    expect(result).toBe('/absolute/logs');
  });

  test('resolves relative logDir against cwd', (): void => {
    const result = resolveLogDirectory({ logDir: 'custom/logs' }, cwd);
    expect(result).toBe('/home/user/project/custom/logs');
  });

  test('resolves relative logDir against projectRoot when set', (): void => {
    const options: FixLogCommandOptions = { logDir: 'logs', projectRoot: '/other/root' };
    const result = resolveLogDirectory(options, cwd);
    expect(result).toBe('/other/root/logs');
  });

  test('defaults to .ai_workflow/logs relative to cwd', (): void => {
    const result = resolveLogDirectory({}, cwd);
    expect(result).toBe('/home/user/project/.ai_workflow/logs');
  });

  test('uses workflowDir option for default resolution', (): void => {
    const result = resolveLogDirectory({ workflowDir: '.workflow' }, cwd);
    expect(result).toBe('/home/user/project/.workflow/logs');
  });

  test('uses projectRoot with default workflowDir when no logDir', (): void => {
    const result = resolveLogDirectory({ projectRoot: '/proj' }, cwd);
    expect(result).toBe('/proj/.ai_workflow/logs');
  });
});

describe('resolveProjectRoot', (): void => {
  const cwd = '/home/user/project';

  test('returns cwd when projectRoot not set', (): void => {
    expect(resolveProjectRoot({}, cwd)).toBe(cwd);
  });

  test('returns absolute projectRoot as-is', (): void => {
    expect(resolveProjectRoot({ projectRoot: '/other/project' }, cwd)).toBe('/other/project');
  });

  test('resolves relative projectRoot against cwd', (): void => {
    expect(resolveProjectRoot({ projectRoot: '../other' }, cwd)).toBe('/home/user/other');
  });
});

describe('formatIssueSummary', (): void => {
  test('returns no-issues message when total is 0', (): void => {
    const lines: string[] = formatIssueSummary(0, 0, 0);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('No issues found');
  });

  test('shows total issue count', (): void => {
    const lines: string[] = formatIssueSummary(2, 5, 7);
    expect(lines.join('\n')).toContain('7');
  });

  test('shows critical count when > 0', (): void => {
    const lines: string[] = formatIssueSummary(2, 3, 5);
    expect(lines.join('\n')).toContain('2');
  });

  test('shows warning count when > 0', (): void => {
    const lines: string[] = formatIssueSummary(1, 4, 5);
    expect(lines.join('\n')).toContain('4');
  });

  test('omits critical line when critical count is 0', (): void => {
    const lines: string[] = formatIssueSummary(0, 3, 3);
    const text = lines.join('\n');
    expect(text).not.toContain('Critical: 0');
  });

  test('returns array of strings', (): void => {
    const lines: string[] = formatIssueSummary(1, 2, 3);
    expect(Array.isArray(lines)).toBe(true);
    lines.forEach((line: string): void => expect(typeof line).toBe('string'));
  });

  test('shows info count when there are remaining issues beyond critical+warning', (): void => {
    const lines: string[] = formatIssueSummary(1, 1, 3);
    const text = lines.join('\n');
    expect(text).toContain('1');
  });
});

describe('buildFixLogPrompt', (): void => {
  const entries: LogEntry[] = [
    { filePath: '/logs/run/workflow.log', content: 'step_01 completed' },
    {
      filePath: '/logs/run/prompts/step_09/response.md',
      content: '# Prompt Log\n## Response\nChange name to hyphenated.',
    },
  ];

  test('returns a string', (): void => {
    const prompt: string = buildFixLogPrompt(entries, '/project');
    expect(typeof prompt).toBe('string');
    expect(prompt.length).toBeGreaterThan(0);
  });

  test('includes the project root path', (): void => {
    const prompt: string = buildFixLogPrompt(entries, '/my/project');
    expect(prompt).toContain('/my/project');
  });

  test('includes the file count', (): void => {
    const prompt: string = buildFixLogPrompt(entries, '/project');
    expect(prompt).toContain('2 files');
  });

  test('embeds each file path as a heading', (): void => {
    const prompt: string = buildFixLogPrompt(entries, '/project');
    expect(prompt).toContain('workflow.log');
    expect(prompt).toContain('response.md');
  });

  test('embeds file content in code blocks', (): void => {
    const prompt: string = buildFixLogPrompt(entries, '/project');
    expect(prompt).toContain('step_01 completed');
    expect(prompt).toContain('Change name to hyphenated.');
  });

  test('returns empty-entries prompt gracefully', (): void => {
    const prompt: string = buildFixLogPrompt([], '/project');
    expect(typeof prompt).toBe('string');
    expect(prompt).toContain('0 files');
  });
});
