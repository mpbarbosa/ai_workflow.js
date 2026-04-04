#!/usr/bin/env node
/**
 * Smoke test for @github/copilot-sdk
 *
 * Validates that the GitHub Copilot SDK is installed, can connect to the
 * Copilot CLI, authenticate, and complete a minimal round-trip conversation.
 *
 * Usage:
 *   node scripts/smoke-test-copilot-sdk.js
 *
 * Exit codes:
 *   0 - All checks passed
 *   1 - One or more checks failed
 */

import { CopilotClient } from '@github/copilot-sdk';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);

const TIMEOUT_MS = 30_000;
const PROMPT = 'Reply with exactly: OK';

export function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Timed out after ${ms}ms: ${label}`)), ms)
    ),
  ]);
}

export async function runSmokeTest() {
  let passed = 0;
  let failed = 0;

  function check(label, ok, detail = '') {
    const icon = ok ? '✅' : '❌';
    const suffix = detail ? `  (${detail})` : '';
    console.log(`  ${icon} ${label}${suffix}`);
    ok ? passed++ : failed++;
  }

  console.log('\n🔍 GitHub Copilot SDK – Smoke Test\n');

  // ── 1. Import check ────────────────────────────────────────────────────────
  console.log('1. SDK import');
  check('CopilotClient imported', typeof CopilotClient === 'function');

  // ── 2. Instantiation ────────────────────────────────────────────────────────
  console.log('\n2. Client instantiation');
  let client;
  try {
    client = new CopilotClient();
    check('CopilotClient instantiated', true);
  } catch (err) {
    check('CopilotClient instantiated', false, err.message);
    return { passed, failed };
  }

  // ── 3. Start / auth ─────────────────────────────────────────────────────────
  console.log('\n3. CLI connection & authentication');
  try {
    await withTimeout(client.start(), TIMEOUT_MS, 'client.start()');
    check('CLI process started', true);
  } catch (err) {
    check('CLI process started', false, err.message);
    console.log('\n⚠️  Cannot continue – CLI failed to start.');
    return { passed, failed };
  }

  try {
    const status = await withTimeout(client.getAuthStatus(), TIMEOUT_MS, 'getAuthStatus()');
    const authOk =
      status?.isAuthenticated === true || status?.status === 'ok' || status?.authenticated === true;
    check('Authentication status', authOk, JSON.stringify(status ?? 'no response'));
  } catch (err) {
    check('Authentication status', false, err.message);
  }

  // ── 4. List models ───────────────────────────────────────────────────────────
  console.log('\n4. Model availability');
  let models;
  try {
    models = await withTimeout(client.listModels(), TIMEOUT_MS, 'listModels()');
    check('listModels() succeeded', Array.isArray(models), `${models.length} model(s)`);
    check(
      'At least one model available',
      models.length > 0,
      models.map((m) => m.id ?? m).join(', ') || 'none'
    );
  } catch (err) {
    check('listModels() succeeded', false, err.message);
  }

  // ── 5. Session round-trip ────────────────────────────────────────────────────
  console.log('\n5. Session round-trip');
  let session;
  let responseContent = '';

  try {
    session = await withTimeout(client.createSession(), TIMEOUT_MS, 'createSession()');
    check('Session created', !!session);

    const done = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Response timed out')), TIMEOUT_MS);

      session.on('assistant.message', (event) => {
        responseContent += event?.data?.content ?? '';
      });

      session.on('session.idle', () => {
        clearTimeout(timer);
        resolve();
      });

      session.on('session.error', (event) => {
        clearTimeout(timer);
        reject(new Error(event?.data?.message ?? 'Session error'));
      });
    });

    await withTimeout(session.send({ prompt: PROMPT }), TIMEOUT_MS, 'session.send()');
    await done;

    check(
      'Response received',
      responseContent.trim().length > 0,
      `"${responseContent.trim().slice(0, 80)}"`
    );
  } catch (err) {
    check('Session round-trip', false, err.message);
  }

  // ── Cleanup ──────────────────────────────────────────────────────────────────
  console.log('\n6. Cleanup');
  try {
    if (session) await session.destroy();
    await client.stop();
    check('Client stopped cleanly', true);
  } catch (err) {
    check('Client stopped cleanly', false, err.message);
  }

  // ── Summary ───────────────────────────────────────────────────────────────────
  console.log(`\n${'─'.repeat(40)}`);
  console.log(`Result: ${passed} passed, ${failed} failed`);

  if (failed === 0) {
    console.log('✅ Copilot SDK is working correctly in this environment.\n');
  } else {
    console.log('❌ Some checks failed – see details above.\n');
  }

  return { passed, failed };
}

if (process.argv[1] === __filename) {
  runSmokeTest()
    .then(({ failed }) => process.exit(failed === 0 ? 0 : 1))
    .catch((error) => {
      console.error('Error:', error.message);
      process.exit(1);
    });
}
