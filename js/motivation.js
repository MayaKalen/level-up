import { AFFIRMATIONS } from './affirmations.js';
import { THEMES } from './defaults.js';
import { hashStr, fmtMoney, plural } from './util.js';
import { monthOf, fmtMonth } from './dates.js';
import { xpBetween } from './xp.js';
import { streakInfo } from './streaks.js';
import { taskSections, priorityRank, isOpen } from './tasks.js';
import { habitsDueToday, habitMet } from './habits.js';
import { monthSummary, entryOn } from './sales.js';
import { activeGoals, goalProgress } from './goals.js';

const RECENT_WINDOW = 30;

export function allQuotes(state) {
  return [...AFFIRMATIONS, ...(state.motivation.custom || []).map((q) => ({ ...q, theme: 'custom', original: false }))];
}

export const quoteById = (state, id) => allQuotes(state).find((q) => q.id === id) || null;

function candidates(state) {
  const themes = state.settings.themes?.length ? state.settings.themes : THEMES.map((t) => t.id);
  return allQuotes(state).filter((q) => q.theme === 'custom' || themes.includes(q.theme));
}

/** Choose a quote that hasn't been shown recently. Deterministic when `seed` is given. */
export function pickQuote(state, seed, excludeId) {
  const pool = candidates(state);
  const recentIds = state.motivation.history.slice(-RECENT_WINDOW).map((h) => h.id);
  let options = pool.filter((q) => q.id !== excludeId && !recentIds.includes(q.id));
  if (!options.length) options = pool.filter((q) => q.id !== excludeId && !recentIds.slice(-5).includes(q.id));
  if (!options.length) options = pool.filter((q) => q.id !== excludeId);
  if (!options.length) options = pool;
  if (!options.length) return null;
  const n = seed != null ? hashStr(seed) : Math.floor(Math.random() * 1e9);
  return options[n % options.length];
}

const THEME_WHY = {
  discipline: 'Consistency is built one ordinary day at a time.',
  sales: 'Sales results follow the activity you put in today.',
  leadership: 'How you communicate today shapes how people work with you tomorrow.',
  finance: 'Small money decisions add up faster than they seem.',
  health: 'Your energy is the foundation for everything else on your list.',
  learning: 'Short, regular practice beats occasional long sessions.',
  confidence: 'Each kept promise is evidence that you can trust yourself.',
  resilience: 'A hard day is a data point, not a definition.',
  focus: 'Protecting attention is how important work actually gets done.',
  ambition: 'Long-term goals move forward through today’s small steps.',
  custom: 'You saved this one because it means something to you.',
};

/**
 * Personalised message built only from real records. Never claims an
 * achievement the data doesn't confirm.
 */
export function personalise(state, quote, today) {
  const lines = [];
  const xpToday = xpBetween(state.ledger, today, today);
  const target = state.plans[today]?.xpTarget || state.settings.dailyXpTarget;
  const streak = streakInfo(state, today);
  const sec = taskSections(state, today);
  const theme = quote?.theme;

  if (target > 0 && xpToday >= target) {
    lines.push(`You have already reached today’s XP target (${xpToday}/${target} XP). Anything more is a bonus.`);
  } else if (streak.current >= 2) {
    lines.push(streak.todayActive
      ? `You are on a ${streak.current}-day streak, and today already counts.`
      : `You are on a ${streak.current}-day streak. One completed mission or habit today keeps it going.`);
  } else if (streak.longest > 0 && !streak.todayActive && streak.current === 0) {
    lines.push(`Welcome back. Your best streak so far is ${plural(streak.longest, 'day')} — today is a clean start, not a reset of who you are.`);
  } else if (sec.today.length) {
    const done = sec.today.filter((t) => t.status === 'completed').length;
    lines.push(done ? `You have completed ${done} of ${sec.today.length} missions planned for today.` : `You have ${plural(sec.today.length, 'mission')} planned for today.`);
  }

  if (theme === 'sales') {
    const s = monthSummary(state, monthOf(today), today);
    if (s.target) {
      const pctTxt = Math.floor(s.pct);
      lines.push(s.pct >= 100
        ? `You have reached your ${fmtMonth(s.month, 'long')} target — ${fmtMoney(s.revenue, state.settings.currency)} so far.`
        : `You are at ${pctTxt}% of this month’s target with ${plural(s.daysLeft, 'day')} left${s.perDayNeeded ? ` — about ${fmtMoney(s.perDayNeeded, state.settings.currency)} a day closes the gap` : ''}.`);
    }
  } else if (['ambition', 'discipline', 'learning', 'health', 'finance', 'leadership'].includes(theme)) {
    const goals = activeGoals(state).filter((g) => theme === 'ambition' || g.category === themeCategory(theme));
    const g = goals[0];
    if (g) lines.push(`“${g.title}” is ${goalProgress(state, g).pct}% complete.`);
  }

  if (lines.length < 2) lines.push(THEME_WHY[theme] || THEME_WHY.discipline);
  return lines.slice(0, 2).join(' ');
}

function themeCategory(theme) {
  return { learning: 'learning', health: 'health', finance: 'finance', leadership: 'career', discipline: 'personal' }[theme];
}

/** One practical action, preferring real items from the user's data. */
export function practicalAction(state, quote, today) {
  const sec = taskSections(state, today);
  const direct = state.settings.tone === 'direct';
  if (sec.overdue.length) {
    const t = [...sec.overdue].sort((a, b) => priorityRank(b.priority) - priorityRank(a.priority))[0];
    return { text: direct ? `Clear an overdue mission: “${t.title}”.` : `If you have room, gently clear one overdue mission: “${t.title}”.`, taskId: t.id };
  }
  const top = (state.plans[today]?.priorities || []).find(Boolean);
  const topDone = top && sec.today.some((t) => t.title === top && t.status === 'completed');
  if (top && !topDone) return { text: `${direct ? 'Do this next:' : 'Start with your top priority:'} “${top}”.` };
  const open = sec.today.filter(isOpen).sort((a, b) => priorityRank(b.priority) - priorityRank(a.priority));
  if (open.length) {
    const t = open[0];
    return { text: `${direct ? 'Start now:' : 'Start with'} “${t.title}”${t.duration ? ` (${t.duration} min)` : ''}.`, taskId: t.id };
  }
  const habit = habitsDueToday(state, today).find((h) => !habitMet(state, h, today));
  if (habit) return { text: `Log “${habit.name}” before the evening.`, habitId: habit.id };
  const fuGoal = state.settings.dailyFollowUpGoal;
  if (quote?.theme === 'sales' && fuGoal > 0) {
    const done = entryOn(state, today)?.followUps || 0;
    if (done < fuGoal) return { text: `Complete ${fuGoal - done} more follow-ups to reach today’s goal of ${fuGoal}.` };
  }
  return { text: quote?.action || 'Choose one mission that would make today feel worthwhile.' };
}
