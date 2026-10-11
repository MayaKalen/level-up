import * as store from './store.js';
import { pickAdapter } from './storage.js';
import { icon } from './icons.js';
import { esc, fmtNum, prefersReducedMotion } from './util.js';
import { levelInfo, lifetimeXp, xpBetween, rankFor } from './xp.js';
import { openSheet, confirmDialog, toast, xpFloat, levelUpModal, achievementPopup, sheetOpen, closeTopSheet } from './ui.js';
import { openTaskForm, openHabitForm, openHabitLog, openGoalForm, openSalesEntry, openTargetForm, openQuoteForm } from './forms.js';
import { showOnboarding } from './onboarding.js';
import { openFocus, initFocus } from './focus.js';
import { openQuickAdd, openHabitDetail, openGoalDetail } from './sheets.js';
import * as sync from './sync.js';
import { avatar, catChip, priorityBadge } from './components.js';
import { relDay, fmtTime, fmtDay, addMonths, monthOf, timeHM } from './dates.js';
import { STATUSES } from './defaults.js';
import { habitMet, activeHabits } from './habits.js';
import { exportJSON, exportCSV } from './views/settings.js';
import * as dashboard from './views/dashboard.js';
import * as missions from './views/missions.js';
import * as habits from './views/habits.js';
import * as goals from './views/goals.js';
import * as sales from './views/sales.js';
import * as stats from './views/stats.js';
import * as achievements from './views/achievements.js';
import * as plan from './views/plan.js';
import * as settings from './views/settings.js';

const ROUTES = {
  '': { view: dashboard, title: 'Today', icon: 'home' },
  missions: { view: missions, title: 'Missions', icon: 'list' },
  habits: { view: habits, title: 'Habits', icon: 'repeat' },
  goals: { view: goals, title: 'Goals', icon: 'flag' },
  sales: { view: sales, title: 'Sales', icon: 'trending' },
  stats: { view: stats, title: 'Statistics', icon: 'chart' },
  achievements: { view: achievements, title: 'Achievements', icon: 'trophy' },
  plan: { view: plan, title: 'Plan & Review', icon: 'sunrise' },
  settings: { view: settings, title: 'Settings', icon: 'sliders' },
};
const MORE = ['goals', 'sales', 'stats', 'achievements', 'plan', 'settings'];
const PRIMARY = ['', 'missions', 'habits', 'goals', 'sales'];

// View-local UI state (filters, tabs). Not persisted except the remembered tab.
const ui = { showFilters: false, dashFilter: 'all', missionTab: 'today', search: '', missionCat: 'all', sort: 'priority', goalFilter: 'active', salesMonth: null, statsRange: 7, justDone: null };

const route = () => (location.hash.replace(/^#\/?/, '').split('?')[0] || '');
const $ = (sel) => document.querySelector(sel);

// ---------- Shell ----------

function renderShell() {
  const navLink = (key, cls = '') => {
    const r = ROUTES[key];
    return `<a href="#/${key}" class="nav-link ${cls}" data-route="${key}">${icon(r.icon, 20)}<span>${esc(r.title)}</span></a>`;
  };
  document.getElementById('app').innerHTML = `
    <aside class="sidebar" aria-label="Main navigation">
      <a class="brand" href="#/">${icon('zap', 20)}<span>LEVEL UP</span></a>
      <div class="side-char" data-side-char></div>
      <button class="btn primary block" data-action="quick-add">${icon('plus', 18)} Add</button>
      <nav><ul>${PRIMARY.map((k) => `<li>${navLink(k)}</li>`).join('')}</ul>
        <p class="nav-label">More</p>
        <ul class="nav-secondary">${MORE.filter((k) => !PRIMARY.includes(k)).map((k) => `<li>${navLink(k)}</li>`).join('')}</ul></nav>
      <button class="nav-link theme-btn" data-action="theme-toggle">${icon('moon', 20)}<span>Light / dark</span></button>
    </aside>
    <div class="main-col">
      <header class="topbar" data-topbar></header>
      <main id="main" tabindex="-1"></main>
    </div>
    <nav class="bottom-nav" aria-label="Main navigation">
      <a href="#/" class="bn" data-route="">${icon('home', 22)}<span>Today</span></a>
      <a href="#/missions" class="bn" data-route="missions">${icon('list', 22)}<span>Missions</span></a>
      <button class="fab" data-action="quick-add" aria-label="Add">${icon('plus', 26)}</button>
      <a href="#/habits" class="bn" data-route="habits">${icon('repeat', 22)}<span>Habits</span></a>
      <button class="bn" data-action="more-menu" data-route-more aria-haspopup="dialog">${icon('menu', 22)}<span>More</span></button>
    </nav>`;
}

function renderChrome(state, today) {
  const info = levelInfo(lifetimeXp(state.ledger), state.settings.level);
  const xpToday = xpBetween(state.ledger, today, today);
  const r = route();
  document.querySelectorAll('[data-route]').forEach((a) => {
    const on = a.dataset.route === r;
    a.classList.toggle('active', on);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  $('[data-route-more]')?.classList.toggle('active', MORE.includes(r));
  $('[data-side-char]').innerHTML = `<a href="#/settings" class="side-char-in">${avatar(state.profile, 40)}<span><strong>${esc(state.profile.name)}</strong><small>Lv ${info.level} · ${esc(info.rank)}</small></span></a>
    <div class="progress xp sm" role="progressbar" aria-label="Level progress" aria-valuenow="${Math.round(info.pct)}" aria-valuemin="0" aria-valuemax="100"><div style="width:${info.pct}%"></div></div>
    <small class="muted">${fmtNum(info.toNext)} XP to level ${info.level + 1}</small>`;
  $('[data-topbar]').innerHTML = `
    <a href="#/settings" class="tb-char" aria-label="Profile, level ${info.level}">${avatar(state.profile, 36)}<span class="tb-level">${info.level}</span></a>
    ${r === '' ? `<div class="tb-xp"><strong class="tb-brand">LEVEL UP</strong></div>` : `<div class="tb-xp"><div class="row-between"><span class="small">Level ${info.level}</span><span class="small muted">${fmtNum(xpToday)} XP today</span></div>
      <div class="progress xp xs" aria-hidden="true"><div style="width:${info.pct}%"></div></div></div>`}
    <button class="icon-btn" data-action="theme-toggle" aria-label="Toggle light and dark theme">${icon(document.documentElement.dataset.theme === 'light' ? 'moon' : 'sun', 20)}</button>`;
  const title = ROUTES[r]?.title || 'Dashboard';
  document.title = `${title} · LEVEL UP`;
}

function applyTheme(state) {
  const pref = state.settings.theme;
  const dark = pref === 'system' ? !matchMedia('(prefers-color-scheme: light)').matches : pref !== 'light';
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.documentElement.classList.toggle('reduce-motion', state.settings.reduceMotion || prefersReducedMotion());
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', dark ? '#0b0d14' : '#f5f6fb');
}

// ---------- Rendering ----------

function focusKey(el) {
  if (!el || el === document.body) return null;
  const attrs = ['data-action', 'data-id', 'data-day', 'data-value', 'data-delta', 'data-goal'];
  const parts = attrs.filter((a) => el.hasAttribute?.(a)).map((a) => `[${a}="${CSS.escape(el.getAttribute(a))}"]`);
  return parts.length && el.hasAttribute('data-action') ? parts.join('') : null;
}

function ctx() {
  return { state: store.getState(), today: store.today(), ui };
}

let lastRendered = null;
function render() {
  const state = store.getState();
  if (!state.onboarded) return;
  applyTheme(state);
  const r = route();
  const def = ROUTES[r];
  if (!def) { location.hash = '#/'; return; }
  const main = document.getElementById('main');
  const key = focusKey(document.activeElement);
  const c = ctx();
  // Keep expandable sections open/closed across re-renders of the same page.
  const sameRoute = lastRendered === r;
  const summaryKey = (d) => d.querySelector('summary')?.textContent.trim();
  const openSet = sameRoute ? new Set([...main.querySelectorAll('details')].filter((d) => d.open).map(summaryKey)) : null;
  lastRendered = r;
  try {
    main.innerHTML = def.view.render(c);
    if (openSet) main.querySelectorAll('details').forEach((d) => { d.open = openSet.has(summaryKey(d)); });
    def.view.bind?.(main, c, () => {
      const list = main.querySelector('[data-mission-list]');
      if (list) list.innerHTML = missions.renderList(ctx());
    });
  } catch (err) {
    console.error(err);
    main.innerHTML = `<div class="empty"><span class="empty-icon">${icon('alert', 24)}</span><h3>Something went wrong showing this page</h3><p>${esc(err.message)}</p><p class="muted small">Your data is safe. Try another page or reload.</p><button class="btn primary" onclick="location.reload()">Reload</button></div>`;
  }
  renderChrome(state, c.today);
  if (r === 'settings' && !sync.getStatus().linked) sync.preload().catch(() => {});
  if (key && !sheetOpen()) main.querySelector(key)?.focus({ preventScroll: true });
  const err = store.getSaveError();
  if (err) showStorageWarning(err);
}

let warned = null;
function showStorageWarning(msg) {
  if (warned === msg) return;
  warned = msg;
  toast(`Not saved: ${msg}`, { type: 'error', duration: 8000 });
}

// ---------- Store events ----------

function handleEvents(state, events) {
  const reduce = document.documentElement.classList.contains('reduce-motion');
  for (const e of events) {
    if (e.type === 'xp' && e.amount !== 0 && !reduce) xpFloat(e.amount);
    if (e.type === 'achievement') achievementPopup(e.name, e.xp);
    if (e.type === 'milestone') toast(`Milestone complete: ${e.title}`);
    if (e.type === 'levelup') setTimeout(() => levelUpModal(e.level, rankFor(e.level)), reduce ? 0 : 450);
    if (e.type === 'reset' || e.type === 'import' || e.type === 'sync') { if (!state.onboarded && !document.querySelector('.onboarding')) showOnboarding(); }
  }
}

// ---------- Task detail sheet ----------

function openTaskDetail(id) {
  const state = store.getState();
  const t = state.tasks.find((x) => x.id === id && !x.deletedAt);
  if (!t) return;
  const today = store.today();
  const goal = t.goalId ? state.goals.find((g) => g.id === t.goalId) : null;
  const done = t.status === 'completed';
  const sheet = openSheet({
    title: t.title,
    body: `<div class="detail">
      <div class="task-meta">${catChip(state, t.category)}${priorityBadge(t.priority)}<span class="badge">${esc(STATUSES.find((s) => s.id === t.status)?.name)}</span><span class="xp-pill ${done ? 'earned' : ''}">${icon('zap', 13)}${t.xp} XP</span>${t.isSample ? '<span class="badge sample">Starter example</span>' : ''}</div>
      <dl class="dl">
        <dt>Due</dt><dd>${t.dueDate ? `${esc(relDay(t.dueDate, today))}${t.dueTime ? ` at ${esc(fmtTime(t.dueTime))}` : ''}` : 'Anytime'}</dd>
        <dt>Difficulty</dt><dd>${esc(t.difficulty[0].toUpperCase() + t.difficulty.slice(1))}${t.duration ? ` · ~${t.duration} min` : ''}</dd>
        ${t.repeat.kind !== 'none' ? `<dt>Repeats</dt><dd>${esc(t.repeat.kind === 'custom' ? 'Custom days' : t.repeat.kind[0].toUpperCase() + t.repeat.kind.slice(1))} — the next one is created when you complete or skip this one.</dd>` : ''}
        ${goal ? `<dt>Goal</dt><dd>${esc(goal.title)}</dd>` : ''}
        ${done ? `<dt>Completed</dt><dd>${esc(fmtDay(t.completedDay))} at ${esc(new Date(t.completedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }))}</dd>` : ''}
        ${t.description ? `<dt>Description</dt><dd>${esc(t.description)}</dd>` : ''}
        ${t.notes ? `<dt>Notes</dt><dd>${esc(t.notes)}</dd>` : ''}
      </dl>
      ${t.subtasks.length ? `<p class="eyebrow">Subtasks</p><ul class="subtasks">${t.subtasks.map((s) => `<li><label class="sub-check"><input type="checkbox" data-sub="${s.id}" ${s.done ? 'checked' : ''}><span>${esc(s.title)}</span></label></li>`).join('')}</ul>` : ''}
      <div class="detail-actions">
        <button class="btn ${done ? 'ghost' : 'primary'} block" data-d="toggle" ${t.status === 'skipped' ? 'disabled' : ''}>${icon('check', 18)} ${done ? 'Mark not done' : `Complete · +${t.xp} XP`}</button>
        <div class="grid-2">
          <button class="btn ghost" data-d="edit">${icon('pencil', 16)} Edit</button>
          <button class="btn ghost" data-d="duplicate">${icon('copy', 16)} Duplicate</button>
          ${t.status === 'not_started' ? `<button class="btn ghost" data-d="progress">${icon('play', 16)} Start</button>` : ''}
          ${t.status === 'skipped' ? `<button class="btn ghost" data-d="reopen">${icon('refresh', 16)} Reopen</button>` : !done ? `<button class="btn ghost" data-d="skip">${icon('skip', 16)} Skip</button>` : ''}
          ${!done && t.dueDate !== today ? `<button class="btn ghost" data-d="today">${icon('calendar', 16)} Move to today</button>` : ''}
          <button class="btn ghost danger-text" data-d="delete">${icon('trash', 16)} Delete</button>
        </div>
      </div>
    </div>`,
  });
  sheet.el.addEventListener('change', (e) => { if (e.target.dataset.sub) store.toggleSubtask(t.id, e.target.dataset.sub); });
  sheet.el.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-d]');
    if (!b) return;
    const act = b.dataset.d;
    if (act === 'toggle') { toggleTaskWithFeedback(t.id); sheet.close(); }
    if (act === 'edit') { sheet.close(); setTimeout(() => openTaskForm(t.id), 170); }
    if (act === 'duplicate') { store.duplicateTask(t.id); toast('Mission duplicated'); sheet.close(); }
    if (act === 'progress') { store.setTaskStatus(t.id, 'in_progress'); sheet.close(); }
    if (act === 'skip') { store.skipTask(t.id); toast(t.repeat.kind !== 'none' ? 'Skipped — next one scheduled' : 'Mission skipped', { type: 'info', action: { label: 'Undo', fn: () => store.setTaskStatus(t.id, 'not_started') } }); sheet.close(); }
    if (act === 'reopen') { store.setTaskStatus(t.id, 'not_started'); sheet.close(); }
    if (act === 'today') { store.updateTask(t.id, { dueDate: today }); toast('Moved to today'); sheet.close(); }
    if (act === 'delete') {
      const ok = await confirmDialog({
        title: 'Delete this mission?',
        message: `${t.repeat.kind !== 'none' && !t.nextSpawned ? 'This also stops the repeating series. ' : ''}${done ? 'XP you already earned from it stays in your history.' : 'It hasn’t earned any XP.'}`,
        confirmLabel: 'Delete', danger: true,
      });
      if (ok) { store.deleteTask(t.id); toast('Mission deleted', { type: 'info' }); sheet.close(); }
    }
  });
}

function toggleTaskWithFeedback(id) {
  const t = store.getState().tasks.find((x) => x.id === id);
  if (!t || t.status === 'skipped') return;
  const completing = t.status !== 'completed';
  if (completing) {
    ui.justDone = id;
    setTimeout(() => { if (ui.justDone === id) ui.justDone = null; }, 900);
  }
  store.toggleTask(id);
  if (completing) toast(`Mission complete: ${t.title}`, { action: { label: 'Undo', fn: () => store.uncompleteTask(id) } });
}

// ---------- Actions ----------

function openMoreMenu() {
  const s = openSheet({
    title: 'More',
    body: `<nav aria-label="More pages"><ul class="more-menu">${MORE.map((k) => `<li><a href="#/${k}" class="more-link">${icon(ROUTES[k].icon, 20)}<span>${esc(ROUTES[k].title)}</span>${icon('chevronRight', 18)}</a></li>`).join('')}</ul></nav>
      <div class="more-quick"><button class="btn ghost block" data-action="focus-start">${icon('timer', 18)} Start a focus session</button><button class="btn ghost block" data-action="theme-toggle">${icon('moon', 18)} Toggle theme</button></div>`,
  });
  s.el.addEventListener('click', (e) => { if (e.target.closest('a,[data-action]')) setTimeout(() => s.close(), 0); });
}

const actions = {
  'task-toggle': (d) => toggleTaskWithFeedback(d.id),
  'quick-add': () => openQuickAdd(),
  'sync-signin': async () => {
    try {
      const r = await sync.signIn();
      if (r === 'cloud') toast('Signed in — your saved progress is on this device now');
      else if (r) toast('Signed in — your progress is now backed up and syncing');
    } catch (e) { toast(e.message, { type: 'error', duration: 7000 }); }
  },
  'sync-now': () => sync.flush(),
  'sync-signout': async () => {
    if (await confirmDialog({ title: 'Sign out of sync?', message: 'Your data stays on this device. Changes made here won’t sync to your other devices until you sign in again.', confirmLabel: 'Sign out' })) {
      await sync.signOut(); toast('Signed out of sync', { type: 'info' });
    }
  },
  'habit-open': (d) => openHabitDetail(d.id),
  'goal-open': (d) => openGoalDetail(d.id),
  'toggle-filters': () => { ui.showFilters = !ui.showFilters; render(); },
  'hide-sample-note': () => store.setUi({ hideSampleNote: true }),
  'task-open': (d) => openTaskDetail(d.id),
  'task-menu': (d) => openTaskDetail(d.id),
  'new-task': () => openTaskForm(null, ui.missionTab === 'anytime' && route() === 'missions' ? { dueDate: '' } : {}),
  'set-ui': (d) => {
    ui[d.key] = ['statsRange'].includes(d.key) ? Number(d.value) : d.value;
    if (d.key === 'missionTab') { try { sessionStorage.setItem('levelup:tab', d.value); } catch { /* ignore */ } }
    render();
  },
  'habit-toggle': (d) => store.toggleHabit(d.id, d.day || store.today()),
  'habit-step': (d) => store.stepHabit(d.id, d.day || store.today(), Number(d.delta)),
  'new-habit': () => openHabitForm(),
  'edit-habit': (d) => openHabitForm(d.id),
  'delete-habit': async (d) => {
    const h = store.getState().habits.find((x) => x.id === d.id);
    if (h && await confirmDialog({ title: `Remove “${h.name}”?`, message: 'It disappears from your habit list. Past check-ins and XP stay in your history and statistics.', confirmLabel: 'Remove', danger: true })) {
      store.deleteHabit(d.id); toast('Habit removed', { type: 'info' });
    }
  },
  'log-habit': () => openHabitLog(),
  'new-goal': () => openGoalForm(),
  'edit-goal': (d) => openGoalForm(d.id),
  'delete-goal': async (d) => {
    const g = store.getState().goals.find((x) => x.id === d.id);
    if (g && await confirmDialog({ title: `Delete “${g.title}”?`, message: 'Linked missions and habits are kept but unlinked. XP already earned from milestones stays.', confirmLabel: 'Delete goal', danger: true })) {
      store.deleteGoal(d.id); toast('Goal deleted', { type: 'info' });
    }
  },
  'goal-status': (d) => { store.setGoalStatus(d.id, d.status); if (d.status === 'completed') toast('Goal complete. That took real commitment.'); },
  'goal-add-task': (d) => { const g = store.getState().goals.find((x) => x.id === d.id); openTaskForm(null, { goalId: d.id, category: g?.category }); },
  'ms-toggle': (d) => store.toggleMilestone(d.goal, d.id),
  'ms-delete': async (d) => { if (await confirmDialog({ title: 'Delete milestone?', message: 'XP already earned from it stays in your history.', confirmLabel: 'Delete', danger: true })) store.deleteMilestone(d.goal, d.id); },
  'sales-log': (d) => openSalesEntry(d.day || null),
  'sales-target': (d) => openTargetForm(d.month || ui.salesMonth || null),
  'sales-delete': async (d) => { if (await confirmDialog({ title: 'Delete this entry?', message: `Removes the sales numbers for ${fmtDay(d.day)}.`, confirmLabel: 'Delete', danger: true })) { store.deleteSalesEntry(d.day); toast('Entry deleted', { type: 'info' }); } },
  'sales-month': (d) => {
    const cur = ui.salesMonth || monthOf(store.today());
    const next = addMonths(cur, Number(d.delta));
    if (next > monthOf(store.today())) return;
    ui.salesMonth = next; render();
  },
  'quote-next': () => store.anotherQuote(),
  'quote-fav': (d) => { const was = store.getState().motivation.favorites.includes(d.id); store.toggleFavorite(d.id); toast(was ? 'Removed from favorites' : 'Saved to favorites', { type: 'info' }); },
  'quote-add': () => openQuoteForm(),
  'quote-delete': async (d) => { if (await confirmDialog({ title: 'Delete this quote?', message: 'It will be removed from your rotation and favorites.', confirmLabel: 'Delete', danger: true })) store.deleteCustomQuote(d.id); },
  'focus-start': () => openFocus(),
  'more-menu': () => openMoreMenu(),
  'theme-toggle': () => { const dark = document.documentElement.dataset.theme !== 'light'; store.updateSettings({ theme: dark ? 'light' : 'dark' }); },
  'remove-samples': async () => {
    if (await confirmDialog({ title: 'Remove starter examples?', message: 'Unused sample missions and habits are removed. Any you completed or logged are kept as your own.', confirmLabel: 'Remove', danger: true })) { store.removeSamples(); toast('Starter examples removed', { type: 'info' }); }
  },
  'delete-category': async (d) => { if (await confirmDialog({ title: 'Delete category?', message: 'Missions, habits and goals using it move to Personal Growth.', confirmLabel: 'Delete', danger: true })) store.deleteCategory(d.id); },
  'export-json': () => { exportJSON(); toast('Backup downloaded'); },
  'export-csv': (d) => { exportCSV(d.kind); toast('CSV downloaded'); },
  'reset-all': async () => {
    if (await confirmDialog({ title: 'Reset everything?', message: `This permanently deletes all missions, habits, goals, sales, XP and settings from this browser${sync.getStatus().linked ? ' AND from your synced account on every device' : ''}. Export a backup first if you might want it.`, confirmLabel: 'Delete all data', danger: true, requireText: 'RESET' })) {
      store.resetAll(); ui.salesMonth = null; location.hash = '#/';
    }
  },
  'notif-on': async () => {
    try {
      const p = await Notification.requestPermission();
      if (p === 'granted') { store.updateSettings({ notifications: true }); toast('Reminders on'); } else { toast('Notifications were not allowed.', { type: 'error' }); render(); }
    } catch { toast('Could not enable notifications.', { type: 'error' }); }
  },
  'notif-off': () => store.updateSettings({ notifications: false }),
};

// Toggles ignore a repeat tap on the same item within 500 ms, so a double-tap
// can't complete and immediately un-complete something.
const TOGGLES = new Set(['task-toggle', 'habit-toggle', 'ms-toggle']);
let lastToggle = { key: '', t: 0 };

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el || el.disabled) return;
  const fn = actions[el.dataset.action];
  if (!fn) return;
  if (el.hasAttribute('data-close-sheet')) closeTopSheet();
  if (TOGGLES.has(el.dataset.action)) {
    const key = `${el.dataset.action}:${el.dataset.id}:${el.dataset.day || ''}`;
    const now = Date.now();
    if (lastToggle.key === key && now - lastToggle.t < 500) { e.preventDefault(); return; }
    lastToggle = { key, t: now };
  }
  if (el.tagName === 'A' && el.dataset.action === 'set-ui') { /* navigate and set */ }
  else e.preventDefault();
  fn(el.dataset);
});

// Inline forms in goal cards and selects that change view state.
document.addEventListener('submit', (e) => {
  const f = e.target;
  if (f.dataset.addMs) {
    e.preventDefault();
    const title = f.elements.title.value.trim();
    if (title) store.addMilestone(f.dataset.addMs, title);
    setTimeout(() => document.getElementById(`ms-${f.dataset.addMs}`)?.focus(), 0);
  } else if (f.dataset.goalValue) {
    e.preventDefault();
    const g = store.getState().goals.find((x) => x.id === f.dataset.goalValue);
    const v = Number(f.elements.v.value);
    if (!g || !Number.isFinite(v) || v < 0) { toast('Enter a number of 0 or more.', { type: 'error' }); return; }
    store.updateGoal(g.id, { numeric: { ...g.numeric, current: v } });
    toast('Progress updated');
  }
});

document.addEventListener('change', (e) => {
  const sel = e.target.closest('[data-ui-select]');
  if (sel) { ui[sel.dataset.uiSelect] = sel.value; render(); }
});

// Keyboard shortcut: "n" for a new mission.
document.addEventListener('keydown', (e) => {
  if (e.key === 'n' && !e.metaKey && !e.ctrlKey && !e.altKey && !sheetOpen() && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName) && store.getState().onboarded) {
    e.preventDefault(); openTaskForm();
  }
});

// ---------- Background checks: day rollover & reminders ----------

let lastDay = null;
function backgroundTick() {
  const state = store.getState();
  if (!state.onboarded) return;
  const d = store.today();
  if (d !== lastDay) {
    const first = lastDay === null;
    lastDay = d;
    store.ensureDailyQuote();
    if (!first) render();
  }
  if (state.settings.notifications && 'Notification' in window && Notification.permission === 'granted') {
    const now = timeHM(new Date(), state.settings.timezone);
    const k = `levelup:reminded:${d}`;
    let sent = [];
    try { sent = JSON.parse(localStorage.getItem(k) || '[]'); } catch { /* ignore */ }
    for (const h of activeHabits(state)) {
      if (!h.reminder || sent.includes(h.id) || now < h.reminder || habitMet(state, h, d)) continue;
      try { new Notification(`Reminder: ${h.name}`, { body: 'A quick check-in keeps your streak going.', tag: `habit-${h.id}` }); } catch { /* ignore */ }
      sent.push(h.id);
    }
    try { localStorage.setItem(k, JSON.stringify(sent)); } catch { /* ignore */ }
  }
}

// ---------- Boot ----------

function boot() {
  const adapter = pickAdapter();
  const { loadError } = store.init(adapter);
  try { const t = sessionStorage.getItem('levelup:tab'); if (t) ui.missionTab = t; } catch { /* ignore */ }
  renderShell();
  applyTheme(store.getState());
  store.subscribe((state, events) => { handleEvents(state, events); render(); });
  window.addEventListener('hashchange', () => {
    render();
    if (!sheetOpen()) { window.scrollTo(0, 0); document.getElementById('main').focus({ preventScroll: true }); }
  });
  matchMedia('(prefers-color-scheme: light)').addEventListener?.('change', () => applyTheme(store.getState()));
  initFocus();
  sync.initSync();
  sync.onStatus(() => {
    // Refresh only the sync panel so anything typed elsewhere on Settings is kept.
    const el = route() === 'settings' && document.querySelector('[data-sync-section]');
    if (!el) return;
    const wasOpen = el.open;
    const focused = el.contains(document.activeElement) ? document.activeElement.dataset.action : null;
    el.outerHTML = settings.syncSection();
    const fresh = document.querySelector('[data-sync-section]');
    fresh.open = wasOpen || fresh.open;
    if (focused) fresh.querySelector(`[data-action="${focused}"]`)?.focus();
  });
  if (!store.getState().onboarded) showOnboarding();
  render();
  backgroundTick();
  setInterval(backgroundTick, 30000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) backgroundTick(); });
  if (loadError) toast(`${loadError} A copy was kept in browser storage and the app started fresh.`, { type: 'error', duration: 10000 });
  if (!adapter.persistent) toast('Browser storage is blocked — your data won’t be saved after closing this tab.', { type: 'error', duration: 10000 });
  const s = store.getState();
  const info = levelInfo(lifetimeXp(s.ledger), s.settings.level);
  if (info.level > (s.ui.lastLevelSeen || 1)) store.markLevelSeen(info.level);
}

boot();
