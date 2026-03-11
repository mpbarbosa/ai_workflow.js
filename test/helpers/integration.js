/**
 * @fileoverview Integration test utilities
 * @module test/helpers/integration
 *
 * Shared helpers used by all integration and e2e test suites:
 * - createTempProject(fixtureName)  — copy a fixture into an isolated temp dir
 * - cleanupTempProject(dir)         — remove the temp dir
 * - createMockAiHelper()            — deterministic AI helper stub
 * - createMockConfig(overrides)     — minimal ConfigManager-compatible stub
 *
 * @version 1.0.0
 */

import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';

const FIXTURES_DIR = new URL('../fixtures', import.meta.url).pathname;

// ---------------------------------------------------------------------------
// Temp project management
// ---------------------------------------------------------------------------

/**
 * Copy a named fixture project into a fresh temp directory and optionally
 * initialise a git repository inside it so git-aware steps work correctly.
 *
 * @param {string} fixtureName - Name of directory under test/fixtures/
 * @param {{ initGit?: boolean }} [opts]
 * @returns {Promise<string>} Absolute path to the temp project directory
 */
export async function createTempProject(fixtureName, { initGit = false } = {}) {
  const src = path.join(FIXTURES_DIR, fixtureName);
  const dest = await fs.mkdtemp(path.join(os.tmpdir(), `ai_workflow_integration_`));

  await copyDir(src, dest);

  if (initGit) {
    execSync('git init && git add -A && git commit -m "initial fixture commit" --allow-empty', {
      cwd: dest,
      stdio: 'pipe',
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: 'Test',
        GIT_AUTHOR_EMAIL: 'test@test.com',
        GIT_COMMITTER_NAME: 'Test',
        GIT_COMMITTER_EMAIL: 'test@test.com',
      },
    });
  }

  return dest;
}

/**
 * Remove a temp project directory created by createTempProject.
 * Safe to call even if the directory does not exist.
 *
 * @param {string} dir - Absolute path returned by createTempProject
 * @returns {Promise<void>}
 */
export async function cleanupTempProject(dir) {
  try {
    await fs.rm(dir, { recursive: true, force: true });
  } catch {
    // already gone — that's fine
  }
}

// ---------------------------------------------------------------------------
// AI helper mock
// ---------------------------------------------------------------------------

/**
 * Create a deterministic AI helper stub. Every call to executeRequest()
 * returns a fixed response so tests never hit real AI APIs.
 *
 * @param {Object} [overrides] - Optional field overrides on the stub
 * @returns {Object} Mock AiHelper instance
 */
export function createMockAiHelper(overrides = {}) {
  return {
    executeRequest: async (prompt, _options = {}) => ({
      content: `Mock AI response for: ${String(prompt).slice(0, 40)}`,
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      model: 'mock-model',
      ...overrides.executeRequestResult,
    }),
    isAvailable: async () => true,
    getPersona: () => ({ id: 'mock', name: 'MockPersona' }),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Config stub
// ---------------------------------------------------------------------------

/**
 * Create a minimal configuration object compatible with ConfigManager output.
 *
 * @param {string} projectRoot - Project root path
 * @param {Object} [overrides] - Key overrides
 * @returns {Object} Config-compatible plain object
 */
export function createMockConfig(projectRoot, overrides = {}) {
  const workflowDir = path.join(projectRoot, '.ai_workflow');
  return {
    projectRoot,
    workflowDir,
    backlogRunDir: path.join(workflowDir, 'backlog'),
    summaryRunDir: path.join(workflowDir, 'summaries'),
    logsDir: path.join(workflowDir, 'logs'),
    metricsDir: path.join(workflowDir, 'metrics'),
    checkpointsDir: path.join(workflowDir, 'checkpoints'),
    promptsDir: path.join(workflowDir, 'prompts'),
    primaryLanguage: 'javascript',
    projectKind: 'nodejs_api',
    autoCommit: false,
    dryRun: false,
    ...overrides,
  };
}

/**
 * Ensure the .ai_workflow/ subdirectory tree exists under a project root.
 *
 * @param {string} projectRoot
 * @returns {Promise<void>}
 */
export async function ensureWorkflowDirectories(projectRoot) {
  const base = path.join(projectRoot, '.ai_workflow');
  for (const sub of [
    'backlog',
    'summaries',
    'logs',
    'metrics',
    'checkpoints',
    'prompts',
    'ml_models',
    '.incremental_cache',
  ]) {
    await fs.mkdir(path.join(base, sub), { recursive: true });
  }
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

async function copyDir(src, dest) {
  const entries = await fs.readdir(src, { withFileTypes: true });
  await fs.mkdir(dest, { recursive: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}
