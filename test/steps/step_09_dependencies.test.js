/**
 * Tests for Step 9: Dependency Validation
 * @group steps
 */

import {
  Step9DependencyValidator,
  getDependencyFiles,
  getAuditCommand,
  getOutdatedCommand,
  supportsDependencyValidation,
  parsePackageJson,
  parseNpmAudit,
  parseNpmOutdated,
  determineSeverity,
  formatDependencyReport,
  SEVERITY,
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
    test('returns npm audit for JavaScript', () => {
      expect(getAuditCommand('javascript')).toBe('npm audit --json');
    });

    test('returns pip-audit for Python', () => {
      expect(getAuditCommand('python')).toBe('pip-audit --format json');
    });

    test('returns null for unknown language', () => {
      expect(getAuditCommand('unknown')).toBeNull();
    });
  });

  describe('getOutdatedCommand', () => {
    test('returns npm outdated for JavaScript', () => {
      expect(getOutdatedCommand('javascript')).toBe('npm outdated --json');
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
  // STEP 9 VALIDATOR - Integration Tests
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

      expect(result.success).toBe(false);
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
  });
});
