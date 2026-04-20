// Active Workout — hero screen. Three card layout variants via Tweaks.

function ActiveWorkoutScreen({
  accent, dayId, session, onUpdate, onComplete, onPickerOpen, onRestStart,
  cardVariant = 'bubbles',
}) {
  const day = DAYS[dayId];
  const curIdx = session.currentExercise;
  const cur = session.exercises[curIdx];
  const next = session.exercises[curIdx + 1];
  const totalExercises = session.exercises.length;

  // Total progress: fraction across all exercises
  const completedExercises = session.exercises.filter(e => e.done).length;

  const update = (patch) => onUpdate(curIdx, patch);
  const setReps = (setIdx, reps) => {
    const newSets = [...cur.sets];
    newSets[setIdx] = reps;
    update({ sets: newSets });
    onRestStart(cur.rest || 90);
  };

  const onAddSet = () => {
    if (cur.sets.length >= 8) return;
    update({ sets: [...cur.sets, null] });
  };

  const onFinishExercise = () => {
    const done = [...session.exercises];
    done[curIdx] = { ...done[curIdx], done: true };
    if (curIdx + 1 >= session.exercises.length) {
      onComplete();
    } else {
      onUpdate('advance', done);
    }
  };

  return (
    <div style={{
      height: '100%', overflowY: 'auto', paddingBottom: 140,
      background: BL.bg,
    }}>
      {/* Sticky header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 5, paddingTop: 55,
        background: `linear-gradient(to bottom, ${BL.bg} 70%, ${BL.bg}ee)`,
        backdropFilter: 'blur(10px)',
      }}>
        <div style={{ padding: '0 20px 8px' }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginBottom: 8,
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              fontFamily: MONO, fontSize: 11, color: accent, letterSpacing: 1,
            }}>
              <div style={{ width: 6, height: 6, borderRadius: 3, background: accent, boxShadow: `0 0 8px ${accent}` }} />
              DAY {dayId} · {formatTime(session.elapsed)}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <IconBtn onClick={onPickerOpen} accent={accent}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 3h12M3 7h8M5 11h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
              </IconBtn>
              <IconBtn accent={accent}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.6"/><path d="M7 4v3l2 1.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
              </IconBtn>
            </div>
          </div>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
            marginBottom: 10,
          }}>
            <div style={{ fontFamily: SANS, fontSize: 22, fontWeight: 700, letterSpacing: -0.5 }}>
              {day.title}
            </div>
            <div style={{ fontFamily: MONO, fontSize: 13, color: BL.text2 }}>
              {completedExercises}<span style={{ color: BL.text3 }}>/{totalExercises}</span>
            </div>
          </div>
          {/* progress bar */}
          <div style={{ display: 'flex', gap: 3, marginBottom: 14 }}>
            {session.exercises.map((ex, i) => {
              const filledSets = ex.sets.filter(s => s != null).length;
              const segs = Math.max(ex.sets.length, 1);
              return (
                <div key={i} style={{
                  flex: 1, height: 4, borderRadius: 2, background: BL.line, overflow: 'hidden',
                  display: 'flex', gap: 1,
                }}>
                  {Array.from({ length: segs }).map((_, si) => (
                    <div key={si} style={{
                      flex: 1,
                      background: si < filledSets
                        ? (i === curIdx ? accent : BL.text3)
                        : 'transparent',
                      transition: 'background .2s',
                    }} />
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Current exercise card */}
      <div style={{ padding: '4px 20px 0' }}>
        <ExerciseCard
          ex={cur}
          variant={cardVariant}
          accent={accent}
          isCurrent
          onChange={update}
          onSetReps={setReps}
          onAddSet={onAddSet}
          onFinish={onFinishExercise}
          indexLabel={`${curIdx + 1}/${totalExercises}`}
        />
      </div>

      {/* Peek at next */}
      {next && (
        <div style={{ padding: '16px 20px 0' }}>
          <div style={{
            fontFamily: SANS, fontSize: 10, fontWeight: 700, letterSpacing: 1.4,
            textTransform: 'uppercase', color: BL.text3, marginBottom: 8,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            Up next
            <div style={{ flex: 1, height: 1, background: BL.line }} />
            <span style={{ fontFamily: MONO, color: BL.text3 }}>{curIdx + 2}/{totalExercises}</span>
          </div>
          <NextPeek ex={next} accent={accent} />
        </div>
      )}

      {/* Remaining queue as tiny pills */}
      {session.exercises.length > curIdx + 2 && (
        <div style={{ padding: '12px 20px 0' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {session.exercises.slice(curIdx + 2).map((ex, i) => (
              <div key={i} style={{
                padding: '5px 10px', borderRadius: 7, fontSize: 11,
                background: BL.card, color: BL.text3,
                border: `1px solid ${BL.line}`, fontWeight: 500,
              }}>{ex.exercise}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function IconBtn({ children, onClick, accent }) {
  return (
    <button onClick={onClick} style={{
      width: 32, height: 32, borderRadius: 10,
      background: BL.card, border: `1px solid ${BL.line}`,
      color: BL.text2, cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>{children}</button>
  );
}

// ─────────────────────────────────────────────────────────────
// ExerciseCard — switches on variant
// ─────────────────────────────────────────────────────────────
function ExerciseCard({ ex, variant, accent, isCurrent, onChange, onSetReps, onAddSet, onFinish, indexLabel }) {
  if (variant === 'grid') return <CardGrid {...{ ex, accent, onChange, onSetReps, onAddSet, onFinish, indexLabel }} />;
  if (variant === 'list') return <CardList {...{ ex, accent, onChange, onSetReps, onAddSet, onFinish, indexLabel }} />;
  return <CardBubbles {...{ ex, accent, onChange, onSetReps, onAddSet, onFinish, indexLabel }} />;
}

// Variant A (default) — "bubbles": big weight, set dots w/ rep counts inside
function CardBubbles({ ex, accent, onChange, onSetReps, onAddSet, onFinish, indexLabel }) {
  const [npOpen, setNpOpen] = React.useState(null); // {kind:'weight'|'rest'|'set', setIdx}
  const filled = ex.sets.filter(s => s != null).length;
  const currentSetIdx = ex.sets.findIndex(s => s == null);
  const allSetsLogged = filled === ex.sets.length;

  const volume = ex.weight * ex.sets.reduce((a,b)=> a + (b||0), 0);

  return (
    <>
      <div style={{
        background: BL.card, borderRadius: 20, padding: 18,
        border: `1px solid ${BL.line}`,
        position: 'relative', overflow: 'hidden',
      }}>
        {/* header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
          <div style={{ flex: 1 }}>
            <div style={{
              fontFamily: MONO, fontSize: 10, color: BL.text3, letterSpacing: 1.2,
              marginBottom: 2,
            }}>EXERCISE {indexLabel}</div>
            <div style={{
              fontFamily: SANS, fontSize: 20, fontWeight: 700, letterSpacing: -0.4,
              lineHeight: 1.15,
            }}>{ex.exercise}</div>
          </div>
        </div>

        {/* Weight + Rest side-by-side */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 10, marginBottom: 18 }}>
          <div style={{
            background: BL.bg, borderRadius: 14, padding: '12px 14px',
            border: `1px solid ${BL.line}`,
          }}>
            <div style={{
              fontFamily: SANS, fontSize: 10, fontWeight: 700, letterSpacing: 1.2,
              textTransform: 'uppercase', color: BL.text3, marginBottom: 4,
            }}>Weight</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button onClick={() => onChange({ weight: Math.max(0, ex.weight - 2.5) })} style={nudgeBtn()}>−</button>
              <div onClick={() => setNpOpen({ kind: 'weight' })} style={{
                flex: 1, cursor: 'pointer',
                display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 3,
              }}>
                <span style={{ fontFamily: MONO, fontSize: 28, fontWeight: 600, letterSpacing: -1, color: accent }}>
                  {ex.weight}
                </span>
                <span style={{ fontFamily: MONO, fontSize: 11, color: BL.text2 }}>kg</span>
              </div>
              <button onClick={() => onChange({ weight: ex.weight + 2.5 })} style={nudgeBtn()}>+</button>
            </div>
          </div>

          <div style={{
            background: BL.bg, borderRadius: 14, padding: '12px 14px',
            border: `1px solid ${BL.line}`,
          }}>
            <div style={{
              fontFamily: SANS, fontSize: 10, fontWeight: 700, letterSpacing: 1.2,
              textTransform: 'uppercase', color: BL.text3, marginBottom: 4,
            }}>Rest</div>
            <div onClick={() => setNpOpen({ kind: 'rest' })} style={{
              cursor: 'pointer', textAlign: 'center',
            }}>
              <span style={{ fontFamily: MONO, fontSize: 28, fontWeight: 600, letterSpacing: -1 }}>
                {ex.rest}
              </span>
              <span style={{ fontFamily: MONO, fontSize: 11, color: BL.text2, marginLeft: 3 }}>s</span>
            </div>
          </div>
        </div>

        {/* Set bubbles */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8,
        }}>
          <div style={{
            fontFamily: SANS, fontSize: 10, fontWeight: 700, letterSpacing: 1.2,
            textTransform: 'uppercase', color: BL.text3,
          }}>Sets · reps</div>
          <div style={{ fontFamily: MONO, fontSize: 10, color: BL.text3 }}>
            VOL {volume}kg
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
          {ex.sets.map((reps, i) => {
            const isCurrent = i === currentSetIdx;
            const isDone = reps != null;
            return (
              <div key={i} onClick={() => setNpOpen({ kind: 'set', setIdx: i })} style={{
                width: 58, height: 58, borderRadius: 14,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', position: 'relative',
                background: isDone ? accent : (isCurrent ? `${accent}22` : BL.bg),
                border: isDone ? 'none' : `1px solid ${isCurrent ? accent : BL.line2}`,
                boxShadow: isCurrent && !isDone ? `0 0 0 3px ${accent}22` : 'none',
                transition: 'all .18s',
              }}>
                <div style={{
                  fontFamily: MONO, fontSize: 9,
                  color: isDone ? 'rgba(10,11,13,0.7)' : BL.text3,
                  letterSpacing: 0.6, marginBottom: 1,
                }}>SET {i + 1}</div>
                <div style={{
                  fontFamily: MONO, fontSize: 22, fontWeight: 600, letterSpacing: -0.5,
                  color: isDone ? '#0A0B0D' : (isCurrent ? accent : BL.text2),
                  lineHeight: 1,
                }}>{reps ?? '–'}</div>
              </div>
            );
          })}
          {ex.sets.length < 8 && (
            <button onClick={onAddSet} style={{
              width: 58, height: 58, borderRadius: 14,
              background: 'transparent', color: BL.text3,
              border: `1.5px dashed ${BL.line2}`,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: MONO, fontSize: 22, fontWeight: 300,
            }}>+</button>
          )}
        </div>

        <button onClick={onFinish} disabled={!allSetsLogged} style={{
          width: '100%', padding: '12px 20px', borderRadius: 12,
          background: allSetsLogged ? accent : BL.card2,
          color: allSetsLogged ? '#0A0B0D' : BL.text3,
          border: 0, fontFamily: SANS, fontSize: 14, fontWeight: 700,
          cursor: allSetsLogged ? 'pointer' : 'not-allowed',
          opacity: allSetsLogged ? 1 : 0.5,
          letterSpacing: -0.1,
        }}>
          {allSetsLogged ? 'Finish exercise →' : `Log ${ex.sets.length - filled} more ${ex.sets.length - filled === 1 ? 'set' : 'sets'}`}
        </button>
      </div>

      {npOpen && (
        <NumberPad
          kind={npOpen.kind}
          accent={accent}
          initial={
            npOpen.kind === 'weight' ? ex.weight :
            npOpen.kind === 'rest' ? ex.rest :
            ex.sets[npOpen.setIdx] || 0
          }
          onClose={() => setNpOpen(null)}
          onSubmit={(val) => {
            if (npOpen.kind === 'weight') onChange({ weight: val });
            else if (npOpen.kind === 'rest') onChange({ rest: val });
            else onSetReps(npOpen.setIdx, val);
            setNpOpen(null);
          }}
        />
      )}
    </>
  );
}

// Variant B — compact list (one row per set)
function CardList({ ex, accent, onChange, onSetReps, onAddSet, onFinish, indexLabel }) {
  const [npOpen, setNpOpen] = React.useState(null);
  const filled = ex.sets.filter(s => s != null).length;
  const currentSetIdx = ex.sets.findIndex(s => s == null);
  const allSetsLogged = filled === ex.sets.length;
  const volume = ex.weight * ex.sets.reduce((a,b)=> a + (b||0), 0);

  return (
    <>
      <div style={{
        background: BL.card, borderRadius: 20, padding: 18,
        border: `1px solid ${BL.line}`,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
          <div>
            <div style={{ fontFamily: MONO, fontSize: 10, color: BL.text3, letterSpacing: 1.2, marginBottom: 2 }}>
              EXERCISE {indexLabel}
            </div>
            <div style={{ fontFamily: SANS, fontSize: 20, fontWeight: 700, letterSpacing: -0.4, lineHeight: 1.15 }}>
              {ex.exercise}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div onClick={() => setNpOpen({ kind: 'weight' })} style={{ cursor: 'pointer' }}>
              <span style={{ fontFamily: MONO, fontSize: 32, fontWeight: 600, letterSpacing: -1.2, color: accent }}>
                {ex.weight}
              </span>
              <span style={{ fontFamily: MONO, fontSize: 12, color: BL.text2 }}>kg</span>
            </div>
            <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', marginTop: 2 }}>
              <button onClick={() => onChange({ weight: Math.max(0, ex.weight - 2.5) })} style={miniBtn()}>−2.5</button>
              <button onClick={() => onChange({ weight: ex.weight + 2.5 })} style={miniBtn()}>+2.5</button>
            </div>
          </div>
        </div>

        {/* column headers */}
        <div style={{
          display: 'grid', gridTemplateColumns: '40px 1fr 80px', alignItems: 'center',
          padding: '0 4px 6px', fontFamily: SANS, fontSize: 10, fontWeight: 700,
          color: BL.text3, letterSpacing: 1.2, textTransform: 'uppercase',
          borderBottom: `1px solid ${BL.line}`,
        }}>
          <div>Set</div>
          <div>Reps</div>
          <div style={{ textAlign: 'right' }}>Vol</div>
        </div>

        <div style={{ marginBottom: 10 }}>
          {ex.sets.map((reps, i) => {
            const isCurrent = i === currentSetIdx;
            const isDone = reps != null;
            return (
              <div key={i} onClick={() => setNpOpen({ kind: 'set', setIdx: i })} style={{
                display: 'grid', gridTemplateColumns: '40px 1fr 80px',
                alignItems: 'center', padding: '10px 4px',
                borderBottom: `1px solid ${BL.line}`, cursor: 'pointer',
                background: isCurrent && !isDone ? `${accent}0D` : 'transparent',
                marginLeft: -4, marginRight: -4, paddingLeft: 8, paddingRight: 8,
                borderRadius: isCurrent && !isDone ? 6 : 0,
              }}>
                <div style={{
                  fontFamily: MONO, fontSize: 11, color: BL.text3,
                }}>#{i + 1}</div>
                <div style={{
                  fontFamily: MONO, fontSize: 20, fontWeight: 600, letterSpacing: -0.5,
                  color: isDone ? BL.text : (isCurrent ? accent : BL.text3),
                }}>
                  {isDone ? reps : (isCurrent ? '·' : '–')}
                  <span style={{ fontSize: 11, color: BL.text3, marginLeft: 4 }}>reps</span>
                </div>
                <div style={{
                  textAlign: 'right', fontFamily: MONO, fontSize: 13,
                  color: isDone ? BL.text2 : BL.text3,
                }}>{isDone ? ex.weight * reps : '–'}</div>
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          {ex.sets.length < 8 && (
            <button onClick={onAddSet} style={{
              flex: 1, padding: '10px', borderRadius: 10,
              background: 'transparent', color: BL.text2,
              border: `1px dashed ${BL.line2}`,
              cursor: 'pointer', fontFamily: SANS, fontSize: 12, fontWeight: 600,
            }}>+ Add set</button>
          )}
          <button onClick={() => setNpOpen({ kind: 'rest' })} style={{
            flex: 1, padding: '10px', borderRadius: 10,
            background: BL.bg, color: BL.text2,
            border: `1px solid ${BL.line}`, cursor: 'pointer',
            fontFamily: MONO, fontSize: 12, fontWeight: 500,
          }}>
            REST <span style={{ color: BL.text, fontWeight: 700 }}>{ex.rest}</span>s
          </button>
        </div>

        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '8px 0 12px', fontFamily: MONO, fontSize: 11, color: BL.text3,
        }}>
          <span>TOTAL VOLUME</span>
          <span style={{ color: BL.text, fontSize: 14, fontWeight: 600 }}>{volume} kg</span>
        </div>

        <button onClick={onFinish} disabled={!allSetsLogged} style={{
          width: '100%', padding: '12px 20px', borderRadius: 12,
          background: allSetsLogged ? accent : BL.card2,
          color: allSetsLogged ? '#0A0B0D' : BL.text3,
          border: 0, fontFamily: SANS, fontSize: 14, fontWeight: 700,
          cursor: allSetsLogged ? 'pointer' : 'not-allowed',
          opacity: allSetsLogged ? 1 : 0.5, letterSpacing: -0.1,
        }}>
          {allSetsLogged ? 'Finish exercise →' : `${ex.sets.length - filled} sets remaining`}
        </button>
      </div>
      {npOpen && (
        <NumberPad
          kind={npOpen.kind}
          accent={accent}
          initial={
            npOpen.kind === 'weight' ? ex.weight :
            npOpen.kind === 'rest' ? ex.rest :
            ex.sets[npOpen.setIdx] || 0
          }
          onClose={() => setNpOpen(null)}
          onSubmit={(val) => {
            if (npOpen.kind === 'weight') onChange({ weight: val });
            else if (npOpen.kind === 'rest') onChange({ rest: val });
            else onSetReps(npOpen.setIdx, val);
            setNpOpen(null);
          }}
        />
      )}
    </>
  );
}

// Variant C — big hero number + compact set grid
function CardGrid({ ex, accent, onChange, onSetReps, onAddSet, onFinish, indexLabel }) {
  const [npOpen, setNpOpen] = React.useState(null);
  const filled = ex.sets.filter(s => s != null).length;
  const currentSetIdx = ex.sets.findIndex(s => s == null);
  const allSetsLogged = filled === ex.sets.length;
  const volume = ex.weight * ex.sets.reduce((a,b)=> a + (b||0), 0);

  return (
    <>
      <div style={{
        background: `linear-gradient(160deg, ${accent}11, ${BL.card} 50%)`,
        borderRadius: 20, padding: 18,
        border: `1px solid ${BL.line}`,
      }}>
        <div style={{ fontFamily: MONO, fontSize: 10, color: BL.text3, letterSpacing: 1.2, marginBottom: 2 }}>
          EXERCISE {indexLabel}
        </div>
        <div style={{ fontFamily: SANS, fontSize: 18, fontWeight: 700, letterSpacing: -0.4, marginBottom: 14, lineHeight: 1.2 }}>
          {ex.exercise}
        </div>

        {/* Hero weight */}
        <div onClick={() => setNpOpen({ kind: 'weight' })} style={{
          textAlign: 'center', padding: '10px 0 14px', cursor: 'pointer',
          display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 6,
          borderBottom: `1px solid ${BL.line}`,
        }}>
          <span style={{ fontFamily: MONO, fontSize: 72, fontWeight: 700, letterSpacing: -3.5, color: accent, lineHeight: 1 }}>
            {ex.weight}
          </span>
          <span style={{ fontFamily: MONO, fontSize: 20, fontWeight: 500, color: BL.text2 }}>kg</span>
        </div>
        <div style={{ display: 'flex', gap: 8, margin: '10px 0 16px' }}>
          <button onClick={() => onChange({ weight: Math.max(0, ex.weight - 2.5) })} style={nudgePill()}>−2.5 kg</button>
          <button onClick={() => onChange({ weight: ex.weight + 2.5 })} style={nudgePill()}>+2.5 kg</button>
          <button onClick={() => setNpOpen({ kind: 'rest' })} style={{
            ...nudgePill(), minWidth: 70,
          }}>
            <span style={{ color: BL.text3 }}>rest </span>{ex.rest}s
          </button>
        </div>

        {/* Compact 4-col set grid */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 14,
        }}>
          {ex.sets.map((reps, i) => {
            const isCurrent = i === currentSetIdx;
            const isDone = reps != null;
            return (
              <div key={i} onClick={() => setNpOpen({ kind: 'set', setIdx: i })} style={{
                aspectRatio: '1.1', borderRadius: 10, cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                background: isDone ? accent : (isCurrent ? `${accent}1A` : BL.bg),
                border: isDone ? 'none' : `1px solid ${isCurrent ? accent : BL.line2}`,
                transition: 'all .18s',
              }}>
                <div style={{ fontFamily: MONO, fontSize: 9, color: isDone ? 'rgba(10,11,13,0.6)' : BL.text3, letterSpacing: 0.5 }}>
                  {i + 1}
                </div>
                <div style={{ fontFamily: MONO, fontSize: 19, fontWeight: 600, letterSpacing: -0.5,
                  color: isDone ? '#0A0B0D' : (isCurrent ? accent : BL.text2), lineHeight: 1 }}>
                  {reps ?? '–'}
                </div>
              </div>
            );
          })}
          {ex.sets.length < 8 && (
            <button onClick={onAddSet} style={{
              aspectRatio: '1.1', borderRadius: 10,
              background: 'transparent', color: BL.text3,
              border: `1.5px dashed ${BL.line2}`, cursor: 'pointer',
              fontFamily: MONO, fontSize: 18,
            }}>+</button>
          )}
        </div>

        <div style={{
          display: 'flex', justifyContent: 'space-between', padding: '8px 0 12px',
          fontFamily: MONO, fontSize: 10, color: BL.text3, letterSpacing: 0.8,
          borderTop: `1px solid ${BL.line}`,
        }}>
          <span>SETS {filled}/{ex.sets.length}</span>
          <span>VOLUME <span style={{ color: BL.text }}>{volume}</span> kg</span>
        </div>

        <button onClick={onFinish} disabled={!allSetsLogged} style={{
          width: '100%', padding: '12px 20px', borderRadius: 12,
          background: allSetsLogged ? accent : BL.card2,
          color: allSetsLogged ? '#0A0B0D' : BL.text3,
          border: 0, fontFamily: SANS, fontSize: 14, fontWeight: 700,
          cursor: allSetsLogged ? 'pointer' : 'not-allowed',
          opacity: allSetsLogged ? 1 : 0.5,
        }}>
          {allSetsLogged ? 'Finish exercise →' : `Log ${ex.sets.length - filled} more`}
        </button>
      </div>
      {npOpen && (
        <NumberPad
          kind={npOpen.kind}
          accent={accent}
          initial={
            npOpen.kind === 'weight' ? ex.weight :
            npOpen.kind === 'rest' ? ex.rest :
            ex.sets[npOpen.setIdx] || 0
          }
          onClose={() => setNpOpen(null)}
          onSubmit={(val) => {
            if (npOpen.kind === 'weight') onChange({ weight: val });
            else if (npOpen.kind === 'rest') onChange({ rest: val });
            else onSetReps(npOpen.setIdx, val);
            setNpOpen(null);
          }}
        />
      )}
    </>
  );
}

function NextPeek({ ex, accent }) {
  return (
    <div style={{
      background: BL.card, borderRadius: 14, padding: 14,
      border: `1px solid ${BL.line}`, opacity: 0.85,
      display: 'flex', alignItems: 'center', gap: 14,
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: SANS, fontSize: 14, fontWeight: 600, marginBottom: 3 }}>
          {ex.exercise}
        </div>
        <div style={{ display: 'flex', gap: 12, fontFamily: MONO, fontSize: 11, color: BL.text3 }}>
          <span>{ex.weight}kg</span>
          <span>·</span>
          <span>{ex.sets.length} sets</span>
          <span>·</span>
          <span>{ex.rest}s rest</span>
        </div>
      </div>
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M1 7h12m0 0L8 2m5 5l-5 5" stroke={BL.text3} strokeWidth="1.6" strokeLinecap="round"/>
      </svg>
    </div>
  );
}

function nudgeBtn() {
  return {
    width: 28, height: 28, borderRadius: 8,
    background: BL.card2, color: BL.text, border: `1px solid ${BL.line2}`,
    fontFamily: MONO, fontSize: 16, fontWeight: 500, cursor: 'pointer',
  };
}
function miniBtn() {
  return {
    padding: '4px 8px', borderRadius: 6,
    background: BL.card2, color: BL.text2, border: `1px solid ${BL.line2}`,
    fontFamily: MONO, fontSize: 10, cursor: 'pointer',
  };
}
function nudgePill() {
  return {
    flex: 1, padding: '8px', borderRadius: 10,
    background: BL.bg, color: BL.text, border: `1px solid ${BL.line}`,
    fontFamily: MONO, fontSize: 11, fontWeight: 500, cursor: 'pointer',
  };
}

function formatTime(s) {
  const m = Math.floor(s / 60);
  const ss = s % 60;
  return `${m}:${String(ss).padStart(2, '0')}`;
}

Object.assign(window, { ActiveWorkoutScreen });
