import { liveTasks } from './tasks.js';
import { diffDays } from './dates.js';

/**
 * Goal progress, in order of precedence:
 * 1. Completed goals are 100%.
 * 2. A numeric target (e.g. "save 50,000") uses current / target.
 * 3. Otherwise milestones done / total.
 * 4. Otherwise linked missions completed / total.
 */
export function goalProgress(state, g) {
  const tasks = liveTasks(state).filter((t) => t.goalId === g.id && t.status !== 'skipped');
  const doneTasks = tasks.filter((t) => t.status === 'completed').length;
  const ms = g.milestones || [];
  const msDone = ms.filter((m) => m.done).length;
  let pct = 0, basis = 'none';
  if (g.status === 'completed') { pct = 100; basis = 'completed'; }
  else if (g.numeric && g.numeric.target > 0) { pct = (g.numeric.current / g.numeric.target) * 100; basis = 'numeric'; }
  else if (ms.length) { pct = (msDone / ms.length) * 100; basis = 'milestones'; }
  else if (tasks.length) { pct = (doneTasks / tasks.length) * 100; basis = 'tasks'; }
  return {
    pct: Math.max(0, Math.min(100, Math.round(pct))), basis,
    milestones: ms.length, milestonesDone: msDone, tasks: tasks.length, tasksDone: doneTasks,
  };
}

export const activeGoals = (state) => state.goals.filter((g) => g.status === 'active');

export function goalTimeLeft(g, today) {
  if (!g.targetDate) return null;
  return diffDays(today, g.targetDate);
}
