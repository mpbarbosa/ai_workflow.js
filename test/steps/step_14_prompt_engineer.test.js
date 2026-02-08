/**
 * Tests for Step 14: Prompt Engineer Analysis
 * @group steps
 */

import { jest } from '@jest/globals';
import {
  Step14PromptEngineer,
  PROJECT_TYPES,
  shouldRunPromptAnalysis,
  extractPersonaNames,
  extractPromptContent,
  calculatePromptQuality,
  determineQualityRating,
  identifyImprovements,
  calculateAggregateStats,
  formatAnalysisReport,
} from '../../src/steps/step_14_prompt_engineer.js';

describe('Step 14: Prompt Engineer Analysis', () => {
  // ========================================================================
  // PURE FUNCTIONS - Prompt Analysis
  // ========================================================================

  describe('shouldRunPromptAnalysis', () => {
    test('returns true for workflow-automation', () => {
      expect(shouldRunPromptAnalysis(PROJECT_TYPES.workflowAutomation)).toBe(true);
    });

    test('returns true for bash-automation-framework', () => {
      expect(shouldRunPromptAnalysis(PROJECT_TYPES.bashFramework)).toBe(true);
    });

    test('returns false for other project types', () => {
      expect(shouldRunPromptAnalysis('nodejs_api')).toBe(false);
      expect(shouldRunPromptAnalysis('react_spa')).toBe(false);
    });
  });

  describe('extractPersonaNames', () => {
    test('extracts persona names from YAML', () => {
      const yaml = `doc_analysis_prompt:
  role: |
    You are a documentation expert
step2_consistency_prompt:
  role: |
    You are a consistency checker`;
      const names = extractPersonaNames(yaml);
      expect(names).toEqual(['doc_analysis', 'step2_consistency']);
    });

    test('returns empty array for no prompts', () => {
      const yaml = `some_config:
  value: test`;
      expect(extractPersonaNames(yaml)).toEqual([]);
    });
  });

  describe('extractPromptContent', () => {
    test('extracts prompt sections', () => {
      const yaml = `doc_analysis_prompt:
  role: |
    You are a documentation expert
  task_template: |
    Analyze the documentation
  approach: |
    Review for clarity and completeness`;

      const content = extractPromptContent(yaml, 'doc_analysis');
      expect(content).not.toBeNull();
      expect(content.role).toContain('documentation expert');
      expect(content.task).toContain('Analyze');
      expect(content.approach).toContain('Review');
    });

    test('returns null for non-existent persona', () => {
      const yaml = `doc_analysis_prompt:
  role: |
    You are a documentation expert`;

      expect(extractPromptContent(yaml, 'nonexistent')).toBeNull();
    });

    test('handles missing sections', () => {
      const yaml = `test_prompt:
  role: |
    You are a tester`;

      const content = extractPromptContent(yaml, 'test');
      expect(content).not.toBeNull();
      expect(content.role).toContain('tester');
      expect(content.task).toBe('');
      expect(content.approach).toBe('');
    });
  });

  describe('calculatePromptQuality', () => {
    test('scores high for complete prompt', () => {
      const prompt = {
        role: 'You are a senior documentation specialist with expertise in technical writing',
        task: 'Analyze the documentation for clarity, completeness, and validate against standards',
        approach:
          'Review each section systematically, checking for clarity and providing examples where needed. For instance, check that code examples are complete and runnable.',
      };
      const score = calculatePromptQuality(prompt);
      expect(score).toBeGreaterThan(80);
    });

    test('scores low for minimal prompt', () => {
      const prompt = {
        role: 'Expert',
        task: 'Review',
        approach: 'Check',
      };
      const score = calculatePromptQuality(prompt);
      expect(score).toBeLessThan(50);
    });

    test('awards points for specific action verbs', () => {
      const prompt1 = {
        role: 'You are a documentation expert with deep knowledge',
        task: 'Analyze and identify issues in documentation',
        approach: 'Systematic review approach',
      };
      const prompt2 = {
        role: 'You are a documentation expert with deep knowledge',
        task: 'Look at the documentation',
        approach: 'Systematic review approach',
      };

      const score1 = calculatePromptQuality(prompt1);
      const score2 = calculatePromptQuality(prompt2);
      expect(score1).toBeGreaterThan(score2);
    });
  });

  describe('determineQualityRating', () => {
    test('returns excellent for high scores', () => {
      expect(determineQualityRating(95)).toBe('excellent');
      expect(determineQualityRating(90)).toBe('excellent');
    });

    test('returns good for medium-high scores', () => {
      expect(determineQualityRating(85)).toBe('good');
      expect(determineQualityRating(75)).toBe('good');
    });

    test('returns needs-improvement for medium scores', () => {
      expect(determineQualityRating(65)).toBe('needs-improvement');
      expect(determineQualityRating(60)).toBe('needs-improvement');
    });

    test('returns poor for low scores', () => {
      expect(determineQualityRating(50)).toBe('poor');
      expect(determineQualityRating(30)).toBe('poor');
    });
  });

  describe('identifyImprovements', () => {
    test('identifies missing role', () => {
      const prompt = { role: '', task: 'Do something', approach: 'Some approach' };
      const improvements = identifyImprovements(prompt, 50);
      expect(improvements).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            category: 'clarity',
            issue: 'Role definition is missing or too brief',
          }),
        ])
      );
    });

    test('identifies missing task', () => {
      const prompt = { role: 'You are an expert', task: '', approach: 'Some approach' };
      const improvements = identifyImprovements(prompt, 50);
      expect(improvements).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            category: 'specificity',
            issue: 'Task description is missing or too brief',
          }),
        ])
      );
    });

    test('identifies lack of action verbs', () => {
      const prompt = {
        role: 'You are an expert with deep knowledge',
        task: 'Look at the code and check things',
        approach: 'Review systematically',
      };
      const improvements = identifyImprovements(prompt, 60);
      expect(improvements).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            category: 'specificity',
            issue: 'Task lacks action verbs',
          }),
        ])
      );
    });

    test('identifies missing examples', () => {
      const prompt = {
        role: 'You are an expert in code review',
        task: 'Analyze the code for issues and validate against standards',
        approach: 'Systematic review of all code sections',
      };
      const improvements = identifyImprovements(prompt, 70);
      expect(improvements).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            category: 'examples',
            issue: 'No examples provided',
          }),
        ])
      );
    });

    test('returns empty for high-quality prompt', () => {
      const prompt = {
        role: 'You are a senior code reviewer with expertise in best practices',
        task: 'Analyze the code for issues, identify bugs, and validate against coding standards',
        approach:
          'Systematically review all code sections, checking for common anti-patterns and providing specific examples of improvements. For instance, flag any functions over 50 lines.',
      };
      const improvements = identifyImprovements(prompt, 95);
      expect(improvements).toHaveLength(0);
    });
  });

  describe('calculateAggregateStats', () => {
    test('calculates stats for empty array', () => {
      const stats = calculateAggregateStats([]);
      expect(stats.totalPrompts).toBe(0);
      expect(stats.averageScore).toBe(0);
    });

    test('calculates stats for multiple analyses', () => {
      const analyses = [
        { score: 95, rating: 'excellent', improvements: [] },
        { score: 80, rating: 'good', improvements: [{}] },
        { score: 65, rating: 'needs-improvement', improvements: [{}, {}] },
      ];
      const stats = calculateAggregateStats(analyses);
      expect(stats.totalPrompts).toBe(3);
      expect(stats.averageScore).toBe(80); // (95+80+65)/3
      expect(stats.excellentCount).toBe(1);
      expect(stats.goodCount).toBe(1);
      expect(stats.needsImprovementCount).toBe(1);
      expect(stats.totalImprovements).toBe(3);
    });
  });

  // ========================================================================
  // PURE FUNCTIONS - Report Generation
  // ========================================================================

  describe('formatAnalysisReport', () => {
    test('formats report with no improvements', () => {
      const data = {
        stats: {
          totalPrompts: 5,
          averageScore: 92,
          excellentCount: 4,
          goodCount: 1,
          needsImprovementCount: 0,
          poorCount: 0,
          totalImprovements: 0,
        },
        analyses: [],
      };
      const report = formatAnalysisReport(data);
      expect(report).toContain('Prompt Engineer Analysis Report');
      expect(report).toContain('Total Prompts Analyzed:** 5');
      expect(report).toContain('Average Quality Score:** 92/100');
      expect(report).toContain('Total Improvement Opportunities:** 0');
    });

    test('formats report with improvements', () => {
      const data = {
        stats: {
          totalPrompts: 3,
          averageScore: 70,
          excellentCount: 0,
          goodCount: 1,
          needsImprovementCount: 2,
          poorCount: 0,
          totalImprovements: 5,
        },
        analyses: [
          {
            personaName: 'doc_analysis',
            score: 65,
            improvements: [{}, {}, {}],
          },
          {
            personaName: 'test_review',
            score: 75,
            improvements: [],
          },
          {
            personaName: 'code_quality',
            score: 70,
            improvements: [{}, {}],
          },
        ],
      };
      const report = formatAnalysisReport(data);
      expect(report).toContain('Prompts Needing Attention');
      expect(report).toContain('doc_analysis');
      expect(report).toContain('code_quality');
    });
  });

  // ========================================================================
  // STEP14PROMPTENGINEER - Integration Tests
  // ========================================================================

  describe('Step14PromptEngineer', () => {
    let mockFileOps;
    let mockBacklog;
    let mockLogger;

    beforeEach(() => {
      mockFileOps = {
        readFile: jest.fn(),
      };
      mockBacklog = {
        saveStepSummary: jest.fn(),
        saveStepIssues: jest.fn(),
      };
      mockLogger = {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      };
    });

    test('constructs with default options', () => {
      const step = new Step14PromptEngineer();
      expect(step).toBeInstanceOf(Step14PromptEngineer);
      expect(step.dryRun).toBe(false);
    });

    test('constructs with custom options', () => {
      const step = new Step14PromptEngineer({
        fileOps: mockFileOps,
        backlogManager: mockBacklog,
        logger: mockLogger,
        dryRun: true,
        configPath: 'custom/path.yaml',
      });
      expect(step.fileOps).toBe(mockFileOps);
      expect(step.dryRun).toBe(true);
      expect(step.configPath).toBe('custom/path.yaml');
    });

    test('executes dry-run mode', async () => {
      const step = new Step14PromptEngineer({
        backlogManager: mockBacklog,
        logger: mockLogger,
        dryRun: true,
      });

      const result = await step.execute();

      expect(result.success).toBe(true);
      expect(result.dryRun).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith(
        '[DRY RUN] Prompt engineering analysis preview:'
      );
    });

    test('skips for non-eligible project type', async () => {
      const step = new Step14PromptEngineer({
        backlogManager: mockBacklog,
        logger: mockLogger,
      });

      const result = await step.execute({ projectType: 'nodejs_api' });

      expect(result.success).toBe(true);
      expect(result.skipped).toBe(true);
      expect(result.reason).toBe('project type not eligible');
      expect(mockBacklog.saveStepSummary).toHaveBeenCalledWith(
        '14',
        'Prompt_Engineer_Analysis',
        expect.stringContaining('Skipped'),
        '✅'
      );
    });

    test('handles missing configuration file', async () => {
      mockFileOps.readFile = jest.fn().mockRejectedValue(new Error('File not found'));

      const step = new Step14PromptEngineer({
        fileOps: mockFileOps,
        backlogManager: mockBacklog,
        logger: mockLogger,
      });

      const result = await step.execute({
        projectType: PROJECT_TYPES.workflowAutomation,
      });

      expect(result.success).toBe(true);
      expect(result.skipped).toBe(true);
      expect(result.reason).toBe('configuration not found');
    });

    test('executes successful analysis', async () => {
      const yamlContent = `doc_analysis_prompt:
  role: |
    You are a senior documentation specialist with expertise
  task_template: |
    Analyze the documentation and identify issues systematically
  approach: |
    Review each section systematically, checking for clarity and providing examples where needed. For instance, check code examples.`;

      mockFileOps.readFile = jest.fn().mockResolvedValue(yamlContent);

      const step = new Step14PromptEngineer({
        fileOps: mockFileOps,
        backlogManager: mockBacklog,
        logger: mockLogger,
      });

      const result = await step.execute({
        projectType: PROJECT_TYPES.workflowAutomation,
      });

      expect(result.success).toBe(true);
      expect(result.stats).toBeDefined();
      expect(result.stats.totalPrompts).toBe(1);
      expect(result.analyses).toHaveLength(1);
      expect(mockBacklog.saveStepSummary).toHaveBeenCalled();
    });
  });
});
