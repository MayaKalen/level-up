import { esc, fmtNum } from '../util.js';
import { icon } from '../icons.js';
import { taskSections, completionsOnDay } from '../tasks.js';
import { THEMES } from '../defaults.js';
import { fmtDay, fmtTime } from '../dates.js';
import { xpBetween } from '../xp.js';
import { habitsMetOn } from '../habits.js';
import { opt } from '../forms.js';
import { quoteById } from '../motivation.js';
import * as store from '../store.js';
import { toast } from '../ui.js';

export function render({ state, today }) {
  const plan = state.plans[today] || {};
  const sec = taskSections(state, today);
  const pri = plan.priorities || ['', '', ''];
  const suggestions = [...sec.overdue, ...sec.today.filter((t) => t.status !== 'completed')].map((t) => t.title);
  const done = completionsOnDay(state, today);
  const review = plan.review || {};
  const past = Object.entries(state.plans).filter(([d, p]) => d < today && p.review?.completedAt).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 14);
  const xpToday = xpBetween(state.ledger, today, today);
  const q = state.motivation.current ? quoteById(state, state.motivation.current.id) : null;
  const question = state.settings.showReflection ? q?.question : '';

  return `
  <header class="page-head">
    <div><h1 class="page-title">Plan &amp; Review</h1><p class="muted small">${esc(fmtDay(today, { weekday: 'long', day: 'numeric', month: 'long' }))} · Working hours ${esc(fmtTime(state.settings.workStart))}–${esc(fmtTime(state.settings.workEnd))}</p></div>
  </header>

  <div class="grid-2 cards">
    <section class="card" aria-labelledby="plan-h">
      <h2 class="card-title" id="plan-h">${icon('sunrise', 18)} Morning plan</h2>
      <form class="form" data-form="plan">
        <fieldset class="field"><legend>Top three priorities</legend>
          <datalist id="pri-suggest">${suggestions.map((s) => `<option value="${esc(s)}">`).join('')}</datalist>
          ${[0, 1, 2].map((i) => `<label class="pri-input"><span class="pri-num" aria-hidden="true">${i + 1}</span><span class="sr-only">Priority ${i + 1}</span><input class="input" name="p${i}" maxlength="120" list="pri-suggest" value="${esc(pri[i] || '')}" placeholder="${i === 0 ? 'Most important thing today' : 'Optional'}"></label>`).join('')}
        </fieldset>
        <div class="grid-2">
          <label class="field"><span>Daily XP target</span><input class="input" type="number" min="10" max="5000" name="xpTarget" value="${esc(plan.xpTarget || state.settings.dailyXpTarget)}"><small class="err" data-err="xpTarget" role="alert"></small></label>
          <label class="field"><span>Focus theme</span><select class="input" name="focusTheme">${opt('', 'None', plan.focusTheme || '')}${THEMES.map((t) => opt(t.id, t.name, plan.focusTheme || '')).join('')}</select></label>
        </div>
        <div class="scheduled"><p class="eyebrow">Scheduled today</p>
          ${sec.today.length ? `<ul class="plain small">${sec.today.map((t) => `<li class="${t.status === 'completed' ? 'muted strike' : ''}">${t.dueTime ? `<span class="muted">${esc(fmtTime(t.dueTime))}</span> ` : ''}${esc(t.title)} <span class="muted">· ${t.xp} XP</span></li>`).join('')}</ul>` : '<p class="muted small">No missions scheduled yet. <button type="button" class="link-btn" data-action="new-task">Add one</button></p>'}
          ${sec.overdue.length ? `<p class="small warn-text">${sec.overdue.length} from earlier still open.</p>` : ''}
        </div>
        <button class="btn primary block" type="submit">${plan.savedAt ? 'Update plan' : 'Save plan'}</button>
      </form>
    </section>

    <section class="card" aria-labelledby="rev-h">
      <h2 class="card-title" id="rev-h">${icon('moon', 18)} End-of-day review</h2>
      <div class="review-sum">
        <span><strong>${done.length}</strong> missions done</span><span><strong>${habitsMetOn(state, today)}</strong> habits</span><span><strong>${fmtNum(xpToday)}</strong> XP</span>
      </div>
      ${done.length ? `<ul class="plain small done-list">${done.map((t) => `<li>${icon('check', 14)} ${esc(t.title)}</li>`).join('')}</ul>` : '<p class="muted small">No missions completed yet today — that’s okay. Reflection still counts.</p>'}
      <form class="form" data-form="review">
        ${question ? `<p class="reflect">${icon('book', 15)}<span><strong>Reflect:</strong> ${esc(question)}</span></p>` : ''}
        <label class="field"><span>A small win</span><input class="input" name="win" maxlength="200" value="${esc(review.win || '')}" placeholder="Something that went right"></label>
        <label class="field"><span>Journal <em>(private, optional)</em></span><textarea class="input" name="journal" rows="3" maxlength="3000">${esc(review.journal || '')}</textarea></label>
        <label class="field"><span>What I learned</span><input class="input" name="learned" maxlength="300" value="${esc(review.learned || '')}"></label>
        <label class="field"><span>What I’ll improve tomorrow</span><input class="input" name="improve" maxlength="300" value="${esc(review.improve || '')}"></label>
        <button class="btn primary block" type="submit">${review.completedAt ? 'Update review' : `Complete review · +${state.settings.xp.dailyReview} XP`}</button>
        <p class="muted small center">Your journal is stored only in this browser.</p>
      </form>
    </section>
  </div>

  ${past.length ? `<section class="card"><h2 class="card-title">Past reviews</h2>
    <div class="past-reviews">${past.map(([d, p]) => `<details class="more"><summary>${icon('chevronDown', 14)} ${esc(fmtDay(d))}${p.review.win ? ` — ${esc(p.review.win)}` : ''}</summary>
      <dl class="dl">${p.review.journal ? `<dt>Journal</dt><dd>${esc(p.review.journal)}</dd>` : ''}${p.review.learned ? `<dt>Learned</dt><dd>${esc(p.review.learned)}</dd>` : ''}${p.review.improve ? `<dt>Improve</dt><dd>${esc(p.review.improve)}</dd>` : ''}${(p.priorities || []).filter(Boolean).length ? `<dt>Priorities</dt><dd>${p.priorities.filter(Boolean).map(esc).join(' · ')}</dd>` : ''}</dl></details>`).join('')}</div>
  </section>` : ''}`;
}

export function bind(el, { today }) {
  el.querySelector('[data-form=plan]')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const xpTarget = Number(fd.get('xpTarget'));
    const err = e.target.querySelector('[data-err=xpTarget]');
    if (!Number.isInteger(xpTarget) || xpTarget < 10 || xpTarget > 5000) { err.textContent = 'Use a whole number from 10 to 5000.'; return; }
    err.textContent = '';
    store.savePlan(today, {
      priorities: [0, 1, 2].map((i) => String(fd.get(`p${i}`) || '').trim()),
      xpTarget, focusTheme: fd.get('focusTheme') || '', savedAt: new Date().toISOString(),
    });
    toast('Plan saved');
  });
  el.querySelector('[data-form=review]')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const wasDone = Boolean(store.getState().plans[today]?.review?.completedAt);
    store.completeReview(today, {
      win: String(fd.get('win') || '').trim(), journal: String(fd.get('journal') || '').trim(),
      learned: String(fd.get('learned') || '').trim(), improve: String(fd.get('improve') || '').trim(),
    });
    toast(wasDone ? 'Review updated' : 'Review complete — see you tomorrow');
  });
}

