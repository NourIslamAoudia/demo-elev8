'use strict';
/* =========================================================
   ELEV8 — Pôle Sport (1/3) : helpers + bibliothèque d'exercices
   ========================================================= */
var Sport = window.Sport || {};
(() => {
  /* ---------- Helpers séances ---------- */
  Sport.groups = (items) => { const out = []; let i = 0; while (i < items.length) { let j = i; while (j < items.length - 1 && items[j].link) j++; out.push([i, j]); i = j + 1; } return out; };
  Sport.labels = (items) => { const lab = []; Sport.groups(items).forEach(([a, b], gi) => { const L = String.fromCharCode(65 + gi); for (let k = a; k <= b; k++) lab[k] = b > a ? `${L}${k - a + 1}` : L; }); return lab; };
  Sport.groupName = (n) => (n === 2 ? 'Bi-set' : n === 3 ? 'Tri-set' : n > 3 ? 'Circuit' : '');
  Sport.tempoStr = (t) => (t && t.some((x) => x !== '' && x != null) ? t.map((x) => (x === '' || x == null ? 0 : x)).join('-') : '');
  Sport.rpe = (n) => RPE_SCALE.find((r) => r[0] === Number(n)) || null;
  Sport.rpeColor = (n) => { n = Number(n); return n <= 3 ? 'var(--s3)' : n <= 5 ? 'var(--s1)' : n <= 7 ? 'var(--s4)' : n <= 8 ? 'var(--s2)' : 'var(--s8)'; };
  Sport.isTimeLabel = (l) => /dur|temps|sec|min/i.test(l || '');
  Sport.unit = (item, field) => {
    const l = (item.labels || DEFAULT_LABELS)[field];
    if (field === 'load') return l === 'Charge' ? 'kg' : '';
    if (field === 'rest') return 's';
    if (field === 'reps') return Sport.isTimeLabel(l) ? (/min/i.test(l) ? 'min' : 's') : '';
    return '';
  };
  Sport.summary = (item, pctAdj = 0) => {
    const l = item.labels || DEFAULT_LABELS; const isW = l.load === 'Charge';
    const load = item.load === '' || item.load == null ? '' : isW && isNum(item.load) ? (Number(item.load) > 0 ? `${fmt.num(Sport.adj(item.load, pctAdj), 1)} kg` : 'PDC') : String(item.load);
    const reps = `${item.reps}${Sport.isTimeLabel(l.reps) ? (/min/i.test(l.reps) ? ' min' : ' s') : /dist/i.test(l.reps) ? ' m' : ''}`;
    return [`${item.sets}×${reps}`, load, item.rest ? `${item.rest} s` : ''].filter(Boolean).join(' · ');
  };
  Sport.adj = (load, p) => (isNum(load) && Number(load) > 0 ? roundTo(Number(load) * (1 + (p || 0) / 100), 0.5) : load);
  Sport.estDuration = (s) => Math.round(sum(s.items, (it) => (Number(it.sets) || 1) * ((it.timer && it.timer.mode !== 'none' ? Number(it.timer.duration) || 30 : (parseInt(it.reps, 10) || 10) * 4) + (Number(it.rest) || 0))) / 60) + 5;
  Sport.muscles = (s) => unique(s.items.flatMap((it) => (exById(it.exId) || { muscles: [] }).muscles));
  Sport.plannedVolume = (s, p = 0) => Math.round(sum(s.items, (it) => (isNum(it.load) && Number(it.load) > 0 ? (Number(it.sets) || 0) * (parseInt(it.reps, 10) || 0) * Sport.adj(it.load, p) : 0)));
  Sport.ownerLabel = (ownerId) => (ownerId === 'elev8' ? 'ELEV8' : coachById(ownerId) ? 'Coach' : athleteById(ownerId) ? 'Perso' : '');
  Sport.sessionCard = (s, { actions = '', badge = '', sub = '' } = {}) => {
    const ex0 = exById((s.items[0] || {}).exId);
    return `<div class="card hover" data-action="session-open" data-id="${s.id}"><div class="card-b"><div class="row gap-12">${Thumb.ex(ex0, { size: 'sm' })}<div class="grow"><div class="row between gap-8"><h3 class="truncate">${esc(s.name)}</h3>${badge}</div><div class="xs dim mt-4">${esc(s.type)} · ${esc(s.objective)} · Intensité ${esc(String(s.intensity).toLowerCase())}</div></div></div>
      <div class="row wrap gap-6 mt-12"><span class="tag">${icon('dumbbell', 12)}&nbsp;${s.items.length} exercices</span><span class="tag">${icon('clock', 12)}&nbsp;~${Sport.estDuration(s)} min</span>${sub}</div>${actions ? `<div class="row wrap gap-6 mt-12" data-stop>${actions}</div>` : ''}</div></div>`;
  };

  /* ---------- Visibilité de la bibliothèque ---------- */
  Sport.exercisesFor = (ctx) => {
    if (ctx === 'admin') return DB.exercises.filter((x) => !x.removed);
    if (ctx === 'coach') { const c = meCoach(); return DB.exercises.filter((x) => !x.removed && !x.hidden && (x.source === 'elev8' || x.ownerId === c.id)); }
    const a = meAthlete(); const c = a.coachId ? coachById(a.coachId) : null;
    const libOk = !c || c.settings.libraryVisible; const customOk = c && c.settings.customVisible;
    return DB.exercises.filter((x) => !x.removed && !x.hidden && ((x.source === 'elev8' && libOk) || (customOk && x.ownerId === c.id) || x.ownerId === a.id));
  };
  const SRC_TABS = {
    coach: [['all', 'Tous'], ['elev8', 'ELEV8'], ['mine', 'Mes exercices']],
    athlete: [['all', 'Tous'], ['elev8', 'ELEV8'], ['coach', 'Mon coach'], ['mine', 'Les miens']],
    admin: [['all', 'Tous'], ['elev8', 'ELEV8'], ['coach', 'Coach']],
  };
  Sport.filterExercises = (list, st, ctx) => {
    const q = (st.q || '').trim().toLowerCase(); const meId = ctx === 'coach' ? S.userId : ctx === 'athlete' ? meAthlete().id : null;
    return list.filter((x) => {
      if (q && !x.name.toLowerCase().includes(q) && !x.muscles.some((m) => m.toLowerCase().includes(q))) return false;
      if (st.sport && x.sport !== st.sport) return false;
      if (st.pattern && x.pattern !== st.pattern) return false;
      if (st.level && x.level !== st.level) return false;
      if (st.muscle && !x.muscles.includes(st.muscle)) return false;
      if (st.src === 'elev8' && x.source !== 'elev8') return false;
      if (st.src === 'mine' && x.ownerId !== meId) return false;
      if (st.src === 'coach' && (ctx === 'admin' ? x.source === 'elev8' : !coachById(x.ownerId))) return false;
      return true;
    });
  };
  Sport.exCard = (x, ctx, { selected = false, action = 'ex-open' } = {}) => {
    const own = x.source !== 'elev8';
    const badge = x.hidden ? '<span class="pill">Masqué</span>' : own ? `<span class="pill ${x.source === 'athlete' ? 'pill-violet' : 'pill-blue'}">${x.source === 'athlete' ? 'Athlète' : 'Coach'}</span>` : '';
    const adminPills = ctx === 'admin' ? `<div class="row gap-4 wrap">${x.media.video || x.media.videoFile ? '<span class="tag">Vidéo</span>' : ''}${x.media.youtube ? '<span class="tag">YouTube</span>' : ''}<span class="tag">App</span></div>` : '';
    return `<button type="button" class="ex-card ${selected ? 'selected' : ''} ${x.hidden ? 'hidden-ex' : ''}" data-action="${action}" data-id="${x.id}" data-ctx="${ctx}"><span class="sel-check">${icon('check', 15)}</span>${Thumb.ex(x)}<div class="col gap-4"><div class="row between gap-6 top"><span class="nm">${esc(x.name)}</span>${badge}</div><span class="meta">${esc(x.pattern)} · ${esc(x.level)}</span><span class="meta truncate">${esc(x.muscles.slice(0, 3).join(', '))}</span>${adminPills}</div></button>`;
  };
  Sport.filtersBar = (st, ctx, key) => `<div class="row wrap gap-8 mb-16">${searchBox('q', st.q, 'Rechercher par nom ou muscle…', 'data-f="q" style="min-width:240px"')}
    ${select('sport', [['', 'Tous les sports'], ...SPORTS], st.sport, 'data-f="sport"', 'sm')}${select('pattern', [['', 'Tous les mouvements'], ...PATTERNS], st.pattern, 'data-f="pattern"', 'sm')}${select('level', [['', 'Tous niveaux'], ...LEVELS], st.level, 'data-f="level"', 'sm')}${select('muscle', [['', 'Tous les muscles'], ...MUSCLES, 'Mollets'], st.muscle, 'data-f="muscle"', 'sm')}
    ${ctx !== 'admin' ? seg(SRC_TABS[ctx], st.src, key, 'src', 'sm') : ''}</div>`;
  Sport.libraryPage = (ctx) => {
    const key = `exlib:${ctx}`; const st = ui(key, { q: '', sport: '', pattern: '', level: '', muscle: '', src: 'all' });
    const base = ctx === 'coach' ? '/coach/exercises' : ctx === 'athlete' ? '/athlete/exercises' : '/admin/exercises';
    const all = Sport.exercisesFor(ctx);
    const list = Sport.filterExercises(all, st, ctx);
    let vis = '';
    if (ctx === 'coach') {
      const c = meCoach();
      vis = `<div class="card card-pad mb-16"><div class="row wrap gap-16"><div class="row gap-12 grow"><span class="li-ic violet">${icon('eye', 18)}</span><div><div class="semibold">Visibilité pour mes athlètes</div><div class="xs dim">Choisissez ce que vos athlètes voient dans leur bibliothèque.</div></div></div><label class="row gap-8 small semibold">${switchEl('libVisible', c.settings.libraryVisible, 'data-vis="libraryVisible"')} Bibliothèque générale ELEV8</label><label class="row gap-8 small semibold">${switchEl('customVisible', c.settings.customVisible, 'data-vis="customVisible"')} Mes exercices personnalisés</label></div></div>`;
    }
    if (ctx === 'athlete') {
      const a = meAthlete(); const c = a.coachId ? coachById(a.coachId) : null;
      if (c && !c.settings.libraryVisible) vis = notice(`Votre coach a choisi de n’afficher que ses propres exercices. Vous pouvez toujours créer les vôtres.`, 'violet', 'eye');
    }
    const html = `${pageHead('Bibliothèque d’exercices', `${fmt.num(all.length)} exercices · vidéos de démonstration, zone du corps travaillée, consignes`, `<a class="btn btn-primary" href="#${base}/new">${icon('plus', 16)} Créer</a>`)}
      ${vis}${Sport.filtersBar(st, ctx, key)}<div class="row between mb-12"><span class="small muted" data-count>${plural(list.length, 'exercice')}</span></div><div class="grid g-auto" data-grid>${list.slice(0, 300).map((x) => Sport.exCard(x, ctx)).join('') || emptyState('search', 'Aucun exercice', 'Essayez d’autres filtres.')}</div>`;
    return { html, title: 'Exercices', mount: (el) => Sport.mountFilters(el, key, ctx, () => Sport.filterExercises(Sport.exercisesFor(ctx), ui(key), ctx), (l) => l.map((x) => Sport.exCard(x, ctx)).join('')) };
  };
  Sport.mountFilters = (el, key, ctx, getList, renderList) => {
    const st = ui(key);
    const refresh = () => { const l = getList(); const g = $('[data-grid]', el); if (g) g.innerHTML = renderList(l) || emptyState('search', 'Aucun résultat', 'Essayez d’autres filtres.'); const c = $('[data-count]', el); if (c) c.textContent = plural(l.length, 'exercice'); };
    el.addEventListener('input', (e) => { const f = e.target.dataset.f; if (f) { st[f] = e.target.value; refresh(); } });
    el.addEventListener('change', (e) => {
      const f = e.target.dataset.f; if (f && e.target.tagName === 'SELECT') { st[f] = e.target.value; refresh(); }
      const vis = e.target.dataset.vis; if (vis) { meCoach().settings[vis] = e.target.checked; toast(e.target.checked ? 'Visible par vos athlètes' : 'Masqué pour vos athlètes'); }
    });
  };

  /* ---------- Fiche exercice (modale) ---------- */
  Sport.exDetailHTML = (x) => `<div class="grid l-3-2 gap-20"><div>${VMock.html(x)}<div class="row wrap gap-6 mt-12">${[x.sport, x.pattern, x.level].map((t) => `<span class="pill lg">${esc(t)}</span>`).join('')}${x.unilateral ? '<span class="pill pill-violet lg">Unilatéral</span>' : ''}</div>${x.desc ? `<p class="mt-12 muted">${esc(x.desc)}</p>` : ''}</div>
    <div class="col gap-16"><div><div class="upper mb-8">Muscles ciblés</div>${BodyMap.svg(x.muscles)}<div class="row wrap gap-6 mt-8">${x.muscles.map((m) => `<span class="tag">${esc(m)}</span>`).join('')}</div></div><div><div class="upper mb-8">Équipement</div><div class="row wrap gap-6">${x.equipment.map((m) => `<span class="tag">${esc(m)}</span>`).join('')}</div></div></div></div>
    <div class="grid g-2 mt-20"><div class="tile soft"><div class="semibold mb-8 t-green">${icon('checkCircle', 16)} Consignes d’exécution</div><ul class="small">${x.cues.map((c) => `<li>${esc(c)}</li>`).join('') || '<li class="dim">—</li>'}</ul></div><div class="tile soft"><div class="semibold mb-8 t-red">${icon('xCircle', 16)} Erreurs fréquentes</div><ul class="small">${x.errors.map((c) => `<li>${esc(c)}</li>`).join('') || '<li class="dim">—</li>'}</ul></div></div>`;
  Actions['ex-open'] = (el) => Sport.openExercise(el.dataset.id, el.dataset.ctx);
  Sport.openExercise = (id, ctx) => {
    const x = exById(id); if (!x) return;
    const meId = ctx === 'coach' ? S.userId : ctx === 'athlete' ? meAthlete().id : null;
    const own = meId && x.ownerId === meId;
    const base = ctx === 'coach' ? '/coach/exercises' : ctx === 'athlete' ? '/athlete/exercises' : '/admin/exercises';
    let footer = '<button class="btn btn-ghost" data-close>Fermer</button>';
    if (own || ctx === 'admin') footer = `${ctx === 'admin' && x.source !== 'elev8' ? `<button class="btn btn-soft-red left" data-action="ex-remove" data-id="${x.id}">${icon('ban', 15)} Retirer (inapproprié)</button>` : ''}${ctx === 'admin' ? `<button class="btn btn-outline" data-action="ex-toggle-hide" data-id="${x.id}">${icon(x.hidden ? 'eye' : 'eyeOff', 15)} ${x.hidden ? 'Afficher' : 'Masquer'}</button><button class="btn btn-outline" data-action="ex-replace-media" data-id="${x.id}">${icon('refresh', 15)} Remplacer la vidéo / l’image</button>` : `<button class="btn btn-soft-red left" data-action="ex-delete" data-id="${x.id}">${icon('trash', 15)} Supprimer</button>`}<a class="btn btn-primary" href="#${base}/${x.id}/edit" data-close>${icon('edit', 15)} Modifier</a>`;
    else if (ctx !== 'admin') footer = `<button class="btn btn-outline" data-action="ex-duplicate" data-id="${x.id}" data-ctx="${ctx}">${icon('copy', 15)} Dupliquer dans mes exercices</button><button class="btn btn-primary" data-close>Fermer</button>`;
    const owner = x.source === 'elev8' ? 'Bibliothèque ELEV8' : x.source === 'coach' ? `Créé par ${fullName(coachById(x.ownerId))}` : `Créé par ${fullName(athleteById(x.ownerId))}`;
    openModal({ title: esc(x.name), sub: owner, size: 'lg', body: Sport.exDetailHTML(x), footer });
  };
  Actions['ex-duplicate'] = (el) => {
    const x = exById(el.dataset.id); const ctx = el.dataset.ctx; const ownerId = ctx === 'coach' ? S.userId : meAthlete().id;
    const src = JSON.parse(JSON.stringify(x)); delete src.id;
    const copy = addCustomExercise({ ...src, name: `${x.name} (perso)`, source: ctx === 'coach' ? 'coach' : 'athlete', ownerId, hidden: false, createdAt: new Date().toISOString() });
    closeAllModals(); toast('Exercice dupliqué dans votre bibliothèque'); go(`/${ctx}/exercises/${copy.id}/edit`);
  };
  Actions['ex-delete'] = async (el) => {
    const x = exById(el.dataset.id);
    const used = DB.sessions.some((s) => s.items.some((it) => it.exId === x.id));
    if (!(await confirmDialog({ title: 'Supprimer cet exercice ?', message: used ? 'Il est utilisé dans des séances : il sera masqué de la bibliothèque mais conservé dans ces séances.' : 'Cette action est définitive.', confirm: 'Supprimer', danger: true }))) return;
    if (used) x.hidden = true; else DB.exercises.splice(DB.exercises.indexOf(x), 1);
    closeAllModals(); toast('Exercice supprimé'); rerender();
  };
  Actions['ex-toggle-hide'] = (el) => { const x = exById(el.dataset.id); x.hidden = !x.hidden; audit(x.hidden ? 'Exercice masqué' : 'Exercice affiché', x.name); closeAllModals(); toast(x.hidden ? 'Exercice masqué pour tous les utilisateurs' : 'Exercice de nouveau visible'); rerender(); };
  Actions['ex-remove'] = async (el) => {
    const x = exById(el.dataset.id);
    const reason = await confirmDialog({ title: 'Retirer ce contenu ?', message: `« ${esc(x.name)} » sera retiré de la plateforme et son auteur sera prévenu.`, confirm: 'Retirer', danger: true, input: { label: 'Motif (envoyé à l’auteur)', placeholder: 'Ex. : exécution dangereuse', required: true } });
    if (!reason) return;
    x.removed = true; audit('Contenu retiré', `Exercice « ${x.name} »`, reason);
    const rp = DB.reports.find((r) => r.targetId === x.id); if (rp) rp.status = 'removed';
    notify(x.ownerId, `Votre exercice <b>${esc(x.name)}</b> a été retiré : ${esc(reason)}`, '', 'ban');
    closeAllModals(); toast('Contenu retiré, auteur notifié'); rerender();
  };
  Actions['ex-replace-media'] = (el) => {
    const x = exById(el.dataset.id);
    openModal({
      title: 'Remplacer la vidéo / l’image', sub: x.name, size: 'md',
      body: `${notice('Le remplacement s’applique partout : <b>les séances et programmes existants ne sont pas modifiés</b>, ils affichent simplement le nouveau média.', 'blue')}<div class="grid g-2 mt-16">${field('Nouvelle image de couverture', dropzone({ name: 'image', label: 'Image', value: x.media.image }))}${field('Nouvelle vidéo d’exécution', dropzone({ name: 'videoFile', accept: 'video/*', label: 'Vidéo', ic: 'video', value: x.media.videoFile }))}</div><div class="mt-12">${field('ou lien YouTube (non répertorié)', input('youtube', x.media.youtube, { placeholder: 'https://youtu.be/…' }))}</div>`,
      footer: '<button class="btn btn-ghost" data-close>Annuler</button><button class="btn btn-primary" data-ok>Enregistrer</button>',
      onMount: (box, m) => $('[data-ok]', box).addEventListener('click', () => {
        const img = $('[name=image]', box).value; const vid = $('[name=videoFile]', box).value; const yt = $('[name=youtube]', box).value.trim();
        Object.assign(x.media, { image: img, videoFile: vid, youtube: yt, video: x.media.video && !vid && !yt });
        audit('Média remplacé', `Exercice « ${x.name} »`); m.close(); closeAllModals(); toast('Média remplacé — séances existantes inchangées'); rerender();
      }),
    });
  };

  /* ---------- Créer / modifier un exercice (même écran pour coach, athlète, admin) ---------- */
  Sport.exerciseForm = (ctx, id) => {
    const x = id ? exById(id) : null;
    const base = ctx === 'coach' ? '/coach/exercises' : ctx === 'athlete' ? '/athlete/exercises' : '/admin/exercises';
    const v = x || { name: '', sport: 'Musculation', pattern: '', level: 'Débutant', muscles: [], equipment: [], unilateral: false, desc: '', cues: [], errors: [], media: { image: '', videoFile: '', youtube: '' } };
    const html = `<a class="back-link" href="#${base}">${icon('arrowL', 16)} Retour à la bibliothèque</a>${pageHead(x ? 'Modifier l’exercice' : 'Nouvel exercice', ctx === 'admin' ? 'Exercice ajouté à la bibliothèque ELEV8 (visible par tous)' : 'La plupart des choix se font en un clic ; « + Custom » ajoute votre propre valeur.')}
      <form data-form="ex-save" class="col gap-16" style="max-width:980px">
        <input type="hidden" name="ctx" value="${ctx}"><input type="hidden" name="id" value="${x ? x.id : ''}">
        ${card('', `${field('Nom du mouvement <span class="req">*</span>', input('name', v.name, { placeholder: 'Ex. : Back Squat, Push-Up…', attrs: 'required' }))}`)}
        ${card('Illustration', `<div class="grid g-3">${field('Image de couverture', dropzone({ name: 'image', label: 'Image de couverture', value: v.media.image }))}${field('Vidéo d’exécution', dropzone({ name: 'videoFile', accept: 'video/*', label: 'Vidéo d’exécution', ic: 'video', value: v.media.videoFile }))}${field('Lien YouTube', `<div class="dropzone compact" style="cursor:default;place-items:stretch;padding:14px;min-height:132px"><div class="col gap-8">${icon('youtube', 22)}<input class="input" name="youtube" value="${esc(v.media.youtube)}" placeholder="Coller l’adresse d’une vidéo" data-yt><span class="xs dim" data-yt-ok></span></div></div>`)}</div><p class="xs dim mt-8">${icon('info', 12)} À la place des trois, un seul suffit.</p>`, { sub: 'Image, vidéo ou lien YouTube' })}
        ${card('Classification', `<div class="col gap-16">${field('Sport', chips('sport', SPORTS, v.sport))}${field('Pattern (type de mouvement)', chips('pattern', PATTERNS, v.pattern))}${field('Niveau', chips('level', LEVELS, v.level))}${field('Muscles ciblés <span class="dim normal">(plusieurs choix)</span>', chips('muscles', MUSCLES, v.muscles, { multi: true }))}${field('Équipement <span class="dim normal">(plusieurs choix)</span>', chips('equipment', EQUIPMENT, v.equipment, { multi: true }))}${toggleRow('unilateral', 'Exercice unilatéral', 'À activer quand l’exercice se fait d’un seul côté à la fois.', v.unilateral)}</div>`)}
        ${card('Description & consignes', `<div class="col gap-16">${field('Description', input('desc', v.desc, { placeholder: 'Une courte phrase pour décrire l’exercice' }))}<div class="grid g-2">${field('Consignes d’exécution', textarea('cues', v.cues.join('\n'), { rows: 5, placeholder: 'Une consigne par ligne\nPoitrine haute\nGenoux vers l’extérieur' }), 'Une consigne par ligne')}${field('Erreurs fréquentes', textarea('errors', v.errors.join('\n'), { rows: 5, placeholder: 'Une erreur par ligne\nDos arrondi\nGenoux vers l’intérieur' }), 'Une erreur par ligne')}</div></div>`)}
        <div class="sticky-bar"><span class="small muted">${x ? 'Les séances qui utilisent cet exercice afficheront la nouvelle version.' : 'L’exercice sera ajouté à votre bibliothèque.'}</span><div class="row"><a class="btn btn-ghost" href="#${base}">Annuler</a><button class="btn btn-primary" type="submit">${icon('check', 16)} ${x ? 'Enregistrer' : 'Créer l’exercice'}</button></div></div>
      </form>`;
    return { html, title: x ? 'Modifier l’exercice' : 'Nouvel exercice', mount: (el) => {
      const yt = $('[data-yt]', el); const ok = $('[data-yt-ok]', el);
      const check = () => { const v2 = yt.value.trim(); ok.innerHTML = !v2 ? '' : ytId(v2) ? `<span class="t-green">${icon('check', 12)} Lien valide</span>` : '<span class="t-red">Lien YouTube non reconnu</span>'; };
      yt.addEventListener('input', check); check();
    } };
  };
  Forms['ex-save'] = async (v) => {
    if (!v.name.trim()) { toast('Le nom du mouvement est obligatoire', 'error'); return; }
    if (!v.image && !v.videoFile && !v.youtube.trim()) {
      if (!(await confirmDialog({ title: 'Aucune illustration', message: 'Ajoutez une image, une vidéo ou un lien YouTube (un seul suffit). Continuer avec une vignette générique ?', confirm: 'Continuer quand même' }))) return;
    }
    const ctx = v.ctx; const ownerId = ctx === 'coach' ? S.userId : ctx === 'athlete' ? meAthlete().id : 'elev8';
    const data = { name: v.name.trim(), sport: v.sport || 'Musculation', pattern: v.pattern || 'Compound', level: v.level || 'Débutant', muscles: v.muscles, equipment: v.equipment.length ? v.equipment : ['Aucun'], unilateral: v.unilateral, desc: v.desc.trim(), cues: lines(v.cues), errors: lines(v.errors) };
    const media = { image: v.image, videoFile: v.videoFile, youtube: v.youtube.trim() };
    if (v.id) { const x = exById(v.id); Object.assign(x, data); x.media = { ...x.media, ...media, video: x.media.video && !media.videoFile && !media.youtube }; toast('Exercice mis à jour'); }
    else { addCustomExercise({ ...data, media: { ...media, video: false }, source: ctx === 'admin' ? 'elev8' : ctx, ownerId, createdAt: new Date().toISOString() }); toast('Exercice créé'); if (ctx === 'admin') audit('Exercice ajouté', data.name); }
    go(ctx === 'coach' ? '/coach/exercises' : ctx === 'athlete' ? '/athlete/exercises' : '/admin/exercises');
  };
})();
