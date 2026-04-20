import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { FormField } from './FormField.js';

/**
 * Pins M8 behavior: the <label> is associated with its input via htmlFor/id.
 * With the default internal input (no children) AND when custom children are
 * passed, the htmlFor and id must match so screen readers can wire them up.
 *
 * We render to static HTML via react-dom/server and inspect the markup — this
 * avoids pulling in @testing-library/react as a new dependency.
 */

function extract(html: string, attr: string, tag: string): string | null {
  const re = new RegExp(`<${tag}\\b[^>]*\\b${attr}="([^"]+)"`, 'i');
  const m = re.exec(html);
  return m ? m[1] : null;
}

describe('FormField a11y — M8', () => {
  it('default input: label htmlFor matches input id', () => {
    const html = renderToStaticMarkup(
      <FormField label="Name" value="x" onChange={() => {}} />,
    );
    const labelFor = extract(html, 'for', 'label');
    const inputId = extract(html, 'id', 'input');
    expect(labelFor).toBeTruthy();
    expect(inputId).toBeTruthy();
    expect(labelFor).toBe(inputId);
  });

  it('custom <input> child without id: gets id injected matching htmlFor', () => {
    const html = renderToStaticMarkup(
      <FormField label="Custom">
        <input type="text" defaultValue="" />
      </FormField>,
    );
    const labelFor = extract(html, 'for', 'label');
    const inputId = extract(html, 'id', 'input');
    expect(labelFor).toBeTruthy();
    expect(inputId).toBe(labelFor);
  });

  it('custom <select> child without id: gets id injected matching htmlFor', () => {
    const html = renderToStaticMarkup(
      <FormField label="State">
        <select>
          <option value="CO">CO</option>
        </select>
      </FormField>,
    );
    const labelFor = extract(html, 'for', 'label');
    const selectId = extract(html, 'id', 'select');
    expect(labelFor).toBeTruthy();
    expect(selectId).toBe(labelFor);
  });

  it('custom <textarea> child without id: gets id injected matching htmlFor', () => {
    const html = renderToStaticMarkup(
      <FormField label="Notes">
        <textarea rows={3} defaultValue="" />
      </FormField>,
    );
    const labelFor = extract(html, 'for', 'label');
    const taId = extract(html, 'id', 'textarea');
    expect(labelFor).toBeTruthy();
    expect(taId).toBe(labelFor);
  });

  it('respects an explicit child id (does not overwrite)', () => {
    const html = renderToStaticMarkup(
      <FormField label="Explicit" id="my-label-target">
        <input id="custom-child-id" type="text" defaultValue="" />
      </FormField>,
    );
    // When the child provides its own id, we keep it. htmlFor uses the
    // FormField's own id prop. In this case they differ — that's allowed
    // because consumer has taken ownership; test below documents intent.
    expect(extract(html, 'id', 'input')).toBe('custom-child-id');
    expect(extract(html, 'for', 'label')).toBe('my-label-target');
  });

  it('uses the explicit id prop when provided (default input path)', () => {
    const html = renderToStaticMarkup(
      <FormField label="With id" id="fld-42" value="" onChange={() => {}} />,
    );
    expect(extract(html, 'id', 'input')).toBe('fld-42');
    expect(extract(html, 'for', 'label')).toBe('fld-42');
  });

  it('each FormField instance gets a unique auto-generated id', () => {
    const html = renderToStaticMarkup(
      <div>
        <FormField label="A" value="" onChange={() => {}} />
        <FormField label="B" value="" onChange={() => {}} />
      </div>,
    );
    const ids = Array.from(html.matchAll(/<input\b[^>]*\bid="([^"]+)"/g)).map((m) => m[1]);
    expect(ids.length).toBe(2);
    expect(ids[0]).not.toBe(ids[1]);
  });
});
