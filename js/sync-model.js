// Splits app state into cloud documents and joins them back.
//
// Firestore limits each document to 1 MB, and history grows every day, so data
// is stored as:
//   core        – profile, settings, habits, goals, achievements, sales targets…
//   m-YYYY-MM   – that month's missions (by creation date), XP ledger entries,
//                 habit check-ins, daily plans/reviews, focus sessions, sales entries.
// A typical month is a few tens of KB.
import { hashStr } from './util.js';

const emptyMonth = () => ({ tasks: [], ledger: [], habitLogs: {}, plans: {}, focus: [], sales: [] });
const monthKey = (s) => (typeof s === 'string' && /^\d{4}-\d{2}/.test(s) ? s.slice(0, 7) : 'none');

export function splitState(state) {
  const s = JSON.parse(JSON.stringify(state));
  const months = {};
  const m = (k) => (months[k] ||= emptyMonth());

  for (const t of s.tasks || []) m(monthKey(t.createdAt)).tasks.push(t);
  for (const e of s.ledger || []) m(monthKey(e.day)).ledger.push(e);
  for (const [hid, logs] of Object.entries(s.habitLogs || {})) {
    for (const [day, v] of Object.entries(logs)) (m(monthKey(day)).habitLogs[hid] ||= {})[day] = v;
  }
  for (const [day, p] of Object.entries(s.plans || {})) m(monthKey(day)).plans[day] = p;
  for (const f of s.focus || []) m(monthKey(f.day)).focus.push(f);
  for (const e of s.sales?.entries || []) m(monthKey(e.day)).sales.push(e);

  const core = { ...s, sales: { targets: s.sales?.targets || {} } };
  for (const k of ['tasks', 'ledger', 'habitLogs', 'plans', 'focus']) delete core[k];

  const docs = { core };
  for (const [k, v] of Object.entries(months)) docs[`m-${k}`] = v;
  return docs;
}

export function joinDocs(docs) {
  const core = docs.core ? JSON.parse(JSON.stringify(docs.core)) : {};
  const state = { ...core, tasks: [], ledger: [], habitLogs: {}, plans: {}, focus: [], sales: { targets: core.sales?.targets || {}, entries: [] } };
  for (const id of Object.keys(docs).filter((k) => k.startsWith('m-')).sort()) {
    const d = docs[id];
    state.tasks.push(...(d.tasks || []));
    state.ledger.push(...(d.ledger || []));
    for (const [hid, logs] of Object.entries(d.habitLogs || {})) Object.assign((state.habitLogs[hid] ||= {}), logs);
    Object.assign(state.plans, d.plans || {});
    state.focus.push(...(d.focus || []));
    state.sales.entries.push(...(d.sales || []));
  }
  state.tasks.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
  state.ledger.sort((a, b) => (a.ts || '').localeCompare(b.ts || ''));
  state.sales.entries.sort((a, b) => a.day.localeCompare(b.day));
  return state;
}

export const docHash = (obj) => String(hashStr(JSON.stringify(obj)));

/** Rough "how much is in here" summary, used when asking which copy to keep. */
export function summarize(state) {
  if (!state || !state.onboarded) return { empty: true, missions: 0, xp: 0, habits: 0, goals: 0, name: '' };
  const real = (state.tasks || []).filter((t) => !t.deletedAt);
  return {
    empty: !(state.ledger || []).length && real.every((t) => t.isSample),
    missions: real.length,
    xp: (state.ledger || []).reduce((a, e) => a + e.amount, 0),
    habits: (state.habits || []).filter((h) => !h.archived).length,
    goals: (state.goals || []).length,
    name: state.profile?.name || '',
  };
}
