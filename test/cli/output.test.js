/**
 * @fileoverview Tests for CLI Output Utilities
 * @module test/cli/output.test
 */

import { describe, test, expect } from '@jest/globals';
import {
  calculateColumnWidths,
  padString,
  formatTableRow,
  createTableBorder,
  formatTable,
  createBox,
  formatKeyValue,
  formatList,
  truncateString,
} from '../../src/cli/output.js';

describe('CLI Output - Pure Functions', () => {
  describe('calculateColumnWidths', () => {
    test('should calculate column widths', () => {
      const rows = [
        ['Name', 'Age', 'City'],
        ['Alice', '30', 'New York'],
        ['Bob', '25', 'LA'],
      ];
      const widths = calculateColumnWidths(rows);
      expect(widths).toEqual([5, 3, 8]);
    });

    test('should handle empty rows', () => {
      const widths = calculateColumnWidths([]);
      expect(widths).toEqual([]);
    });
  });

  describe('padString', () => {
    test('should pad left', () => {
      expect(padString('hi', 5, 'left')).toBe('hi   ');
    });

    test('should pad right', () => {
      expect(padString('hi', 5, 'right')).toBe('   hi');
    });

    test('should pad center', () => {
      expect(padString('hi', 6, 'center')).toBe('  hi  ');
    });

    test('should not pad if already wide enough', () => {
      expect(padString('hello', 3)).toBe('hello');
    });
  });

  describe('formatTableRow', () => {
    test('should format table row', () => {
      const row = ['Name', 'Age'];
      const widths = [10, 5];
      const formatted = formatTableRow(row, widths);
      expect(formatted).toContain('Name');
      expect(formatted).toContain('Age');
      expect(formatted).toContain('│');
    });
  });

  describe('createTableBorder', () => {
    test('should create top border', () => {
      const border = createTableBorder([5, 5], 'top');
      expect(border).toContain('┌');
      expect(border).toContain('┬');
      expect(border).toContain('┐');
    });

    test('should create middle border', () => {
      const border = createTableBorder([5, 5], 'middle');
      expect(border).toContain('├');
      expect(border).toContain('┼');
      expect(border).toContain('┤');
    });

    test('should create bottom border', () => {
      const border = createTableBorder([5, 5], 'bottom');
      expect(border).toContain('└');
      expect(border).toContain('┴');
      expect(border).toContain('┘');
    });
  });

  describe('formatTable', () => {
    test('should format table', () => {
      const rows = [
        ['Name', 'Age'],
        ['Alice', '30'],
        ['Bob', '25'],
      ];
      const table = formatTable(rows);
      expect(table).toContain('Name');
      expect(table).toContain('Alice');
      expect(table).toContain('Bob');
      expect(table).toContain('┌');
      expect(table).toContain('└');
    });

    test('should handle empty rows', () => {
      const table = formatTable([]);
      expect(table).toBe('No data');
    });
  });

  describe('createBox', () => {
    test('should create box around text', () => {
      const box = createBox('Hello');
      expect(box).toContain('Hello');
      expect(box).toContain('┌');
      expect(box).toContain('└');
    });

    test('should create box with title', () => {
      const box = createBox('Content', { title: 'Title' });
      expect(box).toContain('Title');
      expect(box).toContain('Content');
    });

    test('should handle multiline text', () => {
      const box = createBox('Line 1\nLine 2');
      expect(box).toContain('Line 1');
      expect(box).toContain('Line 2');
    });
  });

  describe('formatKeyValue', () => {
    test('should format key-value pairs', () => {
      const data = { name: 'Alice', age: '30' };
      const formatted = formatKeyValue(data);
      expect(formatted).toContain('name');
      expect(formatted).toContain('Alice');
      expect(formatted).toContain('age');
      expect(formatted).toContain('30');
    });

    test('should handle custom separator', () => {
      const data = { key: 'value' };
      const formatted = formatKeyValue(data, { separator: ' = ' });
      expect(formatted).toContain('key = value');
    });
  });

  describe('formatList', () => {
    test('should format list with bullets', () => {
      const items = ['Item 1', 'Item 2', 'Item 3'];
      const formatted = formatList(items);
      expect(formatted).toContain('•');
      expect(formatted).toContain('Item 1');
      expect(formatted).toContain('Item 2');
    });

    test('should handle custom bullet', () => {
      const items = ['Item'];
      const formatted = formatList(items, { bullet: '-' });
      expect(formatted).toContain('- Item');
    });
  });

  describe('truncateString', () => {
    test('should truncate long string', () => {
      const result = truncateString('This is a long string', 10);
      expect(result).toHaveLength(10);
      expect(result).toContain('...');
    });

    test('should not truncate short string', () => {
      const result = truncateString('Short', 10);
      expect(result).toBe('Short');
    });

    test('should handle custom ellipsis', () => {
      const result = truncateString('Long string', 8, '---');
      expect(result).toContain('---');
    });
  });
});
