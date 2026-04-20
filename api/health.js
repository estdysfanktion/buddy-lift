// api/health.js — quick connection check used by the Settings screen
import { Client } from '@notionhq/client';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (!process.env.NOTION_TOKEN || !process.env.NOTION_DATABASE_ID) {
    return res.status(200).json({
      ok: false,
      reason: 'missing_env',
      hint: 'Set NOTION_TOKEN and NOTION_DATABASE_ID in the Vercel dashboard',
    });
  }

  try {
    const notion = new Client({ auth: process.env.NOTION_TOKEN });
    const db = await notion.databases.retrieve({ database_id: process.env.NOTION_DATABASE_ID });
    const propNames = Object.keys(db.properties || {});
    const required = ['Name', 'Date', 'Exercise', 'Weight', 'Rest', 'Set 1'];
    const missing = required.filter(n => !propNames.includes(n));
    return res.status(200).json({
      ok: missing.length === 0,
      dbTitle: db.title?.[0]?.plain_text || 'Untitled',
      properties: propNames,
      missing,
    });
  } catch (err) {
    return res.status(200).json({ ok: false, reason: 'notion_error', error: err.message });
  }
}
