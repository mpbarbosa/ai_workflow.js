/**
 * Tests for AI Helpers Module
 *
 * @jest-environment node
 */

import {
  parseAiResponse,
  parseErrorResponse,
  formatBatchRequests,
  calculateRetryDelay,
  shouldRetry,
  mergeRequestOptions,
} from '../../src/lib/ai_helpers.js';

describe('AI Helpers Module - Pure Functions', () => {
  describe('parseAiResponse', () => {
    test('handles empty response', () => {
      const result = parseAiResponse(null);

      expect(result.success).toBe(false);
      expect(result.content).toBe('');
      expect(result.confidence).toBe(0);
      expect(result.error).toBe('Empty response');
    });

    test('parses string response', () => {
      const result = parseAiResponse('Hello world');

      expect(result.success).toBe(true);
      expect(result.content).toBe('Hello world');
      expect(result.confidence).toBe(0.7);
      expect(result.metadata).toEqual({});
    });

    test('trims whitespace from string', () => {
      const result = parseAiResponse('  \n  Hello  \n  ');

      expect(result.content).toBe('Hello');
    });

    test('parses object response with content', () => {
      const raw = {
        content: 'Test response',
        model: 'gpt-4',
        tokens: 150,
      };

      const result = parseAiResponse(raw);

      expect(result.success).toBe(true);
      expect(result.content).toBe('Test response');
      expect(result.metadata.model).toBe('gpt-4');
      expect(result.metadata.tokens).toBe(150);
    });

    test('uses alternative content fields', () => {
      const result1 = parseAiResponse({ text: 'Via text field' });
      expect(result1.content).toBe('Via text field');

      const result2 = parseAiResponse({ message: 'Via message field' });
      expect(result2.content).toBe('Via message field');
    });

    test('calculates confidence based on length', () => {
      const short = parseAiResponse('Hi');
      expect(short.confidence).toBe(0.3);

      const medium = parseAiResponse('This is a medium length response');
      expect(medium.confidence).toBe(0.8);

      const long = parseAiResponse('a'.repeat(600));
      expect(long.confidence).toBe(0.9);
    });

    test('lowers confidence for uncertain responses', () => {
      const result1 = parseAiResponse("I don't know the answer");
      expect(result1.confidence).toBe(0.5);

      const result2 = parseAiResponse('This is unclear to me');
      expect(result2.confidence).toBe(0.5);
    });

    test('includes usage metadata', () => {
      const raw = {
        content: 'Test',
        usage: { total_tokens: 200 },
      };

      const result = parseAiResponse(raw);

      expect(result.metadata.tokens).toBe(200);
    });

    test('includes finish reason', () => {
      const raw = {
        content: 'Test',
        finish_reason: 'length',
      };

      const result = parseAiResponse(raw);

      expect(result.metadata.finishReason).toBe('length');
    });
  });

  describe('parseErrorResponse', () => {
    test('handles null error', () => {
      const result = parseErrorResponse(null);

      expect(result.type).toBe('unknown');
      expect(result.message).toBe('Unknown error');
      expect(result.retryable).toBe(false);
    });

    test('parses Error objects', () => {
      const error = new Error('Test error message');
      const result = parseErrorResponse(error);

      expect(result.type).toBe('unknown');
      expect(result.message).toBe('Test error message');
      expect(result.details.name).toBe('Error');
    });

    test('detects network errors', () => {
      const errors = [
        new Error('Network timeout'),
        new Error('ECONNREFUSED'),
        new Error('ETIMEDOUT'),
      ];

      errors.forEach((error) => {
        const result = parseErrorResponse(error);
        expect(result.type).toBe('network');
        expect(result.retryable).toBe(true);
      });
    });

    test('detects authentication errors', () => {
      const errors = [
        new Error('Unauthorized access'),
        new Error('Authentication failed'),
        new Error('401 error'),
        new Error('403 Forbidden'),
      ];

      errors.forEach((error) => {
        const result = parseErrorResponse(error);
        expect(result.type).toBe('authentication');
        expect(result.retryable).toBe(false);
      });
    });

    test('detects rate limit errors', () => {
      const errors = [
        new Error('Rate limit exceeded'),
        new Error('429 Too Many Requests'),
        new Error('too many requests'),
      ];

      errors.forEach((error) => {
        const result = parseErrorResponse(error);
        expect(result.type).toBe('rate_limit');
        expect(result.retryable).toBe(true);
      });
    });

    test('handles string errors', () => {
      const result = parseErrorResponse('String error message');

      expect(result.type).toBe('unknown');
      expect(result.message).toBe('String error message');
      expect(result.retryable).toBe(false);
    });

    test('handles object errors', () => {
      const error = {
        type: 'validation',
        message: 'Invalid input',
        retryable: false,
        details: { field: 'prompt' },
      };

      const result = parseErrorResponse(error);

      expect(result.type).toBe('validation');
      expect(result.message).toBe('Invalid input');
      expect(result.retryable).toBe(false);
      expect(result.details.field).toBe('prompt');
    });

    test('includes stack trace in details', () => {
      const error = new Error('Test');
      const result = parseErrorResponse(error);

      expect(result.details.stack).toBeDefined();
    });
  });

  describe('formatBatchRequests', () => {
    test('handles empty array', () => {
      const result = formatBatchRequests([]);

      expect(result.count).toBe(0);
      expect(result.requests).toEqual([]);
      expect(result.metadata.valid).toBe(false);
    });

    test('handles null input', () => {
      const result = formatBatchRequests(null);

      expect(result.count).toBe(0);
      expect(result.requests).toEqual([]);
    });

    test('formats single request', () => {
      const requests = [{ prompt: 'Test prompt' }];
      const result = formatBatchRequests(requests);

      expect(result.count).toBe(1);
      expect(result.requests[0].prompt).toBe('Test prompt');
      expect(result.requests[0].id).toBeDefined();
    });

    test('formats multiple requests', () => {
      const requests = [{ prompt: 'Test 1' }, { prompt: 'Test 2' }, { prompt: 'Test 3' }];

      const result = formatBatchRequests(requests);

      expect(result.count).toBe(3);
      expect(result.requests).toHaveLength(3);
    });

    test('preserves request IDs', () => {
      const requests = [
        { id: 'a', prompt: 'Test 1' },
        { id: 'b', prompt: 'Test 2' },
      ];

      const result = formatBatchRequests(requests);

      expect(result.requests[0].id).toBe('a');
      expect(result.requests[1].id).toBe('b');
    });

    test('generates IDs for requests without them', () => {
      const requests = [{ prompt: 'Test 1' }, { prompt: 'Test 2' }];

      const result = formatBatchRequests(requests);

      expect(result.requests[0].id).toBe('batch_0');
      expect(result.requests[1].id).toBe('batch_1');
    });

    test('normalizes request format', () => {
      const requests = [{ message: 'Test via message' }, { prompt: 'Test via prompt' }];

      const result = formatBatchRequests(requests);

      expect(result.requests[0].prompt).toBe('Test via message');
      expect(result.requests[1].prompt).toBe('Test via prompt');
    });

    test('filters invalid requests', () => {
      const requests = [{ prompt: 'Valid' }, null, {}, { prompt: 'Also valid' }];

      const result = formatBatchRequests(requests);

      expect(result.count).toBe(2);
      expect(result.metadata.filteredCount).toBe(2);
    });

    test('preserves options and metadata', () => {
      const requests = [
        {
          prompt: 'Test',
          options: { model: 'gpt-4' },
          metadata: { priority: 'high' },
        },
      ];

      const result = formatBatchRequests(requests);

      expect(result.requests[0].options.model).toBe('gpt-4');
      expect(result.requests[0].metadata.priority).toBe('high');
    });

    test('adds default options for requests without them', () => {
      const requests = [{ prompt: 'Test' }];
      const result = formatBatchRequests(requests);

      expect(result.requests[0].options).toEqual({});
      expect(result.requests[0].metadata).toEqual({});
    });
  });

  describe('calculateRetryDelay', () => {
    test('calculates exponential backoff', () => {
      expect(calculateRetryDelay(0, 1000, 10000)).toBe(1000);
      expect(calculateRetryDelay(1, 1000, 10000)).toBe(2000);
      expect(calculateRetryDelay(2, 1000, 10000)).toBe(4000);
      expect(calculateRetryDelay(3, 1000, 10000)).toBe(8000);
    });

    test('respects maximum delay', () => {
      expect(calculateRetryDelay(5, 1000, 10000)).toBe(10000);
      expect(calculateRetryDelay(10, 1000, 10000)).toBe(10000);
    });

    test('uses default values', () => {
      expect(calculateRetryDelay(0)).toBe(1000);
      expect(calculateRetryDelay(1)).toBe(2000);
    });

    test('handles custom base delay', () => {
      expect(calculateRetryDelay(0, 500, 10000)).toBe(500);
      expect(calculateRetryDelay(1, 500, 10000)).toBe(1000);
      expect(calculateRetryDelay(2, 500, 10000)).toBe(2000);
    });
  });

  describe('shouldRetry', () => {
    test('returns false if max attempts reached', () => {
      const errorInfo = { retryable: true };
      expect(shouldRetry(errorInfo, 3, 3)).toBe(false);
      expect(shouldRetry(errorInfo, 5, 3)).toBe(false);
    });

    test('returns false if error not retryable', () => {
      const errorInfo = { retryable: false };
      expect(shouldRetry(errorInfo, 0, 3)).toBe(false);
    });

    test('returns true if retryable and under limit', () => {
      const errorInfo = { retryable: true };
      expect(shouldRetry(errorInfo, 0, 3)).toBe(true);
      expect(shouldRetry(errorInfo, 1, 3)).toBe(true);
      expect(shouldRetry(errorInfo, 2, 3)).toBe(true);
    });
  });

  describe('mergeRequestOptions', () => {
    test('uses defaults for missing options', () => {
      const result = mergeRequestOptions();

      expect(result.model).toBe('gpt-4');
      expect(result.temperature).toBe(0.7);
      expect(result.maxTokens).toBe(4000);
    });

    test('overrides defaults with options', () => {
      const options = {
        model: 'gpt-3.5',
        temperature: 0.5,
        maxTokens: 2000,
      };

      const result = mergeRequestOptions(options);

      expect(result.model).toBe('gpt-3.5');
      expect(result.temperature).toBe(0.5);
      expect(result.maxTokens).toBe(2000);
    });

    test('merges custom defaults', () => {
      const options = { model: 'custom' };
      const defaults = { temperature: 0.9, maxTokens: 5000 };

      const result = mergeRequestOptions(options, defaults);

      expect(result.model).toBe('custom');
      expect(result.temperature).toBe(0.9);
      expect(result.maxTokens).toBe(5000);
    });

    test('preserves additional options', () => {
      const options = {
        model: 'gpt-4',
        customField: 'value',
      };

      const result = mergeRequestOptions(options);

      expect(result.customField).toBe('value');
    });

    test('handles zero values correctly', () => {
      const options = { temperature: 0 };
      const result = mergeRequestOptions(options);

      expect(result.temperature).toBe(0);
    });

    test('handles boolean flags', () => {
      const options = { stream: true, cache: false };
      const result = mergeRequestOptions(options);

      expect(result.stream).toBe(true);
      expect(result.cache).toBe(false);
    });
  });
});

// Note: AiHelper class integration tests are skipped due to SDK mocking complexity
// The class will be tested via integration tests with real or stubbed SDK in Phase 6 Day 10
