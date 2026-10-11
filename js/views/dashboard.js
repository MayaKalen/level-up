import { esc, fmtNum, plural } from '../util.js';
import { icon } from '../icons.js';
import { levelInfo, lifetimeXp, xpBetween } from '../xp.js';
import { streakInfo } from '../streaks.js';
import { taskSections, categoryById, sortTasks } from '../tasks.js';
import { habitsDueToday, habitMet } from '../habits.js';
import { activeGoals } from '../goals.js';
import { quoteById, personalise, practicalAction } from '../motivation.js';
import { CATEGORY_GROUPS, THEMES } from '../defaults.js';
import { taskRow, habitRow, progress, avatar } from '../components.js';
import { relDay, fmtDay, diffDays } from '../dates.js';
import { opt } from '../forms.js';
import { hasSamples } from '../store.js';

function greeting(state) {
  const h = new Date().getHours();
  const part = h < 5 ? 'Late night' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  return `${part}, ${state.profile.name.split(' ')[0]}`;
}

function heroCard(state, info, xpToday, xpTarget, streak) {
  return `<section class="card hero" aria-label="Your progress">
    <div class="hero-top">
      <a href="#/settings" class="char-avatar" aria-label="Edit profile">${avatar(state.profile, 52)}<span class="level-badge" aria-hidden="true">${info.level}</span></a>
      <div class="hero-id">
        <p class="hero-name">${esc(state.profile.name)}</p>
        <p class="muted small">Level ${info.level} · ${esc(info.rank)}</p>
      </div>
      <div class="hero-streak ${streak.current ? 'on' : ''}" title="Daily streak">${icon('flame', 18)}<strong>${streak.current}</strong><span class="sr-only">day streak</span></div>
    </div>
    <div class="meter">
      <div class="meter-head"><span>Today</span><span><strong>${fmtNum(xpToday)}</strong> / ${fmtNum(xpTarget)} XP</span></div>
      ${progress((xpToday / Math.max(1, xpTarget)) * 100, { cls: xpToday >= xpTarget ? 'ok' : 'xp', label: 'Daily XP target progress' })}
    </div>
    <div class="meter">
      <div class="meter-head muted"><span>Level ${info.level + 1}</span><span>${fmtNum(info.toNext)} XP to go</span></div>
      ${progress(info.pct, { cls: 'xp thin', label: `Level progress ${Math.round(info.pct)}%` })}
    </div>
  </section>`;
}

export function motivationCard(state, today) {
  const cur = state.motivation.current;
  const q = cur ? quoteById(state, cur.id) : null;
  if (!q) {
    return `<section class="card quote-card"><p class="muted small">No message yet.</p><button class="btn ghost sm" data-action="quote-next">Show a message</button></section>`;
  }
  const fav = state.motivation.favorites.includes(q.id);
  const action = practicalAction(state, q, today);
  const themeName = THEMES.find((t) => t.id === q.theme)?.name || 'Your quote';
  return `<section class="card quote-card" aria-label="Today’s motivation">
    <p class="quote-text">“${esc(q.text)}”</p>
    <p class="quote-src">${q.author ? `— ${esc(q.author)}` : 'Original affirmation'} · ${esc(themeName)}</p>
    <p class="quote-why">${esc(personalise(state, q, today))}</p>
    <p class="quote-action">${icon('target', 15)}<span>${esc(action.text)}</span></p>
    <div class="quote-btns">
      <button class="text-btn" data-action="quote-next">${icon('refresh', 15)} Give me another</button>
      <button class="text-btn ${fav ? 'fav' : ''}" data-action="quote-fav" data-id="${q.id}" aria-pressed="${fav}">${icon('star', 15)} ${fav ? 'Saved' : 'Favorite'}</button>
    </div>
  </section>`;
}

export function render({ state, today, ui }) {
  const info = levelInfo(lifetimeXp(state.ledger), state.settings.level);
  const xpToday = xpBetween(state.ledger, today, today);
  const streak = streakInfo(state, today);
  const sec = taskSections(state, today);
  const plan = state.plans[today] || {};
  const xpTarget = plan.xpTarget || state.settings.dailyXpTarget;
  const habits = habitsDueToday(state, today);
  const filter = ui.dashFilter || 'all';
  const tasks = sortTasks(sec.today.filter((t) => filter === 'all' || categoryById(state, t.category).group === filter), 'priority', state);
  const doneTasks = sec.today.filter((t) => t.status === 'completed').length;
  const doneHabits = habits.filter((h) => habitMet(state, h, today)).length;
  const total = sec.today.length + habits.length;
  const priorities = (plan.priorities || []).filter(Boolean);

  const upcoming = sec.upcoming.filter((t) => diffDays(today, t.dueDate) <= 7).sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 3);
  const goalsSoon = activeGoals(state).filter((g) => g.targetDate && diffDays(today, g.targetDate) >= 0 && diffDays(today, g.targetDate) <= 14).slice(0, 2);
  const showComing = sec.overdue.length || upcoming.length || goalsSoon.length;

  return `
  <header class="page-head">
    <div><p class="muted small">${esc(fmtDay(today, { weekday: 'long', day: 'numeric', month: 'long' }))}</p><h1 class="page-title">${esc(greeting(state))}</h1></div>
  </header>

  ${hasSamples() && !state.ui.hideSampleNote ? `<p class="note" role="note">${icon('info', 16)}<span>Items marked <em>Example</em> are starter samples.</span><button class="text-btn" data-action="remove-samples">Remove</button><button class="icon-btn subtle sm" data-action="hide-sample-note" aria-label="Dismiss">${icon('x', 14)}</button></p>` : ''}

  <div class="today-layout">
    <div class="today-hero">${heroCard(state, info, xpToday, xpTarget, streak)}</div>
    <div class="today-quote">${motivationCard(state, today)}</div>

    <div class="today-main">
      <section class="card today-card" aria-labelledby="today-h">
        <div class="section-head">
          <h2 id="today-h">Today <span class="muted count-text">${doneTasks + doneHabits} of ${total} done</span></h2>
          <label class="mini-select"><span class="sr-only">Filter missions by area</span><select data-ui-select="dashFilter">${CATEGORY_GROUPS.map((g) => opt(g.id, g.name, filter)).join('')}</select>${icon('chevronDown', 14)}</label>
        </div>
        ${priorities.length ? `<p class="focus-line">${icon('target', 15)}<span><strong>Focus:</strong> ${priorities.map(esc).join(' · ')}</span></p>` : ''}

        <h3 class="list-label">Missions</h3>
        ${tasks.length ? `<ul class="task-list">${tasks.map((t) => taskRow(state, t, today, { justDone: ui.justDone })).join('')}</ul>`
          : `<p class="muted small list-empty">${sec.today.length ? 'No missions in this area today.' : 'Nothing planned yet — add one small mission.'}</p>`}
        <button class="add-row" data-action="new-task">${icon('plus', 16)} Add mission</button>
        ${sec.today.length && doneTasks === sec.today.length ? `<p class="success-note">${icon('sparkles', 15)} All missions done${sec.today.length >= state.settings.xp.allDailyMinTasks ? ` · +${state.settings.xp.allDailyBonus} XP bonus` : ''}</p>` : ''}

        <h3 class="list-label">Habits</h3>
        ${habits.length ? `<ul class="task-list">${habits.map((h) => habitRow(state, h, today)).join('')}</ul>`
          : `<p class="muted small list-empty">No habits scheduled today. <a class="link" href="#/habits">Manage habits</a></p>`}
      </section>

      ${showComing ? `<section class="card" aria-labelledby="up-h">
        <h2 class="card-title" id="up-h">Coming up</h2>
        ${sec.overdue.length ? `<a class="overdue-note" href="#/missions" data-action="set-ui" data-key="missionTab" data-value="overdue">${icon('clock', 15)} ${plural(sec.overdue.length, 'mission')} from earlier still open</a>` : ''}
        ${upcoming.length || goalsSoon.length ? `<ul class="upcoming">
          ${upcoming.map((t) => `<li><span class="up-date">${esc(relDay(t.dueDate, today))}</span><button class="link-btn" data-action="task-open" data-id="${t.id}">${esc(t.title)}</button></li>`).join('')}
          ${goalsSoon.map((g) => `<li><span class="up-date">${esc(relDay(g.targetDate, today))}</span><button class="link-btn" data-action="goal-open" data-id="${g.id}">${icon('flag', 13)} ${esc(g.title)}</button></li>`).join('')}
        </ul>` : ''}
      </section>` : ''}
    </div>
  </div>`;
}
