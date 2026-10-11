import { esc, fmtNum, download, toCSV } from '../util.js';
import { icon } from '../icons.js';
import { THEMES } from '../defaults.js';
import { levelThreshold } from '../xp.js';
import { listTimezones, isValidTimezone } from '../dates.js';
import { allQuotes } from '../motivation.js';
import { opt } from '../forms.js';
import { avatar } from '../components.js';
import * as store from '../store.js';
import { toast, confirmDialog } from '../ui.js';
import { getStatus } from '../sync.js';

function ago(ms) {
  if (!ms) return 'not yet';
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 45) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return new Date(ms).toLocaleDateString();
}

export function syncSection() {
  const st = getStatus();
  const LABELS = { synced: 'Synced', syncing: 'Syncing…', connecting: 'Connecting…', offline: 'Offline — changes are saved on this device and will sync later', error: 'Sync problem', 'signed-out': 'Signed out' };
  const body = !st.linked
    ? `<p class="small">Sign in with Google to back up your progress and use it on your phone, laptop and any other device.</p>
       <p class="muted small">Everything stays saved on this device too, and the app keeps working offline.</p>
       ${st.error ? `<p class="small warn-text" role="alert">${esc(st.error)}</p>` : ''}
       <button class="btn primary" data-action="sync-signin" ${st.state === 'connecting' ? 'disabled' : ''}>${icon('user', 16)} ${st.state === 'connecting' ? 'Signing in…' : 'Sign in with Google'}</button>`
    : `<p class="small">Signed in as <strong>${esc(st.email || 'your Google account')}</strong></p>
       <p class="sync-line"><span class="sync-dot ${st.state}" aria-hidden="true"></span><span>${esc(LABELS[st.state] || 'Starting…')}${st.state === 'synced' ? ` · ${esc(ago(st.lastSyncAt))}` : ''}${st.pending && st.state !== 'synced' ? ` · ${st.pending} change${st.pending === 1 ? '' : 's'} waiting` : ''}</span></p>
       ${st.error ? `<p class="small warn-text" role="alert">${esc(st.error)}</p>` : ''}
       <div class="row-wrap">
         ${st.state === 'signed-out' ? `<button class="btn primary sm" data-action="sync-signin">Sign in again</button>` : `<button class="btn ghost sm" data-action="sync-now">${icon('refresh', 15)} Sync now</button>`}
         <button class="btn ghost sm" data-action="sync-signout">Sign out</button>
       </div>
       <p class="muted small">Changes sync automatically. If two devices edit the same thing while offline, the most recent change wins.</p>`;
  return `<details class="card disclosure" data-sync-section ${!st.linked || st.error ? 'open' : ''}>
    <summary><span class="disc-title" id="s-sync">Sync across devices</span>${icon('chevronDown', 18)}</summary>
    <div class="disclosure-body">${body}</div>
  </details>`;
}

const AVATAR_COLORS = ['#8b5cf6', '#6366f1', '#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];

const numIn = (name, value, { min = 0, max = 10000, label = '' } = {}) =>
  `<label class="field"><span>${label}</span><input class="input" type="number" inputmode="numeric" name="${name}" min="${min}" max="${max}" step="1" value="${esc(value)}" required><small class="err" data-err="${name}" role="alert"></small></label>`;

const toggle = (name, checked, label, hint = '') =>
  `<label class="toggle"><input type="checkbox" name="${name}" ${checked ? 'checked' : ''}><span class="switch" aria-hidden="true"></span><span class="toggle-text">${label}${hint ? `<small class="muted">${hint}</small>` : ''}</span></label>`;

export function render({ state }) {
  const s = state.settings;
  const x = s.xp;
  const adapter = store.getAdapter();
  const favs = state.motivation.favorites.map((id) => allQuotes(state).find((q) => q.id === id)).filter(Boolean);
  const notifSupported = 'Notification' in window;
  const notifPerm = notifSupported ? Notification.permission : 'unsupported';
  const tzs = listTimezones();
  if (!tzs.includes(s.timezone)) tzs.unshift(s.timezone);

  return `
  <header class="page-head"><div><h1 class="page-title">Settings</h1><p class="muted small">Open a section to change it. Each section has its own Save button.</p></div></header>

  <div class="settings">
  <details class="card disclosure" open>
    <summary><span class="disc-title" id="s-profile">Profile</span>${icon('chevronDown', 18)}</summary>
    <div class="disclosure-body">
    <form class="form" data-settings="profile">
      <div class="profile-row">${avatar(state.profile, 64)}
        <label class="field grow"><span>Character name</span><input class="input" name="name" maxlength="40" required value="${esc(state.profile.name)}"><small class="err" data-err="name" role="alert"></small></label>
      </div>
      <fieldset class="field"><legend>Avatar colour</legend><div class="swatches">${AVATAR_COLORS.map((c) => `<label class="swatch" style="--sw:${c}"><input type="radio" name="avatarColor" value="${c}" ${state.profile.avatarColor === c ? 'checked' : ''}><span class="sr-only">${c}</span></label>`).join('')}</div></fieldset>
      <button class="btn primary">Save profile</button>
    </form>
    </div>
  </details>

  ${syncSection()}
  <details class="card disclosure">
    <summary><span class="disc-title" id="s-look">Appearance &amp; time</span>${icon('chevronDown', 18)}</summary>
    <div class="disclosure-body">
    <form class="form" data-settings="general">
      <fieldset class="field"><legend>Theme</legend><div class="segmented three">
        ${[['dark', 'Dark'], ['light', 'Light'], ['system', 'System']].map(([v, n]) => `<label><input type="radio" name="theme" value="${v}" ${s.theme === v ? 'checked' : ''}><span>${n}</span></label>`).join('')}
      </div></fieldset>
      ${toggle('reduceMotion', s.reduceMotion, 'Reduce motion', 'Also follows your system setting automatically.')}
      <label class="field"><span>Timezone</span><select class="input" name="timezone">${tzs.map((t) => opt(t, t.replace(/_/g, ' '), s.timezone)).join('')}</select><small class="hint">Day boundaries for streaks and daily XP use this timezone. Past days keep the date they were recorded on.</small></label>
      <div class="grid-3">
        <label class="field"><span>New day starts at</span><select class="input" name="dayStartHour">${[0, 1, 2, 3, 4, 5].map((h) => opt(h, h === 0 ? 'Midnight' : `${h}:00 am`, s.dayStartHour)).join('')}</select><small class="hint">Night owl? Late activity counts for the previous day.</small></label>
        <label class="field"><span>Work starts</span><input class="input" type="time" name="workStart" value="${esc(s.workStart)}"></label>
        <label class="field"><span>Work ends</span><input class="input" type="time" name="workEnd" value="${esc(s.workEnd)}"></label>
      </div>
      <button class="btn primary">Save</button>
    </form>
    </div>
  </details>

  <details class="card disclosure">
    <summary><span class="disc-title" id="s-xp">XP rewards &amp; levels</span>${icon('chevronDown', 18)}</summary>
    <div class="disclosure-body">
    <form class="form" data-settings="xp">
      <p class="eyebrow">Missions by difficulty</p>
      <div class="grid-4">${numIn('xp.easy', x.easy, { label: 'Easy', max: 1000 })}${numIn('xp.normal', x.normal, { label: 'Normal', max: 1000 })}${numIn('xp.hard', x.hard, { label: 'Hard', max: 1000 })}${numIn('xp.epic', x.epic, { label: 'Epic', max: 1000 })}</div>
      <p class="eyebrow">Bonuses</p>
      <div class="grid-3">
        ${numIn('xp.allDailyBonus', x.allDailyBonus, { label: 'All daily missions done', max: 1000 })}
        ${numIn('xp.allDailyMinTasks', x.allDailyMinTasks, { label: '…when at least N planned', min: 1, max: 50 })}
        ${numIn('xp.habitTarget', x.habitTarget, { label: 'New habit default XP', max: 1000 })}
        ${numIn('xp.milestone', x.milestone, { label: 'Goal milestone', max: 1000 })}
        ${numIn('xp.goalComplete', x.goalComplete, { label: 'Goal completed', max: 5000 })}
        ${numIn('xp.dailyReview', x.dailyReview, { label: 'Daily review', max: 1000 })}
        ${numIn('xp.focusSession', x.focusSession, { label: 'Full focus session', max: 1000 })}
        ${numIn('dailyXpTarget', s.dailyXpTarget, { label: 'Daily XP target', min: 10, max: 5000 })}
      </div>
      <p class="eyebrow">Level curve</p>
      <div class="grid-2">${numIn('level.base', s.level.base, { label: 'Base XP per level', min: 10, max: 1000 })}${numIn('level.step', s.level.step, { label: 'Extra XP per level', min: 0, max: 1000 })}</div>
      <p class="muted small" data-curve>${curvePreview(s.level)}</p>
      <p class="muted small">Changing rewards affects future XP only. Your history stays as earned.</p>
      <button class="btn primary">Save XP settings</button>
    </form>
    </div>
  </details>

  <details class="card disclosure">
    <summary><span class="disc-title" id="s-streak">Streaks</span>${icon('chevronDown', 18)}</summary>
    <div class="disclosure-body">
    <form class="form" data-settings="streak">
      <div class="grid-2">
        ${numIn('activeDay.minActions', s.activeDay.minActions, { label: 'Actions for an active day', min: 1, max: 50 })}
        ${numIn('activeDay.minXp', s.activeDay.minXp, { label: 'Minimum XP (0 = off)', min: 0, max: 5000 })}
      </div>
      <p class="muted small">An action is a completed mission or a habit that met its daily target.</p>
      ${toggle('streakGrace', s.streakGrace, 'Streak protection', 'Forgive one missed day per week, as long as you were active the day before.')}
      <button class="btn primary">Save streak rules</button>
    </form>
    </div>
  </details>

  <details class="card disclosure">
    <summary><span class="disc-title" id="s-sales">Sales</span>${icon('chevronDown', 18)}</summary>
    <div class="disclosure-body">
    <form class="form" data-settings="sales">
      <div class="grid-2">
        <label class="field"><span>Currency</span><select class="input" name="currency">${['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD'].map((c) => opt(c, c, s.currency)).join('')}</select></label>
        ${numIn('dailyFollowUpGoal', s.dailyFollowUpGoal, { label: 'Daily follow-up goal (0 = off)', max: 1000 })}
      </div>
      ${toggle('salesXpEnabled', s.salesXpEnabled, 'Award XP for sales activity', 'Logging revenue never counts as completing a mission.')}
      <div class="grid-3">${numIn('xp.salesFollowups', x.salesFollowups, { label: 'Follow-up goal met', max: 1000 })}${numIn('xp.salesHalf', x.salesHalf, { label: '50% of target', max: 5000 })}${numIn('xp.salesTarget', x.salesTarget, { label: 'Target reached', max: 5000 })}</div>
      <p class="muted small">Monthly targets are set on the Sales page. Changing currency relabels amounts; it doesn’t convert them.</p>
      <button class="btn primary">Save sales settings</button>
    </form>
    </div>
  </details>

  <details class="card disclosure">
    <summary><span class="disc-title" id="s-mot">Motivation</span>${icon('chevronDown', 18)}</summary>
    <div class="disclosure-body">
    <form class="form" data-settings="motivation">
      <fieldset class="field"><legend>Themes that matter to you</legend><div class="chip-row">${THEMES.map((t) => `<label class="chip-check"><input type="checkbox" name="themes" value="${t.id}" ${s.themes.includes(t.id) ? 'checked' : ''}><span>${esc(t.name)}</span></label>`).join('')}</div></fieldset>
      <div class="grid-2"><label class="field"><span>Tone</span><select class="input" name="tone">${opt('gentle', 'Gentle', s.tone)}${opt('balanced', 'Balanced', s.tone)}${opt('direct', 'Direct', s.tone)}</select></label></div>
      ${toggle('showReflection', s.showReflection, 'Show a daily reflection question')}
      <button class="btn primary">Save motivation</button>
    </form>
    <h3 class="sub-h">Favorites</h3>
    ${favs.length ? `<ul class="quote-list">${favs.map((q) => `<li><span>“${esc(q.text)}”<small class="muted">${q.author ? `— ${esc(q.author)}` : 'Original affirmation'}</small></span><button class="icon-btn subtle sm" data-action="quote-fav" data-id="${q.id}" aria-label="Remove from favorites">${icon('x', 14)}</button></li>`).join('')}</ul>` : '<p class="muted small">Tap Favorite on the dashboard to save a message here.</p>'}
    <h3 class="sub-h">Your own quotes</h3>
    ${state.motivation.custom.length ? `<ul class="quote-list">${state.motivation.custom.map((q) => `<li><span>“${esc(q.text)}”${q.author ? `<small class="muted">— ${esc(q.author)}</small>` : ''}</span><button class="icon-btn subtle sm" data-action="quote-delete" data-id="${q.id}" aria-label="Delete quote">${icon('trash', 14)}</button></li>`).join('')}</ul>` : ''}
    <button class="btn ghost sm" data-action="quote-add">${icon('plus', 16)} Add a quote</button>
    <p class="muted small">Messages come from a built-in library of original affirmations, personalised with your own progress. No AI service or API key is used.</p>
    </div>
  </details>

  <details class="card disclosure">
    <summary><span class="disc-title" id="s-cat">Categories</span>${icon('chevronDown', 18)}</summary>
    <div class="disclosure-body">
    <p class="muted small">Ten built-in categories, plus your own.</p>
    ${s.customCategories.length ? `<ul class="plain cat-list">${s.customCategories.map((c) => `<li><span class="chip" style="--c:${c.color}"><i class="dot"></i>${esc(c.name)}</span><button class="icon-btn subtle sm" data-action="delete-category" data-id="${c.id}" aria-label="Delete category ${esc(c.name)}">${icon('trash', 14)}</button></li>`).join('')}</ul>` : ''}
    <form class="inline-form" data-settings="category"><label class="sr-only" for="newcat">New category</label><input id="newcat" class="input" name="name" maxlength="30" placeholder="New category name"><button class="btn ghost">${icon('plus', 16)} Add</button></form>
    </div>
  </details>

  <details class="card disclosure">
    <summary><span class="disc-title" id="s-rem">Habit reminders</span>${icon('chevronDown', 18)}</summary>
    <div class="disclosure-body">
    ${notifSupported ? `<p class="muted small">Reminders use browser notifications and only fire while LEVEL UP is open in a tab (there is no server to send push notifications). Set a reminder time on each habit.</p>
      <p class="small">Status: <strong>${s.notifications && notifPerm === 'granted' ? 'On' : notifPerm === 'denied' ? 'Blocked by the browser' : 'Off'}</strong></p>
      ${s.notifications && notifPerm === 'granted' ? '<button class="btn ghost sm" data-action="notif-off">Turn off</button>' : notifPerm === 'denied' ? '<p class="muted small">Allow notifications for this site in your browser settings to use reminders.</p>' : '<button class="btn ghost sm" data-action="notif-on">Turn on reminders</button>'}`
    : '<p class="muted small">This browser doesn’t support notifications.</p>'}
    </div>
  </details>

  <details class="card disclosure">
    <summary><span class="disc-title" id="s-data">Your data</span>${icon('chevronDown', 18)}</summary>
    <div class="disclosure-body">
    <p class="small">Storage: <strong>${esc(adapter.label)}</strong>${getStatus().linked ? ' + cloud sync' : ''}</p>
    <p class="muted small">${getStatus().linked ? 'Data is saved on this device and backed up to your account, so it’s available on every device you sign in on.' : adapter.persistent ? 'Data stays in this browser on this device. Sign in under “Sync across devices” to back it up and use it everywhere, or export a backup regularly.' : 'Browser storage is unavailable, so data will be lost when you close this tab. Export before leaving.'}</p>
    <div class="row-wrap">
      <button class="btn ghost sm" data-action="export-json">${icon('download', 16)} Export JSON backup</button>
      <button class="btn ghost sm" data-action="export-csv" data-kind="tasks">${icon('download', 16)} Missions CSV</button>
      <button class="btn ghost sm" data-action="export-csv" data-kind="xp">${icon('download', 16)} XP ledger CSV</button>
      <button class="btn ghost sm" data-action="export-csv" data-kind="habits">${icon('download', 16)} Habit log CSV</button>
      <button class="btn ghost sm" data-action="export-csv" data-kind="sales">${icon('download', 16)} Sales CSV</button>
    </div>
    <div class="row-wrap">
      <label class="btn ghost sm file-btn">${icon('upload', 16)} Import JSON backup<input type="file" accept="application/json,.json" data-import hidden></label>
      ${store.hasSamples() ? `<button class="btn ghost sm" data-action="remove-samples">${icon('x', 16)} Remove starter examples</button>` : ''}
      <button class="btn danger sm" data-action="reset-all">${icon('trash', 16)} Reset everything</button>
    </div>
    </div>
  </details>

  <details class="card disclosure">
    <summary><span class="disc-title" id="s-rules">How XP works</span>${icon('chevronDown', 18)}</summary>
    <div class="disclosure-body">
    <ul class="bullets small">
      <li>Each reward is recorded once in an XP ledger. Tapping complete again, refreshing or using two tabs can’t award it twice.</li>
      <li>Unchecking a mission or habit reverses its XP. Re-completing restores the same amount, so there’s nothing to farm.</li>
      <li>Editing a completed mission doesn’t change the XP already earned. Deleting a completed mission keeps its earned XP as history.</li>
      <li>The “all daily missions” bonus only applies to today. It is reversed if you add or reopen a mission today.</li>
      <li>Achievements are checked against your records and awarded once. They stay unlocked.</li>
      <li>Daily XP totals use the day each reward was earned. Reversals count against that same day.</li>
    </ul>
    </div>
  </details>
  </div>`;
}

function curvePreview(curve) {
  return 'Levels: ' + [2, 3, 4, 5, 6, 10].map((l) => `L${l} ${fmtNum(levelThreshold(l, curve))}`).join(' · ') + ' XP';
}

/** Build a nested patch from a settings form using dotted input names. */
function readForm(form) {
  const patch = {};
  const errors = {};
  const set = (path, v) => {
    const keys = path.split('.');
    let o = patch;
    keys.slice(0, -1).forEach((k) => { o = o[k] ||= {}; });
    o[keys[keys.length - 1]] = v;
  };
  const seen = new Set();
  for (const el of form.elements) {
    if (!el.name || seen.has(el.name)) continue;
    if (el.type === 'radio') { const c = form.querySelector(`[name="${el.name}"]:checked`); if (c) set(el.name, c.value); seen.add(el.name); continue; }
    if (el.type === 'checkbox' && form.querySelectorAll(`[name="${el.name}"]`).length > 1) {
      set(el.name, [...form.querySelectorAll(`[name="${el.name}"]:checked`)].map((c) => c.value)); seen.add(el.name); continue;
    }
    if (el.type === 'checkbox') { set(el.name, el.checked); continue; }
    if (el.type === 'number') {
      const n = Number(el.value);
      if (el.value === '' || !Number.isInteger(n) || n < Number(el.min) || n > Number(el.max)) errors[el.name] = `Use a whole number from ${el.min} to ${el.max}.`;
      else set(el.name, n);
      continue;
    }
    if (el.tagName === 'SELECT' && el.name === 'dayStartHour') { set(el.name, Number(el.value)); continue; }
    set(el.name, el.value);
  }
  return { patch, errors };
}

function showErrs(form, errors) {
  form.querySelectorAll('[data-err]').forEach((e) => { e.textContent = errors[e.dataset.err] || ''; });
  const first = Object.keys(errors)[0];
  if (first) form.querySelector(`[name="${first}"]`)?.focus();
  return !first;
}

export function bind(el) {
  el.querySelectorAll('form[data-settings]').forEach((form) => {
    const kind = form.dataset.settings;
    if (kind === 'xp') {
      form.addEventListener('input', () => {
        const base = Number(form.elements['level.base'].value) || 0;
        const step = Number(form.elements['level.step'].value) || 0;
        form.querySelector('[data-curve]').textContent = curvePreview({ base, step });
      });
    }
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (kind === 'category') {
        const name = form.elements.name.value.trim();
        if (!name) return;
        store.addCategory(name);
        toast('Category added');
        return;
      }
      const { patch, errors } = readForm(form);
      if (kind === 'profile') {
        if (!patch.name?.trim()) errors.name = 'Enter a name.';
        if (!showErrs(form, errors)) return;
        store.updateProfile({ name: patch.name.trim(), avatarColor: patch.avatarColor || store.getState().profile.avatarColor });
        toast('Profile saved');
        return;
      }
      if (kind === 'general' && !isValidTimezone(patch.timezone)) errors.timezone = 'Unknown timezone.';
      if (kind === 'motivation' && !(patch.themes || []).length) { toast('Pick at least one theme.', { type: 'error' }); return; }
      if (!showErrs(form, errors)) return;
      store.updateSettings(patch);
      toast('Settings saved');
    });
  });

  el.querySelector('[data-import]')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!data || typeof data !== 'object' || !Array.isArray(data.tasks) || !Array.isArray(data.ledger)) throw new Error('This file is not a LEVEL UP backup.');
      const ok = await confirmDialog({ title: 'Import backup?', message: `This replaces all current data with the backup (${data.tasks.length} missions, ${data.ledger.length} XP records). Export your current data first if you might need it.`, confirmLabel: 'Replace data', danger: true });
      if (!ok) return;
      store.importState(data);
      toast('Backup imported');
    } catch (err) {
      toast(err.message || 'Could not read that file.', { type: 'error' });
    }
  });
}

// ---------- Exports ----------

export function exportJSON() {
  const s = store.getState();
  download(`levelup-backup-${store.today()}.json`, JSON.stringify(s, null, 2));
}

export function exportCSV(kind) {
  const s = store.getState();
  const d = store.today();
  if (kind === 'tasks') {
    const rows = s.tasks.map((t) => ({ ...t, repeat: t.repeat.kind, subtasks: t.subtasks.map((x) => `${x.done ? '[x]' : '[ ]'} ${x.title}`).join(' | '), deleted: t.deletedAt ? 'yes' : '' }));
    download(`levelup-missions-${d}.csv`, toCSV(rows, ['id', 'title', 'category', 'priority', 'difficulty', 'xp', 'status', 'dueDate', 'dueTime', 'duration', 'repeat', 'completedDay', 'completedAt', 'goalId', 'description', 'notes', 'subtasks', 'deleted', 'createdAt']), 'text/csv');
  } else if (kind === 'xp') {
    download(`levelup-xp-ledger-${d}.csv`, toCSV(s.ledger, ['day', 'amount', 'label', 'kind', 'key', 'ts']), 'text/csv');
  } else if (kind === 'habits') {
    const rows = [];
    for (const h of s.habits) for (const [day, value] of Object.entries(s.habitLogs[h.id] || {})) rows.push({ habit: h.name, day, value, target: h.type === 'avoid' ? 1 : h.target, unit: h.unit, type: h.type });
    rows.sort((a, b) => a.day.localeCompare(b.day));
    download(`levelup-habits-${d}.csv`, toCSV(rows, ['day', 'habit', 'value', 'target', 'unit', 'type']), 'text/csv');
  } else if (kind === 'sales') {
    const rows = [...s.sales.entries].sort((a, b) => a.day.localeCompare(b.day)).map((e) => ({ ...e, currency: s.settings.currency }));
    download(`levelup-sales-${d}.csv`, toCSV(rows, ['day', 'amount', 'currency', 'deals', 'leads', 'followUps', 'meetings', 'note']), 'text/csv');
  }
}
