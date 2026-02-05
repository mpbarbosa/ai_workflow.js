/**
 * Tests for AI Validation Module
 *
 * @jest-environment node
 */

import {
  validateResponse,
  validateJsonSchema,
  calculateConfidenceScore,
  getConfidenceLevel,
  meetsConfidenceThreshold,
  analyzeContentQuality,
  countSections,
  determineFallbackAction,
  generateRetryStrategy,
  validateAIResponse,
} from '../../src/lib/ai_validation.js';

describe('AI Validation Module - Response Validation', () => {
  describe('validateResponse', () => {
    test('validates valid response', () => {
      const response = 'This is a valid response with sufficient content.';
      const result = validateResponse(response, { minLength: 10 });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    test('detects empty response', () => {
      const result = validateResponse('', { minLength: 10 });

      expect(result.valid).toBe(false);
      // Empty string is caught as "empty" before length check
      expect(result.errors).toContain('Response is empty or invalid type');
    });

    test('detects null response', () => {
      const result = validateResponse(null);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Response is empty or invalid type');
    });

    test('detects undefined response', () => {
      const result = validateResponse(undefined);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Response is empty or invalid type');
    });

    test('detects response too short', () => {
      const result = validateResponse('Short', { minLength: 20 });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Response too short: 5 < 20 characters');
    });

    test('validates expected sections present', () => {
      const response = '# Overview\n\nSome content\n\n# Details\n\nMore content';
      const result = validateResponse(response, {
        expectedSections: ['Overview', 'Details'],
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('detects missing sections', () => {
      const response = '# Overview\n\nSome content';
      const result = validateResponse(response, {
        expectedSections: ['Overview', 'Details', 'Summary'],
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing expected section: "Details"');
      expect(result.errors).toContain('Missing expected section: "Summary"');
    });

    test('detects error markers', () => {
      const response = 'The operation failed: connection error';
      const result = validateResponse(response);

      expect(result.valid).toBe(true); // Still valid, just warnings
      // Both "failed:" and "error:" are in the response
      expect(result.warnings.length).toBeGreaterThanOrEqual(1);
      expect(result.warnings.some((w) => w.includes('failed:') || w.includes('error:'))).toBe(true);
    });

    test('uses custom error markers', () => {
      const response = 'Warning: something went wrong';
      const result = validateResponse(response, {
        errorMarkers: ['warning:', 'caution:'],
      });

      expect(result.warnings).toContain('Response contains error marker: "warning:"');
    });

    test('handles case-insensitive error markers', () => {
      const response = 'ERROR: Something failed';
      const result = validateResponse(response);

      expect(result.warnings.length).toBeGreaterThan(0);
    });

    test('trims whitespace before validation', () => {
      const response = '   Valid content here   ';
      const result = validateResponse(response, { minLength: 10 });

      expect(result.valid).toBe(true);
    });

    test('accepts response with no expected sections', () => {
      const response = 'Just some content without sections';
      const result = validateResponse(response);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('validateJsonSchema', () => {
    test('validates object with required fields', () => {
      const data = { name: 'Alice', age: 30 };
      const schema = {
        required: ['name', 'age'],
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
        },
      };
      const result = validateJsonSchema(data, schema);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('detects missing required fields', () => {
      const data = { name: 'Alice' };
      const schema = {
        required: ['name', 'age', 'email'],
        properties: {},
      };
      const result = validateJsonSchema(data, schema);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required field: "age"');
      expect(result.errors).toContain('Missing required field: "email"');
    });

    test('validates string type', () => {
      const data = { name: 'Alice' };
      const schema = {
        properties: {
          name: { type: 'string' },
        },
      };
      const result = validateJsonSchema(data, schema);

      expect(result.valid).toBe(true);
    });

    test('detects invalid string type', () => {
      const data = { name: 123 };
      const schema = {
        properties: {
          name: { type: 'string' },
        },
      };
      const result = validateJsonSchema(data, schema);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Field "name" has invalid type: expected string, got number');
    });

    test('validates number type', () => {
      const data = { age: 30 };
      const schema = {
        properties: {
          age: { type: 'number' },
        },
      };
      const result = validateJsonSchema(data, schema);

      expect(result.valid).toBe(true);
    });

    test('validates array type', () => {
      const data = { tags: ['a', 'b'] };
      const schema = {
        properties: {
          tags: { type: 'array' },
        },
      };
      const result = validateJsonSchema(data, schema);

      expect(result.valid).toBe(true);
    });

    test('validates string minLength', () => {
      const data = { name: 'Al' };
      const schema = {
        properties: {
          name: { type: 'string', minLength: 3 },
        },
      };
      const result = validateJsonSchema(data, schema);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Field "name" is too short: 2 < 3');
    });

    test('validates string maxLength', () => {
      const data = { name: 'Alexander' };
      const schema = {
        properties: {
          name: { type: 'string', maxLength: 5 },
        },
      };
      const result = validateJsonSchema(data, schema);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Field "name" is too long: 9 > 5');
    });

    test('validates string pattern', () => {
      const data = { email: 'invalid-email' };
      const schema = {
        properties: {
          email: { type: 'string', pattern: '^[\\w.]+@[\\w.]+$' },
        },
      };
      const result = validateJsonSchema(data, schema);

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('does not match pattern');
    });

    test('validates string enum', () => {
      const data = { status: 'pending' };
      const schema = {
        properties: {
          status: { type: 'string', enum: ['active', 'inactive'] },
        },
      };
      const result = validateJsonSchema(data, schema);

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('must be one of [active, inactive]');
    });

    test('validates number minimum', () => {
      const data = { age: -5 };
      const schema = {
        properties: {
          age: { type: 'number', minimum: 0 },
        },
      };
      const result = validateJsonSchema(data, schema);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Field "age" is too small: -5 < 0');
    });

    test('validates number maximum', () => {
      const data = { age: 150 };
      const schema = {
        properties: {
          age: { type: 'number', maximum: 120 },
        },
      };
      const result = validateJsonSchema(data, schema);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Field "age" is too large: 150 > 120');
    });

    test('validates array minItems', () => {
      const data = { tags: ['a'] };
      const schema = {
        properties: {
          tags: { type: 'array', minItems: 2 },
        },
      };
      const result = validateJsonSchema(data, schema);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Field "tags" has too few items: 1 < 2');
    });

    test('validates array maxItems', () => {
      const data = { tags: ['a', 'b', 'c'] };
      const schema = {
        properties: {
          tags: { type: 'array', maxItems: 2 },
        },
      };
      const result = validateJsonSchema(data, schema);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Field "tags" has too many items: 3 > 2');
    });

    test('handles null data', () => {
      const result = validateJsonSchema(null, {});

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Data is null or undefined');
    });

    test('handles undefined data', () => {
      const result = validateJsonSchema(undefined, {});

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Data is null or undefined');
    });

    test('skips validation for missing optional fields', () => {
      const data = { name: 'Alice' };
      const schema = {
        properties: {
          name: { type: 'string' },
          age: { type: 'number', minimum: 0 },
        },
      };
      const result = validateJsonSchema(data, schema);

      expect(result.valid).toBe(true);
    });

    test('handles empty schema', () => {
      const data = { anything: 'goes' };
      const result = validateJsonSchema(data, {});

      expect(result.valid).toBe(true);
    });
  });
});

describe('AI Validation Module - Confidence Scoring', () => {
  describe('calculateConfidenceScore', () => {
    test('calculates perfect score', () => {
      const score = calculateConfidenceScore({
        responseLength: 1000,
        expectedSections: 3,
        foundSections: 3,
        qualityIndicators: 5,
        errorCount: 0,
        warningCount: 0,
      });

      expect(score).toBeGreaterThanOrEqual(90);
    });

    test('penalizes short responses', () => {
      const score = calculateConfidenceScore({
        responseLength: 50,
        expectedSections: 3,
        foundSections: 3,
        qualityIndicators: 0,
        errorCount: 0,
        warningCount: 0,
      });

      expect(score).toBeLessThanOrEqual(61);
    });

    test('penalizes missing sections', () => {
      const score = calculateConfidenceScore({
        responseLength: 1000,
        expectedSections: 3,
        foundSections: 1,
        qualityIndicators: 0,
        errorCount: 0,
        warningCount: 0,
      });

      expect(score).toBeLessThan(70);
    });

    test('rewards quality indicators', () => {
      const score = calculateConfidenceScore({
        responseLength: 500,
        expectedSections: 2,
        foundSections: 2,
        qualityIndicators: 5,
        errorCount: 0,
        warningCount: 0,
      });

      expect(score).toBeGreaterThanOrEqual(80);
    });

    test('penalizes errors', () => {
      const score = calculateConfidenceScore({
        responseLength: 1000,
        expectedSections: 3,
        foundSections: 3,
        qualityIndicators: 0,
        errorCount: 2,
        warningCount: 0,
      });

      expect(score).toBeLessThan(70);
    });

    test('penalizes warnings less than errors', () => {
      const scoreWithErrors = calculateConfidenceScore({
        responseLength: 1000,
        expectedSections: 3,
        foundSections: 3,
        qualityIndicators: 0,
        errorCount: 1,
        warningCount: 0,
      });

      const scoreWithWarnings = calculateConfidenceScore({
        responseLength: 1000,
        expectedSections: 3,
        foundSections: 3,
        qualityIndicators: 0,
        errorCount: 0,
        warningCount: 3,
      });

      expect(scoreWithWarnings).toBeGreaterThanOrEqual(scoreWithErrors);
    });

    test('uses custom weights', () => {
      const score = calculateConfidenceScore(
        {
          responseLength: 500,
          expectedSections: 2,
          foundSections: 2,
          qualityIndicators: 5,
          errorCount: 0,
          warningCount: 0,
        },
        {
          lengthWeight: 0.1,
          completenessWeight: 0.6,
          qualityWeight: 0.1,
          errorWeight: 0.2,
        }
      );

      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    test('returns score between 0 and 100', () => {
      const score = calculateConfidenceScore({
        responseLength: 0,
        expectedSections: 5,
        foundSections: 0,
        qualityIndicators: 0,
        errorCount: 10,
        warningCount: 10,
      });

      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    test('handles zero expected sections', () => {
      const score = calculateConfidenceScore({
        responseLength: 1000,
        expectedSections: 0,
        foundSections: 0,
        qualityIndicators: 5,
      });

      expect(score).toBeGreaterThanOrEqual(70);
    });
  });

  describe('getConfidenceLevel', () => {
    test('returns high for score >= 80', () => {
      expect(getConfidenceLevel(80)).toBe('high');
      expect(getConfidenceLevel(85)).toBe('high');
      expect(getConfidenceLevel(100)).toBe('high');
    });

    test('returns medium for score 60-79', () => {
      expect(getConfidenceLevel(60)).toBe('medium');
      expect(getConfidenceLevel(70)).toBe('medium');
      expect(getConfidenceLevel(79)).toBe('medium');
    });

    test('returns low for score 40-59', () => {
      expect(getConfidenceLevel(40)).toBe('low');
      expect(getConfidenceLevel(50)).toBe('low');
      expect(getConfidenceLevel(59)).toBe('low');
    });

    test('returns none for score < 40', () => {
      expect(getConfidenceLevel(0)).toBe('none');
      expect(getConfidenceLevel(20)).toBe('none');
      expect(getConfidenceLevel(39)).toBe('none');
    });
  });

  describe('meetsConfidenceThreshold', () => {
    test('returns true when score meets threshold', () => {
      expect(meetsConfidenceThreshold(80, 70)).toBe(true);
      expect(meetsConfidenceThreshold(70, 70)).toBe(true);
    });

    test('returns false when score below threshold', () => {
      expect(meetsConfidenceThreshold(60, 70)).toBe(false);
      expect(meetsConfidenceThreshold(0, 50)).toBe(false);
    });

    test('handles edge cases', () => {
      expect(meetsConfidenceThreshold(100, 100)).toBe(true);
      expect(meetsConfidenceThreshold(0, 0)).toBe(true);
    });
  });
});

describe('AI Validation Module - Content Quality', () => {
  describe('analyzeContentQuality', () => {
    test('detects code blocks', () => {
      const content = '```js\ncode here\n```\n\n```python\nmore code\n```';
      const quality = analyzeContentQuality(content);

      expect(quality.codeBlocks).toBe(2);
    });

    test('detects examples', () => {
      const content =
        'For example, you can do this. E.g., use this pattern. Example: here is an instance:';
      const quality = analyzeContentQuality(content);

      expect(quality.examples).toBeGreaterThanOrEqual(4);
    });

    test('detects lists', () => {
      const content = '- Item 1\n- Item 2\n* Item 3\n1. Numbered\n2. List';
      const quality = analyzeContentQuality(content);

      expect(quality.lists).toBe(5);
    });

    test('detects headers', () => {
      const content = '# Title\n## Section\n### Subsection\n#### Deep';
      const quality = analyzeContentQuality(content);

      expect(quality.headers).toBe(4);
    });

    test('detects references', () => {
      const content = 'See [1] and [2] for details. Also [^note] explains this.';
      const quality = analyzeContentQuality(content);

      expect(quality.references).toBe(3);
    });

    test('calculates total indicators', () => {
      const content = '# Title\n\n```js\ncode\n```\n\n- List item\n\nFor example [1]';
      const quality = analyzeContentQuality(content);

      expect(quality.total).toBeGreaterThan(0);
      expect(quality.total).toBe(
        quality.codeBlocks + quality.examples + quality.lists + quality.headers + quality.references
      );
    });

    test('handles empty content', () => {
      const quality = analyzeContentQuality('');

      expect(quality.codeBlocks).toBe(0);
      expect(quality.total).toBe(0);
    });

    test('handles null content', () => {
      const quality = analyzeContentQuality(null);

      expect(quality.codeBlocks).toBe(0);
      expect(quality.total).toBe(0);
    });

    test('handles undefined content', () => {
      const quality = analyzeContentQuality(undefined);

      expect(quality.codeBlocks).toBe(0);
      expect(quality.total).toBe(0);
    });
  });

  describe('countSections', () => {
    test('counts all sections present', () => {
      const content = '# Overview\n\n# Details\n\n# Summary';
      const result = countSections(content, ['Overview', 'Details', 'Summary']);

      expect(result.expected).toBe(3);
      expect(result.found).toBe(3);
      expect(result.missing).toHaveLength(0);
    });

    test('identifies missing sections', () => {
      const content = '# Overview\n\n# Details';
      const result = countSections(content, ['Overview', 'Details', 'Summary', 'Conclusion']);

      expect(result.expected).toBe(4);
      expect(result.found).toBe(2);
      expect(result.missing).toEqual(['Summary', 'Conclusion']);
    });

    test('handles empty content', () => {
      const result = countSections('', ['Section1', 'Section2']);

      expect(result.expected).toBe(2);
      expect(result.found).toBe(0);
      expect(result.missing).toEqual(['Section1', 'Section2']);
    });

    test('handles no expected sections', () => {
      const content = '# Random content';
      const result = countSections(content, []);

      expect(result.expected).toBe(0);
      expect(result.found).toBe(0);
      expect(result.missing).toHaveLength(0);
    });

    test('handles null content', () => {
      const result = countSections(null, ['Section']);

      expect(result.found).toBe(0);
      expect(result.missing).toEqual(['Section']);
    });
  });
});

describe('AI Validation Module - Fallback Strategies', () => {
  describe('determineFallbackAction', () => {
    test('accepts valid response with high confidence', () => {
      const validation = { valid: true, errors: [], warnings: [] };
      const fallback = determineFallbackAction(validation, 85);

      expect(fallback.action).toBe('accept');
      expect(fallback.retryable).toBe(false);
    });

    test('accepts valid response with medium confidence', () => {
      const validation = { valid: true, errors: [], warnings: [] };
      const fallback = determineFallbackAction(validation, 65);

      expect(fallback.action).toBe('accept');
      expect(fallback.retryable).toBe(false);
    });

    test('recommends retry for low confidence', () => {
      const validation = { valid: true, errors: [], warnings: [] };
      const fallback = determineFallbackAction(validation, 35);

      expect(fallback.action).toBe('retry');
      expect(fallback.retryable).toBe(true);
    });

    test('requires manual intervention for critical errors', () => {
      const validation = {
        valid: false,
        errors: ['Response is empty or invalid type'],
        warnings: [],
      };
      const fallback = determineFallbackAction(validation, 50);

      expect(fallback.action).toBe('manual');
      expect(fallback.retryable).toBe(false);
    });

    test('recommends regenerate for multiple errors', () => {
      const validation = {
        valid: false,
        errors: ['Error 1', 'Error 2', 'Error 3'],
        warnings: [],
      };
      const fallback = determineFallbackAction(validation, 50);

      expect(fallback.action).toBe('regenerate');
      expect(fallback.retryable).toBe(true);
    });

    test('recommends regenerate for moderate confidence with errors', () => {
      const validation = {
        valid: false,
        errors: ['Missing section'],
        warnings: [],
      };
      const fallback = determineFallbackAction(validation, 55);

      expect(fallback.action).toBe('regenerate');
      expect(fallback.retryable).toBe(true);
    });

    test('uses custom thresholds', () => {
      const validation = { valid: true, errors: [], warnings: [] };
      const fallback = determineFallbackAction(validation, 75, {
        acceptThreshold: 90,
      });

      expect(fallback.action).toBe('accept');
    });

    test('includes warnings when accepting with caution', () => {
      const validation = {
        valid: true,
        errors: [],
        warnings: ['Some warning'],
      };
      const fallback = determineFallbackAction(validation, 65);

      expect(fallback.action).toBe('accept');
      expect(fallback.warnings).toBeDefined();
    });
  });

  describe('generateRetryStrategy', () => {
    test('allows retry on first attempt', () => {
      const strategy = generateRetryStrategy(1);

      expect(strategy.shouldRetry).toBe(true);
      expect(strategy.delayMs).toBe(1000);
      expect(strategy.attemptsRemaining).toBe(2);
      expect(strategy.nextAttempt).toBe(2);
    });

    test('calculates exponential backoff', () => {
      const strategy1 = generateRetryStrategy(1);
      const strategy2 = generateRetryStrategy(2);
      const strategy3 = generateRetryStrategy(3);

      expect(strategy1.delayMs).toBe(1000);
      expect(strategy2.delayMs).toBe(2000);
      expect(strategy3.delayMs).toBe(4000);
    });

    test('caps delay at maxDelay', () => {
      const strategy = generateRetryStrategy(10, { maxDelay: 5000 });

      expect(strategy.delayMs).toBe(5000);
    });

    test('stops retry after max attempts', () => {
      const strategy = generateRetryStrategy(3, { maxAttempts: 3 });

      expect(strategy.shouldRetry).toBe(false);
      expect(strategy.attemptsRemaining).toBe(0);
    });

    test('uses custom base delay', () => {
      const strategy = generateRetryStrategy(1, { baseDelay: 500 });

      expect(strategy.delayMs).toBe(500);
    });

    test('uses custom max attempts', () => {
      const strategy = generateRetryStrategy(5, { maxAttempts: 5 });

      expect(strategy.shouldRetry).toBe(false);
    });

    test('tracks next attempt number', () => {
      const strategy1 = generateRetryStrategy(1);
      const strategy2 = generateRetryStrategy(2);

      expect(strategy1.nextAttempt).toBe(2);
      expect(strategy2.nextAttempt).toBe(3);
    });
  });
});

describe('AI Validation Module - Comprehensive Validation', () => {
  describe('validateAIResponse', () => {
    test('validates complete response', () => {
      const response = `
# Overview
This is a comprehensive response with multiple sections.

\`\`\`js
const example = true;
\`\`\`

## Details
- Point 1
- Point 2

For example, this demonstrates quality.
      `.trim();

      const result = validateAIResponse(response, {
        expectedSections: ['Overview', 'Details'],
        confidenceThreshold: 70,
      });

      expect(result.valid).toBe(true);
      expect(result.confidence).toBeGreaterThanOrEqual(70);
      expect(result.level).toBe('high');
      expect(result.meetsThreshold).toBe(true);
      expect(result.action).toBe('accept');
      expect(result.quality).toBeDefined();
      expect(result.sections).toBeDefined();
    });

    test('detects low quality response', () => {
      const response = 'Short';
      const result = validateAIResponse(response, {
        expectedSections: ['Overview', 'Details'],
        confidenceThreshold: 70,
      });

      expect(result.valid).toBe(false);
      expect(result.confidence).toBeLessThan(70);
      expect(result.meetsThreshold).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('includes quality metrics', () => {
      const response = '# Title\n\n```code```\n\n- List\n\nFor example [1]';
      const result = validateAIResponse(response);

      expect(result.quality).toBeDefined();
      expect(result.quality.codeBlocks).toBeGreaterThan(0);
      expect(result.quality.lists).toBeGreaterThan(0);
      expect(result.quality.headers).toBeGreaterThan(0);
    });

    test('includes section analysis', () => {
      const response = '# Section1\n\n# Section2';
      const result = validateAIResponse(response, {
        expectedSections: ['Section1', 'Section2', 'Section3'],
      });

      expect(result.sections).toBeDefined();
      expect(result.sections.expected).toBe(3);
      expect(result.sections.found).toBe(2);
      expect(result.sections.missing).toEqual(['Section3']);
    });

    test('provides fallback recommendation', () => {
      const response = 'Incomplete response';
      const result = validateAIResponse(response, {
        expectedSections: ['Section1', 'Section2'],
        confidenceThreshold: 70,
      });

      expect(result.fallback).toBeDefined();
      expect(result.fallback.action).toBeDefined();
      expect(result.fallback.reason).toBeDefined();
      expect(result.fallback.retryable).toBeDefined();
    });

    test('uses custom validation options', () => {
      const response = 'Valid content here';
      const result = validateAIResponse(response, {
        validation: {
          minLength: 5,
          errorMarkers: ['custom-error:'],
        },
      });

      expect(result).toBeDefined();
    });

    test('uses custom confidence threshold', () => {
      const response = '# Title\n\nSome content';
      const result = validateAIResponse(response, {
        confidenceThreshold: 90,
      });

      expect(result.meetsThreshold).toBeDefined();
    });

    test('uses custom fallback thresholds', () => {
      const response = 'Content';
      const result = validateAIResponse(response, {
        fallbackThresholds: {
          retryThreshold: 30,
          regenerateThreshold: 50,
          acceptThreshold: 70,
        },
      });

      expect(result.fallback).toBeDefined();
    });

    test('handles empty response gracefully', () => {
      const result = validateAIResponse('');

      expect(result.valid).toBe(false);
      expect(result.confidence).toBeDefined();
      expect(result.action).toBeDefined();
    });

    test('combines all metrics correctly', () => {
      const response = `
# Overview
Detailed content with examples

\`\`\`js
code block
\`\`\`

- List item 1
- List item 2

For example, this shows quality [1].
      `.trim();

      const result = validateAIResponse(response, {
        expectedSections: ['Overview'],
        confidenceThreshold: 60,
      });

      expect(result.valid).toBe(true);
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.level).toBeDefined();
      expect(result.quality.total).toBeGreaterThan(0);
      expect(result.sections.found).toBeGreaterThan(0);
    });
  });
});
