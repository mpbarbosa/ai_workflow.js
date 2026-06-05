/**
 * @fileoverview Regression tests for test_strategy_prompt evidence boundaries.
 * @group integration
 */

import fs from 'fs/promises';
import yaml from 'js-yaml';
import { buildYamlStepPrompt } from '../../src/lib/ai_prompt_builder.js';
import { AI_HELPERS_YAML_PATH } from '../helpers/workflow_core_paths.js';

describe('test_strategy_prompt — config correctness', () => {
  let aiHelpers;

  beforeAll(async () => {
    const raw = await fs.readFile(AI_HELPERS_YAML_PATH, 'utf8');
    aiHelpers = yaml.load(raw);
  });

  test('approach requires inconclusive handling for partial test evidence', () => {
    const approach = aiHelpers.test_strategy_prompt.approach;
    expect(approach).toContain(
      'Treat the supplied file-inventory stats and summarized test inventory as baseline evidence'
    );
    expect(approach).toContain('File-inventory match is not the same as measured runtime coverage');
    expect(approach).toContain(
      'Do not name modules, subsystems, files, or architectural areas unless they appear explicitly'
    );
    expect(approach).toContain(
      'Do not claim integration, e2e, browser/API, observer/event, workflow, orchestrator, or checkpointing gaps'
    );
  });
});

describe('test_strategy_prompt — rendered prompt behavior', () => {
  let aiHelpers;

  beforeAll(async () => {
    const raw = await fs.readFile(AI_HELPERS_YAML_PATH, 'utf8');
    aiHelpers = yaml.load(raw);
  });

  test('buildYamlStepPrompt warns against over-claiming when test inventory is partial', () => {
    const prompt = buildYamlStepPrompt(aiHelpers, 'test_strategy_prompt', {
      project_name: 'ai_workflow_core',
      file_inventory_stats:
        '80% (4/5 actionable runtime source files have corresponding tests by naming convention; 8 total test files)',
      projected_file_inventory_stats:
        '100% (5/5 actionable runtime source files would have matching tests after generating 1 file in this run)',
      files_to_generate: 'src/runtime/service.ts',
      test_files: [
        'src/ (6): loader.test.ts, README.md, README.md, ... (+3 more)',
        'test/ (2): index.test.ts, types.test.ts',
      ].join('\n'),
      modified_count: '4',
    });

    expect(prompt).toContain(
      'If the inventory is truncated, summarized, contains placeholders/ellipsis'
    );
    expect(prompt).toContain('File-inventory match is not the same as measured runtime coverage');
    expect(prompt).toContain(
      'Do not name modules, subsystems, files, or architectural areas unless they appear explicitly'
    );
    expect(prompt).toContain(
      'Do not claim integration, e2e, browser/API, observer/event, workflow, orchestrator, or checkpointing gaps'
    );
    expect(prompt).toContain(
      'Recommendations may be conditional, but claims about current coverage must stay evidence-backed'
    );
    expect(prompt).toContain('Projected Inventory After This Run');
  });
});

describe('single_file_test_prompt — config correctness', () => {
  let aiHelpers;

  beforeAll(async () => {
    const raw = await fs.readFile(AI_HELPERS_YAML_PATH, 'utf8');
    aiHelpers = yaml.load(raw);
  });

  test('approach forbids inventing hidden imported interface shapes', () => {
    const approach = aiHelpers.single_file_test_prompt.approach;

    expect(approach).toContain(
      'Treat imported modules or interfaces that are not expanded in the prompt as hidden context'
    );
    expect(approach).toContain('If an imported interface or type is not fully visible');
    expect(approach).toContain('Prefer a strategy that avoids mocking that dependency directly');
  });
});

describe('single_file_test_prompt — rendered prompt behavior', () => {
  let aiHelpers;

  beforeAll(async () => {
    const raw = await fs.readFile(AI_HELPERS_YAML_PATH, 'utf8');
    aiHelpers = yaml.load(raw);
  });

  test('uses the target test extension for the output fence while preserving the source code fence', () => {
    const prompt = buildYamlStepPrompt(aiHelpers, 'single_file_test_prompt', {
      source_file: 'src/components/views/ExtraView.vue',
      target_test_path: '__tests__/components/views/ExtraView.vue.test.ts',
      test_framework: 'Jest',
      source_ext: 'vue',
      output_ext: 'ts',
      source_content: '<template><div /></template>',
      jest_constraints: '- Use standard Jest idioms for this project',
      typescript_constraints: '- Avoid implicit any',
      test_import_examples: "import ExtraView from '../../../src/components/views/ExtraView.vue';",
      mock_api_guidance: '`jest.mock()` with a factory function',
    });

    expect(prompt).toContain('single fenced code block (```ts ... ```)');
    expect(prompt).toContain('```vue\n<template><div /></template>\n```');
  });
});
