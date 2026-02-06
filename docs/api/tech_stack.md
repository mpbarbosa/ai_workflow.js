# tech_stack - Tech Stack Detection Module

**Module:** `lib/tech_stack`  
**Version:** 1.0.0  
**Type:** Pure Functions + Wrapper

## Overview

Automatically detects programming languages, frameworks, build systems, test frameworks, and linters in a project. Analyzes file patterns, package managers, and configuration files to build a comprehensive tech stack profile.

---

## Architecture

**Pure Functions** (exported for testing):

- `detectLanguagesFromFiles()` - Detect languages from file extensions
- `detectFrameworksFromPackageJson()` - Extract frameworks from package.json
- `detectFrameworksFromRequirements()` - Extract frameworks from requirements.txt
- `detectBuildSystem()` - Identify build system (npm, yarn, cargo, etc.)
- `detectTestFramework()` - Identify test framework
- `detectLinters()` - Find configured linters
- `generateTechStackReport()` - Format tech stack as human-readable report

**Wrapper Class**:

- `TechStackDetector` - Handles file I/O and caching

---

## Pure Functions

### `detectLanguagesFromFiles(files)`

Detects programming languages from file extensions.

**Parameters:**

- `files` (Array\<string\>) - List of file paths to analyze

**Returns:** Object with `{ languages: string[], primary: string }`

- `languages` - All detected languages, sorted by frequency
- `primary` - Most common language (excluding config files like JSON/YAML)

**Supported Languages:**

- JavaScript (.js, .mjs, .cjs, .jsx)
- TypeScript (.ts, .tsx)
- Python (.py, .pyw)
- Shell (.sh, .bash)
- Go (.go)
- Rust (.rs)
- Java (.java)
- YAML/JSON/Markdown/HTML/CSS

**Example:**

```javascript
import { detectLanguagesFromFiles } from './lib/tech_stack.js';

const files = ['src/app.js', 'test/test.js', 'README.md'];
const result = detectLanguagesFromFiles(files);
// {
//   languages: ['javascript', 'markdown'],
//   primary: 'javascript'
// }
```

---

### `detectFrameworksFromPackageJson(packageJson)`

Extracts frameworks from package.json dependencies.

**Parameters:**

- `packageJson` (Object) - Parsed package.json content

**Returns:** Array\<Object\> with `[{ name, type, version, package }]`

**Detected Framework Types:**

- **Web Frameworks**: Express, Koa, NestJS, Fastify, Hapi
- **Frontend**: React, Vue, Angular, Svelte
- **Meta-Frameworks**: Next.js, Gatsby, Nuxt.js
- **Test Frameworks**: Jest, Mocha, Vitest, Playwright, Cypress
- **Build Tools**: Webpack, Vite, Rollup, esbuild, Parcel

**Example:**

```javascript
const packageJson = {
  dependencies: { express: '^4.18.0', react: '^18.0.0' },
  devDependencies: { jest: '^29.0.0' },
};

const frameworks = detectFrameworksFromPackageJson(packageJson);
// [
//   { name: 'Express.js', type: 'web-framework', version: '^4.18.0', package: 'express' },
//   { name: 'React', type: 'frontend-framework', version: '^18.0.0', package: 'react' },
//   { name: 'Jest', type: 'test-framework', version: '^29.0.0', package: 'jest' }
// ]
```

---

### `detectFrameworksFromRequirements(requirementsTxt)`

Extracts frameworks from Python requirements.txt.

**Parameters:**

- `requirementsTxt` (string) - Contents of requirements.txt file

**Returns:** Array\<Object\> with `[{ name, type, version, package }]`

**Detected Frameworks:**

- **Web**: Flask, Django, FastAPI, Tornado, Pyramid
- **Testing**: pytest, unittest2
- **Data Science**: Pandas, NumPy, TensorFlow, PyTorch

**Example:**

```javascript
const requirements = `
flask==2.0.0
pytest>=7.0.0
pandas
`;

const frameworks = detectFrameworksFromRequirements(requirements);
// [
//   { name: 'Flask', type: 'web-framework', version: '2.0.0', package: 'flask' },
//   { name: 'Pytest', type: 'test-framework', version: '7.0.0', package: 'pytest' },
//   { name: 'Pandas', type: 'data-library', version: '', package: 'pandas' }
// ]
```

---

### `detectBuildSystem(files, packageJson)`

Detects build system from project files.

**Parameters:**

- `files` (Array\<string\>) - List of file paths
- `packageJson` (Object) - Parsed package.json (optional)

**Returns:** Object with `{ name, files }`

**Detected Build Systems:**

- **JavaScript**: npm, yarn, pnpm
- **Rust**: cargo
- **Go**: go modules
- **Java**: maven, gradle
- **Python**: poetry, setuptools
- **Generic**: make

**Example:**

```javascript
const files = ['package.json', 'yarn.lock', 'src/app.js'];
const buildSystem = detectBuildSystem(files);
// { name: 'yarn', files: ['package.json', 'yarn.lock'] }
```

---

### `detectTestFramework(packageJson, files)`

Detects test framework from configuration.

**Parameters:**

- `packageJson` (Object) - Parsed package.json
- `files` (Array\<string\>) - List of file paths

**Returns:** Object with `{ name, command }`

**Detected Frameworks:**

- **JavaScript**: Jest, Vitest, Mocha, Playwright
- **Python**: pytest
- **Shell**: bash_unit

**Example:**

```javascript
const packageJson = { devDependencies: { jest: '^29.0.0' } };
const result = detectTestFramework(packageJson, []);
// { name: 'jest', command: 'npm test' }
```

---

### `detectLinters(files, packageJson)`

Detects configured linters.

**Parameters:**

- `files` (Array\<string\>) - List of file paths
- `packageJson` (Object) - Parsed package.json (optional)

**Returns:** Array\<Object\> with `[{ name, configFile }]`

**Detected Linters:**

- **JavaScript**: ESLint, Prettier
- **Python**: pylint, flake8, black
- **Shell**: shellcheck

**Example:**

```javascript
const files = ['.eslintrc.json', '.prettierrc', 'app.js'];
const linters = detectLinters(files);
// [
//   { name: 'eslint', configFile: '.eslintrc.*' },
//   { name: 'prettier', configFile: '.prettierrc' }
// ]
```

---

### `generateTechStackReport(techStack)`

Generates human-readable tech stack report.

**Parameters:**

- `techStack` (Object) - Complete tech stack data

**Returns:** String - Formatted markdown report

**Example:**

```javascript
const report = generateTechStackReport({
  primary_language: 'javascript',
  languages: ['javascript', 'markdown'],
  frameworks: [{ name: 'React', type: 'frontend-framework' }],
  build_system: 'npm',
  test_framework: 'jest',
  linters: [{ name: 'eslint' }],
});

console.log(report);
// === Tech Stack Report ===
//
// Languages:
//   Primary: javascript
//   All: javascript, markdown
//
// Frameworks:
//   - React (frontend-framework)
// ...
```

---

## TechStackDetector Class

Wrapper for tech stack detection with file I/O and caching.

### Constructor

```javascript
new TechStackDetector(options);
```

**Options:**

- `projectRoot` (string) - Project root directory (default: `process.cwd()`)
- `fileOps` (FileOperations) - File operations instance
- `verbose` (boolean) - Enable verbose logging

### Methods

#### `async detectTechStack(projectRoot)`

Detects complete tech stack for a project.

**Parameters:**

- `projectRoot` (string) - Optional override for project root

**Returns:** Promise\<Object\> with complete tech stack information

**Example:**

```javascript
import { TechStackDetector } from './lib/tech_stack.js';

const detector = new TechStackDetector({
  projectRoot: '/path/to/project',
  verbose: true,
});

const techStack = await detector.detectTechStack();
console.log(techStack);
// {
//   primary_language: 'javascript',
//   languages: ['javascript', 'typescript'],
//   frameworks: [...],
//   build_system: 'npm',
//   test_framework: 'jest',
//   linters: [...],
//   detected_at: '2026-02-01T12:00:00.000Z'
// }
```

#### `async generateReport(projectRoot)`

Generates formatted tech stack report.

**Returns:** Promise\<string\> - Formatted report

**Example:**

```javascript
const report = await detector.generateReport();
console.log(report);
```

#### `clearCache()`

Clears cached tech stack data.

**Example:**

```javascript
detector.clearCache();
```

---

## Usage Examples

### Complete Tech Stack Detection

```javascript
import { TechStackDetector } from './lib/tech_stack.js';

const detector = new TechStackDetector({
  projectRoot: '/path/to/project',
});

const techStack = await detector.detectTechStack();

console.log(`Primary Language: ${techStack.primary_language}`);
console.log(`Build System: ${techStack.build_system}`);
console.log(`Test Framework: ${techStack.test_framework}`);
console.log(`Frameworks: ${techStack.frameworks.map((f) => f.name).join(', ')}`);
```

### Using Pure Functions

```javascript
import { detectLanguagesFromFiles, detectBuildSystem, detectLinters } from './lib/tech_stack.js';

// Analyze specific files
const files = await getProjectFiles();

const languages = detectLanguagesFromFiles(files);
const buildSys = detectBuildSystem(files);
const linters = detectLinters(files);

console.log(`Detected ${languages.languages.length} languages`);
console.log(`Build system: ${buildSys.name}`);
console.log(`Linters: ${linters.map((l) => l.name).join(', ')}`);
```

### Custom Tech Stack Analysis

```javascript
import { detectFrameworksFromPackageJson } from './lib/tech_stack.js';
import fs from 'fs/promises';

// Load and analyze package.json
const packageJson = JSON.parse(await fs.readFile('package.json', 'utf8'));
const frameworks = detectFrameworksFromPackageJson(packageJson);

// Filter by type
const webFrameworks = frameworks.filter((f) => f.type === 'web-framework');
const testFrameworks = frameworks.filter((f) => f.type === 'test-framework');

console.log('Web Frameworks:', webFrameworks);
console.log('Test Frameworks:', testFrameworks);
```

---

## Error Handling

The wrapper class handles errors gracefully:

```javascript
try {
  const techStack = await detector.detectTechStack();
  if (techStack.error) {
    console.error('Detection failed:', techStack.error);
    // techStack will contain empty arrays for all fields
  }
} catch (error) {
  console.error('Detection error:', error.message);
}
```

---

## Related Modules

- **[project_kind_detection](./project_kind_detection.md)** - Uses tech stack data for project type detection
- **[project_kind_config](./project_kind_config.md)** - Configuration for different project kinds
- **[third_party_exclusion](./third_party_exclusion.md)** - Filters files before tech stack analysis
- **[file_operations](./file_operations.md)** - File system operations

---

## Performance

- **Caching**: Results cached per project root to avoid repeated analysis
- **File Filtering**: Automatically excludes node_modules, .git, dist, build
- **Lazy Loading**: Only loads configuration files when needed

---

**Last Updated:** 2026-02-01  
**Part of:** AI Workflow Automation v1.2.0 (Phase 4)
