#!/usr/bin/env node
/**
 * postinstall.js
 *
 * Patches installed packages to fix missing ESM builds / missing exports maps.
 *
 * Patches applied:
 *  1. olinda_shell_interface.js — declares dist/esm/ in exports but only ships dist/src/ (CJS).
 *     Node.js can load named CJS exports from ESM, so we redirect import conditions to dist/src/.
 *
 *  2. vscode-jsonrpc — no exports map; @github/copilot-sdk imports "vscode-jsonrpc/node" (no .js).
 *     We add a minimal exports map so the extensionless subpath resolves to node.js.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import * as childProcess from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function readPkg(pkgPath) {
  try {
    return JSON.parse(readFileSync(pkgPath, 'utf8'));
  } catch {
    return null;
  }
}

function writePkg(pkgPath, pkg) {
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
}

function runTsc(tscPath, projectPath, cwd) {
  const result = childProcess.spawnSync(process.execPath, [tscPath, '--project', projectPath], {
    cwd,
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    throw result.error ?? new Error(`postinstall: failed to compile ${projectPath}`);
  }
}

function buildSourceOlindaUtilsPackages(nodeModulesPath) {
  const tscPath = join(nodeModulesPath, 'typescript', 'bin', 'tsc');
  const packageDirs = [
    join(nodeModulesPath, 'olinda_utils.js'),
    join(nodeModulesPath, 'olinda_copilot_sdk.ts', 'node_modules', 'olinda_utils.js'),
    join(nodeModulesPath, 'olinda_shell_interface.js', 'node_modules', 'olinda_utils.js'),
  ];

  for (const pkgDir of packageDirs) {
    const pkgPath = join(pkgDir, 'package.json');
    const pkg = readPkg(pkgPath);
    if (pkg?.name !== 'olinda_utils.js') {
      continue;
    }

    const cjsEntry = join(pkgDir, 'dist', 'src', 'index.js');
    const esmEntry = join(pkgDir, 'dist', 'esm', 'index.js');
    if (existsSync(cjsEntry) && existsSync(esmEntry)) {
      continue;
    }

    if (!existsSync(tscPath)) {
      throw new Error(
        'postinstall: TypeScript compiler not found in node_modules/typescript/bin/tsc'
      );
    }

    const tsconfigPath = join(pkgDir, 'tsconfig.json');
    const esmTsconfigPath = join(pkgDir, 'tsconfig.esm.json');
    runTsc(tscPath, tsconfigPath, pkgDir);
    runTsc(tscPath, esmTsconfigPath, pkgDir);

    const esmPkgPath = join(pkgDir, 'dist', 'esm', 'package.json');
    mkdirSync(dirname(esmPkgPath), { recursive: true });
    writeFileSync(esmPkgPath, '{\n  "type": "module"\n}\n', 'utf8');

    console.log(`postinstall: built ${pkg.name}@${pkg.version} from source tarball`);
  }
}

/**
 * Apply all postinstall patches to the given node_modules directory.
 * Exported for testing; called automatically when run as main script.
 *
 * @param {string} [nodeModulesPath] - Path to node_modules (defaults to ../node_modules relative to this script)
 */
export function patchAll(nodeModulesPath = join(__dirname, '..', 'node_modules')) {
  buildSourceOlindaUtilsPackages(nodeModulesPath);

  // --- Patch 1: olinda_shell_interface.js ---
  {
    const pkgPath = join(nodeModulesPath, 'olinda_shell_interface.js', 'package.json');
    const pkg = readPkg(pkgPath);
    if (pkg) {
      let changed = false;
      const exports_ = pkg.exports ?? {};
      for (const key of Object.keys(exports_)) {
        const entry = exports_[key];
        if (entry?.import?.default?.includes('/dist/esm/')) {
          entry.import.default = entry.import.default.replace('/dist/esm/', '/dist/src/');
          if (entry.import.types) {
            entry.import.types = entry.require?.types ?? entry.import.types;
          }
          changed = true;
        }
      }
      if (changed) {
        pkg.exports = exports_;
        writePkg(pkgPath, pkg);
        console.log(
          'postinstall: patched olinda_shell_interface.js exports map (dist/esm → dist/src)'
        );
      }
    }
  }

  // --- Patch 2: vscode-jsonrpc ---
  {
    const pkgPath = join(nodeModulesPath, 'vscode-jsonrpc', 'package.json');
    const pkg = readPkg(pkgPath);
    if (pkg && !pkg.exports?.['./node']) {
      pkg.exports = {
        '.': './lib/node/main.js',
        './node': './node.js',
        './browser': './browser.js',
        './node.js': './node.js',
        './browser.js': './browser.js',
        ...(pkg.exports ?? {}),
      };
      writePkg(pkgPath, pkg);
      console.log('postinstall: patched vscode-jsonrpc exports map (added ./node subpath)');
    }
  }
}

// Run automatically when invoked as the main script
patchAll();
