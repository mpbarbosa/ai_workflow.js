# ai_helpers

**Module:** `src/lib/ai_helpers.js`
**Version:** 2.3.0
**Architecture:** Pure functions + Impure wrapper

Core AI integration for GitHub Copilot SDK interaction, request orchestration, and response processing.

---

## Overview

The `ai_helpers` module provides the primary interface for interacting with GitHub Copilot SDK. It handles request orchestration, response parsing, error handling, retry logic, and batch operations.

### Key Features

- **GitHub Copilot SDK Integration**: Direct integration with @github/copilot-sdk
- **Response Parsing**: Extract content and metadata from AI responses
- **Error Handling**: Parse and categorize AI errors
- **Retry Logic**: Exponential backoff with configurable attempts
- **Batch Requests**: Format multiple requests for efficient processing
- **Request Merging**: Merge user options with defaults
- **Confidence Scoring**: Automatic confidence calculation

### Integration Points

- **Copilot SDK**: Official GitHub Copilot client library
- **AI Cache**: Automatic caching of responses
- **AI Validation**: Response validation and confidence scoring
- **AI Personas**: Persona-based request configuration

---

## Installation

```javascript
import { AiHelper, parseAiResponse, calculateRetryDelay, shouldRetry } from './lib/ai_helpers.js';
```

---

## Pure Functions

### parseAiResponse

Parse raw AI response into structured data.

**Signature:**

```javascript
function parseAiResponse(rawResponse: string | Object): {
  content: string,
  metadata: Object,
  confidence: number,
  success: boolean,
  error?: string
}
```

**Parameters:**

- `rawResponse` (string | Object): Raw response from AI (string or SDK response object)

**Returns:**

- (Object): Structured response with content, metadata, confidence, and success flag

**Pure:** ✅ Yes

**Example:**

```javascript
// String response
const parsed = parseAiResponse('Hello, world!');
// => {
//   content: 'Hello, world!',
//   metadata: {},
//   confidence: 0.7,
//   success: true
// }

// SDK object response
const sdkResponse = {
  content: 'Detailed response...',
  model: 'gpt-4',
  tokens: 150,
  finish_reason: 'stop',
};

const parsed2 = parseAiResponse(sdkResponse);
// => {
//   content: 'Detailed response...',
//   metadata: {
//     model: 'gpt-4',
//     tokens: 150,
//     finishReason: 'stop'
//   },
//   confidence: 0.9,
//   success: true
// }

// Empty response
const empty = parseAiResponse('');
// => {
//   content: '',
//   metadata: {},
//   confidence: 0,
//   success: false,
//   error: 'Empty response'
// }
```

---

### parseErrorResponse

Parse error response and categorize error type.

**Signature:**

```javascript
function parseErrorResponse(error: Error | Object): {
  message: string,
  type: 'rate_limit' | 'auth' | 'network' | 'validation' | 'unknown',
  retryable: boolean,
  details?: Object
}
```

**Parameters:**

- `error` (Error | Object): Error object from AI SDK

**Returns:**

- (Object): Parsed error with message, type, retryability, and details

**Pure:** ✅ Yes

**Example:**

```javascript
const error = new Error('Rate limit exceeded');
error.statusCode = 429;

const parsed = parseErrorResponse(error);
// => {
//   message: 'Rate limit exceeded',
//   type: 'rate_limit',
//   retryable: true,
//   details: { statusCode: 429 }
// }

const authError = new Error('Invalid API key');
authError.statusCode = 401;

const parsed2 = parseErrorResponse(authError);
// => {
//   message: 'Invalid API key',
//   type: 'auth',
//   retryable: false,
//   details: { statusCode: 401 }
// }
```

---

### formatBatchRequests

Format multiple requests for batch processing.

**Signature:**

```javascript
function formatBatchRequests(requests: Array<{
  prompt: string,
  options?: Object
}>): Array<Object>
```

**Parameters:**

- `requests` (Array): Array of request objects with prompt and options

**Returns:**

- (Array): Formatted batch requests ready for SDK

**Pure:** ✅ Yes

**Example:**

```javascript
const requests = [
  { prompt: 'Analyze file1.js', options: { temperature: 0.5 } },
  { prompt: 'Analyze file2.js', options: { temperature: 0.5 } },
  { prompt: 'Analyze file3.js', options: { temperature: 0.5 } },
];

const batch = formatBatchRequests(requests);
// => [
//   { id: 'req_0', prompt: 'Analyze file1.js', options: { temperature: 0.5 } },
//   { id: 'req_1', prompt: 'Analyze file2.js', options: { temperature: 0.5 } },
//   { id: 'req_2', prompt: 'Analyze file3.js', options: { temperature: 0.5 } }
// ]
```

---

### calculateRetryDelay

Calculate exponential backoff delay for retries.

**Signature:**

```javascript
function calculateRetryDelay(
  attempt: number,
  baseDelay?: number,
  maxDelay?: number
): number
```

**Parameters:**

- `attempt` (number): Retry attempt number (1-based)
- `baseDelay` (number, optional): Base delay in ms (default: 1000)
- `maxDelay` (number, optional): Maximum delay in ms (default: 30000)

**Returns:**

- (number): Delay in milliseconds (capped at maxDelay)

**Pure:** ✅ Yes

**Example:**

```javascript
calculateRetryDelay(1); // 1000 ms (1 second)
calculateRetryDelay(2); // 2000 ms (2 seconds)
calculateRetryDelay(3); // 4000 ms (4 seconds)
calculateRetryDelay(4); // 8000 ms (8 seconds)
calculateRetryDelay(5); // 16000 ms (16 seconds)
calculateRetryDelay(10); // 30000 ms (capped at maxDelay)

// Custom base and max
calculateRetryDelay(3, 500, 5000); // 2000 ms
calculateRetryDelay(10, 500, 5000); // 5000 ms (capped)
```

---

### shouldRetry

Determine if request should be retried based on error and attempt count.

**Signature:**

```javascript
function shouldRetry(
  errorInfo: {
    type: string,
    retryable: boolean
  },
  attemptCount: number,
  maxAttempts?: number
): boolean
```

**Parameters:**

- `errorInfo` (Object): Parsed error from `parseErrorResponse`
- `attemptCount` (number): Current attempt count
- `maxAttempts` (number, optional): Maximum retry attempts (default: 3)

**Returns:**

- (boolean): True if should retry, false otherwise

**Pure:** ✅ Yes

**Example:**

```javascript
const rateLimitError = { type: 'rate_limit', retryable: true };
shouldRetry(rateLimitError, 1, 3); // true
shouldRetry(rateLimitError, 3, 3); // true
shouldRetry(rateLimitError, 4, 3); // false (max attempts exceeded)

const authError = { type: 'auth', retryable: false };
shouldRetry(authError, 1, 3); // false (non-retryable)
```

---

### mergeRequestOptions

Merge user options with defaults.

**Signature:**

```javascript
function mergeRequestOptions(options?: Object, defaults?: Object): Object
```

**Parameters:**

- `options` (Object, optional): User-provided options (default: {})
- `defaults` (Object, optional): Default options (default: {})

**Returns:**

- (Object): Merged options (user options override defaults)

**Pure:** ✅ Yes

**Example:**

```javascript
const defaults = {
  temperature: 0.7,
  maxTokens: 2000,
  model: 'gpt-4',
};

const userOptions = {
  temperature: 0.5,
  topP: 0.9,
};

const merged = mergeRequestOptions(userOptions, defaults);
// => {
//   temperature: 0.5,      // User override
//   maxTokens: 2000,       // From defaults
//   model: 'gpt-4',        // From defaults
//   topP: 0.9              // User addition
// }
```

---

## Wrapper Class

### AiHelper

High-level AI helper with SDK integration.

**Constructor:**

```javascript
new AiHelper(options?: {
  apiKey?: string,
  model?: string,
  temperature?: number,
  maxTokens?: number,
  cache?: AiCache,
  enableRetry?: boolean,
  maxRetries?: number
})
```

**Options:**

- `apiKey` (string, optional): GitHub Copilot API key (or from env)
- `model` (string, optional): AI model name (default: 'gpt-4')
- `temperature` (number, optional): Temperature 0-1 (default: 0.7)
- `maxTokens` (number, optional): Max response tokens (default: 2000)
- `cache` (AiCache, optional): Cache instance for response caching
- `enableRetry` (boolean, optional): Enable automatic retries (default: true)
- `maxRetries` (number, optional): Max retry attempts (default: 3)

**Side Effects:** Network requests, API calls, cache operations, logging

---

### Methods

#### request

Make AI request with automatic retries and caching.

**Signature:**

```javascript
async request(prompt: string, options?: {
  persona?: string,
  temperature?: number,
  maxTokens?: number,
  context?: string,
  useCache?: boolean
}): Promise<{
  content: string,
  metadata: Object,
  confidence: number,
  cached: boolean
}>
```

**Parameters:**

- `prompt` (string): AI prompt text
- `options` (Object, optional): Request options

**Returns:**

- (Promise): Parsed AI response with caching info

**Side Effects:** Network request (if cache miss), cache write/read, logging

**Example:**

```javascript
const helper = new AiHelper({ apiKey: process.env.COPILOT_API_KEY });

const response = await helper.request('Analyze this code...', {
  persona: 'code_reviewer',
  temperature: 0.5,
  useCache: true,
});

console.log(`Response: ${response.content}`);
console.log(`Confidence: ${response.confidence}`);
console.log(`From cache: ${response.cached}`);
```

---

#### batchRequest

Make multiple AI requests in parallel.

**Signature:**

```javascript
async batchRequest(requests: Array<{
  prompt: string,
  options?: Object
}>): Promise<Array<{
  content: string,
  metadata: Object,
  confidence: number,
  error?: string
}>>
```

**Parameters:**

- `requests` (Array): Array of request objects

**Returns:**

- (Promise<Array>): Array of responses (same order as requests)

**Side Effects:** Multiple network requests, cache operations, logging

**Example:**

```javascript
const helper = new AiHelper();

const requests = [
  { prompt: 'Analyze file1.js', options: { persona: 'code_reviewer' } },
  { prompt: 'Analyze file2.js', options: { persona: 'code_reviewer' } },
  { prompt: 'Analyze file3.js', options: { persona: 'code_reviewer' } },
];

const responses = await helper.batchRequest(requests);

responses.forEach((response, index) => {
  console.log(`Response ${index + 1}:`, response.content);
});
```

---

#### validateResponse

Validate AI response and determine if retry is needed.

**Signature:**

```javascript
validateResponse(response: Object): {
  valid: boolean,
  shouldRetry: boolean,
  reason?: string
}
```

**Parameters:**

- `response` (Object): Parsed AI response

**Returns:**

- (Object): Validation result with retry recommendation

**Side Effects:** None (uses validation module)

**Example:**

```javascript
const helper = new AiHelper();
const response = await helper.request('prompt...');

const validation = helper.validateResponse(response);

if (!validation.valid) {
  console.error(`Invalid response: ${validation.reason}`);

  if (validation.shouldRetry) {
    console.log('Retrying...');
    // Retry logic
  }
}
```

---

## Usage Examples

### Example 1: Basic AI Request

```javascript
import { AiHelper } from './lib/ai_helpers.js';

const helper = new AiHelper({
  apiKey: process.env.COPILOT_API_KEY,
  model: 'gpt-4',
  temperature: 0.7,
});

const response = await helper.request('Write unit tests for this function...');

console.log(response.content);
```

---

### Example 2: Request with Caching

```javascript
import { AiHelper } from './lib/ai_helpers.js';
import { AiCache } from './lib/ai_cache.js';

const cache = new AiCache({ ttl: 3600 }); // 1 hour cache
await cache.init();

const helper = new AiHelper({
  cache,
  apiKey: process.env.COPILOT_API_KEY,
});

// First request (cache miss)
const response1 = await helper.request('Analyze code...', { useCache: true });
console.log(`Cached: ${response1.cached}`); // false

// Second identical request (cache hit)
const response2 = await helper.request('Analyze code...', { useCache: true });
console.log(`Cached: ${response2.cached}`); // true
```

---

### Example 3: Batch Processing

```javascript
import { AiHelper } from './lib/ai_helpers.js';

const helper = new AiHelper();

const files = ['file1.js', 'file2.js', 'file3.js'];

const requests = files.map((file) => ({
  prompt: `Analyze ${file} for code quality issues`,
  options: { persona: 'code_reviewer' },
}));

const responses = await helper.batchRequest(requests);

responses.forEach((response, i) => {
  if (response.error) {
    console.error(`Error analyzing ${files[i]}: ${response.error}`);
  } else {
    console.log(`${files[i]}: ${response.content}`);
  }
});
```

---

### Example 4: Error Handling with Retry

```javascript
import { AiHelper, parseErrorResponse, shouldRetry } from './lib/ai_helpers.js';

const helper = new AiHelper({ maxRetries: 5 });

async function requestWithRetry(prompt, maxAttempts = 5) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await helper.request(prompt);
    } catch (error) {
      const errorInfo = parseErrorResponse(error);

      if (!shouldRetry(errorInfo, attempt, maxAttempts)) {
        throw new Error(`Failed after ${attempt} attempts: ${errorInfo.message}`);
      }

      const delay = calculateRetryDelay(attempt);
      console.log(`Retry ${attempt} after ${delay}ms: ${errorInfo.message}`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

const response = await requestWithRetry('Analyze code...');
```

---

### Example 5: Persona-Based Requests

```javascript
import { AiHelper } from './lib/ai_helpers.js';

const helper = new AiHelper();

// Documentation expert persona
const docResponse = await helper.request('Review API documentation', {
  persona: 'documentation_expert',
  temperature: 0.5,
});

// Test engineer persona
const testResponse = await helper.request('Review test coverage', {
  persona: 'test_engineer',
  temperature: 0.3,
});

// Security expert persona
const secResponse = await helper.request('Audit for vulnerabilities', {
  persona: 'security_expert',
  temperature: 0.2,
});
```

---

### Example 6: Response Validation

```javascript
import { AiHelper, parseAiResponse } from './lib/ai_helpers.js';

const helper = new AiHelper();

const rawResponse = await helper.request('Generate documentation...');
const parsed = parseAiResponse(rawResponse);

if (parsed.confidence < 0.7) {
  console.warn(`Low confidence: ${parsed.confidence}`);
  console.warn('Consider regenerating or manual review');
}

if (!parsed.success) {
  console.error(`Request failed: ${parsed.error}`);
}
```

---

### Example 7: Custom Request Options

```javascript
import { AiHelper, mergeRequestOptions } from './lib/ai_helpers.js';

const defaults = {
  temperature: 0.7,
  maxTokens: 2000,
  model: 'gpt-4',
};

const userOptions = {
  temperature: 0.5,
  topP: 0.9,
};

const options = mergeRequestOptions(userOptions, defaults);

const helper = new AiHelper(options);
const response = await helper.request('prompt...');
```

---

## Related Modules

- **[ai_cache](./ai_cache.md)** - Response caching
- **[ai_validation](./ai_validation.md)** - Response validation
- **[ai_personas](./ai_personas.md)** - AI personas
- **[ai_prompt_builder](./ai_prompt_builder.md)** - Prompt construction

---

## Notes

### GitHub Copilot SDK

Requires `@github/copilot-sdk` package:

```bash
npm install @github/copilot-sdk
```

### API Key

Set the API key via:

1. Constructor option: `new AiHelper({ apiKey: 'key' })`
2. Environment variable: `COPILOT_API_KEY`

### Retry Strategy

- Default: 3 retries with exponential backoff
- Retryable errors: rate_limit, network, timeout
- Non-retryable: auth, validation errors

### Confidence Scoring

Confidence is calculated based on:

- Response length (longer = higher confidence)
- Content quality indicators
- Absence of "I don't know" patterns
- Model metadata (if available)

### Performance

- Single requests: ~500-2000ms (depends on model and prompt)
- Batch requests: Parallelized for faster processing
- Caching: 60-80% token reduction on repeated prompts
- Retry overhead: Adds 1-30s per retry with exponential backoff

### Best Practices

1. **Use caching**: Enable for repeated operations
2. **Set reasonable timeouts**: Avoid hanging requests
3. **Handle errors gracefully**: Always catch and parse errors
4. **Validate responses**: Check confidence and success flags
5. **Use personas**: Improve response quality with specialized personas
6. **Batch when possible**: Reduce latency for multiple requests

---

**Last Updated:** 2026-02-07
**Stability:** Stable
**Test Coverage:** 97% (3 known test failures in jq_wrapper integration)
