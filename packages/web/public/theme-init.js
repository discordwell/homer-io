/*
 * Pre-paint theme resolution.
 *
 * Loaded as a render-blocking same-origin <script> in index.html so the
 * correct palette is stamped on <html> BEFORE first paint — otherwise a
 * light-mode user sees a black flash on every navigation.
 *
 * It cannot be an inline <script>: the CSP in index.html uses
 * `script-src 'self'` with no 'unsafe-inline' and no hash, so an inline
 * block would be blocked by the browser.
 *
 * The resolution logic here is duplicated (deliberately, to stay dependency
 * free) from src/stores/theme.ts. theme.test.ts asserts the two stay in
 * agreement — update both together.
 */
(function () {
  var STORAGE_KEY = 'homer-theme';
  var DEFAULT_MODE = 'dark';

  var mode;
  try {
    mode = window.localStorage.getItem(STORAGE_KEY);
  } catch (err) {
    // Safari private mode / storage blocked by policy — fall back to default.
    mode = null;
  }
  if (mode !== 'light' && mode !== 'dark' && mode !== 'system') mode = DEFAULT_MODE;

  var resolved = mode;
  if (mode === 'system') {
    // No matchMedia (very old browser, or a non-DOM embedding) resolves to
    // DARK, matching prefersDark() in the store. Collapsing this into the
    // `&&` above would fall through to 'light' and diverge from it.
    if (typeof window.matchMedia !== 'function') {
      resolved = 'dark';
    } else {
      resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
  }

  document.documentElement.setAttribute('data-theme', resolved);
  document.documentElement.style.colorScheme = resolved;

  // Keep mobile browser chrome / PWA shell from flashing the wrong color.
  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', resolved === 'light' ? '#FFFFFF' : '#06090F');
})();
