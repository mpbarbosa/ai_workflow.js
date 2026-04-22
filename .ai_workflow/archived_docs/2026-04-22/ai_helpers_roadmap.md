# Roadmap: `config/ai_helpers.yaml` — Persona & Prompt Set Progression

**Source File**: `config/ai_helpers.yaml`  
**Current Version**: v6.6.0 (19 core personas, 6 supplemental specialists)  
**Document Date**: 2026-03-05  
**Repository**: `mpbarbosa/ai_workflow_core`

---

## Table of Contents

1. [Current State Assessment](#1-current-state-assessment)
2. [Gap Analysis](#2-gap-analysis)
3. [Phase 1 — Refinement (v6.7.x)](#3-phase-1--refinement-v67x)
4. [Phase 2 — Expansion (v7.x.x)](#4-phase-2--expansion-v7xx)
5. [Phase 3 — Architecture Evolution (v8.x.x)](#5-phase-3--architecture-evolution-v8xx)
6. [Persona Inventory & Coverage Map](#6-persona-inventory--coverage-map)
7. [Language Coverage Matrix](#7-language-coverage-matrix)
8. [Token Efficiency Targets](#8-token-efficiency-targets)
9. [Prioritized Backlog](#9-prioritized-backlog)

---

## 1. Current State Assessment

### 1.1 Persona Inventory (v6.6.0)

**Core Personas (19 counted in header)**:

| Key | Group | Pattern | Status |
|-----|-------|---------|--------|
| `doc_analysis_prompt` | Documentation | Full (anchor) | ✅ Mature |
| `consistency_prompt` | Documentation | Full (anchor) | ✅ Mature |
| `technical_writer_prompt` | Documentation | Full (anchor + necessity gate) | ✅ Mature |
| `front_end_developer_prompt` | Front-End | Full (anchor) | ✅ Mature |
| `e2e_test_engineer_prompt` | Testing | Full (anchor) | ✅ Mature |
| `ui_ux_designer_prompt` | Design | Full (anchor) | ✅ Mature |
| `requirements_engineer_prompt` | Architecture | Full (anchor + necessity gate) | ✅ Mature |
| `test_strategy_prompt` | Testing | Full (anchor) + legacy `role` field | ⚠️ Has legacy field |
| `single_file_test_prompt` | Testing | Legacy `role` only — no anchor | ⚠️ Needs modernization |
| `quality_prompt` | Quality | Full (anchor) + legacy `role` field | ⚠️ Has legacy field |
| `issue_extraction_prompt` | DevOps | Full (anchor) + legacy `role` field | ⚠️ Thin, has legacy field |
| `step2_consistency_prompt` | Documentation | Full (anchor) + legacy `role` field | ⚠️ Has legacy field |
| `step3_script_refs_prompt` | DevOps | Full (anchor) + legacy `role` field | ⚠️ Has legacy field |
| `step4_directory_prompt` | Architecture | Full (anchor) + legacy `role` field | ⚠️ Has legacy field |
| `step5_test_review_prompt` | Testing | Full (anchor) + legacy `role` field | ⚠️ Has legacy field |
| `step7_test_exec_prompt` | Testing | Full (anchor) + legacy `role` field | ⚠️ Has legacy field |
| `step8_dependencies_prompt` | DevOps | Full (anchor) + legacy `role` field | ⚠️ Has legacy field |
| `step9_code_quality_prompt` | Quality | Full (anchor) + legacy `role` field | ⚠️ Has legacy field |
| `step11_git_commit_prompt` | DevOps | Full (anchor) + legacy `role` field | ⚠️ Has legacy field |

**Supplemental Specialists (not in 19-count)**:

| Key | Group | Pattern | Status |
|-----|-------|---------|--------|
| `markdown_lint_prompt` | Documentation | Full (anchor) + legacy `role` field | ⚠️ Has legacy field |
| `configuration_specialist_prompt` | DevOps | Full (anchor) | ✅ Mature |
| `step13_prompt_engineer_prompt` | Meta | Full (anchor) | ✅ Mature |
| `version_manager_prompt` | DevOps | Thin — no `task_template` field | ⚠️ Thin |
| `observer_pattern_debugger_prompt` | Debugging | Non-standard (`specific_expertise`) | ⚠️ Non-standard |
| `async_flow_debugger_prompt` | Debugging | Non-standard (`specific_expertise`) | ⚠️ Non-standard |
| `data_structure_debugger_prompt` | Debugging | Non-standard (`specific_expertise`) | ⚠️ Non-standard |
| `aws_cloud_architect_prompt` | Cloud | Full (anchor) | ✅ Mature |
| `javascript_developer_prompt` | Language | Full (anchor) | ✅ Mature |
| `typescript_developer_prompt` | Language | Full (anchor) | ✅ Mature (v6.6.0) |

**Total Defined Prompts**: 29 keys  
**Behavioral Anchors**: 2 (`behavioral_actionable`, `behavioral_structured`)  
**Language Tables**: 3 tables × 9 languages = 27 entries

### 1.2 Behavioral Anchor Usage

| Anchor | Purpose | Persona Count |
|--------|---------|---------------|
| `*behavioral_actionable` | Concrete output, edits, code | 20 |
| `*behavioral_structured` | Analysis reports, prioritized findings | 9 |
| None (legacy `role` only) | `single_file_test_prompt`, debugging specialists | 4 |

### 1.3 Strengths

- Consistent `role_prefix + behavioral_guidelines + task_template + approach` composition model
- YAML anchor pattern eliminates ~260–390 tokens of duplication per workflow run
- Necessity-first decision gates in `technical_writer_prompt` and `requirements_engineer_prompt` prevent unnecessary generation
- Deep language-specific context injection for 9 languages across 3 dimensions
- Clear persona differentiation (e.g., `test_strategy_prompt` = WHAT vs `e2e_test_engineer_prompt` = HOW)

---

## 2. Gap Analysis

### 2.1 Structural Gaps

| Gap | Current State | Impact |
|-----|--------------|--------|
| **Legacy `role` fields** | 11 personas carry both `role_prefix` and the legacy `role` field | ~150–200 tokens wasted per workflow where both are loaded |
| **`single_file_test_prompt` modernization** | Uses `role` only; no anchor; no `role_prefix` | Inconsistent behavior; not getting behavioral guidelines |
| **`version_manager_prompt` thinness** | Missing `task_template`; relies only on `specific_expertise` | Unpredictable output format; no context variables |
| **Debugging persona non-standard fields** | Use `specific_expertise` field (not in the standard 4-field model) | Breaks schema validation; complicates prompt builder |
| **2-anchor behavioral system** | Only `actionable` and `structured`; no lightweight anchor | Forces thin prompts (version_manager, single_file_test) to pick an ill-fitting anchor or use none |

### 2.2 Language Coverage Gaps

**Language tables** (documentation, quality, testing) cover 9 languages. Missing:

| Missing Language | Ecosystem Relevance | Priority |
|-----------------|---------------------|----------|
| **C# (.NET)** | Enterprise backend, Unity, Azure workloads | High |
| **Kotlin** | Android, Spring Boot backend, KMP | High |
| **Swift** | iOS/macOS native development | Medium |
| **PHP** | Web backends, WordPress, Laravel | Medium |
| **Dart** | Flutter cross-platform apps | Low |
| **Scala** | Big data (Spark), functional backend | Low |

**Language-specific developer personas** exist for JavaScript and TypeScript only. Other languages lack equivalent package-management/toolchain personas:

| Missing Persona | Analogous Existing | Priority |
|----------------|-------------------|----------|
| `python_developer_prompt` | `javascript_developer_prompt` | High — pyproject.toml, poetry, pip, venv |
| `go_developer_prompt` | `javascript_developer_prompt` | Medium — go.mod, module patterns |
| `java_developer_prompt` | `javascript_developer_prompt` | Medium — Maven/Gradle, Spring Boot |
| `rust_developer_prompt` | `javascript_developer_prompt` | Low — Cargo.toml, crate publishing |
| `kotlin_developer_prompt` | `javascript_developer_prompt` | Low — build.gradle.kts, KMP |

### 2.3 Domain Coverage Gaps

**Missing personas by domain**:

| Domain | Gap | Proposed Persona Key | Priority |
|--------|-----|---------------------|----------|
| **Security** | No application security auditor | `appsec_engineer_prompt` | High |
| **API Design** | No REST/GraphQL design reviewer | `api_designer_prompt` | High |
| **Database** | No schema design / migration analyst | `database_architect_prompt` | High |
| **Cloud** | Only AWS covered; GCP and Azure absent | `gcp_cloud_architect_prompt` | Medium |
| **Cloud** | No Azure persona | `azure_cloud_architect_prompt` | Medium |
| **CI/CD Design** | `step3` validates scripts; no pipeline designer | `cicd_pipeline_engineer_prompt` | Medium |
| **Data Engineering** | No ETL / data pipeline specialist | `data_engineer_prompt` | Low |
| **Mobile** | No iOS/Android development persona | `mobile_developer_prompt` | Low |
| **Accessibility Audit** | Front-end covers WCAG; no dedicated auditor | `accessibility_auditor_prompt` | Low |

### 2.4 Prompt Quality Gaps

| Persona | Quality Issue | Recommendation |
|---------|--------------|----------------|
| `quality_prompt` vs `step9_code_quality_prompt` | Significant overlap in purpose and content | Clarify boundary: `quality_prompt` = targeted file review; `step9` = system-wide architectural assessment; document distinction |
| `consistency_prompt` vs `step2_consistency_prompt` | Very similar purpose; step2 has additional broken-reference analysis | Consider consolidating or promoting step2 as the canonical version |
| `test_strategy_prompt` | Has non-standard `debugging_test_strategy` field | Move debug-specific content to `observer_pattern_debugger_prompt` or remove |
| `quality_prompt` | Has non-standard `debugging_expertise` field | Move content to `quality_prompt` approach or debugging specialists |
| `configuration_specialist_prompt` | Has non-standard `debugging_configuration` field | Move content to `configuration_specialist_prompt` approach or remove |
| All necessity-gating | Only 2 of 29 personas have full 3-step necessity gates | Apply abbreviated necessity check to `technical_writer_prompt`-style gate in documentation-generating personas |

### 2.5 Token Efficiency Opportunities

| Opportunity | Estimated Savings | Effort |
|-------------|------------------|--------|
| Remove legacy `role` fields from 11 personas | ~110–165 tokens/workflow | Low |
| Add 3rd behavioral anchor (`behavioral_generative`) | Reuse across 3–5 new lightweight personas | Low |
| Consolidate non-standard fields into standard `approach` block | Cleaner schema; ~50 tokens | Medium |
| Compress debugging specialists into composite persona with sub-modes | ~300 tokens if combined | High |

---

## 3. Phase 1 — Refinement (v6.7.x)

**Goal**: Improve structural consistency and quality without adding net new personas. Backward compatible.

### 3.1 Remove Legacy `role` Fields (v6.7.0)

Remove the redundant `role` field from the 11 personas that carry both `role_prefix` and `role`. The `role_prefix` is the authoritative field in v4.0.0+. The legacy `role` field is only needed for consumers that haven't migrated.

**Affected personas**: `test_strategy_prompt`, `quality_prompt`, `issue_extraction_prompt`, `step2_consistency_prompt`, `step3_script_refs_prompt`, `step4_directory_prompt`, `step5_test_review_prompt`, `step7_test_exec_prompt`, `step8_dependencies_prompt`, `step9_code_quality_prompt`, `step11_git_commit_prompt`, `markdown_lint_prompt`.

**Prerequisite**: Confirm parent `ai_workflow` execution engine reads `role_prefix` exclusively (not `role`).  
**Token savings**: ~110–165 tokens/workflow (12 personas × ~10–14 tokens each).  
**Risk**: Low — additive to v4.0.0+ consumers; requires confirmation from `ai_workflow`.

### 3.2 Modernize `single_file_test_prompt` (v6.7.1)

Migrate `single_file_test_prompt` from legacy `role` pattern to the standard 4-field composition:

```yaml
single_file_test_prompt:
  role_prefix: |
    You are a senior test engineer specializing in writing complete, runnable test suites
    that cover happy paths, edge cases, and error scenarios.
  behavioral_guidelines: *behavioral_actionable
  task_template: |
    ...
  approach: |
    ...
```

Remove the `role` field. Ensure `task_template` carries all current task instructions.

### 3.3 Expand `version_manager_prompt` (v6.7.2)

Add missing `task_template` field with full context variable injection pattern. Currently the persona has no structured task template, making context injection inconsistent. Add:

```yaml
version_manager_prompt:
  role_prefix: "You are a Version Manager and Semantic Versioning Expert"
  behavioral_guidelines: *behavioral_actionable
  task_template: |
    **YOUR TASK**: Determine the correct semantic version bump for the provided changes.
    **Project**: {project_name} ({project_description})
    **Current Version**: {current_version}
    **Changed Files**: {changed_files}
    **Git Context**: {git_context}
    ...
  specific_expertise: |
    ... (retain existing)
  approach: |
    ... (retain existing)
  output_format: |
    ... (retain existing)
```

### 3.4 Add Third Behavioral Anchor: `behavioral_generative` (v6.7.3)

Introduce a third YAML anchor for personas that perform pure generation tasks where the necessity-check/actionable pattern doesn't apply (e.g., commit messages, per-file test generation, version bumps):

```yaml
_behavioral_generative: &behavioral_generative |
  **Critical Behavioral Guidelines**:
  - Generate output directly — do not ask clarifying questions
  - Apply the provided context exactly as given
  - Produce complete, ready-to-use output in the specified format
  - Default to the most conservative/safe interpretation when context is ambiguous
  - Never add explanatory preamble outside the requested output format
```

**Apply to**: `single_file_test_prompt`, `step11_git_commit_prompt`, `version_manager_prompt`, and any future pure-generation personas.

### 3.5 Move Non-Standard Fields to `approach` (v6.7.4)

Remove non-standard top-level fields from personas and integrate their content into the `approach` block or remove if redundant:

| Persona | Non-Standard Field | Action |
|---------|------------------|--------|
| `test_strategy_prompt` | `debugging_test_strategy` | Move to `approach` sub-section or remove |
| `quality_prompt` | `debugging_expertise` | Move to `approach` sub-section |
| `configuration_specialist_prompt` | `debugging_configuration` | Move to `approach` sub-section |

This makes the schema consistent with the documented 5-field model and removes fields that prompt builders may not know to include.

### 3.6 Expand Language Tables (v6.7.5)

Add C# and Kotlin to all three language-specific tables (documentation, quality, testing). These are the two highest-priority missing languages:

**C# additions**:
- Documentation: XML doc comments (`/// <summary>`), Sandcastle/DocFX format
- Quality: nullable reference types, LINQ patterns, async/await in .NET, `using` statements
- Testing: xUnit / NUnit / MSTest, Moq for mocking, FluentAssertions

**Kotlin additions**:
- Documentation: KDoc format (`/** */`), Dokka tool
- Quality: null safety operators (`?.`, `?:`), data classes, sealed classes, coroutines
- Testing: JUnit 5 + Kotlin, MockK, kotest

### 3.7 Clarify `quality_prompt` vs `step9_code_quality_prompt` Boundary (v6.7.6)

Add explicit disambiguation comments and update `role_prefix` to sharpen differentiation:

| Persona | Scope | When to Use |
|---------|-------|-------------|
| `quality_prompt` | Single file or small set of files; immediate issues; quick review | Targeted PR review, pre-commit check, on specific files |
| `step9_code_quality_prompt` | Entire codebase; architectural debt; cross-file patterns | Workflow step 9/10; system-wide audit; technical debt sprint |

Update `role_prefix` of `quality_prompt` to emphasize: *"quick, targeted, file-level"*  
Update `role_prefix` of `step9_code_quality_prompt` to emphasize: *"system-wide, architectural, comprehensive"*

---

## 4. Phase 2 — Expansion (v7.x.x)

**Goal**: Add high-value new personas to cover critical domain gaps. Each persona follows the v6.x.x standard pattern.

### 4.1 `python_developer_prompt` (v7.0.0)

**Rationale**: Python is the 3rd most common project language after JavaScript/TypeScript. The `javascript_developer_prompt` and `typescript_developer_prompt` have no Python equivalent. Python package management has significant complexity (pip, poetry, pyproject.toml, requirements.txt, virtual environments, conda).

**Expertise areas**:
- `pyproject.toml` authoring (PEP 517/518/621 metadata, build backends: setuptools, hatchling, flit, poetry)
- `requirements.txt` vs `pyproject.toml` dependency specification
- Virtual environment management (venv, virtualenv, conda, pyenv)
- Dependency pinning strategies (pip-tools `requirements.in → requirements.txt`)
- Package publishing (PyPI, Test PyPI, private registries via pip.conf)
- Security hygiene (`pip audit`, `safety`, dependency pinning)
- Dev dependency separation (`dev`, `test`, `docs` optional dependency groups)
- Python version management (`.python-version`, `pyenv`, `tox`)

**Behavioral anchor**: `*behavioral_actionable`  
**Differentiates from**:
- `configuration_specialist_prompt`: validates config syntax; does not author or optimize
- `step8_dependencies_prompt`: analyzes vulnerability/version drift; does not author manifests

**Version target**: v7.0.0

### 4.2 `api_designer_prompt` (v7.1.0)

**Rationale**: No persona currently addresses API contract design — only documentation and code review personas exist. API design is a distinct discipline covering REST resource modeling, OpenAPI/Swagger specification, GraphQL schema design, versioning strategies, and contract-first development.

**Expertise areas**:
- REST API design (resource naming, HTTP methods, status codes, HATEOAS)
- OpenAPI 3.x / Swagger specification authoring and validation
- GraphQL schema design (types, queries, mutations, subscriptions, directives)
- gRPC / Protocol Buffers schema design
- API versioning strategies (URL versioning, header versioning, content negotiation)
- Backward compatibility and breaking change detection
- API security design (OAuth 2.0, API keys, rate limiting, CORS)
- Contract-first development workflow (spec → code generation)
- API documentation standards (OpenAPI, AsyncAPI, API Blueprint)

**Behavioral anchor**: `*behavioral_actionable`  
**Differentiates from**:
- `requirements_engineer_prompt`: defines functional requirements; does not specify API contracts
- `technical_writer_prompt`: documents existing APIs; does not design them
- `front_end_developer_prompt`: consumes APIs; does not design the contract

**Version target**: v7.1.0

### 4.3 `appsec_engineer_prompt` (v7.2.0)

**Rationale**: Security is covered only incidentally across several personas (`configuration_specialist_prompt` checks for exposed secrets; `aws_cloud_architect_prompt` covers AWS IAM). No persona focuses on application security: OWASP Top 10, SAST findings, threat modeling, input validation, or secure coding patterns.

**Expertise areas**:
- OWASP Top 10 vulnerability identification (injection, broken auth, XSS, IDOR, SSRF)
- Secure coding patterns (input validation, output encoding, parameterized queries)
- Authentication and authorization review (JWT security, OAuth 2.0 flows, session management)
- Secret detection and management (credentials in code, environment variable hygiene)
- Dependency vulnerability assessment (CVE analysis, supply chain security)
- Threat modeling (STRIDE, attack surface analysis, data flow diagrams)
- Security testing patterns (SAST, DAST, fuzzing, penetration testing guidance)
- Compliance mapping (OWASP ASVS, NIST, CIS Controls)
- Security code review methodology (file-by-file, trust boundary analysis)

**Behavioral anchor**: `*behavioral_structured`  
**Necessity gate**: Yes — structured 5-point gate (parallel to `technical_writer_prompt`'s 7-point gate)  
**Differentiates from**:
- `step9_code_quality_prompt`: quality and maintainability focus; not security-focused
- `aws_cloud_architect_prompt`: infrastructure security; not application-layer security
- `configuration_specialist_prompt`: config file secrets; not code-level security patterns

**Version target**: v7.2.0

### 4.4 `database_architect_prompt` (v7.3.0)

**Rationale**: Database design — schema evolution, indexing strategy, query optimization, migration management — has no coverage in the current persona set. Every non-trivial application has a data layer; this gap creates a blind spot in all project kinds except `configuration_library`.

**Expertise areas**:
- Relational schema design (normalization, denormalization, entity-relationship modeling)
- NoSQL data modeling (document, key-value, graph, time-series patterns)
- Migration management (Flyway, Liquibase, Alembic, Django migrations, Prisma)
- Indexing strategy (B-tree, hash, composite, covering indexes, partial indexes)
- Query optimization (EXPLAIN plans, N+1 detection, eager vs lazy loading)
- Data integrity constraints (foreign keys, check constraints, unique constraints)
- ORM patterns and anti-patterns (ActiveRecord, SQLAlchemy, Prisma, Hibernate)
- Database security (row-level security, encryption at rest, audit logging)
- Sharding and partitioning strategies for scale

**Behavioral anchor**: `*behavioral_structured`  
**Differentiates from**:
- `aws_cloud_architect_prompt`: infrastructure-level (RDS selection, Multi-AZ); not schema design
- `step9_code_quality_prompt`: code patterns; not data model design

**Version target**: v7.3.0

### 4.5 `go_developer_prompt` (v7.4.0)

**Rationale**: Go is growing in backend, CLI tooling, and infrastructure tooling (Kubernetes ecosystem, Terraform providers). The `go` language is covered in the language tables but has no developer persona for `go.mod` management, module versioning, or Go-specific tooling.

**Expertise areas**:
- `go.mod` / `go.sum` authoring and management
- Module versioning strategy (v1 → v2+ major version paths)
- Workspace mode (`go.work`) for multi-module development
- Dependency pinning and `go mod tidy` discipline
- Go toolchain: `go vet`, `golangci-lint`, `staticcheck`
- CGO dependency management
- Private module registry configuration (`GOPRIVATE`, `GONOSUMCHECK`)
- Go build constraints and cross-compilation
- Performance profiling tooling (`pprof`, `trace`)

**Behavioral anchor**: `*behavioral_actionable`  
**Version target**: v7.4.0

### 4.6 `gcp_cloud_architect_prompt` (v7.5.0)

**Rationale**: `aws_cloud_architect_prompt` is the only cloud persona. GCP is widely used for data/ML workloads, Kubernetes-native deployments (GKE), and Firebase-based projects.

**Expertise areas**:
- GCP core services: GCE, GCS, Cloud SQL/Spanner, GKE, Cloud Run, Pub/Sub, BigQuery, Firestore
- Infrastructure-as-Code: Terraform on GCP, Deployment Manager, Config Connector
- IAM: service accounts, Workload Identity Federation, org policies
- Security: VPC Service Controls, Binary Authorization, Cloud Armor, Secret Manager
- Networking: VPC design, Shared VPC, Cloud Interconnect, Cloud DNS
- Observability: Cloud Monitoring, Cloud Logging, Cloud Trace, Error Reporting
- Data and ML: BigQuery design, Vertex AI pipelines, Dataflow
- Cost optimization: Committed Use Discounts, preemptible/spot VMs, budget alerts
- GCP Migration: FAST landing zone, migration assessment

**Behavioral anchor**: `*behavioral_actionable`  
**Version target**: v7.5.0

---

## 5. Phase 3 — Architecture Evolution (v8.x.x)

**Goal**: Structural improvements to the persona system itself. Some changes are breaking for consumers; others are additive but require coordination.

### 5.1 Formal Persona Schema Versioning (v8.0.0)

Add a `schema_version` field to the file header and individual personas:

```yaml
_schema_version: "2.0"
_persona_schema:
  required_fields: [role_prefix, behavioral_guidelines, task_template, approach]
  optional_fields: [output_format, schema_version]
  deprecated_fields: [role]  # removed in v8.0.0
```

This enables:
- Automated schema validation in CI (`yamllint` extended with custom rules)
- Consumer compatibility checking (prompt builder can detect schema version)
- Clean deprecation of the legacy `role` field (fully removed in v8.0.0, not just emptied)

### 5.2 Necessity Gate Standardization (v8.1.0)

Standardize the necessity gate pattern — currently ad hoc in `technical_writer_prompt` and `requirements_engineer_prompt` — into a reusable YAML anchor:

```yaml
_necessity_gate_template: &necessity_gate_template |
  **STEP 0: NECESSITY EVALUATION** (Execute BEFORE all other steps):
  [Standard necessity check framework — parameterized by persona-specific criteria]
```

Apply abbreviated necessity gates to all output-generating personas:
- `technical_writer_prompt` — already has full 7-point gate ✅
- `requirements_engineer_prompt` — already has full 9-point gate ✅
- `api_designer_prompt` — add 5-point gate (Phase 2 addition)
- `appsec_engineer_prompt` — add 5-point gate (Phase 2 addition)
- `single_file_test_prompt` — add 3-point gate

### 5.3 Composite Debugging Persona (v8.2.0)

Merge the three debugging specialists (`observer_pattern_debugger_prompt`, `async_flow_debugger_prompt`, `data_structure_debugger_prompt`) into a single composite persona with routing logic:

```yaml
debugging_specialist_prompt:
  role_prefix: |
    You are a senior debugging specialist with expertise across three debugging domains:
    [Observer Pattern | Async Flow | Data Structure]
  behavioral_guidelines: *behavioral_actionable
  task_template: |
    **ROUTING**: Based on the error description, select the appropriate debugging mode:
    - Observer/Event issues → Observer Pattern Mode
    - Async/Promise/CORS → Async Flow Mode  
    - API contract/type mismatches → Data Structure Mode
    [Mode-specific task templates embedded]
```

**Rationale**: Three separate low-usage specialists create cognitive overhead; composing them saves prompt builders needing to select the right specialist upfront.

### 5.4 Multi-Language Developer Persona (v8.3.0)

Replace individual language developer personas with a composite persona parameterized by `primary_language`:

```yaml
language_developer_prompt:
  role_prefix: |
    You are a Senior {primary_language} Developer with expert-level expertise in
    {primary_language} package management, toolchain configuration, and ecosystem best practices.
  task_template: |
    ...
    **Language-Specific Expertise:** {language_specific_developer_guidance}
```

Add a new `language_specific_developer` context table (parallel to `language_specific_documentation`, `language_specific_quality`, `language_specific_testing`) covering all 9+ languages.

**Rationale**: Eliminates persona proliferation as new language personas are added; one persona covers all supported languages.

### 5.5 Adaptive Behavioral Anchor Selection (v8.4.0)

Currently, behavioral anchor selection (actionable vs structured) is hardcoded per persona. Add a `behavioral_mode` context variable that allows the prompt builder to override the anchor at runtime:

```yaml
# In persona definition:
behavioral_guidelines: "{behavioral_mode}"  # injected at runtime

# Prompt builder injects:
behavioral_mode: *behavioral_actionable   # or *behavioral_structured based on task
```

**Use case**: The same `api_designer_prompt` could run in `actionable` mode (produce the OpenAPI spec) or `structured` mode (audit an existing spec) depending on the workflow step.

### 5.6 Swift and Kotlin Language Tables (v8.5.0)

Add Swift and Kotlin to all three language tables, enabling full coverage for mobile development:

- **Swift**: Xcode documentation markup, SwiftLint rules, XCTest/Quick+Nimble
- **Kotlin**: KDoc/Dokka, ktlint + detekt, JUnit 5 + Kotest + MockK

Also add `mobile_developer_prompt` for iOS/Android/KMP/Flutter development, covering platform-specific patterns that `front_end_developer_prompt` does not address (native UI frameworks, app lifecycle, push notifications, offline sync, app store deployment).

---

## 6. Persona Inventory & Coverage Map

The following map shows which workflow steps each persona category covers, and where gaps remain after Phase 2:

```
WORKFLOW STAGES          CURRENT PERSONA              PHASE 2 ADDITION
─────────────────────────────────────────────────────────────────────────
Requirements             requirements_engineer_prompt
                         ui_ux_designer_prompt

API Design               [GAP]                      → api_designer_prompt (v7.1.0)

Architecture             aws_cloud_architect_prompt
                         step4_directory_prompt
                         database_architect_prompt [GAP] → v7.3.0
                         [GCP GAP]                 → gcp_cloud_architect_prompt (v7.5.0)

Security Review          configuration_specialist_prompt (config only)
                         [App Security GAP]         → appsec_engineer_prompt (v7.2.0)

Documentation            technical_writer_prompt
                         doc_analysis_prompt
                         consistency_prompt
                         step2_consistency_prompt
                         step3_script_refs_prompt
                         markdown_lint_prompt

Front-End Dev            front_end_developer_prompt
                         ui_ux_designer_prompt

Language Dev             javascript_developer_prompt
                         typescript_developer_prompt
                         [Python GAP]               → python_developer_prompt (v7.0.0)
                         [Go GAP]                   → go_developer_prompt (v7.4.0)
                         [Java GAP]

Testing                  test_strategy_prompt
                         single_file_test_prompt
                         step5_test_review_prompt
                         step7_test_exec_prompt
                         e2e_test_engineer_prompt

Code Quality             quality_prompt
                         step9_code_quality_prompt

Dependencies             step8_dependencies_prompt

Versioning               version_manager_prompt

Git / VCS                step11_git_commit_prompt

CI/CD Design             step3_script_refs_prompt (validation only)
                         [Pipeline Design GAP]      → cicd_pipeline_engineer_prompt

Debugging                observer_pattern_debugger_prompt
                         async_flow_debugger_prompt
                         data_structure_debugger_prompt

Prompt Engineering       step13_prompt_engineer_prompt
                         issue_extraction_prompt
```

---

## 7. Language Coverage Matrix

Current coverage (✅ = in all 3 tables, ⚠️ = partial, ❌ = missing):

| Language | Doc Table | Quality Table | Testing Table | Developer Persona |
|----------|-----------|--------------|--------------|-------------------|
| JavaScript | ✅ | ✅ | ✅ | ✅ `javascript_developer_prompt` |
| TypeScript | ✅ | ✅ | ✅ | ✅ `typescript_developer_prompt` |
| Python | ✅ | ✅ | ✅ | ❌ → Phase 2 (v7.0.0) |
| Go | ✅ | ✅ | ✅ | ❌ → Phase 2 (v7.4.0) |
| Java | ✅ | ✅ | ✅ | ❌ |
| Ruby | ✅ | ✅ | ✅ | ❌ |
| Rust | ✅ | ✅ | ✅ | ❌ |
| C++ | ✅ | ✅ | ✅ | ❌ |
| Bash | ✅ | ✅ | ✅ | ❌ |
| **C#** | ❌ → Phase 1 | ❌ → Phase 1 | ❌ → Phase 1 | ❌ |
| **Kotlin** | ❌ → Phase 1 | ❌ → Phase 1 | ❌ → Phase 1 | ❌ |
| **Swift** | ❌ → Phase 3 | ❌ → Phase 3 | ❌ → Phase 3 | ❌ |
| **PHP** | ❌ | ❌ | ❌ | ❌ |
| **Dart** | ❌ | ❌ | ❌ | ❌ |

**Target after Phase 1**: 11 languages (add C#, Kotlin)  
**Target after Phase 3**: 13 languages (add Swift, PHP)

---

## 8. Token Efficiency Targets

| Version | Change | Estimated Delta |
|---------|--------|----------------|
| v6.7.0 | Remove 11 legacy `role` fields | −110 to −165 tokens/workflow |
| v6.7.3 | Add `behavioral_generative` anchor (shared across 3+ personas) | −20 to −40 tokens |
| v6.7.4 | Move 3 non-standard fields into `approach` blocks | −30 to −50 tokens |
| v7.x.x | New personas added (net token cost per loaded persona) | +600 to +1,000 tokens each |
| v8.2.0 | Composite debugging persona (replace 3 with 1) | −300 to −500 tokens if all 3 debug specialists load |
| v8.3.0 | Multi-language developer persona (replace N with 1) | −300 tokens per language persona eliminated |

**Cumulative Phase 1 net savings**: ~160–255 tokens/workflow  
**Running total** (vs v3.0.0 baseline after Phase 1): ~1,490–1,755 tokens saved per workflow

---

## 9. Prioritized Backlog

Items sorted by value/effort ratio (highest priority first):

### Immediate (v6.7.x — no new personas, low risk)

| ID | Item | Effort | Impact |
|----|------|--------|--------|
| R-01 | Remove legacy `role` fields from 11 personas | Low | Medium — token savings, schema cleanliness |
| R-02 | Modernize `single_file_test_prompt` to v6.x pattern | Low | Medium — behavioral consistency |
| R-03 | Add `task_template` to `version_manager_prompt` | Low | Medium — consistent context injection |
| R-04 | Add `behavioral_generative` anchor | Low | Medium — better fit for pure-generation tasks |
| R-05 | Move non-standard fields to `approach` blocks | Low | Low — schema cleanliness |
| R-06 | Add C# and Kotlin to language tables | Medium | High — covers enterprise/Android ecosystem |
| R-07 | Clarify `quality_prompt` vs `step9` differentiation | Low | Medium — reduces usage confusion |

### Near-Term (v7.0.x — new high-value personas)

| ID | Item | Effort | Impact |
|----|------|--------|--------|
| N-01 | `python_developer_prompt` | Medium | High — Python is 3rd most common language |
| N-02 | `api_designer_prompt` | High | High — covers critical design gap |
| N-03 | `appsec_engineer_prompt` | High | High — security gap is high risk |
| N-04 | `database_architect_prompt` | High | High — data layer gap affects all non-config projects |

### Medium-Term (v7.x.x — cloud and toolchain expansion)

| ID | Item | Effort | Impact |
|----|------|--------|--------|
| M-01 | `go_developer_prompt` | Medium | Medium — Go growing in infrastructure tooling |
| M-02 | `gcp_cloud_architect_prompt` | High | Medium — covers GCP/data workloads |
| M-03 | `cicd_pipeline_engineer_prompt` | Medium | Medium — fills gap between script validation and design |

### Long-Term (v8.x.x — architectural evolution)

| ID | Item | Effort | Impact |
|----|------|--------|--------|
| L-01 | Formal persona schema versioning | Medium | High — enables automated validation |
| L-02 | Necessity gate standardization via anchor | Medium | Medium — consistency across all personas |
| L-03 | Composite debugging persona | High | Medium — reduces cognitive overhead |
| L-04 | Multi-language developer persona with injection table | High | High — eliminates persona proliferation |
| L-05 | Adaptive behavioral anchor selection | High | Medium — enables persona reuse across modes |
| L-06 | Swift and Kotlin language tables + mobile persona | Medium | Medium — enables mobile project kinds |

---

*Document version: 1.0.1 — Covers ai_helpers.yaml v6.6.0 baseline*  
*Next review: After Phase 1 (v6.7.x) is complete*
