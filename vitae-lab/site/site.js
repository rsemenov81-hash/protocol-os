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

  // ---------- pack art: Ledger label on an illustrative container (ported from vitae-lab/labels/index.html) ----------
  function labelHTML(s, mm) {
    const tub = s.form === 'tub', H = s.H * mm, W = Math.round(s.dia * 0.78 * mm);
    const v = { H, W, m: H * (tub ? 0.08 : 0.06), name: H * (tub ? 0.09 : 0.065) / 0.66, desc: H * (tub ? 0.045 : 0.035) / 0.7, data: H * 0.028 / 0.7, no: H * 0.035 / 0.7, netfs: 3.2 * mm / 0.7 };
    const vars = Object.entries(v).map(([k, x]) => `--${k}:${x.toFixed(1)}px`).join(';') + `;--acc:${s.accent};--debossB:${tub ? 0.36 : 0.4}`;
    return `<div class="label" style="${vars}"><div class="front">
      <div class="mono"><i class="lg lg-letters"></i><i class="lg lg-helix"></i></div><i class="lg word lg-wordmark"></i>
      <div class="deboss">${s.no}</div>
      <div class="name">${s.labelName.map((n) => `<span>${esc(n)}</span>`).join('')}</div>
      <div class="desc">${esc(s.descriptor)}</div><div class="ident">Dietary Supplement</div>
      <div class="rules"></div><div class="chip"></div><div class="no">No. ${s.no}</div>
      ${s.rows.map((r, i) => `<div class="row r${i + 1}">${esc(r)}</div>`).join('')}
      <div class="net">${esc(s.net)}</div></div></div>`;
  }
  function packHTML(s, mm = 2.3) {
    const tub = s.form === 'tub', D = s.dia * mm, BH = s.bodyH * mm;
    const CD = (tub ? s.dia + 4 : s.dia * 0.66) * mm, CH = (tub ? 18 : 16) * mm, DD = (tub ? 30 : 20) * mm;
    const LT = tub ? (s.bodyH - s.H - 8) * mm / 2 + 4 * mm : (s.bodyH - s.H) * mm * 0.55;
    const vars = `--D:${D}px;--BH:${BH}px;--CD:${CD}px;--CH:${CH}px;--DD:${DD}px;--LT:${LT}px;--bodyc:var(${tub ? '--tub' : '--amber'});--capc:${tub ? '#E6E1D6' : '#1B1B1A'};--acc:${s.accent}`;
    const neck = tub ? '' : '<div class="neck"><div class="shade"></div></div><div class="shoulder"><div class="shade"></div></div>';
    // The drawing is one image to assistive tech; the same facts are real text beside it.
    return `<div class="pack-art" data-handle="${s.handle}" role="img" aria-label="Label preview: ${esc(s.name)}, ${esc(s.net)}"><div class="pack ${s.form}" style="${vars}" aria-hidden="true">
      <div class="shadow"></div><div class="cap"><div class="shade"></div><div class="top"></div><div class="disc"></div></div>${neck}
      <div class="body">${labelHTML(s, mm)}<div class="shade"></div><div class="wet"></div></div></div></div>`;
  }

  // ---------- simulated availability (preview bar) ----------
  let sim = store.get('vitae-sim', false);
  const canBuy = (p) => p.available || sim;
  const priceText = (p) => (p.price == null ? 'Price not set' : `$${p.price.toFixed(2)}`);
  const buyButton = (p, cls = '') => canBuy(p)
    ? `<button class="btn ${cls}" type="button" data-add="${p.handle}">Add to cart</button>`
    : `<button class="btn ${cls}" type="button" disabled>Not on sale yet</button>`;
  const factsHTML = (rows) => `<dl class="facts">${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>`;

  // ---------- home: rotator, stories, compare table, research ----------
  function renderHome() {
    $('#stories').innerHTML = PRODUCTS.map((p) => `<article class="story" id="story-${p.handle}">
      <div class="story__art reveal">${packHTML(p)}</div>
      <div class="story__text">
        <p class="story__sku">${esc(p.descriptor)} · ${esc(p.net.replace('Net Wt ', ''))}</p>
        <h3><a href="#${p.handle}">${esc(p.name)}</a></h3>
        <p>${esc(p.summary)}</p>
        ${factsHTML(p.facts.slice(0, 3).concat([['Allergens', p.allergens]]))}
        <div class="actions"><a class="link" href="#${p.handle}">Read the label</a>${buyButton(p)}</div>
      </div></article>`).join('');
    $('#compare-body').innerHTML = PRODUCTS.map((p) => `<tr><th scope="row"><a href="#${p.handle}">${esc(p.name)}</a></th><td>${esc(p.facts[0][1])}</td><td>${esc(p.key)}</td><td>${esc(p.servings)}</td><td>${esc(p.allergens)}</td></tr>`).join('');
    $('#research-list').innerHTML = RESEARCH.map(studyHTML).join('');
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
    $('#product-view').innerHTML = `<article class="product wrap" data-product="${p.handle}">
      <a class="product__back" href="#products">← All products</a>
      <div class="product__grid">
        <div class="product__art">${packHTML(p)}<p class="caption">Label preview drawn from review artwork. Not a photograph of manufactured stock.</p></div>
        <div class="product__main">
          <p class="story__sku">${esc(p.descriptor)} · Dietary supplement</p>
          <h1 tabindex="-1">${esc(p.name)}</h1>
          <p>${esc(p.summary)}</p>
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

  // ---------- ambient motion: one loop, loaded late, pausable ----------
  const root = document.documentElement, video = $('.scene__video'), motionBtn = $('#motion-btn');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const saveData = !!(navigator.connection && navigator.connection.saveData);
  let motion = store.get('vitae-motion', null);
  if (motion == null) motion = !reduced.matches;        // reduced-motion users start paused and may opt in
  function applyMotion() {
    root.dataset.motion = motion ? 'on' : 'off';
    motionBtn.setAttribute('aria-pressed', String(!motion));
    motionBtn.firstChild.textContent = motion ? 'Pause' : 'Play';
    if (motion && !saveData && !document.hidden) {
      // Poster is already painted; fetch the loop only now, and only one size.
      if (document.readyState !== 'complete') return;   // wait for the page itself; see the load listener below
      if (!video.src) video.src = matchMedia('(max-width: 700px)').matches ? 'media/water-640.mp4' : 'media/water-960.mp4';
      video.play().catch(() => { /* autoplay refused or file missing: the poster stays */ });
    } else video.pause();
  }
  video.addEventListener('playing', () => video.classList.add('is-playing'));
  video.addEventListener('error', () => video.classList.remove('is-playing'));
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
      if (list.id === 'product-rotator') $$('#hero-packs .pack-art').forEach((el, n) => el.classList.toggle('is-on', n === i));
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
  $('#hero-packs').innerHTML = $$('#product-rotator a').map((a) => packHTML(byHandle(a.hash.slice(1)))).join('');
  $('#hero-packs .pack-art').classList.add('is-on');
  renderHome();
  route(false);
  applyMotion();
  $$('[data-rotator]').forEach(startRotator);
  cartApi.get().then((l) => { lines = l.filter((x) => byHandle(x.handle)); renderCart(); }).catch(() => renderCart());
})();
