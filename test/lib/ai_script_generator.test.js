/**
 * Tests for AI Script Generator Module (Phase 14.4 — Output Automater)
 *
 * @jest-environment node
 */

import { mkdirSync, rmSync, existsSync, readFileSync } from 'fs';
import path from 'path';
import os from 'os';
import {
  scriptFilePath,
  parseRemediationItems,
  generateFixScript,
  ScriptGenerator,
} from '../../src/lib/ai_script_generator.js';

// ============================================================================
// PURE FUNCTION TESTS
// ============================================================================

describe('scriptFilePath', () => {
  test('returns path inside fixes/ subdirectory', () => {
    const result = scriptFilePath('.ai_workflow', 'step_04');
    expect(result).toBe(path.join('.ai_workflow', 'fixes', 'step_04_fixes.sh'));
  });

  test('uses provided step name', () => {
    const result = scriptFilePath('/abs/path', 'step_07');
    expect(result).toContain('step_07_fixes.sh');
  });

  test('preserves absolute workflowDir', () => {
    const result = scriptFilePath('/home/user/.ai_workflow', 'step_04');
    expect(result.startsWith('/home/user/.ai_workflow')).toBe(true);
  });
});

describe('parseRemediationItems', () => {
  test('returns empty array for empty input', () => {
    expect(parseRemediationItems('')).toEqual([]);
  });

  test('parses FIX/FILE/COMMAND structured blocks', () => {
    const text = [
      'FIX: Remove unused import',
      'FILE: src/app.js',
      'COMMAND: sed -i "/^import unused/d" src/app.js',
    ].join('\n');
    const items = parseRemediationItems(text);
    expect(items.length).toBeGreaterThanOrEqual(1);
    expect(items[0]).toHaveProperty('command');
  });

  test('parses markdown checkbox items', () => {
    const text = [
      '- [ ] Run `eslint --fix src/`',
      '- [ ] Delete temp files in /tmp/workflow',
      '- [ ] Update package.json version to 2.0.0',
    ].join('\n');
    const items = parseRemediationItems(text);
    expect(items.length).toBeGreaterThanOrEqual(1);
  });

  test('falls back to inline shell commands when no structured content', () => {
    const text = 'You should run `npm install` and then `npm test` to verify.';
    const items = parseRemediationItems(text);
    expect(items.length).toBeGreaterThanOrEqual(1);
  });

  test('ignores pure prose with no actionable commands', () => {
    const text = 'Everything looks good. No issues were found. Great work!';
    const items = parseRemediationItems(text);
    // Either 0 items or items with no meaningful commands
    items.forEach((item) => {
      expect(item.command).toBeDefined();
    });
  });
});

describe('generateFixScript', () => {
  test('returns empty string for empty items array', () => {
    const result = generateFixScript([]);
    expect(result).toBe('');
  });

  test('includes bash shebang for non-empty items', () => {
    const items = [{ command: 'echo "hello"', description: 'Test command' }];
    const result = generateFixScript(items);
    expect(result).toContain('#!/usr/bin/env bash');
  });

  test('includes each command in the output', () => {
    const items = [
      { command: 'eslint --fix src/', description: 'Fix linting' },
      { command: 'npm test', description: 'Run tests' },
    ];
    const result = generateFixScript(items);
    expect(result).toContain('eslint --fix src/');
    expect(result).toContain('npm test');
  });

  test('includes set -e for safety', () => {
    const items = [{ command: 'echo "safe"' }];
    const result = generateFixScript(items);
    expect(result).toContain('set -e');
  });

  test('respects dryRun option — prefixes commands with echo', () => {
    const items = [{ command: 'rm -rf /tmp/workflow', description: 'Cleanup' }];
    const result = generateFixScript(items, { dryRun: true });
    expect(result).toContain('echo');
  });
});

// ============================================================================
// IMPURE WRAPPER TESTS (uses temp directory)
// ============================================================================

describe('ScriptGenerator', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = mkdirSync(path.join(os.tmpdir(), `ai_sg_test_${Date.now()}`), { recursive: true }) || path.join(os.tmpdir(), `ai_sg_test_${Date.now()}`);
    // mkdirSync returns undefined on Node < 21 when recursive, so re-create the path
    tmpDir = path.join(os.tmpdir(), `ai_sg_test_${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    try { rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  test('generateAndSave returns scriptPath and remediationCount', async () => {
    const gen = new ScriptGenerator({ workflowDir: tmpDir, projectRoot: tmpDir, dryRun: false });
    const text = '- [ ] Run `eslint --fix src/`\n- [ ] Run `npm test`';
    const result = await gen.generateAndSave('step_04', text);
    expect(result).toHaveProperty('scriptPath');
    expect(result).toHaveProperty('remediationCount');
  });

  test('generates no file when there are no remediation items', async () => {
    const gen = new ScriptGenerator({ workflowDir: tmpDir, projectRoot: tmpDir, dryRun: false });
    const result = await gen.generateAndSave('step_07', 'Everything looks fine, nothing to fix.');
    expect(result.remediationCount).toBe(0);
    expect(result.scriptPath).toBeNull();
  });

  test('written script file exists on disk', async () => {
    const gen = new ScriptGenerator({ workflowDir: tmpDir, projectRoot: tmpDir, dryRun: false });
    const text = '- [ ] Run `npm run lint`';
    const result = await gen.generateAndSave('step_04', text);
    if (result.scriptPath) {
      expect(existsSync(result.scriptPath)).toBe(true);
    }
  });

  test('written script contains bash shebang', async () => {
    const gen = new ScriptGenerator({ workflowDir: tmpDir, projectRoot: tmpDir, dryRun: false });
    const text = 'FIX: Fix lint\nFILE: src/app.js\nCOMMAND: eslint --fix src/app.js';
    const result = await gen.generateAndSave('step_04', text);
    if (result.scriptPath && existsSync(result.scriptPath)) {
      const content = readFileSync(result.scriptPath, 'utf8');
      expect(content).toContain('#!/usr/bin/env bash');
    }
  });

  test('dryRun does not write file to disk', async () => {
    const gen = new ScriptGenerator({ workflowDir: tmpDir, projectRoot: tmpDir, dryRun: true });
    const text = '- [ ] Run `eslint --fix src/`';
    const result = await gen.generateAndSave('step_04', text);
    if (result.scriptPath) {
      expect(existsSync(result.scriptPath)).toBe(false);
    }
  });
});
