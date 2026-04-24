/**
 * Shared prompt-context helpers for steps that use ai_helpers.yaml plus optional
 * project-kind role overlays.
 *
 * @module steps/step_prompt_context_helpers
 */

import yaml from 'js-yaml';
import {
  AI_PROJECT_KINDS_PATH,
  buildProjectKindPrompt,
  loadResolvedAiHelpers,
} from '../lib/ai_prompt_builder.js';

/**
 * Load resolved AI helper YAML and the optional project-kind role override for
 * a step persona.
 *
 * Failures are intentionally swallowed so callers can preserve their existing
 * fallback behavior when prompt templates or project-kind metadata are absent.
 *
 * @param {{ readFile?: Function } | null | undefined} fileOps - File operations adapter
 * @param {{ projectKind?: string, personaKey: string }} options - Prompt context options
 * @returns {Promise<{ parsedYaml: unknown, roleOverride: string }>}
 */
export async function loadProjectKindPromptContext(fileOps, options) {
  const personaKey = options?.personaKey ?? '';
  const projectKind = options?.projectKind ?? 'default';
  let parsedYaml = null;
  let roleOverride = '';

  try {
    parsedYaml = await loadResolvedAiHelpers(fileOps);
  } catch {
    // Callers preserve their existing fallback prompt builders when YAML is unavailable.
  }

  try {
    const projectKindsYaml = await fileOps?.readFile?.(AI_PROJECT_KINDS_PATH);
    const parsedProjectKinds = yaml.load(projectKindsYaml);
    const projectKindPrompt = buildProjectKindPrompt(parsedProjectKinds, projectKind, personaKey);
    if (projectKindPrompt?.role) {
      roleOverride = projectKindPrompt.role;
    }
  } catch {
    // Optional overlay only; the base prompt remains usable without it.
  }

  return { parsedYaml, roleOverride };
}

/**
 * Prefix a prompt with the resolved project-kind role banner when one exists.
 *
 * @pure
 * @param {string} prompt - Prompt body
 * @param {string} roleOverride - Project-kind role text
 * @returns {string} Prompt with the project-kind role banner prepended
 */
export function prependProjectKindRole(prompt, roleOverride) {
  if (!prompt || !roleOverride) {
    return prompt;
  }

  return `[Project-Kind Role: ${roleOverride}]\n\n${prompt}`;
}
