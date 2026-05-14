import {
  HEALTH_CHECK_CATEGORIES,
  buildEnvironmentRemediationHint,
  classifyPreflightFailure,
  detectPreflightPackageManager,
  getPreflightQualityCommands,
  parseGitStashList,
  parseTestFailureCount,
  parseTestFailureDetails,
  performHealthChecks,
  runPreflightQualitySuites,
} from '../../src/orchestrator/preflight_quality_runner.js';
import { jest } from '@jest/globals';
import { execFileSync } from 'child_process';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

describe('preflight_quality_runner', () => {
  test('detects the package manager from package.json metadata first', () => {
    expect(detectPreflightPackageManager({ packageManager: 'pnpm@9.0.0' }, ['yarn.lock'])).toBe(
      'pnpm'
    );
  });

  test('builds ordered quality commands from available scripts', () => {
    expect(
      getPreflightQualityCommands(
        { scripts: { lint: 'eslint .', test: 'jest', build: 'tsc', custom: 'echo hi' } },
        'npm'
      )
    ).toEqual([
      { name: 'lint', command: 'npm run lint' },
      { name: 'test', command: 'npm test' },
      { name: 'build', command: 'npm run build' },
    ]);
  });

  test('parseGitStashList counts stash entries', () => {
    expect(parseGitStashList('stash@{0}: On main: WIP\nstash@{1}: On main: debug')).toEqual({
      count: 2,
      entries: ['stash@{0}: On main: WIP', 'stash@{1}: On main: debug'],
    });
  });

  test('returns categorized workflow health checks', () => {
    const result = performHealthChecks({
      nodeVersion: 'v22.0.0',
      platform: 'linux',
      config: {},
      workflowDir: '/tmp/.ai_workflow',
      workflowDirWritable: true,
    });

    expect(result.passed).toBe(true);
    expect(result.checks[HEALTH_CHECK_CATEGORIES.ENVIRONMENT].passed).toBe(true);
    expect(result.checks[HEALTH_CHECK_CATEGORIES.CONFIGURATION].passed).toBe(true);
    expect(result.checks[HEALTH_CHECK_CATEGORIES.FILESYSTEM].passed).toBe(true);
  });

  test('parseTestFailureCount ignores stale failure lines when the final Jest summary passed', () => {
    const output = [
      'noise before summary',
      'Tests: 2 failed, 8 passed, 10 total',
      'Test Suites: 194 passed, 194 total',
      'Tests:       7611 passed, 7611 total',
      'Snapshots:   0 total',
      'Time:        7.137 s',
      'Ran all test suites.',
    ].join('\n');

    expect(parseTestFailureDetails(output)).toBeNull();
    expect(parseTestFailureCount(output)).toBeNull();
  });

  test('classifyPreflightFailure returns environment for OS errors with no test results', () => {
    const eaccesOutput = "Error: EACCES: permission denied, rmdir '/project/coverage/lcov-report'";
    expect(classifyPreflightFailure(eaccesOutput)).toBe('environment');
  });

  test('classifyPreflightFailure returns command-failure when test results are also present', () => {
    const mixedOutput = 'Error: EACCES: permission denied\n3 passed, 2 failed';
    expect(classifyPreflightFailure(mixedOutput)).toBe('command-failure');
  });

  test('classifyPreflightFailure returns command-failure for normal test failure output', () => {
    const normalOutput = 'Tests: 2 failed, 8 passed, 10 total';
    expect(classifyPreflightFailure(normalOutput)).toBe('command-failure');
  });

  test('classifyPreflightFailure returns environment for sh exit-127 not-found output', () => {
    expect(classifyPreflightFailure('sh: 1: jest: not found')).toBe('environment');
  });

  test('classifyPreflightFailure returns environment for bash command-not-found output', () => {
    expect(classifyPreflightFailure('jest: command not found')).toBe('environment');
  });

  test('classifyPreflightFailure returns environment for zsh command-not-found output', () => {
    expect(classifyPreflightFailure('command not found: jest')).toBe('environment');
  });

  test('buildEnvironmentRemediationHint includes fix for EACCES with detected path', () => {
    const output = "Error: EACCES: permission denied, rmdir '/project/coverage/lcov-report'";
    const hint = buildEnvironmentRemediationHint(output);
    expect(hint).toContain('sudo chown -R $USER');
    expect(hint).toContain('/project/coverage/lcov-report');
  });

  test('buildEnvironmentRemediationHint covers ENOENT', () => {
    const hint = buildEnvironmentRemediationHint('ENOENT: no such file or directory');
    expect(hint).toContain('not found');
  });

  test('buildEnvironmentRemediationHint suggests npm install for sh not-found output', () => {
    const hint = buildEnvironmentRemediationHint('sh: 1: jest: not found');
    expect(hint).toContain('jest');
    expect(hint).toContain('npm install');
  });

  test('buildEnvironmentRemediationHint suggests npm install for generic not-found output', () => {
    const hint = buildEnvironmentRemediationHint('some tool: not found');
    expect(hint).toContain('npm install');
  });

  test('runPreflightQualitySuites classifies EACCES crash as environment failure', async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'preflight-env-'));
    const projectRoot = path.join(tempRoot, 'project');
    const workflowDir = path.join(tempRoot, '.ai_workflow');
    const logsRunDir = path.join(workflowDir, 'logs', 'workflow_test');

    await fs.mkdir(path.join(projectRoot, 'node_modules', '.bin'), { recursive: true });
    await fs.writeFile(path.join(projectRoot, 'node_modules', '.bin', 'placeholder'), '', 'utf8');
    await fs.writeFile(
      path.join(projectRoot, 'package.json'),
      JSON.stringify({
        name: 'env-failure-fixture',
        version: '1.0.0',
        scripts: {
          test: `node -e "process.stderr.write('Error: EACCES: permission denied, rmdir /project/coverage/lcov-report\\n'); process.exit(1)"`,
        },
      }),
      'utf8'
    );

    const result = await runPreflightQualitySuites({
      projectRoot,
      workflowDir,
      logsRunDir,
      changeCounts: { tests: 0 },
      logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
    });

    expect(result.passed).toBe(false);
    expect(result.advisory).toBe(false);
    expect(result.failureKind).toBe('environment');
    expect(result.message).toContain('Environment error blocked test runner');
    expect(result.message).toContain('Fix:');

    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  test('runPreflightQualitySuites uses preflightTestCommand when provided', async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'preflight-override-'));
    const projectRoot = path.join(tempRoot, 'project');
    const workflowDir = path.join(tempRoot, '.ai_workflow');
    const logsRunDir = path.join(workflowDir, 'logs', 'workflow_test');

    await fs.mkdir(path.join(projectRoot, 'node_modules', '.bin'), { recursive: true });
    await fs.writeFile(path.join(projectRoot, 'node_modules', '.bin', 'placeholder'), '', 'utf8');
    await fs.writeFile(
      path.join(projectRoot, 'package.json'),
      JSON.stringify({
        name: 'override-fixture',
        version: '1.0.0',
        scripts: { test: 'node -e "process.exit(1)"' },
      }),
      'utf8'
    );

    // override with a passing lightweight command
    const result = await runPreflightQualitySuites({
      projectRoot,
      workflowDir,
      logsRunDir,
      changeCounts: null,
      preflightTestCommand: 'node -e "process.exit(0)"',
      logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
    });

    expect(result.passed).toBe(true);

    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  test('runPreflightQualitySuites records exact evidence for exit-0 parser anomalies', async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'preflight-anomaly-'));
    const projectRoot = path.join(tempRoot, 'project');
    const workflowDir = path.join(tempRoot, '.ai_workflow');
    const logsRunDir = path.join(workflowDir, 'logs', 'workflow_test');

    await fs.mkdir(path.join(projectRoot, 'node_modules', '.bin'), { recursive: true });
    await fs.writeFile(path.join(projectRoot, 'node_modules', '.bin', 'placeholder'), '', 'utf8');
    await fs.writeFile(
      path.join(projectRoot, 'package.json'),
      JSON.stringify(
        {
          name: 'preflight-anomaly-fixture',
          version: '1.0.0',
          scripts: {
            lint: 'node -e "console.log(\'lint ok\')"',
            test: "node -e \"console.log('Test Suites: 1 failed, 1 total'); console.log('Tests: 2 failed, 8 passed, 10 total'); console.log('Snapshots: 0 total'); console.log('Time: 0.1 s'); console.log('Ran all test suites.')\"",
          },
        },
        null,
        2
      ),
      'utf8'
    );

    const result = await runPreflightQualitySuites({
      projectRoot,
      workflowDir,
      logsRunDir,
      changeCounts: { tests: 1 },
      logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
    });

    expect(result.passed).toBe(false);
    expect(result.failureKind).toBe('test-parser-anomaly');
    expect(result.parsedFailureCount).toBe(2);
    expect(result.failureEvidence).toMatchObject({
      parserSource: 'final-jest-summary',
      matchedLine: 'Tests: 2 failed, 8 passed, 10 total',
    });
    expect(result.message).toContain('Preflight anomaly: parsed test-failure summary conflicts');
    expect(result.failureArtifact).toContain(path.join('preflight', 'test.log'));

    const artifact = await fs.readFile(result.failureArtifact, 'utf8');
    expect(artifact).toContain('Command: npm test');
    expect(artifact).toContain('Tests: 2 failed, 8 passed, 10 total');

    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  test('runPreflightQualitySuites classifies exit-127 not-found as environment failure', async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'preflight-exit127-'));
    const projectRoot = path.join(tempRoot, 'project');
    const workflowDir = path.join(tempRoot, '.ai_workflow');
    const logsRunDir = path.join(workflowDir, 'logs', 'workflow_test');

    await fs.mkdir(projectRoot, { recursive: true });
    // Simulate a project that has node_modules/.bin so the guard passes,
    // but the test script itself exits 127 with a "not found" message.
    await fs.mkdir(path.join(projectRoot, 'node_modules', '.bin'), { recursive: true });
    await fs.writeFile(path.join(projectRoot, 'node_modules', '.bin', 'placeholder'), '', 'utf8');
    await fs.writeFile(
      path.join(projectRoot, 'package.json'),
      JSON.stringify({
        name: 'exit127-fixture',
        version: '1.0.0',
        scripts: {
          test: `node -e "process.stderr.write('sh: 1: jest: not found\\n'); process.exit(127)"`,
        },
      }),
      'utf8'
    );

    const result = await runPreflightQualitySuites({
      projectRoot,
      workflowDir,
      logsRunDir,
      changeCounts: { tests: 0 },
      logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
    });

    expect(result.passed).toBe(false);
    expect(result.advisory).toBe(false);
    expect(result.failureKind).toBe('environment');
    expect(result.message).toContain('Environment error blocked test runner');
    expect(result.message).toContain('jest');
    expect(result.message).toContain('npm install');

    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  test('runPreflightQualitySuites returns environment error when node_modules is absent', async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'preflight-nomodules-'));
    const projectRoot = path.join(tempRoot, 'project');
    const workflowDir = path.join(tempRoot, '.ai_workflow');
    const logsRunDir = path.join(workflowDir, 'logs', 'workflow_test');

    await fs.mkdir(projectRoot, { recursive: true });
    await fs.writeFile(
      path.join(projectRoot, 'package.json'),
      JSON.stringify({
        name: 'no-modules-fixture',
        version: '1.0.0',
        scripts: { test: 'jest' },
      }),
      'utf8'
    );

    const result = await runPreflightQualitySuites({
      projectRoot,
      workflowDir,
      logsRunDir,
      changeCounts: null,
      logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
    });

    expect(result.passed).toBe(false);
    expect(result.advisory).toBe(false);
    expect(result.failureKind).toBe('environment');
    expect(result.message).toContain('node_modules not found');
    expect(result.message).toContain('npm install');
    expect(result.failedCommand).toBeNull();

    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  test('runPreflightQualitySuites returns environment error when node_modules/.bin is empty', async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'preflight-emptybin-'));
    const projectRoot = path.join(tempRoot, 'project');
    const workflowDir = path.join(tempRoot, '.ai_workflow');
    const logsRunDir = path.join(workflowDir, 'logs', 'workflow_test');

    await fs.mkdir(path.join(projectRoot, 'node_modules', '.bin'), { recursive: true });
    await fs.writeFile(
      path.join(projectRoot, 'package.json'),
      JSON.stringify({
        name: 'empty-bin-fixture',
        version: '1.0.0',
        scripts: { test: 'jest' },
      }),
      'utf8'
    );

    const result = await runPreflightQualitySuites({
      projectRoot,
      workflowDir,
      logsRunDir,
      changeCounts: null,
      logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
    });

    expect(result.passed).toBe(false);
    expect(result.advisory).toBe(false);
    expect(result.failureKind).toBe('environment');
    expect(result.message).toContain('node_modules/.bin is empty');
    expect(result.message).toContain('npm install');
    expect(result.failedCommand).toBeNull();

    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  test('runPreflightQualitySuites fails when git stash entries are present', async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'preflight-stash-'));
    const projectRoot = path.join(tempRoot, 'project');
    const workflowDir = path.join(tempRoot, '.ai_workflow');
    const logsRunDir = path.join(workflowDir, 'logs', 'workflow_test');

    await fs.mkdir(projectRoot, { recursive: true });
    execFileSync('git', ['init'], { cwd: projectRoot });
    execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: projectRoot });
    execFileSync('git', ['config', 'user.name', 'Test User'], { cwd: projectRoot });
    await fs.writeFile(path.join(projectRoot, 'README.md'), 'hello\n', 'utf8');
    execFileSync('git', ['add', 'README.md'], { cwd: projectRoot });
    execFileSync('git', ['commit', '-m', 'init'], { cwd: projectRoot });
    await fs.writeFile(path.join(projectRoot, 'README.md'), 'hello\nmore work\n', 'utf8');
    execFileSync('git', ['stash', 'push', '-m', 'fixture stash'], { cwd: projectRoot });

    const result = await runPreflightQualitySuites({
      projectRoot,
      workflowDir,
      logsRunDir,
      logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
    });

    expect(result.passed).toBe(false);
    expect(result.failedCommand).toBe('git stash list');
    expect(result.failureKind).toBe('git-stash-present');
    expect(result.stashCount).toBe(1);
    expect(result.message).toContain('Clear stashed assets');
    expect(result.failureArtifact).toBe(path.join(logsRunDir, 'preflight', 'git-stash.log'));
    expect(result.commands).toEqual([
      {
        name: 'git-stash',
        command: 'git stash list',
        passed: false,
        stashCount: 1,
      },
    ]);
    await expect(fs.readFile(result.failureArtifact, 'utf8')).resolves.toContain('fixture stash');
    // stash show --stat output should be appended so users can triage pop vs. drop
    expect(result.failureOutput).toContain('fixture stash');

    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  test('runPreflightQualitySuites writes both baseline fields atomically on success', async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'preflight-baseline-atomic-'));
    const projectRoot = path.join(tempRoot, 'project');
    const workflowDir = path.join(tempRoot, '.ai_workflow');
    const logsRunDir = path.join(workflowDir, 'logs', 'workflow_test');
    const baselinePath = path.join(workflowDir, 'preflight_baseline.json');

    await fs.mkdir(path.join(projectRoot, 'node_modules', '.bin'), { recursive: true });
    await fs.writeFile(path.join(projectRoot, 'node_modules', '.bin', 'placeholder'), '', 'utf8');
    await fs.writeFile(
      path.join(projectRoot, 'package.json'),
      JSON.stringify({
        name: 'baseline-atomic-fixture',
        version: '1.0.0',
        scripts: {
          lint: 'node -e "process.exit(0)"',
          test: 'node -e "process.exit(0)"',
        },
      }),
      'utf8'
    );

    const result = await runPreflightQualitySuites({
      projectRoot,
      workflowDir,
      logsRunDir,
      changeCounts: { tests: 0 },
      logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
    });

    expect(result.passed).toBe(true);

    const baseline = JSON.parse(await fs.readFile(baselinePath, 'utf8'));
    expect(baseline.testFailureCount).toBe(0);
    expect(baseline.lintErrorCount).toBe(0);
    expect(typeof baseline.updatedAt).toBe('string');

    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  test('runPreflightQualitySuites classifies EACCES build output as environment failure', async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'preflight-build-eacces-'));
    const projectRoot = path.join(tempRoot, 'project');
    const workflowDir = path.join(tempRoot, '.ai_workflow');
    const logsRunDir = path.join(workflowDir, 'logs', 'workflow_test');

    await fs.mkdir(path.join(projectRoot, 'node_modules', '.bin'), { recursive: true });
    await fs.writeFile(path.join(projectRoot, 'node_modules', '.bin', 'placeholder'), '', 'utf8');
    await fs.writeFile(
      path.join(projectRoot, 'package.json'),
      JSON.stringify({
        name: 'build-eacces-fixture',
        version: '1.0.0',
        scripts: {
          build: `node -e "process.stderr.write('error TS5033: Could not write file dist/index.js: EACCES: permission denied, mkdir dist\\n'); process.exit(2)"`,
        },
      }),
      'utf8'
    );

    const result = await runPreflightQualitySuites({
      projectRoot,
      workflowDir,
      logsRunDir,
      changeCounts: null,
      logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
    });

    expect(result.passed).toBe(false);
    expect(result.advisory).toBe(false);
    expect(result.failureKind).toBe('environment');
    expect(result.message).toContain('Environment error blocked build');
    expect(result.message).toContain('Fix:');

    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  test('runPreflightQualitySuites detects non-writable dist/ before running build', async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'preflight-dist-perm-'));
    const projectRoot = path.join(tempRoot, 'project');
    const workflowDir = path.join(tempRoot, '.ai_workflow');
    const logsRunDir = path.join(workflowDir, 'logs', 'workflow_test');

    await fs.mkdir(path.join(projectRoot, 'node_modules', '.bin'), { recursive: true });
    await fs.writeFile(path.join(projectRoot, 'node_modules', '.bin', 'placeholder'), '', 'utf8');

    const distPath = path.join(projectRoot, 'dist');
    const buildMarkerPath = path.join(projectRoot, 'build-ran');
    await fs.mkdir(distPath, { recursive: true });
    await fs.writeFile(
      path.join(projectRoot, 'package.json'),
      JSON.stringify({
        name: 'dist-perm-fixture',
        version: '1.0.0',
        scripts: {
          build: `node -e "require('fs').writeFileSync('${buildMarkerPath.replaceAll('\\', '\\\\')}', 'ran')"`,
        },
      }),
      'utf8'
    );

    const originalAccess = fs.access.bind(fs);
    const accessSpy = jest.spyOn(fs, 'access').mockImplementation(async (targetPath, mode) => {
      if (targetPath === distPath) {
        const error = new Error(`EACCES: permission denied, access '${distPath}'`);
        error.code = 'EACCES';
        throw error;
      }

      return originalAccess(targetPath, mode);
    });

    try {
      const result = await runPreflightQualitySuites({
        projectRoot,
        workflowDir,
        logsRunDir,
        changeCounts: null,
        logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
      });

      expect(result.passed).toBe(false);
      expect(result.failureKind).toBe('environment');
      expect(result.message).toContain('dist/');
      expect(result.message).toContain('not writable');
      await expect(fs.stat(buildMarkerPath)).rejects.toThrow();
    } finally {
      accessSpy.mockRestore();
      await fs.rm(tempRoot, { recursive: true, force: true });
    }
  });
});
