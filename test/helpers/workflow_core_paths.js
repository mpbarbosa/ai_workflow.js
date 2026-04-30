/**
 * @fileoverview Shared path constants for .workflow_core submodule YAML files.
 *
 * Tests that load prompt configuration YAML from the .workflow_core git submodule
 * should import path constants from this module rather than reconstructing them
 * inline. This provides a single place to update the paths and a clear error
 * message when the submodule has not been initialised.
 *
 * Usage:
 *   import { AI_HELPERS_YAML_PATH, PROMPT_ROLES_YAML_PATH } from '../../helpers/workflow_core_paths.js';
 *
 * If the .workflow_core submodule is absent, tests will fail with an actionable
 * message: run `git submodule update --init --recursive` to populate it.
 */

import path from 'path';
import { existsSync } from 'fs';

/** Absolute path to the .workflow_core submodule root. */
export const WORKFLOW_CORE_DIR = path.join(process.cwd(), '.workflow_core');

/** Absolute path to the merged ai_helpers.yaml produced by the submodule. */
export const AI_HELPERS_YAML_PATH = path.join(WORKFLOW_CORE_DIR, 'config', 'ai_helpers.yaml');

/** Absolute path to the prompt_roles.yaml in the submodule. */
export const PROMPT_ROLES_YAML_PATH = path.join(WORKFLOW_CORE_DIR, 'config', 'prompt_roles.yaml');

// Validate at import time so tests surface a clear error message rather than
// an opaque ENOENT from deep inside a beforeAll/beforeEach hook.
if (!existsSync(WORKFLOW_CORE_DIR) || !existsSync(path.join(WORKFLOW_CORE_DIR, 'config'))) {
  throw new Error(
    `[workflow_core_paths] The .workflow_core submodule is missing or empty at:\n` +
      `  ${WORKFLOW_CORE_DIR}\n\n` +
      `Run the following command to initialise it:\n` +
      `  git submodule update --init --recursive\n`
  );
}
