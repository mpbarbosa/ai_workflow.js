/**
 * @fileoverview Tests for CLI Deploy Command
 * @module test/cli/commands/deploy.test
 */

import { describe, test, expect } from '@jest/globals';
import {
  validateDeployOptions,
  resolveDeployConfig,
  buildDeployCommand,
  formatDeployResult,
  detectNpmPublishError,
} from '../../../src/cli/commands/deploy.js';

describe('Deploy Command - Pure Functions', () => {
  // ============================================================================
  // validateDeployOptions
  // ============================================================================
  describe('validateDeployOptions', () => {
    test('should be valid with empty options', () => {
      const result = validateDeployOptions({});
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should be valid with string projectRoot', () => {
      const result = validateDeployOptions({ projectRoot: '/some/path' });
      expect(result.isValid).toBe(true);
    });

    test('should be valid with dryRun flag', () => {
      const result = validateDeployOptions({ dryRun: true });
      expect(result.isValid).toBe(true);
    });

    test('should be invalid when projectRoot is not a string', () => {
      const result = validateDeployOptions({ projectRoot: 42 });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Project root must be a string');
    });

    test('should be invalid when config is not a string', () => {
      const result = validateDeployOptions({ config: true });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Config path must be a string');
    });
  });

  // ============================================================================
  // resolveDeployConfig
  // ============================================================================
  describe('resolveDeployConfig', () => {
    test('should resolve config with script', () => {
      const workflowConfig = {
        deploy: { script: 'scripts/deploy.sh', description: 'Deploy to CDN' },
      };
      const result = resolveDeployConfig(workflowConfig);
      expect(result.error).toBeNull();
      expect(result.config.script).toBe('scripts/deploy.sh');
      expect(result.config.description).toBe('Deploy to CDN');
      expect(result.config.enabled).toBe(true);
    });

    test('should resolve config with command', () => {
      const workflowConfig = {
        deploy: { command: 'npm run cdn', description: 'CDN release' },
      };
      const result = resolveDeployConfig(workflowConfig);
      expect(result.error).toBeNull();
      expect(result.config.command).toBe('npm run cdn');
      expect(result.config.script).toBeNull();
    });

    test('should use default description when not specified', () => {
      const workflowConfig = { deploy: { script: 'deploy.sh' } };
      const result = resolveDeployConfig(workflowConfig);
      expect(result.config.description).toBe('Deploy project');
    });

    test('should pass through args when specified', () => {
      const workflowConfig = { deploy: { script: 'scripts/deploy.sh', args: '--source src' } };
      const result = resolveDeployConfig(workflowConfig);
      expect(result.error).toBeNull();
      expect(result.config.args).toBe('--source src');
    });

    test('should set args to null when not specified', () => {
      const workflowConfig = { deploy: { script: 'deploy.sh' } };
      const result = resolveDeployConfig(workflowConfig);
      expect(result.config.args).toBeNull();
    });

    test('should error when deploy section is missing', () => {
      const result = resolveDeployConfig({ project: { name: 'test' } });
      expect(result.config).toBeNull();
      expect(result.error).toContain('No deploy: section found');
    });

    test('should error when deploy is disabled', () => {
      const result = resolveDeployConfig({ deploy: { enabled: false, script: 'deploy.sh' } });
      expect(result.config).toBeNull();
      expect(result.error).toContain('disabled');
    });

    test('should error when neither script nor command is specified', () => {
      const result = resolveDeployConfig({ deploy: { description: 'Deploy' } });
      expect(result.config).toBeNull();
      expect(result.error).toContain('script: or command:');
    });

    test('should error on null input', () => {
      const result = resolveDeployConfig(null);
      expect(result.config).toBeNull();
      expect(result.error).toContain('Invalid workflow configuration');
    });

    test('should error on non-object input', () => {
      const result = resolveDeployConfig('not an object');
      expect(result.config).toBeNull();
      expect(result.error).toContain('Invalid workflow configuration');
    });
  });

  // ============================================================================
  // buildDeployCommand
  // ============================================================================
  describe('buildDeployCommand', () => {
    test('should build bash command from relative script path', () => {
      const deployConfig = { script: 'scripts/deploy.sh', command: null };
      const result = buildDeployCommand(deployConfig, '/home/user/project');
      expect(result.command).toBe('bash "/home/user/project/scripts/deploy.sh"');
      expect(result.cwd).toBe('/home/user/project');
    });

    test('should use absolute script path as-is', () => {
      const deployConfig = { script: '/opt/scripts/deploy.sh', command: null };
      const result = buildDeployCommand(deployConfig, '/home/user/project');
      expect(result.command).toBe('bash "/opt/scripts/deploy.sh"');
    });

    test('should use command when no script is specified', () => {
      const deployConfig = { script: null, command: 'npm run cdn' };
      const result = buildDeployCommand(deployConfig, '/home/user/project');
      expect(result.command).toBe('npm run cdn');
      expect(result.cwd).toBe('/home/user/project');
    });

    test('should prefer script over command when both are provided', () => {
      const deployConfig = { script: 'scripts/deploy.sh', command: 'npm run cdn' };
      const result = buildDeployCommand(deployConfig, '/project');
      expect(result.command).toContain('bash');
      expect(result.command).toContain('deploy.sh');
    });

    test('should throw when deployConfig is null', () => {
      expect(() => buildDeployCommand(null, '/project')).toThrow('deployConfig must be a valid object');
    });

    test('should throw when deployConfig is not an object', () => {
      expect(() => buildDeployCommand('invalid', '/project')).toThrow('deployConfig must be a valid object');
    });

    test('should append args from config to script command', () => {
      const deployConfig = { script: 'scripts/deploy.sh', command: null, args: '--source src' };
      const result = buildDeployCommand(deployConfig, '/project');
      expect(result.command).toBe('bash "/project/scripts/deploy.sh" --source src');
    });

    test('should append args from config to bare command', () => {
      const deployConfig = { script: null, command: 'npm run deploy', args: '--env staging' };
      const result = buildDeployCommand(deployConfig, '/project');
      expect(result.command).toBe('npm run deploy --env staging');
    });

    test('should use extraArgs over config args when extraArgs is provided', () => {
      const deployConfig = { script: 'scripts/deploy.sh', command: null, args: '--source dist' };
      const result = buildDeployCommand(deployConfig, '/project', '--source src');
      expect(result.command).toBe('bash "/project/scripts/deploy.sh" --source src');
    });

    test('should produce no suffix when args is null and no extraArgs', () => {
      const deployConfig = { script: 'scripts/deploy.sh', command: null, args: null };
      const result = buildDeployCommand(deployConfig, '/project');
      expect(result.command).toBe('bash "/project/scripts/deploy.sh"');
    });

    test('should produce no suffix when args is empty string and no extraArgs', () => {
      const deployConfig = { script: 'scripts/deploy.sh', command: null, args: '' };
      const result = buildDeployCommand(deployConfig, '/project');
      expect(result.command).toBe('bash "/project/scripts/deploy.sh"');
    });
  });

  // ============================================================================
  // formatDeployResult
  // ============================================================================
  describe('formatDeployResult', () => {
    test('should format successful result', () => {
      const result = formatDeployResult({ success: true });
      expect(result).toContain('successfully');
    });

    test('should include duration in successful result', () => {
      const result = formatDeployResult({ success: true, duration: 5000 });
      expect(result).toContain('5.0s');
    });

    test('should format failed result with error message', () => {
      const result = formatDeployResult({ success: false, error: 'Script not found' });
      expect(result).toContain('failed');
      expect(result).toContain('Script not found');
    });

    test('should handle failed result with no error message', () => {
      const result = formatDeployResult({ success: false });
      expect(result).toContain('failed');
      expect(result).toContain('Unknown error');
    });

    test('should handle null result', () => {
      const result = formatDeployResult(null);
      expect(result).toBe('No result available');
    });
  });

  // ============================================================================
  // detectNpmPublishError
  // ============================================================================
  describe('detectNpmPublishError', () => {
    test('should return null for empty input', () => {
      expect(detectNpmPublishError('')).toBeNull();
      expect(detectNpmPublishError(null)).toBeNull();
      expect(detectNpmPublishError(undefined)).toBeNull();
    });

    test('should return null for unrecognised errors', () => {
      expect(detectNpmPublishError('Something went wrong')).toBeNull();
      expect(detectNpmPublishError('error: ENOENT no such file')).toBeNull();
    });

    test('should detect E403 with credential hint', () => {
      const output =
        'npm error code E403\nnpm error 403 Forbidden - You may not perform that action with these credentials.';
      const result = detectNpmPublishError(output);
      expect(result).not.toBeNull();
      expect(result.message).toMatch(/invalid or expired token/i);
      expect(result.hint).toMatch(/NPM_TOKEN/i);
      expect(result.url).toContain('npmjs.com');
    });

    test('should detect E403 without credential hint', () => {
      const output = 'npm error code E403\n403 Forbidden';
      const result = detectNpmPublishError(output);
      expect(result).not.toBeNull();
      expect(result.message).toMatch(/access forbidden/i);
      expect(result.hint).toMatch(/publish rights/i);
    });

    test('should detect E401', () => {
      const output = 'npm error code E401\n401 Unauthorized';
      const result = detectNpmPublishError(output);
      expect(result).not.toBeNull();
      expect(result.message).toMatch(/authentication required/i);
      expect(result.hint).toMatch(/NPM_TOKEN/i);
    });

    test('should detect E409 version conflict', () => {
      const output = 'npm error code E409\ncannot publish over existing version';
      const result = detectNpmPublishError(output);
      expect(result).not.toBeNull();
      expect(result.message).toMatch(/already published/i);
      expect(result.hint).toMatch(/version/i);
      expect(result.url).toBeNull();
    });

    test('should detect ENEEDAUTH', () => {
      const output = 'npm error code ENEEDAUTH\nnpm error need auth';
      const result = detectNpmPublishError(output);
      expect(result).not.toBeNull();
      expect(result.message).toMatch(/no npm credentials/i);
      expect(result.hint).toMatch(/npm login/i);
    });

    test('should detect E404 scope not found', () => {
      const output = 'npm error code E404\n404 Not Found';
      const result = detectNpmPublishError(output);
      expect(result).not.toBeNull();
      expect(result.message).toMatch(/not found/i);
      expect(result.hint).toMatch(/scope/i);
    });
  });
});
