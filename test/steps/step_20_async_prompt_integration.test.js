/**
 * @fileoverview Regression tests for async_perf_engineer_prompt evidence scoping.
 */

import fs from 'fs/promises';
import yaml from 'js-yaml';
import { buildYamlStepPrompt } from '../../src/lib/ai_prompt_builder.js';
import { AI_HELPERS_YAML_PATH } from '../helpers/workflow_core_paths.js';

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

    expect(approach).toContain(
      'every provided file is either a test file or a tooling/config file'
    );
    expect(approach).toContain('no production async-performance findings are supported');
  });

  test('approach keeps split-file verdicts scoped to the visible partition', () => {
    const approach = aiHelpers.async_perf_engineer_prompt.approach;

    expect(approach).toContain('If an analyzed path is labeled `(part X/Y)`');
    expect(approach).toContain('do not issue a whole-file clean bill of health');
    expect(approach).toContain('scoped to the visible excerpt/partition');
  });

  test('task guidance forbids issue rows for non-findings', () => {
    const taskTemplate = aiHelpers.async_perf_engineer_prompt.task_template;
    const approach = aiHelpers.async_perf_engineer_prompt.approach;

    expect(taskTemplate).toContain('Do not emit `Issue:` bullets for valid patterns');
    expect(approach).toContain(
      'do not present that observation as an `Issue`, `Fix`, recommendation, or summary-table issue row'
    );
    expect(aiHelpers.async_perf_engineer_prompt.output_format).toContain(
      '[Prioritised list of actionable next steps]'
    );
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
      file_paths: ['test/foo.test.js', 'jest.config.ts', '.workflow_core/config/tooling.js'].join(
        '\n'
      ),
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

  test('rendered prompt explicitly forces inconclusive leak and cleanup dimensions for partial runtime coverage', () => {
    const prompt = buildYamlStepPrompt(aiHelpers, 'async_perf_engineer_prompt', {
      partition_header: '[Partition 1 of 2 — partial runtime coverage sample]',
      project_name: 'guia_js',
      project_summary: 'tourist guide SPA',
      project_kind: 'frontend_spa',
      primary_language: 'javascript',
      build_system: 'npm',
      test_framework: 'jest',
      source_file_count:
        '10 total runtime (3 readable with async patterns; 1 covered in this request)',
      modified_count: '3',
      file_paths: ['src/utils/maps-integration.ts'].join('\n'),
      partition_scope_note:
        'This request covers 1 of 3 readable runtime JavaScript/TypeScript file(s) that contained detectable async patterns in this review run. 7 additional runtime file(s) were excluded by the async-pattern filter and are not shown here. Treat coverage as partial, include the warning "⚠️ Coverage may be partial — not all source files were provided", and mark Memory Leaks and Resource Cleanup as inconclusive unless every lifecycle path needed for a claim is fully visible in the listed excerpts.',
      file_content_block: [
        '### `src/utils/maps-integration.ts`',
        '```ts',
        'observer.observe(node, { childList: true });',
        '```',
      ].join('\n'),
    });

    expect(prompt).toContain('Generated build artifacts and generated documentation assets');
    expect(prompt).toContain('docs/api/**');
    expect(prompt).toContain('MUST mark those two dimensions as inconclusive');
    expect(prompt).toContain('⚠️ Coverage may be partial — not all source files were provided');
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

  test('rendered prompt carries non-finding guardrails and output format keeps status-only summaries', () => {
    const prompt = buildYamlStepPrompt(aiHelpers, 'async_perf_engineer_prompt', {
      partition_header: '',
      project_name: 'guia_js',
      project_summary: 'tourist guide SPA',
      project_kind: 'frontend_spa',
      primary_language: 'javascript',
      build_system: 'npm',
      test_framework: 'jest',
      source_file_count: '1 total runtime (1 with async patterns)',
      modified_count: '1',
      file_paths: ['src/app.ts'].join('\n'),
      partition_scope_note:
        'This request covers all 1 readable runtime JavaScript/TypeScript file(s).',
      file_content_block: [
        '### `src/app.ts`',
        '```ts',
        'window.addEventListener("hashchange", scheduleRouteHandling);',
        '```',
      ].join('\n'),
    });

    expect(prompt).toContain('If an observation concludes the current code is valid');
    expect(prompt).toContain('Do not emit `Issue:` bullets for valid patterns');
    expect(aiHelpers.async_perf_engineer_prompt.output_format).toContain(
      '> **Status:** ✅ No issues | ⚠️ Minor issues (MEDIUM/LOW) | ❌ Significant issues (CRITICAL/HIGH)'
    );
    expect(aiHelpers.async_perf_engineer_prompt.output_format).toContain(
      '| Dimension | Status | Issue Count |'
    );
    expect(aiHelpers.async_perf_engineer_prompt.output_format).toContain(
      '[Prioritised list of actionable next steps]'
    );
  });
});
