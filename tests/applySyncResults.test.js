// tests/applySyncResults.test.js
//
// applySyncResults(pending, results) advances the ok flags on the
// localStorage 'bl_pending_sync' record after one /api/sync response.
// The invariant that prevents duplicate Notion rows on retry:
//
//   1. results[i] maps BY POSITION to the i-th not-yet-ok exercise
//      (the subset that was actually sent), never by exercise name —
//      a session can contain the same exercise twice.
//   2. An ok flag, once true, is never un-set. A retry re-sends only
//      the still-failed exercises.
//
// data.jsx is browser-global code (no exports), so it is executed in a
// vm sandbox the same way scripts/check-duplication.mjs does it.

import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dataSrc = fs.readFileSync(path.join(ROOT, 'public/src/data.jsx'), 'utf8');
const sandbox = { window: {}, console };
vm.createContext(sandbox);
vm.runInContext(dataSrc, sandbox, { filename: 'data.jsx' });
const { applySyncResults } = sandbox.window;

const ex = (exercise, ok = false) => ({ exercise, weight: 10, rest: 90, sets: [10], ok });
const pending = (...exercises) => ({ date: '2026-08-31', dayId: 1, dayTitle: 'Chest & Triceps', exercises });

describe('applySyncResults', () => {
  it('marks everything ok on a fully successful sync', () => {
    const next = applySyncResults(
      pending(ex('Dips'), ex('Squats')),
      [{ ok: true }, { ok: true }],
    );
    expect(next.exercises.map(e => e.ok)).toEqual([true, true]);
  });

  it('maps results by position onto the not-yet-ok subset only', () => {
    // 'Dips' already synced on a previous attempt → only Squats and Lunges
    // were sent, so results[0] is Squats and results[1] is Lunges.
    const next = applySyncResults(
      pending(ex('Dips', true), ex('Squats'), ex('Lunges')),
      [{ ok: false }, { ok: true }],
    );
    expect(next.exercises.map(e => e.ok)).toEqual([true, false, true]);
  });

  it('handles duplicate exercise names positionally', () => {
    const next = applySyncResults(
      pending(ex('Dips'), ex('Dips')),
      [{ ok: true }, { ok: false }],
    );
    expect(next.exercises.map(e => e.ok)).toEqual([true, false]);
  });

  it('never un-sets an ok flag, even on a garbage response', () => {
    const next = applySyncResults(
      pending(ex('Dips', true), ex('Squats')),
      [],
    );
    expect(next.exercises.map(e => e.ok)).toEqual([true, false]);
  });

  it('leaves everything unsynced when the response has no results (500 / auth wall)', () => {
    const next = applySyncResults(pending(ex('Dips'), ex('Squats')), []);
    expect(next.exercises.every(e => !e.ok)).toBe(true);
  });

  it('does not mutate the input record', () => {
    const p = pending(ex('Dips'));
    applySyncResults(p, [{ ok: true }]);
    expect(p.exercises[0].ok).toBe(false);
  });
});
