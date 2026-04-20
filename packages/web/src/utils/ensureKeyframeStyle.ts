/**
 * Idempotently injects a <style> tag with the given id and CSS content into
 * document.head. Safe to call from a component useEffect under HMR, strict
 * mode double-mounts, or multiple component instances — the id check prevents
 * duplicate tags.
 *
 * Safe for SSR: no-ops when `document` is undefined.
 */
export function ensureKeyframeStyle(id: string, css: string): void {
  if (typeof document === 'undefined') return;
  // Re-use an existing tag if the id is already present.
  if (document.getElementById(id)) return;
  const style = document.createElement('style');
  style.id = id;
  style.textContent = css;
  document.head.appendChild(style);
}

/** Testing helper: returns the count of <style> tags with the given id. */
export function countStyleTagsWithId(id: string): number {
  if (typeof document === 'undefined') return 0;
  return document.querySelectorAll(`style#${CSS.escape(id)}`).length;
}
