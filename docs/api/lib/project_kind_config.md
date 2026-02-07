# Project Kind Configuration API

**Module:** `lib/project_kind_config`  
**Version:** 1.0.0  
**Architecture:** Pure Functions + Wrapper Class

## Overview

The Project Kind Configuration module loads and manages project kind configurations from the ai_workflow_core submodule. It provides structured configuration for validation rules, testing standards, quality thresholds, and AI guidance for each project type.

### Key Features

- **YAML Configuration**: Loads from `.workflow_core/config/project_kinds.yaml`
- **8 Project Kinds**: Complete configuration for all supported project types
- **Configuration Merging**: Combines base config with user overrides
- **Section Extraction**: Access specific config sections (validation, testing, quality, etc.)
- **Validation Rules**: Project structure validation against expected patterns
- **Caching**: In-memory cache for performance

### Configuration Structure

Each project kind includes:

- **validation**: Required files, recommended files, directory structure
- **testing**: Test framework, coverage thresholds, test patterns
- **quality**: Linting rules, code quality standards
- **dependencies**: Package management and security
- **build**: Build commands and output
- **deployment**: Deployment configuration
- **ai_guidance**: AI-specific guidance for the project type

### Architecture

**Pure Functions:**

- `parseYaml()` - Parse YAML string to object
- `extractProjectKindConfig()` - Extract config for specific project kind
- `mergeConfigurations()` - Deep merge base config with overrides
- `validateProjectStructure()` - Validate project against rules
- `extractConfigSection()` - Get specific section from config

**Impure Wrapper:**

- `ProjectKindConfig` class - Configuration management with file I/O

---

## Installation

```javascript
import {
  ProjectKindConfig,
  parseYaml,
  extractProjectKindConfig,
  mergeConfigurations,
  validateProjectStructure,
  extractConfigSection,
} from 'ai_workflow.js/lib/project_kind_config';
```

---

## Pure Functions

### `parseYaml(yamlContent)`

Parses YAML string into JavaScript object.

**Parameters:**

- `yamlContent` (string) - YAML content to parse

**Returns:** Object | null - Parsed object or null on error

**Pure:** ✅ Deterministic, no side effects

**Example:**

```javascript
const yaml = `
project_kinds:
  nodejs_api:
    validation:
      required_files:
        - package.json
`;

const parsed = parseYaml(yaml);
// => { project_kinds: { nodejs_api: { validation: { ... } } } }
```

---

### `extractProjectKindConfig(parsedYaml, projectKind)`

Extracts configuration for a specific project kind from parsed YAML.

**Parameters:**

- `parsedYaml` (Object) - Parsed project_kinds.yaml content
- `projectKind` (string) - Project kind identifier (e.g., 'nodejs_api')

**Returns:** Object | null - Project kind configuration or null if not found

**Pure:** ✅ Deterministic, no side effects

**Example:**

```javascript
const parsed = {
  project_kinds: {
    nodejs_api: {
      validation: { required_files: ['package.json'] },
      testing: { framework: 'jest' },
    },
    react_spa: {
      validation: { required_files: ['package.json'] },
      testing: { framework: 'vitest' },
    },
  },
};

const config = extractProjectKindConfig(parsed, 'nodejs_api');
// => { validation: { required_files: ['package.json'] }, testing: { framework: 'jest' } }
```

---

### `mergeConfigurations(baseConfig, overrides)`

Deep merges user overrides into base configuration.

**Parameters:**

- `baseConfig` (Object) - Base configuration from project_kinds.yaml
- `overrides` (Object) - User overrides from .workflow-config.yaml

**Returns:** Object - Merged configuration

**Pure:** ✅ Deterministic, no side effects

**Merge Strategy:**

- Objects: Deep merge recursively
- Arrays: Override (not concatenate)
- Primitives: Override value
- Null/undefined: Ignored

**Example:**

```javascript
const base = {
  validation: { required_files: ['package.json'] },
  testing: { coverage_threshold: 80, framework: 'jest' },
};

const overrides = {
  testing: { coverage_threshold: 90 },
  custom: { setting: 'value' },
};

const merged = mergeConfigurations(base, overrides);
// => {
//   validation: { required_files: ['package.json'] },
//   testing: { coverage_threshold: 90, framework: 'jest' },
//   custom: { setting: 'value' }
// }
```

---

### `validateProjectStructure(existingFiles, existingDirs, validationRules)`

Validates project structure against validation rules.

**Parameters:**

- `existingFiles` (Array<string>) - Files present in project
- `existingDirs` (Array<string>) - Directories present in project
- `validationRules` (Object) - Validation rules with `required_files`, `recommended_files`, `expected_directories`

**Returns:** Object with:

- `valid` (boolean) - True if all required items present
- `missing` (Array<string>) - Missing required items
- `recommendations` (Array<string>) - Missing recommended items
- `unexpected` (Array<string>) - Present but not expected

**Pure:** ✅ Deterministic, no side effects

**Example:**

```javascript
const files = ['package.json', 'README.md', 'src/index.js'];
const dirs = ['src', 'test'];
const rules = {
  required_files: ['package.json'],
  recommended_files: ['README.md', 'LICENSE'],
  expected_directories: ['src', 'test', 'docs'],
};

const result = validateProjectStructure(files, dirs, rules);
// => {
//   valid: true,
//   missing: [],
//   recommendations: ['LICENSE'],
//   unexpected: []
// }
```

---

### `extractConfigSection(config, section)`

Extracts specific section from project kind configuration.

**Parameters:**

- `config` (Object) - Full project kind configuration
- `section` (string) - Section name ('validation', 'testing', 'quality', etc.)

**Returns:** Object | null - Section configuration or null if not found

**Pure:** ✅ Deterministic, no side effects

**Example:**

```javascript
const config = {
  validation: { required_files: ['package.json'] },
  testing: { framework: 'jest', coverage_threshold: 80 },
  quality: { linters: ['eslint'] },
};

const testingConfig = extractConfigSection(config, 'testing');
// => { framework: 'jest', coverage_threshold: 80 }
```

---

## ProjectKindConfig Class

Wrapper class for project kind configuration management with file I/O.

### Constructor

```javascript
const manager = new ProjectKindConfig(options);
```

**Options:**

- `projectRoot` (string) - Project root directory (default: process.cwd())
- `coreConfigPath` (string) - Path to .workflow_core (default: `{projectRoot}/.workflow_core`)
- `fileOps` (FileOperations) - File operations instance
- `verbose` (boolean) - Enable verbose logging (default: false)

**Example:**

```javascript
const manager = new ProjectKindConfig({
  projectRoot: '/path/to/project',
  verbose: true,
});
```

---

### Methods

#### `getProjectKindsPath()`

Gets full path to project_kinds.yaml file.

**Returns:** string - Path to `.workflow_core/config/project_kinds.yaml`

**Example:**

```javascript
const path = manager.getProjectKindsPath();
// => '/path/to/project/.workflow_core/config/project_kinds.yaml'
```

---

#### `async loadProjectKindsYaml()`

Loads and parses project_kinds.yaml file.

**Returns:** Promise<Object | null> - Parsed YAML or null on error

**Side Effects:**

- Reads file from disk
- Logs errors (if verbose)

**Example:**

```javascript
const yaml = await manager.loadProjectKindsYaml();
if (yaml) {
  console.log('Available project kinds:', Object.keys(yaml.project_kinds));
}
```

---

#### `async loadConfig(projectKind)`

Loads configuration for specific project kind with caching.

**Parameters:**

- `projectKind` (string) - Project kind identifier

**Returns:** Promise<Object | null> - Project kind configuration

**Side Effects:**

- Reads from disk (first call)
- Caches result in memory
- Logs loading (if verbose)

**Example:**

```javascript
const config = await manager.loadConfig('nodejs_api');

console.log('Required files:', config.validation.required_files);
console.log('Test framework:', config.testing.framework);
console.log('Coverage threshold:', config.testing.coverage_threshold);
```

---

#### `async loadConfigWithOverrides(projectKind, userOverrides = {})`

Loads configuration and merges with user overrides.

**Parameters:**

- `projectKind` (string) - Project kind identifier
- `userOverrides` (Object) - User overrides from .workflow-config.yaml

**Returns:** Promise<Object | null> - Merged configuration

**Example:**

```javascript
const userOverrides = {
  testing: {
    coverage_threshold: 95,
    exclude_patterns: ['src/legacy/**'],
  },
};

const config = await manager.loadConfigWithOverrides('nodejs_api', userOverrides);
// => Base config merged with user overrides
```

---

#### `async getValidationRules(projectKind)`

Gets validation rules for project kind.

**Parameters:**

- `projectKind` (string) - Project kind identifier

**Returns:** Promise<Object | null> - Validation rules section

**Example:**

```javascript
const rules = await manager.getValidationRules('nodejs_api');

console.log('Required files:', rules.required_files);
console.log('Expected directories:', rules.expected_directories);
```

---

#### `async getTestingConfig(projectKind)`

Gets testing configuration for project kind.

**Parameters:**

- `projectKind` (string) - Project kind identifier

**Returns:** Promise<Object | null> - Testing configuration section

**Example:**

```javascript
const testing = await manager.getTestingConfig('react_spa');

console.log('Framework:', testing.framework); // => 'vitest'
console.log('Coverage:', testing.coverage_threshold); // => 80
```

---

#### `async getQualityConfig(projectKind)`

Gets quality configuration for project kind.

**Parameters:**

- `projectKind` (string) - Project kind identifier

**Returns:** Promise<Object | null> - Quality configuration section

**Example:**

```javascript
const quality = await manager.getQualityConfig('nodejs_api');

console.log('Linters:', quality.linters); // => ['eslint']
console.log('Formatters:', quality.formatters); // => ['prettier']
```

---

#### `clearCache()`

Clears the in-memory configuration cache.

**Side Effects:** Clears internal cache

**Example:**

```javascript
manager.clearCache();
// Next loadConfig() will read from disk
```

---

## Usage Examples

### Loading Project Configuration

```javascript
import { ProjectKindConfig } from 'ai_workflow.js/lib/project_kind_config';

const manager = new ProjectKindConfig({
  projectRoot: '/path/to/project',
});

// Load configuration
const config = await manager.loadConfig('nodejs_api');

console.log('=== Node.js API Configuration ===');
console.log('Required files:', config.validation.required_files);
console.log('Test framework:', config.testing.framework);
console.log('Coverage threshold:', config.testing.coverage_threshold);
console.log('Linters:', config.quality.linters);
```

### Merging User Overrides

```javascript
const manager = new ProjectKindConfig();

// User's custom configuration
const userConfig = {
  testing: {
    coverage_threshold: 95, // Override default 80
    additional_test_dirs: ['integration-tests'],
  },
  quality: {
    max_complexity: 15, // Override default
  },
};

const config = await manager.loadConfigWithOverrides('nodejs_api', userConfig);

console.log('Coverage threshold:', config.testing.coverage_threshold); // => 95
console.log('Max complexity:', config.quality.max_complexity); // => 15
```

### Validating Project Structure

```javascript
import { validateProjectStructure } from 'ai_workflow.js/lib/project_kind_config';

const manager = new ProjectKindConfig();

// Get validation rules
const rules = await manager.getValidationRules('nodejs_api');

// Check current project structure
const files = ['package.json', 'README.md', 'src/index.js'];
const dirs = ['src', 'test'];

const validation = validateProjectStructure(files, dirs, rules);

if (validation.valid) {
  console.log('✓ Project structure is valid');
} else {
  console.log('✗ Missing required items:', validation.missing);
}

if (validation.recommendations.length > 0) {
  console.log('⚠ Recommended items:', validation.recommendations);
}
```

### Accessing Specific Configuration Sections

```javascript
const manager = new ProjectKindConfig();

// Get testing configuration
const testing = await manager.getTestingConfig('react_spa');
console.log('Test framework:', testing.framework);
console.log('Coverage threshold:', testing.coverage_threshold);

// Get quality configuration
const quality = await manager.getQualityConfig('react_spa');
console.log('Linters:', quality.linters);
console.log('Formatters:', quality.formatters);

// Get build configuration
const config = await manager.loadConfig('react_spa');
const build = extractConfigSection(config, 'build');
console.log('Build command:', build.command);
console.log('Output directory:', build.output_dir);
```

### Dynamic Configuration Loading

```javascript
import { ProjectKindDetector } from 'ai_workflow.js/lib/project_kind_detection';
import { ProjectKindConfig } from 'ai_workflow.js/lib/project_kind_config';

async function loadConfigForProject(projectRoot) {
  // Detect project kind
  const detector = new ProjectKindDetector();
  const detection = await detector.detect(projectRoot);

  console.log(`Detected: ${detection.kind} (${detection.confidence}% confidence)`);

  // Load configuration for detected kind
  const manager = new ProjectKindConfig({ projectRoot });
  const config = await manager.loadConfig(detection.kind);

  return {
    projectKind: detection.kind,
    confidence: detection.confidence,
    config,
  };
}

const result = await loadConfigForProject('/path/to/project');
console.log('Project configuration loaded:', result.config);
```

### Parsing YAML Directly

```javascript
import { parseYaml, extractProjectKindConfig } from 'ai_workflow.js/lib/project_kind_config';

const yamlContent = `
project_kinds:
  nodejs_api:
    validation:
      required_files:
        - package.json
        - README.md
    testing:
      framework: jest
      coverage_threshold: 80
`;

const parsed = parseYaml(yamlContent);
const config = extractProjectKindConfig(parsed, 'nodejs_api');

console.log('Required files:', config.validation.required_files);
console.log('Test framework:', config.testing.framework);
```

### Configuration Caching

```javascript
const manager = new ProjectKindConfig({ verbose: true });

// First call - loads from disk
const config1 = await manager.loadConfig('nodejs_api');
// Output: "Loading project_kinds.yaml from: ..."

// Second call - uses cache
const config2 = await manager.loadConfig('nodejs_api');
// Output: "Using cached config for: nodejs_api"

// Clear cache
manager.clearCache();

// Third call - loads from disk again
const config3 = await manager.loadConfig('nodejs_api');
// Output: "Loading project_kinds.yaml from: ..."
```

---

## Related Modules

- **project_kind_detection** - Detects project kind before loading config
- **file_operations** - Used for file I/O
- **config** - Main workflow configuration management

---

## Notes

- **Submodule Dependency**: Requires `.workflow_core` submodule to be initialized
- **YAML Structure**: All project kinds defined in single `project_kinds.yaml` file
- **Caching Strategy**: In-memory cache per project kind for performance
- **Deep Merge**: Object merging is recursive, arrays are replaced entirely
- **Validation Rules**: Can be extended with custom validation logic

---

**Last Updated:** 2026-02-07  
**Author:** AI Workflow Team
