# session_manager - Session Management Module

**Module:** `lib/session_manager`  
**Version:** 2.0.0  
**Type:** Pure Functions + Wrapper

## Overview

Pure functional session management with referential transparency. Tracks session lifecycle without side effects in core logic.

---

## Pure Functions

### `generateSessionId(stepNum, operation, timestamp, randomBytes)`

Generate unique session ID.

**Parameters:**

- `stepNum` (number) - Step number
- `operation` (string) - Operation name
- `timestamp` (number) - Current time (ms)
- `randomBytes` (Buffer) - Random bytes for uniqueness

**Returns:** string - Format: `step{NN}_{operation}_{timestamp}_{random}`

**Example:**

```javascript
const sessionId = generateSessionId(5, 'test', Date.now(), crypto.randomBytes(4));
// 'step05_test_20260115143000_a1b2c3d4'
```

### `createSessionEntry(sessionId, description, startTime)`

Create session metadata object.

### `registerSession(sessions, sessionId, sessionEntry)`

Register session in map (pure - returns new map).

### `unregisterSession(sessions, sessionId)`

Remove session from map (pure - returns new map).

### `addToCleanupQueue(queue, sessionId)`

Add to cleanup queue (pure - returns new array).

### `removeFromCleanupQueue(queue, sessionId)`

Remove from cleanup queue (pure - returns new array).

---

## SessionManager Class

Wrapper for stateful session management.

**Constructor:**

```javascript
new SessionManager();
```

**Methods:**

- `createSession(stepNum, operation, description)` - Create and register session
- `endSession(sessionId)` - End and cleanup session
- `getSession(sessionId)` - Get session info
- `getAllSessions()` - Get all active sessions
- `cleanup()` - Clean up all sessions

---

## Usage Examples

### Creating Sessions

```javascript
import { SessionManager } from './lib/session_manager.js';

const manager = new SessionManager();

const sessionId = await manager.createSession(1, 'analysis', 'Analyzing project files');

// ... perform operations ...

await manager.endSession(sessionId);
```

### Using Pure Functions

```javascript
import { generateSessionId, registerSession } from './lib/session_manager.js';
import crypto from 'crypto';

const sessionId = generateSessionId(3, 'build', Date.now(), crypto.randomBytes(4));

const sessions = new Map();
const updatedSessions = registerSession(sessions, sessionId, {
  sessionId,
  description: 'Building',
  startTime: Date.now(),
});
```

---

## Related Modules

- **[cleanup_handlers](./cleanup_handlers.md)** - Session cleanup operations
- **[metrics](./metrics.md)** - Session duration tracking

---

**Last Updated:** 2026-02-01  
**Part of:** AI Workflow Automation v1.0.0
