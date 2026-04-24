/**
 * @fileoverview Regression tests for configuration_specialist_prompt partition handling
 * @group integration
 */

import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';
import { buildYamlStepPrompt } from '../../src/lib/ai_prompt_builder.js';

const PROJECT_ROOT = process.cwd();
const AI_HELPERS_YAML_PATH = path.join(PROJECT_ROOT, '.workflow_core', 'config', 'ai_helpers.yaml');

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
