# step_00_analyze.js API Documentation

**Module:** `steps/step_00_analyze`
**Version:** 2.3.0
**Architecture:** Pure functions + Wrapper class (Referential Transparency)

## Overview

Step 0 provides pre-analysis of the project before workflow execution. It analyzes git state, detects project kind and tech stack, classifies file changes, determines change scope, and validates test infrastructure.

**Key Features:**

- Git state analysis and change detection
- Project kind detection (nodejs_api, react_spa, python_app, etc.)
- Tech stack identification (languages, frameworks, tools)
- File classification (documentation, test, source, config)
- Change scope determination (documentation-only, full-stack, etc.)
- Test infrastructure validation

## Installation

```javascript
import {
  Step0Analyzer,
  classifyFile,
  classifyFiles,
  determineChangeScope,
  validateTestInfrastructure,
  CHANGE_SCOPE,
  FILE_CATEGORY,
} from 'ai-workflow';
```

## Architecture Pattern

### Pure Functions (Exported for Testing)

```javascript
// File classification
export function classifyFile(filePath);
export function classifyFiles(files);

// Change scope detection
export function determineChangeScope(counts, totalModified);

// Test validation
export function validateTestInfrastructure(projectData, techStack);
```

### Impure Wrapper

```javascript
export class Step0Analyzer {
  // Handles side effects: Git operations, file I/O, project detection, logging
  async execute(options);
}
```

## API Reference

### Constants

#### `CHANGE_SCOPE`

Change scope classifications:

```javascript
export const CHANGE_SCOPE = {
  DOCUMENTATION_ONLY: 'documentation-only',
  TESTS_ONLY: 'tests-only',
  SOURCE_CODE: 'source-code',
  CONFIGURATION: 'configuration',
  FULL_STACK: 'full-stack',
  CODE_AND_TESTS: 'code-and-tests',
  CODE_AND_DOCS: 'code-and-docs',
  MIXED_CHANGES: 'mixed-changes',
  NO_CHANGES: 'no-changes',
};
```

#### `FILE_CATEGORY`

File category classifications:

```javascript
export const FILE_CATEGORY = {
  DOCUMENTATION: 'documentation',
  TEST: 'test',
  SOURCE: 'source',
  CONFIG: 'config',
  WORKFLOW_ARTIFACT: 'workflow_artifact',
};
```

### Pure Functions

#### `classifyFile(filePath)`

Classify a file by category based on path and extension.

**Parameters:**

- `filePath` (string) - File path to classify

**Returns:** (string) Category from FILE_CATEGORY

**Example:**

```javascript
const category1 = classifyFile('docs/README.md');
// Returns: 'documentation'

const category2 = classifyFile('test/unit/utils.test.js');
// Returns: 'test'

const category3 = classifyFile('src/lib/config.js');
// Returns: 'source'

const category4 = classifyFile('.ai_workflow/logs/step_01.log');
// Returns: 'workflow_artifact'
```

**Logic:**

- Workflow artifacts: `.ai_workflow/`, `src/workflow/` subdirectories
- Documentation: `docs/`, `README.md`, `CHANGELOG.md`, `*.md`
- Tests: `test/`, `tests/`, `*test.*`, `*.test.*`, `*.spec.*`
- Config: `*.yaml`, `*.yml`, `*.json`, `*.toml`, `*.ini`, `*.conf`
- Source: `src/`, `lib/`, or code file extensions

#### `classifyFiles(files)`

Classify multiple files and count by category.

**Parameters:**

- `files` (Array<string>) - List of file paths

**Returns:** (Object) Classification result

- `counts` (Object) - Count by category
- `categorizedFiles` (Object) - Arrays of files by category

**Example:**

```javascript
const files = ['docs/README.md', 'src/lib/config.js', 'test/unit/config.test.js', 'package.json'];

const result = classifyFiles(files);
// Returns: {
//   counts: {
//     documentation: 1,
//     test: 1,
//     source: 1,
//     config: 1,
//     workflow_artifact: 0
//   },
//   categorizedFiles: {
//     documentation: ['docs/README.md'],
//     test: ['test/unit/config.test.js'],
//     source: ['src/lib/config.js'],
//     config: ['package.json'],
//     workflow_artifact: []
//   }
// }
```

#### `determineChangeScope(counts, totalModified)`

Determine change scope based on file counts.

**Parameters:**

- `counts` (Object) - File counts by category
- `totalModified` (number) - Total modified files

**Returns:** (string) Change scope from CHANGE_SCOPE

**Example:**

```javascript
const scope1 = determineChangeScope(
  {
    documentation: 5,
    test: 0,
    source: 0,
    config: 0,
  },
  5
);
// Returns: 'documentation-only'

const scope2 = determineChangeScope(
  {
    documentation: 2,
    test: 3,
    source: 5,
    config: 1,
  },
  11
);
// Returns: 'full-stack'

const scope3 = determineChangeScope(
  {
    documentation: 0,
    test: 10,
    source: 0,
    config: 0,
  },
  10
);
// Returns: 'tests-only'
```

**Logic:**

- NO_CHANGES: totalModified === 0
- DOCUMENTATION_ONLY: Only documentation files changed
- TESTS_ONLY: Only test files changed
- SOURCE_CODE: Only source files changed
- CONFIGURATION: Only config files changed
- CODE_AND_TESTS: Source + test files only
- CODE_AND_DOCS: Source + documentation only
- FULL_STACK: 3+ categories with changes
- MIXED_CHANGES: Default for complex cases

#### `validateTestInfrastructure(projectData, techStack)`

Validate test infrastructure exists for the project.

**Parameters:**

- `projectData` (Object) - Project metadata
  - `projectData.projectKind` (string) - Project type
  - `projectData.primaryLanguage` (string) - Primary language
- `techStack` (Object) - Tech stack information
  - `techStack.testFrameworks` (Array<string>) - Detected test frameworks

**Returns:** (Object) Validation result

- `hasTests` (boolean) - True if test infrastructure exists
- `testFramework` (string|null) - Detected test framework name
- `recommendations` (Array<string>) - Setup recommendations if missing

**Example:**

```javascript
const result1 = validateTestInfrastructure(
  { projectKind: 'nodejs_api', primaryLanguage: 'javascript' },
  { testFrameworks: ['jest'] }
);
// Returns: {
//   hasTests: true,
//   testFramework: 'jest',
//   recommendations: []
// }

const result2 = validateTestInfrastructure(
  { projectKind: 'python_app', primaryLanguage: 'python' },
  { testFrameworks: [] }
);
// Returns: {
//   hasTests: false,
//   testFramework: null,
//   recommendations: [
//     'Install pytest: pip install pytest',
//     'Create test/ directory',
//     'Add test files: test_*.py'
//   ]
// }
```

### Wrapper Class

#### `Step0Analyzer`

Impure wrapper class that handles I/O operations and coordinates analysis.

**Constructor:**

```javascript
constructor((options = {}));
```

**Options:**

- `gitAutomation` (GitAutomation) - Git operations instance
- `projectDetector` (ProjectKindDetector) - Project detection instance
- `techStackDetector` (TechStackDetector) - Tech stack detection instance
- `logger` (Logger) - Logger instance

**Methods:**

##### `async execute(options = {})`

Execute pre-analysis workflow step.

**Parameters:**

- `options` (Object) - Execution options
  - `options.projectRoot` (string) - Project root directory (default: `process.cwd()`)
  - `options.skipGitValidation` (boolean) - Skip git repository validation (default: `false`)
  - `options.includeArtifacts` (boolean) - Include workflow artifacts in analysis (default: `false`)

**Returns:** (Promise<Object>) Analysis result

- `success` (boolean) - True if analysis completed successfully
- `projectKind` (string) - Detected project kind
- `primaryLanguage` (string) - Primary programming language
- `techStack` (Object) - Tech stack details
- `changeScope` (string) - Determined change scope
- `modifiedFiles` (Array<string>) - List of modified files
- `classification` (Object) - File classification results
- `testInfrastructure` (Object) - Test validation results
- `gitStatus` (Object) - Git repository status

**Example:**

```javascript
const analyzer = new Step0Analyzer();

const result = await analyzer.execute({
  projectRoot: '/path/to/project',
  skipGitValidation: false,
});

console.log(result);
// {
//   success: true,
//   projectKind: 'nodejs_api',
//   primaryLanguage: 'javascript',
//   techStack: {
//     languages: ['javascript'],
//     frameworks: ['express', 'jest'],
//     testFrameworks: ['jest']
//   },
//   changeScope: 'code-and-tests',
//   modifiedFiles: [
//     'src/lib/config.js',
//     'test/unit/config.test.js'
//   ],
//   classification: {
//     counts: { source: 1, test: 1, ... },
//     categorizedFiles: { ... }
//   },
//   testInfrastructure: {
//     hasTests: true,
//     testFramework: 'jest'
//   },
//   gitStatus: {
//     branch: 'feature/new-config',
//     modified: 2,
//     ...
//   }
// }
```

## Usage Examples

### Basic Analysis

```javascript
import { Step0Analyzer } from 'ai-workflow';

const analyzer = new Step0Analyzer();
const result = await analyzer.execute();

if (result.success) {
  console.log(`Project Type: ${result.projectKind}`);
  console.log(`Change Scope: ${result.changeScope}`);
  console.log(`Modified Files: ${result.modifiedFiles.length}`);
}
```

### Custom Configuration

```javascript
import { Step0Analyzer } from 'ai-workflow';
import { GitAutomation } from 'ai-workflow';

const gitOps = new GitAutomation({ repoPath: '/custom/path' });
const analyzer = new Step0Analyzer({ gitAutomation: gitOps });

const result = await analyzer.execute({
  skipGitValidation: true,
  includeArtifacts: false,
});
```

### Pure Function Testing

```javascript
import { classifyFiles, determineChangeScope } from 'ai-workflow';

// Test file classification
const files = ['src/app.js', 'test/app.test.js', 'README.md'];
const { counts } = classifyFiles(files);
// counts: { source: 1, test: 1, documentation: 1, ... }

// Test scope determination
const scope = determineChangeScope(counts, 3);
// scope: 'code-and-docs'
```

## Error Handling

### Common Errors

**NotGitRepositoryError:**

```javascript
try {
  const result = await analyzer.execute();
} catch (err) {
  if (err.code === 'NOT_GIT_REPOSITORY') {
    console.error('Not a git repository');
    // Initialize git repository or use skipGitValidation option
  }
}
```

**ProjectDetectionError:**

```javascript
try {
  const result = await analyzer.execute();
} catch (err) {
  if (err.code === 'PROJECT_DETECTION_FAILED') {
    console.error('Could not detect project kind');
    // Manually specify project kind in configuration
  }
}
```

## Testing Considerations

### Pure Function Tests

```javascript
describe('classifyFile', () => {
  test('classifies documentation files', () => {
    expect(classifyFile('docs/guide.md')).toBe('documentation');
    expect(classifyFile('README.md')).toBe('documentation');
  });

  test('classifies test files', () => {
    expect(classifyFile('test/unit.test.js')).toBe('test');
    expect(classifyFile('src/__tests__/app.spec.ts')).toBe('test');
  });
});
```

### Integration Tests

```javascript
describe('Step0Analyzer', () => {
  test('analyzes project successfully', async () => {
    const analyzer = new Step0Analyzer();
    const result = await analyzer.execute({
      projectRoot: testProjectPath,
    });

    expect(result.success).toBe(true);
    expect(result.projectKind).toBeDefined();
    expect(result.changeScope).toBeDefined();
  });
});
```

## Related Modules

- **GitAutomation** (`lib/git_automation`) - Git operations
- **ProjectKindDetector** (`lib/project_kind_detection`) - Project detection
- **TechStackDetector** (`lib/tech_stack`) - Tech stack analysis
- **ChangeDetector** (`lib/change_detection`) - File change detection
- **Step1DocumentationAnalyzer** (`steps/step_01_documentation`) - Next step

## Performance Considerations

- Git operations are cached to avoid repeated calls
- File classification uses regex patterns (O(n) complexity)
- Project detection reads minimal files for speed
- Tech stack detection scans package files only

## Migration Notes

**From ai_workflow v3.2.7:**

- Migrated from `step_00_analyze.sh`
- Extracted pure functions for classification logic
- Improved error handling and validation
- Added comprehensive test infrastructure validation
- Enhanced change scope detection with 9 categories

---

**Last Updated:** 2026-02-11
**Status:** Complete
**Test Coverage:** 100%
**Source:** `src/steps/step_00_analyze.js`
