import statusExports, {
  statusCommand,
  formatWorkflowStatus,
  calculateSummaryStats,
  WorkflowCheckpoint,
  WorkflowMetricsEntry,
  WorkflowStatusData,
  WorkflowStatusSummary,
} from '../../src/cli/commands/status';

describe('cli/commands/status', () => {
  describe('formatWorkflowStatus', () => {
    it('should format a valid workflow status data', () => {
      const status: WorkflowStatusData = {
        checkpoints: [
          {
            workflowId: 'wf-1',
            timestamp: 1234567890,
            state: { completedSteps: ['a', 'b'], failedSteps: [] },
            metadata: { progress: 2, totalSteps: 3 },
          },
        ],
        metrics: { avgDuration: 100, successRate: 1, totalExecutions: 1 },
      };
      const output = formatWorkflowStatus(status);
      expect(typeof output).toBe('string');
      expect(output).toMatch(/wf-1/);
    });

    it('should handle null or undefined status', () => {
      expect(typeof formatWorkflowStatus(null)).toBe('string');
      expect(typeof formatWorkflowStatus(undefined)).toBe('string');
    });

    it('should handle empty checkpoints and metrics', () => {
      const status: WorkflowStatusData = { checkpoints: [], metrics: null };
      const output = formatWorkflowStatus(status);
      expect(typeof output).toBe('string');
    });
  });

  describe('calculateSummaryStats', () => {
    it('should calculate summary stats for valid checkpoints and metrics', () => {
      const checkpoints: WorkflowCheckpoint[] = [
        {
          workflowId: 'wf-1',
          timestamp: 1111,
          state: { completedSteps: ['a', 'b'], failedSteps: ['c'] },
          metadata: { progress: 2, totalSteps: 3 },
        },
        {
          workflowId: 'wf-2',
          timestamp: 2222,
          state: { completedSteps: ['a'], failedSteps: [] },
        },
      ];
      const metrics: WorkflowMetricsEntry[] = [
        { duration: 100, success: true },
        { duration: 200, success: false },
      ];
      const summary = calculateSummaryStats(checkpoints, metrics);
      expect(summary).toHaveProperty('avgDuration');
      expect(summary).toHaveProperty('latestCheckpoint');
      expect(summary).toHaveProperty('successRate');
      expect(summary).toHaveProperty('totalCheckpoints');
      expect(summary).toHaveProperty('totalExecutions');
      expect(summary.totalCheckpoints).toBe(2);
      expect(summary.totalExecutions).toBe(2);
    });

    it('should handle empty checkpoints and metrics', () => {
      const summary = calculateSummaryStats([], []);
      expect(summary).toBeDefined();
      expect(summary.totalCheckpoints).toBe(0);
      expect(summary.totalExecutions).toBe(0);
    });

    it('should handle null or undefined checkpoints and metrics', () => {
      const summary1 = calculateSummaryStats(null, null);
      const summary2 = calculateSummaryStats(undefined, undefined);
      expect(summary1).toBeDefined();
      expect(summary2).toBeDefined();
      expect(summary1.totalCheckpoints).toBe(0);
      expect(summary2.totalExecutions).toBe(0);
    });
  });

  describe('statusCommand', () => {
    it('should resolve for valid options', async () => {
      await expect(statusCommand({ verbose: true, workflowDir: '/wf' })).resolves.toBeUndefined();
    });

    it('should handle missing options gracefully', async () => {
      await expect(statusCommand()).resolves.toBeUndefined();
    });

    it('should reject or throw for invalid options', async () => {
      // @ts-expect-error
      await expect(statusCommand({ verbose: 'yes' })).rejects.toBeDefined();
    });
  });
});
