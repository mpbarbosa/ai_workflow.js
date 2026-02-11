/**
 * @fileoverview Tests for CLI Prompts Utilities
 * @module test/cli/prompts.test
 */

import { describe, test, expect } from '@jest/globals';
import {
  createConfirmPrompt,
  createInputPrompt,
  createListPrompt,
  createCheckboxPrompt,
  formatChoice,
} from '../../src/cli/prompts.js';

describe('CLI Prompts - Pure Functions', () => {
  describe('createConfirmPrompt', () => {
    test('should create confirm prompt config', () => {
      const config = createConfirmPrompt('Continue?', true);
      expect(config.type).toBe('confirm');
      expect(config.name).toBe('confirmed');
      expect(config.message).toBe('Continue?');
      expect(config.default).toBe(true);
    });

    test('should default to false', () => {
      const config = createConfirmPrompt('Delete files?');
      expect(config.default).toBe(false);
    });
  });

  describe('createInputPrompt', () => {
    test('should create input prompt config', () => {
      const config = createInputPrompt('Enter name:', 'default-name');
      expect(config.type).toBe('input');
      expect(config.name).toBe('value');
      expect(config.message).toBe('Enter name:');
      expect(config.default).toBe('default-name');
    });

    test('should include validation function if provided', () => {
      const validate = (input) => input.length > 0;
      const config = createInputPrompt('Name:', '', validate);
      expect(config.validate).toBe(validate);
    });

    test('should not include validate if not provided', () => {
      const config = createInputPrompt('Name:');
      expect(config.validate).toBeUndefined();
    });
  });

  describe('createListPrompt', () => {
    test('should create list prompt config', () => {
      const choices = ['option1', 'option2', 'option3'];
      const config = createListPrompt('Select:', choices, 'option2');
      expect(config.type).toBe('list');
      expect(config.name).toBe('selected');
      expect(config.message).toBe('Select:');
      expect(config.choices).toEqual(choices);
      expect(config.default).toBe('option2');
    });

    test('should default to null', () => {
      const config = createListPrompt('Select:', ['a', 'b']);
      expect(config.default).toBeNull();
    });
  });

  describe('createCheckboxPrompt', () => {
    test('should create checkbox prompt config', () => {
      const choices = ['opt1', 'opt2'];
      const config = createCheckboxPrompt('Select multiple:', choices);
      expect(config.type).toBe('checkbox');
      expect(config.name).toBe('selected');
      expect(config.message).toBe('Select multiple:');
      expect(config.choices).toEqual(choices);
    });
  });

  describe('formatChoice', () => {
    test('should format choice without description', () => {
      const choice = formatChoice('Option 1', 'opt1');
      expect(choice.name).toBe('Option 1');
      expect(choice.value).toBe('opt1');
    });

    test('should format choice with description', () => {
      const choice = formatChoice('Quick', 'quick', 'Fast validation');
      expect(choice.name).toContain('Quick');
      expect(choice.name).toContain('Fast validation');
      expect(choice.value).toBe('quick');
    });
  });
});
