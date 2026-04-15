#!/usr/bin/env node
/**
 * Post-process generated TypeDoc markdown media files whose original relative
 * links are no longer correct after being copied under docs/api/html/media.
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

const rewrites = [
  {
    filePath: join(projectRoot, 'docs/api/html/media/CHANGELOG.md'),
    replacements: [
      [
        '(docs/reports/bugfixes/BUGFIX_WORKFLOWDIR_RESOLUTION_2026_02_21.md)',
        '(../../../reports/bugfixes/BUGFIX_WORKFLOWDIR_RESOLUTION_2026_02_21.md)',
      ],
    ],
  },
  {
    filePath: join(projectRoot, 'docs/api/html/media/CLEANUP_ARTIFACTS.md'),
    replacements: [['(../../.ai_workflow/)', '(../../../../.ai_workflow/)']],
  },
  {
    filePath: join(projectRoot, 'docs/api/html/media/PREPARE_RELEASE.md'),
    replacements: [['(../../CHANGELOG.md)', '(../../../../CHANGELOG.md)']],
  },
];

let updatedFiles = 0;

for (const { filePath, replacements } of rewrites) {
  if (!existsSync(filePath)) {
    continue;
  }

  let content = readFileSync(filePath, 'utf-8');
  let changed = false;

  for (const [from, to] of replacements) {
    if (content.includes(from)) {
      content = content.replaceAll(from, to);
      changed = true;
    }
  }

  if (changed) {
    writeFileSync(filePath, content, 'utf-8');
    updatedFiles += 1;
  }
}

console.log(`TypeDoc media link post-processing complete (${updatedFiles} file(s) updated).`);
