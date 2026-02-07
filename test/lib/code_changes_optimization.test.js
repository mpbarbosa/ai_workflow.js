/**
 * @fileoverview Tests for Code Changes Optimization (v2.0.0)
 * @module test/lib/code_changes_optimization
 */

import {
  isCodeFile,
  categorizeCodeFile,
  isCodeOnlyChange,
  analyzeCodePatterns,
  shouldRunStep,
  filterStepsForCode,
  estimateCodeImpact,
  estimateTimeSavings,
  calculateSpeedup,
  formatDuration,
  buildOptimizationReport,
  CodeChangesOptimizer,
  ALWAYS_RUN_STEPS,
  AVERAGE_STEP_DURATIONS,
} from '../../src/lib/code_changes_optimization.js';

describe('Code Changes Optimization', () => {
  // ==========================================================================
  // PURE FUNCTION TESTS
  // ==========================================================================

  describe('isCodeFile', () => {
    test('detects frontend code files', () => {
      expect(isCodeFile('src/App.jsx')).toBe(true);
      expect(isCodeFile('components/Button.tsx')).toBe(true);
      expect(isCodeFile('styles/main.css')).toBe(true);
      expect(isCodeFile('styles/theme.scss')).toBe(true);
    });

    test('detects backend code files', () => {
      expect(isCodeFile('server.js')).toBe(true);
      expect(isCodeFile('api/handler.ts')).toBe(true);
      expect(isCodeFile('main.py')).toBe(true);
      expect(isCodeFile('server.go')).toBe(true);
    });

    test('detects API files by path', () => {
      expect(isCodeFile('api/users.js')).toBe(true);
      expect(isCodeFile('routes/auth.js')).toBe(true);
      expect(isCodeFile('controllers/posts.js')).toBe(true);
    });

    test('detects config files', () => {
      expect(isCodeFile('config.json')).toBe(true);
      expect(isCodeFile('.eslintrc.yaml')).toBe(true);
      expect(isCodeFile('config/database.yml')).toBe(true);
    });

    test('detects test files', () => {
      expect(isCodeFile('app.test.js')).toBe(true);
      expect(isCodeFile('utils.spec.ts')).toBe(true);
      expect(isCodeFile('__tests__/unit.js')).toBe(true);
    });

    test('returns false for non-code files', () => {
      expect(isCodeFile('README.md')).toBe(false);
      expect(isCodeFile('docs/guide.txt')).toBe(false);
      expect(isCodeFile('image.png')).toBe(false);
    });
  });

  describe('categorizeCodeFile', () => {
    test('categorizes frontend files', () => {
      expect(categorizeCodeFile('App.jsx')).toContain('frontend');
      expect(categorizeCodeFile('styles.css')).toContain('frontend');
    });

    test('categorizes backend files', () => {
      expect(categorizeCodeFile('server.js')).toContain('backend');
      expect(categorizeCodeFile('handler.py')).toContain('backend');
    });

    test('categorizes API files', () => {
      expect(categorizeCodeFile('api/users.js')).toContain('api');
      expect(categorizeCodeFile('routes/auth.ts')).toContain('api');
    });

    test('categorizes config files', () => {
      expect(categorizeCodeFile('config.json')).toContain('config');
      expect(categorizeCodeFile('settings.yaml')).toContain('config');
    });

    test('categorizes test files', () => {
      expect(categorizeCodeFile('app.test.js')).toContain('test');
      expect(categorizeCodeFile('utils.spec.ts')).toContain('test');
    });

    test('handles multiple categories', () => {
      const categories = categorizeCodeFile('api/users.test.js');
      expect(categories).toContain('backend');
      expect(categories).toContain('api');
      expect(categories).toContain('test');
    });

    test('returns empty array for non-code files', () => {
      expect(categorizeCodeFile('README.md')).toEqual([]);
    });
  });

  describe('isCodeOnlyChange', () => {
    test('returns true for code-only changes', () => {
      const changes = [
        { path: 'src/App.jsx', type: 'modified' },
        { path: 'server.js', type: 'modified' },
        { path: 'api/users.ts', type: 'added' },
      ];
      expect(isCodeOnlyChange(changes)).toBe(true);
    });

    test('returns false for mixed changes', () => {
      const changes = [
        { path: 'src/App.jsx', type: 'modified' },
        { path: 'README.md', type: 'modified' },
      ];
      expect(isCodeOnlyChange(changes)).toBe(false);
    });

    test('returns false for empty changes', () => {
      expect(isCodeOnlyChange([])).toBe(false);
    });

    test('returns false for invalid input', () => {
      expect(isCodeOnlyChange(null)).toBe(false);
      expect(isCodeOnlyChange(undefined)).toBe(false);
    });

    test('handles change objects with file property', () => {
      const changes = [{ file: 'src/App.jsx', status: 'M' }];
      expect(isCodeOnlyChange(changes)).toBe(true);
    });
  });

  describe('analyzeCodePatterns', () => {
    test('analyzes frontend-only changes', () => {
      const changes = [{ path: 'App.jsx' }, { path: 'Button.tsx' }, { path: 'styles.css' }];
      const analysis = analyzeCodePatterns(changes);

      expect(analysis.primaryPattern).toBe('frontend');
      expect(analysis.isSingleCategory).toBe(true);
      expect(analysis.totalCode).toBe(3);
      expect(analysis.percentages.frontend).toBe(1.0);
    });

    test('analyzes backend-only changes', () => {
      const changes = [{ path: 'server.js' }, { path: 'handler.py' }];
      const analysis = analyzeCodePatterns(changes);

      expect(analysis.primaryPattern).toBe('backend');
      expect(analysis.isSingleCategory).toBe(true);
    });

    test('analyzes config-only changes', () => {
      const changes = [{ path: 'config.json' }, { path: 'settings.yaml' }];
      const analysis = analyzeCodePatterns(changes);

      expect(analysis.primaryPattern).toBe('config');
      expect(analysis.isSingleCategory).toBe(true);
    });

    test('analyzes mixed changes', () => {
      const changes = [{ path: 'App.jsx' }, { path: 'server.js' }, { path: 'config.json' }];
      const analysis = analyzeCodePatterns(changes);

      expect(analysis.isSingleCategory).toBe(false);
      expect(analysis.totalCode).toBe(3);
    });

    test('handles empty changes', () => {
      const analysis = analyzeCodePatterns([]);

      expect(analysis.totalCode).toBe(0);
      expect(analysis.primaryPattern).toBe('mixed');
    });

    test('calculates percentages correctly', () => {
      const changes = [{ path: 'App.jsx' }, { path: 'Button.tsx' }, { path: 'server.js' }];
      const analysis = analyzeCodePatterns(changes);

      expect(analysis.percentages.frontend).toBeCloseTo(0.667, 2);
      expect(analysis.percentages.backend).toBeCloseTo(0.333, 2);
    });
  });

  describe('shouldRunStep', () => {
    test('always runs designated steps', () => {
      const analysis = { isSingleCategory: true, primaryPattern: 'config' };

      for (const stepId of ALWAYS_RUN_STEPS) {
        expect(shouldRunStep(stepId, analysis)).toBe(true);
      }
    });

    test('runs all steps for mixed changes', () => {
      const analysis = { isSingleCategory: false, primaryPattern: 'mixed' };

      expect(shouldRunStep('step2', analysis)).toBe(true);
      expect(shouldRunStep('step5', analysis)).toBe(true);
    });

    test('skips steps for config-only changes', () => {
      const analysis = { isSingleCategory: true, primaryPattern: 'config' };

      expect(shouldRunStep('step2', analysis)).toBe(false);
      expect(shouldRunStep('step3', analysis)).toBe(false);
      expect(shouldRunStep('step6', analysis)).toBe(true); // Not in skip list
    });

    test('skips steps for frontend-only changes', () => {
      const analysis = { isSingleCategory: true, primaryPattern: 'frontend' };

      expect(shouldRunStep('step6', analysis)).toBe(false);
      expect(shouldRunStep('step2', analysis)).toBe(true); // Not in skip list
    });

    test('skips steps for test-only changes', () => {
      const analysis = { isSingleCategory: true, primaryPattern: 'test' };

      expect(shouldRunStep('step2', analysis)).toBe(false);
      expect(shouldRunStep('step9', analysis)).toBe(true); // Tests should run
    });

    test('skips steps for build-only changes', () => {
      const analysis = { isSingleCategory: true, primaryPattern: 'build' };

      expect(shouldRunStep('step2', analysis)).toBe(false);
      expect(shouldRunStep('step6', analysis)).toBe(true);
    });
  });

  describe('filterStepsForCode', () => {
    test('filters steps for config-only changes', () => {
      const steps = ['step1', 'step2', 'step3', 'step6', 'step15'];
      const analysis = { isSingleCategory: true, primaryPattern: 'config' };

      const result = filterStepsForCode(steps, analysis);

      expect(result.filtered).toContain('step1');
      expect(result.filtered).toContain('step6');
      expect(result.filtered).toContain('step15');
      expect(result.skipped).toContain('step2');
      expect(result.skipped).toContain('step3');
    });

    test('keeps all steps for mixed changes', () => {
      const steps = ['step1', 'step2', 'step3'];
      const analysis = { isSingleCategory: false, primaryPattern: 'mixed' };

      const result = filterStepsForCode(steps, analysis);

      expect(result.filtered).toEqual(steps);
      expect(result.skipped).toEqual([]);
    });

    test('handles empty step list', () => {
      const analysis = { isSingleCategory: true, primaryPattern: 'config' };

      const result = filterStepsForCode([], analysis);

      expect(result.filtered).toEqual([]);
      expect(result.skipped).toEqual([]);
    });
  });

  describe('estimateCodeImpact', () => {
    test('estimates low impact for single-category changes', () => {
      const analysis = { isSingleCategory: true, primaryPattern: 'config' };
      const impact = estimateCodeImpact(analysis, 3);

      expect(impact.risk).toBe('low');
      expect(impact.confidence).toBeGreaterThan(0.7);
    });

    test('estimates high impact for many files', () => {
      const analysis = { isSingleCategory: false, primaryPattern: 'mixed' };
      const impact = estimateCodeImpact(analysis, 25);

      expect(impact.risk).toBe('high');
      expect(impact.complexity).toBeGreaterThan(0.7);
    });

    test('increases complexity for high-risk patterns', () => {
      const apiAnalysis = { isSingleCategory: true, primaryPattern: 'api' };
      const configAnalysis = { isSingleCategory: true, primaryPattern: 'config' };

      const apiImpact = estimateCodeImpact(apiAnalysis, 5);
      const configImpact = estimateCodeImpact(configAnalysis, 5);

      expect(apiImpact.complexity).toBeGreaterThan(configImpact.complexity);
    });

    test('clamps complexity to [0, 1]', () => {
      const analysis = { isSingleCategory: false, primaryPattern: 'database' };
      const impact = estimateCodeImpact(analysis, 100);

      expect(impact.complexity).toBeLessThanOrEqual(1);
      expect(impact.complexity).toBeGreaterThanOrEqual(0);
    });
  });

  describe('estimateTimeSavings', () => {
    test('calculates time savings correctly', () => {
      const skipped = ['step2', 'step3'];
      const saved = estimateTimeSavings(skipped);

      expect(saved).toBe(90); // 60 + 30
    });

    test('returns zero for empty skipped list', () => {
      expect(estimateTimeSavings([])).toBe(0);
    });

    test('handles unknown steps gracefully', () => {
      const saved = estimateTimeSavings(['unknown_step']);
      expect(saved).toBe(0);
    });

    test('accepts custom durations', () => {
      const customDurations = { step2: 100, step3: 200 };
      const saved = estimateTimeSavings(['step2', 'step3'], customDurations);

      expect(saved).toBe(300);
    });
  });

  describe('calculateSpeedup', () => {
    test('calculates speedup percentage', () => {
      const allSteps = ['step1', 'step2', 'step3'];
      const timeSaved = 90; // step2 + step3

      const speedup = calculateSpeedup(timeSaved, allSteps);

      // Total: 120 + 60 + 30 = 210
      // Saved: 90
      // Speedup: 90/210 = 42.8% ≈ 43%
      expect(speedup).toBe(43);
    });

    test('returns 0 for zero time saved', () => {
      const speedup = calculateSpeedup(0, ['step1']);
      expect(speedup).toBe(0);
    });

    test('returns 0 for empty step list', () => {
      const speedup = calculateSpeedup(100, []);
      expect(speedup).toBe(0);
    });

    test('accepts custom durations', () => {
      const customDurations = { step1: 100, step2: 100 };
      const speedup = calculateSpeedup(100, ['step1', 'step2'], customDurations);

      expect(speedup).toBe(50);
    });
  });

  describe('formatDuration', () => {
    test('formats seconds', () => {
      expect(formatDuration(30)).toBe('30s');
      expect(formatDuration(59)).toBe('59s');
    });

    test('formats minutes', () => {
      expect(formatDuration(60)).toBe('1m');
      expect(formatDuration(90)).toBe('2m');
      expect(formatDuration(3599)).toBe('60m');
    });

    test('formats hours', () => {
      expect(formatDuration(3600)).toBe('1h');
      expect(formatDuration(7200)).toBe('2h');
    });
  });

  describe('buildOptimizationReport', () => {
    test('builds complete report', () => {
      const analysis = {
        primaryPattern: 'config',
        isSingleCategory: true,
        percentages: { config: 1.0 },
        totalCode: 2,
      };
      const impact = { complexity: 0.3, risk: 'low', confidence: 0.8 };
      const filtering = {
        filtered: ['step1', 'step15'],
        skipped: ['step2', 'step3'],
      };

      const report = buildOptimizationReport(analysis, impact, filtering, 90, 43);

      expect(report.recommendation).toBe('optimize');
      expect(report.confidence).toBe(0.8);
      expect(report.patterns.primary).toBe('config');
      expect(report.impact.risk).toBe('low');
      expect(report.optimization.stepsToSkip).toBe(2);
      expect(report.optimization.timeSaved).toBe('2m');
      expect(report.optimization.speedup).toBe('43%');
    });

    test('recommends standard for high-risk changes', () => {
      const analysis = { primaryPattern: 'mixed', isSingleCategory: false };
      const impact = { complexity: 0.8, risk: 'high', confidence: 0.5 };
      const filtering = { filtered: [], skipped: [] };

      const report = buildOptimizationReport(analysis, impact, filtering, 0, 0);

      expect(report.recommendation).toBe('standard');
    });
  });

  // ==========================================================================
  // INTEGRATION TESTS
  // ==========================================================================

  describe('CodeChangesOptimizer', () => {
    let optimizer;

    beforeEach(() => {
      optimizer = new CodeChangesOptimizer();
    });

    describe('constructor', () => {
      test('initializes with default options', () => {
        expect(optimizer.durations).toBe(AVERAGE_STEP_DURATIONS);
        expect(optimizer.fileOps).toBeDefined();
        expect(optimizer.lastAnalysis).toBeNull();
      });

      test('accepts custom durations', () => {
        const customDurations = { step1: 100 };
        const custom = new CodeChangesOptimizer({ durations: customDurations });

        expect(custom.durations).toBe(customDurations);
      });
    });

    describe('analyze', () => {
      test('analyzes config-only changes', () => {
        const changes = [{ path: 'config.json' }, { path: 'settings.yaml' }];

        const result = optimizer.analyze(changes);

        expect(result.analysis.primaryPattern).toBe('config');
        expect(result.filtering.skipped.length).toBeGreaterThan(0);
        expect(result.report.recommendation).toBe('optimize');
      });

      test('analyzes mixed changes', () => {
        const changes = [{ path: 'App.jsx' }, { path: 'server.js' }, { path: 'config.json' }];

        const result = optimizer.analyze(changes);

        expect(result.analysis.isSingleCategory).toBe(false);
        expect(result.filtering.skipped.length).toBe(0);
      });

      test('caches analysis result', () => {
        const changes = [{ path: 'config.json' }];

        optimizer.analyze(changes);

        expect(optimizer.lastAnalysis).not.toBeNull();
        expect(optimizer.lastAnalysis.report).toBeDefined();
      });

      test('uses custom step list', () => {
        const changes = [{ path: 'config.json' }];
        const customSteps = ['step1', 'step2', 'step3'];

        const result = optimizer.analyze(changes, customSteps);

        expect(result.filtering.filtered.length).toBeLessThanOrEqual(3);
      });
    });

    describe('getReport', () => {
      test('returns null before analysis', () => {
        expect(optimizer.getReport()).toBeNull();
      });

      test('returns report after analysis', () => {
        const changes = [{ path: 'config.json' }];
        optimizer.analyze(changes);

        const report = optimizer.getReport();

        expect(report).not.toBeNull();
        expect(report.recommendation).toBeDefined();
      });
    });

    describe('shouldOptimize', () => {
      test('returns false before analysis', () => {
        expect(optimizer.shouldOptimize()).toBe(false);
      });

      test('returns true for optimizable changes', () => {
        const changes = [{ path: 'config.json' }, { path: 'settings.yaml' }];
        optimizer.analyze(changes);

        expect(optimizer.shouldOptimize()).toBe(true);
      });

      test('returns false for mixed changes', () => {
        const changes = [{ path: 'App.jsx' }, { path: 'server.js' }];
        optimizer.analyze(changes);

        expect(optimizer.shouldOptimize()).toBe(false);
      });

      test('respects minimum skipped threshold', () => {
        const changes = [{ path: 'config.json' }];
        optimizer.analyze(changes);

        expect(optimizer.shouldOptimize(1)).toBe(true);
        expect(optimizer.shouldOptimize(10)).toBe(false);
      });
    });

    describe('getOptimizedWorkflow', () => {
      test('returns optimized workflow for config changes', () => {
        const changes = [{ path: 'config.json' }];
        const originalSteps = ['step1', 'step2', 'step3', 'step15'];

        optimizer.analyze(changes, originalSteps); // Pass originalSteps
        const optimized = optimizer.getOptimizedWorkflow(originalSteps);

        expect(optimized.length).toBeLessThan(originalSteps.length);
        expect(optimized).toContain('step1');
        expect(optimized).toContain('step15');
      });

      test('returns original workflow for mixed changes', () => {
        const changes = [{ path: 'App.jsx' }, { path: 'server.js' }];
        const originalSteps = ['step1', 'step2', 'step3'];

        optimizer.analyze(changes);
        const optimized = optimizer.getOptimizedWorkflow(originalSteps);

        expect(optimized).toEqual(originalSteps);
      });

      test('returns original workflow before analysis', () => {
        const steps = ['step1', 'step2'];
        expect(optimizer.getOptimizedWorkflow(steps)).toEqual(steps);
      });
    });

    describe('end-to-end workflow', () => {
      test('complete optimization for config changes', () => {
        const changes = [{ path: 'config/database.json' }, { path: 'config/api.yaml' }];
        const allSteps = ['step1', 'step2', 'step3', 'step4', 'step5', 'step15'];

        // Step 1: Analyze
        const analysis = optimizer.analyze(changes, allSteps);
        expect(analysis.report.patterns.primary).toBe('config');
        expect(analysis.report.recommendation).toBe('optimize');

        // Step 2: Get report
        const report = optimizer.getReport();
        expect(report.optimization.stepsToSkip).toBeGreaterThan(0);

        // Step 3: Check optimization
        expect(optimizer.shouldOptimize()).toBe(true);

        // Step 4: Get optimized workflow
        const optimized = optimizer.getOptimizedWorkflow(allSteps);
        expect(optimized.length).toBeLessThan(allSteps.length);
        expect(optimized).toContain('step1');
        expect(optimized).toContain('step15');
      });

      test('complete workflow for mixed changes', () => {
        const changes = [{ path: 'src/App.jsx' }, { path: 'server.js' }, { path: 'README.md' }];
        const allSteps = ['step1', 'step2', 'step3'];

        // Mixed changes should not optimize
        optimizer.analyze(changes, allSteps);
        expect(optimizer.shouldOptimize()).toBe(false);

        const optimized = optimizer.getOptimizedWorkflow(allSteps);
        expect(optimized).toEqual(allSteps);
      });
    });
  });
});
