#!/usr/bin/env node
/**
 * JSDoc Coverage Analyzer
 * 
 * Analyzes JSDoc coverage across all source files and identifies
 * functions, classes, and methods missing documentation.
 * 
 * Usage: node scripts/analyze-jsdoc-coverage.js
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// ANSI colors
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

// Statistics
const stats = {
  totalFiles: 0,
  totalExports: 0,
  documentedExports: 0,
  undocumentedExports: [],
  fileStats: [],
};

/**
 * Check if a line contains a JSDoc comment
 */
function hasJSDoc(lines, index) {
  // Look back up to 10 lines for JSDoc comment
  for (let i = Math.max(0, index - 10); i < index; i++) {
    const line = lines[i].trim();
    if (line.startsWith('/**')) {
      return true;
    }
    // Stop if we hit another export or function
    if (
      line.startsWith('export ') ||
      line.startsWith('function ') ||
      line.startsWith('class ')
    ) {
      break;
    }
  }
  return false;
}

/**
 * Extract exported function/class name from line
 */
function extractExportName(line) {
  // export function funcName
  const funcMatch = line.match(/export\s+(?:async\s+)?function\s+(\w+)/);
  if (funcMatch) return funcMatch[1];

  // export class ClassName
  const classMatch = line.match(/export\s+class\s+(\w+)/);
  if (classMatch) return classMatch[1];

  // export const varName
  const constMatch = line.match(/export\s+const\s+(\w+)/);
  if (constMatch) return constMatch[1];

  return null;
}

/**
 * Analyze a single file for JSDoc coverage
 */
async function analyzeFile(filePath) {
  const content = await fs.readFile(filePath, 'utf-8');
  const lines = content.split('\n');
  const relativePath = path.relative(projectRoot, filePath);

  const fileResult = {
    path: relativePath,
    exports: 0,
    documented: 0,
    undocumented: [],
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Skip comments and empty lines
    if (line.startsWith('//') || line.startsWith('*') || line === '') {
      continue;
    }

    // Check for exports
    if (line.startsWith('export ')) {
      const name = extractExportName(line);
      if (name) {
        fileResult.exports++;
        stats.totalExports++;

        if (hasJSDoc(lines, i)) {
          fileResult.documented++;
          stats.documentedExports++;
        } else {
          fileResult.undocumented.push(name);
          stats.undocumentedExports.push({
            file: relativePath,
            name,
            line: i + 1,
          });
        }
      }
    }
  }

  if (fileResult.exports > 0) {
    stats.fileStats.push(fileResult);
  }

  return fileResult;
}

/**
 * Recursively find all .js files in directory
 */
async function findJSFiles(dir) {
  const files = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      // Skip node_modules, coverage, etc.
      if (
        !entry.name.startsWith('.') &&
        entry.name !== 'node_modules' &&
        entry.name !== 'coverage'
      ) {
        files.push(...(await findJSFiles(fullPath)));
      }
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Main analysis function
 */
async function analyzeJSDocCoverage() {
  console.log(`${colors.cyan}JSDoc Coverage Analysis${colors.reset}\n`);

  const srcDir = path.join(projectRoot, 'src');
  const jsFiles = await findJSFiles(srcDir);

  console.log(`Found ${jsFiles.length} JavaScript files\n`);

  for (const file of jsFiles) {
    await analyzeFile(file);
    stats.totalFiles++;
  }

  // Calculate coverage percentage
  const coverage =
    stats.totalExports > 0
      ? ((stats.documentedExports / stats.totalExports) * 100).toFixed(2)
      : 0;

  // Print summary
  console.log(`${colors.cyan}Summary:${colors.reset}`);
  console.log(`  Total files analyzed: ${stats.totalFiles}`);
  console.log(`  Total exports: ${stats.totalExports}`);
  console.log(
    `  Documented exports: ${stats.documentedExports} ${colors.green}✓${colors.reset}`
  );
  console.log(
    `  Undocumented exports: ${stats.undocumentedExports.length} ${colors.yellow}⚠${colors.reset}`
  );
  console.log(`  Coverage: ${coverage}%\n`);

  // Show files with best/worst coverage
  stats.fileStats.sort((a, b) => {
    const aPct = a.exports > 0 ? a.documented / a.exports : 0;
    const bPct = b.exports > 0 ? b.documented / b.exports : 0;
    return aPct - bPct;
  });

  // Show worst files
  console.log(`${colors.yellow}Files needing documentation:${colors.reset}`);
  const needsWork = stats.fileStats.filter((f) => f.documented / f.exports < 1);
  if (needsWork.length > 0) {
    needsWork.slice(0, 10).forEach((file) => {
      const pct = ((file.documented / file.exports) * 100).toFixed(0);
      console.log(
        `  ${colors.gray}${file.path}${colors.reset} - ${pct}% (${file.documented}/${file.exports})`
      );
      if (file.undocumented.length > 0) {
        file.undocumented.slice(0, 3).forEach((name) => {
          console.log(`    ${colors.yellow}•${colors.reset} ${name}`);
        });
        if (file.undocumented.length > 3) {
          console.log(
            `    ${colors.gray}... and ${file.undocumented.length - 3} more${colors.reset}`
          );
        }
      }
    });
  } else {
    console.log(`  ${colors.green}All files have 100% coverage!${colors.reset}`);
  }

  // Show best files
  console.log(`\n${colors.green}Well-documented files:${colors.reset}`);
  const wellDocumented = stats.fileStats.filter(
    (f) => f.documented / f.exports === 1 && f.exports > 5
  );
  wellDocumented
    .sort((a, b) => b.exports - a.exports)
    .slice(0, 5)
    .forEach((file) => {
      console.log(
        `  ${colors.green}✓${colors.reset} ${colors.gray}${file.path}${colors.reset} - ${file.exports} exports`
      );
    });

  console.log('');

  // Exit code based on coverage
  if (coverage < 90) {
    console.log(
      `${colors.red}⚠ Coverage below 90% threshold${colors.reset}\n`
    );
    process.exit(1);
  } else {
    console.log(`${colors.green}✓ Coverage meets 90% threshold${colors.reset}\n`);
    process.exit(0);
  }
}

// Run analysis
if (process.argv[1] && process.argv[1].endsWith('analyze-jsdoc-coverage.js')) {
  analyzeJSDocCoverage().catch((error) => {
    console.error(`${colors.red}Error:${colors.reset}`, error.message);
    process.exit(1);
  });
}

export { hasJSDoc, extractExportName, analyzeFile, findJSFiles, stats };
