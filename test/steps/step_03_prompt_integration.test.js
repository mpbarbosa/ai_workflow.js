/**
 * @fileoverview Regression test: step3_script_refs_prompt in ai_helpers.yaml
 *
 * Verifies that the generated prompt for step 03 matches the mixed automation
 * script scope used by the implementation, including non-shell entrypoints.
 *
 * @group integration
 */

import fs from 'fs/promises';
import yaml from 'js-yaml';
import { buildYamlStepPrompt } from '../../src/lib/ai_prompt_builder.js';
import { AI_HELPERS_YAML_PATH } from '../helpers/workflow_core_paths.js';

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

  test('task_template treats path variants as ambiguity instead of a clean pass', () => {
    const template = aiHelpers.step3_script_refs_prompt.task_template;
    expect(template).toContain('path variant: ...');
    expect(template).toContain('repository-root context agree with the scoped path');
    expect(template).toContain('path-context mismatch or ambiguity');
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

  test('rendered prompt forces inconclusive integration outcomes and interface-faithful examples', () => {
    const prompt = buildYamlStepPrompt(aiHelpers, 'step3_script_refs_prompt', {
      project_name: '/tmp/project',
      project_description: 'example',
      primary_language: 'typescript',
      project_kind: 'configuration_library',
      scripts_dir: 'scripts',
      script_count: '1',
      change_scope: 'infrastructure',
      modified_count: '0',
      issues: '1',
      script_issues_content: 'Undocumented scripts: 1',
      doc_coverage_map:
        'scripts/update_submodules.sh: documented in [README.md (path variant: .workflow_core/scripts/update_submodules.sh)]',
      all_scripts: 'scripts/update_submodules.sh',
      doc_context:
        '### README.md\nUse `bash .workflow_core/scripts/update_submodules.sh` after updates.',
    });

    expect(prompt).toContain('mark CI/container conclusions as unavailable or inconclusive');
    expect(prompt).toContain('Do not invent placeholder flags, positional arguments');
    expect(prompt).toContain('path-context mismatch or ambiguity');
  });
});
