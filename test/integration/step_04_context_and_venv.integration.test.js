/**
 * @fileoverview Integration tests for Step 4: venv exclusion and tech stack context
 *
 * Regression tests validating three bugs fixed during guia_turistico
 * workflow_20260302_203120 log validation (step_04):
 *
 *  Bug 1 — venv/ config files included in analysis.
 *    EXCLUDE_DIRS lacked 'venv', '.venv', and 'env', so Python site-packages
 *    JSON/YAML files were sent to the AI, inflating the file list and causing the
 *    AI quality threshold to trip (3/15 real-file mentions = 20% < 30% floor).
 *
 *  Bug 2 — Project Type field always empty in the AI prompt.
 *    Code used detection.primaryLanguage (camelCase) instead of the snake_case key
 *    detection.primary_language returned by TechStackDetector.detectTechStack().
 *
 *  Bug 3 — Tech Stack rendered as "[object Object], [object Object], [object Object]".
 *    frameworks is Array<{name, type, version}>, not string[]. Without .map(f => f.name)
 *    the objects were coerced by .join(', ') into "[object Object]".
 *
 * @group integration
 * @group regression
 */

import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { Step4ConfigAnalyzer, EXCLUDE_DIRS } from '../../src/steps/step_04_config_validation.js';
import { FileOperations } from '../../src/lib/file_operations.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function writeFile(dir, relPath, content = '') {
  const full = path.join(dir, relPath);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, content, 'utf8');
}

function buildRealFileOps() {
  return new FileOperations();
}

/** gitOps stub that throws so discoverConfigFiles falls through to glob scan */
const throwingGitOps = {
  getModifiedFiles: () => Promise.reject(new Error('not a git repo')),
};

/** gitOps stub that returns a provided list of "modified" files */
function gitOpsReturning(files) {
  return { getModifiedFiles: () => Promise.resolve(files) };
}

/** aiCache stub that bypasses caching entirely (always calls factory) */
const passthroughAiCache = {
  init: () => Promise.resolve(),
  withCache: (_prompt, _key, factory) => factory(),
  withFileChangeGuard: (_stepId, _fileContents, factory) => factory(),
};

/** backlog stub */
function buildBacklogStub() {
  return { saveStepSummary: () => Promise.resolve() };
}

/**
 * Build a capturing aiHelper that:
 *  - returns true from initialize() so the AI code path executes
 *  - records every prompt passed to executeRequest()
 *  - returns a minimal valid response that keeps all quality checks happy
 */
function buildCapturingAiHelper() {
  const calls = [];
  return {
    calls,
    initialize: () => Promise.resolve(true),
    executeRequest: (prompt, opts) => {
      calls.push({ prompt, opts });
      // Return response that mentions known files to satisfy MIN_FILE_MENTION_RATIO
      return Promise.resolve({ content: 'package.json analyzed. tsconfig.json validated.' });
    },
  };
}

/** techStack stub returning structured (correct snake_case) data */
function buildTechStackStub({ primaryLanguage, frameworks = [] }) {
  return {
    detectTechStack: () =>
      Promise.resolve({
        primary_language: primaryLanguage,
        frameworks,
        testing: [],
        linters: [],
      }),
  };
}

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

describe('Integration: Step4ConfigAnalyzer – venv exclusion and tech stack context', () => {
  let tempDir;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ai_wf_step04_int_'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  // =========================================================================
  // EXCLUDE_DIRS: constant-level sanity
  // =========================================================================

  describe('EXCLUDE_DIRS constant', () => {
    test('includes venv, .venv, and env', () => {
      expect(EXCLUDE_DIRS).toContain('venv');
      expect(EXCLUDE_DIRS).toContain('.venv');
      expect(EXCLUDE_DIRS).toContain('env');
    });

    test('still excludes the standard dirs', () => {
      expect(EXCLUDE_DIRS).toContain('node_modules');
      expect(EXCLUDE_DIRS).toContain('.git');
    });
  });

  // =========================================================================
  // Bug 1 – venv exclusion via glob fallback
  // =========================================================================

  describe('Bug 1 fix: discoverConfigFiles excludes venv via glob fallback', () => {
    test('venv/ JSON files are not included when git is unavailable (glob fallback)', async () => {
      // Real project config files
      await writeFile(tempDir, 'package.json', JSON.stringify({ name: 'test', version: '1.0.0' }));
      await writeFile(tempDir, 'tsconfig.json', JSON.stringify({ compilerOptions: {} }));

      // Simulated Python virtualenv package config files (should be excluded)
      await writeFile(
        tempDir,
        'venv/lib/python3.13/site-packages/setuptools/config/distutils.schema.json',
        JSON.stringify({ $schema: 'http://json-schema.org/draft-07/schema' })
      );
      await writeFile(
        tempDir,
        'venv/lib/python3.13/site-packages/pip/_vendor/certifi/cacert.pem',
        '# certificate'
      );

      const analyzer = new Step4ConfigAnalyzer({
        fileOps: buildRealFileOps(),
        gitOps: throwingGitOps, // forces glob fallback
        aiHelper: { initialize: () => Promise.resolve(false) },
        aiCache: passthroughAiCache,
        backlog: buildBacklogStub(),
        techStack: buildTechStackStub({ primaryLanguage: 'javascript' }),
      });

      const configFiles = await analyzer.discoverConfigFiles(tempDir);
      const relPaths = configFiles.map((f) => path.relative(tempDir, f));

      // Real project files must be found
      expect(relPaths).toContain('package.json');
      expect(relPaths).toContain('tsconfig.json');

      // venv files must not appear
      expect(relPaths.some((p) => p.startsWith('venv/'))).toBe(false);
    });

    test('.venv/ YAML files are not included when git is unavailable (glob fallback)', async () => {
      await writeFile(tempDir, 'package.json', JSON.stringify({ name: 'test' }));
      await writeFile(
        tempDir,
        '.venv/lib/python3.11/site-packages/black/data/py_project_schema.yaml',
        'type: object'
      );

      const analyzer = new Step4ConfigAnalyzer({
        fileOps: buildRealFileOps(),
        gitOps: throwingGitOps,
        aiHelper: { initialize: () => Promise.resolve(false) },
        aiCache: passthroughAiCache,
        backlog: buildBacklogStub(),
        techStack: buildTechStackStub({ primaryLanguage: 'javascript' }),
      });

      const configFiles = await analyzer.discoverConfigFiles(tempDir);
      const relPaths = configFiles.map((f) => path.relative(tempDir, f));

      expect(relPaths.some((p) => p.startsWith('.venv/'))).toBe(false);
      expect(relPaths).toContain('package.json');
    });
  });

  // =========================================================================
  // Bug 1 – venv exclusion via git-modified file list
  // =========================================================================

  describe('Bug 1 fix: discoverConfigFiles excludes venv via git-modified list', () => {
    test('venv/ path in git modified list is filtered out', async () => {
      // Provide a package.json so it is a "real" project
      await writeFile(tempDir, 'package.json', '{}');

      // Git reports a mix: real file + venv file
      const gitModified = [
        path.join(tempDir, 'package.json'),
        path.join(
          tempDir,
          'venv/lib/python3.13/site-packages/setuptools/config/distutils.schema.json'
        ),
      ];

      const analyzer = new Step4ConfigAnalyzer({
        fileOps: buildRealFileOps(),
        gitOps: gitOpsReturning(gitModified),
        aiHelper: { initialize: () => Promise.resolve(false) },
        aiCache: passthroughAiCache,
        backlog: buildBacklogStub(),
        techStack: buildTechStackStub({ primaryLanguage: 'javascript' }),
      });

      const configFiles = await analyzer.discoverConfigFiles(tempDir);
      const relPaths = configFiles.map((f) => path.relative(tempDir, f));

      expect(relPaths.some((p) => p.startsWith('venv/'))).toBe(false);
      expect(relPaths).toContain('package.json');
    });

    test('.venv/ path in git modified list is filtered out', async () => {
      await writeFile(tempDir, 'package.json', '{}');

      const gitModified = [
        path.join(tempDir, 'package.json'),
        '.venv/lib/python3.11/site-packages/black/data/schema.yaml',
      ];

      const analyzer = new Step4ConfigAnalyzer({
        fileOps: buildRealFileOps(),
        gitOps: gitOpsReturning(gitModified),
        aiHelper: { initialize: () => Promise.resolve(false) },
        aiCache: passthroughAiCache,
        backlog: buildBacklogStub(),
        techStack: buildTechStackStub({ primaryLanguage: 'javascript' }),
      });

      const configFiles = await analyzer.discoverConfigFiles(tempDir);
      const relPaths = configFiles.map((f) => path.relative(tempDir, f));

      expect(relPaths.some((p) => p.startsWith('.venv/'))).toBe(false);
    });
  });

  // =========================================================================
  // Bug 2 – Project Type (primary_language) always empty in prompt
  // =========================================================================

  describe('Bug 2 fix: execute() includes primary_language in AI prompt', () => {
    test('prompt contains project_kind value from detection.primary_language', async () => {
      await writeFile(tempDir, 'package.json', JSON.stringify({ name: 'myapp', version: '1.0.0' }));
      await writeFile(tempDir, 'tsconfig.json', JSON.stringify({ compilerOptions: {} }));

      const aiHelper = buildCapturingAiHelper();

      const analyzer = new Step4ConfigAnalyzer({
        fileOps: buildRealFileOps(),
        gitOps: throwingGitOps,
        aiHelper,
        aiCache: passthroughAiCache,
        backlog: buildBacklogStub(),
        techStack: buildTechStackStub({ primaryLanguage: 'javascript', frameworks: [] }),
      });

      await analyzer.execute(tempDir);

      // At least one AI call must have been made
      expect(aiHelper.calls.length).toBeGreaterThanOrEqual(1);
      const firstPrompt = aiHelper.calls[0].prompt;

      // The prompt must NOT have an empty Project Type field (Bug 2 regression)
      expect(firstPrompt).not.toMatch(/Project Type:\s*[\r\n]/);

      // Must contain "javascript" as the primary language (snake_case key fix)
      expect(firstPrompt).toContain('javascript');
    });

    test('with python primary_language, prompt contains "python" not empty', async () => {
      // Use .yaml files since step_04 globs only *.json, *.yaml, *.yml, .env*, Dockerfile
      await writeFile(tempDir, 'setup.yaml', 'name: myproject\nversion: 1.0.0\n');
      await writeFile(tempDir, 'mypy.yml', 'mypy:\n  strict: true\n');

      const aiHelper = buildCapturingAiHelper();

      const analyzer = new Step4ConfigAnalyzer({
        fileOps: buildRealFileOps(),
        gitOps: throwingGitOps,
        aiHelper,
        aiCache: passthroughAiCache,
        backlog: buildBacklogStub(),
        techStack: buildTechStackStub({ primaryLanguage: 'python', frameworks: [] }),
      });

      await analyzer.execute(tempDir);

      expect(aiHelper.calls.length).toBeGreaterThanOrEqual(1);
      const firstPrompt = aiHelper.calls[0].prompt;
      expect(firstPrompt).toContain('python');
      expect(firstPrompt).not.toMatch(/Project Type:\s*[\r\n]/);
    });
  });

  // =========================================================================
  // Bug 3 – Framework objects rendered as "[object Object]"
  // =========================================================================

  describe('Bug 3 fix: execute() serializes framework objects to names in AI prompt', () => {
    test('frameworks appear as name strings, not [object Object]', async () => {
      await writeFile(
        tempDir,
        'package.json',
        JSON.stringify({ name: 'spa', dependencies: { react: '^18' } })
      );
      await writeFile(tempDir, 'tsconfig.json', JSON.stringify({}));

      const aiHelper = buildCapturingAiHelper();

      const frameworks = [
        { name: 'React', type: 'frontend', version: '18' },
        { name: 'TypeScript', type: 'language', version: '5' },
      ];

      const analyzer = new Step4ConfigAnalyzer({
        fileOps: buildRealFileOps(),
        gitOps: throwingGitOps,
        aiHelper,
        aiCache: passthroughAiCache,
        backlog: buildBacklogStub(),
        techStack: buildTechStackStub({ primaryLanguage: 'javascript', frameworks }),
      });

      await analyzer.execute(tempDir);

      expect(aiHelper.calls.length).toBeGreaterThanOrEqual(1);
      const firstPrompt = aiHelper.calls[0].prompt;

      // Framework names must appear as plain strings
      expect(firstPrompt).toContain('React');
      expect(firstPrompt).toContain('TypeScript');

      // "[object Object]" must NOT appear anywhere in the prompt (Bug 3 regression)
      expect(firstPrompt).not.toContain('[object Object]');
    });

    test('single framework object is serialized correctly', async () => {
      await writeFile(tempDir, 'package.json', JSON.stringify({ name: 'api' }));

      const aiHelper = buildCapturingAiHelper();

      const analyzer = new Step4ConfigAnalyzer({
        fileOps: buildRealFileOps(),
        gitOps: throwingGitOps,
        aiHelper,
        aiCache: passthroughAiCache,
        backlog: buildBacklogStub(),
        techStack: buildTechStackStub({
          primaryLanguage: 'javascript',
          frameworks: [{ name: 'Express', type: 'backend', version: '4' }],
        }),
      });

      await analyzer.execute(tempDir);

      expect(aiHelper.calls.length).toBeGreaterThanOrEqual(1);
      const firstPrompt = aiHelper.calls[0].prompt;
      expect(firstPrompt).toContain('Express');
      expect(firstPrompt).not.toContain('[object Object]');
    });

    test('empty frameworks array produces no [object Object] in prompt', async () => {
      await writeFile(tempDir, 'package.json', JSON.stringify({ name: 'minimal' }));

      const aiHelper = buildCapturingAiHelper();

      const analyzer = new Step4ConfigAnalyzer({
        fileOps: buildRealFileOps(),
        gitOps: throwingGitOps,
        aiHelper,
        aiCache: passthroughAiCache,
        backlog: buildBacklogStub(),
        techStack: buildTechStackStub({ primaryLanguage: 'javascript', frameworks: [] }),
      });

      await analyzer.execute(tempDir);

      const allPrompts = aiHelper.calls.map((c) => c.prompt).join('\n');
      expect(allPrompts).not.toContain('[object Object]');
    });
  });

  // =========================================================================
  // End-to-end: combined scenario mimicking guia_turistico run
  // =========================================================================

  describe('End-to-end execute(): combined venv + tech stack regression scenario', () => {
    test('guia_turistico-style run: venv excluded + prompt has correct project kind + no [object Object]', async () => {
      // Simulate a location_based_service project with a Python virtualenv present
      await writeFile(
        tempDir,
        'package.json',
        JSON.stringify({ name: 'guia-turistico', version: '1.0.0' })
      );
      await writeFile(tempDir, '.env.example', 'DATABASE_URL=postgres://localhost:5432/guia\n');
      await writeFile(
        tempDir,
        'docker-compose.yml',
        'version: "3"\nservices:\n  db:\n    image: postgres\n'
      );

      // Python venv files (should be excluded)
      await writeFile(
        tempDir,
        'venv/lib/python3.13/site-packages/setuptools/config/distutils.schema.json',
        JSON.stringify({ $schema: 'http://json-schema.org/draft-07/schema' })
      );
      await writeFile(
        tempDir,
        'venv/lib/python3.13/site-packages/pip/_vendor/pkg_resources/__init__.py',
        '# stub'
      );

      const aiHelper = buildCapturingAiHelper();

      const analyzer = new Step4ConfigAnalyzer({
        fileOps: buildRealFileOps(),
        gitOps: throwingGitOps,
        aiHelper,
        aiCache: passthroughAiCache,
        backlog: buildBacklogStub(),
        techStack: buildTechStackStub({
          primaryLanguage: 'javascript',
          frameworks: [
            { name: 'Node.js', type: 'runtime', version: '20' },
            { name: 'Express', type: 'backend', version: '4' },
          ],
        }),
      });

      const result = await analyzer.execute(tempDir);

      // 1. Only real config files should be counted (3: package.json, .env.example, docker-compose.yml)
      //    venv distutils.schema.json should NOT be included
      expect(result.filesChecked).toBeLessThanOrEqual(5); // graceful bound
      const configFiles = await analyzer.discoverConfigFiles(tempDir);
      expect(configFiles.some((f) => f.includes('venv'))).toBe(false);

      // 2. AI was called with a prompt containing project kind
      expect(aiHelper.calls.length).toBeGreaterThanOrEqual(1);
      const prompt = aiHelper.calls[0].prompt;

      // Bug 2 regression: prompt must not have empty project type
      expect(prompt).not.toMatch(/Project Type:\s*[\r\n]/);
      expect(prompt).toContain('javascript');

      // Bug 3 regression: no raw object serialization in prompt
      expect(prompt).not.toContain('[object Object]');

      // Frameworks by name appear
      expect(prompt).toContain('Express');
    });
  });
});
