'use strict';
/* =========================================================
   ELEV8 — Pôle Nutrition (2/2) : constructeur de plan, export PDF,
   journal alimentaire, historique, plan personnel, programmes ELEV8
   ========================================================= */
var Nutri = window.Nutri || {};
(() => {
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const DAYS = [['training', 'Jour d’entraînement'], ['rest', 'Jour de repos']];
  const MEALS = ['Petit-déjeuner', 'Déjeuner', 'Collation', 'Dîner'];
  const emptyMeals = () => MEALS.map((name) => ({ name, items: [] }));
  const mealNow = () => { const h = new Date().getHours() + new Date().getMinutes() / 60; return h < 10.5 ? 'Petit-déjeuner' : h < 15 ? 'Déjeuner' : h < 18.5 ? 'Collation' : 'Dîner'; };
  DB.mealPhotos = DB.mealPhotos || {};

  Nutri.stats = (aId, days = 14) => {
    const logs = DB.foodLogs[aId]; const a = athleteById(aId);
    if (!logs) return a.nutri ? { fill: a.nutri.fill, adherence: a.nutri.adherence, last: a.nutri.lastLog } : { fill: 0, adherence: null, last: null };
    let filled = 0; let ok = 0; let withT = 0; let last = null;
    for (let k = 0; k < days; k++) {
      const d = addDays(today0(), -k); const e = logs[ymd(d)] || [];
      if (!e.length) continue; filled++; if (!last) last = d.toISOString();
      const t = Nutri.targetsFor(aId, d);
      if (t && k > 0) { withT++; const tot = Nutri.totals(e); if (Math.abs(tot.kcal - t.kcal) / t.kcal <= 0.12 && tot.p >= t.p * 0.85) ok++; }
    }
    return { fill: pct(filled, days), adherence: withT ? pct(ok, withT) : null, last };
  };

  /* ---------- Constructeur de plan (coach, athlète, admin) ---------- */
  Nutri.planBuilder = (ctx, id, query = {}) => {
    const dkey = `npb:${ctx}:${id || 'new'}`;
    if (!UI[dkey]) {
      const src = id ? nplanById(id) : null;
      if (src) UI[dkey] = clone(src);
      else {
        const a = ctx === 'athlete' ? meAthlete() : query.athlete ? athleteById(query.athlete) : null;
        const profile = a ? NutriCalc.profileOf(a) : { age: 30, sex: 'F', height: 168, weight: 65, activity: 'modere', goal: 'Maintien', prefs: [], allergies: '' };
        UI[dkey] = { id: null, name: a ? `Plan ${profile.goal.toLowerCase()} — ${a.first}` : ctx === 'admin' ? 'Nouveau programme ELEV8' : 'Nouveau plan', athleteId: a ? a.id : null, mode: 'detailed', profile, targets: NutriCalc.suggest(profile), meals: { training: emptyMeals(), rest: emptyMeals() }, notes: '', status: 'draft' };
      }
      UI[`${dkey}:day`] = { day: 'training' };
    }
    const d = UI[dkey]; const dayS = UI[`${dkey}:day`];
    if (!d.meals) d.meals = { training: emptyMeals(), rest: emptyMeals() };
    const base = ctx === 'coach' ? '/coach/nutrition/plans' : ctx === 'athlete' ? '/athlete/nutrition/plan' : '/admin/nutrition';
    const clients = ctx === 'coach' ? DB.athletes.filter((a) => a.coachId === S.userId && a.status !== 'pre') : [];
    const p = d.profile;
    const calc = () => { const pr = { ...p, age: Number(p.age) || 30, weight: Number(p.weight) || 60, height: Number(p.height) || 170 }; const b = NutriCalc.bmr(pr); const t = NutriCalc.tdee(pr); const s = NutriCalc.suggest(pr);
      return `<div class="grid g-2"><div class="tile soft"><div class="xs dim">Métabolisme de base</div><div class="xl bold">${fmt.num(b)} kcal</div><div class="xxs dim">Formule de Mifflin-St Jeor</div></div><div class="tile soft"><div class="xs dim">Dépense journalière estimée</div><div class="xl bold">${fmt.num(t)} kcal</div><div class="xxs dim">× ${NutriCalc.actFactor(p.activity)} (activité)</div></div></div><div class="tile mt-12"><div class="row between"><span class="semibold small">Proposition (${esc(p.goal)})</span><button type="button" class="btn btn-soft btn-xs" data-apply>${icon('sparkles', 13)} Appliquer</button></div><div class="small mt-8">Entraînement : <b>${fmt.num(s.training.kcal)} kcal</b> · P ${s.training.p} g · G ${s.training.c} g · L ${s.training.f} g</div><div class="small mt-4">Repos : <b>${fmt.num(s.rest.kcal)} kcal</b> · P ${s.rest.p} g · G ${s.rest.c} g · L ${s.rest.f} g</div></div>`; };
    const splitOf = (k) => { const t = d.targets[k]; const fm = Nutri.kcalFromMacros(t); const diff = Math.abs(fm - t.kcal) / (t.kcal || 1); return `${Nutri.splitBar(t)}<div class="xs mt-8 ${diff > 0.05 ? 't-amber' : 'dim'}">${diff > 0.05 ? icon('alert', 12) : icon('check', 12)} Les macros représentent ${fmt.num(fm)} kcal${diff > 0.05 ? ` (écart de ${fmt.num(diff * 100)} %)` : ''}</div>`; };
    const targetsCol = (k, l) => `<div class="tile"><div class="semibold mb-12">${l}</div><div class="grid g-2">${field('Calories', inputUnit(`t_${k}_kcal`, d.targets[k].kcal, 'kcal', { attrs: `data-tg="${k}.kcal"` }))}${field('Protéines', inputUnit(`t_${k}_p`, d.targets[k].p, 'g', { attrs: `data-tg="${k}.p"` }))}${field('Glucides', inputUnit(`t_${k}_c`, d.targets[k].c, 'g', { attrs: `data-tg="${k}.c"` }))}${field('Lipides', inputUnit(`t_${k}_f`, d.targets[k].f, 'g', { attrs: `data-tg="${k}.f"` }))}</div><div class="mt-12" data-split="${k}">${splitOf(k)}</div></div>`;
    const mealTotal = (meal) => roundM(itemsMacros(meal.items));
    const dayTotal = (k) => roundM(d.meals[k].reduce((acc, m) => addM(acc, itemsMacros(m.items)), ZERO()));
    const mealsHTML = () => d.meals[dayS.day].map((meal, mi) => `<div class="card"><div class="card-h"><input class="input sm" style="max-width:220px;font-weight:650" value="${esc(meal.name)}" data-mname="${mi}"><div class="row gap-8"><span class="small muted" data-msub="${mi}">${fmt.num(mealTotal(meal).kcal)} kcal</span><button type="button" class="icon-btn danger" data-meal-del="${mi}" title="Supprimer le repas">${icon('trash', 15)}</button></div></div><div class="card-b col gap-8">${meal.items.map((it, ii) => `<div class="row gap-8">${it.type === 'ing' ? FoodTile.ing(ingById(it.id), 'sm') : it.type === 'menu' ? FoodTile.menu(menuById(it.id), 'sm') : FoodTile.recipe(recipeById(it.id), 'sm')}<div class="grow" style="min-width:0"><div class="semibold small truncate">${esc(itemLabel(it))}</div><div class="xs dim" data-iline="${mi}:${ii}">${(() => { const m = roundM(itemMacros(it)); return `${fmt.num(m.kcal)} kcal · P ${fmt.num(m.p)} · G ${fmt.num(m.c)} · L ${fmt.num(m.f)}`; })()}</div></div>${it.type === 'ing' ? inputUnit('q', it.g, 'g', { attrs: `data-mq="${mi}:${ii}" style="width:96px"` }) : inputUnit('q', it.servings || 1, 'port.', { attrs: `data-mq="${mi}:${ii}" step="0.5" style="width:104px"` })}<button type="button" class="icon-btn danger" data-mrm="${mi}:${ii}">${icon('x', 15)}</button></div>`).join('') || '<div class="xs dim">Repas vide</div>'}<div class="row wrap gap-6 mt-4"><button type="button" class="btn btn-outline btn-xs" data-add-item="${mi}" data-kind="ing">${icon('plus', 12)} Aliment</button><button type="button" class="btn btn-outline btn-xs" data-add-item="${mi}" data-kind="menu">${icon('utensils', 12)} Menu</button><button type="button" class="btn btn-outline btn-xs" data-add-item="${mi}" data-kind="recipe">${icon('chef', 12)} Recette</button></div></div></div>`).join('');
    const totalsHTML = () => `<div class="semibold mb-12">Total ${dayS.day === 'training' ? 'jour d’entraînement' : 'jour de repos'}</div>${Nutri.macroBars(dayTotal(dayS.day), d.targets[dayS.day])}`;
    const detailed = d.mode === 'detailed';
    const html = `<a class="back-link" href="#${base}">${icon('arrowL', 16)} Retour</a>${pageHead(id ? 'Plan nutritionnel' : ctx === 'admin' ? 'Nouveau programme nutrition ELEV8' : 'Nouveau plan nutritionnel', 'Profil → métabolisme de base → objectifs (entraînement / repos) → repas.')}
      <div class="col gap-16">
      ${card('1 · Profil nutritionnel', `<div class="grid l-3-2 gap-20"><div class="col gap-12">${ctx === 'coach' ? field('Athlète', select('athlete', [['', '— Modèle (sans athlète) —'], ...clients.map((a) => [a.id, fullName(a)])], d.athleteId || '', 'data-pathlete')) : ''}${field('Nom du plan', input('pname', d.name, { attrs: 'data-pname' }))}
        <div class="grid g-4">${field('Âge', inputUnit('age', p.age, 'ans', { attrs: 'data-pf="age"' }))}${field('Taille', inputUnit('height', p.height, 'cm', { attrs: 'data-pf="height"' }))}${field('Poids', inputUnit('weight', p.weight, 'kg', { attrs: 'data-pf="weight" step="0.1"' }))}${field('Sexe', select('sex', [['F', 'Femme'], ['M', 'Homme']], p.sex, 'data-pfs="sex"'))}</div>
        ${field('Niveau d’activité', select('activity', ACTIVITY.map(([k, l]) => [k, l]), p.activity, 'data-pfs="activity"'))}${field('Objectif', chips('goal', NUTRI_GOALS, p.goal))}${field('Préférences & contraintes', chips('prefs', DIET_TAGS, p.prefs || [], { multi: true }))}${field('Allergies', input('allergies', p.allergies || '', { placeholder: 'Ex. : arachides', attrs: 'data-pf="allergies"' }))}</div><div data-calc>${calc()}</div></div>`)}
      ${card('2 · Objectifs nutritionnels', `<div class="grid g-2">${targetsCol('training', 'Jour d’entraînement')}${targetsCol('rest', 'Jour de repos')}</div>`, { sub: 'Les besoins diffèrent selon le type de journée' })}
      ${card('3 · Organisation', `<div class="row wrap gap-12">${seg([['detailed', 'Repas détaillés'], ['free', 'Libre autour des macros']], d.mode, dkey, 'mode')}<span class="small muted">${detailed ? 'Composez chaque repas à partir de la bibliothèque d’aliments, de menus et de recettes.' : 'L’athlète s’organise librement : seuls les objectifs de calories et de macros sont fixés.'}</span></div>`)}
      ${detailed ? `<div class="grid l-2-1"><div class="col gap-12"><div class="row between wrap gap-8">${seg(DAYS, dayS.day, `${dkey}:day`, 'day')}<div class="row"><button type="button" class="btn btn-ghost btn-sm" data-copy-day>${icon('copy', 15)} Copier vers ${dayS.day === 'training' ? 'le jour de repos' : 'le jour d’entraînement'}</button><button type="button" class="btn btn-outline btn-sm" data-meal-add>${icon('plus', 15)} Repas</button></div></div><div class="col gap-12" data-meals>${mealsHTML()}</div></div><div><div class="card card-pad" style="position:sticky;top:84px" data-daytot>${totalsHTML()}</div></div></div>` : ''}
      ${card(ctx === 'athlete' ? 'Mes notes' : 'Notes pour l’athlète', textarea('notes', d.notes, { rows: 3, placeholder: 'Hydratation, timing autour des séances, alternatives…', attrs: 'data-pnotes' }))}
      </div>
      <div class="sticky-bar"><span class="small muted">${d.athleteId ? `Pour ${esc(fullName(athleteById(d.athleteId)))}` : ctx === 'admin' ? 'Programme proposé aux athlètes sans plan' : 'Modèle réutilisable'}</span><div class="row wrap"><button type="button" class="btn btn-outline" data-pdf>${icon('download', 16)} Exporter en PDF</button><button type="button" class="btn btn-primary" data-save>${icon('check', 16)} ${ctx === 'coach' && d.athleteId ? 'Enregistrer et envoyer' : 'Enregistrer'}</button></div></div>`;
    const mount = (el) => {
      const refreshCalc = () => { $('[data-calc]', el).innerHTML = calc(); };
      const refreshMeals = () => { const m = $('[data-meals]', el); if (m) m.innerHTML = mealsHTML(); const t = $('[data-daytot]', el); if (t) t.innerHTML = totalsHTML(); };
      el.addEventListener('input', (e) => {
        const t = e.target;
        if (t.dataset.pf) { p[t.dataset.pf] = t.dataset.pf === 'allergies' ? t.value : Number(t.value) || 0; refreshCalc(); }
        else if (t.matches('[data-pname]')) d.name = t.value;
        else if (t.matches('[data-pnotes]')) d.notes = t.value;
        else if (t.dataset.tg) { const [k, f] = t.dataset.tg.split('.'); d.targets[k][f] = Number(t.value) || 0; $(`[data-split="${k}"]`, el).innerHTML = splitOf(k); const tt = $('[data-daytot]', el); if (tt) tt.innerHTML = totalsHTML(); }
        else if (t.dataset.mname != null) d.meals[dayS.day][Number(t.dataset.mname)].name = t.value;
        else if (t.dataset.mq) { const [mi, ii] = t.dataset.mq.split(':').map(Number); const it = d.meals[dayS.day][mi].items[ii]; if (it.type === 'ing') it.g = Number(t.value) || 0; else it.servings = Number(t.value) || 0; const m = roundM(itemMacros(it)); $(`[data-iline="${mi}:${ii}"]`, el).textContent = `${fmt.num(m.kcal)} kcal · P ${fmt.num(m.p)} · G ${fmt.num(m.c)} · L ${fmt.num(m.f)}`; $(`[data-msub="${mi}"]`, el).textContent = `${fmt.num(mealTotal(d.meals[dayS.day][mi]).kcal)} kcal`; $('[data-daytot]', el).innerHTML = totalsHTML(); }
      });
      el.addEventListener('change', (e) => {
        const t = e.target;
        if (t.dataset.pfs) { p[t.dataset.pfs] = t.value; refreshCalc(); }
        if (t.type === 'hidden' && t.name === 'goal') { p.goal = t.value; refreshCalc(); }
        if (t.type === 'hidden' && t.name === 'prefs') p.prefs = t.value ? t.value.split('|') : [];
        if (t.matches('[data-pathlete]')) { d.athleteId = t.value || null; if (t.value) { const a = athleteById(t.value); d.profile = NutriCalc.profileOf(a); d.name = `Plan ${d.profile.goal.toLowerCase()} — ${a.first}`; d.targets = NutriCalc.suggest(d.profile); } rerender(); }
      });
      el.addEventListener('click', (e) => {
        const t = e.target.closest('[data-apply],[data-add-item],[data-mrm],[data-meal-add],[data-meal-del],[data-copy-day],[data-save],[data-pdf]'); if (!t) return;
        if (t.dataset.apply != null) { d.targets = NutriCalc.suggest({ ...p, age: Number(p.age), weight: Number(p.weight), height: Number(p.height) }); toast('Objectifs proposés appliqués'); rerender(); return; }
        if (t.dataset.addItem != null) { const mi = Number(t.dataset.addItem); const kind = t.dataset.kind; Nutri.picker({ ctx: ctx === 'admin' ? 'admin' : ctx, tabs: [kind], title: kind === 'menu' ? 'Ajouter un menu complet' : kind === 'recipe' ? 'Ajouter une recette' : 'Ajouter un aliment', onPick: (it) => { d.meals[dayS.day][mi].items.push(it); refreshMeals(); } }); return; }
        if (t.dataset.mrm) { const [mi, ii] = t.dataset.mrm.split(':').map(Number); d.meals[dayS.day][mi].items.splice(ii, 1); refreshMeals(); return; }
        if (t.dataset.mealAdd != null) { d.meals[dayS.day].push({ name: `Repas ${d.meals[dayS.day].length + 1}`, items: [] }); refreshMeals(); return; }
        if (t.dataset.mealDel != null) { d.meals[dayS.day].splice(Number(t.dataset.mealDel), 1); refreshMeals(); return; }
        if (t.dataset.copyDay != null) { const other = dayS.day === 'training' ? 'rest' : 'training'; d.meals[other] = clone(d.meals[dayS.day]); toast('Repas copiés'); return; }
        if (t.dataset.pdf != null) { PDF.open(d.name || 'Plan nutritionnel', Nutri.planPDF(d)); return; }
        if (t.dataset.save != null) {
          if (!d.name.trim()) { toast('Donnez un nom au plan', 'error'); return; }
          const data = clone(d); data.updatedAt = new Date().toISOString();
          if (ctx === 'athlete') { data.athleteId = meAthlete().id; data.ownerId = data.ownerId && data.ownerId !== 'elev8' ? data.ownerId : meAthlete().id; }
          if (ctx === 'admin') { data.ownerId = 'elev8'; data.athleteId = null; data.status = 'elev8'; }
          if (ctx === 'coach') { data.ownerId = S.userId; data.status = data.athleteId ? 'active' : 'template'; }
          if (ctx === 'athlete') data.status = 'active';
          if (data.athleteId && data.status === 'active') DB.nutritionPlans.filter((x) => x.athleteId === data.athleteId && x.status === 'active' && x.id !== id).forEach((x) => { x.status = 'archived'; });
          let saved;
          if (id) { saved = nplanById(id); Object.assign(saved, data); } else { saved = { ...data, id: uid('np'), createdAt: new Date().toISOString() }; DB.nutritionPlans.push(saved); }
          if (ctx === 'coach' && saved.athleteId) notify(saved.athleteId, `<b>${esc(firstName(meCoach()))}</b> vous a envoyé un plan nutritionnel : <b>${esc(saved.name)}</b>`, '/athlete/nutrition/plan', 'apple');
          if (ctx === 'admin') audit(id ? 'Programme nutrition ELEV8 modifié' : 'Programme nutrition ELEV8 créé', saved.name);
          delete UI[dkey]; toast(ctx === 'coach' && saved.athleteId ? `Plan envoyé à ${esc(firstName(athleteById(saved.athleteId)))}` : 'Plan enregistré');
          go(ctx === 'athlete' ? '/athlete/nutrition/plan' : base);
        }
      });
    };
    return { html, title: 'Plan nutritionnel', mount };
  };
  Nutri.planPDF = (pl) => {
    const a = pl.athleteId ? athleteById(pl.athleteId) : null; const owner = pl.ownerId === 'elev8' ? 'ELEV8' : coachById(pl.ownerId) ? fullName(coachById(pl.ownerId)) : a ? fullName(a) : '';
    const tRow = (k, l) => { const t = pl.targets[k]; return `<tr><td><b>${l}</b></td><td>${fmt.num(t.kcal)} kcal</td><td>${t.p} g</td><td>${t.c} g</td><td>${t.f} g</td></tr>`; };
    const day = (k, l) => `<h2>${l}</h2>${(pl.meals[k] || []).map((m) => { const tot = roundM(itemsMacros(m.items)); return `<h3>${esc(m.name)} — ${fmt.num(tot.kcal)} kcal</h3><table><thead><tr><th>Aliment</th><th>Quantité</th><th>kcal</th><th>P</th><th>G</th><th>L</th></tr></thead><tbody>${m.items.map((it) => { const x = roundM(itemMacros(it)); return `<tr><td>${esc(itemLabel(it))}</td><td>${it.type === 'ing' ? `${it.g} g` : `${it.servings || 1} portion(s)`}</td><td>${x.kcal}</td><td>${fmt.num(x.p)}</td><td>${fmt.num(x.c)}</td><td>${fmt.num(x.f)}</td></tr>`; }).join('') || '<tr><td colspan="6" class="muted">—</td></tr>'}</tbody></table>`; }).join('')}`;
    return `${PDF.header('Plan nutritionnel', `${esc(pl.name)}${owner ? ` · par ${esc(owner)}` : ''}`, `<div class="muted">${a ? esc(fullName(a)) : 'Modèle'}<br>${fmt.date(new Date())}</div>`)}
      <h2>Objectifs quotidiens</h2><table><thead><tr><th></th><th>Calories</th><th>Protéines</th><th>Glucides</th><th>Lipides</th></tr></thead><tbody>${tRow('training', 'Jour d’entraînement')}${tRow('rest', 'Jour de repos')}</tbody></table>
      ${pl.mode === 'free' ? '<p class="muted">Organisation libre autour des objectifs de calories et de macronutriments.</p>' : `${day('training', 'Jour d’entraînement')}${day('rest', 'Jour de repos')}`}
      ${pl.notes ? `<h2>Notes</h2><p>${esc(pl.notes)}</p>` : ''}<p class="muted" style="margin-top:24px;font-size:11px">Valeurs nutritionnelles calculées à partir de la bibliothèque ELEV8. Les photos des aliments sont illustratives.</p>`;
  };

  /* ---------- Journal alimentaire (athlète) ---------- */
  Nutri.noPlanBlock = (a) => `<div class="card card-pad"><div class="row gap-16 top wrap"><span class="li-ic amber" style="width:48px;height:48px">${icon('apple', 22)}</span><div class="grow"><h3>Aucun programme nutrition</h3><p class="muted small mt-4">${a.coachId ? 'Votre coach ne vous a pas encore assigné de programme nutrition.' : 'Vous n’avez pas encore de plan nutritionnel.'} Vous pouvez créer votre propre plan (calcul automatique de votre métabolisme de base) ou choisir un programme proposé par ELEV8. Le journal reste utilisable sans objectifs.</p><div class="row wrap gap-8 mt-12"><a class="btn btn-primary btn-sm" href="#/athlete/nutrition/setup">${icon('sparkles', 15)} Créer mon propre plan</a><a class="btn btn-outline btn-sm" href="#/athlete/nutrition/elev8">${icon('layers', 15)} Programmes nutrition ELEV8</a></div></div></div></div>`;
  Nutri.journalPage = (query = {}) => {
    const a = meAthlete(); const key = query.d || ymd(new Date()); const date = parseYmd(key);
    const plan = Nutri.planOf(a.id); const dayType = Nutri.dayType(a.id, date); const tgt = plan ? plan.targets[dayType] : null;
    const entries = Nutri.dayLog(a.id, key); const tot = Nutri.totals(entries);
    const planMeals = plan && plan.mode === 'detailed' ? plan.meals[dayType] : [];
    const mealNames = unique([...(planMeals.length ? planMeals.map((m) => m.name) : MEALS), ...entries.map((e) => e.meal)]);
    const photos = ((DB.mealPhotos[a.id] || {})[key]) || {};
    const isToday = key === ymd(new Date());
    const left = tgt ? tgt.kcal - tot.kcal : 0;
    const head = `<div class="row wrap gap-8 mb-16"><a class="btn btn-outline btn-icon btn-sm" href="#/athlete/nutrition?d=${ymd(addDays(date, -1))}" aria-label="Jour précédent">${icon('chevL', 16)}</a><div class="semibold" style="min-width:180px;text-align:center;text-transform:capitalize">${isToday ? 'Aujourd’hui' : fmt.dateLong(date)}</div><a class="btn btn-outline btn-icon btn-sm ${isToday ? 'disabled' : ''}" href="#/athlete/nutrition?d=${ymd(addDays(date, 1))}" aria-label="Jour suivant">${icon('chevR', 16)}</a>${!isToday ? `<a class="btn btn-ghost btn-sm" href="#/athlete/nutrition">Aujourd’hui</a>` : ''}<span class="grow"></span>${plan ? `<span class="pill lg ${dayType === 'training' ? 'pill-lime' : ''}">${icon(dayType === 'training' ? 'dumbbell' : 'bed', 13)} ${dayType === 'training' ? 'Jour d’entraînement' : 'Jour de repos'}</span>` : ''}</div>`;
    const objectives = plan ? `<div class="card card-pad"><div class="row gap-24 wrap"><div>${Charts.ring(tgt ? (tot.kcal / tgt.kcal) * 100 : 0, { size: 132, stroke: 12, color: left < 0 ? 'var(--s8)' : 'var(--s4)', label: fmt.num(Math.abs(left)), sub: left < 0 ? 'kcal en trop' : 'kcal restantes' })}</div><div class="grow" style="min-width:240px"><div class="row between mb-12"><h3>Objectifs du jour</h3><span class="xs dim">${esc(plan.name)}</span></div>${Nutri.macroBars(tot, tgt)}</div></div></div>` : Nutri.noPlanBlock(a);
    const meals = mealNames.map((mn) => {
      const es = entries.filter((e) => e.meal === mn); const mt = Nutri.totals(es); const planned = planMeals.find((m) => m.name === mn);
      const ph = photos[mn];
      return `<div class="card"><div class="card-h"><h3>${esc(mn)}${ph ? `<span class="food sm" style="width:30px;cursor:pointer" data-action="meal-photo-view" data-meal="${esc(mn)}" data-d="${key}">${mediaPreview(ph)}</span>` : ''}</h3><div class="row gap-8"><span class="small muted">${fmt.num(mt.kcal)} kcal</span><button class="btn btn-primary btn-xs" data-action="journal-add" data-meal="${esc(mn)}" data-d="${key}">${icon('plus', 13)} Ajouter</button></div></div><div class="card-b" style="padding-top:8px;padding-bottom:8px">${es.map((e) => `<div class="li">${e.photo ? `<div class="food sm">${mediaPreview(e.photo)}</div>` : e.emoji ? `<div class="food sm" style="--f1:#f6eee2;--f2:#d6c3a5"><span class="fe">${e.emoji}</span></div>` : `<div class="food sm neutral"><span class="fe">🍽️</span></div>`}<div class="grow" style="min-width:0"><div class="li-t truncate">${esc(e.name)}</div><div class="li-s">${e.g ? `${fmt.num(e.g)} g · ` : e.servings ? `${fmt.num(e.servings, 1)} portion · ` : ''}P ${fmt.num(e.p)} · G ${fmt.num(e.c)} · L ${fmt.num(e.f)}${e.source === 'barcode' ? ' · code-barres' : e.source === 'custom' ? ' · personnalisé' : ''}</div></div><b class="small nowrap">${fmt.num(e.kcal)} kcal</b><button class="icon-btn danger" data-action="journal-del" data-id="${e.id}" data-d="${key}" title="Retirer">${icon('x', 15)}</button></div>`).join('') || `<div class="small dim" style="padding:8px 0">Rien de saisi${planned && planned.items.length ? '' : '.'}</div>`}
        ${planned && planned.items.length && !es.length ? `<div class="tile soft row wrap gap-8 mt-8"><span class="small grow"><b>Prévu par ${a.coachId ? 'votre coach' : 'votre plan'} :</b> ${esc(planned.items.map(itemLabel).join(', '))}</span><button class="btn btn-soft btn-xs" data-action="journal-planned" data-meal="${esc(mn)}" data-d="${key}">${icon('check', 12)} Ajouter tel quel</button></div>` : ''}</div></div>`;
    }).join('');
    return { title: 'Nutrition', html: `${pageHead('Journal alimentaire', 'Recherchez un aliment, scannez un code-barres, ajoutez un menu complet ou un aliment personnalisé.', `<a class="btn btn-outline" href="#/athlete/nutrition/history">${icon('calendar', 16)} Historique</a>`)}${head}<div class="col gap-16">${objectives}<div class="grid g-2">${meals}</div></div>` };
  };
  const addEntries = (aId, key, list) => { const log = Nutri.dayLog(aId, key); list.forEach((x) => log.push(x)); };
  Object.assign(Actions, {
    'journal-del': (el) => { const a = meAthlete(); const log = Nutri.dayLog(a.id, el.dataset.d); const i = log.findIndex((e) => e.id === el.dataset.id); if (i >= 0) log.splice(i, 1); rerender(); },
    'journal-planned': (el) => { const a = meAthlete(); const plan = Nutri.planOf(a.id); const date = parseYmd(el.dataset.d); const meal = plan.meals[Nutri.dayType(a.id, date)].find((m) => m.name === el.dataset.meal); addEntries(a.id, el.dataset.d, meal.items.map((it) => logEntry(meal.name, it, 'plan'))); toast(`${esc(meal.name)} ajouté au journal`); rerender(); },
    'journal-quick': (el) => { const a = meAthlete(); const it = el.dataset.type === 'ing' ? { type: 'ing', id: el.dataset.id, g: ingById(el.dataset.id).portion.g } : { type: el.dataset.type, id: el.dataset.id, servings: 1 }; const meal = mealNow(); addEntries(a.id, ymd(new Date()), [logEntry(meal, it, el.dataset.type === 'menu' ? 'menu' : 'library')]); closeAllModals(); toast(`Ajouté au journal (${meal}) — totaux mis à jour`); rerender(); },
    'meal-photo-view': (el) => { const a = meAthlete(); const id = DB.mealPhotos[a.id][el.dataset.d][el.dataset.meal]; openModal({ title: `Photo — ${esc(el.dataset.meal)}`, size: 'md', body: `<div class="food" style="aspect-ratio:4/3">${mediaPreview(id)}</div><p class="xs dim mt-8">Trace visuelle du repas (n’affecte pas les calories).</p>` }); },
    'journal-add': (el) => {
      const meal = el.dataset.meal; const key = el.dataset.d; const a = meAthlete();
      const opt = (k, ic, t, s) => `<button type="button" class="quick" data-way="${k}"><span class="qi">${icon(ic, 18)}</span><div><div class="semibold">${t}</div><div class="xs dim">${s}</div></div></button>`;
      openModal({ title: `Ajouter au ${meal.toLowerCase()}`, sub: fmt.dateLong(parseYmd(key)), size: 'md', body: `<div class="grid g-2">${opt('search', 'search', 'Rechercher un aliment', 'Bibliothèque illustrée')}${opt('scan', 'barcode', 'Scanner un code-barres', 'Ajout automatique')}${opt('menu', 'utensils', 'Ajouter un menu complet', 'En un geste')}${opt('recipe', 'chef', 'Ajouter une recette', 'Une portion')}${opt('custom', 'edit', 'Aliment personnalisé', 'Si vous ne trouvez rien')}${opt('photo', 'camera', 'Photo du repas', 'Garder une trace visuelle')}</div>`,
        onMount: (box, m) => box.addEventListener('click', (e) => {
          const b = e.target.closest('[data-way]'); if (!b) return; const way = b.dataset.way; m.close();
          const done = (entry) => { addEntries(a.id, key, [entry]); toast(`Ajouté : ${esc(entry.name)} (${fmt.num(entry.kcal)} kcal)`); rerender(); };
          if (way === 'search') Nutri.picker({ ctx: 'athlete', tabs: ['ing'], title: 'Rechercher un aliment', cta: 'Ajouter au journal', onPick: (it) => done(logEntry(meal, it, 'library')) });
          if (way === 'menu') Nutri.picker({ ctx: 'athlete', tabs: ['menu'], title: 'Ajouter un menu complet', cta: 'Ajouter le menu', onPick: (it) => done(logEntry(meal, it, 'menu')) });
          if (way === 'recipe') Nutri.picker({ ctx: 'athlete', tabs: ['recipe'], title: 'Ajouter une recette', cta: 'Ajouter', onPick: (it) => done(logEntry(meal, it, 'recipe')) });
          if (way === 'scan') Nutri.scanner((prod, g) => done({ ...logEntry(meal, { type: 'custom', name: prod.name, ...roundM({ kcal: (prod.kcal * g) / 100, p: (prod.p * g) / 100, c: (prod.c * g) / 100, f: (prod.f * g) / 100 }) }, 'barcode'), g }));
          if (way === 'custom') Nutri.customFood((v) => done({ ...logEntry(meal, { type: 'custom', ...v }, 'custom'), g: v.g || null }));
          if (way === 'photo') Nutri.mealPhoto(a.id, key, meal);
        }) });
    },
  });
  const BARCODES = [
    { code: '3 560 070 818 117', name: 'Yaourt grec nature 2 %', kcal: 75, p: 9.5, c: 4, f: 2, g: 150 },
    { code: '3 017 620 425 035', name: 'Barre protéinée chocolat-noisette', kcal: 362, p: 33, c: 32, f: 12, g: 55 },
    { code: '3 175 680 011 480', name: 'Galettes de riz complet', kcal: 380, p: 8, c: 79, f: 3, g: 18 },
    { code: '3 228 857 000 852', name: 'Thon entier au naturel', kcal: 114, p: 26, c: 0, f: 1, g: 112 },
    { code: '3 263 670 012 345', name: 'Granola peu sucré', kcal: 445, p: 10, c: 60, f: 16, g: 45 },
  ];
  Nutri.scanner = (onDone) => {
    const bars = Array.from({ length: 34 }, () => `<i style="width:${rpick([1, 2, 3])}px"></i>`).join('');
    openModal({ title: 'Scanner un code-barres', size: 'sm', body: `<div class="scan-view" data-scan><div class="scan-frame"><div class="barcode">${bars}</div></div><div class="xs" style="position:absolute;bottom:12px;color:#AEB4C0">Placez le code-barres dans le cadre…</div></div><div class="mt-12" data-res></div><div class="row gap-8 mt-12"><input class="input sm" placeholder="ou saisir le code" data-code><button class="btn btn-outline btn-sm" data-manual>OK</button></div>`,
      footer: '<button class="btn btn-ghost" data-close>Annuler</button><button class="btn btn-primary" data-ok disabled>Ajouter</button>',
      onMount: (box, m) => {
        let prod = null;
        const show = (p) => { prod = p; $('[data-res]', box).innerHTML = `<div class="tile soft"><div class="row gap-8"><span class="li-ic green">${icon('check', 16)}</span><div class="grow"><div class="semibold">${esc(p.name)}</div><div class="xs dim mono">${esc(p.code)}</div></div></div><div class="row gap-8 mt-12"><span class="small">Quantité</span>${inputUnit('g', p.g, 'g', { attrs: 'data-g style="width:110px"' })}</div><div class="mt-8">${Nutri.macroLine(roundM({ kcal: (p.kcal * p.g) / 100, p: (p.p * p.g) / 100, c: (p.c * p.g) / 100, f: (p.f * p.g) / 100 }))}</div></div>`; $('[data-ok]', box).disabled = false; };
        const t = setTimeout(() => { if (!m.closed) { show(rpick(BARCODES)); Sound.beep(1320, 0.08); vibrate(60); } }, 1700);
        m.onClose = () => clearTimeout(t);
        $('[data-manual]', box).addEventListener('click', () => { clearTimeout(t); const c = $('[data-code]', box).value.replace(/\s/g, ''); show(BARCODES.find((b) => b.code.replace(/\s/g, '') === c) || { ...BARCODES[0], code: c || BARCODES[0].code }); });
        $('[data-ok]', box).addEventListener('click', () => { const g = Number(($('[data-g]', box) || {}).value) || prod.g; m.close(); onDone(prod, g); });
      } });
  };
  Nutri.customFood = (onDone) => openModal({ title: 'Aliment personnalisé', size: 'sm', body: `<form data-cf class="col gap-12">${field('Nom', input('name', '', { placeholder: 'Ex. : Sandwich maison' }))}${field('Quantité (facultative)', inputUnit('g', '', 'g'))}<div class="grid g-2">${field('Calories', inputUnit('kcal', '', 'kcal'))}${field('Protéines', inputUnit('p', '', 'g'))}${field('Glucides', inputUnit('c', '', 'g'))}${field('Lipides', inputUnit('f', '', 'g'))}</div></form>`, footer: '<button class="btn btn-ghost" data-close>Annuler</button><button class="btn btn-primary" data-ok>Ajouter</button>',
    onMount: (box, m) => $('[data-ok]', box).addEventListener('click', () => { const v = formValues($('[data-cf]', box)); if (!v.name.trim() || !v.kcal) { toast('Nom et calories requis', 'error'); return; } m.close(); onDone({ name: v.name.trim(), kcal: Number(v.kcal), p: Number(v.p) || 0, c: Number(v.c) || 0, f: Number(v.f) || 0, g: Number(v.g) || null }); }) });
  Nutri.mealPhoto = (aId, key, meal) => openModal({ title: `Photo du ${meal.toLowerCase()}`, size: 'sm', body: `${dropzone({ name: 'ph', label: 'Prendre ou choisir une photo', ic: 'camera', capture: 'environment' })}<p class="xs dim mt-8">La photo sert de trace visuelle : elle ne remplace pas la saisie des aliments.</p>`, footer: '<button class="btn btn-ghost" data-close>Annuler</button><button class="btn btn-primary" data-ok>Enregistrer</button>',
    onMount: (box, m) => $('[data-ok]', box).addEventListener('click', () => { const id = $('[name=ph]', box).value; if (!id) { toast('Choisissez une photo', 'error'); return; } DB.mealPhotos[aId] = DB.mealPhotos[aId] || {}; DB.mealPhotos[aId][key] = DB.mealPhotos[aId][key] || {}; DB.mealPhotos[aId][key][meal] = id; m.close(); toast('Photo ajoutée au repas'); rerender(); }) });

  /* ---------- Historique ---------- */
  Nutri.historyPage = () => {
    const a = meAthlete(); const days = Array.from({ length: 30 }, (_, k) => addDays(today0(), -k));
    const rows = days.map((d) => { const e = (DB.foodLogs[a.id] || {})[ymd(d)] || []; const t = Nutri.targetsFor(a.id, d); const tot = Nutri.totals(e); let st = 'none'; if (e.length && t) st = Math.abs(tot.kcal - t.kcal) / t.kcal <= 0.1 ? 'ok' : tot.kcal > t.kcal ? 'over' : 'under'; else if (e.length) st = 'logged'; return { d, e, t, tot, st }; });
    const kept = (n) => { const r = rows.slice(1, n + 1).filter((x) => x.t && x.e.length); return r.length ? pct(r.filter((x) => x.st === 'ok').length, r.length) : null; };
    const last14 = rows.slice(0, 14).reverse();
    const chart = Charts.bars({ labels: last14.map((x) => fmt.dm(x.d)), series: [{ name: 'Consommé', color: 'var(--s2)', values: last14.map((x) => x.tot.kcal) }, { name: 'Objectif', color: 'var(--s1)', values: last14.map((x) => (x.t ? x.t.kcal : 0)) }], height: 220, yFmt: (v) => fmt.num(v), tipFmt: (v) => `${fmt.num(v)} kcal` });
    const lab = { ok: ['Objectif tenu', 'green'], over: ['Au-dessus', 'red'], under: ['En dessous', 'amber'], logged: ['Saisi', 'blue'], none: ['Non renseigné', ''] };
    return { title: 'Historique nutrition', html: `${pageHead('Historique', 'Vos jours précédents et le respect de vos objectifs.', '', ['/athlete/nutrition', 'Journal'])}
      <div class="grid g-4 mb-16">${kpi({ label: 'Objectifs tenus (7 j)', value: kept(7) == null ? '—' : `${kept(7)} %`, ic: 'target', tone: 'green' })}${kpi({ label: 'Objectifs tenus (30 j)', value: kept(29) == null ? '—' : `${kept(29)} %`, ic: 'calendar', tone: 'blue' })}${kpi({ label: 'Jours renseignés (30 j)', value: `${rows.filter((x) => x.e.length).length}/30`, ic: 'clipboard', tone: 'violet' })}${kpi({ label: 'Moyenne calorique (7 j)', value: `${fmt.num(avg(rows.slice(1, 8).filter((x) => x.e.length), (x) => x.tot.kcal))} kcal`, ic: 'flame', tone: 'amber' })}</div>
      ${card('Calories — 14 derniers jours', chart)}
      <div class="card mt-16"><div class="table-wrap"><table class="table"><thead><tr><th>Jour</th><th class="num">Calories</th><th class="num">Protéines</th><th class="num">Glucides</th><th class="num">Lipides</th><th>Statut</th></tr></thead><tbody>${rows.map((x) => `<tr class="click" data-go="/athlete/nutrition?d=${ymd(x.d)}"><td class="semibold" style="text-transform:capitalize">${isSameDay(x.d, new Date()) ? 'Aujourd’hui' : fmt.dateLong(x.d)}</td><td class="num">${x.e.length ? `${fmt.num(x.tot.kcal)}${x.t ? ` / ${fmt.num(x.t.kcal)}` : ''}` : '—'}</td><td class="num">${x.e.length ? `${fmt.num(x.tot.p)} g` : '—'}</td><td class="num">${x.e.length ? `${fmt.num(x.tot.c)} g` : '—'}</td><td class="num">${x.e.length ? `${fmt.num(x.tot.f)} g` : '—'}</td><td>${pill(lab[x.st][0], lab[x.st][1])}</td></tr>`).join('')}</tbody></table></div></div>` };
  };

  /* ---------- Plan personnel (athlète sans programme) ---------- */
  Nutri.setupPage = () => {
    const a = meAthlete(); const st = ui('nsetup', () => ({ ...NutriCalc.profileOf(a) }));
    const res = () => { const pr = { ...st, age: Number(st.age), weight: Number(st.weight), height: Number(st.height) }; const s = NutriCalc.suggest(pr); return `<div class="grid g-2"><div class="tile soft"><div class="xs dim">Métabolisme de base</div><div class="xl bold">${fmt.num(NutriCalc.bmr(pr))} kcal</div></div><div class="tile soft"><div class="xs dim">Dépense journalière</div><div class="xl bold">${fmt.num(NutriCalc.tdee(pr))} kcal</div></div></div><div class="grid g-2 mt-12">${DAYS.map(([k, l]) => `<div class="tile"><div class="semibold small mb-8">${l}</div><div class="xl bold">${fmt.num(s[k].kcal)} kcal</div><div class="small muted">P ${s[k].p} g · G ${s[k].c} g · L ${s[k].f} g</div><div class="mt-8">${Nutri.splitBar(s[k])}</div></div>`).join('')}</div>`; };
    return { title: 'Créer mon plan', html: `${pageHead('Créer mon plan nutritionnel', 'Renseignez votre profil : l’application calcule votre métabolisme de base et vous propose des objectifs.', '', ['/athlete/nutrition', 'Nutrition'])}
      <div class="grid l-2-1"><div class="col gap-16">${card('Profil physique', `<div class="grid g-2">${field('Âge', inputUnit('age', st.age, 'ans', { attrs: 'data-s="age"' }))}${field('Sexe', select('sex', [['F', 'Femme'], ['M', 'Homme']], st.sex, 'data-ss="sex"'))}${field('Taille', inputUnit('height', st.height, 'cm', { attrs: 'data-s="height"' }))}${field('Poids', inputUnit('weight', st.weight, 'kg', { attrs: 'data-s="weight" step="0.1"' }))}</div><div class="mt-12">${field('Niveau d’activité', select('activity', ACTIVITY.map(([k, l]) => [k, l]), st.activity, 'data-ss="activity"'))}</div>`)}
      ${card('Objectif', chips('goal', NUTRI_GOALS, st.goal))}${card('Préférences & contraintes', `${chips('prefs', DIET_TAGS, st.prefs, { multi: true })}<div class="mt-12">${field('Allergies', input('allergies', st.allergies, { placeholder: 'Ex. : fruits à coque', attrs: 'data-s="allergies"' }))}</div>`)}</div>
      <div><div class="card card-pad" style="position:sticky;top:84px"><h3 class="mb-12">Vos objectifs proposés</h3><div data-res>${res()}</div><button class="btn btn-primary btn-block mt-16" data-action="nsetup-create">${icon('check', 16)} Créer mon plan</button><button class="btn btn-ghost btn-block mt-8" data-action="nsetup-create" data-detail="1">Créer et composer mes repas</button></div></div></div>`,
    mount: (el) => {
      const upd = () => { $('[data-res]', el).innerHTML = res(); };
      el.addEventListener('input', (e) => { const f = e.target.dataset.s; if (f) { st[f] = f === 'allergies' ? e.target.value : Number(e.target.value) || 0; upd(); } });
      el.addEventListener('change', (e) => { const f = e.target.dataset.ss; if (f) { st[f] = e.target.value; upd(); } if (e.target.type === 'hidden' && e.target.name === 'goal') { st.goal = e.target.value; upd(); } if (e.target.type === 'hidden' && e.target.name === 'prefs') st.prefs = e.target.value ? e.target.value.split('|') : []; });
    } };
  };
  Actions['nsetup-create'] = (el) => {
    const a = meAthlete(); const st = ui('nsetup'); const pr = { ...st, age: Number(st.age), weight: Number(st.weight), height: Number(st.height) };
    DB.nutritionPlans.filter((x) => x.athleteId === a.id && x.status === 'active').forEach((x) => { x.status = 'archived'; });
    const p = { id: uid('np'), name: `Mon plan ${pr.goal.toLowerCase()}`, ownerId: a.id, athleteId: a.id, status: 'active', mode: el.dataset.detail ? 'detailed' : 'free', profile: pr, targets: NutriCalc.suggest(pr), meals: { training: emptyMeals(), rest: emptyMeals() }, notes: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    DB.nutritionPlans.push(p); a.prefs = pr.prefs; delete UI.nsetup;
    toast('Votre plan est créé : objectifs du jour mis à jour');
    go(el.dataset.detail ? `/athlete/nutrition/plan/${p.id}/edit` : '/athlete/nutrition');
  };
  Nutri.elev8Page = () => {
    const a = meAthlete(); const list = DB.nutritionPlans.filter((p) => p.status === 'elev8' && !p.hidden); const cur = Nutri.planOf(a.id);
    return { title: 'Programmes nutrition ELEV8', html: `${pageHead('Programmes nutrition ELEV8', 'Des plans prêts à suivre, proposés par l’équipe ELEV8.', '', ['/athlete/nutrition', 'Nutrition'])}${cur ? notice(`Vous suivez actuellement « <b>${esc(cur.name)}</b> ». Choisir un programme ELEV8 le remplacera.`, 'amber', 'info') : ''}
      <div class="grid g-auto-lg mt-16">${list.map((p) => `<div class="card"><div class="card-b col gap-12">${FoodTile.items(p.meals.training.flatMap((m) => m.items), { ai: true })}<div class="row between"><h3>${esc(p.name)}</h3><span class="pill pill-violet">${esc(p.profile.goal)}</span></div><div class="small muted">Entraînement <b>${fmt.num(p.targets.training.kcal)} kcal</b> · repos <b>${fmt.num(p.targets.rest.kcal)} kcal</b></div>${Nutri.splitBar(p.targets.training)}<div class="xs dim">${esc(p.meals.training.map((m) => m.items.map(itemLabel).join(', ')).join(' · '))}</div><div class="row gap-8"><button class="btn btn-outline btn-sm" data-action="nplan-pdf" data-id="${p.id}">${icon('eye', 14)} Aperçu</button><button class="btn btn-primary btn-sm" data-action="nplan-adopt" data-id="${p.id}">${icon('check', 14)} Choisir ce programme</button></div></div></div>`).join('') || emptyState('apple', 'Aucun programme ELEV8 pour l’instant')}</div>` };
  };
  Actions['nplan-pdf'] = (el) => { const p = nplanById(el.dataset.id); PDF.open(p.name, Nutri.planPDF(p)); };
  Actions['nplan-adopt'] = (el) => {
    const a = meAthlete(); const src = nplanById(el.dataset.id);
    DB.nutritionPlans.filter((x) => x.athleteId === a.id && x.status === 'active').forEach((x) => { x.status = 'archived'; });
    DB.nutritionPlans.push({ ...clone(src), id: uid('np'), athleteId: a.id, status: 'active', fromElev8: src.id, createdAt: new Date().toISOString() });
    toast(`Programme « ${esc(src.name)} » activé`); go('/athlete/nutrition');
  };

  /* ---------- Vue coach : suivi de l'assiduité ---------- */
  Nutri.coachOverview = () => {
    const c = meCoach(); const clients = DB.athletes.filter((a) => a.coachId === c.id && a.status !== 'pre');
    const rows = clients.map((a) => ({ a, plan: Nutri.planOf(a.id), st: Nutri.stats(a.id) }));
    const withPlan = rows.filter((r) => r.plan); const active = withPlan.filter((r) => r.st.last && daysBetween(r.st.last, new Date()) <= 3);
    const html = `${pageHead('Suivi nutrition', 'Vue d’ensemble de vos athlètes suivis en nutrition.', `<a class="btn btn-outline" href="#/coach/nutrition/plans">${icon('file', 16)} Plans</a><a class="btn btn-primary" href="#/coach/nutrition/plans/new">${icon('plus', 16)} Nouveau plan</a>`)}
      <div class="grid g-4 mb-16">${kpi({ label: 'Athlètes suivis en nutrition', value: withPlan.length, ic: 'users', tone: 'blue', sub: `sur ${clients.length} clients` })}${kpi({ label: 'Actifs (journal < 3 j)', value: active.length, ic: 'activity', tone: 'green' })}${kpi({ label: 'Programmes nutritionnels en cours', value: withPlan.length, ic: 'apple', tone: 'lime' })}${kpi({ label: 'Remplissage moyen du journal', value: `${fmt.num(avg(withPlan, (r) => r.st.fill))} %`, ic: 'clipboard', tone: 'violet', sub: '14 derniers jours' })}</div>
      <div class="card"><div class="table-wrap"><table class="table"><thead><tr><th>Athlète</th><th>Plan</th><th>Journal rempli (14 j)</th><th>Objectifs macros respectés</th><th>Dernière saisie</th><th></th></tr></thead><tbody>${rows.map(({ a, plan, st }) => `<tr class="click" data-go="/coach/clients/${a.id}/nutrition"><td><div class="person">${avatar(a, 'sm')}<div><div class="nm">${esc(fullName(a))}</div><div class="em">${esc(a.goal)}</div></div></div></td><td>${plan ? `<div class="semibold small">${esc(plan.name)}</div><div class="xs dim">${plan.mode === 'free' ? 'Libre (macros)' : 'Repas détaillés'}</div>` : '<span class="pill pill-amber">Aucun plan</span>'}</td><td style="min-width:160px">${plan ? `<div class="row gap-8"><div class="grow">${progress(st.fill, st.fill >= 70 ? 'var(--s3)' : st.fill >= 40 ? 'var(--s4)' : 'var(--s8)')}</div><span class="small num">${st.fill} %</span></div>` : '—'}</td><td>${plan && st.adherence != null ? `<span class="pill ${st.adherence >= 70 ? 'pill-green' : st.adherence >= 45 ? 'pill-amber' : 'pill-red'}">${st.adherence} %</span>` : '—'}</td><td class="small muted">${st.last ? fmt.rel(st.last) : '—'}</td><td class="right">${plan ? `<a class="btn btn-ghost btn-xs" href="#/coach/nutrition/plans/${plan.id}">Plan</a>` : `<a class="btn btn-soft btn-xs" href="#/coach/nutrition/plans/new?athlete=${a.id}">Créer un plan</a>`}</td></tr>`).join('')}</tbody></table></div></div>`;
    return { title: 'Suivi nutrition', html };
  };
  Nutri.coachPlans = () => {
    const c = meCoach(); const list = DB.nutritionPlans.filter((p) => p.ownerId === c.id && p.status !== 'archived');
    return { title: 'Plans nutritionnels', html: `${pageHead('Plans nutritionnels', 'Plans assignés à vos athlètes et modèles réutilisables (exportables en PDF).', `<a class="btn btn-primary" href="#/coach/nutrition/plans/new">${icon('plus', 16)} Nouveau plan</a>`)}
      <div class="grid g-auto-lg">${list.map((p) => { const a = p.athleteId ? athleteById(p.athleteId) : null; return `<div class="card"><div class="card-b col gap-12"><div class="row between gap-8"><div class="row gap-8">${a ? avatar(a, 'sm') : `<span class="li-ic violet">${icon('file', 16)}</span>`}<div><div class="semibold">${esc(p.name)}</div><div class="xs dim">${a ? esc(fullName(a)) : 'Modèle'} · ${p.mode === 'free' ? 'libre (macros)' : 'repas détaillés'}</div></div></div>${statusPill(p.status === 'template' ? 'draft' : 'active', p.status === 'template' ? 'Modèle' : 'En cours')}</div><div class="grid g-2 small"><div class="tile soft"><div class="xs dim">Entraînement</div><b>${fmt.num(p.targets.training.kcal)} kcal</b></div><div class="tile soft"><div class="xs dim">Repos</div><b>${fmt.num(p.targets.rest.kcal)} kcal</b></div></div>${Nutri.splitBar(p.targets.training)}<div class="row gap-8"><a class="btn btn-outline btn-sm" href="#/coach/nutrition/plans/${p.id}">${icon('edit', 14)} Ouvrir</a><button class="btn btn-ghost btn-sm" data-action="nplan-pdf" data-id="${p.id}">${icon('download', 14)} PDF</button><button class="btn btn-ghost btn-sm" data-action="nplan-dup" data-id="${p.id}">${icon('copy', 14)} Dupliquer</button></div></div></div>`; }).join('') || emptyState('apple', 'Aucun plan', 'Créez votre premier plan nutritionnel.')}</div>` };
  };
  Actions['nplan-dup'] = (el) => { const p = nplanById(el.dataset.id); const c = { ...clone(p), id: uid('np'), name: `${p.name} (copie)`, athleteId: null, status: 'template', createdAt: new Date().toISOString() }; DB.nutritionPlans.push(c); toast('Plan dupliqué en modèle'); go(`/coach/nutrition/plans/${c.id}`); };
})();
