// Reusable HTML fragments.
import { esc, initials, fmtNum } from './util.js';
import { icon } from './icons.js';
import { categoryById, dueLabel, isOverdue } from './tasks.js';
import { relDay, fmtTime } from './dates.js';
import { PRIORITIES } from './defaults.js';
import { habitValue, dailyTarget, habitStreak } from './habits.js';

export function progress(pctValue, { cls = '', label = '' } = {}) {
  const p = Math.max(0, Math.min(100, pctValue || 0));
  return `<div class="progress ${cls}" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(p)}" ${label ? `aria-label="${esc(label)}"` : ''}><div style="width:${p}%"></div></div>`;
}

export function avatar(profile, size = 48) {
  return `<span class="avatar" style="--av:${esc(profile.avatarColor || '#8b5cf6')};width:${size}px;height:${size}px;font-size:${Math.round(size * 0.38)}px" aria-hidden="true">${esc(initials(profile.name))}</span>`;
}

export function catChip(state, id) {
  const c = categoryById(state, id);
  return `<span class="chip" style="--c:${c.color}"><i class="dot"></i>${esc(c.name)}</span>`;
}

export function priorityBadge(p) {
  if (p === 'medium' || p === 'low') return '';
  const name = PRIORITIES.find((x) => x.id === p)?.name || p;
  return `<span class="badge pri-${p}">${esc(name)}</span>`;
}

export function empty({ icon: ic = 'sparkles', title, text = '', action = '' }) {
  return `<div class="empty"><span class="empty-icon">${icon(ic, 24)}</span><h3>${esc(title)}</h3>${text ? `<p>${esc(text)}</p>` : ''}${action}</div>`;
}

export function stat(label, value, { sub = '', ic = '', tone = '' } = {}) {
  return `<div class="stat ${tone}">${ic ? `<span class="stat-ic">${icon(ic, 18)}</span>` : ''}<div><span class="stat-label">${esc(label)}</span><strong class="stat-value">${value}</strong>${sub ? `<span class="stat-sub">${sub}</span>` : ''}</div></div>`;
}

export function sectionHead(title, right = '', id = '') {
  return `<div class="section-head"><h2 ${id ? `id="${id}"` : ''}>${esc(title)}</h2>${right}</div>`;
}

/** A mission row: one-tap completion, minimal details. Tap the title for everything else. */
export function taskRow(state, t, today, { justDone = null } = {}) {
  const done = t.status === 'completed';
  const skipped = t.status === 'skipped';
  const overdue = isOverdue(t, today);
  const due = dueLabel(t, today);
  const c = categoryById(state, t.category);
  const meta = [
    `<span class="meta"><i class="dot" style="background:${c.color}"></i>${esc(c.name)}</span>`,
    due ? `<span class="meta ${overdue ? 'warn' : ''}">${esc(due)}</span>` : t.dueDate && t.dueDate !== today ? `<span class="meta">${esc(relDay(t.dueDate, today))}</span>` : '',
    t.dueTime ? `<span class="meta">${esc(fmtTime(t.dueTime))}</span>` : '',
    t.repeat.kind !== 'none' ? `<span class="meta" title="Repeats">${icon('repeat', 13)}<span class="sr-only">Repeats</span></span>` : '',
    priorityBadge(t.priority),
    t.status === 'in_progress' ? '<span class="meta accent">In progress</span>' : '',
    skipped ? '<span class="meta">Skipped</span>' : '',
    t.isSample ? '<span class="meta example">Example</span>' : '',
  ].filter(Boolean).join('<span class="sep" aria-hidden="true">·</span>');

  return `<li class="task ${done ? 'done' : ''} ${skipped ? 'skipped' : ''} ${justDone === t.id ? 'just-done' : ''}" data-task="${t.id}">
    <button class="check ${done ? 'on' : ''}" data-action="task-toggle" data-id="${t.id}" aria-pressed="${done}" ${skipped ? 'disabled' : ''}
      aria-label="${done ? 'Mark not done' : 'Complete'}: ${esc(t.title)} (${t.xp} XP)">${icon('check', 18)}</button>
    <button class="task-main" data-action="task-open" data-id="${t.id}" aria-label="${esc(t.title)} — details">
      <span class="task-title">${esc(t.title)}</span>
      <span class="task-meta">${meta}</span>
    </button>
    <span class="xp-pill ${done ? 'earned' : ''}" title="${done ? 'XP earned' : 'XP reward'}">${fmtNum(t.xp)} XP</span>
  </li>`;
}

/** A habit row: one tap to check in (or +1 for counted habits). Tap the name for details. */
export function habitRow(state, h, today, { streak = null, due = true } = {}) {
  const val = habitValue(state, h.id, today);
  const tgt = dailyTarget(h);
  const met = val >= tgt;
  const counted = tgt > 1 && !met;
  const st = streak ?? habitStreak(state, h, today);
  const progressText = h.type === 'avoid' ? (met ? 'Stayed clear today' : 'Avoid') : tgt > 1 ? `${val}/${tgt} ${esc(h.unit)}` : met ? 'Done' : 'Not yet';
  return `<li class="task habit-row ${met ? 'done' : ''}">
    <button class="check round ${met ? 'on' : counted ? 'plus' : ''}" data-action="${counted ? 'habit-step' : 'habit-toggle'}" data-id="${h.id}" data-delta="1" aria-pressed="${met}"
      aria-label="${met ? 'Undo' : counted ? 'Add 1 to' : 'Complete'} ${esc(h.name)}">${counted ? icon('plus', 18) : icon('check', 18)}</button>
    <button class="task-main" data-action="habit-open" data-id="${h.id}" aria-label="${esc(h.name)} — details">
      <span class="task-title">${esc(h.name)}</span>
      <span class="task-meta"><span class="meta">${progressText}</span>${!due ? '<span class="sep" aria-hidden="true">·</span><span class="meta">Rest day</span>' : ''}${h.isSample ? '<span class="sep" aria-hidden="true">·</span><span class="meta example">Example</span>' : ''}</span>
    </button>
    <span class="streak-pill ${st.current ? 'on' : ''}" title="Current streak">${icon('flame', 13)}${st.current}</span>
  </li>`;
}


/** A collapsible card for secondary detail. */
export function disclosure(title, inner, { open = false, sub = '' } = {}) {
  return `<details class="card disclosure" ${open ? 'open' : ''}><summary><span class="disc-title">${esc(title)}${sub ? ` <span class="muted small">${sub}</span>` : ''}</span>${icon('chevronDown', 18)}</summary><div class="disclosure-body">${inner}</div></details>`;
}
