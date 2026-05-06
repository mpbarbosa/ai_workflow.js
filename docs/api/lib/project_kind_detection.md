# Project Kind Detection API

**Module:** `lib/project_kind_detection`
**Version:** 2.3.1
**Architecture:** Pure Functions + Wrapper Class

## Overview

The Project Kind Detection module automatically detects project type based on file patterns, directory structure, and configuration files. It supports 8 project kinds with confidence scoring for accurate classification.

### Key Features

- **Multi-Source Detection**: Analyzes package.json, requirements.txt, file patterns, and directory structure
- **Confidence Scoring**: Returns confidence levels (0-100) for detection accuracy
- **8 Project Kinds**: nodejs_api, react_spa, python_app, shell_script_automation, static_website, client_spa, configuration_library, generic
- **Indicator Tracking**: Provides detailed indicators explaining detection decisions
- **Composite Analysis**: Combines multiple detection methods for accuracy

### Supported Project Kinds

- **nodejs_api** - Node.js backend APIs (Express, Koa, Fastify, NestJS)
- **react_spa** - React single-page applications
- **python_app** - Python applications (Flask, Django, FastAPI)
- **shell_script_automation** - Shell script projects
- **static_website** - Static HTML/CSS/JS websites
- **client_spa** - Client-side SPAs (Vue, Angular, Svelte)
- **configuration_library** - Configuration/tooling libraries
- **generic** - Generic projects (fallback)

### Architecture

**Pure Functions:**

- `analyzePackageJson()` - Detect from package.json
- `analyzeRequirementsTxt()` - Detect from requirements.txt
- `detectByFilePatterns()` - Detect from file extensions and names
- `detectByDirectoryStructure()` - Detect from directory layout
- `calculateConfidence()` - Calculate overall confidence from multiple results

**Impure Wrapper:**

- `ProjectKindDetector` class - Orchestrates detection with file I/O

---

## Installation

```javascript
import {
  ProjectKindDetector,
  analyzePackageJson,
  analyzeRequirementsTxt,
  detectByFilePatterns,
  detectByDirectoryStructure,
  calculateConfidence,
} from 'ai_workflow.js/lib/project_kind_detection';
```

---

## Pure Functions

### `analyzePackageJson(packageJson)`

Analyzes package.json to determine Node.js project type.

**Parameters:**

- `packageJson` (Object) - Parsed package.json content

**Returns:** Object with:

- `kind` (string | null) - Detected project kind
- `confidence` (number) - Confidence score (0-100)
- `indicators` (Array<string>) - Detection indicators

**Pure:** ✅ Deterministic, no side effects

**Detection Logic:**

1. **React SPA** (90% confidence): React + react-dom dependencies
2. **Node.js API** (85% confidence): Backend frameworks (express, koa, fastify, @nestjs/core)
3. **Configuration Library** (60% confidence): Only devDependencies present
4. **Generic Node.js** (60% confidence): Has package.json name

**Example:**

```javascript
const packageJson = {
  name: 'my-api',
  dependencies: {
    express: '^4.18.0',
    cors: '^2.8.5',
  },
};

const result = analyzePackageJson(packageJson);
// => { kind: 'nodejs_api', confidence: 85, indicators: ['backend_framework'] }
```

---

### `analyzeRequirementsTxt(requirementsContent)`

Analyzes requirements.txt to determine Python project type.

**Parameters:**

- `requirementsContent` (string) - Content of requirements.txt file

**Returns:** Object with `kind`, `confidence`, `indicators`

**Pure:** ✅ Deterministic, no side effects

**Detection Logic:**

1. **Python App** (85% confidence): Web frameworks (flask, django, fastapi, tornado)
2. **Python App** (80% confidence): Data science packages (numpy, pandas, scikit-learn, tensorflow)
3. **Generic Python** (60% confidence): Has requirements.txt

**Example:**

```javascript
const requirements = `
flask==2.3.1
sqlalchemy==2.0.0
requests==2.28.0
`;

const result = analyzeRequirementsTxt(requirements);
// => { kind: 'python_app', confidence: 85, indicators: ['web_framework'] }
```

---

### `detectByFilePatterns(files)`

Detects project kind from file extensions and special file names.

**Parameters:**

- `files` (Array<string>) - Array of file paths

**Returns:** Object with `kind`, `confidence`, `indicators`

**Pure:** ✅ Deterministic, no side effects

**File Patterns:**

- **nodejs_api**: `server.js`, `app.js`, `index.js` + `.js` files
- **react_spa**: `App.jsx`, `index.tsx`, + `.jsx/.tsx` files
- **python_app**: `app.py`, `main.py`, `__init__.py` + `.py` files
- **shell_script_automation**: Multiple `.sh` files
- **static_website**: `index.html` + HTML/CSS files

**Example:**

```javascript
const files = ['src/app.js', 'src/server.js', 'src/routes/users.js', 'test/app.test.js'];

const result = detectByFilePatterns(files);
// => { kind: 'nodejs_api', confidence: 75, indicators: ['has_server_js', 'has_javascript_files'] }
```

---

### `detectByDirectoryStructure(directories)`

Detects project kind from directory names and layout.

**Parameters:**

- `directories` (Array<string>) - Array of directory paths

**Returns:** Object with `kind`, `confidence`, `indicators`

**Pure:** ✅ Deterministic, no side effects

**Directory Patterns:**

- **nodejs_api**: `routes/`, `controllers/`, `models/`, `middleware/`
- **react_spa**: `components/`, `pages/`, `hooks/`, `public/`
- **python_app**: `app/`, `models/`, `views/`, `templates/`
- **static_website**: `assets/`, `css/`, `images/`, `js/`

**Example:**

```javascript
const dirs = ['src/', 'src/routes/', 'src/controllers/', 'src/models/', 'test/'];

const result = detectByDirectoryStructure(dirs);
// => { kind: 'nodejs_api', confidence: 80, indicators: ['has_routes_dir', 'has_controllers_dir', 'has_models_dir'] }
```

---

### `calculateConfidence(detectionResults)`

Calculates overall confidence from multiple detection results using weighted average.

**Parameters:**

- `detectionResults` (Array<Object>) - Array of detection results from different methods

**Returns:** Object with:

- `kind` (string) - Most confident project kind
- `confidence` (number) - Overall confidence score
- `indicators` (Array<string>) - Combined indicators
- `sources` (Array<Object>) - Individual source results

**Pure:** ✅ Deterministic, no side effects

**Calculation Strategy:**

- Averages confidence scores for same kind
- Selects kind with highest average confidence
- Combines all indicators
- Tracks source methods

**Example:**

```javascript
const results = [
  { kind: 'nodejs_api', confidence: 85, indicators: ['backend_framework'] },
  { kind: 'nodejs_api', confidence: 75, indicators: ['has_server_js'] },
  { kind: 'nodejs_api', confidence: 80, indicators: ['has_routes_dir'] },
];

const overall = calculateConfidence(results);
// => {
//   kind: 'nodejs_api',
//   confidence: 80,  // Average of 85, 75, 80
//   indicators: ['backend_framework', 'has_server_js', 'has_routes_dir'],
//   sources: [...]
// }
```

---

## ProjectKindDetector Class

Wrapper class for project kind detection with file I/O operations.

### Constructor

```javascript
const detector = new ProjectKindDetector(options);
```

**Options:**

- `fileOps` (FileOperations) - File operations instance (default: new FileOperations())
- `verbose` (boolean) - Enable verbose logging (default: false)

**Example:**

```javascript
const detector = new ProjectKindDetector({
  verbose: true,
});
```

---

### Methods

#### `async detect(projectRoot)`

Detects project kind using all available methods.

**Parameters:**

- `projectRoot` (string) - Path to project root directory

**Returns:** Promise<Object> with:

- `kind` (string) - Detected project kind
- `confidence` (number) - Confidence score
- `indicators` (Array<string>) - Detection indicators
- `sources` (Array<Object>) - Individual detection results

**Side Effects:**

- Reads files from disk
- Logs detection progress (if verbose)

**Example:**

```javascript
const result = await detector.detect('/path/to/project');

console.log(`Detected: ${result.kind} (${result.confidence}% confidence)`);
console.log(`Indicators: ${result.indicators.join(', ')}`);

if (result.confidence < 70) {
  console.log('Low confidence - may need manual verification');
}
```

---

#### `async detectFromPackageJson(projectRoot)`

Detects from package.json only.

**Parameters:**

- `projectRoot` (string) - Project root path

**Returns:** Promise<Object> - Detection result

**Example:**

```javascript
const result = await detector.detectFromPackageJson('/path/to/project');
if (result.kind === 'nodejs_api') {
  console.log('Node.js API detected');
}
```

---

#### `async detectFromRequirements(projectRoot)`

Detects from requirements.txt only.

**Parameters:**

- `projectRoot` (string) - Project root path

**Returns:** Promise<Object> - Detection result

**Example:**

```javascript
const result = await detector.detectFromRequirements('/path/to/project');
if (result.kind === 'python_app') {
  console.log('Python application detected');
}
```

---

#### `async detectFromFiles(projectRoot)`

Detects from file patterns.

**Parameters:**

- `projectRoot` (string) - Project root path

**Returns:** Promise<Object> - Detection result

**Example:**

```javascript
const result = await detector.detectFromFiles('/path/to/project');
console.log(`File pattern detection: ${result.kind}`);
```

---

#### `async detectFromDirectories(projectRoot)`

Detects from directory structure.

**Parameters:**

- `projectRoot` (string) - Project root path

**Returns:** Promise<Object> - Detection result

**Example:**

```javascript
const result = await detector.detectFromDirectories('/path/to/project');
console.log(`Directory structure detection: ${result.kind}`);
```

---

## Usage Examples

### Basic Project Detection

```javascript
import { ProjectKindDetector } from 'ai_workflow.js/lib/project_kind_detection';

const detector = new ProjectKindDetector();

// Detect project kind
const result = await detector.detect('/path/to/project');

console.log(`Project Kind: ${result.kind}`);
console.log(`Confidence: ${result.confidence}%`);
console.log(`Indicators: ${result.indicators.join(', ')}`);

// Check confidence threshold
if (result.confidence >= 80) {
  console.log('High confidence detection');
} else if (result.confidence >= 60) {
  console.log('Medium confidence - verify manually');
} else {
  console.log('Low confidence - manual classification recommended');
}
```

### Analyzing package.json Directly

```javascript
import { analyzePackageJson } from 'ai_workflow.js/lib/project_kind_detection';

const packageJson = {
  name: 'my-react-app',
  dependencies: {
    react: '^18.2.0',
    'react-dom': '^18.2.0',
    'react-router-dom': '^6.8.0',
  },
  devDependencies: {
    vite: '^4.1.0',
    '@vitejs/plugin-react': '^3.1.0',
  },
};

const result = analyzePackageJson(packageJson);
// => { kind: 'react_spa', confidence: 90, indicators: ['react_dependency', 'react_dom'] }
```

### Analyzing Python Projects

```javascript
import { analyzeRequirementsTxt } from 'ai_workflow.js/lib/project_kind_detection';

const requirements = `
Django==4.2.0
djangorestframework==3.14.0
psycopg2-binary==2.9.5
celery==5.2.7
`;

const result = analyzeRequirementsTxt(requirements);
// => { kind: 'python_app', confidence: 85, indicators: ['web_framework'] }
```

### File Pattern Detection

```javascript
import { detectByFilePatterns } from 'ai_workflow.js/lib/project_kind_detection';

const files = [
  'index.html',
  'css/style.css',
  'js/main.js',
  'images/logo.png',
  'about.html',
  'contact.html',
];

const result = detectByFilePatterns(files);
// => { kind: 'static_website', confidence: 85, indicators: ['has_index_html', 'has_html_files'] }
```

### Directory Structure Detection

```javascript
import { detectByDirectoryStructure } from 'ai_workflow.js/lib/project_kind_detection';

const dirs = ['src', 'src/components', 'src/pages', 'src/hooks', 'public', 'node_modules'];

const result = detectByDirectoryStructure(dirs);
// => { kind: 'react_spa', confidence: 85, indicators: ['has_components_dir', 'has_pages_dir', 'has_hooks_dir'] }
```

### Composite Detection with Confidence

```javascript
import { ProjectKindDetector } from 'ai_workflow.js/lib/project_kind_detection';

const detector = new ProjectKindDetector({ verbose: true });

// Full detection using all methods
const result = await detector.detect('/path/to/project');

console.log('=== Detection Report ===');
console.log(`Primary: ${result.kind} (${result.confidence}%)`);
console.log('\nIndicators:');
result.indicators.forEach((ind) => console.log(`  - ${ind}`));

console.log('\nSource Breakdown:');
result.sources.forEach((source) => {
  console.log(`  ${source.method}: ${source.kind} (${source.confidence}%)`);
});

// Make decision based on confidence
if (result.confidence >= 80) {
  // Proceed with automated workflow
  console.log('\n✓ High confidence - proceeding with automation');
} else {
  // Request manual verification
  console.log('\n⚠ Low confidence - requesting manual verification');
}
```

### Detection with Fallback

```javascript
import { ProjectKindDetector } from 'ai_workflow.js/lib/project_kind_detection';

async function detectWithFallback(projectRoot) {
  const detector = new ProjectKindDetector();

  // Try primary detection
  let result = await detector.detect(projectRoot);

  // Fallback if confidence too low
  if (result.confidence < 60) {
    console.log('Low confidence, trying individual methods...');

    // Try package.json
    const pkgResult = await detector.detectFromPackageJson(projectRoot);
    if (pkgResult.confidence > result.confidence) {
      result = pkgResult;
    }

    // Try requirements.txt
    const reqResult = await detector.detectFromRequirements(projectRoot);
    if (reqResult.confidence > result.confidence) {
      result = reqResult;
    }

    // Try file patterns
    const fileResult = await detector.detectFromFiles(projectRoot);
    if (fileResult.confidence > result.confidence) {
      result = fileResult;
    }
  }

  // Final fallback to generic
  if (!result.kind || result.confidence < 40) {
    result = { kind: 'generic', confidence: 50, indicators: ['fallback'] };
  }

  return result;
}

const result = await detectWithFallback('/path/to/project');
console.log(`Final detection: ${result.kind}`);
```

---

## Related Modules

- **project_kind_config** - Loads configuration for detected project kinds
- **tech_stack** - Detects specific technologies used in project
- **third_party_exclusion** - Uses project kind for exclusion patterns
- **file_operations** - Used for file system access

---

## Notes

- **Confidence Threshold**: Scores ≥80% are highly reliable, 60-79% are moderate, <60% need verification
- **Multiple Methods**: Using all detection methods improves accuracy
- **Fallback to Generic**: If no specific kind detected, defaults to 'generic'
- **Caching**: Results can be cached to avoid repeated detection
- **Extensibility**: Easy to add new project kinds by extending detection patterns

---

**Last Updated:** 2026-02-07
**Author:** AI Workflow Team
