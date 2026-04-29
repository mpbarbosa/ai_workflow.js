# step_03_script_refs.js API Documentation

**Module:** `steps/step_03_script_refs`
**Version:** 2.2.17
**Architecture:** Pure functions + Wrapper class (Referential Transparency)

## Overview

Step 3 performs script reference validation. It validates script/code references in documentation, checks executable permissions, verifies shebangs, and ensures all scripts are documented.

**Key Features:**

- Script pattern detection by language (bash, python, javascript, etc.)
- Script reference extraction from documentation
- Missing reference detection
- Executable permission validation (Unix-like systems)
- Shebang validation for interpreted scripts
- Documentation completeness checking

## Installation

```javascript
import {
  Step3ScriptAnalyzer,
  getScriptPatterns,
  extractScriptReferences,
  validateScriptReferences,
  validateShebang,
  isScriptDocumented,
  SCRIPT_PATTERNS,
  SCRIPT_ISSUE_TYPE,
} from 'ai-workflow';
```

## Architecture Pattern

### Pure Functions (Exported for Testing)

```javascript
// Pattern detection
export function getScriptPatterns(language);
export function getScriptDirectories(language);

// Reference extraction and validation
export function extractScriptReferences(content);
export function validateScriptReferences(references, existingScripts);

// Script validation
export function validateShebang(content, extension);
export function isScriptDocumented(scriptPath, readmeContent);

// Reporting
export function formatScriptReport(results);
```

### Impure Wrapper

```javascript
export class Step3ScriptAnalyzer {
  // Handles side effects: File I/O, git operations, logging
  async execute(projectRoot, options);
}
```

## API Reference

### Constants

#### `SCRIPT_PATTERNS`

Script file patterns by programming language:

```javascript
export const SCRIPT_PATTERNS = {
  bash: ['*.sh'],
  python: ['*.py'],
  javascript: ['*.js', '*.mjs'],
  typescript: ['*.ts', '*.mts'],
  go: ['*.go'],
  java: ['*.java'],
  ruby: ['*.rb'],
  rust: ['*.rs'],
  cpp: ['*.cpp', '*.cc', '*.h', '*.hpp'],
};
```

#### `SCRIPT_DIRECTORIES`

Default script directories by language:

```javascript
export const SCRIPT_DIRECTORIES = {
  bash: ['src/workflow', 'scripts'],
  python: ['scripts', 'src'],
  javascript: ['scripts', 'src'],
  typescript: ['scripts', 'src'],
  default: ['scripts'],
};
```

#### `SCRIPT_ISSUE_TYPE`

Issue type classifications:

```javascript
export const SCRIPT_ISSUE_TYPE = {
  MISSING_REFERENCE: 'missing_reference',
  NON_EXECUTABLE: 'non_executable',
  UNDOCUMENTED: 'undocumented',
  INVALID_SHEBANG: 'invalid_shebang',
};
```

### Pure Functions

#### `getScriptPatterns(language)`

Get script file patterns for a programming language.

**Parameters:**

- `language` (string) - Programming language (e.g., 'bash', 'python', 'javascript')

**Returns:** (string[]) Array of file glob patterns

**Example:**

```javascript
const patterns1 = getScriptPatterns('bash');
// Returns: ['*.sh']

const patterns2 = getScriptPatterns('python');
// Returns: ['*.py']

const patterns3 = getScriptPatterns('javascript');
// Returns: ['*.js', '*.mjs']
```

#### `getScriptDirectories(language)`

Get default script directories for a language.

**Parameters:**

- `language` (string) - Programming language

**Returns:** (string[]) Array of directory paths

**Example:**

```javascript
const dirs1 = getScriptDirectories('bash');
// Returns: ['src/workflow', 'scripts']

const dirs2 = getScriptDirectories('python');
// Returns: ['scripts', 'src']

const dirs3 = getScriptDirectories('unknown');
// Returns: ['scripts'] (default)
```

#### `extractScriptReferences(content)`

Extract script references from documentation content.

**Parameters:**

- `content` (string) - Documentation content (markdown)

**Returns:** (string[]) Array of unique script paths referenced

**Example:**

```javascript
const markdown = `
# Scripts

Run \`./scripts/setup.sh\` to initialize.
Execute \`tools/deploy.py\` for deployment.

\`\`\`bash
./scripts/test.sh
npm run build
\`\`\`
`;

const refs = extractScriptReferences(markdown);
// Returns: ['scripts/setup.sh', 'tools/deploy.py', 'scripts/test.sh']
```

**Patterns Matched:**

- Inline code: `` `./path/to/script.sh` ``
- Code blocks: ` ```bash\n./script.sh\n``` `
- Supports extensions: .sh, .py, .js, .mjs, .ts, .rb, .go, .java, .rs, .cpp, .cc

#### `validateScriptReferences(references, existingScripts)`

Validate script references against existing files.

**Parameters:**

- `references` (string[]) - Script references from documentation
- `existingScripts` (Set) - Set of existing script file paths

**Returns:** (Object[]) Array of missing reference issues

**Example:**

```javascript
const references = ['./scripts/setup.sh', 'tools/deploy.py', 'missing/script.js'];

const existingScripts = new Set(['scripts/setup.sh', 'tools/deploy.py']);

const issues = validateScriptReferences(references, existingScripts);
// Returns: [
//   {
//     reference: 'missing/script.js',
//     normalized: 'missing/script.js',
//     type: 'missing_reference'
//   }
// ]
```

#### `validateShebang(content, extension)`

Check if a script has a valid shebang line.

**Parameters:**

- `content` (string) - Script file content
- `extension` (string) - File extension (e.g., '.sh', '.py', '.rb')

**Returns:** (Object) Validation result

- `valid` (boolean) - True if shebang is valid
- `reason` (string) - Reason if invalid ('not_required', 'missing_shebang', 'invalid_shebang')
- `found` (string) - Found shebang line (if invalid)
- `expected` (string[]) - Expected shebang lines (if invalid)

**Example:**

```javascript
const bashScript = '#!/bin/bash\necho "Hello"';
const result1 = validateShebang(bashScript, '.sh');
// Returns: { valid: true }

const noBang = 'echo "Hello"';
const result2 = validateShebang(noBang, '.sh');
// Returns: {
//   valid: false,
//   reason: 'missing_shebang',
//   expected: ['#!/bin/bash', '#!/bin/sh', ...]
// }

const wrongBang = '#!/usr/bin/perl\necho "Hello"';
const result3 = validateShebang(wrongBang, '.sh');
// Returns: {
//   valid: false,
//   reason: 'invalid_shebang',
//   found: '#!/usr/bin/perl',
//   expected: ['#!/bin/bash', '#!/bin/sh', ...]
// }

const jsScript = 'console.log("Hello")';
const result4 = validateShebang(jsScript, '.js');
// Returns: { valid: true, reason: 'not_required' }
```

**Expected Shebangs:**

- `.sh`: `#!/bin/bash`, `#!/bin/sh`, `#!/usr/bin/env bash`, `#!/usr/bin/env sh`
- `.py`: `#!/usr/bin/env python`, `#!/usr/bin/python`, `#!/usr/bin/env python3`, `#!/usr/bin/python3`
- `.rb`: `#!/usr/bin/env ruby`, `#!/usr/bin/ruby`

#### `isScriptDocumented(scriptPath, readmeContent)`

Check if a script is documented in README.

**Parameters:**

- `scriptPath` (string) - Script file path
- `readmeContent` (string) - README content

**Returns:** (boolean) True if script is mentioned in README

**Example:**

```javascript
const readme = `
# Project Scripts

Run \`scripts/setup.sh\` to initialize.
`;

const documented = isScriptDocumented('scripts/setup.sh', readme);
// Returns: true

const notDocumented = isScriptDocumented('scripts/undocumented.sh', readme);
// Returns: false

const byName = isScriptDocumented('scripts/setup.sh', 'setup.sh is the init script');
// Returns: true (matches script name)
```

#### `formatScriptReport(results)`

Format script validation report as markdown.

**Parameters:**

- `results` (Object) - Validation results
  - `scriptsFound` (number) - Total scripts found
  - `referencesChecked` (number) - Total references checked
  - `totalIssues` (number) - Total issues count
  - `missingReferences` (Object[]) - Missing reference issues
  - `nonExecutable` (string[]) - Non-executable scripts
  - `undocumented` (string[]) - Undocumented scripts

**Returns:** (string) Formatted markdown report

**Example:**

```javascript
const results = {
  scriptsFound: 15,
  referencesChecked: 12,
  totalIssues: 3,
  missingReferences: [{ reference: 'missing.sh', normalized: 'missing.sh' }],
  nonExecutable: ['scripts/setup.sh'],
  undocumented: ['scripts/internal.sh'],
};

const report = formatScriptReport(results);
// Returns markdown with:
// - Summary section
// - Status indicator (✅ or ⚠️)
// - Missing references list
// - Non-executable scripts
// - Undocumented scripts
```

### Wrapper Class

#### `Step3ScriptAnalyzer`

Impure wrapper class that handles I/O operations and coordinates script validation.

**Constructor:**

```javascript
constructor((options = {}));
```

**Options:**

- `fileOps` (FileOperations) - File operations instance
- `backlog` (Backlog) - Backlog reporting instance
- `techStack` (TechStackDetector) - Tech stack detection instance

**Methods:**

##### `async execute(projectRoot, options = {})`

Execute script reference validation workflow step.

**Parameters:**

- `projectRoot` (string) - Project root directory path
- `options` (Object) - Execution options
  - `options.language` (string) - Override language detection (optional)

**Returns:** (Promise<Object>) Analysis result

- `success` (boolean) - True if validation completed
- `skipped` (boolean) - True if skipped (no scripts found)
- `reason` (string) - Skip reason ('no_scripts')
- `scriptsFound` (number) - Total scripts found
- `referencesChecked` (number) - Total references checked
- `totalIssues` (number) - Total issues count
- `missingReferences` (Object[]) - Missing reference issues
- `nonExecutable` (string[]) - Non-executable scripts
- `undocumented` (string[]) - Undocumented scripts

**Example:**

```javascript
import { Step3ScriptAnalyzer } from 'ai-workflow';

const analyzer = new Step3ScriptAnalyzer();

const result = await analyzer.execute('/path/to/project');

console.log(result);
// {
//   success: true,
//   scriptsFound: 15,
//   referencesChecked: 12,
//   totalIssues: 2,
//   missingReferences: [...],
//   nonExecutable: ['scripts/setup.sh'],
//   undocumented: []
// }
```

##### `async detectLanguage(projectRoot)`

Detect primary programming language from project.

**Parameters:**

- `projectRoot` (string) - Project root directory

**Returns:** (Promise<string>) Detected language name (default: 'bash')

##### `async findScripts(projectRoot, directories, patterns)`

Find all script files in specified directories.

**Parameters:**

- `projectRoot` (string) - Project root directory
- `directories` (string[]) - Directories to search
- `patterns` (string[]) - File glob patterns

**Returns:** (Promise<string[]>) Array of script file paths

##### `async loadReadme(projectRoot)`

Load README content from project root.

**Parameters:**

- `projectRoot` (string) - Project root directory

**Returns:** (Promise<string>) README content or empty string

##### `async checkExecutablePermissions(scripts)`

Check executable permissions on script files (Unix-like systems only).

**Parameters:**

- `scripts` (string[]) - Array of script file paths

**Returns:** (Promise<string[]>) Non-executable scripts

## Usage Examples

### Basic Script Validation

```javascript
import { Step3ScriptAnalyzer } from 'ai-workflow';

const analyzer = new Step3ScriptAnalyzer();
const result = await analyzer.execute('/path/to/project');

if (result.success) {
  console.log(`Found ${result.scriptsFound} scripts`);
  if (result.totalIssues === 0) {
    console.log('All scripts are valid!');
  } else {
    console.log(`${result.totalIssues} issues found`);
    console.log(`Missing references: ${result.missingReferences.length}`);
    console.log(`Non-executable: ${result.nonExecutable.length}`);
    console.log(`Undocumented: ${result.undocumented.length}`);
  }
}
```

### Override Language Detection

```javascript
const result = await analyzer.execute('/path/to/project', {
  language: 'python',
});
// Forces Python script patterns
```

### Pure Function Testing

```javascript
import { extractScriptReferences, validateShebang, isScriptDocumented } from 'ai-workflow';

// Test reference extraction
const markdown = 'Run `./setup.sh` to start';
const refs = extractScriptReferences(markdown);
// refs: ['setup.sh']

// Test shebang validation
const script = '#!/bin/bash\necho "test"';
const shebangResult = validateShebang(script, '.sh');
// shebangResult: { valid: true }

// Test documentation check
const readme = 'setup.sh initializes the project';
const documented = isScriptDocumented('setup.sh', readme);
// documented: true
```

## Error Handling

### Common Errors

**No Scripts Found:**

```javascript
const result = await analyzer.execute('/path/to/project');
if (result.skipped && result.reason === 'no_scripts') {
  console.log('No scripts found in project');
}
```

**Language Detection Failed:**

```javascript
try {
  const result = await analyzer.execute('/path/to/project');
} catch (err) {
  console.error('Validation failed:', err.message);
  // Fallback: specify language manually
  const result2 = await analyzer.execute('/path/to/project', {
    language: 'bash',
  });
}
```

## Testing Considerations

### Pure Function Tests

````javascript
describe('extractScriptReferences', () => {
  test('extracts inline script references', () => {
    const content = 'Run `./script.sh` to start';
    const refs = extractScriptReferences(content);
    expect(refs).toContain('script.sh');
  });

  test('extracts code block references', () => {
    const content = '```bash\n./test.sh\n```';
    const refs = extractScriptReferences(content);
    expect(refs).toContain('test.sh');
  });

  test('removes duplicates', () => {
    const content = '`script.sh` and `script.sh`';
    const refs = extractScriptReferences(content);
    expect(refs).toEqual(['script.sh']);
  });
});

describe('validateShebang', () => {
  test('accepts valid bash shebang', () => {
    const result = validateShebang('#!/bin/bash\ntest', '.sh');
    expect(result.valid).toBe(true);
  });

  test('rejects missing shebang', () => {
    const result = validateShebang('echo test', '.sh');
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('missing_shebang');
  });

  test('skips validation for non-script files', () => {
    const result = validateShebang('console.log(1)', '.js');
    expect(result.valid).toBe(true);
    expect(result.reason).toBe('not_required');
  });
});
````

### Integration Tests

```javascript
describe('Step3ScriptAnalyzer', () => {
  test('validates project scripts', async () => {
    const analyzer = new Step3ScriptAnalyzer();
    const result = await analyzer.execute(testProjectPath);

    expect(result.success).toBe(true);
    expect(result.scriptsFound).toBeGreaterThanOrEqual(0);
    expect(result.totalIssues).toBeDefined();
  });

  test('handles projects without scripts', async () => {
    const analyzer = new Step3ScriptAnalyzer();
    const result = await analyzer.execute(emptyProjectPath);

    expect(result.skipped).toBe(true);
    expect(result.reason).toBe('no_scripts');
  });
});
```

## Related Modules

- **FileOperations** (`lib/file_operations`) - File I/O operations
- **TechStackDetector** (`lib/tech_stack`) - Language detection
- **Backlog** (`lib/backlog`) - Reporting
- **Step2ConsistencyAnalyzer** (`steps/step_02_consistency`) - Previous step
- **Step4ConfigAnalyzer** (`steps/step_04_config_validation`) - Next step

## Performance Considerations

- Script discovery uses glob patterns (efficient for large projects)
- File reading is deferred until needed (lazy loading)
- Executable permission checks are Unix-specific (skipped on Windows)
- Reference extraction uses regex (O(n) complexity on content length)
- README is cached after first load

## Migration Notes

**From ai_workflow v3.2.7:**

- Migrated from `step_03_script_refs.sh`
- Extracted pure functions for reference validation
- Added comprehensive shebang validation
- Improved documentation completeness checking
- Cross-platform support (Windows permission checks gracefully skipped)
- Enhanced error handling and reporting

---

**Last Updated:** 2026-02-11
**Status:** Complete
**Test Coverage:** 100%
**Source:** `src/steps/step_03_script_refs.js`
