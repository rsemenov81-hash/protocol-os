// A single persistent video layer. Never downloads for reduced motion or data saving.
export function startMotion({ video, button, doc = document, win = window, nav = navigator, storage = localStorage }) {
  const reduced = win.matchMedia('(prefers-reduced-motion: reduce)');
  const connection = nav.connection;
  let userPaused = false, blocked = false, failed = false, ready = false, generation = 0;
  try { userPaused = storage.getItem('jamal_motion_paused') === '1'; } catch {}
  const constrained = () => reduced.matches || connection?.saveData || /(^|-)2g$/.test(connection?.effectiveType || '');
  const updateButton = () => {
    button.disabled = !!constrained() || failed;
    button.textContent = constrained() || failed ? 'Motion off' : userPaused || blocked ? 'Play background' : 'Pause background';
    button.setAttribute('aria-label', button.textContent);
    button.setAttribute('aria-pressed', String(userPaused || blocked || !!constrained() || failed));
    button.title = reduced.matches ? 'Reduced motion is enabled on this device' : constrained() ? 'Data saving is enabled' : failed ? 'Still background' : '';
  };
  const sync = async () => {
    const current = ++generation;
    if (!ready || constrained() || userPaused || doc.hidden || failed) {
      video.pause();
      if (constrained() && video.getAttribute('src')) { video.removeAttribute('src'); video.load(); }
      updateButton();
      return;
    }
    if (!video.getAttribute('src')) video.src = new URL('./assets/water-motion.mp4', import.meta.url).href;
    video.muted = true;
    try {
      await video.play();
      if (current === generation) blocked = false;
      if (constrained() || userPaused || doc.hidden || failed) video.pause();
    } catch { if (current === generation) blocked = true; }
    updateButton();
  };
  button.addEventListener('click', () => {
    userPaused = blocked ? false : !userPaused;
    blocked = false;
    try { storage.setItem('jamal_motion_paused', userPaused ? '1' : '0'); } catch {}
    sync();
  });
  doc.addEventListener('visibilitychange', sync);
  reduced.addEventListener('change', sync);
  connection?.addEventListener?.('change', sync);
  video.addEventListener('error', () => { failed = true; video.pause(); updateButton(); });
  const begin = () => { ready = true; sync(); };
  const defer = () => win.requestIdleCallback ? win.requestIdleCallback(begin, { timeout: 2000 }) : win.setTimeout(begin, 600);
  if (doc.readyState === 'complete') defer(); else win.addEventListener('load', defer, { once: true });
  updateButton();
  return { sync };
}

if (typeof document !== 'undefined') {
  const video = document.getElementById('ambient-video'), button = document.getElementById('motion-toggle');
  if (video && button) startMotion({ video, button });
}
