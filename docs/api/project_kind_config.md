# project_kind_config - Project Kind Configuration Module

**Module:** `lib/project_kind_config`  
**Version:** 1.0.0  
**Type:** Pure Functions + Wrapper

## Overview

Loads and manages project kind configurations from `.workflow_core/config/project_kinds.yaml`. Provides validation rules, testing configurations, quality standards, and AI guidance for different project types.

---

## Architecture

**Pure Functions** (exported for testing):

- `parseYaml()` - Parse YAML content
- `extractProjectKindConfig()` - Extract config for specific project kind
- `mergeConfigurations()` - Merge base config with user overrides
- `validateProjectStructure()` - Validate project against rules
- `extractConfigSection()` - Extract specific config section

**Wrapper Class**:

- `ProjectKindConfig` - Handles file I/O and configuration loading

---

## Pure Functions

### `parseYaml(yamlContent)`

Parses YAML content into JavaScript object.

**Parameters:**

- `yamlContent` (string) - YAML content to parse

**Returns:** Object|null - Parsed object or null on error

**Example:**

```javascript
import { parseYaml } from './lib/project_kind_config.js';

const yaml = `
project_kinds:
  nodejs_api:
    primary_language: javascript
`;

const parsed = parseYaml(yaml);
// { project_kinds: { nodejs_api: { primary_language: 'javascript' } } }
```

---

### `extractProjectKindConfig(parsedYaml, projectKind)`

Extracts configuration for a specific project kind.

**Parameters:**

- `parsedYaml` (Object) - Parsed project_kinds.yaml content
- `projectKind` (string) - Project kind ID (e.g., 'nodejs_api')

**Returns:** Object|null - Project kind configuration or null if not found

**Example:**

```javascript
const config = extractProjectKindConfig(parsed, 'nodejs_api');
// {
//   primary_language: 'javascript',
//   validation: { ... },
//   testing: { ... },
//   quality: { ... }
// }
```

---

### `mergeConfigurations(baseConfig, overrides)`

Merges user overrides into base configuration (deep merge).

**Parameters:**

- `baseConfig` (Object) - Base configuration from project_kinds.yaml
- `overrides` (Object) - User overrides from .workflow-config.yaml

**Returns:** Object - Merged configuration

**Merge Behavior:**

- Objects: Recursively merged
- Arrays: Replaced (not merged)
- Primitives: Overridden

**Example:**

```javascript
const base = {
  testing: {
    coverage_threshold: 80,
    frameworks: ['jest'],
  },
};

const overrides = {
  testing: {
    coverage_threshold: 90,
  },
};

const merged = mergeConfigurations(base, overrides);
// {
//   testing: {
//     coverage_threshold: 90,
//     frameworks: ['jest']
//   }
// }
```

---

### `validateProjectStructure(existingFiles, existingDirs, validationRules)`

Validates project structure against validation rules.

**Parameters:**

- `existingFiles` (Array\<string\>) - Files in project (relative paths)
- `existingDirs` (Array\<string\>) - Directories in project (basenames)
- `validationRules` (Object) - Validation rules from config

**Returns:** Object with `{ valid, missingFiles, missingDirs, errors }`

**Example:**

```javascript
const rules = {
  required_files: ['package.json', 'README.md'],
  required_directories: ['src', 'test'],
};

const result = validateProjectStructure(['package.json', 'src/app.js'], ['src'], rules);
// {
//   valid: false,
//   missingFiles: ['README.md'],
//   missingDirs: ['test'],
//   errors: []
// }
```

---

### `extractConfigSection(config, section)`

Extracts a specific configuration section.

**Parameters:**

- `config` (Object) - Full project kind configuration
- `section` (string) - Section name ('testing', 'quality', 'ai_guidance', etc.)

**Returns:** Object|null - Section configuration or null

**Example:**

```javascript
const testing = extractConfigSection(config, 'testing');
// {
//   coverage_threshold: 80,
//   frameworks: ['jest'],
//   required_test_directories: ['test']
// }
```

---

## ProjectKindConfig Class

Manages project kind configurations with file I/O and caching.

### Constructor

```javascript
new ProjectKindConfig(options);
```

**Options:**

- `projectRoot` (string) - Project root directory
- `coreConfigPath` (string) - Path to .workflow_core (default: `projectRoot/.workflow_core`)
- `fileOps` (FileOperations) - File operations instance
- `verbose` (boolean) - Enable verbose logging

### Methods

#### `getProjectKindsPath()`

Gets path to project_kinds.yaml file.

**Returns:** string - Full path to project_kinds.yaml

**Example:**

```javascript
const path = manager.getProjectKindsPath();
// '/path/to/project/.workflow_core/config/project_kinds.yaml'
```

---

#### `async loadProjectKindsYaml()`

Loads and parses project_kinds.yaml file.

**Returns:** Promise\<Object|null\> - Parsed YAML or null on error

**Example:**

```javascript
import { ProjectKindConfig } from './lib/project_kind_config.js';

const manager = new ProjectKindConfig({
  projectRoot: '/path/to/project',
});

const yaml = await manager.loadProjectKindsYaml();
console.log(yaml.project_kinds);
```

---

#### `async loadConfig(projectKind)`

Loads configuration for a specific project kind (with caching).

**Parameters:**

- `projectKind` (string) - Project kind ID

**Returns:** Promise\<Object|null\> - Project kind configuration

**Example:**

```javascript
const config = await manager.loadConfig('nodejs_api');
// {
//   primary_language: 'javascript',
//   validation: { ... },
//   testing: { ... }
// }
```

---

#### `async loadConfigWithOverrides(projectKind, userOverrides)`

Loads configuration with user overrides merged.

**Parameters:**

- `projectKind` (string) - Project kind ID
- `userOverrides` (Object) - User overrides

**Returns:** Promise\<Object|null\> - Merged configuration

**Example:**

```javascript
const overrides = {
  testing: { coverage_threshold: 90 },
};

const config = await manager.loadConfigWithOverrides('nodejs_api', overrides);
```

---

#### `async getValidationRules(projectKind)`

Gets validation rules for a project kind.

**Returns:** Promise\<Object|null\> - Validation rules

**Example:**

```javascript
const rules = await manager.getValidationRules('nodejs_api');
// {
//   required_files: ['package.json', 'README.md'],
//   required_directories: ['src']
// }
```

---

#### `async getTestingConfig(projectKind)`

Gets testing configuration for a project kind.

**Returns:** Promise\<Object|null\> - Testing configuration

**Example:**

```javascript
const testing = await manager.getTestingConfig('nodejs_api');
// {
//   coverage_threshold: 80,
//   frameworks: ['jest'],
//   test_patterns: ['**/*.test.js']
// }
```

---

#### `async getQualityStandards(projectKind)`

Gets quality standards for a project kind.

**Returns:** Promise\<Object|null\> - Quality standards

**Example:**

```javascript
const quality = await manager.getQualityStandards('nodejs_api');
// {
//   linters: ['eslint', 'prettier'],
//   code_style: 'airbnb'
// }
```

---

#### `async getAIGuidance(projectKind)`

Gets AI guidance for a project kind.

**Returns:** Promise\<Object|null\> - AI guidance

**Example:**

```javascript
const guidance = await manager.getAIGuidance('nodejs_api');
// {
//   prompts: { ... },
//   personas: ['code_quality_analyst'],
//   best_practices: [...]
// }
```

---

#### `async getDeploymentConfig(projectKind)`

Gets deployment configuration for a project kind.

**Returns:** Promise\<Object|null\> - Deployment configuration

**Example:**

```javascript
const deployment = await manager.getDeploymentConfig('nodejs_api');
// {
//   platforms: ['heroku', 'aws'],
//   build_command: 'npm run build'
// }
```

---

#### `async validateProject(projectKind)`

Validates project structure against project kind rules.

**Returns:** Promise\<Object\> - Validation result

**Example:**

```javascript
const result = await manager.validateProject('nodejs_api');
if (!result.valid) {
  console.log('Missing files:', result.missingFiles);
  console.log('Missing directories:', result.missingDirs);
}
```

---

#### `clearCache()`

Clears configuration cache.

**Example:**

```javascript
manager.clearCache();
```

---

#### `async getSupportedProjectKinds()`

Gets list of all supported project kinds.

**Returns:** Promise\<Array\<string\>\> - Project kind IDs

**Example:**

```javascript
const kinds = await manager.getSupportedProjectKinds();
// ['nodejs_api', 'react_spa', 'python_app', 'shell_script_automation', ...]
```

---

## Usage Examples

### Load and Validate Project Configuration

```javascript
import { ProjectKindConfig } from './lib/project_kind_config.js';

const manager = new ProjectKindConfig({
  projectRoot: '/path/to/project',
  verbose: true,
});

// Load config
const config = await manager.loadConfig('nodejs_api');

// Validate project
const validation = await manager.validateProject('nodejs_api');

if (validation.valid) {
  console.log('✅ Project structure is valid');
} else {
  console.log('❌ Validation failed');
  console.log('Missing files:', validation.missingFiles);
  console.log('Missing directories:', validation.missingDirs);
}
```

### Get Configuration Sections

```javascript
const manager = new ProjectKindConfig({ projectRoot: '.' });

// Get different sections
const validation = await manager.getValidationRules('nodejs_api');
const testing = await manager.getTestingConfig('nodejs_api');
const quality = await manager.getQualityStandards('nodejs_api');
const aiGuidance = await manager.getAIGuidance('nodejs_api');

console.log('Coverage threshold:', testing.coverage_threshold);
console.log('Linters:', quality.linters);
console.log('AI personas:', aiGuidance.personas);
```

### Merge User Overrides

```javascript
const userOverrides = {
  testing: {
    coverage_threshold: 95,
    frameworks: ['vitest'],
  },
  quality: {
    linters: ['biome'],
  },
};

const config = await manager.loadConfigWithOverrides('nodejs_api', userOverrides);
console.log('Merged config:', config);
```

### Using Pure Functions

```javascript
import { mergeConfigurations, validateProjectStructure } from './lib/project_kind_config.js';

// Merge configs
const base = { coverage: 80 };
const overrides = { coverage: 90 };
const merged = mergeConfigurations(base, overrides);

// Validate structure
const files = ['package.json', 'src/app.js'];
const dirs = ['src'];
const rules = {
  required_files: ['package.json', 'README.md'],
  required_directories: ['src', 'test'],
};

const result = validateProjectStructure(files, dirs, rules);
console.log('Valid:', result.valid);
console.log('Missing:', result.missingFiles, result.missingDirs);
```

---

## Configuration Structure

Project kind configurations in `project_kinds.yaml` include:

```yaml
project_kinds:
  nodejs_api:
    primary_language: javascript

    validation:
      required_files:
        - package.json
        - README.md
      required_directories:
        - src

    testing:
      coverage_threshold: 80
      frameworks: [jest]
      test_patterns: ['**/*.test.js']

    quality:
      linters: [eslint, prettier]
      code_style: airbnb

    ai_guidance:
      personas: [code_quality_analyst, test_engineer]
      best_practices: [...]

    deployment:
      platforms: [heroku, aws]
      build_command: npm run build
```

---

## Related Modules

- **[project_kind_detection](./project_kind_detection.md)** - Auto-detects project kind
- **[tech_stack](./tech_stack.md)** - Detects tech stack
- **[config](./config.md)** - Workflow configuration management
- **[file_operations](./file_operations.md)** - File system operations

---

**Last Updated:** 2026-02-01  
**Part of:** AI Workflow Automation v1.2.0 (Phase 4)
