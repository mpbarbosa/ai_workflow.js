/**
 * @fileoverview Regression tests for the Step 4 supplementary quality_prompt template.
 *
 * Ensures the generated ai_helpers.yaml includes file-content injection and
 * evidence-limit guidance so the supplementary code-quality review cannot
 * overclaim when only partial config evidence is available.
 */

import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';
import { buildYamlStepPrompt } from '../../src/lib/ai_prompt_builder.js';

const PROJECT_ROOT = process.cwd();
const AI_HELPERS_YAML_PATH = path.join(PROJECT_ROOT, '.workflow_core', 'config', 'ai_helpers.yaml');

describe('quality_prompt — config correctness', () => {
  let aiHelpers;

  beforeAll(async () => {
    const raw = await fs.readFile(AI_HELPERS_YAML_PATH, 'utf8');
    aiHelpers = yaml.load(raw);
  });

  test('quality_prompt includes file-content injection placeholders', () => {
    const template = aiHelpers.quality_prompt.task_template;

    expect(template).toContain(
      '**Provided file contents and excerpts (authoritative for content-level claims):**'
    );
    expect(template).toContain('{file_content_map}');
    expect(template).toContain('{quality_scope_note}');
  });

  test('quality_prompt includes inconclusive-result guidance', () => {
    const approach = aiHelpers.quality_prompt.approach;

    expect(approach).toContain('Work only from the injected file contents above');
    expect(approach).toContain('unavailable or inconclusive');
    expect(approach).toContain('Do not say all listed files are clean');
    expect(approach).toContain(
      'Treat `tsconfig*.json`, `jsconfig*.json`, and `.vscode/*.json` as JSONC-capable'
    );
    expect(approach).toContain('Do not recommend adding comments, READMEs, or rationale notes');
  });

  test('rendered prompt includes scope note and visible file contents', () => {
    const prompt = buildYamlStepPrompt(aiHelpers, 'quality_prompt', {
      files_to_review: 'package.json, .workflow_core/package.json',
      file_content_map: ['--- package.json ---', '```', '{"name":"ai-workflow"}', '```'].join('\n'),
      quality_scope_note:
        'This supplementary review covers 2 listed configuration file(s). Every listed file below is visible in full in the provided file-contents block.',
    });

    expect(prompt).toContain(
      'Review the following files for code quality: package.json, .workflow_core/package.json'
    );
    expect(prompt).toContain('--- package.json ---');
    expect(prompt).toContain('{"name":"ai-workflow"}');
    expect(prompt).toContain('Every listed file below is visible in full');
  });
});
