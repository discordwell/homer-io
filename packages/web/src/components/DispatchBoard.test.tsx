import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DispatchColumn, kanbanKeyReducer, UNASSIGNED_COL_ID } from './DispatchBoard.js';

/**
 * M6 — DispatchColumn is wrapped in React.memo so columns whose data didn't
 * change don't re-render when siblings update. We verify the wrapping via
 * the React element type tag ($$typeof === REACT_MEMO_TYPE).
 *
 * M9 — Order cards are focusable (tabIndex=0), expose role="article", and the
 * column exposes role="region" with an aria-label. This enables the keyboard
 * kanban pattern the component implements (Enter to pick, Arrow to target,
 * Enter to drop, Escape to cancel).
 *
 * We use react-dom/server because the project doesn't currently depend on
 * @testing-library/react or a DOM test env — the test is structural, pinning
 * the ARIA contract + the memo wrapper so future regressions are caught.
 */

type ReactMemoElement = {
  $$typeof: symbol;
  type: unknown;
  compare: unknown;
};

describe('DispatchColumn — M6 memoization', () => {
  it('is wrapped in React.memo', () => {
    // React internally tags memo components with a specific $$typeof symbol.
    // React.memo(fn) returns { $$typeof: REACT_MEMO_TYPE, type: fn, compare }.
    const comp = DispatchColumn as unknown as ReactMemoElement;
    expect(typeof comp.$$typeof).toBe('symbol');
    // Use the public symbol table where available; otherwise accept any memo-ish tag.
    const desc = comp.$$typeof.toString();
    expect(desc).toMatch(/memo/i);
    // The wrapped implementation should be a function.
    expect(typeof comp.type).toBe('function');
  });
});

describe('DispatchColumn — M9 keyboard a11y', () => {
  const noop = () => {};

  const sampleOrder = {
    id: 'o1',
    recipientName: 'Alice',
    deliveryAddress: { street: '1 Main', city: 'Denver' },
    priority: 'normal',
    status: 'received',
    packageCount: 1,
  };

  const driverCol = {
    driver: { id: 'd1', name: 'Driver One', status: 'active' },
    route: null,
    orders: [sampleOrder],
  };

  it('renders the column with role="region" and an aria-label', () => {
    const html = renderToStaticMarkup(
      <DispatchColumn
        colId="d1"
        column={driverCol}
        unassigned={null}
        isOver={false}
        pickedUpOrderId={null}
        focusedColId={null}
        onDragStart={noop}
        onDragOver={noop}
        onDragLeave={noop}
        onDrop={noop}
        onCardKeyDown={noop}
        onCardFocus={noop}
      />,
    );
    expect(html).toMatch(/role="region"/);
    expect(html).toMatch(/aria-label="Driver Driver One column"/);
  });

  it('renders each order card with role="article" and tabindex="0"', () => {
    const html = renderToStaticMarkup(
      <DispatchColumn
        colId="d1"
        column={driverCol}
        unassigned={null}
        isOver={false}
        pickedUpOrderId={null}
        focusedColId={null}
        onDragStart={noop}
        onDragOver={noop}
        onDragLeave={noop}
        onDrop={noop}
        onCardKeyDown={noop}
        onCardFocus={noop}
      />,
    );
    expect(html).toMatch(/role="article"/);
    expect(html).toMatch(/tabindex="0"/i);
    // Includes the order id for keyboard handlers to resolve
    expect(html).toMatch(/data-order-id="o1"/);
  });

  it('marks a picked-up card with aria-grabbed="true"', () => {
    const html = renderToStaticMarkup(
      <DispatchColumn
        colId="d1"
        column={driverCol}
        unassigned={null}
        isOver={false}
        pickedUpOrderId="o1"
        focusedColId="d1"
        onDragStart={noop}
        onDragOver={noop}
        onDragLeave={noop}
        onDrop={noop}
        onCardKeyDown={noop}
        onCardFocus={noop}
      />,
    );
    expect(html).toMatch(/aria-grabbed="true"/);
  });

  it('full pickup -> arrow -> drop flow moves card to targeted column', () => {
    // Simulates: focus card in unassigned, press Enter to pick up,
    // ArrowRight to advance target, Enter to drop.
    const allColIds = [UNASSIGNED_COL_ID, 'd1', 'd2'];
    const driverColIds = ['d1', 'd2'];
    const orderId = 'o1';

    // Step 1: Enter on a focused unassigned card picks it up.
    let state = { pickedUpOrderId: null as string | null, focusedColId: null as string | null };
    let r = kanbanKeyReducer(state, 'Enter', { orderId, allColIds, driverColIds, isUnassigned: true });
    expect(r.effect).toEqual({ kind: 'pickup', orderId });
    expect(r.next.pickedUpOrderId).toBe(orderId);
    // Initial focus jumps to first driver column
    expect(r.next.focusedColId).toBe('d1');
    state = r.next;

    // Step 2: ArrowRight moves focus to the next driver column (d2).
    r = kanbanKeyReducer(state, 'ArrowRight', { orderId, allColIds, driverColIds, isUnassigned: true });
    expect(r.effect.kind).toBe('none');
    expect(r.next.focusedColId).toBe('d2');
    state = r.next;

    // Step 3: Enter drops on the current focused column.
    r = kanbanKeyReducer(state, 'Enter', { orderId, allColIds, driverColIds, isUnassigned: true });
    expect(r.effect).toEqual({ kind: 'drop', orderId, targetColId: 'd2' });
    expect(r.next.pickedUpOrderId).toBeNull();
  });

  it('Escape cancels pickup', () => {
    const allColIds = [UNASSIGNED_COL_ID, 'd1'];
    const r = kanbanKeyReducer(
      { pickedUpOrderId: 'o1', focusedColId: 'd1' },
      'Escape',
      { orderId: 'o1', allColIds, driverColIds: ['d1'], isUnassigned: true },
    );
    expect(r.effect).toEqual({ kind: 'cancel' });
    expect(r.next.pickedUpOrderId).toBeNull();
  });

  it('Enter on unassigned column while holding is an invalid drop', () => {
    const allColIds = [UNASSIGNED_COL_ID, 'd1'];
    const r = kanbanKeyReducer(
      { pickedUpOrderId: 'o1', focusedColId: UNASSIGNED_COL_ID },
      'Enter',
      { orderId: 'o1', allColIds, driverColIds: ['d1'], isUnassigned: true },
    );
    expect(r.effect.kind).toBe('invalid-drop');
    expect(r.next.pickedUpOrderId).toBeNull();
  });

  it('ArrowLeft does nothing before pickup', () => {
    const allColIds = [UNASSIGNED_COL_ID, 'd1'];
    const r = kanbanKeyReducer(
      { pickedUpOrderId: null, focusedColId: null },
      'ArrowLeft',
      { orderId: 'o1', allColIds, driverColIds: ['d1'], isUnassigned: true },
    );
    expect(r.effect.kind).toBe('none');
  });

  it('Enter on non-unassigned card does not pick up', () => {
    const allColIds = [UNASSIGNED_COL_ID, 'd1'];
    const r = kanbanKeyReducer(
      { pickedUpOrderId: null, focusedColId: null },
      'Enter',
      { orderId: 'o1', allColIds, driverColIds: ['d1'], isUnassigned: false },
    );
    expect(r.effect.kind).toBe('none');
    expect(r.next.pickedUpOrderId).toBeNull();
  });

  it('ArrowRight does not move past the last column', () => {
    const allColIds = [UNASSIGNED_COL_ID, 'd1'];
    const r = kanbanKeyReducer(
      { pickedUpOrderId: 'o1', focusedColId: 'd1' },
      'ArrowRight',
      { orderId: 'o1', allColIds, driverColIds: ['d1'], isUnassigned: true },
    );
    expect(r.next.focusedColId).toBe('d1');
  });

  it('unassigned column has aria-label "Unassigned orders"', () => {
    const html = renderToStaticMarkup(
      <DispatchColumn
        colId="__unassigned__"
        column={null}
        unassigned={[sampleOrder]}
        isOver={false}
        pickedUpOrderId={null}
        focusedColId={null}
        onDragStart={noop}
        onDragOver={noop}
        onDragLeave={noop}
        onDrop={noop}
        onCardKeyDown={noop}
        onCardFocus={noop}
      />,
    );
    expect(html).toMatch(/aria-label="Unassigned orders"/);
  });
});
