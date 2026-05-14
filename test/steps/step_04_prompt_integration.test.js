/**
 * @fileoverview Regression tests for configuration_specialist_prompt partition handling
 * @group integration
 */

import fs from 'fs/promises';
import yaml from 'js-yaml';
import { buildYamlStepPrompt } from '../../src/lib/ai_prompt_builder.js';
import { AI_HELPERS_YAML_PATH } from '../helpers/workflow_core_paths.js';

describe('configuration_specialist_prompt — partition handling', () => {
  let aiHelpers;

  beforeAll(async () => {
    const raw = await fs.readFile(AI_HELPERS_YAML_PATH, 'utf8');
    aiHelpers = yaml.load(raw);
  });

  test('task_template explains partitioned scope and generated-summary handling', () => {
    const template = aiHelpers.configuration_specialist_prompt.task_template;

    expect(template).toContain('{partition_header}');
    expect(template).toContain('{partition_scope_note}');
    expect(template).toContain('compact summary of a generated');
    expect(template).toContain('lockfile or other oversized');
    expect(template).toContain('do not infer, search for, or include any other files');
    expect(template).toContain('never use the exact');
    expect(template).toContain('"All configuration files validated successfully"');
  });

  test('approach constrains praise and freshness claims to visible evidence', () => {
    const approach = aiHelpers.configuration_specialist_prompt.approach;

    expect(approach).toContain(
      'Highlight only best practices that are directly visible in the shown content'
    );
    expect(approach).toContain('Do NOT give an overall success verdict for the entire scope');
    expect(approach).toContain(
      'Limit any "no issues found" wording to the visible excerpt(s) only'
    );
    expect(approach).toContain('keep conclusions partition-local');
    expect(approach).toContain('list each visible step ID');
  });

  test('rendered prompt preserves partition guidance alongside split file labels', () => {
    const prompt = buildYamlStepPrompt(aiHelpers, 'configuration_specialist_prompt', {
      project_name: 'gitx',
      partition_header:
        '[Partition 1 of 2 — analyze ONLY the files/slices listed below for this request]',
      partition_scope_note:
        'This partition covers 1 of 2 configuration files in the current run. Entries labeled "(part X/Y)" are deliberate sequential slices created to avoid prompt truncation; analyze only the visible slice(s) in this request.',
      partition_config_count: '1',
      config_files_list: '**Root**: .workflow-config.yaml (part 1/2)',
      config_files_content: [
        '--- .workflow-config.yaml (part 1/2) ---',
        '```yaml',
        'project:',
        '  name: "gitx"',
        '```',
      ].join('\n'),
      config_count: '2',
      project_kind: 'typescript',
      tech_stack: 'typescript, React, Jest',
    });

    expect(prompt).toContain('Partition 1 of 2');
    expect(prompt).toContain('files/slices listed below');
    expect(prompt).toContain('compact summary of a generated');
    expect(prompt).toContain('.workflow-config.yaml (part 1/2)');
  });
});

describe('quality_prompt — evidence fallback handling', () => {
  let aiHelpers;

  beforeAll(async () => {
    const raw = await fs.readFile(AI_HELPERS_YAML_PATH, 'utf8');
    aiHelpers = yaml.load(raw);
  });

  test('task_template and approach explain the evidence-gap fallback contract', () => {
    const template = aiHelpers.quality_prompt.task_template;
    const approach = aiHelpers.quality_prompt.approach;

    expect(template).toContain('Evidence Gap');
    expect(template).toContain('Treat `[empty file]` markers as');
    expect(approach).toContain('return only an `Evidence Gap` response');
    expect(approach).toContain('Treat `[empty file]` markers as grounded evidence');
  });

  test('rendered prompt preserves unavailable-evidence guidance', () => {
    const prompt = buildYamlStepPrompt(aiHelpers, 'quality_prompt', {
      files_to_review: 'package.json, .github/workflows/ci.yml',
      file_content_map:
        '(unavailable — no inline config excerpts could be prepared for this supplementary review; do not make file-level claims)',
      quality_scope_note:
        'Supplementary file-level quality review skipped because none of the 2 candidate configuration file(s) had inline excerpts available for prompt injection.',
    });

    expect(prompt).toContain('Evidence Gap');
    expect(prompt).toContain('package.json, .github/workflows/ci.yml');
    expect(prompt).toContain('do not make file-level claims');
    expect(prompt).toContain('Treat `[empty file]` markers as');
  });
});
