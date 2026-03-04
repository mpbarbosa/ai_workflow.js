// test/scripts/analyze-readability.test.js

import * as readability from '../../scripts/analyze-readability.js';
import { writeFileSync, unlinkSync, mkdirSync, rmdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const tmp = tmpdir();

describe('analyze-readability.js core functions', () => {
  const {
    stripMarkdown,
    countSentences,
    countWords,
    countSyllablesInWord,
    countSyllables,
    fleschReadingEase,
    fleschKincaidGradeLevel,
    freLabel,
    findMarkdownFiles,
    collectFiles,
    analyzeFile,
    fmt,
    pad,
    padL,
  } = readability;

  describe('stripMarkdown', () => {
    it('should remove fenced code blocks', () => {
      expect(stripMarkdown('Before\n```js\ncode()\n```\nAfter')).toBe('Before\nAfter');
    });

    it('should remove inline code', () => {
      expect(stripMarkdown('Text `code` more')).toBe('Text  more');
    });

    it('should remove HTML tags but keep inner text', () => {
      expect(stripMarkdown('<span>html</span>')).toBe('html');
    });

    it('should remove images and links but keep link text', () => {
      expect(stripMarkdown('![alt](img.png) and [link text](url)')).toBe('and link text');
    });

    it('should remove heading markers but keep text', () => {
      expect(stripMarkdown('# Heading')).toBe('Heading');
    });

    it('should remove blockquote markers but keep text', () => {
      expect(stripMarkdown('> Quote')).toBe('Quote');
    });

    it('should remove bold/italic markers but keep text', () => {
      expect(stripMarkdown('**bold** and _italic_')).toContain('bold');
      expect(stripMarkdown('**bold** and _italic_')).toContain('italic');
    });

    it('should collapse multiple newlines and trim', () => {
      expect(stripMarkdown('Text\n\n\nMore\n\n')).toBe('Text\nMore');
    });
  });

  describe('countSentences', () => {
    it('should count sentence-terminating punctuation', () => {
      expect(countSentences('This is one. This is two!')).toBeGreaterThanOrEqual(2);
    });

    it('should treat each non-trivial line as at least one sentence', () => {
      expect(countSentences('Line one\nLine two\nLine three')).toBe(3);
    });

    it('should return at least 1 for empty or short text', () => {
      expect(countSentences('')).toBe(1);
      expect(countSentences('Hi')).toBe(1);
    });
  });

  describe('countWords', () => {
    it('should count words correctly', () => {
      expect(countWords('One two three')).toBe(3);
    });

    it('should return 0 for empty string', () => {
      expect(countWords('')).toBe(0);
    });

    it('should treat hyphenated words as one word', () => {
      expect(countWords('Hyphen-word')).toBe(1);
    });
  });

  describe('countSyllablesInWord', () => {
    it('should return 1 for short words', () => {
      expect(countSyllablesInWord('cat')).toBe(1);
      expect(countSyllablesInWord('a')).toBe(1);
    });

    it('should return multiple syllables for longer words', () => {
      expect(countSyllablesInWord('syllable')).toBeGreaterThanOrEqual(2);
      expect(countSyllablesInWord('reading')).toBeGreaterThanOrEqual(2);
    });

    it('should handle silent e', () => {
      expect(countSyllablesInWord('make')).toBe(1);
    });

    it('should return 0 for empty string', () => {
      expect(countSyllablesInWord('')).toBe(0);
    });
  });

  describe('countSyllables', () => {
    it('should sum syllables across all words', () => {
      expect(countSyllables('cat dog')).toBe(2);
      expect(countSyllables('syllable reading')).toBeGreaterThanOrEqual(4);
    });

    it('should return 0 for empty string', () => {
      expect(countSyllables('')).toBe(0);
    });
  });

  describe('fleschReadingEase', () => {
    it('should calculate FRE for valid input', () => {
      const score = fleschReadingEase(100, 10, 150);
      expect(typeof score).toBe('number');
      expect(score).toBeLessThan(206.835);
    });

    it('should return 0 for zero words or sentences', () => {
      expect(fleschReadingEase(0, 10, 10)).toBe(0);
      expect(fleschReadingEase(10, 0, 10)).toBe(0);
    });
  });

  describe('fleschKincaidGradeLevel', () => {
    it('should calculate FKGL for valid input', () => {
      const score = fleschKincaidGradeLevel(100, 10, 150);
      expect(typeof score).toBe('number');
    });

    it('should return 0 for zero words or sentences', () => {
      expect(fleschKincaidGradeLevel(0, 10, 10)).toBe(0);
      expect(fleschKincaidGradeLevel(10, 0, 10)).toBe(0);
    });
  });

  describe('freLabel', () => {
    it('should return correct label for each score range', () => {
      expect(freLabel(95)).toBe('Very Easy');
      expect(freLabel(85)).toBe('Easy');
      expect(freLabel(75)).toBe('Fairly Easy');
      expect(freLabel(65)).toBe('Standard');
      expect(freLabel(55)).toBe('Fairly Difficult');
      expect(freLabel(35)).toBe('Difficult');
      expect(freLabel(10)).toBe('Very Confusing');
    });
  });

  describe('findMarkdownFiles', () => {
    it('should find .md files recursively', () => {
      const dir = join(tmp, 'readability-md-test');
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, 'a.md'), '');
      writeFileSync(join(dir, 'b.txt'), '');
      const subdir = join(dir, 'sub');
      mkdirSync(subdir, { recursive: true });
      writeFileSync(join(subdir, 'c.md'), '');

      const files = findMarkdownFiles(dir);
      expect(files).toEqual(
        expect.arrayContaining([join(dir, 'a.md'), join(subdir, 'c.md')])
      );
      unlinkSync(join(dir, 'a.md'));
      unlinkSync(join(dir, 'b.txt'));
      unlinkSync(join(subdir, 'c.md'));
      rmdirSync(subdir);
      rmdirSync(dir);
    });

    it('should skip hidden and node_modules directories', () => {
      const dir = join(tmp, 'readability-skip-test');
      mkdirSync(dir, { recursive: true });
      const nm = join(dir, 'node_modules');
      const hidden = join(dir, '.hidden');
      mkdirSync(nm, { recursive: true });
      mkdirSync(hidden, { recursive: true });
      writeFileSync(join(nm, 'skip.md'), '');
      writeFileSync(join(hidden, 'skip.md'), '');
      writeFileSync(join(dir, 'keep.md'), '');

      const files = findMarkdownFiles(dir);
      expect(files).toEqual([join(dir, 'keep.md')]);
      unlinkSync(join(nm, 'skip.md'));
      unlinkSync(join(hidden, 'skip.md'));
      unlinkSync(join(dir, 'keep.md'));
      rmdirSync(nm);
      rmdirSync(hidden);
      rmdirSync(dir);
    });
  });

  describe('collectFiles', () => {
    it('should return an array of file paths', () => {
      const files = collectFiles();
      expect(Array.isArray(files)).toBe(true);
    });
  });

  describe('analyzeFile', () => {
    it('should analyze a markdown file and return readability metrics', () => {
      const fileContent = '# Title\n\nThis is a test document. It has two sentences.';
      const filePath = join(tmp, 'readability-analyze.md');
      writeFileSync(filePath, fileContent);

      const result = analyzeFile(filePath);
      expect(result.words).toBeGreaterThan(0);
      expect(result.sentences).toBeGreaterThan(0);
      expect(result.syllables).toBeGreaterThan(0);
      expect(typeof result.fre).toBe('number');
      expect(typeof result.fkgl).toBe('number');
      unlinkSync(filePath);
    });

    it('should handle an empty file gracefully', () => {
      const filePath = join(tmp, 'readability-empty.md');
      writeFileSync(filePath, '');

      const result = analyzeFile(filePath);
      expect(result.words).toBe(0);
      expect(result.sentences).toBe(1);
      expect(result.syllables).toBe(0);
      expect(result.fre).toBe(0);
      expect(result.fkgl).toBe(0);
      unlinkSync(filePath);
    });
  });

  describe('fmt, pad, padL', () => {
    it('should format numbers to specified decimal places', () => {
      expect(fmt(1.2345, 2)).toBe('1.23');
      expect(fmt(1.2, 1)).toBe('1.2');
    });

    it('should right-pad strings', () => {
      expect(pad('abc', 5)).toBe('abc  ');
    });

    it('should left-pad strings', () => {
      expect(padL('abc', 5)).toBe('  abc');
    });
  });
});
