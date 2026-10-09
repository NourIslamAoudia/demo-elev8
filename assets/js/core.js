'use strict';
/* =========================================================
   ELEV8 — noyau : utilitaires, état, routeur, primitives UI
   ========================================================= */

/* ---------- Helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const stripTags = (s) => String(s ?? '').replace(/<[^>]*>/g, '');
let __uid = 5000;
const uid = (p = 'id') => `${p}${++__uid}`;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sum = (arr, f = (x) => x) => (arr || []).reduce((a, x) => a + (Number(f(x)) || 0), 0);
const avg = (arr, f = (x) => x) => (arr && arr.length ? sum(arr, f) / arr.length : 0);
const round = (n, d = 0) => { const p = 10 ** d; return Math.round((Number(n) || 0) * p) / p; };
const roundTo = (n, step) => Math.round(n / step) * step;
const unique = (arr) => [...new Set(arr)];
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const hashStr = (s) => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- Dates ---------- */
const DAY_MS = 864e5;
const DOW = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const DOW_LONG = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const today0 = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const startDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const addMonths = (d, n) => { const x = new Date(d); x.setMonth(x.getMonth() + n); return x; };
const ymd = (d) => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
const parseYmd = (s) => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1); };
const startOfWeek = (d) => { const x = startDay(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
const startOfMonth = (d) => { const x = startDay(d); x.setDate(1); return x; };
const daysBetween = (a, b) => Math.round((startDay(b) - startDay(a)) / DAY_MS);
const isSameDay = (a, b) => ymd(a) === ymd(b);
const dowIndex = (d) => (new Date(d).getDay() + 6) % 7;
const isPast = (d) => new Date(d) < new Date();
const ageFrom = (birth) => { const b = new Date(birth), n = new Date(); let a = n.getFullYear() - b.getFullYear(); if (n < new Date(n.getFullYear(), b.getMonth(), b.getDate())) a--; return a; };
const atTime = (d, hhmm) => { const [h, m] = String(hhmm).split(':').map(Number); const x = new Date(d); x.setHours(h || 0, m || 0, 0, 0); return x; };

/* ---------- Formatting (fr-FR) ---------- */
const NF = {};
const nf = (opts) => { const k = JSON.stringify(opts); return NF[k] || (NF[k] = new Intl.NumberFormat('fr-FR', opts)); };
const fmt = {
  num: (n, d = 0) => nf({ maximumFractionDigits: d, minimumFractionDigits: 0 }).format(Number(n) || 0),
  fix: (n, d = 1) => nf({ maximumFractionDigits: d, minimumFractionDigits: d }).format(Number(n) || 0),
  eur: (n, d) => { const v = Number(n) || 0; const dd = d ?? (Number.isInteger(round(v, 2)) ? 0 : 2); return nf({ style: 'currency', currency: 'EUR', minimumFractionDigits: dd, maximumFractionDigits: dd }).format(v); },
  pct: (n, d = 0) => `${fmt.num(n, d)} %`,
  kg: (n, d = 1) => `${fmt.num(n, d)} kg`,
  compact: (n) => (Math.abs(n) >= 1e6 ? `${fmt.num(n / 1e6, 1)} M` : Math.abs(n) >= 1e4 ? `${fmt.num(n / 1e3, 1)} k` : fmt.num(n)),
  tonnes: (kg) => (kg >= 1000 ? `${fmt.num(kg / 1000, 1)} t` : `${fmt.num(kg)} kg`),
  date: (d) => (d ? new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'),
  dateLong: (d) => new Date(d).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }),
  dateFull: (d) => new Date(d).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
  dm: (d) => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
  dmy: (d) => new Date(d).toLocaleDateString('fr-FR'),
  month: (d) => new Date(d).toLocaleDateString('fr-FR', { month: 'short' }).replace('.', ''),
  monthYear: (d) => new Date(d).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
  weekday: (d) => new Date(d).toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', ''),
  time: (d) => new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
  dt: (d) => (d ? `${fmt.date(d)} · ${fmt.time(d)}` : '—'),
  rel(d) {
    if (!d) return '—';
    const diff = (Date.now() - new Date(d).getTime()) / 1000; const a = Math.abs(diff);
    if (a < 60) return "à l'instant";
    let v;
    if (a < 3600) v = `${Math.round(a / 60)} min`;
    else if (a < 86400) v = `${Math.round(a / 3600)} h`;
    else if (a < 86400 * 30) v = `${Math.round(a / 86400)} j`;
    else return fmt.date(d);
    return diff < 0 ? `dans ${v}` : `il y a ${v}`;
  },
  dur(sec) { sec = Math.max(0, Math.round(sec)); const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60); return h ? `${h} h ${String(m).padStart(2, '0')}` : `${m} min`; },
  clock(sec) { sec = Math.max(0, Math.round(sec)); const m = Math.floor(sec / 60), s = sec % 60; return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`; },
};
const plural = (n, one, many) => `${fmt.num(n)} ${Math.abs(n) > 1 ? many || `${one}s` : one}`;

/* ---------- State ---------- */
const S = { role: null, userId: null, adminId: null, adminRole: 'super', admin2fa: false, theme: 'light', phone: false, previewAthleteId: null };
const UI = {};
const ui = (key, init = {}) => UI[key] || (UI[key] = typeof init === 'function' ? init() : { ...init });
function saveSession() {
  try { localStorage.setItem('elev8.session', JSON.stringify({ theme: S.theme, phone: S.phone, role: S.role, userId: S.userId, adminId: S.adminId, adminRole: S.adminRole, admin2fa: S.admin2fa })); } catch (e) { /* stockage indisponible */ }
}
function loadSession() {
  try { const s = JSON.parse(localStorage.getItem('elev8.session') || 'null'); if (s) Object.assign(S, s); } catch (e) { /* ignore */ }
  if (!S.theme) S.theme = window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
function applyTheme() { document.documentElement.setAttribute('data-theme', S.theme === 'dark' ? 'dark' : 'light'); }

/* ---------- Registries & global delegation ---------- */
const Actions = {};
const Forms = {};
document.addEventListener('click', (e) => {
  const t = e.target;
  if (!(t instanceof Element)) return;
  const chip = t.closest('[data-chips] [data-v]');
  if (chip) { onChipClick(chip); return; }
  const add = t.closest('[data-chip-add]');
  if (add) { onChipAdd(add); return; }
  const clear = t.closest('[data-dz-clear]');
  if (clear) { e.stopPropagation(); clearDropzone(clear.closest('[data-dropzone]')); return; }
  const dz = t.closest('[data-dropzone]');
  if (dz && !t.matches('input[type=file]') && !t.closest('video')) { $('input[type=file]', dz).click(); return; }
  const a = t.closest('[data-action]');
  if (a) {
    if (a.hasAttribute('disabled')) return;
    const fn = Actions[a.dataset.action];
    if (fn) { e.preventDefault(); try { fn(a, e); } catch (err) { console.error(err); toast("Oups, une erreur est survenue", 'error'); } }
    else console.warn('Action inconnue :', a.dataset.action);
    return;
  }
  const g = t.closest('[data-go]');
  if (g) { e.preventDefault(); closeAllModals(); go(g.dataset.go); }
});
document.addEventListener('submit', (e) => {
  const f = e.target.closest('form[data-form]');
  if (!f) return;
  e.preventDefault();
  const fn = Forms[f.dataset.form];
  if (fn) { try { fn(formValues(f), f, e); } catch (err) { console.error(err); toast("Oups, une erreur est survenue", 'error'); } }
});
document.addEventListener('change', async (e) => {
  const t = e.target;
  if (t.matches && t.matches('[data-dropzone] input[type=file]') && t.files && t.files[0]) {
    await fillDropzone(t.closest('[data-dropzone]'), t.files[0]);
    t.value = '';
  }
});
['dragenter', 'dragover'].forEach((ev) => document.addEventListener(ev, (e) => {
  const dz = e.target instanceof Element && e.target.closest('[data-dropzone]');
  if (dz) { e.preventDefault(); dz.classList.add('drag'); }
}));
['dragleave', 'drop'].forEach((ev) => document.addEventListener(ev, (e) => {
  const dz = e.target instanceof Element && e.target.closest('[data-dropzone]');
  if (!dz) return;
  dz.classList.remove('drag');
  if (ev === 'drop') { e.preventDefault(); const f = e.dataTransfer && e.dataTransfer.files[0]; if (f) fillDropzone(dz, f); }
}));
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (Pop) { closePopover(); return; }
  const top = ModalStack[ModalStack.length - 1];
  if (top && top.dismissible) closeModal(top);
});

/* Tooltips ([data-tip] text, or [data-tip-html] pre-escaped markup we build ourselves) */
(function tooltips() {
  let cur = null;
  const place = (x, y) => {
    const tip = $('#tip'), root = $('#root'); if (!tip || !root) return;
    const rr = root.getBoundingClientRect(); const tw = tip.offsetWidth, th = tip.offsetHeight;
    let left = x - rr.left + 14, top = y - rr.top + 14;
    if (left + tw > rr.width - 8) left = x - rr.left - tw - 14;
    if (top + th > rr.height - 8) top = y - rr.top - th - 14;
    tip.style.transform = `translate(${Math.max(8, left)}px, ${Math.max(8, top)}px)`;
  };
  document.addEventListener('pointermove', (e) => {
    const tip = $('#tip'); if (!tip) return;
    const el = e.target instanceof Element ? e.target.closest('[data-tip],[data-tip-html]') : null;
    if (!el) { if (cur) { tip.classList.remove('show'); cur = null; } return; }
    if (el !== cur) {
      cur = el;
      const h = el.getAttribute('data-tip-html');
      if (h != null) tip.innerHTML = h; else tip.textContent = el.getAttribute('data-tip');
      tip.classList.add('show');
    }
    place(e.clientX, e.clientY);
  });
  document.addEventListener('scroll', () => { const tip = $('#tip'); if (tip) tip.classList.remove('show'); cur = null; }, true);
})();

/* ---------- Router ---------- */
const Routes = [];
let curPath = null;
let leaveFns = [];
function route(path, view, opts = {}) {
  const keys = [];
  const src = path.replace(/\/:(\w+)(\?)?/g, (_, k, opt) => { keys.push(k); return opt ? '(?:/([^/]+))?' : '/([^/]+)'; });
  Routes.push({ path, re: new RegExp(`^${src}/?$`), keys, view, ...opts });
}
function parseHash() {
  const raw = location.hash.replace(/^#/, '') || '/';
  const qi = raw.indexOf('?');
  const path = (qi >= 0 ? raw.slice(0, qi) : raw) || '/';
  const query = Object.fromEntries(new URLSearchParams(qi >= 0 ? raw.slice(qi + 1) : ''));
  return { path, query };
}
function go(path) {
  if (location.hash === `#${path}`) render(); else location.hash = path;
}
function onLeave(fn) { leaveFns.push(fn); }
function render() {
  const { path, query } = parseHash();
  let r = null; const params = {};
  for (const x of Routes) {
    const m = path.match(x.re);
    if (m) { r = x; x.keys.forEach((k, i) => { params[k] = m[i + 1] !== undefined ? decodeURIComponent(m[i + 1]) : undefined; }); break; }
  }
  if (!r) { go(Layout.home()); return; }
  const redirect = Layout.guard(r, path, query);
  if (redirect) { go(redirect); return; }
  if (curPath !== path) {
    leaveFns.splice(0).forEach((f) => { try { f(); } catch (err) { console.error(err); } });
    closePopover();
  }
  let out;
  try { out = r.view(params, query); } catch (err) { console.error(err); out = { html: errorView(err) }; }
  if (out == null) return;
  if (typeof out === 'string') out = { html: out };
  const prev = $('#app .main, #app .page-scroll, #app .focus-main');
  const keep = curPath === path && prev ? prev.scrollTop : 0;
  document.body.dataset.layout = r.layout || 'shell';
  $('#app').innerHTML = Layout.render(r, out, path);
  document.title = `${stripTags(out.title || r.title || 'Prototype MVP')} · ELEV8`;
  curPath = path;
  const viewEl = $('#app .view');
  if (out.mount && viewEl) { try { out.mount(viewEl, params, query); } catch (err) { console.error(err); } }
  const sc = $('#app .main, #app .page-scroll, #app .focus-main');
  if (sc) sc.scrollTop = keep;
}
const rerender = () => render();
window.addEventListener('hashchange', render);
function errorView(err) {
  return `<div class="card card-pad" style="max-width:640px;margin:40px auto"><div class="row gap-12"><span class="li-ic red">${icon('alert')}</span><div><h3>Cette page n'a pas pu s'afficher</h3><p class="small muted mt-4">${esc(err && err.message)}</p></div></div><div class="mt-16"><button class="btn btn-outline btn-sm" onclick="history.back()">${icon('arrowL', 16)} Retour</button></div></div>`;
}

/* ---------- Modals / dialogs / popovers / toasts ---------- */
const ModalStack = [];
function openModal({ title = '', sub = '', body = '', footer = '', size = 'md', cls = '', onMount, onClose, dismissible = true, drawer = false } = {}) {
  const wrap = document.createElement('div');
  wrap.className = `modal-backdrop ${drawer ? 'drawer' : ''} ${cls}`;
  wrap.innerHTML = `<div class="modal modal-${size}" role="dialog" aria-modal="true">
    ${title ? `<div class="modal-header"><div class="grow"><h3>${title}</h3>${sub ? `<div class="sub">${sub}</div>` : ''}</div>${dismissible ? `<button type="button" class="icon-btn" data-close aria-label="Fermer">${icon('x')}</button>` : ''}</div>` : ''}
    <div class="modal-body">${body}</div>
    ${footer ? `<div class="modal-footer">${footer}</div>` : ''}
  </div>`;
  $('#overlay').appendChild(wrap);
  const m = { el: wrap, box: wrap.firstElementChild, onClose, dismissible, closed: false };
  m.close = () => closeModal(m);
  m.body = () => $('.modal-body', wrap);
  m.setBody = (html) => { $('.modal-body', wrap).innerHTML = html; };
  m.setFooter = (html) => { const f = $('.modal-footer', wrap); if (f) f.innerHTML = html; };
  ModalStack.push(m);
  let downOnBackdrop = false;
  wrap.addEventListener('mousedown', (e) => { downOnBackdrop = e.target === wrap; });
  wrap.addEventListener('click', (e) => {
    if (e.target === wrap && downOnBackdrop && m.dismissible) { m.close(); return; }
    if (e.target instanceof Element && e.target.closest('[data-close]')) m.close();
  });
  requestAnimationFrame(() => wrap.classList.add('open'));
  if (onMount) onMount(m.box, m);
  return m;
}
function closeModal(m = ModalStack[ModalStack.length - 1]) {
  if (!m || m.closed) return;
  m.closed = true;
  const i = ModalStack.indexOf(m); if (i >= 0) ModalStack.splice(i, 1);
  m.el.classList.remove('open');
  setTimeout(() => m.el.remove(), 180);
  if (m.onClose) m.onClose(m);
}
function closeAllModals() { [...ModalStack].reverse().forEach((m) => closeModal(m)); }
function confirmDialog({ title = 'Confirmer', message = '', confirm = 'Confirmer', danger = false, input = null } = {}) {
  return new Promise((resolve) => {
    let done = false;
    openModal({
      title, size: 'sm',
      body: `<p class="muted">${message}</p>${input ? `<div class="field mt-16"><label>${input.label}</label><textarea class="textarea" rows="3" placeholder="${esc(input.placeholder || '')}">${esc(input.value || '')}</textarea></div>` : ''}`,
      footer: `<button type="button" class="btn btn-ghost" data-close>Annuler</button><button type="button" class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-ok>${confirm}</button>`,
      onMount: (box, m) => {
        $('[data-ok]', box).addEventListener('click', () => {
          let v = true;
          if (input) { v = $('textarea', box).value.trim(); if (input.required && !v) { toast('Merci de préciser une raison', 'error'); return; } v = v || ' '; }
          done = true; m.close(); resolve(v);
        });
      },
      onClose: () => { if (!done) resolve(false); },
    });
  });
}
let Pop = null;
function openPopover(anchor, html, { width = 340, align = 'right', onMount } = {}) {
  closePopover();
  const root = $('#root'); const rr = root.getBoundingClientRect(); const ar = anchor.getBoundingClientRect();
  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:absolute;inset:0;';
  wrap.innerHTML = `<div class="pop-scrim"></div><div class="popover" style="width:${width}px">${html}</div>`;
  $('#overlay').appendChild(wrap);
  const pop = $('.popover', wrap);
  let left = align === 'right' ? ar.right - rr.left - pop.offsetWidth : ar.left - rr.left;
  left = clamp(left, 8, Math.max(8, rr.width - pop.offsetWidth - 8));
  let top = ar.bottom - rr.top + 8;
  if (top + pop.offsetHeight > rr.height - 8) top = Math.max(8, ar.top - rr.top - pop.offsetHeight - 8);
  pop.style.left = `${left}px`; pop.style.top = `${top}px`;
  $('.pop-scrim', wrap).addEventListener('click', closePopover);
  pop.addEventListener('click', (e) => { if (e.target instanceof Element && e.target.closest('[data-pop-close]')) setTimeout(closePopover, 0); });
  Pop = wrap;
  if (onMount) onMount(pop);
  return pop;
}
function closePopover() { if (Pop) { Pop.remove(); Pop = null; } }
function toast(msg, type = 'success', ms = 3000) {
  const box = $('#toasts'); if (!box) return;
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.innerHTML = `<span class="ti">${icon(type === 'error' ? 'x' : type === 'info' ? 'info' : 'check', 14)}</span><span>${msg}</span>`;
  box.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 260); }, ms);
}

/* ---------- Generic actions ---------- */
Object.assign(Actions, {
  'set-ui': (el) => { const st = ui(el.dataset.key); const v = el.dataset.value; st[el.dataset.field] = v === 'true' ? true : v === 'false' ? false : v; rerender(); },
  'toggle-ui': (el) => { const st = ui(el.dataset.key); st[el.dataset.field] = !st[el.dataset.field]; rerender(); },
  'nav-toggle': () => { const sh = $('.shell'); if (sh) sh.classList.toggle('nav-open'); },
  'nav-close': () => { const sh = $('.shell'); if (sh) sh.classList.remove('nav-open'); },
  'theme-toggle': () => { S.theme = S.theme === 'dark' ? 'light' : 'dark'; applyTheme(); saveSession(); rerender(); },
  back: () => history.back(),
  copy: (el) => { copyText(el.dataset.text || '').then(() => toast(el.dataset.msg || 'Copié dans le presse-papiers')); },
  info: (el) => toast(el.dataset.msg || 'Action simulée dans ce prototype', 'info'),
  'close-modal': () => closeModal(),
});

/* ---------- UI building blocks (return HTML strings) ---------- */
const AV_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#c98500', '#d55181', '#4a3aa7', '#e34948', '#0f766e', '#7c3aed', '#0891b2', '#b45309', '#be185d'];
const fullName = (p) => (p ? p.name || `${p.first || ''} ${p.last || ''}`.trim() : '—');
const firstName = (p) => (p ? p.first || fullName(p).split(' ')[0] : '');
const initials = (name) => String(name || '?').split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
function avatar(p, size = '') {
  if (!p) return `<span class="av ${size}" style="background:#8a90a0">?</span>`;
  const name = fullName(p);
  const img = p.photo && Uploads[p.photo] ? `<img src="${Uploads[p.photo].url}" alt="">` : '';
  return `<span class="av ${size}" style="background:${p.color || AV_COLORS[hashStr(name) % AV_COLORS.length]}" title="${esc(name)}">${img || esc(initials(name))}</span>`;
}
const STATUS = {
  active: ['Actif', 'green'], inactive: ['Inactif', 'amber'], ended: ['Terminé', 'red'], pre: ['Pré-inscrit', 'blue'], paused: ['En pause', 'amber'],
  suspended: ['Suspendu', 'red'], pending: ['En attente', 'amber'], approved: ['Approuvé', 'green'], rejected: ['Refusé', 'red'], none: ['Non soumis', ''],
  paid: ['Payée', 'green'], late: ['En retard', 'red'], failed: ['Échec', 'red'], refunded: ['Remboursée', 'violet'], shipped: ['Expédiée', 'green'],
  open: ['Ouvert', 'blue'], progress: ['En cours', 'amber'], resolved: ['Résolu', 'green'], signed: ['Signé', 'green'], expiring: ['Expire bientôt', 'amber'], expired: ['Expiré', 'red'],
  published: ['Publié', 'green'], draft: ['Brouillon', ''], unpublished: ['Retiré de la vente', ''], completed: ['Complété', 'green'], trial: ['Essai', 'violet'],
  todo: ['À contacter', 'blue'], contacted: ['Contacté', 'violet'], meeting: ['RDV planifié', 'amber'], converted: ['Converti', 'green'], lost: ['Perdu', 'red'],
  ok: ['Opérationnel', 'green'], degraded: ['Dégradé', 'amber'], down: ['En panne', 'red'], hidden: ['Masqué', ''], removed: ['Retiré', 'red'], dispute: ['Litige', 'red'],
  dismissed: ['Classé', ''], done: ['Fait', 'green'], modified: ['Modifié', 'amber'], skipped: ['Passé', 'red'], missed: ['Manquée', 'red'], scheduled: ['Prévue', 'blue'],
};
function statusPill(key, label) { const [l, tone] = STATUS[key] || [key, '']; return `<span class="pill ${tone ? `pill-${tone}` : ''}"><i class="badge-dot"></i>${esc(label || l)}</span>`; }
function pill(text, tone = '', ic = '') { return `<span class="pill ${tone ? `pill-${tone}` : ''}">${ic ? icon(ic, 12) : ''}${esc(text)}</span>`; }
function pageHead(title, sub = '', actions = '', back = '') {
  return `${back ? `<a class="back-link" href="#${back[0]}">${icon('arrowL', 16)} ${esc(back[1])}</a>` : ''}<div class="page-head"><div class="grow"><h1>${title}</h1>${sub ? `<p>${sub}</p>` : ''}</div>${actions ? `<div class="actions">${actions}</div>` : ''}</div>`;
}
function card(title, body, { actions = '', pad = true, cls = '', sub = '', footer = '' } = {}) {
  return `<section class="card ${cls}">${title ? `<div class="card-h"><div><h3>${title}</h3>${sub ? `<div class="sub">${sub}</div>` : ''}</div>${actions ? `<div class="row wrap">${actions}</div>` : ''}</div>` : ''}<div class="${pad ? 'card-b' : ''}">${body}</div>${footer ? `<div class="card-f">${footer}</div>` : ''}</section>`;
}
function kpi({ label, value, ic = '', tone = '', delta = null, deltaLabel = '', sub = '', invert = false, extra = '' }) {
  let d = '';
  if (delta != null && Number.isFinite(delta)) {
    const flat = Math.abs(delta) < 0.05; const up = delta > 0; const good = invert ? !up : up;
    d = `<span class="delta ${flat ? 'flat' : good ? 'up' : 'down'}">${icon(flat ? 'minus' : up ? 'trendUp' : 'trendDown', 14)}${up ? '+' : ''}${fmt.num(delta, 1)} %</span>`;
  }
  return `<div class="card kpi"><div class="kpi-top"><span class="kpi-label">${label}</span>${ic ? `<span class="kpi-ic ${tone}">${icon(ic, 17)}</span>` : ''}</div><div class="kpi-value">${value}</div>${d || sub || deltaLabel ? `<div class="kpi-sub">${d}${deltaLabel ? `<span>${deltaLabel}</span>` : ''}${sub ? `<span>${sub}</span>` : ''}</div>` : ''}${extra}</div>`;
}
function tabsNav(items, active, { base = null, key = null, field = 'tab' } = {}) {
  return `<nav class="tabs">${items.map((t) => {
    const cls = `tab ${t.id === active ? 'active' : ''}`;
    const inner = `${t.ic ? icon(t.ic, 15) : ''}${esc(t.label)}${t.count != null ? `<span class="tab-count">${t.count}</span>` : ''}`;
    return base != null ? `<a class="${cls}" href="#${base}/${t.id}">${inner}</a>` : `<button type="button" class="${cls}" data-action="set-ui" data-key="${key}" data-field="${field}" data-value="${t.id}">${inner}</button>`;
  }).join('')}</nav>`;
}
function seg(items, active, key, field, cls = '') {
  return `<div class="seg ${cls}">${items.map(([v, l]) => `<button type="button" class="${String(v) === String(active) ? 'active' : ''}" data-action="set-ui" data-key="${key}" data-field="${field}" data-value="${esc(v)}">${l}</button>`).join('')}</div>`;
}
function progress(p, color = '', cls = '') { return `<div class="progress ${cls}"><span style="width:${clamp(p, 0, 100)}%;${color ? `background:${color}` : ''}"></span></div>`; }
function emptyState(ic, title, text = '', action = '') { return `<div class="empty"><div class="empty-ic">${icon(ic, 26)}</div><h3>${title}</h3>${text ? `<p>${text}</p>` : ''}${action ? `<div class="mt-8">${action}</div>` : ''}</div>`; }
function notice(text, tone = 'blue', ic = 'info') { return `<div class="notice ${tone}">${icon(ic, 17)}<div>${text}</div></div>`; }
function field(label, control, hint = '', cls = '') { return `<div class="field ${cls}">${label ? `<label>${label}</label>` : ''}${control}${hint ? `<div class="hint">${hint}</div>` : ''}</div>`; }
function input(name, value = '', { type = 'text', placeholder = '', attrs = '', cls = '' } = {}) { return `<input class="input ${cls}" type="${type}" name="${name}" value="${esc(value)}" placeholder="${esc(placeholder)}" ${attrs}>`; }
function inputUnit(name, value, unit, { type = 'number', attrs = '', placeholder = '' } = {}) { return `<div class="input-wrap">${input(name, value, { type, attrs, placeholder })}<span class="suffix">${esc(unit)}</span></div>`; }
function select(name, options, value, attrs = '', cls = '') {
  return `<select class="select ${cls}" name="${name}" ${attrs}>${options.map((o) => { const [v, l] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(v)}" ${String(v) === String(value) ? 'selected' : ''}>${esc(l)}</option>`; }).join('')}</select>`;
}
function textarea(name, value = '', { rows = 3, placeholder = '', attrs = '' } = {}) { return `<textarea class="textarea" name="${name}" rows="${rows}" placeholder="${esc(placeholder)}" ${attrs}>${esc(value)}</textarea>`; }
function searchBox(name, value = '', placeholder = 'Rechercher…', attrs = '') { return `<label class="search">${icon('search', 16)}<input class="input" type="search" name="${name}" value="${esc(value)}" placeholder="${esc(placeholder)}" autocomplete="off" ${attrs}></label>`; }
function switchEl(name, checked, attrs = '') { return `<label class="switch"><input type="checkbox" name="${name}" ${checked ? 'checked' : ''} ${attrs}><span></span></label>`; }
function toggleRow(name, label, desc, checked, attrs = '') { return `<div class="toggle-row"><div class="grow"><div class="semibold">${label}</div>${desc ? `<div class="small muted mt-4">${desc}</div>` : ''}</div>${switchEl(name, checked, attrs)}</div>`; }
function checkbox(name, value, label, checked, attrs = '') { return `<label class="check"><input type="checkbox" name="${name}" value="${esc(value)}" data-group="1" ${checked ? 'checked' : ''} ${attrs}><span>${label}</span></label>`; }
function chips(name, options, selected, { multi = false, custom = true, cls = '' } = {}) {
  const sel = multi ? new Set(selected || []) : new Set(selected != null && selected !== '' ? [selected] : []);
  const opts = unique([...options, ...[...sel].filter((v) => !options.includes(v))]);
  return `<div class="chips ${cls}" data-chips data-name="${name}" data-multi="${multi ? 1 : 0}">${opts.map((o) => `<button type="button" class="chip ${sel.has(o) ? 'active' : ''}" data-v="${esc(o)}">${esc(o)}</button>`).join('')}${custom ? '<button type="button" class="chip chip-add" data-chip-add>+ Custom</button>' : ''}<input type="hidden" name="${name}" value="${esc([...sel].join('|'))}" ${multi ? 'data-multi="1"' : ''}></div>`;
}
function onChipClick(btn) {
  const box = btn.closest('[data-chips]'); if (!box) return;
  if (box.dataset.multi === '1') btn.classList.toggle('active');
  else { $$('[data-v]', box).forEach((b) => b.classList.remove('active')); btn.classList.add('active'); }
  syncChips(box);
}
function syncChips(box) {
  const hid = $('input[type=hidden]', box);
  hid.value = $$('[data-v].active', box).map((b) => b.dataset.v).join('|');
  hid.dispatchEvent(new Event('change', { bubbles: true }));
}
function onChipAdd(btn) {
  const box = btn.closest('[data-chips]');
  const inp = document.createElement('input');
  inp.className = 'chip-input'; inp.placeholder = 'Votre valeur…';
  btn.replaceWith(inp); inp.focus();
  let finished = false;
  const done = (commit) => {
    if (finished) return; finished = true;
    const v = inp.value.trim();
    if (commit && v) {
      const ex = $$('[data-v]', box).find((b) => b.dataset.v.toLowerCase() === v.toLowerCase());
      if (ex) { if (!ex.classList.contains('active')) onChipClick(ex); }
      else { const c = document.createElement('button'); c.type = 'button'; c.className = 'chip'; c.dataset.v = v; c.textContent = v; inp.before(c); onChipClick(c); }
    }
    inp.replaceWith(btn);
  };
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); done(true); } else if (e.key === 'Escape') { e.stopPropagation(); done(false); } });
  inp.addEventListener('blur', () => done(true));
}

/* Uploads (images become data URLs, videos object URLs — kept in memory only) */
const Uploads = {};
async function readUpload(file) {
  const id = uid('up'); const type = file.type || '';
  const url = type.startsWith('image') ? await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(file); }) : URL.createObjectURL(file);
  Uploads[id] = { url, type, name: file.name, size: file.size };
  return id;
}
function mediaPreview(id) { const u = Uploads[id]; if (!u) return ''; return u.type.startsWith('video') ? `<video src="${u.url}" muted playsinline controls></video>` : u.type.startsWith('image') ? `<img src="${u.url}" alt="">` : `<div class="dz-empty">${icon('file', 22)}<div class="small semibold">${esc(u.name)}</div></div>`; }
function dropzone({ name, accept = 'image/*', label = 'Image', hint = 'Glisser-déposer ou cliquer pour choisir', ic = 'image', value = '', compact = false, capture = '' } = {}) {
  return `<div class="dropzone ${value && Uploads[value] ? 'has' : ''} ${compact ? 'compact' : ''}" data-dropzone>
    <input type="file" accept="${accept}" ${capture ? `capture="${capture}"` : ''} hidden>
    <input type="hidden" name="${name}" value="${esc(value)}">
    <div class="dz-empty">${icon(ic, 22)}<div class="semibold small">${label}</div><div class="xs dim">${hint}</div></div>
    <div class="dz-prev">${value ? mediaPreview(value) : ''}<button type="button" class="dz-clear" data-dz-clear title="Retirer">${icon('x', 14)}</button></div>
  </div>`;
}
async function fillDropzone(dz, file) {
  const accept = ($('input[type=file]', dz).getAttribute('accept') || '').split(',')[0].trim();
  if (accept && accept.endsWith('/*') && !file.type.startsWith(accept.replace('/*', ''))) { toast('Format de fichier non accepté', 'error'); return; }
  const id = await readUpload(file);
  const hid = $('input[type=hidden]', dz); hid.value = id;
  const prev = $('.dz-prev', dz); prev.innerHTML = `${mediaPreview(id)}<button type="button" class="dz-clear" data-dz-clear title="Retirer">${icon('x', 14)}</button>`;
  dz.classList.add('has');
  hid.dispatchEvent(new Event('change', { bubbles: true }));
}
function clearDropzone(dz) {
  const hid = $('input[type=hidden]', dz); hid.value = '';
  dz.classList.remove('has');
  hid.dispatchEvent(new Event('change', { bubbles: true }));
}
function formValues(form) {
  const o = {};
  for (const el of form.elements) {
    if (!el.name || el.disabled) continue;
    if (el.type === 'checkbox') {
      if (el.dataset.group) { if (!o[el.name]) o[el.name] = []; if (el.checked) o[el.name].push(el.value); }
      else o[el.name] = el.checked;
    } else if (el.type === 'radio') { if (el.checked) o[el.name] = el.value; else if (!(el.name in o)) o[el.name] = ''; }
    else if (el.type === 'file') continue;
    else if (el.dataset.multi === '1') o[el.name] = el.value ? el.value.split('|') : [];
    else o[el.name] = el.value;
  }
  return o;
}
const lines = (s) => String(s || '').split('\n').map((x) => x.trim()).filter(Boolean);

/* ---------- Files, print, clipboard, sound ---------- */
function downloadFile(name, content, mime = 'text/plain') {
  const blob = content instanceof Blob ? content : new Blob([content], { type: `${mime};charset=utf-8` });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800);
}
function toCSV(rows) { return `﻿${rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';')).join('\r\n')}`; }
const PRINT_CSS = 'body{font-family:Inter,system-ui,"Segoe UI",Arial,sans-serif;color:#15171c;margin:0;padding:24px;font-size:12.5px;line-height:1.5}h1{font-size:22px;margin:0 0 4px}h2{font-size:15px;margin:20px 0 8px}h3{font-size:13px;margin:14px 0 6px}p{margin:0 0 6px}table{width:100%;border-collapse:collapse;margin:8px 0}th,td{border-bottom:1px solid #e3e5ea;padding:6px 8px;text-align:left;font-size:12px;vertical-align:top}th{background:#f4f5f7}.muted{color:#6b7180}.ph{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #0F1115;padding-bottom:14px;margin-bottom:16px}.logo{font-weight:800;font-size:20px}.logo b{display:inline-block;background:#C5F23A;padding:0 5px;border-radius:5px;margin-left:2px}.tot{text-align:right;font-size:15px;font-weight:800;margin-top:10px}.paper{max-width:none;padding:0;box-shadow:none}ul{padding-left:18px}@page{margin:14mm}';
function printHTML(title, html) {
  const ifr = document.createElement('iframe');
  ifr.setAttribute('aria-hidden', 'true');
  ifr.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  document.body.appendChild(ifr);
  const d = ifr.contentDocument;
  d.open(); d.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${esc(title)}</title><style>${PRINT_CSS}</style></head><body>${html}</body></html>`); d.close();
  const cleanup = () => setTimeout(() => ifr.remove(), 400);
  setTimeout(() => {
    try { ifr.contentWindow.onafterprint = cleanup; ifr.contentWindow.focus(); ifr.contentWindow.print(); } catch (err) { console.error(err); toast("L'impression n'est pas disponible ici", 'error'); }
    setTimeout(() => { if (ifr.isConnected) ifr.remove(); }, 60000);
  }, 250);
}
function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
  return Promise.resolve(fallbackCopy(text));
}
function fallbackCopy(text) {
  const ta = document.createElement('textarea'); ta.value = text; ta.style.cssText = 'position:fixed;opacity:0;';
  document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); } catch (e) { /* ignore */ }
  ta.remove();
}
const Sound = {
  ctx: null,
  beep(freq = 880, dur = 0.16, times = 1) {
    try {
      this.ctx = this.ctx || new (window.AudioContext || window.webkitAudioContext)();
      for (let i = 0; i < times; i++) {
        const o = this.ctx.createOscillator(); const g = this.ctx.createGain();
        o.type = 'sine'; o.frequency.value = freq; o.connect(g); g.connect(this.ctx.destination);
        const t = this.ctx.currentTime + i * (dur + 0.09);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.35, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.start(t); o.stop(t + dur + 0.03);
      }
    } catch (e) { /* audio indisponible */ }
  },
};
const vibrate = (p) => { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) { /* ignore */ } };
