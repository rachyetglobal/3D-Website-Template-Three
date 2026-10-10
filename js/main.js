import { PROPERTY, MEDIA, SCENES, GALLERY, TOUR_LENGTH_VH, still, srcset } from './config.js';
import { ScrollTour } from './tour.js';
import { Rail, Slideshow } from './carousel.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const TBC = '<span class="tbc">To be confirmed</span>';
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const val = (v) => (v === null || v === undefined || v === '' ? TBC : esc(v));
const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const pad = (n) => String(n).padStart(2, '0');

const html = document.documentElement;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
let lenis = null;

/* ---------------- Branding ---------------- */
document.title = `${PROPERTY.name} — A Private Residence`;
$$('[data-bind="name"]').forEach((el) => { el.textContent = PROPERTY.name; });
$('.wordmark__mark').textContent = PROPERTY.shortName.charAt(0);
$('[data-giant]').textContent = PROPERTY.shortName;
$('[data-year]').textContent = new Date().getFullYear();
$$('img[data-srcset]').forEach((img) => { img.srcset = srcset(img.dataset.srcset); });

/* ---------------- Preloader (real film download progress) ---------------- */
const pre = $('[data-preloader]');
const preCount = $('[data-preloader-count]');
const preBar = $('[data-preloader-bar]');
let preTarget = 0;
let preShown = 0;
let preDone = false;
const preStart = performance.now();

function tickPreloader() {
  if (preDone && preShown >= 100) return;
  preShown += (preTarget * 100 - preShown) * 0.12;
  if (preTarget >= 1 && preShown > 99.4) preShown = 100;
  preCount.textContent = Math.floor(preShown);
  preBar.style.transform = `scaleX(${(preShown / 100).toFixed(3)})`;
  requestAnimationFrame(tickPreloader);
}
requestAnimationFrame(tickPreloader);

function finishPreloader() {
  if (preDone) return;
  preDone = true;
  preTarget = 1;
  const wait = Math.max(0, 900 - (performance.now() - preStart));
  setTimeout(() => {
    pre.classList.add('is-done');
    html.classList.remove('is-loading');
    html.classList.add('is-ready');
    lenis?.start();
    setTimeout(() => pre.remove(), 1400);
  }, reducedMotion ? 0 : wait + 350);
}
// Never hold visitors for long: after 6 s the tour starts with stills and the
// film swaps in when it arrives.
setTimeout(finishPreloader, reducedMotion ? 0 : 6000);

/* ---------------- Tour ---------------- */
const tourRoot = $('[data-tour]');
const tour = new ScrollTour({
  root: tourRoot,
  scenes: SCENES,
  media: MEDIA,
  lengthVh: TOUR_LENGTH_VH,
  reducedMotion,
  onProgress: (p) => { preTarget = Math.max(preTarget, p); },
  onReady: () => finishPreloader(),
}).init();

/* ---------------- Smooth scroll (Lenis) ---------------- */
async function initSmoothScroll() {
  if (reducedMotion) return;
  try {
    const { default: Lenis } = await import('https://cdn.jsdelivr.net/npm/lenis@1.1.13/dist/lenis.mjs');
    lenis = new Lenis({ lerp: 0.09, smoothWheel: true, wheelMultiplier: 1 });
    if (html.classList.contains('is-loading')) lenis.stop();
    tour.scroller = lenis;
  } catch (err) {
    console.info('[scroll] Smooth scroll unavailable, using native scrolling.', err?.message || '');
  }
}
initSmoothScroll();

function scrollToTarget(target, opts = {}) {
  const navH = $('[data-nav]').offsetHeight;
  if (lenis) {
    lenis.scrollTo(target, { offset: typeof target === 'number' ? 0 : -navH + 1, duration: opts.duration || 1.6 });
  } else if (typeof target === 'number') {
    window.scrollTo({ top: target, behavior: reducedMotion ? 'auto' : 'smooth' });
  } else {
    window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - navH + 1, behavior: reducedMotion ? 'auto' : 'smooth' });
  }
}

// In-page links use the smooth scroller.
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#"]');
  if (!a || e.defaultPrevented) return;
  const id = a.getAttribute('href');
  if (id === '#' || /^#scene-\d+$/.test(id)) return;
  const el = id === '#top' ? 0 : $(id);
  if (el === null) return;
  e.preventDefault();
  if (id === '#top') scrollToTarget(0, { duration: 2.2 });
  else scrollToTarget(el);
  if (el && el.focus && id !== '#top') {
    el.setAttribute('tabindex', '-1');
    setTimeout(() => el.focus({ preventScroll: true }), 900);
  }
});

// Deep links such as #scene-3 jump to a scene.
const sceneHash = () => {
  const m = location.hash.match(/^#scene-(\d+)$/);
  if (m) tour.goTo(clamp(Number(m[1]), 1, SCENES.length) - 1);
};
window.addEventListener('hashchange', sceneHash);
if (/^#scene-\d+$/.test(location.hash)) setTimeout(sceneHash, 300);

/* ---------------- Navigation ---------------- */
const nav = $('[data-nav]');
let lastY = window.scrollY;
function updateNav() {
  const y = window.scrollY;
  const end = tour.top + tour.scrollable;
  const light = y > end - 60;
  nav.classList.toggle('is-light', light);
  const menuOpen = toggle.getAttribute('aria-expanded') === 'true';
  nav.classList.toggle('is-hidden', !menuOpen && light && y > end + 300 && y > lastY + 2);
  if (y < lastY - 2 || !light) nav.classList.remove('is-hidden');
  lastY = y;
}

// Highlight the section link currently in view.
const navLinks = $$('.site-nav__links a');
const sectionMap = new Map(navLinks.map((a) => [a.getAttribute('href').slice(1), a]));
const sectionObserver = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (!e.isIntersecting) return;
    const id = e.target.id === 'tour' ? 'top' : e.target.id;
    navLinks.forEach((a) => a.classList.toggle('is-current', a === sectionMap.get(id)));
  });
}, { rootMargin: '-45% 0px -50% 0px' });
['tour', 'rooms', 'gallery', 'details'].forEach((id) => sectionObserver.observe(document.getElementById(id)));

/* ---------------- Menu ---------------- */
const toggle = $('[data-menu-toggle]');
const menu = $('[data-menu]');
const menuImg = $('[data-menu-img]');
const setMenu = (open) => {
  toggle.setAttribute('aria-expanded', String(open));
  toggle.querySelector('.menu-toggle__label').textContent = open ? 'Close' : 'Menu';
  if (open) {
    menu.hidden = false;
    requestAnimationFrame(() => requestAnimationFrame(() => menu.classList.add('is-open')));
    lenis?.stop();
    html.style.overflow = 'hidden';
    setTimeout(() => $('a', menu).focus(), 300);
  } else {
    menu.classList.remove('is-open');
    lenis?.start();
    html.style.overflow = '';
    setTimeout(() => { if (toggle.getAttribute('aria-expanded') === 'false') menu.hidden = true; }, 900);
  }
};
toggle.addEventListener('click', () => setMenu(toggle.getAttribute('aria-expanded') !== 'true'));
$$('[data-menu-link]').forEach((a) => {
  a.addEventListener('click', () => setMenu(false));
  const swap = () => {
    const src = still(a.dataset.img, 'md');
    if (menuImg.getAttribute('src') === src) return;
    menuImg.classList.add('is-swapping');
    setTimeout(() => { menuImg.src = src; menuImg.classList.remove('is-swapping'); }, 180);
  };
  a.addEventListener('mouseenter', swap);
  a.addEventListener('focus', swap);
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
    setMenu(false);
    toggle.focus();
  }
});

/* ---------------- Text splitting ---------------- */
function splitWords(root, cls = 'sw') {
  let i = 0;
  const walk = (node) => {
    [...node.childNodes].forEach((child) => {
      if (child.nodeType === 3) {
        const frag = document.createDocumentFragment();
        child.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
          const outer = document.createElement('span');
          outer.className = cls;
          const inner = document.createElement('span');
          inner.style.setProperty('--i', i++);
          inner.textContent = part;
          outer.appendChild(inner);
          frag.appendChild(outer);
        });
        child.replaceWith(frag);
      } else if (child.nodeType === 1) {
        walk(child);
      }
    });
  };
  root.setAttribute('aria-label', root.textContent.trim());
  walk(root);
  [...root.children].forEach((c) => c.setAttribute('aria-hidden', 'true'));
}
$$('[data-split]').forEach((el) => splitWords(el));

// Footer giant wordmark: letter by letter.
const giant = $('[data-giant]');
giant.innerHTML = [...PROPERTY.shortName].map((ch, i) => `<span class="sw"><span style="--i:${i}">${esc(ch)}</span></span>`).join('');

/* ---------------- Overview statement (fills word by word on scroll) ---------------- */
const statement = $('[data-fill]');
const statementText = `${PROPERTY.tagline} Eight scenes, one continuous story — from the garden gate to the balcony.`;
const accentWords = new Set(['space,', 'light', 'elegance.', 'story']);
statement.setAttribute('aria-label', statementText);
statement.innerHTML = statementText.split(' ').map((w) =>
  `<span class="fw${accentWords.has(w.toLowerCase()) ? ' is-accent' : ''}" aria-hidden="true">${esc(w)}</span>`).join(' ');
const fillWords = $$('.fw', statement);
let lit = -1;
function updateFill(vh) {
  const r = statement.getBoundingClientRect();
  if (r.bottom < -100 || r.top > vh + 100) return;
  const p = reducedMotion ? 1 : clamp((vh * 0.88 - r.top) / (r.height + vh * 0.35));
  const n = Math.round(p * fillWords.length);
  if (n === lit) return;
  fillWords.forEach((w, i) => w.classList.toggle('is-lit', i < n));
  lit = n;
}

/* ---------------- Overview & facts ---------------- */
const s = PROPERTY.specs;
$('[data-overview]').innerHTML = PROPERTY.overview
  ? PROPERTY.overview.split(/\n{2,}/).map((p) => `<p>${esc(p)}</p>`).join('')
  : `<p>A private residence, revealed one room at a time.</p>
     <p>The written description has not been supplied yet. Add it as <code>PROPERTY.overview</code> in <code>js/config.js</code>.</p>`;

$('[data-facts]').innerHTML = [
  ['Bedrooms', s.bedrooms],
  ['Bathrooms', s.bathrooms],
  ['Built-up area', s.builtUpArea],
  ['Land area', s.landArea],
].map(([k, v]) => `<div><dt>${k}</dt><dd>${val(v)}</dd></div>`).join('');

/* ---------------- Rooms carousel ---------------- */
const rooms = SCENES.filter((sc) => sc.card);
$('[data-rooms-total]').textContent = pad(rooms.length);
$('[data-rooms]').innerHTML = rooms.map((r, i) => `
  <li class="room">
    <img class="room__img" src="${still(r.card, 'md')}" srcset="${srcset(r.card)}" sizes="(max-width: 760px) 90vw, 560px" alt="${esc(r.label)}" loading="lazy" decoding="async" draggable="false">
    <span class="room__num">${pad(i + 1)}</span>
    <div class="room__body">
      <h3 class="room__title">${esc(r.label)}</h3>
      <p class="room__blurb">${esc(r.blurb)}</p>
      <button class="room__btn" type="button" data-scene="${SCENES.indexOf(r)}"><b aria-hidden="true">&#9654;</b> Watch in the film</button>
    </div>
  </li>`).join('');
$('[data-rooms]').addEventListener('click', (e) => {
  const b = e.target.closest('[data-scene]');
  if (b) tour.goTo(Number(b.dataset.scene));
});
new Rail({
  rail: $('[data-rooms-rail]'),
  prev: $('[data-rooms-prev]'),
  next: $('[data-rooms-next]'),
  progress: $('[data-rooms-progress]'),
  indexEl: $('[data-rooms-index]'),
  playBtn: $('[data-rooms-play]'),
  autoplay: 3500,
  reducedMotion,
}).init();

/* ---------------- Count-up stats ---------------- */
const countIO = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (!e.isIntersecting) return;
    countIO.unobserve(e.target);
    const el = e.target;
    const end = Number(el.dataset.count);
    const suffix = el.dataset.suffix || '';
    if (reducedMotion) { el.textContent = `${pad(end)}${suffix}`; return; }
    const t0 = performance.now();
    const step = (now) => {
      const p = Math.min(1, (now - t0) / 1600);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = `${pad(Math.round(end * eased))}${suffix}`;
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}, { threshold: 0.6 });
$$('[data-count]').forEach((el) => countIO.observe(el));

/* ---------------- Gallery slideshow + lightbox ---------------- */
const lb = $('[data-lightbox]');
const lbImg = $('[data-lightbox-img]');
const lbCap = $('[data-lightbox-caption]');
let lbIndex = 0;
const showLb = (i) => {
  lbIndex = (i + GALLERY.length) % GALLERY.length;
  const g = GALLERY[lbIndex];
  lbImg.src = still(g.file);
  lbImg.alt = g.caption;
  lbCap.textContent = `${g.caption} — ${lbIndex + 1} / ${GALLERY.length}`;
};
const openLb = (i) => {
  showLb(i);
  if (typeof lb.showModal === 'function') { lb.showModal(); lenis?.stop(); } else window.open(lbImg.src, '_blank');
};
$('[data-lightbox-prev]').addEventListener('click', () => showLb(lbIndex - 1));
$('[data-lightbox-next]').addEventListener('click', () => showLb(lbIndex + 1));
$('[data-lightbox-close]').addEventListener('click', () => lb.close());
lb.addEventListener('close', () => lenis?.start());
lb.addEventListener('click', (e) => { if (e.target === lb) lb.close(); });
lb.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft') showLb(lbIndex - 1);
  if (e.key === 'ArrowRight') showLb(lbIndex + 1);
});

new Slideshow({
  root: $('[data-show]'),
  items: GALLERY,
  src: still,
  srcset,
  onOpen: openLb,
  reducedMotion,
}).init();

/* ---------------- Feature rows + hover image ---------------- */
$('[data-features]').innerHTML = PROPERTY.observedFeatures.map((f, i) => `
  <li class="feature-row" tabindex="0" data-img="${esc(f.image)}">
    <span class="feature-row__num">${pad(i + 1)}</span>
    <h3 class="feature-row__title">${esc(f.title)}</h3>
    <p class="feature-row__note">${esc(f.note)}</p>
    <span class="feature-row__arrow" aria-hidden="true">&rarr;</span>
    <img class="feature-row__thumb" src="${still(f.image, 'sm')}" alt="" loading="lazy" decoding="async">
  </li>`).join('');

const hoverImg = $('[data-hover-img]');
const hoverImgEl = $('img', hoverImg);
const hover = { x: 0, y: 0, tx: 0, ty: 0, on: false };
if (finePointer && !reducedMotion) {
  // Preload the hover images so they appear instantly.
  PROPERTY.observedFeatures.forEach((f) => { new Image().src = still(f.image, 'sm'); });
  const rows = $('[data-features]');
  rows.addEventListener('mouseover', (e) => {
    const row = e.target.closest('.feature-row');
    if (!row) return;
    hoverImgEl.src = still(row.dataset.img, 'sm');
    if (!hover.on) { hover.x = hover.tx; hover.y = hover.ty; }
    hover.on = true;
    hoverImg.classList.add('is-on');
  });
  rows.addEventListener('mouseleave', () => { hover.on = false; hoverImg.classList.remove('is-on'); });
}

/* ---------------- Details tabs ---------------- */
$('[data-specs]').innerHTML = [
  ['Guide price', s.price],
  ['Bedrooms', s.bedrooms],
  ['Bathrooms', s.bathrooms],
  ['Reception rooms', s.receptionRooms],
  ['Built-up area', s.builtUpArea],
  ['Land area', s.landArea],
  ['Parking', s.parking],
  ['Tenure', s.tenure],
  ['Year built', s.yearBuilt],
  ['Energy rating', s.energyRating],
].map(([k, v]) => `<div><dt>${k}</dt><dd>${val(v)}</dd></div>`).join('');

$('[data-amenities]').innerHTML = PROPERTY.amenities.length
  ? PROPERTY.amenities.map((a) => `<li>${esc(a)}</li>`).join('')
  : `<li>${TBC}</li><li>Add confirmed amenities to <code>PROPERTY.amenities</code></li>`;

$('[data-plans]').innerHTML = PROPERTY.floorPlans.length
  ? `<div class="plans__grid">${PROPERTY.floorPlans.map((p) => `
      <figure><img src="${esc(p.src)}" alt="${esc(p.label)} floor plan" loading="lazy"><figcaption>${esc(p.label)}</figcaption></figure>`).join('')}</div>`
  : `<div class="placeholder"><div><strong>Floor plans to follow</strong>
      Official plans have not been supplied. Add them to <code>PROPERTY.floorPlans</code> in <code>js/config.js</code>.</div></div>`;

const loc = PROPERTY.location;
$('[data-location]').innerHTML = loc.address
  ? `<p class="location__address">${esc(loc.address)}</p>
     ${loc.notes ? `<p class="note">${esc(loc.notes)}</p>` : ''}
     <iframe class="location__map" title="Map showing ${esc(loc.address)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade"
       src="https://maps.google.com/maps?q=${encodeURIComponent(loc.mapQuery || loc.address)}&z=14&output=embed"></iframe>`
  : `<div class="placeholder"><div><strong>Location available on request</strong>
      No address has been supplied. Set <code>PROPERTY.location.address</code> to show the address and a map.</div></div>`;

const tabList = $('[role="tablist"]');
const tabs = $$('[role="tab"]', tabList);
const ink = $('[data-tabs-ink]');
const placeInk = () => {
  const t = tabs.find((b) => b.getAttribute('aria-selected') === 'true');
  ink.style.width = `${t.offsetWidth}px`;
  ink.style.transform = `translateX(${t.offsetLeft}px)`;
};
const selectTab = (t, focus) => {
  tabs.forEach((b) => {
    const on = b === t;
    b.setAttribute('aria-selected', String(on));
    b.tabIndex = on ? 0 : -1;
    document.getElementById(b.getAttribute('aria-controls')).hidden = !on;
  });
  if (focus) t.focus();
  placeInk();
};
tabs.forEach((t, i) => {
  t.addEventListener('click', () => selectTab(t));
  t.addEventListener('keydown', (e) => {
    const k = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    if (k) { e.preventDefault(); selectTab(tabs[(i + k + tabs.length) % tabs.length], true); }
    if (e.key === 'Home') { e.preventDefault(); selectTab(tabs[0], true); }
    if (e.key === 'End') { e.preventDefault(); selectTab(tabs[tabs.length - 1], true); }
  });
});
placeInk();
window.addEventListener('resize', placeInk);
document.fonts?.ready.then(placeInk);

/* ---------------- Contact & 3D ---------------- */
const c = PROPERTY.contact;
$('[data-contact]').innerHTML = [
  ['Agent', c.agent && esc(c.agent)],
  ['Telephone', c.phone && `<a href="tel:${esc(c.phone.replace(/\s/g, ''))}">${esc(c.phone)}</a>`],
  ['Email', c.email && `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>`],
].map(([k, v]) => `<div><dt>${k}</dt><dd>${v || TBC}</dd></div>`).join('');

$('[data-model-status]').textContent = PROPERTY.model.url
  ? 'Orbit an interactive model of the residence.'
  : 'Viewer ready for a real GLB/GLTF model of the house — none has been supplied yet.';

$('[data-to-top]').addEventListener('click', () => scrollToTarget(0, { duration: 2.4 }));

/* ---------------- Enquiry form ---------------- */
const form = $('[data-enquiry]');
const status = $('[data-form-status]');
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  let firstInvalid = null;
  $$('input, textarea', form).forEach((input) => {
    if (input.type === 'radio') return;
    const ok = input.checkValidity();
    input.closest('.field, .check')?.classList.toggle('is-invalid', !ok);
    if (!ok && !firstInvalid) firstInvalid = input;
  });
  status.classList.remove('is-error');
  if (firstInvalid) {
    status.textContent = 'Please complete the highlighted fields.';
    status.classList.add('is-error');
    firstInvalid.focus();
    return;
  }

  const data = Object.fromEntries(new FormData(form));
  data.property = PROPERTY.name;

  if (!PROPERTY.enquiry.endpoint) {
    status.textContent = 'Thank you. Online enquiries are not connected yet — please use the contact details shown.';
    console.info('[enquiry] No endpoint configured (PROPERTY.enquiry.endpoint). Submission:', data);
    return;
  }

  const btn = $('button[type="submit"]', form);
  btn.disabled = true;
  btn.classList.add('is-sending');
  status.textContent = 'Sending…';
  try {
    const res = await fetch(PROPERTY.enquiry.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    form.reset();
    status.textContent = 'Thank you. We will be in touch to arrange your private viewing.';
  } catch (err) {
    status.textContent = 'Sorry, your enquiry could not be sent. Please try again or contact us directly.';
    status.classList.add('is-error');
  } finally {
    btn.disabled = false;
    btn.classList.remove('is-sending');
  }
});
form.addEventListener('input', (e) => e.target.closest('.field, .check')?.classList.remove('is-invalid'));

/* ---------------- Reveal on scroll ---------------- */
$$('[data-reveal]').forEach((el) => {
  const sibs = [...el.parentElement.children].filter((n) => n.hasAttribute('data-reveal'));
  const k = sibs.indexOf(el);
  if (k > 0) el.style.setProperty('--delay', `${Math.min(k, 6) * 0.07}s`);
});
const revealIO = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (!e.isIntersecting) return;
    e.target.classList.add('is-in');
    revealIO.unobserve(e.target);
  });
}, { rootMargin: '0px 0px -12% 0px', threshold: 0.01 });
$$('[data-reveal], [data-split], [data-giant]').forEach((el) => revealIO.observe(el));

/* ---------------- Parallax ---------------- */
const parallaxEls = $$('[data-parallax]').map((el) => ({ el, speed: parseFloat(el.dataset.parallax) || 0.1, on: false }));
const parIO = new IntersectionObserver((entries) => {
  entries.forEach((e) => { const p = parallaxEls.find((x) => x.el === e.target); if (p) p.on = e.isIntersecting; });
}, { rootMargin: '20% 0px' });
parallaxEls.forEach((p) => parIO.observe(p.el));
function updateParallax(vh) {
  if (reducedMotion) return;
  parallaxEls.forEach((p) => {
    if (!p.on) return;
    const r = p.el.parentElement.getBoundingClientRect();
    const off = clamp((r.top + r.height / 2 - vh / 2) / vh, -1.2, 1.2);
    // `translate` composes with any CSS transform (e.g. the mask-reveal scale).
    p.el.style.translate = `0 ${(-off * p.speed * 50).toFixed(2)}%`;
  });
}

/* ---------------- Marquee (reacts to scroll velocity) ---------------- */
const marquee = $('[data-marquee]');
const mTrack = $('[data-marquee-track]');
let mX = 0;
let mDir = -1;
let mVisible = false;
new IntersectionObserver(([e]) => { mVisible = e.isIntersecting; }).observe(marquee);

/* ---------------- Cursor + magnetic buttons ---------------- */
const cursor = $('[data-cursor]');
const cursorLabel = $('[data-cursor-label]');
const cur = { x: -100, y: -100, tx: -100, ty: -100 };
if (finePointer && !reducedMotion) {
  window.addEventListener('pointermove', (e) => {
    cur.tx = e.clientX;
    cur.ty = e.clientY;
    hover.tx = e.clientX;
    hover.ty = e.clientY;
    cursor.classList.add('is-active');
  }, { passive: true });
  document.addEventListener('mouseleave', () => cursor.classList.remove('is-active'));
  document.addEventListener('mouseover', (e) => {
    const t = e.target;
    const interactive = t.closest('a, button, input, textarea, select, label, [role="tab"], .feature-row');
    const labelled = t.closest('[data-cursor-label]');
    const useLabel = labelled && (!interactive || interactive === labelled || !labelled.contains(interactive));
    cursor.classList.toggle('has-label', !!useLabel);
    cursor.classList.toggle('is-hover', !useLabel && !!interactive);
    if (useLabel) cursorLabel.textContent = labelled.dataset.cursorLabel;
  });

  $$('[data-magnetic]').forEach((el) => {
    el.style.transition = `${getComputedStyle(el).transition}, translate 0.45s cubic-bezier(0.22, 1, 0.36, 1)`;
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const dx = (e.clientX - (r.left + r.width / 2)) * 0.28;
      const dy = (e.clientY - (r.top + r.height / 2)) * 0.36;
      el.style.translate = `${dx.toFixed(1)}px ${dy.toFixed(1)}px`;
    });
    el.addEventListener('pointerleave', () => { el.style.translate = ''; });
  });
}

/* ---------------- Single animation loop ---------------- */
let scrollDirty = true;
window.addEventListener('scroll', () => { scrollDirty = true; }, { passive: true });
window.addEventListener('resize', () => { scrollDirty = true; });
let lastT = performance.now();

function loop(t) {
  const dt = Math.min(0.05, Math.max(0, (t - lastT) / 1000));
  lastT = t;
  lenis?.raf(t);

  if (scrollDirty) {
    scrollDirty = false;
    const vh = window.innerHeight;
    updateNav();
    updateFill(vh);
    updateParallax(vh);
  }

  if (mVisible && !reducedMotion) {
    const v = lenis ? lenis.velocity : 0;
    if (Math.abs(v) > 0.5) mDir = v > 0 ? -1 : 1;
    mX += mDir * (60 + Math.min(900, Math.abs(v) * 28)) * dt;
    const half = mTrack.scrollWidth / 2;
    if (half > 0) {
      if (mX <= -half) mX += half;
      if (mX > 0) mX -= half;
    }
    mTrack.style.transform = `translate3d(${mX.toFixed(1)}px, 0, 0)`;
  }

  if (finePointer && !reducedMotion) {
    cur.x += (cur.tx - cur.x) * 0.22;
    cur.y += (cur.ty - cur.y) * 0.22;
    cursor.style.transform = `translate3d(${cur.x.toFixed(1)}px, ${cur.y.toFixed(1)}px, 0)`;
    if (hover.on) {
      hover.x += (hover.tx - hover.x) * 0.14;
      hover.y += (hover.ty - hover.y) * 0.14;
      const rot = clamp((hover.tx - hover.x) * 0.05, -8, 8);
      hoverImg.style.transform = `translate3d(${(hover.x + 24).toFixed(1)}px, ${(hover.y - 120).toFixed(1)}px, 0) rotate(${rot.toFixed(2)}deg)`;
    }
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
