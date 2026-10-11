import { addDays, weekStart, diffDays } from './dates.js';
import { dailyTarget } from './habits.js';
import { xpByDay } from './xp.js';

/**
 * Daily activity streak rules
 * - A day is "active" when (completed tasks + habits meeting their target) >= minActions
 *   and, if configured, XP earned that day >= minXp.
 * - Every completion stores its own day key at the moment it happened (in the user's
 *   timezone), so streaks are recomputed from history and never stored as a counter:
 *   refreshing or reopening the app cannot reset or duplicate them, and changing the
 *   timezone later never rewrites past days.
 * - Today still counts as "in progress": an inactive today never breaks the streak.
 * - Optional grace (streak protection): one missed day per calendar week (Mon–Sun) is
 *   forgiven if the day before it was active. Forgiven days don't add to the count.
 */
export function activityMap(state) {
  const m = new Map();
  const bump = (day, n = 1) => m.set(day, (m.get(day) || 0) + n);
  for (const t of state.tasks) if (t.status === 'completed' && t.completedDay) bump(t.completedDay);
  for (const h of state.habits) {
    const logs = state.habitLogs[h.id] || {};
    for (const [day, v] of Object.entries(logs)) if (v >= dailyTarget(h)) bump(day);
  }
  return m;
}

export function streakInfo(state, today) {
  const acts = activityMap(state);
  const xp = xpByDay(state.ledger);
  const { minActions = 1, minXp = 0 } = state.settings.activeDay || {};
  const isActive = (d) => (acts.get(d) || 0) >= Math.max(1, minActions) && (minXp <= 0 || (xp.get(d) || 0) >= minXp);
  const grace = Boolean(state.settings.streakGrace);

  const activeDays = [...acts.keys()].filter(isActive).sort();
  const first = activeDays[0];
  if (!first) {
    return { current: 0, longest: 0, activeDays: 0, missedDays: 0, todayActive: false, isActive, firstDay: null, weekActive: 0, weekElapsed: 0, protectedDays: [] };
  }

  // Current streak, walking backwards.
  let current = 0;
  const usedWeeks = new Set();
  const protectedDays = [];
  let d = isActive(today) ? today : addDays(today, -1);
  while (d >= first) {
    if (isActive(d)) { current++; d = addDays(d, -1); continue; }
    const wk = weekStart(d);
    if (grace && !usedWeeks.has(wk) && isActive(addDays(d, -1)) && current > 0) {
      usedWeeks.add(wk); protectedDays.push(d); d = addDays(d, -1); continue;
    }
    break;
  }

  // Longest streak, walking forwards with the same rules.
  let longest = 0, run = 0;
  const used = new Set();
  for (let x = first; x <= today; x = addDays(x, 1)) {
    if (isActive(x)) { run++; longest = Math.max(longest, run); continue; }
    if (x === today) continue;
    const wk = weekStart(x);
    if (grace && run > 0 && !used.has(wk) && isActive(addDays(x, 1))) { used.add(wk); continue; }
    run = 0;
  }
  longest = Math.max(longest, current);

  const elapsedSinceFirst = diffDays(first, today); // days before today
  const pastActive = activeDays.filter((k) => k < today).length;
  const ws = weekStart(today);
  const weekElapsed = diffDays(ws, today) + 1;
  let weekActive = 0;
  for (let i = 0; i < weekElapsed; i++) if (isActive(addDays(ws, i))) weekActive++;

  return {
    current, longest, activeDays: activeDays.length,
    missedDays: Math.max(0, elapsedSinceFirst - pastActive),
    todayActive: isActive(today), isActive, firstDay: first,
    weekActive, weekElapsed, protectedDays,
  };
}

/** Number of days on which the daily XP target was reached. */
export function xpTargetDays(state) {
  const target = state.settings.dailyXpTarget || 0;
  if (target <= 0) return 0;
  let n = 0;
  for (const [day, v] of xpByDay(state.ledger)) {
    const dayTarget = state.plans[day]?.xpTarget || target;
    if (v >= dayTarget) n++;
  }
  return n;
}
