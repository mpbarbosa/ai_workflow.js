## CLI_QUICK_REFERENCE

# CLI Quick Reference

Quick command reference for ai-workflow CLI.

---

## Commands

### Run Workflow

```bash
ai-workflow run [--stage quick|medium|full] [--auto] [--dry-run]
```

### Resume from Checkpoint

```bash
ai-workflow resume [--list|--latest] [checkpointId]
```

### View Status

```bash
ai-workflow status
```

### Initialize Project

```bash
ai-workflow init [--interactive] [--template <name>] [--force]
```

### Manage Configuration

```bash
ai-workflow config show|validate|get|set [args...]
```

### Clean Artifacts

```bash
ai-workflow clean [--artifacts|--cache|--checkpoints|--all] [--dry-run]
```

---

## Common Patterns

### Quick Start

```bash
ai-workflow init --interactive
ai-workflow run --stage quick
ai-workflow status
```

### Development Workflow

```bash
# During development
ai-workflow run --stage quick --auto

# Before push
ai-workflow run --stage medium

# Weekly check
ai-workflow run
```

### Resume After Error

```bash
ai-workflow resume --list
ai-workflow resume --latest
```

### Configuration Management

```bash
ai-workflow config show
ai-workflow config get project.name
ai-workflow config set project.name "NewName"
ai-workflow config validate
```

### Cleanup

```bash
# Preview
ai-workflow clean --all --dry-run

# Execute
ai-workflow clean --artifacts --cache

# Keep recent checkpoints
ai-workflow clean --checkpoints --keep-last 5
```

---

## Global Options

```bash
-v, --verbose        # Verbose output
-q, --quiet          # Quiet mode
--no-color          # Disable colors
--config <path>     # Custom config file
-h, --help          # Show help
-V, --version       # Show version
```

---

## Templates

Available project templates for `init`:

- `nodejs_api` - Node.js API/Backend
- `react_spa` - React SPA
- `python_app` - Python Application
- `shell_script_automation` - Shell Scripts
- `static_website` - Static Site
- `client_spa` - Vanilla JS SPA
- `configuration_library` - Config Library
- `generic` - Generic Project

---

## Workflow Stages

| Stage  | Steps | Duration  | Use Case          |
| ------ | ----- | --------- | ----------------- |
| quick  | 3     | 1-2 min   | Fast validation   |
| medium | 6     | 5-10 min  | Standard checks   |
| full   | 10    | 15-30 min | Complete workflow |

---

## Exit Codes

- `0` - Success
- `1` - Error or failure

---

## Environment Variables

- `AI_WORKFLOW_CONFIG` - Config file path
- `AI_WORKFLOW_DIR` - Workflow directory
- `NO_COLOR` - Disable colors

---

## Help

```bash
ai-workflow --help           # General help
ai-workflow <command> --help # Command help
```

---

**See Also**: [CLI Usage Guide](CLI_USAGE_GUIDE.md)


---

## CLI_QUICK_REFERENCE

# CLI Quick Reference

Quick command reference for ai-workflow CLI.

---

## Commands

### Run Workflow

```bash
ai-workflow run [--stage quick|medium|full] [--auto] [--dry-run]
```

### Resume from Checkpoint

```bash
ai-workflow resume [--list|--latest] [checkpointId]
```

### View Status

```bash
ai-workflow status
```

### Initialize Project

```bash
ai-workflow init [--interactive] [--template <name>] [--force]
```

### Manage Configuration

```bash
ai-workflow config show|validate|get|set [args...]
```

### Clean Artifacts

```bash
ai-workflow clean [--artifacts|--cache|--checkpoints|--all] [--dry-run]
```

---

## Common Patterns

### Quick Start

```bash
ai-workflow init --interactive
ai-workflow run --stage quick
ai-workflow status
```

### Development Workflow

```bash
# During development
ai-workflow run --stage quick --auto

# Before push
ai-workflow run --stage medium

# Weekly check
ai-workflow run
```

### Resume After Error

```bash
ai-workflow resume --list
ai-workflow resume --latest
```

### Configuration Management

```bash
ai-workflow config show
ai-workflow config get project.name
ai-workflow config set project.name "NewName"
ai-workflow config validate
```

### Cleanup

```bash
# Preview
ai-workflow clean --all --dry-run

# Execute
ai-workflow clean --artifacts --cache

# Keep recent checkpoints
ai-workflow clean --checkpoints --keep-last 5
```

---

## Global Options

```bash
-v, --verbose        # Verbose output
-q, --quiet          # Quiet mode
--no-color          # Disable colors
--config <path>     # Custom config file
-h, --help          # Show help
-V, --version       # Show version
```

---

## Templates

Available project templates for `init`:

- `nodejs_api` - Node.js API/Backend
- `react_spa` - React SPA
- `python_app` - Python Application
- `shell_script_automation` - Shell Scripts
- `static_website` - Static Site
- `client_spa` - Vanilla JS SPA
- `configuration_library` - Config Library
- `generic` - Generic Project

---

## Workflow Stages

| Stage  | Steps | Duration  | Use Case          |
| ------ | ----- | --------- | ----------------- |
| quick  | 3     | 1-2 min   | Fast validation   |
| medium | 6     | 5-10 min  | Standard checks   |
| full   | 10    | 15-30 min | Complete workflow |

---

## Exit Codes

- `0` - Success
- `1` - Error or failure

---

## Environment Variables

- `AI_WORKFLOW_CONFIG` - Config file path
- `AI_WORKFLOW_DIR` - Workflow directory
- `NO_COLOR` - Disable colors

---

## Help

```bash
ai-workflow --help           # General help
ai-workflow <command> --help # Command help
```

---

**See Also**: [CLI Usage Guide](CLI_USAGE_GUIDE.md)
