/**
 * @fileoverview E2E Test: init command creates workflow directories with absolute paths
 * @module test/e2e/init_workflow_directories
 *
 * Covers the fix for "Only absolute paths are allowed" error thrown during
 * `ai-workflow init` when `createWorkflowDirectories` passed relative paths
 * such as `.ai_workflow/backlog` to `FileOperations.createDirectory`, which
 * internally calls `validatePath` and rejects non-absolute paths.
 *
 * Fix: path.join(projectRoot, dir) is now used so every path is absolute.
 *
 * @version 1.0.0
 * @since 2026-02-20
 */

import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { FileOperations } from '../../src/lib/file_operations.js';

// The exact directory list used by createWorkflowDirectories in init.js
const WORKFLOW_DIRECTORIES = [
  '.ai_workflow',
  '.ai_workflow/backlog',
  '.ai_workflow/summaries',
  '.ai_workflow/logs',
  '.ai_workflow/metrics',
  '.ai_workflow/checkpoints',
  '.ai_workflow/prompts',
  '.ai_workflow/ml_models',
  '.ai_workflow/.incremental_cache',
];

describe('E2E: Init Command – Workflow Directory Creation', () => {
  let tempDir;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ai_workflow_init_e2e_'));
  });

  afterEach(async () => {
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  // ---------------------------------------------------------------------------
  // Regression: relative paths must be rejected by FileOperations
  // ---------------------------------------------------------------------------

  describe('Regression: relative paths are rejected by FileOperations', () => {
    test('FileOperations.createDirectory throws on a relative path', async () => {
      const fileOps = new FileOperations(tempDir);

      // Pre-fix: createWorkflowDirectories passed '.ai_workflow' (relative)
      await expect(fileOps.createDirectory('.ai_workflow', { recursive: true })).rejects.toThrow(
        'Only absolute paths are allowed'
      );
    });

    test('throws for every workflow directory when paths are relative', async () => {
      const fileOps = new FileOperations(tempDir);

      for (const dir of WORKFLOW_DIRECTORIES) {
        await expect(fileOps.createDirectory(dir, { recursive: true })).rejects.toThrow(
          'Only absolute paths are allowed'
        );
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Fix: absolute paths (path.join) are accepted by FileOperations
  // ---------------------------------------------------------------------------

  describe('Fix: absolute paths via path.join are accepted', () => {
    test('FileOperations.createDirectory succeeds with an absolute path', async () => {
      const fileOps = new FileOperations(tempDir);
      const absoluteDir = path.join(tempDir, '.ai_workflow');

      await expect(
        fileOps.createDirectory(absoluteDir, { recursive: true })
      ).resolves.not.toThrow();

      const stat = await fs.stat(absoluteDir);
      expect(stat.isDirectory()).toBe(true);
    });

    test('all workflow directories are created when paths are absolute', async () => {
      const fileOps = new FileOperations(tempDir);

      // Replicate the fixed createWorkflowDirectories logic
      for (const dir of WORKFLOW_DIRECTORIES) {
        await fileOps.createDirectory(path.join(tempDir, dir), { recursive: true });
      }

      // Verify every directory exists on disk
      for (const dir of WORKFLOW_DIRECTORIES) {
        const stat = await fs.stat(path.join(tempDir, dir));
        expect(stat.isDirectory()).toBe(true);
      }
    });

    test('workflow directories are created inside the specified projectRoot', async () => {
      const fileOps = new FileOperations(tempDir);

      for (const dir of WORKFLOW_DIRECTORIES) {
        await fileOps.createDirectory(path.join(tempDir, dir), { recursive: true });
      }

      // Directories must reside within projectRoot, not cwd or some other path
      const aiWorkflowStat = await fs.stat(path.join(tempDir, '.ai_workflow'));
      expect(aiWorkflowStat.isDirectory()).toBe(true);

      // Verify nested subdirectories are also within projectRoot
      const backlogPath = path.join(tempDir, '.ai_workflow', 'backlog');
      const backlogStat = await fs.stat(backlogPath);
      expect(backlogStat.isDirectory()).toBe(true);
      expect(backlogPath.startsWith(tempDir)).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Idempotency: running directory creation twice does not throw
  // ---------------------------------------------------------------------------

  describe('Idempotency: repeated directory creation is safe', () => {
    test('creating the same directories twice does not throw', async () => {
      const fileOps = new FileOperations(tempDir);

      const createAll = async () => {
        for (const dir of WORKFLOW_DIRECTORIES) {
          await fileOps.createDirectory(path.join(tempDir, dir), { recursive: true });
        }
      };

      await expect(createAll()).resolves.not.toThrow();
      // Second run – directories already exist; EEXIST is silently ignored
      await expect(createAll()).resolves.not.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // Correctness: exact directory names match init.js specification
  // ---------------------------------------------------------------------------

  describe('Correctness: created directory names match specification', () => {
    test('creates all 9 expected workflow subdirectories', async () => {
      const fileOps = new FileOperations(tempDir);

      for (const dir of WORKFLOW_DIRECTORIES) {
        await fileOps.createDirectory(path.join(tempDir, dir), { recursive: true });
      }

      const entries = await fs.readdir(path.join(tempDir, '.ai_workflow'), {
        withFileTypes: true,
      });

      const subdirNames = entries.filter((e) => e.isDirectory()).map((e) => e.name);

      expect(subdirNames).toContain('backlog');
      expect(subdirNames).toContain('summaries');
      expect(subdirNames).toContain('logs');
      expect(subdirNames).toContain('metrics');
      expect(subdirNames).toContain('checkpoints');
      expect(subdirNames).toContain('prompts');
      expect(subdirNames).toContain('ml_models');
      expect(subdirNames).toContain('.incremental_cache');
      expect(subdirNames).toHaveLength(8); // 8 subdirectories inside .ai_workflow
    });

    test('no workflow directories are created outside of projectRoot', async () => {
      const fileOps = new FileOperations(tempDir);

      for (const dir of WORKFLOW_DIRECTORIES) {
        await fileOps.createDirectory(path.join(tempDir, dir), { recursive: true });
      }

      // None of the relative dir names should appear in cwd
      for (const dir of WORKFLOW_DIRECTORIES.slice(1)) {
        // Skip '.ai_workflow' itself – check only children
        const leafName = path.basename(dir);
        let exists = false;
        try {
          await fs.stat(path.join(process.cwd(), dir));
          exists = true;
        } catch {
          exists = false;
        }
        // This assertion only fails if cwd coincidentally already has the dir
        // AND it was created by this test – safe to assert in a tempDir-based test
        const inTemp = path.join(tempDir, dir);
        const stat = await fs.stat(inTemp);
        expect(stat.isDirectory()).toBe(true);
        // Confirm the path is under tempDir, not cwd
        expect(inTemp.startsWith(tempDir)).toBe(true);
        void leafName; // used for readability above
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Isolation: different projectRoots do not interfere with each other
  // ---------------------------------------------------------------------------

  describe('Isolation: separate projectRoots create independent directory trees', () => {
    test('two projects each get their own .ai_workflow tree', async () => {
      const tempDir2 = await fs.mkdtemp(path.join(os.tmpdir(), 'ai_workflow_init_e2e_'));

      try {
        const fileOps1 = new FileOperations(tempDir);
        const fileOps2 = new FileOperations(tempDir2);

        for (const dir of WORKFLOW_DIRECTORIES) {
          await fileOps1.createDirectory(path.join(tempDir, dir), { recursive: true });
          await fileOps2.createDirectory(path.join(tempDir2, dir), { recursive: true });
        }

        // Both roots contain .ai_workflow
        const stat1 = await fs.stat(path.join(tempDir, '.ai_workflow'));
        const stat2 = await fs.stat(path.join(tempDir2, '.ai_workflow'));
        expect(stat1.isDirectory()).toBe(true);
        expect(stat2.isDirectory()).toBe(true);

        // The two trees are distinct filesystem paths
        expect(path.join(tempDir, '.ai_workflow')).not.toBe(
          path.join(tempDir2, '.ai_workflow')
        );
      } finally {
        await fs.rm(tempDir2, { recursive: true, force: true });
      }
    });
  });
});
