/**
 * @fileoverview ML Optimization Module (v2.0.0)
 *
 * Provides rule-based predictive step skipping for workflow optimization.
 * Uses historical execution data to predict when steps can be safely skipped.
 *
 * Architecture: Referential Transparency (v2.0.0)
 * - Pure functions for prediction logic, accuracy calculation, and model training
 * - MLOptimizer wrapper class for model management and historical data tracking
 *
 * Note: Current implementation is rule-based. Can evolve to actual ML in future.
 *
 * @module lib/ml_optimization
 * @version 2.0.0
 */

import { FileOperations } from './file_operations.js';
import logger from '../core/logger.js';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Default configuration for ML optimization
 * @constant {Object}
 */
export const DEFAULT_CONFIG = {
  MODEL_FILE: '.ml_model.json',
  MIN_SAMPLES: 10, // Minimum samples before making predictions
  CONFIDENCE_THRESHOLD: 0.7, // Minimum confidence to skip step
  ACCURACY_WINDOW: 100, // Rolling window for accuracy calculation
  MAX_HISTORY: 1000, // Maximum historical records to keep
};

/**
 * Prediction result codes
 * @constant {Object}
 */
export const PREDICTION = {
  SKIP: 'skip',
  EXECUTE: 'execute',
  UNKNOWN: 'unknown',
};

/**
 * Skip reasons for explainability
 * @constant {Object}
 */
export const SKIP_REASON = {
  NO_CHANGES: 'no_changes_detected',
  DOCS_ONLY: 'documentation_only_changes',
  HIGH_SUCCESS_RATE: 'historically_high_success_rate',
  UNCHANGED_INPUTS: 'inputs_unchanged_since_last_run',
  LOW_CONFIDENCE: 'insufficient_confidence',
  INSUFFICIENT_DATA: 'insufficient_historical_data',
};

// ============================================================================
// PURE FUNCTIONS - Feature Extraction
// ============================================================================

/**
 * Extract features from workflow context
 * @pure
 * @param {Object} context - Workflow execution context
 * @param {Object} context.changeStats - Change statistics
 * @param {string} context.stepId - Step identifier
 * @param {Object} context.previousResults - Previous step results
 * @returns {Object} Feature vector
 */
export function extractFeatures(context) {
  const { changeStats = {}, stepId = '', previousResults = {} } = context;

  return {
    stepId,
    changePercentage: changeStats.changePercentage || 0,
    filesChanged: changeStats.changed || 0,
    filesAdded: changeStats.added || 0,
    filesModified: changeStats.modified || 0,
    filesDeleted: changeStats.deleted || 0,
    hasCodeChanges: (changeStats.codeFiles || 0) > 0,
    hasDocsChanges: (changeStats.docsFiles || 0) > 0,
    hasTestChanges: (changeStats.testFiles || 0) > 0,
    previousStepSuccess: previousResults.success !== false,
  };
}

/**
 * Calculate similarity between two feature vectors
 * @pure
 * @param {Object} features1 - First feature vector
 * @param {Object} features2 - Second feature vector
 * @returns {number} Similarity score (0-1)
 */
export function calculateSimilarity(features1, features2) {
  if (!features1 || !features2) {
    return 0;
  }

  // Compare numeric features with normalized difference
  const numericFeatures = [
    'changePercentage',
    'filesChanged',
    'filesAdded',
    'filesModified',
    'filesDeleted',
  ];

  let totalDiff = 0;
  let featureCount = 0;

  for (const feature of numericFeatures) {
    const val1 = features1[feature] || 0;
    const val2 = features2[feature] || 0;
    const maxVal = Math.max(val1, val2, 1); // Avoid division by zero
    const diff = Math.abs(val1 - val2) / maxVal;
    totalDiff += diff;
    featureCount++;
  }

  // Compare boolean features
  const boolFeatures = ['hasCodeChanges', 'hasDocsChanges', 'hasTestChanges'];
  for (const feature of boolFeatures) {
    const match = features1[feature] === features2[feature] ? 0 : 1;
    totalDiff += match;
    featureCount++;
  }

  // Calculate similarity (1 - average difference)
  const avgDiff = totalDiff / featureCount;
  return Math.max(0, 1 - avgDiff);
}

// ============================================================================
// PURE FUNCTIONS - Rule-Based Prediction
// ============================================================================

/**
 * Predict if step can be skipped based on rules
 * @pure
 * @param {Object} features - Feature vector
 * @param {Array<Object>} historicalData - Historical execution records
 * @param {Object} config - Configuration
 * @returns {Object} Prediction result with confidence and reason
 */
export function predictSkippability(features, historicalData = [], config = DEFAULT_CONFIG) {
  // Rule 1: No changes -> skip (high confidence, no history needed)
  if (features.changePercentage === 0 && features.filesChanged === 0) {
    return {
      prediction: PREDICTION.SKIP,
      confidence: 0.95,
      reason: SKIP_REASON.NO_CHANGES,
      samplesUsed: 0,
    };
  }

  // Rule 2: Docs only changes -> skip for code-heavy steps
  const docsOnlyChange = features.hasDocsChanges && !features.hasCodeChanges;
  const codeHeavyStep =
    (features.stepId && features.stepId.includes('test')) ||
    (features.stepId && features.stepId.includes('quality'));
  if (docsOnlyChange && codeHeavyStep) {
    return {
      prediction: PREDICTION.SKIP,
      confidence: 0.85,
      reason: SKIP_REASON.DOCS_ONLY,
      samplesUsed: 0,
    };
  }

  // Rule 3: Insufficient data -> execute
  if (historicalData.length < config.MIN_SAMPLES) {
    return {
      prediction: PREDICTION.EXECUTE,
      confidence: 0,
      reason: SKIP_REASON.INSUFFICIENT_DATA,
      samplesUsed: historicalData.length,
    };
  }

  // Rule 4: Find similar historical executions
  const similarExecutions = historicalData
    .map((record) => ({
      record,
      similarity: calculateSimilarity(features, record.features),
    }))
    .filter((item) => item.similarity > 0.7)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 10); // Top 10 most similar

  if (similarExecutions.length === 0) {
    return {
      prediction: PREDICTION.EXECUTE,
      confidence: 0.3,
      reason: SKIP_REASON.INSUFFICIENT_DATA,
      samplesUsed: 0,
    };
  }

  // Calculate success rate from similar executions
  const successCount = similarExecutions.filter((item) => item.record.outcome === 'success').length;
  const successRate = successCount / similarExecutions.length;

  // Rule 5: High success rate with no changes -> skip
  if (successRate > 0.9 && features.changePercentage < 10) {
    return {
      prediction: PREDICTION.SKIP,
      confidence: successRate * 0.9, // Slightly discount confidence
      reason: SKIP_REASON.HIGH_SUCCESS_RATE,
      samplesUsed: similarExecutions.length,
    };
  }

  // Default: Execute (safety first)
  return {
    prediction: PREDICTION.EXECUTE,
    confidence: 1 - successRate,
    reason: SKIP_REASON.LOW_CONFIDENCE,
    samplesUsed: similarExecutions.length,
  };
}

/**
 * Determine if prediction should be trusted
 * @pure
 * @param {Object} predictionResult - Result from predictSkippability
 * @param {number} confidenceThreshold - Minimum confidence to trust
 * @returns {boolean} True if prediction should be trusted
 */
export function shouldTrustPrediction(predictionResult, confidenceThreshold = 0.7) {
  if (!predictionResult || typeof predictionResult.confidence !== 'number') {
    return false;
  }
  return predictionResult.confidence >= confidenceThreshold;
}

// ============================================================================
// PURE FUNCTIONS - Accuracy Tracking
// ============================================================================

/**
 * Calculate prediction accuracy from historical results
 * @pure
 * @param {Array<Object>} predictions - Historical predictions with actual outcomes
 * @returns {Object} Accuracy metrics
 */
export function calculateAccuracy(predictions = []) {
  if (predictions.length === 0) {
    return {
      overall: 0,
      skipAccuracy: 0,
      executeAccuracy: 0,
      totalPredictions: 0,
      correctPredictions: 0,
    };
  }

  let correct = 0;
  let skipCorrect = 0;
  let skipTotal = 0;
  let executeCorrect = 0;
  let executeTotal = 0;

  for (const pred of predictions) {
    const predictedSkip = pred.prediction === PREDICTION.SKIP;
    const actualSuccess = pred.actualOutcome === 'success';

    // A correct prediction means:
    // - Predicted SKIP and step succeeded (would have been safe to skip)
    // - Predicted EXECUTE and step failed (needed to execute)
    const isCorrect = (predictedSkip && actualSuccess) || (!predictedSkip && !actualSuccess);

    if (isCorrect) {
      correct++;
    }

    if (predictedSkip) {
      skipTotal++;
      if (actualSuccess) skipCorrect++;
    } else {
      executeTotal++;
      if (!actualSuccess) executeCorrect++;
    }
  }

  return {
    overall: correct / predictions.length,
    skipAccuracy: skipTotal > 0 ? skipCorrect / skipTotal : 0,
    executeAccuracy: executeTotal > 0 ? executeCorrect / executeTotal : 0,
    totalPredictions: predictions.length,
    correctPredictions: correct,
  };
}

/**
 * Update accuracy metrics with new prediction result
 * @pure
 * @param {Object} currentMetrics - Current accuracy metrics
 * @param {Object} newPrediction - New prediction result
 * @param {string} actualOutcome - Actual execution outcome
 * @param {number} maxWindow - Maximum window size
 * @returns {Object} Updated accuracy metrics
 */
export function updateAccuracy(currentMetrics, newPrediction, actualOutcome, maxWindow = 100) {
  const predictions = currentMetrics.predictions || [];

  // Add new prediction with actual outcome
  const updatedPredictions = [
    ...predictions,
    {
      ...newPrediction,
      actualOutcome,
      timestamp: Date.now(),
    },
  ];

  // Keep only recent predictions (rolling window)
  const recentPredictions = updatedPredictions.slice(-maxWindow);

  // Recalculate accuracy
  const accuracy = calculateAccuracy(recentPredictions);

  return {
    ...accuracy,
    predictions: recentPredictions,
  };
}

// ============================================================================
// PURE FUNCTIONS - Model Persistence
// ============================================================================

/**
 * Serialize model to JSON format
 * @pure
 * @param {Object} model - Model data
 * @param {number} timestamp - Timestamp in seconds
 * @returns {string} JSON string
 */
export function serializeModel(model, timestamp) {
  return JSON.stringify(
    {
      version: '2.0.0',
      timestamp,
      config: model.config || DEFAULT_CONFIG,
      historicalData: model.historicalData || [],
      accuracy: model.accuracy || {},
    },
    null,
    2
  );
}

/**
 * Parse model from JSON format
 * @pure
 * @param {string} json - JSON string
 * @returns {Object} Parsed model data
 */
export function parseModel(json) {
  if (typeof json !== 'string' || json.trim() === '') {
    throw new TypeError('JSON must be a non-empty string');
  }

  const data = JSON.parse(json);

  if (!data.version || !data.timestamp) {
    throw new Error('Invalid model format: missing required fields');
  }

  return {
    version: data.version,
    timestamp: data.timestamp,
    config: data.config || DEFAULT_CONFIG,
    historicalData: data.historicalData || [],
    accuracy: data.accuracy || {},
  };
}

/**
 * Validate model data structure
 * @pure
 * @param {Object} model - Model data to validate
 * @returns {boolean} True if valid
 */
export function validateModel(model) {
  if (!model || typeof model !== 'object') {
    return false;
  }
  if (!model.version || typeof model.version !== 'string') {
    return false;
  }
  if (!model.timestamp || typeof model.timestamp !== 'number') {
    return false;
  }
  if (!model.config || typeof model.config !== 'object') {
    return false;
  }
  if (!Array.isArray(model.historicalData)) {
    return false;
  }
  return true;
}

// ============================================================================
// PURE FUNCTIONS - Historical Data Management
// ============================================================================

/**
 * Add execution record to historical data
 * @pure
 * @param {Array<Object>} historicalData - Current historical data
 * @param {Object} record - Execution record to add
 * @param {number} maxRecords - Maximum records to keep
 * @returns {Array<Object>} Updated historical data
 */
export function addExecutionRecord(historicalData, record, maxRecords = 1000) {
  const updated = [...historicalData, record];

  // Keep only most recent records
  if (updated.length > maxRecords) {
    return updated.slice(-maxRecords);
  }

  return updated;
}

/**
 * Filter historical data by step ID
 * @pure
 * @param {Array<Object>} historicalData - Historical data
 * @param {string} stepId - Step identifier
 * @returns {Array<Object>} Filtered data
 */
export function filterByStep(historicalData, stepId) {
  return historicalData.filter((record) => record.stepId === stepId);
}

/**
 * Get recent execution records
 * @pure
 * @param {Array<Object>} historicalData - Historical data
 * @param {number} count - Number of recent records to retrieve
 * @returns {Array<Object>} Recent records
 */
export function getRecentRecords(historicalData, count = 10) {
  return historicalData.slice(-count);
}

// ============================================================================
// ML OPTIMIZER CLASS (Impure Wrapper)
// ============================================================================

/**
 * ML Optimizer
 * Manages rule-based predictive optimization for workflow steps
 */
export class MLOptimizer {
  /**
   * Create ML optimizer
   * @param {Object} options - Configuration options
   * @param {FileOperations} options.fileOps - File operations instance
   * @param {string} options.modelFile - Path to model storage file
   * @param {Object} options.config - Optimizer configuration
   */
  constructor(options = {}) {
    this.fileOps = options.fileOps || new FileOperations();
    this.modelFile = options.modelFile || DEFAULT_CONFIG.MODEL_FILE;
    this.config = { ...DEFAULT_CONFIG, ...options.config };

    this.historicalData = [];
    this.accuracy = {};
    this.initialized = false;
    this.hasPersistedModel = false;
  }

  /**
   * Initialize optimizer by loading model
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      await this.loadModel();
      this.initialized = true;
      logger.info('ML Optimizer initialized');
    } catch (error) {
      logger.warn(`Failed to initialize optimizer: ${error.message}`);
      // Continue with empty model
      this.initialized = true;
    }
  }

  /**
   * Load model from storage
   * @param {string} modelPath - Path to model file (optional)
   * @returns {Promise<void>}
   */
  async loadModel(modelPath = null) {
    const filePath = modelPath || this.modelFile;

    try {
      const exists = await this.fileOps.exists(filePath);
      if (!exists) {
        logger.debug('No model file found, starting fresh');
        this.hasPersistedModel = false;
        return;
      }

      const json = await this.fileOps.readFile(filePath);
      const model = parseModel(json); // Pure function

      if (!validateModel(model)) {
        throw new Error('Invalid model format');
      }

      this.historicalData = model.historicalData;
      this.accuracy = model.accuracy;
      this.config = { ...this.config, ...model.config };
      this.hasPersistedModel = true;

      logger.debug(`Loaded model with ${this.historicalData.length} historical records`);
    } catch (error) {
      logger.warn(`Failed to load model: ${error.message}`);
      throw error;
    }
  }

  /**
   * Save model to storage
   * @param {string} modelPath - Path to model file (optional)
   * @returns {Promise<void>}
   */
  async saveModel(modelPath = null) {
    const filePath = modelPath || this.modelFile;

    try {
      const model = {
        config: this.config,
        historicalData: this.historicalData,
        accuracy: this.accuracy,
      };

      const timestamp = Math.floor(Date.now() / 1000);
      const json = serializeModel(model, timestamp); // Pure function

      await this.fileOps.writeFile(filePath, json);
      this.hasPersistedModel = true;
      logger.debug(`Saved model with ${this.historicalData.length} records`);
    } catch (error) {
      logger.error(`Failed to save model: ${error.message}`);
      throw error;
    }
  }

  /**
   * Predict if step should be skipped
   * @param {string} stepId - Step identifier
   * @param {Object} context - Workflow execution context
   * @returns {Object} Prediction result
   */
  predict(stepId, context) {
    if (!this.initialized) {
      throw new Error('Optimizer not initialized. Call initialize() first.');
    }
    if (!this.hasPersistedModel) {
      return {
        prediction: PREDICTION.EXECUTE,
        confidence: 0,
        reason: SKIP_REASON.INSUFFICIENT_DATA,
      };
    }

    // Extract features from context
    const features = extractFeatures({ ...context, stepId }); // Pure function

    // Filter historical data for this step
    const stepHistory = filterByStep(this.historicalData, stepId); // Pure function

    // Make prediction using rule-based logic
    const prediction = predictSkippability(features, stepHistory, this.config); // Pure function

    logger.debug(
      `Prediction for ${stepId}: ${prediction.prediction} (confidence: ${prediction.confidence.toFixed(2)})`
    );

    return prediction;
  }

  /**
   * Record execution result for learning
   * @param {string} stepId - Step identifier
   * @param {Object} context - Workflow execution context
   * @param {Object} prediction - Prediction that was made
   * @param {string} actualOutcome - Actual execution outcome ('success' or 'failure')
   * @returns {void}
   */
  recordOutcome(stepId, context, prediction, actualOutcome) {
    if (!this.initialized) {
      throw new Error('Optimizer not initialized. Call initialize() first.');
    }

    // Extract features
    const features = extractFeatures({ ...context, stepId });

    // Create execution record
    const record = {
      stepId,
      features,
      prediction: prediction.prediction,
      confidence: prediction.confidence,
      outcome: actualOutcome,
      timestamp: Date.now(),
    };

    // Add to historical data (pure function)
    this.historicalData = addExecutionRecord(this.historicalData, record, this.config.MAX_HISTORY);

    // Update accuracy metrics (pure function)
    this.accuracy = updateAccuracy(
      this.accuracy,
      prediction,
      actualOutcome,
      this.config.ACCURACY_WINDOW
    );

    logger.debug(`Recorded outcome for ${stepId}: ${actualOutcome}`);
  }

  /**
   * Get accuracy metrics
   * @returns {Object} Current accuracy metrics
   */
  getAccuracy() {
    if (!this.initialized) {
      throw new Error('Optimizer not initialized. Call initialize() first.');
    }
    return calculateAccuracy(this.accuracy.predictions || []); // Pure function
  }

  /**
   * Get historical data summary
   * @returns {Object} Summary statistics
   */
  getHistorySummary() {
    if (!this.initialized) {
      throw new Error('Optimizer not initialized. Call initialize() first.');
    }

    const stepCounts = {};
    for (const record of this.historicalData) {
      stepCounts[record.stepId] = (stepCounts[record.stepId] || 0) + 1;
    }

    return {
      totalRecords: this.historicalData.length,
      uniqueSteps: Object.keys(stepCounts).length,
      stepCounts,
      recentRecords: getRecentRecords(this.historicalData, 5), // Pure function
    };
  }

  /**
   * Reset optimizer state
   */
  reset() {
    this.historicalData = [];
    this.accuracy = {};
    this.initialized = false;
    logger.debug('Optimizer state reset');
  }
}
