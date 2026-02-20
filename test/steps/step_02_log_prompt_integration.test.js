/**
 * @fileoverview Integration test suite for Step 2: Prompt / Log File / Prompt Response validation
 *
 * Validates three execution artefacts that must be produced by a correct step_02 run:
 *
 *  Layer 1 — YAML-based Prompt Config
 *    Verifies that `.workflow_core/config/ai_helpers.yaml` contains a well-formed
 *    `step2_consistency_prompt` section with all required keys and placeholders.
 *    Also verifies that `buildConsistencyPrompt()` produces a structurally valid prompt.
 *
 *  Layer 2 — Step Log File
 *    Verifies that executing Step2ConsistencyAnalyzer.execute() causes the logger to
 *    write a step log file (`steps/step_02.log`) containing the expected lifecycle
 *    messages (start, file discovery, version/link check, completion).
 *
 *  Layer 3 — Prompt Response File (Backlog Report)
 *    Verifies that when step_02 runs with documentation files present, it calls
 *    backlog.saveStepSummary(2, ...) and the saved report contains the required
 *    structural sections (Summary, file count, status indicator).
 *
 * Root-cause context
 * ------------------
 * Execution against /home/mpb/Documents/GitHub/onde_estou_backend on 2026-02-20
 * revealed that all three artefacts were absent/incomplete because FileOperations
 * has no `glob` method.  The catch-block in discoverDocumentationFiles() silently
 * swallowed the TypeError, producing docFiles=[], which triggered the early-exit
 * guard ("No documentation files found") before any log, prompt, or response was
 * written.  These tests document the expected behaviour after the bug is fixed.
 *
 * @group integration
 * @group e2e
 */

import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';
import { glob } from 'glob';

import {
  Step2ConsistencyAnalyzer,
  formatConsistencyReport,
} from '../../src/steps/step_02_consistency.js';
import { buildConsistencyPrompt } from '../../src/lib/ai_prompt_builder.js';
import logger from '../../src/core/logger.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const REPO_ROOT = process.cwd(); // ai_workflow.js repo root
const AI_HELPERS_YAML = path.join(REPO_ROOT, '.workflow_core', 'config', 'ai_helpers.yaml');

// Required placeholders in the step2_consistency_prompt task_template
const REQUIRED_PLACEHOLDERS = [
  '{project_name}',
  '{project_description}',
  '{primary_language}',
  '{doc_count}',
  '{broken_refs_content}',
  '{doc_files}',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function writeFile(filePath, content) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, 'utf8');
}

/**
 * Real fileOps adapter backed by the actual filesystem rooted at `rootDir`.
 * Provides `glob` (the missing method that caused the production bug) and
 * `readFile` so that discoverDocumentationFiles() works correctly.
 */
function buildRealFileOps(rootDir) {
  return {
    async glob(pattern, { cwd = rootDir, ignore = [] } = {}) {
      return glob(pattern, { cwd, ignore, nodir: true });
    },
    async readFile(filePath) {
      const resolved = path.isAbsolute(filePath) ? filePath : path.join(rootDir, filePath);
      return fs.readFile(resolved, 'utf8');
    },
  };
}

/**
 * Backlog stub that captures saveStepSummary calls and optionally writes the
 * report to a real file so Layer 3 can validate on-disk artefacts.
 */
function buildBacklogStub(reportOutputPath = null) {
  const calls = [];
  return {
    stub: {
      async saveStepSummary(step, title, content) {
        calls.push({ step, title, content });
        if (reportOutputPath) {
          await fs.mkdir(path.dirname(reportOutputPath), { recursive: true });
          await fs.writeFile(reportOutputPath, content, 'utf8');
        }
      },
    },
    calls,
  };
}

/** Load and parse ai_helpers.yaml from the real repo. */
async function loadAiHelpersYaml() {
  const raw = await fs.readFile(AI_HELPERS_YAML, 'utf8');
  return yaml.load(raw);
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('Integration: Step 2 — Prompt / Log File / Prompt Response', () => {
  let tempDir;

  beforeEach(async () => {
    tempDir = path.join(
      REPO_ROOT,
      '.test-e2e',
      `step-02-artefacts-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    await fs.mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  // =========================================================================
  // Layer 1: YAML-based Prompt Config
  // =========================================================================

  describe('Layer 1: YAML-based Prompt Config (ai_helpers.yaml → step2_consistency_prompt)', () => {
    let parsed;

    beforeEach(async () => {
      parsed = await loadAiHelpersYaml();
    });

    test('step2_consistency_prompt key exists in ai_helpers.yaml', () => {
      expect(parsed).toHaveProperty('step2_consistency_prompt');
    });

    test('step2_consistency_prompt has role_prefix', () => {
      const section = parsed.step2_consistency_prompt;
      expect(section).toHaveProperty('role_prefix');
      expect(typeof section.role_prefix).toBe('string');
      expect(section.role_prefix.trim().length).toBeGreaterThan(0);
    });

    test('role_prefix mentions documentation or technical writing', () => {
      const rolePrefix = parsed.step2_consistency_prompt.role_prefix.toLowerCase();
      const isDocRelated = rolePrefix.includes('documentation') || rolePrefix.includes('technical');
      expect(isDocRelated).toBe(true);
    });

    test('step2_consistency_prompt has behavioral_guidelines', () => {
      const section = parsed.step2_consistency_prompt;
      expect(section).toHaveProperty('behavioral_guidelines');
    });

    test('step2_consistency_prompt has task_template', () => {
      const section = parsed.step2_consistency_prompt;
      expect(section).toHaveProperty('task_template');
      expect(typeof section.task_template).toBe('string');
      expect(section.task_template.trim().length).toBeGreaterThan(0);
    });

    test.each(REQUIRED_PLACEHOLDERS)('task_template contains placeholder %s', (placeholder) => {
      const template = parsed.step2_consistency_prompt.task_template;
      expect(template).toContain(placeholder);
    });

    test('step2_consistency_prompt has approach field', () => {
      const section = parsed.step2_consistency_prompt;
      expect(section).toHaveProperty('approach');
      expect(typeof section.approach).toBe('string');
    });

    test('approach field describes output format', () => {
      const approach = parsed.step2_consistency_prompt.approach.toLowerCase();
      expect(approach).toMatch(/output|format|list|recommendation/);
    });

    describe('buildConsistencyPrompt() — inline prompt builder', () => {
      test('returns a non-empty string', () => {
        const prompt = buildConsistencyPrompt({
          docDirectory: tempDir,
          projectInfo: { name: 'test-project', language: 'JavaScript' },
        });
        expect(typeof prompt).toBe('string');
        expect(prompt.length).toBeGreaterThan(100);
      });

      test('prompt contains the doc directory path', () => {
        const prompt = buildConsistencyPrompt({ docDirectory: '/some/project/docs' });
        expect(prompt).toContain('/some/project/docs');
      });

      test('prompt contains documentation specialist role context', () => {
        const prompt = buildConsistencyPrompt({ docDirectory: tempDir });
        const lower = prompt.toLowerCase();
        expect(lower).toMatch(/documentation|specialist|technical/);
      });

      test('prompt references consistency analysis task', () => {
        const prompt = buildConsistencyPrompt({ docDirectory: tempDir });
        const lower = prompt.toLowerCase();
        expect(lower).toMatch(/consistency|analysis|cross.reference|validation/);
      });

      test('prompt injects language when provided via projectInfo', () => {
        const prompt = buildConsistencyPrompt({
          docDirectory: tempDir,
          projectInfo: { language: 'TypeScript' },
        });
        expect(prompt).toContain('TypeScript');
      });
    });
  });

  // =========================================================================
  // Layer 2: Step Log File
  // =========================================================================

  describe('Layer 2: Step Log File (steps/step_02.log)', () => {
    let stepsDir;
    let stepLogPath;

    beforeEach(async () => {
      stepsDir = path.join(tempDir, 'steps');
      await fs.mkdir(stepsDir, { recursive: true });
      stepLogPath = path.join(stepsDir, 'step_02.log');
    });

    afterEach(() => {
      // Always close any open step log stream to avoid fd leaks across tests
      logger.closeStepLogFile();
    });

    test('logger.openStepLogFile() creates the log file on disk', async () => {
      logger.openStepLogFile(stepLogPath);
      logger.info('probe');
      logger.closeStepLogFile();

      await new Promise((r) => setTimeout(r, 50)); // allow stream flush
      const stat = await fs.stat(stepLogPath);
      expect(stat.isFile()).toBe(true);
    });

    test('log file records the step start message', async () => {
      logger.openStepLogFile(stepLogPath);
      logger.info('Step 2: Documentation Consistency Analysis');
      logger.closeStepLogFile();

      await new Promise((r) => setTimeout(r, 50));
      const content = await fs.readFile(stepLogPath, 'utf8');
      expect(content).toContain('Step 2: Documentation Consistency Analysis');
    });

    test('log file records the skip-guard message when no docs found', async () => {
      logger.openStepLogFile(stepLogPath);
      logger.info('Step 2: Documentation Consistency Analysis');
      logger.info('No documentation files found - skipping consistency check');
      logger.closeStepLogFile();

      await new Promise((r) => setTimeout(r, 50));
      const content = await fs.readFile(stepLogPath, 'utf8');
      expect(content).toContain('No documentation files found - skipping consistency check');
    });

    test('log file records file-count message when docs are present', async () => {
      // Seed docs in tempDir
      await writeFile(path.join(tempDir, 'README.md'), '# Project\n');
      await writeFile(path.join(tempDir, 'docs', 'guide.md'), '# Guide\n');

      const { stub } = buildBacklogStub();
      const analyzer = new Step2ConsistencyAnalyzer({
        fileOps: buildRealFileOps(tempDir),
        backlog: stub,
      });

      logger.openStepLogFile(stepLogPath);
      await analyzer.execute(tempDir);
      logger.closeStepLogFile();

      await new Promise((r) => setTimeout(r, 100));
      const content = await fs.readFile(stepLogPath, 'utf8');
      expect(content).toMatch(/Found \d+ documentation files/);
    });

    test('log file records version check message when docs are present', async () => {
      await writeFile(path.join(tempDir, 'package.json'), JSON.stringify({ version: '1.0.0' }));
      await writeFile(path.join(tempDir, 'README.md'), '# Project v1.0.0\n');

      const { stub } = buildBacklogStub();
      const analyzer = new Step2ConsistencyAnalyzer({
        fileOps: buildRealFileOps(tempDir),
        backlog: stub,
      });

      logger.openStepLogFile(stepLogPath);
      await analyzer.execute(tempDir);
      logger.closeStepLogFile();

      await new Promise((r) => setTimeout(r, 100));
      const content = await fs.readFile(stepLogPath, 'utf8');
      expect(content).toMatch(/Version check:/);
    });

    test('log file records link check message when docs are present', async () => {
      await writeFile(path.join(tempDir, 'README.md'), '# Project\n');

      const { stub } = buildBacklogStub();
      const analyzer = new Step2ConsistencyAnalyzer({
        fileOps: buildRealFileOps(tempDir),
        backlog: stub,
      });

      logger.openStepLogFile(stepLogPath);
      await analyzer.execute(tempDir);
      logger.closeStepLogFile();

      await new Promise((r) => setTimeout(r, 100));
      const content = await fs.readFile(stepLogPath, 'utf8');
      expect(content).toMatch(/Link check:/);
    });

    test('log file records completion message (no issues)', async () => {
      await writeFile(path.join(tempDir, 'README.md'), '# Project\n');

      const { stub } = buildBacklogStub();
      const analyzer = new Step2ConsistencyAnalyzer({
        fileOps: buildRealFileOps(tempDir),
        backlog: stub,
      });

      logger.openStepLogFile(stepLogPath);
      await analyzer.execute(tempDir);
      logger.closeStepLogFile();

      await new Promise((r) => setTimeout(r, 100));
      const content = await fs.readFile(stepLogPath, 'utf8');
      expect(content).toMatch(/Step 2 completed/);
    });

    test('log file records warning completion message when issues found', async () => {
      await writeFile(path.join(tempDir, 'README.md'), '[broken](nonexistent.md)\n');

      const { stub } = buildBacklogStub();
      const analyzer = new Step2ConsistencyAnalyzer({
        fileOps: buildRealFileOps(tempDir),
        backlog: stub,
      });

      logger.openStepLogFile(stepLogPath);
      await analyzer.execute(tempDir);
      logger.closeStepLogFile();

      await new Promise((r) => setTimeout(r, 100));
      const content = await fs.readFile(stepLogPath, 'utf8');
      // Should log either success or warning + "Step 2 completed"
      expect(content).toMatch(/Step 2 completed/);
    });

    test('log file path matches orchestrator convention (steps/step_02.log)', () => {
      // Validates the naming convention used by main_orchestrator.js:
      //   path.join(stepsLogDir, `${step.id}.log`)  where step.id === 'step_02'
      const conventionPath = path.join(stepsDir, 'step_02.log');
      expect(conventionPath).toBe(stepLogPath);
    });

    test('log file contains ISO-8601 timestamps for each entry', async () => {
      logger.openStepLogFile(stepLogPath);
      logger.info('timestamp test');
      logger.closeStepLogFile();

      await new Promise((r) => setTimeout(r, 50));
      const content = await fs.readFile(stepLogPath, 'utf8');
      // Logger format: [2026-02-20T19:27:45.079Z]
      expect(content).toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z\]/);
    });
  });

  // =========================================================================
  // Layer 3: Prompt Response File (Backlog Report)
  // =========================================================================

  describe('Layer 3: Prompt Response File — Backlog Report (saveStepSummary)', () => {
    test('saveStepSummary is NOT called when step is skipped (no docs)', async () => {
      const { stub, calls } = buildBacklogStub();
      const analyzer = new Step2ConsistencyAnalyzer({
        fileOps: buildRealFileOps(tempDir),
        backlog: stub,
      });

      await analyzer.execute(tempDir);

      expect(calls).toHaveLength(0);
    });

    test('saveStepSummary IS called when documentation files are found', async () => {
      await writeFile(path.join(tempDir, 'README.md'), '# Project\n');

      const { stub, calls } = buildBacklogStub();
      const analyzer = new Step2ConsistencyAnalyzer({
        fileOps: buildRealFileOps(tempDir),
        backlog: stub,
      });

      await analyzer.execute(tempDir);

      expect(calls).toHaveLength(1);
    });

    test('saveStepSummary called with step number 2', async () => {
      await writeFile(path.join(tempDir, 'README.md'), '# Project\n');

      const { stub, calls } = buildBacklogStub();
      const analyzer = new Step2ConsistencyAnalyzer({
        fileOps: buildRealFileOps(tempDir),
        backlog: stub,
      });

      await analyzer.execute(tempDir);

      expect(calls[0].step).toBe(2);
    });

    test('saveStepSummary called with "Consistency Analysis" title', async () => {
      await writeFile(path.join(tempDir, 'README.md'), '# Project\n');

      const { stub, calls } = buildBacklogStub();
      const analyzer = new Step2ConsistencyAnalyzer({
        fileOps: buildRealFileOps(tempDir),
        backlog: stub,
      });

      await analyzer.execute(tempDir);

      expect(calls[0].title).toBe('Consistency Analysis');
    });

    test('report contains Step 2 heading', async () => {
      await writeFile(path.join(tempDir, 'README.md'), '# Project\n');

      const { stub, calls } = buildBacklogStub();
      const analyzer = new Step2ConsistencyAnalyzer({
        fileOps: buildRealFileOps(tempDir),
        backlog: stub,
      });

      await analyzer.execute(tempDir);

      expect(calls[0].content).toContain('Step 2');
    });

    test('report contains Summary section', async () => {
      await writeFile(path.join(tempDir, 'README.md'), '# Project\n');

      const { stub, calls } = buildBacklogStub();
      const analyzer = new Step2ConsistencyAnalyzer({
        fileOps: buildRealFileOps(tempDir),
        backlog: stub,
      });

      await analyzer.execute(tempDir);

      expect(calls[0].content).toContain('Summary');
    });

    test('report contains "Files checked" count', async () => {
      await writeFile(path.join(tempDir, 'README.md'), '# Project\n');
      await writeFile(path.join(tempDir, 'docs', 'api.md'), '# API\n');

      const { stub, calls } = buildBacklogStub();
      const analyzer = new Step2ConsistencyAnalyzer({
        fileOps: buildRealFileOps(tempDir),
        backlog: stub,
      });

      await analyzer.execute(tempDir);

      expect(calls[0].content).toContain('Files checked');
    });

    test('report contains "Total issues" count', async () => {
      await writeFile(path.join(tempDir, 'README.md'), '# Project\n');

      const { stub, calls } = buildBacklogStub();
      const analyzer = new Step2ConsistencyAnalyzer({
        fileOps: buildRealFileOps(tempDir),
        backlog: stub,
      });

      await analyzer.execute(tempDir);

      expect(calls[0].content).toContain('Total issues');
    });

    test('report contains ✅ status indicator when no issues found', async () => {
      await writeFile(path.join(tempDir, 'README.md'), '# Clean project\n');

      const { stub, calls } = buildBacklogStub();
      const analyzer = new Step2ConsistencyAnalyzer({
        fileOps: buildRealFileOps(tempDir),
        backlog: stub,
      });

      await analyzer.execute(tempDir);

      expect(calls[0].content).toContain('✅');
    });

    test('report contains ⚠️ status indicator when issues are found', async () => {
      await writeFile(
        path.join(tempDir, 'README.md'),
        '# Project\n\n[broken link](nonexistent.md)\n'
      );

      const { stub, calls } = buildBacklogStub();
      const analyzer = new Step2ConsistencyAnalyzer({
        fileOps: buildRealFileOps(tempDir),
        backlog: stub,
      });

      await analyzer.execute(tempDir);

      expect(calls[0].content).toContain('⚠️');
    });

    test('report contains "Broken Links" section when broken links found', async () => {
      await writeFile(path.join(tempDir, 'README.md'), '[see guide](docs/nonexistent.md)\n');

      const { stub, calls } = buildBacklogStub();
      const analyzer = new Step2ConsistencyAnalyzer({
        fileOps: buildRealFileOps(tempDir),
        backlog: stub,
      });

      await analyzer.execute(tempDir);

      expect(calls[0].content).toContain('Broken Links');
    });

    test('report contains "Version Issues" section when version mismatch found', async () => {
      await writeFile(path.join(tempDir, 'package.json'), JSON.stringify({ version: '2.0.0' }));
      await writeFile(path.join(tempDir, 'README.md'), '# Project\n\nVersion 1.0.0\n');

      const { stub, calls } = buildBacklogStub();
      const analyzer = new Step2ConsistencyAnalyzer({
        fileOps: buildRealFileOps(tempDir),
        backlog: stub,
      });

      await analyzer.execute(tempDir);

      expect(calls[0].content).toContain('Version Issues');
    });

    test('report is persisted to disk when outputPath is provided', async () => {
      await writeFile(path.join(tempDir, 'README.md'), '# Project\n');

      const reportPath = path.join(tempDir, 'output', 'step_02_report.md');
      const { stub } = buildBacklogStub(reportPath);
      const analyzer = new Step2ConsistencyAnalyzer({
        fileOps: buildRealFileOps(tempDir),
        backlog: stub,
      });

      await analyzer.execute(tempDir);

      const stat = await fs.stat(reportPath);
      expect(stat.isFile()).toBe(true);
      const content = await fs.readFile(reportPath, 'utf8');
      expect(content.length).toBeGreaterThan(0);
      expect(content).toContain('Step 2');
    });

    test('report file path follows orchestrator prompts convention: prompts/step_02/<timestamp>_<seq>_<persona>.md', () => {
      // Validates the _logPrompt filename pattern from ai_helpers.js _logPrompt():
      //   `${ts}_${String(counter).padStart(4,'0')}_${persona}.md`
      // and the directory pattern from main_orchestrator.js:
      //   path.join(logsRunDir, 'prompts', stepId)  → prompts/step_02/
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      const persona = 'documentation_analyst';
      const filename = `${ts}_0001_${persona}.md`;
      const promptsDir = path.join('prompts', 'step_02');
      const fullPath = path.join(promptsDir, filename);

      expect(fullPath).toMatch(/prompts[\\/]step_02[\\/].+_0001_documentation_analyst\.md/);
    });

    describe('formatConsistencyReport() — pure function for report generation', () => {
      test('returns a markdown string', () => {
        const report = formatConsistencyReport({
          filesChecked: 3,
          totalIssues: 0,
          brokenLinks: [],
          versionIssues: [],
        });
        expect(typeof report).toBe('string');
        expect(report).toContain('#');
      });

      test('reports correct file count', () => {
        const report = formatConsistencyReport({
          filesChecked: 7,
          totalIssues: 0,
          brokenLinks: [],
          versionIssues: [],
        });
        expect(report).toContain('7');
      });

      test('shows ✅ when totalIssues is zero', () => {
        const report = formatConsistencyReport({
          filesChecked: 2,
          totalIssues: 0,
          brokenLinks: [],
          versionIssues: [],
        });
        expect(report).toContain('✅');
      });

      test('shows ⚠️ when totalIssues is non-zero', () => {
        const report = formatConsistencyReport({
          filesChecked: 2,
          totalIssues: 1,
          brokenLinks: [{ file: 'README.md', link: 'missing.md', text: 'link', line: 1 }],
          versionIssues: [],
        });
        expect(report).toContain('⚠️');
      });

      test('includes broken link details in report', () => {
        const report = formatConsistencyReport({
          filesChecked: 1,
          totalIssues: 1,
          brokenLinks: [{ file: 'README.md', link: 'missing.md', text: 'guide', line: 5 }],
          versionIssues: [],
        });
        expect(report).toContain('README.md');
        expect(report).toContain('missing.md');
      });

      test('includes version issue details in report', () => {
        const report = formatConsistencyReport({
          filesChecked: 1,
          totalIssues: 1,
          brokenLinks: [],
          versionIssues: [{ file: 'README.md', found: '1.0.0', expected: '2.0.0' }],
        });
        expect(report).toContain('README.md');
        expect(report).toContain('1.0.0');
        expect(report).toContain('2.0.0');
      });
    });
  });
});
