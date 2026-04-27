import cleanExports, {
  cleanCommand,
  validateCleanOptions,
  determineCleanupTargets,
  formatCleanupResult,
  CleanCommandOptions,
  CleanValidationResult,
  CleanupTargets,
  CleanupResult,
} from '../../../src/cli/commands/clean';

describe('cli/commands/clean', () => {
  describe('validateCleanOptions', () => {
    it('should validate correct options (happy path)', () => {
      const options: CleanCommandOptions = { all: true, dryRun: true };
      const result: CleanValidationResult = validateCleanOptions(options);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should return errors for invalid options (edge case)', () => {
      // Simulate an invalid option (e.g., negative olderThanDays)
      const options: CleanCommandOptions = { olderThanDays: -5 };
      const result: CleanValidationResult = validateCleanOptions(options);
      expect(result.isValid).toBe(false);
      expect(Array.isArray(result.errors)).toBe(true);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle empty options object', () => {
      const result = validateCleanOptions({});
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should handle undefined options', () => {
      // @ts-expect-error
      const result = validateCleanOptions(undefined);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('determineCleanupTargets', () => {
    it('should set all targets when "all" is true', () => {
      const options: CleanCommandOptions = { all: true };
      const targets: CleanupTargets = determineCleanupTargets(options);
      expect(targets.artifacts).toBe(true);
      expect(targets.cache).toBe(true);
      expect(targets.checkpoints).toBe(true);
      expect(targets.sessions).toBe(true);
      expect(targets.metrics).toBe(true);
      expect(targets.all).toBe(true);
    });

    it('should set only specified targets', () => {
      const options: CleanCommandOptions = { artifacts: true, cache: true };
      const targets: CleanupTargets = determineCleanupTargets(options);
      expect(targets.artifacts).toBe(true);
      expect(targets.cache).toBe(true);
      expect(targets.checkpoints).toBe(false);
      expect(targets.sessions).toBe(false);
      expect(targets.metrics).toBe(false);
      expect(targets.all).toBeUndefined();
    });

    it('should default all targets to false if no options set', () => {
      const targets: CleanupTargets = determineCleanupTargets({});
      expect(targets.artifacts).toBe(false);
      expect(targets.cache).toBe(false);
      expect(targets.checkpoints).toBe(false);
      expect(targets.sessions).toBe(false);
      expect(targets.metrics).toBe(false);
      expect(targets.all).toBeUndefined();
    });
  });

  describe('formatCleanupResult', () => {
    it('should format a valid cleanup result', () => {
      const result: CleanupResult = { filesDeleted: 5, bytesFreed: 1024 };
      const output = formatCleanupResult(result);
      expect(typeof output).toBe('string');
      expect(output).toMatch(/5/);
      expect(output).toMatch(/1024/);
    });

    it('should handle null result', () => {
      const output = formatCleanupResult(null);
      expect(typeof output).toBe('string');
      expect(output.length).toBeGreaterThan(0);
    });

    it('should handle undefined result', () => {
      const output = formatCleanupResult(undefined);
      expect(typeof output).toBe('string');
      expect(output.length).toBeGreaterThan(0);
    });

    it('should handle result with missing fields', () => {
      const result: CleanupResult = {};
      const output = formatCleanupResult(result);
      expect(typeof output).toBe('string');
    });
  });

  describe('cleanCommand', () => {
    it('should resolve without error for valid options (happy path)', async () => {
      await expect(cleanCommand({ all: true, dryRun: true })).resolves.toBeUndefined();
    });

    it('should reject or handle error for invalid options (error scenario)', async () => {
      // @ts-expect-error
      await expect(cleanCommand(undefined)).rejects.toBeDefined();
    });

    it('should resolve for empty options (edge case)', async () => {
      await expect(cleanCommand({})).resolves.toBeUndefined();
    });
  });

  describe('default export', () => {
    it('should export all expected functions', () => {
      expect(cleanExports.cleanCommand).toBe(cleanCommand);
      expect(cleanExports.validateCleanOptions).toBe(validateCleanOptions);
      expect(cleanExports.determineCleanupTargets).toBe(determineCleanupTargets);
      expect(cleanExports.formatCleanupResult).toBe(formatCleanupResult);
    });
  });
});
