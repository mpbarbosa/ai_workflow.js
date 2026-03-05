# GitHub Actions Workflows

This directory contains automated CI/CD workflows for the ai_workflow.js project.

## Workflows

### 🔄 CI (`ci.yml`)

**Triggers:** Push/PR to `main` or `develop` branches

**Jobs:**

1. **Test Matrix** - Tests on Node.js 18.x, 20.x, 22.x
   - ✅ Lint check with ESLint
   - ✅ Full test suite (3417 passing of 3435 total, 18 skipped)
   - ✅ Node modules caching (60% faster)

2. **Coverage Report** - Generates and uploads coverage to Codecov
   - Current coverage: 87.29%
   - Uploads to Codecov (requires `CODECOV_TOKEN` secret)

3. **Lint Staged** - Lints only changed files in PRs
   - Runs lint-staged on modified files
   - Faster than full lint

4. **Build Check** - Verifies package.json configuration
   - Ensures ES modules type
   - No build step required (native ESM)

5. **All Checks Pass** - Final status gate
   - Blocks merge if any check fails

**Performance:**

- Without cache: ~2-3 minutes
- With cache: ~45-90 seconds (60% improvement)

---

### 💬 Coverage Comment (`coverage-comment.yml`)

**Triggers:** Pull requests to `main` or `develop`

**Purpose:** Posts coverage report as PR comment

**Features:**

- Visual coverage breakdown by metric
- Emoji status indicators (🟢 🟡 🔴)
- Coverage status guide
- Auto-updates on each push

**Permissions Required:** `pull-requests: write`

**Example Output:**

```markdown
## 📊 Coverage Report

| Metric     | Coverage | Status |
| ---------- | -------- | ------ |
| Statements | 87.29%   | 🟡     |
| Branches   | 84.22%   | 🟡     |
| Functions  | 92.59%   | 🟢     |
| Lines      | 87.50%   | 🟡     |
```

---

### 🔒 Dependency Review (`dependency-review.yml`)

**Triggers:** PRs that modify `package.json` or `package-lock.json`

**Purpose:** Security and dependency analysis

**Checks:**

- Dependency review action (checks for vulnerabilities)
- `npm audit` for security issues
- Outdated dependencies check

**Fail Conditions:**

- Moderate or higher severity vulnerabilities
- Failed security audit

---

### 🛡️ CodeQL Security (`codeql.yml`)

**Triggers:**

- Push/PR to `main` or `develop`
- Weekly schedule (Mondays at 00:00 UTC)

**Purpose:** Static security analysis

**Features:**

- GitHub Security tab integration
- Detects security vulnerabilities
- Code quality analysis
- Automated weekly scans

**Results:** Available in Security > Code scanning alerts

---

## Cache Strategy

### Node Modules Cache

**Key:** `${{ runner.os }}-node-${{ matrix.node-version }}-${{ hashFiles('package-lock.json') }}`

**Benefits:**

- 60% faster CI runs
- Reduced npm install time (120s → 20s)
- Lower network usage

**Cache Hit Conditions:**

- Same OS (Linux)
- Same Node.js version
- Same package-lock.json hash

**Cache Miss Triggers:**

- New dependencies added
- Dependencies updated
- Different Node.js version

---

## Setup Instructions

### 1. Enable Workflows

Workflows are automatically enabled when pushed to GitHub.

### 2. Configure Secrets (Optional)

For full functionality, add these secrets in **Settings > Secrets and variables > Actions**:

#### Required for Coverage Upload

```
CODECOV_TOKEN=<your-codecov-token>
```

Get token from: https://codecov.io/

#### Auto-configured by GitHub

- `GITHUB_TOKEN` - Automatically provided (no setup needed)

### 3. Branch Protection Rules (Recommended)

**Settings > Branches > Add rule for `main`:**

- ✅ Require a pull request before merging
- ✅ Require status checks to pass before merging:
  - Test (Node 18.x)
  - Test (Node 20.x)
  - Test (Node 22.x)
  - Coverage Report
  - Build Check
  - All Checks Passed
- ✅ Require branches to be up to date before merging
- ✅ Do not allow bypassing the above settings

### 4. Codecov Integration (Optional)

1. Sign up at https://codecov.io with GitHub
2. Add repository to Codecov
3. Copy token to GitHub secrets as `CODECOV_TOKEN`
4. Coverage reports will appear on PRs

---

## Workflow Status Badges

Add to your README.md:

```markdown
![CI](https://github.com/mpbarbosa/ai_workflow.js/workflows/CI/badge.svg)
![Coverage](https://codecov.io/gh/mpbarbosa/ai_workflow.js/branch/main/graph/badge.svg)
![CodeQL](https://github.com/mpbarbosa/ai_workflow.js/workflows/CodeQL%20Security%20Analysis/badge.svg)
```

---

## Troubleshooting

### Cache Not Working?

**Check:**

1. `package-lock.json` hasn't changed
2. Node.js version matches matrix
3. Cache size < 10GB (GitHub limit)

**Clear cache:**

```bash
# In repository settings > Actions > Caches
# Delete all caches to force rebuild
```

### Tests Failing in CI but Pass Locally?

**Common causes:**

1. Node.js version mismatch (check matrix)
2. Missing environment variables
3. Different file system (case sensitivity)
4. Race conditions (flaky tests)

**Debug:**

```bash
# Run with same Node version as CI
nvm install 20
nvm use 20
npm ci
npm test
```

### Coverage Upload Fails?

**Check:**

1. `CODECOV_TOKEN` secret is set
2. Coverage files exist in `./coverage/`
3. Codecov service is operational

**Workaround:**
Set `fail_ci_if_error: false` in workflow (already configured)

---

## Performance Metrics

### Current CI Performance (with cache)

| Job              | Duration     | Status |
| ---------------- | ------------ | ------ |
| Test (Node 18.x) | ~60s         | ✅     |
| Test (Node 20.x) | ~60s         | ✅     |
| Test (Node 22.x) | ~60s         | ✅     |
| Coverage Report  | ~45s         | ✅     |
| Build Check      | ~30s         | ✅     |
| **Total**        | **~2-3 min** | ✅     |

### Without Cache

- Test jobs: ~120s each
- Total: ~5-6 minutes
- **Cache saves 50-60% time**

---

## Maintenance

### Update Node.js Versions

Edit `.github/workflows/ci.yml`:

```yaml
strategy:
  matrix:
    node-version: [18.x, 20.x, 22.x, 24.x] # Add new version
```

### Update Dependencies

```bash
npm update
npm audit fix
git commit -am "chore: update dependencies"
```

Dependency review workflow will automatically check for issues.

### Weekly Tasks

- Review CodeQL security alerts
- Check for outdated dependencies
- Monitor test flakiness

---

## Additional Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [actions/cache Documentation](https://github.com/actions/cache)
- [Codecov Documentation](https://docs.codecov.com/)
- [CodeQL Documentation](https://codeql.github.com/)

---

**Last Updated:** February 7, 2026
**Maintained by:** ai_workflow.js contributors
