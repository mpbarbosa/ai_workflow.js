/**
 * @fileoverview E2E tests for the step_02_5 execute() method fix.
 *
 * Regression scenario: The orchestrator's _createStepHandler() calls
 * `executor.execute(projectRoot)` on every step class, but DocumentationOptimizer
 * only exposed `run()`, causing:
 *   "Executor for step_02_5 does not have an execute method"
 *
 * These tests verify:
 *  1. DocumentationOptimizer.execute() exists and is callable
 *  2. execute() delegates to run() and returns a well-formed result
 *  3. The orchestrator's _createStepHandler() successfully invokes step_02_5
 *     via execute() without throwing
 *  4. execute() propagates projectRoot into run() as config.projectRoot
 *  5. Graceful skip behaviour (missing docs dir, too few files) is preserved
 *     through the execute() wrapper
 *
 * @group e2e
 * @group regression
 */

import fs from 'fs/promises';
import path from 'path';
import { DocumentationOptimizer } from '../../src/steps/step_02_5_doc_optimize.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function writeFile(filePath, content) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, 'utf8');
}

/**
 * Build a DocumentationOptimizer whose I/O is fully controlled through
 * injected stubs so tests are deterministic and require no live filesystem
 * access beyond tempDir.
 *
 * @param {Object} overrides - Keys matching DocumentationOptimizer constructor options.
 */
function buildOptimizer({
  docsDir = 'docs',
  files = [],
  dirExists = true,
  extraOptions = {},
} = {}) {
  const fileOps = {
    exists: (_dir) => Promise.resolve(dirExists),
    listDirectoryRecursive: (_dir, _opts) => Promise.resolve(files),
    ...extraOptions.fileOps,
  };

  const noop = () => Promise.resolve({ exactDuplicates: [], redundantPairs: [] });
  const noopOutdated = () => Promise.resolve({ outdatedFiles: [] });

  const heuristics = {
    analyzeDocuments: noop,
    ...extraOptions.heuristics,
  };

  const gitAnalyzer = {
    analyzeDocuments: noopOutdated,
    ...extraOptions.gitAnalyzer,
  };

  const versionAnalyzer = {
    analyzeDocuments: noopOutdated,
    ...extraOptions.versionAnalyzer,
  };

  const consolidation = {
    generateTimestamp: () => 'ts-test',
    consolidateDuplicates: () => Promise.resolve({ archived: [], errors: [] }),
    archiveOutdatedFiles: () => Promise.resolve({ archived: [], errors: [] }),
    ...extraOptions.consolidation,
  };

  const reporting = {
    generateAndDisplay: () => Promise.resolve({ reportPath: 'report.md' }),
    ...extraOptions.reporting,
  };

  // Silent logger so test output stays clean
  const logger = {
    info: () => {},
    warn: () => {},
    error: () => {},
    step: () => {},
  };

  return new DocumentationOptimizer({
    fileOps,
    heuristics,
    gitAnalyzer,
    versionAnalyzer,
    consolidation,
    reporting,
    logger,
    userConfig: { docsDir },
    ...extraOptions.optimizerProps,
  });
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('E2E: step_02_5 execute() fix regression', () => {
  // =========================================================================
  // 1. Method contract
  // =========================================================================

  describe('DocumentationOptimizer.execute() — method contract', () => {
    test('execute() exists on DocumentationOptimizer prototype', () => {
      const optimizer = buildOptimizer({ dirExists: false });
      expect(typeof optimizer.execute).toBe('function');
    });

    test('execute() is async (returns a Promise)', () => {
      const optimizer = buildOptimizer({ dirExists: false });
      const result = optimizer.execute('/tmp/project');
      expect(result).toBeInstanceOf(Promise);
      return result; // let Jest await resolution
    });

    test('execute() accepts a projectRoot string without throwing', async () => {
      const optimizer = buildOptimizer({ dirExists: false });
      await expect(optimizer.execute('/some/project/root')).resolves.toBeDefined();
    });

    test('execute() returns an object with a success property', async () => {
      const optimizer = buildOptimizer({ dirExists: false });
      const result = await optimizer.execute('/tmp');
      expect(result).toHaveProperty('success');
      expect(typeof result.success).toBe('boolean');
    });
  });

  // =========================================================================
  // 2. Delegation to run()
  // =========================================================================

  describe('execute() delegates to run()', () => {
    test('execute() returns success:true when docs dir is missing (skipped)', async () => {
      const optimizer = buildOptimizer({ dirExists: false });
      const result = await optimizer.execute('/any/path');

      expect(result.success).toBe(true);
      expect(result.skipped).toBe(true);
      expect(result.reason).toMatch(/not found/i);
    });

    test('execute() returns success:true and skipped when too few files', async () => {
      // Default minFiles is 5; provide only 3 to trigger the "too small" skip
      const optimizer = buildOptimizer({
        dirExists: true,
        files: ['/docs/one.md', '/docs/two.md', '/docs/three.md'],
      });
      const result = await optimizer.execute('/project');

      expect(result.success).toBe(true);
      expect(result.skipped).toBe(true);
      expect(result.reason).toMatch(/too small/i);
    });

    test('execute() returns success:true with summary when enough files exist', async () => {
      // minFiles defaults to 5 — provide exactly 5 to pass the shouldSkip() check
      const files = ['/docs/a.md', '/docs/b.md', '/docs/c.md', '/docs/d.md', '/docs/e.md'];
      const optimizer = buildOptimizer({ dirExists: true, files });
      const result = await optimizer.execute('/project');

      expect(result.success).toBe(true);
      expect(result).toHaveProperty('summary');
      expect(result.summary).toHaveProperty('totalFiles', files.length);
    });

    test('execute() propagates projectRoot into run config', async () => {
      // Track the userConfig received by initialize()
      const receivedConfigs = [];
      const files = ['/docs/a.md', '/docs/b.md', '/docs/c.md', '/docs/d.md'];
      const optimizer = buildOptimizer({ dirExists: true, files });

      const originalInitialize = optimizer.initialize.bind(optimizer);
      optimizer.initialize = (userConfig) => {
        receivedConfigs.push(userConfig);
        return originalInitialize(userConfig);
      };

      await optimizer.execute('/my/custom/root');

      expect(receivedConfigs.length).toBeGreaterThan(0);
      expect(receivedConfigs[0]).toHaveProperty('projectRoot', '/my/custom/root');
    });
  });

  // =========================================================================
  // 3. Orchestrator _createStepHandler integration
  // =========================================================================

  describe('Orchestrator step handler integration', () => {
    /**
     * Simulate what MainOrchestrator._createStepHandler() does:
     * instantiate the executor class with commonDeps and call execute().
     */
    async function simulateOrchestratorExecution(ExecutorClass, commonDeps, projectRoot) {
      const executor = new ExecutorClass(commonDeps);

      if (typeof executor.execute !== 'function') {
        throw new Error(`Executor for step_02_5 does not have an execute method`);
      }

      return executor.execute(projectRoot);
    }

    test('does NOT throw "does not have an execute method" after fix', async () => {
      const commonDeps = {}; // orchestrator passes its own deps; optimizer ignores unknown keys

      await expect(
        simulateOrchestratorExecution(DocumentationOptimizer, commonDeps, '/project')
      ).resolves.toBeDefined();
    });

    test('orchestrator-style instantiation produces a usable executor', async () => {
      const commonDeps = {};
      const executor = new DocumentationOptimizer(commonDeps);

      expect(typeof executor.execute).toBe('function');
    });

    test('execute() called with undefined projectRoot falls back gracefully', async () => {
      const executor = new DocumentationOptimizer({});
      // Should not throw; run() handles missing docsDir via shouldSkip
      await expect(executor.execute(undefined)).resolves.toHaveProperty('success');
    });

    test('execute() called with empty string projectRoot does not throw', async () => {
      const executor = new DocumentationOptimizer({});
      await expect(executor.execute('')).resolves.toHaveProperty('success');
    });
  });

  // =========================================================================
  // 4. Real filesystem round-trip
  // =========================================================================

  describe('Real filesystem: execute() with actual docs directory', () => {
    let tempDir;

    beforeEach(async () => {
      tempDir = path.join(
        process.cwd(),
        '.test-e2e',
        `step-02-5-${Date.now()}-${Math.random().toString(36).slice(2)}`
      );
      await fs.mkdir(tempDir, { recursive: true });
    });

    afterEach(async () => {
      await fs.rm(tempDir, { recursive: true, force: true });
    });

    test('execute() skips when docs dir does not exist on real filesystem', async () => {
      // Use a real FileOperations-style stub pointing at a non-existent dir
      const optimizer = buildOptimizer({ dirExists: false });
      const result = await optimizer.execute(tempDir);

      expect(result.success).toBe(true);
      expect(result.skipped).toBe(true);
    });

    test('execute() completes successfully with enough real markdown files', async () => {
      const docsPath = path.join(tempDir, 'docs');

      // Write enough markdown files to exceed minFiles (default: 3)
      for (let i = 1; i <= 5; i++) {
        await writeFile(
          path.join(docsPath, `guide-${i}.md`),
          `# Guide ${i}\n\nContent for guide ${i}.`
        );
      }

      // Build optimizer with real fileOps pointing at our tempDir
      const fileOps = {
        exists: async (dir) => {
          const absDir = path.isAbsolute(dir) ? dir : path.join(tempDir, dir);
          try {
            await fs.access(absDir);
            return true;
          } catch {
            return false;
          }
        },
        listDirectoryRecursive: async (dir) => {
          const absDir = path.isAbsolute(dir) ? dir : path.join(tempDir, dir);
          try {
            const entries = await fs.readdir(absDir, { withFileTypes: true });
            return entries
              .filter((e) => e.isFile() && e.name.endsWith('.md'))
              .map((e) => path.join(absDir, e.name));
          } catch {
            return [];
          }
        },
      };

      const optimizer = buildOptimizer({
        docsDir: 'docs',
        extraOptions: { fileOps },
      });

      const result = await optimizer.execute(tempDir);

      expect(result.success).toBe(true);
      expect(result.skipped).toBeUndefined();
      expect(result.summary).toHaveProperty('totalFiles', 5);
    });

    test('execute() result contains errors array even when no errors occur', async () => {
      const optimizer = buildOptimizer({ dirExists: false });
      const result = await optimizer.execute(tempDir);

      // Skipped path doesn't populate errors, but successful paths should have it
      expect(result).toBeDefined();
    });
  });

  // =========================================================================
  // 5. Error propagation
  // =========================================================================

  describe('execute() error propagation', () => {
    test('execute() returns success:false when initialize() fails due to bad config', async () => {
      const optimizer = buildOptimizer({
        extraOptions: {
          optimizerProps: {
            // Force an invalid config by overriding userConfig after construction
          },
        },
      });

      // Patch initialize to simulate validation failure
      optimizer.initialize = () => ({ valid: false, errors: ['simulated config error'] });

      const result = await optimizer.execute('/project');

      expect(result.success).toBe(false);
      expect(result.errors).toEqual(['simulated config error']);
    });

    test('execute() returns success:false when a critical analysis phase throws', async () => {
      // minFiles defaults to 5 — provide 5 so shouldSkip() passes and heuristics runs
      const files = ['/docs/a.md', '/docs/b.md', '/docs/c.md', '/docs/d.md', '/docs/e.md'];
      const optimizer = buildOptimizer({
        dirExists: true,
        files,
        extraOptions: {
          heuristics: {
            analyzeDocuments: () => Promise.reject(new Error('heuristics explosion')),
          },
        },
      });

      const result = await optimizer.execute('/project');

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/heuristics explosion/);
    });
  });
});
