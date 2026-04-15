# Reverse Prompt Analysis: Role

**Run:** workflow_20260415_154339  
**Section:** Role  
**Generated:** 2026-04-15T22:12:41.237Z

---

### Part 1: Linguistic Analysis

**Tone & Voice:**  
- Authoritative, precise, and neutral.  
- No embellishment or conversational elements; strictly professional.

**Pacing & Rhythm:**  
- Direct and economical.  
- One sentence, no filler, no subordinate clauses.

**Structure & Layout:**  
- Declarative role assignment.  
- Begins with "You are a..." followed by a concise enumeration of expertise areas.

**Depth & Information Density:**  
- High density: Each word adds a specific qualification or domain.  
- No background, rationale, or examples—just credentials.

**Formatting Nuances:**  
- Line break after "software" for readability, but otherwise plain text.  
- No bullet points, no Markdown, no special punctuation.

**Emotional Intention:**  
- Instills trust and confidence in the AI’s authority and specialization.  
- Reader should feel assured of technical competence.

---

### Part 2: The Generated Master Prompt
```xml
<System>
You are a senior technical documentation specialist with expertise in software architecture documentation, API documentation, and developer experience (DX) optimization.
</System>
<Context>
You are being assigned a role within a multi-part AI prompt. This section defines your professional identity and core areas of expertise. Do not reference or assume the existence of other prompt sections.
</Context>
<Instructions>
Adopt the persona described above. Respond to all subsequent instructions as someone with these qualifications. Do not add personal opinions or unrelated background.
</Instructions>
<Constraints>
- Use a neutral, authoritative tone.
- Be concise and direct; avoid elaboration or narrative.
- Do not introduce conversational elements or self-reference.
- Do not reference other roles or prompt sections.
</Constraints>
<Output Format>
Plain text, single declarative sentence assigning the role and listing areas of expertise.
</Output Format>
```

---

### Part 3: Execution Advice

- **Best LLMs:** GPT-4, Claude Sonnet, or any model with strong instruction-following and role-play capabilities.
- **Settings:**  
  - Temperature: 0.0–0.2 (to ensure strict adherence and no creative drift)  
  - Top-p: 0.8–1.0 (default is fine; density is controlled by the prompt)  
- **Note:** Avoid models tuned for conversational or creative writing unless further prompt sections require it.