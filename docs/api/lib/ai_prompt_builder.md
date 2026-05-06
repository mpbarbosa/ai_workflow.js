# ai_prompt_builder

**Module:** `src/lib/ai_prompt_builder.js`
**Version:** 2.3.1
**Architecture:** Pure functions + Impure wrapper

Dynamic AI prompt generation with project-aware context injection and template substitution.

---

## Overview

The `ai_prompt_builder` module provides tools for building structured, context-aware AI prompts. It includes template processing, project context injection, and specialized prompt builders for different workflow steps.

### Key Features

- **Template Substitution**: Replace placeholders with dynamic values
- **Project Context**: Inject language, framework, and tech stack info
- **Code Formatting**: Format code blocks with syntax highlighting markers
- **File List Building**: Generate structured file listings
- **Context Truncation**: Smart truncation to fit token limits
- **Structured Prompts**: Build multi-section prompts with consistent formatting
- **Specialized Builders**: Pre-built prompts for docs, tests, code quality, etc.

### Supported Workflow Steps

- Documentation analysis and generation
- Consistency checking
- Test review and generation
- Code quality analysis
- Technical writing (bootstrap documentation)

---

## Installation

```javascript
import {
  buildPromptFromTemplate,
  injectProjectContext,
  formatCodeBlock,
  buildDocAnalysisPrompt,
  PromptBuilder,
} from './lib/ai_prompt_builder.js';
```

---

## Pure Functions

### buildPromptFromTemplate

Build prompt from template with variable substitution.

**Signature:**

```javascript
function buildPromptFromTemplate(template: string, context?: Object): string
```

**Parameters:**

- `template` (string): Template string with `{variable}` or `${variable}` placeholders
- `context` (Object, optional): Key-value pairs for substitution (default: {})

**Returns:**

- (string): Template with placeholders replaced

**Pure:** ✅ Yes

**Example:**

```javascript
const prompt = buildPromptFromTemplate('Analyze {file} for {language}', {
  file: 'app.js',
  language: 'JavaScript',
});
// => 'Analyze app.js for JavaScript'

const prompt2 = buildPromptFromTemplate('Review ${module} in ${framework} project', {
  module: 'auth',
  framework: 'Express',
});
// => 'Review auth in Express project'
```

---

### injectProjectContext

Inject project-specific information into prompt.

**Signature:**

```javascript
function injectProjectContext(prompt: string, projectInfo?: {
  language?: string,
  projectKind?: string,
  techStack?: string[],
  framework?: string
}): string
```

**Parameters:**

- `prompt` (string): Base prompt text
- `projectInfo` (Object, optional): Project information

**Returns:**

- (string): Prompt with project context section appended

**Pure:** ✅ Yes

**Example:**

```javascript
const enhanced = injectProjectContext('Analyze the code', {
  language: 'JavaScript',
  projectKind: 'nodejs_api',
  framework: 'Express',
  techStack: ['Jest', 'ESLint', 'Prettier'],
});
// => 'Analyze the code
//
// **Project Context**:
// - **Language**: JavaScript
// - **Project Type**: nodejs_api
// - **Framework**: Express
// - **Tech Stack**: Jest, ESLint, Prettier'
```

---

### formatCodeBlock

Format code with markdown syntax highlighting.

**Signature:**

```javascript
function formatCodeBlock(code: string, language?: string): string
```

**Parameters:**

- `code` (string): Code to format
- `language` (string, optional): Language identifier for syntax highlighting (default: '')

**Returns:**

- (string): Code wrapped in markdown code block

**Pure:** ✅ Yes

**Example:**

````javascript
formatCodeBlock('function test() { return true; }', 'javascript');
// => '```javascript
// function test() { return true; }
// ```'

formatCodeBlock('Plain text');
// => '```
// Plain text
// ```'
````

---

### buildFileListContext

Build file list context section.

**Signature:**

```javascript
function buildFileListContext(files: string[], options?: {
  maxFiles?: number,
  includeExtensions?: string[],
  excludePatterns?: string[]
}): string
```

**Parameters:**

- `files` (string[]): Array of file paths
- `options.maxFiles` (number, optional): Maximum files to include (default: 50)
- `options.includeExtensions` (string[], optional): Only include these extensions
- `options.excludePatterns` (string[], optional): Exclude patterns (regex strings)

**Returns:**

- (string): Formatted file list section

**Pure:** ✅ Yes

**Example:**

```javascript
const files = ['src/app.js', 'src/utils.js', 'test/app.test.js', 'README.md'];

buildFileListContext(files, { maxFiles: 3 });
// => '**Files** (3 of 4):
// - src/app.js
// - src/utils.js
// - test/app.test.js
// ...(1 more file)'

buildFileListContext(files, { includeExtensions: ['.js'] });
// => '**Files** (3):
// - src/app.js
// - src/utils.js
// - test/app.test.js'
```

---

### truncateContext

Truncate context to fit within token limit.

**Signature:**

```javascript
function truncateContext(
  context: string,
  maxTokens: number,
  truncationMessage?: string
): string
```

**Parameters:**

- `context` (string): Context to truncate
- `maxTokens` (number): Maximum tokens (approximated as chars/4)
- `truncationMessage` (string, optional): Message to append (default: '...(truncated)')

**Returns:**

- (string): Truncated context with message if truncated

**Pure:** ✅ Yes

**Example:**

```javascript
const longText = 'A'.repeat(1000);
const truncated = truncateContext(longText, 100);
// => 'AAA...AAA...(truncated)' (approx 100*4 = 400 chars)

const shortText = 'Short text';
truncateContext(shortText, 1000);
// => 'Short text' (no truncation needed)
```

---

### buildStructuredPrompt

Build multi-section structured prompt.

**Signature:**

```javascript
function buildStructuredPrompt(sections: Array<{
  title: string,
  content: string,
  required?: boolean
}>): string
```

**Parameters:**

- `sections` (Array): Array of section objects with title and content

**Returns:**

- (string): Formatted structured prompt with sections

**Pure:** ✅ Yes

**Example:**

```javascript
const prompt = buildStructuredPrompt([
  { title: 'Task', content: 'Review code for security issues' },
  { title: 'Context', content: 'Express.js REST API' },
  { title: 'Focus Areas', content: 'SQL injection, XSS, CSRF' },
]);
// => '# Task
//
// Review code for security issues
//
// # Context
//
// Express.js REST API
//
// # Focus Areas
//
// SQL injection, XSS, CSRF'
```

---

### buildDocAnalysisPrompt

Build documentation analysis prompt (Step 1).

**Signature:**

```javascript
function buildDocAnalysisPrompt(options: {
  files?: string[],
  changesSummary?: string,
  projectInfo?: Object,
  focus?: string[]
}): string
```

**Parameters:**

- `options.files` (string[], optional): Changed files to analyze
- `options.changesSummary` (string, optional): Summary of recent changes
- `options.projectInfo` (Object, optional): Project context
- `options.focus` (string[], optional): Specific focus areas

**Returns:**

- (string): Structured documentation analysis prompt

**Pure:** ✅ Yes

**Example:**

```javascript
const prompt = buildDocAnalysisPrompt({
  files: ['src/auth.js', 'README.md'],
  changesSummary: 'Added authentication module',
  projectInfo: { language: 'JavaScript', framework: 'Express' },
  focus: ['API docs', 'Usage examples'],
});
// => Multi-section prompt for documentation analysis
```

---

### buildConsistencyPrompt

Build consistency checking prompt (Step 2).

**Signature:**

```javascript
function buildConsistencyPrompt(options: {
  documentationType?: string,
  files?: string[],
  standards?: string[],
  projectInfo?: Object
}): string
```

**Parameters:**

- `options.documentationType` (string, optional): Type of docs to check (e.g., 'API', 'User Guide')
- `options.files` (string[], optional): Files to check
- `options.standards` (string[], optional): Style standards to enforce
- `options.projectInfo` (Object, optional): Project context

**Returns:**

- (string): Structured consistency checking prompt

**Pure:** ✅ Yes

**Example:**

```javascript
const prompt = buildConsistencyPrompt({
  documentationType: 'API',
  files: ['docs/api/*.md'],
  standards: ['JSDoc', 'Markdown lint'],
  projectInfo: { language: 'JavaScript' },
});
```

---

### buildTestReviewPrompt

Build test review prompt (Step 3).

**Signature:**

```javascript
function buildTestReviewPrompt(options: {
  testFiles?: string[],
  coverageReport?: string,
  codeFiles?: string[],
  projectInfo?: Object,
  focusAreas?: string[]
}): string
```

**Parameters:**

- `options.testFiles` (string[], optional): Test files to review
- `options.coverageReport` (string, optional): Coverage data
- `options.codeFiles` (string[], optional): Source files being tested
- `options.projectInfo` (Object, optional): Project context
- `options.focusAreas` (string[], optional): Specific areas to focus on

**Returns:**

- (string): Structured test review prompt

**Pure:** ✅ Yes

**Example:**

```javascript
const prompt = buildTestReviewPrompt({
  testFiles: ['test/auth.test.js'],
  coverageReport: 'Coverage: 85%',
  codeFiles: ['src/auth.js'],
  projectInfo: { language: 'JavaScript', framework: 'Jest' },
  focusAreas: ['Edge cases', 'Error handling'],
});
```

---

### buildTestGenPrompt

Build test generation prompt (Step 4).

**Signature:**

```javascript
function buildTestGenPrompt(options: {
  targetFile?: string,
  sourceCode?: string,
  existingTests?: string,
  projectInfo?: Object,
  testFramework?: string
}): string
```

**Parameters:**

- `options.targetFile` (string, optional): File to generate tests for
- `options.sourceCode` (string, optional): Source code content
- `options.existingTests` (string, optional): Existing test code
- `options.projectInfo` (Object, optional): Project context
- `options.testFramework` (string, optional): Test framework name

**Returns:**

- (string): Structured test generation prompt

**Pure:** ✅ Yes

**Example:**

```javascript
const prompt = buildTestGenPrompt({
  targetFile: 'src/utils.js',
  sourceCode: 'function add(a, b) { return a + b; }',
  testFramework: 'Jest',
  projectInfo: { language: 'JavaScript' },
});
```

---

### buildCodeQualityPrompt

Build code quality analysis prompt (Step 5).

**Signature:**

```javascript
function buildCodeQualityPrompt(options: {
  files?: string[],
  linterResults?: string,
  complexity?: Object,
  projectInfo?: Object,
  standards?: string[]
}): string
```

**Parameters:**

- `options.files` (string[], optional): Files to analyze
- `options.linterResults` (string, optional): Linter output
- `options.complexity` (Object, optional): Complexity metrics
- `options.projectInfo` (Object, optional): Project context
- `options.standards` (string[], optional): Code standards to check

**Returns:**

- (string): Structured code quality prompt

**Pure:** ✅ Yes

**Example:**

```javascript
const prompt = buildCodeQualityPrompt({
  files: ['src/app.js'],
  linterResults: '5 warnings, 2 errors',
  complexity: { cyclomatic: 15 },
  projectInfo: { language: 'JavaScript' },
  standards: ['Airbnb style guide', 'ESLint'],
});
```

---

### buildTechnicalWriterPrompt

Build technical writer prompt for bootstrap documentation (Step 0b).

**Signature:**

```javascript
function buildTechnicalWriterPrompt(options: {
  projectStructure?: string[],
  codeFiles?: string[],
  existingDocs?: string[],
  projectInfo?: Object,
  documentationTypes?: string[]
}): string
```

**Parameters:**

- `options.projectStructure` (string[], optional): Project directory structure
- `options.codeFiles` (string[], optional): Source code files
- `options.existingDocs` (string[], optional): Existing documentation files
- `options.projectInfo` (Object, optional): Project context
- `options.documentationTypes` (string[], optional): Types of docs to generate

**Returns:**

- (string): Structured technical writer prompt

**Pure:** ✅ Yes

**Example:**

```javascript
const prompt = buildTechnicalWriterPrompt({
  projectStructure: ['src/', 'test/', 'docs/'],
  codeFiles: ['src/app.js', 'src/utils.js'],
  existingDocs: [],
  projectInfo: { language: 'JavaScript', projectKind: 'nodejs_api' },
  documentationTypes: ['README', 'API docs', 'User guide'],
});
```

---

## Wrapper Class

### PromptBuilder

High-level prompt builder with configuration management.

**Constructor:**

```javascript
new PromptBuilder(config?: {
  maxTokens?: number,
  projectInfo?: Object,
  defaultPersona?: string
})
```

**Options:**

- `maxTokens` (number, optional): Maximum prompt tokens (default: 4000)
- `projectInfo` (Object, optional): Default project context
- `defaultPersona` (string, optional): Default AI persona

**Side Effects:** Loads configuration, may read project files

---

### Methods

#### build

Build prompt from template with auto-injection of project context.

**Signature:**

```javascript
build(template: string, context?: Object): string
```

**Example:**

```javascript
const builder = new PromptBuilder({
  maxTokens: 4000,
  projectInfo: { language: 'JavaScript', framework: 'Express' },
});

const prompt = builder.build('Analyze {file}', { file: 'app.js' });
// => 'Analyze app.js\n\n**Project Context**:\n- **Language**: JavaScript\n...'
```

---

#### buildForStep

Build prompt for specific workflow step.

**Signature:**

```javascript
buildForStep(step: number | string, options?: Object): string
```

**Example:**

```javascript
const builder = new PromptBuilder();

const docPrompt = builder.buildForStep(1, {
  files: ['README.md'],
  changesSummary: 'Updated installation section',
});
// => Documentation analysis prompt (Step 1)

const testPrompt = builder.buildForStep('test_review', {
  testFiles: ['test/app.test.js'],
});
// => Test review prompt (Step 3)
```

---

## Usage Examples

### Example 1: Template-Based Prompt

```javascript
import { buildPromptFromTemplate } from './lib/ai_prompt_builder.js';

const template = `
Analyze the following file: {filename}

Focus areas:
{focus_areas}

Expected output: {output_format}
`;

const prompt = buildPromptFromTemplate(template, {
  filename: 'src/auth.js',
  focus_areas: '- Security\n- Error handling\n- Performance',
  output_format: 'Markdown report',
});

console.log(prompt);
```

---

### Example 2: Project-Aware Prompt

```javascript
import { injectProjectContext } from './lib/ai_prompt_builder.js';

const basePrompt = 'Review this code for best practices';

const enriched = injectProjectContext(basePrompt, {
  language: 'JavaScript',
  projectKind: 'react_spa',
  framework: 'React',
  techStack: ['Redux', 'TypeScript', 'Jest'],
});

console.log(enriched);
// => 'Review this code for best practices
//
// **Project Context**:
// - **Language**: JavaScript
// - **Project Type**: react_spa
// - **Framework**: React
// - **Tech Stack**: Redux, TypeScript, Jest'
```

---

### Example 3: Code Block Formatting

```javascript
import { formatCodeBlock } from './lib/ai_prompt_builder.js';

const code = `
function authenticate(user, password) {
  return bcrypt.compare(password, user.passwordHash);
}
`;

const prompt = `
Review this authentication function:

${formatCodeBlock(code, 'javascript')}

Focus on security best practices.
`;
```

---

### Example 4: File List Context

```javascript
import { buildFileListContext } from './lib/ai_prompt_builder.js';

const changedFiles = [
  'src/auth.js',
  'src/middleware/auth.js',
  'test/auth.test.js',
  'docs/api/auth.md',
  'README.md',
];

const fileContext = buildFileListContext(changedFiles, {
  maxFiles: 3,
  includeExtensions: ['.js', '.md'],
});

const prompt = `
Analyze these recently changed files:

${fileContext}

Identify any inconsistencies or gaps in documentation.
`;
```

---

### Example 5: Structured Multi-Section Prompt

```javascript
import { buildStructuredPrompt } from './lib/ai_prompt_builder.js';

const prompt = buildStructuredPrompt([
  {
    title: 'Task',
    content: 'Generate unit tests for the authentication module',
  },
  {
    title: 'Requirements',
    content: `
- Use Jest testing framework
- Cover happy path and edge cases
- Include mocking for database calls
- Aim for 90%+ code coverage
    `.trim(),
  },
  {
    title: 'Source Code',
    content: formatCodeBlock(sourceCode, 'javascript'),
  },
  {
    title: 'Output Format',
    content: 'Complete test file with describe/it blocks',
  },
]);
```

---

### Example 6: Documentation Analysis Prompt

```javascript
import { buildDocAnalysisPrompt } from './lib/ai_prompt_builder.js';

const prompt = buildDocAnalysisPrompt({
  files: ['src/api/users.js', 'src/api/auth.js'],
  changesSummary: 'Added new user profile endpoints and OAuth authentication',
  projectInfo: {
    language: 'JavaScript',
    projectKind: 'nodejs_api',
    framework: 'Express',
  },
  focus: [
    'API endpoint documentation',
    'Authentication flow diagrams',
    'Example requests/responses',
  ],
});

console.log(prompt);
```

---

### Example 7: Test Generation with Context Truncation

```javascript
import { buildTestGenPrompt, truncateContext } from './lib/ai_prompt_builder.js';

const largeSourceCode = fs.readFileSync('src/large-module.js', 'utf8');
const truncatedSource = truncateContext(largeSourceCode, 2000); // Max ~2000 tokens

const prompt = buildTestGenPrompt({
  targetFile: 'src/large-module.js',
  sourceCode: truncatedSource,
  testFramework: 'Jest',
  projectInfo: {
    language: 'JavaScript',
    techStack: ['Jest', 'supertest'],
  },
});
```

---

### Example 8: Using PromptBuilder Class

```javascript
import { PromptBuilder } from './lib/ai_prompt_builder.js';

const builder = new PromptBuilder({
  maxTokens: 4000,
  projectInfo: {
    language: 'JavaScript',
    projectKind: 'nodejs_api',
    framework: 'Express',
  },
  defaultPersona: 'documentation_expert',
});

// Build prompt for Step 1 (documentation)
const step1Prompt = builder.buildForStep(1, {
  files: ['README.md', 'API.md'],
  changesSummary: 'Added new features',
});

// Build custom prompt with template
const customPrompt = builder.build('Review {file} for {aspect}', {
  file: 'auth.js',
  aspect: 'security',
});
```

---

## Related Modules

- **[ai_personas](./ai_personas.md)** - AI persona definitions
- **[ai_helpers](./ai_helpers.md)** - AI request orchestration
- **[ai_cache](./ai_cache.md)** - Response caching

---

## Notes

### Token Estimation

Token estimation uses approximation: `tokens ≈ characters / 4`. For precise limits, integrate with a tokenizer library.

### Template Syntax

Supports two placeholder formats:

- `{variable}` - Simple placeholder
- `${variable}` - Shell-style placeholder

Both are replaced with the same precedence.

### Context Injection

Project context is automatically appended to prompts. Structure:

```
**Project Context**:
- **Language**: {language}
- **Project Type**: {projectKind}
- **Framework**: {framework}
- **Tech Stack**: {techStack.join(', ')}
```

### Best Practices

1. **Be specific**: Include concrete examples and constraints
2. **Structure prompts**: Use sections for clarity
3. **Add context**: Always include project info
4. **Truncate wisely**: Preserve important context over verbosity
5. **Format code**: Use syntax highlighting for better AI parsing

### Performance

- All pure functions are O(n) where n = template/content length
- No external API calls in pure functions
- Template substitution uses regex (optimized)

---

**Last Updated:** 2026-02-07
**Stability:** Stable
**Test Coverage:** 100%
