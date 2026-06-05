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
import path from 'path';
import yaml from 'js-yaml';
import { buildYamlStepPrompt } from '../../src/lib/ai_prompt_builder.js';
import { AI_HELPERS_YAML_PATH, WORKFLOW_CORE_DIR } from '../helpers/workflow_core_paths.js';

describe('markdown_lint_prompt — config correctness', () => {
  let aiHelpers;
  let workflowStepsRaw;

  beforeAll(async () => {
    const [aiHelpersRaw, workflowStepsFile] = await Promise.all([
      fs.readFile(AI_HELPERS_YAML_PATH, 'utf8'),
      fs.readFile(
        path.join(WORKFLOW_CORE_DIR, 'config', 'ai_helpers', 'workflow_steps.yaml'),
        'utf8'
      ),
    ]);
    aiHelpers = yaml.load(aiHelpersRaw);
    workflowStepsRaw = workflowStepsFile;
  });

  test('markdown_lint_prompt key exists', () => {
    expect(aiHelpers).toHaveProperty('markdown_lint_prompt');
  });

  test('workflow_steps copy stays aligned with ai_helpers.yaml', () => {
    expect(workflowStepsRaw).toContain('markdown_lint_prompt:');
    expect(workflowStepsRaw).toContain('present, missing, or `Unavailable from visible evidence`');
    expect(workflowStepsRaw).toContain('Only mark a path **Present** or **Missing**');
    expect(workflowStepsRaw).toMatch(/Do not prescribe a repo-specific indentation[\s\S]*width/);
  });

  test('task_template requires an explicit style-guide source section', () => {
    const template = aiHelpers.markdown_lint_prompt.task_template;
    expect(template).toContain('**Style Guide Sources**');
    expect(template).toMatch(
      /lists each checked path as[\s\S]*present, missing, or `Unavailable from visible evidence`/
    );
    expect(template).toContain('**Visible evidence** means file paths or file-content blocks');
    expect(template).toContain('Only mark a path **Present** or **Missing**');
    expect(template).toContain('must not be restated as missing');
    expect(template).toMatch(
      /mark[\s\S]*style-guide check and any dependent conclusions[\s\S]*Inconclusive from provided evidence/
    );
  });

  test('task_template fails closed on sparse enabled-rule evidence', () => {
    const template = aiHelpers.markdown_lint_prompt.task_template;
    expect(template).toContain('Inconclusive from provided evidence');
    expect(template).toContain('Do not label the repository Excellent, Good, Needs Improvement,');
    expect(template).toMatch(
      /solely because no enabled-rule violations are visible[\s\S]*partial evidence/
    );
  });

  test('task_template forbids repo-specific indentation guidance without visible config', () => {
    const template = aiHelpers.markdown_lint_prompt.task_template;
    expect(template).toMatch(
      /if no indentation rule is shown[\s\S]*do not[\s\S]*repo-specific indent width/
    );
    expect(template).not.toContain('Nested lists must use 4-space');
    expect(template).not.toContain('Configure editor for 4-space indentation');
  });

  test('task_template requires portable commands and grounded trigger claims', () => {
    const template = aiHelpers.markdown_lint_prompt.task_template;
    expect(template).toMatch(/without requiring[\s\S]*shell-option changes such as `globstar`/);
    expect(template).toMatch(/prefer `find \.\.\. -exec[\s\S]*`rg --glob '\*\.md'`/);
    expect(template).toContain('Do not claim PR-wide, CI-wide, or branch-trigger coverage');
  });

  test('task_template keeps sparse-evidence remediation advice conditional', () => {
    const template = aiHelpers.markdown_lint_prompt.task_template;
    expect(template).toMatch(/keep commands generic examples[\s\S]*confirmed priority/);
    expect(template).toMatch(/do not describe them as missing gaps[\s\S]*next focus area/);
    expect(template).toMatch(
      /Do not describe `\.editorconfig`, pre-commit hooks, or CI linting[\s\S]*primary focus/
    );
    expect(template).toMatch(
      /repo-wide tooling status is not visible[\s\S]*`Unavailable from visible evidence`/
    );
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
    expect(prompt).toContain('present, missing, or `Unavailable from visible evidence`');
    expect(prompt).toContain('**Visible evidence** means file paths or file-content blocks');
    expect(prompt).toContain('Inconclusive from provided evidence');
    expect(prompt).toContain('Absence of visible enabled-rule mappings is not evidence of quality');
    expect(prompt).toMatch(
      /if no indentation rule is shown[\s\S]*do not[\s\S]*repo-specific indent width/
    );
    expect(prompt).toMatch(/without requiring[\s\S]*shell-option changes such as `globstar`/);
    expect(prompt).toContain('Do not claim PR-wide, CI-wide, or branch-trigger coverage');
    expect(prompt).toMatch(
      /do not end with a[\s\S]*recommendation that elevates[\s\S]*main\s+problem/
    );
    expect(prompt).toMatch(
      /Keep automation and prevention advice conditional[\s\S]*visible evidence/
    );
    expect(prompt).toMatch(
      /repo-wide tooling status is not visible[\s\S]*`Unavailable from visible evidence`/
    );
    expect(prompt).toContain(
      'Best Practices (only when the corresponding enabled-rule evidence is'
    );
  });
});
