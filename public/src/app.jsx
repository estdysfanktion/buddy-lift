// Buddy Lift — main app orchestration, screen router, all-variants canvas

const { useState, useEffect } = React;

function buildSession(dayId) {
  const day = DAYS[dayId];
  return {
    dayId,
    startedAt: Date.now(),
    elapsed: 0,
    currentExercise: 0,
    exercises: day.exercises.map((ex, i) => ({
      exercise: ex,
      weight: seedWeight(ex),
      rest: 90,
      sets: Array(4).fill(null),
      done: false,
    })),
  };
}

// Pure state transition for "finish current exercise". Single source of
// truth for both live sessions (WorkoutDemo) and the variants canvas —
// previously this branch (mark current exercise done, then either advance
// or complete) was computed once in workout.jsx and re-applied via an
// 'advance' sentinel string in two separate, hand-duplicated reducers.
//
// NOTE (pre-existing behavior, intentionally preserved): on the *last*
// exercise this returns { type: 'complete' } without marking that
// exercise's `done` flag — the session is discarded right after (replaced
// by the summary screen / a fresh session), so it's inert today, but it's
// an inconsistency worth knowing about if `done` is ever read post-completion.
function finishExercise(session) {
  const curIdx = session.currentExercise;
  const isLast = curIdx + 1 >= session.exercises.length;
  if (isLast) return { type: 'complete', session };
  const exercises = session.exercises.map((e, i) => (i === curIdx ? { ...e, done: true } : e));
  return { type: 'advance', session: { ...session, exercises, currentExercise: curIdx + 1 } };
}

function seedWeight(ex) {
  const map = {
    'Dumbbell bench press': 22, 'Incline dumbbell press': 20,
    'Dumbell Floor press': 20, 'Tricep Kickback': 12, 'Dips': 0,
    'Bent-over row': 24, 'Dumbbell row': 24, 'Tripod row': 22,
    'Reverse grip row': 20, 'Biceps Curls': 14, 'Hammer curl': 14, 'Pullover': 18,
    'Arnold press': 16, 'Standing dumbbell press': 18, 'Lateral Raises': 10,
    'Over head press': 18, 'Squats': 24, 'Lunges': 18, 'Calf raises': 16,
  };
  return map[ex] ?? 15;
}

// Pre-fill some sets so the "Active Workout" screen looks mid-session by default
function seedMidSession(session) {
  // Current exercise: first 3 sets filled (hero state)
  session.exercises[0].sets = [10, 10, 9, null];
  session.elapsed = 14 * 60 + 22; // 14:22
  return session;
}

function LockScreen({ onUnlock }) {
  const [pin, setPin] = React.useState('');
  const [error, setError] = React.useState(false);

  const submit = async () => {
    try {
      const res = await fetch('/api/health', { headers: { 'x-app-pin': pin } });
      const data = await res.json();
      if (data.pinOk) {
        localStorage.setItem('bl_pin', pin);
        onUnlock(pin);
      } else {
        setError(true);
        setPin('');
        setTimeout(() => setError(false), 1200);
      }
    } catch {
      setError(true);
    }
  };

  const accent = '#4B9CFF';
  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#0A0B0D',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Inter', system-ui, sans-serif", gap: 24,
    }}>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: 2, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase' }}>Buddy Lift</div>
      <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: -0.6, color: '#fff' }}>Enter PIN</div>
      <input
        type="password" inputMode="numeric" maxLength={8} value={pin}
        onChange={e => setPin(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && submit()}
        autoFocus
        style={{
          width: 160, textAlign: 'center', padding: '14px 16px',
          borderRadius: 14, border: `1.5px solid ${error ? '#FF5F57' : 'rgba(255,255,255,0.1)'}`,
          background: '#17181C', color: '#fff', fontSize: 22, letterSpacing: 6,
          fontFamily: "'JetBrains Mono', monospace", outline: 'none',
          transition: 'border-color .2s',
        }}
        placeholder="••••"
      />
      <button onClick={submit} style={{
        padding: '12px 32px', borderRadius: 12, background: accent,
        color: '#0A0B0D', border: 0, fontSize: 14, fontWeight: 700, cursor: 'pointer',
      }}>Unlock</button>
      {error && <div style={{ color: '#FF5F57', fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>Wrong PIN</div>}
    </div>
  );
}

function App() {
  // All hooks must be at the top — no hooks after conditional returns
  const [pin, setPin] = useState(() => localStorage.getItem('bl_pin') || '');
  const [unlocked, setUnlocked] = useState(false);
  const [tweaks, setTweaks] = useState(() => ({ ...window.TWEAKS }));
  const [editMode, setEditMode] = useState(false);

  useEffect(() => {
    if (!pin) return;
    fetch('/api/health', { headers: { 'x-app-pin': pin } })
      .then(r => r.json())
      .then(d => { if (d.pinOk) setUnlocked(true); else localStorage.removeItem('bl_pin'); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const onMsg = (e) => {
      if (e.data?.type === '__activate_edit_mode') setEditMode(true);
      if (e.data?.type === '__deactivate_edit_mode') setEditMode(false);
    };
    window.addEventListener('message', onMsg);
    try { window.parent.postMessage({ type: '__edit_mode_available' }, '*'); } catch (e) {}
    return () => window.removeEventListener('message', onMsg);
  }, []);

  if (!unlocked) return <LockScreen onUnlock={(p) => { setPin(p); setUnlocked(true); }} />;

  const setTweak = (k, v) => {
    setTweaks(t => {
      const next = { ...t, [k]: v };
      try { window.parent.postMessage({ type: '__edit_mode_set_keys', edits: { [k]: v } }, '*'); } catch (e) {}
      return next;
    });
  };

  return (
    <div className="stage">
      {tweaks.showAllVariants ? (
        <VariantsCanvas dayId={tweaks.dayId} accent={DAY_ACCENTS[tweaks.dayId].hex} />
      ) : (
        <FlowPrototype cardVariant={tweaks.cardVariant} />
      )}
      <TweaksPanel visible={editMode} tweaks={tweaks} setTweak={setTweak} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Live history — fetches from /api/history, falls back to seed
// ─────────────────────────────────────────────────────────────
function useHistory() {
  const [history, setHistory] = useState(HISTORY_SEED);

  useEffect(() => {
    fetch('/api/history', { headers: { 'x-app-pin': localStorage.getItem('bl_pin') || '' } })
      .then(r => r.json())
      .then(data => { if (data.ok && data.rows.length > 0) setHistory(data.rows); })
      .catch(() => {});
  }, []);

  return history;
}

// ─────────────────────────────────────────────────────────────
// Flow prototype — single navigable phone
// ─────────────────────────────────────────────────────────────
const DAY_IDS = [1, 3, 5];

function FlowPrototype({ cardVariant }) {
  const history = useHistory();

  // Manual day override stored in localStorage, falls back to history-derived next day
  const [manualDay, setManualDay] = useState(() => {
    const saved = localStorage.getItem('bl_next_day');
    return saved ? parseInt(saved) : null;
  });

  const autoDayId = nextDayId(history);
  const dayId = manualDay ?? autoDayId;
  const accent = DAY_ACCENTS[dayId].hex;

  const cycleDay = (dir) => {
    const idx = DAY_IDS.indexOf(dayId);
    const next = DAY_IDS[(idx + dir + DAY_IDS.length) % DAY_IDS.length];
    setManualDay(next);
    localStorage.setItem('bl_next_day', String(next));
  };

  const [session, setSession] = useState(() => buildSession(dayId));
  useEffect(() => { setSession(buildSession(dayId)); }, [dayId]);

  useEffect(() => {
    const t = setInterval(() => setSession(s => ({ ...s, elapsed: s.elapsed + 1 })), 1000);
    return () => clearInterval(t);
  }, []);

  // After completing a workout, advance to next day automatically
  const onComplete = () => {
    const idx = DAY_IDS.indexOf(dayId);
    const next = DAY_IDS[(idx + 1) % DAY_IDS.length];
    setManualDay(next);
    localStorage.setItem('bl_next_day', String(next));
  };

  return (
    <PhoneShell accent={accent}>
      <WorkoutDemo
        accent={accent} dayId={dayId} session={session} setSession={setSession}
        cardVariant={cardVariant} history={history}
        onCycleDay={cycleDay} onComplete={onComplete}
      />
    </PhoneShell>
  );
}

function WorkoutDemo({ accent, dayId, session, setSession, cardVariant, history = HISTORY_SEED, onCycleDay, onComplete: onCompleteExternal }) {
  const [tab, setTab] = useState('workout');
  const [restStart, setRestStart] = useState(0); // triggers banner
  const [pickerOpen, setPickerOpen] = useState(false);
  const [completed, setCompleted] = useState(false);

  const updateExercise = (idx, patch) => {
    setSession(s => {
      const exs = [...s.exercises];
      exs[idx] = { ...exs[idx], ...patch };
      return { ...s, exercises: exs };
    });
  };

  const onFinishExercise = () => {
    const result = finishExercise(session);
    if (result.type === 'complete') setCompleted(true);
    else setSession(result.session);
  };

  const onSwap = (newName) => {
    setSession(s => {
      const exs = [...s.exercises];
      exs[s.currentExercise] = { ...exs[s.currentExercise], exercise: newName, weight: seedWeight(newName), sets: Array(4).fill(null) };
      return { ...s, exercises: exs };
    });
    setPickerOpen(false);
  };

  if (completed) {
    return <SummaryScreen accent={accent} dayId={dayId} session={session} onDone={() => { setCompleted(false); onCompleteExternal?.(); }} liveSync={typeof window !== 'undefined' && window.location.protocol !== 'file:'} />;
  }

  return (
    <>
      {tab === 'home' && <HomeScreen accent={accent} dayId={dayId} history={history} onStart={() => setTab('workout')} onCycleDay={onCycleDay} />}
      {tab === 'workout' && (
        <ActiveWorkoutScreen
          accent={accent}
          dayId={dayId}
          session={session}
          onUpdate={updateExercise}
          onFinishExercise={onFinishExercise}
          onPickerOpen={() => setPickerOpen(true)}
          onRestStart={(s) => setRestStart(Date.now() + ':' + s)}
          cardVariant={cardVariant}
          history={history}
        />
      )}
      {tab === 'history' && <HistoryScreen accent={accent} history={history} />}

      {tab === 'workout' && restStart && (
        <RestBanner
          key={restStart}
          seconds={parseInt(String(restStart).split(':')[1])}
          accent={accent}
          onSkip={() => setRestStart(0)}
          onAdd={() => setRestStart(Date.now() + ':' + (parseInt(String(restStart).split(':')[1]) + 30))}
        />
      )}

      {pickerOpen && (
        <ExercisePicker
          accent={accent}
          currentExercise={session.exercises[session.currentExercise].exercise}
          onSwap={onSwap}
          onClose={() => setPickerOpen(false)}
        />
      )}

      <TabBar tab={tab} onTab={setTab} accent={accent} />
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// Variants canvas — show all 3 active-card variants side-by-side
// ─────────────────────────────────────────────────────────────
function VariantsCanvas({ dayId, accent }) {
  const variants = ['bubbles', 'list', 'grid'];
  const [sessions, setSessions] = useState(() =>
    variants.map(() => seedMidSession(buildSession(dayId)))
  );
  useEffect(() => {
    setSessions(variants.map(() => seedMidSession(buildSession(dayId))));
  }, [dayId]);

  const makeUpdater = (vi) => (idx, patch) => {
    setSessions(ss => ss.map((s, si) => {
      if (si !== vi) return s;
      const exs = [...s.exercises];
      exs[idx] = { ...exs[idx], ...patch };
      return { ...s, exercises: exs };
    }));
  };

  const makeFinisher = (vi) => () => {
    setSessions(ss => ss.map((s, si) => {
      if (si !== vi) return s;
      const result = finishExercise(s);
      return result.session;
    }));
  };

  const labels = {
    bubbles: 'A · Bubbles (default)',
    list: 'B · List table',
    grid: 'C · Hero grid',
  };

  return (
    <div className="screens-row">
      {variants.map((v, i) => (
        <div className="screen-cell" key={v}>
          <div className="screen-label">
            <div className="screen-dot" style={{ background: accent }} />
            {labels[v]}
          </div>
          <PhoneShell accent={accent}>
            <ActiveWorkoutScreen
              accent={accent}
              dayId={dayId}
              session={sessions[i]}
              onUpdate={makeUpdater(i)}
              onFinishExercise={makeFinisher(i)}
              onPickerOpen={() => {}}
              onRestStart={() => {}}
              cardVariant={v}
            />
            <TabBar tab="workout" onTab={() => {}} accent={accent} />
          </PhoneShell>
        </div>
      ))}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
