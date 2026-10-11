import { esc, fmtNum, pct, plural, fmtMoney } from '../util.js';
import { icon } from '../icons.js';
import { xpByDay, xpBetween, lifetimeXp } from '../xp.js';
import { streakInfo, activityMap } from '../streaks.js';
import { habitConsistency, activeHabits, habitMet, scheduledOn, habitStart } from '../habits.js';
import { liveTasks, categoryById, taskSections, priorityRank } from '../tasks.js';
import { activeGoals, goalProgress } from '../goals.js';
import { monthSummary, salesHistory } from '../sales.js';
import { addDays, weekStart, monthOf, fmtDay, range, fmtMonth, diffDays } from '../dates.js';
import { barChart, hbars, heatmap } from '../charts.js';
import { stat, progress, empty, disclosure } from '../components.js';

function weeklyReview(state, today) {
  const ws = weekStart(today);
  const days = range(ws, today);
  const completed = state.tasks.filter((t) => t.status === 'completed' && t.completedDay >= ws && t.completedDay <= today);
  const xpWeek = xpBetween(state.ledger, ws, today);
  const milestones = state.goals.flatMap((g) => (g.milestones || []).filter((m) => m.done && m.doneDay >= ws).map((m) => ({ g, m })));
  const habitRates = activeHabits(state).map((h) => {
    const hs = habitStart(state, h) || today;
    const sched = days.filter((d) => d >= hs && (h.freq === 'weekly' || scheduledOn(h, d)));
    const met = days.filter((d) => habitMet(state, h, d)).length;
    const denom = h.freq === 'weekly' ? Math.max(1, h.weeklyTarget) : sched.length;
    return { h, met, denom, rate: denom ? Math.min(1, met / denom) : null };
  }).filter((r) => r.denom > 0);
  const maintained = habitRates.filter((r) => r.rate >= 0.7);
  const struggling = habitRates.filter((r) => r.rate < 0.5 && r.denom >= 3);
  const sec = taskSections(state, today);
  const goalsAtRisk = activeGoals(state).filter((g) => g.targetDate && diffDays(today, g.targetDate) <= 21 && goalProgress(state, g).pct < 70);
  const s = monthSummary(state, monthOf(today), today);

  const wins = [];
  if (completed.length) wins.push(`${plural(completed.length, 'mission')} completed (${fmtNum(xpWeek)} XP this week).`);
  if (maintained.length) wins.push(`Habits on track: ${maintained.map((r) => r.h.name).join(', ')}.`);
  if (milestones.length) wins.push(`Milestones reached: ${milestones.map(({ m }) => m.title).join(', ')}.`);
  if (s.target && s.pct >= 50) wins.push(`Sales at ${Math.floor(s.pct)}% of this month’s target.`);

  const attention = [];
  if (sec.overdue.length) attention.push(`${plural(sec.overdue.length, 'overdue mission')} — reschedule, skip or finish.`);
  for (const r of struggling.slice(0, 3)) attention.push(`“${r.h.name}” is at ${r.met}/${r.denom} this week. Consider an easier target.`);
  for (const g of goalsAtRisk.slice(0, 2)) attention.push(`“${g.title}” is ${goalProgress(state, g).pct}% done with a target date ${fmtDay(g.targetDate)}.`);
  if (s.target && s.pct < 100 && s.perDayNeeded) attention.push(`Sales: ${fmtMoney(s.remaining, state.settings.currency)} to target this month.`);

  const suggestions = [];
  const overdueTop = [...sec.overdue].sort((a, b) => priorityRank(b.priority) - priorityRank(a.priority))[0];
  if (overdueTop) suggestions.push(`Clear or reschedule “${overdueTop.title}”.`);
  const nextImportant = sec.upcoming.filter((t) => diffDays(today, t.dueDate) <= 7 && priorityRank(t.priority) >= 2).sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
  if (nextImportant) suggestions.push(`Prepare for “${nextImportant.title}” (due ${fmtDay(nextImportant.dueDate)}).`);
  const nearGoal = [...activeGoals(state)].filter((g) => g.targetDate).sort((a, b) => a.targetDate.localeCompare(b.targetDate))[0];
  if (nearGoal) {
    const nextMs = (nearGoal.milestones || []).find((m) => !m.done);
    suggestions.push(nextMs ? `Move “${nearGoal.title}” forward: ${nextMs.title}.` : `Add a next milestone for “${nearGoal.title}”.`);
  }
  if (struggling[0]) suggestions.push(`Protect time for “${struggling[0].h.name}”.`);
  if (!suggestions.length) suggestions.push('Choose your top three priorities in the planner each morning.');

  return { wins, attention, suggestions: suggestions.slice(0, 3), ws };
}

export function render({ state, today, ui }) {
  const rangeDays = Number(ui.statsRange || 7);
  const from = addDays(today, -(rangeDays - 1));
  const xpMap = xpByDay(state.ledger);
  const ws = weekStart(today);
  const streak = streakInfo(state, today);
  const acts = activityMap(state);

  // XP chart: daily bars, or weekly bars for 90 days.
  let xpBars;
  if (rangeDays <= 30) {
    xpBars = range(from, today).map((d) => ({ label: rangeDays <= 7 ? fmtDay(d, { weekday: 'short' }) : String(Number(d.slice(8))), value: xpMap.get(d) || 0, title: fmtDay(d) }));
  } else {
    xpBars = [];
    for (let w = weekStart(from); w <= today; w = addDays(w, 7)) xpBars.push({ label: fmtDay(w, { day: 'numeric', month: 'short' }), value: xpBetween(state.ledger, w, addDays(w, 6)), title: `Week of ${fmtDay(w)}` });
  }
  const xpRange = xpBetween(state.ledger, from, today);

  const tasks = liveTasks(state);
  const dueInRange = tasks.filter((t) => t.dueDate && t.dueDate >= from && t.dueDate <= today);
  const doneDue = dueInRange.filter((t) => t.status === 'completed').length;
  const completedInRange = state.tasks.filter((t) => t.status === 'completed' && t.completedDay >= from && t.completedDay <= today);
  const hc = habitConsistency(state, from, today);

  const byCat = new Map();
  for (const t of completedInRange) byCat.set(t.category, (byCat.get(t.category) || 0) + 1);
  const catRows = [...byCat.entries()].map(([id, v]) => { const c = categoryById(state, id); return { label: c.name, value: v, color: c.color }; }).sort((a, b) => b.value - a.value);

  const focusMin = state.focus.filter((f) => f.day >= from && f.day <= today).reduce((a, f) => a + f.minutes, 0);
  const estMin = completedInRange.reduce((a, t) => a + (t.duration || 0), 0);

  // Personal bests from records.
  let bestXpDay = null;
  for (const [d, v] of xpMap) if (v > 0 && (!bestXpDay || v > bestXpDay.v)) bestXpDay = { d, v };
  const perDay = new Map();
  for (const t of state.tasks) if (t.status === 'completed' && t.completedDay) perDay.set(t.completedDay, (perDay.get(t.completedDay) || 0) + 1);
  let bestTaskDay = null;
  for (const [d, v] of perDay) if (!bestTaskDay || v > bestTaskDay.v) bestTaskDay = { d, v };
  const { best: bestSales } = salesHistory(state, today);

  const review = weeklyReview(state, today);
  const goals = activeGoals(state);
  const sm = monthSummary(state, monthOf(today), today);
  const hasAny = state.ledger.length > 0 || state.tasks.some((t) => t.status === 'completed');

  return `
  <header class="page-head">
    <div><h1 class="page-title">Statistics</h1><p class="muted small">Calculated from your own records.</p></div>
  </header>

  <div class="stat-grid">
    ${stat('XP this week', fmtNum(xpBetween(state.ledger, ws, today)), { sub: `${fmtNum(lifetimeXp(state.ledger))} lifetime` })}
    ${stat('Streak', plural(streak.current, 'day'), { sub: `Best ${streak.longest}` })}
    ${stat('Missions done', dueInRange.length ? `${pct(doneDue, dueInRange.length)}%` : '—', { sub: `Last ${rangeDays} days` })}
    ${stat('Habits kept', hc ? `${pct(hc.met, hc.scheduled)}%` : '—', { sub: `Last ${rangeDays} days` })}
  </div>

  <section class="card review" aria-labelledby="wr-h">
    <h2 class="card-title" id="wr-h">This week <span class="muted small">· from ${esc(fmtDay(review.ws))}</span></h2>
    <div class="grid-3">
      <div><h3 class="sub-h ok-text">What went well</h3>${review.wins.length ? `<ul class="bullets">${review.wins.map((w) => `<li>${esc(w)}</li>`).join('')}</ul>` : '<p class="muted small">Your wins will show up here as you complete missions and habits.</p>'}</div>
      <div><h3 class="sub-h warn-text">Needs attention</h3>${review.attention.length ? `<ul class="bullets">${review.attention.map((w) => `<li>${esc(w)}</li>`).join('')}</ul>` : '<p class="muted small">Nothing urgent.</p>'}</div>
      <div><h3 class="sub-h">Next week’s priorities</h3><ol class="bullets">${review.suggestions.map((w) => `<li>${esc(w)}</li>`).join('')}</ol></div>
    </div>
  </section>

  ${!hasAny ? empty({ icon: 'chart', title: 'No activity yet', text: 'Complete a mission or log a habit and your charts will start filling in.' }) : `
  <section class="card">
    <div class="section-head"><h2>XP earned <span class="muted small">· ${fmtNum(xpRange)}</span></h2>
      <div class="segmented three compact" role="group" aria-label="Range">${[7, 30, 90].map((n) => `<button class="seg ${rangeDays === n ? 'on' : ''}" aria-pressed="${rangeDays === n}" data-action="set-ui" data-key="statsRange" data-value="${n}">${n}d</button>`).join('')}</div>
    </div>
    ${barChart(xpBars, { ariaLabel: 'XP earned', target: rangeDays <= 30 ? state.settings.dailyXpTarget : null })}
  </section>

  ${disclosure('Activity & streaks', `${heatmap(today, 18, (d) => { const v = acts.get(d) || 0; return { value: v, level: v === 0 ? 0 : v === 1 ? 1 : v <= 3 ? 2 : v <= 5 ? 3 : 4 }; }, { describe: (d, v) => `${fmtDay(d)}: ${plural(v, 'action')}` })}
    <ul class="kv">
      <li><span>Active days this week</span><strong>${streak.weekActive}/${streak.weekElapsed}</strong></li>
      <li><span>Total active days</span><strong>${fmtNum(streak.activeDays)}</strong></li>
      <li><span>Missed days</span><strong>${streak.firstDay ? `${fmtNum(streak.missedDays)} since ${esc(fmtDay(streak.firstDay))}` : '—'}</strong></li>
      <li><span>XP today / this month</span><strong>${fmtNum(xpBetween(state.ledger, today, today))} / ${fmtNum(xpBetween(state.ledger, monthOf(today) + '-01', today))}</strong></li>
      <li><span>Focus time (${rangeDays}d)</span><strong>${fmtNum(focusMin)} min${estMin ? ` <span class="muted small">+ ~${fmtNum(estMin)} est. on missions</span>` : ''}</strong></li>
    </ul>`)}

  ${disclosure('By area', catRows.length ? hbars(catRows) : '<p class="muted small">No missions completed in this range.</p>', { sub: `last ${rangeDays} days` })}

  ${disclosure('Personal bests', `<ul class="kv">
      <li><span>Best XP day</span><strong>${bestXpDay ? `${fmtNum(bestXpDay.v)} XP · ${esc(fmtDay(bestXpDay.d))}` : '—'}</strong></li>
      <li><span>Most missions in a day</span><strong>${bestTaskDay ? `${bestTaskDay.v} · ${esc(fmtDay(bestTaskDay.d))}` : '—'}</strong></li>
      <li><span>Longest streak</span><strong>${plural(streak.longest, 'day')}</strong></li>
      <li><span>Best sales month</span><strong>${bestSales ? `${fmtMoney(bestSales.revenue, state.settings.currency)} · ${esc(fmtMonth(bestSales.month, 'short'))}` : '—'}</strong></li>
    </ul>`)}`}

  ${disclosure('Goals & sales', `${goals.length ? `<ul class="goal-mini">${goals.map((g) => { const p = goalProgress(state, g).pct; return `<li><div class="row-between small"><span>${esc(g.title)}</span><strong>${p}%</strong></div>${progress(p, { cls: 'sm' })}</li>`; }).join('')}</ul>` : '<p class="muted small">No active goals.</p>'}
    <p class="list-label">Sales · ${esc(fmtMonth(monthOf(today), 'short'))}</p>
    ${sm.hasData || sm.target ? `<ul class="kv">
      <li><span>Revenue</span><strong>${fmtMoney(sm.revenue, state.settings.currency)}</strong></li>
      <li><span>Target</span><strong>${sm.target ? `${fmtMoney(sm.target, state.settings.currency)} (${Math.floor(sm.pct)}%)` : '—'}</strong></li>
      <li><span>Deals / leads</span><strong>${sm.deals} / ${sm.leads}</strong></li>
      <li><span>Conversion</span><strong>${sm.conversion != null ? `${(sm.conversion * 100).toFixed(1)}%` : 'Not enough data'}</strong></li>
    </ul>` : '<p class="muted small">No sales logged this month.</p>'}`)}`;
}
