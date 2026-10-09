'use strict';
/* =========================================================
   ELEV8 — Espace Coach (2/4) : prospects, rendez-vous,
   disponibilités, messagerie, habitudes & check-ins globaux
   ========================================================= */
(() => {
  const upsell = (feature, plan = 'Pro') => `<div class="card card-pad" style="max-width:640px;margin:40px auto;text-align:center"><div class="empty-ic" style="margin:0 auto 12px">${icon('lock', 26)}</div><h2>${feature}</h2><p class="muted mt-8">Disponible à partir de la formule <b>${plan}</b>. Votre formule actuelle : <b>${PLAN_NAMES[meCoach().plan]}</b>.</p><a class="btn btn-primary mt-16" href="#/coach/settings/abonnement">Voir les formules</a></div>`;

  /* ---------- Prospects (9.4) ---------- */
  const PST = Object.fromEntries(PROSPECT_STATUS);
  route('/coach/prospects', () => {
    if (!hasPlan('pro')) return { title: 'Prospects', html: upsell('Prospects et CRM') };
    const c = meCoach(); const st = ui('prospects', { view: 'list', f: 'all', q: '' });
    const all = DB.prospects.filter((p) => p.coachId === c.id);
    const list = all.filter((p) => (st.f === 'all' || p.status === st.f) && (!st.q || p.name.toLowerCase().includes(st.q.toLowerCase())));
    const n = (s) => all.filter((p) => p.status === s).length;
    const quick = (p) => (['converted', 'lost'].includes(p.status) ? '' : `<button class="btn btn-soft-green btn-xs" data-action="prospect-set" data-id="${p.id}" data-s="converted">${icon('check', 12)} Converti</button><button class="btn btn-soft-red btn-xs" data-action="prospect-set" data-id="${p.id}" data-s="lost">${icon('x', 12)} Perdu</button>`);
    const table = `<div class="card"><div class="table-wrap"><table class="table"><thead><tr><th>Prospect</th><th>Source</th><th>Statut</th><th>Notes</th><th>Ajouté</th><th></th></tr></thead><tbody>${list.map((p) => `<tr><td><div class="person click" data-action="prospect-edit" data-id="${p.id}">${avatar({ name: p.name }, 'sm')}<div><div class="nm">${esc(p.name)}</div><div class="em">${esc(p.email)} · ${esc(p.phone)}</div></div></div></td><td><span class="tag">${esc(p.source)}</span></td><td>${select('st', PROSPECT_STATUS, p.status, `data-pstatus="${p.id}"`, 'sm')}</td><td class="small muted" style="max-width:260px">${esc(p.notes)}</td><td class="small muted">${fmt.rel(p.createdAt)}</td><td><div class="actions">${quick(p)}</div></td></tr>`).join('') || `<tr><td colspan="6">${emptyState('briefcase', 'Aucun prospect')}</td></tr>`}</tbody></table></div></div>`;
    const kanban = `<div class="kanban">${PROSPECT_STATUS.map(([k, l]) => `<div class="kan-col"><h4><span>${l}</span><span class="pill">${n(k)}</span></h4>${all.filter((p) => p.status === k).map((p) => `<div class="kan-card" data-action="prospect-edit" data-id="${p.id}"><div class="semibold">${esc(p.name)}</div><div class="xs dim">${esc(p.source)}</div>${p.notes ? `<div class="xs clamp-2">${esc(p.notes)}</div>` : ''}${!['converted', 'lost'].includes(k) ? `<div class="row gap-4 mt-4">${quick(p)}</div>` : ''}</div>`).join('')}</div>`).join('')}</div>`;
    const html = `${pageHead('Prospects', 'Les personnes intéressées qui ne sont pas encore clientes.', `<button class="btn btn-primary" data-action="prospect-edit">${icon('plus', 16)} Ajouter un prospect</button>`)}
      <div class="grid g-4 mb-16">${kpi({ label: 'Total', value: all.length, ic: 'users', tone: 'blue' })}${kpi({ label: 'Prospects actifs', value: n('todo') + n('contacted') + n('meeting'), ic: 'activity', tone: 'violet' })}${kpi({ label: 'Rendez-vous planifiés', value: n('meeting'), ic: 'calendar', tone: 'amber' })}${kpi({ label: 'Convertis en clients', value: n('converted'), ic: 'checkCircle', tone: 'green', sub: all.length ? `${pct(n('converted'), all.length)} % de conversion` : '' })}</div>
      <div class="row between wrap gap-8 mb-16"><div class="row wrap gap-8">${searchBox('q', st.q, 'Rechercher…', 'data-pq')}${st.view === 'list' ? seg([['all', 'Tous'], ...PROSPECT_STATUS], st.f, 'prospects', 'f', 'sm') : ''}</div>${seg([['list', 'Liste'], ['kanban', 'Pipeline']], st.view, 'prospects', 'view', 'sm')}</div>${st.view === 'list' ? table : kanban}`;
    return { title: 'Prospects', html, mount: (el) => {
      el.addEventListener('change', (e) => { const id = e.target.dataset.pstatus; if (id) setProspect(id, e.target.value); });
      el.addEventListener('input', (e) => { if (e.target.matches('[data-pq]')) { st.q = e.target.value; clearTimeout(st.t); st.t = setTimeout(() => { rerender(); const i = $('[data-pq]'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 350); } });
    } };
  }, { role: 'coach' });
  async function setProspect(id, s) {
    const p = byId(DB.prospects, id); p.status = s; p.updatedAt = new Date().toISOString();
    toast(`${esc(p.name)} : ${PST[s]}`);
    if (s === 'converted' && await confirmDialog({ title: 'Prospect converti 🎉', message: `Pré-enregistrer ${esc(p.name)} comme client ? Son compte se reliera automatiquement quand il s’inscrira avec ${esc(p.email)}.`, confirm: 'Pré-enregistrer comme client' })) {
      const c = meCoach(); if (!checkClientLimit(c)) return;
      if (!DB.athletes.some((a) => a.email === p.email)) { const [first, ...rest] = p.name.split(' '); DB.athletes.push(mkAthlete({ id: uid('a'), first, last: rest.join(' '), email: p.email, phone: p.phone, coachId: c.id, status: 'pre', notes: p.notes, since: new Date().toISOString(), lastLogin: null })); logActivity('preregister', `Nouveau client pré-inscrit : ${p.name}`, 'userPlus'); toast('Client pré-enregistré'); }
    }
    rerender();
  }
  Actions['prospect-set'] = (el) => setProspect(el.dataset.id, el.dataset.s);
  Actions['prospect-edit'] = (el) => {
    const p = el.dataset.id ? byId(DB.prospects, el.dataset.id) : null;
    const v = p || { name: '', email: '', phone: '', source: 'Ajout manuel', status: 'todo', notes: '' };
    openModal({ title: p ? 'Fiche prospect' : 'Nouveau prospect', size: 'md', body: `<form data-pf class="form-grid">${field('Nom complet', input('name', v.name, { attrs: 'required' }))}${field('Email', input('email', v.email, { type: 'email' }))}${field('Téléphone', input('phone', v.phone, { type: 'tel' }))}${field('Source', select('source', PROSPECT_SOURCES, v.source))}<div class="full">${field('Statut', select('status', PROSPECT_STATUS, v.status))}</div><div class="full">${field('Notes', textarea('notes', v.notes, { rows: 3, placeholder: 'Objectif de la personne, contexte, prochaine action…' }))}</div></form>`,
      footer: `${p ? `<button class="btn btn-soft-red left" data-del>${icon('trash', 15)}</button><button class="btn btn-outline" data-action="appt-new" data-prospect="${p.id}" data-close>${icon('calendar', 15)} Planifier un RDV</button>` : ''}<button class="btn btn-ghost" data-close>Annuler</button><button class="btn btn-primary" data-ok>Enregistrer</button>`,
      onMount: (box, m) => {
        $('[data-ok]', box).addEventListener('click', () => { const f = formValues($('[data-pf]', box)); if (!f.name.trim()) { toast('Nom requis', 'error'); return; } if (p) Object.assign(p, f, { updatedAt: new Date().toISOString() }); else DB.prospects.unshift({ id: uid('pr'), coachId: S.userId, ...f, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }); m.close(); toast(p ? 'Prospect mis à jour' : 'Prospect ajouté'); rerender(); });
        const d = $('[data-del]', box); if (d) d.addEventListener('click', () => { DB.prospects.splice(DB.prospects.indexOf(p), 1); m.close(); toast('Prospect supprimé'); rerender(); });
      } });
  };

  /* ---------- Rendez-vous & disponibilités (9.5) ---------- */
  const apptEvents = (cId) => DB.appointments.filter((x) => x.coachId === cId && x.status !== 'cancelled').map((x) => ({ id: x.id, title: `${x.type} · ${x.athleteId ? fullName(athleteById(x.athleteId)) : x.guest || 'Invité'}`, start: x.start, duration: x.duration, color: APPT_COLORS[x.type] || 'var(--s1)', sub: x.mode === 'visio' ? 'Visio' : 'Présentiel', done: new Date(x.start) < new Date() }));
  route('/coach/appointments/:tab?', (p) => {
    const c = meCoach(); const tab = p.tab === 'disponibilites' ? 'disponibilites' : 'agenda';
    const m0 = startOfMonth(new Date()); const m1 = addMonths(m0, 1);
    const month = DB.appointments.filter((x) => x.coachId === c.id && x.status !== 'cancelled' && new Date(x.start) >= m0 && new Date(x.start) < m1);
    let body;
    if (tab === 'agenda') {
      body = `<div class="grid g-4 mb-16">${kpi({ label: 'Rendez-vous ce mois-ci', value: month.length, ic: 'calendar', tone: 'blue' })}${kpi({ label: 'Dont en visio', value: month.filter((x) => x.mode === 'visio').length, ic: 'video', tone: 'violet' })}${kpi({ label: 'Aujourd’hui', value: month.filter((x) => isSameDay(x.start, new Date())).length, ic: 'clock', tone: 'amber' })}${kpi({ label: 'Rappels 24 h', value: c.settings.notifs.appt24 ? 'Activés' : 'Désactivés', ic: 'bell', tone: 'green' })}</div>${card('', Cal.render('coach-cal', apptEvents(c.id), { onEvent: 'appt-open', extraHead: `<span class="row wrap gap-8 hide-sm">${APPT_TYPES.map((t) => `<span class="xs"><span class="legend-key" style="background:${APPT_COLORS[t]}"></span>${t}</span>`).join('')}</span>` }))}`;
    } else {
      const av = DB.availability[c.id] = DB.availability[c.id] || DOW.map(() => ({ on: false, slots: [] }));
      body = card('Disponibilités de réservation', `<p class="small muted mb-12">Pour chaque jour : activez-le puis indiquez une ou deux plages horaires où vos clients peuvent réserver.</p>${av.map((d, i) => `<div class="avail-day"><label class="row gap-12 semibold">${switchEl(`on${i}`, d.on, `data-av-on="${i}"`)} ${DOW_LONG[i]}</label><div class="avail-slots">${d.on ? `${d.slots.map((s, k) => `<span class="avail-slot"><input class="input" type="time" value="${s[0]}" data-av="${i}:${k}:0"><span class="dim">→</span><input class="input" type="time" value="${s[1]}" data-av="${i}:${k}:1">${d.slots.length > 1 ? `<button type="button" class="icon-btn danger" data-av-rm="${i}:${k}">${icon('x', 14)}</button>` : ''}</span>`).join('')}${d.slots.length < 2 ? `<button type="button" class="btn btn-ghost btn-sm" data-av-add="${i}">${icon('plus', 14)} Plage</button>` : ''}` : '<span class="small dim">Indisponible</span>'}</div></div>`).join('')}`, { footer: `<button class="btn btn-primary" data-action="av-save">${icon('check', 16)} Enregistrer</button>` });
    }
    return { title: 'Rendez-vous', html: `${pageHead('Rendez-vous', 'Bilans, suivis et visios avec vos clients.', `<button class="btn btn-primary" data-action="appt-new">${icon('plus', 16)} Nouveau rendez-vous</button>`)}${tabsNav([{ id: 'agenda', label: 'Agenda', ic: 'calendar' }, { id: 'disponibilites', label: 'Disponibilités', ic: 'clock' }], tab, { base: '/coach/appointments' })}${body}`,
      mount: (el) => {
        if (tab !== 'disponibilites') return;
        const av = DB.availability[c.id];
        el.addEventListener('change', (e) => { const t = e.target; if (t.dataset.avOn != null) { const d = av[Number(t.dataset.avOn)]; d.on = t.checked; if (d.on && !d.slots.length) d.slots.push(['09:00', '12:00']); rerender(); } if (t.dataset.av) { const [i, k, j] = t.dataset.av.split(':').map(Number); av[i].slots[k][j] = t.value; } });
        el.addEventListener('click', (e) => { const a = e.target.closest('[data-av-add]'); if (a) { av[Number(a.dataset.avAdd)].slots.push(['14:00', '18:00']); rerender(); } const r = e.target.closest('[data-av-rm]'); if (r) { const [i, k] = r.dataset.avRm.split(':').map(Number); av[i].slots.splice(k, 1); rerender(); } });
      } };
  }, { role: 'coach' });
  Actions['av-save'] = () => toast('Disponibilités enregistrées : vos clients peuvent réserver sur ces créneaux');
  const inAvailability = (cId, date) => { const d = DB.availability[cId] && DB.availability[cId][dowIndex(date)]; if (!d || !d.on) return false; const hm = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`; return d.slots.some(([a, b]) => hm >= a && hm < b); };
  Actions['appt-new'] = (el) => {
    const c = meCoach(); const clients = clientsOf(c.id); const pr = el.dataset.prospect ? byId(DB.prospects, el.dataset.prospect) : null;
    openModal({ title: 'Nouveau rendez-vous', size: 'md',
      body: `<form data-af class="form-grid"><div class="full">${field('Client', select('athlete', [...clients.map((a) => [a.id, `${fullName(a)}${a.status === 'pre' ? ' (pré-inscrit)' : ''}`]), ...(pr ? [[`prospect:${pr.id}`, `${pr.name} (prospect)`]] : [])], pr ? `prospect:${pr.id}` : el.dataset.athlete || (clients[0] && clients[0].id)))}</div>
        <div class="full">${field('Type', chips('type', APPT_TYPES, pr ? 'Découverte' : 'Bilan mensuel', { custom: false }))}</div>
        <div class="full">${field('Mode', `<div class="row gap-12"><label class="radio-card grow"><input type="radio" name="mode" value="visio" checked>${icon('video', 18)}<div><div class="semibold">Visio</div><div class="xs dim">Appel vidéo dans l’application</div></div></label><label class="radio-card grow"><input type="radio" name="mode" value="presentiel">${icon('mapPin', 18)}<div><div class="semibold">Présentiel</div><div class="xs dim">${esc(c.gym || 'Salle')}</div></div></label></div>`)}</div>
        ${field('Date', input('date', ymd(addDays(new Date(), 1)), { type: 'date' }))}${field('Heure', input('time', '10:00', { type: 'time' }))}<div class="full">${field('Durée', chips('duration', ['30', '45', '60', '90'], '45', { custom: false }), 'minutes')}</div><div class="full">${field('Note', textarea('note', '', { rows: 2, placeholder: 'Objectif du rendez-vous, préparation à prévoir…' }))}</div><div class="full" data-avwarn></div></form>`,
      footer: '<button class="btn btn-ghost" data-close>Annuler</button><button class="btn btn-primary" data-ok>Créer le rendez-vous</button>',
      onMount: (box, m) => {
        const check = () => { const v = formValues($('[data-af]', box)); const d = atTime(parseYmd(v.date), v.time); $('[data-avwarn]', box).innerHTML = inAvailability(c.id, d) ? '' : notice('Ce créneau est en dehors de vos disponibilités (vous pouvez quand même le créer).', 'amber', 'alert'); };
        box.addEventListener('change', check); check();
        $('[data-ok]', box).addEventListener('click', () => {
          const v = formValues($('[data-af]', box)); const isPr = v.athlete.startsWith('prospect:');
          const appt = { id: uid('rdv'), coachId: c.id, athleteId: isPr ? null : v.athlete, guest: isPr ? byId(DB.prospects, v.athlete.split(':')[1]).name : '', type: v.type || 'Bilan mensuel', mode: v.mode, start: atTime(parseYmd(v.date), v.time).toISOString(), duration: Number(v.duration) || 45, note: v.note, status: 'scheduled' };
          DB.appointments.push(appt); DB.appointments.sort((a, b) => new Date(a.start) - new Date(b.start));
          if (isPr) { const p2 = byId(DB.prospects, v.athlete.split(':')[1]); p2.status = 'meeting'; }
          if (appt.athleteId) notify(appt.athleteId, `Rendez-vous « ${esc(appt.type)} » le ${fmt.dm(appt.start)} à ${fmt.time(appt.start)} (${appt.mode === 'visio' ? 'visio' : 'présentiel'})`, '/athlete/coach', 'calendar');
          const st = ui('coach-cal', { view: 'month', date: ymd(new Date()) }); st.date = v.date;
          m.close(); toast('Rendez-vous créé — email de confirmation envoyé'); if (location.hash.startsWith('#/coach/appointments')) rerender(); else go('/coach/appointments');
        });
      } });
  };
  Actions['appt-open'] = (el) => {
    const x = byId(DB.appointments, el.dataset.id); if (!x) return; const a = x.athleteId ? athleteById(x.athleteId) : null; const past = new Date(x.start) < new Date();
    openModal({ title: esc(x.type), sub: `${fmt.dateFull(x.start)} · ${fmt.time(x.start)} · ${x.duration} min`, size: 'sm',
      body: `<div class="col gap-12"><div class="row gap-12">${a ? avatar(a) : avatar({ name: x.guest || 'Invité' })}<div><div class="semibold">${esc(a ? fullName(a) : x.guest || 'Invité')}</div><div class="xs dim">${x.mode === 'visio' ? 'Visio dans l’application' : `Présentiel · ${esc(meCoach() ? meCoach().gym : '')}`}</div></div></div>${x.note ? `<div class="tile soft small">${esc(x.note)}</div>` : ''}${x.mode === 'visio' ? `<div class="row gap-8"><input class="input sm mono" readonly value="https://meet.elev8.app/${x.id}"><button class="btn btn-outline btn-sm" data-action="copy" data-text="https://meet.elev8.app/${x.id}" data-msg="Lien de visio copié">${icon('copy', 14)}</button></div>` : ''}${past ? pill('Passé', '') : pill('À venir', 'blue')}</div>`,
      footer: `${!past ? `<button class="btn btn-soft-red left" data-cancel>Annuler le RDV</button>` : ''}<button class="btn btn-ghost" data-close>Fermer</button>${x.mode === 'visio' ? `<button class="btn btn-primary" data-join>${icon('video', 15)} Rejoindre la visio</button>` : ''}`,
      onMount: (box, m) => {
        const j = $('[data-join]', box); if (j) j.addEventListener('click', () => { m.close(); VideoCall.open({ peer: a || { name: x.guest || 'Invité' }, title: x.type, sub: `${fmt.time(x.start)} · ${x.duration} min` }); });
        const cn = $('[data-cancel]', box); if (cn) cn.addEventListener('click', () => { x.status = 'cancelled'; if (a) notify(a.id, `Rendez-vous « ${esc(x.type)} » du ${fmt.dm(x.start)} annulé`, '/athlete/coach', 'calendar'); m.close(); toast('Rendez-vous annulé'); rerender(); });
      } });
  };

  /* ---------- Messagerie ---------- */
  route('/coach/messages/:id?', (p) => {
    const c = meCoach(); const threads = DB.threads.filter((t) => t.a === c.id || t.b === c.id);
    const html = `${pageHead('Messagerie', 'Une conversation écrite individuelle avec chacun de vos clients.', `<button class="btn btn-primary" data-action="chat-new">${icon('plus', 16)} Nouvelle conversation</button>`)}${ChatUI.view({ threads, activeId: p.id, meId: c.id, base: '/coach/messages', emptyHint: 'Choisissez un client à gauche ou démarrez une nouvelle conversation.' })}`;
    return { title: 'Messagerie', html, mount: ChatUI.mount };
  }, { role: 'coach' });
  Actions['chat-new'] = () => {
    const c = meCoach(); const clients = clientsOf(c.id, { pre: false });
    openModal({ title: 'Nouvelle conversation', size: 'sm', body: `<div class="col gap-6">${clients.map((a) => `<button type="button" class="ex-row" data-to="${a.id}">${avatar(a, 'sm')}<span class="semibold">${esc(fullName(a))}</span></button>`).join('')}</div>`,
      onMount: (box, m) => box.addEventListener('click', (e) => { const b = e.target.closest('[data-to]'); if (b) { const t = ChatUI.threadBetween(c.id, b.dataset.to); m.close(); go(`/coach/messages/${t.id}`); } }) });
  };

  /* ---------- Habitudes & check-ins (vue d'ensemble, 9.3) ---------- */
  const habitStats = (h) => { let best = 0; let run = 0; h.history.forEach((x) => { run = x.done ? run + 1 : 0; best = Math.max(best, run); }); let cur = 0; for (let i = h.history.length - 1; i >= 0; i--) { if (h.history[i].done) cur++; else if (i !== h.history.length - 1) break; } return { best, cur, rate: pct(h.history.filter((x) => x.done).length, h.history.length) }; };
  route('/coach/habits', () => {
    const c = meCoach(); const rows = clientsOf(c.id, { pre: false }).map((a) => { const hs = DB.habits[a.id] || []; const st = hs.map(habitStats); return { a, n: hs.length, avg: st.length ? avg(st, (x) => x.cur) : 0, best: st.length ? Math.max(...st.map((x) => x.best)) : 0, rate: st.length ? avg(st, (x) => x.rate) : 0, names: hs.map((h) => h.name) }; });
    const total = sum(rows, (r) => r.n);
    return { title: 'Habitudes', html: `${pageHead('Habitudes', 'Hydratation, sommeil, marche… le suivi de tous vos clients à la fois.')}
      <div class="grid g-3 mb-16">${kpi({ label: 'Habitudes suivies (tous clients)', value: total, ic: 'droplet', tone: 'blue' })}${kpi({ label: 'Série moyenne de jours réussis', value: `${fmt.num(avg(rows.filter((r) => r.n), (r) => r.avg), 1)} j`, ic: 'flame', tone: 'amber' })}${kpi({ label: 'Meilleure série jamais atteinte', value: `${Math.max(0, ...rows.map((r) => r.best))} j`, ic: 'trophy', tone: 'green' })}</div>
      <div class="card"><div class="table-wrap"><table class="table"><thead><tr><th>Client</th><th>Habitudes suivies</th><th class="num">Série moyenne</th><th class="num">Meilleure série</th><th>Réussite (28 j)</th></tr></thead><tbody>${rows.map((r) => `<tr class="click" data-go="/coach/clients/${r.a.id}/habitudes"><td><div class="person">${avatar(r.a, 'sm')}<div class="nm">${esc(fullName(r.a))}</div></div></td><td><div class="semibold">${r.n}</div><div class="xs dim truncate" style="max-width:240px">${esc(r.names.join(', ')) || '—'}</div></td><td class="num">${fmt.num(r.avg, 1)} j</td><td class="num semibold">${r.best} j</td><td style="min-width:150px"><div class="row gap-8"><div class="grow">${progress(r.rate, r.rate >= 70 ? 'var(--s3)' : 'var(--s4)')}</div><span class="small num">${fmt.num(r.rate)} %</span></div></td></tr>`).join('')}</tbody></table></div></div>` };
  }, { role: 'coach' });
  route('/coach/checkins', () => {
    const c = meCoach(); const st = ui('checkins', { f: 'all' });
    const rows = clientsOf(c.id, { pre: false }).filter((a) => a.status !== 'paused' || true).map((a) => ({ a, ci: checkinState(a.id) }));
    const n = (s) => rows.filter((r) => r.ci.status === s).length;
    const list = rows.filter((r) => st.f === 'all' || r.ci.status === st.f);
    const lab = { late: ['En retard', 'red'], completed: ['Complété', 'green'], pending: ['En attente', 'amber'] };
    return { title: 'Check-ins', html: `${pageHead('Check-ins', 'Les réponses hebdomadaires de vos clients : fatigue, sommeil, motivation, respect du programme.')}
      <div class="grid g-3 mb-16">${kpi({ label: 'En retard', value: n('late'), ic: 'alert', tone: 'red' })}${kpi({ label: 'Complétés cette semaine', value: n('completed'), ic: 'checkCircle', tone: 'green' })}${kpi({ label: 'En attente', value: n('pending'), ic: 'clock', tone: 'amber', sub: `À rendre avant le ${fmt.dateLong(addDays(startOfWeek(new Date()), 6))}` })}</div>
      <div class="row between wrap gap-8 mb-12">${seg([['all', 'Tous'], ['late', 'En retard'], ['pending', 'En attente'], ['completed', 'Complétés']], st.f, 'checkins', 'f', 'sm')}<button class="btn btn-outline btn-sm" data-action="info" data-msg="Rappel envoyé aux ${n('late') + n('pending')} clients concernés">${icon('bell', 14)} Relancer les retardataires</button></div>
      <div class="card"><div class="table-wrap"><table class="table"><thead><tr><th>Client</th><th>Dernier check-in</th><th>Fatigue</th><th>Sommeil</th><th>Motivation</th><th>Respect</th><th>Statut</th></tr></thead><tbody>${list.map(({ a, ci }) => { const l = ci.last; return `<tr class="click" data-go="/coach/clients/${a.id}/checkins"><td><div class="person">${avatar(a, 'sm')}<div class="nm">${esc(fullName(a))}</div></div></td><td class="small">${l ? fmt.dt(l.date) : '—'}</td><td>${l ? `${l.fatigue}/5` : '—'}</td><td>${l ? `${l.sleep}/5` : '—'}</td><td>${l ? `${l.motivation}/5` : '—'}</td><td>${l ? `${l.adherence} %` : '—'}</td><td>${pill(lab[ci.status][0], lab[ci.status][1])}${l && l.pain ? ` ${pill('Douleur', 'red', 'alert')}` : ''}</td></tr>`; }).join('')}</tbody></table></div></div>` };
  }, { role: 'coach' });
})();
