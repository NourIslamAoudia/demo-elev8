'use strict';
/* =========================================================
   ELEV8 — pages publiques : accueil, connexion, inscription,
   connexion Super Admin (double vérification)
   ========================================================= */
const Auth = {
  loginAs(role, id) {
    S.previewAthleteId = null;
    if (role === 'admin') { const ad = adminById(id) || DB.admins[0]; Object.assign(S, { role: 'admin', adminId: ad.id, adminRole: ad.role, admin2fa: true, userId: null }); }
    else Object.assign(S, { role, userId: id, adminId: null, admin2fa: false });
    saveSession();
    const who2 = role === 'admin' ? meAdmin().name : fullName(role === 'coach' ? coachById(id) : athleteById(id));
    go(Layout.home()); toast(`Connecté·e en tant que ${esc(who2)}`, 'info');
  },
  findByEmail(email) {
    const e = String(email || '').trim().toLowerCase();
    const c = DB.coaches.find((x) => x.email.toLowerCase() === e); if (c) return { role: 'coach', id: c.id };
    const a = DB.athletes.find((x) => x.email.toLowerCase() === e && x.status !== 'pre'); if (a) return { role: 'athlete', id: a.id };
    return null;
  },
};
const DEMO_ACCOUNTS = [
  { role: 'coach', id: 'c1', title: 'Coach — Thomas Mercier', sub: 'Formule Pro · 24 clients · boutique active', ic: 'briefcase', tone: 'blue' },
  { role: 'athlete', id: 'a1', title: 'Athlète coachée — Léa Martin', sub: 'Programme, plan nutrition, montre connectée', ic: 'dumbbell', tone: 'lime' },
  { role: 'athlete', id: 'a3', title: 'Athlète coaché — Karim Haddad', sub: 'Sans programme nutrition assigné', ic: 'user', tone: 'amber' },
  { role: 'athlete', id: 'a2', title: 'Athlète solo — Hugo Lefèvre', sub: 'Sans coach : programmes ELEV8, annuaire', ic: 'smile', tone: 'violet' },
  { role: 'admin', id: 'ad1', title: 'Super Admin — Sarah Benali', sub: 'Équipe ELEV8 · double vérification', ic: 'shield', tone: 'red' },
];
const demoCards = () => DEMO_ACCOUNTS.map((d) => `<button type="button" class="demo-card" data-action="demo-login" data-role="${d.role}" data-id="${d.id}"><span class="ic kpi-ic ${d.tone}">${icon(d.ic, 20)}</span><div><div class="semibold">${d.title}</div><div class="small muted mt-4">${d.sub}</div></div><span class="link small">Entrer ${icon('arrowR', 14)}</span></button>`).join('');
function pricingCards(billing = 'monthly', { cta = true } = {}) {
  const disc = DB.platform.annualDiscount;
  return DB.plans.coach.filter((p) => p.id !== 'trial').map((p) => {
    const price = billing === 'annual' ? p.price * (1 - disc / 100) : p.price;
    const feats = p.features.filter((f) => !(DB.platform.hideCommunity && (p.future || []).includes(f)));
    return `<div class="plan-card ${p.id === 'pro' ? 'featured' : ''}">${p.id === 'pro' ? '<span class="plan-ribbon">Le plus choisi</span>' : ''}<div class="row between"><h3>${p.name}</h3><span class="pill">${p.max ? `Jusqu’à ${p.max} clients` : 'Clients illimités'}</span></div><div class="price">${fmt.eur(price, Number.isInteger(price) ? 0 : 2)}<small> / mois${billing === 'annual' ? ' · facturé annuellement' : ''}</small></div><ul>${feats.map((f) => `<li class="${(p.future || []).includes(f) ? 'off' : ''}">${icon('check', 15)}<span>${esc(f)}${(p.future || []).includes(f) ? ' <span class="future-tag">Hors MVP</span>' : ''}</span></li>`).join('')}</ul>${cta ? `<a class="btn ${p.id === 'pro' ? 'btn-primary' : 'btn-outline'} btn-block mt-8" href="#/signup?role=coach&plan=${p.id}">Choisir ${p.name}</a>` : ''}</div>`;
  }).join('');
}

/* ---------- Accueil ---------- */
route('/', () => {
  const st = ui('landing', { billing: 'monthly' });
  const phone1 = `<div class="lp-phone p1"><div class="row between" style="color:#fff"><span class="logo" style="font-size:15px">ELEV<b style="width:18px;height:20px">8</b></span><span style="font-size:11px;color:#AEB4C0">Aujourd’hui</span></div><div class="ph-card" style="background:#C5F23A;color:#0F1115"><span style="font-size:10px;font-weight:700">SÉANCE DU JOUR</span><b style="color:#0F1115">Lower Body B — Fessiers</b>6 exercices · ~58 min</div><div class="ph-card">Reste à manger<b>1 240 kcal</b>P 62 g · G 140 g · L 31 g</div><div class="ph-card">Série en cours<b>🔥 28 jours</b>Médaille Argent · 63 t soulevées</div></div>`;
  const phone2 = `<div class="lp-phone p2"><div style="color:#fff;font-weight:700;font-size:13px">Repos obligatoire</div><div style="display:grid;place-items:center;height:150px"><div style="width:130px;height:130px;border-radius:50%;border:10px solid #C5F23A;display:grid;place-items:center;color:#fff;font-size:30px;font-weight:800">01:24</div></div><div class="ph-card">Ensuite<b>Hip thrust — série 3</b>RPE cible 8 · Tempo 2-1-1-1</div><div class="ph-card">❤ 128 bpm<b>Montre connectée</b>Garmin · partagé avec le coach</div></div>`;
  const pillars = [
    ['dumbbell', 'Sport', ['Bibliothèque de 220 exercices vidéo', 'Créateur de séance : tempo, RIR/RPE, bi-sets, chronos', 'Programmes sur plusieurs semaines', 'Séance en direct, repos obligatoire, bilan']],
    ['apple', 'Nutrition', ['Métabolisme de base calculé automatiquement', 'Objectifs jour d’entraînement / jour de repos', 'Plans repas par repas, menus & recettes', 'Journal : recherche, code-barres, photo']],
    ['bag', 'Boutique', ['Programmes numériques à accès immédiat', 'Produits physiques, variantes & stock', 'Zones et tarifs de livraison', 'Factures automatiques, paiement web']],
    ['briefcase', 'Gestion d’activité', ['Fiche client en 9 onglets', 'Prospects, rendez-vous & visio intégrée', 'Messagerie, check-ins, habitudes', 'Contrat coach-athlète, codes promo']],
    ['card', 'Paiement web', ['Abonnement coach 59 à 199 €/mois', 'Honoraires athlète → coach sans commission', 'Boutique via prestataire (type Stripe Connect)', 'Jamais d’achat intégré App Store / Play Store']],
    ['shield', 'Super Admin', ['KYC & certifications', 'Abonnements, factures, affiliations', 'Support, emails, modération', 'Santé API & paramètres']],
  ];
  const html = `<div class="lp">
    <nav class="lp-nav"><a class="logo" href="#/">ELEV<b>8</b></a><a class="lnk" href="#/" data-action="lp-scroll" data-to="lp-features">Fonctionnalités</a><a class="lnk" href="#/" data-action="lp-scroll" data-to="lp-pricing">Tarifs</a><a class="lnk" href="#/" data-action="lp-scroll" data-to="lp-wait">Liste d’attente</a><span class="grow"></span><a class="btn btn-ghost btn-sm" style="color:#fff" href="#/login">Se connecter</a><a class="btn btn-accent btn-sm" href="#/signup">Créer un compte</a></nav>
    <header class="lp-hero"><div class="lp-hero-in"><div><span class="lp-eyebrow">${icon('sparkles', 14)} Prototype MVP interactif · données fictives</span><h1>Le coaching sport & nutrition, <em>élevé</em>.</h1><p class="lead">Les coachs créent programmes et plans alimentaires, suivent leurs clients et vendent en boutique. Les athlètes s’entraînent, mangent mieux et progressent — sur iPhone, Android et le web.</p><div class="row wrap gap-12"><button class="btn btn-accent btn-lg" data-action="demo-login" data-role="coach" data-id="c1">${icon('briefcase', 18)} Espace Coach</button><button class="btn btn-lg btn-white" data-action="demo-login" data-role="athlete" data-id="a1">${icon('dumbbell', 18)} Espace Athlète</button><a class="btn btn-lg btn-outline" style="background:transparent;color:#fff;border-color:rgba(255,255,255,.3)" href="#/admin-login">${icon('shield', 18)} Super Admin</a></div></div><div class="lp-mock">${phone1}${phone2}</div></div></header>
    <section class="lp-section"><h2>Comptes de démonstration</h2><p class="sub">Entrez dans chaque espace en un clic. Le bouton <b>Démo</b> en bas à gauche permet de changer de compte à tout moment, d’activer la vue mobile ou le thème sombre.</p><div class="grid g-auto mt-24">${demoCards()}</div></section>
    <section class="lp-section" id="lp-features" style="padding-top:0"><h2>Tout le MVP, prêt à cliquer</h2><p class="sub">Trois pôles (Sport, Nutrition, Boutique), la gestion d’activité du coach, la circulation de l’argent et l’espace Super Admin.</p><div class="grid g-3 mt-24">${pillars.map(([ic, t, l]) => `<div class="pillar"><span class="kpi-ic lime">${icon(ic, 18)}</span><h3>${t}</h3><ul>${l.map((x) => `<li>${icon('check', 14)}<span>${x}</span></li>`).join('')}</ul></div>`).join('')}</div></section>
    <section class="lp-section" id="lp-pricing" style="padding-top:0"><div class="row between wrap gap-12"><div><h2>Formules coach</h2><p class="sub">Payées par carte sur le navigateur web. Les athlètes utilisent ELEV8 gratuitement.</p></div>${seg([['monthly', 'Mensuel'], ['annual', `Annuel −${DB.platform.annualDiscount} %`]], st.billing, 'landing', 'billing')}</div><div class="grid g-3 mt-24">${pricingCards(st.billing)}</div>
      <div class="card card-pad mt-16 row wrap gap-16"><span class="kpi-ic violet">${icon('user', 18)}</span><div class="grow"><div class="semibold">Athlètes : gratuit, sans publicité</div><div class="small muted">Solo (Free) ou rattaché à un coach (Affiliated) : Sport, Nutrition, programmes ELEV8 et Boutique. Les formules payantes athlète sont prévues pour une version future.</div></div><a class="btn btn-outline" href="#/signup?role=athlete">Créer un compte athlète</a></div></section>
    <section class="lp-section" id="lp-wait" style="padding-top:0"><div class="card card-pad"><div class="grid l-1-2 gap-24"><div><h2>Liste d’attente</h2><p class="sub">Soyez prévenu·e du lancement officiel.</p><p class="small muted mt-12">${DB.waitlist.length} personnes inscrites (visibles dans Super Admin › Clients › Waitlist).</p></div><form class="form-grid" data-form="waitlist">${field('Nom complet', input('name', '', { attrs: 'required' }))}${field('Email', input('email', '', { type: 'email', attrs: 'required' }))}${field('Je suis', select('role', ['Coach', 'Athlète'], 'Coach'))}${field('Ville', input('city', ''))}${field('Sport', input('sport', '', { placeholder: 'Musculation, course…' }))}${field('Réseau social', input('social', '', { placeholder: '@pseudo' }))}<div class="full"><button class="btn btn-primary" type="submit">${icon('send', 16)} Rejoindre la liste</button></div></form></div></div></section>
    <footer class="lp-foot">ELEV8 — prototype MVP réalisé à partir du cahier des charges. Aucune donnée réelle, aucun paiement réel.</footer></div>`;
  return { html, title: 'Accueil' };
}, { layout: 'bare' });
Actions['lp-scroll'] = (el) => { const t = document.getElementById(el.dataset.to); if (t) t.scrollIntoView({ behavior: 'smooth' }); };
Forms.waitlist = (v, form) => { DB.waitlist.unshift({ id: uid('w'), name: v.name, role: v.role, city: v.city, sport: v.sport, social: v.social, email: v.email, date: new Date().toISOString() }); form.reset(); toast('Merci ! Vous êtes sur la liste d’attente'); };

/* ---------- Connexion ---------- */
const authSide = (title, text) => `<aside class="auth-side"><a class="logo" href="#/" style="font-size:24px">ELEV<b>8</b></a><div><h2>${title}</h2><p class="mt-12">${text}</p></div><div class="small" style="color:#7D8594">Prototype — aucune donnée réelle</div></aside>`;
route('/login', (p, q) => ({ title: 'Connexion', html: `<div class="auth">${authSide('Content de vous revoir.', 'Retrouvez vos programmes, vos clients et vos messages, à jour sur tous vos appareils.')}<main class="auth-main"><div class="auth-card"><a class="back-link" href="#/">${icon('arrowL', 16)} Accueil</a><h1>Se connecter</h1><p class="muted mt-4 mb-20">Coach ou athlète, un seul écran de connexion.</p>
  <form class="col gap-14" data-form="login"><input type="hidden" name="next" value="${esc(q.next || '')}">${field('Email', input('email', '', { type: 'email', placeholder: 'vous@email.fr', attrs: 'required autocomplete="email"' }))}${field('Mot de passe', input('password', 'demo1234', { type: 'password', attrs: 'required' }))}<div class="row between"><label class="check"><input type="checkbox" checked> Rester connecté·e</label><a class="link small" data-action="info" data-msg="Un lien de réinitialisation serait envoyé par email">Mot de passe oublié ?</a></div><button class="btn btn-primary btn-lg btn-block mt-8" type="submit">Se connecter</button></form>
  <div class="hr"></div><div class="small muted mb-8">Comptes de démonstration (mot de passe pré-rempli) :</div><div class="col gap-6">${DEMO_ACCOUNTS.filter((d) => d.role !== 'admin').map((d) => { const u = d.role === 'coach' ? coachById(d.id) : athleteById(d.id); return `<button type="button" class="ex-row" data-fill="${esc(u.email)}">${avatar(u, 'sm')}<div class="grow"><div class="semibold small">${esc(d.title)}</div><div class="xs dim">${esc(u.email)}</div></div>${icon('arrowR', 15)}</button>`; }).join('')}</div>
  <p class="small muted mt-20">Pas encore de compte ? <a class="link" href="#/signup">Créer un compte</a> · Équipe ELEV8 : <a class="link" href="#/admin-login">accès Super Admin</a></p></div></main></div>`,
  mount: (el) => el.addEventListener('click', (e) => { const b = e.target.closest('[data-fill]'); if (b) { $('[name=email]', el).value = b.dataset.fill; $('[name=email]', el).form.requestSubmit(); } }) }), { layout: 'bare' });
Forms.login = (v) => {
  const u = Auth.findByEmail(v.email);
  if (!u) {
    const pre = DB.athletes.find((a) => a.status === 'pre' && a.email.toLowerCase() === v.email.trim().toLowerCase());
    toast(pre ? 'Ce profil a été préparé par un coach : terminez votre inscription' : 'Aucun compte avec cet email (essayez un compte de démonstration)', 'error');
    if (pre) go(`/signup?role=athlete&email=${encodeURIComponent(pre.email)}`);
    return;
  }
  Object.assign(S, { role: u.role, userId: u.id, adminId: null, admin2fa: false, previewAthleteId: null }); saveSession();
  go(v.next && v.next.startsWith(`/${u.role}`) ? v.next : Layout.home()); toast('Connexion réussie', 'info');
};

/* ---------- Inscription ---------- */
route('/signup', (p, q) => {
  const st = ui('signup', { role: '', billing: 'monthly', plan: 'pro' });
  const qk = JSON.stringify(q);
  if (st.qk !== qk) { st.qk = qk; if (q.role) st.role = q.role; if (q.plan) st.plan = q.plan; }
  const ref = q.ref ? DB.coaches.find((c) => c.refCode.toLowerCase() === q.ref.toLowerCase()) : null;
  const pre = q.email ? DB.athletes.find((a) => a.status === 'pre' && a.email === q.email) : null;
  const roleStep = `<div class="role-pick">${[['coach', 'briefcase', 'Je suis coach', 'Je crée des programmes, je suis mes clients et je vends en boutique.'], ['athlete', 'dumbbell', 'Je suis athlète', 'Je m’entraîne seul·e ou avec mon coach. Gratuit.']].map(([r, ic, t, s]) => `<button type="button" class="role-opt ${st.role === r ? 'active' : ''}" data-action="set-ui" data-key="signup" data-field="role" data-value="${r}"><span class="kpi-ic ${r === 'coach' ? 'blue' : 'lime'}">${icon(ic, 18)}</span><div class="semibold">${t}</div><div class="xs muted">${s}</div></button>`).join('')}</div>`;
  let form = '';
  if (st.role === 'athlete') {
    form = `<form class="col gap-14 mt-20" data-form="signup-athlete">${ref ? notice(`Vous vous inscrivez via le lien de <b>${esc(fullName(ref))}</b> (${esc(ref.brand)}) : votre compte lui sera automatiquement rattaché.`, 'green', 'link') : ''}${pre ? notice(`<b>${esc(fullName(coachById(pre.coachId)))}</b> a préparé votre profil : votre compte s’y reliera automatiquement.`, 'green', 'userPlus') : ''}
      <div class="grid g-2">${field('Prénom', input('first', pre ? pre.first : '', { attrs: 'required' }))}${field('Nom', input('last', pre ? pre.last : '', { attrs: 'required' }))}</div>${field('Email', input('email', pre ? pre.email : '', { type: 'email', attrs: 'required' }), 'Astuce démo : <b>franck.benchetrit@email.fr</b> a été pré-enregistré par le coach Thomas.')}${field('Mot de passe', input('password', '', { type: 'password', attrs: 'required minlength="6"', placeholder: '6 caractères minimum' }))}${field('Code de parrainage (facultatif)', input('ref', ref ? ref.refCode : '', { placeholder: 'Ex. : THOMAS-M8' }))}
      <label class="check"><input type="checkbox" name="cgu" required> J’accepte les conditions d’utilisation et la politique de confidentialité.</label>${notice('Aucune vérification d’identité n’est demandée pour utiliser Sport et Nutrition : elle n’intervient qu’au premier achat en Boutique.', 'blue', 'shield')}<button class="btn btn-primary btn-lg btn-block" type="submit">Créer mon compte athlète</button></form>`;
  } else if (st.role === 'coach') {
    const plans = DB.plans.coach;
    form = `<form class="col gap-14 mt-20" data-form="signup-coach"><div class="grid g-2">${field('Prénom', input('first', '', { attrs: 'required' }))}${field('Nom', input('last', '', { attrs: 'required' }))}</div><div class="grid g-2">${field('Email professionnel', input('email', '', { type: 'email', attrs: 'required' }))}${field('Téléphone', input('phone', '', { type: 'tel' }))}</div>${field('Mot de passe', input('password', '', { type: 'password', attrs: 'required minlength="6"' }))}
      <div class="grid g-2">${field('Nom de marque', input('brand', '', { placeholder: 'Ex. : Mercier Performance' }))}${field('Ville', input('city', '', { placeholder: 'Lyon' }))}</div>${field('Spécialités', chips('specialties', ['Musculation', 'Perte de poids', 'Nutrition', 'CrossFit', 'Course à pied', 'Mobilité'], [], { multi: true }))}
      <div class="tile soft"><div class="semibold mb-8">${icon('building', 15)} Informations pour encaisser vos clients</div><div class="grid g-2">${field('Statut', select('legal', ['Micro-entreprise', 'Entreprise individuelle', 'Société (SAS, SARL…)'], 'Micro-entreprise'))}${field('SIRET', input('siret', '', { placeholder: '14 chiffres' }))}</div><p class="xs dim mt-8">Un coach donne plus d’informations qu’un athlète pour pouvoir encaisser de l’argent ; une vérification renforcée sera demandée avant de recevoir les paiements Boutique.</p></div>
      <div class="row between"><span class="label">Formule</span><div class="seg sm">${[['monthly', 'Mensuel'], ['annual', `Annuel −${DB.platform.annualDiscount} %`]].map(([b, l]) => `<button type="button" class="${st.billing === b ? 'active' : ''}" data-action="signup-billing" data-value="${b}">${l}</button>`).join('')}</div></div>
      <div class="grid g-2">${plans.map((pl) => `<label class="radio-card"><input type="radio" name="plan" value="${pl.id}" ${st.plan === pl.id ? 'checked' : ''}><div><div class="semibold">${pl.name} ${pl.id === 'trial' ? `<span class="pill pill-violet">${DB.platform.trialDays} j</span>` : ''}</div><div class="small muted"><span data-price="${pl.id}">${signupPrice(pl, st.billing)}</span> · ${pl.max ? `${pl.max} clients` : 'illimité'}</div></div></label>`).join('')}</div>
      ${field('Code de parrainage (facultatif)', input('ref', q.ref || '', { placeholder: 'Code d’un coach ambassadeur' }))}
      ${notice('L’abonnement se paie par carte <b>sur le navigateur web</b> — jamais via l’App Store ou le Google Play Store.', 'blue', 'globe')}<label class="check"><input type="checkbox" name="cgu" required> J’accepte le contrat coach ELEV8 (CGU Coach v2.3).</label><button class="btn btn-primary btn-lg btn-block" type="submit">Continuer</button></form>`;
  }
  return { title: 'Créer un compte', html: `<div class="auth">${authSide('Rejoignez ELEV8.', 'Une application, deux espaces : coach ou athlète. Une même personne a un compte coach ou un compte athlète, jamais les deux avec le même profil.')}<main class="auth-main"><div class="auth-card"><a class="back-link" href="#/">${icon('arrowL', 16)} Accueil</a><h1>Créer un compte</h1><p class="muted mt-4 mb-20">Choisissez votre profil.</p>${roleStep}${form}<p class="small muted mt-20">Déjà inscrit·e ? <a class="link" href="#/login">Se connecter</a></p></div></main></div>` };
}, { layout: 'bare' });
function signupPrice(pl, billing) { if (pl.id === 'trial') return 'Gratuit, sans carte'; const price = billing === 'annual' ? pl.price * (1 - DB.platform.annualDiscount / 100) : pl.price; return `${fmt.eur(price, Number.isInteger(price) ? 0 : 2)}/mois`; }
Actions['signup-billing'] = (el) => {
  const st = ui('signup'); st.billing = el.dataset.value;
  $$('[data-action="signup-billing"]').forEach((b) => b.classList.toggle('active', b === el));
  DB.plans.coach.forEach((pl) => { const s = $(`[data-price="${pl.id}"]`); if (s) s.textContent = signupPrice(pl, st.billing); });
};
Forms['signup-athlete'] = (v) => {
  const email = v.email.trim().toLowerCase();
  if (Auth.findByEmail(email)) { toast('Un compte existe déjà avec cet email', 'error'); return; }
  const pre = DB.athletes.find((a) => a.status === 'pre' && a.email.toLowerCase() === email);
  if (pre) {
    Object.assign(pre, { status: 'active', first: v.first || pre.first, last: v.last || pre.last, since: new Date().toISOString(), lastLogin: new Date().toISOString() });
    const c = coachById(pre.coachId);
    logActivity('signup', `${fullName(pre)} a créé son compte : relié automatiquement au profil pré-rempli de ${fullName(c)}`, 'userPlus');
    notify(c.id, `<b>${esc(fullName(pre))}</b> a créé son compte : son profil pré-rempli est relié`, `/coach/clients/${pre.id}/apercu`, 'userPlus');
    Auth.loginAs('athlete', pre.id); toast(`Compte relié automatiquement au profil préparé par ${esc(fullName(c))}`);
    return;
  }
  const ref = v.ref ? DB.coaches.find((c) => c.refCode.toLowerCase() === v.ref.trim().toLowerCase()) : null;
  const a = mkAthlete({ id: uid('a'), first: v.first.trim(), last: v.last.trim(), email, coachId: ref ? ref.id : null, status: 'active', since: new Date().toISOString(), lastLogin: new Date().toISOString(), goal: 'Remise en forme', strength: 0.8, adh: 0.8 });
  DB.athletes.push(a);
  if (ref) { DB.referrals.push({ id: uid('ref'), coachId: ref.id, type: 'athlete', userId: a.id, date: a.since }); notify(ref.id, `<b>${esc(fullName(a))}</b> s’est inscrit·e via votre lien`, `/coach/clients/${a.id}/apercu`, 'link'); }
  logActivity('signup', `Nouvel athlète inscrit${ref ? ` via le lien de ${fullName(ref)}` : ' (solo)'} : ${fullName(a)}`, 'user');
  Auth.loginAs('athlete', a.id);
};
Forms['signup-coach'] = (v) => {
  const email = v.email.trim().toLowerCase();
  if (Auth.findByEmail(email)) { toast('Un compte existe déjà avec cet email', 'error'); return; }
  const billing = ui('signup').billing; const plan = DB.plans.coach.find((p) => p.id === (v.plan || 'pro'));
  const create = () => {
    const id = uid('c');
    const c = mkCoach({ id, first: v.first.trim(), last: v.last.trim(), email, phone: v.phone, brand: v.brand || `${v.first} Coaching`, city: v.city || 'Paris', specialties: v.specialties.length ? v.specialties : ['Remise en forme'], plan: plan.id, billing, subStatus: 'active', since: new Date().toISOString(), endDate: addDays(new Date(), plan.id === 'trial' ? DB.platform.trialDays : billing === 'annual' ? 365 : 30).toISOString(), kyc: 'none', stripe: 'incomplete', legal: v.legal, siret: v.siret, color: AV_COLORS[hashStr(email) % AV_COLORS.length] });
    DB.coaches.push(c); DB.availability[id] = DB.availability.c1.map((d) => ({ on: d.on, slots: d.slots.map((s) => s.slice()) }));
    DB.platformContracts.push({ id: uid('ctr'), coachId: id, version: 'CGU Coach v2.3', status: 'signed', signedAt: new Date().toISOString(), signatory: fullName(c), expires: addDays(new Date(), 365).toISOString() });
    if (plan.price) DB.invoices.unshift({ id: `F-2026-${4100 + DB.invoices.length}`, coachId: id, amount: billing === 'annual' ? round(plan.price * 12 * (1 - DB.platform.annualDiscount / 100), 2) : plan.price, date: new Date().toISOString(), status: 'paid', label: `Abonnement ${plan.name} ${billing === 'annual' ? '(annuel)' : '(mensuel)'}` });
    const ref = v.ref ? DB.coaches.find((x) => x.refCode.toLowerCase() === v.ref.trim().toLowerCase()) : null;
    if (ref) DB.referrals.push({ id: uid('ref'), coachId: ref.id, type: 'coach', userId: id, date: c.since });
    logActivity('signup', `Nouveau coach inscrit : ${fullName(c)} (${plan.name})`, 'userPlus');
    Auth.loginAs('coach', id);
  };
  if (plan.id === 'trial') { create(); return; }
  const total = billing === 'annual' ? round(plan.price * 12 * (1 - DB.platform.annualDiscount / 100), 2) : plan.price;
  Checkout.open({ title: `Abonnement ELEV8 ${plan.name}${billing === 'annual' ? ' — annuel' : ''}`, merchant: 'ELEV8', lines: billing === 'annual' ? [{ label: `${plan.name} × 12 mois`, amount: plan.price * 12 }, { label: `Remise annuelle −${DB.platform.annualDiscount} %`, amount: -(plan.price * 12 - total) }] : [{ label: `Formule ${plan.name} (mensuel, sans engagement)`, amount: plan.price }], total, mode: billing === 'annual' ? 'payment' : 'subscription', email, onSuccess: create });
};

/* ---------- Connexion Super Admin (mot de passe + code) ---------- */
route('/admin-login', () => {
  const st = ui('adminlogin', { step: 1, admin: 'ad1' });
  const step1 = `<form class="col gap-14" data-form="admin-login1">${field('Compte (rôles différents)', select('admin', DB.admins.map((a) => [a.id, `${a.name} — ${DB.adminRoles[a.role].label}`]), st.admin))}${field('Mot de passe', input('password', 'elev8-admin', { type: 'password', attrs: 'required' }))}<button class="btn btn-primary btn-lg btn-block" type="submit">Continuer</button></form>`;
  const step2 = `<form class="col gap-14" data-form="admin-login2"><p class="small muted">Saisissez le code à 6 chiffres envoyé par votre application d’authentification. <span class="kbd">Code de démo : 246810</span></p><div class="code-inputs">${Array.from({ length: 6 }, (_, i) => `<input inputmode="numeric" maxlength="1" name="c${i}" aria-label="Chiffre ${i + 1}" value="${'246810'[i]}">`).join('')}</div><button class="btn btn-primary btn-lg btn-block" type="submit">${icon('shield', 18)} Vérifier et entrer</button><button type="button" class="btn btn-ghost" data-action="set-ui" data-key="adminlogin" data-field="step" data-value="1">Retour</button></form>`;
  return { title: 'Super Admin', html: `<div class="auth">${authSide('Espace Super Admin', 'Réservé à l’équipe ELEV8 : comptes créés en interne, double vérification, actions sensibles journalisées.')}<main class="auth-main"><div class="auth-card"><a class="back-link" href="#/">${icon('arrowL', 16)} Accueil</a><div class="steps"><i class="on"></i><i class="${st.step === 2 ? 'on' : ''}"></i></div><h1>${st.step === 1 ? 'Connexion équipe' : 'Double vérification'}</h1><p class="muted mt-4 mb-20">${st.step === 1 ? 'Pas d’inscription publique : les comptes sont créés par ELEV8.' : 'Étape 2 sur 2'}</p>${st.step === 1 ? step1 : step2}</div></main></div>`,
    mount: (el) => { const ins = $$('.code-inputs input', el); ins.forEach((inp, i) => inp.addEventListener('input', () => { if (inp.value && ins[i + 1]) ins[i + 1].focus(); })); } };
}, { layout: 'bare' });
Forms['admin-login1'] = (v) => { const st = ui('adminlogin'); st.admin = v.admin; st.step = 2; rerender(); };
Forms['admin-login2'] = (v) => {
  const code = [0, 1, 2, 3, 4, 5].map((i) => v[`c${i}`]).join('');
  if (code !== '246810') { toast('Code incorrect', 'error'); return; }
  const st = ui('adminlogin'); st.step = 1; Auth.loginAs('admin', st.admin);
};
