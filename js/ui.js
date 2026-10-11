// Overlays (bottom sheets / dialogs), toasts and celebration effects.
import { esc } from './util.js';
import { icon } from './icons.js';

const root = () => document.getElementById('overlay-root');
const stack = [];

function focusables(el) {
  return [...el.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')]
    .filter((x) => x.offsetParent !== null || x === document.activeElement);
}

/**
 * Open a modal. On phones it is a bottom sheet; on wider screens a centred dialog.
 * Returns { el, close }.
 */
export function openSheet({ title, body, size = '', onClose, labelledBy } = {}) {
  const prevFocus = document.activeElement;
  const id = 'sheet-' + Math.random().toString(36).slice(2, 8);
  const wrap = document.createElement('div');
  wrap.className = 'overlay';
  wrap.innerHTML = `<div class="backdrop" data-dismiss></div>
    <div class="sheet ${size}" tabindex="-1" role="dialog" aria-modal="true" aria-labelledby="${labelledBy || id}">
      <div class="sheet-grip" aria-hidden="true"></div>
      ${title != null ? `<header class="sheet-head"><h2 id="${id}">${esc(title)}</h2>
        <button class="icon-btn" data-dismiss aria-label="Close">${icon('x')}</button></header>` : ''}
      <div class="sheet-body">${body}</div>
    </div>`;
  root().appendChild(wrap);
  document.body.classList.add('modal-open');
  let closed = false;

  const close = () => {
    if (closed) return;
    closed = true;
    wrap.classList.add('closing');
    const i = stack.indexOf(entry);
    if (i >= 0) stack.splice(i, 1);
    setTimeout(() => {
      wrap.remove();
      if (!stack.length) document.body.classList.remove('modal-open');
    }, 160);
    onClose?.();
    if (prevFocus && document.contains(prevFocus)) prevFocus.focus({ preventScroll: true });
    else if (stack.length) stack[stack.length - 1].el.querySelector('.sheet')?.focus({ preventScroll: true });
    else document.getElementById('main')?.focus({ preventScroll: true });
  };

  wrap.addEventListener('click', (e) => { if (e.target.closest('[data-dismiss]')) close(); });
  enableSwipeToClose(wrap, () => close());
  wrap.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); close(); }
    if (e.key === 'Tab') {
      const f = focusables(wrap.querySelector('.sheet'));
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  const entry = { el: wrap, close };
  stack.push(entry);
  requestAnimationFrame(() => {
    const auto = wrap.querySelector('[autofocus]') || focusables(wrap.querySelector('.sheet-body'))[0] || wrap.querySelector('.sheet');
    auto?.focus({ preventScroll: true });
  });
  return entry;
}

/**
 * On phones, drag a bottom sheet down by its handle/header to dismiss it.
 * Only active for bottom sheets (narrow screens); dialogs on wider screens ignore it.
 */
function enableSwipeToClose(wrap, close) {
  const sheet = wrap.querySelector('.sheet');
  let startY = null, dy = 0;
  const isBottomSheet = () => window.matchMedia('(max-width: 639px)').matches;
  sheet.addEventListener('pointerdown', (e) => {
    if (!isBottomSheet() || e.pointerType === 'mouse') return;
    if (!e.target.closest('.sheet-grip, .sheet-head') || e.target.closest('button, a, input')) return;
    startY = e.clientY; dy = 0;
    try { sheet.setPointerCapture(e.pointerId); } catch { /* not all pointers can be captured */ }
    sheet.style.transition = 'none';
  });
  sheet.addEventListener('pointermove', (e) => {
    if (startY == null) return;
    dy = Math.max(0, e.clientY - startY);
    sheet.style.transform = `translateY(${dy}px)`;
  });
  const end = () => {
    if (startY == null) return;
    startY = null;
    sheet.style.transition = '';
    if (dy > 90) { sheet.style.transform = `translateY(${dy}px)`; close(); }
    else sheet.style.transform = '';
  };
  sheet.addEventListener('pointerup', end);
  sheet.addEventListener('pointercancel', end);
}

export const closeTopSheet = () => stack[stack.length - 1]?.close();
export const sheetOpen = () => stack.length > 0;

/** Confirmation dialog for destructive actions. Resolves true/false. */
export function confirmDialog({ title, message, confirmLabel = 'Confirm', danger = false, requireText = null }) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => { if (!done) { done = true; resolve(v); } };
    const s = openSheet({
      title,
      size: 'small',
      onClose: () => finish(false),
      body: `<p class="muted">${esc(message)}</p>
        ${requireText ? `<label class="field"><span>Type <strong>${esc(requireText)}</strong> to confirm</span><input class="input" data-confirm-text autocomplete="off"></label>` : ''}
        <div class="sheet-actions">
          <button class="btn ghost" data-dismiss>Cancel</button>
          <button class="btn ${danger ? 'danger' : 'primary'}" data-ok ${requireText ? 'disabled' : ''}>${esc(confirmLabel)}</button>
        </div>`,
    });
    const ok = s.el.querySelector('[data-ok]');
    if (requireText) {
      s.el.querySelector('[data-confirm-text]').addEventListener('input', (e) => { ok.disabled = e.target.value.trim() !== requireText; });
    }
    ok.addEventListener('click', () => { finish(true); s.close(); });
  });
}

// ---------- Toasts ----------

export function toast(message, { type = 'success', action = null, duration = 3500 } = {}) {
  const host = document.getElementById('toast-root');
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.setAttribute('role', type === 'error' ? 'alert' : 'status');
  el.innerHTML = `${icon(type === 'error' ? 'alert' : type === 'info' ? 'info' : 'check', 18)}<span>${esc(message)}</span>
    ${action ? `<button class="toast-action">${esc(action.label)}</button>` : ''}`;
  host.appendChild(el);
  const remove = () => { el.classList.add('out'); setTimeout(() => el.remove(), 200); };
  if (action) el.querySelector('.toast-action').addEventListener('click', () => { action.fn(); remove(); });
  setTimeout(remove, action ? Math.max(duration, 5000) : duration);
  while (host.children.length > 3) host.firstChild.remove();
}

// ---------- Celebrations ----------

let lastPointer = null;
document.addEventListener('pointerdown', (e) => { lastPointer = { x: e.clientX, y: e.clientY, t: Date.now() }; }, true);

export function xpFloat(amount) {
  const el = document.createElement('div');
  el.className = `xp-float ${amount < 0 ? 'neg' : ''}`;
  el.textContent = `${amount > 0 ? '+' : ''}${amount} XP`;
  el.setAttribute('aria-hidden', 'true');
  const p = lastPointer && Date.now() - lastPointer.t < 1500 ? lastPointer : { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  el.style.left = `${Math.min(window.innerWidth - 60, Math.max(60, p.x))}px`;
  el.style.top = `${p.y - 10}px`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1200);
}

export function levelUpModal(level, rank, onClose) {
  const s = openSheet({
    title: null,
    size: 'small celebrate',
    labelledBy: 'lvl-title',
    onClose,
    body: `<div class="celebrate-body">
      <div class="burst" aria-hidden="true">${Array.from({ length: 12 }, (_, i) => `<i style="--i:${i}"></i>`).join('')}</div>
      <div class="level-badge big">${level}</div>
      <p class="eyebrow">Level up</p>
      <h2 id="lvl-title">You reached level ${level}</h2>
      <p class="muted">Rank: <strong>${esc(rank)}</strong>. Every level is built from real actions you took.</p>
      <button class="btn primary block" data-dismiss autofocus>Keep going</button>
    </div>`,
  });
  return s;
}

export function achievementPopup(name, xp) {
  const host = document.getElementById('toast-root');
  const el = document.createElement('div');
  el.className = 'toast toast-achievement';
  el.setAttribute('role', 'status');
  el.innerHTML = `<span class="ach-icon">${icon('trophy', 18)}</span><span><strong>Achievement unlocked</strong><br>${esc(name)} · +${xp} XP</span>`;
  host.appendChild(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 200); }, 4500);
}
