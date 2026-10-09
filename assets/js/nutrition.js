'use strict';
/* =========================================================
   ELEV8 — Pôle Nutrition (1/2) : calculs, bibliothèques
   d'ingrédients / menus / recettes, sélecteur d'aliments
   ========================================================= */
var Nutri = window.Nutri || {};
(() => {
  const ctxOfPath = () => (location.hash.startsWith('#/admin') ? 'admin' : location.hash.startsWith('#/athlete') ? 'athlete' : 'coach');
  const ownerOf = (ctx) => (ctx === 'coach' ? S.userId : ctx === 'athlete' ? meAthlete().id : 'elev8');
  Nutri.MACRO = [['kcal', 'Calories', 'kcal', 'var(--s4)'], ['p', 'Protéines', 'g', 'var(--s1)'], ['c', 'Glucides', 'g', 'var(--s2)'], ['f', 'Lipides', 'g', 'var(--s3)']];
  Nutri.DIFF = { Facile: 'green', Intermédiaire: 'amber', Difficile: 'red' };

  /* ---------- Calculs & plan actif ---------- */
  Nutri.planOf = (aId) => DB.nutritionPlans.find((p) => p.athleteId === aId && p.status === 'active') || null;
  Nutri.dayType = (aId, date = new Date()) => (scheduledSessionOn(aId, date) ? 'training' : 'rest');
  Nutri.targetsFor = (aId, date = new Date()) => { const p = Nutri.planOf(aId); return p ? p.targets[Nutri.dayType(aId, date)] : null; };
  Nutri.dayLog = (aId, key) => { DB.foodLogs[aId] = DB.foodLogs[aId] || {}; return (DB.foodLogs[aId][key] = DB.foodLogs[aId][key] || []); };
  Nutri.totals = (entries) => roundM(entries.reduce((acc, e) => addM(acc, e), ZERO()));
  Nutri.macroLine = (m, cls = '') => `<div class="macros ${cls}"><span class="k">${fmt.num(m.kcal)} kcal</span><span>P ${fmt.num(m.p, 1)} g</span><span>G ${fmt.num(m.c, 1)} g</span><span>L ${fmt.num(m.f, 1)} g</span></div>`;
  Nutri.macroBars = (cons, tgt, { remaining = true } = {}) => `<div class="macro-bars">${Nutri.MACRO.map(([k, l, u, col]) => {
    const c = cons[k] || 0; const t = tgt ? tgt[k] || 0 : 0; const p = t ? (c / t) * 100 : 0; const left = t - c; const over = left < 0;
    return `<div class="mbar"><div class="row between"><span class="semibold"><span class="legend-key" style="background:${col}"></span>${l}</span><span class="small num">${fmt.num(c)} / ${fmt.num(t)} ${u}${remaining && t ? ` · <b class="${over ? 't-red' : ''}">${over ? `+${fmt.num(-left)} ${u} au-delà` : `reste ${fmt.num(left)} ${u}`}</b>` : ''}</span></div>${progress(p, over ? 'var(--s8)' : col)}</div>`;
  }).join('')}</div>`;
  Nutri.kcalFromMacros = (t) => Math.round(t.p * 4 + t.c * 4 + t.f * 9);
  Nutri.splitBar = (t) => { const kp = t.p * 4; const kc = t.c * 4; const kf = t.f * 9; const tot = kp + kc + kf || 1; return `<div class="row gap-4" style="height:10px">${[[kp, 'var(--s1)', 'Protéines'], [kc, 'var(--s2)', 'Glucides'], [kf, 'var(--s3)', 'Lipides']].map(([v, c, l]) => `<span data-tip="${l} : ${fmt.num((v / tot) * 100)} % des calories" style="flex:${v || 0.001} 1 0;background:${c};border-radius:3px;height:100%"></span>`).join('')}</div><div class="row between xs dim mt-4"><span>P ${fmt.num((kp / tot) * 100)} %</span><span>G ${fmt.num((kc / tot) * 100)} %</span><span>L ${fmt.num((kf / tot) * 100)} %</span></div>`; };

  /* ---------- Visibilité ---------- */
  Nutri.ingredientsFor = (ctx) => {
    if (ctx === 'admin') return DB.ingredients.filter((x) => !x.removed);
    if (ctx === 'coach') return DB.ingredients.filter((x) => !x.removed && !x.hidden && (x.source === 'elev8' || x.ownerId === S.userId));
    const a = meAthlete(); return DB.ingredients.filter((x) => !x.removed && !x.hidden && (x.source === 'elev8' || x.ownerId === a.id || (a.coachId && x.ownerId === a.coachId)));
  };
  Nutri.menusFor = (ctx) => {
    if (ctx === 'admin') return DB.menus.filter((x) => !x.removed);
    if (ctx === 'coach') return DB.menus.filter((x) => !x.removed && !x.hidden && (x.source === 'elev8' || x.ownerId === S.userId));
    const a = meAthlete(); return DB.menus.filter((x) => !x.removed && !x.hidden && (x.source === 'elev8' || x.ownerId === a.id || (a.coachId && x.ownerId === a.coachId)));
  };
  Nutri.recipesFor = (ctx) => {
    if (ctx === 'admin') return DB.recipes.filter((x) => !x.removed);
    if (ctx === 'coach') return DB.recipes.filter((x) => !x.removed && !x.hidden && (x.source === 'elev8' || x.ownerId === S.userId));
    const a = meAthlete();
    return DB.recipes.filter((x) => !x.removed && !x.hidden && (x.ownerId === a.id || (a.coachId ? x.sharedWith.includes(a.id) : x.source === 'elev8')));
  };

  /* ---------- Cartes ---------- */
  Nutri.ingCard = (g, ctx) => `<button type="button" class="food-card" data-action="ing-open" data-id="${g.id}" data-ctx="${ctx}">${FoodTile.ing(g)}<div class="row between gap-6 top"><span class="nm">${esc(g.name)}</span>${g.source !== 'elev8' ? `<span class="pill ${g.flagged ? 'pill-red' : 'pill-blue'}">${g.flagged ? 'Signalé' : 'Perso'}</span>` : g.hidden ? '<span class="pill">Masqué</span>' : ''}</div><span class="xs dim">${esc(g.cat)} · ${esc(g.portion.label)} (${g.portion.g} g)</span><div class="macros"><span class="k">${fmt.num(g.kcal)} kcal</span><span>P ${fmt.num(g.p, 1)}</span><span>G ${fmt.num(g.c, 1)}</span><span>L ${fmt.num(g.f, 1)}</span></div><span class="xxs dim">Valeurs pour 100 g</span></button>`;
  Nutri.menuCard = (m, ctx) => { const t = menuMacros(m); return `<button type="button" class="food-card" data-action="menu-open" data-id="${m.id}" data-ctx="${ctx}">${FoodTile.menu(m)}<div class="row between gap-6 top"><span class="nm">${esc(m.name)}</span>${m.source !== 'elev8' ? '<span class="pill pill-blue">Perso</span>' : ''}</div><div class="row wrap gap-4"><span class="pill pill-violet">${esc(m.goal)}</span>${m.tags.slice(0, 2).map((x) => `<span class="tag">${esc(x)}</span>`).join('')}</div>${Nutri.macroLine(t)}</button>`; };
  Nutri.recipeCard = (r, ctx) => { const t = recipeMacros(r); return `<button type="button" class="food-card" data-action="recipe-open" data-id="${r.id}" data-ctx="${ctx}">${FoodTile.recipe(r)}<div class="row between gap-6 top"><span class="nm">${esc(r.name)}</span>${r.flagged ? '<span class="pill pill-red">Signalé</span>' : ''}</div><div class="row wrap gap-4"><span class="pill pill-${Nutri.DIFF[r.difficulty] || ''}">${esc(r.difficulty)}</span><span class="tag">${icon('clock', 11)}&nbsp;${r.time} min</span><span class="tag">${r.servings} portion${r.servings > 1 ? 's' : ''}</span></div>${Nutri.macroLine(t)}<span class="xxs dim">Par portion</span></button>`; };

  /* ---------- Page bibliothèque (Ingrédients | Menus) ---------- */
  Nutri.libraryPage = (ctx) => {
    const key = `nlib:${ctx}`; const st = ui(key, { tab: 'ing', q: '', cat: '', goal: '', tag: '' });
    const ings = Nutri.ingredientsFor(ctx).filter((g) => (!st.q || g.name.toLowerCase().includes(st.q.toLowerCase())) && (!st.cat || g.cat === st.cat));
    const menus = Nutri.menusFor(ctx).filter((m) => (!st.q || m.name.toLowerCase().includes(st.q.toLowerCase())) && (!st.goal || m.goal === st.goal) && (!st.tag || m.tags.includes(st.tag)));
    const isIng = st.tab === 'ing';
    const add = ctx === 'athlete' ? (isIng ? `<button class="btn btn-primary" data-action="ing-new" data-ctx="${ctx}">${icon('plus', 16)} Ajouter un aliment</button>` : '') : `<button class="btn btn-primary" data-action="${isIng ? 'ing-new' : 'menu-new'}" data-ctx="${ctx}">${icon('plus', 16)} ${isIng ? 'Ajouter un ingrédient' : 'Créer un menu'}</button>`;
    const filters = isIng ? `<div class="chips sm">${[['', 'Toutes'], ...FOOD_CATS.map((c) => [c, c])].map(([v, l]) => `<button type="button" class="chip ${st.cat === v ? 'active' : ''}" data-action="set-ui" data-key="${key}" data-field="cat" data-value="${v}">${l}</button>`).join('')}</div>`
      : `<div class="row wrap gap-8">${select('goal', [['', 'Tous objectifs'], ...NUTRI_GOALS], st.goal, `data-nf="goal"`, 'sm')}${select('tag', [['', 'Toutes contraintes'], ...DIET_TAGS], st.tag, `data-nf="tag"`, 'sm')}</div>`;
    const grid = isIng ? ings.map((g) => Nutri.ingCard(g, ctx)).join('') : menus.map((m) => Nutri.menuCard(m, ctx)).join('');
    const html = `${pageHead('Aliments & menus', 'Bibliothèque illustrée fournie au lancement : photos réalistes générées par IA (illustratives — les valeurs viennent toujours des données nutritionnelles).', add)}
      ${tabsNav([{ id: 'ing', label: 'Ingrédients', count: Nutri.ingredientsFor(ctx).length }, { id: 'menu', label: 'Menus', count: Nutri.menusFor(ctx).length }], st.tab, { key })}
      <div class="row wrap gap-12 mb-16">${searchBox('q', st.q, isIng ? 'Rechercher un aliment…' : 'Rechercher un menu…', 'data-nq')}${filters}</div>
      <div class="grid g-auto" data-ngrid>${grid || emptyState('search', 'Aucun résultat')}</div>`;
    return { html, title: 'Aliments & menus', mount: (el) => {
      el.addEventListener('input', (e) => { if (e.target.matches('[data-nq]')) { st.q = e.target.value; const g = $('[data-ngrid]', el); const list = isIng ? Nutri.ingredientsFor(ctx).filter((x) => x.name.toLowerCase().includes(st.q.toLowerCase()) && (!st.cat || x.cat === st.cat)).map((x) => Nutri.ingCard(x, ctx)) : Nutri.menusFor(ctx).filter((m) => m.name.toLowerCase().includes(st.q.toLowerCase()) && (!st.goal || m.goal === st.goal) && (!st.tag || m.tags.includes(st.tag))).map((m) => Nutri.menuCard(m, ctx)); g.innerHTML = list.join('') || emptyState('search', 'Aucun résultat'); } });
      el.addEventListener('change', (e) => { const f = e.target.dataset.nf; if (f) { st[f] = e.target.value; rerender(); } });
    } };
  };
  Nutri.recipesPage = (ctx) => {
    const key = `nrec:${ctx}`; const st = ui(key, { q: '', diff: '' });
    const list = Nutri.recipesFor(ctx).filter((r) => (!st.q || r.name.toLowerCase().includes(st.q.toLowerCase())) && (!st.diff || r.difficulty === st.diff));
    const a = ctx === 'athlete' ? meAthlete() : null;
    const sub = ctx === 'coach' ? 'Créez des fiches recettes (valeurs nutritionnelles calculées automatiquement) et partagez-les avec vos athlètes.' : a && a.coachId ? 'Les recettes partagées par votre coach et celles que vous avez créées.' : 'Les recettes ELEV8 et celles que vous avez créées.';
    return { title: 'Recettes', html: `${pageHead('Recettes', sub, `<button class="btn btn-primary" data-action="recipe-new" data-ctx="${ctx}">${icon('plus', 16)} Créer une recette</button>`)}
      <div class="row wrap gap-12 mb-16">${searchBox('q', st.q, 'Rechercher une recette…', 'data-rq')}${seg([['', 'Toutes'], ['Facile', 'Facile'], ['Intermédiaire', 'Intermédiaire'], ['Difficile', 'Difficile']], st.diff, key, 'diff', 'sm')}</div>
      <div class="grid g-auto" data-rgrid>${list.map((r) => Nutri.recipeCard(r, ctx)).join('') || emptyState('chef', 'Aucune recette', ctx === 'athlete' && a && a.coachId ? 'Votre coach n’a pas encore partagé de recette.' : 'Créez votre première recette.')}</div>`,
    mount: (el) => el.addEventListener('input', (e) => { if (e.target.matches('[data-rq]')) { st.q = e.target.value; $('[data-rgrid]', el).innerHTML = Nutri.recipesFor(ctx).filter((r) => r.name.toLowerCase().includes(st.q.toLowerCase()) && (!st.diff || r.difficulty === st.diff)).map((r) => Nutri.recipeCard(r, ctx)).join('') || emptyState('search', 'Aucun résultat'); } }) };
  };

  /* ---------- Fiches (modales) ---------- */
  const itemsTable = (items, k = 1) => `<table class="table compact"><thead><tr><th>Aliment</th><th class="num">Quantité</th><th class="num">kcal</th><th class="num">P</th><th class="num">G</th><th class="num">L</th></tr></thead><tbody>${items.map((it) => { const m = roundM(itemsMacros([it], k)); return `<tr><td><div class="row gap-8">${it.type === 'ing' ? FoodTile.ing(ingById(it.id), 'sm') : ''}${esc(itemLabel(it))}</div></td><td class="num">${it.type === 'ing' ? `${fmt.num(it.g * k)} g` : `${fmt.num((it.servings || 1) * k, 1)} port.`}</td><td class="num">${fmt.num(m.kcal)}</td><td class="num">${fmt.num(m.p, 1)}</td><td class="num">${fmt.num(m.c, 1)}</td><td class="num">${fmt.num(m.f, 1)}</td></tr>`; }).join('')}</tbody></table>`;
  Actions['ing-open'] = (el) => {
    const g = ingById(el.dataset.id); const ctx = el.dataset.ctx || ctxOfPath(); const own = g.ownerId === ownerOf(ctx);
    const per = ingMacros(g, g.portion.g);
    let footer = '<button class="btn btn-primary" data-close>Fermer</button>';
    if (ctx === 'admin') footer = `${g.source !== 'elev8' ? `<button class="btn btn-soft-red left" data-action="nut-remove" data-kind="ing" data-id="${g.id}">${icon('ban', 15)} Retirer</button>` : ''}<button class="btn btn-outline" data-action="nut-hide" data-kind="ing" data-id="${g.id}">${icon(g.hidden ? 'eye' : 'eyeOff', 15)} ${g.hidden ? 'Afficher' : 'Masquer'}</button><button class="btn btn-primary" data-action="ing-new" data-ctx="admin" data-id="${g.id}">${icon('edit', 15)} Modifier / corriger</button>`;
    else if (own) footer = `<button class="btn btn-soft-red left" data-action="nut-delete" data-kind="ing" data-id="${g.id}">${icon('trash', 15)}</button><button class="btn btn-primary" data-action="ing-new" data-ctx="${ctx}" data-id="${g.id}">${icon('edit', 15)} Modifier</button>`;
    if (ctx === 'athlete') footer = `<button class="btn btn-outline" data-action="journal-quick" data-type="ing" data-id="${g.id}">${icon('plus', 15)} Ajouter au journal</button>${footer}`;
    openModal({ title: esc(g.name), sub: `${esc(g.cat)} · ${g.source === 'elev8' ? 'Bibliothèque ELEV8' : 'Ingrédient personnalisé'}`, size: 'md', body: `<div class="grid g-2 gap-20"><div>${FoodTile.ing(g)}${g.source === 'elev8' ? '<p class="xs dim mt-8">Photo illustrative générée par IA : elle ne sert pas de repère de quantité.</p>' : !g.emoji && !g.photo ? '<p class="xs dim mt-8">Ingrédient sans photo : une image neutre s’affiche.</p>' : ''}</div><div class="col gap-12"><div class="tile soft"><div class="upper mb-8">Pour 100 g</div>${Nutri.macroLine(g)}</div><div class="tile soft"><div class="upper mb-8">Portion usuelle · ${esc(g.portion.label)} (${g.portion.g} g)</div>${Nutri.macroLine(roundM(per))}</div>${g.flagged ? notice('Valeurs signalées comme manifestement fausses.', 'red', 'flag') : ''}</div></div>`, footer });
  };
  Actions['menu-open'] = (el) => {
    const m = menuById(el.dataset.id); const ctx = el.dataset.ctx || ctxOfPath(); const own = m.ownerId === ownerOf(ctx); const t = menuMacros(m);
    let footer = '<button class="btn btn-ghost" data-close>Fermer</button>';
    if (ctx === 'athlete') footer += `<button class="btn btn-primary" data-action="journal-quick" data-type="menu" data-id="${m.id}">${icon('plus', 15)} Ajouter au journal</button>`;
    if (ctx === 'coach') footer = `${own ? `<button class="btn btn-soft-red left" data-action="nut-delete" data-kind="menu" data-id="${m.id}">${icon('trash', 15)}</button>` : ''}<button class="btn btn-ghost" data-close>Fermer</button><button class="btn btn-primary" data-action="menu-new" data-ctx="coach" data-id="${m.id}" data-dup="${own ? '' : '1'}">${icon(own ? 'edit' : 'copy', 15)} ${own ? 'Modifier' : 'Adapter (copie)'}</button>`;
    if (ctx === 'admin') footer = `<button class="btn btn-outline" data-action="nut-hide" data-kind="menu" data-id="${m.id}">${icon(m.hidden ? 'eye' : 'eyeOff', 15)} ${m.hidden ? 'Afficher' : 'Masquer'}</button><button class="btn btn-primary" data-action="menu-new" data-ctx="admin" data-id="${m.id}">${icon('edit', 15)} Modifier</button>`;
    openModal({ title: esc(m.name), sub: `${esc(m.meal || 'Repas')} · objectif ${esc(m.goal.toLowerCase())}`, size: 'lg', body: `<div class="grid l-1-2 gap-20"><div>${FoodTile.menu(m)}<div class="row wrap gap-4 mt-12">${m.tags.map((x) => `<span class="tag">${esc(x)}</span>`).join('')}</div></div><div><div class="tile soft mb-12"><div class="upper mb-8">Total du menu (calcul automatique)</div>${Nutri.macroLine(t)}<div class="mt-12">${Nutri.splitBar(t)}</div></div>${itemsTable(m.items)}</div></div>`, footer });
  };
  Actions['recipe-open'] = (el) => {
    const r = recipeById(el.dataset.id); const ctx = el.dataset.ctx || ctxOfPath(); const own = r.ownerId === ownerOf(ctx); const t = recipeMacros(r);
    let footer = '<button class="btn btn-ghost" data-close>Fermer</button>';
    if (ctx === 'athlete') footer += `<button class="btn btn-primary" data-action="journal-quick" data-type="recipe" data-id="${r.id}">${icon('plus', 15)} Ajouter une portion au journal</button>`;
    if (own) footer = `<button class="btn btn-soft-red left" data-action="nut-delete" data-kind="recipe" data-id="${r.id}">${icon('trash', 15)}</button>${footer}<button class="btn btn-primary" data-action="recipe-new" data-ctx="${ctx}" data-id="${r.id}">${icon('edit', 15)} Modifier</button>`;
    if (ctx === 'coach') footer += `<button class="btn btn-outline" data-action="recipe-share" data-id="${r.id}">${icon('share', 15)} Partager (${r.sharedWith.length})</button>`;
    if (ctx === 'admin') footer = `${r.source !== 'elev8' ? `<button class="btn btn-soft-red left" data-action="nut-remove" data-kind="recipe" data-id="${r.id}">${icon('ban', 15)} Retirer</button>` : ''}<button class="btn btn-outline" data-action="nut-hide" data-kind="recipe" data-id="${r.id}">${icon(r.hidden ? 'eye' : 'eyeOff', 15)} ${r.hidden ? 'Afficher' : 'Masquer'}</button><button class="btn btn-primary" data-close>Fermer</button>`;
    openModal({ title: esc(r.name), sub: `${esc(r.difficulty)} · ${r.time} min · ${r.servings} portion${r.servings > 1 ? 's' : ''}`, size: 'lg', body: `<div class="grid l-1-2 gap-20"><div>${FoodTile.recipe(r)}<div class="tile soft mt-12"><div class="upper mb-8">Par portion (calcul automatique)</div>${Nutri.macroLine(t)}</div></div><div><div class="label mb-8">Ingrédients (recette complète)</div>${itemsTable(r.items)}<div class="label mt-16 mb-8">Préparation</div><ol class="small" style="padding-left:18px;display:flex;flex-direction:column;gap:6px">${r.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol></div></div>${r.flagged ? notice('Recette signalée : valeurs nutritionnelles irréalistes.', 'red', 'flag') : ''}`, footer });
  };
  Actions['nut-hide'] = (el) => { const arr = el.dataset.kind === 'ing' ? DB.ingredients : el.dataset.kind === 'menu' ? DB.menus : DB.recipes; const x = byId(arr, el.dataset.id); x.hidden = !x.hidden; audit(x.hidden ? 'Contenu nutrition masqué' : 'Contenu nutrition affiché', x.name); closeAllModals(); toast(x.hidden ? 'Masqué pour tous les utilisateurs' : 'De nouveau visible'); rerender(); };
  Actions['nut-delete'] = async (el) => { const arr = el.dataset.kind === 'ing' ? DB.ingredients : el.dataset.kind === 'menu' ? DB.menus : DB.recipes; const x = byId(arr, el.dataset.id); if (!(await confirmDialog({ title: 'Supprimer ?', message: `« ${esc(x.name)} » sera supprimé. Les plans existants conservent leurs valeurs.`, confirm: 'Supprimer', danger: true }))) return; x.hidden = true; closeAllModals(); toast('Supprimé'); rerender(); };
  Actions['nut-remove'] = async (el) => {
    const arr = el.dataset.kind === 'ing' ? DB.ingredients : el.dataset.kind === 'menu' ? DB.menus : DB.recipes; const x = byId(arr, el.dataset.id);
    const reason = await confirmDialog({ title: 'Retirer ce contenu ?', message: `« ${esc(x.name)} » sera retiré et son auteur prévenu.`, confirm: 'Retirer', danger: true, input: { label: 'Motif', required: true, placeholder: 'Ex. : valeurs nutritionnelles manifestement fausses' } });
    if (!reason) return; x.removed = true; audit('Contenu retiré', x.name, reason); notify(x.ownerId, `Votre contenu <b>${esc(x.name)}</b> a été retiré : ${esc(reason)}`, '', 'ban');
    const rp = DB.reports.find((r) => r.targetId === x.id); if (rp) rp.status = 'removed'; closeAllModals(); toast('Contenu retiré'); rerender();
  };
  Actions['recipe-share'] = (el) => {
    const r = recipeById(el.dataset.id); const clients = DB.athletes.filter((a) => a.coachId === S.userId && a.status === 'active');
    openModal({ title: 'Partager la recette', sub: esc(r.name), size: 'sm', body: `<div class="col gap-6">${clients.map((a) => `<label class="check">${`<input type="checkbox" name="sh" value="${a.id}" ${r.sharedWith.includes(a.id) ? 'checked' : ''}>`}<span>${esc(fullName(a))}</span></label>`).join('')}</div>`, footer: '<button class="btn btn-ghost" data-close>Annuler</button><button class="btn btn-primary" data-ok>Enregistrer</button>',
      onMount: (box, m) => $('[data-ok]', box).addEventListener('click', () => { const ids = $$('input[name=sh]:checked', box).map((i) => i.value); ids.filter((id) => !r.sharedWith.includes(id)).forEach((id) => notify(id, `Nouvelle recette partagée : <b>${esc(r.name)}</b>`, '/athlete/nutrition/recipes', 'chef')); r.sharedWith = ids; m.close(); closeAllModals(); toast(`Recette partagée avec ${ids.length} athlète${ids.length > 1 ? 's' : ''}`); rerender(); }) });
  };

  /* ---------- Formulaires de création ---------- */
  Actions['ing-new'] = (el) => {
    const ctx = el.dataset.ctx; const g = el.dataset.id ? ingById(el.dataset.id) : null;
    const v = g || { name: '', cat: 'Personnalisé', photo: '', kcal: '', p: '', c: '', f: '', portion: { label: '1 portion', g: 100 } };
    openModal({ title: g ? (ctx === 'admin' ? 'Modifier / corriger l’ingrédient' : 'Modifier l’ingrédient') : 'Ajouter un ingrédient', size: 'md',
      body: `<form data-ing-form class="col gap-14"><div class="grid g-2 gap-16"><div class="col gap-12">${field('Nom', input('name', v.name, { attrs: 'required', placeholder: 'Ex. : Galette de sarrasin' }))}${field('Catégorie', chips('cat', FOOD_CATS, v.cat))}</div>${field('Photo <span class="dim normal">(facultative)</span>', dropzone({ name: 'photo', value: v.photo, label: 'Votre photo', hint: 'Sans photo : image neutre' }))}</div>
        <div class="label mt-12">Valeurs nutritionnelles pour 100 g</div><div class="grid g-4 mt-8">${field('Calories', inputUnit('kcal', v.kcal, 'kcal'))}${field('Protéines', inputUnit('p', v.p, 'g', { attrs: 'step="0.1"' }))}${field('Glucides', inputUnit('c', v.c, 'g', { attrs: 'step="0.1"' }))}${field('Lipides', inputUnit('f', v.f, 'g', { attrs: 'step="0.1"' }))}</div>
        <div class="grid g-2 mt-12">${field('Portion usuelle', input('plabel', v.portion.label, { placeholder: '1 cuillère, 1 tranche, 1 œuf…' }))}${field('Poids de la portion', inputUnit('pg', v.portion.g, 'g'))}</div></form>`,
      footer: '<button class="btn btn-ghost" data-close>Annuler</button><button class="btn btn-primary" data-ok>Enregistrer</button>',
      onMount: (box, m) => $('[data-ok]', box).addEventListener('click', () => {
        const f = formValues($('[data-ing-form]', box));
        if (!f.name.trim()) { toast('Nom obligatoire', 'error'); return; }
        const data = { name: f.name.trim(), cat: f.cat || 'Personnalisé', photo: f.photo, kcal: Number(f.kcal) || 0, p: Number(f.p) || 0, c: Number(f.c) || 0, f: Number(f.f) || 0, portion: { label: f.plabel || '1 portion', g: Number(f.pg) || 100 } };
        if (g) { Object.assign(g, data); if (ctx === 'admin') { g.flagged = false; audit('Valeur nutritionnelle corrigée', g.name); } toast('Ingrédient mis à jour'); }
        else { DB.ingredients.push({ id: uid('i'), ...data, emoji: '', source: ctx === 'admin' ? 'elev8' : ctx, ownerId: ownerOf(ctx), hidden: false }); toast('Ingrédient ajouté'); }
        m.close(); closeAllModals(); rerender();
      }) });
  };
  const itemsEditor = (items) => (items.length ? items.map((it, i) => `<div class="row gap-8 tile" style="padding:8px">${it.type === 'ing' ? FoodTile.ing(ingById(it.id), 'sm') : it.type === 'recipe' ? FoodTile.recipe(recipeById(it.id), 'sm') : FoodTile.menu(menuById(it.id), 'sm')}<div class="grow"><div class="semibold small">${esc(itemLabel(it))}</div><div class="xs dim">${fmt.num(roundM(itemMacros(it)).kcal)} kcal</div></div>${it.type === 'ing' ? inputUnit(`q${i}`, it.g, 'g', { attrs: `data-q="${i}" style="width:100px"` }) : inputUnit(`q${i}`, it.servings || 1, 'port.', { attrs: `data-q="${i}" step="0.5" style="width:110px"` })}<button type="button" class="icon-btn danger" data-rm="${i}">${icon('trash', 15)}</button></div>`).join('') : '<div class="small dim tile soft center">Aucun aliment. Utilisez « Ajouter un aliment ».</div>');
  const bindItems = (box, items, onChange) => {
    box.addEventListener('input', (e) => { const i = e.target.dataset.q; if (i != null) { const it = items[Number(i)]; if (it.type === 'ing') it.g = Number(e.target.value) || 0; else it.servings = Number(e.target.value) || 0; onChange(false); } });
    box.addEventListener('click', (e) => { const r = e.target.closest('[data-rm]'); if (r) { items.splice(Number(r.dataset.rm), 1); onChange(true); } });
  };
  Actions['menu-new'] = (el) => {
    const ctx = el.dataset.ctx; const src = el.dataset.id ? menuById(el.dataset.id) : null; const dup = el.dataset.dup === '1';
    const st = src ? JSON.parse(JSON.stringify(src)) : { name: '', goal: 'Maintien', tags: [], meal: 'Déjeuner', items: [], photo: '' };
    if (dup) st.name = `${st.name} (adapté)`;
    closeAllModals();
    openModal({ title: src && !dup ? 'Modifier le menu' : 'Créer un menu', sub: 'Calories et macros calculées automatiquement', size: 'lg',
      body: `<form data-menu-form class="col gap-16"><div class="grid g-2 gap-16"><div class="col gap-12">${field('Nom du menu', input('name', st.name, { placeholder: 'Ex. : Déjeuner léger' }))}${field('Repas', chips('meal', ['Petit-déjeuner', 'Déjeuner', 'Collation', 'Dîner'], st.meal))}${field('Objectif', chips('goal', NUTRI_GOALS, st.goal))}${field('Contraintes respectées', chips('tags', DIET_TAGS, st.tags, { multi: true }))}</div><div class="col gap-12">${field('Photo <span class="dim normal">(sinon composition automatique)</span>', dropzone({ name: 'photo', value: st.photo }))}<div class="tile soft" data-tot></div></div></div>
        <div class="row between"><span class="label">Composition</span><button type="button" class="btn btn-outline btn-sm" data-add>${icon('plus', 15)} Ajouter un aliment ou une recette</button></div><div class="col gap-8" data-items></div></form>`,
      footer: '<button class="btn btn-ghost" data-close>Annuler</button><button class="btn btn-primary" data-ok>Enregistrer le menu</button>',
      onMount: (box, m) => {
        const draw = (full = true) => { if (full) $('[data-items]', box).innerHTML = itemsEditor(st.items); const t = roundM(itemsMacros(st.items)); $('[data-tot]', box).innerHTML = `<div class="upper mb-8">Total</div>${Nutri.macroLine(t)}<div class="mt-12">${Nutri.splitBar(t)}</div>`; };
        bindItems($('[data-items]', box), st.items, draw); draw();
        $('[data-add]', box).addEventListener('click', () => Nutri.picker({ ctx, tabs: ['ing', 'recipe'], onPick: (it) => { st.items.push(it); draw(); } }));
        $('[data-ok]', box).addEventListener('click', () => {
          const f = formValues($('[data-menu-form]', box));
          if (!f.name.trim() || !st.items.length) { toast('Nom et au moins un aliment requis', 'error'); return; }
          const data = { name: f.name.trim(), goal: f.goal || 'Maintien', tags: f.tags, meal: f.meal, photo: f.photo, items: st.items };
          if (src && !dup) { Object.assign(src, data); toast('Menu mis à jour'); } else { DB.menus.push({ id: uid('m'), ...data, source: ctx === 'admin' ? 'elev8' : ctx, ownerId: ownerOf(ctx), hidden: false }); toast('Menu créé'); }
          m.close(); rerender();
        });
      } });
  };
  Actions['recipe-new'] = (el) => {
    const ctx = el.dataset.ctx; const src = el.dataset.id ? recipeById(el.dataset.id) : null;
    const st = src ? JSON.parse(JSON.stringify(src)) : { name: '', difficulty: 'Facile', time: 20, servings: 2, items: [], steps: [], sharedWith: [], photo: '' };
    const clients = ctx === 'coach' ? DB.athletes.filter((a) => a.coachId === S.userId && a.status === 'active') : [];
    closeAllModals();
    openModal({ title: src ? 'Modifier la recette' : 'Créer une recette', sub: 'Valeurs nutritionnelles calculées automatiquement à partir des ingrédients', size: 'lg',
      body: `<form data-rec-form class="col gap-16"><div class="grid g-2 gap-16"><div class="col gap-12">${field('Nom de la recette', input('name', st.name, { placeholder: 'Ex. : Poulet citron & riz' }))}${field('Difficulté', chips('difficulty', ['Facile', 'Intermédiaire', 'Difficile'], st.difficulty, { custom: false }))}<div class="grid g-2">${field('Temps', inputUnit('time', st.time, 'min'))}${field('Portions', input('servings', st.servings, { type: 'number', attrs: 'min="1" data-serv' }))}</div></div><div class="col gap-12">${field('Photo', dropzone({ name: 'photo', value: st.photo }))}<div class="tile soft" data-tot></div></div></div>
        <div class="row between"><span class="label">Ingrédients & quantités</span><button type="button" class="btn btn-outline btn-sm" data-add>${icon('plus', 15)} Ajouter un ingrédient</button></div><div class="col gap-8" data-items></div>
        ${field('Étapes de préparation', textarea('steps', st.steps.join('\n'), { rows: 4, placeholder: 'Une étape par ligne' }))}
        ${clients.length ? field('Partager avec', `<div class="row wrap gap-12">${clients.map((a) => checkbox('share', a.id, esc(fullName(a)), st.sharedWith.includes(a.id))).join('')}</div>`) : ''}</form>`,
      footer: '<button class="btn btn-ghost" data-close>Annuler</button><button class="btn btn-primary" data-ok>Enregistrer la recette</button>',
      onMount: (box, m) => {
        const draw = (full = true) => { if (full) $('[data-items]', box).innerHTML = itemsEditor(st.items); const serv = Number($('[data-serv]', box).value) || 1; const t = roundM(itemsMacros(st.items, 1 / serv)); $('[data-tot]', box).innerHTML = `<div class="upper mb-8">Par portion (${serv})</div>${Nutri.macroLine(t)}`; };
        bindItems($('[data-items]', box), st.items, draw); draw();
        $('[data-serv]', box).addEventListener('input', () => draw(false));
        $('[data-add]', box).addEventListener('click', () => Nutri.picker({ ctx, tabs: ['ing'], onPick: (it) => { st.items.push(it); draw(); } }));
        $('[data-ok]', box).addEventListener('click', () => {
          const f = formValues($('[data-rec-form]', box));
          if (!f.name.trim() || !st.items.length) { toast('Nom et au moins un ingrédient requis', 'error'); return; }
          const data = { name: f.name.trim(), difficulty: f.difficulty || 'Facile', time: Number(f.time) || 0, servings: Number(f.servings) || 1, photo: f.photo, items: st.items, steps: lines(f.steps), sharedWith: f.share || st.sharedWith || [] };
          if (src) Object.assign(src, data); else DB.recipes.push({ id: uid('r'), ...data, source: ctx === 'admin' ? 'elev8' : ctx, ownerId: ownerOf(ctx), hidden: false });
          (f.share || []).forEach((id) => notify(id, `Nouvelle recette partagée : <b>${esc(data.name)}</b>`, '/athlete/nutrition/recipes', 'chef'));
          m.close(); toast(src ? 'Recette mise à jour' : 'Recette créée'); rerender();
        });
      } });
  };

  /* ---------- Sélecteur d'aliments (plan, menus, journal) ---------- */
  Nutri.picker = ({ ctx = ctxOfPath(), tabs = ['ing', 'menu', 'recipe'], title = 'Ajouter un aliment', onPick, cta = 'Ajouter' }) => {
    const st = { tab: tabs[0], q: '', cat: '', sel: null, qty: null };
    const labels = { ing: 'Ingrédients', menu: 'Menus', recipe: 'Recettes' };
    const list = () => {
      const q = st.q.toLowerCase();
      if (st.tab === 'ing') return Nutri.ingredientsFor(ctx).filter((g) => (!q || g.name.toLowerCase().includes(q)) && (!st.cat || g.cat === st.cat)).map((g) => `<button type="button" class="ex-row ${st.sel === g.id ? 'selected' : ''}" data-sel="${g.id}">${FoodTile.ing(g, 'sm')}<div class="grow"><div class="semibold small">${esc(g.name)}</div><div class="xs dim">${fmt.num(g.kcal)} kcal · P ${fmt.num(g.p, 1)} · G ${fmt.num(g.c, 1)} · L ${fmt.num(g.f, 1)} /100 g</div></div></button>`).join('');
      const arr = st.tab === 'menu' ? Nutri.menusFor(ctx) : Nutri.recipesFor(ctx);
      return arr.filter((x) => !q || x.name.toLowerCase().includes(q)).map((x) => { const t = st.tab === 'menu' ? menuMacros(x) : recipeMacros(x); return `<button type="button" class="ex-row ${st.sel === x.id ? 'selected' : ''}" data-sel="${x.id}">${st.tab === 'menu' ? FoodTile.menu(x, 'sm') : FoodTile.recipe(x, 'sm')}<div class="grow"><div class="semibold small">${esc(x.name)}</div><div class="xs dim">${fmt.num(t.kcal)} kcal · P ${fmt.num(t.p)} · G ${fmt.num(t.c)} · L ${fmt.num(t.f)} ${st.tab === 'recipe' ? '/ portion' : ''}</div></div></button>`; }).join('');
    };
    const qtyPanel = () => {
      if (!st.sel) return '<div class="small dim">Sélectionnez un élément pour choisir la quantité.</div>';
      if (st.tab === 'ing') { const g = ingById(st.sel); if (st.qty == null) st.qty = g.portion.g; const m = roundM(ingMacros(g, st.qty)); return `<div class="row wrap gap-8"><b class="small">${esc(g.name)}</b>${inputUnit('qty', st.qty, 'g', { attrs: 'data-qty style="width:110px"' })}${[[`${g.portion.label}`, g.portion.g], ['½ portion', g.portion.g / 2], ['×2', g.portion.g * 2], ['100 g', 100]].map(([l, v]) => `<button type="button" class="chip" data-qv="${v}">${esc(l)}</button>`).join('')}<span class="grow"></span>${Nutri.macroLine(m)}</div>`; }
      if (st.qty == null) st.qty = 1;
      const it = { type: st.tab, id: st.sel, servings: st.qty }; const m = roundM(itemMacros(it));
      return `<div class="row wrap gap-8"><b class="small">${esc(itemLabel(it))}</b>${[0.5, 1, 1.5, 2].map((v) => `<button type="button" class="chip ${st.qty === v ? 'active' : ''}" data-qv="${v}">${fmt.num(v, 1)} portion${v > 1 ? 's' : ''}</button>`).join('')}<span class="grow"></span>${Nutri.macroLine(m)}</div>`;
    };
    openModal({ title, size: 'lg',
      body: `${tabs.length > 1 ? `<div class="seg mb-12" data-tabs>${tabs.map((t) => `<button type="button" class="${t === st.tab ? 'active' : ''}" data-tab="${t}">${labels[t]}</button>`).join('')}</div>` : ''}<div class="row wrap gap-8 mb-12">${searchBox('pq', '', 'Rechercher…', 'data-pq')}<div data-cats></div></div><div class="col gap-6" style="max-height:44vh;overflow:auto" data-list>${list()}</div>`,
      footer: `<div class="grow" data-qty-panel style="min-width:0">${qtyPanel()}</div><button class="btn btn-ghost" data-close>Annuler</button><button class="btn btn-primary" data-ok>${cta}</button>`,
      onMount: (box, m) => {
        const drawCats = () => { $('[data-cats]', box).innerHTML = st.tab === 'ing' ? `<div class="chips sm">${[['', 'Toutes'], ...FOOD_CATS.map((c) => [c, c])].map(([v, l]) => `<button type="button" class="chip ${st.cat === v ? 'active' : ''}" data-cat="${v}">${l}</button>`).join('')}</div>` : ''; };
        const draw = () => { $('[data-list]', box).innerHTML = list() || '<div class="small dim">Aucun résultat</div>'; $('[data-qty-panel]', box).innerHTML = qtyPanel(); };
        drawCats();
        box.addEventListener('click', (e) => {
          const t = e.target.closest('[data-tab],[data-sel],[data-cat],[data-qv]'); if (!t) return;
          if (t.dataset.tab) { st.tab = t.dataset.tab; st.sel = null; st.qty = null; $$('[data-tab]', box).forEach((b) => b.classList.toggle('active', b === t)); drawCats(); draw(); }
          else if (t.dataset.sel) { st.sel = t.dataset.sel; st.qty = null; draw(); }
          else if (t.dataset.cat != null) { st.cat = t.dataset.cat; drawCats(); draw(); }
          else if (t.dataset.qv) { st.qty = Number(t.dataset.qv); $('[data-qty-panel]', box).innerHTML = qtyPanel(); }
        });
        box.addEventListener('input', (e) => { if (e.target.matches('[data-pq]')) { st.q = e.target.value; $('[data-list]', box).innerHTML = list() || '<div class="small dim">Aucun résultat</div>'; } if (e.target.matches('[data-qty]')) { st.qty = Number(e.target.value) || 0; const pnl = $('[data-qty-panel] .macros', box); const g = ingById(st.sel); if (pnl && g) pnl.outerHTML = Nutri.macroLine(roundM(ingMacros(g, st.qty))); } });
        $('[data-ok]', box).addEventListener('click', () => {
          if (!st.sel) { toast('Sélectionnez un élément', 'error'); return; }
          const item = st.tab === 'ing' ? { type: 'ing', id: st.sel, g: st.qty || ingById(st.sel).portion.g } : { type: st.tab, id: st.sel, servings: st.qty || 1 };
          m.close(); onPick(item);
        });
      } });
  };
})();
