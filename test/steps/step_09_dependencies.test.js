/**
 * Tests for Step 9: Dependency Validation
 * @group steps
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  Step9DependencyValidator,
  getDependencyFiles,
  getAuditCommand,
  getOutdatedCommand,
  supportsDependencyValidation,
  parsePackageJson,
  parseNpmAudit,
  parseNpmOutdated,
  parsePipAudit,
  parsePipOutdated,
  parsePythonDependencies,
  parseGoDependencies,
  parseGoVulncheck,
  parseGoOutdated,
  parseMavenDependencies,
  parseMavenAudit,
  parseGemfileDependencies,
  parseBundleAudit,
  parseCargoToml,
  parseCargoAudit,
  parseCargoOutdated,
  determineSeverity,
  formatDependencyReport,
  SEVERITY,
  FIX_COMMANDS,
  validateLockfileStructure,
  computeLockfileHash,
} from '../../src/steps/step_09_dependencies.js';

describe('Step 9: Dependency Validation', () => {
  // ========================================================================
  // PURE FUNCTIONS - Dependency File Detection
  // ========================================================================

  describe('getDependencyFiles', () => {
    test('returns files for JavaScript', () => {
      const files = getDependencyFiles('javascript');
      expect(files).toContain('package.json');
    });

    test('returns files for Python', () => {
      const files = getDependencyFiles('python');
      expect(files).toContain('requirements.txt');
    });

    test('defaults to JavaScript files', () => {
      const files = getDependencyFiles('unknown');
      expect(files).toContain('package.json');
    });
  });

  describe('getAuditCommand', () => {
    test('returns npm audit with --package-lock-only for JavaScript', () => {
      expect(getAuditCommand('javascript')).toBe('npm audit --json --package-lock-only');
    });

    test('returns npm audit with --package-lock-only for TypeScript', () => {
      expect(getAuditCommand('typescript')).toBe('npm audit --json --package-lock-only');
    });

    test('returns pip-audit for Python', () => {
      expect(getAuditCommand('python')).toBe('pip-audit --format json');
    });

    test('returns govulncheck for Go', () => {
      expect(getAuditCommand('go')).toBe('govulncheck -json ./...');
    });

    test('returns cargo audit for Rust', () => {
      expect(getAuditCommand('rust')).toBe('cargo audit --json');
    });

    test('returns mvn OWASP check for Java', () => {
      expect(getAuditCommand('java')).toContain('dependency-check-maven');
    });

    test('returns bundle audit for Ruby', () => {
      expect(getAuditCommand('ruby')).toBe('bundle audit --format json');
    });

    test('returns null for unknown language', () => {
      expect(getAuditCommand('unknown')).toBeNull();
    });
  });

  describe('getOutdatedCommand', () => {
    test('returns npm outdated for JavaScript', () => {
      expect(getOutdatedCommand('javascript')).toBe('npm outdated --json');
    });

    test('returns pip list for Python', () => {
      expect(getOutdatedCommand('python')).toBe('pip list --outdated --format json');
    });

    test('returns go list for Go', () => {
      expect(getOutdatedCommand('go')).toBe('go list -u -m -json all');
    });

    test('returns cargo outdated for Rust', () => {
      expect(getOutdatedCommand('rust')).toBe('cargo outdated --format json');
    });

    test('returns mvn versions for Java', () => {
      expect(getOutdatedCommand('java')).toContain('versions:display-dependency-updates');
    });

    test('returns bundle outdated for Ruby', () => {
      expect(getOutdatedCommand('ruby')).toBe('bundle outdated --format json');
    });

    test('returns null for unknown language', () => {
      expect(getOutdatedCommand('unknown')).toBeNull();
    });
  });

  describe('supportsDependencyValidation', () => {
    test('returns true for JavaScript', () => {
      expect(supportsDependencyValidation('javascript')).toBe(true);
    });

    test('returns false for bash', () => {
      expect(supportsDependencyValidation('bash')).toBe(false);
    });

    test('returns false for shell', () => {
      expect(supportsDependencyValidation('shell')).toBe(false);
    });
  });

  // ========================================================================
  // PURE FUNCTIONS - Dependency Parsing
  // ========================================================================

  describe('parsePackageJson', () => {
    test('parses package.json with all dependency types', () => {
      const pkg = {
        dependencies: { react: '^18.0.0', lodash: '^4.17.21' },
        devDependencies: { jest: '^29.0.0' },
        peerDependencies: { webpack: '^5.0.0' },
      };

      const result = parsePackageJson(pkg);

      expect(result.total).toBe(4);
      expect(result.production).toBe(2);
      expect(result.development).toBe(1);
      expect(result.peer).toBe(1);
    });

    test('handles package.json with only production dependencies', () => {
      const pkg = {
        dependencies: { react: '^18.0.0' },
      };

      const result = parsePackageJson(pkg);

      expect(result.total).toBe(1);
      expect(result.production).toBe(1);
      expect(result.development).toBe(0);
    });

    test('handles empty package.json', () => {
      const pkg = {};

      const result = parsePackageJson(pkg);

      expect(result.total).toBe(0);
    });
  });

  describe('parseNpmAudit', () => {
    test('parses npm audit output with vulnerabilities', () => {
      const audit = {
        metadata: {
          vulnerabilities: {
            total: 5,
            critical: 1,
            high: 2,
            moderate: 1,
            low: 1,
            info: 0,
          },
        },
        vulnerabilities: {
          lodash: {
            severity: 'high',
            via: ['prototype-pollution'],
          },
        },
      };

      const result = parseNpmAudit(audit);

      expect(result.summary.total).toBe(5);
      expect(result.summary.critical).toBe(1);
      expect(result.packages).toHaveLength(1);
      expect(result.packages[0].name).toBe('lodash');
    });

    test('handles audit with no vulnerabilities', () => {
      const audit = {
        metadata: {
          vulnerabilities: {
            total: 0,
          },
        },
        vulnerabilities: {},
      };

      const result = parseNpmAudit(audit);

      expect(result.summary.total).toBe(0);
      expect(result.packages).toHaveLength(0);
    });
  });

  describe('parseNpmOutdated', () => {
    test('parses npm outdated output', () => {
      const outdated = {
        lodash: {
          current: '4.17.15',
          wanted: '4.17.21',
          latest: '4.17.21',
          type: 'dependencies',
        },
        jest: {
          current: '28.0.0',
          wanted: '28.1.0',
          latest: '29.0.0',
          type: 'devDependencies',
        },
      };

      const result = parseNpmOutdated(outdated);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('lodash');
      expect(result[0].current).toBe('4.17.15');
      expect(result[0].latest).toBe('4.17.21');
    });

    test('handles empty outdated output', () => {
      const result = parseNpmOutdated({});
      expect(result).toHaveLength(0);
    });
  });

  describe('determineSeverity', () => {
    test('returns critical for critical vulnerabilities', () => {
      const summary = { critical: 1, high: 0, moderate: 0, low: 0 };
      expect(determineSeverity(summary)).toBe(SEVERITY.CRITICAL);
    });

    test('returns high for high vulnerabilities', () => {
      const summary = { critical: 0, high: 2, moderate: 0, low: 0 };
      expect(determineSeverity(summary)).toBe(SEVERITY.HIGH);
    });

    test('returns moderate for moderate vulnerabilities', () => {
      const summary = { critical: 0, high: 0, moderate: 1, low: 0 };
      expect(determineSeverity(summary)).toBe(SEVERITY.MODERATE);
    });

    test('returns low for low vulnerabilities', () => {
      const summary = { critical: 0, high: 0, moderate: 0, low: 1 };
      expect(determineSeverity(summary)).toBe(SEVERITY.LOW);
    });

    test('returns info when no vulnerabilities', () => {
      const summary = { critical: 0, high: 0, moderate: 0, low: 0 };
      expect(determineSeverity(summary)).toBe(SEVERITY.INFO);
    });
  });

  // ========================================================================
  // PURE FUNCTIONS - Reporting
  // ========================================================================

  describe('formatDependencyReport', () => {
    test('formats report for skipped validation', () => {
      const results = {
        language: 'bash',
        skipped: true,
      };

      const report = formatDependencyReport(results);

      expect(report).toContain('Dependency Validation Report');
      expect(report).toContain('Skipped');
      expect(report).toContain('bash');
    });

    test('formats report with no vulnerabilities', () => {
      const results = {
        language: 'javascript',
        dependencyCounts: { total: 10, production: 8, development: 2 },
        vulnerabilities: {
          summary: { total: 0, critical: 0, high: 0, moderate: 0, low: 0 },
        },
        outdatedPackages: [],
        skipped: false,
      };

      const report = formatDependencyReport(results);

      expect(report).toContain('**Total Dependencies**: 10');
      expect(report).toContain('No known vulnerabilities');
      expect(report).toContain('All packages are up to date');
    });

    test('formats report with vulnerabilities', () => {
      const results = {
        language: 'javascript',
        dependencyCounts: { total: 10, production: 8, development: 2 },
        vulnerabilities: {
          summary: { total: 3, critical: 1, high: 2, moderate: 0, low: 0 },
        },
        outdatedPackages: [],
        skipped: false,
      };

      const report = formatDependencyReport(results);

      expect(report).toContain('**Total Vulnerabilities**: 3');
      expect(report).toContain('**Critical**: 1');
      expect(report).toContain('**High**: 2');
      expect(report).toContain('Action Required');
    });

    test('formats report with outdated packages', () => {
      const results = {
        language: 'javascript',
        dependencyCounts: { total: 10, production: 8, development: 2 },
        vulnerabilities: { summary: { total: 0 } },
        outdatedPackages: [
          { name: 'lodash', current: '4.17.15', latest: '4.17.21' },
          { name: 'jest', current: '28.0.0', latest: '29.0.0' },
        ],
        skipped: false,
      };

      const report = formatDependencyReport(results);

      expect(report).toContain('Outdated Packages');
      expect(report).toContain('Found 2 outdated package(s)');
      expect(report).toContain('lodash');
    });
  });

  // ========================================================================
  // PURE FUNCTIONS - Python Parsing
  // ========================================================================

  describe('parsePipAudit', () => {
    test('parses pip-audit output with vulnerabilities', () => {
      const auditJson = [
        {
          name: 'requests',
          version: '2.25.0',
          vulns: [{ id: 'PYSEC-2023-001', alias: 'CVE-2023-001' }],
        },
        { name: 'urllib3', version: '1.26.5', vulns: [] },
      ];
      const result = parsePipAudit(auditJson);
      expect(result.summary.total).toBe(1);
      expect(result.packages).toHaveLength(1);
      expect(result.packages[0].name).toBe('requests');
    });

    test('handles empty pip-audit output', () => {
      const result = parsePipAudit([]);
      expect(result.summary.total).toBe(0);
      expect(result.packages).toHaveLength(0);
    });

    test('returns null summary for non-array input', () => {
      const result = parsePipAudit(null);
      expect(result.summary).toBeNull();
    });
  });

  describe('parsePipOutdated', () => {
    test('parses pip list --outdated output', () => {
      const outdated = [
        { name: 'requests', version: '2.25.0', latest_version: '2.31.0' },
        { name: 'flask', version: '2.0.0', latest_version: '3.0.0' },
      ];
      const result = parsePipOutdated(outdated);
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('requests');
      expect(result[0].current).toBe('2.25.0');
      expect(result[0].latest).toBe('2.31.0');
    });

    test('handles empty output', () => {
      expect(parsePipOutdated([])).toHaveLength(0);
    });

    test('returns empty array for non-array input', () => {
      expect(parsePipOutdated(null)).toHaveLength(0);
    });
  });

  describe('parsePythonDependencies', () => {
    test('counts requirements.txt lines', () => {
      const content = `requests==2.31.0\nflask>=2.0.0\n# comment\n-r base.txt\ndjango<5.0`;
      const result = parsePythonDependencies(content);
      expect(result.total).toBe(3); // ignores comment and -r line
      expect(result.production).toBe(3);
      expect(result.development).toBe(0);
    });

    test('handles empty requirements.txt', () => {
      expect(parsePythonDependencies('').total).toBe(0);
    });
  });

  // ========================================================================
  // PURE FUNCTIONS - Go Parsing
  // ========================================================================

  describe('parseGoDependencies', () => {
    test('counts dependencies from go.mod block syntax', () => {
      const content = `module example.com/mymod\n\ngo 1.21\n\nrequire (\n\tgithub.com/gin-gonic/gin v1.9.1\n\tgithub.com/stretchr/testify v1.8.4\n)\n`;
      const result = parseGoDependencies(content);
      expect(result.total).toBe(2);
      expect(result.production).toBe(2);
    });

    test('counts single-line require', () => {
      const content = `module example.com/mymod\n\nrequire github.com/pkg/errors v0.9.1\n`;
      const result = parseGoDependencies(content);
      expect(result.total).toBe(1);
    });

    test('handles empty go.mod', () => {
      expect(parseGoDependencies('module example.com/mymod\n').total).toBe(0);
    });
  });

  describe('parseGoVulncheck', () => {
    test('parses govulncheck JSON findings', () => {
      const output = [
        JSON.stringify({ finding: { osv: 'GO-2023-001', trace: [{ module: 'example.com/pkg' }] } }),
        JSON.stringify({ finding: { osv: 'GO-2023-002', trace: [] } }),
        'non-json line',
      ].join('\n');
      const result = parseGoVulncheck(output);
      expect(result.summary.total).toBe(2);
      expect(result.packages).toHaveLength(2);
    });

    test('handles empty output', () => {
      const result = parseGoVulncheck('');
      expect(result.summary.total).toBe(0);
    });
  });

  describe('parseGoOutdated', () => {
    test('parses go list -u -m -json output', () => {
      const output = [
        JSON.stringify({
          Path: 'github.com/pkg/errors',
          Version: 'v0.9.0',
          Update: { Version: 'v0.9.1' },
        }),
        JSON.stringify({ Path: 'github.com/stretchr/testify', Version: 'v1.8.0' }),
      ].join('\n');
      const result = parseGoOutdated(output);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('github.com/pkg/errors');
      expect(result[0].latest).toBe('v0.9.1');
    });

    test('handles empty output', () => {
      expect(parseGoOutdated('')).toHaveLength(0);
    });
  });

  // ========================================================================
  // PURE FUNCTIONS - Java Parsing
  // ========================================================================

  describe('parseMavenDependencies', () => {
    test('counts <dependency> tags in pom.xml', () => {
      const content = `<project>\n<dependencies>\n<dependency>\n<groupId>org.springframework</groupId>\n</dependency>\n<dependency>\n<groupId>junit</groupId>\n</dependency>\n</dependencies>\n</project>`;
      const result = parseMavenDependencies(content);
      expect(result.total).toBe(2);
    });

    test('returns zero for pom with no dependencies', () => {
      expect(parseMavenDependencies('<project></project>').total).toBe(0);
    });
  });

  describe('parseMavenAudit', () => {
    test('parses OWASP dependency-check JSON', () => {
      const auditJson = {
        dependencies: [
          {
            fileName: 'log4j-1.2.17.jar',
            vulnerabilities: [{ name: 'CVE-2019-17571', cvssv3: { baseScore: 9.8 } }],
          },
          { fileName: 'junit-4.13.jar', vulnerabilities: [] },
        ],
      };
      const result = parseMavenAudit(auditJson);
      expect(result.summary.total).toBe(1);
      expect(result.summary.critical).toBe(1);
      expect(result.packages[0].name).toBe('log4j-1.2.17.jar');
    });

    test('handles empty audit output', () => {
      const result = parseMavenAudit({ dependencies: [] });
      expect(result.summary.total).toBe(0);
    });
  });

  // ========================================================================
  // PURE FUNCTIONS - Ruby Parsing
  // ========================================================================

  describe('parseGemfileDependencies', () => {
    test('counts gem lines in Gemfile', () => {
      const content = `source 'https://rubygems.org'\ngem 'rails', '~> 7.0'\ngem 'pg'\n# comment\ngem 'rspec-rails', group: :test`;
      const result = parseGemfileDependencies(content);
      expect(result.total).toBe(3);
    });

    test('handles empty Gemfile', () => {
      expect(parseGemfileDependencies("source 'https://rubygems.org'\n").total).toBe(0);
    });
  });

  describe('parseBundleAudit', () => {
    test('parses bundle-audit JSON output', () => {
      const auditJson = {
        results: [
          { gem: { name: 'rails' }, advisory: { id: 'CVE-2023-001', criticality: 'high' } },
          { gem: { name: 'nokogiri' }, advisory: { id: 'CVE-2023-002', criticality: 'critical' } },
        ],
      };
      const result = parseBundleAudit(auditJson);
      expect(result.summary.total).toBe(2);
      expect(result.summary.high).toBe(1);
      expect(result.summary.critical).toBe(1);
    });

    test('handles empty audit output', () => {
      const result = parseBundleAudit({ results: [] });
      expect(result.summary.total).toBe(0);
    });
  });

  // ========================================================================
  // PURE FUNCTIONS - Rust Parsing
  // ========================================================================

  describe('parseCargoToml', () => {
    test('counts dependencies from Cargo.toml', () => {
      const content = `[package]\nname = "myapp"\n\n[dependencies]\nserde = "1.0"\ntokio = { version = "1", features = ["full"] }\n\n[dev-dependencies]\ncriterion = "0.5"\n`;
      const result = parseCargoToml(content);
      expect(result.total).toBe(3);
    });

    test('handles Cargo.toml with no dependencies', () => {
      expect(parseCargoToml('[package]\nname = "myapp"\n').total).toBe(0);
    });
  });

  describe('parseCargoAudit', () => {
    test('parses cargo audit JSON output', () => {
      const auditJson = {
        vulnerabilities: {
          list: [
            { package: { name: 'openssl' }, advisory: { id: 'RUSTSEC-2023-001', cvss: '9.8' } },
            { package: { name: 'time' }, advisory: { id: 'RUSTSEC-2023-002', cvss: '5.0' } },
          ],
        },
      };
      const result = parseCargoAudit(auditJson);
      expect(result.summary.total).toBe(2);
      expect(result.summary.high).toBe(1);
      expect(result.summary.moderate).toBe(1);
    });

    test('handles empty audit output', () => {
      const result = parseCargoAudit({ vulnerabilities: { list: [] } });
      expect(result.summary.total).toBe(0);
    });
  });

  describe('parseCargoOutdated', () => {
    test('parses cargo outdated JSON output', () => {
      const outdatedJson = {
        dependencies: [
          { name: 'serde', project: '1.0.150', compat: '1.0.193', latest: '1.0.193' },
          { name: 'tokio', project: '1.28.0', compat: '1.35.0', latest: '1.36.0' },
        ],
      };
      const result = parseCargoOutdated(outdatedJson);
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('serde');
      expect(result[0].current).toBe('1.0.150');
      expect(result[0].latest).toBe('1.0.193');
    });

    test('handles empty output', () => {
      expect(parseCargoOutdated({ dependencies: [] })).toHaveLength(0);
    });
  });

  // ========================================================================
  // PURE FUNCTIONS - Language-aware Recommendations
  // ========================================================================

  describe('formatDependencyReport - language-aware recommendations', () => {
    const makeResults = (language) => ({
      language,
      dependencyCounts: { total: 5, production: 5, development: 0 },
      vulnerabilities: { summary: { total: 1, critical: 0, high: 1, moderate: 0, low: 0 } },
      outdatedPackages: [{ name: 'pkg', current: '1.0', latest: '2.0' }],
      skipped: false,
    });

    test('uses npm commands for JavaScript', () => {
      const report = formatDependencyReport(makeResults('javascript'));
      expect(report).toContain('npm audit fix');
      expect(report).toContain('npm update');
    });

    test('uses pip commands for Python', () => {
      const report = formatDependencyReport(makeResults('python'));
      expect(report).toContain('pip install --upgrade');
    });

    test('uses go get for Go', () => {
      const report = formatDependencyReport(makeResults('go'));
      expect(report).toContain('go get -u');
    });

    test('uses cargo commands for Rust', () => {
      const report = formatDependencyReport(makeResults('rust'));
      expect(report).toContain('cargo update');
    });

    test('uses mvn commands for Java', () => {
      const report = formatDependencyReport(makeResults('java'));
      expect(report).toContain('mvn versions:use-latest-releases');
    });

    test('uses bundle commands for Ruby', () => {
      const report = formatDependencyReport(makeResults('ruby'));
      expect(report).toContain('bundle update');
    });
  });

  describe('FIX_COMMANDS', () => {
    test('provides audit and update commands for all supported languages', () => {
      const languages = ['javascript', 'typescript', 'python', 'go', 'java', 'ruby', 'rust'];
      for (const lang of languages) {
        expect(FIX_COMMANDS[lang]).toBeDefined();
        expect(FIX_COMMANDS[lang].audit).toBeTruthy();
        expect(FIX_COMMANDS[lang].update).toBeTruthy();
      }
    });
  });

  // ========================================================================
  // STEP 9 VALIDATOR - Multi-language Integration Tests
  // ========================================================================

  describe('Step9DependencyValidator', () => {
    let validator;
    let mockExecutor;
    let mockFileOps;
    let mockBacklog;
    let mockTechStack;

    beforeEach(() => {
      mockExecutor = {
        execute: async () => ({ stdout: '{}', stderr: '', exitCode: 0 }),
      };

      mockFileOps = {
        readFile: async () => JSON.stringify({ dependencies: {} }),
        exists: async () => false,
      };

      mockBacklog = {
        saveStepSummary: async () => {},
      };

      mockTechStack = {
        detectAll: async () => ({ languages: ['javascript'] }),
      };

      validator = new Step9DependencyValidator({
        executor: mockExecutor,
        fileOps: mockFileOps,
        backlog: mockBacklog,
        techStack: mockTechStack,
        aiHelper: { initialize: () => Promise.resolve(false) },
      });
    });

    test('skips validation for shell projects', async () => {
      mockTechStack.detectAll = async () => ({ languages: ['bash'] });

      const result = await validator.execute('/project');

      expect(result.success).toBe(true);
      expect(result.skipped).toBe(true);
    });

    test('validates dependencies successfully', async () => {
      mockFileOps.exists = async () => true;
      mockFileOps.readFile = async () =>
        JSON.stringify({
          dependencies: { react: '^18.0.0' },
          devDependencies: { jest: '^29.0.0' },
        });

      mockExecutor.execute = async (cmd) => {
        if (cmd.includes('audit')) {
          return {
            stdout: JSON.stringify({
              metadata: { vulnerabilities: { total: 0 } },
              vulnerabilities: {},
            }),
          };
        }
        if (cmd.includes('outdated')) {
          return { stdout: '{}' };
        }
        return { stdout: '{}' };
      };

      const result = await validator.execute('/project');

      expect(result.success).toBe(true);
      expect(result.dependencyCounts.total).toBe(2);
    });

    test('detects vulnerabilities', async () => {
      mockFileOps.exists = async () => true;
      mockFileOps.readFile = async () => JSON.stringify({ dependencies: { lodash: '^4.17.15' } });

      mockExecutor.execute = async (cmd) => {
        if (cmd.includes('audit')) {
          throw {
            exitCode: 1,
            stdout: JSON.stringify({
              metadata: {
                vulnerabilities: { total: 1, critical: 1, high: 0 },
              },
              vulnerabilities: {
                lodash: { severity: 'critical' },
              },
            }),
          };
        }
        return { stdout: '{}' };
      };

      const result = await validator.execute('/project');

      expect(result.success).toBe(true);
      expect(result.hasSecurityIssues).toBe(true);
      expect(result.vulnerabilities.summary.critical).toBe(1);
    });

    test('finds outdated packages', async () => {
      mockFileOps.exists = async () => true;
      mockFileOps.readFile = async () => JSON.stringify({ dependencies: { lodash: '^4.17.15' } });

      mockExecutor.execute = async (cmd) => {
        if (cmd.includes('audit')) {
          return {
            stdout: JSON.stringify({
              metadata: { vulnerabilities: { total: 0 } },
              vulnerabilities: {},
            }),
          };
        }
        if (cmd.includes('outdated')) {
          return {
            stdout: JSON.stringify({
              lodash: {
                current: '4.17.15',
                wanted: '4.17.21',
                latest: '4.17.21',
              },
            }),
          };
        }
        return { stdout: '{}' };
      };

      const result = await validator.execute('/project');

      expect(result.success).toBe(true);
      expect(result.outdatedPackages).toHaveLength(1);
    });

    test('validates Python project dependencies', async () => {
      mockTechStack.detectAll = async () => ({ languages: ['python'] });
      mockFileOps.exists = async () => true;
      mockFileOps.readFile = async () => 'requests==2.31.0\nflask>=2.0.0\n';

      mockExecutor.execute = async () => ({ stdout: JSON.stringify([]) });

      const result = await validator.execute('/project');

      expect(result.success).toBe(true);
      expect(result.dependencyCounts.total).toBe(2);
    });

    test('validates Rust project dependencies', async () => {
      mockTechStack.detectAll = async () => ({ languages: ['rust'] });
      mockFileOps.exists = async () => true;
      mockFileOps.readFile = async () =>
        `[package]\nname = "myapp"\n\n[dependencies]\nserde = "1.0"\ntokio = "1"\n`;

      mockExecutor.execute = async () => ({
        stdout: JSON.stringify({ vulnerabilities: { list: [] } }),
      });

      const result = await validator.execute('/project');

      expect(result.success).toBe(true);
      expect(result.dependencyCounts.total).toBe(2);
    });

    test('validates Go project dependencies', async () => {
      mockTechStack.detectAll = async () => ({ languages: ['go'] });
      mockFileOps.exists = async () => true;
      mockFileOps.readFile = async () =>
        `module example.com/mymod\n\ngo 1.21\n\nrequire (\n\tgithub.com/gin-gonic/gin v1.9.1\n)\n`;

      mockExecutor.execute = async () => ({ stdout: '' });

      const result = await validator.execute('/project');

      expect(result.success).toBe(true);
      expect(result.dependencyCounts.total).toBe(1);
    });

    // [BUG FIX 0f99feb] promptsDir must be forwarded so AI exchanges are saved
    test('[BUG FIX] promptsDir option is accepted without error', () => {
      const instance = new Step9DependencyValidator({
        executor: mockExecutor,
        fileOps: mockFileOps,
        backlog: mockBacklog,
        techStack: mockTechStack,
        promptsDir: '/tmp/prompts/step_09',
      });
      expect(instance).toBeDefined();
      expect(instance.aiHelper).toBeDefined();
    });
  });

  // ==========================================================================
  // PURE FUNCTIONS - Lockfile Integrity (a3)
  // ==========================================================================

  describe('validateLockfileStructure', () => {
    let tmpDir;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'step09-test-'));
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    function writeLockfile(content) {
      const lockfilePath = path.join(tmpDir, 'package-lock.json');
      fs.writeFileSync(lockfilePath, JSON.stringify(content, null, 2));
      return lockfilePath;
    }

    test('returns valid for a well-formed lockfile', () => {
      const lockfilePath = writeLockfile({
        lockfileVersion: 3,
        packages: {
          '': { name: 'my-app', version: '1.0.0' },
          'node_modules/lodash': {
            version: '4.17.21',
            resolved: 'https://registry.npmjs.org/lodash/-/lodash-4.17.21.tgz',
            integrity: 'sha512-abc123==',
          },
        },
      });
      const result = validateLockfileStructure(lockfilePath);
      expect(result.valid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    test('returns issue for non-HTTPS resolved URL', () => {
      const lockfilePath = writeLockfile({
        lockfileVersion: 3,
        packages: {
          'node_modules/evil': {
            version: '1.0.0',
            resolved: 'http://evil.example.com/evil.tgz',
            integrity: 'sha512-abc==',
          },
        },
      });
      const result = validateLockfileStructure(lockfilePath);
      expect(result.valid).toBe(false);
      expect(result.issues.some((i) => i.includes('non-HTTPS'))).toBe(true);
    });

    test('returns issue for empty integrity hash', () => {
      const lockfilePath = writeLockfile({
        lockfileVersion: 3,
        packages: {
          'node_modules/foo': {
            version: '1.0.0',
            resolved: 'https://registry.npmjs.org/foo/-/foo-1.0.0.tgz',
            integrity: '',
          },
        },
      });
      const result = validateLockfileStructure(lockfilePath);
      expect(result.valid).toBe(false);
      expect(result.issues.some((i) => i.includes('empty integrity hash'))).toBe(true);
    });

    test('returns issue for invalid version string', () => {
      const lockfilePath = writeLockfile({
        lockfileVersion: 3,
        packages: {
          'node_modules/bar': {
            version: 'not-a-version',
            resolved: 'https://registry.npmjs.org/bar/-/bar-1.0.0.tgz',
            integrity: 'sha512-abc==',
          },
        },
      });
      const result = validateLockfileStructure(lockfilePath);
      expect(result.valid).toBe(false);
      expect(result.issues.some((i) => i.includes('invalid version'))).toBe(true);
    });

    test('skips link entries (workspace symlinks)', () => {
      const lockfilePath = writeLockfile({
        lockfileVersion: 3,
        packages: {
          'node_modules/my-workspace-pkg': { link: true },
        },
      });
      const result = validateLockfileStructure(lockfilePath);
      expect(result.valid).toBe(true);
    });

    test('returns error for unparseable lockfile', () => {
      const lockfilePath = path.join(tmpDir, 'package-lock.json');
      fs.writeFileSync(lockfilePath, 'not valid json {{{');
      const result = validateLockfileStructure(lockfilePath);
      expect(result.valid).toBe(false);
      expect(result.issues[0]).toMatch(/Cannot parse lockfile/);
    });

    test('returns error for missing lockfile', () => {
      const result = validateLockfileStructure(path.join(tmpDir, 'nonexistent.json'));
      expect(result.valid).toBe(false);
    });
  });

  describe('computeLockfileHash', () => {
    let tmpDir;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'step09-hash-test-'));
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    test('returns a SHA256 hex string for a valid file', () => {
      const lockfilePath = path.join(tmpDir, 'package-lock.json');
      fs.writeFileSync(lockfilePath, '{"lockfileVersion":3}');
      const hash = computeLockfileHash(lockfilePath);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    test('returns different hashes for different content', () => {
      const p1 = path.join(tmpDir, 'lock1.json');
      const p2 = path.join(tmpDir, 'lock2.json');
      fs.writeFileSync(p1, '{"lockfileVersion":3,"a":1}');
      fs.writeFileSync(p2, '{"lockfileVersion":3,"a":2}');
      expect(computeLockfileHash(p1)).not.toBe(computeLockfileHash(p2));
    });

    test('returns same hash for identical content', () => {
      const content = '{"lockfileVersion":3}';
      const p1 = path.join(tmpDir, 'lock1.json');
      const p2 = path.join(tmpDir, 'lock2.json');
      fs.writeFileSync(p1, content);
      fs.writeFileSync(p2, content);
      expect(computeLockfileHash(p1)).toBe(computeLockfileHash(p2));
    });

    test('returns empty string for missing file', () => {
      const hash = computeLockfileHash(path.join(tmpDir, 'nonexistent.json'));
      expect(hash).toBe('');
    });
  });
});
