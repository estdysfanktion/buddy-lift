// Browser-side /api/sync fetch. No JSX so tests can run it under Node's vm.
// Loaded as a classic script before the Babel screens; postSync is global.
//
// Any non-OK response, gateway timeout, or dropped connection rejects with
// a retryable Error. Callers must leave the pending workout in localStorage
// when that happens — this function never reports exercises as saved unless
// the body carries a results array (including HTTP 207 partial success).

var SYNC_CLIENT_TIMEOUT_MS = 75000;

function retryableSyncError(message) {
  var err = new Error(message);
  err.retryable = true;
  return err;
}

function interpretSyncException(err) {
  if (err && err.name === 'AbortError') {
    return retryableSyncError('Sync timed out. This workout is saved on your phone. Tap Retry to send the exercises that did not save.');
  }
  return retryableSyncError('Could not reach the server. This workout is saved on your phone. Tap Retry.');
}

function interpretSyncBody(status, text) {
  var body = null;
  if (text) {
    try { body = JSON.parse(text); } catch (e) { body = null; }
  }
  // 207 Multi-Status is how partial saves are reported. Honor the
  // per-exercise results whenever they are present, on any status.
  if (body && Array.isArray(body.results)) return body;

  if (status === 504 || status === 408) {
    return retryableSyncError('Sync timed out. This workout is saved on your phone. Tap Retry to send the exercises that did not save.');
  }
  if (status < 200 || status >= 300) {
    var serverMsg = body && typeof body.error === 'string' ? body.error : '';
    if (serverMsg && /tap retry/i.test(serverMsg)) return retryableSyncError(serverMsg);
    if (serverMsg) {
      return retryableSyncError(serverMsg + ' This workout is saved on your phone. Tap Retry.');
    }
    return retryableSyncError('Sync did not finish (HTTP ' + status + '). This workout is saved on your phone. Tap Retry to send what is left.');
  }
  return retryableSyncError('Sync returned an unexpected response. This workout is saved on your phone. Tap Retry.');
}

function readPin() {
  try { return localStorage.getItem('bl_pin') || ''; } catch (e) { return ''; }
}

async function postSync(payload, opts) {
  opts = opts || {};
  var timeoutMs = Number(opts.timeoutMs) > 0 ? Number(opts.timeoutMs) : SYNC_CLIENT_TIMEOUT_MS;
  var fetchImpl = opts.fetchImpl || fetch;
  var ctrl = new AbortController();
  var timer = setTimeout(function () { ctrl.abort(); }, timeoutMs);
  try {
    var response;
    try {
      response = await fetchImpl('/api/sync', {
        method: 'POST',
        headers: { 'x-app-pin': readPin(), 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: ctrl.signal,
      });
    } catch (err) {
      throw interpretSyncException(err);
    }
    var text = '';
    try {
      text = await response.text();
    } catch (err) {
      throw interpretSyncException(err);
    }
    var parsed = interpretSyncBody(response.status, text);
    if (parsed instanceof Error) throw parsed;
    return parsed;
  } finally {
    clearTimeout(timer);
  }
}

Object.assign(window, { postSync, SYNC_CLIENT_TIMEOUT_MS });
