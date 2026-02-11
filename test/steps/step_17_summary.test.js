/**
 * @fileoverview Tests for Step 17: Workflow Summary (v2.0.0)
 * @version 2.0.0
 */

import {
  aggregateStepResults,
  calculateWorkflowMetrics,
  generateExecutionTimeline,
  groupStepsByPhase,
  detectBottlenecks,
  calculateCacheEfficiency,
  generateRecommendations,
  identifyParallelizationOpportunities,
  formatSummaryReport,
  formatExecutiveSummary,
  formatTimeline,
  formatPhaseBreakdown,
  formatPerformanceMetrics,
  formatRecommendations,
  formatDuration,
  getStatusIcon,
  getPriorityIcon,
  capitalize,
  getOverallStatusText,
  WorkflowSummary,
  PHASE_NAMES,
  PERFORMANCE_THRESHOLDS,
  RECOMMENDATION_TYPES,
} from '../../src/steps/step_17_summary.js';

import fs from 'fs/promises';
import path from 'path';

// ============================================================================
// PURE FUNCTION TESTS
// ============================================================================

describe('Step 17: Workflow Summary - Pure Functions', () => {
  describe('aggregateStepResults', () => {
    test('should aggregate step results from metrics', () => {
      const metrics = {
        steps: {
          step_0: {
            name: 'Pre_Analysis',
            status: 'success',
            start_time: 1000,
            end_time: 1010,
            duration_seconds: 10,
          },
          step_1: {
            name: 'Documentation',
            status: 'success',
            start_time: 1010,
            end_time: 1050,
            duration_seconds: 40,
          },
        },
      };

      const results = aggregateStepResults(metrics);

      expect(results).toHaveLength(2);
      expect(results[0].stepId).toBe('step_0');
      expect(results[0].name).toBe('Pre_Analysis');
      expect(results[0].duration).toBe(10);
      expect(results[1].stepId).toBe('step_1');
    });

    test('should sort results by start time', () => {
      const metrics = {
        steps: {
          step_1: { name: 'Step1', status: 'success', start_time: 2000, duration_seconds: 10 },
          step_0: { name: 'Step0', status: 'success', start_time: 1000, duration_seconds: 10 },
        },
      };

      const results = aggregateStepResults(metrics);

      expect(results[0].stepId).toBe('step_0');
      expect(results[1].stepId).toBe('step_1');
    });

    test('should return empty array for empty metrics', () => {
      expect(aggregateStepResults({})).toEqual([]);
      expect(aggregateStepResults(null)).toEqual([]);
      expect(aggregateStepResults({ steps: {} })).toEqual([]);
    });

    test('should handle missing fields gracefully', () => {
      const metrics = {
        steps: {
          step_0: {},
        },
      };

      const results = aggregateStepResults(metrics);

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Unknown_step_0');
      expect(results[0].status).toBe('unknown');
      expect(results[0].duration).toBe(0);
    });
  });

  describe('calculateWorkflowMetrics', () => {
    test('should calculate metrics correctly', () => {
      const stepResults = [
        { status: 'success', duration: 10 },
        { status: 'success', duration: 20 },
        { status: 'failed', duration: 15 },
        { status: 'skipped', duration: 0 },
      ];

      const metrics = calculateWorkflowMetrics(stepResults, {
        start_time: '2026-01-01T00:00:00Z',
        end_time: '2026-01-01T01:00:00Z',
        workflow_run_id: 'test_run',
        version: '1.0.0',
        mode: 'interactive',
      });

      expect(metrics.totalSteps).toBe(4);
      expect(metrics.successfulSteps).toBe(2);
      expect(metrics.failedSteps).toBe(1);
      expect(metrics.skippedSteps).toBe(1);
      expect(metrics.totalDuration).toBe(45);
      expect(metrics.avgDuration).toBe(11.25);
      expect(metrics.successRate).toBe(50);
      expect(metrics.workflowRunId).toBe('test_run');
      expect(metrics.version).toBe('1.0.0');
    });

    test('should handle empty step results', () => {
      const metrics = calculateWorkflowMetrics([]);

      expect(metrics.totalSteps).toBe(0);
      expect(metrics.successfulSteps).toBe(0);
      expect(metrics.avgDuration).toBe(0);
      expect(metrics.successRate).toBe(0);
    });

    test('should use default metadata when not provided', () => {
      const metrics = calculateWorkflowMetrics([{ status: 'success', duration: 10 }]);

      expect(metrics.workflowRunId).toBe('unknown');
      expect(metrics.version).toBe('unknown');
      expect(metrics.mode).toBe('unknown');
    });
  });

  describe('generateExecutionTimeline', () => {
    test('should generate timeline with steps and phases', () => {
      const stepResults = [
        {
          stepId: 'step_0',
          name: 'Pre_Analysis',
          status: 'success',
          duration: 10,
          startTime: 1000,
          endTime: 1010,
        },
        {
          stepId: 'step_1',
          name: 'Documentation',
          status: 'success',
          duration: 20,
          startTime: 1010,
          endTime: 1030,
        },
      ];

      const timeline = generateExecutionTimeline(stepResults);

      expect(timeline.steps).toHaveLength(2);
      expect(timeline.steps[0].id).toBe('step_0');
      expect(timeline.steps[0].name).toBe('Pre_Analysis');
      expect(timeline.phases).toBeDefined();
      expect(timeline.phases.initialization).toBeDefined();
    });
  });

  describe('groupStepsByPhase', () => {
    test('should group steps by phase correctly', () => {
      const stepResults = [
        { stepId: 'step_0', name: 'Step0' },
        { stepId: 'step_0b', name: 'Step0b' },
        { stepId: 'step_1', name: 'Step1' },
        { stepId: 'step_3', name: 'Step3' },
        { stepId: 'step_7', name: 'Step7' },
        { stepId: 'step_10', name: 'Step10' },
        { stepId: 'step_12', name: 'Step12' },
      ];

      const phases = groupStepsByPhase(stepResults);

      expect(phases.initialization).toHaveLength(2); // step_0, step_0b
      expect(phases.documentation).toHaveLength(1); // step_1
      expect(phases.validation).toHaveLength(1); // step_3
      expect(phases.testing).toHaveLength(1); // step_7
      expect(phases.quality).toHaveLength(1); // step_10
      expect(phases.finalization).toHaveLength(1); // step_12
    });

    test('should handle empty step results', () => {
      const phases = groupStepsByPhase([]);

      expect(phases.initialization).toEqual([]);
      expect(phases.documentation).toEqual([]);
    });
  });

  describe('detectBottlenecks', () => {
    test('should detect bottleneck steps', () => {
      const stepResults = [
        { name: 'FastStep', status: 'success', duration: 50 },
        { name: 'SlowStep', status: 'success', duration: 350 },
        { name: 'VerySlowStep', status: 'success', duration: 500 },
      ];

      const bottlenecks = detectBottlenecks(stepResults, 300);

      expect(bottlenecks).toHaveLength(2);
      expect(bottlenecks[0].name).toBe('VerySlowStep'); // Sorted by duration (descending)
      expect(bottlenecks[1].name).toBe('SlowStep');
    });

    test('should only include successful steps', () => {
      const stepResults = [
        { name: 'SlowSuccess', status: 'success', duration: 350 },
        { name: 'SlowFailed', status: 'failed', duration: 400 },
      ];

      const bottlenecks = detectBottlenecks(stepResults, 300);

      expect(bottlenecks).toHaveLength(1);
      expect(bottlenecks[0].name).toBe('SlowSuccess');
    });

    test('should return empty array when no bottlenecks', () => {
      const stepResults = [
        { name: 'FastStep', status: 'success', duration: 50 },
        { name: 'MediumStep', status: 'success', duration: 150 },
      ];

      const bottlenecks = detectBottlenecks(stepResults, 300);

      expect(bottlenecks).toEqual([]);
    });
  });

  describe('calculateCacheEfficiency', () => {
    test('should calculate cache efficiency', () => {
      const metrics = {
        cache_hits: 80,
        cache_misses: 20,
      };

      const efficiency = calculateCacheEfficiency(metrics);

      expect(efficiency.cacheHits).toBe(80);
      expect(efficiency.cacheMisses).toBe(20);
      expect(efficiency.totalRequests).toBe(100);
      expect(efficiency.hitRate).toBe(0.8);
      expect(efficiency.quality).toBe('excellent');
    });

    test('should classify cache quality correctly', () => {
      expect(calculateCacheEfficiency({ cache_hits: 85, cache_misses: 15 }).quality).toBe(
        'excellent'
      ); // 85% >= 80%
      expect(calculateCacheEfficiency({ cache_hits: 70, cache_misses: 30 }).quality).toBe('good'); // 70% >= 60%
      expect(calculateCacheEfficiency({ cache_hits: 40, cache_misses: 60 }).quality).toBe('poor'); // 40% < 60%
    });

    test('should handle zero requests', () => {
      const efficiency = calculateCacheEfficiency({ cache_hits: 0, cache_misses: 0 });

      expect(efficiency.hitRate).toBe(0);
      expect(efficiency.quality).toBe('poor');
    });

    test('should handle missing cache metrics', () => {
      const efficiency = calculateCacheEfficiency({});

      expect(efficiency.cacheHits).toBe(0);
      expect(efficiency.cacheMisses).toBe(0);
    });
  });

  describe('generateRecommendations', () => {
    test('should generate recommendations for bottlenecks', () => {
      const metrics = { failedSteps: 0, successRate: 100 };
      const stepResults = [{ name: 'SlowStep', status: 'success', duration: 350 }];
      const cacheEfficiency = {
        hitRate: 0.9,
        quality: 'excellent',
        cacheHits: 90,
        cacheMisses: 10,
      };

      const recommendations = generateRecommendations(metrics, stepResults, cacheEfficiency);

      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations.some((r) => r.type === RECOMMENDATION_TYPES.PERFORMANCE)).toBe(true);
    });

    test('should recommend cache improvements', () => {
      const metrics = { failedSteps: 0, successRate: 100 };
      const stepResults = [];
      const cacheEfficiency = { hitRate: 0.4, quality: 'poor', cacheHits: 40, cacheMisses: 60 };

      const recommendations = generateRecommendations(metrics, stepResults, cacheEfficiency);

      const cacheRec = recommendations.find((r) => r.type === RECOMMENDATION_TYPES.CACHING);
      expect(cacheRec).toBeDefined();
      expect(cacheRec.priority).toBe('high');
    });

    test('should recommend fixing failed steps', () => {
      const metrics = { failedSteps: 2, successRate: 75 };
      const stepResults = [
        { name: 'Step1', status: 'failed', duration: 10 },
        { name: 'Step2', status: 'failed', duration: 10 },
      ];
      const cacheEfficiency = { hitRate: 0.9, quality: 'excellent' };

      const recommendations = generateRecommendations(metrics, stepResults, cacheEfficiency);

      const failedRec = recommendations.find((r) => r.priority === 'critical');
      expect(failedRec).toBeDefined();
      expect(failedRec.title).toContain('Failed Steps');
    });

    test('should identify parallelization opportunities', () => {
      const metrics = { failedSteps: 0, successRate: 100 };
      const stepResults = [
        { stepId: 'step_3', name: 'Step3', status: 'success', duration: 50 },
        { stepId: 'step_4', name: 'Step4', status: 'success', duration: 50 },
        { stepId: 'step_5', name: 'Step5', status: 'success', duration: 50 },
      ];
      const cacheEfficiency = { hitRate: 0.9, quality: 'excellent' };

      const recommendations = generateRecommendations(metrics, stepResults, cacheEfficiency);

      const parallelRec = recommendations.find(
        (r) => r.type === RECOMMENDATION_TYPES.PARALLELIZATION
      );
      expect(parallelRec).toBeDefined();
    });
  });

  describe('identifyParallelizationOpportunities', () => {
    test('should identify validation phase opportunities', () => {
      const stepResults = [
        { stepId: 'step_3', name: 'Step3' },
        { stepId: 'step_4', name: 'Step4' },
        { stepId: 'step_5', name: 'Step5' },
      ];

      const opportunities = identifyParallelizationOpportunities(stepResults);

      expect(opportunities).toHaveLength(1);
      expect(opportunities[0]).toContain('Validation phase');
    });

    test('should identify quality phase opportunities', () => {
      const stepResults = [
        { stepId: 'step_10', name: 'Step10' },
        { stepId: 'step_11', name: 'Step11' },
      ];

      const opportunities = identifyParallelizationOpportunities(stepResults);

      expect(opportunities).toHaveLength(1);
      expect(opportunities[0]).toContain('Quality phase');
    });

    test('should return empty for insufficient steps', () => {
      const stepResults = [{ stepId: 'step_3', name: 'Step3' }];

      const opportunities = identifyParallelizationOpportunities(stepResults);

      expect(opportunities).toEqual([]);
    });
  });

  describe('formatSummaryReport', () => {
    test('should format complete summary report', () => {
      const metrics = {
        workflowRunId: 'test_run',
        version: '1.0.0',
        mode: 'interactive',
        startTime: '2026-01-01T00:00:00Z',
        endTime: '2026-01-01T01:00:00Z',
        totalDuration: 100,
        totalSteps: 5,
        successfulSteps: 5,
        failedSteps: 0,
        skippedSteps: 0,
        successRate: 100,
        avgDuration: 20,
      };

      const timeline = {
        steps: [
          {
            id: 'step_0',
            name: 'Pre_Analysis',
            status: 'success',
            duration: 10,
            startTime: 1000,
            endTime: 1010,
          },
        ],
        phases: { initialization: [], documentation: [] },
      };

      const recommendations = [
        {
          type: RECOMMENDATION_TYPES.PERFORMANCE,
          priority: 'high',
          title: 'Test Recommendation',
          description: 'Test description',
          suggestion: 'Test suggestion',
          details: ['Detail 1'],
        },
      ];

      const report = formatSummaryReport(metrics, timeline, recommendations);

      expect(report).toContain('# Workflow Summary Report');
      expect(report).toContain('test_run');
      expect(report).toContain('Executive Summary');
      expect(report).toContain('Execution Timeline');
      expect(report).toContain('Recommendations');
    });

    test('should not include recommendations section if empty', () => {
      const metrics = {
        workflowRunId: 'test_run',
        version: '1.0.0',
        totalDuration: 100,
        totalSteps: 1,
        successfulSteps: 1,
        failedSteps: 0,
        successRate: 100,
        avgDuration: 100,
      };

      const timeline = { steps: [], phases: {} };
      const recommendations = [];

      const report = formatSummaryReport(metrics, timeline, recommendations);

      expect(report).not.toContain('## Recommendations');
    });
  });

  describe('formatExecutiveSummary', () => {
    test('should format executive summary with success', () => {
      const metrics = {
        failedSteps: 0,
        successRate: 100,
        totalSteps: 10,
        successfulSteps: 10,
        skippedSteps: 0,
        avgDuration: 50,
      };

      const summary = formatExecutiveSummary(metrics);

      expect(summary).toContain('✅');
      expect(summary).toContain('100.0%');
      expect(summary).toContain('10');
    });

    test('should show failed steps', () => {
      const metrics = {
        failedSteps: 2,
        successRate: 80,
        totalSteps: 10,
        successfulSteps: 8,
        skippedSteps: 0,
        avgDuration: 50,
      };

      const summary = formatExecutiveSummary(metrics);

      expect(summary).toContain('❌');
      expect(summary).toContain('**Failed:** 2');
    });

    test('should show skipped steps', () => {
      const metrics = {
        failedSteps: 0,
        successRate: 80,
        totalSteps: 10,
        successfulSteps: 8,
        skippedSteps: 2,
        avgDuration: 50,
      };

      const summary = formatExecutiveSummary(metrics);

      expect(summary).toContain('**Skipped:** 2');
      expect(summary).toContain('⏭️');
    });
  });

  describe('getOverallStatusText', () => {
    test('should return failed status', () => {
      const metrics = { failedSteps: 1, successRate: 90 };
      expect(getOverallStatusText(metrics)).toContain('Failed');
    });

    test('should return success status', () => {
      const metrics = { failedSteps: 0, successRate: 100, skippedSteps: 0 };
      expect(getOverallStatusText(metrics)).toContain('Success');
    });

    test('should return partial success status', () => {
      const metrics = { failedSteps: 0, successRate: 80, skippedSteps: 2 };
      expect(getOverallStatusText(metrics)).toContain('Partial Success');
    });
  });

  describe('formatTimeline', () => {
    test('should format timeline with steps', () => {
      const timeline = {
        steps: [
          { id: 'step_0', name: 'Pre_Analysis', status: 'success', duration: 10 },
          { id: 'step_1', name: 'Documentation', status: 'failed', duration: 20 },
        ],
      };

      const formatted = formatTimeline(timeline);

      expect(formatted).toContain('✅');
      expect(formatted).toContain('❌');
      expect(formatted).toContain('Pre_Analysis');
      expect(formatted).toContain('Documentation');
      expect(formatted).toContain('10s');
      expect(formatted).toContain('20s');
    });
  });

  describe('formatPhaseBreakdown', () => {
    test('should format phase breakdown', () => {
      const phases = {
        initialization: [
          { name: 'Step0', status: 'success', duration: 10 },
          { name: 'Step0b', status: 'success', duration: 5 },
        ],
        documentation: [{ name: 'Step1', status: 'success', duration: 30 }],
      };

      const formatted = formatPhaseBreakdown(phases);

      expect(formatted).toContain('Initialization Phase');
      expect(formatted).toContain('Documentation Phase');
      expect(formatted).toContain('**Steps:** 2');
      expect(formatted).toContain('**Steps:** 1');
    });

    test('should skip empty phases', () => {
      const phases = {
        initialization: [{ name: 'Step0', status: 'success', duration: 10 }],
        documentation: [],
      };

      const formatted = formatPhaseBreakdown(phases);

      expect(formatted).toContain('Initialization Phase');
      expect(formatted).not.toContain('Documentation Phase');
    });
  });

  describe('formatPerformanceMetrics', () => {
    test('should format metrics as table', () => {
      const metrics = {
        totalDuration: 3600,
        avgDuration: 360,
        totalSteps: 10,
        successRate: 95.5,
      };

      const formatted = formatPerformanceMetrics(metrics);

      expect(formatted).toContain('| Metric | Value |');
      expect(formatted).toContain('1h');
      expect(formatted).toContain('6m');
      expect(formatted).toContain('10');
      expect(formatted).toContain('95.5%');
    });
  });

  describe('formatRecommendations', () => {
    test('should format recommendations sorted by priority', () => {
      const recommendations = [
        {
          type: 'perf',
          priority: 'medium',
          title: 'Medium',
          description: 'Med desc',
          suggestion: 'Med sug',
          details: [],
        },
        {
          type: 'perf',
          priority: 'critical',
          title: 'Critical',
          description: 'Crit desc',
          suggestion: 'Crit sug',
          details: [],
        },
        {
          type: 'perf',
          priority: 'high',
          title: 'High',
          description: 'High desc',
          suggestion: 'High sug',
          details: [],
        },
      ];

      const formatted = formatRecommendations(recommendations);

      const lines = formatted.split('\n');
      const titles = lines.filter((l) => l.startsWith('###'));

      expect(titles[0]).toContain('Critical'); // Should be first
      expect(titles[1]).toContain('High');
      expect(titles[2]).toContain('Medium');
    });

    test('should include details when provided', () => {
      const recommendations = [
        {
          type: 'perf',
          priority: 'high',
          title: 'Test',
          description: 'Desc',
          suggestion: 'Sug',
          details: ['Detail 1', 'Detail 2'],
        },
      ];

      const formatted = formatRecommendations(recommendations);

      expect(formatted).toContain('**Details:**');
      expect(formatted).toContain('Detail 1');
      expect(formatted).toContain('Detail 2');
    });
  });

  describe('Utility Functions', () => {
    describe('formatDuration', () => {
      test('should format seconds', () => {
        expect(formatDuration(45)).toBe('45s');
        expect(formatDuration(0)).toBe('0s');
      });

      test('should format minutes', () => {
        expect(formatDuration(60)).toBe('1m');
        expect(formatDuration(90)).toBe('1m 30s');
        expect(formatDuration(120)).toBe('2m');
      });

      test('should format hours', () => {
        expect(formatDuration(3600)).toBe('1h');
        expect(formatDuration(3660)).toBe('1h 1m');
        expect(formatDuration(7200)).toBe('2h');
      });
    });

    describe('getStatusIcon', () => {
      test('should return correct icons', () => {
        expect(getStatusIcon('success')).toBe('✅');
        expect(getStatusIcon('failed')).toBe('❌');
        expect(getStatusIcon('skipped')).toBe('⏭️');
        expect(getStatusIcon('unknown')).toBe('❓');
        expect(getStatusIcon('invalid')).toBe('❓');
      });
    });

    describe('getPriorityIcon', () => {
      test('should return correct priority icons', () => {
        expect(getPriorityIcon('critical')).toBe('🔴');
        expect(getPriorityIcon('high')).toBe('🟠');
        expect(getPriorityIcon('medium')).toBe('🟡');
        expect(getPriorityIcon('low')).toBe('🟢');
        expect(getPriorityIcon('invalid')).toBe('⚪');
      });
    });

    describe('capitalize', () => {
      test('should capitalize first letter', () => {
        expect(capitalize('hello')).toBe('Hello');
        expect(capitalize('HELLO')).toBe('HELLO');
        expect(capitalize('h')).toBe('H');
        expect(capitalize('')).toBe('');
      });
    });
  });

  describe('Constants', () => {
    test('PHASE_NAMES should be frozen', () => {
      expect(Object.isFrozen(PHASE_NAMES)).toBe(true);
    });

    test('PERFORMANCE_THRESHOLDS should be frozen', () => {
      expect(Object.isFrozen(PERFORMANCE_THRESHOLDS)).toBe(true);
    });

    test('RECOMMENDATION_TYPES should be frozen', () => {
      expect(Object.isFrozen(RECOMMENDATION_TYPES)).toBe(true);
    });
  });
});

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

describe('Step 17: Workflow Summary - Integration Tests', () => {
  let workflowSummary;
  const testDir = '.test_workflow';

  beforeEach(async () => {
    workflowSummary = new WorkflowSummary(testDir);

    // Create test directories
    await fs.mkdir(path.join(testDir, 'metrics'), { recursive: true });
    await fs.mkdir(path.join(testDir, 'summaries'), { recursive: true });
  });

  afterEach(async () => {
    // Clean up test directory
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('WorkflowSummary Class', () => {
    test('should initialize with correct paths', () => {
      expect(workflowSummary.workflowDir).toBe(testDir);
      expect(workflowSummary.metricsDir).toBe(path.join(testDir, 'metrics'));
      expect(workflowSummary.summariesDir).toBe(path.join(testDir, 'summaries'));
    });

    test('should read metrics from file', async () => {
      const metricsData = {
        workflow_run_id: 'test_run',
        version: '1.0.0',
        steps: {
          step_0: { name: 'Pre_Analysis', status: 'success', duration_seconds: 10 },
        },
      };

      await fs.writeFile(
        path.join(testDir, 'metrics', 'current_run.json'),
        JSON.stringify(metricsData)
      );

      const metrics = await workflowSummary.readMetrics();

      expect(metrics.workflow_run_id).toBe('test_run');
      expect(metrics.steps.step_0.name).toBe('Pre_Analysis');
    });

    test('should handle missing metrics file', async () => {
      const metrics = await workflowSummary.readMetrics();

      expect(metrics).toEqual({ steps: {} });
    });

    test('should write summary report', async () => {
      const report = '# Test Report\n\nContent here';
      const workflowRunId = 'test_run_123';

      const reportPath = await workflowSummary.writeSummaryReport(report, workflowRunId);

      expect(reportPath).toBe(
        path.join(testDir, 'summaries', workflowRunId, 'workflow_summary.md')
      );

      const writtenContent = await fs.readFile(reportPath, 'utf-8');
      expect(writtenContent).toBe(report);
    });

    test('should generate complete summary', async () => {
      const metricsData = {
        workflow_run_id: 'test_run',
        start_time: '2026-01-01T00:00:00Z',
        version: '1.0.0',
        mode: 'interactive',
        steps: {
          step_0: {
            name: 'Pre_Analysis',
            status: 'success',
            start_time: 1000,
            end_time: 1010,
            duration_seconds: 10,
          },
          step_1: {
            name: 'Documentation',
            status: 'success',
            start_time: 1010,
            end_time: 1050,
            duration_seconds: 40,
          },
        },
        cache_hits: 80,
        cache_misses: 20,
      };

      await fs.writeFile(
        path.join(testDir, 'metrics', 'current_run.json'),
        JSON.stringify(metricsData)
      );

      const summary = await workflowSummary.generateSummary();

      expect(summary.metrics.totalSteps).toBe(2);
      expect(summary.metrics.successfulSteps).toBe(2);
      expect(summary.timeline.steps).toHaveLength(2);
      expect(summary.cacheEfficiency.hitRate).toBe(0.8);
      expect(summary.report).toContain('# Workflow Summary Report');
    });

    test('should handle dry run mode', async () => {
      const metricsData = {
        workflow_run_id: 'test_run',
        steps: { step_0: { name: 'Test', status: 'success', duration_seconds: 10 } },
      };

      await fs.writeFile(
        path.join(testDir, 'metrics', 'current_run.json'),
        JSON.stringify(metricsData)
      );

      await workflowSummary.generateSummary({ dryRun: true });

      // Verify no summary file was created
      const files = await fs.readdir(path.join(testDir, 'summaries'));
      expect(files.length).toBe(0);
    });

    test('should execute step 17', async () => {
      const metricsData = {
        workflow_run_id: 'test_run',
        steps: { step_0: { name: 'Test', status: 'success', duration_seconds: 10 } },
      };

      await fs.writeFile(
        path.join(testDir, 'metrics', 'current_run.json'),
        JSON.stringify(metricsData)
      );

      const result = await workflowSummary.execute({ dryRun: true });

      expect(result.success).toBe(true);
      expect(result.summary).toBeDefined();
      expect(result.message).toContain('successfully');
    });

    test('should handle missing metrics gracefully', async () => {
      // Don't create metrics file - should handle gracefully with empty data

      const result = await workflowSummary.execute({ dryRun: true });

      expect(result.success).toBe(true);
      expect(result.summary).toBeDefined();
      expect(result.summary.metrics.totalSteps).toBe(0);
    });
  });

  describe('End-to-End Workflow', () => {
    test('should generate complete workflow summary', async () => {
      const metricsData = {
        workflow_run_id: 'workflow_20260210_123456',
        start_time: '2026-02-10T12:00:00Z',
        end_time: '2026-02-10T13:00:00Z',
        version: '2.0.0',
        mode: 'interactive',
        steps: {
          step_0: {
            name: 'Pre_Analysis',
            status: 'success',
            start_time: 1707566400,
            end_time: 1707566410,
            duration_seconds: 10,
          },
          step_1: {
            name: 'Documentation_Updates',
            status: 'success',
            start_time: 1707566410,
            end_time: 1707566650,
            duration_seconds: 240,
          },
          step_3: {
            name: 'Script_Reference_Validation',
            status: 'success',
            start_time: 1707566650,
            end_time: 1707566800,
            duration_seconds: 150,
          },
        },
        cache_hits: 90,
        cache_misses: 10,
      };

      await fs.writeFile(
        path.join(testDir, 'metrics', 'current_run.json'),
        JSON.stringify(metricsData)
      );

      const summary = await workflowSummary.generateSummary();

      // Verify metrics
      expect(summary.metrics.totalSteps).toBe(3);
      expect(summary.metrics.successRate).toBe(100);
      expect(summary.metrics.totalDuration).toBe(400);

      // Verify timeline
      expect(summary.timeline.steps).toHaveLength(3);

      // Verify cache efficiency
      expect(summary.cacheEfficiency.hitRate).toBe(0.9);
      expect(summary.cacheEfficiency.quality).toBe('excellent');

      // Verify recommendations
      expect(summary.recommendations.length).toBeGreaterThan(0);

      // Verify report
      expect(summary.report).toContain('workflow_20260210_123456');
      expect(summary.report).toContain('100.0%');
      expect(summary.report).toContain('Pre_Analysis');

      // Verify file was created
      const reportPath = path.join(
        testDir,
        'summaries',
        'workflow_20260210_123456',
        'workflow_summary.md'
      );
      const reportExists = await fs
        .access(reportPath)
        .then(() => true)
        .catch(() => false);
      expect(reportExists).toBe(true);
    });
  });
});
