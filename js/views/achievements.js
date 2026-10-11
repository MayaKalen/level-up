import { esc, fmtNum } from '../util.js';
import { icon } from '../icons.js';
import { achievementProgress } from '../achievements.js';
import { fmtDay } from '../dates.js';
import { progress } from '../components.js';

export function render({ state, today }) {
  const list = achievementProgress(state, today);
  const unlocked = list.filter((a) => a.unlocked);
  return `
  <header class="page-head">
    <div><h1 class="page-title">Achievements</h1><p class="muted small">${unlocked.length} of ${list.length} unlocked · calculated from your real records, each awarded once.</p></div>
  </header>
  ${progress((unlocked.length / list.length) * 100, { cls: 'xp', label: 'Achievements unlocked' })}
  <ul class="ach-grid">
    ${[...unlocked.sort((a, b) => b.unlocked.ts.localeCompare(a.unlocked.ts)), ...list.filter((a) => !a.unlocked)].map((a) => `
    <li class="card ach ${a.unlocked ? 'on' : ''}">
      <span class="ach-icon">${icon(a.unlocked ? a.icon : 'lock', 22)}</span>
      <div class="ach-body">
        <h3>${esc(a.name)}</h3>
        <p class="muted small">${esc(a.desc)}</p>
        ${a.unlocked ? `<p class="small ok-text">${icon('check', 14)} Earned ${esc(fmtDay(a.unlocked.day, { day: 'numeric', month: 'short', year: 'numeric' }))} · +${a.xp} XP</p>`
          : `<div class="row-between small"><span class="muted">${fmtNum(a.value)} / ${fmtNum(a.target)}</span><span class="muted">${a.xp} XP</span></div>${progress((a.value / a.target) * 100, { cls: 'sm', label: `${a.name} progress` })}`}
      </div>
    </li>`).join('')}
  </ul>`;
}
