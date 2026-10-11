// Focus session timer. The running session is kept in localStorage so a
// refresh doesn't lose it; finished sessions are logged to the store.
import * as store from './store.js';
import { openSheet, toast } from './ui.js';
import { icon } from './icons.js';
import { esc } from './util.js';
import { taskSections, isOpen } from './tasks.js';
import { opt } from './forms.js';

const KEY = 'levelup:focus';
let timer = null;

const load = () => { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } };
const save = (f) => { try { f ? localStorage.setItem(KEY, JSON.stringify(f)) : localStorage.removeItem(KEY); } catch { /* ignore */ } };

const elapsedMs = (f) => f.accumulated + (f.running ? Date.now() - f.startedAt : 0);
const remainingMs = (f) => Math.max(0, f.minutes * 60000 - elapsedMs(f));
const mmss = (ms) => { const s = Math.ceil(ms / 1000); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };

export function openFocus() {
  const f = load();
  if (f) return openControls();
  const s = store.getState();
  const today = store.today();
  const sec = taskSections(s, today);
  const tasks = [...sec.overdue, ...sec.today].filter(isOpen);
  const sheet = openSheet({
    title: 'Start a focus session',
    size: 'small',
    body: `<form class="form">
      <fieldset class="field"><legend>Length</legend><div class="segmented three">${[25, 45, 60].map((m, i) => `<label><input type="radio" name="minutes" value="${m}" ${i === 0 ? 'checked' : ''}><span>${m} min</span></label>`).join('')}</div></fieldset>
      <label class="field"><span>Working on <em>(optional)</em></span><select class="input" name="taskId">${opt('', 'Nothing specific', '')}${tasks.map((t) => opt(t.id, t.title, '')).join('')}</select></label>
      <p class="muted small">Finish the full session for +${s.settings.xp.focusSession} XP. Ending early still logs your focus time.</p>
      <div class="sheet-actions"><button type="button" class="btn ghost" data-dismiss>Cancel</button><button class="btn primary" type="submit">${icon('play', 16)} Start</button></div>
    </form>`,
  });
  sheet.el.querySelector('form').addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    save({ minutes: Number(fd.get('minutes')), taskId: fd.get('taskId') || null, startedAt: Date.now(), accumulated: 0, running: true });
    sheet.close();
    tick();
    toast('Focus session started');
  });
}

function openControls() {
  const f = load();
  if (!f) return;
  const t = f.taskId ? store.getState().tasks.find((x) => x.id === f.taskId) : null;
  const sheet = openSheet({
    title: 'Focus session',
    size: 'small',
    body: `<div class="focus-body"><p class="focus-time" data-focus-time aria-live="off">${mmss(remainingMs(f))}</p>
      ${t ? `<p class="muted center">${esc(t.title)}</p>` : ''}
      <div class="sheet-actions center">
        <button class="btn ghost" data-f="toggle">${f.running ? `${icon('pause', 16)} Pause` : `${icon('play', 16)} Resume`}</button>
        <button class="btn ghost" data-f="end">End &amp; log</button>
        <button class="btn danger" data-f="cancel">Discard</button>
      </div></div>`,
  });
  const iv = setInterval(() => {
    const cur = load();
    const el = sheet.el.querySelector('[data-focus-time]');
    if (!cur || !el) { clearInterval(iv); return; }
    el.textContent = mmss(remainingMs(cur));
  }, 500);
  sheet.el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-f]');
    if (!b) return;
    const cur = load();
    if (!cur) return sheet.close();
    if (b.dataset.f === 'toggle') {
      if (cur.running) { cur.accumulated = elapsedMs(cur); cur.running = false; } else { cur.startedAt = Date.now(); cur.running = true; }
      save(cur);
      b.innerHTML = cur.running ? `${icon('pause', 16)} Pause` : `${icon('play', 16)} Resume`;
      tick();
    } else if (b.dataset.f === 'end') {
      finish(cur, false);
      sheet.close();
    } else if (b.dataset.f === 'cancel') {
      save(null);
      tick();
      sheet.close();
      toast('Focus session discarded', { type: 'info' });
    }
  });
}

function finish(f, completedNaturally) {
  save(null);
  const minutes = completedNaturally ? f.minutes : Math.floor(elapsedMs(f) / 60000);
  if (minutes >= 1) {
    store.logFocus({ minutes, planned: f.minutes, taskId: f.taskId });
    toast(completedNaturally ? `Focus session complete — ${minutes} minutes` : `Logged ${minutes} focus minutes`);
    if (completedNaturally && store.getState().settings.notifications && 'Notification' in window && Notification.permission === 'granted') {
      try { new Notification('Focus session complete', { body: `${minutes} minutes of focus. Take a short break.` }); } catch { /* ignore */ }
    }
  } else {
    toast('Session under a minute — nothing logged', { type: 'info' });
  }
  tick();
}

/** Update the floating pill; called on an interval and after changes. */
export function tick() {
  const pill = document.getElementById('focus-pill');
  const f = load();
  if (!f) { pill.hidden = true; clearInterval(timer); timer = null; return; }
  if (f.running && remainingMs(f) <= 0) { finish(f, true); return; }
  pill.hidden = false;
  pill.innerHTML = `${icon(f.running ? 'timer' : 'pause', 16)}<span>${mmss(remainingMs(f))}</span><span class="sr-only">Focus session ${f.running ? 'running' : 'paused'}. Open controls.</span>`;
  if (!timer) timer = setInterval(tick, 1000);
}

export function initFocus() {
  document.getElementById('focus-pill').addEventListener('click', openControls);
  tick();
}
