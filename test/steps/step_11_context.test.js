/**
 * Tests for Step 11: Context Analysis
 * @group steps
 */

import {
  Step11ContextAnalyzer,
  calculateCompletionRate,
  determineCompletionStatus,
  calculateImpactScore,
  determineImpactLevel,
  aggregateIssues,
  calculateDuration,
  formatDuration,
  formatContextReport,
} from '../../src/steps/step_11_context.js';

describe('Step 11: Context Analysis', () => {
  // ========================================================================
  // PURE FUNCTIONS - Context Analysis
  // ========================================================================

  describe('calculateCompletionRate', () => {
    test('calculates 100% completion', () => {
      expect(calculateCompletionRate(10, 10)).toBe(100);
    });

    test('calculates 50% completion', () => {
      expect(calculateCompletionRate(5, 10)).toBe(50);
    });

    test('handles zero total steps', () => {
      expect(calculateCompletionRate(5, 0)).toBe(0);
    });

    test('rounds to nearest integer', () => {
      expect(calculateCompletionRate(7, 10)).toBe(70);
    });
  });

  describe('determineCompletionStatus', () => {
    test('returns excellent for 90%+', () => {
      expect(determineCompletionStatus(95)).toBe('excellent');
    });

    test('returns good for 75-89%', () => {
      expect(determineCompletionStatus(80)).toBe('good');
    });

    test('returns moderate for 50-74%', () => {
      expect(determineCompletionStatus(60)).toBe('moderate');
    });

    test('returns poor for <50%', () => {
      expect(determineCompletionStatus(40)).toBe('poor');
    });
  });

  describe('calculateImpactScore', () => {
    test('calculates score for many modified files', () => {
      const changes = { modifiedFiles: 15, dependenciesModified: false };
      expect(calculateImpactScore(changes)).toBe(3);
    });

    test('adds score for dependency changes', () => {
      const changes = { modifiedFiles: 5, dependenciesModified: true };
      expect(calculateImpactScore(changes)).toBe(3); // 1 + 2
    });

    test('adds score for script changes', () => {
      const changes = { modifiedFiles: 0, scriptsModified: true };
      expect(calculateImpactScore(changes)).toBe(1);
    });

    test('adds score for config changes', () => {
      const changes = { modifiedFiles: 0, configModified: true };
      expect(calculateImpactScore(changes)).toBe(1);
    });

    test('calculates cumulative score', () => {
      const changes = {
        modifiedFiles: 12,
        dependenciesModified: true,
        scriptsModified: true,
        configModified: true,
      };
      expect(calculateImpactScore(changes)).toBe(7); // 3 + 2 + 1 + 1
    });
  });

  describe('determineImpactLevel', () => {
    test('returns high for score >= 5', () => {
      expect(determineImpactLevel(6)).toBe('high');
    });

    test('returns medium for score 3-4', () => {
      expect(determineImpactLevel(4)).toBe('medium');
    });

    test('returns low for score < 3', () => {
      expect(determineImpactLevel(2)).toBe('low');
    });
  });

  describe('aggregateIssues', () => {
    test('aggregates successful results', () => {
      const results = [{ success: true }, { success: true }, { success: true }];

      const summary = aggregateIssues(results);

      expect(summary.passed).toBe(3);
      expect(summary.total).toBe(0);
    });

    test('aggregates critical failures', () => {
      const results = [{ success: false }, { success: false }, { success: true }];

      const summary = aggregateIssues(results);

      expect(summary.critical).toBe(2);
      expect(summary.total).toBe(2);
      expect(summary.passed).toBe(1);
    });

    test('aggregates warnings', () => {
      const results = [
        { success: true, warnings: ['warning1'] },
        { success: true, warnings: ['warning2'] },
        { success: true },
      ];

      const summary = aggregateIssues(results);

      expect(summary.warnings).toBe(2);
      expect(summary.total).toBe(2);
    });

    test('handles mixed results', () => {
      const results = [
        { success: false },
        { success: true, warnings: ['warning'] },
        { success: true },
      ];

      const summary = aggregateIssues(results);

      expect(summary.critical).toBe(1);
      expect(summary.warnings).toBe(1);
      expect(summary.passed).toBe(1);
      expect(summary.total).toBe(2);
    });
  });

  describe('calculateDuration', () => {
    test('calculates duration in seconds', () => {
      const start = 1000000;
      const end = 1005000;
      expect(calculateDuration(start, end)).toBe(5);
    });

    test('rounds to nearest second', () => {
      const start = 1000000;
      const end = 1002500;
      expect(calculateDuration(start, end)).toBe(3);
    });
  });

  describe('formatDuration', () => {
    test('formats seconds', () => {
      expect(formatDuration(45)).toBe('45s');
    });

    test('formats minutes and seconds', () => {
      expect(formatDuration(125)).toBe('2m 5s');
    });

    test('formats hours, minutes, and seconds', () => {
      expect(formatDuration(3665)).toBe('1h 1m 5s');
    });
  });

  // ========================================================================
  // PURE FUNCTIONS - Reporting
  // ========================================================================

  describe('formatContextReport', () => {
    test('formats report with excellent completion', () => {
      const context = {
        completionRate: 100,
        completionStatus: 'excellent',
        completedSteps: 11,
        totalSteps: 11,
        gitStatus: { isGitRepo: false },
        changeImpact: 'low',
        impactScore: 2,
        issues: { total: 0, critical: 0, warnings: 0, passed: 11 },
        duration: 120,
      };

      const report = formatContextReport(context);

      expect(report).toContain('Workflow Context Analysis');
      expect(report).toContain('100%');
      expect(report).toContain('Excellent');
      expect(report).toContain('LOW');
    });

    test('formats report with git status', () => {
      const context = {
        completionRate: 80,
        completionStatus: 'good',
        completedSteps: 8,
        totalSteps: 10,
        gitStatus: {
          isGitRepo: true,
          branch: 'main',
          modifiedFiles: 5,
          untrackedFiles: 2,
          stagedFiles: 3,
          commitsAhead: 1,
        },
        changeImpact: 'medium',
        impactScore: 4,
        issues: { total: 1, critical: 0, warnings: 1, passed: 8 },
        duration: 300,
      };

      const report = formatContextReport(context);

      expect(report).toContain('Git Repository State');
      expect(report).toContain('**Branch**: main');
      expect(report).toContain('**Modified Files**: 5');
    });

    test('formats report with critical issues', () => {
      const context = {
        completionRate: 60,
        completionStatus: 'moderate',
        completedSteps: 6,
        totalSteps: 10,
        gitStatus: { isGitRepo: false },
        changeImpact: 'high',
        impactScore: 6,
        issues: { total: 3, critical: 2, warnings: 1, passed: 6 },
        duration: 180,
      };

      const report = formatContextReport(context);

      expect(report).toContain('**Critical**: 2');
      expect(report).toContain('Critical issues detected');
      expect(report).toContain('HIGH');
    });
  });

  // ========================================================================
  // STEP 11 ANALYZER - Integration Tests
  // ========================================================================

  describe('Step11ContextAnalyzer', () => {
    let analyzer;
    let mockFileOps;
    let mockBacklog;
    let mockGit;

    beforeEach(() => {
      mockFileOps = {};

      mockBacklog = {
        saveStepSummary: async () => {},
      };

      mockGit = {
        isRepository: async () => false,
        status: async () => ({
          branch: 'main',
          modified: [],
          untracked: [],
          staged: [],
          ahead: 0,
        }),
      };

      analyzer = new Step11ContextAnalyzer({
        fileOps: mockFileOps,
        backlog: mockBacklog,
        git: mockGit,
        startTime: Date.now() - 60000, // 1 minute ago
      });
    });

    test('analyzes workflow completion', async () => {
      const workflowContext = {
        completedSteps: 10,
        totalSteps: 11,
        stepResults: [{ success: true }],
      };

      const result = await analyzer.execute('/project', workflowContext);

      expect(result.success).toBe(true);
      expect(result.completionRate).toBe(91);
      expect(result.completionStatus).toBe('excellent');
    });

    test('analyzes git repository state', async () => {
      mockGit.isRepository = async () => true;
      mockGit.status = async () => ({
        branch: 'feature',
        modified: ['file1.js', 'file2.js'],
        untracked: ['file3.js'],
        staged: ['file4.js'],
        ahead: 2,
      });

      const workflowContext = {
        completedSteps: 8,
        totalSteps: 10,
        stepResults: [],
      };

      const result = await analyzer.execute('/project', workflowContext);

      expect(result.gitStatus.isGitRepo).toBe(true);
      expect(result.gitStatus.branch).toBe('feature');
      expect(result.gitStatus.modifiedFiles).toBe(2);
    });

    test('calculates change impact', async () => {
      mockGit.isRepository = async () => true;
      mockGit.status = async () => ({
        modified: Array(12).fill('file.js'),
        untracked: [],
        staged: ['package.json'],
      });

      const workflowContext = {
        completedSteps: 9,
        totalSteps: 10,
        stepResults: [],
      };

      const result = await analyzer.execute('/project', workflowContext);

      expect(result.impactScore).toBeGreaterThan(0);
      expect(result.changeImpact).toBeTruthy();
    });

    test('aggregates workflow issues', async () => {
      const workflowContext = {
        completedSteps: 8,
        totalSteps: 10,
        stepResults: [
          { success: false },
          { success: false },
          { success: true, warnings: ['warning'] },
          { success: true },
        ],
      };

      const result = await analyzer.execute('/project', workflowContext);

      expect(result.issues.critical).toBe(2);
      expect(result.issues.warnings).toBe(1);
      expect(result.issues.passed).toBe(1);
      expect(result.success).toBe(false);
    });

    test('calculates workflow duration', async () => {
      const workflowContext = {
        completedSteps: 10,
        totalSteps: 10,
        stepResults: [],
      };

      const result = await analyzer.execute('/project', workflowContext);

      expect(result.duration).toBeGreaterThan(0);
    });
  });
});
