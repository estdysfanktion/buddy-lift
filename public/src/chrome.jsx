// Dark-mode Buddy Lift shell — phone frame, status bar, bottom tab bar
// We intentionally build a custom dark frame (not the starter) to match the
// dense data-rich aesthetic. Width 402 / height 874 to mimic iPhone 16 Pro.

const BL = {
  bg: '#0A0B0D',          // deep near-black, subtle warm
  bg2: '#121317',
  card: '#17181C',
  card2: '#1E2025',
  line: '#2A2C33',
  line2: '#3A3D46',
  text: '#F2F3F5',
  text2: 'rgba(242,243,245,0.62)',
  text3: 'rgba(242,243,245,0.38)',
  red: '#FF5F57',
  green: '#30D158',
};

const MONO = "'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace";
const SANS = "'Inter', -apple-system, system-ui, sans-serif";

function PhoneShell({ children }) {
  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: BL.bg, fontFamily: SANS,
      WebkitFontSmoothing: 'antialiased', color: BL.text,
      display: 'flex', flexDirection: 'column',
    }}>
      {children}
    </div>
  );
}

// Tab bar — Home / Workout / History
function TabBar({ tab, onTab, accent }) {
  const items = [
    { id: 'home',    label: 'Home',    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M3 10l8-7 8 7v9a1 1 0 01-1 1h-4v-6H8v6H4a1 1 0 01-1-1v-9z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/></svg>
    )},
    { id: 'workout', label: 'Workout', icon: (
      <svg width="24" height="22" viewBox="0 0 24 22" fill="none"><path d="M3 8v6M6 5v12M18 5v12M21 8v6M6 11h12" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>
    )},
    { id: 'history', label: 'History', icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M3 11a8 8 0 108-8M3 11H1m2 0l2-2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/><path d="M11 6v5l3 2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>
    )},
  ];
  return (
    <div style={{
      position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 40,
      paddingBottom: 'env(safe-area-inset-bottom, 16px)', paddingTop: 8, display: 'flex',
      background: 'linear-gradient(to top, rgba(10,11,13,0.95) 40%, rgba(10,11,13,0))',
      backdropFilter: 'blur(20px)',
    }}>
      {items.map(it => {
        const active = tab === it.id;
        return (
          <button key={it.id} onClick={() => onTab(it.id)} style={{
            flex: 1, background: 'transparent', border: 0, padding: '8px 0',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
            color: active ? accent : BL.text3, cursor: 'pointer',
            transition: 'color .15s',
          }}>
            {it.icon}
            <span style={{
              fontFamily: SANS, fontSize: 10, fontWeight: 600, letterSpacing: 0.4,
              textTransform: 'uppercase',
            }}>{it.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// Reusable: label above numeric, monospace value
function Metric({ label, value, unit, accent, mono = true, size = 40, align = 'left' }) {
  return (
    <div style={{ textAlign: align }}>
      <div style={{
        fontFamily: SANS, fontSize: 10, fontWeight: 600, letterSpacing: 1.4,
        textTransform: 'uppercase', color: BL.text3,
      }}>{label}</div>
      <div style={{
        fontFamily: mono ? MONO : SANS, fontSize: size, fontWeight: 600,
        letterSpacing: -1, color: BL.text, marginTop: 4, lineHeight: 1,
        display: 'flex', alignItems: 'baseline', gap: 4,
        justifyContent: align === 'right' ? 'flex-end' : 'flex-start',
      }}>
        <span style={{ color: accent || BL.text }}>{value}</span>
        {unit && <span style={{ fontSize: size * 0.4, color: BL.text2, fontWeight: 500 }}>{unit}</span>}
      </div>
    </div>
  );
}

// Inline progress dots — completed / total
function Dots({ done, total, accent }) {
  return (
    <div style={{ display: 'flex', gap: 3 }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{
          width: 14, height: 3, borderRadius: 2,
          background: i < done ? accent : BL.line,
          transition: 'background .2s',
        }} />
      ))}
    </div>
  );
}

function Chip({ children, accent, filled, onClick, style }) {
  return (
    <div onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '4px 10px', borderRadius: 999, fontSize: 11,
      fontFamily: SANS, fontWeight: 600, letterSpacing: 0.3,
      background: filled ? accent : 'transparent',
      color: filled ? '#0A0B0D' : accent,
      border: filled ? 'none' : `1px solid ${accent}55`,
      cursor: onClick ? 'pointer' : 'default',
      ...style,
    }}>{children}</div>
  );
}

Object.assign(window, { BL, MONO, SANS, PhoneShell, TabBar, Metric, Dots, Chip });
