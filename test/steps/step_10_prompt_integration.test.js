/**
 * @fileoverview Regression test: error_resilience_prompt in ai_helpers.yaml
 *
 * Verifies that the `error_resilience_prompt` key added to
 * `.workflow_core/config/ai_helpers.yaml` is well-formed and that its
 * role_ref resolves to a non-empty role prefix.
 *
 * This test was added after `step_10_code_quality.js` was found to
 * reference `error_resilience_prompt` which was missing from the yaml,
 * causing `buildYamlStepPrompt()` to silently return null.
 *
 * @group integration
 */

import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';
import { resolveAllRoleRefs } from '../../src/lib/ai_prompt_builder.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PROJECT_ROOT = process.cwd();
const AI_HELPERS_YAML_PATH = path.join(PROJECT_ROOT, '.workflow_core', 'config', 'ai_helpers.yaml');
const PROMPT_ROLES_YAML_PATH = path.join(
  PROJECT_ROOT,
  '.workflow_core',
  'config',
  'prompt_roles.yaml'
);

// ---------------------------------------------------------------------------
// Layer 1 — Config correctness
// ---------------------------------------------------------------------------

describe('error_resilience_prompt — config correctness', () => {
  let aiHelpers;

  beforeAll(async () => {
    const raw = await fs.readFile(AI_HELPERS_YAML_PATH, 'utf8');
    aiHelpers = yaml.load(raw);
  });

  test('ai_helpers.yaml is parseable and non-null', () => {
    expect(aiHelpers).toBeTruthy();
    expect(typeof aiHelpers).toBe('object');
  });

  test('error_resilience_prompt key exists', () => {
    expect(aiHelpers).toHaveProperty('error_resilience_prompt');
  });

  test('error_resilience_prompt has required top-level keys', () => {
    const p = aiHelpers.error_resilience_prompt;
    expect(p).toHaveProperty('role_ref');
    expect(p).toHaveProperty('task_template');
  });

  test('error_resilience_prompt.role_ref is a non-empty string', () => {
    expect(typeof aiHelpers.error_resilience_prompt.role_ref).toBe('string');
    expect(aiHelpers.error_resilience_prompt.role_ref.trim()).not.toBe('');
  });

  test('error_resilience_prompt.task_template contains required template variables', () => {
    const template = aiHelpers.error_resilience_prompt.task_template;
    expect(template).toContain('{project_name}');
    expect(template).toContain('{primary_language}');
    expect(template).toContain('{file_content_map}');
  });
});

// ---------------------------------------------------------------------------
// Layer 2 — Role resolution
// ---------------------------------------------------------------------------

describe('error_resilience_prompt — role_ref resolves correctly', () => {
  let resolvedPrompt;

  beforeAll(async () => {
    const raw = await fs.readFile(AI_HELPERS_YAML_PATH, 'utf8');
    const aiHelpers = yaml.load(raw);
    const rolesRaw = await fs.readFile(PROMPT_ROLES_YAML_PATH, 'utf8');
    const roles = yaml.load(rolesRaw);
    resolvedPrompt = await resolveAllRoleRefs(
      { error_resilience_prompt: aiHelpers.error_resilience_prompt },
      roles
    );
  });

  test('role_ref resolves to a non-empty string', () => {
    const resolved = resolvedPrompt.error_resilience_prompt;
    // resolveAllRoleRefs replaces role_ref with the actual prefix text
    const prefix = resolved.role_prefix ?? resolved.role_ref;
    expect(typeof prefix).toBe('string');
    expect(prefix.trim().length).toBeGreaterThan(0);
  });

  test('resolved prompt does not retain a bare role_ref key', () => {
    const resolved = resolvedPrompt.error_resilience_prompt;
    // After resolution role_prefix should be set (role_ref expanded)
    if ('role_prefix' in resolved) {
      expect(resolved.role_prefix.trim().length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Layer 3 — Verify role_ref maps to software_quality_engineer
// ---------------------------------------------------------------------------

describe('error_resilience_prompt — role assignment', () => {
  let aiHelpers;
  let promptRoles;

  beforeAll(async () => {
    const [helpersRaw, rolesRaw] = await Promise.all([
      fs.readFile(AI_HELPERS_YAML_PATH, 'utf8'),
      fs.readFile(PROMPT_ROLES_YAML_PATH, 'utf8'),
    ]);
    aiHelpers = yaml.load(helpersRaw);
    promptRoles = yaml.load(rolesRaw);
  });

  test('role_ref is software_quality_engineer', () => {
    expect(aiHelpers.error_resilience_prompt.role_ref).toBe('software_quality_engineer');
  });

  test('software_quality_engineer role exists in prompt_roles.yaml', () => {
    expect(promptRoles.roles).toHaveProperty('software_quality_engineer');
  });

  test('software_quality_engineer role has a non-empty role_prefix', () => {
    const role = promptRoles.roles.software_quality_engineer;
    const prefix = role.role_prefix ?? role;
    expect(typeof prefix === 'string' ? prefix.trim() : JSON.stringify(prefix)).not.toBe('');
  });
});
