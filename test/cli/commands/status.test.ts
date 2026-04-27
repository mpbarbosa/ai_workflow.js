/**
 * @fileoverview Tests for CLI Status Command
 * @module test/cli/commands/status.test
 */

import { describe, test, expect } from '@jest/globals';
import { formatWorkflowStatus, calculateSummaryStats } from '../../../src/cli/commands/status.js';
import type {
  WorkflowCheckpoint,
  WorkflowMetricsEntry,
  WorkflowStatusData,
  WorkflowStatusSummary,
} from '../../../src/cli/commands/status.js';

interface WorkflowStatusWithCheckpoints extends WorkflowStatusData {
  checkpoints: WorkflowCheckpoint[];
}

describe('Status Command - Pure Functions', (): void => {
  describe('formatWorkflowStatus', (): void => {
    test('should format status with checkpoints', (): void => {
      const status: WorkflowStatusWithCheckpoints = {
        checkpoints: [
          {
            workflowId: 'wf-123',
            timestamp: Date.now(),
            state: { completedSteps: ['step1'] },
            metadata: { progress: 50, totalSteps: 2 },
          },
        ],
        metrics: {
          totalExecutions: 10,
          avgDuration: 120,
          successRate: 90,
        },
      };

      const formatted: string = formatWorkflowStatus(status);
      expect(formatted).toContain('Workflow Status');
      expect(formatted).toContain('wf-123');
      expect(formatted).toContain('50%');
      expect(formatted).toContain('Total Executions: 10');
    });

    test('should handle status without checkpoints', (): void => {
      const status: WorkflowStatusData = {
        checkpoints: [],
        metrics: null,
      };

      const formatted: string = formatWorkflowStatus(status);
      expect(formatted).toContain('No checkpoints found');
    });

    test('should handle null status', (): void => {
      const result: string = formatWorkflowStatus(null);
      expect(result).toBe('No workflow status available');
    });
  });

  describe('calculateSummaryStats', (): void => {
    test('should calculate stats with data', (): void => {
      const checkpoints: WorkflowCheckpoint[] = [
        {
          workflowId: 'wf-1',
          timestamp: 100,
          state: {},
        },
        {
          workflowId: 'wf-2',
          timestamp: 200,
          state: {},
        },
      ];

      const metrics: WorkflowMetricsEntry[] = [
        { duration: 100, success: true },
        { duration: 200, success: true },
        { duration: 150, success: false },
      ];

      const stats: WorkflowStatusSummary = calculateSummaryStats(checkpoints, metrics);
      expect(stats.totalCheckpoints).toBe(2);
      expect(stats.totalExecutions).toBe(3);
      expect(stats.latestCheckpoint?.workflowId).toBe('wf-1');
      expect(stats.avgDuration).toBe(150);
      expect(stats.successRate).toBeCloseTo(66.67, 1);
    });

    test('should handle empty data', (): void => {
      const stats: WorkflowStatusSummary = calculateSummaryStats([], []);
      expect(stats.totalCheckpoints).toBe(0);
      expect(stats.totalExecutions).toBe(0);
      expect(stats.latestCheckpoint).toBeNull();
      expect(stats.avgDuration).toBe(0);
      expect(stats.successRate).toBe(0);
    });

    test('should handle null data', (): void => {
      const stats: WorkflowStatusSummary = calculateSummaryStats(null, null);
      expect(stats.totalCheckpoints).toBe(0);
      expect(stats.totalExecutions).toBe(0);
    });
  });
});

describe('Status Command - additional branch coverage', (): void => {
  describe('formatWorkflowStatus — missing metadata fields', (): void => {
    test('renders defaults when checkpoint has no metadata', (): void => {
      const status: WorkflowStatusWithCheckpoints = {
        checkpoints: [
          {
            workflowId: 'wf-bare',
            timestamp: Date.now(),
            state: {},
            // no metadata
          },
        ],
      };
      const result: string = formatWorkflowStatus(status);
      expect(result).toContain('wf-bare');
      expect(result).toContain('0%');
      expect(result).toContain('0/0');
    });

    test('omits Recent Metrics section when metrics is absent', (): void => {
      const status: WorkflowStatusWithCheckpoints = {
        checkpoints: [
          {
            workflowId: 'wf-no-metrics',
            timestamp: Date.now(),
            state: { completedSteps: [] },
            metadata: { progress: 20, totalSteps: 5 },
          },
        ],
        // no metrics key
      };
      const result: string = formatWorkflowStatus(status);
      expect(result).not.toContain('Recent Metrics');
    });
  });

  describe('calculateSummaryStats — single metric', (): void => {
    test('calculates correctly with a single successful metric', (): void => {
      const metrics: WorkflowMetricsEntry[] = [{ duration: 60, success: true }];
      const stats: WorkflowStatusSummary = calculateSummaryStats([], metrics);
      expect(stats.totalExecutions).toBe(1);
      expect(stats.avgDuration).toBe(60);
      expect(stats.successRate).toBe(100);
    });

    test('calculates correctly with a single failed metric', (): void => {
      const metrics: WorkflowMetricsEntry[] = [{ duration: 30, success: false }];
      const stats: WorkflowStatusSummary = calculateSummaryStats([], metrics);
      expect(stats.successRate).toBe(0);
    });
  });
});
