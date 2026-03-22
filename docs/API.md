# API Documentation: guia_turistico

This document describes the main public modules, classes, and functions of the guia_turistico JavaScript project.

## Main Modules

- **src/controllers/**: Route handlers for main features (e.g., tours, users, bookings)
- **src/models/**: Data models and database access
- **src/routes/**: Express route definitions
- **src/services/**: Business logic and integrations
- **src/utils/**: Utility functions

## Example: Tour Controller

```js
/**
 * Get all tours
 * @route GET /api/tours
 * @returns {Array<Tour>} List of tours
 */
async function getAllTours(req, res) { ... }
```

## Example: User Model

```js
/**
 * User schema
 * @typedef {Object} User
 * @property {string} id
 * @property {string} name
 * @property {string} email
 */
```

## Usage Example

```js
import { getAllTours } from './src/controllers/tourController';

app.get('/api/tours', getAllTours);
```

---
For full API details, see inline JSDoc in each module.
