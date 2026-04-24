/**
 * AI Prompt Builder Module
 *
 * Provides dynamic AI prompt generation with project-aware context injection,
 * template substitution, and specialized builders for different workflow steps.
 *
 * Architecture: Pure functions + impure wrapper (v2.0.0)
 * - Pure functions for template logic (deterministic)
 * - Impure wrapper for file I/O and configuration loading
 *
 * @module lib/ai_prompt_builder
 * @version 2.0.0
 */

import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
// Resolves to: ai_workflow.js/.workflow_core/config/ai_helpers.yaml
export const AI_HELPERS_PATH = path.resolve(
  path.dirname(__filename),
  '../../.workflow_core/config/ai_helpers.yaml'
);

// Resolves to: ai_workflow.js/.workflow_core/config/ai_prompts_project_kinds.yaml
export const AI_PROJECT_KINDS_PATH = path.resolve(
  path.dirname(__filename),
  '../../.workflow_core/config/ai_prompts_project_kinds.yaml'
);

// Resolves to: ai_workflow.js/.workflow_core/config/prompt_roles.yaml
export const PROMPT_ROLES_PATH = path.resolve(
  path.dirname(__filename),
  '../../.workflow_core/config/prompt_roles.yaml'
);

// ==============================================================================
// PURE FUNCTIONS - Role Reference Resolution
// ==============================================================================

/**
 * Resolve a single persona's `role_ref` to the full `role_prefix` text.
 *
 * If the persona already has an inline `role_prefix`, it is returned unchanged.
 * If it has a `role_ref`, the corresponding entry in `roles.roles` is looked up
 * and `role_prefix` is populated from there.
 *
 * Mirrors the logic in `.workflow_core/src/loader.ts → resolvePersona()`.
 *
 * @param {Object} persona - A single parsed persona object from ai_helpers.yaml
 * @param {Object} roles   - Parsed prompt_roles.yaml object (must have a `roles` key)
 * @returns {Object} A new persona object with `role_prefix` populated
 * @throws {Error} If `role_ref` is present but not found in roles
 * @pure
 */
export function resolveRoleRef(persona, roles) {
  if (!persona || typeof persona !== 'object') return persona;
  if (!persona.role_ref) return { ...persona };

  if (!roles?.roles || !Object.prototype.hasOwnProperty.call(roles.roles, persona.role_ref)) {
    throw new Error(`role_ref "${persona.role_ref}" not found in prompt_roles.yaml`);
  }
  const roleEntry = roles.roles[persona.role_ref];
  const { role_ref: _unusedRoleRef, ...rest } = persona; // eslint-disable-line no-unused-vars
  return { ...rest, role_prefix: roleEntry.role_prefix };
}

/**
 * Resolve all `role_ref` pointers in a parsed ai_helpers.yaml object.
 *
 * Iterates every top-level key; for entries that are objects with a `role_ref`,
 * replaces `role_ref` with the full `role_prefix` from `roles`. Non-persona
 * entries (lookup tables, metadata) are passed through unchanged.
 *
 * Mirrors `.workflow_core/src/loader.ts → resolveAllPersonas()`.
 *
 * @param {Object} parsedYaml - Parsed ai_helpers.yaml object
 * @param {Object} roles      - Parsed prompt_roles.yaml object
 * @returns {Object} New object with all role_refs resolved to role_prefix strings
 * @pure
 */
export function resolveAllRoleRefs(parsedYaml, roles) {
  if (!parsedYaml || typeof parsedYaml !== 'object') return parsedYaml;
  const resolved = {};
  for (const [key, value] of Object.entries(parsedYaml)) {
    if (value && typeof value === 'object' && !Array.isArray(value) && value.role_ref) {
      resolved[key] = resolveRoleRef(value, roles);
    } else {
      resolved[key] = value;
    }
  }
  return resolved;
}

// ==============================================================================
// PURE FUNCTIONS - Persona Enumeration and Validation
// ==============================================================================

/**
 * Returns a sorted array of all persona keys in a parsed ai_helpers.yaml object.
 *
 * An entry is considered a persona if it is a plain object with a `role_ref`
 * string property (structural detection, consistent with resolveAllRoleRefs).
 * Non-persona entries (language lookup tables, YAML anchor scalars) are excluded.
 *
 * Mirrors `.workflow_core/src/loader.ts → listPersonas()`.
 *
 * @param {Object} parsedYaml - Parsed ai_helpers.yaml object
 * @returns {string[]} Sorted array of persona keys
 * @pure
 */
export function listPersonas(parsedYaml) {
  if (!parsedYaml || typeof parsedYaml !== 'object') return [];
  return Object.entries(parsedYaml)
    .filter(
      ([, value]) =>
        value &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        typeof value.role_ref === 'string'
    )
    .map(([key]) => key)
    .sort();
}

/**
 * Validates that every persona in `parsedYaml` has a `role_ref` that resolves
 * to an own-property of `roles.roles`.
 *
 * Unlike `resolveAllRoleRefs` (which throws on the first bad reference), this
 * function collects **all** unresolvable references and returns them as a list,
 * making it suitable for pre-flight validation and CI checks.
 *
 * Non-persona entries (language tables, YAML anchor scalars) are silently
 * ignored — only entries with a `role_ref` are validated.
 *
 * Mirrors `.workflow_core/src/loader.ts → validateConfig()`.
 *
 * @param {Object} parsedYaml - Parsed ai_helpers.yaml object
 * @param {Object} roles      - Parsed prompt_roles.yaml object (must have a `roles` key)
 * @returns {{ valid: boolean, errors: string[] }} Validation result
 * @pure
 */
export function validateConfig(parsedYaml, roles) {
  const errors = [];
  if (parsedYaml && typeof parsedYaml === 'object') {
    for (const [key, value] of Object.entries(parsedYaml)) {
      if (
        !value ||
        typeof value !== 'object' ||
        Array.isArray(value) ||
        typeof value.role_ref !== 'string'
      )
        continue;
      if (!roles?.roles || !Object.prototype.hasOwnProperty.call(roles.roles, value.role_ref)) {
        errors.push(
          `Role reference "${value.role_ref}" used by persona "${key}" was not found ` +
            `in prompt_roles.yaml. Add an entry under roles.${value.role_ref} or correct the role_ref key.`
        );
      }
    }
  }
  errors.sort();
  return { valid: errors.length === 0, errors };
}

// ==============================================================================
// PURE FUNCTIONS - Template Processing
// ==============================================================================

/**
 * Build prompt from template with variable substitution
 *
 * Replaces placeholders like {variable} or ${variable} with values from context.
 *
 * @param {string} template - Template string with placeholders
 * @param {Object} context - Key-value pairs for substitution
 * @returns {string} Template with placeholders replaced
 *
 * @example
 * const prompt = buildPromptFromTemplate(
 *   'Analyze {file} for {language}',
 *   { file: 'app.js', language: 'JavaScript' }
 * );
 * // => 'Analyze app.js for JavaScript'
 */
export function buildPromptFromTemplate(template, context = {}) {
  if (!template || typeof template !== 'string') {
    return '';
  }

  const knownKeys = new Set(Object.keys(context));

  // Step 1: Remove unfilled placeholders from the RAW template, before any content
  // injection. This preserves ${VAR} expressions in injected file content (e.g.,
  // bash scripts with ${SCRIPT_DIR}) which would otherwise be stripped as "unfilled".
  let result = template
    .replace(/\$\{([a-z_]\w*)\}/gi, (_, key) => (knownKeys.has(key) ? `\${${key}}` : ''))
    .replace(/\{([a-z_]\w*)\}/gi, (_, key) => (knownKeys.has(key) ? `{${key}}` : ''));

  // Step 2: Substitute known variables. File content is injected here, AFTER
  // the cleanup pass, so bash/shell ${VAR} in injected content is never stripped.
  // Replace ${variable} patterns first, then {variable} patterns.
  // Order matters: ${var} must be processed before {var}.
  // IMPORTANT: use a replacer function (not a string) so that special replacement
  // patterns in the value (e.g. $& or $1) are never interpreted by String#replace.
  for (const [key, value] of Object.entries(context)) {
    const dollarPattern = new RegExp(`\\$\\{${key}\\}`, 'g');
    const str = String(value ?? '');
    result = result.replace(dollarPattern, () => str);
  }

  for (const [key, value] of Object.entries(context)) {
    const bracePattern = new RegExp(`\\{${key}\\}`, 'g');
    const str = String(value ?? '');
    result = result.replace(bracePattern, () => str);
  }

  return result;
}

function canonicalizeProjectText(value) {
  if (!value || typeof value !== 'string') {
    return '';
  }

  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

/**
 * Convert a project-kind identifier into a readable label for prompt summaries.
 *
 * @param {string} projectKind - Project kind identifier like `nodejs_api`
 * @returns {string} Human-readable label, or empty string if unavailable
 * @pure
 */
export function formatProjectKindLabel(projectKind) {
  if (!projectKind || typeof projectKind !== 'string') {
    return '';
  }

  return projectKind
    .trim()
    .replace(/[_-]+/g, ' ')
    .replace(/\bapi\b/gi, 'API')
    .replace(/\bspa\b/gi, 'SPA')
    .replace(/\btui\b/gi, 'TUI')
    .replace(/\bux\b/gi, 'UX')
    .replace(/\bui\b/gi, 'UI')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Derive a concise, human-readable project summary for prompt headers.
 *
 * Prefers a meaningful `project_description` when available. When the description is
 * blank, placeholder-like, or duplicates the project name, falls back to a summary
 * derived from language and project kind so prompts still carry useful context.
 *
 * @param {Object} [context] - Prompt context values
 * @returns {string} Project summary for prompt use
 * @pure
 */
export function deriveProjectSummary(context = {}) {
  const projectName = String(context.project_name ?? '').trim();
  const projectDescription = String(context.project_description ?? '').trim();
  const primaryLanguage = String(context.primary_language ?? context.language ?? '').trim();
  const projectKind = formatProjectKindLabel(
    String(context.project_kind ?? context.projectKind ?? '').trim()
  );
  const normalizedDescription = canonicalizeProjectText(projectDescription);
  const normalizedName = canonicalizeProjectText(projectName);
  const placeholderDescriptions = new Set(['', 'na', 'n/a', 'none', 'unknown', 'unspecified']);

  if (
    projectDescription &&
    !placeholderDescriptions.has(projectDescription.toLowerCase()) &&
    normalizedDescription !== normalizedName
  ) {
    return projectDescription;
  }

  if (primaryLanguage && projectKind) {
    return `${primaryLanguage} ${projectKind} project`;
  }

  if (primaryLanguage) {
    return `${primaryLanguage} project`;
  }

  if (projectKind) {
    return `${projectKind} project`;
  }

  return 'Software project';
}

/**
 * Inject project context into prompt
 *
 * Adds project-specific information like tech stack, language, project kind.
 *
 * @param {string} prompt - Base prompt text
 * @param {Object} projectInfo - Project information
 * @param {string} [projectInfo.description] - Human-readable project description
 * @param {string} [projectInfo.language] - Primary language
 * @param {string} [projectInfo.projectKind] - Project type
 * @param {string[]} [projectInfo.techStack] - Technologies used
 * @param {string} [projectInfo.framework] - Framework name
 * @returns {string} Prompt with project context injected
 *
 * @example
 * const enhanced = injectProjectContext(prompt, {
 *   description: 'Interactive TUI tool to analyze ai_workflow.js execution logs',
 *   language: 'JavaScript',
 *   projectKind: 'nodejs_api',
 *   framework: 'Express'
 * });
 */
export function injectProjectContext(prompt, projectInfo = {}) {
  if (!prompt || typeof prompt !== 'string') {
    return '';
  }

  const parts = [prompt];

  // Add project context section
  if (Object.keys(projectInfo).length > 0) {
    const contextLines = ['', '**Project Context**:'];

    if (projectInfo.description) {
      contextLines.push(`- **Description**: ${projectInfo.description}`);
    }

    if (projectInfo.language) {
      contextLines.push(`- **Language**: ${projectInfo.language}`);
    }

    if (projectInfo.projectKind) {
      contextLines.push(`- **Project Type**: ${projectInfo.projectKind}`);
    }

    if (projectInfo.framework) {
      contextLines.push(`- **Framework**: ${projectInfo.framework}`);
    }

    if (projectInfo.techStack && projectInfo.techStack.length > 0) {
      contextLines.push(`- **Tech Stack**: ${projectInfo.techStack.join(', ')}`);
    }

    parts.push(contextLines.join('\n'));
  }

  return parts.join('\n');
}

/**
 * Format a PROJECT_CONTEXT.md file's content as a prompt constraints section.
 *
 * Wraps the raw markdown from a project's `PROJECT_CONTEXT.md` into a clearly
 * labelled section that can be prepended to any AI prompt. Positioning it early
 * in the prompt signals to the AI which analysis areas are inapplicable for the
 * current project's runtime (e.g. CORS for a Node.js-only library).
 *
 * Returns an empty string when `content` is falsy or not a string, making it safe
 * to call unconditionally and only inject when content is available.
 *
 * @param {string} content - Raw markdown content of PROJECT_CONTEXT.md.
 * @returns {string} Formatted section string, or `''` if content is empty.
 *
 * @since 1.6.3
 *
 * @example
 * const section = formatProjectContextSection('## Runtime\n- Node.js only');
 * // => '**Runtime Constraints (from PROJECT_CONTEXT.md)**:\n## Runtime\n- Node.js only'
 */
export function formatProjectContextSection(content) {
  if (!content || typeof content !== 'string' || !content.trim()) {
    return '';
  }
  return `**Runtime Constraints (from PROJECT_CONTEXT.md)**:\n${content.trim()}`;
}

/**
 * Format code block for prompt
 *
 * Wraps code in markdown code fence with language identifier.
 *
 * @param {string} code - Code to format
 * @param {string} [language=''] - Language identifier
 * @returns {string} Formatted code block
 *
 * @example
 * const block = formatCodeBlock('const x = 1;', 'javascript');
 * // => '```javascript\nconst x = 1;\n```'
 */
export function formatCodeBlock(code, language = '') {
  if (!code || typeof code !== 'string') {
    return '```\n```';
  }

  const fence = '```';
  return `${fence}${language}\n${code.trim()}\n${fence}`;
}

/**
 * Build file list context for prompt
 *
 * Creates a formatted list of files with optional grouping by type.
 *
 * @param {string[]} files - Array of file paths
 * @param {Object} [options] - Formatting options
 * @param {boolean} [options.groupByType=false] - Group files by extension
 * @param {boolean} [options.numbered=false] - Add numbers to list
 * @returns {string} Formatted file list
 *
 * @example
 * const list = buildFileListContext(['app.js', 'test.js'], { numbered: true });
 * // => '1. app.js\n2. test.js'
 */
export function buildFileListContext(files, options = {}) {
  if (!Array.isArray(files) || files.length === 0) {
    return 'No files';
  }

  const { groupByType = false, numbered = false } = options;

  if (!groupByType) {
    // Simple list
    return files
      .map((file, index) => {
        const prefix = numbered ? `${index + 1}. ` : '- ';
        return `${prefix}${file}`;
      })
      .join('\n');
  }

  // Group by extension
  const groups = {};
  for (const file of files) {
    const parts = file.split('.');
    const ext = parts.length > 1 ? parts.pop() : 'no-ext';
    if (!groups[ext]) {
      groups[ext] = [];
    }
    groups[ext].push(file);
  }

  const sections = [];
  for (const [ext, groupFiles] of Object.entries(groups)) {
    sections.push(`**${ext} files**:`);
    sections.push(groupFiles.map((f) => `- ${f}`).join('\n'));
  }

  return sections.join('\n\n');
}

/**
 * Truncate context to token limit
 *
 * Estimates tokens (rough: 4 chars ≈ 1 token) and truncates if needed.
 *
 * @param {string} context - Context text to truncate
 * @param {number} maxTokens - Maximum tokens allowed
 * @param {string} [truncationMessage='...'] - Message to append when truncated
 * @returns {string} Truncated context
 *
 * @example
 * const truncated = truncateContext('Long text...', 100);
 */
export function truncateContext(context, maxTokens, truncationMessage = '...(truncated)') {
  if (!context || typeof context !== 'string') {
    return '';
  }

  // Rough estimation: 4 characters ≈ 1 token
  const estimatedTokens = Math.ceil(context.length / 4);

  if (estimatedTokens <= maxTokens) {
    return context;
  }

  // Calculate character limit
  const maxChars = maxTokens * 4 - truncationMessage.length;
  return context.substring(0, maxChars) + truncationMessage;
}

/**
 * Build structured prompt with role, task, and approach sections
 *
 * @param {Object} sections - Prompt sections
 * @param {string} sections.role - AI role description
 * @param {string} sections.task - Task description
 * @param {string} sections.approach - Methodology/approach
 * @param {Object} [sections.context] - Additional context
 * @returns {string} Structured prompt
 *
 * @example
 * const prompt = buildStructuredPrompt({
 *   role: 'You are a code reviewer',
 *   task: 'Review this code',
 *   approach: 'Check for bugs and style'
 * });
 */
export function buildStructuredPrompt(sections) {
  const parts = [];

  if (sections.role) {
    parts.push(`**Role**: ${sections.role}`);
  }

  if (sections.task) {
    parts.push(`**Task**: ${sections.task}`);
  }

  if (sections.approach) {
    parts.push(`**Approach**: ${sections.approach}`);
  }

  if (sections.context && Object.keys(sections.context).length > 0) {
    parts.push(`**Context**: ${JSON.stringify(sections.context, null, 2)}`);
  }

  return parts.join('\n\n');
}

// ==============================================================================
// YAML PROMPT LOADING (Pure function)
// ==============================================================================

/**
 * Build a structured prompt from a parsed ai_helpers.yaml step config.
 *
 * Extracts `role`, `task_template`, and `approach` from the specified YAML key,
 * substitutes `{variable}` placeholders in `task_template` using `context`,
 * then assembles using `buildStructuredPrompt`. Returns null if the key is not found.
 *
 * @param {Object|null} parsedYaml - Parsed YAML object (from js-yaml.load)
 * @param {string} yamlKey - Top-level key in ai_helpers.yaml (e.g. 'step3_script_refs_prompt')
 * @param {Object} [context] - Variable values to substitute in `task_template`
 * @returns {string|null} Assembled prompt string, or null if key missing
 *
 * @example
 * const parsed = yaml.load(rawYaml);
 * const prompt = buildYamlStepPrompt(parsed, 'step3_script_refs_prompt', {
 *   project_name: 'my-project',
 *   script_count: '5',
 * });
 */
export function buildYamlStepPrompt(parsedYaml, yamlKey, context = {}) {
  if (!parsedYaml || typeof parsedYaml !== 'object') return null;
  const config = parsedYaml[yamlKey];
  if (!config || typeof config !== 'object') return null;

  const role = config.role || config.role_prefix || '';
  const taskTemplate = config.task_template || config.task || '';
  const approach = config.approach || '';

  // Auto-resolve any {variable} placeholders that match top-level YAML keys
  // (e.g., {language_specific_quality}, {language_specific_testing})
  const enrichedContext = { ...context };
  const placeholders = (taskTemplate + approach).match(/\{([a-z][a-z0-9_]*)\}/g) || [];
  // Language fallback aliases: used only when exact language key is absent from lookup table
  const primaryLang = (context.primary_language || 'javascript').toLowerCase();
  const langAlias = { typescript: 'javascript' };
  for (const match of placeholders) {
    const key = match.slice(1, -1);
    if (!(key in enrichedContext) && parsedYaml[key] !== undefined) {
      const val = parsedYaml[key];
      if (typeof val === 'string') {
        enrichedContext[key] = val;
      } else if (typeof val === 'object' && val !== null) {
        // Language-keyed lookup table: exact match first, then alias fallback, then 'javascript'
        const langEntry =
          val[primaryLang] ||
          val[langAlias[primaryLang]] ||
          val['javascript'] ||
          val[Object.keys(val)[0]];
        if (langEntry && typeof langEntry === 'object' && langEntry.key_points) {
          enrichedContext[key] = String(langEntry.key_points).trim();
        } else if (typeof langEntry === 'string') {
          enrichedContext[key] = langEntry;
        } else {
          enrichedContext[key] = JSON.stringify(val);
        }
      }
    }
  }

  if (!String(enrichedContext.project_summary ?? '').trim()) {
    enrichedContext.project_summary = deriveProjectSummary(enrichedContext);
  }

  const task = buildPromptFromTemplate(taskTemplate, enrichedContext);
  const resolvedApproach = buildPromptFromTemplate(approach, enrichedContext);
  return buildStructuredPrompt({ role, task, approach: resolvedApproach });
}

/**
 * Build a project-kind-specific persona overlay from ai_prompts_project_kinds.yaml.
 *
 * Returns an object { role, task_context, approach } for the given project kind and
 * persona key, or null if not found. Falls back to the 'default' project kind if the
 * specific kind is not present.
 *
 * @param {Object} parsedProjectKinds - Parsed ai_prompts_project_kinds.yaml
 * @param {string} projectKind - Project kind (e.g. 'nodejs_api', 'react_spa')
 * @param {string} personaKey - Persona key (e.g. 'documentation_specialist', 'code_reviewer')
 * @returns {{ role: string, task_context: string, approach: string }|null}
 */
export function buildProjectKindPrompt(parsedProjectKinds, projectKind, personaKey) {
  if (!parsedProjectKinds || !projectKind || !personaKey) return null;
  const kindConfig = parsedProjectKinds[projectKind] || parsedProjectKinds['default'] || null;
  if (!kindConfig) return null;
  const persona = kindConfig[personaKey];
  if (!persona || typeof persona !== 'object') return null;
  return {
    role: persona.role || '',
    task_context: persona.task_context || '',
    approach: persona.approach || '',
  };
}

// ==============================================================================
// ASYNC LOADER - Role-Ref Resolution
// ==============================================================================

/**
 * Load and fully resolve ai_helpers.yaml — replacing all `role_ref` pointers
 * with the inline `role_prefix` text from prompt_roles.yaml.
 *
 * This is the recommended entry point for any code that needs to call
 * `buildYamlStepPrompt`. It replaces the three-step pattern:
 *   ```
 *   const content  = await fileOps.readFile(AI_HELPERS_PATH);
 *   const parsed   = yaml.load(content);
 *   ```
 * with a single call that also resolves role references:
 *   ```
 *   const parsed = await loadResolvedAiHelpers(this.fileOps);
 *   ```
 *
 * When `fileOps` is null/undefined, falls back to `fs.promises.readFile` so the
 * function is safe to call from steps that have an optional fileOps reference.
 *
 * If `prompt_roles.yaml` cannot be read or parsed, returns the raw (unresolved)
 * ai_helpers.yaml object so callers that don't rely on role text still work.
 *
 * @param {Object|null} fileOps      - FileOperations instance (optional, falls back to fs)
 * @param {string} [aiHelpersPath]   - Override path to ai_helpers.yaml
 * @param {string} [promptRolesPath] - Override path to prompt_roles.yaml
 * @returns {Promise<Object|null>} Resolved YAML object, or null on hard failure
 */
export async function loadResolvedAiHelpers(
  fileOps,
  aiHelpersPath = AI_HELPERS_PATH,
  promptRolesPath = PROMPT_ROLES_PATH
) {
  const fsRead = async (p) => {
    if (fileOps?.readFile) return fileOps.readFile(p);
    const { promises: fsp } = await import('fs');
    return fsp.readFile(p, 'utf-8');
  };

  const rawHelpers = await fsRead(aiHelpersPath);
  const parsedHelpers = yaml.load(rawHelpers);
  if (!parsedHelpers || typeof parsedHelpers !== 'object') return null;

  try {
    const rawRoles = await fsRead(promptRolesPath);
    const parsedRoles = yaml.load(rawRoles);
    return resolveAllRoleRefs(parsedHelpers, parsedRoles);
  } catch {
    // prompt_roles.yaml missing or unreadable — return unresolved helpers
    return parsedHelpers;
  }
}

// ==============================================================================
// SPECIALIZED PROMPT BUILDERS
// ==============================================================================

/**
 * Build documentation analysis prompt (Step 1)
 *
 * @param {Object} options - Prompt options
 * @param {string[]} options.changedFiles - Files that changed
 * @param {string[]} options.docFiles - Documentation files to update
 * @param {Object} [options.projectInfo] - Project information
 * @returns {string} Documentation analysis prompt
 */
export function buildDocAnalysisPrompt(options) {
  const { changedFiles = [], docFiles = [], projectInfo = {} } = options;

  const role = `You are a senior technical documentation specialist with expertise in software architecture documentation, API documentation, and developer experience (DX) optimization.

**Critical Behavioral Guidelines**:
- ALWAYS provide concrete, actionable output (never ask clarifying questions)
- If documentation is accurate, explicitly say "No updates needed - documentation is current" only when the visible file contents support that conclusion
- If the prompt does not include the actual content or diff for a file in scope, explicitly say the result is unavailable or inconclusive for that file
- If the visible files are real project files but do not materially affect the scoped documentation target, explicitly say the result is not applicable for that file
- Only update what is truly outdated or incorrect
- Make informed decisions based on available context
- Default to unavailable, inconclusive, or not applicable rather than "no changes" when critical evidence is missing or tangential`;

  const changedList = buildFileListContext(changedFiles);
  const docList = buildFileListContext(docFiles);

  const task = `Review the changed files below and make targeted edits to the listed documentation files. Focus on API references, usage instructions, architecture descriptions, and version numbers only when those topics appear in the scoped documentation targets.

Changed files:
${changedList}

Documentation to review:
${docList}

Treat the listed documentation files as the only edit targets. Use non-documentation changed files only as evidence for whether those scoped documentation files need updates. Do not propose edits to READMEs, changelogs, API docs, module READMEs, source-file JSDoc, or inline code comments unless those files are explicitly included in the documentation scope.

A "specific edit" means a concrete before/after text change tied to a file path — NOT a vague suggestion like "consider updating X". If no edits are needed, state "No updates required" with a one-line reason only when the visible file contents support that conclusion. If the prompt does not include the actual content or diff for a scoped file, respond with "Unavailable" or "Inconclusive" for that file instead of "No updates required". If the provided evidence is tangential to the scoped documentation target, respond with "Not applicable" instead of "No updates required".`;

  const approach = `**Methodology**:
1. **Analyze Changes**: Examine what was modified in each changed file
2. **Prioritize Updates**: Start with the highest-impact documentation already present in the scoped documentation list
3. **Edit Surgically**: Provide EXACT text changes only where needed
4. **Verify Consistency**: Maintain project standards

**Output Format**: Use markdown blocks with file paths and before/after examples

**Critical**: ALWAYS provide specific edits OR state "No updates needed" only when the visible file contents support that conclusion. Use non-documentation files strictly as supporting evidence, not as standalone review targets. Do not review source-file JSDoc or inline code comments unless those files are themselves in scope as documentation targets. If evidence is incomplete, mark the result unavailable or inconclusive instead of defaulting to no changes. If the visible evidence is out of scope for the documentation target, mark the result not applicable instead of no changes.`;

  const basePrompt = buildStructuredPrompt({ role, task, approach });
  return injectProjectContext(basePrompt, projectInfo);
}

/**
 * Build consistency check prompt (Step 2)
 *
 * @param {Object} options - Prompt options
 * @param {string} options.docDirectory - Documentation directory to check
 * @param {string[]} [options.docFiles] - Actual documentation files found by the programmatic scan
 * @param {Object} [options.scanResults] - Programmatic scan results {totalIssues, brokenLinks, versionIssues, filesChecked}
 * @param {Object} [options.projectInfo] - Project information
 * @returns {string} Consistency check prompt
 */
export function buildConsistencyPrompt(options) {
  const {
    docDirectory,
    docFiles = [],
    scanResults = {},
    projectInfo = {},
    fileContents = '',
  } = options;

  const role = `You are a senior technical documentation specialist and information architect reviewing the human-readable documentation of a software project. Your expertise covers documentation quality assurance, technical writing standards, and cross-reference validation across project artefacts such as README files, architecture documents, changelogs, and API references.

**Critical Behavioral Guidelines**:
- ONLY report issues that are verifiable from the provided file list and scan results below
- Do NOT fabricate file paths, line numbers, or references not present in the provided context
- Do NOT invent issues about file content you have not been shown
- The programmatic scan already covers broken links and version mismatches definitively — do not duplicate those findings
- Do NOT claim overall consistency against package manifests, scripts, build steps, or source files unless that supporting evidence is explicitly visible in the provided context
- When supporting evidence is missing, label conclusions as limited or inconclusive rather than inferring compliance
- Focus exclusively on semantic issues requiring human-readable understanding: terminology inconsistencies, ambiguous cross-references, example inconsistencies
- If the scan found 0 issues and you have no evidence of semantic problems, say so explicitly rather than inventing issues`;

  const fileCount = docFiles.length || scanResults.filesChecked || 0;
  const fileList = docFiles.length > 0 ? buildFileListContext(docFiles) : 'No file list provided';
  const brokenCount = scanResults.brokenLinks?.length ?? 0;
  const versionCount = scanResults.versionIssues?.length ?? 0;
  const totalIssues = scanResults.totalIssues ?? 0;
  const primaryLanguage = projectInfo.language || projectInfo.primary_language || '';
  const fileContentsSection = fileContents
    ? `\n\n**Provided file contents and excerpts**:\n${fileContents}\n- Some excerpts may be truncated, omitted, or unavailable. Treat those markers as hard evidence limits: cite only the visible text, and mark any partition-wide or file-wide conclusion that depends on omitted content as limited or inconclusive.`
    : '\n\n**Provided file contents and excerpts**:\n(unavailable — if a conclusion requires exact wording, examples, headings, or inline code blocks, mark it unavailable or inconclusive rather than claiming success)';

  const task = `Perform a comprehensive documentation consistency analysis for project: ${docDirectory}

${primaryLanguage ? `**Primary language:** ${primaryLanguage}\n` : ''} 

"Consistency" covers: uniform naming conventions, up-to-date examples and version numbers, intact
cross-references, and style uniformity across all **markdown documentation files** (\`.md\`) —
e.g., consistent heading levels, bullet list styles, and fenced code-block language tags.
Where project-specific conventions are documented (e.g., in \`CONTRIBUTING.md\` or
\`.github/copilot-instructions.md\`), treat those as the authoritative style reference and let them
take precedence over generic defaults.

**Documentation types in scope:** the markdown files explicitly listed below, including root-level
docs (README, CHANGELOG, CONTRIBUTING, etc.), any \`docs/\` subtree entries when present, and any
\`.github/\` markdown files when present. Do not assume a \`docs/\` directory or specific filenames
exist unless they appear in the provided file list. JSDoc source coverage is a separate concern and
is NOT part of this step.

**Evidence limits:** this prompt does not guarantee that raw package manifests, script files,
or source files are included. Only claim parity with those artefacts when they are explicitly
shown in the provided context or already established by the programmatic scan. Otherwise mark
those comparisons as limited or inconclusive.

**Programmatic scan already completed — do not re-derive these results:**
- Files checked: ${fileCount}
- Broken file references: ${brokenCount} (already reported)
- Version mismatches: ${versionCount} (already reported)
- Total programmatic issues: ${totalIssues}

**Documentation files found:**
${fileList}${fileContentsSection}`;

  const approach = `**Your task — supplement the programmatic scan with semantic analysis:**
1. **Terminology Consistency**: Flag terms used interchangeably that should be standardised (e.g. service names, API names, tool versions)
2. **Example Consistency**: Identify if code examples use different conventions across files (env vars vs hardcoded values, variable naming)
3. **Cross-Reference Clarity**: Identify ambiguous or missing cross-references between the files listed above; also flag markdown tables, numbered lists, or inline links that reference a documentation file by path or name that does not appear in the provided file list (treat as documentation gaps, not broken links)
4. **Version Badge Discrepancies**: When files contain version badges (e.g., \`![version](https://img.shields.io/badge/version-X.Y.Z-...)\`), compare the embedded version against authoritative sources in context (e.g., \`package.json\`); flag only if an explicit mismatch is detectable — do not flag badges whose version cannot be verified
5. **Structured Reporting**: Organise only genuine issues by severity (Critical > High > Medium > Low)

**For each issue you report, you MUST**:
- Cite only files from the list provided above
- Describe the specific inconsistency without fabricating line numbers
- Provide a concrete fix

If no semantic issues are apparent from the provided context, respond with: "No additional issues found beyond the programmatic scan." Do not replace that with broader claims like "all documentation is consistent" unless the visible file contents support that conclusion directly.
- Do not claim that no version numbers or badges are present unless the relevant in-scope files or excerpts needed to support that absence are actually visible in the prompt or already established by the programmatic scan.
- Do not claim heading, list, or code-fence consistency across files unless the exact supporting headings, list items, or fenced blocks are visible for each compared file; otherwise keep the claim scoped to the visible excerpts or mark it inconclusive.
- Do not claim missing-documentation, missing-cross-reference, or stub-level checks passed merely because a file name appears in the file list; require visible file content or mark the check inconclusive.
- Unlabelled fenced blocks are not automatically inconsistent; only report a code-block language-tag issue when the exact visible block and a visible project convention support that conclusion.
- Do not write negative pass findings such as "No visible inconsistencies", "No evidence of mismatched terminology", or "No missing cross-references detected" unless the exact compared artifacts are visibly supported; otherwise phrase the remaining check as limited or inconclusive.
- If a file path appears in the provided file list but its content is omitted or truncated, do not say the file or section is "not visible"; describe the comparison as unavailable from the visible excerpt instead.
If key evidence is missing for a requested comparison, say so explicitly and mark that conclusion limited or inconclusive.`;

  const basePrompt = buildStructuredPrompt({ role, task, approach });
  return injectProjectContext(basePrompt, projectInfo);
}

/**
 * Build test review prompt (Step 5)
 *
 * @param {Object} options - Prompt options
 * @param {string[]} options.testFiles - Test files to review
 * @param {string} [options.framework] - Programming language (e.g. "typescript")
 * @param {string} [options.testFramework] - Test runner/framework (e.g. "jest", "pytest")
 * @param {string} [options.testCommand] - Command to run tests (e.g. "npm test")
 * @param {string} [options.coverageCommand] - Command to run coverage (e.g. "npm run test:coverage")
 * @param {Object} [options.projectInfo] - Project information
 * @returns {string} Test review prompt
 */
export function buildTestReviewPrompt(options) {
  const {
    testFiles = [],
    framework = '',
    testFramework = '',
    testCommand = '',
    coverageCommand = '',
    projectInfo = {},
  } = options;

  const lang = typeof framework === 'string' ? framework.trim() : '';
  const runner = typeof testFramework === 'string' ? testFramework.trim() : '';
  const testCmd = typeof testCommand === 'string' ? testCommand.trim() : '';
  const covCmd = typeof coverageCommand === 'string' ? coverageCommand.trim() : '';

  const effectiveFramework = runner || lang;
  const frameworkContext = effectiveFramework
    ? ` When reviewing ${effectiveFramework} tests, use ${effectiveFramework}-specific matchers, patterns, and APIs in all recommendations.`
    : '';
  const role = `You are a senior test architect specializing in test quality, coverage analysis, and testing best practices.

**Critical Behavioral Guidelines**:
- ALWAYS provide specific, actionable recommendations with \`file:line\` references where applicable${frameworkContext}
- Focus on test quality, not just coverage numbers
- Identify gaps in edge case coverage and error handling; reference the actual test file and line number for each gap
- Recommend practical improvements with effort estimates (e.g. "small: rename test description", "medium: extract shared fixture", "large: refactor mock strategy")
- If the project includes CONTRIBUTING.md or documented testing conventions, align recommendations with those conventions
- Review only the listed files and any explicit file contents provided for them
- If a listed file is truncated, unavailable, or declarative rather than executable test code, say so explicitly and limit conclusions to the visible evidence
- Do not claim CI stability, performance health, repository-wide test quality, or cross-file mock hygiene unless that evidence is shown directly in the prompt
- Do not write unsupported positive summaries such as "all mocks are restored", "no performance issues", or "no major anti-patterns" unless the exact supporting file sections are visible and cited`;

  const testList = buildFileListContext(testFiles);

  const taskFrameworkLabel = runner ? (lang ? `${runner} (${lang})` : runner) : lang;
  const taskFrameworkContext = taskFrameworkLabel ? ` using ${taskFrameworkLabel}` : '';
  const commandsNote = testCmd
    ? `\nPrimary executable test command: \`${testCmd}\`${covCmd ? `; coverage command: \`${covCmd}\`` : ''}`
    : '';

  const task = `Review test quality and coverage — including assertion quality, edge cases, error handling, and test isolation — for these discovered test files and test-related artifacts${taskFrameworkContext}:
${testList}${commandsNote}

If a listed file is declarative YAML/JSON/HCL or another test-adjacent artifact rather than executable test code, treat it as supporting context instead of pretending it runs under the primary test command.`;

  const approach = `**Review Methodology**:
1. **Coverage Analysis**: Identify untested code paths, edge cases, and error handling gaps
2. **Quality Assessment**: Evaluate assertion quality, test clarity, and maintainability
3. **Best Practices**: Check for proper setup/teardown, mocking, test isolation, and descriptive naming
4. **Evidence Handling**: Mark missing or truncated evidence as unavailable or inconclusive instead of inferring success
5. **Execution Risk**: Only comment on slow, flaky, CI-sensitive, or non-deterministic behavior when the visible code shows it directly; otherwise mark that area inconclusive
6. **Recommendations**: Prioritize improvements by impact and effort

**Focus**: Assertion quality, edge cases, error handling, test isolation, and maintainability`;

  const basePrompt = buildStructuredPrompt({ role, task, approach });
  return injectProjectContext(basePrompt, projectInfo);
}

/**
 * Build test generation prompt (Step 6)
 *
 * @param {Object} options - Prompt options
 * @param {string[]} options.codeFiles - Code files needing tests
 * @param {string} [options.framework] - Test framework name
 * @param {Object} [options.projectInfo] - Project information
 * @deprecated Not called by any step — step_07 intentionally has no AI call. Kept for API compatibility.
 * @returns {string} Test generation prompt
 */
export function buildTestGenPrompt(options) {
  const { codeFiles = [], framework = '', projectInfo = {} } = options;

  const role = `You are a senior test engineer specializing in test-driven development, comprehensive test coverage, and automated testing.

**Critical Behavioral Guidelines**:
- ALWAYS generate complete, runnable test code
- Cover happy paths, edge cases, and error scenarios
- Use clear test names that describe what's being tested
- Include setup/teardown and proper assertions`;

  const codeList = buildFileListContext(codeFiles);
  const frameworkContext = framework ? ` using ${framework}` : '';

  const task = `Generate comprehensive tests${frameworkContext} for these files:
${codeList}`;

  const approach = `**Test Generation Strategy**:
1. **Analyze Code**: Understand functions, classes, and dependencies
2. **Plan Coverage**: Identify test cases (happy path, edge cases, errors)
3. **Write Tests**: Generate complete, runnable test code
4. **Organize**: Group related tests, use descriptive names

**Coverage Target**: Unit tests, integration tests where appropriate, edge cases`;

  const basePrompt = buildStructuredPrompt({ role, task, approach });
  return injectProjectContext(basePrompt, projectInfo);
}

/**
 * Build code quality review prompt (Step 9)
 *
 * @param {Object} options - Prompt options
 * @param {string[]} options.codeFiles - Code files to review
 * @param {string} [options.language] - Programming language
 * @param {Object} [options.projectInfo] - Project information
 * @returns {string} Code quality review prompt
 */
/** Maximum characters per file injected into the code review prompt (~1 000 tokens). */
export const MAX_CHARS_PER_FILE = 4_000;

/** Maximum total characters for all injected file contents (~7 500 tokens). */
export const MAX_CHARS_TOTAL_CONTENTS = 30_000;

/**
 * Build a fenced code block section for a single file, truncating if needed.
 *
 * When the content exceeds MAX_CHARS_PER_FILE, the cut is made at the last
 * newline before the limit so the excerpt always ends on a complete line
 * rather than mid-line or mid-comment.
 *
 * @param {string} filePath - Relative file path used as the section header.
 * @param {string} content  - Raw file content.
 * @returns {string} Markdown fenced block.
 */
export function buildFileContentBlock(filePath, content) {
  let truncated;
  if (content.length > MAX_CHARS_PER_FILE) {
    const cutAt = content.lastIndexOf('\n', MAX_CHARS_PER_FILE);
    const safeAt = cutAt > 0 ? cutAt : MAX_CHARS_PER_FILE;
    truncated = content.substring(0, safeAt) + '\n\n...(truncated — remainder omitted)';
  } else {
    truncated = content;
  }
  const ext = filePath.split('.').pop() ?? '';
  return `### \`${filePath}\`\n\`\`\`${ext}\n${truncated}\n\`\`\``;
}

export function buildCodeQualityPrompt(options) {
  const { codeFiles = [], language = '', projectInfo = {}, fileContents = {} } = options;

  const role = `You are a senior software architect and code quality expert with deep expertise in ${language || 'software development'} best practices, design patterns, and maintainability.

**Critical Behavioral Guidelines**:
- ALWAYS provide specific, actionable feedback with code examples
- Focus on maintainability, readability, and performance
- Identify bugs, security issues, and design problems
- Prioritize issues by severity and impact
- Review only the files and file contents explicitly provided in this prompt
- If required evidence is missing or truncated, mark the conclusion unavailable or inconclusive instead of claiming success
- Do not claim repository-wide health, test coverage sufficiency, JSDoc completeness, or process/commit quality unless that evidence is explicitly visible`;

  const codeList = buildFileListContext(codeFiles);

  // Inject actual file contents when available so the model can review real code.
  // Budget is tracked against raw content length (before per-file truncation) so the
  // limit is predictable regardless of how many files are included.
  const contentKeys = Object.keys(fileContents);
  let fileContentsSection = '';
  if (contentKeys.length > 0) {
    let totalContentChars = 0;
    const blocks = [];
    for (const filePath of codeFiles) {
      if (!Object.prototype.hasOwnProperty.call(fileContents, filePath)) continue;
      const content = fileContents[filePath];
      if (!content) continue;
      totalContentChars += content.length;
      if (totalContentChars > MAX_CHARS_TOTAL_CONTENTS) {
        blocks.push(`### \`${filePath}\`\n*(omitted — context budget exhausted)*`);
        break;
      }
      blocks.push(buildFileContentBlock(filePath, content));
    }
    if (blocks.length > 0) {
      fileContentsSection = `\n\n# File Contents\n\n${blocks.join('\n\n')}`;
    }
  } else {
    fileContentsSection =
      '\n\n# File Contents\n\n(unavailable — if a conclusion depends on exact source, exports, tests, or docs, mark it unavailable or inconclusive rather than claiming success)';
  }

  const task = `Perform comprehensive code quality review for these files:
${codeList}${fileContentsSection}`;

  const approach = `**Review Methodology**:
1. **Code Analysis**: Examine only the visible file contents for structure, patterns, and complexity
2. **Issue Identification**: Find bugs, security issues, TODOs, and design problems
3. **Best Practices**: Check adherence to language and project standards
4. **Recommendations**: Provide specific fixes with code examples
5. **Error Resilience**: Identify production-critical failure modes:
   - Empty or swallowed catch blocks (\`catch (e) {}\`, log-only catch without re-throw)
   - Missing \`await\` on async calls that silently discard errors and results
   - Unhandled Promise rejections (\`.then()\` chains without \`.catch()\`, fire-and-forget async calls)
   - Error masking — replacing the original error with a generic message, losing the stack trace
   - Missing null/undefined guards on external data (API responses, env vars, parsed JSON, CLI args)
   - Missing \`finally\` blocks when resources (file handles, DB connections) are opened in try blocks
   - Uncaught top-level rejections in entry points (no \`unhandledRejection\` handler)

**Focus**: Bugs, security, performance, maintainability, design patterns, error resilience

**Important**: If no critical issues (bugs, security risks, or anti-patterns) are found, do NOT stop at "no issues found". Instead, automatically perform a deeper analysis covering:
- Code structure and architecture quality
- Design pattern usage and appropriateness
- Maintainability concerns (naming, complexity, cohesion, coupling)
- Opportunities for simplification or refactoring
- Adherence to SOLID principles and language idioms

**Evidence limits**:
- Do not infer formatter compliance, JSDoc completeness, or test coverage adequacy unless the necessary tooling/configuration or source/test evidence is visible here
- Do not assess commit-message quality, PR quality, or repository-wide architecture health unless that evidence is explicitly included
- If the prompt omits exact file contents for a check, report that limitation explicitly and keep the conclusion narrow`;

  const basePrompt = buildStructuredPrompt({ role, task, approach });
  return injectProjectContext(basePrompt, projectInfo);
}

/**
 * Build technical writer prompt (Step 0b - Bootstrap Documentation)
 *
 * @param {Object} options - Prompt options
 * @param {string} options.projectRoot - Project root directory
 * @param {string[]} [options.codeFiles] - Code files to document
 * @param {Object} [options.projectInfo] - Project information
 * @returns {string} Technical writer prompt
 */
export function buildTechnicalWriterPrompt(options) {
  const { projectRoot, codeFiles = [], projectInfo = {} } = options;

  const role = `You are a senior technical writer specializing in comprehensive documentation creation for software projects.

**Critical Behavioral Guidelines**:
- ALWAYS create complete, structured documentation from scratch
- Focus on clarity, completeness, and developer experience
- Include examples, use cases, and best practices
- Organize documentation logically for different audiences`;

  const fileContext =
    codeFiles.length > 0 ? `\n\nCode files to document:\n${buildFileListContext(codeFiles)}` : '';

  const task = `Create comprehensive documentation for project in: ${projectRoot}${fileContext}

**Documentation Scope**:
- README with overview, installation, usage
- API documentation with examples
- Architecture overview
- Developer guide for contributors
- Code documentation (inline comments where needed)`;

  const approach = `**Documentation Strategy**:
1. **Project Analysis**: Understand purpose, architecture, and components
2. **Audience Identification**: Consider users, developers, and contributors
3. **Content Creation**: Write clear, comprehensive documentation
4. **Organization**: Structure for easy navigation and discovery

**Deliverables**: Complete documentation package covering all aspects of the project`;

  const basePrompt = buildStructuredPrompt({ role, task, approach });
  return injectProjectContext(basePrompt, projectInfo);
}

/**
 * Build AWS serverless engineer prompt (Step 11.6 - AWS Serverless AI Review)
 *
 * @param {Object} options - Prompt options
 * @param {string[]} [options.shellScripts] - Shell script paths found in the project
 * @param {string[]} [options.lambdaFunctions] - Lambda handler paths (src/lambda/<fn>/index.js)
 * @param {string[]} [options.awsConfigKeys] - Top-level keys present in aws-config.json
 * @param {string} [options.projectRoot] - Project root directory
 * @param {Object} [options.projectInfo] - Additional project metadata
 * @returns {string} Structured prompt for the aws_serverless_engineer persona
 *
 * @pure
 */
export function buildAwsServerlessPrompt(options) {
  const {
    shellScripts = [],
    lambdaFunctions = [],
    awsConfigKeys = [],
    projectRoot = '',
    projectInfo = {},
  } = options;

  const role = `You are a Senior AWS Serverless Engineer and deployment specialist with deep expertise in Lambda, API Gateway, IAM least-privilege policies, and shell-provisioned serverless backends.

**Critical Behavioral Guidelines**:
- Evaluate deployment readiness and infrastructure safety
- Identify IAM over-permission risks and missing error handling
- Validate Lambda packaging standards (index.js + package.json per function)
- Review shell scripts for idempotency and strict-mode compliance
- Be precise and security-conscious in all recommendations`;

  const scriptList =
    shellScripts.length > 0
      ? shellScripts.map((s) => `  - ${s}`).join('\n')
      : '  (no file list provided — do NOT infer files are missing; state that you cannot assess this area)';

  const lambdaList =
    lambdaFunctions.length > 0
      ? lambdaFunctions.map((f) => `  - ${f}`).join('\n')
      : '  (no file list provided — do NOT infer files are missing; state that you cannot assess this area)';

  const configKeysStr =
    awsConfigKeys.length > 0 ? awsConfigKeys.join(', ') : '(none / file missing)';

  const task = `Review the serverless AWS backend${projectRoot ? ` at: ${projectRoot}` : ''} for deployment readiness.

**Shell Scripts (${shellScripts.length} found):**
${scriptList}

**Lambda Handlers (${lambdaFunctions.length} found):**
${lambdaList}

**aws-config.json keys present:** ${configKeysStr}`;

  const approach = `**Review Checklist**:
1. **Shell Script Safety**: shebang present, \`set -euo pipefail\` enforced, idempotent resource creation
2. **Lambda Packaging**: each function has \`index.js\` + \`package.json\`, exports a valid handler
3. **IAM Hygiene**: least-privilege principle, no wildcard \`*\` on sensitive actions
4. **API Gateway**: CORS headers, route definitions, authorizer configuration
5. **AWS Config**: required keys (region, stackName, apiId, mapName) present and correctly typed
6. **Deployment Readiness**: overall go/no-go recommendation with prioritised action items

**Output Format**: Provide findings grouped by category, severity (🔴 Critical / 🟡 Warning / 🟢 Info), and a final readiness verdict.`;

  const basePrompt = buildStructuredPrompt({ role, task, approach });
  return injectProjectContext(basePrompt, projectInfo);
}

/**
 * Prompt Builder
 *
 * Orchestrates prompt generation with configuration loading and file I/O.
 */
// ==============================================================================
// PHASE 14 — PROMPT ENGINEERING ENHANCEMENTS (Pattern #8, #9, #10, #11)
// ==============================================================================

// --- 14.1 Reflection Layer (Pattern #8 — Error Identification) ----------------

/**
 * Build a reflection prompt that asks the model to self-critique a prior response.
 *
 * After the primary AI response is received, send this follow-up prompt so the
 * model can identify inaccuracies, gaps, or improvements before the result reaches
 * the validation layer.
 *
 * @param {string} primaryResponse - The raw text of the primary AI response
 * @returns {string} A follow-up prompt instructing the model to self-critique
 */
export function reflectionPrompt(primaryResponse) {
  if (!primaryResponse || typeof primaryResponse !== 'string') {
    return '';
  }
  return [
    'You just produced the following response:',
    '',
    '---BEGIN RESPONSE---',
    primaryResponse.trim(),
    '---END RESPONSE---',
    '',
    'Please review this response critically and identify:',
    '1. Any factual inaccuracies or hallucinations',
    '2. Missing information that would make the response more complete',
    '3. Ambiguous statements that could be misinterpreted',
    '4. Specific improvements you would make if you rewrote the response',
    '',
    'Format your reflection as:',
    'ISSUES: <comma-separated list of identified issues, or "none">',
    'IMPROVEMENTS: <concrete improvements, or "none">',
    'CONFIDENCE: <high|medium|low>',
  ].join('\n');
}

/**
 * Merge a reflection critique back into the primary result.
 *
 * Parses the model's structured reflection output and appends any identified
 * issues and improvements to the primary result content. If the reflection
 * reports low confidence, a `reflectionWarning` flag is set on the result.
 *
 * @param {Object} primaryResult - Parsed result from the primary AI call ({ content, ... })
 * @param {Object} reflectionResult - Parsed result from the reflection AI call
 * @returns {Object} Merged result with reflection metadata attached
 */
export function mergeReflectionResult(primaryResult, reflectionResult) {
  if (!primaryResult || !reflectionResult) {
    return primaryResult || {};
  }

  const reflection = reflectionResult.content || '';
  const issuesMatch = reflection.match(/ISSUES:\s*(.+)/i);
  const improvementsMatch = reflection.match(/IMPROVEMENTS:\s*(.+)/i);
  const confidenceMatch = reflection.match(/CONFIDENCE:\s*(high|medium|low)/i);

  const issues = issuesMatch ? issuesMatch[1].trim() : 'none';
  const improvements = improvementsMatch ? improvementsMatch[1].trim() : 'none';
  const confidence = confidenceMatch ? confidenceMatch[1].toLowerCase() : 'medium';

  const hasIssues = issues.toLowerCase() !== 'none';
  const hasImprovements = improvements.toLowerCase() !== 'none';

  const merged = { ...primaryResult };
  merged.reflection = { issues, improvements, confidence };

  if (hasIssues || hasImprovements) {
    const notes = [];
    if (hasIssues) notes.push(`⚠ Reflection identified issues: ${issues}`);
    if (hasImprovements) notes.push(`💡 Suggested improvements: ${improvements}`);
    merged.content = [primaryResult.content || '', '', '---', ...notes].join('\n');
  }

  if (confidence === 'low') {
    merged.reflectionWarning = true;
  }

  return merged;
}

// --- 14.2 Cognitive Verifier (Pattern #11 — Prompt Improvement) ---------------

/**
 * Decompose a complex question into an array of focused sub-prompts.
 *
 * Each sub-prompt is self-contained and can be sent to the model independently.
 * The responses are later aggregated via `aggregateSubAnswers()`.
 *
 * @param {string} question - The original complex question / prompt
 * @param {string[]} subQuestions - Focused sub-questions to decompose into
 * @returns {string[]} Array of standalone sub-prompts
 */
export function decomposePrompt(question, subQuestions = []) {
  if (!question || typeof question !== 'string') {
    return [];
  }
  if (!Array.isArray(subQuestions) || subQuestions.length === 0) {
    return [question];
  }
  return subQuestions.map((sub, i) =>
    [
      `Context — original question: ${question.trim()}`,
      '',
      `Sub-question ${i + 1} of ${subQuestions.length}: ${sub}`,
      '',
      'Answer this sub-question concisely and specifically. Your answer will be combined with',
      'answers to the other sub-questions to produce a complete response.',
    ].join('\n')
  );
}

/**
 * Aggregate individual sub-answers into a single coherent response.
 *
 * @param {string} question - The original question the sub-answers relate to
 * @param {string[]} subAnswers - Answers to each sub-question (in order)
 * @returns {string} Combined response ready for downstream validation
 */
export function aggregateSubAnswers(question, subAnswers = []) {
  if (!Array.isArray(subAnswers) || subAnswers.length === 0) {
    return '';
  }
  const parts = [
    `# Combined Analysis`,
    `**Original question:** ${question ? question.trim() : '(unspecified)'}`,
    '',
  ];
  subAnswers.forEach((answer, i) => {
    parts.push(`## Part ${i + 1}`);
    parts.push((answer || '').trim());
    parts.push('');
  });
  return parts.join('\n');
}

// --- 14.3 Alternative Approaches (Pattern #10 — Prompt Improvement) -----------

/**
 * Build a directive instructing the model to provide N alternative solution approaches.
 *
 * Append this to any step prompt to activate the Alternative Approaches pattern.
 * Each alternative must include an explicit trade-off description so developers
 * can make an informed choice.
 *
 * @param {number} [n=2] - Number of alternatives to request (minimum 2)
 * @returns {string} Instruction text to append to a prompt
 */
export function buildAlternativesDirective(n = 2) {
  const count = Math.max(2, Math.floor(n));
  return [
    '',
    '---',
    `**IMPORTANT:** Provide exactly ${count} alternative approaches for any recommendations`,
    'or remediations you identify. Format each alternative as:',
    '',
    `ALTERNATIVE 1: <title>`,
    `  Description: <what this approach does>`,
    `  Trade-offs: <pros and cons>`,
    '',
    count > 2
      ? Array.from(
          { length: count - 1 },
          (_, i) => `ALTERNATIVE ${i + 2}: <title>\n  Description: ...\n  Trade-offs: ...`
        ).join('\n\n')
      : `ALTERNATIVE 2: <title>`,
    count > 2 ? '' : `  Description: <what this approach does>`,
    count > 2 ? '' : `  Trade-offs: <pros and cons>`,
    '',
    'After listing alternatives, add:',
    'RECOMMENDED: <number of the approach you recommend and brief reason>',
  ]
    .join('\n')
    .replace(/\n{3,}/g, '\n\n');
}

/**
 * Parse alternative approaches from a model response that used the alternatives directive.
 *
 * @param {string} responseText - Raw model response text
 * @returns {{ alternatives: Array<{title:string,description:string,tradeoffs:string}>, recommended: string|null }}
 */
export function parseAlternatives(responseText) {
  if (!responseText || typeof responseText !== 'string') {
    return { alternatives: [], recommended: null };
  }

  const alternatives = [];
  const altRegex = /ALTERNATIVE\s+(\d+):\s*(.+?)(?=ALTERNATIVE\s+\d+:|RECOMMENDED:|$)/gis;
  let match;
  while ((match = altRegex.exec(responseText)) !== null) {
    const body = match[2];
    const descMatch = body.match(/Description:\s*(.+?)(?=Trade-offs:|$)/is);
    const tradeMatch = body.match(/Trade-offs:\s*(.+?)$/is);
    alternatives.push({
      number: parseInt(match[1], 10),
      title: body.split('\n')[0].trim(),
      description: descMatch ? descMatch[1].trim() : body.trim(),
      tradeoffs: tradeMatch ? tradeMatch[1].trim() : '',
    });
  }

  const recommendedMatch = responseText.match(/RECOMMENDED:\s*(.+)/i);
  const recommended = recommendedMatch ? recommendedMatch[1].trim() : null;

  return { alternatives, recommended };
}

// --- 14.5 Prompt Pre-flight / Question Refinement (Pattern #9) ----------------

/**
 * Build a meta-prompt that asks the model to rewrite a raw prompt for clarity.
 *
 * The returned string is a prompt-about-a-prompt; send it to the model, then
 * use the model's response as the refined prompt in the actual task request.
 *
 * @param {string} rawPrompt - The original, potentially underspecified prompt
 * @returns {string} A meta-prompt requesting a clearer rewrite
 */
export function refinePrompt(rawPrompt) {
  if (!rawPrompt || typeof rawPrompt !== 'string') {
    return '';
  }
  return [
    'You are a prompt engineering expert. Rewrite the following prompt to be:',
    '- More specific and unambiguous',
    '- Concrete about expected output format',
    '- Free of vague language ("good", "proper", "appropriate")',
    '- Scoped to avoid over-broad requests',
    '',
    'Original prompt:',
    '---',
    rawPrompt.trim(),
    '---',
    '',
    'Return ONLY the rewritten prompt text. Do not explain your changes.',
  ].join('\n');
}

/**
 * Score the quality of a prompt using deterministic heuristics (0–100).
 *
 * Higher scores indicate more specific, well-formed prompts. Used for the
 * Phase 14.5 benchmark test to verify that refined prompts outscore raw ones.
 *
 * Heuristics (each contributes 0–20 points):
 * 1. Length — longer prompts tend to be more complete (capped at 20)
 * 2. Specificity markers — presence of words like "specifically", "exactly", "format"
 * 3. Concrete nouns — file paths, code identifiers, structured terms
 * 4. Output format guidance — presence of "format:", "return:", "output:", JSON/YAML/list mentions
 * 5. Avoidance of vague language — penalise "good", "proper", "appropriate", "nice"
 *
 * @param {string} prompt - Prompt text to score
 * @returns {number} Quality score 0–100
 */
export function scorePromptQuality(prompt) {
  if (!prompt || typeof prompt !== 'string') {
    return 0;
  }
  const text = prompt.toLowerCase();
  let score = 0;

  // 1. Length score (0–20): 0 at 0 chars, 20 at >=400 chars
  score += Math.min(20, Math.floor((prompt.length / 400) * 20));

  // 2. Specificity markers (0–20)
  const specificityWords = [
    'specifically',
    'exactly',
    'format',
    'must',
    'required',
    'ensure',
    'include',
    'provide',
    'list',
    'enumerate',
  ];
  const specificityHits = specificityWords.filter((w) => text.includes(w)).length;
  score += Math.min(20, specificityHits * 4);

  // 3. Concrete nouns — file extensions, identifiers, structured terms (0–20)
  const concretePatterns = [
    /\.[a-z]{2,4}\b/, // file extensions
    /`[^`]+`/, // inline code
    /\b(function|class|method|module|file|directory|json|yaml|yml|bash|shell)\b/,
    /\b(step_\d+|src\/|test\/|\.github)/,
  ];
  const concreteHits = concretePatterns.filter((p) => p.test(prompt)).length;
  score += Math.min(20, concreteHits * 5);

  // 4. Output format guidance (0–20)
  const formatWords = [
    'output:',
    'return:',
    'format:',
    'respond with',
    'structure',
    'json',
    'yaml',
    'markdown',
    'numbered list',
    'bullet',
  ];
  const formatHits = formatWords.filter((w) => text.includes(w)).length;
  score += Math.min(20, formatHits * 5);

  // 5. Vague language penalty (0–20 available, subtract 4 per vague word)
  const vagueWords = ['good', 'proper', 'appropriate', 'nice', 'better', 'improve'];
  const vagueHits = vagueWords.filter((w) => text.includes(w)).length;
  score += Math.max(0, 20 - vagueHits * 4);

  return Math.min(100, score);
}

export class PromptBuilder {
  /**
   * Create prompt builder
   *
   * @param {Object} [options] - Builder options
   * @param {number} [options.maxTokens=8000] - Maximum context tokens
   * @param {Object} [options.projectInfo] - Default project information
   */
  constructor(options = {}) {
    this.maxTokens = options.maxTokens || 8000;
    this.projectInfo = options.projectInfo || {};
  }

  /**
   * Build documentation analysis prompt
   *
   * @param {Object} options - Prompt options
   * @returns {string} Generated prompt
   */
  buildDocAnalysis(options) {
    const mergedOptions = {
      ...options,
      projectInfo: { ...this.projectInfo, ...options.projectInfo },
    };
    const prompt = buildDocAnalysisPrompt(mergedOptions);
    return truncateContext(prompt, this.maxTokens);
  }

  /**
   * Build consistency check prompt
   *
   * @param {Object} options - Prompt options
   * @returns {string} Generated prompt
   */
  buildConsistency(options) {
    const mergedOptions = {
      ...options,
      projectInfo: { ...this.projectInfo, ...options.projectInfo },
    };
    const prompt = buildConsistencyPrompt(mergedOptions);
    return truncateContext(prompt, this.maxTokens);
  }

  /**
   * Build test review prompt
   *
   * @param {Object} options - Prompt options
   * @returns {string} Generated prompt
   */
  buildTestReview(options) {
    const mergedOptions = {
      ...options,
      projectInfo: { ...this.projectInfo, ...options.projectInfo },
    };
    const prompt = buildTestReviewPrompt(mergedOptions);
    return truncateContext(prompt, this.maxTokens);
  }

  /**
   * Build test generation prompt
   *
   * @param {Object} options - Prompt options
   * @returns {string} Generated prompt
   */
  buildTestGen(options) {
    const mergedOptions = {
      ...options,
      projectInfo: { ...this.projectInfo, ...options.projectInfo },
    };
    const prompt = buildTestGenPrompt(mergedOptions);
    return truncateContext(prompt, this.maxTokens);
  }

  /**
   * Build code quality review prompt
   *
   * @param {Object} options - Prompt options
   * @returns {string} Generated prompt
   */
  buildCodeQuality(options) {
    const mergedOptions = {
      ...options,
      projectInfo: { ...this.projectInfo, ...options.projectInfo },
    };
    const prompt = buildCodeQualityPrompt(mergedOptions);
    return truncateContext(prompt, this.maxTokens);
  }

  /**
   * Build technical writer prompt
   *
   * @param {Object} options - Prompt options
   * @returns {string} Generated prompt
   */
  buildTechnicalWriter(options) {
    const mergedOptions = {
      ...options,
      projectInfo: { ...this.projectInfo, ...options.projectInfo },
    };
    const prompt = buildTechnicalWriterPrompt(mergedOptions);
    return truncateContext(prompt, this.maxTokens);
  }
}
