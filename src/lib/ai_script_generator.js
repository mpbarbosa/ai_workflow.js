/**
 * AI Script Generator Module
 *
 * Converts structured AI remediation output into runnable shell/Node.js fix scripts.
 * Part of Phase 14.4 — Output Automater (Prompt Pattern #6, enhanced).
 *
 * Architecture: Pure functions + impure wrapper (v2.0.0)
 * - Pure functions: parse remediation items, generate script text, compute paths
 * - Impure wrapper: ScriptGenerator class for file I/O
 *
 * @module lib/ai_script_generator
 * @version 2.0.0
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import path from 'path';

// ==============================================================================
// CONSTANTS
// ==============================================================================

/** Directory inside workflowDir where fix scripts are written */
export const FIXES_DIR = 'fixes';

/** Script shebang header */
export const SCRIPT_SHEBANG = '#!/usr/bin/env bash';

/** Regex patterns used to extract remediation blocks from AI text */
export const REMEDIATION_PATTERNS = {
  /** Matches: FIX: <description>\n  FILE: <path>\n  COMMAND: <cmd> */
  structured: /FIX:\s*(.+?)\n(?:.*?FILE:\s*(.+?)\n)?(?:.*?COMMAND:\s*(.+?)(?=\n\n|\nFIX:|$))/gis,
  /** Matches: - [ ] <action> in <file> */
  checkbox: /- \[ \]\s*(.+?)(?:\s+in\s+(`[^`]+`|[\w./]+))?$/gim,
  /** Matches inline code blocks: `<command>` */
  inlineCode: /`([^`\n]{5,})`/g,
};

// ==============================================================================
// PURE FUNCTIONS
// ==============================================================================

/**
 * Compute the canonical path for a step's fix script.
 *
 * @param {string} workflowDir - Absolute path to the .ai_workflow directory
 * @param {string} stepName - Step identifier (e.g. "step_04", "step_07")
 * @returns {string} Absolute path for the fix script
 */
export function scriptFilePath(workflowDir, stepName) {
  if (!workflowDir || !stepName) {
    return '';
  }
  const safeName = String(stepName).replace(/[^a-z0-9_-]/gi, '_');
  return path.join(workflowDir, FIXES_DIR, `${safeName}_fixes.sh`);
}

/**
 * Parse structured remediation items from an AI response text.
 *
 * Supports three detection strategies (tried in order):
 * 1. Structured FIX/FILE/COMMAND blocks
 * 2. Markdown checkbox items (- [ ] ...)
 * 3. Inline code snippets that look like commands
 *
 * @param {string} aiResponseText - Raw AI step response text
 * @returns {Array<{description:string, file:string|null, command:string|null}>}
 */
export function parseRemediationItems(aiResponseText) {
  if (!aiResponseText || typeof aiResponseText !== 'string') {
    return [];
  }

  const items = [];
  const seen = new Set();

  const add = (description, file, command) => {
    const key = `${description}|${file}|${command}`;
    if (!seen.has(key)) {
      seen.add(key);
      items.push({
        description: (description || '').trim(),
        file: file ? file.trim().replace(/`/g, '') : null,
        command: command ? command.trim() : null,
      });
    }
  };

  // Strategy 1: Structured blocks
  const structured = new RegExp(REMEDIATION_PATTERNS.structured.source, 'gis');
  let m;
  while ((m = structured.exec(aiResponseText)) !== null) {
    add(m[1], m[2] || null, m[3] || null);
  }

  // Strategy 2: Checkbox items
  const checkbox = new RegExp(REMEDIATION_PATTERNS.checkbox.source, 'gim');
  while ((m = checkbox.exec(aiResponseText)) !== null) {
    add(m[1], m[2] || null, null);
  }

  // Strategy 3: Inline code (only if nothing else found)
  if (items.length === 0) {
    const inlineCode = new RegExp(REMEDIATION_PATTERNS.inlineCode.source, 'g');
    while ((m = inlineCode.exec(aiResponseText)) !== null) {
      const candidate = m[1].trim();
      // Heuristic: looks like a shell command (starts with a known verb or has flags)
      if (/^(npm|npx|node|python|pip|git|eslint|tsc|sh|bash|mv|cp|rm|mkdir|echo|sed|awk)/.test(candidate)) {
        add(candidate, null, candidate);
      }
    }
  }

  return items;
}

/**
 * Generate a bash fix script from an array of remediation items.
 *
 * @param {Array<{description:string, file:string|null, command:string|null}>} items
 * @param {Object} [options]
 * @param {string} [options.stepName='workflow-step'] - Step name for the script header
 * @param {string} [options.projectRoot=''] - Project root path (used in comments)
 * @returns {string} Complete bash script text
 */
export function generateFixScript(items, options = {}) {
  if (!Array.isArray(items) || items.length === 0) {
    return '';
  }

  const stepName = options.stepName || 'workflow-step';
  const projectRoot = options.projectRoot || '';
  const timestamp = options.timestamp || new Date().toISOString();

  const lines = [
    SCRIPT_SHEBANG,
    `# Auto-generated fix script for ${stepName}`,
    `# Generated: ${timestamp}`,
    projectRoot ? `# Project root: ${projectRoot}` : null,
    `# Remediations: ${items.length}`,
    '#',
    '# Review each command before running. Execute with:',
    `#   bash .ai_workflow/fixes/${stepName}_fixes.sh`,
    '',
    'set -euo pipefail',
    '',
  ].filter((l) => l !== null);

  if (projectRoot) {
    lines.push(`cd "${projectRoot}" || exit 1`, '');
  }

  items.forEach((item, i) => {
    lines.push(`# --- Remediation ${i + 1}: ${item.description} ---`);
    if (item.file) {
      lines.push(`# File: ${item.file}`);
    }
    if (item.command) {
      lines.push(item.command);
    } else {
      // No explicit command — emit a commented-out placeholder
      lines.push(`# TODO: manually apply: ${item.description}`);
    }
    lines.push('');
  });

  lines.push('echo "All remediations applied successfully."');

  return lines.join('\n');
}

// ==============================================================================
// IMPURE WRAPPER
// ==============================================================================

/**
 * Generates and saves a fix script for a workflow step.
 *
 * Side effects: creates the fixes/ directory if needed; writes a .sh file.
 */
export class ScriptGenerator {
  /**
   * @param {Object} options
   * @param {string} options.workflowDir - Absolute path to the .ai_workflow directory
   * @param {string} [options.projectRoot] - Project root path (for script header and cd)
   * @param {boolean} [options.dryRun=false] - When true, skip writing to disk
   */
  constructor(options = {}) {
    this.workflowDir = options.workflowDir || '';
    this.projectRoot = options.projectRoot || '';
    this.dryRun = !!options.dryRun;
  }

  /**
   * Parse, generate, and write a fix script for a step.
   *
   * @param {string} stepName - Step identifier (e.g. "step_04")
   * @param {string} aiResponseText - Raw AI response to parse for remediations
   * @param {Object} [opts] - Extra options forwarded to `generateFixScript`
   * @returns {{ scriptPath: string, remediationCount: number, skipped: boolean }}
   */
  generateAndSave(stepName, aiResponseText, opts = {}) {
    const items = parseRemediationItems(aiResponseText);

    if (items.length === 0) {
      return { scriptPath: null, remediationCount: 0, skipped: true };
    }

    const scriptPath = scriptFilePath(this.workflowDir, stepName);
    const scriptText = generateFixScript(items, {
      stepName,
      projectRoot: this.projectRoot,
      ...opts,
    });

    if (!this.dryRun && scriptPath) {
      const dir = path.dirname(scriptPath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      writeFileSync(scriptPath, scriptText, { mode: 0o755 });
    }

    return { scriptPath, remediationCount: items.length, skipped: false };
  }
}
