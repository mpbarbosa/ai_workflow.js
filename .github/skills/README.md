# Copilot CLI Skills

This directory contains **custom skill definitions** for the
[GitHub Copilot CLI](https://docs.github.com/en/copilot/using-github-copilot/using-copilot-in-the-command-line).
Skills extend Copilot with project-specific automated workflows that can be
invoked by name during a chat session.

## Available skills

| Skill              | Directory           | Purpose                                                                         |
| ------------------ | ------------------- | ------------------------------------------------------------------------------- |
| `update-pajussara` | `update-pajussara/` | Bump the `pajussara_tui_comp` dependency to the latest (or a specified) release |

## How skills work

Each skill lives in its own subdirectory and contains a `SKILL.md` file with:

- A YAML front-matter block declaring the skill `name` and `description`
- A prose body describing what the skill does, its prerequisites, and its
  step-by-step execution logic

Copilot reads `SKILL.md` at runtime and follows the instructions inside it
when the skill is invoked.

## Using a skill

In a Copilot CLI session, run:

```
Run the update-pajussara skill
```

Copilot will load the matching `SKILL.md` and execute the defined workflow.

## Adding a new skill

1. Create a subdirectory: `.github/skills/<skill-name>/`
2. Add a `SKILL.md` following the existing template (YAML front-matter +
   prose instructions).
3. Register the skill in the table above.

For detailed authoring guidance see the
[Copilot CLI skill authoring docs](https://docs.github.com/en/copilot/using-github-copilot/using-copilot-in-the-command-line).
