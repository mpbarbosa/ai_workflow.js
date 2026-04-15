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

import fs from 'fs/promises';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { defineTool } from '@github/copilot-sdk';
export { defineTool };
import { CopilotSdkWrapper } from './copilot_sdk_wrapper.js';
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

// Prompt-log issue signal extraction heuristics
const ISSUE_SNAPSHOT = {
  MAX_LINES: 24,
  EMPTY_MESSAGE: 'No concrete issue signals auto-detected from response text.',
};
const ISSUE_SECTION_RE =
  /^(?:#{1,6}\s*)?(issues?|findings?|problems?|bugs?|fixes?|recommendations?|suggestions?|summary table)\b/i;
const ISSUE_BULLET_RE = /^([-*+]|\d+\.)\s+/;
const ISSUE_FINDING_HEADING_RE = /^#{2,6}\s+/;
const ISSUE_KEYWORD_RE =
  /\b(issue|bug|error|fail(?:ure|ing)?|broken|missing|incorrect|wrong|mismatch|outdated|stale|invalid|inconsistent|incomplete|unsupported|fix|update|remove|rename|add)\b/i;
const ISSUE_ACTION_RE = /\b(should|must|needs to|need to|recommend(?:ed|ation)?|consider)\b/i;
const ISSUE_METADATA_RE =
  /^([-*+]|\d+\.)\s+\*\*(?:file|files|issue type|severity|impact|optimization example|recommended fix|root cause|status|finding):?\*\*:?/i;
const ISSUE_PERFORMANCE_RE =
  /\b(performance|startup|bundle|eager|lazy-?load|re-?export|memory|latency|throughput|sync(?:hronous)? i\/o)\b/i;
const FILE_REFERENCE_RE = /\b[\w./-]+\.(?:[cm]?ts|tsx|[cm]?js|jsx|md|json|ya?ml)\b/;
const NO_ISSUES_RE = /\b(no (actionable )?(issues|findings)|nothing to fix|no changes needed)\b/i;
const SUMMARY_TABLE_HEADER_RE =
  /^\|\s*file\s*\|\s*issue type\s*\|\s*severity\s*\|\s*impact\s*\|?$/i;
const SUMMARY_TABLE_ROW_RE = /^\|.+\|.+\|.+\|.+\|?$/;
const SUMMARY_TABLE_SEPARATOR_RE = /^\|\s*[-:| ]+\|$/;

// Default AI request parameters
const DEFAULT_REQUEST = {
  MODEL: 'gpt-4.1',
  TEMPERATURE: 0.7,
  MAX_TOKENS: 4000,
  TIMEOUT_MS: 120000, // 120 seconds initial timeout, doubled on each timeout retry
  STREAM: false,
  MAX_RETRIES: 3,
  BASE_DELAY_MS: 1000, // 1 second initial retry delay
  MAX_DELAY_MS: 30000, // 30 seconds maximum retry delay
  FALLBACK_MODEL: 'claude-haiku-4.5', // Fallback when primary model exhausts all timeout retries
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
 * Extract concrete, file-specific issue signals from an AI response so prompt
 * logs carry a normalized summary near the top of the file.
 *
 * @param {string} responseContent - Raw AI response text
 * @returns {string[]} Ordered list of extracted issue-signal lines
 *
 * @pure
 */
export function extractActionableIssueSignals(responseContent) {
  const text =
    typeof responseContent === 'string' ? responseContent : String(responseContent ?? '');

  if (text.trim() === '') return [];

  const candidates = [];
  const seen = new Set();
  const addCandidate = (line) => {
    if (!seen.has(line)) {
      seen.add(line);
      candidates.push(line);
    }
  };

  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  let inIssueSection = false;
  let inSummaryTable = false;

  for (const line of lines) {
    const isHeading = /^#{1,6}\s+\S/.test(line);
    const isIssueSectionHeading = ISSUE_SECTION_RE.test(line);
    const isBullet = ISSUE_BULLET_RE.test(line);
    const isFindingHeading = ISSUE_FINDING_HEADING_RE.test(line);
    const mentionsIssue = ISSUE_KEYWORD_RE.test(line);
    const mentionsAction = ISSUE_ACTION_RE.test(line);
    const mentionsMetadata = ISSUE_METADATA_RE.test(line);
    const mentionsPerformance = ISSUE_PERFORMANCE_RE.test(line);
    const mentionsFile = FILE_REFERENCE_RE.test(line);

    if (isIssueSectionHeading) {
      inIssueSection = true;
      inSummaryTable = false;
      continue;
    }

    if (SUMMARY_TABLE_HEADER_RE.test(line)) {
      inIssueSection = true;
      inSummaryTable = true;
      addCandidate(line);
      continue;
    }

    if (inSummaryTable) {
      if (SUMMARY_TABLE_SEPARATOR_RE.test(line)) {
        continue;
      }
      if (SUMMARY_TABLE_ROW_RE.test(line)) {
        addCandidate(line);
        continue;
      }
      inSummaryTable = false;
    }

    if (
      isFindingHeading &&
      inIssueSection &&
      (mentionsIssue || mentionsAction || mentionsPerformance || mentionsFile)
    ) {
      addCandidate(line);
      continue;
    }

    if (isHeading) {
      inIssueSection = false;
      inSummaryTable = false;
      continue;
    }

    if (
      (isBullet &&
        (inIssueSection ||
          mentionsIssue ||
          mentionsAction ||
          mentionsMetadata ||
          mentionsPerformance ||
          mentionsFile)) ||
      (inIssueSection &&
        (mentionsIssue ||
          mentionsAction ||
          mentionsMetadata ||
          mentionsPerformance ||
          mentionsFile))
    ) {
      addCandidate(line);
    }
  }

  if (candidates.length === 0 && NO_ISSUES_RE.test(text)) {
    return [];
  }

  return candidates;
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
    const isCLINotFoundError = /ENOENT/i.test(message);
    const isNetworkError =
      !isCLINotFoundError && /network|timeout|ECONNREFUSED|ETIMEDOUT/i.test(message);
    const isAuthError = /auth|unauthorized|forbidden|401|403/i.test(message);
    const isRateLimitError = /rate limit|429|too many requests/i.test(message);

    return {
      type: isCLINotFoundError
        ? 'cli_not_found'
        : isAuthError
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
 * Returns true when the error message represents a session.idle timeout from
 * the Copilot SDK — i.e. the session never became idle within the allowed
 * window ("Timeout after Xms waiting for session.idle").
 *
 * @param {Object} errorInfo - Result of {@link parseErrorResponse}
 * @returns {boolean}
 *
 * @pure
 */
export function isSessionIdleTimeout(errorInfo) {
  return /timeout/i.test(errorInfo.message) && /session\.idle/i.test(errorInfo.message);
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
// PURE FUNCTION - Production Consistency Validation
// ==============================================================================

// Valid model identifiers accepted by the Copilot SDK
const VALID_MODELS = [
  // Legacy / broadly-tested models (kept for backward compatibility)
  'gpt-4.1',
  'gpt-4o',
  'gpt-4-turbo',
  'gpt-4',
  'gpt-3.5-turbo',
  'claude-3-5-sonnet',
  // Current production models (as of March 2026)
  'claude-sonnet-4.6',
  'claude-sonnet-4.5',
  'claude-haiku-4.5',
  'claude-opus-4.6',
  'claude-opus-4.6-fast',
  'claude-opus-4.5',
  'claude-sonnet-4',
  'gemini-3-pro-preview',
  'gpt-5.4',
  'gpt-5.3-codex',
  'gpt-5.2-codex',
  'gpt-5.2',
  'gpt-5.1-codex-max',
  'gpt-5.1-codex',
  'gpt-5.1',
  'gpt-5.1-codex-mini',
  'gpt-5-mini',
];

// Timeout bounds considered safe for production (ms)
const TIMEOUT_BOUNDS = { MIN: 1_000, MAX: 300_000 };

/**
 * Validates that an AiHelper config + runtime state is consistent for production.
 *
 * Checks three groups of invariants:
 *  - **config**: All configuration values are within acceptable production ranges.
 *  - **state**:  Runtime flags are coherent (e.g. authenticated ⇒ available,
 *                available ⇒ client and session are non-null).
 *  - **combined**: Cross-cutting rules that span both groups.
 *
 * This function is **pure** — it reads the supplied arguments and returns a
 * plain result object; it never mutates state or triggers I/O.
 *
 * @param {Object} config - The helper's `this.config` object
 * @param {Object} state  - Runtime state snapshot
 * @param {boolean} state.initialized      - Whether initialize() has been called
 * @param {boolean} state.available        - Whether the SDK is usable
 * @param {boolean} state.authenticated    - Whether Copilot auth succeeded
 * @param {*}       state.client           - CopilotClient instance (or null)
 * @param {*}       state.session          - Active SDK session (or null)
 * @param {number}  state._promptCounter   - Number of prompts issued so far
 * @returns {{ consistent: boolean, issues: string[], config: Object, state: Object }}
 *
 * @pure
 */
export function validateAiHelperState(config, state) {
  const configIssues = [];
  const stateIssues = [];

  // ── Config checks ───────────────────────────────────────────────────────────
  if (!config.model || typeof config.model !== 'string' || config.model.trim() === '') {
    configIssues.push('config.model must be a non-empty string');
  } else if (!VALID_MODELS.includes(config.model)) {
    configIssues.push(
      `config.model "${config.model}" is not a recognised production model (expected one of: ${VALID_MODELS.join(', ')})`
    );
  }

  if (!Number.isInteger(config.maxRetries) || config.maxRetries < 1) {
    configIssues.push('config.maxRetries must be a positive integer (≥ 1)');
  }

  if (typeof config.cache !== 'boolean') {
    configIssues.push('config.cache must be a boolean');
  }

  if (typeof config.timeout !== 'number' || config.timeout < TIMEOUT_BOUNDS.MIN) {
    configIssues.push(
      `config.timeout must be a number ≥ ${TIMEOUT_BOUNDS.MIN}ms (got ${config.timeout})`
    );
  } else if (config.timeout > TIMEOUT_BOUNDS.MAX) {
    configIssues.push(
      `config.timeout is unreasonably high (${config.timeout}ms > ${TIMEOUT_BOUNDS.MAX}ms)`
    );
  }

  if (typeof config.baseDelay !== 'number' || config.baseDelay < 0) {
    configIssues.push('config.baseDelay must be a non-negative number');
  }

  if (typeof config.maxDelay !== 'number' || config.maxDelay < 0) {
    configIssues.push('config.maxDelay must be a non-negative number');
  } else if (
    typeof config.baseDelay === 'number' &&
    config.baseDelay >= 0 &&
    config.maxDelay < config.baseDelay
  ) {
    configIssues.push(
      `config.maxDelay (${config.maxDelay}ms) must be ≥ config.baseDelay (${config.baseDelay}ms)`
    );
  }

  if (config.promptsDir !== null && typeof config.promptsDir !== 'string') {
    configIssues.push('config.promptsDir must be null or a non-empty string');
  } else if (typeof config.promptsDir === 'string' && config.promptsDir.trim() === '') {
    configIssues.push('config.promptsDir must not be an empty string (use null to disable)');
  }

  // ── State checks ────────────────────────────────────────────────────────────
  if (typeof state.initialized !== 'boolean') {
    stateIssues.push('state.initialized must be a boolean');
  }

  if (typeof state.available !== 'boolean') {
    stateIssues.push('state.available must be a boolean');
  }

  if (typeof state.authenticated !== 'boolean') {
    stateIssues.push('state.authenticated must be a boolean');
  }

  if (!Number.isInteger(state._promptCounter) || state._promptCounter < 0) {
    stateIssues.push('state._promptCounter must be a non-negative integer');
  }

  // Coherence: authenticated implies available
  if (state.authenticated === true && state.available !== true) {
    stateIssues.push('state is incoherent: authenticated is true but available is false');
  }

  // Coherence: available requires client and session
  if (state.available === true) {
    if (state.client === null || state.client === undefined) {
      stateIssues.push('state is incoherent: available is true but client is null');
    }
    if (state.session === null || state.session === undefined) {
      stateIssues.push('state is incoherent: available is true but session is null');
    }
  }

  // Coherence: not initialized means session must be null
  if (state.initialized === false && state.session !== null && state.session !== undefined) {
    stateIssues.push('state is incoherent: not initialized but session is non-null');
  }

  const allIssues = [...configIssues, ...stateIssues];

  return {
    consistent: allIssues.length === 0,
    issues: allIssues,
    config: { valid: configIssues.length === 0, issues: configIssues },
    state: { valid: stateIssues.length === 0, issues: stateIssues },
  };
}

// ==============================================================================
// WORKFLOW TOOLS - Callable by Copilot during a session
// ==============================================================================

const _execFileAsync = promisify(execFile);

/**
 * Reads the content of a file relative to the working directory (PURE handler).
 * Exported for unit testing the handler logic independently.
 *
 * @param {string} filePath - Relative or absolute path to read
 * @param {string} workingDirectory - Base directory for relative paths
 * @returns {Promise<{path: string, content: string, size: number}>}
 * @pure
 */
export async function readFileHandler(filePath, workingDirectory = process.cwd()) {
  const resolved = path.isAbsolute(filePath) ? filePath : path.join(workingDirectory, filePath);
  const content = await fs.readFile(resolved, 'utf8');
  return { path: resolved, content, size: content.length };
}

/**
 * Lists files in a directory relative to the working directory (PURE handler).
 * Exported for unit testing independently.
 *
 * @param {string} dirPath - Directory to list (default: '.')
 * @param {string} workingDirectory - Base directory for relative paths
 * @returns {Promise<{path: string, entries: string[]}>}
 * @pure
 */
export async function listFilesHandler(dirPath = '.', workingDirectory = process.cwd()) {
  const resolved = path.isAbsolute(dirPath) ? dirPath : path.join(workingDirectory, dirPath);
  const entries = await fs.readdir(resolved, { withFileTypes: true });
  return {
    path: resolved,
    entries: entries.map((e) => (e.isDirectory() ? `${e.name}/` : e.name)),
  };
}

/**
 * Returns the current git status of the working directory (PURE handler).
 * Exported for unit testing independently.
 *
 * @param {string} workingDirectory - Repository root
 * @returns {Promise<{branch: string, status: string, clean: boolean}>}
 * @pure
 */
export async function getGitStatusHandler(workingDirectory = process.cwd()) {
  const { stdout: branch } = await _execFileAsync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
    cwd: workingDirectory,
  });
  const { stdout: status } = await _execFileAsync('git', ['status', '--short'], {
    cwd: workingDirectory,
  });
  return {
    branch: branch.trim(),
    status: status.trim(),
    clean: status.trim() === '',
  };
}

/**
 * Builds the standard set of workflow tools for a given working directory.
 * Returns an array ready to pass to `createSession({ tools })`.
 *
 * @param {string} workingDirectory - Absolute path to the project root
 * @returns {Object[]} Array of tool definitions
 */
export function buildWorkflowTools(workingDirectory) {
  return [
    defineTool('read_file', {
      description: 'Read the content of a file in the project',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'File path relative to the project root' },
        },
        required: ['path'],
      },
      handler: ({ path: filePath }) => readFileHandler(filePath, workingDirectory),
    }),
    defineTool('list_files', {
      description: 'List files and directories in a project directory',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Directory path relative to the project root (default: ".")',
          },
        },
      },
      handler: ({ path: dirPath = '.' }) => listFilesHandler(dirPath, workingDirectory),
    }),
    defineTool('get_git_status', {
      description: 'Get the current git branch and working-tree status of the project',
      parameters: { type: 'object', properties: {} },
      handler: () => getGitStatusHandler(workingDirectory),
    }),
  ];
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
   * @param {string} [config.model='gpt-4.1'] - Default model to use
   * @param {number} [config.maxRetries=3] - Maximum retry attempts
   * @param {boolean} [config.cache=true] - Enable response caching
   * @param {number} [config.timeout=120000] - Request timeout in ms
   * @param {string} [config.fallbackModel='claude-haiku-4.5'] - Model to try when the primary
   *   model exhausts all retries due to timeouts. Set to null to disable fallback.
   * @param {Object[]} [config.tools] - SDK tools for Copilot to call; defaults to buildWorkflowTools()
   * @param {string|null} [config.workflowVersion=null] - Version of the ai_workflow.js tool itself
   * @param {string|null} [config.workflowCoreVersion=null] - Version of the .workflow_core submodule
   */
  constructor(config = {}) {
    this.config = {
      model: config.model || DEFAULT_REQUEST.MODEL,
      maxRetries: config.maxRetries || DEFAULT_REQUEST.MAX_RETRIES,
      cache: config.cache !== undefined ? config.cache : true,
      timeout: config.timeout || DEFAULT_REQUEST.TIMEOUT_MS,
      baseDelay: config.baseDelay || DEFAULT_REQUEST.BASE_DELAY_MS,
      maxDelay: config.maxDelay || DEFAULT_REQUEST.MAX_DELAY_MS,
      promptsDir: config.promptsDir || null,
      workingDirectory: config.workingDirectory || null,
      projectVersion: config.projectVersion || null,
      workflowVersion: config.workflowVersion || null,
      workflowCoreVersion: config.workflowCoreVersion || null,
      // Fallback model to try when the primary model exhausts all retries due to timeouts.
      // Set to null/false to disable. Must differ from the primary model to take effect.
      fallbackModel:
        config.fallbackModel !== undefined ? config.fallbackModel : DEFAULT_REQUEST.FALLBACK_MODEL,
      // When set, every executeRequest call automatically streams via this callback.
      // The callback receives (delta: string, meta: {persona, model}) per token chunk.
      streamingCallback: config.streamingCallback ?? null,
    };

    this.logger = config.logger || logger;
    // Store resolved tools so they can be reused by a fallback wrapper without
    // re-evaluating the workingDirectory default a second time.
    this._tools = config.tools ?? buildWorkflowTools(this.config.workingDirectory ?? process.cwd());
    this._wrapper = new CopilotSdkWrapper({
      model: this.config.model,
      timeout: this.config.timeout,
      workingDirectory: this.config.workingDirectory,
      streaming: !!this.config.streamingCallback,
      tools: this._tools,
    });
    this.initialized = false;
    this.available = false;
    this.authenticated = false;
    this.availableModels = [];
    this._promptCounter = 0;
  }

  /**
   * Checks if GitHub Copilot SDK is available.
   * Tests if the package can be imported and instantiated.
   *
   * @returns {boolean} True if SDK is available
   */
  isSdkAvailable() {
    return CopilotSdkWrapper.isAvailable();
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

      const { authenticated, availableModels } = await this._wrapper.initialize();
      this.authenticated = authenticated;
      this.availableModels = availableModels;

      if (!this.authenticated) {
        logger.warn('GitHub Copilot not authenticated');
        this.available = false;
      } else {
        logger.success('GitHub Copilot SDK initialized successfully');
        this.available = true;

        // Log available models and warn if configured model is missing
        const modelIds = availableModels.map((m) => m.id);
        logger.info(`Available Copilot models (${modelIds.length}): ${modelIds.join(', ')}`);
        if (modelIds.length > 0 && !modelIds.includes(this.config.model)) {
          logger.warn(
            `Configured model "${this.config.model}" not in available models — using it anyway`
          );
        }
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
   * Returns the list of available Copilot models fetched during initialization.
   * Returns an empty array if not yet initialized or if the fetch failed.
   *
   * @returns {Array<Object>} Array of ModelInfo objects from the SDK
   */
  getAvailableModels() {
    return this.availableModels;
  }

  /**
   * Checks whether this AiHelper instance is internally consistent and
   * suitable for use in a production environment.
   *
   * Delegates all logic to the pure {@link validateAiHelperState} function,
   * passing the current config and runtime state as plain data.  The result
   * is safe to log or surface to health-check endpoints.
   *
   * @returns {{ consistent: boolean, issues: string[], config: Object, state: Object }}
   *   `consistent` is `true` only when **all** config values are within
   *   production-acceptable ranges AND the runtime state is coherent.
   *
   * @example
   * const helper = new AiHelper({ model: 'gpt-4', cache: true });
   * const check = helper.checkConsistency();
   * if (!check.consistent) {
   *   console.error('AiHelper issues:', check.issues);
   * }
   */
  checkConsistency() {
    return validateAiHelperState(this.config, {
      initialized: this.initialized,
      available: this.available,
      authenticated: this.authenticated,
      client: this._wrapper.client,
      session: this._wrapper.session,
      _promptCounter: this._promptCounter,
    });
  }

  /**
   *
   * @param {string} prompt - The prompt to send
   * @param {Object} [options={}] - Request options
   * @param {string} [options.model] - Model to use
   * @param {number} [options.temperature] - Temperature (0-1)
   * @param {number} [options.maxTokens] - Max tokens
   * @param {boolean} [options.stream=false] - Enable streaming mode
   * @param {boolean} [options.validate=true] - Validate response
   * @param {Function} [onChunk] - Called with each delta string when streaming
   * @returns {Promise<Object>} Response object
   *
   * @throws {ValidationError} If validation fails
   * @throws {SystemError} If SDK errors occur
   */
  async executeRequest(prompt, options = {}, onChunk = null) {
    if (!this.isAvailable()) {
      throw new SystemError('AI helper not available. Initialize first.');
    }

    if (!prompt || typeof prompt !== 'string') {
      throw new ValidationError('Prompt must be a non-empty string');
    }

    // Merge options with defaults
    const requestOptions = mergeRequestOptions(options, this.config);
    this.logger.debug(`Request Options: ${JSON.stringify(requestOptions)}`);
    const persona = requestOptions.persona || this.config.persona || 'default';
    this.logger.debug(`Persona: ${persona}`);
    const model = requestOptions.model || this.config.model || 'default';
    this.logger.debug(`Model: ${model}`);

    logger.info(
      `[AI] SDK call starting — persona: ${persona}, model: ${model}, prompt_chars: ${prompt.length}`
    );

    let lastError = null;
    let attempt = 0;

    while (attempt < this.config.maxRetries) {
      try {
        logger.debug(`Executing AI request (attempt ${attempt + 1}/${this.config.maxRetries})`);
        const callStart = Date.now();

        // Execute request via SDK — stream if onChunk provided and stream option is set,
        // OR if the instance was configured with a persistent streamingCallback.
        // When using the instance-level streamingCallback, enrich each chunk with
        // persona metadata so upstream listeners (e.g. the TUI) can display context.
        // Explicit stream:false in the raw caller options always disables streaming
        // regardless of streamingCallback.  We check `options` (before mergeRequestOptions
        // applies the default false) so that callers who omit `stream` entirely still
        // benefit from instance-level streamingCallback.
        const streamingExplicitlyDisabled = options.stream === false;
        let effectiveOnChunk = streamingExplicitlyDisabled ? null : onChunk;
        if (!streamingExplicitlyDisabled && !effectiveOnChunk && this.config.streamingCallback) {
          effectiveOnChunk = (delta) => this.config.streamingCallback(delta, { persona });
        }
        const useStreaming =
          !streamingExplicitlyDisabled &&
          (requestOptions.stream === true || !!this.config.streamingCallback) &&
          typeof effectiveOnChunk === 'function';
        // sendStream is not available in the current SDK version — always use send().
        // When streaming was requested, deliver the full response as a single chunk.
        const rawResponse = await this._wrapper.send(
          prompt,
          requestOptions.timeout || this.config.timeout
        );
        if (useStreaming && typeof effectiveOnChunk === 'function') {
          const content =
            typeof rawResponse === 'string'
              ? rawResponse
              : (rawResponse?.content ?? rawResponse?.text ?? JSON.stringify(rawResponse));
          effectiveOnChunk(content);
        }

        // Parse response
        const parsed = parseAiResponse(rawResponse);
        const callMs = Date.now() - callStart;
        logger.info(
          `[AI] SDK call completed — persona: ${persona}, model: ${model}, response_chars: ${(parsed.content || '').length}, latency: ${callMs}ms`
        );

        // Validate if requested
        if (requestOptions.validate !== false) {
          const validation = validateAIResponse(parsed.content, {
            minLength: requestOptions.minLength || 10,
            requireSections: requestOptions.requireSections,
            schema: requestOptions.schema,
          });

          if (!validation.valid) {
            logger.warn(`Response validation failed: ${validation.errors.join(', ')}`);
            parsed.validation = validation;
          }
        }

        logger.success('AI request completed successfully');
        await this._logPrompt(prompt, options, parsed);
        return parsed;
      } catch (error) {
        lastError = error;
        const errorInfo = parseErrorResponse(error);

        logger.warn(
          `[AI] SDK call failed — persona: ${persona}, model: ${model}, error: ${errorInfo.message}`
        );

        // Check if we should retry
        if (shouldRetry(errorInfo, attempt, this.config.maxRetries)) {
          const delay = calculateRetryDelay(attempt, this.config.baseDelay, this.config.maxDelay);
          logger.info(
            `[AI] Retrying in ${delay}ms (attempt ${attempt + 2}/${this.config.maxRetries})...`
          );
          await new Promise((resolve) => setTimeout(resolve, delay).unref());
          // Recreate the session before retrying — a timed-out session is left
          // in a non-idle state and will immediately time out again if reused.
          await this._wrapper.recreateSession();
          // If the failure was a timeout, double the allowed wait time for the
          // next attempt (capped at TIMEOUT_BOUNDS.MAX = 300 s).
          if (/timeout/i.test(errorInfo.message)) {
            const currentTimeout = requestOptions.timeout || this.config.timeout;
            requestOptions.timeout = Math.min(currentTimeout * 2, TIMEOUT_BOUNDS.MAX);
            logger.info(
              `[AI] Timeout detected — increasing timeout to ${requestOptions.timeout}ms for retry`
            );
          }
          attempt++;
        } else {
          break;
        }
      }
    }

    // All primary retries exhausted
    const primaryErrorInfo = parseErrorResponse(lastError);

    // ── Fallback model attempt ─────────────────────────────────────────────────
    // When all retries fail due to timeouts (e.g. "waiting for session.idle"),
    // try once with the fallback model before giving up entirely.
    const fallbackModel = this.config.fallbackModel;
    const primaryModel = requestOptions.model || this.config.model;
    if (
      /timeout/i.test(primaryErrorInfo.message) &&
      fallbackModel &&
      fallbackModel !== primaryModel
    ) {
      logger.warn(
        `[AI] Primary model "${primaryModel}" timed out after ${attempt} attempt(s) — trying fallback: ${fallbackModel}`
      );
      const fallbackWrapper = new CopilotSdkWrapper({
        model: fallbackModel,
        timeout: DEFAULT_REQUEST.TIMEOUT_MS,
        workingDirectory: this.config.workingDirectory,
        streaming: false,
        tools: this._tools,
      });
      try {
        await fallbackWrapper.initialize();
        const fallbackStart = Date.now();
        const rawFallback = await fallbackWrapper.send(prompt, DEFAULT_REQUEST.TIMEOUT_MS);
        const parsedFallback = parseAiResponse(rawFallback);
        const fallbackMs = Date.now() - fallbackStart;
        logger.info(
          `[AI] Fallback "${fallbackModel}" succeeded — persona: ${persona}, response_chars: ${(parsedFallback.content || '').length}, latency: ${fallbackMs}ms`
        );
        if (requestOptions.validate !== false) {
          const validation = validateAIResponse(parsedFallback.content, {
            minLength: requestOptions.minLength || 10,
            requireSections: requestOptions.requireSections,
            schema: requestOptions.schema,
          });
          if (!validation.valid) {
            logger.warn(`Fallback response validation failed: ${validation.errors.join(', ')}`);
            parsedFallback.validation = validation;
          }
        }
        await this._logPrompt(prompt, options, parsedFallback);
        return parsedFallback;
      } catch (fallbackError) {
        logger.warn(
          `[AI] Fallback model "${fallbackModel}" also failed: ${parseErrorResponse(fallbackError).message}`
        );
      }
    }

    throw new SystemError(
      `AI request failed after ${attempt + 1} attempts: ${primaryErrorInfo.message}`,
      {
        error: primaryErrorInfo,
        attempts: attempt + 1,
      }
    );
  }

  /**
   * Save prompt and response to the prompts log directory.
   * @param {string} prompt - The prompt sent
   * @param {Object} options - Request options (includes persona if set)
   * @param {Object} response - Parsed AI response
   * @returns {Promise<void>}
   */
  async _logPrompt(prompt, options, response) {
    if (!this.config.promptsDir) return;
    try {
      await fs.mkdir(this.config.promptsDir, { recursive: true });
      this._promptCounter += 1;
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      const persona = options.persona || 'default';
      const filename = `${ts}_${String(this._promptCounter).padStart(4, '0')}_${persona}.md`;
      const filePath = path.join(this.config.promptsDir, filename);
      const responseContent = response.content || JSON.stringify(response);
      const issueSignals = extractActionableIssueSignals(responseContent);
      const snapshotLines = issueSignals.slice(0, ISSUE_SNAPSHOT.MAX_LINES);
      const omittedSignals = issueSignals.length - snapshotLines.length;
      const content = [
        `# Prompt Log`,
        ``,
        `**Timestamp:** ${new Date().toISOString()}`,
        `**Persona:** ${persona}`,
        `**Model:** ${options.model || this.config.model}`,
        ...(this.config.projectVersion
          ? [`**Project Version:** ${this.config.projectVersion}`]
          : []),
        ...(this.config.workflowVersion
          ? [`**Workflow Version:** ${this.config.workflowVersion}`]
          : []),
        ...(this.config.workflowCoreVersion
          ? [`**Workflow Core Version:** ${this.config.workflowCoreVersion}`]
          : []),
        ``,
        `## Auto-Extracted Issue Signals`,
        ``,
        `**Detected Signals:** ${issueSignals.length}`,
        ``,
        `\`\`\`text`,
        ...(snapshotLines.length > 0 ? snapshotLines : [ISSUE_SNAPSHOT.EMPTY_MESSAGE]),
        ...(omittedSignals > 0 ? [`... (+${omittedSignals} more signals omitted)`] : []),
        `\`\`\``,
        ``,
        `## Prompt`,
        ``,
        `\`\`\``,
        prompt,
        `\`\`\``,
        ``,
        `## Response`,
        ``,
        `\`\`\``,
        responseContent,
        `\`\`\``,
      ].join('\n');
      await fs.writeFile(filePath, content, 'utf8');
      logger.debug(`Prompt logged to: ${filename}`);
    } catch (err) {
      logger.debug(`Prompt logging failed (non-fatal): ${err.message}`);
    }
  }

  /**
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
   * Closes SDK connection and cleans up resources.
   * Delegates to CopilotSdkWrapper which applies cookbook patterns:
   *  - try-finally ensures client.stop() is always called
   *  - forceStop fallback if client.stop() hangs
   *
   * @returns {Promise<void>}
   */
  async cleanup() {
    await this._wrapper.cleanup();
    this.initialized = false;
    this.available = false;
    this.authenticated = false;
    logger.info('AI helper cleanup complete');
  }
}
