'use strict';
/* =========================================================
   ELEV8 — composants visuels : graphiques, calendrier,
   schéma du corps, vignettes d'exercices / aliments / produits
   ========================================================= */

/* ---------- Charts (HTML + SVG hybride, responsive sans mesure) ---------- */
function niceScale(lo, hi, count = 4) {
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) { lo = 0; hi = 1; }
  if (lo === hi) { if (lo === 0) hi = 1; else { lo *= 0.9; hi *= 1.1; } }
  const raw = (hi - lo) / count; const mag = 10 ** Math.floor(Math.log10(raw)); const n = raw / mag;
  const step = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * mag;
  const min = Math.floor(lo / step + 1e-9) * step; let max = Math.ceil(hi / step - 1e-9) * step;
  if (max <= min) max = min + step;
  const ticks = []; for (let v = min; v <= max + step / 2; v += step) ticks.push(round(v, 6));
  return { min, max, ticks };
}
const SERIES = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)', 'var(--s5)', 'var(--s6)', 'var(--s7)', 'var(--s8)'];
const Charts = {
  legend(series, kind = 'line') { return `<div class="ch-legend">${series.map((s) => `<span><i class="${kind === 'rect' ? 'rect' : ''}" style="background:${s.color}"></i>${esc(s.name)}</span>`).join('')}</div>`; },
  xLabels(labels, X) {
    const n = labels.length; const every = Math.max(1, Math.ceil(n / 8));
    return labels.map((l, i) => ((n - 1 - i) % every === 0 ? `<span style="left:${X(i)}%">${esc(l)}</span>` : '')).join('');
  },
  empty(height, text = 'Pas encore de données') { return `<div class="chart" style="height:${height}px;display:grid;place-items:center"><span class="small dim">${text}</span></div>`; },
  line({ labels, series, height = 220, yFmt = (v) => fmt.num(v), tipFmt = null, area = true, yMin = null, yMax = null, target = null, endLabels = false }) {
    const vals = series.flatMap((s) => s.values).filter((v) => v != null && Number.isFinite(v));
    if (!vals.length) return Charts.empty(height);
    let lo = yMin ?? Math.min(...vals); let hi = yMax ?? Math.max(...vals);
    if (target) { lo = Math.min(lo, target.value); hi = Math.max(hi, target.value); }
    if (yMin == null) { const pad = (hi - lo) * 0.15 || Math.abs(hi) * 0.05 || 1; lo -= pad; if (lo < 0 && Math.min(...vals) >= 0) lo = 0; }
    if (yMax == null) hi += (hi - lo) * 0.08 || 1;
    const sc = niceScale(lo, hi, 4); const n = labels.length;
    const X = (i) => (n <= 1 ? 50 : (i / (n - 1)) * 100);
    const Y = (v) => 100 - ((v - sc.min) / (sc.max - sc.min)) * 100;
    const grid = sc.ticks.map((t) => `<div class="ch-grid" style="top:${Y(t)}%"><span>${esc(yFmt(t))}</span></div>`).join('');
    const paths = series.map((s) => {
      const pts = s.values.map((v, i) => (v == null || !Number.isFinite(v) ? null : [X(i), Y(v)]));
      let d = ''; let started = false;
      pts.forEach((p) => { if (!p) { started = false; return; } d += `${started ? 'L' : 'M'}${p[0].toFixed(2)},${p[1].toFixed(2)} `; started = true; });
      let a = '';
      const valid = pts.filter(Boolean);
      if (area && series.length === 1 && valid.length > 1) a = `<path class="ar" style="fill:${s.color}" d="M${valid[0][0].toFixed(2)},100 ${valid.map((p) => `L${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' ')} L${valid[valid.length - 1][0].toFixed(2)},100 Z"/>`;
      return `${a}<path class="ln ${s.dash ? 'dash' : ''}" style="stroke:${s.color}" d="${d}"/>`;
    }).join('');
    const half = n <= 1 ? 50 : 50 / (n - 1);
    const cols = labels.map((l, i) => {
      const left = clamp(X(i) - half, 0, 100); const right = clamp(X(i) + half, 0, 100); const w = right - left || 100;
      const gl = ((X(i) - left) / w) * 100;
      const rows = series.map((s) => (s.values[i] == null ? '' : `<div class="tt-r"><i style="background:${s.color}"></i><b>${esc((tipFmt || yFmt)(s.values[i]))}</b>${s.name ? `<span>${esc(s.name)}</span>` : ''}</div>`)).join('');
      const dots = series.map((s) => (s.values[i] == null ? '' : `<b class="ch-dot" style="left:${gl}%;top:${Y(s.values[i])}%;background:${s.color}"></b>`)).join('');
      return `<div class="ch-col" style="left:${left}%;width:${w}%" data-tip-html="${esc(`<div class="tt-h">${esc(l)}</div>${rows}`)}"><i class="ch-guide" style="left:${gl}%"></i>${dots}</div>`;
    }).join('');
    const ends = series.map((s) => {
      let i = s.values.length - 1; while (i >= 0 && (s.values[i] == null || !Number.isFinite(s.values[i]))) i--;
      if (i < 0) return '';
      return `<b class="ch-end" style="left:${X(i)}%;top:${Y(s.values[i])}%;background:${s.color}"></b>${endLabels ? `<span class="ch-endlabel" style="left:${X(i)}%;top:${Y(s.values[i])}%">${esc(yFmt(s.values[i]))}</span>` : ''}`;
    }).join('');
    const tgt = target ? `<div class="ch-target" style="top:${Y(target.value)}%"><span>${esc(target.label)}</span></div>` : '';
    return `<div class="chart" style="height:${height}px"><div class="ch-area"><div class="ch-plot">${grid}<div class="ch-base"></div><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${paths}</svg>${tgt}${ends}${cols}</div><div class="ch-x">${Charts.xLabels(labels, X)}</div></div></div>${series.length > 1 ? Charts.legend(series, 'line') : ''}`;
  },
  bars({ labels, series, height = 220, yFmt = (v) => fmt.num(v), tipFmt = null, stacked = false, showValues = false, yMax = null }) {
    const n = labels.length;
    if (!n) return Charts.empty(height);
    const totals = labels.map((_, i) => (stacked ? sum(series, (s) => s.values[i] || 0) : Math.max(0, ...series.map((s) => s.values[i] || 0))));
    const sc = niceScale(0, yMax ?? (Math.max(...totals) || 1), 4);
    const H = (v) => ((v || 0) / sc.max) * 100;
    const grid = sc.ticks.map((t) => `<div class="ch-grid" style="top:${100 - H(t)}%"><span>${esc(yFmt(t))}</span></div>`).join('');
    const groups = labels.map((l, i) => {
      const rows = series.map((s) => `<div class="tt-r"><i style="background:${s.color}"></i><b>${esc((tipFmt || yFmt)(s.values[i] || 0))}</b>${s.name ? `<span>${esc(s.name)}</span>` : ''}</div>`).join('');
      const inner = stacked
        ? `<div class="ch-stack" style="height:${H(totals[i])}%">${series.map((s) => (s.values[i] ? `<div class="seg-b" style="flex:${s.values[i]} 1 0;background:${s.color}"></div>` : '')).join('')}</div>`
        : series.map((s) => `<i class="ch-bar" style="height:${H(s.values[i])}%;background:${s.color}">${showValues && s.values[i] ? `<span class="ch-bval">${esc(yFmt(s.values[i]))}</span>` : ''}</i>`).join('');
      return `<div class="ch-bgroup" data-tip-html="${esc(`<div class="tt-h">${esc(l)}</div>${rows}`)}">${inner}</div>`;
    }).join('');
    const X = (i) => ((i + 0.5) / n) * 100;
    return `<div class="chart" style="height:${height}px"><div class="ch-area"><div class="ch-plot">${grid}<div class="ch-base"></div><div class="ch-bars">${groups}</div></div><div class="ch-x">${Charts.xLabels(labels, X)}</div></div></div>${series.length > 1 ? Charts.legend(series, 'rect') : ''}`;
  },
  donut({ items, size = 168, thick = 22, center = '', centerLabel = '', fmtV = (v) => fmt.num(v) }) {
    const total = sum(items, (x) => x.value) || 1; const r = (size - thick) / 2; const C = 2 * Math.PI * r; let acc = 0;
    const segs = items.map((it) => {
      const len = (it.value / total) * C; const gap = items.filter((x) => x.value > 0).length > 1 ? Math.min(2, len / 2) : 0;
      const tip = `<div class="tt-h">${esc(it.label)}</div><div class="tt-r"><i style="background:${it.color}"></i><b>${esc(fmtV(it.value))}</b><span>${fmt.num((it.value / total) * 100, 1)} %</span></div>`;
      const s = `<circle class="seg" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${it.color}" stroke-width="${thick}" stroke-dasharray="${Math.max(0, len - gap)} ${C}" stroke-dashoffset="${-acc}" data-tip-html="${esc(tip)}"/>`;
      acc += len; return s;
    }).join('');
    const legend = `<div class="donut-legend">${items.map((it) => `<div class="dl"><i style="background:${it.color}"></i><span>${esc(it.label)}</span><b class="num">${esc(fmtV(it.value))}</b><span class="dim xs num">${fmt.num((it.value / total) * 100, 0)} %</span></div>`).join('')}</div>`;
    return `<div class="donut-wrap"><div class="donut" style="width:${size}px;height:${size}px"><svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--surface-3)" stroke-width="${thick}"/>${segs}</svg><div class="donut-center"><b>${center}</b><span>${centerLabel}</span></div></div>${legend}</div>`;
  },
  ring(p, { size = 92, stroke = 9, color = 'var(--s1)', label = '', sub = '', track = 'var(--surface-3)' } = {}) {
    const r = (size - stroke) / 2; const C = 2 * Math.PI * r; const off = C * (1 - clamp(p, 0, 100) / 100);
    return `<div class="ring" style="width:${size}px;height:${size}px"><svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${track}" stroke-width="${stroke}"/><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${C.toFixed(2)}" stroke-dashoffset="${off.toFixed(2)}"/></svg><div class="ring-c"><b>${label}</b>${sub ? `<span>${sub}</span>` : ''}</div></div>`;
  },
  spark(values, color = 'var(--s1)', h = 36) {
    const v = values.filter((x) => Number.isFinite(x)); if (v.length < 2) return '';
    const lo = Math.min(...v); const hi = Math.max(...v); const Y = (x) => 92 - ((x - lo) / (hi - lo || 1)) * 84;
    const d = values.map((x, i) => `${i ? 'L' : 'M'}${((i / (values.length - 1)) * 100).toFixed(2)},${Y(x).toFixed(2)}`).join(' ');
    return `<svg class="spark" style="height:${h}px" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="${d}" fill="none" stroke="${color}" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
  },
  hbars(items, { fmtV = (v) => fmt.num(v), color = 'var(--s1)' } = {}) {
    const max = Math.max(1, ...items.map((i) => i.value));
    return items.map((it) => `<div class="hbar" data-tip="${esc(`${it.label} : ${fmtV(it.value)}`)}"><span class="truncate small">${esc(it.label)}</span><div class="track"><span style="width:${(it.value / max) * 100}%;background:${it.color || color}"></span></div><b class="small num">${esc(fmtV(it.value))}</b></div>`).join('');
  },
};

/* ---------- Calendar (mois / semaine / jour / liste) ---------- */
const Cal = {
  render(key, events, { onEvent = 'cal-event', extraHead = '', views = ['month', 'week', 'day', 'list'], defaultView = 'month' } = {}) {
    const st = ui(key, { view: defaultView, date: ymd(new Date()) });
    const d = parseYmd(st.date);
    let title; let body;
    if (st.view === 'month') { title = fmt.monthYear(d); body = Cal.month(d, events, key, onEvent); }
    else if (st.view === 'week') { const s = startOfWeek(d); title = `Semaine du ${fmt.dm(s)} au ${fmt.dm(addDays(s, 6))}`; body = Cal.timeGrid(Array.from({ length: 7 }, (_, i) => addDays(s, i)), events, onEvent); }
    else if (st.view === 'day') { title = fmt.dateFull(d); body = Cal.timeGrid([d], events, onEvent); }
    else { title = `À partir du ${fmt.dm(d)}`; body = Cal.list(d, events, onEvent); }
    const vl = { month: 'Mois', week: 'Semaine', day: 'Jour', list: 'Liste' };
    return `<div class="cal-head"><div class="row gap-4"><button type="button" class="icon-btn" data-action="cal-nav" data-key="${key}" data-dir="-1" aria-label="Précédent">${icon('chevL')}</button><button type="button" class="btn btn-outline btn-sm" data-action="cal-nav" data-key="${key}" data-dir="0">Aujourd’hui</button><button type="button" class="icon-btn" data-action="cal-nav" data-key="${key}" data-dir="1" aria-label="Suivant">${icon('chevR')}</button></div><div class="cal-title">${title}</div><div class="ml-auto row wrap">${extraHead}${seg(views.map((v) => [v, vl[v]]), st.view, key, 'view', 'sm')}</div></div>${body}`;
  },
  byDay(events) { const m = {}; events.forEach((e) => { const k = ymd(e.start); (m[k] = m[k] || []).push(e); }); Object.values(m).forEach((l) => l.sort((a, b) => new Date(a.start) - new Date(b.start))); return m; },
  evBtn(ev, onEvent) { return `<button type="button" class="cal-ev ${ev.done ? 'done' : ''}" style="--evc:${ev.color || 'var(--s1)'}" data-action="${onEvent}" data-id="${esc(ev.id)}" title="${esc(ev.title)}">${ev.allDay ? '' : `<b>${fmt.time(ev.start)}</b> `}${esc(ev.title)}</button>`; },
  month(d, events, key, onEvent) {
    const start = startOfWeek(startOfMonth(d)); const today = ymd(new Date()); const by = Cal.byDay(events);
    let count = 42; if (addDays(start, 35).getMonth() !== d.getMonth()) count = 35;
    const cells = Array.from({ length: count }, (_, i) => addDays(start, i)).map((c) => {
      const k = ymd(c); const evs = by[k] || [];
      return `<div class="cal-cell ${c.getMonth() !== d.getMonth() ? 'other' : ''} ${k === today ? 'today' : ''}"><span class="cal-dn" data-action="cal-day" data-key="${key}" data-date="${k}">${c.getDate()}</span>${evs.slice(0, 3).map((ev) => Cal.evBtn(ev, onEvent)).join('')}${evs.length > 3 ? `<div class="cal-more" data-action="cal-day" data-key="${key}" data-date="${k}">+${evs.length - 3} autre${evs.length > 4 ? 's' : ''}</div>` : ''}</div>`;
    }).join('');
    return `<div class="cal-month">${DOW.map((x) => `<div class="cal-dow">${x}</div>`).join('')}${cells}</div>`;
  },
  timeGrid(days, events, onEvent) {
    const H0 = 7; const H1 = 21; const HH = 46; const today = ymd(new Date()); const by = Cal.byDay(events);
    const head = `<div class="cal-wh"></div>${days.map((d) => `<div class="cal-wh ${ymd(d) === today ? 'today' : ''}">${fmt.weekday(d)} <b>${d.getDate()}</b></div>`).join('')}`;
    const hours = `<div class="cal-hours">${Array.from({ length: H1 - H0 }, (_, i) => `<div class="cal-hour">${H0 + i}:00</div>`).join('')}</div>`;
    const cols = days.map((d) => {
      const evs = (by[ymd(d)] || []).map((ev) => {
        const s = new Date(ev.start); const top = clamp(((s.getHours() + s.getMinutes() / 60) - H0) * HH, 0, (H1 - H0) * HH - 20); const h = Math.max(22, ((ev.duration || 60) / 60) * HH - 3);
        return `<button type="button" class="cal-wev" style="top:${top}px;height:${h}px;--evc:${ev.color || 'var(--s1)'}" data-action="${onEvent}" data-id="${esc(ev.id)}"><b>${esc(ev.title)}</b><span class="xs dim">${fmt.time(ev.start)}${ev.sub ? ` · ${esc(ev.sub)}` : ''}</span></button>`;
      }).join('');
      let now = '';
      if (ymd(d) === today) { const n = new Date(); const t = ((n.getHours() + n.getMinutes() / 60) - H0) * HH; if (t > 0 && t < (H1 - H0) * HH) now = `<div class="cal-now" style="top:${t}px"></div>`; }
      return `<div class="cal-daycol">${Array.from({ length: H1 - H0 }, () => '<div class="cal-slot"></div>').join('')}${evs}${now}</div>`;
    }).join('');
    return `<div class="cal-week-wrap"><div class="cal-week ${days.length === 1 ? 'day' : ''}" style="grid-template-columns:52px repeat(${days.length}, minmax(${days.length > 1 ? 104 : 200}px, 1fr))">${head}${hours}${cols}</div></div>`;
  },
  list(d, events, onEvent) {
    const from = startDay(d); const to = addDays(from, 45);
    const evs = events.filter((e) => new Date(e.start) >= from && new Date(e.start) < to).sort((a, b) => new Date(a.start) - new Date(b.start));
    if (!evs.length) return emptyState('calendar', 'Aucun événement', 'Rien de prévu sur les 45 prochains jours.');
    const by = Cal.byDay(evs);
    return Object.keys(by).sort().map((k) => `<div class="cal-list-day"><h4>${fmt.dateFull(parseYmd(k))}</h4>${by[k].map((ev) => `<button type="button" class="cal-litem" style="--evc:${ev.color || 'var(--s1)'}" data-action="${onEvent}" data-id="${esc(ev.id)}"><span class="bar"></span><span class="semibold nowrap">${fmt.time(ev.start)}</span><span class="grow"><span class="semibold">${esc(ev.title)}</span>${ev.sub ? `<span class="xs dim"> · ${esc(ev.sub)}</span>` : ''}</span>${ev.done ? statusPill('done', 'Terminé') : ''}</button>`).join('')}</div>`).join('');
  },
};
Actions['cal-nav'] = (el) => {
  const st = ui(el.dataset.key); const dir = Number(el.dataset.dir); const d = parseYmd(st.date);
  if (dir === 0) st.date = ymd(new Date());
  else if (st.view === 'month') st.date = ymd(addMonths(startOfMonth(d), dir));
  else if (st.view === 'week') st.date = ymd(addDays(d, 7 * dir));
  else if (st.view === 'day') st.date = ymd(addDays(d, dir));
  else st.date = ymd(addDays(d, 14 * dir));
  rerender();
};
Actions['cal-day'] = (el) => { const st = ui(el.dataset.key); st.date = el.dataset.date; st.view = 'day'; rerender(); };

/* ---------- Schéma du corps (avant / arrière) ---------- */
const BodyMap = {
  svg(muscles = [], { cls = '' } = {}) {
    const on = new Set(muscles);
    const m = (name, shape) => shape.replace('/>', ` class="m ${on.has(name) ? 'on' : ''}"><title>${name}</title></${shape.match(/^<(\w+)/)[1]}>`);
    const base = (shape) => shape.replace('/>', ' class="base"/>');
    const front = [
      base('<circle cx="60" cy="20" r="13"/>'), base('<rect x="54" y="31" width="12" height="9" rx="3"/>'), base('<rect x="40" y="40" width="40" height="62" rx="11"/>'),
      base('<rect x="23" y="56" width="11" height="28" rx="5"/>'), base('<rect x="86" y="56" width="11" height="28" rx="5"/>'),
      base('<rect x="21" y="84" width="10" height="26" rx="5"/>'), base('<rect x="89" y="84" width="10" height="26" rx="5"/>'),
      base('<rect x="42" y="98" width="36" height="16" rx="7"/>'), base('<rect x="45" y="158" width="11" height="44" rx="5"/>'), base('<rect x="64" y="158" width="11" height="44" rx="5"/>'),
      base('<ellipse cx="50" cy="206" rx="7" ry="4"/>'), base('<ellipse cx="70" cy="206" rx="7" ry="4"/>'),
      m('Deltoïdes', '<ellipse cx="37" cy="48" rx="9" ry="8"/>'), m('Deltoïdes', '<ellipse cx="83" cy="48" rx="9" ry="8"/>'),
      m('Pectoraux', '<ellipse cx="51" cy="54" rx="10" ry="8"/>'), m('Pectoraux', '<ellipse cx="69" cy="54" rx="10" ry="8"/>'),
      m('Abdominaux', '<rect x="53.5" y="64" width="13" height="31" rx="4"/>'), m('Core', '<rect x="43" y="66" width="9" height="27" rx="4"/>'), m('Core', '<rect x="68" y="66" width="9" height="27" rx="4"/>'),
      m('Biceps', '<ellipse cx="28.5" cy="68" rx="5" ry="10"/>'), m('Biceps', '<ellipse cx="91.5" cy="68" rx="5" ry="10"/>'),
      m('Quadriceps', '<rect x="43" y="112" width="15" height="46" rx="7"/>'), m('Quadriceps', '<rect x="62" y="112" width="15" height="46" rx="7"/>'),
    ];
    const back = [
      base('<circle cx="180" cy="20" r="13"/>'), base('<rect x="174" y="31" width="12" height="9" rx="3"/>'), base('<rect x="160" y="40" width="40" height="62" rx="11"/>'),
      base('<rect x="143" y="56" width="11" height="28" rx="5"/>'), base('<rect x="206" y="56" width="11" height="28" rx="5"/>'),
      base('<rect x="141" y="84" width="10" height="26" rx="5"/>'), base('<rect x="209" y="84" width="10" height="26" rx="5"/>'),
      base('<rect x="162" y="98" width="36" height="16" rx="7"/>'), base('<rect x="164.5" y="158" width="11" height="44" rx="5"/>'), base('<rect x="184.5" y="158" width="11" height="44" rx="5"/>'), base('<ellipse cx="170" cy="206" rx="7" ry="4"/>'), base('<ellipse cx="190" cy="206" rx="7" ry="4"/>'),
      m('Trapèzes', '<polygon points="167,36 193,36 205,46 180,60 155,46"/>'),
      m('Deltoïdes', '<ellipse cx="157" cy="48" rx="9" ry="8"/>'), m('Deltoïdes', '<ellipse cx="203" cy="48" rx="9" ry="8"/>'),
      m('Rhomboïdes', '<polygon points="173,52 187,52 184,66 176,66"/>'),
      m('Dorsaux', '<ellipse cx="168" cy="73" rx="9" ry="14"/>'), m('Dorsaux', '<ellipse cx="192" cy="73" rx="9" ry="14"/>'),
      m('Core', '<rect x="173" y="85" width="14" height="13" rx="4"/>'),
      m('Triceps', '<ellipse cx="148.5" cy="68" rx="5" ry="10"/>'), m('Triceps', '<ellipse cx="211.5" cy="68" rx="5" ry="10"/>'),
      m('Fessiers', '<ellipse cx="171" cy="107" rx="10" ry="9"/>'), m('Fessiers', '<ellipse cx="189" cy="107" rx="10" ry="9"/>'),
      m('Ischio-jambiers', '<rect x="163" y="118" width="15" height="40" rx="7"/>'), m('Ischio-jambiers', '<rect x="182" y="118" width="15" height="40" rx="7"/>'),
      m('Mollets', '<ellipse cx="170" cy="178" rx="6.5" ry="16"/>'), m('Mollets', '<ellipse cx="190" cy="178" rx="6.5" ry="16"/>'),
    ];
    return `<svg class="bodymap ${cls}" viewBox="0 0 240 228" role="img" aria-label="Muscles travaillés : ${esc(muscles.join(', ') || 'aucun')}">${front.join('')}${back.join('')}<text x="60" y="224" text-anchor="middle">AVANT</text><text x="180" y="224" text-anchor="middle">ARRIÈRE</text></svg>`;
  },
};

/* ---------- Vignettes ---------- */
const PATTERN_ART = {
  Squat: ['#2a78d6', '#0e2b55', '🏋️'], Hinge: ['#6d4bd8', '#241052', '🏋️‍♀️'], Push: ['#eb6834', '#5a1c06', '💪'], Pull: ['#0891b2', '#082f3c', '🧗'],
  Carry: ['#b7791f', '#3b2404', '🧳'], Core: ['#16a34a', '#052e16', '🔥'], Cardio: ['#e34948', '#4a0616', '🏃'], Mobilité: ['#1baf7a', '#063f30', '🤸'],
  Compound: ['#4a3aa7', '#191540', '⚡'], Isolation: ['#d55181', '#4d0722', '🎯'],
};
const SPORT_ART = { Natation: '🏊', Athlétisme: '🏃‍♂️' };
function exArt(ex) { const a = PATTERN_ART[(ex && ex.pattern)] || PATTERN_ART.Compound; return { t1: a[0], t2: a[1], e: (ex && SPORT_ART[ex.sport]) || a[2] }; }
function ytId(url) { const m = String(url || '').match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{6,})/); return m ? m[1] : null; }
const Thumb = {
  ex(ex, { badges = true, size = '' } = {}) {
    if (!ex) return '';
    const a = exArt(ex); const md = ex.media || {};
    const img = md.image && Uploads[md.image] ? `<img src="${Uploads[md.image].url}" alt="">` : '';
    const vid = md.video || md.videoFile || md.youtube;
    return `<div class="thumb ${size}" style="--t1:${a.t1};--t2:${a.t2}">${img || `<span class="te">${a.e}</span>`}${badges && size !== 'sm' && vid ? `<span class="tb">${icon(md.youtube && !md.video ? 'youtube' : 'play', 10)} ${md.youtube && !md.video ? 'YouTube' : 'Vidéo'}</span>` : ''}${badges && size !== 'sm' && ex.unilateral ? '<span class="tb r">Unilatéral</span>' : ''}</div>`;
  },
};
const VMock = {
  html(ex, { autoplay = false, tag = '' } = {}) {
    if (!ex) return '';
    const a = exArt(ex); const md = ex.media || {};
    if (md.videoFile && Uploads[md.videoFile]) return `<div class="vmock"><video src="${Uploads[md.videoFile].url}" controls playsinline ${autoplay ? 'autoplay muted loop' : ''}></video></div>`;
    if (md.youtube && !md.video) { const id = ytId(md.youtube); if (id) return `<div class="vmock" style="--t1:${a.t1};--t2:${a.t2}"><iframe src="https://www.youtube-nocookie.com/embed/${id}" title="Vidéo YouTube" allow="accelerometer; encrypted-media; picture-in-picture" allowfullscreen></iframe></div>`; }
    return `<div class="vmock ${autoplay ? 'playing' : ''}" style="--t1:${a.t1};--t2:${a.t2}" data-action="vmock-toggle" title="Lire / mettre en pause"><span class="vtag">${esc(tag || 'Vidéo de démonstration')}</span><span class="floor"></span><span class="fig">${a.e}</span><span class="vplay">${icon('play', 24)}</span><span class="vbar"><span></span></span></div>`;
  },
};
Actions['vmock-toggle'] = (el) => el.classList.toggle('playing');

const FOOD_BG = { Protéines: ['#f8e6d4', '#d79f74'], Glucides: ['#f8efd6', '#d9bd85'], Graisses: ['#eef1d8', '#b3be6e'], Laitiers: ['#eef4fa', '#b3c8de'], Légumes: ['#e6f4df', '#94c47f'], Personnalisé: ['#eceef2', '#bfc5cf'], menu: ['#f6eee2', '#d6c3a5'] };
const FoodTile = {
  ing(g, size = '') {
    if (!g) return '';
    const bg = FOOD_BG[g.cat] || FOOD_BG.Personnalisé;
    const img = g.photo && Uploads[g.photo] ? `<img src="${Uploads[g.photo].url}" alt="">` : '';
    if (!img && !g.emoji) return `<div class="food neutral ${size}" title="Image neutre (aucune photo)"><span class="fe">🍽️</span></div>`;
    return `<div class="food ${size}" style="--f1:${bg[0]};--f2:${bg[1]}">${img || `<span class="fe">${g.emoji}</span>`}${!size && !img && g.source === 'elev8' ? '<span class="ai" title="Photo illustrative générée par IA">IA</span>' : ''}</div>`;
  },
  emojisOf(items) {
    return unique((items || []).map((x) => {
      if (x.type === 'ing') { const g = ingById(x.id); return g && g.emoji; }
      if (x.type === 'menu') { const m = menuById(x.id); return m && FoodTile.emojisOf(m.items)[0]; }
      if (x.type === 'recipe') { const r = recipeById(x.id); return r && FoodTile.emojisOf(r.items)[0]; }
      return null;
    }).filter(Boolean)).slice(0, 4);
  },
  items(items, { size = '', photo = '', ai = false } = {}) {
    const img = photo && Uploads[photo] ? `<img src="${Uploads[photo].url}" alt="">` : '';
    const em = FoodTile.emojisOf(items);
    if (!img && !em.length) return `<div class="food neutral ${size}"><span class="fe">🍽️</span></div>`;
    return `<div class="food multi ${size}" style="--f1:${FOOD_BG.menu[0]};--f2:${FOOD_BG.menu[1]}">${img || `<span class="fe">${em.join('')}</span>`}${ai && !size && !img ? '<span class="ai" title="Photo illustrative générée par IA">IA</span>' : ''}</div>`;
  },
  menu(m, size = '') { return FoodTile.items(m.items, { size, photo: m.photo, ai: m.source === 'elev8' }); },
  recipe(r, size = '') { return FoodTile.items(r.items, { size, photo: r.photo, ai: r.source === 'elev8' }); },
};
const Cover = {
  listing(l) {
    const img = l.cover && Uploads[l.cover] ? `<img src="${Uploads[l.cover].url}" alt="">` : '';
    return `<div class="cover" style="--t1:${l.t1 || '#0F1115'};--t2:${l.t2 || '#2a78d6'}">${img || `<span>${l.emoji || '📘'}</span>`}<span class="ct">${esc(l.title)}</span></div>`;
  },
};
function prodStock(p) { return p.variants ? sum(p.variants.options, (o) => o.stock) : Number(p.stock) || 0; }
const ProdImg = {
  html(p, { big = false } = {}) {
    const img = p.photos && p.photos[0] && Uploads[p.photos[0]] ? `<img src="${Uploads[p.photos[0]].url}" alt="">` : '';
    const out = prodStock(p) <= 0;
    return `<div class="prod-img" style="${big ? 'font-size:96px' : ''}">${img || esc(p.emoji || '📦')}${out ? '<span class="soldout">ÉPUISÉ</span>' : ''}</div>`;
  },
};
