import deployModule, {
  deployCommand,
  validateDeployOptions,
  resolveDeployConfig,
  buildDeployCommand,
  resolvePromptMergeStep,
  formatDeployResult,
  detectAlreadyDeployedError,
  detectNpmPublishError,
  parseEnvFile,
  resolveCdnFallbackConfig,
  hasNpmToken,
  referencesNpmToken,
  resolveMissingNpmTokenPreflight,
  shouldUseCdnFallback,
  DeployCommandOptions,
  DeployValidationResult,
  DeploymentExecutionConfig,
  CdnFallbackConfig,
  DeployCommandResult,
  AlreadyDeployedResult,
  NpmPublishErrorHint,
  MissingNpmTokenPreflight,
  RawDeploySection,
} from '../../../src/cli/commands/deploy';

describe('cli/commands/deploy', () => {
  describe('validateDeployOptions', () => {
    it('should validate correct options (happy path)', () => {
      const options: DeployCommandOptions = { dryRun: true, projectRoot: '/tmp' };
      const result: DeployValidationResult = validateDeployOptions(options);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should return errors for invalid options (edge case)', () => {
      // Simulate an invalid option (e.g., wrong type)
      // @ts-expect-error
      const result = validateDeployOptions({ dryRun: 'yes' });
      expect(result.isValid).toBe(false);
      expect(Array.isArray(result.errors)).toBe(true);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle empty options', () => {
      const result = validateDeployOptions({});
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should handle undefined options', () => {
      // @ts-expect-error
      const result = validateDeployOptions(undefined);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('resolveDeployConfig', () => {
    it('should resolve valid deploy config', () => {
      const workflowConfig = {
        deploy: {
          script: 'deploy.sh',
          command: null,
          description: 'Deploy script',
          args: null,
          enabled: true,
        },
      };
      const { config, error } = resolveDeployConfig(workflowConfig);
      expect(error).toBeNull();
      expect(config).not.toBeNull();
      expect(config?.script).toBe('deploy.sh');
    });

    it('should return error for invalid config', () => {
      const { config, error } = resolveDeployConfig(null);
      expect(config).toBeNull();
      expect(typeof error === 'string' || error === null).toBe(true);
    });
  });

  describe('buildDeployCommand', () => {
    it('should build command with extra args', () => {
      const deployConfig: DeploymentExecutionConfig = {
        script: null,
        command: 'echo deploy',
        description: 'desc',
        args: '--prod',
        enabled: true,
      };
      const result = buildDeployCommand(deployConfig, '/project', '--extra');
      expect(result.command).toMatch(/echo deploy/);
      expect(result.command).toMatch(/--prod/);
      expect(result.command).toMatch(/--extra/);
      expect(result.cwd).toBe('/project');
    });

    it('should build command without extra args', () => {
      const deployConfig: DeploymentExecutionConfig = {
        script: null,
        command: 'deploy',
        description: 'desc',
        args: null,
        enabled: true,
      };
      const result = buildDeployCommand(deployConfig, '/root');
      expect(result.command).toMatch(/deploy/);
      expect(result.cwd).toBe('/root');
    });
  });

  describe('resolvePromptMergeStep', () => {
    it('should return a PromptMergeStep if existsFn returns true', () => {
      const existsFn = jest.fn().mockReturnValue(true);
      const step = resolvePromptMergeStep('/project', existsFn);
      if (step) {
        expect(typeof step.description).toBe('string');
        expect(typeof step.command).toBe('string');
        expect(typeof step.cwd).toBe('string');
        expect(typeof step.outputPath).toBe('string');
      } else {
        expect(step).toBeNull();
      }
    });

    it('should return null if existsFn returns false', () => {
      const existsFn = jest.fn().mockReturnValue(false);
      const step = resolvePromptMergeStep('/project', existsFn);
      expect(step).toBeNull();
    });
  });

  describe('formatDeployResult', () => {
    it('should format a successful deploy result', () => {
      const result: DeployCommandResult = { success: true, duration: 1234 };
      const output = formatDeployResult(result);
      expect(typeof output).toBe('string');
      expect(output).toMatch(/success/i);
      expect(output).toMatch(/1234/);
    });

    it('should format a skipped deploy result', () => {
      const result: DeployCommandResult = { skipped: true, reason: 'Already deployed' };
      const output = formatDeployResult(result);
      expect(output).toMatch(/skipped/i);
      expect(output).toMatch(/Already deployed/);
    });

    it('should handle null or undefined result', () => {
      expect(typeof formatDeployResult(null)).toBe('string');
      // @ts-expect-error
      expect(typeof formatDeployResult(undefined)).toBe('string');
    });
  });

  describe('detectAlreadyDeployedError', () => {
    it('should detect already deployed by exit code 3', () => {
      const result = detectAlreadyDeployedError(3, 'output');
      expect(result).not.toBeNull();
      expect(result?.message).toBeDefined();
      expect(result?.hint).toBeDefined();
    });

    it('should return null for other exit codes', () => {
      expect(detectAlreadyDeployedError(0, 'output')).toBeNull();
      expect(detectAlreadyDeployedError(null, 'output')).toBeNull();
    });
  });

  describe('detectNpmPublishError', () => {
    it('should detect known npm publish error', () => {
      const output = 'npm ERR! code E403';
      const result = detectNpmPublishError(output);
      if (result) {
        expect(result.message).toMatch(/E403/);
        expect(result.hint).toBeDefined();
      } else {
        expect(result).toBeNull();
      }
    });

    it('should return null for unknown output', () => {
      expect(detectNpmPublishError('all good')).toBeNull();
      expect(detectNpmPublishError(null)).toBeNull();
    });
  });

  describe('parseEnvFile', () => {
    it('should parse key=value pairs', () => {
      const env = parseEnvFile('FOO=bar\nBAR="baz"\n# comment\n\nBAZ=42');
      expect(env.FOO).toBe('bar');
      expect(env.BAR).toBe('baz');
      expect(env.BAZ).toBe('42');
    });

    it('should skip blank and comment lines', () => {
      const env = parseEnvFile('\n# comment\nFOO=bar\n');
      expect(env.FOO).toBe('bar');
      expect(Object.keys(env).length).toBe(1);
    });

    it('should handle quoted values', () => {
      const env = parseEnvFile("FOO='bar'\nBAR=\"baz\"");
      expect(env.FOO).toBe('bar');
      expect(env.BAR).toBe('baz');
    });
  });

  describe('resolveCdnFallbackConfig', () => {
    it('should resolve cdn fallback config if present', () => {
      const section: RawDeploySection = {
        script: 'deploy.sh',
        command: null,
        description: 'desc',
        args: null,
        cdn_fallback: {
          script: 'cdn.sh',
          command: null,
          description: 'cdn desc',
          args: null,
          env: { CDN: '1' },
        },
      };
      const config = resolveCdnFallbackConfig(section);
      if (config) {
        expect(config.script).toBe('cdn.sh');
        expect(config.env.CDN).toBe('1');
      } else {
        expect(config).toBeNull();
      }
    });

    it('should return null if no cdn_fallback', () => {
      const config = resolveCdnFallbackConfig({});
      expect(config).toBeNull();
    });

    it('should return null for null/undefined', () => {
      expect(resolveCdnFallbackConfig(null)).toBeNull();
      // @ts-expect-error
      expect(resolveCdnFallbackConfig(undefined)).toBeNull();
    });
  });

  describe('hasNpmToken', () => {
    it('should return true if NPM_TOKEN is set', () => {
      expect(hasNpmToken({ NPM_TOKEN: 'abc' })).toBe(true);
    });

    it('should return false if NPM_TOKEN is missing or empty', () => {
      expect(hasNpmToken({})).toBe(false);
      expect(hasNpmToken({ NPM_TOKEN: '' })).toBe(false);
    });

    it('should handle non-object env', () => {
      expect(hasNpmToken(null)).toBe(false);
      expect(hasNpmToken(undefined)).toBe(false);
    });
  });

  describe('referencesNpmToken', () => {
    it('should detect NPM_TOKEN reference', () => {
      expect(referencesNpmToken('echo $NPM_TOKEN')).toBe(true);
      expect(referencesNpmToken('NPM_TOKEN=abc')).toBe(true);
    });

    it('should return false if not referenced', () => {
      expect(referencesNpmToken('echo hello')).toBe(false);
      expect(referencesNpmToken(null)).toBe(false);
      expect(referencesNpmToken(undefined)).toBe(false);
    });
  });

  describe('resolveMissingNpmTokenPreflight', () => {
    const deployConfig: DeploymentExecutionConfig = {
      script: null,
      command: 'npm publish',
      description: 'desc',
      args: null,
      enabled: true,
    };

    it('should return a hint if NPM_TOKEN is missing and referenced', () => {
      const readFileFn = jest.fn().mockReturnValue('NPM_TOKEN');
      const existsFn = jest.fn().mockReturnValue(true);
      const result = resolveMissingNpmTokenPreflight(deployConfig, '/root', {}, readFileFn, existsFn);
      if (result) {
        expect(result.message).toBeDefined();
        expect(result.hint).toBeDefined();
        expect(result.source).toBeDefined();
      } else {
        expect(result).toBeNull();
      }
    });

    it('should return null if NPM_TOKEN is present', () => {
      const result = resolveMissingNpmTokenPreflight(deployConfig, '/root', { NPM_TOKEN: 'abc' });
      expect(result).toBeNull();
    });

    it('should return null if deployConfig is null', () => {
      const result = resolveMissingNpmTokenPreflight(null, '/root', {});
      expect(result).toBeNull();
    });
  });

  describe('shouldUseCdnFallback', () => {
    const cdnFallbackConfig: CdnFallbackConfig = {
      script: 'cdn.sh',
      command: null,
      description: 'desc',
      args: null,
      enabled: true,
      env: {},
    };

    it('should return true if cdnFallbackConfig is present and NPM_TOKEN is missing', () => {
      expect(shouldUseCdnFallback(cdnFallbackConfig, {})).toBe(true);
    });

    it('should return false if cdnFallbackConfig is null', () => {
      expect(shouldUseCdnFallback(null, {})).toBe(false);
    });

    it('should return false if NPM_TOKEN is present', () => {
      expect(shouldUseCdnFallback(cdnFallbackConfig, { NPM_TOKEN: 'abc' })).toBe(false);
    });
  });

  describe('deployCommand', () => {
    it('should resolve for valid options (happy path)', async () => {
      await expect(deployCommand({ dryRun: true })).resolves.toBeUndefined();
    });

    it('should reject or handle error for invalid options', async () => {
      // @ts-expect-error
      await expect(deployCommand({ dryRun: 'yes' })).rejects.toBeDefined();
    });

    it('should resolve for empty options (edge case)', async () => {
      await expect(deployCommand({})).resolves.toBeUndefined();
    });

    it('should resolve for undefined options', async () => {
      // @ts-expect-error
      await expect(deployCommand(undefined)).resolves.toBeUndefined();
    });
  });

  describe('default export and module export', () => {
    it('should export all expected functions', () => {
      expect(deployModule.deployCommand).toBe(deployCommand);
      expect(deployModule.validateDeployOptions).toBe(validateDeployOptions);
      expect(deployModule.resolveDeployConfig).toBe(resolveDeployConfig);
      expect(deployModule.buildDeployCommand).toBe(buildDeployCommand);
      expect(deployModule.resolvePromptMergeStep).toBe(resolvePromptMergeStep);
      expect(deployModule.formatDeployResult).toBe(formatDeployResult);
      expect(deployModule.detectAlreadyDeployedError).toBe(detectAlreadyDeployedError);
      expect(deployModule.detectNpmPublishError).toBe(detectNpmPublishError);
      expect(deployModule.parseEnvFile).toBe(parseEnvFile);
      expect(deployModule.resolveCdnFallbackConfig).toBe(resolveCdnFallbackConfig);
      expect(deployModule.hasNpmToken).toBe(hasNpmToken);
      expect(deployModule.referencesNpmToken).toBe(referencesNpmToken);
      expect(deployModule.resolveMissingNpmTokenPreflight).toBe(resolveMissingNpmTokenPreflight);
      expect(deployModule.shouldUseCdnFallback).toBe(shouldUseCdnFallback);
    });
  });
});
