import { addDays, weekday, weekStart, diffDays } from './dates.js';

export const activeHabits = (state) => state.habits.filter((h) => !h.archived);

export const habitValue = (state, habitId, day) => state.habitLogs[habitId]?.[day] || 0;

/** The per-day target. Avoidance habits are a simple yes/no. */
export const dailyTarget = (h) => (h.type === 'avoid' ? 1 : Math.max(1, Number(h.target) || 1));

export const habitMet = (state, h, day) => habitValue(state, h.id, day) >= dailyTarget(h);

/** Is the habit scheduled on this day? Weekly habits can be done on any day. */
export function scheduledOn(h, day) {
  if (h.freq === 'days') return (h.days || []).includes(weekday(day));
  return true;
}

export function weekCount(state, h, day) {
  const ws = weekStart(day);
  let n = 0;
  for (let i = 0; i < 7; i++) if (habitMet(state, h, addDays(ws, i))) n++;
  return n;
}

const weeklyMet = (state, h, ws) => weekCount(state, h, ws) >= Math.max(1, h.weeklyTarget || 1);

/**
 * Habit streaks. Daily / selected-day habits count consecutive scheduled days;
 * weekly habits count consecutive weeks that hit the weekly target.
 * Today (or this week) still in progress never breaks a streak.
 */
/** First day a habit counts from: its creation day, or an earlier backfilled check-in. */
export function habitStart(state, h) {
  const firstLog = Object.keys(state.habitLogs[h.id] || {}).sort()[0];
  const created = h.createdDay || firstLog;
  return firstLog && firstLog < created ? firstLog : created;
}

export function habitStreak(state, h, today) {
  const s0 = habitStart(state, h);
  const origin = s0 && s0 < today ? s0 : today;

  if (h.freq === 'weekly') {
    const thisWeek = weekStart(today);
    let current = 0;
    let w = weeklyMet(state, h, thisWeek) ? thisWeek : addDays(thisWeek, -7);
    while (w >= weekStart(origin) && weeklyMet(state, h, w)) { current++; w = addDays(w, -7); }
    let longest = 0, run = 0;
    for (let x = weekStart(origin); x <= thisWeek; x = addDays(x, 7)) {
      if (weeklyMet(state, h, x)) { run++; longest = Math.max(longest, run); } else if (x !== thisWeek) run = 0;
    }
    return { current, longest: Math.max(longest, current), unit: 'week' };
  }

  let current = 0;
  let d = habitMet(state, h, today) ? today : addDays(today, -1);
  let guard = 0;
  while (d >= origin && guard++ < 3660) {
    if (scheduledOn(h, d)) {
      if (!habitMet(state, h, d)) break;
      current++;
    }
    d = addDays(d, -1);
  }
  let longest = 0, run = 0;
  for (let x = origin; x <= today; x = addDays(x, 1)) {
    if (!scheduledOn(h, x)) continue;
    if (habitMet(state, h, x)) { run++; longest = Math.max(longest, run); } else if (x !== today) run = 0;
  }
  return { current, longest: Math.max(longest, current), unit: 'day' };
}

/** Share of scheduled habit-days met in [from, to]. Returns null when nothing was scheduled. */
export function habitConsistency(state, from, to) {
  let scheduled = 0, met = 0;
  for (const h of activeHabits(state)) {
    const hs = habitStart(state, h) || from;
    const start = hs > from ? hs : from;
    if (start > to) continue;
    if (h.freq === 'weekly') {
      // Pro-rate the weekly target across the days in range.
      const days = diffDays(start, to) + 1;
      const expected = Math.round(((h.weeklyTarget || 1) * days) / 7);
      let done = 0;
      for (let d = start; d <= to; d = addDays(d, 1)) if (habitMet(state, h, d)) done++;
      scheduled += Math.max(expected, 1); met += Math.min(done, Math.max(expected, 1));
      continue;
    }
    for (let d = start; d <= to; d = addDays(d, 1)) {
      if (!scheduledOn(h, d)) continue;
      scheduled++;
      if (habitMet(state, h, d)) met++;
    }
  }
  return scheduled ? { scheduled, met, rate: met / scheduled } : null;
}

export function habitsDueToday(state, today) {
  return activeHabits(state).filter((h) => {
    if (h.freq === 'weekly') return weekCount(state, h, today) < (h.weeklyTarget || 1) || habitMet(state, h, today);
    return scheduledOn(h, today);
  });
}

/** Number of habits whose target was met on a day. */
export function habitsMetOn(state, day) {
  return state.habits.filter((h) => habitMet(state, h, day)).length;
}
