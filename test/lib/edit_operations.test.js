/**
 * Tests for Edit Operations Module
 * @description Re-exported from olinda_shell_interface.js v0.5.10 via src/lib/edit_operations.js.
 * @see https://github.com/mpbarbosa/olinda_shell_interface.js
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import {
  findMatches,
  replaceAll,
  replaceFirst,
  insertAtLine,
  appendText,
  prependText,
  deleteLines,
  extractLines,
  getLineRange,
  replaceLineRange,
  generateDiff,
  formatDiff,
  EditOperations,
  FileSystemError,
} from '../../src/lib/edit_operations.js';

/**
 * PURE FUNCTION TESTS - Deterministic, no I/O
 */

describe('Pure Functions - findMatches', () => {
  const text = 'Hello World\nHello Again\nGoodbye World';

  test('finds all matches with line numbers', () => {
    const matches = findMatches(text, /Hello/g);
    expect(matches).toHaveLength(2);
    expect(matches[0].match).toBe('Hello');
    expect(matches[0].line).toBe(1);
    expect(matches[1].line).toBe(2);
  });

  test('finds matches with regex pattern', () => {
    const matches = findMatches(text, /World/g);
    expect(matches).toHaveLength(2);
    expect(matches[0].line).toBe(1);
    expect(matches[1].line).toBe(3);
  });

  test('finds matches with string pattern', () => {
    const matches = findMatches(text, 'Hello');
    expect(matches).toHaveLength(2);
  });

  test('returns empty array for no matches', () => {
    const matches = findMatches(text, /NotFound/g);
    expect(matches).toEqual([]);
  });

  test('handles invalid input', () => {
    expect(findMatches(null, /test/)).toEqual([]);
    expect(findMatches(undefined, /test/)).toEqual([]);
  });

  test('includes line content in results', () => {
    const matches = findMatches(text, /Hello/g);
    expect(matches[0].lineContent).toBe('Hello World');
  });
});

describe('Pure Functions - replaceAll', () => {
  test('replaces all occurrences with string', () => {
    const result = replaceAll('foo bar foo', /foo/g, 'baz');
    expect(result).toBe('baz bar baz');
  });

  test('replaces with function', () => {
    const result = replaceAll('test 1 test 2', /test/g, () => 'TEST');
    expect(result).toBe('TEST 1 TEST 2');
  });

  test('handles string pattern', () => {
    const result = replaceAll('abc abc', 'abc', 'xyz');
    expect(result).toBe('xyz xyz');
  });

  test('handles invalid input', () => {
    expect(replaceAll(null, /test/, 'replacement')).toBe('');
    expect(replaceAll(undefined, /test/, 'replacement')).toBe('');
  });

  test('returns original text if pattern not found', () => {
    const text = 'hello world';
    expect(replaceAll(text, /notfound/, 'replacement')).toBe(text);
  });
});

describe('Pure Functions - replaceFirst', () => {
  test('replaces only first occurrence', () => {
    const result = replaceFirst('foo bar foo', /foo/g, 'baz');
    expect(result).toBe('baz bar foo');
  });

  test('handles string pattern', () => {
    const result = replaceFirst('test test', 'test', 'TEST');
    expect(result).toBe('TEST test');
  });

  test('handles invalid input', () => {
    expect(replaceFirst(null, /test/, 'replacement')).toBe('');
  });
});

describe('Pure Functions - insertAtLine', () => {
  const text = 'line1\nline2\nline3';

  test('inserts after specified line', () => {
    const result = insertAtLine(text, 2, 'inserted');
    expect(result).toBe('line1\nline2\ninserted\nline3');
  });

  test('inserts before specified line', () => {
    const result = insertAtLine(text, 2, 'inserted', 'before');
    expect(result).toBe('line1\ninserted\nline2\nline3');
  });

  test('inserts at beginning', () => {
    const result = insertAtLine(text, 1, 'first', 'before');
    expect(result).toBe('first\nline1\nline2\nline3');
  });

  test('inserts at end', () => {
    const result = insertAtLine(text, 3, 'last');
    expect(result).toBe('line1\nline2\nline3\nlast');
  });

  test('handles invalid line numbers', () => {
    expect(insertAtLine(text, 0, 'test')).toBe(text);
    expect(insertAtLine(text, 100, 'test')).toBe(text);
  });

  test('handles invalid input', () => {
    expect(insertAtLine(null, 1, 'test')).toBe(null);
  });
});

describe('Pure Functions - appendText', () => {
  test('appends to end of text', () => {
    const result = appendText('hello', 'world');
    expect(result).toBe('hello\nworld');
  });

  test('appends without newline when disabled', () => {
    const result = appendText('hello', 'world', false);
    expect(result).toBe('helloworld');
  });

  test('handles empty original text', () => {
    const result = appendText('', 'content');
    expect(result).toBe('content');
  });

  test('handles text already ending with newline', () => {
    const result = appendText('hello\n', 'world');
    expect(result).toBe('hello\nworld');
  });

  test('handles invalid input', () => {
    expect(appendText(null, 'test')).toBe('test');
  });
});

describe('Pure Functions - prependText', () => {
  test('prepends to beginning of text', () => {
    const result = prependText('world', 'hello');
    expect(result).toBe('hello\nworld');
  });

  test('prepends without newline when disabled', () => {
    const result = prependText('world', 'hello', false);
    expect(result).toBe('helloworld');
  });

  test('handles empty original text', () => {
    const result = prependText('', 'content');
    expect(result).toBe('content');
  });

  test('handles content already ending with newline', () => {
    const result = prependText('world', 'hello\n');
    expect(result).toBe('hello\nworld');
  });

  test('handles invalid input', () => {
    expect(prependText(null, 'test')).toBe('test');
  });
});

describe('Pure Functions - deleteLines', () => {
  const text = 'keep this\ndelete this\nkeep this too\ndelete this also';

  test('deletes lines matching pattern', () => {
    const result = deleteLines(text, /delete/);
    expect(result).toBe('keep this\nkeep this too');
  });

  test('deletes lines matching string pattern', () => {
    const result = deleteLines(text, 'delete');
    expect(result).toBe('keep this\nkeep this too');
  });

  test('returns original if no matches', () => {
    const result = deleteLines(text, /notfound/);
    expect(result).toBe(text);
  });

  test('handles invalid input', () => {
    expect(deleteLines(null, /test/)).toBe('');
  });
});

describe('Pure Functions - extractLines', () => {
  const text = 'line1: data\nline2: info\nline3: data\nline4: info';

  test('extracts lines matching pattern', () => {
    const result = extractLines(text, /data/);
    expect(result).toEqual(['line1: data', 'line3: data']);
  });

  test('extracts lines matching string pattern', () => {
    const result = extractLines(text, 'info');
    expect(result).toEqual(['line2: info', 'line4: info']);
  });

  test('returns empty array if no matches', () => {
    const result = extractLines(text, /notfound/);
    expect(result).toEqual([]);
  });

  test('handles invalid input', () => {
    expect(extractLines(null, /test/)).toEqual([]);
  });
});

describe('Pure Functions - getLineRange', () => {
  const text = 'line1\nline2\nline3\nline4\nline5';

  test('extracts range of lines', () => {
    const result = getLineRange(text, 2, 4);
    expect(result).toBe('line2\nline3\nline4');
  });

  test('extracts from line to end', () => {
    const result = getLineRange(text, 3, -1);
    expect(result).toBe('line3\nline4\nline5');
  });

  test('extracts single line', () => {
    const result = getLineRange(text, 2, 2);
    expect(result).toBe('line2');
  });

  test('handles invalid line numbers', () => {
    expect(getLineRange(text, 0, 2)).toBe('');
    expect(getLineRange(text, 10, 20)).toBe('');
  });

  test('handles invalid input', () => {
    expect(getLineRange(null, 1, 2)).toBe('');
  });
});

describe('Pure Functions - replaceLineRange', () => {
  const text = 'line1\nline2\nline3\nline4\nline5';

  test('replaces range of lines', () => {
    const result = replaceLineRange(text, 2, 4, 'replaced');
    expect(result).toBe('line1\nreplaced\nline5');
  });

  test('replaces with multiple lines', () => {
    const result = replaceLineRange(text, 2, 3, 'new1\nnew2\nnew3');
    expect(result).toBe('line1\nnew1\nnew2\nnew3\nline4\nline5');
  });

  test('handles single line replacement', () => {
    const result = replaceLineRange(text, 3, 3, 'new');
    expect(result).toBe('line1\nline2\nnew\nline4\nline5');
  });

  test('handles invalid line numbers', () => {
    expect(replaceLineRange(text, 0, 2, 'test')).toBe(text);
    expect(replaceLineRange(text, 100, 200, 'test')).toBe(text);
  });

  test('handles invalid input', () => {
    expect(replaceLineRange(null, 1, 2, 'test')).toBe(null);
  });
});

describe('Pure Functions - generateDiff', () => {
  test('detects added lines', () => {
    const oldText = 'line1\nline2';
    const newText = 'line1\nline2\nline3';
    const diff = generateDiff(oldText, newText);

    expect(diff.totalChanges).toBe(1);
    expect(diff.linesAdded).toBe(1);
    expect(diff.linesDeleted).toBe(0);
    expect(diff.linesModified).toBe(0);
  });

  test('detects deleted lines', () => {
    const oldText = 'line1\nline2\nline3';
    const newText = 'line1\nline2';
    const diff = generateDiff(oldText, newText);

    expect(diff.totalChanges).toBe(1);
    expect(diff.linesDeleted).toBe(1);
  });

  test('detects modified lines', () => {
    const oldText = 'line1\nline2\nline3';
    const newText = 'line1\nmodified\nline3';
    const diff = generateDiff(oldText, newText);

    expect(diff.totalChanges).toBe(1);
    expect(diff.linesModified).toBe(1);
  });

  test('detects multiple types of changes', () => {
    const oldText = 'line1\nline2\nline3';
    const newText = 'modified1\nline2\nline3\nline4';
    const diff = generateDiff(oldText, newText);

    expect(diff.totalChanges).toBe(2);
    expect(diff.linesModified).toBe(1);
    expect(diff.linesAdded).toBe(1);
  });

  test('returns no changes for identical texts', () => {
    const text = 'line1\nline2';
    const diff = generateDiff(text, text);

    expect(diff.totalChanges).toBe(0);
  });

  test('includes change details', () => {
    const oldText = 'old';
    const newText = 'new';
    const diff = generateDiff(oldText, newText);

    expect(diff.changes[0]).toMatchObject({
      line: 1,
      type: 'modified',
      oldContent: 'old',
      newContent: 'new',
    });
  });
});

describe('Pure Functions - formatDiff', () => {
  test('formats diff with changes', () => {
    const diff = {
      totalChanges: 3,
      linesAdded: 1,
      linesDeleted: 1,
      linesModified: 1,
      changes: [
        { line: 1, type: 'added', newContent: 'new line' },
        { line: 2, type: 'deleted', oldContent: 'old line' },
        { line: 3, type: 'modified', oldContent: 'old', newContent: 'new' },
      ],
    };

    const formatted = formatDiff(diff);

    expect(formatted).toContain('Total changes: 3');
    expect(formatted).toContain('+1 lines added');
    expect(formatted).toContain('-1 lines deleted');
    expect(formatted).toContain('~1 lines modified');
    expect(formatted).toContain('+ Line 1: new line');
    expect(formatted).toContain('- Line 2: old line');
    expect(formatted).toContain('~ Line 3:');
  });

  test('handles no changes', () => {
    const diff = { totalChanges: 0, changes: [] };
    const formatted = formatDiff(diff);

    expect(formatted).toBe('No changes detected.');
  });

  test('handles null diff', () => {
    const formatted = formatDiff(null);
    expect(formatted).toBe('No changes detected.');
  });
});

/**
 * INTEGRATION TESTS - Real file I/O
 */

describe('EditOperations Integration Tests', () => {
  let tempDir;
  let editOps;
  let testFile;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'editops-test-'));
    editOps = new EditOperations({ verbose: false });
    testFile = path.join(tempDir, 'test.txt');
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('findInFile', () => {
    test('finds matches in file', async () => {
      await fs.writeFile(testFile, 'test line 1\ntest line 2\nother line');

      const matches = await editOps.findInFile(testFile, /test/g);

      expect(matches).toHaveLength(2);
      expect(matches[0].line).toBe(1);
      expect(matches[1].line).toBe(2);
    });

    test('returns empty array when no matches', async () => {
      await fs.writeFile(testFile, 'no matches here');

      const matches = await editOps.findInFile(testFile, /notfound/g);

      expect(matches).toEqual([]);
    });

    test('throws error for non-existent file', async () => {
      const nonExistent = path.join(tempDir, 'nonexistent.txt');
      await expect(editOps.findInFile(nonExistent, /test/)).rejects.toThrow(FileSystemError);
    });
  });

  describe('replaceInFile', () => {
    test('replaces all occurrences', async () => {
      await fs.writeFile(testFile, 'foo bar foo baz');

      const result = await editOps.replaceInFile(testFile, /foo/g, 'replaced');

      expect(result.changed).toBe(true);
      expect(result.diff.totalChanges).toBe(1);

      const content = await fs.readFile(testFile, 'utf8');
      expect(content).toBe('replaced bar replaced baz');
    });

    test('reports no changes when pattern not found', async () => {
      await fs.writeFile(testFile, 'no changes');

      const result = await editOps.replaceInFile(testFile, /notfound/, 'replacement');

      expect(result.changed).toBe(false);
      expect(result.diff.totalChanges).toBe(0);
    });

    test('handles dry-run mode', async () => {
      const dryRunOps = new EditOperations({ dryRun: true });
      await fs.writeFile(testFile, 'foo bar');

      await dryRunOps.replaceInFile(testFile, /foo/, 'baz');

      const content = await fs.readFile(testFile, 'utf8');
      expect(content).toBe('foo bar'); // Unchanged
    });
  });

  describe('insertAtLine', () => {
    test('inserts content at specified line', async () => {
      await fs.writeFile(testFile, 'line1\nline2\nline3');

      await editOps.insertAtLine(testFile, 2, 'inserted');

      const content = await fs.readFile(testFile, 'utf8');
      expect(content).toBe('line1\nline2\ninserted\nline3');
    });

    test('inserts before line', async () => {
      await fs.writeFile(testFile, 'line1\nline2');

      await editOps.insertAtLine(testFile, 2, 'inserted', 'before');

      const content = await fs.readFile(testFile, 'utf8');
      expect(content).toBe('line1\ninserted\nline2');
    });

    test('handles dry-run mode', async () => {
      const dryRunOps = new EditOperations({ dryRun: true });
      await fs.writeFile(testFile, 'line1\nline2');

      await dryRunOps.insertAtLine(testFile, 1, 'test');

      const content = await fs.readFile(testFile, 'utf8');
      expect(content).toBe('line1\nline2'); // Unchanged
    });
  });

  describe('appendToFile', () => {
    test('appends content to file', async () => {
      await fs.writeFile(testFile, 'existing');

      await editOps.appendToFile(testFile, 'appended');

      const content = await fs.readFile(testFile, 'utf8');
      expect(content).toBe('existing\nappended');
    });

    test('handles dry-run mode', async () => {
      const dryRunOps = new EditOperations({ dryRun: true });
      await fs.writeFile(testFile, 'existing');

      await dryRunOps.appendToFile(testFile, 'appended');

      const content = await fs.readFile(testFile, 'utf8');
      expect(content).toBe('existing'); // Unchanged
    });
  });

  describe('prependToFile', () => {
    test('prepends content to file', async () => {
      await fs.writeFile(testFile, 'existing');

      await editOps.prependToFile(testFile, 'prepended');

      const content = await fs.readFile(testFile, 'utf8');
      expect(content).toBe('prepended\nexisting');
    });

    test('handles dry-run mode', async () => {
      const dryRunOps = new EditOperations({ dryRun: true });
      await fs.writeFile(testFile, 'existing');

      await dryRunOps.prependToFile(testFile, 'prepended');

      const content = await fs.readFile(testFile, 'utf8');
      expect(content).toBe('existing'); // Unchanged
    });
  });

  describe('deleteLines', () => {
    test('deletes matching lines', async () => {
      await fs.writeFile(testFile, 'keep\ndelete\nkeep\ndelete');

      const result = await editOps.deleteLines(testFile, /delete/);

      expect(result.deletedLines).toBe(2);

      const content = await fs.readFile(testFile, 'utf8');
      expect(content).toBe('keep\nkeep');
    });

    test('handles no matching lines', async () => {
      await fs.writeFile(testFile, 'line1\nline2');

      const result = await editOps.deleteLines(testFile, /notfound/);

      expect(result.deletedLines).toBe(0);
    });

    test('handles dry-run mode', async () => {
      const dryRunOps = new EditOperations({ dryRun: true });
      await fs.writeFile(testFile, 'keep\ndelete');

      await dryRunOps.deleteLines(testFile, /delete/);

      const content = await fs.readFile(testFile, 'utf8');
      expect(content).toBe('keep\ndelete'); // Unchanged
    });
  });

  describe('replaceLineRange', () => {
    test('replaces range of lines', async () => {
      await fs.writeFile(testFile, 'line1\nline2\nline3\nline4');

      await editOps.replaceLineRange(testFile, 2, 3, 'replaced');

      const content = await fs.readFile(testFile, 'utf8');
      expect(content).toBe('line1\nreplaced\nline4');
    });

    test('handles dry-run mode', async () => {
      const dryRunOps = new EditOperations({ dryRun: true });
      await fs.writeFile(testFile, 'line1\nline2\nline3');

      await dryRunOps.replaceLineRange(testFile, 1, 2, 'test');

      const content = await fs.readFile(testFile, 'utf8');
      expect(content).toBe('line1\nline2\nline3'); // Unchanged
    });
  });

  describe('previewChanges', () => {
    test('previews changes without applying', async () => {
      await fs.writeFile(testFile, 'old content');

      const preview = await editOps.previewChanges(testFile, (content) =>
        content.replace('old', 'new')
      );

      expect(preview.hasChanges).toBe(true);
      expect(preview.diff.totalChanges).toBe(1);
      expect(preview.formatted).toContain('Total changes:');

      // File should remain unchanged
      const content = await fs.readFile(testFile, 'utf8');
      expect(content).toBe('old content');
    });

    test('detects no changes', async () => {
      await fs.writeFile(testFile, 'content');

      const preview = await editOps.previewChanges(testFile, (content) => content);

      expect(preview.hasChanges).toBe(false);
      expect(preview.diff.totalChanges).toBe(0);
    });
  });

  describe('applyTransform', () => {
    test('applies transformation function', async () => {
      await fs.writeFile(testFile, 'lowercase text');

      const result = await editOps.applyTransform(testFile, (content) => content.toUpperCase());

      expect(result.applied).toBe(true);
      expect(result.diff.totalChanges).toBe(1);

      const content = await fs.readFile(testFile, 'utf8');
      expect(content).toBe('LOWERCASE TEXT');
    });

    test('handles no changes from transform', async () => {
      await fs.writeFile(testFile, 'content');

      const result = await editOps.applyTransform(testFile, (content) => content);

      expect(result.applied).toBe(false);
      expect(result.diff.totalChanges).toBe(0);
    });

    test('handles dry-run mode', async () => {
      const dryRunOps = new EditOperations({ dryRun: true });
      await fs.writeFile(testFile, 'test');

      await dryRunOps.applyTransform(testFile, (content) => content.toUpperCase());

      const content = await fs.readFile(testFile, 'utf8');
      expect(content).toBe('test'); // Unchanged
    });
  });
});
