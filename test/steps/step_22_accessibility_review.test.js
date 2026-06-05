/**
 * @fileoverview Tests for step_22_accessibility_review module
 * @module test/steps/step_22_accessibility_review.test
 */

import { jest } from '@jest/globals';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import {
  buildAccessibilityFileContentsBlock,
  buildAccessibilityPromptPartitions,
  filterAccessibilityReviewTargets,
  isAccessibleProject,
  isAccessibilityReviewTarget,
  scoreAccessibilityIssues,
  splitAccessibilityPromptEntry,
  formatAccessibilityReport,
  buildAccessibilityConsolidationPrompt,
  MAX_PROMPT_ENTRY_CHARS,
  STEP_DEFINITION,
  Step22AccessibilityReview,
} from '../../src/steps/step_22_accessibility_review.js';
import { STEP_KIND } from '../../src/steps/step_contract.js';

// =============================================================================
// PURE FUNCTION TESTS
// =============================================================================

describe('step_22_accessibility_review - Pure Functions', () => {
  // -------------------------------------------------------------------------
  // isAccessibleProject
  // -------------------------------------------------------------------------

  describe('isAccessibleProject', () => {
    test('returns true for .html files', () => {
      expect(isAccessibleProject(['src/index.html'])).toBe(true);
    });

    test('returns true for .htm files', () => {
      expect(isAccessibleProject(['src/page.htm'])).toBe(true);
    });

    test('returns true for .vue files', () => {
      expect(isAccessibleProject(['src/App.vue'])).toBe(true);
    });

    test('returns true for .jsx files', () => {
      expect(isAccessibleProject(['src/Button.jsx'])).toBe(true);
    });

    test('returns true for .tsx files', () => {
      expect(isAccessibleProject(['src/Modal.tsx'])).toBe(true);
    });

    test('returns true for .css files', () => {
      expect(isAccessibleProject(['src/styles.css'])).toBe(true);
    });

    test('returns false for non-UI files only', () => {
      expect(isAccessibleProject(['README.md', 'package.json', 'src/index.ts'])).toBe(false);
    });

    test('returns false for empty array', () => {
      expect(isAccessibleProject([])).toBe(false);
    });

    test('returns true for mixed list containing a .vue file', () => {
      expect(isAccessibleProject(['README.md', 'src/App.vue'])).toBe(true);
    });

    test('is case-insensitive for extensions', () => {
      expect(isAccessibleProject(['src/Page.HTML'])).toBe(true);
    });
  });

  describe('isAccessibilityReviewTarget', () => {
    test('accepts real UI source files', () => {
      expect(isAccessibilityReviewTarget('src/index.html')).toBe(true);
      expect(isAccessibilityReviewTarget('src/App.tsx')).toBe(true);
      expect(isAccessibilityReviewTarget('src/styles.css')).toBe(true);
    });

    test('rejects workflow artifacts and generated docs output', () => {
      expect(isAccessibilityReviewTarget('.ai_workflow/logs/run.html')).toBe(false);
      expect(isAccessibilityReviewTarget('docs/api/html/classes/AiCache.html')).toBe(false);
      expect(isAccessibilityReviewTarget('docs/api/html/assets/style.css')).toBe(false);
    });

    test('rejects unit-test paths and test-style filenames', () => {
      expect(isAccessibilityReviewTarget('__tests__/components/App.test.vue')).toBe(false);
      expect(isAccessibilityReviewTarget('test/components/App.test.vue')).toBe(false);
      expect(isAccessibilityReviewTarget('src/components/App.spec.tsx')).toBe(false);
    });
  });

  describe('filterAccessibilityReviewTargets', () => {
    test('deduplicates and filters unsupported files', () => {
      expect(
        filterAccessibilityReviewTargets([
          'src/index.html',
          'src/index.html',
          '.ai_workflow/logs/run.html',
          'docs/api/html/classes/AiCache.html',
          'src/App.tsx',
          'test/components/App.test.vue',
          'README.md',
        ])
      ).toEqual(['src/index.html', 'src/App.tsx']);
    });
  });

  // -------------------------------------------------------------------------
  // scoreAccessibilityIssues
  // -------------------------------------------------------------------------

  describe('scoreAccessibilityIssues', () => {
    test('returns zero scores for empty contents', () => {
      const scores = scoreAccessibilityIssues([]);
      expect(scores.missingAltCount).toBe(0);
      expect(scores.keyboardTrapRisk).toBe(0);
      expect(scores.missingAriaCount).toBe(0);
      expect(scores.missingReducedMotionCount).toBe(0);
      expect(scores.totalIssues).toBe(0);
    });

    test('returns zero scores for empty string', () => {
      const scores = scoreAccessibilityIssues(['']);
      expect(scores.totalIssues).toBe(0);
    });

    test('counts images missing alt attribute', () => {
      const html = '<img src="a.png"><img src="b.png" alt="desc"><img src="c.png">';
      const scores = scoreAccessibilityIssues([html]);
      expect(scores.missingAltCount).toBe(2);
    });

    test('does not count images that have alt attribute', () => {
      const html = '<img src="a.png" alt=""><img src="b.png" alt="photo">';
      const scores = scoreAccessibilityIssues([html]);
      expect(scores.missingAltCount).toBe(0);
    });

    test('counts onclick keyboard accessibility risks', () => {
      const html = '<div onclick="handler()">click</div><span onclick="other()">x</span>';
      const scores = scoreAccessibilityIssues([html]);
      expect(scores.keyboardTrapRisk).toBeGreaterThanOrEqual(2);
    });

    test('counts tabindex=-1 risks', () => {
      const html = '<div tabindex="-1">hidden</div><button tabindex="-1">btn</button>';
      const scores = scoreAccessibilityIssues([html]);
      expect(scores.keyboardTrapRisk).toBeGreaterThanOrEqual(2);
    });

    test('counts interactive elements missing ARIA labels', () => {
      const html = '<button>Submit</button><input type="text"><select></select>';
      const scores = scoreAccessibilityIssues([html]);
      // 3 interactive, 0 aria-label → missingAriaCount = 3
      expect(scores.missingAriaCount).toBe(3);
    });

    test('subtracts aria-label from interactive element count', () => {
      const html = '<button aria-label="Close">X</button><input aria-labelledby="lbl">';
      const scores = scoreAccessibilityIssues([html]);
      expect(scores.missingAriaCount).toBe(0);
    });

    test('counts animations without prefers-reduced-motion', () => {
      const css = '.spinner { animation: spin 1s; } .fade { transition: opacity 0.3s; }';
      const scores = scoreAccessibilityIssues([css]);
      expect(scores.missingReducedMotionCount).toBe(2);
    });

    test('reduces missingReducedMotionCount when prefers-reduced-motion guard is present', () => {
      // The heuristic counts all animation: occurrences (including the one inside the @media rule)
      // so with 2 animation: declarations and 1 prefers-reduced-motion, result is max(0, 2-1) = 1
      const css = `
.spinner { animation: spin 1s; }
@media (prefers-reduced-motion: reduce) { .spinner { animation: none; } }
      `;
      const scores = scoreAccessibilityIssues([css]);
      // Guard is present, so count is reduced (not necessarily zero due to the inner animation: none)
      expect(scores.missingReducedMotionCount).toBeLessThan(2);
    });

    test('totalIssues is the sum of all individual counts', () => {
      const html = '<img src="x.png"><button>Click</button>';
      const scores = scoreAccessibilityIssues([html]);
      expect(scores.totalIssues).toBe(
        scores.missingAltCount +
          scores.keyboardTrapRisk +
          scores.missingAriaCount +
          scores.missingReducedMotionCount
      );
    });

    test('processes multiple file contents together', () => {
      const file1 = '<img src="a.png">';
      const file2 = '<img src="b.png">';
      const scores = scoreAccessibilityIssues([file1, file2]);
      expect(scores.missingAltCount).toBe(2);
    });

    test('aggregates counts per file without requiring a combined buffer', () => {
      const file1 = '<img src="a.png"><button>Submit</button>';
      const file2 = '<div onclick="handler()">click</div>';
      const file3 = '.spinner { animation: spin 1s; }';
      const scores = scoreAccessibilityIssues([file1, file2, file3]);

      expect(scores).toEqual({
        missingAltCount: 1,
        keyboardTrapRisk: 1,
        missingAriaCount: 1,
        missingReducedMotionCount: 1,
        totalIssues: 4,
      });
    });
  });

  // -------------------------------------------------------------------------
  // Prompt partition helpers
  // -------------------------------------------------------------------------

  describe('splitAccessibilityPromptEntry', () => {
    test('keeps small files as a single prompt entry', () => {
      const entries = splitAccessibilityPromptEntry({
        relativePath: 'src/App.tsx',
        content: 'export function App() { return <div />; }\n',
      });

      expect(entries).toEqual([
        {
          relativePath: 'src/App.tsx',
          sourcePath: 'src/App.tsx',
          content: 'export function App() { return <div />; }\n',
        },
      ]);
    });

    test('splits oversized files into labeled parts instead of truncating them', () => {
      const content = Array.from({ length: 1200 }, (_, index) => `line ${index}`).join('\n');
      const entries = splitAccessibilityPromptEntry(
        {
          relativePath: 'src/large.css',
          content,
        },
        1000
      );

      expect(entries.length).toBeGreaterThan(1);
      expect(entries[0].relativePath).toBe('src/large.css (part 1/11)');
      expect(entries.at(-1)?.relativePath).toBe('src/large.css (part 11/11)');
      expect(entries.map((entry) => entry.content).join('\n')).toBe(content);
    });
  });

  describe('buildAccessibilityPromptPartitions', () => {
    test('partitions source files into multiple prompt-safe batches', () => {
      const fileEntries = Array.from({ length: 5 }, (_, index) => ({
        relativePath: `src/file${index}.html`,
        content: `<div>file ${index}</div>\n`,
      }));

      const partitions = buildAccessibilityPromptPartitions(
        fileEntries,
        10_000,
        MAX_PROMPT_ENTRY_CHARS
      );

      expect(partitions).toHaveLength(2);
      expect(partitions[0].scopePaths).toEqual([
        'src/file0.html',
        'src/file1.html',
        'src/file2.html',
        'src/file3.html',
      ]);
      expect(partitions[1].scopePaths).toEqual(['src/file4.html']);
    });

    describe('buildAccessibilityConsolidationPrompt', () => {
      test('includes partition findings and fully covered split-file context', () => {
        const prompt = buildAccessibilityConsolidationPrompt({
          projectName: 'demo',
          projectDescription: 'UI application',
          framework: 'react',
          totalFileCount: 6,
          readableFileCount: 4,
          completeSplitEntries: [
            { relativePath: 'src/App.tsx', content: 'export function App() { return null; }\n' },
          ],
          incompleteSplitSourcePaths: ['src/Modal.tsx'],
          partitionAnalyses: ['#### Partition 1 of 2\n\nAccessibility findings'],
        });

        expect(prompt).toContain('Consolidate the partition findings below');
        expect(prompt).toContain('src/App.tsx');
        expect(prompt).toContain('src/Modal.tsx');
        expect(prompt).toContain('Accessibility findings');
      });
    });
  });

  describe('buildAccessibilityFileContentsBlock', () => {
    test('renders part labels without a truncation marker', () => {
      const block = buildAccessibilityFileContentsBlock([
        {
          relativePath: 'src/large.css (part 1/2)',
          sourcePath: 'src/large.css',
          content: '.button { color: red; }\n',
        },
      ]);

      expect(block).toContain('### `src/large.css (part 1/2)`');
      expect(block).not.toContain('...(truncated — remainder omitted)');
    });
  });

  // -------------------------------------------------------------------------
  // formatAccessibilityReport
  // -------------------------------------------------------------------------

  describe('formatAccessibilityReport', () => {
    const sampleScores = {
      missingAltCount: 3,
      keyboardTrapRisk: 1,
      missingAriaCount: 5,
      missingReducedMotionCount: 2,
      totalIssues: 11,
    };

    test('contains the Accessibility Review heading', () => {
      const report = formatAccessibilityReport('AI findings', sampleScores);
      expect(report).toContain('## Accessibility Review');
    });

    test('contains the Heuristic Pre-scan section', () => {
      const report = formatAccessibilityReport('AI findings', sampleScores);
      expect(report).toContain('### Heuristic Pre-scan');
    });

    test('contains the AI Analysis section', () => {
      const report = formatAccessibilityReport('AI findings', sampleScores);
      expect(report).toContain('### AI Analysis');
    });

    test('includes correct missingAltCount in table', () => {
      const report = formatAccessibilityReport('', sampleScores);
      expect(report).toContain('| Images missing alt attribute (WCAG 1.1.1) | 3 |');
    });

    test('includes correct keyboardTrapRisk in table', () => {
      const report = formatAccessibilityReport('', sampleScores);
      expect(report).toContain('| Keyboard accessibility risks (onclick/tabindex=-1) | 1 |');
    });

    test('includes correct missingAriaCount in table', () => {
      const report = formatAccessibilityReport('', sampleScores);
      expect(report).toContain('| Interactive elements missing ARIA labels (WCAG 4.1.2) | 5 |');
    });

    test('includes correct missingReducedMotionCount in table', () => {
      const report = formatAccessibilityReport('', sampleScores);
      expect(report).toContain('| Animations without reduced-motion guard (WCAG 2.3.3) | 2 |');
    });

    test('includes total issues in bold', () => {
      const report = formatAccessibilityReport('', sampleScores);
      expect(report).toContain('**11**');
    });

    test('includes AI content when provided', () => {
      const report = formatAccessibilityReport('WCAG violations found', sampleScores);
      expect(report).toContain('WCAG violations found');
    });

    test('shows fallback message when aiContent is empty', () => {
      const report = formatAccessibilityReport('', sampleScores);
      expect(report).toContain('_No AI analysis available._');
    });

    test('shows fallback message when aiContent is null-ish empty string', () => {
      const report = formatAccessibilityReport('', {
        ...sampleScores,
        totalIssues: 0,
        missingAltCount: 0,
        keyboardTrapRisk: 0,
        missingAriaCount: 0,
        missingReducedMotionCount: 0,
      });
      expect(report).toContain('_No AI analysis available._');
    });
  });

  // -------------------------------------------------------------------------
  // STEP_DEFINITION
  // -------------------------------------------------------------------------

  describe('STEP_DEFINITION', () => {
    test('has id step_22', () => {
      expect(STEP_DEFINITION.id).toBe('step_22');
    });

    test('has name Accessibility Review', () => {
      expect(STEP_DEFINITION.name).toBe('Accessibility Review');
    });

    test('has ANALYSIS kind', () => {
      expect(STEP_DEFINITION.kind).toBe(STEP_KIND.ANALYSIS);
    });

    test('depends on step_21', () => {
      expect(STEP_DEFINITION.dependencies).toContain('step_21');
    });

    test('has a non-empty description', () => {
      expect(typeof STEP_DEFINITION.description).toBe('string');
      expect(STEP_DEFINITION.description.length).toBeGreaterThan(0);
    });
  });
});

// =============================================================================
// IMPURE WRAPPER TESTS (mocked dependencies)
// =============================================================================

describe('Step22AccessibilityReview - Wrapper', () => {
  const makeFileOps = (
    files = ['src/index.html', 'src/App.vue'],
    content = '<button>Click</button>'
  ) => ({
    listDirectoryRecursive: jest.fn().mockResolvedValue(files),
    readFile: jest.fn().mockImplementation((p) => {
      if (p.endsWith('ai_helpers.yaml') || p.includes('ai_helpers')) {
        return Promise.resolve(
          'accessibility_review_prompt:\n' +
            '  role_ref: accessibility_expert\n' +
            '  task_template: |\n' +
            '    {partition_header}\n' +
            '    Project: {project_name}\n' +
            '    Project Summary: {project_summary}\n' +
            '    Framework: {framework}\n' +
            '    Files: {source_file_count}\n' +
            '    Paths: {file_paths}\n' +
            '    {partition_scope_note}\n' +
            '    **File Contents (sampled source excerpts):**\n' +
            '    {file_content_block}\n' +
            '  approach: "review approach"'
        );
      }
      if (p.endsWith('prompt_roles.yaml') || p.includes('prompt_roles')) {
        return Promise.resolve('roles: {}');
      }
      return Promise.resolve(content);
    }),
  });

  const makeBacklog = () => ({
    saveStepSummary: jest.fn().mockResolvedValue(undefined),
  });

  const makeAiHelper = (content = 'Accessibility findings') => ({
    initialize: jest.fn().mockResolvedValue(true),
    executeRequest: jest.fn().mockResolvedValue({ content }),
  });

  const makeAiCache = () => ({
    init: jest.fn().mockResolvedValue(undefined),
    withCache: jest.fn().mockImplementation(async (_prompt, _context, aiFunction) => aiFunction()),
  });

  test('skips gracefully when no HTML/UI files found', async () => {
    const fileOps = makeFileOps([]);
    const step = new Step22AccessibilityReview({
      fileOps,
      backlog: makeBacklog(),
      aiHelper: makeAiHelper(),
      aiCache: makeAiCache(),
    });

    const result = await step.execute('/project');
    expect(result.success).toBe(true);
    expect(result.skipped).toBe(true);
    expect(result.message).toContain('No HTML/UI files');
  });

  test('skips when only non-UI files are present', async () => {
    const fileOps = makeFileOps(['README.md', 'src/index.ts', 'package.json']);
    const step = new Step22AccessibilityReview({
      fileOps,
      backlog: makeBacklog(),
      aiHelper: makeAiHelper(),
      aiCache: makeAiCache(),
    });

    const result = await step.execute('/project');
    expect(result.skipped).toBe(true);
  });

  test('skips generated docs and workflow artifacts when scanning for accessibility targets', async () => {
    const fileOps = makeFileOps([
      'docs/api/html/classes/AiCache.html',
      'docs/api/html/assets/style.css',
      '.ai_workflow/logs/rendered.html',
    ]);
    const step = new Step22AccessibilityReview({
      fileOps,
      backlog: makeBacklog(),
      aiHelper: makeAiHelper(),
      aiCache: makeAiCache(),
    });

    const result = await step.execute('/project');
    expect(result.skipped).toBe(true);
    expect(result.message).toContain('No HTML/UI files');
  });

  test('executes successfully when HTML/UI files are present', async () => {
    const step = new Step22AccessibilityReview({
      fileOps: makeFileOps(),
      backlog: makeBacklog(),
      aiHelper: makeAiHelper(),
      aiCache: makeAiCache(),
    });

    const result = await step.execute('/project');
    expect(result.success).toBe(true);
    expect(result.skipped).toBe(false);
  });

  test('calls saveStepSummary with step number 22', async () => {
    const backlog = makeBacklog();
    const step = new Step22AccessibilityReview({
      fileOps: makeFileOps(),
      backlog,
      aiHelper: makeAiHelper(),
      aiCache: makeAiCache(),
    });

    await step.execute('/project');
    expect(backlog.saveStepSummary).toHaveBeenCalledWith(
      22,
      'Accessibility Review',
      expect.any(String)
    );
  });

  test('result includes fileCount, scores, and report', async () => {
    const step = new Step22AccessibilityReview({
      fileOps: makeFileOps(),
      backlog: makeBacklog(),
      aiHelper: makeAiHelper(),
      aiCache: makeAiCache(),
    });

    const result = await step.execute('/project');
    expect(typeof result.fileCount).toBe('number');
    expect(result.scores).toBeDefined();
    expect(typeof result.report).toBe('string');
  });

  test('handles AI unavailable gracefully', async () => {
    const aiHelper = {
      initialize: jest.fn().mockResolvedValue(false),
      executeRequest: jest.fn(),
    };
    const step = new Step22AccessibilityReview({
      fileOps: makeFileOps(),
      backlog: makeBacklog(),
      aiHelper,
      aiCache: makeAiCache(),
    });

    const result = await step.execute('/project');
    expect(result.success).toBe(true);
    expect(aiHelper.executeRequest).not.toHaveBeenCalled();
  });

  test('handles AI errors gracefully (does not throw)', async () => {
    const aiHelper = {
      initialize: jest.fn().mockResolvedValue(true),
      executeRequest: jest.fn().mockRejectedValue(new Error('AI timeout')),
    };
    const step = new Step22AccessibilityReview({
      fileOps: makeFileOps(),
      backlog: makeBacklog(),
      aiHelper,
      aiCache: makeAiCache(),
    });

    const result = await step.execute('/project');
    expect(result.success).toBe(true);
  });

  test('uses cached AI response when available', async () => {
    const aiHelper = makeAiHelper();
    const aiCache = {
      init: jest.fn().mockResolvedValue(undefined),
      withCache: jest.fn().mockResolvedValue('cached accessibility report'),
    };
    const step = new Step22AccessibilityReview({
      fileOps: makeFileOps(),
      backlog: makeBacklog(),
      aiHelper,
      aiCache,
    });

    await step.execute('/project');
    expect(aiHelper.executeRequest).not.toHaveBeenCalled();
  });

  test('accepts sourceFiles override via options', async () => {
    const fileOps = makeFileOps();
    const step = new Step22AccessibilityReview({
      fileOps,
      backlog: makeBacklog(),
      aiHelper: makeAiHelper(),
      aiCache: makeAiCache(),
    });

    await step.execute('/project', { sourceFiles: ['custom/page.html'] });
    expect(fileOps.listDirectoryRecursive).not.toHaveBeenCalled();
  });

  test('uses changed HTML/UI files since the last successful workflow execution when git metadata is available', async () => {
    const workflowDir = await fs.mkdtemp(path.join(os.tmpdir(), 'step22-success-scope-'));
    try {
      await fs.writeFile(
        path.join(workflowDir, 'commit_history.json'),
        JSON.stringify(
          {
            version: '1.0.0',
            lastRunCommit: 'aaaaaaa',
            runs: [
              {
                hash: 'aaaaaaa',
                runId: 'workflow_20260414_225733',
                timestamp: new Date(2026, 3, 10, 10, 5, 0).toISOString(),
              },
            ],
          },
          null,
          2
        ),
        'utf8'
      );

      const gitOps = {
        getChangedFilesSince: jest.fn().mockReturnValue([
          { file: 'src/page.html', status: 'modified' },
          { file: 'README.md', status: 'modified' },
        ]),
        status: jest.fn().mockResolvedValue({
          staged: [],
          unstaged: [{ file: 'src/extra.css', status: 'modified' }],
          untracked: [{ file: 'notes.txt', status: 'untracked' }],
        }),
      };
      const fileOps = makeFileOps(['src/ignored-by-full-scan.html']);
      const step = new Step22AccessibilityReview({
        fileOps,
        backlog: makeBacklog(),
        aiHelper: makeAiHelper(),
        aiCache: makeAiCache(),
        gitOps,
      });

      const result = await step.execute('/project', {
        workflowDir,
        workflowRunId: 'workflow_20260415_003447',
      });

      expect(result.success).toBe(true);
      expect(result.fileCount).toBe(2);
      expect(gitOps.getChangedFilesSince).toHaveBeenCalledWith('aaaaaaa');
      expect(fileOps.listDirectoryRecursive).not.toHaveBeenCalled();
    } finally {
      await fs.rm(workflowDir, { recursive: true, force: true });
    }
  });

  test('skips when no HTML/UI files changed since the last successful workflow execution', async () => {
    const workflowDir = await fs.mkdtemp(path.join(os.tmpdir(), 'step22-success-empty-'));
    try {
      await fs.writeFile(
        path.join(workflowDir, 'commit_history.json'),
        JSON.stringify(
          {
            version: '1.0.0',
            lastRunCommit: 'aaaaaaa',
            runs: [
              {
                hash: 'aaaaaaa',
                runId: 'workflow_success',
                timestamp: new Date(2026, 3, 10, 10, 5, 0).toISOString(),
              },
            ],
          },
          null,
          2
        ),
        'utf8'
      );

      const step = new Step22AccessibilityReview({
        fileOps: makeFileOps(['src/full-scan.html']),
        backlog: makeBacklog(),
        aiHelper: makeAiHelper(),
        aiCache: makeAiCache(),
        gitOps: {
          getChangedFilesSince: jest
            .fn()
            .mockReturnValue([{ file: 'README.md', status: 'modified' }]),
          status: jest.fn().mockResolvedValue({ staged: [], unstaged: [], untracked: [] }),
        },
      });

      const result = await step.execute('/project', {
        workflowDir,
      });

      expect(result.success).toBe(true);
      expect(result.skipped).toBe(true);
      expect(result.message).toContain('last successful run');
    } finally {
      await fs.rm(workflowDir, { recursive: true, force: true });
    }
  });

  test('uses modifiedFiles fallback when git metadata is unavailable', async () => {
    const fileOps = makeFileOps(['src/full-scan.html']);
    const step = new Step22AccessibilityReview({
      fileOps,
      backlog: makeBacklog(),
      aiHelper: makeAiHelper(),
      aiCache: makeAiCache(),
    });

    const result = await step.execute('/project', {
      modifiedFiles: ['README.md', '/project/src/page.html', '/project/src/styles.css'],
    });

    expect(result.success).toBe(true);
    expect(result.fileCount).toBe(2);
    expect(fileOps.listDirectoryRecursive).not.toHaveBeenCalled();
  });

  test('prompt includes project name and framework', async () => {
    const aiHelper = makeAiHelper('findings');
    const step = new Step22AccessibilityReview({
      fileOps: makeFileOps(['src/App.vue']),
      backlog: makeBacklog(),
      aiHelper,
      aiCache: makeAiCache(),
    });

    await step.execute('/project', {
      projectName: 'my-spa',
      projectDescription: 'A Vue SPA',
      framework: 'vue',
    });

    const [promptArg] = aiHelper.executeRequest.mock.calls[0];
    expect(promptArg).toContain('my-spa');
    expect(promptArg).toContain('A Vue SPA');
    expect(promptArg).toContain('vue');
  });

  test('infers framework from package.json when none is provided', async () => {
    const aiHelper = makeAiHelper('findings');
    const fileOps = {
      listDirectoryRecursive: jest.fn().mockResolvedValue(['src/index.html']),
      readFile: jest.fn().mockImplementation((p) => {
        if (p.endsWith('ai_helpers.yaml') || p.includes('ai_helpers')) {
          return Promise.resolve(
            'accessibility_review_prompt:\n' +
              '  role_ref: accessibility_expert\n' +
              '  task_template: |\n' +
              '    Framework: {framework}\n' +
              '    **File Contents (sampled source excerpts):**\n' +
              '    {file_content_block}\n' +
              '  approach: "review approach"'
          );
        }
        if (p.endsWith('prompt_roles.yaml') || p.includes('prompt_roles')) {
          return Promise.resolve('roles: {}');
        }
        if (p.endsWith('package.json')) {
          return Promise.resolve(JSON.stringify({ dependencies: { vue: '^3.5.0' } }));
        }
        return Promise.resolve('<main><h1>Hello</h1></main>');
      }),
    };
    const step = new Step22AccessibilityReview({
      fileOps,
      backlog: makeBacklog(),
      aiHelper,
      aiCache: makeAiCache(),
    });

    await step.execute('/project');

    const [promptArg] = aiHelper.executeRequest.mock.calls[0];
    expect(promptArg).toContain('Framework: vue');
    expect(promptArg).not.toContain('Framework: vanilla');
  });

  test('excludes test artifacts from modified-file accessibility scope', async () => {
    const aiHelper = makeAiHelper('findings');
    const step = new Step22AccessibilityReview({
      fileOps: makeFileOps(['src/ignored-full-scan.html'], '<button aria-label="Close">X</button>'),
      backlog: makeBacklog(),
      aiHelper,
      aiCache: makeAiCache(),
    });

    const result = await step.execute('/project', {
      modifiedFiles: ['test/components/App.test.vue', '/project/src/App.vue'],
    });

    expect(result.success).toBe(true);
    expect(result.fileCount).toBe(1);
    const [promptArg] = aiHelper.executeRequest.mock.calls[0];
    expect(promptArg).toContain('src/App.vue');
    expect(promptArg).not.toContain('test/components/App.test.vue');
  });

  test('prompt scopes file paths to the current partition request', async () => {
    const files = Array.from({ length: 25 }, (_, i) => `src/page${i}.html`);
    const aiHelper = makeAiHelper('findings');
    const step = new Step22AccessibilityReview({
      fileOps: makeFileOps(files),
      backlog: makeBacklog(),
      aiHelper,
      aiCache: makeAiCache(),
    });

    await step.execute('/project');

    const [promptArg] = aiHelper.executeRequest.mock.calls[0];
    expect(promptArg).toContain('src/page0.html');
    expect(promptArg).toContain('src/page3.html');
    expect(promptArg).toContain('25 total (4 covered in this request)');
    expect(promptArg).not.toContain('src/page24.html');
  });

  test('prompt lists only the files in the current partition request', async () => {
    const files = Array.from({ length: 25 }, (_, i) => `src/page${i}.html`);
    const aiHelper = makeAiHelper('findings');
    const step = new Step22AccessibilityReview({
      fileOps: makeFileOps(files, '<button aria-label="Close">X</button>'),
      backlog: makeBacklog(),
      aiHelper,
      aiCache: makeAiCache(),
    });

    await step.execute('/project');

    const [promptArg] = aiHelper.executeRequest.mock.calls[0];
    expect(aiHelper.executeRequest.mock.calls.length).toBeGreaterThan(1);
    expect(promptArg).toContain('[Partition 1 of');
    expect(promptArg).toContain('src/page0.html');
    expect(promptArg).toContain('src/page3.html');
    expect(promptArg).not.toContain('src/page24.html');
  });

  test('runs multiple AI requests when the source payload needs partitioning', async () => {
    const files = Array.from({ length: 5 }, (_, i) => `src/page${i}.html`);
    const aiHelper = {
      initialize: jest.fn().mockResolvedValue(true),
      executeRequest: jest
        .fn()
        .mockResolvedValueOnce({ content: 'partition one findings' })
        .mockResolvedValueOnce({ content: 'partition two findings' })
        .mockResolvedValueOnce({ content: 'consolidated accessibility findings' }),
    };
    const step = new Step22AccessibilityReview({
      fileOps: makeFileOps(files, '<button aria-label="Close">X</button>\n'),
      backlog: makeBacklog(),
      aiHelper,
      aiCache: makeAiCache(),
    });

    const result = await step.execute('/project');

    expect(aiHelper.executeRequest).toHaveBeenCalledTimes(3);
    expect(aiHelper.executeRequest.mock.calls[0][0]).toContain('[Partition 1 of 2');
    expect(aiHelper.executeRequest.mock.calls[1][0]).toContain('[Partition 2 of 2');
    expect(aiHelper.executeRequest.mock.calls[2][0]).toContain(
      'Consolidate the partition findings below'
    );
    expect(aiHelper.executeRequest.mock.calls[0][0]).toContain(
      'split across multiple prompt logs to avoid truncated code excerpts'
    );
    expect(result.report).toContain('consolidated accessibility findings');
  });

  test('splits oversized files into part-labeled prompt entries instead of truncating them', async () => {
    const largeContent = `${'.button { color: red; }\n'.repeat(350)}.end { color: blue; }\n`;
    const aiHelper = makeAiHelper('large file findings');
    const step = new Step22AccessibilityReview({
      fileOps: makeFileOps(['src/large.css'], largeContent),
      backlog: makeBacklog(),
      aiHelper,
      aiCache: makeAiCache(),
    });

    await step.execute('/project');

    const promptArg = aiHelper.executeRequest.mock.calls[0][0];
    expect(promptArg).toContain('src/large.css (part 1/');
    expect(promptArg).not.toContain('...(truncated — remainder omitted)');
  });

  test('prompt injects file content block once instead of appending a duplicate copy', async () => {
    const aiHelper = makeAiHelper('findings');
    const step = new Step22AccessibilityReview({
      fileOps: makeFileOps(['src/App.vue'], '<button aria-label="Close">X</button>'),
      backlog: makeBacklog(),
      aiHelper,
      aiCache: makeAiCache(),
    });

    await step.execute('/project');

    const [promptArg] = aiHelper.executeRequest.mock.calls[0];
    expect(promptArg).toContain('**File Contents (sampled source excerpts):**');
    expect(promptArg).toContain('### `src/App.vue`');
    expect((promptArg.match(/### `src\/App\.vue`/g) || []).length).toBe(1);
  });

  test('re-throws errors from file listing', async () => {
    const fileOps = {
      listDirectoryRecursive: jest.fn().mockRejectedValue(new Error('disk error')),
      readFile: jest.fn(),
    };
    const step = new Step22AccessibilityReview({
      fileOps,
      backlog: makeBacklog(),
      aiHelper: makeAiHelper(),
      aiCache: makeAiCache(),
    });

    await expect(step.execute('/project')).rejects.toThrow('disk error');
  });

  test('instantiates with default dependencies when no options provided', () => {
    const step = new Step22AccessibilityReview();
    expect(step.fileOps).toBeDefined();
    expect(step.backlog).toBeDefined();
    expect(step.aiHelper).toBeDefined();
    expect(step.aiCache).toBeDefined();
  });
});
