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
import { AI_HELPERS_PATH, AI_PROJECT_KINDS_PATH, buildYamlStepPrompt, buildProjectKindPrompt } from '../lib/ai_prompt_builder.js';
import yaml from 'js-yaml';
import path from 'path';

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
  javascript: ['.test.js', '.spec.js', '.test.ts', '.spec.ts', '__tests__'],
  typescript: ['.test.ts', '.spec.ts', '__tests__'],
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
  const fileName = path.basename(filePath);
  return EXCLUDE_FILES.includes(fileName);
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
export function findUntestedFiles({ sourceFiles, testFiles, language }) {
  return sourceFiles.filter((sourceFile) => {
    // Skip excluded files
    if (shouldExcludeFile(sourceFile)) return false;

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
    totalTestFiles = 0,
    untestedFiles = [],
    coveragePercentage = 0,
    categories = {},
  } = results;

  let report = '# Test Generation Report\n\n';

  // Summary
  report += '## Summary\n\n';
  report += `- **Total Source Files**: ${totalSourceFiles}\n`;
  report += `- **Total Test Files**: ${totalTestFiles}\n`;
  report += `- **Untested Files**: ${untestedFiles.length}\n`;
  report += `- **Test Coverage**: ${coveragePercentage}%\n\n`;

  // Coverage status
  if (coveragePercentage === 100) {
    report += '## ✅ Excellent Coverage\n\n';
    report += 'All source files have corresponding tests!\n\n';
  } else if (coveragePercentage >= 80) {
    report += '## 👍 Good Coverage\n\n';
    report += `${coveragePercentage}% of source files have tests. Consider testing the remaining ${untestedFiles.length} file(s).\n\n`;
  } else if (coveragePercentage >= 50) {
    report += '## ⚠️ Moderate Coverage\n\n';
    report += `Only ${coveragePercentage}% of source files have tests. ${untestedFiles.length} file(s) need testing.\n\n`;
  } else if (totalSourceFiles > 0) {
    report += '## 🚨 Low Coverage\n\n';
    report += `Only ${coveragePercentage}% of source files have tests. ${untestedFiles.length} file(s) urgently need testing!\n\n`;
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
    report += '4. Aim for at least 80% test coverage\n\n';
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
  const lines = [`${testFiles.length} test files across ${dirCount} director${dirCount === 1 ? 'y' : 'ies'}:`];
  for (const [dir, files] of Object.entries(groups)) {
    const sample = files.slice(0, 3).join(', ');
    const more = files.length > 3 ? `, ... (+${files.length - 3} more)` : '';
    lines.push(`  ${dir}/ (${files.length}): ${sample}${more}`);
  }
  return lines.join('\n');
}

/**
 * Compute the output path for a generated test file.
 * @pure
 * @param {string} sourceFile - Relative source file path
 * @param {string} language - Programming language
 * @returns {string} Relative test file path
 */
export function getTestOutputPath(sourceFile, language) {
  const ext = path.extname(sourceFile);
  const base = path.basename(sourceFile, ext);
  const dir = path.dirname(sourceFile);

  // Replace leading src/ with test/, otherwise prepend test/
  const testDir = dir.startsWith('src') ? dir.replace(/^src/, 'test') : path.join('test', dir);

  const lang = language.toLowerCase();
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
export function buildSingleFileTestPrompt(sourceFile, content, language, parsedYaml = null) {
  const truncated =
    content.length > MAX_SOURCE_FILE_CHARS
      ? content.substring(0, MAX_SOURCE_FILE_CHARS) + '\n...(truncated)'
      : content;
  const ext = path.extname(sourceFile).replace('.', '') || language;
  const testFramework = TEST_FRAMEWORK_BY_LANGUAGE[language] ?? language;

  if (parsedYaml) {
    const prompt = buildYamlStepPrompt(parsedYaml, 'single_file_test_prompt', {
      source_file: sourceFile,
      language,
      test_framework: testFramework,
      source_ext: ext,
      source_content: truncated,
    });
    if (prompt) return prompt;
  }

  // Inline fallback (used when YAML is unavailable)
  return `You are a senior test engineer. Generate a complete, runnable test file for the source file below.

**Source file**: \`${sourceFile}\`
**Language / framework**: ${testFramework}

**Requirements**:
- Output ONLY the test file content inside a single fenced code block (\`\`\`${ext} ... \`\`\`)
- Cover: happy paths, edge cases, and error scenarios
- Use the standard test framework for ${language} (e.g. Jest for JS/TS, pytest for Python)
- Use descriptive test names
- Do NOT include explanations outside the code block

\`\`\`${ext}
${truncated}
\`\`\`

Now generate the test file:`;
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
      const language = await this.detectLanguage(projectRoot);
      logger.info(`Detected language: ${language}`);

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
          totalTestFiles: testFiles.length,
          untestedFiles: [],
          coveragePercentage: 0,
        });
        await this.backlog.saveStepSummary(7, 'Test Generation', report);

        return {
          success: true,
          totalSourceFiles: 0,
          totalTestFiles: testFiles.length,
          untestedFiles: [],
          coveragePercentage: 0,
          generatedFiles: [],
        };
      }

      // Phase 3: Identify untested files
      const untestedFiles = findUntestedFiles({
        sourceFiles,
        testFiles,
        language,
      });

      logger.info(`Identified ${untestedFiles.length} untested file(s)`);

      // Phase 4: Calculate coverage
      const testedCount = sourceFiles.length - untestedFiles.length;
      const coveragePercentage = calculateCoverage(testedCount, sourceFiles.length);

      logger.info(`Test coverage: ${coveragePercentage}%`);

      // Phase 5: Categorize untested files
      const categories = categorizeUntestedFiles(untestedFiles);

      // Phase 6: Generate report
      const results = {
        totalSourceFiles: sourceFiles.length,
        totalTestFiles: testFiles.length,
        untestedFiles,
        coveragePercentage,
        categories,
      };

      const report = formatTestGenerationReport(results);
      await this.backlog.saveStepSummary(7, 'Test Generation', report);

      // Phase 7: AI-powered test generation (optional, non-fatal)
      const generatedFiles = [];
      if (untestedFiles.length > 0) {
        try {
          const aiAvailable = await this.aiHelper.initialize();
          if (aiAvailable) {
            await this.aiCache.init();

            // Preliminary: test strategy analysis using test_strategy_prompt + project-kind overlay
            try {
              const yamlContent = await this.fileOps.readFile(AI_HELPERS_PATH);
              const parsedYaml = yaml.load(yamlContent);
              let roleOverride = '';
              try {
                const pkYaml = await this.fileOps.readFile(AI_PROJECT_KINDS_PATH);
                const parsedPk = yaml.load(pkYaml);
                const pk = buildProjectKindPrompt(parsedPk, options?.projectKind ?? 'default', 'test_engineer');
                if (pk?.role) roleOverride = pk.role;
              } catch { /* optional */ }
              const strategyPrompt = buildYamlStepPrompt(parsedYaml, 'test_strategy_prompt', {
                project_name: path.basename(projectRoot),
                coverage_stats: `${coveragePercentage}% (${testedCount}/${sourceFiles.length} source files have tests, ${testFiles.length} total test files)`,
                test_files: buildTestFilesSummary(testFiles),
                modified_count: options?.modifiedFiles?.length ?? 0,
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
            } catch { /* non-fatal */ }

            const filesToGenerate = untestedFiles.slice(0, MAX_FILES_TO_GENERATE);
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
              logger.success(`AI generated ${generatedFiles.length} test file(s)`);
            }
          } else {
            logger.warn('AI helper not available - skipping test generation');
          }
        } catch (aiError) {
          logger.warn(`AI test generation skipped: ${aiError.message}`);
        }
      }

      if (untestedFiles.length === 0) {
        logger.success('Step 7 completed - all files have tests!');
      } else {
        logger.warn(`Step 7 completed - ${untestedFiles.length} file(s) need testing`);
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
        logger.warn(`Skipping ${sourceFile} — file too large (${content.length} chars)`);
        return null;
      }

      const testOutputPath = getTestOutputPath(sourceFile, language);
      const absTestPath = path.join(projectRoot, testOutputPath);

      // Skip if test file already exists
      try {
        await this.fileOps.readFile(absTestPath);
        logger.info(`Test file already exists: ${testOutputPath}`);
        return null;
      } catch {
        // File does not exist — proceed
      }

      const prompt = await this._buildSingleFilePrompt(sourceFile, content, language);
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
   * @param {string} sourceFile - Relative source file path
   * @param {string} content - Source file content
   * @param {string} language - Detected language
   * @returns {Promise<string>} Prompt string
   */
  async _buildSingleFilePrompt(sourceFile, content, language) {
    try {
      const yamlContent = await this.fileOps.readFile(AI_HELPERS_PATH);
      const parsedYaml = yaml.load(yamlContent);
      return buildSingleFileTestPrompt(sourceFile, content, language, parsedYaml);
    } catch {
      return buildSingleFileTestPrompt(sourceFile, content, language);
    }
  }

  /**
   * Detect primary language
   * @param {string} projectRoot - Project root directory
   * @returns {Promise<string>} Language name
   */
  async detectLanguage(projectRoot) {
    try {
      const detection = await this.techStack.detectAll(projectRoot);
      if (detection.languages && detection.languages.length > 0) {
        return detection.languages[0];
      }
    } catch {
      // Fallback
    }
    return 'javascript';
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
