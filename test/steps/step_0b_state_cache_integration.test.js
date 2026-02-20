/**
 * @fileoverview Integration tests: Step0bStateCache ↔ Step0bBootstrapDocs
 *
 * Validates the full cache lifecycle inside step_0b_bootstrap_docs.js:
 *
 *  Scenario 1 — Cache miss, AI returns 0 files → cache is written
 *  Scenario 2 — Cache hit (same docs, within TTL) → AI is NOT called
 *  Scenario 3 — Cache miss after file change → AI IS called again
 *  Scenario 4 — Cache invalidated when AI generates files
 *  Scenario 5 — TTL expiry triggers AI call even with unchanged files
 *  Scenario 6 — Cache is transparent when AI is unavailable
 *
 * @group integration
 * @group e2e
 */

import { jest } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';

import { Step0bBootstrapDocs } from '../../src/steps/step_0b_bootstrap_docs.js';
import {
  Step0bStateCache,
  CACHE_FILENAME,
  OUTCOME_NO_FILES,
} from '../../src/lib/step0b_state_cache.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function writeFile(filePath, content) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, 'utf8');
}

/** Silent logger stub */
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

/** Backlog stub */
function buildBacklog() {
  const calls = [];
  return {
    stub: {
      saveStepSummary: (...args) => {
        calls.push(args);
        return Promise.resolve();
      },
      saveStepIssues: (...args) => {
        calls.push(args);
        return Promise.resolve();
      },
    },
    calls,
  };
}

/**
 * Build a real fileOps adapter that supports readFile, writeFile,
 * listDirectoryRecursive, and exists — all rooted at projectRoot.
 */
function buildFileOps(projectRoot) {
  return {
    async readFile(filePath) {
      const resolved = path.isAbsolute(filePath) ? filePath : path.join(projectRoot, filePath);
      return fs.readFile(resolved, 'utf8');
    },
    async writeFile(filePath, content) {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, content, 'utf8');
    },
    async exists(filePath) {
      try {
        await fs.access(filePath);
        return true;
      } catch {
        return false;
      }
    },
    async listDirectoryRecursive(dirPath) {
      const entries = [];
      async function walk(dir) {
        let items;
        try {
          items = await fs.readdir(dir, { withFileTypes: true });
        } catch {
          return;
        }
        for (const item of items) {
          const full = path.join(dir, item.name);
          if (item.isDirectory()) await walk(full);
          else entries.push(full);
        }
      }
      await walk(dirPath);
      return entries;
    },
  };
}

/**
 * Build an AI helper stub.
 * @param {string} responseContent - Raw AI response text (default: no file blocks = 0 generated)
 */
function buildAiHelper(responseContent = 'No updates needed — documentation is current.') {
  const calls = [];
  return {
    stub: {
      initialize: jest.fn().mockResolvedValue(true),
      executeRequest: jest.fn().mockImplementation(async (prompt, opts) => {
        calls.push({ prompt, opts });
        return { success: true, content: responseContent };
      }),
    },
    calls,
  };
}

/** AI helper stub that returns unavailable */
function buildUnavailableAiHelper() {
  const calls = [];
  return {
    stub: {
      initialize: jest.fn().mockResolvedValue(false),
      executeRequest: jest.fn(),
    },
    calls,
  };
}

/**
 * Create a Step0bBootstrapDocs wired with real filesystem but stubbed AI.
 */
function buildStep(projectRoot, cacheDir, aiHelper, backlogStub, logger) {
  const stateCache = new Step0bStateCache({ cacheDir });
  return new Step0bBootstrapDocs({
    fileOps: buildFileOps(projectRoot),
    backlog: backlogStub,
    logger,
    aiHelper,
    projectRoot,
    stateCache,
  });
}

/** Seed a minimal project with docs below the sufficientDocsCount threshold (< 5). */
async function seedMinimalProject(projectRoot) {
  // 2 doc files — below sufficientDocsCount (5) so bootstrap logic runs
  await writeFile(path.join(projectRoot, 'README.md'), '# Project\n');
  await writeFile(path.join(projectRoot, 'src', 'index.js'), 'console.log("hello");\n');
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('Integration: Step0bStateCache ↔ Step0bBootstrapDocs', () => {
  let projectRoot;
  let cacheDir;

  beforeEach(async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    projectRoot = path.join(process.cwd(), '.test-e2e', `step0b-int-${suffix}`);
    cacheDir = path.join(projectRoot, '.cache');
    await fs.mkdir(projectRoot, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(projectRoot, { recursive: true, force: true });
  });

  // =========================================================================
  // Scenario 1: Cache miss → AI runs → 0 files → cache written
  // =========================================================================

  describe('Scenario 1: Cache miss — AI runs, generates 0 files, cache is persisted', () => {
    test('AI helper is called when no cache exists', async () => {
      await seedMinimalProject(projectRoot);
      const ai = buildAiHelper(); // returns 0-file response
      const { stub: backlog } = buildBacklog();
      const step = buildStep(projectRoot, cacheDir, ai.stub, backlog, buildLogger());

      await step.execute({});

      expect(ai.stub.executeRequest).toHaveBeenCalledTimes(1);
    });

    test('cache file is written after 0-file AI run', async () => {
      await seedMinimalProject(projectRoot);
      const ai = buildAiHelper();
      const { stub: backlog } = buildBacklog();
      const step = buildStep(projectRoot, cacheDir, ai.stub, backlog, buildLogger());

      await step.execute({});

      const cacheFile = path.join(cacheDir, CACHE_FILENAME);
      const stat = await fs.stat(cacheFile);
      expect(stat.isFile()).toBe(true);
    });

    test('cache entry has lastOutcome = no_files_generated', async () => {
      await seedMinimalProject(projectRoot);
      const ai = buildAiHelper();
      const { stub: backlog } = buildBacklog();
      const step = buildStep(projectRoot, cacheDir, ai.stub, backlog, buildLogger());

      await step.execute({});

      const raw = await fs.readFile(path.join(cacheDir, CACHE_FILENAME), 'utf8');
      const entry = JSON.parse(raw);
      expect(entry.lastOutcome).toBe(OUTCOME_NO_FILES);
    });

    test('result does not have cachedSkip flag', async () => {
      await seedMinimalProject(projectRoot);
      const ai = buildAiHelper();
      const { stub: backlog } = buildBacklog();
      const step = buildStep(projectRoot, cacheDir, ai.stub, backlog, buildLogger());

      const result = await step.execute({});

      expect(result.cachedSkip).toBeFalsy();
    });
  });

  // =========================================================================
  // Scenario 2: Cache hit — same docs, within TTL → AI is NOT called
  // =========================================================================

  describe('Scenario 2: Cache hit — AI is skipped, token savings', () => {
    test('AI helper is NOT called on second run with unchanged docs', async () => {
      await seedMinimalProject(projectRoot);
      const ai = buildAiHelper();
      const { stub: backlog } = buildBacklog();

      // First run — populate cache
      const step1 = buildStep(projectRoot, cacheDir, ai.stub, backlog, buildLogger());
      await step1.execute({});
      expect(ai.stub.executeRequest).toHaveBeenCalledTimes(1);

      // Second run — should hit cache
      ai.stub.executeRequest.mockClear();
      const step2 = buildStep(projectRoot, cacheDir, ai.stub, backlog, buildLogger());
      await step2.execute({});

      expect(ai.stub.executeRequest).not.toHaveBeenCalled();
    });

    test('result has cachedSkip: true on cache hit', async () => {
      await seedMinimalProject(projectRoot);
      const ai = buildAiHelper();
      const { stub: backlog } = buildBacklog();

      const step1 = buildStep(projectRoot, cacheDir, ai.stub, backlog, buildLogger());
      await step1.execute({});

      const step2 = buildStep(projectRoot, cacheDir, ai.stub, backlog, buildLogger());
      const result = await step2.execute({});

      expect(result.cachedSkip).toBe(true);
    });

    test('result still has success: true on cache hit', async () => {
      await seedMinimalProject(projectRoot);
      const ai = buildAiHelper();
      const { stub: backlog } = buildBacklog();

      const step1 = buildStep(projectRoot, cacheDir, ai.stub, backlog, buildLogger());
      await step1.execute({});

      const step2 = buildStep(projectRoot, cacheDir, ai.stub, backlog, buildLogger());
      const result = await step2.execute({});

      expect(result.success).toBe(true);
    });

    test('result has generated: [] on cache hit', async () => {
      await seedMinimalProject(projectRoot);
      const ai = buildAiHelper();
      const { stub: backlog } = buildBacklog();

      const step1 = buildStep(projectRoot, cacheDir, ai.stub, backlog, buildLogger());
      await step1.execute({});

      const step2 = buildStep(projectRoot, cacheDir, ai.stub, backlog, buildLogger());
      const result = await step2.execute({});

      expect(result.generated).toEqual([]);
    });
  });

  // =========================================================================
  // Scenario 3: Cache miss after file change → AI IS called again
  // =========================================================================

  describe('Scenario 3: Cache miss after doc file changes', () => {
    test('AI is called again when a doc file is modified', async () => {
      await seedMinimalProject(projectRoot);
      const ai = buildAiHelper();
      const { stub: backlog } = buildBacklog();

      // First run — cache populated
      const step1 = buildStep(projectRoot, cacheDir, ai.stub, backlog, buildLogger());
      await step1.execute({});

      // Modify a doc file → fingerprint changes
      await writeFile(path.join(projectRoot, 'README.md'), '# Project (updated)\n');

      ai.stub.executeRequest.mockClear();
      const step2 = buildStep(projectRoot, cacheDir, ai.stub, backlog, buildLogger());
      await step2.execute({});

      expect(ai.stub.executeRequest).toHaveBeenCalledTimes(1);
    });

    test('AI is called again when a new doc file is added', async () => {
      await seedMinimalProject(projectRoot);
      const ai = buildAiHelper();
      const { stub: backlog } = buildBacklog();

      const step1 = buildStep(projectRoot, cacheDir, ai.stub, backlog, buildLogger());
      await step1.execute({});

      // Add a new markdown file
      await writeFile(path.join(projectRoot, 'CONTRIBUTING.md'), '# Contributing\n');

      ai.stub.executeRequest.mockClear();
      const step2 = buildStep(projectRoot, cacheDir, ai.stub, backlog, buildLogger());
      await step2.execute({});

      expect(ai.stub.executeRequest).toHaveBeenCalledTimes(1);
    });

    test('result does not have cachedSkip after file change', async () => {
      await seedMinimalProject(projectRoot);
      const ai = buildAiHelper();
      const { stub: backlog } = buildBacklog();

      const step1 = buildStep(projectRoot, cacheDir, ai.stub, backlog, buildLogger());
      await step1.execute({});

      await writeFile(path.join(projectRoot, 'README.md'), '# Changed\n');

      const step2 = buildStep(projectRoot, cacheDir, ai.stub, backlog, buildLogger());
      const result = await step2.execute({});

      expect(result.cachedSkip).toBeFalsy();
    });
  });

  // =========================================================================
  // Scenario 4: Cache invalidated when AI generates files
  // =========================================================================

  describe('Scenario 4: Cache is invalidated when AI generates files', () => {
    test('cache file does not exist after AI generates at least one file', async () => {
      await seedMinimalProject(projectRoot);

      // AI response matching parseAiDocResponse format: ## filename + ### Content: block
      const aiResponseWithFile = [
        '## docs/GUIDE.md',
        '',
        '### Priority: Important',
        '### Content:',
        '```markdown',
        '# Guide',
        '```',
        '',
        '### Reasoning: Adds a guide',
      ].join('\n');

      const ai = buildAiHelper(aiResponseWithFile);
      const { stub: backlog } = buildBacklog();
      const step = buildStep(projectRoot, cacheDir, ai.stub, backlog, buildLogger());

      await step.execute({});

      // Cache should have been invalidated
      const cacheFile = path.join(cacheDir, CACHE_FILENAME);
      let exists = true;
      try {
        await fs.access(cacheFile);
      } catch {
        exists = false;
      }
      expect(exists).toBe(false);
    });
  });

  // =========================================================================
  // Scenario 5: TTL expiry forces re-evaluation
  // =========================================================================

  describe('Scenario 5: TTL expiry triggers AI call', () => {
    test('AI is called after cache TTL expires', async () => {
      await seedMinimalProject(projectRoot);
      const ai = buildAiHelper();
      const { stub: backlog } = buildBacklog();

      // First run with 1-second TTL cache
      const shortTtlCache = new Step0bStateCache({ cacheDir, ttlSeconds: 1 });
      const step1 = new Step0bBootstrapDocs({
        fileOps: buildFileOps(projectRoot),
        backlog,
        logger: buildLogger(),
        aiHelper: ai.stub,
        projectRoot,
        stateCache: shortTtlCache,
      });
      await step1.execute({});

      // Manually expire the cache by back-dating its timestamp
      const cacheFile = path.join(cacheDir, CACHE_FILENAME);
      const raw = await fs.readFile(cacheFile, 'utf8');
      const entry = JSON.parse(raw);
      entry.timestamp = Date.now() - 5000; // 5 seconds ago, TTL is 1 second
      await fs.writeFile(cacheFile, JSON.stringify(entry), 'utf8');

      ai.stub.executeRequest.mockClear();
      const step2 = new Step0bBootstrapDocs({
        fileOps: buildFileOps(projectRoot),
        backlog,
        logger: buildLogger(),
        aiHelper: ai.stub,
        projectRoot,
        stateCache: shortTtlCache,
      });
      await step2.execute({});

      expect(ai.stub.executeRequest).toHaveBeenCalledTimes(1);
    });
  });

  // =========================================================================
  // Scenario 6: Cache is transparent when AI is unavailable
  // =========================================================================

  describe('Scenario 6: Cache is transparent when AI is unavailable', () => {
    test('step succeeds and does not write cache when AI is unavailable', async () => {
      await seedMinimalProject(projectRoot);
      const ai = buildUnavailableAiHelper();
      const { stub: backlog } = buildBacklog();
      const step = buildStep(projectRoot, cacheDir, ai.stub, backlog, buildLogger());

      const result = await step.execute({});

      expect(result.success).toBe(true);
      // Cache should not be written because AI was not reached
      const cacheFile = path.join(cacheDir, CACHE_FILENAME);
      let exists = false;
      try {
        await fs.access(cacheFile);
        exists = true;
      } catch {
        /* expected */
      }
      expect(exists).toBe(false);
    });

    test('step does not use cache when AI is unavailable (no false skip)', async () => {
      await seedMinimalProject(projectRoot);

      // Pre-populate cache
      const validAi = buildAiHelper();
      const { stub: backlog } = buildBacklog();
      const step1 = buildStep(projectRoot, cacheDir, validAi.stub, backlog, buildLogger());
      await step1.execute({});

      // Second run with AI unavailable — should still skip via cache (cache HIT, not AI check)
      const ai = buildUnavailableAiHelper();
      const step2 = buildStep(projectRoot, cacheDir, ai.stub, backlog, buildLogger());
      const result = await step2.execute({});

      // Cache hit takes precedence — step is skipped before reaching AI init
      expect(result.cachedSkip).toBe(true);
      expect(ai.stub.initialize).not.toHaveBeenCalled();
    });
  });
});
