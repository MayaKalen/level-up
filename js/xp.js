// XP ledger and level progression.
//
// Ledger rules (the single source of truth for XP):
// - Every XP change is an append-only entry { key, amount, day, ts, label, kind }.
// - `key` identifies the reason (e.g. "task:<id>", "habit:<id>:<day>").
//   A key can hold at most one positive net award, so re-completing,
//   double-tapping or refreshing can never award XP twice.
// - Undoing (unchecking a task, un-logging a habit) appends a reversal with the
//   negative net amount, dated to the ORIGINAL award day, so "today's XP" and
//   historical daily totals stay correct.
// - Editing a completed task does not change XP already awarded.
// - Deleting a completed task keeps its earned XP (the history stays in the ledger).
// - Achievements are never reversed once unlocked.

export const DEFAULT_LEVEL_CURVE = { base: 50, step: 50 };

/** XP required to reach level L. With base=50, step=50: L1 0, L2 100, L3 250, L4 450, L5 700 … */
export function levelThreshold(L, curve = DEFAULT_LEVEL_CURVE) {
  const n = Math.max(0, L - 1);
  return curve.base * n + (curve.step * n * (n + 1)) / 2;
}

export const RANKS = [
  [1, 'Beginner'], [3, 'Apprentice'], [5, 'Rising Star'], [8, 'Achiever'],
  [12, 'Elite'], [17, 'Champion'], [25, 'Master'], [35, 'Legend'],
];

export function rankFor(level) {
  let r = RANKS[0][1];
  for (const [min, name] of RANKS) if (level >= min) r = name;
  return r;
}

export function levelInfo(xp, curve = DEFAULT_LEVEL_CURVE) {
  const total = Math.max(0, xp);
  let level = 1;
  while (level < 999 && levelThreshold(level + 1, curve) <= total) level++;
  const floor = levelThreshold(level, curve);
  const next = levelThreshold(level + 1, curve);
  const into = total - floor;
  const span = next - floor;
  return {
    level, rank: rankFor(level), xp: total, into, span,
    toNext: next - total, pct: span > 0 ? Math.min(100, (into / span) * 100) : 100,
  };
}

export const lifetimeXp = (ledger) => ledger.reduce((a, e) => a + e.amount, 0);

export function xpByDay(ledger) {
  const m = new Map();
  for (const e of ledger) m.set(e.day, (m.get(e.day) || 0) + e.amount);
  return m;
}

export function xpBetween(ledger, from, to) {
  let t = 0;
  for (const e of ledger) if (e.day >= from && e.day <= to) t += e.amount;
  return t;
}

/** Idempotent operations over a state's ledger, built once per commit. */
export class Ledger {
  constructor(state, now) {
    this.state = state;
    this.now = now;
    this.index = new Map();
    for (const e of state.ledger) this.#apply(e);
  }

  #apply(e) {
    const r = this.index.get(e.key) || { net: 0, day: null };
    r.net += e.amount;
    if (e.amount > 0) r.day = e.day;
    this.index.set(e.key, r);
  }

  #push(entry) {
    const e = { id: `${entry.key}#${this.state.ledger.length}`, ts: this.now.toISOString(), ...entry };
    this.state.ledger.push(e);
    this.#apply(e);
  }

  has(key) {
    return (this.index.get(key)?.net || 0) > 0;
  }

  /** Award XP once per key. Returns the amount awarded (0 if already held). */
  award(key, amount, label, day, kind = 'award') {
    const amt = Math.round(Number(amount) || 0);
    if (amt <= 0 || this.has(key)) return 0;
    this.#push({ key, amount: amt, day, label, kind });
    return amt;
  }

  /** Reverse whatever net XP a key holds. Returns the (negative) change. */
  revoke(key, label) {
    const r = this.index.get(key);
    if (!r || r.net <= 0) return 0;
    const amt = -r.net;
    this.#push({ key, amount: amt, day: r.day, label: `Reversed: ${label}`, kind: 'reversal' });
    return amt;
  }

  /** Make the ledger reflect a condition: award when true, reverse when false. */
  ensure(key, condition, amount, label, day, kind) {
    return condition ? this.award(key, amount, label, day, kind) : this.revoke(key, label);
  }
}
