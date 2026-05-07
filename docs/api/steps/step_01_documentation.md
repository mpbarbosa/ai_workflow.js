# step_01_documentation.js API Documentation

**Module:** `steps/step_01_documentation`
**Version:** 2.4.0
**Architecture:** Pure functions + Wrapper class (Referential Transparency)

## Overview

Step 1 provides AI-powered documentation validation and updates with optimized incremental and parallel processing. It detects code changes, classifies files, validates documentation consistency, and generates AI-assisted documentation improvements.

**Key Features:**

- Incremental processing (skip unchanged documentation)
- Parallel validation for multiple documents
- Git integration for change detection
- AI-powered consistency checking
- Configurable execution strategies

## Installation

```javascript
import {
  Step1DocumentationAnalyzer,
  validateDocumentationCounts,
  checkVersionReferences,
  classifyChangedFiles,
  shouldRunAiAnalysis,
} from 'ai-workflow';
```

## Architecture Pattern

### Pure Functions (Exported for Testing)

```javascript
// Validation logic
export function validateDocumentationCounts(counts);
export function checkVersionReferences(content, expectedVersion);
export function classifyChangedFiles(changedFiles);
export function shouldRunAiAnalysis(classification, options);
```

### Impure Wrapper

```javascript
export class Step1DocumentationAnalyzer {
  // Handles side effects: Git operations, file I/O, AI API calls, logging
}
```

## API Reference

### Pure Functions

#### `validateDocumentationCounts(counts)`

Validate documentation file counts to ensure minimum requirements.

**Parameters:**

- `counts` (Object) - File counts by type
  - `counts.markdown` (number) - Count of markdown files
  - `counts.readme` (number) - Count of README files
  - `counts.docs` (number) - Count of docs directory files

**Returns:** (Object) Validation result

- `success` (boolean) - True if validation passes
- `issues` (string[]) - Array of validation issues
- `counts` (Object) - Original counts object

**Example:**

```javascript
const counts = {
  markdown: 15,
  readme: 1,
  docs: 10,
};

const result = validateDocumentationCounts(counts);
// Returns: { success: true, issues: [], counts: {...} }

// Invalid case
const badCounts = { markdown: 0, readme: 0, docs: 0 };
const badResult = validateDocumentationCounts(badCounts);
// Returns: {
//   success: false,
//   issues: ['No documentation files found', 'No README file found in project root'],
//   counts: {...}
// }
```

#### `checkVersionReferences(content, expectedVersion)`

Check for version references in content and detect mismatches.

**Parameters:**

- `content` (string) - File content to check
- `expectedVersion` (string) - Expected version string (e.g., "1.2.0")

**Returns:** (Object) Check result

- `found` (string[]) - All unique versions found
- `mismatches` (string[]) - Versions that don't match expected
- `hasMismatches` (boolean) - True if mismatches exist

**Example:**

```javascript
const content = `
  Version 1.2.0 is current.
  Previously we had v1.1.5.
  Target: 1.2.0
`;

const result = checkVersionReferences(content, '1.2.0');
// Returns: {
//   found: ['1.2.0', 'v1.1.5'],
//   mismatches: ['v1.1.5'],
//   hasMismatches: true
// }
```

#### `classifyChangedFiles(changedFiles)`

Classify changed files into categories for documentation impact analysis.

**Parameters:**

- `changedFiles` (string[]) - List of changed file paths

**Returns:** (Object) Classification result

- `documentation` (string[]) - Documentation files (_.md, docs/_)
- `source` (string[]) - Source code files (_.js, _.mjs)
- `tests` (string[]) - Test files (_.test.js, test/_)
- `config` (string[]) - Configuration files (_.json, _.yaml, config/\*)
- `counts` (Object) - Count of files in each category
  - `documentation` (number)
  - `source` (number)
  - `tests` (number)
  - `config` (number)
  - `total` (number)

**Example:**

```javascript
const changedFiles = [
  'src/lib/config.js',
  'docs/api/config.md',
  'test/lib/config.test.js',
  'package.json',
];

const classification = classifyChangedFiles(changedFiles);
// Returns: {
//   documentation: ['docs/api/config.md'],
//   source: ['src/lib/config.js'],
//   tests: ['test/lib/config.test.js'],
//   config: ['package.json'],
//   counts: {
//     documentation: 1,
//     source: 1,
//     tests: 1,
//     config: 1,
//     total: 4
//   }
// }
```

#### `shouldRunAiAnalysis(classification, options)`

Determine if AI analysis should run based on file classification.

**Parameters:**

- `classification` (Object) - File classification from `classifyChangedFiles()`
- `options` (Object) - Configuration options
  - `skipDocsOnly` (boolean) - Skip if only documentation changed (default: false)
  - `requireSource` (boolean) - Require source code changes (default: false)

**Returns:** (boolean) True if AI analysis should run

**Example:**

```javascript
const classification = {
  documentation: ['README.md'],
  source: [],
  tests: [],
  config: [],
  counts: { documentation: 1, source: 0, tests: 0, config: 0, total: 1 },
};

// Run for docs-only changes
const shouldRun1 = shouldRunAiAnalysis(classification);
// Returns: true

// Skip docs-only changes
const shouldRun2 = shouldRunAiAnalysis(classification, { skipDocsOnly: true });
// Returns: false

// Require source changes
const shouldRun3 = shouldRunAiAnalysis(classification, { requireSource: true });
// Returns: false
```

### Step1DocumentationAnalyzer Class

#### Constructor

```javascript
new Step1DocumentationAnalyzer(options);
```

**Parameters:**

- `options` (Object) - Configuration options
  - `gitOps` (GitAutomation) - Git operations handler (default: new instance)
  - `fileOps` (FileOperations) - File operations handler (default: new instance)
  - `backlog` (Backlog) - Backlog manager (default: new instance)
  - `aiCache` (AiCache) - AI response cache (default: new instance)
  - `promptBuilder` (PromptBuilder) - Prompt builder (default: new instance)
  - `aiHelper` (AiHelper) - AI helper utilities (default: new instance)
  - `incrementalProcessor` (Step1IncrementalProcessor) - Incremental processor (default: new instance)
  - `parallelProcessor` (Step1ParallelProcessor) - Parallel processor (default: new instance)

**Example:**

```javascript
const analyzer = new Step1DocumentationAnalyzer({
  enableIncremental: true,
  enableParallel: true,
  maxConcurrency: 4,
});
```

#### `execute(projectRoot, options)`

Execute Step 1 documentation analysis with AI assistance.

**Parameters:**

- `projectRoot` (string) - Project root directory path
- `options` (Object) - Execution options
  - `enableIncremental` (boolean) - Enable incremental processing (default: true)
  - `enableParallel` (boolean) - Enable parallel validation (default: true)
  - `parallelStrategy` (string) - Execution strategy: 'SEQUENTIAL', 'PARALLEL', 'PRIORITY_BASED', 'BALANCED' (default: 'BALANCED')
  - `maxConcurrency` (number) - Maximum parallel tasks (default: 4)
  - `skipDocsOnly` (boolean) - Skip if only docs changed (default: false)
  - `requireSource` (boolean) - Require source changes (default: false)

**Returns:** (Promise<Object>) Analysis result

- `success` (boolean) - True if execution succeeded
- `skipped` (boolean) - True if skipped (no changes, not needed, etc.)
- `reason` (string) - Skip reason: 'no_changes', 'not_needed', 'docs_unchanged'
- `classification` (Object) - File classification (if not skipped)
- `validationResult` (Object) - Validation results (if not skipped)
- `analysisResult` (Object) - AI analysis results (if not skipped)
- `stats` (Object) - Execution statistics

**Example:**

```javascript
const analyzer = new Step1DocumentationAnalyzer();

// Basic execution
const result1 = await analyzer.execute('/path/to/project');

// With custom options
const result2 = await analyzer.execute('/path/to/project', {
  enableIncremental: true,
  enableParallel: true,
  parallelStrategy: 'BALANCED',
  maxConcurrency: 8,
  skipDocsOnly: false,
});

// Result structure
if (result2.success && !result2.skipped) {
  console.log(`Processed ${result2.classification.counts.documentation} docs`);
  console.log(`Validation: ${result2.validationResult.issuesFound} issues`);
  console.log(`Analysis completed in ${result2.stats.totalTime}ms`);
}
```

#### `runValidation(projectRoot, docsToProcess)`

Run documentation consistency validation.

**Parameters:**

- `projectRoot` (string) - Project root directory
- `docsToProcess` (string[]) - List of documentation files to validate

**Returns:** (Promise<Object>) Validation result

- `success` (boolean) - True if validation succeeded
- `issuesFound` (number) - Count of issues found
- `issues` (Object[]) - Array of issue objects
- `summary` (string) - Validation summary

**Example:**

```javascript
const analyzer = new Step1DocumentationAnalyzer();
const docs = ['README.md', 'docs/API.md'];
const result = await analyzer.runValidation('/path/to/project', docs);
```

#### `formatBacklogContent(classification, validationResult, analysisResult)`

Format backlog content for Step 1 summary.

**Parameters:**

- `classification` (Object) - File classification
- `validationResult` (Object) - Validation results
- `analysisResult` (Object) - AI analysis results

**Returns:** (string) Formatted markdown content

**Example:**

```javascript
const content = analyzer.formatBacklogContent(classification, validationResult, analysisResult);
// Returns formatted markdown summary
```

## Workflow Integration

### Standard Execution

```javascript
import { Step1DocumentationAnalyzer } from 'ai-workflow';

const analyzer = new Step1DocumentationAnalyzer();
const result = await analyzer.execute('/path/to/project', {
  enableIncremental: true,
  enableParallel: true,
  parallelStrategy: 'BALANCED',
  maxConcurrency: 4,
});

if (result.success) {
  console.log('Documentation analysis completed');
  if (result.skipped) {
    console.log(`Skipped: ${result.reason}`);
  } else {
    console.log(`Processed ${result.classification.counts.total} files`);
  }
}
```

### Custom Configuration

```javascript
import { Step1DocumentationAnalyzer } from 'ai-workflow';
import { GitAutomation } from 'ai-workflow';
import { AiCache } from 'ai-workflow';

// Custom dependencies
const gitOps = new GitAutomation({ fetchDepth: 100 });
const aiCache = new AiCache({ ttl: 7200000 }); // 2 hours

const analyzer = new Step1DocumentationAnalyzer({
  gitOps,
  aiCache,
});

const result = await analyzer.execute('/path/to/project', {
  skipDocsOnly: true, // Skip if only docs changed
  requireSource: true, // Require source code changes
  maxConcurrency: 8, // Higher parallelism
});
```

## Performance Optimization

### Incremental Processing

Incremental mode skips unchanged documentation files:

```javascript
const result = await analyzer.execute('/path/to/project', {
  enableIncremental: true, // Default: true
});

// Logs: "Incremental: 12 docs unchanged (skipped)"
```

### Parallel Execution

Parallel mode processes multiple documents concurrently:

```javascript
const result = await analyzer.execute('/path/to/project', {
  enableParallel: true,
  parallelStrategy: 'BALANCED', // Optimal strategy
  maxConcurrency: 4, // Adjust based on CPU/memory
});
```

### Execution Strategies

- **SEQUENTIAL**: Process one at a time (safest, slowest)
- **PARALLEL**: Process all concurrently (fastest, highest resource usage)
- **PRIORITY_BASED**: High-priority docs first, then parallel
- **BALANCED**: Adaptive parallelism based on load (recommended)

## Error Handling

```javascript
import { Step1DocumentationAnalyzer } from 'ai-workflow';
import { WorkflowError } from 'ai-workflow';

const analyzer = new Step1DocumentationAnalyzer();

try {
  const result = await analyzer.execute('/path/to/project');

  if (!result.success) {
    console.error('Step 1 failed:', result.error);
  }
} catch (error) {
  if (error instanceof WorkflowError) {
    console.error('Workflow error:', error.message);
    console.error('Code:', error.code);
  } else {
    console.error('Unexpected error:', error);
  }
}
```

## Testing

### Testing Pure Functions

```javascript
import { classifyChangedFiles, shouldRunAiAnalysis } from 'ai-workflow';

describe('Pure Functions', () => {
  test('classifyChangedFiles', () => {
    const files = ['src/lib/config.js', 'docs/API.md'];
    const classification = classifyChangedFiles(files);

    expect(classification.source).toContain('src/lib/config.js');
    expect(classification.documentation).toContain('docs/API.md');
    expect(classification.counts.total).toBe(2);
  });

  test('shouldRunAiAnalysis', () => {
    const classification = {
      counts: { total: 1, source: 0, documentation: 1 },
    };

    expect(shouldRunAiAnalysis(classification)).toBe(true);
    expect(shouldRunAiAnalysis(classification, { skipDocsOnly: true })).toBe(false);
  });
});
```

### Testing Integration

```javascript
import { Step1DocumentationAnalyzer } from 'ai-workflow';

describe('Step1DocumentationAnalyzer Integration', () => {
  test('execute with no changes', async () => {
    const analyzer = new Step1DocumentationAnalyzer();
    const result = await analyzer.execute('/path/to/project');

    expect(result.success).toBe(true);
    if (result.skipped) {
      expect(result.reason).toBe('no_changes');
    }
  });
});
```

## Dependencies

- `core/logger` - Colored logging
- `lib/git_automation` - Git operations
- `lib/ai_cache` - AI response caching
- `lib/ai_prompt_builder` - Prompt generation
- `lib/ai_helpers` - AI utilities
- `lib/backlog` - Backlog management
- `lib/step1_incremental` - Incremental processing
- `lib/step1_parallel` - Parallel processing
- `lib/file_operations` - File operations

## See Also

- [Step 1 Incremental Processing](../lib/step1_incremental.md)
- [Step 1 Parallel Processing](../lib/step1_parallel.md)
- [Git Automation](../lib/git_automation.md)
- [AI Cache](../lib/ai_cache.md)
- [Workflow Engine](../orchestrator/workflow_engine.md)

---

**Last Updated:** 2026-02-11
**Module Version:** 2.0.0
**Documentation Version:** 1.0.0
