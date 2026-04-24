/**
 * @fileoverview Integration (E2E) tests for Step 2: Documentation Consistency Analysis
 *
 * These tests exercise Step2ConsistencyAnalyzer.execute() against a real
 * temporary filesystem to verify:
 *  1. Full execute() flow with real file discovery, version checking, and link validation
 *  2. Version inconsistency detection across multiple real doc files
 *  3. Broken internal link detection with real file index
 *  4. Clean pass when all links resolve and versions match
 *  5. Graceful handling when no documentation exists on disk
 *  6. Orchestrator-style instantiation (execute() method contract)
 *  7. Report persistence via backlog.saveStepSummary
 *
 * @group integration
 * @group e2e
 */

import { Step2ConsistencyAnalyzer } from '../../src/steps/step_02_consistency.js';
import {
  createConsistentDocumentationProject,
  createStep2ConsistencyHarness,
  createTemporaryProjectRoot,
  executeViaOrchestrator,
  removeTemporaryProjectRoot,
  runStep2Consistency,
  seedProjectFiles,
} from './step_02_consistency_integration_harness.js';

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('Integration: Step2ConsistencyAnalyzer', () => {
  let projectRoot;
  const analyzeProject = () => runStep2Consistency(projectRoot);

  beforeEach(async () => {
    projectRoot = await createTemporaryProjectRoot();
  });

  afterEach(async () => {
    await removeTemporaryProjectRoot(projectRoot);
  });

  // =========================================================================
  // 1. Method contract
  // =========================================================================

  describe('Step2ConsistencyAnalyzer.execute() — method contract', () => {
    test('execute() exists on the prototype', () => {
      const { analyzer } = createStep2ConsistencyHarness(projectRoot);
      expect(typeof analyzer.execute).toBe('function');
    });

    test('execute() returns a Promise', () => {
      const { analyzer } = createStep2ConsistencyHarness(projectRoot);
      const result = analyzer.execute(projectRoot);
      expect(result).toBeInstanceOf(Promise);
      return result;
    });

    test('execute() result always has a success property', async () => {
      const { result } = await analyzeProject();
      expect(result).toHaveProperty('success');
      expect(typeof result.success).toBe('boolean');
    });
  });

  // =========================================================================
  // 2. No documentation present
  // =========================================================================

  describe('Empty project — no documentation files', () => {
    test('skips gracefully when no markdown files exist', async () => {
      const { result } = await analyzeProject();

      expect(result.success).toBe(true);
      expect(result.skipped).toBe(true);
      expect(result.reason).toBe('no_docs');
    });

    test('does not write a backlog report when skipped', async () => {
      const { backlogCalls } = await analyzeProject();

      expect(backlogCalls).toHaveLength(0);
    });
  });

  // =========================================================================
  // 3. Clean project — all links valid, versions consistent
  // =========================================================================

  describe('Clean project — no issues', () => {
    beforeEach(async () => {
      await createConsistentDocumentationProject(projectRoot);
    });

    test('reports zero total issues', async () => {
      const { result } = await analyzeProject();

      expect(result.success).toBe(true);
      expect(result.totalIssues).toBe(0);
    });

    test('reports zero broken links', async () => {
      const { result } = await analyzeProject();

      expect(result.brokenLinks).toHaveLength(0);
    });

    test('reports zero version issues', async () => {
      const { result } = await analyzeProject();

      expect(result.versionIssues).toHaveLength(0);
    });

    test('reports the correct number of files checked', async () => {
      const { result } = await analyzeProject();

      // README.md and docs/guide.md (package.json is not a doc)
      expect(result.filesChecked).toBeGreaterThanOrEqual(2);
    });

    test('saves a report to the backlog', async () => {
      const { backlogCalls } = await analyzeProject();

      expect(backlogCalls).toHaveLength(1);
      expect(backlogCalls[0].step).toBe(2);
      expect(backlogCalls[0].content).toContain('Step 2');
      expect(backlogCalls[0].content).toContain('✅');
    });
  });

  // =========================================================================
  // 4. Version inconsistency detection
  // =========================================================================

  describe('Version inconsistency detection', () => {
    test('detects stale version in a doc file', async () => {
      await seedProjectFiles(projectRoot, {
        'package.json': JSON.stringify({ version: '2.0.0' }),
        'README.md': '# Project\n\nVersion 1.0.0\n',
      });

      const { result } = await analyzeProject();

      expect(result.success).toBe(true);
      expect(result.versionIssues.length).toBeGreaterThan(0);
      const issue = result.versionIssues[0];
      expect(issue.found).toBe('1.0.0');
      expect(issue.expected).toBe('2.0.0');
    });

    test('detects version mismatches across multiple files', async () => {
      await seedProjectFiles(projectRoot, {
        'package.json': JSON.stringify({ version: '3.0.0' }),
        'README.md': '# Project v1.0.0\n',
        'CHANGELOG.md': '## Release 2.0.0\n',
      });

      const { result } = await analyzeProject();

      expect(result.versionIssues.length).toBeGreaterThanOrEqual(2);
    });

    test('accepts v-prefixed version matching package.json', async () => {
      await seedProjectFiles(projectRoot, {
        'package.json': JSON.stringify({ version: '1.6.3' }),
        'README.md': '# Project v1.6.3\n',
      });

      const { result } = await analyzeProject();

      expect(result.versionIssues).toHaveLength(0);
    });

    test('skips version check when package.json is absent', async () => {
      await seedProjectFiles(projectRoot, {
        'README.md': '# Project\n\nVersion 1.0.0\n',
      });

      const { result } = await analyzeProject();

      expect(result.versionIssues).toHaveLength(0);
    });
  });

  // =========================================================================
  // 5. Broken link detection
  // =========================================================================

  describe('Broken link detection', () => {
    test('detects a link to a non-existent file', async () => {
      await seedProjectFiles(projectRoot, {
        'README.md': '# Project\n\nSee [missing guide](docs/missing.md) for details.\n',
      });

      const { result } = await analyzeProject();

      expect(result.brokenLinks.length).toBeGreaterThan(0);
      expect(result.brokenLinks[0].link).toBe('docs/missing.md');
    });

    test('resolves valid relative links correctly', async () => {
      await seedProjectFiles(projectRoot, {
        'README.md': '# Project\n\nSee [guide](docs/guide.md).\n',
        'docs/guide.md': '# Guide\n',
      });

      const { result } = await analyzeProject();

      expect(result.brokenLinks).toHaveLength(0);
    });

    test.each([
      {
        caseName: 'external https links',
        readmeContent: '# Project\n\nVisit [our site](https://example.com) for details.\n',
      },
      {
        caseName: 'anchor-only links',
        readmeContent: '# Project\n\nSee [section](#installation) below.\n',
      },
    ])('ignores $caseName', async ({ readmeContent }) => {
      await seedProjectFiles(projectRoot, {
        'README.md': readmeContent,
      });

      const { result } = await analyzeProject();

      expect(result.brokenLinks).toHaveLength(0);
    });

    test('detects multiple broken links across files', async () => {
      await seedProjectFiles(projectRoot, {
        'README.md': '[broken1](nowhere/a.md)\n[broken2](nowhere/b.md)\n',
        'CONTRIBUTING.md': '[broken3](nowhere/c.md)\n',
      });

      const { result } = await analyzeProject();

      expect(result.brokenLinks.length).toBeGreaterThanOrEqual(3);
    });
  });

  // =========================================================================
  // 6. Report content
  // =========================================================================

  describe('Report content', () => {
    test('report contains issue summary counts', async () => {
      await seedProjectFiles(projectRoot, {
        'package.json': JSON.stringify({ version: '1.0.0' }),
        'README.md': '[broken](missing.md)\n\nVersion 2.0.0\n',
      });

      const { backlogCalls } = await analyzeProject();
      const report = backlogCalls[0].content;
      expect(report).toContain('Files checked');
      expect(report).toContain('Total issues');
      expect(report).toContain('⚠️');
    });

    test('report shows ✅ when no issues found', async () => {
      await seedProjectFiles(projectRoot, {
        'README.md': '# Clean project with no links or versions.\n',
      });

      const { backlogCalls } = await analyzeProject();
      expect(backlogCalls[0].content).toContain('✅');
    });
  });

  // =========================================================================
  // 7. Orchestrator-style integration
  // =========================================================================

  describe('Orchestrator-style instantiation', () => {
    test('does not throw "does not have an execute method"', async () => {
      await expect(
        executeViaOrchestrator(Step2ConsistencyAnalyzer, {}, projectRoot)
      ).resolves.toBeDefined();
    });

    test('orchestrator-style result has success property', async () => {
      const result = await executeViaOrchestrator(Step2ConsistencyAnalyzer, {}, projectRoot);
      expect(result).toHaveProperty('success');
    });

    test('execute() with undefined projectRoot does not throw', async () => {
      const analyzer = new Step2ConsistencyAnalyzer({
        aiHelper: { initialize: () => Promise.resolve(false) },
      });
      await expect(analyzer.execute(undefined)).resolves.toHaveProperty('success');
    });
  });
});
