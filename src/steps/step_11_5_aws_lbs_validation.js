/**
 * @fileoverview Step 11.5: AWS LBS Validation (v2.0.0)
 * @module steps/step_11_5_aws_lbs_validation
 *
 * Validates serverless AWS backends of the `aws_lbs_backend_setup` project kind.
 * Checks shell script best practices, Lambda function structure, and AWS
 * configuration schema. Skips automatically for all other project kinds.
 *
 * Architecture: v2.0.0 Referential Transparency
 * - Pure functions for all validation logic
 * - Impure wrapper class for file I/O and logging
 *
 * Slots between step_11_context and step_12_git_finalization so that git
 * finalization remains the final executed step.
 *
 * @version 2.0.0
 * @since 2026-02-21
 */

import path from 'path';
import fs from 'fs/promises';

import { STEP_KIND } from './step_contract.js';
import { logger } from '../core/logger.js';
import { FileOperations } from '../lib/file_operations.js';
import { Backlog } from '../lib/backlog.js';
import { AiCache } from '../lib/ai_cache.js';
import { buildYamlStepPrompt, loadResolvedAiHelpers } from '../lib/ai_prompt_builder.js';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Project kind this step targets. */
export const AWS_LBS_PROJECT_KIND = 'aws_lbs_backend_setup';

/** Shell script best-practice rules. */
export const SHELL_RULES = Object.freeze({
  SHEBANG: 'shebang',
  STRICT_MODE: 'strict_mode',
});

/** Required keys in aws-config.json (at least one set must be present). */
export const AWS_CONFIG_REQUIRED_KEY_SETS = Object.freeze([
  ['region'],
  ['stackName'],
  ['apiId'],
  ['mapName'],
]);

/** Directories excluded from Lambda function scanning. */
export const EXCLUDED_DIRS = Object.freeze(['node_modules', '.git', 'dist', 'build', 'coverage']);

// ============================================================================
// PURE FUNCTIONS - Project-Kind Gate
// ============================================================================

/**
 * Determine whether this step should run for the given project kind.
 * @pure
 * @param {string} projectKind - Project kind identifier
 * @returns {boolean} True if the step should run
 * @example
 * shouldRunAwsLbsValidation('aws_lbs_backend_setup'); // true
 * shouldRunAwsLbsValidation('nodejs_api');            // false
 */
export function shouldRunAwsLbsValidation(projectKind) {
  return typeof projectKind === 'string' && projectKind.trim() === AWS_LBS_PROJECT_KIND;
}

// ============================================================================
// PURE FUNCTIONS - Shell Script Detection & Analysis
// ============================================================================

/**
 * Filter shell scripts from a flat list of file paths.
 * @pure
 * @param {string[]} files - File paths (relative or absolute)
 * @returns {string[]} Paths ending in .sh or .bash
 */
export function detectShellScripts(files) {
  if (!Array.isArray(files)) return [];
  return files.filter((f) => typeof f === 'string' && /\.(sh|bash)$/.test(f));
}

/**
 * Check a single shell script's content for best-practice compliance.
 * @pure
 * @param {string} content - Raw file content
 * @param {string} [filePath=''] - Path used in issue messages
 * @returns {string[]} List of violation messages (empty = compliant)
 */
export function checkShellScriptBestPractices(content, filePath = '') {
  if (typeof content !== 'string') return [];
  const issues = [];
  const label = filePath ? ` (${filePath})` : '';

  // Rule 1: must start with a shebang
  const firstLine = content.split('\n')[0] || '';
  if (!firstLine.startsWith('#!')) {
    issues.push(`Missing shebang line${label}`);
  }

  // Rule 2: must contain `set -euo pipefail` (exact or partial)
  if (!/set\s+-[A-Za-z]*e[A-Za-z]*u[A-Za-z]*o\s+pipefail|set\s+-euo\s+pipefail/.test(content)) {
    issues.push(`Missing 'set -euo pipefail'${label}`);
  }

  return issues;
}

// ============================================================================
// PURE FUNCTIONS - Lambda Function Structure
// ============================================================================

/**
 * Identify Lambda handler paths from a flat file list.
 * Recognises paths matching `src/lambda/<function-name>/index.js`.
 * @pure
 * @param {string[]} files - File paths
 * @returns {string[]} Paths to Lambda index.js files
 */
export function detectLambdaFunctions(files) {
  if (!Array.isArray(files)) return [];
  return files.filter(
    (f) => typeof f === 'string' && /src[/\\]lambda[/\\][^/\\]+[/\\]index\.js$/.test(f)
  );
}

/**
 * Group file paths by Lambda function name.
 * @pure
 * @param {string[]} files - File paths inside src/lambda/
 * @returns {Object<string, string[]>} Map of functionName → file paths
 */
export function categorizeLambdaFiles(files) {
  if (!Array.isArray(files)) return {};
  const map = {};
  for (const f of files) {
    const match = f.match(/src[/\\]lambda[/\\]([^/\\]+)[/\\]/);
    if (match) {
      const fnName = match[1];
      if (!map[fnName]) map[fnName] = [];
      map[fnName].push(f);
    }
  }
  return map;
}

/**
 * Validate that each Lambda function directory has both index.js and package.json.
 * @pure
 * @param {Object<string, string[]>} functionMap - Output of categorizeLambdaFiles
 * @returns {Object} { valid: boolean, missingFiles: string[] }
 */
export function validateLambdaStructure(functionMap) {
  const missingFiles = [];

  for (const [fnName, files] of Object.entries(functionMap)) {
    const hasIndex = files.some((f) => f.endsWith('index.js'));
    const hasPkg = files.some((f) => f.endsWith('package.json'));

    if (!hasIndex) missingFiles.push(`src/lambda/${fnName}/index.js`);
    if (!hasPkg) missingFiles.push(`src/lambda/${fnName}/package.json`);
  }

  return { valid: missingFiles.length === 0, missingFiles };
}

// ============================================================================
// PURE FUNCTIONS - AWS Config Schema
// ============================================================================

/**
 * Validate that an aws-config.json object contains at least one recognised key.
 * @pure
 * @param {unknown} json - Parsed JSON value
 * @returns {Object} { valid: boolean, reason?: string }
 */
export function validateAwsConfigSchema(json) {
  if (json === null || typeof json !== 'object' || Array.isArray(json)) {
    return { valid: false, reason: 'aws-config.json must be a JSON object' };
  }

  const keys = Object.keys(json);
  const hasRequiredKey = AWS_CONFIG_REQUIRED_KEY_SETS.some((set) =>
    set.every((k) => keys.includes(k))
  );

  if (!hasRequiredKey) {
    return {
      valid: false,
      reason: `aws-config.json must contain at least one of: ${AWS_CONFIG_REQUIRED_KEY_SETS.map((s) => s.join('+')).join(', ')}`,
    };
  }

  return { valid: true };
}

// ============================================================================
// PURE FUNCTIONS - Reporting
// ============================================================================

/**
 * Build a concise validation summary object from raw results.
 * @pure
 * @param {Object} results - Raw validation results
 * @returns {Object} Summary with counts and overall status
 */
export function buildValidationSummary(results) {
  const {
    shellScripts = [],
    shellIssues = [],
    lambdaFunctions = [],
    lambdaStructureResult = { valid: true, missingFiles: [] },
    awsConfigValid = true,
    awsConfigReason = '',
  } = results;

  const totalIssues =
    shellIssues.length +
    (lambdaStructureResult.missingFiles?.length ?? 0) +
    (awsConfigValid ? 0 : 1);

  return {
    shellScriptCount: shellScripts.length,
    shellIssueCount: shellIssues.length,
    lambdaFunctionCount: lambdaFunctions.length,
    lambdaStructureValid: lambdaStructureResult.valid,
    awsConfigValid,
    awsConfigReason,
    totalIssues,
    passed: totalIssues === 0,
  };
}

/**
 * Format a human-readable Markdown report from validation results.
 * @pure
 * @param {Object} summary - Output of buildValidationSummary
 * @param {Object} details - Raw results for verbose sections
 * @returns {string} Markdown report content
 */
export function formatValidationReport(summary, details = {}) {
  const {
    shellScriptCount,
    shellIssueCount,
    lambdaFunctionCount,
    lambdaStructureValid,
    awsConfigValid,
    awsConfigReason,
    totalIssues,
    passed,
  } = summary;

  const { shellIssues = [], missingLambdaFiles = [] } = details;

  let report = `# AWS LBS Backend Validation Report\n\n`;
  report += `**Status:** ${passed ? '✅ Passed' : '🚨 Failed'}\n`;
  report += `**Total Issues:** ${totalIssues}\n\n`;

  // Shell scripts
  report += `## Shell Scripts\n\n`;
  report += `- **Scripts found:** ${shellScriptCount}\n`;
  report += `- **Best-practice issues:** ${shellIssueCount}\n`;
  if (shellIssues.length > 0) {
    report += `\n### Issues\n\n`;
    for (const issue of shellIssues) {
      report += `- ⚠️ ${issue}\n`;
    }
    report += '\n';
  } else if (shellScriptCount > 0) {
    report += `- ✅ All scripts have shebang and \`set -euo pipefail\`\n`;
  }
  report += '\n';

  // Lambda functions
  report += `## Lambda Functions\n\n`;
  report += `- **Functions found:** ${lambdaFunctionCount}\n`;
  report += `- **Structure valid:** ${lambdaStructureValid ? '✅ Yes' : '🚨 No'}\n`;
  if (missingLambdaFiles.length > 0) {
    report += `\n### Missing Files\n\n`;
    for (const f of missingLambdaFiles) {
      report += `- ❌ \`${f}\`\n`;
    }
    report += '\n';
  }
  report += '\n';

  // AWS config
  report += `## AWS Configuration\n\n`;
  report += `- **aws-config.json valid:** ${awsConfigValid ? '✅ Yes' : '🚨 No'}\n`;
  if (awsConfigReason) {
    report += `- **Reason:** ${awsConfigReason}\n`;
  }
  report += '\n';

  // Recommendations
  if (!passed) {
    report += `## 💡 Recommendations\n\n`;
    if (shellIssueCount > 0) {
      report += `1. Add \`#!/usr/bin/env bash\` shebang to every shell script\n`;
      report += `2. Add \`set -euo pipefail\` immediately after the shebang\n`;
    }
    if (!lambdaStructureValid) {
      report += `3. Ensure every Lambda function directory has \`index.js\` and \`package.json\`\n`;
    }
    if (!awsConfigValid) {
      report += `4. Add required keys (region, stackName, or apiId) to \`aws-config.json\`\n`;
    }
    report += '\n';
  }

  return report;
}

// ============================================================================
// IMPURE WRAPPER - Step11_5AwsLbsValidator Class
// ============================================================================

/**
 * Step 11.5: AWS LBS Validation Executor
 *
 * Validates `aws_lbs_backend_setup` projects; skips for all other project kinds.
 * Runs between step_11_context and step_12_git_finalization.
 *
 * @class
 */
export class Step11_5AwsLbsValidator {
  static stepKind = STEP_KIND.PROJECT;

  /**
   * @param {Object} [deps={}] - Injected dependencies
   * @param {Object} [deps.fileOps] - FileOperations instance
   * @param {Object} [deps.backlog] - Backlog instance
   * @param {Object} [deps.projectKindConfig] - ProjectKindConfigManager instance
   */
  constructor(deps = {}) {
    this.fileOps = deps.fileOps || new FileOperations();
    this.backlog = deps.backlog || new Backlog();
    // AI is opt-in: only enabled when aiHelper is explicitly injected
    this.aiHelper = deps.aiHelper || null;
    this.aiCache = deps.aiHelper ? deps.aiCache || new AiCache() : null;
    this.projectKindConfig = deps.projectKindConfig || null;
  }

  /**
   * Execute Step 11.5: AWS LBS Validation.
   * @async
   * @param {string} projectRoot - Absolute path to the project root
   * @param {Object} [options={}] - Execution options
   * @param {string} [options.projectKind] - Override detected project kind
   * @returns {Promise<Object>} Step result
   */
  async execute(projectRoot, options = {}) {
    try {
      logger.step('Step 11.5: AWS LBS Backend Validation');

      // ── Gate: only run for aws_lbs_backend_setup ──────────────────────────
      const projectKind =
        options.projectKind ??
        (this.projectKindConfig ? await this.projectKindConfig.getProjectKind() : null) ??
        '';
      if (!shouldRunAwsLbsValidation(projectKind)) {
        const msg = projectKind
          ? `Step 11.5 skipped — project kind '${projectKind}' is not aws_lbs_backend_setup`
          : `Step 11.5 skipped — no project kind provided`;
        logger.info(msg);
        return { success: true, skipped: true, reason: msg };
      }

      logger.info(`Validating aws_lbs_backend_setup project at: ${projectRoot}`);

      // ── Discover all project files ─────────────────────────────────────────
      const allFiles = await this._listProjectFiles(projectRoot);

      // ── Shell script validation ────────────────────────────────────────────
      const shellScripts = detectShellScripts(allFiles);
      logger.info(`Found ${shellScripts.length} shell script(s)`);

      const shellIssues = [];
      for (const scriptPath of shellScripts) {
        try {
          const absPath = path.resolve(projectRoot, scriptPath);
          const content = await fs.readFile(absPath, 'utf8');
          const issues = checkShellScriptBestPractices(content, scriptPath);
          shellIssues.push(...issues);
        } catch {
          // File unreadable — skip
        }
      }

      if (shellIssues.length > 0) {
        logger.warn(`Shell script issues: ${shellIssues.length}`);
      } else {
        logger.success('All shell scripts pass best-practice checks');
      }

      // ── Lambda function structure validation ───────────────────────────────
      const lambdaFunctions = detectLambdaFunctions(allFiles);
      const functionMap = categorizeLambdaFiles(allFiles);
      const lambdaStructureResult = validateLambdaStructure(functionMap);
      logger.info(`Found ${lambdaFunctions.length} Lambda handler(s)`);

      if (!lambdaStructureResult.valid) {
        logger.warn(
          `Lambda structure issues: ${lambdaStructureResult.missingFiles.length} missing file(s)`
        );
      } else if (lambdaFunctions.length > 0) {
        logger.success('All Lambda functions have index.js and package.json');
      }

      // ── AWS config validation ──────────────────────────────────────────────
      let awsConfigValid = false;
      let awsConfigReason = 'aws-config.json not found';

      for (const candidate of [
        path.join(projectRoot, 'aws-config.json'),
        path.join(projectRoot, 'src', 'aws-config.json'),
      ]) {
        try {
          const raw = await fs.readFile(candidate, 'utf8');
          const parsed = JSON.parse(raw);
          const check = validateAwsConfigSchema(parsed);
          awsConfigValid = check.valid;
          awsConfigReason = check.reason ?? '';
          break;
        } catch {
          // Try next candidate
        }
      }

      if (awsConfigValid) {
        logger.success('aws-config.json schema is valid');
      } else {
        logger.warn(`aws-config.json issue: ${awsConfigReason}`);
      }

      // ── Build report ───────────────────────────────────────────────────────
      const rawResults = {
        shellScripts,
        shellIssues,
        lambdaFunctions,
        lambdaStructureResult,
        awsConfigValid,
        awsConfigReason,
      };

      const summary = buildValidationSummary(rawResults);
      const report = formatValidationReport(summary, {
        shellIssues,
        missingLambdaFiles: lambdaStructureResult.missingFiles,
      });

      await this.backlog.saveStepSummary('11_5', 'AWS_LBS_Validation', report);

      // AI-powered architectural review using aws_cloud_architect_prompt (opt-in)
      try {
        if (this.aiHelper) {
          const aiAvailable = await this.aiHelper.initialize();
          if (aiAvailable) {
            await this.aiCache.init();
            const parsedYaml = await loadResolvedAiHelpers(this.fileOps);
            const archPrompt = buildYamlStepPrompt(parsedYaml, 'aws_cloud_architect_prompt', {
              project_name: projectRoot,
              shell_script_count: String(shellScripts.length),
              lambda_function_count: String(lambdaFunctions.length),
              shell_issues_count: String(shellIssues.length),
              aws_config_valid: String(awsConfigValid),
              total_issues: String(summary.totalIssues),
            });
            if (archPrompt) {
              const archKey = `step_11_5|${projectRoot}|${summary.totalIssues}`;
              const archResult = await this.aiCache.withCache(archKey, archKey, () =>
                this.aiHelper.executeRequest(archPrompt, { persona: 'devops_engineer' })
              );
              const archContent = archResult?.content ?? '';
              if (archContent) {
                const enrichedReport = `${report}\n\n---\n\n## AWS Architecture Review\n\n${archContent}`;
                await this.backlog.saveStepSummary('11_5', 'AWS_LBS_Validation', enrichedReport);
              }
            }
          }
        }
      } catch {
        /* AI analysis is optional */
      }

      if (summary.passed) {
        logger.success('Step 11.5 passed — AWS LBS backend is well-structured');
      } else {
        logger.warn(`Step 11.5 completed with ${summary.totalIssues} issue(s)`);
      }

      return {
        success: summary.totalIssues === 0 || shellIssues.length === 0,
        skipped: false,
        shellScripts,
        shellIssues,
        lambdaFunctions,
        lambdaStructureResult,
        awsConfigValid,
        summary,
        report,
      };
    } catch (error) {
      logger.error(`Step 11.5 failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Return step metadata.
   * @returns {Object} Step metadata
   */
  getMetadata() {
    return {
      id: '11_5',
      name: 'AWS LBS Validation',
      description:
        'Validate aws_lbs_backend_setup projects: shell script best practices, Lambda structure, AWS config schema',
      category: 'validation',
      estimatedDuration: 20,
      canSkip: true,
      dependencies: ['step_11_context'],
    };
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  /**
   * Recursively list all files under projectRoot, excluding common noise dirs.
   * @private
   * @param {string} dir - Directory to scan
   * @param {string} [base=''] - Relative base path for output
   * @returns {Promise<string[]>} Relative file paths
   */
  async _listProjectFiles(dir, base = '') {
    const results = [];
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return results;
    }

    for (const entry of entries) {
      if (EXCLUDED_DIRS.includes(entry.name)) continue;
      const rel = base ? `${base}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        const sub = await this._listProjectFiles(path.join(dir, entry.name), rel);
        results.push(...sub);
      } else {
        results.push(rel);
      }
    }
    return results;
  }
}

export default Step11_5AwsLbsValidator;
