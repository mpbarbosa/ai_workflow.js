/**
 * @fileoverview Regression tests for the step10_code_quality_prompt template.
 *
 * Ensures the generated ai_helpers.yaml includes the actual file-content injection
 * placeholder and the evidence-limit guidance that prevents unsupported success claims
 * when Step 10 only provides partial context.
 */

import fs from 'fs/promises';
import yaml from 'js-yaml';
import { buildYamlStepPrompt } from '../../src/lib/ai_prompt_builder.js';
import { AI_HELPERS_YAML_PATH } from '../helpers/workflow_core_paths.js';

describe('step10_code_quality_prompt — config correctness', () => {
  let aiHelpers;

  beforeAll(async () => {
    const raw = await fs.readFile(AI_HELPERS_YAML_PATH, 'utf8');
    aiHelpers = yaml.load(raw);
  });

  test('step10_code_quality_prompt includes file-content injection placeholder', () => {
    const template = aiHelpers.step10_code_quality_prompt.task_template;

    expect(template).toContain('**File Contents for Review:**');
    expect(template).toContain('{file_content_map}');
  });

  test('step10_code_quality_prompt includes inconclusive-result guidance', () => {
    const template = aiHelpers.step10_code_quality_prompt.task_template;
    const approach = aiHelpers.step10_code_quality_prompt.approach;

    expect(template).toContain('unavailable or inconclusive');
    expect(template).toContain(
      'Do not collapse multi-language or multi-file automated lint summaries'
    );
    expect(template).toContain('treat exported environment variables');
    expect(template).toContain('{partition_header}');
    expect(template).toContain('{partition_scope_note}');
    expect(template).toContain('Entries labeled `(part X/Y)`');
    expect(approach).toContain('Do not assert JSDoc completeness');
    expect(approach).toContain('Do not assess commit-message quality');
    expect(approach).toContain(
      'Do not restate repository-wide or multi-language automated summaries'
    );
    expect(approach).toContain('do not say "no globals"');
    expect(approach).toContain('Separate confirmed findings from inconclusive checks');
  });

  test('rendered prompt supports per-slice file-part labels', () => {
    const prompt = buildYamlStepPrompt(aiHelpers, 'step10_code_quality_prompt', {
      partition_header:
        '[Slice 1 of 2 within partition 1/3 — analyse ONLY the files or file-parts listed below for this request]',
      partition_scope_note:
        'This request covers 2 source files from the current partition. Entries labeled "(part X/Y)" are sequential chunks of oversized files that were split across multiple prompt logs to avoid truncated code excerpts.',
      project_name: 'gitx',
      project_summary: 'typescript project',
      primary_language: 'typescript',
      project_kind: 'typescript_cli',
      tech_stack_summary: 'typescript, ink',
      change_scope: 'mixed-changes',
      files_in_scope: '2',
      modified_count: '1',
      total_files: '13',
      language_breakdown: 'typescript, markdown',
      quality_summary: '0 issue(s)',
      quality_report_content: '# Code Quality Report',
      large_files_list: 'src/app.tsx',
      sample_code: '',
      file_content_map: [
        '### src/app.tsx (part 1/2)',
        '```',
        'export const App = () => null;',
        '```',
      ].join('\n'),
    });

    expect(prompt).toContain('Slice 1 of 2 within partition 1/3');
    expect(prompt).toContain('Files in This Request: 2');
    expect(prompt).toContain('src/app.tsx (part 1/2)');
    expect(prompt).toContain('sequential slices of an oversized source file');
  });
});
