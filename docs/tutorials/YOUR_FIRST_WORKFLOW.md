# Your First Workflow - Tutorial

**Version:** 1.9.10
**Last Updated:** 2026-02-17
**Difficulty:** Beginner
**Estimated Time:** 15 minutes

---

## Overview

This tutorial will guide you through running your first AI-powered workflow with ai_workflow.js. You'll learn how to:

1. Set up a project for workflow automation
2. Configure the workflow settings
3. Run a quick validation workflow
4. Understand the workflow output
5. Resume from a checkpoint

## Prerequisites

Before starting, ensure you have:

- ✅ Node.js 18+ installed (`node --version`)
- ✅ npm 9+ installed (`npm --version`)
- ✅ A Git repository (existing project or new)
- ✅ GitHub Copilot CLI installed (optional for AI features)

## Step 1: Installation

### Install ai_workflow.js

```bash
# Clone the repository
git clone https://github.com/mpbarbosa/ai_workflow.js.git
cd ai_workflow.js

# Run the setup script
./scripts/setup.sh
```

The setup script will:

- ✅ Verify Node.js and npm versions
- ✅ Install dependencies
- ✅ Initialize Git submodules
- ✅ Create required directories
- ✅ Run initial validation

## Step 2: Project Configuration

Create a configuration file for your project:

```bash
# Copy the template
cp .workflow-config.yaml.template .workflow-config.yaml
```

Edit `.workflow-config.yaml` with your project details:

```yaml
# Project Metadata
project:
  name: 'my-awesome-project'
  version: '1.0.0'
  primary_language: 'javascript'
  project_kind: 'nodejs_api'

# Workflow Settings
workflow:
  stage: 'quick' # Options: quick, medium, full
  auto: false # Auto-approve steps?
  parallel_execution: true # Run independent steps in parallel?
```

For complete tutorial, see full version in project repository.

---

**Need help?** Open an issue on [GitHub](https://github.com/mpbarbosa/ai_workflow.js/issues).
