/**
 * Context assembler — fits artifacts into named evidence slots respecting token budgets.
 *
 * @module lib/context_assembler
 */

import { estimateTokens, fitToTokens } from './token_budget.js';

/**
 * Serialise a completeness manifest into a structured preamble string suitable
 * for injection into a prompt via the `{evidence_manifest}` placeholder.
 *
 * @param {ManifestEntry[]} manifest
 * @returns {string}  Empty string when the manifest is empty.
 */
export function buildManifestPreamble(manifest) {
  if (!manifest || manifest.length === 0) return '';

  const fullCount = manifest.filter((e) => e.status === 'full').length;
  const total = manifest.length;

  const header = `**Evidence completeness (${fullCount} of ${total} files fully included):**`;

  const lines = manifest.map((e) => {
    let detail;
    if (e.status === 'truncated') {
      detail = `truncated (line ${e.includedLines} of ${e.totalLines})`;
    } else if (e.status === 'absent') {
      detail = 'absent (exceeded slot budget)';
    } else {
      detail = 'full';
    }
    return `- ${e.file}  — ${detail}`;
  });

  return [header, ...lines].join('\n');
}

/**
 * @typedef {Object} EvidenceSlot
 * @property {string} name - Slot identifier; used as key in ReviewContext.slots.
 * @property {import('./artifact_repository.js').Artifact[]} artifacts
 * @property {number} budget - Token budget. Values in (0, 1) are treated as a
 *   fraction of totalTokenBudget; values ≥ 1 are absolute token counts.
 * @property {'tail'|'line-boundary'|'skip'} policy - Truncation policy applied
 *   to the first artifact that partially fits.
 */

/**
 * @typedef {Object} ManifestEntry
 * @property {string} slot
 * @property {string} file
 * @property {'full'|'truncated'|'absent'} status
 * @property {number} [includedLines] - Set when status === 'truncated'.
 * @property {number} [totalLines]    - Set when status === 'truncated'.
 */

/**
 * @typedef {Object} ReviewContext
 * @property {Record<string, string>} slots - Slot name → assembled prompt text.
 * @property {ManifestEntry[]} manifest     - Completeness record for every artifact.
 */

/**
 * @param {import('./artifact_repository.js').Artifact} artifact
 * @param {string} content
 * @returns {string}
 */
function renderArtifact(artifact, content) {
  return `### ${artifact.path}\n\`\`\`${artifact.language}\n${content}\n\`\`\``;
}

/**
 * Assemble artifacts into a ReviewContext, respecting per-slot token budgets.
 *
 * Within each slot, artifacts are processed in the order provided (callers
 * should pre-sort by priority via `loadArtifacts`). The first artifact that
 * partially fits is truncated using the slot's policy; subsequent artifacts are
 * marked absent. With the `'skip'` policy, oversized artifacts are skipped
 * (marked absent) and the remaining budget is preserved for the next artifact.
 *
 * @param {EvidenceSlot[]} slots
 * @param {number} totalTokenBudget - Fractional slot budgets are resolved
 *   against this value.
 * @returns {ReviewContext}
 */
export function assemble(slots, totalTokenBudget) {
  const manifest = [];
  const slotTexts = {};

  for (const slot of slots) {
    const slotBudget =
      slot.budget > 0 && slot.budget < 1 ? Math.floor(slot.budget * totalTokenBudget) : slot.budget;

    let remaining = slotBudget;
    const parts = [];

    for (const artifact of slot.artifacts) {
      if (remaining <= 0) {
        manifest.push({ slot: slot.name, file: artifact.path, status: 'absent' });
        continue;
      }

      const tokens = estimateTokens(artifact.content);

      if (tokens <= remaining) {
        parts.push(renderArtifact(artifact, artifact.content));
        manifest.push({ slot: slot.name, file: artifact.path, status: 'full' });
        remaining -= tokens;
      } else if (slot.policy === 'skip') {
        // Mark absent and keep remaining budget for subsequent artifacts.
        manifest.push({ slot: slot.name, file: artifact.path, status: 'absent' });
      } else {
        const truncated = fitToTokens(artifact.content, remaining, slot.policy);
        parts.push(renderArtifact(artifact, truncated));
        manifest.push({
          slot: slot.name,
          file: artifact.path,
          status: 'truncated',
          includedLines: truncated.split('\n').length,
          totalLines: artifact.content.split('\n').length,
        });
        remaining = 0;
      }
    }

    slotTexts[slot.name] = parts.join('\n\n');
  }

  return { slots: slotTexts, manifest };
}
