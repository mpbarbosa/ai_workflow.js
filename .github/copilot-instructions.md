# GitHub Copilot Instructions: AI Workflow Core

> ⚠️ **Critical Context**: This is a **configuration and template library**, NOT a workflow execution engine. It provides templates, schemas, and examples that other projects use as a Git submodule. Several docs in `docs/` reference the parent **ai_workflow** execution project - focus on configuration templates, project_kinds schemas, and integration patterns when assisting with this repository.

## Table of Contents

- [Project Overview](#project-overview)
- [Architecture & Design Principles](#architecture--design-principles)
- [Directory Structure](#directory-structure)
- [Template System & Placeholders](#template-system--placeholders)
- [Project Kinds System](#project-kinds-system)
- [Coding Standards & Conventions](#coding-standards--conventions)
- [Key Documentation References](#key-documentation-references)
- [Development Workflow](#development-workflow)
- [Common Assistance Patterns](#common-assistance-patterns)
- [Important Context](#important-context)
- [Quick Reference](#quick-reference)
- [Contact & Resources](#contact--resources)

---

## Project Overview

**ai_workflow_core** is a language-agnostic foundational template system for AI-powered workflow automation. This repository provides configuration templates, directory structures, GitHub workflows, utility scripts, and documentation that can be integrated into projects written in any language (Shell, JavaScript/Node.js, Python, etc.).

**Key Characteristics:**
- **Template Repository**: Designed to be used as a Git submodule in other projects
- **Language-Agnostic**: Provides foundational structure that works across programming languages
- **Configuration-Driven**: Uses YAML templates with placeholder substitution patterns
- **Dual Nature**: You're working on both the core templates AND the system that consumes them

**Version**: 1.0.0  
**License**: MIT  
**Originally extracted from**: [mpbarbosa/ai_workflow](https://github.com/mpbarbosa/ai_workflow)

---

## Architecture & Design Principles

### Core Concepts

1. **Template System with Placeholders**
   - Configuration files use `{{PLACEHOLDER}}` syntax for substitution
   - Projects copy templates and replace placeholders with specific values
   - Enables single source of truth that adapts to different contexts

2. **Git Submodule Integration Pattern**
   - Projects add ai_workflow_core as a submodule (typically `.workflow_core/`)
   - Copy and customize configuration files to project root
   - Keep templates updated via `git submodule update`

3. **Language-Agnostic Design**
   - No language-specific code in core repository
   - Configuration defines language-specific settings (test commands, linters, etc.)
   - Directory structures follow common conventions across languages

4. **Separation of Concerns**
   - **config/**: Template configurations and schemas
   - **docs/**: Architecture and integration guides
   - **examples/**: Reference implementations per language
   - **scripts/**: Reusable utility scripts (templates)
   - **github/**: GitHub-specific integrations

5. **Workflow Artifact Management**
   - Projects create `.ai_workflow/` directory for workflow execution artifacts
   - Artifacts are gitignored by default (logs, metrics, cache)
   - Standard directory structure across all projects

---

## Directory Structure

```
ai_workflow_core/
├── .github/
│   ├── DESCRIPTION.md           # Repository description for GitHub
│   └── copilot-instructions.md  # This file
├── config/                      # Configuration templates
│   ├── .workflow-config.yaml.template  # Main workflow config template
│   ├── ai_helpers.yaml          # AI helper definitions (1900+ lines)
│   ├── ai_prompts_project_kinds.yaml   # Project-specific AI prompts
│   ├── paths.yaml               # Path configurations
│   ├── project_kinds.yaml       # Project type definitions & validation rules
│   └── README.md
├── docs/                        # Comprehensive documentation
│   ├── guides/                  # Implementation guides
│   │   ├── ML_OPTIMIZATION_GUIDE.md
│   │   ├── MULTI_STAGE_PIPELINE_GUIDE.md
│   │   └── PROJECT_REFERENCE.md
│   ├── AI_WORKFLOW_DIRECTORY.md # Artifact directory structure guide
│   ├── CODE_OF_CONDUCT.md       # Contributor Covenant 2.1
│   ├── CONTRIBUTING.md          # Contributing guidelines (detailed)
│   ├── INTEGRATION.md           # Integration guide for using as submodule
│   └── LICENSE                  # MIT License
├── examples/                    # Language-specific integration examples
│   ├── shell/                   # Shell script integration example
│   └── nodejs/                  # Node.js integration example
├── scripts/                     # Utility script templates
│   ├── cleanup_artifacts.sh.template  # Artifact cleanup script
│   ├── validate_context_blocks.py     # Documentation validator
│   └── README.md
├── github/                      # GitHub-specific files (workflow templates)
│   └── workflows/               # GitHub Actions workflow templates
│       ├── code-quality.yml
│       ├── validate-docs.yml
│       └── validate-tests.yml
├── .ai_workflow/                # Workflow artifacts (for dogfooding)
│   ├── backlog/                 # Execution reports and development artifacts
│   ├── summaries/               # AI summaries
│   ├── logs/                    # Execution logs
│   ├── metrics/                 # Performance metrics
│   └── prompts/                 # AI prompt logs
├── .workflow-config.yaml        # Root config (for testing on self)
├── README.md                    # Main project documentation
├── CHANGELOG.md                 # Version history
└── .gitignore

# Standard Project Integration Structure (not in this repo):
target_project/
├── .workflow_core/              # This repository as submodule
├── .ai_workflow/                # Workflow artifacts (created by projects)
│   ├── backlog/                 # Execution reports
│   ├── summaries/               # AI summaries
│   ├── logs/                    # Execution logs
│   ├── metrics/                 # Performance metrics
│   ├── checkpoints/             # Resume points
│   ├── prompts/                 # AI prompt logs (optional commit)
│   ├── ml_models/               # ML models (optional commit)
│   └── .incremental_cache/      # Incremental processing cache
└── .workflow-config.yaml        # Customized config (copied from template)
```

### Key Directories Explained

**config/**: Contains all template configuration files
- `.workflow-config.yaml.template`: Main config with placeholders
- `project_kinds.yaml`: Defines validation rules per project type (shell_script_automation, nodejs_api, react_spa, python_app, client_spa, static_website, generic)
- `ai_helpers.yaml`: Large file (1900+ lines) with AI helper configurations
- Project types define test frameworks, linters, build systems, and best practices

**docs/**: Comprehensive documentation organized by purpose
- Essential docs at root level: INTEGRATION.md, AI_WORKFLOW_DIRECTORY.md, CONTRIBUTING.md, CODE_OF_CONDUCT.md
- `guides/` subdirectory contains implementation guides (some reference parent ai_workflow features)
- Clean structure with no empty directories

**examples/**: Reference implementations showing integration patterns
- Each subdirectory demonstrates language-specific setup
- Includes full project structure, configuration, and README
- Copy and customize as starting point

**scripts/**: Template scripts that projects can copy and adapt
- `.template` files should be copied without extension
- Placeholders like `{{PROJECT_ROOT}}`, `{{ARTIFACT_DIR}}` need substitution
- Can be adapted to different languages (bash → Node.js, Python, etc.)

---

## Template System & Placeholders

### Core Placeholder Pattern

Configuration files use `{{PLACEHOLDER}}` syntax for values that projects must customize.

### Common Placeholders

| Placeholder | Description | Example Value |
|------------|-------------|---------------|
| `{{PROJECT_NAME}}` | Human-readable project name | "My Application" |
| `{{PROJECT_TYPE}}` | Technical project type (hyphenated) | "nodejs-application", "configuration-library" |
| `{{PROJECT_DESCRIPTION}}` | Brief project description | "RESTful API for user management" |
| `{{PROJECT_KIND}}` | Project kind from project_kinds.yaml (underscored) | "nodejs_api", "shell_script_automation", "configuration_library" |
| `{{VERSION}}` | Project version (semver, no 'v' prefix) | "1.0.0" |
| `{{LANGUAGE}}` | Primary programming language | "javascript", "bash", "python", "yaml" |
| `{{BUILD_SYSTEM}}` | Build system/package manager | "npm", "webpack", "maven", "none" |
| `{{TEST_FRAMEWORK}}` | Testing framework | "jest", "pytest", "shell-script", "validation-scripts" |
| `{{TEST_COMMAND}}` | Command to run tests | "npm test", "./tests/run_tests.sh", "python scripts/validate.py" |
| `{{LINT_COMMAND}}` | Command to run linter | "eslint .", "shellcheck **/*.sh", "yamllint config/" |

**Terminology Note:**
- `PROJECT_TYPE` uses hyphens: `"nodejs-application"`, `"configuration-library"`
- `PROJECT_KIND` uses underscores: `"nodejs_api"`, `"configuration_library"`
- Version format: `"1.0.0"` (no 'v' prefix in config values)

### Configuration Template Example

From `config/.workflow-config.yaml.template`:

```yaml
project:
  name: "{{PROJECT_NAME}}"
  type: "{{PROJECT_TYPE}}"  # hyphenated: nodejs-application, configuration-library
  description: "{{PROJECT_DESCRIPTION}}"
  kind: "{{PROJECT_KIND}}"  # underscored: nodejs_api, configuration_library
  version: "{{VERSION}}"    # no 'v' prefix: 1.0.0

tech_stack:
  primary_language: "{{LANGUAGE}}"  # javascript, bash, python, yaml
  build_system: "{{BUILD_SYSTEM}}"  # npm, webpack, maven, none
  test_framework: "{{TEST_FRAMEWORK}}"  # jest, pytest, validation-scripts
  test_command: "{{TEST_COMMAND}}"
  lint_command: "{{LINT_COMMAND}}"

structure:
  source_dirs:
    - src
  test_dirs:
    - tests
  docs_dirs:
    - docs
```

**Example - This Repository (ai_workflow_core):**
```yaml
project:
  name: "AI Workflow Core"
  type: "configuration-library"  # hyphenated
  kind: "configuration_library"   # underscored
  version: "1.0.0"                # no 'v' prefix

tech_stack:
  primary_language: "yaml"
  build_system: "none"
  test_framework: "validation-scripts"
  test_command: "python scripts/validate_context_blocks.py"
  lint_command: "yamllint -d relaxed config/"
```

### Project Integration Workflow

1. **Add as submodule**: `git submodule add https://github.com/mpbarbosa/ai_workflow_core.git .workflow_core`
2. **Copy template**: `cp .workflow_core/config/.workflow-config.yaml.template .workflow-config.yaml`
3. **Replace placeholders**: Edit `.workflow-config.yaml` with project-specific values
4. **Create artifact directory**: `mkdir -p .ai_workflow/{backlog,summaries,logs,metrics,checkpoints,prompts,ml_models,.incremental_cache}`
5. **Update .gitignore**: Add `.ai_workflow/` patterns to ignore generated artifacts

---

## Project Kinds System

### Supported Project Kinds

Defined in `config/project_kinds.yaml` (7 types) + this repo's own kind:

**Note**: This repository itself uses `kind: "configuration_library"` (a meta-type for configuration libraries, not included in the standard project_kinds.yaml definitions below).

**Standard Project Kinds:**

1. **shell_script_automation**: Bash/shell script projects
   - Test framework: bash_unit/BATS
   - Linters: shellcheck, shfmt
   - Standards: Google Shell Style Guide

2. **nodejs_api**: Node.js backend APIs
   - Test framework: jest/mocha/vitest
   - Linters: eslint, prettier
   - Coverage threshold: 80%

3. **client_spa**: Vanilla JS SPAs with Bootstrap
   - Test framework: jest/playwright
   - Linters: eslint, htmlhint, stylelint
   - Focus: No React/Vue/Angular

4. **react_spa**: React single-page applications
   - Test framework: jest/vitest with React Testing Library
   - Build required: true
   - TypeScript support

5. **static_website**: HTML/CSS/JavaScript static sites
   - Linters: htmlhint, stylelint
   - Accessibility: WCAG AA required

6. **python_app**: Python applications
   - Test framework: pytest/unittest
   - Linters: pylint, black, mypy
   - Docstrings: Google/NumPy/Sphinx format

7. **generic**: Fallback for other project types
   - Minimal assumptions
   - Basic documentation requirements

**Special Cases:**
- **configuration_library**: Meta-type used by ai_workflow_core itself (not in project_kinds.yaml as it's for libraries that define project kinds)

### Project Kind Schema

Each project kind defines:
- **validation**: Required files, directories, patterns
- **testing**: Framework, commands, coverage thresholds
- **quality**: Linters, documentation requirements
- **dependencies**: Package files, security audit commands
- **build**: Whether build is required, commands, output directories
- **deployment**: Deployment type, artifact patterns
- **ai_guidance**: Testing standards, style guides, best practices, directory standards

---

## Coding Standards & Conventions

### Documentation Standards

From project conventions:

- **File paths**: Always use inline code: `` `config/.workflow-config.yaml.template` ``
- **Commands**: Use code blocks or inline code: `` `git submodule add ...` ``
- **Configuration values**: Use inline code: `` `primary_language: "bash"` ``
- **Status indicators**: Use emoji: ✅ ❌ ⚠️ 🚧
- **Placeholders**: Keep `{{PLACEHOLDER}}` format in templates

### Template File Standards

**Template Naming:**
- Use `.template` extension for files that need customization
- Users copy without extension and replace placeholders

**Placeholder Format:**
```yaml
# In templates (ai_workflow_core):
project:
  name: "{{PROJECT_NAME}}"
  language: "{{LANGUAGE}}"

# In user projects (after customization):
project:
  name: "My Actual Project"
  language: "javascript"
```

**YAML Standards:**
- 2-space indentation
- Quote string values
- Comment complex sections
- Group related configurations
- Document required vs optional fields

### Script Standards (for templates)

For `.template` scripts:
```bash
#!/usr/bin/env bash
# Script name and purpose
# Placeholders: {{PROJECT_ROOT}}, {{ARTIFACT_DIR}}

set -euo pipefail

# Configuration with placeholders
readonly PROJECT_ROOT="{{PROJECT_ROOT}}"
readonly ARTIFACT_DIR="{{ARTIFACT_DIR}}"
```

### Commit Message Convention

Format:
```
<type>(<scope>): <subject>

<body>

<footer>
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

Example:
```
feat(config): Add TypeScript project kind

- Add typescript_app to project_kinds.yaml
- Define linting with tslint/eslint
- Set coverage threshold to 80%

Closes #123
```

---

## Key Documentation References

When assisting with this project, reference these critical documents:

### Essential Reading

1. **README.md**: Project overview, quick start, placeholder reference
2. **CHANGELOG.md**: Version history and changes
3. **docs/INTEGRATION.md**: Integration guide for using as Git submodule
4. **docs/AI_WORKFLOW_DIRECTORY.md**: `.ai_workflow/` directory structure explanation
5. **docs/CODE_OF_CONDUCT.md**: Contributor Covenant 2.1

### Configuration References (Core Assets)

6. **config/.workflow-config.yaml.template**: Main configuration template with placeholders
7. **config/project_kinds.yaml**: Project type definitions with validation rules (7 project types)
8. **config/ai_helpers.yaml**: AI helper configurations (1900+ lines)
9. **config/ai_prompts_project_kinds.yaml**: Project-specific AI prompts
10. **config/paths.yaml**: Path configurations
11. **config/README.md**: Configuration system overview

### Integration Examples

12. **examples/shell/README.md**: Shell script integration example (basic quick start)
13. **examples/nodejs/README.md**: Node.js integration example (comprehensive with full setup)

**Note**: The shell example is a minimal quick-start. The nodejs example provides a complete, detailed integration guide. Consider expanding the shell example with similar detail if working on examples.

### Additional Documentation

14. **docs/CONTRIBUTING.md**: Contributing guidelines (references parent ai_workflow project features)
15. **docs/guides/PROJECT_REFERENCE.md**: Project reference (documents parent ai_workflow v3.0.0)
16. **docs/guides/ML_OPTIMIZATION_GUIDE.md**: ML optimization guide (for parent project)
17. **docs/guides/MULTI_STAGE_PIPELINE_GUIDE.md**: Pipeline guide (for parent project)

### ⚠️ Important: Documentation Context

**Note**: `docs/CONTRIBUTING.md`, `docs/guides/PROJECT_REFERENCE.md`, and some other docs in `docs/guides/` reference features from the **parent ai_workflow project** (the execution engine), NOT this configuration library. When helping with ai_workflow_core:

- **Focus on**: Configuration templates, project_kinds schemas, placeholder patterns, integration examples
- **This repo provides**: Templates, configs, examples, documentation structure
- **This repo does NOT provide**: Workflow execution engine, step orchestration, AI pipeline features
- **Parent project** (ai_workflow) uses this as a foundation and adds execution capabilities

---

## Development Workflow

### Working on Configuration Templates

When modifying template files in `config/`:
1. Update the configuration file (`.yaml` or `.template`)
2. Update placeholder documentation in README.md if adding new placeholders
3. Test with actual values in `.workflow-config.yaml` (this repo's own config)
4. Update CHANGELOG.md if significant change
5. Ensure backward compatibility or document breaking changes in migration guide

### Adding New Project Kinds

To add a new project type to `config/project_kinds.yaml`:
1. Study existing project kind definitions (7 current types)
2. Define validation rules (required files, directories, file patterns)
3. Specify testing configuration (framework, commands, coverage thresholds)
4. Define quality standards (linters, documentation requirements)
5. Add AI guidance (testing standards, style guides, best practices, directory standards)
6. Update metadata changelog at bottom of file
7. Consider creating example integration in `examples/` directory

### Working on Examples

When creating or updating integration examples in `examples/`:
1. Create complete project structure showing realistic integration
2. Include customized `.workflow-config.yaml` with actual values (no placeholders)
3. Write comprehensive README.md with step-by-step setup
4. Show before/after for key configuration files
5. Include working code examples relevant to the language
6. Document common pitfalls and solutions

### Testing Changes

Since this is a template/configuration repository:
1. **Self-test**: Apply changes to `.workflow-config.yaml` in this repo
2. **Example test**: Verify changes work in `examples/*/` projects  
3. **Validation**: Run `scripts/validate_context_blocks.py` for documentation
4. **Schema validation**: Ensure YAML syntax is valid
5. **Placeholder verification**: Check all `{{PLACEHOLDERS}}` are documented

**No execution tests**: This repo doesn't contain workflow execution code, so there are no unit/integration tests for step execution.

### Documentation Updates

When updating documentation:
- Follow documentation conventions (inline code for paths, commands, config values)
- Update table of contents for long documents
- Include examples for complex concepts
- Test all commands and code examples if applicable
- Keep "Last Updated" dates current
- **Remember**: Some docs in `docs/guides/` reference parent ai_workflow features

---

## Common Assistance Patterns

### When Helping with Configuration Files

- Always preserve `{{PLACEHOLDER}}` syntax in template files
- Don't replace placeholders with specific values in core templates
- Validate YAML syntax (proper indentation, quoting)
- Check against existing project kind schemas in `config/project_kinds.yaml`
- Consider backward compatibility with existing integrations
- Document any new placeholders in README.md

### When Helping with Documentation

- Use inline code for file paths: `` `config/.workflow-config.yaml.template` ``
- Follow markdown conventions consistently
- Add examples for complex concepts
- Link to related configuration files or examples
- Keep language clear and concise
- Be aware some docs reference parent ai_workflow features

### When Helping with Script Templates

- Keep `.template` extension on template files
- Document required placeholder substitutions in comments
- Ensure cross-platform compatibility where possible (bash vs. platform-specific)
- Add usage examples in script header comments or accompanying README
- Use placeholder format: `{{PLACEHOLDER_NAME}}`

### When Helping with Integration

- Understand this project is used as a Git submodule, not standalone
- Guide through: add submodule → copy template → replace placeholders → create directories
- Reference appropriate example project (`examples/shell/` or `examples/nodejs/`)
- Explain `.ai_workflow/` directory purpose and `.gitignore` patterns
- Clarify this repo provides templates, not execution capabilities

### When Helping with Project Kinds

- Reference existing definitions in `config/project_kinds.yaml`
- Understand the schema: validation, testing, quality, dependencies, build, deployment, ai_guidance
- Know which linters and frameworks are standard for each project type
- Be aware of language-specific best practices in `ai_guidance` sections
- Consider test coverage thresholds (varies by project type: 0-80%)

### When Helping with GitHub Workflows

- Reference existing workflow files in `github/workflows/`
- Current workflows: `code-quality.yml`, `validate-docs.yml`, `validate-tests.yml`
- These are templates that projects can copy and customize
- Workflows assume the target project structure, not this repo's structure
- Workflows are language-agnostic and can be adapted for different project types

---

## Important Context

### This is a Configuration & Template Library

**What this repository IS:**
- Configuration file templates with placeholder patterns
- Project kind definitions and validation schemas
- Integration examples for different languages
- Documentation structure and standards
- Utility script templates
- GitHub workflow templates

**What this repository IS NOT:**
- A workflow execution engine (that's in the parent ai_workflow project)
- A complete automation system
- An application or service
- A testing framework

**Key Distinction:**
- **ai_workflow_core** = Templates + Configuration + Examples (this repo)
- **ai_workflow** = Execution Engine + Orchestration + AI Integration (parent project)

### Documentation Context Warning

⚠️ **Important**: Several documentation files in `docs/` were copied from the parent ai_workflow project and reference execution features:

**Files that reference parent project:**
- `docs/CONTRIBUTING.md` - Documents workflow execution, testing framework, v2.x/v3.x features
- `docs/guides/PROJECT_REFERENCE.md` - Documents ai_workflow v3.0.0 execution features
- `docs/guides/ML_OPTIMIZATION_GUIDE.md` - ML optimization for workflow execution
- `docs/guides/MULTI_STAGE_PIPELINE_GUIDE.md` - Pipeline execution patterns

**When helping with ai_workflow_core, focus on:**
- Configuration templates and schemas
- Placeholder patterns and substitution
- Project kind definitions
- Integration examples
- Documentation structure (not execution features)

### Dual Development Context

When working on this repository, you might be:
1. **Developing the config library**: Improving templates, schemas, examples
2. **Testing integration**: Using it as a submodule in another project
3. **Dogfooding**: Applying ai_workflow_core to itself (see `.workflow-config.yaml`)

Always clarify which context applies to the current task.

### Version Compatibility

- **ai_workflow_core version**: 1.0.0
- **Schema version** (project_kinds.yaml): 1.1.0
- Maintain backward compatibility within major version
- Document breaking changes in CHANGELOG.md
- Provide migration guides for major version changes

### Repository Scope

**This repository contains:**
- Configuration templates (2 files: `.workflow-config.yaml.template`, `cleanup_artifacts.sh.template`)
- Configuration schemas (5 YAML files in `config/`: project_kinds, ai_helpers, ai_prompts_project_kinds, paths, README)
- GitHub workflow templates (3 files in `github/workflows/`: code-quality, validate-docs, validate-tests)
- Integration examples (2 language examples: shell minimal quick-start, nodejs comprehensive guide)
- Documentation (7 core docs in `docs/` + 3 guides in `docs/guides/`)
- Utility scripts (1 Python validator: `validate_context_blocks.py`)
- Workflow artifacts in `.ai_workflow/` (for dogfooding - this repo tests itself)

**This repository does NOT contain:**
- Workflow execution engine (no `src/workflow/` directory)
- Test execution framework (no `tests/` directory)
- AI integration code (only configuration schemas for AI helpers)
- Step orchestration logic (only directory structure definitions)

**Terminology Standards:**
- Project type field: Use hyphens (e.g., `type: "nodejs-application"`, `type: "configuration-library"`)
- Project kind field: Use underscores (e.g., `kind: "nodejs_api"`, `kind: "configuration_library"`)
- YAML keys: Use underscores (e.g., `project_kinds`, `shell_script_automation`)
- Version format: No 'v' prefix in config values (e.g., `version: "1.0.0"` not `"v1.0.0"`)

### Integration Pattern

This repository is designed to be used as a Git submodule:
```bash
# In target project:
git submodule add https://github.com/mpbarbosa/ai_workflow_core.git .workflow_core
cp .workflow_core/config/.workflow-config.yaml.template .workflow-config.yaml
# Edit .workflow-config.yaml to replace {{PLACEHOLDERS}}
```

---

## Quick Reference

### File Extensions
- `.template`: Copy without extension, replace placeholders
- `.yaml` / `.yml`: Configuration files
- `.md`: Markdown documentation
- `.sh`: Shell scripts (must be executable)

### Common Commands
```bash
# Add as submodule
git submodule add https://github.com/mpbarbosa/ai_workflow_core.git .workflow_core

# Update submodule
git submodule update --init --recursive

# Copy and customize config
cp .workflow_core/config/.workflow-config.yaml.template .workflow-config.yaml

# Create artifact directories
mkdir -p .ai_workflow/{backlog,summaries,logs,metrics,checkpoints,prompts,ml_models,.incremental_cache}

# Run validation script
python3 scripts/validate_context_blocks.py docs/
```

### Placeholder Substitution Pattern
```bash
# Don't do this in core templates:
❌ name: "My Project"

# Do this in core templates:
✅ name: "{{PROJECT_NAME}}"

# Users do this in their projects:
✅ name: "My Actual Project"
```

---

## Contact & Resources

- **Repository**: [github.com/mpbarbosa/ai_workflow_core](https://github.com/mpbarbosa/ai_workflow_core)
- **Issues**: [GitHub Issues](https://github.com/mpbarbosa/ai_workflow_core/issues)
- **Original Project**: [github.com/mpbarbosa/ai_workflow](https://github.com/mpbarbosa/ai_workflow)
- **License**: MIT (see docs/LICENSE)

---

**Last Updated**: 2026-01-29  
**Document Version**: 1.0.0  
**For**: GitHub Copilot assistance within ai_workflow_core repository
