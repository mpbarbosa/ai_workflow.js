# project_kind_detection - Project Kind Detection Module

**Module:** `lib/project_kind_detection`  
**Version:** 1.0.0  
**Type:** Pure Functions + Wrapper  
**Phase:** 4 - Project Detection & Analysis

## Overview

Auto-detect project type based on file patterns, directory structure, and project configuration files. Supports 8 project kinds with confidence scoring.

**Supported Project Kinds:**

- `nodejs_api` - Node.js backend API
- `react_spa` - React single-page application
- `python_app` - Python application
- `shell_script_automation` - Shell script automation
- `static_website` - Static HTML website
- `client_spa` - Client-side SPA
- `configuration_library` - Configuration/template library
- `generic` - Generic project (fallback)

---

## Installation

```javascript
import { ProjectKindDetector } from 'ai-workflow';
// or
import { ProjectKindDetector } from 'ai-workflow/lib/project_kind_detection';
```

---

## Architecture

Follows **v1.0.0 architecture** with pure functions for detection logic and wrapper class for I/O operations.

```
┌─────────────────────────────────────┐
│   ProjectKindDetector (Wrapper)    │
│   - File I/O operations             │
│   - Directory scanning              │
└──────────────┬──────────────────────┘
               │ calls
               ▼
┌─────────────────────────────────────┐
│   Pure Detection Functions          │
│   - analyzePackageJson()            │
│   - analyzeRequirementsTxt()        │
│   - detectByFilePatterns()          │
│   - detectByDirectoryStructure()    │
│   - calculateConfidence()           │
└─────────────────────────────────────┘
```

---

## Pure Functions

### analyzePackageJson(packageJson)

Analyze `package.json` to determine Node.js project type.

**Parameters:**

- `packageJson` (Object) - Parsed package.json content

**Returns:** Object with:

- `kind` (string|null) - Detected project kind
- `confidence` (number) - Confidence score (0-100)
- `indicators` (Array<string>) - Detection indicators

**Detection Logic:**

- React dependency → `react_spa` (90% confidence)
- Express/Koa/Fastify → `nodejs_api` (85% confidence)
- Dev-only dependencies → `configuration_library` (60% confidence)
- Generic package.json → `nodejs_api` (60% confidence)

**Example:**

```javascript
import { analyzePackageJson } from 'ai-workflow/lib/project_kind_detection';

const packageJson = {
  name: 'my-api',
  dependencies: {
    express: '^4.18.0',
    cors: '^2.8.5',
  },
};

const result = analyzePackageJson(packageJson);
console.log(result);
// {
//   kind: 'nodejs_api',
//   confidence: 85,
//   indicators: ['backend_framework']
// }
```

---

### analyzeRequirementsTxt(requirementsContent)

Analyze `requirements.txt` to determine Python project type.

**Parameters:**

- `requirementsContent` (string) - Content of requirements.txt file

**Returns:** Object with:

- `kind` (string|null) - Detected project kind
- `confidence` (number) - Confidence score (0-100)
- `indicators` (Array<string>) - Detection indicators

**Detection Logic:**

- Flask/Django/FastAPI → `python_app` (85% confidence)
- NumPy/Pandas/ML packages → `python_app` (80% confidence)
- Generic requirements.txt → `python_app` (70% confidence)

**Example:**

```javascript
import { analyzeRequirementsTxt } from 'ai-workflow/lib/project_kind_detection';

const requirements = `
flask==2.3.0
gunicorn==21.2.0
psycopg2==2.9.9
`;

const result = analyzeRequirementsTxt(requirements);
console.log(result);
// {
//   kind: 'python_app',
//   confidence: 85,
//   indicators: ['web_framework']
// }
```

---

### detectByFilePatterns(files)

Detect project kind by analyzing file extensions and ratios.

**Parameters:**

- `files` (Array<string>) - List of file paths

**Returns:** Object with:

- `kind` (string|null) - Detected project kind
- `confidence` (number) - Confidence score (0-100)
- `indicators` (Array<string>) - Detection indicators

**Detection Logic:**

- > 30% shell scripts → `shell_script_automation` (80% confidence)
- HTML + no package.json → `static_website` (75% confidence)
- High YAML/MD ratio → `configuration_library` (70% confidence)

**Example:**

```javascript
import { detectByFilePatterns } from 'ai-workflow/lib/project_kind_detection';

const files = ['setup.sh', 'deploy.sh', 'cleanup.sh', 'README.md', 'config.yaml'];

const result = detectByFilePatterns(files);
console.log(result);
// {
//   kind: 'shell_script_automation',
//   confidence: 80,
//   indicators: ['high_shell_percentage']
// }
```

---

### detectByDirectoryStructure(directories)

Detect project kind by directory structure patterns.

**Parameters:**

- `directories` (Array<string>) - List of directory paths

**Returns:** Object with:

- `kind` (string|null) - Detected project kind
- `confidence` (number) - Confidence score (0-100)
- `indicators` (Array<string>) - Detection indicators

**Detection Logic:**

- `config/` + `docs/` + `examples/` → `configuration_library` (75% confidence)
- `public/` + `src/` → `react_spa` (65% confidence)
- `src/` + `tests/` → `generic` (50% confidence)

**Example:**

```javascript
import { detectByDirectoryStructure } from 'ai-workflow/lib/project_kind_detection';

const directories = ['/project/src', '/project/public', '/project/tests'];

const result = detectByDirectoryStructure(directories);
console.log(result);
// {
//   kind: 'react_spa',
//   confidence: 65,
//   indicators: ['spa_structure']
// }
```

---

### calculateConfidence(detectionResults)

Calculate overall confidence from multiple detection methods.

**Parameters:**

- `detectionResults` (Array<Object>) - Array of detection results

**Returns:** Object with:

- `kind` (string) - Best matching project kind
- `confidence` (number) - Combined confidence score (capped at 100)
- `indicators` (Array<string>) - All detection indicators

**Logic:**

- Groups results by kind
- Sums confidence scores
- Returns highest confidence match
- Falls back to `generic` if no valid detections

**Example:**

```javascript
import { calculateConfidence } from 'ai-workflow/lib/project_kind_detection';

const results = [
  { kind: 'nodejs_api', confidence: 85, indicators: ['backend_framework'] },
  { kind: 'nodejs_api', confidence: 60, indicators: ['has_package_json'] },
  { kind: null, confidence: 0, indicators: [] },
];

const best = calculateConfidence(results);
console.log(best);
// {
//   kind: 'nodejs_api',
//   confidence: 100,  // Capped at 100
//   indicators: ['backend_framework', 'has_package_json']
// }
```

---

## ProjectKindDetector Class

Wrapper class handling I/O operations and orchestrating detection.

### Constructor

```javascript
new ProjectKindDetector(projectRoot, options);
```

**Parameters:**

- `projectRoot` (string) - Root directory of project
- `options` (Object, optional) - Configuration options
  - `excludePatterns` (Array<string>) - Patterns to exclude (default: node_modules, .git, dist)
  - `maxDepth` (number) - Max directory depth to scan (default: 3)

**Example:**

```javascript
import { ProjectKindDetector } from 'ai-workflow/lib/project_kind_detection';

const detector = new ProjectKindDetector('/path/to/project', {
  excludePatterns: ['node_modules', '.git', 'dist', 'build'],
  maxDepth: 3,
});
```

---

### detect()

Run full detection process using all methods.

**Returns:** Promise<Object> with:

- `kind` (string) - Detected project kind
- `confidence` (number) - Confidence score
- `indicators` (Array<string>) - All indicators
- `methods` (Object) - Results from each detection method

**Example:**

```javascript
const detector = new ProjectKindDetector('/path/to/project');
const result = await detector.detect();

console.log(result);
// {
//   kind: 'nodejs_api',
//   confidence: 95,
//   indicators: ['backend_framework', 'has_package_json'],
//   methods: {
//     packageJson: { kind: 'nodejs_api', confidence: 85, indicators: [...] },
//     filePatterns: { kind: null, confidence: 0, indicators: [] },
//     directoryStructure: { kind: 'generic', confidence: 50, indicators: [...] }
//   }
// }
```

---

### detectFromPackageJson()

Detect project kind from package.json file.

**Returns:** Promise<Object> - Detection result

**Example:**

```javascript
const detector = new ProjectKindDetector('/path/to/project');
const result = await detector.detectFromPackageJson();

if (result.kind) {
  console.log(`Detected: ${result.kind} (${result.confidence}% confidence)`);
}
```

---

### detectFromRequirementsTxt()

Detect project kind from requirements.txt file.

**Returns:** Promise<Object> - Detection result

**Example:**

```javascript
const detector = new ProjectKindDetector('/path/to/python-project');
const result = await detector.detectFromRequirementsTxt();
```

---

### detectFromFiles()

Detect project kind by scanning all files.

**Returns:** Promise<Object> - Detection result

**Example:**

```javascript
const detector = new ProjectKindDetector('/path/to/project');
const result = await detector.detectFromFiles();
```

---

### detectFromDirectories()

Detect project kind by analyzing directory structure.

**Returns:** Promise<Object> - Detection result

**Example:**

```javascript
const detector = new ProjectKindDetector('/path/to/project');
const result = await detector.detectFromDirectories();
```

---

## Complete Usage Example

```javascript
import { ProjectKindDetector } from 'ai-workflow/lib/project_kind_detection';
import { logger } from 'ai-workflow/core/logger';

async function detectProjectType(projectPath) {
  // Create detector with custom options
  const detector = new ProjectKindDetector(projectPath, {
    excludePatterns: ['node_modules', '.git', 'dist', 'build', 'coverage'],
    maxDepth: 4,
  });

  // Run detection
  const result = await detector.detect();

  // Log results
  logger.info(`Project Kind: ${result.kind}`);
  logger.info(`Confidence: ${result.confidence}%`);
  logger.info(`Indicators: ${result.indicators.join(', ')}`);

  // Check confidence threshold
  if (result.confidence >= 75) {
    logger.success('High confidence detection');
  } else if (result.confidence >= 50) {
    logger.warn('Medium confidence - manual verification recommended');
  } else {
    logger.error('Low confidence - using generic fallback');
  }

  return result;
}

// Use it
const projectKind = await detectProjectType('/path/to/project');
console.log(`Final detection: ${projectKind.kind}`);
```

---

## Testing

Comprehensive test suite with 42 tests covering:

### Pure Function Tests

- Package.json analysis (10 tests)
- Requirements.txt analysis (8 tests)
- File pattern detection (8 tests)
- Directory structure detection (8 tests)
- Confidence calculation (8 tests)

### Integration Tests

- Full detection flow (5 tests)
- Error handling (5 tests)

**Run Tests:**

```bash
npm test -- test/lib/project_kind_detection.test.js
```

---

## Error Handling

All methods handle errors gracefully:

```javascript
try {
  const detector = new ProjectKindDetector('/invalid/path');
  const result = await detector.detect();
} catch (error) {
  console.error('Detection failed:', error.message);
  // Falls back to generic kind
}
```

**Common Errors:**

- Invalid project root → Falls back to `generic`
- Missing files → Skips that detection method
- Invalid file content → Returns null detection

---

## Performance

**Typical Performance:**

- Package.json analysis: <1ms
- Requirements.txt analysis: <1ms
- File pattern scan (1000 files): 10-50ms
- Directory structure scan: 5-20ms
- Full detection: 20-100ms (depending on project size)

**Optimization Tips:**

- Use `maxDepth` to limit directory scanning
- Add exclusion patterns for large directories
- Run detection once and cache result

---

## Related Documentation

- **[project_kind_config](./project_kind_config.md)** - Load project kind configurations
- **[tech_stack](./tech_stack.md)** - Detect technology stack
- **[third_party_exclusion](./third_party_exclusion.md)** - Filter third-party files
- **[Configuration Guide](../guides/CONFIGURATION_GUIDE.md)** - Project configuration
- **[Developer Guide](../guides/DEVELOPER_GUIDE.md)** - Development patterns

---

## Changelog

### v1.0.0 (2026-02-01)

- ✅ Initial implementation
- ✅ 8 project kind support
- ✅ Multi-method detection
- ✅ Confidence scoring
- ✅ 42 comprehensive tests

---

**Need Help?** Check the [User Guide](../guides/USER_GUIDE.md) or [open an issue](https://github.com/mpbarbosa/ai_workflow.js/issues).
