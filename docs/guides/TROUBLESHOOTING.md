# Troubleshooting Guide

**Version:** 1.0.0  
**Last Updated:** 2026-02-11

This guide helps you diagnose and resolve common issues with ai_workflow.js.

## Table of Contents

- [Quick Diagnostics](#quick-diagnostics)
- [Installation Issues](#installation-issues)
- [Configuration Problems](#configuration-problems)
- [Workflow Execution Errors](#workflow-execution-errors)
- [Performance Issues](#performance-issues)
- [Git Integration Problems](#git-integration-problems)
- [AI Integration Issues](#ai-integration-issues)
- [Testing Problems](#testing-problems)
- [Getting Help](#getting-help)

## Quick Diagnostics

### Check System Requirements

```bash
# Node.js version (requires >= 18.0.0)
node --version

# npm version (requires >= 9.0.0)
npm --version

# Git version
git --version

# Check installation
npm list ai-workflow 2>/dev/null || echo "Not installed"
```

### Verify Configuration

```bash
# Check configuration file exists
ls -la .workflow-config.yaml

# Validate YAML syntax
node -e "require('js-yaml').load(require('fs').readFileSync('.workflow-config.yaml', 'utf8'))"

# Check workflow directories
ls -la .ai_workflow/
```

### Run Health Check

```javascript
import { Config, GitAutomation } from 'ai-workflow';

// Check configuration
const config = new Config();
await config.load('.workflow-config.yaml');
console.log('✅ Configuration loaded');

// Check Git
const git = new GitAutomation();
const isRepo = await git.isGitRepository();
console.log(`✅ Git repository: ${isRepo}`);

// Check test framework
const hasTests = await config.hasTests();
console.log(`✅ Test framework: ${hasTests}`);
```

## Installation Issues

### Problem: `npm install` fails with dependency errors

**Symptoms:**

```
npm ERR! code ERESOLVE
npm ERR! ERESOLVE unable to resolve dependency tree
```

**Solutions:**

1. **Clear npm cache:**

   ```bash
   npm cache clean --force
   rm -rf node_modules package-lock.json
   npm install
   ```

2. **Use legacy peer deps:**

   ```bash
   npm install --legacy-peer-deps
   ```

3. **Check Node.js version:**
   ```bash
   node --version  # Must be >= 18.0.0
   nvm use 18      # Switch to Node 18 if using nvm
   ```

### Problem: Module not found errors

**Symptoms:**

```
Error: Cannot find module 'ai-workflow'
```

**Solutions:**

1. **Verify installation:**

   ```bash
   npm list ai-workflow
   ```

2. **Reinstall package:**

   ```bash
   npm uninstall ai-workflow
   npm install ai-workflow
   ```

3. **Check import paths:**

   ```javascript
   // ✅ Correct
   import { Config } from 'ai-workflow';

   // ❌ Incorrect
   import { Config } from './ai-workflow';
   ```

### Problem: Permission errors on install

**Symptoms:**

```
npm ERR! Error: EACCES: permission denied
```

**Solutions:**

1. **Use user-level install (recommended):**

   ```bash
   npm config set prefix ~/.npm-global
   export PATH=~/.npm-global/bin:$PATH
   npm install -g ai-workflow
   ```

2. **Fix ownership:**
   ```bash
   sudo chown -R $USER:$GROUP ~/.npm
   sudo chown -R $USER:$GROUP /usr/local/lib/node_modules
   ```

## Configuration Problems

### Problem: Configuration file not found

**Symptoms:**

```
WorkflowError: Configuration file not found: .workflow-config.yaml
```

**Solutions:**

1. **Create from template:**

   ```bash
   cp .workflow_core/config/.workflow-config.yaml.template .workflow-config.yaml
   ```

2. **Check file location:**

   ```bash
   pwd  # Should be project root
   ls -la .workflow-config.yaml
   ```

3. **Specify custom path:**
   ```javascript
   const config = new Config();
   await config.load('./config/workflow.yaml');
   ```

### Problem: Invalid YAML syntax

**Symptoms:**

```
YAMLException: bad indentation
```

**Solutions:**

1. **Validate YAML online:** Use https://www.yamllint.com/

2. **Check indentation:**

   ```yaml
   # ✅ Correct (2 spaces)
   workflow:
     name: "My Project"
     steps:
       - step_01

   # ❌ Incorrect (tabs or inconsistent spacing)
   workflow:
   	name: "My Project"  # Tab character
      steps:             # 4 spaces
       - step_01         # 1 space
   ```

3. **Quote special characters:**

   ```yaml
   # ✅ Correct
   name: "Project: AI Workflow"

   # ❌ Incorrect (unquoted colon)
   name: Project: AI Workflow
   ```

### Problem: Invalid configuration values

**Symptoms:**

```
ValidationError: Invalid value for 'workflow.steps'
```

**Solutions:**

1. **Check required fields:**

   ```yaml
   workflow:
     name: '{{PROJECT_NAME}}' # Required
     version: '1.0.0' # Required
     primary_language: 'javascript' # Required
   ```

2. **Validate step names:**

   ```yaml
   # ✅ Valid step names
   steps:
     - step_00
     - step_01
     - step_02

   # ❌ Invalid step names
   steps:
     - custom_step  # Not a registered step
   ```

3. **Check data types:**

   ```yaml
   # ✅ Correct types
   parallel:
     enabled: true           # boolean
     max_concurrency: 4      # number
     strategy: "BALANCED"    # string

   # ❌ Incorrect types
   parallel:
     enabled: "true"         # string instead of boolean
     max_concurrency: "4"    # string instead of number
   ```

## Workflow Execution Errors

### Problem: Workflow fails immediately

**Symptoms:**

```
WorkflowError: Workflow execution failed at step initialization
```

**Solutions:**

1. **Check Git repository:**

   ```bash
   git status  # Should show repository status
   git log -1  # Should show recent commit
   ```

2. **Verify directories:**

   ```bash
   mkdir -p .ai_workflow/{backlog,summaries,logs,metrics,checkpoints,prompts}
   ```

3. **Check permissions:**
   ```bash
   chmod -R u+rw .ai_workflow/
   ```

### Problem: Step execution timeout

**Symptoms:**

```
TimeoutError: Step execution exceeded timeout of 300000ms
```

**Solutions:**

1. **Increase timeout in config:**

   ```yaml
   steps:
     step_01:
       timeout: 600000 # 10 minutes
   ```

2. **Check system resources:**

   ```bash
   # CPU usage
   top

   # Memory usage
   free -h

   # Disk space
   df -h
   ```

3. **Reduce concurrency:**
   ```yaml
   parallel:
     max_concurrency: 2 # Lower from 4
   ```

### Problem: Step dependencies not resolved

**Symptoms:**

```
DependencyError: Circular dependency detected: step_01 -> step_02 -> step_01
```

**Solutions:**

1. **Review dependency chain:**

   ```javascript
   import { DependencyResolver } from 'ai-workflow';

   const resolver = new DependencyResolver();
   const graph = resolver.buildDependencyGraph(steps);
   console.log('Dependencies:', graph);
   ```

2. **Check step configuration:**

   ```yaml
   # ❌ Circular dependency
   steps:
     step_01:
       depends_on: [step_02]
     step_02:
       depends_on: [step_01]

   # ✅ Valid dependency
   steps:
     step_01:
       depends_on: []
     step_02:
       depends_on: [step_01]
   ```

3. **Remove unnecessary dependencies:**
   ```yaml
   # Only specify direct dependencies
   steps:
     step_03:
       depends_on: [step_02] # Don't need step_01, it's transitive
   ```

## Performance Issues

### Problem: Slow execution times

**Symptoms:**

- Step 01 takes > 5 minutes
- Parallel execution slower than sequential

**Solutions:**

1. **Enable incremental mode:**

   ```yaml
   steps:
     step_01:
       incremental: true
   ```

2. **Optimize concurrency:**

   ```yaml
   parallel:
     enabled: true
     max_concurrency: 4 # Adjust based on CPU cores
     strategy: 'BALANCED'
   ```

3. **Enable caching:**

   ```yaml
   ai:
     cache:
       enabled: true
       ttl: 3600000 # 1 hour
   ```

4. **Profile execution:**

   ```javascript
   import { MetricsCollector } from 'ai-workflow';

   const metrics = new MetricsCollector();
   metrics.startTimer('workflow');

   // Run workflow
   await workflow.execute();

   const stats = metrics.stopTimer('workflow');
   console.log('Duration:', stats.duration);
   ```

### Problem: High memory usage

**Symptoms:**

```
JavaScript heap out of memory
```

**Solutions:**

1. **Increase Node.js heap size:**

   ```bash
   export NODE_OPTIONS="--max-old-space-size=4096"
   node your-script.js
   ```

2. **Reduce batch sizes:**

   ```yaml
   parallel:
     max_concurrency: 2
     batch_size: 10
   ```

3. **Clear caches:**
   ```bash
   rm -rf .ai_workflow/.cache/
   rm -rf .test-cache/
   ```

## Git Integration Problems

### Problem: Git commands fail

**Symptoms:**

```
GitError: fatal: not a git repository
```

**Solutions:**

1. **Initialize repository:**

   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   ```

2. **Check Git configuration:**

   ```bash
   git config --list
   git config user.name "Your Name"
   git config user.email "you@example.com"
   ```

3. **Verify Git path:**
   ```bash
   which git
   git --version
   ```

### Problem: Large diff causes timeout

**Symptoms:**

```
TimeoutError: Git diff operation timeout
```

**Solutions:**

1. **Limit diff scope:**

   ```javascript
   const git = new GitAutomation();
   const diff = await git.diff({
     maxFiles: 100,
     maxLineLength: 1000,
   });
   ```

2. **Use cached diff:**
   ```javascript
   const gitCache = new GitCache({ ttl: 300000 }); // 5 minutes
   const diff = await gitCache.getDiff();
   ```

## AI Integration Issues

### Problem: AI API rate limits

**Symptoms:**

```
AIError: Rate limit exceeded (429)
```

**Solutions:**

1. **Enable caching:**

   ```yaml
   ai:
     cache:
       enabled: true
       ttl: 7200000 # 2 hours
   ```

2. **Reduce concurrent requests:**

   ```yaml
   ai:
     max_concurrent_requests: 2
     retry_delay: 5000
   ```

3. **Use retry logic:**

   ```javascript
   import { AiHelper } from 'ai-workflow';

   const helper = new AiHelper({
     maxRetries: 3,
     retryDelay: 5000,
     backoffMultiplier: 2,
   });
   ```

### Problem: Invalid AI responses

**Symptoms:**

```
ValidationError: AI response validation failed
```

**Solutions:**

1. **Check response format:**

   ```javascript
   import { validateAiResponse } from 'ai-workflow';

   const isValid = validateAiResponse(response, {
     requireConfidence: true,
     minConfidence: 0.7,
   });
   ```

2. **Adjust validation rules:**

   ```yaml
   ai:
     validation:
       require_confidence: true
       min_confidence: 0.6 # Lower threshold
   ```

3. **Enable verbose logging:**
   ```javascript
   logger.setLevel('debug');
   const result = await aiHelper.query(prompt);
   ```

## Testing Problems

### Problem: Tests fail in CI but pass locally

**Symptoms:**

- All tests pass locally
- CI shows multiple failures

**Solutions:**

1. **Check environment variables:**

   ```bash
   # Local
   env | grep NODE_ENV

   # CI (add to .github/workflows/)
   env:
     NODE_ENV: test
     CI: true
   ```

2. **Use consistent Node versions:**

   ```yaml
   # .github/workflows/test.yml
   - uses: actions/setup-node@v3
     with:
       node-version: '18.x'
   ```

3. **Increase timeouts:**
   ```javascript
   // jest.config.json
   {
     "testTimeout": 30000  // 30 seconds
   }
   ```

### Problem: Test coverage below threshold

**Symptoms:**

```
Coverage threshold not met: 85% < 90%
```

**Solutions:**

1. **Check coverage report:**

   ```bash
   npm test -- --coverage
   open coverage/lcov-report/index.html
   ```

2. **Add missing tests:**

   ```javascript
   // Focus on untested branches
   describe('Error handling', () => {
     test('handles network errors', async () => {
       // Test error path
     });
   });
   ```

3. **Exclude generated files:**
   ```javascript
   // jest.config.json
   {
     "coveragePathIgnorePatterns": [
       "/node_modules/",
       "/test/",
       "/coverage/"
     ]
   }
   ```

## Getting Help

### Check Documentation

1. **API Reference:** `docs/api/`
2. **User Guide:** `docs/guides/USER_GUIDE.md`
3. **Developer Guide:** `docs/guides/DEVELOPER_GUIDE.md`
4. **Architecture:** `docs/architecture/`

### Enable Debug Logging

```javascript
import logger from 'ai-workflow';

// Enable debug mode
logger.setLevel('debug');

// Enable verbose error messages
process.env.DEBUG = 'ai-workflow:*';
```

### Check Issue Tracker

1. Search existing issues: https://github.com/mpbarbosa/ai_workflow.js/issues
2. Create new issue with:
   - Node.js version
   - npm version
   - Configuration file (sanitized)
   - Full error message
   - Steps to reproduce

### Common Error Codes

| Code           | Meaning                      | Solution                       |
| -------------- | ---------------------------- | ------------------------------ |
| `CONFIG_001`   | Configuration file not found | Create `.workflow-config.yaml` |
| `CONFIG_002`   | Invalid YAML syntax          | Validate YAML formatting       |
| `GIT_001`      | Not a Git repository         | Run `git init`                 |
| `GIT_002`      | Git command failed           | Check Git installation         |
| `WORKFLOW_001` | Step execution failed        | Check step configuration       |
| `WORKFLOW_002` | Dependency error             | Review step dependencies       |
| `AI_001`       | AI API error                 | Check API key and rate limits  |
| `AI_002`       | Response validation failed   | Review prompt and response     |

### Report a Bug

When reporting a bug, include:

```bash
# System information
node --version
npm --version
git --version
uname -a

# Package version
npm list ai-workflow

# Error output (with stack trace)
npm test 2>&1 | tee error.log

# Configuration (sanitized - remove secrets!)
cat .workflow-config.yaml
```

---

**See Also:**

- [User Guide](USER_GUIDE.md)
- [Configuration Guide](CONFIGURATION_GUIDE.md)
- [Testing Guide](TESTING_GUIDE.md)
- [Error Codes Reference](../reference/ERROR_CODES.md)
