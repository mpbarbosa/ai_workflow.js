#!/usr/bin/env node
/**
 * Export Validation Script
 *
 * Validates that all exports in src/index.js match actual exports from source modules.
 * Prevents bugs like ConfigManager→Config mismatch we discovered.
 *
 * Usage: node scripts/validate-exports.js
 * Exit codes: 0 = success, 1 = validation errors found
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// ANSI colors for output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

/**
 * Extract export statements from a file
 * @param {string} filePath - Path to the file
 * @returns {Set<string>} - Set of exported names
 */
function extractExports(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const exports = new Set();

  // Match: export class ClassName
  const classMatches = content.matchAll(/export\s+class\s+(\w+)/g);
  for (const match of classMatches) {
    exports.add(match[1]);
  }

  // Match: export function functionName
  const functionMatches = content.matchAll(/export\s+(?:async\s+)?function\s+(\w+)/g);
  for (const match of functionMatches) {
    exports.add(match[1]);
  }

  // Match: export const/let/var varName
  const varMatches = content.matchAll(/export\s+(?:const|let|var)\s+(\w+)/g);
  for (const match of varMatches) {
    exports.add(match[1]);
  }

  // Match: export { name1, name2 }
  const namedExportMatches = content.matchAll(/export\s+\{([^}]+)\}/g);
  for (const match of namedExportMatches) {
    const names = match[1].split(',').map((n) => n.trim().split(/\s+as\s+/)[0]);
    names.forEach((name) => exports.add(name));
  }

  // Match: export default ClassName (add as 'default')
  if (/export\s+default\s+(\w+)/.test(content)) {
    const match = content.match(/export\s+default\s+(\w+)/);
    exports.add('default');
    exports.add(match[1]); // Also add the class/function name
  }

  return exports;
}

/**
 * Extract re-exports from index.js
 * @param {string} indexPath - Path to index.js
 * @returns {Array} - Array of {exportName, modulePath, lineNumber}
 */
function extractReExports(indexPath) {
  const content = readFileSync(indexPath, 'utf-8');
  const lines = content.split('\n');
  const reExports = [];

  lines.forEach((line, index) => {
    // Match: export { Name } from './path';
    const namedMatch = line.match(/export\s+\{\s*([^}]+)\s*\}\s+from\s+['"]([^'"]+)['"]/);
    if (namedMatch) {
      const names = namedMatch[1].split(',').map((n) => n.trim().split(/\s+as\s+/)[0]);
      const modulePath = namedMatch[2];
      names.forEach((name) => {
        reExports.push({
          exportName: name,
          modulePath,
          lineNumber: index + 1,
        });
      });
    }
  });

  return reExports;
}

/**
 * Validate exports
 */
async function validateExports() {
  console.log(`${colors.cyan}🔍 Export Validation${colors.reset}\n`);

  const indexPath = join(projectRoot, 'src', 'index.js');
  const reExports = extractReExports(indexPath);

  let errors = 0;
  let warnings = 0;

  console.log(`Found ${reExports.length} re-exports to validate\n`);

  for (const reExport of reExports) {
    const { exportName, modulePath, lineNumber } = reExport;

    // Resolve module path (handle relative paths)
    let fullModulePath = modulePath;
    if (modulePath.startsWith('./')) {
      fullModulePath = join(projectRoot, 'src', modulePath.substring(2));
    } else if (modulePath.startsWith('../')) {
      fullModulePath = join(projectRoot, 'src', modulePath);
    }

    // Add .js extension if missing
    if (!fullModulePath.endsWith('.js')) {
      fullModulePath += '.js';
    }

    try {
      const moduleExports = extractExports(fullModulePath);

      if (!moduleExports.has(exportName)) {
        console.log(`${colors.red}❌ ERROR${colors.reset}: Export mismatch at line ${lineNumber}`);
        console.log(`   Export: ${colors.yellow}${exportName}${colors.reset}`);
        console.log(`   Module: ${colors.cyan}${modulePath}${colors.reset}`);
        console.log(`   Available exports: ${Array.from(moduleExports).join(', ') || 'none'}\n`);
        errors++;
      } else {
        // Success - only log in verbose mode
        if (process.argv.includes('--verbose')) {
          console.log(`${colors.green}✓${colors.reset} ${exportName} from ${modulePath}`);
        }
      }
    } catch (error) {
      console.log(
        `${colors.yellow}⚠ WARNING${colors.reset}: Cannot read module at line ${lineNumber}`
      );
      console.log(`   Module: ${colors.cyan}${modulePath}${colors.reset}`);
      console.log(`   Error: ${error.message}\n`);
      warnings++;
    }
  }

  console.log('\n' + '='.repeat(60));

  if (errors > 0) {
    console.log(`${colors.red}✗ ${errors} export error(s) found${colors.reset}`);
    if (warnings > 0) {
      console.log(`${colors.yellow}⚠ ${warnings} warning(s)${colors.reset}`);
    }
    console.log('\nℹ  Fix export names in src/index.js to match actual module exports');
    process.exit(1);
  } else if (warnings > 0) {
    console.log(`${colors.yellow}⚠ ${warnings} warning(s) found${colors.reset}`);
    console.log(`${colors.green}✓ No export errors${colors.reset}`);
    process.exit(0);
  } else {
    console.log(`${colors.green}✓ All exports validated successfully${colors.reset}`);
    process.exit(0);
  }
}

// Run validation
validateExports().catch((error) => {
  console.error(`${colors.red}Fatal error:${colors.reset}`, error);
  process.exit(1);
});
