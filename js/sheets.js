// Detail sheets that keep secondary information one tap away:
// quick add, habit details and goal details. They re-render live as data changes.
import * as store from './store.js';
import { openSheet, toast } from './ui.js';
import { esc, fmtNum, plural } from './util.js';
import { icon } from './icons.js';
import { openTaskForm } from './forms.js';
import { habitMet, habitValue, dailyTarget, habitStreak, scheduledOn, weekCount } from './habits.js';
import { goalProgress, goalTimeLeft } from './goals.js';
import { liveTasks } from './tasks.js';
import { addDays, fmtDay, weekday, WEEKDAYS } from './dates.js';
import { catChip, priorityBadge, progress } from './components.js';

/** Open a sheet whose body re-renders whenever the store changes. */
function liveSheet(title, renderBody, opts = {}) {
  const sheet = openSheet({ title, body: `<div data-live>${renderBody()}</div>`, ...opts });
  const unsub = store.subscribe(() => {
    const el = sheet.el.querySelector('[data-live]');
    if (!el) return;
    const html = renderBody();
    if (html == null) { sheet.close(); return; }
    el.innerHTML = html;
  });
  const obs = new MutationObserver(() => { if (!document.contains(sheet.el)) { unsub(); obs.disconnect(); } });
  obs.observe(document.getElementById('overlay-root'), { childList: true });
  return sheet;
}

// ---------- Quick add (the + button) ----------

export function openQuickAdd() {
  const xp = store.getState().settings.xp;
  const sheet = openSheet({
    title: 'Add',
    body: `<form class="quick-form" novalidate>
        <label class="sr-only" for="qa-title">New mission for today</label>
        <input id="qa-title" class="input lg" name="title" maxlength="120" placeholder="New mission for today…" autocomplete="off" autofocus>
        <button class="btn primary" type="submit">Add</button>
      </form>
      <p class="muted small qa-hint">Normal difficulty · ${xp.normal} XP · due today. <button type="button" class="text-btn" data-qa="more">More options</button></p>
      <div class="qa-grid">
        <button class="qa-btn" data-action="log-habit">${icon('repeat', 20)}<span>Log a habit</span></button>
        <button class="qa-btn" data-action="sales-log">${icon('trending', 20)}<span>Update sales</span></button>
        <button class="qa-btn" data-action="new-goal">${icon('flag', 20)}<span>Add a goal</span></button>
        <button class="qa-btn" data-action="focus-start">${icon('timer', 20)}<span>Focus session</span></button>
        <a class="qa-btn" href="#/plan">${icon('book', 20)}<span>Daily review</span></a>
        <button class="qa-btn" data-action="new-habit">${icon('plus', 20)}<span>New habit</span></button>
      </div>`,
  });
  const form = sheet.el.querySelector('form');
  const input = form.elements.title;
  let busy = false;
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = input.value.trim();
    if (!title) { input.focus(); input.setAttribute('aria-invalid', 'true'); return; }
    if (busy) return;
    busy = true;
    store.addTask({ title });
    toast(`Added “${title}” · ${xp.normal} XP`);
    sheet.close();
  });
  sheet.el.addEventListener('click', (e) => {
    if (e.target.closest('[data-qa=more]')) {
      const title = input.value.trim();
      sheet.close();
      setTimeout(() => openTaskForm(null, { title }), 170);
      return;
    }
    // Shortcut buttons: close this sheet, then the global handler opens the next one.
    if (e.target.closest('.qa-btn')) sheet.close();
  });
}

// ---------- Habit details ----------

function scheduleText(h) {
  if (h.freq === 'weekly') return `${h.weeklyTarget}× per week`;
  if (h.freq === 'days') return [1, 2, 3, 4, 5, 6, 0].filter((d) => h.days.includes(d)).map((d) => WEEKDAYS[d]).join(', ');
  return 'Every day';
}

export function openHabitDetail(id) {
  const first = store.getState().habits.find((x) => x.id === id);
  if (!first) return;
  liveSheet(first.name, () => {
    const s = store.getState();
    const h = s.habits.find((x) => x.id === id && !x.archived);
    if (!h) return null;
    const today = store.today();
    const val = habitValue(s, h.id, today);
    const tgt = dailyTarget(h);
    const met = habitMet(s, h, today);
    const st = habitStreak(s, h, today);
    const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
    const unit = st.unit === 'week' ? 'week' : 'day';
    return `<div class="detail">
      <div class="habit-today">
        ${tgt > 1 ? `<button class="icon-btn" data-action="habit-step" data-id="${h.id}" data-delta="-1" aria-label="Decrease" ${val <= 0 ? 'disabled' : ''}>${icon('minus', 18)}</button>
          <span class="habit-count" aria-live="polite"><strong>${val}</strong>/${tgt}<small>${esc(h.unit)}</small></span>
          <button class="icon-btn" data-action="habit-step" data-id="${h.id}" data-delta="1" aria-label="Increase">${icon('plus', 18)}</button>` : ''}
        <button class="btn ${met ? 'ghost' : 'primary'} grow" data-action="habit-toggle" data-id="${h.id}" aria-pressed="${met}">${icon('check', 18)} ${met ? 'Done today — undo' : h.type === 'avoid' ? 'I stayed clear today' : 'Mark done today'}</button>
      </div>
      <div class="kv-row">
        <div><span class="muted small">Streak</span><strong>${icon('flame', 14, 'flame')} ${plural(st.current, unit)}</strong></div>
        <div><span class="muted small">Best</span><strong>${plural(st.longest, unit)}</strong></div>
        ${h.freq === 'weekly' ? `<div><span class="muted small">This week</span><strong>${weekCount(s, h, today)}/${h.weeklyTarget}</strong></div>` : ''}
      </div>
      <p class="list-label">Last 7 days <span class="muted">· tap a day to fill in</span></p>
      <div class="week-dots" role="group" aria-label="Last 7 days">
        ${days.map((d) => {
          const m = habitMet(s, h, d);
          const sched = h.freq === 'weekly' || scheduledOn(h, d);
          return `<button class="wd ${m ? 'on' : ''} ${sched ? '' : 'rest'} ${d === today ? 'today' : ''}" data-action="habit-toggle" data-id="${h.id}" data-day="${d}" aria-pressed="${m}" aria-label="${esc(fmtDay(d))}: ${m ? 'done' : sched ? 'not done' : 'rest day'}"><span>${WEEKDAYS[weekday(d)][0]}</span></button>`;
        }).join('')}
      </div>
      <dl class="dl">
        <dt>Schedule</dt><dd>${esc(scheduleText(h))}${h.type === 'avoid' ? ' · avoiding' : ''}</dd>
        <dt>Reward</dt><dd>${h.xp} XP when the daily target is met</dd>
        <dt>Area</dt><dd>${catChip(s, h.category)}</dd>
        ${h.reminder ? `<dt>Reminder</dt><dd>${esc(h.reminder)}</dd>` : ''}
        ${h.notes ? `<dt>Notes</dt><dd>${esc(h.notes)}</dd>` : ''}
      </dl>
      <div class="grid-2">
        <button class="btn ghost" data-action="edit-habit" data-id="${h.id}" data-close-sheet>${icon('pencil', 16)} Edit</button>
        <button class="btn ghost danger-text" data-action="delete-habit" data-id="${h.id}">${icon('trash', 16)} Remove</button>
      </div>
    </div>`;
  });
}

// ---------- Goal details ----------

export function openGoalDetail(id) {
  const first = store.getState().goals.find((x) => x.id === id);
  if (!first) return;
  liveSheet(first.title, () => {
    const s = store.getState();
    const g = s.goals.find((x) => x.id === id);
    if (!g) return null;
    const today = store.today();
    const p = goalProgress(s, g);
    const left = goalTimeLeft(g, today);
    const open = liveTasks(s).filter((t) => t.goalId === g.id && t.status !== 'completed' && t.status !== 'skipped');
    const habits = s.habits.filter((h) => h.goalId === g.id && !h.archived);
    return `<div class="detail">
      <div class="task-meta">${catChip(s, g.category)}${priorityBadge(g.priority)}${g.status !== 'active' ? `<span class="badge ${g.status === 'completed' ? 'ok' : ''}">${{ paused: 'Paused', completed: 'Completed', abandoned: 'Let go' }[g.status]}</span>` : ''}</div>
      ${g.reason ? `<p class="goal-reason">${icon('heart', 14)} ${esc(g.reason)}</p>` : ''}
      ${g.description ? `<p class="muted small">${esc(g.description)}</p>` : ''}
      <div class="meter">
        <div class="meter-head"><span><strong>${p.pct}%</strong></span><span class="muted">${g.targetDate ? `${esc(fmtDay(g.targetDate, { day: 'numeric', month: 'short', year: 'numeric' }))}${g.status === 'active' && left != null ? ` · ${left >= 0 ? `${left} days left` : 'past target'}` : ''}` : 'No target date'}</span></div>
        ${progress(p.pct, { cls: g.status === 'completed' ? 'ok' : 'xp' })}
      </div>
      ${g.numeric && g.status === 'active' ? `<form class="inline-form" data-goal-value="${g.id}"><label class="small" for="gv-${g.id}">Current ${esc(g.numeric.unit || 'value')} (target ${fmtNum(g.numeric.target, 2)})</label><input id="gv-${g.id}" class="input sm" type="number" step="any" min="0" name="v" value="${esc(g.numeric.current)}"><button class="btn ghost sm">Update</button></form>` : ''}

      <p class="list-label">Milestones <span class="muted">· ${s.settings.xp.milestone} XP each</span></p>
      <div class="timeline">
        ${(g.milestones || []).map((m) => `<div class="tl-item ${m.done ? 'done' : ''}">
          <button class="check sm ${m.done ? 'on' : ''}" data-action="ms-toggle" data-goal="${g.id}" data-id="${m.id}" aria-pressed="${m.done}" aria-label="${m.done ? 'Reopen' : 'Complete'} milestone ${esc(m.title)}">${icon('check', 14)}</button>
          <span class="tl-title">${esc(m.title)}${m.doneDay ? `<small class="muted">Done ${esc(fmtDay(m.doneDay))}</small>` : ''}</span>
          <button class="icon-btn subtle sm" data-action="ms-delete" data-goal="${g.id}" data-id="${m.id}" aria-label="Delete milestone ${esc(m.title)}">${icon('x', 14)}</button>
        </div>`).join('')}
        ${g.status !== 'completed' ? `<form class="inline-form" data-add-ms="${g.id}"><label class="sr-only" for="ms-${g.id}">New milestone</label><input id="ms-${g.id}" class="input sm" name="title" maxlength="120" placeholder="Add a milestone"><button class="btn ghost sm" aria-label="Add milestone">${icon('plus', 16)}</button></form>` : ''}
      </div>

      <p class="list-label">Linked</p>
      <p class="small muted">${p.tasksDone}/${p.tasks} missions done${habits.length ? ` · Habits: ${habits.map((h) => esc(h.name)).join(', ')}` : ''}</p>
      ${open.length ? `<ul class="plain small">${open.map((t) => `<li><button class="link-btn" data-action="task-open" data-id="${t.id}">${esc(t.title)}</button></li>`).join('')}</ul>` : ''}

      <div class="grid-2 detail-actions">
        <button class="btn ghost" data-action="goal-add-task" data-id="${g.id}" data-close-sheet>${icon('plus', 16)} Add mission</button>
        ${g.status === 'active' ? `<button class="btn ghost" data-action="goal-status" data-id="${g.id}" data-status="completed">${icon('trophy', 16)} Mark complete</button>`
          : `<button class="btn ghost" data-action="goal-status" data-id="${g.id}" data-status="active">${icon('refresh', 16)} Reactivate</button>`}
        <button class="btn ghost" data-action="edit-goal" data-id="${g.id}" data-close-sheet>${icon('pencil', 16)} Edit</button>
        <button class="btn ghost danger-text" data-action="delete-goal" data-id="${g.id}">${icon('trash', 16)} Delete</button>
      </div>
    </div>`;
  });
}
