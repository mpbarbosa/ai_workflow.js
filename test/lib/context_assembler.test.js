/**
 * Tests for ContextAssembler
 *
 * @jest-environment node
 */

import { assemble, buildManifestPreamble } from '../../src/lib/context_assembler.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeArtifact(path, content, language = 'javascript') {
  return {
    path,
    content,
    language,
    byteSize: Buffer.byteLength(content, 'utf8'),
    isModified: false,
    priority: 0,
  };
}

// 4 chars = 1 token
const TOKEN = 4;

function chars(n) {
  return 'x'.repeat(n * TOKEN);
}

// ---------------------------------------------------------------------------
// assemble — basic cases
// ---------------------------------------------------------------------------

describe('assemble — full fits', () => {
  test('artifact that fits fully gets status full', () => {
    const a = makeArtifact('a.js', chars(10));
    const ctx = assemble([{ name: 'files', artifacts: [a], budget: 100, policy: 'tail' }], 1000);
    expect(ctx.manifest).toHaveLength(1);
    expect(ctx.manifest[0]).toMatchObject({ slot: 'files', file: 'a.js', status: 'full' });
  });

  test('slot text contains rendered artifact', () => {
    const a = makeArtifact('a.js', 'const x = 1;');
    const ctx = assemble([{ name: 'files', artifacts: [a], budget: 1000, policy: 'tail' }], 10000);
    expect(ctx.slots.files).toContain('### a.js');
    expect(ctx.slots.files).toContain('```javascript');
    expect(ctx.slots.files).toContain('const x = 1;');
  });

  test('multiple fitting artifacts are all full', () => {
    const artifacts = [
      makeArtifact('a.js', chars(10)),
      makeArtifact('b.js', chars(10)),
      makeArtifact('c.js', chars(10)),
    ];
    const ctx = assemble([{ name: 'files', artifacts, budget: 50, policy: 'tail' }], 1000);
    expect(ctx.manifest.every((e) => e.status === 'full')).toBe(true);
    expect(ctx.manifest).toHaveLength(3);
  });
});

describe('assemble — truncation policies', () => {
  test('tail policy: first artifact that overflows is truncated, rest absent', () => {
    const big = makeArtifact('big.js', chars(60));
    const small = makeArtifact('small.js', chars(5));
    const ctx = assemble(
      [{ name: 'files', artifacts: [big, small], budget: 50, policy: 'tail' }],
      1000
    );
    expect(ctx.manifest[0]).toMatchObject({ file: 'big.js', status: 'truncated' });
    expect(ctx.manifest[1]).toMatchObject({ file: 'small.js', status: 'absent' });
  });

  test('line-boundary policy: first overflow artifact is truncated', () => {
    const content = 'line\n'.repeat(100); // 500 chars = 125 tokens
    const a = makeArtifact('a.js', content);
    const ctx = assemble(
      [{ name: 'files', artifacts: [a], budget: 50, policy: 'line-boundary' }],
      1000
    );
    expect(ctx.manifest[0]).toMatchObject({ file: 'a.js', status: 'truncated' });
    const entry = ctx.manifest[0];
    expect(entry.includedLines).toBeLessThan(entry.totalLines);
  });

  test('truncated entry includes includedLines and totalLines', () => {
    const content = 'x\n'.repeat(200); // 400 chars = 100 tokens
    const a = makeArtifact('a.js', content);
    const ctx = assemble([{ name: 'files', artifacts: [a], budget: 50, policy: 'tail' }], 1000);
    const entry = ctx.manifest[0];
    expect(entry.status).toBe('truncated');
    expect(typeof entry.includedLines).toBe('number');
    expect(typeof entry.totalLines).toBe('number');
    expect(entry.totalLines).toBe(content.split('\n').length);
  });
});

describe('assemble — skip policy', () => {
  test('oversized artifact is absent; budget preserved for subsequent artifacts', () => {
    const big = makeArtifact('big.js', chars(60));
    const small = makeArtifact('small.js', chars(5));
    const ctx = assemble(
      [{ name: 'files', artifacts: [big, small], budget: 20, policy: 'skip' }],
      1000
    );
    expect(ctx.manifest[0]).toMatchObject({ file: 'big.js', status: 'absent' });
    expect(ctx.manifest[1]).toMatchObject({ file: 'small.js', status: 'full' });
  });

  test('slot text contains the small artifact when large one is skipped', () => {
    const big = makeArtifact('big.js', chars(60));
    const small = makeArtifact('small.js', 'const y = 2;');
    const ctx = assemble(
      [{ name: 'files', artifacts: [big, small], budget: 20, policy: 'skip' }],
      1000
    );
    expect(ctx.slots.files).not.toContain('big.js');
    expect(ctx.slots.files).toContain('small.js');
  });
});

// ---------------------------------------------------------------------------
// assemble — absent when no budget remains
// ---------------------------------------------------------------------------

describe('assemble — budget exhausted', () => {
  test('artifacts beyond budget are absent', () => {
    const a = makeArtifact('a.js', chars(10));
    const b = makeArtifact('b.js', chars(10));
    const c = makeArtifact('c.js', chars(10));
    // Budget of 15 fits a fully (10), then b gets 5 → truncated, c → absent
    const ctx = assemble(
      [{ name: 'files', artifacts: [a, b, c], budget: 15, policy: 'tail' }],
      1000
    );
    expect(ctx.manifest[0].status).toBe('full');
    expect(ctx.manifest[1].status).toBe('truncated');
    expect(ctx.manifest[2].status).toBe('absent');
  });
});

// ---------------------------------------------------------------------------
// Acceptance criteria
// ---------------------------------------------------------------------------

describe('assemble — acceptance: removing largest file does not affect others', () => {
  test("removing the largest file changes only that file's manifest entry", () => {
    const small1 = makeArtifact('small1.js', chars(5));
    const large = makeArtifact('large.js', chars(200));
    const small2 = makeArtifact('small2.js', chars(5));

    const withLarge = assemble(
      [{ name: 'files', artifacts: [small1, large, small2], budget: 30, policy: 'tail' }],
      1000
    );
    const withoutLarge = assemble(
      [{ name: 'files', artifacts: [small1, small2], budget: 30, policy: 'tail' }],
      1000
    );

    // small1 and small2 should be full in both cases
    const findStatus = (ctx, file) => ctx.manifest.find((e) => e.file === file)?.status;

    expect(findStatus(withLarge, 'small1.js')).toBe('full');
    expect(findStatus(withLarge, 'small2.js')).toBe('absent'); // crowded out by large truncation
    expect(findStatus(withoutLarge, 'small1.js')).toBe('full');
    expect(findStatus(withoutLarge, 'small2.js')).toBe('full');
  });
});

describe('assemble — acceptance: skip policy never produces empty truncated entry', () => {
  test('artifact exceeding slot budget with skip policy is absent, not truncated-empty', () => {
    const tooBig = makeArtifact('huge.js', chars(500));
    const ctx = assemble(
      [{ name: 'files', artifacts: [tooBig], budget: 10, policy: 'skip' }],
      1000
    );
    const entry = ctx.manifest[0];
    expect(entry.status).toBe('absent');
    expect(entry.includedLines).toBeUndefined();
    expect(ctx.slots.files).toBe('');
  });
});

// ---------------------------------------------------------------------------
// assemble — fractional budgets
// ---------------------------------------------------------------------------

describe('assemble — fractional budget resolution', () => {
  test('budget < 1 is resolved as fraction of totalTokenBudget', () => {
    const a = makeArtifact('a.js', chars(700)); // 700 tokens
    // budget 0.7 * 1000 = 700 tokens → artifact fits exactly
    const ctx = assemble([{ name: 'files', artifacts: [a], budget: 0.7, policy: 'tail' }], 1000);
    expect(ctx.manifest[0].status).toBe('full');
  });

  test('budget < 1 too small causes truncation', () => {
    const a = makeArtifact('a.js', chars(800)); // 800 tokens
    // budget 0.7 * 1000 = 700 tokens → artifact overflows
    const ctx = assemble([{ name: 'files', artifacts: [a], budget: 0.7, policy: 'tail' }], 1000);
    expect(ctx.manifest[0].status).toBe('truncated');
  });
});

// ---------------------------------------------------------------------------
// assemble — multiple slots
// ---------------------------------------------------------------------------

describe('assemble — multiple slots', () => {
  test('each slot has its own independent budget', () => {
    const a = makeArtifact('a.js', chars(50));
    const b = makeArtifact('b.js', chars(50));
    const ctx = assemble(
      [
        { name: 'slot1', artifacts: [a], budget: 40, policy: 'tail' },
        { name: 'slot2', artifacts: [b], budget: 40, policy: 'tail' },
      ],
      1000
    );
    // a overflows slot1 → truncated; b overflows slot2 → truncated
    expect(ctx.manifest.find((e) => e.file === 'a.js').status).toBe('truncated');
    expect(ctx.manifest.find((e) => e.file === 'b.js').status).toBe('truncated');
  });

  test('manifest entries from all slots are collected in order', () => {
    const a = makeArtifact('a.js', chars(5));
    const b = makeArtifact('b.js', chars(5));
    const ctx = assemble(
      [
        { name: 'alpha', artifacts: [a], budget: 100, policy: 'tail' },
        { name: 'beta', artifacts: [b], budget: 100, policy: 'tail' },
      ],
      1000
    );
    expect(ctx.manifest[0]).toMatchObject({ slot: 'alpha', file: 'a.js' });
    expect(ctx.manifest[1]).toMatchObject({ slot: 'beta', file: 'b.js' });
  });

  test('empty artifacts list produces empty slot text', () => {
    const ctx = assemble([{ name: 'empty', artifacts: [], budget: 100, policy: 'tail' }], 1000);
    expect(ctx.slots.empty).toBe('');
    expect(ctx.manifest).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// buildManifestPreamble
// ---------------------------------------------------------------------------

describe('buildManifestPreamble', () => {
  test('returns empty string for empty manifest', () => {
    expect(buildManifestPreamble([])).toBe('');
    expect(buildManifestPreamble(null)).toBe('');
    expect(buildManifestPreamble(undefined)).toBe('');
  });

  test('single full entry produces correct header and line', () => {
    const manifest = [{ slot: 'files', file: 'a.test.js', status: 'full' }];
    const result = buildManifestPreamble(manifest);
    expect(result).toContain('1 of 1 files fully included');
    expect(result).toContain('a.test.js');
    expect(result).toContain('— full');
  });

  test('truncated entry includes line counts', () => {
    const manifest = [
      {
        slot: 'files',
        file: 'big.test.js',
        status: 'truncated',
        includedLines: 50,
        totalLines: 120,
      },
    ];
    const result = buildManifestPreamble(manifest);
    expect(result).toContain('0 of 1 files fully included');
    expect(result).toContain('truncated (line 50 of 120)');
  });

  test('absent entry is labelled clearly', () => {
    const manifest = [{ slot: 'files', file: 'missing.test.js', status: 'absent' }];
    const result = buildManifestPreamble(manifest);
    expect(result).toContain('absent (exceeded slot budget)');
    expect(result).toContain('0 of 1 files fully included');
  });

  test('mixed statuses produce correct full count and all entries', () => {
    const manifest = [
      { slot: 'files', file: 'a.test.js', status: 'full' },
      { slot: 'files', file: 'b.test.js', status: 'truncated', includedLines: 30, totalLines: 80 },
      { slot: 'files', file: 'c.test.js', status: 'absent' },
      { slot: 'files', file: 'd.test.js', status: 'full' },
    ];
    const result = buildManifestPreamble(manifest);
    expect(result).toContain('2 of 4 files fully included');
    expect(result).toContain('a.test.js');
    expect(result).toContain('b.test.js');
    expect(result).toContain('c.test.js');
    expect(result).toContain('d.test.js');
    expect(result).toContain('truncated (line 30 of 80)');
    expect(result).toContain('absent (exceeded slot budget)');
  });

  test('acceptance: prompt from oversized fixture contains absent entry', () => {
    const oversized = makeArtifact('huge.test.js', chars(500));
    const small = makeArtifact('small.test.js', chars(5));
    const ctx = assemble(
      [{ name: 'primary_test_files', artifacts: [oversized, small], budget: 10, policy: 'skip' }],
      1000
    );
    const preamble = buildManifestPreamble(ctx.manifest);
    expect(preamble).toContain('huge.test.js');
    expect(preamble).toContain('absent (exceeded slot budget)');
    expect(preamble).toContain('small.test.js');
    expect(preamble).toContain('— full');
  });
});
