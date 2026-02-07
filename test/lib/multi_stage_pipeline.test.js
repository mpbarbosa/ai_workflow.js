/**
 * @fileoverview Tests for Multi-Stage Pipeline Execution (v2.0.0)
 * @module test/lib/multi_stage_pipeline
 */

import {
  groupStepsByStage,
  selectStagesByTime,
  selectStagesByChanges,
  estimateStageDuration,
  buildStagePlan,
  shouldSkipStage,
  calculatePipelineProgress,
  formatStageDuration,
  MultiStagePipeline,
  PIPELINE_STAGES,
} from '../../src/lib/multi_stage_pipeline.js';

describe('Multi-Stage Pipeline', () => {
  // ==========================================================================
  // PURE FUNCTION TESTS
  // ==========================================================================

  describe('groupStepsByStage', () => {
    test('groups steps correctly', () => {
      const steps = ['step1', 'step2', 'step9', 'step15'];
      const grouped = groupStepsByStage(steps);

      expect(grouped.quick).toContain('step1');
      expect(grouped.quick).toContain('step15');
      expect(grouped.medium).toContain('step2');
      expect(grouped.medium).toContain('step9');
    });

    test('handles unknown steps', () => {
      const steps = ['step1', 'unknown_step', 'step2'];
      const grouped = groupStepsByStage(steps);

      expect(grouped.unknown).toContain('unknown_step');
    });

    test('handles empty steps', () => {
      const grouped = groupStepsByStage([]);

      expect(grouped.quick).toEqual([]);
      expect(grouped.medium).toEqual([]);
      expect(grouped.full).toEqual([]);
    });
  });

  describe('selectStagesByTime', () => {
    test('selects quick stage for 5 minutes', () => {
      const stages = selectStagesByTime(300);
      expect(stages).toEqual(['quick']);
    });

    test('selects quick and medium for 30 minutes', () => {
      const stages = selectStagesByTime(1800);
      expect(stages).toEqual(['quick', 'medium']);
    });

    test('selects all stages for 80 minutes', () => {
      const stages = selectStagesByTime(4800);
      expect(stages).toEqual(['quick', 'medium', 'full']);
    });

    test('defaults to quick for very short time', () => {
      const stages = selectStagesByTime(60);
      expect(stages).toEqual(['quick']);
    });

    test('handles zero time budget', () => {
      const stages = selectStagesByTime(0);
      expect(stages).toEqual(['quick']);
    });
  });

  describe('selectStagesByChanges', () => {
    test('selects quick for docs-only with high confidence', () => {
      const analysis = {
        strategy: 'docs_only',
        confidence: 0.9,
      };
      const stages = selectStagesByChanges(analysis);

      expect(stages).toEqual(['quick']);
    });

    test('selects quick and medium for code changes', () => {
      const analysis = {
        strategy: 'code_changes',
        confidence: 0.8,
      };
      const stages = selectStagesByChanges(analysis);

      expect(stages).toEqual(['quick', 'medium']);
    });

    test('selects all stages for low confidence', () => {
      const analysis = {
        strategy: 'code_changes',
        confidence: 0.5,
      };
      const stages = selectStagesByChanges(analysis);

      expect(stages).toEqual(PIPELINE_STAGES);
    });

    test('selects all stages for null analysis', () => {
      const stages = selectStagesByChanges(null);
      expect(stages).toEqual(PIPELINE_STAGES);
    });

    test('selects all stages for ml_prediction', () => {
      const analysis = {
        strategy: 'ml_prediction',
        confidence: 0.7,
      };
      const stages = selectStagesByChanges(analysis);

      expect(stages).toEqual(PIPELINE_STAGES);
    });
  });

  describe('estimateStageDuration', () => {
    test('estimates quick stage duration', () => {
      const duration = estimateStageDuration(['quick']);
      expect(duration).toBe(300);
    });

    test('estimates multiple stages', () => {
      const duration = estimateStageDuration(['quick', 'medium']);
      expect(duration).toBe(2100); // 300 + 1800
    });

    test('estimates all stages', () => {
      const duration = estimateStageDuration(PIPELINE_STAGES);
      expect(duration).toBe(6900); // 300 + 1800 + 4800
    });

    test('handles empty stages', () => {
      const duration = estimateStageDuration([]);
      expect(duration).toBe(0);
    });
  });

  describe('buildStagePlan', () => {
    test('builds plan for quick stage', () => {
      const grouped = {
        quick: ['step1', 'step15'],
        medium: [],
        full: [],
      };
      const plan = buildStagePlan(['quick'], grouped);

      expect(plan.length).toBe(1);
      expect(plan[0].stage).toBe('quick');
      expect(plan[0].steps).toEqual(['step1', 'step15']);
      expect(plan[0].maxDuration).toBe(300);
    });

    test('builds plan for multiple stages', () => {
      const grouped = {
        quick: ['step1'],
        medium: ['step2', 'step9'],
        full: ['step7'],
      };
      const plan = buildStagePlan(['quick', 'medium', 'full'], grouped);

      expect(plan.length).toBe(3);
      expect(plan[0].stage).toBe('quick');
      expect(plan[1].stage).toBe('medium');
      expect(plan[2].stage).toBe('full');
    });

    test('includes stage metadata', () => {
      const grouped = { quick: ['step1'], medium: [], full: [] };
      const plan = buildStagePlan(['quick'], grouped);

      expect(plan[0].name).toBe('Quick Validation');
      expect(plan[0].description).toContain('Fast validation');
      expect(plan[0].priority).toBe(1);
    });

    test('skips stages with no steps', () => {
      const grouped = {
        quick: ['step1'],
        medium: [],
        full: ['step7'],
      };
      const plan = buildStagePlan(['quick', 'medium', 'full'], grouped);

      // Medium should be skipped as it has no steps
      expect(plan.length).toBe(2);
      expect(plan.map((p) => p.stage)).toEqual(['quick', 'full']);
    });
  });

  describe('shouldSkipStage', () => {
    test('never skips quick stage', () => {
      const results = [{ stage: 'quick', status: 'failed' }];
      expect(shouldSkipStage('quick', results)).toBe(false);
    });

    test('skips stage if previous failed', () => {
      const results = [{ stage: 'quick', status: 'failed' }];
      expect(shouldSkipStage('medium', results)).toBe(true);
    });

    test('does not skip if all previous succeeded', () => {
      const results = [{ stage: 'quick', status: 'completed' }];
      expect(shouldSkipStage('medium', results)).toBe(false);
    });

    test('handles empty results', () => {
      expect(shouldSkipStage('medium', [])).toBe(false);
    });
  });

  describe('calculatePipelineProgress', () => {
    test('calculates progress for completed stages', () => {
      const results = [
        { stage: 'quick', status: 'completed' },
        { stage: 'medium', status: 'completed' },
      ];
      const progress = calculatePipelineProgress(results, ['quick', 'medium', 'full']);

      expect(progress.completedStages).toBe(2);
      expect(progress.failedStages).toBe(0);
      expect(progress.totalStages).toBe(3);
      expect(progress.percentComplete).toBe(67);
      expect(progress.isComplete).toBe(false);
    });

    test('detects failures', () => {
      const results = [
        { stage: 'quick', status: 'completed' },
        { stage: 'medium', status: 'failed' },
      ];
      const progress = calculatePipelineProgress(results, ['quick', 'medium']);

      expect(progress.hasFailures).toBe(true);
      expect(progress.isComplete).toBe(true);
    });

    test('handles empty results', () => {
      const progress = calculatePipelineProgress([], ['quick']);

      expect(progress.completedStages).toBe(0);
      expect(progress.percentComplete).toBe(0);
    });
  });

  describe('formatStageDuration', () => {
    test('formats seconds', () => {
      expect(formatStageDuration(45)).toBe('45s');
    });

    test('formats minutes and seconds', () => {
      expect(formatStageDuration(125)).toBe('2m 5s');
    });

    test('formats hours and minutes', () => {
      expect(formatStageDuration(7260)).toBe('2h 1m');
    });
  });

  // ==========================================================================
  // INTEGRATION TESTS
  // ==========================================================================

  describe('MultiStagePipeline', () => {
    let pipeline;

    beforeEach(() => {
      pipeline = new MultiStagePipeline();
    });

    describe('constructor', () => {
      test('initializes with default options', () => {
        expect(pipeline.failFast).toBe(true);
        expect(pipeline.currentPlan).toBeNull();
        expect(pipeline.stageResults).toEqual([]);
      });

      test('accepts custom fail-fast option', () => {
        const custom = new MultiStagePipeline({ failFast: false });
        expect(custom.failFast).toBe(false);
      });
    });

    describe('plan', () => {
      test('creates execution plan for all steps', () => {
        const steps = ['step1', 'step2', 'step9', 'step15'];
        const plan = pipeline.plan(steps);

        expect(plan.stages).toEqual(PIPELINE_STAGES);
        expect(plan.plan.length).toBeGreaterThan(0);
        expect(plan.estimatedDuration).toBeGreaterThan(0);
      });

      test('plans based on time budget', () => {
        const steps = ['step1', 'step2', 'step15'];
        const plan = pipeline.plan(steps, { timeBudget: 300 });

        expect(plan.stages).toEqual(['quick']);
      });

      test('plans based on change analysis', () => {
        const steps = ['step1', 'step2', 'step15'];
        const changeAnalysis = {
          strategy: 'docs_only',
          confidence: 0.9,
        };
        const plan = pipeline.plan(steps, { changeAnalysis });

        expect(plan.stages).toEqual(['quick']);
      });

      test('groups steps correctly', () => {
        const steps = ['step1', 'step2', 'step9', 'step15'];
        const plan = pipeline.plan(steps);

        expect(plan.grouped.quick).toContain('step1');
        expect(plan.grouped.quick).toContain('step15');
        expect(plan.grouped.medium).toContain('step2');
        expect(plan.grouped.medium).toContain('step9');
      });
    });

    describe('execute', () => {
      test('executes all planned stages successfully', async () => {
        const steps = ['step1', 'step15'];
        pipeline.plan(steps, { timeBudget: 300 });

        const executor = async (stage, stageSteps) => {
          return { success: true, steps: stageSteps };
        };

        const results = await pipeline.execute(executor);

        expect(results.success).toBe(true);
        expect(results.results.length).toBe(1);
        expect(results.results[0].status).toBe('completed');
      });

      test('stops on first failure with fail-fast', async () => {
        const steps = ['step1', 'step2', 'step9', 'step15'];
        pipeline.plan(steps);

        let stageCount = 0;
        const executor = async (stage) => {
          stageCount++;
          if (stage === 'quick') return { success: false };
          return { success: true };
        };

        const results = await pipeline.execute(executor);

        expect(results.success).toBe(false);
        expect(stageCount).toBe(1); // Should stop after first stage
      });

      test('continues after failure without fail-fast', async () => {
        pipeline = new MultiStagePipeline({ failFast: false });
        const steps = ['step1', 'step2', 'step9', 'step15'];
        pipeline.plan(steps);

        const executor = async (stage) => {
          if (stage === 'quick') return { success: false };
          return { success: true };
        };

        const results = await pipeline.execute(executor);

        expect(results.success).toBe(false);
        // With fail-fast=false, all stages are in results but skipped after failure
        // Only 2 stages (quick, medium) as full has no steps for these inputs
        expect(results.results.length).toBe(2);
        expect(results.results[0].status).toBe('failed'); // quick failed
        expect(results.results[1].status).toBe('skipped'); // medium skipped
      });

      test('throws error if no plan', async () => {
        const executor = async () => ({ success: true });

        await expect(pipeline.execute(executor)).rejects.toThrow('No execution plan');
      });

      test('throws error if no executor', async () => {
        pipeline.plan(['step1']);

        await expect(pipeline.execute()).rejects.toThrow('No stage executor');
      });

      test('handles executor errors', async () => {
        const steps = ['step1'];
        pipeline.plan(steps, { timeBudget: 300 });

        const executor = async () => {
          throw new Error('Execution failed');
        };

        const results = await pipeline.execute(executor);

        expect(results.success).toBe(false);
        expect(results.results[0].status).toBe('failed');
        expect(results.results[0].error).toBe('Execution failed');
      });

      test('skips stages after failure', async () => {
        pipeline = new MultiStagePipeline({ failFast: false });
        const steps = ['step1', 'step2', 'step9', 'step7', 'step15'];
        pipeline.plan(steps);

        const executor = async (stage) => {
          if (stage === 'medium') return { success: false };
          return { success: true };
        };

        const results = await pipeline.execute(executor);

        const fullStageResult = results.results.find((r) => r.stage === 'full');
        expect(fullStageResult).toBeDefined();
        expect(fullStageResult.status).toBe('skipped');
      });

      test('records stage durations', async () => {
        const steps = ['step1'];
        pipeline.plan(steps, { timeBudget: 300 });

        const executor = async () => {
          await new Promise((resolve) => setTimeout(resolve, 50));
          return { success: true };
        };

        const results = await pipeline.execute(executor);

        expect(results.results[0].duration).toBeGreaterThanOrEqual(0);
        expect(results.duration).toBeGreaterThanOrEqual(0);
      });
    });

    describe('getStatus', () => {
      test('returns null before planning', () => {
        expect(pipeline.getStatus()).toBeNull();
      });

      test('returns status after planning', () => {
        pipeline.plan(['step1']);
        const status = pipeline.getStatus();

        expect(status).not.toBeNull();
        expect(status.plan).toBeDefined();
        expect(status.progress).toBeDefined();
      });

      test('includes elapsed time during execution', async () => {
        pipeline.plan(['step1'], { timeBudget: 300 });

        const executor = async () => {
          await new Promise((resolve) => setTimeout(resolve, 100));
          return { success: true };
        };

        // Start execution (don't await)
        const execution = pipeline.execute(executor);

        // Get status during execution
        await new Promise((resolve) => setTimeout(resolve, 50));
        const status = pipeline.getStatus();

        expect(status.elapsed).toBeGreaterThanOrEqual(0);

        // Wait for completion
        await execution;
      });
    });

    describe('reset', () => {
      test('clears pipeline state', async () => {
        pipeline.plan(['step1']);
        const executor = async () => ({ success: true });
        await pipeline.execute(executor);

        pipeline.reset();

        expect(pipeline.currentPlan).toBeNull();
        expect(pipeline.stageResults).toEqual([]);
      });
    });

    describe('end-to-end workflow', () => {
      test('complete pipeline execution with all stages', async () => {
        const steps = ['step1', 'step2', 'step9', 'step7', 'step15'];

        // Step 1: Plan
        const plan = pipeline.plan(steps);
        expect(plan.stages).toEqual(PIPELINE_STAGES);

        // Step 2: Execute
        const executedStages = [];
        const executor = async (stage, stageSteps) => {
          executedStages.push(stage);
          return { success: true, steps: stageSteps };
        };

        const results = await pipeline.execute(executor);

        // Step 3: Verify
        expect(results.success).toBe(true);
        expect(executedStages).toEqual(['quick', 'medium', 'full']);
        expect(results.progress.percentComplete).toBe(100);

        // Step 4: Get status
        const status = pipeline.getStatus();
        expect(status.progress.isComplete).toBe(true);
      });

      test('quick validation for docs-only changes', async () => {
        const steps = ['step1', 'step2', 'step15'];
        const changeAnalysis = {
          strategy: 'docs_only',
          confidence: 0.95,
        };

        // Plan with change analysis
        const plan = pipeline.plan(steps, { changeAnalysis });
        expect(plan.stages).toEqual(['quick']);

        // Execute
        const executor = async (stage, stageSteps) => {
          return { success: true, steps: stageSteps };
        };

        const results = await pipeline.execute(executor);

        expect(results.success).toBe(true);
        expect(results.results.length).toBe(1);
        expect(results.results[0].stage).toBe('quick');
      });
    });
  });
});
