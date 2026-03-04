# Configuration Directory

**Status:** Reserved/Deprecated
**Last Updated:** 2026-02-08

## Notice

This directory exists as a placeholder but is **not currently used**. Configuration management is handled by:

- **`src/lib/config.js`** - Configuration Manager module (Phase 2, v2.0.0)
- **`.workflow-config.yaml`** - Project configuration file (root directory)
- **`.workflow_core/config/`** - Shared configuration templates (submodule)

## Why This Directory Exists

This directory was created during initial project scaffolding as a potential location for configuration-related modules. However, the configuration module was instead implemented as part of the `src/lib/` library layer to maintain cohesion with other workflow management modules.

## Potential Future Uses

This directory could be repurposed for:

1. **Configuration Schema Definitions** - JSON Schema files for config validation
2. **Configuration Templates** - Additional templates beyond workflow_core
3. **Configuration Migrations** - Version migration scripts for config format changes
4. **Configuration Validators** - Specialized validation modules

## Current Configuration Architecture

```
Configuration Management:
├── src/lib/config.js               # ConfigManager class (main implementation)
├── .workflow-config.yaml           # Project-specific configuration
├── .workflow_core/config/          # Shared templates and schemas
│   ├── .workflow-config.yaml.template
│   └── project_kinds.yaml
└── src/config/                     # THIS DIRECTORY (currently unused)
```

## Recommendation

**Option 1 (Current):** Keep as empty placeholder for potential future use

**Option 2:** Remove if not needed:

```bash
# After confirming no references exist
rm -rf src/config/
```

**Option 3:** Populate with schema files:

```bash
# Add JSON Schema for config validation
mkdir -p src/config/schemas/
# Create schema files...
```

## Related Documentation

- [Configuration Guide](../../docs/guides/CONFIGURATION_GUIDE.md) - How to configure ai_workflow.js
- [Configuration Manager API](../../docs/api/lib/config.md) - API reference for ConfigManager
- [Project Kinds](../../.workflow_core/config/project_kinds.yaml) - Project type configurations

---

**Status:** Placeholder - Not currently used
**Config Module:** `src/lib/config.js` (use this instead)
**Decision:** Keep for potential future schema/migration use
