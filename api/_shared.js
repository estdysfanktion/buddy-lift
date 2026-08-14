// api/_shared.js — helpers shared by the api/*.js Vercel functions ONLY.
// (Not itself a route: Vercel's zero-config detection skips files/dirs
// prefixed with "_". public/src/*.jsx cannot import this — see the
// "cross-boundary duplication" note in README.md and
// scripts/check-duplication.mjs, which asserts the two copies stay in sync.)

// Literal Notion property name for the exercise multi-select column.
// NOTE: the property is named with leading/trailing spaces in the live
// Notion database ("` Exercise `"), which is why this is a shared constant
// instead of the clean "Exercise" the README table shows for readability.
export const EXERCISE_PROP = ' Exercise ';

// weight * sum(sets), guarding against null/undefined entries so a sparse
// or partially-populated sets array never produces NaN.
//
// This mirrors computeVolume() in public/src/data.jsx exactly. The two
// copies exist because public/src/*.jsx runs in-browser (no build step)
// and api/*.js runs as Node ESM — they cannot import one another without
// introducing a bundler. scripts/check-duplication.mjs executes both
// copies over the same input matrix on every run and fails loudly if they
// ever disagree.
export function computeVolume(weight, sets) {
  return weight * sets.reduce((a, b) => a + (b || 0), 0);
}
