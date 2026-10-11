import { defaultState, defaultSettings, makeTask, makeHabit, makeGoal, starterTasks, currentDay, STARTER_HABITS, GOAL_EXAMPLES, SCHEMA_VERSION, CUSTOM_COLORS } from './defaults.js';
import { Ledger, levelInfo, lifetimeXp } from './xp.js';
import { nextOccurrence, liveTasks } from './tasks.js';
import { dailyTarget, habitMet } from './habits.js';
import { monthSummary } from './sales.js';
import { monthOf, isDayKey } from './dates.js';
import { achievementProgress } from './achievements.js';
import { pickQuote } from './motivation.js';
import { uid, clamp } from './util.js';

let state = null;
let adapter = null;
let saveError = null;
const listeners = new Set();

export const getState = () => state;
export const getAdapter = () => adapter;
export const getSaveError = () => saveError;
export const today = (now = new Date()) => currentDay(state, now);

export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function emit(events) { for (const fn of listeners) fn(state, events); }

// ---------- Load / migrate ----------

function deepMerge(base, extra) {
  if (!extra || typeof extra !== 'object' || Array.isArray(extra)) return extra ?? base;
  const out = { ...base };
  for (const [k, v] of Object.entries(extra)) {
    out[k] = base && typeof base[k] === 'object' && !Array.isArray(base[k]) && base[k] !== null ? deepMerge(base[k], v) : v;
  }
  return out;
}

export function migrate(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('Not a LEVEL UP data file.');
  const base = defaultState();
  const s = { ...base, ...raw };
  s.settings = deepMerge(defaultSettings(), raw.settings || {});
  s.profile = { ...base.profile, ...(raw.profile || {}) };
  s.motivation = { ...base.motivation, ...(raw.motivation || {}) };
  s.sales = { entries: raw.sales?.entries || [], targets: raw.sales?.targets || {} };
  s.ui = { ...base.ui, ...(raw.ui || {}) };
  for (const k of ['tasks', 'habits', 'goals', 'ledger', 'focus']) if (!Array.isArray(s[k])) s[k] = [];
  for (const k of ['habitLogs', 'achievements', 'plans']) if (!s[k] || typeof s[k] !== 'object') s[k] = {};
  s.version = SCHEMA_VERSION;
  return s;
}

export function init(storageAdapter) {
  adapter = storageAdapter;
  let loadError = null;
  try {
    const raw = adapter.load();
    state = raw ? migrate(raw) : defaultState();
  } catch (e) {
    loadError = e.message;
    adapter.backupCorrupt?.();
    state = defaultState();
  }
  adapter.subscribe(() => {
    // Another tab saved: reload so this tab never overwrites newer data.
    try { const raw = adapter.load(); if (raw) { state = migrate(raw); emit([{ type: 'external' }]); } } catch { /* keep current */ }
  });
  return { loadError };
}

function persist() {
  try { adapter.save(state); saveError = null; } catch (e) { saveError = e.message; }
}

// ---------- Commit pipeline ----------

/**
 * All mutations go through commit(). It clones state, applies the mutator,
 * reconciles derived XP (daily bonus), unlocks achievements, persists, and
 * emits UI events (XP gained, level up, achievement unlocked).
 * Because it is synchronous and every XP award is keyed, rapid double taps
 * cannot produce duplicate rewards.
 */
export function commit(mutator) {
  const now = new Date();
  const next = structuredClone(state);
  const ctx = { now, today: currentDay(next, now), events: [] };
  ctx.L = new Ledger(next, now);
  const xpBefore = lifetimeXp(next.ledger);
  const levelBefore = levelInfo(xpBefore, next.settings.level).level;

  const result = mutator(next, ctx);
  reconcileDailyBonus(next, ctx);
  unlockAchievements(next, ctx);

  const xpAfter = lifetimeXp(next.ledger);
  const levelAfter = levelInfo(xpAfter, next.settings.level).level;
  if (xpAfter !== xpBefore) ctx.events.unshift({ type: 'xp', amount: xpAfter - xpBefore });
  if (levelAfter > levelBefore && levelAfter > (next.ui.lastLevelSeen || 1)) {
    ctx.events.push({ type: 'levelup', level: levelAfter });
    next.ui.lastLevelSeen = levelAfter;
  }

  state = next;
  persist();
  emit(ctx.events);
  return result;
}

function reconcileDailyBonus(s, ctx) {
  const planned = liveTasks(s).filter((t) => t.dueDate === ctx.today && t.status !== 'skipped');
  const min = Math.max(1, s.settings.xp.allDailyMinTasks || 1);
  const allDone = planned.length >= min && planned.every((t) => t.status === 'completed');
  ctx.L.ensure(`bonus:all:${ctx.today}`, allDone, s.settings.xp.allDailyBonus, 'All daily missions complete', ctx.today, 'bonus');
}

function unlockAchievements(s, ctx) {
  for (let pass = 0; pass < 3; pass++) {
    let unlockedAny = false;
    for (const a of achievementProgress(s, ctx.today)) {
      if (a.met && !s.achievements[a.id]) {
        s.achievements[a.id] = { day: ctx.today, ts: ctx.now.toISOString() };
        ctx.L.award(`ach:${a.id}`, a.xp, `Achievement: ${a.name}`, ctx.today, 'achievement');
        ctx.events.push({ type: 'achievement', id: a.id, name: a.name, xp: a.xp });
        unlockedAny = true;
      }
    }
    if (!unlockedAny) break;
  }
}

// ---------- Onboarding ----------

export function finishOnboarding(choices) {
  commit((s, ctx) => {
    const c = choices || {};
    if (c.name) s.profile.name = c.name.slice(0, 40);
    if (c.lifeCategories) s.profile.lifeCategories = c.lifeCategories;
    if (c.themes?.length) s.settings.themes = c.themes;
    if (c.tone) s.settings.tone = c.tone;
    if (c.currency) s.settings.currency = c.currency;
    if (c.dailyXpTarget) s.settings.dailyXpTarget = clamp(Number(c.dailyXpTarget) || 150, 10, 5000);
    if (c.workStart) s.settings.workStart = c.workStart;
    if (c.workEnd) s.settings.workEnd = c.workEnd;
    if (c.theme) s.settings.theme = c.theme;

    for (const key of c.goals || []) {
      const ex = GOAL_EXAMPLES.find((g) => g.key === key);
      if (ex) s.goals.push(makeGoal({ title: ex.title, category: ex.category }, ctx.today));
    }
    s.profile.mainGoals = (c.goals || []).slice();

    const habitKeys = c.habits ?? ['water', 'exercise', 'read'];
    const sample = c.skipped === true;
    for (const key of habitKeys) {
      const h = STARTER_HABITS.find((x) => x.key === key);
      if (h) s.habits.push(makeHabit({ name: h.name, type: h.type, unit: h.unit, target: h.target, category: h.category, icon: h.icon, isSample: sample }, s.settings, ctx.today));
    }
    s.tasks.push(...starterTasks(s.settings, ctx.today));
    s.onboarded = true;
    const q = pickQuote(s, ctx.today + s.profile.name);
    if (q) { s.motivation.current = { day: ctx.today, id: q.id }; s.motivation.history.push({ day: ctx.today, id: q.id }); }
  });
}

// ---------- Tasks ----------

const findTask = (s, id) => s.tasks.find((t) => t.id === id && !t.deletedAt);

export function addTask(fields) {
  return commit((s, ctx) => {
    const t = makeTask(fields, s.settings, ctx.today);
    if (t.repeat.kind !== 'none') t.seriesId = t.id;
    s.tasks.push(t);
    return t.id;
  });
}

export function updateTask(id, fields) {
  commit((s, ctx) => {
    const t = findTask(s, id);
    if (!t) return;
    const { status, ...rest } = fields;
    const repeatChanged = rest.repeat && rest.repeat.kind !== t.repeat.kind;
    Object.assign(t, rest);
    if (t.repeat.kind !== 'none' && !t.seriesId) t.seriesId = t.id;
    if (repeatChanged && t.repeat.kind === 'none') t.seriesId = null;
    if (status && status !== t.status) applyStatus(s, ctx, t, status);
  });
}

function spawnNext(s, ctx, t) {
  if (t.nextSpawned || !t.repeat || t.repeat.kind === 'none') return;
  const due = nextOccurrence(t.repeat, t.dueDate || ctx.today, ctx.today);
  t.nextSpawned = true;
  if (!due) return;
  // Never create two open instances of the same series for the same day.
  if (s.tasks.some((x) => !x.deletedAt && x.seriesId === t.seriesId && x.dueDate === due)) return;
  s.tasks.push({
    ...structuredClone(t), id: uid(), dueDate: due, status: 'not_started', completedAt: null, completedDay: null,
    nextSpawned: false, createdAt: ctx.now.toISOString(), subtasks: t.subtasks.map((st) => ({ ...st, id: uid(), done: false })),
  });
}

function applyStatus(s, ctx, t, status) {
  const prev = t.status;
  if (prev === status) return;
  if (status === 'completed') {
    t.status = 'completed';
    t.completedAt = ctx.now.toISOString();
    t.completedDay = ctx.today;
    ctx.L.award(`task:${t.id}`, t.xp, `Mission: ${t.title}`, ctx.today, 'task');
    spawnNext(s, ctx, t);
  } else {
    if (prev === 'completed') ctx.L.revoke(`task:${t.id}`, `Mission: ${t.title}`);
    t.status = status;
    t.completedAt = null;
    t.completedDay = null;
    if (status === 'skipped') spawnNext(s, ctx, t);
  }
}

export const completeTask = (id) => commit((s, ctx) => { const t = findTask(s, id); if (t && t.status !== 'completed') applyStatus(s, ctx, t, 'completed'); });
export const uncompleteTask = (id) => commit((s, ctx) => { const t = findTask(s, id); if (t) applyStatus(s, ctx, t, 'not_started'); });
export const skipTask = (id) => commit((s, ctx) => { const t = findTask(s, id); if (t) applyStatus(s, ctx, t, 'skipped'); });
export const setTaskStatus = (id, status) => commit((s, ctx) => { const t = findTask(s, id); if (t) applyStatus(s, ctx, t, status); });

export function toggleTask(id) {
  const t = state.tasks.find((x) => x.id === id);
  if (!t) return;
  return t.status === 'completed' ? uncompleteTask(id) : completeTask(id);
}

export function duplicateTask(id) {
  return commit((s, ctx) => {
    const t = findTask(s, id);
    if (!t) return;
    const copy = {
      ...structuredClone(t), id: uid(), title: `${t.title} (copy)`, status: 'not_started', completedAt: null, completedDay: null,
      nextSpawned: false, createdAt: ctx.now.toISOString(), isSample: false, subtasks: t.subtasks.map((st) => ({ ...st, id: uid(), done: false })),
    };
    copy.seriesId = copy.repeat.kind !== 'none' ? copy.id : null;
    s.tasks.push(copy);
    return copy.id;
  });
}

/** Soft delete. XP already earned by a completed task stays in the ledger. */
export function deleteTask(id) {
  commit((s, ctx) => { const t = findTask(s, id); if (t) t.deletedAt = ctx.now.toISOString(); });
}

export function toggleSubtask(taskId, subId) {
  commit((s) => {
    const t = findTask(s, taskId);
    const st = t?.subtasks.find((x) => x.id === subId);
    if (!st) return;
    st.done = !st.done;
    if (st.done && t.status === 'not_started') t.status = 'in_progress';
  });
}

// ---------- Habits ----------

export function addHabit(fields) {
  return commit((s, ctx) => { const h = makeHabit(fields, s.settings, ctx.today); s.habits.push(h); return h.id; });
}

export function updateHabit(id, fields) {
  commit((s, ctx) => {
    const h = s.habits.find((x) => x.id === id);
    if (!h) return;
    Object.assign(h, fields);
    reconcileHabitDay(s, ctx, h, ctx.today);
  });
}

/** Removing a habit hides it; past logs and earned XP remain part of your history. */
export function deleteHabit(id) {
  commit((s) => { const h = s.habits.find((x) => x.id === id); if (h) h.archived = true; });
}

function reconcileHabitDay(s, ctx, h, day) {
  ctx.L.ensure(`habit:${h.id}:${day}`, habitMet(s, h, day), h.xp, `Habit: ${h.name}`, day, 'habit');
}

/** Set a habit's logged value for a day (today or up to 6 days back). */
export function logHabit(id, day, value) {
  commit((s, ctx) => {
    const h = s.habits.find((x) => x.id === id);
    if (!h || !isDayKey(day) || day > ctx.today) return;
    const v = clamp(Math.round(Number(value) || 0), 0, 100000);
    s.habitLogs[id] ||= {};
    if (v > 0) s.habitLogs[id][day] = v; else delete s.habitLogs[id][day];
    reconcileHabitDay(s, ctx, h, day);
  });
}

export function toggleHabit(id, day) {
  const h = state.habits.find((x) => x.id === id);
  if (!h) return;
  const cur = state.habitLogs[id]?.[day] || 0;
  logHabit(id, day, cur >= dailyTarget(h) ? 0 : dailyTarget(h));
}

export function stepHabit(id, day, delta) {
  const cur = state.habitLogs[id]?.[day] || 0;
  logHabit(id, day, Math.max(0, cur + delta));
}

// ---------- Goals ----------

export function addGoal(fields) {
  return commit((s, ctx) => { const g = makeGoal(fields, ctx.today); s.goals.push(g); return g.id; });
}

export function updateGoal(id, fields) {
  commit((s, ctx) => {
    const g = s.goals.find((x) => x.id === id);
    if (!g) return;
    const { status, ...rest } = fields;
    Object.assign(g, rest);
    if (status && status !== g.status) applyGoalStatus(s, ctx, g, status);
  });
}

function applyGoalStatus(s, ctx, g, status) {
  g.status = status;
  if (status === 'completed') {
    g.completedDay = ctx.today;
    ctx.L.award(`goal:${g.id}`, s.settings.xp.goalComplete, `Goal complete: ${g.title}`, ctx.today, 'goal');
  } else {
    g.completedDay = null;
    ctx.L.revoke(`goal:${g.id}`, `Goal complete: ${g.title}`);
  }
}

export const setGoalStatus = (id, status) => commit((s, ctx) => { const g = s.goals.find((x) => x.id === id); if (g) applyGoalStatus(s, ctx, g, status); });

export function deleteGoal(id) {
  commit((s) => {
    s.goals = s.goals.filter((g) => g.id !== id);
    for (const t of s.tasks) if (t.goalId === id) t.goalId = null;
    for (const h of s.habits) if (h.goalId === id) h.goalId = null;
  });
}

export function addMilestone(goalId, title, dueDate = '') {
  commit((s) => {
    const g = s.goals.find((x) => x.id === goalId);
    if (g && title.trim()) g.milestones.push({ id: uid(), title: title.trim().slice(0, 120), done: false, doneDay: null, dueDate });
  });
}

export function toggleMilestone(goalId, msId) {
  commit((s, ctx) => {
    const g = s.goals.find((x) => x.id === goalId);
    const m = g?.milestones.find((x) => x.id === msId);
    if (!m) return;
    m.done = !m.done;
    m.doneDay = m.done ? ctx.today : null;
    ctx.L.ensure(`ms:${m.id}`, m.done, s.settings.xp.milestone, `Milestone: ${m.title}`, ctx.today, 'milestone');
    if (m.done) ctx.events.push({ type: 'milestone', title: m.title });
  });
}

export function deleteMilestone(goalId, msId) {
  commit((s) => { const g = s.goals.find((x) => x.id === goalId); if (g) g.milestones = g.milestones.filter((m) => m.id !== msId); });
}

// ---------- Sales ----------

function reconcileSales(s, ctx, day) {
  const on = s.settings.salesXpEnabled;
  const x = s.settings.xp;
  const entry = s.sales.entries.find((e) => e.day === day);
  const fuGoal = s.settings.dailyFollowUpGoal;
  ctx.L.ensure(`sales:fu:${day}`, on && fuGoal > 0 && (entry?.followUps || 0) >= fuGoal, x.salesFollowups, `Follow-up goal reached (${day})`, day, 'sales');
  const mk = monthOf(day);
  const m = monthSummary(s, mk, ctx.today);
  ctx.L.ensure(`sales:half:${mk}`, on && m.pct != null && m.pct >= 50, x.salesHalf, `50% of ${mk} sales target`, ctx.today, 'sales');
  ctx.L.ensure(`sales:target:${mk}`, on && m.pct != null && m.pct >= 100, x.salesTarget, `${mk} sales target reached`, ctx.today, 'sales');
}

/** One entry per day; saving replaces that day's numbers. */
export function saveSalesEntry(entry) {
  commit((s, ctx) => {
    const clean = {
      day: entry.day,
      amount: Math.max(0, Number(entry.amount) || 0),
      deals: Math.max(0, Math.round(Number(entry.deals) || 0)),
      leads: Math.max(0, Math.round(Number(entry.leads) || 0)),
      followUps: Math.max(0, Math.round(Number(entry.followUps) || 0)),
      meetings: Math.max(0, Math.round(Number(entry.meetings) || 0)),
      note: String(entry.note || '').slice(0, 500),
      updatedAt: ctx.now.toISOString(),
    };
    const i = s.sales.entries.findIndex((e) => e.day === clean.day);
    if (i >= 0) s.sales.entries[i] = { ...s.sales.entries[i], ...clean }; else s.sales.entries.push({ id: uid(), ...clean });
    reconcileSales(s, ctx, clean.day);
  });
}

export function deleteSalesEntry(day) {
  commit((s, ctx) => { s.sales.entries = s.sales.entries.filter((e) => e.day !== day); reconcileSales(s, ctx, day); });
}

export function setSalesTarget(mk, amount) {
  commit((s, ctx) => {
    const v = Math.max(0, Number(amount) || 0);
    if (v > 0) s.sales.targets[mk] = v; else delete s.sales.targets[mk];
    reconcileSales(s, ctx, `${mk}-01`);
  });
}

// ---------- Planning, reflection, focus ----------

export function savePlan(day, plan) {
  commit((s) => {
    const p = s.plans[day] || {};
    s.plans[day] = { ...p, ...plan };
  });
}

export function completeReview(day, review) {
  commit((s, ctx) => {
    const p = s.plans[day] || {};
    s.plans[day] = { ...p, review: { ...review, completedAt: p.review?.completedAt || ctx.now.toISOString() } };
    ctx.L.award(`review:${day}`, s.settings.xp.dailyReview, 'Daily review', day, 'review');
  });
}

export function logFocus({ minutes, planned, taskId }) {
  commit((s, ctx) => {
    const full = minutes >= planned;
    const f = { id: uid(), day: ctx.today, minutes: Math.round(minutes), planned, taskId: taskId || null, full, ts: ctx.now.toISOString() };
    s.focus.push(f);
    if (full) ctx.L.award(`focus:${f.id}`, s.settings.xp.focusSession, `Focus session (${planned} min)`, ctx.today, 'focus');
  });
}

// ---------- Motivation ----------

export function ensureDailyQuote() {
  const d = today();
  if (state.motivation.current?.day === d) return;
  commit((s, ctx) => {
    const q = pickQuote(s, ctx.today + s.profile.name);
    if (!q) return;
    s.motivation.current = { day: ctx.today, id: q.id };
    s.motivation.history.push({ day: ctx.today, id: q.id });
    s.motivation.history = s.motivation.history.slice(-200);
  });
}

export function anotherQuote() {
  commit((s, ctx) => {
    const q = pickQuote(s, null, s.motivation.current?.id);
    if (!q) return;
    s.motivation.current = { day: ctx.today, id: q.id };
    s.motivation.history.push({ day: ctx.today, id: q.id });
    s.motivation.history = s.motivation.history.slice(-200);
  });
}

export function toggleFavorite(id) {
  commit((s) => {
    const f = s.motivation.favorites;
    s.motivation.favorites = f.includes(id) ? f.filter((x) => x !== id) : [...f, id];
  });
}

export function addCustomQuote(text, author) {
  commit((s) => { s.motivation.custom.push({ id: 'c-' + uid(), text: text.slice(0, 300), author: author ? author.slice(0, 80) : null, action: '', question: '' }); });
}

export function deleteCustomQuote(id) {
  commit((s) => {
    s.motivation.custom = s.motivation.custom.filter((q) => q.id !== id);
    s.motivation.favorites = s.motivation.favorites.filter((x) => x !== id);
    if (s.motivation.current?.id === id) s.motivation.current = null;
  });
}

// ---------- Settings & data ----------

export function updateSettings(patch) { commit((s) => { s.settings = deepMerge(s.settings, patch); }); }
export function updateProfile(patch) { commit((s) => { Object.assign(s.profile, patch); }); }

export function addCategory(name) {
  return commit((s) => {
    const list = s.settings.customCategories;
    const id = 'c-' + uid().slice(0, 8);
    list.push({ id, name: name.slice(0, 30), color: CUSTOM_COLORS[list.length % CUSTOM_COLORS.length] });
    return id;
  });
}

export function deleteCategory(id) {
  commit((s) => {
    s.settings.customCategories = s.settings.customCategories.filter((c) => c.id !== id);
    for (const t of s.tasks) if (t.category === id) t.category = 'personal';
    for (const h of s.habits) if (h.category === id) h.category = 'personal';
    for (const g of s.goals) if (g.category === id) g.category = 'personal';
  });
}

export const hasSamples = () => state.tasks.some((t) => t.isSample && !t.deletedAt) || state.habits.some((h) => h.isSample && !h.archived);

/** Remove starter examples that were never used. Completed ones are kept as history. */
export function removeSamples() {
  commit((s, ctx) => {
    for (const t of s.tasks) if (t.isSample && !t.deletedAt && t.status !== 'completed') t.deletedAt = ctx.now.toISOString();
    for (const t of s.tasks) if (t.isSample) t.isSample = false;
    s.habits = s.habits.filter((h) => !(h.isSample && !Object.keys(s.habitLogs[h.id] || {}).length));
    for (const h of s.habits) if (h.isSample) h.isSample = false;
  });
}

export function resetAll() {
  state = defaultState();
  persist();
  emit([{ type: 'reset' }]);
}

export function importState(raw) {
  state = migrate(raw);
  state.onboarded = true;
  persist();
  emit([{ type: 'import' }]);
}

export function setUi(patch) { commit((s) => { Object.assign(s.ui, patch); }); }

export function markLevelSeen(level) { commit((s) => { s.ui.lastLevelSeen = Math.max(s.ui.lastLevelSeen || 1, level); }); }

// Test hook: replace state directly (used by tests.html only).
export function __setState(s, a) { state = s; adapter = a || adapter; }
