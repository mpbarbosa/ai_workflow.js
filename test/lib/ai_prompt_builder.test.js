/**
 * Tests for AI Prompt Builder Module
 *
 * @jest-environment node
 */

import {
  buildPromptFromTemplate,
  buildYamlStepPrompt,
  formatProjectKindLabel,
  deriveProjectSummary,
  injectProjectContext,
  formatProjectContextSection,
  formatCodeBlock,
  buildFileListContext,
  truncateContext,
  buildStructuredPrompt,
  buildDocAnalysisPrompt,
  buildConsistencyPrompt,
  buildTestReviewPrompt,
  buildTestGenPrompt,
  buildCodeQualityPrompt,
  buildTechnicalWriterPrompt,
  PromptBuilder,
  // Phase 14 pure functions
  reflectionPrompt,
  mergeReflectionResult,
  decomposePrompt,
  aggregateSubAnswers,
  buildAlternativesDirective,
  parseAlternatives,
  refinePrompt,
  scorePromptQuality,
  // Role-ref resolution
  resolveRoleRef,
  resolveAllRoleRefs,
  listPersonas,
  validateConfig,
} from '../../src/lib/ai_prompt_builder.js';

describe('AI Prompt Builder Module - Template Processing', () => {
  describe('buildPromptFromTemplate', () => {
    test('replaces {variable} placeholders', () => {
      const template = 'Analyze {file} for {language}';
      const context = { file: 'app.js', language: 'JavaScript' };

      const result = buildPromptFromTemplate(template, context);

      expect(result).toBe('Analyze app.js for JavaScript');
    });

    test('replaces ${variable} placeholders', () => {
      const template = 'Review ${file} in ${language}';
      const context = { file: 'test.js', language: 'JS' };

      const result = buildPromptFromTemplate(template, context);

      expect(result).toBe('Review test.js in JS');
    });

    test('handles multiple occurrences of same variable', () => {
      const template = '{var} and {var} again';
      const context = { var: 'value' };

      const result = buildPromptFromTemplate(template, context);

      expect(result).toBe('value and value again');
    });

    test('handles missing context variables', () => {
      const template = 'Test {missing}';
      const context = {};

      const result = buildPromptFromTemplate(template, context);

      expect(result).toBe('Test ');
    });

    test('returns empty string for invalid template', () => {
      expect(buildPromptFromTemplate(null)).toBe('');
      expect(buildPromptFromTemplate(undefined)).toBe('');
      expect(buildPromptFromTemplate(123)).toBe('');
    });

    test('handles empty context', () => {
      const template = 'No placeholders';
      const result = buildPromptFromTemplate(template);

      expect(result).toBe('No placeholders');
    });

    test('converts non-string values to strings', () => {
      const template = 'Number: {num}, Boolean: {bool}';
      const context = { num: 42, bool: true };

      const result = buildPromptFromTemplate(template, context);

      expect(result).toBe('Number: 42, Boolean: true');
    });

    test('preserves bash ${VAR} expressions inside injected file content', () => {
      // Regression: bash ${SCRIPT_DIR} in sample_code was being stripped by the
      // cleanup pass that runs after substitution, corrupting shell script samples.
      const bashContent =
        'PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"\nTAG="v${PACKAGE_VERSION}"';
      const template = 'Review this:\n{sample_code}';
      const result = buildPromptFromTemplate(template, { sample_code: bashContent });
      expect(result).toContain('${SCRIPT_DIR}');
      expect(result).toContain('${PACKAGE_VERSION}');
    });

    test('removes unfilled template placeholders but not injected content', () => {
      const template = '{filled} and {unfilled}';
      const result = buildPromptFromTemplate(template, { filled: 'hello' });
      expect(result).toBe('hello and ');
    });

    test('preserves special regex replacement patterns ($&, $1) in injected file content', () => {
      // Regression: String.prototype.replace() with a string second argument expands
      // $& to the matched text. When file_content_map contains source code with \\$&
      // (e.g. a regex replace like /pattern/g, '\\$&'), the injected content was
      // corrupted to \\{file_content_map} — the literal matched placeholder text.
      const sourceCode = "return str.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&');";
      const template = 'Code:\n{file_content_map}';
      const result = buildPromptFromTemplate(template, { file_content_map: sourceCode });
      expect(result).toContain('\\$&');
      expect(result).not.toContain('{file_content_map}');
    });

    test('formats project kind labels for prompt summaries', () => {
      expect(formatProjectKindLabel('nodejs_api')).toBe('nodejs API');
      expect(formatProjectKindLabel('client_spa')).toBe('client SPA');
      expect(formatProjectKindLabel('tui_ux')).toBe('TUI UX');
    });

    test('derives a generic project summary when description duplicates the project name', () => {
      expect(
        deriveProjectSummary({
          project_name: 'ai_workflow.js',
          project_description: 'ai_workflow.js',
          project_kind: 'nodejs_automation',
          primary_language: 'JavaScript',
        })
      ).toBe('JavaScript nodejs automation project');
    });

    test('buildYamlStepPrompt injects derived project_summary when description is low-signal', () => {
      const parsedYaml = {
        summary_prompt: {
          role: 'Reviewer',
          task_template:
            'Project: {project_name}\nProject Summary: {project_summary}\nLanguage: {primary_language}',
        },
      };

      const result = buildYamlStepPrompt(parsedYaml, 'summary_prompt', {
        project_name: 'ai_workflow.js',
        project_description: 'ai_workflow.js',
        project_kind: 'nodejs_automation',
        primary_language: 'JavaScript',
      });

      expect(result).toContain('Project: ai_workflow.js');
      expect(result).toContain('Project Summary: JavaScript nodejs automation project');
      expect(result).toContain('Language: JavaScript');
    });
  });

  describe('injectProjectContext', () => {
    test('injects language context', () => {
      const prompt = 'Review code';
      const projectInfo = { language: 'JavaScript' };

      const result = injectProjectContext(prompt, projectInfo);

      expect(result).toContain('Review code');
      expect(result).toContain('**Project Context**');
      expect(result).toContain('**Language**: JavaScript');
    });

    test('injects project kind', () => {
      const prompt = 'Test';
      const projectInfo = { projectKind: 'nodejs_api' };

      const result = injectProjectContext(prompt, projectInfo);

      expect(result).toContain('**Project Type**: nodejs_api');
    });

    test('injects framework', () => {
      const prompt = 'Test';
      const projectInfo = { framework: 'Express' };

      const result = injectProjectContext(prompt, projectInfo);

      expect(result).toContain('**Framework**: Express');
    });

    test('injects tech stack array', () => {
      const prompt = 'Test';
      const projectInfo = { techStack: ['Node.js', 'PostgreSQL', 'Redis'] };

      const result = injectProjectContext(prompt, projectInfo);

      expect(result).toContain('**Tech Stack**: Node.js, PostgreSQL, Redis');
    });

    test('injects multiple context items', () => {
      const prompt = 'Test';
      const projectInfo = {
        language: 'TypeScript',
        projectKind: 'react_spa',
        framework: 'React',
        techStack: ['React', 'Redux', 'TypeScript'],
      };

      const result = injectProjectContext(prompt, projectInfo);

      expect(result).toContain('**Language**: TypeScript');
      expect(result).toContain('**Project Type**: react_spa');
      expect(result).toContain('**Framework**: React');
      expect(result).toContain('**Tech Stack**:');
    });

    test('handles empty projectInfo', () => {
      const prompt = 'Test prompt';
      const result = injectProjectContext(prompt, {});

      expect(result).toBe('Test prompt');
    });

    test('skips empty project context sections when all values are missing', () => {
      const prompt = 'Test prompt';
      const result = injectProjectContext(prompt, {
        language: undefined,
        projectKind: undefined,
        framework: '',
        techStack: [],
      });

      expect(result).toBe('Test prompt');
      expect(result).not.toContain('**Project Context**');
    });

    test('returns empty string for invalid prompt', () => {
      expect(injectProjectContext(null)).toBe('');
      expect(injectProjectContext(undefined)).toBe('');
    });
  });

  describe('formatProjectContextSection', () => {
    test('wraps content in a labelled runtime constraints section', () => {
      const content = '## Runtime\n- Node.js only\n- No CORS';
      const result = formatProjectContextSection(content);
      expect(result).toContain('**Runtime Constraints (from PROJECT_CONTEXT.md)**:');
      expect(result).toContain('## Runtime');
      expect(result).toContain('- Node.js only');
      expect(result).toContain('- No CORS');
    });

    test('trims leading and trailing whitespace from content', () => {
      const result = formatProjectContextSection('  trimmed  ');
      expect(result).toContain('trimmed');
      expect(result).not.toMatch(/^\s/);
    });

    test('returns empty string for null content', () => {
      expect(formatProjectContextSection(null)).toBe('');
    });

    test('returns empty string for undefined content', () => {
      expect(formatProjectContextSection(undefined)).toBe('');
    });

    test('returns empty string for empty string', () => {
      expect(formatProjectContextSection('')).toBe('');
    });

    test('returns empty string for whitespace-only string', () => {
      expect(formatProjectContextSection('   \n  ')).toBe('');
    });

    test('returns empty string for non-string input', () => {
      expect(formatProjectContextSection(42)).toBe('');
      expect(formatProjectContextSection({})).toBe('');
    });
  });

  describe('formatCodeBlock', () => {
    test('formats code with language', () => {
      const code = 'const x = 1;';
      const result = formatCodeBlock(code, 'javascript');

      expect(result).toBe('```javascript\nconst x = 1;\n```');
    });

    test('formats code without language', () => {
      const code = 'plain text';
      const result = formatCodeBlock(code);

      expect(result).toBe('```\nplain text\n```');
    });

    test('trims whitespace from code', () => {
      const code = '  \n  code here  \n  ';
      const result = formatCodeBlock(code, 'js');

      expect(result).toBe('```js\ncode here\n```');
    });

    test('handles empty code', () => {
      const result = formatCodeBlock('');

      expect(result).toBe('```\n```');
    });

    test('handles null code', () => {
      const result = formatCodeBlock(null);

      expect(result).toBe('```\n```');
    });
  });

  describe('buildFileListContext', () => {
    test('builds simple list', () => {
      const files = ['app.js', 'test.js'];
      const result = buildFileListContext(files);

      expect(result).toBe('- app.js\n- test.js');
    });

    test('builds numbered list', () => {
      const files = ['app.js', 'test.js'];
      const result = buildFileListContext(files, { numbered: true });

      expect(result).toBe('1. app.js\n2. test.js');
    });

    test('groups by file type', () => {
      const files = ['app.js', 'test.js', 'style.css'];
      const result = buildFileListContext(files, { groupByType: true });

      expect(result).toContain('**js files**');
      expect(result).toContain('**css files**');
      expect(result).toContain('- app.js');
      expect(result).toContain('- style.css');
    });

    test('handles single file', () => {
      const files = ['app.js'];
      const result = buildFileListContext(files);

      expect(result).toBe('- app.js');
    });

    test('handles empty array', () => {
      const result = buildFileListContext([]);

      expect(result).toBe('No files');
    });

    test('handles non-array input', () => {
      const result = buildFileListContext(null);

      expect(result).toBe('No files');
    });

    test('handles files without extensions', () => {
      const files = ['Makefile', 'README'];
      const result = buildFileListContext(files, { groupByType: true });

      expect(result).toContain('no-ext');
    });
  });

  describe('truncateContext', () => {
    test('does not truncate short content', () => {
      const content = 'Short text';
      const result = truncateContext(content, 100);

      expect(result).toBe('Short text');
    });

    test('truncates long content', () => {
      const content = 'a'.repeat(1000);
      const result = truncateContext(content, 100); // 100 tokens = ~400 chars

      expect(result.length).toBeLessThan(content.length);
      expect(result).toContain('(truncated)');
    });

    test('uses custom truncation message', () => {
      const content = 'a'.repeat(1000);
      const result = truncateContext(content, 50, '...[MORE]');

      expect(result).toContain('[MORE]');
    });

    test('handles empty content', () => {
      const result = truncateContext('', 100);

      expect(result).toBe('');
    });

    test('handles null content', () => {
      const result = truncateContext(null, 100);

      expect(result).toBe('');
    });

    test('respects maxTokens calculation', () => {
      const content = 'a'.repeat(800); // ~200 tokens
      const result = truncateContext(content, 100); // 100 tokens = ~400 chars

      expect(result.length).toBeLessThanOrEqual(400 + 20); // +20 for truncation message
    });
  });

  describe('buildStructuredPrompt', () => {
    test('builds prompt with all sections', () => {
      const sections = {
        role: 'You are an expert',
        task: 'Review code',
        approach: 'Follow best practices',
      };

      const result = buildStructuredPrompt(sections);

      expect(result).toContain('**Role**: You are an expert');
      expect(result).toContain('**Task**: Review code');
      expect(result).toContain('**Approach**: Follow best practices');
    });

    test('handles missing sections', () => {
      const sections = { role: 'Expert' };
      const result = buildStructuredPrompt(sections);

      expect(result).toContain('**Role**: Expert');
      expect(result).not.toContain('**Task**');
    });

    test('includes context if provided', () => {
      const sections = {
        role: 'Expert',
        context: { language: 'JavaScript' },
      };

      const result = buildStructuredPrompt(sections);

      expect(result).toContain('**Context**');
      expect(result).toContain('JavaScript');
    });

    test('handles empty sections object', () => {
      const result = buildStructuredPrompt({});

      expect(result).toBe('');
    });
  });
});

describe('AI Prompt Builder Module - Role Reference Resolution', () => {
  const mockRoles = {
    roles: {
      doc_analysis: {
        role_prefix: 'You are a senior technical documentation specialist.',
      },
      technical_writer: {
        role_prefix: 'You are a senior technical writer and documentation architect.',
      },
    },
  };

  describe('resolveRoleRef', () => {
    test('replaces role_ref with role_prefix from roles', () => {
      const persona = {
        role_ref: 'doc_analysis',
        task_template: 'Analyze {files}',
      };
      const result = resolveRoleRef(persona, mockRoles);
      expect(result.role_prefix).toBe('You are a senior technical documentation specialist.');
      expect(result.role_ref).toBeUndefined();
      expect(result.task_template).toBe('Analyze {files}');
    });

    test('returns persona unchanged when role_ref is absent', () => {
      const persona = {
        role_prefix: 'You are a pre-existing inline role.',
        task_template: 'Do something.',
      };
      const result = resolveRoleRef(persona, mockRoles);
      expect(result).toEqual(persona);
      expect(result).not.toBe(persona); // still a new object via spread
    });

    test('throws when role_ref key is not found in roles', () => {
      const persona = { role_ref: 'nonexistent_role' };
      expect(() => resolveRoleRef(persona, mockRoles)).toThrow(
        'role_ref "nonexistent_role" not found in prompt_roles.yaml'
      );
    });

    test('throws for prototype-chain keys that are not own-properties (e.g. "constructor")', () => {
      const persona = { role_ref: 'constructor' };
      expect(() => resolveRoleRef(persona, mockRoles)).toThrow(
        'role_ref "constructor" not found in prompt_roles.yaml'
      );
    });

    test('throws for prototype-chain key "toString"', () => {
      const persona = { role_ref: 'toString' };
      expect(() => resolveRoleRef(persona, mockRoles)).toThrow(
        'role_ref "toString" not found in prompt_roles.yaml'
      );
    });

    test('returns null/undefined input unchanged', () => {
      expect(resolveRoleRef(null, mockRoles)).toBeNull();
      expect(resolveRoleRef(undefined, mockRoles)).toBeUndefined();
    });

    test('does not mutate the original persona object', () => {
      const persona = { role_ref: 'doc_analysis', approach: 'Step by step.' };
      resolveRoleRef(persona, mockRoles);
      expect(persona.role_ref).toBe('doc_analysis');
      expect(persona.role_prefix).toBeUndefined();
    });
  });

  describe('resolveAllRoleRefs', () => {
    test('resolves all role_ref entries in a yaml object', () => {
      const yaml = {
        doc_analysis_prompt: { role_ref: 'doc_analysis', task_template: 'Analyze.' },
        technical_writer_prompt: { role_ref: 'technical_writer', task_template: 'Write.' },
      };
      const result = resolveAllRoleRefs(yaml, mockRoles);
      expect(result.doc_analysis_prompt.role_prefix).toBe(
        'You are a senior technical documentation specialist.'
      );
      expect(result.technical_writer_prompt.role_prefix).toBe(
        'You are a senior technical writer and documentation architect.'
      );
    });

    test('passes through entries without role_ref unchanged', () => {
      const yaml = {
        some_prompt: { role_prefix: 'Inline role.', task_template: 'Task.' },
        lookup_table: { javascript: { key_points: 'Use ESLint.' } },
        metadata: { version: '1.0.0' },
      };
      const result = resolveAllRoleRefs(yaml, mockRoles);
      expect(result.some_prompt).toEqual({ role_prefix: 'Inline role.', task_template: 'Task.' });
      expect(result.lookup_table).toBe(yaml.lookup_table);
      expect(result.metadata).toBe(yaml.metadata);
    });

    test('returns a new object (does not mutate input)', () => {
      const yaml = {
        doc_analysis_prompt: { role_ref: 'doc_analysis' },
      };
      const result = resolveAllRoleRefs(yaml, mockRoles);
      expect(result).not.toBe(yaml);
      expect(yaml.doc_analysis_prompt.role_ref).toBe('doc_analysis');
    });

    test('returns input unchanged for null or non-object', () => {
      expect(resolveAllRoleRefs(null, mockRoles)).toBeNull();
      expect(resolveAllRoleRefs('string', mockRoles)).toBe('string');
    });

    test('throws if a role_ref cannot be resolved', () => {
      const yaml = {
        bad_prompt: { role_ref: 'missing_role' },
      };
      expect(() => resolveAllRoleRefs(yaml, mockRoles)).toThrow(
        'role_ref "missing_role" not found in prompt_roles.yaml'
      );
    });
  });
});

describe('AI Prompt Builder Module - Persona Enumeration (listPersonas)', () => {
  test('returns sorted persona keys for entries with role_ref', () => {
    const yaml = {
      typescript_prompt: { role_ref: 'typescript_dev', task_template: 'Review TS.' },
      doc_prompt: { role_ref: 'doc_analysis', task_template: 'Analyze docs.' },
      python_prompt: { role_ref: 'python_developer', task_template: 'Review Python.' },
    };
    expect(listPersonas(yaml)).toEqual(['doc_prompt', 'python_prompt', 'typescript_prompt']);
  });

  test('excludes non-persona entries (no role_ref)', () => {
    const yaml = {
      some_prompt: { role_ref: 'doc_analysis', task_template: 'Analyze.' },
      lookup_table: { javascript: { key_points: 'Use ESLint.' } },
      metadata: { version: '1.0.0' },
      plain_string: 'anchor',
    };
    expect(listPersonas(yaml)).toEqual(['some_prompt']);
  });

  test('excludes arrays even if they have a role_ref property', () => {
    const yaml = {
      arr_entry: Object.assign(['a', 'b'], { role_ref: 'doc_analysis' }),
      valid_prompt: { role_ref: 'doc_analysis', task_template: 'Task.' },
    };
    expect(listPersonas(yaml)).toEqual(['valid_prompt']);
  });

  test('returns empty array for empty object', () => {
    expect(listPersonas({})).toEqual([]);
  });

  test('returns empty array for null or non-object input', () => {
    expect(listPersonas(null)).toEqual([]);
    expect(listPersonas(undefined)).toEqual([]);
    expect(listPersonas('string')).toEqual([]);
  });

  test('returns deterministic sorted order', () => {
    const yaml = { z_prompt: { role_ref: 'z' }, a_prompt: { role_ref: 'a' } };
    expect(listPersonas(yaml)).toEqual(['a_prompt', 'z_prompt']);
  });
});

describe('AI Prompt Builder Module - Config Validation (validateConfig)', () => {
  const roles = {
    roles: {
      doc_analysis: { role_prefix: 'You are a doc specialist.' },
      python_developer: { role_prefix: 'You are a Python developer.' },
    },
  };

  test('returns valid=true and empty errors when all role_refs resolve', () => {
    const yaml = {
      doc_prompt: { role_ref: 'doc_analysis', task_template: 'Analyze.' },
      python_prompt: { role_ref: 'python_developer', task_template: 'Review Python.' },
    };
    const result = validateConfig(yaml, roles);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  test('returns valid=false with error message for unresolvable role_ref', () => {
    const yaml = {
      bad_prompt: { role_ref: 'nonexistent_role', task_template: 'Task.' },
    };
    const result = validateConfig(yaml, roles);
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('nonexistent_role');
    expect(result.errors[0]).toContain('bad_prompt');
  });

  test('collects all errors rather than throwing on first', () => {
    const yaml = {
      z_bad: { role_ref: 'z_missing', task_template: 'Z task.' },
      a_bad: { role_ref: 'a_missing', task_template: 'A task.' },
      good: { role_ref: 'doc_analysis', task_template: 'Good.' },
    };
    const result = validateConfig(yaml, roles);
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(2);
    // errors are sorted
    expect(result.errors[0]).toContain('a_missing');
    expect(result.errors[1]).toContain('z_missing');
  });

  test('rejects prototype-chain keys not present as own-properties (e.g. "constructor")', () => {
    const yaml = { sneaky_prompt: { role_ref: 'constructor', task_template: 'Task.' } };
    const result = validateConfig(yaml, roles);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('constructor');
  });

  test('ignores non-persona entries (no role_ref)', () => {
    const yaml = {
      lookup_table: { javascript: 'Use ESLint.' },
      metadata: { version: '1.0.0' },
      valid_prompt: { role_ref: 'doc_analysis', task_template: 'Analyze.' },
    };
    const result = validateConfig(yaml, roles);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  test('returns valid=true for empty yaml object', () => {
    const result = validateConfig({}, roles);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  test('returns valid=true for null/undefined yaml', () => {
    expect(validateConfig(null, roles)).toEqual({ valid: true, errors: [] });
    expect(validateConfig(undefined, roles)).toEqual({ valid: true, errors: [] });
  });

  test('reports error when roles is missing entirely', () => {
    const yaml = { some_prompt: { role_ref: 'doc_analysis', task_template: 'Task.' } };
    const result = validateConfig(yaml, null);
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
  });
});

describe('AI Prompt Builder Module - Specialized Builders', () => {
  describe('buildDocAnalysisPrompt', () => {
    test('builds documentation analysis prompt', () => {
      const options = {
        changedFiles: ['src/app.js', 'src/utils.js'],
        docFiles: ['README.md', 'API.md'],
      };

      const result = buildDocAnalysisPrompt(options);

      expect(result).toContain('**Role**');
      expect(result).toContain('documentation specialist');
      expect(result).toContain('src/app.js');
      expect(result).toContain('README.md');
      expect(result).toContain('**Methodology**');
    });

    test('includes project context', () => {
      const options = {
        changedFiles: ['app.js'],
        docFiles: ['README.md'],
        projectInfo: { language: 'JavaScript' },
      };

      const result = buildDocAnalysisPrompt(options);

      expect(result).toContain('**Project Context**');
      expect(result).toContain('JavaScript');
    });

    test('handles empty file lists', () => {
      const options = { changedFiles: [], docFiles: [] };
      const result = buildDocAnalysisPrompt(options);

      expect(result).toContain('No files');
    });

    test('includes guardrails for planned items and unsupported metadata guesses', () => {
      const result = buildDocAnalysisPrompt({
        changedFiles: ['ROADMAP.md', 'package.json'],
        docFiles: ['README.md'],
      });

      expect(result).toContain(
        'Do not add placeholder "planned" or "coming soon" entries to current-state docs'
      );
      expect(result).toContain('Never infer release dates or "Last updated" values');
      expect(result).toContain('treat them as linked metadata');
    });
  });

  describe('buildConsistencyPrompt', () => {
    test('builds consistency check prompt', () => {
      const options = { docDirectory: 'docs/' };
      const result = buildConsistencyPrompt(options);

      expect(result).toContain('**Role**');
      expect(result).toContain('information architect');
      expect(result).toContain('docs/');
      expect(result).toContain('consistency');
    });

    test('specifies markdown documentation types in scope', () => {
      const result = buildConsistencyPrompt({ docDirectory: '/proj' });

      expect(result).toContain('markdown documentation files');
      expect(result).toContain('CONTRIBUTING.md');
      expect(result).toContain('docs/');
      expect(result).toContain('JSDoc source coverage');
    });

    test('defines what consistency means', () => {
      const result = buildConsistencyPrompt({ docDirectory: '/proj' });

      expect(result).toContain('uniform naming conventions');
      expect(result).toContain('up-to-date examples');
      expect(result).toContain('intact\ncross-references');
      expect(result).toContain('style uniformity');
    });

    test('references project-specific style standards', () => {
      const result = buildConsistencyPrompt({ docDirectory: '/proj' });

      expect(result).toContain('copilot-instructions.md');
      expect(result).toContain('authoritative style reference');
    });

    test('includes project context', () => {
      const options = {
        docDirectory: 'docs/',
        projectInfo: { projectKind: 'nodejs_api' },
      };

      const result = buildConsistencyPrompt(options);

      expect(result).toContain('nodejs_api');
    });
  });

  describe('buildTestReviewPrompt', () => {
    test('builds test review prompt', () => {
      const options = {
        testFiles: ['test/app.test.js', 'test/utils.test.js'],
        framework: 'Jest',
      };

      const result = buildTestReviewPrompt(options);

      expect(result).toContain('**Role**');
      expect(result).toContain('test architect');
      expect(result).toContain('test/app.test.js');
      expect(result).toContain('using Jest');
    });

    test('works without framework', () => {
      const options = { testFiles: ['test/app.test.js'] };
      const result = buildTestReviewPrompt(options);

      expect(result).not.toContain('using');
      expect(result).toContain('test/app.test.js');
    });

    test('includes framework-specific guideline when framework is provided', () => {
      const result = buildTestReviewPrompt({
        testFiles: ['test/app.test.ts'],
        framework: 'TypeScript',
      });

      expect(result).toContain('When reviewing TypeScript tests');
      expect(result).toContain('TypeScript-specific matchers');
    });

    test('omits framework-specific guideline when framework is absent', () => {
      const result = buildTestReviewPrompt({ testFiles: ['test/app.test.js'] });

      expect(result).not.toContain('When reviewing');
      expect(result).not.toContain('specific matchers');
    });

    test('includes file:line citation guideline', () => {
      const result = buildTestReviewPrompt({
        testFiles: ['test/app.test.ts'],
        framework: 'jest',
      });

      expect(result).toContain('file:line');
    });

    test('includes calibrated effort estimate guideline', () => {
      const result = buildTestReviewPrompt({ testFiles: ['test/app.test.ts'] });

      expect(result).toContain('small');
      expect(result).toContain('medium');
      expect(result).toContain('large');
    });

    test('includes CONTRIBUTING.md convention guideline', () => {
      const result = buildTestReviewPrompt({ testFiles: ['test/app.test.ts'] });

      expect(result).toContain('CONTRIBUTING.md');
    });

    test('uses testFramework as primary label, framework as qualifier', () => {
      const result = buildTestReviewPrompt({
        testFiles: ['test/app.test.ts'],
        framework: 'typescript',
        testFramework: 'jest',
      });

      expect(result).toContain('using jest (typescript)');
      expect(result).toContain('When reviewing jest tests');
    });

    test('uses only testFramework when framework is absent', () => {
      const result = buildTestReviewPrompt({
        testFiles: ['test/app.test.ts'],
        testFramework: 'pytest',
      });

      expect(result).toContain('using pytest');
      expect(result).not.toContain('pytest (');
    });

    test('includes test and coverage commands when provided', () => {
      const result = buildTestReviewPrompt({
        testFiles: ['test/app.test.ts'],
        testFramework: 'jest',
        testCommand: 'npm test',
        coverageCommand: 'npm run test:coverage',
      });

      expect(result).toContain('`npm test`');
      expect(result).toContain('`npm run test:coverage`');
      expect(result).toContain('Repository-default test command');
    });

    test('omits command line when testCommand is empty', () => {
      const result = buildTestReviewPrompt({
        testFiles: ['test/app.test.ts'],
        testFramework: 'jest',
      });

      expect(result).not.toContain('Run tests with');
    });

    test('normalizes null/whitespace framework values gracefully', () => {
      const result = buildTestReviewPrompt({
        testFiles: ['test/app.test.ts'],
        framework: null,
        testFramework: '  ',
        testCommand: '',
      });

      expect(result).not.toContain('using');
      expect(result).not.toContain('Run tests with');
      expect(result).not.toContain('When reviewing');
    });

    test('clarifies assertion quality, edge cases, and test isolation in task', () => {
      const result = buildTestReviewPrompt({ testFiles: ['test/app.test.ts'] });

      expect(result).toContain('assertion quality');
      expect(result).toContain('edge cases');
      expect(result).toContain('test isolation');
    });

    test('treats declarative files as artifacts instead of executable tests', () => {
      const result = buildTestReviewPrompt({
        testFiles: ['test/index.test.ts', 'src/__tests__/loader.test.ts'],
        testFramework: 'jest',
        testCommand: 'npm test',
      });

      expect(result).toContain('test-related artifacts');
      expect(result).toContain('Repository-default test command: `npm test`');
      expect(result).toContain('declarative YAML/JSON/HCL');
    });

    test('treats named test commands as context and requires unverified wording when compatibility is unclear', () => {
      const result = buildTestReviewPrompt({
        testFiles: ['__tests__/data/LogradouroChangeTrigger.test.ts'],
        testFramework: 'jest',
        testCommand: 'npm test',
      });

      expect(result).toContain('context, not proof that every listed file runs under that command');
      expect(result).toContain('command compatibility is unverified');
    });

    test('requires inconclusive wording when evidence is missing or truncated', () => {
      const result = buildTestReviewPrompt({ testFiles: ['test/app.test.ts'] });

      expect(result).toContain('unavailable or inconclusive');
      expect(result).toContain('Do not claim CI stability, performance health');
      expect(result).toContain(
        'do not convert missing execution-risk, CI, or mock-hygiene evidence into positive pass statements'
      );
    });

    test('forbids unsupported positive summaries about mocks or performance', () => {
      const result = buildTestReviewPrompt({ testFiles: ['test/app.test.ts'] });

      expect(result).toContain('all mocks are restored');
      expect(result).toContain('no performance issues');
      expect(result).toContain('no major anti-patterns');
    });

    test('allows before/after snippets only when grounded in visible code', () => {
      const result = buildTestReviewPrompt({ testFiles: ['test/app.test.ts'] });

      expect(result).toContain(
        'before/after example only when both snippets come from visible code'
      );
    });
  });

  describe('buildTestGenPrompt', () => {
    test('builds test generation prompt', () => {
      const options = {
        codeFiles: ['src/app.js', 'src/utils.js'],
        framework: 'Mocha',
      };

      const result = buildTestGenPrompt(options);

      expect(result).toContain('**Role**');
      expect(result).toContain('test engineer');
      expect(result).toContain('src/app.js');
      expect(result).toContain('using Mocha');
    });

    test('includes coverage strategy', () => {
      const options = { codeFiles: ['app.js'] };
      const result = buildTestGenPrompt(options);

      expect(result).toContain('Coverage Target');
      expect(result).toContain('edge cases');
    });
  });

  describe('buildCodeQualityPrompt', () => {
    test('builds code quality prompt', () => {
      const options = {
        codeFiles: ['src/app.js'],
        language: 'JavaScript',
      };

      const result = buildCodeQualityPrompt(options);

      expect(result).toContain('**Role**');
      expect(result).toContain('software architect');
      expect(result).toContain('JavaScript');
      expect(result).toContain('src/app.js');
    });

    test('works without language', () => {
      const options = { codeFiles: ['app.js'] };
      const result = buildCodeQualityPrompt(options);

      expect(result).toContain('software development');
    });

    test('includes quality focus areas', () => {
      const options = { codeFiles: ['app.js'] };
      const result = buildCodeQualityPrompt(options);

      expect(result).toContain('maintainability');
      expect(result).toContain('security');
      expect(result).toContain('performance');
    });

    test('injects file contents when fileContents provided', () => {
      const options = {
        codeFiles: ['src/app.js'],
        language: 'javascript',
        fileContents: { 'src/app.js': 'const x = 1;' },
      };
      const result = buildCodeQualityPrompt(options);

      expect(result).toContain('# File Contents');
      expect(result).toContain('`src/app.js`');
      expect(result).toContain('const x = 1;');
    });

    test('truncates individual files exceeding MAX_CHARS_PER_FILE', () => {
      const bigContent = 'x'.repeat(5_000);
      const options = {
        codeFiles: ['big.js'],
        fileContents: { 'big.js': bigContent },
      };
      const result = buildCodeQualityPrompt(options);

      expect(result).toContain('...(truncated — remainder omitted)');
      // Should not contain all 5000 chars; allow for prompt boilerplate overhead
      expect(result.length).toBeLessThan(bigContent.length + 2_000);
    });

    test('omits files beyond total content budget', () => {
      // Each file ~15 000 chars — 3 files exceeds the 30 000 char total budget
      const bigContent = 'y'.repeat(15_000);
      const options = {
        codeFiles: ['a.js', 'b.js', 'c.js'],
        fileContents: { 'a.js': bigContent, 'b.js': bigContent, 'c.js': bigContent },
      };
      const result = buildCodeQualityPrompt(options);

      expect(result).toContain('context budget exhausted');
    });

    test('works without fileContents (backward compatible)', () => {
      const options = { codeFiles: ['src/app.js'], language: 'javascript' };
      const result = buildCodeQualityPrompt(options);

      expect(result).toContain('src/app.js');
      expect(result).toContain('# File Contents');
      expect(result).toContain('mark it unavailable or inconclusive');
    });

    test('includes evidence-limit guidance for scoped reviews', () => {
      const result = buildCodeQualityPrompt({ codeFiles: ['src/app.js'], language: 'javascript' });

      expect(result).toContain('Review only the files and file contents explicitly provided');
      expect(result).toContain('Do not claim repository-wide health');
    });
  });

  describe('buildTechnicalWriterPrompt', () => {
    test('builds technical writer prompt', () => {
      const options = {
        projectRoot: '/project',
        codeFiles: ['src/app.js', 'src/utils.js'],
      };

      const result = buildTechnicalWriterPrompt(options);

      expect(result).toContain('**Role**');
      expect(result).toContain('technical writer');
      expect(result).toContain('/project');
      expect(result).toContain('src/app.js');
    });

    test('works without code files', () => {
      const options = { projectRoot: '/project' };
      const result = buildTechnicalWriterPrompt(options);

      expect(result).toContain('/project');
      expect(result).toContain('Documentation Scope');
    });

    test('includes documentation deliverables', () => {
      const options = { projectRoot: '/project' };
      const result = buildTechnicalWriterPrompt(options);

      expect(result).toContain('README');
      expect(result).toContain('API documentation');
      expect(result).toContain('Architecture');
    });
  });
});

describe('AI Prompt Builder Module - PromptBuilder Class', () => {
  let builder;

  beforeEach(() => {
    builder = new PromptBuilder({
      maxTokens: 1000,
      projectInfo: { language: 'JavaScript' },
    });
  });

  describe('constructor', () => {
    test('sets default maxTokens', () => {
      const defaultBuilder = new PromptBuilder();
      expect(defaultBuilder.maxTokens).toBe(8000);
    });

    test('sets custom maxTokens', () => {
      const customBuilder = new PromptBuilder({ maxTokens: 5000 });
      expect(customBuilder.maxTokens).toBe(5000);
    });

    test('sets projectInfo', () => {
      const customBuilder = new PromptBuilder({
        projectInfo: { language: 'Python' },
      });
      expect(customBuilder.projectInfo.language).toBe('Python');
    });
  });

  describe('buildDocAnalysis', () => {
    test('generates doc analysis prompt', () => {
      const result = builder.buildDocAnalysis({
        changedFiles: ['app.js'],
        docFiles: ['README.md'],
      });

      expect(result).toContain('documentation specialist');
      expect(result).toContain('JavaScript'); // From default projectInfo
    });

    test('merges projectInfo', () => {
      const result = builder.buildDocAnalysis({
        changedFiles: ['app.js'],
        docFiles: ['README.md'],
        projectInfo: { framework: 'Express' },
      });

      expect(result).toContain('JavaScript');
      expect(result).toContain('Express');
    });

    test('truncates long prompts', () => {
      const longBuilder = new PromptBuilder({ maxTokens: 10 });
      const result = longBuilder.buildDocAnalysis({
        changedFiles: ['app.js'],
        docFiles: ['README.md'],
      });

      expect(result.length).toBeLessThan(500);
    });
  });

  describe('buildConsistency', () => {
    test('generates consistency prompt', () => {
      const result = builder.buildConsistency({ docDirectory: 'docs/' });

      expect(result).toContain('consistency');
      expect(result).toContain('JavaScript');
    });
  });

  describe('buildTestReview', () => {
    test('generates test review prompt', () => {
      const result = builder.buildTestReview({
        testFiles: ['test/app.test.js'],
        framework: 'Jest',
      });

      expect(result).toContain('test architect');
      expect(result).toContain('Jest');
    });
  });

  describe('buildTestGen', () => {
    test('generates test generation prompt', () => {
      const result = builder.buildTestGen({
        codeFiles: ['src/app.js'],
        framework: 'Mocha',
      });

      expect(result).toContain('test engineer');
      expect(result).toContain('Mocha');
    });
  });

  describe('buildCodeQuality', () => {
    test('generates code quality prompt', () => {
      const result = builder.buildCodeQuality({
        codeFiles: ['src/app.js'],
        language: 'TypeScript',
      });

      expect(result).toContain('software architect');
      expect(result).toContain('TypeScript');
    });
  });

  describe('buildTechnicalWriter', () => {
    test('generates technical writer prompt', () => {
      const result = builder.buildTechnicalWriter({
        projectRoot: '/project',
        codeFiles: ['src/app.js'],
      });

      expect(result).toContain('technical writer');
      expect(result).toContain('/project');
    });
  });
});

// ============================================================================
// PHASE 14 — PROMPT ENGINEERING ENHANCEMENTS
// ============================================================================

describe('Phase 14 — Reflection (14.1)', () => {
  describe('reflectionPrompt', () => {
    test('returns a non-empty string', () => {
      const result = reflectionPrompt('Some primary response text');
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(10);
    });

    test('references the primary response in the output', () => {
      const primary = 'Use option A because it is faster.';
      const result = reflectionPrompt(primary);
      expect(result).toContain(primary);
    });

    test('asks for critique or review language', () => {
      const result = reflectionPrompt('My answer');
      const lower = result.toLowerCase();
      expect(
        lower.includes('review') ||
          lower.includes('critique') ||
          lower.includes('self') ||
          lower.includes('gap') ||
          lower.includes('improve')
      ).toBe(true);
    });
  });

  describe('mergeReflectionResult', () => {
    test('returns an object with content field', () => {
      const primary = { content: 'Original content', confidence: 80 };
      const reflection = { content: 'No gaps found.' };
      const merged = mergeReflectionResult(primary, reflection);
      expect(merged).toHaveProperty('content');
    });

    test('primary content is preserved in merged result', () => {
      const primary = { content: 'Step A, Step B, Step C', confidence: 90 };
      const reflection = { content: 'Missing error handling.' };
      const merged = mergeReflectionResult(primary, reflection);
      expect(merged.content).toContain('Step A, Step B, Step C');
    });

    test('reflection content is incorporated', () => {
      const primary = { content: 'Do X.', confidence: 70 };
      // mergeReflectionResult parses ISSUES:/IMPROVEMENTS: structured blocks;
      // when the reflection contains those markers the notes are appended to content.
      const reflection = {
        content: 'ISSUES: X is deprecated and should be replaced.\nIMPROVEMENTS: Use Y instead.',
      };
      const merged = mergeReflectionResult(primary, reflection);
      // The merged result should carry reflection metadata even if content is unchanged
      expect(merged).toHaveProperty('reflection');
      expect(merged.reflection.issues).toMatch(/deprecated/);
    });
  });
});

describe('Phase 14 — Cognitive Verifier (14.2)', () => {
  describe('decomposePrompt', () => {
    test('returns array with length equal to subQuestions', () => {
      const subs = ['What is A?', 'What is B?', 'What is C?'];
      const result = decomposePrompt('Main question about Z', subs);
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(3);
    });

    test('each sub-prompt contains its sub-question', () => {
      const subs = ['Q1', 'Q2'];
      const result = decomposePrompt('Overall question', subs);
      expect(result[0]).toContain('Q1');
      expect(result[1]).toContain('Q2');
    });

    test('returns single-item array when given one sub-question', () => {
      const result = decomposePrompt('Big question', ['Only sub']);
      expect(result).toHaveLength(1);
      expect(result[0]).toContain('Only sub');
    });
  });

  describe('aggregateSubAnswers', () => {
    test('returns a non-empty string', () => {
      const result = aggregateSubAnswers('Main question', ['A1', 'A2']);
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    test('includes each sub-answer in the output', () => {
      const subs = ['Answer for part one', 'Answer for part two'];
      const result = aggregateSubAnswers('Overall question', subs);
      expect(result).toContain('Answer for part one');
      expect(result).toContain('Answer for part two');
    });
  });
});

describe('Phase 14 — Alternative Approaches (14.3)', () => {
  describe('buildAlternativesDirective', () => {
    test('returns a string', () => {
      expect(typeof buildAlternativesDirective()).toBe('string');
    });

    test('default directive mentions 2 alternatives', () => {
      const result = buildAlternativesDirective();
      expect(result).toMatch(/2|two/i);
    });

    test('custom count is reflected', () => {
      const result = buildAlternativesDirective(3);
      expect(result).toMatch(/3|three/i);
    });

    test('mentions trade-offs or alternatives', () => {
      const result = buildAlternativesDirective().toLowerCase();
      expect(
        result.includes('alternative') || result.includes('trade') || result.includes('option')
      ).toBe(true);
    });
  });

  describe('parseAlternatives', () => {
    test('returns an object with alternatives array', () => {
      const text = 'Option 1: Use PostgreSQL\n\nOption 2: Use SQLite';
      const result = parseAlternatives(text);
      expect(result).toHaveProperty('alternatives');
      expect(Array.isArray(result.alternatives)).toBe(true);
    });

    test('returns empty alternatives for unstructured text', () => {
      const result = parseAlternatives('Just some plain text without numbered options.');
      expect(result.alternatives.length).toBe(0);
    });

    test('extracts numbered alternatives from structured response', () => {
      const text = [
        '**Alternative 1:** Use Redis for caching.',
        '  Trade-offs: Fast but requires extra infra.',
        '',
        '**Alternative 2:** Use in-memory Map.',
        '  Trade-offs: Simpler, but not persistent.',
      ].join('\n');
      const result = parseAlternatives(text);
      expect(result.alternatives.length).toBeGreaterThanOrEqual(1);
    });
  });
});

describe('Phase 14 — Prompt Pre-flight (14.5)', () => {
  describe('refinePrompt', () => {
    test('returns a string', () => {
      expect(typeof refinePrompt('Analyze this code')).toBe('string');
    });

    test('incorporates the raw prompt', () => {
      const raw = 'Fix the authentication bug';
      const result = refinePrompt(raw);
      expect(result).toContain(raw);
    });

    test('asks model to improve or rewrite', () => {
      const result = refinePrompt('Do something').toLowerCase();
      expect(
        result.includes('rewrite') ||
          result.includes('improve') ||
          result.includes('refine') ||
          result.includes('clearer') ||
          result.includes('specific')
      ).toBe(true);
    });
  });

  describe('scorePromptQuality', () => {
    test('returns a number between 0 and 100', () => {
      const score = scorePromptQuality('Analyze the authentication module');
      expect(typeof score).toBe('number');
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    test('empty string scores 0', () => {
      expect(scorePromptQuality('')).toBe(0);
    });

    test('benchmark: refined prompts score higher than vague ones', () => {
      const fixtures = [
        {
          raw: 'fix bugs',
          refined:
            'Identify and fix the top 3 authentication bugs in src/auth/login.js, focusing on JWT token validation and session expiry handling.',
        },
        {
          raw: 'write tests',
          refined:
            'Generate Jest unit tests for the pure functions exported from src/lib/config.js, covering edge cases for missing fields and invalid YAML syntax.',
        },
        {
          raw: 'make it faster',
          refined:
            'Profile src/lib/ai_cache.js and reduce cache lookup latency by replacing linear scan with a Map-based index; provide benchmark before/after numbers.',
        },
        {
          raw: 'check docs',
          refined:
            'Validate that all public API functions in src/index.js have JSDoc @param and @returns annotations, and flag any that are missing examples.',
        },
        {
          raw: 'clean up',
          refined:
            'Remove dead code in src/lib/utils.js: delete unused helper functions identified by running ts-prune, and consolidate duplicated array utilities.',
        },
      ];

      for (const { raw, refined } of fixtures) {
        const rawScore = scorePromptQuality(raw);
        const refinedScore = scorePromptQuality(refined);
        expect(refinedScore).toBeGreaterThan(rawScore);
      }
    });
  });
});
