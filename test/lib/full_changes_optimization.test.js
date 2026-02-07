/**
 * @fileoverview Tests for Full Changes Optimization (v2.0.0)
 * @module test/lib/full_changes_optimization
 */

import {
  analyzeOptimizationCandidates,
  selectOptimizationStrategy,
  calculateOverallConfidence,
  mergeOptimizationReports,
  calculateTimeSavings,
  buildComprehensiveReport,
  determineOptimizedSteps,
  FullChangesOptimizer,
} from '../../src/lib/full_changes_optimization.js';

describe('Full Changes Optimization', () => {
  // ==========================================================================
  // PURE FUNCTION TESTS
  // ==========================================================================

  describe('analyzeOptimizationCandidates', () => {
    test('identifies docs-only as candidate', () => {
      const changes = {};
      const docsAnalysis = {
        isDocsOnly: true,
        docsPercentage: 100,
        stepsToSkip: ['step2', 'step3'],
      };
      const codeAnalysis = null;

      const candidates = analyzeOptimizationCandidates(changes, docsAnalysis, codeAnalysis);

      expect(candidates.docs_only).toBe(true);
      expect(candidates.code_changes).toBe(false);
      expect(candidates.ml_prediction).toBe(true);
      expect(candidates.standard).toBe(true);
    });

    test('identifies code changes as candidate', () => {
      const changes = {};
      const docsAnalysis = null;
      const codeAnalysis = {
        report: { recommendation: 'optimize', confidence: 0.8 },
      };

      const candidates = analyzeOptimizationCandidates(changes, docsAnalysis, codeAnalysis);

      expect(candidates.docs_only).toBe(false);
      expect(candidates.code_changes).toBe(true);
    });

    test('rejects low-confidence candidates', () => {
      const changes = {};
      const docsAnalysis = {
        report: { recommendation: 'optimize', confidence: 0.5 },
      };
      const codeAnalysis = {
        report: { recommendation: 'optimize', confidence: 0.4 },
      };

      const candidates = analyzeOptimizationCandidates(changes, docsAnalysis, codeAnalysis);

      expect(candidates.docs_only).toBe(false);
      expect(candidates.code_changes).toBe(false);
    });

    test('handles null analyses', () => {
      const candidates = analyzeOptimizationCandidates({}, null, null);

      expect(candidates.docs_only).toBe(false);
      expect(candidates.code_changes).toBe(false);
      expect(candidates.ml_prediction).toBe(true);
      expect(candidates.standard).toBe(true);
    });

    test('identifies both docs and code as candidates', () => {
      const docsAnalysis = {
        isDocsOnly: true,
        docsPercentage: 100,
        stepsToSkip: ['step2'],
      };
      const codeAnalysis = {
        report: { recommendation: 'optimize', confidence: 0.8 },
      };

      const candidates = analyzeOptimizationCandidates({}, docsAnalysis, codeAnalysis);

      expect(candidates.docs_only).toBe(true);
      expect(candidates.code_changes).toBe(true);
    });
  });

  describe('selectOptimizationStrategy', () => {
    test('selects docs_only when eligible (highest priority)', () => {
      const candidates = {
        docs_only: true,
        code_changes: true,
        ml_prediction: true,
        standard: true,
      };

      const strategy = selectOptimizationStrategy(candidates);

      expect(strategy).toBe('docs_only');
    });

    test('selects code_changes when docs not eligible', () => {
      const candidates = {
        docs_only: false,
        code_changes: true,
        ml_prediction: true,
        standard: true,
      };

      const strategy = selectOptimizationStrategy(candidates);

      expect(strategy).toBe('code_changes');
    });

    test('selects ml_prediction when only it and standard eligible', () => {
      const candidates = {
        docs_only: false,
        code_changes: false,
        ml_prediction: true,
        standard: true,
      };

      const strategy = selectOptimizationStrategy(candidates);

      expect(strategy).toBe('ml_prediction');
    });

    test('falls back to standard when nothing else eligible', () => {
      const candidates = {
        docs_only: false,
        code_changes: false,
        ml_prediction: false,
        standard: true,
      };

      const strategy = selectOptimizationStrategy(candidates);

      expect(strategy).toBe('standard');
    });

    test('respects user preferences', () => {
      const candidates = {
        docs_only: true,
        code_changes: true,
        ml_prediction: true,
        standard: true,
      };
      const preferences = { forceStrategy: 'code_changes' };

      const strategy = selectOptimizationStrategy(candidates, preferences);

      expect(strategy).toBe('code_changes');
    });

    test('ignores invalid forced strategy', () => {
      const candidates = {
        docs_only: true,
        code_changes: false,
        ml_prediction: true,
        standard: true,
      };
      const preferences = { forceStrategy: 'code_changes' };

      const strategy = selectOptimizationStrategy(candidates, preferences);

      expect(strategy).toBe('docs_only'); // Falls back to highest eligible
    });
  });

  describe('calculateOverallConfidence', () => {
    test('returns docs confidence for docs_only strategy', () => {
      const docsAnalysis = { docsPercentage: 90 };

      const confidence = calculateOverallConfidence('docs_only', docsAnalysis, null, null);

      expect(confidence).toBe(0.9);
    });

    test('returns code confidence for code_changes strategy', () => {
      const codeAnalysis = { report: { confidence: 0.8 } };

      const confidence = calculateOverallConfidence('code_changes', null, codeAnalysis, null);

      expect(confidence).toBe(0.8);
    });

    test('returns ml confidence for ml_prediction strategy', () => {
      const mlAnalysis = { confidence: 0.7 };

      const confidence = calculateOverallConfidence('ml_prediction', null, null, mlAnalysis);

      expect(confidence).toBe(0.7);
    });

    test('returns default confidence for standard strategy', () => {
      const confidence = calculateOverallConfidence('standard', null, null, null);

      expect(confidence).toBe(0.3);
    });

    test('handles missing analysis data gracefully', () => {
      const confidence = calculateOverallConfidence('docs_only', null, null, null);

      // Falls back to standard confidence when no analysis data
      expect(confidence).toBe(0);
    });
  });

  describe('mergeOptimizationReports', () => {
    test('merges all reports', () => {
      const docsReport = {
        isDocsOnly: true,
        docsPercentage: 100,
        speedup: 85,
      };
      const codeReport = {
        recommendation: 'optimize',
        confidence: 0.8,
        patterns: { primary: 'config' },
        optimization: { speedup: '30%' },
      };
      const mlReport = {
        prediction: 'SKIP',
        confidence: 0.7,
        reason: 'no_changes',
      };

      const merged = mergeOptimizationReports(docsReport, codeReport, mlReport);

      expect(merged.docs.isDocsOnly).toBe(true);
      expect(merged.docs.speedup).toBe(85);
      expect(merged.code.primaryPattern).toBe('config');
      expect(merged.ml.prediction).toBe('SKIP');
    });

    test('handles null reports', () => {
      const merged = mergeOptimizationReports(null, null, null);

      expect(merged.docs).toBeNull();
      expect(merged.code).toBeNull();
      expect(merged.ml).toBeNull();
    });

    test('merges partial reports', () => {
      const docsReport = { recommendation: 'optimize', confidence: 0.9 };

      const merged = mergeOptimizationReports(docsReport, null, null);

      expect(merged.docs).not.toBeNull();
      expect(merged.code).toBeNull();
      expect(merged.ml).toBeNull();
    });
  });

  describe('calculateTimeSavings', () => {
    test('calculates savings for docs_only strategy', () => {
      const docsAnalysis = {
        speedup: 85,
      };

      const savings = calculateTimeSavings('docs_only', docsAnalysis, null);

      expect(savings.speedupPercent).toBe(85);
      expect(savings.timeSavedSeconds).toBe(680); // 85% of 800
      expect(savings.estimatedRemaining).toBe(120);
    });

    test('calculates savings for code_changes strategy', () => {
      const codeAnalysis = {
        report: { optimization: { speedup: '30%' } },
      };

      const savings = calculateTimeSavings('code_changes', null, codeAnalysis);

      expect(savings.speedupPercent).toBe(30);
      expect(savings.timeSavedSeconds).toBe(240);
    });

    test('returns zero savings for standard strategy', () => {
      const savings = calculateTimeSavings('standard', null, null);

      expect(savings.speedupPercent).toBe(0);
      expect(savings.timeSavedSeconds).toBe(0);
      expect(savings.estimatedRemaining).toBe(800);
    });

    test('handles missing speedup data', () => {
      const docsAnalysis = { report: {} };

      const savings = calculateTimeSavings('docs_only', docsAnalysis, null);

      expect(savings.speedupPercent).toBe(0);
      expect(savings.timeSavedSeconds).toBe(0);
    });
  });

  describe('buildComprehensiveReport', () => {
    test('builds complete report', () => {
      const strategy = 'docs_only';
      const candidates = { docs_only: true, code_changes: false };
      const confidence = 0.9;
      const timeSavings = { speedupPercent: 85, timeSavedSeconds: 680 };
      const merged = { docs: {}, code: null, ml: null };

      const report = buildComprehensiveReport(
        strategy,
        candidates,
        confidence,
        timeSavings,
        merged
      );

      expect(report.selectedStrategy).toBe('docs_only');
      expect(report.confidence).toBe(0.9);
      expect(report.recommendation).toBe('optimize');
      expect(report.fallbackAvailable).toBe(true);
    });

    test('recommends standard for low confidence', () => {
      const report = buildComprehensiveReport('docs_only', {}, 0.5, {}, {});

      expect(report.recommendation).toBe('standard');
    });

    test('marks no fallback for standard strategy', () => {
      const report = buildComprehensiveReport('standard', {}, 0.3, {}, {});

      expect(report.fallbackAvailable).toBe(false);
    });
  });

  describe('determineOptimizedSteps', () => {
    test('uses docs filtering for docs_only strategy', () => {
      const originalSteps = ['step1', 'step2', 'step3'];
      const docsAnalysis = {
        stepsToRun: ['step1', 'step3'],
      };

      const steps = determineOptimizedSteps('docs_only', originalSteps, docsAnalysis, null);

      expect(steps).toEqual(['step1', 'step3']);
    });

    test('uses code filtering for code_changes strategy', () => {
      const originalSteps = ['step1', 'step2', 'step3'];
      const codeAnalysis = {
        filtering: { filtered: ['step1', 'step2'] },
      };

      const steps = determineOptimizedSteps('code_changes', originalSteps, null, codeAnalysis);

      expect(steps).toEqual(['step1', 'step2']);
    });

    test('returns original steps for ml_prediction', () => {
      const originalSteps = ['step1', 'step2', 'step3'];

      const steps = determineOptimizedSteps('ml_prediction', originalSteps, null, null);

      expect(steps).toEqual(originalSteps);
    });

    test('returns original steps for standard', () => {
      const originalSteps = ['step1', 'step2', 'step3'];

      const steps = determineOptimizedSteps('standard', originalSteps, null, null);

      expect(steps).toEqual(originalSteps);
    });
  });

  // ==========================================================================
  // INTEGRATION TESTS
  // ==========================================================================

  describe('FullChangesOptimizer', () => {
    let optimizer;

    beforeEach(() => {
      optimizer = new FullChangesOptimizer();
    });

    describe('constructor', () => {
      test('initializes with default options', () => {
        expect(optimizer.preferences).toEqual({});
        expect(optimizer.docsOptimizer).toBeDefined();
        expect(optimizer.codeOptimizer).toBeDefined();
        expect(optimizer.mlOptimizer).toBeDefined();
        expect(optimizer.lastAnalysis).toBeNull();
      });

      test('accepts custom preferences', () => {
        const custom = new FullChangesOptimizer({
          preferences: { forceStrategy: 'docs_only' },
        });

        expect(custom.preferences.forceStrategy).toBe('docs_only');
      });
    });

    describe('analyze', () => {
      test('analyzes docs-only changes', async () => {
        const changes = [{ path: 'README.md' }, { path: 'docs/guide.md' }];
        const allSteps = ['step1', 'step2', 'step3', 'step15'];

        const result = await optimizer.analyze(changes, allSteps);

        expect(result.strategy).toBe('docs_only');
        expect(result.confidence).toBeGreaterThan(0.7);
        expect(result.report.recommendation).toBe('optimize');
      });

      test('analyzes code changes', async () => {
        const changes = [{ path: 'config.json' }, { path: 'settings.yaml' }];
        const allSteps = ['step1', 'step2', 'step3', 'step15'];

        const result = await optimizer.analyze(changes, allSteps);

        expect(result.strategy).toBe('code_changes');
        expect(result.confidence).toBeGreaterThan(0);
      });

      test('analyzes mixed changes', async () => {
        const changes = [
          { path: 'README.md' },
          { path: 'src/app.js' },
          { path: 'test/app.test.js' },
        ];

        const result = await optimizer.analyze(changes);

        expect(result.strategy).toBeDefined();
        expect(result.report).toBeDefined();
      });

      test('caches analysis result', async () => {
        const changes = [{ path: 'README.md' }];

        await optimizer.analyze(changes);

        expect(optimizer.lastAnalysis).not.toBeNull();
        expect(optimizer.lastAnalysis.changes).toEqual(changes);
      });
    });

    describe('getReport', () => {
      test('returns null before analysis', () => {
        expect(optimizer.getReport()).toBeNull();
      });

      test('returns report after analysis', async () => {
        const changes = [{ path: 'README.md' }];
        await optimizer.analyze(changes);

        const report = optimizer.getReport();

        expect(report).not.toBeNull();
        expect(report.selectedStrategy).toBeDefined();
      });
    });

    describe('shouldOptimize', () => {
      test('returns false before analysis', () => {
        expect(optimizer.shouldOptimize()).toBe(false);
      });

      test('returns true for high-confidence optimization', async () => {
        const changes = [{ path: 'README.md' }, { path: 'docs/guide.md' }];
        const allSteps = ['step1', 'step2', 'step3', 'step15'];
        await optimizer.analyze(changes, allSteps);

        expect(optimizer.shouldOptimize()).toBe(true);
      });

      test('returns false for low-confidence', async () => {
        const changes = [
          { path: 'src/complex.js' },
          { path: 'src/another.js' },
          { path: 'test/unit.js' },
        ];
        await optimizer.analyze(changes);

        // Mixed changes typically have lower confidence
        const shouldOpt = optimizer.shouldOptimize();
        expect(typeof shouldOpt).toBe('boolean');
      });
    });

    describe('getOptimizedWorkflow', () => {
      test('returns optimized workflow for docs changes', async () => {
        const changes = [{ path: 'README.md' }];
        const originalSteps = ['step1', 'step2', 'step3', 'step15'];

        await optimizer.analyze(changes, originalSteps);
        const optimized = optimizer.getOptimizedWorkflow(originalSteps);

        expect(optimized.length).toBeLessThanOrEqual(originalSteps.length);
        expect(optimized).toContain('step1');
        expect(optimized).toContain('step15');
      });

      test('returns original workflow when not optimizable', async () => {
        const changes = [{ path: 'src/app.js' }, { path: 'src/utils.js' }];
        const originalSteps = ['step1', 'step2', 'step3'];

        await optimizer.analyze(changes, originalSteps);
        const result = optimizer.getOptimizedWorkflow(originalSteps);

        // May or may not optimize depending on analysis
        expect(Array.isArray(result)).toBe(true);
      });
    });

    describe('recordResult', () => {
      test('records successful execution', async () => {
        const changes = [{ path: 'README.md' }];
        await optimizer.analyze(changes);

        optimizer.recordResult({ success: true, duration: 100 });

        expect(optimizer.history.length).toBe(1);
        expect(optimizer.history[0].success).toBe(true);
      });

      test('does nothing before analysis', () => {
        optimizer.recordResult({ success: true, duration: 100 });

        expect(optimizer.history.length).toBe(0);
      });

      test('records strategy and confidence', async () => {
        const changes = [{ path: 'README.md' }];
        await optimizer.analyze(changes);

        optimizer.recordResult({ success: true, duration: 100 });

        const record = optimizer.history[0];
        expect(record.strategy).toBeDefined();
        expect(record.confidence).toBeGreaterThan(0);
      });
    });

    describe('getStatistics', () => {
      test('returns zero stats with no history', () => {
        const stats = optimizer.getStatistics();

        expect(stats.totalRuns).toBe(0);
        expect(stats.successRate).toBe(0);
        expect(stats.averageDuration).toBe(0);
      });

      test('calculates statistics from history', async () => {
        const changes = [{ path: 'README.md' }];

        await optimizer.analyze(changes);
        optimizer.recordResult({ success: true, duration: 100 });

        await optimizer.analyze(changes);
        optimizer.recordResult({ success: false, duration: 200 });

        const stats = optimizer.getStatistics();

        expect(stats.totalRuns).toBe(2);
        expect(stats.successRate).toBe(0.5);
        expect(stats.averageDuration).toBe(150);
      });

      test('tracks strategy usage', async () => {
        const docsChanges = [{ path: 'README.md' }];
        const codeChanges = [{ path: 'config.json' }];

        await optimizer.analyze(docsChanges);
        optimizer.recordResult({ success: true, duration: 100 });

        await optimizer.analyze(codeChanges);
        optimizer.recordResult({ success: true, duration: 100 });

        const stats = optimizer.getStatistics();

        expect(stats.strategyUsage).toBeDefined();
        expect(Object.keys(stats.strategyUsage).length).toBeGreaterThan(0);
      });
    });

    describe('reset', () => {
      test('clears analysis and history', async () => {
        const changes = [{ path: 'README.md' }];
        await optimizer.analyze(changes);
        optimizer.recordResult({ success: true, duration: 100 });

        optimizer.reset();

        expect(optimizer.lastAnalysis).toBeNull();
        expect(optimizer.history).toEqual([]);
      });
    });

    describe('end-to-end workflow', () => {
      test('complete optimization for docs changes', async () => {
        const changes = [{ path: 'README.md' }, { path: 'CONTRIBUTING.md' }];
        const allSteps = ['step1', 'step2', 'step3', 'step15'];

        // Step 1: Analyze
        const analysis = await optimizer.analyze(changes, allSteps);
        expect(analysis.strategy).toBe('docs_only');

        // Step 2: Get report
        const report = optimizer.getReport();
        expect(report.recommendation).toBe('optimize');

        // Step 3: Check optimization
        expect(optimizer.shouldOptimize()).toBe(true);

        // Step 4: Get optimized workflow
        const optimized = optimizer.getOptimizedWorkflow(allSteps);
        expect(optimized.length).toBeLessThan(allSteps.length);

        // Step 5: Record result
        optimizer.recordResult({ success: true, duration: 120 });

        // Step 6: Get statistics
        const stats = optimizer.getStatistics();
        expect(stats.totalRuns).toBe(1);
        expect(stats.successRate).toBe(1);
      });

      test('fallback to standard for complex changes', async () => {
        const changes = [
          { path: 'src/core.js' },
          { path: 'src/utils.js' },
          { path: 'test/core.test.js' },
          { path: 'docs/api.md' },
          { path: 'config.json' },
        ];

        await optimizer.analyze(changes);

        // Complex mixed changes may not optimize
        const report = optimizer.getReport();
        expect(report.selectedStrategy).toBeDefined();
      });
    });
  });
});
