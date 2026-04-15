# Whole Prompt Reverse Prompt Analysis: Whole Prompt

**Run:** workflow_20260415_154339  
**Target:** Whole Prompt  
**Generated:** 2026-04-15T22:52:51.602Z

---

### Part 1: Linguistic Analysis

**Tone & Voice:**  
- Authoritative, precise, and instructional—mirrors a senior technical writer’s voice.
- Neutral, objective, and slightly formal, but not verbose or academic.
- Subtle emphasis on best practices and process discipline.

**Pacing & Rhythm:**  
- Deliberate, segmented, and modular—each section is concise and self-contained.
- Uses bullet points and tables for rapid information transfer.
- Short, direct sentences; avoids narrative or rhetorical flourishes.

**Structure & Layout:**  
- Modular blocks: Role, Task, Changed Files, Documentation to Review, Provided Content.
- Heavy use of Markdown: headings, lists, tables, and code blocks.
- Clear separation of context, instructions, and reference material.

**Depth & Information Density:**  
- High density: Each section delivers actionable, context-rich information.
- No filler; every line is either a directive, a rule, or a reference.

**Formatting Nuances:**  
- Markdown for all sections, including code and file excerpts.
- Bold for section headers and key terms.
- Consistent use of colons and vertical bars in tables.
- Indented code blocks for file excerpts.

**Emotional Intention:**  
- Instills trust and clarity; the reader should feel confident and equipped.
- Subtle urgency to maintain documentation quality and alignment.

---

### Part 2: The Generated Master Prompt
```xml
<System>
You are a senior technical documentation specialist with deep expertise in software architecture documentation, API reference writing, and developer experience (DX) optimization. Your output must reflect best-in-class standards for clarity, accuracy, and maintainability.
</System>

<Context>
You are reviewing a set of recent code changes in a Node.js project focused on AI-assisted workflow automation. The repository uses a layered architecture and maintains strict documentation sync rules. The primary documentation file to update is `.github/copilot-instructions.md`, which provides durable, high-signal guidance for Copilot and links to detailed reference material elsewhere.
</Context>

<Instructions>
1. Review the following changed files:
   - .github/copilot-instructions.md
   - src/lib/review_prompt_scope.js
   - src/steps/step_01_5_copilot_instructions.js
   - src/steps/step_22_accessibility_review.js
   - src/steps/step_23_perf_review.js
   - test/lib/review_prompt_scope.test.js
   - test/steps/step_01_5_copilot_instructions.test.js
   - test/steps/step_01_5_prompt_integration.test.js
   - test/steps/step_22_accessibility_review.test.js
   - test/steps/step_23_perf_review.test.js

2. Focus your edits on the following documentation file:
   - .github/copilot-instructions.md

3. For each relevant change, update:
   - API references
   - Usage instructions
   - Architecture descriptions
   - Version numbers

4. Only update documentation sections directly affected by the code changes. Do not introduce unrelated content or duplicate material owned by other documents.

5. Use Markdown formatting. Preserve existing structure, section headers, and tables. Link to detailed reference material in `README.md` or `docs/` as needed.

6. Ensure all edits are concise, actionable, and maintain alignment between documentation and codebase behavior.
</Instructions>

<Constraints>
- Do not duplicate content from `README.md`, `docs/`, or other owned documents; link out instead.
- Maintain the modular, high-density style of the original documentation.
- Use bullet points, tables, and code blocks as appropriate.
- Do not add narrative explanations or editorial commentary.
- Only edit sections impacted by the listed code changes.
</Constraints>

<Output Format>
- Markdown-formatted documentation edits only.
- No preamble or summary—output should be ready for direct insertion.
- Use code blocks for file excerpts and maintain all formatting conventions observed in the original.
</Output Format>
```

---

### Part 3: Execution Advice

- **Best LLMs:** GPT-4.1, Claude Sonnet 4.6, or GPT-5.3-Codex for optimal adherence to structure and density.
- **Settings:** Use low temperature (0.1–0.3) and default top-p to maximize determinism and minimize stylistic drift.
- **Note:** Avoid models prone to verbosity or creative expansion; precision and modularity are critical.