// Mocked Notion client: slow writes, a mid-sync failure then Retry, and a
// lost response that must not duplicate rows.

import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import {
  syncExercises,
  createRequestScheduler,
  buildProperties,
  SYNC_MARKER_PREFIX,
  NOTION_CONCURRENCY,
  NOTION_MIN_INTERVAL_MS,
  SYNC_MAX_DURATION_SECONDS,
  config,
} from '../api/sync.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const FAST = { concurrency: 3, minIntervalMs: 0 };

function loadData() {
  const src = fs.readFileSync(path.join(ROOT, 'public/src/data.jsx'), 'utf8');
  const sandbox = { window: {}, console, crypto };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox, { filename: 'data.jsx' });
  return sandbox.window;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function createFakeNotion(opts = {}) {
  const store = [];
  const createCalls = [];
  let createInFlight = 0;
  let maxCreateInFlight = 0;
  const failExercises = opts.failExercises || new Set();
  const rateLimitOnce = new Set(opts.rateLimitOnce || []);
  const rateLimited = new Set();

  function dateOf(page) {
    return page.properties?.Date?.date?.start;
  }

  const api = {
    store,
    createCalls,
    maxCreateInFlight: () => maxCreateInFlight,
    databases: {
      query: async ({ filter, start_cursor }) => {
        if (opts.queryError) throw opts.queryError;
        await delay(opts.queryDelayMs || 0);
        const equals = filter?.date?.equals;
        const matched = store.filter(page => !equals || dateOf(page) === equals);
        if (opts.paginate) {
          if (!start_cursor) {
            return {
              results: matched.slice(0, 1),
              has_more: matched.length > 1,
              next_cursor: matched.length > 1 ? 'page-2' : undefined,
            };
          }
          return { results: matched.slice(1), has_more: false };
        }
        return { results: matched, has_more: false };
      },
    },
    pages: {
      create: async (args) => {
        const exercise = args.properties[' Exercise '].multi_select[0].name;
        createCalls.push(exercise);
        createInFlight++;
        maxCreateInFlight = Math.max(maxCreateInFlight, createInFlight);
        try {
          const wait = typeof opts.delayMs === 'function' ? opts.delayMs(exercise) : (opts.delayMs || 0);
          await delay(wait);
          if (rateLimitOnce.has(exercise) && !rateLimited.has(exercise)) {
            rateLimited.add(exercise);
            const err = new Error('rate limited');
            err.status = 429;
            err.code = 'rate_limited';
            err.headers = { 'retry-after': '0' };
            throw err;
          }
          if (failExercises.has(exercise)) {
            const err = new Error('notion rejected ' + exercise);
            err.status = 500;
            throw err;
          }
          const page = {
            id: 'page-' + (store.length + 1),
            properties: args.properties,
            children: args.children || [],
          };
          store.push(page);
          return page;
        } finally {
          createInFlight--;
        }
      },
    },
    blocks: {
      children: {
        list: async ({ block_id }) => {
          if (opts.childrenError) throw opts.childrenError;
          const page = store.find(p => p.id === block_id);
          return { results: page?.children || [], has_more: false };
        },
      },
    },
  };
  return api;
}

function seed(api, fields) {
  api.store.push({
    id: 'existing-' + fields.exercise + '-' + api.store.length,
    properties: buildProperties(fields),
    children: [{
      type: 'paragraph',
      paragraph: { rich_text: [{ plain_text: SYNC_MARKER_PREFIX + fields.syncId }] },
    }],
  });
}

const day = {
  date: '2026-10-29',
  dayTitle: 'Shoulders & Legs',
  databaseId: 'db',
};

function ex(exercise, weight, sets, rest = 90) {
  return { exercise, weight, rest, sets };
}

const SEVEN = [
  ex('Arnold press', 14, [10, 9, 8]),
  ex('Standing dumbbell press', 14, [10, 8]),
  ex('Lateral Raises', 8, [12, 12]),
  ex('Over head press', 12, [10, 9]),
  ex('Squats', 22, [10, 10, 9, 8]),
  ex('Lunges', 16, [12, 10]),
  ex('Calf raises', 12, [15, 15]),
];

describe('syncExercises', () => {
  it('overlaps slow creates and finishes a 7-exercise workout well under a sequential run', async () => {
    const notion = createFakeNotion({ delayMs: 40 });
    const started = Date.now();
    const results = await syncExercises(notion, {
      ...day,
      syncId: '11111111-1111-1111-1111-111111111111',
      exercises: SEVEN,
    }, FAST);
    const elapsed = Date.now() - started;
    expect(results).toHaveLength(7);
    expect(results.every(r => r.ok)).toBe(true);
    expect(results.map(r => r.exercise)).toEqual(SEVEN.map(e => e.exercise));
    expect(notion.maxCreateInFlight()).toBe(NOTION_CONCURRENCY);
    // 7 * 40ms back-to-back is 280ms. Overlapped waves finish well under that,
    // and either way the call returns instead of hanging past the time limit.
    expect(elapsed).toBeLessThan(1000);
    expect(notion.store).toHaveLength(7);
    // Legacy Hobby default was ~10s. Sequential 1.5s writes of a full day
    // blow that; 3-wide does not. Paced starts stay under it too.
    expect(7 * 1500).toBeGreaterThan(10000);
    expect(Math.ceil(7 / NOTION_CONCURRENCY) * 1500).toBeLessThan(10000);
    expect((1 + 7 - 1) * NOTION_MIN_INTERVAL_MS + 1500).toBeLessThan(10000);
  });

  it('paces Notion calls at the default interval', async () => {
    const notion = createFakeNotion();
    const started = Date.now();
    await syncExercises(notion, {
      ...day,
      syncId: '22222222-2222-2222-2222-222222222222',
      exercises: [ex('Squats', 20, [10]), ex('Lunges', 16, [12])],
    });
    expect(Date.now() - started).toBeGreaterThanOrEqual(NOTION_MIN_INTERVAL_MS * 2 - 40);
    expect(notion.createCalls).toEqual(['Squats', 'Lunges']);
  });

  it('spaces scheduler starts', async () => {
    const schedule = createRequestScheduler({ concurrency: 1, minIntervalMs: 30 });
    const starts = [];
    await Promise.all([0, 1, 2].map(() => schedule(async () => {
      starts.push(Date.now());
    })));
    expect(starts[1] - starts[0]).toBeGreaterThanOrEqual(20);
    expect(starts[2] - starts[1]).toBeGreaterThanOrEqual(20);
  });

  it('retries a rate limit and then saves the exercise once', async () => {
    const notion = createFakeNotion({ rateLimitOnce: ['Squats'] });
    const results = await syncExercises(notion, {
      ...day,
      syncId: '33333333-3333-3333-3333-333333333333',
      exercises: [ex('Squats', 20, [8])],
    }, FAST);
    expect(results[0].ok).toBe(true);
    expect(notion.createCalls).toEqual(['Squats', 'Squats']);
    expect(notion.store).toHaveLength(1);
  });

  it('after a mid-sync failure, Retry writes only the exercise that failed', async () => {
    const data = loadData();
    const failExercises = new Set(['Lunges']);
    const notion = createFakeNotion({ failExercises });
    const syncId = '44444444-4444-4444-4444-444444444444';
    const exercises = [ex('Squats', 22, [10, 8]), ex('Lunges', 16, [12]), ex('Calf raises', 12, [15])];
    let pending = {
      ...day,
      dayId: 5,
      syncId,
      exercises: exercises.map(e => ({ ...e, ok: false })),
    };
    const sent = [];
    const post = async (payload) => {
      sent.push(payload.exercises.map(e => e.exercise));
      return {
        results: await syncExercises(notion, { ...payload, databaseId: 'db' }, FAST),
      };
    };

    const first = await data.handleSyncAttempt(pending, post);
    expect(first.state).toBe('partial');
    expect(first.clear).toBe(false);
    expect(first.pending.exercises.map(e => e.ok)).toEqual([true, false, true]);
    expect(sent[0]).toEqual(['Squats', 'Lunges', 'Calf raises']);

    failExercises.clear();
    const second = await data.handleSyncAttempt(first.pending, post);
    expect(sent[1]).toEqual(['Lunges']);
    expect(second.clear).toBe(true);
    expect(second.pending.exercises.every(e => e.ok)).toBe(true);
    expect(notion.createCalls.filter(name => name === 'Squats')).toEqual(['Squats']);
    expect(notion.createCalls.filter(name => name === 'Calf raises')).toEqual(['Calf raises']);
    expect(notion.store.map(page => page.properties[' Exercise '].multi_select[0].name).sort())
      .toEqual(['Calf raises', 'Lunges', 'Squats']);
  });

  it('a lost response then Retry does not create a second copy of saved rows', async () => {
    const data = loadData();
    const notion = createFakeNotion();
    const syncId = '55555555-5555-5555-5555-555555555555';
    const exercises = [ex('Squats', 22, [10]), ex('Lunges', 16, [12]), ex('Dips', 0, [8, 8])];
    const pending = {
      date: day.date,
      dayId: 1,
      dayTitle: 'Chest & Triceps',
      syncId,
      exercises: exercises.map(e => ({ ...e, ok: false })),
    };

    await syncExercises(notion, {
      date: pending.date,
      dayTitle: pending.dayTitle,
      databaseId: 'db',
      syncId,
      exercises,
    }, FAST);
    expect(notion.store).toHaveLength(3);
    const createsBeforeRetry = notion.createCalls.length;

    const lost = await data.handleSyncAttempt(pending, async () => {
      throw new Error('Sync timed out. This workout is saved on your phone. Tap Retry to send the exercises that did not save.');
    });
    expect(lost.thrown).toBe(true);
    expect(lost.clear).toBe(false);
    expect(lost.state).toBe('fail');
    expect(lost.pending.exercises.every(e => !e.ok)).toBe(true);
    expect(lost.pending.syncId).toBe(syncId);
    expect(lost.view[0].error).toMatch(/saved on your phone/);

    const retry = await data.handleSyncAttempt(lost.pending, async (payload) => {
      expect(payload.exercises).toHaveLength(3);
      expect(payload.syncId).toBe(syncId);
      return { results: await syncExercises(notion, { ...payload, databaseId: 'db' }, FAST) };
    });
    expect(retry.clear).toBe(true);
    expect(retry.pending.exercises.every(e => e.ok)).toBe(true);
    expect(notion.createCalls.length).toBe(createsBeforeRetry);
    expect(notion.store).toHaveLength(3);
    expect(retry.view.every(v => v.ok)).toBe(true);
  });

  it('does not treat a later identical workout as already saved', async () => {
    const notion = createFakeNotion();
    const exercises = [ex('Squats', 22, [10, 10])];
    await syncExercises(notion, { ...day, syncId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', exercises }, FAST);
    await syncExercises(notion, { ...day, syncId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', exercises }, FAST);
    expect(notion.store).toHaveLength(2);
  });

  it('without a syncId, does not skip a row just because the same sets already exist', async () => {
    const notion = createFakeNotion();
    const exercises = [ex('Squats', 22, [10])];
    await syncExercises(notion, { ...day, syncId: 'cccccccc-cccc-cccc-cccc-cccccccccccc', exercises }, FAST);
    const again = await syncExercises(notion, { ...day, exercises }, FAST);
    expect(again[0].ok).toBe(true);
    expect(again[0].existed).toBeUndefined();
    expect(notion.store).toHaveLength(2);
  });

  it('keeps two identical exercises in one workout as two rows across a retry', async () => {
    const notion = createFakeNotion();
    const syncId = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
    const exercises = [ex('Dips', 0, [10, 8]), ex('Dips', 0, [10, 8])];
    const first = await syncExercises(notion, { ...day, syncId, exercises }, FAST);
    expect(first.every(r => r.ok)).toBe(true);
    expect(notion.store).toHaveLength(2);
    const second = await syncExercises(notion, { ...day, syncId, exercises }, FAST);
    expect(second.every(r => r.ok && r.existed)).toBe(true);
    expect(notion.store).toHaveLength(2);
  });

  it('returns results in request order even when a later create finishes first', async () => {
    const notion = createFakeNotion({
      delayMs: (name) => (name === 'Squats' ? 50 : 0),
    });
    const results = await syncExercises(notion, {
      ...day,
      syncId: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
      exercises: [ex('Squats', 20, [5]), ex('Lunges', 10, [6])],
    }, FAST);
    expect(results.map(r => r.exercise)).toEqual(['Squats', 'Lunges']);
    expect(results.every(r => r.ok)).toBe(true);
  });

  it('reads an existing marker that was split across a paginated date query', async () => {
    const notion = createFakeNotion({ paginate: true });
    const syncId = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
    seed(notion, { ...day, ...ex('Squats', 22, [10]), syncId });
    seed(notion, { ...day, ...ex('Lunges', 16, [12]), syncId });
    const results = await syncExercises(notion, {
      ...day,
      syncId,
      exercises: [ex('Squats', 22, [10]), ex('Lunges', 16, [12]), ex('Calf raises', 12, [15])],
    }, FAST);
    expect(results.map(r => r.existed)).toEqual([true, true, undefined]);
    expect(notion.createCalls).toEqual(['Calf raises']);
  });

  it('writes nothing when the date query fails', async () => {
    const notion = createFakeNotion({ queryError: Object.assign(new Error('database unavailable'), { status: 500 }) });
    await expect(syncExercises(notion, {
      ...day,
      syncId: '99999999-9999-9999-9999-999999999999',
      exercises: SEVEN,
    }, FAST)).rejects.toThrow(/database unavailable/);
    expect(notion.createCalls).toEqual([]);
  });

  it('still creates when the marker cannot be read, rather than dropping the exercise', async () => {
    const notion = createFakeNotion({ childrenError: new Error('blocks unavailable') });
    const syncId = '12121212-1212-1212-1212-121212121212';
    seed(notion, { ...day, ...ex('Squats', 22, [10]), syncId });
    const results = await syncExercises(notion, {
      ...day,
      syncId,
      exercises: [ex('Squats', 22, [10])],
    }, FAST);
    expect(results[0].ok).toBe(true);
    expect(results[0].existed).toBeUndefined();
    expect(notion.createCalls).toEqual(['Squats']);
  });

  it('sets a Hobby-legal maxDuration on the function and in vercel.json', () => {
    const vercel = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
    expect(config.maxDuration).toBe(SYNC_MAX_DURATION_SECONDS);
    expect(vercel.functions['api/sync.js'].maxDuration).toBe(SYNC_MAX_DURATION_SECONDS);
    expect(SYNC_MAX_DURATION_SECONDS).toBeLessThanOrEqual(300);
    expect(SYNC_MAX_DURATION_SECONDS).toBeGreaterThanOrEqual(60);
  });
});
