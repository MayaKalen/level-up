// Cloud sync with Firebase (Google sign-in + Firestore).
//
// How it works
// - Local-first: every change is saved on the device immediately (localStorage).
//   Sync uploads changed documents in the background and works offline.
// - Data is split into documents (see sync-model.js). Only documents that
//   actually changed are uploaded, debounced by ~1.5 s.
// - Other devices' changes arrive live through a Firestore listener.
// - Conflicts: per document, the most recent change wins. If two devices edit
//   the same month while both offline, the later save replaces the earlier one.
// - First sign-in on a device: if the cloud already has data and this device
//   has its own, the user chooses which copy to keep.
// - The Firebase SDK is loaded only when sync is used, so the app stays fast
//   and fully usable without it.
import * as store from './store.js';
import { firebaseConfig, FIREBASE_SDK } from './firebase-config.js';
import { splitState, joinDocs, docHash, summarize } from './sync-model.js';
import { openSheet } from './ui.js';
import { esc, fmtNum, uid as makeId } from './util.js';

const META_KEY = 'levelup:sync';
const MAX_DOC_CHARS = 900_000; // Firestore's limit is 1 MiB per document.

let fb = null;
let loading = null;
let user = null;
let unsubSnap = null;
let flushTimer = null;
let flushing = false;
let flushAgain = false;
let applying = false;
let status = { state: 'off', error: null };
const listeners = new Set();
let meta = loadMeta();

// ---------- meta (per-device sync bookkeeping) ----------

function loadMeta() {
  let m = null;
  try { m = JSON.parse(localStorage.getItem(META_KEY)); } catch { /* ignore */ }
  m ||= {};
  m.deviceId ||= makeId();
  m.synced ||= {}; // docId → hash last confirmed in the cloud
  m.local ||= {}; // docId → { hash, time } of this device's current copy
  return m;
}
function saveMeta() { try { localStorage.setItem(META_KEY, JSON.stringify(meta)); } catch { /* ignore */ } }

const isDirty = (id) => (meta.local[id]?.hash ?? null) !== (meta.synced[id] ?? null);
const dirtyIds = () => [...new Set([...Object.keys(meta.local), ...Object.keys(meta.synced)])].filter(isDirty);

// ---------- status for the UI ----------

function setStatus(state, error = null) {
  status = { state, error };
  for (const fn of listeners) fn(getStatus());
}

export function getStatus() {
  return {
    ...status,
    linked: Boolean(meta.uid),
    signedIn: Boolean(user && meta.uid === user.uid),
    email: meta.email || user?.email || '',
    lastSyncAt: meta.lastSyncAt || null,
    pending: dirtyIds().length,
  };
}

export function onStatus(fn) { listeners.add(fn); return () => listeners.delete(fn); }

// ---------- Firebase SDK (loaded on demand) ----------

export function preload() {
  if (!loading) {
    loading = (async () => {
      const [appMod, authMod, fsMod] = await Promise.all([
        import(`${FIREBASE_SDK}/firebase-app.js`),
        import(`${FIREBASE_SDK}/firebase-auth.js`),
        import(`${FIREBASE_SDK}/firebase-firestore.js`),
      ]);
      const app = appMod.initializeApp(firebaseConfig);
      const auth = authMod.getAuth(app);
      const db = fsMod.getFirestore(app);
      fb = { ...authMod, ...fsMod, auth, db };
      authMod.onAuthStateChanged(auth, handleAuth);
      return fb;
    })().catch((e) => { loading = null; throw e; });
  }
  return loading;
}

function friendlyError(e) {
  const code = e?.code || '';
  if (code.includes('popup-closed') || code.includes('cancelled-popup')) return null;
  if (code.includes('popup-blocked')) return 'Your browser blocked the sign-in window. Tap “Sign in” again, or allow pop-ups for this site.';
  if (code.includes('unauthorized-domain')) return 'This website isn’t on Firebase’s allowed list yet (Authentication → Settings → Authorized domains).';
  if (code.includes('network') || !navigator.onLine) return 'No connection. Your data is safe on this device and will sync when you’re back online.';
  if (code.includes('permission-denied')) return 'The cloud refused access. Check the Firestore security rules.';
  if (e?.message?.includes('Failed to fetch dynamically imported module') || e?.message?.includes('Importing a module script failed')) return 'Couldn’t load the sync service. Check your connection and try again.';
  return e?.message || 'Something went wrong with sync.';
}

// ---------- auth ----------

function handleAuth(u) {
  user = u;
  if (u && meta.uid === u.uid) { startListening(); return; }
  stopListening();
  if (!u && meta.uid) setStatus('signed-out', 'You were signed out. Sign in again to keep syncing.');
  else if (!u) setStatus('off');
}

/** Sign in with Google and link this device. Returns 'cloud' | 'local' | 'empty' | null. */
export async function signIn({ preferCloud = false } = {}) {
  try {
    setStatus('connecting');
    await preload();
    const cred = await fb.signInWithPopup(fb.auth, new fb.GoogleAuthProvider());
    return await linkAccount(cred.user, { preferCloud });
  } catch (e) {
    const msg = friendlyError(e);
    setStatus(meta.uid ? 'error' : 'off', msg);
    if (msg) throw new Error(msg);
    return null;
  }
}

export async function signOut() {
  stopListening();
  try { if (fb) await fb.signOut(fb.auth); } catch { /* ignore */ }
  meta = { deviceId: meta.deviceId, synced: {}, local: {} };
  saveMeta();
  user = null;
  setStatus('off');
}

async function fetchCloud(uid) {
  const snap = await fb.getDocs(fb.collection(fb.db, 'users', uid, 'data'));
  const docs = {};
  const hashes = {};
  snap.forEach((d) => {
    const data = d.data();
    try { docs[d.id] = JSON.parse(data.json); hashes[d.id] = data.hash; } catch { /* skip unreadable doc */ }
  });
  return { docs, hashes };
}

async function linkAccount(u, { preferCloud }) {
  if (meta.uid === u.uid) { startListening(); return 'linked'; }
  setStatus('syncing');
  const { docs, hashes } = await fetchCloud(u.uid);
  const hasCloud = Boolean(docs.core);
  const cloudState = hasCloud ? store.migrate(joinDocs(docs)) : null;
  const local = store.getState();
  const ls = summarize(local);
  const cs = summarize(cloudState);

  let choice;
  if (!hasCloud) choice = 'local';
  else if (preferCloud || ls.empty) choice = 'cloud';
  else choice = await askWhichCopy(ls, cs);

  if (!choice) { await signOut(); return null; }

  meta.uid = u.uid;
  meta.email = u.email || '';
  meta.synced = { ...hashes };
  meta.local = {};
  if (choice === 'cloud') {
    applying = true;
    store.replaceState(cloudState);
    applying = false;
  }
  recordLocal(store.getState());
  saveMeta();
  startListening();
  flush();
  return hasCloud ? choice : 'empty';
}

function askWhichCopy(ls, cs) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => { if (!done) { done = true; resolve(v); } };
    const card = (title, s) => `<div class="copy-card"><strong>${esc(title)}</strong>
      <span class="muted small">${esc(s.name || '—')} · ${fmtNum(s.xp)} XP · ${fmtNum(s.missions)} missions · ${fmtNum(s.habits)} habits · ${fmtNum(s.goals)} goals</span></div>`;
    const sheet = openSheet({
      title: 'Which progress should we keep?',
      size: 'small',
      onClose: () => finish(null),
      body: `<p class="muted small">Your account already has saved progress, and this device has its own. Choose one — the other will be replaced.</p>
        ${card('Saved in your account', cs)}
        ${card('On this device', ls)}
        <div class="detail-actions">
          <button class="btn primary block" data-pick="cloud">Use my saved progress</button>
          <button class="btn ghost block" data-pick="local">Keep this device’s data (replaces saved)</button>
          <button class="btn ghost block" data-dismiss>Cancel</button>
        </div>`,
    });
    sheet.el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-pick]');
      if (!b) return;
      finish(b.dataset.pick);
      sheet.close();
    });
  });
}

// ---------- local changes → cloud ----------

function recordLocal(state) {
  const docs = splitState(state);
  const now = Date.now();
  for (const [id, d] of Object.entries(docs)) {
    const h = docHash(d);
    if (meta.local[id]?.hash !== h) meta.local[id] = { hash: h, time: now };
  }
  // Documents that no longer exist locally (e.g. after a reset) are deleted in the cloud.
  for (const id of Object.keys({ ...meta.local, ...meta.synced })) {
    if (!docs[id] && meta.local[id]?.hash !== null) meta.local[id] = { hash: null, time: now };
  }
  return docs;
}

function onStoreChange(state, events) {
  if (applying || !meta.uid) return;
  if (events?.some((e) => e.type === 'sync')) return;
  recordLocal(state);
  saveMeta();
  scheduleFlush();
}

function scheduleFlush() {
  clearTimeout(flushTimer);
  flushTimer = setTimeout(flush, 1500);
}

export async function flush() {
  if (!meta.uid || !user || user.uid !== meta.uid || !fb) return;
  if (flushing) { flushAgain = true; return; }
  const ids = dirtyIds();
  if (!ids.length) { setStatus('synced'); return; }
  if (!navigator.onLine) { setStatus('offline'); return; }
  flushing = true;
  setStatus('syncing');
  try {
    const docs = splitState(store.getState());
    const batch = fb.writeBatch(fb.db);
    const sent = {};
    for (const id of ids) {
      const ref = fb.doc(fb.db, 'users', meta.uid, 'data', id);
      const local = meta.local[id];
      if (!local || local.hash === null || !docs[id]) { batch.delete(ref); sent[id] = null; continue; }
      const json = JSON.stringify(docs[id]);
      if (json.length > MAX_DOC_CHARS) throw new Error(`Too much data in “${id}” to sync. Export a backup and remove old records.`);
      const h = docHash(docs[id]);
      batch.set(ref, { json, hash: h, updatedAt: local.time, deviceId: meta.deviceId, v: 1 });
      sent[id] = h;
    }
    await batch.commit();
    for (const [id, h] of Object.entries(sent)) {
      if (h === null) { delete meta.synced[id]; if (meta.local[id]?.hash === null) delete meta.local[id]; } else meta.synced[id] = h;
    }
    meta.lastSyncAt = Date.now();
    saveMeta();
    setStatus(dirtyIds().length ? 'syncing' : 'synced');
  } catch (e) {
    setStatus(navigator.onLine ? 'error' : 'offline', friendlyError(e));
  } finally {
    flushing = false;
    if (flushAgain) { flushAgain = false; scheduleFlush(); }
  }
}

// ---------- cloud changes → local ----------

function startListening() {
  if (unsubSnap || !user || !fb) return;
  setStatus('syncing');
  recordLocal(store.getState());
  saveMeta();
  unsubSnap = fb.onSnapshot(
    fb.collection(fb.db, 'users', meta.uid, 'data'),
    (snap) => handleSnapshot(snap),
    (e) => setStatus('error', friendlyError(e)),
  );
  flush();
}

function stopListening() {
  if (unsubSnap) { unsubSnap(); unsubSnap = null; }
}

function handleSnapshot(snap) {
  let docs = null;
  let changed = false;
  for (const ch of snap.docChanges()) {
    if (ch.doc.metadata.hasPendingWrites) continue; // our own write, still in flight
    const id = ch.doc.id;
    if (ch.type === 'removed') {
      if (!isDirty(id)) {
        docs ||= splitState(store.getState());
        if (docs[id]) { delete docs[id]; changed = true; }
        delete meta.synced[id];
        delete meta.local[id];
      }
      continue;
    }
    const data = ch.doc.data();
    if (meta.local[id]?.hash === data.hash) { meta.synced[id] = data.hash; continue; }
    // Local edits that are newer than the cloud copy win; they'll be uploaded.
    if (isDirty(id) && (meta.local[id]?.time || 0) > (data.updatedAt || 0)) continue;
    let parsed;
    try { parsed = JSON.parse(data.json); } catch { continue; }
    docs ||= splitState(store.getState());
    docs[id] = parsed;
    meta.synced[id] = data.hash;
    meta.local[id] = { hash: data.hash, time: data.updatedAt || Date.now() };
    changed = true;
  }
  if (changed && docs) {
    applying = true;
    try { store.replaceState(joinDocs(docs)); } finally { applying = false; }
  }
  meta.lastSyncAt = Date.now();
  saveMeta();
  if (dirtyIds().length) flush(); else setStatus('synced');
}

// ---------- boot ----------

export function initSync() {
  store.subscribe(onStoreChange);
  window.addEventListener('online', () => flush());
  window.addEventListener('offline', () => { if (meta.uid) setStatus('offline'); });
  if (meta.uid) {
    setStatus(navigator.onLine ? 'connecting' : 'offline');
    preload().catch((e) => setStatus('offline', friendlyError(e)));
  }
}
