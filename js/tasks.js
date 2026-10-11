import { addDays, weekday, diffDays } from './dates.js';
import { PRIORITIES, CATEGORIES } from './defaults.js';

export const liveTasks = (state) => state.tasks.filter((t) => !t.deletedAt);

export function allCategories(state) {
  return [...CATEGORIES, ...(state.settings.customCategories || []).map((c) => ({ ...c, group: 'personal', custom: true }))];
}

export function categoryById(state, id) {
  return allCategories(state).find((c) => c.id === id) || { id, name: 'Uncategorised', color: '#94a3b8', group: 'personal' };
}

const isOpen = (t) => t.status === 'not_started' || t.status === 'in_progress';

/** Does a repeat schedule include this day? */
export function repeatMatches(repeat, key, anchorKey) {
  switch (repeat.kind) {
    case 'daily': return true;
    case 'weekdays': { const w = weekday(key); return w >= 1 && w <= 5; }
    case 'weekly': return weekday(key) === weekday(anchorKey);
    case 'custom': return (repeat.days || []).includes(weekday(key));
    default: return false;
  }
}

/**
 * Next due date for a recurring task after `fromKey`. If the strictly-next
 * occurrence is already in the past (the user fell behind), roll forward to the
 * first occurrence on or after today so we never generate a backlog.
 */
export function nextOccurrence(repeat, fromKey, today) {
  if (!repeat || repeat.kind === 'none') return null;
  if (repeat.kind === 'custom' && !(repeat.days || []).length) return null;
  const anchor = fromKey;
  let k = addDays(fromKey, 1);
  for (let i = 0; i < 14 && !repeatMatches(repeat, k, anchor); i++) k = addDays(k, 1);
  if (k < today) {
    k = today;
    for (let i = 0; i < 14 && !repeatMatches(repeat, k, anchor); i++) k = addDays(k, 1);
  }
  return k;
}

export function taskSections(state, today) {
  const tasks = liveTasks(state);
  return {
    today: tasks.filter((t) => t.dueDate === today && t.status !== 'skipped'),
    overdue: tasks.filter((t) => t.dueDate && t.dueDate < today && isOpen(t)),
    upcoming: tasks.filter((t) => t.dueDate && t.dueDate > today && isOpen(t)),
    anytime: tasks.filter((t) => !t.dueDate && isOpen(t)),
    completed: tasks.filter((t) => t.status === 'completed'),
    skipped: tasks.filter((t) => t.status === 'skipped'),
  };
}

export const priorityRank = (p) => PRIORITIES.find((x) => x.id === p)?.rank ?? 1;

export function sortTasks(tasks, by, state, openFirst = false) {
  const arr = [...tasks];
  const due = (t) => (t.dueDate || '9999-12-31') + (t.dueTime || '99:99');
  const cmp = {
    priority: (a, b) => priorityRank(b.priority) - priorityRank(a.priority) || due(a).localeCompare(due(b)),
    due: (a, b) => due(a).localeCompare(due(b)) || priorityRank(b.priority) - priorityRank(a.priority),
    xp: (a, b) => b.xp - a.xp || due(a).localeCompare(due(b)),
    category: (a, b) => categoryById(state, a.category).name.localeCompare(categoryById(state, b.category).name) || due(a).localeCompare(due(b)),
    completed: (a, b) => (b.completedAt || '').localeCompare(a.completedAt || ''),
  }[by] || ((a, b) => due(a).localeCompare(due(b)));
  // Order stays stable when a mission is completed, so rows never jump under
  // the user's finger. Pass openFirst to list open missions above finished ones.
  return arr.sort((a, b) => (openFirst ? isOpen(b) - isOpen(a) : 0) || cmp(a, b));
}

export function completionsOnDay(state, day) {
  return state.tasks.filter((t) => t.status === 'completed' && t.completedDay === day);
}

export function isOverdue(t, today) {
  return Boolean(t.dueDate) && t.dueDate < today && isOpen(t);
}

export function dueLabel(t, today) {
  if (!t.dueDate) return 'Anytime';
  const d = diffDays(today, t.dueDate);
  if (d < 0 && isOpen(t)) return d === -1 ? 'Overdue · yesterday' : `Overdue · ${-d} days`;
  return null;
}

export { isOpen };
