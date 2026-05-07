/**
 * @fileoverview Preflight quality runner and workflow health helpers
 * @module orchestrator/preflight_quality_runner
 */

import fs from 'fs/promises';
import path from 'path';
import executorModule from '../core/executor.js';

export const HEALTH_CHECK_CATEGORIES = Object.freeze({
  ENVIRONMENT: 'environment',
  CONFIGURATION: 'configuration',
  PREFLIGHT: 'preflight',
  FILESYSTEM: 'filesystem',
});

const PRE_FLIGHT_QUALITY_SCRIPT_ORDER = Object.freeze(['lint', 'test', 'build']);
const PRE_FLIGHT_COMMAND_TIMEOUT_MS = 15 * 60 * 1000;
const PRE_FLIGHT_FAILURE_OUTPUT_TAIL_LINES = 20;
const PRE_FLIGHT_GIT_STASH_COMMAND = 'git stash list';
const PRE_FLIGHT_GIT_STASH_CHECK_NAME = 'git-stash';
const OS_ERROR_PATTERN = /EACCES|ENOENT|EPERM|EBUSY|EMFILE|permission denied/i;
const NOT_A_GIT_REPOSITORY_PATTERN = /not a git repository/i;
const TEST_RESULT_LINE_PATTERNS = [
  /^Test Suites:/i,
  /^Tests?:/i,
  /^\d+\s+(?:passed|failed|skipped|todo|total)(?:,\s*\d+\s+(?:passed|failed|skipped|todo|total))+$/i,
  /^[✓✗]/,
];

function buildPackageScriptCommand(packageManager, scriptName) {
  switch (packageManager) {
    case 'yarn':
      return `yarn ${scriptName}`;
    case 'pnpm':
      return scriptName === 'test' ? 'pnpm test' : `pnpm run ${scriptName}`;
    case 'bun':
      return `bun run ${scriptName}`;
    case 'npm':
    default:
      return scriptName === 'test' ? 'npm test' : `npm run ${scriptName}`;
  }
}

export function detectPreflightPackageManager(packageJson = {}, availableFiles = []) {
  const packageManagerField = packageJson?.packageManager;
  if (typeof packageManagerField === 'string' && packageManagerField.trim()) {
    const [name] = packageManagerField.split('@');
    if (name) {
      return name;
    }
  }

  const files = new Set(availableFiles);
  if (files.has('pnpm-lock.yaml')) return 'pnpm';
  if (files.has('yarn.lock')) return 'yarn';
  if (files.has('bun.lockb') || files.has('bun.lock')) return 'bun';
  return 'npm';
}

export function getPreflightQualityCommands(packageJson = {}, packageManager = 'npm') {
  const scripts = packageJson?.scripts ?? {};

  return PRE_FLIGHT_QUALITY_SCRIPT_ORDER.filter((scriptName) => Boolean(scripts[scriptName])).map(
    (scriptName) => ({
      name: scriptName,
      command: buildPackageScriptCommand(packageManager, scriptName),
    })
  );
}

export function classifyPreflightFailure(output) {
  if (OS_ERROR_PATTERN.test(output) && !hasStructuredTestResults(output)) {
    return 'environment';
  }
  return 'command-failure';
}

export function parseGitStashList(output) {
  if (typeof output !== 'string' || output.trim().length === 0) {
    return { count: 0, entries: [] };
  }

  const entries = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  return {
    count: entries.length,
    entries,
  };
}

export function buildEnvironmentRemediationHint(output) {
  if (/EACCES|permission denied/i.test(output)) {
    const pathMatch = output.match(/(?:rmdir|mkdir|open|unlink)\s+['"]?([^\s'"]+)/i);
    const offendingPath = pathMatch?.[1] ?? null;
    return offendingPath
      ? `Fix: sudo chown -R $USER "${offendingPath}"`
      : 'Fix: check file ownership — try: sudo chown -R $USER <affected-directory>';
  }
  if (/ENOENT/i.test(output)) {
    return 'Fix: a required file or directory was not found — check your project setup.';
  }
  return 'Fix: resolve the environment-level error preventing the test runner from starting.';
}

function buildSummaryExcerpt(lines = [], startIndex = 0) {
  const excerptLines = [];
  for (const line of lines.slice(startIndex)) {
    excerptLines.push(line);
    if (excerptLines.length >= 6 || /^Ran all test suites/i.test(line.trim())) {
      break;
    }
  }

  while (excerptLines.length > 0 && !excerptLines.at(-1)?.trim()) {
    excerptLines.pop();
  }

  return excerptLines.join('\n').trim();
}

function hasStructuredTestResults(output) {
  if (typeof output !== 'string' || output.trim().length === 0) return false;
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .some((line) => TEST_RESULT_LINE_PATTERNS.some((pattern) => pattern.test(line)));
}

export function parseTestFailureDetails(output) {
  if (typeof output !== 'string') return null;

  const lines = output.split(/\r?\n/);
  let finalSummaryStartIndex = -1;
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    if (/^Test Suites:/i.test(lines[index].trim())) {
      finalSummaryStartIndex = index;
      break;
    }
  }

  if (finalSummaryStartIndex >= 0) {
    const summaryExcerpt = buildSummaryExcerpt(lines, finalSummaryStartIndex);
    const summaryLines = summaryExcerpt ? summaryExcerpt.split('\n') : [];
    const testsLineOffset = summaryLines.findIndex((line) => /^Tests:/i.test(line.trim()));
    if (testsLineOffset >= 0) {
      const matchedLine = summaryLines[testsLineOffset].trim();
      const match = matchedLine.match(/^Tests:\s+(\d+)\s+failed\b/i);
      if (!match) {
        return null;
      }

      return {
        failureCount: parseInt(match[1], 10),
        matchedLine,
        matchedLineNumber: finalSummaryStartIndex + testsLineOffset + 1,
        parserSource: 'final-jest-summary',
        summaryExcerpt,
      };
    }
  }

  const matches = [...output.matchAll(/^Tests:\s+(\d+)\s+failed\b.*$/gim)];
  if (matches.length === 0) {
    return null;
  }

  const lastMatch = matches.at(-1);
  const matchedLine = lastMatch[0].trim();
  const matchedLineNumber = output.slice(0, lastMatch.index).split(/\r?\n/).length;

  return {
    failureCount: parseInt(lastMatch[1], 10),
    matchedLine,
    matchedLineNumber,
    parserSource: 'fallback-failed-line',
    summaryExcerpt: matchedLine,
  };
}

export function parseTestFailureCount(output) {
  return parseTestFailureDetails(output)?.failureCount ?? null;
}

function formatParsedFailureEvidence(details) {
  if (!details) {
    return null;
  }

  const evidenceLines = [
    `Parsed test failures: ${details.failureCount}`,
    `Matched summary line${details.matchedLineNumber ? ` [line ${details.matchedLineNumber}]` : ''}: ${details.matchedLine}`,
  ];

  if (details.summaryExcerpt && details.summaryExcerpt !== details.matchedLine) {
    evidenceLines.push('Summary excerpt:');
    evidenceLines.push(details.summaryExcerpt);
  }

  return evidenceLines.join('\n');
}

export function performHealthChecks(environment) {
  const checks = {};

  checks[HEALTH_CHECK_CATEGORIES.ENVIRONMENT] = {
    nodeVersion: environment.nodeVersion || 'unknown',
    platform: environment.platform || 'unknown',
    passed: !!environment.nodeVersion,
  };

  checks[HEALTH_CHECK_CATEGORIES.CONFIGURATION] = {
    configLoaded: !!environment.config,
    workflowDirExists: !!environment.workflowDir,
    passed: !!environment.config && !!environment.workflowDir,
  };

  checks[HEALTH_CHECK_CATEGORIES.FILESYSTEM] = {
    workflowDirWritable: environment.workflowDirWritable !== false,
    passed: environment.workflowDirWritable !== false,
  };

  const allPassed = Object.values(checks).every((check) => check.passed);

  return {
    passed: allPassed,
    checks,
  };
}

export async function writePreflightFailureArtifact(logsRunDir, suiteName, command, output) {
  if (!logsRunDir) {
    return null;
  }

  const artifactDir = path.join(logsRunDir, 'preflight');
  const safeSuiteName = suiteName.replace(/[^a-z0-9_-]+/gi, '_').toLowerCase();
  const artifactPath = path.join(artifactDir, `${safeSuiteName || 'preflight'}.log`);
  const artifactContent = [`Command: ${command}`, '', output].join('\n');

  await fs.mkdir(artifactDir, { recursive: true });
  await fs.writeFile(artifactPath, artifactContent, 'utf8');

  return artifactPath;
}

export async function readPreflightBaseline(workflowDir) {
  try {
    const baselinePath = path.join(workflowDir, 'preflight_baseline.json');
    const raw = await fs.readFile(baselinePath, 'utf8');
    const data = JSON.parse(raw);
    return typeof data.testFailureCount === 'number' ? data.testFailureCount : null;
  } catch {
    return null;
  }
}

export async function writePreflightBaseline(workflowDir, testFailureCount) {
  try {
    await fs.mkdir(workflowDir, { recursive: true });
    const baselinePath = path.join(workflowDir, 'preflight_baseline.json');
    let existing = {};
    try {
      existing = JSON.parse(await fs.readFile(baselinePath, 'utf8'));
    } catch {
      /* ok — first write */
    }
    await fs.writeFile(
      baselinePath,
      JSON.stringify({ ...existing, testFailureCount, updatedAt: new Date().toISOString() }),
      'utf8'
    );
  } catch {
    // Non-critical — baseline is best-effort
  }
}

async function readPreflightLintBaseline(workflowDir) {
  try {
    const baselinePath = path.join(workflowDir, 'preflight_baseline.json');
    const raw = await fs.readFile(baselinePath, 'utf8');
    const data = JSON.parse(raw);
    return typeof data.lintErrorCount === 'number' ? data.lintErrorCount : null;
  } catch {
    return null;
  }
}

async function writePreflightLintBaseline(workflowDir, lintErrorCount) {
  try {
    await fs.mkdir(workflowDir, { recursive: true });
    const baselinePath = path.join(workflowDir, 'preflight_baseline.json');
    let existing = {};
    try {
      existing = JSON.parse(await fs.readFile(baselinePath, 'utf8'));
    } catch {
      /* ok — first write */
    }
    await fs.writeFile(
      baselinePath,
      JSON.stringify({ ...existing, lintErrorCount, updatedAt: new Date().toISOString() }),
      'utf8'
    );
  } catch {
    // Non-critical — baseline is best-effort
  }
}

function parseLintErrorCount(output) {
  const match = output.match(/(\d+)\s+error/);
  return match ? parseInt(match[1], 10) : null;
}

async function runGitStashPreflightCheck(projectRoot, logger) {
  logger.info(
    `Running pre-flight quality suite: ${PRE_FLIGHT_GIT_STASH_COMMAND} (cwd: ${projectRoot})`
  );

  try {
    const cmdOutput = await executorModule(PRE_FLIGHT_GIT_STASH_COMMAND, {
      cwd: projectRoot,
      shell: true,
      timeout: PRE_FLIGHT_COMMAND_TIMEOUT_MS,
    });
    const combinedOutput = [cmdOutput?.stdout, cmdOutput?.stderr]
      .filter((value) => typeof value === 'string' && value.trim())
      .join('\n');
    const stashDetails = parseGitStashList(combinedOutput);

    if (stashDetails.count === 0) {
      return {
        skipped: false,
        result: {
          name: PRE_FLIGHT_GIT_STASH_CHECK_NAME,
          command: PRE_FLIGHT_GIT_STASH_COMMAND,
          passed: true,
          stashCount: 0,
        },
      };
    }

    return {
      skipped: false,
      result: {
        name: PRE_FLIGHT_GIT_STASH_CHECK_NAME,
        command: PRE_FLIGHT_GIT_STASH_COMMAND,
        passed: false,
        stashCount: stashDetails.count,
      },
      failure: {
        passed: false,
        advisory: false,
        hasForceExitWarning: false,
        skipped: false,
        failedCommand: PRE_FLIGHT_GIT_STASH_COMMAND,
        failureOutput: stashDetails.entries.join('\n'),
        failureKind: 'git-stash-present',
        stashCount: stashDetails.count,
        message:
          `Pre-flight rule failed: found ${stashDetails.count} git stash ` +
          `entr${stashDetails.count === 1 ? 'y' : 'ies'}. Clear stashed assets before running the workflow.`,
      },
    };
  } catch (error) {
    const fullFailureOutput = [error?.stdout, error?.stderr, error?.output, error?.message]
      .filter((value) => typeof value === 'string' && value.trim())
      .join('\n')
      .trim();

    if (NOT_A_GIT_REPOSITORY_PATTERN.test(fullFailureOutput)) {
      return { skipped: true, result: null };
    }

    return {
      skipped: false,
      result: {
        name: PRE_FLIGHT_GIT_STASH_CHECK_NAME,
        command: PRE_FLIGHT_GIT_STASH_COMMAND,
        passed: false,
        exitCode: error?.exitCode ?? 1,
      },
      failure: {
        passed: false,
        advisory: false,
        hasForceExitWarning: false,
        skipped: false,
        failedCommand: PRE_FLIGHT_GIT_STASH_COMMAND,
        failureOutput: fullFailureOutput
          .split('\n')
          .slice(-PRE_FLIGHT_FAILURE_OUTPUT_TAIL_LINES)
          .join('\n'),
        failureKind: 'git-stash-check-failed',
        message: `Unable to inspect git stash state: ${PRE_FLIGHT_GIT_STASH_COMMAND}`,
      },
    };
  }
}

export async function runPreflightQualitySuites({
  projectRoot,
  workflowDir,
  logsRunDir,
  changeCounts = null,
  preflightTestCommand = null,
  logger,
}) {
  const results = [];
  const stashCheck = await runGitStashPreflightCheck(projectRoot, logger);
  if (stashCheck.result) {
    results.push(stashCheck.result);
  }
  if (stashCheck.failure) {
    return {
      ...stashCheck.failure,
      commands: results,
      packageManager: null,
    };
  }

  let packageJson;
  try {
    const packageJsonRaw = await fs.readFile(path.join(projectRoot, 'package.json'), 'utf8');
    packageJson = JSON.parse(packageJsonRaw);
  } catch {
    return {
      passed: true,
      skipped: true,
      commands: results,
      message:
        results.length > 0
          ? 'No package.json found in project root (git stash check passed)'
          : 'No package.json found in project root',
    };
  }

  const projectEntries = await fs.readdir(projectRoot).catch(() => []);
  const packageManager = detectPreflightPackageManager(packageJson, projectEntries);
  const commands = getPreflightQualityCommands(packageJson, packageManager);

  if (commands.length === 0) {
    return {
      passed: true,
      skipped: true,
      commands: results,
      packageManager,
      message:
        results.length > 0
          ? 'No lint/test/build scripts found (git stash check passed)'
          : 'No lint/test/build scripts found',
    };
  }

  const baselineFailureCount = await readPreflightBaseline(workflowDir);
  const baselineLintErrorCount = await readPreflightLintBaseline(workflowDir);

  const suitesToRun = preflightTestCommand
    ? commands.map((suite) =>
        suite.name === 'test' ? { ...suite, command: preflightTestCommand } : suite
      )
    : commands;

  for (const suite of suitesToRun) {
    logger.info(`Running pre-flight quality suite: ${suite.command} (cwd: ${projectRoot})`);
    try {
      const cmdOutput = await executorModule(suite.command, {
        cwd: projectRoot,
        shell: true,
        timeout: PRE_FLIGHT_COMMAND_TIMEOUT_MS,
      });

      if (suite.name === 'test') {
        const combinedOutput = [cmdOutput?.stdout, cmdOutput?.stderr]
          .filter((value) => typeof value === 'string' && value.trim())
          .join('\n');
        const testFailureDetails = parseTestFailureDetails(combinedOutput);
        const currentFailureCount = testFailureDetails?.failureCount ?? null;
        if (currentFailureCount !== null && currentFailureCount > 0) {
          const testFilesChanged = changeCounts?.tests ?? null;
          const noNewFailures =
            baselineFailureCount !== null && currentFailureCount <= baselineFailureCount;
          const likelyPreExisting =
            !noNewFailures && testFilesChanged !== null && testFilesChanged === 0;
          const advisory = noNewFailures || likelyPreExisting;
          const advisoryMessage = noNewFailures
            ? `${currentFailureCount} pre-existing test failure(s) ` +
              `(baseline: ${baselineFailureCount}). No new failures were introduced.`
            : `${currentFailureCount} test failure(s) detected but no test files are in the ` +
              `current changeset — strongly suggests pre-existing failures unrelated to these changes.`;

          await writePreflightBaseline(workflowDir, currentFailureCount);

          const failureOutput = formatParsedFailureEvidence(testFailureDetails);
          let failureArtifact = null;
          let failureArtifactError = null;
          try {
            failureArtifact = await writePreflightFailureArtifact(
              logsRunDir,
              suite.name,
              suite.command,
              combinedOutput
            );
          } catch (artifactError) {
            failureArtifactError = artifactError.message;
          }
          results.push({ ...suite, passed: advisory, exitCode: 0 });
          return {
            passed: advisory,
            advisory,
            advisoryMessage: advisory ? advisoryMessage : undefined,
            hasForceExitWarning: false,
            skipped: false,
            packageManager,
            commands: results,
            failedCommand: advisory ? undefined : suite.command,
            failureOutput: advisory ? undefined : failureOutput,
            failureArtifact,
            failureArtifactError,
            failureKind: advisory ? 'test-parser-advisory' : 'test-parser-anomaly',
            parsedFailureCount: currentFailureCount,
            failureEvidence: testFailureDetails,
            message: advisory
              ? `Advisory: ${advisoryMessage}`
              : `Preflight anomaly: parsed test-failure summary conflicts with process exit code (command: ${suite.command}, exit code: 0, parsed failures: ${currentFailureCount})`,
          };
        }
      }

      results.push({ ...suite, passed: true });
      if (suite.name === 'lint') {
        await writePreflightLintBaseline(workflowDir, 0);
      }
    } catch (error) {
      const fullFailureOutput = [error?.stdout, error?.stderr, error?.output]
        .filter((value) => typeof value === 'string' && value.trim())
        .join('\n')
        .trim();
      const failureOutput = fullFailureOutput
        .split('\n')
        .slice(-PRE_FLIGHT_FAILURE_OUTPUT_TAIL_LINES)
        .join('\n');
      let failureArtifact = null;
      let failureArtifactError = null;
      if (fullFailureOutput) {
        try {
          failureArtifact = await writePreflightFailureArtifact(
            logsRunDir,
            suite.name,
            suite.command,
            fullFailureOutput
          );
        } catch (artifactError) {
          failureArtifactError = artifactError.message;
        }
      }

      results.push({
        ...suite,
        passed: false,
        exitCode: error?.exitCode ?? 1,
      });

      const hasForceExitWarning =
        fullFailureOutput.includes('Force exiting Jest') ||
        fullFailureOutput.includes('--detectOpenHandles');

      let advisory = false;
      let advisoryMessage = null;
      if (suite.name === 'test') {
        const envFailureKind = classifyPreflightFailure(fullFailureOutput);
        if (envFailureKind === 'environment') {
          return {
            passed: false,
            advisory: false,
            advisoryMessage: null,
            hasForceExitWarning,
            skipped: false,
            packageManager,
            commands: results,
            failedCommand: suite.command,
            failureOutput,
            failureKind: 'environment',
            failureArtifact,
            failureArtifactError,
            message: `Environment error blocked test runner (${suite.command}). ${buildEnvironmentRemediationHint(fullFailureOutput)}`,
          };
        }

        const testFailureDetails = parseTestFailureDetails(fullFailureOutput);
        const currentFailureCount = testFailureDetails?.failureCount ?? null;
        const testFilesChanged = changeCounts?.tests ?? null;
        const noNewFailures =
          baselineFailureCount !== null &&
          currentFailureCount !== null &&
          currentFailureCount <= baselineFailureCount;
        const likelyPreExisting =
          !noNewFailures &&
          testFilesChanged !== null &&
          testFilesChanged === 0 &&
          currentFailureCount !== null;

        if (noNewFailures) {
          advisory = true;
          advisoryMessage =
            `${currentFailureCount} pre-existing test failure(s) ` +
            `(baseline: ${baselineFailureCount}). No new failures were introduced.`;
        } else if (likelyPreExisting) {
          advisory = true;
          advisoryMessage =
            `${currentFailureCount} test failure(s) detected but no test files are in the ` +
            `current changeset — strongly suggests pre-existing failures unrelated to these changes.`;
        }

        if (currentFailureCount !== null) {
          await writePreflightBaseline(workflowDir, currentFailureCount);
        }
      }

      if (suite.name === 'lint') {
        const currentErrorCount = parseLintErrorCount(fullFailureOutput);
        if (currentErrorCount !== null) {
          await writePreflightLintBaseline(workflowDir, currentErrorCount);
          const noNewLintErrors =
            baselineLintErrorCount !== null && currentErrorCount <= baselineLintErrorCount;
          if (noNewLintErrors) {
            advisory = true;
            advisoryMessage =
              `${currentErrorCount} pre-existing lint error(s) ` +
              `(baseline: ${baselineLintErrorCount}). No new errors in this changeset.`;
          }
        }
      }

      return {
        passed: false,
        advisory,
        advisoryMessage,
        hasForceExitWarning,
        skipped: false,
        packageManager,
        commands: results,
        failedCommand: suite.command,
        failureOutput,
        failureKind: 'command-failure',
        failureArtifact,
        failureArtifactError,
        message: `Command failed: ${suite.command}`,
      };
    }
  }

  await Promise.all([
    writePreflightBaseline(workflowDir, 0),
    writePreflightLintBaseline(workflowDir, 0),
  ]);

  return {
    passed: true,
    advisory: false,
    hasForceExitWarning: false,
    skipped: false,
    packageManager,
    commands: results,
    message: `Ran ${results.length} pre-flight quality suite(s)`,
  };
}
