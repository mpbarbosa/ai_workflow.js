# Docker Testing Guide

> This guide covers running the **ai_workflow.js** test suite inside Docker for
> fully isolated, reproducible test runs.

---

## Table of Contents

1. [Why run tests in Docker?](#why-run-tests-in-docker)
2. [Prerequisites](#prerequisites)
3. [Project files overview](#project-files-overview)
4. [Dockerfile.test walkthrough](#dockerfiletest-walkthrough)
5. [.dockerignore walkthrough](#dockerignore-walkthrough)
6. [Shell script walkthrough](#shell-script-walkthrough)
7. [Running the tests](#running-the-tests)
8. [Extracting coverage reports](#extracting-coverage-reports)
9. [CI/CD integration (GitHub Actions)](#cicd-integration-github-actions)
10. [Troubleshooting](#troubleshooting)

---

## Why run tests in Docker?

| Benefit | Details |
|---|---|
| **Isolation** | Tests run in a clean OS every time — no leftover state, no host-machine differences |
| **Reproducibility** | Same image = same result on any machine or CI runner |
| **CI parity** | What passes locally in Docker will pass in CI |
| **Dependency pinning** | The exact Node.js version is locked to the image tag |
| **Safe multi-project setups** | Different projects can use conflicting Node versions without conflict |

---

## Prerequisites

### Docker

| Platform | Install |
|---|---|
| **macOS / Windows** | [Docker Desktop](https://docs.docker.com/desktop/) |
| **Linux** | [Docker Engine](https://docs.docker.com/engine/install/) |

Verify installation:

```bash
docker --version      # Docker version 26.x.x or later
docker info           # confirms the daemon is running
```

### Node.js (host only)

The host machine needs Node.js **only** for the `npm run test:docker` convenience
script (it resolves the package version). The actual tests run inside Docker.

```bash
node --version   # v20.0.0 or later
```

---

## Project files overview

The Docker test setup consists of three files:

```text
project-root/
├── Dockerfile.test               ← image definition for the test runner
├── .dockerignore                 ← files excluded from the build context
└── scripts/
    └── run-tests-docker.sh       ← orchestration script (build → run → report)
```

`package.json` exposes convenience scripts:

```json
"scripts": {
  "test:docker":          "bash scripts/run-tests-docker.sh",
  "test:docker:coverage": "bash scripts/run-tests-docker.sh -- --coverage",
  "test:docker:e2e":      "bash scripts/run-tests-docker.sh --e2e"
}
```

---

## Dockerfile.test walkthrough

```dockerfile
FROM node:20-alpine
```

- Uses the **official Node.js Alpine image** — roughly 60 MB vs 900 MB for the
  Debian image.
- Pinned to `node:20-alpine` to match the project's `engines.node >= 20`.
- Alpine is sufficient here — no native compiled add-ons are required at test time.

---

```dockerfile
RUN apk add --no-cache git
```

- **Required** because one production dependency uses the `github:` protocol:

  ```json
  "olinda_utils.js": "github:mpbarbosa/olinda_utils.js#semver:0.3.9"
  ```

- `npm ci` resolves `github:` references by cloning via git. Alpine does not ship
  git by default, so without this line the install fails with:

  ```
  npm error: git is not installed
  ```

- `--no-cache` avoids saving the Alpine package index layer, keeping the image lean.

---

```dockerfile
COPY package.json package-lock.json ./
```

Copies **only the dependency manifests** first. Docker caches each layer; if
neither file changed since the last build, the `npm ci` layer below is also
cached — saving time on subsequent rebuilds.

---

```dockerfile
ENV NODE_ENV=test
ENV HUSKY=0
RUN npm ci
```

- `ENV NODE_ENV=test` — the `node:20-alpine` base image (like all official Node
  images) ships with `NODE_ENV=production`, which causes `npm ci` to silently skip
  `devDependencies`. Overriding it before `npm ci` ensures Jest, Babel, and all
  other dev tools are installed.

- `ENV HUSKY=0` — disables husky's `prepare` lifecycle script. Without this,
  `--ignore-scripts` would also be needed to suppress it.

- `RUN npm ci --ignore-scripts` — skips all lifecycle hooks at install time.
  `postinstall.js` cannot run here because only `package.json` and
  `package-lock.json` have been copied at this layer — the `scripts/` directory
  does not exist yet. It is run explicitly after `COPY . .` instead.

---

```dockerfile
COPY . .
```

Copies the remaining project files **after** `npm ci` so that source-code changes
do not invalidate the dependency cache layer. `.dockerignore` controls what is
excluded.

---

```dockerfile
RUN node scripts/postinstall.js
```

Runs the postinstall script explicitly after all project files are copied.
`scripts/postinstall.js` patches the exports maps of `olinda_shell_interface.js`
and `vscode-jsonrpc` so that `@github/copilot-sdk` ESM imports resolve correctly.
It could not run during `npm ci --ignore-scripts` because `scripts/` was not
present in the container at that layer.

---

```dockerfile
CMD ["npm", "test"]
```

Default command when the container is run with no extra arguments. Uses JSON array
form to avoid spawning an intermediate shell, making signal handling more reliable.
The shell script overrides this with `-- --runInBand` (see below).

---

## .dockerignore walkthrough

`.dockerignore` uses the same syntax as `.gitignore`. It tells Docker which files
to exclude from the **build context** sent to the daemon before the build starts.
A smaller context means faster builds.

```dockerignore
node_modules/    # npm ci installs these fresh inside the container
coverage/        # tests produce their own inside the container
.git/            # version history not needed at runtime
*.log            # logs and OS/editor artefacts
dist/            # no pre-built output needed; source runs directly via Jest
build/           # same
.ai_workflow/    # workflow artefacts not needed for tests
.test-cache/     # stale host cache must not bleed into the clean container
.test-e2e/       # e2e test artefacts
.test-step-11-5/ # step-specific test artefacts
docs/api/html/   # generated API docs not needed for tests
```

**Key rules:**

- Always exclude `node_modules/` — copying it in would override the clean `npm ci`
  install and dramatically bloat the build context.
- Exclude `.git/` — no need for version history inside the container.
- Exclude `.test-cache/` — stale host cache should not contaminate the container.

---

## Shell script walkthrough

`scripts/run-tests-docker.sh` is a convenience wrapper with three steps.

### Step 1 — Build the image

```bash
docker build \
  --build-arg BUILDKIT_INLINE_CACHE=1 \
  -t ai-workflow-test \
  -f Dockerfile.test \
  "${PROJECT_ROOT}"
```

- `-f Dockerfile.test` — uses the dedicated test Dockerfile.
- `-t ai-workflow-test` — tags the image for easy reference.
- `--build-arg BUILDKIT_INLINE_CACHE=1` — embeds cache metadata in image layers
  (useful for registry-based caching in CI).

### Step 2 — Run the container

```bash
docker run \
  --rm \
  --name ai-workflow-test-run \
  -e CI=true \
  ai-workflow-test \
  sh -c "npm test -- --runInBand"
```

- `--rm` — removes the container automatically after it exits.
- `-e CI=true` — signals to Jest that the run is non-interactive; disables watch
  mode and colour animations.
- `--runInBand` — **always passed inside Docker**. This project uses ESM
  (`node --experimental-vm-modules`) with `forceExit: true`. When parallel Jest
  workers shut down, one worker's VM context may be torn down while another worker's
  dynamic imports are still queued, producing a `ReferenceError` after environment
  teardown. Running serially in a single process eliminates that race.
- When `--coverage` is detected in the extra args, the script automatically mounts
  `$(pwd)/coverage:/app/coverage` as a volume.
- The exit code of `docker run` mirrors the exit code of the test process.

### Step 3 — Report

The script captures the container's exit code and prints a pass/fail summary, then
exits with the same code. This makes it compatible with CI pipelines that check `$?`.

### Flags

| Flag | Effect |
|---|---|
| `--e2e` | Uses `jest.integration.config.json` instead of `jest.config.json` |
| `-- <jest args>` | All args after `--` are forwarded to Jest |
| `-- --coverage` | Also auto-mounts `coverage/` volume for host extraction |

---

## Running the tests

### Basic run (full suite)

```bash
npm run test:docker
# or directly:
bash scripts/run-tests-docker.sh
```

### With coverage

```bash
npm run test:docker:coverage
# or:
bash scripts/run-tests-docker.sh -- --coverage
```

### E2E / integration tests

```bash
npm run test:docker:e2e
# or:
bash scripts/run-tests-docker.sh --e2e
```

### With a specific test file or pattern

```bash
bash scripts/run-tests-docker.sh -- --testPathPattern=config
bash scripts/run-tests-docker.sh -- --testPathPattern=git_automation
```

### With verbose output

```bash
bash scripts/run-tests-docker.sh -- --verbose
```

### One-liner without the script

```bash
docker build -f Dockerfile.test -t ai-workflow-test . && \
docker run --rm -e CI=true ai-workflow-test npm test -- --runInBand
```

---

## Extracting coverage reports

By default, coverage output stays inside the container and is lost when `--rm`
removes it. Pass `--coverage` to the script — it automatically mounts
the `coverage/` directory as a volume to persist it on the host:

```bash
bash scripts/run-tests-docker.sh -- --coverage
```

Or mount it manually:

```bash
docker run --rm \
  -e CI=true \
  -v "$(pwd)/coverage:/app/coverage" \
  ai-workflow-test \
  npm test -- --runInBand --coverage
```

After the run, `./coverage/` on the host contains the full HTML and LCOV reports.

```bash
# open the HTML report in a browser (Linux)
xdg-open coverage/lcov-report/index.html
```

---

## CI/CD integration (GitHub Actions)

The workflow at `.github/workflows/test-docker.yml` builds the image, runs the
tests, and uploads the coverage report as an artifact.

```yaml
name: Docker Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test-docker:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Build test image
        run: |
          docker build \
            --cache-from type=gha \
            --cache-to type=gha,mode=max \
            -t ai-workflow-test \
            -f Dockerfile.test \
            .

      - name: Run tests inside Docker
        run: |
          docker run --rm \
            -e CI=true \
            -v "${{ github.workspace }}/coverage:/app/coverage" \
            ai-workflow-test \
            npm test -- --runInBand --coverage

      - name: Upload coverage report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: docker-coverage-report
          path: coverage/
          retention-days: 14
```

**Key points:**

- `--cache-from / --cache-to type=gha` — uses GitHub Actions cache for Docker
  layers, dramatically reducing build time after the first run.
- `-v "${{ github.workspace }}/coverage:/app/coverage"` — extracts coverage from
  the container into the runner's workspace so the upload-artifact step can find it.
- `if: always()` on the upload step — uploads the report even when tests fail,
  which is when you need it most.

---

## Troubleshooting

### `Cannot find module 'jest'` (or other devDependency) inside Docker

**Cause:** `NODE_ENV=production` (the default in all official Node images) causes
`npm ci` to silently skip `devDependencies`.

**Diagnosis:**

```bash
docker run --rm ai-workflow-test node -e "require('jest')"
# If this throws, devDeps were not installed.
```

**Fix:** `Dockerfile.test` already sets `ENV NODE_ENV=test` before `RUN npm ci`.
Verify the `ENV` line is present and comes **before** the `RUN npm ci` line.

---

### `npm error: git is not installed`

**Cause:** One dependency uses the `github:` protocol, which requires git.
Alpine does not include git by default.

**Fix:** `Dockerfile.test` already includes `RUN apk add --no-cache git`.
If you see this error, verify the `apk add` line is present and comes **before**
the `COPY package.json` and `RUN npm ci` lines.

---

### ESM import error after VM teardown inside Docker

**Cause:** Jest parallel workers + ESM + `forceExit: true` can race when one
worker tears down its VM context while another worker's dynamic `import()` is still
queued, producing a `ReferenceError`.

**Symptom:**
```
ReferenceError: Cannot access 'X' before initialization
```

**Fix:** Always use `--runInBand` inside Docker. The shell script and the GitHub
Actions workflow already pass this flag. If you invoke `docker run` manually,
include `npm test -- --runInBand`.

---

### `Cannot find module 'vscode-jsonrpc/node'` or copilot-sdk import errors

**Cause:** `postinstall.js` was not run, so `vscode-jsonrpc` does not have its
exports map patch.

**Diagnosis:** Check if `postinstall.js` ran during `npm ci`:

```bash
docker run --rm ai-workflow-test node -e "
  const pkg = JSON.parse(require('fs').readFileSync(
    'node_modules/vscode-jsonrpc/package.json', 'utf8'));
  console.log('has exports:', !!pkg.exports);
"
```

**Fix:** `Dockerfile.test` runs `RUN node scripts/postinstall.js` explicitly after
`COPY . .`. If you see this error, verify that the `RUN node scripts/postinstall.js`
line is present in `Dockerfile.test` and comes **after** `COPY . .`.

---

### Tests pass locally but fail inside Docker

**Likely cause:** The host `node_modules/` is bleeding into the build context
despite `.dockerignore`. Verify the `.dockerignore` file is present at the project
root and contains `node_modules/`.

```bash
# Confirm the build context does NOT include node_modules
docker build --no-cache -f Dockerfile.test -t ai-workflow-test . 2>&1 | grep -i "node_modules"
```
