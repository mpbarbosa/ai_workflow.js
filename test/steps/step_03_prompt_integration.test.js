/**
 * @fileoverview Regression test: step3_script_refs_prompt in ai_helpers.yaml
 *
 * Verifies that the generated prompt for step 03 matches the mixed automation
 * script scope used by the implementation, including non-shell entrypoints.
 *
 * @group integration
 */

import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';
import { buildYamlStepPrompt } from '../../src/lib/ai_prompt_builder.js';

const PROJECT_ROOT = process.cwd();
const AI_HELPERS_YAML_PATH = path.join(PROJECT_ROOT, '.workflow_core', 'config', 'ai_helpers.yaml');

describe('step3_script_refs_prompt — config correctness', () => {
  let aiHelpers;

  beforeAll(async () => {
    const raw = await fs.readFile(AI_HELPERS_YAML_PATH, 'utf8');
    aiHelpers = yaml.load(raw);
  });

  test('step3_script_refs_prompt key exists', () => {
    expect(aiHelpers).toHaveProperty('step3_script_refs_prompt');
  });

  test('task_template describes automation scripts and executable entrypoints', () => {
    const template = aiHelpers.step3_script_refs_prompt.task_template;
    expect(template).toContain('automation script references and documentation quality');
    expect(template).toContain('scripts and executable entrypoints');
    expect(template).toContain('non-shell automation entrypoints');
  });

  test('task_template no longer excludes non-shell executables from scoped analysis', () => {
    const template = aiHelpers.step3_script_refs_prompt.task_template;
    expect(template).not.toContain(
      'Do not broaden this step to Node.js, Python, or other non-shell executables.'
    );
    expect(template).toContain('Apply shell-specific checks only to shell scripts in scope.');
  });
});

describe('step3_script_refs_prompt — rendered prompt behavior', () => {
  let aiHelpers;

  beforeAll(async () => {
    const raw = await fs.readFile(AI_HELPERS_YAML_PATH, 'utf8');
    aiHelpers = yaml.load(raw);
  });

  test('buildYamlStepPrompt keeps mixed script scope and zero-shell fallback', () => {
    const prompt = buildYamlStepPrompt(aiHelpers, 'step3_script_refs_prompt', {
      project_name: '/tmp/project',
      project_description: 'example',
      primary_language: 'javascript',
      project_kind: 'nodejs_api',
      scripts_dir: 'scripts, bin',
      script_count: '2',
      change_scope: 'docs_only',
      modified_count: '1',
      issues: '0',
      script_issues_content: 'none',
      doc_coverage_map: 'bin/ai-workflow.js: README.md',
      all_scripts: ['bin/ai-workflow.js', 'scripts/validate-exports.js'].join('\n'),
      doc_context: '### README.md\nUse `ai-workflow` to run the CLI.',
    });

    expect(prompt).toContain(
      'Treat that list as the complete authoritative scope even when it mixes shell scripts with Node.js, TypeScript, Python, or other executable entrypoints.'
    );
    expect(prompt).toContain(
      'If scripts are listed but none of them are shell scripts, continue the analysis for those'
    );
    expect(prompt).toContain('Apply shell-specific checks only to shell scripts in scope.');
  });

  test('rendered prompt treats doc excerpts as partial evidence instead of proof of global gaps', () => {
    const prompt = buildYamlStepPrompt(aiHelpers, 'step3_script_refs_prompt', {
      project_name: '/tmp/project',
      project_description: 'example',
      primary_language: 'javascript',
      project_kind: 'nodejs_api',
      scripts_dir: 'scripts, bin',
      script_count: '2',
      change_scope: 'full_validation',
      modified_count: '3',
      issues: '1',
      script_issues_content: '- scripts/setup.sh: missing usage docs',
      doc_coverage_map: 'scripts/setup.sh: README.md',
      all_scripts: ['scripts/setup.sh', 'bin/ai-workflow.js'].join('\n'),
      doc_context: [
        '### README.md',
        '# Project',
        '... [excerpt omitted]',
        '## Automation Scripts',
        '- `scripts/setup.sh`',
      ].join('\n'),
    });

    expect(prompt).toContain('Treat these excerpts as partial evidence');
    expect(prompt).toContain('do not claim that "no usage examples"');
    expect(prompt).toContain(
      'Treat README command examples, command tables, automation-script sections'
    );
  });
});
