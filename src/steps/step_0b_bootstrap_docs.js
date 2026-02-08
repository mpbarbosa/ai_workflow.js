/**
 * Step 0b: Documentation Gap Analysis & Generation
 * Identifies missing documentation and generates it using AI.
 * Runs early in workflow to bootstrap documentation for new projects.
 * @module steps/step_0b_bootstrap_docs
 * @version 2.0.0
 */

import { FileOperations } from '../lib/file_operations.js';
import { Backlog } from '../lib/backlog.js';
import { Logger } from '../core/logger.js';
import { colors } from '../core/colors.js';

// Constants
export const DOC_TYPES = Object.freeze({
  readme: 'README.md',
  changelog: 'CHANGELOG.md',
  contributing: 'CONTRIBUTING.md',
  license: 'LICENSE',
  api: 'docs/API.md',
  architecture: 'docs/ARCHITECTURE.md',
  gettingStarted: 'docs/GETTING_STARTED.md',
});

export const DOC_THRESHOLDS = Object.freeze({
  minReadmeSize: 500, // bytes
  minDocsCount: 2, // minimum docs files
  sufficientDocsCount: 5, // skip bootstrap if this many exist
});

export const SOURCE_EXTENSIONS = Object.freeze([
  '.js',
  '.ts',
  '.py',
  '.sh',
  '.go',
  '.java',
  '.rs',
  '.rb',
]);

// ============================================================================
// PURE FUNCTIONS - Documentation Gap Analysis
// ============================================================================

/**
 * Check if project needs documentation bootstrapping
 * @param {Object} stats - Project statistics
 * @param {number} stats.docCount - Number of documentation files
 * @param {number} stats.readmeSize - Size of README.md in bytes
 * @param {boolean} stats.hasChangelog - Whether CHANGELOG exists
 * @param {boolean} stats.hasDocsDir - Whether docs/ directory exists
 * @returns {boolean} - True if bootstrap needed
 */
export function shouldBootstrapDocs(stats) {
  const { docCount, readmeSize, hasChangelog, hasDocsDir } = stats;

  // Need bootstrap if README is missing or too small
  if (readmeSize < DOC_THRESHOLDS.minReadmeSize) {
    return true;
  }

  // Need bootstrap if docs/ directory missing or too few docs
  if (!hasDocsDir || docCount < DOC_THRESHOLDS.minDocsCount) {
    return true;
  }

  // Need bootstrap if CHANGELOG is missing
  if (!hasChangelog) {
    return true;
  }

  return false;
}

/**
 * Identify missing documentation files
 * @param {Array<string>} existingFiles - List of existing file paths
 * @returns {Array<string>} - List of missing doc file paths
 */
export function identifyMissingDocs(existingFiles) {
  const existingSet = new Set(existingFiles.map((f) => f.toLowerCase()));
  const missing = [];

  for (const [, path] of Object.entries(DOC_TYPES)) {
    if (!existingSet.has(path.toLowerCase())) {
      missing.push(path);
    }
  }

  return missing;
}

/**
 * Categorize documentation gaps by priority
 * @param {Array<string>} missingDocs - List of missing doc paths
 * @returns {Object} - Categorized docs { critical: [], important: [], optional: [] }
 */
export function categorizeMissingDocs(missingDocs) {
  const critical = [];
  const important = [];
  const optional = [];

  for (const doc of missingDocs) {
    if (doc === DOC_TYPES.readme) {
      critical.push(doc);
    } else if (
      doc === DOC_TYPES.changelog ||
      doc === DOC_TYPES.contributing ||
      doc === DOC_TYPES.license
    ) {
      important.push(doc);
    } else {
      optional.push(doc);
    }
  }

  return { critical, important, optional };
}

/**
 * Filter files by source code extensions
 * @param {Array<string>} files - List of file paths
 * @returns {Array<string>} - Filtered source files
 */
export function filterSourceFiles(files) {
  return files.filter((file) => SOURCE_EXTENSIONS.some((ext) => file.endsWith(ext)));
}

/**
 * Count files by extension
 * @param {Array<string>} files - List of file paths
 * @returns {Object} - Count by extension { '.js': 10, '.py': 5, ... }
 */
export function countFilesByExtension(files) {
  return files.reduce((acc, file) => {
    const ext = file.substring(file.lastIndexOf('.'));
    acc[ext] = (acc[ext] || 0) + 1;
    return acc;
  }, {});
}

/**
 * Determine primary programming language
 * @param {Object} extensionCounts - File counts by extension
 * @returns {string} - Primary language (e.g., 'JavaScript', 'Python')
 */
export function determinePrimaryLanguage(extensionCounts) {
  const languageMap = {
    '.js': 'JavaScript',
    '.ts': 'TypeScript',
    '.py': 'Python',
    '.sh': 'Shell',
    '.go': 'Go',
    '.java': 'Java',
    '.rs': 'Rust',
    '.rb': 'Ruby',
  };

  let maxCount = 0;
  let primaryExt = '.js';

  for (const [ext, count] of Object.entries(extensionCounts)) {
    if (count > maxCount) {
      maxCount = count;
      primaryExt = ext;
    }
  }

  return languageMap[primaryExt] || 'Unknown';
}

// ============================================================================
// PURE FUNCTIONS - Prompt Building
// ============================================================================

/**
 * Build technical writer prompt for AI
 * @param {Object} context - Project context
 * @param {string} context.projectName - Project name
 * @param {string} context.projectDescription - Brief description
 * @param {string} context.primaryLanguage - Primary programming language
 * @param {number} context.docCount - Current documentation count
 * @param {number} context.sourceCount - Source file count
 * @param {Array<string>} context.missingDocs - List of missing docs
 * @returns {string} - Formatted AI prompt
 */
export function buildTechnicalWriterPrompt(context) {
  const { projectName, projectDescription, primaryLanguage, docCount, sourceCount, missingDocs } =
    context;

  const missingList = missingDocs.map((d) => `  - ${d}`).join('\n');

  return `You are a Senior Technical Writer with expertise in software documentation, API documentation, and developer experience.

**Project Context**:
- **Project Name**: ${projectName}
- **Description**: ${projectDescription}
- **Primary Language**: ${primaryLanguage}
- **Source Files**: ${sourceCount}
- **Existing Documentation**: ${docCount} files

**Documentation Gaps Identified**:
${missingList}

**Your Task**:
Analyze the project structure and existing code to generate comprehensive documentation for the missing files listed above.

**Documentation Standards**:

1. **README.md** should include:
   - Project title and description
   - Installation instructions
   - Quick start guide
   - Basic usage examples
   - Link to full documentation
   - License and contribution info

2. **CHANGELOG.md** should follow:
   - Keep a Changelog format (keepachangelog.com)
   - Semantic versioning (semver.org)
   - Sections: Added, Changed, Deprecated, Removed, Fixed, Security

3. **CONTRIBUTING.md** should cover:
   - Code of conduct
   - How to report bugs
   - How to suggest features
   - Development setup
   - Pull request process
   - Coding standards

4. **API Documentation** should include:
   - Module overview
   - Function/method signatures
   - Parameters and return types
   - Usage examples
   - Error handling

5. **Architecture Documentation** should describe:
   - System overview
   - Component structure
   - Data flow
   - Key design decisions
   - Technology stack

**Output Format**:
For each missing file, provide:

## [Filename]

### Priority: [Critical/Important/Optional]

### Content:
\`\`\`markdown
[Complete markdown content ready to save]
\`\`\`

### Reasoning:
[Brief explanation of why this documentation is important]

---

Please generate documentation for the identified gaps, prioritizing critical files first.`;
}

/**
 * Format gap analysis report
 * @param {Object} data - Analysis data
 * @param {Object} data.stats - Project statistics
 * @param {Object} data.categorized - Categorized missing docs
 * @param {Array<string>} data.missingDocs - All missing docs
 * @param {string} data.timestamp - ISO timestamp
 * @returns {string} - Formatted markdown report
 */
export function formatGapAnalysisReport(data) {
  const { stats, categorized, missingDocs, timestamp } = data;

  const criticalList = categorized.critical.map((d) => `- ${d}`).join('\n') || '- None';
  const importantList = categorized.important.map((d) => `- ${d}`).join('\n') || '- None';
  const optionalList = categorized.optional.map((d) => `- ${d}`).join('\n') || '- None';

  return `# Step 0b: Documentation Gap Analysis Report

**Status**: ✅ Completed
**Date**: ${timestamp}

## Project Statistics

- **Documentation Files**: ${stats.docCount}
- **Source Files**: ${stats.sourceCount}
- **README Size**: ${stats.readmeSize} bytes
- **Has CHANGELOG**: ${stats.hasChangelog ? 'Yes' : 'No'}
- **Has docs/ Directory**: ${stats.hasDocsDir ? 'Yes' : 'No'}

## Gap Analysis Results

**Total Missing Documentation**: ${missingDocs.length} files

### Critical (Must Have)
${criticalList}

### Important (Should Have)
${importantList}

### Optional (Nice to Have)
${optionalList}

## Recommendations

${missingDocs.length > 0 ? '1. Generate missing documentation using AI assistance\n2. Review and customize generated content\n3. Establish documentation update process\n4. Add documentation guidelines to CONTRIBUTING.md' : '✅ Project has sufficient documentation coverage'}

---

## Analysis Metadata

- **Step Version**: 2.0.0
- **Analysis Method**: File-based gap detection
- **Bootstrap Recommended**: ${missingDocs.length > 0 ? 'Yes' : 'No'}

## Next Steps

${missingDocs.length > 0 ? '1. Run Step 0b with AI to generate missing documentation\n2. Review and edit generated content\n3. Commit new documentation files\n4. Re-run workflow to validate completeness' : '1. Continue with Step 1 (documentation validation)\n2. Maintain documentation as project evolves\n3. Update CHANGELOG.md with releases'}
`;
}

// ============================================================================
// STEP0BBOOTSTRAPDOCS - Impure Wrapper Class
// ============================================================================

/**
 * Step 0b: Documentation Gap Analysis & Generation
 * Identifies missing documentation and bootstraps new projects.
 */
export class Step0bBootstrapDocs {
  /**
   * Create a new Step 0b analyzer
   * @param {Object} options - Configuration options
   * @param {Object} options.fileOps - File operations instance
   * @param {Object} options.backlog - Backlog instance
   * @param {Object} options.logger - Logger instance
   * @param {boolean} options.dryRun - Whether to run in dry-run mode
   * @param {string} options.projectRoot - Project root directory
   */
  constructor(options = {}) {
    this.fileOps = options.fileOps || new FileOperations();
    this.backlog = options.backlog || new Backlog();
    this.logger = options.logger || new Logger();
    this.dryRun = options.dryRun || false;
    this.projectRoot = options.projectRoot || process.cwd();
  }

  /**
   * Execute documentation gap analysis
   * @param {Object} context - Execution context
   * @param {string} context.projectName - Project name
   * @param {string} context.projectDescription - Project description
   * @returns {Promise<Object>} - Execution result { success, missingDocs, ... }
   */
  async execute(_context = {}) {
    const startTime = Date.now();

    try {
      if (this.dryRun) {
        this.logger.info('[DRY RUN] Documentation gap analysis preview:');
        this.logger.info('- Would scan for existing documentation files');
        this.logger.info('- Would identify missing critical documentation');
        this.logger.info('- Would generate gap analysis report');
        return {
          success: true,
          dryRun: true,
          message: 'Documentation gap analysis dry run completed',
        };
      }

      // Phase 1: Gather project statistics
      this.logger.info(`${colors.blue}Phase 1:${colors.reset} Gathering project statistics...`);
      const stats = await this.gatherProjectStats();

      // Phase 2: Check if bootstrap needed
      if (stats.docCount >= DOC_THRESHOLDS.sufficientDocsCount) {
        this.logger.info(
          `Step 0b: Sufficient documentation exists (${stats.docCount} files) - skipping bootstrap`
        );

        await this.backlog.saveStepSummary(
          '0b',
          'Bootstrap_Docs',
          `Skipped: Project has ${stats.docCount} documentation files (sufficient)`,
          '⏭️'
        );

        return {
          success: true,
          skipped: true,
          reason: 'sufficient documentation exists',
          docCount: stats.docCount,
        };
      }

      const needsBootstrap = shouldBootstrapDocs(stats);

      if (!needsBootstrap) {
        this.logger.info('Step 0b: Documentation coverage adequate - no bootstrap needed');

        await this.backlog.saveStepSummary(
          '0b',
          'Bootstrap_Docs',
          'Skipped: Documentation coverage adequate',
          '⏭️'
        );

        return {
          success: true,
          skipped: true,
          reason: 'documentation coverage adequate',
        };
      }

      // Phase 3: Identify missing documentation
      this.logger.info(
        `${colors.blue}Phase 2:${colors.reset} Identifying missing documentation...`
      );
      const existingFiles = await this.listExistingDocs();
      const missingDocs = identifyMissingDocs(existingFiles);
      const categorized = categorizeMissingDocs(missingDocs);

      this.logger.warn(
        `Found ${missingDocs.length} missing documentation files (${categorized.critical.length} critical)`
      );

      // Phase 4: Generate report
      this.logger.info(`${colors.blue}Phase 3:${colors.reset} Generating gap analysis report...`);
      const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);

      const report = formatGapAnalysisReport({
        stats,
        categorized,
        missingDocs,
        timestamp,
      });

      await this.backlog.saveStepSummary('0b', 'Bootstrap_Docs', report, '✅');

      this.logger.success('Step 0b: Documentation gap analysis completed');
      this.logger.info(
        `Critical: ${categorized.critical.length}, Important: ${categorized.important.length}, Optional: ${categorized.optional.length}`
      );

      return {
        success: true,
        missingDocs,
        categorized,
        stats,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      this.logger.error(`Step 0b failed: ${error.message}`);

      await this.backlog.saveStepIssues('0b', 'Bootstrap_Docs', [
        {
          type: 'error',
          message: error.message,
          location: 'step_0b_bootstrap_docs',
        },
      ]);

      return {
        success: false,
        error: error.message,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Gather project statistics (I/O operation)
   * @returns {Promise<Object>} - Project stats
   */
  async gatherProjectStats() {
    // In real implementation, would scan filesystem
    // For now, return mock stats
    return {
      docCount: 2,
      sourceCount: 50,
      readmeSize: 1200,
      hasChangelog: false,
      hasDocsDir: true,
    };
  }

  /**
   * List existing documentation files (I/O operation)
   * @returns {Promise<Array<string>>} - List of existing doc paths
   */
  async listExistingDocs() {
    // In real implementation, would scan filesystem
    // For now, return mock list
    return ['README.md', 'docs/API.md'];
  }
}
