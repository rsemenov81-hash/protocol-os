// Vitae Lab storefront behaviour: render from products.js, rotators, ambient motion control,
// plain-hash product views, and the cart. No dependencies.
(() => {
  const PRODUCTS = window.VITAE_PRODUCTS, RESEARCH = window.VITAE_RESEARCH;
  const FDA = 'These statements have not been evaluated by the Food and Drug Administration. This product is not intended to diagnose, treat, cure, or prevent any disease.';
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const byHandle = (h) => PRODUCTS.find((p) => p.handle === h);
  // localStorage can throw (private windows, blocked storage); the page must work without it.
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* not persisted */ } },
  };
  const announce = (msg) => { $('#announce').textContent = msg; };

  // ---------- the jar: a cut-out of the owner's label visualization (media/pack-<handle>.webp) ----------
  const PACK = { 'creatine-monohydrate': [719, 1002], 'vanilla-whey-isolate': [766, 1181], 'chocolate-whey-blend': [701, 1018], 'collagen-peptides': [712, 1047], 'magnesium-glycinate': [580, 1104], 'vitamin-d3': [550, 1005] };
  function packHTML(p, cls = '') {
    const [w, h] = PACK[p.handle];
    return `<span class="pack ${cls}" data-handle="${p.handle}" style="--ar:${w}/${h}"><img src="media/pack-${p.handle}.webp" width="${w}" height="${h}" loading="lazy" alt="${esc(p.name)} jar. Label reads: ${esc(p.rows.join(', '))}. ${esc(p.net)}."></span>`;
  }
  // Each product has its own film: the real jar on the ledge with the camera arcing around it.
  // The poster is the composited first frame, so the label in the still is exactly the artwork.
  const sceneHTML = (p) => `<div class="frame__scene stage" data-stage>
      <img class="stage__plate" src="media/jar-${p.handle}-poster.jpg" width="1280" height="720" loading="lazy" alt="${esc(p.name)} jar on a stone ledge above a misty valley. Label reads: ${esc(p.rows.join(', '))}. ${esc(p.net)}.">
      <video class="stage__video" muted loop playsinline preload="none" tabindex="-1" aria-hidden="true" data-wide="media/jar-${p.handle}"></video></div>`;

  // ---------- simulated availability (preview bar) ----------
  let sim = store.get('vitae-sim', false);
  const canBuy = (p) => p.available || sim;
  const priceText = (p) => (p.price == null ? 'Price not set' : `$${p.price.toFixed(2)}`);
  const buyButton = (p, cls = '') => canBuy(p)
    ? `<button class="btn ${cls}" type="button" data-add="${p.handle}">Add to cart</button>`
    : `<button class="btn ${cls}" type="button" disabled>Not on sale yet</button>`;
  const factsHTML = (rows) => `<dl class="facts">${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>`;

  // ---------- home: rotator, stories, compare table, research ----------
  const SHELF = [...PRODUCTS].sort((a, b) => a.order - b.order);   // dawn to dusk
  function renderHome() {
    $('#stories').innerHTML = SHELF.map((p) => `<article class="frame" id="story-${p.handle}" data-time="${p.time}">
      ${sceneHTML(p)}
      <div class="frame__text">
        <p class="kicker">No. ${p.no} · ${esc(p.descriptor)} · ${esc(p.net.replace('Net Wt ', ''))}</p>
        <h3><a href="#${p.handle}">${esc(p.name)}</a></h3>
        <p>${esc(p.summary)}</p>
        ${factsHTML([p.facts[0], ['Servings', p.servings], ['Allergens', p.allergens]])}
        <div class="actions"><a class="link" href="#${p.handle}">Read the label</a>${buyButton(p)}</div>
      </div></article>`).join('');
    $('#compare-body').innerHTML = SHELF.map((p) => `<tr><th scope="row"><a href="#${p.handle}">${esc(p.name)}</a></th><td>${esc(p.facts[0][1])}</td><td>${esc(p.key)}</td><td>${esc(p.servings)}</td><td>${esc(p.allergens)}</td></tr>`).join('');
    $('#research-list').innerHTML = RESEARCH.map(studyHTML).join('');
    watchStages();
  }
  function studyHTML(r) {
    return `<article class="study" id="study-${r.id}"><p class="study__meta">${esc(r.ingredient)}</p><h3>${esc(r.title)}</h3>
      <dl><div><dt>What it says</dt><dd>${esc(r.says)}</dd></div><div><dt>What was studied</dt><dd>${esc(r.studied)}</dd></div><div><dt>Where it stops</dt><dd>${esc(r.limits)}</dd></div></dl>
      <p class="study__cite">${esc(r.cite)} <a href="https://doi.org/${r.doi}" rel="noopener">doi:${esc(r.doi)}</a></p></article>`;
  }

  // ---------- product view ----------
  const pending = (what) => `<p class="unavailable">${what} will be shown here once the final supplier label is transcribed.</p>`;
  function renderProduct(p) {
    const sec = (title, html) => `<section class="product__sec"><h2>${title}</h2>${html}</section>`;
    $('#product-view').innerHTML = `<article class="product frame" data-product="${p.handle}" data-time="${p.time}">
      ${sceneHTML(p)}
      <div class="wrap"><a class="product__back" href="#products">← All products</a>
        <div class="product__main">
          <p class="kicker">${esc(p.descriptor)} · Dietary supplement</p>
          <h1 tabindex="-1">${esc(p.name)}</h1>
          <p>${esc(p.summary)}</p>
          <p class="caption">The jar shown is a visualization of review artwork, not a photograph of manufactured stock.</p>
          <div class="buy">
            <p class="buy__price">${priceText(p)}</p>
            <div class="buy__row">
              <div class="qty" role="group" aria-label="Quantity"><button type="button" data-qty="-1" aria-label="Decrease quantity">−</button><output id="pdp-qty" aria-live="polite">1</output><button type="button" data-qty="1" aria-label="Increase quantity">+</button></div>
              ${buyButton(p)}
            </div>
            ${canBuy(p) ? '' : '<p class="unavailable">This product is not available to buy yet. The label is still being finalized with the manufacturer.</p>'}
            <p class="unavailable">Shipping and returns details will be published before the store opens.</p>
          </div>
          ${sec('In a serving', factsHTML(p.facts))}
          ${sec('Who might consider it', `<p>${esc(p.consider)}</p>`)}
          ${sec('How to use it', p.use ? `<p class="quote">${esc(p.use)}</p><p class="unavailable">Directions as printed on the manufacturer’s current label.</p>` : pending('Directions'))}
          ${sec('Ingredients', p.ingredients ? `<p class="quote">${esc(p.ingredients)}</p>` : pending('The full ingredient list'))}
          ${sec('Allergens and warnings', `<p><strong>${esc(p.allergens)}.</strong></p>${p.warnings ? `<p class="quote">${esc(p.warnings)}</p>` : pending('Warnings')}`)}
          ${sec('Evidence and limits', p.research.map((id) => studyHTML(RESEARCH.find((r) => r.id === id))).join('') + `<p class="fda">${FDA}</p>`)}
          ${p.review.length ? `<div class="preview-note"><p>Preview note. Open label questions (${esc(p.sku)}; ${esc(p.verified)}):</p><ul>${p.review.map((r) => `<li>${esc(r)}</li>`).join('')}</ul></div>` : `<p class="preview-note">Preview note. ${esc(p.sku)}; ${esc(p.verified)}. No open label questions recorded.</p>`}
        </div>
      </div></article>`;
    watchStages();
  }

  // ---------- router: plain #name only (the same links work on Shopify as /products/<handle>) ----------
  const HOME_TITLE = document.title;
  function route(focus = true) {
    const p = byHandle(decodeURIComponent(location.hash.slice(1)));
    $('#home-view').hidden = !!p;
    $('#product-view').hidden = !p;
    $('#primary-nav').classList.remove('is-open');
    $('#menu-btn').setAttribute('aria-expanded', 'false');
    if (p) {
      renderProduct(p);
      document.title = `${p.name} | Vitae Lab`;
      window.scrollTo(0, 0);
      if (focus) $('#product-view h1').focus({ preventScroll: true });
    } else {
      document.title = HOME_TITLE;
      // Coming back from a product view: the anchor target was hidden when the hash changed, so scroll now.
      const target = location.hash.length > 1 && document.getElementById(location.hash.slice(1));
      if (target) target.scrollIntoView();
    }
  }
  addEventListener('hashchange', () => route());

  // ---------- ambient motion: several filmed stages, but only the one most in view ever plays ----------
  const root = document.documentElement, motionBtn = $('#motion-btn');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const saveData = !!(navigator.connection && navigator.connection.saveData);
  let motion = store.get('vitae-motion', null);
  if (motion == null) motion = !reduced.matches;        // reduced-motion users start paused and may opt in
  let activeStage = null;
  const seen = new Map();                               // stage -> visible pixels
  const stageWatch = new IntersectionObserver((entries) => {
    for (const e of entries) seen.set(e.target, e.isIntersecting ? e.intersectionRect.height : 0);
    let best = null;
    for (const [el, px] of seen) if (el.isConnected && px > 0 && (!best || px > seen.get(best))) best = el;
    if (best !== activeStage) { activeStage = best; applyMotion(); }
  }, { threshold: [0, 0.2, 0.4, 0.6, 0.8, 1] });
  function watchStages() {
    for (const el of [...seen.keys()]) if (!el.isConnected) { stageWatch.unobserve(el); seen.delete(el); }
    $$('[data-stage]').forEach((el) => { if (!seen.has(el)) { seen.set(el, 0); stageWatch.observe(el); } });
  }
  function applyMotion() {
    root.dataset.motion = motion ? 'on' : 'off';
    motionBtn.setAttribute('aria-pressed', String(!motion));
    motionBtn.firstChild.textContent = motion ? 'Pause' : 'Play';
    const allowed = motion && !saveData && !document.hidden && document.readyState === 'complete';   // posters first; loops only after load
    for (const stage of seen.keys()) for (const video of $$('.stage__video', stage)) {
      if (allowed && stage === activeStage) {
        if (!video.src) {
          // H.264 where the browser has it (every mainstream one); VP9 WebM for Chromium builds without it.
          const ext = video.canPlayType('video/mp4; codecs="avc1.4D401E"') ? 'mp4' : 'webm';
          const tall = video.dataset.tall && matchMedia('(max-width: 700px)').matches;
          video.src = `${tall ? video.dataset.tall : video.dataset.wide}.${ext}`;
        }
        video.play().catch(() => { /* autoplay refused or file missing: the poster stays */ });
      } else video.pause();
    }
  }
  // The jar in the opening leans a few degrees toward the pointer. Decorative; off with motion.
  const openingStage = $('.stage--opening'), heroPacks = $('#hero-packs');
  openingStage.addEventListener('pointermove', (e) => {
    if (!motion || e.pointerType === 'touch') return;
    const r = openingStage.getBoundingClientRect();
    heroPacks.style.setProperty('--ry', `${(((e.clientX - r.left) / r.width) - 0.5) * 14}deg`);
    heroPacks.style.setProperty('--rx', `${(0.5 - ((e.clientY - r.top) / r.height)) * 8}deg`);
  });
  openingStage.addEventListener('pointerleave', () => { heroPacks.style.removeProperty('--ry'); heroPacks.style.removeProperty('--rx'); });
  // Media events do not bubble; capture them for every stage, including ones drawn later.
  document.addEventListener('playing', (e) => e.target.classList && e.target.classList.add('is-playing'), true);
  document.addEventListener('error', (e) => e.target.classList && e.target.classList.remove('is-playing'), true);
  motionBtn.addEventListener('click', () => { motion = !motion; store.set('vitae-motion', motion); applyMotion(); });
  document.addEventListener('visibilitychange', applyMotion);
  addEventListener('load', applyMotion);

  // ---------- rotators: all items share one grid cell, so the longest reserves the space ----------
  function startRotator(list) {
    let i = 0, held = false;
    const items = () => $$(':scope > li', list);
    list.addEventListener('pointerenter', () => { held = true; });
    list.addEventListener('pointerleave', () => { held = false; });
    list.addEventListener('focusin', () => { held = true; });
    list.addEventListener('focusout', () => { held = false; });
    setInterval(() => {
      if (!motion || held || document.hidden || $('#home-view').hidden) return;
      const li = items();
      i = (i + 1) % li.length;
      li.forEach((el, n) => {
        el.classList.toggle('is-on', n === i);
        const a = $('a', el);
        if (a) a.tabIndex = n === i ? 0 : -1;
      });
      if (list.id === 'product-rotator') $$('#hero-packs .pack').forEach((el, n) => el.classList.toggle('is-on', n === i));
    }, Number(list.dataset.interval));
  }

  // ---------- cart ----------
  // Two adapters with one shape. `local` is the preview: it keeps lines in this browser and never takes
  // an order. `shopify` talks to the Shopify Ajax Cart API and hands off to Shopify checkout; it is used
  // only inside a Shopify theme and has not been run against the store yet (docs/SHOPIFY.md).
  const local = {
    lines: store.get('vitae-cart', []),
    async get() { return this.lines; },
    async set(handle, qty) {
      if (window.VITAE_FAIL_CART) throw new Error('simulated cart failure');
      const line = this.lines.find((l) => l.handle === handle);
      if (qty <= 0) this.lines = this.lines.filter((l) => l !== line);
      else if (line) line.qty = Math.min(qty, 10);
      else this.lines.push({ handle, qty: Math.min(qty, 10) });
      store.set('vitae-cart', this.lines);
      return this.lines;
    },
    checkout() { return false; },
  };
  const shopify = {
    async call(path, body) {
      const r = await fetch(path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : undefined);
      if (!r.ok) throw new Error(`cart ${r.status}`);
      return r.json();
    },
    lines: (cart) => cart.items.map((i) => ({ handle: i.handle, qty: i.quantity })),
    async get() { return this.lines(await this.call('/cart.js')); },
    async set(handle, qty, current) {
      const id = byHandle(handle).variantId;
      if (!current) await this.call('/cart/add.js', { id, quantity: qty });
      else await this.call('/cart/change.js', { id: String(id), quantity: qty });
      return this.get();
    },
    checkout() { location.href = '/checkout'; return true; },
  };
  const cartApi = window.Shopify ? shopify : local;
  const cartEl = $('#cart');
  let lines = [];

  function renderCart() {
    const count = lines.reduce((n, l) => n + l.qty, 0);
    $('#cart-count').textContent = `(${count})`;
    $('#cart-foot').hidden = !lines.length;
    $('#cart-handoff').textContent = '';
    $('#cart-body').innerHTML = lines.length ? lines.map((l) => {
      const p = byHandle(l.handle);
      return `<div class="cart__line"><div><h3>${esc(p.name)}</h3><p>${esc(p.net.replace('Net Wt ', ''))} · ${priceText(p)}</p></div>
        <div class="qty" role="group" aria-label="Quantity of ${esc(p.name)}"><button type="button" data-line="${p.handle}" data-delta="-1" aria-label="Decrease quantity of ${esc(p.name)}">−</button><output>${l.qty}</output><button type="button" data-line="${p.handle}" data-delta="1" aria-label="Increase quantity of ${esc(p.name)}">+</button></div>
        <button type="button" class="cart__remove" data-line="${p.handle}" data-delta="-99">Remove<span class="sr-only"> ${esc(p.name)}</span></button></div>`;
    }).join('') : '<div class="cart__empty"><p>Your cart is empty.</p><a class="btn btn--ink" href="#products" data-close>Browse products</a></div>';
    const priced = lines.every((l) => byHandle(l.handle).price != null);
    $('#cart-subtotal').textContent = priced ? `$${lines.reduce((s, l) => s + byHandle(l.handle).price * l.qty, 0).toFixed(2)}` : 'Shown once prices are set';
  }
  async function setLine(handle, qty, verb) {
    const err = $('#cart-error');
    err.hidden = true;
    try {
      const current = lines.find((l) => l.handle === handle);
      lines = await cartApi.set(handle, qty, current);
      renderCart();
      announce(`${byHandle(handle).name} ${verb}. Cart has ${lines.reduce((n, l) => n + l.qty, 0)} items.`);
      return true;
    } catch {
      err.textContent = 'We couldn’t update your cart. Check your connection and try again.';
      err.hidden = false;
      if (!cartEl.open) cartEl.showModal();
      return false;
    }
  }

  document.addEventListener('click', async (e) => {
    const t = e.target.closest('button, a');
    if (!t) return;
    if (t.dataset.add) {
      const qty = Number(($('#pdp-qty') && !$('#product-view').hidden && $('#pdp-qty').value) || 1);
      const have = (lines.find((l) => l.handle === t.dataset.add) || { qty: 0 }).qty;
      if (await setLine(t.dataset.add, have + qty, 'added to cart') && !cartEl.open) cartEl.showModal();
    } else if (t.dataset.qty) {
      const out = $('#pdp-qty');
      out.value = Math.max(1, Math.min(10, Number(out.value) + Number(t.dataset.qty)));
    } else if (t.dataset.line) {
      const have = lines.find((l) => l.handle === t.dataset.line).qty, next = have + Number(t.dataset.delta);
      await setLine(t.dataset.line, next, next <= 0 ? 'removed' : 'quantity updated');
      // The pressed control is re-rendered; keep keyboard focus inside the dialog.
      ($(`[data-line="${t.dataset.line}"][data-delta="${t.dataset.delta}"]`, cartEl) || $('#cart-close')).focus();
    } else if (t.id === 'cart-btn') cartEl.showModal();
    else if (t.id === 'cart-close' || 'close' in t.dataset) cartEl.close();
    else if (t.id === 'checkout-btn') {
      if (!cartApi.checkout()) $('#cart-handoff').textContent = 'Checkout runs on Shopify. This preview is not connected to the store, so no order was placed and nothing was charged.';
    } else if (t.id === 'menu-btn') {
      const open = $('#primary-nav').classList.toggle('is-open');
      t.setAttribute('aria-expanded', String(open));
    }
  });
  cartEl.addEventListener('click', (e) => { if (e.target === cartEl) cartEl.close(); });   // backdrop click

  $('#sim-toggle').checked = sim;
  $('#sim-toggle').addEventListener('change', (e) => { sim = e.target.checked; store.set('vitae-sim', sim); renderHome(); route(false); });

  // ---------- start ----------
  // Opening artwork is drawn once, in the order of the product names already in the HTML.
  $('#hero-packs').innerHTML = $$('#product-rotator a').map((a, n) => packHTML(byHandle(a.hash.slice(1)), n ? '' : 'is-on')).join('');
  $$('#hero-packs img').forEach((img, n) => { if (!n) img.loading = 'eager'; });
  renderHome();
  route(false);
  applyMotion();
  $$('[data-rotator]').forEach(startRotator);
  cartApi.get().then((l) => { lines = l.filter((x) => byHandle(x.handle)); renderCart(); }).catch(() => renderCart());
})();
