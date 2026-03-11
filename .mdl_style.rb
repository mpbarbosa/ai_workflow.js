# .mdl_style.rb — markdownlint (mdl) style configuration for ai_workflow.js
#
# Used by step_13_markdown_lint.js via: mdl --style ".mdl_style.rb"
# Run directly:  mdl --ignore-front-matter --style .mdl_style.rb <files>
#
# Policy decisions:
#   MD007 indent:2  – project uses 2-space nested list indentation (fix-markdown.js standard)
#   MD026 punctuation excludes '?' – FAQ-style question headers are legitimate
#   Disabled rules – intentionally relaxed for AI-generated content (see docs/MARKDOWN_LINTING_GUIDE.md)

all

# ── Rule parameters ──────────────────────────────────────────────────────────

# MD007: project standard is 2-space list indentation
rule 'MD007', :indent => 2

# MD026: allow '?' in FAQ-style headers; strip only . , ; : !
rule 'MD026', :punctuation => '.,;:!'

# ── Disabled rules ───────────────────────────────────────────────────────────
# These are intentionally relaxed for AI-generated content and long-form docs.

exclude_rule 'MD001'   # header-level increments – document structure flexibility
exclude_rule 'MD002'   # first header level      – document structure flexibility
exclude_rule 'MD012'   # multiple blank lines    – visual separation preference
exclude_rule 'MD013'   # line length             – long URLs, code blocks, tables
exclude_rule 'MD022'   # blank lines around headers – compact formatting
exclude_rule 'MD029'   # ordered list prefixes   – numbering flexibility
exclude_rule 'MD031'   # blank lines around code blocks – compact formatting
exclude_rule 'MD032'   # blank lines around lists – compact formatting
