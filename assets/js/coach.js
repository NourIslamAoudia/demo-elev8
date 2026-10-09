'use strict';
/* =========================================================
   ELEV8 — Espace Coach (1/4) : navigation, tableau de bord,
   clients, fiche client (9 onglets), Sport & Nutrition
   ========================================================= */
const clientsOf = (cId, { pre = true } = {}) => DB.athletes.filter((a) => a.coachId === cId && (pre || a.status !== 'pre'));
function checkinState(aId) {
  const a = athleteById(aId); const mon = startOfWeek(new Date()); const prevMon = addDays(mon, -7);
  const list = DB.checkins.filter((c) => c.athleteId === aId).sort((x, y) => new Date(y.date) - new Date(x.date));
  const thisW = list.find((c) => c.week === ymd(mon)); const prevW = list.find((c) => c.week === ymd(prevMon));
  const isNew = a && new Date(a.since) > prevMon;
  return { status: thisW ? 'completed' : !prevW && !isNew ? 'late' : 'pending', last: list[0] || null, due: addDays(mon, 6), list };
}
function coachRevenue(cId, monthDate = new Date()) {
  const m0 = startOfMonth(monthDate); const m1 = addMonths(m0, 1); const inM = (d) => new Date(d) >= m0 && new Date(d) < m1; const rate = 1 - DB.platform.shopCommission / 100;
  const coaching = sum(DB.payments.filter((p) => p.coachId === cId && p.status === 'paid' && inM(p.date)), (p) => p.amount);
  const shop = sum(DB.shop.orders.filter((o) => o.coachId === cId && !['refunded'].includes(o.status) && inM(o.date)), (o) => o.subtotal * rate) + sum(DB.shop.digitalSales.filter((s) => s.coachId === cId && inM(s.date)), (s) => s.price * rate);
  return { coaching, shop: round(shop, 2), total: round(coaching + shop, 2) };
}
const refLink = (c) => `https://elev8.app/r/${c.refCode}`;
const planLimit = (c) => coachPlan(c).max;
function checkClientLimit(c) {
  const n = clientsOf(c.id).length; const max = planLimit(c);
  if (max && n >= max) {
    openModal({ title: 'Limite de clients atteinte', size: 'sm', body: `<p class="muted">Votre formule <b>${PLAN_NAMES[c.plan]}</b> permet de suivre jusqu’à <b>${max} clients</b>. Passez à la formule supérieure pour en ajouter.</p>`, footer: `<button class="btn btn-ghost" data-close>Plus tard</button><a class="btn btn-primary" href="#/coach/settings/abonnement" data-close>Changer de formule</a>` });
    notify(c.id, `Limite de clients atteinte (${max}) — email « Limite de clients atteinte » envoyé`, '/coach/settings/abonnement', 'alert');
    return false;
  }
  return true;
}

/* ---------- Coquille ---------- */
NAV.coach = () => {
  const c = meCoach();
  const unread = DB.threads.filter((t) => t.a === c.id || t.b === c.id).reduce((s, t) => s + ((t.unread || {})[c.id] || 0), 0);
  const pending = DB.shop.orders.filter((o) => o.coachId === c.id && o.status === 'pending').length;
  const late = clientsOf(c.id, { pre: false }).filter((a) => a.status === 'active' && checkinState(a.id).status === 'late').length;
  return [
    { title: 'Principal', items: [{ label: 'Tableau de bord', ic: 'dashboard', href: '/coach/dashboard' }, { label: 'Clients', ic: 'users', href: '/coach/clients' }, { label: 'Prospects', ic: 'briefcase', href: '/coach/prospects', locked: !hasPlan('pro') }, { label: 'Rendez-vous', ic: 'calendar', href: '/coach/appointments' }, { label: 'Messagerie', ic: 'message', href: '/coach/messages', badge: unread || '' }] },
    { title: 'Suivi', items: [{ label: 'Habitudes', ic: 'droplet', href: '/coach/habits' }, { label: 'Check-ins', ic: 'clipboard', href: '/coach/checkins', badge: late || '' }] },
    { title: 'Sport', items: [{ label: 'Exercices', ic: 'dumbbell', href: '/coach/exercises' }, { label: 'Séances', ic: 'layers', href: '/coach/sessions' }, { label: 'Programmes', ic: 'calCheck', href: '/coach/programs' }] },
    { title: 'Nutrition', items: [{ label: 'Suivi nutrition', ic: 'apple', href: '/coach/nutrition' }, { label: 'Plans nutritionnels', ic: 'file', href: '/coach/nutrition/plans' }, { label: 'Aliments & menus', ic: 'utensils', href: '/coach/nutrition/library' }, { label: 'Recettes', ic: 'chef', href: '/coach/nutrition/recipes' }] },
    { title: 'Boutique', items: [{ label: 'Produits', ic: 'bag', href: '/coach/shop' }, { label: 'Commandes', ic: 'package', href: '/coach/shop/orders', badge: pending || '' }, { label: 'Ventes & factures', ic: 'receipt', href: '/coach/shop/sales' }] },
    { title: 'Compte', items: [{ label: 'Paramètres', ic: 'settings', href: '/coach/settings' }, { label: 'Assistance', ic: 'help', href: '/coach/help' }] },
  ];
};
TOPBAR.coach = () => `<button class="btn btn-outline btn-sm hide-sm" data-action="preview-athlete" title="Voir ce que voit un athlète">${icon('eye', 15)} Aperçu athlète</button>`;
BANNERS.coach = () => {
  const c = meCoach(); if (UI.coachBannerHidden === c.id + c.kyc + c.certStatus) return '';
  const close = `<button class="icon-btn" data-action="coach-banner-hide" title="Masquer">${icon('x', 15)}</button>`;
  const share = `<button class="btn btn-sm btn-outline" style="background:transparent" data-action="copy" data-text="${refLink(c)}" data-msg="Lien de parrainage copié">${icon('link', 14)} Copier mon lien</button>`;
  if (c.kyc === 'none' || c.kyc === 'rejected') return `<div class="banner banner-amber">${icon('alert', 17)}<div>${c.kyc === 'rejected' ? '<b>Vérification refusée.</b> ' : '<b>Vérification d’identité requise.</b> '}Tant qu’elle n’est pas faite, vous n’apparaissez pas dans la liste des coachs disponibles. En attendant, partagez votre lien de parrainage.</div><div class="banner-actions">${share}<a class="btn btn-sm btn-primary" href="#/coach/settings/gestion">Vérifier mon identité</a>${close}</div></div>`;
  if (c.kyc === 'pending' || c.certStatus === 'pending') return `<div class="banner banner-blue">${icon('clock', 17)}<div><b>Vérification en cours.</b> L’équipe ELEV8 examine vos documents (${c.certStatus === 'pending' ? 'diplôme / certification' : 'identité'}). Vous serez notifié·e par email.</div><div class="banner-actions">${share}${close}</div></div>`;
  if (!c.certified) return `<div class="banner banner-violet">${icon('award', 17)}<div><b>Identité vérifiée, coach non certifié·e :</b> vous n’apparaissez pas dans la liste des coachs disponibles. Ajoutez un diplôme ou une certification — en attendant, utilisez votre lien de parrainage.</div><div class="banner-actions">${share}<a class="btn btn-sm btn-primary" href="#/coach/settings/gestion">Ajouter un diplôme</a>${close}</div></div>`;
  if (c.plan === 'trial') return `<div class="banner banner-blue">${icon('gift', 17)}<div><b>Essai gratuit</b> — ${Math.max(0, daysBetween(new Date(), c.endDate))} jours restants.</div><div class="banner-actions"><a class="btn btn-sm btn-primary" href="#/coach/settings/abonnement">Choisir une formule</a>${close}</div></div>`;
  return '';
};
Actions['coach-banner-hide'] = () => { const c = meCoach(); UI.coachBannerHidden = c.id + c.kyc + c.certStatus; rerender(); };

/* ---------- Tableau de bord (9.1) ---------- */
function coachAlerts(c) {
  const out = []; const cl = clientsOf(c.id, { pre: false });
  DB.payments.filter((p) => p.coachId === c.id && p.status === 'failed').forEach((p) => out.push({ ic: 'card', tone: 'red', t: `Paiement en échec — ${fullName(athleteById(p.athleteId))}`, s: `${fmt.eur(p.amount)} · ${esc(p.label)}`, href: `/coach/clients/${p.athleteId}/apercu` }));
  DB.shop.orders.filter((o) => o.coachId === c.id && o.status === 'pending').forEach((o) => out.push({ ic: 'package', tone: 'amber', t: `Commande ${o.number} à expédier`, s: `${fullName(athleteById(o.athleteId))} · ${fmt.eur(o.total, 2)}`, href: '/coach/shop/orders' }));
  cl.filter((a) => a.status === 'active' && checkinState(a.id).status === 'late').forEach((a) => out.push({ ic: 'clipboard', tone: 'amber', t: `Check-in en retard — ${fullName(a)}`, s: 'Semaine précédente non complétée', href: `/coach/clients/${a.id}/checkins` }));
  DB.checkins.filter((x) => x.pain && cl.some((a) => a.id === x.athleteId) && daysBetween(x.date, new Date()) <= 10).forEach((x) => out.push({ ic: 'alert', tone: 'red', t: `Douleur signalée — ${fullName(athleteById(x.athleteId))}`, s: x.pain, href: `/coach/clients/${x.athleteId}/checkins` }));
  DB.shop.products.filter((p) => p.coachId === c.id).forEach((p) => { if (p.variants) p.variants.options.filter((o) => o.stock <= 0).forEach((o) => out.push({ ic: 'bag', tone: 'violet', t: `Stock épuisé — ${p.name} (${o.label})`, s: 'Produit affiché comme épuisé', href: '/coach/shop/products' })); else if (prodStock(p) <= 0) out.push({ ic: 'bag', tone: 'violet', t: `Stock épuisé — ${p.name}`, s: 'Produit affiché comme épuisé', href: '/coach/shop/products' }); });
  cl.filter((a) => a.status === 'active' && a.lastSession && daysBetween(a.lastSession, new Date()) >= 7).forEach((a) => out.push({ ic: 'clock', tone: '', t: `Aucune séance depuis ${daysBetween(a.lastSession, new Date())} jours — ${fullName(a)}`, s: 'Relance conseillée', href: `/coach/clients/${a.id}/sessions` }));
  return out;
}
function coachFeed(c) {
  const ids = new Set(clientsOf(c.id).map((a) => a.id)); const ev = [];
  DB.logs.filter((l) => ids.has(l.athleteId)).slice(-12).forEach((l) => ev.push({ at: l.date, ic: 'activity', tone: 'green', t: `<b>${esc(fullName(athleteById(l.athleteId)))}</b> a terminé « ${esc(sessionById(l.sessionId).name)} »`, s: `${l.completion} % · ${fmt.tonnes(l.volume)}`, action: `data-action="open-log" data-id="${l.id}"` }));
  DB.checkins.filter((x) => ids.has(x.athleteId)).slice(-10).forEach((x) => ev.push({ at: x.date, ic: 'clipboard', tone: 'blue', t: `<b>${esc(fullName(athleteById(x.athleteId)))}</b> a envoyé son check-in`, s: `Fatigue ${x.fatigue}/5 · motivation ${x.motivation}/5`, action: `data-go="/coach/clients/${x.athleteId}/checkins"` }));
  DB.shop.orders.filter((o) => o.coachId === c.id).forEach((o) => ev.push({ at: o.date, ic: 'bag', tone: 'violet', t: `Nouvelle commande ${o.number} — <b>${esc(fullName(athleteById(o.athleteId)))}</b>`, s: fmt.eur(o.total, 2), action: 'data-go="/coach/shop/orders"' }));
  DB.athletes.filter((a) => a.coachId === c.id && daysBetween(a.since, new Date()) <= 20).forEach((a) => ev.push({ at: a.since, ic: 'userPlus', tone: 'lime', t: a.status === 'pre' ? `Client pré-inscrit : <b>${esc(fullName(a))}</b>` : `Nouveau client : <b>${esc(fullName(a))}</b> vient de s’inscrire`, s: a.status === 'pre' ? 'En attente de création de compte' : 'Relié à votre espace', action: `data-go="/coach/clients/${a.id}/apercu"` }));
  DB.payments.filter((p) => p.coachId === c.id && p.status === 'paid' && daysBetween(p.date, new Date()) <= 20).forEach((p) => ev.push({ at: p.date, ic: 'euro', tone: 'green', t: `Paiement reçu — <b>${esc(fullName(athleteById(p.athleteId)))}</b>`, s: `${fmt.eur(p.amount)} · ${esc(p.label)}`, action: 'data-go="/coach/settings/gestion"' }));
  return ev.filter((e) => new Date(e.at) <= new Date()).sort((x, y) => new Date(y.at) - new Date(x.at)).slice(0, 12);
}
route('/coach/dashboard', () => {
  const c = meCoach(); const cl = clientsOf(c.id); const active = cl.filter((a) => a.status === 'active');
  const rev = coachRevenue(c.id); const prev = coachRevenue(c.id, addMonths(new Date(), -1));
  const newWeek = cl.filter((a) => daysBetween(a.since, new Date()) <= 7).length;
  const alerts = coachAlerts(c);
  const adh = active.map((a) => Sport.adherence(a.id)).filter((x) => x != null);
  const months = Array.from({ length: 6 }, (_, k) => addMonths(startOfMonth(new Date()), k - 5));
  const revs = months.map((m, k) => { const r = coachRevenue(c.id, m); return r.total ? r : { coaching: round(rev.coaching * (0.55 + k * 0.08)), shop: round(rev.shop * (0.4 + k * 0.1)) }; });
  const today = DB.appointments.filter((x) => x.coachId === c.id && isSameDay(x.start, new Date()));
  const todaySessions = active.map((a) => ({ a, e: Sport.todayEntry(a.id) })).filter((x) => x.e);
  const refs = DB.referrals.filter((r) => r.coachId === c.id);
  const html = `<div class="hello mb-20"><div><h1>Bonjour ${esc(c.first)} 👋</h1><p class="muted mt-4" style="text-transform:capitalize">${fmt.dateFull(new Date())}</p></div><div class="row wrap"><button class="btn btn-outline" data-action="client-add">${icon('userPlus', 16)} Ajouter un client</button><a class="btn btn-primary" href="#/coach/programs/new">${icon('plus', 16)} Nouveau programme</a></div></div>
    <div class="grid g-4">${kpi({ label: 'Revenus du mois', value: fmt.eur(rev.total), ic: 'euro', tone: 'green', delta: prev.total ? ((rev.total - prev.total) / prev.total) * 100 : null, deltaLabel: 'vs mois dernier', sub: `+${newWeek} nouveau${newWeek > 1 ? 'x' : ''} client${newWeek > 1 ? 's' : ''} cette semaine` })}${kpi({ label: 'Athlètes actifs', value: active.length, ic: 'users', tone: 'blue', sub: `${cl.length} au total · limite ${planLimit(c) || '∞'}` })}${kpi({ label: 'Alertes urgentes', value: alerts.length, ic: 'alert', tone: alerts.length ? 'red' : '', sub: 'À traiter ci-dessous' })}${kpi({ label: 'Adhérence moyenne', value: adh.length ? `${fmt.num(avg(adh))} %` : '—', ic: 'target', tone: 'lime', sub: 'Séances faites / prévues' })}</div>
    <div class="grid g-4 mt-16">${[['plus', 'Nouveau programme', 'Assembler des séances sur plusieurs semaines', '/coach/programs/new'], ['userPlus', 'Ajouter un client', 'Pré-enregistrer ou inviter', ''], ['layers', 'Créer une séance', 'Exercices, tempo, RIR/RPE', '/coach/sessions/new'], ['send', 'Envoyer un message', 'Messagerie individuelle', '/coach/messages']].map(([ic, t, s, h]) => `<button class="quick" ${h ? `data-go="${h}"` : 'data-action="client-add"'}><span class="qi">${icon(ic, 18)}</span><div><div class="semibold">${t}</div><div class="xs dim">${s}</div></div></button>`).join('')}</div>
    <div class="grid l-2-1 mt-16"><div class="col gap-16">
      ${card('Alertes urgentes', alerts.length ? `<div class="list">${alerts.slice(0, 7).map((x) => `<a class="li click" href="#${x.href}"><span class="li-ic ${x.tone}">${icon(x.ic, 16)}</span><div class="grow"><div class="li-t">${esc(x.t)}</div><div class="li-s">${esc(x.s)}</div></div>${icon('chevR', 16)}</a>`).join('')}</div>` : emptyState('checkCircle', 'Rien d’urgent', 'Tout est sous contrôle.'), { sub: `${alerts.length} à traiter` })}
      ${card('Revenus — 6 derniers mois', Charts.bars({ labels: months.map((m) => fmt.month(m)), series: [{ name: 'Coaching', color: 'var(--s1)', values: revs.map((r) => r.coaching) }, { name: 'Boutique (net)', color: 'var(--s3)', values: revs.map((r) => r.shop) }], stacked: true, height: 220, yFmt: (v) => fmt.eur(v), tipFmt: (v) => fmt.eur(v, 0) }), { sub: 'Honoraires (0 % de commission ELEV8) + Boutique nette de commission' })}
    </div><div class="col gap-16">
      ${card('Aujourd’hui', `${today.length ? today.map((x) => { const a = athleteById(x.athleteId); return `<div class="li"><span class="li-ic ${x.mode === 'visio' ? 'blue' : 'violet'}">${icon(x.mode === 'visio' ? 'video' : 'mapPin', 16)}</span><div class="grow"><div class="li-t">${fmt.time(x.start)} · ${esc(x.type)}</div><div class="li-s">${esc(fullName(a))} · ${x.duration} min</div></div>${x.mode === 'visio' ? `<button class="btn btn-soft btn-xs" data-action="call-start" data-peer="${a.id}">Rejoindre</button>` : ''}</div>`; }).join('') : '<div class="small dim">Aucun rendez-vous aujourd’hui.</div>'}<div class="hr"></div><div class="small"><b>${todaySessions.length}</b> séance${todaySessions.length > 1 ? 's' : ''} prévue${todaySessions.length > 1 ? 's' : ''} pour vos athlètes · <b>${todaySessions.filter((x) => x.e.status === 'done').length}</b> terminée${todaySessions.filter((x) => x.e.status === 'done').length > 1 ? 's' : ''}</div>`, { actions: `<a class="btn btn-ghost btn-xs" href="#/coach/appointments">Agenda</a>` })}
      ${card('Activité récente', `<div class="list feed">${coachFeed(c).map((e) => `<div class="li click" ${e.action}><span class="li-ic ${e.tone}">${icon(e.ic, 15)}</span><div class="grow"><div class="small">${e.t}</div><div class="li-s">${esc(e.s)} · ${fmt.rel(e.at)}</div></div></div>`).join('') || '<div class="small dim">Rien pour le moment.</div>'}</div>`)}
      ${card('Mon lien de parrainage', `<p class="small muted mb-12">Toute personne qui s’inscrit via ce lien (athlète ou coach) vous est automatiquement rattachée.</p><div class="row gap-8"><input class="input sm mono" readonly value="${refLink(c)}"><button class="btn btn-outline btn-sm" data-action="copy" data-text="${refLink(c)}">${icon('copy', 14)}</button></div><div class="row between mt-12 small"><span class="muted">${refs.filter((r) => r.type === 'athlete').length} athlètes · ${refs.filter((r) => r.type === 'coach').length} coach inscrits</span><a class="link" href="#/signup?ref=${c.refCode}" title="Ouvre la page d’inscription comme un invité">Tester le lien</a></div>`)}
    </div></div>`;
  return { title: 'Tableau de bord', html };
}, { role: 'coach' });

/* ---------- Ajouter / pré-enregistrer un client ---------- */
Actions['client-add'] = () => {
  const c = meCoach(); if (!checkClientLimit(c)) return;
  const st = { tab: 'pre' };
  const body = () => `<div class="seg mb-16">${[['pre', 'Pré-enregistrer'], ['existing', 'Athlète existant'], ['invite', 'Inviter par lien']].map(([k, l]) => `<button type="button" class="${st.tab === k ? 'active' : ''}" data-tab="${k}">${l}</button>`).join('')}</div>
    ${st.tab === 'pre' ? `<form data-pre class="form-grid">${notice('Créez le profil avant même que la personne ait un compte : quand elle s’inscrira avec <b>ce même email</b>, son compte athlète se reliera automatiquement à ce profil pré-rempli.', 'blue', 'info')}<div class="full"></div>${field('Prénom', input('first', '', { attrs: 'required' }))}${field('Nom', input('last', '', { attrs: 'required' }))}${field('Email', input('email', '', { type: 'email', attrs: 'required' }))}${field('Téléphone', input('phone', '', { type: 'tel' }))}${field('Genre', select('gender', [['F', 'Femme'], ['M', 'Homme'], ['X', 'Autre / non précisé']], 'F'))}${field('Objectif principal', select('goal', GOALS, 'Perte de poids'))}<div class="full">${field('Notes libres', textarea('notes', '', { rows: 3, placeholder: 'Blessures, remarques, disponibilités…' }))}</div></form>`
      : st.tab === 'existing' ? `<form data-ex class="col gap-12">${field('Email de l’athlète', input('email', '', { type: 'email', placeholder: 'athlete@email.fr' }), 'L’athlète doit déjà avoir un compte ELEV8 (par exemple après un échange en dehors de l’application). Démo : un athlète solo, ex. hugo.lefevre@email.fr')}</form>`
      : `<div class="col gap-12"><p class="small muted">Envoyez votre lien personnel : l’athlète qui s’inscrit avec est rattaché automatiquement.</p><div class="row gap-8"><input class="input mono" readonly value="${refLink(c)}"><button class="btn btn-outline" data-action="copy" data-text="${refLink(c)}">${icon('copy', 15)} Copier</button></div>${field('Ou envoyer une invitation par email', `<div class="row gap-8"><input class="input" type="email" placeholder="email@exemple.fr" data-inv><button type="button" class="btn btn-primary" data-send-inv>${icon('send', 15)} Envoyer</button></div>`)}</div>`}`;
  openModal({ title: 'Ajouter un client', sub: `${clientsOf(c.id).length} / ${planLimit(c) || '∞'} clients · formule ${PLAN_NAMES[c.plan]}`, size: 'md', body: body(), footer: '<button class="btn btn-ghost" data-close>Annuler</button><button class="btn btn-primary" data-ok>Enregistrer</button>',
    onMount: (box, m) => {
      const redraw = () => { m.setBody(body()); $('[data-ok]', box).style.display = st.tab === 'invite' ? 'none' : ''; };
      box.addEventListener('click', (e) => {
        const t = e.target.closest('[data-tab]'); if (t) { st.tab = t.dataset.tab; redraw(); return; }
        if (e.target.closest('[data-send-inv]')) { const v = $('[data-inv]', box).value; if (!v) { toast('Saisissez un email', 'error'); return; } toast(`Invitation envoyée à ${esc(v)} (modèle « Invitation d’un coach »)`); m.close(); }
      });
      $('[data-ok]', box).addEventListener('click', () => {
        if (st.tab === 'pre') {
          const v = formValues($('[data-pre]', box)); if (!v.first.trim() || !v.email.trim()) { toast('Prénom et email requis', 'error'); return; }
          if (DB.athletes.some((a) => a.email.toLowerCase() === v.email.trim().toLowerCase())) { toast('Cet email existe déjà : utilisez « Athlète existant »', 'error'); return; }
          const a = mkAthlete({ id: uid('a'), first: v.first.trim(), last: v.last.trim(), email: v.email.trim().toLowerCase(), phone: v.phone, gender: v.gender === 'X' ? 'F' : v.gender, goal: v.goal, notes: v.notes, coachId: c.id, status: 'pre', since: new Date().toISOString(), lastLogin: null });
          DB.athletes.push(a); logActivity('preregister', `Nouveau client pré-inscrit : ${fullName(a)} (coach ${fullName(c)})`, 'userPlus');
          m.close(); toast(`${esc(fullName(a))} pré-enregistré·e`); go(`/coach/clients/${a.id}/apercu`);
        } else {
          const v = formValues($('[data-ex]', box)); const a = DB.athletes.find((x) => x.email.toLowerCase() === v.email.trim().toLowerCase() && x.status !== 'pre');
          if (!a) { toast('Aucun compte athlète avec cet email : pré-enregistrez-le', 'error'); return; }
          if (a.coachId === c.id) { toast('Cet athlète est déjà votre client', 'info'); return; }
          if (a.coachId) { toast('Cet athlète est déjà suivi par un autre coach', 'error'); return; }
          a.coachId = c.id; notify(a.id, `<b>${esc(fullName(c))}</b> vous a ajouté·e à ses clients`, '/athlete/coach', 'userPlus'); logActivity('client', `${fullName(a)} rattaché·e à ${fullName(c)}`, 'link');
          m.close(); toast(`${esc(fullName(a))} ajouté·e à vos clients`); go(`/coach/clients/${a.id}/apercu`);
        }
      });
    } });
};

/* ---------- Liste des clients ---------- */
route('/coach/clients', () => {
  const c = meCoach(); const st = ui('clients', { q: '', status: 'all', goal: '' }); const max = planLimit(c);
  const all = clientsOf(c.id);
  const list = all.filter((a) => (st.status === 'all' || a.status === st.status) && (!st.goal || a.goal === st.goal) && (!st.q || fullName(a).toLowerCase().includes(st.q.toLowerCase()) || a.email.includes(st.q.toLowerCase())));
  const row = (a) => {
    const asg = Sport.activeAsg(a.id); const pr = asg ? Sport.asgProgress(asg) : null; const adh = Sport.adherence(a.id); const ci = checkinState(a.id);
    return `<tr class="click" data-go="/coach/clients/${a.id}/apercu"><td><div class="person">${avatar(a, 'sm')}<div><div class="nm">${esc(fullName(a))}</div><div class="em">${esc(a.email)}</div></div></div></td><td class="small">${esc(a.goal)}</td><td style="min-width:170px">${asg ? `<div class="small semibold truncate">${esc(programById(asg.programId).name)}</div><div class="row gap-6 mt-4"><div class="grow">${progress(pr.pct, '', 'thin')}</div><span class="xs dim">${pr.done}/${pr.total}</span></div>` : '<span class="xs dim">—</span>'}</td><td>${adh != null ? `<span class="pill ${adh >= 80 ? 'pill-green' : adh >= 60 ? 'pill-amber' : 'pill-red'}">${adh} %</span>` : '—'}</td><td class="small muted">${a.lastSession ? fmt.rel(a.lastSession) : '—'}</td><td>${a.status === 'pre' ? '—' : statusPill(ci.status === 'completed' ? 'completed' : ci.status === 'late' ? 'late' : 'pending', ci.status === 'completed' ? 'Fait' : ci.status === 'late' ? 'En retard' : `Dû ${fmt.dm(ci.due)}`)}</td><td>${statusPill(a.status)}</td></tr>`;
  };
  const html = `${pageHead('Clients', `${all.length} client${all.length > 1 ? 's' : ''} · formule ${PLAN_NAMES[c.plan]}`, `<button class="btn btn-outline" data-action="copy" data-text="${refLink(c)}" data-msg="Lien de parrainage copié">${icon('link', 16)} Mon lien</button><button class="btn btn-primary" data-action="client-add">${icon('userPlus', 16)} Ajouter un client</button>`)}
    <div class="card card-pad mb-16"><div class="row between wrap gap-12"><div class="grow" style="min-width:220px"><div class="row between small mb-4"><span class="semibold">Clients suivis</span><span class="muted">${all.length} / ${max || '∞'}</span></div>${progress(max ? (all.length / max) * 100 : 8, max && all.length / max > 0.85 ? 'var(--s2)' : '')}</div>${max && c.plan !== 'elite' ? `<a class="btn btn-ghost btn-sm" href="#/coach/settings/abonnement">Augmenter la limite ${icon('arrowR', 14)}</a>` : ''}</div></div>
    <div class="row wrap gap-8 mb-16">${searchBox('q', st.q, 'Rechercher un client…', 'data-cq')}${seg([['all', 'Tous'], ['active', 'Actifs'], ['pre', 'Pré-inscrits'], ['paused', 'En pause']], st.status, 'clients', 'status', 'sm')}${select('goal', [['', 'Tous objectifs'], ...GOALS], st.goal, 'data-cgoal', 'sm')}</div>
    <div class="card"><div class="table-wrap"><table class="table"><thead><tr><th>Client</th><th>Objectif</th><th>Programme</th><th>Adhérence</th><th>Dernière séance</th><th>Check-in</th><th>Statut</th></tr></thead><tbody data-rows>${list.map(row).join('') || `<tr><td colspan="7">${emptyState('users', 'Aucun client', 'Ajoutez votre premier client ou partagez votre lien de parrainage.')}</td></tr>`}</tbody></table></div></div>`;
  return { title: 'Clients', html, mount: (el) => {
    el.addEventListener('input', (e) => { if (e.target.matches('[data-cq]')) { st.q = e.target.value; const l = all.filter((a) => (st.status === 'all' || a.status === st.status) && (!st.goal || a.goal === st.goal) && (fullName(a).toLowerCase().includes(st.q.toLowerCase()) || a.email.includes(st.q.toLowerCase()))); $('[data-rows]', el).innerHTML = l.map(row).join('') || '<tr><td colspan="7" class="center small dim" style="padding:30px">Aucun résultat</td></tr>'; } });
    el.addEventListener('change', (e) => { if (e.target.matches('[data-cgoal]')) { st.goal = e.target.value; rerender(); } });
  } };
}, { role: 'coach' });

/* ---------- Fiche client (9.2) ---------- */
const CLIENT_TABS = [['apercu', 'Aperçu'], ['nutrition', 'Nutrition'], ['programme', 'Programme'], ['planning', 'Planning'], ['sessions', 'Sessions'], ['habitudes', 'Habitudes'], ['checkins', 'Check-ins'], ['progression', 'Progression'], ['calendrier', 'Calendrier']];
const scoreDots = (n, max = 5) => `<span class="row gap-4">${Array.from({ length: max }, (_, i) => `<i style="width:9px;height:9px;border-radius:50%;background:${i < n ? 'var(--s1)' : 'var(--surface-3)'}"></i>`).join('')}</span>`;
const ClientTabs = {
  apercu(a) {
    const asg = Sport.activeAsg(a.id); const pr = asg ? Sport.asgProgress(asg) : { done: 0, total: 0, pct: 0 }; const adh = Sport.adherence(a.id); const body = DB.body[a.id] || []; const ci = checkinState(a.id);
    const offer = byId(DB.coachOffers, a.offerId); const w0 = body[0]; const w1 = body[body.length - 1];
    return `<div class="grid g-4">${kpi({ label: 'Série de jours actifs', value: `${Sport.streak(a.id)} j`, ic: 'flame', tone: 'amber' })}${kpi({ label: 'Séances faites / prévues', value: `${pr.done} / ${pr.total}`, ic: 'dumbbell', tone: 'blue', sub: asg ? programById(asg.programId).name : 'Aucun programme' })}${kpi({ label: 'Adhérence globale', value: adh != null ? `${adh} %` : '—', ic: 'target', tone: 'green' })}${kpi({ label: 'Poids actuel', value: w1 ? `${fmt.num(w1.weight, 1)} kg` : `${fmt.num(a.weight, 1)} kg`, ic: 'scale', tone: 'violet', sub: w0 && w1 ? `${w1.weight - w0.weight > 0 ? '+' : ''}${fmt.num(w1.weight - w0.weight, 1)} kg en ${body.length} semaines` : '' })}</div>
      <div class="grid l-2-1 mt-16">${card('Évolution du poids', body.length ? Charts.line({ labels: body.map((b) => fmt.dm(parseYmd(b.date))), series: [{ name: 'Poids', color: 'var(--s1)', values: body.map((b) => b.weight) }], height: 230, yFmt: (v) => `${fmt.num(v, 1)} kg`, endLabels: true }) : emptyState('scale', 'Pas encore de mesure'))}
      ${card('Informations', `<div class="col gap-12 small"><div class="row between"><span class="muted">Âge</span><b>${ageFrom(a.birth)} ans</b></div><div class="row between"><span class="muted">Dernière séance</span><b>${a.lastSession ? fmt.dt(a.lastSession) : '—'}</b></div><div class="row between"><span class="muted">Prochain check-in</span><b>${fmt.dm(ci.due)} ${ci.status === 'late' ? pill('en retard', 'red') : ''}</b></div><div class="row between"><span class="muted">Formule</span><b>${offer ? `${esc(offer.name)} · ${fmt.eur(offer.price)}` : '—'}</b></div><div class="row between"><span class="muted">Contrat</span><b>${a.contract ? `v${a.contract.version} signé le ${fmt.dm(a.contract.signedAt)}` : '—'}</b></div><div class="row between"><span class="muted">Montre</span><b>${a.watch.connected ? `${esc((WATCH_BRANDS.find((w) => w[0] === a.watch.brand) || [])[1] || 'Connectée')} · ${a.watch.share ? 'partagée' : 'non partagée'}` : 'Non connectée'}</b></div><div class="row between"><span class="muted">Client depuis</span><b>${fmt.date(a.since)}</b></div></div>`)}</div>
      ${card('Notes du coach', `<textarea class="textarea" rows="3" data-cnotes="${a.id}" placeholder="Blessures, préférences, contexte…">${esc(a.notes)}</textarea><div class="row end mt-8"><button class="btn btn-soft btn-sm" data-action="client-notes" data-id="${a.id}">${icon('check', 14)} Enregistrer</button></div>`, { cls: 'mt-16' })}`;
  },
  nutrition(a) {
    const p = Nutri.planOf(a.id); const st = Nutri.stats(a.id); const prof = NutriCalc.profileOf(a);
    if (!p) return `${card('', `${emptyState('apple', 'Aucun programme nutrition assigné', `${esc(firstName(a))} voit le message « Aucun programme nutrition » et peut créer son propre plan en attendant.`, `<a class="btn btn-primary" href="#/coach/nutrition/plans/new?athlete=${a.id}">${icon('plus', 16)} Construire un plan</a>`)}`)}<div class="grid g-2 mt-16">${card('Profil nutritionnel', `<div class="col gap-8 small"><div class="row between"><span class="muted">Profil</span><b>${prof.sex === 'F' ? 'Femme' : 'Homme'}, ${prof.age} ans, ${prof.height} cm, ${fmt.num(prof.weight, 1)} kg</b></div><div class="row between"><span class="muted">Métabolisme de base</span><b>${fmt.num(NutriCalc.bmr(prof))} kcal</b></div><div class="row between"><span class="muted">Dépense estimée</span><b>${fmt.num(NutriCalc.tdee(prof))} kcal</b></div></div>`)}</div>`;
    const logs = DB.foodLogs[a.id];
    const days = Array.from({ length: 14 }, (_, k) => addDays(today0(), k - 13));
    const chart = logs ? Charts.bars({ labels: days.map((d) => fmt.dm(d)), series: [{ name: 'Consommé', color: 'var(--s2)', values: days.map((d) => Nutri.totals(logs[ymd(d)] || []).kcal) }, { name: 'Objectif', color: 'var(--s1)', values: days.map((d) => Nutri.targetsFor(a.id, d).kcal) }], height: 220, tipFmt: (v) => `${fmt.num(v)} kcal` }) : notice(`Taux de remplissage du journal : <b>${st.fill} %</b> sur 14 jours (détail journalier non disponible dans la démo).`, 'blue');
    return `<div class="grid g-4">${kpi({ label: 'Journal rempli (14 j)', value: `${st.fill} %`, ic: 'clipboard', tone: 'blue' })}${kpi({ label: 'Objectifs macros respectés', value: st.adherence != null ? `${st.adherence} %` : '—', ic: 'target', tone: 'green' })}${kpi({ label: 'Jour d’entraînement', value: `${fmt.num(p.targets.training.kcal)} kcal`, ic: 'dumbbell', tone: 'lime', sub: `P ${p.targets.training.p} · G ${p.targets.training.c} · L ${p.targets.training.f}` })}${kpi({ label: 'Jour de repos', value: `${fmt.num(p.targets.rest.kcal)} kcal`, ic: 'bed', tone: 'violet', sub: `P ${p.targets.rest.p} · G ${p.targets.rest.c} · L ${p.targets.rest.f}` })}</div>
      <div class="grid l-2-1 mt-16">${card('Calories — 14 derniers jours', chart)}${card('Plan en cours', `<div class="semibold">${esc(p.name)}</div><div class="xs dim mb-12">${p.mode === 'free' ? 'Libre autour des macros' : 'Repas détaillés'} · mis à jour ${fmt.rel(p.updatedAt)}</div>${Nutri.splitBar(p.targets.training)}<div class="col gap-8 small mt-12"><div class="row between"><span class="muted">Métabolisme de base</span><b>${fmt.num(NutriCalc.bmr(prof))} kcal</b></div><div class="row between"><span class="muted">Contraintes</span><b>${esc((p.profile.prefs || []).join(', ') || 'Aucune')}</b></div></div><div class="row wrap gap-8 mt-16"><a class="btn btn-primary btn-sm" href="#/coach/nutrition/plans/${p.id}">${icon('edit', 14)} Modifier</a><button class="btn btn-outline btn-sm" data-action="nplan-pdf" data-id="${p.id}">${icon('download', 14)} PDF</button></div>`)}</div>`;
  },
  programme(a) {
    const asg = Sport.activeAsg(a.id);
    if (!asg) return card('', emptyState('layers', 'Aucun programme en cours', 'Envoyez un programme à cet athlète.', `<button class="btn btn-primary" data-action="client-assign" data-id="${a.id}">${icon('plus', 16)} Assigner un programme</button>`));
    const p = programById(asg.programId); const pr = Sport.asgProgress(asg); const sch = Sport.scheduleFor(a.id).filter((e) => e.asg && e.asg.id === asg.id); const curW = clamp(Math.floor(daysBetween(asg.start, new Date()) / 7), 0, p.weeks.length - 1);
    return `<div class="card card-pad"><div class="row between wrap gap-16"><div><div class="row gap-8"><h2>${esc(p.name)}</h2>${statusPill(p.status === 'published' ? 'published' : 'draft')}${asg.status === 'paused' ? pill('En pause', 'amber') : ''}</div><div class="small muted mt-4">${fmt.date(asg.start)} → ${fmt.date(programEnd(asg))} · ${p.weeks.length} semaines · ${esc(p.level)} · semaine ${curW + 1} en cours</div></div><div class="row wrap gap-8"><button class="btn btn-outline btn-sm" data-action="client-assign" data-id="${a.id}">${icon('refresh', 14)} Changer</button><button class="btn btn-primary btn-sm" data-action="load-open" data-id="${asg.id}">${icon('sliders', 14)} Ajuster les charges ${asg.loadPct ? `(${asg.loadPct > 0 ? '+' : ''}${fmt.num(asg.loadPct, 1)} %)` : ''}</button></div></div><div class="row gap-12 mt-16"><div class="grow">${progress(pr.pct)}</div><b class="small">${pr.done}/${pr.total} séances · ${pr.pct} %</b></div></div>
      <div class="mt-16">${p.weeks.map((row, w) => { const es = sch.filter((e) => e.week === w); const done = es.filter((e) => e.status === 'done').length; return `<details class="week" ${w === curW ? 'open' : ''}><summary><b>Semaine ${w + 1}</b><span class="small muted">${fmt.dm(addDays(new Date(asg.start), w * 7))} – ${fmt.dm(addDays(new Date(asg.start), w * 7 + 6))}</span><span class="pill ${done === es.length && es.length ? 'pill-green' : ''}">${done}/${es.length}</span><span class="chev">${icon('chevD', 16)}</span></summary>${es.map((e) => { const s = sessionById(e.sessionId); return `<div class="day-row"><div class="day-date"><b>${e.date.getDate()}</b><span>${DOW[e.day]}</span></div><span class="st-ic ${e.status === 'done' ? 'done' : e.status === 'missed' ? 'missed' : e.status === 'today' ? 'today' : 'future'}">${icon(e.status === 'done' ? 'check' : e.status === 'missed' ? 'x' : e.status === 'today' ? 'play' : 'clock', 14)}</span><div class="grow" style="min-width:0"><div class="semibold small">${esc(s.name)}</div><div class="xs dim truncate">${s.items.map((it) => `${exById(it.exId).name} ${Sport.summary(it, asg.loadPct)}`).join(' · ')}</div>${e.log && e.log.watch && a.watch.share ? `<div class="xs t-red mt-4">${icon('heart', 11)} FC moy. ${e.log.watch.hrAvg} · max ${e.log.watch.hrMax} bpm · ${e.log.watch.kcal} kcal${e.log.watch.distance ? ` · ${fmt.num(e.log.watch.distance, 1)} km · ${e.log.watch.pace}` : ''}</div>` : ''}</div>${e.log ? `<button class="btn btn-ghost btn-xs" data-action="open-log" data-id="${e.log.id}">Bilan</button>` : `<button class="btn btn-ghost btn-xs" data-action="session-open" data-id="${s.id}">Détail</button>`}</div>`; }).join('') || '<div class="day-row small dim">Semaine de repos</div>'}</details>`; }).join('')}</div>`;
  },
  planning(a) {
    const st = ui(`cplan:${a.id}`, { f: 'all' });
    const list = Sport.scheduleFor(a.id).filter((e) => (e.status === 'upcoming' || e.status === 'today') && (st.f === 'all' || (st.f === 'program' ? e.source === 'program' : e.source === 'oneoff'))).slice(0, 30);
    return `<div class="row between wrap gap-8 mb-16">${seg([['all', 'Toutes'], ['program', 'Issues du programme'], ['oneoff', 'Hors programme']], st.f, `cplan:${a.id}`, 'f', 'sm')}<button class="btn btn-primary btn-sm" data-action="oneoff-open" data-athlete="${a.id}">${icon('plus', 14)} Séance ponctuelle</button></div>
      ${card('', list.length ? `<div class="list">${list.map((e) => { const s = sessionById(e.sessionId); return `<div class="li"><div class="day-date"><b>${e.date.getDate()}</b><span>${fmt.month(e.date)}</span></div><div class="grow"><div class="li-t">${esc(s.name)}</div><div class="li-s">${fmt.dateLong(e.date)} · ~${Sport.estDuration(s)} min${e.oneOff && e.oneOff.note ? ` · « ${esc(e.oneOff.note)} »` : ''}</div></div>${e.source === 'oneoff' ? pill('Hors programme', 'violet') : pill('Programme', 'blue')}${e.status === 'today' ? pill('Aujourd’hui', 'lime') : ''}<button class="icon-btn" data-action="session-open" data-id="${s.id}">${icon('eye', 15)}</button></div>`; }).join('')}</div>` : emptyState('calendar', 'Aucune séance à venir'))}`;
  },
  sessions(a) {
    const logs = Sport.logsOf(a.id);
    return card('Historique des séances', logs.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Date</th><th>Séance</th><th class="num">Durée</th><th class="num">Complétion</th><th class="num">Volume</th><th class="num">RPE moy.</th><th>Montre</th></tr></thead><tbody>${logs.map((l) => `<tr class="click" data-action="open-log" data-id="${l.id}"><td class="small">${fmt.dt(l.date)}</td><td class="semibold">${esc(sessionById(l.sessionId).name)}</td><td class="num">${fmt.dur(l.duration)}</td><td class="num">${l.completion} %</td><td class="num">${fmt.tonnes(l.volume)}</td><td class="num">${l.rpeAvg ?? '—'}</td><td class="small">${l.watch ? (a.watch.share ? `${icon('heart', 12)} ${l.watch.hrAvg}/${l.watch.hrMax} bpm · ${l.watch.kcal} kcal` : '<span class="dim">Non partagé</span>') : '—'}</td></tr>`).join('')}</tbody></table></div>` : emptyState('activity', 'Aucune séance effectuée'), { pad: !logs.length, sub: `${logs.length} séances` });
  },
  habitudes(a) {
    const hs = DB.habits[a.id] || [];
    return `<div class="row end mb-12"><button class="btn btn-primary btn-sm" data-action="habit-add" data-id="${a.id}">${icon('plus', 14)} Ajouter une habitude</button></div><div class="grid g-2">${hs.map((h) => { const done = h.history.filter((x) => x.done).length; let streak = 0; for (let i = h.history.length - 1; i >= 0; i--) { if (h.history[i].done) streak++; else if (i !== h.history.length - 1) break; } return `<div class="card card-pad"><div class="row between"><div class="row gap-8"><span class="li-ic blue">${icon(h.icon, 16)}</span><div><div class="semibold">${esc(h.name)}</div><div class="xs dim">${h.kind === 'num' ? `Objectif ${fmt.num(h.target, 1)} ${h.unit}/jour${h.source === 'watch' ? ' · via la montre' : ''}` : 'Oui / non chaque jour'}</div></div></div><div class="right"><b>${streak} j</b><div class="xxs dim">série</div></div></div><div class="hgrid g28 mt-12">${h.history.map((x) => `<span class="hcell ${x.done ? 'on' : ''}" data-tip="${esc(`${fmt.dm(parseYmd(x.date))} : ${h.kind === 'num' ? `${fmt.num(x.value, 1)} ${h.unit}` : x.done ? 'fait' : 'non fait'}`)}"></span>`).join('')}</div><div class="xs dim mt-8">${pct(done, h.history.length)} % de réussite sur 28 jours</div></div>`; }).join('') || card('', emptyState('droplet', 'Aucune habitude suivie'))}</div>`;
  },
  checkins(a) {
    const ci = checkinState(a.id);
    return `<div class="card card-pad mb-16 row wrap gap-12"><span class="li-ic ${ci.status === 'late' ? 'red' : ci.status === 'completed' ? 'green' : 'amber'}">${icon('clipboard', 16)}</span><div class="grow"><div class="semibold">Check-in de la semaine : ${ci.status === 'completed' ? 'complété' : ci.status === 'late' ? 'semaine précédente en retard' : `attendu avant le ${fmt.dateLong(ci.due)}`}</div><div class="xs dim">Questions : fatigue, sommeil, motivation, respect du programme.</div></div><button class="btn btn-outline btn-sm" data-action="info" data-msg="Rappel de check-in envoyé à ${esc(firstName(a))}">${icon('bell', 14)} Envoyer un rappel</button></div>
      <div class="timeline">${ci.list.map((x) => `<div class="tl-item"><div class="card card-pad"><div class="row between wrap gap-8"><b>Semaine du ${fmt.dm(parseYmd(x.week))}</b><span class="xs dim">Envoyé ${fmt.dt(x.date)}</span></div><div class="grid g-4 mt-12 small"><div><div class="xs dim mb-4">Fatigue</div>${scoreDots(x.fatigue)}</div><div><div class="xs dim mb-4">Sommeil</div>${scoreDots(x.sleep)}</div><div><div class="xs dim mb-4">Motivation</div>${scoreDots(x.motivation)}</div><div><div class="xs dim mb-4">Respect du programme</div><b>${x.adherence} %</b></div></div>${x.pain ? `<div class="notice red mt-12">${icon('alert', 15)}<div>Douleur : ${esc(x.pain)}</div></div>` : ''}${x.comment ? `<p class="small mt-12">« ${esc(x.comment)} »</p>` : ''}</div></div>`).join('') || emptyState('clipboard', 'Aucun check-in')}</div>`;
  },
  progression(a) {
    const st = ui(`cprog:${a.id}`, { metric: 'weight', ex: '' }); const body = DB.body[a.id] || [];
    const M = { weight: ['Poids', 'kg', 'var(--s1)'], waist: ['Tour de taille', 'cm', 'var(--s7)'], fat: ['Masse grasse', '%', 'var(--s2)'] };
    const logs = Sport.logsOf(a.id).slice().reverse();
    const exIds = unique(logs.flatMap((l) => l.exercises.filter((e) => e.sets.some((x) => isNum(x.load) && Number(x.load) > 0)).map((e) => e.exId)));
    if (!st.ex || !exIds.includes(st.ex)) st.ex = exIds[0] || '';
    const pts = logs.map((l) => { const e = l.exercises.find((x) => x.exId === st.ex); const best = e ? Math.max(0, ...e.sets.map((x) => (isNum(x.load) ? Number(x.load) : 0))) : 0; return best ? { d: l.date, v: best } : null; }).filter(Boolean);
    const prs = exIds.map((id) => { let best = 0; let date = null; logs.forEach((l) => { const e = l.exercises.find((x) => x.exId === id); if (e) e.sets.forEach((x) => { if (isNum(x.load) && Number(x.load) > best) { best = Number(x.load); date = l.date; } }); }); return { id, best, date }; }).sort((x, y) => y.best - x.best).slice(0, 8);
    return `<div class="grid g-2">${card('Composition corporelle', `<div class="mb-12">${seg(Object.entries(M).map(([k, v]) => [k, v[0]]), st.metric, `cprog:${a.id}`, 'metric', 'sm')}</div>${body.length ? Charts.line({ labels: body.map((b) => fmt.dm(parseYmd(b.date))), series: [{ name: M[st.metric][0], color: M[st.metric][2], values: body.map((b) => b[st.metric]) }], height: 220, yFmt: (v) => `${fmt.num(v, 1)} ${M[st.metric][1]}`, endLabels: true }) : emptyState('scale', 'Aucune mesure')}`)}
      ${card('Performances', exIds.length ? `<div class="mb-12">${select('ex', exIds.map((id) => [id, exById(id).name]), st.ex, `data-pex="${a.id}"`, 'sm')}</div>${Charts.line({ labels: pts.map((x) => fmt.dm(x.d)), series: [{ name: 'Charge max', color: 'var(--s3)', values: pts.map((x) => x.v) }], height: 196, yFmt: (v) => `${fmt.num(v, 1)} kg`, endLabels: true })}` : emptyState('trendUp', 'Pas encore de données'))}</div>
      ${card('Records personnels', prs.length ? `<div class="table-wrap"><table class="table compact"><thead><tr><th>Exercice</th><th class="num">Meilleure charge</th><th>Date</th></tr></thead><tbody>${prs.map((x) => `<tr><td>${esc(exById(x.id).name)}</td><td class="num semibold">${fmt.num(x.best, 1)} kg</td><td class="small muted">${fmt.date(x.date)}</td></tr>`).join('')}</tbody></table></div>` : '<span class="small dim">—</span>', { cls: 'mt-16', pad: !prs.length })}`;
  },
  calendrier(a) {
    const events = Sport.scheduleFor(a.id).map((e, k) => { const s = sessionById(e.sessionId); const d = e.log ? new Date(e.log.date) : atTime(e.date, '18:00'); return { id: `sch-${a.id}-${k}`, title: s.name, start: d.toISOString(), duration: e.log ? Math.round(e.log.duration / 60) : Sport.estDuration(s), color: e.status === 'missed' ? 'var(--s8)' : e.source === 'oneoff' ? 'var(--s7)' : 'var(--s1)', done: e.status === 'done', sub: e.status === 'done' ? 'Faite' : e.status === 'missed' ? 'Manquée' : 'Prévue', ref: e.log ? e.log.id : null, sid: s.id }; });
    DB.appointments.filter((x) => x.athleteId === a.id).forEach((x) => events.push({ id: x.id, title: `RDV · ${x.type}`, start: x.start, duration: x.duration, color: APPT_COLORS[x.type] || 'var(--s4)', sub: x.mode === 'visio' ? 'Visio' : 'Présentiel' }));
    UI.clientCalEvents = events;
    return card('', Cal.render(`ccal:${a.id}`, events, { onEvent: 'client-cal-event' }));
  },
};
Actions['client-cal-event'] = (el) => {
  const ev = (UI.clientCalEvents || []).find((x) => x.id === el.dataset.id); if (!ev) return;
  if (ev.ref) Actions['open-log']({ dataset: { id: ev.ref } });
  else if (ev.sid) Actions['session-open']({ dataset: { id: ev.sid } });
  else Actions['appt-open']({ dataset: { id: ev.id } });
};
route('/coach/clients/:id/:tab?', (p) => {
  const a = athleteById(p.id); const c = meCoach();
  if (!a || a.coachId !== c.id) { go('/coach/clients'); return null; }
  const tab = CLIENT_TABS.some(([k]) => k === p.tab) ? p.tab : 'apercu';
  const t = ChatUI.threadBetween(c.id, a.id);
  const head = `<a class="back-link" href="#/coach/clients">${icon('arrowL', 16)} Clients</a><div class="card card-pad mb-16"><div class="client-head">${avatar(a, 'xl')}<div class="grow"><div class="row gap-8 wrap"><h1>${esc(fullName(a))}</h1>${statusPill(a.status)}</div><div class="meta"><span class="tag">${icon('target', 12)}&nbsp;${esc(a.goal)}</span><span class="tag">${ageFrom(a.birth)} ans</span><span class="tag">${icon('mapPin', 12)}&nbsp;${esc(a.city)}</span>${a.tags.map((x) => `<span class="tag">${esc(x)}</span>`).join('')}${a.watch.connected ? `<span class="tag">${icon('watch', 12)}&nbsp;Montre</span>` : ''}</div></div><div class="row wrap gap-8"><a class="btn btn-outline btn-sm" href="#/coach/messages/${t.id}">${icon('message', 15)} Message</a><button class="btn btn-outline btn-sm" data-action="appt-new" data-athlete="${a.id}">${icon('calendar', 15)} RDV</button>${a.status !== 'pre' ? `<button class="btn btn-outline btn-sm" data-action="preview-as" data-id="${a.id}">${icon('eye', 15)} Aperçu</button>` : ''}<button class="btn btn-soft-red btn-sm" data-action="client-end" data-id="${a.id}">${icon('userX', 15)} Fin d’affiliation</button></div></div>${a.status === 'pre' ? `<div class="notice blue mt-16">${icon('userPlus', 16)}<div><b>Profil pré-rempli</b> : en attente de création du compte. Dès que ${esc(a.first)} s’inscrit avec <b>${esc(a.email)}</b>, son compte se relie automatiquement à ce profil. <a class="link" data-action="info" data-msg="Invitation renvoyée à ${esc(a.email)}">Renvoyer l’invitation</a></div></div>` : ''}</div>`;
  return { title: fullName(a), crumb: 'Clients', html: `${head}${tabsNav(CLIENT_TABS.map(([id, label]) => ({ id, label })), tab, { base: `/coach/clients/${a.id}` })}${ClientTabs[tab](a)}`,
    mount: (el) => el.addEventListener('change', (e) => { if (e.target.dataset.pex) { ui(`cprog:${a.id}`).ex = e.target.value; rerender(); } }) };
}, { role: 'coach' });
Object.assign(Actions, {
  'preview-as': (el) => { S.previewAthleteId = el.dataset.id; go('/athlete/home'); },
  'client-notes': (el) => { const a = athleteById(el.dataset.id); a.notes = $(`[data-cnotes="${a.id}"]`).value; toast('Notes enregistrées'); },
  'client-assign': (el) => {
    const a = athleteById(el.dataset.id); const progs = DB.programs.filter((p) => p.ownerId === S.userId);
    openModal({ title: 'Choisir un programme', sub: `Pour ${esc(fullName(a))}`, size: 'md', body: `<div class="col gap-8">${progs.map((p) => `<button type="button" class="ex-row" data-pid="${p.id}"><span class="li-ic blue">${icon('calCheck', 16)}</span><div class="grow"><div class="semibold">${esc(p.name)}</div><div class="xs dim">${p.weeks.length} semaines · ${esc(p.level)} · ${p.weeks.flat().filter(Boolean).length} séances</div></div>${statusPill(p.status)}</button>`).join('')}</div>`, footer: '<a class="btn btn-outline" href="#/coach/programs/new" data-close>Créer un programme</a><button class="btn btn-ghost" data-close>Annuler</button>',
      onMount: (box, m) => box.addEventListener('click', (e) => { const b = e.target.closest('[data-pid]'); if (b) { m.close(); Sport.assignModal(b.dataset.pid, a.id); } }) });
  },
  'client-end': async (el) => {
    const a = athleteById(el.dataset.id); const c = meCoach();
    if (!(await confirmDialog({ title: 'Mettre fin à l’affiliation ?', message: `${esc(fullName(a))} ne sera plus suivi·e par vous. Son compte devient « athlète solo » : il conserve son historique et l’accès gratuit à l’application.`, confirm: 'Mettre fin au suivi', danger: true }))) return;
    if (a.status === 'pre') DB.athletes.splice(DB.athletes.indexOf(a), 1);
    else { a.coachId = null; DB.assignments.filter((x) => x.athleteId === a.id && x.status !== 'ended').forEach((x) => { x.status = 'ended'; }); DB.nutritionPlans.filter((x) => x.athleteId === a.id && x.ownerId === c.id && x.status === 'active').forEach((x) => { x.status = 'archived'; }); notify(a.id, `<b>${esc(fullName(c))}</b> a mis fin au suivi. Vous gardez l’accès gratuit à ELEV8.`, '/athlete/coaches', 'userX'); }
    logActivity('client', `${fullName(c)} a mis fin à l’affiliation de ${fullName(a)}`, 'userX'); toast('Affiliation terminée'); go('/coach/clients');
  },
  'habit-add': (el) => {
    const a = athleteById(el.dataset.id);
    openModal({ title: 'Ajouter une habitude', sub: esc(fullName(a)), size: 'sm', body: `<form data-hf class="col gap-12">${field('Nom', input('name', '', { placeholder: 'Ex. : 10 min de mobilité' }))}${field('Type', select('kind', [['bool', 'Oui / non'], ['num', 'Valeur chiffrée']], 'bool'))}<div class="grid g-2">${field('Objectif', input('target', '', { type: 'number', placeholder: '2,5' }))}${field('Unité', input('unit', '', { placeholder: 'L, pas, h…' }))}</div></form>`, footer: '<button class="btn btn-ghost" data-close>Annuler</button><button class="btn btn-primary" data-ok>Ajouter</button>',
      onMount: (box, m) => $('[data-ok]', box).addEventListener('click', () => { const v = formValues($('[data-hf]', box)); if (!v.name.trim()) { toast('Nom requis', 'error'); return; } DB.habits[a.id] = DB.habits[a.id] || []; DB.habits[a.id].push({ id: uid('hb'), name: v.name.trim(), icon: v.kind === 'num' ? 'activity' : 'check', kind: v.kind, target: Number(v.target) || 1, unit: v.unit, history: Array.from({ length: 28 }, (_, k) => ({ date: ymd(addDays(new Date(), k - 27)), value: 0, done: false })) }); notify(a.id, `Nouvelle habitude à suivre : <b>${esc(v.name)}</b>`, '/athlete/habits', 'droplet'); m.close(); toast('Habitude ajoutée'); rerender(); }) });
  },
});

/* ---------- Sport : exercices, séances, programmes ---------- */
route('/coach/exercises', () => Sport.libraryPage('coach'), { role: 'coach' });
route('/coach/exercises/new', () => Sport.exerciseForm('coach'), { role: 'coach' });
route('/coach/exercises/:id/edit', (p) => Sport.exerciseForm('coach', p.id), { role: 'coach' });
route('/coach/sessions', () => {
  const list = Sport.sessionsFor('coach');
  const html = `${pageHead('Séances', 'Une séance regroupe plusieurs exercices. Assemblez-les ensuite en programmes, ou assignez-les ponctuellement.', `<a class="btn btn-primary" href="#/coach/sessions/new">${icon('plus', 16)} Créer une séance</a>`)}<div class="grid g-auto-lg">${list.map((s) => Sport.sessionCard(s, { badge: pill(s.intensity, s.intensity === 'Élevée' ? 'red' : s.intensity === 'Modérée' ? 'amber' : 'green'), actions: `<a class="btn btn-outline btn-xs" href="#/coach/sessions/${s.id}/edit">${icon('edit', 12)} Modifier</a><button class="btn btn-ghost btn-xs" data-action="session-dup" data-id="${s.id}">${icon('copy', 12)} Dupliquer</button><button class="btn btn-ghost btn-xs" data-action="oneoff-open" data-session="${s.id}">${icon('calendar', 12)} Assigner</button>` })).join('') || emptyState('layers', 'Aucune séance', 'Créez votre première séance.')}</div>`;
  return { title: 'Séances', html };
}, { role: 'coach' });
route('/coach/sessions/new', (p, q) => Sport.builder('coach', null, q), { role: 'coach' });
route('/coach/sessions/:id/edit', (p, q) => Sport.builder('coach', p.id, q), { role: 'coach' });
route('/coach/programs', () => {
  const list = DB.programs.filter((p) => p.ownerId === S.userId);
  const html = `${pageHead('Programmes', 'Un programme assemble plusieurs séances sur une durée donnée, avec un calendrier semaine par semaine.', `<a class="btn btn-primary" href="#/coach/programs/new">${icon('plus', 16)} Nouveau programme</a>`)}<div class="grid g-auto-lg">${list.map((p) => {
    const n = DB.assignments.filter((x) => x.programId === p.id && x.status !== 'ended'); const perW = p.weeks.flat().filter(Boolean).length / p.weeks.length; const listing = DB.shop.listings.find((l) => l.refId === p.id);
    return `<div class="card"><div class="card-b col gap-12"><div class="row between gap-8"><h3>${esc(p.name)}</h3>${statusPill(p.status)}</div><div class="row wrap gap-6"><span class="tag">${p.weeks.length} semaines</span><span class="tag">${fmt.num(perW, 1)} séances/sem.</span><span class="tag">${esc(p.level)}</span><span class="tag">${esc(p.objective)}</span>${listing ? `<span class="tag">${icon('bag', 11)}&nbsp;${listing.published ? 'En vente' : 'Retiré'}</span>` : ''}</div><div class="hgrid g7">${p.weeks[0].map((sid) => `<span class="hcell ${sid ? 'on' : ''}" data-tip="${sid ? esc(sessionById(sid).name) : 'Repos'}"></span>`).join('')}</div><div class="row between"><div class="av-stack">${n.slice(0, 5).map((x) => avatar(athleteById(x.athleteId), 'xs')).join('')}</div><span class="xs dim">${n.length} athlète${n.length > 1 ? 's' : ''}</span></div><div class="row wrap gap-6"><a class="btn btn-primary btn-xs" href="#/coach/programs/${p.id}">${icon('edit', 12)} Ouvrir</a><button class="btn btn-outline btn-xs" data-action="assign-open" data-id="${p.id}">${icon('userPlus', 12)} Assigner</button><button class="btn btn-ghost btn-xs" data-action="program-dup" data-id="${p.id}">${icon('copy', 12)} Dupliquer</button><a class="btn btn-ghost btn-xs" href="#/coach/shop/programs?sell=${p.id}">${icon('bag', 12)} Vendre</a></div></div></div>`;
  }).join('') || emptyState('calCheck', 'Aucun programme')}</div>`;
  return { title: 'Programmes', html };
}, { role: 'coach' });
route('/coach/programs/new', () => Sport.programEditor('coach', null), { role: 'coach' });
route('/coach/programs/:id', (p) => (programById(p.id) ? Sport.programEditor('coach', p.id) : (go('/coach/programs'), null)), { role: 'coach' });
Actions['program-dup'] = (el) => {
  const p = programById(el.dataset.id); const c = { ...JSON.parse(JSON.stringify(p)), id: uid('p'), name: `${p.name} (copie)`, status: 'draft', ownerId: S.userId, createdAt: new Date().toISOString() };
  DB.programs.push(c); toast('Programme dupliqué : adaptez-le à un autre athlète'); go(`/coach/programs/${c.id}`);
};

/* ---------- Nutrition ---------- */
route('/coach/nutrition', () => Nutri.coachOverview(), { role: 'coach' });
route('/coach/nutrition/plans', () => Nutri.coachPlans(), { role: 'coach' });
route('/coach/nutrition/plans/new', (p, q) => Nutri.planBuilder('coach', null, q), { role: 'coach' });
route('/coach/nutrition/plans/:id', (p) => (nplanById(p.id) ? Nutri.planBuilder('coach', p.id) : (go('/coach/nutrition/plans'), null)), { role: 'coach' });
route('/coach/nutrition/library', () => Nutri.libraryPage('coach'), { role: 'coach' });
route('/coach/nutrition/recipes', () => Nutri.recipesPage('coach'), { role: 'coach' });
