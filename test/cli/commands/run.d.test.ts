import runCommandExports, {
  runCommand,
  validateRunOptions,
  createOrchestratorOptions,
  formatWorkflowResult,
  RunCommandOptions,
  RunCommandResult,
} from '../../src/cli/commands/run';

describe('cli/commands/run', () => {
  describe('validateRunOptions', () => {
    it('should validate correct options as valid', () => {
      const options: RunCommandOptions = {
        auto: true,
        dryRun: false,
        provider: 'copilot',
        verbose: true,
        alternatives: 2,
      };
      const result = validateRunOptions(options);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should return errors for invalid provider', () => {
      const options: RunCommandOptions = {
        provider: 'invalid-provider',
      };
      const result = validateRunOptions(options);
      expect(result.isValid).toBe(false);
      expect(Array.isArray(result.errors)).toBe(true);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle undefined options gracefully', () => {
      const result = validateRunOptions();
      expect(result.isValid).toBe(true);
    });

    it('should handle invalid types in options', () => {
      // @ts-expect-error
      const result = validateRunOptions({ auto: 'yes', dryRun: 'no' });
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('createOrchestratorOptions', () => {
    it('should create orchestrator options from valid CLI options', () => {
      const cliOptions: RunCommandOptions = {
        workflowDir: '/workflows',
        projectRoot: '/project',
        stage: 'full',
        auto: true,
        dryRun: false,
        noAutoResume: true,
        parallel: false,
        sdkSmokeTest: false,
        alternatives: 1,
        verbose: true,
        provider: 'copilot',
      };
      const orchestratorOptions = createOrchestratorOptions(cliOptions);
      expect(orchestratorOptions).toHaveProperty('workflowDir');
      expect(orchestratorOptions).toHaveProperty('projectRoot');
      expect(orchestratorOptions).toHaveProperty('stage');
      expect(orchestratorOptions).toHaveProperty('auto');
      expect(orchestratorOptions).toHaveProperty('dryRun');
      expect(orchestratorOptions).toHaveProperty('noParallel');
      expect(orchestratorOptions).toHaveProperty('sdkSmokeTest');
      expect(orchestratorOptions).toHaveProperty('alternatives');
      expect(orchestratorOptions).toHaveProperty('verbose');
      expect(orchestratorOptions).toHaveProperty('streamingEnabled');
      expect(orchestratorOptions).toHaveProperty('provider');
    });

    it('should handle undefined CLI options', () => {
      const orchestratorOptions = createOrchestratorOptions();
      expect(orchestratorOptions).toBeDefined();
      expect(typeof orchestratorOptions).toBe('object');
    });
  });

  describe('formatWorkflowResult', () => {
    it('should format a valid RunCommandResult', () => {
      const result: RunCommandResult = {
        duration: 1234,
        results: { summary: { failed: 0, succeeded: 5, total: 5 } },
        success: true,
        summary: { report: 'All steps passed' },
      };
      const output = formatWorkflowResult(result);
      expect(typeof output).toBe('string');
      expect(output).toMatch(/All steps passed/);
    });

    it('should handle null or undefined result', () => {
      expect(typeof formatWorkflowResult(null)).toBe('string');
      expect(typeof formatWorkflowResult(undefined)).toBe('string');
    });

    it('should handle result with error', () => {
      const result: RunCommandResult = {
        duration: 100,
        results: { summary: { failed: 2, succeeded: 3, total: 5 } },
        success: false,
        error: 'Workflow failed',
        summary: 'Failure summary',
      };
      const output = formatWorkflowResult(result);
      expect(typeof output).toBe('string');
      expect(output).toMatch(/Workflow failed/);
      expect(output).toMatch(/Failure summary/);
    });
  });

  describe('runCommand', () => {
    it('should resolve for valid options', async () => {
      const options: RunCommandOptions = {
        auto: true,
        provider: 'copilot',
        verbose: false,
      };
      await expect(runCommand(options)).resolves.toBeUndefined();
    });

    it('should reject or throw for invalid options', async () => {
      // @ts-expect-error
      await expect(runCommand({ provider: 'invalid' })).rejects.toBeDefined();
    });

    it('should handle missing options gracefully', async () => {
      await expect(runCommand()).resolves.toBeUndefined();
    });
  });
});
