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
import { TechStackDetector } from '../lib/tech_stack.js';
import {
  buildStructuredPrompt,
  injectProjectContext,
  buildYamlStepPrompt,
  buildAlternativesDirective,
  parseAlternatives,
  loadResolvedAiHelpers,
} from '../lib/ai_prompt_builder.js';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Directories to exclude from configuration file discovery (applied to both
 * the git-modified-files path and the glob fallback).
 */
export const EXCLUDE_DIRS = [
  'node_modules',
  '.git',
  'dist',
  'build',
  'coverage',
  '.ai_cache',
  '.ai_workflow',
  '.olinda',
  'venv',
  '.venv',
  'env',
];

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

/**
 * Maximum content size per file included in the AI prompt (characters).
 * Limits token usage while still providing actionable context.
 */
export const MAX_FILE_CONTENT_CHARS = 2000;

/**
 * Minimum fraction of listed files the AI response must mention to be considered adequate.
 */
export const MIN_FILE_MENTION_RATIO = 0.3;

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
 * Strip JSON comments to support JSONC format (tsconfig.json, .vscode/settings.json, etc.)
 * @pure
 * @param {string} content - JSONC content
 * @returns {string} Content with comments removed
 */
export function stripJsonComments(content) {
  // State-machine approach: track string literals so /* or // inside them are not treated as comments
  let result = '';
  let i = 0;
  while (i < content.length) {
    const ch = content[i];
    // Inside a string literal: copy chars, honour escape sequences
    if (ch === '"') {
      result += ch;
      i++;
      while (i < content.length) {
        const sc = content[i];
        if (sc === '\\') {
          // Escape sequence — copy both characters
          result += sc + (content[i + 1] ?? '');
          i += 2;
        } else if (sc === '"') {
          result += sc;
          i++;
          break;
        } else {
          result += sc;
          i++;
        }
      }
      continue;
    }
    // Block comment /* ... */ — preserve newlines to keep line numbers intact
    if (ch === '/' && content[i + 1] === '*') {
      const end = content.indexOf('*/', i + 2);
      if (end === -1) break; // unterminated — stop
      const comment = content.slice(i, end + 2);
      result += comment.replace(/[^\n]/g, ' ');
      i = end + 2;
      continue;
    }
    // Line comment // ... — drop until end of line
    if (ch === '/' && content[i + 1] === '/') {
      const end = content.indexOf('\n', i + 2);
      if (end === -1) break;
      i = end; // keep the newline itself
      continue;
    }
    result += ch;
    i++;
  }
  return result;
}

/**
 * Validate JSON syntax (JSONC-aware: supports // and block comments)
 * @pure
 * @param {string} content - JSON or JSONC content
 * @returns {Object} Validation result
 */
export function validateJsonSyntax(content) {
  try {
    JSON.parse(stripJsonComments(content));
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
    // Detect comments by comparing stripped vs original content.  Using stripJsonComments (which
    // uses a string-literal-aware state machine) avoids false positives from glob patterns such as
    // "src/**/*" or "**/*.test.ts" whose /* and */ sequences would fool a plain regex.
    const stripped = stripJsonComments(content);
    if (stripped !== content) {
      issues.push({
        type: CONFIG_ISSUE_TYPE.SYNTAX_ERROR,
        message: 'JSON does not support comments',
      });
    }

    // Check for trailing commas (safe to run on stripped content so embedded patterns don't match)
    if (stripped.match(/,\s*[}\]]/)) {
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

  // Status — include best practice issues so the badge matches the detailed counts above
  const totalIssues =
    results.syntaxErrors.length +
    results.securityFindings.length +
    results.bestPracticeIssues.length;
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

/**
 * Build a formatted block of file contents for inclusion in an AI prompt.
 * Each file is rendered as a fenced code block with its relative path as header.
 * Content is truncated to MAX_FILE_CONTENT_CHARS to limit token usage.
 *
 * @pure
 * @param {Array<{relativePath: string, content: string}>} fileEntries - File data
 * @param {number} [maxChars=MAX_FILE_CONTENT_CHARS] - Per-file character limit
 * @returns {string} Formatted block suitable for prompt injection
 */
export function buildFileContentsBlock(fileEntries, maxChars = MAX_FILE_CONTENT_CHARS) {
  if (!fileEntries || fileEntries.length === 0) return '';
  return fileEntries
    .map(({ relativePath, content }) => {
      const trimmed =
        content.length > maxChars
          ? content.slice(0, maxChars) +
            `\n... [truncated — ${content.length - maxChars} more chars]`
          : content;
      return `--- ${relativePath} ---\n\`\`\`\n${trimmed}\n\`\`\``;
    })
    .join('\n\n');
}

/**
 * Validate that an AI response adequately covers the listed files.
 * Checks that at least MIN_FILE_MENTION_RATIO of the short filenames appear in the response.
 *
 * @pure
 * @param {string} aiResponse - AI response text
 * @param {string[]} relativeFilePaths - Relative paths that should be addressed
 * @param {number} [minRatio=MIN_FILE_MENTION_RATIO] - Minimum coverage fraction
 * @returns {{adequate: boolean, reason: string, coverage: number}}
 */
export function validateAiResponseQuality(
  aiResponse,
  relativeFilePaths,
  minRatio = MIN_FILE_MENTION_RATIO
) {
  if (!relativeFilePaths || relativeFilePaths.length === 0) {
    return { adequate: true, reason: 'no files to check', coverage: 1 };
  }
  if (!aiResponse || aiResponse.trim().length === 0) {
    return { adequate: false, reason: 'empty response', coverage: 0 };
  }
  const mentioned = relativeFilePaths.filter((fp) => {
    // Match by basename or any suffix of the path
    const parts = fp.replace(/\\/g, '/').split('/');
    return parts.some((part) => part && aiResponse.includes(part));
  });
  const coverage = mentioned.length / relativeFilePaths.length;
  if (coverage < minRatio) {
    return {
      adequate: false,
      reason: `AI response mentions only ${mentioned.length}/${relativeFilePaths.length} files (${Math.round(coverage * 100)}% < ${Math.round(minRatio * 100)}% threshold)`,
      coverage,
    };
  }
  return { adequate: true, reason: 'sufficient file coverage', coverage };
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
    this.aiHelper = options.aiHelper || new AiHelper({ promptsDir: options.promptsDir || null });
    this.aiCache = options.aiCache || new AiCache();
    this.techStack = options.techStack || new TechStackDetector();
  }

  /**
   * Execute Step 4 configuration validation
   * @param {string} projectRoot - Project root directory
   * @param {Object} options - Execution options
   * @param {string} [options.projectKind] - Detected project kind
   * @returns {Promise<Object>} Analysis result
   */
  async execute(projectRoot, options = {}) {
    try {
      logger.step('Step 4: Configuration Validation');

      // Phase 1: Discover configuration files
      const configFiles = await this.discoverConfigFiles(projectRoot);
      if (configFiles.length === 0) {
        logger.info('No configuration files found - skipping validation');
        return { success: true, skipped: true, reason: 'no_config_files', alternatives: [], recommendedAlternative: null };
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
      let parsedAlternatives = { alternatives: [], recommended: null };
      const aiAvailable = await this.aiHelper.initialize();
      const totalIssues = syntaxErrors.length + securityFindings.length + bestPracticeIssues.length;
      if (aiAvailable) {
        await this.aiCache.init();

        // Detect tech stack for prompt context
        let projectKind = options.projectKind ?? '';
        let techStackSummary = '';
        try {
          const detection = await this.techStack.detectTechStack(projectRoot);
          if (!projectKind) projectKind = detection.primaryLanguage || '';
          techStackSummary = [
            detection.primaryLanguage,
            ...(detection.frameworks ?? []).map((f) => (typeof f === 'string' ? f : f.name)),
          ]
            .filter(Boolean)
            .join(', ');
        } catch {
          /* tech stack detection is optional */
        }

        // Read file contents so the AI can actually analyze them
        const relPaths = configFiles.map((f) => path.relative(projectRoot, f));
        const fileEntries = [];
        for (let i = 0; i < configFiles.length; i++) {
          try {
            const content = await this.fileOps.readFile(configFiles[i]);
            fileEntries.push({ relativePath: relPaths[i], content });
          } catch {
            /* skip unreadable files */
          }
        }
        const filesContentBlock = buildFileContentsBlock(fileEntries);

        let prompt;
        const parsedYaml = await loadResolvedAiHelpers(this.fileOps).catch(() => null);
        try {
          prompt = buildYamlStepPrompt(parsedYaml, 'configuration_specialist_prompt', {
            project_name: path.basename(projectRoot),
            config_files_list: relPaths.join(', '),
            config_files_content: filesContentBlock,
            config_count: String(configFiles.length),
            project_kind: projectKind,
            tech_stack: techStackSummary,
          });
        } catch {
          /* fallback to generic prompt */
        }
        if (!prompt) {
          const role = `You are a configuration validation specialist and security expert.`;
          const task = `Analyze these configuration files for project at "${projectRoot}":
- Files: ${relPaths.join(', ')}
- Syntax errors found: ${syntaxErrors.length}
- Security findings: ${securityFindings.length}
- Best practice issues: ${bestPracticeIssues.length}
- Total issues: ${totalIssues}

${filesContentBlock}`;
          const approach = `Provide concise, actionable remediation steps for the most critical issues found.`;
          prompt = injectProjectContext(buildStructuredPrompt({ role, task, approach }), {});
        }
        if (options.alternatives) {
          const n = options.alternatives === true ? 2 : options.alternatives;
          prompt += buildAlternativesDirective(n);
        }
        // Build the file-content strings for the hash guard (same files that feed the prompt).
        const fileHashEntries = fileEntries.map((e) => `${e.relativePath}:${e.content}`);
        // Use 'devops_engineer' persona: the configuration_specialist_prompt YAML template
        // defines a "Senior DevOps Engineer and Configuration Management Expert" role covering
        // config formats (JSON/YAML/TOML), CI/CD, Docker, IaC, and environment configuration.
        // 'security_expert' only covers one of the five validation categories (Security Analysis)
        // and creates a misleading mismatch with the actual broad-scope prompt content.
        const aiResult = await this.aiCache.withFileChangeGuard('step_04', fileHashEntries, () =>
          this.aiHelper.executeRequest(prompt, {
            persona: 'devops_engineer',
            model: 'claude-haiku-4.5',
            timeout: 120000,
          })
        );
        const aiContent = aiResult?.content ?? '';
        parsedAlternatives = options.alternatives
          ? parseAlternatives(aiContent)
          : { alternatives: [], recommended: null };

        // Validate response quality: AI must mention at least MIN_FILE_MENTION_RATIO of files
        const quality = validateAiResponseQuality(aiContent, relPaths);
        if (!quality.adequate) {
          logger.warn(`Step 4 AI response quality low: ${quality.reason}`);
        }

        // Supplementary: quality_prompt for file-level quality review
        let qualityContent = '';
        try {
          const qPrompt = buildYamlStepPrompt(parsedYaml, 'quality_prompt', {
            files_to_review: (configFiles ?? []).slice(0, 10).join(', '),
            project_name: projectRoot,
          });
          if (qPrompt) {
            // Use 'code_quality_analyst' persona: quality_prompt defines a "senior code review
            // specialist" role (anti-patterns, best practices, maintainability) — not security.
            const qResult = await this.aiCache.withFileChangeGuard(
              'step_04_quality',
              fileHashEntries,
              () =>
                this.aiHelper.executeRequest(qPrompt, {
                  persona: 'code_quality_analyst',
                  model: 'claude-haiku-4.5',
                })
            );
            qualityContent = qResult?.content ?? '';
          }
        } catch {
          /* optional */
        }

        if (aiContent || qualityContent) {
          const sections = aiContent
            ? [`${report}\n\n---\n\n## AI Recommendations\n\n${aiContent}`]
            : [report];
          if (qualityContent) sections.push(`\n\n## Quality Review\n\n${qualityContent}`);
          await this.backlog.saveStepSummary(4, 'Configuration Validation', sections.join(''));
        }
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
        alternatives: parsedAlternatives.alternatives,
        recommendedAlternative: parsedAlternatives.recommended,
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
