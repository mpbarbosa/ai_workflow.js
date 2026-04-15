# Architecture Overview: guia_turistico

## System Overview

guia_turistico is a modular JavaScript/Node.js application for managing tourist guides, tours, and bookings. It follows a layered architecture for maintainability and scalability.

## Main Components

- **Express Server**: Handles HTTP requests and routing
- **Controllers**: Business logic for tours, users, bookings
- **Models**: Data schemas and database access (e.g., MongoDB, Sequelize)
- **Routes**: API endpoint definitions
- **Services**: External integrations (e.g., payment, maps)
- **Utils**: Helper functions

## Data Flow

1. Client sends HTTP request to API endpoint
2. Route forwards request to appropriate controller
3. Controller interacts with models/services
4. Response returned to client

## Key Dependencies

- Node.js (>=20.x)
- Express.js
- Database driver (e.g., Mongoose, Sequelize)

## Design Principles

- Separation of concerns (controllers, models, routes)
- RESTful API design
- Modular, testable codebase

## Version History

| Version | Date       | Milestone                                                                                                          |
| ------- | ---------- | ------------------------------------------------------------------------------------------------------------------ |
| 0.1.0   | 2026-01-27 | Initial release — core foundation modules (Phase 1)                                                                |
| 1.0.0   | 2026-01-30 | Phase 2 complete — configuration & state management (config, backlog, session_manager, metrics)                    |
| 1.2.0   | 2026-02-07 | Phase 3 complete — file operations & utilities (file_operations, edit_operations, utils, argument_parser, cleanup) |
| 1.6.3   | 2026-02-25 | Phase 4–5 complete — project detection & git integration; workflow steps scaffolded                                |
| 1.9.11  | 2026-03-12 | Phase 6–9 complete — AI integration, orchestration, performance optimisation, CLI; streaming support added         |
| 2.0.0   | 2026-04-09 | Breaking: Node.js >=20 required. SDK evolved to v0.5.1 (tools, hooks, SSE streaming, log validation, smoke tests)  |
| 2.0.1   | 2026-04-09 | Implement real `workflowDirWritable` fs check; refresh stale Phase 11 doc references                               |
| 2.0.2   | 2026-04-09 | Fix `mergeValidationResults()` ignoring TIMEOUT tasks; un-skip 3 step1_parallel tests; update FRS scope section    |
| 2.1.0   | 2026-04-09 | Implement `loadWorkflow()` file loading (JSON/YAML); add `parseWorkflowFile` pure function; 6984 tests passing     |
| 2.2.7   | 2026-04-09 | Add `saveWorkflow(path)` + `serializeWorkflow()` pure function (inverse of parseWorkflowFile); 6997 tests passing  |
