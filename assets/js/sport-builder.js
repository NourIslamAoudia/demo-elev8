'use strict';
/* =========================================================
   ELEV8 — Pôle Sport (2/3) : créateur de séance, éditeur de
   programme, affectation, séance ponctuelle, ajustement des charges
   ========================================================= */
var Sport = window.Sport || {};
(() => {
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const ctxOfPath = () => (location.hash.startsWith('#/admin') ? 'admin' : location.hash.startsWith('#/athlete') ? 'athlete' : 'coach');
  const ownerOf = (ctx) => (ctx === 'coach' ? S.userId : ctx === 'athlete' ? meAthlete().id : 'elev8');
  const newItem = (exId) => ({ key: uid('k'), exId, sets: 3, reps: '10', load: '', rest: 90, tempo: ['', '', '', ''], rir: '', rpe: '', note: '', labels: { ...DEFAULT_LABELS }, timer: { mode: 'none', duration: 30, sets: 3 }, link: false, _open: true });
  Sport.sessionsFor = (ctx) => {
    if (ctx === 'admin') return DB.sessions;
    if (ctx === 'coach') return DB.sessions.filter((s) => s.ownerId === S.userId);
    const a = meAthlete(); const ids = new Set();
    DB.assignments.filter((x) => x.athleteId === a.id && x.status !== 'ended').forEach((asg) => { const p = programById(asg.programId); if (p) p.weeks.flat().filter(Boolean).forEach((sid) => ids.add(sid)); });
    DB.oneOffs.filter((o) => o.athleteId === a.id).forEach((o) => ids.add(o.sessionId));
    DB.sessions.filter((s) => s.ownerId === a.id).forEach((s) => ids.add(s.id));
    return [...ids].map(sessionById).filter(Boolean);
  };

  /* ---------- Fiche séance (modale) ---------- */
  Sport.sessionDetailHTML = (s, pAdj = 0) => {
    const lab = Sport.labels(s.items); const groups = Sport.groups(s.items);
    const groupOf = (i) => groups.find(([a, b]) => i >= a && i <= b);
    return `<div class="grid l-2-1 gap-20"><div class="col gap-8">${s.items.map((it, i) => {
      const x = exById(it.exId); const g = groupOf(i); const inGroup = g[1] > g[0];
      const tags = [Sport.tempoStr(it.tempo) && `Tempo ${Sport.tempoStr(it.tempo)}`, it.rir !== '' && `RIR ${it.rir}`, it.rpe !== '' && `RPE ${it.rpe}`, it.timer && it.timer.mode === 'countdown' && `⏱ ${it.timer.duration} s`, it.timer && it.timer.mode === 'free' && '⏱ chrono libre'].filter(Boolean);
      return `${inGroup && i === g[0] ? `<div class="xs semibold t-accent">${Sport.groupName(g[1] - g[0] + 1)} — enchaîner sans repos</div>` : ''}<div class="row gap-12 tile" style="padding:10px"><span class="sb-num ${inGroup ? 'grp' : ''}">${lab[i]}</span>${Thumb.ex(x, { size: 'sm' })}<div class="grow"><div class="semibold">${esc(x ? x.name : '?')}</div><div class="xs dim">${esc(Sport.summary(it, pAdj))}</div>${tags.length ? `<div class="row wrap gap-4 mt-4">${tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div>` : ''}${it.note ? `<div class="xs mt-4 t-blue">${icon('message', 11)} ${esc(it.note)}</div>` : ''}</div><button class="icon-btn" data-action="ex-open" data-id="${it.exId}" data-ctx="${ctxOfPath()}" title="Voir l’exercice">${icon('eye', 16)}</button></div>`;
    }).join('')}</div><div class="col gap-12"><div class="tile soft"><div class="upper mb-8">Muscles travaillés</div>${BodyMap.svg(Sport.muscles(s))}</div><div class="tile soft small"><div class="row between"><span class="muted">Durée estimée</span><b>~${Sport.estDuration(s)} min</b></div><div class="row between mt-8"><span class="muted">Volume prévu</span><b>${fmt.tonnes(Sport.plannedVolume(s, pAdj))}</b></div><div class="row between mt-8"><span class="muted">Intensité</span><b>${esc(s.intensity)}</b></div></div></div></div>`;
  };
  Actions['session-open'] = (el) => {
    const s = sessionById(el.dataset.id); if (!s) return;
    const ctx = ctxOfPath(); const own = s.ownerId === ownerOf(ctx);
    let footer = '<button class="btn btn-ghost" data-close>Fermer</button>';
    if (ctx === 'coach') footer = `<button class="btn btn-soft-red left" data-action="session-delete" data-id="${s.id}">${icon('trash', 15)}</button><button class="btn btn-outline" data-action="session-dup" data-id="${s.id}">${icon('copy', 15)} Dupliquer</button><button class="btn btn-outline" data-action="oneoff-open" data-session="${s.id}">${icon('calendar', 15)} Assigner ponctuellement</button><a class="btn btn-primary" href="#/coach/sessions/${s.id}/edit" data-close>${icon('edit', 15)} Modifier</a>`;
    if (ctx === 'athlete') footer = `${own ? `<a class="btn btn-outline left" href="#/athlete/sessions/${s.id}/edit" data-close>${icon('edit', 15)} Modifier</a>` : ''}<button class="btn btn-ghost" data-close>Fermer</button><a class="btn btn-primary" href="#/athlete/live/${s.id}" data-close>${icon('play', 15)} Démarrer la séance</a>`;
    if (ctx === 'admin') footer = `<button class="btn btn-ghost" data-close>Fermer</button>${s.ownerId === 'elev8' ? `<a class="btn btn-primary" href="#/admin/sessions/${s.id}/edit" data-close>${icon('edit', 15)} Modifier</a>` : ''}`;
    const owner = s.ownerId === 'elev8' ? 'Séance ELEV8' : coachById(s.ownerId) ? `Par ${fullName(coachById(s.ownerId))}` : 'Séance personnelle';
    openModal({ title: esc(s.name), sub: `${owner} · ${esc(s.type)} · ${esc(s.objective)}`, size: 'lg', body: Sport.sessionDetailHTML(s), footer });
  };
  Actions['session-dup'] = (el) => { const s = sessionById(el.dataset.id); const c = clone(s); c.id = uid('s'); c.name = `${s.name} (copie)`; c.items.forEach((it) => { it.key = uid('k'); }); c.ownerId = ownerOf(ctxOfPath()); c.createdAt = new Date().toISOString(); DB.sessions.push(c); closeAllModals(); toast('Séance dupliquée'); go(`/${ctxOfPath()}/sessions/${c.id}/edit`); };
  Actions['session-delete'] = async (el) => {
    const s = sessionById(el.dataset.id);
    const used = DB.programs.some((p) => p.weeks.flat().includes(s.id));
    if (used) { toast('Séance utilisée dans un programme : retirez-la d’abord du calendrier', 'error'); return; }
    if (!(await confirmDialog({ title: 'Supprimer la séance ?', message: `« ${esc(s.name)} » sera supprimée.`, confirm: 'Supprimer', danger: true }))) return;
    DB.sessions.splice(DB.sessions.indexOf(s), 1); closeAllModals(); toast('Séance supprimée'); rerender();
  };

  /* ---------- Créateur de séance ---------- */
  Sport.builder = (ctx, id, query = {}) => {
    const dkey = `sb:${ctx}:${id || 'new'}`;
    if (!UI[dkey] || query.fresh) {
      const src = id ? sessionById(id) : null;
      UI[dkey] = src ? { ...clone(src), items: clone(src.items).map((it) => ({ ...it, _open: false })) } : { id: null, name: '', type: 'Upper', objective: 'Hypertrophie', intensity: 'Modérée', items: [] };
      UI[`${dkey}:lib`] = { q: '', cat: '', muscle: '' };
    }
    const d = UI[dkey]; const lib = UI[`${dkey}:lib`];
    const base = ctx === 'coach' ? '/coach/sessions' : ctx === 'athlete' ? '/athlete/sessions' : '/admin/sessions';
    const back = query.return || base;
    const libList = () => {
      const q = lib.q.trim().toLowerCase();
      const all = Sport.exercisesFor(ctx).filter((x) => (!q || x.name.toLowerCase().includes(q) || x.muscles.some((m) => m.toLowerCase().includes(q))) && (!lib.cat || x.pattern === lib.cat) && (!lib.muscle || x.muscles.includes(lib.muscle)));
      const sel = new Set(d.items.map((it) => it.exId));
      return all.slice(0, 120).map((x) => `<button type="button" class="ex-card ${sel.has(x.id) ? 'selected' : ''}" data-sb-add="${x.id}"><span class="sel-check">${icon('check', 15)}</span>${Thumb.ex(x, { badges: false })}<div class="col gap-4"><span class="nm">${esc(x.name)}</span><span class="meta">${esc(x.pattern)}</span><span class="meta truncate">${esc(x.muscles.slice(0, 2).join(', '))}</span></div></button>`).join('') || `<div class="small dim" style="padding:20px">Aucun exercice</div>`;
    };
    const tags = (it) => [Sport.tempoStr(it.tempo) && `Tempo ${Sport.tempoStr(it.tempo)}`, it.rir !== '' && `RIR ${it.rir}`, it.rpe !== '' && `RPE ${it.rpe}`, it.timer.mode === 'countdown' ? `⏱ ${it.timer.duration} s` : it.timer.mode === 'free' ? '⏱ libre' : ''].filter(Boolean).map((t) => `<span class="tag" style="height:18px;font-size:10.5px">${esc(t)}</span>`).join(' ');
    const itemsHTML = () => {
      if (!d.items.length) return `<div class="tile soft center" style="padding:36px 16px">${icon('layers', 26)}<div class="semibold mt-8">Aucun exercice pour l’instant</div><div class="small muted mt-4">Cliquez sur un exercice de la bibliothèque pour l’ajouter.</div></div>`;
      const lab = Sport.labels(d.items); const groups = Sport.groups(d.items);
      return d.items.map((it, i) => {
        const x = exById(it.exId); const g = groups.find(([a, b]) => i >= a && i <= b); const inG = g[1] > g[0]; const L = it.labels;
        const metric = (f) => field(`<span data-lbl="${f}">${esc(L[f])}</span>`, Sport.unit(it, f) ? inputUnit(`m_${f}`, it[f], Sport.unit(it, f), { type: f === 'load' && L.load !== 'Charge' ? 'text' : f === 'reps' ? 'text' : 'number', attrs: `data-sb-field="${f}" data-key="${it.key}" step="any"` }) : input(`m_${f}`, it[f], { type: f === 'sets' || f === 'rest' ? 'number' : 'text', attrs: `data-sb-field="${f}" data-key="${it.key}" min="0"` }));
        const body = `<div class="sb-item-b"><div class="row between mt-12 mb-8"><span class="upper">Mesures</span><button type="button" class="btn btn-ghost btn-xs" data-sb-labels="${it.key}">${icon('edit', 12)} Custom labels</button></div>
          ${it._labels ? `<div class="metric-grid mb-12">${['reps', 'sets', 'load', 'rest'].map((f) => field(`Nom du champ « ${DEFAULT_LABELS[f]} »`, input(`l_${f}`, L[f], { attrs: `data-sb-label="${f}" data-key="${it.key}"`, cls: 'sm' }))).join('')}</div><p class="xs dim mb-12">Ex. : Reps → « Durée (s) » pour un gainage, Charge → « Distance » ou « Allure » pour du cardio. L’athlète verra ces noms.</p>` : ''}
          <div class="metric-grid">${metric('reps')}${metric('sets')}${metric('load')}${metric('rest')}</div>
          <div class="upper mt-16 mb-8">Tempo (secondes)</div><div class="tempo">${['Excentrique (descente)', 'Pause basse', 'Concentrique (montée)', 'Pause haute'].map((l, k) => field(l, input(`t${k}`, it.tempo[k], { type: 'number', attrs: `data-sb-tempo="${k}" data-key="${it.key}" min="0" placeholder="${[3, 0, 1, 0][k]}"`, cls: 'center' }))).join('')}</div>
          <div class="grid g-2 mt-16">${field('Cible RIR <span class="dim normal">(répétitions en réserve)</span>', select('rir', [['', '—'], ...[0, 1, 2, 3, 4, 5].map((n) => [n, `${n}${n === 5 ? '+' : ''} répétition${n > 1 ? 's' : ''} en réserve`])], it.rir, `data-sb-field="rir" data-key="${it.key}"`))}${field('Cible RPE <span class="dim normal">(effort perçu 1-10)</span>', select('rpe', [['', '—'], ...RPE_SCALE.map(([n, l, r]) => [n, `${n} · ${l} — ${r}`])], it.rpe, `data-sb-field="rpe" data-key="${it.key}"`))}</div>
          <div class="mt-12">${field('Remarque', textarea('note', it.note, { rows: 2, placeholder: 'Consigne technique, alternative si pas de matériel…', attrs: `data-sb-field="note" data-key="${it.key}"` }))}</div>
          <div class="upper mt-16 mb-8">Chrono</div><div class="row wrap gap-12"><div class="seg sm">${[['none', 'Aucun'], ['countdown', 'Compte à rebours'], ['free', 'Chrono libre']].map(([m, l]) => `<button type="button" class="${it.timer.mode === m ? 'active' : ''}" data-sb-timer="${m}" data-key="${it.key}">${l}</button>`).join('')}</div>${it.timer.mode === 'countdown' ? `<div class="row gap-8">${inputUnit('tdur', it.timer.duration, 's', { attrs: `data-sb-tfield="duration" data-key="${it.key}" min="5" style="width:110px"` })}<span class="small muted">sur</span>${inputUnit('tsets', it.timer.sets, 'séries', { attrs: `data-sb-tfield="sets" data-key="${it.key}" min="1" style="width:120px"` })}</div>` : it.timer.mode === 'free' ? '<span class="small muted">L’athlète mesure le temps réellement passé sur l’exercice.</span>' : ''}</div>
          <div class="row wrap gap-8 mt-16">${i < d.items.length - 1 ? `<button type="button" class="btn ${it.link ? 'btn-soft' : 'btn-outline'} btn-sm" data-sb-link="${it.key}">${icon('repeat', 14)} ${it.link ? 'Retirer l’enchaînement' : '+ Bi-set avec l’exercice suivant'}</button>` : '<span class="xs dim">Dernier exercice : pas d’enchaînement possible.</span>'}<button type="button" class="btn btn-ghost btn-sm" data-action="ex-open" data-id="${it.exId}" data-ctx="${ctx}">${icon('eye', 14)} Voir l’exercice</button></div></div>`;
        return `<div class="sb-item ${it._open ? 'open' : ''}" data-item="${it.key}"><div class="sb-item-h" data-sb-toggle="${it.key}"><span class="sb-grip" draggable="true" data-grip="${it.key}" title="Glisser pour réordonner">${icon('grip', 16)}</span><span class="sb-num ${inG ? 'grp' : ''}">${lab[i]}</span>${Thumb.ex(x, { size: 'sm' })}<div class="grow" style="min-width:0"><div class="semibold truncate">${esc(x ? x.name : '?')}</div><div class="sb-sum" data-sum="${it.key}">${esc(Sport.summary(it))} ${tags(it)}</div></div><button type="button" class="icon-btn hide-sm" data-sb-move="-1" data-key="${it.key}" title="Monter">${icon('arrowUp', 15)}</button><button type="button" class="icon-btn hide-sm" data-sb-move="1" data-key="${it.key}" title="Descendre">${icon('arrowDown', 15)}</button><button type="button" class="icon-btn danger" data-sb-del="${it.key}" title="Supprimer">${icon('trash', 15)}</button><span class="dim">${icon(it._open ? 'chevU' : 'chevD', 16)}</span></div>${body}</div>${inG && i < g[1] ? `<div class="sb-link-row">${Sport.groupName(g[1] - g[0] + 1)} — sans repos</div>` : ''}`;
      }).join('');
    };
    const barHTML = () => `<span class="small"><b>${d.items.length}</b> exercice${d.items.length > 1 ? 's' : ''} · ~${d.items.length ? Sport.estDuration(d) : 0} min</span><div class="row"><a class="btn btn-ghost" href="#${back}">Annuler</a><button type="button" class="btn btn-primary" data-sb-save>${icon('check', 16)} ${id ? 'Enregistrer la séance' : `Créer la séance (${d.items.length} exercice${d.items.length > 1 ? 's' : ''})`}</button></div>`;
    const html = `<a class="back-link" href="#${back}">${icon('arrowL', 16)} Retour</a>${pageHead(id ? 'Modifier la séance' : 'Créer une séance', 'Trois temps sur un seul écran : définir, ajouter les exercices, régler chaque exercice.')}
      ${card(`<span class="sb-step">1</span> Définir la séance`, `<div class="col gap-16">${field('Nom de la séance', input('sname', d.name, { placeholder: 'Ex. : Upper Body A', attrs: 'data-sb-name' }))}<div class="grid g-3">${field('Type de séance', chips('type', SESSION_TYPES, d.type))}${field('Objectif', chips('objective', SESSION_GOALS, d.objective))}${field('Intensité', chips('intensity', INTENSITIES, d.intensity))}</div></div>`)}
      <div class="sb mt-20"><section class="card sb-lib"><div class="card-h"><h3><span class="sb-step">2</span> Ajouter les exercices</h3><span class="sub">Cliquez pour ajouter · coche = sélectionné</span></div><div class="card-b"><div class="row wrap gap-8 mb-12">${searchBox('lq', lib.q, 'Nom ou muscle…', 'data-lib="q"')}${select('lm', [['', 'Tous les muscles'], ...MUSCLES], lib.muscle, 'data-lib="muscle"', 'sm')}</div><div class="chips sm scroll mb-12">${[['', 'Toutes'], ...LIB_CATEGORIES.map((c) => [c, c === 'Mobilité' ? 'Mobility' : c])].map(([v, l]) => `<button type="button" class="chip ${lib.cat === v ? 'active' : ''}" data-lib-cat="${v}">${l}</button>`).join('')}</div><div class="sb-lib-list" data-sb-lib>${libList()}</div></div></section>
      <section class="card"><div class="card-h"><h3><span class="sb-step">3</span> Exercices de la séance</h3><span class="sub">Dépliez une carte pour la régler</span></div><div class="card-b"><div class="sb-items" data-sb-items>${itemsHTML()}</div></div></section></div>
      <div class="sticky-bar" data-sb-bar>${barHTML()}</div>`;
    const mount = (el) => {
      const refreshItems = () => { $('[data-sb-items]', el).innerHTML = itemsHTML(); $('[data-sb-bar]', el).innerHTML = barHTML(); };
      const refreshLib = () => { $('[data-sb-lib]', el).innerHTML = libList(); };
      const find = (k) => d.items.find((x) => x.key === k);
      const updSum = (it) => { const s = $(`[data-sum="${it.key}"]`, el); if (s) s.innerHTML = `${esc(Sport.summary(it))} ${tags(it)}`; };
      el.addEventListener('input', (e) => {
        const t = e.target;
        if (t.matches('[data-sb-name]')) d.name = t.value;
        else if (t.dataset.lib) { lib[t.dataset.lib] = t.value; refreshLib(); }
        else if (t.dataset.sbField) { const it = find(t.dataset.key); it[t.dataset.sbField] = t.dataset.sbField === 'sets' || t.dataset.sbField === 'rest' ? (t.value === '' ? '' : Number(t.value)) : t.value; updSum(it); $('[data-sb-bar]', el).innerHTML = barHTML(); }
        else if (t.dataset.sbTempo != null) { const it = find(t.dataset.key); it.tempo[Number(t.dataset.sbTempo)] = t.value === '' ? '' : Number(t.value); updSum(it); }
        else if (t.dataset.sbLabel) { const it = find(t.dataset.key); it.labels[t.dataset.sbLabel] = t.value || DEFAULT_LABELS[t.dataset.sbLabel]; const lb = $(`[data-item="${it.key}"] [data-lbl="${t.dataset.sbLabel}"]`, el); if (lb) lb.textContent = it.labels[t.dataset.sbLabel]; updSum(it); }
        else if (t.dataset.sbTfield) { const it = find(t.dataset.key); it.timer[t.dataset.sbTfield] = Number(t.value) || 0; updSum(it); }
      });
      el.addEventListener('change', (e) => {
        const t = e.target;
        if (t.type === 'hidden' && ['type', 'objective', 'intensity'].includes(t.name)) d[t.name] = t.value;
        if (t.tagName === 'SELECT' && t.dataset.sbField) { const it = find(t.dataset.key); it[t.dataset.sbField] = t.value === '' ? '' : Number(t.value); updSum(it); }
        if (t.tagName === 'SELECT' && t.dataset.lib) { lib[t.dataset.lib] = t.value; refreshLib(); }
        if (t.dataset.sbLabel) refreshItems();
      });
      el.addEventListener('click', (e) => {
        const t = e.target.closest('[data-sb-add],[data-lib-cat],[data-sb-toggle],[data-sb-del],[data-sb-move],[data-sb-link],[data-sb-labels],[data-sb-timer],[data-sb-save]');
        if (!t || e.target.closest('[data-action]')) return;
        if (t.dataset.sbAdd) {
          const ex = t.dataset.sbAdd; const idx = d.items.findIndex((x) => x.exId === ex);
          if (idx >= 0) d.items.splice(idx, 1); else { d.items.forEach((x) => { x._open = false; }); d.items.push(newItem(ex)); }
          refreshLib(); refreshItems(); return;
        }
        if (t.dataset.libCat != null) { lib.cat = t.dataset.libCat; $$('[data-lib-cat]', el).forEach((b) => b.classList.toggle('active', b === t)); refreshLib(); return; }
        if (t.dataset.sbDel) { d.items = d.items.filter((x) => x.key !== t.dataset.sbDel); refreshItems(); refreshLib(); return; }
        if (t.dataset.sbMove) { const i = d.items.findIndex((x) => x.key === t.dataset.key); const j = i + Number(t.dataset.sbMove); if (j >= 0 && j < d.items.length) { const [m] = d.items.splice(i, 1); d.items.splice(j, 0, m); refreshItems(); } return; }
        if (t.dataset.sbLink) { const it = find(t.dataset.sbLink); it.link = !it.link; refreshItems(); return; }
        if (t.dataset.sbLabels) { const it = find(t.dataset.sbLabels); it._labels = !it._labels; refreshItems(); return; }
        if (t.dataset.sbTimer) { const it = find(t.dataset.key); it.timer.mode = t.dataset.sbTimer; if (it.timer.mode === 'countdown' && !it.timer.sets) it.timer.sets = it.sets; refreshItems(); return; }
        if (t.dataset.sbSave != null) { save(); return; }
        if (t.dataset.sbToggle && !e.target.closest('button,input,select,textarea,[data-grip]')) { const it = find(t.dataset.sbToggle); it._open = !it._open; refreshItems(); }
      });
      let dragKey = null;
      el.addEventListener('dragstart', (e) => { const g = e.target.closest && e.target.closest('[data-grip]'); if (!g) return; dragKey = g.dataset.grip; const item = g.closest('.sb-item'); item.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', dragKey); e.dataTransfer.setDragImage(item, 20, 20); } catch (err) { /* ignore */ } });
      el.addEventListener('dragover', (e) => { if (!dragKey) return; const it = e.target.closest('.sb-item'); if (!it) return; e.preventDefault(); $$('.sb-item', el).forEach((x) => x.classList.remove('drop-before')); it.classList.add('drop-before'); });
      el.addEventListener('drop', (e) => { if (!dragKey) return; const it = e.target.closest('.sb-item'); e.preventDefault(); if (it) { const from = d.items.findIndex((x) => x.key === dragKey); const [m] = d.items.splice(from, 1); let to = d.items.findIndex((x) => x.key === it.dataset.item); if (to < 0) to = d.items.length; d.items.splice(to, 0, m); } dragKey = null; refreshItems(); });
      el.addEventListener('dragend', () => { dragKey = null; $$('.sb-item', el).forEach((x) => x.classList.remove('dragging', 'drop-before')); });
      const save = () => {
        if (!d.name.trim()) { toast('Donnez un nom à la séance', 'error'); $('[data-sb-name]', el).focus(); return; }
        if (!d.items.length) { toast('Ajoutez au moins un exercice', 'error'); return; }
        const items = d.items.map((it) => { const c = { ...it }; delete c._open; delete c._labels; c.sets = Number(c.sets) || 1; c.rest = Number(c.rest) || 0; c.load = c.load === '' || !isNum(c.load) ? c.load : Number(c.load); return c; });
        let s;
        if (id) { s = sessionById(id); Object.assign(s, { name: d.name.trim(), type: d.type, objective: d.objective, intensity: d.intensity, items }); toast('Séance enregistrée'); }
        else { s = { id: uid('s'), name: d.name.trim(), type: d.type, objective: d.objective, intensity: d.intensity, ownerId: ownerOf(ctx), items, createdAt: new Date().toISOString() }; DB.sessions.push(s); toast(`Séance « ${esc(s.name)} » créée`); }
        delete UI[dkey];
        go(query.return || base);
      };
    };
    return { html, title: id ? 'Modifier la séance' : 'Créer une séance', mount };
  };

  /* ---------- Éditeur de programme (calendrier semaine par semaine) ---------- */
  const sessColor = (sid) => SERIES[hashStr(sid) % SERIES.length];
  Sport.programEditor = (ctx, id) => {
    const dkey = `pe:${ctx}:${id || 'new'}`;
    if (!UI[dkey]) {
      const p = id ? programById(id) : null;
      UI[dkey] = p ? clone(p) : { id: null, name: '', objective: 'Hypertrophie', level: 'Intermédiaire', desc: '', status: 'draft', weeks: Array.from({ length: 8 }, () => [null, null, null, null, null, null, null]) };
    }
    const d = UI[dkey];
    const base = ctx === 'coach' ? '/coach/programs' : '/admin/programs';
    const total = d.weeks.flat().filter(Boolean).length;
    const totalMin = sum(d.weeks.flat().filter(Boolean), (sid) => { const s = sessionById(sid); return s ? Sport.estDuration(s) : 0; });
    const grid = `<div class="pgrid-wrap"><div class="pgrid"><div class="ph"></div>${DOW_LONG.map((x) => `<div class="ph">${x}</div>`).join('')}${d.weeks.map((row, w) => `<div class="pw">S${w + 1}</div>${row.map((sid, k) => { const s = sid && sessionById(sid); return `<div>${s ? `<button type="button" class="pcell filled" style="--evc:${sessColor(sid)}" data-pe-cell="${w}:${k}"><b>${esc(s.name)}</b><span>${esc(s.type)} · ~${Sport.estDuration(s)} min</span></button>` : `<button type="button" class="pcell" data-pe-cell="${w}:${k}" aria-label="Ajouter une séance">${icon('plus', 16)}</button>`}</div>`; }).join('')}`).join('')}</div></div>`;
    const html = `<a class="back-link" href="#${base}">${icon('arrowL', 16)} Programmes</a>${pageHead(id ? esc(d.name || 'Programme') : 'Nouveau programme', 'Assemblez vos séances sur plusieurs semaines : chaque case = un jour.')}
      <div class="grid l-2-1"><div class="col gap-16">${card('Informations', `<div class="col gap-16">${field('Nom du programme', input('pname', d.name, { placeholder: 'Ex. : Recomposition — 8 semaines', attrs: 'data-pe="name"' }))}${field('Objectif', chips('objective', PROGRAM_GOALS, d.objective))}${field('Niveau', chips('level', LEVELS, d.level, { custom: false }))}${field('Description', textarea('pdesc', d.desc, { rows: 2, attrs: 'data-pe="desc"' }))}</div>`)}</div>
      <div class="col gap-16">${card('Résumé', `<div class="col gap-12"><div class="row between"><span class="muted">Durée</span><div class="row gap-6"><button type="button" class="icon-btn" data-pe-weeks="-1">${icon('minus', 15)}</button><b>${d.weeks.length} semaines</b><button type="button" class="icon-btn" data-pe-weeks="1">${icon('plus', 15)}</button></div></div><div class="row between"><span class="muted">Séances au total</span><b>${total}</b></div><div class="row between"><span class="muted">Moyenne / semaine</span><b>${fmt.num(total / d.weeks.length, 1)}</b></div><div class="row between"><span class="muted">Volume horaire</span><b>${fmt.dur(totalMin * 60)}</b></div><div class="row between"><span class="muted">Statut</span>${seg([['draft', 'Brouillon'], ['published', 'Publié']], d.status, dkey, 'status', 'sm')}</div></div>`)}</div></div>
      <div class="section-title"><h2>Calendrier</h2><div class="row wrap"><button type="button" class="btn btn-outline btn-sm" data-pe-copy>${icon('copy', 15)} Copier la semaine 1 partout</button><button type="button" class="btn btn-ghost btn-sm" data-pe-clear>${icon('trash', 15)} Vider</button></div></div>${grid}
      <div class="sticky-bar"><span class="small muted">${total} séances planifiées sur ${d.weeks.length} semaines</span><div class="row wrap"><a class="btn btn-ghost" href="#${base}">Annuler</a>${ctx === 'coach' && id ? `<button type="button" class="btn btn-outline" data-action="assign-open" data-id="${id}">${icon('userPlus', 16)} Assigner</button>` : ''}<button type="button" class="btn btn-primary" data-pe-save>${icon('check', 16)} Enregistrer</button></div></div>`;
    const mount = (el) => {
      el.addEventListener('input', (e) => { const f = e.target.dataset.pe; if (f) d[f] = e.target.value; });
      el.addEventListener('change', (e) => { if (e.target.type === 'hidden' && ['objective', 'level'].includes(e.target.name)) d[e.target.name] = e.target.value; });
      el.addEventListener('click', (e) => {
        const t = e.target.closest('[data-pe-cell],[data-pe-weeks],[data-pe-copy],[data-pe-clear],[data-pe-save]'); if (!t) return;
        if (t.dataset.peCell) { const [w, k] = t.dataset.peCell.split(':').map(Number); Sport.pickSession(ctx, d.weeks[w][k], (sid) => { d.weeks[w][k] = sid; rerender(); }); return; }
        if (t.dataset.peWeeks) { const n = clamp(d.weeks.length + Number(t.dataset.peWeeks), 1, 24); while (d.weeks.length < n) d.weeks.push([null, null, null, null, null, null, null]); d.weeks.length = n; rerender(); return; }
        if (t.dataset.peCopy != null) { d.weeks = d.weeks.map(() => d.weeks[0].slice()); toast('Semaine 1 copiée sur toutes les semaines'); rerender(); return; }
        if (t.dataset.peClear != null) { d.weeks = d.weeks.map(() => [null, null, null, null, null, null, null]); rerender(); return; }
        if (t.dataset.peSave != null) {
          if (!d.name.trim()) { toast('Donnez un nom au programme', 'error'); return; }
          if (!d.weeks.flat().some(Boolean)) { toast('Ajoutez au moins une séance au calendrier', 'error'); return; }
          if (id) { Object.assign(programById(id), clone(d)); toast('Programme enregistré'); }
          else { const p = { ...clone(d), id: uid('p'), ownerId: ctx === 'coach' ? S.userId : 'elev8', createdAt: new Date().toISOString() }; DB.programs.push(p); toast('Programme créé'); if (ctx === 'admin') audit('Programme ELEV8 ajouté', p.name); }
          delete UI[dkey]; go(base);
        }
      });
    };
    return { html, title: id ? 'Programme' : 'Nouveau programme', mount };
  };
  Sport.pickSession = (ctx, current, onPick) => {
    const list = ctx === 'admin' ? DB.sessions.filter((s) => s.ownerId === 'elev8') : DB.sessions.filter((s) => s.ownerId === S.userId);
    const st = { q: '' };
    const rows = () => list.filter((s) => !st.q || s.name.toLowerCase().includes(st.q.toLowerCase())).map((s) => `<button type="button" class="ex-row ${s.id === current ? 'selected' : ''}" data-pick="${s.id}">${Thumb.ex(exById(s.items[0] && s.items[0].exId), { size: 'sm' })}<div class="grow"><div class="semibold">${esc(s.name)}</div><div class="xs dim">${esc(s.type)} · ${s.items.length} exercices · ~${Sport.estDuration(s)} min</div></div>${s.id === current ? icon('check', 16) : ''}</button>`).join('') || '<div class="small dim">Aucune séance</div>';
    openModal({
      title: 'Choisir une séance', size: 'md',
      body: `${searchBox('pq', '', 'Rechercher une séance…', 'data-pq')}<div class="col gap-8 mt-12" data-rows>${rows()}</div>`,
      footer: `${current ? '<button class="btn btn-soft-red left" data-clear>Retirer de ce jour</button>' : ''}<a class="btn btn-outline" href="#/${ctx}/sessions/new?return=${encodeURIComponent(location.hash.slice(1))}" data-close>${icon('plus', 15)} Nouvelle séance</a><button class="btn btn-ghost" data-close>Fermer</button>`,
      onMount: (box, m) => {
        $('[data-pq]', box).addEventListener('input', (e) => { st.q = e.target.value; $('[data-rows]', box).innerHTML = rows(); });
        box.addEventListener('click', (e) => { const p = e.target.closest('[data-pick]'); if (p) { m.close(); onPick(p.dataset.pick); } const c = e.target.closest('[data-clear]'); if (c) { m.close(); onPick(null); } });
      },
    });
  };

  /* ---------- Affectation d'un programme ---------- */
  Sport.nextMonday = () => { const d = startOfWeek(new Date()); return addDays(d, 7); };
  Actions['assign-open'] = (el) => Sport.assignModal(el.dataset.id, el.dataset.athlete);
  Sport.assignModal = (programId, preAthlete) => {
    const p = programById(programId); const c = meCoach();
    const clients = DB.athletes.filter((a) => a.coachId === c.id && a.status !== 'pre');
    const cur = (a) => DB.assignments.find((x) => x.athleteId === a.id && x.status === 'active');
    openModal({
      title: 'Assigner le programme', sub: esc(p.name), size: 'md',
      body: `<div class="grid g-2">${field('Début (lundi)', input('start', ymd(Sport.nextMonday()), { type: 'date', attrs: 'data-start' }))}${field('Fin', `<div class="input" style="display:flex;align-items:center" data-end>${fmt.date(addDays(Sport.nextMonday(), p.weeks.length * 7 - 1))}</div>`)}</div>
        <div class="row between mt-16 mb-8"><span class="label">Athlètes (${clients.length})</span><button type="button" class="btn btn-ghost btn-xs" data-all>Tout sélectionner</button></div>
        <div class="col gap-6" style="max-height:320px;overflow:auto">${clients.map((a) => { const x = cur(a); return `<label class="radio-card" style="padding:10px 12px"><input type="checkbox" name="ath" value="${a.id}" ${a.id === preAthlete ? 'checked' : ''}>${avatar(a, 'sm')}<div class="grow"><div class="semibold">${esc(fullName(a))}</div><div class="xs dim">${x ? `Programme en cours : ${esc(programById(x.programId).name)} — sera remplacé` : 'Aucun programme en cours'}</div></div></label>`; }).join('') || '<div class="small dim">Aucun client</div>'}</div>`,
      footer: '<button class="btn btn-ghost" data-close>Annuler</button><button class="btn btn-primary" data-ok>Envoyer le programme</button>',
      onMount: (box, m) => {
        const upd = () => { const s = startOfWeek(parseYmd($('[data-start]', box).value)); $('[data-end]', box).textContent = `${fmt.date(s)} → ${fmt.date(addDays(s, p.weeks.length * 7 - 1))}`; };
        $('[data-start]', box).addEventListener('change', upd); upd();
        $('[data-all]', box).addEventListener('click', () => $$('input[name=ath]', box).forEach((i) => { i.checked = true; }));
        $('[data-ok]', box).addEventListener('click', () => {
          const ids = $$('input[name=ath]:checked', box).map((i) => i.value);
          if (!ids.length) { toast('Sélectionnez au moins un athlète', 'error'); return; }
          const start = startOfWeek(parseYmd($('[data-start]', box).value));
          ids.forEach((aid) => {
            DB.assignments.filter((x) => x.athleteId === aid && x.status === 'active').forEach((x) => { x.status = 'ended'; });
            DB.assignments.push({ id: uid('as'), programId: p.id, athleteId: aid, start: start.toISOString(), status: 'active', loadPct: 0, loadHistory: [], source: 'coach', assignedAt: new Date().toISOString() });
            notify(aid, `<b>${esc(firstName(c))}</b> vous a envoyé le programme <b>${esc(p.name)}</b>`, '/athlete/program', 'layers');
          });
          if (p.status !== 'published') p.status = 'published';
          logActivity('program', `Programme « ${p.name} » assigné à ${ids.length} athlète${ids.length > 1 ? 's' : ''}`, 'layers');
          m.close(); closeAllModals(); toast(`Programme envoyé à ${ids.length} athlète${ids.length > 1 ? 's' : ''}`); rerender();
        });
      },
    });
  };

  /* ---------- Séance ponctuelle ---------- */
  Actions['oneoff-open'] = (el) => Sport.oneOffModal(el.dataset.session, el.dataset.athlete);
  Sport.oneOffModal = (sessionId, athleteId) => {
    const c = meCoach(); const clients = DB.athletes.filter((a) => a.coachId === c.id && a.status === 'active');
    const sessions = DB.sessions.filter((s) => s.ownerId === c.id);
    openModal({
      title: 'Assigner une séance ponctuelle', sub: 'En dehors de tout programme, pour un besoin ciblé', size: 'sm',
      body: `<div class="col gap-12">${field('Séance', select('session', sessions.map((s) => [s.id, s.name]), sessionId || (sessions[0] && sessions[0].id)))}${field('Athlète', select('athlete', clients.map((a) => [a.id, fullName(a)]), athleteId || (clients[0] && clients[0].id)))}${field('Date', input('date', ymd(addDays(new Date(), 1)), { type: 'date' }))}${field('Message pour l’athlète', textarea('note', '', { rows: 2, placeholder: 'Optionnel' }))}</div>`,
      footer: '<button class="btn btn-ghost" data-close>Annuler</button><button class="btn btn-primary" data-ok>Assigner</button>',
      onMount: (box, m) => $('[data-ok]', box).addEventListener('click', () => {
        const v = { session: $('[name=session]', box).value, athlete: $('[name=athlete]', box).value, date: $('[name=date]', box).value, note: $('[name=note]', box).value };
        DB.oneOffs.push({ id: uid('oo'), sessionId: v.session, athleteId: v.athlete, date: v.date, coachId: c.id, note: v.note });
        notify(v.athlete, `Nouvelle séance ponctuelle : <b>${esc(sessionById(v.session).name)}</b> le ${fmt.dm(parseYmd(v.date))}`, '/athlete/sessions', 'dumbbell');
        m.close(); closeAllModals(); toast(`Séance assignée à ${esc(fullName(athleteById(v.athlete)))}`); rerender();
      }),
    });
  };

  /* ---------- Ajustement global des charges ---------- */
  Actions['load-open'] = (el) => Sport.loadModal(el.dataset.id);
  Sport.loadModal = (asgId) => {
    const asg = byId(DB.assignments, asgId); const p = programById(asg.programId); const a = athleteById(asg.athleteId);
    const sample = unique(p.weeks.flat().filter(Boolean)).map(sessionById).flatMap((s) => s.items).filter((it) => isNum(it.load) && Number(it.load) > 0).slice(0, 6);
    const rows = (delta) => sample.map((it) => `<tr><td>${esc(exById(it.exId).name)}</td><td class="num">${fmt.num(Sport.adj(it.load, 0), 1)} kg</td><td class="num">${fmt.num(Sport.adj(it.load, asg.loadPct), 1)} kg</td><td class="num semibold">${fmt.num(Sport.adj(it.load, asg.loadPct + delta), 1)} kg</td></tr>`).join('');
    const hist = () => (asg.loadHistory.length ? asg.loadHistory.slice().reverse().map((h) => `<div class="li"><span class="li-ic ${h.reset ? 'red' : h.pct >= 0 ? 'green' : 'amber'}">${icon(h.reset ? 'reset' : h.pct >= 0 ? 'trendUp' : 'trendDown', 16)}</span><div class="grow"><div class="li-t">${h.reset ? 'Remise à zéro' : `${h.pct > 0 ? '+' : ''}${fmt.num(h.pct, 1)} %`}</div><div class="li-s">${fmt.dt(h.date)} · ${esc(h.by)}${h.note ? ` · ${esc(h.note)}` : ''}</div></div></div>`).join('') : '<div class="small dim">Aucun ajustement pour l’instant.</div>');
    openModal({
      title: 'Ajuster les charges du programme', sub: `${esc(fullName(a))} · ${esc(p.name)}`, size: 'lg',
      body: `<div class="grid l-3-2 gap-20"><div><div class="tile soft row between mb-16"><span class="muted">Ajustement cumulé actuel</span><b class="xl">${asg.loadPct > 0 ? '+' : ''}${fmt.num(asg.loadPct, 1)} %</b></div>
        <div class="label mb-8">Augmenter ou réduire toutes les charges</div><div class="row wrap gap-8">${[-5, -2.5, 1.5, 2.5, 5].map((v) => `<button type="button" class="chip" data-q="${v}">${v > 0 ? '+' : ''}${fmt.num(v, 1)} %</button>`).join('')}${inputUnit('pct', 1.5, '%', { attrs: 'data-pct step="0.5" style="width:120px"' })}</div>
        <div class="mt-12">${field('Note (optionnelle)', input('note', '', { placeholder: 'Ex. : bonne progression semaine 3', attrs: 'data-note' }))}</div>
        <div class="table-wrap mt-16"><table class="table compact"><thead><tr><th>Exercice</th><th class="num">Base</th><th class="num">Actuel</th><th class="num">Nouveau</th></tr></thead><tbody data-prev>${rows(1.5)}</tbody></table></div></div>
        <div><div class="label mb-8">Historique des ajustements</div><div class="list">${hist()}</div></div></div>`,
      footer: `<button class="btn btn-soft-red left" data-reset ${asg.loadPct === 0 ? 'disabled' : ''}>${icon('reset', 15)} Tout remettre à zéro</button><button class="btn btn-ghost" data-close>Annuler</button><button class="btn btn-primary" data-ok>Appliquer</button>`,
      onMount: (box, m) => {
        const inp = $('[data-pct]', box);
        const upd = () => { $('[data-prev]', box).innerHTML = rows(Number(inp.value) || 0); };
        inp.addEventListener('input', upd);
        $$('[data-q]', box).forEach((b) => b.addEventListener('click', () => { inp.value = b.dataset.q; upd(); }));
        $('[data-ok]', box).addEventListener('click', () => {
          const v = Number(inp.value) || 0; if (!v) { toast('Indiquez un pourcentage', 'error'); return; }
          asg.loadPct = round(asg.loadPct + v, 2); asg.loadHistory.push({ date: new Date().toISOString(), pct: v, by: fullName(meCoach()), note: $('[data-note]', box).value });
          notify(a.id, `<b>${esc(firstName(meCoach()))}</b> a ajusté vos charges (${v > 0 ? '+' : ''}${fmt.num(v, 1)} %)`, '/athlete/program', 'trendUp');
          m.close(); toast(`Charges ajustées de ${v > 0 ? '+' : ''}${fmt.num(v, 1)} %`); rerender();
        });
        const rb = $('[data-reset]', box);
        if (rb) rb.addEventListener('click', async () => {
          if (!(await confirmDialog({ title: 'Tout remettre à zéro ?', message: 'Les charges reviennent aux valeurs de base du programme. L’historique est conservé.', confirm: 'Remettre à zéro', danger: true }))) return;
          asg.loadHistory.push({ date: new Date().toISOString(), pct: -asg.loadPct, by: fullName(meCoach()), note: '', reset: true }); asg.loadPct = 0;
          m.close(); toast('Charges remises à zéro'); rerender();
        });
      },
    });
  };
})();
