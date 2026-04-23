/**
 * @fileoverview Regression test: doc_analysis_prompt in ai_helpers.yaml
 *
 * Verifies that the generated Step 01 documentation prompt remains repository-agnostic
 * and does not hardcode docs/ or CONTRIBUTING-only assumptions into every target project.
 *
 * @group integration
 */

import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';
import {
  buildDocAnalysisPrompt,
  buildYamlStepPrompt,
  resolveAllRoleRefs,
} from '../../src/lib/ai_prompt_builder.js';

const PROJECT_ROOT = process.cwd();
const AI_HELPERS_YAML_PATH = path.join(PROJECT_ROOT, '.workflow_core', 'config', 'ai_helpers.yaml');
const PROMPT_ROLES_PATH = path.join(PROJECT_ROOT, '.workflow_core', 'config', 'prompt_roles.yaml');

async function loadRealAiHelpersYaml() {
  const content = await fs.readFile(AI_HELPERS_YAML_PATH, 'utf8');
  const raw = yaml.load(content);
  const rolesContent = await fs.readFile(PROMPT_ROLES_PATH, 'utf8');
  const roles = yaml.load(rolesContent);
  return { content, parsed: resolveAllRoleRefs(raw, roles) };
}

describe('doc_analysis_prompt — config correctness', () => {
  test('doc_analysis_prompt key exists in ai_helpers.yaml', async () => {
    const { parsed } = await loadRealAiHelpersYaml();
    expect(parsed).toHaveProperty('doc_analysis_prompt');
  });

  test('task_template no longer hardcodes CONTRIBUTING quick-link docs scope', async () => {
    const { parsed } = await loadRealAiHelpersYaml();
    const template = parsed.doc_analysis_prompt.task_template;

    expect(template).not.toContain('Quick links table of `CONTRIBUTING.md`');
    expect(template).not.toContain('docs/GETTING_STARTED.md');
    expect(template).not.toContain('docs/ARCHITECTURE.md');
    expect(template).not.toContain('docs/API.md');
  });

  test('task_template no longer assumes src/index.js is the universal entrypoint', async () => {
    const { parsed } = await loadRealAiHelpersYaml();
    expect(parsed.doc_analysis_prompt.task_template).not.toContain('src/index.js');
  });
});

describe('doc_analysis_prompt — rendered prompt behavior', () => {
  test('rendered prompt stays within provided documentation scope and authority docs', async () => {
    const { parsed } = await loadRealAiHelpersYaml();

    const prompt = buildYamlStepPrompt(parsed, 'doc_analysis_prompt', {
      partition_header:
        '[Partition 1 of 2 — analyze ONLY the files or file-parts listed below for this request]',
      partition_scope_note:
        'This request covers 1 of 2 scoped file(s) for the current documentation-analysis category. Entries labeled "(part X/Y)" are sequential chunks of oversized files that were split across multiple prompt requests to avoid truncated evidence.',
      project_name: 'gitx',
      primary_language: 'typescript',
      changed_files: 'README.md, ARCHITECTURE.md, package.json',
      doc_files: 'README.md, ARCHITECTURE.md',
      file_paths_in_request: '      - README.md (part 1/2)\n      - package.json',
      file_contents: '=== README.md ===\nCurrent content excerpt',
      project_conventions: '### .github/copilot-instructions.md\nUse npm run lint.',
    });

    expect(prompt).toContain('analyze ONLY the files or file-parts listed below for this request');
    expect(prompt).toContain('split across multiple prompt requests to avoid truncated evidence');
    expect(prompt).toContain('README.md (part 1/2)');
    expect(prompt).toContain(
      'Analyze ONLY the documentation files explicitly listed above plus any additional documentation files that already appear in the provided changed-file list.'
    );
    expect(prompt).toContain(
      'Entries labeled "(part X/Y)" are sequential chunks of oversized files; treat unseen parts or omitted files as unavailable'
    );
    expect(prompt).toContain('**Provided file contents and excerpts**:');
    expect(prompt).toContain('=== README.md ===');
    expect(prompt).toContain(
      'Use the provided file contents and changed-file excerpts to examine what was modified in each changed file'
    );
    expect(prompt).toContain(
      'Avoid verbosity, creative expansion, and speculative rewrites beyond the visible change set'
    );
    expect(prompt).toContain('Unavailable" or "Inconclusive"');
    expect(prompt).toContain('.github/copilot-instructions.md');
    expect(prompt).not.toContain('Quick links table of `CONTRIBUTING.md`');
    expect(prompt).not.toContain('docs/GETTING_STARTED.md');
    expect(prompt).not.toContain('src/index.js');
    expect(prompt).not.toContain('@workspace');
  });

  test('fallback builder requires inconclusive output when scoped file content is missing', () => {
    const prompt = buildDocAnalysisPrompt({
      changedFiles: ['README.md', 'package.json'],
      docFiles: ['README.md', 'CHANGELOG.md'],
      projectInfo: { language: 'TypeScript' },
    });

    expect(prompt).toContain('Unavailable" or "Inconclusive"');
    expect(prompt).toContain('visible file contents support that conclusion');
    expect(prompt).not.toContain('Default to "no changes"');
  });
});
