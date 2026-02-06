/**
 * @fileoverview Tests for Conditional Executor Module
 * @module test/orchestrator/conditional_executor
 */

import {
  shouldSkipStep,
  adaptStepToProjectKind,
  calculateChangeImpact,
  evaluateCondition,
  buildSkipReason,
  matchesPattern,
  filterFilesByPattern,
  doesChangeAffectStep,
  calculateStepPriority,
  ConditionalExecutor,
} from '../../src/orchestrator/conditional_executor.js';

describe('Conditional Executor Module', () => {
  // ============================================================================
  // Pure Function Tests
  // ============================================================================

  describe('Pure Functions - shouldSkipStep', () => {
    test('skips step with skip flag', () => {
      const step = { id: 'step1', skip: true };
      const result = shouldSkipStep(step);

      expect(result.shouldSkip).toBe(true);
      expect(result.reason).toBe('Step marked to skip');
    });

    test('skips disabled step', () => {
      const step = { id: 'step1', enabled: false };
      const result = shouldSkipStep(step);

      expect(result.shouldSkip).toBe(true);
      expect(result.reason).toBe('Step is disabled');
    });

    test('skips non-critical step with no changes', () => {
      const step = { id: 'step1', critical: false };
      const result = shouldSkipStep(step, { files: [] });

      expect(result.shouldSkip).toBe(true);
      expect(result.reason).toBe('No changes detected');
    });

    test('does not skip critical step with no changes', () => {
      const step = { id: 'step1', critical: true };
      const result = shouldSkipStep(step, { files: [] });

      expect(result.shouldSkip).toBe(false);
    });

    test('skips non-critical step for low impact', () => {
      const step = { id: 'step1', phase: 'testing' };
      const result = shouldSkipStep(step, { files: ['README.md'] }, 'low');

      expect(result.shouldSkip).toBe(true);
      expect(result.reason).toContain('Low impact');
    });

    test('does not skip analysis phase for low impact', () => {
      const step = { id: 'step1', phase: 'analysis' };
      const result = shouldSkipStep(step, { files: ['README.md'] }, 'low');

      expect(result.shouldSkip).toBe(false);
    });

    test('evaluates skip conditions', () => {
      const step = {
        id: 'step1',
        phase: 'analysis', // Won't be skipped by smart execution
        skipConditions: [{ type: 'impact', value: 'low', reason: 'Low impact skip' }],
      };
      const result = shouldSkipStep(step, { files: ['test.js'] }, 'low');

      expect(result.shouldSkip).toBe(true);
      expect(result.reason).toBe('Low impact skip');
    });
  });

  describe('Pure Functions - adaptStepToProjectKind', () => {
    test('returns original step if no adaptations', () => {
      const step = { id: 'step1', name: 'Test' };
      const result = adaptStepToProjectKind(step, 'nodejs_api');

      expect(result).toEqual(step);
    });

    test('applies project-specific adaptations', () => {
      const step = {
        id: 'step1',
        name: 'Test',
        timeout: 300,
        projectAdaptations: {
          nodejs_api: { timeout: 600, tags: ['backend'] },
        },
      };
      const result = adaptStepToProjectKind(step, 'nodejs_api');

      expect(result.timeout).toBe(600);
      expect(result.tags).toEqual(['backend']);
      expect(result.metadata.adaptedFor).toBe('nodejs_api');
    });

    test('returns original if project kind not found', () => {
      const step = {
        id: 'step1',
        projectAdaptations: {
          react_spa: { timeout: 400 },
        },
      };
      const result = adaptStepToProjectKind(step, 'nodejs_api');

      expect(result).toEqual(step);
    });
  });

  describe('Pure Functions - calculateChangeImpact', () => {
    test('returns none for no changes', () => {
      expect(calculateChangeImpact({})).toBe('none');
      expect(calculateChangeImpact({ files: [] })).toBe('none');
    });

    test('returns low for documentation changes', () => {
      const result = calculateChangeImpact({
        files: ['README.md', 'CHANGELOG.md'],
      });

      expect(result).toBe('low');
    });

    test('returns low for test changes', () => {
      const result = calculateChangeImpact({
        files: ['test.spec.js', 'test2.test.ts'],
      });

      expect(result).toBe('low');
    });

    test('returns medium for few code changes', () => {
      const result = calculateChangeImpact({
        files: ['src/app.js', 'src/utils.js'],
      });

      expect(result).toBe('medium');
    });

    test('returns high for many code changes', () => {
      const files = Array.from({ length: 15 }, (_, i) => `src/file${i}.js`);
      const result = calculateChangeImpact({ files });

      expect(result).toBe('high');
    });

    test('returns medium for config changes', () => {
      const result = calculateChangeImpact({
        files: ['package.json', 'tsconfig.json', '.eslintrc.json'],
      });

      expect(result).toBe('medium');
    });

    test('returns high for many config changes', () => {
      const files = Array.from({ length: 7 }, (_, i) => `config${i}.json`);
      const result = calculateChangeImpact({ files });

      expect(result).toBe('high');
    });
  });

  describe('Pure Functions - evaluateCondition', () => {
    test('evaluates boolean condition', () => {
      expect(evaluateCondition(true)).toBe(true);
      expect(evaluateCondition(false)).toBe(false);
    });

    test('evaluates function condition', () => {
      const condition = (ctx) => ctx.value > 10;

      expect(evaluateCondition(condition, { value: 15 })).toBe(true);
      expect(evaluateCondition(condition, { value: 5 })).toBe(false);
    });

    test('evaluates impact condition', () => {
      const condition = { type: 'impact', value: 'low' };

      expect(evaluateCondition(condition, { impact: 'low' })).toBe(true);
      expect(evaluateCondition(condition, { impact: 'high' })).toBe(false);
    });

    test('evaluates filePattern condition', () => {
      const condition = { type: 'filePattern', value: '\\.md$' };
      const context = { changes: { files: ['README.md', 'src/app.js'] } };

      expect(evaluateCondition(condition, context)).toBe(true);
    });

    test('evaluates phase condition', () => {
      const condition = { type: 'phase', value: 'testing' };

      expect(evaluateCondition(condition, { step: { phase: 'testing' } })).toBe(true);
      expect(evaluateCondition(condition, { step: { phase: 'analysis' } })).toBe(false);
    });

    test('handles function errors gracefully', () => {
      const condition = () => {
        throw new Error('Error');
      };

      expect(evaluateCondition(condition, {})).toBe(false);
    });
  });

  describe('Pure Functions - buildSkipReason', () => {
    test('uses provided reason', () => {
      const step = { id: 'step1' };
      const result = buildSkipReason(step, { reason: 'Custom reason' });

      expect(result).toBe('Custom reason');
    });

    test('builds reason from context', () => {
      const step = { id: 'step1' };
      const result = buildSkipReason(step, {
        impact: 'low',
        changes: { files: ['file1.js', 'file2.js'] },
      });

      expect(result).toContain('step1');
      expect(result).toContain('low');
      expect(result).toContain('2 files');
    });
  });

  describe('Pure Functions - matchesPattern', () => {
    test('matches RegExp pattern', () => {
      expect(matchesPattern('test.js', /\.js$/)).toBe(true);
      expect(matchesPattern('test.ts', /\.js$/)).toBe(false);
    });

    test('matches string glob pattern', () => {
      expect(matchesPattern('test.js', '*.js')).toBe(true);
      expect(matchesPattern('src/test.js', '*.js')).toBe(true);
      expect(matchesPattern('test.ts', '*.js')).toBe(false);
    });

    test('matches with ? wildcard', () => {
      expect(matchesPattern('test1.js', 'test?.js')).toBe(true);
      expect(matchesPattern('test12.js', 'test?.js')).toBe(false);
    });
  });

  describe('Pure Functions - filterFilesByPattern', () => {
    test('filters files by single pattern', () => {
      const files = ['test.js', 'app.js', 'README.md'];
      const result = filterFilesByPattern(files, '*.js');

      expect(result).toHaveLength(2);
      expect(result).toContain('test.js');
      expect(result).toContain('app.js');
    });

    test('filters files by multiple patterns', () => {
      const files = ['test.js', 'app.ts', 'README.md'];
      const result = filterFilesByPattern(files, ['*.js', '*.ts']);

      expect(result).toHaveLength(2);
    });

    test('handles empty files array', () => {
      const result = filterFilesByPattern([], '*.js');

      expect(result).toEqual([]);
    });
  });

  describe('Pure Functions - doesChangeAffectStep', () => {
    test('returns false for no changes', () => {
      const step = { id: 'step1' };
      const result = doesChangeAffectStep(step, { files: [] });

      expect(result).toBe(false);
    });

    test('checks affectedBy patterns', () => {
      const step = { id: 'step1', affectedBy: ['*.js'] };
      const changes = { files: ['app.js', 'README.md'] };

      expect(doesChangeAffectStep(step, changes)).toBe(true);
    });

    test('returns false if no affectedBy patterns match', () => {
      const step = { id: 'step1', affectedBy: ['*.py'] };
      const changes = { files: ['app.js'] };

      expect(doesChangeAffectStep(step, changes)).toBe(false);
    });

    test('checks excludePatterns', () => {
      const step = { id: 'step1', excludePatterns: ['*.md'] };
      const changes = { files: ['app.js', 'README.md'] };

      expect(doesChangeAffectStep(step, changes)).toBe(true);
    });

    test('returns false if all changes are excluded', () => {
      const step = { id: 'step1', excludePatterns: ['*.md'] };
      const changes = { files: ['README.md'] };

      expect(doesChangeAffectStep(step, changes)).toBe(false);
    });

    test('defaults to true for changes without patterns', () => {
      const step = { id: 'step1' };
      const changes = { files: ['app.js'] };

      expect(doesChangeAffectStep(step, changes)).toBe(true);
    });
  });

  describe('Pure Functions - calculateStepPriority', () => {
    test('uses step priority as base', () => {
      const step = { id: 'step1', priority: 70 };
      const result = calculateStepPriority(step);

      expect(result).toBeGreaterThanOrEqual(70);
    });

    test('increases priority for critical steps', () => {
      const step1 = { id: 'step1', priority: 50 };
      const step2 = { id: 'step2', priority: 50, critical: true };

      const priority1 = calculateStepPriority(step1);
      const priority2 = calculateStepPriority(step2);

      expect(priority2).toBeGreaterThan(priority1);
    });

    test('increases priority based on impact', () => {
      const step = { id: 'step1', priority: 50 };

      const lowPriority = calculateStepPriority(step, {}, 'low');
      const mediumPriority = calculateStepPriority(step, {}, 'medium');
      const highPriority = calculateStepPriority(step, {}, 'high');

      expect(highPriority).toBeGreaterThan(mediumPriority);
      expect(mediumPriority).toBeGreaterThan(lowPriority);
    });

    test('caps priority at 100', () => {
      const step = { id: 'step1', priority: 90, critical: true };
      const result = calculateStepPriority(step, {}, 'high');

      expect(result).toBe(100);
    });
  });

  // ============================================================================
  // ConditionalExecutor Class Tests
  // ============================================================================

  describe('ConditionalExecutor Class - Constructor', () => {
    test('initializes with default options', () => {
      const executor = new ConditionalExecutor();

      expect(executor.options.smartExecution).toBe(true);
      expect(executor.skipHistory).toEqual([]);
    });

    test('accepts custom options', () => {
      const executor = new ConditionalExecutor({
        smartExecution: false,
        projectKind: 'nodejs_api',
      });

      expect(executor.options.smartExecution).toBe(false);
      expect(executor.options.projectKind).toBe('nodejs_api');
    });
  });

  describe('ConditionalExecutor Class - evaluateStep', () => {
    test('returns execute=true for valid step', () => {
      const executor = new ConditionalExecutor();
      const step = { id: 'step1', name: 'Test' };
      const context = { changes: { files: ['app.js'] } };

      const result = executor.evaluateStep(step, context);

      expect(result.execute).toBe(true);
    });

    test('returns execute=false for skipped step', () => {
      const executor = new ConditionalExecutor();
      const step = { id: 'step1', skip: true };

      const result = executor.evaluateStep(step);

      expect(result.execute).toBe(false);
      expect(result.reason).toBeTruthy();
    });

    test('adapts step to project kind', () => {
      const executor = new ConditionalExecutor({ projectKind: 'nodejs_api' });
      const step = {
        id: 'step1',
        timeout: 300,
        projectAdaptations: {
          nodejs_api: { timeout: 600 },
        },
      };

      const result = executor.evaluateStep(step, {});

      expect(result.step.timeout).toBe(600);
    });

    test('records skip in history', () => {
      const executor = new ConditionalExecutor();
      const step = { id: 'step1', skip: true };

      executor.evaluateStep(step);

      expect(executor.skipHistory).toHaveLength(1);
      expect(executor.skipHistory[0].stepId).toBe('step1');
    });
  });

  describe('ConditionalExecutor Class - evaluateSteps', () => {
    test('creates execution plan', () => {
      const executor = new ConditionalExecutor();
      const steps = [
        { id: 'step1', name: 'Test1' },
        { id: 'step2', name: 'Test2', skip: true },
        { id: 'step3', name: 'Test3' },
      ];

      const plan = executor.evaluateSteps(steps, { changes: { files: ['app.js'] } });

      expect(plan.execute).toHaveLength(2);
      expect(plan.skip).toHaveLength(1);
    });

    test('sorts execute list by priority', () => {
      const executor = new ConditionalExecutor();
      const steps = [
        { id: 'step1', priority: 50 },
        { id: 'step2', priority: 80, critical: true },
        { id: 'step3', priority: 60 },
      ];

      const plan = executor.evaluateSteps(steps, { changes: { files: ['app.js'] } });

      expect(plan.execute[0].step.id).toBe('step2'); // Highest priority
    });
  });

  describe('ConditionalExecutor Class - getImpact', () => {
    test('calculates impact for files', () => {
      const executor = new ConditionalExecutor();
      const impact = executor.getImpact(['README.md']);

      expect(impact).toBe('low');
    });
  });

  describe('ConditionalExecutor Class - shouldSkip', () => {
    test('checks if step should be skipped', () => {
      const executor = new ConditionalExecutor();
      const step = { id: 'step1', skip: true };

      expect(executor.shouldSkip(step)).toBe(true);
    });

    test('returns false for executable step', () => {
      const executor = new ConditionalExecutor();
      const step = { id: 'step1' };

      expect(executor.shouldSkip(step, { changes: { files: ['app.js'] } })).toBe(false);
    });
  });

  describe('ConditionalExecutor Class - getSkipHistory', () => {
    test('returns skip history', () => {
      const executor = new ConditionalExecutor();
      const step = { id: 'step1', skip: true };

      executor.evaluateStep(step);
      const history = executor.getSkipHistory();

      expect(history).toHaveLength(1);
      expect(history[0].stepId).toBe('step1');
    });

    test('returns copy of history', () => {
      const executor = new ConditionalExecutor();
      const step = { id: 'step1', skip: true };

      executor.evaluateStep(step);
      const history1 = executor.getSkipHistory();
      const history2 = executor.getSkipHistory();

      expect(history1).not.toBe(history2);
      expect(history1).toEqual(history2);
    });
  });

  describe('ConditionalExecutor Class - getStats', () => {
    test('calculates skip statistics', () => {
      const executor = new ConditionalExecutor();

      executor.evaluateStep({ id: 'step1', skip: true });
      executor.evaluateStep({ id: 'step2', enabled: false });

      const stats = executor.getStats();

      expect(stats.total).toBe(2);
      expect(stats.byReason['Step marked to skip']).toBe(1);
      expect(stats.byReason['Step is disabled']).toBe(1);
    });
  });

  describe('ConditionalExecutor Class - clearHistory', () => {
    test('clears skip history', () => {
      const executor = new ConditionalExecutor();
      const step = { id: 'step1', skip: true };

      executor.evaluateStep(step);
      expect(executor.skipHistory).toHaveLength(1);

      executor.clearHistory();
      expect(executor.skipHistory).toHaveLength(0);
    });
  });
});
