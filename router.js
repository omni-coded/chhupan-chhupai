/** Tiny path router: "/" is the landing page, "/play" and "/join/CODE" are the game. */
export function navigate(to, { replace = false } = {}) {
  history[replace ? 'replaceState' : 'pushState'](null, '', to);
  window.dispatchEvent(new PopStateEvent('popstate'));
  if (!replace) window.scrollTo(0, 0);
}
