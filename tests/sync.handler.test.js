// HTTP contract for /api/sync: auth, partial 207, and a failed pre-check
// that must not create pages.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const notion = vi.hoisted(() => ({
  databases: { query: vi.fn() },
  pages: { create: vi.fn() },
  blocks: { children: { list: vi.fn() } },
}));

vi.mock('@notionhq/client', () => ({
  Client: vi.fn(function Client() {
    return notion;
  }),
}));

const { default: handler } = await import('../api/sync.js');

function invoke(body, { pin = 'test-pin', method = 'POST' } = {}) {
  const req = {
    method,
    headers: { 'x-app-pin': pin },
    body,
  };
  const res = {
    statusCode: 200,
    payload: undefined,
    setHeader() {},
    status(code) { this.statusCode = code; return this; },
    json(obj) { this.payload = obj; return this; },
    end() { return this; },
  };
  return handler(req, res).then(() => res);
}

const syncId = 'abababab-abab-abab-abab-abababababab';

beforeEach(() => {
  process.env.APP_PIN = 'test-pin';
  process.env.NOTION_TOKEN = 'secret_test';
  process.env.NOTION_DATABASE_ID = 'db_test';
  notion.databases.query.mockReset();
  notion.pages.create.mockReset();
  notion.blocks.children.list.mockReset();
  notion.databases.query.mockResolvedValue({ results: [], has_more: false });
  notion.blocks.children.list.mockResolvedValue({ results: [] });
  notion.pages.create.mockImplementation(async (args) => ({
    id: 'page-' + args.properties[' Exercise '].multi_select[0].name,
    properties: args.properties,
  }));
});

describe('POST /api/sync', () => {
  it('rejects a bad pin and a body without exercises', async () => {
    const denied = await invoke({ date: '2026-10-29', exercises: [{ exercise: 'Squats' }] }, { pin: 'nope' });
    expect(denied.statusCode).toBe(401);
    expect(notion.pages.create).not.toHaveBeenCalled();

    const bad = await invoke({ date: '2026-10-29', exercises: [] });
    expect(bad.statusCode).toBe(400);
    expect(notion.pages.create).not.toHaveBeenCalled();
  });

  it('returns 200 and stamps the sync marker when every create succeeds', async () => {
    const res = await invoke({
      date: '2026-10-29',
      dayTitle: 'Shoulders & Legs',
      syncId,
      exercises: [{ exercise: 'Squats', weight: 20, rest: 90, sets: [10] }],
    });
    expect(res.statusCode).toBe(200);
    expect(res.payload.ok).toBe(true);
    expect(res.payload.results[0]).toMatchObject({ exercise: 'Squats', ok: true });
    const created = notion.pages.create.mock.calls[0][0];
    expect(created.children[0].paragraph.rich_text[0].text.content).toBe('buddy-lift:' + syncId);
    expect(created.parent).toEqual({ database_id: 'db_test' });
  });

  it('returns 207 with a failed exercise still listed, and keeps the saved one', async () => {
    notion.pages.create.mockImplementation(async (args) => {
      const name = args.properties[' Exercise '].multi_select[0].name;
      if (name === 'Lunges') throw Object.assign(new Error('notion rejected Lunges'), { status: 500 });
      return { id: 'page-' + name, properties: args.properties };
    });
    const res = await invoke({
      date: '2026-10-29',
      dayTitle: 'Shoulders & Legs',
      syncId,
      exercises: [
        { exercise: 'Squats', weight: 20, rest: 90, sets: [10] },
        { exercise: 'Lunges', weight: 16, rest: 60, sets: [12] },
      ],
    });
    expect(res.statusCode).toBe(207);
    expect(res.payload.ok).toBe(false);
    expect(res.payload.results.map(r => [r.exercise, r.ok])).toEqual([
      ['Squats', true],
      ['Lunges', false],
    ]);
    expect(res.payload.results[1].error).toMatch(/Lunges/);
  });

  it('returns 500 and creates nothing when the existing-row lookup fails', async () => {
    notion.databases.query.mockRejectedValue(Object.assign(new Error('database unavailable'), { status: 500 }));
    const res = await invoke({
      date: '2026-10-29',
      dayTitle: 'Shoulders & Legs',
      syncId,
      exercises: [{ exercise: 'Squats', weight: 20, rest: 90, sets: [10] }],
    });
    expect(res.statusCode).toBe(500);
    expect(res.payload.results).toBeUndefined();
    expect(res.payload.error).toMatch(/nothing new was written/);
    expect(res.payload.error).toMatch(/saved on your phone/);
    expect(notion.pages.create).not.toHaveBeenCalled();
  });
});
