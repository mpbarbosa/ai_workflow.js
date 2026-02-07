# Installation Guide

**Version:** 1.0.0  
**Last Updated:** February 1, 2026

Complete installation instructions for ai_workflow.js across different platforms and use cases.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Installation Methods](#installation-methods)
  - [Development Installation](#development-installation)
  - [Global CLI Installation](#global-cli-installation)
  - [npm Package Installation](#npm-package-installation)
- [Platform-Specific Instructions](#platform-specific-instructions)
  - [Linux/macOS](#linuxmacos)
  - [Windows](#windows)
  - [Docker](#docker)
- [Verification](#verification)
- [Configuration](#configuration)
- [Troubleshooting](#troubleshooting)
- [Upgrading](#upgrading)
- [Uninstalling](#uninstalling)

---

## Prerequisites

### Required Software

| Software    | Minimum Version | Recommended | Purpose                      |
| ----------- | --------------- | ----------- | ---------------------------- |
| **Node.js** | 18.0.0          | 20.x LTS    | JavaScript runtime           |
| **npm**     | 9.0.0           | 10.x        | Package manager              |
| **Git**     | 2.x             | Latest      | Version control & submodules |

### System Requirements

- **OS:** Linux, macOS 10.15+, Windows 10+, WSL2
- **RAM:** 512 MB minimum, 2 GB recommended
- **Disk Space:** 100 MB for installation + dependencies
- **Terminal:** Bash, Zsh, or any POSIX-compliant shell (Windows: PowerShell, Git Bash, WSL)

### Checking Prerequisites

```bash
# Check Node.js version
node --version
# Expected: v18.x.x or higher

# Check npm version
npm --version
# Expected: 9.x.x or higher

# Check Git version
git --version
# Expected: git version 2.x.x or higher
```

If any prerequisite is missing or outdated, see [Installing Prerequisites](#installing-prerequisites).

---

## Installation Methods

### Development Installation

**Best for:** Contributing, testing, or exploring the codebase.

#### 1. Clone the Repository

```bash
# Clone with submodules (includes .workflow_core)
git clone --recursive https://github.com/mpbarbosa/ai_workflow.js.git

# Navigate to project directory
cd ai_workflow.js
```

**Note:** The `--recursive` flag automatically initializes the `.workflow_core` Git submodule, which contains essential configuration templates.

#### 2. Install Dependencies

```bash
# Install all dependencies (production + development)
npm install
```

This installs:

- Production dependencies: `@github/copilot-sdk`, `js-yaml`
- Development dependencies: `jest`, `eslint`, `prettier`, `husky`, `lint-staged`

#### 3. Verify Installation

```bash
# Run test suite
npm test

# Expected output:
# Test Suites: 13 passed, 13 total
# Tests:       693 passed, 695 total
# Time:        ~10-20 seconds
```

#### 4. Set Up Git Hooks (Optional)

```bash
# Initialize Husky for pre-commit hooks
npm run prepare
```

This enables automatic linting and formatting on commit.

---

### Global CLI Installation

**Best for:** Using ai_workflow.js as a command-line tool.

#### Option 1: Install from Repository

```bash
# Clone and build
git clone --recursive https://github.com/mpbarbosa/ai_workflow.js.git
cd ai_workflow.js
npm install

# Link globally
npm link
```

#### Option 2: Install from npm (Future)

```bash
# Once published to npm registry
npm install -g ai-workflow
```

After installation, verify:

```bash
# Check if command is available
ai-workflow --version

# Run help
ai-workflow --help
```

---

### npm Package Installation

**Best for:** Using ai_workflow.js as a library in your project.

#### Install as Dependency

```bash
# Production dependency
npm install ai-workflow

# Or with Yarn
yarn add ai-workflow

# Or with pnpm
pnpm add ai-workflow
```

#### Import in Your Code

```javascript
// ES Modules (recommended)
import { Logger, ConfigManager, FileOperations } from 'ai-workflow';

// CommonJS (if needed)
const { Logger, ConfigManager } = require('ai-workflow');
```

---

## Platform-Specific Instructions

### Linux/macOS

#### Install Node.js

**Option 1: Using nvm (recommended)**

```bash
# Install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Load nvm
source ~/.bashrc  # or ~/.zshrc for Zsh

# Install Node.js LTS
nvm install --lts
nvm use --lts
```

**Option 2: Using Package Manager**

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install nodejs npm

# Fedora
sudo dnf install nodejs npm

# macOS (Homebrew)
brew install node
```

#### Install ai_workflow.js

```bash
# Development installation
git clone --recursive https://github.com/mpbarbosa/ai_workflow.js.git
cd ai_workflow.js
npm install
npm test
```

---

### Windows

#### Install Node.js

**Option 1: Download Installer**

1. Download from [nodejs.org](https://nodejs.org/)
2. Run installer (includes npm)
3. Verify in PowerShell or Command Prompt

**Option 2: Using Chocolatey**

```powershell
# Install Chocolatey first (if not installed)
# Then install Node.js
choco install nodejs-lts
```

**Option 3: Using Scoop**

```powershell
scoop install nodejs-lts
```

#### Install Git

```powershell
# Using Chocolatey
choco install git

# Or download from git-scm.com
```

#### Install ai_workflow.js

**Using PowerShell:**

```powershell
# Clone repository
git clone --recursive https://github.com/mpbarbosa/ai_workflow.js.git
cd ai_workflow.js

# Install dependencies
npm install

# Run tests
npm test
```

**Using WSL2 (recommended for development):**

```bash
# Inside WSL2 Ubuntu
sudo apt update
sudo apt install nodejs npm git
git clone --recursive https://github.com/mpbarbosa/ai_workflow.js.git
cd ai_workflow.js
npm install
npm test
```

---

### Docker

**Best for:** Isolated environments or CI/CD pipelines.

#### Dockerfile

Create a `Dockerfile` in your project:

```dockerfile
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Expose any ports if needed
# EXPOSE 3000

# Default command
CMD ["node", "src/index.js"]
```

#### Build and Run

```bash
# Build image
docker build -t ai-workflow .

# Run container
docker run --rm -v $(pwd):/app ai-workflow

# Or with interactive shell
docker run --rm -it -v $(pwd):/app ai-workflow sh
```

#### Docker Compose

```yaml
# docker-compose.yml
version: '3.8'
services:
  ai-workflow:
    build: .
    volumes:
      - .:/app
      - /app/node_modules
    environment:
      - NODE_ENV=development
```

Run with:

```bash
docker-compose up
```

---

## Verification

### Test Suite

Run the complete test suite to verify installation:

```bash
# Run all tests
npm test

# Expected output:
# ✓ Core Foundation tests (7 modules, 113 tests)
# ✓ Configuration & State tests (4 modules, 174 tests)
# ✓ File Operations tests (5 modules, 354 tests)
# ✓ Project Detection tests (4 modules, 167 tests)
# ✓ Git Integration tests (4 modules, 219 tests)
# ✓ AI Integration tests (6 modules, 424 tests, 2 known failures)
# ✓ Workflow Orchestration tests (6 modules, 329 tests)
# Total: 1694 tests (1692 passing, 2 known failures)
```

### Import Tests

Verify that modules can be imported:

```javascript
// Create test.js
import { Logger, ConfigManager, FileOperations } from './src/index.js';

const logger = new Logger({ level: 'info' });
logger.success('Installation verified!');

const config = new ConfigManager();
console.log('ConfigManager loaded:', typeof config);

const fileOps = new FileOperations();
console.log('FileOperations loaded:', typeof fileOps);
```

Run:

```bash
node test.js
# Expected:
# ✓ Installation verified!
# ConfigManager loaded: object
# FileOperations loaded: object
```

### Code Quality Checks

```bash
# Run linter
npm run lint
# Expected: No errors

# Check formatting
npm run format:check
# Expected: All files formatted correctly
```

---

## Configuration

### Initialize Project Configuration

After installation, create a configuration file for your project:

```bash
# Copy template from submodule
cp .workflow_core/config/.workflow-config.yaml.template .workflow-config.yaml
```

Edit `.workflow-config.yaml`:

```yaml
project:
  name: 'my-project'
  type: 'nodejs-application'
  description: 'My awesome project'
  kind: 'cli_tool'
  version: '1.0.0'

tech_stack:
  primary_language: 'javascript'
  build_system: 'npm'
  test_framework: 'jest'
  test_command: 'npm test'
  lint_command: 'npm run lint'

structure:
  source_dirs:
    - src
  test_dirs:
    - test
  docs_dirs:
    - docs
```

### Environment Variables

Optional environment variables:

```bash
# Set log level (debug, info, warn, error)
export AI_WORKFLOW_LOG_LEVEL=info

# Set config file path
export AI_WORKFLOW_CONFIG_PATH=/path/to/.workflow-config.yaml

# Disable colors
export NO_COLOR=1
```

Add to `~/.bashrc` or `~/.zshrc` to persist.

---

## Troubleshooting

### Common Issues

#### 1. Node.js Version Too Old

**Error:**

```
Error: The engine "node" is incompatible with this module. Expected version ">=18.0.0".
```

**Solution:**

```bash
# Upgrade Node.js using nvm
nvm install --lts
nvm use --lts

# Or download latest from nodejs.org
```

#### 2. Git Submodule Not Initialized

**Error:**

```
Error: Cannot find module './.workflow_core/config/project_kinds.yaml'
```

**Solution:**

```bash
# Initialize submodules
git submodule update --init --recursive

# Or re-clone with --recursive
git clone --recursive https://github.com/mpbarbosa/ai_workflow.js.git
```

#### 3. Module Not Found Errors

**Error:**

```
Error: Cannot find module 'ai-workflow'
```

**Solution:**

```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Or clear npm cache
npm cache clean --force
npm install
```

#### 4. Test Failures

**Error:**

```
FAIL test/lib/some_test.test.js
```

**Solution:**

```bash
# Clean install
rm -rf node_modules package-lock.json
npm install

# Run tests with verbose output
npm test -- --verbose

# Run specific test file
npm test -- test/lib/logger.test.js
```

#### 5. Permission Denied (Linux/macOS)

**Error:**

```
EACCES: permission denied, mkdir '/usr/local/lib/node_modules/ai-workflow'
```

**Solution:**

```bash
# Don't use sudo with npm!
# Instead, configure npm to use a local directory

# Create directory
mkdir -p ~/.npm-global

# Configure npm
npm config set prefix '~/.npm-global'

# Add to PATH (add to ~/.bashrc or ~/.zshrc)
export PATH=~/.npm-global/bin:$PATH

# Reload shell
source ~/.bashrc

# Now install globally without sudo
npm install -g ai-workflow
```

#### 6. Husky Pre-Commit Hook Fails

**Error:**

```
husky - pre-commit hook exited with code 1
```

**Solution:**

```bash
# Check what's failing
npm run lint
npm run format:check

# Auto-fix issues
npm run lint:fix
npm run format

# Bypass hook temporarily (not recommended)
git commit --no-verify
```

#### 7. Windows Path Issues

**Error:**

```
Error: ENOENT: no such file or directory, open 'C:\Users\...\path\with\backslashes'
```

**Solution:**

```javascript
// Use path.join() or path.resolve() for cross-platform paths
import path from 'path';

const configPath = path.join(process.cwd(), '.workflow-config.yaml');
```

---

## Upgrading

### Upgrade from Git

```bash
# Pull latest changes
git pull origin main

# Update submodules
git submodule update --remote --merge

# Reinstall dependencies
npm install

# Run tests to verify
npm test
```

### Upgrade npm Package

```bash
# Check current version
npm list ai-workflow

# Update to latest
npm update ai-workflow

# Or install specific version
npm install ai-workflow@1.2.0
```

### Breaking Changes

Check [CHANGELOG.md](../../CHANGELOG.md) for breaking changes before upgrading.

---

## Uninstalling

### Remove Global Installation

```bash
# Unlink global package
npm unlink ai-workflow

# Or uninstall
npm uninstall -g ai-workflow
```

### Remove Local Installation

```bash
# Remove from project
npm uninstall ai-workflow

# Or delete entire project
cd ..
rm -rf ai_workflow.js
```

### Clean npm Cache

```bash
# Clear npm cache (optional)
npm cache clean --force
```

---

## Installing Prerequisites

### Node.js Installation Guides

**Linux (Ubuntu/Debian):**

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

**Linux (Fedora/RHEL):**

```bash
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo dnf install nodejs
```

**macOS:**

```bash
# Using Homebrew
brew install node

# Or using nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.zshrc
nvm install --lts
```

**Windows:**

- Download installer from [nodejs.org](https://nodejs.org/)
- Or use package manager (Chocolatey, Scoop, winget)

### Git Installation

**Linux:**

```bash
# Ubuntu/Debian
sudo apt-get install git

# Fedora/RHEL
sudo dnf install git
```

**macOS:**

```bash
# Using Homebrew
brew install git

# Or use Xcode Command Line Tools
xcode-select --install
```

**Windows:**

- Download from [git-scm.com](https://git-scm.com/)
- Or use package manager

---

## Next Steps

After successful installation:

1. **[Quick Start Guide](./QUICK_START.md)** - Run your first examples
2. **[First Workflow Tutorial](./FIRST_WORKFLOW.md)** - Build a complete workflow
3. **[Configuration Guide](../guides/CONFIGURATION_GUIDE.md)** - Configure your project
4. **[API Reference](../api/README.md)** - Explore available modules

---

## Getting Help

- **Documentation:** [docs/README.md](../README.md)
- **GitHub Issues:** [Report a problem](https://github.com/mpbarbosa/ai_workflow.js/issues)
- **Discussions:** [Ask questions](https://github.com/mpbarbosa/ai_workflow.js/discussions)

---

**Installation Complete?** Continue to the [Quick Start Guide](./QUICK_START.md) to start using ai_workflow.js!
