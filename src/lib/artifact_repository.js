/**
 * Artifact repository — loads file content as typed domain objects.
 *
 * The only module in `src/lib/` that reads prompt-context files from disk.
 * Callers receive `Artifact[]` sorted by priority so downstream decisions
 * (truncation, manifest generation) can rely on order without re-sorting.
 *
 * @module lib/artifact_repository
 */

import fs from 'fs';
import { sortByPriority } from './step10_partition_cache.js';

/** @type {Record<string, string>} */
const EXT_LANGUAGE_MAP = {
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  py: 'python',
  go: 'go',
  rb: 'ruby',
  rs: 'rust',
  java: 'java',
  cpp: 'cpp',
  cc: 'cpp',
  cxx: 'cpp',
  c: 'c',
  h: 'c',
  sh: 'bash',
  bash: 'bash',
  bats: 'bash',
  json: 'json',
  yaml: 'yaml',
  yml: 'yaml',
  md: 'markdown',
  html: 'html',
  css: 'css',
};

/**
 * Derive a language name from a file extension (without the leading dot).
 *
 * @param {string|undefined} ext
 * @returns {string}
 */
export function extToLanguage(ext) {
  return EXT_LANGUAGE_MAP[ext?.toLowerCase()] ?? ext ?? '';
}

/**
 * @typedef {Object} Artifact
 * @property {string} path       - Relative file path (as passed in).
 * @property {string} content    - Raw file content.
 * @property {string} language   - Language name derived from the extension.
 * @property {number} byteSize   - UTF-8 byte length of content.
 * @property {boolean} isModified - True when path appears in modifiedFiles.
 * @property {number} priority   - Sort position (0 = highest priority).
 */

/**
 * Load files as `Artifact` objects, sorted by review priority.
 *
 * Priority order: recently modified → unreviewed → lowest quality score.
 * Files that cannot be read are silently omitted from the result.
 *
 * @param {string[]} paths - Relative (or absolute) file paths to load.
 * @param {string[]} [modifiedFiles=[]] - Recently modified paths for priority and isModified.
 * @param {Object} [opts]
 * @param {string} [opts.projectRoot=process.cwd()] - Root for resolving relative paths.
 * @param {{ readFile(path: string): Promise<string> }} [opts.fileOps] - I/O adapter; falls back to fs.
 * @param {Object} [opts.fileScores={}] - Quality score map (filePath → {score}) for tiebreaking.
 * @returns {Promise<Artifact[]>}
 */
export async function loadArtifacts(
  paths,
  modifiedFiles = [],
  { projectRoot = process.cwd(), fileOps, fileScores = {} } = {}
) {
  const modSet = new Set(modifiedFiles);
  const sorted = sortByPriority(paths, fileScores, modifiedFiles);

  const read = fileOps?.readFile
    ? (p) => fileOps.readFile(p)
    : (p) => fs.promises.readFile(p, 'utf8');

  const results = await Promise.all(
    sorted.map(async (relPath, index) => {
      const abs = relPath.startsWith('/') ? relPath : `${projectRoot}/${relPath}`;
      try {
        const content = await read(abs);
        const ext = relPath.split('.').pop() ?? '';
        return {
          path: relPath,
          content,
          language: extToLanguage(ext),
          byteSize: Buffer.byteLength(content, 'utf8'),
          isModified: modSet.has(relPath),
          priority: index,
        };
      } catch {
        return null;
      }
    })
  );

  return results.filter(Boolean);
}
