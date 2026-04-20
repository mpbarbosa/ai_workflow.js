/**
 * @fileoverview Regression tests for test_strategy_prompt evidence boundaries.
 * @group integration
 */

import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';
import { buildYamlStepPrompt } from '../../src/lib/ai_prompt_builder.js';

const PROJECT_ROOT = process.cwd();
const AI_HELPERS_YAML_PATH = path.join(PROJECT_ROOT, '.workflow_core', 'config', 'ai_helpers.yaml');

describe('test_strategy_prompt — config correctness', () => {
  let aiHelpers;

  beforeAll(async () => {
    const raw = await fs.readFile(AI_HELPERS_YAML_PATH, 'utf8');
    aiHelpers = yaml.load(raw);
  });

  test('approach requires inconclusive handling for partial test evidence', () => {
    const approach = aiHelpers.test_strategy_prompt.approach;
    expect(approach).toContain(
      'Treat the supplied coverage stats and test file list as the full evidence set'
    );
    expect(approach).toContain('mark any dependent conclusion as unavailable or inconclusive');
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
      coverage_stats: '80% (4/5 source files have tests, 8 total test files)',
      test_files: [
        'src/ (6): loader.test.ts, README.md, README.md, ... (+3 more)',
        'test/ (2): index.test.ts, types.test.ts',
      ].join('\n'),
      modified_count: '4',
    });

    expect(prompt).toContain(
      'If the test file inventory is truncated, summarized, contains placeholders/ellipsis'
    );
    expect(prompt).toContain('mark any dependent conclusion as unavailable or inconclusive');
    expect(prompt).toContain(
      'Do not name modules, subsystems, files, or architectural areas unless they appear explicitly'
    );
    expect(prompt).toContain(
      'Do not claim integration, e2e, browser/API, observer/event, workflow, orchestrator, or checkpointing gaps'
    );
    expect(prompt).toContain(
      'Recommendations may be conditional, but claims about current coverage must stay evidence-backed'
    );
  });
});
