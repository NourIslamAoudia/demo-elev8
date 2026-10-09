'use strict';
/* =========================================================
   ELEV8 — démarrage + panneau de démonstration
   (changer de compte, vue mobile, thème, réinitialisation)
   ========================================================= */
const DemoPanel = {
  html() {
    const cur = S.role === 'admin' ? S.adminId : S.role ? S.userId : null;
    const acc = DEMO_ACCOUNTS.map((d) => { const u = d.role === 'admin' ? adminById(d.id) : d.role === 'coach' ? coachById(d.id) : athleteById(d.id); return `<button class="demo-acc ${cur === d.id && S.role === d.role ? 'active' : ''}" data-action="demo-login" data-role="${d.role}" data-id="${d.id}">${avatar(u, 'sm')}<span>${esc(d.title)}<small>${esc(d.sub)}</small></span></button>`; }).join('');
    return `<div class="row between" style="padding:2px 4px"><span class="logo" style="font-size:17px">ELEV<b>8</b></span><span style="color:#7D8594;font-size:11.5px">Prototype MVP</span></div>
      <h4>Changer de compte</h4>${acc}
      <h4>Affichage</h4><div class="demo-row"><button class="demo-btn ${S.phone ? 'on' : ''}" data-action="demo-phone">${icon('smartphone', 15)} Vue mobile</button><button class="demo-btn ${S.theme === 'dark' ? 'on' : ''}" data-action="theme-toggle">${icon(S.theme === 'dark' ? 'moon' : 'sun', 15)} ${S.theme === 'dark' ? 'Sombre' : 'Clair'}</button></div>
      <h4>Raccourcis</h4><div class="demo-row"><button class="demo-btn" data-action="demo-go" data-to="/">${icon('home', 15)} Accueil public</button><button class="demo-btn" data-action="logout">${icon('logout', 15)} Déconnexion</button></div>
      <div class="demo-row" style="margin-top:8px"><button class="demo-btn" data-action="demo-reset">${icon('reset', 15)} Réinitialiser les données</button></div>
      <p class="demo-note">Données fictives en mémoire : vos actions (programmes créés, achats, validations KYC…) sont visibles dans les autres espaces tant que vous ne rechargez pas la page. Aucun paiement réel.</p>`;
  },
  refresh() { const p = $('#demo-panel'); if (p && p.classList.contains('open')) p.innerHTML = DemoPanel.html(); },
};
Object.assign(Actions, {
  'demo-open': () => { const p = $('#demo-panel'); p.innerHTML = DemoPanel.html(); p.classList.toggle('open'); },
  'demo-phone': () => { S.phone = !S.phone; document.body.classList.toggle('phone-mode', S.phone); saveSession(); DemoPanel.refresh(); rerender(); },
  'demo-go': (el) => { $('#demo-panel').classList.remove('open'); go(el.dataset.to); },
  'demo-reset': () => { location.reload(); },
});
const _demoLogin = Actions['demo-login'];
Actions['demo-login'] = (el) => { const p = $('#demo-panel'); if (p) p.classList.remove('open'); _demoLogin(el); };
const _themeToggle = Actions['theme-toggle'];
Actions['theme-toggle'] = (el) => { _themeToggle(el); DemoPanel.refresh(); };
document.addEventListener('click', (e) => { const p = $('#demo-panel'); if (p && p.classList.contains('open') && e.target instanceof Element && !e.target.closest('#demo-panel,#demo-fab')) p.classList.remove('open'); });

(function boot() {
  loadSession();
  if (S.role === 'coach' && !coachById(S.userId)) Object.assign(S, { role: null, userId: null });
  if (S.role === 'athlete' && !athleteById(S.userId)) Object.assign(S, { role: null, userId: null });
  if (S.role === 'admin' && !adminById(S.adminId)) Object.assign(S, { role: null, adminId: null, admin2fa: false });
  S.previewAthleteId = null;
  // Liens directs de démo : #/coach/dashboard?demo=c1 · &theme=dark · &phone=1
  const q = parseHash().query; const d = q.demo && DEMO_ACCOUNTS.find((x) => x.id === q.demo);
  if (d) {
    if (d.role === 'admin') Object.assign(S, { role: 'admin', adminId: d.id, adminRole: adminById(d.id).role, admin2fa: true, userId: null });
    else Object.assign(S, { role: d.role, userId: d.id, adminId: null, admin2fa: false });
  }
  if (q.theme === 'dark' || q.theme === 'light') S.theme = q.theme;
  if (q.phone) S.phone = q.phone === '1';
  saveSession();
  applyTheme();
  document.body.classList.toggle('phone-mode', !!S.phone);
  const fab = document.createElement('button');
  fab.id = 'demo-fab'; fab.className = 'demo-fab'; fab.type = 'button'; fab.setAttribute('data-action', 'demo-open'); fab.title = 'Panneau de démonstration';
  fab.innerHTML = '<span class="logo">ELEV<b>8</b></span><span class="lbl">Démo</span>';
  const panel = document.createElement('div'); panel.id = 'demo-panel'; panel.className = 'demo-panel';
  document.body.append(fab, panel);
  if (!location.hash || location.hash === '#') location.replace('#/');
  render();
})();
