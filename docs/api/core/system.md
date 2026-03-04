# system - System Information Module

**Module:** `core/system`
**Version:** 0.4.1 (via [`olinda_shell_interface.js`](https://github.com/mpbarbosa/olinda_shell_interface.js))
**Type:** Pure Functions

> **Note:** This module re-exports from the [`olinda_shell_interface.js`](https://github.com/mpbarbosa/olinda_shell_interface.js) package (installed from GitHub). The implementation lives upstream in [`src/core/system.ts`](https://github.com/mpbarbosa/olinda_shell_interface.js/blob/main/src/core/system.ts).

## Overview

Provides operating system detection, package manager identification, and system information utilities. Essential for cross-platform script compatibility and system-aware operations.

---

## Exports

### `OS` Enum

Operating system type constants.

**Type:** `Object<string, string>`

| Constant     | Value       | Description           |
| ------------ | ----------- | --------------------- |
| `OS.LINUX`   | `'linux'`   | Linux distributions   |
| `OS.MACOS`   | `'darwin'`  | macOS/Darwin          |
| `OS.WINDOWS` | `'win32'`   | Windows               |
| `OS.UNKNOWN` | `'unknown'` | Unrecognized platform |

### `PackageManager` Enum

Package manager type constants.

| Constant                    | Value       | OS      | Description   |
| --------------------------- | ----------- | ------- | ------------- |
| `PackageManager.APT`        | `'apt'`     | Linux   | Debian/Ubuntu |
| `PackageManager.PACMAN`     | `'pacman'`  | Linux   | Arch Linux    |
| `PackageManager.DNF`        | `'dnf'`     | Linux   | Fedora/RHEL   |
| `PackageManager.ZYPPER`     | `'zypper'`  | Linux   | openSUSE      |
| `PackageManager.BREW`       | `'brew'`    | macOS   | Homebrew      |
| `PackageManager.CHOCOLATEY` | `'choco'`   | Windows | Chocolatey    |
| `PackageManager.WINGET`     | `'winget'`  | Windows | winget        |
| `PackageManager.UNKNOWN`    | `'unknown'` | Any     | None detected |

---

## Functions

### `detectOS()`

Detect the current operating system.

**Returns:** `string` - OS constant

**Example:**

```javascript
import { detectOS, OS } from './core/system.js';

const os = detectOS();
if (os === OS.LINUX) {
  console.log('Running on Linux');
}
```

### `detectPackageManager()`

Detect the system package manager.

**Returns:** `string` - PackageManager constant

**Throws:** `SystemError` - If detection fails

### `commandExists(command)`

Check if a command exists on PATH.

**Parameters:**

- `command` (string) - Command to check

**Returns:** `boolean`

**Example:**

```javascript
if (commandExists('git')) {
  console.log('Git installed');
}
```

### `getSystemInfo()`

Get comprehensive system information.

**Returns:** `Object` with:

- `platform`: Node.js platform
- `os`: OS constant
- `arch`: CPU architecture
- `release`: OS version
- `hostname`: Machine name
- `cpus`: CPU core count
- `memory`: {total, free} in bytes
- `packageManager`: Detected PM

**Example:**

```javascript
const info = getSystemInfo();
console.log(`OS: ${info.os}`);
console.log(`CPUs: ${info.cpus}`);
console.log(`RAM: ${(info.memory.total / 1024 ** 3).toFixed(1)}GB`);
```

---

## Usage Examples

### Cross-Platform Commands

```javascript
import { detectOS, OS } from './core/system.js';

function getShellCommand() {
  const os = detectOS();
  return os === OS.WINDOWS ? 'cmd' : 'bash';
}
```

### Prerequisite Check

```javascript
import { commandExists } from './core/system.js';

const required = ['git', 'node', 'npm'];
const missing = required.filter((cmd) => !commandExists(cmd));

if (missing.length > 0) {
  console.error(`Missing: ${missing.join(', ')}`);
  process.exit(1);
}
```

---

## Related Modules

- **[executor](./executor.md)** - Uses for platform-specific commands
- **[errors](./errors.md)** - `SystemError` class

---

**Last Updated:** 2026-03-03
**Source package:** [`olinda_shell_interface.js` v0.4.1](https://github.com/mpbarbosa/olinda_shell_interface.js)
**Part of:** AI Workflow Automation v1.2.0
