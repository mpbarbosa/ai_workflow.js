/**
 * Step 15: UX Analysis
 * Analyzes UI code for bugs, usability issues, and accessibility problems.
 * Only runs for projects with UI components (web apps, SPAs, static sites).
 * @module steps/step_15_ux_analysis
 * @version 2.0.0
 */

import path from 'path';
import { FileOperations } from '../lib/file_operations.js';
import { Backlog } from '../lib/backlog.js';
import { STEP_KIND } from './step_contract.js';
import { Logger } from '../core/logger.js';
import { colors } from '../core/colors.js';
import { AiHelper } from '../lib/ai_helpers.js';
import {
  loadResolvedAiHelpers,
  AI_PROJECT_KINDS_PATH,
  buildYamlStepPrompt,
  buildProjectKindPrompt,
} from '../lib/ai_prompt_builder.js';
import yaml from 'js-yaml';

// Constants
export const UI_PROJECT_TYPES = Object.freeze({
  reactSpa: 'react_spa',
  vueSpa: 'vue_spa',
  clientSpa: 'client_spa',
  staticWebsite: 'static_website',
  webApplication: 'web_application',
  documentationSite: 'documentation_site',
});

/**
 * Project kinds that are definitively non-web (libraries, CLI tools, APIs).
 * Their .tsx/.jsx files are utility or terminal-UI code, not browser UI.
 * The fallback framework-file probe must never override this exclusion.
 */
export const NON_UI_PROJECT_KINDS = Object.freeze([
  'typescript_library',
  'nodejs_library',
  'configuration_library',
  'typescript_sdk',
  'npm_package',
  'cli_tool',
  'nodejs_api',
  'nodejs_cli',
  'shell_script_automation',
]);

export const UI_FILE_PATTERNS = Object.freeze({
  react: ['.jsx', '.tsx'],
  vue: ['.vue'],
  html: ['.html'],
  css: ['.css', '.scss', '.sass', '.less'],
  svelte: ['.svelte'],
});

export const EXCLUDED_DIRECTORIES = Object.freeze([
  'node_modules',
  '.git',
  'dist',
  'build',
  'coverage',
  '.next',
  'out',
  'venv',
  '.venv',
  '__pycache__',
  'vendor',
  '.cache',
  'tmp',
  // Generated documentation / report output directories
  'docs/api',
  'api-generated',
  'typedoc',
  'api-docs',
  'jsdoc',
  'lcov-report',
]);

/**
 * Extensions that indicate a real UI framework is present.
 * Deliberately excludes .html and .css — those extensions alone are too
 * common in generated documentation (TypeDoc, JSDoc, coverage reports) to
 * reliably signal an interactive UI in a non-UI project.
 */
export const FRAMEWORK_EXTENSIONS = Object.freeze(['.jsx', '.tsx', '.vue', '.svelte']);

export const UX_CATEGORIES = Object.freeze({
  accessibility: 'accessibility',
  usability: 'usability',
  visual: 'visual',
  performance: 'performance',
  componentArchitecture: 'component-architecture',
});

export const SEVERITY_LEVELS = Object.freeze({
  critical: 'critical',
  warning: 'warning',
  suggestion: 'suggestion',
});

/**
 * Project kinds that may contain terminal UI (Ink/blessed) components.
 * These are a subset of NON_UI_PROJECT_KINDS and receive TUI-specific analysis
 * rather than a hard skip, provided TUI dependencies are detected.
 */
export const TUI_PROJECT_KINDS = Object.freeze(['nodejs_cli', 'cli_tool']);

/**
 * Dependency names that indicate the project uses a terminal UI framework.
 * Checked against both `dependencies` and `devDependencies` in package.json.
 */
export const TUI_DEPENDENCY_PATTERNS = Object.freeze([
  'ink',
  'pajussara_tui_comp',
  'blessed',
  'neo-blessed',
  'react-blessed',
  '@inkjs/ui',
  'terminal-kit',
  'charm',
  'clui',
  'cliffy',
]);

// ============================================================================
// PURE FUNCTIONS - UI Detection
// ============================================================================

/**
 * Check if project type is eligible for UX analysis
 * @param {string} projectType - Project kind (e.g., 'react_spa', 'nodejs_api')
 * @returns {boolean} - True if UX analysis should run
 */
export function shouldRunUxAnalysis(projectType) {
  const normalizedType = projectType.replace(/-/g, '_');
  return Object.values(UI_PROJECT_TYPES).includes(normalizedType);
}

/**
 * Check if the project kind is in the TUI-candidate set.
 * A positive result means the project *may* be a TUI project — it still needs
 * `hasTuiDependencies()` confirmation before TUI analysis runs.
 * @pure
 * @param {string} projectType - Project kind identifier
 * @returns {boolean} True when the kind could host terminal UI components
 */
export function isTuiProjectKind(projectType) {
  return TUI_PROJECT_KINDS.includes(projectType);
}

/**
 * Scan a parsed package.json object for known terminal UI framework dependencies.
 * Checks both `dependencies` and `devDependencies`.
 * @pure
 * @param {Object|null} pkg - Parsed package.json content, or null if unavailable
 * @returns {boolean} True when at least one TUI dependency is present
 */
export function hasTuiDependencies(pkg) {
  if (!pkg || typeof pkg !== 'object') return false;
  const all = { ...pkg.dependencies, ...pkg.devDependencies };
  return TUI_DEPENDENCY_PATTERNS.some((dep) => Object.prototype.hasOwnProperty.call(all, dep));
}

/**
 * Filter files to only terminal UI source files (.tsx and .jsx).
 * Excludes generated/build directories via `shouldExcludeFile`.
 * Used for TUI projects where web UI files (.html/.css) are irrelevant.
 * @param {Array<string>} files - List of file paths
 * @returns {Array<string>} Files with .tsx or .jsx extension only
 */
export function filterTuiFiles(files) {
  return files.filter(
    (file) => !shouldExcludeFile(file) && (file.endsWith('.tsx') || file.endsWith('.jsx'))
  );
}

/**
 * Determine if file path should be excluded from analysis
 * @param {string} filePath - File path to check
 * @returns {boolean} - True if file should be excluded
 */
export function shouldExcludeFile(filePath) {
  return EXCLUDED_DIRECTORIES.some(
    (dir) => filePath.includes(`/${dir}/`) || filePath.startsWith(`${dir}/`)
  );
}

/**
 * Determine if file is a UI file based on extension
 * @param {string} filePath - File path to check
 * @returns {boolean} - True if file is a UI file
 */
export function isUiFile(filePath) {
  const allExtensions = Object.values(UI_FILE_PATTERNS).flat();
  return allExtensions.some((ext) => filePath.endsWith(ext));
}

/**
 * Categorize UI file by type
 * @param {string} filePath - File path
 * @returns {string|null} - UI type (e.g., 'react', 'vue', 'html') or null
 */
export function categorizeUiFile(filePath) {
  for (const [type, extensions] of Object.entries(UI_FILE_PATTERNS)) {
    if (extensions.some((ext) => filePath.endsWith(ext))) {
      return type;
    }
  }
  return null;
}

/**
 * Filter files to only include UI files
 * @param {Array<string>} files - List of file paths
 * @returns {Array<string>} - Filtered list of UI files
 */
export function filterUiFiles(files) {
  return files.filter((file) => !shouldExcludeFile(file) && isUiFile(file));
}

/**
 * Filter files to only those containing a UI framework (React/Vue/Svelte).
 *
 * Used by the non-UI-project fallback probe: a library or backend project is
 * only considered to have an embedded UI when it contains framework-specific
 * source files. Plain .html/.css files are excluded because they are commonly
 * produced by documentation generators (TypeDoc, JSDoc) or coverage tools and
 * should not trigger a UX analysis pass.
 *
 * @param {Array<string>} files - List of file paths
 * @returns {Array<string>} - Files with framework-specific extensions (.jsx, .tsx, .vue, .svelte)
 */
export function filterFrameworkUiFiles(files) {
  return files.filter(
    (file) => !shouldExcludeFile(file) && FRAMEWORK_EXTENSIONS.some((ext) => file.endsWith(ext))
  );
}

/**
 * Group UI files by category
 * @param {Array<string>} files - List of UI file paths
 * @returns {Object} - Files grouped by type { react: [...], vue: [...], ... }
 */
export function groupUiFilesByType(files) {
  const groups = Object.keys(UI_FILE_PATTERNS).reduce((acc, type) => {
    acc[type] = [];
    return acc;
  }, {});

  for (const file of files) {
    const type = categorizeUiFile(file);
    if (type && groups[type]) {
      groups[type].push(file);
    }
  }

  return groups;
}

/**
 * Select the most informative UI files for content sampling.
 * Prioritizes HTML files (highest accessibility/usability signal) then CSS.
 * @param {Array<string>} uiFiles - All discovered UI file paths
 * @param {Object} fileGroups - UI files grouped by type from groupUiFilesByType
 * @param {number} [maxFiles=10] - Maximum number of files to select
 * @returns {Array<string>} - Selected file paths in priority order
 */
export function selectKeyFiles(uiFiles, fileGroups, maxFiles = 10) {
  const htmlFiles = fileGroups.html || [];
  const cssFiles = fileGroups.css || [];
  // Reserve ~30% of slots for CSS so it's always represented, even when HTML count is large.
  const cssReserved = Math.min(cssFiles.length, Math.max(1, Math.floor(maxFiles * 0.3)));
  const htmlAvail = maxFiles - cssReserved;
  // If HTML underflows its budget, give the unused slots to CSS.
  const cssAvail = cssReserved + Math.max(0, htmlAvail - htmlFiles.length);
  const selected = [...htmlFiles.slice(0, htmlAvail), ...cssFiles.slice(0, cssAvail)];
  return selected.slice(0, maxFiles);
}

// ============================================================================
// PURE FUNCTIONS - UX Analysis Prompt Building
// ============================================================================

/**
 * Build UX analysis prompt for AI
 * @param {Object} context - Analysis context
 * @param {string} context.projectType - Project kind
 * @param {number} context.fileCount - Number of UI files
 * @param {Array<string>} context.fileSample - Sample of UI file paths
 * @param {Object} context.fileGroups - UI files grouped by type
 * @param {Array<{file: string, content: string}>} [context.fileContents] - Sampled file contents
 * @returns {string} - Formatted prompt for AI analysis
 */
export function buildUxAnalysisPrompt(context) {
  const { projectType, fileCount, fileSample, fileGroups, fileContents } = context;

  // Build file summary
  const fileSummary = fileSample.map((f) => `  - ${f}`).join('\n');
  const moreFiles =
    fileCount > fileSample.length ? `\n  ... and ${fileCount - fileSample.length} more files` : '';

  // Build file type breakdown
  const typeBreakdown = Object.entries(fileGroups)
    .filter(([_type, files]) => files.length > 0)
    .map(([type, files]) => `  - ${type}: ${files.length} files`)
    .join('\n');

  // Build file content section (grounding data for the AI)
  const contentSection =
    fileContents && fileContents.length > 0
      ? `\n**Sample File Contents** (actual source code — base your analysis on this):\n\n${fileContents
          .map(({ file, content }) => `\`\`\`\n// ${file}\n${content}\n\`\`\``)
          .join('\n\n')}\n`
      : '';

  return `**Role**: You are a senior UX/UI Designer and Frontend Specialist with expertise in user experience design, accessibility standards (WCAG 2.1 AA/AAA), responsive design, and modern frontend frameworks.

**Task**: Analyze the UI code for usability issues, accessibility violations, visual design inconsistencies, and provide actionable improvement recommendations.

**Project Context**:
- Project Type: ${projectType}
- UI Files Found: ${fileCount}
- File Type Breakdown:
${typeBreakdown}

**Sample Files**:
${fileSummary}${moreFiles}
${contentSection}
**Your Analysis Should Cover**:
1. **Accessibility Issues** (WCAG 2.1 violations)
   - Missing ARIA labels and semantic HTML
   - Color contrast problems
   - Keyboard navigation issues
   - Screen reader compatibility

2. **Usability Problems**
   - Confusing navigation or information architecture
   - Unclear call-to-action buttons
   - Missing or poor error messages
   - Inconsistent interaction patterns
   - Poor mobile experience

3. **Visual Design Issues**
   - Inconsistent spacing and alignment
   - Typography problems
   - Color scheme inconsistencies
   - Layout and responsive design issues

4. **Component Architecture**
   - Reusability opportunities
   - Design system consistency
   - Component complexity

5. **Performance & Perception**
   - Loading states and user feedback
   - Animation and transition issues
   - Perceived performance problems

**Approach**:
- Identify accessibility issues systematically
- Check usability problems with user-centric perspective
- Review visual consistency across components
- Assess interaction patterns for intuitiveness
- Prioritize improvements by user impact

**Output Format**:
Provide your analysis in the following markdown format:

# UX Analysis Report

## Executive Summary
[Brief overview of findings with counts: X critical issues, Y warnings, Z recommendations]

## Critical Issues
[Issues that severely impact user experience - must fix]

### Issue 1: [Title]
- **Category**: [Accessibility/Usability/Visual/Performance]
- **Severity**: Critical
- **Location**: [File path and line number if possible]
- **Description**: [What's wrong]
- **Impact**: [How it affects users]
- **Recommendation**: [How to fix it]

## Warnings
[Issues that should be addressed but aren't blocking]

## Improvement Suggestions
[Nice-to-have enhancements ranked by impact]

## Next Development Steps
[Prioritized list of recommended actions]

1. **Quick Wins** (1-2 hours): [List]
2. **Short Term** (1 week): [List]
3. **Long Term** (1 month+): [List]

## Design Patterns to Consider
[Modern UX patterns that could improve the experience]

---

Please analyze the UI files and provide your detailed assessment.`;
}

/**
 * Calculate UX issue severity score
 * @param {Object} issue - UX issue object
 * @param {string} issue.category - Issue category
 * @param {string} issue.severity - Issue severity level
 * @returns {number} - Numeric severity score (0-10)
 */
export function calculateSeverityScore(issue) {
  const severityScores = {
    critical: 10,
    warning: 5,
    suggestion: 2,
  };

  const categoryMultipliers = {
    accessibility: 1.5, // Accessibility is highest priority
    usability: 1.3,
    performance: 1.2,
    visual: 1.0,
    'component-architecture': 1.0,
  };

  const baseScore = severityScores[issue.severity] || 0;
  const multiplier = categoryMultipliers[issue.category] || 1.0;

  return Math.round(baseScore * multiplier);
}

/**
 * Parse UX analysis result and extract issues
 * @param {string} analysisText - Markdown analysis text
 * @returns {Object} - Parsed analysis { criticalCount, warningCount, suggestionCount }
 */
export function parseUxAnalysisResult(analysisText) {
  const criticalCount = (analysisText.match(/\*\*Severity\*\*:\s*Critical/gi) || []).length;
  const warningCount = (analysisText.match(/\*\*Severity\*\*:\s*Warning/gi) || []).length;

  // Count headings under "Improvement Suggestions" section
  // Match from "## Improvement Suggestions" to either next "##" or end
  const suggestionSection = analysisText.match(/## Improvement Suggestions[\s\S]*?(?=\n##\s|$)/i);
  const suggestionCount = suggestionSection
    ? (suggestionSection[0].match(/^### /gm) || []).length
    : 0;

  return {
    criticalCount,
    warningCount,
    suggestionCount,
    totalIssues: criticalCount + warningCount + suggestionCount,
  };
}

/**
 * Format UX analysis report
 * @param {Object} data - Analysis data
 * @param {string} data.projectType - Project type
 * @param {number} data.fileCount - Number of files analyzed
 * @param {string} data.analysisResult - AI analysis markdown text
 * @param {Object} data.issueCounts - Issue counts (criticalCount, warningCount, etc.)
 * @param {string} data.timestamp - ISO timestamp
 * @returns {string} - Formatted markdown report
 */
export function formatUxAnalysisReport(data) {
  const { projectType, fileCount, analysisResult, issueCounts, timestamp } = data;

  return `# Step 15: UX Analysis Report

**Status**: ✅ Completed
**Date**: ${timestamp}
**Project Type**: ${projectType}
**UI Files Analyzed**: ${fileCount}

## Issue Summary

- **Critical Issues**: ${issueCounts.criticalCount}
- **Warnings**: ${issueCounts.warningCount}
- **Improvement Suggestions**: ${issueCounts.suggestionCount}
- **Total Findings**: ${issueCounts.totalIssues}

---

${analysisResult}

---

## Analysis Metadata

- **Step Version**: 2.0.0
- **Analysis Method**: AI-Powered
- **Target Directory**: Project Root
- **UI Files Scanned**: ${fileCount}

## Next Steps

1. Review the issues identified above
2. Prioritize fixes based on severity and user impact
3. Create GitHub issues for tracking improvements
4. Update UI components with recommended changes
5. Re-run Step 15 to validate improvements
`;
}

// ============================================================================
// STEP15UXANALYSIS - Impure Wrapper Class
// ============================================================================

/**
 * Step 15: UX Analysis
 * Analyzes UI components for usability, accessibility, and design issues.
 */
export class Step15UxAnalysis {
  static stepKind = STEP_KIND.CONTEXT;

  /**
   * Create a new Step 15 analyzer
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
    this.aiHelper =
      options.aiHelper ||
      new AiHelper({ promptsDir: options.promptsDir || options.configManager?.promptsDir });
  }

  /**
   * Execute UX analysis step
   * @param {Object} context - Execution context
   * @param {string} context.projectType - Project kind
   * @returns {Promise<Object>} - Execution result { success, stats, ... }
   */
  async execute(context = {}) {
    const startTime = Date.now();

    // Use projectRoot from context if provided (overrides constructor default)
    if (context.projectRoot) {
      this.projectRoot = context.projectRoot;
    }

    try {
      this.logger.step('Step 15: UX Analysis');
      if (this.dryRun) {
        this.logger.info('[DRY RUN] UX analysis preview:');
        this.logger.info('- Would detect UI files in project');
        this.logger.info('- Would perform AI-powered UX analysis');
        this.logger.info('- Would generate accessibility and usability report');
        return {
          success: true,
          dryRun: true,
          message: 'UX analysis dry run completed',
        };
      }

      const projectType = context.projectType || 'generic';

      // Check if UX analysis should run.
      // Fallback: even when the detected project_kind doesn't imply a UI, the project
      // might contain Vue/React/Svelte files (e.g. location_based_service with Vue 3 SPA).
      let confirmedTui = false;
      if (!shouldRunUxAnalysis(projectType)) {
        // Exception: TUI-candidate kinds (nodejs_cli, cli_tool) may contain Ink/React terminal
        // components. Check for TUI dependencies before deciding whether to skip.
        if (NON_UI_PROJECT_KINDS.includes(projectType)) {
          if (isTuiProjectKind(projectType)) {
            // Probe package.json for TUI framework deps before committing to TUI analysis.
            let pkg = null;
            try {
              const pkgContent = await this.fileOps.readFile(
                path.join(this.projectRoot, 'package.json')
              );
              pkg = JSON.parse(pkgContent);
            } catch {
              /* package.json absent or unparseable — treat as no TUI deps */
            }
            if (hasTuiDependencies(pkg)) {
              // Fall through to TUI-specific analysis below.
              confirmedTui = true;
              this.logger.info(
                `Step 15: TUI dependencies detected in '${projectType}' project — running terminal UI analysis`
              );
            } else {
              this.logger.info(
                `Step 15: UX Analysis skipped — project kind '${projectType}' has no TUI framework dependencies`
              );
              await this.backlog.saveStepSummary(
                '15',
                'UX_Analysis',
                `Skipped: Non-web project kind '${projectType}' with no TUI deps`,
                '⏭️'
              );
              return {
                success: true,
                skipped: true,
                reason: `non-web project kind: ${projectType}`,
              };
            }
          } else {
            this.logger.info(
              `Step 15: UX Analysis skipped — project kind '${projectType}' is a non-web library/tool; .tsx/.jsx files are not browser UI`
            );
            await this.backlog.saveStepSummary(
              '15',
              'UX_Analysis',
              `Skipped: Non-web project kind '${projectType}'`,
              '⏭️'
            );
            return {
              success: true,
              skipped: true,
              reason: `non-web project kind: ${projectType}`,
            };
          }
        }

        // Probe for actual UI *framework* files before giving up.
        // TUI path already confirmed above — skip the web probe for TUI projects.
        // We intentionally use filterFrameworkUiFiles (not filterUiFiles) here:
        // plain .html/.css files alone are not sufficient evidence of an embedded
        // UI in a non-UI project — they are commonly generated by documentation
        // tools (TypeDoc, JSDoc) or coverage reporters and should not trigger a
        // UX analysis pass.
        if (!confirmedTui) {
          const probeFiles = await this.discoverFiles(this.projectRoot);
          const uiProbeFiles = filterFrameworkUiFiles(probeFiles);
          if (uiProbeFiles.length === 0) {
            this.logger.info(
              `Step 15: UX Analysis skipped - project type '${projectType}' has no UI components`
            );

            await this.backlog.saveStepSummary(
              '15',
              'UX_Analysis',
              `Skipped: No UI components for project type '${projectType}'`,
              '⏭️'
            );

            return {
              success: true,
              skipped: true,
              reason: 'project type not eligible',
            };
          }
          this.logger.info(
            `Step 15: project type '${projectType}' — but found ${uiProbeFiles.length} UI file(s); running UX analysis`
          );
        }
      }

      const isTui = confirmedTui || isTuiProjectKind(projectType);

      // Phase 1: Discover UI files
      this.logger.info(`${colors.blue}Phase 1:${colors.reset} Discovering UI files...`);
      const allFiles = await this.discoverFiles(this.projectRoot);
      // TUI projects use only .tsx/.jsx source files; web projects use all UI file types.
      const uiFiles = isTui ? filterTuiFiles(allFiles) : filterUiFiles(allFiles);

      if (uiFiles.length === 0) {
        this.logger.warn('No UI files found in project');

        await this.backlog.saveStepSummary('15', 'UX_Analysis', 'Skipped: No UI files found', '⏭️');

        return {
          success: true,
          skipped: true,
          reason: 'no UI files found',
        };
      }

      this.logger.success(`Found ${uiFiles.length} UI files`);

      // Phase 2: Group files, select key files, and read content for AI grounding.
      // TUI projects: read all .tsx/.jsx files (up to 20) directly — selectKeyFiles()
      // prioritises HTML/CSS which don't exist in a TUI project.
      const fileGroups = groupUiFilesByType(uiFiles);
      const fileSample = uiFiles.slice(0, 20);
      const keyFiles = isTui ? fileSample : selectKeyFiles(uiFiles, fileGroups);
      this.logger.info(
        `${colors.blue}Phase 2:${colors.reset} Reading ${keyFiles.length} key files for AI grounding...`
      );
      const fileContents = await this.readFilesSample(keyFiles, this.projectRoot);
      const analysisContext = {
        projectType,
        fileCount: uiFiles.length,
        fileSample,
        fileGroups,
        fileContents,
      };

      // Phase 3: Build UX analysis prompt.
      // TUI projects: use tui_ux_designer_prompt exclusively (terminal-native heuristics).
      //   The base buildUxAnalysisPrompt() embeds web/WCAG guidance and is intentionally
      //   skipped so it doesn't contaminate terminal UI analysis.
      // Web projects: use the existing ui_ux_designer_prompt + project-kind overlay.
      this.logger.info(`${colors.blue}Phase 3:${colors.reset} Building UX analysis prompt...`);
      let prompt;

      if (isTui) {
        // Build file-content block for grounding (tui_ux_designer_prompt has no {file_content_map})
        const fileBlock = Object.entries(fileContents)
          .map(([file, content]) => `### ${file}\n\`\`\`tsx\n${content}\n\`\`\``)
          .join('\n\n');

        try {
          const parsedYaml = await loadResolvedAiHelpers(this.fileOps);
          const tuiPrompt = buildYamlStepPrompt(parsedYaml, 'tui_ux_designer_prompt', {
            project_name: path.basename(this.projectRoot),
            project_description: context.projectDescription || context.description || '',
            project_kind: projectType,
            target_audience: context.targetAudience || 'Terminal application users',
            design_system_status: context.designSystemStatus || 'Ink/React TUI primitives',
            modified_count: String(context.modifiedFiles?.length ?? uiFiles.length),
          });
          if (tuiPrompt) {
            prompt = fileBlock
              ? `${tuiPrompt}\n\n---\n\n**Files to Review:**\n\n${fileBlock}`
              : tuiPrompt;
          }
        } catch {
          /* non-fatal */
        }
        // Fallback: minimal inline prompt when YAML is unavailable
        if (!prompt) {
          prompt = `Review the following terminal UI components for keyboard navigation, focus management, status clarity, and scroll UX.\n\n${fileBlock}`;
        }
      } else {
        prompt = buildUxAnalysisPrompt(analysisContext);
        // Enrich with YAML ui_ux_designer_prompt and project-kind ux_designer overlay
        try {
          const parsedYaml = await loadResolvedAiHelpers(this.fileOps);
          const uiUxPrompt = buildYamlStepPrompt(parsedYaml, 'ui_ux_designer_prompt', {
            project_name: path.basename(this.projectRoot),
            project_description: context.projectDescription || context.description || '',
            file_count: String(uiFiles.length),
            project_type: projectType,
            target_audience: context.targetAudience || 'Application developers',
            design_system_status: context.designSystemStatus || '',
            modified_count: String(context.modifiedFiles?.length ?? uiFiles.length),
          });
          if (uiUxPrompt) {
            let roleOverride = '';
            try {
              const pkYaml = await this.fileOps.readFile(AI_PROJECT_KINDS_PATH);
              const parsedPk = yaml.load(pkYaml);
              const pk = buildProjectKindPrompt(
                parsedPk,
                context?.projectType ?? 'default',
                'ux_designer'
              );
              if (pk?.role) roleOverride = pk.role;
            } catch {
              /* optional */
            }
            const prefix = roleOverride ? `[Project-Kind Role: ${roleOverride}]\n\n` : '';
            prompt = `${prefix}${uiUxPrompt}\n\n---\n\n${prompt}`;
          }
        } catch {
          /* non-fatal: use base prompt */
        }
      }

      // Phase 4: Initialize AI helper and perform analysis
      this.logger.info(
        `${colors.blue}Phase 4:${colors.reset} Performing AI-powered UX analysis...`
      );
      const aiAvailable = await this.aiHelper.initialize();
      if (!aiAvailable) {
        this.logger.warn('AI helper not available - skipping AI analysis');
        await this.backlog.saveStepSummary(
          '15',
          'UX_Analysis',
          `Found ${uiFiles.length} UI files but AI analysis unavailable`,
          '⚠️'
        );
        return {
          success: true,
          skipped: true,
          reason: 'AI helper not available',
          fileCount: uiFiles.length,
        };
      }
      const analysisResult = await this.performAnalysis(prompt);

      // Phase 5: Parse results
      const issueCounts = parseUxAnalysisResult(analysisResult);

      // Phase 5: Generate reports
      this.logger.info(`${colors.blue}Phase 5:${colors.reset} Generating UX analysis report...`);
      const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);

      const report = formatUxAnalysisReport({
        projectType,
        fileCount: uiFiles.length,
        analysisResult,
        issueCounts,
        timestamp,
      });

      await this.backlog.saveStepSummary('15', 'UX_Analysis', report, '✅');

      this.logger.success(`Step 15: UX Analysis completed`);
      this.logger.info(
        `Found ${issueCounts.criticalCount} critical, ${issueCounts.warningCount} warnings, ${issueCounts.suggestionCount} suggestions`
      );

      return {
        success: true,
        fileCount: uiFiles.length,
        fileGroups,
        issueCounts,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      this.logger.error(`Step 15 failed: ${error.message}`);

      await this.backlog.saveStepIssues('15', 'UX_Analysis', [
        {
          type: 'error',
          message: error.message,
          location: 'step_15_ux_analysis',
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
   * Read content from a sample of UI files for AI grounding.
   * Skips unreadable files silently. Truncates large files.
   * @param {Array<string>} files - Relative file paths to read
   * @param {string} rootPath - Absolute root directory
   * @param {number} [maxBytesPerFile=3072] - Max bytes to read per file (~100 lines)
   * @param {number} [maxTotalBytes=20480] - Max total bytes across all files
   * @returns {Promise<Array<{file: string, content: string}>>} - File path and content pairs
   */
  async readFilesSample(files, rootPath, maxBytesPerFile = 3072, maxTotalBytes = 20480) {
    const contents = [];
    let totalBytes = 0;
    for (const file of files) {
      if (totalBytes >= maxTotalBytes) break;
      try {
        const absPath = path.join(rootPath, file);
        let content = await this.fileOps.readFile(absPath);
        if (content.length > maxBytesPerFile) {
          content = content.slice(0, maxBytesPerFile) + '\n... (truncated)';
        }
        contents.push({ file, content });
        totalBytes += content.length;
      } catch {
        // skip unreadable files silently
      }
    }
    return contents;
  }

  /**
   * Discover all files in project (I/O operation)
   * @param {string} rootPath - Root directory to scan
   * @returns {Promise<Array<string>>} - List of file paths
   */
  async discoverFiles(rootPath) {
    const patterns = [
      '**/*.jsx',
      '**/*.tsx',
      '**/*.vue',
      '**/*.html',
      '**/*.css',
      '**/*.scss',
      '**/*.sass',
      '**/*.less',
      '**/*.svelte',
    ];

    const ignore = EXCLUDED_DIRECTORIES.map((d) => `**/${d}/**`);
    const allFiles = [];

    for (const pattern of patterns) {
      const found = await this.fileOps.glob(pattern, { cwd: rootPath, ignore });
      allFiles.push(...found);
    }

    return [...new Set(allFiles)];
  }

  /**
   * Perform AI-powered UX analysis using ux_analyst persona
   * @param {string} prompt - Analysis prompt for AI
   * @returns {Promise<string>} - AI analysis result (markdown)
   */
  async performAnalysis(prompt) {
    const response = await this.aiHelper.executeRequest(prompt, { persona: 'ux_analyst' });
    return response?.content ?? '';
  }
}
