/**
 * Shared helpers for documentation, script analysis, and configuration validation
 * steps (steps 02, 03, and 04).
 *
 * Contains logic that is duplicated across Step2ConsistencyAnalyzer,
 * Step3ScriptAnalyzer, and Step4ConfigAnalyzer: dependency construction, AI
 * service setup, and the standard enriched-report format. Keeping these helpers
 * here ensures all steps stay consistent without repeating the same code.
 *
 * @module steps/step_analysis_helpers
 */

import { FileOperations } from '../lib/file_operations.js';
import { Backlog } from '../lib/backlog.js';
import { AiHelper } from '../lib/ai_helpers.js';
import { AiCache } from '../lib/ai_cache.js';
import { TechStackDetector } from '../lib/tech_stack.js';

/**
 * Construct the standard set of step dependencies from an options bag.
 *
 * Both Step2ConsistencyAnalyzer and Step3ScriptAnalyzer accept the same five
 * injectable dependencies with identical default instantiation logic. This
 * factory centralises those defaults so neither step duplicates the pattern.
 *
 * @param {Object} [options={}] - Dependency overrides
 * @param {FileOperations} [options.fileOps] - File operations adapter
 * @param {Backlog} [options.backlog] - Backlog/summary persistence adapter
 * @param {AiHelper} [options.aiHelper] - AI request helper
 * @param {AiCache} [options.aiCache] - AI response cache
 * @param {TechStackDetector} [options.techStack] - Technology stack detector
 * @param {string|null} [options.promptsDir] - Optional prompts directory override
 * @returns {{ fileOps: FileOperations, backlog: Backlog, aiHelper: AiHelper, aiCache: AiCache, techStack: TechStackDetector }}
 */
export function buildStepDependencies(options = {}) {
  return {
    fileOps: options.fileOps || new FileOperations(),
    backlog: options.backlog || new Backlog(),
    aiHelper: options.aiHelper || new AiHelper({ promptsDir: options.promptsDir || null }),
    aiCache: options.aiCache || new AiCache(),
    techStack: options.techStack || new TechStackDetector(),
  };
}

/**
 * Initialize AI services and return whether they are available for use.
 *
 * `aiHelper.initialize()` and `aiCache.init()` are always called together as
 * an atomic setup pair. This helper names that intent and ensures both steps
 * use the same initialization sequence.
 *
 * @param {AiHelper} aiHelper - AI request helper
 * @param {AiCache} aiCache - AI response cache
 * @returns {Promise<boolean>} `true` when AI services are available and ready
 */
export async function initializeAiServices(aiHelper, aiCache) {
  const available = await aiHelper.initialize();
  if (available) await aiCache.init();
  return available;
}

/**
 * Append an AI recommendations section to a base Markdown report.
 *
 * Both steps save an initial report before AI analysis, then overwrite it with
 * an enriched version once AI output is available. This pure function names
 * that intent and guarantees a consistent section heading and separator across
 * both steps.
 *
 * @pure
 * @param {string} baseReport - The base Markdown report string
 * @param {string} aiContent - The AI-generated recommendations body
 * @returns {string} The base report with the AI recommendations section appended
 */
export function appendAiRecommendations(baseReport, aiContent) {
  return `${baseReport}\n\n---\n\n## AI Recommendations\n\n${aiContent}`;
}
