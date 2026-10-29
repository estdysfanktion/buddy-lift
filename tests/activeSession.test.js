// tests/activeSession.test.js
//
// In-progress workouts are stored separately from bl_pending_sync.
// These helpers decide what is worth restoring, how elapsed time is
// derived from a wall-clock start, and how a planned-day change interacts
// with a session that already has logged work.

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
const {
  buildSession, sessionHasProgress, sessionAfterDayChange,
  serializeActiveSession, normalizeActiveSession, elapsedSeconds, ACTIVE_SESSION_KEY,
} = sandbox.window;

const NOW = Date.parse('2026-10-29T12:00:00Z');

describe('elapsedSeconds', () => {
  it('counts whole seconds from a wall-clock start', () => {
    expect(elapsedSeconds(NOW - 125_000, NOW)).toBe(125);
  });

  it('clamps clock skew to zero', () => {
    expect(elapsedSeconds(NOW + 5_000, NOW)).toBe(0);
  });

  it('treats a missing start as zero', () => {
    expect(elapsedSeconds(undefined, NOW)).toBe(0);
  });
});

describe('sessionHasProgress', () => {
  it('is false for a brand-new session', () => {
    expect(sessionHasProgress(buildSession(1, NOW))).toBe(false);
  });

  it('is true once a set, weight, rest, swap, or exercise change is logged', () => {
    const logged = buildSession(1, NOW);
    logged.exercises[0].sets = [10, null, null, null];
    expect(sessionHasProgress(logged)).toBe(true);

    const heavier = buildSession(1, NOW);
    heavier.exercises[0].weight = 24.5;
    expect(sessionHasProgress(heavier)).toBe(true);

    const rested = buildSession(3, NOW);
    rested.exercises[0].rest = 60;
    expect(sessionHasProgress(rested)).toBe(true);

    const swapped = buildSession(1, NOW);
    swapped.exercises[0].exercise = 'Dips';
    expect(sessionHasProgress(swapped)).toBe(true);

    const advanced = buildSession(1, NOW);
    advanced.currentExercise = 2;
    expect(sessionHasProgress(advanced)).toBe(true);

    const extraSet = buildSession(5, NOW);
    extraSet.exercises[0].sets = [null, null, null, null, null];
    expect(sessionHasProgress(extraSet)).toBe(true);
  });
});

describe('sessionAfterDayChange', () => {
  it('rebuilds an untouched session when the planned day changes', () => {
    const fresh = buildSession(1, NOW);
    const next = sessionAfterDayChange(fresh, 3);
    expect(next.dayId).toBe(3);
    expect(next.exercises[0].exercise).toBe('Bent-over row');
    expect(sessionHasProgress(next)).toBe(false);
  });

  it('keeps a session that already has logged sets', () => {
    const logged = buildSession(1, NOW);
    logged.exercises[0].sets = [10, 8, null, null];
    const next = sessionAfterDayChange(logged, 5);
    expect(next).toBe(logged);
    expect(next.exercises[0].sets).toEqual([10, 8, null, null]);
  });

  it('does not rebuild when the planned day is already the session day', () => {
    const fresh = buildSession(1, NOW - 10_000);
    expect(sessionAfterDayChange(fresh, 1)).toBe(fresh);
  });
});

describe('normalizeActiveSession', () => {
  it('round-trips a logged session and derives elapsed from startedAt', () => {
    const session = buildSession(1, NOW - 90_000);
    session.currentExercise = 1;
    session.exercises[0].done = true;
    session.exercises[0].sets = [10, 8, null, null];
    session.exercises[0].weight = 24.5;
    session.exercises[0].rest = 75;
    session.exercises[1].sets = [12, null, null, null];
    session.elapsed = 1;

    const restored = normalizeActiveSession(serializeActiveSession(session), NOW);
    expect(restored.dayId).toBe(1);
    expect(restored.currentExercise).toBe(1);
    expect(restored.startedAt).toBe(NOW - 90_000);
    expect(restored.elapsed).toBe(90);
    expect(restored.exercises[0]).toMatchObject({
      exercise: 'Dumbbell bench press', weight: 24.5, rest: 75, done: true,
    });
    expect(restored.exercises[0].sets).toEqual([10, 8, null, null]);
    expect(restored.exercises[1].sets).toEqual([12, null, null, null]);
    expect(sessionHasProgress(restored)).toBe(true);
  });

  it('ignores a stale stored elapsed', () => {
    const session = buildSession(3, NOW - 60_000);
    session.exercises[0].sets = [5, null, null, null];
    const raw = serializeActiveSession(session);
    raw.elapsed = 3;
    expect(normalizeActiveSession(raw, NOW).elapsed).toBe(60);
  });

  it('rejects records that are not a usable in-progress session', () => {
    expect(normalizeActiveSession(null, NOW)).toBe(null);
    expect(normalizeActiveSession({ v: 2, dayId: 1, startedAt: NOW, currentExercise: 0, exercises: [] }, NOW)).toBe(null);
    expect(normalizeActiveSession({
      dayId: 1, startedAt: NOW, currentExercise: 0,
      exercises: [{ exercise: 'Dips', weight: 0, rest: 90, sets: [] }],
    }, NOW)).toBe(null);
    // A finished bl_pending_sync payload has no startedAt and must not restore as live.
    expect(normalizeActiveSession({
      date: '2026-10-29', dayId: 1, dayTitle: 'Chest & Triceps', elapsed: 40,
      exercises: [{ exercise: 'Dips', weight: 0, rest: 90, sets: [10], ok: false }],
    }, NOW)).toBe(null);
  });

  it('uses a key distinct from the finished-workout queue', () => {
    expect(ACTIVE_SESSION_KEY).toBe('bl_active_session');
    expect(ACTIVE_SESSION_KEY).not.toBe('bl_pending_sync');
  });
});
