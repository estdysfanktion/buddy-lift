// Buddy Lift — data model mirroring Notion "Simple Workouts"
// Fields per row: Name, Date, Exercise (multi-select), Weight (kg), Rest (s),
// Set 1..8 (reps), Total Volume (Weight * sum of sets)

const DAYS = {
  1: {
    id: 1,
    title: 'Chest & Triceps',
    short: 'Day 1',
    exercises: [
      'Dumbbell bench press',
      'Incline dumbbell press',
      'Dumbell Floor press',
      'Tricep Kickback',
      'Dips',
    ],
  },
  3: {
    id: 3,
    title: 'Back & Biceps',
    short: 'Day 3',
    exercises: [
      'Bent-over row',
      'Dumbbell row',
      'Tripod row',
      'Reverse grip row',
      'Biceps Curls',
      'Hammer curl',
      'Pullover',
    ],
  },
  5: {
    id: 5,
    title: 'Shoulders & Legs',
    short: 'Day 5',
    exercises: [
      'Arnold press',
      'Standing dumbbell press',
      'Lateral Raises',
      'Over head press',
      'Squats',
      'Lunges',
      'Calf raises',
    ],
  },
};

const ALL_EXERCISES = [
  ...DAYS[1].exercises,
  ...DAYS[3].exercises,
  ...DAYS[5].exercises,
];

// Per-day accent colors (oklch). Each day stains chrome + sets.
const DAY_ACCENTS = {
  1: {
    name: 'Electric Blue',
    hex: '#4B9CFF',
    glow: 'rgba(75,156,255,0.28)',
    soft: 'rgba(75,156,255,0.12)',
    oklch: 'oklch(0.72 0.17 250)',
  },
  3: {
    name: 'Acid Lime',
    hex: '#B8FF3C',
    glow: 'rgba(184,255,60,0.28)',
    soft: 'rgba(184,255,60,0.12)',
    oklch: 'oklch(0.93 0.22 125)',
  },
  5: {
    name: 'Warm Amber',
    hex: '#FFB347',
    glow: 'rgba(255,179,71,0.28)',
    soft: 'rgba(255,179,71,0.12)',
    oklch: 'oklch(0.82 0.15 70)',
  },
};

// Seed recent history — ~4 weeks of completed workouts for realism
function seedHistory() {
  const today = new Date('2026-04-20');
  const h = [];
  const mk = (daysAgo, dayId, exercise, weight, sets, rest=90) => {
    const d = new Date(today);
    d.setDate(d.getDate() - daysAgo);
    h.push({
      id: `${dayId}-${exercise}-${daysAgo}`,
      date: d.toISOString().slice(0,10),
      day: dayId,
      name: `${DAYS[dayId].title} – ${exercise}`,
      exercise, weight, rest,
      sets, // array of reps
      volume: weight * sets.reduce((a,b)=>a+b,0),
    });
  };

  // Progressive overload story for a few staple lifts
  // Day 1 sessions: 26, 23, 19, 16, 12, 9, 5, 2 days ago
  const d1 = [26, 23, 19, 16, 12, 9, 5, 2];
  d1.forEach((ago, i) => {
    const w = 18 + i * 0.5; // slow climb
    mk(ago, 1, 'Dumbbell bench press', Math.round(w*2)/2, [10,10,9,8,7]);
    mk(ago, 1, 'Incline dumbbell press', Math.round((w-2)*2)/2, [10,9,8,7]);
    mk(ago, 1, 'Dumbell Floor press', Math.round((w-1)*2)/2, [10,10,9]);
    mk(ago, 1, 'Tricep Kickback', 10 + i*0.25, [12,12,11,10]);
    mk(ago, 1, 'Dips', 0, [12,10,9,8]);
  });
  const d3 = [25, 22, 18, 15, 11, 8, 4];
  d3.forEach((ago, i) => {
    const w = 20 + i * 0.5;
    mk(ago, 3, 'Bent-over row', Math.round(w*2)/2, [10,10,9,8]);
    mk(ago, 3, 'Dumbbell row', Math.round(w*2)/2, [10,10,9]);
    mk(ago, 3, 'Biceps Curls', 12 + i*0.5, [10,10,9,8]);
    mk(ago, 3, 'Hammer curl', 12 + i*0.25, [10,9,8]);
  });
  const d5 = [24, 21, 17, 14, 10, 7, 3];
  d5.forEach((ago, i) => {
    const w = 14 + i * 0.5;
    mk(ago, 5, 'Arnold press', Math.round(w*2)/2, [10,9,8,7]);
    mk(ago, 5, 'Lateral Raises', 8 + i*0.25, [12,12,11,10]);
    mk(ago, 5, 'Squats', 22 + i*0.5, [10,10,9,8]);
  });
  return h;
}

const HISTORY_SEED = seedHistory();

// What's "next"? Rotate Day 1 → Day 3 → Day 5 → Day 1 based on most recent.
function nextDayId(history) {
  if (!history.length) return 1;
  const lastDay = [...history].sort((a,b)=>b.date.localeCompare(a.date))[0].day;
  if (lastDay === 1) return 3;
  if (lastDay === 3) return 5;
  return 1;
}

// Streak = consecutive weeks with ≥2 distinct workout days.
// Current week gets a grace period — if it hasn't hit 2 yet, skip it and check prior weeks.
function computeStreak(history, now = new Date()) {
  if (!history.length) return 0;

  function mondayOf(d) {
    const day = d.getDay();
    const mon = new Date(d);
    mon.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
    mon.setHours(0, 0, 0, 0);
    return mon;
  }

  // Count distinct workout days per week
  const weekMap = {};
  [...new Set(history.map(h => h.date))].forEach(dateStr => {
    const key = mondayOf(new Date(dateStr)).toISOString().slice(0, 10);
    weekMap[key] = (weekMap[key] || 0) + 1;
  });

  const currentMonKey = mondayOf(now).toISOString().slice(0, 10);
  let streak = 0;
  let cursor = mondayOf(now);

  while (true) {
    const key = cursor.toISOString().slice(0, 10);
    const count = weekMap[key] || 0;
    const isCurrent = key === currentMonKey;

    if (isCurrent && count < 2) {
      // grace: current week still in progress, look back further
      cursor.setDate(cursor.getDate() - 7);
      continue;
    }

    if (count >= 2) {
      streak++;
      cursor.setDate(cursor.getDate() - 7);
    } else {
      break;
    }
  }

  return streak;
}

function weekVolume(history, now = new Date()) {
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);
  return history
    .filter(h => new Date(h.date) >= weekAgo)
    .reduce((a,b)=>a+b.volume, 0);
}

function formatK(n) {
  if (n >= 1000) return (n/1000).toFixed(1) + 'k';
  return String(n);
}

Object.assign(window, {
  DAYS, ALL_EXERCISES, DAY_ACCENTS, HISTORY_SEED,
  nextDayId, computeStreak, weekVolume, formatK,
});
