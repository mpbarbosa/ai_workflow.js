/**
 * @fileoverview Integration (E2E) tests for Step 0: Pre-Analysis
 *
 * These tests exercise Step0Analyzer.execute() against a real temporary
 * filesystem, using real ProjectKindDetector and TechStackDetector instances
 * while stubbing git operations (which require live git state / network).
 *
 * Scenarios covered:
 *  1. Method contract — execute() signature and result shape
 *  2. Real Node.js project-kind detection from package.json on disk
 *  3. Real React SPA detection via package.json dependencies
 *  4. Config-based project-kind override via .workflow-config.yaml
 *  5. Real tech-stack detection (language, build system, test framework)
 *  6. Change-scope classification across all CHANGE_SCOPE variants
 *  7. Backlog persistence — saveStepIssues and saveStepSummary calls
 *  8. Orchestrator-style instantiation (_createStepHandler pattern)
 *  9. Error propagation when git operations fail
 * 10. Graceful behaviour with minimal (git-only) dependencies
 *
 * @group integration
 * @group e2e
 */

import fs from 'fs/promises';
import path from 'path';
import {
  Step0Analyzer,
  CHANGE_SCOPE,
} from '../../src/steps/step_00_analyze.js';
import { ProjectKindDetector } from '../../src/lib/project_kind_detection.js';
import { TechStackDetector } from '../../src/lib/tech_stack.js';
import { ProjectKindConfigManager } from '../../src/lib/project_kind_config.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Write a file, creating all parent directories as needed.
 */
async function writeFile(filePath, content) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, 'utf8');
}

/**
 * Build a stub gitOps whose return values are fully controlled per test.
 */
function buildGitOps({
  commitsAhead = 2,
  totalChanges = 5,
  modifiedFiles = ['src/app.js', 'src/utils.js', 'test/app.test.js', 'README.md', 'config.yaml'],
  statusOutput = 'M  src/app.js\nM  README.md',
} = {}) {
  return {
    getCommitsAhead: () => Promise.resolve(commitsAhead),
    getTotalChanges: () => Promise.resolve(totalChanges),
    getModifiedFiles: () => Promise.resolve(modifiedFiles),
    getStatusOutput: () => Promise.resolve(statusOutput),
  };
}

/**
 * Build a captured backlog stub that records all calls.
 */
function buildBacklogStub() {
  const issuesCalls = [];
  const summaryCalls = [];
  return {
    stub: {
      saveStepIssues: (step, name, content) => {
        issuesCalls.push({ step, name, content });
        return Promise.resolve();
      },
      saveStepSummary: (step, name, summary, status) => {
        summaryCalls.push({ step, name, summary, status });
        return Promise.resolve();
      },
    },
    issuesCalls,
    summaryCalls,
  };
}

/**
 * Build a Step0Analyzer wired to a real tempDir for project detection.
 * gitOps and backlogManager are always stubs; detectors use the real impls.
 */
function buildAnalyzer(tempDir, { gitOps, backlogStub, withDetectors = true } = {}) {
  const git = gitOps || buildGitOps();
  const backlog = backlogStub || buildBacklogStub().stub;

  if (!withDetectors) {
    return new Step0Analyzer({ gitOps: git, backlogManager: backlog });
  }

  return new Step0Analyzer({
    gitOps: git,
    projectDetection: new ProjectKindDetector(),
    techStackDetection: new TechStackDetector({ projectRoot: tempDir }),
    projectKindConfig: new ProjectKindConfigManager({ projectRoot: tempDir }),
    backlogManager: backlog,
  });
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** Write a minimal Node.js API package.json (express-based) + source files. */
async function writeNodeApiProject(dir) {
  await writeFile(
    path.join(dir, 'package.json'),
    JSON.stringify({
      name: 'my-api',
      version: '1.0.0',
      type: 'module',
      dependencies: { express: '^4.18.0' },
      devDependencies: { jest: '^29.0.0' },
    })
  );
  // JS source files so the language detector picks up 'javascript'
  await writeFile(path.join(dir, 'src', 'app.js'), '// app entry point\n');
  await writeFile(path.join(dir, 'src', 'utils.js'), '// utilities\n');
}

/** Write a React SPA package.json. */
async function writeReactProject(dir) {
  await writeFile(
    path.join(dir, 'package.json'),
    JSON.stringify({
      name: 'my-spa',
      version: '0.1.0',
      dependencies: { react: '^18.0.0', 'react-dom': '^18.0.0' },
      devDependencies: { vite: '^4.0.0' },
    })
  );
}

/** Write a .workflow-config.yaml with a specified project kind. */
async function writeWorkflowConfig(dir, kind) {
  await writeFile(
    path.join(dir, '.workflow-config.yaml'),
    `project:\n  kind: "${kind}"\n  name: "test-project"\n`
  );
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('Integration: Step0Analyzer', () => {
  let tempDir;

  beforeEach(async () => {
    tempDir = path.join(
      process.cwd(),
      '.test-e2e',
      `step-00-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    await fs.mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  // =========================================================================
  // 1. Method contract
  // =========================================================================

  describe('Step0Analyzer.execute() — method contract', () => {
    test('execute() exists on the prototype', () => {
      const analyzer = buildAnalyzer(tempDir);
      expect(typeof analyzer.execute).toBe('function');
    });

    test('execute() returns a Promise', () => {
      const analyzer = buildAnalyzer(tempDir);
      const result = analyzer.execute(tempDir);
      expect(result).toBeInstanceOf(Promise);
      return result;
    });

    test('result always has a boolean success property', async () => {
      const analyzer = buildAnalyzer(tempDir);
      const result = await analyzer.execute(tempDir);
      expect(result).toHaveProperty('success');
      expect(typeof result.success).toBe('boolean');
    });

    test('successful result has an analysis object', async () => {
      const analyzer = buildAnalyzer(tempDir);
      const result = await analyzer.execute(tempDir);
      expect(result.success).toBe(true);
      expect(result.analysis).toBeDefined();
      expect(typeof result.analysis).toBe('object');
    });

    test('analysis always contains core fields', async () => {
      const analyzer = buildAnalyzer(tempDir);
      const result = await analyzer.execute(tempDir);
      const { analysis } = result;
      expect(analysis).toHaveProperty('commitsAhead');
      expect(analysis).toHaveProperty('modifiedFiles');
      expect(analysis).toHaveProperty('changeScope');
      expect(analysis).toHaveProperty('fileCounts');
      expect(analysis).toHaveProperty('timestamp');
    });
  });

  // =========================================================================
  // 2. Real project-kind detection — Node.js API
  // =========================================================================

  describe('Real project-kind detection — Node.js API', () => {
    beforeEach(() => writeNodeApiProject(tempDir));

    test('detects nodejs_api from express dependency', async () => {
      const analyzer = buildAnalyzer(tempDir);
      const result = await analyzer.execute(tempDir);

      expect(result.success).toBe(true);
      expect(result.analysis.projectKind).not.toBeNull();
      expect(result.analysis.projectKind.kind).toBe('nodejs_api');
    });

    test('auto-detected result has confidence > 50', async () => {
      const analyzer = buildAnalyzer(tempDir);
      const result = await analyzer.execute(tempDir);

      expect(result.analysis.projectKind.confidence).toBeGreaterThan(50);
    });

    test('auto-detected result has source = "auto-detected"', async () => {
      const analyzer = buildAnalyzer(tempDir);
      const result = await analyzer.execute(tempDir);

      expect(result.analysis.projectKind.source).toBe('auto-detected');
    });
  });

  // =========================================================================
  // 3. Real project-kind detection — React SPA
  // =========================================================================

  describe('Real project-kind detection — React SPA', () => {
    beforeEach(() => writeReactProject(tempDir));

    test('detects react_spa from react dependency', async () => {
      const analyzer = buildAnalyzer(tempDir);
      const result = await analyzer.execute(tempDir);

      expect(result.success).toBe(true);
      expect(result.analysis.projectKind.kind).toBe('react_spa');
    });

    test('react detection confidence is high (≥ 85)', async () => {
      const analyzer = buildAnalyzer(tempDir);
      const result = await analyzer.execute(tempDir);

      expect(result.analysis.projectKind.confidence).toBeGreaterThanOrEqual(85);
    });
  });

  // =========================================================================
  // 4. Config-based project kind (.workflow-config.yaml)
  // =========================================================================

  describe('Config-based project kind via .workflow-config.yaml', () => {
    test('uses kind from config, ignoring auto-detection', async () => {
      await writeWorkflowConfig(tempDir, 'shell_script_automation');
      // No package.json — detector would find unknown without config
      const analyzer = buildAnalyzer(tempDir);
      const result = await analyzer.execute(tempDir);

      expect(result.success).toBe(true);
      expect(result.analysis.projectKind.kind).toBe('shell_script_automation');
    });

    test('config-sourced kind has confidence = 100 and source = "config"', async () => {
      await writeWorkflowConfig(tempDir, 'python_app');
      const analyzer = buildAnalyzer(tempDir);
      const result = await analyzer.execute(tempDir);

      expect(result.analysis.projectKind.confidence).toBe(100);
      expect(result.analysis.projectKind.source).toBe('config');
    });

    test('config kind overrides package.json auto-detection', async () => {
      await writeNodeApiProject(tempDir);                    // would auto-detect nodejs_api
      await writeWorkflowConfig(tempDir, 'static_website'); // config wins
      const analyzer = buildAnalyzer(tempDir);
      const result = await analyzer.execute(tempDir);

      expect(result.analysis.projectKind.kind).toBe('static_website');
      expect(result.analysis.projectKind.source).toBe('config');
    });
  });

  // =========================================================================
  // 5. Real tech-stack detection
  // =========================================================================

  describe('Real tech-stack detection', () => {
    test('detects javascript as primary language from package.json', async () => {
      await writeNodeApiProject(tempDir);
      const analyzer = buildAnalyzer(tempDir);
      const result = await analyzer.execute(tempDir);

      expect(result.success).toBe(true);
      expect(result.analysis.techStack).not.toBeNull();
      expect(result.analysis.techStack.primary_language).toBe('javascript');
    });

    test('detects npm as build system from package.json', async () => {
      await writeNodeApiProject(tempDir);
      const analyzer = buildAnalyzer(tempDir);
      const result = await analyzer.execute(tempDir);

      expect(result.analysis.techStack.build_system).toBe('npm');
    });

    test('detects jest as test framework from devDependencies', async () => {
      await writeNodeApiProject(tempDir);
      const analyzer = buildAnalyzer(tempDir);
      const result = await analyzer.execute(tempDir);

      expect(result.analysis.techStack.test_framework).toBe('jest');
    });

    test('techStack is null when no techStackDetection dep provided', async () => {
      await writeNodeApiProject(tempDir);
      const analyzer = new Step0Analyzer({
        gitOps: buildGitOps(),
        projectDetection: new ProjectKindDetector(),
        backlogManager: buildBacklogStub().stub,
        // techStackDetection intentionally omitted
      });
      const result = await analyzer.execute(tempDir);

      expect(result.analysis.techStack).toBeNull();
    });
  });

  // =========================================================================
  // 6. Change-scope classification
  // =========================================================================

  describe('Change-scope classification from git file lists', () => {
    test('NO_CHANGES when modifiedFiles is empty', async () => {
      const git = buildGitOps({ totalChanges: 0, modifiedFiles: [] });
      const analyzer = buildAnalyzer(tempDir, { gitOps: git, withDetectors: false });
      const result = await analyzer.execute(tempDir);

      expect(result.analysis.changeScope).toBe(CHANGE_SCOPE.NO_CHANGES);
    });

    test('DOCUMENTATION_ONLY for markdown-only changes', async () => {
      const git = buildGitOps({
        totalChanges: 3,
        modifiedFiles: ['README.md', 'docs/guide.md', 'CHANGELOG.md'],
      });
      const analyzer = buildAnalyzer(tempDir, { gitOps: git, withDetectors: false });
      const result = await analyzer.execute(tempDir);

      expect(result.analysis.changeScope).toBe(CHANGE_SCOPE.DOCUMENTATION_ONLY);
    });

    test('TESTS_ONLY for test file changes', async () => {
      const git = buildGitOps({
        totalChanges: 2,
        modifiedFiles: ['test/unit.test.js', 'test/integration.test.js'],
      });
      const analyzer = buildAnalyzer(tempDir, { gitOps: git, withDetectors: false });
      const result = await analyzer.execute(tempDir);

      expect(result.analysis.changeScope).toBe(CHANGE_SCOPE.TESTS_ONLY);
    });

    test('SOURCE_CODE for src-only changes', async () => {
      const git = buildGitOps({
        totalChanges: 2,
        modifiedFiles: ['src/app.js', 'src/utils.js'],
      });
      const analyzer = buildAnalyzer(tempDir, { gitOps: git, withDetectors: false });
      const result = await analyzer.execute(tempDir);

      expect(result.analysis.changeScope).toBe(CHANGE_SCOPE.SOURCE_CODE);
    });

    test('CODE_AND_TESTS for src + test changes', async () => {
      const git = buildGitOps({
        totalChanges: 2,
        modifiedFiles: ['src/app.js', 'test/app.test.js'],
      });
      const analyzer = buildAnalyzer(tempDir, { gitOps: git, withDetectors: false });
      const result = await analyzer.execute(tempDir);

      expect(result.analysis.changeScope).toBe(CHANGE_SCOPE.CODE_AND_TESTS);
    });

    test('FULL_STACK for src + test + doc changes', async () => {
      const git = buildGitOps({
        totalChanges: 3,
        modifiedFiles: ['src/app.js', 'test/app.test.js', 'README.md'],
      });
      const analyzer = buildAnalyzer(tempDir, { gitOps: git, withDetectors: false });
      const result = await analyzer.execute(tempDir);

      expect(result.analysis.changeScope).toBe(CHANGE_SCOPE.FULL_STACK);
    });

    test('workflow artifacts are excluded from change-scope counts', async () => {
      const git = buildGitOps({
        totalChanges: 2,
        modifiedFiles: [
          '.ai_workflow/backlog/report.md', // artifact — excluded
          'README.md',                       // documentation
        ],
      });
      const analyzer = buildAnalyzer(tempDir, { gitOps: git, withDetectors: false });
      const result = await analyzer.execute(tempDir);

      // Only README.md counts → DOCUMENTATION_ONLY, not MIXED_CHANGES
      expect(result.analysis.changeScope).toBe(CHANGE_SCOPE.DOCUMENTATION_ONLY);
      expect(result.analysis.fileCounts.documentation).toBe(1);
    });

    test('fileCounts reflect classified files', async () => {
      const git = buildGitOps({
        totalChanges: 5,
        modifiedFiles: [
          'README.md',
          'docs/api.md',
          'test/unit.test.js',
          'src/app.js',
          'config.yaml',
        ],
      });
      const analyzer = buildAnalyzer(tempDir, { gitOps: git, withDetectors: false });
      const result = await analyzer.execute(tempDir);

      expect(result.analysis.fileCounts.documentation).toBe(2);
      expect(result.analysis.fileCounts.test).toBe(1);
      expect(result.analysis.fileCounts.source).toBe(1);
      expect(result.analysis.fileCounts.config).toBe(1);
    });
  });

  // =========================================================================
  // 7. Backlog persistence
  // =========================================================================

  describe('Backlog persistence', () => {
    test('calls saveStepIssues with step=0 and name="Pre_Analysis"', async () => {
      const { stub, issuesCalls } = buildBacklogStub();
      const analyzer = buildAnalyzer(tempDir, { backlogStub: stub, withDetectors: false });
      const git = buildGitOps({ commitsAhead: 4, totalChanges: 7 });
      analyzer.gitOps = git;

      await analyzer.execute(tempDir);

      expect(issuesCalls).toHaveLength(1);
      expect(issuesCalls[0].step).toBe(0);
      expect(issuesCalls[0].name).toBe('Pre_Analysis');
    });

    test('saveStepIssues content contains commits-ahead count', async () => {
      const { stub, issuesCalls } = buildBacklogStub();
      const git = buildGitOps({ commitsAhead: 7 });
      const analyzer = new Step0Analyzer({ gitOps: git, backlogManager: stub });

      await analyzer.execute(tempDir);

      expect(issuesCalls[0].content).toContain('**Commits Ahead:** 7');
    });

    test('saveStepIssues content contains modified-files count', async () => {
      const { stub, issuesCalls } = buildBacklogStub();
      const git = buildGitOps({ totalChanges: 13 });
      const analyzer = new Step0Analyzer({ gitOps: git, backlogManager: stub });

      await analyzer.execute(tempDir);

      expect(issuesCalls[0].content).toContain('**Modified Files:** 13');
    });

    test('calls saveStepSummary with status ✅', async () => {
      const { stub, summaryCalls } = buildBacklogStub();
      const analyzer = new Step0Analyzer({ gitOps: buildGitOps(), backlogManager: stub });

      await analyzer.execute(tempDir);

      expect(summaryCalls).toHaveLength(1);
      expect(summaryCalls[0].step).toBe(0);
      expect(summaryCalls[0].status).toBe('✅');
    });

    test('saveStepSummary message mentions modified-files count', async () => {
      const { stub, summaryCalls } = buildBacklogStub();
      const git = buildGitOps({ totalChanges: 9 });
      const analyzer = new Step0Analyzer({ gitOps: git, backlogManager: stub });

      await analyzer.execute(tempDir);

      expect(summaryCalls[0].summary).toContain('9 modified files');
    });

    test('does not call backlog methods when no backlogManager provided', async () => {
      // Minimal analyzer — no backlogManager
      const analyzer = new Step0Analyzer({ gitOps: buildGitOps() });
      // Should complete without throwing
      const result = await analyzer.execute(tempDir);
      expect(result.success).toBe(true);
    });
  });

  // =========================================================================
  // 8. Orchestrator-style instantiation
  // =========================================================================

  describe('Orchestrator-style instantiation', () => {
    /**
     * Simulate WorkflowEngine._createStepHandler():
     * instantiate the step class with commonDeps and call execute(projectRoot).
     */
    async function simulateOrchestrator(StepClass, commonDeps, projectRoot) {
      const executor = new StepClass(commonDeps);
      if (typeof executor.execute !== 'function') {
        throw new Error(`${StepClass.name} does not have an execute() method`);
      }
      return executor.execute(projectRoot);
    }

    test('does not throw "does not have an execute method"', async () => {
      const commonDeps = { gitOps: buildGitOps() };
      await expect(
        simulateOrchestrator(Step0Analyzer, commonDeps, tempDir)
      ).resolves.toBeDefined();
    });

    test('orchestrator result has success property', async () => {
      const result = await simulateOrchestrator(
        Step0Analyzer,
        { gitOps: buildGitOps() },
        tempDir
      );
      expect(result).toHaveProperty('success');
    });

    test('getMetadata() returns expected shape', () => {
      const analyzer = new Step0Analyzer({ gitOps: buildGitOps() });
      const meta = analyzer.getMetadata();

      expect(meta.id).toBe(0);
      expect(meta.name).toBe('Pre-Analysis');
      expect(meta.canSkip).toBe(false);
      expect(Array.isArray(meta.dependencies)).toBe(true);
      expect(meta.dependencies).toHaveLength(0);
    });
  });

  // =========================================================================
  // 9. Error propagation
  // =========================================================================

  describe('Error propagation', () => {
    test('returns success:false when getCommitsAhead throws', async () => {
      const failingGit = {
        ...buildGitOps(),
        getCommitsAhead: () => Promise.reject(new Error('git remote unreachable')),
      };
      const analyzer = new Step0Analyzer({ gitOps: failingGit });

      const result = await analyzer.execute(tempDir);

      expect(result.success).toBe(false);
      expect(result.error).toBe('git remote unreachable');
    });

    test('returns success:false when getModifiedFiles throws', async () => {
      const failingGit = {
        ...buildGitOps(),
        getModifiedFiles: () => Promise.reject(new Error('not a git repository')),
      };
      const analyzer = new Step0Analyzer({ gitOps: failingGit });

      const result = await analyzer.execute(tempDir);

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/not a git repository/);
    });

    test('does not throw — always resolves', async () => {
      const failingGit = {
        ...buildGitOps(),
        getTotalChanges: () => Promise.reject(new Error('fatal error')),
      };
      const analyzer = new Step0Analyzer({ gitOps: failingGit });

      await expect(analyzer.execute(tempDir)).resolves.toBeDefined();
    });

    test('result has no analysis property on failure', async () => {
      const failingGit = {
        ...buildGitOps(),
        getCommitsAhead: () => Promise.reject(new Error('timeout')),
      };
      const analyzer = new Step0Analyzer({ gitOps: failingGit });

      const result = await analyzer.execute(tempDir);

      expect(result.success).toBe(false);
      expect(result).not.toHaveProperty('analysis');
    });
  });

  // =========================================================================
  // 10. Minimal (git-only) dependencies
  // =========================================================================

  describe('Minimal (git-only) dependencies', () => {
    test('succeeds with only gitOps provided', async () => {
      const analyzer = new Step0Analyzer({ gitOps: buildGitOps() });
      const result = await analyzer.execute(tempDir);

      expect(result.success).toBe(true);
    });

    test('projectKind is null when no projectDetection provided', async () => {
      const analyzer = new Step0Analyzer({ gitOps: buildGitOps() });
      const result = await analyzer.execute(tempDir);

      expect(result.analysis.projectKind).toBeNull();
    });

    test('techStack is null when no techStackDetection provided', async () => {
      const analyzer = new Step0Analyzer({ gitOps: buildGitOps() });
      const result = await analyzer.execute(tempDir);

      expect(result.analysis.techStack).toBeNull();
    });

    test('commitsAhead and modifiedFiles are still populated', async () => {
      const git = buildGitOps({ commitsAhead: 6, totalChanges: 11 });
      const analyzer = new Step0Analyzer({ gitOps: git });
      const result = await analyzer.execute(tempDir);

      expect(result.analysis.commitsAhead).toBe(6);
      expect(result.analysis.modifiedFiles).toBe(11);
    });

    test('modifiedFilesList is populated from git stub', async () => {
      const files = ['src/foo.js', 'README.md'];
      const git = buildGitOps({ totalChanges: 2, modifiedFiles: files });
      const analyzer = new Step0Analyzer({ gitOps: git });
      const result = await analyzer.execute(tempDir);

      expect(result.analysis.modifiedFilesList).toEqual(files);
    });

    test('analysis.timestamp is a recent Unix timestamp', async () => {
      const before = Date.now();
      const analyzer = new Step0Analyzer({ gitOps: buildGitOps() });
      const result = await analyzer.execute(tempDir);
      const after = Date.now();

      expect(result.analysis.timestamp).toBeGreaterThanOrEqual(before);
      expect(result.analysis.timestamp).toBeLessThanOrEqual(after);
    });
  });
});
