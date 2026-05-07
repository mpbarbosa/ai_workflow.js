# Performance Optimization Guide

**Applies to:** ai_workflow.js v2.0.0+
**Phase:** 8 (Performance Optimization modules)

## Overview

This guide explains how to get maximum performance from ai_workflow.js by leveraging its built-in caching, incremental processing, and parallel execution capabilities.

---

## Table of Contents

- [Analysis Cache](#analysis-cache)
- [Incremental Processing](#incremental-processing)
- [Parallel Execution](#parallel-execution)
- [Dependency Cache](#dependency-cache)
- [ML-Based Step Skipping](#ml-based-step-skipping)
- [Performance Monitoring](#performance-monitoring)
- [Profiling & Benchmarking](#profiling--benchmarking)
- [Configuration Tuning](#configuration-tuning)

---

## Analysis Cache

The **Analysis Cache** (`src/lib/analysis_cache.js`) stores results of expensive analysis operations so they can be reused across workflow runs.

**Cached operations:**
- Documentation validation results
- Tech stack detection
- Project structure analysis
- Test coverage analysis

**Default TTL:** 1 hour (configurable)

**Typical speedup:** 40–85% on unchanged files

### Configuration

In `.workflow-config.yaml`:

```yaml
performance:
  analysis_cache:
    enabled: true
    ttl_seconds: 3600       # 1 hour
    max_entries: 500
    cache_dir: .ai_workflow/.cache/analysis
```

### Programmatic Usage

```javascript
import { AnalysisCache } from 'ai-workflow/lib/analysis_cache';

const cache = new AnalysisCache({ ttlSeconds: 3600 });

// Store a result
await cache.set('doc-validation:README.md', { valid: true, issues: [] });

// Retrieve (returns null on miss or expiry)
const result = await cache.get('doc-validation:README.md');
```

---

## Incremental Processing

The **Step 1 Incremental Processor** (`src/lib/step1_incremental.js`) tracks SHA-256 file hashes between runs and skips validation for unchanged files.

See [step1_incremental API](../api/lib/step1_incremental.md) for full reference.

**Typical speedup:** 80–95% on subsequent runs with few changes

### How It Works

1. On first run, all files are hashed and validated; hashes stored in `.ai_workflow/.incremental_cache/step1_docs.json`
2. On subsequent runs, current hashes are compared to cached hashes
3. Only files with changed hashes are re-validated

```
First run:  116 files → validate all  → ~45s
Second run: 116 files → 3 changed     → ~4s
```

---

## Parallel Execution

The **Step 1 Parallel Processor** (`src/lib/step1_parallel.js`) validates documentation categories concurrently.

**Execution strategies:**

| Strategy         | Description                               |
| ---------------- | ----------------------------------------- |
| `SEQUENTIAL`     | One category at a time (safe)             |
| `PARALLEL`       | All categories concurrently               |
| `PRIORITY_BASED` | High-priority categories first            |
| `BALANCED`       | Batches of up to 4 concurrent tasks       |

**Default:** `BALANCED` with concurrency of 4

```javascript
import { Step1ParallelProcessor, EXECUTION_STRATEGY } from 'ai-workflow/lib/step1_parallel';

const processor = new Step1ParallelProcessor({
  strategy: EXECUTION_STRATEGY.PARALLEL,
  concurrency: 6,
});
```

---

## Dependency Cache

The **Dependency Cache** (`src/lib/dependency_cache.js`) caches dependency check results (npm audit, pip check, etc.) to avoid re-running them when lock files haven't changed.

```yaml
performance:
  dependency_cache:
    enabled: true
    ttl_seconds: 86400   # 24 hours
```

---

## ML-Based Step Skipping

The **ML Optimization** module (`src/lib/ml_optimization.js`) learns from past workflow runs to predict which steps can be safely skipped based on the types of files changed.

**Example:** If only `.md` files changed, code quality steps are likely skippable.

```yaml
performance:
  ml_optimization:
    enabled: true
    min_confidence: 0.85   # Only skip if ≥85% confidence
    model_file: .ai_workflow/ml_models/skip_predictor.json
```

---

## Performance Monitoring

The **Performance Monitoring** module (`src/lib/performance_monitoring.js`) emits real-time warnings when steps exceed thresholds.

**Default thresholds:**

| Threshold          | Default  |
| ------------------ | -------- |
| Bottleneck step    | 5 min    |
| Slow step warning  | 2 min    |
| Good cache hit rate| ≥ 80%    |

```javascript
import { PerformanceMonitor } from 'ai-workflow/lib/performance_monitoring';

const monitor = new PerformanceMonitor({
  bottleneckSeconds: 300,
  slowStepSeconds: 120,
});

monitor.on('warning', ({ step, duration, severity }) => {
  console.warn(`[${severity}] ${step} took ${duration}s`);
});
```

---

## Profiling & Benchmarking

Run a workflow with profiling enabled to capture per-step timing:

```bash
ai-workflow run --profile
```

View the generated performance report:

```bash
cat .ai_workflow/metrics/current_run.json | jq '.steps | to_entries | sort_by(.value.duration_seconds) | reverse'
```

---

## Configuration Tuning

### Full Performance Config Example

```yaml
performance:
  analysis_cache:
    enabled: true
    ttl_seconds: 3600
  incremental:
    enabled: true
    cache_dir: .ai_workflow/.incremental_cache
  parallel:
    enabled: true
    strategy: BALANCED
    concurrency: 4
  dependency_cache:
    enabled: true
    ttl_seconds: 86400
  ml_optimization:
    enabled: false        # opt-in only
    min_confidence: 0.85
```

### When to Disable Caching

- **CI/CD fresh environments**: Caches don't persist between jobs by default
- **After dependency updates**: Run `ai-workflow clean --cache` to invalidate
- **Debugging**: Pass `--no-cache` flag to bypass all caches

```bash
ai-workflow run --no-cache
ai-workflow clean --cache
```

---

## Related Documentation

- [Analysis Cache API](../api/lib/analysis_cache.md)
- [Step 1 Incremental API](../api/lib/step1_incremental.md)
- [Step 1 Parallel API](../api/lib/step1_parallel.md)
- [Performance Module API](../api/lib/performance.md)
- [Architecture Overview](../architecture/OVERVIEW.md)

---

**Last Updated:** 2026-03-04
**Applies to:** ai_workflow.js v2.0.0+
