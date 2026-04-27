import configModule, {
  configCommand,
  validateConfigAction,
  getConfigValue,
  formatConfigValue,
  formatValidationErrors,
  ConfigCommandValidationResult,
  ConfigValidationIssue,
  ConfigCommandOptions,
  ConfigRecord,
  ConfigValue,
} from '../../../src/cli/commands/config';

describe('cli/commands/config', () => {
  describe('validateConfigAction', () => {
    it('should validate a supported action (happy path)', () => {
      const result: ConfigCommandValidationResult = validateConfigAction('show', []);
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.action).toBe('show');
    });

    it('should return errors for unsupported action', () => {
      const result = validateConfigAction('delete', []);
      expect(result.isValid).toBe(false);
      expect(Array.isArray(result.errors)).toBe(true);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.action).toBe('delete');
    });

    it('should handle empty action string', () => {
      const result = validateConfigAction('', []);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle undefined action', () => {
      // @ts-expect-error
      const result = validateConfigAction(undefined, []);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('getConfigValue', () => {
    const config: ConfigRecord = {
      foo: 'bar',
      nested: {
        baz: 42,
        arr: [1, 2, 3],
        obj: { key: 'value' },
      },
    };

    it('should get a top-level value', () => {
      expect(getConfigValue(config, 'foo')).toBe('bar');
    });

    it('should get a nested value', () => {
      expect(getConfigValue(config, 'nested.baz')).toBe(42);
    });

    it('should get a nested array', () => {
      expect(getConfigValue(config, 'nested.arr')).toEqual([1, 2, 3]);
    });

    it('should get a nested object', () => {
      expect(getConfigValue(config, 'nested.obj')).toEqual({ key: 'value' });
    });

    it('should return undefined for missing key', () => {
      expect(getConfigValue(config, 'missing')).toBeUndefined();
    });

    it('should return undefined for missing nested key', () => {
      expect(getConfigValue(config, 'nested.missing')).toBeUndefined();
    });

    it('should handle null config', () => {
      expect(getConfigValue(null, 'foo')).toBeUndefined();
    });

    it('should handle undefined config', () => {
      // @ts-expect-error
      expect(getConfigValue(undefined, 'foo')).toBeUndefined();
    });
  });

  describe('formatConfigValue', () => {
    it('should format string value', () => {
      expect(formatConfigValue('hello')).toMatch(/hello/);
    });

    it('should format number value', () => {
      expect(formatConfigValue(123)).toMatch(/123/);
    });

    it('should format boolean value', () => {
      expect(formatConfigValue(true)).toMatch(/true/i);
    });

    it('should format null value', () => {
      expect(formatConfigValue(null)).toMatch(/null/i);
    });

    it('should format object value', () => {
      expect(formatConfigValue({ foo: 'bar' })).toMatch(/foo/);
    });

    it('should format array value', () => {
      expect(formatConfigValue([1, 2, 3])).toMatch(/\[/);
    });

    it('should handle undefined value', () => {
      expect(formatConfigValue(undefined)).toMatch(/undefined|null/i);
    });
  });

  describe('formatValidationErrors', () => {
    it('should format ConfigValidationIssue array', () => {
      const errors: ConfigValidationIssue[] = [
        { path: 'foo', message: 'Invalid value' },
        { message: 'Missing key' },
      ];
      const output = formatValidationErrors(errors);
      expect(typeof output).toBe('string');
      expect(output).toMatch(/foo/);
      expect(output).toMatch(/Invalid value/);
      expect(output).toMatch(/Missing key/);
    });

    it('should format string array', () => {
      const errors = ['Error 1', 'Error 2'];
      const output = formatValidationErrors(errors);
      expect(typeof output).toBe('string');
      expect(output).toMatch(/Error 1/);
      expect(output).toMatch(/Error 2/);
    });

    it('should handle null errors', () => {
      const output = formatValidationErrors(null);
      expect(typeof output).toBe('string');
      expect(output.length).toBeGreaterThan(0);
    });

    it('should handle undefined errors', () => {
      // @ts-expect-error
      const output = formatValidationErrors(undefined);
      expect(typeof output).toBe('string');
      expect(output.length).toBeGreaterThan(0);
    });
  });

  describe('configCommand', () => {
    it('should resolve for supported action (happy path)', async () => {
      await expect(configCommand('show', [], {})).resolves.toBeUndefined();
    });

    it('should reject or handle error for unsupported action', async () => {
      await expect(configCommand('delete', [], {})).rejects.toBeDefined();
    });

    it('should resolve for empty args/options (edge case)', async () => {
      await expect(configCommand('show', [], {})).resolves.toBeUndefined();
    });

    it('should reject or handle error for undefined action', async () => {
      // @ts-expect-error
      await expect(configCommand(undefined, [], {})).rejects.toBeDefined();
    });
  });

  describe('default export and module export', () => {
    it('should export all expected functions', () => {
      expect(configModule.configCommand).toBe(configCommand);
      expect(configModule.validateConfigAction).toBe(validateConfigAction);
      expect(configModule.getConfigValue).toBe(getConfigValue);
      expect(configModule.formatConfigValue).toBe(formatConfigValue);
      expect(configModule.formatValidationErrors).toBe(formatValidationErrors);
    });
  });
});
