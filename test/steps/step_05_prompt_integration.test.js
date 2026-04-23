/**
 * @fileoverview Regression tests for step5_directory_prompt in ai_helpers.yaml
 * @group integration
 */

import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';
import { buildYamlStepPrompt } from '../../src/lib/ai_prompt_builder.js';

const PROJECT_ROOT = process.cwd();
const AI_HELPERS_YAML_PATH = path.join(PROJECT_ROOT, '.workflow_core', 'config', 'ai_helpers.yaml');

describe('step5_directory_prompt — config correctness', () => {
  let aiHelpers;

  beforeAll(async () => {
    const raw = await fs.readFile(AI_HELPERS_YAML_PATH, 'utf8');
    aiHelpers = yaml.load(raw);
  });

  test('task_template requires partial-evidence handling for documentation claims', () => {
    const template = aiHelpers.step5_directory_prompt.task_template;
    expect(template).toContain('INDEX.md');
    expect(template).toContain('Documentation Excerpts (partial');
    expect(template).toContain('Do not claim "No documentation found"');
    expect(template).toContain('unavailable or inconclusive');
    expect(template).toContain('directory-local `README.md` / `INDEX.md` files');
    expect(template).toContain('heuristics from the scanned documentation set');
    expect(template).toContain('repository-layout inventory entry');
    expect(template).toContain(
      'Treat visible directory trees, folder inventories, and README files inside a directory'
    );
    expect(template).toContain('flagged for clarification, not treated as hard errors');
    expect(template).toContain('clean pass or a confirmed documentation defect');
  });
});

describe('step5_directory_prompt — rendered prompt behavior', () => {
  let aiHelpers;

  beforeAll(async () => {
    const raw = await fs.readFile(AI_HELPERS_YAML_PATH, 'utf8');
    aiHelpers = yaml.load(raw);
  });

  test('buildYamlStepPrompt forces inconclusive documentation outcomes when excerpts are partial', () => {
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
      dir_tree: ['docs', 'docs/misc', 'src', 'test'].join('\n'),
      doc_context: [
        '### INDEX.md',
        '## Repository Layout',
        'ai_workflow_core/',
        '└── docs/',
        '### docs/ARCHITECTURE.md',
        '## Directory Structure',
        'ai_workflow_core/',
        '├── docs/',
        '│   └── misc/',
        '... [excerpt omitted]',
      ].join('\n'),
      language_specific_directory_standards: '- Separate source and docs directories',
    });

    expect(prompt).toContain('Treat these excerpts as partial evidence');
    expect(prompt).toContain('Do not claim "No documentation found"');
    expect(prompt).toContain('unavailable or inconclusive');
    expect(prompt).toContain('do not rely on documentation content outside the visible excerpts');
    expect(prompt).toContain('Directories Not Matched in Scanned Docs');
    expect(prompt).toContain('Treat these automated findings as heuristics');
    expect(prompt).toContain('repository-layout inventory entry');
    expect(prompt).toContain('valid documentation evidence for that directory');
    expect(prompt).toContain('flagged for clarification, not treated as hard errors');
    expect(prompt).toContain('clean pass or a confirmed documentation defect');
  });
});
