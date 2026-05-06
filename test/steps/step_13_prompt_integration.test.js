/**
 * @fileoverview Regression test: markdown_lint_prompt stays evidence-grounded.
 *
 * Verifies that the generated Step 13 prompt requires an explicit style-guide
 * source check, refuses to turn sparse enabled-rule evidence into a positive
 * quality rating, and avoids non-portable command / CI-trigger assumptions.
 *
 * @group integration
 */

import fs from 'fs/promises';
import yaml from 'js-yaml';
import { buildYamlStepPrompt } from '../../src/lib/ai_prompt_builder.js';
import { AI_HELPERS_YAML_PATH } from '../helpers/workflow_core_paths.js';

describe('markdown_lint_prompt — config correctness', () => {
  let aiHelpers;

  beforeAll(async () => {
    const raw = await fs.readFile(AI_HELPERS_YAML_PATH, 'utf8');
    aiHelpers = yaml.load(raw);
  });

  test('markdown_lint_prompt key exists', () => {
    expect(aiHelpers).toHaveProperty('markdown_lint_prompt');
  });

  test('task_template requires an explicit style-guide source section', () => {
    const template = aiHelpers.markdown_lint_prompt.task_template;
    expect(template).toContain('**Style Guide Sources**');
    expect(template).toMatch(/lists each checked path as[\s\S]*present or missing/);
    expect(template).toMatch(/mark the analysis[\s\S]*inconclusive/);
  });

  test('task_template fails closed on sparse enabled-rule evidence', () => {
    const template = aiHelpers.markdown_lint_prompt.task_template;
    expect(template).toContain('Inconclusive from provided evidence');
    expect(template).toContain(
      'Do not label the repository Excellent, Good, Needs Improvement,'
    );
    expect(template).toMatch(/solely because no enabled-rule violations are visible[\s\S]*partial evidence/);
  });

  test('task_template requires portable commands and grounded trigger claims', () => {
    const template = aiHelpers.markdown_lint_prompt.task_template;
    expect(template).toMatch(/without requiring[\s\S]*shell-option changes such as `globstar`/);
    expect(template).toMatch(/prefer `find \.\.\. -exec[\s\S]*`rg --glob '\*\.md'`/);
    expect(template).toContain('Do not claim PR-wide, CI-wide, or branch-trigger coverage');
  });
});

describe('markdown_lint_prompt — rendered prompt behavior', () => {
  let aiHelpers;

  beforeAll(async () => {
    const raw = await fs.readFile(AI_HELPERS_YAML_PATH, 'utf8');
    aiHelpers = yaml.load(raw);
  });

  test('buildYamlStepPrompt renders the evidence-guardrail wording', () => {
    const prompt = buildYamlStepPrompt(aiHelpers, 'markdown_lint_prompt', {
      lint_report: [
        'Files linted: 7',
        'Total issues: 157',
        'Clean files: 0',
        'Anti-patterns: 0',
        'Status: fail',
        '',
        'Issues by rule:',
        'MD029: 132 occurrence(s)',
        'MD013: 24 occurrence(s)',
        'MD022: 1 occurrence(s)',
      ].join('\n'),
      current_branch: 'main',
      modified_md_count: '2',
    });

    expect(prompt).toContain('**Style Guide Sources**');
    expect(prompt).toContain('present or missing');
    expect(prompt).toContain('Inconclusive from provided evidence');
    expect(prompt).toContain('Absence of visible enabled-rule mappings is not evidence of quality');
    expect(prompt).toMatch(/without requiring[\s\S]*shell-option changes such as `globstar`/);
    expect(prompt).toContain('Do not claim PR-wide, CI-wide, or branch-trigger coverage');
  });
});
