/**
 * Step 02_5 Submodule: AI Analyzer
 * Purpose: AI-powered edge case analysis for borderline redundancy
 * Version: 2.0.0
 * Architecture: Referential transparency (pure functions + impure wrapper)
 */

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Confidence thresholds for edge case detection
 */
export const CONFIDENCE_THRESHOLDS = {
  LOW: 0.5, // Below this: not redundant
  EDGE_CASE_MIN: 0.5, // Above this: potential edge case
  EDGE_CASE_MAX: 0.9, // Below this: edge case, above: clearly redundant
  HIGH: 0.9, // Above this: definitely redundant
};

/**
 * AI analysis result types
 */
export const ANALYSIS_RESULT = {
  DEFINITELY_REDUNDANT: 'definitely_redundant',
  LIKELY_REDUNDANT: 'likely_redundant',
  POSSIBLY_REDUNDANT: 'possibly_redundant',
  NOT_REDUNDANT: 'not_redundant',
  UNKNOWN: 'unknown',
};

/**
 * Confidence boost values based on AI analysis
 */
export const CONFIDENCE_BOOST = {
  definitely_redundant: 0.15,
  likely_redundant: 0.1,
  possibly_redundant: 0.05,
  not_redundant: -0.1,
  unknown: 0,
};

// ============================================================================
// PURE FUNCTIONS - Edge Case Detection
// ============================================================================

/**
 * Determine if a similarity score is an edge case
 * @param {number} similarity - Similarity score (0-1)
 * @returns {boolean} - True if edge case
 */
export function isEdgeCase(similarity) {
  return (
    similarity >= CONFIDENCE_THRESHOLDS.EDGE_CASE_MIN &&
    similarity < CONFIDENCE_THRESHOLDS.EDGE_CASE_MAX
  );
}

/**
 * Filter pairs to find edge cases
 * @param {Array<Object>} pairs - Array of {file1, file2, similarity}
 * @returns {Array<Object>} - Edge case pairs only
 */
export function filterEdgeCases(pairs) {
  return pairs.filter((p) => isEdgeCase(p.similarity));
}

/**
 * Count edge cases in pairs
 * @param {Array<Object>} pairs - Array of pairs
 * @returns {number} - Count of edge cases
 */
export function countEdgeCases(pairs) {
  return filterEdgeCases(pairs).length;
}

// ============================================================================
// PURE FUNCTIONS - AI Prompt Building
// ============================================================================

/**
 * Build AI prompt for redundancy analysis
 * @param {string} file1Path - First file path
 * @param {string} file1Content - First file content (first 500 chars)
 * @param {string} file2Path - Second file path
 * @param {string} file2Content - Second file content (first 500 chars)
 * @param {number} similarity - Current similarity score
 * @returns {string} - AI prompt
 */
export function buildRedundancyPrompt(
  file1Path,
  file1Content,
  file2Path,
  file2Content,
  similarity
) {
  return `Analyze these two documentation files for redundancy:

**File 1:** ${file1Path}
\`\`\`
${file1Content}
\`\`\`

**File 2:** ${file2Path}
\`\`\`
${file2Content}
\`\`\`

**Current Similarity Score:** ${Math.round(similarity * 100)}%

Are these files redundant? Consider:
- Do they serve different purposes?
- Is one an update/replacement of the other?
- Could they be consolidated without losing information?

Reply with ONE of:
- DEFINITELY_REDUNDANT: Yes, clearly redundant
- LIKELY_REDUNDANT: Probably redundant
- POSSIBLY_REDUNDANT: Maybe redundant, unclear
- NOT_REDUNDANT: No, they serve different purposes`;
}

// ============================================================================
// PURE FUNCTIONS - AI Response Parsing
// ============================================================================

/**
 * Parse AI response to extract analysis result
 * @param {string} response - AI response text
 * @returns {string} - One of ANALYSIS_RESULT values
 */
export function parseAiResponse(response) {
  if (!response || typeof response !== 'string') {
    return ANALYSIS_RESULT.UNKNOWN;
  }

  const upperResponse = response.toUpperCase();

  if (
    upperResponse.includes('DEFINITELY_REDUNDANT') ||
    upperResponse.includes('DEFINITELY REDUNDANT')
  ) {
    return ANALYSIS_RESULT.DEFINITELY_REDUNDANT;
  }

  if (upperResponse.includes('LIKELY_REDUNDANT') || upperResponse.includes('LIKELY REDUNDANT')) {
    return ANALYSIS_RESULT.LIKELY_REDUNDANT;
  }

  if (
    upperResponse.includes('POSSIBLY_REDUNDANT') ||
    upperResponse.includes('POSSIBLY REDUNDANT')
  ) {
    return ANALYSIS_RESULT.POSSIBLY_REDUNDANT;
  }

  if (upperResponse.includes('NOT_REDUNDANT') || upperResponse.includes('NOT REDUNDANT')) {
    return ANALYSIS_RESULT.NOT_REDUNDANT;
  }

  return ANALYSIS_RESULT.UNKNOWN;
}

/**
 * Calculate confidence boost based on AI analysis
 * @param {string} analysisResult - One of ANALYSIS_RESULT values
 * @returns {number} - Confidence boost (-0.1 to 0.15)
 */
export function calculateConfidenceBoost(analysisResult) {
  return CONFIDENCE_BOOST[analysisResult] !== undefined ? CONFIDENCE_BOOST[analysisResult] : 0;
}

/**
 * Apply AI analysis to update confidence score
 * @param {number} originalScore - Original similarity score
 * @param {string} analysisResult - AI analysis result
 * @returns {number} - Updated confidence score (0-1)
 */
export function applyAiAnalysis(originalScore, analysisResult) {
  const boost = calculateConfidenceBoost(analysisResult);
  const updated = originalScore + boost;
  // Clamp to 0-1 range
  return Math.max(0, Math.min(1, updated));
}

// ============================================================================
// PURE FUNCTIONS - Summary Generation
// ============================================================================

/**
 * Generate edge case analysis summary
 * @param {Array<Object>} results - Array of {pair, analysis, updatedScore}
 * @returns {Object} - Summary statistics
 */
export function generateAnalysisSummary(results) {
  const summary = {
    total: results.length,
    analyzed: 0,
    promoted: 0, // Edge cases promoted to definitely redundant
    demoted: 0, // Edge cases demoted to not redundant
    unchanged: 0, // Unchanged confidence
    errors: 0,
  };

  for (const result of results) {
    if (result.error) {
      summary.errors++;
      continue;
    }

    summary.analyzed++;

    if (result.updatedScore >= CONFIDENCE_THRESHOLDS.HIGH) {
      summary.promoted++;
    } else if (result.updatedScore < CONFIDENCE_THRESHOLDS.EDGE_CASE_MIN) {
      summary.demoted++;
    } else {
      summary.unchanged++;
    }
  }

  return summary;
}

// ============================================================================
// AI ANALYZER - Impure Wrapper Class
// ============================================================================

/**
 * AI analyzer for edge case redundancy detection
 * Uses AI to analyze borderline cases
 */
export class AiAnalyzer {
  constructor(options = {}) {
    this.aiHelper = options.aiHelper; // AiHelper instance
    this.fileOps = options.fileOps; // FileOperations instance
    this.maxContentLength = options.maxContentLength || 500;
    this.logger = options.logger || console;
  }

  /**
   * Truncate content for AI analysis
   * @param {string} content - Full content
   * @returns {string} - Truncated content
   */
  truncateContent(content) {
    if (content.length <= this.maxContentLength) {
      return content;
    }
    return content.substring(0, this.maxContentLength) + '\n... (truncated)';
  }

  /**
   * Analyze a single edge case pair with AI
   * @param {Object} pair - {file1, file2, similarity}
   * @returns {Promise<Object>} - {pair, analysis, updatedScore, error?}
   */
  async analyzeEdgeCase(pair) {
    try {
      // Read file contents
      const content1 = await this.fileOps.readFile(pair.file1);
      const content2 = await this.fileOps.readFile(pair.file2);

      // Truncate for AI analysis
      const truncated1 = this.truncateContent(content1);
      const truncated2 = this.truncateContent(content2);

      // Build prompt
      const prompt = buildRedundancyPrompt(
        pair.file1,
        truncated1,
        pair.file2,
        truncated2,
        pair.similarity
      );

      // Call AI
      this.logger.info(`Analyzing edge case: ${pair.file1} ↔ ${pair.file2}`);
      const response = await this.aiHelper.query(prompt);

      // Parse response
      const analysis = parseAiResponse(response);
      const updatedScore = applyAiAnalysis(pair.similarity, analysis);

      return {
        pair,
        analysis,
        updatedScore,
        originalScore: pair.similarity,
      };
    } catch (error) {
      this.logger.warn(`Failed to analyze edge case: ${error.message}`);
      return {
        pair,
        error: error.message,
        originalScore: pair.similarity,
      };
    }
  }

  /**
   * Analyze all edge cases in pairs
   * @param {Array<Object>} pairs - Array of {file1, file2, similarity}
   * @returns {Promise<Object>} - {results, summary}
   */
  async analyzeEdgeCases(pairs) {
    const edgeCases = filterEdgeCases(pairs);

    if (edgeCases.length === 0) {
      this.logger.info('No edge cases found');
      return {
        results: [],
        summary: { total: 0, analyzed: 0, promoted: 0, demoted: 0, unchanged: 0, errors: 0 },
      };
    }

    this.logger.info(`Analyzing ${edgeCases.length} edge cases with AI...`);

    const results = [];
    for (const pair of edgeCases) {
      const result = await this.analyzeEdgeCase(pair);
      results.push(result);
    }

    const summary = generateAnalysisSummary(results);
    this.logger.info(
      `AI analysis complete: ${summary.analyzed}/${summary.total} analyzed, ${summary.promoted} promoted, ${summary.demoted} demoted`
    );

    return { results, summary };
  }

  /**
   * Generate analysis report
   * @param {Object} analysisData - {results, summary}
   * @returns {string} - Formatted report
   */
  formatAnalysisReport(analysisData) {
    const { results, summary } = analysisData;

    let report = `\n=== AI Edge Case Analysis ===\n`;
    report += `Total edge cases: ${summary.total}\n`;
    report += `Successfully analyzed: ${summary.analyzed}\n`;
    report += `Promoted to redundant: ${summary.promoted}\n`;
    report += `Demoted to not redundant: ${summary.demoted}\n`;
    report += `Unchanged: ${summary.unchanged}\n`;
    if (summary.errors > 0) {
      report += `Errors: ${summary.errors}\n`;
    }

    if (results.length > 0) {
      report += `\nDetailed Results:\n`;
      for (const result of results.slice(0, 10)) {
        if (result.error) {
          report += `  ❌ ${result.pair.file1} ↔ ${result.pair.file2}: Error\n`;
        } else {
          const delta = result.updatedScore - result.originalScore;
          const arrow = delta > 0 ? '↑' : delta < 0 ? '↓' : '→';
          report += `  ${arrow} ${result.pair.file1} ↔ ${result.pair.file2}: ${Math.round(result.originalScore * 100)}% → ${Math.round(result.updatedScore * 100)}% (${result.analysis})\n`;
        }
      }
      if (results.length > 10) {
        report += `  ... and ${results.length - 10} more\n`;
      }
    }

    return report;
  }
}
