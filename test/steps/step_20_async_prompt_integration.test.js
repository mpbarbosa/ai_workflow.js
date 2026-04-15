/**
 * @fileoverview Regression tests for async_perf_engineer_prompt evidence scoping.
 */

import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';
import { buildYamlStepPrompt } from '../../src/lib/ai_prompt_builder.js';

const PROJECT_ROOT = process.cwd();
const AI_HELPERS_YAML_PATH = path.join(PROJECT_ROOT, '.workflow_core', 'config', 'ai_helpers.yaml');

describe('async_perf_engineer_prompt — evidence scoping', () => {
  let aiHelpers;

  beforeAll(async () => {
    const raw = await fs.readFile(AI_HELPERS_YAML_PATH, 'utf8');
    aiHelpers = yaml.load(raw);
  });

  test('approach preserves valid Jest/Vitest async assertion idioms', () => {
    const approach = aiHelpers.async_perf_engineer_prompt.approach;

    expect(approach).toContain('await expect');
    expect(approach).toContain('rejects.toThrow');
    expect(approach).toContain('Never flag a test-only assertion idiom');
  });

  test('approach requires no-production-findings output for test/config-only evidence', () => {
    const approach = aiHelpers.async_perf_engineer_prompt.approach;

    expect(approach).toContain('every provided file is either a test file or a tooling/config file');
    expect(approach).toContain('no production async-performance findings are supported');
  });

  test('approach keeps split-file verdicts scoped to the visible partition', () => {
    const approach = aiHelpers.async_perf_engineer_prompt.approach;

    expect(approach).toContain('If an analyzed path is labeled `(part X/Y)`');
    expect(approach).toContain('do not issue a whole-file clean bill of health');
    expect(approach).toContain('scoped to the visible excerpt/partition');
  });

  test('rendered prompt keeps runtime-scope guardrails alongside test-heavy excerpts', () => {
    const prompt = buildYamlStepPrompt(aiHelpers, 'async_perf_engineer_prompt', {
      partition_header: '[Partition 1 of 1 — test/config-only sample]',
      project_name: 'ai_workflow.js',
      project_summary: 'workflow automation',
      project_kind: 'nodejs_automation',
      primary_language: 'javascript',
      build_system: 'npm',
      test_framework: 'jest',
      source_file_count: '3 total (3 covered in this request)',
      modified_count: '0',
      file_paths: ['test/foo.test.js', 'jest.config.ts', '.workflow_core/config/tooling.js'].join('\n'),
      partition_scope_note: 'This request only contains tests and tooling excerpts.',
      file_content_block: [
        '### `test/foo.test.js`',
        '```js',
        "await expect(run()).rejects.toThrow('boom');",
        '```',
      ].join('\n'),
    });

    expect(prompt).toContain('Valid test idioms');
    expect(prompt).toContain('no production async-performance findings are supported');
    expect(prompt).toContain('await expect(run()).rejects.toThrow');
  });

  test('rendered prompt warns against whole-file verdicts for split excerpts', () => {
    const prompt = buildYamlStepPrompt(aiHelpers, 'async_perf_engineer_prompt', {
      partition_header: '[Partition 1 of 4 — split file sample]',
      project_name: 'ai_workflow.js',
      project_summary: 'workflow automation',
      project_kind: 'nodejs_automation',
      primary_language: 'javascript',
      build_system: 'npm',
      test_framework: 'jest',
      source_file_count: '1 total (1 covered in this request)',
      modified_count: '1',
      file_paths: ['src/loader.ts (part 1/4)'].join('\n'),
      partition_scope_note:
        'This request covers one split file excerpt labeled as part 1/4 for prompt safety.',
      file_content_block: [
        '### `src/loader.ts (part 1/4)`',
        '```ts',
        'export async function load() {',
        "  return Promise.resolve('ok');",
        '}',
        '```',
      ].join('\n'),
    });

    expect(prompt).toContain('src/loader.ts (part 1/4)');
    expect(prompt).toContain('do not issue a whole-file clean bill of health');
    expect(prompt).toContain('scoped to the visible excerpt/partition');
  });
});
