/**
 * Step 9: Dependency Validation
 * @module steps/step_09_dependencies
 * @version 2.0.0
 *
 * Validates project dependencies, checks for vulnerabilities and outdated packages.
 */

import { logger } from '../core/logger.js';
import * as executor from '../core/executor.js';
import { FileOperations } from '../lib/file_operations.js';
import { Backlog } from '../lib/backlog.js';
import { TechStackDetector } from '../lib/tech_stack.js';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Dependency file patterns by language
 */
export const DEPENDENCY_FILES = {
  javascript: ['package.json', 'package-lock.json', 'yarn.lock'],
  typescript: ['package.json', 'package-lock.json', 'yarn.lock'],
  python: ['requirements.txt', 'setup.py', 'pyproject.toml', 'Pipfile'],
  go: ['go.mod', 'go.sum'],
  java: ['pom.xml', 'build.gradle'],
  ruby: ['Gemfile', 'Gemfile.lock'],
  rust: ['Cargo.toml', 'Cargo.lock'],
};

/**
 * Audit commands by language
 */
export const AUDIT_COMMANDS = {
  javascript: 'npm audit --json',
  typescript: 'npm audit --json',
  python: 'pip-audit --format json',
  go: 'go list -m -json all',
  ruby: 'bundle audit --format json',
};

/**
 * Outdated package commands by language
 */
export const OUTDATED_COMMANDS = {
  javascript: 'npm outdated --json',
  typescript: 'npm outdated --json',
  python: 'pip list --outdated --format json',
  go: 'go list -u -m -json all',
  ruby: 'bundle outdated --format json',
};

/**
 * Severity levels
 */
export const SEVERITY = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MODERATE: 'moderate',
  LOW: 'low',
  INFO: 'info',
};

// ============================================================================
// PURE FUNCTIONS - Dependency File Detection
// ============================================================================

/**
 * Get dependency files for a language
 * @pure
 * @param {string} language - Programming language
 * @returns {string[]} Dependency file patterns
 */
export function getDependencyFiles(language) {
  const normalized = language.toLowerCase();
  return DEPENDENCY_FILES[normalized] || DEPENDENCY_FILES.javascript;
}

/**
 * Get audit command for a language
 * @pure
 * @param {string} language - Programming language
 * @returns {string|null} Audit command
 */
export function getAuditCommand(language) {
  const normalized = language.toLowerCase();
  return AUDIT_COMMANDS[normalized] || null;
}

/**
 * Get outdated packages command for a language
 * @pure
 * @param {string} language - Programming language
 * @returns {string|null} Outdated command
 */
export function getOutdatedCommand(language) {
  const normalized = language.toLowerCase();
  return OUTDATED_COMMANDS[normalized] || null;
}

/**
 * Check if language supports dependency validation
 * @pure
 * @param {string} language - Programming language
 * @returns {boolean} True if supported
 */
export function supportsDependencyValidation(language) {
  const normalized = language.toLowerCase();
  return ['bash', 'shell', 'sh'].indexOf(normalized) === -1;
}

// ============================================================================
// PURE FUNCTIONS - Dependency Parsing
// ============================================================================

/**
 * Parse package.json for Node.js projects
 * @pure
 * @param {Object} packageJson - Parsed package.json
 * @returns {Object} Dependency counts
 */
export function parsePackageJson(packageJson) {
  const dependencies = Object.keys(packageJson.dependencies || {});
  const devDependencies = Object.keys(packageJson.devDependencies || {});
  const peerDependencies = Object.keys(packageJson.peerDependencies || {});

  return {
    total: dependencies.length + devDependencies.length + peerDependencies.length,
    production: dependencies.length,
    development: devDependencies.length,
    peer: peerDependencies.length,
  };
}

/**
 * Parse npm audit output
 * @pure
 * @param {Object} auditJson - Parsed npm audit JSON
 * @returns {Object} Vulnerability summary
 */
export function parseNpmAudit(auditJson) {
  const vulnerabilities = auditJson.vulnerabilities || {};
  const metadata = auditJson.metadata || {};

  const summary = {
    total: metadata.vulnerabilities?.total || 0,
    critical: metadata.vulnerabilities?.critical || 0,
    high: metadata.vulnerabilities?.high || 0,
    moderate: metadata.vulnerabilities?.moderate || 0,
    low: metadata.vulnerabilities?.low || 0,
    info: metadata.vulnerabilities?.info || 0,
  };

  // Extract vulnerable packages
  const packages = Object.keys(vulnerabilities).map((name) => ({
    name,
    severity: vulnerabilities[name].severity || 'unknown',
    via: vulnerabilities[name].via || [],
  }));

  return { summary, packages };
}

/**
 * Parse npm outdated output
 * @pure
 * @param {Object} outdatedJson - Parsed npm outdated JSON
 * @returns {Array} Outdated packages
 */
export function parseNpmOutdated(outdatedJson) {
  return Object.keys(outdatedJson).map((name) => ({
    name,
    current: outdatedJson[name].current,
    wanted: outdatedJson[name].wanted,
    latest: outdatedJson[name].latest,
    type: outdatedJson[name].type || 'dependencies',
  }));
}

/**
 * Determine severity level from vulnerability count
 * @pure
 * @param {Object} summary - Vulnerability summary
 * @returns {string} Severity level
 */
export function determineSeverity(summary) {
  if (summary.critical > 0) return SEVERITY.CRITICAL;
  if (summary.high > 0) return SEVERITY.HIGH;
  if (summary.moderate > 0) return SEVERITY.MODERATE;
  if (summary.low > 0) return SEVERITY.LOW;
  return SEVERITY.INFO;
}

// ============================================================================
// PURE FUNCTIONS - Reporting
// ============================================================================

/**
 * Format dependency validation report
 * @pure
 * @param {Object} results - Validation results
 * @returns {string} Formatted report
 */
export function formatDependencyReport(results) {
  const {
    language = 'javascript',
    dependencyCounts = {},
    vulnerabilities = {},
    outdatedPackages = [],
    skipped = false,
  } = results;

  let report = '# Dependency Validation Report\n\n';

  // Summary
  report += '## Summary\n\n';
  report += `- **Language**: ${language}\n`;

  if (skipped) {
    report += `- **Status**: ⚠️ Skipped (no dependency validation for ${language})\n\n`;
    report += `${language} projects do not require package manager dependencies.\n\n`;
    return report;
  }

  // Dependency counts
  if (dependencyCounts.total > 0) {
    report += `- **Total Dependencies**: ${dependencyCounts.total}\n`;
    report += `- **Production**: ${dependencyCounts.production}\n`;
    report += `- **Development**: ${dependencyCounts.development}\n\n`;
  }

  // Vulnerabilities
  if (vulnerabilities.summary) {
    const { summary } = vulnerabilities;
    const severity = determineSeverity(summary);

    report += '## Security Vulnerabilities\n\n';

    if (summary.total === 0) {
      report += '✅ No known vulnerabilities found!\n\n';
    } else {
      report += `**Total Vulnerabilities**: ${summary.total}\n\n`;
      if (summary.critical > 0) report += `- 🚨 **Critical**: ${summary.critical}\n`;
      if (summary.high > 0) report += `- ⚠️ **High**: ${summary.high}\n`;
      if (summary.moderate > 0) report += `- 📋 **Moderate**: ${summary.moderate}\n`;
      if (summary.low > 0) report += `- 📌 **Low**: ${summary.low}\n`;
      if (summary.info > 0) report += `- ℹ️ **Info**: ${summary.info}\n`;
      report += '\n';

      // Severity badge
      if (severity === SEVERITY.CRITICAL || severity === SEVERITY.HIGH) {
        report += '🚨 **Action Required**: Critical vulnerabilities need immediate attention!\n\n';
      } else if (severity === SEVERITY.MODERATE) {
        report += '⚠️ **Review Recommended**: Moderate vulnerabilities should be reviewed.\n\n';
      }
    }
  }

  // Outdated packages
  if (outdatedPackages.length > 0) {
    report += '## Outdated Packages\n\n';
    report += `Found ${outdatedPackages.length} outdated package(s):\n\n`;

    outdatedPackages.slice(0, 10).forEach((pkg) => {
      report += `- **${pkg.name}**: ${pkg.current} → ${pkg.latest}\n`;
    });

    if (outdatedPackages.length > 10) {
      report += `\n... and ${outdatedPackages.length - 10} more\n`;
    }
    report += '\n';
  } else if (dependencyCounts.total > 0) {
    report += '## Outdated Packages\n\n';
    report += '✅ All packages are up to date!\n\n';
  }

  // Recommendations
  if (vulnerabilities.summary?.total > 0 || outdatedPackages.length > 0) {
    report += '## 💡 Recommendations\n\n';

    if (vulnerabilities.summary?.total > 0) {
      report += '1. Run `npm audit fix` to automatically fix vulnerabilities\n';
      report += '2. Review security advisories for manual fixes\n';
      report += '3. Consider alternative packages if fixes unavailable\n';
    }

    if (outdatedPackages.length > 0) {
      report += '4. Update outdated packages with `npm update`\n';
      report += '5. Test thoroughly after updating dependencies\n';
      report += '6. Check CHANGELOG for breaking changes\n';
    }

    report += '\n';
  }

  return report;
}

// ============================================================================
// STEP 9 VALIDATOR - Integration
// ============================================================================

/**
 * Step 9 validator for dependency validation
 */
export class Step9DependencyValidator {
  constructor(options = {}) {
    this.executor = options.executor || executor;
    this.fileOps = options.fileOps || new FileOperations();
    this.backlog = options.backlog || new Backlog();
    this.techStack = options.techStack || new TechStackDetector();
  }

  /**
   * Execute Step 9 dependency validation
   * @param {string} projectRoot - Project root directory
   * @param {Object} _options - Execution options (reserved)
   * @returns {Promise<Object>} Validation result
   */
  async execute(projectRoot, _options = {}) {
    try {
      logger.info('Step 9: Dependency Validation');

      // Phase 1: Detect language
      const language = await this.detectLanguage(projectRoot);
      logger.info(`Detected language: ${language}`);

      // Check if dependency validation is supported
      if (!supportsDependencyValidation(language)) {
        logger.info(`${language} projects do not require dependency validation`);

        const report = formatDependencyReport({
          language,
          skipped: true,
        });

        await this.backlog.saveStepSummary(9, 'Dependency Validation', report);

        return {
          success: true,
          language,
          skipped: true,
        };
      }

      // Phase 2: Check for dependency files
      const dependencyFiles = await this.findDependencyFiles(projectRoot, language);

      if (dependencyFiles.length === 0) {
        logger.warn('No dependency files found');

        const report = formatDependencyReport({
          language,
          skipped: true,
        });

        await this.backlog.saveStepSummary(9, 'Dependency Validation', report);

        return {
          success: true,
          language,
          skipped: true,
          message: 'No dependency files found',
        };
      }

      logger.info(`Found dependency files: ${dependencyFiles.join(', ')}`);

      // Phase 3: Parse dependency counts
      const dependencyCounts = await this.parseDependencies(projectRoot, language);
      logger.info(`Total dependencies: ${dependencyCounts.total}`);

      // Phase 4: Run security audit
      const vulnerabilities = await this.runSecurityAudit(projectRoot, language);

      if (vulnerabilities.summary?.total > 0) {
        logger.warn(`Found ${vulnerabilities.summary.total} vulnerabilities`);
      } else {
        logger.success('No vulnerabilities found');
      }

      // Phase 5: Check for outdated packages
      const outdatedPackages = await this.checkOutdatedPackages(projectRoot, language);

      if (outdatedPackages.length > 0) {
        logger.info(`Found ${outdatedPackages.length} outdated packages`);
      }

      // Phase 6: Generate report
      const results = {
        language,
        dependencyCounts,
        vulnerabilities,
        outdatedPackages,
        skipped: false,
      };

      const report = formatDependencyReport(results);
      await this.backlog.saveStepSummary(9, 'Dependency Validation', report);

      const hasIssues =
        (vulnerabilities.summary?.critical || 0) > 0 || (vulnerabilities.summary?.high || 0) > 0;

      if (hasIssues) {
        logger.warn('Step 9 completed with security issues');
      } else {
        logger.success('Step 9 completed - dependencies validated!');
      }

      return {
        success: !hasIssues,
        ...results,
      };
    } catch (error) {
      logger.error(`Step 9 failed: ${error.message}`);
      throw error;
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
   * Find dependency files
   * @param {string} projectRoot - Project root directory
   * @param {string} language - Programming language
   * @returns {Promise<string[]>} Found dependency files
   */
  async findDependencyFiles(projectRoot, language) {
    const files = getDependencyFiles(language);
    const found = [];

    for (const file of files) {
      const filePath = `${projectRoot}/${file}`;
      try {
        const exists = await this.fileOps.exists(filePath);
        if (exists) {
          found.push(file);
        }
      } catch {
        // File doesn't exist
      }
    }

    return found;
  }

  /**
   * Parse dependencies
   * @param {string} projectRoot - Project root directory
   * @param {string} language - Programming language
   * @returns {Promise<Object>} Dependency counts
   */
  async parseDependencies(projectRoot, language) {
    // For Node.js projects, parse package.json
    if (language === 'javascript' || language === 'typescript') {
      try {
        const pkgPath = `${projectRoot}/package.json`;
        const pkgContent = await this.fileOps.readFile(pkgPath);
        const packageJson = JSON.parse(pkgContent);
        return parsePackageJson(packageJson);
      } catch {
        // Could not parse
      }
    }

    // Default empty counts
    return {
      total: 0,
      production: 0,
      development: 0,
      peer: 0,
    };
  }

  /**
   * Run security audit
   * @param {string} projectRoot - Project root directory
   * @param {string} language - Programming language
   * @returns {Promise<Object>} Vulnerability report
   */
  async runSecurityAudit(projectRoot, language) {
    const auditCmd = getAuditCommand(language);

    if (!auditCmd) {
      return { summary: null, packages: [] };
    }

    try {
      const result = await this.executor.execute(auditCmd, {
        cwd: projectRoot,
        shell: true,
        timeout: 60000, // 1 minute
      });

      // Parse JSON output
      const output = result.stdout || '{}';
      const auditJson = JSON.parse(output);

      // Parse based on language
      if (language === 'javascript' || language === 'typescript') {
        return parseNpmAudit(auditJson);
      }

      return { summary: null, packages: [] };
    } catch (error) {
      // Audit might fail with exit code 1 when vulnerabilities found
      // Try to parse the output anyway
      try {
        const output = error.stdout || '{}';
        const auditJson = JSON.parse(output);

        if (language === 'javascript' || language === 'typescript') {
          return parseNpmAudit(auditJson);
        }
      } catch {
        // Could not parse audit output
      }

      return { summary: null, packages: [] };
    }
  }

  /**
   * Check for outdated packages
   * @param {string} projectRoot - Project root directory
   * @param {string} language - Programming language
   * @returns {Promise<Array>} Outdated packages
   */
  async checkOutdatedPackages(projectRoot, language) {
    const outdatedCmd = getOutdatedCommand(language);

    if (!outdatedCmd) {
      return [];
    }

    try {
      const result = await this.executor.execute(outdatedCmd, {
        cwd: projectRoot,
        shell: true,
        timeout: 60000, // 1 minute
      });

      const output = result.stdout || '{}';
      const outdatedJson = JSON.parse(output);

      // Parse based on language
      if (language === 'javascript' || language === 'typescript') {
        return parseNpmOutdated(outdatedJson);
      }

      return [];
    } catch {
      // Command might fail if no outdated packages
      return [];
    }
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default Step9DependencyValidator;
