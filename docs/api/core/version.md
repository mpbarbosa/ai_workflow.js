# version - Version Comparison Module

**Module:** `core/version`
**Version:** 2.2.17
**Type:** Pure Functional

## Overview

Semantic version parsing and comparison utilities following [SemVer 2.0.0](https://semver.org/). Handles versions like `1.2.3`, `v2.0.0-beta`, `3.1.4+build.123`.

---

## Functions

### `parseVersion(version)`

Parse version string into components.

**Parameters:** `version` (string) - e.g., "1.2.3", "v2.0.0-beta"

**Returns:** `{major, minor, patch, prerelease, build}`

**Example:**

```javascript
parseVersion('1.2.3');
// { major: 1, minor: 2, patch: 3, prerelease: '', build: '' }

parseVersion('v2.0.0-beta.1+build.456');
// { major: 2, minor: 0, patch: 0, prerelease: 'beta.1', build: 'build.456' }
```

### `compareVersions(version1, version2)`

Compare two versions.

**Returns:** `-1` (v1 < v2), `0` (equal), `1` (v1 > v2)

**Example:**

```javascript
compareVersions('1.0.0', '2.0.0'); // -1
compareVersions('2.1.0', '2.0.0'); //  1
compareVersions('1.0.0', '1.0.0'); //  0
```

### `isGreaterThan(v1, v2)`, `isLessThan(v1, v2)`, `isEqual(v1, v2)`

Boolean version comparisons.

### `getLatestVersion(versions)`

Find latest version from array.

**Example:**

```javascript
<<<<<<< HEAD
getLatestVersion(['1.0.0', '2.1.0', '1.9.11']); // '2.1.0'
=======
getLatestVersion(['1.0.0', '2.1.0', '1.6.1']); // '2.1.0'
>>>>>>> a4c4d4d (chore(workflow): update docs and metrics [skip ci])
```

---

## Usage Examples

### Version Requirements

```javascript
import { isLessThan } from './core/version.js';

const required = '14.0.0';
const current = process.version.replace('v', '');

if (isLessThan(current, required)) {
  console.error(`Node ${required}+ required`);
  process.exit(1);
}
```

### Update Check

```javascript
import { isGreaterThan, getLatestVersion } from './core/version.js';

const latest = getLatestVersion(remoteVersions);
if (isGreaterThan(latest, currentVersion)) {
  console.log(`Update available: ${latest}`);
}
```

---

## SemVer Rules

- Format: `<major>.<minor>.<patch>[-<prerelease>][+<build>]`
- Prerelease: `1.0.0-alpha` < `1.0.0`
- Build metadata ignored in comparisons

---

**Last Updated:** 2026-02-01
**Part of:** AI Workflow Automation v1.9.11
