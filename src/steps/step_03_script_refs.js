/**
 * Step 3: Script Reference Validation
 * @version 2.0.0
 * @description Validate script/code references and documentation accuracy
 * @module steps/step_03_script_refs
 * Part of: AI Workflow Automation (Phase 9)
 */

import { STEP_KIND } from './step_contract.js';
import logger from '../core/logger.js';
import { FileOperations } from '../lib/file_operations.js';
import { Backlog } from '../lib/backlog.js';
import { TechStackDetector } from '../lib/tech_stack.js';
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
 * Script patterns by language
 */
export const SCRIPT_PATTERNS = {
  bash: ['*.sh'],
  python: ['*.py'],
  javascript: ['*.js', '*.mjs'],
  typescript: ['*.ts', '*.mts'],
  go: ['*.go'],
  java: ['*.java'],
  ruby: ['*.rb'],
  rust: ['*.rs'],
  cpp: ['*.cpp', '*.cc', '*.h', '*.hpp'],
};

/**
 * Script directories by language
 */
export const SCRIPT_DIRECTORIES = {
  bash: ['.', 'scripts', 'src/scripts', 'src/workflow'],
  python: ['scripts', 'src'],
  javascript: ['scripts', 'src'],
  typescript: ['scripts', 'src'],
  default: ['scripts'],
};

/**
 * Issue types
 */
export const SCRIPT_ISSUE_TYPE = {
  MISSING_REFERENCE: 'missing_reference',
  NON_EXECUTABLE: 'non_executable',
  UNDOCUMENTED: 'undocumented',
  INVALID_SHEBANG: 'invalid_shebang',
};

// ============================================================================
// PURE FUNCTIONS - Script Pattern Detection
// ============================================================================

/**
 * Get script patterns for a language
 * @pure
 * @param {string} language - Programming language
 * @returns {string[]} Array of file patterns
 */
export function getScriptPatterns(language) {
  const normalized = (language || 'bash').toLowerCase();
  return SCRIPT_PATTERNS[normalized] || SCRIPT_PATTERNS.bash;
}

/**
 * Get script directories for a language
 * @pure
 * @param {string} language - Programming language
 * @returns {string[]} Array of directory paths
 */
export function getScriptDirectories(language) {
  const normalized = (language || 'bash').toLowerCase();
  return SCRIPT_DIRECTORIES[normalized] || SCRIPT_DIRECTORIES.default;
}

/**
 * Extract script references from documentation
 * @pure
 * @param {string} content - Documentation content
 * @returns {string[]} Array of script paths referenced
 */
export function extractScriptReferences(content) {
  const references = [];

  // Match: `./path/to/script.sh` or `path/to/script.sh`
  const inlinePattern = /`\.?\/?([\w\-./]+\.(?:sh|py|js|mjs|ts|rb|go|java|rs|cpp|cc))`/g;
  let match;
  while ((match = inlinePattern.exec(content)) !== null) {
    references.push(match[1]);
  }

  // Match: ```bash\n./script.sh\n```
  const codeBlockPattern = /```(?:bash|sh|python|javascript|typescript)\n([\s\S]*?)```/g;
  while ((match = codeBlockPattern.exec(content)) !== null) {
    const commands = match[1].trim().split('\n');
    for (const cmd of commands) {
      const scriptMatch = cmd.match(/\.?\/?([^\s]+\.(?:sh|py|js|mjs|ts|rb|go))/);
      if (scriptMatch) {
        references.push(scriptMatch[1]);
      }
    }
  }

  return [...new Set(references)]; // Remove duplicates
}

/**
 * Validate script references against existing files
 * @pure
 * @param {string[]} references - Script references from docs
 * @param {Set} existingScripts - Set of existing script paths
 * @returns {Object[]} Array of missing reference issues
 */
export function validateScriptReferences(references, existingScripts) {
  const issues = [];

  for (const ref of references) {
    // Normalize path (remove leading ./)
    const normalized = ref.replace(/^\.\//, '');

    if (!existingScripts.has(normalized)) {
      issues.push({
        reference: ref,
        normalized,
        type: SCRIPT_ISSUE_TYPE.MISSING_REFERENCE,
      });
    }
  }

  return issues;
}

// ============================================================================
// PURE FUNCTIONS - Script Validation
// ============================================================================

/**
 * Check if a script has valid shebang
 * @pure
 * @param {string} content - Script content
 * @param {string} extension - File extension
 * @returns {Object} Validation result
 */
export function validateShebang(content, extension) {
  const lines = content.split('\n');
  const firstLine = lines[0] || '';

  // Expected shebangs by extension
  const expectedShebangs = {
    '.sh': ['#!/bin/bash', '#!/bin/sh', '#!/usr/bin/env bash', '#!/usr/bin/env sh'],
    '.py': [
      '#!/usr/bin/env python',
      '#!/usr/bin/python',
      '#!/usr/bin/env python3',
      '#!/usr/bin/python3',
    ],
    '.rb': ['#!/usr/bin/env ruby', '#!/usr/bin/ruby'],
  };

  const expected = expectedShebangs[extension];
  if (!expected) {
    return { valid: true, reason: 'not_required' }; // Not a script language that requires shebang
  }

  if (!firstLine.startsWith('#!')) {
    return { valid: false, reason: 'missing_shebang', expected };
  }

  const hasValid = expected.some((shebang) => firstLine.startsWith(shebang));
  if (!hasValid) {
    return { valid: false, reason: 'invalid_shebang', found: firstLine, expected };
  }

  return { valid: true };
}

/**
 * Check if a script is documented in README
 * @pure
 * @param {string} scriptPath - Script file path
 * @param {string} readmeContent - README content
 * @returns {boolean} True if documented
 */
export function isScriptDocumented(scriptPath, readmeContent) {
  const scriptName = scriptPath.split('/').pop();

  // Check for script name or path in README
  return (
    readmeContent.includes(scriptName) ||
    readmeContent.includes(scriptPath) ||
    readmeContent.includes(scriptPath.replace(/^\.\//, ''))
  );
}

// ============================================================================
// PURE FUNCTIONS - Reporting
// ============================================================================

/**
 * Format script validation report
 * @pure
 * @param {Object} results - Validation results
 * @returns {string} Formatted markdown content
 */
export function formatScriptReport(results) {
  const lines = [];

  lines.push('## Step 3: Script Reference Validation\n');

  // Summary
  lines.push('### Summary');
  lines.push(`- **Scripts found**: ${results.scriptsFound}`);
  lines.push(`- **References checked**: ${results.referencesChecked}`);
  lines.push(`- **Total issues**: ${results.totalIssues}`);
  lines.push(`- **Missing references**: ${results.missingReferences.length}`);
  lines.push(`- **Non-executable**: ${results.nonExecutable.length}`);
  lines.push(`- **Undocumented**: ${results.undocumented.length}\n`);

  // Status
  if (results.totalIssues === 0) {
    lines.push('✅ **Status**: All script references valid\n');
  } else {
    lines.push('⚠️ **Status**: Issues found - review required\n');
  }

  // Missing references
  if (results.missingReferences.length > 0) {
    lines.push('### Missing References');
    results.missingReferences.slice(0, 10).forEach((issue) => {
      lines.push(`- \`${issue.reference}\` (normalized: \`${issue.normalized}\`)`);
    });
    if (results.missingReferences.length > 10) {
      lines.push(`\n*... and ${results.missingReferences.length - 10} more*`);
    }
    lines.push('');
  }

  // Non-executable scripts
  if (results.nonExecutable.length > 0) {
    lines.push('### Non-Executable Scripts');
    results.nonExecutable.slice(0, 10).forEach((script) => {
      lines.push(`- \`${script}\``);
    });
    if (results.nonExecutable.length > 10) {
      lines.push(`\n*... and ${results.nonExecutable.length - 10} more*`);
    }
    lines.push('');
  }

  // Undocumented scripts
  if (results.undocumented.length > 0) {
    lines.push('### Undocumented Scripts');
    results.undocumented.slice(0, 10).forEach((script) => {
      lines.push(`- \`${script}\``);
    });
    if (results.undocumented.length > 10) {
      lines.push(`\n*... and ${results.undocumented.length - 10} more*`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

// ============================================================================
// STEP 3 ANALYZER - Impure Wrapper
// ============================================================================

/**
 * Step 3 analyzer for script reference validation
 */
export class Step3ScriptAnalyzer {
  static stepKind = STEP_KIND.PROJECT;

  constructor(options = {}) {
    this.fileOps = options.fileOps || new FileOperations();
    this.backlog = options.backlog || new Backlog();
    this.techStack = options.techStack || new TechStackDetector();
    this.aiHelper = options.aiHelper || new AiHelper({ promptsDir: options.promptsDir || null });
    this.aiCache = options.aiCache || new AiCache();
  }

  /**
   * Execute Step 3 script reference validation
   * @param {string} projectRoot - Project root directory
   * @param {Object} options - Execution options
   * @returns {Promise<Object>} Analysis result
   */
  async execute(projectRoot, options = {}) {
    try {
      logger.step('Step 3: Script Reference Validation');

      // Phase 1: Detect language and script patterns
      const language = options.language || (await this.detectLanguage(projectRoot));
      const patterns = getScriptPatterns(language);
      const directories = getScriptDirectories(language);

      logger.info(`Language: ${language}, patterns: ${patterns.join(', ')}`);

      // Phase 2: Find all scripts
      const scripts = await this.findScripts(projectRoot, directories, patterns);
      if (scripts.length === 0) {
        logger.info('No scripts found - skipping validation');
        return { success: true, skipped: true, reason: 'no_scripts' };
      }

      logger.info(`Found ${scripts.length} script(s)`);

      // Phase 3: Load README for reference checking
      const readmeContent = await this.loadReadme(projectRoot);

      // Phase 4: Extract and validate script references
      const allReferences = extractScriptReferences(readmeContent);
      // Only validate references matching the detected language's extensions
      // to avoid false positives (e.g. .ts refs when language is bash)
      const patternExts = patterns.map((p) => p.replace('*.', ''));
      const references = allReferences.filter((ref) => patternExts.includes(ref.split('.').pop()));
      const existingScripts = new Set(scripts);
      const missingReferences = validateScriptReferences(references, existingScripts);

      logger.info(`References: ${references.length}, missing: ${missingReferences.length}`);

      // Phase 5: Check executable permissions (Unix-like only)
      const nonExecutable = await this.checkExecutablePermissions(scripts);
      logger.info(`Non-executable: ${nonExecutable.length}`);

      // Phase 6: Check documentation
      const undocumented = scripts.filter((script) => !isScriptDocumented(script, readmeContent));
      logger.info(`Undocumented: ${undocumented.length}`);

      // Phase 7: Generate report
      const totalIssues = missingReferences.length + nonExecutable.length + undocumented.length;
      const results = {
        scriptsFound: scripts.length,
        referencesChecked: references.length,
        totalIssues,
        missingReferences,
        nonExecutable,
        undocumented,
      };

      const report = formatScriptReport(results);
      await this.backlog.saveStepSummary(3, 'Script Reference Validation', report);

      // Phase AI: AI-powered script reference analysis
      const aiAvailable = await this.aiHelper.initialize();
      if (aiAvailable) {
        await this.aiCache.init();
        let prompt;
        try {
          const yamlContent = await this.fileOps.readFile(AI_HELPERS_PATH);
          const parsedYaml = yaml.load(yamlContent);
          prompt = buildYamlStepPrompt(parsedYaml, 'step3_script_refs_prompt', {
            project_name: projectRoot,
            scripts_dir: directories.join(', '),
            script_count: String(results.scriptsFound ?? 0),
            modified_count: String(missingReferences.length),
            issues: String(totalIssues),
            script_issues_content: `Missing references: ${missingReferences.length}, Non-executable: ${nonExecutable.length}, Undocumented: ${undocumented.length}`,
            all_scripts: scripts.length > 0 ? scripts.join('\n') : '',
          });
        } catch {
          /* fallback to generic prompt */
        }
        if (!prompt) {
          const role = `You are an expert in shell scripting and script reference validation.`;
          const task = `Analyze these script reference validation results for project at "${projectRoot}" and provide recommendations:
- Total scripts: ${results.scriptsFound ?? 0}
- Scripts found: ${scripts.join(', ') || 'none'}
- Missing references: ${missingReferences.length}
- Non-executable scripts: ${nonExecutable.length}
- Undocumented scripts: ${undocumented.length}
- Total issues: ${totalIssues}`;
          const approach = `List the top 3 actionable recommendations to fix the script reference issues. Be concise.`;
          prompt = injectProjectContext(buildStructuredPrompt({ role, task, approach }), {});
        }
        const cacheKey = `step_03|${results.scriptsFound ?? 0}|${totalIssues}`;
        const aiResult = await this.aiCache.withCache(prompt, cacheKey, () =>
          this.aiHelper.executeRequest(prompt, { persona: 'devops_engineer' })
        );
        const aiContent = aiResult?.content ?? '';
        if (aiContent) {
          const enrichedReport = `${report}\n\n---\n\n## AI Recommendations\n\n${aiContent}`;
          await this.backlog.saveStepSummary(3, 'Script Reference Validation', enrichedReport);
        }
      } else {
        logger.warn('AI helper not available - skipping AI analysis');
      }

      if (totalIssues === 0) {
        logger.success('Step 3 completed - no issues found');
      } else {
        logger.warn(`Step 3 completed - ${totalIssues} issue(s) found`);
      }

      return {
        success: true,
        ...results,
      };
    } catch (error) {
      logger.error(`Step 3 failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Detect primary language from project
   * @param {string} projectRoot - Project root directory
   * @returns {Promise<string>} Detected language
   */
  async detectLanguage(projectRoot) {
    try {
      const detection = await this.techStack.detectTechStack(projectRoot);
      return detection.primaryLanguage || 'bash';
    } catch {
      return 'bash';
    }
  }

  /**
   * Find all scripts in directories
   * @param {string} projectRoot - Project root directory
   * @param {string[]} directories - Directories to search
   * @param {string[]} patterns - File patterns
   * @returns {Promise<string[]>} Array of script paths
   */
  async findScripts(projectRoot, directories, patterns) {
    const scripts = [];
    const exclude = ['node_modules', '.git', 'dist', 'build', 'coverage'];

    for (const dir of directories) {
      for (const pattern of patterns) {
        try {
          // Match files directly in the directory
          const direct = await this.fileOps.glob(`${dir}/${pattern}`, {
            cwd: projectRoot,
            ignore: exclude.map((ex) => `**/${ex}/**`),
          });
          scripts.push(...direct);
          // Match files in subdirectories
          const recursive = await this.fileOps.glob(`${dir}/**/${pattern}`, {
            cwd: projectRoot,
            ignore: exclude.map((ex) => `**/${ex}/**`),
          });
          scripts.push(...recursive);
        } catch {
          // Directory or pattern not found, continue
        }
      }
    }

    return [...new Set(scripts)]; // Remove duplicates
  }

  /**
   * Load README content
   * @param {string} projectRoot - Project root directory
   * @returns {Promise<string>} README content or empty string
   */
  async loadReadme(projectRoot) {
    const readmeFiles = ['README.md', 'README.MD', 'readme.md', 'Readme.md'];

    for (const file of readmeFiles) {
      try {
        return await this.fileOps.readFile(`${projectRoot}/${file}`);
      } catch {
        // Try next variant
      }
    }

    return ''; // No README found
  }

  /**
   * Check executable permissions on scripts
   * @param {string[]} scripts - Script file paths
   * @returns {Promise<string[]>} Non-executable scripts
   */
  async checkExecutablePermissions(scripts) {
    const nonExecutable = [];

    for (const script of scripts) {
      try {
        const stats = await this.fileOps.stat(script);
        // Check if file has execute permission (Unix-like systems)
        // mode & 0o111 checks if any execute bit is set
        if (stats.mode && !(stats.mode & 0o111)) {
          nonExecutable.push(script);
        }
      } catch {
        // File not accessible, skip
      }
    }

    return nonExecutable;
  }
}

export default Step3ScriptAnalyzer;
