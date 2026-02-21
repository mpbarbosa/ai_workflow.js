# Prompt Keys → Workflow Steps

Mapping of all `ai_helpers.yaml` top-level prompt keys to their corresponding JavaScript workflow step.

**AI Status legend:** ✅ Implemented (step calls AI) · 📋 Pending (prompt exists, step uses local logic only) · 🔧 Utility (on-demand, not a workflow step) · — Not applicable

## Prompt Mappings

| # | Prompt Key | Description | JS Step | Shell Step Name | AI Status |
|---|------------|-------------|---------|-----------------|----------|
| 1 | `doc_analysis_prompt` | Incremental documentation updates after code changes | step_01 Documentation Updates | documentation_updates | ✅ |
| 2 | `consistency_prompt` | Documentation quality auditing / consistency checks (generic fallback) | step_02 Consistency Analysis | consistency_analysis | ✅ |
| 3 | `technical_writer_prompt` | Bootstrap docs from scratch / major rewrites | step_0b Bootstrap Documentation | bootstrap_documentation | ✅ |
| 4 | `front_end_developer_prompt` | Front-end code implementation and architecture | *(utility — on-demand persona, no workflow step planned)* | — | 🔧 |
| 5 | `e2e_test_engineer_prompt` | E2E browser automation & visual testing *(new v6.3.1)* | *(utility — on-demand persona, no workflow step planned)* | — | 🔧 |
| 6 | `ui_ux_designer_prompt` | UX design, interaction patterns | step_15 UX Analysis | ux_analysis | ✅ |
| 7 | `requirements_engineer_prompt` | Requirements elicitation, specification, traceability | *(utility — on-demand persona, no workflow step planned)* | — | 🔧 |
| 8 | `test_strategy_prompt` | Strategic test coverage gap analysis (WHAT to test) | *(utility — on-demand persona, no workflow step planned)* | — | 🔧 |
| 9 | `quality_prompt` | File-level code review / quick quality checks | *(superseded by `step9_code_quality_prompt` in step_10)* | — | — |
| 10 | `issue_extraction_prompt` | Extract actionable issues from analysis output | *(utility — post-analysis helper, no workflow step planned)* | — | 🔧 |
| 11 | `step2_consistency_prompt` | Step 2 — Documentation consistency analysis | step_02 Consistency Analysis | consistency_analysis | ✅ |
| 12 | `step3_script_refs_prompt` | Step 3 — Shell script reference validation | step_03 Script References | script_reference_validation | ✅ |
| 13 | `step4_directory_prompt` | Step 4 — Directory structure validation ¹ | step_05 Directory Structure | directory_validation | ✅ |
| 14 | `step5_test_review_prompt` | Step 5 — Test code quality review (HOW tests are written) | step_06 Test Review | test_review | ✅ |
| 15 | `step7_test_exec_prompt` | Step 7 — Test execution analysis | step_08 Test Execution | test_execution | ✅ |
| 16 | `step8_dependencies_prompt` | Step 8 — Dependency management analysis | step_09 Dependency Analysis | dependency_validation | ✅ |
| 17 | `step9_code_quality_prompt` | Step 9 — Comprehensive architectural/code quality review | step_10 Code Quality | code_quality_validation | ✅ |
| 18 | `step11_git_commit_prompt` | Step 11 — Git commit message generation | step_12 Git Finalization | git_commit | ✅ |
| 19 | `markdown_lint_prompt` | Markdown linting analysis | step_13 Markdown Linting | markdown_linting | ✅ |
| 20 | `configuration_specialist_prompt` | Config file validation (syntax, security, best practices) | step_04 Configuration Validation | config_validation | ✅ |
| 21 | `step13_prompt_engineer_prompt` | Step 13 — Prompt engineer analysis | step_14 Prompt Engineering | prompt_engineer_analysis | ✅ |
| 22 | `version_manager_prompt` | Semantic version bump determination | step_16 Version Update | version_update | ✅ |
| 23 | `observer_pattern_debugger_prompt` | Observer pattern debugging specialist | *(utility — on-demand debugging, no workflow step)* | — | 🔧 |
| 24 | `async_flow_debugger_prompt` | Async flow debugging specialist | *(utility — on-demand debugging, no workflow step)* | — | 🔧 |
| 25 | `data_structure_debugger_prompt` | Data structure debugging specialist | *(utility — on-demand debugging, no workflow step)* | — | 🔧 |

## Non-Prompt Top-Level Keys

These are YAML data maps (not prompts) injected as language-specific context into prompts at runtime.

| Key | Type | Purpose |
|-----|------|--------|
| `language_specific_documentation` | Map (by language) | Language-specific context injected into `doc_analysis_prompt` / `technical_writer_prompt` |
| `language_specific_quality` | Map (by language) | Language-specific context injected into quality prompts |
| `language_specific_testing` | Map (by language) | Language-specific context injected into test prompts |

## Steps with No AI Calls (intentional)

These steps have no prompt mapping and do not call AI — by design:

| Step | Name | Reason |
|------|------|-------|
| step_00 | Pre-Analysis | Structural project detection only |
| step_02_5 | Doc Optimization | Heuristics-based analysis |
| step_07 | Test Generation | Runs test commands directly |
| step_11 | Context Management | File aggregation |
| step_0f | Commit Artifacts | Git operations |
| step_17 | Workflow Summary | Aggregation of step results |

## Notes

¹ **Numbering mismatch**: `step4_directory_prompt` is named after shell workflow "Step 4" (directory validation), but in the JS implementation directory validation runs as `step_05`. The JS `step_04` is Configuration Validation, which uses `configuration_specialist_prompt`.

**Utility prompts (🔧 — no workflow step)**: `front_end_developer_prompt`, `e2e_test_engineer_prompt`, `requirements_engineer_prompt`, `test_strategy_prompt`, `issue_extraction_prompt` are generic AI personas available for on-demand use (e.g., called directly from the CLI or by future tooling), but are not wired into any numbered workflow step. The three debugger prompts (`observer_pattern_debugger_prompt`, `async_flow_debugger_prompt`, `data_structure_debugger_prompt`) are similarly available for interactive debugging sessions.

**`quality_prompt`**: Superseded by `step9_code_quality_prompt` in step_10 (Code Quality). The generic `quality_prompt` provides a lightweight file-level review persona, while `step9_code_quality_prompt` delivers a comprehensive architectural/code quality analysis used by the workflow. No separate workflow step is needed.

**All prompt gaps resolved**: As of this version, every prompt with a corresponding JS workflow step has an active AI call (✅). The 📋 Pending status for `ui_ux_designer_prompt` was resolved by implementing real AI calls (`discoverFiles` + `performAnalysis`) in `step_15_ux_analysis.js`.
