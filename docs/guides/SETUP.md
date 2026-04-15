# Setup Guide

Use `scripts/setup.sh` to prepare a local development checkout for work on
`ai_workflow.js`.

## What it does

- checks for Node.js and npm
- installs project dependencies with `npm install`
- initializes git submodules when the repo is cloned as a git checkout
- creates the standard `.ai_workflow/` artifact directories
- appends missing `.ai_workflow/` ignore rules to `.gitignore`

## Usage

```bash
bash scripts/setup.sh
```

Run it from the repository root.

## When to use it

- after cloning the repository for the first time
- after refreshing submodules in a fresh checkout
- when you need the expected `.ai_workflow/` directory layout recreated locally

## Related docs

- [Scripts Reference](../../scripts/README.md)
- [Installation Guide](../getting-started/INSTALLATION.md)
