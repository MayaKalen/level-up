// Browser-run tests for core logic. Open /tests/ on the local server.
import { levelThreshold, levelInfo, Ledger, lifetimeXp, xpBetween } from '../js/xp.js';
import { dayKey, addDays, range, diffDays, weekStart } from '../js/dates.js';
import { nextOccurrence } from '../js/tasks.js';
import { streakInfo } from '../js/streaks.js';
import { habitStreak } from '../js/habits.js';
import { monthSummary } from '../js/sales.js';
import { goalProgress } from '../js/goals.js';
import { pickQuote } from '../js/motivation.js';
import { defaultState, makeTask, makeHabit, makeGoal } from '../js/defaults.js';
import { memoryAdapter } from '../js/storage.js';
import * as store from '../js/store.js';
import { splitState, joinDocs, docHash, summarize } from '../js/sync-model.js';

const out = document.getElementById('out');
let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; out.insertAdjacentHTML('beforeend', `<li class="pass">✓ ${name}</li>`); }
  catch (e) { failed++; out.insertAdjacentHTML('beforeend', `<li class="fail">✗ ${name}<pre>${e.message}</pre></li>`); console.error(name, e); }
}
function eq(a, b, msg = '') {
  const A = JSON.stringify(a), B = JSON.stringify(b);
  if (A !== B) throw new Error(`${msg} expected ${B}, got ${A}`);
}
const ok = (v, msg) => { if (!v) throw new Error(msg || 'expected truthy'); };

const T = '2026-06-17'; // a Wednesday
const fresh = () => { const s = defaultState(); s.onboarded = true; s.settings.timezone = 'UTC'; return s; };
const withStore = (s) => { store.__setState(s, memoryAdapter); return s; };

// ---------- Levels ----------
test('level thresholds follow 0/100/250/450/700', () => {
  eq([1, 2, 3, 4, 5].map((l) => levelThreshold(l)), [0, 100, 250, 450, 700]);
});
test('levelInfo boundaries', () => {
  eq(levelInfo(99).level, 1); eq(levelInfo(100).level, 2); eq(levelInfo(700).level, 5);
  eq(levelInfo(260).into, 10); eq(levelInfo(260).toNext, 190);
});

// ---------- Ledger ----------
test('ledger awards a key only once', () => {
  const s = fresh(); const L = new Ledger(s, new Date());
  eq(L.award('task:1', 25, 'x', T), 25); eq(L.award('task:1', 25, 'x', T), 0);
  eq(lifetimeXp(s.ledger), 25);
});
test('reversal is dated to the original award day', () => {
  const s = fresh(); const L = new Ledger(s, new Date());
  L.award('task:1', 25, 'x', '2026-06-16');
  L.revoke('task:1', 'x');
  eq(xpBetween(s.ledger, '2026-06-16', '2026-06-16'), 0);
  eq(xpBetween(s.ledger, T, T), 0);
  eq(L.award('task:1', 25, 'x', T), 25, 're-award after revoke');
  eq(lifetimeXp(s.ledger), 25);
});

// ---------- Store: tasks ----------
test('completing twice awards XP once; uncomplete reverses', () => {
  const s = withStore(fresh());
  const id = store.addTask({ title: 'A', difficulty: 'hard', xp: 50 });
  store.completeTask(id); store.completeTask(id);
  const taskXp = () => store.getState().ledger.filter((e) => e.key === `task:${id}`).reduce((a, e) => a + e.amount, 0);
  eq(taskXp(), 50);
  store.uncompleteTask(id); eq(taskXp(), 0);
  store.toggleTask(id); store.toggleTask(id); store.toggleTask(id);
  eq(taskXp(), 50, 'net after toggling');
  ok(s);
});
test('deleting a completed task keeps earned XP; deleting an open one awards nothing', () => {
  withStore(fresh());
  const a = store.addTask({ title: 'A', xp: 10 });
  const b = store.addTask({ title: 'B', xp: 10 });
  store.completeTask(a);
  const before = lifetimeXp(store.getState().ledger);
  store.deleteTask(a); store.deleteTask(b);
  eq(lifetimeXp(store.getState().ledger), before);
  store.completeTask(a);
  eq(lifetimeXp(store.getState().ledger), before, 'deleted task cannot be completed');
});
test('recurring task spawns the next instance exactly once', () => {
  withStore(fresh());
  const today = store.today();
  const id = store.addTask({ title: 'Daily', repeat: { kind: 'daily', days: [] }, dueDate: today });
  store.completeTask(id); store.uncompleteTask(id); store.completeTask(id);
  const series = store.getState().tasks.filter((t) => t.title === 'Daily');
  eq(series.length, 2);
  eq(series[1].dueDate, addDays(today, 1));
  eq(series[1].status, 'not_started');
});
test('skipping a recurring task schedules the next and awards nothing', () => {
  withStore(fresh());
  const today = store.today();
  const id = store.addTask({ title: 'W', repeat: { kind: 'weekly', days: [] }, dueDate: today, xp: 25 });
  store.skipTask(id);
  const s = store.getState();
  eq(s.tasks.filter((t) => t.title === 'W').map((t) => t.dueDate), [today, addDays(today, 7)]);
  eq(s.ledger.filter((e) => e.key.startsWith('task:')).length, 0);
});
test('all-daily-missions bonus is awarded once and reversed when a mission reopens', () => {
  withStore(fresh());
  const ids = ['a', 'b', 'c'].map((t) => store.addTask({ title: t, xp: 10 }));
  ids.forEach((i) => store.completeTask(i));
  const bonusNet = () => store.getState().ledger.filter((e) => e.key.startsWith('bonus:all')).reduce((a, e) => a + e.amount, 0);
  eq(bonusNet(), 50);
  store.completeTask(ids[0]); eq(bonusNet(), 50);
  store.uncompleteTask(ids[1]); eq(bonusNet(), 0);
  store.completeTask(ids[1]); eq(bonusNet(), 50);
});
test('achievement unlocks once and is not re-awarded', () => {
  withStore(fresh());
  const id = store.addTask({ title: 'x', xp: 10 });
  store.completeTask(id); store.uncompleteTask(id); store.completeTask(id);
  const s = store.getState();
  ok(s.achievements.first_mission, 'unlocked');
  eq(s.ledger.filter((e) => e.key === 'ach:first_mission').length, 1);
  ok(!s.achievements.getting_started, 'five-task achievement still locked');
});

// ---------- Recurrence ----------
test('nextOccurrence: daily, weekdays, weekly, custom', () => {
  eq(nextOccurrence({ kind: 'daily' }, T, T), '2026-06-18');
  eq(nextOccurrence({ kind: 'weekdays' }, '2026-06-19', '2026-06-19'), '2026-06-22'); // Fri → Mon
  eq(nextOccurrence({ kind: 'weekly' }, T, T), '2026-06-24');
  eq(nextOccurrence({ kind: 'custom', days: [1, 4] }, T, T), '2026-06-18'); // Wed → Thu
  eq(nextOccurrence({ kind: 'none' }, T, T), null);
});
test('nextOccurrence rolls forward instead of creating a backlog', () => {
  eq(nextOccurrence({ kind: 'daily' }, '2026-06-01', T), T);
  eq(nextOccurrence({ kind: 'weekly' }, '2026-06-01', T), '2026-06-22'); // Mondays
});

// ---------- Dates & timezones ----------
test('dayKey respects timezone', () => {
  const instant = new Date('2026-06-17T20:00:00Z');
  eq(dayKey(instant, 'UTC'), '2026-06-17');
  eq(dayKey(instant, 'Asia/Kolkata'), '2026-06-18'); // 01:30 IST
  eq(dayKey(instant, 'America/Los_Angeles'), '2026-06-17');
});
test('dayStartHour counts late-night activity toward the previous day', () => {
  const lateNight = new Date('2026-06-17T20:00:00Z'); // 01:30 in Kolkata
  eq(dayKey(lateNight, 'Asia/Kolkata', 3), '2026-06-17');
  eq(dayKey(lateNight, 'Asia/Kolkata', 0), '2026-06-18');
});
test('day arithmetic is DST-safe', () => {
  eq(range('2026-03-07', '2026-03-10').length, 4); // US DST start
  eq(addDays('2026-10-31', 2), '2026-11-02'); // US DST end
  eq(diffDays('2026-03-01', '2026-04-01'), 31);
  eq(dayKey(new Date('2026-03-08T07:30:00Z'), 'America/New_York'), '2026-03-08'); // 03:30 EDT
  eq(weekStart('2026-06-21'), '2026-06-15'); // Sunday → Monday
});

// ---------- Streaks ----------
function stateWithActiveDays(days) {
  const s = fresh();
  for (const d of days) s.tasks.push(makeTask({ title: d, status: 'completed', completedDay: d, completedAt: d + 'T10:00:00Z' }, s.settings, d));
  return s;
}
test('streak counts consecutive active days and today in progress does not break it', () => {
  const s = stateWithActiveDays([addDays(T, -3), addDays(T, -2), addDays(T, -1)]);
  const st = streakInfo(s, T);
  eq([st.current, st.longest, st.todayActive], [3, 3, false]);
});
test('streak includes today once today is active', () => {
  const s = stateWithActiveDays([addDays(T, -1), T]);
  eq(streakInfo(s, T).current, 2);
});
test('a missed day breaks the streak; history keeps the longest', () => {
  const s = stateWithActiveDays([addDays(T, -6), addDays(T, -5), addDays(T, -4), addDays(T, -2), addDays(T, -1)]);
  const st = streakInfo(s, T);
  eq([st.current, st.longest, st.missedDays], [2, 3, 1]);
});
test('missing yesterday and today means streak is 0 (but longest kept)', () => {
  const s = stateWithActiveDays([addDays(T, -4), addDays(T, -3)]);
  eq([streakInfo(s, T).current, streakInfo(s, T).longest], [0, 2]);
});
test('streak protection forgives one missed day per week', () => {
  const s = stateWithActiveDays([addDays(T, -3), addDays(T, -1)]); // gap on T-2
  eq(streakInfo(s, T).current, 1);
  s.settings.streakGrace = true;
  eq(streakInfo(s, T).current, 2);
});
test('streak is recomputed from history, so repeated calls never change it', () => {
  const s = stateWithActiveDays([addDays(T, -1), T]);
  eq([streakInfo(s, T).current, streakInfo(s, T).current], [2, 2]);
});
test('minimum actions rule', () => {
  const s = stateWithActiveDays([addDays(T, -1), T]);
  s.settings.activeDay.minActions = 2;
  eq(streakInfo(s, T).current, 0);
});

// ---------- Habits ----------
test('daily habit streak across days, unaffected by an unlogged today', () => {
  const s = fresh();
  const h = makeHabit({ name: 'Water', target: 8, createdDay: addDays(T, -10) }, s.settings, T);
  s.habits.push(h);
  s.habitLogs[h.id] = { [addDays(T, -2)]: 8, [addDays(T, -1)]: 9, [addDays(T, -3)]: 3 };
  eq(habitStreak(s, h, T), { current: 2, longest: 2, unit: 'day' });
});
test('selected-days habit skips rest days', () => {
  const s = fresh();
  // Mon/Wed/Fri habit; T is Wednesday 2026-06-17.
  const h = makeHabit({ name: 'Gym', freq: 'days', days: [1, 3, 5], createdDay: '2026-06-01' }, s.settings, T);
  s.habits.push(h);
  s.habitLogs[h.id] = { '2026-06-12': 1, '2026-06-15': 1, '2026-06-17': 1 }; // Fri, Mon, Wed
  eq(habitStreak(s, h, T).current, 3);
});
test('weekly habit counts weeks meeting the target', () => {
  const s = fresh();
  const h = makeHabit({ name: 'Run', freq: 'weekly', weeklyTarget: 2, createdDay: '2026-06-01' }, s.settings, T);
  s.habits.push(h);
  s.habitLogs[h.id] = { '2026-06-02': 1, '2026-06-04': 1, '2026-06-09': 1, '2026-06-11': 1, '2026-06-16': 1 };
  eq(habitStreak(s, h, T).current, 2); // this week (1/2) still in progress
});
test('habit logging awards once per day and reverses when undone', () => {
  withStore(fresh());
  const id = store.addHabit({ name: 'Water', target: 3, xp: 20 });
  const d = store.today();
  store.stepHabit(id, d, 1); store.stepHabit(id, d, 1);
  const net = () => store.getState().ledger.filter((e) => e.key === `habit:${id}:${d}`).reduce((a, e) => a + e.amount, 0);
  eq(net(), 0);
  store.stepHabit(id, d, 1); store.stepHabit(id, d, 1);
  eq(net(), 20);
  store.toggleHabit(id, d);
  eq(net(), 0);
  store.logHabit(id, addDays(d, 1), 3);
  ok(!store.getState().habitLogs[id]?.[addDays(d, 1)], 'future logs are rejected');
});

// ---------- Goals ----------
test('goal progress from milestones and numeric target', () => {
  const s = fresh();
  const g = makeGoal({ title: 'G', milestones: [{ id: 'a', done: true }, { id: 'b', done: false }] }, T);
  eq(goalProgress(s, g).pct, 50);
  g.numeric = { target: 200, current: 50, unit: '' };
  eq(goalProgress(s, g).pct, 25);
  g.status = 'completed';
  eq(goalProgress(s, g).pct, 100);
});

// ---------- Sales ----------
test('sales summary keeps metrics separate and never fabricates ratios', () => {
  const s = fresh();
  s.sales.entries.push({ day: '2026-06-02', amount: 5000, deals: 0, leads: 0, followUps: 4, meetings: 1 });
  let m = monthSummary(s, '2026-06', T);
  eq([m.revenue, m.conversion, m.avgDeal, m.target, m.pct], [5000, null, null, null, null]);
  s.sales.entries.push({ day: '2026-06-03', amount: 15000, deals: 2, leads: 10, followUps: 0, meetings: 0 });
  s.sales.targets['2026-06'] = 40000;
  m = monthSummary(s, '2026-06', T);
  eq([m.revenue, m.conversion, m.avgDeal, m.pct, m.remaining], [20000, 0.2, 10000, 50, 20000]);
});
test('sales XP milestones awarded once and reversed if entries drop', () => {
  withStore(fresh());
  const d = store.today();
  const mk = d.slice(0, 7);
  store.setSalesTarget(mk, 1000);
  store.saveSalesEntry({ day: d, amount: 600, followUps: 10 });
  store.saveSalesEntry({ day: d, amount: 600, followUps: 10 });
  const net = (k) => store.getState().ledger.filter((e) => e.key === k).reduce((a, e) => a + e.amount, 0);
  eq([net(`sales:half:${mk}`), net(`sales:target:${mk}`), net(`sales:fu:${d}`)], [100, 0, 20]);
  store.saveSalesEntry({ day: d, amount: 100, followUps: 2 });
  eq([net(`sales:half:${mk}`), net(`sales:fu:${d}`)], [0, 0]);
  eq(store.getState().tasks.length, 0, 'sales never create task completions');
});

// ---------- Motivation ----------
test('quote picker avoids recently shown quotes and the excluded one', () => {
  const s = fresh();
  const first = pickQuote(s, 'seed-1');
  s.motivation.history.push({ day: T, id: first.id });
  for (let i = 0; i < 20; i++) {
    const q = pickQuote(s, null, first.id);
    ok(q.id !== first.id, 'should not repeat the current quote');
  }
  eq(pickQuote(s, 'same-seed').id, pickQuote(s, 'same-seed').id, 'deterministic with seed');
});

// ---------- Sync model ----------
function richState() {
  withStore(fresh());
  const today = store.today();
  const a = store.addTask({ title: 'A', xp: 10 });
  store.addTask({ title: 'B', repeat: { kind: 'daily', days: [] }, dueDate: today });
  store.completeTask(a);
  const h = store.addHabit({ name: 'Water', target: 2 });
  store.logHabit(h, today, 2);
  store.logHabit(h, addDays(today, -40), 1);
  store.savePlan(today, { priorities: ['x', '', ''], xpTarget: 120 });
  store.saveSalesEntry({ day: today, amount: 500, deals: 1, leads: 3 });
  store.setSalesTarget(today.slice(0, 7), 1000);
  const g = store.addGoal({ title: 'G' });
  store.addMilestone(g, 'M1');
  const s = store.getState();
  // An old task from a previous month, to exercise multiple month documents.
  s.tasks.push({ ...s.tasks[0], id: 'old', title: 'Old', createdAt: '2025-01-15T10:00:00.000Z' });
  return s;
}
test('splitState → joinDocs round-trips all data', () => {
  const s = richState();
  const back = store.migrate(joinDocs(splitState(s)));
  // Compare content regardless of object-key or array order.
  const canon = (v) => (Array.isArray(v) ? v.map(canon) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])])) : v);
  const norm = (x) => JSON.stringify(canon({ ...x, tasks: [...x.tasks].sort((a, b) => a.id.localeCompare(b.id)), ledger: [...x.ledger].sort((a, b) => a.id.localeCompare(b.id)) }));
  eq(norm(back), norm(store.migrate(JSON.parse(JSON.stringify(s)))));
});
test('history is split into one document per month plus core', () => {
  const docs = splitState(richState());
  ok(docs.core && !docs.core.tasks && !docs.core.ledger, 'core has no history arrays');
  const months = Object.keys(docs).filter((k) => k.startsWith('m-')).sort();
  ok(months.includes('m-2025-01'), 'old task lands in its own month');
  ok(months.length >= 3, `expected several month docs, got ${months}`);
  ok(Object.values(docs).every((d) => JSON.stringify(d).length < 900000), 'each doc under the Firestore size limit');
});
test('doc hashes are stable and change with content', () => {
  const docs = splitState(richState());
  eq(docHash(docs.core), docHash(JSON.parse(JSON.stringify(docs.core))));
  const changed = { ...docs.core, profile: { ...docs.core.profile, name: 'Other' } };
  ok(docHash(changed) !== docHash(docs.core));
});
test('summary treats a fresh or samples-only state as empty', () => {
  ok(summarize(fresh()).empty === true || summarize(fresh()).missions === 0);
  ok(!summarize(richState()).empty, 'state with XP is not empty');
});

document.getElementById('summary').innerHTML = failed ? `<span class="fail">${failed} failed</span>, ${passed} passed` : `<span class="pass">All ${passed} tests passed</span>`;
window.__testResult = { passed, failed };
