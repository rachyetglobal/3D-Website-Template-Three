/**
 * Carousels.
 *  - Rail: native horizontal scroller (touch momentum, scroll-snap, keyboard) with
 *    mouse drag + inertia, arrow buttons, progress bar and in-card parallax.
 *  - Slideshow: crossfading/wiping gallery with autoplay timer, thumbnails,
 *    swipe, keyboard and pause on hover / focus / off-screen.
 */

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const pad = (n) => String(n).padStart(2, '0');
const ICON_PLAY = '<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M3 1.5v11l9-5.5z" fill="currentColor"/></svg>';
const ICON_PAUSE = '<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M3 1.5h3v11H3zM8 1.5h3v11H8z" fill="currentColor"/></svg>';

export class Rail {
  constructor({ rail, prev, next, progress, indexEl, playBtn, autoplay = 3500, reducedMotion = false }) {
    this.playBtn = playBtn;
    this.autoplay = autoplay;
    // Auto-rotate pauses for: the user's choice, hover, keyboard focus, recent
    // interaction, off-screen and background tabs. Off for reduced motion.
    this.auto = { user: reducedMotion, hover: false, focus: false, holdUntil: 0 };
    this.rail = rail;
    this.track = rail.firstElementChild;
    this.prev = prev;
    this.next = next;
    this.progress = progress;
    this.indexEl = indexEl;
    this.reducedMotion = reducedMotion;
    this.index = 0;
    this.raf = 0;
    this.justDragged = false;
    this.update = this.update.bind(this);
  }

  init() {
    this.cards = [...this.track.children];
    this.imgs = this.cards.map((c) => c.querySelector('img'));
    this.rail.addEventListener('scroll', () => this.schedule(), { passive: true });
    window.addEventListener('resize', () => this.schedule());
    this.prev?.addEventListener('click', () => { this.hold(); this.goTo(this.index - 1); });
    this.next?.addEventListener('click', () => { this.hold(); this.goTo(this.index + 1); });
    this.initAutoplay();
    this.rail.addEventListener('keydown', (e) => {
      if (e.target !== this.rail) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); this.goTo(this.index + 1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); this.goTo(this.index - 1); }
    });
    this.initDrag();
    // Parallax only needs updating while the rail is on screen.
    new IntersectionObserver(([e]) => { this.visible = e.isIntersecting; if (this.visible) this.schedule(); }).observe(this.rail);
    this.update();
    return this;
  }

  initAutoplay() {
    const a = this.auto;
    const rail = this.rail;
    rail.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') { a.hover = true; this.syncPlay(); } });
    rail.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') { a.hover = false; this.hold(1500); this.syncPlay(); } });
    rail.addEventListener('pointerdown', () => this.hold(6000));
    rail.addEventListener('wheel', (e) => { if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) this.hold(6000); }, { passive: true });
    // Only keyboard focus pauses; a mouse click that focuses the rail shouldn't stop it for good.
    rail.addEventListener('focusin', (e) => { a.focus = e.target.matches(':focus-visible'); this.syncPlay(); });
    rail.addEventListener('focusout', (e) => { if (!rail.contains(e.relatedTarget)) { a.focus = false; this.syncPlay(); } });
    this.playBtn?.addEventListener('click', () => { a.user = !a.user; this.hold(800); this.syncPlay(); });
    this.syncPlay();
    if (this.autoplay) {
      setInterval(() => {
        if (!this.canAdvance()) return;
        const max = this.rail.scrollWidth - this.rail.clientWidth;
        // Loop back to the first room after the last one.
        this.goTo(this.rail.scrollLeft >= max - 4 ? 0 : this.index + 1);
      }, this.autoplay);
    }
  }

  canAdvance() {
    const a = this.auto;
    return !a.user && !a.hover && !a.focus && this.visible && !document.hidden
      && performance.now() > a.holdUntil && !this.rail.classList.contains('is-dragging');
  }

  hold(ms = 5000) {
    this.auto.holdUntil = performance.now() + ms;
  }

  syncPlay() {
    if (!this.playBtn) return;
    const on = !this.auto.user;
    this.playBtn.innerHTML = on ? ICON_PAUSE : ICON_PLAY;
    this.playBtn.setAttribute('aria-label', on ? 'Pause auto-rotate' : 'Play auto-rotate');
    this.rail.closest('section')?.classList.toggle('is-autoplay', on && !this.auto.hover && !this.auto.focus);
  }

  padLeft() { return parseFloat(getComputedStyle(this.track).paddingLeft) || 0; }

  offsetFor(i) {
    const card = this.cards[clamp(i, 0, this.cards.length - 1)];
    const rr = this.rail.getBoundingClientRect();
    return this.rail.scrollLeft + (card.getBoundingClientRect().left - rr.left) - this.padLeft();
  }

  goTo(i) {
    const left = clamp(this.offsetFor(i), 0, this.rail.scrollWidth - this.rail.clientWidth);
    this.rail.scrollTo({ left, behavior: this.reducedMotion ? 'auto' : 'smooth' });
  }

  nearest() {
    const rr = this.rail.getBoundingClientRect();
    const pl = this.padLeft();
    let best = 0;
    let bestD = Infinity;
    this.cards.forEach((c, i) => {
      const d = Math.abs(c.getBoundingClientRect().left - rr.left - pl);
      if (d < bestD) { bestD = d; best = i; }
    });
    // At the far end the last cards can't reach the snap edge.
    if (this.rail.scrollLeft >= this.rail.scrollWidth - this.rail.clientWidth - 4) best = this.cards.length - 1;
    return best;
  }

  schedule() {
    if (!this.raf) this.raf = requestAnimationFrame(this.update);
  }

  update() {
    this.raf = 0;
    const max = Math.max(1, this.rail.scrollWidth - this.rail.clientWidth);
    const p = clamp(this.rail.scrollLeft / max, 0, 1);
    this.progress.style.transform = `scaleX(${Math.max(0.04, p).toFixed(3)})`;

    const i = this.nearest();
    if (i !== this.index || !this._init) {
      this._init = true;
      this.index = i;
      if (this.indexEl) this.indexEl.textContent = pad(i + 1);
    }
    if (this.prev) this.prev.disabled = this.rail.scrollLeft <= 2;
    if (this.next) this.next.disabled = this.rail.scrollLeft >= max - 2;

    if (!this.reducedMotion && this.visible !== false) {
      const rr = this.rail.getBoundingClientRect();
      const mid = rr.left + rr.width / 2;
      this.cards.forEach((c, k) => {
        const r = c.getBoundingClientRect();
        if (r.right < rr.left - 100 || r.left > rr.right + 100) return;
        const off = clamp((r.left + r.width / 2 - mid) / rr.width, -1, 1);
        this.imgs[k].style.transform = `translate3d(${(off * -9).toFixed(2)}%, 0, 0)`;
      });
    }
  }

  initDrag() {
    const rail = this.rail;
    let startX = 0, startLeft = 0, lastX = 0, lastT = 0, vel = 0, down = false, dragging = false, inertia = 0;

    const onMove = (e) => {
      if (!down) return;
      const dx = e.clientX - startX;
      if (!dragging && Math.abs(dx) > 5) { dragging = true; rail.classList.add('is-dragging'); }
      if (!dragging) return;
      rail.scrollLeft = startLeft - dx;
      const now = performance.now();
      const dt = Math.max(1, now - lastT);
      vel = 0.8 * ((e.clientX - lastX) / dt) + 0.2 * vel; // px/ms, smoothed
      lastX = e.clientX;
      lastT = now;
    };
    const onUp = () => {
      if (!down) return;
      down = false;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      if (!dragging) return;
      this.justDragged = true;
      setTimeout(() => { this.justDragged = false; }, 50);
      // Inertia, then settle on the nearest card.
      let v = -vel * 16;
      const step = () => {
        if (Math.abs(v) > 0.6 && !this.reducedMotion) {
          rail.scrollLeft += v;
          v *= 0.93;
          inertia = requestAnimationFrame(step);
        } else {
          this.goTo(this.nearest());
          setTimeout(() => rail.classList.remove('is-dragging'), 450);
        }
      };
      step();
    };

    rail.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      cancelAnimationFrame(inertia);
      down = true;
      dragging = false;
      startX = lastX = e.clientX;
      startLeft = rail.scrollLeft;
      lastT = performance.now();
      vel = 0;
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    });
    // A drag must not trigger the card's button.
    rail.addEventListener('click', (e) => {
      if (this.justDragged) { e.preventDefault(); e.stopPropagation(); }
    }, true);
    rail.addEventListener('dragstart', (e) => e.preventDefault());
  }
}

export class Slideshow {
  constructor({ root, items, src, srcset, onOpen, interval = 6000, reducedMotion = false }) {
    this.root = root;
    this.items = items;
    this.src = src;
    this.srcset = srcset;
    this.onOpen = onOpen || (() => {});
    this.interval = interval;
    this.reducedMotion = reducedMotion;
    this.current = 0;
    this.state = { user: reducedMotion, hover: false, focus: false, visible: false, hidden: false };
  }

  init() {
    const q = (s) => this.root.querySelector(s);
    this.stage = q('[data-show-stage]');
    this.thumbs = q('[data-show-thumbs]');
    this.timer = q('[data-show-timer]');
    this.indexEl = q('[data-show-index]');
    this.captionEl = q('[data-show-caption]');
    this.roomEl = q('[data-show-room]');
    this.captionWrap = q('.show__caption');
    this.playBtn = q('[data-show-play]');

    this.slides = this.items.map((it, i) => {
      const fig = document.createElement('figure');
      fig.className = `show__slide${i === 0 ? ' is-active' : ''}`;
      const img = document.createElement('img');
      img.alt = it.caption;
      img.decoding = 'async';
      img.sizes = '(max-width: 760px) 100vw, 1360px';
      img.dataset.src = this.src(it.file);
      img.dataset.srcset = this.srcset(it.file);
      fig.appendChild(img);
      this.stage.appendChild(fig);
      return fig;
    });
    this.load(0);
    this.load(1);

    this.thumbBtns = this.items.map((it, i) => {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('aria-label', `Show ${it.caption}`);
      b.innerHTML = `<img src="${this.src(it.file, 'sm')}" alt="" loading="lazy" decoding="async">`;
      b.addEventListener('click', () => this.go(i));
      li.appendChild(b);
      this.thumbs.appendChild(li);
      return b;
    });

    q('[data-show-prev]').addEventListener('click', () => this.go(this.current - 1, -1));
    q('[data-show-next]').addEventListener('click', () => this.go(this.current + 1, 1));
    q('[data-show-full]').addEventListener('click', () => this.onOpen(this.current));
    this.playBtn.addEventListener('click', () => { this.state.user = !this.state.user; this.sync(); });

    this.root.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') { e.preventDefault(); this.go(this.current + 1, 1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); this.go(this.current - 1, -1); }
    });
    this.stage.addEventListener('mouseenter', () => { this.state.hover = true; this.sync(); });
    this.stage.addEventListener('mouseleave', () => { this.state.hover = false; this.sync(); });
    this.root.addEventListener('focusin', () => { this.state.focus = true; this.sync(); });
    this.root.addEventListener('focusout', (e) => { if (!this.root.contains(e.relatedTarget)) { this.state.focus = false; this.sync(); } });
    document.addEventListener('visibilitychange', () => { this.state.hidden = document.hidden; this.sync(); });
    new IntersectionObserver(([e]) => { this.state.visible = e.isIntersecting; this.sync(); }, { threshold: 0.35 }).observe(this.stage);

    // Swipe / click.
    let sx = 0, sy = 0, down = false;
    this.stage.addEventListener('pointerdown', (e) => { down = true; sx = e.clientX; sy = e.clientY; });
    this.stage.addEventListener('pointerup', (e) => {
      if (!down) return;
      down = false;
      const dx = e.clientX - sx;
      const dy = e.clientY - sy;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) this.go(this.current + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
      else if (Math.abs(dx) < 8 && Math.abs(dy) < 8) this.onOpen(this.current);
    });
    this.stage.addEventListener('pointercancel', () => { down = false; });

    this.timer.style.setProperty('--dur', `${this.interval}ms`);
    this.timer.addEventListener('animationend', () => this.go(this.current + 1, 1));
    this.setCaption(0, true);
    this.thumbBtns[0].setAttribute('aria-current', 'true');
    this.sync();
    return this;
  }

  load(i) {
    const img = this.slides[(i + this.slides.length) % this.slides.length].querySelector('img');
    if (!img.src) { img.srcset = img.dataset.srcset; img.src = img.dataset.src; }
  }

  go(i, dir) {
    const n = this.slides.length;
    const to = (i + n) % n;
    if (to === this.current) return;
    const d = dir || (to > this.current ? 1 : -1);
    const from = this.current;
    this.current = to;
    this.load(to);
    this.load(to + 1);
    this.load(to - 1);

    this.slides.forEach((s, k) => { if (k !== from && k !== to) s.className = 'show__slide'; });
    this.slides[from].className = 'show__slide is-prev';
    const next = this.slides[to];
    next.className = 'show__slide';
    void next.offsetWidth; // restart animations
    next.className = `show__slide is-active${this.reducedMotion ? '' : d > 0 ? ' enter-next' : ' enter-prev'}`;
    clearTimeout(this._cleanup);
    this._cleanup = setTimeout(() => {
      this.slides[from].className = 'show__slide';
      next.classList.remove('enter-next', 'enter-prev');
    }, 1200);

    this.thumbBtns.forEach((b, k) => b.setAttribute('aria-current', String(k === to)));
    const tb = this.thumbBtns[to];
    const tr = this.thumbs.getBoundingClientRect();
    const br = tb.getBoundingClientRect();
    this.thumbs.scrollTo({ left: this.thumbs.scrollLeft + (br.left - tr.left) - tr.width / 2 + br.width / 2, behavior: 'smooth' });
    this.setCaption(to);
    this.restartTimer();
  }

  setCaption(i, instant) {
    const it = this.items[i];
    const apply = () => {
      this.indexEl.textContent = pad(i + 1);
      this.captionEl.textContent = it.caption;
      this.roomEl.textContent = `${it.room} · ${pad(i + 1)} / ${pad(this.items.length)}`;
      this.captionWrap.classList.remove('is-changing');
    };
    if (instant || this.reducedMotion) return apply();
    this.captionWrap.classList.add('is-changing');
    clearTimeout(this._capT);
    this._capT = setTimeout(apply, 280);
  }

  restartTimer() {
    this.timer.classList.remove('is-running');
    if (this.paused) return;
    void this.timer.offsetWidth;
    this.timer.classList.add('is-running');
  }

  sync() {
    const s = this.state;
    const paused = s.user || s.hover || s.focus || !s.visible || s.hidden;
    const was = this.paused;
    this.paused = paused;
    this.root.classList.toggle('is-paused', paused);
    this.playBtn.innerHTML = s.user
      ? '<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M3 1.5v11l9-5.5z" fill="currentColor"/></svg>'
      : '<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M3 1.5h3v11H3zM8 1.5h3v11H8z" fill="currentColor"/></svg>';
    this.playBtn.setAttribute('aria-label', s.user ? 'Play slideshow' : 'Pause slideshow');
    if (!paused && (was || !this.timer.classList.contains('is-running'))) {
      // Resume where it left off if the animation exists, else start fresh.
      if (!this.timer.classList.contains('is-running')) this.restartTimer();
    }
  }
}
