/**
 * Shared helpers for common execute()-time step setup.
 *
 * @module steps/step_execution_helpers
 */

import { logger } from '../core/logger.js';
import { buildStructuredPrompt, injectProjectContext } from '../lib/ai_prompt_builder.js';
import { getPrimaryLanguage } from '../lib/tech_stack.js';

/**
 * Detect the project's primary language using the provided tech stack detector.
 *
 * @param {import('../lib/tech_stack.js').TechStackDetector} techStack - Technology stack detector
 * @param {string} projectRoot - Project root directory
 * @returns {Promise<string>} Detected primary language
 */
export function detectPrimaryLanguage(techStack, projectRoot) {
  return getPrimaryLanguage(techStack, projectRoot);
}

/**
 * Detect and log the project's primary language in the standard step format.
 *
 * Steps 6, 7, 8, and 9 all begin execute() by resolving the primary language
 * and emitting the same log line. Centralizing that setup keeps the test-related
 * step flow consistent without changing behavior.
 *
 * @param {import('../lib/tech_stack.js').TechStackDetector} techStack - Technology stack detector
 * @param {string} projectRoot - Project root directory
 * @returns {Promise<string>} Detected primary language
 */
export async function detectAndLogPrimaryLanguage(techStack, projectRoot) {
  const language = await detectPrimaryLanguage(techStack, projectRoot);
  logger.info(`Detected language: ${language}`);
  return language;
}

/**
 * Initialize AI resources for steps that perform optional AI analysis.
 *
 * Many execute() methods share the same setup flow: optionally skip AI work,
 * initialize the AI helper, and initialize the AI cache only when the helper
 * is available. This helper centralizes that sequence without changing the
 * caller's branching or output handling.
 *
 * @param {object} params - Helper parameters
 * @param {{ initialize?: Function } | null | undefined} params.aiHelper - AI helper instance
 * @param {{ init?: Function } | null | undefined} params.aiCache - AI cache instance
 * @param {boolean} [params.shouldInitialize=true] - Whether AI initialization should run
 * @returns {Promise<boolean>} Whether AI analysis is available for the caller
 */
export async function initializeStepAiContext({
  aiHelper,
  aiCache,
  shouldInitialize = true,
} = {}) {
  if (!shouldInitialize || typeof aiHelper?.initialize !== 'function') {
    return false;
  }

  const aiAvailable = await aiHelper.initialize();
  if (!aiAvailable) {
    return false;
  }

  if (typeof aiCache?.init === 'function') {
    await aiCache.init();
  }

  return true;
}

/**
 * Initialize optional AI analysis for a step and persist any enriched summary
 * content that the caller produces.
 *
 * Step execute() methods such as Step 8 and Step 9 share the same orchestration:
 * initialize AI services only when enabled, log a standard unavailable message
 * when the helper cannot be used, and persist any returned AI/extra analysis
 * sections on top of an already-saved base report. This helper keeps that
 * wiring in one place while leaving each step fully responsible for its own
 * prompt building, caching, and error behavior.
 *
 * @param {object} params - Helper parameters
 * @param {{ initialize?: Function } | null | undefined} params.aiHelper - AI helper instance
 * @param {{ init?: Function } | null | undefined} params.aiCache - AI cache instance
 * @param {boolean} [params.shouldInitialize=true] - Whether AI initialization should run
 * @param {string} [params.unavailableMessage] - Message logged when AI is unavailable
 * @param {() => Promise<{ aiRecommendations?: string, extraSections?: Array<{title: string, content: string}> }>} params.buildAnalysis - Builds optional analysis sections
 * @param {import('../lib/backlog.js').Backlog} params.backlog - Backlog instance
 * @param {string|number} params.stepId - Workflow step identifier
 * @param {string} params.stepName - Human-readable step name
 * @param {string} params.summary - Base Markdown summary already produced by the step
 * @returns {Promise<boolean>} Whether an enriched summary was persisted
 */
export async function enrichStepSummaryWithOptionalAiAnalysis({
  aiHelper,
  aiCache,
  shouldInitialize = true,
  unavailableMessage,
  buildAnalysis,
  backlog,
  stepId,
  stepName,
  summary,
}) {
  const aiAvailable = await initializeStepAiContext({
    aiHelper,
    aiCache,
    shouldInitialize,
  });
  if (!aiAvailable) {
    if (shouldInitialize && unavailableMessage) {
      logger.warn(unavailableMessage);
    }
    return false;
  }

  const analysis = (await buildAnalysis()) ?? {};
  return saveStepSummaryWithAnalysisSections({
    backlog,
    stepId,
    stepName,
    summary,
    aiRecommendations: analysis.aiRecommendations ?? '',
    extraSections: analysis.extraSections ?? [],
  });
}

/**
 * Build a step prompt by trying the preferred YAML-driven prompt first, then
 * falling back to the standard structured prompt format when needed.
 *
 * Several execute() methods share the same orchestration: attempt a
 * step-specific YAML prompt, swallow template-loading/build failures, and then
 * construct a generic prompt with role/task/approach sections. Centralizing
 * that behavior removes duplication without changing each step's prompt inputs,
 * fallback wording, or project-context injection.
 *
 * @param {object} params - Helper parameters
 * @param {() => (string | Promise<string>)} params.buildPrompt - Preferred prompt builder
 * @param {string} params.fallbackRole - Fallback structured prompt role
 * @param {string} params.fallbackTask - Fallback structured prompt task
 * @param {string} params.fallbackApproach - Fallback structured prompt approach
 * @param {object} [params.fallbackProjectContext={}] - Project context injected into the fallback prompt
 * @returns {Promise<string>} Resolved prompt content
 */
export async function buildStepPromptWithFallback({
  buildPrompt,
  fallbackRole,
  fallbackTask,
  fallbackApproach,
  fallbackProjectContext = {},
}) {
  let prompt;
  try {
    prompt = await buildPrompt();
  } catch {
    /* fallback to generic prompt */
  }

  if (prompt) {
    return prompt;
  }

  return injectProjectContext(
    buildStructuredPrompt({
      role: fallbackRole,
      task: fallbackTask,
      approach: fallbackApproach,
    }),
    fallbackProjectContext
  );
}

/**
 * Persist an enriched step summary when AI recommendations or related analysis
 * sections are available.
 *
 * Step execute() methods such as Step 8 and Step 9 follow the same summary
 * enrichment flow after saving their base report: append an `AI Recommendations`
 * section when present, append any additional titled sections, and persist the
 * combined summary only when there is supplementary content to save.
 * Centralizing that flow keeps execute() methods focused on step-specific
 * branching while preserving summary formatting and write behavior.
 *
 * @param {object} params - Helper parameters
 * @param {import('../lib/backlog.js').Backlog} params.backlog - Backlog instance
 * @param {string|number} params.stepId - Workflow step identifier
 * @param {string} params.stepName - Human-readable step name
 * @param {string} params.summary - Base Markdown summary already produced by the step
 * @param {string} [params.aiRecommendations] - Optional AI recommendations body
 * @param {Array<{title: string, content: string}>} [params.extraSections=[]] - Optional titled sections
 * @returns {Promise<boolean>} Whether an enriched summary was persisted
 */
export async function saveStepSummaryWithAnalysisSections({
  backlog,
  stepId,
  stepName,
  summary,
  aiRecommendations = '',
  extraSections = [],
}) {
  const normalizedExtraSections = extraSections.filter(
    (section) => section?.title && section?.content
  );
  if (!aiRecommendations && normalizedExtraSections.length === 0) {
    return false;
  }

  const sections = aiRecommendations
    ? [`${summary}\n\n---\n\n## AI Recommendations\n\n${aiRecommendations}`]
    : [summary];
  for (const section of normalizedExtraSections) {
    sections.push(`\n\n## ${section.title}\n\n${section.content}`);
  }

  await backlog.saveStepSummary(stepId, stepName, sections.join(''));
  return true;
}

/**
 * Log a step outcome, persist its summary, and return the provided result unchanged.
 *
 * This is the common execute() early-exit flow used by multiple step classes:
 * emit a final status line, save the step summary, and hand the shaped result
 * back to the orchestrator without altering it.
 *
 * @param {object} params - Helper parameters
 * @param {import('../lib/backlog.js').Backlog} params.backlog - Backlog instance
 * @param {string|number} params.stepId - Workflow step identifier
 * @param {string} params.stepName - Human-readable step name
 * @param {'info'|'warn'|'error'|'success'|'debug'} [params.logMethod] - Logger method to invoke
 * @param {string} params.logMessage - Message to log before persisting the summary
 * @param {string} params.summary - Markdown summary to persist
 * @param {object} params.result - Result object to return unchanged
 * @param {string} [params.icon] - Optional summary icon passed through to the backlog
 * @returns {Promise<object>} The provided result object
 */
export async function logStepOutcomeAndReturn({
  backlog,
  stepId,
  stepName,
  logMethod = 'info',
  logMessage,
  summary,
  result,
  icon,
}) {
  const logFn = logger[logMethod];
  if (typeof logFn !== 'function') {
    throw new TypeError(`Unsupported log method: ${logMethod}`);
  }

  logFn.call(logger, logMessage);
  return saveStepSummaryAndReturn(backlog, stepId, stepName, summary, result, icon);
}

/**
 * Log a skipped step outcome, persist its summary, and return a standardized
 * success/skipped result payload.
 *
 * Several project-kind execute() methods follow the same early-exit shape when
 * a step is intentionally skipped: log the reason, persist the report, and
 * return a successful `{ skipped: true }` result with step-specific metadata.
 * Centralizing that wiring keeps those branches compact without changing each
 * step's report format or payload details.
 *
 * @param {object} params - Helper parameters
 * @param {import('../lib/backlog.js').Backlog} params.backlog - Backlog instance
 * @param {string|number} params.stepId - Workflow step identifier
 * @param {string} params.stepName - Human-readable step name
 * @param {'info'|'warn'|'error'|'success'|'debug'} [params.logMethod] - Logger method to invoke
 * @param {string} params.logMessage - Message to log before persisting the summary
 * @param {string} params.summary - Markdown summary to persist
 * @param {object} [params.result={}] - Additional step-specific result fields
 * @param {string} [params.message] - Optional returned message field
 * @param {string} [params.reason] - Optional returned reason field
 * @param {string} [params.icon] - Optional summary icon passed through to the backlog
 * @returns {Promise<object>} The standardized skipped result object
 */
export async function logSkippedStepOutcomeAndReturn({
  backlog,
  stepId,
  stepName,
  logMethod = 'info',
  logMessage,
  summary,
  result = {},
  message,
  reason,
  icon,
}) {
  return logStepOutcomeAndReturn({
    backlog,
    stepId,
    stepName,
    logMethod,
    logMessage,
    summary,
    result: {
      ...result,
      success: true,
      skipped: true,
      ...(message === undefined ? {} : { message }),
      ...(reason === undefined ? {} : { reason }),
    },
    icon,
  });
}

/**
 * Log a skipped step outcome that must retain the detected project language in
 * its returned payload.
 *
 * Step 8 and Step 9 both detect the primary language up front, then return
 * language-aware skipped results through the same persisted-summary flow.
 * This wrapper keeps that repeated execute() wiring in one place without
 * changing each step's report content or additional result fields.
 *
 * @param {object} params - Helper parameters
 * @param {import('../lib/backlog.js').Backlog} params.backlog - Backlog instance
 * @param {string|number} params.stepId - Workflow step identifier
 * @param {string} params.stepName - Human-readable step name
 * @param {string} params.language - Detected project language to include in the result
 * @param {'info'|'warn'|'error'|'success'|'debug'} [params.logMethod] - Logger method to invoke
 * @param {string} params.logMessage - Message to log before persisting the summary
 * @param {string} params.summary - Markdown summary to persist
 * @param {object} [params.result={}] - Additional step-specific result fields
 * @param {string} [params.message] - Optional returned message field
 * @param {string} [params.reason] - Optional returned reason field
 * @param {string} [params.icon] - Optional summary icon passed through to the backlog
 * @returns {Promise<object>} The standardized skipped result object with language included
 */
export async function logLanguageAwareSkippedStepOutcomeAndReturn({
  language,
  result = {},
  ...params
}) {
  return logSkippedStepOutcomeAndReturn({
    ...params,
    result: {
      language,
      ...result,
    },
  });
}

/**
 * Persist a step summary and return the provided result object unchanged.
 *
 * This keeps execute() early-exit branches compact in steps that must save a
 * backlog summary before returning a step result.
 *
 * @param {import('../lib/backlog.js').Backlog} backlog - Backlog instance
 * @param {string|number} stepId - Workflow step identifier
 * @param {string} stepName - Human-readable step name
 * @param {string} summary - Markdown summary to persist
 * @param {object} result - Result object to return unchanged
 * @param {string} [icon] - Optional summary icon passed through to the backlog
 * @returns {Promise<object>} The provided result object
 */
export async function saveStepSummaryAndReturn(backlog, stepId, stepName, summary, result, icon) {
  await backlog.saveStepSummary(stepId, stepName, summary, icon);
  return result;
}
