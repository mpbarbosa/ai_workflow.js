/**
 * @fileoverview Tests for Step 11.5: AWS LBS Validation
 *
 * Covers:
 *  - Pure functions (shouldRunAwsLbsValidation, detectShellScripts,
 *    checkShellScriptBestPractices, detectLambdaFunctions,
 *    categorizeLambdaFiles, validateLambdaStructure,
 *    validateAwsConfigSchema, buildValidationSummary, formatValidationReport)
 *  - Step11_5AwsLbsValidator.execute() — skip behaviour and full validation
 *  - stepKind static property contract
 *
 * @group steps
 */

import fs from 'fs/promises';
import path from 'path';

import {
  Step11_5AwsLbsValidator,
  AWS_LBS_PROJECT_KIND,
  SHELL_RULES,
  shouldRunAwsLbsValidation,
  detectShellScripts,
  checkShellScriptBestPractices,
  detectLambdaFunctions,
  categorizeLambdaFiles,
  validateLambdaStructure,
  validateAwsConfigSchema,
  buildValidationSummary,
  formatValidationReport,
} from '../../src/steps/step_11_5_aws_lbs_validation.js';
import { STEP_KIND } from '../../src/steps/step_contract.js';

// ============================================================================
// Helpers
// ============================================================================

async function writeFile(filePath, content) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, 'utf8');
}

function makeBacklogStub() {
  const calls = [];
  return {
    stub: {
      saveStepSummary: (...args) => {
        calls.push(args);
        return Promise.resolve();
      },
    },
    calls,
  };
}

/**
 * Write a minimal canonical aws_lbs project tree under `dir`.
 */
async function writeAwsLbsProject(dir, { strictShell = true } = {}) {
  const shebang = strictShell
    ? '#!/usr/bin/env bash\nset -euo pipefail\n'
    : '#!/usr/bin/env bash\n';

  await writeFile(path.join(dir, 'aws-config.json'), JSON.stringify({ region: 'us-east-1' }));
  await writeFile(path.join(dir, 'setup-aws-lbs.sh'), `${shebang}echo "setup"\n`);
  await writeFile(path.join(dir, 'src', 'scripts', 'create-api.sh'), `${shebang}echo "api"\n`);
  await writeFile(
    path.join(dir, 'src', 'lambda', 'get-route', 'index.js'),
    'exports.handler = async () => ({ statusCode: 200 });\n'
  );
  await writeFile(
    path.join(dir, 'src', 'lambda', 'get-route', 'package.json'),
    JSON.stringify({ name: 'get-route', version: '1.0.0' })
  );
}

// ============================================================================
// Constants
// ============================================================================

describe('Constants', () => {
  test('AWS_LBS_PROJECT_KIND equals aws_lbs_backend_setup', () => {
    expect(AWS_LBS_PROJECT_KIND).toBe('aws_lbs_backend_setup');
  });

  test('SHELL_RULES exposes SHEBANG and STRICT_MODE', () => {
    expect(SHELL_RULES.SHEBANG).toBe('shebang');
    expect(SHELL_RULES.STRICT_MODE).toBe('strict_mode');
  });
});

// ============================================================================
// Pure Functions — shouldRunAwsLbsValidation
// ============================================================================

describe('shouldRunAwsLbsValidation (pure)', () => {
  test('returns true for aws_lbs_backend_setup', () => {
    expect(shouldRunAwsLbsValidation('aws_lbs_backend_setup')).toBe(true);
  });

  test('returns false for nodejs_api', () => {
    expect(shouldRunAwsLbsValidation('nodejs_api')).toBe(false);
  });

  test('returns false for react_spa', () => {
    expect(shouldRunAwsLbsValidation('react_spa')).toBe(false);
  });

  test('returns false for shell_script_automation', () => {
    expect(shouldRunAwsLbsValidation('shell_script_automation')).toBe(false);
  });

  test('returns false for empty string', () => {
    expect(shouldRunAwsLbsValidation('')).toBe(false);
  });

  test('returns false for null', () => {
    expect(shouldRunAwsLbsValidation(null)).toBe(false);
  });

  test('returns false for undefined', () => {
    expect(shouldRunAwsLbsValidation(undefined)).toBe(false);
  });

  test('is deterministic — same input always gives same output', () => {
    const kind = 'aws_lbs_backend_setup';
    expect(shouldRunAwsLbsValidation(kind)).toBe(shouldRunAwsLbsValidation(kind));
  });
});

// ============================================================================
// Pure Functions — detectShellScripts
// ============================================================================

describe('detectShellScripts (pure)', () => {
  test('returns .sh files', () => {
    const files = ['setup.sh', 'README.md', 'src/lambda/index.js', 'deploy.sh'];
    expect(detectShellScripts(files)).toEqual(['setup.sh', 'deploy.sh']);
  });

  test('returns .bash files', () => {
    const files = ['run.bash', 'index.js'];
    expect(detectShellScripts(files)).toEqual(['run.bash']);
  });

  test('returns empty array when no shell scripts', () => {
    const files = ['index.js', 'package.json', 'README.md'];
    expect(detectShellScripts(files)).toEqual([]);
  });

  test('returns empty array for empty input', () => {
    expect(detectShellScripts([])).toEqual([]);
  });

  test('returns empty array for non-array input', () => {
    expect(detectShellScripts(null)).toEqual([]);
    expect(detectShellScripts(undefined)).toEqual([]);
  });

  test('includes nested paths', () => {
    const files = ['src/scripts/create-api.sh', 'src/scripts/deploy.sh'];
    expect(detectShellScripts(files)).toHaveLength(2);
  });
});

// ============================================================================
// Pure Functions — checkShellScriptBestPractices
// ============================================================================

describe('checkShellScriptBestPractices (pure)', () => {
  const goodScript = '#!/usr/bin/env bash\nset -euo pipefail\necho "Hello"\n';

  test('returns empty array for a compliant script', () => {
    expect(checkShellScriptBestPractices(goodScript)).toEqual([]);
  });

  test('reports missing shebang', () => {
    const script = 'set -euo pipefail\necho "hi"\n';
    const issues = checkShellScriptBestPractices(script);
    expect(issues.some((i) => i.includes('shebang'))).toBe(true);
  });

  test('reports missing set -euo pipefail', () => {
    const script = '#!/usr/bin/env bash\necho "hi"\n';
    const issues = checkShellScriptBestPractices(script);
    expect(issues.some((i) => i.includes('pipefail'))).toBe(true);
  });

  test('reports both missing shebang and strict mode', () => {
    const script = 'echo "hi"\n';
    const issues = checkShellScriptBestPractices(script);
    expect(issues).toHaveLength(2);
  });

  test('includes filePath in issue message when provided', () => {
    const script = 'echo "hi"\n';
    const issues = checkShellScriptBestPractices(script, 'setup.sh');
    expect(issues.every((i) => i.includes('setup.sh'))).toBe(true);
  });

  test('returns empty array for non-string input', () => {
    expect(checkShellScriptBestPractices(null)).toEqual([]);
    expect(checkShellScriptBestPractices(undefined)).toEqual([]);
  });

  test('is deterministic', () => {
    const r1 = checkShellScriptBestPractices(goodScript);
    const r2 = checkShellScriptBestPractices(goodScript);
    expect(r1).toEqual(r2);
  });
});

// ============================================================================
// Pure Functions — detectLambdaFunctions
// ============================================================================

describe('detectLambdaFunctions (pure)', () => {
  test('detects src/lambda/<fn>/index.js patterns', () => {
    const files = [
      'src/lambda/get-route/index.js',
      'src/lambda/post-location/index.js',
      'src/scripts/deploy.sh',
      'aws-config.json',
    ];
    const result = detectLambdaFunctions(files);
    expect(result).toHaveLength(2);
    expect(result).toContain('src/lambda/get-route/index.js');
    expect(result).toContain('src/lambda/post-location/index.js');
  });

  test('does not match non-index.js files in lambda dirs', () => {
    const files = ['src/lambda/get-route/helper.js', 'src/lambda/get-route/package.json'];
    expect(detectLambdaFunctions(files)).toEqual([]);
  });

  test('returns empty array for empty input', () => {
    expect(detectLambdaFunctions([])).toEqual([]);
  });

  test('returns empty array for non-array input', () => {
    expect(detectLambdaFunctions(null)).toEqual([]);
  });
});

// ============================================================================
// Pure Functions — categorizeLambdaFiles
// ============================================================================

describe('categorizeLambdaFiles (pure)', () => {
  test('groups files by Lambda function name', () => {
    const files = [
      'src/lambda/get-route/index.js',
      'src/lambda/get-route/package.json',
      'src/lambda/post-location/index.js',
    ];
    const map = categorizeLambdaFiles(files);
    expect(Object.keys(map)).toContain('get-route');
    expect(Object.keys(map)).toContain('post-location');
    expect(map['get-route']).toHaveLength(2);
    expect(map['post-location']).toHaveLength(1);
  });

  test('ignores files not under src/lambda/', () => {
    const files = ['src/scripts/deploy.sh', 'aws-config.json'];
    const map = categorizeLambdaFiles(files);
    expect(Object.keys(map)).toHaveLength(0);
  });

  test('returns empty object for empty input', () => {
    expect(categorizeLambdaFiles([])).toEqual({});
  });

  test('returns empty object for non-array input', () => {
    expect(categorizeLambdaFiles(null)).toEqual({});
  });
});

// ============================================================================
// Pure Functions — validateLambdaStructure
// ============================================================================

describe('validateLambdaStructure (pure)', () => {
  test('returns valid for functions with index.js and package.json', () => {
    const map = {
      'get-route': ['src/lambda/get-route/index.js', 'src/lambda/get-route/package.json'],
    };
    const result = validateLambdaStructure(map);
    expect(result.valid).toBe(true);
    expect(result.missingFiles).toHaveLength(0);
  });

  test('reports missing index.js', () => {
    const map = {
      'get-route': ['src/lambda/get-route/package.json'],
    };
    const result = validateLambdaStructure(map);
    expect(result.valid).toBe(false);
    expect(result.missingFiles).toContain('src/lambda/get-route/index.js');
  });

  test('reports missing package.json', () => {
    const map = {
      'get-route': ['src/lambda/get-route/index.js'],
    };
    const result = validateLambdaStructure(map);
    expect(result.valid).toBe(false);
    expect(result.missingFiles).toContain('src/lambda/get-route/package.json');
  });

  test('reports both missing files for a function with no files', () => {
    const map = { 'empty-fn': [] };
    const result = validateLambdaStructure(map);
    expect(result.valid).toBe(false);
    expect(result.missingFiles).toHaveLength(2);
  });

  test('handles multiple functions', () => {
    const map = {
      'fn-ok': ['src/lambda/fn-ok/index.js', 'src/lambda/fn-ok/package.json'],
      'fn-bad': ['src/lambda/fn-bad/index.js'],
    };
    const result = validateLambdaStructure(map);
    expect(result.valid).toBe(false);
    expect(result.missingFiles).toContain('src/lambda/fn-bad/package.json');
  });

  test('returns valid for empty function map', () => {
    expect(validateLambdaStructure({}).valid).toBe(true);
  });
});

// ============================================================================
// Pure Functions — validateAwsConfigSchema
// ============================================================================

describe('validateAwsConfigSchema (pure)', () => {
  test('accepts object with region key', () => {
    expect(validateAwsConfigSchema({ region: 'us-east-1' }).valid).toBe(true);
  });

  test('accepts object with stackName key', () => {
    expect(validateAwsConfigSchema({ stackName: 'my-stack' }).valid).toBe(true);
  });

  test('accepts object with apiId key', () => {
    expect(validateAwsConfigSchema({ apiId: 'abc123' }).valid).toBe(true);
  });

  test('accepts object with mapName key', () => {
    expect(validateAwsConfigSchema({ mapName: 'MyMap' }).valid).toBe(true);
  });

  test('accepts object with multiple recognised keys', () => {
    expect(validateAwsConfigSchema({ region: 'us-east-1', stackName: 'x', apiId: 'y' }).valid).toBe(
      true
    );
  });

  test('rejects empty object', () => {
    const result = validateAwsConfigSchema({});
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('must contain');
  });

  test('rejects array', () => {
    expect(validateAwsConfigSchema([]).valid).toBe(false);
  });

  test('rejects null', () => {
    expect(validateAwsConfigSchema(null).valid).toBe(false);
  });

  test('rejects string', () => {
    expect(validateAwsConfigSchema('{}').valid).toBe(false);
  });

  test('rejects object with only unrecognised keys', () => {
    expect(validateAwsConfigSchema({ foo: 'bar', baz: 1 }).valid).toBe(false);
  });

  test('is deterministic', () => {
    const input = { region: 'us-east-1' };
    const r1 = validateAwsConfigSchema(input);
    const r2 = validateAwsConfigSchema(input);
    expect(r1).toEqual(r2);
  });
});

// ============================================================================
// Pure Functions — buildValidationSummary
// ============================================================================

describe('buildValidationSummary (pure)', () => {
  test('returns passed=true when no issues', () => {
    const summary = buildValidationSummary({
      shellScripts: ['setup.sh'],
      shellIssues: [],
      lambdaFunctions: ['src/lambda/fn/index.js'],
      lambdaStructureResult: { valid: true, missingFiles: [] },
      awsConfigValid: true,
    });
    expect(summary.passed).toBe(true);
    expect(summary.totalIssues).toBe(0);
  });

  test('returns passed=false when shell issues exist', () => {
    const summary = buildValidationSummary({
      shellIssues: ['Missing shebang (setup.sh)'],
      lambdaStructureResult: { valid: true, missingFiles: [] },
      awsConfigValid: true,
    });
    expect(summary.passed).toBe(false);
    expect(summary.totalIssues).toBe(1);
  });

  test('counts missing Lambda files as issues', () => {
    const summary = buildValidationSummary({
      shellIssues: [],
      lambdaStructureResult: { valid: false, missingFiles: ['src/lambda/fn/package.json'] },
      awsConfigValid: true,
    });
    expect(summary.totalIssues).toBe(1);
  });

  test('counts invalid aws config as one issue', () => {
    const summary = buildValidationSummary({
      shellIssues: [],
      lambdaStructureResult: { valid: true, missingFiles: [] },
      awsConfigValid: false,
    });
    expect(summary.totalIssues).toBe(1);
    expect(summary.passed).toBe(false);
  });

  test('accumulates all issue types', () => {
    const summary = buildValidationSummary({
      shellIssues: ['Missing shebang', 'Missing pipefail'],
      lambdaStructureResult: { valid: false, missingFiles: ['f1', 'f2'] },
      awsConfigValid: false,
    });
    expect(summary.totalIssues).toBe(5); // 2 shell + 2 missing files + 1 config
  });

  test('returns correct shell and lambda counts', () => {
    const summary = buildValidationSummary({
      shellScripts: ['a.sh', 'b.sh'],
      shellIssues: [],
      lambdaFunctions: ['src/lambda/fn1/index.js', 'src/lambda/fn2/index.js'],
      lambdaStructureResult: { valid: true, missingFiles: [] },
      awsConfigValid: true,
    });
    expect(summary.shellScriptCount).toBe(2);
    expect(summary.lambdaFunctionCount).toBe(2);
  });
});

// ============================================================================
// Pure Functions — formatValidationReport
// ============================================================================

describe('formatValidationReport (pure)', () => {
  const passedSummary = {
    shellScriptCount: 2,
    shellIssueCount: 0,
    lambdaFunctionCount: 1,
    lambdaStructureValid: true,
    awsConfigValid: true,
    awsConfigReason: '',
    totalIssues: 0,
    passed: true,
  };

  test('includes Passed status for zero issues', () => {
    const report = formatValidationReport(passedSummary);
    expect(report).toContain('✅ Passed');
  });

  test('includes Failed status when issues exist', () => {
    const failedSummary = { ...passedSummary, passed: false, totalIssues: 2, shellIssueCount: 2 };
    const report = formatValidationReport(failedSummary, {
      shellIssues: ['Missing shebang', 'Missing pipefail'],
    });
    expect(report).toContain('🚨 Failed');
  });

  test('lists shell issues in report', () => {
    const failedSummary = { ...passedSummary, passed: false, totalIssues: 1, shellIssueCount: 1 };
    const report = formatValidationReport(failedSummary, {
      shellIssues: ['Missing shebang (setup.sh)'],
    });
    expect(report).toContain('Missing shebang (setup.sh)');
  });

  test('lists missing Lambda files in report', () => {
    const failedSummary = {
      ...passedSummary,
      passed: false,
      totalIssues: 1,
      lambdaStructureValid: false,
    };
    const report = formatValidationReport(failedSummary, {
      missingLambdaFiles: ['src/lambda/fn/package.json'],
    });
    expect(report).toContain('src/lambda/fn/package.json');
  });

  test('includes Recommendations section when issues exist', () => {
    const failedSummary = { ...passedSummary, passed: false, totalIssues: 1, shellIssueCount: 1 };
    const report = formatValidationReport(failedSummary, { shellIssues: ['Missing shebang'] });
    expect(report).toContain('Recommendations');
  });

  test('does not include Recommendations when passed', () => {
    const report = formatValidationReport(passedSummary);
    expect(report).not.toContain('Recommendations');
  });

  test('is deterministic', () => {
    expect(formatValidationReport(passedSummary)).toBe(formatValidationReport(passedSummary));
  });
});

// ============================================================================
// Step11_5AwsLbsValidator — stepKind contract
// ============================================================================

describe('Step11_5AwsLbsValidator — stepKind', () => {
  test('static stepKind is STEP_KIND.PROJECT', () => {
    expect(Step11_5AwsLbsValidator.stepKind).toBe(STEP_KIND.PROJECT);
  });

  test('stepKind accessible via instance constructor', () => {
    const step = new Step11_5AwsLbsValidator();
    expect(step.constructor.stepKind).toBe(STEP_KIND.PROJECT);
  });
});

// ============================================================================
// Step11_5AwsLbsValidator — skip behaviour
// ============================================================================

describe('Step11_5AwsLbsValidator — skip behaviour', () => {
  let step;
  let tempDir;

  beforeEach(async () => {
    step = new Step11_5AwsLbsValidator({ backlog: makeBacklogStub().stub });
    tempDir = path.join(process.cwd(), '.test-step-11-5', `skip-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  test.each([
    ['nodejs_api'],
    ['react_spa'],
    ['shell_script_automation'],
    ['python_app'],
    ['static_website'],
    ['generic'],
    [''],
  ])('skips for project kind "%s"', async (kind) => {
    const result = await step.execute(tempDir, { projectKind: kind });
    expect(result.success).toBe(true);
    expect(result.skipped).toBe(true);
  });

  test('skips when no projectKind provided', async () => {
    const result = await step.execute(tempDir);
    expect(result.skipped).toBe(true);
  });

  test('does NOT skip for aws_lbs_backend_setup', async () => {
    await writeAwsLbsProject(tempDir);
    const result = await step.execute(tempDir, { projectKind: 'aws_lbs_backend_setup' });
    expect(result.skipped).toBe(false);
  });
});

// ============================================================================
// Step11_5AwsLbsValidator — full execute() with canonical project
// ============================================================================

describe('Step11_5AwsLbsValidator — full execute() with canonical aws_lbs project', () => {
  let tempDir;
  let backlogCapture;

  beforeEach(async () => {
    tempDir = path.join(process.cwd(), '.test-step-11-5', `exec-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });
    backlogCapture = makeBacklogStub();
    await writeAwsLbsProject(tempDir, { strictShell: true });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  function makeStep() {
    return new Step11_5AwsLbsValidator({ backlog: backlogCapture.stub });
  }

  test('returns success:true for a fully compliant project', async () => {
    const result = await makeStep().execute(tempDir, { projectKind: 'aws_lbs_backend_setup' });
    expect(result.success).toBe(true);
  });

  test('detects shell scripts', async () => {
    const result = await makeStep().execute(tempDir, { projectKind: 'aws_lbs_backend_setup' });
    expect(result.shellScripts.length).toBeGreaterThanOrEqual(1);
  });

  test('detects Lambda handlers', async () => {
    const result = await makeStep().execute(tempDir, { projectKind: 'aws_lbs_backend_setup' });
    expect(result.lambdaFunctions.length).toBeGreaterThanOrEqual(1);
  });

  test('validates aws-config.json as valid', async () => {
    const result = await makeStep().execute(tempDir, { projectKind: 'aws_lbs_backend_setup' });
    expect(result.awsConfigValid).toBe(true);
  });

  test('no shell issues for compliant scripts', async () => {
    const result = await makeStep().execute(tempDir, { projectKind: 'aws_lbs_backend_setup' });
    expect(result.shellIssues).toHaveLength(0);
  });

  test('Lambda structure is valid', async () => {
    const result = await makeStep().execute(tempDir, { projectKind: 'aws_lbs_backend_setup' });
    expect(result.lambdaStructureResult.valid).toBe(true);
  });

  test('summary.passed is true for compliant project', async () => {
    const result = await makeStep().execute(tempDir, { projectKind: 'aws_lbs_backend_setup' });
    expect(result.summary.passed).toBe(true);
  });

  test('saves backlog report', async () => {
    await makeStep().execute(tempDir, { projectKind: 'aws_lbs_backend_setup' });
    expect(backlogCapture.calls.length).toBe(1);
    expect(backlogCapture.calls[0][0]).toBe('11_5');
    expect(backlogCapture.calls[0][1]).toBe('AWS_LBS_Validation');
    expect(typeof backlogCapture.calls[0][2]).toBe('string');
    expect(backlogCapture.calls[0][2]).toContain('AWS LBS Backend Validation Report');
  });

  test('report contains Passed status', async () => {
    const result = await makeStep().execute(tempDir, { projectKind: 'aws_lbs_backend_setup' });
    expect(result.report).toContain('✅ Passed');
  });
});

// ============================================================================
// Step11_5AwsLbsValidator — shell script violations
// ============================================================================

describe('Step11_5AwsLbsValidator — shell script violations', () => {
  let tempDir;

  beforeEach(async () => {
    tempDir = path.join(process.cwd(), '.test-step-11-5', `shell-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });
    await writeAwsLbsProject(tempDir, { strictShell: false }); // missing set -euo pipefail
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  test('detects missing set -euo pipefail', async () => {
    const { stub } = makeBacklogStub();
    const step = new Step11_5AwsLbsValidator({ backlog: stub });
    const result = await step.execute(tempDir, { projectKind: 'aws_lbs_backend_setup' });
    expect(result.shellIssues.length).toBeGreaterThan(0);
    expect(result.shellIssues.some((i) => i.includes('pipefail'))).toBe(true);
  });

  test('report contains issue details', async () => {
    const { stub } = makeBacklogStub();
    const step = new Step11_5AwsLbsValidator({ backlog: stub });
    const result = await step.execute(tempDir, { projectKind: 'aws_lbs_backend_setup' });
    expect(result.report).toContain('🚨');
  });
});

// ============================================================================
// Step11_5AwsLbsValidator — getMetadata
// ============================================================================

describe('Step11_5AwsLbsValidator — getMetadata', () => {
  test('returns metadata with id 11_5', () => {
    const step = new Step11_5AwsLbsValidator();
    const meta = step.getMetadata();
    expect(meta.id).toBe('11_5');
  });

  test('name contains AWS LBS', () => {
    const step = new Step11_5AwsLbsValidator();
    expect(step.getMetadata().name).toContain('AWS LBS');
  });

  test('canSkip is true', () => {
    const step = new Step11_5AwsLbsValidator();
    expect(step.getMetadata().canSkip).toBe(true);
  });

  test('dependencies include step_11_context', () => {
    const step = new Step11_5AwsLbsValidator();
    expect(step.getMetadata().dependencies).toContain('step_11_context');
  });
});
