/**
 * ScrollTour — maps the scroll position of a tall section to video.currentTime.
 *
 * Design:
 *  - Reacts to native scroll events (which Lenis smooth-scroll also emits) with a
 *    single requestAnimationFrame loop that only runs while something is changing.
 *  - Scroll progress → per-scene piecewise-linear time map (see SCENES in config).
 *  - The displayed time eases toward the target (time-based exponential smoothing),
 *    and a new seek is only issued once the previous one has completed, so the
 *    decoder is never flooded and the frame always catches up with the scroll.
 *  - The video is fetched once into a Blob so seeks hit memory, not the network.
 *  - Until the film is ready (or if it fails / reduced motion is requested) the
 *    tour shows per-scene stills, so scrolling is never blocked.
 *  - Scroll-linked visuals (word reveals, frame expansion) are driven by CSS custom
 *    properties; JS writes a value only when it changes.
 */
import { still } from './config.js';

const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const smooth = (e0, e1, x) => {
  const t = clamp((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
const pad = (n) => String(n).padStart(2, '0');
const r3 = (v) => Math.round(v * 1000) / 1000;

export class ScrollTour {
  constructor({ root, scenes, media, lengthVh, reducedMotion = false, onProgress, onReady }) {
    this.root = root;
    this.scenes = scenes;
    this.media = media;
    this.lengthVh = lengthVh;
    this.reducedMotion = reducedMotion;
    this.onProgress = onProgress || (() => {});
    this.onReady = onReady || (() => {});
    this.scroller = null; // optional smooth-scroll instance with scrollTo(y, opts)

    this.video = root.querySelector('[data-video]');
    this.sticky = root.querySelector('.tour__sticky');
    this.stillsEl = root.querySelector('[data-stills]');
    this.finalEl = root.querySelector('[data-final]');
    this.captionsEl = root.querySelector('[data-captions]');
    this.navEl = root.querySelector('[data-scene-nav]');
    this.labelEl = root.querySelector('[data-scene-label]');
    this.progressEl = root.querySelector('[data-progress]');
    this.cueEl = root.querySelector('[data-cue]');
    this.timeEl = root.querySelector('[data-timecode]');
    this.numberEl = root.querySelector('[data-scene-number]');

    this.top = 0;
    this.scrollable = 1;
    this.progress = 0;
    this.targetTime = 0;
    this.shownTime = 0;
    this.maxTime = media.duration;
    this.activeIndex = -1;
    this.videoReady = false;
    this.mode = 'stills'; // 'stills' until the film is ready, then 'video'
    this.rafId = 0;
    this.lastFrame = 0;
    this.cache = new WeakMap(); // last written values per element
    this.listeners = [];
    this.objectUrl = null;
    this.abort = new AbortController();

    this.tick = this.tick.bind(this);
    this.requestTick = this.requestTick.bind(this);
    this.measure = this.measure.bind(this);
  }

  /* ---------------- setup ---------------- */

  init() {
    this.renderCaptions();
    this.renderNav();
    this.renderStills();
    this.finalEl.src = this.stillSrc(this.media.finalStill);
    this.applyLength();
    this.measure();

    this.on(window, 'scroll', this.requestTick, { passive: true });
    this.on(window, 'resize', () => { this.applyLength(); this.measure(); this.requestTick(); });
    if ('ResizeObserver' in window) {
      this.ro = new ResizeObserver(() => { this.measure(); this.requestTick(); });
      this.ro.observe(document.body);
    }

    if (this.reducedMotion) {
      this.onProgress(1);
      this.onReady(false);
    } else {
      this.loadVideo();
    }
    this.requestTick();
    return this;
  }

  destroy() {
    cancelAnimationFrame(this.rafId);
    this.listeners.forEach(([t, e, f, o]) => t.removeEventListener(e, f, o));
    this.ro?.disconnect();
    this.abort.abort();
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
  }

  on(target, event, fn, opts) {
    target.addEventListener(event, fn, opts);
    this.listeners.push([target, event, fn, opts]);
  }

  applyLength() {
    const mobile = window.matchMedia('(max-width: 760px)').matches;
    const vh = mobile ? this.lengthVh.mobile : this.lengthVh.desktop;
    // Use px based on the large viewport so mobile URL-bar changes don't resize the track.
    const h = Math.round((vh / 100) * Math.max(window.innerHeight, this.sticky.clientHeight));
    if (this._len !== h) {
      this._len = h;
      this.root.style.height = `${h}px`;
    }
  }

  measure() {
    const rect = this.root.getBoundingClientRect();
    this.top = rect.top + window.scrollY;
    this.scrollable = Math.max(1, this.root.offsetHeight - this.sticky.clientHeight);
  }

  /* ---------------- rendering ---------------- */

  renderCaptions() {
    const total = this.scenes.length;
    const words = (text, offset = 0) => text.split(' ').map((w, k) =>
      `<span class="w"><span style="--i:${k + offset}">${w}</span></span>`).join(' ');

    this.captions = this.scenes.map((s, i) => {
      const el = document.createElement('div');
      el.className = `caption${s.finalStill ? ' caption--final' : ''}`;
      el.setAttribute('aria-hidden', 'true');
      el.inert = true;
      const Heading = i === 0 ? 'h1' : 'h2';
      const titleWords = s.title.split(' ').length;
      el.innerHTML = `
        <p class="caption__kicker"><span class="caption__count">${pad(i + 1)} / ${pad(total)}</span><span class="caption__name">${s.kicker}</span></p>
        <${Heading} class="caption__title" aria-label="${s.title}">${words(s.title)}</${Heading}>
        <p class="caption__subtitle" style="--i:${titleWords + 1}">${s.subtitle}</p>
        ${s.cta ? `<a class="btn btn--accent caption__cta" href="#enquire" data-magnetic style="--i:${titleWords + 2}"><span>${s.cta}</span><i aria-hidden="true">&rarr;</i></a>` : ''}`;
      this.captionsEl.appendChild(el);
      return el;
    });
  }

  renderNav() {
    const ol = document.createElement('ol');
    this.navButtons = this.scenes.map((s, i) => {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button';
      b.innerHTML = `<span class="scene-nav__text">${s.label}</span><span class="scene-nav__dot" aria-hidden="true"></span>`;
      b.setAttribute('aria-label', `Go to scene ${i + 1}: ${s.label}`);
      b.addEventListener('click', () => this.goTo(i));
      li.appendChild(b);
      ol.appendChild(li);
      return b;
    });
    this.navEl.appendChild(ol);
  }

  renderStills() {
    this.stills = this.scenes.map((s) => {
      const img = document.createElement('img');
      img.alt = '';
      img.decoding = 'async';
      img.dataset.src = this.stillSrc(s.still);
      this.stillsEl.appendChild(img);
      return img;
    });
  }

  stillSrc(name) {
    return still(name, window.matchMedia('(max-width: 760px)').matches ? 'md' : '');
  }

  /* ---------------- navigation ---------------- */

  /** Scroll position (px) at which scene `i` is fully legible. */
  scrollFor(i) {
    if (i <= 0) return this.top;
    const [s0, s1] = this.scenes[i].scroll;
    const at = this.scenes[i].finalStill ? s0 + (s1 - s0) * 0.6 : s0 + (s1 - s0) * 0.42;
    return this.top + at * this.scrollable;
  }

  goTo(i) {
    this.measure();
    const y = Math.round(this.scrollFor(i));
    if (this.scroller && !this.reducedMotion) this.scroller.scrollTo(y, { duration: 1.8 });
    else window.scrollTo({ top: y, behavior: this.reducedMotion ? 'auto' : 'smooth' });
  }

  /* ---------------- time mapping ---------------- */

  sceneIndexAt(p) {
    for (let i = this.scenes.length - 1; i >= 0; i--) {
      if (p >= this.scenes[i].scroll[0]) return i;
    }
    return 0;
  }

  timeAt(p, i) {
    const s = this.scenes[i];
    const local = clamp((p - s.scroll[0]) / (s.scroll[1] - s.scroll[0]));
    return Math.min(this.maxTime, s.time[0] + local * (s.time[1] - s.time[0]));
  }

  /* ---------------- video loading ---------------- */

  pickSource() {
    const conn = navigator.connection;
    const saveData = conn && (conn.saveData || /2g/.test(conn.effectiveType || ''));
    const list = this.media.sources;
    if (saveData || window.innerWidth < 900) return list[list.length - 1].src;
    return list[0].src;
  }

  async loadVideo() {
    const src = this.pickSource();
    const v = this.video;
    v.muted = true;
    v.playsInline = true;

    const onReady = () => {
      if (this.videoReady) return;
      if (Number.isFinite(v.duration) && v.duration > 0) {
        this.maxTime = Math.min(this.media.duration, v.duration - 0.04);
      }
      this.videoReady = true;
      this.mode = 'video';
      this.shownTime = this.targetTime;
      v.currentTime = this.shownTime;
      // iOS Safari only paints seeked frames after the element has played once.
      const p = v.play();
      if (p && p.then) p.then(() => v.pause()).catch(() => {});
      else v.pause();
      this.root.classList.add('is-video-ready');
      this.onProgress(1);
      this.onReady(true);
      this.requestTick();
    };
    v.addEventListener('loadeddata', onReady, { once: true });
    v.addEventListener('error', () => this.fail(), { once: true });
    // Seeks complete asynchronously: re-run the loop so the next seek can be issued.
    this.on(v, 'seeked', this.requestTick);

    // Preferred path: fetch into memory for instant seeking. Falls back to a
    // direct src (e.g. file:// where fetch is blocked) with preload="auto".
    try {
      if (location.protocol === 'file:' || !window.fetch || !window.ReadableStream) throw new Error('no fetch');
      const res = await fetch(src, { signal: this.abort.signal });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
      const total = Number(res.headers.get('content-length')) || 0;
      const reader = res.body.getReader();
      const chunks = [];
      let received = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.length;
        if (total) this.onProgress(Math.min(0.99, received / total));
      }
      this.objectUrl = URL.createObjectURL(new Blob(chunks, { type: 'video/mp4' }));
      v.preload = 'auto';
      v.src = this.objectUrl;
      v.load();
    } catch (err) {
      if (err.name === 'AbortError') return;
      v.preload = 'auto';
      v.src = src;
      v.load();
    }
  }

  fail() {
    this.mode = 'stills';
    this.videoReady = false;
    this.root.classList.remove('is-video-ready');
    console.warn('[tour] Video failed to load; using still frames instead.');
    this.onProgress(1);
    this.onReady(false);
    this.requestTick();
  }

  /* ---------------- loop ---------------- */

  requestTick() {
    if (!this.rafId) this.rafId = requestAnimationFrame(this.tick);
  }

  tick(now) {
    this.rafId = 0;
    // rAF timestamps can precede performance.now(); clamp so dt is always sane.
    const raw = this.lastFrame ? (now - this.lastFrame) / 1000 : 1 / 60;
    const dt = Math.min(0.1, Math.max(1 / 240, Number.isFinite(raw) ? raw : 1 / 60));
    this.lastFrame = now;

    const p = clamp((window.scrollY - this.top) / this.scrollable);
    this.progress = p;
    const index = this.sceneIndexAt(p);
    this.targetTime = this.timeAt(p, index);

    // Ease toward the target. When a smooth scroller is active the scroll is
    // already eased, so use a faster rate to avoid compounding lag.
    const rate = this.scroller ? 28 : 16;
    const diff = this.targetTime - this.shownTime;
    if (this.reducedMotion || Math.abs(diff) < 0.002) this.shownTime = this.targetTime;
    else this.shownTime += diff * (1 - Math.exp(-rate * dt));
    if (!Number.isFinite(this.shownTime)) this.shownTime = this.targetTime;

    let pending = this.shownTime !== this.targetTime;
    if (!pending) this.lastFrame = 0; // loop is about to idle; next run starts fresh

    if (this.mode === 'video') {
      const v = this.video;
      if (v.seeking) {
        pending = true; // 'seeked' will wake us
      } else if (Math.abs(v.currentTime - this.shownTime) > 1 / 60) {
        v.currentTime = this.shownTime;
      }
    }

    this.updateUI(p, index);
    if (pending) this.requestTick();
  }

  write(el, key, value) {
    let c = this.cache.get(el);
    if (!c) this.cache.set(el, (c = {}));
    if (c[key] === value) return false;
    c[key] = value;
    return true;
  }

  updateUI(p, index) {
    // Captions: only the active scene can be visible; fades never overlap.
    // --p drives the word-by-word mask reveal in CSS.
    this.scenes.forEach((s, i) => {
      const el = this.captions[i];
      let o = 0;
      if (i === index) {
        const local = clamp((p - s.scroll[0]) / (s.scroll[1] - s.scroll[0]));
        const fadeIn = i === 0 ? 1 : smooth(0.04, 0.26, local);
        const fadeOut = i === this.scenes.length - 1 ? 1 : 1 - smooth(0.7, 0.92, local);
        o = Math.min(fadeIn, fadeOut);
        if (i === 0) o = Math.min(o, 1 - smooth(0.42, 0.8, local)); // arrival text leaves before the door
      }
      o = r3(o);
      if (this.write(el, 'o', o)) {
        el.style.opacity = this.reducedMotion ? o : Math.min(1, o * 1.6).toFixed(3);
        el.style.setProperty('--p', this.reducedMotion ? 1 : o);
        const visible = o > 0.01;
        if (this.write(el, 'v', visible)) {
          el.classList.toggle('is-visible', visible);
          el.inert = o < 0.5;
          el.setAttribute('aria-hidden', String(o < 0.5));
        }
      }
    });

    // Opening frame: the film starts framed and expands to full-bleed.
    const frame = this.reducedMotion ? 1 : r3(smooth(0, 0.045, p));
    if (this.write(this.sticky, 'frame', frame)) this.sticky.style.setProperty('--frame', frame);

    // Final reveal: cross-fade from the balcony to the opening exterior (same house).
    const last = this.scenes[this.scenes.length - 1];
    const f = r3(smooth(last.scroll[0], last.scroll[0] + (last.scroll[1] - last.scroll[0]) * 0.4, p));
    if (this.write(this.finalEl, 'o', f)) this.finalEl.style.opacity = f;

    // Stills (loading / fallback / reduced motion).
    if (this.mode === 'stills') this.showStill(index);

    // Progress bar.
    if (this.write(this.progressEl, 's', r3(p))) this.progressEl.style.transform = `scaleX(${r3(p)})`;

    // Timecode (tenths of a second).
    if (this.timeEl) {
      const t = Math.round(this.shownTime * 10) / 10;
      if (this.write(this.timeEl, 't', t)) {
        this.timeEl.textContent = `00:${pad(Math.floor(t))}.${Math.round((t % 1) * 10)}`;
      }
    }

    // Scroll cue.
    const hideCue = p > 0.012;
    if (this.write(this.cueEl, 'h', hideCue)) this.cueEl.classList.toggle('is-hidden', hideCue);

    // Active scene: label + nav + big number.
    if (index !== this.activeIndex) this.setActive(index);
  }

  showStill(index) {
    if (this._still === index) return;
    this._still = index;
    this.stills.forEach((img, i) => {
      // Lazy: load the current still and its neighbours only.
      if (Math.abs(i - index) <= 1 && !img.src) img.src = img.dataset.src;
      img.classList.toggle('is-active', i === index);
    });
  }

  setActive(index) {
    const first = this.activeIndex === -1;
    const dir = index > this.activeIndex ? 1 : -1;
    this.activeIndex = index;
    const s = this.scenes[index];
    this.navButtons.forEach((b, i) => {
      if (i === index) b.setAttribute('aria-current', 'step');
      else b.removeAttribute('aria-current');
    });
    this.root.style.setProperty('--scene-progress', index / (this.scenes.length - 1));

    const apply = () => {
      this.labelEl.querySelector('.scene-label__name').textContent = s.label;
      this.labelEl.querySelector('.scene-label__count').textContent = `${pad(index + 1)} / ${pad(this.scenes.length)}`;
      this.labelEl.classList.remove('is-changing');
    };
    if (this.numberEl) {
      // Rolling scene number: slide the old digit out, the new one in.
      const next = document.createElement('span');
      next.textContent = pad(index + 1);
      if (!first && !this.reducedMotion) {
        next.className = dir > 0 ? 'from-below' : 'from-above';
        const old = this.numberEl.querySelector('span:not(.is-leaving)');
        if (old) {
          old.className = `is-leaving ${dir > 0 ? 'to-above' : 'to-below'}`;
          setTimeout(() => old.remove(), 700);
        }
        this.numberEl.appendChild(next);
        requestAnimationFrame(() => requestAnimationFrame(() => { next.className = ''; }));
      } else {
        this.numberEl.replaceChildren(next);
      }
    }
    if (first || this.reducedMotion) apply();
    else {
      this.labelEl.classList.add('is-changing');
      clearTimeout(this._labelTimer);
      this._labelTimer = setTimeout(apply, 220);
    }
    this.root.dispatchEvent(new CustomEvent('scenechange', { detail: { index, scene: s } }));
  }
}
