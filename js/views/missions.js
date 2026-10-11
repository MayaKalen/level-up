import { esc } from '../util.js';
import { icon } from '../icons.js';
import { taskSections, sortTasks, allCategories, liveTasks } from '../tasks.js';
import { taskRow, empty } from '../components.js';
import { opt } from '../forms.js';

// Overdue and Anytime tabs only appear when they have something in them.
function tabsFor(sec) {
  return [
    ['today', 'Today', sec.today.length],
    ['upcoming', 'Upcoming', sec.upcoming.length],
    ...(sec.overdue.length ? [['overdue', 'Overdue', sec.overdue.length]] : []),
    ...(sec.anytime.length ? [['anytime', 'Anytime', sec.anytime.length]] : []),
    ['completed', 'Done', sec.completed.length + sec.skipped.length],
  ];
}

function listFor(state, today, ui) {
  const sec = taskSections(state, today);
  const q = (ui.search || '').trim().toLowerCase();
  let tab = ui.missionTab || 'today';
  if (!tabsFor(sec).some(([id]) => id === tab)) tab = 'today';
  // Searching looks across every mission, not just the current tab.
  let tasks = q ? liveTasks(state) : tab === 'completed' ? [...sec.completed, ...sec.skipped] : sec[tab] || [];
  if (q) tasks = tasks.filter((t) => `${t.title} ${t.description} ${t.notes}`.toLowerCase().includes(q));
  if (ui.missionCat && ui.missionCat !== 'all') tasks = tasks.filter((t) => t.category === ui.missionCat);
  const sorted = sortTasks(tasks, tab === 'completed' && !q ? 'completed' : ui.sort || 'priority', state, Boolean(q));
  return { tab, tasks: tab === 'completed' ? sorted.slice(0, 200) : sorted, q };
}

export function renderList({ state, today, ui }) {
  const { tab, tasks, q } = listFor(state, today, ui);
  if (!tasks.length) {
    const msgs = {
      today: ['No missions for today', 'Add something small you can finish today.'],
      upcoming: ['Nothing scheduled ahead', 'Missions with a future date show up here.'],
      overdue: ['All caught up', 'No open missions from earlier days.'],
      anytime: ['No undated missions', 'Missions without a date show up here.'],
      completed: ['Nothing finished yet', 'Completed missions and their history show here.'],
    };
    const [title, text] = q || (ui.missionCat && ui.missionCat !== 'all') ? ['No matches', 'Try a different search or area.'] : msgs[tab];
    return empty({ icon: 'list', title, text, action: tab === 'today' && !q ? `<button class="btn primary" data-action="new-task">${icon('plus', 18)} New mission</button>` : '' });
  }
  return `${q ? `<p class="muted small list-note">Results from all missions</p>` : ''}<ul class="task-list">${tasks.map((t) => taskRow(state, t, today, { justDone: ui.justDone })).join('')}</ul>`;
}

export function render(ctx) {
  const { state, today, ui } = ctx;
  const sec = taskSections(state, today);
  const tabs = tabsFor(sec);
  const { tab } = listFor(state, today, ui);
  const filtered = (ui.missionCat && ui.missionCat !== 'all') || (ui.sort && ui.sort !== 'priority');
  return `
  <header class="page-head">
    <div><h1 class="page-title">Missions</h1><p class="muted small">Tap a mission to edit, skip, duplicate or delete it.</p></div>
    <button class="btn primary sm" data-action="new-task">${icon('plus', 16)} New</button>
  </header>
  <div class="chip-tabs scroll" role="tablist" aria-label="Mission lists">
    ${tabs.map(([id, name, n]) => `<button role="tab" class="tab ${tab === id ? 'on' : ''}" aria-selected="${tab === id}" data-action="set-ui" data-key="missionTab" data-value="${id}">${name}<span class="count ${id === 'overdue' ? 'warn' : ''}">${n}</span></button>`).join('')}
  </div>
  <div class="toolbar">
    <label class="search"><span class="sr-only">Search all missions</span>${icon('search', 18)}<input class="input" type="search" data-mission-search placeholder="Search all missions" value="${esc(ui.search || '')}"></label>
    <button class="icon-btn ${filtered ? 'active' : ''}" data-action="toggle-filters" aria-expanded="${Boolean(ui.showFilters || filtered)}" aria-label="Filter and sort">${icon('sliders', 18)}</button>
  </div>
  ${ui.showFilters || filtered ? `<div class="filter-row">
    <label class="sel"><span class="sr-only">Area</span><select class="input" data-ui-select="missionCat">${opt('all', 'All areas', ui.missionCat)}${allCategories(state).map((c) => opt(c.id, c.name, ui.missionCat)).join('')}</select></label>
    <label class="sel"><span class="sr-only">Sort by</span><select class="input" data-ui-select="sort">${opt('priority', 'Sort: Priority', ui.sort)}${opt('due', 'Sort: Due date', ui.sort)}${opt('xp', 'Sort: XP', ui.sort)}${opt('category', 'Sort: Area', ui.sort)}</select></label>
  </div>` : ''}
  <section class="card flush" aria-live="polite" data-mission-list>${renderList(ctx)}</section>`;
}

export function bind(el, ctx, rerenderList) {
  el.querySelector('[data-mission-search]')?.addEventListener('input', (e) => { ctx.ui.search = e.target.value; rerenderList(); });
}
