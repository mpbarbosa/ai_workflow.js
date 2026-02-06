# third_party_exclusion - Third-Party File Exclusion Module

**Module:** `lib/third_party_exclusion`  
**Version:** 1.0.0  
**Type:** Pure Functions + Wrapper

## Overview

Filters third-party files and directories from project analysis to focus on first-party code. Integrates .gitignore patterns, project-kind-specific exclusions, and custom patterns to exclude dependencies, build artifacts, and IDE files.

---

## Architecture

**Pure Functions** (exported for testing):

- `getDefaultExclusionPatterns()` - Get default patterns for project kind
- `parseGitignorePatterns()` - Parse .gitignore file
- `isExcluded()` - Check if file matches exclusion pattern
- `filterExcludedFiles()` - Filter file list
- `mergeExclusionPatterns()` - Merge multiple pattern arrays
- `generateExclusionReport()` - Format exclusion statistics

**Wrapper Class**:

- `ThirdPartyExclusionManager` - Manages patterns and file filtering with I/O

---

## Pure Functions

### `getDefaultExclusionPatterns(projectKind)`

Returns default exclusion patterns for a project kind.

**Parameters:**

- `projectKind` (string) - Project kind (nodejs_api, python_app, etc.)

**Returns:** Array\<string\> - Glob patterns for exclusion

**Common Patterns** (all project kinds):

- `.git/**`, `.svn/**`, `.hg/**` - Version control
- `.vscode/**`, `.idea/**` - IDE files
- `.DS_Store`, `Thumbs.db` - OS files
- `.ai_workflow/**`, `.workflow_core/**` - Workflow artifacts

**Project-Specific Patterns:**

```javascript
// nodejs_api, react_spa, client_spa
['node_modules/**', 'dist/**', 'build/**', 'coverage/**', '.next/**'][
  // python_app
  ('venv/**', '__pycache__/**', '*.pyc', '.pytest_cache/**', 'dist/**')
][
  // shell_script_automation
  ('*.log', 'tmp/**', 'temp/**')
];
```

**Example:**

```javascript
import { getDefaultExclusionPatterns } from './lib/third_party_exclusion.js';

const patterns = getDefaultExclusionPatterns('nodejs_api');
// [
//   '.git/**', '.vscode/**', '.DS_Store', '.ai_workflow/**',
//   'node_modules/**', 'dist/**', 'build/**', 'coverage/**', ...
// ]
```

---

### `parseGitignorePatterns(gitignoreContent)`

Parses .gitignore file content into glob patterns.

**Parameters:**

- `gitignoreContent` (string) - Contents of .gitignore file

**Returns:** Array\<string\> - Parsed glob patterns

**Parsing Rules:**

- Ignores empty lines and comments (`#`)
- Converts directory patterns (`dir/`) to `dir/**`
- Adds `**/` prefix to patterns without `/`
- Skips negation patterns (`!pattern`)

**Example:**

```javascript
const gitignore = `
# Comment
node_modules/
*.log
dist
!important.log
`;

const patterns = parseGitignorePatterns(gitignore);
// ['node_modules/**', '**/*.log', '**/dist']
```

---

### `isExcluded(filePath, patterns)`

Checks if a file path matches any exclusion pattern.

**Parameters:**

- `filePath` (string) - Relative file path to check
- `patterns` (Array\<string\>) - Exclusion patterns (glob-like)

**Returns:** Object with `{ excluded: boolean, matchedPattern: string|null }`

**Glob Pattern Support:**

- `*` - Matches any characters except `/`
- `**` - Matches any characters including `/`
- `?` - Matches single character
- `**/pattern` - Matches pattern in any directory

**Example:**

```javascript
const result = isExcluded('node_modules/express/index.js', ['node_modules/**']);
// { excluded: true, matchedPattern: 'node_modules/**' }

const result2 = isExcluded('src/app.js', ['node_modules/**']);
// { excluded: false, matchedPattern: null }
```

---

### `filterExcludedFiles(files, patterns)`

Filters file list to remove excluded files.

**Parameters:**

- `files` (Array\<string\>) - List of file paths
- `patterns` (Array\<string\>) - Exclusion patterns

**Returns:** Object with `{ included: string[], excluded: Array<Object> }`

**Example:**

```javascript
const files = ['src/app.js', 'node_modules/express/index.js', 'dist/bundle.js', 'README.md'];

const patterns = ['node_modules/**', 'dist/**'];
const result = filterExcludedFiles(files, patterns);

// {
//   included: ['src/app.js', 'README.md'],
//   excluded: [
//     { path: 'node_modules/express/index.js', pattern: 'node_modules/**', reason: '...' },
//     { path: 'dist/bundle.js', pattern: 'dist/**', reason: '...' }
//   ]
// }
```

---

### `mergeExclusionPatterns(...patternArrays)`

Merges multiple pattern arrays, removing duplicates.

**Parameters:**

- `...patternArrays` (Array\<string\>[]) - Multiple arrays of patterns

**Returns:** Array\<string\> - Merged and deduplicated patterns

**Example:**

```javascript
const defaults = ['node_modules/**', '.git/**'];
const gitignore = ['dist/**', 'node_modules/**'];
const custom = ['*.log'];

const merged = mergeExclusionPatterns(defaults, gitignore, custom);
// ['node_modules/**', '.git/**', 'dist/**', '*.log']
```

---

### `generateExclusionReport(filterResult)`

Generates human-readable exclusion report.

**Parameters:**

- `filterResult` (Object) - Result from `filterExcludedFiles()`

**Returns:** String - Formatted markdown report

**Example:**

```javascript
const result = filterExcludedFiles(files, patterns);
const report = generateExclusionReport(result);

console.log(report);
// === File Exclusion Report ===
//
// Total files: 100
// Included: 25 (25.0%)
// Excluded: 75 (75.0%)
//
// Top exclusion patterns:
//   node_modules/**: 60 files
//   dist/**: 10 files
//   .git/**: 5 files
```

---

## ThirdPartyExclusionManager Class

Manages exclusion patterns and filters files with I/O operations.

### Constructor

```javascript
new ThirdPartyExclusionManager(options);
```

**Options:**

- `projectRoot` (string) - Project root directory
- `projectKind` (string) - Project kind (default: 'generic')
- `fileOps` (FileOperations) - File operations instance
- `verbose` (boolean) - Enable verbose logging

### Methods

#### `async initialize(customPatterns)`

Initializes exclusion patterns from defaults, .gitignore, and custom patterns.

**Parameters:**

- `customPatterns` (Array\<string\>) - Additional custom patterns

**Returns:** Promise\<void\>

**Example:**

```javascript
import { ThirdPartyExclusionManager } from './lib/third_party_exclusion.js';

const manager = new ThirdPartyExclusionManager({
  projectRoot: '/path/to/project',
  projectKind: 'nodejs_api',
  verbose: true,
});

await manager.initialize(['*.backup', 'temp/**']);
```

---

#### `async loadGitignorePatterns()`

Loads and parses .gitignore file.

**Returns:** Promise\<Array\<string\>\> - Parsed patterns

**Example:**

```javascript
const patterns = await manager.loadGitignorePatterns();
// ['node_modules/**', 'dist/**', ...]
```

---

#### `isExcluded(filePath)`

Checks if a file should be excluded.

**Parameters:**

- `filePath` (string) - Relative or absolute file path

**Returns:** Object with `{ excluded, matchedPattern }`

**Example:**

```javascript
const result = manager.isExcluded('node_modules/express/index.js');
// { excluded: true, matchedPattern: 'node_modules/**' }
```

---

#### `filterFiles(files)`

Filters a list of files.

**Parameters:**

- `files` (Array\<string\>) - List of file paths (absolute or relative)

**Returns:** Object with `{ included, excluded }`

**Example:**

```javascript
const files = await getAllProjectFiles();
const result = manager.filterFiles(files);

console.log(`Included: ${result.included.length}`);
console.log(`Excluded: ${result.excluded.length}`);
```

---

#### `async getIncludedFiles()`

Gets all files in project, excluding third-party files.

**Returns:** Promise\<Array\<string\>\> - Included files (absolute paths)

**Example:**

```javascript
const includedFiles = await manager.getIncludedFiles();
// ['/path/to/project/src/app.js', '/path/to/project/README.md', ...]
```

---

#### `async generateReport()`

Generates exclusion statistics report.

**Returns:** Promise\<string\> - Formatted report

**Example:**

```javascript
const report = await manager.generateReport();
console.log(report);
```

---

#### `getPatterns()`

Gets current exclusion patterns.

**Returns:** Array\<string\> - Current patterns (copy)

**Example:**

```javascript
const patterns = manager.getPatterns();
console.log(`Active patterns: ${patterns.length}`);
```

---

#### `addPatterns(patterns)`

Adds custom exclusion patterns.

**Parameters:**

- `patterns` (Array\<string\>) - Patterns to add

**Example:**

```javascript
manager.addPatterns(['*.backup', 'temp/**']);
```

---

## Usage Examples

### Complete File Filtering Pipeline

```javascript
import { ThirdPartyExclusionManager } from './lib/third_party_exclusion.js';

// Initialize manager
const manager = new ThirdPartyExclusionManager({
  projectRoot: '/path/to/project',
  projectKind: 'nodejs_api',
});

await manager.initialize();

// Get included files
const files = await manager.getIncludedFiles();
console.log(`Processing ${files.length} first-party files`);

// Generate report
const report = await manager.generateReport();
console.log(report);
```

### Using Pure Functions for Custom Logic

```javascript
import {
  getDefaultExclusionPatterns,
  parseGitignorePatterns,
  filterExcludedFiles,
} from './lib/third_party_exclusion.js';
import fs from 'fs/promises';

// Build custom pattern list
const defaults = getDefaultExclusionPatterns('python_app');
const gitignore = parseGitignorePatterns(await fs.readFile('.gitignore', 'utf8'));
const custom = ['*.backup', 'temp/**'];

// Merge patterns
const allPatterns = [...defaults, ...gitignore, ...custom];

// Filter files
const files = ['src/app.py', 'venv/lib/python.py', 'README.md'];
const result = filterExcludedFiles(files, allPatterns);

console.log('Included:', result.included);
console.log(
  'Excluded:',
  result.excluded.map((e) => e.path)
);
```

### Pattern Testing

```javascript
import { isExcluded } from './lib/third_party_exclusion.js';

const patterns = ['node_modules/**', 'dist/**', '*.log'];

// Test various paths
const testPaths = [
  'node_modules/express/index.js',
  'src/app.js',
  'dist/bundle.js',
  'debug.log',
  'README.md',
];

for (const path of testPaths) {
  const result = isExcluded(path, patterns);
  console.log(`${path}: ${result.excluded ? 'EXCLUDED' : 'INCLUDED'}`);
  if (result.excluded) {
    console.log(`  Matched: ${result.matchedPattern}`);
  }
}
```

---

## Glob Pattern Examples

The module supports glob patterns for flexible file matching:

```javascript
// Exact match
'node_modules'; // Matches 'node_modules' anywhere

// Directory match
'node_modules/**'; // Matches everything inside node_modules/

// Extension match
'*.log'; // Matches all .log files
'**/*.test.js'; // Matches all .test.js files in any directory

// Complex patterns
'dist/**/*.min.js'; // Matches minified JS in dist
'src/**/temp/**'; // Matches temp directories under src
```

---

## Related Modules

- **[tech_stack](./tech_stack.md)** - Uses filtered files for tech stack detection
- **[project_kind_detection](./project_kind_detection.md)** - Uses filtered files for project kind detection
- **[file_operations](./file_operations.md)** - File system operations
- **[project_kind_config](./project_kind_config.md)** - Project kind configuration

---

## Performance

- **Efficient Pattern Matching**: Regex-based glob matching
- **Lazy Loading**: .gitignore loaded only once
- **Pattern Deduplication**: Removes duplicate patterns automatically
- **Early Termination**: Stops matching on first pattern match

---

**Last Updated:** 2026-02-01  
**Part of:** AI Workflow Automation v1.2.0 (Phase 4)
