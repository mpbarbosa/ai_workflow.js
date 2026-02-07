/**
 * @fileoverview Tests for Docs-Only Optimization Module
 */

import {
  isDocsFile,
  isDocsOnlyChange,
  categorizeFiles,
  calculateDocsPercentage,
  shouldRunStep,
  filterDocsOnlySteps,
  getSkippedSteps,
  estimateTimeSavings,
  calculateSpeedup,
  formatDuration,
  buildOptimizationReport,
  DocsOnlyOptimizer,
  AVERAGE_STEP_DURATIONS,
} from '../../src/lib/docs_only_optimization.js';

// ============================================================================
// PURE FUNCTION TESTS - Documentation Detection
// ============================================================================

describe('Pure Functions - Documentation Detection', () => {
  describe('isDocsFile', () => {
    test('identifies markdown files', () => {
      expect(isDocsFile('README.md')).toBe(true);
      expect(isDocsFile('docs/guide.md')).toBe(true);
      expect(isDocsFile('CHANGELOG.MD')).toBe(true); // Case insensitive
    });

    test('identifies other doc formats', () => {
      expect(isDocsFile('notes.txt')).toBe(true);
      expect(isDocsFile('guide.rst')).toBe(true);
      expect(isDocsFile('manual.adoc')).toBe(true);
      expect(isDocsFile('README')).toBe(true);
    });

    test('identifies docs directory files', () => {
      expect(isDocsFile('docs/index.html')).toBe(true);
      expect(isDocsFile('documentation/api.json')).toBe(true);
    });

    test('rejects code files', () => {
      expect(isDocsFile('src/index.js')).toBe(false);
      expect(isDocsFile('test.py')).toBe(false);
      expect(isDocsFile('main.go')).toBe(false);
    });

    test('handles edge cases', () => {
      expect(isDocsFile('')).toBe(false);
      expect(isDocsFile(null)).toBe(false);
      expect(isDocsFile(undefined)).toBe(false);
    });
  });

  describe('isDocsOnlyChange', () => {
    test('returns true for docs-only changes', () => {
      expect(isDocsOnlyChange(['README.md', 'docs/guide.md'])).toBe(true);
    });

    test('returns false for mixed changes', () => {
      expect(isDocsOnlyChange(['README.md', 'src/index.js'])).toBe(false);
    });

    test('returns false for code-only changes', () => {
      expect(isDocsOnlyChange(['src/index.js', 'test.py'])).toBe(false);
    });

    test('handles empty arrays', () => {
      expect(isDocsOnlyChange([])).toBe(false);
    });

    test('handles invalid input', () => {
      expect(isDocsOnlyChange(null)).toBe(false);
      expect(isDocsOnlyChange(undefined)).toBe(false);
    });
  });

  describe('categorizeFiles', () => {
    test('categorizes files correctly', () => {
      const files = ['README.md', 'src/index.js', 'test.py', 'docs/guide.md', 'config.yaml'];

      const result = categorizeFiles(files);

      expect(result.docs).toEqual(['README.md', 'docs/guide.md']);
      expect(result.code).toEqual(['src/index.js', 'test.py']);
      expect(result.other).toEqual(['config.yaml']);
    });

    test('handles all docs', () => {
      const files = ['README.md', 'CHANGELOG.md'];
      const result = categorizeFiles(files);

      expect(result.docs).toEqual(files);
      expect(result.code).toEqual([]);
      expect(result.other).toEqual([]);
    });

    test('handles all code', () => {
      const files = ['index.js', 'main.py'];
      const result = categorizeFiles(files);

      expect(result.docs).toEqual([]);
      expect(result.code).toEqual(files);
      expect(result.other).toEqual([]);
    });

    test('handles empty array', () => {
      const result = categorizeFiles([]);

      expect(result.docs).toEqual([]);
      expect(result.code).toEqual([]);
      expect(result.other).toEqual([]);
    });
  });

  describe('calculateDocsPercentage', () => {
    test('calculates 100% for all docs', () => {
      expect(calculateDocsPercentage(['README.md', 'docs/guide.md'])).toBe(100);
    });

    test('calculates 0% for no docs', () => {
      expect(calculateDocsPercentage(['src/index.js', 'test.py'])).toBe(0);
    });

    test('calculates 50% for mixed', () => {
      expect(calculateDocsPercentage(['README.md', 'index.js'])).toBe(50);
    });

    test('rounds to 2 decimal places', () => {
      const files = ['README.md', 'index.js', 'test.py'];
      expect(calculateDocsPercentage(files)).toBeCloseTo(33.33, 2);
    });

    test('handles empty arrays', () => {
      expect(calculateDocsPercentage([])).toBe(0);
    });

    test('handles invalid input', () => {
      expect(calculateDocsPercentage(null)).toBe(0);
    });
  });
});

// ============================================================================
// PURE FUNCTION TESTS - Step Filtering
// ============================================================================

describe('Pure Functions - Step Filtering', () => {
  describe('shouldRunStep', () => {
    test('returns true for always-run steps', () => {
      expect(shouldRunStep('step1')).toBe(true);
      expect(shouldRunStep('step15')).toBe(true);
      expect(shouldRunStep('git_commit')).toBe(true);
    });

    test('returns false for skippable steps', () => {
      expect(shouldRunStep('step2')).toBe(false);
      expect(shouldRunStep('step9')).toBe(false);
    });

    test('handles invalid input', () => {
      expect(shouldRunStep('')).toBe(false);
      expect(shouldRunStep(null)).toBe(false);
      expect(shouldRunStep(undefined)).toBe(false);
    });
  });

  describe('filterDocsOnlySteps', () => {
    test('filters to always-run steps only', () => {
      const allSteps = ['step1', 'step2', 'step9', 'step15'];
      const result = filterDocsOnlySteps(allSteps);

      expect(result).toEqual(['step1', 'step15']);
    });

    test('handles no always-run steps', () => {
      const allSteps = ['step2', 'step3', 'step9'];
      const result = filterDocsOnlySteps(allSteps);

      expect(result).toEqual([]);
    });

    test('handles empty array', () => {
      expect(filterDocsOnlySteps([])).toEqual([]);
    });

    test('handles invalid input', () => {
      expect(filterDocsOnlySteps(null)).toEqual([]);
    });
  });

  describe('getSkippedSteps', () => {
    test('returns steps to skip', () => {
      const allSteps = ['step1', 'step2', 'step9', 'step15'];
      const result = getSkippedSteps(allSteps);

      expect(result).toEqual(['step2', 'step9']);
    });

    test('handles all always-run steps', () => {
      const allSteps = ['step1', 'step15'];
      const result = getSkippedSteps(allSteps);

      expect(result).toEqual([]);
    });

    test('handles empty array', () => {
      expect(getSkippedSteps([])).toEqual([]);
    });
  });
});

// ============================================================================
// PURE FUNCTION TESTS - Time Estimation
// ============================================================================

describe('Pure Functions - Time Estimation', () => {
  describe('estimateTimeSavings', () => {
    test('calculates total time savings', () => {
      const skipped = ['step2', 'step3', 'step9'];
      const savings = estimateTimeSavings(skipped);

      expect(savings).toBe(
        AVERAGE_STEP_DURATIONS.step2 + AVERAGE_STEP_DURATIONS.step3 + AVERAGE_STEP_DURATIONS.step9
      );
    });

    test('returns 0 for no skipped steps', () => {
      expect(estimateTimeSavings([])).toBe(0);
    });

    test('handles unknown steps gracefully', () => {
      const savings = estimateTimeSavings(['unknown_step']);
      expect(savings).toBe(0);
    });

    test('handles invalid input', () => {
      expect(estimateTimeSavings(null)).toBe(0);
    });
  });

  describe('calculateSpeedup', () => {
    test('calculates speedup percentage', () => {
      expect(calculateSpeedup(100, 20)).toBeCloseTo(80, 2); // 80% faster
      expect(calculateSpeedup(100, 50)).toBeCloseTo(50, 2); // 50% faster
    });

    test('handles no speedup', () => {
      expect(calculateSpeedup(100, 100)).toBe(0);
    });

    test('handles invalid inputs', () => {
      expect(calculateSpeedup(0, 50)).toBe(0);
      expect(calculateSpeedup(-100, 50)).toBe(0);
      expect(calculateSpeedup('100', 50)).toBe(0);
    });
  });

  describe('formatDuration', () => {
    test('formats seconds', () => {
      expect(formatDuration(30)).toBe('30s');
      expect(formatDuration(59)).toBe('59s');
    });

    test('formats minutes', () => {
      expect(formatDuration(60)).toBe('1m');
      expect(formatDuration(90)).toBe('1m 30s');
      expect(formatDuration(120)).toBe('2m');
    });

    test('formats hours', () => {
      expect(formatDuration(3600)).toBe('1h');
      expect(formatDuration(3660)).toBe('1h 1m');
      expect(formatDuration(7200)).toBe('2h');
    });

    test('handles edge cases', () => {
      expect(formatDuration(0)).toBe('0s');
      expect(formatDuration(-10)).toBe('0s');
      expect(formatDuration(null)).toBe('0s');
    });
  });
});

// ============================================================================
// PURE FUNCTION TESTS - Optimization Report
// ============================================================================

describe('Pure Functions - Optimization Report', () => {
  describe('buildOptimizationReport', () => {
    test('builds complete report for docs-only', () => {
      const analysis = {
        isDocsOnly: true,
        docsPercentage: 100,
        changedFiles: ['README.md', 'docs/guide.md'],
        categorization: { docs: ['README.md', 'docs/guide.md'], code: [], other: [] },
        stepsToRun: ['step1', 'step15'],
        stepsToSkip: ['step2', 'step9'],
        timeSavings: 200,
        speedup: 85,
      };

      const report = buildOptimizationReport(analysis);

      expect(report.optimizationType).toBe('docs-only');
      expect(report.confidence).toBe(1.0);
      expect(report.summary.docsPercentage).toBe('100%');
      expect(report.steps.toSkip).toBe(2);
      expect(report.performance.speedup).toBe('85%');
      expect(report.recommendation).toContain('docs-only fast path');
    });

    test('builds report for non-docs changes', () => {
      const analysis = {
        isDocsOnly: false,
        docsPercentage: 50,
        changedFiles: ['README.md', 'index.js'],
        categorization: { docs: ['README.md'], code: ['index.js'], other: [] },
        stepsToRun: ['step1', 'step2', 'step9', 'step15'],
        stepsToSkip: [],
        timeSavings: 0,
        speedup: 0,
      };

      const report = buildOptimizationReport(analysis);

      expect(report.optimizationType).toBe('standard');
      expect(report.confidence).toBe(0);
      expect(report.steps.toSkip).toBe(0);
      expect(report.recommendation).toContain('standard workflow');
    });

    test('handles minimal analysis', () => {
      const report = buildOptimizationReport({});

      expect(report.optimizationType).toBe('standard');
      expect(report.summary.changedFiles).toBe(0);
      expect(report.steps.total).toBe(0);
    });
  });
});

// ============================================================================
// INTEGRATION TESTS - DocsOnlyOptimizer
// ============================================================================

describe('DocsOnlyOptimizer Integration', () => {
  let optimizer;

  beforeEach(() => {
    optimizer = new DocsOnlyOptimizer();
  });

  describe('analyze', () => {
    test('analyzes docs-only changes', () => {
      const changedFiles = ['README.md', 'docs/guide.md'];
      const allSteps = ['step1', 'step2', 'step9', 'step15'];

      const analysis = optimizer.analyze(changedFiles, allSteps);

      expect(analysis.isDocsOnly).toBe(true);
      expect(analysis.docsPercentage).toBe(100);
      expect(analysis.stepsToRun).toEqual(['step1', 'step15']);
      expect(analysis.stepsToSkip).toContain('step2');
      expect(analysis.stepsToSkip).toContain('step9');
      expect(analysis.timeSavings).toBeGreaterThan(0);
      expect(analysis.speedup).toBeGreaterThan(0);
    });

    test('analyzes mixed changes', () => {
      const changedFiles = ['README.md', 'src/index.js'];
      const allSteps = ['step1', 'step2', 'step9', 'step15'];

      const analysis = optimizer.analyze(changedFiles, allSteps);

      expect(analysis.isDocsOnly).toBe(false);
      expect(analysis.docsPercentage).toBe(50);
      expect(analysis.stepsToRun).toEqual(allSteps);
      expect(analysis.stepsToSkip).toEqual([]);
      expect(analysis.timeSavings).toBe(0);
    });

    test('throws on invalid input', () => {
      expect(() => optimizer.analyze(null, [])).toThrow(TypeError);
      expect(() => optimizer.analyze([], null)).toThrow(TypeError);
    });
  });

  describe('getReport', () => {
    test('generates formatted report', () => {
      const changedFiles = ['README.md'];
      const allSteps = ['step1', 'step2', 'step15'];

      const analysis = optimizer.analyze(changedFiles, allSteps);
      const report = optimizer.getReport(analysis);

      expect(report.optimizationType).toBe('docs-only');
      expect(report.summary).toBeDefined();
      expect(report.steps).toBeDefined();
      expect(report.performance).toBeDefined();
      expect(report.recommendation).toBeDefined();
    });
  });

  describe('shouldOptimize', () => {
    test('recommends optimization for docs-only', () => {
      const analysis = {
        isDocsOnly: true,
        docsPercentage: 100,
      };

      expect(optimizer.shouldOptimize(analysis)).toBe(true);
    });

    test('does not recommend for mixed changes', () => {
      const analysis = {
        isDocsOnly: false,
        docsPercentage: 50,
      };

      expect(optimizer.shouldOptimize(analysis)).toBe(false);
    });

    test('respects custom threshold', () => {
      const analysis = {
        isDocsOnly: true,
        docsPercentage: 95,
      };

      expect(optimizer.shouldOptimize(analysis, 90)).toBe(true);
      expect(optimizer.shouldOptimize(analysis, 100)).toBe(false);
    });

    test('handles invalid analysis', () => {
      expect(optimizer.shouldOptimize(null)).toBe(false);
      expect(optimizer.shouldOptimize({})).toBe(false);
    });
  });

  describe('getOptimizedWorkflow', () => {
    test('returns optimized workflow for docs-only', () => {
      const changedFiles = ['README.md', 'CHANGELOG.md'];
      const allSteps = ['step1', 'step2', 'step9', 'step15'];

      const result = optimizer.getOptimizedWorkflow(allSteps, changedFiles);

      expect(result.optimized).toBe(true);
      expect(result.steps).toEqual(['step1', 'step15']);
      expect(result.skippedSteps).toContain('step2');
      expect(result.skippedSteps).toContain('step9');
      expect(result.timeSavings).toBeGreaterThan(0);
      expect(result.speedup).toBeGreaterThan(0);
    });

    test('returns standard workflow for mixed changes', () => {
      const changedFiles = ['README.md', 'src/index.js'];
      const allSteps = ['step1', 'step2', 'step9', 'step15'];

      const result = optimizer.getOptimizedWorkflow(allSteps, changedFiles);

      expect(result.optimized).toBe(false);
      expect(result.steps).toEqual(allSteps);
      expect(result.reason).toContain('Non-docs');
    });
  });

  describe('end-to-end workflow', () => {
    test('complete docs-only optimization workflow', () => {
      // Simulate docs-only changes
      const changedFiles = ['README.md', 'docs/api.md', 'docs/guide.md', 'CHANGELOG.md'];
      const allSteps = ['step1', 'step2', 'step3', 'step9', 'step15'];

      // Analyze
      const analysis = optimizer.analyze(changedFiles, allSteps);
      expect(analysis.isDocsOnly).toBe(true);
      expect(analysis.docsPercentage).toBe(100);

      // Check recommendation
      expect(optimizer.shouldOptimize(analysis)).toBe(true);

      // Get optimized workflow
      const workflow = optimizer.getOptimizedWorkflow(allSteps, changedFiles);
      expect(workflow.optimized).toBe(true);
      expect(workflow.steps.length).toBeLessThan(allSteps.length);

      // Get report
      const report = optimizer.getReport(analysis);
      expect(report.optimizationType).toBe('docs-only');
      expect(parseFloat(report.performance.speedup)).toBeGreaterThan(0);
    });

    test('complete standard workflow (no optimization)', () => {
      const changedFiles = ['src/index.js', 'test/test.js'];
      const allSteps = ['step1', 'step2', 'step9', 'step15'];

      const analysis = optimizer.analyze(changedFiles, allSteps);
      expect(analysis.isDocsOnly).toBe(false);

      expect(optimizer.shouldOptimize(analysis)).toBe(false);

      const workflow = optimizer.getOptimizedWorkflow(allSteps, changedFiles);
      expect(workflow.optimized).toBe(false);
      expect(workflow.steps).toEqual(allSteps);
    });
  });
});
