#!/usr/bin/env node
/**
 * analyze-readability.js
 *
 * Evaluates documentation quality numerically using:
 *   - Flesch Reading Ease (FRE): higher = easier, target 60–70 for technical docs
 *   - Flesch-Kincaid Grade Level (FK-GL): US grade level, target 10–12 for technical docs
 *
 * Formulas (Rudolf Flesch / J. Peter Kincaid):
 *   FRE    = 206.835 − 1.015 × (words/sentences) − 84.6 × (syllables/words)
 *   FK-GL  = 0.39 × (words/sentences) + 11.8 × (syllables/words) − 15.59
 *
 * Reference: https://readable.com/readability/flesch-reading-ease-flesch-kincaid-grade-level/
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// ─── Markdown stripping ────────────────────────────────────────────────────

function stripMarkdown(text) {
  return (
    text
      // Remove fenced code blocks (``` ... ```)
      .replace(/```[\s\S]*?```/g, '')
      // Remove inline code
      .replace(/`[^`]*`/g, '')
      // Remove HTML tags
      .replace(/<[^>]+>/g, '')
      // Remove images
      .replace(/!\[.*?\]\(.*?\)/g, '')
      // Remove links, keep link text
      .replace(/\[([^\]]*)\]\(.*?\)/g, '$1')
      // Remove headings markers
      .replace(/^#{1,6}\s+/gm, '')
      // Remove horizontal rules
      .replace(/^[-*_]{3,}\s*$/gm, '')
      // Remove blockquote markers
      .replace(/^>\s?/gm, '')
      // Remove list markers
      .replace(/^[\s]*[-*+]\s+/gm, '')
      .replace(/^[\s]*\d+\.\s+/gm, '')
      // Remove bold/italic markers
      .replace(/[*_]{1,3}([^*_]+)[*_]{1,3}/g, '$1')
      // Remove table separators
      .replace(/^\|[-| :]+\|$/gm, '')
      // Remove table pipe chars
      .replace(/\|/g, ' ')
      // Collapse multiple whitespace/newlines
      .replace(/\n{2,}/g, '\n')
      .trim()
  );
}

// ─── Text metrics ─────────────────────────────────────────────────────────

function countSentences(text) {
  // Split on sentence-ending punctuation OR line breaks (each line of prose = 1 sentence for tech docs)
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 3);

  // Count sentence-terminating punctuation within lines
  let count = 0;
  for (const line of lines) {
    const terminators = (line.match(/[.!?]+/g) || []).length;
    count += Math.max(1, terminators);
  }
  return Math.max(1, count);
}

function countWords(text) {
  const matches = text.match(/\b[a-zA-Z'-]+\b/g);
  return matches ? matches.length : 0;
}

/**
 * Syllable count approximation (English words).
 * Based on common heuristics for syllable counting.
 */
function countSyllablesInWord(word) {
  word = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!word) return 0;
  if (word.length <= 3) return 1;

  // Remove trailing silent e
  word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '');

  // Count vowel groups as syllables
  const vowelGroups = word.match(/[aeiouy]{1,2}/g);
  return Math.max(1, vowelGroups ? vowelGroups.length : 1);
}

function countSyllables(text) {
  const words = text.match(/\b[a-zA-Z'-]+\b/g) || [];
  return words.reduce((sum, w) => sum + countSyllablesInWord(w), 0);
}

// ─── Flesch formulas ───────────────────────────────────────────────────────

function fleschReadingEase(words, sentences, syllables) {
  if (words === 0 || sentences === 0) return 0;
  return 206.835 - 1.015 * (words / sentences) - 84.6 * (syllables / words);
}

function fleschKincaidGradeLevel(words, sentences, syllables) {
  if (words === 0 || sentences === 0) return 0;
  return 0.39 * (words / sentences) + 11.8 * (syllables / words) - 15.59;
}

function freLabel(score) {
  if (score >= 90) return 'Very Easy';
  if (score >= 80) return 'Easy';
  if (score >= 70) return 'Fairly Easy';
  if (score >= 60) return 'Standard';
  if (score >= 50) return 'Fairly Difficult';
  if (score >= 30) return 'Difficult';
  return 'Very Confusing';
}

// ─── File discovery ────────────────────────────────────────────────────────

function findMarkdownFiles(dir, results = []) {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      // Skip hidden dirs and node_modules
      if (!entry.startsWith('.') && entry !== 'node_modules') {
        findMarkdownFiles(fullPath, results);
      }
    } else if (entry.endsWith('.md')) {
      results.push(fullPath);
    }
  }
  return results;
}

function collectFiles() {
  const files = [];

  // Root-level docs
  for (const name of ['README.md', 'CONTRIBUTING.md', 'CHANGELOG.md', 'SECURITY.md']) {
    const p = join(ROOT, name);
    try {
      statSync(p);
      files.push(p);
    } catch {
      // file doesn't exist, skip
    }
  }

  // All docs/
  const docsDir = join(ROOT, 'docs');
  try {
    findMarkdownFiles(docsDir, files);
  } catch {
    // docs dir missing
  }

  return files;
}

// ─── Analysis ─────────────────────────────────────────────────────────────

function analyzeFile(filePath) {
  const raw = readFileSync(filePath, 'utf8');
  const text = stripMarkdown(raw);

  const words = countWords(text);
  const sentences = countSentences(text);
  const syllables = countSyllables(text);

  const fre = fleschReadingEase(words, sentences, syllables);
  const fkgl = fleschKincaidGradeLevel(words, sentences, syllables);

  return { filePath, words, sentences, syllables, fre, fkgl };
}

// ─── Reporting ─────────────────────────────────────────────────────────────

function fmt(n, dec = 1) {
  return n.toFixed(dec);
}

function pad(str, len) {
  return String(str).padEnd(len);
}

function padL(str, len) {
  return String(str).padStart(len);
}

function main() {
  const files = collectFiles();
  if (files.length === 0) {
    console.log('No Markdown files found.');
    process.exit(1);
  }

  const results = [];
  for (const f of files) {
    try {
      results.push(analyzeFile(f));
    } catch (err) {
      console.error(`  Skipping ${f}: ${err.message}`);
    }
  }

  // Sort by FRE ascending (hardest first)
  results.sort((a, b) => a.fre - b.fre);

  // Weighted overall (weighted by word count)
  const totalWords = results.reduce((s, r) => s + r.words, 0);
  const totalSentences = results.reduce((s, r) => s + r.sentences, 0);
  const totalSyllables = results.reduce((s, r) => s + r.syllables, 0);
  const overallFre = fleschReadingEase(totalWords, totalSentences, totalSyllables);
  const overallFkgl = fleschKincaidGradeLevel(totalWords, totalSentences, totalSyllables);

  const FILE_COL = 52;
  const NUM_COL = 8;

  console.log('\n╔══════════════════════════════════════════════════════════════════════════════════════════════════╗');
  console.log('║              Documentation Readability Analysis — Flesch-Kincaid                               ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════════════════════════════╝');
  console.log(
    '  ' +
      pad('File', FILE_COL) +
      padL('Words', NUM_COL) +
      padL('Sents', NUM_COL) +
      padL('FRE', NUM_COL) +
      padL('FK-GL', NUM_COL) +
      '  Readability'
  );
  console.log('  ' + '─'.repeat(FILE_COL + NUM_COL * 4 + 20));

  for (const r of results) {
    const label = relative(ROOT, r.filePath);
    const displayPath = label.length > FILE_COL - 2 ? '…' + label.slice(-(FILE_COL - 3)) : label;
    console.log(
      '  ' +
        pad(displayPath, FILE_COL) +
        padL(r.words, NUM_COL) +
        padL(r.sentences, NUM_COL) +
        padL(fmt(r.fre), NUM_COL) +
        padL(fmt(r.fkgl), NUM_COL) +
        '  ' +
        freLabel(r.fre)
    );
  }

  console.log('  ' + '─'.repeat(FILE_COL + NUM_COL * 4 + 20));
  console.log(
    '  ' +
      pad(`OVERALL (${results.length} files)`, FILE_COL) +
      padL(totalWords, NUM_COL) +
      padL(totalSentences, NUM_COL) +
      padL(fmt(overallFre), NUM_COL) +
      padL(fmt(overallFkgl), NUM_COL) +
      '  ' +
      freLabel(overallFre)
  );

  console.log('\n  Legend:');
  console.log('  FRE  (Flesch Reading Ease)      90–100 Very Easy | 70–89 Easy/Fairly Easy | 60–69 Standard');
  console.log('                                  50–59 Fairly Difficult | 30–49 Difficult | <30 Very Confusing');
  console.log('  FK-GL (Flesch-Kincaid Grade)    Target ~8 general public | ~10–12 technical docs\n');
}

main();
