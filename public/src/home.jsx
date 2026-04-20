// Home screen — streak, week volume, next day, recent activity

function HomeScreen({ accent, dayId, history, onStart, onSettings }) {
  const day = DAYS[dayId];
  const streak = computeStreak(history);
  const vol = weekVolume(history);

  // last 7 days activity grid
  const today = new Date();
  const hour = today.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const grid = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (6 - i));
    const iso = d.toISOString().slice(0,10);
    const found = history.find(h => h.date === iso);
    return {
      date: d, iso,
      label: ['S','M','T','W','T','F','S'][d.getDay()],
      dayId: found?.day,
    };
  });

  // last 3 workouts (distinct dates), volume per session
  const byDate = {};
  history.forEach(h => { byDate[h.date] = (byDate[h.date] || { vol: 0, day: h.day, count: 0 }); byDate[h.date].vol += h.volume; byDate[h.date].count++; });
  const recent = Object.entries(byDate)
    .sort((a,b) => b[0].localeCompare(a[0]))
    .slice(0, 4)
    .map(([date, v]) => ({ date, ...v }));

  const maxVol = Math.max(...recent.map(r => r.vol));

  return (
    <div style={{
      padding: '70px 20px 120px', height: '100%', overflowY: 'auto',
      background: `radial-gradient(120% 60% at 50% -10%, ${DAY_ACCENTS[dayId].soft} 0%, transparent 60%), ${BL.bg}`,
    }}>
      {/* Greeting + date */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
        <div style={{ fontFamily: SANS, fontSize: 13, color: BL.text3, fontWeight: 500, letterSpacing: 0.2 }}>
          MON · APR 20
        </div>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          fontFamily: MONO, fontSize: 11, color: BL.text3,
          cursor: onSettings ? 'pointer' : 'default',
        }} onClick={onSettings}>
          <div style={{ width: 6, height: 6, borderRadius: 3, background: BL.green }} />
          SYNCED 2m
          {onSettings && (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ marginLeft: 2 }}>
              <circle cx="6" cy="6" r="1.6" stroke={BL.text3} strokeWidth="1.2"/>
              <path d="M6 1v1.5M6 9.5V11M1 6h1.5M9.5 6H11M2.5 2.5l1 1M8.5 8.5l1 1M2.5 9.5l1-1M8.5 3.5l1-1" stroke={BL.text3} strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
          )}
        </div>
      </div>
      <div style={{ fontFamily: SANS, fontSize: 28, fontWeight: 700, letterSpacing: -0.6, marginBottom: 20 }}>
        {greeting}, Zakir
      </div>

      {/* Hero: next workout card */}
      <div style={{
        position: 'relative',
        background: `linear-gradient(145deg, ${DAY_ACCENTS[dayId].soft}, ${BL.card})`,
        border: `1px solid ${accent}44`,
        borderRadius: 22, padding: 20, overflow: 'hidden',
        boxShadow: `0 20px 40px -20px ${accent}55`,
      }}>
        {/* decorative numeral */}
        <div style={{
          position: 'absolute', right: -20, top: -40, fontFamily: MONO,
          fontSize: 220, fontWeight: 700, color: accent, opacity: 0.08,
          lineHeight: 1, letterSpacing: -10,
        }}>0{dayId}</div>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 10,
          fontFamily: MONO, fontSize: 11, color: accent, letterSpacing: 1,
        }}>
          <div style={{ width: 6, height: 6, borderRadius: 3, background: accent, boxShadow: `0 0 8px ${accent}` }} />
          UP NEXT · DAY {dayId}
        </div>
        <div style={{ fontFamily: SANS, fontSize: 26, fontWeight: 700, letterSpacing: -0.6, marginBottom: 2 }}>
          {day.title}
        </div>
        <div style={{ fontFamily: SANS, fontSize: 13, color: BL.text2, marginBottom: 16 }}>
          {day.exercises.length} exercises · ~52 min
        </div>

        {/* exercise pills preview */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 18 }}>
          {day.exercises.slice(0, 4).map(ex => (
            <div key={ex} style={{
              padding: '5px 10px', borderRadius: 7, fontSize: 11,
              background: 'rgba(255,255,255,0.04)', color: BL.text2,
              border: `1px solid ${BL.line}`, fontWeight: 500,
            }}>{ex}</div>
          ))}
          {day.exercises.length > 4 && (
            <div style={{ padding: '5px 10px', borderRadius: 7, fontSize: 11, color: BL.text3, fontFamily: MONO }}>
              +{day.exercises.length - 4}
            </div>
          )}
        </div>

        <button onClick={onStart} style={{
          width: '100%', padding: '14px 20px', borderRadius: 14,
          background: accent, color: '#0A0B0D', border: 0,
          fontFamily: SANS, fontSize: 15, fontWeight: 700, letterSpacing: -0.2,
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          boxShadow: `0 8px 24px -6px ${accent}99`,
        }}>
          Start workout
          <svg width="16" height="14" viewBox="0 0 16 14" fill="none"><path d="M1 7h13m0 0L9 2m5 5l-5 5" stroke="#0A0B0D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
      </div>

      {/* Stats row */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 14,
      }}>
        <StatTile
          label="Streak"
          value={streak}
          unit="days"
          trail={
            <div style={{ display: 'flex', gap: 2, marginTop: 8 }}>
              {grid.map((g, i) => (
                <div key={i} style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{
                    height: 18, borderRadius: 3,
                    background: g.dayId ? DAY_ACCENTS[g.dayId].hex : BL.line,
                    opacity: g.dayId ? 1 : 0.6,
                  }} />
                  <div style={{
                    fontFamily: MONO, fontSize: 9, color: BL.text3, marginTop: 3,
                  }}>{g.label}</div>
                </div>
              ))}
            </div>
          }
        />
        <StatTile
          label="Week volume"
          value={formatK(vol)}
          unit="kg"
          trail={
            <Sparkline data={recent.slice().reverse().map(r => r.vol)} accent={accent} />
          }
        />
      </div>

      {/* Recent sessions */}
      <div style={{ marginTop: 22 }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
          marginBottom: 10,
        }}>
          <div style={{
            fontFamily: SANS, fontSize: 11, fontWeight: 700, letterSpacing: 1.4,
            textTransform: 'uppercase', color: BL.text3,
          }}>Recent sessions</div>
          <div style={{ fontFamily: SANS, fontSize: 12, color: accent, fontWeight: 600 }}>See all</div>
        </div>
        <div style={{
          background: BL.card, borderRadius: 16, overflow: 'hidden',
          border: `1px solid ${BL.line}`,
        }}>
          {recent.map((r, i) => {
            const d = new Date(r.date);
            const mo = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'][d.getMonth()];
            const pct = (r.vol / maxVol) * 100;
            return (
              <div key={r.date} style={{
                padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12,
                borderBottom: i < recent.length - 1 ? `1px solid ${BL.line}` : 'none',
                position: 'relative',
              }}>
                <div style={{
                  width: 4, height: 32, borderRadius: 2,
                  background: DAY_ACCENTS[r.day].hex,
                }} />
                <div style={{ width: 38 }}>
                  <div style={{ fontFamily: MONO, fontSize: 18, fontWeight: 600, lineHeight: 1 }}>
                    {d.getDate()}
                  </div>
                  <div style={{ fontFamily: MONO, fontSize: 9, color: BL.text3, letterSpacing: 0.6 }}>{mo}</div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: SANS, fontSize: 14, fontWeight: 600, marginBottom: 3 }}>
                    Day {r.day} · {DAYS[r.day].title}
                  </div>
                  <div style={{
                    height: 3, background: BL.line, borderRadius: 2, overflow: 'hidden',
                  }}>
                    <div style={{
                      width: `${pct}%`, height: '100%',
                      background: DAY_ACCENTS[r.day].hex, opacity: 0.7,
                    }} />
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 600, color: BL.text }}>
                    {formatK(r.vol)}
                  </div>
                  <div style={{ fontFamily: MONO, fontSize: 9, color: BL.text3 }}>KG · VOL</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StatTile({ label, value, unit, trail }) {
  return (
    <div style={{
      background: BL.card, borderRadius: 16, padding: 14,
      border: `1px solid ${BL.line}`,
    }}>
      <div style={{
        fontFamily: SANS, fontSize: 10, fontWeight: 700, letterSpacing: 1.2,
        textTransform: 'uppercase', color: BL.text3, marginBottom: 6,
      }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span style={{ fontFamily: MONO, fontSize: 28, fontWeight: 600, letterSpacing: -1 }}>
          {value}
        </span>
        <span style={{ fontFamily: MONO, fontSize: 11, color: BL.text2 }}>{unit}</span>
      </div>
      {trail}
    </div>
  );
}

function Sparkline({ data, accent }) {
  const w = 140, h = 34;
  if (!data.length) return <div style={{ height: h + 8 }} />;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1 || 1)) * w;
    const y = h - ((v - min) / range) * h;
    return [x, y];
  });
  const path = points.map((p, i) => (i === 0 ? 'M' : 'L') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  const fill = path + ` L${w},${h} L0,${h} Z`;
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h + 8}`} style={{ display: 'block', marginTop: 6 }}>
      <defs>
        <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={accent} stopOpacity="0.35"/>
          <stop offset="100%" stopColor={accent} stopOpacity="0"/>
        </linearGradient>
      </defs>
      <path d={fill} fill="url(#sg)"/>
      <path d={path} fill="none" stroke={accent} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      {points.map((p, i) => (
        <circle key={i} cx={p[0]} cy={p[1]} r={i === points.length - 1 ? 2.5 : 0} fill={accent} />
      ))}
    </svg>
  );
}

Object.assign(window, { HomeScreen });
