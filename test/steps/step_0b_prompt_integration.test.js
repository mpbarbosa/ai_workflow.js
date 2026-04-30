/**
 * @fileoverview Integration tests for Step 0b: Bootstrap Documentation
 *
 * Focus: verify that the AI prompt sent to the Copilot SDK API is CORRECT
 * according to the configuration defined in .workflow_core/config/ai_helpers.yaml
 * and the project context assembled by Step0bBootstrapDocs.execute().
 *
 * Three layers are tested in sequence:
 *
 *  Layer 1 — Config correctness
 *    Verifies that ai_helpers.yaml contains a well-formed `technical_writer_prompt`
 *    section with all required keys (role_prefix, behavioral_guidelines, task_template).
 *
 *  Layer 2 — Prompt construction correctness
 *    Verifies that buildTechnicalWriterPrompt() produces prompts that:
 *      a) Inject all project-context placeholders when using the yaml template
 *      b) Fall back gracefully to the inline template when yaml is absent/invalid
 *      c) Always contain the missing-docs list and the expected structural elements
 *
 *  Layer 3 — Step 0b execute() integration
 *    Verifies that Step0bBootstrapDocs.execute() calls aiHelper.executeRequest()
 *    with a prompt that reflects:
 *      - Project name, description, and primary language from .workflow-config.yaml
 *      - Missing-doc list derived from the actual filesystem
 *      - persona: 'technical_writer' option
 *      - Behavioural guidelines and task-template text from ai_helpers.yaml
 *
 * @group integration
 * @group e2e
 */

import { jest } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';

import {
  Step0bBootstrapDocs,
  buildTechnicalWriterPrompt,
} from '../../src/steps/step_0b_bootstrap_docs.js';
import { resolveAllRoleRefs } from '../../src/lib/ai_prompt_builder.js';
import { AI_HELPERS_YAML_PATH, PROMPT_ROLES_YAML_PATH } from '../helpers/workflow_core_paths.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function writeFile(filePath, content) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, 'utf8');
}

/** Build a minimal silent logger stub. */
function buildLogger() {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    success: jest.fn(),
    debug: jest.fn(),
    step: jest.fn(),
  };
}

/** Build a backlog stub that records calls. */
function buildBacklog() {
  const calls = { summary: [], issues: [] };
  return {
    stub: {
      saveStepSummary: (...args) => {
        calls.summary.push(args);
        return Promise.resolve();
      },
      saveStepIssues: (...args) => {
        calls.issues.push(args);
        return Promise.resolve();
      },
    },
    calls,
  };
}

/**
 * Build a real fileOps adapter rooted at `rootDir`.
 * Delegates to the OS filesystem for reads; captures write calls.
 */
function buildRealFileOps(rootDir) {
  const written = [];
  return {
    adapter: {
      async readFile(filePath) {
        const resolved = path.isAbsolute(filePath) ? filePath : path.join(rootDir, filePath);
        return fs.readFile(resolved, 'utf8');
      },
      async writeFile(filePath, content) {
        written.push({ filePath, content });
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, content, 'utf8');
      },
      async stat(filePath) {
        return fs.stat(filePath);
      },
      async listDirectoryRecursive(dirPath, _opts = {}) {
        const entries = [];
        async function walk(dir) {
          const items = await fs.readdir(dir, { withFileTypes: true });
          for (const item of items) {
            const full = path.join(dir, item.name);
            if (item.isDirectory()) {
              await walk(full);
            } else {
              entries.push(full);
            }
          }
        }
        await walk(dirPath);
        return entries;
      },
    },
    written,
  };
}

/**
 * Build an AI helper stub that captures executeRequest calls.
 * Returns a configurable AI response.
 */
function buildAiHelperStub(responseContent = '') {
  const calls = [];
  return {
    stub: {
      async initialize() {
        return true;
      },
      async executeRequest(prompt, options = {}) {
        calls.push({ prompt, options });
        return { success: true, content: responseContent };
      },
    },
    calls,
  };
}

/** Load, parse, and resolve role refs in the real ai_helpers.yaml. */
async function loadRealAiHelpersYaml() {
  const content = await fs.readFile(AI_HELPERS_YAML_PATH, 'utf8');
  const raw = yaml.load(content);
  const rolesContent = await fs.readFile(PROMPT_ROLES_YAML_PATH, 'utf8');
  const roles = yaml.load(rolesContent);
  return { content, parsed: resolveAllRoleRefs(raw, roles) };
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('Integration: Step 0b — Prompt sent to Copilot SDK API', () => {
  let tempDir;

  beforeEach(async () => {
    tempDir = path.join(
      process.cwd(),
      '.test-e2e',
      `step-0b-prompt-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    await fs.mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  // =========================================================================
  // Layer 1 — Config correctness (ai_helpers.yaml → technical_writer_prompt)
  // =========================================================================

  describe('Layer 1: Config correctness (ai_helpers.yaml → technical_writer_prompt)', () => {
    test('ai_helpers.yaml exists and is parseable', async () => {
      const content = await fs.readFile(AI_HELPERS_YAML_PATH, 'utf8');
      expect(content.length).toBeGreaterThan(0);
      const parsed = yaml.load(content);
      expect(parsed).not.toBeNull();
      expect(typeof parsed).toBe('object');
    });

    test('technical_writer_prompt key exists in ai_helpers.yaml', async () => {
      const { parsed } = await loadRealAiHelpersYaml();
      expect(parsed).toHaveProperty('technical_writer_prompt');
    });

    test('technical_writer_prompt has role_prefix', async () => {
      const { parsed } = await loadRealAiHelpersYaml();
      const tw = parsed.technical_writer_prompt;
      expect(tw).toHaveProperty('role_prefix');
      expect(typeof tw.role_prefix).toBe('string');
      expect(tw.role_prefix.length).toBeGreaterThan(0);
    });

    test('role_prefix describes a senior technical writer', async () => {
      const { parsed } = await loadRealAiHelpersYaml();
      const rolePrefix = parsed.technical_writer_prompt.role_prefix;
      expect(rolePrefix.toLowerCase()).toContain('technical writer');
    });

    test('technical_writer_prompt has behavioral_guidelines', async () => {
      const { parsed } = await loadRealAiHelpersYaml();
      const tw = parsed.technical_writer_prompt;
      expect(tw).toHaveProperty('behavioral_guidelines');
      expect(typeof tw.behavioral_guidelines).toBe('string');
      expect(tw.behavioral_guidelines.length).toBeGreaterThan(0);
    });

    test('behavioral_guidelines contain actionable output criteria', async () => {
      const { parsed } = await loadRealAiHelpersYaml();
      const guidelines = parsed.technical_writer_prompt.behavioral_guidelines;
      expect(guidelines).toContain('actionable');
    });

    test('technical_writer_prompt has task_template', async () => {
      const { parsed } = await loadRealAiHelpersYaml();
      const tw = parsed.technical_writer_prompt;
      expect(tw).toHaveProperty('task_template');
      expect(typeof tw.task_template).toBe('string');
      expect(tw.task_template.length).toBeGreaterThan(0);
    });

    test('task_template contains {project_name} placeholder', async () => {
      const { parsed } = await loadRealAiHelpersYaml();
      expect(parsed.technical_writer_prompt.task_template).toContain('{project_name}');
    });

    test('task_template contains {project_summary} placeholder', async () => {
      const { parsed } = await loadRealAiHelpersYaml();
      expect(parsed.technical_writer_prompt.task_template).toContain('{project_summary}');
    });

    test('task_template contains {primary_language} placeholder', async () => {
      const { parsed } = await loadRealAiHelpersYaml();
      expect(parsed.technical_writer_prompt.task_template).toContain('{primary_language}');
    });

    test('task_template contains {doc_count} placeholder', async () => {
      const { parsed } = await loadRealAiHelpersYaml();
      expect(parsed.technical_writer_prompt.task_template).toContain('{doc_count}');
    });

    test('task_template contains {source_files} placeholder', async () => {
      const { parsed } = await loadRealAiHelpersYaml();
      expect(parsed.technical_writer_prompt.task_template).toContain('{source_files}');
    });

    test('task_template includes necessity evaluation guidance', async () => {
      const { parsed } = await loadRealAiHelpersYaml();
      const template = parsed.technical_writer_prompt.task_template;
      // The template should guide the AI to evaluate whether docs are truly needed
      expect(template.toLowerCase()).toMatch(/necessit|evaluat|criteria/);
    });

    test('task_template includes directory structure analysis guidance', async () => {
      const { parsed } = await loadRealAiHelpersYaml();
      const template = parsed.technical_writer_prompt.task_template;
      expect(template.toLowerCase()).toContain('directory');
    });
  });

  // =========================================================================
  // Layer 2 — Prompt construction correctness (buildTechnicalWriterPrompt)
  // =========================================================================

  describe('Layer 2: Prompt construction (buildTechnicalWriterPrompt)', () => {
    let realResolvedYaml;

    beforeAll(async () => {
      const { parsed } = await loadRealAiHelpersYaml();
      realResolvedYaml = parsed;
    });

    // ---- Yaml-template path ------------------------------------------------

    describe('With yaml resolvedAiHelpers (ai_helpers.yaml template)', () => {
      function buildContext(overrides = {}) {
        return {
          projectName: 'TestProject',
          projectDescription: 'A test project for integration testing',
          primaryLanguage: 'JavaScript',
          docCount: 2,
          sourceCount: 45,
          missingDocs: ['CHANGELOG.md', 'CONTRIBUTING.md', 'docs/API.md'],
          resolvedAiHelpers: realResolvedYaml,
          ...overrides,
        };
      }

      test('returns a non-empty string', () => {
        const prompt = buildTechnicalWriterPrompt(buildContext());
        expect(typeof prompt).toBe('string');
        expect(prompt.length).toBeGreaterThan(100);
      });

      test('injects project name into prompt', () => {
        const prompt = buildTechnicalWriterPrompt(
          buildContext({ projectName: 'UniqueProjectXYZ' })
        );
        expect(prompt).toContain('UniqueProjectXYZ');
      });

      test('injects project description into prompt', () => {
        const prompt = buildTechnicalWriterPrompt(
          buildContext({ projectDescription: 'A uniquely described project' })
        );
        expect(prompt).toContain('A uniquely described project');
      });

      test('injects primary language into prompt', () => {
        const prompt = buildTechnicalWriterPrompt(buildContext({ primaryLanguage: 'Python' }));
        expect(prompt).toContain('Python');
      });

      test('injects doc count into prompt', () => {
        const prompt = buildTechnicalWriterPrompt(buildContext({ docCount: 7 }));
        expect(prompt).toContain('7');
      });

      test('injects source file count into prompt', () => {
        const prompt = buildTechnicalWriterPrompt(buildContext({ sourceCount: 99 }));
        expect(prompt).toContain('99');
      });

      test('includes all missing docs in prompt', () => {
        const missingDocs = ['CHANGELOG.md', 'CONTRIBUTING.md', 'docs/API.md'];
        const prompt = buildTechnicalWriterPrompt(buildContext({ missingDocs }));
        for (const doc of missingDocs) {
          expect(prompt).toContain(doc);
        }
      });

      test('includes role prefix text from yaml', () => {
        const prompt = buildTechnicalWriterPrompt(buildContext());
        // role_prefix describes a technical writer
        expect(prompt.toLowerCase()).toContain('technical writer');
      });

      test('includes behavioral guidelines from yaml', () => {
        const prompt = buildTechnicalWriterPrompt(buildContext());
        // behavioral_guidelines contain Critical Behavioral Guidelines
        expect(prompt).toContain('Critical Behavioral Guidelines');
      });

      test('ends with documentation gap instruction', () => {
        const prompt = buildTechnicalWriterPrompt(buildContext());
        expect(prompt).toContain('Documentation Gaps Identified');
      });

      test('no unreplaced {placeholder} tokens remain in prompt', () => {
        const prompt = buildTechnicalWriterPrompt(buildContext());
        // After variable substitution, no {word} placeholders should remain
        const unreplaced = prompt.match(/\{[a-z_]+\}/g);
        expect(unreplaced).toBeNull();
      });

      test('handles empty missingDocs list gracefully', () => {
        const prompt = buildTechnicalWriterPrompt(buildContext({ missingDocs: [] }));
        expect(typeof prompt).toBe('string');
        expect(prompt.length).toBeGreaterThan(0);
      });

      test('prompt length is substantial (not truncated)', () => {
        const prompt = buildTechnicalWriterPrompt(buildContext());
        // The yaml template is large; the resulting prompt should be >500 chars
        expect(prompt.length).toBeGreaterThan(500);
      });
    });

    // ---- Inline-fallback path ----------------------------------------------

    describe('Without yaml resolvedAiHelpers (inline fallback template)', () => {
      function buildContext(overrides = {}) {
        return {
          projectName: 'FallbackProject',
          projectDescription: 'Testing inline fallback',
          primaryLanguage: 'TypeScript',
          docCount: 1,
          sourceCount: 20,
          missingDocs: ['README.md', 'CHANGELOG.md'],
          resolvedAiHelpers: null,
          ...overrides,
        };
      }

      test('returns a non-empty string', () => {
        const prompt = buildTechnicalWriterPrompt(buildContext());
        expect(typeof prompt).toBe('string');
        expect(prompt.length).toBeGreaterThan(100);
      });

      test('fallback prompt contains "Senior Technical Writer"', () => {
        const prompt = buildTechnicalWriterPrompt(buildContext());
        expect(prompt).toContain('Senior Technical Writer');
      });

      test('fallback prompt injects project name', () => {
        const prompt = buildTechnicalWriterPrompt(
          buildContext({ projectName: 'InlineFallbackName' })
        );
        expect(prompt).toContain('InlineFallbackName');
      });

      test('fallback prompt injects primary language', () => {
        const prompt = buildTechnicalWriterPrompt(buildContext({ primaryLanguage: 'Go' }));
        expect(prompt).toContain('Go');
      });

      test('fallback prompt lists missing docs', () => {
        const missingDocs = ['README.md', 'CHANGELOG.md'];
        const prompt = buildTechnicalWriterPrompt(buildContext({ missingDocs }));
        for (const doc of missingDocs) {
          expect(prompt).toContain(doc);
        }
      });

      test('fallback prompt contains output format instructions', () => {
        const prompt = buildTechnicalWriterPrompt(buildContext());
        expect(prompt).toContain('## [Filename]');
      });

      test('fallback prompt handles invalid yaml gracefully', () => {
        const prompt = buildTechnicalWriterPrompt(
          buildContext({ promptConfig: 'not: valid: yaml: [[[' })
        );
        // Should fall back to inline template
        expect(prompt).toContain('Senior Technical Writer');
      });

      test('fallback prompt handles yaml missing required keys', () => {
        const incompleteYaml = 'technical_writer_prompt:\n  role_prefix: "Hi"\n'; // no task_template
        const prompt = buildTechnicalWriterPrompt(buildContext({ promptConfig: incompleteYaml }));
        expect(prompt).toContain('Senior Technical Writer');
      });
    });
  });

  // =========================================================================
  // Layer 3 — Step 0b execute() integration (prompt captured from AI call)
  // =========================================================================

  describe('Layer 3: Step0bBootstrapDocs.execute() — prompt sent to AI', () => {
    /**
     * Standard project fixture with a sparse documentation set so that
     * shouldBootstrapDocs() returns true and the AI path is exercised.
     */
    async function writeMinimalProject(dir, overrides = {}) {
      // Small README so bootstrap is triggered (< 500 bytes)
      await writeFile(path.join(dir, 'README.md'), '# Hello\n');
      // A handful of source files
      for (let i = 0; i < 5; i++) {
        await writeFile(path.join(dir, `src/module${i}.js`), `// module ${i}\n`);
      }
      // .workflow-config.yaml so step can read project metadata
      const workflowConfig = {
        project: {
          name: overrides.projectName || 'IntegrationProject',
          description: overrides.projectDescription || 'Integration test project',
        },
        tech_stack: {
          primary_language: overrides.primaryLanguage || 'JavaScript',
        },
      };
      await writeFile(path.join(dir, '.workflow-config.yaml'), yaml.dump(workflowConfig));
    }

    /** Build a Step0bBootstrapDocs wired to a temp dir. */
    function buildStep(dir, aiHelperStub, extraOpts = {}) {
      const { adapter: fileOpsAdapter } = buildRealFileOps(dir);
      const { stub: backlogStub } = buildBacklog();
      const logger = buildLogger();

      return new Step0bBootstrapDocs({
        fileOps: fileOpsAdapter,
        backlog: backlogStub,
        logger,
        aiHelper: aiHelperStub,
        projectRoot: dir,
        ...extraOpts,
      });
    }

    // ---- executeRequest call contract -------------------------------------

    test('executeRequest is called exactly once when AI is available', async () => {
      await writeMinimalProject(tempDir);
      const { stub: aiStub, calls } = buildAiHelperStub('');
      const step = buildStep(tempDir, aiStub);

      await step.execute({ projectName: 'IntegrationProject' });

      expect(calls).toHaveLength(1);
    });

    test('executeRequest receives a string prompt (non-empty)', async () => {
      await writeMinimalProject(tempDir);
      const { stub: aiStub, calls } = buildAiHelperStub('');
      const step = buildStep(tempDir, aiStub);

      await step.execute({ projectName: 'IntegrationProject' });

      expect(typeof calls[0].prompt).toBe('string');
      expect(calls[0].prompt.length).toBeGreaterThan(0);
    });

    test('executeRequest receives persona: "technical_writer" option', async () => {
      await writeMinimalProject(tempDir);
      const { stub: aiStub, calls } = buildAiHelperStub('');
      const step = buildStep(tempDir, aiStub);

      await step.execute({ projectName: 'IntegrationProject' });

      expect(calls[0].options).toMatchObject({ persona: 'technical_writer' });
    });

    // ---- Prompt content: project metadata ----------------------------------

    test('prompt contains project name passed via execute() context', async () => {
      await writeMinimalProject(tempDir);
      const { stub: aiStub, calls } = buildAiHelperStub('');
      const step = buildStep(tempDir, aiStub);

      await step.execute({ projectName: 'SpecialProjectName' });

      expect(calls[0].prompt).toContain('SpecialProjectName');
    });

    test('prompt falls back to directory name when no projectName in context', async () => {
      await writeMinimalProject(tempDir);
      const { stub: aiStub, calls } = buildAiHelperStub('');
      const step = buildStep(tempDir, aiStub);

      await step.execute({}); // no projectName

      expect(calls[0].prompt).toContain(path.basename(tempDir));
    });

    test('prompt contains project description from .workflow-config.yaml', async () => {
      await writeMinimalProject(tempDir, {
        projectDescription: 'Distinctive project description for testing',
      });
      const { stub: aiStub, calls } = buildAiHelperStub('');
      const step = buildStep(tempDir, aiStub);

      await step.execute({});

      expect(calls[0].prompt).toContain('Distinctive project description for testing');
    });

    test('prompt contains primary language from .workflow-config.yaml', async () => {
      await writeMinimalProject(tempDir, { primaryLanguage: 'TypeScript' });
      const { stub: aiStub, calls } = buildAiHelperStub('');
      const step = buildStep(tempDir, aiStub);

      await step.execute({});

      expect(calls[0].prompt).toContain('TypeScript');
    });

    test('prompt contains project name from context when .workflow-config.yaml absent', async () => {
      // Write files but no .workflow-config.yaml
      await writeFile(path.join(tempDir, 'README.md'), '# Hi\n');
      await writeFile(path.join(tempDir, 'src/app.js'), '// app\n');

      const { stub: aiStub, calls } = buildAiHelperStub('');
      const step = buildStep(tempDir, aiStub);

      await step.execute({ projectName: 'ContextNameProject' });

      expect(calls[0].prompt).toContain('ContextNameProject');
    });

    // ---- Prompt content: missing docs list ---------------------------------

    test('prompt lists CHANGELOG.md when it is absent from the project', async () => {
      await writeMinimalProject(tempDir); // no CHANGELOG.md
      const { stub: aiStub, calls } = buildAiHelperStub('');
      const step = buildStep(tempDir, aiStub);

      await step.execute({});

      expect(calls[0].prompt).toContain('CHANGELOG.md');
    });

    test('prompt lists CONTRIBUTING.md when it is absent from the project', async () => {
      await writeMinimalProject(tempDir);
      const { stub: aiStub, calls } = buildAiHelperStub('');
      const step = buildStep(tempDir, aiStub);

      await step.execute({});

      expect(calls[0].prompt).toContain('CONTRIBUTING.md');
    });

    test('prompt lists README.md when the existing README is too small', async () => {
      await writeMinimalProject(tempDir); // README.md is written by writeMinimalProject
      const { stub: aiStub, calls } = buildAiHelperStub('');
      const step = buildStep(tempDir, aiStub);

      await step.execute({});

      // The fixture README is intentionally tiny, so it should be re-bootstrapped.
      const gapSection = calls[0].prompt.split('Documentation Gaps Identified')[1] || '';
      expect(gapSection).toContain('- README.md');
    });

    test('prompt does NOT list a doc that already exists on disk', async () => {
      await writeMinimalProject(tempDir);
      // Add CHANGELOG.md so it should be excluded from the missing list
      await writeFile(path.join(tempDir, 'CHANGELOG.md'), '# Changelog\n');

      const { stub: aiStub, calls } = buildAiHelperStub('');
      const step = buildStep(tempDir, aiStub);

      await step.execute({});

      const gapSection = calls[0].prompt.split('Documentation Gaps Identified')[1] || '';
      expect(gapSection).not.toContain('- CHANGELOG.md');
    });

    // ---- Prompt content: yaml template applied correctly ------------------

    test('prompt contains technical writer role text (from ai_helpers.yaml)', async () => {
      await writeMinimalProject(tempDir);
      // Copy the real ai_helpers.yaml into the fixture so the step can load it
      await writeFile(
        path.join(tempDir, '.workflow_core/config/ai_helpers.yaml'),
        await fs.readFile(AI_HELPERS_YAML_PATH, 'utf8')
      );
      const { stub: aiStub, calls } = buildAiHelperStub('');
      const step = buildStep(tempDir, aiStub);

      await step.execute({});

      expect(calls[0].prompt.toLowerCase()).toContain('technical writer');
    });

    test('prompt contains behavioral guidelines (from ai_helpers.yaml)', async () => {
      await writeMinimalProject(tempDir);
      await writeFile(
        path.join(tempDir, '.workflow_core/config/ai_helpers.yaml'),
        await fs.readFile(AI_HELPERS_YAML_PATH, 'utf8')
      );
      const { stub: aiStub, calls } = buildAiHelperStub('');
      const step = buildStep(tempDir, aiStub);

      await step.execute({});

      expect(calls[0].prompt).toContain('Critical Behavioral Guidelines');
    });

    test('prompt contains necessity evaluation framework (from ai_helpers.yaml)', async () => {
      await writeMinimalProject(tempDir);
      await writeFile(
        path.join(tempDir, '.workflow_core/config/ai_helpers.yaml'),
        await fs.readFile(AI_HELPERS_YAML_PATH, 'utf8')
      );
      const { stub: aiStub, calls } = buildAiHelperStub('');
      const step = buildStep(tempDir, aiStub);

      await step.execute({});

      // task_template has STEP 1: NECESSITY EVALUATION
      expect(calls[0].prompt.toUpperCase()).toMatch(/NECESSIT|EVALUAT/);
    });

    test('prompt contains directory structure analysis guidance (from ai_helpers.yaml)', async () => {
      await writeMinimalProject(tempDir);
      await writeFile(
        path.join(tempDir, '.workflow_core/config/ai_helpers.yaml'),
        await fs.readFile(AI_HELPERS_YAML_PATH, 'utf8')
      );
      const { stub: aiStub, calls } = buildAiHelperStub('');
      const step = buildStep(tempDir, aiStub);

      await step.execute({});

      expect(calls[0].prompt.toUpperCase()).toMatch(/DIRECTORY/);
    });

    test('prompt has no unreplaced {placeholder} tokens when yaml template is used', async () => {
      await writeMinimalProject(tempDir);
      await writeFile(
        path.join(tempDir, '.workflow_core/config/ai_helpers.yaml'),
        await fs.readFile(AI_HELPERS_YAML_PATH, 'utf8')
      );
      const { stub: aiStub, calls } = buildAiHelperStub('');
      const step = buildStep(tempDir, aiStub);

      await step.execute({});

      const unreplaced = calls[0].prompt.match(/\{[a-z_]+\}/g);
      expect(unreplaced).toBeNull();
    });

    // ---- Fallback when ai_helpers.yaml is not present ---------------------

    test('prompt still contains role description when ai_helpers.yaml is absent', async () => {
      await writeMinimalProject(tempDir);
      // Do NOT copy ai_helpers.yaml — step falls back to inline template
      const { stub: aiStub, calls } = buildAiHelperStub('');
      const step = buildStep(tempDir, aiStub);

      await step.execute({});

      expect(calls[0].prompt.toLowerCase()).toContain('technical writer');
    });

    test('inline fallback prompt still contains missing docs', async () => {
      await writeMinimalProject(tempDir);
      const { stub: aiStub, calls } = buildAiHelperStub('');
      const step = buildStep(tempDir, aiStub);

      await step.execute({});

      // At minimum CHANGELOG.md and CONTRIBUTING.md are missing
      expect(calls[0].prompt).toContain('CHANGELOG.md');
    });

    // ---- executeRequest NOT called in skip/dry-run scenarios --------------

    test('executeRequest is NOT called when project has sufficient docs', async () => {
      // Write enough docs to exceed sufficientDocsCount (5)
      const docFiles = [
        'README.md',
        'CHANGELOG.md',
        'CONTRIBUTING.md',
        'docs/API.md',
        'docs/GUIDE.md',
      ];
      for (const f of docFiles) {
        await writeFile(path.join(tempDir, f), `# ${f}\n`.repeat(50));
      }
      // Source files too
      await writeFile(path.join(tempDir, 'src/index.js'), '// index\n');

      const { stub: aiStub, calls } = buildAiHelperStub('');
      const { adapter: fileOpsAdapter } = buildRealFileOps(tempDir);
      const { stub: backlogStub } = buildBacklog();
      const step = new Step0bBootstrapDocs({
        fileOps: fileOpsAdapter,
        backlog: backlogStub,
        logger: buildLogger(),
        aiHelper: aiStub,
        projectRoot: tempDir,
      });

      const result = await step.execute({});

      expect(result.skipped).toBe(true);
      expect(calls).toHaveLength(0);
    });

    test('executeRequest is NOT called in dry-run mode', async () => {
      await writeMinimalProject(tempDir);
      const { stub: aiStub, calls } = buildAiHelperStub('');
      const step = buildStep(tempDir, aiStub, { dryRun: true });

      const result = await step.execute({});

      expect(result.dryRun).toBe(true);
      expect(calls).toHaveLength(0);
    });

    // ---- Roundtrip: AI response parsed and files written ------------------

    test('generated files are written when AI returns valid doc response', async () => {
      await writeMinimalProject(tempDir);

      const aiResponse = [
        '## CHANGELOG.md',
        '### Priority: Important',
        '### Content:',
        '```markdown',
        '# Changelog',
        '',
        'All notable changes will be documented here.',
        '```',
        '### Reasoning:',
        'Every project needs a changelog.',
      ].join('\n');

      const { stub: aiStub } = buildAiHelperStub(aiResponse);
      const { adapter: fileOpsAdapter, written } = buildRealFileOps(tempDir);
      const { stub: backlogStub } = buildBacklog();
      const step = new Step0bBootstrapDocs({
        fileOps: fileOpsAdapter,
        backlog: backlogStub,
        logger: buildLogger(),
        aiHelper: aiStub,
        projectRoot: tempDir,
      });

      const result = await step.execute({});

      expect(result.success).toBe(true);
      expect(result.generated).toContain('CHANGELOG.md');
      const writtenPaths = written.map((w) => path.basename(w.filePath));
      expect(writtenPaths).toContain('CHANGELOG.md');
    });

    test('generated file content matches the AI response content block', async () => {
      await writeMinimalProject(tempDir);

      const expectedContent = '# Changelog\n\nAll notable changes here.';
      const aiResponse = [
        '## CHANGELOG.md',
        '### Priority: Important',
        '### Content:',
        '```markdown',
        expectedContent,
        '```',
      ].join('\n');

      const { stub: aiStub } = buildAiHelperStub(aiResponse);
      const { adapter: fileOpsAdapter } = buildRealFileOps(tempDir);
      const { stub: backlogStub } = buildBacklog();
      const step = new Step0bBootstrapDocs({
        fileOps: fileOpsAdapter,
        backlog: backlogStub,
        logger: buildLogger(),
        aiHelper: aiStub,
        projectRoot: tempDir,
      });

      await step.execute({});

      const written = await fs.readFile(path.join(tempDir, 'CHANGELOG.md'), 'utf8');
      expect(written.trim()).toBe(expectedContent);
    });
  });
});
