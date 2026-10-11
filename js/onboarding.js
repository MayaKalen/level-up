import { esc } from './util.js';
import { icon } from './icons.js';
import { THEMES, GOAL_EXAMPLES, STARTER_HABITS, CATEGORIES } from './defaults.js';
import * as store from './store.js';
import * as sync from './sync.js';
import { toast } from './ui.js';

const STEPS = 5;

export function showOnboarding() {
  const choices = {
    name: '', goals: [], lifeCategories: ['personal', 'career', 'health', 'learning'], themes: ['discipline', 'focus', 'confidence'], tone: 'balanced',
    habits: ['water', 'exercise', 'read'], workStart: '09:00', workEnd: '18:00', currency: 'INR', dailyXpTarget: 150, theme: 'dark',
  };
  let step = 0;
  const el = document.createElement('div');
  el.className = 'onboarding';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-labelledby', 'ob-title');
  document.body.appendChild(el);
  document.body.classList.add('modal-open');
  const app = document.getElementById('app');
  sync.preload().catch(() => {}); // warm up so the Google sign-in window isn't blocked
  app.inert = true;

  const chips = (name, items, selected) => `<div class="chip-row">${items.map((it) => `<label class="chip-check"><input type="checkbox" name="${name}" value="${it.id}" ${selected.includes(it.id) ? 'checked' : ''}><span>${esc(it.name)}</span></label>`).join('')}</div>`;

  const body = () => {
    switch (step) {
      case 0: return `<p class="eyebrow">Welcome to LEVEL UP</p><h1 id="ob-title">Your life, played like an RPG.</h1>
        <p class="muted">Complete missions, build habits and grow toward your goals. Every real action earns XP. Setup takes about a minute — or skip it and start now.</p>
        <label class="field"><span>What should we call your character?</span><input class="input lg" name="name" maxlength="40" value="${esc(choices.name)}" placeholder="Your name" autocomplete="given-name" autofocus></label>
        <div class="restore-box"><span class="muted small">Already use LEVEL UP on another device?</span>
          <button type="button" class="btn ghost sm" data-ob="restore">${icon('user', 15)} Sign in to restore progress</button></div>`;
      case 1: return `<p class="eyebrow">Step 2 of ${STEPS}</p><h1 id="ob-title">What are you working toward?</h1>
        <p class="muted">Pick any that fit. They become editable goals.</p>
        ${chips('goals', GOAL_EXAMPLES.map((g) => ({ id: g.key, name: g.title })), choices.goals)}
        <p class="field-label">Life areas that matter most</p>
        ${chips('lifeCategories', CATEGORIES, choices.lifeCategories)}`;
      case 2: return `<p class="eyebrow">Step 3 of ${STEPS}</p><h1 id="ob-title">What keeps you going?</h1>
        <p class="muted">Your daily message draws on these themes.</p>
        ${chips('themes', THEMES, choices.themes)}
        <p class="field-label">Tone</p>
        <div class="segmented three">${[['gentle', 'Gentle'], ['balanced', 'Balanced'], ['direct', 'Direct']].map(([v, n]) => `<label><input type="radio" name="tone" value="${v}" ${choices.tone === v ? 'checked' : ''}><span>${n}</span></label>`).join('')}</div>`;
      case 3: return `<p class="eyebrow">Step 4 of ${STEPS}</p><h1 id="ob-title">Pick a few habits</h1>
        <p class="muted">Start small. You can change targets, add or remove habits anytime.</p>
        ${chips('habits', STARTER_HABITS.map((h) => ({ id: h.key, name: h.name })), choices.habits)}`;
      default: return `<p class="eyebrow">Step 5 of ${STEPS}</p><h1 id="ob-title">Final touches</h1>
        <div class="grid-2">
          <label class="field"><span>Work starts</span><input class="input" type="time" name="workStart" value="${choices.workStart}"></label>
          <label class="field"><span>Work ends</span><input class="input" type="time" name="workEnd" value="${choices.workEnd}"></label>
          <label class="field"><span>Sales currency</span><select class="input" name="currency"><option value="INR" ${choices.currency === 'INR' ? 'selected' : ''}>INR (₹)</option><option value="USD" ${choices.currency === 'USD' ? 'selected' : ''}>USD ($)</option></select></label>
          <label class="field"><span>Daily XP target</span><input class="input" type="number" min="10" max="5000" name="dailyXpTarget" value="${choices.dailyXpTarget}"><small class="hint">About 4–6 missions a day.</small></label>
        </div>
        <p class="field-label">Appearance</p>
        <div class="segmented two">${[['dark', 'Dark'], ['light', 'Light']].map(([v, n]) => `<label><input type="radio" name="theme" value="${v}" ${choices.theme === v ? 'checked' : ''}><span>${n}</span></label>`).join('')}</div>`;
    }
  };

  const capture = () => {
    const form = el.querySelector('form');
    if (!form) return;
    const fd = new FormData(form);
    const multi = ['goals', 'lifeCategories', 'themes', 'habits'];
    for (const k of multi) if (form.querySelector(`[name=${k}]`)) choices[k] = fd.getAll(k);
    for (const k of ['name', 'tone', 'workStart', 'workEnd', 'currency', 'dailyXpTarget', 'theme']) if (fd.has(k)) choices[k] = fd.get(k);
    if (choices.theme) document.documentElement.dataset.theme = choices.theme;
  };

  const finish = (skipped) => {
    if (!skipped) capture();
    const dx = Number(choices.dailyXpTarget);
    store.finishOnboarding(skipped ? { skipped: true, name: String(el.querySelector('[name=name]')?.value || '').trim() } : { ...choices, name: String(choices.name).trim() || 'Adventurer', dailyXpTarget: Number.isFinite(dx) ? dx : 150, themes: choices.themes.length ? choices.themes : undefined });
    el.remove();
    app.inert = false;
    document.body.classList.remove('modal-open');
    document.getElementById('main')?.focus();
  };

  const close = () => {
    el.remove();
    app.inert = false;
    document.body.classList.remove('modal-open');
    document.getElementById('main')?.focus();
  };

  async function restore(btn) {
    const label = btn.innerHTML;
    btn.disabled = true;
    btn.textContent = 'Signing in…';
    try {
      const r = await sync.signIn({ preferCloud: true });
      if (r === 'cloud' || r === 'linked') { close(); toast('Welcome back — your progress is restored'); return; }
      if (r === 'empty') {
        btn.textContent = 'Signed in ✓';
        toast('No saved progress in this account yet. Finish setup and it will be backed up automatically.', { type: 'info', duration: 6000 });
        return;
      }
    } catch (e) {
      toast(e.message, { type: 'error', duration: 7000 });
    }
    btn.disabled = false;
    btn.innerHTML = label;
  }

  const draw = () => {
    el.innerHTML = `<form class="ob-card" novalidate>
      <div class="ob-progress" aria-hidden="true">${Array.from({ length: STEPS }, (_, i) => `<span class="${i <= step ? 'on' : ''}"></span>`).join('')}</div>
      <div class="ob-body">${body()}</div>
      <div class="ob-actions">
        ${step === 0 ? '<button type="button" class="btn ghost" data-ob="skip">Skip setup</button>' : '<button type="button" class="btn ghost" data-ob="back">Back</button>'}
        <button type="submit" class="btn primary">${step === STEPS - 1 ? `${icon('sparkles', 18)} Start my adventure` : `Continue ${icon('chevronRight', 18)}`}</button>
      </div>
      ${step > 0 ? '<button type="button" class="link-btn small center ob-skip" data-ob="skip">Skip the rest and use defaults</button>' : ''}
    </form>`;
    const f = el.querySelector('[autofocus]') || el.querySelector('h1');
    if (f) { if (f.tagName === 'H1') f.setAttribute('tabindex', '-1'); f.focus(); }
  };

  el.addEventListener('submit', (e) => {
    e.preventDefault();
    capture();
    if (step < STEPS - 1) { step++; draw(); } else finish(false);
  });
  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-ob]');
    if (!b) return;
    if (b.dataset.ob === 'back') { capture(); step = Math.max(0, step - 1); draw(); }
    if (b.dataset.ob === 'restore') { restore(b); return; }
    if (b.dataset.ob === 'skip') {
      if (step > 0) { capture(); finish(false); } else finish(true);
    }
  });
  draw();
}
