import { daysInMonth, monthOf, addMonths } from './dates.js';
import { sum } from './util.js';

export const entriesInMonth = (state, mk) => state.sales.entries.filter((e) => monthOf(e.day) === mk);
export const entryOn = (state, day) => state.sales.entries.find((e) => e.day === day) || null;

/**
 * Monthly sales summary. Revenue, deal counts and activity metrics stay separate.
 * Derived ratios are null (shown as "not enough data") when their inputs are missing.
 */
export function monthSummary(state, mk, today) {
  const entries = entriesInMonth(state, mk);
  const revenue = sum(entries, (e) => e.amount);
  const deals = sum(entries, (e) => e.deals);
  const leads = sum(entries, (e) => e.leads);
  const followUps = sum(entries, (e) => e.followUps);
  const meetings = sum(entries, (e) => e.meetings);
  const target = state.sales.targets[mk] > 0 ? state.sales.targets[mk] : null;
  const dim = daysInMonth(mk);
  const isCurrent = monthOf(today) === mk;
  const daysLeft = isCurrent ? dim - Number(today.slice(8, 10)) + 1 : (today < mk ? dim : 0);
  const remaining = target != null ? Math.max(0, target - revenue) : null;
  return {
    month: mk, entries, revenue, deals, leads, followUps, meetings, target,
    pct: target ? (revenue / target) * 100 : null,
    remaining,
    daysLeft,
    perDayNeeded: remaining && daysLeft > 0 ? remaining / daysLeft : null,
    conversion: leads > 0 ? deals / leads : null,
    avgDeal: deals > 0 && revenue > 0 ? revenue / deals : null,
    hasData: entries.length > 0,
  };
}

/** Months that have entries or a target, newest first. */
export function salesMonths(state) {
  const set = new Set(state.sales.entries.map((e) => monthOf(e.day)));
  for (const [mk, v] of Object.entries(state.sales.targets)) if (v > 0) set.add(mk);
  return [...set].sort().reverse();
}

export function salesHistory(state, today) {
  const months = salesMonths(state);
  const rows = months.map((mk) => monthSummary(state, mk, today));
  const withRevenue = rows.filter((r) => r.revenue > 0);
  const best = withRevenue.reduce((b, r) => (!b || r.revenue > b.revenue ? r : b), null);
  return { rows, best };
}

/** Month-over-month growth; null when the previous month has no revenue. */
export function momGrowth(state, mk, today) {
  const prev = monthSummary(state, addMonths(mk, -1), today);
  const cur = monthSummary(state, mk, today);
  if (!prev.revenue) return null;
  return (cur.revenue - prev.revenue) / prev.revenue;
}

export function dailySeries(state, mk) {
  const dim = daysInMonth(mk);
  const byDay = new Map(entriesInMonth(state, mk).map((e) => [e.day, e.amount]));
  let cum = 0;
  return Array.from({ length: dim }, (_, i) => {
    const day = `${mk}-${String(i + 1).padStart(2, '0')}`;
    const amount = byDay.get(day) || 0;
    cum += amount;
    return { day, amount, cum };
  });
}

