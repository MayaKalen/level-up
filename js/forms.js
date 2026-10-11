// Forms shown in sheets: tasks, habits, goals, sales, focus sessions, quotes.
import * as store from './store.js';
import { openSheet, toast } from './ui.js';
import { esc, uid } from './util.js';
import { icon } from './icons.js';
import { allCategories } from './tasks.js';
import { PRIORITIES, DIFFICULTIES, STATUSES, REPEATS } from './defaults.js';
import { WEEKDAYS, isDayKey, monthOf, fmtDay, addDays } from './dates.js';
import { entryOn } from './sales.js';
import { habitsDueToday, habitValue, dailyTarget, habitMet } from './habits.js';

// ---------- small builders ----------

export const opt = (value, label, selected) => `<option value="${esc(value)}" ${String(selected) === String(value) ? 'selected' : ''}>${esc(label)}</option>`;

export function field(label, control, { hint = '', name = '', cls = '' } = {}) {
  return `<label class="field ${cls}"><span>${label}</span>${control}${hint ? `<small class="hint">${hint}</small>` : ''}<small class="err" data-err="${name}" role="alert"></small></label>`;
}

function categoryOptions(state, value) {
  return allCategories(state).map((c) => opt(c.id, c.name, value)).join('');
}

function goalOptions(state, value) {
  return opt('', 'No goal', value) + state.goals.filter((g) => g.status !== 'abandoned').map((g) => opt(g.id, g.title, value)).join('');
}

function weekdayChips(name, selected) {
  return `<div class="chip-row" role="group">${[1, 2, 3, 4, 5, 6, 0].map((d) => `<label class="chip-check"><input type="checkbox" name="${name}" value="${d}" ${selected.includes(d) ? 'checked' : ''}><span>${WEEKDAYS[d]}</span></label>`).join('')}</div>`;
}

function showErrors(form, errors) {
  form.querySelectorAll('[data-err]').forEach((el) => { el.textContent = ''; });
  form.querySelectorAll('[aria-invalid]').forEach((el) => el.removeAttribute('aria-invalid'));
  let first = null;
  for (const [name, msg] of Object.entries(errors)) {
    const el = form.querySelector(`[data-err="${name}"]`);
    if (el) el.textContent = msg;
    const input = form.elements[name];
    if (input?.setAttribute) { input.setAttribute('aria-invalid', 'true'); first ||= input; }
  }
  first?.focus();
  return Object.keys(errors).length === 0;
}

const num = (v) => (v === '' || v == null ? null : Number(v));
const intIn = (v, lo, hi) => { const n = num(v); return n != null && Number.isFinite(n) && n >= lo && n <= hi && Math.round(n) === n; };

/** Attach a submit handler that validates and blocks double submissions. */
function onSubmit(form, handler) {
  let busy = false;
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (busy) return;
    busy = true;
    const btn = form.querySelector('[type=submit]');
    if (btn) btn.disabled = true;
    try { handler(new FormData(form)); } catch (err) { console.error(err); toast(err.message || 'Something went wrong.', { type: 'error' }); }
    finally { busy = false; if (btn) btn.disabled = false; }
  });
}

// ---------- Task form ----------

export function openTaskForm(taskId = null, preset = {}) {
  const s = store.getState();
  const today = store.today();
  const t = taskId ? s.tasks.find((x) => x.id === taskId) : null;
  const v = t || { title: preset.title || '', description: '', category: preset.category || 'personal', goalId: preset.goalId || '', priority: 'medium', difficulty: 'normal', xp: s.settings.xp.normal, dueDate: preset.dueDate ?? today, dueTime: '', duration: '', repeat: { kind: 'none', days: [] }, notes: '', subtasks: [], status: 'not_started' };
  const x = s.settings.xp;
  const tomorrow = addDays(today, 1);
  const when = !v.dueDate ? 'none' : v.dueDate === today ? 'today' : v.dueDate === tomorrow ? 'tomorrow' : 'date';

  const sheet = openSheet({
    title: t ? 'Edit mission' : 'New mission',
    body: `<form class="form" novalidate>
      ${field('Mission', `<input class="input lg" name="title" maxlength="120" required autofocus placeholder="What will you do?" value="${esc(v.title)}" autocomplete="off">`, { name: 'title' })}
      <fieldset class="field"><legend>Difficulty · XP reward</legend>
        <div class="segmented" role="radiogroup">${DIFFICULTIES.map((d) => `<label><input type="radio" name="difficulty" value="${d.id}" ${v.difficulty === d.id ? 'checked' : ''}><span>${d.name}<small>${x[d.id]} XP</small></span></label>`).join('')}</div>
      </fieldset>
      <fieldset class="field"><legend>When</legend>
        <div class="segmented" role="radiogroup">${[['today', 'Today'], ['tomorrow', 'Tomorrow'], ['date', 'Pick date'], ['none', 'Someday']].map(([id, n]) => `<label><input type="radio" name="when" value="${id}" ${when === id ? 'checked' : ''}><span>${n}</span></label>`).join('')}</div>
        <input class="input when-date" type="date" name="dueDate" value="${esc(v.dueDate || '')}" aria-label="Due date" ${when === 'date' ? '' : 'hidden'}>
        <small class="err" data-err="dueDate" role="alert"></small>
      </fieldset>
      ${field('Area', `<select class="input" name="category">${categoryOptions(s, v.category)}</select>`)}
      <details class="more">
        <summary>${icon('chevronDown', 16)} More options <span class="muted small">priority, time, repeat, goal, notes…</span></summary>
        <div class="grid-2">
          ${field('Priority', `<select class="input" name="priority">${PRIORITIES.map((p) => opt(p.id, p.name, v.priority)).join('')}</select>`)}
          ${field('Time <em>(optional)</em>', `<input class="input" type="time" name="dueTime" value="${esc(v.dueTime || '')}">`)}
        </div>
        <div class="grid-2">
          ${field('Repeat', `<select class="input" name="repeat">${REPEATS.map((r) => opt(r.id, r.name, v.repeat.kind)).join('')}</select>`)}
          ${field('Estimated minutes', `<input class="input" type="number" inputmode="numeric" min="0" max="1440" name="duration" value="${esc(v.duration || '')}" placeholder="e.g. 30">`, { name: 'duration' })}
        </div>
        <div class="repeat-days" ${v.repeat.kind === 'custom' ? '' : 'hidden'}>${field('Repeat on', weekdayChips('repeatDays', v.repeat.days || []), { name: 'repeatDays' })}</div>
        <div class="grid-2">
          ${field('Goal', `<select class="input" name="goalId">${goalOptions(s, v.goalId || '')}</select>`)}
          ${field('XP reward', `<input class="input" type="number" inputmode="numeric" min="0" max="1000" name="xp" value="${esc(v.xp)}">`, { name: 'xp', hint: 'Set by difficulty; adjust if you like.' })}
        </div>
        ${t ? field('Status', `<select class="input" name="status">${STATUSES.map((st) => opt(st.id, st.name, v.status)).join('')}</select>`, { hint: t.status === 'completed' ? 'XP already earned stays as awarded if you edit the reward.' : '' }) : ''}
        ${field('Description', `<textarea class="input" name="description" rows="2" maxlength="1000">${esc(v.description)}</textarea>`)}
        ${field('Subtasks', `<textarea class="input" name="subtasks" rows="3" maxlength="2000" placeholder="One per line">${esc(v.subtasks.map((st) => st.title).join('\n'))}</textarea>`, { hint: 'One subtask per line.' })}
        ${field('Notes', `<textarea class="input" name="notes" rows="2" maxlength="2000">${esc(v.notes)}</textarea>`)}
      </details>
      <div class="sheet-actions sticky">
        <button type="button" class="btn ghost" data-dismiss>Cancel</button>
        <button type="submit" class="btn primary">${t ? 'Save changes' : 'Add mission'}</button>
      </div>
    </form>`,
  });

  const form = sheet.el.querySelector('form');
  const xpInput = form.elements.xp;
  let xpTouched = Boolean(t) && t.xp !== x[t.difficulty];
  xpInput.addEventListener('input', () => { xpTouched = true; });
  form.querySelectorAll('[name=difficulty]').forEach((r) => r.addEventListener('change', () => { if (!xpTouched) xpInput.value = x[r.value]; }));
  const dateInput = form.querySelector('.when-date');
  form.querySelectorAll('[name=when]').forEach((r) => r.addEventListener('change', () => {
    dateInput.hidden = r.value !== 'date';
    if (r.value === 'date') { if (!dateInput.value) dateInput.value = tomorrow; dateInput.focus(); }
  }));
  form.elements.repeat.addEventListener('change', (e) => { form.querySelector('.repeat-days').hidden = e.target.value !== 'custom'; });

  onSubmit(form, (fd) => {
    const title = String(fd.get('title') || '').trim();
    const repeatKind = fd.get('repeat');
    const repeatDays = fd.getAll('repeatDays').map(Number);
    const whenVal = fd.get('when');
    const dueDate = whenVal === 'today' ? today : whenVal === 'tomorrow' ? tomorrow : whenVal === 'none' ? '' : String(fd.get('dueDate') || '');
    const errors = {};
    if (!title) errors.title = 'Give your mission a name.';
    if (dueDate && !isDayKey(dueDate)) errors.dueDate = 'Enter a valid date.';
    if (whenVal === 'date' && !dueDate) errors.dueDate = 'Pick a date.';
    if (repeatKind !== 'none' && !dueDate) errors.dueDate = 'Repeating missions need a start date.';
    if (repeatKind === 'custom' && !repeatDays.length) errors.repeatDays = 'Pick at least one day.';
    if (fd.get('duration') !== '' && !intIn(fd.get('duration'), 0, 1440)) errors.duration = 'Use 0–1440 minutes.';
    if (!intIn(fd.get('xp'), 0, 1000)) errors.xp = 'Use a whole number from 0 to 1000.';
    if (!showErrors(form, errors)) return;

    const oldSubs = t?.subtasks || [];
    const subtasks = String(fd.get('subtasks') || '').split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 30)
      .map((title2) => oldSubs.find((o) => o.title === title2) || { id: uid(), title: title2.slice(0, 120), done: false });
    const fields = {
      title, description: String(fd.get('description') || '').trim(), category: fd.get('category'), goalId: fd.get('goalId') || null,
      priority: fd.get('priority'), difficulty: fd.get('difficulty'), xp: Number(fd.get('xp')), dueDate, dueTime: fd.get('dueTime') || '',
      duration: Number(fd.get('duration') || 0), repeat: { kind: repeatKind, days: repeatKind === 'custom' ? repeatDays : [] },
      notes: String(fd.get('notes') || '').trim(), subtasks,
    };
    if (t) {
      store.updateTask(t.id, { ...fields, status: fd.get('status') || t.status });
      toast('Mission updated');
    } else {
      store.addTask(fields);
      toast('Mission added');
    }
    sheet.close();
  });
}

// ---------- Habit form ----------

export function openHabitForm(habitId = null) {
  const s = store.getState();
  const h = habitId ? s.habits.find((x) => x.id === habitId) : null;
  const v = h || { name: '', type: 'build', freq: 'daily', days: [1, 2, 3, 4, 5], weeklyTarget: 3, unit: '', target: 1, xp: s.settings.xp.habitTarget, category: 'health', goalId: '', reminder: '', notes: '' };
  const sheet = openSheet({
    title: h ? 'Edit habit' : 'New habit',
    body: `<form class="form" novalidate>
      ${field('Habit', `<input class="input lg" name="name" maxlength="80" required autofocus value="${esc(v.name)}" placeholder="e.g. Drink water" autocomplete="off">`, { name: 'name' })}
      <fieldset class="field"><legend>Type</legend><div class="segmented two" role="radiogroup">
        <label><input type="radio" name="type" value="build" ${v.type === 'build' ? 'checked' : ''}><span>Build a habit</span></label>
        <label><input type="radio" name="type" value="avoid" ${v.type === 'avoid' ? 'checked' : ''}><span>Avoid something</span></label>
      </div></fieldset>
      <div class="grid-2">
        ${field('Schedule', `<select class="input" name="freq">${opt('daily', 'Every day', v.freq)}${opt('days', 'Selected days', v.freq)}${opt('weekly', 'Times per week', v.freq)}</select>`)}
        <div class="weekly-target" ${v.freq === 'weekly' ? '' : 'hidden'}>${field('Days per week', `<input class="input" type="number" min="1" max="7" name="weeklyTarget" value="${esc(v.weeklyTarget)}">`, { name: 'weeklyTarget' })}</div>
      </div>
      <div class="habit-days" ${v.freq === 'days' ? '' : 'hidden'}>${field('On these days', weekdayChips('days', v.days || []), { name: 'days' })}</div>
      <div class="grid-2 build-only" ${v.type === 'avoid' ? 'hidden' : ''}>
        ${field('Daily target', `<input class="input" type="number" min="1" max="100000" name="target" value="${esc(v.target)}">`, { name: 'target', hint: 'Use 1 for a simple done / not done.' })}
        ${field('Unit <em>(optional)</em>', `<input class="input" name="unit" maxlength="20" value="${esc(v.unit)}" placeholder="glasses, minutes, pages">`)}
      </div>
      <div class="grid-2">
        ${field('XP when target met', `<input class="input" type="number" min="0" max="1000" name="xp" value="${esc(v.xp)}">`, { name: 'xp' })}
        ${field('Category', `<select class="input" name="category">${categoryOptions(s, v.category)}</select>`)}
        ${field('Goal', `<select class="input" name="goalId">${goalOptions(s, v.goalId || '')}</select>`)}
        ${field('Reminder <em>(optional)</em>', `<input class="input" type="time" name="reminder" value="${esc(v.reminder || '')}">`, { hint: 'Shown as a browser notification while the app is open, if enabled in Settings.' })}
      </div>
      ${field('Notes', `<textarea class="input" name="notes" rows="2" maxlength="1000">${esc(v.notes)}</textarea>`)}
      <div class="sheet-actions sticky">
        <button type="button" class="btn ghost" data-dismiss>Cancel</button>
        <button type="submit" class="btn primary">${h ? 'Save habit' : 'Add habit'}</button>
      </div>
    </form>`,
  });
  const form = sheet.el.querySelector('form');
  form.elements.freq.addEventListener('change', (e) => {
    form.querySelector('.habit-days').hidden = e.target.value !== 'days';
    form.querySelector('.weekly-target').hidden = e.target.value !== 'weekly';
  });
  form.querySelectorAll('[name=type]').forEach((r) => r.addEventListener('change', () => { form.querySelector('.build-only').hidden = form.elements.type.value === 'avoid'; }));
  onSubmit(form, (fd) => {
    const name = String(fd.get('name') || '').trim();
    const freq = fd.get('freq');
    const days = fd.getAll('days').map(Number);
    const type = fd.get('type');
    const errors = {};
    if (!name) errors.name = 'Name your habit.';
    if (freq === 'days' && !days.length) errors.days = 'Pick at least one day.';
    if (freq === 'weekly' && !intIn(fd.get('weeklyTarget'), 1, 7)) errors.weeklyTarget = 'Use 1–7.';
    if (type === 'build' && !intIn(fd.get('target'), 1, 100000)) errors.target = 'Use a whole number of at least 1.';
    if (!intIn(fd.get('xp'), 0, 1000)) errors.xp = 'Use 0–1000.';
    if (!showErrors(form, errors)) return;
    const fields = {
      name, type, freq, days: freq === 'days' ? days : (v.days || []), weeklyTarget: Number(fd.get('weeklyTarget') || v.weeklyTarget || 3),
      target: type === 'avoid' ? 1 : Number(fd.get('target')), unit: type === 'avoid' ? '' : String(fd.get('unit') || '').trim(),
      xp: Number(fd.get('xp')), category: fd.get('category'), goalId: fd.get('goalId') || null, reminder: fd.get('reminder') || '',
      notes: String(fd.get('notes') || '').trim(),
    };
    if (h) { store.updateHabit(h.id, fields); toast('Habit updated'); } else { store.addHabit(fields); toast('Habit added'); }
    sheet.close();
  });
}

/** Quick “log a healthy habit” sheet listing today's habits. */
export function openHabitLog() {
  const render = () => {
    const s = store.getState();
    const today = store.today();
    const habits = habitsDueToday(s, today);
    if (!habits.length) return `<div class="empty small"><p>No habits scheduled today.</p><button class="btn primary" data-action="new-habit">${icon('plus', 18)} Create a habit</button></div>`;
    return `<ul class="habit-quick">${habits.map((h) => {
      const val = habitValue(s, h.id, today);
      const met = habitMet(s, h, today);
      const tgt = dailyTarget(h);
      return `<li class="${met ? 'met' : ''}"><span class="hq-name">${esc(h.name)}<small>${h.type === 'avoid' ? (met ? 'Stayed clear today' : 'Tap when you stayed clear today') : `${val}/${tgt} ${esc(h.unit)}`}</small></span>
        ${tgt > 1 ? `<button class="icon-btn" data-action="habit-step" data-id="${h.id}" data-delta="-1" aria-label="Decrease ${esc(h.name)}" ${val <= 0 ? 'disabled' : ''}>${icon('minus', 18)}</button>
          <button class="icon-btn" data-action="habit-step" data-id="${h.id}" data-delta="1" aria-label="Increase ${esc(h.name)}">${icon('plus', 18)}</button>` : ''}
        <button class="check ${met ? 'on' : ''}" data-action="habit-toggle" data-id="${h.id}" aria-pressed="${met}" aria-label="${met ? 'Undo' : 'Complete'} ${esc(h.name)}">${icon('check', 18)}</button></li>`;
    }).join('')}</ul>`;
  };
  const sheet = openSheet({ title: 'Log a habit', body: `<div data-live>${render()}</div>` });
  const unsub = store.subscribe(() => { const el = sheet.el.querySelector('[data-live]'); if (el) el.innerHTML = render(); });
  const obs = new MutationObserver(() => { if (!document.contains(sheet.el)) { unsub(); obs.disconnect(); } });
  obs.observe(document.getElementById('overlay-root'), { childList: true });
}

// ---------- Goal form ----------

export function openGoalForm(goalId = null) {
  const s = store.getState();
  const g = goalId ? s.goals.find((x) => x.id === goalId) : null;
  const v = g || { title: '', description: '', reason: '', category: 'personal', targetDate: '', priority: 'medium', status: 'active', numeric: null, milestones: [] };
  const sheet = openSheet({
    title: g ? 'Edit goal' : 'New goal',
    body: `<form class="form" novalidate>
      ${field('Goal', `<input class="input lg" name="title" maxlength="120" required autofocus value="${esc(v.title)}" placeholder="e.g. Build a consistent fitness routine" autocomplete="off">`, { name: 'title' })}
      ${field('Why it matters to you', `<textarea class="input" name="reason" rows="2" maxlength="500" placeholder="Your personal reason">${esc(v.reason)}</textarea>`)}
      <div class="grid-2">
        ${field('Category', `<select class="input" name="category">${categoryOptions(s, v.category)}</select>`)}
        ${field('Priority', `<select class="input" name="priority">${PRIORITIES.map((p) => opt(p.id, p.name, v.priority)).join('')}</select>`)}
        ${field('Target date', `<input class="input" type="date" name="targetDate" value="${esc(v.targetDate)}">`, { name: 'targetDate' })}
        ${field('Status', `<select class="input" name="status">${opt('active', 'Active', v.status)}${opt('paused', 'Paused', v.status)}${opt('completed', 'Completed', v.status)}${opt('abandoned', 'Let go', v.status)}</select>`)}
      </div>
      ${!g ? field('Milestones <em>(optional)</em>', `<textarea class="input" name="milestones" rows="3" maxlength="2000" placeholder="One per line"></textarea>`, { hint: 'Break the goal into smaller steps. You can add more later.' }) : ''}
      <details class="more" ${v.numeric ? 'open' : ''}><summary>${icon('chevronDown', 16)} Numeric target &amp; description</summary>
        <div class="grid-3">
          ${field('Target', `<input class="input" type="number" min="0" step="any" name="numTarget" value="${esc(v.numeric?.target ?? '')}" placeholder="e.g. 50000">`, { name: 'numTarget' })}
          ${field('Current', `<input class="input" type="number" min="0" step="any" name="numCurrent" value="${esc(v.numeric?.current ?? '')}">`, { name: 'numCurrent' })}
          ${field('Unit', `<input class="input" name="numUnit" maxlength="20" value="${esc(v.numeric?.unit ?? '')}" placeholder="₹, km, books">`)}
        </div>
        ${field('Description', `<textarea class="input" name="description" rows="2" maxlength="1000">${esc(v.description)}</textarea>`)}
      </details>
      <div class="sheet-actions sticky">
        <button type="button" class="btn ghost" data-dismiss>Cancel</button>
        <button type="submit" class="btn primary">${g ? 'Save goal' : 'Add goal'}</button>
      </div>
    </form>`,
  });
  const form = sheet.el.querySelector('form');
  onSubmit(form, (fd) => {
    const title = String(fd.get('title') || '').trim();
    const errors = {};
    if (!title) errors.title = 'Name your goal.';
    const tgt = num(fd.get('numTarget')), cur = num(fd.get('numCurrent'));
    if (tgt != null && (!Number.isFinite(tgt) || tgt <= 0)) errors.numTarget = 'Use a number above 0.';
    if (cur != null && (!Number.isFinite(cur) || cur < 0)) errors.numCurrent = 'Use 0 or more.';
    if (cur != null && tgt == null) errors.numTarget = 'Add a target for this value.';
    const td = String(fd.get('targetDate') || '');
    if (td && !isDayKey(td)) errors.targetDate = 'Enter a valid date.';
    if (!showErrors(form, errors)) return;
    const fields = {
      title, reason: String(fd.get('reason') || '').trim(), description: String(fd.get('description') || '').trim(),
      category: fd.get('category'), priority: fd.get('priority'), targetDate: td, status: fd.get('status'),
      numeric: tgt != null ? { target: tgt, current: cur || 0, unit: String(fd.get('numUnit') || '').trim() } : null,
    };
    if (g) { store.updateGoal(g.id, fields); toast('Goal updated'); }
    else {
      const { status, ...rest } = fields;
      const id = store.addGoal(rest);
      if (status !== 'active') store.setGoalStatus(id, status);
      String(fd.get('milestones') || '').split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 20).forEach((m) => store.addMilestone(id, m));
      toast('Goal added');
    }
    sheet.close();
  });
}

// ---------- Sales ----------

export function openSalesEntry(day = null) {
  const s = store.getState();
  const today = store.today();
  const d = day || today;
  const e = entryOn(s, d) || {};
  const cur = s.settings.currency;
  const sheet = openSheet({
    title: 'Log sales activity',
    body: `<form class="form" novalidate>
      ${field('Date', `<input class="input" type="date" name="day" value="${esc(d)}" max="${today}" required>`, { name: 'day', hint: 'One entry per day — saving replaces that day’s numbers.' })}
      ${field(`Revenue closed (${esc(cur)})`, `<input class="input lg" type="number" inputmode="decimal" min="0" step="any" name="amount" value="${esc(e.amount ?? '')}" placeholder="0" autofocus>`, { name: 'amount' })}
      <div class="grid-2">
        ${field('Deals closed', `<input class="input" type="number" inputmode="numeric" min="0" name="deals" value="${esc(e.deals ?? '')}" placeholder="0">`, { name: 'deals' })}
        ${field('Leads contacted', `<input class="input" type="number" inputmode="numeric" min="0" name="leads" value="${esc(e.leads ?? '')}" placeholder="0">`, { name: 'leads' })}
        ${field('Follow-ups done', `<input class="input" type="number" inputmode="numeric" min="0" name="followUps" value="${esc(e.followUps ?? '')}" placeholder="0">`, { name: 'followUps' })}
        ${field('Meetings booked', `<input class="input" type="number" inputmode="numeric" min="0" name="meetings" value="${esc(e.meetings ?? '')}" placeholder="0">`, { name: 'meetings' })}
      </div>
      ${field('Note <em>(optional)</em>', `<input class="input" name="note" maxlength="500" value="${esc(e.note || '')}">`)}
      <div class="sheet-actions sticky">
        <button type="button" class="btn ghost" data-dismiss>Cancel</button>
        <button type="submit" class="btn primary">Save</button>
      </div>
    </form>`,
  });
  const form = sheet.el.querySelector('form');
  form.elements.day.addEventListener('change', (ev) => {
    const ex = entryOn(store.getState(), ev.target.value) || {};
    for (const k of ['amount', 'deals', 'leads', 'followUps', 'meetings']) form.elements[k].value = ex[k] ?? '';
    form.elements.note.value = ex.note || '';
  });
  onSubmit(form, (fd) => {
    const errors = {};
    const day2 = String(fd.get('day') || '');
    if (!isDayKey(day2)) errors.day = 'Enter a valid date.';
    else if (day2 > today) errors.day = 'You can’t log future sales.';
    const amount = num(fd.get('amount'));
    if (amount != null && (!Number.isFinite(amount) || amount < 0)) errors.amount = 'Use 0 or more.';
    for (const k of ['deals', 'leads', 'followUps', 'meetings']) if (fd.get(k) !== '' && !intIn(fd.get(k), 0, 100000)) errors[k] = 'Use a whole number.';
    const vals = ['amount', 'deals', 'leads', 'followUps', 'meetings'].map((k) => num(fd.get(k)) || 0);
    if (!errors.day && vals.every((x) => x === 0) && !String(fd.get('note') || '').trim()) errors.amount = 'Enter at least one number.';
    if (!showErrors(form, errors)) return;
    store.saveSalesEntry({ day: day2, amount: amount || 0, deals: fd.get('deals'), leads: fd.get('leads'), followUps: fd.get('followUps'), meetings: fd.get('meetings'), note: fd.get('note') });
    toast(`Sales saved for ${fmtDay(day2)}`);
    sheet.close();
  });
}

export function openTargetForm(mk = null) {
  const s = store.getState();
  const m = mk || monthOf(store.today());
  const sheet = openSheet({
    title: 'Monthly sales target',
    size: 'small',
    body: `<form class="form" novalidate>
      ${field('Month', `<input class="input" type="month" name="month" value="${esc(m)}" required>`, { name: 'month' })}
      ${field(`Target (${esc(s.settings.currency)})`, `<input class="input lg" type="number" inputmode="decimal" min="0" step="any" name="target" value="${esc(s.sales.targets[m] ?? '')}" autofocus>`, { name: 'target', hint: 'Set 0 to remove the target.' })}
      <div class="sheet-actions"><button type="button" class="btn ghost" data-dismiss>Cancel</button><button type="submit" class="btn primary">Save target</button></div>
    </form>`,
  });
  const form = sheet.el.querySelector('form');
  form.elements.month.addEventListener('change', (e) => { form.elements.target.value = store.getState().sales.targets[e.target.value] ?? ''; });
  onSubmit(form, (fd) => {
    const month = String(fd.get('month') || '');
    const target = num(fd.get('target'));
    const errors = {};
    if (!/^\d{4}-\d{2}$/.test(month)) errors.month = 'Pick a month.';
    if (target == null || !Number.isFinite(target) || target < 0) errors.target = 'Enter 0 or more.';
    if (!showErrors(form, errors)) return;
    store.setSalesTarget(month, target);
    toast(target > 0 ? 'Target saved' : 'Target removed');
    sheet.close();
  });
}

// ---------- Quotes ----------

export function openQuoteForm() {
  const sheet = openSheet({
    title: 'Add your own quote',
    size: 'small',
    body: `<form class="form" novalidate>
      ${field('Quote or affirmation', `<textarea class="input" name="text" rows="3" maxlength="300" required autofocus></textarea>`, { name: 'text' })}
      ${field('Author <em>(optional)</em>', `<input class="input" name="author" maxlength="80">`, { hint: 'Only add an author if you’re sure of the source.' })}
      <div class="sheet-actions"><button type="button" class="btn ghost" data-dismiss>Cancel</button><button type="submit" class="btn primary">Save</button></div>
    </form>`,
  });
  const form = sheet.el.querySelector('form');
  onSubmit(form, (fd) => {
    const text = String(fd.get('text') || '').trim();
    if (!showErrors(form, text ? {} : { text: 'Write something.' })) return;
    store.addCustomQuote(text, String(fd.get('author') || '').trim());
    toast('Quote saved');
    sheet.close();
  });
}

