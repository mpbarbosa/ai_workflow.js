import {
  HEALTH_CHECK_CATEGORIES,
  detectPreflightPackageManager,
  getPreflightQualityCommands,
  parseTestFailureCount,
  parseTestFailureDetails,
  performHealthChecks,
  runPreflightQualitySuites,
} from '../../src/orchestrator/preflight_quality_runner.js';
import { jest } from '@jest/globals';
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

  test('runPreflightQualitySuites records exact evidence for exit-0 parser anomalies', async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'preflight-anomaly-'));
    const projectRoot = path.join(tempRoot, 'project');
    const workflowDir = path.join(tempRoot, '.ai_workflow');
    const logsRunDir = path.join(workflowDir, 'logs', 'workflow_test');

    await fs.mkdir(projectRoot, { recursive: true });
    await fs.writeFile(
      path.join(projectRoot, 'package.json'),
      JSON.stringify(
        {
          name: 'preflight-anomaly-fixture',
          version: '1.0.0',
          scripts: {
            lint: 'node -e "console.log(\'lint ok\')"',
            test:
              'node -e "console.log(\'Test Suites: 1 failed, 1 total\'); console.log(\'Tests: 2 failed, 8 passed, 10 total\'); console.log(\'Snapshots: 0 total\'); console.log(\'Time: 0.1 s\'); console.log(\'Ran all test suites.\')"',
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
});
