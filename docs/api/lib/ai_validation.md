# ai_validation

**Module:** `src/lib/ai_validation.js`
**Version:** 2.5.0
**Architecture:** Pure functions only

AI response validation with confidence scoring and fallback strategies.

---

## Overview

The `ai_validation` module provides comprehensive validation functions for AI responses, including confidence scoring, schema validation, content quality analysis, and intelligent fallback strategies.

### Key Features

- **Response Validation**: Check completeness, length, expected sections
- **JSON Schema Validation**: Structural validation with type checking
- **Confidence Scoring**: Calculate confidence based on multiple metrics
- **Content Quality Analysis**: Analyze response quality indicators
- **Fallback Strategies**: Recommend actions when validation fails
- **Retry Logic**: Generate exponential backoff retry strategies
- **Pure Functions**: All operations are deterministic

---

## Installation

```javascript
import {
  validateResponse,
  validateJsonSchema,
  calculateConfidenceScore,
  validateAIResponse,
} from './lib/ai_validation.js';
```

---

## Pure Functions

### validateResponse

Validate AI response completeness.

**Signature:**

```javascript
function validateResponse(response: string, options?: {
  minLength?: number,
  expectedSections?: string[],
  errorMarkers?: string[]
}): {
  valid: boolean,
  errors: string[],
  warnings: string[]
}
```

**Parameters:**

- `response` (string): AI response text
- `options.minLength` (number, optional): Minimum response length (default: 10)
- `options.expectedSections` (string[], optional): Required section headers (default: [])
- `options.errorMarkers` (string[], optional): Error indicators (default: ['error:', 'failed:', 'invalid:'])

**Returns:**

- (Object): Validation result with `valid`, `errors`, and `warnings`

**Pure:** ✅ Yes

**Example:**

```javascript
const result = validateResponse('# Title\n\nContent here', {
  minLength: 20,
  expectedSections: ['Title', 'Content'],
});
// => { valid: true, errors: [], warnings: [] }

const invalid = validateResponse('Too short', { minLength: 50 });
// => { valid: false, errors: ['Response too short: 9 < 50 characters'], warnings: [] }
```

---

### validateJsonSchema

Validate JSON structure against schema.

**Signature:**

```javascript
function validateJsonSchema(data: any, schema: {
  required?: string[],
  properties?: Object
}): {
  valid: boolean,
  errors: string[]
}
```

**Parameters:**

- `data` (any): Parsed JSON data
- `schema` (Object): JSON schema with `required` and `properties`

**Returns:**

- (Object): Validation result with `valid` and `errors`

**Pure:** ✅ Yes

**Example:**

```javascript
const schema = {
  required: ['name', 'age'],
  properties: {
    name: { type: 'string' },
    age: { type: 'number', minimum: 0, maximum: 150 },
  },
};

const valid = validateJsonSchema({ name: 'Alice', age: 30 }, schema);
// => { valid: true, errors: [] }

const invalid = validateJsonSchema({ name: 'Bob' }, schema);
// => { valid: false, errors: ['Missing required field: age'] }
```

---

### calculateConfidenceScore

Calculate confidence score from multiple metrics.

**Signature:**

```javascript
function calculateConfidenceScore(metrics: {
  length?: number,
  structureValid?: boolean,
  contentQuality?: number,
  hasErrors?: boolean
}, weights?: Object): number
```

**Parameters:**

- `metrics` (Object): Metrics to evaluate
- `weights` (Object, optional): Metric weights (default balanced weights)

**Returns:**

- (number): Confidence score 0-100

**Pure:** ✅ Yes

**Example:**

```javascript
const score = calculateConfidenceScore({
  length: 500,
  structureValid: true,
  contentQuality: 0.8,
  hasErrors: false,
});
// => 85

const lowScore = calculateConfidenceScore({
  length: 50,
  structureValid: false,
  contentQuality: 0.3,
  hasErrors: true,
});
// => 25
```

---

### getConfidenceLevel

Get confidence level category from score.

**Signature:**

```javascript
function getConfidenceLevel(score: number): 'very_low' | 'low' | 'medium' | 'high' | 'very_high'
```

**Parameters:**

- `score` (number): Confidence score 0-100

**Returns:**

- (string): Confidence level category

**Pure:** ✅ Yes

**Example:**

```javascript
getConfidenceLevel(95); // 'very_high'
getConfidenceLevel(75); // 'high'
getConfidenceLevel(55); // 'medium'
getConfidenceLevel(35); // 'low'
getConfidenceLevel(15); // 'very_low'
```

---

### meetsConfidenceThreshold

Check if score meets threshold.

**Signature:**

```javascript
function meetsConfidenceThreshold(score: number, threshold: number): boolean
```

**Parameters:**

- `score` (number): Confidence score
- `threshold` (number): Minimum acceptable score

**Returns:**

- (boolean): True if score >= threshold

**Pure:** ✅ Yes

**Example:**

```javascript
meetsConfidenceThreshold(85, 80); // true
meetsConfidenceThreshold(75, 80); // false
```

---

### analyzeContentQuality

Analyze content quality indicators.

**Signature:**

```javascript
function analyzeContentQuality(content: string): {
  codeBlocks: number,
  lists: number,
  headings: number,
  links: number,
  images: number,
  total: number
}
```

**Parameters:**

- `content` (string): Content to analyze

**Returns:**

- (Object): Quality indicator counts

**Pure:** ✅ Yes

**Example:**

```javascript
const quality = analyzeContentQuality(`
# Title
- Item 1
- Item 2
\`\`\`js
code
\`\`\`
[link](url)
`);
// => { codeBlocks: 1, lists: 1, headings: 1, links: 1, images: 0, total: 4 }
```

---

### countSections

Count sections in content.

**Signature:**

```javascript
function countSections(content: string, expectedSections: string[]): {
  expected: number,
  found: number,
  missing: string[]
}
```

**Parameters:**

- `content` (string): Content to analyze
- `expectedSections` (string[]): Section names to search for

**Returns:**

- (Object): Section counts with `expected`, `found`, and `missing`

**Pure:** ✅ Yes

**Example:**

```javascript
const sections = countSections('# Overview\n# Details', ['Overview', 'Details', 'Summary']);
// => { expected: 3, found: 2, missing: ['Summary'] }
```

---

### determineFallbackAction

Determine fallback action based on validation result.

**Signature:**

```javascript
function determineFallbackAction(
  validationResult: { valid: boolean, errors: string[], warnings: string[] },
  confidenceScore: number,
  thresholds?: {
    retryThreshold?: number,
    regenerateThreshold?: number,
    acceptThreshold?: number
  }
): {
  action: 'retry' | 'regenerate' | 'manual' | 'accept',
  reason: string,
  retryable: boolean,
  warnings?: string[]
}
```

**Parameters:**

- `validationResult` (Object): Result from `validateResponse`
- `confidenceScore` (number): Confidence score 0-100
- `thresholds` (Object, optional): Action thresholds (default: retry=40, regenerate=60, accept=80)

**Returns:**

- (Object): Fallback recommendation with action, reason, and retryable flag

**Pure:** ✅ Yes

**Example:**

```javascript
const fallback = determineFallbackAction({ valid: false, errors: ['Too short'], warnings: [] }, 45);
// => { action: 'retry', reason: 'Low confidence score: 45', retryable: true }

const manual = determineFallbackAction(
  { valid: false, errors: ['Response is empty or invalid type'], warnings: [] },
  0
);
// => { action: 'manual', reason: 'Critical errors: ...', retryable: false }
```

---

### generateRetryStrategy

Generate exponential backoff retry strategy.

**Signature:**

```javascript
function generateRetryStrategy(attemptNumber: number, config?: {
  baseDelay?: number,
  maxDelay?: number,
  multiplier?: number,
  jitter?: boolean
}): {
  delay: number,
  shouldRetry: boolean,
  attemptNumber: number
}
```

**Parameters:**

- `attemptNumber` (number): Current attempt number (1-based)
- `config.baseDelay` (number, optional): Base delay in ms (default: 1000)
- `config.maxDelay` (number, optional): Maximum delay in ms (default: 32000)
- `config.multiplier` (number, optional): Backoff multiplier (default: 2)
- `config.jitter` (boolean, optional): Add random jitter (default: true)

**Returns:**

- (Object): Retry strategy with delay, shouldRetry flag, and attempt number

**Pure:** ✅ Yes (note: jitter uses Math.random() but result is still valid)

**Example:**

```javascript
const retry1 = generateRetryStrategy(1);
// => { delay: ~1000, shouldRetry: true, attemptNumber: 1 }

const retry2 = generateRetryStrategy(2);
// => { delay: ~2000, shouldRetry: true, attemptNumber: 2 }

const retry5 = generateRetryStrategy(5);
// => { delay: 32000 (capped at maxDelay), shouldRetry: true, attemptNumber: 5 }
```

---

### validateAIResponse

Comprehensive AI response validation (combines multiple validators).

**Signature:**

```javascript
function validateAIResponse(response: string | Object, options?: {
  minLength?: number,
  expectedSections?: string[],
  schema?: Object,
  confidenceThreshold?: number
}): {
  valid: boolean,
  confidence: number,
  errors: string[],
  warnings: string[],
  fallbackAction?: string
}
```

**Parameters:**

- `response` (string | Object): AI response to validate
- `options` (Object, optional): Validation options

**Returns:**

- (Object): Comprehensive validation result

**Pure:** ✅ Yes

**Example:**

```javascript
const result = validateAIResponse('# Analysis\n\nDetailed content here...', {
  minLength: 50,
  expectedSections: ['Analysis'],
  confidenceThreshold: 70,
});
// => { valid: true, confidence: 85, errors: [], warnings: [], fallbackAction: 'accept' }
```

---

## Usage Examples

### Example 1: Basic Response Validation

```javascript
import { validateResponse } from './lib/ai_validation.js';

const response = '# Title\n\nThis is a detailed response with proper structure.';

const result = validateResponse(response, {
  minLength: 30,
  expectedSections: ['Title'],
});

if (result.valid) {
  console.log('Response is valid!');
} else {
  console.error('Validation errors:', result.errors);
}
```

---

### Example 2: JSON Schema Validation

```javascript
import { validateJsonSchema } from './lib/ai_validation.js';

const schema = {
  required: ['summary', 'details'],
  properties: {
    summary: { type: 'string' },
    details: { type: 'object' },
    count: { type: 'number', minimum: 0 },
  },
};

const data = {
  summary: 'Test summary',
  details: { info: 'More info' },
  count: 5,
};

const result = validateJsonSchema(data, schema);
console.log(result);
// => { valid: true, errors: [] }
```

---

### Example 3: Confidence Scoring

```javascript
import { calculateConfidenceScore, getConfidenceLevel } from './lib/ai_validation.js';

const metrics = {
  length: 500,
  structureValid: true,
  contentQuality: 0.85,
  hasErrors: false,
};

const score = calculateConfidenceScore(metrics);
const level = getConfidenceLevel(score);

console.log(`Confidence: ${score} (${level})`);
// Confidence: 88 (high)
```

---

### Example 4: Fallback Strategy

```javascript
import { determineFallbackAction, validateResponse } from './lib/ai_validation.js';

const response = 'Short response';
const validation = validateResponse(response, { minLength: 100 });
const fallback = determineFallbackAction(validation, 35);

console.log(`Action: ${fallback.action}`);
console.log(`Reason: ${fallback.reason}`);
console.log(`Retryable: ${fallback.retryable}`);

// Action: retry
// Reason: Low confidence score: 35
// Retryable: true
```

---

### Example 5: Retry with Exponential Backoff

```javascript
import { generateRetryStrategy } from './lib/ai_validation.js';

async function retryWithBackoff(fn, maxAttempts = 5) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const strategy = generateRetryStrategy(attempt);

      if (!strategy.shouldRetry) {
        throw error;
      }

      console.log(`Retry ${attempt} after ${strategy.delay}ms`);
      await new Promise((resolve) => setTimeout(resolve, strategy.delay));
    }
  }
  throw new Error('Max retries exceeded');
}
```

---

### Example 6: Comprehensive Validation

```javascript
import { validateAIResponse } from './lib/ai_validation.js';

const response = `
# Documentation Analysis

## Overview
The documentation is well-structured.

## Details
- Clear examples
- Good organization
- Complete coverage
`;

const result = validateAIResponse(response, {
  minLength: 50,
  expectedSections: ['Overview', 'Details'],
  confidenceThreshold: 70,
});

console.log(`Valid: ${result.valid}`);
console.log(`Confidence: ${result.confidence}`);
console.log(`Action: ${result.fallbackAction}`);

// Valid: true
// Confidence: 85
// Action: accept
```

---

## Related Modules

- **[ai_helpers](./ai_helpers.md)** - AI request orchestration
- **[ai_cache](./ai_cache.md)** - Response caching
- **[ai_prompt_builder](./ai_prompt_builder.md)** - Prompt construction

---

## Notes

### Confidence Score Calculation

Confidence scores are calculated from weighted metrics:

- **Length**: Longer responses generally indicate more detail
- **Structure**: Valid JSON/markdown structure
- **Content Quality**: Presence of code blocks, lists, headings
- **Errors**: Error markers reduce confidence

Default weights are balanced but can be customized.

### Fallback Actions

- **accept**: Response is good enough to use
- **retry**: Response quality is low, try again with same prompt
- **regenerate**: Structural issues, regenerate with modified prompt
- **manual**: Critical errors, requires human intervention

### Retry Strategy

Uses exponential backoff with optional jitter:

- Attempt 1: ~1s delay
- Attempt 2: ~2s delay
- Attempt 3: ~4s delay
- Attempt 4: ~8s delay
- Attempt 5+: 32s (capped)

Jitter adds ±25% randomness to prevent thundering herd.

### Performance

- All functions are O(n) where n = content length
- Schema validation is O(m) where m = number of properties
- No external dependencies
- Pure functions enable safe memoization

---

**Last Updated:** 2026-02-07
**Stability:** Stable
**Test Coverage:** 100%
