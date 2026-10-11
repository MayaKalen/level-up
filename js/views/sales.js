import { esc, fmtMoney, fmtNum } from '../util.js';
import { icon } from '../icons.js';
import { monthSummary, salesHistory, momGrowth, dailySeries } from '../sales.js';
import { monthOf, fmtMonth, fmtDay, daysInMonth } from '../dates.js';
import { progress, stat, disclosure } from '../components.js';
import { lineChart, barChart } from '../charts.js';

function supportMessage(s, isCurrent, cur, today) {
  if (!s.target) return null;
  if (s.pct >= 100) return { tone: 'ok', text: `Target reached — ${fmtMoney(s.revenue, cur)} against ${fmtMoney(s.target, cur)}. Everything from here is extra momentum.` };
  if (!isCurrent) return { tone: '', text: `This month finished at ${Math.floor(s.pct)}% of target.` };
  // Expected linear pace through the end of yesterday.
  const expected = ((Number(today.slice(8, 10)) - 1) / daysInMonth(s.month)) * 100;
  if (s.pct >= 50 && s.pct < 100) return { tone: 'ok', text: `Past the halfway mark at ${Math.floor(s.pct)}%. ${s.perDayNeeded ? `About ${fmtMoney(s.perDayNeeded, cur)} per remaining day finishes the job.` : ''}` };
  if (s.pct + 5 < expected) return { tone: 'soft', text: `You’re a little behind the month’s pace — that’s normal mid-month. Focus on the next conversation: ${s.perDayNeeded ? `about ${fmtMoney(s.perDayNeeded, cur)} a day closes the gap.` : 'consistent follow-ups move the number.'}` };
  return { tone: '', text: `On pace. ${s.perDayNeeded ? `${fmtMoney(s.perDayNeeded, cur)} per day keeps you there.` : ''}` };
}

export function render({ state, today, ui }) {
  const cur = state.settings.currency;
  const mk = ui.salesMonth || monthOf(today);
  const isCurrent = mk === monthOf(today);
  const s = monthSummary(state, mk, today);
  const growth = momGrowth(state, mk, today);
  const { rows, best } = salesHistory(state, today);
  const series = dailySeries(state, mk);
  const uptoDay = isCurrent ? Number(today.slice(8, 10)) : mk < monthOf(today) ? series.length : 0;
  const msg = supportMessage(s, isCurrent, cur, today);
  const money = (n) => fmtMoney(n, cur);
  const fuGoal = state.settings.dailyFollowUpGoal;

  return `
  <header class="page-head">
    <div><h1 class="page-title">Sales</h1><p class="muted small">Amounts in ${esc(cur)}.</p></div>
    <div class="row-end"><button class="btn ghost sm" data-action="sales-target" data-month="${mk}">Target</button><button class="btn primary sm" data-action="sales-log">${icon('plus', 16)} Log</button></div>
  </header>

  <div class="month-nav">
    <button class="icon-btn" data-action="sales-month" data-delta="-1" aria-label="Previous month">${icon('chevronLeft')}</button>
    <h2>${esc(fmtMonth(mk))}</h2>
    <button class="icon-btn" data-action="sales-month" data-delta="1" aria-label="Next month" ${isCurrent ? 'disabled' : ''}>${icon('chevronRight')}</button>
  </div>

  <section class="card sales-hero">
    <div class="row-between"><span class="muted small">Revenue this month</span>${s.target ? `<span class="muted small">Target ${money(s.target)}</span>` : `<button class="link-btn small" data-action="sales-target" data-month="${mk}">Set a target</button>`}</div>
    <p class="big-num">${money(s.revenue)}</p>
    ${s.target ? `${progress(s.pct, { cls: s.pct >= 100 ? 'ok' : 'xp', label: 'Target progress' })}
      <div class="row-between small"><span><strong>${Math.floor(s.pct)}%</strong> of target</span><span class="muted">${s.remaining > 0 ? `${money(s.remaining)} to go${isCurrent ? ` · ${s.daysLeft} days left` : ''}` : 'Target reached'}</span></div>` : '<p class="muted small">Set a monthly target to see your progress and pace.</p>'}
    ${msg ? `<p class="sales-msg ${msg.tone}">${icon(msg.tone === 'ok' ? 'sparkles' : 'heart', 16)} ${esc(msg.text)}</p>` : ''}
  </section>

  <div class="stat-grid">
    ${stat('Deals closed', fmtNum(s.deals))}
    ${stat('Leads contacted', fmtNum(s.leads))}
    ${stat('Conversion', s.conversion != null ? `${(s.conversion * 100).toFixed(1)}%` : '—', { sub: s.conversion != null ? '' : 'Log leads to see this' })}
    ${stat('Avg deal', s.avgDeal != null ? money(s.avgDeal) : '—', { sub: s.avgDeal != null ? '' : 'Needs deals + revenue' })}
  </div>

  ${(s.hasData || s.target) && uptoDay ? `<section class="card"><h2 class="card-title">This month so far</h2>
    ${lineChart(series.map((p) => ({ label: String(Number(p.day.slice(8))), value: p.cum })), { target: s.target, upto: uptoDay, format: (n) => fmtMoney(n, cur, true), ariaLabel: 'Cumulative revenue this month' })}
  </section>` : ''}

  ${disclosure('More numbers', `<ul class="kv">
      <li><span>Follow-ups</span><strong>${fmtNum(s.followUps)}${fuGoal ? ` <span class="muted small">(daily goal ${fuGoal})</span>` : ''}</strong></li>
      <li><span>Meetings booked</span><strong>${fmtNum(s.meetings)}</strong></li>
      <li><span>vs last month</span><strong>${growth != null ? `${growth >= 0 ? '+' : ''}${(growth * 100).toFixed(0)}%` : '<span class="muted">No revenue last month</span>'}</strong></li>
      <li><span>Best month</span><strong>${best ? `${money(best.revenue)} · ${esc(fmtMonth(best.month, 'short'))}` : '—'}</strong></li>
    </ul>
    ${s.hasData ? `<p class="list-label">Daily revenue</p>${barChart(series.map((p) => ({ label: String(Number(p.day.slice(8))), value: p.amount, title: fmtDay(p.day) })), { format: (n) => fmtMoney(n, cur, true), ariaLabel: 'Daily revenue', highlightLast: false, height: 120 })}` : ''}
    <p class="muted small">${state.settings.salesXpEnabled ? `XP: ${state.settings.xp.salesFollowups} for reaching ${fuGoal} follow-ups in a day, ${state.settings.xp.salesHalf} at 50% of target, ${state.settings.xp.salesTarget} at 100%. Each awarded once.` : 'Sales XP is turned off in Settings.'}</p>`)}

  ${disclosure('Entries', s.entries.length ? `<div class="table-wrap"><table class="table">
      <thead><tr><th scope="col">Date</th><th scope="col" class="num">Revenue</th><th scope="col" class="num">Deals</th><th scope="col" class="num hide-mobile">Leads</th><th scope="col" class="num hide-mobile">Follow-ups</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead>
      <tbody>${[...s.entries].sort((a, b) => b.day.localeCompare(a.day)).map((e) => `<tr>
        <td>${esc(fmtDay(e.day))}${e.note ? `<br><small class="muted">${esc(e.note)}</small>` : ''}</td><td class="num">${money(e.amount)}</td><td class="num">${e.deals}</td>
        <td class="num hide-mobile">${e.leads}</td><td class="num hide-mobile">${e.followUps}</td>
        <td class="actions"><button class="icon-btn subtle sm" data-action="sales-log" data-day="${e.day}" aria-label="Edit ${esc(fmtDay(e.day))}">${icon('pencil', 15)}</button><button class="icon-btn subtle sm" data-action="sales-delete" data-day="${e.day}" aria-label="Delete ${esc(fmtDay(e.day))}">${icon('trash', 15)}</button></td></tr>`).join('')}
      </tbody></table></div>` : `<p class="muted small">No sales logged this month. Tap <strong>Log</strong> to add today’s numbers — no CRM needed.</p>`, { sub: `${s.entries.length} this month` })}

  ${rows.length > 1 ? disclosure('Monthly history', `${barChart([...rows].reverse().slice(-12).map((r) => ({ label: fmtMonth(r.month, 'short').split(' ')[0], value: r.revenue, title: fmtMonth(r.month) })), { format: (n) => fmtMoney(n, cur, true), ariaLabel: 'Monthly revenue', highlightLast: false, height: 120 })}
    <div class="table-wrap"><table class="table"><thead><tr><th scope="col">Month</th><th scope="col" class="num">Revenue</th><th scope="col" class="num">Target</th><th scope="col" class="num">Achieved</th></tr></thead>
    <tbody>${rows.map((r) => `<tr><td><button class="link-btn" data-action="set-ui" data-key="salesMonth" data-value="${r.month}">${esc(fmtMonth(r.month, 'short'))}</button>${best && best.month === r.month ? ` <span class="badge ok">Best</span>` : ''}</td><td class="num">${money(r.revenue)}</td><td class="num">${r.target ? money(r.target) : '—'}</td><td class="num">${r.pct != null ? `${Math.floor(r.pct)}%` : '—'}</td></tr>`).join('')}</tbody></table></div>`) : ''}`;
}

