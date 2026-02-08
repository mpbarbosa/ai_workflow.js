/**
 * Tests for Step 02_5 AI Analyzer Module
 */

import { jest } from '@jest/globals';
import {
  CONFIDENCE_THRESHOLDS,
  ANALYSIS_RESULT,
  isEdgeCase,
  filterEdgeCases,
  countEdgeCases,
  buildRedundancyPrompt,
  parseAiResponse,
  calculateConfidenceBoost,
  applyAiAnalysis,
  generateAnalysisSummary,
  AiAnalyzer,
} from '../../../src/steps/step_02_5_lib/ai_analyzer.js';

describe('AI Analyzer Module - Pure Functions', () => {
  describe('isEdgeCase', () => {
    test('returns false for low similarity', () => {
      expect(isEdgeCase(0.4)).toBe(false);
      expect(isEdgeCase(0.49)).toBe(false);
    });

    test('returns true for edge case range', () => {
      expect(isEdgeCase(0.5)).toBe(true);
      expect(isEdgeCase(0.7)).toBe(true);
      expect(isEdgeCase(0.89)).toBe(true);
    });

    test('returns false for high similarity', () => {
      expect(isEdgeCase(0.9)).toBe(false);
      expect(isEdgeCase(0.95)).toBe(false);
      expect(isEdgeCase(1.0)).toBe(false);
    });

    test('handles boundary conditions', () => {
      expect(isEdgeCase(CONFIDENCE_THRESHOLDS.EDGE_CASE_MIN)).toBe(true);
      expect(isEdgeCase(CONFIDENCE_THRESHOLDS.EDGE_CASE_MAX)).toBe(false);
    });
  });

  describe('filterEdgeCases', () => {
    test('filters only edge cases', () => {
      const pairs = [
        { file1: 'a.md', file2: 'b.md', similarity: 0.4 },
        { file1: 'c.md', file2: 'd.md', similarity: 0.7 },
        { file1: 'e.md', file2: 'f.md', similarity: 0.95 },
        { file1: 'g.md', file2: 'h.md', similarity: 0.85 },
      ];

      const edgeCases = filterEdgeCases(pairs);

      expect(edgeCases).toHaveLength(2);
      expect(edgeCases[0].similarity).toBe(0.7);
      expect(edgeCases[1].similarity).toBe(0.85);
    });

    test('returns empty array when no edge cases', () => {
      const pairs = [
        { file1: 'a.md', file2: 'b.md', similarity: 0.3 },
        { file1: 'c.md', file2: 'd.md', similarity: 0.95 },
      ];

      expect(filterEdgeCases(pairs)).toEqual([]);
    });

    test('handles empty array', () => {
      expect(filterEdgeCases([])).toEqual([]);
    });
  });

  describe('countEdgeCases', () => {
    test('counts edge cases correctly', () => {
      const pairs = [
        { file1: 'a.md', file2: 'b.md', similarity: 0.4 },
        { file1: 'c.md', file2: 'd.md', similarity: 0.7 },
        { file1: 'e.md', file2: 'f.md', similarity: 0.85 },
      ];

      expect(countEdgeCases(pairs)).toBe(2);
    });

    test('returns 0 for no edge cases', () => {
      const pairs = [{ file1: 'a.md', file2: 'b.md', similarity: 0.95 }];
      expect(countEdgeCases(pairs)).toBe(0);
    });
  });

  describe('buildRedundancyPrompt', () => {
    test('includes all required information', () => {
      const prompt = buildRedundancyPrompt(
        'docs/a.md',
        'Content A',
        'docs/b.md',
        'Content B',
        0.75
      );

      expect(prompt).toContain('docs/a.md');
      expect(prompt).toContain('Content A');
      expect(prompt).toContain('docs/b.md');
      expect(prompt).toContain('Content B');
      expect(prompt).toContain('75%');
      expect(prompt).toContain('DEFINITELY_REDUNDANT');
      expect(prompt).toContain('NOT_REDUNDANT');
    });

    test('formats content in code blocks', () => {
      const prompt = buildRedundancyPrompt('a.md', 'Content', 'b.md', 'Content', 0.5);
      expect(prompt).toContain('```');
    });

    test('rounds similarity to integer percentage', () => {
      const prompt = buildRedundancyPrompt('a.md', 'A', 'b.md', 'B', 0.876);
      expect(prompt).toContain('88%');
    });
  });

  describe('parseAiResponse', () => {
    test('parses DEFINITELY_REDUNDANT', () => {
      expect(parseAiResponse('DEFINITELY_REDUNDANT')).toBe(ANALYSIS_RESULT.DEFINITELY_REDUNDANT);
      expect(parseAiResponse('These are definitely redundant files')).toBe(
        ANALYSIS_RESULT.DEFINITELY_REDUNDANT
      );
      expect(parseAiResponse('definitely redundant')).toBe(ANALYSIS_RESULT.DEFINITELY_REDUNDANT);
    });

    test('parses LIKELY_REDUNDANT', () => {
      expect(parseAiResponse('LIKELY_REDUNDANT')).toBe(ANALYSIS_RESULT.LIKELY_REDUNDANT);
      expect(parseAiResponse('These are likely redundant')).toBe(ANALYSIS_RESULT.LIKELY_REDUNDANT);
    });

    test('parses POSSIBLY_REDUNDANT', () => {
      expect(parseAiResponse('POSSIBLY_REDUNDANT')).toBe(ANALYSIS_RESULT.POSSIBLY_REDUNDANT);
      expect(parseAiResponse('possibly redundant')).toBe(ANALYSIS_RESULT.POSSIBLY_REDUNDANT);
    });

    test('parses NOT_REDUNDANT', () => {
      expect(parseAiResponse('NOT_REDUNDANT')).toBe(ANALYSIS_RESULT.NOT_REDUNDANT);
      expect(parseAiResponse('These are not redundant at all')).toBe(ANALYSIS_RESULT.NOT_REDUNDANT);
    });

    test('returns UNKNOWN for ambiguous responses', () => {
      expect(parseAiResponse('I am not sure about this')).toBe(ANALYSIS_RESULT.UNKNOWN);
      expect(parseAiResponse('Maybe they are similar')).toBe(ANALYSIS_RESULT.UNKNOWN);
    });

    test('handles null/undefined/invalid input', () => {
      expect(parseAiResponse(null)).toBe(ANALYSIS_RESULT.UNKNOWN);
      expect(parseAiResponse(undefined)).toBe(ANALYSIS_RESULT.UNKNOWN);
      expect(parseAiResponse('')).toBe(ANALYSIS_RESULT.UNKNOWN);
      expect(parseAiResponse(123)).toBe(ANALYSIS_RESULT.UNKNOWN);
    });

    test('is case insensitive', () => {
      expect(parseAiResponse('definitely_redundant')).toBe(ANALYSIS_RESULT.DEFINITELY_REDUNDANT);
      expect(parseAiResponse('LIKELY_REDUNDANT')).toBe(ANALYSIS_RESULT.LIKELY_REDUNDANT);
      expect(parseAiResponse('Not Redundant')).toBe(ANALYSIS_RESULT.NOT_REDUNDANT);
    });
  });

  describe('calculateConfidenceBoost', () => {
    test('returns correct boost for each result type', () => {
      expect(calculateConfidenceBoost(ANALYSIS_RESULT.DEFINITELY_REDUNDANT)).toBe(0.15);
      expect(calculateConfidenceBoost(ANALYSIS_RESULT.LIKELY_REDUNDANT)).toBe(0.1);
      expect(calculateConfidenceBoost(ANALYSIS_RESULT.POSSIBLY_REDUNDANT)).toBe(0.05);
      expect(calculateConfidenceBoost(ANALYSIS_RESULT.NOT_REDUNDANT)).toBe(-0.1);
      expect(calculateConfidenceBoost(ANALYSIS_RESULT.UNKNOWN)).toBe(0);
    });

    test('returns 0 for invalid result', () => {
      expect(calculateConfidenceBoost('invalid')).toBe(0);
      expect(calculateConfidenceBoost(null)).toBe(0);
    });
  });

  describe('applyAiAnalysis', () => {
    test('applies positive boost correctly', () => {
      const result = applyAiAnalysis(0.7, ANALYSIS_RESULT.DEFINITELY_REDUNDANT);
      expect(result).toBe(0.85); // 0.7 + 0.15
    });

    test('applies negative boost correctly', () => {
      const result = applyAiAnalysis(0.6, ANALYSIS_RESULT.NOT_REDUNDANT);
      expect(result).toBe(0.5); // 0.6 - 0.1
    });

    test('clamps result to 0-1 range (upper bound)', () => {
      const result = applyAiAnalysis(0.95, ANALYSIS_RESULT.DEFINITELY_REDUNDANT);
      expect(result).toBe(1.0); // Clamped from 1.1
    });

    test('clamps result to 0-1 range (lower bound)', () => {
      const result = applyAiAnalysis(0.05, ANALYSIS_RESULT.NOT_REDUNDANT);
      expect(result).toBe(0.0); // 0.05 + (-0.1) = -0.05 → clamped to 0
    });

    test('handles unknown analysis', () => {
      const result = applyAiAnalysis(0.7, ANALYSIS_RESULT.UNKNOWN);
      expect(result).toBe(0.7); // No change
    });
  });

  describe('generateAnalysisSummary', () => {
    test('generates complete summary', () => {
      const results = [
        { pair: {}, updatedScore: 0.92, originalScore: 0.75 }, // Promoted
        { pair: {}, updatedScore: 0.45, originalScore: 0.6 }, // Demoted
        { pair: {}, updatedScore: 0.75, originalScore: 0.7 }, // Unchanged
        { pair: {}, error: 'Failed' }, // Error
      ];

      const summary = generateAnalysisSummary(results);

      expect(summary.total).toBe(4);
      expect(summary.analyzed).toBe(3);
      expect(summary.promoted).toBe(1);
      expect(summary.demoted).toBe(1);
      expect(summary.unchanged).toBe(1);
      expect(summary.errors).toBe(1);
    });

    test('handles all promoted cases', () => {
      const results = [
        { pair: {}, updatedScore: 0.95, originalScore: 0.8 },
        { pair: {}, updatedScore: 0.92, originalScore: 0.75 },
      ];

      const summary = generateAnalysisSummary(results);

      expect(summary.promoted).toBe(2);
      expect(summary.demoted).toBe(0);
      expect(summary.unchanged).toBe(0);
    });

    test('handles all demoted cases', () => {
      const results = [
        { pair: {}, updatedScore: 0.4, originalScore: 0.6 },
        { pair: {}, updatedScore: 0.3, originalScore: 0.5 },
      ];

      const summary = generateAnalysisSummary(results);

      expect(summary.promoted).toBe(0);
      expect(summary.demoted).toBe(2);
      expect(summary.unchanged).toBe(0);
    });

    test('handles empty results', () => {
      const summary = generateAnalysisSummary([]);

      expect(summary.total).toBe(0);
      expect(summary.analyzed).toBe(0);
      expect(summary.promoted).toBe(0);
    });
  });
});

describe('AiAnalyzer - Integration', () => {
  let mockAiHelper;
  let mockFileOps;
  let analyzer;

  beforeEach(() => {
    mockAiHelper = {
      query: jest.fn(),
    };

    mockFileOps = {
      readFile: jest.fn(),
    };

    analyzer = new AiAnalyzer({
      aiHelper: mockAiHelper,
      fileOps: mockFileOps,
      maxContentLength: 100,
      logger: { info: jest.fn(), warn: jest.fn() },
    });
  });

  describe('truncateContent', () => {
    test('returns content unchanged if within limit', () => {
      const content = 'Short content';
      expect(analyzer.truncateContent(content)).toBe('Short content');
    });

    test('truncates long content', () => {
      const content = 'A'.repeat(200);
      const truncated = analyzer.truncateContent(content);
      expect(truncated.length).toBeLessThan(content.length);
      expect(truncated).toContain('... (truncated)');
    });

    test('truncates at maxContentLength', () => {
      const content = 'A'.repeat(200);
      const truncated = analyzer.truncateContent(content);
      expect(truncated).toBe('A'.repeat(100) + '\n... (truncated)');
    });
  });

  describe('analyzeEdgeCase', () => {
    test('analyzes edge case successfully', async () => {
      const pair = { file1: 'a.md', file2: 'b.md', similarity: 0.7 };

      mockFileOps.readFile.mockResolvedValueOnce('Content A');
      mockFileOps.readFile.mockResolvedValueOnce('Content B');
      mockAiHelper.query.mockResolvedValue('DEFINITELY_REDUNDANT');

      const result = await analyzer.analyzeEdgeCase(pair);

      expect(result.pair).toBe(pair);
      expect(result.analysis).toBe(ANALYSIS_RESULT.DEFINITELY_REDUNDANT);
      expect(result.updatedScore).toBe(0.85); // 0.7 + 0.15
      expect(result.originalScore).toBe(0.7);
      expect(result.error).toBeUndefined();
    });

    test('handles file read errors', async () => {
      const pair = { file1: 'a.md', file2: 'b.md', similarity: 0.7 };

      mockFileOps.readFile.mockRejectedValue(new Error('File not found'));

      const result = await analyzer.analyzeEdgeCase(pair);

      expect(result.error).toBe('File not found');
      expect(result.analysis).toBeUndefined();
    });

    test('handles AI query errors', async () => {
      const pair = { file1: 'a.md', file2: 'b.md', similarity: 0.7 };

      mockFileOps.readFile.mockResolvedValue('Content');
      mockAiHelper.query.mockRejectedValue(new Error('AI error'));

      const result = await analyzer.analyzeEdgeCase(pair);

      expect(result.error).toBe('AI error');
    });

    test('truncates long content before AI analysis', async () => {
      const pair = { file1: 'a.md', file2: 'b.md', similarity: 0.7 };

      mockFileOps.readFile.mockResolvedValueOnce('A'.repeat(200));
      mockFileOps.readFile.mockResolvedValueOnce('B'.repeat(200));
      mockAiHelper.query.mockResolvedValue('LIKELY_REDUNDANT');

      await analyzer.analyzeEdgeCase(pair);

      const prompt = mockAiHelper.query.mock.calls[0][0];
      expect(prompt).toContain('... (truncated)');
      expect(prompt.length).toBeLessThan(1000); // Much shorter due to truncation
    });
  });

  describe('analyzeEdgeCases', () => {
    test('analyzes all edge cases', async () => {
      const pairs = [
        { file1: 'a.md', file2: 'b.md', similarity: 0.3 }, // Not edge case
        { file1: 'c.md', file2: 'd.md', similarity: 0.7 }, // Edge case
        { file1: 'e.md', file2: 'f.md', similarity: 0.85 }, // Edge case
        { file1: 'g.md', file2: 'h.md', similarity: 0.95 }, // Not edge case
      ];

      mockFileOps.readFile.mockResolvedValue('Content');
      mockAiHelper.query.mockResolvedValue('DEFINITELY_REDUNDANT');

      const { results, summary } = await analyzer.analyzeEdgeCases(pairs);

      expect(results).toHaveLength(2); // Only edge cases
      expect(summary.total).toBe(2);
      expect(mockAiHelper.query).toHaveBeenCalledTimes(2);
    });

    test('returns empty result when no edge cases', async () => {
      const pairs = [
        { file1: 'a.md', file2: 'b.md', similarity: 0.3 },
        { file1: 'c.md', file2: 'd.md', similarity: 0.95 },
      ];

      const { results, summary } = await analyzer.analyzeEdgeCases(pairs);

      expect(results).toEqual([]);
      expect(summary.total).toBe(0);
      expect(mockAiHelper.query).not.toHaveBeenCalled();
    });

    test('continues on individual errors', async () => {
      const pairs = [
        { file1: 'a.md', file2: 'b.md', similarity: 0.7 },
        { file1: 'c.md', file2: 'd.md', similarity: 0.75 },
      ];

      mockFileOps.readFile.mockResolvedValue('Content');
      mockAiHelper.query
        .mockRejectedValueOnce(new Error('AI error'))
        .mockResolvedValueOnce('LIKELY_REDUNDANT');

      const { results, summary } = await analyzer.analyzeEdgeCases(pairs);

      expect(results).toHaveLength(2);
      expect(summary.errors).toBe(1);
      expect(summary.analyzed).toBe(1);
    });
  });

  describe('formatAnalysisReport', () => {
    test('formats complete report', () => {
      const analysisData = {
        results: [
          {
            pair: { file1: 'a.md', file2: 'b.md' },
            updatedScore: 0.92,
            originalScore: 0.75,
            analysis: 'DEFINITELY_REDUNDANT',
          },
          { pair: { file1: 'c.md', file2: 'd.md' }, error: 'Failed' },
        ],
        summary: { total: 2, analyzed: 1, promoted: 1, demoted: 0, unchanged: 0, errors: 1 },
      };

      const report = analyzer.formatAnalysisReport(analysisData);

      expect(report).toContain('=== AI Edge Case Analysis ===');
      expect(report).toContain('Total edge cases: 2');
      expect(report).toContain('Successfully analyzed: 1');
      expect(report).toContain('Promoted to redundant: 1');
      expect(report).toContain('Errors: 1');
      expect(report).toContain('a.md ↔ b.md');
      expect(report).toContain('75% → 92%');
      expect(report).toContain('❌ c.md ↔ d.md: Error');
    });

    test('limits detailed results to 10', () => {
      const results = Array.from({ length: 15 }, (_, i) => ({
        pair: { file1: `file${i}.md`, file2: `copy${i}.md` },
        updatedScore: 0.8,
        originalScore: 0.7,
        analysis: 'LIKELY_REDUNDANT',
      }));

      const report = analyzer.formatAnalysisReport({
        results,
        summary: { total: 15, analyzed: 15 },
      });

      expect(report).toContain('... and 5 more');
    });

    test('shows arrows based on score change', () => {
      const analysisData = {
        results: [
          {
            pair: { file1: 'a.md', file2: 'b.md' },
            updatedScore: 0.85,
            originalScore: 0.7,
            analysis: 'promoted',
          }, // ↑
          {
            pair: { file1: 'c.md', file2: 'd.md' },
            updatedScore: 0.5,
            originalScore: 0.6,
            analysis: 'demoted',
          }, // ↓
          {
            pair: { file1: 'e.md', file2: 'f.md' },
            updatedScore: 0.7,
            originalScore: 0.7,
            analysis: 'same',
          }, // →
        ],
        summary: { total: 3, analyzed: 3, promoted: 1, demoted: 1, unchanged: 1, errors: 0 },
      };

      const report = analyzer.formatAnalysisReport(analysisData);

      expect(report).toContain('↑ a.md');
      expect(report).toContain('↓ c.md');
      expect(report).toContain('→ e.md');
    });
  });
});
