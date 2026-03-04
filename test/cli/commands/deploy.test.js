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
});
