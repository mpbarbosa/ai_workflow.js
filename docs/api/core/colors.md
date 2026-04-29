# colors - ANSI Color Codes Module

**Module:** `core/colors`
**Version:** 2.2.17
**Type:** Pure Functional

## Overview

Provides ANSI color codes for terminal output with automatic color support detection. This module enables colored console output while gracefully degrading to plain text when colors are not supported.

---

## Exports

### `colors` Object

ANSI escape codes for terminal colors and text formatting.

**Type:** `Object<string, string>`

**Properties:**

| Property        | Code       | Description               |
| --------------- | ---------- | ------------------------- |
| `reset`         | `\x1b[0m`  | Reset all formatting      |
| `bold`          | `\x1b[1m`  | Bold/bright text          |
| `dim`           | `\x1b[2m`  | Dim/faint text            |
| `black`         | `\x1b[30m` | Black foreground          |
| `red`           | `\x1b[31m` | Red foreground            |
| `green`         | `\x1b[32m` | Green foreground          |
| `yellow`        | `\x1b[33m` | Yellow foreground         |
| `blue`          | `\x1b[34m` | Blue foreground           |
| `magenta`       | `\x1b[35m` | Magenta foreground        |
| `cyan`          | `\x1b[36m` | Cyan foreground           |
| `white`         | `\x1b[37m` | White foreground          |
| `brightRed`     | `\x1b[91m` | Bright red foreground     |
| `brightGreen`   | `\x1b[92m` | Bright green foreground   |
| `brightYellow`  | `\x1b[93m` | Bright yellow foreground  |
| `brightBlue`    | `\x1b[94m` | Bright blue foreground    |
| `brightMagenta` | `\x1b[95m` | Bright magenta foreground |
| `brightCyan`    | `\x1b[96m` | Bright cyan foreground    |
| `brightWhite`   | `\x1b[97m` | Bright white foreground   |

**Example:**

```javascript
import { colors } from './core/colors.js';

console.log(`${colors.red}Error:${colors.reset} Something went wrong`);
console.log(`${colors.bold}${colors.green}Success!${colors.reset}`);
```

---

## Functions

### `supportsColor()`

Check if the terminal supports color output.

**Returns:** `boolean` - `true` if terminal supports colors

**Detection Logic:**

- Returns `true` if:
  - `process.stdout.isTTY` is true (interactive terminal)
  - `process.env.TERM` is not `'dumb'`
  - `process.env.NO_COLOR` is not set

**Example:**

```javascript
import { supportsColor } from './core/colors.js';

if (supportsColor()) {
  console.log('Colors are supported!');
} else {
  console.log('Colors are not supported');
}
```

---

### `colorize(text, color)`

Apply color to text if terminal supports it, otherwise return plain text.

**Parameters:**

| Name    | Type     | Description                          |
| ------- | -------- | ------------------------------------ |
| `text`  | `string` | Text to colorize                     |
| `color` | `string` | ANSI color code from `colors` object |

**Returns:** `string` - Colorized text or plain text

**Example:**

```javascript
import { colorize, colors } from './core/colors.js';

const errorMsg = colorize('Error occurred', colors.red);
const successMsg = colorize('Operation completed', colors.green);

console.log(errorMsg);
console.log(successMsg);
```

**Behavior:**

- If `supportsColor()` returns `false`, returns original text unchanged
- Automatically adds `colors.reset` after the colored text

---

## Usage Examples

### Basic Usage

```javascript
import { colors, colorize, supportsColor } from './core/colors.js';

// Direct ANSI codes
console.log(`${colors.cyan}Info:${colors.reset} Processing...`);
console.log(`${colors.yellow}Warning:${colors.reset} Low disk space`);

// Using colorize helper
console.log(colorize('✓ Success', colors.green));
console.log(colorize('✗ Failed', colors.red));

// Check color support
if (supportsColor()) {
  console.log(colorize('Colorful output enabled', colors.brightCyan));
}
```

### Combining Styles

```javascript
import { colors } from './core/colors.js';

// Bold + colored text
const boldRed = `${colors.bold}${colors.red}`;
console.log(`${boldRed}Critical Error${colors.reset}`);

// Dim text for secondary information
console.log(`${colors.dim}Debug: Variable value = 42${colors.reset}`);
```

### Color Support Detection

```javascript
import { supportsColor } from './core/colors.js';

function formatMessage(text, level) {
  if (!supportsColor()) {
    return `[${level}] ${text}`;
  }

  switch (level) {
    case 'error':
      return colorize(`✗ ${text}`, colors.red);
    case 'success':
      return colorize(`✓ ${text}`, colors.green);
    default:
      return text;
  }
}

console.log(formatMessage('Operation complete', 'success'));
```

---

## Environment Variables

| Variable   | Effect                                     |
| ---------- | ------------------------------------------ |
| `NO_COLOR` | Disables color output when set (any value) |
| `TERM`     | Colors disabled if set to `'dumb'`         |

---

## Browser Compatibility

⚠️ **Note:** This module is designed for Node.js terminal environments. ANSI codes do not work in browsers.

---

## Related Modules

- **[logger](./logger.md)** - Uses this module for colored log output
- **[backlog](../lib/backlog.md)** - Uses emojis (unicode) for status indicators

---

## Best Practices

1. **Always reset formatting:**

   ```javascript
   // ✅ Good
   console.log(`${colors.red}Error${colors.reset} - normal text`);

   // ❌ Bad - color bleeds into subsequent output
   console.log(`${colors.red}Error - this text is red too`);
   ```

2. **Use colorize() for automatic fallback:**

   ```javascript
   // ✅ Good - automatically handles color support
   console.log(colorize('Status', colors.green));

   // ❌ Less flexible - always outputs ANSI codes
   console.log(`${colors.green}Status${colors.reset}`);
   ```

3. **Check support for conditional logic:**
   ```javascript
   const prefix = supportsColor() ? `${colors.bold}${colors.cyan}[INFO]${colors.reset}` : '[INFO]';
   console.log(`${prefix} Message`);
   ```

---

## Implementation Notes

- **Pure functional:** All functions are referentially transparent
- **No dependencies:** Uses only Node.js built-ins (`process`)
- **Zero overhead:** No color processing when colors are disabled
- **TTY detection:** Automatically detects non-interactive contexts (pipes, files)

---

**Last Updated:** 2026-02-01
**Part of:** AI Workflow Automation v1.9.11
