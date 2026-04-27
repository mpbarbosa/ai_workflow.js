import fixLogIssuesModule, {
  fixLogIssuesCommand,
  validateFixLogOptions,
  resolveLogDirectory,
  resolveProjectRoot,
  formatIssueSummary,
  estimateTokenCount,
  maxBodyCharsForModel,
  batchLogEntries,
  buildBatchPrompt,
  buildFixLogPrompt,
  buildMergePrompt,
  MODEL_CONTEXT_LIMITS,
  FixLogCommandOptions,
  FixLogOptionsValidationResult,
  LogEntry,
} from '../../../src/cli/commands/fix_log_issues';

describe('cli/commands/fix_log_issues', () => {
  describe('MODEL_CONTEXT_LIMITS', () => {
    it('should be a readonly object with string keys and number values', () => {
      expect(typeof MODEL_CONTEXT_LIMITS).toBe('object');
      for (const key in MODEL_CONTEXT_LIMITS) {
        expect(typeof key).toBe('string');
        expect(typeof MODEL_CONTEXT_LIMITS[key]).toBe('number');
      }
    });
  });

  describe('estimateTokenCount', () => {
    it('should estimate token count for a string', () => {
      expect(estimateTokenCount('hello world')).toBeGreaterThan(0);
      expect(estimateTokenCount('')).toBe(0);
    });

    it('should handle long strings', () => {
      const longText = 'a'.repeat(1000);
      expect(estimateTokenCount(longText)).toBeGreaterThan(0);
    });
  });

  describe('maxBodyCharsForModel', () => {
    it('should return a positive number for known model', () => {
      const model = Object.keys(MODEL_CONTEXT_LIMITS)[0] || 'gpt-4';
      expect(maxBodyCharsForModel(model)).toBeGreaterThan(0);
    });

    it('should handle unknown model gracefully', () => {
      expect(maxBodyCharsForModel('unknown-model')).toBeGreaterThanOrEqual(0);
    });
  });

  describe('validateFixLogOptions', () => {
    it('should validate correct options (happy path)', () => {
      const options: FixLogCommandOptions = { logDir: '/logs', severity: 'all' };
      const result: FixLogOptionsValidationResult = validateFixLogOptions(options);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should return errors for invalid options (edge case)', () => {
      // @ts-expect-error
      const result = validateFixLogOptions({ severity: 'invalid' });
      expect(result.isValid).toBe(false);
      expect(Array.isArray(result.errors)).toBe(true);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle undefined options', () => {
      // @ts-expect-error
      const result = validateFixLogOptions(undefined);
      expect(result.isValid).toBe(true);
      expect(Array.isArray(result.errors)).toBe(true);
    });
  });

  describe('resolveLogDirectory', () => {
    it('should return logDir from options if set', () => {
      const options: FixLogCommandOptions = { logDir: '/logs' };
      expect(resolveLogDirectory(options, '/cwd')).toBe('/logs');
    });

    it('should fallback to workflowDir if logDir not set', () => {
      const options: FixLogCommandOptions = { workflowDir: '/workflow' };
      expect(resolveLogDirectory(options, '/cwd')).toBe('/workflow');
    });

    it('should fallback to cwd if neither logDir nor workflowDir set', () => {
      expect(resolveLogDirectory({}, '/cwd')).toBe('/cwd');
    });
  });

  describe('resolveProjectRoot', () => {
    it('should return projectRoot from options if set', () => {
      const options: FixLogCommandOptions = { projectRoot: '/project' };
      expect(resolveProjectRoot(options, '/cwd')).toBe('/project');
    });

    it('should fallback to cwd if projectRoot not set', () => {
      expect(resolveProjectRoot({}, '/cwd')).toBe('/cwd');
    });
  });

  describe('formatIssueSummary', () => {
    it('should format summary with correct counts', () => {
      const summary = formatIssueSummary(2, 3, 5);
      expect(Array.isArray(summary)).toBe(true);
      expect(summary.join(' ')).toMatch(/2/);
      expect(summary.join(' ')).toMatch(/3/);
      expect(summary.join(' ')).toMatch(/5/);
    });
  });

  describe('batchLogEntries', () => {
    const entries: LogEntry[] = [
      { filePath: 'a.log', content: 'A'.repeat(10) },
      { filePath: 'b.log', content: 'B'.repeat(10) },
      { filePath: 'c.md', content: 'C'.repeat(10) },
    ];

    it('should batch entries within maxBodyChars', () => {
      const batches = batchLogEntries(entries, 30);
      expect(Array.isArray(batches)).toBe(true);
      expect(batches.length).toBeGreaterThan(0);
      expect(batches.flat().length).toBe(entries.length);
    });

    it('should place large file in its own batch', () => {
      const bigEntry: LogEntry = { filePath: 'big.log', content: 'X'.repeat(100) };
      const batches = batchLogEntries([bigEntry], 10);
      expect(batches.length).toBe(1);
      expect(batches[0][0]).toBe(bigEntry);
    });

    it('should handle empty entries array', () => {
      const batches = batchLogEntries([], 50);
      expect(Array.isArray(batches)).toBe(true);
      expect(batches.length).toBe(0);
    });
  });

  describe('buildBatchPrompt', () => {
    it('should build a prompt for a batch', () => {
      const entries: LogEntry[] = [
        { filePath: 'a.log', content: 'A' },
        { filePath: 'b.log', content: 'B' },
      ];
      const prompt = buildBatchPrompt(entries, '/project', 1, 2);
      expect(typeof prompt).toBe('string');
      expect(prompt).toMatch(/a\.log/);
      expect(prompt).toMatch(/b\.log/);
      expect(prompt).toMatch(/batch/i);
    });
  });

  describe('buildMergePrompt', () => {
    it('should build a merge prompt from partial plans', () => {
      const partials = ['plan1', 'plan2'];
      const prompt = buildMergePrompt(partials, '/project');
      expect(typeof prompt).toBe('string');
      expect(prompt).toMatch(/plan1/);
      expect(prompt).toMatch(/plan2/);
      expect(prompt).toMatch(/merge/i);
    });
  });

  describe('buildFixLogPrompt', () => {
    it('should build a fix log prompt from entries', () => {
      const entries: LogEntry[] = [
        { filePath: 'a.log', content: 'A' },
        { filePath: 'b.log', content: 'B' },
      ];
      const prompt = buildFixLogPrompt(entries, '/project');
      expect(typeof prompt).toBe('string');
      expect(prompt).toMatch(/a\.log/);
      expect(prompt).toMatch(/b\.log/);
    });

    it('should handle empty entries', () => {
      const prompt = buildFixLogPrompt([], '/project');
      expect(typeof prompt).toBe('string');
    });
  });

  describe('fixLogIssuesCommand', () => {
    it('should resolve for valid options (happy path)', async () => {
      await expect(fixLogIssuesCommand({ logDir: '/logs', dryRun: true })).resolves.toBeUndefined();
    });

    it('should resolve for empty options (edge case)', async () => {
      await expect(fixLogIssuesCommand({})).resolves.toBeUndefined();
    });

    it('should resolve for undefined options', async () => {
      // @ts-expect-error
      await expect(fixLogIssuesCommand(undefined)).resolves.toBeUndefined();
    });
  });

  describe('default export and module export', () => {
    it('should export all expected functions', () => {
      expect(fixLogIssuesModule.fixLogIssuesCommand).toBe(fixLogIssuesCommand);
      expect(fixLogIssuesModule.validateFixLogOptions).toBe(validateFixLogOptions);
      expect(fixLogIssuesModule.resolveLogDirectory).toBe(resolveLogDirectory);
      expect(fixLogIssuesModule.resolveProjectRoot).toBe(resolveProjectRoot);
      expect(fixLogIssuesModule.formatIssueSummary).toBe(formatIssueSummary);
      expect(fixLogIssuesModule.estimateTokenCount).toBe(estimateTokenCount);
      expect(fixLogIssuesModule.maxBodyCharsForModel).toBe(maxBodyCharsForModel);
      expect(fixLogIssuesModule.batchLogEntries).toBe(batchLogEntries);
      expect(fixLogIssuesModule.buildBatchPrompt).toBe(buildBatchPrompt);
      expect(fixLogIssuesModule.buildFixLogPrompt).toBe(buildFixLogPrompt);
      expect(fixLogIssuesModule.buildMergePrompt).toBe(buildMergePrompt);
    });
  });
});
