// Storage adapters. The app talks only to this interface:
//   load(): state | null      save(state): void      clear(): void
//   subscribe(onExternalChange): void   (other tabs / devices)
// A cloud adapter (e.g. Supabase with Row Level Security) can implement the same
// interface later without touching the rest of the app.

const KEY = 'levelup:state:v1';

export class StorageError extends Error {}

function localAvailable() {
  try {
    const k = '__levelup_probe__';
    localStorage.setItem(k, '1');
    localStorage.removeItem(k);
    return true;
  } catch { return false; }
}

export const localAdapter = {
  id: 'local',
  label: 'This browser (localStorage)',
  persistent: true,
  load() {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { throw new StorageError('Saved data could not be read (it may be corrupted).'); }
  },
  save(state) {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {
      throw new StorageError(e?.name === 'QuotaExceededError' ? 'Browser storage is full. Export your data and remove old records.' : 'Could not save to browser storage.');
    }
  },
  clear() { localStorage.removeItem(KEY); },
  backupCorrupt() {
    const raw = localStorage.getItem(KEY);
    if (raw) localStorage.setItem(`${KEY}:corrupt:${Date.now()}`, raw);
  },
  subscribe(cb) {
    window.addEventListener('storage', (e) => { if (e.key === KEY) cb(); });
  },
};

/** Fallback when storage is blocked (e.g. some private modes). Data is lost on reload. */
export const memoryAdapter = (() => {
  let data = null;
  return {
    id: 'memory', label: 'Memory only (not saved)', persistent: false,
    load: () => data, save: (s) => { data = JSON.parse(JSON.stringify(s)); }, clear: () => { data = null; },
    backupCorrupt() {}, subscribe() {},
  };
})();

export function pickAdapter() {
  return localAvailable() ? localAdapter : memoryAdapter;
}
