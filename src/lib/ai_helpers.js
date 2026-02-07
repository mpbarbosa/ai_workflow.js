/**
 * AI Helpers Module
 *
 * Core AI integration for GitHub Copilot SDK interaction, request orchestration,
 * and response processing.
 *
 * Architecture: v2.0.0 Referential Transparency
 * - Pure functions: Response parsing, error handling, batch formatting
 * - Impure wrapper: SDK integration, authentication, network calls
 *
 * @module lib/ai_helpers
 * @version 2.0.0
 */

import { CopilotClient } from '@github/copilot-sdk';
import { logger } from '../core/logger.js';
import { validateAIResponse } from './ai_validation.js';
import { ValidationError, SystemError } from '../utils/errors.js';

// ==============================================================================
// CONSTANTS - Magic numbers extracted for maintainability
// ==============================================================================

// Confidence score thresholds for AI response quality
const CONFIDENCE_SCORES = {
  LOW: 0.3, // Very short or incomplete responses
  UNCERTAIN: 0.5, // Unclear or uncertain responses
  SHORT_VALID: 0.7, // Short but valid responses
  MEDIUM: 0.8, // Medium-length responses
  HIGH: 0.9, // Detailed, comprehensive responses
};

// Content length thresholds for quality assessment
const CONTENT_LENGTH = {
  MIN_VALID: 10, // Minimum length for valid response
  SHORT_THRESHOLD: 30, // Threshold between short and medium
  DETAILED_THRESHOLD: 500, // Threshold for detailed response
};

// Default AI request parameters
const DEFAULT_REQUEST = {
  MODEL: 'gpt-4',
  TEMPERATURE: 0.7,
  MAX_TOKENS: 4000,
  TIMEOUT_MS: 30000, // 30 seconds
  STREAM: false,
  MAX_RETRIES: 3,
  BASE_DELAY_MS: 1000, // 1 second initial retry delay
  MAX_DELAY_MS: 30000, // 30 seconds maximum retry delay
};

// ==============================================================================
// PURE FUNCTIONS - Response Processing
// ==============================================================================

/**
 * Calculate confidence score based on content length and quality (PURE)
 * @param {string} content - Response content
 * @returns {number} Confidence score (0.0-1.0)
 * @pure
 * @private
 */
function calculateConfidenceScore(content) {
  if (content.length < CONTENT_LENGTH.MIN_VALID) {
    return CONFIDENCE_SCORES.LOW;
  } else if (content.includes("I don't know") || content.includes('unclear')) {
    return CONFIDENCE_SCORES.UNCERTAIN;
  } else if (content.length > CONTENT_LENGTH.DETAILED_THRESHOLD) {
    return CONFIDENCE_SCORES.HIGH;
  } else if (content.length >= CONTENT_LENGTH.SHORT_THRESHOLD) {
    return CONFIDENCE_SCORES.MEDIUM;
  } else {
    return CONFIDENCE_SCORES.SHORT_VALID;
  }
}

/**
 * Parses raw AI response into structured data.
 * Extracts content, metadata, and handles various response formats.
 *
 * @param {string|Object} rawResponse - Raw response from AI
 * @returns {Object} Structured response with content, metadata, confidence
 *
 * @pure
 *
 * @example
 * const parsed = parseAiResponse({ content: 'Hello', model: 'gpt-4' });
 * // => { content: 'Hello', metadata: { model: 'gpt-4' }, confidence: 0.8 }
 */
export function parseAiResponse(rawResponse) {
  if (!rawResponse) {
    return {
      content: '',
      metadata: {},
      confidence: 0,
      success: false,
      error: 'Empty response',
    };
  }

  // Handle string responses
  if (typeof rawResponse === 'string') {
    const content = rawResponse.trim();
    return {
      content,
      metadata: {},
      confidence: calculateConfidenceScore(content),
      success: true,
    };
  }

  // Handle object responses (SDK format)
  const content = rawResponse.content || rawResponse.text || rawResponse.message || '';
  const metadata = {
    model: rawResponse.model || 'unknown',
    tokens: rawResponse.tokens || rawResponse.usage?.total_tokens || 0,
    finishReason: rawResponse.finish_reason || rawResponse.finishReason || 'complete',
    ...(rawResponse.metadata || {}),
  };

  return {
    content: content.trim(),
    metadata,
    confidence: calculateConfidenceScore(content),
    success: true,
  };
}

/**
 * Parses error response into structured error information.
 *
 * @param {Error|string|Object} error - Error from AI request
 * @returns {Object} Structured error with type, message, details
 *
 * @pure
 *
 * @example
 * const parsed = parseErrorResponse(new Error('Network timeout'));
 * // => { type: 'network', message: 'Network timeout', retryable: true }
 */
export function parseErrorResponse(error) {
  if (!error) {
    return {
      type: 'unknown',
      message: 'Unknown error',
      retryable: false,
      details: {},
    };
  }

  // Handle Error objects
  if (error instanceof Error) {
    const message = error.message || 'Unknown error';
    const isNetworkError = /network|timeout|ECONNREFUSED|ETIMEDOUT/i.test(message);
    const isAuthError = /auth|unauthorized|forbidden|401|403/i.test(message);
    const isRateLimitError = /rate limit|429|too many requests/i.test(message);

    return {
      type: isAuthError
        ? 'authentication'
        : isRateLimitError
          ? 'rate_limit'
          : isNetworkError
            ? 'network'
            : 'unknown',
      message,
      retryable: isNetworkError || isRateLimitError,
      details: {
        name: error.name,
        stack: error.stack,
      },
    };
  }

  // Handle string errors
  if (typeof error === 'string') {
    return {
      type: 'unknown',
      message: error,
      retryable: false,
      details: {},
    };
  }

  // Handle object errors (SDK format)
  return {
    type: error.type || error.code || 'unknown',
    message: error.message || error.error || 'Unknown error',
    retryable: error.retryable !== false,
    details: error.details || {},
  };
}

/**
 * Formats multiple requests into batch format.
 * Groups requests and adds metadata for batch processing.
 *
 * @param {Array<Object>} requests - Array of request objects
 * @returns {Object} Formatted batch request
 *
 * @pure
 *
 * @example
 * const batch = formatBatchRequests([
 *   { prompt: 'Test 1', id: 'a' },
 *   { prompt: 'Test 2', id: 'b' }
 * ]);
 * // => { requests: [...], count: 2, metadata: {...} }
 */
export function formatBatchRequests(requests) {
  if (!Array.isArray(requests) || requests.length === 0) {
    return {
      requests: [],
      count: 0,
      metadata: {
        formatted: new Date().toISOString(),
        valid: false,
      },
    };
  }

  // Validate and normalize requests
  const validRequests = requests
    .filter((req) => req && (req.prompt || req.message))
    .map((req, index) => ({
      id: req.id || `batch_${index}`,
      prompt: req.prompt || req.message,
      options: req.options || {},
      metadata: req.metadata || {},
    }));

  return {
    requests: validRequests,
    count: validRequests.length,
    metadata: {
      formatted: new Date().toISOString(),
      valid: validRequests.length > 0,
      originalCount: requests.length,
      filteredCount: requests.length - validRequests.length,
    },
  };
}

/**
 * Calculates retry delay with exponential backoff.
 *
 * @param {number} attempt - Current attempt number (0-based)
 * @param {number} baseDelay - Base delay in milliseconds
 * @param {number} maxDelay - Maximum delay in milliseconds
 * @returns {number} Delay in milliseconds
 *
 * @pure
 *
 * @example
 * calculateRetryDelay(0) // => 1000 (uses default BASE_DELAY_MS)
 * calculateRetryDelay(3) // => 8000
 */
export function calculateRetryDelay(
  attempt,
  baseDelay = DEFAULT_REQUEST.BASE_DELAY_MS,
  maxDelay = DEFAULT_REQUEST.MAX_DELAY_MS
) {
  const delay = baseDelay * Math.pow(2, attempt);
  return Math.min(delay, maxDelay);
}

/**
 * Determines if error is retryable based on error information.
 *
 * @param {Object} errorInfo - Parsed error information
 * @param {number} attemptCount - Number of attempts made
 * @param {number} maxAttempts - Maximum attempts allowed
 * @returns {boolean} True if should retry
 *
 * @pure
 */
export function shouldRetry(errorInfo, attemptCount, maxAttempts = 3) {
  if (attemptCount >= maxAttempts) {
    return false;
  }

  return errorInfo.retryable === true;
}

/**
 * Merges request options with defaults.
 *
 * @param {Object} options - User-provided options
 * @param {Object} defaults - Default options
 * @returns {Object} Merged options
 *
 * @pure
 */
export function mergeRequestOptions(options = {}, defaults = {}) {
  return {
    model: options.model || defaults.model || DEFAULT_REQUEST.MODEL,
    temperature:
      options.temperature !== undefined
        ? options.temperature
        : defaults.temperature || DEFAULT_REQUEST.TEMPERATURE,
    maxTokens: options.maxTokens || defaults.maxTokens || DEFAULT_REQUEST.MAX_TOKENS,
    stream:
      options.stream !== undefined ? options.stream : defaults.stream || DEFAULT_REQUEST.STREAM,
    persona: options.persona || defaults.persona,
    cache:
      options.cache !== undefined
        ? options.cache
        : defaults.cache !== undefined
          ? defaults.cache
          : true,
    ...options,
  };
}

// ==============================================================================
// IMPURE WRAPPER CLASS - SDK Integration
// ==============================================================================

/**
 * AI Helper for GitHub Copilot SDK integration.
 * Handles SDK availability, authentication, request execution, and error handling.
 *
 * @class
 *
 * @example
 * const helper = new AiHelper({ model: 'gpt-4', cache: true });
 * await helper.initialize();
 *
 * if (helper.isAvailable()) {
 *   const response = await helper.executeRequest('Write a function');
 * }
 */
export class AiHelper {
  /**
   * Creates AI Helper instance.
   *
   * @param {Object} [config={}] - Configuration options
   * @param {string} [config.model='gpt-4'] - Default model to use
   * @param {number} [config.maxRetries=3] - Maximum retry attempts
   * @param {boolean} [config.cache=true] - Enable response caching
   * @param {number} [config.timeout=30000] - Request timeout in ms
   */
  constructor(config = {}) {
    this.config = {
      model: config.model || DEFAULT_REQUEST.MODEL,
      maxRetries: config.maxRetries || DEFAULT_REQUEST.MAX_RETRIES,
      cache: config.cache !== undefined ? config.cache : true,
      timeout: config.timeout || DEFAULT_REQUEST.TIMEOUT_MS,
      baseDelay: config.baseDelay || DEFAULT_REQUEST.BASE_DELAY_MS,
      maxDelay: config.maxDelay || DEFAULT_REQUEST.MAX_DELAY_MS,
    };

    this.client = null;
    this.session = null;
    this.initialized = false;
    this.available = false;
    this.authenticated = false;
  }

  /**
   * Checks if GitHub Copilot SDK is available.
   * Tests if the package can be imported and instantiated.
   *
   * @returns {boolean} True if SDK is available
   */
  isSdkAvailable() {
    try {
      // Check if CopilotClient is available
      if (!CopilotClient || typeof CopilotClient !== 'function') {
        return false;
      }

      // Try to instantiate (doesn't connect yet)
      const testClient = new CopilotClient();
      return testClient !== null;
    } catch (error) {
      logger.debug(`SDK availability check failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Initializes SDK connection and tests authentication.
   * Must be called before making requests.
   *
   * @returns {Promise<boolean>} True if initialization successful
   */
  async initialize() {
    if (this.initialized) {
      return this.available;
    }

    try {
      // Check SDK availability
      if (!this.isSdkAvailable()) {
        logger.warn('GitHub Copilot SDK not available');
        this.available = false;
        this.initialized = true;
        return false;
      }

      // Create client
      this.client = new CopilotClient();

      // Try to connect via stdio (standard SDK initialization)
      await this.client.connectViaStdio();

      // Test authentication by getting status
      const status = await this.client.getAuthStatus();
      this.authenticated = status?.authenticated || false;

      if (!this.authenticated) {
        logger.warn('GitHub Copilot not authenticated');
        this.available = false;
      } else {
        logger.success('GitHub Copilot SDK initialized successfully');
        this.available = true;

        // Create session
        this.session = await this.client.createSession({
          model: this.config.model,
        });
      }

      this.initialized = true;
      return this.available;
    } catch (error) {
      logger.error(`SDK initialization failed: ${error.message}`);
      this.available = false;
      this.authenticated = false;
      this.initialized = true;
      return false;
    }
  }

  /**
   * Validates SDK and provides detailed feedback.
   *
   * @returns {Object} Validation result with status and messages
   */
  async validateSdk() {
    const result = {
      available: false,
      authenticated: false,
      message: '',
      suggestions: [],
    };

    // Check availability
    if (!this.isSdkAvailable()) {
      result.message = 'GitHub Copilot SDK not found';
      result.suggestions = [
        'Install with: npm install @github/copilot-sdk',
        'Verify package.json includes @github/copilot-sdk',
        'Run: npm install to install dependencies',
      ];
      return result;
    }

    result.available = true;

    // Check authentication
    try {
      await this.initialize();

      if (!this.authenticated) {
        result.message = 'GitHub Copilot not authenticated';
        result.suggestions = [
          'Authenticate with: gh auth login',
          'Set COPILOT_GITHUB_TOKEN environment variable',
          'Verify GitHub Copilot subscription is active',
          'Run: gh auth refresh to refresh authentication',
        ];
        return result;
      }

      result.authenticated = true;
      result.message = 'GitHub Copilot SDK ready';
      return result;
    } catch (error) {
      result.message = `SDK validation error: ${error.message}`;
      result.suggestions = [
        'Check network connectivity',
        'Verify GitHub Copilot service status',
        'Try re-authenticating: gh auth login',
      ];
      return result;
    }
  }

  /**
   * Determines if AI features should be enabled.
   * Checks SDK availability, authentication, and configuration.
   *
   * @returns {Promise<boolean>} True if AI should be enabled
   */
  async shouldEnableAi() {
    // Initialize if not already done
    if (!this.initialized) {
      await this.initialize();
    }

    return this.available && this.authenticated;
  }

  /**
   * Checks if AI helper is available and ready.
   *
   * @returns {boolean} True if available
   */
  isAvailable() {
    return this.available && this.authenticated;
  }

  /**
   * Executes single AI request with retries and error handling.
   *
   * @param {string} prompt - The prompt to send
   * @param {Object} [options={}] - Request options
   * @param {string} [options.model] - Model to use
   * @param {number} [options.temperature] - Temperature (0-1)
   * @param {number} [options.maxTokens] - Max tokens
   * @param {boolean} [options.validate=true] - Validate response
   * @returns {Promise<Object>} Response object
   *
   * @throws {ValidationError} If validation fails
   * @throws {SystemError} If SDK errors occur
   */
  async executeRequest(prompt, options = {}) {
    if (!this.isAvailable()) {
      throw new SystemError('AI helper not available. Initialize first.');
    }

    if (!prompt || typeof prompt !== 'string') {
      throw new ValidationError('Prompt must be a non-empty string');
    }

    // Merge options with defaults
    const requestOptions = mergeRequestOptions(options, this.config);

    let lastError = null;
    let attempt = 0;

    while (attempt < this.config.maxRetries) {
      try {
        logger.debug(`Executing AI request (attempt ${attempt + 1}/${this.config.maxRetries})`);

        // Execute request via SDK
        const rawResponse = await this._sendRequest(prompt, requestOptions);

        // Parse response
        const parsed = parseAiResponse(rawResponse);

        // Validate if requested
        if (requestOptions.validate !== false) {
          const validation = validateAIResponse(parsed.content, {
            minLength: requestOptions.minLength || 10,
            requireSections: requestOptions.requireSections,
            schema: requestOptions.schema,
          });

          if (!validation.isValid) {
            logger.warn(`Response validation failed: ${validation.errors.join(', ')}`);
            parsed.validation = validation;
          }
        }

        logger.success('AI request completed successfully');
        return parsed;
      } catch (error) {
        lastError = error;
        const errorInfo = parseErrorResponse(error);

        logger.warn(`AI request failed: ${errorInfo.message}`);

        // Check if we should retry
        if (shouldRetry(errorInfo, attempt, this.config.maxRetries)) {
          const delay = calculateRetryDelay(attempt, this.config.baseDelay, this.config.maxDelay);
          logger.info(`Retrying in ${delay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
          attempt++;
        } else {
          break;
        }
      }
    }

    // All retries exhausted
    const errorInfo = parseErrorResponse(lastError);
    throw new SystemError(`AI request failed after ${attempt + 1} attempts: ${errorInfo.message}`, {
      error: errorInfo,
      attempts: attempt + 1,
    });
  }

  /**
   * Executes multiple AI requests in batch.
   *
   * @param {Array<Object>} requests - Array of request objects
   * @param {Object} [options={}] - Batch options
   * @param {boolean} [options.parallel=false] - Execute in parallel
   * @param {number} [options.concurrency=3] - Max parallel requests
   * @returns {Promise<Array<Object>>} Array of responses
   */
  async executeBatch(requests, options = {}) {
    if (!this.isAvailable()) {
      throw new SystemError('AI helper not available. Initialize first.');
    }

    // Format batch requests
    const batch = formatBatchRequests(requests);

    if (batch.count === 0) {
      logger.warn('No valid requests in batch');
      return [];
    }

    logger.info(`Executing batch of ${batch.count} requests`);

    const results = [];

    if (options.parallel) {
      // Parallel execution with concurrency limit
      const concurrency = options.concurrency || 3;
      for (let i = 0; i < batch.requests.length; i += concurrency) {
        const chunk = batch.requests.slice(i, i + concurrency);
        const chunkResults = await Promise.allSettled(
          chunk.map((req) => this.executeRequest(req.prompt, req.options))
        );

        results.push(
          ...chunkResults.map((result, idx) => ({
            id: chunk[idx].id,
            success: result.status === 'fulfilled',
            response: result.status === 'fulfilled' ? result.value : null,
            error: result.status === 'rejected' ? result.reason : null,
          }))
        );
      }
    } else {
      // Sequential execution
      for (const req of batch.requests) {
        try {
          const response = await this.executeRequest(req.prompt, req.options);
          results.push({
            id: req.id,
            success: true,
            response,
          });
        } catch (error) {
          logger.error(`Batch request ${req.id} failed: ${error.message}`);
          results.push({
            id: req.id,
            success: false,
            error: parseErrorResponse(error),
          });
        }
      }
    }

    const successCount = results.filter((r) => r.success).length;
    logger.info(`Batch completed: ${successCount}/${batch.count} successful`);

    return results;
  }

  /**
   * Internal method to send request via SDK.
   *
   * @private
   * @param {string} prompt - The prompt
   * @param {Object} options - Request options
   * @returns {Promise<Object>} Raw SDK response
   */
  async _sendRequest(prompt, options) {
    if (!this.session) {
      throw new SystemError('No active session. Call initialize() first.');
    }

    // Use SDK to send message to session
    const response = await this.session.sendMessage({
      content: prompt,
      model: options.model,
      temperature: options.temperature,
      max_tokens: options.maxTokens,
    });

    return response;
  }

  /**
   * Closes SDK connection and cleans up resources.
   *
   * @returns {Promise<void>}
   */
  async cleanup() {
    try {
      if (this.session) {
        await this.client.deleteSession(this.session.id);
        this.session = null;
      }

      if (this.client) {
        await this.client.stop();
        this.client = null;
      }

      this.initialized = false;
      this.available = false;
      this.authenticated = false;

      logger.info('AI helper cleanup complete');
    } catch (error) {
      logger.warn(`Cleanup warning: ${error.message}`);
    }
  }
}
