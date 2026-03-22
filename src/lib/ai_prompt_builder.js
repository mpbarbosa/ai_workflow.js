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

/**
 * Inject project context into prompt
 *
 * Adds project-specific information like tech stack, language, project kind.
 *
 * @param {string} prompt - Base prompt text
 * @param {Object} projectInfo - Project information
 * @param {string} [projectInfo.language] - Primary language
 * @param {string} [projectInfo.projectKind] - Project type
 * @param {string[]} [projectInfo.techStack] - Technologies used
 * @param {string} [projectInfo.framework] - Framework name
 * @returns {string} Prompt with project context injected
 *
 * @example
 * const enhanced = injectProjectContext(prompt, {
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
- If documentation is accurate, explicitly say "No updates needed - documentation is current"
- Only update what is truly outdated or incorrect
- Make informed decisions based on available context
- Default to "no changes" rather than making unnecessary modifications`;

  const changedList = buildFileListContext(changedFiles);
  const docList = buildFileListContext(docFiles);

  const task = `Based on the recent changes to these files:
${changedList}

Update documentation in these files:
${docList}`;

  const approach = `**Methodology**:
1. **Analyze Changes**: Examine what was modified in each changed file
2. **Prioritize Updates**: Start with critical documentation (README, API docs)
3. **Edit Surgically**: Provide EXACT text changes only where needed
4. **Verify Consistency**: Maintain project standards

**Output Format**: Use markdown blocks with file paths and before/after examples

**Critical**: ALWAYS provide specific edits OR state "No updates needed"`;

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
  const { docDirectory, docFiles = [], scanResults = {}, projectInfo = {} } = options;

  const role = `You are a senior technical documentation specialist and information architect with expertise in documentation quality assurance, technical writing standards, and cross-reference validation.

**Critical Behavioral Guidelines**:
- ONLY report issues that are verifiable from the provided file list and scan results below
- Do NOT fabricate file paths, line numbers, or references not present in the provided context
- Do NOT invent issues about file content you have not been shown
- The programmatic scan already covers broken links and version mismatches definitively — do not duplicate those findings
- Focus exclusively on semantic issues requiring human-readable understanding: terminology inconsistencies, ambiguous cross-references, example inconsistencies
- If the scan found 0 issues and you have no evidence of semantic problems, say so explicitly rather than inventing issues`;

  const fileCount = docFiles.length || scanResults.filesChecked || 0;
  const fileList = docFiles.length > 0 ? buildFileListContext(docFiles) : 'No file list provided';
  const brokenCount = scanResults.brokenLinks?.length ?? 0;
  const versionCount = scanResults.versionIssues?.length ?? 0;
  const totalIssues = scanResults.totalIssues ?? 0;

  const task = `Review documentation consistency for project: ${docDirectory}

**Programmatic scan already completed — do not re-derive these results:**
- Files checked: ${fileCount}
- Broken file references: ${brokenCount} (already reported)
- Version mismatches: ${versionCount} (already reported)
- Total programmatic issues: ${totalIssues}

**Documentation files found:**
${fileList}`;

  const approach = `**Your task — supplement the programmatic scan with semantic analysis:**
1. **Terminology Consistency**: Flag terms used interchangeably that should be standardised (e.g. service names, API names, tool versions)
2. **Example Consistency**: Identify if code examples use different conventions across files (env vars vs hardcoded values, variable naming)
3. **Cross-Reference Clarity**: Identify ambiguous or missing cross-references between the files listed above
4. **Structured Reporting**: Organise only genuine issues by severity (Critical > High > Medium > Low)

**For each issue you report, you MUST**:
- Cite only files from the list provided above
- Describe the specific inconsistency without fabricating line numbers
- Provide a concrete fix

If no semantic issues are apparent from the provided context, respond with: "No additional issues found beyond the programmatic scan."`;

  const basePrompt = buildStructuredPrompt({ role, task, approach });
  return injectProjectContext(basePrompt, projectInfo);
}

/**
 * Build test review prompt (Step 5)
 *
 * @param {Object} options - Prompt options
 * @param {string[]} options.testFiles - Test files to review
 * @param {string} [options.framework] - Test framework name
 * @param {Object} [options.projectInfo] - Project information
 * @returns {string} Test review prompt
 */
export function buildTestReviewPrompt(options) {
  const { testFiles = [], framework = '', projectInfo = {} } = options;

  const role = `You are a senior test architect specializing in test quality, coverage analysis, and testing best practices.

**Critical Behavioral Guidelines**:
- ALWAYS provide specific, actionable recommendations
- Focus on test quality, not just coverage numbers
- Identify gaps in edge case coverage and error handling
- Recommend practical improvements with effort estimates`;

  const testList = buildFileListContext(testFiles);
  const frameworkContext = framework ? ` using ${framework} framework` : '';

  const task = `Review test quality and coverage for these test files${frameworkContext}:
${testList}`;

  const approach = `**Review Methodology**:
1. **Coverage Analysis**: Identify untested code paths and edge cases
2. **Quality Assessment**: Evaluate test clarity, maintainability, and assertions
3. **Best Practices**: Check for proper setup/teardown, mocking, and isolation
4. **Recommendations**: Prioritize improvements by impact and effort

**Focus**: Test quality, edge cases, error handling, and maintainability`;

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
 * @param {string} filePath - Relative file path used as the section header.
 * @param {string} content  - Raw file content.
 * @returns {string} Markdown fenced block.
 */
export function buildFileContentBlock(filePath, content) {
  const truncated =
    content.length > MAX_CHARS_PER_FILE
      ? content.substring(0, MAX_CHARS_PER_FILE) + '\n...(truncated)'
      : content;
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
- Prioritize issues by severity and impact`;

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
  }

  const task = `Perform comprehensive code quality review for these files:
${codeList}${fileContentsSection}`;

  const approach = `**Review Methodology**:
1. **Code Analysis**: Examine structure, patterns, and complexity
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
- Adherence to SOLID principles and language idioms`;

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
