# Third-Party Exclusion API

**Module:** `lib/third_party_exclusion`
**Version:** 1.9.6
**Architecture:** Pure Functions + Wrapper Class

## Overview

The Third-Party Exclusion module filters third-party files and directories from workflow analysis. It provides smart exclusion patterns based on project type, .gitignore parsing, and custom patterns to focus analysis on first-party code.

### Key Features

- **Project-Specific Patterns**: Default exclusions for 8 project kinds
- **Gitignore Integration**: Parses and applies .gitignore patterns
- **Pattern Matching**: Glob-like pattern matching for files
- **Pattern Merging**: Combines multiple pattern sources
- **Exclusion Reports**: Generate filtered file lists with statistics
- **Common Exclusions**: node_modules, .git, dist, build, venv, **pycache**, etc.

### Common Exclusions

**Version Control:**

- `.git/**`, `.svn/**`, `.hg/**`

**Dependencies:**

- `node_modules/**` (Node.js)
- `venv/**`, `__pycache__/**` (Python)

**Build Outputs:**

- `dist/**`, `build/**`, `out/**`
- `*.min.js`, `*.bundle.js`

**IDE/Editor:**

- `.vscode/**`, `.idea/**`, `.vs/**`
- `*.swp`, `*.swo`, `*~`

**Workflow Artifacts:**

- `.ai_workflow/**`, `.workflow_core/**`

### Architecture

**Pure Functions:**

- `getDefaultExclusionPatterns()` - Get default patterns for project kind
- `parseGitignorePatterns()` - Parse .gitignore into patterns
- `isExcluded()` - Check if path matches exclusion patterns
- `filterExcludedFiles()` - Filter file list by patterns
- `mergeExclusionPatterns()` - Merge multiple pattern arrays
- `generateExclusionReport()` - Generate exclusion report

**Impure Wrapper:**

- `ThirdPartyExclusionManager` class - Exclusion management with file I/O

---

## Installation

```javascript
import {
  ThirdPartyExclusionManager,
  getDefaultExclusionPatterns,
  parseGitignorePatterns,
  isExcluded,
  filterExcludedFiles,
  mergeExclusionPatterns,
  generateExclusionReport,
} from 'ai_workflow.js/lib/third_party_exclusion';
```

---

## Pure Functions

### `getDefaultExclusionPatterns(projectKind)`

Gets default exclusion patterns for a project kind.

**Parameters:**

- `projectKind` (string) - Project kind (nodejs_api, react_spa, python_app, etc.)

**Returns:** Array<string> - Exclusion patterns (glob format)

**Pure:** ✅ Deterministic, no side effects

**Pattern Format:**

- `**` matches any number of directories
- `*` matches any characters except /
- Patterns are relative to project root

**Example:**

```javascript
const patterns = getDefaultExclusionPatterns('nodejs_api');
// => [
//   '.git/**',
//   'node_modules/**',
//   'dist/**',
//   'build/**',
//   'coverage/**',
//   '.ai_workflow/**',
//   ...
// ]
```

---

### `parseGitignorePatterns(gitignoreContent)`

Parses .gitignore file content into exclusion patterns.

**Parameters:**

- `gitignoreContent` (string) - Content of .gitignore file

**Returns:** Array<string> - Parsed exclusion patterns

**Pure:** ✅ Deterministic, no side effects

**Parsing Rules:**

- Strips comments (lines starting with #)
- Removes blank lines
- Trims whitespace
- Converts to glob patterns
- Handles negation patterns (!)

**Example:**

```javascript
const gitignore = `
# Dependencies
node_modules/
*.log

# Build
dist/
build/

# IDE
.vscode/
`;

const patterns = parseGitignorePatterns(gitignore);
// => ['node_modules/**', '*.log', 'dist/**', 'build/**', '.vscode/**']
```

---

### `isExcluded(filePath, patterns)`

Checks if a file path matches any exclusion pattern.

**Parameters:**

- `filePath` (string) - File path to check (relative to project root)
- `patterns` (Array<string>) - Exclusion patterns

**Returns:** boolean - True if file should be excluded

**Pure:** ✅ Deterministic, no side effects

**Example:**

```javascript
const patterns = ['node_modules/**', 'dist/**', '*.min.js'];

isExcluded('node_modules/express/index.js', patterns); // => true
isExcluded('dist/bundle.js', patterns); // => true
isExcluded('src/app.min.js', patterns); // => true
isExcluded('src/app.js', patterns); // => false
```

---

### `filterExcludedFiles(files, patterns)`

Filters file list by removing excluded files.

**Parameters:**

- `files` (Array<string>) - Array of file paths
- `patterns` (Array<string>) - Exclusion patterns

**Returns:** Object with:

- `included` (Array<string>) - Files to include
- `excluded` (Array<string>) - Files excluded
- `stats` (Object) - Statistics with counts and percentages

**Pure:** ✅ Deterministic, no side effects

**Example:**

```javascript
const files = [
  'src/index.js',
  'src/utils.js',
  'node_modules/express/index.js',
  'dist/bundle.js',
  'test/test.js',
];

const patterns = ['node_modules/**', 'dist/**'];

const result = filterExcludedFiles(files, patterns);
// => {
//   included: ['src/index.js', 'src/utils.js', 'test/test.js'],
//   excluded: ['node_modules/express/index.js', 'dist/bundle.js'],
//   stats: {
//     total: 5,
//     included: 3,
//     excluded: 2,
//     percentIncluded: 60,
//     percentExcluded: 40
//   }
// }
```

---

### `mergeExclusionPatterns(...patternArrays)`

Merges multiple pattern arrays, removing duplicates.

**Parameters:**

- `...patternArrays` (Array<Array<string>>) - Multiple pattern arrays

**Returns:** Array<string> - Merged and deduplicated patterns

**Pure:** ✅ Deterministic, no side effects

**Example:**

```javascript
const defaults = ['node_modules/**', '.git/**'];
const gitignore = ['dist/**', 'build/**'];
const custom = ['tmp/**', 'node_modules/**']; // Duplicate

const merged = mergeExclusionPatterns(defaults, gitignore, custom);
// => ['node_modules/**', '.git/**', 'dist/**', 'build/**', 'tmp/**']
// Note: duplicates removed
```

---

### `generateExclusionReport(filterResult)`

Generates formatted exclusion report from filter results.

**Parameters:**

- `filterResult` (Object) - Result from `filterExcludedFiles()`

**Returns:** string - Formatted markdown report

**Pure:** ✅ Deterministic, no side effects

**Example:**

```javascript
const result = filterExcludedFiles(files, patterns);
const report = generateExclusionReport(result);

console.log(report);
// => Markdown formatted report with statistics and file lists
```

---

## ThirdPartyExclusionManager Class

Wrapper class for third-party exclusion with file I/O operations.

### Constructor

```javascript
const manager = new ThirdPartyExclusionManager(options);
```

**Options:**

- `projectRoot` (string) - Project root directory (default: process.cwd())
- `projectKind` (string) - Project kind (default: 'generic')
- `fileOps` (FileOperations) - File operations instance
- `verbose` (boolean) - Enable verbose logging (default: false)

**Example:**

```javascript
const manager = new ThirdPartyExclusionManager({
  projectRoot: '/path/to/project',
  projectKind: 'nodejs_api',
  verbose: true,
});
```

---

### Methods

#### `async initialize(customPatterns = [])`

Initializes exclusion patterns by loading defaults, .gitignore, and custom patterns.

**Parameters:**

- `customPatterns` (Array<string>, optional) - Additional custom patterns

**Side Effects:**

- Reads .gitignore from disk
- Merges patterns into `this.patterns`
- Logs initialization (if verbose)

**Example:**

```javascript
await manager.initialize(['tmp/**', '*.backup']);

console.log('Loaded patterns:', manager.patterns.length);
```

---

#### `async loadGitignorePatterns()`

Loads and parses .gitignore file.

**Returns:** Promise<Array<string>> - Parsed patterns

**Side Effects:**

- Reads .gitignore file
- Logs warnings if file not found

**Example:**

```javascript
const patterns = await manager.loadGitignorePatterns();
console.log('Gitignore patterns:', patterns);
```

---

#### `async filterProjectFiles(files = null)`

Filters project files, excluding third-party files.

**Parameters:**

- `files` (Array<string>, optional) - Files to filter (if null, scans project)

**Returns:** Promise<Object> with:

- `included` (Array<string>) - Files to include
- `excluded` (Array<string>) - Files excluded
- `stats` (Object) - Statistics

**Side Effects:**

- Lists directory if files not provided
- Logs filtering results (if verbose)

**Example:**

```javascript
await manager.initialize();

const result = await manager.filterProjectFiles();

console.log(`Included: ${result.included.length} files`);
console.log(`Excluded: ${result.excluded.length} files`);
console.log(`Exclusion rate: ${result.stats.percentExcluded}%`);
```

---

#### `checkPath(filePath)`

Checks if a specific path should be excluded.

**Parameters:**

- `filePath` (string) - File path to check

**Returns:** boolean - True if excluded

**Example:**

```javascript
await manager.initialize();

if (manager.checkPath('node_modules/express/index.js')) {
  console.log('This file will be excluded');
}
```

---

#### `getPatterns()`

Gets current exclusion patterns.

**Returns:** Array<string> - Exclusion patterns

**Example:**

```javascript
const patterns = manager.getPatterns();
console.log('Total patterns:', patterns.length);
```

---

#### `async generateReport()`

Generates exclusion report for project.

**Returns:** Promise<string> - Markdown formatted report

**Side Effects:**

- Scans project files
- Logs report generation (if verbose)

**Example:**

```javascript
const report = await manager.generateReport();

// Save to file
import { FileOperations } from 'ai_workflow.js/lib/file_operations';
const fileOps = new FileOperations();
await fileOps.writeFile('.ai_workflow/exclusion-report.md', report);
```

---

## Usage Examples

### Basic File Filtering

```javascript
import { ThirdPartyExclusionManager } from 'ai_workflow.js/lib/third_party_exclusion';

const manager = new ThirdPartyExclusionManager({
  projectRoot: '/path/to/project',
  projectKind: 'nodejs_api',
});

// Initialize with defaults + .gitignore
await manager.initialize();

// Filter project files
const result = await manager.filterProjectFiles();

console.log('=== Exclusion Report ===');
console.log(`Total files: ${result.stats.total}`);
console.log(`Included: ${result.stats.included} (${result.stats.percentIncluded}%)`);
console.log(`Excluded: ${result.stats.excluded} (${result.stats.percentExcluded}%)`);

// Process only included files
for (const file of result.included) {
  console.log(`Analyzing: ${file}`);
  // ... perform analysis
}
```

### Custom Exclusion Patterns

```javascript
const manager = new ThirdPartyExclusionManager({
  projectKind: 'react_spa',
});

// Add custom patterns
const customPatterns = [
  'src/legacy/**', // Exclude legacy code
  'src/vendor/**', // Exclude vendored code
  '*.backup', // Exclude backup files
  'tmp/**', // Exclude temp directory
];

await manager.initialize(customPatterns);

const result = await manager.filterProjectFiles();
console.log('Files after custom exclusions:', result.included.length);
```

### Checking Specific Paths

```javascript
const manager = new ThirdPartyExclusionManager({
  projectKind: 'python_app',
});

await manager.initialize();

// Check if paths should be excluded
const paths = [
  'src/main.py',
  'venv/lib/python3.9/site-packages/flask/app.py',
  '__pycache__/utils.cpython-39.pyc',
  'dist/bundle.tar.gz',
];

paths.forEach((path) => {
  const excluded = manager.checkPath(path);
  console.log(`${path}: ${excluded ? 'EXCLUDED' : 'INCLUDED'}`);
});
```

### Using Pure Functions

```javascript
import {
  getDefaultExclusionPatterns,
  parseGitignorePatterns,
  filterExcludedFiles,
} from 'ai_workflow.js/lib/third_party_exclusion';
import { FileOperations } from 'ai_workflow.js/lib/file_operations';

// Get default patterns
const defaults = getDefaultExclusionPatterns('nodejs_api');

// Parse .gitignore
const fileOps = new FileOperations();
const gitignoreContent = await fileOps.readFile('.gitignore');
const gitignorePatterns = parseGitignorePatterns(gitignoreContent);

// Merge patterns
const allPatterns = [...defaults, ...gitignorePatterns];

// Get all files
const allFiles = await fileOps.listDirectoryRecursive('.');

// Filter
const result = filterExcludedFiles(allFiles, allPatterns);

console.log(`Analyzing ${result.included.length} files`);
console.log(`Excluding ${result.excluded.length} third-party files`);
```

### Generating Exclusion Report

```javascript
const manager = new ThirdPartyExclusionManager({
  projectRoot: '/path/to/project',
  projectKind: 'nodejs_api',
  verbose: true,
});

await manager.initialize();

// Generate report
const report = await manager.generateReport();

console.log(report);

// Save report
import { FileOperations } from 'ai_workflow.js/lib/file_operations';
const fileOps = new FileOperations();
await fileOps.writeFile('.ai_workflow/third-party-exclusion.md', report);

console.log('Exclusion report saved');
```

### Dynamic Pattern Selection by Project Kind

```javascript
import { ProjectKindDetector } from 'ai_workflow.js/lib/project_kind_detection';
import { ThirdPartyExclusionManager } from 'ai_workflow.js/lib/third_party_exclusion';

async function setupExclusions(projectRoot) {
  // Detect project kind
  const detector = new ProjectKindDetector();
  const { kind } = await detector.detect(projectRoot);

  console.log(`Detected project kind: ${kind}`);

  // Create exclusion manager with detected kind
  const manager = new ThirdPartyExclusionManager({
    projectRoot,
    projectKind: kind,
  });

  await manager.initialize();

  // Get patterns being used
  const patterns = manager.getPatterns();
  console.log(`Using ${patterns.length} exclusion patterns`);

  return manager;
}

const manager = await setupExclusions('/path/to/project');
const result = await manager.filterProjectFiles();
```

### Multi-Source Pattern Merging

```javascript
import {
  getDefaultExclusionPatterns,
  parseGitignorePatterns,
  mergeExclusionPatterns,
} from 'ai_workflow.js/lib/third_party_exclusion';

// Get patterns from multiple sources
const nodePatterns = getDefaultExclusionPatterns('nodejs_api');
const reactPatterns = getDefaultExclusionPatterns('react_spa');

// Parse .gitignore
const gitignoreContent = await readFile('.gitignore');
const gitPatterns = parseGitignorePatterns(gitignoreContent);

// Custom patterns
const customPatterns = ['src/legacy/**', 'tmp/**'];

// Merge all (removes duplicates)
const allPatterns = mergeExclusionPatterns(
  nodePatterns,
  reactPatterns,
  gitPatterns,
  customPatterns
);

console.log(`Total unique patterns: ${allPatterns.length}`);
```

### Workflow Integration

```javascript
import { ThirdPartyExclusionManager } from 'ai_workflow.js/lib/third_party_exclusion';
import { ProjectKindDetector } from 'ai_workflow.js/lib/project_kind_detection';
import { TechStackDetector } from 'ai_workflow.js/lib/tech_stack';

async function analyzeProject(projectRoot) {
  // Detect project kind
  const kindDetector = new ProjectKindDetector();
  const { kind } = await kindDetector.detect(projectRoot);

  // Setup exclusions
  const exclusionManager = new ThirdPartyExclusionManager({
    projectRoot,
    projectKind: kind,
  });

  await exclusionManager.initialize();

  // Filter to first-party files
  const { included } = await exclusionManager.filterProjectFiles();

  console.log(`Analyzing ${included.length} first-party files`);

  // Detect tech stack on filtered files
  const techDetector = new TechStackDetector({ projectRoot });
  const techStack = await techDetector.detectTechStack();

  // Run analysis only on first-party files
  for (const file of included) {
    // Perform code analysis, linting, etc.
    console.log(`Analyzing: ${file}`);
  }

  return {
    projectKind: kind,
    techStack,
    firstPartyFiles: included.length,
  };
}

const analysis = await analyzeProject('/path/to/project');
console.log('Analysis complete:', analysis);
```

---

## Related Modules

- **project_kind_detection** - Provides project kind for pattern selection
- **file_operations** - Used for file system access
- **config** - May use exclusion patterns in workflow configuration

---

## Notes

- **Pattern Format**: Uses glob-like patterns (\*_, _, ?)
- **Performance**: Patterns compiled once, reused for all checks
- **Gitignore**: Fully compatible with .gitignore syntax
- **Negation**: Patterns starting with ! negate previous patterns
- **Case Sensitivity**: Patterns are case-sensitive on Linux/Mac, case-insensitive on Windows
- **Default Patterns**: Comprehensive list for each project type

---

**Last Updated:** 2026-02-07
**Author:** AI Workflow Team
