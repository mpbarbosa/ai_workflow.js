/**
 * @fileoverview Tests for CLI Config Command
 * @module test/cli/commands/config.test
 */

import { describe, test, expect } from '@jest/globals';
import {
  validateConfigAction,
  getConfigValue,
  formatConfigValue,
  formatValidationErrors,
} from '../../../src/cli/commands/config.js';

describe('Config Command - Pure Functions', () => {
  describe('validateConfigAction', () => {
    test('should be valid for show action', () => {
      const result = validateConfigAction('show', []);
      expect(result.isValid).toBe(true);
      expect(result.action).toBe('show');
    });

    test('should be valid for get action with one arg', () => {
      const result = validateConfigAction('get', ['project.name']);
      expect(result.isValid).toBe(true);
    });

    test('should be valid for set action with two args', () => {
      const result = validateConfigAction('set', ['project.name', 'MyProject']);
      expect(result.isValid).toBe(true);
    });

    test('should be invalid for unknown action', () => {
      const result = validateConfigAction('delete', []);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Invalid action: delete. Valid actions: show, validate, get, set'
      );
    });

    test('should be invalid for get without key', () => {
      const result = validateConfigAction('get', []);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('get action requires exactly one argument: key');
    });

    test('should be invalid for set without value', () => {
      const result = validateConfigAction('set', ['key']);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('set action requires exactly two arguments: key value');
    });
  });

  describe('getConfigValue', () => {
    const config = {
      project: {
        name: 'MyProject',
        kind: 'nodejs_api',
      },
      workflow: {
        enabled: true,
      },
    };

    test('should get top-level value', () => {
      const value = getConfigValue(config, 'workflow');
      expect(value).toEqual({ enabled: true });
    });

    test('should get nested value', () => {
      const value = getConfigValue(config, 'project.name');
      expect(value).toBe('MyProject');
    });

    test('should return undefined for non-existent key', () => {
      const value = getConfigValue(config, 'project.foo');
      expect(value).toBeUndefined();
    });

    test('should return undefined for null config', () => {
      const value = getConfigValue(null, 'project.name');
      expect(value).toBeUndefined();
    });

    test('should return undefined for empty keyPath', () => {
      const value = getConfigValue(config, '');
      expect(value).toBeUndefined();
    });
  });

  describe('formatConfigValue', () => {
    test('should format string value', () => {
      const formatted = formatConfigValue('hello');
      expect(formatted).toBe('hello');
    });

    test('should format number value', () => {
      const formatted = formatConfigValue(42);
      expect(formatted).toBe('42');
    });

    test('should format object value as JSON', () => {
      const formatted = formatConfigValue({ name: 'test' });
      expect(formatted).toContain('"name"');
      expect(formatted).toContain('"test"');
    });

    test('should format null value', () => {
      const formatted = formatConfigValue(null);
      expect(formatted).toContain('not set');
    });

    test('should format undefined value', () => {
      const formatted = formatConfigValue(undefined);
      expect(formatted).toContain('not set');
    });
  });

  describe('formatValidationErrors', () => {
    test('should format error list', () => {
      const errors = [
        { path: 'project.name', message: 'Required field' },
        { path: 'workflow.stages', message: 'Invalid format' },
      ];

      const formatted = formatValidationErrors(errors);
      expect(formatted).toContain('Validation errors:');
      expect(formatted).toContain('project.name: Required field');
      expect(formatted).toContain('workflow.stages: Invalid format');
    });

    test('should handle empty errors', () => {
      const formatted = formatValidationErrors([]);
      expect(formatted).toBe('No errors');
    });

    test('should handle null errors', () => {
      const formatted = formatValidationErrors(null);
      expect(formatted).toBe('No errors');
    });
  });
});
