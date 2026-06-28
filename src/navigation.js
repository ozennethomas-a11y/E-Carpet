// Minimal client-side navigation (no router dependency).
// Works with Netlify SPA redirect (/* -> /index.html) and Vite dev fallback.
export function navigate(to) {
  window.history.pushState({}, "", to);
  window.dispatchEvent(new PopStateEvent("popstate"));
  window.scrollTo(0, 0);
}
