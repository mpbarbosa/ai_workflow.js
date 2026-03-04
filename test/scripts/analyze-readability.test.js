// scripts/analyze-readability.test.js

import * as readability from './analyze-readability.js';

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
    it('should remove code blocks, inline code, and HTML tags', () => {
      const md = 'Text\n
