// api/history.js — returns workout history from Notion in HISTORY_SEED format
import { Client } from '@notionhq/client';

const EXERCISE_TO_DAY = {
  'Dumbbell bench press': 1, 'Incline dumbbell press': 1, 'Dumbell Floor press': 1,
  'Tricep Kickback': 1, 'Dips': 1,
  'Bent-over row': 3, 'Dumbbell row': 3, 'Tripod row': 3, 'Reverse grip row': 3,
  'Biceps Curls': 3, 'Hammer curl': 3, 'Pullover': 3,
  'Arnold press': 5, 'Standing dumbbell press': 5, 'Lateral Raises': 5,
  'Over head press': 5, 'Squats': 5, 'Lunges': 5, 'Calf raises': 5,
};

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  if (!process.env.NOTION_TOKEN || !process.env.NOTION_DATABASE_ID) {
    return res.status(200).json({ ok: false, reason: 'missing_env', rows: [] });
  }

  try {
    const notion = new Client({ auth: process.env.NOTION_TOKEN });
    const rows = [];
    let cursor;

    do {
      const resp = await notion.databases.query({
        database_id: process.env.NOTION_DATABASE_ID,
        sorts: [{ property: 'Date', direction: 'descending' }],
        page_size: 100,
        start_cursor: cursor,
      });

      for (const page of resp.results) {
        const p = page.properties;
        const exercise = p.Exercise?.multi_select?.[0]?.name;
        if (!exercise) continue;
        const date = p.Date?.date?.start;
        if (!date) continue;

        const weight = p.Weight?.number ?? 0;
        const sets = [];
        for (let i = 1; i <= 8; i++) {
          const v = p[`Set ${i}`]?.number;
          if (v != null) sets.push(v);
        }
        const volume = weight * sets.reduce((a, b) => a + b, 0);

        rows.push({
          id: page.id,
          date,
          day: EXERCISE_TO_DAY[exercise] ?? 1,
          name: p.Name?.title?.[0]?.plain_text ?? exercise,
          exercise,
          weight,
          rest: p.Rest?.number ?? 90,
          sets,
          volume,
        });
      }

      cursor = resp.has_more ? resp.next_cursor : undefined;
    } while (cursor);

    return res.status(200).json({ ok: true, rows });
  } catch (err) {
    return res.status(200).json({ ok: false, reason: 'notion_error', error: err.message, rows: [] });
  }
}
