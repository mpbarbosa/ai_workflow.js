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

  let result = template;

  // Replace ${variable} patterns first, then {variable} patterns
  // Order matters: ${var} must be processed before {var}
  for (const [key, value] of Object.entries(context)) {
    const dollarPattern = new RegExp(`\\$\\{${key}\\}`, 'g');
    result = result.replace(dollarPattern, String(value || ''));
  }

  for (const [key, value] of Object.entries(context)) {
    const bracePattern = new RegExp(`\\{${key}\\}`, 'g');
    result = result.replace(bracePattern, String(value || ''));
  }

  // Remove any remaining placeholders that weren't replaced
  result = result.replace(/\$\{[^}]+\}/g, '');
  result = result.replace(/\{[^}]+\}/g, '');

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
 * @param {Object} [options.projectInfo] - Project information
 * @returns {string} Consistency check prompt
 */
export function buildConsistencyPrompt(options) {
  const { docDirectory, projectInfo = {} } = options;

  const role = `You are a senior technical documentation specialist and information architect with expertise in documentation quality assurance, technical writing standards, and cross-reference validation.

**Critical Behavioral Guidelines**:
- ALWAYS provide structured, prioritized analysis (never general observations)
- Identify specific files, line numbers, and exact issues
- Include concrete recommended fixes for each problem
- Prioritize issues by severity and impact on user experience
- Focus on accuracy and consistency over style preferences`;

  const task = `Perform comprehensive consistency analysis on documentation in: ${docDirectory}`;

  const approach = `**Analysis Methodology**:
1. **Prioritize by Category**: Focus on Critical and User documentation first
2. **Systematic Validation**: Check cross-references, terminology, versions, examples
3. **Structured Reporting**: Organize by severity (Critical > High > Medium > Low)
4. **Actionable Recommendations**: For each issue provide file:line, problem, fix, impact

Check for: broken references, version mismatches, terminology inconsistencies, format violations`;

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
export function buildCodeQualityPrompt(options) {
  const { codeFiles = [], language = '', projectInfo = {} } = options;

  const role = `You are a senior software architect and code quality expert with deep expertise in ${language || 'software development'} best practices, design patterns, and maintainability.

**Critical Behavioral Guidelines**:
- ALWAYS provide specific, actionable feedback with code examples
- Focus on maintainability, readability, and performance
- Identify bugs, security issues, and design problems
- Prioritize issues by severity and impact`;

  const codeList = buildFileListContext(codeFiles);

  const task = `Perform comprehensive code quality review for these files:
${codeList}`;

  const approach = `**Review Methodology**:
1. **Code Analysis**: Examine structure, patterns, and complexity
2. **Issue Identification**: Find bugs, security issues, design problems
3. **Best Practices**: Check adherence to language and project standards
4. **Recommendations**: Provide specific fixes with code examples

**Focus**: Bugs, security, performance, maintainability, design patterns`;

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

// ==============================================================================
// IMPURE WRAPPER - Prompt Builder with Configuration
// ==============================================================================

/**
 * Prompt Builder
 *
 * Orchestrates prompt generation with configuration loading and file I/O.
 */
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
