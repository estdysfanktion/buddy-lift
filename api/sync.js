// api/sync.js — Vercel serverless function
// POST /api/sync  body: { date, dayId, dayTitle, syncId, exercises: [{ exercise, weight, rest, sets }] }
// Creates one Notion page per exercise in the Simple Workouts database.
//
// A full day is up to 7 pages. Writing them one after another, each Notion
// round trip ~1–2s, runs past the legacy Hobby ~10s kill (vercel.json used
// to set no maxDuration). Vercel then returns 504 with no per-exercise
// results, so the phone cannot tell which rows landed.
//
// This handler:
//   1. Starts Notion calls at most NOTION_CONCURRENCY at a time, spaced to
//      stay under Notion's average of 3 requests/second, so 7 exercises
//      finish in a few seconds.
//   2. Sets maxDuration to 60s — allowed on Hobby both before Fluid compute
//      (60s max) and after (300s default and max).
//   3. When the client sends a syncId, reuses a page already written for
//      this same attempt (matched by a page-body marker plus the row's
//      date / title / weight / rest / sets) instead of creating another.
//      A later workout the same day gets its own syncId, so identical
//      weights are not swallowed. Pages are not matched on properties
//      alone for that reason.
//
// Residual duplicate window: two invocations with the same syncId that
// both query before either create lands (the phone abandons the request
// and the user taps Retry while Vercel is still writing). Retry is only
// offered after the client request settles, so this is a few seconds wide.
// If the marker cannot be read, the exercise is created anyway — a failed
// lookup duplicates a row rather than dropping the set.

import { Client } from '@notionhq/client';
import { checkPin } from './health.js';
import { EXERCISE_PROP } from './_shared.js';

let notionClient;
function getNotion() {
  if (!notionClient) notionClient = new Client({ auth: process.env.NOTION_TOKEN });
  return notionClient;
}

// Hobby allows 60s (pre-Fluid) and 300s (Fluid, current default and max).
export const SYNC_MAX_DURATION_SECONDS = 60;
export const config = { maxDuration: SYNC_MAX_DURATION_SECONDS };

// Notion's published limit is an average of 3 requests per second.
export const NOTION_CONCURRENCY = 3;
export const NOTION_MIN_INTERVAL_MS = 350;

export const SYNC_MARKER_PREFIX = 'buddy-lift:';

export function workoutPageTitle(dayTitle, exercise) {
  return `${dayTitle || 'Workout'} – ${exercise}`;
}

function numericOrZero(value) {
  const n = Number(value);
  return n || 0;
}

function validSyncId(syncId) {
  return typeof syncId === 'string' && /^[A-Za-z0-9-]{8,80}$/.test(syncId);
}

function richTextToPlain(rich) {
  if (!Array.isArray(rich)) return '';
  return rich.map(part => part?.plain_text ?? part?.text?.content ?? '').join('');
}

function writtenSets(sets) {
  const out = [];
  const list = Array.isArray(sets) ? sets : [];
  for (let i = 0; i < 8 && i < list.length; i++) {
    if (list[i] != null) out.push(numericOrZero(list[i]));
  }
  return out;
}

function readSets(properties) {
  const out = [];
  for (let i = 1; i <= 8; i++) {
    const value = properties?.[`Set ${i}`]?.number;
    if (value != null) out.push(numericOrZero(value));
  }
  return out;
}

// Same identity the create call writes, so a retry can find that page.
export function exerciseIdentityKey({ dayTitle, exercise, weight, rest, sets }) {
  return JSON.stringify([
    workoutPageTitle(dayTitle, exercise),
    exercise,
    numericOrZero(weight),
    numericOrZero(rest),
    writtenSets(sets),
  ]);
}

export function pageIdentityKey(page) {
  const properties = page?.properties || {};
  const exercise = properties[EXERCISE_PROP]?.multi_select?.[0]?.name;
  if (!exercise) return null;
  const name = richTextToPlain(properties.Name?.title);
  if (!name) return null;
  return JSON.stringify([
    name,
    exercise,
    numericOrZero(properties.Weight?.number),
    numericOrZero(properties.Rest?.number),
    readSets(properties),
  ]);
}

export function parseSyncMarker(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed.startsWith(SYNC_MARKER_PREFIX)) return null;
  const id = trimmed.slice(SYNC_MARKER_PREFIX.length).trim();
  return validSyncId(id) ? id : null;
}

function markerBlock(syncId) {
  return {
    object: 'block',
    type: 'paragraph',
    paragraph: {
      rich_text: [{ type: 'text', text: { content: `${SYNC_MARKER_PREFIX}${syncId}` } }],
    },
  };
}

function errorText(err) {
  const msg = String(err?.message || 'Notion request failed');
  if (/secret_|ntn_/i.test(msg)) return 'Notion request failed';
  return msg.slice(0, 300);
}

function headerValue(err, name) {
  const headers = err?.headers;
  if (!headers) return undefined;
  if (typeof headers.get === 'function') return headers.get(name) ?? headers.get(name.toLowerCase());
  return headers[name] ?? headers[name.toLowerCase()];
}

function retryDelayMs(err, attempt) {
  const header = headerValue(err, 'retry-after');
  const seconds = Number(header);
  if (header != null && String(header).trim() !== '' && Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(seconds * 1000, 2000);
  }
  return Math.min(400 * (attempt + 1), 2000);
}

// 429 was refused, so the write did not land and is safe to repeat.
// 5xx/network errors on create are NOT retried: Notion may have committed
// the page anyway, and a second create would duplicate it. The syncId
// marker covers that on the client's next attempt.
function isRateLimited(err) {
  const status = err?.status ?? err?.statusCode;
  return status === 429 || err?.code === 'rate_limited';
}

function isTransientRead(err) {
  if (isRateLimited(err)) return true;
  const status = err?.status ?? err?.statusCode;
  return status === 502 || status === 503 || err?.code === 'service_unavailable';
}

async function withRetry(fn, { attempts = 4, sleep, shouldRetry }) {
  let last;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      last = err;
      if (attempt === attempts - 1 || !shouldRetry(err)) throw err;
      await sleep(retryDelayMs(err, attempt));
    }
  }
  throw last;
}

// At most `concurrency` Notion calls in flight, and at most one new call
// started per `minIntervalMs`, so a fast Notion still stays near 3 req/s.
export function createRequestScheduler({ concurrency = NOTION_CONCURRENCY, minIntervalMs = NOTION_MIN_INTERVAL_MS } = {}) {
  const limit = Math.max(1, concurrency);
  const gap = Math.max(0, minIntervalMs);
  let active = 0;
  let lastStart = -Infinity;
  let timer = null;
  const waiting = [];

  function arm(ms) {
    if (timer != null) return;
    timer = setTimeout(() => {
      timer = null;
      drain();
    }, ms);
  }

  function drain() {
    while (active < limit && waiting.length) {
      const now = Date.now();
      const wait = lastStart === -Infinity ? 0 : gap - (now - lastStart);
      if (wait > 0) {
        arm(wait);
        return;
      }
      lastStart = Date.now();
      active++;
      const job = waiting.shift();
      Promise.resolve()
        .then(job.fn)
        .then(job.resolve, job.reject)
        .finally(() => {
          active--;
          drain();
        });
    }
  }

  return function schedule(fn) {
    return new Promise((resolve, reject) => {
      waiting.push({ fn, resolve, reject });
      drain();
    });
  };
}

async function readPageSyncId(notion, pageId, run) {
  try {
    const resp = await run(
      () => notion.blocks.children.list({ block_id: pageId, page_size: 100 }),
      isTransientRead,
    );
    for (const block of resp?.results || []) {
      if (block?.type !== 'paragraph') continue;
      const id = parseSyncMarker(richTextToPlain(block.paragraph?.rich_text));
      if (id) return id;
    }
  } catch (e) {
    return null;
  }
  return null;
}

async function listPagesForDate(notion, databaseId, date, run) {
  const pages = [];
  let cursor;
  do {
    const query = {
      database_id: databaseId,
      filter: { property: 'Date', date: { equals: date } },
      page_size: 100,
    };
    if (cursor) query.start_cursor = cursor;
    const resp = await run(() => notion.databases.query(query), isTransientRead);
    pages.push(...(resp?.results || []));
    cursor = resp?.has_more ? resp.next_cursor : undefined;
  } while (cursor);
  return pages;
}

/**
 * Create one Notion page per exercise.
 * Existing pages that carry the same syncId marker and the same
 * title/weight/rest/sets are returned as already saved.
 * opts.concurrency / opts.minIntervalMs / opts.sleep override pacing in tests.
 */
export async function syncExercises(notion, { date, dayTitle, exercises, databaseId, syncId }, opts = {}) {
  const sleep = opts.sleep || (ms => new Promise(resolve => setTimeout(resolve, ms)));
  const schedule = createRequestScheduler({
    concurrency: opts.concurrency ?? NOTION_CONCURRENCY,
    minIntervalMs: opts.minIntervalMs ?? NOTION_MIN_INTERVAL_MS,
  });
  const run = (fn, shouldRetry) => schedule(() => withRetry(fn, { sleep, shouldRetry }));

  const canDedupe = validSyncId(syncId);
  const results = new Array(exercises.length);
  const pendingCreate = [];

  if (canDedupe) {
    const existing = await listPagesForDate(notion, databaseId, date, run);
    const buckets = new Map();
    for (const page of existing) {
      const key = pageIdentityKey(page);
      if (!key) continue;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(page);
    }

    const candidates = [];
    const seen = new Set();
    exercises.forEach(ex => {
      const bucket = buckets.get(exerciseIdentityKey({ dayTitle, ...ex })) || [];
      for (const page of bucket) {
        if (seen.has(page.id)) continue;
        seen.add(page.id);
        candidates.push(page);
      }
    });

    const markerById = new Map();
    await Promise.all(candidates.map(async page => {
      markerById.set(page.id, await readPageSyncId(notion, page.id, run));
    }));

    const consumed = new Set();
    exercises.forEach((ex, index) => {
      const bucket = buckets.get(exerciseIdentityKey({ dayTitle, ...ex })) || [];
      const match = bucket.find(page => !consumed.has(page.id) && markerById.get(page.id) === syncId);
      if (match) {
        consumed.add(match.id);
        results[index] = { exercise: ex.exercise, ok: true, pageId: match.id, existed: true };
      } else {
        pendingCreate.push(index);
      }
    });
  } else {
    exercises.forEach((_, index) => pendingCreate.push(index));
  }

  await Promise.all(pendingCreate.map(index => schedule(async () => {
    const ex = exercises[index];
    try {
      const createBody = {
        parent: { database_id: databaseId },
        properties: buildProperties({ date, dayTitle, ...ex }),
      };
      if (canDedupe) createBody.children = [markerBlock(syncId)];
      const page = await withRetry(
        () => notion.pages.create(createBody),
        { sleep, shouldRetry: isRateLimited },
      );
      results[index] = { exercise: ex.exercise, ok: true, pageId: page.id };
    } catch (err) {
      results[index] = { exercise: ex.exercise, ok: false, error: errorText(err) };
    }
  })));

  return results;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-app-pin');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!checkPin(req)) return res.status(401).json({ error: 'Unauthorized' });

  const databaseId = process.env.NOTION_DATABASE_ID;
  if (!process.env.NOTION_TOKEN || !databaseId) {
    return res.status(500).json({ error: 'Server missing NOTION_TOKEN or NOTION_DATABASE_ID' });
  }

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch (e) {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  const { date, dayTitle, exercises, syncId } = body || {};
  if (!date || !Array.isArray(exercises) || !exercises.length) {
    return res.status(400).json({ error: 'date and exercises[] required' });
  }

  let results;
  try {
    results = await syncExercises(getNotion(), {
      date,
      dayTitle,
      exercises,
      databaseId,
      syncId,
    });
  } catch (err) {
    // The date query (or its retries) failed before any create in this attempt.
    return res.status(500).json({
      error: 'Could not check Notion for exercises already saved, so nothing new was written. This workout is saved on your phone. Tap Retry.',
      detail: errorText(err),
    });
  }

  const allOk = results.every(r => r.ok);
  res.status(allOk ? 200 : 207).json({ ok: allOk, results });
}

export function buildProperties({ date, dayTitle, exercise, weight, rest, sets }) {
  const props = {
    'Name': {
      title: [{ text: { content: workoutPageTitle(dayTitle, exercise) } }],
    },
    'Date': { date: { start: date } },
    [EXERCISE_PROP]: { multi_select: [{ name: exercise }] },
    'Weight': { number: Number(weight) || 0 },
    'Rest': { number: Number(rest) || 0 },
  };
  // Set 1..8
  for (let i = 0; i < 8; i++) {
    const reps = sets?.[i];
    if (reps != null) {
      props[`Set ${i + 1}`] = { number: Number(reps) };
    }
  }
  return props;
}
