/**
 * Step 14: Prompt Engineer Analysis
 * @module steps/step_14_prompt_engineer
 * @version 2.0.0
 *
 * Purpose: Analyze AI persona prompts and suggest improvements
 * Scope: Only runs on workflow automation projects
 * Features:
 * - Extract and analyze AI persona prompts
 * - Identify improvement opportunities
 * - Generate quality metrics
 * - Optionally create GitHub issues
 *
 * Architecture: v2.0.0 Referential Transparency
 * - Pure functions for analysis
 * - Impure wrapper class for I/O operations
 */

import { STEP_KIND } from './step_contract.js';
import { AiHelper } from '../lib/ai_helpers.js';
import { AiCache } from '../lib/ai_cache.js';
import {
  buildStructuredPrompt,
  injectProjectContext,
  buildYamlStepPrompt,
  AI_HELPERS_PATH,
} from '../lib/ai_prompt_builder.js';
import yaml from 'js-yaml';

// ============================================================================
// CONSTANTS
// ============================================================================

export const PROJECT_TYPES = {
  workflowAutomation: 'workflow-automation',
  bashFramework: 'bash-automation-framework',
  configurationLibrary: 'configuration_library',
};

export const PROMPT_QUALITY_CRITERIA = {
  clarity: { weight: 3, description: 'Clear and unambiguous instructions' },
  specificity: { weight: 2, description: 'Specific and actionable tasks' },
  structure: { weight: 2, description: 'Well-organized structure' },
  examples: { weight: 1, description: 'Includes examples' },
  context: { weight: 2, description: 'Provides sufficient context' },
};

export const QUALITY_THRESHOLDS = {
  excellent: 90,
  good: 75,
  needsImprovement: 60,
};

// ============================================================================
// PURE FUNCTIONS - Prompt Analysis
// ============================================================================

/**
 * Check if step should run based on project type
 * @pure
 * @param {string} projectType - Project type from config
 * @returns {boolean} True if should run
 */
export function shouldRunPromptAnalysis(projectType) {
  return (
    projectType === PROJECT_TYPES.workflowAutomation ||
    projectType === PROJECT_TYPES.bashFramework ||
    projectType === PROJECT_TYPES.configurationLibrary
  );
}

/**
 * Extract persona names from YAML content
 * @pure
 * @param {string} yamlContent - YAML configuration content
 * @returns {Array<string>} List of persona names
 */
export function extractPersonaNames(yamlContent) {
  const lines = yamlContent.split('\n');
  const personaNames = [];

  lines.forEach((line) => {
    const match = line.match(/^([a-z0-9_]+)_prompt:/);
    if (match) {
      personaNames.push(match[1]);
    }
  });

  return personaNames;
}

/**
 * Extract prompt content for a specific persona
 * @pure
 * @param {string} yamlContent - YAML configuration content
 * @param {string} personaName - Name of persona
 * @returns {Object|null} Extracted prompt sections
 */
export function extractPromptContent(yamlContent, personaName) {
  const lines = yamlContent.split('\n');
  const promptKey = `${personaName}_prompt:`;
  let inPrompt = false;
  let currentSection = null;
  const content = {
    role: '',
    task: '',
    approach: '',
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check if we're entering the prompt section
    if (line.trim() === promptKey) {
      inPrompt = true;
      continue;
    }

    // Exit if we hit another persona
    if (inPrompt && /^[a-z0-9_]+_prompt:/.test(line)) {
      break;
    }

    if (!inPrompt) continue;

    // Detect section headers (role:, task_template:, approach:)
    if (/^\s{2}(role|task_template|approach):\s*\|/.test(line)) {
      const match = line.match(/^\s{2}(role|task_template|approach):\s*\|/);
      currentSection = match[1] === 'task_template' ? 'task' : match[1];
      continue;
    }

    // Collect content lines (4-space indented)
    if (currentSection && /^\s{4}/.test(line)) {
      const contentLine = line.replace(/^\s{4}/, '');
      content[currentSection] += contentLine + '\n';
    }
  }

  // Return null if no content found
  if (!content.role && !content.task && !content.approach) {
    return null;
  }

  return {
    role: content.role.trim(),
    task: content.task.trim(),
    approach: content.approach.trim(),
  };
}

/**
 * Calculate quality score for a prompt
 * @pure
 * @param {Object} prompt - Prompt content (role, task, approach)
 * @returns {number} Quality score (0-100)
 */
export function calculatePromptQuality(prompt) {
  let score = 0;
  let maxScore = 0;

  // Clarity: Check for clear language and structure
  maxScore += PROMPT_QUALITY_CRITERIA.clarity.weight * 10;
  if (prompt.role && prompt.role.length > 20) {
    score += PROMPT_QUALITY_CRITERIA.clarity.weight * 8;
  }
  if (prompt.task && prompt.task.length > 50) {
    score += PROMPT_QUALITY_CRITERIA.clarity.weight * 2;
  }

  // Specificity: Check for specific instructions
  maxScore += PROMPT_QUALITY_CRITERIA.specificity.weight * 10;
  const specificKeywords = ['analyze', 'identify', 'validate', 'generate', 'review'];
  const hasSpecificKeywords = specificKeywords.some((kw) => prompt.task.toLowerCase().includes(kw));
  if (hasSpecificKeywords) {
    score += PROMPT_QUALITY_CRITERIA.specificity.weight * 10;
  }

  // Structure: Check for organized sections
  maxScore += PROMPT_QUALITY_CRITERIA.structure.weight * 10;
  if (prompt.role && prompt.task) {
    score += PROMPT_QUALITY_CRITERIA.structure.weight * 10;
  }

  // Examples: Check for example indicators
  maxScore += PROMPT_QUALITY_CRITERIA.examples.weight * 10;
  if (prompt.approach && /example|e\.g\.|for instance/i.test(prompt.approach)) {
    score += PROMPT_QUALITY_CRITERIA.examples.weight * 10;
  }

  // Context: Check for sufficient context
  maxScore += PROMPT_QUALITY_CRITERIA.context.weight * 10;
  if (prompt.approach && prompt.approach.length > 100) {
    score += PROMPT_QUALITY_CRITERIA.context.weight * 10;
  }

  return Math.round((score / maxScore) * 100);
}

/**
 * Determine quality rating from score
 * @pure
 * @param {number} score - Quality score (0-100)
 * @returns {string} Quality rating
 */
export function determineQualityRating(score) {
  if (score >= QUALITY_THRESHOLDS.excellent) return 'excellent';
  if (score >= QUALITY_THRESHOLDS.good) return 'good';
  if (score >= QUALITY_THRESHOLDS.needsImprovement) return 'needs-improvement';
  return 'poor';
}

/**
 * Identify improvement opportunities
 * @pure
 * @param {Object} prompt - Prompt content
 * @param {number} score - Quality score
 * @returns {Array<Object>} List of improvement opportunities
 */
export function identifyImprovements(prompt, _score) {
  const opportunities = [];

  if (!prompt.role || prompt.role.length < 20) {
    opportunities.push({
      category: 'clarity',
      severity: 'high',
      issue: 'Role definition is missing or too brief',
      suggestion: 'Add a detailed role description (at least 20 characters)',
    });
  }

  if (!prompt.task || prompt.task.length < 50) {
    opportunities.push({
      category: 'specificity',
      severity: 'high',
      issue: 'Task description is missing or too brief',
      suggestion: 'Add specific, actionable task instructions (at least 50 characters)',
    });
  }

  const specificKeywords = ['analyze', 'identify', 'validate', 'generate', 'review'];
  const hasSpecificKeywords = specificKeywords.some((kw) => prompt.task.toLowerCase().includes(kw));
  if (!hasSpecificKeywords) {
    opportunities.push({
      category: 'specificity',
      severity: 'medium',
      issue: 'Task lacks action verbs',
      suggestion: 'Use specific action verbs: analyze, identify, validate, generate, review',
    });
  }

  if (!prompt.approach || prompt.approach.length < 100) {
    opportunities.push({
      category: 'context',
      severity: 'medium',
      issue: 'Approach section is missing or too brief',
      suggestion: 'Add detailed approach guidelines (at least 100 characters)',
    });
  }

  if (prompt.approach && !/example|e\.g\.|for instance/i.test(prompt.approach)) {
    opportunities.push({
      category: 'examples',
      severity: 'low',
      issue: 'No examples provided',
      suggestion: 'Include examples to clarify expected outputs',
    });
  }

  return opportunities;
}

/**
 * Calculate aggregate statistics
 * @pure
 * @param {Array<Object>} analyses - List of prompt analyses
 * @returns {Object} Aggregate statistics
 */
export function calculateAggregateStats(analyses) {
  if (analyses.length === 0) {
    return {
      totalPrompts: 0,
      averageScore: 0,
      excellentCount: 0,
      goodCount: 0,
      needsImprovementCount: 0,
      poorCount: 0,
      totalImprovements: 0,
    };
  }

  const stats = {
    totalPrompts: analyses.length,
    averageScore: 0,
    excellentCount: 0,
    goodCount: 0,
    needsImprovementCount: 0,
    poorCount: 0,
    totalImprovements: 0,
  };

  let totalScore = 0;

  analyses.forEach((analysis) => {
    totalScore += analysis.score;
    stats.totalImprovements += analysis.improvements.length;

    switch (analysis.rating) {
      case 'excellent':
        stats.excellentCount++;
        break;
      case 'good':
        stats.goodCount++;
        break;
      case 'needs-improvement':
        stats.needsImprovementCount++;
        break;
      case 'poor':
        stats.poorCount++;
        break;
    }
  });

  stats.averageScore = Math.round(totalScore / analyses.length);

  return stats;
}

// ============================================================================
// PURE FUNCTIONS - Report Generation
// ============================================================================

/**
 * Format prompt analysis report
 * @pure
 * @param {Object} data - Report data
 * @returns {string} Formatted markdown report
 */
export function formatAnalysisReport(data) {
  const { stats, analyses } = data;

  const sections = [];

  sections.push('### Prompt Engineer Analysis Report\n');
  sections.push(`**Total Prompts Analyzed:** ${stats.totalPrompts}`);
  sections.push(`**Average Quality Score:** ${stats.averageScore}/100`);
  sections.push(`**Total Improvement Opportunities:** ${stats.totalImprovements}\n`);

  sections.push('### Quality Distribution\n');
  sections.push(`- ✅ Excellent: ${stats.excellentCount}`);
  sections.push(`- ✅ Good: ${stats.goodCount}`);
  sections.push(`- ⚠️ Needs Improvement: ${stats.needsImprovementCount}`);
  sections.push(`- ❌ Poor: ${stats.poorCount}\n`);

  if (stats.totalImprovements > 0) {
    sections.push('### Prompts Needing Attention\n');

    analyses
      .filter((a) => a.improvements.length > 0)
      .sort((a, b) => b.improvements.length - a.improvements.length)
      .slice(0, 10)
      .forEach((analysis) => {
        sections.push(
          `- **${analysis.personaName}**: ${analysis.score}/100 (${analysis.improvements.length} improvement(s))`
        );
      });

    if (analyses.filter((a) => a.improvements.length > 0).length > 10) {
      sections.push(
        `- ... and ${analyses.filter((a) => a.improvements.length > 0).length - 10} more\n`
      );
    } else {
      sections.push('');
    }
  }

  return sections.join('\n');
}

// ============================================================================
// IMPURE WRAPPER CLASS - Step14PromptEngineer
// ============================================================================

export class Step14PromptEngineer {
  static stepKind = STEP_KIND.CONTEXT;

  constructor(options = {}) {
    this.fileOps = options.fileOps || null;
    this.backlogManager = options.backlogManager || null;
    this.logger = options.logger || console;
    this.dryRun = options.dryRun || false;
    this.configPath = options.configPath || '.workflow_core/config/ai_helpers.yaml';
    this.aiHelper = options.aiHelper || new AiHelper();
    this.aiCache = options.aiCache || new AiCache();
  }

  /**
   * Execute prompt engineering analysis
   * @param {Object} context - Workflow context
   * @returns {Promise<Object>} Analysis results
   */
  async execute(context = {}) {
    this.logger.step('Step 14: Prompt Engineer Analysis');

    if (this.dryRun) {
      return this._executeDryRun();
    }

    try {
      // Phase 1: Check if step should run
      const projectType = context.projectType || context.config?.projectType;

      if (!shouldRunPromptAnalysis(projectType)) {
        return this._handleSkipped(projectType);
      }

      // Phase 2: Load AI helpers configuration
      const yamlContent = await this._loadConfiguration();

      if (!yamlContent) {
        return this._handleConfigNotFound();
      }

      // Phase 3: Extract and analyze prompts
      const personaNames = extractPersonaNames(yamlContent);

      if (personaNames.length === 0) {
        return this._handleNoPrompts();
      }

      this.logger.info(`Found ${personaNames.length} AI personas to analyze`);

      const analyses = await this._analyzePrompts(yamlContent, personaNames);

      // Phase 4: Calculate statistics
      const stats = calculateAggregateStats(analyses);

      // Phase 5: Generate report
      return this._generateReport(stats, analyses);
    } catch (error) {
      this.logger.error(`Prompt analysis failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Execute dry-run mode
   * @private
   */
  async _executeDryRun() {
    this.logger.info('[DRY RUN] Prompt engineering analysis preview:');
    this.logger.info('  - Would check project type');
    this.logger.info('  - Would load AI helpers configuration');
    this.logger.info('  - Would analyze prompt quality');
    this.logger.info('  - Would identify improvements');

    if (this.backlogManager) {
      await this.backlogManager.saveStepSummary(
        '14',
        'Prompt_Engineer_Analysis',
        'Dry run mode - no analysis performed.',
        '✅'
      );
    }

    return {
      success: true,
      dryRun: true,
      message: 'Dry run completed',
    };
  }

  /**
   * Handle case when step should be skipped
   * @private
   */
  async _handleSkipped(projectType) {
    this.logger.info(`Project type: ${projectType || 'unknown'} - analysis skipped`);
    this.logger.info('This step only runs on workflow automation projects');

    if (this.backlogManager) {
      await this.backlogManager.saveStepSummary(
        '14',
        'Prompt_Engineer_Analysis',
        `Skipped - project type ${projectType || 'unknown'} not eligible for prompt analysis.`,
        '✅'
      );
    }

    return {
      success: true,
      skipped: true,
      reason: 'project type not eligible',
    };
  }

  /**
   * Load AI helpers configuration
   * @private
   */
  async _loadConfiguration() {
    try {
      if (!this.fileOps) {
        this.logger.warn('No file operations available');
        return null;
      }

      const content = await this.fileOps.readFile(this.configPath);
      return content;
    } catch {
      return null;
    }
  }

  /**
   * Handle case when configuration not found
   * @private
   */
  async _handleConfigNotFound() {
    this.logger.warn(`Configuration not found: ${this.configPath}`);

    if (this.backlogManager) {
      await this.backlogManager.saveStepSummary(
        '14',
        'Prompt_Engineer_Analysis',
        `Skipped - configuration file not found: ${this.configPath}`,
        '⚠️'
      );
    }

    return {
      success: true,
      skipped: true,
      reason: 'configuration not found',
    };
  }

  /**
   * Handle case when no prompts found
   * @private
   */
  async _handleNoPrompts() {
    this.logger.info('No AI persona prompts found');

    if (this.backlogManager) {
      await this.backlogManager.saveStepSummary(
        '14',
        'Prompt_Engineer_Analysis',
        'No AI persona prompts found to analyze.',
        '✅'
      );
    }

    return {
      success: true,
      noPrompts: true,
      message: 'No prompts to analyze',
    };
  }

  /**
   * Analyze all prompts
   * @private
   */
  async _analyzePrompts(yamlContent, personaNames) {
    const analyses = [];

    for (const personaName of personaNames) {
      const prompt = extractPromptContent(yamlContent, personaName);

      if (!prompt) {
        this.logger.warn(`Could not extract prompt for: ${personaName}`);
        continue;
      }

      const score = calculatePromptQuality(prompt);
      const rating = determineQualityRating(score);
      const improvements = identifyImprovements(prompt, score);

      analyses.push({
        personaName,
        prompt,
        score,
        rating,
        improvements,
      });

      this.logger.info(`  ${personaName}: ${score}/100 (${rating})`);
    }

    return analyses;
  }

  /**
   * Generate final report
   * @private
   */
  async _generateReport(stats, analyses) {
    const reportData = { stats, analyses };
    const report = formatAnalysisReport(reportData);

    if (this.backlogManager) {
      await this.backlogManager.saveStepIssues('14', 'Prompt_Engineer_Analysis', report);

      const summary = `Analyzed ${stats.totalPrompts} AI personas. Average score: ${stats.averageScore}/100. ${stats.totalImprovements} improvement(s) identified.`;

      const statusEmoji =
        stats.averageScore >= QUALITY_THRESHOLDS.excellent
          ? '✅'
          : stats.averageScore >= QUALITY_THRESHOLDS.good
            ? '✅'
            : '⚠️';

      await this.backlogManager.saveStepSummary(
        '14',
        'Prompt_Engineer_Analysis',
        summary,
        statusEmoji
      );
    }

    // Phase AI: AI-powered prompt quality improvement suggestions
    const aiAvailable = await this.aiHelper.initialize();
    if (aiAvailable) {
      await this.aiCache.init();
      let prompt;
      try {
        const yamlContent =
          (await this.fileOps?.readFile(AI_HELPERS_PATH)) ??
          (await import('fs').then((m) => m.promises.readFile(AI_HELPERS_PATH, 'utf-8')));
        const parsedYaml = yaml.load(yamlContent);
        prompt = buildYamlStepPrompt(parsedYaml, 'step13_prompt_engineer_prompt', {
          total_prompts: String(stats.totalPrompts),
          average_score: String(stats.averageScore),
          total_improvements: String(stats.totalImprovements),
          below_threshold: String(stats.belowThreshold ?? 0),
        });
      } catch {
        /* fallback to generic prompt */
      }
      if (!prompt) {
        const role = `You are an expert prompt engineer specializing in LLM system prompt optimization.`;
        const task = `Analyze these AI persona prompt quality metrics:
- Total prompts analyzed: ${stats.totalPrompts}
- Average quality score: ${stats.averageScore}/100
- Total improvements identified: ${stats.totalImprovements}
- Prompts below threshold: ${stats.belowThreshold ?? 0}`;
        const approach = `Suggest the highest-impact structural improvements for AI system prompts. Be concise and specific.`;
        prompt = injectProjectContext(buildStructuredPrompt({ role, task, approach }), {});
      }
      const cacheKey = `step_14|${stats.totalPrompts}|${stats.averageScore}`;
      const aiResult = await this.aiCache.withCache(prompt, cacheKey, () =>
        this.aiHelper.executeRequest(prompt, { persona: 'prompt_engineer' })
      );
      const aiContent = aiResult?.content ?? '';
      if (aiContent && this.backlogManager) {
        const statusEmoji =
          stats.averageScore >= QUALITY_THRESHOLDS.excellent
            ? '✅'
            : stats.averageScore >= QUALITY_THRESHOLDS.good
              ? '✅'
              : '⚠️';
        const enrichedReport = `${report}\n\n---\n\n## AI Recommendations\n\n${aiContent}`;
        await this.backlogManager.saveStepSummary(
          '14',
          'Prompt_Engineer_Analysis',
          enrichedReport,
          statusEmoji
        );
      }
    } else {
      this.logger.warn('AI helper not available - skipping AI analysis');
    }

    return {
      success: true,
      stats,
      analyses,
      report,
    };
  }
}
