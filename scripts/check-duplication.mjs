#!/usr/bin/env node
// scripts/check-duplication.mjs
//
// buddy-lift has two logic boundaries that genuinely cannot share code
// without a build step: public/src/*.jsx (in-browser, Babel-standalone,
// no bundler) and api/*.js (Node ESM, Vercel functions). Where the same
// logic must exist on both sides, this script loads BOTH real
// implementations, runs them over a shared input matrix, and fails loudly
// (non-zero exit) if they ever disagree. Run it after touching either
// public/src/data.jsx, workout.jsx, overlays.jsx, or any api/*.js file.
//
//   node scripts/check-duplication.mjs

import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
let failed = false;

function fail(msg) {
  failed = true;
  console.error(`✗ ${msg}`);
}
function pass(msg) {
  console.log(`✓ ${msg}`);
}

// ── Load the browser-side data.jsx in a sandbox (no JSX in this file, so
//    Node's vm module can run it directly without a transform). ─────────
const dataSrc = fs.readFileSync(path.join(ROOT, 'public/src/data.jsx'), 'utf8');
const sandbox = { window: {}, console };
vm.createContext(sandbox);
vm.runInContext(dataSrc, sandbox, { filename: 'data.jsx' });
const { DAYS, computeVolume: computeVolumeUI } = sandbox.window;

// ── Load the real api/_shared.js and api/history.js as actual ES modules. ─
const { computeVolume: computeVolumeAPI } = await import(
  path.join(ROOT, 'api/_shared.js')
);
const { EXERCISE_TO_DAY } = await import(path.join(ROOT, 'api/history.js'));

// ─────────────────────────────────────────────────────────────
// 1. Exercise → day mapping: api/history.js's EXERCISE_TO_DAY must match
//    the exercise lists nested in public/src/data.jsx's DAYS object.
// ─────────────────────────────────────────────────────────────
{
  const derived = {};
  for (const [dayId, day] of Object.entries(DAYS)) {
    for (const ex of day.exercises) derived[ex] = Number(dayId);
  }
  const keysA = Object.keys(derived);
  const keysB = Object.keys(EXERCISE_TO_DAY);
  const onlyInData = keysA.filter(k => !(k in EXERCISE_TO_DAY));
  const onlyInApi = keysB.filter(k => !(k in derived));
  const mismatches = keysA.filter(
    k => k in EXERCISE_TO_DAY && derived[k] !== EXERCISE_TO_DAY[k]
  );

  if (onlyInData.length || onlyInApi.length || mismatches.length) {
    fail('DAYS (public/src/data.jsx) and EXERCISE_TO_DAY (api/history.js) have drifted:');
    if (onlyInData.length) console.error('  exercises only in DAYS:', onlyInData);
    if (onlyInApi.length) console.error('  exercises only in EXERCISE_TO_DAY:', onlyInApi);
    if (mismatches.length) console.error('  day mismatches:', mismatches.map(k => `${k}: DAYS=${derived[k]} EXERCISE_TO_DAY=${EXERCISE_TO_DAY[k]}`));
  } else {
    pass(`exercise→day mapping: ${keysA.length} exercises, no drift`);
  }
}

// ─────────────────────────────────────────────────────────────
// 2. Volume formula: public/src/data.jsx's computeVolume() must produce
//    the same output as api/_shared.js's computeVolume() over the same
//    input matrix (edge cases: empty sets, missing weight, null reps,
//    8+ sets, zero weight, negative values, non-numeric input).
// ─────────────────────────────────────────────────────────────
{
  const cases = [
    { label: 'empty sets array',           weight: 20,        sets: [] },
    { label: 'missing weight',             weight: undefined, sets: [10, 10] },
    { label: 'null reps mixed in',         weight: 20,        sets: [10, null, 8] },
    { label: 'undefined reps mixed in',    weight: 20,        sets: [10, undefined, 8] },
    { label: '9 sets (8+ edge)',           weight: 20,        sets: [10, 10, 10, 10, 10, 10, 10, 10, 10] },
    { label: 'zero weight',                weight: 0,         sets: [10, 10, 10] },
    { label: 'negative values',            weight: -20,       sets: [10, -5, 8] },
    { label: 'non-numeric input',          weight: 20,        sets: ['10', 'abc', 8] },
  ];

  const rows = cases.map(c => {
    const ui = computeVolumeUI(c.weight, [...c.sets]);
    const api = computeVolumeAPI(c.weight, [...c.sets]);
    const match = Object.is(ui, api) || (Number.isNaN(ui) && Number.isNaN(api));
    return { ...c, ui, api, match };
  });

  const bad = rows.filter(r => !r.match);
  if (bad.length) {
    fail('computeVolume (data.jsx) and computeVolume (api/_shared.js) disagree:');
    for (const r of bad) console.error(`  ${r.label}: ui=${r.ui} api=${r.api}`);
  } else {
    pass(`computeVolume: ${rows.length}/${rows.length} cases match across data.jsx and api/_shared.js`);
  }
}

if (failed) {
  console.error('\nDUPLICATION CHECK FAILED — the two copies have drifted. Fix before merging.');
  process.exit(1);
} else {
  console.log('\nAll duplication checks passed.');
}
