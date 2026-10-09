'use strict';
/* =========================================================
   ELEV8 — Pôle Sport (3/3) : planning athlète, séance en direct,
   bilan de fin de séance, carte-résumé téléchargeable
   ========================================================= */
var Sport = window.Sport || {};
(() => {
  /* ---------- Planning & indicateurs ---------- */
  Sport.scheduleFor = (athleteId) => {
    const out = [];
    DB.assignments.filter((x) => x.athleteId === athleteId && x.status !== 'ended').forEach((asg) => assignmentSchedule(asg).forEach((e) => out.push({ ...e, source: 'program', asg })));
    DB.oneOffs.filter((o) => o.athleteId === athleteId).forEach((o) => out.push({ date: parseYmd(o.date), sessionId: o.sessionId, source: 'oneoff', oneOff: o }));
    const logs = DB.logs.filter((l) => l.athleteId === athleteId); const t0 = today0();
    out.forEach((e) => { e.log = logs.find((l) => l.sessionId === e.sessionId && isSameDay(l.date, e.date)) || null; e.status = e.log ? 'done' : startDay(e.date) < t0 ? 'missed' : isSameDay(e.date, t0) ? 'today' : 'upcoming'; });
    return out.sort((a, b) => a.date - b.date);
  };
  Sport.activeAsg = (athleteId) => DB.assignments.find((x) => x.athleteId === athleteId && (x.status === 'active' || x.status === 'paused'));
  Sport.asgProgress = (asg) => { const sch = Sport.scheduleFor(asg.athleteId).filter((e) => e.asg && e.asg.id === asg.id); const done = sch.filter((e) => e.status === 'done').length; return { done, total: sch.length, pct: pct(done, sch.length) }; };
  Sport.adherence = (athleteId) => { const sch = Sport.scheduleFor(athleteId).filter((e) => e.status === 'done' || e.status === 'missed'); return sch.length ? pct(sch.filter((e) => e.status === 'done').length, sch.length) : null; };
  Sport.streak = (athleteId) => {
    const days = new Set(DB.logs.filter((l) => l.athleteId === athleteId).map((l) => ymd(l.date)));
    (DB.habits[athleteId] || []).forEach((h) => h.history.forEach((x) => { if (x.done) days.add(x.date); }));
    let n = 0; let d = new Date(); if (!days.has(ymd(d))) d = addDays(d, -1);
    while (days.has(ymd(d))) { n++; d = addDays(d, -1); }
    return n;
  };
  Sport.todayEntry = (athleteId) => Sport.scheduleFor(athleteId).find((e) => isSameDay(e.date, new Date()));
  Sport.logsOf = (athleteId) => DB.logs.filter((l) => l.athleteId === athleteId).sort((a, b) => new Date(b.date) - new Date(a.date));
  Sport.totalVolume = (athleteId) => sum(DB.logs.filter((l) => l.athleteId === athleteId), (l) => l.volume);
  Sport.prevSets = (athleteId, sessionId, exId, before = new Date()) => {
    const l = DB.logs.filter((x) => x.athleteId === athleteId && new Date(x.date) < before && x.exercises.some((e) => e.exId === exId && e.sets.length)).sort((a, b) => new Date(b.date) - new Date(a.date))[0];
    return l ? l.exercises.find((e) => e.exId === exId).sets : null;
  };

  /* ---------- Séance en direct ---------- */
  let L = null; let tickId = null;
  const parseLoad = (v) => { const n = Number(String(v).replace(',', '.')); return String(v).trim() !== '' && Number.isFinite(n) ? n : String(v).trim(); };
  Sport.liveInit = (s, a, query) => {
    const asg = query.asg ? byId(DB.assignments, query.asg) : Sport.activeAsg(a.id);
    const pAdj = asg && asg.programId && programById(asg.programId).weeks.flat().includes(s.id) ? asg.loadPct : 0;
    const sets = {};
    s.items.forEach((it) => {
      const isW = it.labels.load === 'Charge'; const load = isW && isNum(it.load) ? (Number(it.load) > 0 ? Sport.adj(it.load, pAdj) : 0) : it.load;
      sets[it.key] = Array.from({ length: Number(it.sets) || 1 }, () => ({ reps: it.reps, load, rpe: Number(it.rpe) || 7, rir: it.rir === '' ? null : Number(it.rir), time: null, note: '', done: false }));
    });
    return { sid: s.id, athleteId: a.id, asgId: asg ? asg.id : null, pAdj, startedAt: Date.now(), idx: 0, sets, skipped: new Set(), videos: {}, details: {}, rest: null, chrono: null, hr: 98, hrSamples: [], finished: false, showVideo: false };
  };
  const curSet = (key) => L.sets[key].findIndex((x) => !x.done);
  const itemDone = (key) => L.skipped.has(key) || curSet(key) < 0;
  const stopTick = () => { if (tickId) clearInterval(tickId); tickId = null; const ov = $('#rest-ov'); if (ov) ov.remove(); };
  const startTick = () => {
    if (tickId) return;
    let n = 0;
    tickId = setInterval(() => {
      if (!L) return; n++;
      const el = $('#live-elapsed'); if (el) el.textContent = fmt.clock((Date.now() - L.startedAt) / 1000);
      const a = athleteById(L.athleteId);
      if (a && a.watch.connected && n % 4 === 0) {
        const target = L.rest ? 104 : 142; L.hr = Math.round(clamp(L.hr + (target - L.hr) * 0.08 + rnd(-3, 3), 78, 186));
        const h = $('#live-hr'); if (h) h.textContent = L.hr;
        if (n % 20 === 0) L.hrSamples.push(L.hr);
      }
      if (L.chrono && L.chrono.running) {
        const now = Date.now(); L.chrono.elapsed += now - L.chrono.last; L.chrono.last = now;
        const c = L.chrono; const t = $('#live-chrono');
        if (c.mode === 'countdown') {
          const rem = c.duration - c.elapsed / 1000;
          if (t) t.textContent = fmt.clock(Math.ceil(Math.max(0, rem)));
          if (rem <= 0) { c.running = false; Sound.beep(988, 0.2, 3); vibrate([300, 120, 300]); recordChrono(c.duration); const box = $('#live-chrono-box'); if (box) box.classList.add('alarm'); toast('Temps écoulé ! Temps enregistré dans la série', 'info'); }
        } else if (t) t.textContent = fmt.clock(c.elapsed / 1000);
      }
      if (L.rest) {
        L.rest.remaining -= 0.25;
        const rt = $('#rest-t'); if (rt) rt.textContent = fmt.clock(Math.ceil(Math.max(0, L.rest.remaining)));
        const ring = $('#rest-ring'); if (ring) { const C = 2 * Math.PI * 108; ring.setAttribute('stroke-dashoffset', String(C * (1 - clamp(L.rest.remaining / L.rest.total, 0, 1)))); }
        if (L.rest.remaining <= 0) { Sound.beep(880, 0.18, 2); vibrate([200, 100, 200]); endRest(); }
      }
    }, 250);
  };
  const recordChrono = (secs) => {
    const s = sessionById(L.sid); const it = s.items[L.idx]; const k = curSet(it.key); if (k < 0) return;
    L.sets[it.key][k].time = Math.round(secs);
    if (Sport.isTimeLabel(it.labels.reps)) { const v = /min/i.test(it.labels.reps) ? round(secs / 60, 1) : Math.round(secs); L.sets[it.key][k].reps = v; const inp = $('#live-reps'); if (inp) inp.value = v; }
  };
  const showRest = (secs, next) => {
    L.rest = { remaining: secs, total: secs, next };
    const C = 2 * Math.PI * 108;
    const ov = document.createElement('div'); ov.id = 'rest-ov'; ov.className = 'rest-ov';
    ov.innerHTML = `<div class="upper" style="color:#C5F23A">Repos obligatoire</div><div class="rest-ring"><svg width="240" height="240"><circle cx="120" cy="120" r="108" fill="none" stroke="rgba(255,255,255,.12)" stroke-width="12"/><circle id="rest-ring" cx="120" cy="120" r="108" fill="none" stroke="#C5F23A" stroke-width="12" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="0"/></svg><div class="rest-t"><b id="rest-t">${fmt.clock(secs)}</b><span style="color:#AEB4C0">secondes restantes</span></div></div>
      <div class="next">Ensuite : <b style="color:#fff">${esc(next)}</b></div>
      <div class="rest-adj"><button data-rest="-30">−30 s</button><button data-rest="-15">−15 s</button><button data-rest="15">+15 s</button><button data-rest="30">+30 s</button></div>
      <button class="btn btn-accent btn-lg" data-rest-skip>${icon('skip', 18)} Passer à la série suivante</button><div class="lock">${icon('lock', 13)} Le repos ne peut pas être désactivé — ajustez-le ou passez-le.</div>`;
    ov.addEventListener('click', (e) => {
      const b = e.target.closest('[data-rest]'); if (b) { L.rest.remaining = Math.max(1, L.rest.remaining + Number(b.dataset.rest)); L.rest.total = Math.max(L.rest.total, L.rest.remaining); $('#rest-t').textContent = fmt.clock(L.rest.remaining); }
      if (e.target.closest('[data-rest-skip]')) endRest();
    });
    $('#overlay').appendChild(ov);
  };
  const endRest = () => { L.rest = null; const ov = $('#rest-ov'); if (ov) ov.remove(); rerender(); };
  const nextStep = (s) => {
    const items = s.items; const groups = Sport.groups(items); const g = groups.find(([a, b]) => L.idx >= a && L.idx <= b);
    const it = items[L.idx]; const setNo = L.sets[it.key].filter((x) => x.done).length;
    if (L.idx < g[1]) { const nx = items[L.idx + 1]; if (!itemDone(nx.key) && L.sets[nx.key].filter((x) => x.done).length < setNo) { L.idx += 1; return { rest: 0 }; } }
    for (let k = g[0]; k <= g[1]; k++) if (!itemDone(items[k].key)) { L.idx = k; return { rest: Number(it.rest) || 0, label: `${exById(items[k].exId).name} — série ${curSet(items[k].key) + 1}` }; }
    for (let k = g[1] + 1; k < items.length; k++) if (!itemDone(items[k].key)) { L.idx = k; return { rest: Number(it.rest) || 0, label: `${exById(items[k].exId).name} — série 1` }; }
    for (let k = 0; k < items.length; k++) if (!itemDone(items[k].key)) { L.idx = k; return { rest: Number(it.rest) || 0, label: exById(items[k].exId).name }; }
    return { done: true };
  };
  Sport.liveView = (sid, query = {}) => {
    const s = sessionById(sid); const a = meAthlete();
    if (!s) { go('/athlete/sessions'); return null; }
    if (!L || L.sid !== sid || L.finished || L.athleteId !== a.id) L = Sport.liveInit(s, a, query);
    const items = s.items; const lab = Sport.labels(items); const groups = Sport.groups(items);
    const allDone = items.every((it) => itemDone(it.key));
    const it = items[L.idx]; const x = exById(it.exId); const L2 = it.labels; const k = curSet(it.key);
    const g = groups.find(([p, q]) => L.idx >= p && L.idx <= q); const inG = g[1] > g[0];
    const prev = Sport.prevSets(a.id, s.id, it.exId, new Date(L.startedAt));
    const coach = a.coachId ? coachById(a.coachId) : null;
    const top = `<div class="live-top"><div class="live-top-in"><button class="icon-btn" data-action="live-quit" title="Quitter">${icon('x')}</button><div class="grow" style="min-width:0"><div class="semibold truncate">${esc(s.name)}</div><div class="xs dim">Exercice ${L.idx + 1}/${items.length} · <span id="live-elapsed">${fmt.clock((Date.now() - L.startedAt) / 1000)}</span></div></div>${a.watch.connected ? `<span class="hr-live" title="Fréquence cardiaque (montre)">${icon('heart', 15)}<span id="live-hr">${L.hr}</span> bpm</span>` : ''}<button class="btn btn-outline btn-sm" data-action="live-finish">Terminer</button></div><div class="live-prog">${items.map((x2, i) => `<i class="${L.skipped.has(x2.key) ? 'skip' : itemDone(x2.key) ? 'done' : i === L.idx ? 'cur' : ''}"></i>`).join('')}</div></div>`;
    if (allDone) {
      return { title: s.name, html: `${top}<div class="live"><div class="today-card center" style="align-items:center;padding:40px 24px"><div style="font-size:54px">🎉</div><h1 style="color:#fff">Toutes les séries sont validées !</h1><p class="muted">${fmt.clock((Date.now() - L.startedAt) / 1000)} d’entraînement. Terminez la séance pour voir votre bilan.</p><button class="btn btn-accent btn-lg mt-8" data-action="live-done">${icon('check', 18)} Terminer et voir le bilan</button></div></div>`, mount: () => { startTick(); onLeave(stopTick); } };
    }
    const tgt = [`${it.sets} séries`, `${it.reps} ${esc(L2.reps === 'Reps' ? 'reps' : L2.reps)}`, isNum(it.load) && L2.load === 'Charge' ? (Number(it.load) > 0 ? `${fmt.num(Sport.adj(it.load, L.pAdj), 1)} kg${L.pAdj ? ` (${L.pAdj > 0 ? '+' : ''}${fmt.num(L.pAdj, 1)} %)` : ''}` : 'Poids du corps') : it.load ? `${esc(L2.load)} ${esc(it.load)}` : '', it.rest ? `Repos ${it.rest} s` : 'Sans repos', Sport.tempoStr(it.tempo) && `Tempo ${Sport.tempoStr(it.tempo)}`, it.rir !== '' && `RIR cible ${it.rir}`, it.rpe !== '' && `RPE cible ${it.rpe}`].filter(Boolean);
    const cur = k >= 0 ? L.sets[it.key][k] : null;
    const rows = L.sets[it.key].map((st, i) => {
      const p = prev && prev[i] ? `${prev[i].load !== '' && prev[i].load != null && Number(prev[i].load) > 0 ? `${fmt.num(prev[i].load, 1)} kg × ` : ''}${prev[i].reps}` : '—';
      if (st.done) return `<div class="set-row done"><span class="set-n">${i + 1}</span><span class="set-prev">${p}</span><b>${esc(st.reps)}</b><b>${st.load === '' || st.load == null ? '—' : isNum(st.load) && L2.load === 'Charge' ? `${fmt.num(st.load, 1)} kg` : esc(st.load)}</b><span class="set-ok" title="RPE ${st.rpe}${st.rir != null ? ` · RIR ${st.rir}` : ''}">${icon('check', 16)}</span></div>`;
      if (i === k) return `<div class="set-row current"><span class="set-n">${i + 1}</span><span class="set-prev">${p}</span><input class="input sm center" id="live-reps" inputmode="decimal" value="${esc(st.reps)}" aria-label="${esc(L2.reps)}"><input class="input sm center" id="live-load" inputmode="decimal" value="${esc(st.load)}" aria-label="${esc(L2.load)}" ${L2.load === 'Charge' || it.load !== '' ? '' : 'placeholder="—"'}><span class="set-ok">${i + 1}</span></div>`;
      return `<div class="set-row" style="opacity:.6"><span class="set-n">${i + 1}</span><span class="set-prev">${p}</span><span>${esc(st.reps)}</span><span>${st.load === '' ? '—' : esc(isNum(st.load) && L2.load === 'Charge' ? `${fmt.num(st.load, 1)} kg` : st.load)}</span><span class="set-ok"></span></div>`;
    }).join('');
    const chronoMode = L.chrono && L.chrono.key === it.key ? L.chrono.mode : it.timer.mode !== 'none' ? it.timer.mode : null;
    const ch = L.chrono && L.chrono.key === it.key ? L.chrono : null;
    const chronoTime = ch ? (ch.mode === 'countdown' ? fmt.clock(Math.ceil(Math.max(0, ch.duration - ch.elapsed / 1000))) : fmt.clock(ch.elapsed / 1000)) : chronoMode === 'countdown' ? fmt.clock(it.timer.duration) : '00:00';
    const chrono = chronoMode ? `<div class="chrono" id="live-chrono-box"><span class="li-ic" style="background:rgba(255,255,255,.1);color:#C5F23A">${icon(chronoMode === 'countdown' ? 'timer' : 'stopwatch', 18)}</span><div class="grow"><div class="xs" style="color:#AEB4C0">${chronoMode === 'countdown' ? `Compte à rebours · ${it.timer.duration} s${it.timer.sets ? ` · ${it.timer.sets} séries` : ''}` : 'Chrono libre'}</div><div class="time" id="live-chrono">${chronoTime}</div></div><button class="btn btn-accent btn-sm" data-action="live-chrono" data-mode="${chronoMode}">${icon(ch && ch.running ? 'pause' : 'play', 15)} ${ch && ch.running ? 'Pause' : ch && ch.elapsed ? 'Reprendre' : 'Lancer'}</button><button class="btn btn-outline btn-sm" data-action="live-chrono-reset" title="Réinitialiser">${icon('reset', 15)}</button></div>` : '';
    const rpeNow = cur ? cur.rpe : 7; const rr = Sport.rpe(rpeNow);
    const video = L.videos[it.key];
    const html = `${top}<div class="live">
      ${inG ? `<div class="notice violet mb-12">${icon('repeat', 16)}<div><b>${Sport.groupName(g[1] - g[0] + 1)} ${lab[g[0]].charAt(0)}</b> — enchaînez ${items.slice(g[0], g[1] + 1).map((y) => esc(exById(y.exId).name)).join(' → ')} sans repos.</div></div>` : ''}
      <div class="row between gap-12 mb-12"><div class="row gap-12" style="min-width:0"><span class="sb-num ${inG ? 'grp' : ''}" style="min-width:38px;height:38px">${lab[L.idx]}</span><div style="min-width:0"><h2 class="truncate">${esc(x.name)}</h2><div class="xs dim">${esc(x.muscles.join(', '))}</div></div></div><div class="row"><button class="btn btn-ghost btn-sm" data-action="live-video">${icon('video', 15)} <span class="hide-sm">${L.showVideo ? 'Masquer' : 'Vidéo'}</span></button><button class="btn btn-ghost btn-sm" data-action="ex-open" data-id="${x.id}" data-ctx="athlete">${icon('info', 15)}</button></div></div>
      ${L.showVideo ? `<div class="mb-12">${VMock.html(x, { autoplay: true })}</div>` : ''}
      <div class="target-line mb-12">${tgt.map((t) => `<span class="tag">${t}</span>`).join('')}</div>
      ${it.note ? `<div class="notice blue mb-12">${icon('message', 16)}<div><b>Consigne du coach :</b> ${esc(it.note)}</div></div>` : ''}
      ${chrono ? `<div class="mb-12">${chrono}</div>` : ''}
      <div class="set-table"><div class="set-head"><span>Série</span><span>Précédent</span><span>${esc(L2.reps)}</span><span>${esc(L2.load)}</span><span></span></div>${rows}</div>
      ${cur ? `<div class="rpe-box mt-16"><div class="row between"><span class="label">Effort ressenti (RPE)</span><button class="btn btn-ghost btn-xs" data-action="rpe-scale">${icon('info', 13)} Échelle</button></div><div class="rpe-val mt-8"><b id="rpe-n" style="color:${Sport.rpeColor(rpeNow)}">${rpeNow}</b><div><div class="semibold" id="rpe-l">${esc(rr[1])}</div><div class="xs dim" id="rpe-r">${esc(rr[2])}</div></div></div><input type="range" min="1" max="10" step="1" value="${rpeNow}" data-live-rpe class="mt-12"><div class="rpe-ticks">${RPE_SCALE.map((r2) => `<span>${r2[0]}</span>`).join('')}</div>
        ${it.rir !== '' ? `<div class="label mt-16 mb-8">Répétitions en réserve (RIR) — demandé par votre coach</div><div class="chips rir-chips">${[0, 1, 2, 3, 4, 5].map((n) => `<button type="button" class="chip ${cur.rir === n ? 'active' : ''}" data-action="live-rir" data-v="${n}">${n}${n === 5 ? '+' : ''}</button>`).join('')}</div>` : ''}</div>
      <div class="row wrap gap-8 mt-12"><button class="btn btn-outline btn-sm" data-action="live-details">${icon('edit', 14)} Détails</button><label class="btn btn-outline btn-sm">${icon('camera', 14)} Capturer l’exécution<input type="file" accept="video/*" capture="environment" hidden data-live-capture></label>${!chronoMode ? `<button class="btn btn-outline btn-sm" data-action="live-chrono" data-mode="free">${icon('stopwatch', 14)} Chrono libre</button>` : ''}</div>
      ${L.details[it.key] ? `<div class="mt-12">${field('Remarque sur la série', `<textarea class="textarea" rows="2" data-live-note placeholder="Sensations, douleur, matériel…">${esc(cur.note)}</textarea>`)}</div>` : ''}
      ${video ? `<div class="tile soft row gap-12 mt-12"><div style="width:120px;flex:none" class="vmock">${mediaPreview(video)}</div><div class="grow"><div class="semibold">Vidéo enregistrée</div><div class="xs dim">${esc(Uploads[video] ? Uploads[video].name : '')}</div></div>${coach ? `<button class="btn btn-primary btn-sm" data-action="live-send-video">${icon('send', 14)} Envoyer au coach</button>` : ''}</div>` : ''}` : ''}
      <div class="row between mt-20"><button class="btn btn-ghost btn-sm" data-action="live-nav" data-dir="-1" ${L.idx === 0 ? 'disabled' : ''}>${icon('chevL', 15)} Précédent</button><button class="btn btn-ghost btn-sm t-red" data-action="live-skip">${icon('skip', 15)} Passer l’exercice</button><button class="btn btn-ghost btn-sm" data-action="live-nav" data-dir="1" ${L.idx === items.length - 1 ? 'disabled' : ''}>Suivant ${icon('chevR', 15)}</button></div>
    </div>`;
    const bottom = `<div class="live-bar"><div class="live-bar-in"><button class="btn btn-primary btn-xl btn-block" data-action="live-validate">${icon('check', 20)} Valider la série ${k + 1}/${it.sets}</button></div></div>`;
    return { title: s.name, html, bottom, mount: () => { startTick(); onLeave(stopTick); if (L.rest && !$('#rest-ov')) showRest(L.rest.remaining, L.rest.next); } };
  };
  document.addEventListener('input', (e) => {
    if (!L) return;
    if (e.target.matches && e.target.matches('[data-live-rpe]')) {
      const s = sessionById(L.sid); const it = s.items[L.idx]; const k = curSet(it.key); const v = Number(e.target.value); if (k >= 0) L.sets[it.key][k].rpe = v;
      const r = Sport.rpe(v); $('#rpe-n').textContent = v; $('#rpe-n').style.color = Sport.rpeColor(v); $('#rpe-l').textContent = r[1]; $('#rpe-r').textContent = r[2];
    }
    if (e.target.matches && e.target.matches('[data-live-note]')) { const it = sessionById(L.sid).items[L.idx]; const k = curSet(it.key); if (k >= 0) L.sets[it.key][k].note = e.target.value; }
  });
  document.addEventListener('change', async (e) => {
    if (!L || !(e.target.matches && e.target.matches('[data-live-capture]')) || !e.target.files[0]) return;
    const id = await readUpload(e.target.files[0]); L.videos[sessionById(L.sid).items[L.idx].key] = id; toast('Vidéo d’exécution enregistrée'); rerender();
  });
  const saveInputs = () => {
    const s = sessionById(L.sid); const it = s.items[L.idx]; const k = curSet(it.key); if (k < 0) return null;
    const st = L.sets[it.key][k]; const r = $('#live-reps'); const l = $('#live-load');
    if (r) st.reps = parseLoad(r.value); if (l) st.load = parseLoad(l.value);
    return st;
  };
  Object.assign(Actions, {
    'live-validate': () => {
      const s = sessionById(L.sid); const it = s.items[L.idx]; const st = saveInputs(); if (!st) return;
      st.done = true; if (L.chrono && L.chrono.key === it.key) { if (L.chrono.mode === 'free' && L.chrono.elapsed) st.time = Math.round(L.chrono.elapsed / 1000); L.chrono = null; }
      vibrate(40);
      const step = nextStep(s);
      if (step.done) { rerender(); return; }
      if (step.rest > 0) showRest(step.rest, step.label);
      rerender();
    },
    'live-rir': (el) => { const it = sessionById(L.sid).items[L.idx]; const k = curSet(it.key); saveInputs(); L.sets[it.key][k].rir = Number(el.dataset.v); rerender(); },
    'live-details': () => { const it = sessionById(L.sid).items[L.idx]; saveInputs(); L.details[it.key] = !L.details[it.key]; rerender(); },
    'live-video': () => { saveInputs(); L.showVideo = !L.showVideo; rerender(); },
    'live-nav': (el) => { saveInputs(); const s = sessionById(L.sid); L.idx = clamp(L.idx + Number(el.dataset.dir), 0, s.items.length - 1); L.chrono = null; rerender(); },
    'live-skip': () => { const s = sessionById(L.sid); const it = s.items[L.idx]; L.skipped.add(it.key); toast(`« ${esc(exById(it.exId).name)} » passé`, 'info'); const nx = s.items.findIndex((y) => !itemDone(y.key)); if (nx >= 0) L.idx = nx; L.chrono = null; rerender(); },
    'live-chrono': (el) => {
      const it = sessionById(L.sid).items[L.idx]; saveInputs();
      if (!L.chrono || L.chrono.key !== it.key) L.chrono = { key: it.key, mode: el.dataset.mode, duration: Number(it.timer.duration) || 30, elapsed: 0, running: false, last: Date.now() };
      L.chrono.running = !L.chrono.running; L.chrono.last = Date.now(); rerender();
    },
    'live-chrono-reset': () => { saveInputs(); if (L.chrono) { L.chrono.elapsed = 0; L.chrono.running = false; } rerender(); },
    'live-send-video': () => {
      const a = athleteById(L.athleteId); const s = sessionById(L.sid); const it = s.items[L.idx]; const id = L.videos[it.key];
      const t = ChatUI.threadBetween(a.coachId, a.id); ChatUI.send(t.id, a.id, 'Ma vidéo d’exécution 🎥', { type: 'video', data: { name: Uploads[id] ? Uploads[id].name : 'video.mp4', exercise: exById(it.exId).name } });
      notify(a.coachId, `<b>${esc(fullName(a))}</b> vous a envoyé une vidéo d’exécution`, `/coach/messages/${t.id}`, 'video'); toast('Vidéo envoyée à votre coach');
    },
    'live-quit': async () => { if (await confirmDialog({ title: 'Quitter la séance ?', message: 'Votre progression est conservée tant que vous restez dans l’application.', confirm: 'Quitter' })) { stopTick(); go('/athlete/sessions'); } },
    'live-finish': async () => {
      const s = sessionById(L.sid); const remaining = s.items.some((it) => !itemDone(it.key));
      if (remaining && !(await confirmDialog({ title: 'Terminer la séance maintenant ?', message: 'Les séries non validées seront comptées comme non réalisées dans votre bilan.', confirm: 'Terminer' }))) return;
      Actions['live-done']();
    },
    'live-done': () => {
      saveInputs();
      const s = sessionById(L.sid); const a = athleteById(L.athleteId);
      let planned = 0; let done = 0; let vol = 0; let rpeS = 0; let rpeN = 0;
      const exercises = s.items.map((it) => {
        const sets = L.sets[it.key].filter((x) => x.done).map((x) => ({ reps: x.reps, load: x.load, rpe: x.rpe, rir: x.rir, time: x.time, note: x.note, done: true }));
        planned += Number(it.sets) || 1; done += sets.length;
        sets.forEach((x) => { if (isNum(x.load) && isNum(x.reps)) vol += Number(x.load) * Number(x.reps); rpeS += x.rpe; rpeN++; });
        const target = parseInt(it.reps, 10); const pl = it.labels.load === 'Charge' && isNum(it.load) ? Sport.adj(it.load, L.pAdj) : it.load;
        const status = !sets.length ? 'skipped' : sets.length < (Number(it.sets) || 1) || sets.some((x) => Number(x.reps) !== target || (isNum(pl) && Number(x.load) !== Number(pl))) ? 'modified' : 'done';
        return { key: it.key, exId: it.exId, status, sets, planned: { sets: Number(it.sets) || 1, reps: target || it.reps, load: pl } };
      });
      const duration = Math.max(60, Math.round((Date.now() - L.startedAt) / 1000));
      const hrS = L.hrSamples.length > 3 ? L.hrSamples : Array.from({ length: 24 }, (_, i) => Math.round(108 + 30 * Math.sin(i / 2.3) ** 2 + rnd(0, 14)));
      const log = { id: uid('log'), athleteId: a.id, sessionId: s.id, asgId: L.asgId, date: new Date().toISOString(), duration, exercises, volume: Math.round(vol), completion: pct(done, planned), rpeAvg: rpeN ? round(rpeS / rpeN, 1) : null,
        watch: a.watch.connected ? { hrAvg: Math.round(avg(hrS)), hrMax: Math.max(...hrS), kcal: Math.round((duration / 60) * 7.4), hrSeries: hrS, distance: s.type === 'Cardio' ? 5.8 : null, pace: s.type === 'Cardio' ? '5:32/km' : null } : null,
        sentToCoach: false, notes: '', video: Object.values(L.videos)[0] || null };
      DB.logs.push(log); a.lastSession = log.date; L.finished = true; stopTick();
      if (a.coachId) notify(a.coachId, `<b>${esc(fullName(a))}</b> a terminé « ${esc(s.name)} » (${log.completion} %)`, `/coach/clients/${a.id}/sessions`, 'activity');
      go(`/athlete/summary/${log.id}`);
    },
    'rpe-scale': () => openModal({ title: 'RIR et RPE : deux échelles différentes', size: 'md', body: `<p class="small muted mb-12"><b>RIR</b> (Repetitions In Reserve) : le nombre de répétitions que vous pourriez encore faire en fin de série. <b>RPE</b> (Rate of Perceived Exertion) : comment vous vous sentez, de 1 à 10. ELEV8 prescrit le plus souvent un effort entre 3 et 8.</p><table class="table compact scale-table"><thead><tr><th>Note</th><th>Ressenti</th><th>Repère</th></tr></thead><tbody>${RPE_SCALE.map(([n, l, r]) => `<tr><td><span class="rpe-badge" style="background:${Sport.rpeColor(n)}">${n}</span></td><td class="semibold">${l}</td><td class="muted">${r}</td></tr>`).join('')}</tbody></table>` }),
  });

  /* ---------- Bilan de fin de séance ---------- */
  Sport.summaryHTML = (log, { ctx = 'athlete' } = {}) => {
    const s = sessionById(log.sessionId); const a = athleteById(log.athleteId);
    const doneEx = log.exercises.filter((e) => e.status !== 'skipped');
    const muscles = unique(doneEx.flatMap((e) => (exById(e.exId) || { muscles: [] }).muscles));
    const labels = log.exercises.map((e) => { const n = (exById(e.exId) || {}).name || '?'; return n.length > 16 ? `${n.slice(0, 15)}…` : n; });
    const plannedWork = (e) => { const p = e.planned; const reps = Number(p.reps) || 0; return isNum(p.load) && Number(p.load) > 0 ? p.sets * reps * Number(p.load) : p.sets * reps; };
    const realWork = (e) => sum(e.sets, (x) => (isNum(x.load) && Number(x.load) > 0 && isNum(e.planned.load) && Number(e.planned.load) > 0 ? Number(x.reps) * Number(x.load) : Number(x.reps) || 0));
    const real = log.exercises.map((e) => { const p = plannedWork(e); return p ? Math.round((realWork(e) / p) * 100) : 0; });
    const chart = Charts.bars({ labels, series: [{ name: 'Prévu', color: 'var(--s1)', values: log.exercises.map(() => 100) }, { name: 'Réalisé', color: 'var(--s2)', values: real }], height: 230, yFmt: (v) => `${fmt.num(v)} %`, yMax: Math.max(110, ...real) });
    const exList = log.exercises.map((e) => { const x = exById(e.exId); return `<div class="li"><span class="li-ic ${e.status === 'done' ? 'green' : e.status === 'modified' ? 'amber' : 'red'}">${icon(e.status === 'done' ? 'check' : e.status === 'modified' ? 'edit' : 'skip', 16)}</span><div class="grow"><div class="li-t">${esc(x ? x.name : '?')}</div><div class="li-s">${e.sets.length ? e.sets.map((st) => `${isNum(st.load) && Number(st.load) > 0 ? `${fmt.num(st.load, 1)} kg × ` : ''}${esc(st.reps)}${st.rpe ? ` @${st.rpe}` : ''}`).join(' · ') : 'Non réalisé'}</div></div>${statusPill(e.status, e.status === 'done' ? 'Fait' : e.status === 'modified' ? 'Modifié' : 'Passé')}</div>`; }).join('');
    const w = log.watch;
    const watch = w ? card('Données de la montre', `<div class="stat-inline mb-12"><div><b>${w.hrAvg} bpm</b><span>FC moyenne</span></div><div><b>${w.hrMax} bpm</b><span>FC maximale</span></div><div><b>${w.kcal} kcal</b><span>Calories dépensées</span></div>${w.distance ? `<div><b>${fmt.num(w.distance, 2)} km</b><span>Distance</span></div><div><b>${esc(w.pace)}</b><span>Allure</span></div>` : ''}</div>${Charts.line({ labels: w.hrSeries.map((_, i) => `${Math.round((i / (w.hrSeries.length - 1)) * (log.duration / 60))} min`), series: [{ name: 'Fréquence cardiaque', color: 'var(--s8)', values: w.hrSeries }], height: 150, yFmt: (v) => `${fmt.num(v)}`, tipFmt: (v) => `${v} bpm` })}`, { sub: ctx === 'coach' ? 'Partagées par l’athlète' : 'Lecture seule' }) : '';
    return `<div class="sum-hero on-dark"><div class="row between wrap gap-12"><div><div class="upper" style="color:#C5F23A">Bilan de séance</div><h1 style="color:#fff" class="mt-4">${esc(s ? s.name : 'Séance')}</h1><div class="small" style="color:#AEB4C0">${fmt.dateFull(log.date)} · ${fmt.time(log.date)}${ctx === 'coach' ? ` · ${esc(fullName(a))}` : ''}</div></div>${log.sentToCoach ? `<span class="pill pill-lime">${icon('check', 12)} Envoyé au coach</span>` : ''}</div>
      <div class="grid g-4 mt-20"><div class="stat"><b>${fmt.dur(log.duration)}</b><span>Durée totale</span></div><div class="stat"><b>${log.completion} %</b><span>Taux de complétion</span></div><div class="stat"><b>${fmt.tonnes(log.volume)}</b><span>Volume total soulevé</span></div><div class="stat"><b>${log.rpeAvg ?? '—'}</b><span>RPE moyen</span></div></div></div>
      <div class="grid l-2-1 mt-16"><div class="col gap-16">${card('Prévu vs réalisé', `${chart}<p class="xs dim mt-8">Travail réalisé par exercice en % du prévu (séries × répétitions × charge).</p>`, { sub: 'Exercice par exercice' })}${card('Exercices', `<div class="list">${exList}</div>`, { sub: `${log.exercises.filter((e) => e.status === 'done').length} faits · ${log.exercises.filter((e) => e.status === 'modified').length} modifiés · ${log.exercises.filter((e) => e.status === 'skipped').length} passés` })}</div>
      <div class="col gap-16">${card('Muscles travaillés', BodyMap.svg(muscles))}${watch}</div></div>`;
  };
  Sport.summaryPage = (id) => {
    const log = byId(DB.logs, id); if (!log) { go('/athlete/sessions'); return null; }
    const a = athleteById(log.athleteId);
    const actions = `<button class="btn btn-outline" data-action="sum-download" data-id="${log.id}">${icon('download', 16)} Télécharger la carte</button><button class="btn btn-outline" data-action="sum-share" data-id="${log.id}">${icon('share', 16)} Partager</button>${a.coachId ? `<button class="btn btn-primary" data-action="sum-send" data-id="${log.id}" ${log.sentToCoach ? 'disabled' : ''}>${icon('send', 16)} ${log.sentToCoach ? 'Envoyé au coach' : 'Envoyer au coach'}</button>` : ''}`;
    return { title: 'Bilan de séance', html: `${pageHead('Bravo ! Séance terminée 🎉', 'Votre bilan est enregistré dans l’onglet « Bilans » de votre programme.', actions, ['/athlete/sessions', 'Mes séances'])}${Sport.summaryHTML(log)}<p class="xs dim mt-16">${icon('info', 12)} Le partage est un envoi ponctuel (fichier ou message au coach), pas une publication sur un fil d’actualité.</p>` };
  };
  Actions['open-log'] = (el) => {
    const log = byId(DB.logs, el.dataset.id); if (!log) { toast('Bilan introuvable', 'error'); return; }
    openModal({ title: 'Bilan de séance', sub: esc(fullName(athleteById(log.athleteId))), size: 'xl', body: Sport.summaryHTML(log, { ctx: S.role === 'coach' && !isPreview() ? 'coach' : 'athlete' }), footer: `<button class="btn btn-outline" data-action="sum-download" data-id="${log.id}">${icon('download', 15)} Carte-résumé</button><button class="btn btn-primary" data-close>Fermer</button>` });
  };
  Actions['sum-send'] = (el) => {
    const log = byId(DB.logs, el.dataset.id); const a = athleteById(log.athleteId); const t = ChatUI.threadBetween(a.coachId, a.id);
    ChatUI.send(t.id, a.id, 'Bilan de ma séance 👇', { type: 'summary', data: { logId: log.id } }); log.sentToCoach = true;
    notify(a.coachId, `<b>${esc(fullName(a))}</b> vous a envoyé le bilan de sa séance`, `/coach/messages/${t.id}`, 'activity');
    toast('Bilan envoyé à votre coach'); rerender();
  };
  /* Carte-résumé : SVG → PNG (canvas), avec schéma du corps */
  Sport.cardSVG = (log) => {
    const s = sessionById(log.sessionId); const a = athleteById(log.athleteId);
    const muscles = unique(log.exercises.filter((e) => e.status !== 'skipped').flatMap((e) => (exById(e.exId) || { muscles: [] }).muscles));
    const body = BodyMap.svg(muscles).replace(/class="base"/g, 'fill="#2a2f39"').replace(/class="m on"/g, 'fill="#C5F23A"').replace(/class="m "/g, 'fill="#3b414d"').replace(/<text /g, '<text fill="#7D8594" font-size="9" font-weight="700" ').replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
    const F = 'font-family="Inter, Segoe UI, Arial, sans-serif"';
    const stat = (x, v, l) => `<text x="${x}" y="1080" ${F} font-size="54" font-weight="800" fill="#ffffff">${esc(v)}</text><text x="${x}" y="1120" ${F} font-size="26" fill="#AEB4C0">${esc(l)}</text>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350"><defs><radialGradient id="g" cx="0.85" cy="0" r="0.9"><stop offset="0" stop-color="#C5F23A" stop-opacity=".35"/><stop offset="1" stop-color="#0F1115" stop-opacity="0"/></radialGradient></defs><rect width="1080" height="1350" fill="#0F1115"/><rect width="1080" height="1350" fill="url(#g)"/>
      <text x="80" y="130" ${F} font-size="54" font-weight="800" fill="#fff">ELEV</text><rect x="222" y="86" width="50" height="56" rx="12" fill="#C5F23A"/><text x="247" y="130" ${F} font-size="46" font-weight="800" fill="#0F1115" text-anchor="middle">8</text>
      <text x="80" y="250" ${F} font-size="30" font-weight="700" fill="#C5F23A" letter-spacing="3">BILAN DE SÉANCE</text>
      <text x="80" y="320" ${F} font-size="64" font-weight="800" fill="#fff">${esc((s ? s.name : 'Séance').slice(0, 26))}</text>
      <text x="80" y="370" ${F} font-size="30" fill="#AEB4C0">${esc(firstName(a))} · ${esc(fmt.dateFull(log.date))}</text>
      <g transform="translate(240 410) scale(2.5)">${body}</g>
      ${stat(80, fmt.dur(log.duration), 'Durée')}${stat(400, fmt.tonnes(log.volume), 'Volume soulevé')}${stat(760, `${log.completion} %`, 'Complétion')}
      <text x="80" y="1200" ${F} font-size="28" fill="#7D8594">${esc(muscles.slice(0, 5).join(' · '))}</text><text x="80" y="1270" ${F} font-size="24" fill="#5D6573">elev8.app — coaching sport &amp; nutrition</text></svg>`;
  };
  Sport.cardPNG = (log) => new Promise((resolve) => {
    const svg = Sport.cardSVG(log); const img = new Image();
    img.onload = () => { try { const c = document.createElement('canvas'); c.width = 1080; c.height = 1350; c.getContext('2d').drawImage(img, 0, 0); c.toBlob((b) => resolve(b || new Blob([svg], { type: 'image/svg+xml' })), 'image/png'); } catch (err) { resolve(new Blob([svg], { type: 'image/svg+xml' })); } };
    img.onerror = () => resolve(new Blob([svg], { type: 'image/svg+xml' }));
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
  Actions['sum-download'] = async (el) => { const log = byId(DB.logs, el.dataset.id); const b = await Sport.cardPNG(log); downloadFile(`bilan-${ymd(log.date)}.${b.type.includes('png') ? 'png' : 'svg'}`, b); toast('Carte-résumé téléchargée'); };
  Actions['sum-share'] = async (el) => {
    const log = byId(DB.logs, el.dataset.id); const b = await Sport.cardPNG(log); const file = new File([b], `bilan-${ymd(log.date)}.png`, { type: b.type });
    const text = `Séance « ${sessionById(log.sessionId).name} » terminée : ${fmt.dur(log.duration)}, ${fmt.tonnes(log.volume)} soulevés 💪 #ELEV8`;
    try { if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], text }); return; } } catch (err) { /* partage annulé */ }
    downloadFile(file.name, b); copyText(text); toast('Partage natif indisponible : image téléchargée et texte copié', 'info');
  };
})();
