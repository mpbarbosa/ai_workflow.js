/**
 * Step 5: Directory Structure Validation
 * @module steps/step_05_directory
 * @version 2.0.0
 *
 * Validates project directory structure, organizes misplaced documentation,
 * and verifies architecture consistency.
 */

import { STEP_KIND } from './step_contract.js';
import { logger } from '../core/logger.js';
import { FileOperations } from '../lib/file_operations.js';
import { Backlog } from '../lib/backlog.js';
import { GitAutomation } from '../lib/git_automation.js';
import { Config } from '../lib/config.js';
import path from 'path';
import fs from 'fs/promises';
import { AiHelper } from '../lib/ai_helpers.js';
import { AiCache } from '../lib/ai_cache.js';
import { TechStackDetector, getPrimaryLanguage } from '../lib/tech_stack.js';
import {
  buildStructuredPrompt,
  injectProjectContext,
  buildYamlStepPrompt,
  loadResolvedAiHelpers,
} from '../lib/ai_prompt_builder.js';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Documentation categories for file organization
 */
export const DIR_CATEGORIES = {
  WORKFLOW: 'workflow',
  TEST: 'test',
  GUIDE: 'guide',
  REFERENCE: 'reference',
  ARCHITECTURE: 'architecture',
  REPORT: 'report',
  BUGFIX: 'bugfix',
  IMPLEMENTATION: 'implementation',
  ANALYSIS: 'analysis',
  UNCATEGORIZED: 'uncategorized',
};

/**
 * Category patterns for automatic classification
 */
export const CATEGORY_PATTERNS = {
  [DIR_CATEGORIES.WORKFLOW]: /(WORKFLOW|EXECUTION|ORCHESTRAT|PIPELINE|AUTOMATION)/i,
  [DIR_CATEGORIES.TEST]: /(TEST|COVERAGE|SPEC)/i,
  [DIR_CATEGORIES.BUGFIX]: /(BUGFIX|FIX|ISSUE|BUG)/i,
  [DIR_CATEGORIES.IMPLEMENTATION]: /(IMPLEMENTATION|COMPLETE|SUMMARY|MIGRATION|REFACTOR)/i,
  [DIR_CATEGORIES.ANALYSIS]: /(ANALYSIS|REPORT|VALIDATION|REVIEW|AUDIT)/i,
  [DIR_CATEGORIES.GUIDE]: /(GUIDE|HOWTO|TUTORIAL|QUICK|REFERENCE)/i,
  [DIR_CATEGORIES.ARCHITECTURE]: /(ARCHITECTURE|DESIGN|PATTERN|STRUCTURE)/i,
  [DIR_CATEGORIES.REPORT]: /(DELIVERABLE|CHECKLIST|PHASE|RECOMMENDATION)/i,
};

/**
 * Target directories for each category
 */
export const CATEGORY_DIRS = {
  [DIR_CATEGORIES.WORKFLOW]: 'docs/workflow-automation',
  [DIR_CATEGORIES.TEST]: 'docs/testing',
  [DIR_CATEGORIES.GUIDE]: 'docs/guides',
  [DIR_CATEGORIES.REFERENCE]: 'docs/reference',
  [DIR_CATEGORIES.ARCHITECTURE]: 'docs/architecture',
  [DIR_CATEGORIES.REPORT]: 'docs/reports',
  [DIR_CATEGORIES.BUGFIX]: 'docs/reports/bugfixes',
  [DIR_CATEGORIES.IMPLEMENTATION]: 'docs/reports/implementation',
  [DIR_CATEGORIES.ANALYSIS]: 'docs/reports/analysis',
  [DIR_CATEGORIES.UNCATEGORIZED]: 'docs/misc',
};

/**
 * Files that should remain in project root
 */
export const ROOT_ALLOWED_FILES = [
  'README.md',
  'CHANGELOG.md',
  'LICENSE.md',
  'CONTRIBUTING.md',
  'CODE_OF_CONDUCT.md',
];

/**
 * Directories to exclude from validation
 */
export const EXCLUDED_DIRS = [
  'node_modules',
  '.git',
  'coverage',
  'dist',
  'build',
  '.vscode',
  '.idea',
  // Artifact and cache directories (not relevant to project structure)
  'venv',
  '.venv',
  '__pycache__',
  '.pytest_cache',
  '.jest-cache',
  '.ai_workflow',
  '.ai_cache',
  '.nyc_output',
  '.next',
  '.nuxt',
  '.svelte-kit',
  'out',
];

/**
 * Issue types
 */
export const ISSUE_TYPE = {
  MISPLACED_DOC: 'misplaced_doc',
  MISSING_CRITICAL: 'missing_critical',
  UNDOCUMENTED: 'undocumented',
  DOC_MISMATCH: 'doc_mismatch',
};

// ============================================================================
// PURE FUNCTIONS - File Classification
// ============================================================================

/**
 * Determine if a file should remain in project root
 * @pure
 * @param {string} fileName - File name
 * @returns {boolean} True if file should stay in root
 */
export function shouldStayInRoot(fileName) {
  return ROOT_ALLOWED_FILES.includes(fileName);
}

/**
 * Categorize a documentation file by its name
 * @pure
 * @param {string} fileName - File name
 * @returns {string} Category key
 */
export function categorizeMisplacedDoc(fileName) {
  for (const [category, pattern] of Object.entries(CATEGORY_PATTERNS)) {
    if (pattern.test(fileName)) {
      return category;
    }
  }
  return DIR_CATEGORIES.UNCATEGORIZED;
}

/**
 * Get target directory for a category
 * @pure
 * @param {string} category - Category key
 * @returns {string} Target directory path
 */
export function getTargetDir(category) {
  return CATEGORY_DIRS[category] || CATEGORY_DIRS[DIR_CATEGORIES.UNCATEGORIZED];
}

/**
 * Filter out excluded directories
 * @pure
 * @param {string} dirPath - Directory path
 * @returns {boolean} True if directory should be included
 */
export function shouldIncludeDir(dirPath) {
  const parts = dirPath.split(path.sep);
  return !parts.some((part) => EXCLUDED_DIRS.includes(part));
}

// ============================================================================
// PURE FUNCTIONS - Directory Validation
// ============================================================================

/**
 * Extract critical directories from config
 * @pure
 * @param {Object} config - Configuration object
 * @returns {string[]} Array of critical directory paths
 */
export function extractCriticalDirs(config) {
  if (!config || !config.structure) {
    return [];
  }

  const dirs = [];
  const { src_dirs = [], test_dirs = [], docs_dirs = [] } = config.structure;

  dirs.push(...src_dirs, ...test_dirs, ...docs_dirs);

  return [...new Set(dirs)]; // Remove duplicates
}

/**
 * Get default critical directories if no config
 * @pure
 * @param {string[]} existingDirs - List of existing directories
 * @returns {string[]} Array of default critical directories
 */
export function getDefaultCriticalDirs(existingDirs) {
  const optional = ['.github', 'src', 'docs', 'lib', 'bin', 'tests', 'test'];
  return optional.filter((dir) => existingDirs.includes(dir));
}

/**
 * Check if directory is documented
 * @pure
 * @param {string} dirName - Directory name
 * @param {string[]} docContents - Array of documentation file contents
 * @returns {boolean} True if directory is mentioned in docs
 */
export function isDirectoryDocumented(dirName, docContents) {
  return docContents.some((content) => content.includes(dirName));
}

/**
 * Validate directory structure
 * @pure
 * @param {Object} params - Validation parameters
 * @param {string[]} params.existingDirs - Existing directories
 * @param {string[]} params.criticalDirs - Critical directories
 * @param {string[]} params.docContents - Documentation contents
 * @returns {Object} Validation results
 */
export function validateDirectoryStructure({ existingDirs, criticalDirs, docContents }) {
  const issues = [];

  // Check 1: Missing critical directories
  const missing = criticalDirs.filter((dir) => !existingDirs.includes(dir));
  missing.forEach((dir) => {
    issues.push({
      type: ISSUE_TYPE.MISSING_CRITICAL,
      directory: dir,
      message: `Expected directory missing: ${dir}`,
    });
  });

  // Check 2: Undocumented directories
  const undocumented = existingDirs.filter((dir) => {
    const dirName = path.basename(dir);
    return (
      !EXCLUDED_DIRS.includes(dirName) &&
      dir !== '.' &&
      !isDirectoryDocumented(dirName, docContents)
    );
  });

  undocumented.forEach((dir) => {
    issues.push({
      type: ISSUE_TYPE.UNDOCUMENTED,
      directory: dir,
      message: `Undocumented directory: ${dir}`,
    });
  });

  // Check 3: Documented but missing directories
  criticalDirs.forEach((dir) => {
    const dirName = path.basename(dir);
    if (isDirectoryDocumented(dirName, docContents) && !existingDirs.includes(dir)) {
      issues.push({
        type: ISSUE_TYPE.DOC_MISMATCH,
        directory: dir,
        message: `Documented directory not found: ${dir}`,
      });
    }
  });

  return {
    issues,
    missingCritical: missing.length,
    undocumented: undocumented.length,
    docMismatch: issues.filter((i) => i.type === ISSUE_TYPE.DOC_MISMATCH).length,
  };
}

// ============================================================================
// PURE FUNCTIONS - Reporting
// ============================================================================

/**
 * Format directory structure report
 * @pure
 * @param {Object} results - Validation results
 * @returns {string} Formatted report
 */
export function formatDirectoryReport(results) {
  const {
    totalDirs,
    misplacedDocs,
    organizedDocs,
    structureIssues = [],
    missingCritical = 0,
    undocumented = 0,
    docMismatch = 0,
  } = results;

  let report = '# Directory Structure Validation\n\n';
  report += '## Summary\n\n';
  report += `- **Total Directories**: ${totalDirs}\n`;
  report += `- **Misplaced Documentation**: ${misplacedDocs} file(s)\n`;
  report += `- **Organized Files**: ${organizedDocs} file(s)\n`;
  report += `- **Structure Issues**: ${structureIssues.length}\n\n`;

  if (missingCritical > 0) {
    report += '## ⚠️ Critical Issues\n\n';
    report += `**${missingCritical}** critical directories missing!\n\n`;
  }

  if (structureIssues.length > 0) {
    report += '## Issues Found\n\n';
    report += `- Missing Critical: ${missingCritical}\n`;
    report += `- Undocumented: ${undocumented}\n`;
    report += `- Doc Mismatch: ${docMismatch}\n\n`;

    report += '### Details\n\n';
    const grouped = {};
    structureIssues.forEach((issue) => {
      if (!grouped[issue.type]) grouped[issue.type] = [];
      grouped[issue.type].push(issue);
    });

    Object.entries(grouped).forEach(([type, issues]) => {
      report += `#### ${type}\n\n`;
      issues.slice(0, 10).forEach((issue) => {
        report += `- ${issue.directory}: ${issue.message}\n`;
      });
      if (issues.length > 10) {
        report += `\n... and ${issues.length - 10} more\n`;
      }
      report += '\n';
    });
  }

  if (organizedDocs > 0) {
    report += '## ✅ Documentation Organized\n\n';
    report += `Successfully categorized and moved ${organizedDocs} documentation files.\n\n`;
  }

  if (structureIssues.length === 0 && misplacedDocs === 0) {
    report += '## ✅ All Checks Passed\n\n';
    report += 'Directory structure is well-organized and documented.\n';
  }

  return report;
}

// ============================================================================
// STEP 5 ANALYZER - Integration
// ============================================================================

/**
 * Step 5 analyzer for directory structure validation
 */
export class Step5DirectoryAnalyzer {
  static stepKind = STEP_KIND.PROJECT;

  constructor(options = {}) {
    this.fileOps = options.fileOps || new FileOperations();
    this.backlog = options.backlog || new Backlog();
    this.gitOps = options.gitOps || new GitAutomation();
    this.config = options.config || new Config();
    this.aiHelper = options.aiHelper || new AiHelper({ promptsDir: options.promptsDir || null });
    this.aiCache = options.aiCache || new AiCache();
    this.techStack = options.techStack || new TechStackDetector();
  }

  /**
   * Recursively enumerate directories only (excludes files).
   * Returns absolute paths.
   * @param {string} dirPath - Root to scan
   * @returns {Promise<string[]>}
   */
  async _listDirsRecursive(dirPath) {
    const results = [];
    async function traverse(current) {
      let entries;
      try {
        entries = await fs.readdir(current, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const full = path.join(current, entry.name);
          // Git submodule roots contain a .git FILE (not directory). Skip them so
          // submodule internals don't appear in the project's own directory analysis.
          try {
            const gitMarker = await fs.stat(path.join(full, '.git'));
            if (gitMarker.isFile()) continue;
          } catch {
            // No .git file — not a submodule root, proceed normally
          }
          results.push(full);
          await traverse(full);
        }
      }
    }
    await traverse(dirPath);
    return results;
  }

  /**
   * Execute Step 5 directory structure validation
   * @param {string} projectRoot - Project root directory
   * @param {Object} _options - Execution options (reserved)
   * @returns {Promise<Object>} Analysis result
   */
  async execute(projectRoot, options = {}) {
    try {
      logger.step('Step 5: Directory Structure Validation');

      // Phase 1: Organize misplaced documentation
      const { misplacedDocs, organizedDocs } = await this.organizeMisplacedDocs(projectRoot);

      logger.info(`Found ${misplacedDocs} misplaced documentation file(s)`);
      if (organizedDocs > 0) {
        logger.info(`Organized ${organizedDocs} file(s)`);
      }

      // Phase 2: Validate directory structure
      const structureResults = await this.validateStructure(projectRoot);

      logger.info(`Structure validation: ${structureResults.issues.length} issue(s)`);

      // Phase 3: Generate report
      const totalDirs = await this.countDirectories(projectRoot);
      const results = {
        totalDirs,
        misplacedDocs,
        organizedDocs,
        ...structureResults,
      };

      const report = formatDirectoryReport(results);
      await this.backlog.saveStepSummary(5, 'Directory Structure Validation', report);

      // Phase AI: AI-powered directory structure analysis
      const aiAvailable = await this.aiHelper.initialize();
      if (aiAvailable) {
        await this.aiCache.init();
        let prompt;
        const parsedYaml = await loadResolvedAiHelpers(this.fileOps).catch(() => null);
        try {
          const language = options.language || (await this.detectLanguage(projectRoot));
          const issueLines =
            structureResults.issues?.length > 0
              ? structureResults.issues
                  .slice(0, 20)
                  .map((i) => `- [${i.type}] ${i.directory}: ${i.message}`)
                  .join('\n')
              : 'No issues detected';
          const dirTree =
            (structureResults.existingDirs ?? []).length > 0
              ? structureResults.existingDirs.slice(0, 50).join('\n')
              : 'none';
          prompt = buildYamlStepPrompt(parsedYaml, 'step4_directory_prompt', {
            project_name: projectRoot,
            project_description: options.projectDescription || '',
            primary_language: language,
            dir_count: String(results.totalDirs ?? 0),
            change_scope: options.scope || '',
            modified_count: String(options.modifiedCount ?? 0),
            missing_critical: String(structureResults.missingCritical ?? 0),
            undocumented_dirs: String(structureResults.undocumented ?? 0),
            doc_structure_mismatch: String(structureResults.docMismatch ?? 0),
            structure_issues_content: issueLines,
            dir_tree: dirTree,
            language_specific_directory_standards: '',
          });
        } catch {
          /* fallback to generic prompt */
        }
        if (!prompt) {
          const role = `You are an expert in software project structure and organization.`;
          const task = `Analyze these directory structure validation results for project at "${projectRoot}" and provide recommendations:
- Directories found: ${(structureResults.existingDirs ?? []).join(', ') || 'none'}
- Total directories: ${results.totalDirs ?? 0}
- Misplaced docs: ${results.misplacedDocs ?? 0}
- Organized docs: ${results.organizedDocs ?? 0}
- Missing critical dirs: ${structureResults.missingCritical ?? 0}
- Issues: ${structureResults.issues?.length ?? 0}`;
          const approach = `Provide concise recommendations to improve the project directory structure. Be specific.`;
          prompt = injectProjectContext(buildStructuredPrompt({ role, task, approach }), {});
        }
        const dirHashEntries = (structureResults.existingDirs ?? []).map((d) => `dir:${d}`);
        const aiResult = await this.aiCache.withFileChangeGuard('step_05', dirHashEntries, () =>
          this.aiHelper.executeRequest(prompt, { persona: 'architecture_reviewer' })
        );
        const aiContent = aiResult?.content ?? '';

        // Supplementary: requirements-engineering perspective on architecture
        let requirementsContent = '';
        try {
          // Detect existing requirements documents so the AI doesn't hallucinate a gap
          const REQUIREMENTS_PATTERN =
            /requirements|[-_]frs\b|FRS\b|[-_]brd\b|BRD\b|[-_]srs\b|SRS\b|func.spec|FUNC.SPEC|user.stor/i;
          let requirementsDocsCount = 0;
          try {
            const docsDir = path.join(projectRoot, 'docs');
            const docsEntries = await fs.readdir(docsDir).catch(() => []);
            requirementsDocsCount = docsEntries.filter((f) => REQUIREMENTS_PATTERN.test(f)).length;
          } catch {
            /* docs dir may not exist */
          }

          const reqPrompt = buildYamlStepPrompt(parsedYaml, 'requirements_engineer_prompt', {
            project_name: projectRoot,
            project_description: options?.projectDescription ?? '',
            primary_language:
              options?.primaryLanguage ??
              options?.language ??
              (await this.detectLanguage(projectRoot)),
            source_files: (structureResults.existingDirs ?? []).join(', '),
            requirements_docs_count: String(requirementsDocsCount),
            stakeholder_count: '1',
          });
          if (reqPrompt) {
            const reqResult = await this.aiCache.withFileChangeGuard(
              'step_05_req',
              dirHashEntries,
              () => this.aiHelper.executeRequest(reqPrompt, { persona: 'architecture_reviewer' })
            );
            requirementsContent = reqResult?.content ?? '';
          }
        } catch {
          /* optional supplementary analysis */
        }

        if (aiContent || requirementsContent) {
          const sections = [`${report}\n\n---\n\n## AI Recommendations\n\n${aiContent}`];
          if (requirementsContent) {
            sections.push(`\n\n## Requirements Engineering Analysis\n\n${requirementsContent}`);
          }
          await this.backlog.saveStepSummary(
            5,
            'Directory Structure Validation',
            sections.join('')
          );
        }
      } else {
        logger.info('AI helper not available - skipping AI analysis');
      }

      if (structureResults.missingCritical > 0) {
        logger.error(`Critical: ${structureResults.missingCritical} critical directories missing!`);
      } else if (structureResults.issues.length === 0 && misplacedDocs === 0) {
        logger.success('Step 5 completed - directory structure is well-organized');
      } else {
        logger.warn(`Step 5 completed - ${structureResults.issues.length} issue(s) found`);
      }

      return {
        success: true,
        ...results,
      };
    } catch (error) {
      logger.error(`Step 5 failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Organize misplaced documentation files
   * @param {string} projectRoot - Project root directory
   * @returns {Promise<Object>} Organization results
   */
  async organizeMisplacedDocs(projectRoot) {
    try {
      // Find markdown files in project root
      const allRootFiles = await this.fileOps.listDirectory(projectRoot);
      const rootFiles = allRootFiles
        .filter((f) => f.endsWith('.md'))
        .map((f) => path.relative(projectRoot, f));

      // Filter out allowed files
      const misplaced = rootFiles.filter((file) => !shouldStayInRoot(path.basename(file)));

      if (misplaced.length === 0) {
        return { misplacedDocs: 0, organizedDocs: 0 };
      }

      // Dry-run mode: don't actually move files
      // In real implementation, this would move files to appropriate categories
      // For now, just categorize them
      const categorized = misplaced.map((file) => ({
        file,
        category: categorizeMisplacedDoc(path.basename(file)),
        targetDir: getTargetDir(categorizeMisplacedDoc(path.basename(file))),
      }));

      return {
        misplacedDocs: misplaced.length,
        organizedDocs: 0, // Would be non-zero if we actually moved files
        categorized,
      };
    } catch {
      return { misplacedDocs: 0, organizedDocs: 0 };
    }
  }

  /**
   * Validate directory structure
   * @param {string} projectRoot - Project root directory
   * @returns {Promise<Object>} Validation results
   */
  async validateStructure(projectRoot) {
    try {
      // Get existing directories
      const allDirsAbsolute = await this._listDirsRecursive(projectRoot);
      const allDirs = allDirsAbsolute.map((d) => path.relative(projectRoot, d));

      const existingDirs = allDirs.filter((dir) => shouldIncludeDir(dir));

      // Get critical directories from config
      let criticalDirs = [];
      try {
        const config = await this.config.load(projectRoot);
        criticalDirs = extractCriticalDirs(config);
      } catch {
        // No config, use defaults
        criticalDirs = getDefaultCriticalDirs(existingDirs);
      }

      // Get documentation contents
      const docContents = [];
      const docFiles = ['README.md', '.github/copilot-instructions.md'];

      for (const docFile of docFiles) {
        try {
          const fullPath = path.join(projectRoot, docFile);
          const content = await this.fileOps.readFile(fullPath);
          docContents.push(content);
        } catch {
          // File doesn't exist, skip
        }
      }

      // Validate structure
      const validation = validateDirectoryStructure({
        existingDirs,
        criticalDirs,
        docContents,
      });

      return {
        issues: validation.issues,
        missingCritical: validation.missingCritical,
        undocumented: validation.undocumented,
        docMismatch: validation.docMismatch,
        existingDirs,
      };
    } catch (error) {
      logger.error(`Structure validation failed: ${error.message}`);
      return {
        issues: [],
        missingCritical: 0,
        undocumented: 0,
        docMismatch: 0,
      };
    }
  }

  /**
   * Count directories in project
   * @param {string} projectRoot - Project root directory
   * @returns {Promise<number>} Directory count
   */
  async countDirectories(projectRoot) {
    try {
      const allDirsAbsolute = await this._listDirsRecursive(projectRoot);
      const dirs = allDirsAbsolute.map((d) => path.relative(projectRoot, d));

      return dirs.filter((dir) => shouldIncludeDir(dir)).length;
    } catch {
      return 0;
    }
  }

  async detectLanguage(projectRoot) {
    return getPrimaryLanguage(this.techStack, projectRoot, 'javascript');
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default Step5DirectoryAnalyzer;
