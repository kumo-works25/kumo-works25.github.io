(() => {
  const desktopMQ = window.matchMedia('(min-width: 900px)');

  const root = document.documentElement;
  const body = document.body;
  const intro = document.getElementById('s00');
  const hero = document.getElementById('introMedia');
  const heroDim = document.getElementById('introDim');
  const phone = document.getElementById('phone');
  const screen = document.getElementById('phoneScreen');
  const counter = document.getElementById('counter');
  const layers = Array.from(screen.querySelectorAll('.layer'));
  const pages = [intro, ...document.querySelectorAll('.story .sec')];
  const TOTAL = String(pages.length - 1).padStart(2, '0');
  const END = pages.indexOf(document.querySelector('.sec-end'));
  const audio = document.getElementById('sound');
  const audioButtons = Array.from(document.querySelectorAll('[data-audio-toggle]'));

  const HERO_MS = 950;
  const PAGE_MS = 850;

  // 1回のスクロールで進む単位（ステップ）。
  // スマホの画面1枚ごとに1ステップ。06のように画面が2枚あるページは、本文を変えずに画面だけ送る。
  const steps = [{ page: 0, layer: -1 }];
  layers.forEach((layer, i) => steps.push({ page: parseInt(layer.dataset.for.slice(1), 10), layer: i }));
  for (let p = steps[steps.length - 1].page + 1; p < pages.length; p++) steps.push({ page: p, layer: -1 });

  let current = 0;          // 現在のステップ
  let locked = false;
  let heroTimer = null;

  // ---------- 共通：カウンターと動画 ----------
  function updateChrome(page) {
    counter.textContent = page === 0 ? 'KUMO　2025' : `${String(page).padStart(2, '0')} / ${TOTAL}`;
    body.classList.toggle('is-end', page >= END);
    body.classList.toggle('hide-header', page === END);
  }

  function syncVideos(layerIndex) {
    layers.forEach((layer, i) => {
      const v = layer.querySelector('video');
      if (!v) return;
      if (i === layerIndex && phone.classList.contains('ready')) {
        if (v.preload === 'none') v.preload = 'auto';
        v.currentTime = 0;
        v.play().catch(() => {});
      } else {
        v.pause();
      }
    });
  }

  // ---------- スマホの画面：リールのように縦に入れ替える ----------
  function setLayers(to, from) {
    layers.forEach((layer, i) => {
      const moving = i === to || i === from;
      if (!moving) layer.classList.add('no-anim');
      layer.classList.toggle('on', i === to);
      layer.classList.toggle('above', i < to);
      layer.inert = i !== to;
    });
    void screen.offsetWidth;
    layers.forEach(layer => layer.classList.remove('no-anim'));
  }

  // ---------- 00：全景 ⇄ スマホの画面 ----------
  function rectOfScreen() {
    const r = screen.getBoundingClientRect();
    return { left: r.left, top: r.top, width: r.width, height: r.height };
  }
  function placeHero(rect, radius, dim) {
    hero.style.left = rect.left + 'px';
    hero.style.top = rect.top + 'px';
    hero.style.width = rect.width + 'px';
    hero.style.height = rect.height + 'px';
    hero.style.borderRadius = radius + 'px';
    heroDim.style.opacity = String(dim);
  }
  const fullRect = () => ({ left: 0, top: 0, width: window.innerWidth, height: window.innerHeight });

  function shrinkHero(firstLayer) {
    clearTimeout(heroTimer);
    intro.classList.remove('gone');
    hero.classList.add('anim');
    root.classList.add('past-intro');
    phone.style.opacity = '1';
    placeHero(rectOfScreen(), 46, 0);
    heroTimer = setTimeout(() => {
      setLayers(firstLayer, firstLayer);
      phone.classList.add('ready');
      intro.classList.add('gone');
      hero.classList.remove('anim');
      syncVideos(firstLayer);
    }, HERO_MS);
  }

  function expandHero() {
    clearTimeout(heroTimer);
    phone.classList.remove('ready');
    hero.classList.remove('anim');
    placeHero(rectOfScreen(), 46, 0);
    intro.classList.remove('gone');
    void hero.offsetWidth;
    hero.classList.add('anim');
    root.classList.remove('past-intro');
    phone.style.opacity = '0';
    placeHero(fullRect(), 0, 0.42);
    syncVideos(-1);
  }

  // ---------- 本文の入れ替え ----------
  function swapText(prevPage, nextPage, forward) {
    if (prevPage === nextPage) return;
    const out = pages[prevPage], inn = pages[nextPage];
    if (prevPage > 0) {
      out.classList.remove('cur', 'late');
      out.classList.add(forward ? 'leave-up' : 'leave-down');
      out.inert = true;
      setTimeout(() => out.classList.remove('leave-up', 'leave-down'), PAGE_MS);
    }
    if (nextPage > 0) {
      inn.classList.remove('leave-up', 'leave-down');
      inn.classList.add(forward ? 'enter-down' : 'enter-up');
      void inn.offsetWidth;
      inn.classList.remove('enter-down', 'enter-up');
      inn.classList.toggle('late', prevPage === 0);
      inn.classList.add('cur');
      inn.inert = false;
    }
  }

  // ---------- ステップ送り ----------
  function goTo(next) {
    next = Math.max(0, Math.min(steps.length - 1, next));
    if (next === current || locked) return;
    const from = steps[current], to = steps[next];
    const forward = next > current;
    locked = true;

    swapText(from.page, to.page, forward);

    if (from.page === 0) {
      shrinkHero(to.layer >= 0 ? to.layer : 0);
    } else if (to.page === 0) {
      expandHero();
    } else if (to.layer >= 0) {
      setLayers(to.layer, from.layer >= 0 ? from.layer : to.layer);
      syncVideos(to.layer);
    } else {
      syncVideos(-1);
    }

    current = next;
    updateChrome(to.page);
    const hold = (from.page === 0 || to.page === 0) ? Math.max(HERO_MS + 200, PAGE_MS) : PAGE_MS;
    setTimeout(() => { locked = false; }, hold);
  }

  // ---------- 入力：ホイール・キー・タッチ ----------
  let acc = 0, lastWheel = 0, needQuiet = false;
  function onWheel(e) {
    if (!root.classList.contains('paged')) return;
    e.preventDefault();
    const now = performance.now();
    const gap = now - lastWheel;
    lastWheel = now;
    if (locked) { needQuiet = true; acc = 0; return; }
    if (needQuiet) {
      if (gap < 140) return;           // 慣性スクロールの残りは無視
      needQuiet = false;
    }
    if (gap > 250) acc = 0;
    acc += e.deltaY;
    if (Math.abs(acc) > 40) {
      goTo(current + (acc > 0 ? 1 : -1));
      acc = 0;
      needQuiet = true;
    }
  }

  function onKey(e) {
    if (!root.classList.contains('paged')) return;
    if (e.target.closest && e.target.closest('button, input, textarea, select')) {
      if (e.key === ' ' || e.key === 'Enter') return;
    }
    const map = { ArrowDown: 1, PageDown: 1, ' ': 1, ArrowUp: -1, PageUp: -1 };
    if (e.key in map) { e.preventDefault(); goTo(current + (e.shiftKey && e.key === ' ' ? -1 : map[e.key])); }
    else if (e.key === 'Home') { e.preventDefault(); goTo(0); }
    else if (e.key === 'End') { e.preventDefault(); goTo(steps.length - 1); }
  }

  let touchY = null;
  function onTouchStart(e) { if (root.classList.contains('paged')) touchY = e.touches[0].clientY; }
  function onTouchEnd(e) {
    if (touchY === null) return;
    const dy = touchY - e.changedTouches[0].clientY;
    touchY = null;
    if (Math.abs(dy) > 50) goTo(current + (dy > 0 ? 1 : -1));
  }

  // ---------- PC ⇄ スマホの切り替え ----------
  function enablePaged() {
    root.classList.add('paged');
    window.scrollTo(0, 0);
    pages.forEach((p, i) => { if (i > 0) { p.classList.remove('cur', 'late', 'leave-up', 'leave-down'); p.inert = true; } });
    current = 0;
    root.classList.remove('past-intro');
    intro.classList.remove('gone');
    phone.classList.remove('ready');
    phone.style.opacity = '0';
    hero.classList.remove('anim');
    placeHero(fullRect(), 0, 0.42);
    setLayers(0, 0);
    updateChrome(0);
  }

  function disablePaged() {
    root.classList.remove('paged', 'past-intro');
    pages.forEach(p => { p.classList.remove('cur', 'late', 'leave-up', 'leave-down'); p.inert = false; });
    hero.removeAttribute('style');
    heroDim.style.opacity = '';
    phone.style.opacity = '';
    phone.classList.remove('ready');
    body.classList.remove('is-end', 'hide-header');
    syncVideos(-1);
  }

  function applyMode() {
    if (desktopMQ.matches) enablePaged(); else disablePaged();
  }

  window.addEventListener('wheel', onWheel, { passive: false });
  window.addEventListener('keydown', onKey);
  window.addEventListener('touchstart', onTouchStart, { passive: true });
  window.addEventListener('touchend', onTouchEnd, { passive: true });
  window.addEventListener('resize', () => {
    if (!root.classList.contains('paged')) return;
    if (current === 0) placeHero(fullRect(), 0, 0.42);
  });
  desktopMQ.addEventListener('change', applyMode);

  // ---------- スマホ表示：見えている動画だけ再生、見出しの番号も更新 ----------
  const io = new IntersectionObserver(entries => {
    entries.forEach(({ target, isIntersecting }) => {
      if (root.classList.contains('paged')) { target.pause(); return; }
      if (isIntersecting) {
        if (target.preload === 'none') target.preload = 'auto';
        target.play().catch(() => {});
      } else {
        target.pause();
      }
    });
  }, { threshold: 0.35 });
  document.querySelectorAll('.m-media video').forEach(v => io.observe(v));

  const pageIO = new IntersectionObserver(entries => {
    if (root.classList.contains('paged')) return;
    entries.forEach(({ target, isIntersecting }) => {
      if (isIntersecting) updateChrome(pages.indexOf(target));
    });
  }, { rootMargin: '-50% 0px -50% 0px' });
  pages.forEach(p => pageIO.observe(p));

  // ---------- 05：音源の再生 ----------
  function syncAudioButtons() {
    const playing = !audio.paused;
    audioButtons.forEach(b => {
      b.classList.toggle('playing', playing);
      b.setAttribute('aria-label', playing ? '音源を停止' : '音源を再生');
    });
  }
  audioButtons.forEach(b => b.addEventListener('click', () => {
    if (audio.paused) audio.play().catch(() => {});
    else audio.pause();
  }));
  audio.addEventListener('play', syncAudioButtons);
  audio.addEventListener('pause', syncAudioButtons);

  applyMode();
})();
