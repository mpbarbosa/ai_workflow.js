# executor - Command Execution Module

**Module:** `core/executor`
**Version:** 0.5.10 (via [`olinda_shell_interface.js`](https://github.com/mpbarbosa/olinda_shell_interface.js))
**Type:** Async Functions

> **Note:** This module re-exports from the [`olinda_shell_interface.js`](https://github.com/mpbarbosa/olinda_shell_interface.js) package (installed from GitHub). The implementation lives upstream; this file is a thin re-export layer.

## Overview

Shell command execution with output capture, streaming support, and sudo handling. Wraps Node.js `child_process` with a Promise-based API.

---

## Functions

### `execute(command, options?)`

Execute command and return output.

**Parameters:**

- `command` (string) - Shell command
- `options` (object) - Optional config:
  - `cwd`: Working directory (default: `process.cwd()`)
  - `env`: Environment variables (default: `process.env`)
  - `timeout`: Max execution time in ms (default: `300_000`)
  - `shell`: Shell path or `true` to use `/bin/sh` (default: `'/bin/sh'`)
  - `maxBuffer`: Max output buffer in bytes (default: `10_485_760` — 10 MB)

**Returns:** Promise<`{stdout, stderr, exitCode}`>

**Throws:** `ExecutionError` on failure

**Example:**

```javascript
import { execute } from './core/executor.js';

try {
  const result = await execute('ls -la', { cwd: '/tmp' });
  console.log(result.stdout);
} catch (error) {
  console.error(`Command failed: ${error.message}`);
  console.error(`Exit code: ${error.exitCode}`);
}
```

---

### `executeStream(command, options?)`

Execute with streaming output.

**Parameters:**

- `command` (string)
- `options` (object):
  - `cwd`: Working directory
  - `env`: Environment variables
  - `onStdout`: Callback for stdout data
  - `onStderr`: Callback for stderr data

**Returns:** Promise<`number`> - Exit code

**Example:**

```javascript
import { executeStream } from './core/executor.js';

await executeStream('npm test', {
  onStdout: (data) => console.log(data),
  onStderr: (data) => console.error(data),
});
```

---

### `executeSudo(command, options?)`

Execute command with sudo if needed.

**Example:**

```javascript
import { executeSudo } from './core/executor.js';

// Automatically adds sudo on Unix if not root
await executeSudo('apt-get update');
```

---

## Usage Examples

### Basic Command Execution

```javascript
import { execute } from './core/executor.js';

const result = await execute('git status');
console.log(result.stdout);
```

### With Timeout

```javascript
try {
  await execute('long-running-command', { timeout: 30000 });
} catch (error) {
  if (error.code === 'ETIMEDOUT') {
    console.error('Command timed out');
  }
}
```

### Streaming Long Output

```javascript
import { executeStream } from './core/executor.js';

await executeStream('npm install', {
  onStdout: (data) => process.stdout.write(data),
  onStderr: (data) => process.stderr.write(data),
});
```

### Platform-Specific Commands

```javascript
import { execute } from './core/executor.js';
import { detectOS, OS } from './core/system.js';

const os = detectOS();
const command = os === OS.WINDOWS ? 'dir' : 'ls -la';
const result = await execute(command);
```

---

## Error Handling

Commands throw `ExecutionError` with:

- `message`: Error description
- `exitCode`: Process exit code
- `stdout`: Standard output
- `stderr`: Standard error
- `signal`: Signal name that terminated the process (`string`), or `null` if exited normally
- `killed`: `true` if the process was killed by a signal (e.g. on timeout)

```javascript
import { ExecutionError } from '../utils/errors.js';

try {
  await execute('invalid-command');
} catch (error) {
  if (error instanceof ExecutionError) {
    console.log('Exit code:', error.exitCode);
    console.log('Stderr:', error.stderr);
    if (error.killed) {
      console.log('Killed by signal:', error.signal);
    }
  }
}
```

---

## Configuration

### Buffer Size

Default: 10 MB max buffer. Override per-call:

```javascript
const { stdout } = await execute('command-with-large-output', { maxBuffer: 50 * 1024 * 1024 });
```

### Timeout

Default: 5 minutes. Adjust per command:

```javascript
await execute('slow-command', { timeout: 600000 }); // 10 min
```

---

## Related Modules

- **[system](./system.md)** - Platform detection for cross-platform commands
- **[errors](../utils/errors.md)** - `ExecutionError` class

---

## Best Practices

1. **Always handle errors:**

   ```javascript
   try {
     await execute(cmd);
   } catch (error) {
     logger.error(`Failed: ${error.message}`);
   }
   ```

2. **Use streaming for long output:**

   ```javascript
   // ✅ Good for large output
   await executeStream('npm test');

   // ❌ May buffer too much
   await execute('npm test');
   ```

3. **Set appropriate timeouts:**
   ```javascript
   await execute('quick-command', { timeout: 10000 });
   await execute('build-project', { timeout: 600000 });
   ```

---

**Last Updated:** 2026-03-11
**Source package:** [`olinda_shell_interface.js` v0.5.10](https://github.com/mpbarbosa/olinda_shell_interface.js)
**Part of:** AI Workflow Automation v1.9.10
