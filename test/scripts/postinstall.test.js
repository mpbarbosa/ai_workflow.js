// scripts/postinstall.test.js
//
// Imports the exported patchAll() function directly (avoids ESM module-cache
// issues that arise when the script is dynamically imported multiple times).

import fs from 'fs';
import os from 'os';
import path from 'path';
import * as childProcess from 'child_process';
import { fileURLToPath } from 'url';
import { jest } from '@jest/globals';
import { patchAll } from '../../scripts/postinstall.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const POSTINSTALL_SCRIPT = path.resolve(__dirname, '../../scripts/postinstall.js');

// Temporary directory created fresh for each test suite run and torn down afterwards.
// This avoids leaking a test/node_modules/ tree into the project workspace.
let tmpDir;

function resetPkg(pkgPath, content) {
  fs.writeFileSync(pkgPath, JSON.stringify(content, null, 2) + '\n', 'utf8');
}

/**
 * Returns the paths for olinda + vscode-jsonrpc package.json files within a given
 * node_modules root.
 */
function pkgPaths(nodeModules) {
  return {
    olinda: path.join(nodeModules, 'olinda_shell_interface.js', 'package.json'),
    olindaUtils: path.join(nodeModules, 'olinda_utils.js', 'package.json'),
    typescriptBin: path.join(nodeModules, 'typescript', 'bin', 'tsc'),
    vscode: path.join(nodeModules, 'vscode-jsonrpc', 'package.json'),
  };
}

describe('postinstall.js', () => {
  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'postinstall-'));
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    const { olinda, vscode } = pkgPaths(tmpDir);

    // Setup olinda_shell_interface.js package.json
    fs.mkdirSync(path.dirname(olinda), { recursive: true });
    resetPkg(olinda, {
      name: 'olinda_shell_interface.js',
      exports: {
        '.': {
          import: {
            default: './dist/esm/index.js',
            types: './dist/esm/index.d.ts',
          },
          require: {
            types: './dist/src/index.d.ts',
          },
        },
      },
    });

    // Setup vscode-jsonrpc package.json
    fs.mkdirSync(path.dirname(vscode), { recursive: true });
    resetPkg(vscode, {
      name: 'vscode-jsonrpc',
      exports: undefined,
    });
  });

  afterEach(() => {
    const { olinda, vscode } = pkgPaths(tmpDir);
    fs.rmSync(path.dirname(olinda), { recursive: true, force: true });
    fs.rmSync(path.dirname(vscode), { recursive: true, force: true });
  });

  it('patches olinda_shell_interface.js exports map (happy path)', () => {
    const { olinda } = pkgPaths(tmpDir);
    patchAll(tmpDir);
    const pkg = JSON.parse(fs.readFileSync(olinda, 'utf8'));
    expect(pkg.exports['.'].import.default).toContain('/dist/src/');
    expect(pkg.exports['.'].import.types).toBe('./dist/src/index.d.ts');
  });

  it('does not patch olinda_shell_interface.js if exports map is missing', () => {
    const { olinda } = pkgPaths(tmpDir);
    resetPkg(olinda, { name: 'olinda_shell_interface.js' });
    patchAll(tmpDir);
    const pkg = JSON.parse(fs.readFileSync(olinda, 'utf8'));
    expect(pkg.exports).toBeUndefined();
  });

  it('does not patch olinda_shell_interface.js if no /dist/esm/ in exports', () => {
    const { olinda } = pkgPaths(tmpDir);
    resetPkg(olinda, {
      name: 'olinda_shell_interface.js',
      exports: {
        '.': {
          import: {
            default: './dist/src/index.js',
            types: './dist/src/index.d.ts',
          },
        },
      },
    });
    patchAll(tmpDir);
    const pkg = JSON.parse(fs.readFileSync(olinda, 'utf8'));
    expect(pkg.exports['.'].import.default).toBe('./dist/src/index.js');
  });

  it('patches vscode-jsonrpc exports map (happy path)', () => {
    const { vscode } = pkgPaths(tmpDir);
    patchAll(tmpDir);
    const pkg = JSON.parse(fs.readFileSync(vscode, 'utf8'));
    expect(pkg.exports['./node']).toBe('./node.js');
    expect(pkg.exports['.']).toBe('./lib/node/main.js');
    expect(pkg.exports['./browser']).toBe('./browser.js');
  });

  it('does not patch vscode-jsonrpc if ./node already exists in exports', () => {
    const { vscode } = pkgPaths(tmpDir);
    resetPkg(vscode, {
      name: 'vscode-jsonrpc',
      exports: { './node': './node.js' },
    });
    patchAll(tmpDir);
    const pkg = JSON.parse(fs.readFileSync(vscode, 'utf8'));
    expect(pkg.exports['./node']).toBe('./node.js');
    expect(Object.keys(pkg.exports).length).toBe(1);
  });

  it('handles missing package.json files gracefully', () => {
    const { olinda, vscode } = pkgPaths(tmpDir);
    fs.rmSync(olinda, { force: true });
    fs.rmSync(vscode, { force: true });
    expect(() => patchAll(tmpDir)).not.toThrow();
    expect(fs.existsSync(olinda)).toBe(false);
    expect(fs.existsSync(vscode)).toBe(false);
  });

  it('handles invalid JSON in package.json gracefully', () => {
    const { olinda, vscode } = pkgPaths(tmpDir);
    fs.writeFileSync(olinda, '{invalid json}', 'utf8');
    fs.writeFileSync(vscode, '{invalid json}', 'utf8');
    expect(() => patchAll(tmpDir)).not.toThrow();
    expect(() => JSON.parse(fs.readFileSync(olinda, 'utf8'))).toThrow();
    expect(() => JSON.parse(fs.readFileSync(vscode, 'utf8'))).toThrow();
  });

  // --- Edge-case unit tests (ROADMAP items) ---

  it('patches all matching export keys when multiple keys contain /dist/esm/', () => {
    const { olinda } = pkgPaths(tmpDir);
    resetPkg(olinda, {
      name: 'olinda_shell_interface.js',
      exports: {
        '.': {
          import: { default: './dist/esm/index.js', types: './dist/esm/index.d.ts' },
          require: { types: './dist/src/index.d.ts' },
        },
        './sub': {
          import: { default: './dist/esm/sub.js', types: './dist/esm/sub.d.ts' },
          require: { types: './dist/src/sub.d.ts' },
        },
      },
    });
    patchAll(tmpDir);
    const pkg = JSON.parse(fs.readFileSync(olinda, 'utf8'));
    expect(pkg.exports['.'].import.default).toContain('/dist/src/');
    expect(pkg.exports['./sub'].import.default).toContain('/dist/src/');
  });

  it('emits a console.log message for each patch applied', () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    try {
      patchAll(tmpDir);
      const messages = logSpy.mock.calls.map((c) => c[0]);
      expect(messages.some((m) => m.includes('olinda_shell_interface.js'))).toBe(true);
      expect(messages.some((m) => m.includes('vscode-jsonrpc'))).toBe(true);
    } finally {
      logSpy.mockRestore();
    }
  });

  it('builds source-only olinda_utils.js packages with the root TypeScript compiler', () => {
    const { olindaUtils, typescriptBin } = pkgPaths(tmpDir);
    fs.mkdirSync(path.dirname(olindaUtils), { recursive: true });
    resetPkg(olindaUtils, {
      name: 'olinda_utils.js',
      version: '0.3.9',
      exports: {
        '.': {
          import: './dist/esm/index.js',
          require: './dist/src/index.js',
        },
      },
    });
    fs.writeFileSync(path.join(path.dirname(olindaUtils), 'tsconfig.json'), '{}\n', 'utf8');
    fs.writeFileSync(path.join(path.dirname(olindaUtils), 'tsconfig.esm.json'), '{}\n', 'utf8');
    fs.mkdirSync(path.dirname(typescriptBin), { recursive: true });
    fs.writeFileSync(
      typescriptBin,
      [
        "const fs = require('fs');",
        "const path = require('path');",
        "const projectIndex = process.argv.indexOf('--project');",
        'const projectPath = process.argv[projectIndex + 1];',
        "const isEsm = projectPath.endsWith('tsconfig.esm.json');",
        "const outDir = path.join(path.dirname(projectPath), 'dist', isEsm ? 'esm' : 'src');",
        'fs.mkdirSync(outDir, { recursive: true });',
        "fs.writeFileSync(path.join(outDir, 'index.js'), '// built by fake tsc\\n', 'utf8');",
      ].join('\n'),
      'utf8'
    );

    try {
      patchAll(tmpDir);
      expect(fs.existsSync(path.join(path.dirname(olindaUtils), 'dist', 'src', 'index.js'))).toBe(
        true
      );
      expect(fs.existsSync(path.join(path.dirname(olindaUtils), 'dist', 'esm', 'index.js'))).toBe(
        true
      );
      expect(
        JSON.parse(
          fs.readFileSync(
            path.join(path.dirname(olindaUtils), 'dist', 'esm', 'package.json'),
            'utf8'
          )
        )
      ).toEqual({ type: 'module' });
    } finally {
      fs.rmSync(path.dirname(olindaUtils), { recursive: true, force: true });
      fs.rmSync(path.join(tmpDir, 'typescript'), { recursive: true, force: true });
    }
  });

  it('is idempotent — calling patchAll() twice produces the same result without extra log lines', () => {
    const { olinda, vscode } = pkgPaths(tmpDir);
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    try {
      patchAll(tmpDir);
      const firstCallCount = logSpy.mock.calls.length;
      const pkgAfterFirst = {
        olinda: JSON.parse(fs.readFileSync(olinda, 'utf8')),
        vscode: JSON.parse(fs.readFileSync(vscode, 'utf8')),
      };

      patchAll(tmpDir);
      const secondCallCount = logSpy.mock.calls.length - firstCallCount;
      const pkgAfterSecond = {
        olinda: JSON.parse(fs.readFileSync(olinda, 'utf8')),
        vscode: JSON.parse(fs.readFileSync(vscode, 'utf8')),
      };

      expect(pkgAfterFirst).toEqual(pkgAfterSecond);
      // Second call should emit no patch messages (already patched)
      expect(secondCallCount).toBe(0);
    } finally {
      logSpy.mockRestore();
    }
  });

  it('does not throw when vscode-jsonrpc exports object exists but lacks the ./node key', () => {
    const { vscode } = pkgPaths(tmpDir);
    resetPkg(vscode, {
      name: 'vscode-jsonrpc',
      exports: { '.': './lib/node/main.js' }, // exists but no './node'
    });
    expect(() => patchAll(tmpDir)).not.toThrow();
    const pkg = JSON.parse(fs.readFileSync(vscode, 'utf8'));
    // Patch should have been applied (./node was missing)
    expect(pkg.exports['./node']).toBe('./node.js');
  });
});

// --- Integration test: black-box child-process execution ---

describe('postinstall.js – integration (child process)', () => {
  let integTmpDir;

  beforeAll(() => {
    integTmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'postinstall-integ-'));
    const { olinda, vscode } = pkgPaths(integTmpDir);

    // Create minimal olinda fixture
    fs.mkdirSync(path.dirname(olinda), { recursive: true });
    fs.writeFileSync(
      olinda,
      JSON.stringify(
        {
          name: 'olinda_shell_interface.js',
          exports: {
            '.': {
              import: {
                default: './dist/esm/index.js',
                types: './dist/esm/index.d.ts',
              },
              require: { types: './dist/src/index.d.ts' },
            },
          },
        },
        null,
        2
      ) + '\n',
      'utf8'
    );

    // Create minimal vscode-jsonrpc fixture
    fs.mkdirSync(path.dirname(vscode), { recursive: true });
    fs.writeFileSync(vscode, JSON.stringify({ name: 'vscode-jsonrpc' }, null, 2) + '\n', 'utf8');
  });

  afterAll(() => {
    fs.rmSync(integTmpDir, { recursive: true, force: true });
  });

  it('exits 0 and patches both package.json files when run as a child process', () => {
    const result = childProcess.spawnSync(
      process.execPath,
      [
        '--input-type=module',
        '--eval',
        `import { patchAll } from ${JSON.stringify(POSTINSTALL_SCRIPT)}; patchAll(${JSON.stringify(integTmpDir)});`,
      ],
      { encoding: 'utf8' }
    );
    expect(result.status).toBe(0);
    expect(result.error).toBeUndefined();

    const { olinda, vscode } = pkgPaths(integTmpDir);
    const olindaPkg = JSON.parse(fs.readFileSync(olinda, 'utf8'));
    expect(olindaPkg.exports['.'].import.default).toContain('/dist/src/');

    const vscodePkg = JSON.parse(fs.readFileSync(vscode, 'utf8'));
    expect(vscodePkg.exports['./node']).toBe('./node.js');
  }, 15000);
});
