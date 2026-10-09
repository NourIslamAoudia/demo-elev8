'use strict';
/* =========================================================
   ELEV8 — coquille applicative : navigation, barres, gardes
   ========================================================= */
const NAV = {};      // NAV[role]() -> [{ title, items:[{label, ic, href, badge, tag, locked}] }]
const TOPBAR = {};   // TOPBAR[role]() -> boutons supplémentaires
const BANNERS = {};  // BANNERS[role](path) -> bandeaux contextuels
const BOTTOM = {};   // BOTTOM[role](path) -> barre d'onglets mobile

const meCoach = () => (S.role === 'coach' ? coachById(S.userId) : null);
const meAthlete = () => athleteById(S.role === 'coach' ? S.previewAthleteId : S.userId);
const meAdmin = () => adminById(S.adminId) || DB.admins[0];
const can = (perm) => { const r = DB.adminRoles[S.adminRole] || DB.adminRoles.super; return r.perms.includes('*') || r.perms.includes(perm); };
const isPreview = () => S.role === 'coach' && !!S.previewAthleteId;
const coachPlan = (c) => DB.plans.coach.find((p) => p.id === (c || meCoach() || {}).plan) || DB.plans.coach[0];
const planRank = { trial: 0, start: 1, pro: 2, elite: 3 };
const hasPlan = (min, c = meCoach()) => c && planRank[c.plan] >= planRank[min];

function athleteBrand(a = meAthlete()) {
  const c = a && a.coachId ? coachById(a.coachId) : null;
  if (c && c.plan === 'elite' && c.branding && c.branding.enabled) return { custom: true, name: c.branding.logoText || c.brand, accent: c.branding.accent || '#C5F23A', coach: c };
  return null;
}

const Layout = {
  home() { return S.role === 'coach' ? '/coach/dashboard' : S.role === 'athlete' ? '/athlete/home' : S.role === 'admin' ? '/admin/dashboard' : '/'; },
  guard(r, path) {
    if (r.role === 'coach') {
      if (S.role !== 'coach' || !meCoach()) return `/login?next=${encodeURIComponent(path)}`;
      if (S.previewAthleteId) S.previewAthleteId = null;
    }
    if (r.role === 'athlete') {
      const ok = (S.role === 'athlete' && athleteById(S.userId)) || (S.role === 'coach' && S.previewAthleteId && athleteById(S.previewAthleteId));
      if (!ok) return `/login?next=${encodeURIComponent(path)}`;
    }
    if (r.role === 'admin' && (S.role !== 'admin' || !S.admin2fa)) return '/admin-login';
    return null;
  },
  render(r, out, path) {
    if (r.layout === 'bare') return `<div class="page-scroll"><div class="view">${out.html}</div></div>`;
    if (DB.platform.maintenance && (r.role === 'coach' || r.role === 'athlete')) return Layout.maintenance();
    if (r.layout === 'focus') return `<div class="focus" style="position:relative"><div class="focus-main"><div class="view">${out.html}</div></div>${out.bottom || ''}</div>`;
    return Layout.shell(r, out, path);
  },
  activeHref(groups, path) {
    let best = ''; groups.forEach((g) => g.items.forEach((it) => { if (it.href && (path === it.href || path.startsWith(`${it.href}/`)) && it.href.length > best.length) best = it.href; }));
    return best;
  },
  shell(r, out, path) {
    const role = r.role; const preview = role === 'athlete' && S.role === 'coach';
    const groups = NAV[role] ? NAV[role]() : [];
    const active = Layout.activeHref(groups, path);
    const brand = role === 'athlete' ? athleteBrand() : null;
    const user = role === 'coach' ? meCoach() : role === 'athlete' ? meAthlete() : meAdmin();
    const roleLabel = role === 'coach' ? `Coach · ${PLAN_NAMES[user.plan]}` : role === 'athlete' ? (user.coachId ? 'Athlète' : 'Athlète solo') : DB.adminRoles[S.adminRole].label;
    const nav = groups.map((g) => `<div class="nav-group">${g.title ? `<div class="nav-group-title">${g.title}</div>` : ''}${g.items.map((it) => `<a class="nav-item ${it.href === active ? 'active' : ''} ${it.locked ? 'locked' : ''}" href="#${it.href}" data-action="nav-close-link">${icon(it.ic, 18)}<span class="grow truncate">${it.label}</span>${it.locked ? icon('lock', 13) : it.badge ? `<span class="nav-badge">${it.badge}</span>` : it.tag ? `<span class="nav-tag">${it.tag}</span>` : ''}</a>`).join('')}</div>`).join('');
    const sub = role === 'coach' ? user.brand : role === 'athlete' ? (user.coachId ? `Coach : ${fullName(coachById(user.coachId))}` : 'Sans coach') : user.email;
    const n = Notif.unread();
    const sidebar = `<aside class="sidebar" style="${brand ? `--brand-accent:${brand.accent}` : ''}"><div class="side-brand">${brand ? `<span class="logo brand-custom" title="Marque du coach (formule Elite)">${esc(brand.name)}</span>` : '<a class="logo" href="#/">ELEV<b>8</b></a>'}<span class="side-role">${roleLabel}</span></div><nav class="side-nav">${nav}</nav><div class="side-foot"><button class="side-user" data-action="user-menu">${avatar(user, 'sm')}<div class="grow" style="min-width:0"><div class="nm truncate">${esc(fullName(user))}</div><div class="sub truncate">${esc(sub || '')}</div></div>${icon('moreV', 16)}</button></div></aside>`;
    const topbar = `<header class="topbar"><button class="top-btn hamburger" data-action="nav-toggle" aria-label="Menu">${icon('menu')}</button><div class="top-title">${out.crumb ? `<span class="top-crumb">${out.crumb} / </span>` : ''}${stripTags(out.title || '')}</div><div class="top-actions">${TOPBAR[role] ? TOPBAR[role]() : ''}<button class="top-btn" data-action="theme-toggle" title="Mode clair / sombre" aria-label="Changer de thème">${icon(S.theme === 'dark' ? 'sun' : 'moon')}</button><button class="top-btn" data-action="notif-open-pop" title="Notifications" aria-label="Notifications">${icon('bell')}${n ? `<span class="dot">${n}</span>` : ''}</button><button class="top-btn hide-sm" data-action="user-menu" title="Mon compte">${avatar(user, 'xs')}</button></div></header>`;
    const pv = preview ? `<div class="banner banner-dark">${icon('eye', 17)}<div><b>Aperçu côté athlète</b> — vous voyez exactement l’espace de ${esc(fullName(user))}.</div><div class="banner-actions"><select class="select sm" style="width:auto;min-width:170px" data-preview-switch>${DB.athletes.filter((a) => a.coachId === S.userId && a.status !== 'pre').map((a) => `<option value="${a.id}" ${a.id === user.id ? 'selected' : ''}>${esc(fullName(a))}</option>`).join('')}</select><button class="btn btn-accent btn-sm" data-action="preview-exit">${icon('logout', 15)} Quitter l’aperçu</button></div></div>` : '';
    const banners = BANNERS[role] ? BANNERS[role](path) : '';
    const bottom = BOTTOM[role] ? BOTTOM[role](path) : '';
    return `<div class="shell" style="${brand ? `--brand-accent:${brand.accent}` : ''}">${sidebar}<div class="scrim" data-action="nav-close"></div><div class="main">${pv}${topbar}${banners}<main class="content"><div class="view">${out.html}</div></main></div>${bottom}</div>`;
  },
  maintenance() {
    return `<div class="maint"><div style="max-width:460px"><div class="logo" style="font-size:28px">ELEV<b>8</b></div><h1 class="mt-20" style="color:#fff">Maintenance en cours</h1><p class="mt-8" style="color:#AEB4C0">L’application est temporairement indisponible pendant une mise à jour. Vos données sont en sécurité, revenez dans quelques minutes.</p><div class="row wrap mt-24" style="justify-content:center"><button class="btn btn-accent" data-action="demo-login" data-role="admin" data-id="ad1">${icon('shield', 16)} Espace Super Admin</button><a class="btn btn-outline" style="background:transparent;color:#fff" href="#/">Accueil</a></div><p class="xs mt-16" style="color:#7D8594">Mode maintenance activé depuis Super Admin › Paramètres.</p></div></div>`;
  },
};

Object.assign(Actions, {
  'nav-close-link': (el) => { const sh = $('.shell'); if (sh) sh.classList.remove('nav-open'); go(el.getAttribute('href').slice(1)); },
  'user-menu': (el) => {
    const role = S.role; const isCoach = role === 'coach' && !isPreview();
    openPopover(el, `<div class="pop-h"><span>Mon compte</span><span class="pill">${role === 'admin' ? 'Super Admin' : role === 'coach' ? 'Coach' : 'Athlète'}</span></div>
      ${isCoach ? `<a class="pop-item" href="#/coach/settings/profil" data-pop-close>${icon('user', 16)} Profil & paramètres</a><button class="pop-item" data-action="preview-athlete" data-pop-close>${icon('eye', 16)} Aperçu côté athlète</button><a class="pop-item" href="#/coach/help" data-pop-close>${icon('help', 16)} Assistance</a>` : ''}
      ${role === 'athlete' ? `<a class="pop-item" href="#/athlete/settings" data-pop-close>${icon('settings', 16)} Réglages</a><a class="pop-item" href="#/athlete/help" data-pop-close>${icon('help', 16)} Aide</a>` : ''}
      ${isPreview() ? `<button class="pop-item" data-action="preview-exit" data-pop-close>${icon('logout', 16)} Quitter l’aperçu</button>` : ''}
      ${role === 'admin' ? `<a class="pop-item" href="#/admin/settings" data-pop-close>${icon('settings', 16)} Paramètres plateforme</a>` : ''}
      <div class="pop-sep"></div><button class="pop-item" data-action="demo-open" data-pop-close>${icon('users', 16)} Changer de compte (démo)</button><button class="pop-item" data-action="logout" data-pop-close>${icon('logout', 16)} Se déconnecter</button>`, { width: 270 });
  },
  logout: () => { Object.assign(S, { role: null, userId: null, adminId: null, admin2fa: false, previewAthleteId: null }); saveSession(); closeAllModals(); go('/'); toast('Vous êtes déconnecté·e', 'info'); },
  'preview-athlete': () => {
    const c = meCoach(); const first = DB.athletes.find((a) => a.coachId === c.id && a.status === 'active');
    if (!first) { toast('Ajoutez d’abord un client pour utiliser l’aperçu', 'info'); return; }
    S.previewAthleteId = first.id; go('/athlete/home');
  },
  'preview-exit': () => { S.previewAthleteId = null; go('/coach/dashboard'); },
  'demo-login': (el) => { closeAllModals(); Auth.loginAs(el.dataset.role, el.dataset.id); },
});
document.addEventListener('change', (e) => {
  if (e.target.matches && e.target.matches('[data-preview-switch]')) { S.previewAthleteId = e.target.value; rerender(); }
});
