import fs from 'fs/promises';
import path from 'path';
import { glob } from 'glob';
import { Step2ConsistencyAnalyzer } from '../../src/steps/step_02_consistency.js';

function buildRealFileOps(projectRoot) {
  return {
    async glob(pattern, { cwd = projectRoot, ignore = [] } = {}) {
      return glob(pattern, { cwd, ignore, nodir: true });
    },
    async readFile(filePath) {
      const resolved = path.isAbsolute(filePath) ? filePath : path.join(projectRoot, filePath);
      return fs.readFile(resolved, 'utf8');
    },
  };
}

function createBacklogRecorder() {
  const calls = [];
  return {
    calls,
    backlog: {
      saveStepSummary(step, title, content) {
        calls.push({ step, title, content });
        return Promise.resolve();
      },
    },
  };
}

export async function createTemporaryProjectRoot(prefix = 'step-02') {
  const projectRoot = path.join(
    process.cwd(),
    '.test-e2e',
    `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  await fs.mkdir(projectRoot, { recursive: true });
  return projectRoot;
}

export async function removeTemporaryProjectRoot(projectRoot) {
  await fs.rm(projectRoot, { recursive: true, force: true });
}

export async function writeProjectFile(projectRoot, relativePath, content) {
  const filePath = path.join(projectRoot, relativePath);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, 'utf8');
}

export async function seedProjectFiles(projectRoot, filesByPath) {
  await Promise.all(
    Object.entries(filesByPath).map(([relativePath, content]) =>
      writeProjectFile(projectRoot, relativePath, content)
    )
  );
}

export async function createConsistentDocumentationProject(projectRoot) {
  await seedProjectFiles(projectRoot, {
    'package.json': JSON.stringify({ name: 'my-project', version: '1.2.3' }),
    'README.md': '# My Project\n\nVersion 1.2.3\n\nSee [guide](docs/guide.md) for details.\n',
    'docs/guide.md': '# Guide\n\nVersion 1.2.3\n\nSee [advanced](advanced.md) for more.\n',
    'docs/advanced.md': '# Advanced\n\nVersion 1.2.3\n',
  });
}

export function createStep2ConsistencyHarness(projectRoot, overrides = {}) {
  const { calls, backlog } = createBacklogRecorder();
  const analyzer = new Step2ConsistencyAnalyzer({
    fileOps: buildRealFileOps(projectRoot),
    backlog,
    aiHelper: { initialize: () => Promise.resolve(false) },
    ...overrides,
  });

  return {
    analyzer,
    backlogCalls: calls,
    execute(projectRootOverride = projectRoot, options) {
      return analyzer.execute(projectRootOverride, options);
    },
  };
}

export async function runStep2Consistency(projectRoot, options) {
  const harness = createStep2ConsistencyHarness(projectRoot);
  const result = await harness.execute(projectRoot, options);
  return { ...harness, result };
}

export async function executeViaOrchestrator(StepClass, commonDeps, projectRoot) {
  const executor = new StepClass(commonDeps);
  if (typeof executor.execute !== 'function') {
    throw new Error(`${StepClass.name} does not have an execute() method`);
  }
  return executor.execute(projectRoot);
}
