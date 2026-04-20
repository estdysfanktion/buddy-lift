// api/delete-pages.js — archives Notion pages by ID
import { Client } from '@notionhq/client';
import { checkPin } from './health.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!checkPin(req)) return res.status(401).json({ error: 'Unauthorized' });

  if (!process.env.NOTION_TOKEN) {
    return res.status(500).json({ error: 'Missing NOTION_TOKEN' });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  const { ids } = body || {};
  if (!Array.isArray(ids) || !ids.length) {
    return res.status(400).json({ error: 'ids[] required' });
  }

  const notion = new Client({ auth: process.env.NOTION_TOKEN });
  const results = [];

  for (const id of ids) {
    try {
      await notion.pages.update({ page_id: id, archived: true });
      results.push({ id, ok: true });
    } catch (err) {
      results.push({ id, ok: false, error: err.message });
    }
  }

  const allOk = results.every(r => r.ok);
  res.status(allOk ? 200 : 207).json({ ok: allOk, results });
}
