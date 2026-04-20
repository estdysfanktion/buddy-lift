// api/sync.js — Vercel serverless function
// POST /api/sync  body: { date, dayId, dayTitle, exercises: [{ exercise, weight, rest, sets: [reps...] }] }
// Creates one Notion page per exercise in the Simple Workouts database.

import { Client } from '@notionhq/client';
import { checkPin } from './health.js';

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const DB_ID = process.env.NOTION_DATABASE_ID;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-app-pin');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!checkPin(req)) return res.status(401).json({ error: 'Unauthorized' });

  if (!process.env.NOTION_TOKEN || !DB_ID) {
    return res.status(500).json({ error: 'Server missing NOTION_TOKEN or NOTION_DATABASE_ID' });
  }

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch (e) {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  const { date, dayTitle, exercises } = body || {};
  if (!date || !Array.isArray(exercises) || !exercises.length) {
    return res.status(400).json({ error: 'date and exercises[] required' });
  }

  const results = [];
  for (const ex of exercises) {
    try {
      const props = buildProperties({ date, dayTitle, ...ex });
      const page = await notion.pages.create({
        parent: { database_id: DB_ID },
        properties: props,
      });
      results.push({ exercise: ex.exercise, ok: true, pageId: page.id });
    } catch (err) {
      results.push({ exercise: ex.exercise, ok: false, error: err.message });
    }
  }

  const allOk = results.every(r => r.ok);
  res.status(allOk ? 200 : 207).json({ ok: allOk, results });
}

function buildProperties({ date, dayTitle, exercise, weight, rest, sets }) {
  const props = {
    'Name': {
      title: [{ text: { content: `${dayTitle || 'Workout'} – ${exercise}` } }],
    },
    'Date': { date: { start: date } },
    ' Exercise ': { multi_select: [{ name: exercise }] },
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
