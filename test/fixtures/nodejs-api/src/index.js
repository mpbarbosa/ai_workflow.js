/**
 * @fileoverview Fixture Node.js API — Entry Point
 * Minimal Express server for ai_workflow.js integration test fixtures.
 */

import express from 'express';
import { router as usersRouter } from './routes/users.js';
import { router as healthRouter } from './routes/health.js';

const app = express();
app.use(express.json());

app.use('/users', usersRouter);
app.use('/health', healthRouter);

const PORT = process.env.PORT || 3000;

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

export { app };
