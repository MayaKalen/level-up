import { streakInfo, xpTargetDays } from './streaks.js';
import { habitStreak } from './habits.js';
import { monthSummary, salesMonths } from './sales.js';
import { levelInfo, lifetimeXp } from './xp.js';

// Every achievement is computed from actual records. `metric` returns
// { value, target }; it unlocks when value >= target and is stored once.
export const ACHIEVEMENTS = [
  { id: 'first_mission', name: 'First Mission', desc: 'Complete your first mission.', xp: 25, icon: 'check', metric: (d) => [d.completed, 1] },
  { id: 'getting_started', name: 'Getting Started', desc: 'Complete five missions.', xp: 50, icon: 'list', metric: (d) => [d.completed, 5] },
  { id: 'specialist', name: 'Mission Specialist', desc: 'Complete 25 missions.', xp: 100, icon: 'target', metric: (d) => [d.completed, 25] },
  { id: 'centurion', name: 'Centurion', desc: 'Complete 100 missions.', xp: 250, icon: 'shield', metric: (d) => [d.completed, 100] },
  { id: 'streak_3', name: 'Consistency Builder', desc: 'Reach a 3-day activity streak.', xp: 50, icon: 'flame', metric: (d) => [d.streak.longest, 3] },
  { id: 'streak_14', name: 'Fortnight Focus', desc: 'Reach a 14-day activity streak.', xp: 150, icon: 'flame', metric: (d) => [d.streak.longest, 14] },
  { id: 'week_warrior', name: 'Week Warrior', desc: 'Hit your daily XP target on 7 days.', xp: 100, icon: 'zap', metric: (d) => [d.xpTargetDays, 7] },
  { id: 'habit_builder', name: 'Habit Builder', desc: 'Reach a 7-day streak on any habit.', xp: 75, icon: 'repeat', metric: (d) => [d.bestHabitStreak, 7] },
  { id: 'goal_getter', name: 'Goal Getter', desc: 'Complete your first milestone.', xp: 50, icon: 'flag', metric: (d) => [d.milestones, 1] },
  { id: 'quest_complete', name: 'Quest Complete', desc: 'Complete a goal.', xp: 100, icon: 'trophy', metric: (d) => [d.goalsDone, 1] },
  { id: 'sales_momentum', name: 'Sales Momentum', desc: 'Reach 50% of a monthly sales target.', xp: 75, icon: 'trending', metric: (d) => [Math.floor(d.bestSalesPct), 50] },
  { id: 'target_achieved', name: 'Target Achieved', desc: 'Reach a monthly sales target.', xp: 200, icon: 'trophy', metric: (d) => [Math.floor(d.bestSalesPct), 100] },
  { id: 'level_up', name: 'Level Up', desc: 'Reach character level 2.', xp: 25, icon: 'sparkles', metric: (d) => [d.level, 2] },
  { id: 'rising_star', name: 'Rising Star', desc: 'Reach character level 5.', xp: 100, icon: 'star', metric: (d) => [d.level, 5] },
  { id: 'reflective', name: 'Reflective Mind', desc: 'Complete 3 end-of-day reviews.', xp: 50, icon: 'book', metric: (d) => [d.reviews, 3] },
  { id: 'deep_focus', name: 'Deep Focus', desc: 'Finish 5 full focus sessions.', xp: 50, icon: 'timer', metric: (d) => [d.focusDone, 5] },
];

export function achievementData(state, today) {
  const streak = streakInfo(state, today);
  let bestHabitStreak = 0;
  for (const h of state.habits) bestHabitStreak = Math.max(bestHabitStreak, habitStreak(state, h, today).longest);
  let bestSalesPct = 0;
  for (const mk of salesMonths(state)) {
    const s = monthSummary(state, mk, today);
    if (s.pct != null) bestSalesPct = Math.max(bestSalesPct, s.pct);
  }
  return {
    completed: state.tasks.filter((t) => t.status === 'completed').length,
    streak,
    xpTargetDays: xpTargetDays(state),
    bestHabitStreak,
    milestones: state.goals.reduce((a, g) => a + (g.milestones || []).filter((m) => m.done).length, 0),
    goalsDone: state.goals.filter((g) => g.status === 'completed').length,
    bestSalesPct,
    level: levelInfo(lifetimeXp(state.ledger), state.settings.level).level,
    reviews: Object.values(state.plans).filter((p) => p.review?.completedAt).length,
    focusDone: state.focus.filter((f) => f.full).length,
  };
}

export function achievementProgress(state, today) {
  const d = achievementData(state, today);
  return ACHIEVEMENTS.map((a) => {
    const [value, target] = a.metric(d);
    const unlocked = state.achievements[a.id] || null;
    return { ...a, value: Math.min(value, target), target, met: value >= target, unlocked };
  });
}
