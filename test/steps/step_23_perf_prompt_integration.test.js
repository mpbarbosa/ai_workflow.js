/**
 * @fileoverview Regression tests for performance_review_prompt evidence scoping.
 */

import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';
import { buildYamlStepPrompt } from '../../src/lib/ai_prompt_builder.js';

const PROJECT_ROOT = process.cwd();
const AI_HELPERS_YAML_PATH = path.join(PROJECT_ROOT, '.workflow_core', 'config', 'ai_helpers.yaml');

describe('performance_review_prompt — evidence scoping', () => {
  let aiHelpers;

  beforeAll(async () => {
    const raw = await fs.readFile(AI_HELPERS_YAML_PATH, 'utf8');
    aiHelpers = yaml.load(raw);
  });

  test('requires inconclusive handling for sampled or truncated evidence', () => {
    const approach = aiHelpers.performance_review_prompt.approach;

    expect(approach).toContain('excerpt-limited evidence');
    expect(approach).toContain('unavailable or inconclusive');
    expect(approach).toContain('Do not infer repo-wide absence of benchmarks');
    expect(approach).toContain('Treat ordinary top-level imports in CLI command modules as normal');
  });

  test('allows line references only when determinable from the visible excerpt', () => {
    const approach = aiHelpers.performance_review_prompt.approach;

    expect(approach).toContain('line reference (if determinable)');
    expect(approach).toContain('line reference is unavailable from the provided context');
    expect(approach).toContain('instead of inventing precision');
  });

  test('rendered prompt preserves excerpt-limited guidance alongside truncated source input', () => {
    const prompt = buildYamlStepPrompt(aiHelpers, 'performance_review_prompt', {
      partition_header:
        '[Partition 1 of 2 — analyze ONLY the files or file-parts listed below for this request]',
      partition_scope_note:
        'This request covers 1 of 2 JavaScript/TypeScript files in the current performance-review run. Entries labeled "(part X/Y)" are sequential chunks of oversized files that were split across multiple prompt logs to avoid truncated code excerpts.',
      project_name: 'gitx',
      project_summary: 'TypeScript Ink TUI app',
      primary_language: 'JavaScript/TypeScript',
      build_system: 'npm',
      source_file_count: '1',
      file_paths: '      - src/app.tsx',
      file_content_block: [
        '### `src/app.tsx`',
        '```tsx',
        'export function App() {',
        "  return <Text>gitx</Text>;",
        '}',
        '',
        '... [truncated — remainder omitted]',
        '```',
      ].join('\n'),
    });

    expect(prompt).toContain('excerpt-limited evidence');
    expect(prompt).toContain('line reference (if determinable)');
    expect(prompt).toContain('analyze ONLY the files or file-parts listed below');
    expect(prompt).toContain('split across multiple prompt logs to avoid truncated code excerpts');
    expect(prompt).toContain('... [truncated — remainder omitted]');
    expect(prompt).toContain('Do not recommend lazy loading, code splitting, or benchmarking merely because');
  });
});
