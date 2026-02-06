# ai_helpers - AI Integration Module

**Module:** `lib/ai_helpers`  
**Version:** 2.0.0  
**Type:** Pure Functions + Wrapper

## Overview

Core AI integration for GitHub Copilot SDK interaction, request orchestration, and response processing. Handles SDK availability, authentication, request execution with retries, batch processing, and error handling.

---

## Architecture

**Pure Functions** (exported for testing):

- `parseAiResponse()` - Parse raw AI response
- `parseErrorResponse()` - Parse error into structured format
- `formatBatchRequests()` - Format multiple requests for batch processing
- `calculateRetryDelay()` - Calculate exponential backoff delay
- `shouldRetry()` - Determine if error is retryable
- `mergeRequestOptions()` - Merge options with defaults

**Wrapper Class**:

- `AiHelper` - SDK integration with authentication and request execution

---

## Pure Functions

### `parseAiResponse(rawResponse)`

Parses raw AI response into structured data.

**Parameters:**

- `rawResponse` (string|Object) - Raw response from AI

**Returns:** Object with `{ content, metadata, confidence, success }`

**Confidence Scoring:**

- < 10 chars: 0.3
- Contains "I don't know": 0.5
- 30-500 chars: 0.7-0.8
- > 500 chars: 0.9

**Example:**

```javascript
import { parseAiResponse } from './lib/ai_helpers.js';

// String response
const parsed = parseAiResponse('Here is a detailed test suite...');
// {
//   content: 'Here is a detailed test suite...',
//   metadata: {},
//   confidence: 0.8,
//   success: true
// }

// Object response (SDK format)
const parsed2 = parseAiResponse({
  content: 'Response text',
  model: 'gpt-4',
  tokens: 150,
});
// {
//   content: 'Response text',
//   metadata: { model: 'gpt-4', tokens: 150, finishReason: 'complete' },
//   confidence: 0.7,
//   success: true
// }
```

---

### `parseErrorResponse(error)`

Parses error into structured error information.

**Parameters:**

- `error` (Error|string|Object) - Error from AI request

**Returns:** Object with `{ type, message, retryable, details }`

**Error Types:**

- `'authentication'` - Auth errors (401, 403, unauthorized)
- `'rate_limit'` - Rate limiting (429, too many requests)
- `'network'` - Network errors (timeout, ECONNREFUSED)
- `'unknown'` - Other errors

**Example:**

```javascript
const error = new Error('Network timeout');
const parsed = parseErrorResponse(error);
// {
//   type: 'network',
//   message: 'Network timeout',
//   retryable: true,
//   details: { name: 'Error', stack: '...' }
// }
```

---

### `formatBatchRequests(requests)`

Formats multiple requests for batch processing.

**Parameters:**

- `requests` (Array\<Object\>) - Array of request objects

**Returns:** Object with `{ requests, count, metadata }`

**Example:**

```javascript
const batch = formatBatchRequests([
  { prompt: 'Test 1', id: 'a' },
  { prompt: 'Test 2', id: 'b' },
  { invalid: 'no prompt' }, // Filtered out
]);
// {
//   requests: [
//     { id: 'a', prompt: 'Test 1', options: {}, metadata: {} },
//     { id: 'b', prompt: 'Test 2', options: {}, metadata: {} }
//   ],
//   count: 2,
//   metadata: {
//     formatted: '2026-02-01T12:00:00.000Z',
//     valid: true,
//     originalCount: 3,
//     filteredCount: 1
//   }
// }
```

---

### `calculateRetryDelay(attempt, baseDelay, maxDelay)`

Calculates retry delay with exponential backoff.

**Parameters:**

- `attempt` (number) - Current attempt number (0-based)
- `baseDelay` (number) - Base delay in ms (default: 1000)
- `maxDelay` (number) - Maximum delay in ms (default: 30000)

**Returns:** number - Delay in milliseconds

**Formula:** `delay = min(baseDelay * 2^attempt, maxDelay)`

**Example:**

```javascript
calculateRetryDelay(0, 1000, 10000); // 1000ms (1s)
calculateRetryDelay(1, 1000, 10000); // 2000ms (2s)
calculateRetryDelay(2, 1000, 10000); // 4000ms (4s)
calculateRetryDelay(3, 1000, 10000); // 8000ms (8s)
calculateRetryDelay(4, 1000, 10000); // 10000ms (capped at max)
```

---

### `shouldRetry(errorInfo, attemptCount, maxAttempts)`

Determines if error is retryable.

**Parameters:**

- `errorInfo` (Object) - Parsed error information
- `attemptCount` (number) - Number of attempts made
- `maxAttempts` (number) - Maximum attempts allowed (default: 3)

**Returns:** boolean - True if should retry

**Example:**

```javascript
const errorInfo = { retryable: true, type: 'network' };
shouldRetry(errorInfo, 1, 3); // true
shouldRetry(errorInfo, 3, 3); // false (exhausted attempts)

const authError = { retryable: false, type: 'authentication' };
shouldRetry(authError, 1, 3); // false (not retryable)
```

---

### `mergeRequestOptions(options, defaults)`

Merges request options with defaults.

**Parameters:**

- `options` (Object) - User-provided options
- `defaults` (Object) - Default options

**Returns:** Object - Merged options

**Example:**

```javascript
const defaults = {
  model: 'gpt-4',
  temperature: 0.7,
  maxTokens: 4000,
};

const options = {
  temperature: 0.9,
  maxTokens: 8000,
};

const merged = mergeRequestOptions(options, defaults);
// {
//   model: 'gpt-4',
//   temperature: 0.9,
//   maxTokens: 8000,
//   stream: false,
//   cache: true
// }
```

---

## AiHelper Class

AI helper for GitHub Copilot SDK integration.

### Constructor

```javascript
new AiHelper(config);
```

**Config Options:**

- `model` (string) - Default model (default: 'gpt-4')
- `maxRetries` (number) - Maximum retry attempts (default: 3)
- `cache` (boolean) - Enable response caching (default: true)
- `timeout` (number) - Request timeout in ms (default: 30000)
- `baseDelay` (number) - Base retry delay in ms (default: 1000)
- `maxDelay` (number) - Max retry delay in ms (default: 30000)

### Methods

#### `isSdkAvailable()`

Checks if GitHub Copilot SDK is available.

**Returns:** boolean - True if SDK can be instantiated

**Example:**

```javascript
import { AiHelper } from './lib/ai_helpers.js';

const helper = new AiHelper({ model: 'gpt-4' });

if (helper.isSdkAvailable()) {
  console.log('✅ SDK is available');
} else {
  console.log('❌ SDK not found - install @github/copilot-sdk');
}
```

---

#### `async initialize()`

Initializes SDK connection and tests authentication.

**Returns:** Promise\<boolean\> - True if initialization successful

**Example:**

```javascript
const helper = new AiHelper();
const success = await helper.initialize();

if (success) {
  console.log('✅ SDK initialized and authenticated');
} else {
  console.log('❌ Initialization failed');
}
```

---

#### `async validateSdk()`

Validates SDK and provides detailed feedback.

**Returns:** Promise\<Object\> - Validation result with status and suggestions

**Example:**

```javascript
const validation = await helper.validateSdk();

if (!validation.available) {
  console.log(validation.message);
  console.log('Suggestions:');
  validation.suggestions.forEach((s) => console.log(`  - ${s}`));
}

// Example output:
// {
//   available: false,
//   authenticated: false,
//   message: 'GitHub Copilot SDK not found',
//   suggestions: [
//     'Install with: npm install @github/copilot-sdk',
//     'Verify package.json includes @github/copilot-sdk',
//     'Run: npm install to install dependencies'
//   ]
// }
```

---

#### `async shouldEnableAi()`

Determines if AI features should be enabled.

**Returns:** Promise\<boolean\> - True if AI should be enabled

**Example:**

```javascript
if (await helper.shouldEnableAi()) {
  console.log('AI features enabled');
  // Proceed with AI operations
} else {
  console.log('AI features disabled - falling back to manual mode');
  // Use fallback logic
}
```

---

#### `isAvailable()`

Checks if AI helper is ready for use.

**Returns:** boolean - True if available and authenticated

**Example:**

```javascript
if (helper.isAvailable()) {
  const response = await helper.executeRequest(prompt);
}
```

---

#### `async executeRequest(prompt, options)`

Executes single AI request with retries and error handling.

**Parameters:**

- `prompt` (string) - The prompt to send
- `options` (Object) - Request options
  - `model` (string) - Model to use
  - `temperature` (number) - Temperature (0-1)
  - `maxTokens` (number) - Max tokens
  - `validate` (boolean) - Validate response (default: true)
  - `minLength` (number) - Min response length for validation
  - `requireSections` (string[]) - Required sections for validation

**Returns:** Promise\<Object\> - Response object with `content`, `metadata`, `confidence`

**Throws:**

- `ValidationError` - If validation fails
- `SystemError` - If SDK errors occur

**Example:**

```javascript
try {
  const response = await helper.executeRequest('Write tests for app.js', {
    model: 'gpt-4',
    temperature: 0.7,
    maxTokens: 4000,
    validate: true,
    minLength: 100,
  });

  console.log('Response:', response.content);
  console.log('Confidence:', response.confidence);
  console.log('Model:', response.metadata.model);
} catch (error) {
  console.error('Request failed:', error.message);
}
```

---

#### `async executeBatch(requests, options)`

Executes multiple AI requests in batch.

**Parameters:**

- `requests` (Array\<Object\>) - Array of request objects
  - `prompt` (string) - Request prompt
  - `id` (string) - Request ID (optional)
  - `options` (Object) - Request options (optional)
- `options` (Object) - Batch options
  - `parallel` (boolean) - Execute in parallel (default: false)
  - `concurrency` (number) - Max parallel requests (default: 3)

**Returns:** Promise\<Array\<Object\>\> - Array of results with `id`, `success`, `response`, `error`

**Example:**

```javascript
const requests = [
  { id: 'test1', prompt: 'Write tests for app.js' },
  { id: 'test2', prompt: 'Write tests for utils.js' },
  { id: 'doc1', prompt: 'Document app.js' },
];

// Sequential execution
const results = await helper.executeBatch(requests);

// Parallel execution with concurrency limit
const resultsParallel = await helper.executeBatch(requests, {
  parallel: true,
  concurrency: 2,
});

// Process results
for (const result of results) {
  if (result.success) {
    console.log(`${result.id}: Success`);
    console.log(result.response.content);
  } else {
    console.log(`${result.id}: Failed - ${result.error.message}`);
  }
}
```

---

#### `async cleanup()`

Closes SDK connection and cleans up resources.

**Returns:** Promise\<void\>

**Example:**

```javascript
// Always cleanup when done
try {
  await helper.executeRequest(prompt);
} finally {
  await helper.cleanup();
}
```

---

## Usage Examples

### Basic AI Request

```javascript
import { AiHelper } from './lib/ai_helpers.js';

const helper = new AiHelper({
  model: 'gpt-4',
  maxRetries: 3,
});

// Initialize
await helper.initialize();

// Execute request
const response = await helper.executeRequest('Write comprehensive tests for this function', {
  temperature: 0.7,
});

console.log(response.content);

// Cleanup
await helper.cleanup();
```

### SDK Validation Flow

```javascript
const helper = new AiHelper();

// Check SDK availability
const validation = await helper.validateSdk();

if (!validation.available) {
  console.error(validation.message);
  console.log('Please install:');
  validation.suggestions.forEach((s) => console.log(`  ${s}`));
  process.exit(1);
}

if (!validation.authenticated) {
  console.error(validation.message);
  console.log('Authentication steps:');
  validation.suggestions.forEach((s) => console.log(`  ${s}`));
  process.exit(1);
}

console.log('✅ SDK ready:', validation.message);
```

### Batch Processing

```javascript
const helper = new AiHelper();
await helper.initialize();

// Prepare batch requests
const files = ['app.js', 'utils.js', 'api.js'];
const requests = files.map((file) => ({
  id: file,
  prompt: `Write tests for ${file}`,
  options: { maxTokens: 2000 },
}));

// Execute batch (parallel with concurrency limit)
const results = await helper.executeBatch(requests, {
  parallel: true,
  concurrency: 3,
});

// Process results
const successful = results.filter((r) => r.success);
const failed = results.filter((r) => !r.success);

console.log(`Success: ${successful.length}/${results.length}`);

for (const result of successful) {
  console.log(`\n=== Tests for ${result.id} ===`);
  console.log(result.response.content);
}

await helper.cleanup();
```

### Error Handling with Retries

```javascript
import { parseErrorResponse, shouldRetry } from './lib/ai_helpers.js';

const helper = new AiHelper({
  maxRetries: 5,
  baseDelay: 2000,
  maxDelay: 60000,
});

await helper.initialize();

try {
  const response = await helper.executeRequest(prompt);
  console.log('Success:', response.content);
} catch (error) {
  const errorInfo = parseErrorResponse(error);

  console.error('Request failed:', errorInfo.message);
  console.error('Error type:', errorInfo.type);
  console.error('Retryable:', errorInfo.retryable);

  if (errorInfo.type === 'rate_limit') {
    console.log('Rate limited - wait before retrying');
  } else if (errorInfo.type === 'authentication') {
    console.log('Authentication failed - check credentials');
  }
}
```

### Integration with Caching

```javascript
import { AiHelper } from './lib/ai_helpers.js';
import { AiCache, generateCacheKey } from './lib/ai_cache.js';

const helper = new AiHelper();
const cache = new AiCache({ ttl: 86400 });

await helper.initialize();
await cache.init();

async function getCachedResponse(prompt, context = '') {
  const cacheKey = generateCacheKey(prompt, context);

  // Try cache first
  const cached = await cache.get(cacheKey);
  if (cached) {
    console.log('Cache hit!');
    return cached;
  }

  // Cache miss - call AI
  console.log('Cache miss - calling AI');
  const response = await helper.executeRequest(prompt);

  // Cache the response
  await cache.set(cacheKey, response.content, { prompt, context });

  return response.content;
}

const result = await getCachedResponse('Write tests');
console.log(result);

await helper.cleanup();
```

---

## Error Handling

### Error Types

```javascript
// Network errors - retryable
{ type: 'network', message: '...', retryable: true }

// Rate limit errors - retryable
{ type: 'rate_limit', message: '...', retryable: true }

// Authentication errors - not retryable
{ type: 'authentication', message: '...', retryable: false }

// Unknown errors - may be retryable
{ type: 'unknown', message: '...', retryable: false }
```

### Retry Strategy

The helper implements exponential backoff for retryable errors:

1. Attempt 1: Immediate
2. Attempt 2: Wait 1s (baseDelay)
3. Attempt 3: Wait 2s
4. Attempt 4: Wait 4s
5. Attempt 5: Wait 8s

---

## Related Modules

- **[ai_cache](./ai_cache.md)** - Response caching
- **[ai_prompt_builder](./ai_prompt_builder.md)** - Prompt generation
- **[ai_validation](./ai_validation.md)** - Response validation
- **[ai_personas](./ai_personas.md)** - AI persona management

---

**Last Updated:** 2026-02-01  
**Part of:** AI Workflow Automation v1.2.0 (Phase 6 - AI Integration)
