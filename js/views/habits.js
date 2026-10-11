import { pct } from '../util.js';
import { icon } from '../icons.js';
import { activeHabits, habitMet, scheduledOn, habitConsistency } from '../habits.js';
import { weekStart } from '../dates.js';
import { habitRow, empty } from '../components.js';

export function render({ state, today }) {
  const habits = activeHabits(state);
  const week = habitConsistency(state, weekStart(today), today);
  const doneToday = habits.filter((h) => habitMet(state, h, today)).length;
  return `
  <header class="page-head">
    <div><h1 class="page-title">Habits</h1>
      ${habits.length ? `<p class="muted small">${doneToday} of ${habits.length} done today${week ? ` · ${pct(week.met, week.scheduled)}% this week` : ''}</p>` : ''}</div>
    <button class="btn primary sm" data-action="new-habit">${icon('plus', 16)} New</button>
  </header>
  ${habits.length ? `<section class="card flush"><ul class="task-list">
      ${habits.map((h) => habitRow(state, h, today, { due: h.freq === 'weekly' || scheduledOn(h, today) })).join('')}
    </ul></section>
    <p class="muted small center page-hint">Tap a habit for its history, streaks and settings. Missed days are information, not failure.</p>`
    : empty({ icon: 'repeat', title: 'No habits yet', text: 'Start with one small habit you can do even on a busy day.', action: `<button class="btn primary" data-action="new-habit">${icon('plus', 18)} Create a habit</button>` })}`;
}
