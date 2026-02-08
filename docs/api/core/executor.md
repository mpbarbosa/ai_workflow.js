# executor - Command Execution Module

**Module:** `core/executor`  
**Version:** 1.0.0  
**Type:** Async Functions

## Overview

Shell command execution with output capture, streaming support, and sudo handling. Wraps Node.js `child_process` with Promise-based API.

---

## Functions

### `execute(command, options?)`

Execute command and return output.

**Parameters:**

- `command` (string) - Shell command
- `options` (object) - Optional config:
  - `cwd`: Working directory
  - `env`: Environment variables
  - `timeout`: Max execution time (default: 300000ms)
  - `shell`: Use shell (default: true)

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

```javascript
import { ExecutionError } from '../utils/errors.js';

try {
  await execute('invalid-command');
} catch (error) {
  if (error instanceof ExecutionError) {
    console.log('Exit code:', error.exitCode);
    console.log('Stderr:', error.stderr);
  }
}
```

---

## Configuration

### Buffer Size

Default: 10MB max buffer. Increase for large output:

```javascript
// Note: Modify in module if needed
const { stdout } = await execute('command-with-large-output');
```

### Timeout

Default: 5 minutes. Adjust per command:

```javascript
await execute('slow-command', { timeout: 600000 }); // 10 min
```

---

## Related Modules

- **[system](./system.md)** - Platform detection for cross-platform commands
- **[errors](./errors.md)** - `ExecutionError` class

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

**Last Updated:** 2026-02-01  
**Part of:** AI Workflow Automation v1.0.0
