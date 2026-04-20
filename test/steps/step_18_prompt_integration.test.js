/**
 * @fileoverview Regression tests for async_flow_debugger_prompt evidence scoping.
 */

import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';

const PROJECT_ROOT = process.cwd();
const AI_HELPERS_YAML_PATH = path.join(PROJECT_ROOT, '.workflow_core', 'config', 'ai_helpers.yaml');

describe('async_flow_debugger_prompt — evidence scoping', () => {
  let aiHelpers;

  beforeAll(async () => {
    const raw = await fs.readFile(AI_HELPERS_YAML_PATH, 'utf8');
    aiHelpers = yaml.load(raw);
  });

  test('specific expertise keeps split-file findings scoped to the visible partition', () => {
    const expertise = aiHelpers.async_flow_debugger_prompt.specific_expertise;

    expect(expertise).toContain('If a path is labeled `(part X/Y)`');
    expect(expertise).toContain('scoped to the visible excerpt/partition');
    expect(expertise).toContain('whole-file health');
  });

  test('approach forbids invented timing claims when runtime traces are absent', () => {
    const approach = aiHelpers.async_flow_debugger_prompt.approach;

    expect(approach).toContain(
      'If no runtime traces, logs, timestamps, or profiler output are provided'
    );
    expect(approach).toContain('duration claims unavailable');
    expect(approach).toContain('Timing evidence unavailable from static source excerpts');
  });

  test('output format keeps durations conditional on explicit timing evidence', () => {
    const outputFormat = aiHelpers.async_flow_debugger_prompt.output_format;

    expect(outputFormat).toContain(
      'Duration if explicit timing evidence is visible; otherwise unavailable'
    );
    expect(outputFormat).toContain('runtime timing validation is unavailable from this request');
  });
});
