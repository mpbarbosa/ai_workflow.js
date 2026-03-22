# Contributing to guia_turistico

Thank you for your interest in contributing to guia_turistico! This guide explains how to set up your environment, follow our coding standards, and submit changes.

## Getting Started

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-org/guia_turistico.git
   cd guia_turistico
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

- Use JavaScript (ES6+) for all source files
- Follow existing code style and naming conventions
- Write clear, descriptive comments and JSDoc for all public functions/classes
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

The `scripts/` directory provides automation for common development and release tasks. Run `bash scripts/<name>.sh --help` for full options.

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
