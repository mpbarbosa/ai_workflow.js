/**
 * @fileoverview Integration tests for Step 1 with the aws_lbs_backend_setup project kind
 *
 * Focus: verify that the AI workflow prompt is CORRECT according to the
 * configuration defined in .workflow_core/config/project_kinds.yaml.
 *
 * The tests exercise three layers in sequence:
 *
 *  Layer 1 — Config correctness
 *    ProjectKindConfigManager reads the real project_kinds.yaml and exposes all
 *    aws_lbs_backend_setup sections accurately (ai_guidance, quality, validation,
 *    testing, deployment).
 *
 *  Layer 2 — Prompt correctness
 *    Pure prompt-builder functions and the PromptBuilder wrapper produce prompts
 *    that reflect the aws_lbs project kind context and file types defined in the
 *    config (*.sh sources, Lambda *.js handlers, aws-config.json config files).
 *
 *  Layer 3 — Step 1 correctness
 *    Step1DocumentationAnalyzer classifies aws_lbs file types correctly and
 *    calls the prompt builder with context consistent with the config (no test
 *    framework, shell + JS sources, markdown API docs).
 *
 * @group integration
 * @group e2e
 */

import fs from 'fs/promises';
import path from 'path';

import {
  Step1DocumentationAnalyzer,
  classifyChangedFiles,
  shouldRunAiAnalysis,
  validateDocumentationCounts,
  checkVersionReferences,
} from '../../src/steps/step_01_documentation.js';

import {
  buildDocAnalysisPrompt,
  buildPromptFromTemplate,
  injectProjectContext,
  buildFileListContext,
  PromptBuilder,
} from '../../src/lib/ai_prompt_builder.js';

import {
  ProjectKindConfigManager,
  extractConfigSection,
  parseYaml,
  validateProjectStructure,
} from '../../src/lib/project_kind_config.js';

import { STEP_KIND } from '../../src/steps/step_contract.js';

const KIND = 'aws_lbs_backend_setup';

// Path to the real project_kinds.yaml (canonical source of truth)
const PROJECT_ROOT = process.cwd(); // ai_workflow.js repo root
const REAL_YAML_PATH = path.join(PROJECT_ROOT, '.workflow_core', 'config', 'project_kinds.yaml');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function writeFile(filePath, content) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, 'utf8');
}

function buildBacklogStub() {
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

/** Real ProjectKindConfigManager pointing at the shipped .workflow_core config. */
function buildRealConfigManager() {
  return new ProjectKindConfigManager({ projectRoot: PROJECT_ROOT });
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe(`Integration: Step 1 prompt correctness — ${KIND}`, () => {
  let tempDir;

  beforeEach(async () => {
    tempDir = path.join(
      PROJECT_ROOT,
      '.test-e2e',
      `step-01-aws-lbs-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    await fs.mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  // =========================================================================
  // Layer 1 — Config correctness
  // Verify ProjectKindConfigManager reads aws_lbs values from the real YAML
  // =========================================================================

  describe('Layer 1: Config correctness (project_kinds.yaml → aws_lbs_backend_setup)', () => {
    let configMgr;

    beforeAll(() => {
      configMgr = buildRealConfigManager();
    });

    // --- Metadata ---

    test('real YAML exists and is parseable', async () => {
      const content = await fs.readFile(REAL_YAML_PATH, 'utf8');
      const parsed = parseYaml(content);
      expect(parsed).not.toBeNull();
      expect(typeof parsed.project_kinds).toBe('object');
    });

    test(`${KIND} is a recognised project kind in the YAML`, async () => {
      const kinds = await configMgr.getSupportedProjectKinds();
      expect(kinds).toContain(KIND);
    });

    test('loadConfig returns config with expected name', async () => {
      const config = await configMgr.loadConfig(KIND);
      expect(config).not.toBeNull();
      expect(config.name).toBe('AWS LBS Backend Setup');
    });

    test('loadConfig returns correct description (serverless AWS backend)', async () => {
      const config = await configMgr.loadConfig(KIND);
      expect(config.description).toContain('Lambda');
      expect(config.description).toContain('shell scripts');
    });

    // --- Testing config ---

    test('getTestingConfig: test_framework is "none"', async () => {
      const testing = await configMgr.getTestingConfig(KIND);
      expect(testing.test_framework).toBe('none');
    });

    test('getTestingConfig: coverage_required is false', async () => {
      const testing = await configMgr.getTestingConfig(KIND);
      expect(testing.coverage_required).toBe(false);
    });

    test('getTestingConfig: coverage_threshold is 0', async () => {
      const testing = await configMgr.getTestingConfig(KIND);
      expect(testing.coverage_threshold).toBe(0);
    });

    // --- Quality standards ---

    test('getQualityStandards: documentation_required is true', async () => {
      const quality = await configMgr.getQualityStandards(KIND);
      expect(quality.documentation_required).toBe(true);
    });

    test('getQualityStandards: readme_required is true', async () => {
      const quality = await configMgr.getQualityStandards(KIND);
      expect(quality.readme_required).toBe(true);
    });

    test('getQualityStandards: api_documentation_required is true', async () => {
      const quality = await configMgr.getQualityStandards(KIND);
      expect(quality.api_documentation_required).toBe(true);
    });

    test('getQualityStandards: api_documentation_format is "markdown"', async () => {
      const quality = await configMgr.getQualityStandards(KIND);
      expect(quality.api_documentation_format).toBe('markdown');
    });

    test('getQualityStandards: shellcheck linter is enabled', async () => {
      const quality = await configMgr.getQualityStandards(KIND);
      const shellcheck = quality.linters.find((l) => l.name === 'shellcheck');
      expect(shellcheck).toBeDefined();
      expect(shellcheck.enabled).toBe(true);
    });

    test('getQualityStandards: shellcheck command and args are correct', async () => {
      const quality = await configMgr.getQualityStandards(KIND);
      const shellcheck = quality.linters.find((l) => l.name === 'shellcheck');
      expect(shellcheck.command).toBe('shellcheck');
      expect(shellcheck.args).toEqual(['-x', '-S', 'warning']);
      expect(shellcheck.file_pattern).toBe('*.sh');
    });

    // --- Validation rules ---

    test('getValidationRules: required_files includes *.sh', async () => {
      const validation = await configMgr.getValidationRules(KIND);
      expect(validation.required_files).toContain('*.sh');
    });

    test('getValidationRules: required_files includes src/aws-config.json', async () => {
      const validation = await configMgr.getValidationRules(KIND);
      expect(validation.required_files).toContain('src/aws-config.json');
    });

    test('getValidationRules: required_directories includes src/lambda', async () => {
      const validation = await configMgr.getValidationRules(KIND);
      expect(validation.required_directories).toContain('src/lambda');
    });

    test('getValidationRules: required_directories includes src/scripts', async () => {
      const validation = await configMgr.getValidationRules(KIND);
      expect(validation.required_directories).toContain('src/scripts');
    });

    // --- AI guidance ---

    test('getAIGuidance: returns non-null object', async () => {
      const guidance = await configMgr.getAIGuidance(KIND);
      expect(guidance).not.toBeNull();
      expect(typeof guidance).toBe('object');
    });

    test('getAIGuidance: best_practices contains idempotent scripts rule', async () => {
      const guidance = await configMgr.getAIGuidance(KIND);
      const hasIdempotent = guidance.best_practices.some((bp) =>
        bp.toLowerCase().includes('idempotent')
      );
      expect(hasIdempotent).toBe(true);
    });

    test('getAIGuidance: best_practices contains set -euo pipefail rule', async () => {
      const guidance = await configMgr.getAIGuidance(KIND);
      const hasPipefail = guidance.best_practices.some((bp) => bp.includes('set -euo pipefail'));
      expect(hasPipefail).toBe(true);
    });

    test('getAIGuidance: best_practices contains jq-for-JSON rule', async () => {
      const guidance = await configMgr.getAIGuidance(KIND);
      const hasJq = guidance.best_practices.some((bp) => bp.toLowerCase().includes('jq'));
      expect(hasJq).toBe(true);
    });

    test('getAIGuidance: best_practices contains src/aws-config.json storage rule', async () => {
      const guidance = await configMgr.getAIGuidance(KIND);
      const hasAwsConfig = guidance.best_practices.some((bp) => bp.includes('src/aws-config.json'));
      expect(hasAwsConfig).toBe(true);
    });

    test('getAIGuidance: testing_standards contain AWS CLI verification', async () => {
      const guidance = await configMgr.getAIGuidance(KIND);
      const hasAwsCli = guidance.testing_standards.some((ts) => ts.toLowerCase().includes('aws'));
      expect(hasAwsCli).toBe(true);
    });

    test('getAIGuidance: testing_standards contain curl smoke-test rule', async () => {
      const guidance = await configMgr.getAIGuidance(KIND);
      const hasCurl = guidance.testing_standards.some((ts) => ts.toLowerCase().includes('curl'));
      expect(hasCurl).toBe(true);
    });

    test('getAIGuidance: testing_standards contain CloudWatch Logs check', async () => {
      const guidance = await configMgr.getAIGuidance(KIND);
      const hasCloudWatch = guidance.testing_standards.some((ts) => ts.includes('CloudWatch'));
      expect(hasCloudWatch).toBe(true);
    });

    test('getAIGuidance: style_guides contain Google Shell Style Guide', async () => {
      const guidance = await configMgr.getAIGuidance(KIND);
      const hasGoogle = guidance.style_guides.some((sg) => sg.includes('Google Shell Style Guide'));
      expect(hasGoogle).toBe(true);
    });

    test('getAIGuidance: style_guides contain AWS Lambda Node.js best practices', async () => {
      const guidance = await configMgr.getAIGuidance(KIND);
      const hasLambda = guidance.style_guides.some((sg) =>
        sg.includes('AWS Lambda Node.js best practices')
      );
      expect(hasLambda).toBe(true);
    });

    test('getAIGuidance: style_guides contain AWS Well-Architected Framework', async () => {
      const guidance = await configMgr.getAIGuidance(KIND);
      const hasWAF = guidance.style_guides.some((sg) =>
        sg.includes('AWS Well-Architected Framework')
      );
      expect(hasWAF).toBe(true);
    });

    test('getAIGuidance: directory_standards contain src/lambda pattern', async () => {
      const guidance = await configMgr.getAIGuidance(KIND);
      const hasLambdaDir = guidance.directory_standards.some((ds) => ds.includes('src/lambda'));
      expect(hasLambdaDir).toBe(true);
    });

    test('getAIGuidance: directory_standards contain src/scripts pattern', async () => {
      const guidance = await configMgr.getAIGuidance(KIND);
      const hasScripts = guidance.directory_standards.some((ds) => ds.includes('src/scripts'));
      expect(hasScripts).toBe(true);
    });

    test('getAIGuidance: directory_standards contain setup-aws-lbs.sh orchestration role', async () => {
      const guidance = await configMgr.getAIGuidance(KIND);
      const hasOrchestration = guidance.directory_standards.some((ds) =>
        ds.includes('setup-aws-lbs.sh')
      );
      expect(hasOrchestration).toBe(true);
    });

    // --- Deployment config ---

    test('getDeploymentConfig: type is "serverless"', async () => {
      const deployment = await configMgr.getDeploymentConfig(KIND);
      expect(deployment.type).toBe('serverless');
    });

    test('getDeploymentConfig: requires_build is true', async () => {
      const deployment = await configMgr.getDeploymentConfig(KIND);
      expect(deployment.requires_build).toBe(true);
    });

    test('getDeploymentConfig: artifact_patterns include *.sh', async () => {
      const deployment = await configMgr.getDeploymentConfig(KIND);
      expect(deployment.artifact_patterns).toContain('*.sh');
    });

    test('getDeploymentConfig: artifact_patterns include src/lambda/**/*.js', async () => {
      const deployment = await configMgr.getDeploymentConfig(KIND);
      expect(deployment.artifact_patterns).toContain('src/lambda/**/*.js');
    });

    test('getDeploymentConfig: artifact_patterns include src/aws-config.json', async () => {
      const deployment = await configMgr.getDeploymentConfig(KIND);
      expect(deployment.artifact_patterns).toContain('src/aws-config.json');
    });
  });

  // =========================================================================
  // Layer 2 — Prompt correctness
  // Verify prompt-builder functions produce correct output for aws_lbs context
  // =========================================================================

  describe('Layer 2: Prompt correctness (prompt builder + aws_lbs context)', () => {
    // The canonical "projectInfo" a caller would build from the config
    const awsLbsProjectInfo = {
      language: 'shell',
      projectKind: KIND,
      techStack: ['bash', 'javascript', 'aws-lambda', 'api-gateway'],
    };

    // --- Pure function: injectProjectContext ---

    test('injectProjectContext injects project kind into prompt', () => {
      const base = 'Analyse the project documentation.';
      const result = injectProjectContext(base, awsLbsProjectInfo);

      expect(result).toContain(KIND);
    });

    test('injectProjectContext injects language = shell', () => {
      const base = 'Review docs.';
      const result = injectProjectContext(base, awsLbsProjectInfo);

      expect(result).toContain('shell');
    });

    test('injectProjectContext injects tech stack entries', () => {
      const base = 'Review docs.';
      const result = injectProjectContext(base, awsLbsProjectInfo);

      expect(result).toContain('aws-lambda');
      expect(result).toContain('api-gateway');
    });

    test('injectProjectContext adds **Project Context** heading', () => {
      const base = 'Task.';
      const result = injectProjectContext(base, awsLbsProjectInfo);

      expect(result).toContain('**Project Context**');
    });

    // --- Pure function: buildFileListContext for aws_lbs file types ---

    test('buildFileListContext lists aws_lbs shell scripts correctly', () => {
      const files = ['setup-aws-lbs.sh', 'src/scripts/create-api.sh', 'src/scripts/deploy.sh'];
      const result = buildFileListContext(files);

      expect(result).toContain('setup-aws-lbs.sh');
      expect(result).toContain('src/scripts/create-api.sh');
      expect(result).toContain('src/scripts/deploy.sh');
    });

    test('buildFileListContext lists Lambda handler files correctly', () => {
      const files = ['src/lambda/get-route/index.js'];
      const result = buildFileListContext(files);

      expect(result).toContain('src/lambda/get-route/index.js');
    });

    test('buildFileListContext groups aws_lbs files by extension correctly', () => {
      const files = ['setup-aws-lbs.sh', 'src/scripts/deploy.sh', 'src/lambda/get-route/index.js'];
      const result = buildFileListContext(files, { groupByType: true });

      expect(result).toContain('**sh files**');
      expect(result).toContain('**js files**');
    });

    // --- Pure function: buildDocAnalysisPrompt for aws_lbs scenario ---

    test('buildDocAnalysisPrompt contains documentation-specialist role', () => {
      const prompt = buildDocAnalysisPrompt({
        changedFiles: ['setup-aws-lbs.sh', 'src/lambda/get-route/index.js'],
        docFiles: ['README.md'],
        projectInfo: awsLbsProjectInfo,
      });

      expect(prompt).toContain('documentation specialist');
    });

    test('buildDocAnalysisPrompt lists changed shell scripts in task section', () => {
      const changedFiles = ['setup-aws-lbs.sh', 'src/scripts/deploy.sh'];
      const prompt = buildDocAnalysisPrompt({
        changedFiles,
        docFiles: ['README.md'],
        projectInfo: awsLbsProjectInfo,
      });

      expect(prompt).toContain('setup-aws-lbs.sh');
      expect(prompt).toContain('src/scripts/deploy.sh');
    });

    test('buildDocAnalysisPrompt lists changed Lambda JS file in task section', () => {
      const changedFiles = ['src/lambda/get-route/index.js'];
      const prompt = buildDocAnalysisPrompt({
        changedFiles,
        docFiles: ['README.md'],
        projectInfo: awsLbsProjectInfo,
      });

      expect(prompt).toContain('src/lambda/get-route/index.js');
    });

    test('buildDocAnalysisPrompt lists documentation target files', () => {
      const prompt = buildDocAnalysisPrompt({
        changedFiles: ['setup-aws-lbs.sh'],
        docFiles: ['README.md', 'src/lambda/get-route/README.md'],
        projectInfo: awsLbsProjectInfo,
      });

      expect(prompt).toContain('README.md');
      expect(prompt).toContain('src/lambda/get-route/README.md');
    });

    test('buildDocAnalysisPrompt injects aws_lbs project kind into context section', () => {
      const prompt = buildDocAnalysisPrompt({
        changedFiles: ['setup-aws-lbs.sh'],
        docFiles: ['README.md'],
        projectInfo: awsLbsProjectInfo,
      });

      expect(prompt).toContain(KIND);
    });

    test('buildDocAnalysisPrompt contains "No updates needed" behavioral guideline', () => {
      const prompt = buildDocAnalysisPrompt({
        changedFiles: ['setup-aws-lbs.sh'],
        docFiles: ['README.md'],
        projectInfo: awsLbsProjectInfo,
      });

      expect(prompt).toContain('No updates needed');
    });

    test('buildDocAnalysisPrompt contains methodology section with 4-step approach', () => {
      const prompt = buildDocAnalysisPrompt({
        changedFiles: ['setup-aws-lbs.sh'],
        docFiles: ['README.md'],
        projectInfo: awsLbsProjectInfo,
      });

      // Methodology steps
      expect(prompt).toContain('Analyze Changes');
      expect(prompt).toContain('Prioritize Updates');
      expect(prompt).toContain('Edit Surgically');
      expect(prompt).toContain('Verify Consistency');
    });

    test('buildDocAnalysisPrompt without projectInfo still has correct structure', () => {
      const prompt = buildDocAnalysisPrompt({
        changedFiles: ['setup-aws-lbs.sh'],
        docFiles: ['README.md'],
      });

      // Core structure must be present even without project context
      expect(prompt).toContain('**Role**');
      expect(prompt).toContain('**Task**');
      expect(prompt).toContain('**Approach**');
    });

    // --- PromptBuilder class wrapper ---

    test('PromptBuilder.buildDocAnalysis with aws_lbs projectInfo injects kind', () => {
      const builder = new PromptBuilder({ projectInfo: awsLbsProjectInfo });
      const prompt = builder.buildDocAnalysis({
        changedFiles: ['setup-aws-lbs.sh'],
        docFiles: ['README.md'],
      });

      expect(prompt).toContain(KIND);
    });

    test('PromptBuilder.buildDocAnalysis output is a non-empty string', () => {
      const builder = new PromptBuilder({ projectInfo: awsLbsProjectInfo });
      const prompt = builder.buildDocAnalysis({
        changedFiles: ['setup-aws-lbs.sh'],
        docFiles: ['README.md'],
      });

      expect(typeof prompt).toBe('string');
      expect(prompt.length).toBeGreaterThan(100);
    });

    test('PromptBuilder.buildDocAnalysis respects maxTokens limit (truncation)', () => {
      // With a very small maxTokens, the prompt should be truncated
      const builder = new PromptBuilder({ maxTokens: 20, projectInfo: awsLbsProjectInfo });
      const prompt = builder.buildDocAnalysis({
        changedFiles: ['setup-aws-lbs.sh'],
        docFiles: ['README.md'],
      });

      // 20 tokens × 4 chars/token = 80 chars max
      // Minus truncation message "...(truncated)"
      expect(prompt.length).toBeLessThanOrEqual(80 + '...(truncated)'.length);
    });

    test('PromptBuilder.buildDocAnalysis per-call projectInfo overrides instance default', () => {
      const builder = new PromptBuilder({
        projectInfo: { projectKind: 'nodejs_api', language: 'javascript' },
      });
      // Call-level override should win
      const prompt = builder.buildDocAnalysis({
        changedFiles: ['setup-aws-lbs.sh'],
        docFiles: ['README.md'],
        projectInfo: { projectKind: KIND },
      });

      expect(prompt).toContain(KIND);
    });

    // --- buildPromptFromTemplate (used internally by structured prompts) ---

    test('buildPromptFromTemplate substitutes {projectKind} placeholder', () => {
      const template = 'Analyse docs for project kind: {projectKind}';
      const result = buildPromptFromTemplate(template, { projectKind: KIND });

      expect(result).toBe(`Analyse docs for project kind: ${KIND}`);
    });

    test('buildPromptFromTemplate substitutes ${language} placeholder', () => {
      const template = 'Language is ${language}';
      const result = buildPromptFromTemplate(template, { language: 'shell' });

      expect(result).toBe('Language is shell');
    });

    test('buildPromptFromTemplate removes unmatched placeholders', () => {
      const template = 'Kind: {projectKind} Framework: {framework}';
      const result = buildPromptFromTemplate(template, { projectKind: KIND });

      expect(result).toContain(KIND);
      expect(result).not.toContain('{framework}');
    });
  });

  // =========================================================================
  // Layer 3 — Step 1 correctness
  // Verify Step1DocumentationAnalyzer handles aws_lbs file types per config
  // =========================================================================

  describe('Layer 3: Step 1 correctness (classifyChangedFiles + execute)', () => {
    // --- classifyChangedFiles for aws_lbs file types ---

    // Config says: *.sh, *.js, *.json are the project's file_patterns.
    // Docs config says api_documentation_format is "markdown".

    // NOTE: step_01's classifyChangedFiles does not handle .sh files — they
    // fall through all conditions (docs/test/config/JS) and are left
    // unclassified. This is a known limitation for aws_lbs_backend_setup where
    // shell scripts are primary source artefacts. The test documents this gap.
    test('shell scripts (.sh) are NOT classified by step_01 classifyChangedFiles (known gap)', () => {
      const cls = classifyChangedFiles(['setup-aws-lbs.sh', 'src/scripts/deploy.sh']);
      // .sh files don't match any condition → not placed in any category
      expect(cls.source).not.toContain('setup-aws-lbs.sh');
      expect(cls.config).not.toContain('setup-aws-lbs.sh');
      expect(cls.tests).not.toContain('setup-aws-lbs.sh');
      expect(cls.documentation).not.toContain('setup-aws-lbs.sh');
      // They do count toward the total (changedFiles.length)
      expect(cls.counts.total).toBe(2);
    });

    test('Lambda handlers (.js) go to source category', () => {
      const { source } = classifyChangedFiles(['src/lambda/get-route/index.js']);
      expect(source).toContain('src/lambda/get-route/index.js');
    });

    test('aws-config.json goes to config category', () => {
      const { config } = classifyChangedFiles(['aws-config.json', 'src/aws-config.json']);
      expect(config).toContain('aws-config.json');
      expect(config).toContain('src/aws-config.json');
    });

    test('Lambda package.json goes to config category', () => {
      const { config } = classifyChangedFiles(['src/lambda/get-route/package.json']);
      expect(config).toContain('src/lambda/get-route/package.json');
    });

    test('README.md goes to documentation category', () => {
      const { documentation } = classifyChangedFiles(['README.md']);
      expect(documentation).toContain('README.md');
    });

    test('src/lambda README goes to documentation category', () => {
      const { documentation } = classifyChangedFiles(['src/lambda/get-route/README.md']);
      expect(documentation).toContain('src/lambda/get-route/README.md');
    });

    test('no test files expected for aws_lbs (test_framework: none)', () => {
      // aws_lbs has no test framework, so shell scripts / JS handlers are not test files
      const { tests } = classifyChangedFiles([
        'setup-aws-lbs.sh',
        'src/scripts/deploy.sh',
        'src/lambda/get-route/index.js',
      ]);
      expect(tests).toHaveLength(0);
    });

    test('counts are correct for a typical aws_lbs change set', () => {
      // NOTE: .sh files are unclassified by step_01 (known gap — see test above).
      // They still count toward counts.total but appear in no category.
      const { counts } = classifyChangedFiles([
        'setup-aws-lbs.sh', // unclassified (.sh)
        'src/scripts/create-api.sh', // unclassified (.sh)
        'src/lambda/get-route/index.js', // source (.js)
        'src/aws-config.json', // config (.json)
        'README.md', // documentation (.md)
      ]);

      expect(counts.source).toBe(1); // only the .js Lambda handler
      expect(counts.config).toBe(1); // aws-config.json
      expect(counts.documentation).toBe(1); // README.md
      expect(counts.tests).toBe(0); // no tests in aws_lbs
      expect(counts.total).toBe(5); // all 5 files counted
    });

    // --- shouldRunAiAnalysis for aws_lbs change sets ---

    test('shouldRunAiAnalysis: returns true for source-only aws_lbs changes', () => {
      const cls = classifyChangedFiles(['setup-aws-lbs.sh', 'src/lambda/get-route/index.js']);
      expect(shouldRunAiAnalysis(cls)).toBe(true);
    });

    test('shouldRunAiAnalysis: returns false for zero changes', () => {
      const cls = classifyChangedFiles([]);
      expect(shouldRunAiAnalysis(cls)).toBe(false);
    });

    test('shouldRunAiAnalysis: returns true for doc-only change without skipDocsOnly', () => {
      const cls = classifyChangedFiles(['README.md']);
      expect(shouldRunAiAnalysis(cls, { skipDocsOnly: false })).toBe(true);
    });

    test('shouldRunAiAnalysis: returns false for doc-only change with skipDocsOnly=true', () => {
      const cls = classifyChangedFiles(['README.md']);
      expect(shouldRunAiAnalysis(cls, { skipDocsOnly: true })).toBe(false);
    });

    // --- validateDocumentationCounts for aws_lbs docs ---

    test('validateDocumentationCounts: valid when one README.md present', () => {
      const result = validateDocumentationCounts({ markdown: 1, readme: 1, docs: 0 });
      expect(result.success).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    test('validateDocumentationCounts: flags missing README (aws_lbs config requires readme)', () => {
      // quality.readme_required: true
      const result = validateDocumentationCounts({ markdown: 2, readme: 0, docs: 1 });
      expect(result.success).toBe(false);
      expect(result.issues).toContain('No README file found in project root');
    });

    test('validateDocumentationCounts: flags multiple READMEs', () => {
      const result = validateDocumentationCounts({ markdown: 3, readme: 2, docs: 1 });
      expect(result.success).toBe(false);
      expect(result.issues.some((i) => i.includes('Multiple README'))).toBe(true);
    });

    test('validateDocumentationCounts: flags no documentation at all', () => {
      const result = validateDocumentationCounts({ markdown: 0, readme: 0, docs: 0 });
      expect(result.success).toBe(false);
      expect(result.issues).toContain('No documentation files found');
    });

    // --- checkVersionReferences: aws_lbs has no package.json version tracking ---
    // (package.json exists only per Lambda function in src/lambda/*/package.json)
    // The step skips version checks when no root-level package.json is found.

    test('checkVersionReferences: no mismatches when content has no version strings', () => {
      const result = checkVersionReferences('# AWS LBS Backend\nNo versions here.', '1.0.0');
      expect(result.hasMismatches).toBe(false);
      expect(result.mismatches).toHaveLength(0);
    });

    test('checkVersionReferences: detects version mismatch in docs', () => {
      const content = 'Lambda version: 1.2.3. Expected to be 2.0.0.';
      const result = checkVersionReferences(content, '2.0.0');
      // 1.2.3 is in content but does not match expected 2.0.0
      expect(result.hasMismatches).toBe(true);
      expect(result.mismatches).toContain('1.2.3');
    });

    test('checkVersionReferences: no mismatch when version matches exactly', () => {
      const result = checkVersionReferences('Release 1.0.0', '1.0.0');
      expect(result.hasMismatches).toBe(false);
    });

    // --- Step1DocumentationAnalyzer.stepKind ---

    test('Step1DocumentationAnalyzer.stepKind is STEP_KIND.PROJECT', () => {
      expect(Step1DocumentationAnalyzer.stepKind).toBe(STEP_KIND.PROJECT);
    });

    // --- Full execute() with an aws_lbs README change ---

    test('execute() returns skipped:true with reason no_changes when no files changed', async () => {
      const analyzer = new Step1DocumentationAnalyzer({
        gitOps: { getModifiedFiles: () => Promise.resolve([]) },
        backlog: { saveStepSummary: () => Promise.resolve() },
      });

      const result = await analyzer.execute(tempDir);

      expect(result.success).toBe(true);
      expect(result.skipped).toBe(true);
      expect(result.reason).toBe('no_changes');
    });

    test('execute() classifies aws_lbs README change as documentation', async () => {
      const readme = path.join(tempDir, 'README.md');
      await writeFile(readme, '# AWS LBS Backend\n');

      const analyzer = new Step1DocumentationAnalyzer({
        gitOps: { getModifiedFiles: () => Promise.resolve([readme]) },
        fileOps: {
          readFile: () => Promise.reject(Object.assign(new Error('ENOENT'), { code: 'ENOENT' })),
        },
        backlog: { saveStepSummary: () => Promise.resolve() },
        incrementalProcessor: { detectChangedDocs: (files) => Promise.resolve(files) },
        parallelProcessor: {
          validate: () => Promise.resolve({ success: true, validatedFiles: 1 }),
          getStatistics: () => ({ totalDuration: 10, speedup: null }),
        },
        aiHelper: { initialize: () => Promise.resolve(false) },
        enableParallel: true,
      });

      const result = await analyzer.execute(tempDir, {
        enableIncremental: false,
        enableParallel: true,
      });

      expect(result.success).toBe(true);
      expect(result.classification.documentation).toContain(readme);
      expect(result.classification.counts.documentation).toBe(1);
    });

    test('execute() classifies aws_lbs shell script change as source (actually unclassified)', async () => {
      // .sh files are not classified by step_01 — they fall through all conditions.
      // Source category remains empty for shell-only changes.
      const script = 'setup-aws-lbs.sh';

      const analyzer = new Step1DocumentationAnalyzer({
        gitOps: { getModifiedFiles: () => Promise.resolve([script]) },
        backlog: { saveStepSummary: () => Promise.resolve() },
        // Stub aiHelper so the test doesn't try to connect to Copilot SDK
        aiHelper: { initialize: () => Promise.resolve(false) },
        enableParallel: false,
      });

      const result = await analyzer.execute(tempDir, { enableIncremental: false });

      // .sh is unclassified — source is empty
      expect(result.classification.source).toHaveLength(0);
      // But the file is counted in total
      expect(result.classification.counts.total).toBe(1);
      // tests always 0 for aws_lbs
      expect(result.classification.counts.tests).toBe(0);
    });

    test('execute() saves backlog with step 1 documentation header', async () => {
      const readme = path.join(tempDir, 'README.md');
      await writeFile(readme, '# AWS LBS Backend\n');

      const { stub, calls } = buildBacklogStub();

      const analyzer = new Step1DocumentationAnalyzer({
        gitOps: { getModifiedFiles: () => Promise.resolve([readme]) },
        fileOps: {
          readFile: () => Promise.reject(Object.assign(new Error('ENOENT'), { code: 'ENOENT' })),
        },
        backlog: stub,
        incrementalProcessor: { detectChangedDocs: (files) => Promise.resolve(files) },
        parallelProcessor: {
          validate: () => Promise.resolve({ success: true, validatedFiles: 1 }),
          getStatistics: () => ({ totalDuration: 10, speedup: null }),
        },
        aiHelper: { initialize: () => Promise.resolve(false) },
      });

      await analyzer.execute(tempDir, {
        enableIncremental: false,
        enableParallel: true,
      });

      expect(calls.length).toBeGreaterThan(0);
      // Step number 1, title matches
      expect(calls[0][0]).toBe(1);
      expect(calls[0][1]).toContain('Documentation');
      // Content has the section headers from formatBacklogContent
      expect(calls[0][2]).toContain('## Step 1');
      expect(calls[0][2]).toContain('### Changed Files');
      expect(calls[0][2]).toContain('### Validation Results');
    });

    // --- Config-driven validation: validateProjectStructure for real aws_lbs layout ---

    test('validateProjectStructure passes for complete aws_lbs file set', () => {
      const files = [
        'setup-aws-lbs.sh',
        'src/aws-config.json',
        'README.md',
        '.github/HIGH_COHESION_GUIDE.md',
        '.github/LOW_COUPLING_GUIDE.md',
      ];
      const dirs = ['src/lambda', 'src/scripts'];
      const rules = {
        required_files: ['*.sh', 'src/aws-config.json'],
        required_directories: ['src/lambda', 'src/scripts'],
      };

      const result = validateProjectStructure(files, dirs, rules);

      expect(result.valid).toBe(true);
      expect(result.missingFiles).toHaveLength(0);
      expect(result.missingDirs).toHaveLength(0);
    });

    test('validateProjectStructure fails when src/aws-config.json is absent', () => {
      const files = ['setup-aws-lbs.sh']; // missing src/aws-config.json
      const dirs = ['src/lambda', 'src/scripts'];
      const rules = {
        required_files: ['*.sh', 'src/aws-config.json'],
        required_directories: ['src/lambda', 'src/scripts'],
      };

      const result = validateProjectStructure(files, dirs, rules);

      expect(result.valid).toBe(false);
      expect(result.missingFiles).toContain('src/aws-config.json');
      expect(result.missingFiles).toContain('.github/HIGH_COHESION_GUIDE.md');
      expect(result.missingFiles).toContain('.github/LOW_COUPLING_GUIDE.md');
    });

    test('validateProjectStructure fails when no *.sh file is present', () => {
      const files = ['src/aws-config.json']; // no shell scripts
      const dirs = ['src/lambda', 'src/scripts'];
      const rules = {
        required_files: ['*.sh', 'src/aws-config.json'],
        required_directories: ['src/lambda', 'src/scripts'],
      };

      const result = validateProjectStructure(files, dirs, rules);

      expect(result.valid).toBe(false);
      expect(result.missingFiles).toContain('*.sh');
    });

    test('validateProjectStructure fails when src/lambda directory is absent', () => {
      const files = [
        'setup-aws-lbs.sh',
        'src/aws-config.json',
        '.github/HIGH_COHESION_GUIDE.md',
        '.github/LOW_COUPLING_GUIDE.md',
      ];
      const dirs = ['src/scripts']; // missing src/lambda
      const rules = {
        required_files: ['*.sh', 'src/aws-config.json'],
        required_directories: ['src/lambda', 'src/scripts'],
      };

      const result = validateProjectStructure(files, dirs, rules);

      expect(result.valid).toBe(false);
      expect(result.missingDirs).toContain('src/lambda');
    });

    test('validateProjectStructure fails when src/scripts directory is absent', () => {
      const files = [
        'setup-aws-lbs.sh',
        'src/aws-config.json',
        '.github/HIGH_COHESION_GUIDE.md',
        '.github/LOW_COUPLING_GUIDE.md',
      ];
      const dirs = ['src/lambda']; // missing src/scripts
      const rules = {
        required_files: ['*.sh', 'src/aws-config.json'],
        required_directories: ['src/lambda', 'src/scripts'],
      };

      const result = validateProjectStructure(files, dirs, rules);

      expect(result.valid).toBe(false);
      expect(result.missingDirs).toContain('src/scripts');
    });

    // --- Pure function: extractConfigSection ---

    test('extractConfigSection returns ai_guidance from loaded aws_lbs config', async () => {
      const configMgr = buildRealConfigManager();
      const fullConfig = await configMgr.loadConfig(KIND);

      const guidance = extractConfigSection(fullConfig, 'ai_guidance');

      expect(guidance).not.toBeNull();
      expect(Array.isArray(guidance.best_practices)).toBe(true);
    });

    test('extractConfigSection returns null for unknown section', async () => {
      const configMgr = buildRealConfigManager();
      const fullConfig = await configMgr.loadConfig(KIND);

      const result = extractConfigSection(fullConfig, 'nonexistent_section');

      expect(result).toBeNull();
    });
  });
});
