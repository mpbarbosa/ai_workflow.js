# Contributing to olinda_shell_interface.js

Thank you for your interest in contributing! This guide explains how to set up your environment, follow our coding standards, and submit changes.

## Getting Started

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-org/olinda_shell_interface.js.git
   cd olinda_shell_interface.js
   ```
2. **Install dependencies:**
   ```bash
   npm install
   ```
3. **Run tests:**
   ```bash
   npm test
   ```

## Coding Standards

- Use TypeScript for all source files
- Follow existing code style and naming conventions
- Write clear, descriptive comments for complex logic
- Run `npm run lint` before submitting

## Submitting Changes

1. **Fork the repository** and create a feature branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```
2. **Make your changes** and add tests as needed
3. **Commit with a descriptive message:**
   ```bash
   git commit -m "feat: add new feature"
   ```
4. **Push your branch** and open a pull request

## Scripts

The `scripts/` directory provides automation for common development and release tasks:

| Script                         | Purpose                                                   | Exit codes                       |
| ------------------------------ | --------------------------------------------------------- | -------------------------------- |
| `scripts/setup.sh`             | Install deps, init submodules, create artifact dirs       | 0 success / non-zero on error    |
| `scripts/validate.sh`          | Lint, format check, tests, version consistency            | 0 all pass / non-zero on failure |
| `scripts/test-integration.sh`  | Integration tests (pass `--coverage` for coverage report) | 0 all pass / non-zero on failure |
| `scripts/prepare-release.sh`   | Bump version, update CHANGELOG, run full validation       | 0 success / non-zero on error    |
| `scripts/cleanup_artifacts.sh` | Delete old `.ai_workflow/` artifacts by age or type       | 0 success / non-zero on error    |

Run `bash scripts/<name>.sh --help` for full options.

## Testing

- All new features must include tests
- Run `npm test` to verify
- Ensure no test failures before submitting

## Code Review

- Pull requests are reviewed for correctness, clarity, and test coverage
- Address all review comments promptly

## License

By contributing, you agree your code will be released under the MIT License.

---

For questions, open an issue or contact the maintainers.
