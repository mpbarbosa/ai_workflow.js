# Error Codes Reference

**AI Workflow Automation v1.9.1**
**Last Updated:** 2026-03-12
**Audience:** Developers, Support Engineers

---

## Table of Contents

- [Overview](#overview)
- [Error Code Format](#error-code-format)
- [Error Categories](#error-categories)
- [Validation Errors (1000-1999)](#validation-errors-1000-1999)
- [Configuration Errors (2000-2999)](#configuration-errors-2000-2999)
- [Execution Errors (3000-3999)](#execution-errors-3000-3999)
- [File Operation Errors (4000-4999)](#file-operation-errors-4000-4999)
- [System Errors (5000-5999)](#system-errors-5000-5999)
- [Network Errors (6000-6999)](#network-errors-6000-6999)
- [Handling Errors](#handling-errors)

---

## Overview

AI Workflow Automation uses structured error codes to categorize and identify errors. Each error code is unique and provides context for debugging and user support.

### Error Code Structure

```
ERROR-XXXX: Error Message

Where:
  ERROR  = Error category abbreviation
  XXXX   = Unique 4-digit code
  Message = Human-readable description
```

---

## Error Code Format

### Standard Format

All errors follow this structure:

```javascript
{
  code: 'VAL-1001',              // Unique error code
  message: 'Project name is required',  // Human-readable message
  category: 'VALIDATION',        // Error category
  severity: 'ERROR',             // Severity level
  details: {                     // Additional context
    field: 'project.name',
    value: null
  }
}
```

### Severity Levels

| Level      | Description                          | Action Required              |
| ---------- | ------------------------------------ | ---------------------------- |
| `CRITICAL` | System failure, cannot continue      | Immediate attention required |
| `ERROR`    | Operation failed, user action needed | Fix and retry                |
| `WARNING`  | Potential issue, operation continues | Review and address           |
| `INFO`     | Informational, no action needed      | Log for reference            |

---

## Error Categories

| Category        | Code Prefix | Range     | Description                  |
| --------------- | ----------- | --------- | ---------------------------- |
| Validation      | `VAL`       | 1000-1999 | Input validation failures    |
| Configuration   | `CFG`       | 2000-2999 | Configuration errors         |
| Execution       | `EXE`       | 3000-3999 | Command execution failures   |
| File Operations | `FILE`      | 4000-4999 | File I/O errors              |
| System          | `SYS`       | 5000-5999 | System-level errors          |
| Network         | `NET`       | 6000-6999 | Network communication errors |

---

## Validation Errors (1000-1999)

### VAL-1001: Missing Required Field

**Message:** Required field is missing

**Cause:** A required configuration field is not provided

**Example:**

```javascript
throw new ValidationError('Project name is required', {
  code: 'VAL-1001',
  field: 'project.name',
  value: null,
});
```

**Resolution:**

- Add the missing field to `.workflow-config.yaml`
- Ensure all required fields are populated

### VAL-1002: Invalid Field Type

**Message:** Field has invalid type

**Cause:** Field value is not the expected type

**Example:**

```javascript
// Expected: string
// Received: number
{
  code: 'VAL-1002',
  field: 'project.name',
  expected: 'string',
  received: 'number'
}
```

**Resolution:**

- Check field type in configuration schema
- Convert value to correct type

### VAL-1003: Invalid Field Value

**Message:** Field value is not valid

**Cause:** Field value doesn't meet validation rules

**Example:**

```javascript
{
  code: 'VAL-1003',
  field: 'project.version',
  value: 'invalid',
  expected: 'semver format (e.g., 1.0.0)'
}
```

**Resolution:**

- Check allowed values for field
- Update value to match validation rules

### VAL-1004: Invalid Project Kind

**Message:** Unknown project kind

**Cause:** Project kind is not recognized

**Example:**

```javascript
{
  code: 'VAL-1004',
  field: 'project.kind',
  value: 'unknown_type',
  allowed: ['nodejs_api', 'react_spa', 'python_app', '...']
}
```

**Resolution:**

- Use a valid project kind from the list
- See [Configuration Guide](../guides/CONFIGURATION_GUIDE.md)

### VAL-1005: Invalid Coverage Threshold

**Message:** Coverage threshold out of range

**Cause:** Coverage threshold must be 0-100

**Example:**

```javascript
{
  code: 'VAL-1005',
  field: 'tech_stack.coverage_threshold',
  value: 150,
  min: 0,
  max: 100
}
```

**Resolution:**

- Set coverage threshold between 0 and 100

---

## Configuration Errors (2000-2999)

### CFG-2001: Configuration File Not Found

**Message:** Configuration file does not exist

**Cause:** `.workflow-config.yaml` not found

**Example:**

```javascript
{
  code: 'CFG-2001',
  path: '/project/.workflow-config.yaml',
  searched: [
    '/project/.workflow-config.yaml',
    '/project/.workflow-config.yml'
  ]
}
```

**Resolution:**

- Create `.workflow-config.yaml` in project root
- Copy from `.workflow_core/config/.workflow-config.yaml.template`

### CFG-2002: Invalid YAML Syntax

**Message:** Configuration file has invalid YAML syntax

**Cause:** YAML parsing failed

**Example:**

```javascript
{
  code: 'CFG-2002',
  path: '/project/.workflow-config.yaml',
  line: 15,
  column: 8,
  message: 'Unexpected token'
}
```

**Resolution:**

- Validate YAML syntax: `npx js-yaml .workflow-config.yaml`
- Check indentation (use 2 spaces)
- Quote strings containing special characters

### CFG-2003: Missing Configuration Section

**Message:** Required configuration section is missing

**Cause:** Major configuration section not found

**Example:**

```javascript
{
  code: 'CFG-2003',
  section: 'tech_stack',
  required: ['project', 'tech_stack', 'structure']
}
```

**Resolution:**

- Add missing section to configuration
- See configuration template for required sections

### CFG-2004: Invalid Configuration Schema

**Message:** Configuration does not match schema

**Cause:** Configuration structure is invalid

**Example:**

```javascript
{
  code: 'CFG-2004',
  errors: [
    'project.name: must be string',
    'tech_stack.test_command: must be string'
  ]
}
```

**Resolution:**

- Review configuration schema
- Fix structural errors

---

## Execution Errors (3000-3999)

### EXE-3001: Command Not Found

**Message:** Command executable not found

**Cause:** Command doesn't exist or not in PATH

**Example:**

```javascript
{
  code: 'EXE-3001',
  command: 'unknown-command',
  path: process.env.PATH
}
```

**Resolution:**

- Install required command
- Verify command is in PATH
- Check spelling of command name

### EXE-3002: Command Execution Failed

**Message:** Command exited with non-zero status

**Cause:** Command failed during execution

**Example:**

```javascript
{
  code: 'EXE-3002',
  command: 'npm test',
  exitCode: 1,
  stdout: '...',
  stderr: 'Test failed...'
}
```

**Resolution:**

- Review command output (stderr)
- Fix underlying issue causing failure
- Run command manually to debug

### EXE-3003: Command Timeout

**Message:** Command exceeded timeout limit

**Cause:** Command didn't complete within timeout

**Example:**

```javascript
{
  code: 'EXE-3003',
  command: 'npm test',
  timeout: 30000,
  elapsed: 35000
}
```

**Resolution:**

- Increase timeout in configuration
- Optimize command performance
- Check for hung processes

### EXE-3004: Permission Denied

**Message:** Insufficient permissions to execute command

**Cause:** User lacks execution permissions

**Example:**

```javascript
{
  code: 'EXE-3004',
  command: './script.sh',
  permissions: 'rw-r--r--'
}
```

**Resolution:**

- Add execute permission: `chmod +x script.sh`
- Run with appropriate user/sudo

---

## File Operation Errors (4000-4999)

### FILE-4001: File Not Found

**Message:** File does not exist

**Cause:** Attempting to read non-existent file

**Example:**

```javascript
{
  code: 'FILE-4001',
  path: '/project/config.yaml',
  operation: 'read'
}
```

**Resolution:**

- Verify file path is correct
- Check file exists: `ls -la /project/config.yaml`
- Create file if needed

### FILE-4002: Permission Denied

**Message:** Insufficient permissions for file operation

**Cause:** User lacks read/write permissions

**Example:**

```javascript
{
  code: 'FILE-4002',
  path: '/project/output.txt',
  operation: 'write',
  permissions: 'r--r--r--'
}
```

**Resolution:**

- Change file permissions: `chmod 644 file.txt`
- Run with appropriate user

### FILE-4003: Directory Not Found

**Message:** Directory does not exist

**Cause:** Parent directory missing

**Example:**

```javascript
{
  code: 'FILE-4003',
  path: '/project/logs/workflow.log',
  operation: 'write',
  missingDir: '/project/logs'
}
```

**Resolution:**

- Create directory: `mkdir -p /project/logs`
- Enable recursive directory creation

### FILE-4004: Disk Space Full

**Message:** No space left on device

**Cause:** Insufficient disk space

**Example:**

```javascript
{
  code: 'FILE-4004',
  path: '/project/output.txt',
  required: 10485760,  // 10MB
  available: 1048576   // 1MB
}
```

**Resolution:**

- Free up disk space
- Clean up old logs/artifacts
- Check disk usage: `df -h`

### FILE-4005: File Too Large

**Message:** File exceeds maximum size limit

**Cause:** File larger than configured limit

**Example:**

```javascript
{
  code: 'FILE-4005',
  path: '/project/large-file.txt',
  size: 104857600,      // 100MB
  maxSize: 10485760     // 10MB
}
```

**Resolution:**

- Increase max file size in configuration
- Split file into smaller chunks
- Process file in streaming mode

---

## System Errors (5000-5999)

### SYS-5001: Out of Memory

**Message:** System out of memory

**Cause:** Process exceeded memory limit

**Example:**

```javascript
{
  code: 'SYS-5001',
  used: 2147483648,     // 2GB
  limit: 2147483648,    // 2GB
  available: 0
}
```

**Resolution:**

- Increase Node.js memory: `NODE_OPTIONS=--max-old-space-size=4096`
- Optimize memory usage
- Process data in chunks

### SYS-5002: Unsupported Platform

**Message:** Operating system not supported

**Cause:** Running on unsupported OS

**Example:**

```javascript
{
  code: 'SYS-5002',
  platform: 'sunos',
  supported: ['linux', 'darwin', 'win32']
}
```

**Resolution:**

- Use supported operating system
- Contribute platform support

### SYS-5003: Missing Dependency

**Message:** Required system dependency missing

**Cause:** System tool not installed

**Example:**

```javascript
{
  code: 'SYS-5003',
  dependency: 'git',
  required: '>= 2.0.0',
  found: null
}
```

**Resolution:**

- Install missing dependency
- Verify version requirements

---

## Network Errors (6000-6999)

### NET-6001: Connection Failed

**Message:** Network connection failed

**Cause:** Cannot connect to remote server

**Example:**

```javascript
{
  code: 'NET-6001',
  url: 'https://api.example.com',
  error: 'ECONNREFUSED'
}
```

**Resolution:**

- Check internet connection
- Verify server is accessible
- Check firewall settings

### NET-6002: Request Timeout

**Message:** Network request timed out

**Cause:** Request didn't complete in time

**Example:**

```javascript
{
  code: 'NET-6002',
  url: 'https://api.example.com',
  timeout: 30000,
  elapsed: 35000
}
```

**Resolution:**

- Increase timeout
- Check network speed
- Retry request

---

## Handling Errors

### Error Handling Pattern

```javascript
import { ValidationError, ConfigurationError, ExecutionError } from './core/errors.js';

try {
  // Operation
  await performOperation();
} catch (error) {
  if (error instanceof ValidationError) {
    console.error(`Validation failed: ${error.message}`);
    console.error(`Code: ${error.code}`);
    console.error(`Details:`, error.details);
  } else if (error instanceof ExecutionError) {
    console.error(`Execution failed: ${error.message}`);
    console.error(`Exit code: ${error.details.exitCode}`);
    console.error(`Stderr: ${error.details.stderr}`);
  } else {
    console.error(`Unexpected error: ${error.message}`);
  }

  process.exit(1);
}
```

### Error Recovery

```javascript
async function retryOnError(fn, maxRetries = 3) {
  let lastError;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Retry on transient errors
      if (error.code === 'NET-6002' || error.code === 'SYS-5001') {
        await delay(1000 * (i + 1)); // Exponential backoff
        continue;
      }

      // Don't retry on permanent errors
      throw error;
    }
  }

  throw lastError;
}
```

---

## Additional Resources

- **[Developer Guide](../guides/DEVELOPER_GUIDE.md)** - Error handling patterns
- **[API Documentation](../api/utils/errors.md)** - Error classes reference
- **[Troubleshooting](../guides/USER_GUIDE.md#troubleshooting)** - Common issues

---

**Last Updated:** 2026-03-12
**Version:** 1.9.1
