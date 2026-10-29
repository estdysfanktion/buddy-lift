// Buddy Lift — data model mirroring Notion "Simple Workouts"
// Fields per row: Name, Date, Exercise (multi-select), Weight (kg), Rest (s),
// Set 1..8 (reps), Total Volume (Weight * sum of sets)

const DAYS = {
  1: {
    id: 1,
    title: 'Chest & Triceps',
    short: 'Day 1',
    exercises: [
      'Dumbbell bench press',
      'Incline dumbbell press',
      'Dumbell Floor press',
      'Tricep Kickback',
      'Dips',
    ],
  },
  3: {
    id: 3,
    title: 'Back & Biceps',
    short: 'Day 3',
    exercises: [
      'Bent-over row',
      'Dumbbell row',
      'Tripod row',
      'Reverse grip row',
      'Biceps Curls',
      'Hammer curl',
      'Pullover',
    ],
  },
  5: {
    id: 5,
    title: 'Shoulders & Legs',
    short: 'Day 5',
    exercises: [
      'Arnold press',
      'Standing dumbbell press',
      'Lateral Raises',
      'Over head press',
      'Squats',
      'Lunges',
      'Calf raises',
    ],
  },
};

// Canonical volume formula: weight * sum(sets), guarding against null/
// undefined entries (an in-progress exercise's sets array is padded with
// `null` for sets not yet done — see buildSession).
// Single source of truth for the browser side — used by data.jsx itself
// (seedHistory below), workout.jsx, and overlays.jsx.
//
// api/_shared.js carries a byte-for-byte equivalent copy for the API side,
// since api/*.js (Node ESM) cannot import public/src/*.jsx (in-browser,
// no build step). scripts/check-duplication.mjs executes both copies over
// a shared input matrix on every run and fails loudly if they diverge.
function computeVolume(weight, sets) {
  return weight * sets.reduce((a, b) => a + (b || 0), 0);
}

// Applies one /api/sync response to a pending-sync record (the localStorage
// 'bl_pending_sync' object that survives failed or skipped syncs). results[i]
// corresponds by position to the i-th exercise that was actually sent — the
// not-yet-ok ones, in order. An ok flag is never un-set, so a retry only ever
// re-sends exercises that still failed and can't duplicate synced rows.
function applySyncResults(pending, results) {
  let ri = 0;
  const exercises = pending.exercises.map(e =>
    e.ok ? e : { ...e, ok: results[ri++]?.ok === true }
  );
  return { ...pending, exercises };
}

// Per-day accent colors (oklch). Each day stains chrome + sets.
const DAY_ACCENTS = {
  1: {
    name: 'Electric Blue',
    hex: '#4B9CFF',
    glow: 'rgba(75,156,255,0.28)',
    soft: 'rgba(75,156,255,0.12)',
    oklch: 'oklch(0.72 0.17 250)',
  },
  3: {
    name: 'Acid Lime',
    hex: '#B8FF3C',
    glow: 'rgba(184,255,60,0.28)',
    soft: 'rgba(184,255,60,0.12)',
    oklch: 'oklch(0.93 0.22 125)',
  },
  5: {
    name: 'Warm Amber',
    hex: '#FFB347',
    glow: 'rgba(255,179,71,0.28)',
    soft: 'rgba(255,179,71,0.12)',
    oklch: 'oklch(0.82 0.15 70)',
  },
};

// localStorage key for a workout that is still being logged. Distinct from
// 'bl_pending_sync', which is a finished session waiting on Notion.
const ACTIVE_SESSION_KEY = 'bl_active_session';

function seedWeight(ex) {
  const map = {
    'Dumbbell bench press': 22, 'Incline dumbbell press': 20,
    'Dumbell Floor press': 20, 'Tricep Kickback': 12, 'Dips': 0,
    'Bent-over row': 24, 'Dumbbell row': 24, 'Tripod row': 22,
    'Reverse grip row': 20, 'Biceps Curls': 14, 'Hammer curl': 14, 'Pullover': 18,
    'Arnold press': 16, 'Standing dumbbell press': 18, 'Lateral Raises': 10,
    'Over head press': 18, 'Squats': 24, 'Lunges': 18, 'Calf raises': 16,
  };
  return map[ex] ?? 15;
}

// Whole seconds since a wall-clock start. Negative results (clock skew)
// clamp to 0 so a restored timer never runs backwards.
function elapsedSeconds(startedAt, now = Date.now()) {
  const t = Number(startedAt);
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, Math.floor((Number(now) - t) / 1000));
}

function buildSession(dayId, startedAt = Date.now()) {
  const day = DAYS[dayId];
  const start = Number.isFinite(Number(startedAt)) ? Number(startedAt) : Date.now();
  return {
    dayId,
    startedAt: start,
    elapsed: elapsedSeconds(start),
    currentExercise: 0,
    exercises: day.exercises.map((ex) => ({
      exercise: ex,
      weight: seedWeight(ex),
      rest: 90,
      sets: Array(4).fill(null),
      done: false,
    })),
  };
}

// True once the athlete has changed the fresh template: any logged reps,
// a weight or rest edit, a swap, an added set, or moving off exercise 1.
// An untouched session is not worth restoring after a reload.
function sessionHasProgress(session) {
  if (!session || !DAYS[session.dayId] || !Array.isArray(session.exercises)) return false;
  if (session.currentExercise) return true;
  const fresh = buildSession(session.dayId, session.startedAt);
  if (session.exercises.length !== fresh.exercises.length) return true;
  return session.exercises.some((ex, i) => {
    const base = fresh.exercises[i];
    if (!base || !ex) return true;
    if (ex.done) return true;
    if (ex.exercise !== base.exercise) return true;
    if (Number(ex.weight) !== Number(base.weight)) return true;
    if (Number(ex.rest) !== Number(base.rest)) return true;
    if (!Array.isArray(ex.sets) || ex.sets.length !== base.sets.length) return true;
    return ex.sets.some(s => s != null);
  });
}

// Keep an in-progress session when the planned day changes (history load,
// home-screen arrows). Rebuild only a session that still has no progress.
function sessionAfterDayChange(session, dayId) {
  if (!session || !DAYS[dayId]) return session;
  if (sessionHasProgress(session)) return session;
  if (session.dayId === dayId) return session;
  return buildSession(dayId);
}

function serializeActiveSession(session) {
  return {
    v: 1,
    dayId: session.dayId,
    startedAt: session.startedAt,
    currentExercise: session.currentExercise,
    exercises: session.exercises.map(ex => ({
      exercise: ex.exercise,
      weight: ex.weight,
      rest: ex.rest,
      sets: ex.sets.map(s => (s == null ? null : s)),
      done: !!ex.done,
    })),
  };
}

// Returns a live session, or null when the saved record is unusable.
// `elapsed` is derived from startedAt and any stored elapsed is ignored.
function normalizeActiveSession(raw, now = Date.now()) {
  if (!raw || typeof raw !== 'object') return null;
  if (raw.v != null && raw.v !== 1) return null;
  const dayId = Number(raw.dayId);
  if (!DAYS[dayId]) return null;
  const startedAt = Number(raw.startedAt);
  if (!Number.isFinite(startedAt)) return null;
  if (startedAt < Date.UTC(2024, 0, 1) || startedAt > now + 86400000) return null;
  if (!Array.isArray(raw.exercises) || raw.exercises.length === 0 || raw.exercises.length > 12) return null;
  const currentExercise = Number(raw.currentExercise);
  if (!Number.isInteger(currentExercise) || currentExercise < 0 || currentExercise >= raw.exercises.length) return null;

  const exercises = [];
  for (const ex of raw.exercises) {
    if (!ex || typeof ex.exercise !== 'string' || ex.exercise.length === 0 || ex.exercise.length > 80) return null;
    const weight = Number(ex.weight);
    const rest = Number(ex.rest);
    if (!Number.isFinite(weight) || !Number.isFinite(rest)) return null;
    if (!Array.isArray(ex.sets) || ex.sets.length < 1 || ex.sets.length > 8) return null;
    const sets = [];
    for (const s of ex.sets) {
      if (s == null || s === '') { sets.push(null); continue; }
      const n = Number(s);
      if (!Number.isFinite(n)) return null;
      sets.push(n);
    }
    exercises.push({ exercise: ex.exercise, weight, rest, sets, done: !!ex.done });
  }

  return {
    dayId,
    startedAt,
    elapsed: elapsedSeconds(startedAt, now),
    currentExercise,
    exercises,
  };
}

// Seed recent history — ~4 weeks of completed workouts for realism
function seedHistory() {
  const today = new Date('2026-04-20');
  const h = [];
  const mk = (daysAgo, dayId, exercise, weight, sets, rest=90) => {
    const d = new Date(today);
    d.setDate(d.getDate() - daysAgo);
    h.push({
      id: `${dayId}-${exercise}-${daysAgo}`,
      date: d.toISOString().slice(0,10),
      day: dayId,
      name: `${DAYS[dayId].title} – ${exercise}`,
      exercise, weight, rest,
      sets, // array of reps
      volume: computeVolume(weight, sets),
    });
  };

  // Progressive overload story for a few staple lifts
  // Day 1 sessions: 26, 23, 19, 16, 12, 9, 5, 2 days ago
  const d1 = [26, 23, 19, 16, 12, 9, 5, 2];
  d1.forEach((ago, i) => {
    const w = 18 + i * 0.5; // slow climb
    mk(ago, 1, 'Dumbbell bench press', Math.round(w*2)/2, [10,10,9,8,7]);
    mk(ago, 1, 'Incline dumbbell press', Math.round((w-2)*2)/2, [10,9,8,7]);
    mk(ago, 1, 'Dumbell Floor press', Math.round((w-1)*2)/2, [10,10,9]);
    mk(ago, 1, 'Tricep Kickback', 10 + i*0.25, [12,12,11,10]);
    mk(ago, 1, 'Dips', 0, [12,10,9,8]);
  });
  const d3 = [25, 22, 18, 15, 11, 8, 4];
  d3.forEach((ago, i) => {
    const w = 20 + i * 0.5;
    mk(ago, 3, 'Bent-over row', Math.round(w*2)/2, [10,10,9,8]);
    mk(ago, 3, 'Dumbbell row', Math.round(w*2)/2, [10,10,9]);
    mk(ago, 3, 'Biceps Curls', 12 + i*0.5, [10,10,9,8]);
    mk(ago, 3, 'Hammer curl', 12 + i*0.25, [10,9,8]);
  });
  const d5 = [24, 21, 17, 14, 10, 7, 3];
  d5.forEach((ago, i) => {
    const w = 14 + i * 0.5;
    mk(ago, 5, 'Arnold press', Math.round(w*2)/2, [10,9,8,7]);
    mk(ago, 5, 'Lateral Raises', 8 + i*0.25, [12,12,11,10]);
    mk(ago, 5, 'Squats', 22 + i*0.5, [10,10,9,8]);
  });
  return h;
}

const HISTORY_SEED = seedHistory();

// What's "next"? Rotate Day 1 → Day 3 → Day 5 → Day 1 based on most recent.
function nextDayId(history) {
  if (!history.length) return 1;
  const lastDay = [...history].sort((a,b)=>b.date.localeCompare(a.date))[0].day;
  if (lastDay === 1) return 3;
  if (lastDay === 3) return 5;
  return 1;
}

// Streak = consecutive weeks with ≥2 distinct workout days.
// Current week gets a grace period — if it hasn't hit 2 yet, skip it and check prior weeks.
function computeStreak(history, now = new Date()) {
  if (!history.length) return 0;

  function mondayOf(d) {
    const day = d.getDay();
    const mon = new Date(d);
    mon.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
    mon.setHours(0, 0, 0, 0);
    return mon;
  }

  // Count distinct workout days per week
  const weekMap = {};
  [...new Set(history.map(h => h.date))].forEach(dateStr => {
    const key = mondayOf(new Date(dateStr)).toISOString().slice(0, 10);
    weekMap[key] = (weekMap[key] || 0) + 1;
  });

  const currentMonKey = mondayOf(now).toISOString().slice(0, 10);
  let streak = 0;
  let cursor = mondayOf(now);

  while (true) {
    const key = cursor.toISOString().slice(0, 10);
    const count = weekMap[key] || 0;
    const isCurrent = key === currentMonKey;

    if (isCurrent && count < 2) {
      // grace: current week still in progress, look back further
      cursor.setDate(cursor.getDate() - 7);
      continue;
    }

    if (count >= 2) {
      streak++;
      cursor.setDate(cursor.getDate() - 7);
    } else {
      break;
    }
  }

  return streak;
}

function weekVolume(history, now = new Date()) {
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);
  return history
    .filter(h => new Date(h.date) >= weekAgo)
    .reduce((a,b)=>a+b.volume, 0);
}

function formatK(n) {
  if (n >= 1000) return (n/1000).toFixed(1) + 'k';
  return String(n);
}

Object.assign(window, {
  DAYS, DAY_ACCENTS, HISTORY_SEED, ACTIVE_SESSION_KEY,
  nextDayId, computeStreak, weekVolume, formatK, computeVolume, applySyncResults,
  seedWeight, elapsedSeconds, buildSession, sessionHasProgress, sessionAfterDayChange,
  serializeActiveSession, normalizeActiveSession,
});
