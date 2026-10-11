// Lightweight, responsive charts built from HTML/CSS and SVG (no libraries).
import { esc, fmtNum } from './util.js';
import { fmtDay, addDays, weekStart, diffDays } from './dates.js';

/** Circular progress ring. */
export function ring(pct, { size = 112, stroke = 10, label = '', sub = '' } = {}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(100, pct || 0));
  return `<div class="ring" style="width:${size}px;height:${size}px" role="img" aria-label="${esc(`${Math.round(p)}% ${sub}`)}">
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--track)" stroke-width="${stroke}"/>
      <circle class="ring-bar" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="url(#ringGrad)" stroke-width="${stroke}"
        stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - p / 100)}" transform="rotate(-90 ${size / 2} ${size / 2})"/>
    </svg>
    <div class="ring-label"><strong>${esc(label)}</strong>${sub ? `<span>${esc(sub)}</span>` : ''}</div>
  </div>`;
}

/**
 * Vertical bar chart. data: [{ label, value, title? }]
 * Labels are thinned automatically so they stay readable on narrow screens.
 */
export function barChart(data, { height = 160, format = fmtNum, highlightLast = true, ariaLabel = 'Bar chart', target = null } = {}) {
  if (!data.length) return '';
  const max = Math.max(1, target || 0, ...data.map((d) => d.value));
  const every = data.length > 16 ? Math.ceil(data.length / 8) : data.length > 8 ? 2 : 1;
  const summary = data.map((d) => `${d.title || d.label}: ${format(d.value)}`).join(', ');
  const targetLine = target ? `<div class="bar-target" style="bottom:${(target / max) * 100}%"><span>Target ${format(target)}</span></div>` : '';
  return `<figure class="bars" role="img" aria-label="${esc(ariaLabel + '. ' + summary)}">
    <div class="bars-plot" style="height:${height}px">${targetLine}
      ${data.map((d, i) => `<div class="bar-col" title="${esc(`${d.title || d.label}: ${format(d.value)}`)}">
        <div class="bar ${highlightLast && i === data.length - 1 ? 'bar-hi' : ''} ${d.value < 0 ? 'bar-neg' : ''}" style="height:${Math.max(d.value > 0 ? 2 : 0, (Math.max(0, d.value) / max) * 100)}%"></div>
      </div>`).join('')}
    </div>
    <div class="bars-labels" aria-hidden="true">${data.map((d, i) => `<span>${i % every === 0 || i === data.length - 1 ? esc(d.label) : ''}</span>`).join('')}</div>
  </figure>`;
}

/** Cumulative line vs. linear target pace. points: [{ label, value }] */
export function lineChart(points, { height = 170, target = null, format = fmtNum, ariaLabel = 'Line chart', upto = points.length } = {}) {
  if (!points.length) return '';
  const max = Math.max(1, target || 0, ...points.map((p) => p.value)) * 1.05;
  const n = points.length;
  const x = (i) => (n === 1 ? 50 : (i / (n - 1)) * 100);
  const y = (v) => 100 - (v / max) * 100;
  const shown = points.slice(0, upto);
  const path = shown.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(2)},${y(p.value).toFixed(2)}`).join(' ');
  const area = shown.length ? `${path} L${x(shown.length - 1).toFixed(2)},100 L0,100 Z` : '';
  const pace = target ? `<path d="M0,100 L100,${y(target).toFixed(2)}" class="line-pace" vector-effect="non-scaling-stroke"/>` : '';
  const last = shown[shown.length - 1];
  return `<figure class="line" role="img" aria-label="${esc(`${ariaLabel}. Latest: ${last ? format(last.value) : 'no data'}${target ? `, target ${format(target)}` : ''}`)}">
    <div class="line-plot" style="height:${height}px">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <defs><linearGradient id="lineFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="var(--accent)" stop-opacity=".35"/><stop offset="1" stop-color="var(--accent)" stop-opacity="0"/></linearGradient></defs>
        ${pace}
        ${area ? `<path d="${area}" fill="url(#lineFill)" stroke="none"/>` : ''}
        ${path ? `<path d="${path}" class="line-main" vector-effect="non-scaling-stroke"/>` : ''}
      </svg>
      <span class="line-max">${format(Math.round(max / 1.05))}</span>
    </div>
    <div class="bars-labels" aria-hidden="true"><span>${esc(points[0].label)}</span><span>${esc(points[Math.floor((n - 1) / 2)].label)}</span><span>${esc(points[n - 1].label)}</span></div>
    ${target ? '<figcaption class="legend"><span class="lgd lgd-main"></span>Actual <span class="lgd lgd-pace"></span>Target pace</figcaption>' : ''}
  </figure>`;
}

/** Horizontal labelled bars, e.g. category breakdown. rows: [{ label, value, color }] */
export function hbars(rows, { format = fmtNum } = {}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return `<ul class="hbars">${rows.map((r) => `<li>
    <div class="hbar-head"><span><i class="dot" style="background:${r.color}"></i>${esc(r.label)}</span><strong>${format(r.value)}</strong></div>
    <div class="progress sm"><div style="width:${(r.value / max) * 100}%;background:${r.color}"></div></div></li>`).join('')}</ul>`;
}

/** Activity heatmap for the last `weeks` weeks ending today. level(day) → 0..4 */
export function heatmap(today, weeks, valueFor, { describe = (d, v) => `${fmtDay(d)}: ${v}` } = {}) {
  const end = today;
  const start = addDays(weekStart(today), -(weeks - 1) * 7);
  const cells = [];
  for (let d = start; d <= addDays(weekStart(today), 6); d = addDays(d, 1)) {
    if (d > end) { cells.push('<span class="hm-cell hm-future"></span>'); continue; }
    const { level, value } = valueFor(d);
    cells.push(`<span class="hm-cell hm-${level}" title="${esc(describe(d, value))}"></span>`);
  }
  const active = diffDays(start, end) + 1;
  return `<div class="heatmap" role="img" aria-label="Activity heatmap for the last ${active} days">
    <div class="hm-days" aria-hidden="true"><span>M</span><span></span><span>W</span><span></span><span>F</span><span></span><span></span></div>
    <div class="hm-grid" style="grid-template-columns:repeat(${weeks},1fr)">${cells.join('')}</div>
  </div>
  <div class="hm-legend" aria-hidden="true">Less <span class="hm-cell hm-0"></span><span class="hm-cell hm-1"></span><span class="hm-cell hm-2"></span><span class="hm-cell hm-3"></span><span class="hm-cell hm-4"></span> More</div>`;
}
