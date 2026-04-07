# First Workflow Tutorial

**Version:** 1.9.6
**Last Updated:** February 1, 2026

Build your first workflow from scratch using ai_workflow.js! This tutorial walks you through creating a complete project analysis workflow that detects project type, analyzes tech stack, and generates a report.

---

## Table of Contents

- [What You'll Build](#what-youll-build)
- [Prerequisites](#prerequisites)
- [Project Setup](#project-setup)
- [Step 1: Project Structure](#step-1-project-structure)
- [Step 2: Basic Logging](#step-2-basic-logging)
- [Step 3: Configuration Management](#step-3-configuration-management)
- [Step 4: Project Detection](#step-4-project-detection)
- [Step 5: Tech Stack Analysis](#step-5-tech-stack-analysis)
- [Step 6: File Exclusion](#step-6-file-exclusion)
- [Step 7: Report Generation](#step-7-report-generation)
- [Step 8: Error Handling](#step-8-error-handling)
- [Complete Workflow](#complete-workflow)
- [Running the Workflow](#running-the-workflow)
- [Enhancements](#enhancements)
- [Next Steps](#next-steps)

---

## What You'll Build

A **Project Analyzer** workflow that:

✅ Detects project type (Node.js, Python, React, etc.)
✅ Analyzes tech stack (languages, frameworks, build systems)
✅ Excludes third-party files (node_modules, .git, etc.)
✅ Generates a comprehensive project report
✅ Handles errors gracefully
✅ Provides colored, user-friendly output

**Estimated time:** 20-30 minutes

---

## Prerequisites

- ✅ ai_workflow.js installed ([Installation Guide](./INSTALLATION.md))
- ✅ Node.js 18+ and npm 9+
- ✅ Basic JavaScript/Node.js knowledge
- ✅ A project to analyze (or use ai_workflow.js itself)

---

## Project Setup

### 1. Create a New Project

```bash
# Create project directory
mkdir my-first-workflow
cd my-first-workflow

# Initialize npm project
npm init -y

# Set type to module (for ES modules)
npm pkg set type=module
```

### 2. Install ai_workflow.js

```bash
# If using as npm package (future)
npm install ai-workflow

# Or link to local development version
npm link /path/to/ai_workflow.js
```

### 3. Create Project Structure

```bash
mkdir -p src
touch src/workflow.js
touch src/index.js
```

Your structure should look like:

```
my-first-workflow/
├── package.json
├── src/
│   ├── index.js      # Entry point
│   └── workflow.js   # Workflow logic
└── node_modules/
```

---

## Step 1: Project Structure

Create the main entry point.

**File:** `src/index.js`

```javascript
#!/usr/bin/env node

/**
 * Project Analyzer - Main Entry Point
 * Analyzes a project and generates a report
 */

import { Logger } from 'ai-workflow';
import { runWorkflow } from './workflow.js';

// Create logger
const logger = new Logger({ level: 'info' });

// Get target directory from command line
const targetDir = process.argv[2] || process.cwd();

// Welcome message
logger.info('═══════════════════════════════════════');
logger.info('  Project Analyzer v1.0.0');
logger.info('═══════════════════════════════════════');
logger.info('');

// Run workflow
runWorkflow(targetDir)
  .then(() => {
    logger.success('✓ Analysis complete!');
    process.exit(0);
  })
  .catch((error) => {
    logger.error(`✗ Analysis failed: ${error.message}`);
    process.exit(1);
  });
```

**Explanation:**

- Import Logger for colored output
- Get target directory from CLI argument (defaults to current directory)
- Run workflow and handle success/failure

---

## Step 2: Basic Logging

Set up logging utilities.

**File:** `src/workflow.js`

```javascript
/**
 * Project Analyzer Workflow
 */

import { Logger } from 'ai-workflow';

// Create logger instance
const logger = new Logger({ level: 'info' });

/**
 * Main workflow function
 */
export async function runWorkflow(projectPath) {
  logger.info(`Analyzing project: ${projectPath}`);
  logger.info('');

  // Workflow steps will go here

  logger.info('');
  logger.info('Analysis complete!');
}
```

**Test it:**

```bash
# Make executable
chmod +x src/index.js

# Run workflow
node src/index.js .
```

**Expected output:**

```
═══════════════════════════════════════
  Project Analyzer v1.0.0
═══════════════════════════════════════

Analyzing project: /path/to/project

Analysis complete!
✓ Analysis complete!
```

---

## Step 3: Configuration Management

Add configuration loading.

**Update:** `src/workflow.js`

```javascript
import { Logger, Config } from 'ai-workflow';
import path from 'path';

const logger = new Logger({ level: 'info' });

export async function runWorkflow(projectPath) {
  logger.info(`Analyzing project: ${projectPath}`);
  logger.info('');

  // Step 1: Load configuration
  logger.info('Step 1: Loading configuration...');
  const config = await loadConfiguration(projectPath);

  if (config) {
    logger.success(`  ✓ Configuration loaded: ${config.get('project.name')}`);
  } else {
    logger.warn('  ⚠ No configuration file found, using defaults');
  }
  logger.info('');

  logger.info('Analysis complete!');
}

/**
 * Load project configuration
 */
async function loadConfiguration(projectPath) {
  const configManager = new Config();
  const configPath = path.join(projectPath, '.workflow-config.yaml');

  try {
    await configManager.loadConfig(configPath);
    return configManager;
  } catch (error) {
    // Config file doesn't exist, return null
    return null;
  }
}
```

**Test it:**

```bash
# Create a test config
cat > .workflow-config.yaml << 'EOF'
project:
  name: 'my-project'
  type: 'nodejs-application'
  version: '1.0.0'
EOF

# Run workflow
node src/index.js .
```

---

## Step 4: Project Detection

Add automatic project type detection.

**Update:** `src/workflow.js`

```javascript
import { Logger, Config, ProjectKindDetector } from 'ai-workflow';
import path from 'path';

const logger = new Logger({ level: 'info' });

export async function runWorkflow(projectPath) {
  logger.info(`Analyzing project: ${projectPath}`);
  logger.info('');

  // Step 1: Load configuration
  logger.info('Step 1: Loading configuration...');
  const config = await loadConfiguration(projectPath);
  logger.info('');

  // Step 2: Detect project type
  logger.info('Step 2: Detecting project type...');
  const projectKind = await detectProjectKind(projectPath);
  logger.success(`  ✓ Detected: ${projectKind.kind} (${projectKind.confidence}% confidence)`);

  if (projectKind.indicators.length > 0) {
    logger.info('  Indicators found:');
    projectKind.indicators.slice(0, 5).forEach((indicator) => {
      logger.info(`    • ${indicator.type}: ${indicator.value}`);
    });
  }
  logger.info('');

  logger.info('Analysis complete!');
}

async function loadConfiguration(projectPath) {
  const configManager = new Config();
  const configPath = path.join(projectPath, '.workflow-config.yaml');

  try {
    await configManager.loadConfig(configPath);
    logger.success(`  ✓ Configuration loaded: ${configManager.get('project.name')}`);
    return configManager;
  } catch (error) {
    logger.warn('  ⚠ No configuration file found');
    return null;
  }
}

/**
 * Detect project kind
 */
async function detectProjectKind(projectPath) {
  const detector = new ProjectKindDetector({ projectRoot: projectPath });
  return await detector.detectProjectKind();
}
```

**Test it:**

```bash
# Test on ai_workflow.js itself
node src/index.js /path/to/ai_workflow.js

# Or test on current directory
node src/index.js .
```

**Expected output:**

```
Step 2: Detecting project type...
  ✓ Detected: nodejs_api (95% confidence)
  Indicators found:
    • package.json: dependencies found
    • file_pattern: 25 .js files
    • directory_structure: src/ found
    • directory_structure: test/ found
```

---

## Step 5: Tech Stack Analysis

Add tech stack detection.

**Update:** `src/workflow.js` (add after Step 2)

```javascript
import { Logger, Config, ProjectKindDetector, TechStackDetector } from 'ai-workflow';

// ... existing code ...

export async function runWorkflow(projectPath) {
  // ... Steps 1 & 2 ...

  // Step 3: Analyze tech stack
  logger.info('Step 3: Analyzing tech stack...');
  const techStack = await analyzeTechStack(projectPath);

  logger.success('  ✓ Tech stack detected:');
  logger.info(`    Languages: ${techStack.languages.join(', ') || 'none'}`);
  logger.info(`    Frameworks: ${techStack.frameworks.join(', ') || 'none'}`);
  logger.info(`    Build system: ${techStack.buildSystem || 'none'}`);
  logger.info(`    Test framework: ${techStack.testFramework || 'none'}`);
  logger.info(`    Linters: ${techStack.linters.join(', ') || 'none'}`);
  logger.info('');

  logger.info('Analysis complete!');
}

/**
 * Analyze tech stack
 */
async function analyzeTechStack(projectPath) {
  const detector = new TechStackDetector({ projectRoot: projectPath });
  return await detector.detectTechStack();
}
```

**Test it:**

```bash
node src/index.js /path/to/ai_workflow.js
```

**Expected output:**

```
Step 3: Analyzing tech stack...
  ✓ Tech stack detected:
    Languages: javascript
    Frameworks: jest
    Build system: npm
    Test framework: jest
    Linters: eslint, prettier
```

---

## Step 6: File Exclusion

Add third-party file filtering.

**Update:** `src/workflow.js` (add after Step 3)

```javascript
import {
  Logger,
  Config,
  ProjectKindDetector,
  TechStackDetector,
  ThirdPartyExclusionManager,
} from 'ai-workflow';

// ... existing code ...

export async function runWorkflow(projectPath) {
  // ... Steps 1-3 ...

  // Step 4: Analyze file structure
  logger.info('Step 4: Analyzing file structure...');
  const exclusionStats = await analyzeFileStructure(projectPath, projectKind.kind);

  logger.success('  ✓ File analysis complete:');
  logger.info(`    Total files: ${exclusionStats.total}`);
  logger.info(`    Included: ${exclusionStats.included} (${exclusionStats.includedPercent}%)`);
  logger.info(`    Excluded: ${exclusionStats.excluded} (${exclusionStats.excludedPercent}%)`);

  if (exclusionStats.topPatterns.length > 0) {
    logger.info('    Top exclusion patterns:');
    exclusionStats.topPatterns.slice(0, 3).forEach((pattern) => {
      logger.info(`      • ${pattern.pattern}: ${pattern.count} files`);
    });
  }
  logger.info('');

  logger.info('Analysis complete!');
}

/**
 * Analyze file structure with exclusions
 */
async function analyzeFileStructure(projectPath, projectKind) {
  const exclusion = new ThirdPartyExclusionManager({
    projectRoot: projectPath,
    projectKind: projectKind,
  });

  // Initialize with default patterns + .gitignore
  await exclusion.initialize();

  // Get all files
  const allFiles = await exclusion.fileOps.listDirectoryRecursive(projectPath);

  // Filter files
  const result = exclusion.filterFiles(allFiles);

  // Calculate statistics
  const total = result.included.length + result.excluded.length;
  const includedPercent = ((result.included.length / total) * 100).toFixed(1);
  const excludedPercent = ((result.excluded.length / total) * 100).toFixed(1);

  // Count patterns
  const patternCounts = {};
  result.excluded.forEach((item) => {
    const pattern = item.pattern || 'unknown';
    patternCounts[pattern] = (patternCounts[pattern] || 0) + 1;
  });

  // Sort patterns by count
  const topPatterns = Object.entries(patternCounts)
    .map(([pattern, count]) => ({ pattern, count }))
    .sort((a, b) => b.count - a.count);

  return {
    total,
    included: result.included.length,
    excluded: result.excluded.length,
    includedPercent,
    excludedPercent,
    topPatterns,
  };
}
```

---

## Step 7: Report Generation

Add comprehensive report generation.

**Update:** `src/workflow.js` (add at end)

```javascript
// ... existing imports ...

export async function runWorkflow(projectPath) {
  // ... Steps 1-4 ...

  // Step 5: Generate report
  logger.info('Step 5: Generating report...');
  await generateReport(projectPath, {
    config,
    projectKind,
    techStack,
    exclusionStats,
  });
  logger.success('  ✓ Report saved to project-analysis.md');
  logger.info('');

  logger.info('Analysis complete!');
}

/**
 * Generate analysis report
 */
async function generateReport(projectPath, data) {
  const { FileOperations } = await import('ai-workflow');
  const fileOps = new FileOperations();

  const report = `# Project Analysis Report

**Generated:** ${new Date().toISOString()}
**Project Path:** ${projectPath}

---

## Project Information

${
  data.config
    ? `
- **Name:** ${data.config.get('project.name')}
- **Type:** ${data.config.get('project.type')}
- **Version:** ${data.config.get('project.version')}
`
    : '- Configuration not found'
}

## Project Detection

- **Detected Kind:** ${data.projectKind.kind}
- **Confidence:** ${data.projectKind.confidence}%
- **Indicators:** ${data.projectKind.indicators.length} found

### Key Indicators

${data.projectKind.indicators
  .slice(0, 10)
  .map((ind) => `- **${ind.type}:** ${ind.value} (confidence: ${ind.confidence}%)`)
  .join('\n')}

## Tech Stack

### Languages
${data.techStack.languages.map((lang) => `- ${lang}`).join('\n') || '- None detected'}

### Frameworks
${data.techStack.frameworks.map((fw) => `- ${fw}`).join('\n') || '- None detected'}

### Build & Tools

- **Build System:** ${data.techStack.buildSystem || 'none'}
- **Test Framework:** ${data.techStack.testFramework || 'none'}
- **Linters:** ${data.techStack.linters.join(', ') || 'none'}

## File Structure

- **Total Files:** ${data.exclusionStats.total}
- **Included:** ${data.exclusionStats.included} (${data.exclusionStats.includedPercent}%)
- **Excluded:** ${data.exclusionStats.excluded} (${data.exclusionStats.excludedPercent}%)

### Top Exclusion Patterns

${data.exclusionStats.topPatterns
  .slice(0, 5)
  .map((p) => `- **${p.pattern}:** ${p.count} files`)
  .join('\n')}

---

*Generated by ai_workflow.js Project Analyzer v1.0.0*
`;

  const reportPath = path.join(projectPath, 'project-analysis.md');
  await fileOps.writeFile(reportPath, report);
}
```

---

## Step 8: Error Handling

Add comprehensive error handling.

**Update:** `src/workflow.js`

```javascript
export async function runWorkflow(projectPath) {
  try {
    logger.info(`Analyzing project: ${projectPath}`);
    logger.info('');

    // Validate project path exists
    const { FileOperations } = await import('ai-workflow');
    const fileOps = new FileOperations();
    const exists = await fileOps.exists(projectPath);

    if (!exists) {
      throw new Error(`Project path does not exist: ${projectPath}`);
    }

    // Step 1: Load configuration
    logger.info('Step 1: Loading configuration...');
    const config = await safeLoadConfiguration(projectPath);
    logger.info('');

    // Step 2: Detect project type
    logger.info('Step 2: Detecting project type...');
    const projectKind = await safeDetectProjectKind(projectPath);
    logger.info('');

    // Step 3: Analyze tech stack
    logger.info('Step 3: Analyzing tech stack...');
    const techStack = await safeAnalyzeTechStack(projectPath);
    logger.info('');

    // Step 4: Analyze file structure
    logger.info('Step 4: Analyzing file structure...');
    const exclusionStats = await safeAnalyzeFileStructure(projectPath, projectKind.kind);
    logger.info('');

    // Step 5: Generate report
    logger.info('Step 5: Generating report...');
    await generateReport(projectPath, {
      config,
      projectKind,
      techStack,
      exclusionStats,
    });
    logger.success('  ✓ Report saved to project-analysis.md');
    logger.info('');

    logger.info('Analysis complete!');
  } catch (error) {
    logger.error(`Workflow failed: ${error.message}`);
    throw error;
  }
}

// Safe wrapper functions with error handling

async function safeLoadConfiguration(projectPath) {
  try {
    return await loadConfiguration(projectPath);
  } catch (error) {
    logger.warn(`  ⚠ Configuration loading failed: ${error.message}`);
    return null;
  }
}

async function safeDetectProjectKind(projectPath) {
  try {
    const projectKind = await detectProjectKind(projectPath);
    logger.success(`  ✓ Detected: ${projectKind.kind} (${projectKind.confidence}% confidence)`);
    return projectKind;
  } catch (error) {
    logger.error(`  ✗ Project detection failed: ${error.message}`);
    // Return generic fallback
    return {
      kind: 'generic',
      confidence: 0,
      indicators: [],
    };
  }
}

async function safeAnalyzeTechStack(projectPath) {
  try {
    const techStack = await analyzeTechStack(projectPath);
    logger.success('  ✓ Tech stack detected');
    return techStack;
  } catch (error) {
    logger.error(`  ✗ Tech stack analysis failed: ${error.message}`);
    return {
      languages: [],
      frameworks: [],
      buildSystem: 'unknown',
      testFramework: 'unknown',
      linters: [],
    };
  }
}

async function safeAnalyzeFileStructure(projectPath, projectKind) {
  try {
    const stats = await analyzeFileStructure(projectPath, projectKind);
    logger.success('  ✓ File analysis complete');
    return stats;
  } catch (error) {
    logger.error(`  ✗ File analysis failed: ${error.message}`);
    return {
      total: 0,
      included: 0,
      excluded: 0,
      includedPercent: '0',
      excludedPercent: '0',
      topPatterns: [],
    };
  }
}
```

---

## Complete Workflow

**Full:** `src/workflow.js`

```javascript
/**
 * Project Analyzer Workflow - Complete Version
 * @version 1.0.0
 */

import {
  Logger,
  Config,
  ProjectKindDetector,
  TechStackDetector,
  ThirdPartyExclusionManager,
  FileOperations,
} from 'ai-workflow';
import path from 'path';

const logger = new Logger({ level: 'info' });
const fileOps = new FileOperations();

export async function runWorkflow(projectPath) {
  try {
    logger.info(`Analyzing project: ${projectPath}`);
    logger.info('');

    // Validate project path
    const exists = await fileOps.exists(projectPath);
    if (!exists) {
      throw new Error(`Project path does not exist: ${projectPath}`);
    }

    // Run analysis steps
    const config = await safeLoadConfiguration(projectPath);
    const projectKind = await safeDetectProjectKind(projectPath);
    const techStack = await safeAnalyzeTechStack(projectPath);
    const exclusionStats = await safeAnalyzeFileStructure(projectPath, projectKind.kind);

    // Generate report
    logger.info('Step 5: Generating report...');
    await generateReport(projectPath, { config, projectKind, techStack, exclusionStats });
    logger.success('  ✓ Report saved to project-analysis.md');
    logger.info('');

    logger.info('Analysis complete!');
  } catch (error) {
    logger.error(`Workflow failed: ${error.message}`);
    throw error;
  }
}

// ... rest of the implementation from previous steps ...
```

---

## Running the Workflow

### Basic Usage

```bash
# Analyze current directory
node src/index.js .

# Analyze specific project
node src/index.js /path/to/project

# Analyze ai_workflow.js itself
node src/index.js /path/to/ai_workflow.js
```

### Make it Executable

```bash
# Add shebang to index.js (already added in Step 1)
# Make executable
chmod +x src/index.js

# Create symlink (optional)
npm link

# Now you can run it anywhere
my-first-workflow /path/to/any/project
```

### Sample Output

```
═══════════════════════════════════════
  Project Analyzer v1.0.0
═══════════════════════════════════════

Analyzing project: /home/user/ai_workflow.js

Step 1: Loading configuration...
  ✓ Configuration loaded: ai_workflow.js

Step 2: Detecting project type...
  ✓ Detected: nodejs_api (95% confidence)
  Indicators found:
    • package.json: dependencies found
    • file_pattern: 35 .js files
    • directory_structure: src/ found
    • directory_structure: test/ found

Step 3: Analyzing tech stack...
  ✓ Tech stack detected:
    Languages: javascript
    Frameworks: jest
    Build system: npm
    Test framework: jest
    Linters: eslint, prettier

Step 4: Analyzing file structure...
  ✓ File analysis complete:
    Total files: 125
    Included: 85 (68.0%)
    Excluded: 40 (32.0%)
    Top exclusion patterns:
      • node_modules/**: 35 files
      • .git/**: 3 files
      • .ai_workflow/**: 2 files

Step 5: Generating report...
  ✓ Report saved to project-analysis.md

Analysis complete!
✓ Analysis complete!
```

---

## Enhancements

### Add CLI Arguments

```javascript
// src/index.js
import { ArgumentParser } from 'ai-workflow';

const parser = new ArgumentParser({
  name: 'project-analyzer',
  version: '1.0.0',
  description: 'Analyze project structure and tech stack',
});

parser.addOption('--output', {
  type: 'string',
  description: 'Output file path',
  default: 'project-analysis.md',
});

parser.addOption('--verbose', {
  type: 'boolean',
  description: 'Enable verbose output',
  default: false,
});

const args = parser.parse(process.argv.slice(2));
const targetDir = args._[0] || process.cwd();

// Use args.output and args.verbose in workflow
```

### Add Progress Indicators

```javascript
// Show progress
logger.info('Step 2: Detecting project type...');
logger.dim('  [1/5] Analyzing package.json...');
// ... do work ...
logger.dim('  [2/5] Analyzing file patterns...');
// ... do work ...
```

### Add JSON Output

```javascript
// Add --json flag
if (args.json) {
  const result = {
    projectKind,
    techStack,
    exclusionStats,
  };
  console.log(JSON.stringify(result, null, 2));
} else {
  // Regular output
}
```

### Add Metrics Collection

```javascript
import { Metrics } from 'ai-workflow';

const metrics = new Metrics();
const opId = metrics.startOperation('project-analysis');

// ... run workflow ...

metrics.endOperation(opId, { success: true });
const summary = metrics.getSummary();
logger.info(`Analysis took ${summary.totalTime}ms`);
```

---

## Next Steps

### Learn More

1. **[API Reference](../api/README.md)** - Explore all available modules
2. **[User Guide](../guides/USER_GUIDE.md)** - Advanced usage patterns
3. **[Configuration Guide](../guides/CONFIGURATION_GUIDE.md)** - Configure your workflows

### Build More Workflows

- **Code Quality Analyzer** - Lint, format, and test analysis
- **Dependency Scanner** - Detect outdated or vulnerable dependencies
- **Documentation Generator** - Auto-generate project documentation
- **CI/CD Pipeline** - Automated testing and deployment

### Contribute

- **[Developer Guide](../guides/DEVELOPER_GUIDE.md)** - Contributing guidelines
- **[GitHub Issues](https://github.com/mpbarbosa/ai_workflow.js/issues)** - Report bugs or request features

---

**Congratulations!** 🎉 You've built your first workflow with ai_workflow.js!

Ready to build more? Check out the [Examples](../examples/) directory for more workflow ideas.
