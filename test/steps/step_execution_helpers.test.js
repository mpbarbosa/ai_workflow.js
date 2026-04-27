import { jest } from '@jest/globals';

import { logger } from '../../src/core/logger.js';
import { buildStructuredPrompt, injectProjectContext } from '../../src/lib/ai_prompt_builder.js';
import {
  buildStepPromptWithFallback,
  detectAndLogPrimaryLanguage,
  detectPrimaryLanguage,
  enrichStepSummaryWithOptionalAiAnalysis,
  initializeStepAiContext,
  logLanguageAwareSkippedStepOutcomeAndReturn,
  logSkippedStepOutcomeAndReturn,
  logStepOutcomeAndReturn,
  saveStepSummaryWithAnalysisSections,
} from '../../src/steps/step_execution_helpers.js';

describe('step_execution_helpers', () => {
  test('detectPrimaryLanguage delegates to the provided tech stack detector', async () => {
    const detectTechStack = jest.fn().mockResolvedValue({ primaryLanguage: 'typescript' });

    await expect(detectPrimaryLanguage({ detectTechStack }, '/repo')).resolves.toBe('typescript');
    expect(detectTechStack).toHaveBeenCalledWith('/repo');
  });

  test('detectAndLogPrimaryLanguage logs the detected language', async () => {
    const detectTechStack = jest.fn().mockResolvedValue({ primaryLanguage: 'javascript' });
    const infoSpy = jest.spyOn(logger, 'info').mockImplementation(() => {});

    await expect(detectAndLogPrimaryLanguage({ detectTechStack }, '/repo')).resolves.toBe(
      'javascript'
    );
    expect(infoSpy).toHaveBeenCalledWith('Detected language: javascript');

    infoSpy.mockRestore();
  });

  test('logStepOutcomeAndReturn logs, saves, and returns the provided result', async () => {
    const backlog = {
      saveStepSummary: jest.fn().mockResolvedValue(undefined),
    };
    const warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => {});
    const result = { success: false, message: 'No test command' };

    await expect(
      logStepOutcomeAndReturn({
        backlog,
        stepId: 8,
        stepName: 'Test Execution',
        logMethod: 'warn',
        logMessage: 'No test command found',
        summary: '# Summary',
        result,
        icon: '⚠️',
      })
    ).resolves.toBe(result);

    expect(warnSpy).toHaveBeenCalledWith('No test command found');
    expect(backlog.saveStepSummary).toHaveBeenCalledWith(8, 'Test Execution', '# Summary', '⚠️');

    warnSpy.mockRestore();
  });

  test('logStepOutcomeAndReturn rejects unsupported log methods', async () => {
    await expect(
      logStepOutcomeAndReturn({
        backlog: { saveStepSummary: jest.fn() },
        stepId: 1,
        stepName: 'Example',
        logMethod: 'trace',
        logMessage: 'unsupported',
        summary: '# Summary',
        result: {},
      })
    ).rejects.toThrow('Unsupported log method: trace');
  });

  test('logSkippedStepOutcomeAndReturn logs, saves, and returns a standardized skipped result', async () => {
    const backlog = {
      saveStepSummary: jest.fn().mockResolvedValue(undefined),
    };
    const infoSpy = jest.spyOn(logger, 'info').mockImplementation(() => {});

    await expect(
      logSkippedStepOutcomeAndReturn({
        backlog,
        stepId: 8,
        stepName: 'Test Execution',
        logMessage: 'Skipping test execution: not applicable',
        summary: '# Test Execution Report',
        result: {
          language: 'markdown',
          testResults: {},
          coverage: {},
        },
        message: 'Tests are not applicable',
        reason: 'tests_not_applicable',
      })
    ).resolves.toEqual({
      success: true,
      skipped: true,
      language: 'markdown',
      testResults: {},
      coverage: {},
      message: 'Tests are not applicable',
      reason: 'tests_not_applicable',
    });

    expect(infoSpy).toHaveBeenCalledWith('Skipping test execution: not applicable');
    expect(backlog.saveStepSummary).toHaveBeenCalledWith(
      8,
      'Test Execution',
      '# Test Execution Report',
      undefined
    );

    infoSpy.mockRestore();
  });

  test('logLanguageAwareSkippedStepOutcomeAndReturn merges the detected language into the skipped result', async () => {
    const backlog = {
      saveStepSummary: jest.fn().mockResolvedValue(undefined),
    };
    const warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => {});

    await expect(
      logLanguageAwareSkippedStepOutcomeAndReturn({
        backlog,
        stepId: 9,
        stepName: 'Dependency Validation',
        language: 'typescript',
        logMethod: 'warn',
        logMessage: 'No dependency files found',
        summary: '# Dependency Validation Report',
        result: {
          dependencyFiles: [],
        },
        message: 'No dependency files found',
      })
    ).resolves.toEqual({
      success: true,
      skipped: true,
      language: 'typescript',
      dependencyFiles: [],
      message: 'No dependency files found',
    });

    expect(warnSpy).toHaveBeenCalledWith('No dependency files found');
    expect(backlog.saveStepSummary).toHaveBeenCalledWith(
      9,
      'Dependency Validation',
      '# Dependency Validation Report',
      undefined
    );

    warnSpy.mockRestore();
  });

  test('initializeStepAiContext skips initialization when explicitly disabled', async () => {
    const aiHelper = { initialize: jest.fn() };
    const aiCache = { init: jest.fn() };

    await expect(
      initializeStepAiContext({
        aiHelper,
        aiCache,
        shouldInitialize: false,
      })
    ).resolves.toBe(false);

    expect(aiHelper.initialize).not.toHaveBeenCalled();
    expect(aiCache.init).not.toHaveBeenCalled();
  });

  test('initializeStepAiContext returns false when AI helper is unavailable', async () => {
    const aiHelper = { initialize: jest.fn().mockResolvedValue(false) };
    const aiCache = { init: jest.fn() };

    await expect(initializeStepAiContext({ aiHelper, aiCache })).resolves.toBe(false);

    expect(aiHelper.initialize).toHaveBeenCalledTimes(1);
    expect(aiCache.init).not.toHaveBeenCalled();
  });

  test('initializeStepAiContext initializes AI cache only after AI helper succeeds', async () => {
    const aiHelper = { initialize: jest.fn().mockResolvedValue(true) };
    const aiCache = { init: jest.fn().mockResolvedValue(undefined) };

    await expect(initializeStepAiContext({ aiHelper, aiCache })).resolves.toBe(true);

    expect(aiHelper.initialize).toHaveBeenCalledTimes(1);
    expect(aiCache.init).toHaveBeenCalledTimes(1);
  });

  test('enrichStepSummaryWithOptionalAiAnalysis logs unavailability and skips analysis when AI is unavailable', async () => {
    const backlog = {
      saveStepSummary: jest.fn().mockResolvedValue(undefined),
    };
    const aiHelper = { initialize: jest.fn().mockResolvedValue(false) };
    const aiCache = { init: jest.fn() };
    const buildAnalysis = jest.fn();
    const warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => {});

    await expect(
      enrichStepSummaryWithOptionalAiAnalysis({
        aiHelper,
        aiCache,
        unavailableMessage: 'AI helper not available - skipping AI analysis',
        buildAnalysis,
        backlog,
        stepId: 8,
        stepName: 'Test Execution',
        summary: '# Summary',
      })
    ).resolves.toBe(false);

    expect(buildAnalysis).not.toHaveBeenCalled();
    expect(backlog.saveStepSummary).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith('AI helper not available - skipping AI analysis');

    warnSpy.mockRestore();
  });

  test('enrichStepSummaryWithOptionalAiAnalysis saves enriched content when AI analysis succeeds', async () => {
    const backlog = {
      saveStepSummary: jest.fn().mockResolvedValue(undefined),
    };
    const aiHelper = { initialize: jest.fn().mockResolvedValue(true) };
    const aiCache = { init: jest.fn().mockResolvedValue(undefined) };

    await expect(
      enrichStepSummaryWithOptionalAiAnalysis({
        aiHelper,
        aiCache,
        buildAnalysis: async () => ({
          aiRecommendations: 'Investigate flaky tests',
          extraSections: [{ title: 'Extra Analysis', content: 'Add coverage for edge cases' }],
        }),
        backlog,
        stepId: 8,
        stepName: 'Test Execution',
        summary: '# Test Execution Report',
      })
    ).resolves.toBe(true);

    expect(backlog.saveStepSummary).toHaveBeenCalledWith(
      8,
      'Test Execution',
      '# Test Execution Report\n\n---\n\n## AI Recommendations\n\nInvestigate flaky tests\n\n## Extra Analysis\n\nAdd coverage for edge cases'
    );
  });

  test('buildStepPromptWithFallback returns the preferred prompt when available', async () => {
    const buildPrompt = jest.fn().mockResolvedValue('yaml prompt');

    await expect(
      buildStepPromptWithFallback({
        buildPrompt,
        fallbackRole: 'role',
        fallbackTask: 'task',
        fallbackApproach: 'approach',
      })
    ).resolves.toBe('yaml prompt');

    expect(buildPrompt).toHaveBeenCalledTimes(1);
  });

  test('buildStepPromptWithFallback falls back to the standard structured prompt', async () => {
    const fallbackProjectContext = { language: 'typescript' };

    await expect(
      buildStepPromptWithFallback({
        buildPrompt: jest.fn().mockResolvedValue(''),
        fallbackRole: 'Fallback role',
        fallbackTask: 'Fallback task',
        fallbackApproach: 'Fallback approach',
        fallbackProjectContext,
      })
    ).resolves.toBe(
      injectProjectContext(
        buildStructuredPrompt({
          role: 'Fallback role',
          task: 'Fallback task',
          approach: 'Fallback approach',
        }),
        fallbackProjectContext
      )
    );
  });

  test('buildStepPromptWithFallback falls back when the preferred prompt builder throws', async () => {
    await expect(
      buildStepPromptWithFallback({
        buildPrompt: jest.fn().mockRejectedValue(new Error('broken yaml')),
        fallbackRole: 'Fallback role',
        fallbackTask: 'Fallback task',
        fallbackApproach: 'Fallback approach',
      })
    ).resolves.toContain('Fallback task');
  });

  test('saveStepSummaryWithAnalysisSections skips persistence when no extra analysis exists', async () => {
    const backlog = {
      saveStepSummary: jest.fn().mockResolvedValue(undefined),
    };

    await expect(
      saveStepSummaryWithAnalysisSections({
        backlog,
        stepId: 8,
        stepName: 'Test Execution',
        summary: '# Test Execution Report',
      })
    ).resolves.toBe(false);

    expect(backlog.saveStepSummary).not.toHaveBeenCalled();
  });

  test('saveStepSummaryWithAnalysisSections persists AI and extra analysis sections', async () => {
    const backlog = {
      saveStepSummary: jest.fn().mockResolvedValue(undefined),
    };

    await expect(
      saveStepSummaryWithAnalysisSections({
        backlog,
        stepId: 8,
        stepName: 'Test Execution',
        summary: '# Test Execution Report',
        aiRecommendations: 'Investigate flaky tests',
        extraSections: [
          { title: 'E2E Test Engineering Analysis', content: 'Add browser smoke coverage' },
          { title: 'Ignored Empty Section', content: '' },
        ],
      })
    ).resolves.toBe(true);

    expect(backlog.saveStepSummary).toHaveBeenCalledWith(
      8,
      'Test Execution',
      '# Test Execution Report\n\n---\n\n## AI Recommendations\n\nInvestigate flaky tests\n\n## E2E Test Engineering Analysis\n\nAdd browser smoke coverage'
    );
  });
});
