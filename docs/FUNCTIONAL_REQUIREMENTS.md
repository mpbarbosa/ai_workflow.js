# Functional Requirements: Core Foundation Layer

**Project:** ai_workflow.js  
**Phase:** 1 - Foundation and Development Setup  
**Version:** 1.0.0  
**Date:** January 29, 2026  
**Status:** Active

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture Overview](#2-architecture-overview)
3. [Module Requirements](#3-module-requirements)
   - [3.1 colors.js](#31-colorsjs---terminal-color-support)
   - [3.2 logger.js](#32-loggerjs---logging-system)
   - [3.3 errors.js](#33-errorsjs---error-handling)
   - [3.4 system.js](#34-systemjs---system-detection)
   - [3.5 version.js](#35-versionjs---version-management)
   - [3.6 executor.js](#36-executorjs---command-execution)
   - [3.7 index.js](#37-indexjs---module-exports)
4. [Integration Requirements](#4-integration-requirements)
5. [Quality Requirements](#5-quality-requirements)
6. [Testing Strategy](#6-testing-strategy)
7. [Future Considerations](#7-future-considerations)
8. [Appendices](#appendices)

---

## 1. Overview

### 1.1 Purpose

This document defines the functional requirements for the core foundation layer of ai_workflow.js, a JavaScript/Node.js migration of the AI workflow automation system. The foundation layer provides essential utilities for logging, error handling, system detection, version management, and command execution that will be used throughout the application.

### 1.2 Scope

This document covers the requirements for **7 core modules** implemented in Phase 1:

| Module                 | Lines of Code | Purpose                                            |
| ---------------------- | ------------- | -------------------------------------------------- |
| `src/core/colors.js`   | ~54           | ANSI color codes and terminal support detection    |
| `src/core/logger.js`   | ~99           | Logging system with multiple severity levels       |
| `src/utils/errors.js`  | ~68           | Custom error class hierarchy                       |
| `src/core/system.js`   | ~130          | Operating system and package manager detection     |
| `src/core/version.js`  | ~114          | Semantic version parsing and comparison            |
| `src/core/executor.js` | ~105          | Command execution with async and streaming support |
| `src/index.js`         | ~25           | Module exports and public API                      |

**Total:** ~595 lines of code (excluding comments and blank lines)

### 1.3 Target Users

- **Primary:** Future developers implementing package managers and workflow orchestration
- **Secondary:** End users through CLI output and error messages
- **Tertiary:** System administrators and DevOps engineers

### 1.4 Related Documents

- [MIGRATION_PLAN.md](../MIGRATION_PLAN.md) - Overall migration strategy
- [README.md](../README.md) - Project overview
- Source repository: [mpbarbosa/ai_workflow](https://github.com/mpbarbosa/ai_workflow)

### 1.5 Conventions

This document uses RFC 2119 keywords:

- **MUST** / **REQUIRED** / **SHALL**: Absolute requirement
- **SHOULD** / **RECOMMENDED**: Best practice but not absolute
- **MAY** / **OPTIONAL**: Truly optional feature

---

## 2. Architecture Overview

### 2.1 Module Dependencies

```
┌─────────────────────────────────────────┐
│           src/index.js                  │
│         (Public API Exports)            │
└────────────┬────────────────────────────┘
             │
    ┌────────┴────────┬─────────────────┐
    │                 │                 │
    ▼                 ▼                 ▼
┌─────────┐    ┌──────────┐    ┌──────────────┐
│  core/  │    │  core/   │    │   utils/     │
│ colors  │◄───┤  logger  │    │   errors     │
└─────────┘    └──────────┘    └──────────────┘
                     ▲                 ▲
                     │                 │
              ┌──────┴─────┬───────────┘
              │            │
          ┌───▼──┐    ┌────▼──────┐
          │core/ │    │   core/   │
          │system│    │ executor  │
          └──────┘    └───────────┘
                           │
                      ┌────▼────┐
                      │  core/  │
                      │ version │
                      └─────────┘
```

### 2.2 Design Principles

1. **Modularity**: Each module has a single, well-defined responsibility
2. **ES Modules**: Using modern JavaScript module system
3. **Cross-Platform**: Support Linux, macOS, and Windows
4. **Error-First**: Comprehensive error handling with custom error types
5. **Testability**: Pure functions where possible, dependency injection
6. **Performance**: Efficient algorithms, minimal dependencies
7. **Developer Experience**: Clear APIs, helpful error messages

### 2.3 Technology Stack

- **Runtime:** Node.js 18+
- **Module System:** ES Modules (type: "module")
- **Testing:** Jest with experimental VM modules
- **Linting:** ESLint 9+ with flat config
- **Formatting:** Prettier

---

## 3. Module Requirements

### 3.1 colors.js - Terminal Color Support

#### 3.1.1 Purpose

Provides ANSI color codes and utilities for colorizing terminal output with automatic detection of terminal capabilities.

#### 3.1.2 Functional Requirements

**FR-COLOR-001: Color Code Constants** [REQUIRED]

- The module MUST export a `colors` object containing ANSI escape codes for:
  - Basic formatting: `reset`, `bold`, `dim`
  - Standard colors: `black`, `red`, `green`, `yellow`, `blue`, `magenta`, `cyan`, `white`
  - Bright colors: `brightRed`, `brightGreen`, `brightYellow`, `brightBlue`, `brightMagenta`, `brightCyan`, `brightWhite`

**FR-COLOR-002: Terminal Support Detection** [REQUIRED]

- The module MUST provide a `supportsColor()` function that returns `true` if:
  - `process.stdout.isTTY` is true, AND
  - `process.env.TERM` is not 'dumb', AND
  - `process.env.NO_COLOR` is not set
- The function MUST return `false` otherwise

**FR-COLOR-003: Text Colorization** [REQUIRED]

- The module MUST provide a `colorize(text, color)` function that:
  - Applies the specified color code to the text if colors are supported
  - Returns plain text if colors are not supported
  - Automatically resets color after the text

**FR-COLOR-004: Environment Variables** [REQUIRED]

- The module MUST respect the `NO_COLOR` environment variable (industry standard)
- The module SHOULD respect the `FORCE_COLOR` environment variable [RECOMMENDED]

#### 3.1.3 API Specification

```javascript
// Export: Color codes object
export const colors = {
  reset: string,
  bold: string,
  dim: string,
  // ... (all color codes)
}

// Export: Color support detection
export function supportsColor(): boolean

// Export: Colorize text
export function colorize(text: string, color: string): string
```

#### 3.1.4 Usage Examples

```javascript
import { colors, colorize, supportsColor } from './core/colors.js';

// Check color support
if (supportsColor()) {
  console.log('Terminal supports colors');
}

// Colorize output
console.log(colorize('Success!', colors.green));
console.log(colorize('Error!', colors.red));

// Manual color application
console.log(`${colors.bold}Bold text${colors.reset}`);
```

#### 3.1.5 Error Conditions

- None. Functions are defensive and always return valid output.

#### 3.1.6 Dependencies

- **Node.js Built-in:** None (uses only `process` global)
- **Internal:** None
- **External:** None

#### 3.1.7 Testing Requirements

**TC-COLOR-001**: Verify color object contains all required codes  
**TC-COLOR-002**: Test `supportsColor()` with different terminal configurations  
**TC-COLOR-003**: Verify `colorize()` returns colored text when supported  
**TC-COLOR-004**: Verify `colorize()` returns plain text when not supported  
**TC-COLOR-005**: Test `NO_COLOR` environment variable respect

**Coverage Target:** 100%

---

### 3.2 logger.js - Logging System

#### 3.2.1 Purpose

Provides a structured logging system with multiple severity levels, colorized output, and configurable verbosity for consistent application-wide logging.

#### 3.2.2 Functional Requirements

**FR-LOG-001: Log Levels** [REQUIRED]

- The module MUST support five log levels:
  - `DEBUG`: Detailed diagnostic information (only in verbose mode)
  - `INFO`: General informational messages
  - `SUCCESS`: Success confirmations
  - `WARN`: Warning messages
  - `ERROR`: Error messages
- Each level MUST have a distinct visual representation (color and prefix)

**FR-LOG-002: Logger Class** [REQUIRED]

- The module MUST provide a `Logger` class with:
  - Constructor accepting options: `{ quiet, verbose, prefix }`
  - Methods: `debug()`, `info()`, `success()`, `warn()`, `error()`
  - Private method: `_format()` for message formatting

**FR-LOG-003: Quiet Mode** [REQUIRED]

- When `quiet` option is `true`:
  - `debug()`, `info()`, and `success()` MUST NOT output anything
  - `warn()` and `error()` MUST still output (cannot be silenced)

**FR-LOG-004: Verbose Mode** [REQUIRED]

- When `verbose` option is `true`:
  - `debug()` messages MUST be output
- When `verbose` option is `false`:
  - `debug()` messages MUST NOT be output

**FR-LOG-005: Message Prefixing** [OPTIONAL]

- The Logger MAY accept a `prefix` option that prepends all messages
- The prefix SHOULD be useful for scoping logs (e.g., "APT Manager")

**FR-LOG-006: Default Logger Instance** [REQUIRED]

- The module MUST export a default `logger` instance with default options
- This allows simple usage without instantiation

**FR-LOG-007: Visual Indicators** [REQUIRED]

- Success messages MUST use ✓ prefix and green color
- Warning messages MUST use ⚠ prefix and yellow color
- Error messages MUST use ✗ prefix and red color
- Debug messages MUST use [DEBUG] prefix and dim color
- Info messages MUST use cyan color (no special prefix)

#### 3.2.3 API Specification

```javascript
// Export: Log levels enum
export const LogLevel = {
  DEBUG: 'debug',
  INFO: 'info',
  SUCCESS: 'success',
  WARN: 'warn',
  ERROR: 'error',
}

// Export: Logger class
export class Logger {
  constructor(options?: { quiet?: boolean, verbose?: boolean, prefix?: string })
  debug(message: string): void
  info(message: string): void
  success(message: string): void
  warn(message: string): void
  error(message: string): void
}

// Export: Default logger instance
export const logger: Logger
```

#### 3.2.4 Usage Examples

```javascript
import { Logger, logger } from './core/logger.js';

// Use default logger
logger.info('Starting application');
logger.success('Operation completed');
logger.warn('Deprecated feature used');
logger.error('Failed to connect');

// Create custom logger
const aptLogger = new Logger({
  prefix: 'APT',
  verbose: true,
});
aptLogger.debug('Checking package status');
aptLogger.info('Installing package');

// Quiet mode for scripts
const quietLogger = new Logger({ quiet: true });
quietLogger.info('This will not be shown');
quietLogger.error('But this will');
```

#### 3.2.5 Error Conditions

- None. Logger methods do not throw errors; they fail silently if output streams are unavailable.

#### 3.2.6 Dependencies

- **Node.js Built-in:** `console`
- **Internal:** `core/colors.js` (colorize, colors)
- **External:** None

#### 3.2.7 Testing Requirements

**TC-LOG-001**: Verify all log levels produce correct output  
**TC-LOG-002**: Test quiet mode suppresses info/success/debug  
**TC-LOG-003**: Test quiet mode still shows warn/error  
**TC-LOG-004**: Test verbose mode enables debug output  
**TC-LOG-005**: Test prefix is correctly applied  
**TC-LOG-006**: Verify color codes are applied correctly  
**TC-LOG-007**: Test default logger instance works

**Coverage Target:** 95%+

---

### 3.3 errors.js - Error Handling

#### 3.3.1 Purpose

Provides a hierarchy of custom error classes for structured error handling across the application, enabling precise error catching and reporting.

#### 3.3.2 Functional Requirements

**FR-ERR-001: Base Error Class** [REQUIRED]

- The module MUST provide `WorkflowError` as the base class for all application errors
- `WorkflowError` MUST extend the native `Error` class
- It MUST include:
  - `name` property set to 'WorkflowError'
  - `code` property (default: 'WORKFLOW_ERROR')
  - `message` property (from Error)
  - Stack trace via `Error.captureStackTrace()`

**FR-ERR-002: System Error** [REQUIRED]

- The module MUST provide `SystemError` for OS-related failures
- It MUST extend `WorkflowError`
- Error code: `SYSTEM_ERROR`
- Use cases: OS detection failures, permission issues, system command failures

**FR-ERR-003: Execution Error** [REQUIRED]

- The module MUST provide `ExecutionError` for command execution failures
- It MUST extend `WorkflowError`
- It MUST include additional properties:
  - `exitCode`: Process exit code (number)
  - `stdout`: Standard output (string)
  - `stderr`: Standard error (string)
- Error code: `EXECUTION_ERROR`

**FR-ERR-004: Configuration Error** [REQUIRED]

- The module MUST provide `ConfigurationError` for config-related issues
- It MUST extend `WorkflowError`
- Error code: `CONFIG_ERROR`
- Use cases: Invalid config files, missing required config, parse errors

**FR-ERR-005: Validation Error** [REQUIRED]

- The module MUST provide `ValidationError` for input validation failures
- It MUST extend `WorkflowError`
- It MUST include optional `field` property to identify invalid field
- Error code: `VALIDATION_ERROR`

**FR-ERR-006: Error Hierarchy** [REQUIRED]

- All custom errors MUST be catchable as `WorkflowError`
- Each specific error type MUST be catchable individually
- Stack traces MUST point to the actual error location, not the error class constructor

#### 3.3.3 API Specification

```javascript
// Export: Base error
export class WorkflowError extends Error {
  constructor(message: string, code?: string)
  name: string
  code: string
  message: string
  stack: string
}

// Export: System error
export class SystemError extends WorkflowError {
  constructor(message: string)
}

// Export: Execution error
export class ExecutionError extends WorkflowError {
  constructor(message: string, exitCode?: number, stdout?: string, stderr?: string)
  exitCode: number
  stdout: string
  stderr: string
}

// Export: Configuration error
export class ConfigurationError extends WorkflowError {
  constructor(message: string)
}

// Export: Validation error
export class ValidationError extends WorkflowError {
  constructor(message: string, field?: string | null)
  field: string | null
}
```

#### 3.3.4 Usage Examples

```javascript
import {
  WorkflowError,
  SystemError,
  ExecutionError,
  ConfigurationError,
  ValidationError,
} from './utils/errors.js';

// Throw specific errors
throw new SystemError('Failed to detect operating system');
throw new ConfigurationError('Invalid YAML syntax in config file');
throw new ValidationError('Version must be in semver format', 'version');

// Throw execution error with details
throw new ExecutionError(
  'apt-get update failed',
  1,
  '', // stdout
  'E: Could not get lock' // stderr
);

// Catch specific error types
try {
  await someOperation();
} catch (error) {
  if (error instanceof ExecutionError) {
    console.error(`Command failed with exit code ${error.exitCode}`);
    console.error(`Error output: ${error.stderr}`);
  } else if (error instanceof WorkflowError) {
    console.error(`Workflow error: ${error.message} (${error.code})`);
  } else {
    throw error; // Re-throw unknown errors
  }
}
```

#### 3.3.5 Error Conditions

- None. Error classes are constructors and do not perform operations that can fail.

#### 3.3.6 Dependencies

- **Node.js Built-in:** `Error` (native)
- **Internal:** None
- **External:** None

#### 3.3.7 Testing Requirements

**TC-ERR-001**: Verify WorkflowError has correct properties  
**TC-ERR-002**: Test each error subclass extends WorkflowError  
**TC-ERR-003**: Verify error codes are correct  
**TC-ERR-004**: Test ExecutionError stores exitCode, stdout, stderr  
**TC-ERR-005**: Test ValidationError stores field name  
**TC-ERR-006**: Verify stack traces point to throw site  
**TC-ERR-007**: Test instanceof checks work for hierarchy  
**TC-ERR-008**: Verify error can be caught as WorkflowError

**Coverage Target:** 100%

---

### 3.4 system.js - System Detection

#### 3.4.1 Purpose

Detects the operating system, package manager, and provides system information for cross-platform compatibility and package manager selection.

#### 3.4.2 Functional Requirements

**FR-SYS-001: OS Constants** [REQUIRED]

- The module MUST export an `OS` object with constants:
  - `LINUX`: 'linux'
  - `MACOS`: 'darwin'
  - `WINDOWS`: 'win32'
  - `UNKNOWN`: 'unknown'

**FR-SYS-002: Package Manager Constants** [REQUIRED]

- The module MUST export a `PackageManager` object with constants for:
  - Linux: `APT`, `PACMAN`, `DNF`, `ZYPPER`
  - macOS: `BREW`
  - Windows: `CHOCOLATEY`, `WINGET`
  - Fallback: `UNKNOWN`

**FR-SYS-003: OS Detection** [REQUIRED]

- The module MUST provide `detectOS()` function that:
  - Returns one of the OS constants
  - Uses Node.js `os.platform()` for detection
  - Maps platform values: 'darwin' → MACOS, 'win32' → WINDOWS, 'linux' → LINUX
  - Returns UNKNOWN for unsupported platforms

**FR-SYS-004: Package Manager Detection** [REQUIRED]

- The module MUST provide `detectPackageManager()` function that:
  - Detects the primary package manager for the current OS
  - Checks for command existence on PATH
  - Returns appropriate PackageManager constant
  - Throws `SystemError` if detection fails

**FR-SYS-005: Linux Package Manager Priority** [REQUIRED]

- For Linux, detection MUST check in priority order:
  1. APT (apt-get)
  2. Pacman
  3. DNF
  4. Zypper
- Returns the first available package manager

**FR-SYS-006: Windows Package Manager Priority** [REQUIRED]

- For Windows, detection MUST check in priority order:
  1. winget
  2. choco
- Returns the first available package manager

**FR-SYS-007: Command Existence Check** [REQUIRED]

- The module MUST provide `commandExists(command)` function that:
  - Returns `true` if command is available on PATH
  - Returns `false` if command is not found
  - Uses platform-appropriate check: `command -v` (Unix) or `where` (Windows)
  - Never throws errors (returns false on failure)

**FR-SYS-008: System Information** [REQUIRED]

- The module MUST provide `getSystemInfo()` function that returns:
  - `platform`: Raw platform string
  - `os`: Detected OS constant
  - `arch`: System architecture (x64, arm64, etc.)
  - `release`: OS release/version
  - `hostname`: Machine hostname
  - `cpus`: Number of CPU cores
  - `memory`: Object with `total` and `free` in bytes
  - `packageManager`: Detected package manager constant

#### 3.4.3 API Specification

```javascript
// Export: OS constants
export const OS = {
  LINUX: 'linux',
  MACOS: 'darwin',
  WINDOWS: 'win32',
  UNKNOWN: 'unknown',
}

// Export: Package manager constants
export const PackageManager = {
  APT: 'apt',
  PACMAN: 'pacman',
  DNF: 'dnf',
  ZYPPER: 'zypper',
  BREW: 'brew',
  CHOCOLATEY: 'choco',
  WINGET: 'winget',
  UNKNOWN: 'unknown',
}

// Export: Detect OS
export function detectOS(): string

// Export: Detect package manager
export function detectPackageManager(): string

// Export: Check command existence
export function commandExists(command: string): boolean

// Export: Get system information
export function getSystemInfo(): {
  platform: string,
  os: string,
  arch: string,
  release: string,
  hostname: string,
  cpus: number,
  memory: { total: number, free: number },
  packageManager: string,
}
```

#### 3.4.4 Usage Examples

```javascript
import {
  OS,
  PackageManager,
  detectOS,
  detectPackageManager,
  commandExists,
  getSystemInfo,
} from './core/system.js';

// Detect operating system
const os = detectOS();
if (os === OS.LINUX) {
  console.log('Running on Linux');
}

// Detect package manager
try {
  const pm = detectPackageManager();
  if (pm === PackageManager.APT) {
    console.log('Using APT package manager');
  }
} catch (error) {
  console.error('Could not detect package manager');
}

// Check if command exists
if (commandExists('docker')) {
  console.log('Docker is installed');
}

// Get full system info
const sysInfo = getSystemInfo();
console.log(`Running on ${sysInfo.os} (${sysInfo.arch})`);
console.log(`${sysInfo.cpus} CPUs, ${sysInfo.memory.total} bytes RAM`);
```

#### 3.4.5 Error Conditions

**ERR-SYS-001:** `detectPackageManager()` throws `SystemError` if:

- Detection logic fails with unexpected error
- System calls fail

**Note:** Functions are generally defensive and return fallback values (UNKNOWN) rather than throwing.

#### 3.4.6 Dependencies

- **Node.js Built-in:** `os`, `child_process` (execSync)
- **Internal:** `utils/errors.js` (SystemError)
- **External:** None

#### 3.4.7 Testing Requirements

**TC-SYS-001**: Test detectOS() returns correct value for each platform  
**TC-SYS-002**: Test detectOS() returns UNKNOWN for unsupported platform  
**TC-SYS-003**: Test detectPackageManager() for each OS  
**TC-SYS-004**: Test detectPackageManager() throws on failure  
**TC-SYS-005**: Test commandExists() returns true for existing commands  
**TC-SYS-006**: Test commandExists() returns false for non-existent commands  
**TC-SYS-007**: Test commandExists() works on Windows and Unix  
**TC-SYS-008**: Test getSystemInfo() returns all required fields  
**TC-SYS-009**: Test Linux package manager priority order  
**TC-SYS-010**: Test Windows package manager priority order

**Coverage Target:** 90%+ (cross-platform testing challenging)

---

### 3.5 version.js - Version Management

#### 3.5.1 Purpose

Provides semantic version parsing, comparison, and utilities for managing package versions throughout the workflow system.

#### 3.5.2 Functional Requirements

**FR-VER-001: Version Parsing** [REQUIRED]

- The module MUST provide `parseVersion(version)` function that:
  - Accepts version strings like: "1.2.3", "v1.2.3", "2.0.0-beta.1", "1.0.0+build.123"
  - Parses according to semantic versioning 2.0.0 specification
  - Returns object with: `{ major, minor, patch, prerelease, build }`
  - Removes leading 'v' if present
  - Handles partial versions (e.g., "1.2" → major=1, minor=2, patch=0)
  - Returns all zeros for null/undefined input
  - Throws Error for invalid format

**FR-VER-002: Version Comparison** [REQUIRED]

- The module MUST provide `compareVersions(v1, v2)` function that:
  - Returns -1 if v1 < v2
  - Returns 0 if v1 === v2
  - Returns 1 if v1 > v2
  - Compares major, minor, patch numerically
  - Handles prerelease versions (prerelease < release)
  - Compares prerelease strings lexicographically
  - Ignores build metadata in comparisons

**FR-VER-003: Comparison Helper Functions** [REQUIRED]

- The module MUST provide boolean comparison functions:
  - `isGreaterThan(v1, v2)`: Returns true if v1 > v2
  - `isLessThan(v1, v2)`: Returns true if v1 < v2
  - `isEqual(v1, v2)`: Returns true if v1 === v2

**FR-VER-004: Latest Version Selection** [REQUIRED]

- The module MUST provide `getLatestVersion(versions)` function that:
  - Accepts an array of version strings
  - Returns the highest version according to semver rules
  - Returns `null` for empty array or null input
  - Handles mixed version formats in array

**FR-VER-005: Semver Compliance** [REQUIRED]

- Version comparison MUST follow Semantic Versioning 2.0.0 specification:
  - Major version increments for incompatible changes
  - Minor version increments for backwards-compatible features
  - Patch version increments for backwards-compatible fixes
  - Prerelease versions have lower precedence than normal versions
  - Build metadata is ignored in precedence

#### 3.5.3 API Specification

```javascript
// Export: Parse version string
export function parseVersion(version: string): {
  major: number,
  minor: number,
  patch: number,
  prerelease: string,
  build: string,
}

// Export: Compare versions
export function compareVersions(version1: string, version2: string): number

// Export: Version comparison helpers
export function isGreaterThan(version1: string, version2: string): boolean
export function isLessThan(version1: string, version2: string): boolean
export function isEqual(version1: string, version2: string): boolean

// Export: Get latest version from array
export function getLatestVersion(versions: string[]): string | null
```

#### 3.5.4 Usage Examples

```javascript
import {
  parseVersion,
  compareVersions,
  isGreaterThan,
  isLessThan,
  isEqual,
  getLatestVersion,
} from './core/version.js';

// Parse version
const parsed = parseVersion('v1.2.3-beta.1+build.456');
console.log(parsed);
// { major: 1, minor: 2, patch: 3, prerelease: 'beta.1', build: 'build.456' }

// Compare versions
const result = compareVersions('2.0.0', '1.9.9');
console.log(result); // 1 (2.0.0 > 1.9.9)

// Use comparison helpers
if (isGreaterThan('2.1.0', '2.0.5')) {
  console.log('Newer version available');
}

// Get latest version
const versions = ['1.0.0', '1.2.0', '2.0.0-beta', '1.9.9'];
const latest = getLatestVersion(versions);
console.log(latest); // '1.9.9' (2.0.0-beta is prerelease)

// Handle prerelease versions
console.log(isLessThan('2.0.0-alpha', '2.0.0')); // true
console.log(compareVersions('1.0.0-alpha', '1.0.0-beta')); // -1 (alpha < beta)
```

#### 3.5.5 Error Conditions

**ERR-VER-001:** `parseVersion()` throws `Error` if:

- Version string doesn't match semver pattern
- Format is completely invalid (non-numeric major version, etc.)

#### 3.5.6 Dependencies

- **Node.js Built-in:** None
- **Internal:** None
- **External:** None (pure JavaScript implementation)

#### 3.5.7 Testing Requirements

**TC-VER-001**: Test parseVersion() with standard versions  
**TC-VER-002**: Test parseVersion() with prerelease versions  
**TC-VER-003**: Test parseVersion() with build metadata  
**TC-VER-004**: Test parseVersion() with partial versions  
**TC-VER-005**: Test parseVersion() with leading 'v'  
**TC-VER-006**: Test parseVersion() throws on invalid input  
**TC-VER-007**: Test compareVersions() with various version pairs  
**TC-VER-008**: Test prerelease comparison rules  
**TC-VER-009**: Test comparison helper functions  
**TC-VER-010**: Test getLatestVersion() with mixed versions  
**TC-VER-011**: Test getLatestVersion() with empty array  
**TC-VER-012**: Verify semver 2.0.0 compliance

**Coverage Target:** 100%

---

### 3.6 executor.js - Command Execution

#### 3.6.1 Purpose

Provides safe, promise-based command execution with support for both async/await and streaming output patterns, essential for package manager operations and system commands.

#### 3.6.2 Functional Requirements

**FR-EXEC-001: Async Command Execution** [REQUIRED]

- The module MUST provide `execute(command, options)` async function that:
  - Executes shell commands asynchronously
  - Returns promise resolving to `{ stdout, stderr, exitCode }`
  - Captures complete stdout and stderr
  - Trims whitespace from output
  - Uses default timeout of 5 minutes (300,000ms)
  - Throws `ExecutionError` on failure

**FR-EXEC-002: Execution Options** [REQUIRED]

- The `execute()` function MUST support options:
  - `cwd`: Working directory (default: `process.cwd()`)
  - `env`: Environment variables (default: `process.env`)
  - `timeout`: Maximum execution time in ms (default: 300000)
  - `shell`: Whether to run in shell (default: true)
- Options MUST have sensible defaults for all fields

**FR-EXEC-003: Output Buffer Limit** [REQUIRED]

- The module MUST set `maxBuffer` to 10MB for command output
- This prevents memory issues with verbose commands
- Commands exceeding buffer MUST fail with error

**FR-EXEC-004: Streaming Command Execution** [REQUIRED]

- The module MUST provide `executeStream(command, options)` function that:
  - Executes commands with real-time output
  - Streams stdout and stderr as they are produced
  - Supports custom output handlers via `onStdout` and `onStderr` callbacks
  - Returns promise resolving to exit code
  - Defaults to piping output to process stdout/stderr

**FR-EXEC-005: Streaming Options** [REQUIRED]

- The `executeStream()` function MUST support options:
  - `cwd`: Working directory
  - `env`: Environment variables
  - `onStdout`: Callback for stdout data (optional)
  - `onStderr`: Callback for stderr data (optional)

**FR-EXEC-006: Sudo Execution** [REQUIRED]

- The module MUST provide `executeSudo(command, options)` function that:
  - Automatically prepends `sudo` on Unix systems when not running as root
  - Checks if running as root using `process.getuid() === 0`
  - Does NOT use sudo on Windows
  - Does NOT use sudo if already root
  - Accepts same options as `execute()`

**FR-EXEC-007: Error Handling** [REQUIRED]

- All execution functions MUST throw `ExecutionError` on failure
- `ExecutionError` MUST include:
  - Error message with command name
  - Exit code
  - Captured stdout
  - Captured stderr
- Errors MUST be thrown for non-zero exit codes

**FR-EXEC-008: Process Management** [REQUIRED]

- Spawned processes MUST properly inherit stdin, stdout, stderr
- Process cleanup MUST occur on both success and failure
- Child process errors MUST be caught and wrapped in `ExecutionError`

#### 3.6.3 API Specification

```javascript
// Export: Execute command asynchronously
export async function execute(
  command: string,
  options?: {
    cwd?: string,
    env?: object,
    timeout?: number,
    shell?: boolean,
  }
): Promise<{
  stdout: string,
  stderr: string,
  exitCode: number,
}>

// Export: Execute command with streaming output
export function executeStream(
  command: string,
  options?: {
    cwd?: string,
    env?: object,
    onStdout?: (data: string) => void,
    onStderr?: (data: string) => void,
  }
): Promise<number>

// Export: Execute command with sudo
export async function executeSudo(
  command: string,
  options?: {
    cwd?: string,
    env?: object,
    timeout?: number,
    shell?: boolean,
  }
): Promise<{
  stdout: string,
  stderr: string,
  exitCode: number,
}>
```

#### 3.6.4 Usage Examples

```javascript
import { execute, executeStream, executeSudo } from './core/executor.js';

// Simple async execution
try {
  const result = await execute('ls -la');
  console.log(result.stdout);
} catch (error) {
  console.error(`Command failed: ${error.message}`);
  console.error(`Exit code: ${error.exitCode}`);
  console.error(`Error output: ${error.stderr}`);
}

// Execution with options
const result = await execute('npm install', {
  cwd: '/path/to/project',
  timeout: 600000, // 10 minutes
});

// Streaming execution with progress
await executeStream('apt-get update', {
  onStdout: (data) => {
    process.stdout.write(data); // Real-time output
  },
  onStderr: (data) => {
    process.stderr.write(data);
  },
});

// Execute with sudo
const result = await executeSudo('apt-get install nodejs', {
  timeout: 600000,
});

// Execute without sudo if already root
// (executeSudo automatically detects and skips sudo)
const result = await executeSudo('systemctl restart nginx');
```

#### 3.6.5 Error Conditions

**ERR-EXEC-001:** `execute()` throws `ExecutionError` if:

- Command returns non-zero exit code
- Command times out
- Command fails to spawn
- Output exceeds buffer limit (10MB)

**ERR-EXEC-002:** `executeStream()` throws `ExecutionError` if:

- Command returns non-zero exit code
- Command fails to spawn
- Process encounters fatal error

**ERR-EXEC-003:** `executeSudo()` throws `ExecutionError` with same conditions as `execute()`

#### 3.6.6 Dependencies

- **Node.js Built-in:** `child_process` (exec, spawn), `util` (promisify)
- **Internal:** `utils/errors.js` (ExecutionError)
- **External:** None

#### 3.6.7 Testing Requirements

**TC-EXEC-001**: Test execute() with successful command  
**TC-EXEC-002**: Test execute() with failing command  
**TC-EXEC-003**: Test execute() captures stdout and stderr  
**TC-EXEC-004**: Test execute() respects timeout  
**TC-EXEC-005**: Test execute() respects cwd option  
**TC-EXEC-006**: Test executeStream() with real-time output  
**TC-EXEC-007**: Test executeStream() with custom callbacks  
**TC-EXEC-008**: Test executeStream() with failing command  
**TC-EXEC-009**: Test executeSudo() adds sudo on Unix  
**TC-EXEC-010**: Test executeSudo() skips sudo when root  
**TC-EXEC-011**: Test executeSudo() skips sudo on Windows  
**TC-EXEC-012**: Test error includes exitCode, stdout, stderr

**Coverage Target:** 85%+ (process testing has inherent limitations)

---

### 3.7 index.js - Module Exports

#### 3.7.1 Purpose

Provides a single entry point for importing core functionality, establishing the public API surface of the foundation layer.

#### 3.7.2 Functional Requirements

**FR-INDEX-001: Public API Exports** [REQUIRED]

- The module MUST re-export all public APIs from core modules:
  - From `core/colors.js`: colors, colorize, supportsColor
  - From `core/logger.js`: Logger, logger, LogLevel
  - From `core/executor.js`: execute, executeStream, executeSudo
  - From `core/system.js`: OS, PackageManager, detectOS, detectPackageManager, commandExists, getSystemInfo
  - From `core/version.js`: parseVersion, compareVersions, isGreaterThan, isLessThan, isEqual, getLatestVersion
  - From `utils/errors.js`: WorkflowError, SystemError, ExecutionError, ConfigurationError, ValidationError

**FR-INDEX-002: Named Exports Only** [REQUIRED]

- The module MUST use named exports only (no default export)
- This promotes explicit imports and better tree-shaking

**FR-INDEX-003: API Stability** [REQUIRED]

- The exported API MUST remain stable across minor versions
- Breaking changes MUST only occur in major versions
- New exports MAY be added in minor versions

**FR-INDEX-004: No Side Effects** [REQUIRED]

- The module MUST NOT execute code on import
- It MUST only define exports (pure module)

#### 3.7.3 API Specification

```javascript
// Colors
export { colors, colorize, supportsColor } from './core/colors.js';

// Logger
export { Logger, logger, LogLevel } from './core/logger.js';

// Executor
export { execute, executeStream, executeSudo } from './core/executor.js';

// System
export {
  OS,
  PackageManager,
  detectOS,
  detectPackageManager,
  commandExists,
  getSystemInfo,
} from './core/system.js';

// Version
export {
  parseVersion,
  compareVersions,
  isGreaterThan,
  isLessThan,
  isEqual,
  getLatestVersion,
} from './core/version.js';

// Errors
export {
  WorkflowError,
  SystemError,
  ExecutionError,
  ConfigurationError,
  ValidationError,
} from './utils/errors.js';
```

#### 3.7.4 Usage Examples

```javascript
// Import everything needed in one statement
import { logger, execute, detectOS, OS, parseVersion, SystemError } from './index.js';

// Or import from top-level package
import { logger, execute } from 'ai-workflow';

// Use imported functionality
const os = detectOS();
if (os === OS.LINUX) {
  logger.info('Running on Linux');
  const result = await execute('uname -r');
  logger.success(`Kernel: ${result.stdout}`);
}
```

#### 3.7.5 Error Conditions

- None. Module only defines exports.

#### 3.7.6 Dependencies

- **Node.js Built-in:** None
- **Internal:** All core and utils modules
- **External:** None

#### 3.7.7 Testing Requirements

**TC-INDEX-001**: Verify all exports are available  
**TC-INDEX-002**: Test imports work from index.js  
**TC-INDEX-003**: Verify no default export exists  
**TC-INDEX-004**: Test tree-shaking works correctly  
**TC-INDEX-005**: Verify no side effects on import

**Coverage Target:** 100%

---

## 4. Integration Requirements

### 4.1 Module Interaction Patterns

**INT-001: Error Propagation** [REQUIRED]

- All modules MUST use custom error classes from `utils/errors.js`
- Errors MUST NOT be caught and converted to generic Error
- Error messages MUST be descriptive and include context
- Stack traces MUST be preserved

**INT-002: Logging Integration** [REQUIRED]

- Modules that perform I/O operations SHOULD accept a logger instance
- If no logger provided, operations SHOULD use the default logger
- Log levels MUST be used appropriately:
  - DEBUG: Internal state, detailed flow
  - INFO: Major operations, user-facing progress
  - SUCCESS: Operation completion
  - WARN: Recoverable issues, deprecations
  - ERROR: Failures, but do not throw (log only)

**INT-003: System Detection Integration** [REQUIRED]

- Package manager implementations MUST use `system.js` for OS detection
- Command execution MUST verify commands exist via `commandExists()`
- Platform-specific logic MUST use OS constants, not string literals

**INT-004: Version Comparison Integration** [REQUIRED]

- Package managers MUST use `version.js` for version comparisons
- Version parsing errors MUST be caught and handled appropriately
- Latest version selection MUST use `getLatestVersion()`

**INT-005: Command Execution Integration** [REQUIRED]

- All system commands MUST use `executor.js` functions
- Direct use of `child_process` is NOT ALLOWED outside executor.js
- Long-running commands SHOULD use `executeStream()`
- Privileged operations MUST use `executeSudo()`

### 4.2 Cross-Module Dependencies

```
logger.js → colors.js
executor.js → errors.js
system.js → errors.js
All modules → Can use logger.js (optional)
```

### 4.3 Initialization Order

No specific initialization required. All modules are stateless except for the default logger instance, which is created on module load.

---

## 5. Quality Requirements

### 5.1 Performance Requirements

**PERF-001: Command Execution** [REQUIRED]

- Command execution overhead MUST be < 50ms
- Output buffering MUST handle up to 10MB without performance degradation
- Version comparison MUST complete in < 1ms for typical versions

**PERF-002: System Detection** [REQUIRED]

- OS detection MUST complete in < 10ms
- Package manager detection MUST complete in < 500ms
- `commandExists()` MUST complete in < 100ms per command

**PERF-003: Logging** [REQUIRED]

- Logging operations MUST NOT block execution
- Logger instantiation MUST be < 1ms
- Message formatting MUST be < 5ms

### 5.2 Cross-Platform Compatibility

**COMPAT-001: Operating Systems** [REQUIRED]

- All modules MUST work on:
  - Linux (Ubuntu 20.04+, Debian 11+, Fedora 35+, Arch Linux)
  - macOS (12+)
  - Windows (10, 11) with Node.js installed

**COMPAT-002: Node.js Versions** [REQUIRED]

- All modules MUST support Node.js 18.x LTS and higher
- ES Module syntax MUST be used exclusively
- No deprecated Node.js APIs MUST be used

**COMPAT-003: Terminal Support** [REQUIRED]

- Color support MUST be detected automatically
- Graceful degradation MUST occur when colors not supported
- Unicode symbols (✓, ✗, ⚠) MUST fall back on non-UTF8 terminals

### 5.3 Code Quality

**QUALITY-001: Linting** [REQUIRED]

- All code MUST pass ESLint with zero errors
- Code MUST be formatted with Prettier
- No console.log allowed in production code (use logger)

**QUALITY-002: Code Coverage** [REQUIRED]

- Overall test coverage MUST be ≥ 85%
- Critical modules (executor, system) MUST have ≥ 90% coverage
- Pure utility modules (colors, version) MUST have 100% coverage

**QUALITY-003: Documentation** [REQUIRED]

- All exported functions MUST have JSDoc comments
- Parameters and return values MUST be documented
- Error conditions MUST be documented
- Usage examples SHOULD be provided for complex APIs

### 5.4 Security Requirements

**SEC-001: Command Injection** [REQUIRED]

- All command execution MUST use shell escaping when needed
- User input MUST NOT be directly interpolated into commands
- Commands MUST be validated before execution

**SEC-002: Privilege Escalation** [REQUIRED]

- `executeSudo()` MUST only be used when necessary
- Sudo prompts MUST be visible to users
- Operations SHOULD work without sudo when possible

**SEC-003: Error Information Disclosure** [REQUIRED]

- Error messages MUST NOT leak sensitive information
- File paths in errors SHOULD be relative when possible
- Environment variables MUST NOT be logged by default

---

## 6. Testing Strategy

### 6.1 Unit Testing

**TEST-001: Test Coverage** [REQUIRED]

- Each module MUST have corresponding test file in `test/` directory
- Test file naming: `<module>.test.js`
- All exported functions MUST have tests
- Internal functions SHOULD be tested via public API

**TEST-002: Test Structure** [REQUIRED]

- Tests MUST use Jest framework
- Tests MUST be organized with `describe()` and `it()` blocks
- Test names MUST clearly describe what is being tested

**TEST-003: Mock Strategy** [OPTIONAL]

- System calls MAY be mocked for deterministic tests
- File system operations SHOULD be mocked
- Network operations MUST be mocked

### 6.2 Integration Testing

**TEST-004: Module Integration** [RECOMMENDED]

- Integration tests SHOULD verify module interactions
- Tests SHOULD verify error propagation between modules
- Tests SHOULD verify logging integration

### 6.3 Cross-Platform Testing

**TEST-005: Platform-Specific Tests** [RECOMMENDED]

- System detection tests SHOULD run on all target platforms
- Command execution tests SHOULD verify platform-specific behavior
- Path handling tests MUST verify Windows and Unix paths

### 6.4 Test Requirements by Module

| Module      | Min Coverage | Critical Tests                          |
| ----------- | ------------ | --------------------------------------- |
| colors.js   | 100%         | Color codes, terminal detection         |
| logger.js   | 95%          | All log levels, quiet/verbose modes     |
| errors.js   | 100%         | Error hierarchy, properties             |
| system.js   | 90%          | OS detection, package manager detection |
| version.js  | 100%         | Parsing, comparison, semver compliance  |
| executor.js | 85%          | Execute, executeStream, error handling  |
| index.js    | 100%         | All exports available                   |

---

## 7. Future Considerations

### 7.1 Planned Enhancements

**FUT-001: Enhanced Logging** [OPTIONAL]

- Log file output support
- Structured logging (JSON format)
- Log levels from environment variables
- Custom log transports

**FUT-002: Performance Monitoring** [OPTIONAL]

- Execution time tracking
- Performance metrics collection
- Bottleneck identification

**FUT-003: Advanced Version Management** [OPTIONAL]

- Version range parsing (^1.0.0, ~2.1.3)
- Version constraint satisfaction
- NPM-style version resolution

**FUT-004: Colored Output Styles** [OPTIONAL]

- RGB color support (24-bit)
- Named color schemes
- Theme support

### 7.2 Extensibility Points

**EXT-001: Logger Backends** [OPTIONAL]

- Abstract logger interface
- Pluggable log transports
- Custom formatters

**EXT-002: Executor Plugins** [OPTIONAL]

- Pre-execution hooks
- Post-execution hooks
- Command transformation

**EXT-003: System Detection Plugins** [OPTIONAL]

- Custom package manager detection
- Distribution-specific logic
- Container detection

### 7.3 Migration Considerations

**MIG-001: Backwards Compatibility**

- Semantic versioning MUST be followed
- Deprecation warnings MUST precede removal by one major version
- Breaking changes MUST be documented in CHANGELOG

**MIG-002: API Evolution**

- New parameters SHOULD be optional with defaults
- New functions MAY be added in minor versions
- Existing function signatures SHOULD NOT change in minor versions

---

## Appendices

### Appendix A: Glossary

- **ANSI**: American National Standards Institute, creator of terminal escape code standards
- **ES Modules**: ECMAScript modules, the standard JavaScript module system
- **Semver**: Semantic Versioning, a versioning scheme (major.minor.patch)
- **TTY**: Teletypewriter, a terminal interface type
- **stdout**: Standard output stream
- **stderr**: Standard error stream
- **Package Manager**: System software for installing/managing packages (apt, brew, etc.)

### Appendix B: References

1. **Semantic Versioning 2.0.0**: https://semver.org/
2. **RFC 2119 - Key words for RFCs**: https://www.rfc-editor.org/rfc/rfc2119
3. **ANSI Escape Codes**: https://en.wikipedia.org/wiki/ANSI_escape_code
4. **Node.js Documentation**: https://nodejs.org/docs/
5. **Original ai_workflow**: https://github.com/mpbarbosa/ai_workflow
6. **NO_COLOR Standard**: https://no-color.org/

### Appendix C: Change Log

| Version | Date       | Changes                                  |
| ------- | ---------- | ---------------------------------------- |
| 1.0.0   | 2026-01-29 | Initial functional requirements document |

---

**Document Status:** ✅ Complete and Active  
**Last Review:** January 29, 2026  
**Next Review:** Phase 2 completion or as requirements evolve  
**Maintained By:** ai_workflow.js development team
