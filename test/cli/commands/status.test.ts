/**
 * @fileoverview Tests for CLI Status Command
 * @module test/cli/commands/status.test
 */

import { describe, test, expect } from '@jest/globals';
import { formatWorkflowStatus, calculateSummaryStats } from '../../../src/cli/commands/status.js';

describe('Status Command - Pure Functions', () => {
  describe('formatWorkflowStatus', () => {
    test('should format status with checkpoints', () => {
      const status = {
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

      const formatted = formatWorkflowStatus(status);
      expect(formatted).toContain('Workflow Status');
      expect(formatted).toContain('wf-123');
      expect(formatted).toContain('50%');
      expect(formatted).toContain('Total Executions: 10');
    });

    test('should handle status without checkpoints', () => {
      const status = {
        checkpoints: [],
        metrics: null,
      };

      const formatted = formatWorkflowStatus(status);
      expect(formatted).toContain('No checkpoints found');
    });

    test('should handle null status', () => {
      const result = formatWorkflowStatus(null);
      expect(result).toBe('No workflow status available');
    });
  });

  describe('calculateSummaryStats', () => {
    test('should calculate stats with data', () => {
      const checkpoints = [
        {
          workflowId: 'wf-1',
          timestamp: 100,
        },
        {
          workflowId: 'wf-2',
          timestamp: 200,
        },
      ];

      const metrics = [
        { duration: 100, success: true },
        { duration: 200, success: true },
        { duration: 150, success: false },
      ];

      const stats = calculateSummaryStats(checkpoints, metrics);
      expect(stats.totalCheckpoints).toBe(2);
      expect(stats.totalExecutions).toBe(3);
      expect(stats.latestCheckpoint.workflowId).toBe('wf-1');
      expect(stats.avgDuration).toBe(150);
      expect(stats.successRate).toBeCloseTo(66.67, 1);
    });

    test('should handle empty data', () => {
      const stats = calculateSummaryStats([], []);
      expect(stats.totalCheckpoints).toBe(0);
      expect(stats.totalExecutions).toBe(0);
      expect(stats.latestCheckpoint).toBeNull();
      expect(stats.avgDuration).toBe(0);
      expect(stats.successRate).toBe(0);
    });

    test('should handle null data', () => {
      const stats = calculateSummaryStats(null, null);
      expect(stats.totalCheckpoints).toBe(0);
      expect(stats.totalExecutions).toBe(0);
    });
  });
});

describe('Status Command - additional branch coverage', () => {
  describe('formatWorkflowStatus — missing metadata fields', () => {
    test('renders defaults when checkpoint has no metadata', () => {
      const status = {
        checkpoints: [
          {
            workflowId: 'wf-bare',
            timestamp: Date.now(),
            state: {},
            // no metadata
          },
        ],
      };
      const result = formatWorkflowStatus(status);
      expect(result).toContain('wf-bare');
      expect(result).toContain('0%');
      expect(result).toContain('0/0');
    });

    test('omits Recent Metrics section when metrics is absent', () => {
      const status = {
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
      const result = formatWorkflowStatus(status);
      expect(result).not.toContain('Recent Metrics');
    });
  });

  describe('calculateSummaryStats — single metric', () => {
    test('calculates correctly with a single successful metric', () => {
      const stats = calculateSummaryStats([], [{ duration: 60, success: true }]);
      expect(stats.totalExecutions).toBe(1);
      expect(stats.avgDuration).toBe(60);
      expect(stats.successRate).toBe(100);
    });

    test('calculates correctly with a single failed metric', () => {
      const stats = calculateSummaryStats([], [{ duration: 30, success: false }]);
      expect(stats.successRate).toBe(0);
    });
  });
});
