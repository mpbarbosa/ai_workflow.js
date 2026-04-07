# Tech Stack Detection API

**Module:** `lib/tech_stack`
**Version:** 1.9.8
**Architecture:** Pure Functions + Wrapper Class

## Overview

The Tech Stack Detection module identifies programming languages, frameworks, build systems, test frameworks, and linters used in a project. It provides comprehensive technology stack analysis for workflow customization.

### Key Features

- **Language Detection**: 11 languages from file extensions
- **Framework Detection**: 20+ web/frontend/meta frameworks
- **Build System Detection**: 10+ build tools (webpack, vite, rollup, etc.)
- **Test Framework Detection**: Jest, Mocha, Vitest, Pytest, etc.
- **Linter Detection**: ESLint, Pylint, RuboCop, etc.
- **Tech Stack Reports**: Generate formatted technology reports
- **Primary Language**: Identify main programming language

### Detected Technologies

**Languages (11):**

- javascript, typescript, python, shell, go, rust, java, yaml, json, markdown, html/css

**Web Frameworks (5):**

- Express.js, Koa, NestJS, Fastify, Hapi

**Frontend Frameworks (5):**

- React, Vue.js, Angular, Svelte, Preact

**Meta Frameworks (4):**

- Next.js, Nuxt, Gatsby, Remix

**Build Systems (10+):**

- webpack, vite, rollup, parcel, esbuild, tsc, babel, etc.

**Test Frameworks (8):**

- Jest, Mocha, Vitest, Pytest, Unittest, etc.

**Linters (5):**

- ESLint, Prettier, Pylint, Black, etc.

### Architecture

**Pure Functions:**

- `detectLanguagesFromFiles()` - Detect languages from file extensions
- `detectFrameworksFromPackageJson()` - Detect Node.js frameworks
- `detectFrameworksFromRequirements()` - Detect Python frameworks
- `detectBuildSystem()` - Detect build tools
- `detectTestFramework()` - Detect test frameworks
- `detectLinters()` - Detect code linters
- `generateTechStackReport()` - Generate formatted report

**Impure Wrapper:**

- `TechStackDetector` class - Tech stack detection with file I/O

---

## Installation

```javascript
import {
  TechStackDetector,
  detectLanguagesFromFiles,
  detectFrameworksFromPackageJson,
  detectFrameworksFromRequirements,
  detectBuildSystem,
  detectTestFramework,
  detectLinters,
  generateTechStackReport,
} from 'ai_workflow.js/lib/tech_stack';
```

---

## Pure Functions

### `detectLanguagesFromFiles(files)`

Detects programming languages from file extensions with frequency analysis.

**Parameters:**

- `files` (Array<string>) - Array of file paths

**Returns:** Object with:

- `languages` (Array<string>) - Detected languages sorted by frequency
- `primary` (string | null) - Primary language (most common code language)

**Pure:** ✅ Deterministic, no side effects

**Example:**

```javascript
const files = [
  'src/index.js',
  'src/utils.js',
  'src/types.ts',
  'README.md',
  'package.json',
  'test/test.js',
];

const result = detectLanguagesFromFiles(files);
// => {
//   languages: ['javascript', 'typescript', 'json', 'markdown'],
//   primary: 'javascript'
// }
```

---

### `detectFrameworksFromPackageJson(packageJson)`

Detects web and frontend frameworks from package.json dependencies.

**Parameters:**

- `packageJson` (Object) - Parsed package.json content

**Returns:** Array<Object> - Detected frameworks with:

- `name` (string) - Framework name
- `type` (string) - Framework type (web-framework, frontend-framework, meta-framework, etc.)
- `version` (string) - Installed version

**Pure:** ✅ Deterministic, no side effects

**Example:**

```javascript
const packageJson = {
  dependencies: {
    express: '^4.18.0',
    react: '^18.2.0',
    'react-dom': '^18.2.0',
    next: '^13.0.0',
  },
};

const frameworks = detectFrameworksFromPackageJson(packageJson);
// => [
//   { name: 'Express.js', type: 'web-framework', version: '^4.18.0' },
//   { name: 'React', type: 'frontend-framework', version: '^18.2.0' },
//   { name: 'Next.js', type: 'meta-framework', version: '^13.0.0' }
// ]
```

---

### `detectFrameworksFromRequirements(requirementsTxt)`

Detects Python web frameworks from requirements.txt content.

**Parameters:**

- `requirementsTxt` (string) - Content of requirements.txt file

**Returns:** Array<Object> - Detected frameworks

**Pure:** ✅ Deterministic, no side effects

**Example:**

```javascript
const requirements = `
Flask==2.3.0
Django==4.2.0
requests==2.28.0
`;

const frameworks = detectFrameworksFromRequirements(requirements);
// => [
//   { name: 'Flask', type: 'web-framework', version: '2.3.0' },
//   { name: 'Django', type: 'web-framework', version: '4.2.0' }
// ]
```

---

### `detectBuildSystem(files, packageJson = null)`

Detects build system from config files and package.json scripts.

**Parameters:**

- `files` (Array<string>) - Project files
- `packageJson` (Object, optional) - Parsed package.json

**Returns:** Object with:

- `buildSystem` (string | null) - Detected build system
- `configFiles` (Array<string>) - Found configuration files

**Pure:** ✅ Deterministic, no side effects

**Detection Logic:**

- Config files: `webpack.config.js`, `vite.config.js`, `rollup.config.js`, etc.
- Package.json scripts: `build`, `bundle`, `compile`
- TypeScript: `tsconfig.json`

**Example:**

```javascript
const files = ['vite.config.js', 'tsconfig.json', 'package.json'];
const packageJson = {
  scripts: {
    build: 'vite build',
    dev: 'vite',
  },
};

const result = detectBuildSystem(files, packageJson);
// => { buildSystem: 'vite', configFiles: ['vite.config.js'] }
```

---

### `detectTestFramework(packageJson, files)`

Detects test framework from dependencies and config files.

**Parameters:**

- `packageJson` (Object) - Parsed package.json
- `files` (Array<string>) - Project files

**Returns:** Object with:

- `testFramework` (string | null) - Detected test framework
- `runners` (Array<string>) - Test runners found
- `configFiles` (Array<string>) - Test config files

**Pure:** ✅ Deterministic, no side effects

**Example:**

```javascript
const packageJson = {
  devDependencies: {
    jest: '^29.0.0',
    '@testing-library/react': '^13.0.0',
  },
};

const files = ['jest.config.js', 'test/setup.js'];

const result = detectTestFramework(packageJson, files);
// => {
//   testFramework: 'jest',
//   runners: ['jest'],
//   configFiles: ['jest.config.js']
// }
```

---

### `detectLinters(files, packageJson = null)`

Detects code linters and formatters from config files and dependencies.

**Parameters:**

- `files` (Array<string>) - Project files
- `packageJson` (Object, optional) - Parsed package.json

**Returns:** Object with:

- `linters` (Array<string>) - Detected linters
- `formatters` (Array<string>) - Detected formatters
- `configFiles` (Array<string>) - Linter config files

**Pure:** ✅ Deterministic, no side effects

**Example:**

```javascript
const files = ['.eslintrc.js', '.prettierrc', 'pyproject.toml'];
const packageJson = {
  devDependencies: {
    eslint: '^8.0.0',
    prettier: '^2.8.0',
  },
};

const result = detectLinters(files, packageJson);
// => {
//   linters: ['eslint'],
//   formatters: ['prettier'],
//   configFiles: ['.eslintrc.js', '.prettierrc']
// }
```

---

### `generateTechStackReport(techStack)`

Generates formatted tech stack report from detection results.

**Parameters:**

- `techStack` (Object) - Complete tech stack object

**Returns:** string - Formatted markdown report

**Pure:** ✅ Deterministic, no side effects

**Example:**

```javascript
const techStack = {
  languages: ['javascript', 'typescript'],
  primary_language: 'javascript',
  frameworks: [{ name: 'React', type: 'frontend-framework' }],
  build_system: { buildSystem: 'vite' },
  test_framework: { testFramework: 'vitest' },
  linters: { linters: ['eslint'], formatters: ['prettier'] },
};

const report = generateTechStackReport(techStack);
console.log(report);
// => Markdown formatted report with all tech stack information
```

---

## TechStackDetector Class

Wrapper class for tech stack detection with file I/O operations.

### Constructor

```javascript
const detector = new TechStackDetector(options);
```

**Options:**

- `projectRoot` (string) - Project root directory (default: process.cwd())
- `fileOps` (FileOperations) - File operations instance
- `verbose` (boolean) - Enable verbose logging (default: false)

**Example:**

```javascript
const detector = new TechStackDetector({
  projectRoot: '/path/to/project',
  verbose: true,
});
```

---

### Methods

#### `async detectTechStack(projectRoot = null)`

Detects complete tech stack for a project with caching.

**Parameters:**

- `projectRoot` (string, optional) - Project root (uses constructor value if not provided)

**Returns:** Promise<Object> with:

- `languages` (Array<string>) - Detected languages
- `primary_language` (string) - Primary language
- `frameworks` (Array<Object>) - Detected frameworks
- `build_system` (Object) - Build system info
- `test_framework` (Object) - Test framework info
- `linters` (Object) - Linters and formatters

**Side Effects:**

- Reads files from disk
- Caches results in memory
- Logs detection progress (if verbose)

**Example:**

```javascript
const techStack = await detector.detectTechStack();

console.log('Languages:', techStack.languages);
console.log('Primary:', techStack.primary_language);
console.log(
  'Frameworks:',
  techStack.frameworks.map((f) => f.name)
);
console.log('Build System:', techStack.build_system.buildSystem);
console.log('Test Framework:', techStack.test_framework.testFramework);
console.log('Linters:', techStack.linters.linters);
```

---

#### `async generateReport(projectRoot = null)`

Generates formatted tech stack report.

**Parameters:**

- `projectRoot` (string, optional) - Project root

**Returns:** Promise<string> - Markdown formatted report

**Example:**

```javascript
const report = await detector.generateReport();
console.log(report);

// Save to file
const fs = require('fs/promises');
await fs.writeFile('tech-stack.md', report);
```

---

#### `clearCache()`

Clears the tech stack detection cache.

**Example:**

```javascript
detector.clearCache();
// Next detection will scan project again
```

---

## Usage Examples

### Complete Tech Stack Detection

```javascript
import { TechStackDetector } from 'ai_workflow.js/lib/tech_stack';

const detector = new TechStackDetector({
  projectRoot: '/path/to/project',
  verbose: true,
});

const techStack = await detector.detectTechStack();

console.log('=== Tech Stack Report ===');
console.log(`Primary Language: ${techStack.primary_language}`);
console.log(`All Languages: ${techStack.languages.join(', ')}`);

if (techStack.frameworks.length > 0) {
  console.log('\nFrameworks:');
  techStack.frameworks.forEach((fw) => {
    console.log(`  - ${fw.name} (${fw.type}) v${fw.version}`);
  });
}

if (techStack.build_system.buildSystem) {
  console.log(`\nBuild System: ${techStack.build_system.buildSystem}`);
}

if (techStack.test_framework.testFramework) {
  console.log(`Test Framework: ${techStack.test_framework.testFramework}`);
}

if (techStack.linters.linters.length > 0) {
  console.log(`\nLinters: ${techStack.linters.linters.join(', ')}`);
}

if (techStack.linters.formatters.length > 0) {
  console.log(`Formatters: ${techStack.linters.formatters.join(', ')}`);
}
```

### Detecting Languages Only

```javascript
import { detectLanguagesFromFiles } from 'ai_workflow.js/lib/tech_stack';
import { FileOperations } from 'ai_workflow.js/lib/file_operations';

const fileOps = new FileOperations();
const files = await fileOps.listDirectoryRecursive('/path/to/project');

const { languages, primary } = detectLanguagesFromFiles(files);

console.log(`Primary Language: ${primary}`);
console.log(`All Languages: ${languages.join(', ')}`);

// Determine workflow based on language
if (primary === 'javascript' || primary === 'typescript') {
  console.log('Using Node.js workflow');
} else if (primary === 'python') {
  console.log('Using Python workflow');
}
```

### Framework Detection

```javascript
import { detectFrameworksFromPackageJson } from 'ai_workflow.js/lib/tech_stack';
import { FileOperations } from 'ai_workflow.js/lib/file_operations';

const fileOps = new FileOperations();
const content = await fileOps.readFile('package.json');
const packageJson = JSON.parse(content);

const frameworks = detectFrameworksFromPackageJson(packageJson);

console.log('Detected Frameworks:');
frameworks.forEach((fw) => {
  console.log(`  ${fw.name} (${fw.type}): ${fw.version}`);
});

// Check for specific framework
const hasReact = frameworks.some((fw) => fw.name === 'React');
if (hasReact) {
  console.log('React detected - enabling React-specific checks');
}
```

### Build System and Test Framework

```javascript
import { detectBuildSystem, detectTestFramework } from 'ai_workflow.js/lib/tech_stack';
import { FileOperations } from 'ai_workflow.js/lib/file_operations';

const fileOps = new FileOperations();
const files = await fileOps.listDirectoryRecursive('.');
const packageJson = JSON.parse(await fileOps.readFile('package.json'));

// Detect build system
const buildInfo = detectBuildSystem(files, packageJson);
console.log(`Build System: ${buildInfo.buildSystem || 'None detected'}`);
console.log(`Config Files: ${buildInfo.configFiles.join(', ')}`);

// Detect test framework
const testInfo = detectTestFramework(packageJson, files);
console.log(`Test Framework: ${testInfo.testFramework || 'None detected'}`);
console.log(`Runners: ${testInfo.runners.join(', ')}`);

// Configure workflow accordingly
if (buildInfo.buildSystem === 'vite') {
  console.log('Using Vite build command: vite build');
}

if (testInfo.testFramework === 'jest') {
  console.log('Using Jest test command: jest --coverage');
}
```

### Generating Tech Stack Report

```javascript
import { TechStackDetector } from 'ai_workflow.js/lib/tech_stack';

const detector = new TechStackDetector();

// Detect and generate report
const report = await detector.generateReport('/path/to/project');

// Display report
console.log(report);

// Save to file
import { FileOperations } from 'ai_workflow.js/lib/file_operations';
const fileOps = new FileOperations();
await fileOps.writeFile('.ai_workflow/tech-stack-report.md', report);

console.log('Tech stack report saved to .ai_workflow/tech-stack-report.md');
```

### Linter Detection

```javascript
import { detectLinters } from 'ai_workflow.js/lib/tech_stack';
import { FileOperations } from 'ai_workflow.js/lib/file_operations';

const fileOps = new FileOperations();
const files = await fileOps.listDirectoryRecursive('.');
const packageJson = JSON.parse(await fileOps.readFile('package.json'));

const { linters, formatters, configFiles } = detectLinters(files, packageJson);

console.log('=== Code Quality Tools ===');
console.log(`Linters: ${linters.join(', ') || 'None'}`);
console.log(`Formatters: ${formatters.join(', ') || 'None'}`);
console.log(`Config Files: ${configFiles.join(', ')}`);

// Run appropriate tools
if (linters.includes('eslint')) {
  console.log('Running: eslint .');
}

if (formatters.includes('prettier')) {
  console.log('Running: prettier --check .');
}
```

### Workflow Customization Based on Tech Stack

```javascript
import { TechStackDetector } from 'ai_workflow.js/lib/tech_stack';
import { ProjectKindDetector } from 'ai_workflow.js/lib/project_kind_detection';

async function customizeWorkflow(projectRoot) {
  // Detect project kind
  const kindDetector = new ProjectKindDetector();
  const { kind } = await kindDetector.detect(projectRoot);

  // Detect tech stack
  const techDetector = new TechStackDetector({ projectRoot });
  const techStack = await techDetector.detectTechStack();

  // Customize workflow
  const workflow = {
    projectKind: kind,
    language: techStack.primary_language,
    frameworks: techStack.frameworks.map((f) => f.name),
    buildCommand: null,
    testCommand: null,
    lintCommand: null,
  };

  // Set build command
  if (techStack.build_system.buildSystem === 'vite') {
    workflow.buildCommand = 'npm run build';
  } else if (techStack.build_system.buildSystem === 'webpack') {
    workflow.buildCommand = 'npm run build';
  } else if (techStack.build_system.buildSystem === 'tsc') {
    workflow.buildCommand = 'tsc';
  }

  // Set test command
  if (techStack.test_framework.testFramework === 'jest') {
    workflow.testCommand = 'npm test';
  } else if (techStack.test_framework.testFramework === 'vitest') {
    workflow.testCommand = 'npm test';
  } else if (techStack.test_framework.testFramework === 'pytest') {
    workflow.testCommand = 'pytest';
  }

  // Set lint command
  if (techStack.linters.linters.includes('eslint')) {
    workflow.lintCommand = 'npm run lint';
  }

  return workflow;
}

const workflow = await customizeWorkflow('/path/to/project');
console.log('Customized Workflow:', workflow);
```

---

## Related Modules

- **project_kind_detection** - Uses tech stack for project classification
- **project_kind_config** - Configuration informed by tech stack
- **file_operations** - Used for file system access

---

## Notes

- **Caching**: Detection results cached in memory for performance
- **Extensibility**: Easy to add new frameworks and tools
- **Language Priority**: Code languages prioritized over config/markup
- **Framework Versions**: Extracted from package.json when available
- **Python Detection**: Supports both requirements.txt and setup.py

---

**Last Updated:** 2026-02-07
**Author:** AI Workflow Team
