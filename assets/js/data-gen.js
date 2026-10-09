'use strict';
/* =========================================================
   ELEV8 — données relationnelles générées (séances, programmes,
   historiques, nutrition, boutique, CRM, administration)
   ========================================================= */

/* ---------- Lookups ---------- */
const byId = (arr, id) => (arr || []).find((x) => x.id === id);
const coachById = (id) => byId(DB.coaches, id);
const athleteById = (id) => byId(DB.athletes, id);
const exById = (id) => byId(DB.exercises, id);
const sessionById = (id) => byId(DB.sessions, id);
const programById = (id) => byId(DB.programs, id);
const ingById = (id) => byId(DB.ingredients, id);
const menuById = (id) => byId(DB.menus, id);
const recipeById = (id) => byId(DB.recipes, id);
const nplanById = (id) => byId(DB.nutritionPlans, id);
const productById = (id) => byId(DB.shop.products, id);
const listingById = (id) => byId(DB.shop.listings, id);
const adminById = (id) => byId(DB.admins, id);

/* ---------- Nutrition maths (shared) ---------- */
const NutriCalc = {
  actFactor: (k) => (ACTIVITY.find((a) => a[0] === k) || ACTIVITY[2])[2],
  bmr: ({ sex, weight, height, age }) => Math.round(10 * weight + 6.25 * height - 5 * age + (sex === 'F' ? -161 : 5)),
  tdee: (p) => Math.round(NutriCalc.bmr(p) * NutriCalc.actFactor(p.activity)),
  goalAdj: { 'Perte de poids': -0.2, 'Prise de masse': 0.1, Maintien: 0, 'Recomposition corporelle': -0.08 },
  suggest(p) {
    const base = NutriCalc.tdee(p) * (1 + (NutriCalc.goalAdj[p.goal] ?? 0));
    const pk = p.goal === 'Prise de masse' ? 1.8 : 2.0;
    const mk = (kcal, fk) => { const P = Math.round(p.weight * pk); const F = Math.round(p.weight * fk); const C = Math.max(40, Math.round((kcal - P * 4 - F * 9) / 4)); return { kcal: Math.round(kcal / 10) * 10, p: P, c: C, f: F }; };
    return { training: mk(base * 1.06, 0.9), rest: mk(base * 0.92, 1.0) };
  },
  profileOf(a) { return { age: ageFrom(a.birth), sex: a.gender, height: a.height, weight: a.weight, activity: a.activity, goal: NUTRI_GOALS.includes(a.goal) ? a.goal : (a.goal === 'Perte de poids' ? 'Perte de poids' : a.goal === 'Prise de masse' || a.goal === 'Hypertrophie' ? 'Prise de masse' : 'Maintien'), prefs: [...(a.prefs || [])], allergies: a.allergies || '' }; },
};
const ZERO = () => ({ kcal: 0, p: 0, c: 0, f: 0 });
const addM = (a, b, k = 1) => ({ kcal: a.kcal + b.kcal * k, p: a.p + b.p * k, c: a.c + b.c * k, f: a.f + b.f * k });
const roundM = (m) => ({ kcal: Math.round(m.kcal), p: round(m.p, 1), c: round(m.c, 1), f: round(m.f, 1) });
function ingMacros(ing, g) { if (!ing) return ZERO(); const k = (Number(g) || 0) / 100; return { kcal: ing.kcal * k, p: ing.p * k, c: ing.c * k, f: ing.f * k }; }
function itemMacros(it) {
  if (!it) return ZERO();
  if (it.type === 'ing') return ingMacros(ingById(it.id), it.g);
  if (it.type === 'menu') { const m = menuById(it.id); return m ? itemsMacros(m.items, it.servings || 1) : ZERO(); }
  if (it.type === 'recipe') { const r = recipeById(it.id); return r ? itemsMacros(r.items, (it.servings || 1) / (r.servings || 1)) : ZERO(); }
  if (it.type === 'custom') return { kcal: +it.kcal || 0, p: +it.p || 0, c: +it.c || 0, f: +it.f || 0 };
  return ZERO();
}
function itemsMacros(items, k = 1) { return (items || []).reduce((acc, it) => addM(acc, itemMacros(it), k), ZERO()); }
const menuMacros = (m) => roundM(itemsMacros(m.items));
const recipeMacros = (r) => roundM(itemsMacros(r.items, 1 / (r.servings || 1)));
function itemLabel(it) {
  if (it.type === 'ing') { const g = ingById(it.id); return g ? g.name : '?'; }
  if (it.type === 'menu') { const m = menuById(it.id); return m ? m.name : '?'; }
  if (it.type === 'recipe') { const r = recipeById(it.id); return r ? r.name : '?'; }
  return it.name || 'Aliment';
}

/* =========================================================
   Séances
   ========================================================= */
function it(name, sets, reps, load = '', rest = 90, o = {}) {
  return { key: uid('k'), exId: X(name), sets, reps: String(reps), load, rest, tempo: o.tempo || ['', '', '', ''], rir: o.rir ?? '', rpe: o.rpe ?? '', note: o.note || '', labels: { ...DEFAULT_LABELS, ...(o.labels || {}) }, timer: o.timer || { mode: 'none', duration: 30, sets }, link: !!o.link };
}
const DUR = { reps: 'Durée (s)', load: 'Lest' };
const cd = (s, n) => ({ mode: 'countdown', duration: s, sets: n });
function mkSession(id, name, type, objective, intensity, ownerId, items, extra = {}) { return { id, name, type, objective, intensity, ownerId, items, createdAt: D(-rint(20, 200)), ...extra }; }
DB.sessions = [
  mkSession('s1', 'Upper Body A', 'Upper', 'Hypertrophie', 'Modérée', 'c1', [
    it('Développé couché', 4, 8, 60, 120, { tempo: [3, 0, 1, 0], rir: 2, rpe: 7, note: 'Omoplates serrées, pieds ancrés au sol.' }),
    it('Rowing barre', 4, 10, 50, 90, { rir: 2 }),
    it('Développé épaules haltères', 3, 10, 16, 90, { note: 'Alternative : landmine press si gêne à l’épaule.' }),
    it('Tractions supination', 3, 8, 0, 90, { note: 'Si besoin, élastique d’assistance.' }),
    it('Élévations latérales', 3, 15, 8, 60, { link: true }),
    it('Face pull', 3, 15, 15, 60),
    it('Curl marteau', 3, 12, 12, 60),
  ]),
  mkSession('s2', 'Lower Body A', 'Lower', 'Force', 'Élevée', 'c1', [
    it('Back Squat', 5, 5, 70, 180, { tempo: [3, 1, 1, 0], rir: 2, rpe: 8, note: 'Descendre sous la parallèle, remontée explosive.' }),
    it('Soulevé de terre roumain', 4, 8, 60, 120, { tempo: [3, 0, 1, 0], rpe: 7 }),
    it('Split squat bulgare', 3, 10, 14, 90, { note: '10 répétitions par jambe.' }),
    it('Hip thrust', 4, 10, 80, 90, { rpe: 8 }),
    it('Planche (gainage)', 3, 45, '', 45, { labels: DUR, timer: cd(45, 3) }),
  ]),
  mkSession('s3', 'Full Body Métabolique', 'Full Body', 'Endurance', 'Élevée', 'c1', [
    it('Kettlebell swing', 4, 15, 16, 0, { link: true }),
    it('Burpees', 4, 10, 0, 0, { link: true }),
    it('Goblet Squat', 4, 12, 20, 90),
    it('Mountain climbers', 4, 30, '', 30, { labels: DUR, timer: cd(30, 4) }),
    it('Rameur', 4, 250, '2:05', 60, { labels: { reps: 'Distance (m)', load: 'Allure /500 m' } }),
  ]),
  mkSession('s4', 'Mobilité & Récupération', 'Mobilité', 'Endurance', 'Faible', 'c1', [
    it('Chat-vache', 2, 10, '', 30),
    it('Mobilité hanches 90/90', 2, 60, '', 30, { labels: DUR, timer: cd(60, 2) }),
    it('World’s greatest stretch', 2, 6, '', 30, { note: '6 répétitions par côté.' }),
    it('Foam roller thoracique', 1, 90, '', 0, { labels: DUR, timer: cd(90, 1) }),
    it('Dead bug', 3, 10, '', 45),
  ]),
  mkSession('s5', 'Upper Body B', 'Upper', 'Force', 'Élevée', 'c1', [
    it('Développé incliné barre', 4, 6, 55, 150, { rir: 2, rpe: 8 }),
    it('Tractions pronation', 4, 6, 0, 150),
    it('Développé militaire', 3, 8, 32.5, 120),
    it('Rowing haltère unilatéral', 3, 10, 24, 90, { note: '10 répétitions par bras.' }),
    it('Dips', 3, 10, 0, 90, { link: true }),
    it('Curl incliné', 3, 12, 10, 60),
  ]),
  mkSession('s6', 'Lower Body B — Fessiers', 'Lower', 'Hypertrophie', 'Modérée', 'c1', [
    it('Hip thrust', 4, 10, 90, 120, { tempo: [2, 1, 1, 1], rpe: 8 }),
    it('Soulevé de terre sumo', 4, 6, 75, 150, { rir: 2 }),
    it('Fente marchée', 3, 12, 12, 90),
    it('Kickback fessier poulie', 3, 15, 15, 0, { link: true }),
    it('Abduction hanche machine', 3, 20, 40, 60),
    it('Planche latérale', 3, 30, '', 30, { labels: DUR, timer: cd(30, 3) }),
  ]),
  mkSession('s7', 'Cardio Fractionné', 'Cardio', 'Endurance', 'Élevée', 'c1', [
    it('Footing', 1, 10, '6:00/km', 60, { labels: { reps: 'Durée (min)', load: 'Allure' }, timer: { mode: 'free', duration: 600, sets: 1 }, note: 'Échauffement en aisance respiratoire.' }),
    it('Fractionné 30/30', 10, 30, '4:15/km', 30, { labels: { reps: 'Durée (s)', load: 'Allure' }, timer: cd(30, 10) }),
    it('Footing', 1, 8, '6:15/km', 0, { labels: { reps: 'Durée (min)', load: 'Allure' }, timer: { mode: 'free', duration: 480, sets: 1 }, note: 'Retour au calme.' }),
  ]),
  mkSession('s9', 'Force 5×5 — A', 'Full Body', 'Force', 'Élevée', 'c1', [it('Back Squat', 5, 5, 80, 180, { rpe: 8 }), it('Développé couché', 5, 5, 65, 180, { rpe: 8 }), it('Rowing barre', 5, 5, 55, 150)]),
  mkSession('s10', 'Force 5×5 — B', 'Full Body', 'Force', 'Élevée', 'c1', [it('Back Squat', 5, 5, 80, 180, { rpe: 8 }), it('Développé militaire', 5, 5, 37.5, 150), it('Soulevé de terre', 1, 5, 110, 180, { rpe: 9 })]),
  mkSession('s11', 'Hyrox Stations', 'Full Body', 'Endurance', 'Élevée', 'c1', [
    it('Ski erg', 4, 500, '', 60, { labels: { reps: 'Distance (m)', load: 'Allure /500 m' } }),
    it('Poussée de traîneau', 4, 25, 80, 90, { labels: { reps: 'Distance (m)' } }),
    it('Burpees', 4, 10, 0, 60),
    it('Rameur', 4, 500, '', 60, { labels: { reps: 'Distance (m)', load: 'Allure /500 m' } }),
    it('Farmer walk', 4, 40, 24, 60, { labels: { reps: 'Distance (m)' } }),
    it('Wall ball', 4, 20, 6, 60),
  ]),
  mkSession('e1', 'Full Body Débutant A', 'Full Body', 'Hypertrophie', 'Modérée', 'elev8', [it('Goblet Squat', 3, 12, 12, 90), it('Pompes', 3, 10, 0, 90), it('Rowing haltère unilatéral', 3, 12, 12, 90), it('Hip thrust', 3, 12, 40, 90), it('Planche (gainage)', 3, 30, '', 45, { labels: DUR, timer: cd(30, 3) })]),
  mkSession('e2', 'Full Body Débutant B', 'Full Body', 'Hypertrophie', 'Modérée', 'elev8', [it('Fente arrière', 3, 10, 8, 90), it('Développé épaules haltères', 3, 12, 8, 90), it('Tirage vertical', 3, 12, 35, 90), it('Soulevé de terre roumain', 3, 10, 30, 90), it('Dead bug', 3, 10, '', 45)]),
  mkSession('e3', 'Push Hypertrophie', 'Push', 'Hypertrophie', 'Modérée', 'elev8', [it('Développé couché', 4, 8, 60, 120), it('Développé incliné haltères', 3, 10, 22, 90), it('Développé militaire', 3, 10, 35, 90), it('Élévations latérales', 3, 15, 8, 60), it('Extension triceps poulie', 3, 12, 25, 60)]),
  mkSession('e4', 'Pull Hypertrophie', 'Pull', 'Hypertrophie', 'Modérée', 'elev8', [it('Tractions pronation', 4, 8, 0, 120), it('Rowing barre', 4, 10, 50, 90), it('Face pull', 3, 15, 15, 60), it('Curl biceps barre', 3, 12, 25, 60), it('Curl marteau', 3, 12, 12, 60)]),
  mkSession('e5', 'Legs Hypertrophie', 'Lower', 'Hypertrophie', 'Élevée', 'elev8', [it('Back Squat', 4, 8, 80, 150), it('Presse à cuisses', 3, 12, 140, 120), it('Soulevé de terre roumain', 3, 10, 70, 120), it('Leg curl allongé', 3, 12, 35, 60), it('Extensions mollets debout', 4, 15, 60, 60)]),
  mkSession('e6', 'HIIT Cardio 30’', 'Full Body', 'Endurance', 'Élevée', 'elev8', [it('Burpees', 4, 40, '', 20, { labels: DUR, timer: cd(40, 4) }), it('Mountain climbers', 4, 40, '', 20, { labels: DUR, timer: cd(40, 4) }), it('Jumping jacks', 4, 40, '', 20, { labels: DUR, timer: cd(40, 4) }), it('Kettlebell swing', 4, 15, 16, 60), it('Rameur', 3, 500, '', 90, { labels: { reps: 'Distance (m)', load: 'Allure /500 m' } })]),
  mkSession('e7', 'Mobilité quotidienne', 'Mobilité', 'Endurance', 'Faible', 'elev8', [it('Chat-vache', 2, 10, '', 20), it('Mobilité hanches 90/90', 2, 45, '', 20, { labels: DUR, timer: cd(45, 2) }), it('World’s greatest stretch', 2, 5, '', 20), it('Rotation thoracique au bâton', 2, 10, '', 20), it('Squat profond tenu', 2, 45, '', 20, { labels: DUR, timer: cd(45, 2) })]),
  mkSession('e8', 'Course — Fractionné', 'Cardio', 'Endurance', 'Élevée', 'elev8', [it('Footing', 1, 15, '6:00/km', 60, { labels: { reps: 'Durée (min)', load: 'Allure' }, timer: { mode: 'free', duration: 900, sets: 1 } }), it('Fractionné 30/30', 10, 30, '4:30/km', 30, { labels: { reps: 'Durée (s)', load: 'Allure' }, timer: cd(30, 10) }), it('Footing', 1, 10, '6:15/km', 0, { labels: { reps: 'Durée (min)', load: 'Allure' }, timer: { mode: 'free', duration: 600, sets: 1 } })]),
  mkSession('e9', 'Force 5×5 A', 'Full Body', 'Force', 'Élevée', 'elev8', [it('Back Squat', 5, 5, 80, 180), it('Développé couché', 5, 5, 60, 180), it('Rowing barre', 5, 5, 50, 150)]),
  mkSession('e10', 'Force 5×5 B', 'Full Body', 'Force', 'Élevée', 'elev8', [it('Back Squat', 5, 5, 80, 180), it('Développé militaire', 5, 5, 35, 150), it('Soulevé de terre', 1, 5, 100, 180)]),
  mkSession('e11', 'Explosivité & vitesse', 'Full Body', 'Explosivité', 'Élevée', 'elev8', [it('Box jump', 4, 5, '', 90), it('Power clean', 5, 3, 50, 150), it('Sprint 60 m', 6, 1, '', 120, { labels: { reps: 'Sprints', load: 'Temps' } }), it('Lancer de médecine-ball', 4, 6, 5, 90)]),
  mkSession('sa1', 'Séance perso — Bras & abdos', 'Upper', 'Hypertrophie', 'Modérée', 'a1', [it('Curl biceps barre', 3, 12, 20, 60), it('Extension triceps poulie', 3, 12, 20, 60, { link: true }), it('Crunch', 3, 20, '', 45), it('Relevé de jambes suspendu', 3, 10, '', 60)]),
];
DB.sessions.push(mkSession('s12', 'Circuit cardio KR', 'Full Body', 'Endurance', 'Élevée', 'c5', [it('Circuit corde ondulatoire 20/10', 8, 20, '', 10, { labels: DUR, timer: cd(20, 8) }), it('Burpees', 4, 12, '', 45)]));

/* =========================================================
   Programmes
   ========================================================= */
const wk = (n, pat) => Array.from({ length: n }, (_, w) => (typeof pat === 'function' ? pat(w) : pat).slice());
function cycleWeeks(n, cycle, days) { let k = 0; return Array.from({ length: n }, () => { const row = [null, null, null, null, null, null, null]; days.forEach((d) => { row[d] = cycle[k % cycle.length]; k++; }); return row; }); }
DB.programs = [
  { id: 'p1', name: 'Recomposition — 8 semaines', ownerId: 'c1', objective: 'Hypertrophie', level: 'Intermédiaire', status: 'published', desc: 'Programme 5 séances/semaine en Upper/Lower avec une séance de mobilité. Progression des charges toutes les 2 semaines.', weeks: wk(8, ['s1', 's2', null, 's5', 's6', 's4', null]), createdAt: D(-120) },
  { id: 'p2', name: 'Force 5×5 — 12 semaines', ownerId: 'c1', objective: 'Force', level: 'Intermédiaire', status: 'published', desc: 'Méthode 5×5 classique sur 3 séances/semaine, alternance A/B.', weeks: wk(12, (w) => (w % 2 ? ['s10', null, 's9', null, 's10', null, null] : ['s9', null, 's10', null, 's9', null, null])), createdAt: D(-200) },
  { id: 'p3', name: 'Perte de poids — 6 semaines', ownerId: 'c1', objective: 'Sèche', level: 'Débutant', status: 'published', desc: 'Circuits métaboliques, fractionné et mobilité. Idéal pour relancer la dépense énergétique.', weeks: wk(6, ['s3', null, 's7', null, 's3', 's4', null]), createdAt: D(-90) },
  { id: 'p4', name: 'Préparation Hyrox — 10 semaines', ownerId: 'c1', objective: 'Endurance', level: 'Avancé', status: 'draft', desc: 'Brouillon : stations Hyrox + endurance course.', weeks: wk(10, ['s3', 's7', null, 's11', null, 's7', null]), createdAt: D(-6) },
];
const ELEV8_PROGRAMS = [
  ['Prise de masse — Débutant', 'Prise de masse', 'Débutant', 8, ['e1', 'e2'], [0, 2, 4]],
  ['Prise de masse — Intermédiaire', 'Prise de masse', 'Intermédiaire', 12, ['e3', 'e4', 'e5'], [0, 1, 3, 4]],
  ['Sèche express', 'Sèche', 'Intermédiaire', 6, ['e6', 'e1', 'e6', 'e2'], [0, 1, 3, 5]],
  ['Sèche progressive', 'Sèche', 'Débutant', 10, ['e1', 'e6', 'e2'], [0, 2, 4]],
  ['Force fondamentale 5×5', 'Force', 'Intermédiaire', 12, ['e9', 'e10'], [0, 2, 4]],
  ['Powerbuilding', 'Force', 'Avancé', 10, ['e9', 'e3', 'e10', 'e4'], [0, 1, 3, 4]],
  ['Explosivité & vitesse', 'Explosivité', 'Intermédiaire', 8, ['e11', 'e5'], [0, 3]],
  ['Pliométrie athlète', 'Explosivité', 'Avancé', 6, ['e11', 'e8', 'e11'], [0, 2, 4]],
  ['Hypertrophie PPL', 'Hypertrophie', 'Intermédiaire', 12, ['e3', 'e4', 'e5'], [0, 1, 2, 4, 5]],
  ['Hypertrophie Upper/Lower', 'Hypertrophie', 'Débutant', 8, ['e3', 'e5', 'e4', 'e5'], [0, 1, 3, 4]],
  ['Endurance course 10 km', 'Endurance', 'Débutant', 8, ['e8', 'e7', 'e8'], [1, 3, 6]],
  ['Préparation semi-marathon', 'Endurance', 'Intermédiaire', 12, ['e8', 'e6', 'e8', 'e7'], [0, 2, 4, 6]],
  ['Maintien forme 3×/semaine', 'Maintien', 'Débutant', 8, ['e1', 'e2', 'e7'], [0, 2, 4]],
  ['Full body maison', 'Maintien', 'Débutant', 6, ['e1', 'e6'], [1, 4]],
  ['Mobilité quotidienne', 'Mobilité', 'Débutant', 4, ['e7'], [0, 1, 2, 3, 4, 5, 6]],
  ['Souplesse & posture', 'Mobilité', 'Intermédiaire', 6, ['e7', 'e2'], [0, 2, 4]],
  ['Cardio HIIT', 'Cardio', 'Intermédiaire', 6, ['e6', 'e8'], [0, 2, 4]],
];
ELEV8_PROGRAMS.forEach(([name, objective, level, weeks, cycle, days], i) => DB.programs.push({ id: `ep${i + 1}`, name, ownerId: 'elev8', objective, level, status: 'published', desc: `Programme ELEV8 « ${name} » : ${weeks} semaines, ${days.length} séances par semaine, niveau ${level.toLowerCase()}.`, weeks: cycleWeeks(weeks, cycle, days), createdAt: D(-300 + i * 5), hidden: false }));
DB.programs.push({ id: 'p20', name: 'Hypertrophie Glutes 8 semaines', ownerId: 'c4', objective: 'Hypertrophie', level: 'Intermédiaire', status: 'published', desc: 'Programme fessiers de Nadia.', weeks: cycleWeeks(8, ['e5', 'e1'], [0, 3]), createdAt: D(-150) });
DB.programs.push({ id: 'p21', name: 'Perte de poids 12 semaines', ownerId: 'c2', objective: 'Sèche', level: 'Débutant', status: 'published', desc: 'Programme signature de Sophie.', weeks: cycleWeeks(12, ['e6', 'e1', 'e2'], [0, 2, 4]), createdAt: D(-180) });

/* =========================================================
   Affectations, historiques de séances (simulés)
   ========================================================= */
DB.assignments = [];
DB.oneOffs = [];
DB.logs = [];
function programEnd(asg) { const p = programById(asg.programId); return addDays(startDay(asg.start), (p ? p.weeks.length : 1) * 7 - 1); }
function assignmentSchedule(asg) {
  const p = programById(asg.programId); if (!p) return [];
  const start = startDay(asg.start); const out = [];
  p.weeks.forEach((row, w) => row.forEach((sid, d) => { if (sid) out.push({ date: addDays(start, w * 7 + d), week: w, day: d, sessionId: sid, asgId: asg.id }); }));
  return out;
}
const isNum = (v) => v !== '' && v != null && !Number.isNaN(Number(v));
function simulateLog(ath, session, date, weekIdx, asgId) {
  const prog = 1 + 0.02 * weekIdx;
  let plannedSets = 0, doneSets = 0, volume = 0, rpeSum = 0, rpeN = 0, durSec = 0;
  const exercises = session.items.map((item) => {
    const nSets = Number(item.sets) || 1; plannedSets += nSets;
    const target = parseInt(item.reps, 10) || 10;
    const loadNum = isNum(item.load) && Number(item.load) > 0 ? roundTo(Number(item.load) * prog * (ath.strength || 1), 0.5) : 0;
    const skipped = chance(0.04);
    const sets = skipped ? [] : Array.from({ length: nSets }, () => {
      const reps = Math.max(1, target - (chance(0.18) ? rint(1, 2) : 0));
      const load = loadNum ? roundTo(loadNum * (chance(0.1) ? 0.95 : 1), 0.5) : (isNum(item.load) ? 0 : item.load);
      const rpe = clamp(Math.round((Number(item.rpe) || 7) + rnd(-1.2, 1.2)), 3, 10);
      rpeSum += rpe; rpeN++; doneSets++;
      if (typeof load === 'number') volume += reps * load;
      return { reps, load, rpe, rir: item.rir !== '' ? clamp(Number(item.rir) + rint(-1, 1), 0, 5) : null, time: item.timer && item.timer.mode === 'countdown' ? item.timer.duration : null, done: true };
    });
    durSec += nSets * ((item.timer && item.timer.mode !== 'none' ? Number(item.timer.duration) || 30 : target * 4) + (Number(item.rest) || 60));
    const modified = !skipped && sets.some((s) => s.reps !== target || (loadNum && s.load !== loadNum));
    return { key: item.key, exId: item.exId, status: skipped ? 'skipped' : modified ? 'modified' : 'done', sets, planned: { sets: nSets, reps: target, load: loadNum || item.load } };
  });
  const duration = Math.round(durSec * rnd(0.9, 1.15));
  const watch = ath.watch && ath.watch.connected ? {
    hrAvg: rint(118, 142), hrMax: rint(158, 183), kcal: Math.round((duration / 60) * rnd(6.2, 8.8)),
    hrSeries: Array.from({ length: 24 }, (_, k) => Math.round(105 + 35 * Math.sin(k / 2.2) ** 2 + rnd(0, 18))),
    distance: session.type === 'Cardio' ? round(rnd(5.2, 7.4), 2) : null, pace: session.type === 'Cardio' ? `${rint(5, 5)}:${String(rint(10, 45)).padStart(2, '0')}/km` : null,
  } : null;
  const d = new Date(date); d.setHours(chance(0.7) ? 18 : 7, rint(0, 50), 0, 0);
  return { id: uid('log'), athleteId: ath.id, sessionId: session.id, asgId: asgId || null, date: d.toISOString(), duration, exercises, volume: Math.round(volume), completion: pct(doneSets, plannedSets), rpeAvg: rpeN ? round(rpeSum / rpeN, 1) : null, watch, sentToCoach: chance(0.35), notes: '', video: null };
}
function genLogs(ath, asg, { pausedSince = null } = {}) {
  const today = startDay(T0);
  assignmentSchedule(asg).forEach((e) => {
    if (e.date >= today) return;
    if (pausedSince && e.date >= pausedSince) return;
    if (!chance(ath.adh)) return;
    DB.logs.push(simulateLog(ath, sessionById(e.sessionId), e.date, e.week, asg.id));
  });
}
const C1_PROGS = ['p1', 'p2', 'p3'];
DB.athletes.filter((a) => a.coachId === 'c1' && a.status !== 'pre').forEach((a, i) => {
  const pid = a.id === 'a1' ? 'p1' : a.id === 'a3' ? 'p2' : C1_PROGS[i % 3];
  const weeksAgo = a.id === 'a1' ? 3 : a.id === 'a3' ? 5 : rint(1, 5);
  const start = addDays(startOfWeek(T0), -7 * weeksAgo);
  const asg = { id: `as_${a.id}`, programId: pid, athleteId: a.id, start: start.toISOString(), status: a.status === 'paused' ? 'paused' : 'active', loadPct: 0, loadHistory: [], source: 'coach', assignedAt: addDays(start, -2).toISOString() };
  DB.assignments.push(asg);
  genLogs(a, asg, { pausedSince: a.status === 'paused' ? addDays(T0, -18) : null });
});
const asgLea = DB.assignments.find((x) => x.athleteId === 'a1');
asgLea.loadHistory = [{ date: D(-15, 21, 10), pct: 2.5, by: 'Thomas Mercier', note: 'Bonne progression semaine 1' }, { date: D(-6, 20, 40), pct: 1.5, by: 'Thomas Mercier', note: '' }];
asgLea.loadPct = 4;
const asgHugo = { id: 'as_a2', programId: 'ep1', athleteId: 'a2', start: addDays(startOfWeek(T0), -14).toISOString(), status: 'active', loadPct: 0, loadHistory: [], source: 'elev8', assignedAt: D(-15) };
DB.assignments.push(asgHugo);
genLogs(athleteById('a2'), asgHugo);
DB.oneOffs.push({ id: 'oo1', sessionId: 's7', athleteId: 'a1', date: ymd(addDays(T0, 2)), coachId: 'c1', note: 'Séance cardio en plus avant ton week-end.' });
DB.oneOffs.push({ id: 'oo2', sessionId: 's4', athleteId: 'a3', date: ymd(addDays(T0, 1)), coachId: 'c1', note: 'Récupération active.' });
DB.oneOffs.push({ id: 'oo3', sessionId: 's3', athleteId: 'a4', date: ymd(addDays(T0, 3)), coachId: 'c1', note: '' });
DB.logs.push(simulateLog(athleteById('a1'), sessionById('sa1'), addDays(T0, -9), 0, null));
DB.logs.sort((a, b) => new Date(a.date) - new Date(b.date));
DB.athletes.forEach((a) => {
  const ls = DB.logs.filter((l) => l.athleteId === a.id);
  a.lastSession = ls.length ? ls[ls.length - 1].date : a.status === 'active' && a.coachId ? D(-rint(0, 9), 18, 0) : null;
});

/* ---------- Composition corporelle, check-ins, habitudes ---------- */
DB.body = {};
DB.checkins = [];
DB.habits = {};
const HABIT_POOL = [
  { name: 'Hydratation', icon: 'droplet', kind: 'num', target: 2.5, unit: 'L', step: 0.25 },
  { name: 'Sommeil', icon: 'bed', kind: 'num', target: 7, unit: 'h', step: 0.5, source: 'watch' },
  { name: 'Marche', icon: 'footprints', kind: 'num', target: 8000, unit: 'pas', step: 500, source: 'watch' },
  { name: 'Mobilité 10 min', icon: 'activity', kind: 'bool' },
  { name: 'Pas d’alcool', icon: 'ban', kind: 'bool' },
  { name: '5 fruits & légumes', icon: 'apple', kind: 'bool' },
  { name: 'Méditation', icon: 'smile', kind: 'bool' },
];
function genHabit(tpl, adh) {
  const hist = Array.from({ length: 28 }, (_, k) => {
    const date = ymd(addDays(T0, k - 27)); const ok = k === 27 ? chance(0.4) : chance(adh);
    if (tpl.kind === 'bool') return { date, value: ok ? 1 : 0, done: ok };
    const v = tpl.unit === 'pas' ? Math.round((ok ? rnd(8000, 12500) : rnd(3500, 7900)) / 10) * 10 : tpl.unit === 'h' ? round(ok ? rnd(7, 8.6) : rnd(5.2, 6.9), 1) : round(ok ? rnd(2.5, 3.2) : rnd(1.2, 2.4), 2);
    return { date, value: v, done: v >= tpl.target };
  });
  return { id: uid('hb'), ...tpl, history: hist };
}
function genBody(a, weeks = 12) {
  const trend = { 'Perte de poids': -0.42, 'Prise de masse': 0.22, 'Recomposition corporelle': -0.2, Hypertrophie: 0.15, Force: 0.1 }[a.goal] ?? -0.05;
  let w = a.weight - trend * (weeks - 1); let waist = a.gender === 'F' ? rnd(68, 80) : rnd(80, 94); let fat = a.gender === 'F' ? rnd(24, 31) : rnd(14, 22);
  return Array.from({ length: weeks }, (_, k) => {
    const row = { date: ymd(addDays(T0, -7 * (weeks - 1 - k) - 1)), weight: round(w, 1), waist: round(waist, 1), fat: round(fat, 1) };
    w += trend + rnd(-0.25, 0.25); waist += trend * 0.45 + rnd(-0.2, 0.2); fat += (trend < 0 ? -0.18 : 0.04) + rnd(-0.12, 0.12);
    return row;
  });
}
const CHECKIN_COMMENTS = ['Bonne semaine, je me sens plus fort·e sur les squats.', 'Un peu fatigué·e, gros rush au travail.', 'Sommeil compliqué cette semaine.', 'Très motivé·e, j’ai respecté le plan nutrition.', 'Petite douleur au genou après la séance jambes.', 'Semaine correcte, deux repas au restaurant.', 'J’ai raté une séance mais rattrapé le dimanche.', ''];
DB.athletes.filter((a) => (a.coachId === 'c1' && a.status !== 'pre') || a.id === 'a2').forEach((a) => {
  DB.body[a.id] = genBody(a);
  const pool = a.id === 'a1' ? HABIT_POOL.slice(0, 4) : [HABIT_POOL[0], ...HABIT_POOL.slice(3).filter(() => chance(0.45))].slice(0, 3);
  DB.habits[a.id] = pool.map((t) => genHabit(t, a.adh));
  for (let k = 1; k <= 8; k++) {
    const monday = addDays(startOfWeek(T0), -7 * k);
    const late = a.id !== 'a1' && k === 1 && (a.status === 'paused' || chance(0.12));
    if (late || (k > 1 && !chance(Math.min(0.98, a.adh + 0.1)))) continue;
    DB.checkins.push({ id: uid('ci'), athleteId: a.id, week: ymd(monday), date: atTime(addDays(monday, 6), `${rint(17, 21)}:${rint(10, 59)}`).toISOString(), fatigue: rint(1, 5), sleep: rint(2, 5), motivation: rint(3, 5), adherence: rint(60, 100), stress: rint(1, 4), pain: chance(0.15) ? 'Genou droit, légère gêne' : '', comment: rpick(CHECKIN_COMMENTS) });
  }
});
DB.body.a1 = [66.8, 66.5, 66.3, 65.9, 65.7, 65.2, 65.0, 64.6, 64.3, 64.0, 63.7, 63.4].map((w, k) => ({ date: ymd(addDays(T0, -7 * (11 - k) - 1)), weight: w, waist: round(74.2 - k * 0.38, 1), fat: round(27.4 - k * 0.3, 1) }));
DB.checkins.filter((c) => c.athleteId === 'a1').forEach((c, k) => Object.assign(c, { fatigue: [2, 3, 2, 2, 3, 2, 2, 1][k] || 2, sleep: 4, motivation: 5, adherence: [95, 90, 100, 85, 92, 100, 96, 94][k] || 90, comment: k === 0 ? 'Super semaine ! Les hip thrusts passent beaucoup mieux, j’ai gagné en stabilité.' : c.comment }));
DB.athletes.filter((a) => a.coachId && a.coachId !== 'c1').forEach((a) => { a.lastSession = a.status === 'active' ? D(-rint(0, 12), 18, 0) : D(-rint(20, 60)); });

/* =========================================================
   Plans nutritionnels
   ========================================================= */
const ing = (name, g) => ({ type: 'ing', id: I(name), g });
const menuRef = (name, servings = 1) => ({ type: 'menu', id: DB.menus.find((m) => m.name === name).id, servings });
DB.nutritionPlans = [
  { id: 'np1', name: 'Plan recomposition — Léa', ownerId: 'c1', athleteId: 'a1', status: 'active', mode: 'detailed', profile: NutriCalc.profileOf(athleteById('a1')), notes: 'Sans lactose : skyr et fromage blanc OK en petite quantité (testé). Hydratation ≥ 2,5 L.', createdAt: D(-40), updatedAt: D(-5),
    targets: { training: { kcal: 2050, p: 130, c: 230, f: 66 }, rest: { kcal: 1800, p: 130, c: 170, f: 66 } },
    meals: {
      training: [{ name: 'Petit-déjeuner', items: [menuRef('Petit-déjeuner protéiné')] }, { name: 'Déjeuner', items: [ing('Blanc de poulet', 140), ing('Riz basmati cuit', 180), ing('Brocoli', 150), ing('Huile d’olive', 10)] }, { name: 'Collation', items: [ing('Skyr nature', 170), ing('Banane', 120), ing('Amandes', 20)] }, { name: 'Dîner', items: [ing('Saumon', 120), ing('Patate douce cuite', 200), ing('Haricots verts', 150), ing('Huile d’olive', 5)] }],
      rest: [{ name: 'Petit-déjeuner', items: [menuRef('Omelette épinards & champignons')] }, { name: 'Déjeuner', items: [ing('Escalope de dinde', 140), ing('Quinoa cuit', 120), ing('Courgette', 200), ing('Huile d’olive', 10)] }, { name: 'Collation', items: [ing('Fromage blanc 0 %', 200), ing('Myrtilles', 100)] }, { name: 'Dîner', items: [ing('Saumon', 120), ing('Épinards', 150), ing('Pomme de terre cuite', 150), ing('Huile d’olive', 5)] }],
    } },
  { id: 'npT1', name: 'Plan Sèche 6 semaines (modèle boutique)', ownerId: 'c1', athleteId: null, status: 'template', mode: 'detailed', profile: { age: 30, sex: 'F', height: 168, weight: 65, activity: 'modere', goal: 'Perte de poids', prefs: [], allergies: '' }, notes: 'Modèle vendu en boutique.', createdAt: D(-70), updatedAt: D(-30),
    targets: { training: { kcal: 1750, p: 130, c: 180, f: 55 }, rest: { kcal: 1550, p: 130, c: 130, f: 55 } },
    meals: { training: [{ name: 'Petit-déjeuner', items: [menuRef('Fromage blanc & fruits rouges')] }, { name: 'Déjeuner', items: [menuRef('Déjeuner léger saumon-quinoa')] }, { name: 'Dîner', items: [menuRef('Dîner dinde, patate douce & haricots')] }], rest: [{ name: 'Petit-déjeuner', items: [menuRef('Omelette épinards & champignons')] }, { name: 'Déjeuner', items: [menuRef('Crevettes sautées & riz')] }, { name: 'Dîner', items: [menuRef('Salade tomate-mozzarella')] }] } },
];
DB.athletes.filter((a) => a.coachId === 'c1' && a.status === 'active' && !['a1', 'a3'].includes(a.id)).forEach((a, i) => {
  if (i % 4 === 3) return;
  const prof = NutriCalc.profileOf(a);
  DB.nutritionPlans.push({ id: `np_${a.id}`, name: `Plan ${prof.goal.toLowerCase()} — ${a.first}`, ownerId: 'c1', athleteId: a.id, status: 'active', mode: i % 2 ? 'free' : 'detailed', profile: prof, notes: '', createdAt: D(-rint(10, 60)), updatedAt: D(-rint(1, 9)), targets: NutriCalc.suggest(prof),
    meals: i % 2 ? { training: [], rest: [] } : { training: [{ name: 'Petit-déjeuner', items: [menuRef('Pancakes protéinés')] }, { name: 'Déjeuner', items: [menuRef('Bowl poulet, riz & brocoli')] }, { name: 'Collation', items: [menuRef('Shake post-training')] }, { name: 'Dîner', items: [menuRef('Steak, pommes de terre & haricots')] }], rest: [{ name: 'Petit-déjeuner', items: [menuRef('Petit-déjeuner protéiné')] }, { name: 'Déjeuner', items: [menuRef('Tofu sauté & quinoa')] }, { name: 'Dîner', items: [menuRef('Crevettes sautées & riz')] }] } });
  a.nutri = { fill: rint(45, 100), adherence: rint(55, 98), lastLog: D(-rint(0, 4), 13, 0) };
});
const ENP = [
  ['enp1', 'Perte de poids douce', 'Perte de poids', { kcal: 1650, p: 120, c: 165, f: 55 }, { kcal: 1500, p: 120, c: 125, f: 55 }, ['Fromage blanc & fruits rouges', 'Déjeuner léger saumon-quinoa', 'Dîner dinde, patate douce & haricots']],
  ['enp2', 'Prise de masse propre', 'Prise de masse', { kcal: 2850, p: 160, c: 370, f: 80 }, { kcal: 2600, p: 160, c: 310, f: 80 }, ['Pancakes protéinés', 'Bowl poulet, riz & brocoli', 'Shake post-training', 'Steak, pommes de terre & haricots']],
  ['enp3', 'Maintien équilibré', 'Maintien', { kcal: 2250, p: 130, c: 265, f: 72 }, { kcal: 2050, p: 130, c: 215, f: 72 }, ['Petit-déjeuner protéiné', 'Bowl végan lentilles & patate douce', 'Salade tomate-mozzarella']],
  ['enp4', 'Végétarien sportif', 'Recomposition corporelle', { kcal: 2150, p: 120, c: 250, f: 70 }, { kcal: 1950, p: 120, c: 200, f: 70 }, ['Omelette épinards & champignons', 'Tofu sauté & quinoa', 'Fromage blanc & fruits rouges', 'Salade tomate-mozzarella']],
];
ENP.forEach(([id, name, goal, tr, rs, menus]) => {
  const meals = menus.map((m, k) => ({ name: ['Petit-déjeuner', 'Déjeuner', 'Collation', 'Dîner'][menus.length === 3 && k === 2 ? 3 : k], items: [menuRef(m)] }));
  DB.nutritionPlans.push({ id, name, ownerId: 'elev8', athleteId: null, status: 'elev8', mode: 'detailed', profile: { goal }, notes: 'Programme nutritionnel proposé par ELEV8.', createdAt: D(-30), updatedAt: D(-30), targets: { training: tr, rest: rs }, meals: { training: meals, rest: meals }, hidden: false });
});

/* ---------- Journal alimentaire (Léa : 30 jours) ---------- */
DB.foodLogs = {};
function scheduledSessionOn(athleteId, date) {
  const d = ymd(date);
  for (const asg of DB.assignments.filter((a) => a.athleteId === athleteId && a.status !== 'ended')) {
    const e = assignmentSchedule(asg).find((x) => ymd(x.date) === d);
    if (e) return e;
  }
  const oo = DB.oneOffs.find((o) => o.athleteId === athleteId && o.date === d);
  return oo ? { date: parseYmd(oo.date), sessionId: oo.sessionId, oneOff: oo.id } : null;
}
function logEntry(meal, it, source = 'library') {
  const m = roundM(itemMacros(it));
  const ref = it.type === 'ing' ? ingById(it.id) : it.type === 'menu' ? menuById(it.id) : null;
  return { id: uid('fl'), meal, name: itemLabel(it), g: it.g || null, servings: it.servings || null, ...m, source, refType: it.type, refId: it.id, emoji: ref && ref.emoji ? ref.emoji : '' };
}
(function genFoodLogs() {
  const plan = nplanById('np1'); const out = {};
  for (let k = 30; k >= 0; k--) {
    const date = addDays(T0, -k); const key = ymd(date);
    const dayType = scheduledSessionOn('a1', date) ? 'training' : 'rest';
    const meals = plan.meals[dayType];
    const entries = [];
    meals.forEach((meal, mi) => {
      if (k === 0 && mi > 1) return;
      if (k > 0 && chance(0.08)) return;
      meal.items.forEach((x) => { const v = x.type === 'ing' ? { ...x, g: Math.round(x.g * rnd(0.85, 1.15)) } : x; entries.push(logEntry(meal.name, v)); });
    });
    if (k > 0 && chance(0.25)) entries.push(logEntry('Collation', { type: 'ing', id: I('Chocolat noir 85 %'), g: 20 }));
    out[key] = entries;
  }
  out[ymd(T0)].push({ ...logEntry('Petit-déjeuner', { type: 'custom', name: 'Café allongé', kcal: 2, p: 0.1, c: 0, f: 0 }, 'custom') });
  DB.foodLogs.a1 = out;
  DB.foodLogs.a3 = { [ymd(T0)]: [logEntry('Petit-déjeuner', { type: 'menu', id: DB.menus.find((m) => m.name === 'Pancakes protéinés').id, servings: 1 })] };
})();

/* =========================================================
   Boutique
   ========================================================= */
DB.shop = {
  listings: [
    { id: 'l1', coachId: 'c1', kind: 'sport', refId: 'p1', title: 'Programme Recomposition 8 semaines', desc: '40 séances Upper/Lower + mobilité, vidéos de chaque exercice, progression des charges intégrée. Accès immédiat après achat.', price: 49, cover: '', emoji: '🔥', t1: '#0F1115', t2: '#2a78d6', published: true, sales: 23, createdAt: D(-80), hidden: false },
    { id: 'l2', coachId: 'c1', kind: 'nutrition', refId: 'npT1', title: 'Plan nutrition Sèche 6 semaines', desc: 'Jours d’entraînement et de repos, menus détaillés et liste de courses. Calories et macros calculées.', price: 29, cover: '', emoji: '🥗', t1: '#0f5132', t2: '#1baf7a', published: true, sales: 15, createdAt: D(-60), hidden: false },
    { id: 'l3', coachId: 'c1', kind: 'sport', refId: 'p2', title: 'Force 5×5 — 12 semaines', desc: 'Le grand classique pour gagner en force sur les mouvements de base.', price: 59, cover: '', emoji: '🏋️', t1: '#3b1d0c', t2: '#eb6834', published: false, sales: 4, createdAt: D(-150), hidden: false },
    { id: 'l4', coachId: 'c2', kind: 'sport', refId: 'p21', title: 'Programme Perte de poids 12 semaines', desc: 'Le programme signature de Sophie.', price: 59, cover: '', emoji: '⚡', t1: '#4a2a00', t2: '#eda100', published: true, sales: 61, createdAt: D(-170), hidden: false },
    { id: 'l5', coachId: 'c4', kind: 'sport', refId: 'p20', title: 'Hypertrophie Glutes 8 semaines', desc: 'Programme fessiers.', price: 45, cover: '', emoji: '🍑', t1: '#4a1230', t2: '#e87ba4', published: true, sales: 88, createdAt: D(-140), hidden: false },
  ],
  products: [
    { id: 'pr1', coachId: 'c1', name: 'T-shirt Mercier Performance', desc: 'T-shirt technique respirant, coupe athlétique. 100 % polyester recyclé.', price: 29, emoji: '👕', photos: [], variants: { name: 'Taille', options: [{ label: 'S', stock: 4 }, { label: 'M', stock: 0 }, { label: 'L', stock: 7 }, { label: 'XL', stock: 2 }] }, stock: null, published: true, hidden: false, createdAt: D(-100) },
    { id: 'pr2', coachId: 'c1', name: 'Boisson protéinée isolate 1 kg', desc: 'Protéine de lactosérum isolate, 27 g de protéines par dose. Sans sucres ajoutés.', price: 39.9, emoji: '🥤', photos: [], variants: { name: 'Parfum', options: [{ label: 'Vanille', stock: 0 }, { label: 'Chocolat', stock: 12 }, { label: 'Fraise', stock: 5 }] }, stock: null, published: true, hidden: false, createdAt: D(-90) },
    { id: 'pr3', coachId: 'c1', name: 'Oméga-3 — 90 gélules', desc: 'Huile de poisson concentrée EPA/DHA, 3 gélules par jour.', price: 19.9, emoji: '💊', photos: [], variants: null, stock: 25, published: true, hidden: false, createdAt: D(-75) },
    { id: 'pr4', coachId: 'c1', name: 'Shaker 700 ml', desc: 'Shaker anti-fuite avec grille de mélange.', price: 12, emoji: '🧋', photos: [], variants: null, stock: 0, published: true, hidden: false, createdAt: D(-75) },
    { id: 'pr5', coachId: 'c1', name: 'Élastiques de résistance (x3)', desc: 'Lot de 3 bandes (légère, moyenne, forte) + pochette.', price: 24, emoji: '🎗️', photos: [], variants: null, stock: 9, published: true, hidden: false, createdAt: D(-40) },
    { id: 'pr6', coachId: 'c2', name: 'Legging SG Coaching', desc: 'Legging gainant taille haute.', price: 45, emoji: '🩱', photos: [], variants: { name: 'Taille', options: [{ label: 'XS', stock: 3 }, { label: 'S', stock: 8 }, { label: 'M', stock: 6 }] }, stock: null, published: true, hidden: false, createdAt: D(-120) },
    { id: 'pr7', coachId: 'c7', name: 'Ceinture de force cuir', desc: 'Ceinture 10 mm, boucle à levier.', price: 69, emoji: '🥋', photos: [], variants: null, stock: 3, published: true, hidden: false, createdAt: D(-200) },
    { id: 'pr8', coachId: 'c9', name: 'Thé « brûle-graisse » 100 % garanti', desc: 'Signalé : allégations santé non conformes.', price: 34, emoji: '🍵', photos: [], variants: null, stock: 50, published: true, hidden: false, flagged: true, createdAt: D(-9) },
  ],
  shipping: {
    c1: { zones: ['France', 'Belgique'], mode: 'fixed', fee: 4.9, freeAbove: 60, freeEnabled: true },
    c2: { zones: ['France'], mode: 'fixed', fee: 5.9, freeAbove: 80, freeEnabled: true },
    c7: { zones: ['France', 'Belgique', 'Suisse'], mode: 'fixed', fee: 6.5, freeAbove: 0, freeEnabled: false },
  },
  orders: [],
  digitalSales: [],
};
const addr = (a) => ({ name: fullName(a), line1: `${rint(2, 140)} ${rpick(['rue Garibaldi', 'avenue Jean Jaurès', 'cours Lafayette', 'rue Mercière', 'quai Saint-Antoine', 'rue de Créqui'])}`, zip: rpick(['69001', '69003', '69006', '69007', '69100']), city: rpick(['Lyon', 'Villeurbanne']), country: 'France' });
function mkOrder(n, coachId, athleteId, daysAgo, items, status, extra = {}) {
  const a = athleteById(athleteId); const sub = sum(items, (x) => x.qty * x.price); const ship = DB.shop.shipping[coachId] || { fee: 0, freeAbove: 0, freeEnabled: false };
  const shipping = ship.freeEnabled && sub >= ship.freeAbove ? 0 : ship.fee;
  return { id: `o${n}`, number: `#${n}`, coachId, athleteId, date: D(-daysAgo, rint(8, 21), rint(0, 59)), items, subtotal: round(sub, 2), shipping, total: round(sub + shipping, 2), address: a.address || addr(a), status, tracking: status === 'shipped' ? `6A${rint(10000000, 99999999)}` : '', shippedAt: status === 'shipped' ? D(-daysAgo + 1, 17, 30) : null, invoice: `FA-2026-${n}`, ...extra };
}
DB.shop.orders = [
  mkOrder(1036, 'c1', 'a8', 12, [{ productId: 'pr2', variant: 'Chocolat', qty: 1, price: 39.9 }, { productId: 'pr4', variant: null, qty: 1, price: 12 }], 'shipped'),
  mkOrder(1038, 'c1', 'a1', 20, [{ productId: 'pr1', variant: 'M', qty: 1, price: 29 }], 'shipped'),
  mkOrder(1039, 'c1', 'a7', 6, [{ productId: 'pr3', variant: null, qty: 2, price: 19.9 }], 'shipped'),
  mkOrder(1040, 'c1', 'a4', 2, [{ productId: 'pr2', variant: 'Chocolat', qty: 2, price: 39.9 }], 'pending'),
  mkOrder(1041, 'c1', 'a5', 1, [{ productId: 'pr1', variant: 'L', qty: 1, price: 29 }, { productId: 'pr3', variant: null, qty: 1, price: 19.9 }], 'pending'),
  mkOrder(1042, 'c1', 'a6', 0, [{ productId: 'pr5', variant: null, qty: 1, price: 24 }], 'pending'),
];
const c2a = DB.athletes.filter((a) => a.coachId === 'c2'); const c7a = DB.athletes.filter((a) => a.coachId === 'c7');
DB.shop.orders.push(mkOrder(2011, 'c2', c2a[0].id, 15, [{ productId: 'pr6', variant: 'S', qty: 1, price: 45 }], 'shipped'));
DB.shop.orders.push(mkOrder(2014, 'c2', c2a[1].id, 9, [{ productId: 'pr6', variant: 'M', qty: 2, price: 45 }], 'dispute', { dispute: 'Article reçu dans la mauvaise taille, client demande un remboursement.' }));
DB.shop.orders.push(mkOrder(3005, 'c7', c7a[0].id, 3, [{ productId: 'pr7', variant: null, qty: 1, price: 69 }], 'pending'));
[['l1', 'a9', 3], ['l1', 'a12', 8], ['l2', 'a19', 5], ['l1', 'a21', 13], ['l2', 'a8', 17], ['l1', 'a16', 22], ['l3', 'a14', 40], ['l2', 'a10', 26]].forEach(([lid, aid, d], k) => {
  const l = listingById(lid); DB.shop.digitalSales.push({ id: `ds${k + 1}`, listingId: lid, coachId: l.coachId, athleteId: aid, date: D(-d, rint(8, 22), rint(0, 59)), price: l.price, invoice: `FN-2026-${300 + k}` });
});
[['l4', c2a[2] ? c2a[2].id : 'a30', 4], ['l5', 'a40', 2], ['l5', 'a41', 11]].forEach(([lid, aid, d], k) => { const l = listingById(lid); if (athleteById(aid)) DB.shop.digitalSales.push({ id: `dsx${k}`, listingId: lid, coachId: l.coachId, athleteId: aid, date: D(-d, 12, 0), price: l.price, invoice: `FN-2026-${400 + k}` }); });

/* =========================================================
   Offres coach, paiements des athlètes, contrat coach-athlète
   ========================================================= */
DB.coachOffers = [
  { id: 'of1', coachId: 'c1', name: 'Suivi Essentiel', price: 79, period: 'mois', desc: 'Programme sport personnalisé, check-in hebdomadaire, messagerie.', active: true },
  { id: 'of2', coachId: 'c1', name: 'Suivi Premium', price: 120, period: 'mois', desc: 'Sport + nutrition, check-in hebdo, 1 visio mensuelle, ajustements illimités.', active: true },
  { id: 'of3', coachId: 'c1', name: 'Pack Transformation 3 mois', price: 330, period: '3 mois', desc: 'Premium sur 3 mois avec bilan corporel à chaque fin de mois.', active: true },
  { id: 'of4', coachId: 'c1', name: 'Séance découverte', price: 0, period: 'unique', desc: 'Appel de 30 minutes pour faire connaissance.', active: true },
];
DB.coachPromos = [
  { id: 'cp1', coachId: 'c1', code: 'RENTREE20', discount: 20, type: '%', desc: '−20 % sur le premier mois', uses: 6, max: 20, active: true, expires: ymd(addDays(T0, 21)) },
  { id: 'cp2', coachId: 'c1', code: 'PARRAIN10', discount: 10, type: '€', desc: '−10 € pour un ami parrainé', uses: 3, max: null, active: true, expires: '' },
  { id: 'cp3', coachId: 'c1', code: 'ETE2026', discount: 15, type: '%', desc: 'Offre été', uses: 11, max: 30, active: false, expires: ymd(addDays(T0, -40)) },
];
DB.payments = [];
DB.athletes.filter((a) => a.coachId === 'c1' && a.status !== 'pre').forEach((a, i) => {
  a.offerId = a.id === 'a1' ? 'of2' : a.id === 'a3' ? 'of1' : ['of1', 'of2', 'of2', 'of3'][i % 4];
  const offer = byId(DB.coachOffers, a.offerId);
  const months = offer.period === '3 mois' ? [2] : [2, 1, 0];
  months.forEach((m) => {
    const date = addMonths(startOfMonth(T0), -m); date.setDate(rint(1, 5)); date.setHours(9, rint(0, 59));
    const st = m > 0 ? 'paid' : a.id === 'a4' ? 'failed' : a.status === 'paused' ? 'pending' : date > new Date() ? 'pending' : chance(0.9) ? 'paid' : 'pending';
    DB.payments.push({ id: uid('pay'), coachId: 'c1', athleteId: a.id, offerId: offer.id, label: offer.name, amount: offer.price, date: date.toISOString(), status: st, invoice: `FC-${String(2026)}-${1100 + DB.payments.length}`, reminders: st === 'failed' ? 1 : 0 });
  });
  a.contract = { version: a.id === 'a3' ? 2 : 3, signedAt: a.id === 'a3' ? D(-58) : D(-rint(8, 9)) };
});
const CLAUSES_V3 = [
  { title: 'Objet', text: 'Le présent contrat encadre l’accompagnement sportif et nutritionnel proposé par le coach à l’athlète via l’application ELEV8.' },
  { title: 'Durée et renouvellement', text: 'Le contrat est conclu pour la durée de la formule choisie et se renouvelle tacitement, sauf résiliation avec un préavis de 15 jours.' },
  { title: 'Engagements du coach', text: 'Le coach fournit un programme personnalisé, répond aux messages sous 48 h ouvrées et réalise les bilans prévus par la formule.' },
  { title: 'Engagements de l’athlète', text: 'L’athlète renseigne ses séances et son check-in hebdomadaire, et signale toute douleur ou contre-indication.' },
  { title: 'Santé', text: 'L’athlète atteste être apte à la pratique sportive et s’engage à consulter un médecin en cas de doute.' },
  { title: 'Données personnelles', text: 'Les données de santé (montre connectée, mesures) ne sont partagées avec le coach qu’avec l’accord explicite de l’athlète.' },
];
const RULES_V3 = [
  { text: 'Le paiement est dû en début de période.', n: null },
  { text: 'Un rappel est envoyé automatiquement 3 jours après l’échéance.', n: null },
  { text: 'Après {n} rappels non honorés, le contrat est rompu automatiquement.', n: 3 },
  { text: 'Toute période entamée est due et non remboursable.', n: null },
];
DB.coachContracts = {
  c1: { versions: [
    { v: 1, date: D(-180), clauses: CLAUSES_V3.slice(0, 4), rules: RULES_V3.slice(0, 2), note: 'Version initiale' },
    { v: 2, date: D(-70), clauses: CLAUSES_V3.slice(0, 5), rules: RULES_V3.slice(0, 3).map((r) => (r.n ? { ...r, n: 4 } : r)), note: 'Ajout de la clause santé et de la rupture après rappels' },
    { v: 3, date: D(-10), clauses: CLAUSES_V3, rules: RULES_V3, note: 'Clause données de santé (montres connectées), 3 rappels' },
  ] },
};
DB.documents = [
  { id: 'doc1', coachId: 'c1', name: 'Questionnaire de santé (PAR-Q).pdf', size: '182 Ko', date: D(-140), shared: true },
  { id: 'doc2', coachId: 'c1', name: 'Guide nutrition débutant.pdf', size: '2,4 Mo', date: D(-60), shared: true },
  { id: 'doc3', coachId: 'c1', name: 'Attestation assurance RC Pro 2026.pdf', size: '96 Ko', date: D(-250), shared: false },
  { id: 'doc4', coachId: 'c1', name: 'Grille tarifaire 2026.pdf', size: '64 Ko', date: D(-20), shared: false },
];

/* =========================================================
   Rendez-vous, disponibilités, messagerie, prospects
   ========================================================= */
DB.appointments = [];
const c1Clients = DB.athletes.filter((a) => a.coachId === 'c1' && a.status === 'active');
for (let k = -24; k <= 24; k++) {
  const day = addDays(T0, k); const dow = dowIndex(day);
  if (dow === 6 || !chance(dow === 5 ? 0.35 : 0.62)) continue;
  const n = rint(1, 2);
  for (let j = 0; j < n; j++) {
    const a = rpick(c1Clients); const type = rpick(APPT_TYPES.slice(0, 5)); const h = rpick([9, 10, 11, 14, 15, 16, 17, 18]);
    DB.appointments.push({ id: uid('rdv'), coachId: 'c1', athleteId: a.id, type, mode: chance(0.55) ? 'visio' : 'presentiel', start: atTime(day, `${h}:${rpick(['00', '30'])}`).toISOString(), duration: rpick([30, 45, 60]), note: '', status: k < 0 ? 'done' : 'scheduled' });
  }
}
DB.appointments.push({ id: 'rdv-lea', coachId: 'c1', athleteId: 'a1', type: 'Bilan mensuel', mode: 'visio', start: atTime(T0, '14:00').toISOString(), duration: 45, note: 'Bilan du 1er mois : photos, mensurations, ajustement des macros.', status: 'scheduled' });
DB.appointments.push({ id: 'rdv-karim', coachId: 'c1', athleteId: 'a3', type: 'Suivi technique', mode: 'presentiel', start: atTime(T0, '17:30').toISOString(), duration: 60, note: 'Revoir la technique du soulevé de terre.', status: 'scheduled' });
DB.appointments.push({ id: 'rdv-franck', coachId: 'c1', athleteId: 'a24', type: 'Découverte', mode: 'visio', start: atTime(addDays(T0, 1), '08:30').toISOString(), duration: 30, note: 'Premier échange, présentation de la méthode.', status: 'scheduled' });
DB.appointments.sort((a, b) => new Date(a.start) - new Date(b.start));
const SLOTS = (a, b) => [a, b].filter(Boolean);
DB.availability = { c1: [
  { on: true, slots: SLOTS(['09:00', '12:00'], ['14:00', '19:00']) }, { on: true, slots: SLOTS(['09:00', '12:00'], ['14:00', '19:00']) },
  { on: true, slots: SLOTS(['14:00', '20:00']) }, { on: true, slots: SLOTS(['09:00', '12:00'], ['14:00', '19:00']) },
  { on: true, slots: SLOTS(['09:00', '12:00'], ['14:00', '18:00']) }, { on: true, slots: SLOTS(['09:00', '12:00']) }, { on: false, slots: [] },
] };
const msg = (from, text, daysAgo, h, m, extra = {}) => ({ id: uid('m'), from, text, at: D(-daysAgo, h, m), type: 'text', ...extra });
const leaLast = DB.logs.filter((l) => l.athleteId === 'a1').slice(-1)[0];
DB.threads = [
  { id: 't1', kind: 'coach', a: 'c1', b: 'a1', unread: { c1: 1, a1: 0 }, messages: [
    msg('c1', 'Salut Léa ! J’ai augmenté tes charges de 1,5 % cette semaine, tu as super bien géré la semaine dernière 💪', 6, 20, 41),
    msg('a1', 'Merci coach ! Le hip thrust à 72 kg est passé, mais dur sur la dernière série 😅', 6, 21, 3),
    msg('c1', 'Normal, c’est le but. Garde 1 à 2 répétitions en réserve et note ton RPE.', 6, 21, 10),
    msg('a1', 'Voilà ma vidéo du squat pour vérifier la profondeur', 3, 19, 2, { type: 'video', data: { name: 'squat-serie3.mp4', exercise: 'Back Squat' } }),
    msg('c1', 'Profondeur parfaite. Pense juste à garder la poitrine haute à la remontée.', 3, 19, 30),
    msg('a1', 'Bilan de ma séance d’hier 👇', 1, 20, 12, { type: 'summary', data: { logId: leaLast ? leaLast.id : null } }),
  ] },
  { id: 't2', kind: 'coach', a: 'c1', b: 'a3', unread: { c1: 0, a1: 0 }, messages: [msg('a3', 'Coach, je peux décaler ma séance de demain à samedi ?', 2, 22, 15), msg('c1', 'Oui sans souci, je t’ai ajouté une séance de récupération active demain.', 2, 22, 40)] },
  { id: 't3', kind: 'coach', a: 'c1', b: 'a4', unread: { c1: 2 }, messages: [msg('a4', 'Mon paiement n’est pas passé, ma carte a expiré…', 1, 9, 12), msg('a4', 'Je mets à jour ce soir !', 1, 9, 13)] },
  { id: 't4', kind: 'coach', a: 'c1', b: 'a5', unread: {}, messages: [msg('c1', 'Bravo pour ton nouveau record au squat 🎉', 4, 18, 0), msg('a5', 'Merci ! 140 kg, objectif 150 à Noël', 4, 18, 22)] },
  { id: 't5', kind: 'coach', a: 'c1', b: 'a6', unread: {}, messages: [msg('a6', 'J’ai commandé les élastiques, hâte de les recevoir !', 0, 8, 15)] },
  { id: 't6', kind: 'coach', a: 'c1', b: 'a8', unread: {}, messages: [msg('c1', 'Pense à ton check-in dimanche 🙂', 5, 17, 0)] },
  { id: 'ts1', kind: 'support', a: 'elev8', b: 'c1', unread: {}, messages: [msg('c1', 'Bonjour, comment est calculée la commission sur la Boutique ?', 12, 10, 2), msg('elev8', 'Bonjour Thomas ! La commission ELEV8 est prélevée automatiquement sur chaque vente en Boutique avant reversement. Elle est visible dans l’historique de vos ventes. — Sarah, support ELEV8', 12, 10, 20)] },
  { id: 'ts2', kind: 'support', a: 'elev8', b: 'a2', unread: { elev8: 1 }, messages: [msg('a2', 'Bonjour, ma montre Garmin ne se synchronise plus depuis hier.', 0, 7, 50)] },
];
DB.prospects = [
  ['Julia Martins', 'Instagram', 'todo', 'Veut perdre 6 kg pour un mariage en juin.', 0],
  ['Olivier Petitjean', 'Recommandation', 'contacted', 'Recommandé par Léa Martin. Objectif force.', 2],
  ['Samira Toumi', 'Annuaire ELEV8', 'meeting', 'Appel découverte prévu jeudi 18 h.', 3],
  ['Benoît Carré', 'Salle de sport', 'contacted', 'Rencontré à Fit Arena, intéressé par le Pack 3 mois.', 6],
  ['Nora Lemaire', 'Lien de parrainage', 'converted', 'Convertie — inscrite via le lien.', 15],
  ['Hakim Bensaïd', 'Ajout manuel', 'lost', 'Budget trop élevé pour le moment.', 20],
  ['Pauline Gaudin', 'Instagram', 'todo', 'Demande d’infos sur la préparation Hyrox.', 1],
  ['Kylian Vasseur', 'Recommandation', 'meeting', 'Footballeur amateur, travail d’explosivité.', 4],
  ['Émilie Fabre', 'Ajout manuel', 'converted', 'Convertie après la séance découverte.', 30],
  ['Victor Leclerc', 'Instagram', 'lost', 'Pas de réponse après 3 relances.', 25],
].map(([name, source, status, notes, d], k) => ({ id: `pr${k + 1}`, coachId: 'c1', name, email: `${slug(name.split(' ')[0])}.${slug(name.split(' ')[1])}@email.fr`, phone: `07 ${rint(10, 99)} ${rint(10, 99)} ${rint(10, 99)} ${rint(10, 99)}`, source, status, notes, createdAt: D(-d - 1, rint(9, 20), 0), updatedAt: D(-d, 12, 0) }));

/* =========================================================
   Plateforme & administration
   ========================================================= */
DB.platform = { name: 'ELEV8', supportEmail: 'support@elev8.app', emailNotifs: true, autoBilling: true, maintenance: false, annualDiscount: 20, ambassadorRate: 10, shopCommission: 8, hideCommunity: false, trialDays: 14 };
DB.plans = {
  coach: [
    { id: 'trial', name: 'Essai', price: 0, max: 3, features: ['Toutes les fonctions Start', 'Jusqu’à 3 clients', 'Durée de l’essai à préciser'] },
    { id: 'start', name: 'Start', price: 59, max: 10, features: ['Jusqu’à 10 clients', 'Programmes et séances', 'Exercices personnalisés', 'Nutrition de base', 'Messagerie', 'Visio intégrée', 'Rendez-vous', 'Check-ins et habitudes', 'Boutique — version de base (programmes numériques)'] },
    { id: 'pro', name: 'Pro', price: 99, max: 50, features: ['Tout Start', 'Jusqu’à 50 clients', 'Boutique en ligne complète (marketplace)', 'Analyses avancées', 'Prospects et CRM', 'Communauté'], future: ['Communauté'] },
    { id: 'elite', name: 'Elite', price: 199, max: null, features: ['Tout Pro', 'Clients illimités', 'Support prioritaire (tickets, chat, centre d’aide)', 'Personnalisation avancée (marque, emails, profil public)', 'Lien de parrainage de nouveaux coachs'] },
  ],
  athlete: [
    { id: 'free', name: 'Free', price: 0, desc: 'Athlète solo', features: ['Sport et Nutrition', 'Programmes ELEV8', 'Création de programmes personnels', 'Boutique', 'Suivi de progression', 'Publicités'], future: ['Publicités'] },
    { id: 'affiliated', name: 'Affiliated', price: 0, desc: 'Athlète rattaché à un coach', features: ['Sport et Nutrition', 'Programmes ELEV8', 'Création de programmes personnels', 'Boutique', 'Suivi de progression', 'Sans publicité'] },
  ],
};
DB.revenueGrowth = [0.36, 0.42, 0.47, 0.53, 0.58, 0.63, 0.7, 0.76, 0.82, 0.88, 0.94, 1];
DB.admins = [
  { id: 'ad1', name: 'Sarah Benali', email: 'sarah@elev8.app', role: 'super', color: '#0F1115' },
  { id: 'ad2', name: 'Yacine Amrani', email: 'yacine@elev8.app', role: 'support', color: '#2a78d6' },
  { id: 'ad3', name: 'Julie Roux', email: 'julie@elev8.app', role: 'contenu', color: '#1baf7a' },
  { id: 'ad4', name: 'Marc Lemoine', email: 'marc@elev8.app', role: 'finance', color: '#eb6834' },
];
DB.adminRoles = {
  super: { label: 'Super Admin', perms: ['*'] },
  support: { label: 'Support', perms: ['dashboard', 'clients', 'activity', 'kyc', 'certifications', 'moderation', 'support', 'messages', 'emails', 'docs', 'api'] },
  contenu: { label: 'Contenu', perms: ['dashboard', 'activity', 'exercises', 'sessions', 'programs', 'nutrition', 'moderation', 'docs'] },
  finance: { label: 'Finance', perms: ['dashboard', 'clients', 'analytics', 'activity', 'subscriptions', 'invoices', 'affiliations', 'shop', 'ads', 'contracts', 'contract-stats', 'docs'] },
};
const tmsg = (from, text, daysAgo, h, m, internal = false) => ({ id: uid('tm'), from, text, at: D(-daysAgo, h, m), internal });
DB.tickets = [
  { id: 'T-1048', userId: 'c1', category: 'coach', subject: 'Virement Boutique en attente', desc: 'Mes ventes de la semaine dernière n’apparaissent pas encore sur mon compte bancaire.', status: 'open', priority: 2, assignee: null, createdAt: D(0, 8, 40), messages: [tmsg('c1', 'Mes ventes de la semaine dernière n’apparaissent pas encore sur mon compte bancaire. Est-ce normal ?', 0, 8, 40)] },
  { id: 'T-1047', userId: 'a2', category: 'solo', subject: 'Montre Garmin non synchronisée', desc: 'La synchronisation Garmin s’arrête à 0 % depuis hier.', status: 'progress', priority: 3, assignee: 'ad2', createdAt: D(-1, 7, 55), messages: [tmsg('a2', 'La synchronisation Garmin s’arrête à 0 % depuis hier.', 1, 7, 55), tmsg('ad2', 'Bonjour Hugo, pouvez-vous déconnecter puis reconnecter la montre dans Réglages > Montre connectée ?', 1, 10, 12), tmsg('ad2', 'Incident connu côté intégration Garmin (latence API). Suivi avec l’équipe tech.', 1, 10, 14, true)] },
  { id: 'T-1046', userId: 'a1', category: 'coached', subject: 'PDF du programme vide', desc: 'Le PDF téléchargé s’affichait sans les exercices.', status: 'resolved', priority: 4, assignee: 'ad2', createdAt: D(-5, 19, 20), messages: [tmsg('a1', 'Le PDF de mon programme s’affiche sans les exercices.', 5, 19, 20), tmsg('ad2', 'Corrigé dans la dernière mise à jour, merci pour le signalement !', 4, 9, 30)] },
  { id: 'T-1045', userId: 'c5', category: 'coach', subject: 'Limite de clients atteinte', desc: 'Je ne peux plus ajouter de client, que faire ?', status: 'open', priority: 2, assignee: null, createdAt: D(-1, 15, 2), messages: [tmsg('c5', 'Je ne peux plus ajouter de client, que faire ?', 1, 15, 2)] },
  { id: 'T-1044', userId: 'c7', category: 'coach', subject: 'Facture d’abonnement incorrecte', desc: 'Ma facture annuelle n’applique pas la remise de 20 %.', status: 'progress', priority: 3, assignee: 'ad4', createdAt: D(-2, 11, 0), messages: [tmsg('c7', 'Ma facture annuelle n’applique pas la remise de 20 %.', 2, 11, 0), tmsg('ad4', 'Je vérifie avec Stripe et je reviens vers vous.', 2, 14, 10)] },
  { id: 'T-1043', userId: 'a3', category: 'coached', subject: 'Question sur le contrat', desc: 'Une nouvelle version du contrat est apparue, dois-je la signer ?', status: 'open', priority: 4, assignee: null, createdAt: D(-2, 21, 30), messages: [tmsg('a3', 'Une nouvelle version du contrat est apparue, dois-je la signer ?', 2, 21, 30)] },
  { id: 'T-1042', userId: 'c4', category: 'coach', subject: 'Vidéos d’exercices qui ne se lancent plus', desc: 'Depuis ce matin, les vidéos de la bibliothèque restent noires pendant les séances.', status: 'open', priority: 1, assignee: 'ad1', createdAt: D(0, 7, 12), messages: [tmsg('c4', 'Depuis ce matin, les vidéos de la bibliothèque restent noires pendant les séances de mes athlètes.', 0, 7, 12)] },
  { id: 'T-1041', userId: 'a54', category: 'solo', subject: 'Supprimer mon compte', desc: 'Je souhaite supprimer mon compte et toutes mes données.', status: 'progress', priority: 3, assignee: 'ad2', createdAt: D(-3, 13, 45), messages: [tmsg('a54', 'Je souhaite supprimer mon compte et toutes mes données.', 3, 13, 45)] },
  { id: 'T-1040', userId: 'c12', category: 'coach', subject: 'Passer en formule Pro', desc: 'Comment changer de formule en cours de mois ?', status: 'resolved', priority: 5, assignee: 'ad4', createdAt: D(-6, 10, 0), messages: [tmsg('c12', 'Comment changer de formule en cours de mois ?', 6, 10, 0), tmsg('ad4', 'Depuis Paramètres > Abonnement : le changement est proratisé automatiquement.', 6, 11, 0)] },
  { id: 'T-1039', userId: 'a1', category: 'coached', subject: 'Changer mon adresse de livraison', desc: 'Je déménage, comment modifier l’adresse ?', status: 'resolved', priority: 5, assignee: 'ad2', createdAt: D(-11, 9, 0), messages: [tmsg('a1', 'Je déménage, comment modifier mon adresse ?', 11, 9, 0), tmsg('ad2', 'Vous pouvez la modifier au moment du paiement ou dans Réglages > Profil.', 11, 9, 40)] },
];
if (!athleteById('a54')) DB.tickets = DB.tickets.filter((t) => t.userId !== 'a54');
const KYC_DOC = ['Carte d’identité', 'Passeport', 'Titre de séjour', 'Permis de conduire'];
DB.kycRequests = [
  { id: 'k1', userType: 'coach', userId: 'c3', doc: KYC_DOC[0], submitted: D(-1, 16, 20), status: 'pending', reason: '', hasDiploma: true },
  { id: 'k2', userType: 'coach', userId: 'c13', doc: KYC_DOC[1], submitted: D(0, 6, 55), status: 'pending', reason: '', hasDiploma: true },
  { id: 'k3', userType: 'athlete', userId: 'a4', doc: KYC_DOC[0], submitted: D(-2, 20, 10), status: 'pending', reason: '', context: 'Premier achat Boutique' },
  { id: 'k4', userType: 'coach', userId: 'c1', doc: KYC_DOC[0], submitted: D(-405, 10, 0), status: 'approved', reason: '', reviewedBy: 'Sarah Benali' },
  { id: 'k5', userType: 'coach', userId: 'c2', doc: KYC_DOC[1], submitted: D(-375, 11, 0), status: 'approved', reason: '', reviewedBy: 'Yacine Amrani' },
  { id: 'k6', userType: 'athlete', userId: 'a8', doc: KYC_DOC[0], submitted: D(-13, 9, 30), status: 'approved', reason: '', reviewedBy: 'Automatique (carte bancaire)', context: 'Premier achat Boutique' },
  { id: 'k7', userType: 'coach', userId: 'c10', doc: KYC_DOC[3], submitted: D(-6, 18, 0), status: 'rejected', reason: 'Selfie flou et document partiellement masqué.', reviewedBy: 'Yacine Amrani' },
  { id: 'k8', userType: 'coach', userId: 'c16', doc: KYC_DOC[0], submitted: D(-92, 14, 0), status: 'approved', reason: '', reviewedBy: 'Sarah Benali' },
  { id: 'k9', userType: 'athlete', userId: 'a7', doc: KYC_DOC[2], submitted: D(-7, 12, 0), status: 'approved', reason: '', reviewedBy: 'Automatique (carte bancaire)', context: 'Premier achat Boutique' },
];
coachById('c10').kyc = 'rejected';
athleteById('a8').kycVerified = true; athleteById('a7').kycVerified = true;
DB.certRequests = [
  { id: 'cr1', coachId: 'c3', diploma: 'Licence STAPS — Entraînement sportif', issuer: 'Université Aix-Marseille', year: 2019, submitted: D(-1, 16, 25), status: 'pending', reason: '' },
  { id: 'cr2', coachId: 'c9', diploma: 'BPJEPS Activités de la forme', issuer: 'CREPS PACA', year: 2021, submitted: D(-3, 10, 5), status: 'pending', reason: '' },
  { id: 'cr3', coachId: 'c13', diploma: 'CQP Instructeur Fitness', issuer: 'Branche du sport', year: 2023, submitted: D(0, 7, 0), status: 'pending', reason: '' },
  { id: 'cr4', coachId: 'c2', diploma: 'BPJEPS AF — Haltérophilie Musculation', issuer: 'CREPS Île-de-France', year: 2016, submitted: D(-370), status: 'approved', reason: '' },
  { id: 'cr5', coachId: 'c6', diploma: 'Certification Pilates Mat', issuer: 'Polestar', year: 2020, submitted: D(-140), status: 'approved', reason: '' },
];
DB.reports = [
  { id: 'rp1', kind: 'conversation', targetId: 'conv-c5-a35', title: 'Conversation Kevin Roussel ↔ athlète', reporter: 'a35', reason: 'Messages insistants en dehors des horaires convenus.', date: D(-1, 22, 10), status: 'pending', excerpt: '« Tu n’as pas répondu à mes 6 messages, il faut que tu réagisses ce soir. »' },
  { id: 'rp2', kind: 'exercise', targetId: EXN['Squat extrême sur ballon'], title: 'Exercice « Squat extrême sur ballon »', reporter: 'c4', reason: 'Exécution dangereuse montrée en vidéo.', date: D(-2, 9, 0), status: 'pending', excerpt: 'Vidéo de squat chargé debout sur un ballon de stabilité.' },
  { id: 'rp3', kind: 'recipe', targetId: 'r92', title: 'Recette « Brownie protéiné 0 calorie »', reporter: 'c14', reason: 'Valeurs nutritionnelles manifestement fausses.', date: D(-4, 15, 30), status: 'pending', excerpt: '12 kcal pour 100 g annoncées.' },
  { id: 'rp4', kind: 'product', targetId: 'pr8', title: 'Produit « Thé brûle-graisse 100 % garanti »', reporter: 'a40', reason: 'Allégations de santé trompeuses.', date: D(-1, 11, 0), status: 'pending', excerpt: '« Perdez 5 kg en 7 jours sans effort ».' },
];
DB.platformContracts = DB.coaches.map((c, i) => {
  const pending = ['c10', 'c13'].includes(c.id);
  const signedAt = pending ? null : addDays(new Date(c.since), 1).toISOString();
  const expires = signedAt ? addDays(new Date(signedAt), 365).toISOString() : null;
  return { id: `ctr${i + 1}`, coachId: c.id, version: 'CGU Coach v2.3', status: pending ? 'pending' : 'signed', signedAt, signatory: fullName(c), expires };
});
DB.invoices = [];
DB.coaches.forEach((c) => {
  if (c.plan === 'trial') return;
  const price = (DB.plans.coach.find((p) => p.id === c.plan) || { price: 0 }).price;
  for (let m = 3; m >= 0; m--) {
    if (c.subStatus === 'ended' && m < 2) continue;
    const d = addMonths(startOfMonth(T0), -m); d.setDate(Math.min(28, new Date(c.since).getDate())); d.setHours(6, 0);
    if (c.billing === 'annual' && m !== 0) continue;
    const amount = c.billing === 'annual' ? round(price * 12 * (1 - DB.platform.annualDiscount / 100), 2) : price;
    const status = m > 0 ? 'paid' : c.subStatus === 'inactive' ? 'late' : d > new Date() ? 'pending' : chance(0.85) ? 'paid' : 'pending';
    DB.invoices.push({ id: `F-2026-${String(4100 + DB.invoices.length)}`, coachId: c.id, amount, date: d.toISOString(), status, label: `Abonnement ${PLAN_NAMES[c.plan]} ${c.billing === 'annual' ? '(annuel −20 %)' : '(mensuel)'}` });
  }
});
DB.invoices.sort((a, b) => new Date(b.date) - new Date(a.date));
DB.ambassadors = [
  { id: 'amb1', name: 'Nadia Haddad', email: 'nadia@nadiafit.fr', type: 'Coach Elite', rate: 10, signups: 14, revenue: 1386, paid: 96, active: true, since: D(-300) },
  { id: 'amb2', name: 'Samuel Ortiz', email: 'samuel.ortiz@email.fr', type: 'Influenceur fitness', rate: 15, signups: 31, revenue: 2870, paid: 330, active: true, since: D(-220) },
  { id: 'amb3', name: 'Fit Arena Lyon', email: 'contact@fitarena.fr', type: 'Salle de sport', rate: 10, signups: 9, revenue: 891, paid: 60, active: true, since: D(-160) },
  { id: 'amb4', name: 'Inès Moreau', email: 'ines@imwellness.fr', type: 'Coach Elite', rate: 10, signups: 6, revenue: 594, paid: 40, active: true, since: D(-120) },
  { id: 'amb5', name: 'Lucas Ferrand', email: 'lucas.ferrand@email.fr', type: 'Athlète', rate: 10, signups: 0, revenue: 0, paid: 0, active: false, since: D(-15) },
];
DB.referrals = [
  ...['a9', 'a13', 'a18', 'a22', 'a23'].map((id, k) => ({ id: `ref${k}`, coachId: 'c1', type: 'athlete', userId: id, date: athleteById(id).since })),
  { id: 'ref9', coachId: 'c1', type: 'coach', userId: 'c13', date: coachById('c13').since },
];
DB.promoCodes = [
  { id: 'pc1', code: 'LAUNCH30', discount: '−30 % pendant 3 mois', plans: 'Start, Pro', uses: 42, max: 100, active: true, expires: ymd(addDays(T0, 45)) },
  { id: 'pc2', code: 'ELITE2026', discount: '−50 % le premier mois', plans: 'Elite', uses: 7, max: 20, active: true, expires: ymd(addDays(T0, 80)) },
  { id: 'pc3', code: 'ANNUEL10', discount: '−10 % supplémentaires (annuel)', plans: 'Toutes', uses: 12, max: null, active: true, expires: '' },
  { id: 'pc4', code: 'SALON-FITNESS', discount: '−20 % le premier mois', plans: 'Toutes', uses: 18, max: 50, active: false, expires: ymd(addDays(T0, -12)) },
];
const ET = (theme, name, desc, vars, subject, body) => ({ id: uid('et'), theme, name, desc, vars, subject, body, updatedAt: D(-rint(5, 90)) });
DB.emailTemplates = [
  ET('Séances et programmes', 'Séance planifiée', 'Envoyé quand une séance est ajoutée au planning', ['prenom', 'seance', 'date', 'heure', 'lien'], 'Nouvelle séance : {{seance}}', 'Bonjour {{prenom}},\n\nVotre coach a planifié la séance « {{seance}} » le {{date}} à {{heure}}.\n\nOuvrir ma séance : {{lien}}'),
  ET('Séances et programmes', 'Séance annulée', 'Envoyé lors de l’annulation d’une séance', ['prenom', 'seance', 'date'], 'Séance annulée : {{seance}}', 'Bonjour {{prenom}},\n\nLa séance « {{seance}} » du {{date}} a été annulée.'),
  ET('Séances et programmes', 'Rapport de progression', 'Résumé mensuel envoyé à l’athlète', ['prenom', 'mois', 'seances', 'volume', 'lien'], 'Votre progression de {{mois}}', 'Bravo {{prenom}} !\n\nCe mois-ci : {{seances}} séances et {{volume}} soulevés.\n\nVoir le détail : {{lien}}'),
  ET('Séances et programmes', 'Programme terminé', 'Envoyé à la fin d’un programme', ['prenom', 'programme', 'lien'], 'Programme terminé 🎉', 'Félicitations {{prenom}}, vous avez terminé « {{programme}} » !\n\n{{lien}}'),
  ET('Coachs et contrats', 'Invitation d’un coach', 'Invitation envoyée par un coach à un athlète', ['prenom', 'coach', 'lien'], '{{coach}} vous invite sur ELEV8', 'Bonjour {{prenom}},\n\n{{coach}} vous invite à rejoindre son espace ELEV8.\n\nCréer mon compte : {{lien}}'),
  ET('Coachs et contrats', 'Contrat signé par l’athlète', 'Notification au coach', ['coach', 'athlete', 'date'], '{{athlete}} a signé votre contrat', 'Bonjour {{coach}},\n\n{{athlete}} a signé le contrat le {{date}}.'),
  ET('Coachs et contrats', 'Limite de clients atteinte', 'Envoyé quand la formule est pleine', ['coach', 'formule', 'max', 'lien'], 'Limite de clients atteinte', 'Bonjour {{coach}},\n\nVous avez atteint {{max}} clients avec la formule {{formule}}. Passez à la formule supérieure : {{lien}}'),
  ET('Coachs et contrats', 'Rappel de contrat J-30', 'Rappel 30 jours avant la fin', ['prenom', 'date', 'lien'], 'Votre contrat se termine dans 30 jours', 'Bonjour {{prenom}},\n\nVotre contrat se termine le {{date}}.\n\n{{lien}}'),
  ET('Coachs et contrats', 'Rappel de contrat J-7', 'Rappel 7 jours avant la fin', ['prenom', 'date', 'lien'], 'Votre contrat se termine dans 7 jours', 'Bonjour {{prenom}},\n\nVotre contrat se termine le {{date}}.\n\n{{lien}}'),
  ET('Coachs et contrats', 'Contrat expiré', 'Envoyé le jour de l’expiration', ['prenom', 'lien'], 'Votre contrat a expiré', 'Bonjour {{prenom}},\n\nVotre contrat a expiré. Renouvelez-le ici : {{lien}}'),
  ET('Coachs et contrats', 'Contrat d’un client qui expire', 'Prévient le coach', ['coach', 'athlete', 'date'], 'Le contrat de {{athlete}} expire bientôt', 'Bonjour {{coach}},\n\nLe contrat de {{athlete}} expire le {{date}}.'),
  ET('Affiliation', 'Nouveau filleul inscrit', 'Envoyé à l’ambassadeur', ['prenom', 'filleul', 'date'], 'Nouveau filleul : {{filleul}}', 'Bonjour {{prenom}},\n\n{{filleul}} s’est inscrit via votre lien le {{date}}.'),
  ET('Affiliation', 'Commission versée', 'Confirmation de versement', ['prenom', 'montant', 'periode'], 'Votre commission de {{montant}}', 'Bonjour {{prenom}},\n\nNous avons versé {{montant}} pour la période {{periode}}.'),
  ET('Affiliation', 'Bienvenue dans le programme d’affiliation', 'Accueil des ambassadeurs', ['prenom', 'lien', 'taux'], 'Bienvenue dans le programme ambassadeur', 'Bonjour {{prenom}},\n\nVotre lien : {{lien}} — commission : {{taux}}.'),
  ET('Rendez-vous', 'Confirmation de rendez-vous', 'Envoyé à la création d’un RDV', ['prenom', 'type', 'date', 'heure', 'mode'], 'RDV confirmé : {{type}}', 'Bonjour {{prenom}},\n\nVotre rendez-vous « {{type}} » est confirmé le {{date}} à {{heure}} ({{mode}}).'),
  ET('Rendez-vous', 'Rappel de rendez-vous', 'Envoyé 24 h avant', ['prenom', 'type', 'date', 'heure', 'lien'], 'Rappel : RDV demain à {{heure}}', 'Bonjour {{prenom}},\n\nPetit rappel : « {{type}} » demain à {{heure}}.\n\n{{lien}}'),
  ET('Rendez-vous', 'Lien de visio pour un invité', 'Lien d’appel vidéo', ['prenom', 'lien', 'heure'], 'Votre lien de visio', 'Bonjour {{prenom}},\n\nRejoignez l’appel à {{heure}} : {{lien}}'),
  ET('Vérification d’identité', 'KYC approuvé', 'Vérification validée', ['prenom'], 'Votre identité est vérifiée ✅', 'Bonjour {{prenom}},\n\nBonne nouvelle : votre vérification d’identité est approuvée.'),
  ET('Vérification d’identité', 'KYC rejeté', 'Vérification refusée', ['prenom', 'raison', 'lien'], 'Vérification d’identité refusée', 'Bonjour {{prenom}},\n\nNous n’avons pas pu valider votre identité : {{raison}}.\n\nRecommencer : {{lien}}'),
];
DB.apiServices = [
  ['API principale', 'api.elev8.app', 'ok', 84, 99.98], ['Authentification', 'auth.elev8.app', 'ok', 61, 99.99], ['Base de données', 'db-primary', 'ok', 12, 99.99],
  ['Paiements (Stripe)', 'payments', 'ok', 212, 99.95], ['Stockage vidéos', 'media.elev8.app', 'ok', 140, 99.9], ['Visio (WebRTC)', 'rtc.elev8.app', 'ok', 96, 99.7],
  ['Emails transactionnels', 'mail', 'ok', 310, 99.9], ['Notifications push', 'push', 'ok', 120, 99.8], ['Intégrations montres', 'wearables', 'degraded', 1840, 97.2],
  ['Génération PDF', 'pdf', 'ok', 450, 99.6], ['Scan code-barres', 'barcode', 'ok', 230, 99.5], ['Recherche', 'search', 'ok', 38, 99.9],
].map(([name, host, status, latency, uptime], k) => ({ id: `api${k + 1}`, name, host, status, latency, uptime, lastCheck: D(0, 9, rint(0, 30)) }));
const act = (d, h, m, type, text, ic) => ({ id: uid('ev'), at: D(-d, h, m), type, text, ic });
DB.activity = [
  act(0, 9, 2, 'order', 'Nouvelle commande #1042 — Camille Petit (Boutique Mercier Performance)', 'bag'),
  act(0, 8, 41, 'ticket', 'Nouveau ticket T-1048 : « Virement Boutique en attente » — Thomas Mercier', 'ticket'),
  act(0, 7, 12, 'ticket', 'Ticket critique T-1042 : vidéos d’exercices noires — Nadia Haddad', 'alert'),
  act(0, 7, 0, 'cert', 'Demande de certification — Romain Lambert (CQP Instructeur Fitness)', 'award'),
  act(0, 6, 55, 'kyc', 'KYC soumis — Romain Lambert (passeport)', 'shield'),
  act(1, 18, 4, 'preregister', 'Nouveau client pré-inscrit : Franck Benchetrit (coach Thomas Mercier)', 'userPlus'),
  act(1, 16, 25, 'cert', 'Demande de certification — Malik Benali (Licence STAPS)', 'award'),
  act(1, 15, 2, 'ticket', 'Nouveau ticket T-1045 : « Limite de clients atteinte » — Kevin Roussel', 'ticket'),
  act(1, 12, 30, 'payment', 'Paiement reçu : abonnement Pro — Antoine Girard', 'euro'),
  act(1, 9, 12, 'payment', 'Échec de paiement : Inès Dubois → Thomas Mercier (carte expirée)', 'alert'),
  act(2, 20, 10, 'kyc', 'KYC soumis — Inès Dubois (premier achat Boutique)', 'shield'),
  act(2, 14, 0, 'program', 'Programme « Recomposition — 8 semaines » assigné à 2 athlètes', 'layers'),
  act(2, 11, 0, 'order', 'Nouvelle commande #1040 — Inès Dubois', 'bag'),
  act(3, 18, 30, 'signup', 'Nouvel athlète inscrit via le lien de Thomas Mercier : Zoé Nguyen', 'user'),
  act(3, 10, 5, 'cert', 'Demande de certification — Yanis Belkacem (BPJEPS AF)', 'award'),
  act(4, 16, 0, 'subscription', 'Changement de formule : Clara Vincent Start → Start (annuel)', 'refresh'),
  act(4, 9, 0, 'signup', 'Nouveau coach inscrit : Romain Lambert (essai gratuit)', 'userPlus'),
  act(5, 19, 20, 'ticket', 'Ticket T-1046 résolu par Yacine Amrani', 'checkCircle'),
  act(6, 18, 0, 'kyc', 'KYC refusé — Laura Chevalier (selfie flou)', 'xCircle'),
  act(6, 9, 0, 'order', 'Commande #1039 expédiée — Lucas Moreau', 'truck'),
  act(8, 15, 0, 'shop', 'Nouveau produit publié : Élastiques de résistance (x3) — Thomas Mercier', 'package'),
  act(9, 9, 0, 'signup', 'Nouvel athlète inscrit : Laura Chevalier (coach)', 'user'),
  act(10, 10, 0, 'contract', 'Contrat coach-athlète v3 publié — Thomas Mercier', 'fileSign'),
  act(12, 10, 20, 'support', 'Chat support : question sur la commission Boutique — Thomas Mercier', 'message'),
  act(13, 9, 30, 'kyc', 'KYC approuvé automatiquement — Sarah Lefèvre (carte bancaire)', 'shield'),
  act(15, 21, 10, 'program', 'Charges ajustées (+2,5 %) — Léa Martin', 'trendUp'),
  act(18, 8, 5, 'signup', 'Nouvel athlète solo inscrit : Hugo Lefèvre', 'user'),
];
DB.audit = [
  { id: 'au1', at: D(-6, 18, 2), by: 'Yacine Amrani', role: 'Support', action: 'KYC refusé', target: 'Laura Chevalier', detail: 'Selfie flou et document partiellement masqué.' },
  { id: 'au2', at: D(-9, 11, 30), by: 'Sarah Benali', role: 'Super Admin', action: 'Compte suspendu', target: 'Samir Rahmani', detail: 'Impayés répétés (3 relances).' },
  { id: 'au3', at: D(-13, 15, 0), by: 'Julie Roux', role: 'Contenu', action: 'Contenu retiré', target: 'Exercice « Burpee double salto »', detail: 'Vidéo dangereuse.' },
  { id: 'au4', at: D(-20, 10, 15), by: 'Marc Lemoine', role: 'Finance', action: 'Remboursement', target: 'Commande #1029 (39,90 €)', detail: 'Produit endommagé à la livraison.' },
  { id: 'au5', at: D(-375, 11, 5), by: 'Yacine Amrani', role: 'Support', action: 'KYC approuvé', target: 'Sophie Garnier', detail: '' },
];
DB.waitlist = [
  ['Mathilde Rey', 'Coach', 'Lyon', 'Musculation', '@mathilde.coach'], ['Yohan Perrin', 'Athlète', 'Paris', 'CrossFit', '@yohan.wod'], ['Clémence Faure', 'Coach', 'Bordeaux', 'Yoga', '@clem.yoga'],
  ['Idriss Kone', 'Athlète', 'Marseille', 'Course à pied', '@idriss.runs'], ['Sophie Lemoine', 'Coach', 'Nantes', 'Nutrition', '@sophie.nutri'], ['Arthur Blanc', 'Athlète', 'Lille', 'Musculation', ''],
  ['Nadège Robert', 'Coach', 'Toulouse', 'Pilates', '@nadege.pilates'], ['Hugo Marchal', 'Athlète', 'Rennes', 'Natation', ''], ['Leïla Bensalem', 'Athlète', 'Paris', 'Musculation', '@leila.lifts'],
  ['Jérôme Caron', 'Coach', 'Grenoble', 'Trail', '@jerome.trail'], ['Margot Henry', 'Athlète', 'Nice', 'Fitness', ''], ['Tom Girard', 'Athlète', 'Lyon', 'Athlétisme', '@tom.sprint'],
  ['Céline Dumas', 'Coach', 'Montpellier', 'Remise en forme', '@celine.fit'], ['Ilyes Haddad', 'Athlète', 'Strasbourg', 'Boxe', ''], ['Anna Kowalski', 'Athlète', 'Bruxelles', 'CrossFit', '@anna.kow'],
  ['Romain Vidal', 'Coach', 'Annecy', 'Ski / préparation physique', '@romain.prepa'], ['Lou Martin', 'Athlète', 'Genève', 'Natation', ''], ['Moussa Diallo', 'Athlète', 'Paris', 'Football', '@moussa.d'],
  ['Elsa Gauthier', 'Coach', 'Lyon', 'Préparation mentale', '@elsa.mental'], ['Victor Hugo', 'Athlète', 'Toulouse', 'Rugby', ''], ['Inès Arnaud', 'Athlète', 'Lille', 'Musculation', '@ines.arn'], ['Paul Roche', 'Coach', 'Paris', 'Haltérophilie', '@paul.oly'],
].map(([name, role, city, sport, social], k) => ({ id: `w${k + 1}`, name, role, city, sport, social, email: `${slug(name.split(' ')[0])}.${slug(name.split(' ')[1])}@email.fr`, date: D(-rint(5, 120)) }));
DB.ads = {
  formulas: [
    { id: 'af1', name: 'Profil mis en avant — 7 jours', type: 'Profil', duration: 7, price: 29, desc: 'Votre profil en tête de l’annuaire des coachs.' },
    { id: 'af2', name: 'Profil mis en avant — 30 jours', type: 'Profil', duration: 30, price: 99, desc: 'Visibilité maximale pendant un mois.' },
    { id: 'af3', name: 'Boutique en vedette — 14 jours', type: 'Boutique', duration: 14, price: 49, desc: 'Vos produits mis en avant auprès de vos athlètes.' },
  ],
  campaigns: [
    { id: 'ac1', coachId: 'c2', type: 'Profil', duration: 30, amount: 99, status: 'Exemple' },
    { id: 'ac2', coachId: 'c4', type: 'Boutique', duration: 14, amount: 49, status: 'Exemple' },
  ],
  discounts: [{ id: 'ad1', code: 'ADS-LAUNCH', value: '−20 %', status: 'Brouillon' }],
};
DB.gdprRequests = [
  { id: 'g1', userId: athleteById('a54') ? 'a54' : 'a50', type: 'delete', date: D(-3, 13, 45), status: 'pending' },
  { id: 'g2', userId: 'a33', type: 'export', date: D(-1, 10, 0), status: 'pending' },
];
DB.notifications = [
  { id: 'n1', to: 'c1', text: '<b>Camille Petit</b> a passé la commande #1042', at: D(0, 9, 2), read: false, ic: 'bag', link: '/coach/shop/orders' },
  { id: 'n2', to: 'c1', text: '<b>Léa Martin</b> vous a envoyé le bilan de sa séance', at: D(-1, 20, 12), read: false, ic: 'activity', link: '/coach/messages' },
  { id: 'n3', to: 'c1', text: 'Paiement en échec : <b>Inès Dubois</b> (carte expirée)', at: D(-1, 9, 12), read: false, ic: 'alert', link: '/coach/clients/a4/apercu' },
  { id: 'n4', to: 'c1', text: 'Nouveau client pré-inscrit : <b>Franck Benchetrit</b>', at: D(-1, 18, 4), read: true, ic: 'userPlus', link: '/coach/clients' },
  { id: 'n5', to: 'a1', text: '<b>Thomas</b> a ajusté vos charges (+1,5 %)', at: D(-6, 20, 40), read: true, ic: 'trendUp', link: '/athlete/program' },
  { id: 'n6', to: 'a1', text: 'Rappel : <b>Bilan mensuel</b> aujourd’hui à 14:00 (visio)', at: D(0, 7, 0), read: false, ic: 'calendar', link: '/athlete/coach' },
  { id: 'n7', to: 'a1', text: 'Nouvelle séance ponctuelle : <b>Cardio Fractionné</b>', at: D(-1, 12, 0), read: false, ic: 'dumbbell', link: '/athlete/sessions' },
  { id: 'n8', to: 'a2', text: 'Bienvenue sur ELEV8 ! Choisissez un programme ELEV8 pour démarrer.', at: D(-18, 8, 6), read: true, ic: 'sparkles', link: '/athlete/elev8-programs' },
  { id: 'n9', to: 'admin', text: '<b>3 demandes de certification</b> en attente', at: D(0, 7, 0), read: false, ic: 'award', link: '/admin/certifications' },
  { id: 'n10', to: 'admin', text: 'Ticket critique <b>T-1042</b> — vidéos noires', at: D(0, 7, 12), read: false, ic: 'alert', link: '/admin/support' },
  { id: 'n11', to: 'admin', text: 'Santé API : <b>Intégrations montres</b> dégradé', at: D(0, 6, 30), read: false, ic: 'heartPulse', link: '/admin/api-health' },
];
DB.faq = [
  ['Combien coûte l’application ?', 'L’abonnement coach est de 59 € (Start), 99 € (Pro) ou 199 € (Elite) par mois, payé par carte sur le site web. Le paiement annuel donne −20 %. Les athlètes ne paient rien à ELEV8.'],
  ['Comment fonctionne l’essai gratuit ?', 'L’essai donne accès aux fonctions Start avec 3 clients maximum. À la fin de l’essai, choisissez une formule depuis Paramètres > Abonnement (durée de l’essai à préciser).'],
  ['Mes données sont-elles sécurisées ?', 'Les données sont chiffrées en transit et au repos. Les données de santé issues des montres ne sont partagées avec le coach qu’avec l’accord explicite de l’athlète.'],
  ['Puis-je exporter mes données ?', 'Oui : demandez un export depuis vos paramètres, l’équipe ELEV8 traite la demande sous 30 jours (RGPD).'],
  ['Suis-je engagé·e ?', 'Non, l’abonnement mensuel est sans engagement. L’abonnement annuel est payé en une fois.'],
  ['Pourquoi le paiement se fait-il sur le web et pas dans l’app ?', 'Pour éviter les commissions des stores, tous les paiements (abonnement, honoraires, Boutique) passent par un paiement web sécurisé.'],
  ['ELEV8 prend-il une commission sur mes clients ?', 'Non, aucune commission sur les honoraires de coaching. Seules les ventes en Boutique sont soumises à une commission ELEV8.'],
];
DB.docs = [
  { id: 'd1', title: 'Décisions à prendre avant le développement', cat: 'Produit', updated: D(-2), body: '<p>Points ouverts relevés dans le cahier des charges MVP :</p><ul><li><b>Vidéos de la bibliothèque</b> : scénario 1 (hébergement ELEV8), 2 (YouTube non répertorié) et/ou 3 (production de vidéos originales). Ne reprendre aucun média du jeu de données public sans licence commerciale.</li><li><b>Programme ambassadeur</b> : base de calcul de la commission (quels paiements, quelle durée) et date de versement.</li><li><b>Rôles Super Admin</b> : liste des rôles et de leurs droits (proposition dans Paramètres).</li><li><b>Communauté</b> annoncée dans la formule Pro mais hors MVP : la masquer ou la construire.</li><li><b>Durée de l’essai gratuit</b> à préciser.</li><li><b>Marques de montres</b> à confirmer avec le développeur.</li><li><b>Publicités</b> : page présente sur la maquette mais prévue pour plus tard.</li><li><b>Commission Boutique</b> : taux à confirmer (8 % dans ce prototype).</li></ul>' },
  { id: 'd2', title: 'Circulation de l’argent', cat: 'Paiements', updated: D(-10), body: '<p>Trois flux séparés, tous en <b>paiement web</b> (jamais d’achat intégré App Store / Google Play) :</p><ol><li>Abonnement du coach à ELEV8 (59 à 199 €/mois).</li><li>Honoraires athlète → coach via Stripe Connect, <b>0 % de commission</b> ELEV8.</li><li>Achats Boutique via Stripe Connect, commission ELEV8 prélevée avant reversement, KYC renforcé du coach.</li></ol>' },
  { id: 'd3', title: 'RIR et RPE', cat: 'Sport', updated: D(-40), body: '<p><b>RIR</b> : nombre de répétitions qu’il restait avant l’échec. <b>RPE</b> : effort perçu de 1 à 10. Le coach fixe une cible, l’athlète renseigne la valeur réelle à chaque série.</p>' },
  { id: 'd4', title: 'Données de santé et montres connectées', cat: 'Conformité', updated: D(-25), body: '<p>Lecture seule des données (FC, calories, distance, allure, pas, sommeil, FC au repos). Consentement explicite, partage coach optionnel, déconnexion et suppression à tout moment.</p>' },
  { id: 'd5', title: 'Photos générées par IA', cat: 'Nutrition', updated: D(-18), body: '<p>Générées une fois en amont, même ligne visuelle, sans marque, logo ni personne. Purement illustratives : les macros viennent toujours des données nutritionnelles.</p>' },
];
