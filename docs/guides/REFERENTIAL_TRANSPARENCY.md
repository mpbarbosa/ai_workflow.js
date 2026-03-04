# Referential Transparency Guide

**Applies to:** ai_workflow.js v2.0.0+
**Architecture:** Pure Functions + Impure Wrappers

> **Note:** The canonical reference is [`.github/REFERENTIAL_TRANSPARENCY.md`](../../.github/REFERENTIAL_TRANSPARENCY.md). This guide provides a project-specific summary and practical examples.

---

## Table of Contents

- [What is Referential Transparency?](#what-is-referential-transparency)
- [Why It Matters](#why-it-matters)
- [The v2.0.0 Pattern](#the-v200-pattern)
- [Pure Function Guidelines](#pure-function-guidelines)
- [Impure Wrapper Guidelines](#impure-wrapper-guidelines)
- [Testing Strategy](#testing-strategy)
- [Common Pitfalls](#common-pitfalls)
- [Module Examples](#module-examples)

---

## What is Referential Transparency?

A function is **referentially transparent** if it always returns the same output for the same input, with no observable side effects. Any call to the function can be safely replaced with its return value.

```javascript
// ✅ Referentially transparent
function add(a, b) { return a + b; }
add(2, 3); // always 5

// ❌ Not referentially transparent
function getTime() { return Date.now(); } // different every call
function log(msg) { console.log(msg); }  // side effect
```

---

## Why It Matters

In ai_workflow.js, referential transparency gives us:

| Benefit         | Description                                                   |
| --------------- | ------------------------------------------------------------- |
| **Testability** | Pure functions need no mocks — just call with inputs          |
| **Predictability** | Same config → same result, every run                       |
| **Debuggability** | Side effects are obvious and isolated at wrapper boundaries |
| **Composability** | Pure functions can be freely combined                       |
| **Performance** | Pure results can be safely cached (same input = same output)  |

---

## The v2.0.0 Pattern

All v2.0.0 modules separate business logic (pure) from I/O (impure):

```
┌──────────────────────────────────────────────┐
│  Impure Wrapper Class                        │
│  - File I/O, console logging                 │
│  - Injects: Date.now(), crypto.randomBytes() │
│  - Calls pure functions for business logic   │
└──────────────────┬───────────────────────────┘
                   │ calls
                   ▼
┌──────────────────────────────────────────────┐
│  Pure Functions (exported)                   │
│  - Deterministic calculations                │
│  - Immutable data transformations            │
│  - No side effects                           │
└──────────────────────────────────────────────┘
```

### Concrete Example: `session_manager.js`

```javascript
// ✅ PURE — exported for direct testing
export function generateSessionId(randomBytes) {
  return randomBytes.toString('hex');
}

export function createSessionEntry(sessionId, currentTime, metadata) {
  return { id: sessionId, startTime: currentTime, ...metadata }; // immutable
}

// ✅ IMPURE WRAPPER — isolates side effects
export class SessionManager {
  createSession(metadata = {}) {
    const bytes = crypto.randomBytes(16);         // side effect: randomness
    const id = generateSessionId(bytes);          // pure call
    const entry = createSessionEntry(id, Date.now(), metadata); // pure call
    this.sessions.set(id, entry);                 // side effect: mutation
    logger.info(`Session: ${id}`);               // side effect: I/O
    return id;
  }
}
```

---

## Pure Function Guidelines

1. **Same input → same output** (deterministic)
2. **No mutation** of parameters or global state
3. **No I/O** (no `fs`, `console`, `fetch`, `Date.now()`, `Math.random()`)
4. **Inject time/random** as parameters when needed
5. **Return new objects** — never mutate input objects

```javascript
// ✅ Inject time as parameter
export function createTimestamp(currentTime) {
  return new Date(currentTime).toISOString();
}

// ❌ Captures time internally
export function createTimestamp() {
  return new Date().toISOString(); // not pure
}
```

---

## Impure Wrapper Guidelines

1. **Inject all dependencies** through the constructor
2. **Call pure functions** for all business logic
3. **Isolate side effects** at the outermost layer
4. **Document side effects** in JSDoc `@sideEffects` tag

```javascript
export class ConfigManager {
  constructor({ fs = nodeFs, logger = defaultLogger } = {}) {
    this._fs = fs;       // injectable for testing
    this._logger = logger;
  }

  async load(configPath) {
    const raw = await this._fs.readFile(configPath, 'utf8'); // side effect
    return parseConfig(raw); // pure function
  }
}
```

---

## Testing Strategy

### Pure Functions — No Mocks Needed

```javascript
import { generateSessionId, createSessionEntry } from '../src/lib/session_manager.js';

test('generateSessionId is deterministic', () => {
  const bytes = Buffer.from('0123456789abcdef');
  expect(generateSessionId(bytes)).toBe(generateSessionId(bytes)); // always same
});

test('createSessionEntry is immutable', () => {
  const meta = { user: 'alice' };
  const entry = createSessionEntry('id1', 1000, meta);
  expect(entry).not.toBe(meta);  // new object
  expect(meta.id).toBeUndefined(); // original unchanged
});
```

### Impure Wrappers — Use Dependency Injection

```javascript
import { SessionManager } from '../src/lib/session_manager.js';

test('creates unique session IDs', () => {
  const manager = new SessionManager();
  const id1 = manager.createSession();
  const id2 = manager.createSession();
  expect(id1).not.toBe(id2);
});
```

---

## Common Pitfalls

| Pitfall                        | Wrong                              | Right                                    |
| ------------------------------ | ---------------------------------- | ---------------------------------------- |
| Capturing current time         | `const t = Date.now()`             | `function f(currentTime)` parameter      |
| Mutating input array           | `arr.push(item); return arr`       | `return [...arr, item]`                  |
| Mutating input object          | `obj.key = val; return obj`        | `return { ...obj, key: val }`            |
| Global state                   | `let count = 0; export function…`  | Return new state as a value              |
| Logging inside pure function   | `console.log(…); return result`    | Return result; log in wrapper            |

---

## Module Examples

Modules following v2.0.0 referential transparency architecture:

| Module                   | Pure Functions                                  | Wrapper Class          |
| ------------------------ | ----------------------------------------------- | ---------------------- |
| `lib/config.js`          | `parseYamlSync`, `validateConfig`               | `ConfigManager`        |
| `lib/session_manager.js` | `generateSessionId`, `createSessionEntry`       | `SessionManager`       |
| `lib/metrics.js`         | `calculateDuration`, `formatMetrics`            | `MetricsCollector`     |
| `lib/git_automation.js`  | `parseGitStatus`, `parseGitDiff`                | `GitAutomation`        |
| `lib/ai_cache.js`        | `isCacheValid`, `calculateCacheStats`           | `AiCache`              |
| `orchestrator/dependency_resolver.js` | `buildDependencyGraph`, `topologicalSort` | `DependencyResolver` |

---

## Related Documentation

- [Architecture: Design Principles](../architecture/DESIGN_PRINCIPLES.md)
- [Architecture: Overview](../architecture/OVERVIEW.md)
- [Testing Guide](TESTING_GUIDE.md)
- [Developer Guide](DEVELOPER_GUIDE.md)
- [Full Reference (canonical)](.../../.github/REFERENTIAL_TRANSPARENCY.md)

---

**Last Updated:** 2026-03-04
**Applies to:** ai_workflow.js v2.0.0+ modules
