/**
 * @fileoverview Integration tests for Step 0 with the aws_lbs_backend_setup project kind
 *
 * aws_lbs_backend_setup is a serverless AWS backend using Lambda, API Gateway,
 * and AWS Location Service provisioned via shell scripts.
 *
 * Detection paths verified here:
 *  • File-pattern detection: aws-config.json + *.sh + *.js → confidence 85
 *  • Directory-structure detection: src/lambda + src + scripts dirs → confidence 80
 *  • Combined signals: both paths fire → confidence capped at 100
 *  • Config-based: .workflow-config.yaml project.kind override → confidence 100
 *
 * Scenarios covered:
 *  1. Config-based detection via .workflow-config.yaml
 *  2. Auto-detection from file patterns (aws-config.json + shell + JS)
 *  3. Auto-detection from directory structure (lambda / scripts dirs)
 *  4. Combined file-pattern + directory-structure signals (max confidence)
 *  5. Partial-signal cases that should NOT detect aws_lbs_backend_setup
 *  6. Full Step0Analyzer.execute() with a canonical aws_lbs project tree
 *  7. Change-scope classification for typical aws_lbs modified-file sets
 *  8. Backlog content contains aws_lbs project-kind details
 *  9. File classification for aws_lbs artefact types
 * 10. stepKind static property contract
 *
 * @group integration
 * @group e2e
 */

import fs from 'fs/promises';
import path from 'path';

import {
  Step0Analyzer,
  CHANGE_SCOPE,
  FILE_CATEGORY,
  classifyFile,
  classifyFiles,
} from '../../src/steps/step_00_analyze.js';
import {
  ProjectKindDetector,
  detectByFilePatterns,
  detectByDirectoryStructure,
  calculateConfidence,
} from '../../src/lib/project_kind_detection.js';
import { TechStackDetector } from '../../src/lib/tech_stack.js';
import { ProjectKindConfigManager } from '../../src/lib/project_kind_config.js';
import { STEP_KIND } from '../../src/steps/step_contract.js';

const KIND = 'aws_lbs_backend_setup';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function writeFile(filePath, content) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, 'utf8');
}

function buildGitOps(overrides = {}) {
  return {
    getCommitsAhead: () => Promise.resolve(overrides.commitsAhead ?? 1),
    getTotalChanges: () => Promise.resolve(overrides.totalChanges ?? 0),
    getModifiedFiles: () => Promise.resolve(overrides.modifiedFiles ?? []),
    getStatusOutput: () => Promise.resolve(overrides.statusOutput ?? ''),
  };
}

function buildBacklogStub() {
  const issuesCalls = [];
  const summaryCalls = [];
  return {
    stub: {
      saveStepIssues: (step, name, content) => {
        issuesCalls.push({ step, name, content });
        return Promise.resolve();
      },
      saveStepSummary: (step, name, summary, status) => {
        summaryCalls.push({ step, name, summary, status });
        return Promise.resolve();
      },
    },
    issuesCalls,
    summaryCalls,
  };
}

/**
 * Write the canonical aws_lbs_backend_setup project structure:
 *
 *   <dir>/
 *   ├── aws-config.json          ← awsConfigJson indicator
 *   ├── setup-aws-lbs.sh         ← shellScripts indicator
 *   ├── README.md
 *   └── src/
 *       ├── aws-config.json
 *       ├── lambda/
 *       │   └── get-route/
 *       │       ├── index.js     ← jsFiles indicator; "lambda" dir triggers structure
 *       │       └── package.json
 *       └── scripts/
 *           ├── create-api.sh    ← "scripts" dir triggers structure
 *           └── deploy.sh
 */
async function writeAwsLbsProject(dir) {
  await writeFile(
    path.join(dir, 'aws-config.json'),
    JSON.stringify({ stackName: 'lbs-stack', region: 'us-east-1' })
  );
  await writeFile(
    path.join(dir, 'setup-aws-lbs.sh'),
    '#!/usr/bin/env bash\nset -euo pipefail\necho "Setting up AWS LBS..."\n'
  );
  await writeFile(path.join(dir, 'README.md'), '# AWS LBS Backend\n');
  await writeFile(
    path.join(dir, 'src', 'aws-config.json'),
    JSON.stringify({ apiId: '', mapName: '', routeCalculatorName: '' })
  );
  await writeFile(
    path.join(dir, 'src', 'lambda', 'get-route', 'index.js'),
    'exports.handler = async (event) => ({ statusCode: 200 });\n'
  );
  await writeFile(
    path.join(dir, 'src', 'lambda', 'get-route', 'package.json'),
    JSON.stringify({ name: 'get-route', version: '1.0.0' })
  );
  await writeFile(
    path.join(dir, 'src', 'scripts', 'create-api.sh'),
    '#!/usr/bin/env bash\nset -euo pipefail\necho "Creating API Gateway..."\n'
  );
  await writeFile(
    path.join(dir, 'src', 'scripts', 'deploy.sh'),
    '#!/usr/bin/env bash\nset -euo pipefail\necho "Deploying Lambda functions..."\n'
  );
}

async function writeWorkflowConfig(dir, kind) {
  await writeFile(
    path.join(dir, '.workflow-config.yaml'),
    `project:\n  kind: "${kind}"\n  name: "aws-lbs-project"\n`
  );
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe(`Integration: Step0Analyzer — ${KIND}`, () => {
  let tempDir;

  beforeEach(async () => {
    tempDir = path.join(
      process.cwd(),
      '.test-e2e',
      `step-00-aws-lbs-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    await fs.mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  // =========================================================================
  // 1. Config-based detection via .workflow-config.yaml
  // =========================================================================

  describe('Config-based detection via .workflow-config.yaml', () => {
    test('reads aws_lbs_backend_setup kind from .workflow-config.yaml', async () => {
      await writeWorkflowConfig(tempDir, KIND);
      const configMgr = new ProjectKindConfigManager({ projectRoot: tempDir });

      const kind = await configMgr.getProjectKind();

      expect(kind).toBe(KIND);
    });

    test('Step0Analyzer uses config kind with confidence=100', async () => {
      await writeWorkflowConfig(tempDir, KIND);
      const { stub } = buildBacklogStub();

      const analyzer = new Step0Analyzer({
        gitOps: buildGitOps(),
        projectDetection: new ProjectKindDetector(),
        projectKindConfig: new ProjectKindConfigManager({ projectRoot: tempDir }),
        backlogManager: stub,
      });

      const result = await analyzer.execute(tempDir);

      expect(result.success).toBe(true);
      expect(result.analysis.projectKind.kind).toBe(KIND);
      expect(result.analysis.projectKind.confidence).toBe(100);
    });

    test('config-sourced kind has source = "config"', async () => {
      await writeWorkflowConfig(tempDir, KIND);
      const analyzer = new Step0Analyzer({
        gitOps: buildGitOps(),
        projectDetection: new ProjectKindDetector(),
        projectKindConfig: new ProjectKindConfigManager({ projectRoot: tempDir }),
      });

      const result = await analyzer.execute(tempDir);

      expect(result.analysis.projectKind.source).toBe('config');
    });

    test('config kind overrides a full aws_lbs project tree auto-detection', async () => {
      // Write the full project AND a config that says something different
      await writeAwsLbsProject(tempDir);
      await writeWorkflowConfig(tempDir, 'shell_script_automation'); // override

      const analyzer = new Step0Analyzer({
        gitOps: buildGitOps(),
        projectDetection: new ProjectKindDetector(),
        projectKindConfig: new ProjectKindConfigManager({ projectRoot: tempDir }),
      });

      const result = await analyzer.execute(tempDir);

      expect(result.analysis.projectKind.kind).toBe('shell_script_automation');
      expect(result.analysis.projectKind.source).toBe('config');
    });
  });

  // =========================================================================
  // 2. Auto-detection — file-pattern signal
  // =========================================================================

  describe('Auto-detection via file-pattern signal', () => {
    test('detectByFilePatterns returns aws_lbs_backend_setup with correct signals', () => {
      // Basenames that satisfy: awsConfigJson>0, shellScripts>0, jsFiles>0
      const files = ['aws-config.json', 'setup-aws-lbs.sh', 'index.js', 'package.json', 'README.md'];

      const result = detectByFilePatterns(files);

      expect(result.kind).toBe(KIND);
      expect(result.confidence).toBe(85);
      expect(result.indicators).toContain('aws_config_json');
      expect(result.indicators).toContain('aws_lambda_js');
    });

    test('ProjectKindDetector auto-detects aws_lbs from real aws-config.json + .sh + .js files', async () => {
      await writeAwsLbsProject(tempDir);
      const detector = new ProjectKindDetector();

      const result = await detector.detectProjectKind(tempDir);

      expect(result.kind).toBe(KIND);
      expect(result.confidence).toBeGreaterThanOrEqual(85);
    });

    test('Step0Analyzer auto-detects aws_lbs (no config file)', async () => {
      await writeAwsLbsProject(tempDir);

      const analyzer = new Step0Analyzer({
        gitOps: buildGitOps(),
        projectDetection: new ProjectKindDetector(),
        projectKindConfig: new ProjectKindConfigManager({ projectRoot: tempDir }),
      });

      const result = await analyzer.execute(tempDir);

      expect(result.success).toBe(true);
      expect(result.analysis.projectKind.kind).toBe(KIND);
      expect(result.analysis.projectKind.source).toBe('auto-detected');
    });
  });

  // =========================================================================
  // 3. Auto-detection — directory-structure signal
  // =========================================================================

  describe('Auto-detection via directory-structure signal', () => {
    test('detectByDirectoryStructure returns aws_lbs for lambda+src+scripts dirs', () => {
      // Basenames of directories
      const dirs = ['src', 'lambda', 'scripts', 'get-route'];

      const result = detectByDirectoryStructure(dirs);

      expect(result.kind).toBe(KIND);
      expect(result.confidence).toBe(80);
      expect(result.indicators).toContain('lambda_structure');
      expect(result.indicators).toContain('scripts_structure');
    });

    test('directory-structure signal fires independently of file patterns', () => {
      // Only directory basenames, no specific file names
      const dirs = ['src', 'lambda', 'scripts'];

      const result = detectByDirectoryStructure(dirs);

      expect(result.kind).toBe(KIND);
    });

    test('missing "scripts" dir prevents directory-structure detection', () => {
      const dirs = ['src', 'lambda']; // scripts missing

      const result = detectByDirectoryStructure(dirs);

      expect(result.kind).not.toBe(KIND);
    });

    test('missing "lambda" dir prevents directory-structure detection', () => {
      const dirs = ['src', 'scripts']; // lambda missing

      const result = detectByDirectoryStructure(dirs);

      expect(result.kind).not.toBe(KIND);
    });
  });

  // =========================================================================
  // 4. Combined signals — file pattern + directory structure
  // =========================================================================

  describe('Combined file-pattern + directory-structure signals', () => {
    test('calculateConfidence combines both signals and caps at 100', () => {
      const results = [
        { kind: KIND, confidence: 85, indicators: ['aws_config_json', 'aws_lambda_js'] },
        { kind: KIND, confidence: 80, indicators: ['lambda_structure', 'scripts_structure'] },
      ];

      const final = calculateConfidence(results);

      expect(final.kind).toBe(KIND);
      expect(final.confidence).toBe(100); // 85+80=165, capped at 100
    });

    test('combined detection includes all indicators', () => {
      const results = [
        { kind: KIND, confidence: 85, indicators: ['aws_config_json', 'aws_lambda_js'] },
        { kind: KIND, confidence: 80, indicators: ['lambda_structure', 'scripts_structure'] },
      ];

      const final = calculateConfidence(results);

      expect(final.indicators).toContain('aws_config_json');
      expect(final.indicators).toContain('aws_lambda_js');
      expect(final.indicators).toContain('lambda_structure');
      expect(final.indicators).toContain('scripts_structure');
    });

    test('full canonical project tree yields confidence = 100 from real detector', async () => {
      await writeAwsLbsProject(tempDir);
      const detector = new ProjectKindDetector();

      const result = await detector.detectProjectKind(tempDir);

      expect(result.kind).toBe(KIND);
      expect(result.confidence).toBe(100);
    });
  });

  // =========================================================================
  // 5. Partial-signal cases — should NOT detect aws_lbs_backend_setup
  // =========================================================================

  describe('Partial-signal cases (should not detect aws_lbs_backend_setup)', () => {
    test('aws-config.json alone (no .sh or .js) does not trigger file-pattern detection', () => {
      const files = ['aws-config.json', 'README.md'];

      const result = detectByFilePatterns(files);

      expect(result.kind).not.toBe(KIND);
    });

    test('aws-config.json + .sh but no .js does not trigger file-pattern detection', () => {
      const files = ['aws-config.json', 'deploy.sh', 'README.md'];

      const result = detectByFilePatterns(files);

      expect(result.kind).not.toBe(KIND);
    });

    test('aws-config.json + .js but no .sh does not trigger file-pattern detection', () => {
      const files = ['aws-config.json', 'index.js', 'README.md'];

      const result = detectByFilePatterns(files);

      expect(result.kind).not.toBe(KIND);
    });

    test('.sh + .js without aws-config.json does not trigger aws_lbs detection', () => {
      const files = ['setup.sh', 'index.js', 'helper.js'];

      const result = detectByFilePatterns(files);

      expect(result.kind).not.toBe(KIND);
    });

    test('directory signal alone (lambda+src+scripts) without file patterns still detects aws_lbs', async () => {
      // Create only the directory structure, no aws-config.json etc.
      await fs.mkdir(path.join(tempDir, 'src', 'lambda'), { recursive: true });
      await fs.mkdir(path.join(tempDir, 'src', 'scripts'), { recursive: true });
      await writeFile(path.join(tempDir, 'src', 'lambda', '.gitkeep'), '');
      await writeFile(path.join(tempDir, 'src', 'scripts', '.gitkeep'), '');

      const detector = new ProjectKindDetector();
      const result = await detector.detectProjectKind(tempDir);

      // Directory structure alone should still detect aws_lbs (confidence 80)
      expect(result.kind).toBe(KIND);
    });
  });

  // =========================================================================
  // 6. Full Step0Analyzer.execute() with canonical aws_lbs project tree
  // =========================================================================

  describe('Full execute() with canonical aws_lbs project tree', () => {
    let analyzer;
    let backlogCapture;

    beforeEach(async () => {
      await writeAwsLbsProject(tempDir);
      backlogCapture = buildBacklogStub();

      analyzer = new Step0Analyzer({
        gitOps: buildGitOps({
          commitsAhead: 3,
          totalChanges: 4,
          modifiedFiles: [
            'setup-aws-lbs.sh',
            'src/scripts/create-api.sh',
            'src/lambda/get-route/index.js',
            'src/aws-config.json',
          ],
          statusOutput: 'M  setup-aws-lbs.sh\nM  src/lambda/get-route/index.js',
        }),
        projectDetection: new ProjectKindDetector(),
        techStackDetection: new TechStackDetector({ projectRoot: tempDir }),
        projectKindConfig: new ProjectKindConfigManager({ projectRoot: tempDir }),
        backlogManager: backlogCapture.stub,
      });
    });

    test('execute() returns success:true', async () => {
      const result = await analyzer.execute(tempDir);
      expect(result.success).toBe(true);
    });

    test('detects aws_lbs_backend_setup kind', async () => {
      const result = await analyzer.execute(tempDir);
      expect(result.analysis.projectKind.kind).toBe(KIND);
    });

    test('reports commitsAhead correctly', async () => {
      const result = await analyzer.execute(tempDir);
      expect(result.analysis.commitsAhead).toBe(3);
    });

    test('reports modifiedFiles count correctly', async () => {
      const result = await analyzer.execute(tempDir);
      expect(result.analysis.modifiedFiles).toBe(4);
    });

    test('analysis includes modifiedFilesList', async () => {
      const result = await analyzer.execute(tempDir);
      expect(result.analysis.modifiedFilesList).toContain('setup-aws-lbs.sh');
      expect(result.analysis.modifiedFilesList).toContain('src/lambda/get-route/index.js');
    });

    test('analysis includes a numeric timestamp', async () => {
      const before = Date.now();
      const result = await analyzer.execute(tempDir);
      expect(result.analysis.timestamp).toBeGreaterThanOrEqual(before);
    });

    test('saves backlog with project kind details', async () => {
      await analyzer.execute(tempDir);
      const { issuesCalls } = backlogCapture;
      expect(issuesCalls.length).toBeGreaterThan(0);
      expect(issuesCalls[0].content).toContain('**Commits Ahead:** 3');
      expect(issuesCalls[0].content).toContain('**Modified Files:** 4');
    });
  });

  // =========================================================================
  // 7. Change-scope classification for typical aws_lbs modified-file sets
  // =========================================================================

  describe('Change-scope classification for aws_lbs file types', () => {
    function makeAnalyzer(modifiedFiles) {
      return new Step0Analyzer({
        gitOps: buildGitOps({ totalChanges: modifiedFiles.length, modifiedFiles }),
      });
    }

    test('shell scripts (.sh) classified as SOURCE', () => {
      expect(classifyFile('setup-aws-lbs.sh')).toBe(FILE_CATEGORY.SOURCE);
      expect(classifyFile('src/scripts/create-api.sh')).toBe(FILE_CATEGORY.SOURCE);
      expect(classifyFile('src/scripts/deploy.sh')).toBe(FILE_CATEGORY.SOURCE);
    });

    test('Lambda handlers (.js) classified as SOURCE', () => {
      expect(classifyFile('src/lambda/get-route/index.js')).toBe(FILE_CATEGORY.SOURCE);
    });

    test('aws-config.json classified as CONFIG', () => {
      expect(classifyFile('aws-config.json')).toBe(FILE_CATEGORY.CONFIG);
      expect(classifyFile('src/aws-config.json')).toBe(FILE_CATEGORY.CONFIG);
    });

    test('Lambda package.json classified as CONFIG', () => {
      expect(classifyFile('src/lambda/get-route/package.json')).toBe(FILE_CATEGORY.CONFIG);
    });

    test('only shell scripts changed → SOURCE_CODE scope', async () => {
      const result = await makeAnalyzer([
        'setup-aws-lbs.sh',
        'src/scripts/create-api.sh',
      ]).execute(tempDir);

      expect(result.analysis.changeScope).toBe(CHANGE_SCOPE.SOURCE_CODE);
    });

    test('only aws-config.json changed → CONFIGURATION scope', async () => {
      const result = await makeAnalyzer(['src/aws-config.json']).execute(tempDir);

      expect(result.analysis.changeScope).toBe(CHANGE_SCOPE.CONFIGURATION);
    });

    test('shell scripts + Lambda JS → SOURCE_CODE scope (both are SOURCE)', async () => {
      const result = await makeAnalyzer([
        'setup-aws-lbs.sh',
        'src/lambda/get-route/index.js',
      ]).execute(tempDir);

      expect(result.analysis.changeScope).toBe(CHANGE_SCOPE.SOURCE_CODE);
    });

    test('shell scripts + README → CODE_AND_DOCS scope', async () => {
      const result = await makeAnalyzer([
        'setup-aws-lbs.sh',
        'README.md',
      ]).execute(tempDir);

      expect(result.analysis.changeScope).toBe(CHANGE_SCOPE.CODE_AND_DOCS);
    });

    test('full release (scripts + JS + README + config) → FULL_STACK or MIXED_CHANGES', async () => {
      const result = await makeAnalyzer([
        'setup-aws-lbs.sh',                     // source
        'src/lambda/get-route/index.js',         // source
        'README.md',                             // documentation
        'src/aws-config.json',                   // config
      ]).execute(tempDir);

      // src>0, test=0, docs>0 → CODE_AND_DOCS (no tests in aws_lbs)
      // But config also present → MIXED_CHANGES
      expect([CHANGE_SCOPE.CODE_AND_DOCS, CHANGE_SCOPE.MIXED_CHANGES, CHANGE_SCOPE.FULL_STACK])
        .toContain(result.analysis.changeScope);
    });

    test('classifyFiles counts shell+JS under source for aws_lbs files', () => {
      const { counts } = classifyFiles([
        'setup-aws-lbs.sh',
        'src/scripts/create-api.sh',
        'src/lambda/get-route/index.js',
        'README.md',
        'aws-config.json',
      ]);

      expect(counts.source).toBe(3);       // 2 .sh + 1 .js
      expect(counts.documentation).toBe(1); // README.md
      expect(counts.config).toBe(1);        // aws-config.json
      expect(counts.test).toBe(0);          // no tests (none in aws_lbs)
    });
  });

  // =========================================================================
  // 8. Backlog content contains aws_lbs project-kind details
  // =========================================================================

  describe('Backlog content for aws_lbs_backend_setup', () => {
    test('saveStepIssues content includes change-scope for shell-only changes', async () => {
      await writeWorkflowConfig(tempDir, KIND);
      const { stub, issuesCalls } = buildBacklogStub();

      const analyzer = new Step0Analyzer({
        gitOps: buildGitOps({
          totalChanges: 2,
          modifiedFiles: ['setup-aws-lbs.sh', 'src/scripts/deploy.sh'],
        }),
        projectDetection: new ProjectKindDetector(),
        projectKindConfig: new ProjectKindConfigManager({ projectRoot: tempDir }),
        backlogManager: stub,
      });

      await analyzer.execute(tempDir);

      expect(issuesCalls[0].content).toContain('**Change Scope:** source-code');
    });

    test('saveStepIssues content includes Project Kind section', async () => {
      await writeWorkflowConfig(tempDir, KIND);
      const { stub, issuesCalls } = buildBacklogStub();

      const analyzer = new Step0Analyzer({
        gitOps: buildGitOps(),
        projectDetection: new ProjectKindDetector(),
        projectKindConfig: new ProjectKindConfigManager({ projectRoot: tempDir }),
        backlogManager: stub,
      });

      await analyzer.execute(tempDir);

      expect(issuesCalls[0].content).toContain('### Project Kind');
      expect(issuesCalls[0].content).toContain(KIND);
    });

    test('saveStepSummary includes change-scope in message', async () => {
      const { stub, summaryCalls } = buildBacklogStub();

      const analyzer = new Step0Analyzer({
        gitOps: buildGitOps({
          totalChanges: 3,
          modifiedFiles: ['setup-aws-lbs.sh', 'src/scripts/deploy.sh', 'src/lambda/get-route/index.js'],
        }),
        backlogManager: stub,
      });

      await analyzer.execute(tempDir);

      expect(summaryCalls[0].summary).toContain('3 modified files');
      expect(summaryCalls[0].summary).toContain('source-code');
      expect(summaryCalls[0].status).toBe('✅');
    });
  });

  // =========================================================================
  // 9. stepKind static property contract
  // =========================================================================

  describe('stepKind static property', () => {
    test('Step0Analyzer.stepKind is STEP_KIND.PROJECT', () => {
      expect(Step0Analyzer.stepKind).toBe(STEP_KIND.PROJECT);
    });

    test('stepKind is accessible on an instance via its constructor', () => {
      const analyzer = new Step0Analyzer({ gitOps: buildGitOps() });
      expect(analyzer.constructor.stepKind).toBe(STEP_KIND.PROJECT);
    });
  });
});
