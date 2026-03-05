#!/usr/bin/env node
/**
 * Version Consistency Checker
 *
 * Validates that version numbers are consistent across:
 * - package.json
 * - README.md
 * - CHANGELOG.md
 * - Documentation files
 *
 * Usage:
 *   node scripts/check-version-consistency.js            # check only
 *   node scripts/check-version-consistency.js --auto-fix # check and fix
 * Exit codes: 0 = consistent (or all fixed), 1 = inconsistencies found
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, extname, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// ANSI colors
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

/**
 * Extract version from package.json
 * @returns {string} Semantic version string from package.json
 * @throws {Error} If package.json cannot be read or parsed
 */
export function getPackageVersion() {
  const packagePath = join(projectRoot, 'package.json');
  try {
    const pkg = JSON.parse(readFileSync(packagePath, 'utf-8'));
    return pkg.version;
  } catch (err) {
    throw new Error(`Failed to read package.json at ${packagePath}: ${err.message}`);
  }
}

/**
 * Find all markdown files recursively
 */
export function findMarkdownFiles(dir, fileList = []) {
  const files = readdirSync(dir);

  files.forEach((file) => {
    const filePath = join(dir, file);
    const stat = statSync(filePath);

    if (stat.isDirectory()) {
      // Skip node_modules and hidden directories
      if (!file.startsWith('.') && file !== 'node_modules') {
        findMarkdownFiles(filePath, fileList);
      }
    } else if (extname(file) === '.md') {
      fileList.push(filePath);
    }
  });

  return fileList;
}

/**
 * Extract version references from a markdown file
 */
export function extractVersionReferences(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const versions = new Set();

  // Match patterns like "Version: X.Y.Z" or "v.X.Y.Z"
  const patterns = [
    /Version[:\s]+(\d+\.\d+\.\d+)/gi,
    /version[:\s]+v?(\d+\.\d+\.\d+)/gi,
    /\bv(\d+\.\d+\.\d+)\b/g,
    /@(\d+\.\d+\.\d+)/g,
    /\[(\d+\.\d+\.\d+)\]/g,
  ];

  patterns.forEach((pattern) => {
    const matches = content.matchAll(pattern);
    for (const match of matches) {
      versions.add(match[1]);
    }
  });

  return versions;
}

/**
 * Check for version inconsistencies
 */
export function checkVersionConsistency() {
  console.log(`${colors.cyan}🔍 Version Consistency Check${colors.reset}\n`);

  const packageVersion = getPackageVersion();
  console.log(`Package version: ${colors.green}${packageVersion}${colors.reset}\n`);

  const markdownFiles = findMarkdownFiles(projectRoot);
  const inconsistencies = [];
  const checkedFiles = [];

  // Priority files to check
  const priorityFiles = ['README.md', 'CHANGELOG.md'];

  console.log('Checking version references in documentation...\n');

  markdownFiles.forEach((filePath) => {
    const relativePath = filePath.replace(projectRoot + '/', '');
    const versions = extractVersionReferences(filePath);

    if (versions.size > 0) {
      const isPriority = priorityFiles.some((pf) => relativePath.endsWith(pf));
      const outdatedVersions = Array.from(versions).filter((v) => v !== packageVersion);

      if (outdatedVersions.length > 0) {
        inconsistencies.push({
          file: relativePath,
          versions: outdatedVersions,
          priority: isPriority,
        });
      }

      checkedFiles.push({
        file: relativePath,
        versions: Array.from(versions),
        consistent: outdatedVersions.length === 0,
      });
    }
  });

  // Display results
  console.log(`Checked ${checkedFiles.length} files with version references\n`);

  if (inconsistencies.length === 0) {
    console.log(`${colors.green}✓ All version references are consistent${colors.reset}`);
    console.log(
      `${colors.green}✓ Package version ${packageVersion} matches all documentation${colors.reset}\n`
    );
    return 0;
  }

  // Display inconsistencies
  console.log(`${colors.red}✗ Found version inconsistencies:${colors.reset}\n`);

  // Show priority files first
  const priorityInconsistencies = inconsistencies.filter((i) => i.priority);
  const otherInconsistencies = inconsistencies.filter((i) => !i.priority);

  if (priorityInconsistencies.length > 0) {
    console.log(`${colors.yellow}📋 Priority Files:${colors.reset}\n`);
    priorityInconsistencies.forEach((item) => {
      console.log(`  ${colors.cyan}${item.file}${colors.reset}`);
      console.log(`    Current: ${colors.yellow}${item.versions.join(', ')}${colors.reset}`);
      console.log(`    Expected: ${colors.green}${packageVersion}${colors.reset}\n`);
    });
  }

  if (otherInconsistencies.length > 0) {
    console.log(`${colors.yellow}📄 Other Files:${colors.reset}\n`);
    otherInconsistencies.forEach((item) => {
      console.log(`  ${colors.cyan}${item.file}${colors.reset}`);
      console.log(`    Outdated: ${colors.yellow}${item.versions.join(', ')}${colors.reset}`);
    });
    console.log();
  }

  console.log('='.repeat(60));
  console.log(
    `${colors.red}✗ ${inconsistencies.length} file(s) with outdated version references${colors.reset}`
  );
  console.log(`\nℹ  Update version references to match package.json (${packageVersion})`);

  return 1;
}

/**
 * Auto-fix version inconsistencies by rewriting the outdated version strings
 * in each flagged file to match the package version.
 *
 * @param {Array<{file: string, versions: string[]}>} inconsistencies
 * @param {string} packageVersion - The correct version to write
 * @returns {Array<{file: string, fixed: boolean, error?: string}>}
 */
export function autoFixInconsistencies(inconsistencies, packageVersion) {
  const results = [];

  for (const item of inconsistencies) {
    try {
      let content = readFileSync(item.file, 'utf-8');
      let changed = false;

      for (const staleVersion of item.versions) {
        const escaped = staleVersion.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const updated = content.replace(new RegExp(escaped, 'g'), packageVersion);
        if (updated !== content) {
          content = updated;
          changed = true;
        }
      }

      if (changed) {
        writeFileSync(item.file, content, 'utf-8');
        results.push({ file: item.file, fixed: true });
        console.log(
          `  ${colors.green}✓ Fixed${colors.reset} ${item.file} (${item.versions.join(', ')} → ${packageVersion})`
        );
      } else {
        results.push({ file: item.file, fixed: false, error: 'version string not found in file content' });
        console.log(`  ${colors.yellow}⚠ Skipped${colors.reset} ${item.file} — version string not replaceable`);
      }
    } catch (err) {
      results.push({ file: item.file, fixed: false, error: err.message });
      console.log(`  ${colors.red}✗ Error${colors.reset} ${item.file} — ${err.message}`);
    }
  }

  return results;
}

// Run check (only when executed directly, not when imported as a module)
if (process.argv[1] === __filename) {
try {
  const autoFix = process.argv.includes('--auto-fix') || process.argv.includes('--fix');
  const exitCode = checkVersionConsistency();

  if (exitCode !== 0 && autoFix) {
    console.log(`\n${colors.cyan}🔧 Auto-fix mode — attempting to correct inconsistencies...${colors.reset}\n`);

    // Re-run check to collect the inconsistency list for fixing
    const packageVersion = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf-8')).version;
    const markdownFiles = findMarkdownFiles(projectRoot);
    const toFix = [];
    markdownFiles.forEach((filePath) => {
      const versions = extractVersionReferences(filePath);
      const outdated = Array.from(versions).filter((v) => v !== packageVersion);
      if (outdated.length > 0) {
        toFix.push({ file: filePath, versions: outdated });
      }
    });

    const fixResults = autoFixInconsistencies(toFix, packageVersion);
    const fixed = fixResults.filter((r) => r.fixed).length;
    const failed = fixResults.filter((r) => !r.fixed).length;

    console.log(`\n${colors.cyan}Auto-fix summary:${colors.reset} ${fixed} fixed, ${failed} could not be fixed`);

    if (failed === 0) {
      console.log(`${colors.green}✓ All inconsistencies resolved${colors.reset}`);
      process.exit(0);
    } else {
      console.log(`${colors.red}✗ ${failed} file(s) still need manual attention${colors.reset}`);
      process.exit(1);
    }
  }

  process.exit(exitCode);
} catch (error) {
  console.error(`${colors.red}Fatal error:${colors.reset}`, error);
  process.exit(1);
}
} // end isMain guard
