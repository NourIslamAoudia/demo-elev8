'use strict';
/* =========================================================
   ELEV8 — Espace Coach (3/4) : Boutique (programmes numériques,
   produits physiques, livraison, commandes, ventes & factures)
   ========================================================= */
const ShopUtil = {
  rate: () => DB.platform.shopCommission / 100,
  shipping: (cId) => DB.shop.shipping[cId] || (DB.shop.shipping[cId] = { zones: ['France'], mode: 'fixed', fee: 4.9, freeAbove: 50, freeEnabled: false }),
  shipFee: (cId, subtotal) => { const s = ShopUtil.shipping(cId); return s.freeEnabled && subtotal >= s.freeAbove ? 0 : s.fee; },
  itemLabel: (it) => { const p = productById(it.productId); return `${p ? p.name : 'Produit'}${it.variant ? ` — ${it.variant}` : ''}`; },
  salesOf: (cId) => {
    const out = [];
    DB.shop.orders.filter((o) => o.coachId === cId).forEach((o) => out.push({ id: o.id, kind: 'product', date: o.date, label: o.items.map((it) => `${it.qty}× ${ShopUtil.itemLabel(it)}`).join(', '), buyer: o.athleteId, amount: o.subtotal, shipping: o.shipping, status: o.status, invoice: o.invoice, ref: o }));
    DB.shop.digitalSales.filter((s) => s.coachId === cId).forEach((s) => { const l = listingById(s.listingId); out.push({ id: s.id, kind: 'digital', date: s.date, label: l ? l.title : 'Programme', buyer: s.athleteId, amount: s.price, shipping: 0, status: 'paid', invoice: s.invoice, ref: s }); });
    return out.sort((a, b) => new Date(b.date) - new Date(a.date));
  },
  invoiceFor(sale) {
    const c = coachById(sale.ref.coachId); const a = athleteById(sale.buyer);
    const lines = sale.kind === 'product' ? sale.ref.items.map((it) => ({ label: ShopUtil.itemLabel(it), qty: it.qty, price: it.price })).concat(sale.ref.shipping ? [{ label: 'Livraison', qty: 1, price: sale.ref.shipping }] : []) : [{ label: `Programme numérique — ${sale.label}`, qty: 1, price: sale.amount }];
    const total = sale.kind === 'product' ? sale.ref.total : sale.amount;
    return PDF.invoice({ number: sale.invoice, date: sale.date, seller: `${esc(c.brand)}<br>${esc(fullName(c))}<br>${esc(c.city)}${c.siret ? `<br>SIRET ${esc(c.siret)}` : ''}`, buyer: `${esc(fullName(a))}<br>${sale.kind === 'product' && sale.ref.address ? `${esc(sale.ref.address.line1)}<br>${esc(sale.ref.address.zip)} ${esc(sale.ref.address.city)}` : esc(a.email)}`, lines, total, note: 'Vente réalisée via la Boutique ELEV8 (paiement web, Stripe Connect).' });
  },
};
Actions['sale-invoice'] = (el) => {
  const o = byId(DB.shop.orders, el.dataset.id); const d = byId(DB.shop.digitalSales, el.dataset.id);
  const sale = o ? ShopUtil.salesOf(o.coachId).find((s) => s.id === o.id) : ShopUtil.salesOf(d.coachId).find((s) => s.id === d.id);
  PDF.open(`Facture ${sale.invoice}`, ShopUtil.invoiceFor(sale));
};
(() => {
  const TABS = [{ id: 'programs', label: 'Programmes numériques', ic: 'layers' }, { id: 'products', label: 'Produits physiques', ic: 'package' }, { id: 'orders', label: 'Commandes', ic: 'truck' }, { id: 'sales', label: 'Ventes & factures', ic: 'receipt' }, { id: 'shipping', label: 'Livraison', ic: 'globe' }];
  const stripeBanner = (c) => (c.stripe === 'verified' ? '' : notice(`<b>Encaissements non activés.</b> Avant de recevoir l’argent de la Boutique, complétez la vérification renforcée de votre compte (comme pour un compte professionnel). <a class="link" href="#/coach/settings/gestion">Activer mes encaissements</a>`, 'amber', 'building'));
  route('/coach/shop/:tab?', (p, q) => {
    const c = meCoach(); const tab = TABS.some((t) => t.id === p.tab) ? p.tab : 'programs';
    const pendingN = DB.shop.orders.filter((o) => o.coachId === c.id && o.status === 'pending').length;
    const body = { programs: tabPrograms, products: tabProducts, orders: tabOrders, sales: tabSales, shipping: tabShipping }[tab](c, q);
    const tabs = TABS.map((t) => ({ ...t, count: t.id === 'orders' && pendingN ? pendingN : null }));
    return { title: 'Boutique', html: `${pageHead('Boutique', 'Vendez des programmes numériques et des produits physiques à vos athlètes. Paiement web, factures automatiques.', `<a class="btn btn-outline" href="#/coach/shop/products">${icon('package', 16)} Produits</a><button class="btn btn-primary" data-action="${tab === 'products' ? 'product-edit' : 'listing-edit'}">${icon('plus', 16)} ${tab === 'products' ? 'Nouveau produit' : 'Mettre en vente un programme'}</button>`)}${stripeBanner(c)}<div class="mt-16">${tabsNav(tabs, tab, { base: '/coach/shop' })}</div>${body}`,
      mount: () => { if (q.sell && tab === 'programs') { history.replaceState(null, '', '#/coach/shop/programs'); Actions['listing-edit']({ dataset: { program: q.sell } }); } } };
  }, { role: 'coach' });

  /* 7.1 Programmes numériques */
  function tabPrograms(c) {
    const list = DB.shop.listings.filter((l) => l.coachId === c.id);
    return `<div class="grid g-auto-lg">${list.map((l) => { const rev = sum(DB.shop.digitalSales.filter((s) => s.listingId === l.id), (s) => s.price); return `<div class="card">${Cover.listing(l)}<div class="card-b col gap-8"><div class="row between gap-8"><span class="pill ${l.kind === 'sport' ? 'pill-blue' : 'pill-green'}">${l.kind === 'sport' ? 'Programme sport' : 'Plan nutrition'}</span>${statusPill(l.published ? 'published' : 'unpublished', l.published ? 'En vente' : 'Retiré de la vente')}</div><h3>${esc(l.title)}</h3><p class="small muted clamp-2">${esc(l.desc)}</p><div class="row between"><b class="lg">${fmt.eur(l.price)}</b><span class="xs dim">${l.sales} ventes · ${fmt.eur(rev)} récents</span></div><div class="row wrap gap-6"><button class="btn btn-outline btn-xs" data-action="listing-edit" data-id="${l.id}">${icon('edit', 12)} Modifier</button><button class="btn ${l.published ? 'btn-soft-red' : 'btn-soft-green'} btn-xs" data-action="listing-toggle" data-id="${l.id}">${icon(l.published ? 'eyeOff' : 'eye', 12)} ${l.published ? 'Retirer de la vente' : 'Publier'}</button></div></div></div>`; }).join('') || emptyState('layers', 'Aucun programme en vente', 'Mettez un programme de sport ou un plan nutritionnel en vente : l’acheteur y a accès immédiatement.')}</div>
      <p class="xs dim mt-16">${icon('info', 12)} Rien à expédier : dès que l’achat est validé, le programme apparaît dans l’espace de l’acheteur, exactement comme s’il lui avait été assigné.</p>`;
  }
  Actions['listing-toggle'] = (el) => { const l = listingById(el.dataset.id); const c = meCoach(); if (!l.published && c.stripe !== 'verified') { toast('Activez d’abord vos encaissements', 'error'); return; } l.published = !l.published; toast(l.published ? 'Programme publié dans votre boutique' : 'Programme retiré de la vente'); rerender(); };
  Actions['listing-edit'] = (el) => {
    const c = meCoach(); const l = el.dataset.id ? listingById(el.dataset.id) : null;
    const progs = DB.programs.filter((p) => p.ownerId === c.id).map((p) => [`sport:${p.id}`, `Programme sport — ${p.name}`]);
    const plans = DB.nutritionPlans.filter((p) => p.ownerId === c.id && p.status !== 'archived').map((p) => [`nutrition:${p.id}`, `Plan nutrition — ${p.name}`]);
    const pre = l ? `${l.kind}:${l.refId}` : el.dataset.program ? `sport:${el.dataset.program}` : (progs[0] || [''])[0];
    const preP = pre.startsWith('sport:') ? programById(pre.split(':')[1]) : null;
    const v = l || { title: preP ? preP.name : '', desc: preP ? preP.desc : '', price: 49, cover: '', emoji: '🔥' };
    openModal({ title: l ? 'Modifier l’offre' : 'Mettre en vente un programme', size: 'md',
      body: `<form data-lf class="col gap-12">${field('Programme existant', select('ref', [...progs, ...plans], pre, l ? 'disabled' : ''))}${field('Titre de vente', input('title', v.title, { attrs: 'required' }))}${field('Description', textarea('desc', v.desc, { rows: 3 }))}<div class="grid g-2">${field('Photo de couverture', dropzone({ name: 'cover', value: v.cover, label: 'Couverture' }))}<div class="col gap-12">${field('Prix', inputUnit('price', v.price, '€', { attrs: 'step="0.5" min="0"' }))}${field('Emoji (si pas de photo)', input('emoji', v.emoji))}<div class="xs dim">Commission ELEV8 : ${DB.platform.shopCommission} % prélevée automatiquement avant reversement.</div></div></div></form>`,
      footer: `<button class="btn btn-ghost" data-close>Annuler</button><button class="btn btn-primary" data-ok>${l ? 'Enregistrer' : 'Publier dans ma boutique'}</button>`,
      onMount: (box, m) => $('[data-ok]', box).addEventListener('click', () => {
        const f = formValues($('[data-lf]', box)); if (!f.title.trim()) { toast('Titre requis', 'error'); return; }
        if (!l && c.stripe !== 'verified') { toast('Activez d’abord vos encaissements (Paramètres › Gestion)', 'error'); return; }
        const data = { title: f.title.trim(), desc: f.desc, price: Number(f.price) || 0, cover: f.cover, emoji: f.emoji || '📘' };
        if (l) Object.assign(l, data); else { const [kind, refId] = (f.ref || pre).split(':'); DB.shop.listings.push({ id: uid('l'), coachId: c.id, kind, refId, ...data, t1: '#0F1115', t2: ['#2a78d6', '#eb6834', '#1baf7a', '#4a3aa7', '#e34948'][hashStr(refId) % 5], published: true, sales: 0, createdAt: new Date().toISOString(), hidden: false }); logActivity('shop', `Nouveau programme en vente : ${data.title} — ${fullName(c)}`, 'bag'); }
        m.close(); toast(l ? 'Offre mise à jour' : 'Programme publié dans votre boutique'); rerender();
      }) });
  };

  /* 7.2 Produits physiques */
  function tabProducts(c) {
    if (!hasPlan('pro')) return `<div class="card card-pad center"><div class="empty-ic" style="margin:0 auto 12px">${icon('lock', 24)}</div><h3>Produits physiques : formule Pro</h3><p class="muted small mt-4">Votre formule ${PLAN_NAMES[c.plan]} inclut la Boutique en version de base (programmes numériques). Passez en Pro pour la boutique complète.</p><a class="btn btn-primary mt-12" href="#/coach/settings/abonnement">Voir les formules</a></div>`;
    const list = DB.shop.products.filter((p) => p.coachId === c.id && !p.removed);
    return `<div class="grid g-auto">${list.map((p) => `<div class="card"><div class="card-b col gap-8">${ProdImg.html(p)}<div class="row between gap-8"><h3 class="truncate">${esc(p.name)}</h3><b>${fmt.eur(p.price)}</b></div>${p.variants ? `<div class="xs dim">${esc(p.variants.name)}</div><div class="row wrap gap-4">${p.variants.options.map((o) => `<span class="tag" style="${o.stock <= 0 ? 'background:var(--red-soft);color:var(--red)' : ''}">${esc(o.label)} · ${o.stock}</span>`).join('')}</div>` : `<div class="small">${prodStock(p) > 0 ? `${prodStock(p)} en stock` : '<span class="t-red semibold">Épuisé</span>'}</div>`}${p.hidden ? pill('Masqué par ELEV8', 'red') : ''}<div class="row wrap gap-6"><button class="btn btn-outline btn-xs" data-action="product-edit" data-id="${p.id}">${icon('edit', 12)} Modifier</button><button class="btn btn-soft btn-xs" data-action="product-stock" data-id="${p.id}">${icon('package', 12)} Stock</button></div></div></div>`).join('') || emptyState('package', 'Aucun produit', 'T-shirt de marque, gélules, boisson protéinée…')}</div>`;
  }
  Actions['product-stock'] = (el) => {
    const p = productById(el.dataset.id);
    openModal({ title: 'Gérer le stock', sub: esc(p.name), size: 'sm', body: p.variants ? `<div class="col gap-8">${p.variants.options.map((o, i) => `<div class="row between"><span class="semibold">${esc(o.label)}</span>${inputUnit(`s${i}`, o.stock, 'unités', { attrs: `data-s="${i}" min="0" style="width:130px"` })}</div>`).join('')}</div>` : field('Quantité disponible', inputUnit('stock', p.stock, 'unités', { attrs: 'data-s="x" min="0"' })),
      footer: '<button class="btn btn-ghost" data-close>Annuler</button><button class="btn btn-primary" data-ok>Enregistrer</button>',
      onMount: (box, m) => $('[data-ok]', box).addEventListener('click', () => { $$('[data-s]', box).forEach((i) => { const v = Math.max(0, Number(i.value) || 0); if (i.dataset.s === 'x') p.stock = v; else p.variants.options[Number(i.dataset.s)].stock = v; }); m.close(); toast(prodStock(p) > 0 ? 'Stock mis à jour : produit de nouveau disponible' : 'Stock mis à jour'); rerender(); }) });
  };
  Actions['product-edit'] = (el) => {
    const c = meCoach(); if (!hasPlan('pro')) { go('/coach/shop/products'); return; }
    const p = el.dataset.id ? productById(el.dataset.id) : null;
    const st = p ? JSON.parse(JSON.stringify(p)) : { name: '', desc: '', price: 25, emoji: '📦', photos: [], variants: null, stock: 10 };
    const varRows = () => (st.variants ? `<div class="row gap-8 mb-8">${field('Nom de la variante', chips('vname', ['Taille', 'Couleur', 'Parfum'], st.variants.name))}</div>${st.variants.options.map((o, i) => `<div class="row gap-8 mb-6"><input class="input sm" value="${esc(o.label)}" data-vl="${i}" placeholder="Ex. : M"><div class="input-wrap" style="width:140px"><input class="input sm" type="number" min="0" value="${o.stock}" data-vs="${i}"><span class="suffix">stock</span></div><button type="button" class="icon-btn danger" data-vrm="${i}">${icon('x', 14)}</button></div>`).join('')}<button type="button" class="btn btn-ghost btn-sm" data-vadd>${icon('plus', 14)} Ajouter une option</button>` : field('Quantité en stock', input('stock', st.stock, { type: 'number', attrs: 'min="0" data-stock' })));
    openModal({ title: p ? 'Modifier le produit' : 'Nouveau produit', size: 'lg',
      body: `<form data-pf class="grid g-2 gap-20"><div class="col gap-12">${field('Nom', input('name', st.name, { attrs: 'required', placeholder: 'Ex. : T-shirt de marque' }))}${field('Description', textarea('desc', st.desc, { rows: 4 }))}<div class="grid g-2">${field('Prix', inputUnit('price', st.price, '€', { attrs: 'step="0.1" min="0"' }))}${field('Emoji (sans photo)', input('emoji', st.emoji))}</div></div><div class="col gap-12">${field('Photos', `<div class="grid g-2">${dropzone({ name: 'photo0', value: st.photos[0] || '', label: 'Photo principale', compact: true })}${dropzone({ name: 'photo1', value: st.photos[1] || '', label: 'Photo 2', compact: true })}</div>`)}${toggleRow('hasVar', 'Variantes', 'Taille, couleur, parfum… avec un stock par variante', !!st.variants, 'data-hasvar')}<div data-vbox>${varRows()}</div></div></form>`,
      footer: `${p ? `<button class="btn btn-soft-red left" data-del>${icon('trash', 15)}</button>` : ''}<button class="btn btn-ghost" data-close>Annuler</button><button class="btn btn-primary" data-ok>Enregistrer</button>`,
      onMount: (box, m) => {
        const redraw = () => { $('[data-vbox]', box).innerHTML = varRows(); };
        box.addEventListener('change', (e) => { if (e.target.matches('[data-hasvar]')) { st.variants = e.target.checked ? { name: 'Taille', options: [{ label: 'S', stock: 5 }, { label: 'M', stock: 5 }, { label: 'L', stock: 5 }] } : null; redraw(); } if (e.target.name === 'vname' && st.variants) st.variants.name = e.target.value; });
        box.addEventListener('input', (e) => { const t = e.target; if (t.dataset.vl != null) st.variants.options[Number(t.dataset.vl)].label = t.value; if (t.dataset.vs != null) st.variants.options[Number(t.dataset.vs)].stock = Number(t.value) || 0; if (t.matches('[data-stock]')) st.stock = Number(t.value) || 0; });
        box.addEventListener('click', (e) => { if (e.target.closest('[data-vadd]')) { st.variants.options.push({ label: '', stock: 0 }); redraw(); } const r = e.target.closest('[data-vrm]'); if (r) { st.variants.options.splice(Number(r.dataset.vrm), 1); redraw(); } });
        const d = $('[data-del]', box); if (d) d.addEventListener('click', () => { p.removed = true; m.close(); toast('Produit supprimé'); rerender(); });
        $('[data-ok]', box).addEventListener('click', () => {
          const f = formValues($('[data-pf]', box)); if (!f.name.trim()) { toast('Nom requis', 'error'); return; }
          const data = { name: f.name.trim(), desc: f.desc, price: Number(f.price) || 0, emoji: f.emoji || '📦', photos: [f.photo0, f.photo1].filter(Boolean), variants: st.variants ? { name: st.variants.name, options: st.variants.options.filter((o) => o.label.trim()) } : null, stock: st.variants ? null : st.stock };
          if (p) Object.assign(p, data); else { DB.shop.products.push({ id: uid('pr'), coachId: c.id, ...data, published: true, hidden: false, createdAt: new Date().toISOString() }); logActivity('shop', `Nouveau produit publié : ${data.name} — ${fullName(c)}`, 'package'); }
          m.close(); toast(p ? 'Produit mis à jour' : 'Produit publié'); rerender();
        });
      } });
  };

  /* Commandes */
  function tabOrders(c) {
    const st = ui('corders', { f: 'pending' });
    const all = DB.shop.orders.filter((o) => o.coachId === c.id); const list = all.filter((o) => st.f === 'all' || o.status === st.f).sort((a, b) => new Date(b.date) - new Date(a.date));
    return `<div class="row between wrap gap-8 mb-12">${seg([['pending', `À traiter (${all.filter((o) => o.status === 'pending').length})`], ['shipped', 'Expédiées'], ['all', 'Toutes']], st.f, 'corders', 'f', 'sm')}<span class="xs dim">${icon('info', 12)} L’expédition (étiquette, transporteur) se fait en dehors de l’application : ELEV8 prend la commande et suit son statut.</span></div>
      <div class="col gap-12">${list.map((o) => { const a = athleteById(o.athleteId); return `<div class="card"><div class="card-h"><div class="row gap-12">${avatar(a, 'sm')}<div><div class="semibold">Commande ${o.number} · ${esc(fullName(a))}</div><div class="xs dim">${fmt.dt(o.date)}</div></div></div><div class="row gap-8">${statusPill(o.status === 'pending' ? 'pending' : o.status, o.status === 'pending' ? 'En attente d’expédition' : undefined)}<b>${fmt.eur(o.total, 2)}</b></div></div><div class="card-b grid g-3 gap-16"><div><div class="upper mb-8">Produits</div>${o.items.map((it) => `<div class="small">${it.qty} × ${esc(ShopUtil.itemLabel(it))} <span class="dim">· ${fmt.eur(it.price * it.qty, 2)}</span></div>`).join('')}<div class="xs dim mt-4">Livraison : ${o.shipping ? fmt.eur(o.shipping, 2) : 'offerte'}</div></div><div><div class="upper mb-8">Adresse de livraison</div><div class="small">${esc(o.address.name)}<br>${esc(o.address.line1)}<br>${esc(o.address.zip)} ${esc(o.address.city)}<br>${esc(o.address.country)}</div></div><div class="col gap-8">${o.status === 'pending' ? `<button class="btn btn-primary btn-sm" data-action="order-ship" data-id="${o.id}">${icon('truck', 14)} Marquer comme expédiée</button>` : o.status === 'shipped' ? `<div class="small"><span class="t-green semibold">${icon('check', 13)} Expédiée</span> le ${fmt.date(o.shippedAt)}${o.tracking ? `<br><span class="mono xs">Suivi : ${esc(o.tracking)}</span>` : ''}</div>` : statusPill(o.status)}<button class="btn btn-ghost btn-sm" data-action="sale-invoice" data-id="${o.id}">${icon('file', 14)} Facture</button></div></div></div>`; }).join('') || card('', emptyState('package', 'Aucune commande ici'))}</div>`;
  }
  Actions['order-ship'] = (el) => {
    const o = byId(DB.shop.orders, el.dataset.id);
    openModal({ title: `Expédier la commande ${o.number}`, size: 'sm', body: `<div class="col gap-12">${field('Transporteur (facultatif)', select('carrier', ['La Poste — Colissimo', 'Mondial Relay', 'Chronopost', 'Autre'], 'La Poste — Colissimo'))}${field('Numéro de suivi (facultatif)', input('tracking', '', { placeholder: '6A12345678901' }))}<p class="xs dim">L’acheteur est prévenu automatiquement que sa commande est expédiée.</p></div>`, footer: '<button class="btn btn-ghost" data-close>Annuler</button><button class="btn btn-primary" data-ok>Confirmer l’expédition</button>',
      onMount: (box, m) => $('[data-ok]', box).addEventListener('click', () => { o.status = 'shipped'; o.shippedAt = new Date().toISOString(); o.tracking = $('[name=tracking]', box).value.trim(); o.carrier = $('[name=carrier]', box).value; notify(o.athleteId, `Votre commande <b>${o.number}</b> a été expédiée${o.tracking ? ` (suivi ${esc(o.tracking)})` : ''}`, '/athlete/orders', 'truck'); logActivity('order', `Commande ${o.number} expédiée`, 'truck'); m.close(); toast(`Commande ${o.number} marquée comme expédiée`); rerender(); }) });
  };

  /* 7.3 Ventes & factures */
  function tabSales(c) {
    const sales = ShopUtil.salesOf(c.id); const r = ShopUtil.rate();
    const gross = sum(sales, (s) => s.amount); const com = gross * r;
    return `<div class="grid g-4 mb-16">${kpi({ label: 'Ventes', value: sales.length, ic: 'receipt', tone: 'blue', sub: `${sales.filter((s) => s.kind === 'digital').length} programmes · ${sales.filter((s) => s.kind === 'product').length} commandes` })}${kpi({ label: 'Chiffre d’affaires brut', value: fmt.eur(gross, 2), ic: 'euro', tone: 'green' })}${kpi({ label: `Commission ELEV8 (${DB.platform.shopCommission} %)`, value: fmt.eur(com, 2), ic: 'percent', tone: 'amber' })}${kpi({ label: 'Montant encaissé (net)', value: fmt.eur(gross - com, 2), ic: 'building', tone: 'lime', sub: 'Hors frais de livraison' })}</div>
      ${card('Historique des ventes', `<div class="table-wrap"><table class="table"><thead><tr><th>Date</th><th>Type</th><th>Article(s)</th><th>Acheteur</th><th class="num">Montant</th><th class="num">Commission</th><th class="num">Net</th><th></th></tr></thead><tbody>${sales.map((s) => `<tr><td class="small nowrap">${fmt.date(s.date)}</td><td>${pill(s.kind === 'digital' ? 'Programme' : 'Produit', s.kind === 'digital' ? 'blue' : 'violet')}</td><td class="small" style="max-width:280px">${esc(s.label)}</td><td class="small">${esc(fullName(athleteById(s.buyer)))}</td><td class="num">${fmt.eur(s.amount, 2)}</td><td class="num dim">−${fmt.eur(s.amount * r, 2)}</td><td class="num semibold">${fmt.eur(s.amount * (1 - r), 2)}</td><td><button class="btn btn-ghost btn-xs" data-action="sale-invoice" data-id="${s.id}">${icon('download', 12)} Facture</button></td></tr>`).join('')}</tbody></table></div>`, { pad: false, actions: `<button class="btn btn-outline btn-sm" data-action="sales-csv">${icon('download', 14)} Export CSV</button>` })}`;
  }
  Actions['sales-csv'] = () => { const c = meCoach(); const r = ShopUtil.rate(); downloadFile('ventes-boutique.csv', toCSV([['Date', 'Type', 'Article', 'Acheteur', 'Montant', 'Commission', 'Net', 'Facture'], ...ShopUtil.salesOf(c.id).map((s) => [fmt.dmy(s.date), s.kind === 'digital' ? 'Programme' : 'Produit', s.label, fullName(athleteById(s.buyer)), s.amount, round(s.amount * r, 2), round(s.amount * (1 - r), 2), s.invoice])]), 'text/csv'); toast('Export CSV téléchargé'); };

  /* Livraison */
  function tabShipping(c) {
    const s = ShopUtil.shipping(c.id);
    return card('Zones et tarifs de livraison', `<form data-form="shipping" class="col gap-16"><div>${field('Zones de livraison acceptées', `<div class="row wrap gap-12">${SHIP_ZONES.map((z) => checkbox('zones', z, z, s.zones.includes(z))).join('')}</div>`)}</div><div class="grid g-2">${field('Tarif de livraison fixe', inputUnit('fee', s.fee, '€', { attrs: 'step="0.1" min="0"' }))}<div>${toggleRow('freeEnabled', 'Livraison gratuite au-dessus d’un montant', '', s.freeEnabled)}${field('', inputUnit('freeAbove', s.freeAbove, '€', { attrs: 'min="0"' }))}</div></div><div class="notice">${icon('info', 16)}<div>Exemple : un panier de ${fmt.eur(45)} paie ${fmt.eur(ShopUtil.shipFee(c.id, 45), 2)} de livraison ; un panier de ${fmt.eur(80)} paie ${fmt.eur(ShopUtil.shipFee(c.id, 80), 2)}.</div></div><div><button class="btn btn-primary" type="submit">${icon('check', 16)} Enregistrer</button></div></form>`);
  }
  Forms.shipping = (v) => { const s = ShopUtil.shipping(S.userId); Object.assign(s, { zones: v.zones, fee: Number(v.fee) || 0, freeEnabled: v.freeEnabled, freeAbove: Number(v.freeAbove) || 0 }); if (!s.zones.length) { toast('Sélectionnez au moins une zone', 'error'); return; } toast('Livraison enregistrée'); rerender(); };
})();
