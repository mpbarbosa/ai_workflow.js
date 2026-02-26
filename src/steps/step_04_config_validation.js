/**
 * Step 4: Configuration Validation
 * @version 2.0.0
 * @description Validate configuration files for syntax, security, and best practices
 * @module steps/step_04_config_validation
 * Part of: AI Workflow Automation (Phase 9)
 */

import path from 'path';
import { STEP_KIND } from './step_contract.js';
import logger from '../core/logger.js';
import { FileOperations } from '../lib/file_operations.js';
import { Backlog } from '../lib/backlog.js';
import { GitAutomation } from '../lib/git_automation.js';
import { AiHelper } from '../lib/ai_helpers.js';
import { AiCache } from '../lib/ai_cache.js';
import {
  buildStructuredPrompt,
  injectProjectContext,
  buildYamlStepPrompt,
  AI_HELPERS_PATH,
} from '../lib/ai_prompt_builder.js';
import yaml from 'js-yaml';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Directories to exclude from configuration file discovery (applied to both
 * the git-modified-files path and the glob fallback).
 */
export const EXCLUDE_DIRS = ['node_modules', '.git', 'dist', 'build', 'coverage', '.ai_cache'];

/**
 * Configuration file patterns
 */
export const CONFIG_PATTERNS = {
  json: /\.(json|jsonc)$/,
  yaml: /\.(ya?ml)$/,
  toml: /\.toml$/,
  ini: /\.ini$/,
  env: /^\.env(\.\w+)?$/,
  docker: /^(Dockerfile|\.dockerignore|docker-compose.*\.ya?ml)$/,
  ci: /\.(github\/workflows\/.*\.ya?ml|\.circleci\/config\.yml|\.gitlab-ci\.yml|Jenkinsfile)$/,
  editor: /^(\.editorconfig|\.nvmrc|\.node-version|\.mdlrc)$/,
  git: /^\.gitignore$/,
  make: /^Makefile$/,
};

/**
 * Secret patterns to detect
 */
export const SECRET_PATTERNS = [
  { name: 'AWS Key', pattern: /AKIA[0-9A-Z]{16}/ },
  { name: 'API Key', pattern: /(api[_-]?key|apikey)[\s:=]\s*["']?([a-zA-Z0-9_-]{20,})/i },
  { name: 'Private Key', pattern: /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name: 'OAuth Token', pattern: /(oauth|token)[\s:=]\s*["']?([a-zA-Z0-9_-]{30,})/i },
  { name: 'Password', pattern: /(password|passwd|pwd)[\s:=]\s*["']?([^\s"']{8,})/i },
  { name: 'Secret Key', pattern: /(secret[_-]?key|secretkey)[\s:=]\s*["']?([a-zA-Z0-9_-]{20,})/i },
];

/**
 * Issue types
 */
export const CONFIG_ISSUE_TYPE = {
  SYNTAX_ERROR: 'syntax_error',
  SECURITY_RISK: 'security_risk',
  INVALID_VALUE: 'invalid_value',
  MISSING_REQUIRED: 'missing_required',
};

// ============================================================================
// PURE FUNCTIONS - File Classification
// ============================================================================

/**
 * Check if file is a configuration file
 * @pure
 * @param {string} filePath - File path to check
 * @returns {boolean} True if configuration file
 */
export function isConfigFile(filePath) {
  const fileName = filePath.split('/').pop();

  return Object.values(CONFIG_PATTERNS).some((pattern) => {
    if (pattern instanceof RegExp) {
      return pattern.test(fileName) || pattern.test(filePath);
    }
    return false;
  });
}

/**
 * Get configuration file type
 * @pure
 * @param {string} filePath - File path
 * @returns {string} Configuration type (json, yaml, etc.)
 */
export function getConfigType(filePath) {
  const fileName = filePath.split('/').pop();

  // Check most specific patterns first
  const priorityOrder = [
    'ci',
    'docker',
    'editor',
    'git',
    'make',
    'env',
    'toml',
    'ini',
    'yaml',
    'json',
  ];

  for (const type of priorityOrder) {
    const pattern = CONFIG_PATTERNS[type];
    if (pattern && (pattern.test(fileName) || pattern.test(filePath))) {
      return type;
    }
  }

  return 'unknown';
}

// ============================================================================
// PURE FUNCTIONS - Syntax Validation
// ============================================================================

/**
 * Validate JSON syntax
 * @pure
 * @param {string} content - JSON content
 * @returns {Object} Validation result
 */
export function validateJsonSyntax(content) {
  try {
    JSON.parse(content);
    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: error.message,
      line: error.lineNumber,
      column: error.columnNumber,
    };
  }
}

/**
 * Validate YAML syntax (basic check)
 * @pure
 * @param {string} content - YAML content
 * @returns {Object} Validation result
 */
export function validateYamlSyntax(content) {
  const lines = content.split('\n');
  const issues = [];
  let insideBlockScalar = false;
  let blockScalarIndent = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detect block scalar indicators (| or >) at end of a key's value
    const blockScalarMatch = line.match(/^(\s*)[^#\s][^:]*:\s*[|>][-+]?\s*$/);
    if (blockScalarMatch) {
      insideBlockScalar = true;
      blockScalarIndent = blockScalarMatch[1].length;
      continue;
    }

    // Exit block scalar when we return to base indentation level
    if (insideBlockScalar) {
      const indent = line.match(/^(\s*)/)[0].length;
      const isEmpty = line.trim() === '';
      if (!isEmpty && indent <= blockScalarIndent) {
        insideBlockScalar = false;
        blockScalarIndent = -1;
      } else {
        // Content inside block scalar — skip indentation check
        continue;
      }
    }

    // Check for tabs (YAML doesn't allow tabs)
    if (line.includes('\t')) {
      issues.push({
        line: i + 1,
        message: 'YAML does not allow tabs for indentation',
      });
    }

    // Check for inconsistent indentation (YAML keys only, not block scalar content)
    const indent = line.match(/^(\s*)/)[0].length;
    if (indent > 0 && indent % 2 !== 0) {
      issues.push({
        line: i + 1,
        message: 'YAML indentation should be in multiples of 2',
      });
    }
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

/**
 * Validate configuration syntax based on type
 * @pure
 * @param {string} content - File content
 * @param {string} type - Config type (json, yaml, etc.)
 * @returns {Object} Validation result
 */
export function validateConfigSyntax(content, type) {
  switch (type) {
    case 'json':
      return validateJsonSyntax(content);
    case 'yaml':
      return validateYamlSyntax(content);
    case 'toml':
    case 'ini':
    case 'env':
    case 'docker':
    case 'ci':
      // Basic validation for other types
      return { valid: true, note: 'Basic validation only' };
    default:
      return { valid: true, note: 'No validation available' };
  }
}

// ============================================================================
// PURE FUNCTIONS - Security Scanning
// ============================================================================

/**
 * Scan content for potential secrets
 * @pure
 * @param {string} content - File content
 * @param {string} filePath - File path for context
 * @returns {Object[]} Array of security findings
 */
export function scanForSecrets(content, filePath) {
  const findings = [];
  const lines = content.split('\n');

  // Skip .env.example files (they're meant to have placeholder secrets)
  if (filePath.includes('.env.example') || filePath.includes('.env.template')) {
    return findings;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    for (const { name, pattern } of SECRET_PATTERNS) {
      if (pattern.test(line)) {
        findings.push({
          type: CONFIG_ISSUE_TYPE.SECURITY_RISK,
          secretType: name,
          line: i + 1,
          file: filePath,
          preview: line.substring(0, 50) + (line.length > 50 ? '...' : ''),
        });
      }
    }
  }

  return findings;
}

/**
 * Check for common configuration mistakes
 * @pure
 * @param {string} content - File content
 * @param {string} type - Config type
 * @returns {Object[]} Array of issues
 */
export function checkConfigBestPractices(content, type) {
  const issues = [];

  if (type === 'json') {
    // Check for comments in JSON (not allowed)
    if (content.includes('//') || content.match(/\/\*[\s\S]*?\*\//)) {
      issues.push({
        type: CONFIG_ISSUE_TYPE.SYNTAX_ERROR,
        message: 'JSON does not support comments',
      });
    }

    // Check for trailing commas
    if (content.match(/,\s*[}\]]/)) {
      issues.push({
        type: CONFIG_ISSUE_TYPE.SYNTAX_ERROR,
        message: 'JSON does not allow trailing commas',
      });
    }
  }

  if (type === 'yaml') {
    // Check for yes/no boolean values (deprecated)
    if (content.match(/:\s*(yes|no)\s*$/m)) {
      issues.push({
        type: CONFIG_ISSUE_TYPE.INVALID_VALUE,
        message: 'Use true/false instead of yes/no for booleans in YAML',
      });
    }
  }

  return issues;
}

// ============================================================================
// PURE FUNCTIONS - Reporting
// ============================================================================

/**
 * Format configuration validation report
 * @pure
 * @param {Object} results - Validation results
 * @returns {string} Formatted markdown content
 */
export function formatConfigReport(results) {
  const lines = [];

  lines.push('## Step 4: Configuration Validation\n');

  // Summary
  lines.push('### Summary');
  lines.push(`- **Files checked**: ${results.filesChecked}`);
  lines.push(`- **Syntax errors**: ${results.syntaxErrors.length}`);
  lines.push(`- **Security findings**: ${results.securityFindings.length}`);
  lines.push(`- **Best practice issues**: ${results.bestPracticeIssues.length}\n`);

  // Status
  const totalIssues = results.syntaxErrors.length + results.securityFindings.length;
  if (totalIssues === 0) {
    lines.push('✅ **Status**: All configuration files valid\n');
  } else {
    lines.push('⚠️ **Status**: Issues found - review required\n');
  }

  // Syntax errors
  if (results.syntaxErrors.length > 0) {
    lines.push('### Syntax Errors');
    results.syntaxErrors.slice(0, 10).forEach((error) => {
      lines.push(`- **${error.file}** (line ${error.line || 'unknown'}): ${error.error}`);
    });
    if (results.syntaxErrors.length > 10) {
      lines.push(`\n*... and ${results.syntaxErrors.length - 10} more*`);
    }
    lines.push('');
  }

  // Security findings
  if (results.securityFindings.length > 0) {
    lines.push('### Security Findings');
    results.securityFindings.slice(0, 10).forEach((finding) => {
      lines.push(`- **${finding.file}** (line ${finding.line}): ${finding.secretType} detected`);
      lines.push(`  \`${finding.preview}\``);
    });
    if (results.securityFindings.length > 10) {
      lines.push(`\n*... and ${results.securityFindings.length - 10} more*`);
    }
    lines.push('');
  }

  // Best practices
  if (results.bestPracticeIssues.length > 0) {
    lines.push('### Best Practice Issues');
    results.bestPracticeIssues.slice(0, 5).forEach((issue) => {
      lines.push(`- ${issue.message}`);
    });
    lines.push('');
  }

  return lines.join('\n');
}

// ============================================================================
// STEP 4 ANALYZER - Impure Wrapper
// ============================================================================

/**
 * Step 4 analyzer for configuration validation
 */
export class Step4ConfigAnalyzer {
  static stepKind = STEP_KIND.PROJECT;

  constructor(options = {}) {
    this.fileOps = options.fileOps || new FileOperations();
    this.backlog = options.backlog || new Backlog();
    this.gitOps = options.gitOps || new GitAutomation();
    this.aiHelper = options.aiHelper || new AiHelper();
    this.aiCache = options.aiCache || new AiCache();
  }

  /**
   * Execute Step 4 configuration validation
   * @param {string} projectRoot - Project root directory
   * @param {Object} _options - Execution options (reserved)
   * @returns {Promise<Object>} Analysis result
   */
  async execute(projectRoot, _options = {}) {
    try {
      logger.step('Step 4: Configuration Validation');

      // Phase 1: Discover configuration files
      const configFiles = await this.discoverConfigFiles(projectRoot);
      if (configFiles.length === 0) {
        logger.info('No configuration files found - skipping validation');
        return { success: true, skipped: true, reason: 'no_config_files' };
      }

      logger.info(`Found ${configFiles.length} configuration file(s)`);

      // Phase 2: Validate syntax
      const syntaxErrors = [];
      for (const file of configFiles) {
        const errors = await this.validateFileSyntax(file);
        syntaxErrors.push(...errors);
      }

      logger.info(`Syntax validation: ${syntaxErrors.length} error(s)`);
      for (const err of syntaxErrors) {
        logger.warn(`  ${err.file} (line ${err.line ?? 'unknown'}): ${err.error ?? err.message}`);
      }

      // Phase 3: Scan for secrets
      const securityFindings = [];
      for (const file of configFiles) {
        const findings = await this.scanFileForSecrets(file);
        securityFindings.push(...findings);
      }

      logger.info(`Security scan: ${securityFindings.length} finding(s)`);

      // Phase 4: Check best practices
      const bestPracticeIssues = [];
      for (const file of configFiles) {
        const issues = await this.checkFileBestPractices(file);
        bestPracticeIssues.push(...issues);
      }

      logger.info(`Best practices: ${bestPracticeIssues.length} issue(s)`);

      // Phase 5: Generate report
      const results = {
        filesChecked: configFiles.length,
        syntaxErrors,
        securityFindings,
        bestPracticeIssues,
      };

      const report = formatConfigReport(results);
      await this.backlog.saveStepSummary(4, 'Configuration Validation', report);

      // Phase AI: AI-powered configuration analysis
      const aiAvailable = await this.aiHelper.initialize();
      const totalIssues = syntaxErrors.length + securityFindings.length;
      if (aiAvailable) {
        await this.aiCache.init();
        let prompt;
        try {
          const yamlContent = await this.fileOps.readFile(AI_HELPERS_PATH);
          const parsedYaml = yaml.load(yamlContent);
          prompt = buildYamlStepPrompt(parsedYaml, 'configuration_specialist_prompt', {
            files_checked: String(results.filesChecked ?? 0),
            syntax_errors: String(syntaxErrors.length),
            security_findings: String(securityFindings.length),
            best_practice_issues: String(bestPracticeIssues.length),
            total_issues: String(totalIssues),
          });
        } catch {
          /* fallback to generic prompt */
        }
        if (!prompt) {
          const role = `You are a configuration validation specialist and security expert.`;
          const task = `Analyze these configuration validation results and provide recommendations:
- Files validated: ${results.filesChecked ?? 0}
- Syntax errors: ${syntaxErrors.length}
- Security findings: ${securityFindings.length}
- Best practice issues: ${bestPracticeIssues.length}
- Total issues: ${totalIssues}`;
          const approach = `Provide concise, actionable remediation steps for the most critical issues found.`;
          prompt = injectProjectContext(buildStructuredPrompt({ role, task, approach }), {});
        }
        const cacheKey = `step_04|${results.filesChecked ?? 0}|${totalIssues}`;
        await this.aiCache.withCache(prompt, cacheKey, () =>
          this.aiHelper.executeRequest(prompt, { persona: 'security_expert' })
        );
      } else {
        logger.warn('AI helper not available - skipping AI analysis');
      }

      if (totalIssues === 0) {
        logger.success('Step 4 completed - no issues found');
      } else {
        logger.warn(`Step 4 completed - ${totalIssues} issue(s) found`);
      }

      return {
        success: true,
        ...results,
      };
    } catch (error) {
      logger.error(`Step 4 failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Discover configuration files in project
   * @param {string} projectRoot - Project root directory
   * @returns {Promise<string[]>} Array of config file paths
   */
  async discoverConfigFiles(projectRoot) {
    try {
      const changedFiles = await this.gitOps.getModifiedFiles();
      const configChanged = changedFiles
        .filter(
          (file) => isConfigFile(file) && !EXCLUDE_DIRS.some((dir) => file.split('/').includes(dir))
        )
        .map((file) => (path.isAbsolute(file) ? file : path.resolve(projectRoot, file)));
      if (configChanged.length > 0) {
        return configChanged;
      }
    } catch {
      // Git unavailable; fall through to glob scan
    }

    // Fallback: scan common config files (clean working tree or git error)
    const patterns = ['**/*.json', '**/*.yaml', '**/*.yml', '**/.env*', '**/Dockerfile'];

    const files = [];
    for (const pattern of patterns) {
      try {
        const found = await this.fileOps.glob(pattern, {
          cwd: projectRoot,
          ignore: EXCLUDE_DIRS.map((dir) => `**/${dir}/**`),
        });
        files.push(
          ...found
            .filter((f) => isConfigFile(f))
            .map((f) => (path.isAbsolute(f) ? f : path.resolve(projectRoot, f)))
        );
      } catch {
        // Pattern not found, continue
      }
    }

    return [...new Set(files)];
  }

  /**
   * Validate file syntax
   * @param {string} filePath - File path
   * @returns {Promise<Object[]>} Syntax errors
   */
  async validateFileSyntax(filePath) {
    try {
      const content = await this.fileOps.readFile(filePath);
      const type = getConfigType(filePath);
      const result = validateConfigSyntax(content, type);

      if (!result.valid) {
        if (result.error) {
          return [{ file: filePath, type, ...result }];
        }
        if (result.issues) {
          return result.issues.map((issue) => ({ file: filePath, type, ...issue }));
        }
      }

      return [];
    } catch (error) {
      logger.warn(`  Cannot read ${filePath}: ${error.message}`);
      return []; // Read failure is not a syntax error
    }
  }

  /**
   * Scan file for secrets
   * @param {string} filePath - File path
   * @returns {Promise<Object[]>} Security findings
   */
  async scanFileForSecrets(filePath) {
    try {
      const content = await this.fileOps.readFile(filePath);
      return scanForSecrets(content, filePath);
    } catch {
      return [];
    }
  }

  /**
   * Check file best practices
   * @param {string} filePath - File path
   * @returns {Promise<Object[]>} Best practice issues
   */
  async checkFileBestPractices(filePath) {
    try {
      const content = await this.fileOps.readFile(filePath);
      const type = getConfigType(filePath);
      return checkConfigBestPractices(content, type);
    } catch {
      return [];
    }
  }
}

export default Step4ConfigAnalyzer;
