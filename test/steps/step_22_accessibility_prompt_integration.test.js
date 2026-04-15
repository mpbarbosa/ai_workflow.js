/**
 * @fileoverview Regression tests for accessibility_review_prompt evidence scoping.
 */

import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';
import { buildYamlStepPrompt } from '../../src/lib/ai_prompt_builder.js';

const PROJECT_ROOT = process.cwd();
const AI_HELPERS_YAML_PATH = path.join(PROJECT_ROOT, '.workflow_core', 'config', 'ai_helpers.yaml');

describe('accessibility_review_prompt — evidence scoping', () => {
  let aiHelpers;

  beforeAll(async () => {
    const raw = await fs.readFile(AI_HELPERS_YAML_PATH, 'utf8');
    aiHelpers = yaml.load(raw);
  });

  test('uses generic UI artifact scope instead of hard-coded TypeDoc HTML', () => {
    const template = aiHelpers.accessibility_review_prompt.task_template;

    expect(template).toContain('{partition_header}');
    expect(template).toContain('{partition_scope_note}');
    expect(template).toContain('provided UI-related artifacts');
    expect(template).toContain('Sampled UI-related source files and/or generated markup/styles');
    expect(template).not.toContain('TypeDoc-generated API documentation (HTML)');
  });

  test('requires unavailable or inconclusive handling for partial or off-scope evidence', () => {
    const approach = aiHelpers.accessibility_review_prompt.approach;

    expect(approach).toContain('unavailable or inconclusive');
    expect(approach).toContain('source/test files rather than rendered HTML/CSS output');
    expect(approach).toContain('conflicting version numbers');
    expect(approach).toContain('terminal/native UI source');
    expect(approach).toContain('Do not infer `<main>`, `<nav>`, or any other semantic landmark');
    expect(approach).toContain('Missing focus management, focus order, or focus-visible logic');
    expect(approach).toContain('Only raise a missing-label finding when the control itself');
    expect(approach).toContain('Text that appears only in `aria-label`');
    expect(approach).toContain(
      'includes a `prefers-reduced-motion` guard or a `:focus-visible` rule'
    );
    expect(approach).toContain('No issues detected in the visible excerpts');
  });

  test('makes link-text and landmark checks explicitly evidence-bound', () => {
    const template = aiHelpers.accessibility_review_prompt.task_template;

    expect(template).toContain('Verify navigation landmark structure where visible');
    expect(template).toContain('do not treat `aria-label` text as visible anchor text');
  });

  test('rendered prompt preserves excerpt-limited guidance alongside truncated source input', () => {
    const prompt = buildYamlStepPrompt(aiHelpers, 'accessibility_review_prompt', {
      partition_header: '[Partition 1 of 2 — analyze ONLY this request scope]',
      partition_scope_note:
        'This request covers 1 of 2 files in the current accessibility-review run.',
      project_name: 'gitx',
      project_summary: 'TypeScript Ink TUI app',
      framework: 'vanilla',
      source_file_count: '1',
      file_paths: '      - src/app.tsx',
      file_content_block: [
        '### `src/app.tsx`',
        '```tsx',
        'export function App() {',
        '  return <Text>gitx</Text>;',
        '}',
        '',
        '... [truncated — remainder omitted]',
        '```',
      ].join('\n'),
    });

    expect(prompt).toContain('[Partition 1 of 2');
    expect(prompt).toContain('This request covers 1 of 2 files');
    expect(prompt).toContain('excerpt-limited evidence');
    expect(prompt).toContain('unavailable or inconclusive');
    expect(prompt).toContain('... [truncated — remainder omitted]');
  });
});
