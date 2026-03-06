/**
 * Step 9: Dependency Validation
 * @module steps/step_09_dependencies
 * @version 2.0.0
 *
 * Validates project dependencies, checks for vulnerabilities and outdated packages.
 */

import { STEP_KIND } from './step_contract.js';
import path from 'path';
import { logger } from '../core/logger.js';
import * as executor from '../core/executor.js';
import { FileOperations } from '../lib/file_operations.js';
import { Backlog } from '../lib/backlog.js';
import { TechStackDetector } from '../lib/tech_stack.js';
import { AiHelper } from '../lib/ai_helpers.js';
import { AiCache } from '../lib/ai_cache.js';
import { DependencyCache, CACHE_TYPE, generateCacheKey } from '../lib/dependency_cache.js';
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
  go: 'govulncheck -json ./...',
  java: 'mvn org.owasp:dependency-check-maven:check -Dformat=JSON -q',
  ruby: 'bundle audit --format json',
  rust: 'cargo audit --json',
};

/**
 * Outdated package commands by language
 */
export const OUTDATED_COMMANDS = {
  javascript: 'npm outdated --json',
  typescript: 'npm outdated --json',
  python: 'pip list --outdated --format json',
  go: 'go list -u -m -json all',
  java: 'mvn versions:display-dependency-updates -q',
  ruby: 'bundle outdated --format json',
  rust: 'cargo outdated --format json',
};

/**
 * Language-specific fix/update commands for recommendations
 */
export const FIX_COMMANDS = {
  javascript: { audit: 'npm audit fix', update: 'npm update' },
  typescript: { audit: 'npm audit fix', update: 'npm update' },
  python: {
    audit: 'pip install --upgrade <package>',
    update: 'pip install --upgrade -r requirements.txt',
  },
  go: { audit: 'go get -u ./...', update: 'go get -u ./...' },
  java: { audit: 'mvn versions:use-latest-releases', update: 'mvn versions:use-latest-releases' },
  ruby: { audit: 'bundle update', update: 'bundle update' },
  rust: { audit: 'cargo update', update: 'cargo update' },
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
    // Raw objects for building named-package lists in prompts
    dependencies: packageJson.dependencies || {},
    devDependencies: packageJson.devDependencies || {},
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

// ============================================================================
// PURE FUNCTIONS - Python Parsing
// ============================================================================

/**
 * Parse pip-audit JSON output
 * @pure
 * @param {Array} auditJson - pip-audit JSON array [{name, version, vulns:[]}]
 * @returns {Object} Vulnerability summary
 */
export function parsePipAudit(auditJson) {
  if (!Array.isArray(auditJson)) return { summary: null, packages: [] };

  const vulnerable = auditJson.filter((pkg) => pkg.vulns && pkg.vulns.length > 0);
  const packages = vulnerable.map((pkg) => ({
    name: pkg.name,
    severity: 'high',
    via: pkg.vulns.map((v) => v.id || v.alias || ''),
  }));
  const summary = {
    total: packages.length,
    critical: 0,
    high: packages.length,
    moderate: 0,
    low: 0,
    info: 0,
  };
  return { summary, packages };
}

/**
 * Parse pip list --outdated JSON output
 * @pure
 * @param {Array} outdatedJson - [{name, version, latest_version}]
 * @returns {Array} Outdated packages
 */
export function parsePipOutdated(outdatedJson) {
  if (!Array.isArray(outdatedJson)) return [];
  return outdatedJson.map((pkg) => ({
    name: pkg.name,
    current: pkg.version,
    wanted: pkg.latest_version,
    latest: pkg.latest_version,
    type: 'dependencies',
  }));
}

/**
 * Count dependencies from requirements.txt content
 * @pure
 * @param {string} content - requirements.txt content
 * @returns {Object} Dependency counts
 */
export function parsePythonDependencies(content) {
  const lines = content
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#') && !l.startsWith('-'));
  return { total: lines.length, production: lines.length, development: 0, peer: 0 };
}

// ============================================================================
// PURE FUNCTIONS - Go Parsing
// ============================================================================

/**
 * Count dependencies from go.mod content
 * @pure
 * @param {string} content - go.mod file content
 * @returns {Object} Dependency counts
 */
export function parseGoDependencies(content) {
  let inRequire = false;
  let count = 0;
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('require (')) {
      inRequire = true;
      continue;
    }
    if (inRequire && trimmed === ')') {
      inRequire = false;
      continue;
    }
    if (inRequire && trimmed && !trimmed.startsWith('//')) count++;
    // Single-line require: require module/path v1.2.3
    if (!inRequire && trimmed.startsWith('require ') && !trimmed.includes('(')) count++;
  }
  return { total: count, production: count, development: 0, peer: 0 };
}

/**
 * Parse govulncheck -json line-delimited output
 * @pure
 * @param {string} rawOutput - govulncheck JSON output
 * @returns {Object} Vulnerability summary
 */
export function parseGoVulncheck(rawOutput) {
  const findings = [];
  for (const line of rawOutput.split('\n')) {
    if (!line.trim()) continue;
    try {
      const obj = JSON.parse(line);
      if (obj.finding) findings.push(obj.finding);
    } catch {
      /* skip non-JSON lines */
    }
  }
  const packages = findings.map((f) => ({
    name: f.osv || f.trace?.[0]?.module || 'unknown',
    severity: 'high',
    via: [],
  }));
  return {
    summary: {
      total: findings.length,
      critical: 0,
      high: findings.length,
      moderate: 0,
      low: 0,
      info: 0,
    },
    packages,
  };
}

/**
 * Parse go list -u -m -json output for outdated modules
 * @pure
 * @param {string} rawOutput - newline-delimited JSON objects
 * @returns {Array} Outdated modules
 */
export function parseGoOutdated(rawOutput) {
  const result = [];
  for (const line of rawOutput.split('\n')) {
    if (!line.trim()) continue;
    try {
      const obj = JSON.parse(line);
      if (obj.Update) {
        result.push({
          name: obj.Path,
          current: obj.Version,
          wanted: obj.Update.Version,
          latest: obj.Update.Version,
          type: 'dependencies',
        });
      }
    } catch {
      /* skip */
    }
  }
  return result;
}

// ============================================================================
// PURE FUNCTIONS - Java Parsing
// ============================================================================

/**
 * Count dependencies from pom.xml content
 * @pure
 * @param {string} content - pom.xml content
 * @returns {Object} Dependency counts
 */
export function parseMavenDependencies(content) {
  const matches = content.match(/<dependency>/g) || [];
  return { total: matches.length, production: matches.length, development: 0, peer: 0 };
}

/**
 * Parse OWASP dependency-check JSON report
 * @pure
 * @param {Object} auditJson - OWASP dependency-check JSON
 * @returns {Object} Vulnerability summary
 */
export function parseMavenAudit(auditJson) {
  const deps = auditJson?.dependencies || [];
  const vulnerable = deps.filter((d) => d.vulnerabilities && d.vulnerabilities.length > 0);
  let critical = 0,
    high = 0,
    moderate = 0,
    low = 0;
  const packages = [];
  for (const dep of vulnerable) {
    for (const vuln of dep.vulnerabilities) {
      const score = vuln.cvssv3?.baseScore || vuln.cvssv2?.score || 0;
      if (score >= 9.0) critical++;
      else if (score >= 7.0) high++;
      else if (score >= 4.0) moderate++;
      else low++;
      packages.push({
        name: dep.fileName,
        severity: score >= 7 ? 'high' : 'moderate',
        via: [vuln.name],
      });
    }
  }
  return {
    summary: { total: critical + high + moderate + low, critical, high, moderate, low, info: 0 },
    packages,
  };
}

// ============================================================================
// PURE FUNCTIONS - Ruby Parsing
// ============================================================================

/**
 * Count gem dependencies from Gemfile content
 * @pure
 * @param {string} content - Gemfile content
 * @returns {Object} Dependency counts
 */
export function parseGemfileDependencies(content) {
  const lines = content
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('gem '));
  return { total: lines.length, production: lines.length, development: 0, peer: 0 };
}

/**
 * Parse bundle-audit JSON output
 * @pure
 * @param {Object} auditJson - bundle-audit JSON {results:[{gem, advisory}]}
 * @returns {Object} Vulnerability summary
 */
export function parseBundleAudit(auditJson) {
  const results = auditJson?.results || [];
  const packages = results.map((r) => ({
    name: r.gem?.name || 'unknown',
    severity: r.advisory?.criticality || 'unknown',
    via: [r.advisory?.id || ''],
  }));
  const critical = results.filter((r) => r.advisory?.criticality === 'critical').length;
  const high = results.filter((r) => r.advisory?.criticality === 'high').length;
  const moderate = results.filter((r) => r.advisory?.criticality === 'medium').length;
  const low = results.filter((r) => r.advisory?.criticality === 'low').length;
  return {
    summary: { total: results.length, critical, high, moderate, low, info: 0 },
    packages,
  };
}

// ============================================================================
// PURE FUNCTIONS - Rust Parsing
// ============================================================================

/**
 * Count dependencies from Cargo.toml content
 * @pure
 * @param {string} content - Cargo.toml content
 * @returns {Object} Dependency counts
 */
export function parseCargoToml(content) {
  let inDeps = false;
  let count = 0;
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed === '[dependencies]' || trimmed === '[dev-dependencies]') {
      inDeps = true;
      continue;
    }
    if (
      trimmed.startsWith('[') &&
      trimmed !== '[dependencies]' &&
      trimmed !== '[dev-dependencies]'
    ) {
      inDeps = false;
    }
    if (inDeps && trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) count++;
  }
  return { total: count, production: count, development: 0, peer: 0 };
}

/**
 * Parse cargo audit --json output
 * @pure
 * @param {Object} auditJson - cargo audit JSON {vulnerabilities:{list:[]}}
 * @returns {Object} Vulnerability summary
 */
export function parseCargoAudit(auditJson) {
  const list = auditJson?.vulnerabilities?.list || [];
  const packages = list.map((v) => {
    const cvss = v.advisory?.cvss ? parseFloat(v.advisory.cvss) : 0;
    return {
      name: v.package?.name || 'unknown',
      severity: cvss >= 7 ? 'high' : 'moderate',
      via: [v.advisory?.id || ''],
    };
  });
  const high = packages.filter((p) => p.severity === 'high').length;
  const moderate = packages.filter((p) => p.severity === 'moderate').length;
  return {
    summary: { total: list.length, critical: 0, high, moderate, low: 0, info: 0 },
    packages,
  };
}

/**
 * Parse cargo outdated --format json output
 * @pure
 * @param {Object} outdatedJson - cargo outdated JSON {dependencies:[{name,project,compat,latest}]}
 * @returns {Array} Outdated packages
 */
export function parseCargoOutdated(outdatedJson) {
  const deps = outdatedJson?.dependencies || [];
  return deps.map((d) => ({
    name: d.name,
    current: d.project,
    wanted: d.compat,
    latest: d.latest,
    type: 'dependencies',
  }));
}

// ============================================================================
// PURE FUNCTIONS - Severity
// ============================================================================

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
    const fixCmds = FIX_COMMANDS[language] || FIX_COMMANDS.javascript;
    report += '## 💡 Recommendations\n\n';

    if (vulnerabilities.summary?.total > 0) {
      report += `1. Run \`${fixCmds.audit}\` to fix vulnerabilities\n`;
      report += '2. Review security advisories for manual fixes\n';
      report += '3. Consider alternative packages if fixes unavailable\n';
    }

    if (outdatedPackages.length > 0) {
      report += `4. Update outdated packages with \`${fixCmds.update}\`\n`;
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
  static stepKind = STEP_KIND.PROJECT;

  constructor(options = {}) {
    this.executor = options.executor || executor;
    this.fileOps = options.fileOps || new FileOperations();
    this.backlog = options.backlog || new Backlog();
    this.techStack = options.techStack || new TechStackDetector();
    this.aiHelper = options.aiHelper || new AiHelper({ promptsDir: options.promptsDir || null });
    this.aiCache = options.aiCache || new AiCache();
    this.depCache = options.depCache || new DependencyCache({ workflowHome: process.cwd() });
  }

  /**
   * Execute Step 9 dependency validation
   * @param {string} projectRoot - Project root directory
   * @param {Object} _options - Execution options (reserved)
   * @returns {Promise<Object>} Validation result
   */
  async execute(projectRoot, options = {}) {
    try {
      logger.step('Step 9: Dependency Validation');

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

      // Initialize dependency cache
      let depCacheReady = false;
      try {
        await this.depCache.initialize();
        depCacheReady = true;
      } catch {
        // Cache unavailable — proceed without it
      }
      const auditCacheKey = depCacheReady
        ? generateCacheKey(
            dependencyCounts.dependencies || {},
            dependencyCounts.devDependencies || {},
            CACHE_TYPE.AUDIT
          )
        : null;
      const outdatedCacheKey = depCacheReady
        ? generateCacheKey(
            dependencyCounts.dependencies || {},
            dependencyCounts.devDependencies || {},
            CACHE_TYPE.OUTDATED
          )
        : null;

      // Phase 4: Run security audit (with cache)
      let vulnerabilities;
      if (depCacheReady && auditCacheKey && (await this.depCache.has(auditCacheKey))) {
        vulnerabilities = await this.depCache.get(auditCacheKey);
        logger.info('[DependencyCache] Audit result loaded from cache');
      } else {
        vulnerabilities = await this.runSecurityAudit(projectRoot, language);
        if (depCacheReady && auditCacheKey) {
          await this.depCache.set(auditCacheKey, vulnerabilities, CACHE_TYPE.AUDIT);
        }
      }

      if (vulnerabilities.summary?.total > 0) {
        logger.warn(`Found ${vulnerabilities.summary.total} vulnerabilities`);
      } else {
        logger.success('No vulnerabilities found');
      }

      // Phase 5: Check for outdated packages (with cache)
      let outdatedPackages;
      if (depCacheReady && outdatedCacheKey && (await this.depCache.has(outdatedCacheKey))) {
        outdatedPackages = await this.depCache.get(outdatedCacheKey);
        logger.info('[DependencyCache] Outdated result loaded from cache');
      } else {
        outdatedPackages = await this.checkOutdatedPackages(projectRoot, language);
        if (depCacheReady && outdatedCacheKey) {
          await this.depCache.set(outdatedCacheKey, outdatedPackages, CACHE_TYPE.OUTDATED);
        }
      }

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

      // Phase 7: AI-powered dependency analysis (optional enrichment)
      try {
        const aiAvailable = await this.aiHelper.initialize();
        if (aiAvailable) {
          await this.aiCache.init();
          const vuln = vulnerabilities.summary?.total ?? 0;
          const outdated = outdatedPackages.length;
          // Hash key: dependency identity (package names + counts) captures meaningful input changes.
          const depHashEntries = [
            `${language}:total:${dependencyCounts.total ?? 0}:vuln:${vuln}:outdated:${outdated}`,
            ...Object.keys(dependencyCounts.dependencies ?? {})
              .slice(0, 30)
              .map((k) => `prod:${k}`),
            ...Object.keys(dependencyCounts.devDependencies ?? {})
              .slice(0, 30)
              .map((k) => `dev:${k}`),
            ...outdatedPackages.slice(0, 20).map((p) => `outdated:${p.name}:${p.latest}`),
          ];
          let prompt;
          try {
            const yamlContent = await this.fileOps.readFile(AI_HELPERS_PATH);
            const parsedYaml = yaml.load(yamlContent);
            const pkgMgrMap = {
              javascript: 'npm',
              typescript: 'npm',
              python: 'pip',
              go: 'go',
              java: 'maven',
              ruby: 'bundler',
              rust: 'cargo',
            };
            const pkgMgr = pkgMgrMap[language] ?? 'unknown';
            const prodDepsObj = dependencyCounts.dependencies ?? {};
            const devDepsObj = dependencyCounts.devDependencies ?? {};
            const prodList = Object.keys(prodDepsObj).slice(0, 30).join(', ') || 'none';
            const devList = Object.keys(devDepsObj).slice(0, 30).join(', ') || 'none';
            const vulnSum = vulnerabilities.summary ?? {};
            const auditSummary = vulnSum.total
              ? `${vulnSum.total} total (${vulnSum.critical ?? 0} critical, ${vulnSum.high ?? 0} high, ${vulnSum.moderate ?? 0} moderate, ${vulnSum.low ?? 0} low)`
              : 'No vulnerabilities found';
            const outdatedList = outdatedPackages.length
              ? outdatedPackages
                  .slice(0, 20)
                  .map((p) => `${p.name}: ${p.current} → ${p.latest}`)
                  .join(', ')
              : 'none';
            prompt = buildYamlStepPrompt(parsedYaml, 'step8_dependencies_prompt', {
              project_name: path.basename(projectRoot),
              project_description: options?.projectDescription ?? 'N/A',
              primary_language: language,
              package_manager: pkgMgr,
              package_manager_version: 'N/A',
              change_scope: options?.changeScope ?? 'N/A',
              modified_count: String(options?.modifiedCount ?? 'N/A'),
              dep_count: String(dependencyCounts.production ?? 0),
              dev_dep_count: String(dependencyCounts.development ?? 0),
              total_deps: String(dependencyCounts.total ?? 0),
              dependency_summary: `${dependencyCounts.total ?? 0} total (${dependencyCounts.production ?? 0} prod, ${dependencyCounts.dev ?? 0} dev)`,
              dependency_report_content: report.slice(0, 1500) || 'none',
              prod_deps: prodList,
              dev_deps: devList,
              audit_summary: auditSummary,
              outdated_list: outdatedList,
            });
          } catch {
            /* fallback to generic prompt */
          }
          if (!prompt) {
            const role = `You are a senior dependency security and maintenance analyst specializing in ${language} ecosystem best practices.`;
            const task = `Analyze the dependency health report for a ${language} project:
- Total dependencies: ${dependencyCounts.total} (${dependencyCounts.dev || 0} dev, ${dependencyCounts.production || 0} production)
- Vulnerabilities: ${vuln} total (${vulnerabilities.summary?.critical || 0} critical, ${vulnerabilities.summary?.high || 0} high)
- Outdated packages: ${outdated}`;
            const approach = `Provide: (1) security risk assessment, (2) prioritized remediation steps, (3) maintenance recommendations.`;
            prompt = injectProjectContext(buildStructuredPrompt({ role, task, approach }), {
              language,
            });
          }
          const aiResult = await this.aiCache.withFileChangeGuard('step_09', depHashEntries, () =>
            this.aiHelper.executeRequest(prompt, { persona: 'dependency_analyst' })
          );
          const aiContent = aiResult?.content ?? '';

          // Supplementary: JavaScript-developer perspective on package.json
          let jsContent = '';
          if (language === 'javascript' || language === 'typescript') {
            try {
              // Read the actual package.json so the AI reviews reality, not an invention
              let currentPackageJson = 'Not found';
              try {
                currentPackageJson = await this.fileOps.readFile(`${projectRoot}/package.json`);
              } catch {
                /* file may not exist */
              }

              const yamlContent2 = await this.fileOps.readFile(AI_HELPERS_PATH);
              const parsedYaml2 = yaml.load(yamlContent2);
              const jsPrompt = buildYamlStepPrompt(parsedYaml2, 'javascript_developer_prompt', {
                project_name: path.basename(projectRoot),
                project_description: options?.projectDescription ?? 'N/A',
                project_kind: options?.projectType ?? options?.projectKind ?? 'N/A',
                primary_language: language,
                build_system:
                  {
                    javascript: 'npm',
                    typescript: 'npm',
                    python: 'pip',
                    go: 'go',
                    ruby: 'bundler',
                    rust: 'cargo',
                  }[language] ?? 'npm',
                test_framework:
                  {
                    javascript: 'jest',
                    typescript: 'jest',
                    python: 'pytest',
                    go: 'go test',
                    ruby: 'rspec',
                    rust: 'cargo test',
                  }[language] ?? 'jest',
                test_command:
                  {
                    javascript: 'npm test',
                    typescript: 'npm test',
                    python: 'pytest',
                    go: 'go test ./...',
                    ruby: 'rspec',
                    rust: 'cargo test',
                  }[language] ?? 'npm test',
                lint_command:
                  {
                    javascript: 'eslint .',
                    typescript: 'eslint .',
                    python: 'flake8',
                    go: 'golint',
                    ruby: 'rubocop',
                    rust: 'cargo clippy',
                  }[language] ?? 'eslint .',
                modified_count: String(options?.modifiedCount ?? 'N/A'),
                current_package_json: currentPackageJson,
              });
              if (jsPrompt) {
                const jsHashEntries = [`package.json:${currentPackageJson}`];
                const jsResult = await this.aiCache.withFileChangeGuard(
                  'step_09_js',
                  jsHashEntries,
                  () =>
                    this.aiHelper.executeRequest(jsPrompt, { persona: 'dependency_analyst' })
                );
                jsContent = jsResult?.content ?? '';
              }
            } catch {
              /* optional */
            }
          }

          if (aiContent || jsContent) {
            const sections = aiContent
              ? [`${report}\n\n---\n\n## AI Recommendations\n\n${aiContent}`]
              : [report];
            if (jsContent) sections.push(`\n\n## JavaScript Developer Analysis\n\n${jsContent}`);
            await this.backlog.saveStepSummary(9, 'Dependency Validation', sections.join(''));
          }
        } else {
          logger.warn('AI helper not available - skipping AI dependency analysis');
        }
      } catch (aiError) {
        logger.warn(`AI dependency analysis skipped: ${aiError.message}`);
      }

      const hasIssues =
        (vulnerabilities.summary?.critical || 0) > 0 || (vulnerabilities.summary?.high || 0) > 0;

      if (hasIssues) {
        logger.warn('Step 9 completed with security issues');
      } else {
        logger.success('Step 9 completed - dependencies validated!');
      }

      return {
        success: true,
        hasSecurityIssues: hasIssues,
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
    // Node.js: parse package.json
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

    // Python: parse requirements.txt
    if (language === 'python') {
      try {
        const content = await this.fileOps.readFile(`${projectRoot}/requirements.txt`);
        return parsePythonDependencies(content);
      } catch {
        /* fallback */
      }
    }

    // Go: parse go.mod
    if (language === 'go') {
      try {
        const content = await this.fileOps.readFile(`${projectRoot}/go.mod`);
        return parseGoDependencies(content);
      } catch {
        /* fallback */
      }
    }

    // Java: parse pom.xml
    if (language === 'java') {
      try {
        const content = await this.fileOps.readFile(`${projectRoot}/pom.xml`);
        return parseMavenDependencies(content);
      } catch {
        /* fallback */
      }
    }

    // Ruby: parse Gemfile
    if (language === 'ruby') {
      try {
        const content = await this.fileOps.readFile(`${projectRoot}/Gemfile`);
        return parseGemfileDependencies(content);
      } catch {
        /* fallback */
      }
    }

    // Rust: parse Cargo.toml
    if (language === 'rust') {
      try {
        const content = await this.fileOps.readFile(`${projectRoot}/Cargo.toml`);
        return parseCargoToml(content);
      } catch {
        /* fallback */
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

    const _parseAuditOutput = (output, lang) => {
      if (lang === 'javascript' || lang === 'typescript') return parseNpmAudit(JSON.parse(output));
      if (lang === 'python') return parsePipAudit(JSON.parse(output));
      if (lang === 'go') return parseGoVulncheck(output);
      if (lang === 'java') return parseMavenAudit(JSON.parse(output));
      if (lang === 'ruby') return parseBundleAudit(JSON.parse(output));
      if (lang === 'rust') return parseCargoAudit(JSON.parse(output));
      return { summary: null, packages: [] };
    };

    try {
      const result = await this.executor.execute(auditCmd, {
        cwd: projectRoot,
        shell: true,
        timeout: 60000, // 1 minute
      });

      return _parseAuditOutput(result.stdout || '{}', language);
    } catch (error) {
      // Audit might fail with exit code 1 when vulnerabilities found
      // Try to parse the output anyway
      try {
        return _parseAuditOutput(error.stdout || '{}', language);
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

      const output = result.stdout || '';

      if (language === 'javascript' || language === 'typescript') {
        return parseNpmOutdated(JSON.parse(output));
      }
      if (language === 'python') {
        return parsePipOutdated(JSON.parse(output));
      }
      if (language === 'go') {
        return parseGoOutdated(output);
      }
      if (language === 'rust') {
        return parseCargoOutdated(JSON.parse(output));
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
