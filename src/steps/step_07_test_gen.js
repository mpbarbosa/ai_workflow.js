/**
 * Step 7: Test Generation
 * @module steps/step_07_test_gen
 * @version 2.0.0
 *
 * Identifies untested code files and generates test coverage gaps report.
 */

import { STEP_KIND } from './step_contract.js';
import { logger } from '../core/logger.js';
import { FileOperations } from '../lib/file_operations.js';
import { Backlog } from '../lib/backlog.js';
import { TechStackDetector } from '../lib/tech_stack.js';
import { AiHelper } from '../lib/ai_helpers.js';
import { AiCache } from '../lib/ai_cache.js';
import {
  detectAndLogPrimaryLanguage,
  detectPrimaryLanguage,
  initializeStepAiContext,
} from './step_execution_helpers.js';
import {
  AI_HELPERS_PATH,
  AI_PROJECT_KINDS_PATH,
  buildYamlStepPrompt,
  buildProjectKindPrompt,
} from '../lib/ai_prompt_builder.js';
import yaml from 'js-yaml';
import path from 'path';
import ts from 'typescript';
import executor from '../core/executor.js';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Source file patterns by language
 */
export const SOURCE_PATTERNS = {
  javascript: [
    'src/**/*.js',
    'src/**/*.ts',
    'src/**/*.jsx',
    'src/**/*.tsx',
    'src/**/*.vue',
    'lib/**/*.js',
    'lib/**/*.ts',
    'scripts/**/*.js',
  ],
  typescript: ['src/**/*.ts', 'src/**/*.tsx', 'src/**/*.vue', 'lib/**/*.ts'],
  python: ['src/**/*.py', 'lib/**/*.py', '**/*.py'],
  go: ['**/*.go'],
  java: ['src/**/*.java'],
  ruby: ['lib/**/*.rb', 'app/**/*.rb'],
  rust: ['src/**/*.rs'],
  bash: ['**/*.sh'],
  shell: ['**/*.sh'],
};

/**
 * Test file patterns by language (for matching)
 */
export const TEST_FILE_PATTERNS = {
  javascript: [
    '.test.js',
    '.spec.js',
    '.test.ts',
    '.spec.ts',
    '.test.tsx',
    '.spec.tsx',
    '__tests__',
  ],
  typescript: ['.test.ts', '.spec.ts', '.test.tsx', '.spec.tsx', '__tests__'],
  python: ['test_', '_test.py', '/tests/'],
  go: ['_test.go'],
  java: ['Test.java', 'Tests.java', '/test/'],
  ruby: ['_spec.rb', '_test.rb', '/spec/'],
  rust: ['/tests/', '_test.rs'],
  bash: ['.bats', 'test_'],
  shell: ['.bats', 'test_'],
};

/**
 * Files to exclude from gap analysis
 */
export const EXCLUDE_FILES = ['__init__.py', 'index.js', 'main.js', 'config.js', 'constants.js'];
export const EXCLUDE_FILE_PATTERNS = [
  /\.min\.[^.]+$/i,
  /\.bundle\.[^.]+$/i,
  /\.generated\.[^.]+$/i,
];

/**
 * Directories to exclude
 */
export const EXCLUDE_DIRS = [
  'node_modules',
  '.git',
  'coverage',
  'dist',
  'build',
  '__pycache__',
  'target',
  'vendor',
  '.ai_workflow',
];

// ============================================================================
// PURE FUNCTIONS - Test Gap Detection
// ============================================================================

/**
 * Get source file patterns for a language
 * @pure
 * @param {string} language - Programming language
 * @returns {string[]} Array of glob patterns
 */
export function getSourcePatterns(language) {
  const normalized = (language || '').toLowerCase();
  return SOURCE_PATTERNS[normalized] || SOURCE_PATTERNS.javascript;
}

/**
 * Get test file patterns for a language
 * @pure
 * @param {string} language - Programming language
 * @returns {string[]} Array of pattern strings
 */
export function getTestPatterns(language) {
  const normalized = (language || '').toLowerCase();
  return TEST_FILE_PATTERNS[normalized] || TEST_FILE_PATTERNS.javascript;
}

/**
 * Check if file should be excluded from gap analysis
 * @pure
 * @param {string} filePath - File path
 * @returns {boolean} True if file should be excluded
 */
export function shouldExcludeFile(filePath) {
  if (!filePath || typeof filePath !== 'string') return false;
  const normalizedPath = filePath.replace(/\\/g, '/');
  const fileName = path.basename(filePath);
  return (
    EXCLUDE_FILES.includes(fileName) ||
    EXCLUDE_FILE_PATTERNS.some((pattern) => pattern.test(fileName)) ||
    normalizedPath.includes('/vendor/') ||
    normalizedPath.includes('/third_party/')
  );
}

/**
 * Determine if a source file has a corresponding test
 * @pure
 * @param {string} sourceFile - Source file path
 * @param {string[]} testFiles - Array of test file paths
 * @param {string} language - Programming language
 * @returns {boolean} True if test exists
 */
export function hasCorrespondingTest(sourceFile, testFiles, language) {
  const patterns = getTestPatterns(language);
  const baseName = path.basename(sourceFile, path.extname(sourceFile));

  // Check if any test file corresponds to this source file
  return testFiles.some((testFile) => {
    const testBaseName = path.basename(testFile, path.extname(testFile));

    // Check various test naming conventions
    for (const pattern of patterns) {
      if (pattern.startsWith('test_')) {
        // Python: test_module.py
        if (testBaseName === `test_${baseName}`) return true;
      } else if (pattern.endsWith('_test.py') || pattern.endsWith('_test.go')) {
        // Python/Go: module_test.py
        if (testBaseName === `${baseName}_test`) return true;
      } else if (pattern.includes('.test.') || pattern.includes('.spec.')) {
        // JS/TS: module.test.js
        if (testBaseName === `${baseName}.test` || testBaseName === `${baseName}.spec`) {
          return true;
        }
      } else if (pattern.includes('Test.java')) {
        // Java: ModuleTest.java
        if (testBaseName === `${baseName}Test` || testBaseName === `${baseName}Tests`) {
          return true;
        }
      } else if (pattern.includes('_spec.rb')) {
        // Ruby: module_spec.rb
        if (testBaseName === `${baseName}_spec`) return true;
      } else if (pattern.includes('__tests__')) {
        // JS: __tests__/module.test.js
        if (testFile.includes('__tests__') && testBaseName.includes(baseName)) {
          return true;
        }
      }
    }

    return false;
  });
}

/**
 * Find untested source files
 * @pure
 * @param {Object} params - Parameters
 * @param {string[]} params.sourceFiles - Source files
 * @param {string[]} params.testFiles - Test files
 * @param {string} params.language - Programming language
 * @returns {string[]} Untested files
 */
export function findUntestedFiles({ sourceFiles, testFiles, language, includeExcluded = false }) {
  return sourceFiles.filter((sourceFile) => {
    // Skip excluded files
    if (!includeExcluded && shouldExcludeFile(sourceFile)) return false;

    // Skip source files whose own name marks them as test/spec files (e.g. src/**/*.test.tsx).
    // These exist when a project colocates tests inside src/; treating them as "untested source"
    // causes step_07 to generate *.test.test.tsx double-extension files that break step_08.
    if (/\.(test|spec)\.[jt]sx?$/.test(path.basename(sourceFile))) return false;

    // Skip test files
    const isTestFile = testFiles.includes(sourceFile);
    if (isTestFile) return false;

    // Check if has corresponding test
    return !hasCorrespondingTest(sourceFile, testFiles, language);
  });
}

/**
 * Calculate coverage percentage
 * @pure
 * @param {number} testedCount - Number of tested files
 * @param {number} totalCount - Total number of source files
 * @returns {number} Coverage percentage
 */
export function calculateCoverage(testedCount, totalCount) {
  if (totalCount === 0) return 0;
  return Math.round((testedCount / totalCount) * 100);
}

/**
 * Check whether a file path can contain type-only TypeScript source.
 * @pure
 * @param {string} sourceFile - Source file path
 * @returns {boolean} True when the file can be declaration-only TypeScript
 */
export function canBeTypeOnlySourceFile(sourceFile) {
  if (typeof sourceFile !== 'string') return false;
  return /\.(?:d\.ts|ts|tsx|cts|mts)$/i.test(sourceFile.replace(/\\/g, '/'));
}

function hasModifier(node, modifierKind) {
  return Array.isArray(node.modifiers)
    ? node.modifiers.some((modifier) => modifier.kind === modifierKind)
    : false;
}

function isTypeOnlyStatement(statement) {
  if (
    ts.isInterfaceDeclaration(statement) ||
    ts.isTypeAliasDeclaration(statement) ||
    ts.isImportEqualsDeclaration(statement)
  ) {
    return true;
  }

  if (ts.isImportDeclaration(statement)) {
    return statement.importClause?.isTypeOnly === true;
  }

  if (ts.isExportDeclaration(statement)) {
    if (statement.isTypeOnly) return true;
    if (
      !statement.moduleSpecifier &&
      statement.exportClause &&
      ts.isNamedExports(statement.exportClause) &&
      statement.exportClause.elements.length === 0
    ) {
      return true;
    }
    return false;
  }

  if (ts.isModuleDeclaration(statement)) {
    return hasModifier(statement, ts.SyntaxKind.DeclareKeyword);
  }

  if (
    ts.isVariableStatement(statement) ||
    ts.isFunctionDeclaration(statement) ||
    ts.isClassDeclaration(statement)
  ) {
    return hasModifier(statement, ts.SyntaxKind.DeclareKeyword);
  }

  if (ts.isEnumDeclaration(statement)) {
    return hasModifier(statement, ts.SyntaxKind.DeclareKeyword);
  }

  return false;
}

/**
 * Determine whether a TypeScript source file is declaration-only and has no runtime exports.
 * @pure
 * @param {string} sourceFile - Source file path
 * @param {string} content - Source content
 * @returns {boolean} True when the file is declaration-only
 */
export function isTypeOnlySourceFile(sourceFile, content) {
  if (!canBeTypeOnlySourceFile(sourceFile)) return false;
  if (typeof content !== 'string' || content.trim().length === 0) return false;
  if (sourceFile.replace(/\\/g, '/').toLowerCase().endsWith('.d.ts')) return true;

  const scriptKind = sourceFile.toLowerCase().endsWith('.tsx')
    ? ts.ScriptKind.TSX
    : ts.ScriptKind.TS;
  const parsed = ts.createSourceFile(sourceFile, content, ts.ScriptTarget.Latest, true, scriptKind);

  if (!Array.isArray(parsed.statements) || parsed.statements.length === 0) return false;
  return parsed.statements.every((statement) => isTypeOnlyStatement(statement));
}

function normalizeRelativeModulePath(filePath) {
  const normalized = filePath.replace(/\\/g, '/');
  return normalized.startsWith('.') ? normalized : `./${normalized}`;
}

/**
 * Build acceptable import specifiers from a generated test file back to the target source file.
 * @pure
 * @param {string} sourceFile - Relative source file path
 * @param {string} testOutputPath - Relative generated test file path
 * @returns {Set<string>} Acceptable module specifiers
 */
export function buildTargetModuleSpecifiers(sourceFile, testOutputPath) {
  const relativeSourcePath = normalizeRelativeModulePath(
    path.relative(path.dirname(testOutputPath), sourceFile)
  );
  const ext = path.extname(relativeSourcePath);
  const withoutExt = ext ? relativeSourcePath.slice(0, -ext.length) : relativeSourcePath;
  const specifiers = new Set([relativeSourcePath, withoutExt]);

  if (ext === '.ts' || ext === '.tsx' || ext === '.mts' || ext === '.cts') {
    specifiers.add(`${withoutExt}.js`);
  }

  if (ext === '.tsx') {
    specifiers.add(`${withoutExt}.jsx`);
  }

  return specifiers;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Check whether generated test code imports and uses a runtime export from the target module.
 * @pure
 * @param {Object} params - Parameters
 * @param {string} params.testCode - Generated test code
 * @param {string} params.sourceFile - Relative source file path
 * @param {string} params.testOutputPath - Relative test file path
 * @returns {boolean} True when the generated test exercises a runtime export
 */
export function usesRuntimeTargetModule({ testCode, sourceFile, testOutputPath }) {
  if (typeof testCode !== 'string' || testCode.trim().length === 0) return false;

  const specifiers = buildTargetModuleSpecifiers(sourceFile, testOutputPath);
  const isTypeScriptTest = /\.(?:ts|tsx|mts|cts)$/.test(testOutputPath.toLowerCase());
  const parsed = ts.createSourceFile(
    testOutputPath,
    testCode,
    ts.ScriptTarget.Latest,
    true,
    isTypeScriptTest ? ts.ScriptKind.TS : ts.ScriptKind.JS
  );

  const targetImportRanges = [];
  const runtimeBindings = [];

  for (const statement of parsed.statements) {
    if (!ts.isImportDeclaration(statement)) continue;
    const specifier =
      statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier)
        ? statement.moduleSpecifier.text
        : '';
    if (!specifiers.has(specifier)) continue;

    targetImportRanges.push([statement.getFullStart(), statement.getEnd()]);
    const importClause = statement.importClause;
    if (!importClause || importClause.isTypeOnly) continue;

    if (importClause.name) {
      runtimeBindings.push(importClause.name.text);
    }

    if (importClause.namedBindings) {
      if (ts.isNamespaceImport(importClause.namedBindings)) {
        runtimeBindings.push(importClause.namedBindings.name.text);
      } else if (ts.isNamedImports(importClause.namedBindings)) {
        for (const element of importClause.namedBindings.elements) {
          if (!element.isTypeOnly) {
            runtimeBindings.push(element.name.text);
          }
        }
      }
    }
  }

  if (runtimeBindings.length === 0) return false;

  let body = '';
  let cursor = 0;
  for (const [start, end] of targetImportRanges.sort((a, b) => a[0] - b[0])) {
    body += testCode.slice(cursor, start);
    cursor = end;
  }
  body += testCode.slice(cursor);

  return runtimeBindings.some((binding) => new RegExp(`\\b${escapeRegExp(binding)}\\b`).test(body));
}

const VUE_SFC_TEST_RE = /<script\b|<template\b/i;
const VITEST_USAGE_RE =
  /\b(?:vi\.(?:mock|fn|spyOn|importActual|importMock|stubGlobal|resetModules)|from\s+['"]vitest['"])\b/i;
const FORBIDDEN_TS_EXPECT_ERROR_RE = /@ts-expect-error\b/;
const PLACEHOLDER_MOCK_COMMENT_RE =
  /\bif present in (?:the )?real\b|\bnot in the real interface\b|\blimitation of testing composables outside a component instance\b/i;

/**
 * Detect deterministic problems in generated test code that should be rejected
 * before writing the file to disk.
 *
 * @pure
 * @param {Object} params - Validation parameters
 * @param {string} params.testCode - Generated test code
 * @param {string} params.testOutputPath - Relative test file path
 * @param {string} [params.testFramework] - Prompt framework label
 * @returns {string[]} Human-readable rejection reasons
 */
export function findGeneratedTestProblems({ testCode, testOutputPath, testFramework = '' }) {
  const problems = [];
  const code = typeof testCode === 'string' ? testCode : String(testCode ?? '');

  if (code.trim() === '') {
    return ['generated test code is empty'];
  }

  if (FORBIDDEN_TS_EXPECT_ERROR_RE.test(code)) {
    problems.push(
      'generated test uses `@ts-expect-error` despite the prompt forbidding type-error suppressions'
    );
  }

  if (PLACEHOLDER_MOCK_COMMENT_RE.test(code)) {
    problems.push(
      'generated test contains placeholder comments instead of an implemented mocking/lifecycle strategy'
    );
  }

  if (VUE_SFC_TEST_RE.test(code)) {
    problems.push(
      `generated test is formatted as a Vue SFC instead of a plain module for \`${testOutputPath}\``
    );
  }

  if (/\bjest\b/i.test(testFramework) && VITEST_USAGE_RE.test(code)) {
    problems.push('generated test uses Vitest APIs even though the project requires Jest idioms');
  }

  if (/globalThis\[['"]import['"]\]/.test(code)) {
    problems.push("generated test uses `globalThis['import']`, which step_07 explicitly forbids");
  }

  return problems;
}

/**
 * Categorize untested files by directory
 * @pure
 * @param {string[]} untestedFiles - Array of untested file paths
 * @returns {Object} Categorized files
 */
export function categorizeUntestedFiles(untestedFiles) {
  const categories = {};

  untestedFiles.forEach((file) => {
    const dir = path.dirname(file);
    const category = dir === '.' ? 'root' : dir.split('/')[0];

    if (!categories[category]) {
      categories[category] = [];
    }
    categories[category].push(file);
  });

  return categories;
}

// ============================================================================
// PURE FUNCTIONS - Reporting
// ============================================================================

/**
 * Format test generation report
 * @pure
 * @param {Object} results - Generation results
 * @returns {string} Formatted report
 */
export function formatTestGenerationReport(results) {
  const {
    totalSourceFiles = 0,
    totalActionableSourceFiles = 0,
    totalTestFiles = 0,
    untestedFiles = [],
    categories = {},
    rawUntestedFiles = [],
    excludedUntestedFiles = [],
    typeOnlySourceFiles = [],
  } = results;
  const testedSourceFiles = Math.max(0, totalActionableSourceFiles - untestedFiles.length);

  let report = '# Test Generation Report\n\n';

  // Summary
  report += '## Summary\n\n';
  report += `- **Total Source Files**: ${totalSourceFiles}\n`;
  report += `- **Actionable Runtime Source Files**: ${totalActionableSourceFiles}\n`;
  report += `- **Total Test Files**: ${totalTestFiles}\n`;
  report += `- **Matched Actionable Source Files**: ${testedSourceFiles}/${totalActionableSourceFiles}\n`;
  report += `- **Untested Files**: ${untestedFiles.length}\n`;
  if (rawUntestedFiles.length > untestedFiles.length) {
    report += `- **Excluded From Actionable Gaps**: ${excludedUntestedFiles.length}\n`;
  }
  if (typeOnlySourceFiles.length > 0) {
    report += `- **Type-Only Source Files Excluded**: ${typeOnlySourceFiles.length}\n`;
  }
  report += '- **Inventory Type**: File matching only (not measured runtime coverage)\n\n';

  // Inventory status
  if (totalActionableSourceFiles === 0 && totalSourceFiles > 0) {
    report += '## ℹ️ No Actionable Runtime Sources\n\n';
    report +=
      'Discovered source files were all excluded from actionable test generation because they are vendored/generated assets or declaration-only TypeScript modules.\n\n';
  } else if (totalActionableSourceFiles > 0 && untestedFiles.length === 0) {
    report += '## ✅ Test File Inventory Complete\n\n';
    report +=
      'Every actionable runtime source file has at least one corresponding test file by naming convention. This inventory does not prove line, branch, or runtime coverage.\n\n';
  } else if (totalActionableSourceFiles > 0) {
    report += '## ⚠️ Test File Inventory Gaps\n\n';
    report += `${untestedFiles.length} of ${totalActionableSourceFiles} actionable runtime source file(s) do not have a corresponding test file by naming convention.\n\n`;
    if (excludedUntestedFiles.length > 0) {
      report += `${excludedUntestedFiles.length} additional unmatched file(s) were excluded from action because they appear to be minified, generated, vendored, or third-party assets.\n\n`;
    }
    if (typeOnlySourceFiles.length > 0) {
      report += `${typeOnlySourceFiles.length} declaration-only TypeScript file(s) were excluded from actionable gaps because they do not expose runtime behavior to test directly.\n\n`;
    }
  }

  // Untested files by category
  if (untestedFiles.length > 0) {
    report += '## Untested Files\n\n';

    const categoryEntries = Object.entries(categories);
    if (categoryEntries.length > 0) {
      categoryEntries.forEach(([category, files]) => {
        report += `### ${category}\n\n`;
        files.slice(0, 10).forEach((file) => {
          report += `- ${file}\n`;
        });
        if (files.length > 10) {
          report += `\n... and ${files.length - 10} more\n`;
        }
        report += '\n';
      });
    } else {
      untestedFiles.slice(0, 20).forEach((file) => {
        report += `- ${file}\n`;
      });
      if (untestedFiles.length > 20) {
        report += `\n... and ${untestedFiles.length - 20} more\n\n`;
      }
    }
  }

  // Recommendations
  if (untestedFiles.length > 0) {
    report += '## 💡 Recommendations\n\n';
    report += '1. Prioritize testing critical business logic files\n';
    report += '2. Start with files that have the most dependencies\n';
    report += '3. Consider using test generation tools or AI assistance\n';
    report += '4. Confirm measured coverage with the real test runner coverage report\n\n';
  }

  return report;
}

// ============================================================================
// CONSTANTS - AI test generation
// ============================================================================

/** Maximum number of untested files to generate tests for in one run. */
export const MAX_FILES_TO_GENERATE = 5;

/** Maximum source file size (chars) to include in prompt. Larger files are skipped. */
export const MAX_SOURCE_FILE_CHARS = 20_000;

// ============================================================================
// PURE FUNCTIONS - AI test generation helpers
// ============================================================================

/**
 * Build a structured summary of test files grouped by top-level directory.
 * Provides the AI with the full portfolio picture without flooding the prompt
 * with hundreds of raw filenames.
 * @pure
 * @param {string[]} testFiles - Array of test file paths
 * @returns {string} Formatted summary string
 */
export function buildTestFilesSummary(testFiles) {
  if (!testFiles || testFiles.length === 0) return 'none';

  const groups = {};
  for (const f of testFiles) {
    const normalized = f.replace(/\\/g, '/');
    const topDir = normalized.includes('/') ? normalized.split('/')[0] : '(root)';
    if (!groups[topDir]) groups[topDir] = [];
    groups[topDir].push(path.basename(normalized));
  }

  const dirCount = Object.keys(groups).length;
  const lines = [
    `${testFiles.length} test files across ${dirCount} director${dirCount === 1 ? 'y' : 'ies'}:`,
  ];
  for (const [dir, files] of Object.entries(groups)) {
    const sample = files.slice(0, 3).join(', ');
    const more = files.length > 3 ? `, ... (+${files.length - 3} more)` : '';
    lines.push(`  ${dir}/ (${files.length}): ${sample}${more}`);
  }
  return lines.join('\n');
}

const PREFERRED_TEST_ROOTS = ['__tests__', 'test', 'tests'];
const TEST_MODULE_EXTENSIONS = Object.freeze({
  javascript: '.js',
  typescript: '.ts',
});

function normalizeTestRoot(testRoot) {
  return typeof testRoot === 'string' && testRoot.trim() ? testRoot.trim() : 'test';
}

function buildTestDir(dir, testRoot) {
  const normalizedRoot = normalizeTestRoot(testRoot);
  return dir.startsWith('src')
    ? dir.replace(/^src(?=\/|$)/, normalizedRoot)
    : path.join(normalizedRoot, dir);
}

function extractQuotedValues(listContent) {
  return [...listContent.matchAll(/['"]([^'"]+)['"]/g)].map((match) => match[1]);
}

function extractJestConfigPathFromScripts(scripts = {}) {
  const preferredScriptNames = [
    'test:unit',
    'test',
    'test:all',
    'test:integration',
    'test:changed',
  ];
  const orderedNames = [
    ...preferredScriptNames,
    ...Object.keys(scripts).filter((name) => !preferredScriptNames.includes(name)),
  ];

  for (const scriptName of orderedNames) {
    const script = scripts[scriptName];
    if (typeof script !== 'string' || !/\bjest\b/i.test(script)) {
      continue;
    }

    const configMatch = script.match(/--config(?:=|\s+)(?:"([^"]+)"|'([^']+)'|([^\s]+))/);
    const configPath = configMatch?.[1] ?? configMatch?.[2] ?? configMatch?.[3] ?? null;
    if (configPath) {
      return configPath;
    }
  }

  return null;
}

function buildJestConfigCandidates(pkg = {}) {
  const scriptConfig = extractJestConfigPathFromScripts(pkg.scripts ?? {});
  const defaults = [
    'jest.config.js',
    'jest.config.ts',
    'jest.config.cjs',
    'jest.config.mjs',
    'jest.config.json',
    'jest.config.unit.js',
    'jest.config.unit.ts',
    'jest.config.unit.cjs',
    'jest.config.unit.mjs',
    'jest.config.unit.json',
  ];

  return [...new Set([scriptConfig, ...defaults].filter(Boolean))];
}

function inferPreferredTestRoot(testFiles, sourceFile = '') {
  if (!Array.isArray(testFiles) || testFiles.length === 0) {
    return 'test';
  }

  const normalizedSource = sourceFile.replace(/\\/g, '/');
  const sourceIsVue = normalizedSource.endsWith('.vue');
  const scores = new Map(PREFERRED_TEST_ROOTS.map((root) => [root, 0]));

  for (const file of testFiles) {
    const normalizedFile = file.replace(/\\/g, '/');
    const root = normalizedFile.split('/')[0];
    if (!scores.has(root)) continue;

    let score = 1;
    if (sourceIsVue && /\.vue\.test\.[jt]sx?$/i.test(normalizedFile)) {
      score += 5;
    }
    if (normalizedSource.startsWith('src/components/') && normalizedFile.includes('/components/')) {
      score += 2;
    }
    if (normalizedSource.startsWith('src/views/') && normalizedFile.includes('/views/')) {
      score += 2;
    }

    scores.set(root, scores.get(root) + score);
  }

  return [...scores.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'test';
}

/**
 * Compute the output path for a generated test file.
 * @pure
 * @param {string} sourceFile - Relative source file path
 * @param {string} language - Programming language
 * @param {{ preferredTestRoot?: string }} [options] - Project-specific test path hints
 * @returns {string} Relative test file path
 */
export function getTestOutputPath(sourceFile, language, options = {}) {
  const ext = path.extname(sourceFile);
  const base = path.basename(sourceFile, ext);
  const dir = path.dirname(sourceFile);
  const testRoot = options?.preferredTestRoot ?? 'test';

  // Replace leading src/ with the preferred test root, otherwise prepend the test root.
  const testDir = buildTestDir(dir, testRoot);

  const lang = language.toLowerCase();
  if ((lang === 'javascript' || lang === 'typescript') && ext === '.vue') {
    const moduleExt = TEST_MODULE_EXTENSIONS[lang] ?? '.js';
    return path.join(testDir, `${base}.vue.test${moduleExt}`);
  }
  if (lang === 'python') {
    return path.join(testDir, `test_${base}${ext}`);
  }
  if (lang === 'go') {
    return path.join(testDir, `${base}_test${ext}`);
  }
  if (lang === 'java') {
    return path.join(testDir, `${base}Test${ext}`);
  }
  if (lang === 'ruby') {
    return path.join(testDir, `${base}_spec${ext}`);
  }
  // JavaScript / TypeScript and defaults
  return path.join(testDir, `${base}.test${ext}`);
}

/** Map from detected language to test framework label used in the prompt. */
const TEST_FRAMEWORK_BY_LANGUAGE = {
  javascript: 'Jest',
  typescript: 'Jest',
  python: 'pytest',
  go: 'testing (Go stdlib)',
  java: 'JUnit 5',
  ruby: 'RSpec',
  rust: 'cargo test',
};

/**
 * Build an AI prompt for generating tests for a single file.
 * Uses the `single_file_test_prompt` YAML template when parsedYaml is provided,
 * falling back to an inline template if YAML is unavailable.
 * @pure
 * @param {string} sourceFile - Relative path of the source file
 * @param {string} content - Source file content (may be truncated)
 * @param {string} language - Detected programming language
 * @param {Object|null} [parsedYaml] - Pre-loaded ai_helpers.yaml object (optional)
 * @returns {string} Prompt string
 */
export function buildSingleFileTestPrompt(
  sourceFile,
  content,
  language,
  parsedYaml = null,
  targetTestPath = null,
  projectContext = {}
) {
  const truncated =
    content.length > MAX_SOURCE_FILE_CHARS
      ? content.substring(0, MAX_SOURCE_FILE_CHARS) + '\n...(truncated)'
      : content;
  const sourceExt = path.extname(sourceFile).replace('.', '') || language;
  // Prefer the framework detected from the project's package.json; fall back to the static map.
  const testFramework =
    projectContext.detectedTestFramework ?? TEST_FRAMEWORK_BY_LANGUAGE[language] ?? language;
  const resolvedTargetPath =
    targetTestPath ?? getTestOutputPath(sourceFile, language, projectContext);
  const outputExt = path.extname(resolvedTargetPath).replace('.', '') || sourceExt;
  const frameworkName = String(testFramework).toLowerCase();
  const mockApiGuidance =
    projectContext.mockApiGuidance ??
    (frameworkName === 'jest'
      ? '`jest.mock()` with a factory function'
      : frameworkName === 'vitest'
        ? '`vi.mock()` with a factory function'
        : `the mock API provided by ${testFramework}`);

  const jestConstraints =
    projectContext.jestConstraints ?? `- Use standard ${testFramework} idioms for this project`;
  const typescriptConstraints =
    projectContext.typescriptConstraints ?? '- Ensure all types are explicit; avoid implicit `any`';
  const testImportExamples =
    projectContext.testImportExamples ??
    '(no examples available — infer from the source file location)';

  if (parsedYaml) {
    const prompt = buildYamlStepPrompt(parsedYaml, 'single_file_test_prompt', {
      source_file: sourceFile,
      target_test_path: resolvedTargetPath,
      language,
      test_framework: testFramework,
      source_ext: sourceExt,
      output_ext: outputExt,
      source_content: truncated,
      jest_constraints: jestConstraints,
      typescript_constraints: typescriptConstraints,
      test_import_examples: testImportExamples,
      mock_api_guidance: mockApiGuidance,
    });
    if (prompt) return prompt;
  }

  // Inline fallback (used when YAML is unavailable)
  return `You are a senior test engineer. Generate a complete, runnable test file for the source file below.

**Source file**: \`${sourceFile}\`
**Target test file**: \`${resolvedTargetPath}\`
**Language**: ${language}
**Framework**: ${testFramework}

**Project test runner constraints** (MUST satisfy):
${jestConstraints}

**TypeScript constraints** (MUST satisfy):
${typescriptConstraints}

**Requirements**:
- Output ONLY the test file content inside a single fenced code block (\`\`\`${outputExt} ... \`\`\`)
- Cover: happy paths, edge cases, and error scenarios
- Use ${testFramework} idioms and conventions
- Use descriptive test names
- Do NOT include explanations outside the code block
- Compute the import path for \`${sourceFile}\` relative to \`${resolvedTargetPath}\`
- All imports MUST resolve to real files — do not invent module paths
- Never use \`globalThis['import']\` for mocking; use ${mockApiGuidance}

**Example import style from existing tests**:
${testImportExamples}

\`\`\`${sourceExt}
${truncated}
\`\`\`

Now generate the test file for \`${resolvedTargetPath}\`:`;
}

/**
 * Extract the first fenced code block from an AI response.
 * @pure
 * @param {string} aiResponse - Raw AI response text
 * @returns {string|null} Extracted code or null if not found
 */
export function extractTestCode(aiResponse) {
  const match = aiResponse.match(/```(?:\w+)?\n([\s\S]*?)```/);
  return match ? match[1].trim() : null;
}

// ============================================================================
// STEP 7 ANALYZER - Integration
// ============================================================================

/**
 * Step 7 analyzer for test generation
 */
export class Step7TestGenerator {
  static stepKind = STEP_KIND.PROJECT;

  constructor(options = {}) {
    this.fileOps = options.fileOps || new FileOperations();
    this.backlog = options.backlog || new Backlog();
    this.techStack = options.techStack || new TechStackDetector();
    this.aiHelper = options.aiHelper || new AiHelper({ promptsDir: options.promptsDir || null });
    this.aiCache = options.aiCache || new AiCache();
  }

  /**
   * Execute Step 7 test generation
   * @param {string} projectRoot - Project root directory
   * @param {Object} options - Execution options (reserved)
   * @returns {Promise<Object>} Generation result
   */
  async execute(projectRoot, options = {}) {
    try {
      logger.step('Step 7: Test Generation');

      // Phase 1: Detect primary language
      const language = await detectAndLogPrimaryLanguage(this.techStack, projectRoot);

      // Phase 2: Discover source and test files
      let sourceFiles = await this.discoverSourceFiles(projectRoot, language);
      let testFiles = await this.discoverTestFiles(projectRoot, language);

      // Fallback: if no source/test files found for detected language, try bash
      if (sourceFiles.length === 0 && language !== 'bash') {
        const bashSources = await this.discoverSourceFiles(projectRoot, 'bash');
        if (bashSources.length > 0) {
          logger.info(`Fallback: found ${bashSources.length} bash source file(s) instead`);
          sourceFiles = bashSources;
          testFiles = await this.discoverTestFiles(projectRoot, 'bash');
        }
      }

      logger.info(`Found ${sourceFiles.length} source file(s), ${testFiles.length} test file(s)`);

      if (sourceFiles.length === 0) {
        logger.warn('No source files found!');
        const report = formatTestGenerationReport({
          totalSourceFiles: 0,
          totalActionableSourceFiles: 0,
          totalTestFiles: testFiles.length,
          untestedFiles: [],
          coveragePercentage: 0,
        });
        await this.backlog.saveStepSummary(7, 'Test Generation', report);

        return {
          success: true,
          totalSourceFiles: 0,
          totalActionableSourceFiles: 0,
          totalTestFiles: testFiles.length,
          untestedFiles: [],
          coveragePercentage: 0,
          generatedFiles: [],
        };
      }

      // Phase 3: Identify untested files
      const excludedSourceFiles = sourceFiles.filter((sourceFile) => shouldExcludeFile(sourceFile));
      const candidateRuntimeSourceFiles = sourceFiles.filter(
        (sourceFile) => !shouldExcludeFile(sourceFile)
      );
      const typeOnlySourceFiles = await this._findTypeOnlySourceFiles(
        projectRoot,
        candidateRuntimeSourceFiles
      );
      const typeOnlySourceSet = new Set(typeOnlySourceFiles);
      const actionableSourceFiles = candidateRuntimeSourceFiles.filter(
        (sourceFile) => !typeOnlySourceSet.has(sourceFile)
      );
      const untestedFiles = findUntestedFiles({
        sourceFiles: actionableSourceFiles,
        testFiles,
        language,
        includeExcluded: true,
      });
      const excludedUntestedFiles = excludedSourceFiles.filter(
        (sourceFile) => !hasCorrespondingTest(sourceFile, testFiles, language)
      );
      const typeOnlyUntestedFiles = typeOnlySourceFiles.filter(
        (sourceFile) => !hasCorrespondingTest(sourceFile, testFiles, language)
      );
      const rawUntestedFiles = [
        ...untestedFiles,
        ...excludedUntestedFiles,
        ...typeOnlyUntestedFiles,
      ];

      logger.info(`Identified ${untestedFiles.length} actionable untested file(s)`);
      if (excludedUntestedFiles.length > 0) {
        logger.info(
          `Excluded ${excludedUntestedFiles.length} unmatched file(s) from test-gap action because they appear minified, generated, vendored, or third-party`
        );
      }
      if (typeOnlySourceFiles.length > 0) {
        logger.info(
          `Excluded ${typeOnlySourceFiles.length} type-only source file(s) from actionable test-gap analysis`
        );
      }

      // Phase 4: Calculate coverage
      const testedCount = actionableSourceFiles.length - untestedFiles.length;
      const coveragePercentage = calculateCoverage(testedCount, actionableSourceFiles.length);

      logger.info(
        `Test file inventory: ${testedCount}/${actionableSourceFiles.length} actionable runtime source file(s) matched to test files by naming convention`
      );

      // Phase 5: Categorize untested files
      const categories = categorizeUntestedFiles(untestedFiles);

      // Phase 6: Generate report
      const results = {
        totalSourceFiles: sourceFiles.length,
        totalActionableSourceFiles: actionableSourceFiles.length,
        totalTestFiles: testFiles.length,
        rawUntestedFiles,
        untestedFiles,
        excludedUntestedFiles,
        typeOnlySourceFiles,
        typeOnlyUntestedFiles,
        coveragePercentage,
        categories,
      };

      const report = formatTestGenerationReport(results);
      await this.backlog.saveStepSummary(7, 'Test Generation', report);

      // Phase 7: AI-powered test generation (optional, non-fatal)
      const generatedFiles = [];
      if (untestedFiles.length > 0) {
        try {
          const aiAvailable = await initializeStepAiContext({
            aiHelper: this.aiHelper,
            aiCache: this.aiCache,
          });
          if (aiAvailable) {
            // Compute filesToGenerate here so the strategy prompt can report projected coverage,
            // avoiding a false "Critical" gap for files that are about to be generated in this run.
            const filesToGenerate = untestedFiles.slice(0, MAX_FILES_TO_GENERATE);
            const projectedTestedCount = testedCount + filesToGenerate.length;
            const projectedCoverage = calculateCoverage(
              projectedTestedCount,
              actionableSourceFiles.length
            );

            // Preliminary: test strategy analysis using test_strategy_prompt + project-kind overlay
            try {
              const yamlContent = await this.fileOps.readFile(AI_HELPERS_PATH);
              const parsedYaml = yaml.load(yamlContent);
              const strategyEvidence = await this._buildTestStrategyEvidence(
                projectRoot,
                filesToGenerate,
                testFiles
              );
              let roleOverride = '';
              try {
                const pkYaml = await this.fileOps.readFile(AI_PROJECT_KINDS_PATH);
                const parsedPk = yaml.load(pkYaml);
                const pk = buildProjectKindPrompt(
                  parsedPk,
                  options?.projectKind ?? 'default',
                  'test_engineer'
                );
                if (pk?.role) roleOverride = pk.role;
              } catch {
                /* optional */
              }
              const strategyPrompt = buildYamlStepPrompt(parsedYaml, 'test_strategy_prompt', {
                project_name: path.basename(projectRoot),
                file_inventory_stats: `${coveragePercentage}% (${testedCount}/${actionableSourceFiles.length} actionable runtime source files have corresponding tests by naming convention; ${sourceFiles.length} total source files discovered, ${typeOnlySourceFiles.length} type-only files excluded, ${excludedSourceFiles.length} vendored/generated files excluded, ${testFiles.length} total test files)`,
                projected_file_inventory_stats: `${projectedCoverage}% (${projectedTestedCount}/${actionableSourceFiles.length} actionable runtime source files would have matching tests after generating ${filesToGenerate.length} file(s) in this run)`,
                files_to_generate: filesToGenerate.join(', ') || 'none',
                test_files: buildTestFilesSummary(testFiles),
                modified_count: options?.modifiedFiles?.length ?? 0,
                source_file_excerpts: strategyEvidence.sourceFileExcerpts,
                test_file_excerpts: strategyEvidence.testFileExcerpts,
              });
              if (strategyPrompt) {
                const stratPromptWithRole = roleOverride
                  ? `[Project-Kind Role: ${roleOverride}]\n\n${strategyPrompt}`
                  : strategyPrompt;
                const stratHashEntries = [...untestedFiles, ...testFiles].map((f) => `file:${f}`);
                const stratResult = await this.aiCache.withFileChangeGuard(
                  'step_07_strategy',
                  stratHashEntries,
                  () =>
                    this.aiHelper.executeRequest(stratPromptWithRole, { persona: 'test_engineer' })
                );
                const stratContent = stratResult?.content ?? '';
                if (stratContent) {
                  const stratReport = `${report}\n\n---\n\n## Test Strategy\n\n${stratContent}`;
                  await this.backlog.saveStepSummary(7, 'Test Generation', stratReport);
                }
              }
            } catch {
              /* non-fatal */
            }
            logger.info(
              `Generating tests for ${filesToGenerate.length} file(s) via AI (cap: ${MAX_FILES_TO_GENERATE})...`
            );
            for (const sourceFile of filesToGenerate) {
              const generated = await this.generateTestFile(projectRoot, sourceFile, language);
              if (generated) {
                generatedFiles.push(generated);
              }
            }
            if (generatedFiles.length > 0) {
              const invalidFiles = await this._verifyGeneratedTests(projectRoot, generatedFiles);
              if (invalidFiles.length > 0) {
                logger.warn(
                  `${invalidFiles.length} generated test file(s) failed compilation and were removed: ` +
                    invalidFiles.join(', ')
                );
                for (const f of invalidFiles) {
                  generatedFiles.splice(generatedFiles.indexOf(f), 1);
                  try {
                    await this.fileOps.deleteFile(path.join(projectRoot, f));
                  } catch {
                    /* best-effort */
                  }
                }
              }
              if (generatedFiles.length > 0) {
                logger.success(`AI generated ${generatedFiles.length} test file(s)`);
              }
            }
          } else {
            logger.warn('AI helper not available - skipping test generation');
          }
        } catch (aiError) {
          logger.warn(`AI test generation skipped: ${aiError.message}`);
        }
      }

      if (actionableSourceFiles.length === 0) {
        logger.success(
          'Step 7 completed - no actionable runtime source files required test generation'
        );
      } else if (untestedFiles.length === 0) {
        logger.success(
          'Step 7 completed - all actionable runtime source files have corresponding test files'
        );
      } else {
        logger.warn(`Step 7 completed - ${untestedFiles.length} actionable file(s) need testing`);
      }

      return {
        success: true,
        ...results,
        generatedFiles,
      };
    } catch (error) {
      logger.error(`Step 7 failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate a test file for a single source file using AI.
   * @param {string} projectRoot - Project root directory
   * @param {string} sourceFile - Relative path to the source file
   * @param {string} language - Programming language
   * @returns {Promise<string|null>} Path to generated test file, or null on skip/failure
   */
  async generateTestFile(projectRoot, sourceFile, language) {
    try {
      const absSource = path.join(projectRoot, sourceFile);
      const content = await this.fileOps.readFile(absSource);

      if (content.length > MAX_SOURCE_FILE_CHARS) {
        logger.info(
          `Source file ${sourceFile} exceeds ${MAX_SOURCE_FILE_CHARS} chars; truncating prompt input`
        );
      }

      const projectContext = await this._readProjectTestContext(projectRoot, language, sourceFile);
      const testOutputPath = getTestOutputPath(sourceFile, language, projectContext);
      const testFramework =
        projectContext.detectedTestFramework ?? TEST_FRAMEWORK_BY_LANGUAGE[language] ?? language;
      const absTestPath = path.join(projectRoot, testOutputPath);

      // Skip if test file already exists
      try {
        await this.fileOps.readFile(absTestPath);
        logger.info(`Test file already exists: ${testOutputPath}`);
        return null;
      } catch {
        // File does not exist — proceed
      }

      const prompt = await this._buildSingleFilePrompt(
        projectRoot,
        sourceFile,
        content,
        language,
        testOutputPath,
        projectContext
      );
      const aiResult = await this.aiCache.withFileChangeGuard(
        `step_07|${sourceFile}`,
        [`${sourceFile}:${content}`],
        () => this.aiHelper.executeRequest(prompt, { persona: 'test_engineer' })
      );

      const aiContent = aiResult?.content ?? '';
      const testCode = extractTestCode(aiContent) ?? aiContent.trim();

      if (!testCode) {
        logger.warn(`AI returned empty test for ${sourceFile}`);
        return null;
      }

      const generatedTestProblems = findGeneratedTestProblems({
        testCode,
        testOutputPath,
        testFramework,
      });
      if (generatedTestProblems.length > 0) {
        logger.warn(
          `Rejected generated test for ${sourceFile} because ${generatedTestProblems.join('; ')}`
        );
        return null;
      }

      if (!usesRuntimeTargetModule({ testCode, sourceFile, testOutputPath })) {
        logger.warn(
          `Rejected generated test for ${sourceFile} because it does not import and use a runtime export from the target module`
        );
        return null;
      }

      await this.fileOps.writeFile(absTestPath, testCode + '\n');
      logger.success(`Generated: ${testOutputPath}`);
      return testOutputPath;
    } catch (err) {
      logger.warn(`Failed to generate test for ${sourceFile}: ${err.message}`);
      return null;
    }
  }

  /**
   * Build the per-file test-generation prompt using the YAML template when available.
   * Falls back to the inline template if YAML loading fails.
   * @param {string} projectRoot - Absolute project root
   * @param {string} sourceFile - Relative source file path
   * @param {string} content - Source file content
   * @param {string} language - Detected language
   * @param {string} targetTestPath - Relative path where the generated test file will be written
   * @returns {Promise<string>} Prompt string
   */
  async _buildSingleFilePrompt(
    projectRoot,
    sourceFile,
    content,
    language,
    targetTestPath,
    projectContext = null
  ) {
    const resolvedProjectContext =
      projectContext ?? (await this._readProjectTestContext(projectRoot, language, sourceFile));
    try {
      const yamlContent = await this.fileOps.readFile(AI_HELPERS_PATH);
      const parsedYaml = yaml.load(yamlContent);
      return buildSingleFileTestPrompt(
        sourceFile,
        content,
        language,
        parsedYaml,
        targetTestPath,
        resolvedProjectContext
      );
    } catch {
      return buildSingleFileTestPrompt(
        sourceFile,
        content,
        language,
        null,
        targetTestPath,
        resolvedProjectContext
      );
    }
  }

  /**
   * Find declaration-only TypeScript source files that should be excluded from runtime test generation.
   * @param {string} projectRoot - Absolute project root
   * @param {string[]} sourceFiles - Relative source file paths
   * @returns {Promise<string[]>} Type-only source files
   */
  async _findTypeOnlySourceFiles(projectRoot, sourceFiles) {
    const candidates = sourceFiles.filter((sourceFile) => canBeTypeOnlySourceFile(sourceFile));
    const matches = await Promise.all(
      candidates.map(async (sourceFile) => {
        try {
          const content = await this.fileOps.readFile(path.join(projectRoot, sourceFile));
          return isTypeOnlySourceFile(sourceFile, content) ? sourceFile : null;
        } catch {
          return null;
        }
      })
    );
    return matches.filter(Boolean);
  }

  /**
   * Read jest/tsconfig settings from the target project to enrich test-generation prompts.
   * Returns empty strings for any field that can't be read — callers must handle missing context.
   * @param {string} projectRoot - Absolute project root
   * @param {string} language - Detected language
   * @param {string} sourceFile - Relative source file path
   * @returns {Promise<{jestConstraints: string, typescriptConstraints: string, testImportExamples: string}>}
   */
  async _readProjectTestContext(projectRoot, language, sourceFile = '') {
    const lines = [];
    const candidateTestFiles = [];

    // Detect the actual test framework from package.json dependencies.
    // This overrides the static TEST_FRAMEWORK_BY_LANGUAGE map so that projects
    // using vitest, mocha, etc. get correct idioms in the generated test files.
    let detectedTestFramework = null;
    let packageJson = null;
    try {
      const pkgRaw = await this.fileOps.readFile(path.join(projectRoot, 'package.json'));
      packageJson = JSON.parse(pkgRaw);
      const allDeps = { ...packageJson.dependencies, ...packageJson.devDependencies };
      if (allDeps.vitest) detectedTestFramework = 'vitest';
      else if (allDeps.jest || allDeps['@jest/core'] || allDeps['ts-jest'])
        detectedTestFramework = 'Jest';
      else if (allDeps.mocha) detectedTestFramework = 'Mocha';
      else if (allDeps.jasmine || allDeps['@jest/jasmine2']) detectedTestFramework = 'Jasmine';
      else if (allDeps.ava) detectedTestFramework = 'AVA';
    } catch {
      /* package.json unreadable — keep null, falls back to static map */
    }

    const jestConfigCandidates = buildJestConfigCandidates(packageJson ?? {});
    let jestMatchPatterns = [];
    for (const relativeConfigPath of jestConfigCandidates) {
      try {
        const jestConfigPath = path.join(projectRoot, relativeConfigPath);
        const jestRaw = await this.fileOps.readFile(jestConfigPath);
        const patternMatch = jestRaw.match(/testPathPattern['":\s]+['"]([^'"]+)['"]/);
        const testMatch = jestRaw.match(/testMatch[^[]*\[([^\]]+)\]/s);
        const testRegex = jestRaw.match(/testRegex['":\s]+['"]([^'"]+)['"]/);
        const rootsMatch = jestRaw.match(/roots[^[]*\[([^\]]+)\]/s);
        const moduleMapper = jestRaw.match(/moduleNameMapper\s*:\s*\{([^}]+)\}/s);

        lines.push(`- Jest config file: \`${relativeConfigPath}\``);

        if (patternMatch) {
          lines.push(
            `- Jest testPathPattern: \`${patternMatch[1]}\` — the generated file MUST be under a matching path`
          );
        }

        if (testMatch) {
          jestMatchPatterns = extractQuotedValues(testMatch[1]);
          lines.push(`- Jest testMatch: ${jestMatchPatterns.join(', ')}`);
        }

        if (testRegex) {
          lines.push(`- Jest testRegex: \`${testRegex[1]}\``);
        }

        if (rootsMatch) {
          const roots = extractQuotedValues(rootsMatch[1]);
          if (roots.length > 0) {
            lines.push(`- Jest roots: ${roots.join(', ')}`);
          }
        }

        if (jestMatchPatterns.length > 0) {
          lines.push(
            `- Generated test filenames MUST match one of the configured patterns above; do not invent a different suffix or extension.`
          );
          if (!jestMatchPatterns.some((pattern) => /\.vue/.test(pattern))) {
            lines.push(
              '- Do NOT emit `.test.vue` files unless the Jest config explicitly matches `.vue` test files.'
            );
          }
        }

        if (moduleMapper) {
          const mapperLines = moduleMapper[1]
            .split('\n')
            .map((l) => l.trim())
            .filter((l) => l && !l.startsWith('//'))
            .slice(0, 5);
          if (mapperLines.length > 0) {
            lines.push(
              `- Jest moduleNameMapper (use mapped paths — do NOT import the raw package directly):\n  ${mapperLines.join('\n  ')}`
            );
          }
        }

        break;
      } catch {
        /* config candidate unreadable — keep looking */
      }
    }

    // TypeScript: extract strict mode and paths aliases
    const tsLines = [];
    try {
      const tsconfigRaw = await this.fileOps.readFile(path.join(projectRoot, 'tsconfig.json'));
      // Strip JSONC comments before parsing
      const stripped = tsconfigRaw.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
      const tsconfig = JSON.parse(stripped);
      const opts = tsconfig?.compilerOptions ?? {};
      if (opts.strict)
        tsLines.push(
          '- TypeScript `strict: true` is enabled — all generated code MUST compile without implicit `any`, untyped variables, or type errors'
        );
      if (opts.paths && Object.keys(opts.paths).length > 0) {
        const pathAliases = Object.entries(opts.paths)
          .slice(0, 5)
          .map(([k, v]) => `${k} → ${Array.isArray(v) ? v[0] : v}`)
          .join(', ');
        tsLines.push(`- TypeScript path aliases: ${pathAliases}`);
      }
    } catch {
      /* tsconfig.json unreadable — skip */
    }

    // Collect 2 existing test file import headers as style examples
    const importExamples = [];
    if (language === 'typescript' || language === 'javascript') {
      try {
        const candidateGlobs = [
          '__tests__/**/*.vue.test.ts',
          '__tests__/**/*.test.ts',
          'test/**/*.vue.test.ts',
          'test/**/*.test.ts',
          '__tests__/**/*.vue.test.js',
          '__tests__/**/*.test.js',
          'test/**/*.vue.test.js',
          'test/**/*.test.js',
        ];
        for (const pattern of candidateGlobs) {
          const files = await this.fileOps.glob(pattern, {
            cwd: projectRoot,
            absolute: false,
          });
          candidateTestFiles.push(...files);
        }

        const normalizedSource = sourceFile.replace(/\\/g, '/');
        const sourceIsVue = normalizedSource.endsWith('.vue');
        const uniqueFiles = [...new Set(candidateTestFiles)].sort((a, b) => {
          const score = (file) => {
            let value = 0;
            if (sourceIsVue && /\.vue\.test\.[jt]s$/i.test(file)) value += 4;
            if (file.startsWith('__tests__/')) value += 2;
            if (
              normalizedSource.startsWith('src/components/') &&
              file.replace(/\\/g, '/').includes('/components/')
            ) {
              value += 1;
            }
            return value;
          };
          return score(b) - score(a);
        });

        for (const f of uniqueFiles.slice(0, 10)) {
          if (importExamples.length >= 2) break;
          try {
            const raw = await this.fileOps.readFile(path.join(projectRoot, f));
            const importBlock = raw
              .split('\n')
              .slice(0, 8)
              .filter(
                (l) => l.startsWith('import ') || l.startsWith('const ') || l.startsWith('jest.')
              )
              .join('\n');
            if (importBlock) importExamples.push(`// ${f}\n${importBlock}`);
          } catch {
            /* skip unreadable file */
          }
        }
      } catch {
        /* glob failed — skip */
      }
    }

    const resolvedFramework =
      detectedTestFramework ?? TEST_FRAMEWORK_BY_LANGUAGE[language] ?? language;
    const preferredTestRoot = inferPreferredTestRoot(candidateTestFiles, sourceFile);
    return {
      detectedTestFramework,
      preferredTestRoot,
      mockApiGuidance:
        String(resolvedFramework).toLowerCase() === 'jest'
          ? '`jest.mock()` with a factory function'
          : String(resolvedFramework).toLowerCase() === 'vitest'
            ? '`vi.mock()` with a factory function'
            : `the mock API provided by ${resolvedFramework}`,
      jestConstraints:
        lines.length > 0
          ? lines.join('\n')
          : `- Use standard ${resolvedFramework} idioms for this project`,
      typescriptConstraints:
        tsLines.length > 0
          ? tsLines.join('\n')
          : '- Ensure all types are explicit; avoid implicit `any`',
      testImportExamples:
        importExamples.length > 0
          ? importExamples.join('\n\n')
          : '(no examples available — infer from the source file location)',
    };
  }

  async _buildTestStrategyEvidence(projectRoot, sourceFiles, testFiles) {
    const buildExcerpt = async (relativePath) => {
      try {
        const raw = await this.fileOps.readFile(path.join(projectRoot, relativePath));
        const excerpt = raw.split('\n').slice(0, 40).join('\n').trim();
        if (!excerpt) return null;
        const truncated =
          excerpt.length > 2000 ? `${excerpt.slice(0, 2000).trimEnd()}\n...(truncated)` : excerpt;
        return `### ${relativePath}\n\`\`\`\n${truncated}\n\`\`\``;
      } catch {
        return null;
      }
    };

    const sourceFileExcerpts = (
      await Promise.all((sourceFiles ?? []).slice(0, 3).map((file) => buildExcerpt(file)))
    )
      .filter(Boolean)
      .join('\n\n');
    const testFileExcerpts = (
      await Promise.all((testFiles ?? []).slice(0, 3).map((file) => buildExcerpt(file)))
    )
      .filter(Boolean)
      .join('\n\n');

    return {
      sourceFileExcerpts: sourceFileExcerpts || '(no source file excerpts provided)',
      testFileExcerpts: testFileExcerpts || '(no existing test excerpts provided)',
    };
  }

  /**
   * Run a two-phase validation on generated test files:
   * 1. TypeScript type-check (tsc --noEmit or npm run type:check)
   * 2. Live test execution of only the generated files in isolation
   *
   * NOTE: executor() throws ExecutionError (with .stdout/.stderr) on non-zero exit.
   * We catch those throws and extract the output from the error object — never from
   * a success result — because exit code 0 returns normally and non-zero throws.
   *
   * Returns the relative paths of files that failed either phase.
   * Non-fatal: the caller removes invalid files; the step never throws.
   * @param {string} projectRoot - Absolute project root
   * @param {string[]} generatedFiles - Relative paths of the just-written test files
   * @returns {Promise<string[]>} Relative paths of files that failed validation
   */
  async _verifyGeneratedTests(projectRoot, generatedFiles) {
    if (!generatedFiles.length) return [];

    const failed = new Set();

    // ── Phase 1: TypeScript type-check ────────────────────────────────────────
    // executor() throws ExecutionError on non-zero exit; stdout/stderr on the error object.
    let typecheckCmd = 'npx tsc --noEmit';
    try {
      const pkgRaw = await this.fileOps.readFile(path.join(projectRoot, 'package.json'));
      const pkg = JSON.parse(pkgRaw);
      if (pkg?.scripts?.['type:check'] || pkg?.scripts?.['typecheck']) {
        typecheckCmd = `npm run ${pkg.scripts['type:check'] ? 'type:check' : 'typecheck'}`;
      }
    } catch {
      /* package.json unreadable */
    }

    try {
      await executor(typecheckCmd, { cwd: projectRoot });
      // exit 0 → all files pass tsc; nothing to flag
    } catch (tscErr) {
      const tscOutput = ((tscErr?.stdout ?? '') + (tscErr?.stderr ?? '')).toString();
      generatedFiles.forEach((f) => {
        if (tscOutput.includes(f)) failed.add(f);
      });
    }

    // ── Phase 2: Live test execution of generated files in isolation ──────────
    // executor() throws ExecutionError on non-zero exit; extract stdout from the error.
    let testRunner = null;
    try {
      const pkgRaw = await this.fileOps.readFile(path.join(projectRoot, 'package.json'));
      const pkg = JSON.parse(pkgRaw);
      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
      if (allDeps.vitest) testRunner = 'vitest';
      else if (allDeps.jest || allDeps['ts-jest']) testRunner = 'jest';
    } catch {
      /* skip */
    }

    if (testRunner) {
      const filesToTest = generatedFiles.filter((f) => !failed.has(f));
      const quotedFiles = filesToTest.map((f) => `"${f}"`).join(' ');
      if (quotedFiles) {
        const runCmd =
          testRunner === 'vitest'
            ? `npx vitest run ${quotedFiles}`
            : `npx jest --passWithNoTests ${quotedFiles}`;
        try {
          await executor(runCmd, { cwd: projectRoot, timeout: 60000 });
          // exit 0 → all generated tests pass; keep failed set as-is
        } catch (runErr) {
          const runOutput = ((runErr?.stdout ?? '') + (runErr?.stderr ?? '')).toString();
          filesToTest.forEach((f) => {
            // Match on stem (e.g. "phase4_confirm.test") since vitest prints the full path
            const stem = path.basename(f, path.extname(f)); // e.g. "phase4_confirm.test"
            if (runOutput.includes(stem) || runOutput.includes(f)) failed.add(f);
          });
          // If we cannot attribute failures to specific files, conservatively flag all
          if (failed.size === 0) filesToTest.forEach((f) => failed.add(f));
          logger.warn(
            `[step_07] ${failed.size} generated test file(s) failed runtime verification and will be removed: ` +
              [...failed].join(', ')
          );
        }
      }
    }

    return [...failed];
  }

  /**
   * Detect primary language
   * @param {string} projectRoot - Project root directory
   * @returns {Promise<string>} Language name
   */
  async detectLanguage(projectRoot) {
    return detectPrimaryLanguage(this.techStack, projectRoot);
  }

  /**
   * Discover source files
   * @param {string} projectRoot - Project root directory
   * @param {string} language - Programming language
   * @returns {Promise<string[]>} Source file paths
   */
  async discoverSourceFiles(projectRoot, language) {
    const patterns = getSourcePatterns(language);
    const exclude = EXCLUDE_DIRS;

    const allFiles = [];
    for (const pattern of patterns) {
      try {
        const files = await this.fileOps.glob(pattern, {
          cwd: projectRoot,
          absolute: false,
          ignore: exclude.map((dir) => `**/${dir}/**`),
        });
        allFiles.push(...files);
      } catch {
        // Pattern didn't match, continue
      }
    }

    // Remove duplicates
    return [...new Set(allFiles)];
  }

  /**
   * Discover test files
   * @param {string} projectRoot - Project root directory
   * @param {string} language - Programming language
   * @returns {Promise<string[]>} Test file paths
   */
  async discoverTestFiles(projectRoot, language) {
    const patterns = getTestPatterns(language);
    const exclude = EXCLUDE_DIRS;

    // Build glob patterns from test patterns
    const globPatterns = [];
    patterns.forEach((pattern) => {
      if (pattern.startsWith('.test.') || pattern.startsWith('.spec.')) {
        // .test.js -> **/*.test.js
        globPatterns.push(`**/*${pattern}`);
      } else if (pattern.startsWith('test_')) {
        // test_ -> **/test_*.py
        globPatterns.push(`**/${pattern}*`);
      } else if (pattern.endsWith('_test.py') || pattern.endsWith('_test.go')) {
        // _test.py -> **/*_test.py
        globPatterns.push(`**/*${pattern}`);
      } else if (pattern.includes('/tests/')) {
        // /tests/ -> **/tests/**
        globPatterns.push('**/tests/**');
      } else if (pattern.includes('__tests__')) {
        // __tests__ -> **/__tests__/**
        globPatterns.push('**/__tests__/**');
      } else {
        // Generic
        globPatterns.push(`**/*${pattern}*`);
      }
    });

    const allFiles = [];
    for (const pattern of globPatterns) {
      try {
        const files = await this.fileOps.glob(pattern, {
          cwd: projectRoot,
          absolute: false,
          ignore: exclude.map((dir) => `**/${dir}/**`),
        });
        allFiles.push(...files);
      } catch {
        // Pattern didn't match, continue
      }
    }

    // Remove duplicates
    return [...new Set(allFiles)];
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default Step7TestGenerator;
