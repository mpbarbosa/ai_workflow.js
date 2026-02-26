import { calculateConfidenceScore, analyzeContentQuality, validateJsonSchema } from './src/lib/ai_validation.js';

console.log('=== Testing Edge Cases ===\n');

// Test 1: Negative response length
console.log('Test 1: Negative response length');
const result1 = calculateConfidenceScore({
  responseLength: -100,
  expectedSections: 3,
  foundSections: 3,
  qualityIndicators: 5,
  errorCount: 0,
  warningCount: 0,
});
console.log('Result:', result1, '\n');

// Test 2: foundSections > expectedSections when expected is 0
console.log('Test 2: foundSections > expectedSections (0)');
const result2 = calculateConfidenceScore({
  responseLength: 1000,
  expectedSections: 0,
  foundSections: 5,
  qualityIndicators: 5,
  errorCount: 0,
  warningCount: 0,
});
console.log('Result:', result2, '\n');

// Test 3: Very large numbers
console.log('Test 3: Very large numbers');
const result3 = calculateConfidenceScore({
  responseLength: Number.MAX_SAFE_INTEGER,
  expectedSections: 3,
  foundSections: 999999,
  qualityIndicators: 999999,
  errorCount: 0,
  warningCount: 0,
});
console.log('Result:', result3, '\n');

// Test 4: validateJsonSchema with non-object data types
console.log('Test 4: validateJsonSchema with non-object types');
const result4a = validateJsonSchema("string", { required: ['field'] });
console.log('String with required field:', result4a);
const result4b = validateJsonSchema(123, { properties: { num: { type: 'number' } } });
console.log('Number:', result4b);

// Test 5: Custom weights not summing to 1.0
console.log('\nTest 5: Custom weights summing to 2.0');
const result5 = calculateConfidenceScore(
  {
    responseLength: 500,
    expectedSections: 2,
    foundSections: 2,
    qualityIndicators: 5,
    errorCount: 0,
    warningCount: 0,
  },
  {
    lengthWeight: 0.5,
    completenessWeight: 0.5,
    qualityWeight: 0.5,
    errorWeight: 0.5,
  }
);
console.log('Result (should be capped at 100):', result5, '\n');

// Test 6: Negative error/warning counts
console.log('Test 6: Negative error/warning counts');
const result6 = calculateConfidenceScore({
  responseLength: 1000,
  expectedSections: 3,
  foundSections: 3,
  qualityIndicators: 5,
  errorCount: -5,
  warningCount: -10,
});
console.log('Result:', result6);
