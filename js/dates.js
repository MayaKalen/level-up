// Date utilities. All "day keys" are calendar dates (YYYY-MM-DD) in the user's
// configured timezone. Arithmetic on day keys is done in UTC so that DST
// transitions can never add or drop a day.

const DAY_MS = 86400000;
const fmtCache = new Map();

function partsFormatter(tz) {
  if (!fmtCache.has(tz)) {
    fmtCache.set(tz, new Intl.DateTimeFormat('en-US', {
      timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }));
  }
  return fmtCache.get(tz);
}

export function detectTimezone() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { return 'UTC'; }
}

export function isValidTimezone(tz) {
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true; } catch { return false; }
}

export function listTimezones() {
  try { return Intl.supportedValuesOf('timeZone'); } catch { return [detectTimezone(), 'UTC']; }
}

/** Wall-clock parts of an instant in a timezone. */
export function zonedParts(date, tz) {
  const safeTz = isValidTimezone(tz) ? tz : 'UTC';
  const out = {};
  for (const p of partsFormatter(safeTz).formatToParts(date)) out[p.type] = p.value;
  return { y: out.year, m: out.month, d: out.day, h: Number(out.hour) % 24, min: Number(out.minute) };
}

/**
 * Day key for an instant. If the local hour is before `dayStartHour`
 * (e.g. 1am with dayStartHour = 3) the activity counts toward the previous day,
 * so late-night sessions never split a day.
 */
export function dayKey(date, tz, dayStartHour = 0) {
  const p = zonedParts(date, tz);
  const key = `${p.y}-${p.m}-${p.d}`;
  return p.h < dayStartHour ? addDays(key, -1) : key;
}

export function timeHM(date, tz) {
  const p = zonedParts(date, tz);
  return `${String(p.h).padStart(2, '0')}:${String(p.min).padStart(2, '0')}`;
}

export function parseKey(k) {
  const [y, m, d] = k.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

export function isDayKey(k) {
  return typeof k === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(k) && !Number.isNaN(parseKey(k));
}

const keyFromUTC = (ms) => new Date(ms).toISOString().slice(0, 10);

export const addDays = (k, n) => keyFromUTC(parseKey(k) + n * DAY_MS);
/** Number of days from a to b (b - a). */
export const diffDays = (a, b) => Math.round((parseKey(b) - parseKey(a)) / DAY_MS);
/** 0 = Sunday … 6 = Saturday */
export const weekday = (k) => new Date(parseKey(k)).getUTCDay();
/** Monday of the week containing k. */
export const weekStart = (k) => addDays(k, -((weekday(k) + 6) % 7));
export const monthOf = (k) => k.slice(0, 7);

export function daysInMonth(mk) {
  const [y, m] = mk.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function addMonths(mk, n) {
  const [y, m] = mk.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

export function range(a, b) {
  const out = [];
  for (let k = a; k <= b; k = addDays(k, 1)) out.push(k);
  return out;
}

export function fmtDay(k, opts = { weekday: 'short', day: 'numeric', month: 'short' }) {
  return new Intl.DateTimeFormat(undefined, { ...opts, timeZone: 'UTC' }).format(new Date(parseKey(k)));
}

export function fmtMonth(mk, style = 'long') {
  return new Intl.DateTimeFormat(undefined, { month: style, year: 'numeric', timeZone: 'UTC' })
    .format(new Date(parseKey(mk + '-01')));
}

export function relDay(k, today) {
  const d = diffDays(today, k);
  if (d === 0) return 'Today';
  if (d === 1) return 'Tomorrow';
  if (d === -1) return 'Yesterday';
  if (d > 1 && d < 7) return fmtDay(k, { weekday: 'long' });
  return fmtDay(k);
}

export function fmtTime(hm) {
  if (!hm) return '';
  const [h, m] = hm.split(':').map(Number);
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' })
    .format(new Date(Date.UTC(2000, 0, 1, h, m)));
}

export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
