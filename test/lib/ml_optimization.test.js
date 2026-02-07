/**
 * @fileoverview Tests for ML Optimization Module
 */

import {
  extractFeatures,
  calculateSimilarity,
  predictSkippability,
  shouldTrustPrediction,
  calculateAccuracy,
  updateAccuracy,
  serializeModel,
  parseModel,
  validateModel,
  addExecutionRecord,
  filterByStep,
  getRecentRecords,
  MLOptimizer,
  DEFAULT_CONFIG,
  PREDICTION,
  SKIP_REASON,
} from '../../src/lib/ml_optimization.js';
import { FileOperations } from '../../src/lib/file_operations.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

// ============================================================================
// PURE FUNCTION TESTS - Feature Extraction
// ============================================================================

describe('Pure Functions - Feature Extraction', () => {
  describe('extractFeatures', () => {
    test('extracts features from complete context', () => {
      const context = {
        stepId: 'step1',
        changeStats: {
          changePercentage: 25.5,
          changed: 10,
          added: 3,
          modified: 5,
          deleted: 2,
          codeFiles: 4,
          docsFiles: 6,
          testFiles: 0,
        },
        previousResults: { success: true },
      };

      const features = extractFeatures(context);

      expect(features.stepId).toBe('step1');
      expect(features.changePercentage).toBe(25.5);
      expect(features.filesChanged).toBe(10);
      expect(features.filesAdded).toBe(3);
      expect(features.filesModified).toBe(5);
      expect(features.filesDeleted).toBe(2);
      expect(features.hasCodeChanges).toBe(true);
      expect(features.hasDocsChanges).toBe(true);
      expect(features.hasTestChanges).toBe(false);
      expect(features.previousStepSuccess).toBe(true);
    });

    test('handles missing context fields', () => {
      const features = extractFeatures({});

      expect(features.stepId).toBe('');
      expect(features.changePercentage).toBe(0);
      expect(features.filesChanged).toBe(0);
      expect(features.hasCodeChanges).toBe(false);
      expect(features.previousStepSuccess).toBe(true); // Default
    });

    test('handles partial change stats', () => {
      const context = {
        changeStats: { changed: 5 },
      };

      const features = extractFeatures(context);

      expect(features.filesChanged).toBe(5);
      expect(features.changePercentage).toBe(0);
      expect(features.filesAdded).toBe(0);
    });
  });

  describe('calculateSimilarity', () => {
    test('returns 1.0 for identical features', () => {
      const features = {
        changePercentage: 50,
        filesChanged: 10,
        filesAdded: 3,
        filesModified: 5,
        filesDeleted: 2,
        hasCodeChanges: true,
        hasDocsChanges: false,
        hasTestChanges: true,
      };

      expect(calculateSimilarity(features, features)).toBeCloseTo(1.0, 1);
    });

    test('returns 0.0 for completely different features', () => {
      const features1 = {
        changePercentage: 0,
        filesChanged: 0,
        filesAdded: 0,
        filesModified: 0,
        filesDeleted: 0,
        hasCodeChanges: false,
        hasDocsChanges: false,
        hasTestChanges: false,
      };

      const features2 = {
        changePercentage: 100,
        filesChanged: 100,
        filesAdded: 50,
        filesModified: 30,
        filesDeleted: 20,
        hasCodeChanges: true,
        hasDocsChanges: true,
        hasTestChanges: true,
      };

      const similarity = calculateSimilarity(features1, features2);
      expect(similarity).toBeLessThan(0.3);
    });

    test('returns intermediate values for similar features', () => {
      const features1 = {
        changePercentage: 50,
        filesChanged: 10,
        filesAdded: 3,
        filesModified: 5,
        filesDeleted: 2,
        hasCodeChanges: true,
        hasDocsChanges: false,
        hasTestChanges: true,
      };

      const features2 = {
        changePercentage: 55,
        filesChanged: 11,
        filesAdded: 3,
        filesModified: 6,
        filesDeleted: 2,
        hasCodeChanges: true,
        hasDocsChanges: false,
        hasTestChanges: true,
      };

      const similarity = calculateSimilarity(features1, features2);
      expect(similarity).toBeGreaterThan(0.8);
      expect(similarity).toBeLessThan(1.0);
    });

    test('handles null or undefined features', () => {
      expect(calculateSimilarity(null, {})).toBe(0);
      expect(calculateSimilarity({}, null)).toBe(0);
      expect(calculateSimilarity(undefined, {})).toBe(0);
    });
  });
});

// ============================================================================
// PURE FUNCTION TESTS - Rule-Based Prediction
// ============================================================================

describe('Pure Functions - Rule-Based Prediction', () => {
  describe('predictSkippability', () => {
    test('predicts EXECUTE with insufficient data', () => {
      const features = { changePercentage: 50, filesChanged: 10 };
      const history = []; // Empty history

      const result = predictSkippability(features, history);

      expect(result.prediction).toBe(PREDICTION.EXECUTE);
      expect(result.confidence).toBe(0);
      expect(result.reason).toBe(SKIP_REASON.INSUFFICIENT_DATA);
    });

    test('predicts SKIP when no changes', () => {
      const features = {
        changePercentage: 0,
        filesChanged: 0,
        hasCodeChanges: false,
      };

      const result = predictSkippability(features, []);

      expect(result.prediction).toBe(PREDICTION.SKIP);
      expect(result.confidence).toBeGreaterThan(0.9);
      expect(result.reason).toBe(SKIP_REASON.NO_CHANGES);
    });

    test('predicts SKIP for docs-only changes on code-heavy steps', () => {
      const features = {
        stepId: 'test-quality',
        changePercentage: 10,
        filesChanged: 5,
        hasDocsChanges: true,
        hasCodeChanges: false,
      };

      const result = predictSkippability(features, []);

      expect(result.prediction).toBe(PREDICTION.SKIP);
      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.reason).toBe(SKIP_REASON.DOCS_ONLY);
    });

    test('predicts SKIP for high success rate with low changes', () => {
      const features = {
        stepId: 'step1',
        changePercentage: 5,
        filesChanged: 2,
        filesAdded: 1,
        filesModified: 1,
        filesDeleted: 0,
        hasCodeChanges: true,
        hasDocsChanges: false,
      };

      // Create 10 similar successful executions
      const history = Array(10)
        .fill(null)
        .map((_, i) => ({
          stepId: 'step1',
          features: {
            ...features,
            changePercentage: 5 + i * 0.5, // Slight variation
          },
          outcome: 'success',
        }));

      const result = predictSkippability(features, history);

      expect(result.prediction).toBe(PREDICTION.SKIP);
      expect(result.confidence).toBeGreaterThan(0.7);
      expect(result.reason).toBe(SKIP_REASON.HIGH_SUCCESS_RATE);
      expect(result.samplesUsed).toBeGreaterThan(0);
    });

    test('predicts EXECUTE when no similar executions found', () => {
      const features = {
        stepId: 'step1',
        changePercentage: 50,
        filesChanged: 20,
        hasCodeChanges: true,
      };

      // History with completely different features
      const history = Array(15)
        .fill(null)
        .map(() => ({
          stepId: 'step1',
          features: {
            changePercentage: 0,
            filesChanged: 0,
            hasCodeChanges: false,
          },
          outcome: 'success',
        }));

      const result = predictSkippability(features, history);

      expect(result.prediction).toBe(PREDICTION.EXECUTE);
    });

    test('respects custom configuration', () => {
      const features = { changePercentage: 0 };
      const history = [];
      const config = { MIN_SAMPLES: 5 };

      const result = predictSkippability(features, history, config);

      expect(result.samplesUsed).toBe(0);
    });
  });

  describe('shouldTrustPrediction', () => {
    test('trusts predictions above threshold', () => {
      const prediction = { confidence: 0.85 };
      expect(shouldTrustPrediction(prediction, 0.7)).toBe(true);
    });

    test('does not trust predictions below threshold', () => {
      const prediction = { confidence: 0.5 };
      expect(shouldTrustPrediction(prediction, 0.7)).toBe(false);
    });

    test('trusts predictions exactly at threshold', () => {
      const prediction = { confidence: 0.7 };
      expect(shouldTrustPrediction(prediction, 0.7)).toBe(true);
    });

    test('returns false for invalid predictions', () => {
      expect(shouldTrustPrediction(null, 0.7)).toBe(false);
      expect(shouldTrustPrediction({}, 0.7)).toBe(false);
      expect(shouldTrustPrediction({ confidence: 'high' }, 0.7)).toBe(false);
    });
  });
});

// ============================================================================
// PURE FUNCTION TESTS - Accuracy Tracking
// ============================================================================

describe('Pure Functions - Accuracy Tracking', () => {
  describe('calculateAccuracy', () => {
    test('returns zero accuracy for empty predictions', () => {
      const accuracy = calculateAccuracy([]);

      expect(accuracy.overall).toBe(0);
      expect(accuracy.skipAccuracy).toBe(0);
      expect(accuracy.executeAccuracy).toBe(0);
      expect(accuracy.totalPredictions).toBe(0);
    });

    test('calculates accuracy for correct predictions', () => {
      const predictions = [
        { prediction: PREDICTION.SKIP, actualOutcome: 'success' }, // Correct
        { prediction: PREDICTION.SKIP, actualOutcome: 'success' }, // Correct
        { prediction: PREDICTION.EXECUTE, actualOutcome: 'failure' }, // Correct
        { prediction: PREDICTION.SKIP, actualOutcome: 'failure' }, // Incorrect
      ];

      const accuracy = calculateAccuracy(predictions);

      expect(accuracy.overall).toBeCloseTo(0.75, 2); // 3/4 correct
      expect(accuracy.totalPredictions).toBe(4);
      expect(accuracy.correctPredictions).toBe(3);
    });

    test('calculates skip accuracy separately', () => {
      const predictions = [
        { prediction: PREDICTION.SKIP, actualOutcome: 'success' }, // Correct
        { prediction: PREDICTION.SKIP, actualOutcome: 'success' }, // Correct
        { prediction: PREDICTION.SKIP, actualOutcome: 'failure' }, // Incorrect
      ];

      const accuracy = calculateAccuracy(predictions);

      expect(accuracy.skipAccuracy).toBeCloseTo(0.667, 2); // 2/3
    });

    test('calculates execute accuracy separately', () => {
      const predictions = [
        { prediction: PREDICTION.EXECUTE, actualOutcome: 'failure' }, // Correct
        { prediction: PREDICTION.EXECUTE, actualOutcome: 'success' }, // Incorrect
      ];

      const accuracy = calculateAccuracy(predictions);

      expect(accuracy.executeAccuracy).toBeCloseTo(0.5, 2); // 1/2
    });
  });

  describe('updateAccuracy', () => {
    test('adds new prediction and recalculates', () => {
      const currentMetrics = { predictions: [] };
      const newPrediction = {
        prediction: PREDICTION.SKIP,
        confidence: 0.9,
      };

      const updated = updateAccuracy(currentMetrics, newPrediction, 'success', 100);

      expect(updated.predictions).toHaveLength(1);
      expect(updated.predictions[0].actualOutcome).toBe('success');
      expect(updated.overall).toBeCloseTo(1.0, 2); // 100% accuracy
    });

    test('maintains rolling window', () => {
      // Start with 3 predictions
      const currentMetrics = {
        predictions: [
          { prediction: PREDICTION.SKIP, actualOutcome: 'success' },
          { prediction: PREDICTION.SKIP, actualOutcome: 'success' },
          { prediction: PREDICTION.SKIP, actualOutcome: 'success' },
        ],
      };

      const newPrediction = { prediction: PREDICTION.SKIP };

      // Use window size of 3
      const updated = updateAccuracy(currentMetrics, newPrediction, 'success', 3);

      expect(updated.predictions).toHaveLength(3); // Oldest dropped
    });

    test('includes timestamp in predictions', () => {
      const currentMetrics = { predictions: [] };
      const updated = updateAccuracy(currentMetrics, { prediction: PREDICTION.SKIP }, 'success');

      expect(updated.predictions[0].timestamp).toBeDefined();
      expect(typeof updated.predictions[0].timestamp).toBe('number');
    });
  });
});

// ============================================================================
// PURE FUNCTION TESTS - Model Persistence
// ============================================================================

describe('Pure Functions - Model Persistence', () => {
  describe('serializeModel', () => {
    test('serializes model to JSON', () => {
      const model = {
        config: DEFAULT_CONFIG,
        historicalData: [{ stepId: 'step1', outcome: 'success' }],
        accuracy: { overall: 0.95 },
      };

      const json = serializeModel(model, 1234567890);
      const parsed = JSON.parse(json);

      expect(parsed.version).toBe('2.0.0');
      expect(parsed.timestamp).toBe(1234567890);
      expect(parsed.config).toEqual(DEFAULT_CONFIG);
      expect(parsed.historicalData).toHaveLength(1);
      expect(parsed.accuracy.overall).toBe(0.95);
    });

    test('handles empty model', () => {
      const json = serializeModel({}, 0);
      const parsed = JSON.parse(json);

      expect(parsed.config).toEqual(DEFAULT_CONFIG);
      expect(parsed.historicalData).toEqual([]);
    });
  });

  describe('parseModel', () => {
    test('parses valid model JSON', () => {
      const json = JSON.stringify({
        version: '2.0.0',
        timestamp: 1234567890,
        config: DEFAULT_CONFIG,
        historicalData: [{ stepId: 'step1' }],
        accuracy: { overall: 0.95 },
      });

      const model = parseModel(json);

      expect(model.version).toBe('2.0.0');
      expect(model.timestamp).toBe(1234567890);
      expect(model.historicalData).toHaveLength(1);
    });

    test('throws on invalid JSON', () => {
      expect(() => parseModel('not json')).toThrow();
    });

    test('throws on empty string', () => {
      expect(() => parseModel('')).toThrow(TypeError);
    });

    test('throws on non-string input', () => {
      expect(() => parseModel(null)).toThrow(TypeError);
    });

    test('throws on missing required fields', () => {
      expect(() => parseModel('{}')).toThrow(Error);
      expect(() => parseModel('{"version": "2.0.0"}')).toThrow(Error);
    });

    test('uses defaults for missing optional fields', () => {
      const json = JSON.stringify({
        version: '2.0.0',
        timestamp: 123,
      });

      const model = parseModel(json);

      expect(model.config).toEqual(DEFAULT_CONFIG);
      expect(model.historicalData).toEqual([]);
      expect(model.accuracy).toEqual({});
    });
  });

  describe('validateModel', () => {
    test('validates correct model', () => {
      const model = {
        version: '2.0.0',
        timestamp: 123,
        config: DEFAULT_CONFIG,
        historicalData: [],
      };

      expect(validateModel(model)).toBe(true);
    });

    test('rejects null or undefined', () => {
      expect(validateModel(null)).toBe(false);
      expect(validateModel(undefined)).toBe(false);
    });

    test('rejects non-object', () => {
      expect(validateModel('string')).toBe(false);
      expect(validateModel(123)).toBe(false);
    });

    test('rejects missing version', () => {
      expect(validateModel({ timestamp: 123, config: {}, historicalData: [] })).toBe(false);
    });

    test('rejects missing timestamp', () => {
      expect(validateModel({ version: '2.0.0', config: {}, historicalData: [] })).toBe(false);
    });

    test('rejects invalid types', () => {
      expect(validateModel({ version: 123, timestamp: 123, config: {}, historicalData: [] })).toBe(
        false
      );
      expect(
        validateModel({ version: '2.0.0', timestamp: '123', config: {}, historicalData: [] })
      ).toBe(false);
      expect(
        validateModel({ version: '2.0.0', timestamp: 123, config: 'string', historicalData: [] })
      ).toBe(false);
      expect(
        validateModel({ version: '2.0.0', timestamp: 123, config: {}, historicalData: 'string' })
      ).toBe(false);
    });
  });
});

// ============================================================================
// PURE FUNCTION TESTS - Historical Data Management
// ============================================================================

describe('Pure Functions - Historical Data Management', () => {
  describe('addExecutionRecord', () => {
    test('adds record to historical data', () => {
      const history = [{ stepId: 'step1' }];
      const newRecord = { stepId: 'step2' };

      const updated = addExecutionRecord(history, newRecord, 1000);

      expect(updated).toHaveLength(2);
      expect(updated[1]).toEqual(newRecord);
    });

    test('maintains max records limit', () => {
      const history = [{ id: 1 }, { id: 2 }, { id: 3 }];
      const newRecord = { id: 4 };

      const updated = addExecutionRecord(history, newRecord, 3);

      expect(updated).toHaveLength(3);
      expect(updated[0]).toEqual({ id: 2 }); // Oldest dropped
      expect(updated[2]).toEqual({ id: 4 }); // Newest added
    });

    test('does not modify original array', () => {
      const history = [{ stepId: 'step1' }];
      const original = [...history];

      addExecutionRecord(history, { stepId: 'step2' }, 1000);

      expect(history).toEqual(original); // Immutable
    });
  });

  describe('filterByStep', () => {
    test('filters records by step ID', () => {
      const history = [
        { stepId: 'step1', outcome: 'success' },
        { stepId: 'step2', outcome: 'failure' },
        { stepId: 'step1', outcome: 'success' },
      ];

      const filtered = filterByStep(history, 'step1');

      expect(filtered).toHaveLength(2);
      expect(filtered.every((r) => r.stepId === 'step1')).toBe(true);
    });

    test('returns empty array for no matches', () => {
      const history = [{ stepId: 'step1' }];
      expect(filterByStep(history, 'step2')).toEqual([]);
    });
  });

  describe('getRecentRecords', () => {
    test('returns recent records', () => {
      const history = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }];

      const recent = getRecentRecords(history, 3);

      expect(recent).toEqual([{ id: 3 }, { id: 4 }, { id: 5 }]);
    });

    test('returns all records if count > length', () => {
      const history = [{ id: 1 }, { id: 2 }];

      const recent = getRecentRecords(history, 10);

      expect(recent).toEqual(history);
    });

    test('uses default count of 10', () => {
      const history = Array(20)
        .fill(null)
        .map((_, i) => ({ id: i }));

      const recent = getRecentRecords(history);

      expect(recent).toHaveLength(10);
      expect(recent[0].id).toBe(10);
    });
  });
});

// ============================================================================
// INTEGRATION TESTS - MLOptimizer
// ============================================================================

describe('MLOptimizer Integration', () => {
  let optimizer;
  let tempDir;
  let fileOps;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ml-test-'));
    fileOps = new FileOperations();
    optimizer = new MLOptimizer({
      fileOps,
      modelFile: path.join(tempDir, '.ml_model.json'),
    });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('initialization', () => {
    test('initializes successfully', async () => {
      await optimizer.initialize();
      expect(optimizer.initialized).toBe(true);
    });

    test('handles missing model file gracefully', async () => {
      await expect(optimizer.initialize()).resolves.not.toThrow();
      expect(optimizer.initialized).toBe(true);
    });

    test('does not reinitialize if already initialized', async () => {
      await optimizer.initialize();
      const firstInit = optimizer.historicalData;

      await optimizer.initialize();
      expect(optimizer.historicalData).toBe(firstInit); // Same reference
    });
  });

  describe('model persistence', () => {
    test('saves and loads model correctly', async () => {
      optimizer.historicalData = [
        { stepId: 'step1', outcome: 'success' },
        { stepId: 'step2', outcome: 'failure' },
      ];
      optimizer.accuracy = { overall: 0.95 };

      await optimizer.saveModel();

      const newOptimizer = new MLOptimizer({
        fileOps,
        modelFile: path.join(tempDir, '.ml_model.json'),
      });
      await newOptimizer.loadModel();

      expect(newOptimizer.historicalData).toHaveLength(2);
      expect(newOptimizer.accuracy.overall).toBe(0.95);
    });

    test('handles corrupted model file', async () => {
      await fs.writeFile(optimizer.modelFile, 'corrupted json');

      await expect(optimizer.loadModel()).rejects.toThrow();
    });
  });

  describe('prediction', () => {
    beforeEach(async () => {
      await optimizer.initialize();
    });

    test('makes predictions for steps with no changes', () => {
      const context = {
        changeStats: {
          changePercentage: 0,
          changed: 0,
        },
      };

      const prediction = optimizer.predict('step1', context);

      // With no history, it still predicts SKIP for no changes (Rule 2)
      expect(prediction.prediction).toBe(PREDICTION.SKIP);
      expect(prediction.confidence).toBeGreaterThan(0.9);
      expect(prediction.reason).toBe(SKIP_REASON.NO_CHANGES);
    });

    test('throws if not initialized', () => {
      const uninitOptimizer = new MLOptimizer({ fileOps });
      expect(() => uninitOptimizer.predict('step1', {})).toThrow();
    });

    test('uses historical data for predictions', async () => {
      // Add historical data
      optimizer.historicalData = Array(15)
        .fill(null)
        .map(() => ({
          stepId: 'step1',
          features: {
            changePercentage: 5,
            filesChanged: 2,
            hasCodeChanges: true,
          },
          outcome: 'success',
        }));

      const context = {
        changeStats: {
          changePercentage: 5,
          changed: 2,
          codeFiles: 1,
        },
      };

      const prediction = optimizer.predict('step1', context);

      expect(prediction.samplesUsed).toBeGreaterThan(0);
    });
  });

  describe('outcome recording', () => {
    beforeEach(async () => {
      await optimizer.initialize();
    });

    test('records execution outcomes', () => {
      const context = { changeStats: { changed: 5 } };
      const prediction = { prediction: PREDICTION.SKIP, confidence: 0.9 };

      optimizer.recordOutcome('step1', context, prediction, 'success');

      expect(optimizer.historicalData).toHaveLength(1);
      expect(optimizer.historicalData[0].stepId).toBe('step1');
      expect(optimizer.historicalData[0].outcome).toBe('success');
    });

    test('updates accuracy metrics', () => {
      const context = { changeStats: { changed: 0 } };
      const prediction = { prediction: PREDICTION.SKIP, confidence: 0.95 };

      optimizer.recordOutcome('step1', context, prediction, 'success');

      const accuracy = optimizer.getAccuracy();
      expect(accuracy.totalPredictions).toBe(1);
      expect(accuracy.correctPredictions).toBe(1);
    });

    test('throws if not initialized', () => {
      const uninitOptimizer = new MLOptimizer({ fileOps });
      expect(() => uninitOptimizer.recordOutcome('step1', {}, {}, 'success')).toThrow();
    });
  });

  describe('accuracy tracking', () => {
    beforeEach(async () => {
      await optimizer.initialize();
    });

    test('returns accuracy metrics', () => {
      const accuracy = optimizer.getAccuracy();

      expect(accuracy.overall).toBe(0);
      expect(accuracy.totalPredictions).toBe(0);
    });

    test('tracks accuracy over multiple predictions', () => {
      const context = { changeStats: { changed: 0 } };

      // Record 3 correct predictions
      for (let i = 0; i < 3; i++) {
        const prediction = { prediction: PREDICTION.SKIP, confidence: 0.9 };
        optimizer.recordOutcome(`step${i}`, context, prediction, 'success');
      }

      const accuracy = optimizer.getAccuracy();
      expect(accuracy.overall).toBeCloseTo(1.0, 2);
      expect(accuracy.totalPredictions).toBe(3);
    });

    test('throws if not initialized', () => {
      const uninitOptimizer = new MLOptimizer({ fileOps });
      expect(() => uninitOptimizer.getAccuracy()).toThrow();
    });
  });

  describe('history summary', () => {
    beforeEach(async () => {
      await optimizer.initialize();
    });

    test('returns history summary', () => {
      optimizer.historicalData = [
        { stepId: 'step1', outcome: 'success' },
        { stepId: 'step1', outcome: 'success' },
        { stepId: 'step2', outcome: 'failure' },
      ];

      const summary = optimizer.getHistorySummary();

      expect(summary.totalRecords).toBe(3);
      expect(summary.uniqueSteps).toBe(2);
      expect(summary.stepCounts.step1).toBe(2);
      expect(summary.stepCounts.step2).toBe(1);
      expect(summary.recentRecords).toHaveLength(3);
    });

    test('throws if not initialized', () => {
      const uninitOptimizer = new MLOptimizer({ fileOps });
      expect(() => uninitOptimizer.getHistorySummary()).toThrow();
    });
  });

  describe('reset', () => {
    beforeEach(async () => {
      await optimizer.initialize();
    });

    test('resets optimizer state', () => {
      optimizer.historicalData = [{ stepId: 'step1' }];
      optimizer.accuracy = { overall: 0.95 };

      optimizer.reset();

      expect(optimizer.historicalData).toEqual([]);
      expect(optimizer.accuracy).toEqual({});
      expect(optimizer.initialized).toBe(false);
    });
  });

  describe('end-to-end workflow', () => {
    test('complete ML optimization workflow', async () => {
      // Initialize
      await optimizer.initialize();

      // Make prediction (no history yet)
      let context = { changeStats: { changePercentage: 0, changed: 0 } };
      let prediction = optimizer.predict('step1', context);
      expect(prediction.prediction).toBe(PREDICTION.SKIP);

      // Record outcome
      optimizer.recordOutcome('step1', context, prediction, 'success');

      // Add more data
      for (let i = 0; i < 10; i++) {
        context = { changeStats: { changePercentage: 5, changed: 2 } };
        prediction = optimizer.predict('step1', context);
        optimizer.recordOutcome('step1', context, prediction, 'success');
      }

      // Check accuracy
      const accuracy = optimizer.getAccuracy();
      expect(accuracy.totalPredictions).toBe(11);

      // Save model
      await optimizer.saveModel();

      // Load in new optimizer
      const newOptimizer = new MLOptimizer({
        fileOps,
        modelFile: path.join(tempDir, '.ml_model.json'),
      });
      await newOptimizer.initialize();

      expect(newOptimizer.historicalData.length).toBe(11);

      // Make prediction with loaded model
      const newPrediction = newOptimizer.predict('step1', context);
      expect(newPrediction.samplesUsed).toBeGreaterThan(0);
    });
  });
});
