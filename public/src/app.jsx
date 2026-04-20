// Buddy Lift — main app orchestration, screen router, all-variants canvas

const { useState, useEffect, useRef, useMemo } = React;

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

function App() {
  const [tweaks, setTweaks] = useState(() => ({ ...window.TWEAKS }));
  const setTweak = (k, v) => {
    setTweaks(t => {
      const next = { ...t, [k]: v };
      try { window.parent.postMessage({ type: '__edit_mode_set_keys', edits: { [k]: v } }, '*'); } catch (e) {}
      return next;
    });
  };

  const [editMode, setEditMode] = useState(false);
  useEffect(() => {
    const onMsg = (e) => {
      if (e.data?.type === '__activate_edit_mode') setEditMode(true);
      if (e.data?.type === '__deactivate_edit_mode') setEditMode(false);
    };
    window.addEventListener('message', onMsg);
    try { window.parent.postMessage({ type: '__edit_mode_available' }, '*'); } catch (e) {}
    return () => window.removeEventListener('message', onMsg);
  }, []);

  const dayId = tweaks.dayId;
  const accent = DAY_ACCENTS[dayId].hex;

  return (
    <div className="stage">
      {tweaks.showAllVariants ? (
        <VariantsCanvas dayId={dayId} accent={accent} />
      ) : (
        <FlowPrototype cardVariant={tweaks.cardVariant} />
      )}

      <TweaksPanel visible={editMode} tweaks={tweaks} setTweak={setTweak} />
    </div>
  );
}

function TweaksHint() {
  return (
    <div style={{
      position: 'fixed', bottom: 16, right: 16, zIndex: 50,
      padding: '8px 12px', borderRadius: 10,
      background: 'rgba(18,19,23,0.92)', backdropFilter: 'blur(10px)',
      border: '1px solid rgba(255,255,255,0.08)',
      fontFamily: "'JetBrains Mono', monospace", fontSize: 10,
      color: 'rgba(255,255,255,0.5)', letterSpacing: 0.8,
    }}>
      ENABLE TWEAKS FOR VARIANTS ↗
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Live history — fetches from /api/history, falls back to seed
// ─────────────────────────────────────────────────────────────
function useHistory() {
  const [history, setHistory] = useState(HISTORY_SEED);

  useEffect(() => {
    fetch('/api/history')
      .then(r => r.json())
      .then(data => { if (data.ok && data.rows.length > 0) setHistory(data.rows); })
      .catch(() => {});
  }, []);

  return history;
}

// ─────────────────────────────────────────────────────────────
// Flow prototype — single navigable phone
// ─────────────────────────────────────────────────────────────
function FlowPrototype({ cardVariant }) {
  const history = useHistory();
  const dayId = nextDayId(history);
  const accent = DAY_ACCENTS[dayId].hex;

  const [session, setSession] = useState(() => buildSession(dayId));

  useEffect(() => { setSession(buildSession(dayId)); }, [dayId]);

  useEffect(() => {
    const t = setInterval(() => setSession(s => ({ ...s, elapsed: s.elapsed + 1 })), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <PhoneShell accent={accent}>
      <WorkoutDemo
        accent={accent} dayId={dayId} session={session} setSession={setSession}
        cardVariant={cardVariant} history={history}
      />
    </PhoneShell>
  );
}

function PhoneCell({ dayId, label, highlight, children }) {
  return (
    <div className="screen-cell">
      <div className="screen-label">
        <div className="screen-dot" style={{ background: DAY_ACCENTS[dayId].hex }} />
        {label}
        {highlight && <span style={{ color: DAY_ACCENTS[dayId].hex, fontWeight: 700 }}>· HERO</span>}
      </div>
      <div style={{
        padding: highlight ? 8 : 0, borderRadius: highlight ? 60 : 0,
        background: highlight ? `${DAY_ACCENTS[dayId].hex}08` : 'transparent',
        border: highlight ? `1px solid ${DAY_ACCENTS[dayId].hex}22` : 'none',
      }}>
        <PhoneShell accent={DAY_ACCENTS[dayId].hex}>
          {children}
        </PhoneShell>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Each demo is a mini tab-bar'd phone with its default screen
// ─────────────────────────────────────────────────────────────
function HomeDemo({ accent, dayId }) {
  const [tab, setTab] = useState('home');
  const [settingsOpen, setSettingsOpen] = useState(false);
  return (
    <>
      {settingsOpen && typeof SettingsScreen !== 'undefined'
        ? <SettingsScreen accent={accent} onClose={() => setSettingsOpen(false)} />
        : <>
      {tab === 'home' && <HomeScreen accent={accent} dayId={dayId} history={history} onStart={() => setTab('workout')} onSettings={() => setSettingsOpen(true)} />}
      {tab === 'workout' && <MiniMessage text="Tap over on the hero phone →" accent={accent} />}
      {tab === 'history' && <HistoryScreen accent={accent} history={history} />}
        </>}
      <TabBar tab={tab} onTab={setTab} accent={accent} />
    </>
  );
}

function WorkoutDemo({ accent, dayId, session, setSession, cardVariant, history = HISTORY_SEED }) {
  const [tab, setTab] = useState('workout');
  const [restStart, setRestStart] = useState(0); // triggers banner
  const [pickerOpen, setPickerOpen] = useState(false);
  const [completed, setCompleted] = useState(false);

  const updateExercise = (idxOrAdvance, patch) => {
    if (idxOrAdvance === 'advance') {
      setSession(s => ({ ...s, exercises: patch, currentExercise: Math.min(s.currentExercise + 1, s.exercises.length - 1) }));
      return;
    }
    setSession(s => {
      const exs = [...s.exercises];
      exs[idxOrAdvance] = { ...exs[idxOrAdvance], ...patch };
      return { ...s, exercises: exs };
    });
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
    return <SummaryScreen accent={accent} dayId={dayId} session={session} onDone={() => setCompleted(false)} liveSync={typeof window !== 'undefined' && window.location.protocol !== 'file:'} />;
  }

  return (
    <>
      {tab === 'home' && <HomeScreen accent={accent} dayId={dayId} history={history} onStart={() => setTab('workout')} />}
      {tab === 'workout' && (
        <ActiveWorkoutScreen
          accent={accent}
          dayId={dayId}
          session={session}
          onUpdate={updateExercise}
          onComplete={() => setCompleted(true)}
          onPickerOpen={() => setPickerOpen(true)}
          onRestStart={(s) => setRestStart(Date.now() + ':' + s)}
          cardVariant={cardVariant}
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

function SettingsDemo({ accent }) {
  if (typeof SettingsScreen === 'undefined') return <MiniMessage text="Settings loads in the deployed app" accent={accent} />;
  return <SettingsScreen accent={accent} onClose={() => {}} />;
}

function SummaryDemo({ accent, dayId, session }) {
  // synthesize a "completed" version; live sync only when /api exists (deployed)
  const liveSync = typeof window !== 'undefined' && window.location && window.location.protocol !== 'file:';
  const full = {
    ...session,
    exercises: session.exercises.map((ex, i) => ({
      ...ex,
      sets: ex.sets.map((s, si) => s ?? [10, 10, 9, 8, 7][si] ?? null).filter((v, si) => si < ex.sets.length),
    })),
  };
  return <SummaryScreen accent={accent} dayId={dayId} session={full} onDone={() => {}} liveSync={liveSync} />;
}

function HistoryDemo({ accent }) {
  const [tab, setTab] = useState('history');
  return (
    <>
      <HistoryScreen accent={accent} history={history} />
      <TabBar tab={tab} onTab={setTab} accent={accent} />
    </>
  );
}

function PickerDemo({ accent }) {
  // Render faded workout screen as background, with picker open
  return (
    <div style={{ position: 'relative', height: '100%', background: BL.bg }}>
      <div style={{
        padding: '62px 20px 20px', opacity: 0.4, pointerEvents: 'none',
      }}>
        <div style={{ fontFamily: SANS, fontSize: 22, fontWeight: 700, marginBottom: 14 }}>Chest & Triceps</div>
        <div style={{ height: 200, background: BL.card, borderRadius: 16 }} />
      </div>
      <ExercisePicker
        accent={accent}
        currentExercise="Incline dumbbell press"
        onSwap={() => {}}
        onClose={() => {}}
      />
    </div>
  );
}

function NumberPadDemo({ accent }) {
  return (
    <div style={{ position: 'relative', height: '100%', background: BL.bg }}>
      <div style={{
        padding: '62px 20px 20px', opacity: 0.35, pointerEvents: 'none',
      }}>
        <div style={{ fontFamily: SANS, fontSize: 22, fontWeight: 700 }}>Dumbbell bench press</div>
        <div style={{ height: 200, marginTop: 14, background: BL.card, borderRadius: 16 }} />
      </div>
      <NumberPad
        kind="set"
        accent={accent}
        initial={10}
        onClose={() => {}}
        onSubmit={() => {}}
      />
    </div>
  );
}

function MiniMessage({ text, accent }) {
  return (
    <div style={{
      height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 40, textAlign: 'center', color: BL.text3, fontFamily: MONO, fontSize: 12,
    }}>{text}</div>
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
      if (idx === 'advance') return { ...s, exercises: patch, currentExercise: Math.min(s.currentExercise + 1, s.exercises.length - 1) };
      const exs = [...s.exercises];
      exs[idx] = { ...exs[idx], ...patch };
      return { ...s, exercises: exs };
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
              onComplete={() => {}}
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
