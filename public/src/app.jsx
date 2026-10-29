// Buddy Lift — main app orchestration, screen router, all-variants canvas

const { useState, useEffect, useRef } = React;

function readActiveSession() {
  try {
    return normalizeActiveSession(JSON.parse(localStorage.getItem(ACTIVE_SESSION_KEY)));
  } catch (e) {
    return null;
  }
}

function clearActiveSession() {
  try { localStorage.removeItem(ACTIVE_SESSION_KEY); } catch (e) {}
}

function writeActiveSession(session) {
  localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(serializeActiveSession(session)));
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

// Pre-fill some sets so the "Active Workout" screen looks mid-session by default
function seedMidSession(session) {
  // Current exercise: first 3 sets filled (hero state)
  session.exercises[0].sets = [10, 10, 9, null];
  session.elapsed = 14 * 60 + 22; // 14:22
  return session;
}

function LockScreen({ onUnlock }) {
  const [pin, setPin] = React.useState('');
  const [error, setError] = React.useState('');

  const submit = async () => {
    try {
      const res = await fetch('/api/health', { headers: { 'x-app-pin': pin } });
      const data = await res.json();
      if (data.pinOk) {
        localStorage.setItem('bl_pin', pin);
        onUnlock(pin);
      } else {
        setError('Wrong PIN');
        setPin('');
        setTimeout(() => setError(''), 1200);
      }
    } catch {
      // /api/health unreachable or returned non-JSON (e.g. a Vercel auth
      // wall or offline) — the PIN may well be right, say what actually broke.
      setError("Can't reach server");
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
      {error && <div style={{ color: '#FF5F57', fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>{error}</div>}
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

  // A saved in-progress workout blocks a fresh session from overwriting it
  // until the athlete resumes or discards. Finished-but-unsynced workouts
  // live under bl_pending_sync and are a separate path.
  const [resumeOffer, setResumeOffer] = useState(() => {
    const saved = readActiveSession();
    if (saved && sessionHasProgress(saved)) return saved;
    if (saved) clearActiveSession();
    return null;
  });
  const resumeOfferRef = useRef(resumeOffer);
  resumeOfferRef.current = resumeOffer;

  // Set while the summary is up so a ticking timer cannot rewrite the
  // in-progress save we just cleared.
  const [persistSuspended, setPersistSuspended] = useState(false);
  const persistSuspendedRef = useRef(false);
  persistSuspendedRef.current = persistSuspended;

  const [session, rawSetSession] = useState(() => buildSession(dayId));
  const sessionRef = useRef(session);
  sessionRef.current = session;

  const writeIfProgress = (next) => {
    if (resumeOfferRef.current || persistSuspendedRef.current) return;
    try {
      if (!sessionHasProgress(next)) clearActiveSession();
      else writeActiveSession(next);
    } catch (e) {}
  };
  const writeRef = useRef(writeIfProgress);
  writeRef.current = writeIfProgress;

  // Writes synchronously inside the state updater so a set logged and then
  // immediately backgrounded is already in localStorage before paint.
  const setSession = (update) => {
    rawSetSession(prev => {
      const next = typeof update === 'function' ? update(prev) : update;
      sessionRef.current = next;
      writeIfProgress(next);
      return next;
    });
  };

  // History arriving, or the home-screen day arrows, must not wipe a
  // workout that already has logged work. An untouched session still follows
  // the planned day.
  useEffect(() => {
    if (resumeOffer) return;
    rawSetSession(s => sessionAfterDayChange(s, dayId));
  }, [dayId, resumeOffer]);

  useEffect(() => {
    const tick = () => rawSetSession(s => {
      const elapsed = elapsedSeconds(s.startedAt);
      return elapsed === s.elapsed ? s : { ...s, elapsed };
    });
    tick();
    const id = setInterval(tick, 1000);
    const onFore = () => tick();
    const flush = () => writeRef.current(sessionRef.current);
    const onVis = () => {
      if (document.visibilityState === 'hidden') flush();
      else onFore();
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', onFore);
    window.addEventListener('pageshow', onFore);
    window.addEventListener('pagehide', flush);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', onFore);
      window.removeEventListener('pageshow', onFore);
      window.removeEventListener('pagehide', flush);
    };
  }, []);

  // After completing a workout, advance to the day after the one just
  // logged (not whatever the home arrows were previewing).
  const onComplete = () => {
    const base = DAY_IDS.includes(sessionRef.current?.dayId) ? sessionRef.current.dayId : dayId;
    const idx = DAY_IDS.indexOf(base);
    const next = DAY_IDS[(idx + 1) % DAY_IDS.length];
    const fresh = buildSession(next);
    // Swap the flush target to the fresh day before unsuspending writes,
    // so the finished session cannot be saved again as in-progress.
    sessionRef.current = fresh;
    setManualDay(next);
    localStorage.setItem('bl_next_day', String(next));
    persistSuspendedRef.current = false;
    setPersistSuspended(false);
    rawSetSession(fresh);
  };

  const onResume = () => {
    const saved = resumeOffer;
    if (!saved) return;
    const restored = { ...saved, elapsed: elapsedSeconds(saved.startedAt) };
    // Point the flush ref at the restored session before the gate closes,
    // so a pagehide during this click cannot treat the blank placeholder
    // session as "no progress" and delete the save.
    sessionRef.current = restored;
    resumeOfferRef.current = null;
    setResumeOffer(null);
    rawSetSession(restored);
  };

  const onDiscard = () => {
    const fresh = buildSession(dayId);
    sessionRef.current = fresh;
    clearActiveSession();
    resumeOfferRef.current = null;
    setResumeOffer(null);
    rawSetSession(fresh);
  };

  const onSessionFinished = () => {
    persistSuspendedRef.current = true;
    setPersistSuspended(true);
    clearActiveSession();
  };

  return (
    <PhoneShell accent={accent}>
      <WorkoutDemo
        accent={accent} dayId={dayId} session={session} setSession={setSession}
        cardVariant={cardVariant} history={history}
        onCycleDay={cycleDay} onComplete={onComplete}
        resumeOffer={resumeOffer} onResume={onResume} onDiscard={onDiscard}
        onSessionFinished={onSessionFinished}
      />
    </PhoneShell>
  );
}

function ResumeWorkoutScreen({ saved, onResume, onDiscard }) {
  const day = DAYS[saved.dayId];
  const accent = DAY_ACCENTS[saved.dayId].hex;
  const [elapsed, setElapsed] = useState(() => elapsedSeconds(saved.startedAt));
  useEffect(() => {
    const tick = () => setElapsed(elapsedSeconds(saved.startedAt));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [saved.startedAt]);

  const cur = saved.exercises[saved.currentExercise];
  const loggedHere = cur.sets.filter(s => s != null);
  const totalLogged = saved.exercises.reduce((n, e) => n + e.sets.filter(s => s != null).length, 0);
  const earlier = saved.currentExercise;

  return (
    <div data-testid="resume-screen" style={{
      height: '100%', overflowY: 'auto',
      padding: '20px 20px calc(28px + env(safe-area-inset-bottom, 0px))',
      background: `radial-gradient(120% 60% at 50% -5%, ${DAY_ACCENTS[saved.dayId].soft} 0%, transparent 60%), ${BL.bg}`,
    }}>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 10,
        fontFamily: MONO, fontSize: 11, color: accent, letterSpacing: 1,
      }}>
        <div style={{ width: 6, height: 6, borderRadius: 3, background: accent, boxShadow: `0 0 8px ${accent}` }} />
        IN PROGRESS · <span data-testid="resume-clock">{formatTime(elapsed)}</span>
      </div>
      <div style={{ fontFamily: SANS, fontSize: 34, fontWeight: 700, letterSpacing: -1, marginBottom: 2, lineHeight: 1.1 }}>
        Still going.
      </div>
      <div style={{ fontFamily: SANS, fontSize: 14, color: BL.text2, marginBottom: 24 }}>
        Day {saved.dayId} · {day.title} was interrupted. Resume keeps every logged set.
      </div>

      <div style={{
        background: BL.card, borderRadius: 20, padding: 18, marginBottom: 18,
        border: `1px solid ${accent}33`,
      }}>
        <div style={{
          fontFamily: MONO, fontSize: 10, color: BL.text3, letterSpacing: 1.2, marginBottom: 4,
        }}>
          EXERCISE {saved.currentExercise + 1}/{saved.exercises.length}
        </div>
        <div data-testid="resume-exercise" style={{
          fontFamily: SANS, fontSize: 22, fontWeight: 700, letterSpacing: -0.4, marginBottom: 8,
        }}>{cur.exercise}</div>
        <div style={{ fontFamily: MONO, fontSize: 13, color: BL.text2 }}>
          {cur.weight}kg · rest {cur.rest}s
          {loggedHere.length > 0 ? ` · ${loggedHere.join(' · ')}` : ''}
        </div>
        <div style={{ fontFamily: MONO, fontSize: 11, color: BL.text3, marginTop: 8 }}>
          {totalLogged} set{totalLogged === 1 ? '' : 's'} logged
          {earlier > 0 ? ` · ${earlier} exercise${earlier === 1 ? '' : 's'} already done` : ''}
        </div>
      </div>

      <button data-testid="resume-workout" onClick={onResume} style={{
        width: '100%', padding: '14px', borderRadius: 14,
        background: accent, color: '#0A0B0D', border: 0,
        fontFamily: SANS, fontSize: 15, fontWeight: 700, cursor: 'pointer',
        letterSpacing: -0.2,
      }}>Resume workout</button>
      <button data-testid="discard-workout" onClick={onDiscard} style={{
        width: '100%', padding: '14px', borderRadius: 14, marginTop: 10,
        background: 'transparent', color: BL.text2, border: `1px solid ${BL.line2}`,
        fontFamily: SANS, fontSize: 15, fontWeight: 600, cursor: 'pointer',
      }}>Discard</button>
      <div style={{
        fontFamily: SANS, fontSize: 12, color: BL.text3, textAlign: 'center', marginTop: 10,
      }}>Discard deletes the logged sets and starts this day fresh.</div>
    </div>
  );
}

function WorkoutDemo({ accent, dayId, session, setSession, cardVariant, history = HISTORY_SEED, onCycleDay, onComplete: onCompleteExternal, resumeOffer, onResume, onDiscard, onSessionFinished }) {
  const [tab, setTab] = useState('workout');
  const [restStart, setRestStart] = useState(0); // triggers banner
  const [pickerOpen, setPickerOpen] = useState(false);
  const [completed, setCompleted] = useState(false);

  // A finished session that never fully synced survives in localStorage
  // (written by SummaryScreen). Surface it on launch so it can be retried
  // or explicitly discarded instead of silently vanishing from the log.
  const [pendingRestore, setPendingRestore] = useState(() => {
    try {
      const p = JSON.parse(localStorage.getItem('bl_pending_sync'));
      return p && DAYS[p.dayId] && Array.isArray(p.exercises) ? p : null;
    } catch (e) { return null; }
  });

  const liveAccent = DAY_ACCENTS[session.dayId]?.hex || accent;

  const updateExercise = (idx, patch) => {
    setSession(s => {
      const exs = [...s.exercises];
      exs[idx] = { ...exs[idx], ...patch };
      return { ...s, exercises: exs };
    });
  };

  const onFinishExercise = () => {
    const result = finishExercise(session);
    if (result.type === 'complete') {
      onSessionFinished?.();
      setCompleted(true);
    } else setSession(result.session);
  };

  const onSwap = (newName) => {
    setSession(s => {
      const exs = [...s.exercises];
      exs[s.currentExercise] = { ...exs[s.currentExercise], exercise: newName, weight: seedWeight(newName), sets: Array(4).fill(null) };
      return { ...s, exercises: exs };
    });
    setPickerOpen(false);
  };

  if (pendingRestore && !completed) {
    return (
      <SummaryScreen
        accent={DAY_ACCENTS[pendingRestore.dayId].hex}
        dayId={pendingRestore.dayId}
        session={{
          elapsed: pendingRestore.elapsed || 0,
          exercises: pendingRestore.exercises.map(e => ({
            exercise: e.exercise, weight: e.weight, rest: e.rest, sets: e.sets,
          })),
        }}
        restored
        liveSync
        onDone={() => { localStorage.removeItem('bl_pending_sync'); setPendingRestore(null); }}
      />
    );
  }

  // In-progress restore is offered only when there is no finished workout
  // waiting to sync. Discarding or retrying that summary is unchanged.
  if (resumeOffer && !completed) {
    return <ResumeWorkoutScreen saved={resumeOffer} onResume={onResume} onDiscard={onDiscard} />;
  }

  if (completed) {
    return <SummaryScreen accent={liveAccent} dayId={session.dayId} session={session} onDone={() => { setCompleted(false); onCompleteExternal?.(); }} liveSync={typeof window !== 'undefined' && window.location.protocol !== 'file:'} />;
  }

  return (
    <>
      {tab === 'home' && <HomeScreen accent={accent} dayId={dayId} history={history} onStart={() => setTab('workout')} onCycleDay={onCycleDay} />}
      {tab === 'workout' && (
        <ActiveWorkoutScreen
          accent={liveAccent}
          dayId={session.dayId}
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
          accent={liveAccent}
          onSkip={() => setRestStart(0)}
          onAdd={() => setRestStart(Date.now() + ':' + (parseInt(String(restStart).split(':')[1]) + 30))}
        />
      )}

      {pickerOpen && (
        <ExercisePicker
          accent={liveAccent}
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
