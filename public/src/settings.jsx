// Settings screen + real Notion sync helpers

// Detect if we're running against a real /api backend (Vercel) vs the design canvas
async function checkHealth() {
  try {
    const r = await fetch('/api/health');
    if (!r.ok) return { ok: false, reason: 'http_' + r.status };
    return await r.json();
  } catch (e) {
    return { ok: false, reason: 'no_backend', error: e.message };
  }
}

async function postSync(payload) {
  const r = await fetch('/api/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return r.json();
}

function SettingsScreen({ accent, onClose }) {
  const [health, setHealth] = React.useState(null);
  const [loading, setLoading] = React.useState(false);

  const check = async () => {
    setLoading(true);
    setHealth(await checkHealth());
    setLoading(false);
  };

  React.useEffect(() => { check(); }, []);

  const statusColor = health?.ok ? BL.green
    : health?.reason === 'no_backend' ? BL.text3
    : BL.red;

  const statusLabel = !health ? 'Checking…'
    : health.ok ? 'Connected'
    : health.reason === 'no_backend' ? 'Demo mode (no backend)'
    : health.reason === 'missing_env' ? 'Env vars missing'
    : health.reason === 'notion_error' ? 'Notion error'
    : 'Schema mismatch';

  return (
    <div style={{
      height: '100%', overflowY: 'auto', paddingBottom: 120,
      background: BL.bg,
    }}>
      <div style={{ padding: '62px 20px 14px' }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 6,
        }}>
          <div style={{
            fontFamily: SANS, fontSize: 11, color: BL.text3, fontWeight: 600,
            letterSpacing: 1, textTransform: 'uppercase',
          }}>Settings</div>
          <button onClick={onClose} style={{
            background: 'transparent', border: 0, color: accent,
            fontFamily: SANS, fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>Done</button>
        </div>
        <div style={{ fontFamily: SANS, fontSize: 28, fontWeight: 700, letterSpacing: -0.6, marginBottom: 20 }}>
          Notion Sync
        </div>

        {/* Connection status card */}
        <div style={{
          background: BL.card, borderRadius: 18, padding: 18,
          border: `1px solid ${BL.line}`, marginBottom: 14,
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12,
          }}>
            <div style={{
              width: 10, height: 10, borderRadius: 5, background: statusColor,
              boxShadow: `0 0 10px ${statusColor}`,
            }} />
            <div style={{ fontFamily: SANS, fontSize: 15, fontWeight: 600 }}>{statusLabel}</div>
            <button onClick={check} disabled={loading} style={{
              marginLeft: 'auto', padding: '5px 10px', borderRadius: 8,
              background: BL.bg, color: BL.text2, border: `1px solid ${BL.line2}`,
              fontFamily: MONO, fontSize: 10, cursor: 'pointer', fontWeight: 500,
            }}>{loading ? '…' : 'Recheck'}</button>
          </div>

          {health?.ok && (
            <div style={{ fontFamily: MONO, fontSize: 11, color: BL.text3, lineHeight: 1.6 }}>
              <div>Database: <span style={{ color: BL.text }}>{health.dbTitle}</span></div>
              <div>Properties: <span style={{ color: BL.text }}>{health.properties.length}</span> found</div>
            </div>
          )}

          {health?.reason === 'no_backend' && (
            <div style={{ fontFamily: SANS, fontSize: 12, color: BL.text3, lineHeight: 1.5 }}>
              You're viewing the design canvas. Deploy this project to Vercel to enable real Notion sync — see <span style={{ color: accent, fontFamily: MONO }}>deploy/README.md</span>.
            </div>
          )}

          {health?.reason === 'missing_env' && (
            <div style={{ fontFamily: SANS, fontSize: 12, color: BL.text3, lineHeight: 1.5 }}>
              Add <span style={{ color: BL.text, fontFamily: MONO, fontSize: 11 }}>NOTION_TOKEN</span> and <span style={{ color: BL.text, fontFamily: MONO, fontSize: 11 }}>NOTION_DATABASE_ID</span> in your Vercel project settings, then redeploy.
            </div>
          )}

          {health?.missing?.length > 0 && (
            <div style={{
              marginTop: 10, padding: 10, borderRadius: 10,
              background: `${BL.red}14`, border: `1px solid ${BL.red}44`,
              fontFamily: MONO, fontSize: 10, color: BL.red,
            }}>
              Missing properties: {health.missing.join(', ')}
            </div>
          )}
        </div>

        {/* Schema reference */}
        <div style={{
          fontFamily: SANS, fontSize: 11, fontWeight: 700, letterSpacing: 1.2,
          textTransform: 'uppercase', color: BL.text3, margin: '18px 0 10px',
        }}>Expected schema</div>
        <div style={{ background: BL.card, borderRadius: 16, overflow: 'hidden', border: `1px solid ${BL.line}` }}>
          {[
            ['Name', 'Title'],
            ['Date', 'Date'],
            ['Exercise', 'Multi-select'],
            ['Weight', 'Number'],
            ['Rest', 'Number'],
            ['Set 1 – Set 8', 'Number'],
            ['Total Volume', 'Formula'],
          ].map(([k, v], i, arr) => (
            <div key={k} style={{
              padding: '11px 14px', display: 'flex', justifyContent: 'space-between',
              borderBottom: i < arr.length - 1 ? `1px solid ${BL.line}` : 'none',
              fontFamily: MONO, fontSize: 12,
            }}>
              <span style={{ color: BL.text }}>{k}</span>
              <span style={{ color: BL.text3 }}>{v}</span>
            </div>
          ))}
        </div>

        <div style={{
          marginTop: 18, padding: 14, borderRadius: 14,
          background: 'transparent', border: `1px dashed ${BL.line2}`,
          fontFamily: SANS, fontSize: 12, color: BL.text3, lineHeight: 1.5,
        }}>
          The Notion integration secret lives only on Vercel as an env var. The iPhone app never sees it — every sync goes through <span style={{ fontFamily: MONO, color: BL.text2 }}>/api/sync</span>.
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { SettingsScreen, checkHealth, postSync });
