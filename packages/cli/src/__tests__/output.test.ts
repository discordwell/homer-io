import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { printTable, printJson, output, info, success, error } from '../output.js';

// chalk may or may not emit ANSI codes depending on TTY detection, so all
// assertions strip escape sequences before comparing.
// eslint-disable-next-line no-control-regex
const stripAnsi = (s: string) => s.replace(/\[[0-9;]*m/g, '');

describe('output', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errSpy: ReturnType<typeof vi.spyOn>;

  const logLines = () => logSpy.mock.calls.map(c => stripAnsi(String(c[0])));
  const errLines = () => errSpy.mock.calls.map(c => stripAnsi(String(c[0])));

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
    errSpy.mockRestore();
  });

  describe('printTable', () => {
    it('prints nothing when headers are empty', () => {
      printTable([], [['a']]);
      expect(logSpy).not.toHaveBeenCalled();
    });

    it('sizes columns to the widest cell or header', () => {
      printTable(['ID', 'Name'], [['1', 'Alexandria'], ['22', 'Bo']]);
      const lines = logLines();
      // separator + header + separator + 2 rows + separator
      expect(lines).toHaveLength(6);
      expect(lines[0]).toBe('+----+------------+');
      expect(lines[1]).toBe('| ID | Name       |');
      expect(lines[3]).toBe('| 1  | Alexandria |');
      expect(lines[4]).toBe('| 22 | Bo         |');
      expect(lines[5]).toBe(lines[0]);
    });

    it('pads missing cells with empty strings', () => {
      printTable(['A', 'B'], [['x']]);
      const lines = logLines();
      expect(lines[3]).toBe('| x |   |');
    });

    it('handles zero rows (headers only)', () => {
      printTable(['Col'], []);
      const lines = logLines();
      expect(lines).toEqual(['+-----+', '| Col |', '+-----+', '+-----+']);
    });
  });

  describe('printJson', () => {
    it('prints 2-space-indented JSON', () => {
      printJson({ a: 1 });
      expect(logSpy).toHaveBeenCalledWith('{\n  "a": 1\n}');
    });
  });

  describe('output', () => {
    it('prints JSON when json flag is set', () => {
      output([{ id: 1 }], true);
      expect(logLines()[0]).toBe(JSON.stringify([{ id: 1 }], null, 2));
    });

    it('derives table headers from the first object of an array', () => {
      output([{ id: '1', name: 'A' }, { id: '2', name: 'B' }], false);
      const lines = logLines();
      expect(lines[1]).toBe('| id | name |');
      expect(lines[3]).toBe('| 1  | A    |');
      expect(lines[4]).toBe('| 2  | B    |');
    });

    it('renders null and undefined cells as empty strings', () => {
      output([{ a: null, b: undefined, c: 0 }], false);
      const lines = logLines();
      expect(lines[3]).toBe('|   |   | 0 |');
    });

    it('prints "No results." to stderr for an empty array', () => {
      output([], false);
      expect(logSpy).not.toHaveBeenCalled();
      expect(errLines()[0]).toBe('No results.');
    });

    it('prints a single object as Field/Value rows', () => {
      output({ id: 'abc', status: 'ready' }, false);
      const lines = logLines();
      expect(lines[1]).toBe('| Field  | Value |');
      expect(lines[3]).toBe('| id     | abc   |');
      expect(lines[4]).toBe('| status | ready |');
    });

    it('stringifies primitives', () => {
      output(42, false);
      expect(logSpy).toHaveBeenCalledWith('42');
    });
  });

  describe('message helpers', () => {
    it('info/success/error all write to stderr, not stdout', () => {
      info('i');
      success('s');
      error('e');
      expect(logSpy).not.toHaveBeenCalled();
      expect(errLines()).toEqual(['i', 's', 'e']);
    });
  });
});
