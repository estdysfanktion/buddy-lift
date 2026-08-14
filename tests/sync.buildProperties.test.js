// tests/sync.buildProperties.test.js
//
// Formal model of api/sync.js buildProperties(input) -> Notion properties object.
//
// Input domain:
//   date      ISO date string
//   dayTitle  string | undefined  (falls back to 'Workout')
//   exercise  string
//   weight    any                 (coerced: Number(x) || 0)
//   rest      any                 (coerced: Number(x) || 0)
//   sets      (number | null | undefined)[]  — index i maps to `Set ${i+1}`, i < 8
//
// Invariants:
//   1. The exercise multi-select key is the literal ' Exercise ' WITH surrounding
//      spaces. README.md documents it as 'Exercise' without them — that mismatch
//      is the whole reason this test exists.
//   2. Weight/Rest use `Number(x) || 0`, so any non-numeric value silently
//      becomes 0 (and so does a legitimate 0).
//   3. `Set N` is written only when sets[i] != null. A gap is OMITTED entirely,
//      but an explicit 0 (a failed set) IS written. Those two must not collapse
//      into each other.

import { describe, it, expect, vi } from 'vitest';

vi.mock('@notionhq/client', () => ({
  Client: class {
    constructor() {}
  },
}));

const { buildProperties } = await import('../api/sync.js');

describe('buildProperties', () => {
  it('uses the literal " Exercise " key with surrounding spaces, not "Exercise"', () => {
    const props = buildProperties({
      date: '2026-08-14', dayTitle: 'Push Day', exercise: 'Squats',
      weight: 40, rest: 90, sets: [10],
    });
    expect(props[' Exercise ']).toEqual({ multi_select: [{ name: 'Squats' }] });
    expect(props['Exercise']).toBeUndefined();
  });

  it('falls back Weight to 0 when the value is not a valid number', () => {
    const props = buildProperties({
      date: '2026-08-14', exercise: 'Squats', weight: 'abc', rest: 90, sets: [10],
    });
    expect(props.Weight).toEqual({ number: 0 });
  });

  it('skips a set slot entirely when reps is undefined, rather than writing 0', () => {
    const props = buildProperties({
      date: '2026-08-14', exercise: 'Squats', weight: 40, rest: 90,
      sets: [8, undefined, 6],
    });
    expect(props['Set 1']).toEqual({ number: 8 });
    expect(props['Set 2']).toBeUndefined();
    expect(props['Set 3']).toEqual({ number: 6 });
  });

  it('preserves an explicit 0-rep set (a failed set) instead of treating it as missing', () => {
    const props = buildProperties({
      date: '2026-08-14', exercise: 'Squats', weight: 40, rest: 90, sets: [0],
    });
    expect(props['Set 1']).toEqual({ number: 0 });
  });
});
