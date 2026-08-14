// api/health.js — connection check + PIN validation
import { Client } from '@notionhq/client';
import { EXERCISE_PROP } from './_shared.js';

export function checkPin(req) {
  const appPin = process.env.APP_PIN;
  if (!appPin) return false; // no PIN configured → fail closed, not open
  const provided = req.headers['x-app-pin'];
  return provided === appPin;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');

  const pinOk = checkPin(req);

  if (!process.env.NOTION_TOKEN || !process.env.NOTION_DATABASE_ID) {
    return res.status(200).json({ ok: false, pinOk, reason: 'missing_env' });
  }

  if (!pinOk) {
    return res.status(200).json({ ok: false, pinOk: false, reason: 'wrong_pin' });
  }

  try {
    const notion = new Client({ auth: process.env.NOTION_TOKEN });
    const db = await notion.databases.retrieve({ database_id: process.env.NOTION_DATABASE_ID });
    const propNames = Object.keys(db.properties || {});
    const required = ['Name', 'Date', EXERCISE_PROP, 'Weight', 'Rest', 'Set 1'];
    const missing = required.filter(n => !propNames.includes(n));
    return res.status(200).json({
      ok: missing.length === 0, pinOk: true,
      dbTitle: db.title?.[0]?.plain_text || 'Untitled',
      properties: propNames, missing,
    });
  } catch (err) {
    return res.status(200).json({ ok: false, pinOk: true, reason: 'notion_error', error: err.message });
  }
}
