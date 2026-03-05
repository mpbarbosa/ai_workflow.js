#!/usr/bin/env node
/**
 * scripts/fix-markdown.js
 *
 * Fixes common markdown lint violations across the project's .md files:
 *   MD007 – tab-indented list items  (converts tabs → 2 spaces, outside code blocks)
 *   MD009 – trailing whitespace      (strips trailing spaces/tabs on every line)
 *   MD026 – trailing punctuation on headings  (removes .,;:! — keeps ? for FAQ headers)
 *   MD047 – missing final newline
 *
 * Skips code-fenced blocks so Makefile tabs, bash comments, etc. are never touched.
 *
 * Usage:
 *   node scripts/fix-markdown.js          # fix in-place
 *   node scripts/fix-markdown.js --dry-run # report only, no writes
 *   node scripts/fix-markdown.js --check   # exit 1 if any file needs changes
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(__dirname, '..');

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const CHECK = args.includes('--check');
const VERBOSE = args.includes('--verbose') || DRY_RUN;

// Directories to exclude entirely
const EXCLUDE_DIRS = new Set([
  'node_modules',
  '.git',
  '.ai_workflow',
  '.workflow_core',
  '.test-e2e',
  'coverage',
  'dist',
  'build',
]);

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Recursively collect .md files under dir, honouring EXCLUDE_DIRS. */
function collectMarkdownFiles(dir) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    if (EXCLUDE_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      results.push(...collectMarkdownFiles(full));
    } else if (entry.endsWith('.md')) {
      results.push(full);
    }
  }
  return results;
}

/**
 * Fix all enabled rules in a single pass, respecting code-fence boundaries.
 * Returns the corrected content (or the original if nothing changed).
 */
export function fixContent(original) {
  const lines = original.split('\n');
  let inCodeBlock = false;
  let changed = false;

  const fixed = lines.map((line) => {
    // Track fenced code blocks (``` or ~~~, optionally with language tag)
    if (/^(`{3,}|~{3,})/.test(line)) {
      inCodeBlock = !inCodeBlock;
      return line; // never touch fence lines themselves
    }

    let out = line;

    if (inCodeBlock) {
      // Inside a code block: only strip trailing spaces (MD009), preserve tabs
      out = out.replace(/[ \t]+$/, '');
    } else {
      // MD009 – trailing whitespace
      out = out.replace(/[ \t]+$/, '');

      // MD007 – tab-indented list items → 2-space indent
      // Match lines starting with one or more tabs (list item indent)
      if (/^\t+[-*+]|^\t+ /.test(out) || /^\t/.test(out)) {
        // Replace leading tabs with 2 spaces each (standard markdown list indent)
        out = out.replace(/^\t+/, (tabs) => '  '.repeat(tabs.length));
      }

      // MD026 – trailing punctuation on ATX headings (# … )
      // Keep '?' (FAQ headers are legitimate); strip . , ; : !
      const headingMatch = out.match(/^(#{1,6}\s+.+?)([.,;:!])(\s*)$/);
      if (headingMatch) {
        out = headingMatch[1] + headingMatch[3];
      }
    }

    if (out !== line) changed = true;
    return out;
  });

  // MD047 – ensure file ends with a single newline
  let result = fixed.join('\n');
  if (!result.endsWith('\n')) {
    result += '\n';
    changed = true;
  }

  return { content: result, changed };
}

// ── Main ─────────────────────────────────────────────────────────────────────

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const files = collectMarkdownFiles(ROOT);
  let totalChanged = 0;
  const changedFiles = [];

  for (const filePath of files) {
    const rel = relative(ROOT, filePath);
    const original = readFileSync(filePath, 'utf8');
    const { content, changed } = fixContent(original);

    if (!changed) continue;

    changedFiles.push(rel);
    totalChanged++;

    if (VERBOSE) {
      console.log(`${CHECK ? '✗' : '✓'} ${rel}`);
    }

    if (!DRY_RUN && !CHECK) {
      writeFileSync(filePath, content, 'utf8');
    }
  }

  if (totalChanged === 0) {
    console.log('✅ All markdown files are clean — no issues found.');
  } else if (DRY_RUN || CHECK) {
    console.log(`\n${totalChanged} file(s) need fixes:\n`);
    changedFiles.forEach((f) => console.log(`  ${f}`));
    if (CHECK) {
      console.error('\n❌ Markdown lint check failed. Run: node scripts/fix-markdown.js');
      process.exit(1);
    }
  } else {
    console.log(`✅ Fixed ${totalChanged} file(s):`);
    changedFiles.forEach((f) => console.log(`  ${f}`));
  }
}
