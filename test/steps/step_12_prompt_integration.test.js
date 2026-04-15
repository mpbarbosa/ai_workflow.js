/**
 * @fileoverview Regression test: step12_git_commit_prompt wording stays grounded.
 *
 * Verifies that the generated Step 12 prompt does not overclaim where workflow
 * version metadata comes from and keeps the canonical dotted config filename.
 *
 * @group integration
 */

import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';
import { buildYamlStepPrompt } from '../../src/lib/ai_prompt_builder.js';

const PROJECT_ROOT = process.cwd();
const AI_HELPERS_YAML_PATH = path.join(PROJECT_ROOT, '.workflow_core', 'config', 'ai_helpers.yaml');

describe('step12_git_commit_prompt — config correctness', () => {
  let aiHelpers;

  beforeAll(async () => {
    const raw = await fs.readFile(AI_HELPERS_YAML_PATH, 'utf8');
    aiHelpers = yaml.load(raw);
  });

  test('step12_git_commit_prompt key exists', () => {
    expect(aiHelpers).toHaveProperty('step12_git_commit_prompt');
  });

  test('task_template uses the canonical dotted workflow config path', () => {
    const template = aiHelpers.step12_git_commit_prompt.task_template;
    expect(template).toContain('`.workflow-config.yaml`');
    expect(template).not.toContain('`workflow-config.yaml`');
  });

  test('task_template describes project version metadata without claiming a dedicated workflow version field', () => {
    const template = aiHelpers.step12_git_commit_prompt.task_template;
    expect(template).toContain("run for this project's current version");
    expect(template).toContain('project version typically sourced from `package.json`');
    expect(template).toContain('supplemental project metadata');
    expect(template).not.toContain('version defined in `package.json` and `.workflow-config.yaml`');
  });

  test('task_template requires grounded wording when evidence is partial or counts disagree', () => {
    const template = aiHelpers.step12_git_commit_prompt.task_template;
    expect(template).toContain('Treat "Changed Files" as the authoritative list of project files in scope');
    expect(template).toMatch(
      /Do\s+not claim validation, synchronization, alignment, or completeness/
    );
    expect(template).toMatch(/If counts disagree or the\s+evidence is partial/);
  });
});

describe('step12_git_commit_prompt — rendered prompt behavior', () => {
  let aiHelpers;

  beforeAll(async () => {
    const raw = await fs.readFile(AI_HELPERS_YAML_PATH, 'utf8');
    aiHelpers = yaml.load(raw);
  });

  test('buildYamlStepPrompt renders the grounded workflow metadata wording', () => {
    const prompt = buildYamlStepPrompt(aiHelpers, 'step12_git_commit_prompt', {
      project_name: 'gitx',
      project_summary: 'TypeScript Ink TUI App for git commands with MCP',
      script_version: '1.1.8',
      change_scope: 'docs(documentation): 6 files changed',
      git_context: 'abc123 docs: prior change',
      changed_files:
        '.github/skills/sync-workflow-config/SKILL.md\n.workflow-config.yaml\nREADME.md',
      diff_summary: '2 files changed, 4 insertions(+), 2 deletions(-)',
      git_analysis_content: 'docs(documentation): update docs and config',
      diff_sample: 'diff --git a/README.md b/README.md',
      commit_types: '- docs: Documentation only changes',
    });

    expect(prompt).toContain(
      "Workflow: Tests & Documentation Automation v1.1.8 (ai_workflow automated pipeline run for this project's current version;"
    );
    expect(prompt).toContain('project version typically sourced from `package.json`');
    expect(prompt).toContain('`.workflow-config.yaml`');
    expect(prompt).toContain('.github/skills/sync-workflow-config/SKILL.md');
    expect(prompt).toContain('Treat "Changed Files" as the authoritative list of project files in scope');
    expect(prompt).not.toContain('version defined in `package.json` and `.workflow-config.yaml`');
  });
});
