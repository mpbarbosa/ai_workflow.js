/**
 * AI Validation Module
 *
 * Provides validation functions for AI responses, confidence scoring,
 * schema validation, and fallback strategies.
 *
 * Architecture: Pure functions only (v2.0.0)
 * - All functions are deterministic
 * - No side effects or I/O operations
 * - Time/random dependencies passed as parameters
 *
 * @module lib/ai_validation
 * @version 2.0.0
 */

// ==============================================================================
// RESPONSE VALIDATION
// ==============================================================================

/**
 * Validate AI response completeness
 *
 * Checks if response meets basic quality criteria:
 * - Non-empty content
 * - Minimum length
 * - Expected sections present
 * - No error markers
 *
 * @param {string} response - AI response text
 * @param {Object} options - Validation options
 * @param {number} [options.minLength=10] - Minimum response length
 * @param {string[]} [options.expectedSections=[]] - Required section headers
 * @param {string[]} [options.errorMarkers=[]] - Markers indicating errors
 * @returns {Object} Validation result with { valid, errors, warnings }
 *
 * @example
 * const result = validateResponse('# Title\n\nContent here', {
 *   minLength: 20,
 *   expectedSections: ['Title', 'Content']
 * });
 * // => { valid: true, errors: [], warnings: [] }
 */
export function validateResponse(response, options = {}) {
  const {
    minLength = 10,
    expectedSections = [],
    errorMarkers = ['error:', 'failed:', 'invalid:'],
  } = options;

  const errors = [];
  const warnings = [];

  // Check if response is empty or null
  if (!response || typeof response !== 'string') {
    errors.push('Response is empty or invalid type');
    return { valid: false, errors, warnings };
  }

  const trimmed = response.trim();

  // Check if trimmed response is empty
  if (trimmed.length === 0) {
    errors.push('Response is empty or invalid type');
    return { valid: false, errors, warnings };
  }

  // Check minimum length
  if (trimmed.length < minLength) {
    errors.push(`Response too short: ${trimmed.length} < ${minLength} characters`);
  }

  // Check for expected sections
  for (const section of expectedSections) {
    if (!trimmed.includes(section)) {
      errors.push(`Missing expected section: "${section}"`);
    }
  }

  // Check for error markers
  const lowerResponse = trimmed.toLowerCase();
  for (const marker of errorMarkers) {
    if (lowerResponse.includes(marker.toLowerCase())) {
      warnings.push(`Response contains error marker: "${marker}"`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate JSON structure against schema
 *
 * Performs structural validation of parsed JSON data:
 * - Required fields present
 * - Correct field types
 * - Value constraints (min/max, enum, pattern)
 *
 * @param {*} data - Parsed JSON data to validate
 * @param {Object} schema - Validation schema
 * @param {string[]} [schema.required=[]] - Required field names
 * @param {Object} [schema.properties={}] - Field definitions
 * @returns {Object} Validation result with { valid, errors }
 *
 * @example
 * const schema = {
 *   required: ['name', 'age'],
 *   properties: {
 *     name: { type: 'string', minLength: 1 },
 *     age: { type: 'number', minimum: 0 }
 *   }
 * };
 * const result = validateJsonSchema({ name: 'Alice', age: 30 }, schema);
 * // => { valid: true, errors: [] }
 */
export function validateJsonSchema(data, schema) {
  const errors = [];

  if (data === null || data === undefined) {
    errors.push('Data is null or undefined');
    return { valid: false, errors };
  }

  // Check required fields
  const required = schema.required || [];
  for (const field of required) {
    if (!(field in data)) {
      errors.push(`Missing required field: "${field}"`);
    }
  }

  // Validate properties
  const properties = schema.properties || {};
  for (const [field, rules] of Object.entries(properties)) {
    if (!(field in data)) {
      continue; // Skip if not in data and not required
    }

    const value = data[field];
    const fieldPath = field;

    // Type validation
    if (rules.type) {
      const actualType = Array.isArray(value) ? 'array' : typeof value;
      if (actualType !== rules.type) {
        errors.push(
          `Field "${fieldPath}" has invalid type: expected ${rules.type}, got ${actualType}`
        );
        continue; // Skip further validation if type is wrong
      }
    }

    // String validations
    if (rules.type === 'string' && typeof value === 'string') {
      if (rules.minLength !== undefined && value.length < rules.minLength) {
        errors.push(`Field "${fieldPath}" is too short: ${value.length} < ${rules.minLength}`);
      }
      if (rules.maxLength !== undefined && value.length > rules.maxLength) {
        errors.push(`Field "${fieldPath}" is too long: ${value.length} > ${rules.maxLength}`);
      }
      if (rules.pattern && !new RegExp(rules.pattern).test(value)) {
        errors.push(`Field "${fieldPath}" does not match pattern: ${rules.pattern}`);
      }
      if (rules.enum && !rules.enum.includes(value)) {
        errors.push(
          `Field "${fieldPath}" has invalid value: must be one of [${rules.enum.join(', ')}]`
        );
      }
    }

    // Number validations
    if (rules.type === 'number' && typeof value === 'number') {
      if (rules.minimum !== undefined && value < rules.minimum) {
        errors.push(`Field "${fieldPath}" is too small: ${value} < ${rules.minimum}`);
      }
      if (rules.maximum !== undefined && value > rules.maximum) {
        errors.push(`Field "${fieldPath}" is too large: ${value} > ${rules.maximum}`);
      }
    }

    // Array validations
    if (rules.type === 'array' && Array.isArray(value)) {
      if (rules.minItems !== undefined && value.length < rules.minItems) {
        errors.push(`Field "${fieldPath}" has too few items: ${value.length} < ${rules.minItems}`);
      }
      if (rules.maxItems !== undefined && value.length > rules.maxItems) {
        errors.push(`Field "${fieldPath}" has too many items: ${value.length} > ${rules.maxItems}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ==============================================================================
// CONFIDENCE SCORING
// ==============================================================================

/**
 * Calculate confidence score based on multiple factors
 *
 * Computes a weighted confidence score (0-100) from various quality metrics:
 * - Response length
 * - Section completeness
 * - Content quality indicators
 * - Error/warning presence
 *
 * @param {Object} metrics - Quality metrics
 * @param {number} metrics.responseLength - Response character count
 * @param {number} metrics.expectedSections - Number of expected sections
 * @param {number} metrics.foundSections - Number of sections found
 * @param {number} [metrics.qualityIndicators=0] - Positive quality signals
 * @param {number} [metrics.errorCount=0] - Number of errors detected
 * @param {number} [metrics.warningCount=0] - Number of warnings
 * @param {Object} [weights] - Scoring weights
 * @returns {number} Confidence score (0-100)
 *
 * @example
 * const score = calculateConfidenceScore({
 *   responseLength: 500,
 *   expectedSections: 3,
 *   foundSections: 3,
 *   qualityIndicators: 5
 * });
 * // => 95
 */
export function calculateConfidenceScore(metrics, weights = {}) {
  const {
    responseLength,
    expectedSections,
    foundSections,
    qualityIndicators = 0,
    errorCount = 0,
    warningCount = 0,
  } = metrics;

  const {
    lengthWeight = 0.2,
    completenessWeight = 0.4,
    qualityWeight = 0.2,
    errorWeight = 0.2,
  } = weights;

  let score = 0;

  // Length score (0-100 based on content)
  const lengthScore = Math.min(100, (responseLength / 1000) * 100);
  score += lengthScore * lengthWeight;

  // Completeness score (section coverage)
  const completenessScore = expectedSections > 0 ? (foundSections / expectedSections) * 100 : 100;
  score += completenessScore * completenessWeight;

  // Quality score (positive indicators)
  const qualityScore = Math.min(100, qualityIndicators * 20);
  score += qualityScore * qualityWeight;

  // Error penalty
  const errorPenalty = errorCount * 30 + warningCount * 10;
  const errorScore = Math.max(0, 100 - errorPenalty);
  score += errorScore * errorWeight;

  return Math.round(Math.max(0, Math.min(100, score)));
}

/**
 * Determine confidence level category
 *
 * @param {number} score - Confidence score (0-100)
 * @returns {string} Confidence level: 'high', 'medium', 'low', or 'none'
 *
 * @example
 * getConfidenceLevel(85); // => 'high'
 * getConfidenceLevel(65); // => 'medium'
 * getConfidenceLevel(45); // => 'low'
 */
export function getConfidenceLevel(score) {
  if (score >= 80) return 'high';
  if (score >= 60) return 'medium';
  if (score >= 40) return 'low';
  return 'none';
}

/**
 * Check if confidence meets threshold
 *
 * @param {number} score - Confidence score (0-100)
 * @param {number} threshold - Minimum acceptable score
 * @returns {boolean} True if score meets or exceeds threshold
 *
 * @example
 * meetsConfidenceThreshold(85, 80); // => true
 * meetsConfidenceThreshold(75, 80); // => false
 */
export function meetsConfidenceThreshold(score, threshold) {
  return score >= threshold;
}

// ==============================================================================
// CONTENT QUALITY ANALYSIS
// ==============================================================================

/**
 * Analyze content quality indicators
 *
 * Detects positive quality signals in AI response:
 * - Code blocks
 * - Examples
 * - Lists/bullet points
 * - Headers/structure
 * - References/citations
 *
 * @param {string} content - Response content to analyze
 * @returns {Object} Quality metrics with indicator counts
 *
 * @example
 * const quality = analyzeContentQuality('# Title\n\n```js\ncode\n```\n\n- item');
 * // => { codeBlocks: 1, examples: 0, lists: 1, headers: 1, references: 0, total: 3 }
 */
export function analyzeContentQuality(content) {
  if (!content || typeof content !== 'string') {
    return { codeBlocks: 0, examples: 0, lists: 0, headers: 0, references: 0, total: 0 };
  }

  const indicators = {
    // Code blocks (```)
    codeBlocks: (content.match(/```[\s\S]*?```/g) || []).length,

    // Example sections
    examples: (content.match(/example:|for example|e\.g\.|instance:/gi) || []).length,

    // Lists (-, *, numbered)
    lists:
      (content.match(/^[\s]*[-*]\s/gm) || []).length +
      (content.match(/^[\s]*\d+\.\s/gm) || []).length,

    // Headers (#, ##, etc.)
    headers: (content.match(/^#{1,6}\s/gm) || []).length,

    // References/citations
    references: (content.match(/\[[\d]+\]|\[\^[\w]+\]/g) || []).length,
  };

  indicators.total = Object.values(indicators).reduce((sum, count) => sum + count, 0);

  return indicators;
}

/**
 * Count sections in content
 *
 * @param {string} content - Content to analyze
 * @param {string[]} expectedSections - Section names to search for
 * @returns {Object} Section counts with { expected, found, missing }
 *
 * @example
 * const sections = countSections('# Overview\n# Details', ['Overview', 'Details', 'Summary']);
 * // => { expected: 3, found: 2, missing: ['Summary'] }
 */
export function countSections(content, expectedSections) {
  if (!content || typeof content !== 'string') {
    return {
      expected: expectedSections.length,
      found: 0,
      missing: [...expectedSections],
    };
  }

  const found = [];
  const missing = [];

  for (const section of expectedSections) {
    if (content.includes(section)) {
      found.push(section);
    } else {
      missing.push(section);
    }
  }

  return {
    expected: expectedSections.length,
    found: found.length,
    missing,
  };
}

// ==============================================================================
// FALLBACK STRATEGIES
// ==============================================================================

/**
 * Determine fallback action based on validation result
 *
 * Recommends action when AI response fails validation:
 * - 'retry': Response quality is low but recoverable
 * - 'regenerate': Response has structural issues
 * - 'manual': Response cannot be automated
 * - 'accept': Response is acceptable despite warnings
 *
 * @param {Object} validationResult - Result from validateResponse
 * @param {number} confidenceScore - Confidence score (0-100)
 * @param {Object} [thresholds] - Action thresholds
 * @returns {Object} Fallback recommendation with { action, reason }
 *
 * @example
 * const fallback = determineFallbackAction(
 *   { valid: false, errors: ['Too short'], warnings: [] },
 *   45
 * );
 * // => { action: 'retry', reason: 'Low confidence score: 45', retryable: true }
 */
export function determineFallbackAction(validationResult, confidenceScore, thresholds = {}) {
  const { retryThreshold = 40, regenerateThreshold = 60, acceptThreshold = 80 } = thresholds;

  // If valid and high confidence, accept
  if (validationResult.valid && confidenceScore >= acceptThreshold) {
    return {
      action: 'accept',
      reason: 'Response meets quality standards',
      retryable: false,
    };
  }

  // If valid but medium confidence, accept with warnings
  if (validationResult.valid && confidenceScore >= regenerateThreshold) {
    return {
      action: 'accept',
      reason: `Acceptable confidence: ${confidenceScore}`,
      retryable: false,
      warnings: validationResult.warnings,
    };
  }

  // Critical errors require manual intervention
  const criticalErrors = validationResult.errors.filter(
    (err) => err.includes('empty') || err.includes('invalid type')
  );

  if (criticalErrors.length > 0) {
    return {
      action: 'manual',
      reason: `Critical errors: ${criticalErrors.join(', ')}`,
      retryable: false,
    };
  }

  // Structural issues warrant regeneration
  if (validationResult.errors.length > 2) {
    return {
      action: 'regenerate',
      reason: `Multiple validation errors: ${validationResult.errors.length}`,
      retryable: true,
    };
  }

  // Low confidence but recoverable - retry
  if (confidenceScore < retryThreshold) {
    return {
      action: 'retry',
      reason: `Low confidence score: ${confidenceScore}`,
      retryable: true,
    };
  }

  // Medium confidence with some errors - regenerate
  if (confidenceScore < regenerateThreshold) {
    return {
      action: 'regenerate',
      reason: `Moderate confidence (${confidenceScore}) with errors`,
      retryable: true,
    };
  }

  // Default to retry
  return {
    action: 'retry',
    reason: 'Quality below threshold',
    retryable: true,
  };
}

/**
 * Generate retry strategy with backoff
 *
 * Creates retry configuration with exponential backoff:
 * - Attempt count tracking
 * - Delay calculation
 * - Max attempts limit
 *
 * @param {number} attemptNumber - Current attempt (1-based)
 * @param {Object} [config] - Retry configuration
 * @param {number} [config.maxAttempts=3] - Maximum retry attempts
 * @param {number} [config.baseDelay=1000] - Base delay in milliseconds
 * @param {number} [config.maxDelay=10000] - Maximum delay cap
 * @returns {Object} Retry strategy with { shouldRetry, delayMs, attemptsRemaining }
 *
 * @example
 * const retry = generateRetryStrategy(2);
 * // => { shouldRetry: true, delayMs: 2000, attemptsRemaining: 1 }
 */
export function generateRetryStrategy(attemptNumber, config = {}) {
  const { maxAttempts = 3, baseDelay = 1000, maxDelay = 10000 } = config;

  const shouldRetry = attemptNumber < maxAttempts;
  const attemptsRemaining = Math.max(0, maxAttempts - attemptNumber);

  // Exponential backoff: baseDelay * 2^(attempt-1)
  const exponentialDelay = baseDelay * Math.pow(2, attemptNumber - 1);
  const delayMs = Math.min(exponentialDelay, maxDelay);

  return {
    shouldRetry,
    delayMs,
    attemptsRemaining,
    nextAttempt: attemptNumber + 1,
  };
}

// ==============================================================================
// COMPREHENSIVE VALIDATION
// ==============================================================================

/**
 * Perform comprehensive AI response validation
 *
 * Combines all validation checks into single function:
 * - Response validation
 * - Content quality analysis
 * - Confidence scoring
 * - Fallback recommendation
 *
 * @param {string} response - AI response to validate
 * @param {Object} options - Validation options
 * @param {Object} [options.validation] - Response validation options
 * @param {string[]} [options.expectedSections=[]] - Required sections
 * @param {number} [options.confidenceThreshold=60] - Minimum confidence
 * @param {Object} [options.fallbackThresholds] - Fallback thresholds
 * @returns {Object} Comprehensive validation result
 *
 * @example
 * const result = validateAIResponse('# Overview\n\nDetailed content...', {
 *   expectedSections: ['Overview'],
 *   confidenceThreshold: 70
 * });
 * // => { valid, confidence, level, action, errors, warnings, quality }
 */
export function validateAIResponse(response, options = {}) {
  const {
    validation = {},
    expectedSections = [],
    confidenceThreshold = 60,
    fallbackThresholds = {},
  } = options;

  // Validate response
  const validationResult = validateResponse(response, {
    ...validation,
    expectedSections,
  });

  // Analyze content quality
  const quality = analyzeContentQuality(response);

  // Count sections
  const sections = countSections(response, expectedSections);

  // Calculate confidence score
  const confidence = calculateConfidenceScore({
    responseLength: response?.length || 0,
    expectedSections: sections.expected,
    foundSections: sections.found,
    qualityIndicators: quality.total,
    errorCount: validationResult.errors.length,
    warningCount: validationResult.warnings.length,
  });

  // Get confidence level
  const level = getConfidenceLevel(confidence);

  // Check threshold
  const meetsThreshold = meetsConfidenceThreshold(confidence, confidenceThreshold);

  // Determine fallback action
  const fallback = determineFallbackAction(validationResult, confidence, fallbackThresholds);

  return {
    valid: validationResult.valid && meetsThreshold,
    confidence,
    level,
    meetsThreshold,
    action: fallback.action,
    retryable: fallback.retryable,
    errors: validationResult.errors,
    warnings: [...validationResult.warnings, ...(fallback.warnings || [])],
    quality,
    sections,
    fallback,
  };
}
