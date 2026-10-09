'use strict';
/* =========================================================
   ELEV8 — widgets transverses : messagerie, paiement web,
   visio, aperçu PDF, vérification d'identité, notifications
   ========================================================= */

function who(id) {
  if (!id) return null;
  if (id === 'elev8') return { id, name: 'Support ELEV8', first: 'Support', kind: 'support', color: '#0F1115', sub: 'Équipe ELEV8' };
  const c = coachById(id); if (c) return { ...c, name: fullName(c), kind: 'coach', sub: c.brand };
  const a = athleteById(id); if (a) return { ...a, name: fullName(a), kind: 'athlete', sub: a.coachId ? `Athlète · ${fullName(coachById(a.coachId))}` : 'Athlète solo' };
  const ad = adminById(id); if (ad) return { ...ad, kind: 'admin', sub: DB.adminRoles[ad.role].label };
  return { id, name: 'Utilisateur supprimé', kind: 'unknown', sub: '' };
}
function logActivity(type, text, ic = 'activity') { DB.activity.unshift({ id: uid('ev'), at: new Date().toISOString(), type, text, ic }); }
function notify(to, text, link = '', ic = 'bell') { DB.notifications.unshift({ id: uid('n'), to, text, at: new Date().toISOString(), read: false, ic, link }); }
function audit(action, target, detail = '') {
  const ad = adminById(S.adminId) || DB.admins[0];
  DB.audit.unshift({ id: uid('au'), at: new Date().toISOString(), by: ad.name, role: DB.adminRoles[S.adminRole || ad.role].label, action, target, detail });
}

/* ---------- Messagerie ---------- */
const ChatUI = {
  otherOf(t, meId) { return t.a === meId ? t.b : t.a; },
  lastMsg(t) { return t.messages[t.messages.length - 1]; },
  preview(m) { if (!m) return ''; if (m.type === 'summary') return '📊 Bilan de séance'; if (m.type === 'video') return '🎥 Vidéo d’exécution'; if (m.type === 'file') return '📎 Fichier'; return m.text; },
  view({ threads, activeId, meId, base, title = 'Messagerie', emptyHint = '' }) {
    const st = ui(`chat:${meId}`, { q: '' });
    const sorted = [...threads].sort((x, y) => new Date((ChatUI.lastMsg(y) || {}).at || 0) - new Date((ChatUI.lastMsg(x) || {}).at || 0));
    const active = sorted.find((t) => t.id === activeId);
    if (active && active.unread) active.unread[meId] = 0;
    const list = ChatUI.list(sorted, meId, base, activeId, st.q);
    let main = `<div class="grow" style="display:grid;place-items:center">${emptyState('message', 'Sélectionnez une conversation', emptyHint || 'Vos échanges apparaissent ici.')}</div>`;
    if (active) {
      const o = who(ChatUI.otherOf(active, meId));
      const canCall = active.kind === 'coach';
      main = `<div class="chat-head"><a class="icon-btn chat-back" href="#${base}">${icon('arrowL')}</a>${avatar(o, 'sm')}<div class="grow"><div class="semibold">${esc(o.name)}</div><div class="xs dim">${esc(o.sub || '')}</div></div>${canCall ? `<button class="btn btn-outline btn-sm" data-action="call-start" data-peer="${o.id}">${icon('video', 16)}<span class="hide-sm">Visio</span></button>` : ''}</div>
        <div class="chat-msgs">${ChatUI.messages(active, meId)}</div>
        <form class="chat-input" data-form="chat-send"><input type="hidden" name="thread" value="${active.id}"><input type="hidden" name="me" value="${meId}"><button type="button" class="icon-btn" data-action="chat-attach" data-thread="${active.id}" data-me="${meId}" title="Joindre un fichier">${icon('link')}</button><textarea class="textarea" name="text" rows="1" placeholder="Écrire un message…" data-enter-submit></textarea><button class="btn btn-primary btn-icon" type="submit" aria-label="Envoyer">${icon('send', 17)}</button></form>`;
    }
    return `<div class="chat ${active ? 'has-active' : ''}"><div class="chat-side"><div class="row between" style="padding:14px 14px 0"><h3>${title}</h3><span class="pill">${sorted.length}</span></div>${searchBox('chat-q', st.q, 'Rechercher une conversation…', 'data-chat-search')}<div class="chat-items">${list}</div></div><div class="chat-main">${main}</div></div>`;
  },
  list(threads, meId, base, activeId, q = '') {
    const qq = q.trim().toLowerCase();
    const rows = threads.filter((t) => !qq || who(ChatUI.otherOf(t, meId)).name.toLowerCase().includes(qq)).map((t) => {
      const o = who(ChatUI.otherOf(t, meId)); const m = ChatUI.lastMsg(t); const un = (t.unread && t.unread[meId]) || 0;
      return `<a class="chat-item ${t.id === activeId ? 'active' : ''}" href="#${base}/${t.id}">${avatar(o, 'sm')}<div class="grow" style="min-width:0"><div class="row between"><span class="semibold truncate">${esc(o.name)}</span><span class="xxs dim nowrap">${m ? fmt.rel(m.at) : ''}</span></div><div class="row between gap-6"><span class="xs dim truncate">${m && m.from === meId ? 'Vous : ' : ''}${esc(ChatUI.preview(m))}</span>${un ? `<span class="unread">${un}</span>` : ''}</div></div></a>`;
    }).join('');
    return rows || '<div class="small dim" style="padding:16px">Aucune conversation</div>';
  },
  messages(t, meId) {
    let lastDay = ''; const out = [];
    t.messages.forEach((m) => {
      const day = ymd(m.at);
      if (day !== lastDay) { out.push(`<div class="msg-day">${isSameDay(m.at, new Date()) ? 'Aujourd’hui' : fmt.dateLong(m.at)}</div>`); lastDay = day; }
      out.push(ChatUI.msg(m, meId));
    });
    return out.join('');
  },
  msg(m, meId) {
    const mine = m.from === meId; const cls = m.internal ? 'note' : mine ? 'me' : '';
    let extra = '';
    if (m.type === 'summary') {
      const log = byId(DB.logs, m.data && m.data.logId); const s = log && sessionById(log.sessionId);
      extra = log ? `<div class="msg-card" data-action="open-log" data-id="${log.id}"><span class="ic">${icon('activity', 18)}</span><div><div class="semibold">Bilan — ${esc(s ? s.name : 'Séance')}</div><div class="xs" style="opacity:.75">${fmt.dur(log.duration)} · ${fmt.tonnes(log.volume)} · ${log.completion} % complété</div></div></div>` : '';
    }
    if (m.type === 'video') extra = `<div class="msg-card" data-action="open-video-msg" data-name="${esc((m.data && m.data.exercise) || '')}"><span class="ic">${icon('video', 18)}</span><div><div class="semibold">Vidéo d’exécution</div><div class="xs" style="opacity:.75">${esc((m.data && m.data.exercise) || '')} · ${esc((m.data && m.data.name) || 'video.mp4')}</div></div></div>`;
    if (m.type === 'file') extra = `<div class="msg-card" data-action="info" data-msg="Téléchargement simulé"><span class="ic">${icon('file', 18)}</span><div><div class="semibold">${esc((m.data && m.data.name) || 'document.pdf')}</div><div class="xs" style="opacity:.75">${esc((m.data && m.data.size) || '')}</div></div></div>`;
    return `<div class="msg ${cls}">${m.internal ? `<div class="xs semibold t-amber mb-4">${icon('lock', 12)} Note interne · ${esc(who(m.from) ? who(m.from).name : '')}</div>` : ''}${m.text ? esc(m.text).replace(/\n/g, '<br>') : ''}${extra}<div class="msg-time">${fmt.time(m.at)}</div></div>`;
  },
  mount(el) {
    const box = $('.chat-msgs', el); if (box) box.scrollTop = box.scrollHeight;
    const ta = $('[data-enter-submit]', el);
    if (ta) { ta.focus({ preventScroll: true }); ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ta.form.requestSubmit(); } }); }
  },
  send(threadId, from, text, extra = {}) {
    const t = byId(DB.threads, threadId); if (!t) return null;
    const m = { id: uid('m'), from, text, at: new Date().toISOString(), type: 'text', ...extra };
    t.messages.push(m);
    const other = ChatUI.otherOf(t, from); t.unread = t.unread || {}; t.unread[other] = (t.unread[other] || 0) + 1;
    return m;
  },
  threadBetween(a, b, kind = 'coach') {
    let t = DB.threads.find((x) => x.kind === kind && ((x.a === a && x.b === b) || (x.a === b && x.b === a)));
    if (!t) { t = { id: uid('t'), kind, a, b, unread: {}, messages: [] }; DB.threads.push(t); }
    return t;
  },
};
const AUTO_REPLIES = ['Top, merci ! 👍', 'Bien reçu, je regarde ça ce soir.', 'Parfait, on en reparle au prochain check-in.', 'Merci pour le retour 💪', 'Ça marche !'];
Forms['chat-send'] = (v, form) => {
  const text = (v.text || '').trim(); if (!text) return;
  const t = byId(DB.threads, v.thread); ChatUI.send(v.thread, v.me, text);
  rerender();
  const other = ChatUI.otherOf(t, v.me);
  setTimeout(() => {
    if (t.kind === 'support' && other === 'elev8') ChatUI.send(t.id, 'elev8', 'Merci pour votre message ! Un membre de l’équipe ELEV8 vous répond sous 24 h (en direct de 9 h à 19 h).');
    else if (t.kind === 'support') return;
    else ChatUI.send(t.id, other, rpick(AUTO_REPLIES));
    if (location.hash.includes(t.id)) rerender();
  }, 1600);
  void form;
};
document.addEventListener('input', (e) => {
  const s = e.target.closest && e.target.closest('[data-chat-search]'); if (!s) return;
  const chat = s.closest('.chat'); const me = $('[name=me]', chat);
  const meId = me ? me.value : (S.role === 'admin' ? 'elev8' : S.role === 'coach' && !S.previewAthleteId ? S.userId : (S.previewAthleteId || S.userId));
  ui(`chat:${meId}`).q = s.value;
  const items = $('.chat-items', chat); const base = (location.hash.replace('#', '').match(/^\/[^/]+\/messages|^\/admin\/messages/) || [''])[0];
  const threads = DB.threads.filter((t) => t.a === meId || t.b === meId);
  const activeId = (location.hash.split('/messages/')[1] || '').split('?')[0];
  items.innerHTML = ChatUI.list([...threads].sort((x, y) => new Date((ChatUI.lastMsg(y) || {}).at || 0) - new Date((ChatUI.lastMsg(x) || {}).at || 0)), meId, base, activeId, s.value);
});
Actions['chat-attach'] = (el) => {
  openModal({
    title: 'Joindre un fichier', size: 'sm',
    body: dropzone({ name: 'file', accept: '*/*', label: 'Fichier, photo ou vidéo', ic: 'upload' }),
    footer: '<button class="btn btn-ghost" data-close>Annuler</button><button class="btn btn-primary" data-ok>Envoyer</button>',
    onMount: (box, m) => $('[data-ok]', box).addEventListener('click', () => {
      const id = $('[name=file]', box).value; if (!id) { toast('Choisissez un fichier', 'error'); return; }
      const u = Uploads[id];
      ChatUI.send(el.dataset.thread, el.dataset.me, '', { type: u.type.startsWith('video') ? 'video' : 'file', data: { name: u.name, size: `${fmt.num(u.size / 1024)} Ko`, exercise: u.type.startsWith('video') ? 'Vidéo jointe' : '' } });
      m.close(); rerender();
    }),
  });
};
Actions['open-video-msg'] = (el) => {
  const ex = DB.exercises.find((x) => x.name === el.dataset.name) || DB.exercises[0];
  openModal({ title: 'Vidéo d’exécution', sub: el.dataset.name, size: 'md', body: `${VMock.html(ex, { autoplay: true, tag: 'Capture de l’athlète' })}<p class="small muted mt-12">Vidéo filmée pendant la séance avec « Capturer l’exécution » et envoyée au coach.</p>` });
};
Actions['call-start'] = (el) => VideoCall.open({ peer: who(el.dataset.peer) });

/* ---------- Paiement web (type Stripe Checkout, hors stores) ---------- */
const Checkout = {
  open({ title = 'Paiement', merchant = 'ELEV8', lines = [], total = 0, note = '', onSuccess, mode = 'payment', email = '', connect = false, cta = '' } = {}) {
    const ref = `cs_live_${Math.random().toString(36).slice(2, 12)}`;
    const summary = `<div class="co-sum"><div class="row gap-8">${connect ? `<span class="li-ic blue">${icon('building', 17)}</span>` : '<span class="logo" style="color:var(--text)">ELEV<b>8</b></span>'}<div><div class="semibold">${esc(merchant)}</div>${connect ? '<div class="xs dim">Compte encaissement Stripe Connect</div>' : ''}</div></div>
      <div class="small muted mt-20">${esc(title)}</div><div class="total">${fmt.eur(total, 2)}${mode === 'subscription' ? '<small class="small dim"> / mois</small>' : ''}</div>
      ${lines.map((l) => `<div class="co-line"><span>${esc(l.label)}</span><b class="num">${l.amount < 0 ? '−' : ''}${fmt.eur(Math.abs(l.amount), 2)}</b></div>`).join('')}
      <div class="co-line" style="border:0"><b>Total</b><b class="num">${fmt.eur(total, 2)}</b></div>
      ${note ? `<div class="notice mt-12 small">${icon('info', 16)}<div>${note}</div></div>` : ''}</div>`;
    const form = `<div class="co-form"><h3>Payer par carte</h3>
      ${field('Email', input('email', email || 'vous@email.fr', { type: 'email' }))}
      <div class="field"><label>Informations de carte</label><div class="card-input"><input class="input" value="4242 4242 4242 4242" aria-label="Numéro de carte"><input class="input" value="12 / 28" aria-label="Expiration"><input class="input" value="123" aria-label="CVC"></div></div>
      ${field('Nom sur la carte', input('cardname', 'Titulaire de la carte'))}
      ${field('Pays', select('country', ['France', 'Belgique', 'Suisse', 'Luxembourg'], 'France'))}
      <button class="btn btn-primary btn-lg btn-block" data-pay>${cta || (mode === 'subscription' ? `S’abonner — ${fmt.eur(total, 2)}/mois` : `Payer ${fmt.eur(total, 2)}`)}</button>
      <div class="xs dim center">${icon('lock', 12)} Paiement sécurisé par Stripe · carte de test pré-remplie</div></div>`;
    const m = openModal({
      size: 'lg', cls: 'flush',
      body: `<div class="co-browser"><div class="dots"><i></i><i></i><i></i></div><div class="url">${icon('lock', 12)} https://checkout.stripe.com/c/pay/${ref}</div><button class="icon-btn" data-close aria-label="Fermer">${icon('x')}</button></div>
        <div class="notice blue" style="border-radius:0">${icon('globe', 16)}<div><b>Paiement web dans le navigateur</b> — jamais d’achat intégré App Store / Google Play (aucune commission des stores).</div></div>
        <div class="co" data-co>${summary}${form}</div>`,
      onMount: (box) => {
        $('[data-pay]', box).addEventListener('click', async (e) => {
          const b = e.currentTarget; b.disabled = true; b.innerHTML = '<span class="spinner"></span> Paiement en cours…';
          await sleep(1300);
          $('[data-co]', box).outerHTML = `<div class="co-ok"><div class="big">${icon('check', 36)}</div><h2>Paiement confirmé</h2><p class="muted">${fmt.eur(total, 2)} — ${esc(title)}</p><p class="xs dim">Référence ${ref.toUpperCase().slice(0, 18)} · reçu envoyé par email</p><button class="btn btn-primary btn-lg mt-8" data-done>Retour à l’application</button></div>`;
          $('[data-done]', box).addEventListener('click', () => { m.close(); if (onSuccess) onSuccess(); });
        });
      },
    });
    return m;
  },
};

/* ---------- Visio intégrée (simulation) ---------- */
const VideoCall = {
  open({ peer, title = 'Rendez-vous en visio', sub = '' } = {}) {
    let sec = 0; let stream = null; const flags = { mic: true, cam: true };
    openModal({
      size: 'full', cls: 'flush', dismissible: false,
      body: `<div class="vcall"><div class="vcall-top"><span class="logo">ELEV<b>8</b></span><div class="grow"><div class="semibold">${esc(title)}</div><div class="xs" style="opacity:.7">${esc(sub || (peer ? `Avec ${peer.name}` : ''))} · chiffré de bout en bout</div></div><span class="pill pill-red"><span class="badge-dot"></span><span data-t>00:00</span></span></div>
        <div class="vcall-main"><div class="vcall-peer speaking">${avatar(peer, 'xl')}<div class="semibold">${esc(peer ? peer.name : 'Invité')}</div><div class="xs" style="opacity:.6">Caméra désactivée côté interlocuteur (démo)</div></div>
        <div class="vcall-self" data-self><button class="btn btn-sm btn-white" data-cam-on>${icon('video', 15)} Activer ma caméra</button></div></div>
        <div class="vcall-bar"><button class="vbtn" data-tg="mic" title="Micro">${icon('mic')}</button><button class="vbtn" data-tg="cam" title="Caméra">${icon('video')}</button><button class="vbtn" data-share title="Partager l’écran">${icon('screen')}</button><button class="vbtn" data-chat title="Messages">${icon('message')}</button><button class="vbtn end" data-end title="Raccrocher">${icon('phoneOff')}</button></div></div>`,
      onMount: (box, m) => {
        const timer = setInterval(() => { sec++; const t = $('[data-t]', box); if (t) t.textContent = fmt.clock(sec); }, 1000);
        const stop = () => { clearInterval(timer); if (stream) stream.getTracks().forEach((tr) => tr.stop()); };
        m.onClose = stop;
        $('[data-end]', box).addEventListener('click', () => { m.close(); toast(`Appel terminé (${fmt.clock(sec)})`, 'info'); });
        $('[data-share]', box).addEventListener('click', () => toast('Partage d’écran simulé', 'info'));
        $('[data-chat]', box).addEventListener('click', () => toast('Le chat de l’appel s’ouvrirait ici', 'info'));
        $$('[data-tg]', box).forEach((b) => b.addEventListener('click', () => { const k = b.dataset.tg; flags[k] = !flags[k]; b.classList.toggle('off', !flags[k]); b.innerHTML = icon(k === 'mic' ? (flags.mic ? 'mic' : 'micOff') : (flags.cam ? 'video' : 'videoOff')); if (stream) stream.getTracks().filter((tr) => tr.kind === (k === 'mic' ? 'audio' : 'video')).forEach((tr) => { tr.enabled = flags[k]; }); }));
        $('[data-cam-on]', box).addEventListener('click', async () => {
          try {
            stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
            $('[data-self]', box).innerHTML = '<video autoplay playsinline muted></video>'; $('[data-self] video', box).srcObject = stream;
          } catch (err) { toast('Caméra indisponible dans ce navigateur (démo)', 'info'); $('[data-self]', box).innerHTML = avatar({ name: 'Moi' }, 'lg'); }
        });
      },
    });
  },
};

/* ---------- Aperçu PDF (impression → « Enregistrer en PDF ») ---------- */
const PDF = {
  header(title, sub = '', right = '') { return `<div class="ph"><div><div class="logo">ELEV<b>8</b></div><div class="muted" style="margin-top:6px">${sub}</div></div><div style="text-align:right"><h1>${title}</h1>${right}</div></div>`; },
  open(title, html) {
    openModal({
      title: `Aperçu — ${esc(title)}`, size: 'xl', cls: 'flush',
      body: `<div class="paper-bg"><div class="paper">${html}</div></div>`,
      footer: `<span class="left xs muted hide-sm">${icon('info', 14)} « Télécharger » ouvre l’impression : choisissez « Enregistrer au format PDF ».</span><button class="btn btn-ghost" data-close>Fermer</button><button class="btn btn-primary" data-pdf>${icon('download', 16)} Télécharger le PDF</button>`,
      onMount: (box) => $('[data-pdf]', box).addEventListener('click', () => printHTML(title, `<div class="paper">${html}</div>`)),
    });
  },
  invoice({ number, date, seller, buyer, lines, total, note = '' }) {
    return `${PDF.header('Facture', 'Facture générée automatiquement', `<div class="muted">N° ${esc(number)}<br>${fmt.date(date)}</div>`)}
      <table><tr><td style="border:0;width:50%"><b>Vendeur</b><br>${seller}</td><td style="border:0"><b>Client</b><br>${buyer}</td></tr></table>
      <table><thead><tr><th>Désignation</th><th>Qté</th><th>Prix unitaire</th><th>Total</th></tr></thead><tbody>${lines.map((l) => `<tr><td>${esc(l.label)}</td><td>${l.qty || 1}</td><td>${fmt.eur(l.price, 2)}</td><td>${fmt.eur((l.qty || 1) * l.price, 2)}</td></tr>`).join('')}</tbody></table>
      <div class="tot">Total TTC : ${fmt.eur(total, 2)}</div>${note ? `<p class="muted" style="margin-top:18px">${note}</p>` : ''}
      <p class="muted" style="margin-top:28px;font-size:11px">Paiement web traité par Stripe. Document fictif généré par le prototype ELEV8.</p>`;
  },
};

/* ---------- Vérification d'identité de l'athlète (au premier achat seulement) ---------- */
const KYC = {
  athleteFirstPurchase(a, onDone) {
    const m = openModal({
      title: 'Vérification d’identité', sub: 'Requise une seule fois, pour votre premier achat en Boutique', size: 'md',
      body: `${notice('Sport et Nutrition restent <b>gratuits et sans vérification</b>. Cette étape n’est demandée qu’au <b>premier achat</b> (programme numérique ou produit physique).', 'blue', 'shield')}
        <div class="col gap-12 mt-16" data-step1>
          <label class="radio-card"><input type="radio" name="kycm" value="card" checked><div><div class="semibold">Vérification par carte bancaire</div><div class="small muted">Instantanée, réalisée par le prestataire de paiement (3-D Secure).</div></div><span class="pill pill-green ml-auto">Recommandé</span></label>
          <label class="radio-card"><input type="radio" name="kycm" value="id"><div><div class="semibold">Pièce d’identité + selfie</div><div class="small muted">Photo d’une pièce d’identité et un selfie.</div></div></label>
        </div><div data-step2></div>`,
      footer: '<button class="btn btn-ghost" data-close>Annuler</button><button class="btn btn-primary" data-next>Continuer</button>',
      onMount: (box) => {
        let stage = 1; let method = 'card';
        const finish = () => {
          a.kycVerified = true;
          DB.kycRequests.unshift({ id: uid('k'), userType: 'athlete', userId: a.id, doc: method === 'card' ? 'Carte bancaire (3-D Secure)' : 'Carte d’identité', submitted: new Date().toISOString(), status: 'approved', reason: '', reviewedBy: 'Automatique (prestataire)', context: 'Premier achat Boutique' });
          logActivity('kyc', `KYC approuvé automatiquement — ${fullName(a)} (premier achat)`, 'shield');
          m.close(); toast('Identité vérifiée ✓'); if (onDone) onDone();
        };
        $('[data-next]', box).addEventListener('click', async (e) => {
          const b = e.currentTarget;
          if (stage === 1) {
            method = $('input[name=kycm]:checked', box).value; $('[data-step1]', box).style.display = 'none'; stage = 2;
            if (method === 'card') {
              $('[data-step2]', box).innerHTML = `<div class="center mt-16"><div class="li-ic blue" style="margin:0 auto 10px;width:56px;height:56px">${icon('smartphone', 26)}</div><h3>Confirmez dans votre application bancaire</h3><p class="small muted mt-4">Un contrôle 3-D Secure de 0 € est envoyé à votre banque.</p><div class="mt-16"><span class="spinner"></span></div></div>`;
              b.disabled = true; await sleep(1600); finish();
            } else {
              $('[data-step2]', box).innerHTML = `<div class="grid g-2 mt-16">${field('Pièce d’identité (recto)', dropzone({ name: 'idfront', label: 'Carte d’identité / passeport', ic: 'card' }))}${field('Selfie', dropzone({ name: 'selfie', label: 'Selfie', ic: 'camera', capture: 'user' }))}</div><p class="xs dim mt-8">Astuce démo : vous pouvez aussi continuer sans fichier.</p>`;
              b.textContent = 'Envoyer pour vérification';
            }
          } else {
            b.disabled = true; b.innerHTML = '<span class="spinner"></span> Vérification…'; await sleep(1400); finish();
          }
        });
      },
    });
  },
};

/* ---------- Notifications ---------- */
const Notif = {
  key() { return S.role === 'admin' ? 'admin' : S.role === 'coach' && !S.previewAthleteId ? S.userId : (S.previewAthleteId || S.userId); },
  list() { const k = Notif.key(); return DB.notifications.filter((n) => n.to === k); },
  unread() { return Notif.list().filter((n) => !n.read).length; },
  open(anchor) {
    const list = Notif.list();
    openPopover(anchor, `<div class="pop-h"><span>Notifications</span><button class="btn btn-ghost btn-xs" data-action="notif-read-all" data-pop-close>Tout marquer comme lu</button></div>${list.length ? list.map((n) => `<a class="notif ${n.read ? '' : 'unread'}" href="#${n.link || ''}" data-action="notif-open" data-id="${n.id}" data-pop-close><span class="li-ic">${icon(n.ic || 'bell', 16)}</span><div class="grow"><div>${n.text}</div><div class="xs dim mt-4">${fmt.rel(n.at)}</div></div></a>`).join('') : '<div class="empty small">Aucune notification</div>'}`, { width: 360 });
  },
};
Actions['notif-open-pop'] = (el) => Notif.open(el);
Actions['notif-read-all'] = () => { Notif.list().forEach((n) => { n.read = true; }); rerender(); };
Actions['notif-open'] = (el) => { const n = byId(DB.notifications, el.dataset.id); if (n) { n.read = true; if (n.link) go(n.link); else rerender(); } };
