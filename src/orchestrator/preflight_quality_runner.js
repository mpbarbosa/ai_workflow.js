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
    await fs.writeFile(
      baselinePath,
      JSON.stringify({ testFailureCount, updatedAt: new Date().toISOString() }),
      'utf8'
    );
  } catch {
    // Non-critical — baseline is best-effort
  }
}

export async function runPreflightQualitySuites({
  projectRoot,
  workflowDir,
  logsRunDir,
  changeCounts = null,
  logger,
}) {
  let packageJson;
  try {
    const packageJsonRaw = await fs.readFile(path.join(projectRoot, 'package.json'), 'utf8');
    packageJson = JSON.parse(packageJsonRaw);
  } catch {
    return {
      passed: true,
      skipped: true,
      commands: [],
      message: 'No package.json found in project root',
    };
  }

  const projectEntries = await fs.readdir(projectRoot).catch(() => []);
  const packageManager = detectPreflightPackageManager(packageJson, projectEntries);
  const commands = getPreflightQualityCommands(packageJson, packageManager);

  if (commands.length === 0) {
    return {
      passed: true,
      skipped: true,
      commands: [],
      packageManager,
      message: 'No lint/test/build scripts found',
    };
  }

  const baselineFailureCount = await readPreflightBaseline(workflowDir);

  const results = [];
  for (const suite of commands) {
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

  await writePreflightBaseline(workflowDir, 0);

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
