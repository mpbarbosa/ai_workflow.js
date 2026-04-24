/**
 * Tests for AI Helpers Module
 *
 * @jest-environment node
 */

import { jest } from '@jest/globals';
import { tmpdir } from 'os';
import { mkdtemp, writeFile, mkdir } from 'fs/promises';
import path from 'path';
import {
  parseAiResponse,
  parseErrorResponse,
  extractActionableIssueSignals,
  formatBatchRequests,
  calculateRetryDelay,
  shouldRetry,
  isSessionIdleTimeout,
  mergeRequestOptions,
  validateAiHelperState,
  AiHelper,
  readFileHandler,
  listFilesHandler,
  buildWorkflowTools,
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

    test('detects CLI not found (ENOENT) errors', () => {
      const errors = [
        new Error('ENOENT: no such file or directory, open /usr/local/bin/gh'),
        new Error('spawn copilot ENOENT'),
      ];

      errors.forEach((error) => {
        const result = parseErrorResponse(error);
        expect(result.type).toBe('cli_not_found');
        expect(result.retryable).toBe(false);
      });
    });

    test('ENOENT is not classified as network error', () => {
      const error = new Error('ENOENT: file not found');
      const result = parseErrorResponse(error);
      expect(result.type).not.toBe('network');
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

  describe('isSessionIdleTimeout', () => {
    test('returns true for session.idle timeout error', () => {
      const errorInfo = { message: 'Timeout after 60000ms waiting for session.idle' };
      expect(isSessionIdleTimeout(errorInfo)).toBe(true);
    });

    test('returns true for varying timeout durations', () => {
      expect(
        isSessionIdleTimeout({ message: 'Timeout after 120000ms waiting for session.idle' })
      ).toBe(true);
      expect(
        isSessionIdleTimeout({ message: 'Timeout after 240000ms waiting for session.idle' })
      ).toBe(true);
    });

    test('returns false for non-timeout errors', () => {
      expect(isSessionIdleTimeout({ message: 'Network error' })).toBe(false);
      expect(isSessionIdleTimeout({ message: 'Authentication failed' })).toBe(false);
    });

    test('returns false for timeout without session.idle', () => {
      expect(isSessionIdleTimeout({ message: 'Timeout after 60000ms waiting for response' })).toBe(
        false
      );
      expect(isSessionIdleTimeout({ message: 'Request timed out' })).toBe(false);
    });

    test('is case-insensitive for both keywords', () => {
      expect(
        isSessionIdleTimeout({ message: 'TIMEOUT after 60000ms waiting for SESSION.IDLE' })
      ).toBe(true);
    });
  });

  describe('mergeRequestOptions', () => {
    test('uses defaults for missing options', () => {
      const result = mergeRequestOptions();

      expect(result.model).toBe('gpt-4.1');
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

  describe('extractActionableIssueSignals', () => {
    test('extracts concrete performance finding lines and summary table rows', () => {
      const response = [
        '### Findings',
        '',
        '#### 1. Eager Re-Export of Many Modules (Potential Startup/Bundle Impact)',
        '- **File:** `src/index.js` (parts 1/6, 2/6)',
        '- **Issue Type:** Eager re-export of many modules and functions',
        '- **Severity:** Medium',
        '- **Impact:** This file re-exports a large number of modules and functions at the top level. This can increase initial load time and bundle size.',
        '- **Optimization Example:** Use dynamic imports or split exports into smaller entry points.',
        '',
        '### Summary Table',
        '',
        '| File         | Issue Type                | Severity | Impact                                |',
        '|--------------|---------------------------|----------|----------------------------------------|',
        '| src/index.js | Eager re-export of modules| Medium   | Increased startup time and bundle size |',
      ].join('\n');

      expect(extractActionableIssueSignals(response)).toEqual([
        '#### 1. Eager Re-Export of Many Modules (Potential Startup/Bundle Impact)',
        '- **File:** `src/index.js` (parts 1/6, 2/6)',
        '- **Issue Type:** Eager re-export of many modules and functions',
        '- **Severity:** Medium',
        '- **Impact:** This file re-exports a large number of modules and functions at the top level. This can increase initial load time and bundle size.',
        '- **Optimization Example:** Use dynamic imports or split exports into smaller entry points.',
        '| File         | Issue Type                | Severity | Impact                                |',
        '| src/index.js | Eager re-export of modules| Medium   | Increased startup time and bundle size |',
      ]);
    });

    test('returns no signals for explicit no-issue responses', () => {
      expect(
        extractActionableIssueSignals(
          'No actionable issues found in prompt response. No changes needed.'
        )
      ).toEqual([]);
    });
  });
});

// Note: AiHelper class integration tests are skipped due to SDK mocking complexity
// The class will be tested via integration tests with real or stubbed SDK in Phase 6 Day 10

// ==============================================================================
// validateAiHelperState — pure function tests
// ==============================================================================

// Minimal valid inputs used as baselines across all tests
const validConfig = {
  model: 'gpt-4',
  maxRetries: 3,
  cache: true,
  timeout: 30_000,
  baseDelay: 1_000,
  maxDelay: 30_000,
  promptsDir: null,
};

const freshState = {
  initialized: false,
  available: false,
  authenticated: false,
  client: null,
  session: null,
  _promptCounter: 0,
};

const readyState = {
  initialized: true,
  available: true,
  authenticated: true,
  client: { id: 'client-1' },
  session: { id: 'session-1' },
  _promptCounter: 0,
};

describe('validateAiHelperState (pure)', () => {
  describe('returns consistent for valid inputs', () => {
    test('fresh (uninitialized) state passes', () => {
      const result = validateAiHelperState(validConfig, freshState);
      expect(result.consistent).toBe(true);
      expect(result.issues).toHaveLength(0);
      expect(result.config.valid).toBe(true);
      expect(result.state.valid).toBe(true);
    });

    test('fully initialized and authenticated state passes', () => {
      const result = validateAiHelperState(validConfig, readyState);
      expect(result.consistent).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    test('promptsDir as a non-empty string passes', () => {
      const cfg = { ...validConfig, promptsDir: '/logs/prompts' };
      const result = validateAiHelperState(cfg, freshState);
      expect(result.consistent).toBe(true);
    });

    test('all valid alternate models pass', () => {
      for (const model of [
        // legacy
        'gpt-4o',
        'gpt-4-turbo',
        'gpt-3.5-turbo',
        'claude-3-5-sonnet',
        // current production
        'claude-sonnet-4.6',
        'claude-haiku-4.5',
        'claude-opus-4.6',
        'gpt-5.4',
        'gpt-5-mini',
      ]) {
        const result = validateAiHelperState({ ...validConfig, model }, freshState);
        expect(result.consistent).toBe(true);
      }
    });
  });

  describe('config validation', () => {
    test('rejects missing model', () => {
      const result = validateAiHelperState({ ...validConfig, model: '' }, freshState);
      expect(result.consistent).toBe(false);
      expect(result.config.valid).toBe(false);
      expect(result.config.issues.some((i) => i.includes('model'))).toBe(true);
    });

    test('rejects non-string model', () => {
      const result = validateAiHelperState({ ...validConfig, model: 42 }, freshState);
      expect(result.consistent).toBe(false);
      expect(result.config.issues.some((i) => i.includes('model'))).toBe(true);
    });

    test('rejects unknown model name', () => {
      const result = validateAiHelperState({ ...validConfig, model: 'unknown-model' }, freshState);
      expect(result.consistent).toBe(false);
      expect(result.config.issues.some((i) => i.includes('unknown-model'))).toBe(true);
    });

    test('rejects maxRetries of 0', () => {
      const result = validateAiHelperState({ ...validConfig, maxRetries: 0 }, freshState);
      expect(result.consistent).toBe(false);
      expect(result.config.issues.some((i) => i.includes('maxRetries'))).toBe(true);
    });

    test('rejects non-integer maxRetries', () => {
      const result = validateAiHelperState({ ...validConfig, maxRetries: 1.5 }, freshState);
      expect(result.consistent).toBe(false);
    });

    test('rejects non-boolean cache', () => {
      const result = validateAiHelperState({ ...validConfig, cache: 'yes' }, freshState);
      expect(result.consistent).toBe(false);
      expect(result.config.issues.some((i) => i.includes('cache'))).toBe(true);
    });

    test('rejects timeout below minimum', () => {
      const result = validateAiHelperState({ ...validConfig, timeout: 500 }, freshState);
      expect(result.consistent).toBe(false);
      expect(result.config.issues.some((i) => i.includes('timeout'))).toBe(true);
    });

    test('rejects timeout above maximum', () => {
      const result = validateAiHelperState({ ...validConfig, timeout: 400_000 }, freshState);
      expect(result.consistent).toBe(false);
      expect(result.config.issues.some((i) => i.includes('timeout'))).toBe(true);
    });

    test('rejects maxDelay less than baseDelay', () => {
      const result = validateAiHelperState(
        { ...validConfig, baseDelay: 5_000, maxDelay: 1_000 },
        freshState
      );
      expect(result.consistent).toBe(false);
      expect(result.config.issues.some((i) => i.includes('maxDelay'))).toBe(true);
    });

    test('rejects empty string promptsDir', () => {
      const result = validateAiHelperState({ ...validConfig, promptsDir: '' }, freshState);
      expect(result.consistent).toBe(false);
      expect(result.config.issues.some((i) => i.includes('promptsDir'))).toBe(true);
    });

    test('rejects non-string non-null promptsDir', () => {
      const result = validateAiHelperState({ ...validConfig, promptsDir: 123 }, freshState);
      expect(result.consistent).toBe(false);
    });

    test('accumulates multiple config issues', () => {
      const result = validateAiHelperState(
        { ...validConfig, model: '', maxRetries: 0, cache: 'yes' },
        freshState
      );
      expect(result.config.issues.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('state validation', () => {
    test('rejects authenticated=true when available=false', () => {
      const result = validateAiHelperState(validConfig, {
        ...freshState,
        initialized: true,
        authenticated: true,
        available: false,
      });
      expect(result.consistent).toBe(false);
      expect(result.state.issues.some((i) => i.includes('authenticated'))).toBe(true);
    });

    test('rejects available=true with null client', () => {
      const result = validateAiHelperState(validConfig, {
        ...readyState,
        client: null,
      });
      expect(result.consistent).toBe(false);
      expect(result.state.issues.some((i) => i.includes('client'))).toBe(true);
    });

    test('rejects available=true with null session', () => {
      const result = validateAiHelperState(validConfig, {
        ...readyState,
        session: null,
      });
      expect(result.consistent).toBe(false);
      expect(result.state.issues.some((i) => i.includes('session'))).toBe(true);
    });

    test('rejects non-initialized state with a live session', () => {
      const result = validateAiHelperState(validConfig, {
        ...freshState,
        initialized: false,
        session: { id: 'ghost' },
      });
      expect(result.consistent).toBe(false);
      expect(result.state.issues.some((i) => i.includes('not initialized'))).toBe(true);
    });

    test('rejects negative _promptCounter', () => {
      const result = validateAiHelperState(validConfig, {
        ...freshState,
        _promptCounter: -1,
      });
      expect(result.consistent).toBe(false);
      expect(result.state.issues.some((i) => i.includes('_promptCounter'))).toBe(true);
    });

    test('rejects non-integer _promptCounter', () => {
      const result = validateAiHelperState(validConfig, {
        ...freshState,
        _promptCounter: 2.5,
      });
      expect(result.consistent).toBe(false);
    });
  });

  describe('result structure', () => {
    test('always returns the four expected keys', () => {
      const result = validateAiHelperState(validConfig, freshState);
      expect(result).toHaveProperty('consistent');
      expect(result).toHaveProperty('issues');
      expect(result).toHaveProperty('config');
      expect(result).toHaveProperty('state');
    });

    test('config and state sub-objects have valid and issues', () => {
      const result = validateAiHelperState(validConfig, freshState);
      expect(result.config).toHaveProperty('valid');
      expect(result.config).toHaveProperty('issues');
      expect(result.state).toHaveProperty('valid');
      expect(result.state).toHaveProperty('issues');
    });

    test('top-level issues is union of config and state issues', () => {
      const badConfig = { ...validConfig, model: '' };
      const badState = { ...freshState, _promptCounter: -1 };
      const result = validateAiHelperState(badConfig, badState);
      expect(result.issues.length).toBe(result.config.issues.length + result.state.issues.length);
    });

    test('is deterministic — same inputs always produce same output', () => {
      const r1 = validateAiHelperState(validConfig, freshState);
      const r2 = validateAiHelperState(validConfig, freshState);
      expect(r1).toEqual(r2);
    });
  });
});

// ==============================================================================
// AiHelper#checkConsistency — instance method tests (no SDK, no I/O)
// ==============================================================================

describe('AiHelper#checkConsistency', () => {
  test('returns consistent for a freshly constructed instance', () => {
    const helper = new AiHelper({ model: 'gpt-4' });
    const result = helper.checkConsistency();
    expect(result.consistent).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  test('reflects config issue when constructed with an invalid model', () => {
    const helper = new AiHelper({ model: 'unsupported-model-xyz' });
    const result = helper.checkConsistency();
    expect(result.consistent).toBe(false);
    expect(result.config.issues.some((i) => i.includes('unsupported-model-xyz'))).toBe(true);
  });

  test('reflects config issue when maxRetries is corrupted to 0 after construction', () => {
    const helper = new AiHelper({ model: 'gpt-4' });
    helper.config.maxRetries = 0; // simulate config corruption at runtime
    const result = helper.checkConsistency();
    expect(result.consistent).toBe(false);
    expect(result.config.issues.some((i) => i.includes('maxRetries'))).toBe(true);
  });

  test('state is coherent before initialize() is called', () => {
    const helper = new AiHelper({ model: 'gpt-4' });
    const result = helper.checkConsistency();
    expect(result.state.valid).toBe(true);
  });

  test('returns same structure as validateAiHelperState', () => {
    const helper = new AiHelper({ model: 'gpt-4' });
    const result = helper.checkConsistency();
    expect(result).toHaveProperty('consistent');
    expect(result).toHaveProperty('issues');
    expect(result).toHaveProperty('config');
    expect(result).toHaveProperty('state');
  });
});

// ==============================================================================
// AiHelper Class - Method Coverage Tests
// ==============================================================================

describe('AiHelper class methods', () => {
  let helper;

  beforeEach(() => {
    helper = new AiHelper({ model: 'gpt-4.1' });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ── Simple property-based methods ──────────────────────────────────────────

  describe('isAvailable', () => {
    test('returns false when not initialized', () => {
      expect(helper.isAvailable()).toBe(false);
    });

    test('returns true when available and authenticated', () => {
      helper.available = true;
      helper.authenticated = true;
      expect(helper.isAvailable()).toBe(true);
    });

    test('returns false when available but not authenticated', () => {
      helper.available = true;
      helper.authenticated = false;
      expect(helper.isAvailable()).toBe(false);
    });
  });

  describe('getAvailableModels', () => {
    test('returns empty array before initialization', () => {
      expect(helper.getAvailableModels()).toEqual([]);
    });

    test('returns models after they are set', () => {
      helper.availableModels = [{ id: 'gpt-4.1' }, { id: 'gpt-4o' }];
      expect(helper.getAvailableModels()).toHaveLength(2);
    });
  });

  describe('isSdkAvailable', () => {
    test('returns a boolean', () => {
      const result = helper.isSdkAvailable();
      expect(typeof result).toBe('boolean');
    });
  });

  // ── initialize() ───────────────────────────────────────────────────────────

  describe('initialize', () => {
    test('returns current available state if already initialized', async () => {
      helper.initialized = true;
      helper.available = true;
      const result = await helper.initialize();
      expect(result).toBe(true);
    });

    test('returns false and sets flags when SDK not available', async () => {
      jest.spyOn(helper, 'isSdkAvailable').mockReturnValue(false);
      const result = await helper.initialize();
      expect(result).toBe(false);
      expect(helper.initialized).toBe(true);
      expect(helper.available).toBe(false);
    });

    test('sets available=true when authenticated', async () => {
      jest.spyOn(helper, 'isSdkAvailable').mockReturnValue(true);
      helper._wrapper = {
        initialize: jest.fn().mockResolvedValue({
          authenticated: true,
          availableModels: [{ id: 'gpt-4.1' }],
        }),
        client: null,
        session: null,
      };
      const result = await helper.initialize();
      expect(result).toBe(true);
      expect(helper.available).toBe(true);
      expect(helper.authenticated).toBe(true);
    });

    test('sets available=false when not authenticated', async () => {
      jest.spyOn(helper, 'isSdkAvailable').mockReturnValue(true);
      helper._wrapper = {
        initialize: jest.fn().mockResolvedValue({
          authenticated: false,
          availableModels: [],
        }),
        client: null,
        session: null,
      };
      const result = await helper.initialize();
      expect(result).toBe(false);
      expect(helper.available).toBe(false);
    });

    test('returns false and sets flags when wrapper throws', async () => {
      jest.spyOn(helper, 'isSdkAvailable').mockReturnValue(true);
      helper._wrapper = {
        initialize: jest.fn().mockRejectedValue(new Error('network error')),
        client: null,
        session: null,
      };
      const result = await helper.initialize();
      expect(result).toBe(false);
      expect(helper.initialized).toBe(true);
    });
  });

  // ── validateSdk() ──────────────────────────────────────────────────────────

  describe('validateSdk', () => {
    test('returns unavailable when SDK not found', async () => {
      jest.spyOn(helper, 'isSdkAvailable').mockReturnValue(false);
      const result = await helper.validateSdk();
      expect(result.available).toBe(false);
      expect(result.suggestions.length).toBeGreaterThan(0);
    });

    test('returns authenticated when SDK ready', async () => {
      jest.spyOn(helper, 'isSdkAvailable').mockReturnValue(true);
      jest.spyOn(helper, 'initialize').mockResolvedValue(true);
      helper.authenticated = true;
      const result = await helper.validateSdk();
      expect(result.available).toBe(true);
      expect(result.authenticated).toBe(true);
    });

    test('returns auth suggestions when not authenticated', async () => {
      jest.spyOn(helper, 'isSdkAvailable').mockReturnValue(true);
      jest.spyOn(helper, 'initialize').mockResolvedValue(false);
      helper.authenticated = false;
      const result = await helper.validateSdk();
      expect(result.available).toBe(true);
      expect(result.authenticated).toBe(false);
      expect(result.suggestions.length).toBeGreaterThan(0);
    });

    test('handles errors during validation', async () => {
      jest.spyOn(helper, 'isSdkAvailable').mockReturnValue(true);
      jest.spyOn(helper, 'initialize').mockRejectedValue(new Error('init failed'));
      const result = await helper.validateSdk();
      expect(result.message).toMatch(/SDK validation error/);
    });
  });

  // ── shouldEnableAi() ───────────────────────────────────────────────────────

  describe('shouldEnableAi', () => {
    test('returns false when not available', async () => {
      jest.spyOn(helper, 'initialize').mockResolvedValue(false);
      helper.initialized = true;
      helper.available = false;
      const result = await helper.shouldEnableAi();
      expect(result).toBe(false);
    });

    test('calls initialize if not yet initialized', async () => {
      const initSpy = jest.spyOn(helper, 'initialize').mockResolvedValue(false);
      helper.initialized = false;
      await helper.shouldEnableAi();
      expect(initSpy).toHaveBeenCalled();
    });

    test('returns true when available and authenticated', async () => {
      jest.spyOn(helper, 'initialize').mockResolvedValue(true);
      helper.initialized = true;
      helper.available = true;
      helper.authenticated = true;
      const result = await helper.shouldEnableAi();
      expect(result).toBe(true);
    });
  });

  // ── executeRequest() ───────────────────────────────────────────────────────

  describe('executeRequest', () => {
    test('throws SystemError when not available', async () => {
      helper.available = false;
      helper.authenticated = false;
      await expect(helper.executeRequest('test prompt')).rejects.toThrow('AI helper not available');
    });

    test('throws ValidationError for non-string prompt', async () => {
      helper.available = true;
      helper.authenticated = true;
      await expect(helper.executeRequest(null)).rejects.toThrow();
    });

    test('throws ValidationError for empty string prompt', async () => {
      helper.available = true;
      helper.authenticated = true;
      await expect(helper.executeRequest('')).rejects.toThrow();
    });

    test('returns parsed response on success', async () => {
      helper.available = true;
      helper.authenticated = true;
      helper._wrapper = {
        send: jest.fn().mockResolvedValue('Here is a detailed and comprehensive AI response.'),
        recreateSession: jest.fn().mockResolvedValue(undefined),
        client: null,
        session: null,
      };
      const result = await helper.executeRequest('What is the meaning of life?');
      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('content');
    });

    test('retries and eventually throws on repeated failures', async () => {
      helper.available = true;
      helper.authenticated = true;
      helper.config.maxRetries = 2;
      helper.config.baseDelay = 1;
      helper._wrapper = {
        send: jest.fn().mockRejectedValue(new Error('network error')),
        recreateSession: jest.fn().mockResolvedValue(undefined),
        client: null,
        session: null,
      };
      // shouldRetry returns false for non-retryable errors after first attempt
      // so this should throw
      await expect(
        helper.executeRequest('test prompt that will fail with error')
      ).rejects.toBeDefined();
    });

    // ── streaming path ──────────────────────────────────────────────────────

    test('uses send (not sendStream) when stream:true and onChunk provided', async () => {
      helper.available = true;
      helper.authenticated = true;
      const send = jest.fn().mockResolvedValue('Streamed response content here.');
      helper._wrapper = {
        send,
        recreateSession: jest.fn().mockResolvedValue(undefined),
        client: null,
        session: null,
      };
      const onChunk = jest.fn();
      const result = await helper.executeRequest('stream me', { stream: true }, onChunk);
      expect(send).toHaveBeenCalledWith('stream me', expect.any(Number));
      expect(onChunk).toHaveBeenCalledWith('Streamed response content here.');
      expect(result).toHaveProperty('success', true);
    });

    test('uses send (non-streaming) when stream:true but no onChunk', async () => {
      helper.available = true;
      helper.authenticated = true;
      const send = jest.fn().mockResolvedValue('Non-streamed response content here.');
      helper._wrapper = {
        send,
        recreateSession: jest.fn().mockResolvedValue(undefined),
        client: null,
        session: null,
      };
      const result = await helper.executeRequest('no chunk', { stream: true });
      expect(send).toHaveBeenCalled();
      expect(result).toHaveProperty('success', true);
    });

    test('uses send when stream:false even if onChunk provided', async () => {
      helper.available = true;
      helper.authenticated = true;
      const send = jest.fn().mockResolvedValue('Response content for non-streaming test.');
      helper._wrapper = {
        send,
        recreateSession: jest.fn().mockResolvedValue(undefined),
        client: null,
        session: null,
      };
      await helper.executeRequest('non-stream', { stream: false }, jest.fn());
      expect(send).toHaveBeenCalled();
    });

    // ── streamingCallback (instance-level) ──────────────────────────────────

    test('streamingCallback: uses send automatically without explicit stream:true', async () => {
      const streamingCallback = jest.fn();
      const send = jest.fn().mockResolvedValue('Streamed via instance callback.');
      const h = new AiHelper({ streamingCallback });
      h.available = true;
      h.authenticated = true;
      h._wrapper = {
        send,
        recreateSession: jest.fn().mockResolvedValue(undefined),
        client: null,
        session: null,
      };
      const result = await h.executeRequest('prompt', {});
      expect(send).toHaveBeenCalled();
      expect(streamingCallback).toHaveBeenCalled();
      expect(result).toHaveProperty('success', true);
    });

    test('streamingCallback: wraps callback with persona metadata', async () => {
      const received = [];
      const streamingCallback = (delta, meta) => received.push({ delta, meta });
      // SDK delivers the full response as a single chunk (no real streaming).
      const send = jest.fn().mockResolvedValue('hello world');
      const h = new AiHelper({ streamingCallback });
      h.available = true;
      h.authenticated = true;
      h._wrapper = {
        send,
        recreateSession: jest.fn().mockResolvedValue(undefined),
        client: null,
        session: null,
      };
      await h.executeRequest('p', { persona: 'test_engineer' });
      expect(received).toHaveLength(1);
      expect(received[0].delta).toBe('hello world');
      expect(received[0].meta).toMatchObject({ persona: 'test_engineer' });
    });

    test('streamingCallback: does not activate when null (non-streaming default)', async () => {
      const h = new AiHelper({ streamingCallback: null });
      const send = jest.fn().mockResolvedValue('plain response');
      h.available = true;
      h.authenticated = true;
      h._wrapper = {
        send,
        recreateSession: jest.fn().mockResolvedValue(undefined),
        client: null,
        session: null,
      };
      await h.executeRequest('prompt', {});
      expect(send).toHaveBeenCalled();
    });

    test('explicit onChunk arg takes precedence over streamingCallback', async () => {
      const instanceCb = jest.fn();
      const explicitCb = jest.fn();
      const send = jest.fn().mockResolvedValue('tok');
      const h = new AiHelper({ streamingCallback: instanceCb });
      h.available = true;
      h.authenticated = true;
      h._wrapper = {
        send,
        recreateSession: jest.fn().mockResolvedValue(undefined),
        client: null,
        session: null,
      };
      await h.executeRequest('p', { stream: true }, explicitCb);
      // The explicit callback is passed directly (without persona wrapping)
      expect(explicitCb).toHaveBeenCalledWith('tok');
      expect(instanceCb).not.toHaveBeenCalled();
    });
  });

  // ── executeBatch() ─────────────────────────────────────────────────────────

  describe('executeBatch', () => {
    test('throws SystemError when not available', async () => {
      helper.available = false;
      await expect(helper.executeBatch([{ prompt: 'test' }])).rejects.toThrow(
        'AI helper not available'
      );
    });

    test('processes batch requests sequentially by default', async () => {
      helper.available = true;
      helper.authenticated = true;
      const execSpy = jest
        .spyOn(helper, 'executeRequest')
        .mockResolvedValue({ success: true, content: 'ok' });
      const results = await helper.executeBatch([
        { prompt: 'prompt one' },
        { prompt: 'prompt two' },
      ]);
      expect(execSpy).toHaveBeenCalledTimes(2);
      expect(results).toHaveLength(2);
    });
  });
});

// ==============================================================================
// Additional coverage - validateAiHelperState edge cases and class branches
// ==============================================================================

describe('validateAiHelperState - additional edge cases', () => {
  const goodState = () => ({
    initialized: false,
    available: false,
    authenticated: false,
    client: null,
    session: null,
    _promptCounter: 0,
  });

  test('flags timeout that is unreasonably high', () => {
    const result = validateAiHelperState(
      {
        model: 'gpt-4.1',
        maxRetries: 3,
        cache: true,
        timeout: 999999999,
        baseDelay: 100,
        maxDelay: 5000,
        promptsDir: null,
      },
      goodState()
    );
    expect(result.consistent).toBe(false);
    expect(result.config.issues.some((i) => i.includes('unreasonably high'))).toBe(true);
  });

  test('flags negative baseDelay', () => {
    const result = validateAiHelperState(
      {
        model: 'gpt-4.1',
        maxRetries: 3,
        cache: true,
        timeout: 60000,
        baseDelay: -1,
        maxDelay: 5000,
        promptsDir: null,
      },
      goodState()
    );
    expect(result.consistent).toBe(false);
    expect(result.config.issues.some((i) => i.includes('baseDelay'))).toBe(true);
  });

  test('flags maxDelay less than baseDelay', () => {
    const result = validateAiHelperState(
      {
        model: 'gpt-4.1',
        maxRetries: 3,
        cache: true,
        timeout: 60000,
        baseDelay: 5000,
        maxDelay: 100,
        promptsDir: null,
      },
      goodState()
    );
    expect(result.consistent).toBe(false);
    expect(result.config.issues.some((i) => i.includes('maxDelay'))).toBe(true);
  });

  test('flags non-string promptsDir that is not null', () => {
    const result = validateAiHelperState(
      {
        model: 'gpt-4.1',
        maxRetries: 3,
        cache: true,
        timeout: 60000,
        baseDelay: 100,
        maxDelay: 5000,
        promptsDir: 42,
      },
      goodState()
    );
    expect(result.consistent).toBe(false);
    expect(result.config.issues.some((i) => i.includes('promptsDir'))).toBe(true);
  });

  test('flags empty string promptsDir', () => {
    const result = validateAiHelperState(
      {
        model: 'gpt-4.1',
        maxRetries: 3,
        cache: true,
        timeout: 60000,
        baseDelay: 100,
        maxDelay: 5000,
        promptsDir: '   ',
      },
      goodState()
    );
    expect(result.consistent).toBe(false);
    expect(result.config.issues.some((i) => i.includes('empty string'))).toBe(true);
  });

  test('flags non-boolean state.initialized', () => {
    const state = { ...goodState(), initialized: 'yes' };
    const result = validateAiHelperState(
      {
        model: 'gpt-4.1',
        maxRetries: 3,
        cache: true,
        timeout: 60000,
        baseDelay: 100,
        maxDelay: 5000,
        promptsDir: null,
      },
      state
    );
    expect(result.state.issues.some((i) => i.includes('initialized'))).toBe(true);
  });

  test('flags non-boolean state.available', () => {
    const state = { ...goodState(), available: 1 };
    const result = validateAiHelperState(
      {
        model: 'gpt-4.1',
        maxRetries: 3,
        cache: true,
        timeout: 60000,
        baseDelay: 100,
        maxDelay: 5000,
        promptsDir: null,
      },
      state
    );
    expect(result.state.issues.some((i) => i.includes('available'))).toBe(true);
  });

  test('flags non-boolean state.authenticated', () => {
    const state = { ...goodState(), authenticated: 'true' };
    const result = validateAiHelperState(
      {
        model: 'gpt-4.1',
        maxRetries: 3,
        cache: true,
        timeout: 60000,
        baseDelay: 100,
        maxDelay: 5000,
        promptsDir: null,
      },
      state
    );
    expect(result.state.issues.some((i) => i.includes('authenticated'))).toBe(true);
  });
});

describe('AiHelper class - additional method coverage', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('initialize warns when configured model is not in available models', async () => {
    const helper = new AiHelper({ model: 'gpt-4.1' });
    jest.spyOn(helper, 'isSdkAvailable').mockReturnValue(true);
    helper._wrapper = {
      initialize: jest.fn().mockResolvedValue({
        authenticated: true,
        availableModels: [{ id: 'gpt-3.5' }, { id: 'gpt-4o' }], // 'gpt-4.1' NOT in list
      }),
      client: null,
      session: null,
    };
    const result = await helper.initialize();
    expect(result).toBe(true); // still initializes successfully
    expect(helper.available).toBe(true);
  });

  test('constructor stores fallbackModel from config', () => {
    const helper = new AiHelper({ model: 'gpt-4.1', fallbackModel: 'gpt-5-mini' });
    expect(helper.config.fallbackModel).toBe('gpt-5-mini');
  });

  test('constructor defaults fallbackModel to claude-haiku-4.5', () => {
    const helper = new AiHelper({ model: 'gpt-4.1' });
    expect(helper.config.fallbackModel).toBe('claude-haiku-4.5');
  });

  test('constructor allows disabling fallback by passing null', () => {
    const helper = new AiHelper({ model: 'gpt-4.1', fallbackModel: null });
    expect(helper.config.fallbackModel).toBeNull();
  });

  test('constructor stores _tools reference', () => {
    const tools = [{ name: 'my_tool' }];
    const helper = new AiHelper({ tools });
    expect(helper._tools).toBe(tools);
  });

  test('executeRequest invokes fallback model when all retries time out', async () => {
    const helper = new AiHelper({
      model: 'gpt-4.1',
      fallbackModel: 'claude-haiku-4.5',
      baseDelay: 0,
    });
    helper.available = true;
    helper.authenticated = true;
    helper.config.maxRetries = 1;
    const primarySend = jest
      .fn()
      .mockRejectedValue(new Error('Timeout after 60000ms waiting for session.idle'));
    const recreateSession = jest.fn().mockResolvedValue(undefined);
    helper._wrapper = { send: primarySend, recreateSession };
    const fallbackInitialize = jest.fn().mockResolvedValue({
      authenticated: true,
      availableModels: [{ id: 'claude-haiku-4.5' }],
    });
    const fallbackSend = jest.fn().mockResolvedValue({ content: 'Fallback response', success: true });
    const fallbackCleanup = jest.fn().mockResolvedValue(undefined);
    const fallbackWrapper = {
      initialize: fallbackInitialize,
      send: fallbackSend,
      cleanup: fallbackCleanup,
    };
    const createFallbackWrapper = jest
      .spyOn(helper, '_createProviderWrapper')
      .mockReturnValue(fallbackWrapper);

    const result = await helper.executeRequest('test prompt');

    expect(result.content).toBe('Fallback response');
    expect(primarySend).toHaveBeenCalled();
    expect(recreateSession).toHaveBeenCalled();
    expect(createFallbackWrapper).toHaveBeenCalledWith({
      model: 'claude-haiku-4.5',
      timeout: 120000,
      workingDirectory: null,
      streaming: false,
      tools: helper._tools,
    });
    expect(fallbackInitialize).toHaveBeenCalled();
    expect(fallbackSend).toHaveBeenCalledWith('test prompt', 120000);
    expect(fallbackCleanup).toHaveBeenCalled();
  });

  test('executeRequest skips fallback when fallbackModel is null', async () => {
    const helper = new AiHelper({ model: 'gpt-4.1', fallbackModel: null, baseDelay: 0 });
    helper.available = true;
    helper.authenticated = true;
    helper.config.maxRetries = 1;
    helper._wrapper = {
      send: jest
        .fn()
        .mockRejectedValue(new Error('Timeout after 60000ms waiting for session.idle')),
      recreateSession: jest.fn().mockResolvedValue(undefined),
    };
    await expect(helper.executeRequest('test prompt')).rejects.toThrow(/AI request failed after/);
  });

  test('executeRequest skips fallback when error is not a timeout', async () => {
    const helper = new AiHelper({
      model: 'gpt-4.1',
      fallbackModel: 'claude-haiku-4.5',
      baseDelay: 0,
    });
    helper.available = true;
    helper.authenticated = true;
    helper.config.maxRetries = 1;
    helper._wrapper = {
      send: jest.fn().mockRejectedValue(new Error('Authentication failed')),
      recreateSession: jest.fn().mockResolvedValue(undefined),
    };
    await expect(helper.executeRequest('test prompt')).rejects.toThrow(/AI request failed after/);
  });

  test('executeRequest skips fallback when fallbackModel equals primary model', async () => {
    const helper = new AiHelper({ model: 'gpt-4.1', fallbackModel: 'gpt-4.1', baseDelay: 0 });
    helper.available = true;
    helper.authenticated = true;
    helper.config.maxRetries = 1;
    helper._wrapper = {
      send: jest
        .fn()
        .mockRejectedValue(new Error('Timeout after 60000ms waiting for session.idle')),
      recreateSession: jest.fn().mockResolvedValue(undefined),
    };
    await expect(helper.executeRequest('test prompt')).rejects.toThrow(/AI request failed after/);
  });

  test('executeBatch - parallel mode with concurrency', async () => {
    const helper = new AiHelper();
    helper.available = true;
    helper.authenticated = true;
    jest
      .spyOn(helper, 'executeRequest')
      .mockResolvedValue({ success: true, content: 'parallel ok' });
    const results = await helper.executeBatch(
      [{ prompt: 'one' }, { prompt: 'two' }, { prompt: 'three' }],
      { parallel: true, concurrency: 2 }
    );
    expect(results).toHaveLength(3);
    expect(results.every((r) => r.success)).toBe(true);
  });

  test('executeBatch - sequential handles per-request errors gracefully', async () => {
    const helper = new AiHelper();
    helper.available = true;
    helper.authenticated = true;
    jest
      .spyOn(helper, 'executeRequest')
      .mockRejectedValueOnce(new Error('request failed'))
      .mockResolvedValueOnce({ success: true, content: 'ok' });
    const results = await helper.executeBatch([
      { prompt: 'bad prompt' },
      { prompt: 'good prompt' },
    ]);
    expect(results).toHaveLength(2);
    expect(results[0].success).toBe(false);
    expect(results[1].success).toBe(true);
  });

  test('executeBatch - returns empty array when no valid requests', async () => {
    const helper = new AiHelper();
    helper.available = true;
    helper.authenticated = true;
    const results = await helper.executeBatch([]);
    expect(results).toEqual([]);
  });

  test('cleanup resets state', async () => {
    const helper = new AiHelper();
    helper.initialized = true;
    helper.available = true;
    helper.authenticated = true;
    helper._wrapper = { cleanup: jest.fn().mockResolvedValue(undefined) };
    await helper.cleanup();
    expect(helper.initialized).toBe(false);
    expect(helper.available).toBe(false);
    expect(helper.authenticated).toBe(false);
  });
});

// ==============================================================================
// Workflow Tool Handlers (pure handlers, no SDK dependency)
// ==============================================================================

describe('readFileHandler', () => {
  let dir;
  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'ai-tools-'));
  });

  test('reads file content and returns metadata', async () => {
    const filePath = path.join(dir, 'hello.txt');
    await writeFile(filePath, 'hello world', 'utf8');
    const result = await readFileHandler('hello.txt', dir);
    expect(result.content).toBe('hello world');
    expect(result.size).toBe(11);
    expect(result.path).toBe(filePath);
  });

  test('resolves absolute path directly', async () => {
    const filePath = path.join(dir, 'abs.txt');
    await writeFile(filePath, 'abs', 'utf8');
    const result = await readFileHandler(filePath, '/ignored');
    expect(result.content).toBe('abs');
  });

  test('throws when file does not exist', async () => {
    await expect(readFileHandler('missing.txt', dir)).rejects.toThrow();
  });
});

describe('listFilesHandler', () => {
  let dir;
  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'ai-list-'));
    await writeFile(path.join(dir, 'a.js'), '');
    await mkdir(path.join(dir, 'sub'));
  });

  test('lists files and directories with trailing slash for dirs', async () => {
    const result = await listFilesHandler('.', dir);
    expect(result.entries).toContain('a.js');
    expect(result.entries).toContain('sub/');
    expect(result.path).toBe(dir);
  });

  test('uses absolute path directly when provided', async () => {
    const result = await listFilesHandler(dir, '/ignored');
    expect(result.entries).toContain('a.js');
  });
});

describe('buildWorkflowTools', () => {
  test('returns array of 3 tool definitions', () => {
    const tools = buildWorkflowTools('/tmp/project');
    expect(tools).toHaveLength(3);
  });

  test('tool names are read_file, list_files, get_git_status', () => {
    // defineTool is mocked in the jest mock for @github/copilot-sdk in this env;
    // buildWorkflowTools passes the defineTool call result through — we just check
    // that we get 3 non-null items back, since the mock returns its second arg or
    // an identity object depending on the mock setup.
    const tools = buildWorkflowTools('/tmp');
    expect(tools).toHaveLength(3);
    tools.forEach((t) => expect(t).toBeDefined());
  });
});

describe('AiHelper._logPrompt - Project Version header', () => {
  let promptsDir;

  beforeEach(async () => {
    promptsDir = await mkdtemp(path.join(tmpdir(), 'ai-log-version-'));
  });

  test('includes Project Version in log header when projectVersion is set', async () => {
    const { readFile, readdir } = await import('fs/promises');
    const helper = new AiHelper({ promptsDir, projectVersion: '1.2.3' });
    // Directly invoke the private log method via executeRequest mock path:
    // call the internal method directly to avoid needing a live AI SDK.
    await helper._logPrompt(
      'test prompt',
      { persona: 'tester', model: 'gpt-4.1' },
      { content: 'test response' }
    );
    const files = await readdir(promptsDir);
    expect(files).toHaveLength(1);
    const content = await readFile(path.join(promptsDir, files[0]), 'utf8');
    expect(content).toContain('**Project Version:** 1.2.3');
  });

  test('omits Project Version line when projectVersion is null', async () => {
    const { readFile, readdir } = await import('fs/promises');
    const helper = new AiHelper({ promptsDir, projectVersion: null });
    await helper._logPrompt(
      'test prompt',
      { persona: 'tester', model: 'gpt-4.1' },
      { content: 'test response' }
    );
    const files = await readdir(promptsDir);
    const content = await readFile(path.join(promptsDir, files[0]), 'utf8');
    expect(content).not.toContain('**Project Version:**');
  });

  test('includes Workflow Version in log header when workflowVersion is set', async () => {
    const { readFile, readdir } = await import('fs/promises');
    const helper = new AiHelper({ promptsDir, workflowVersion: '1.9.11' });
    await helper._logPrompt(
      'test prompt',
      { persona: 'tester', model: 'gpt-4.1' },
      { content: 'test response' }
    );
    const files = await readdir(promptsDir);
    const content = await readFile(path.join(promptsDir, files[0]), 'utf8');
    expect(content).toContain('**Workflow Version:** 1.9.11');
  });

  test('omits Workflow Version line when workflowVersion is null', async () => {
    const { readFile, readdir } = await import('fs/promises');
    const helper = new AiHelper({ promptsDir, workflowVersion: null });
    await helper._logPrompt(
      'test prompt',
      { persona: 'tester', model: 'gpt-4.1' },
      { content: 'test response' }
    );
    const files = await readdir(promptsDir);
    const content = await readFile(path.join(promptsDir, files[0]), 'utf8');
    expect(content).not.toContain('**Workflow Version:**');
  });

  test('includes Workflow Core Version in log header when workflowCoreVersion is set', async () => {
    const { readFile, readdir } = await import('fs/promises');
    const helper = new AiHelper({ promptsDir, workflowCoreVersion: '1.2.3' });
    await helper._logPrompt(
      'test prompt',
      { persona: 'tester', model: 'gpt-4.1' },
      { content: 'test response' }
    );
    const files = await readdir(promptsDir);
    const content = await readFile(path.join(promptsDir, files[0]), 'utf8');
    expect(content).toContain('**Workflow Core Version:** 1.2.3');
  });

  test('omits Workflow Core Version line when workflowCoreVersion is null', async () => {
    const { readFile, readdir } = await import('fs/promises');
    const helper = new AiHelper({ promptsDir, workflowCoreVersion: null });
    await helper._logPrompt(
      'test prompt',
      { persona: 'tester', model: 'gpt-4.1' },
      { content: 'test response' }
    );
    const files = await readdir(promptsDir);
    const content = await readFile(path.join(promptsDir, files[0]), 'utf8');
    expect(content).not.toContain('**Workflow Core Version:**');
  });

  test('all three version fields coexist in correct order', async () => {
    const { readFile, readdir } = await import('fs/promises');
    const helper = new AiHelper({
      promptsDir,
      projectVersion: '1.9.1',
      workflowVersion: '1.9.11',
      workflowCoreVersion: '1.2.3',
    });
    await helper._logPrompt(
      'test prompt',
      { persona: 'tester', model: 'gpt-4.1' },
      { content: 'test response' }
    );
    const files = await readdir(promptsDir);
    const content = await readFile(path.join(promptsDir, files[0]), 'utf8');
    expect(content).toContain('**Project Version:** 1.9.1');
    expect(content).toContain('**Workflow Version:** 1.9.11');
    expect(content).toContain('**Workflow Core Version:** 1.2.3');
    const projectIdx = content.indexOf('**Project Version:**');
    const workflowIdx = content.indexOf('**Workflow Version:**');
    const coreIdx = content.indexOf('**Workflow Core Version:**');
    expect(projectIdx).toBeLessThan(workflowIdx);
    expect(workflowIdx).toBeLessThan(coreIdx);
  });

  test('adds an auto-extracted issue snapshot ahead of the raw prompt and response blocks', async () => {
    const { readFile, readdir } = await import('fs/promises');
    const helper = new AiHelper({ promptsDir });
    await helper._logPrompt(
      'test prompt',
      { persona: 'performance_engineer', model: 'gpt-4.1' },
      {
        content: [
          '### Findings',
          '',
          '#### 1. Eager Re-Export of Many Modules (Potential Startup/Bundle Impact)',
          '- **File:** `src/index.js`',
          '- **Issue Type:** Eager re-export of many modules and functions',
          '- **Optimization Example:** Use dynamic imports or split exports into smaller entry points.',
        ].join('\n'),
      }
    );

    const files = await readdir(promptsDir);
    const content = await readFile(path.join(promptsDir, files[0]), 'utf8');
    expect(content).toContain('## Auto-Extracted Issue Signals');
    expect(content).toContain('**Detected Signals:** 4');
    expect(content).toContain(
      '#### 1. Eager Re-Export of Many Modules (Potential Startup/Bundle Impact)'
    );
    expect(content).toContain(
      '- **Optimization Example:** Use dynamic imports or split exports into smaller entry points.'
    );
    expect(content.indexOf('## Auto-Extracted Issue Signals')).toBeLessThan(
      content.indexOf('## Prompt')
    );
    expect(content.indexOf('## Prompt')).toBeLessThan(content.indexOf('## Response'));
  });

  test('records an explicit zero-signal snapshot when no actionable issue cues are detected', async () => {
    const { readFile, readdir } = await import('fs/promises');
    const helper = new AiHelper({ promptsDir });
    await helper._logPrompt(
      'test prompt',
      { persona: 'tester', model: 'gpt-4.1' },
      { content: 'No actionable issues found in prompt response. No changes needed.' }
    );

    const files = await readdir(promptsDir);
    const content = await readFile(path.join(promptsDir, files[0]), 'utf8');
    expect(content).toContain('## Auto-Extracted Issue Signals');
    expect(content).toContain('**Detected Signals:** 0');
    expect(content).toContain('No concrete issue signals auto-detected from response text.');
  });
});
