# Security Policy

## Supported Versions

We release security updates for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |
| < 1.0.0 | :x:                |

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, please report them via email to the project maintainer:

- Email: [Create an issue with "SECURITY" prefix](https://github.com/mpbarbosa/ai_workflow.js/issues/new?labels=security)
- Response time: Within 48 hours

### What to include in your report

- Type of vulnerability
- Full paths of source file(s) related to the vulnerability
- Location of the affected source code (tag/branch/commit or direct URL)
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the vulnerability

### What to expect

1. **Acknowledgment**: Within 48 hours
2. **Investigation**: 1-3 business days
3. **Fix Development**: Depends on severity
4. **Disclosure**: Coordinated disclosure after patch release

### Security Best Practices

When using ai_workflow.js:

1. **Keep dependencies updated**: Run `npm audit` regularly
2. **Review configuration**: Never commit secrets to `.workflow-config.yaml`
3. **Validate inputs**: When extending the tool, sanitize all user inputs
4. **Use latest version**: Security fixes are only backported to supported versions
5. **Monitor logs**: Check `.ai_workflow/logs/` for suspicious activity

### Known Security Considerations

- **Command Execution**: The tool executes shell commands. Ensure proper input validation.
- **File System Access**: The tool reads/writes files. Use appropriate permissions.
- **AI Integration**: GitHub Copilot API credentials are required. Keep tokens secure.

### Security Scanning

This project includes automated security scanning:

- **npm audit**: Checks for dependency vulnerabilities
- **Custom security scanner**: `scripts/security-audit.js`
- **CodeQL**: Automated code scanning via GitHub Actions

Run security checks locally:

```bash
# npm vulnerability scan
npm audit

# Custom security scanner
node scripts/security-audit.js
```

## Disclosure Policy

When a security vulnerability is discovered:

1. A patch will be developed privately
2. A security advisory will be published on GitHub
3. The fix will be released as soon as possible
4. CVE identifiers will be requested for significant vulnerabilities
5. Public disclosure coordinated with the reporter

## Security Updates

Subscribe to security updates:

- Watch the repository for releases
- Enable GitHub security alerts for dependencies
- Follow the project's [CHANGELOG.md](CHANGELOG.md)

## Contact

For non-security issues, please use the standard [issue tracker](https://github.com/mpbarbosa/ai_workflow.js/issues).

For security concerns: Create a security issue or contact the maintainer directly.

---

**Last Updated**: 2026-02-17
