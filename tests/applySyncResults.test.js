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

describe('exercisesToSync / settleSyncResponse / handleSyncAttempt', () => {
  const { exercisesToSync, settleSyncResponse, handleSyncAttempt } = sandbox.window;

  it('posts only the not-yet-ok exercises and strips the ok flag', () => {
    const sent = exercisesToSync(pending(ex('Dips', true), ex('Squats'), ex('Lunges')));
    expect(sent.map(e => e.exercise)).toEqual(['Squats', 'Lunges']);
    expect(sent.every(e => e.ok === undefined)).toBe(true);
    expect(sent[0]).toMatchObject({ weight: 10, rest: 90, sets: [10] });
  });

  it('settles a partial response and leaves only the failed exercise to retry', () => {
    const settled = settleSyncResponse(
      pending(ex('Dips'), ex('Squats')),
      { ok: false, results: [{ ok: true, pageId: 'a' }, { ok: false, error: 'nope' }] },
    );
    expect(settled.state).toBe('partial');
    expect(settled.clear).toBe(false);
    expect(settled.pending.exercises.map(e => e.ok)).toEqual([true, false]);
    expect(exercisesToSync(settled.pending).map(e => e.exercise)).toEqual(['Squats']);
    expect(settled.view.map(v => v.ok)).toEqual([true, false]);
    expect(settled.view[1].error).toBe('nope');
  });

  it('keeps earlier ok flags when the body has no results', () => {
    const settled = settleSyncResponse(pending(ex('Dips', true), ex('Squats')), { error: 'nope' });
    expect(settled.pending.exercises.map(e => e.ok)).toEqual([true, false]);
    expect(settled.clear).toBe(false);
    expect(settled.state).toBe('partial');
  });

  it('clears only when every exercise is saved', () => {
    const settled = settleSyncResponse(
      pending(ex('Dips', true), ex('Squats')),
      { results: [{ ok: true }] },
    );
    expect(settled.clear).toBe(true);
    expect(settled.state).toBe('ok');
  });

  it('on a thrown timeout keeps ok flags and reuses the same syncId', async () => {
    const start = pending(ex('Dips', true), ex('Squats'));
    let sent = null;
    const first = await handleSyncAttempt(start, async (payload) => {
      sent = payload;
      const err = new Error('Sync timed out. This workout is saved on your phone. Tap Retry to send the exercises that did not save.');
      err.retryable = true;
      throw err;
    });
    expect(first.thrown).toBe(true);
    expect(first.clear).toBe(false);
    expect(first.state).toBe('partial');
    expect(first.pending.exercises.map(e => e.ok)).toEqual([true, false]);
    expect(first.pending.syncId).toBe(sent.syncId);
    expect(sent.exercises.map(e => e.exercise)).toEqual(['Squats']);
    expect(first.view.find(v => !v.ok).error).toMatch(/saved on your phone/);

    const second = await handleSyncAttempt(first.pending, async (payload) => {
      expect(payload.syncId).toBe(sent.syncId);
      expect(payload.exercises.map(e => e.exercise)).toEqual(['Squats']);
      return { ok: true, results: [{ ok: true, pageId: 'p2' }] };
    });
    expect(second.clear).toBe(true);
    expect(second.state).toBe('ok');
    expect(second.pending.exercises.every(e => e.ok)).toBe(true);
  });

  it('a total network failure stays retryable and does not mark anything saved', async () => {
    const start = pending(ex('Dips'), ex('Squats'));
    const result = await handleSyncAttempt(start, async () => {
      throw new Error('Could not reach the server. This workout is saved on your phone. Tap Retry.');
    });
    expect(result.state).toBe('fail');
    expect(result.clear).toBe(false);
    expect(result.pending.exercises.every(e => !e.ok)).toBe(true);
    expect(result.view.every(v => !v.ok)).toBe(true);
    expect(result.view[0].error).toMatch(/Tap Retry/);
    expect(exercisesToSync(result.pending)).toHaveLength(2);
  });
});
