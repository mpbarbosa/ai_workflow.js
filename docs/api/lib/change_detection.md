# change_detection.js

**Change Detection Module** - Intelligent file change analysis for workflow optimization

## Overview

The Change Detection module provides smart file categorization and impact analysis to optimize workflow execution. It determines which workflow steps to run based on what changed, enabling efficient CI/CD pipelines.

**Module:** `lib/change_detection`
**Version:** 2.3.0
**Architecture:** Referentially Transparent (Pure Functions + Impure Wrapper)

## Installation

```javascript
import { ChangeDetector, categorizeFile, analyzeChanges } from './src/lib/change_detection.js';
```

## Architecture

### v2.0.0 Pattern: Referential Transparency

This module follows the v2.0.0 architecture pattern:

- **Pure Functions (12 functions)**: Change categorization, impact analysis, pattern detection
  - Deterministic: Same input always produces same output
  - No side effects: No I/O or state mutation
  - Path-based logic: Uses file paths for categorization

- **Impure Wrapper (ChangeDetector class)**: Git integration, change detection
  - Integrates with GitAutomation
  - Caches analysis results
  - Provides workflow optimization decisions

## Pure Functions

### categorizeFile(filePath, projectKind)

Categorize a single file based on path and extension.

**Parameters:**

- `filePath` (string): File path to categorize
- `projectKind` (string): Project type context (default: 'generic')

**Returns:** String category: 'code', 'test', 'docs', 'config', 'asset', 'unknown'

**Example:**

```javascript
categorizeFile('src/app.js'); // 'code'
categorizeFile('test/app.test.js'); // 'test'
categorizeFile('README.md'); // 'docs'
categorizeFile('package.json'); // 'config'
categorizeFile('logo.png'); // 'asset'
```

**Category Rules:**

- **test**: Contains `.test.`, `.spec.`, `__tests__`, or in `test/` directory
- **docs**: `.md` extension or in `docs/` directory
- **config**: `.yaml`, `.json`, `.toml`, or starts with `.`
- **code**: `.js`, `.ts`, `.py`, `.java`, etc.
- **asset**: `.png`, `.css`, `.svg`, etc.

### analyzeChanges(files)

Analyze changes across multiple files.

**Parameters:**

- `files` (Array<Object>): File change objects with `file` and `status` properties

**Returns:** Object with categories, impact, summary

```javascript
{
  categories: {
    code: ['src/app.js', 'src/utils.js'],
    test: ['test/app.test.js'],
    docs: ['README.md'],
    config: ['package.json'],
    asset: [],
    unknown: []
  },
  impact: 'medium', // 'high', 'medium', 'low', 'none'
  summary: '2 code files, 1 test file, 1 doc changed'
}
```

**Example:**

```javascript
const files = [
  { file: 'src/app.js', status: 'modified' },
  { file: 'test/app.test.js', status: 'added' },
  { file: 'README.md', status: 'modified' },
];

const analysis = analyzeChanges(files);
console.log(analysis.impact); // 'medium'
console.log(analysis.summary); // '1 code file, 1 test file, 1 doc changed'
```

### calculateChangeImpact(categories)

Calculate overall impact level from categorized changes.

**Parameters:**

- `categories` (Object): Categorized file changes

**Returns:** String impact level: 'high', 'medium', 'low', 'none'

**Impact Rules:**

- **high**: >5 code files or >3 config files
- **medium**: Any code changes or >3 tests with config changes
- **low**: Only tests, docs, or assets
- **none**: No changes

**Example:**

```javascript
calculateChangeImpact({ code: ['a.js', 'b.js'] }); // 'medium'
calculateChangeImpact({ docs: ['README.md'] }); // 'low'
calculateChangeImpact({ code: Array(10).fill('x') }); // 'high'
```

### detectChangeType(diff)

Detect change type from diff content.

**Parameters:**

- `diff` (string): Git diff output

**Returns:** String change type: 'feature', 'bugfix', 'refactor', 'chore'

**Detection Rules:**

- **refactor**: Contains 'refactor:' or function renames
- **feature**: New functions/classes or 'feat:' prefix
- **bugfix**: Contains 'fix:', 'bug', 'fixed'
- **chore**: Default for unclear changes

**Example:**

```javascript
detectChangeType('feat: add new feature'); // 'feature'
detectChangeType('fix: resolve null pointer'); // 'bugfix'
detectChangeType('refactor: simplify logic'); // 'refactor'
```

### filterByCategory(files, category)

Filter files by specific category.

**Parameters:**

- `files` (Array<string>): File paths
- `category` (string): Category to filter by

**Returns:** Array of matching files

**Example:**

```javascript
const files = ['src/app.js', 'test/app.test.js', 'README.md'];
filterByCategory(files, 'code'); // ['src/app.js']
filterByCategory(files, 'test'); // ['test/app.test.js']
```

### groupByDirectory(files)

Group files by parent directory.

**Parameters:**

- `files` (Array<string>): File paths

**Returns:** Object with directory keys and file arrays

**Example:**

```javascript
const files = ['src/app.js', 'src/utils.js', 'test/app.test.js'];
const grouped = groupByDirectory(files);
// Returns: {
//   'src/': ['src/app.js', 'src/utils.js'],
//   'test/': ['test/app.test.js']
// }
```

### calculateCoverageImpact(changes)

Calculate test coverage impact from code changes.

**Parameters:**

- `changes` (Object): Categorized changes

**Returns:** Object with affected files and confidence

```javascript
{
  affected: ['src/app.js', 'src/utils.js'],
  confidence: 0.5 // 0.0 (no tests) to 1.0 (full coverage)
}
```

**Confidence Calculation:**

- Ratio of test files to code files
- 1.0 = Equal or more tests than code
- 0.0 = No tests for code changes

**Example:**

```javascript
calculateCoverageImpact({
  code: ['app.js', 'utils.js'],
  test: ['app.test.js'],
});
// Returns: { affected: ['app.js', 'utils.js'], confidence: 0.5 }
```

### identifyRelatedTests(codeFile, testPattern)

Identify potential test files for a code file.

**Parameters:**

- `codeFile` (string): Code file path
- `testPattern` (string): Test file pattern (default: '.test.js')

**Returns:** Array of potential test file paths

**Example:**

```javascript
identifyRelatedTests('src/app.js', '.test.js');
// Returns: [
//   'src/app.test.js',
//   'src/test/app.test.js',
//   'src/__tests__/app.test.js',
//   'test/src/app.test.js'
// ]
```

### buildChangeSummary(categories)

Build human-readable change summary.

**Parameters:**

- `categories` (Object): Categorized changes

**Returns:** String summary

**Example:**

```javascript
buildChangeSummary({
  code: ['a.js', 'b.js'],
  test: ['a.test.js'],
  docs: ['README.md'],
});
// Returns: '2 code files, 1 test file, 1 doc changed'
```

### shouldSkipStep(stepId, changes)

Determine if workflow step can be skipped.

**Parameters:**

- `stepId` (string): Workflow step identifier
- `changes` (Object): Categorized changes

**Returns:** Boolean (true if step can be skipped)

**Skip Rules:**
| Step | Skip When |
|------|-----------|
| run_tests | Only docs/assets changed |
| lint | Only docs changed |
| build | Only docs/tests changed |
| update_docs | No code changes |

**Example:**

```javascript
const changes = { docs: ['README.md'], code: [], test: [] };

shouldSkipStep('run_tests', changes); // true (no code/test)
shouldSkipStep('lint', changes); // true (no code)
shouldSkipStep('build', changes); // true (no code)
shouldSkipStep('update_docs', changes); // true (no code)
```

### mergeChangeAnalysis(analysis1, analysis2)

Merge two change analysis objects.

**Parameters:**

- `analysis1` (Object): First analysis
- `analysis2` (Object): Second analysis

**Returns:** Merged analysis with combined categories and higher impact

**Example:**

```javascript
const a1 = {
  categories: { code: ['a.js'] },
  impact: 'low',
};
const a2 = {
  categories: { code: ['b.js'], test: ['a.test.js'] },
  impact: 'medium',
};

const merged = mergeChangeAnalysis(a1, a2);
// Returns: {
//   categories: { code: ['a.js', 'b.js'], test: ['a.test.js'] },
//   impact: 'medium',
//   summary: '2 code files, 1 test file changed'
// }
```

### validateChangeData(data)

Validate change detection data structure.

**Parameters:**

- `data` (Object): Change data to validate

**Returns:** Validation result

```javascript
{
  valid: true,
  errors: []
}
```

**Example:**

```javascript
const result = validateChangeData({
  categories: { code: ['a.js'], test: [] },
  impact: 'medium',
});

if (!result.valid) {
  console.error('Invalid data:', result.errors);
}
```

## ChangeDetector Class

Wrapper class for detecting and analyzing file changes with Git integration.

### Constructor

```javascript
new ChangeDetector(options);
```

**Parameters:**

- `options.gitAutomation` (GitAutomation): Git automation instance
- `options.projectKind` (string): Project type (default: 'generic')
- `options.cache` (GitCache): Optional cache instance

**Example:**

```javascript
const detector = new ChangeDetector({
  gitAutomation: git,
  projectKind: 'nodejs_api',
});
```

### Methods

#### detectChanges(sinceCommit)

Detect changes since specified commit or tag.

**Parameters:**

- `sinceCommit` (string): Commit hash or tag (default: 'HEAD')

**Returns:** Promise<Object> Change analysis

**Example:**

```javascript
const changes = await detector.detectChanges();
console.log(changes.summary);
console.log(`Impact: ${changes.impact}`);
```

#### analyzeImpact()

Analyze impact of current changes.

**Returns:** Promise<Object> Impact analysis

```javascript
{
  level: 'medium',
  coverage: { affected: [...], confidence: 0.8 },
  shouldRunTests: true,
  shouldUpdateDocs: true
}
```

**Example:**

```javascript
const impact = await detector.analyzeImpact();
if (impact.shouldRunTests) {
  await runTests();
}
```

#### getAffectedSteps()

Get workflow steps that should execute based on changes.

**Returns:** Promise<Array<string>> Step IDs to execute

**Example:**

```javascript
const steps = await detector.getAffectedSteps();
// Returns: ['validate_config', 'lint', 'run_tests', 'build']

for (const stepId of steps) {
  await executeStep(stepId);
}
```

#### categorizeChanges()

Categorize all changed files.

**Returns:** Promise<Object> Categorized files

**Example:**

```javascript
const categories = await detector.categorizeChanges();
console.log(`Code files: ${categories.code.length}`);
console.log(`Test files: ${categories.test.length}`);
```

#### getChangesSummary()

Get formatted change summary.

**Returns:** Promise<string> Summary text

**Example:**

```javascript
const summary = await detector.getChangesSummary();
console.log(summary); // '3 code files, 2 test files changed'
```

#### shouldRunTests()

Determine if tests should run based on changes.

**Returns:** Promise<boolean>

**Example:**

```javascript
if (await detector.shouldRunTests()) {
  await runTestSuite();
} else {
  console.log('Skipping tests (only docs changed)');
}
```

#### shouldUpdateDocs()

Determine if documentation should be updated.

**Returns:** Promise<boolean>

**Example:**

```javascript
if (await detector.shouldUpdateDocs()) {
  await generateDocs();
}
```

## Usage Examples

### Basic Change Detection

```javascript
import { ChangeDetector } from './src/lib/change_detection.js';
import { GitAutomation } from './src/lib/git_automation.js';

const git = new GitAutomation();
const detector = new ChangeDetector({ gitAutomation: git });

// Detect changes
const changes = await detector.detectChanges();
console.log(changes.summary);
console.log(`Impact level: ${changes.impact}`);
```

### Optimize CI/CD Pipeline

```javascript
// Detect what changed
const changes = await detector.detectChanges();

// Get steps that need to run
const steps = await detector.getAffectedSteps();

// Execute only necessary steps
for (const stepId of steps) {
  console.log(`Running: ${stepId}`);
  await executeWorkflowStep(stepId);
}

// Skip unnecessary steps
console.log('Skipped steps that are not affected by changes');
```

### Conditional Test Execution

```javascript
if (await detector.shouldRunTests()) {
  console.log('Running tests (code or test files changed)');
  await runTests();
} else {
  console.log('Skipping tests (only docs/assets changed)');
}
```

### Impact-Based Notifications

```javascript
const impact = await detector.analyzeImpact();

if (impact.level === 'high') {
  await notifyTeam({
    message: 'High-impact changes detected',
    details: await detector.getChangesSummary(),
  });
}
```

### Coverage Analysis

```javascript
const impact = await detector.analyzeImpact();
const coverage = impact.coverage;

console.log(`Affected files: ${coverage.affected.length}`);
console.log(`Test confidence: ${(coverage.confidence * 100).toFixed(0)}%`);

if (coverage.confidence < 0.8) {
  console.warn('Low test coverage for changes!');
}
```

### Category-Based Actions

```javascript
const categories = await detector.categorizeChanges();

if (categories.code.length > 0) {
  await runLinter(categories.code);
}

if (categories.test.length > 0) {
  await runTestSuite();
}

if (categories.docs.length > 0) {
  await validateDocs(categories.docs);
}
```

## Workflow Integration

### Smart CI Pipeline

```yaml
# .github/workflows/ci.yml
steps:
  - name: Detect Changes
    run: node detect-changes.js

  - name: Run Tests
    if: steps.detect.outputs.shouldRunTests == 'true'
    run: npm test

  - name: Build
    if: steps.detect.outputs.shouldBuild == 'true'
    run: npm run build
```

### Example detect-changes.js

```javascript
const detector = new ChangeDetector({ gitAutomation: git });
const impact = await detector.analyzeImpact();

// Set GitHub Actions outputs
console.log(`::set-output name=shouldRunTests::${impact.shouldRunTests}`);
console.log(`::set-output name=shouldUpdateDocs::${impact.shouldUpdateDocs}`);
```

## Performance Considerations

- **Fast categorization**: Path-based logic, no file reading
- **Caching**: Uses last analysis, no repeated Git calls
- **Parallel analysis**: Safe to analyze multiple commits concurrently
- **Memory efficient**: Only stores file paths and metadata

## Related Modules

- **git_automation.js**: Provides Git status and diff data
- **git_cache.js**: Caches Git operations for performance
- **auto_commit.js**: Uses change detection for smart commits

## Version History

- **2.0.0** (2026-02-07): Initial implementation
  - 12 pure functions for change analysis
  - ChangeDetector class with 8 methods
  - Smart workflow step skipping
  - Test coverage impact analysis
  - 68 passing tests with 100% coverage

---

**Last Updated:** 2026-02-07
**Maintainer:** ai_workflow.js team
