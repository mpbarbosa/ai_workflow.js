/**
 * @fileoverview Regression tests for step5_directory_prompt in ai_helpers.yaml
 * @group integration
 */

import fs from 'fs/promises';
import yaml from 'js-yaml';
import { buildYamlStepPrompt } from '../../src/lib/ai_prompt_builder.js';
import { AI_HELPERS_YAML_PATH } from '../helpers/workflow_core_paths.js';

describe('step5_directory_prompt — config correctness', () => {
  let aiHelpers;

  beforeAll(async () => {
    const raw = await fs.readFile(AI_HELPERS_YAML_PATH, 'utf8');
    aiHelpers = yaml.load(raw);
  });

  test('task_template requires visible-file evidence handling for documentation claims', () => {
    const template = aiHelpers.step5_directory_prompt.task_template;
    const promptText = [template, aiHelpers.step5_directory_prompt.approach].join('\n');
    expect(template).toContain('INDEX.md');
    expect(template).toContain('Authoritative Config Evidence');
    expect(template).toContain('{config_context}');
    expect(template).toContain('Documentation Files (visible content');
    expect(template).toContain('do not claim "No documentation found"');
    expect(template).toContain('unavailable or inconclusive');
    expect(template).toContain('directory-local `README.md` / `INDEX.md` files');
    expect(template).toContain('heuristics from the scanned documentation set');
    expect(template).toContain('repository-layout inventory entry');
    expect(template).toContain(
      'Treat visible directory trees, folder inventories, README files inside a directory'
    );
    expect(template).toContain(
      'Treat `.workflow-config.yaml` and other config files here as authoritative evidence'
    );
    expect(template).toContain(
      'Treat these files as the complete visible excerpts provided in this prompt'
    );
    expect(template).toContain(
      'When a file block has no truncation marker, you may treat that block as fully visible'
    );
    expect(template).toContain('If a config block ends with `... [truncated]`');
    expect(template).toContain('package.json');
    expect(template).toContain('contemporaneous artifacts shown in this prompt declare a version');
    expect(template).toContain('If the directory tree contains an explicit truncation marker');
    expect(template).toContain(
      'If a visible file block is incomplete before a directory inventory completes'
    );
    expect(template).toContain('flagged for clarification, not treated as hard errors');
    expect(template).toContain('clean pass or a confirmed documentation defect');
    expect(promptText).toContain('do not omit that requirement from your analysis');
    expect(promptText).toContain('report that mismatch explicitly');
    expect(template).toContain(
      'parent-directory visibility does **not** satisfy a file-level static-asset requirement'
    );
    expect(template).toContain(
      'Do not write phrases such as "present or the parent directory is."'
    );
    expect(promptText).toContain('do not collapse it into an overall success statement');
  });
});

describe('step5_directory_prompt — rendered prompt behavior', () => {
  let aiHelpers;

  beforeAll(async () => {
    const raw = await fs.readFile(AI_HELPERS_YAML_PATH, 'utf8');
    aiHelpers = yaml.load(raw);
  });

  test('buildYamlStepPrompt forces visible-file evidence handling when full docs are included', () => {
    const prompt = buildYamlStepPrompt(aiHelpers, 'step5_directory_prompt', {
      project_name: '/tmp/project',
      project_summary: 'example',
      project_description: 'example',
      primary_language: 'typescript',
      project_kind: 'configuration_library',
      dir_count: '4',
      change_scope: 'infrastructure',
      modified_count: '0',
      missing_critical: '0',
      undocumented_dirs: '1',
      doc_structure_mismatch: '0',
      structure_issues_content: '- [undocumented] docs/misc: Undocumented directory: docs/misc',
      dir_tree: [
        'docs',
        'docs/misc',
        'src',
        'test',
        '... [truncated: 2 additional directories not shown; total 6]',
      ].join('\n'),
      config_context: [
        '### .workflow-config.yaml',
        '```yaml',
        'structure:',
        '  static_assets:',
        '    - public/service-worker.js',
        '```',
        '### package.json',
        '```json',
        '{',
        '  "version": "1.2.0"',
        '}',
        '```',
      ].join('\n'),
      doc_context: [
        '### INDEX.md',
        '## Repository Layout',
        'ai_workflow_core/',
        '└── docs/',
        '',
        '### docs/ARCHITECTURE.md',
        '## Directory Structure',
        'ai_workflow_core/',
        '├── docs/',
        '│   └── misc/',
        '',
        '### README.md',
        '**Version:** 1.3.0',
      ].join('\n'),
      language_specific_directory_standards: '- Separate source and docs directories',
    });

    expect(prompt).toContain(
      'Treat these files as the complete visible excerpts provided in this prompt'
    );
    expect(prompt).toContain('Authoritative Config Evidence');
    expect(prompt).toContain('public/service-worker.js');
    expect(prompt).toContain('do not claim "No documentation found"');
    expect(prompt).toContain('unavailable or inconclusive');
    expect(prompt).toContain('Do not rely on documentation content outside the visible files here');
    expect(prompt).toContain('Directories Not Matched in Scanned Docs');
    expect(prompt).toContain('Treat these automated findings as heuristics');
    expect(prompt).toContain('repository-layout inventory entry');
    expect(prompt).toContain('valid documentation evidence for that directory');
    expect(prompt).toContain('explicit truncation marker');
    expect(prompt).toContain('shared index such as `.github/SKILLS.md`');
    expect(prompt).toContain('flagged for clarification, not treated as hard errors');
    expect(prompt).toContain('clean pass or a confirmed documentation defect');
    expect(prompt).toContain('contemporaneous artifacts shown in this prompt declare a version');
    expect(prompt).toContain('report a version mismatch when they disagree');
    expect(prompt).toContain(
      'If a visible file block is incomplete before a directory inventory completes'
    );
    expect(prompt).toContain('If a config block ends with `... [truncated]`');
    expect(prompt).toContain('do not omit that requirement from your analysis');
    expect(prompt).toContain('report that mismatch explicitly');
    expect(prompt).toContain(
      'parent-directory visibility does **not** satisfy a file-level static-asset requirement'
    );
    expect(prompt).toContain('mark that asset check as inconclusive');
    expect(prompt).toContain('do not collapse it into an overall success statement');
  });
});
