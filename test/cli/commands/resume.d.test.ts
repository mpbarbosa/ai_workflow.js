import resumeCommandExports, {
  resumeCommand,
  validateResumeOptions,
  formatCheckpoint,
  formatCheckpointList,
  ResumeCommandOptions,
  ResumeCheckpoint,
} from '../../src/cli/commands/resume';

describe('cli/commands/resume', () => {
  describe('validateResumeOptions', () => {
    it('should validate correct options and checkpointId as valid', () => {
      const options: ResumeCommandOptions = { latest: true, projectRoot: '/tmp', verbose: false };
      const result = validateResumeOptions(options, 'chkpt-123');
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should return errors for missing checkpointId when required', () => {
      const options: ResumeCommandOptions = { latest: false };
      const result = validateResumeOptions(options, null);
      expect(result.isValid).toBe(false);
      expect(Array.isArray(result.errors)).toBe(true);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle undefined options gracefully', () => {
      const result = validateResumeOptions(undefined, 'chkpt-1');
      expect(result.isValid).toBe(true);
    });

    it('should handle invalid types in options', () => {
      // @ts-expect-error
      const result = validateResumeOptions({ latest: 'yes' }, 'chkpt-1');
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('formatCheckpoint', () => {
    it('should format a valid checkpoint object', () => {
      const checkpoint: ResumeCheckpoint = {
        id: 'c1',
        workflowId: 'w1',
        timestamp: Date.now(),
        state: { completedSteps: ['step1', 'step2'] },
        metadata: { progress: 2, totalSteps: 5 },
      };
      const output = formatCheckpoint(checkpoint);
      expect(typeof output).toBe('string');
      expect(output).toMatch(/c1/);
      expect(output).toMatch(/w1/);
    });

    it('should handle checkpoint with missing optional fields', () => {
      const checkpoint: ResumeCheckpoint = {
        workflowId: 'w2',
        timestamp: 1234567890,
        state: {},
      };
      const output = formatCheckpoint(checkpoint);
      expect(typeof output).toBe('string');
      expect(output).toMatch(/w2/);
    });

    it('should handle null or undefined checkpoint', () => {
      expect(typeof formatCheckpoint(null)).toBe('string');
      expect(typeof formatCheckpoint(undefined)).toBe('string');
    });
  });

  describe('formatCheckpointList', () => {
    it('should format a list of checkpoints', () => {
      const checkpoints: ResumeCheckpoint[] = [
        {
          id: 'c1',
          workflowId: 'w1',
          timestamp: 1111,
          state: { completedSteps: ['a'] },
        },
        {
          id: 'c2',
          workflowId: 'w2',
          timestamp: 2222,
          state: { completedSteps: 2 },
        },
      ];
      const output = formatCheckpointList(checkpoints);
      expect(typeof output).toBe('string');
      expect(output).toMatch(/c1/);
      expect(output).toMatch(/c2/);
    });

    it('should handle empty checkpoint list', () => {
      const output = formatCheckpointList([]);
      expect(typeof output).toBe('string');
    });

    it('should handle null or undefined checkpoint list', () => {
      expect(typeof formatCheckpointList(null)).toBe('string');
      expect(typeof formatCheckpointList(undefined)).toBe('string');
    });
  });

  describe('resumeCommand', () => {
    it('should resolve for valid checkpointId and options', async () => {
      const options: ResumeCommandOptions = { latest: true, tui: false };
      await expect(resumeCommand('chkpt-1', options)).resolves.toBeUndefined();
    });

    it('should reject or throw for invalid checkpointId', async () => {
      // @ts-expect-error
      await expect(resumeCommand(undefined, { latest: false })).rejects.toBeDefined();
    });

    it('should handle missing options gracefully', async () => {
      await expect(resumeCommand('chkpt-2')).resolves.toBeUndefined();
    });
  });
});
