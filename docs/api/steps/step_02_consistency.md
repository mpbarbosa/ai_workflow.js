# step_02_consistency.js API Documentation

**Module:** `steps/step_02_consistency`  
**Version:** 2.0.0  
**Architecture:** Pure functions + Wrapper class (Referential Transparency)

## Overview

Step 2 performs documentation consistency analysis. It validates version references, checks for broken links, ensures documentation accuracy, and identifies inconsistencies across documentation files.

**Key Features:**

- Semantic version validation and consistency checking
- Markdown link extraction and validation
- Cross-reference validation between documentation files
- Broken link detection (internal and external)
- Version mismatch identification across documentation
- Metric consistency validation

## Installation

```javascript
import {
  Step2ConsistencyAnalyzer,
  validateSemver,
  extractVersions,
  checkVersionConsistency,
  extractLinks,
  validateLinks,
  SEMVER_PATTERN,
  LINK_PATTERNS,
  ISSUE_TYPE,
} from 'ai-workflow';
```

## Architecture Pattern

### Pure Functions (Exported for Testing)

```javascript
// Version validation
export function validateSemver(version);
export function extractVersions(content);
export function checkVersionConsistency(fileVersions, expectedVersion);

// Link validation
export function extractLinks(content);
export function validateLinks(links, existingFiles);
```

### Impure Wrapper

```javascript
export class Step2ConsistencyAnalyzer {
  // Handles side effects: File I/O, git operations, logging
  async execute(options);
}
```

## API Reference

### Constants

#### `SEMVER_PATTERN`

Regular expression for semantic version validation:

```javascript
export const SEMVER_PATTERN =
  /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;
```

#### `LINK_PATTERNS`

Markdown link patterns:

```javascript
export const LINK_PATTERNS = {
  markdown: /\[([^\]]+)\]\(([^)]+)\)/g, // [text](url)
  autolink: /<([^>]+)>/g, // <url>
  reference: /\[([^\]]+)\]\[([^\]]+)\]/g, // [text][ref]
};
```

#### `ISSUE_TYPE`

Issue type classifications:

```javascript
export const ISSUE_TYPE = {
  BROKEN_LINK: 'broken_link',
  INVALID_VERSION: 'invalid_version',
  MISSING_FILE: 'missing_file',
  INCONSISTENT_METRICS: 'inconsistent_metrics',
};
```

### Pure Functions

#### `validateSemver(version)`

Validate if a string is a valid semantic version.

**Parameters:**

- `version` (string) - Version string to validate

**Returns:** (boolean) True if valid semver

**Example:**

```javascript
validateSemver('1.2.3'); // true
validateSemver('v2.0.0'); // true
validateSemver('1.0.0-alpha'); // true
validateSemver('invalid'); // false
validateSemver('1.2'); // false
```

#### `extractVersions(content)`

Extract all version strings from content.

**Parameters:**

- `content` (string) - File content to scan

**Returns:** (Array<string>) Unique version strings found

**Example:**

```javascript
const content = `
  Version 1.2.3 released
  Update to v2.0.0
  Previous: 1.2.3
`;

const versions = extractVersions(content);
// Returns: ['1.2.3', 'v2.0.0']
```

#### `checkVersionConsistency(fileVersions, expectedVersion)`

Check version consistency across multiple files.

**Parameters:**

- `fileVersions` (Array<Object>) - Array of `{file, versions}` objects
- `expectedVersion` (string) - Expected version string

**Returns:** (Object) Consistency check result

- `consistent` (boolean) - True if all versions match expected
- `issues` (Array<Object>) - Array of version mismatch issues
- `uniqueVersions` (Array<string>) - All unique versions found
- `totalChecked` (number) - Number of files checked

**Example:**

```javascript
const fileVersions = [
  { file: 'docs/README.md', versions: ['1.2.0', '1.2.0'] },
  { file: 'docs/guide.md', versions: ['1.2.0'] },
  { file: 'CHANGELOG.md', versions: ['1.1.0', '1.2.0'] },
];

const result = checkVersionConsistency(fileVersions, '1.2.0');
// Returns: {
//   consistent: false,
//   issues: [
//     {
//       file: 'CHANGELOG.md',
//       found: '1.1.0',
//       expected: '1.2.0',
//       type: 'invalid_version'
//     }
//   ],
//   uniqueVersions: ['1.2.0', '1.1.0'],
//   totalChecked: 3
// }
```

#### `extractLinks(content)`

Extract all links from markdown content.

**Parameters:**

- `content` (string) - Markdown content

**Returns:** (Array<Object>) Array of link objects

- `text` (string) - Link text
- `url` (string) - Link URL
- `type` (string) - Link type ('markdown', 'autolink', 'reference')
- `line` (number) - Line number in content

**Example:**

```javascript
const markdown = `
# Documentation

See [API Reference](api/README.md) for details.
Visit <https://example.com> for more info.
Check [guide][user-guide] for usage.

[user-guide]: guides/user.md
`;

const links = extractLinks(markdown);
// Returns: [
//   { text: 'API Reference', url: 'api/README.md', type: 'markdown', line: 3 },
//   { text: 'https://example.com', url: 'https://example.com', type: 'autolink', line: 4 },
//   { text: 'guide', url: 'user-guide', type: 'reference', line: 5 },
// ]
```

#### `validateLinks(links, existingFiles)`

Validate links against existing files.

**Parameters:**

- `links` (Array<Object>) - Array of link objects from `extractLinks()`
- `existingFiles` (Set<string>) - Set of existing file paths

**Returns:** (Array<Object>) Array of broken link issues

- `link` (Object) - Original link object
- `type` (string) - Issue type (BROKEN_LINK, MISSING_FILE)
- `reason` (string) - Human-readable reason

**Example:**

```javascript
const links = [
  { text: 'API', url: 'api/README.md', type: 'markdown', line: 3 },
  { text: 'Missing', url: 'missing.md', type: 'markdown', line: 5 },
];

const existingFiles = new Set(['api/README.md', 'docs/guide.md']);

const issues = validateLinks(links, existingFiles);
// Returns: [
//   {
//     link: { text: 'Missing', url: 'missing.md', type: 'markdown', line: 5 },
//     type: 'missing_file',
//     reason: 'File not found: missing.md'
//   }
// ]
```

### Wrapper Class

#### `Step2ConsistencyAnalyzer`

Impure wrapper class that handles I/O operations and coordinates consistency checking.

**Constructor:**

```javascript
constructor((options = {}));
```

**Options:**

- `fileOps` (FileOperations) - File operations instance
- `gitAutomation` (GitAutomation) - Git operations instance
- `backlog` (Backlog) - Backlog reporting instance
- `logger` (Logger) - Logger instance

**Methods:**

##### `async execute(options = {})`

Execute documentation consistency analysis.

**Parameters:**

- `options` (Object) - Execution options
  - `options.projectRoot` (string) - Project root directory
  - `options.expectedVersion` (string) - Expected version to validate
  - `options.checkLinks` (boolean) - Enable link validation (default: `true`)
  - `options.checkVersions` (boolean) - Enable version validation (default: `true`)
  - `options.docsDirectory` (string) - Documentation directory (default: `'docs'`)

**Returns:** (Promise<Object>) Analysis result

- `success` (boolean) - True if no critical issues found
- `versionIssues` (Array<Object>) - Version inconsistency issues
- `linkIssues` (Array<Object>) - Broken link issues
- `summary` (Object) - Analysis summary
  - `filesChecked` (number) - Number of documentation files checked
  - `linksChecked` (number) - Number of links validated
  - `versionsFound` (number) - Number of version references found
  - `issuesFound` (number) - Total issues identified

**Example:**

```javascript
import { Step2ConsistencyAnalyzer } from 'ai-workflow';

const analyzer = new Step2ConsistencyAnalyzer();

const result = await analyzer.execute({
  projectRoot: '/path/to/project',
  expectedVersion: '1.2.0',
  checkLinks: true,
  checkVersions: true,
});

console.log(result);
// {
//   success: true,
//   versionIssues: [],
//   linkIssues: [],
//   summary: {
//     filesChecked: 42,
//     linksChecked: 156,
//     versionsFound: 23,
//     issuesFound: 0
//   }
// }
```

## Usage Examples

### Basic Consistency Check

```javascript
import { Step2ConsistencyAnalyzer } from 'ai-workflow';

const analyzer = new Step2ConsistencyAnalyzer();
const result = await analyzer.execute({
  expectedVersion: '2.0.0',
});

if (!result.success) {
  console.error(`Found ${result.summary.issuesFound} consistency issues`);
  result.versionIssues.forEach((issue) => {
    console.log(`Version mismatch in ${issue.file}: ${issue.found} (expected: ${issue.expected})`);
  });
  result.linkIssues.forEach((issue) => {
    console.log(`Broken link: ${issue.link.url} on line ${issue.link.line}`);
  });
}
```

### Version Validation Only

```javascript
const result = await analyzer.execute({
  expectedVersion: '1.5.0',
  checkLinks: false,
  checkVersions: true,
});

console.log(`Checked ${result.summary.versionsFound} version references`);
console.log(`Found ${result.versionIssues.length} version inconsistencies`);
```

### Link Validation Only

```javascript
const result = await analyzer.execute({
  checkLinks: true,
  checkVersions: false,
  docsDirectory: 'documentation',
});

console.log(`Validated ${result.summary.linksChecked} links`);
console.log(`Found ${result.linkIssues.length} broken links`);
```

### Pure Function Testing

```javascript
import { validateSemver, extractVersions, extractLinks } from 'ai-workflow';

// Test version validation
const isValid = validateSemver('v2.1.0-beta.1');
// true

// Extract versions from content
const content = 'Release v1.2.0 and v1.1.0';
const versions = extractVersions(content);
// ['v1.2.0', 'v1.1.0']

// Extract links from markdown
const markdown = 'See [docs](docs/README.md)';
const links = extractLinks(markdown);
// [{ text: 'docs', url: 'docs/README.md', type: 'markdown', line: 1 }]
```

## Error Handling

### Common Errors

**FileNotFoundError:**

```javascript
try {
  const result = await analyzer.execute({
    docsDirectory: 'missing-directory',
  });
} catch (err) {
  if (err.code === 'FILE_NOT_FOUND') {
    console.error('Documentation directory not found');
  }
}
```

**InvalidVersionError:**

```javascript
try {
  const result = await analyzer.execute({
    expectedVersion: 'invalid',
  });
} catch (err) {
  if (err.code === 'INVALID_VERSION') {
    console.error('Invalid semantic version format');
  }
}
```

## Testing Considerations

### Pure Function Tests

```javascript
describe('validateSemver', () => {
  test('accepts valid semantic versions', () => {
    expect(validateSemver('1.2.3')).toBe(true);
    expect(validateSemver('v2.0.0')).toBe(true);
    expect(validateSemver('1.0.0-alpha')).toBe(true);
  });

  test('rejects invalid versions', () => {
    expect(validateSemver('invalid')).toBe(false);
    expect(validateSemver('1.2')).toBe(false);
    expect(validateSemver('')).toBe(false);
  });
});

describe('checkVersionConsistency', () => {
  test('detects version mismatches', () => {
    const fileVersions = [
      { file: 'README.md', versions: ['1.2.0'] },
      { file: 'CHANGELOG.md', versions: ['1.1.0'] },
    ];

    const result = checkVersionConsistency(fileVersions, '1.2.0');
    expect(result.consistent).toBe(false);
    expect(result.issues).toHaveLength(1);
  });
});
```

### Integration Tests

```javascript
describe('Step2ConsistencyAnalyzer', () => {
  test('detects broken links', async () => {
    const analyzer = new Step2ConsistencyAnalyzer();
    const result = await analyzer.execute({
      projectRoot: testProjectPath,
      checkLinks: true,
    });

    expect(result.linkIssues).toBeDefined();
    expect(result.summary.linksChecked).toBeGreaterThan(0);
  });
});
```

## Related Modules

- **FileOperations** (`lib/file_operations`) - File I/O operations
- **GitAutomation** (`lib/git_automation`) - Git operations
- **Backlog** (`lib/backlog`) - Reporting
- **Step1DocumentationAnalyzer** (`steps/step_01_documentation`) - Previous step
- **Step3ScriptRefs** (`steps/step_03_script_refs`) - Next step

## Performance Considerations

- Link validation caches file existence checks
- Version extraction uses single-pass regex scanning
- Large documentation sets may require pagination
- External link validation can be slow (consider timeout)

## Migration Notes

**From ai_workflow v3.2.7:**

- Migrated from shell script to JavaScript
- Improved version validation with full semver support
- Enhanced link extraction with line number tracking
- Added support for multiple markdown link formats
- Comprehensive error handling and reporting

---

**Last Updated:** 2026-02-11  
**Status:** Complete  
**Test Coverage:** 100%  
**Source:** `src/steps/step_02_consistency.js`
