// scripts/postinstall.test.js

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const nodeModules = path.join(__dirname, '..', 'node_modules');
const olindaPkgPath = path.join(nodeModules, 'olinda_shell_interface.js', 'package.json');
const vscodePkgPath = path.join(nodeModules, 'vscode-jsonrpc', 'package.json');

// Helper to reset package.json files
function resetPkg(pkgPath, content) {
  fs.writeFileSync(pkgPath, JSON.stringify(content, null, 2) + '\n', 'utf8');
}

describe('postinstall.js', () => {
  beforeEach(() => {
    // Setup olinda_shell_interface.js package.json
    fs.mkdirSync(path.dirname(olindaPkgPath), { recursive: true });
    resetPkg(olindaPkgPath, {
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
    fs.mkdirSync(path.dirname(vscodePkgPath), { recursive: true });
    resetPkg(vscodePkgPath, {
      name: 'vscode-jsonrpc',
      exports: undefined,
    });
  });

  afterEach(() => {
    fs.rmSync(path.dirname(olindaPkgPath), { recursive: true, force: true });
    fs.rmSync(path.dirname(vscodePkgPath), { recursive: true, force: true });
  });

  it('patches olinda_shell_interface.js exports map (happy path)', async () => {
    // Run postinstall
    await import('./postinstall.js');
    const pkg = JSON.parse(fs.readFileSync(olindaPkgPath, 'utf8'));
    expect(pkg.exports['.'].import.default).toContain('/dist/src/');
    expect(pkg.exports['.'].import.types).toBe('./dist/src/index.d.ts');
  });

  it('does not patch olinda_shell_interface.js if exports map is missing', async () => {
    resetPkg(olindaPkgPath, { name: 'olinda_shell_interface.js' });
    await import('./postinstall.js');
    const pkg = JSON.parse(fs.readFileSync(olindaPkgPath, 'utf8'));
    expect(pkg.exports).toBeUndefined();
  });

  it('does not patch olinda_shell_interface.js if no /dist/esm/ in exports', async () => {
    resetPkg(olindaPkgPath, {
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
    await import('./postinstall.js');
    const pkg = JSON.parse(fs.readFileSync(olindaPkgPath, 'utf8'));
    expect(pkg.exports['.'].import.default).toBe('./dist/src/index.js');
  });

  it('patches vscode-jsonrpc exports map (happy path)', async () => {
    await import('./postinstall.js');
    const pkg = JSON.parse(fs.readFileSync(vscodePkgPath, 'utf8'));
    expect(pkg.exports['./node']).toBe('./node.js');
    expect(pkg.exports['.']).toBe('./lib/node/main.js');
    expect(pkg.exports['./browser']).toBe('./browser.js');
  });

  it('does not patch vscode-jsonrpc if ./node already exists in exports', async () => {
    resetPkg(vscodePkgPath, {
      name: 'vscode-jsonrpc',
      exports: { './node': './node.js' },
    });
    await import('./postinstall.js');
    const pkg = JSON.parse(fs.readFileSync(vscodePkgPath, 'utf8'));
    expect(pkg.exports['./node']).toBe('./node.js');
    expect(Object.keys(pkg.exports).length).toBe(1);
  });

  it('handles missing package.json files gracefully', async () => {
    fs.rmSync(olindaPkgPath, { force: true });
    fs.rmSync(vscodePkgPath, { force: true });
    await import('./postinstall.js');
    expect(fs.existsSync(olindaPkgPath)).toBe(false);
    expect(fs.existsSync(vscodePkgPath)).toBe(false);
  });

  it('handles invalid JSON in package.json gracefully', async () => {
    fs.writeFileSync(olindaPkgPath, '{invalid json}', 'utf8');
    fs.writeFileSync(vscodePkgPath, '{invalid json}', 'utf8');
    await import('./postinstall.js');
    expect(() => JSON.parse(fs.readFileSync(olindaPkgPath, 'utf8'))).toThrow();
    expect(() => JSON.parse(fs.readFileSync(vscodePkgPath, 'utf8'))).toThrow();
  });
});
