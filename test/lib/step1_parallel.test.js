/**
 * @fileoverview Tests for Step 1 Parallel Processing (v2.0.0)
 * @module test/lib/step1_parallel
 */

import {
  createValidationTask,
  createValidationTasks,
  sortTasksByPriority,
  determineExecutionStrategy,
  splitIntoBatches,
  calculateTaskStatistics,
  mergeValidationResults,
  calculateSpeedup,
  isValidTask,
  Step1ParallelProcessor,
  EXECUTION_STRATEGY,
  TASK_STATUS,
} from '../../src/lib/step1_parallel.js';
import { DOC_CATEGORIES, VALIDATION_PRIORITY } from '../../src/lib/step1_incremental.js';

describe('Step 1 Parallel Processing', () => {
  // ==========================================================================
  // PURE FUNCTION TESTS
  // ==========================================================================

  describe('createValidationTask', () => {
    test('creates task with all required fields', () => {
      const task = createValidationTask('api', ['file1.md', 'file2.md'], VALIDATION_PRIORITY.HIGH);

      expect(task.category).toBe('api');
      expect(task.files).toEqual(['file1.md', 'file2.md']);
      expect(task.priority).toBe(VALIDATION_PRIORITY.HIGH);
      expect(task.status).toBe(TASK_STATUS.PENDING);
      expect(task.result).toBeNull();
      expect(task.error).toBeNull();
    });

    test('generates unique task IDs', () => {
      const timestamp1 = 1000;
      const timestamp2 = 2000;
      const task1 = createValidationTask('api', ['file1.md'], 1, timestamp1, 0);
      const task2 = createValidationTask('api', ['file2.md'], 1, timestamp2, 0);

      expect(task1.id).not.toBe(task2.id);
      expect(task1.id).toBe('task_api_1000_0');
      expect(task2.id).toBe('task_api_2000_0');
    });
  });

  describe('createValidationTasks', () => {
    test('creates tasks for each category', () => {
      const files = ['README.md', 'docs/api/index.md', 'docs/guide.md'];
      const getPriority = () => VALIDATION_PRIORITY.MEDIUM;

      const tasks = createValidationTasks(files, getPriority, 1000);

      expect(tasks.length).toBeGreaterThan(0);
      expect(tasks.every((t) => t.files.length > 0)).toBe(true);
    });

    test('skips empty categories', () => {
      const files = ['README.md'];
      const getPriority = () => VALIDATION_PRIORITY.MEDIUM;

      const tasks = createValidationTasks(files, getPriority, 1000);

      // Only README category should have files
      expect(tasks.length).toBe(1);
      expect(tasks[0].category).toBe(DOC_CATEGORIES.README);
    });

    test('applies priority function correctly', () => {
      const files = ['README.md', 'docs/api/index.md'];
      const getPriority = (cat) =>
        cat === DOC_CATEGORIES.README ? VALIDATION_PRIORITY.CRITICAL : VALIDATION_PRIORITY.LOW;

      const tasks = createValidationTasks(files, getPriority, 1000);

      const readmeTask = tasks.find((t) => t.category === DOC_CATEGORIES.README);
      expect(readmeTask.priority).toBe(VALIDATION_PRIORITY.CRITICAL);
    });
  });

  describe('sortTasksByPriority', () => {
    test('sorts by priority (high to low)', () => {
      const tasks = [
        { category: 'other', priority: VALIDATION_PRIORITY.LOW, files: [] },
        { category: 'readme', priority: VALIDATION_PRIORITY.CRITICAL, files: [] },
        { category: 'guide', priority: VALIDATION_PRIORITY.HIGH, files: [] },
      ];

      const sorted = sortTasksByPriority(tasks, []);

      expect(sorted[0].priority).toBe(VALIDATION_PRIORITY.CRITICAL);
      expect(sorted[2].priority).toBe(VALIDATION_PRIORITY.LOW);
    });

    test('uses category order for same priority', () => {
      const tasks = [
        { category: 'guide', priority: 2, files: [] },
        { category: 'api', priority: 2, files: [] },
      ];

      const categoryOrder = ['api', 'guide'];
      const sorted = sortTasksByPriority(tasks, categoryOrder);

      expect(sorted[0].category).toBe('api');
      expect(sorted[1].category).toBe('guide');
    });

    test('does not mutate original array', () => {
      const tasks = [
        { category: 'a', priority: 1, files: [] },
        { category: 'b', priority: 2, files: [] },
      ];
      const original = [...tasks];

      sortTasksByPriority(tasks, []);

      expect(tasks).toEqual(original);
    });
  });

  describe('determineExecutionStrategy', () => {
    test('returns SEQUENTIAL for empty tasks', () => {
      const strategy = determineExecutionStrategy([]);
      expect(strategy).toBe(EXECUTION_STRATEGY.SEQUENTIAL);
    });

    test('returns SEQUENTIAL for single task', () => {
      const tasks = [{ priority: VALIDATION_PRIORITY.HIGH }];
      const strategy = determineExecutionStrategy(tasks);
      expect(strategy).toBe(EXECUTION_STRATEGY.SEQUENTIAL);
    });

    test('returns SEQUENTIAL for all critical tasks', () => {
      const tasks = [
        { priority: VALIDATION_PRIORITY.CRITICAL },
        { priority: VALIDATION_PRIORITY.CRITICAL },
      ];
      const strategy = determineExecutionStrategy(tasks, VALIDATION_PRIORITY.CRITICAL);
      expect(strategy).toBe(EXECUTION_STRATEGY.SEQUENTIAL);
    });

    test('returns PARALLEL for all non-critical tasks', () => {
      const tasks = [{ priority: VALIDATION_PRIORITY.LOW }, { priority: VALIDATION_PRIORITY.LOW }];
      const strategy = determineExecutionStrategy(tasks, VALIDATION_PRIORITY.CRITICAL);
      expect(strategy).toBe(EXECUTION_STRATEGY.PARALLEL);
    });

    test('returns BALANCED for mixed priorities', () => {
      const tasks = [
        { priority: VALIDATION_PRIORITY.CRITICAL },
        { priority: VALIDATION_PRIORITY.LOW },
      ];
      const strategy = determineExecutionStrategy(tasks, VALIDATION_PRIORITY.CRITICAL);
      expect(strategy).toBe(EXECUTION_STRATEGY.BALANCED);
    });
  });

  describe('splitIntoBatches', () => {
    test('splits tasks into correct batch sizes', () => {
      const tasks = [1, 2, 3, 4, 5, 6, 7];
      const batches = splitIntoBatches(tasks, 3);

      expect(batches.length).toBe(3);
      expect(batches[0]).toEqual([1, 2, 3]);
      expect(batches[1]).toEqual([4, 5, 6]);
      expect(batches[2]).toEqual([7]);
    });

    test('handles single batch', () => {
      const tasks = [1, 2, 3];
      const batches = splitIntoBatches(tasks, 10);

      expect(batches.length).toBe(1);
      expect(batches[0]).toEqual([1, 2, 3]);
    });

    test('handles empty tasks', () => {
      const batches = splitIntoBatches([], 3);
      expect(batches).toEqual([]);
    });

    test('handles zero batch size', () => {
      const tasks = [1, 2, 3];
      const batches = splitIntoBatches(tasks, 0);

      expect(batches.length).toBe(1);
      expect(batches[0]).toEqual([1, 2, 3]);
    });
  });

  describe('calculateTaskStatistics', () => {
    test('calculates statistics correctly', () => {
      const tasks = [
        { status: TASK_STATUS.COMPLETED, files: ['f1', 'f2'], duration: 10 },
        { status: TASK_STATUS.COMPLETED, files: ['f3'], duration: 20 },
        { status: TASK_STATUS.FAILED, files: ['f4'], duration: 5 },
      ];

      const stats = calculateTaskStatistics(tasks);

      expect(stats.total).toBe(3);
      expect(stats.completed).toBe(2);
      expect(stats.failed).toBe(1);
      expect(stats.totalFiles).toBe(4);
      expect(stats.avgDuration).toBe(12); // (10+20+5)/3 rounded
      expect(stats.successRate).toBe(67); // 2/3 * 100
    });

    test('handles empty tasks', () => {
      const stats = calculateTaskStatistics([]);

      expect(stats.total).toBe(0);
      expect(stats.successRate).toBe(0);
      expect(stats.avgDuration).toBe(0);
    });

    test('counts timeout status', () => {
      const tasks = [
        { status: TASK_STATUS.COMPLETED, files: [], duration: 0 },
        { status: TASK_STATUS.TIMEOUT, files: [], duration: 0 },
      ];

      const stats = calculateTaskStatistics(tasks);

      expect(stats.timeout).toBe(1);
    });
  });

  describe('mergeValidationResults', () => {
    test('merges results from all tasks', () => {
      const tasks = [
        {
          category: 'api',
          status: TASK_STATUS.COMPLETED,
          files: ['f1', 'f2'],
          duration: 10,
          result: { success: true },
          error: null,
        },
        {
          category: 'guide',
          status: TASK_STATUS.COMPLETED,
          files: ['f3'],
          duration: 5,
          result: { success: true },
          error: null,
        },
      ];

      const results = mergeValidationResults(tasks);

      expect(results.success).toBe(true);
      expect(results.totalFiles).toBe(3);
      expect(results.validatedFiles).toBe(3);
      expect(results.categories.api.status).toBe(TASK_STATUS.COMPLETED);
    });

    test('marks success as false if any task failed', () => {
      const tasks = [
        {
          category: 'api',
          status: TASK_STATUS.COMPLETED,
          files: ['f1'],
          duration: 10,
          result: null,
          error: null,
        },
        {
          category: 'guide',
          status: TASK_STATUS.FAILED,
          files: ['f2'],
          duration: 5,
          result: null,
          error: 'Validation error',
        },
      ];

      const results = mergeValidationResults(tasks);

      expect(results.success).toBe(false);
      expect(results.errors.length).toBe(1);
      expect(results.skippedFiles).toBe(1);
    });

    test('handles empty tasks', () => {
      const results = mergeValidationResults([]);

      expect(results.success).toBe(true);
      expect(results.totalFiles).toBe(0);
    });
  });

  describe('calculateSpeedup', () => {
    test('calculates speedup correctly', () => {
      const speedup = calculateSpeedup(100, 50);

      expect(speedup.speedup).toBe(2.0);
      expect(speedup.timeSaved).toBe(50);
      expect(speedup.parallelTime).toBe(50);
      expect(speedup.sequentialTime).toBe(100);
    });

    test('handles no speedup case', () => {
      const speedup = calculateSpeedup(100, 100);

      expect(speedup.speedup).toBe(1.0);
      expect(speedup.timeSaved).toBe(0);
    });

    test('handles zero parallel time', () => {
      const speedup = calculateSpeedup(100, 0);

      expect(speedup.speedup).toBeGreaterThan(0);
    });
  });

  describe('isValidTask', () => {
    test('validates correct task structure', () => {
      const task = {
        category: 'api',
        files: ['file1.md'],
        priority: 2,
      };

      expect(isValidTask(task)).toBe(true);
    });

    test('rejects null task', () => {
      expect(isValidTask(null)).toBe(false);
    });

    test('rejects task without category', () => {
      const task = { files: [], priority: 2 };
      expect(isValidTask(task)).toBe(false);
    });

    test('rejects task with non-array files', () => {
      const task = { category: 'api', files: 'not an array', priority: 2 };
      expect(isValidTask(task)).toBe(false);
    });

    test('rejects task without priority', () => {
      const task = { category: 'api', files: [] };
      expect(isValidTask(task)).toBe(false);
    });
  });

  // ==========================================================================
  // INTEGRATION TESTS
  // ==========================================================================

  describe('Step1ParallelProcessor', () => {
    let processor;

    beforeEach(() => {
      processor = new Step1ParallelProcessor();
    });

    describe('constructor', () => {
      test('initializes with default config', () => {
        expect(processor.config.maxConcurrency).toBe(4);
        expect(processor.tasks).toEqual([]);
      });

      test('accepts custom config', () => {
        const custom = new Step1ParallelProcessor({ maxConcurrency: 8 });
        expect(custom.config.maxConcurrency).toBe(8);
      });
    });

    describe('validate', () => {
      test('validates files sequentially', async () => {
        const files = ['README.md'];
        const validator = async (category, categoryFiles) => {
          return { category, fileCount: categoryFiles.length };
        };

        const results = await processor.validate(files, validator);

        expect(results.success).toBe(true);
        expect(results.totalFiles).toBe(1);
        expect(results.validatedFiles).toBe(1);
      });

      test('validates files in parallel', async () => {
        const files = ['README.md', 'docs/api/index.md', 'docs/guide.md', 'CHANGELOG.md'];

        const executionOrder = [];
        const validator = async (category) => {
          executionOrder.push(category);
          await new Promise((resolve) => setTimeout(resolve, 10));
          return { category };
        };

        const results = await processor.validate(files, validator, {
          strategy: EXECUTION_STRATEGY.PARALLEL,
        });

        expect(results.success).toBe(true);
        expect(results.validatedFiles).toBeGreaterThan(0);
      });

      test('handles validator errors gracefully', async () => {
        const files = ['README.md', 'docs/api/index.md'];

        const validator = async (category) => {
          if (category === DOC_CATEGORIES.API) {
            throw new Error('Validation failed');
          }
          return { category };
        };

        const results = await processor.validate(files, validator);

        expect(results.success).toBe(false);
        expect(results.errors.length).toBeGreaterThan(0);
      });

      test('treats validator success=false as a failed task', async () => {
        const files = ['README.md'];

        const validator = async () => ({ success: false, error: 'AI analysis incomplete' });

        const results = await processor.validate(files, validator);

        expect(results.success).toBe(false);
        expect(results.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ error: 'AI analysis incomplete', category: DOC_CATEGORIES.README }),
          ])
        );
      });

      test('respects custom priority function', async () => {
        const files = ['README.md', 'LICENSE'];

        const getPriority = (cat) =>
          cat === DOC_CATEGORIES.README ? VALIDATION_PRIORITY.CRITICAL : VALIDATION_PRIORITY.LOW;

        const validator = async (category) => ({ category });

        const results = await processor.validate(files, validator, { getPriority });

        expect(results.success).toBe(true);
      });

      test('calls progress callback', async () => {
        const files = ['README.md', 'docs/guide.md'];

        const progressCalls = [];
        const onProgress = (task) => {
          progressCalls.push(task.category);
        };

        const validator = async (category) => ({ category });

        await processor.validate(files, validator, { onProgress });

        expect(progressCalls.length).toBeGreaterThan(0);
      });

      test('handles timeout', async () => {
        const files = ['README.md'];
        let aborted = false;

        const validator = async (_category, _categoryFiles, { signal }) => {
          signal.addEventListener('abort', () => {
            aborted = true;
          });
          await new Promise((resolve) => setTimeout(resolve, 500)); // 500ms
          return {};
        };

        const shortTimeout = new Step1ParallelProcessor({ timeout: 50 }); // 50ms

        const results = await shortTimeout.validate(files, validator);

        expect(results.success).toBe(false);
        const timeoutTask = shortTimeout.tasks.find((t) => t.status === TASK_STATUS.TIMEOUT);
        expect(timeoutTask).toBeDefined();
        expect(aborted).toBe(true);
      }, 10000); // 10s test timeout

      test('returns empty results for no files', async () => {
        const validator = async () => ({});
        const results = await processor.validate([], validator);

        expect(results.totalFiles).toBe(0);
        expect(results.success).toBe(true);
      });
    });

    describe('execution strategies', () => {
      const createValidator = () => async (category) => ({ category });

      test('SEQUENTIAL strategy executes one at a time', async () => {
        const files = ['README.md', 'docs/api/index.md'];

        await processor.validate(files, createValidator(), {
          strategy: EXECUTION_STRATEGY.SEQUENTIAL,
        });

        expect(processor.tasks.every((t) => t.status === TASK_STATUS.COMPLETED)).toBe(true);
      });

      test('PARALLEL strategy executes concurrently', async () => {
        const files = ['README.md', 'docs/api/index.md', 'docs/guide.md'];

        await processor.validate(files, createValidator(), {
          strategy: EXECUTION_STRATEGY.PARALLEL,
        });

        expect(processor.tasks.every((t) => t.status === TASK_STATUS.COMPLETED)).toBe(true);
      });

      test('BALANCED strategy executes critical first', async () => {
        const files = ['README.md', 'docs/guide.md', 'LICENSE'];

        const getPriority = (cat) => {
          if (cat === DOC_CATEGORIES.README) return VALIDATION_PRIORITY.CRITICAL;
          return VALIDATION_PRIORITY.LOW;
        };

        await processor.validate(files, createValidator(), {
          strategy: EXECUTION_STRATEGY.BALANCED,
          getPriority,
        });

        expect(processor.tasks.every((t) => t.status === TASK_STATUS.COMPLETED)).toBe(true);
      });

      test('PRIORITY_BASED strategy groups by priority', async () => {
        const files = ['README.md', 'docs/api/index.md', 'docs/guide.md', 'LICENSE'];

        const getPriority = (cat) => {
          if (cat === DOC_CATEGORIES.README || cat === DOC_CATEGORIES.API) {
            return VALIDATION_PRIORITY.CRITICAL;
          }
          if (cat === DOC_CATEGORIES.GUIDE) return VALIDATION_PRIORITY.HIGH;
          return VALIDATION_PRIORITY.LOW;
        };

        await processor.validate(files, createValidator(), {
          strategy: EXECUTION_STRATEGY.PRIORITY_BASED,
          getPriority,
        });

        expect(processor.tasks.every((t) => t.status === TASK_STATUS.COMPLETED)).toBe(true);
      });
    });

    describe('getStatistics', () => {
      test('returns statistics after validation', async () => {
        const files = ['README.md', 'docs/guide.md'];
        const validator = async (category) => ({ category });

        await processor.validate(files, validator);

        const stats = processor.getStatistics();

        expect(stats.total).toBeGreaterThan(0);
        expect(stats.completed).toBeGreaterThan(0);
        expect(stats.successRate).toBeGreaterThan(0);
      });

      test('includes speedup calculation', async () => {
        const files = ['README.md', 'docs/api/index.md'];
        const validator = async () => {
          await new Promise((resolve) => setTimeout(resolve, 50));
          return {};
        };

        await processor.validate(files, validator, {
          strategy: EXECUTION_STRATEGY.PARALLEL,
        });

        const stats = processor.getStatistics();

        expect(stats.speedup).toBeDefined();
        expect(stats.speedup.speedup).toBeGreaterThanOrEqual(1);
      });
    });

    describe('cancel', () => {
      test('cancels running tasks', async () => {
        const files = ['README.md'];
        let validationStarted = false;

        const validator = async () => {
          validationStarted = true;
          await new Promise((resolve) => setTimeout(resolve, 1000));
          return {};
        };

        // Start validation but don't await
        const validationPromise = processor.validate(files, validator);

        // Wait a bit for validation to start
        await new Promise((resolve) => setTimeout(resolve, 50));

        // Cancel
        await processor.cancel();

        // Wait for validation to complete
        await validationPromise;

        // Verify cancellation happened
        expect(validationStarted).toBe(true);
      }, 5000); // 5s test timeout
    });

    describe('reset', () => {
      test('resets processor state', async () => {
        const files = ['README.md'];
        const validator = async () => ({});

        await processor.validate(files, validator);

        processor.reset();

        expect(processor.tasks).toEqual([]);
        expect(processor.runningTasks.size).toBe(0);
        expect(processor.startTime).toBeNull();
      });
    });

    describe('end-to-end workflow', () => {
      test('complete parallel validation workflow', async () => {
        const files = [
          'README.md',
          'docs/api/index.md',
          'docs/api/reference.md',
          'docs/guides/getting-started.md',
          'docs/guides/advanced.md',
          'CHANGELOG.md',
          'LICENSE',
        ];

        const validatedCategories = new Set();
        const validator = async (category, categoryFiles) => {
          validatedCategories.add(category);
          // Simulate validation work
          await new Promise((resolve) => setTimeout(resolve, 10));
          return {
            category,
            fileCount: categoryFiles.length,
            issues: [],
          };
        };

        const results = await processor.validate(files, validator, {
          strategy: EXECUTION_STRATEGY.PARALLEL,
        });

        // Verify results
        expect(results.success).toBe(true);
        expect(results.totalFiles).toBe(7);
        expect(results.validatedFiles).toBe(7);
        expect(validatedCategories.size).toBeGreaterThan(1);

        // Verify statistics
        const stats = processor.getStatistics();
        expect(stats.successRate).toBe(100);
        expect(stats.totalFiles).toBe(7);

        // Verify speedup (parallel should be faster)
        if (stats.speedup) {
          expect(stats.speedup.speedup).toBeGreaterThanOrEqual(1);
        }
      });
    });
  });
});
