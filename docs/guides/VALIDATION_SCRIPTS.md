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
