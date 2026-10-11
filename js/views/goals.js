import { esc } from '../util.js';
import { icon } from '../icons.js';
import { goalProgress, goalTimeLeft } from '../goals.js';
import { categoryById } from '../tasks.js';
import { progress, empty } from '../components.js';

function goalCard(state, g, today) {
  const p = goalProgress(state, g);
  const c = categoryById(state, g.category);
  const next = (g.milestones || []).find((m) => !m.done);
  const left = goalTimeLeft(g, today);
  const sub = [
    `<i class="dot" style="background:${c.color}"></i>${esc(c.name)}`,
    g.status === 'paused' ? 'Paused' : g.status === 'completed' ? 'Completed' : g.status === 'abandoned' ? 'Let go' : '',
    g.milestones.length ? `${p.milestonesDone}/${p.milestones} milestones` : '',
    g.status === 'active' && left != null ? (left >= 0 ? `${left} days left` : 'Past target date') : '',
  ].filter(Boolean).join('<span class="sep" aria-hidden="true">·</span>');
  return `<li class="card goal ${g.status}">
    <button class="goal-open" data-action="goal-open" data-id="${g.id}">
      <span class="goal-title">${esc(g.title)}</span>
      <span class="task-meta"><span class="meta">${sub}</span></span>
    </button>
    <div class="meter">
      <div class="meter-head small"><span><strong>${p.pct}%</strong></span>${icon('chevronRight', 16)}</div>
      ${progress(p.pct, { cls: g.status === 'completed' ? 'ok' : 'xp', label: `${g.title} progress` })}
    </div>
    ${g.status === 'active' ? (next ? `<div class="next-ms">
        <button class="check sm" data-action="ms-toggle" data-goal="${g.id}" data-id="${next.id}" aria-pressed="false" aria-label="Complete milestone ${esc(next.title)}">${icon('check', 14)}</button>
        <span><span class="muted small">Next:</span> ${esc(next.title)}</span></div>`
      : p.milestones && p.pct >= 100 ? `<button class="text-btn" data-action="goal-status" data-id="${g.id}" data-status="completed">${icon('trophy', 14)} All milestones done — mark goal complete</button>`
      : `<button class="text-btn" data-action="goal-open" data-id="${g.id}">${icon('plus', 14)} Add a milestone</button>`) : ''}
  </li>`;
}

export function render({ state, today, ui }) {
  const f = ui.goalFilter || 'active';
  const goals = state.goals.filter((g) => (f === 'active' ? g.status === 'active' || g.status === 'paused' : g.status !== 'active' && g.status !== 'paused'));
  const doneCount = state.goals.length - state.goals.filter((g) => g.status === 'active' || g.status === 'paused').length;
  return `
  <header class="page-head">
    <div><h1 class="page-title">Goals</h1><p class="muted small">Tap a goal for milestones, linked missions and actions.</p></div>
    <button class="btn primary sm" data-action="new-goal">${icon('plus', 16)} New</button>
  </header>
  ${doneCount ? `<div class="segmented two compact" role="group" aria-label="Show goals">
      ${[['active', 'In progress'], ['done', `Finished (${doneCount})`]].map(([id, n]) => `<button class="seg ${f === id ? 'on' : ''}" aria-pressed="${f === id}" data-action="set-ui" data-key="goalFilter" data-value="${id}">${n}</button>`).join('')}
    </div>` : ''}
  ${goals.length ? `<ul class="goal-grid">${goals.map((g) => goalCard(state, g, today)).join('')}</ul>`
    : empty({ icon: 'flag', title: f === 'done' ? 'No finished goals yet' : 'No goals yet', text: 'A goal can be anything you want to grow toward. Milestones make it concrete.', action: `<button class="btn primary" data-action="new-goal">${icon('plus', 18)} Add a goal</button>` })}`;
}
