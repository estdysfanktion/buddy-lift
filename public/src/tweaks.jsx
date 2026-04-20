// Tweaks panel — exposes card-variant + day/color toggles

function TweaksPanel({ visible, tweaks, setTweak }) {
  if (!visible) return null;

  return (
    <div style={{
      position: 'fixed', bottom: 20, right: 20, zIndex: 9999,
      width: 280, background: 'rgba(18,19,23,0.96)', backdropFilter: 'blur(20px)',
      borderRadius: 18, padding: 16, color: '#F2F3F5',
      border: '1px solid rgba(255,255,255,0.1)',
      boxShadow: '0 24px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)',
      fontFamily: "'Inter', system-ui",
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14,
      }}>
        <div style={{ width: 6, height: 6, borderRadius: 3, background: '#B8FF3C' }} />
        <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: -0.1 }}>Tweaks</div>
      </div>

      <TweakGroup label="Active card layout">
        <SegControl
          value={tweaks.cardVariant}
          onChange={v => setTweak('cardVariant', v)}
          options={[
            { v: 'bubbles', label: 'Bubbles' },
            { v: 'list',    label: 'List' },
            { v: 'grid',    label: 'Grid' },
          ]}
        />
      </TweakGroup>

      <TweakGroup label="Workout day">
        <SegControl
          value={String(tweaks.dayId)}
          onChange={v => setTweak('dayId', parseInt(v))}
          options={[
            { v: '1', label: 'Day 1', color: '#4B9CFF' },
            { v: '3', label: 'Day 3', color: '#B8FF3C' },
            { v: '5', label: 'Day 5', color: '#FFB347' },
          ]}
        />
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 6, fontFamily: "'JetBrains Mono', monospace" }}>
          {DAYS[tweaks.dayId].title}
        </div>
      </TweakGroup>

      <TweakGroup label="Present as">
        <SegControl
          value={tweaks.showAllVariants ? 'all' : 'single'}
          onChange={v => setTweak('showAllVariants', v === 'all')}
          options={[
            { v: 'single', label: 'Flow' },
            { v: 'all',    label: 'All variants' },
          ]}
        />
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 6, lineHeight: 1.4 }}>
          {tweaks.showAllVariants
            ? 'All 3 Active-card layouts side-by-side'
            : 'Single interactive prototype'}
        </div>
      </TweakGroup>
    </div>
  );
}

function TweakGroup({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{
        fontSize: 10, fontWeight: 700, letterSpacing: 1.2,
        textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)', marginBottom: 6,
      }}>{label}</div>
      {children}
    </div>
  );
}

function SegControl({ value, onChange, options }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: `repeat(${options.length}, 1fr)`,
      gap: 3, background: 'rgba(255,255,255,0.05)', padding: 3,
      borderRadius: 10,
    }}>
      {options.map(opt => {
        const active = opt.v === value;
        return (
          <button key={opt.v} onClick={() => onChange(opt.v)} style={{
            padding: '7px 4px', borderRadius: 7,
            background: active ? '#FFF' : 'transparent',
            color: active ? '#0A0B0D' : 'rgba(255,255,255,0.7)',
            border: 0, cursor: 'pointer',
            fontFamily: "'Inter', system-ui", fontSize: 11, fontWeight: 600,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
            transition: 'all .12s',
          }}>
            {opt.color && <div style={{ width: 6, height: 6, borderRadius: 3, background: opt.color }} />}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

Object.assign(window, { TweaksPanel });
