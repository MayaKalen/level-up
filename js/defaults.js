import { detectTimezone, dayKey } from './dates.js';
import { uid } from './util.js';

export const SCHEMA_VERSION = 1;

export const CATEGORIES = [
  { id: 'personal', name: 'Personal Growth', color: '#a78bfa', group: 'personal' },
  { id: 'career', name: 'Career', color: '#60a5fa', group: 'career' },
  { id: 'sales', name: 'Sales', color: '#fbbf24', group: 'sales' },
  { id: 'health', name: 'Health & Fitness', color: '#34d399', group: 'health' },
  { id: 'nutrition', name: 'Nutrition', color: '#a3e635', group: 'health' },
  { id: 'mental', name: 'Mental Wellness', color: '#2dd4bf', group: 'personal' },
  { id: 'learning', name: 'Learning & Skills', color: '#38bdf8', group: 'learning' },
  { id: 'finance', name: 'Finance', color: '#4ade80', group: 'personal' },
  { id: 'relationships', name: 'Relationships', color: '#f472b6', group: 'personal' },
  { id: 'lifestyle', name: 'Lifestyle', color: '#fb923c', group: 'personal' },
];

export const CATEGORY_GROUPS = [
  { id: 'all', name: 'All' }, { id: 'personal', name: 'Personal' }, { id: 'career', name: 'Career' },
  { id: 'health', name: 'Health' }, { id: 'sales', name: 'Sales' }, { id: 'learning', name: 'Learning' },
];

export const CUSTOM_COLORS = ['#c084fc', '#818cf8', '#22d3ee', '#facc15', '#f87171', '#94a3b8'];

export const THEMES = [
  { id: 'discipline', name: 'Discipline & consistency' },
  { id: 'sales', name: 'Sales confidence & resilience' },
  { id: 'leadership', name: 'Communication & leadership' },
  { id: 'finance', name: 'Financial independence' },
  { id: 'health', name: 'Physical health & self-care' },
  { id: 'learning', name: 'Learning & skill development' },
  { id: 'confidence', name: 'Confidence & self-respect' },
  { id: 'resilience', name: 'Emotional resilience' },
  { id: 'focus', name: 'Focus & time management' },
  { id: 'ambition', name: 'Long-term ambition' },
];

export const PRIORITIES = [
  { id: 'low', name: 'Low', rank: 0 }, { id: 'medium', name: 'Medium', rank: 1 },
  { id: 'high', name: 'High', rank: 2 }, { id: 'critical', name: 'Critical', rank: 3 },
];

export const DIFFICULTIES = [
  { id: 'easy', name: 'Easy' }, { id: 'normal', name: 'Normal' },
  { id: 'hard', name: 'Hard' }, { id: 'epic', name: 'Epic' },
];

export const STATUSES = [
  { id: 'not_started', name: 'Not started' }, { id: 'in_progress', name: 'In progress' },
  { id: 'completed', name: 'Completed' }, { id: 'skipped', name: 'Skipped' },
];

export const REPEATS = [
  { id: 'none', name: 'One-time' }, { id: 'daily', name: 'Daily' },
  { id: 'weekdays', name: 'Weekdays' }, { id: 'weekly', name: 'Weekly' }, { id: 'custom', name: 'Custom days' },
];

export const STARTER_HABITS = [
  { key: 'water', name: 'Drink enough water', type: 'build', unit: 'glasses', target: 8, category: 'health', icon: 'droplet' },
  { key: 'exercise', name: 'Exercise or walk', type: 'build', unit: 'minutes', target: 30, category: 'health', icon: 'flame' },
  { key: 'meals', name: 'Eat balanced meals', type: 'build', unit: 'meals', target: 3, category: 'nutrition', icon: 'heart' },
  { key: 'sleep', name: 'Sleep on time', type: 'build', unit: '', target: 1, category: 'health', icon: 'moon' },
  { key: 'read', name: 'Read', type: 'build', unit: 'pages', target: 10, category: 'learning', icon: 'book' },
  { key: 'meditate', name: 'Meditate', type: 'build', unit: 'minutes', target: 10, category: 'mental', icon: 'sparkles' },
  { key: 'journal', name: 'Journal', type: 'build', unit: '', target: 1, category: 'mental', icon: 'pencil' },
  { key: 'skill', name: 'Practice a skill', type: 'build', unit: 'minutes', target: 20, category: 'learning', icon: 'target' },
  { key: 'smoke', name: 'Avoid smoking', type: 'avoid', unit: '', target: 1, category: 'health', icon: 'ban' },
  { key: 'morning', name: 'Morning routine', type: 'build', unit: '', target: 1, category: 'lifestyle', icon: 'sunrise' },
  { key: 'evening', name: 'Evening routine', type: 'build', unit: '', target: 1, category: 'lifestyle', icon: 'moon' },
];

export const GOAL_EXAMPLES = [
  { key: 'comm', title: 'Improve communication skills', category: 'personal' },
  { key: 'sales', title: 'Become better at sales', category: 'sales' },
  { key: 'fitness', title: 'Build a consistent fitness routine', category: 'health' },
  { key: 'finance', title: 'Improve financial discipline', category: 'finance' },
  { key: 'tech', title: 'Learn a new technical skill', category: 'learning' },
  { key: 'side', title: 'Build a side income', category: 'career' },
  { key: 'sleep', title: 'Improve sleep consistency', category: 'health' },
  { key: 'project', title: 'Complete a personal project', category: 'personal' },
];

export function defaultSettings() {
  return {
    theme: 'dark',
    timezone: detectTimezone(),
    dayStartHour: 0,
    currency: 'INR',
    dailyXpTarget: 150,
    workStart: '09:00',
    workEnd: '18:00',
    xp: {
      easy: 10, normal: 25, hard: 50, epic: 100,
      allDailyBonus: 50, allDailyMinTasks: 3,
      habitTarget: 20, goalComplete: 150, milestone: 30,
      dailyReview: 15, focusSession: 10,
      salesFollowups: 20, salesHalf: 100, salesTarget: 250,
    },
    salesXpEnabled: true,
    dailyFollowUpGoal: 10,
    level: { base: 50, step: 50 },
    activeDay: { minActions: 1, minXp: 0 },
    streakGrace: false,
    customCategories: [],
    themes: ['discipline', 'focus', 'confidence'],
    tone: 'balanced',
    showReflection: true,
    reduceMotion: false,
    notifications: false,
  };
}

export function defaultState(now = new Date()) {
  return {
    version: SCHEMA_VERSION,
    onboarded: false,
    createdAt: now.toISOString(),
    profile: { name: 'Adventurer', avatarColor: '#8b5cf6', mainGoals: [], lifeCategories: [] },
    settings: defaultSettings(),
    tasks: [],
    habits: [],
    habitLogs: {},
    goals: [],
    sales: { entries: [], targets: {} },
    ledger: [],
    achievements: {},
    plans: {},
    focus: [],
    motivation: { current: null, history: [], favorites: [], custom: [] },
    ui: { lastLevelSeen: 1 },
  };
}

export function makeTask(fields, settings, today) {
  const difficulty = fields.difficulty || 'normal';
  return {
    id: uid(),
    title: '',
    description: '',
    category: 'personal',
    goalId: null,
    priority: 'medium',
    difficulty,
    xp: settings.xp[difficulty] ?? 25,
    dueDate: today,
    dueTime: '',
    duration: 0,
    repeat: { kind: 'none', days: [] },
    notes: '',
    subtasks: [],
    status: 'not_started',
    createdAt: new Date().toISOString(),
    completedAt: null,
    completedDay: null,
    seriesId: null,
    nextSpawned: false,
    isSample: false,
    deletedAt: null,
    ...fields,
  };
}

export function makeHabit(fields, settings, today) {
  return {
    id: uid(),
    name: '',
    type: 'build',
    freq: 'daily',
    days: [1, 2, 3, 4, 5],
    weeklyTarget: 3,
    unit: '',
    target: 1,
    xp: settings.xp.habitTarget,
    category: 'health',
    goalId: null,
    icon: 'repeat',
    reminder: '',
    notes: '',
    createdDay: today,
    archived: false,
    isSample: false,
    ...fields,
  };
}

export function makeGoal(fields, today) {
  return {
    id: uid(),
    title: '',
    description: '',
    reason: '',
    category: 'personal',
    targetDate: '',
    milestones: [],
    priority: 'medium',
    status: 'active',
    numeric: null,
    createdDay: today,
    completedDay: null,
    ...fields,
  };
}

export function starterTasks(settings, today) {
  const t = (f) => makeTask({ isSample: true, ...f }, settings, today);
  return [
    t({ title: 'Choose your top 3 priorities', category: 'personal', difficulty: 'easy', xp: settings.xp.easy, duration: 5, priority: 'high' }),
    t({ title: 'Send 5 follow-up messages', category: 'sales', difficulty: 'normal', duration: 30, priority: 'high' }),
    t({ title: '30-minute walk', category: 'health', difficulty: 'normal', duration: 30 }),
    t({ title: 'Read 10 pages', category: 'learning', difficulty: 'easy', xp: settings.xp.easy, duration: 15, repeat: { kind: 'daily', days: [] } }),
  ].map((task) => ({ ...task, seriesId: task.repeat.kind !== 'none' ? task.id : null }));
}

export function currentDay(state, now = new Date()) {
  return dayKey(now, state.settings.timezone, state.settings.dayStartHour);
}
