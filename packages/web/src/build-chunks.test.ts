import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

/**
 * Guards against circular chunk dependencies in the production bundle.
 *
 * The failure this catches is invisible in dev and fatal in prod: Rollup
 * inlines a shared dependency (zustand) into whichever chunk reaches it first,
 * usually the entry. Lazily-loaded chunks then import that binding back *from*
 * the entry. Because the entry statically imports them, they evaluate first —
 * `create` is still undefined, every `create(...)` at module scope throws
 * "is not a function", and the app renders a blank page. Dev never reproduces
 * it (unbundled), and `vite build` exits 0, so nothing else notices.
 *
 * Fixed by the manualChunks rule in vite.config.ts. This test fails if that
 * rule is removed, or if a *different* shared dependency recreates the cycle.
 *
 * Runs against whatever is in dist/ and skips if the app has not been built —
 * it is a release gate, not a unit test.
 */

const here = dirname(fileURLToPath(import.meta.url));
const assetsDir = resolve(here, '../dist/assets');

/** Static (not dynamic) imports of each chunk, as a filename -> deps map. */
function readStaticImportGraph(): Map<string, string[]> {
  const graph = new Map<string, string[]>();
  for (const file of readdirSync(assetsDir)) {
    if (!file.endsWith('.js')) continue;
    const src = readFileSync(resolve(assetsDir, file), 'utf8');
    const deps = new Set<string>();
    // `import ... from "./chunk.js"` and bare `import "./chunk.js"`.
    // import("./chunk.js") is deliberately excluded — dynamic imports are
    // resolved lazily and cannot produce this evaluation-order failure.
    for (const m of src.matchAll(/(?:^|[};\s])import\s*(?:[^'"]*?from\s*)?["'](\.\/[^"']+\.js)["']/g)) {
      deps.add(m[1].replace('./', ''));
    }
    graph.set(file, [...deps]);
  }
  return graph;
}

function findCycle(graph: Map<string, string[]>): string[] | null {
  const WHITE = 0, GREY = 1, BLACK = 2;
  const state = new Map<string, number>();
  const stack: string[] = [];
  let cycle: string[] | null = null;

  function visit(node: string): void {
    if (cycle) return;
    state.set(node, GREY);
    stack.push(node);
    for (const dep of graph.get(node) ?? []) {
      if (!graph.has(dep)) continue;
      const s = state.get(dep) ?? WHITE;
      if (s === GREY) {
        cycle = [...stack.slice(stack.indexOf(dep)), dep];
        return;
      }
      if (s === WHITE) visit(dep);
      if (cycle) return;
    }
    stack.pop();
    state.set(node, BLACK);
  }

  for (const node of graph.keys()) {
    if ((state.get(node) ?? WHITE) === WHITE) visit(node);
    if (cycle) break;
  }
  return cycle;
}

describe('production bundle', () => {
  const built = existsSync(assetsDir);

  it.skipIf(!built)('has no circular static chunk dependencies', () => {
    const graph = readStaticImportGraph();
    expect(graph.size, 'no JS chunks found in dist/assets').toBeGreaterThan(0);

    const cycle = findCycle(graph);
    expect(
      cycle,
      cycle
        ? `Circular chunk dependency: ${cycle.join(' -> ')}\n` +
          'A chunk in this cycle will evaluate before its dependency is ' +
          'initialized and throw "is not a function" at module scope, ' +
          'blanking the app in production. Give the shared dependency its ' +
          'own chunk via manualChunks in vite.config.ts.'
        : '',
    ).toBeNull();
  });

  it.skipIf(!built)('keeps zustand in a leaf chunk', () => {
    // The specific dep that caused the original outage: every store calls
    // create() at module scope, so it must be initialized before any of them.
    const graph = readStaticImportGraph();
    const vendor = [...graph.keys()].find((f) => f.startsWith('vendor-zustand'));
    expect(vendor, 'vendor-zustand chunk missing — manualChunks rule removed?').toBeTruthy();

    const deps = (graph.get(vendor!) ?? []).filter((d) => !d.startsWith('rolldown-runtime'));
    expect(deps, `vendor-zustand must not depend on app chunks, got: ${deps.join(', ')}`).toEqual([]);
  });
});
