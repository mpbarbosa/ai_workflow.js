# fixture-nodejs-api

A minimal Node.js REST API used as a **test fixture** for `ai_workflow.js` integration and
e2e tests. It is intentionally small and dependency-light so that tests remain fast.

## Structure

```
src/
  index.js          Entry point — starts the Express server
  routes/
    users.js        GET /users, POST /users, GET /users/:id
    health.js       GET /health
test/
  users.test.js     Unit tests for the users route handler
README.md
.gitignore
package.json
```

## Purpose

This fixture is **not a real deployable service**. It exists so that the ai_workflow.js
integration/e2e test suite has a realistic target project to run workflow steps against
without modifying the ai_workflow.js repository itself.
