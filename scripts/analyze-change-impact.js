#!/usr/bin/env node
/**
 * Change Impact Analyzer
 *
 * Analyzes git changes and determines which test steps should run.
 * Implements file pattern matching and change impact scoring.
 *
 * Usage: node scripts/analyze-change-impact.js
 * Output: JSON with conditional execution decisions
 *
 * Exit codes: 0 = always, script outputs JSON for CI to parse
 */

import { execSync } from 'child_process';

// ANSI colors
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

/**
 * File pattern rules for conditional execution
 */
const STEP_PATTERNS = {
  'unit-tests': {
    description: 'Unit tests (fast)',
    patterns: ['src/**/*.js', 'test/lib/**/*.test.js', 'package.json', 'jest.config.json'],
    impactLevel: 'high',
  },
  'integration-tests': {
    description: 'Integration tests (slow)',
    patterns: ['src/orchestrator/**/*.js', 'test/orchestrator/**/*.test.js', 'src/index.js'],
    impactLevel: 'high',
  },
  linting: {
    description: 'Linting checks',
    patterns: ['**/*.js', '**/*.mjs', 'eslint.config.mjs', '.eslintrc.*'],
    impactLevel: 'low',
  },
  documentation: {
    description: 'Documentation',
    patterns: ['**/*.md', 'docs/**/*', 'README.md', 'CHANGELOG.md'],
    impactLevel: 'low',
  },
  'ci-config': {
    description: 'CI/CD configuration',
    patterns: ['.github/**/*', '.husky/**/*', 'package.json'],
    impactLevel: 'medium',
  },
};

/**
 * Change impact levels
 */
const IMPACT_LEVELS = {
  critical: 3,
  high: 2,
  medium: 1,
  low: 0,
};

/**
 * Get changed files from git
 */
function getChangedFiles() {
  try {
    // Try to get changed files vs main branch
    const output = execSync(
      'git diff --name-only origin/main...HEAD 2>/dev/null || git diff --name-only HEAD~1 2>/dev/null || git ls-files -m',
      {
        encoding: 'utf-8',
      }
    );
    return output.trim().split('\n').filter(Boolean);
  } catch {
    // Fallback: assume all files changed
    console.error(
      `${colors.yellow}⚠ Could not detect git changes, assuming all changed${colors.reset}`
    );
    return ['**/*'];
  }
}

/**
 * Match file against glob pattern (simple implementation)
 */
function matchPattern(file, pattern) {
  // Convert glob pattern to regex using placeholders to prevent double-replacement
  const regexPattern = pattern
    .replace(/\./g, '\\.')
    .replace(/\*\*\//g, '\x01')   // **/ → placeholder1 (optional intermediate dirs)
    .replace(/\*\*/g, '\x02')     // ** → placeholder2 (match across dirs)
    .replace(/\*/g, '[^/]*')      // * → match within a single dir segment
    .replace(/\?/g, '.')
    .replace(/\x01/g, '(.*/)?')   // restore **/ as optional path prefix
    .replace(/\x02/g, '.*');      // restore ** as cross-dir match

  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(file);
}

/**
 * Check if any files match the patterns
 */
function matchesAnyPattern(files, patterns) {
  return files.some((file) => patterns.some((pattern) => matchPattern(file, pattern)));
}

/**
 * Analyze change impact for each step
 */
function analyzeChangeImpact(changedFiles) {
  const results = {};
  let maxImpact = 'low';

  for (const [stepName, config] of Object.entries(STEP_PATTERNS)) {
    const matches = matchesAnyPattern(changedFiles, config.patterns);

    results[stepName] = {
      shouldRun: matches,
      description: config.description,
      impactLevel: config.impactLevel,
      matchedFiles: matches
        ? changedFiles.filter((file) =>
            config.patterns.some((pattern) => matchPattern(file, pattern))
          )
        : [],
    };

    // Track maximum impact level
    if (matches && IMPACT_LEVELS[config.impactLevel] > IMPACT_LEVELS[maxImpact]) {
      maxImpact = config.impactLevel;
    }
  }

  return { steps: results, maxImpact, totalFiles: changedFiles.length };
}

/**
 * Determine execution strategy
 */
function determineExecutionStrategy(analysis) {
  const { steps, maxImpact, totalFiles } = analysis;

  // Special cases
  if (totalFiles === 0) {
    return {
      strategy: 'skip-all',
      reason: 'No files changed',
      steps: {},
    };
  }

  if (totalFiles > 100) {
    return {
      strategy: 'run-all',
      reason: 'Large changeset (>100 files)',
      steps: Object.fromEntries(Object.keys(steps).map((key) => [key, { shouldRun: true }])),
    };
  }

  // Documentation-only changes
  const onlyDocs =
    steps['documentation'].shouldRun &&
    !steps['unit-tests'].shouldRun &&
    !steps['integration-tests'].shouldRun;

  if (onlyDocs) {
    return {
      strategy: 'docs-only',
      reason: 'Documentation changes only',
      steps: {
        'unit-tests': { shouldRun: false, reason: 'No code changes' },
        'integration-tests': { shouldRun: false, reason: 'No code changes' },
        linting: { shouldRun: false, reason: 'No code changes' },
        documentation: { shouldRun: true },
      },
    };
  }

  // CI config changes - run everything
  if (steps['ci-config'].shouldRun) {
    return {
      strategy: 'run-all',
      reason: 'CI/CD configuration changed',
      steps: Object.fromEntries(Object.keys(steps).map((key) => [key, { shouldRun: true }])),
    };
  }

  // Unit tests only
  const onlyUnit = steps['unit-tests'].shouldRun && !steps['integration-tests'].shouldRun;

  if (onlyUnit) {
    return {
      strategy: 'unit-only',
      reason: 'Unit test code changes only',
      steps: {
        'unit-tests': { shouldRun: true },
        'integration-tests': { shouldRun: false, reason: 'No orchestrator changes' },
        linting: { shouldRun: true },
        documentation: { shouldRun: steps['documentation'].shouldRun },
      },
    };
  }

  // Default: run based on detected changes
  return {
    strategy: 'selective',
    reason: `Running steps based on change impact (${maxImpact})`,
    steps: Object.fromEntries(
      Object.entries(steps).map(([key, value]) => [
        key,
        {
          shouldRun: value.shouldRun,
          reason: value.shouldRun ? 'Files changed' : 'No relevant changes',
        },
      ])
    ),
  };
}

/**
 * Main analysis
 */
function main() {
  const args = process.argv.slice(2);
  const verbose = args.includes('--verbose');
  const jsonOnly = args.includes('--json');

  if (!jsonOnly) {
    console.log(`${colors.cyan}🔍 Change Impact Analysis${colors.reset}\n`);
  }

  // Get changed files
  const changedFiles = getChangedFiles();

  if (!jsonOnly && verbose) {
    console.log(`${colors.gray}Changed files (${changedFiles.length}):${colors.reset}`);
    changedFiles.slice(0, 10).forEach((file) => {
      console.log(`  ${colors.gray}${file}${colors.reset}`);
    });
    if (changedFiles.length > 10) {
      console.log(`  ${colors.gray}... and ${changedFiles.length - 10} more${colors.reset}`);
    }
    console.log();
  }

  // Analyze impact
  const analysis = analyzeChangeImpact(changedFiles);
  const strategy = determineExecutionStrategy(analysis);

  // Output results
  if (jsonOnly) {
    console.log(JSON.stringify(strategy, null, 2));
  } else {
    console.log(`${colors.yellow}Strategy:${colors.reset} ${strategy.strategy}`);
    console.log(`${colors.yellow}Reason:${colors.reset} ${strategy.reason}\n`);

    console.log('📋 Step Execution Plan:\n');

    for (const [stepName, decision] of Object.entries(strategy.steps)) {
      const icon = decision.shouldRun ? '✓' : '⊘';
      const color = decision.shouldRun ? colors.green : colors.gray;
      const status = decision.shouldRun ? 'RUN' : 'SKIP';

      console.log(`${color}${icon} ${stepName.padEnd(20)} [${status}]${colors.reset}`);

      if (decision.reason && verbose) {
        console.log(`  ${colors.gray}Reason: ${decision.reason}${colors.reset}`);
      }

      // Show matched files in verbose mode
      if (verbose && analysis.steps[stepName]?.matchedFiles?.length > 0) {
        const matched = analysis.steps[stepName].matchedFiles.slice(0, 3);
        console.log(`  ${colors.gray}Matched: ${matched.join(', ')}${colors.reset}`);
      }
    }

    console.log();
    console.log('='.repeat(60));

    // Summary
    const runningSteps = Object.values(strategy.steps).filter((s) => s.shouldRun).length;
    const totalSteps = Object.keys(strategy.steps).length;

    console.log(
      `${colors.cyan}Running ${runningSteps}/${totalSteps} steps based on change impact${colors.reset}`
    );

    // Export environment variables for CI
    if (!process.env.GITHUB_ACTIONS) {
      console.log(`\n${colors.gray}To use in CI/CD, run with --json flag${colors.reset}`);
    }
  }

  process.exit(0);
}

// Run analysis
if (process.argv[1] && process.argv[1].endsWith('analyze-change-impact.js')) {
  main();
}

export { matchPattern, matchesAnyPattern, analyzeChangeImpact, determineExecutionStrategy, STEP_PATTERNS, IMPACT_LEVELS };
