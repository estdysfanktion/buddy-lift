// postSync must surface timeouts, non-OK responses, and dropped connections
// as retryable errors, and must return per-exercise results for 207.

import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { config } from '../api/sync.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const src = fs.readFileSync(path.join(ROOT, 'public/src/syncClient.js'), 'utf8');

function load(fetchImpl) {
  const sandbox = {
    window: {},
    console,
    localStorage: { getItem: () => 'pin-from-phone' },
    setTimeout,
    clearTimeout,
    AbortController,
    fetch: fetchImpl,
  };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox, { filename: 'syncClient.js' });
  return sandbox.window;
}

function jsonResponse(status, body) {
  return {
    status,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  };
}

const payload = { date: '2026-10-29', exercises: [{ exercise: 'Squats' }] };

describe('postSync', () => {
  it('waits longer than the server maxDuration so a 504 arrives before the client aborts', () => {
    const { SYNC_CLIENT_TIMEOUT_MS } = load(async () => jsonResponse(200, { ok: true, results: [] }));
    expect(SYNC_CLIENT_TIMEOUT_MS).toBeGreaterThan(config.maxDuration * 1000);
    expect(config.maxDuration).toBeLessThanOrEqual(300);
  });

  it('returns per-exercise results for 200 and for 207 partial success', async () => {
    const ok = load(async () => jsonResponse(200, { ok: true, results: [{ ok: true }] }));
    await expect(ok.postSync(payload)).resolves.toEqual({ ok: true, results: [{ ok: true }] });

    const partial = load(async () => jsonResponse(207, {
      ok: false,
      results: [{ ok: true }, { ok: false, error: 'nope' }],
    }));
    await expect(partial.postSync(payload)).resolves.toMatchObject({
      results: [{ ok: true }, { ok: false, error: 'nope' }],
    });
  });

  it('treats a gateway timeout HTML body as a retryable timeout', async () => {
    const { postSync } = load(async () => jsonResponse(504, '<html>FUNCTION_INVOCATION_TIMEOUT</html>'));
    await expect(postSync(payload)).rejects.toMatchObject({
      retryable: true,
      message: expect.stringMatching(/timed out/i),
    });
    await expect(postSync(payload)).rejects.toThrow(/saved on your phone/);
  });

  it('treats a non-OK JSON error as retryable and keeps the server message', async () => {
    const { postSync } = load(async () => jsonResponse(500, { error: 'Server missing NOTION_TOKEN or NOTION_DATABASE_ID' }));
    await expect(postSync(payload)).rejects.toThrow(/NOTION_TOKEN/);
    await expect(postSync(payload)).rejects.toThrow(/saved on your phone/);
  });

  it('treats a 401 as retryable instead of a vague failure', async () => {
    const { postSync } = load(async () => jsonResponse(401, { error: 'Unauthorized' }));
    await expect(postSync(payload)).rejects.toThrow(/Unauthorized/);
    await expect(postSync(payload)).rejects.toThrow(/Tap Retry/);
  });

  it('turns a dropped connection into a clear retryable error', async () => {
    const { postSync } = load(async () => {
      const err = new TypeError('Load failed');
      throw err;
    });
    await expect(postSync(payload)).rejects.toMatchObject({ retryable: true });
    await expect(postSync(payload)).rejects.toThrow(/Could not reach the server/);
    await expect(postSync(payload)).rejects.not.toThrow(/Load failed/);
  });

  it('turns an aborted request into a timeout the user can retry', async () => {
    const { postSync } = load((_url, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener('abort', () => {
        const err = new Error('The operation was aborted');
        err.name = 'AbortError';
        reject(err);
      });
    }));
    await expect(postSync(payload, { timeoutMs: 30 })).rejects.toMatchObject({
      retryable: true,
      message: expect.stringMatching(/timed out/i),
    });
  });

  it('sends the pin and does not treat an unexpected 200 body as success', async () => {
    let headers;
    const { postSync } = load(async (_url, init) => {
      headers = init.headers;
      return jsonResponse(200, 'not-json');
    });
    await expect(postSync(payload)).rejects.toThrow(/unexpected response/i);
    expect(headers['x-app-pin']).toBe('pin-from-phone');
  });
});
