# Contributing to ai_workflow.js

Thank you for your interest in contributing to **ai_workflow.js**! This document provides guidelines for contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Code Style](#code-style)
- [Testing](#testing)
- [Commit Messages](#commit-messages)
- [Pull Request Process](#pull-request-process)
- [Architecture](#architecture)

---

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](https://www.contributor-covenant.org/version/2/1/code_of_conduct/). By participating, you are expected to uphold this code.

---

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone --recursive https://github.com/YOUR_USERNAME/ai_workflow.js.git
   cd ai_workflow.js
   ```
3. **Set up the upstream remote**:
   ```bash
   git remote add upstream https://github.com/mpbarbosa/ai_workflow.js.git
   ```
4. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

---

## Development Setup

### Prerequisites

- **Node.js**: >= 18.0.0
- **npm**: >= 9.0.0
- **Git**: For cloning and submodule management

### Installation

```bash
# Initialize submodules
git submodule update --init --recursive

# Install dependencies
npm install

# Run tests to verify setup
npm test
```

### Development Workflow

```bash
# Run tests in watch mode
npm run test:watch

# Run linter
npm run lint

# Auto-fix linting issues
npm run lint:fix

# Format code
npm run format

# Check formatting
npm run format:check
```

---

## Code Style

This project uses **ESLint** and **Prettier** for code quality and formatting.

### Style Guidelines

- **JavaScript**: ES6+ modules (ESM), async/await patterns
- **Indentation**: 2 spaces
- **Semicolons**: Required
- **Quotes**: Single quotes for strings
- **Line length**: Max 100 characters (soft limit)
- **Comments**: Use JSDoc for function documentation

### Functional Programming Principles

**Phase 2.1 modules** follow **referential transparency** principles:

- **Pure functions**: Extract core logic as pure, referentially transparent functions
- **Side effects**: Isolate I/O, logging, and time dependencies to wrapper classes
- **Immutability**: Return new values instead of mutating state
- **Testability**: Pure functions are easy to test without mocks

See [CHANGELOG.md](./CHANGELOG.md) section on "Referential Transparency Refactoring" for examples.

### Pre-commit Hooks

The project uses **Husky** and **lint-staged** to run checks before commits:

- ESLint on staged `.js` files
- Prettier formatting check

Commits will be blocked if checks fail. Run `npm run lint:fix` and `npm run format` to fix issues.

---

## Testing

### Test Requirements

- **All new code must have tests**
- **Aim for 100% code coverage** (currently 89 tests passing)
- Use **Jest** testing framework
- Follow existing test patterns (pure function tests + integration tests)

### Test Structure

```javascript
describe('ModuleName', () => {
  describe('pureFunctionName', () => {
    it('should return expected output for given input', () => {
      // Arrange
      const input = {
        /* test data */
      };

      // Act
      const result = pureFunctionName(input);

      // Assert
      expect(result).toEqual(expectedOutput);
    });
  });
});
```

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

### Test Coverage Goals

- **Phase 1 & 2.1 modules**: 100% coverage (current)
- **New modules**: Minimum 90% coverage
- **Critical paths**: 100% coverage required

---

## Commit Messages

This project follows **Conventional Commits** specification.

### Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, no logic change)
- `refactor`: Code refactoring (no feature change)
- `test`: Adding or updating tests
- `chore`: Maintenance tasks (dependencies, tooling)

### Examples

```
feat(lib): add file_operations module with pure functions

Implement file_operations.js with referentially transparent functions
for file system operations. Side effects isolated to wrapper class.

Closes #42
```

```
fix(metrics): correct step duration calculation

Fixed off-by-one error in step timing that caused incorrect
duration reporting in workflow metrics.
```

```
docs(readme): add development setup section

Added prerequisites, quick start guide, and available commands
to improve contributor onboarding experience.
```

---

## Pull Request Process

### Before Submitting

1. **Update your branch** with latest upstream:

   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

2. **Run all checks**:

   ```bash
   npm test
   npm run lint
   npm run format:check
   ```

3. **Update documentation** if needed:
   - README.md for user-facing changes
   - JSDoc comments for API changes
   - CHANGELOG.md entry (will be added by maintainers)

### PR Checklist

- [ ] Tests pass (`npm test`)
- [ ] Linting passes (`npm run lint`)
- [ ] Formatting correct (`npm run format:check`)
- [ ] New code has tests (aim for 100% coverage)
- [ ] Documentation updated if needed
- [ ] Commit messages follow conventional commits
- [ ] Branch is up-to-date with `main`

### PR Description

Include in your PR description:

- **Purpose**: What problem does this solve?
- **Approach**: How does it solve the problem?
- **Testing**: How was this tested?
- **Screenshots**: If UI-related (N/A for this project)
- **Related Issues**: Link to GitHub issues

### Review Process

- Maintainers will review your PR
- Address feedback and push updates
- Once approved, maintainers will merge

---

## Architecture

### Project Structure

```
ai_workflow.js/
├── src/
│   ├── cli/              # Command-line interface (future)
│   ├── lib/              # Core library modules
│   ├── core/             # Foundation utilities (Phase 1)
│   └── index.js          # Main entry point
├── test/                 # Jest test suite
│   ├── core/             # Core module tests
│   └── lib/              # Library module tests
├── docs/                 # Documentation
│   └── reports/implementation/  # MIGRATION_PLAN.md
└── .workflow_core/       # Git submodule (config templates)
```

### Key Documents

- **[MIGRATION_PLAN.md](./docs/reports/implementation/MIGRATION_PLAN.md)**: Comprehensive migration plan with phases, architecture, and implementation details
- **[FUNCTIONAL_REQUIREMENTS.md](./docs/FUNCTIONAL_REQUIREMENTS.md)**: Detailed module requirements for Phase 1 & 2.1
- **[CHANGELOG.md](./CHANGELOG.md)**: Version history and notable changes

### Implementation Phases

1. **Phase 1**: Foundation & Core Utilities ✅ (Complete)
2. **Phase 2**: Core Workflow Library (In Progress - 2.1 complete)
3. **Phase 3**: AI Integration
4. **Phase 4**: Workflow Execution Engine
5. **Phase 5**: Step Implementations
6. **Phase 6**: Performance Optimizations
7. **Phase 7**: CLI & User Interface
8. **Phase 8**: Testing & Quality Assurance
9. **Phase 9**: Documentation & Examples
10. **Phase 10**: Packaging & Distribution

See [MIGRATION_PLAN.md](./docs/reports/implementation/MIGRATION_PLAN.md) for detailed phase descriptions.

---

## Questions?

- **GitHub Issues**: [ai_workflow.js/issues](https://github.com/mpbarbosa/ai_workflow.js/issues)
- **Discussions**: Use GitHub Discussions for questions
- **Source Repository**: [ai_workflow](https://github.com/mpbarbosa/ai_workflow) (Shell version)

---

**Thank you for contributing!** 🎉
