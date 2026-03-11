# Validation Scripts

**Version**: 1.0.0
**Last Updated**: February 7, 2026

## Overview

Automated validation scripts to prevent common bugs and inconsistencies discovered during development.

---

## Scripts

### 1. Export Validation (`validate-exports.js`)

**Purpose**: Prevent export name mismatches between src/index.js and source modules.

**Problem Solved**:

- Discovered bug: `ConfigManager` exported but actual class is `Config`
- Similar issues with `BacklogManager` → `Backlog`, `MetricsCollector` → `Metrics`
- Prevented import failures for users

**Usage**:

```bash
npm run validate:exports

# or directly
node scripts/validate-exports.js

# verbose mode
node scripts/validate-exports.js --verbose
```

**Output**:

```
🔍 Export Validation

Found 13 re-exports to validate

✓ All exports validated successfully
```

**On Error**:

```
❌ ERROR: Export mismatch at line 38
   Export: ConfigManager
   Module: ./lib/config.js
   Available exports: Config, default

✗ 1 export error(s) found
```

**Features**:

- Parses export statements from source modules
- Validates re-exports in src/index.js
- Supports: `export class`, `export function`, `export const`, `export { name }`
- Handles async functions, default exports
- Color-coded output
- Exit codes: 0 = success, 1 = errors found

---

### 2. Version Consistency Check (`check-version-consistency.js`)

**Purpose**: Detect version mismatches between package.json and documentation.

**Problem Solved**:

- Discovered mismatches: package.json (1.0.0) vs README.md (1.2.0)
- Outdated version references in documentation
- Inconsistent versioning across 60+ documentation files

**Usage**:

```bash
npm run validate:versions

# or directly
node scripts/check-version-consistency.js
```

**Output**:

```
🔍 Version Consistency Check

Package version: 1.2.0

Checking version references in documentation...

Checked 62 files with version references

✗ Found version inconsistencies:

📋 Priority Files:

  README.md
    Current: 3.0.0, 2.7.0, 2.8.0
    Expected: 1.2.0
```

**Features**:

- Extracts package.json version
- Scans all markdown files recursively
- Detects version patterns: `Version: X.Y.Z`, `vX.Y.Z`, `@X.Y.Z`, `[X.Y.Z]`
- Prioritizes critical files (README.md, CHANGELOG.md)
- Exit codes: 0 = consistent, 1 = inconsistencies found

**Note**: Some version references are expected (e.g., CHANGELOG.md contains historical versions). The script is run with `continue-on-error: true` in CI to allow these expected differences.

---

## NPM Scripts

```json
{
  "validate": "npm run validate:exports && npm run validate:versions",
  "validate:exports": "node scripts/validate-exports.js",
  "validate:versions": "node scripts/check-version-consistency.js"
}
```

**Usage Examples**:

```bash
# Run both validations
npm run validate

# Run individually
npm run validate:exports
npm run validate:versions

# In CI/CD
npm run validate:exports  # Fails CI if errors
npm run validate:versions # Warns but doesn't fail
```

---

## CI/CD Integration

### GitHub Actions Workflow

The validation scripts are integrated into the `build-check` job:

```yaml
build-check:
  name: Build & Validation Check
  runs-on: ubuntu-latest

  steps:
    - name: Validate exports (prevent export mismatches)
      run: npm run validate:exports

    - name: Validate version consistency
      run: npm run validate:versions
      continue-on-error: true # Versions in CHANGELOG are expected
```

**Behavior**:

- Export validation **must pass** or CI fails
- Version consistency runs but doesn't fail CI (informational)
- Runs on all branches, all commits
- Takes ~1-2 seconds to execute

---

## When to Run

### During Development

- Before committing changes to src/index.js
- After refactoring that renames classes/functions
- Before creating a PR

### Automated (CI/CD)

- On every push (via build-check job)
- On every pull request
- Before merging to main

### Manual Checks

```bash
# Before releasing a new version
npm run validate

# After bulk documentation updates
npm run validate:versions
```

---

## Common Issues & Solutions

### Export Validation

#### Issue: "Export mismatch"

```
❌ ERROR: Export mismatch at line 38
   Export: ConfigManager
   Module: ./lib/config.js
   Available exports: Config
```

**Solution**:

1. Check the actual exports in the source module
2. Update src/index.js to use the correct name
3. Update documentation if the class was renamed

#### Issue: "Cannot read module"

```
⚠ WARNING: Cannot read module at line 45
   Module: ./lib/missing.js
```

**Solution**:

1. Verify the module path is correct
2. Check if the file exists
3. Remove the export if the module was deleted

---

### Version Consistency

#### Issue: "Outdated version references"

```
📋 Priority Files:

  README.md
    Current: 1.0.0
    Expected: 1.2.0
```

**Solution**:

1. For README.md: Update to current package.json version
2. For CHANGELOG.md: Historical versions are expected
3. For docs: Update if referring to "current version"

#### Issue: Many files flagged

**Normal**: Historical versions in CHANGELOG are expected
**Action**: Focus on priority files (README.md)

---

## Implementation Details

### Export Validation Algorithm

1. Parse src/index.js for re-export statements
2. For each re-export:
  - Resolve module path
  - Extract actual exports from source module using regex
  - Compare export name against available exports
  - Report mismatches

**Supported Export Patterns**:

```javascript
export class ClassName {}
export function functionName() {}
export async function asyncFunc() {}
export const VAR = value;
export { name1, name2 };
export default ClassName;
```

### Version Consistency Algorithm

1. Read version from package.json
2. Find all .md files recursively
3. For each file:
  - Extract version references using multiple regex patterns
  - Compare against package.json version
  - Classify by priority (README.md, CHANGELOG.md)
4. Report inconsistencies

**Detected Version Patterns**:

```
Version: 1.2.0
v1.2.0
@1.2.0
[1.2.0]
version: v1.2.0
```

---

## Performance

| Script            | Files Checked | Typical Duration | Exit on Error |
| ----------------- | ------------- | ---------------- | ------------- |
| validate:exports  | ~40 modules   | <1 second        | Yes           |
| validate:versions | ~60 .md files | <1 second        | No            |
| Combined          | ~100 files    | <2 seconds       | Partial       |

---

## Future Enhancements

### Potential Improvements

1. **Export Validation**
  - Support TypeScript (.ts files)
  - Validate default exports more thoroughly
  - Check for duplicate exports
  - Validate import statements match exports

2. **Version Consistency**
  - Exclude CHANGELOG.md from strict checks
  - Allow version ranges (e.g., ^1.2.0)
  - Check package-lock.json consistency
  - Validate dependency versions

3. **New Validators**
  - Link validation (check for broken links)
  - API consistency (ensure docs match implementation)
  - Example code validation (run examples as tests)

---

## Related Documentation

- [Testing Guide](./TESTING_GUIDE.md)
- [Test Splitting Strategy](./TEST_SPLITTING.md)
- [CI/CD Workflow](../../.github/workflows/ci.yml)
- [Package Scripts](../../package.json)

---

## Version History

| Version | Date       | Changes                                   |
| ------- | ---------- | ----------------------------------------- |
| 1.0.0   | 2026-02-07 | Initial validation scripts implementation |

---

## Workflow Core Submodule Scripts

The `.workflow_core/` submodule contains additional Python validation scripts for documentation quality checks. These scripts are maintained separately and shared across ai_workflow projects.

### Location

```
.workflow_core/
└── scripts/
    ├── validate_context_blocks.py
    └── validate_structure.py
```

### Python Requirements

```bash
# Python 3.8+ required
python3 --version

# No external dependencies - uses standard library only
```

### 1. Context Block Validator (`validate_context_blocks.py`)

**Purpose**: Validate XML-like context blocks in documentation files

**Problem Solved**:

- Detects unclosed context tags (e.g., `<context>` without `</context>`)
- Finds mismatched tags (e.g., `<summary>` closed with `</overview>`)
- Identifies malformed XML structures in markdown documentation
- Prevents broken metadata that confuses documentation parsers

**Usage**:

```bash
# Validate all documentation
python3 .workflow_core/scripts/validate_context_blocks.py docs/

# Validate specific file
python3 .workflow_core/scripts/validate_context_blocks.py docs/guides/USER_GUIDE.md

# Verbose output
python3 .workflow_core/scripts/validate_context_blocks.py docs/ --verbose

# JSON output for CI integration
python3 .workflow_core/scripts/validate_context_blocks.py docs/ --json
```

**Output (Success)**:

```
✓ Validating context blocks in documentation...

Checked 62 files
Found 0 errors

✓ All context blocks are valid
```

**Output (Errors)**:

```
✗ Validation errors found:

docs/guides/EXAMPLE.md:45
  ❌ Unclosed tag: <context>

docs/api/config.md:102
  ❌ Mismatched tags: <summary> closed with </overview>

✗ 2 error(s) found in 2 file(s)
```

**Common Context Blocks**:

```xml
<context>
  <!-- Project-specific context information -->
</context>

<summary>
  <!-- Brief overview or summary -->
</summary>

<technical_details>
  <!-- Technical implementation details -->
</technical_details>

<code_example>
  <!-- Code examples with annotations -->
</code_example>
```

**Validation Rules**:

1. **Balanced Tags**: Every opening tag must have a matching closing tag
2. **Nesting**: Tags must be properly nested (no overlapping)
3. **Case Sensitivity**: Tags are case-sensitive (`<Context>` ≠ `<context>`)
4. **No Attributes**: Context blocks don't support attributes

**Features**:

- Parses markdown files for XML-like context blocks
- Maintains tag stack for nesting validation
- Reports line numbers for errors
- Supports multiple documentation directories
- Exit code: 0 = valid, 1 = errors found

### 2. Structure Validator (`validate_structure.py`)

**Purpose**: Validate documentation structure and organization

**Problem Solved**:

- Detects missing required documentation files
- Verifies directory structure matches conventions
- Checks for broken documentation hierarchy
- Ensures consistency across documentation sections

**Usage**:

```bash
# Validate documentation structure
python3 .workflow_core/scripts/validate_structure.py docs/

# Check specific sections
python3 .workflow_core/scripts/validate_structure.py docs/ --section api

# Verbose mode with suggestions
python3 .workflow_core/scripts/validate_structure.py docs/ --verbose

# JSON output for automation
python3 .workflow_core/scripts/validate_structure.py docs/ --json
```

**Output (Success)**:

```
✓ Validating documentation structure...

Directory structure: ✓ Valid
Required files: ✓ All present
Section organization: ✓ Consistent

✓ Documentation structure is valid
```

**Output (Warnings)**:

```
⚠ Structure validation completed with warnings:

docs/api/
  ⚠ Missing README.md index file

docs/guides/
  ✓ All sections present

docs/examples/
  ❌ Missing required directory

⚠ 2 warning(s), 1 error(s) found
```

**Validated Structure**:

```
docs/
├── README.md                    # ✓ Required
├── api/                         # ✓ Required
│   ├── README.md                # ✓ Required
│   ├── core/                    # ✓ Required
│   ├── lib/                     # ✓ Required
│   └── orchestrator/            # ✓ Required
├── guides/                      # ✓ Required
│   ├── DEVELOPER_GUIDE.md       # ✓ Required
│   ├── USER_GUIDE.md            # ✓ Required
│   └── TESTING_GUIDE.md         # ✓ Required
├── architecture/                # ✓ Required
│   └── OVERVIEW.md              # ✓ Required
├── examples/                    # ⚠ Optional
└── reference/                   # ⚠ Optional
```

**Features**:

- Checks for required files and directories
- Validates naming conventions (UPPERCASE vs lowercase)
- Detects empty directories
- Suggests missing sections
- Exit code: 0 = valid, 1 = errors (warnings don't fail)

### NPM Scripts Integration

Add to `package.json`:

```json
{
  "scripts": {
    "validate": "npm run validate:exports && npm run validate:versions && npm run validate:docs",
    "validate:docs": "npm run validate:context && npm run validate:structure",
    "validate:context": "python3 .workflow_core/scripts/validate_context_blocks.py docs/",
    "validate:structure": "python3 .workflow_core/scripts/validate_structure.py docs/"
  }
}
```

**Usage**:

```bash
# Run all validations (JS + Python)
npm run validate

# Run documentation validations only
npm run validate:docs

# Run individually
npm run validate:context
npm run validate:structure
```

### CI/CD Integration

Add to `.github/workflows/validate-docs.yml`:

```yaml
name: Validate Documentation

on:
  push:
    paths:
      - 'docs/**'
      - '.workflow_core/**'
  pull_request:
    paths:
      - 'docs/**'

jobs:
  validate-structure:
    name: Validate Docs Structure
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4
        with:
          submodules: true # Fetch .workflow_core submodule

      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.x'

      - name: Validate context blocks
        run: python3 .workflow_core/scripts/validate_context_blocks.py docs/

      - name: Validate documentation structure
        run: python3 .workflow_core/scripts/validate_structure.py docs/
        continue-on-error: true # Warnings don't fail CI
```

### Troubleshooting

#### Issue: "Python not found"

**Solution**:

```bash
# Install Python 3
sudo apt-get install python3  # Ubuntu/Debian
brew install python3           # macOS

# Verify installation
python3 --version
```

#### Issue: "Module not found"

**Solution**:

```bash
# Ensure submodule is initialized
git submodule init
git submodule update

# Verify scripts exist
ls -la .workflow_core/scripts/
```

#### Issue: "Permission denied"

**Solution**:

```bash
# Add executable permission
chmod +x .workflow_core/scripts/*.py

# Or run with python3 explicitly
python3 .workflow_core/scripts/validate_context_blocks.py docs/
```

### When to Run

**During Development**:

- Before committing documentation changes
- After adding new context blocks
- When restructuring documentation

**Automated (CI/CD)**:

- On every documentation change (via paths filter)
- On pull requests affecting docs/
- Before releases

### Performance

| Script                     | Files Checked | Typical Duration | Exit on Error |
| -------------------------- | ------------- | ---------------- | ------------- |
| validate_context_blocks.py | ~60 .md files | <2 seconds       | Yes           |
| validate_structure.py      | docs/ tree    | <1 second        | Partial       |
| Combined                   | ~60+ files    | <3 seconds       | Partial       |

### Related Documentation

- [Developer Guide](./DEVELOPER_GUIDE.md) - Development workflow
- [Architecture Overview](../architecture/OVERVIEW.md) - Workflow core usage

---

**Script Versions:**

- `validate_context_blocks.py`: 1.0.0
- `validate_structure.py`: 1.0.0

**Maintained By:** AI Workflow Core Team
**Repository:** [.workflow_core](../../.workflow_core/)
**Last Validated:** 2026-02-08
