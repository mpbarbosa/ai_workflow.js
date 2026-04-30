/**
 * @fileoverview Tests for Step 11.6: AWS Serverless AI Review
 *
 * Covers:
 *  - Pure functions: shouldRunAwsServerlessReview, buildReviewContext,
 *    formatAiReviewReport
 *  - Step11_6AwsServerlessReviewer.execute() — skip behaviour, AI available,
 *    AI unavailable paths
 *  - stepKind static property contract
 *
 * @group steps
 */

import { jest } from '@jest/globals';

import {
  Step11_6AwsServerlessReviewer,
  AWS_LBS_PROJECT_KIND,
  PERSONA_ID,
  shouldRunAwsServerlessReview,
  buildReviewContext,
  formatAiReviewReport,
} from '../../src/steps/step_11_6_aws_serverless_review.js';
import { STEP_KIND } from '../../src/steps/step_contract.js';
import { logger } from '../../src/core/logger.js';

// ============================================================================
// Pure Functions — shouldRunAwsServerlessReview
// ============================================================================

describe('shouldRunAwsServerlessReview', () => {
  test('returns true for aws_lbs_backend_setup', () => {
    expect(shouldRunAwsServerlessReview('aws_lbs_backend_setup')).toBe(true);
  });

  test('returns false for other project kinds', () => {
    expect(shouldRunAwsServerlessReview('nodejs_api')).toBe(false);
    expect(shouldRunAwsServerlessReview('react_spa')).toBe(false);
    expect(shouldRunAwsServerlessReview('python_app')).toBe(false);
    expect(shouldRunAwsServerlessReview('generic')).toBe(false);
  });

  test('returns false for empty string', () => {
    expect(shouldRunAwsServerlessReview('')).toBe(false);
  });

  test('returns false for non-string inputs', () => {
    expect(shouldRunAwsServerlessReview(null)).toBe(false);
    expect(shouldRunAwsServerlessReview(undefined)).toBe(false);
    expect(shouldRunAwsServerlessReview(42)).toBe(false);
  });

  test('trims whitespace before comparison', () => {
    expect(shouldRunAwsServerlessReview('  aws_lbs_backend_setup  ')).toBe(true);
  });
});

// ============================================================================
// Pure Functions — buildReviewContext
// ============================================================================

describe('buildReviewContext', () => {
  test('extracts shellScripts and lambdaFunctions from step_11_5 result', () => {
    const step11_5Result = {
      shellScripts: ['deploy.sh', 'setup.sh'],
      lambdaFunctions: ['src/lambda/getLocation/index.js'],
      awsConfigValid: false,
    };
    const ctx = buildReviewContext(step11_5Result, '/my/project');
    expect(ctx.shellScripts).toEqual(['deploy.sh', 'setup.sh']);
    expect(ctx.lambdaFunctions).toEqual(['src/lambda/getLocation/index.js']);
    expect(ctx.projectRoot).toBe('/my/project');
  });

  test('awsConfigKeys is empty when awsConfigValid is false', () => {
    const ctx = buildReviewContext({ awsConfigValid: false, awsConfigKeys: ['region'] });
    expect(ctx.awsConfigKeys).toEqual([]);
  });

  test('awsConfigKeys is populated when awsConfigValid is true and keys present', () => {
    const ctx = buildReviewContext({
      awsConfigValid: true,
      awsConfigKeys: ['region', 'stackName'],
    });
    expect(ctx.awsConfigKeys).toEqual(['region', 'stackName']);
  });

  test('defaults to empty arrays when step_11_5 result is missing', () => {
    const ctx = buildReviewContext({}, '/root');
    expect(ctx.shellScripts).toEqual([]);
    expect(ctx.lambdaFunctions).toEqual([]);
    expect(ctx.awsConfigKeys).toEqual([]);
    expect(ctx.projectRoot).toBe('/root');
  });

  test('handles undefined step_11_5Result gracefully', () => {
    const ctx = buildReviewContext(undefined, '/root');
    expect(ctx.shellScripts).toEqual([]);
    expect(ctx.lambdaFunctions).toEqual([]);
  });

  test('ignores non-array shellScripts / lambdaFunctions', () => {
    const ctx = buildReviewContext({ shellScripts: 'deploy.sh', lambdaFunctions: null });
    expect(ctx.shellScripts).toEqual([]);
    expect(ctx.lambdaFunctions).toEqual([]);
  });
});

// ============================================================================
// Pure Functions — formatAiReviewReport
// ============================================================================

describe('formatAiReviewReport', () => {
  const baseContext = {
    shellScripts: ['deploy.sh'],
    lambdaFunctions: ['src/lambda/fn/index.js'],
    projectRoot: '/project',
  };

  test('includes persona ID in report', () => {
    const report = formatAiReviewReport('AI feedback here', baseContext);
    expect(report).toContain(PERSONA_ID);
  });

  test('includes project root when provided', () => {
    const report = formatAiReviewReport('feedback', baseContext);
    expect(report).toContain('/project');
  });

  test('includes script and lambda counts', () => {
    const report = formatAiReviewReport('feedback', baseContext);
    expect(report).toContain('1'); // shell scripts count
  });

  test('includes the AI response text', () => {
    const report = formatAiReviewReport('My AI review content', baseContext);
    expect(report).toContain('My AI review content');
  });

  test('shows fallback when AI response is empty', () => {
    const report = formatAiReviewReport('', baseContext);
    expect(report).toContain('No AI response received');
  });

  test('shows fallback when AI response is null', () => {
    const report = formatAiReviewReport(null, baseContext);
    expect(report).toContain('No AI response received');
  });

  test('returns a string even with no context', () => {
    const report = formatAiReviewReport('feedback');
    expect(typeof report).toBe('string');
    expect(report.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// Constants
// ============================================================================

describe('Module constants', () => {
  test('AWS_LBS_PROJECT_KIND matches expected value', () => {
    expect(AWS_LBS_PROJECT_KIND).toBe('aws_lbs_backend_setup');
  });

  test('PERSONA_ID is aws_serverless_engineer', () => {
    expect(PERSONA_ID).toBe('aws_serverless_engineer');
  });
});

// ============================================================================
// Step11_6AwsServerlessReviewer — static properties
// ============================================================================

describe('Step11_6AwsServerlessReviewer static properties', () => {
  test('stepKind is PROJECT', () => {
    expect(Step11_6AwsServerlessReviewer.stepKind).toBe(STEP_KIND.PROJECT);
  });
});

// ============================================================================
// Step11_6AwsServerlessReviewer.getMetadata()
// ============================================================================

describe('Step11_6AwsServerlessReviewer.getMetadata()', () => {
  const step = new Step11_6AwsServerlessReviewer();

  test('returns expected id', () => {
    expect(step.getMetadata().id).toBe('11_6');
  });

  test('returns expected name', () => {
    expect(step.getMetadata().name).toBe('AWS Serverless AI Review');
  });

  test('lists step_11_5 as a dependency', () => {
    expect(step.getMetadata().dependencies).toContain('step_11_5');
  });

  test('canSkip is true', () => {
    expect(step.getMetadata().canSkip).toBe(true);
  });
});

// ============================================================================
// Step11_6AwsServerlessReviewer.execute() — skip behaviour
// ============================================================================

describe('Step11_6AwsServerlessReviewer.execute() — skip behaviour', () => {
  test('skips when projectKind is not aws_lbs_backend_setup', async () => {
    const step = new Step11_6AwsServerlessReviewer();
    const result = await step.execute('/root', { projectKind: 'nodejs_api' });
    expect(result.success).toBe(true);
    expect(result.skipped).toBe(true);
    expect(result.reason).toMatch(/nodejs_api/);
  });

  test('skips when projectKind is not provided', async () => {
    const step = new Step11_6AwsServerlessReviewer();
    const result = await step.execute('/root', {});
    expect(result.success).toBe(true);
    expect(result.skipped).toBe(true);
  });

  test('skips when projectKind is empty string', async () => {
    const step = new Step11_6AwsServerlessReviewer();
    const result = await step.execute('/root', { projectKind: '' });
    expect(result.success).toBe(true);
    expect(result.skipped).toBe(true);
  });
});

// ============================================================================
// Step11_6AwsServerlessReviewer.execute() — AI unavailable path
// ============================================================================

describe('Step11_6AwsServerlessReviewer.execute() — AI unavailable', () => {
  test('succeeds without AI response when aiHelper is unavailable', async () => {
    const mockBacklog = { saveStepSummary: jest.fn().mockResolvedValue(undefined) };
    const mockAiHelper = { initialize: jest.fn().mockResolvedValue(false) };
    const mockAiCache = { init: jest.fn(), withCache: jest.fn() };

    const step = new Step11_6AwsServerlessReviewer({
      backlog: mockBacklog,
      aiHelper: mockAiHelper,
      aiCache: mockAiCache,
    });

    const result = await step.execute('/root', { projectKind: 'aws_lbs_backend_setup' });

    expect(result.success).toBe(true);
    expect(result.skipped).toBe(false);
    expect(result.aiAvailable).toBe(false);
    expect(result.aiResponse).toBeNull();
    expect(mockBacklog.saveStepSummary).toHaveBeenCalledWith(
      '11_6',
      'AWS_Serverless_Review',
      expect.any(String)
    );
    // Cache should not be touched when AI is unavailable
    expect(mockAiCache.withCache).not.toHaveBeenCalled();
  });
});

// ============================================================================
// Step11_6AwsServerlessReviewer.execute() — AI available path
// ============================================================================

describe('Step11_6AwsServerlessReviewer.execute() — AI available', () => {
  test('calls aiHelper with aws_serverless_engineer persona', async () => {
    const aiText = 'Deployment looks good. No critical issues.';
    const mockBacklog = { saveStepSummary: jest.fn().mockResolvedValue(undefined) };
    const mockAiHelper = {
      initialize: jest.fn().mockResolvedValue(true),
      executeRequest: jest
        .fn()
        .mockResolvedValue({ content: aiText, success: true, confidence: 0.9, metadata: {} }),
    };
    const mockAiCache = {
      init: jest.fn().mockResolvedValue(undefined),
      withCache: jest.fn().mockImplementation((_prompt, _key, fn) => fn()),
    };

    const step = new Step11_6AwsServerlessReviewer({
      backlog: mockBacklog,
      aiHelper: mockAiHelper,
      aiCache: mockAiCache,
    });

    const step11_5Result = {
      shellScripts: ['deploy.sh'],
      lambdaFunctions: ['src/lambda/getLocation/index.js'],
      awsConfigValid: true,
      awsConfigKeys: ['region', 'stackName'],
    };

    const result = await step.execute('/root', {
      projectKind: 'aws_lbs_backend_setup',
      step11_5Result,
    });

    expect(result.success).toBe(true);
    expect(result.aiAvailable).toBe(true);
    expect(result.aiResponse).toEqual(expect.objectContaining({ content: aiText }));

    // Persona must be aws_serverless_engineer
    expect(mockAiHelper.executeRequest).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ persona: 'aws_serverless_engineer' })
    );

    // Report saved to backlog
    expect(mockBacklog.saveStepSummary).toHaveBeenCalledWith(
      '11_6',
      'AWS_Serverless_Review',
      expect.stringContaining(aiText)
    );
  });

  test('returns reviewContext with scripts and lambdas from step_11_5', async () => {
    const mockBacklog = { saveStepSummary: jest.fn().mockResolvedValue(undefined) };
    const mockAiHelper = {
      initialize: jest.fn().mockResolvedValue(true),
      executeRequest: jest.fn().mockResolvedValue('ok'),
    };
    const mockAiCache = {
      init: jest.fn().mockResolvedValue(undefined),
      withCache: jest.fn().mockImplementation((_p, _k, fn) => fn()),
    };

    const step = new Step11_6AwsServerlessReviewer({
      backlog: mockBacklog,
      aiHelper: mockAiHelper,
      aiCache: mockAiCache,
    });

    const result = await step.execute('/my/project', {
      projectKind: 'aws_lbs_backend_setup',
      step11_5Result: {
        shellScripts: ['a.sh', 'b.sh'],
        lambdaFunctions: ['src/lambda/fn/index.js'],
      },
    });

    expect(result.reviewContext.shellScripts).toEqual(['a.sh', 'b.sh']);
    expect(result.reviewContext.lambdaFunctions).toEqual(['src/lambda/fn/index.js']);
    expect(result.reviewContext.projectRoot).toBe('/my/project');
  });
});

// ============================================================================
// Step11_6AwsServerlessReviewer.execute() — error handling
// ============================================================================

describe('Step11_6AwsServerlessReviewer.execute() — error handling', () => {
  test('returns success:false when backlog throws', async () => {
    const errorSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});
    const mockBacklog = { saveStepSummary: jest.fn().mockRejectedValue(new Error('disk full')) };
    const mockAiHelper = { initialize: jest.fn().mockResolvedValue(false) };
    const mockAiCache = { init: jest.fn(), withCache: jest.fn() };

    const step = new Step11_6AwsServerlessReviewer({
      backlog: mockBacklog,
      aiHelper: mockAiHelper,
      aiCache: mockAiCache,
    });

    const result = await step.execute('/root', { projectKind: 'aws_lbs_backend_setup' });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/disk full/);
    errorSpy.mockRestore();
  });
});
