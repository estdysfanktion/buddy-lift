// NumberPad, RestBanner, ExercisePicker, HistoryScreen, SummaryScreen

function NumberPad({ kind, initial, accent, onSubmit, onClose }) {
  const [val, setVal] = React.useState(String(initial || ''));
  const label = kind === 'weight' ? 'Weight (kg)' : kind === 'rest' ? 'Rest (sec)' : `Reps · Set ${kind === 'set' ? '' : ''}`;
  const unit = kind === 'weight' ? 'kg' : kind === 'rest' ? 's' : 'reps';
  const allowDecimal = kind === 'weight';

  const press = (k) => {
    if (k === 'back') return setVal(v => v.slice(0, -1));
    if (k === 'clear') return setVal('');
    if (k === '.') {
      if (!allowDecimal || val.includes('.')) return;
      return setVal(v => v + '.');
    }
    setVal(v => (v + k).slice(0, 6));
  };

  const submit = () => {
    const n = parseFloat(val || '0');
    onSubmit(kind === 'weight' ? n : Math.round(n));
  };

  return (
    <div onClick={onClose} style={{
      position: 'absolute', inset: 0, zIndex: 80,
      background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'flex-end',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%', background: BL.bg2, borderTopLeftRadius: 24, borderTopRightRadius: 24,
        padding: '10px 16px 30px', border: `1px solid ${BL.line}`, borderBottom: 'none',
      }}>
        <div style={{ width: 36, height: 4, borderRadius: 3, background: BL.line2, margin: '6px auto 14px' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
          <div style={{
            fontFamily: SANS, fontSize: 11, fontWeight: 700, letterSpacing: 1.2,
            textTransform: 'uppercase', color: BL.text3,
          }}>{kind === 'set' ? 'Reps this set' : label}</div>
          <div onClick={() => setVal('')} style={{
            fontFamily: SANS, fontSize: 12, color: accent, fontWeight: 600, cursor: 'pointer',
          }}>Clear</div>
        </div>
        <div style={{
          background: BL.card, borderRadius: 14, padding: '18px 20px', marginBottom: 14,
          border: `1px solid ${BL.line}`, display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 6,
        }}>
          <span style={{
            fontFamily: MONO, fontSize: 48, fontWeight: 600, letterSpacing: -2, color: accent, lineHeight: 1,
          }}>{val || '0'}</span>
          <span style={{ fontFamily: MONO, fontSize: 16, color: BL.text2 }}>{unit}</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {['1','2','3','4','5','6','7','8','9', allowDecimal ? '.' : '', '0', 'back'].map((k, i) => {
            if (!k) return <div key={'empty-'+i} />;
            const isBack = k === 'back';
            return (
              <button key={'k-'+i} onClick={() => press(k)} style={{
                padding: '16px 0', borderRadius: 12,
                background: BL.card, color: BL.text, border: `1px solid ${BL.line}`,
                fontFamily: MONO, fontSize: 22, fontWeight: 500, cursor: 'pointer',
              }}>
                {isBack ? (
                  <svg width="20" height="14" viewBox="0 0 20 14" fill="none" style={{ display: 'block', margin: '0 auto' }}>
                    <path d="M6 1h12a1 1 0 011 1v10a1 1 0 01-1 1H6L1 7 6 1z" stroke={BL.text2} strokeWidth="1.5"/>
                    <path d="M9 5l5 4M14 5l-5 4" stroke={BL.text2} strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                ) : k}
              </button>
            );
          })}
        </div>
        <button onClick={submit} style={{
          width: '100%', padding: '14px', borderRadius: 12, marginTop: 10,
          background: accent, color: '#0A0B0D', border: 0,
          fontFamily: SANS, fontSize: 15, fontWeight: 700, cursor: 'pointer',
        }}>Done</button>
      </div>
    </div>
  );
}

function RestBanner({ seconds, accent, onSkip, onAdd }) {
  const [left, setLeft] = React.useState(seconds);
  React.useEffect(() => { setLeft(seconds); }, [seconds]);
  React.useEffect(() => {
    if (left <= 0) return;
    const t = setInterval(() => setLeft(l => Math.max(0, l - 1)), 1000);
    return () => clearInterval(t);
  }, [left > 0]);

  if (seconds <= 0 || left <= 0) return null;
  const pct = (left / seconds) * 100;

  return (
    <div style={{
      position: 'absolute', top: 48, left: 12, right: 12, zIndex: 30,
      background: 'rgba(23,24,28,0.92)', backdropFilter: 'blur(18px)',
      border: `1px solid ${accent}55`, borderRadius: 14, padding: '10px 14px',
      display: 'flex', alignItems: 'center', gap: 12,
      boxShadow: `0 14px 30px rgba(0,0,0,0.4), 0 0 0 1px ${accent}22`,
      overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', left: 0, bottom: 0, height: 2,
        background: accent, width: `${pct}%`, transition: 'width 1s linear',
      }} />
      <div style={{
        width: 8, height: 8, borderRadius: 4, background: accent, boxShadow: `0 0 10px ${accent}`,
      }} />
      <div style={{ flex: 1 }}>
        <div style={{
          fontFamily: SANS, fontSize: 10, fontWeight: 700, letterSpacing: 1.2,
          textTransform: 'uppercase', color: BL.text3,
        }}>Resting</div>
        <div style={{ fontFamily: MONO, fontSize: 18, fontWeight: 600, color: BL.text, letterSpacing: -0.5, lineHeight: 1.1 }}>
          {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}
        </div>
      </div>
      <button onClick={onAdd} style={{
        padding: '6px 10px', borderRadius: 8, background: 'transparent',
        color: BL.text2, border: `1px solid ${BL.line2}`,
        fontFamily: MONO, fontSize: 11, fontWeight: 500, cursor: 'pointer',
      }}>+30s</button>
      <button onClick={onSkip} style={{
        padding: '6px 10px', borderRadius: 8, background: accent,
        color: '#0A0B0D', border: 0, fontFamily: SANS, fontSize: 11, fontWeight: 700, cursor: 'pointer',
      }}>Skip</button>
    </div>
  );
}

function ExercisePicker({ accent, currentExercise, onSwap, onClose }) {
  const [q, setQ] = React.useState('');
  const filtered = ALL_EXERCISES.filter(e => e.toLowerCase().includes(q.toLowerCase()));

  return (
    <div onClick={onClose} style={{
      position: 'absolute', inset: 0, zIndex: 70, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'flex-end',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%', height: '82%', background: BL.bg2,
        borderTopLeftRadius: 24, borderTopRightRadius: 24,
        padding: '10px 16px 30px', border: `1px solid ${BL.line}`, borderBottom: 'none',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ width: 36, height: 4, borderRadius: 3, background: BL.line2, margin: '6px auto 14px' }} />
        <div style={{
          fontFamily: SANS, fontSize: 22, fontWeight: 700, letterSpacing: -0.4, marginBottom: 2,
        }}>Swap exercise</div>
        <div style={{
          fontFamily: SANS, fontSize: 12, color: BL.text3, marginBottom: 14,
        }}>Replacing <span style={{ color: BL.text }}>{currentExercise}</span></div>
        <div style={{
          background: BL.card, borderRadius: 12, padding: '10px 14px', marginBottom: 14,
          border: `1px solid ${BL.line}`, display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="6" cy="6" r="5" stroke={BL.text3} strokeWidth="1.5"/><path d="M10 10l3 3" stroke={BL.text3} strokeWidth="1.5" strokeLinecap="round"/></svg>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search exercises" style={{
            flex: 1, background: 'transparent', border: 0, outline: 'none',
            color: BL.text, fontFamily: SANS, fontSize: 14,
          }}/>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', margin: '0 -16px', padding: '0 16px' }}>
          {[1,3,5].map(d => {
            const items = DAYS[d].exercises.filter(e => e.toLowerCase().includes(q.toLowerCase()));
            if (!items.length) return null;
            return (
              <div key={d} style={{ marginBottom: 18 }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8,
                  fontFamily: SANS, fontSize: 10, fontWeight: 700, letterSpacing: 1.2,
                  textTransform: 'uppercase', color: BL.text3,
                }}>
                  <div style={{ width: 6, height: 6, borderRadius: 3, background: DAY_ACCENTS[d].hex }} />
                  Day {d} · {DAYS[d].title}
                </div>
                {items.map(ex => (
                  <div key={ex} onClick={() => onSwap(ex)} style={{
                    padding: '11px 14px', borderRadius: 10, marginBottom: 4,
                    background: ex === currentExercise ? `${accent}1A` : BL.card,
                    border: `1px solid ${ex === currentExercise ? accent : BL.line}`,
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  }}>
                    <div style={{ fontFamily: SANS, fontSize: 14, fontWeight: 500, color: BL.text }}>
                      {ex}
                    </div>
                    {ex === currentExercise && (
                      <div style={{ fontFamily: MONO, fontSize: 10, color: accent, letterSpacing: 1 }}>CURRENT</div>
                    )}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// History / Charts
// ─────────────────────────────────────────────────────────────
function HistoryScreen({ accent, history }) {
  const exercises = [...new Set(history.map(h => h.exercise))];
  const [selected, setSelected] = React.useState(null);
  const effectiveSelected = selected && exercises.includes(selected) ? selected : exercises[0];

  const data = history
    .filter(h => h.exercise === effectiveSelected)
    .sort((a,b) => a.date.localeCompare(b.date))
    .map(h => ({
      date: h.date,
      weight: h.weight,
      volume: h.volume,
      bestSet: h.sets.length ? Math.max(...h.sets) : 0,
      totalReps: h.sets.reduce((a,b)=>a+b, 0),
    }));

  const dayId = history.find(h => h.exercise === effectiveSelected)?.day || 1;
  const dayAccent = DAY_ACCENTS[dayId]?.hex || accent;

  return (
    <div style={{ height: '100%', overflowY: 'auto', paddingBottom: 120, background: BL.bg }}>
      <div style={{ padding: '20px 20px 14px' }}>
        <div style={{ fontFamily: SANS, fontSize: 11, color: BL.text3, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>
          Exercise history
        </div>
        <div style={{ fontFamily: SANS, fontSize: 28, fontWeight: 700, letterSpacing: -0.6, marginBottom: 16 }}>
          Progress
        </div>

        {/* horizontal scroll: exercise chips */}
        <div style={{
          display: 'flex', gap: 6, overflowX: 'auto', margin: '0 -20px 18px',
          padding: '0 20px 4px', scrollbarWidth: 'none',
        }}>
          {exercises.map(ex => {
            const d = history.find(h => h.exercise === ex)?.day;
            const c = DAY_ACCENTS[d].hex;
            const active = ex === effectiveSelected;
            return (
              <button key={ex} onClick={() => setSelected(ex)} style={{
                flexShrink: 0, padding: '7px 12px', borderRadius: 20,
                background: active ? c : BL.card,
                color: active ? '#0A0B0D' : BL.text2,
                border: `1px solid ${active ? c : BL.line}`,
                fontFamily: SANS, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}>{ex}</button>
            );
          })}
        </div>

        {/* Chart */}
        {data.length > 1 && <VolumeChart data={data} accent={dayAccent} />}

        {/* PR summary */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 14,
        }}>
          <MiniStat label="Sessions" value={data.length} />
          <MiniStat label="Best vol" value={data.length ? formatK(Math.max(...data.map(d=>d.volume))) : '–'} unit="kg" />
          <MiniStat label="Heaviest" value={data.length ? Math.max(...data.map(d=>d.weight)) : '–'} unit="kg" />
        </div>

        {/* Session list */}
        <div style={{
          fontFamily: SANS, fontSize: 11, fontWeight: 700, letterSpacing: 1.2,
          textTransform: 'uppercase', color: BL.text3, margin: '22px 0 10px',
        }}>All sessions</div>
        <div style={{ background: BL.card, borderRadius: 16, border: `1px solid ${BL.line}`, overflow: 'hidden' }}>
          {data.slice().reverse().map((d, i) => {
            const date = new Date(d.date);
            const mo = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'][date.getMonth()];
            return (
              <div key={d.date} style={{
                padding: '12px 14px',
                borderBottom: i < data.length - 1 ? `1px solid ${BL.line}` : 'none',
                display: 'grid', gridTemplateColumns: '56px 1fr 70px', alignItems: 'center', gap: 10,
              }}>
                <div>
                  <div style={{ fontFamily: MONO, fontSize: 15, fontWeight: 600 }}>
                    {date.getDate()} <span style={{ color: BL.text3, fontWeight: 400 }}>{mo}</span>
                  </div>
                </div>
                <div style={{ fontFamily: MONO, fontSize: 12, color: BL.text2 }}>
                  <span style={{ color: dayAccent, fontWeight: 600 }}>{d.weight}kg</span>
                  <span style={{ color: BL.text3 }}> · {d.totalReps} reps · top set {d.bestSet}</span>
                </div>
                <div style={{ textAlign: 'right', fontFamily: MONO, fontSize: 13, fontWeight: 600 }}>
                  {formatK(d.volume)}<span style={{ color: BL.text3, fontSize: 10, marginLeft: 2 }}>kg</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value, unit }) {
  return (
    <div style={{ background: BL.card, borderRadius: 12, padding: '10px 12px', border: `1px solid ${BL.line}` }}>
      <div style={{ fontFamily: SANS, fontSize: 9, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: BL.text3, marginBottom: 4 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
        <span style={{ fontFamily: MONO, fontSize: 18, fontWeight: 600, letterSpacing: -0.5 }}>{value}</span>
        {unit && <span style={{ fontFamily: MONO, fontSize: 10, color: BL.text3 }}>{unit}</span>}
      </div>
    </div>
  );
}

function VolumeChart({ data, accent }) {
  const W = 340, H = 150, P = 16;
  const vMax = Math.max(...data.map(d => d.volume));
  const vMin = 0;
  const wMax = Math.max(...data.map(d => d.weight));
  const wMin = Math.min(...data.map(d => d.weight));
  const wRange = wMax - wMin || 1;

  const x = (i) => P + (i / (data.length - 1)) * (W - 2 * P);
  const yV = (v) => H - P - ((v - vMin) / (vMax - vMin || 1)) * (H - 2 * P - 12);
  const yW = (w) => H - P - ((w - wMin) / wRange) * (H - 2 * P - 12);

  const volPath = data.map((d, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + yV(d.volume).toFixed(1)).join(' ');
  const volFill = volPath + ` L${x(data.length - 1).toFixed(1)} ${H - P} L${x(0).toFixed(1)} ${H - P} Z`;
  const wPath = data.map((d, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + yW(d.weight).toFixed(1)).join(' ');

  return (
    <div style={{
      background: BL.card, borderRadius: 16, padding: 14,
      border: `1px solid ${BL.line}`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <div>
          <div style={{ fontFamily: SANS, fontSize: 10, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: BL.text3 }}>Latest session</div>
          <div style={{ fontFamily: MONO, fontSize: 22, fontWeight: 600, letterSpacing: -0.8, color: accent }}>
            {formatK(data[data.length-1].volume)}<span style={{ fontSize: 12, color: BL.text2 }}>kg vol</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, fontFamily: MONO, fontSize: 10, color: BL.text3 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 10, height: 2, background: accent }} /> VOLUME
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 10, height: 2, background: BL.text2, borderStyle: 'dashed' }} /> WEIGHT
          </div>
        </div>
      </div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
        <defs>
          <linearGradient id="vgrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={accent} stopOpacity="0.32"/>
            <stop offset="100%" stopColor={accent} stopOpacity="0"/>
          </linearGradient>
        </defs>
        {/* grid */}
        {[0.25, 0.5, 0.75].map(t => (
          <line key={t} x1={P} x2={W-P} y1={P + t*(H-2*P-12)} y2={P + t*(H-2*P-12)} stroke={BL.line} strokeDasharray="2 3"/>
        ))}
        <path d={volFill} fill="url(#vgrad)"/>
        <path d={volPath} fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d={wPath} fill="none" stroke={BL.text2} strokeWidth="1.5" strokeDasharray="3 3" strokeLinecap="round"/>
        {data.map((d, i) => (
          <circle key={i} cx={x(i)} cy={yV(d.volume)} r={i === data.length - 1 ? 3.5 : 1.8} fill={accent} />
        ))}
        {/* x labels */}
        {data.map((d, i) => {
          if (data.length > 6 && i % Math.ceil(data.length / 5) !== 0 && i !== data.length - 1) return null;
          const date = new Date(d.date);
          return (
            <text key={i} x={x(i)} y={H - 2} fontSize="8" fontFamily={MONO} fill={BL.text3} textAnchor="middle">
              {date.getDate()}/{date.getMonth()+1}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Post-workout summary
// ─────────────────────────────────────────────────────────────
function SummaryScreen({ accent, dayId, session, onDone, liveSync = false }) {
  const day = DAYS[dayId];
  const totalVol = session.exercises.reduce((a, e) =>
    a + e.weight * e.sets.reduce((s, r) => s + (r || 0), 0), 0);
  const totalSets = session.exercises.reduce((a, e) => a + e.sets.filter(s => s != null).length, 0);
  const totalReps = session.exercises.reduce((a, e) => a + e.sets.reduce((s, r) => s + (r || 0), 0), 0);

  // Sync state: 'idle' | 'syncing' | 'ok' | 'partial' | 'fail' | 'demo'
  const [syncState, setSyncState] = React.useState('idle');
  const [syncResults, setSyncResults] = React.useState(null);

  const doSync = React.useCallback(async () => {
    if (typeof postSync !== 'function') {
      setSyncState('fail');
      setSyncResults([{ ok: false, error: 'postSync not available' }]);
      return;
    }
    setSyncState('syncing');
    try {
      const payload = {
        date: new Date().toISOString().slice(0, 10),
        dayId,
        dayTitle: day.title,
        exercises: session.exercises.map(ex => ({
          exercise: ex.exercise,
          weight: ex.weight,
          rest: ex.rest,
          sets: ex.sets.filter(s => s != null),
        })),
      };
      const res = await postSync(payload);
      setSyncResults(res.results || []);
      setSyncState(res.ok ? 'ok' : (res.results?.some(r => r.ok) ? 'partial' : 'fail'));
    } catch (e) {
      setSyncState('fail');
      setSyncResults([{ ok: false, error: e.message }]);
    }
  }, [liveSync, dayId, session]);


  return (
    <div style={{
      height: '100%', overflowY: 'auto', paddingBottom: 40,
      background: `radial-gradient(120% 60% at 50% -5%, ${DAY_ACCENTS[dayId].soft} 0%, transparent 60%), ${BL.bg}`,
    }}>
      <div style={{ padding: '20px 20px 20px' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 10,
          fontFamily: MONO, fontSize: 11, color: accent, letterSpacing: 1,
        }}>
          <div style={{ width: 6, height: 6, borderRadius: 3, background: accent, boxShadow: `0 0 8px ${accent}` }} />
          COMPLETE · {formatTime(session.elapsed)}
        </div>
        <div style={{ fontFamily: SANS, fontSize: 34, fontWeight: 700, letterSpacing: -1, marginBottom: 2, lineHeight: 1.1 }}>
          Nice work.
        </div>
        <div style={{ fontFamily: SANS, fontSize: 14, color: BL.text2, marginBottom: 24 }}>
          Day {dayId} · {day.title}
        </div>

        {/* hero stats */}
        <div style={{
          background: BL.card, borderRadius: 20, padding: 20,
          border: `1px solid ${accent}33`,
          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
          marginBottom: 14,
        }}>
          <div>
            <div style={{ fontFamily: SANS, fontSize: 9, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: BL.text3, marginBottom: 4 }}>Volume</div>
            <div style={{ fontFamily: MONO, fontSize: 24, fontWeight: 600, letterSpacing: -1, color: accent }}>{formatK(totalVol)}</div>
            <div style={{ fontFamily: MONO, fontSize: 10, color: BL.text3 }}>kg</div>
          </div>
          <div style={{ borderLeft: `1px solid ${BL.line}`, paddingLeft: 16 }}>
            <div style={{ fontFamily: SANS, fontSize: 9, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: BL.text3, marginBottom: 4 }}>Sets</div>
            <div style={{ fontFamily: MONO, fontSize: 24, fontWeight: 600, letterSpacing: -1 }}>{totalSets}</div>
            <div style={{ fontFamily: MONO, fontSize: 10, color: BL.text3 }}>{totalReps} reps</div>
          </div>
          <div style={{ borderLeft: `1px solid ${BL.line}`, paddingLeft: 16 }}>
            <div style={{ fontFamily: SANS, fontSize: 9, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: BL.text3, marginBottom: 4 }}>Time</div>
            <div style={{ fontFamily: MONO, fontSize: 24, fontWeight: 600, letterSpacing: -1 }}>{formatTime(session.elapsed)}</div>
            <div style={{ fontFamily: MONO, fontSize: 10, color: BL.text3 }}>mm:ss</div>
          </div>
        </div>

        {/* Per-exercise rows */}
        <div style={{
          fontFamily: SANS, fontSize: 11, fontWeight: 700, letterSpacing: 1.2,
          textTransform: 'uppercase', color: BL.text3, margin: '8px 0 10px',
        }}>Per exercise</div>
        <div style={{ background: BL.card, borderRadius: 16, overflow: 'hidden', border: `1px solid ${BL.line}` }}>
          {session.exercises.map((ex, i) => {
            const vol = ex.weight * ex.sets.reduce((s, r) => s + (r || 0), 0);
            const setStr = ex.sets.filter(s => s != null).map(s => s).join(' · ');
            return (
              <div key={i} style={{
                padding: '14px 14px',
                borderBottom: i < session.exercises.length - 1 ? `1px solid ${BL.line}` : 'none',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                  <div style={{ fontFamily: SANS, fontSize: 14, fontWeight: 600 }}>{ex.exercise}</div>
                  <div style={{ fontFamily: MONO, fontSize: 13, fontWeight: 600, color: accent }}>
                    {vol}<span style={{ fontSize: 10, color: BL.text3 }}>kg</span>
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: MONO, fontSize: 11, color: BL.text3 }}>
                  <span>{ex.weight}kg · {ex.sets.filter(s => s != null).length} sets</span>
                  <span>{setStr}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Notion sync */}
        <SyncStrip
          state={syncState}
          results={syncResults}
          accent={accent}
          onSync={doSync}
          onRetry={doSync}
          exerciseCount={session.exercises.length}
          liveSync={liveSync}
        />

        <button onClick={onDone} style={{
          width: '100%', padding: '14px', borderRadius: 14, marginTop: 16,
          background: accent, color: '#0A0B0D', border: 0,
          fontFamily: SANS, fontSize: 15, fontWeight: 700, cursor: 'pointer',
          letterSpacing: -0.2,
        }}>Done</button>
      </div>
    </div>
  );
}

Object.assign(window, { NumberPad, RestBanner, ExercisePicker, HistoryScreen, SummaryScreen });

function SyncStrip({ state, results, accent, onSync, onRetry, exerciseCount, liveSync }) {
  const okCount = results?.filter(r => r.ok).length ?? 0;
  const failCount = results?.filter(r => !r.ok).length ?? 0;

  const pal = state === 'ok' ? BL.green
    : state === 'syncing' ? accent
    : state === 'partial' ? '#FFB347'
    : state === 'fail' ? BL.red
    : accent;

  const label = state === 'ok' ? 'Synced to Notion'
    : state === 'syncing' ? 'Syncing to Notion…'
    : state === 'partial' ? `${okCount}/${exerciseCount} synced`
    : state === 'fail' ? 'Sync failed'
    : 'Save to Notion';

  const sub = state === 'ok' ? `${exerciseCount} exercises saved · just now`
    : state === 'syncing' ? `Writing ${exerciseCount} exercises…`
    : state === 'partial' ? `${failCount} failed — tap retry`
    : state === 'fail' ? (results?.[0]?.error || 'Check Settings → Notion sync')
    : `${exerciseCount} exercises with sets, weights & date`;

  return (
    <div style={{
      marginTop: 16, padding: 14, borderRadius: 14,
      background: BL.card,
      border: `1px solid ${state === 'fail' ? BL.red + '44' : state === 'ok' ? BL.green + '44' : accent + '33'}`,
      display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 8, background: BL.bg,
        border: `1px solid ${BL.line2}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{
          width: 10, height: 10, borderRadius: 5, background: pal,
          boxShadow: state === 'syncing' ? `0 0 10px ${pal}` : 'none',
          animation: state === 'syncing' ? 'blPulse 1s ease-in-out infinite' : 'none',
        }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: SANS, fontSize: 13, fontWeight: 600 }}>{label}</div>
        <div style={{ fontFamily: MONO, fontSize: 10, color: BL.text3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {sub}
        </div>
      </div>
      {state === 'idle' && (
        <button onClick={onSync} style={{
          padding: '8px 14px', borderRadius: 10, background: accent,
          color: '#0A0B0D', border: 0, fontFamily: SANS, fontSize: 12, fontWeight: 700,
          cursor: 'pointer', whiteSpace: 'nowrap',
        }}>Sync →</button>
      )}
      {(state === 'fail' || state === 'partial') && (
        <button onClick={onRetry} style={{
          padding: '8px 14px', borderRadius: 10, background: accent,
          color: '#0A0B0D', border: 0, fontFamily: SANS, fontSize: 12, fontWeight: 700, cursor: 'pointer',
        }}>Retry</button>
      )}
    </div>
  );
}

Object.assign(window, { SyncStrip });

// pulse keyframes
if (typeof document !== 'undefined' && !document.getElementById('bl-pulse-kf')) {
  const s = document.createElement('style'); s.id = 'bl-pulse-kf';
  s.textContent = '@keyframes blPulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }';
  document.head.appendChild(s);
}
