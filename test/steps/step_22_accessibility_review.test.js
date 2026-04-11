/**
 * @fileoverview Tests for step_22_accessibility_review module
 * @module test/steps/step_22_accessibility_review.test
 */

import { jest } from '@jest/globals';
import {
  isAccessibleProject,
  scoreAccessibilityIssues,
  formatAccessibilityReport,
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
            '    Project: {project_name}\n' +
            '    Project Summary: {project_summary}\n' +
            '    Framework: {framework}\n' +
            '    Files: {source_file_count}\n' +
            '    Paths: {file_paths}\n' +
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
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
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
      get: jest.fn().mockResolvedValue('cached accessibility report'),
      set: jest.fn().mockResolvedValue(undefined),
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

  test('prompt includes file paths up to cap with overflow note', async () => {
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
    expect(promptArg).toContain('src/page19.html');
    expect(promptArg).toContain('and 5 more');
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
