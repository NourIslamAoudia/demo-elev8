'use strict';
/* =========================================================
   ELEV8 — Super Admin (2/4) : contenus Sport (banque d'exercices,
   séances, programmes ELEV8) et Nutrition (aliments, recettes &
   menus, programmes nutrition ELEV8)
   ========================================================= */
(() => {
  /* ---------- Banque d'exercices ---------- */
  adminRoute('/admin/exercises', 'exercises', () => {
    const key = 'exlib:admin'; const st = ui(key, { q: '', sport: '', pattern: '', level: '', muscle: '', src: 'all', more: false });
    const all = Sport.exercisesFor('admin'); const list = Sport.filterExercises(all, st, 'admin');
    const counts = { all: all.length, elev8: all.filter((x) => x.source === 'elev8').length, coach: all.filter((x) => x.source !== 'elev8').length };
    const html = `${pageHead('Banque d’exercices', `${fmt.num(all.length)} exercices sur la plateforme · une vidéo par exercice, remplaçable sans toucher aux séances existantes`, `<a class="btn btn-primary" href="#/admin/exercises/new">${icon('plus', 16)} Ajouter</a>`)}
      ${tabsNav([{ id: 'all', label: 'Tous', count: counts.all }, { id: 'elev8', label: 'ELEV8', count: counts.elev8 }, { id: 'coach', label: 'Coach', count: counts.coach }], st.src, { key, field: 'src' })}
      <div class="row wrap gap-8 mb-12">${searchBox('q', st.q, 'Rechercher un exercice…', 'data-f="q" style="min-width:240px"')}<button class="btn btn-outline btn-sm" data-action="toggle-ui" data-key="${key}" data-field="more">${icon('filter', 14)} Plus de filtres</button></div>
      ${st.more ? `<div class="row wrap gap-8 mb-12">${select('sport', [['', 'Tous les sports'], ...SPORTS], st.sport, 'data-f="sport"', 'sm')}${select('pattern', [['', 'Tous les mouvements'], ...PATTERNS], st.pattern, 'data-f="pattern"', 'sm')}${select('level', [['', 'Tous niveaux'], ...LEVELS], st.level, 'data-f="level"', 'sm')}${select('muscle', [['', 'Tous les muscles'], ...MUSCLES, 'Mollets'], st.muscle, 'data-f="muscle"', 'sm')}</div>` : ''}
      ${notice('Origine des vidéos : décision à prendre avant le développement (hébergement ELEV8, YouTube non répertorié et/ou production de vidéos originales). Aucun média du jeu de données public n’est repris sans licence commerciale.', 'violet', 'video')}
      <div class="row between mb-12 mt-16"><span class="small muted" data-count>${plural(list.length, 'exercice')}</span></div><div class="grid g-auto" data-grid>${list.map((x) => Sport.exCard(x, 'admin')).join('')}</div>`;
    return { title: 'Exercices', html, mount: (el) => Sport.mountFilters(el, key, 'admin', () => Sport.filterExercises(Sport.exercisesFor('admin'), ui(key), 'admin'), (l) => l.map((x) => Sport.exCard(x, 'admin')).join('')) };
  });
  adminRoute('/admin/exercises/new', 'exercises', () => Sport.exerciseForm('admin'));
  adminRoute('/admin/exercises/:id/edit', 'exercises', (p) => Sport.exerciseForm('admin', p.id));

  /* ---------- Séances ---------- */
  adminRoute('/admin/sessions', 'sessions', () => {
    const st = ui('asess', { f: 'all' });
    const list = DB.sessions.filter((s) => st.f === 'all' || (st.f === 'elev8' ? s.ownerId === 'elev8' : s.ownerId !== 'elev8'));
    const owner = (s) => (s.ownerId === 'elev8' ? pill('ELEV8', 'dark') : coachById(s.ownerId) ? pill(`Coach · ${fullName(coachById(s.ownerId))}`, 'blue') : pill('Athlète', 'violet'));
    return { title: 'Séances', html: `${pageHead('Bibliothèque des séances', 'Séances ELEV8 (utilisées dans les programmes ELEV8) et séances créées par les coachs.', `<a class="btn btn-primary" href="#/admin/sessions/new">${icon('plus', 16)} Nouvelle séance ELEV8</a>`)}
      <div class="mb-12">${seg([['all', 'Toutes'], ['elev8', 'ELEV8'], ['users', 'Coachs & athlètes']], st.f, 'asess', 'f', 'sm')}</div>
      <div class="card"><div class="table-wrap"><table class="table"><thead><tr><th>Séance</th><th>Auteur</th><th>Type</th><th>Objectif</th><th class="num">Exercices</th><th class="num">Durée</th></tr></thead><tbody>${list.map((s) => `<tr class="click" data-action="session-open" data-id="${s.id}"><td class="semibold">${esc(s.name)}</td><td>${owner(s)}</td><td class="small">${esc(s.type)}</td><td class="small">${esc(s.objective)}</td><td class="num">${s.items.length}</td><td class="num">~${Sport.estDuration(s)} min</td></tr>`).join('')}</tbody></table></div></div>` };
  });
  adminRoute('/admin/sessions/new', 'sessions', (p, q) => Sport.builder('admin', null, q));
  adminRoute('/admin/sessions/:id/edit', 'sessions', (p, q) => Sport.builder('admin', p.id, q));

  /* ---------- Programmes sportifs ELEV8 ---------- */
  adminRoute('/admin/programs', 'programs', () => {
    const st = ui('aprog', { tab: 'lib', q: '', goal: '', sort: 'name' });
    const lib = DB.programs.filter((p) => p.ownerId === 'elev8' && (!st.q || p.name.toLowerCase().includes(st.q.toLowerCase())) && (!st.goal || p.objective === st.goal)).sort((a, b) => (st.sort === 'name' ? a.name.localeCompare(b.name) : b.weeks.length - a.weeks.length));
    let body;
    if (st.tab === 'lib') body = `<div class="row wrap gap-8 mb-16">${searchBox('q', st.q, 'Rechercher un programme…', 'data-apq')}${select('goal', [['', 'Tous objectifs'], ...PROGRAM_GOALS], st.goal, 'data-agoal', 'sm')}${seg([['name', 'Nom'], ['weeks', 'Durée']], st.sort, 'aprog', 'sort', 'sm')}</div>
      <div class="grid g-auto">${lib.map((p) => { const n = DB.assignments.filter((x) => x.programId === p.id && x.status !== 'ended').length; return `<div class="card ${p.hidden ? '' : 'hover'}" style="${p.hidden ? 'opacity:.55' : ''}"><div class="card-b col gap-8"><div class="row between gap-6"><h3>${esc(p.name)}</h3>${p.hidden ? pill('Masqué') : ''}</div><div class="row wrap gap-4"><span class="pill pill-violet">${esc(p.objective)}</span><span class="tag">${p.weeks.length} semaines</span><span class="tag">${esc(p.level)}</span></div><div class="xs dim">${n} athlète${n > 1 ? 's' : ''} en cours</div><div class="row wrap gap-6"><a class="btn btn-outline btn-xs" href="#/admin/programs/${p.id}">${icon('edit', 12)} Modifier</a><button class="btn btn-ghost btn-xs" data-action="aprog-hide" data-id="${p.id}">${icon(p.hidden ? 'eye' : 'eyeOff', 12)} ${p.hidden ? 'Afficher' : 'Masquer'}</button></div></div></div>`; }).join('') || emptyState('search', 'Aucun programme')}</div>`;
    else {
      const rows = DB.assignments.filter((x) => x.status !== 'ended').map((x) => ({ x, a: athleteById(x.athleteId), p: programById(x.programId) })).filter((r) => r.a && r.p);
      body = `<div class="card"><div class="table-wrap"><table class="table"><thead><tr><th>Athlète</th><th>Programme</th><th>Origine</th><th>Période</th><th>Progression</th></tr></thead><tbody>${rows.map(({ x, a, p }) => { const pr = Sport.asgProgress(x); return `<tr><td><div class="person">${avatar(a, 'sm')}<div class="nm">${esc(fullName(a))}</div></div></td><td class="small semibold">${esc(p.name)}</td><td>${p.ownerId === 'elev8' ? pill('ELEV8', 'dark') : pill(`Coach — lecture seule`, 'blue')}</td><td class="small">${fmt.dm(x.start)} → ${fmt.dm(programEnd(x))}</td><td style="min-width:140px"><div class="row gap-6"><div class="grow">${progress(pr.pct, '', 'thin')}</div><span class="xs">${pr.pct} %</span></div></td></tr>`; }).join('')}</tbody></table></div></div><p class="xs dim mt-8">${icon('info', 12)} L’équipe ne modifie pas les programmes personnels des coachs.</p>`;
    }
    return { title: 'Programmes', html: `${pageHead('Programmes sportifs ELEV8', `${DB.programs.filter((p) => p.ownerId === 'elev8').length} programmes proposés aux athlètes sans coach`, `<a class="btn btn-primary" href="#/admin/programs/new">${icon('plus', 16)} Ajouter</a>`)}${tabsNav([{ id: 'lib', label: 'Bibliothèque' }, { id: 'athletes', label: 'Par athlète' }], st.tab, { key: 'aprog' })}${body}`,
      mount: (el) => { el.addEventListener('input', (e) => { if (e.target.matches('[data-apq]')) { st.q = e.target.value; clearTimeout(st.t); st.t = setTimeout(() => { rerender(); const i = $('[data-apq]'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 300); } }); el.addEventListener('change', (e) => { if (e.target.matches('[data-agoal]')) { st.goal = e.target.value; rerender(); } }); } };
  });
  adminRoute('/admin/programs/new', 'programs', () => Sport.programEditor('admin', null));
  adminRoute('/admin/programs/:id', 'programs', (p) => (programById(p.id) && programById(p.id).ownerId === 'elev8' ? Sport.programEditor('admin', p.id) : (go('/admin/programs'), null)));
  Actions['aprog-hide'] = (el) => { const p = programById(el.dataset.id); p.hidden = !p.hidden; audit(p.hidden ? 'Programme ELEV8 masqué' : 'Programme ELEV8 affiché', p.name); toast(p.hidden ? 'Programme masqué' : 'Programme visible'); rerender(); };

  /* ---------- Nutrition ---------- */
  adminRoute('/admin/nutrition/plans/new', 'nutrition', (p, q) => Nutri.planBuilder('admin', null, q));
  adminRoute('/admin/nutrition/plans/:id', 'nutrition', (p) => Nutri.planBuilder('admin', p.id));
  adminRoute('/admin/nutrition', 'nutrition', () => {
    const st = ui('anut', { tab: 'aliments', q: '', cat: '' });
    const ings = Nutri.ingredientsFor('admin').filter((g) => (!st.q || g.name.toLowerCase().includes(st.q.toLowerCase())) && (!st.cat || g.cat === st.cat));
    const progs = DB.nutritionPlans.filter((p) => p.status === 'elev8');
    let body;
    if (st.tab === 'aliments') body = `<div class="row wrap gap-8 mb-16">${searchBox('q', st.q, 'Rechercher un aliment…', 'data-anq')}<div class="chips sm">${[['', 'Toutes'], ...FOOD_CATS.map((c) => [c, c === 'Laitiers' ? 'Laitiers' : c])].map(([v, l]) => `<button type="button" class="chip ${st.cat === v ? 'active' : ''}" data-action="set-ui" data-key="anut" data-field="cat" data-value="${v}">${l}</button>`).join('')}</div><button class="btn btn-primary btn-sm ml-auto" data-action="ing-new" data-ctx="admin">${icon('plus', 14)} Ajouter</button></div><div class="grid g-auto" data-ngrid>${ings.map((g) => Nutri.ingCard(g, 'admin')).join('')}</div>`;
    else if (st.tab === 'recettes') body = `<div class="row end gap-8 mb-12"><button class="btn btn-outline btn-sm" data-action="menu-new" data-ctx="admin">${icon('plus', 14)} Menu ELEV8</button><button class="btn btn-primary btn-sm" data-action="recipe-new" data-ctx="admin">${icon('plus', 14)} Recette ELEV8</button></div><div class="section-title" style="margin-top:0"><h2>Recettes</h2></div><div class="grid g-auto">${Nutri.recipesFor('admin').map((r) => Nutri.recipeCard(r, 'admin')).join('')}</div><div class="section-title"><h2>Menus</h2></div><div class="grid g-auto">${Nutri.menusFor('admin').map((m) => Nutri.menuCard(m, 'admin')).join('')}</div>`;
    else body = `${notice('Sur la maquette, aucun programme nutrition ELEV8 n’existait : il faut en prévoir au lancement, sinon la fonction reste vide pour les athlètes sans programme.', 'amber', 'alert')}<div class="row end mt-12 mb-12"><a class="btn btn-primary btn-sm" href="#/admin/nutrition/plans/new">${icon('plus', 14)} Nouveau programme</a></div><div class="grid g-auto-lg">${progs.map((p) => `<div class="card"><div class="card-b col gap-8"><div class="row between"><h3>${esc(p.name)}</h3><span class="pill pill-violet">${esc(p.profile.goal)}</span></div><div class="small muted">Entraînement ${fmt.num(p.targets.training.kcal)} kcal · repos ${fmt.num(p.targets.rest.kcal)} kcal</div>${Nutri.splitBar(p.targets.training)}<div class="xs dim">${DB.nutritionPlans.filter((x) => x.fromElev8 === p.id && x.status === 'active').length} athlète(s) le suivent</div><div class="row gap-6"><a class="btn btn-outline btn-xs" href="#/admin/nutrition/plans/${p.id}">${icon('edit', 12)} Modifier</a><button class="btn btn-ghost btn-xs" data-action="nplan-pdf" data-id="${p.id}">${icon('eye', 12)} Aperçu</button></div></div></div>`).join('')}</div>`;
    return { title: 'Nutrition', html: `${pageHead('Nutrition', 'Plans nutritionnels ELEV8, aliments, recettes et menus. Photos réalistes générées par IA une fois pour toutes, remplaçables sans toucher aux plans existants.')}
      <div class="grid g-4 mb-16">${kpi({ label: 'Aliments', value: Nutri.ingredientsFor('admin').length, ic: 'apple', tone: 'green' })}${kpi({ label: 'Recettes', value: DB.recipes.length, ic: 'chef', tone: 'amber' })}${kpi({ label: 'Menus', value: DB.menus.length, ic: 'utensils', tone: 'blue' })}${kpi({ label: 'Programmes nutrition ELEV8', value: progs.length, ic: 'layers', tone: 'violet' })}</div>
      ${tabsNav([{ id: 'aliments', label: 'Aliments', count: Nutri.ingredientsFor('admin').length }, { id: 'recettes', label: 'Recettes & menus' }, { id: 'programmes', label: 'Programmes nutrition', count: progs.length }], st.tab, { key: 'anut' })}${body}`,
      mount: (el) => el.addEventListener('input', (e) => { if (e.target.matches('[data-anq]')) { st.q = e.target.value; $('[data-ngrid]', el).innerHTML = Nutri.ingredientsFor('admin').filter((g) => g.name.toLowerCase().includes(st.q.toLowerCase()) && (!st.cat || g.cat === st.cat)).map((g) => Nutri.ingCard(g, 'admin')).join(''); } }) };
  });
})();
