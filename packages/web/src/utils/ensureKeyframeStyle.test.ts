import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ensureKeyframeStyle, countStyleTagsWithId } from './ensureKeyframeStyle.js';

/**
 * We don't have jsdom/happy-dom as a test dep, so we stub the minimum DOM
 * surface these helpers touch: document.getElementById, document.head,
 * document.createElement, document.querySelectorAll, and CSS.escape.
 */

interface FakeStyleNode {
  id: string;
  tagName: string;
  textContent: string;
}

function installFakeDom() {
  const nodes = new Map<string, FakeStyleNode>();

  const doc = {
    getElementById(id: string) {
      return nodes.get(id) ?? null;
    },
    createElement(tag: string) {
      return {
        id: '',
        tagName: tag.toUpperCase(),
        textContent: '',
      } as FakeStyleNode;
    },
    head: {
      appendChild(node: FakeStyleNode) {
        nodes.set(node.id, node);
        return node;
      },
    },
    querySelectorAll(selector: string) {
      // We only care about selectors of the form `style#<id>`
      const m = selector.match(/^style#(.+)$/);
      if (!m) return [];
      const id = m[1];
      const node = nodes.get(id);
      return node && node.tagName === 'STYLE' ? [node] : [];
    },
  };

  const fakeCss = {
    escape(s: string) {
      // Naive — tests use simple ids, no special chars needed.
      return s.replace(/[^a-zA-Z0-9_-]/g, '\\$&');
    },
  };

  vi.stubGlobal('document', doc);
  vi.stubGlobal('CSS', fakeCss);
  return { nodes };
}

describe('ensureKeyframeStyle', () => {
  let ctx: ReturnType<typeof installFakeDom>;

  beforeEach(() => {
    ctx = installFakeDom();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('appends a style tag with the given id and CSS', () => {
    ensureKeyframeStyle('test-id-1', '@keyframes x { 0% {} 100% {} }');
    const tag = ctx.nodes.get('test-id-1');
    expect(tag).toBeDefined();
    expect(tag!.tagName).toBe('STYLE');
    expect(tag!.textContent).toContain('@keyframes x');
  });

  it('is idempotent — a second call with the same id does not duplicate', () => {
    const id = 'test-id-2';
    ensureKeyframeStyle(id, '@keyframes y { to { transform: rotate(360deg); } }');
    expect(countStyleTagsWithId(id)).toBe(1);
    ensureKeyframeStyle(id, '@keyframes y { to { transform: rotate(360deg); } }');
    ensureKeyframeStyle(id, '@keyframes y { to { transform: rotate(360deg); } }');
    expect(countStyleTagsWithId(id)).toBe(1);
    // And the underlying map only has one entry for that id.
    expect(ctx.nodes.size).toBe(1);
  });

  it('allows multiple different ids to coexist without collision', () => {
    ensureKeyframeStyle('a-1', '@keyframes a { 0% {} }');
    ensureKeyframeStyle('a-2', '@keyframes b { 0% {} }');
    expect(countStyleTagsWithId('a-1')).toBe(1);
    expect(countStyleTagsWithId('a-2')).toBe(1);
    expect(ctx.nodes.size).toBe(2);
  });

  it('no-ops when document is undefined (SSR smoke)', () => {
    vi.stubGlobal('document', undefined as unknown as Document);
    expect(() => ensureKeyframeStyle('ssr', '@keyframes s { 0% {} }')).not.toThrow();
    expect(countStyleTagsWithId('ssr')).toBe(0);
  });
});
