import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { log, textResult, errorResult, safeGetApi } from '../mcp/util.js';
import { loadConfig } from '../config.js';
import { HomerAPI } from '../api.js';

vi.mock('../config.js', () => ({
  loadConfig: vi.fn(),
  DEFAULT_SERVER_URL: 'https://example.com',
}));

describe('mcp/util', () => {
  beforeEach(() => {
    vi.mocked(loadConfig).mockReset();
  });

  describe('log', () => {
    const spyOnStderrWrite = () =>
      vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    let writeSpy: ReturnType<typeof spyOnStderrWrite>;

    beforeEach(() => {
      writeSpy = spyOnStderrWrite();
    });

    afterEach(() => {
      writeSpy.mockRestore();
    });

    it('writes a prefixed line to stderr', () => {
      log('starting');
      expect(writeSpy).toHaveBeenCalledWith('[homer-mcp] starting\n');
    });
  });

  describe('textResult', () => {
    it('passes strings through unchanged', () => {
      expect(textResult('hello')).toEqual({ content: [{ type: 'text', text: 'hello' }] });
    });

    it('pretty-prints non-string data as JSON', () => {
      const result = textResult({ a: 1 });
      expect(result.content).toEqual([{ type: 'text', text: '{\n  "a": 1\n}' }]);
      expect(result.isError).toBeUndefined();
    });
  });

  describe('errorResult', () => {
    it('marks the result as an error', () => {
      expect(errorResult('boom')).toEqual({
        content: [{ type: 'text', text: 'boom' }],
        isError: true,
      });
    });
  });

  describe('safeGetApi', () => {
    it('returns an error (without exiting) when not logged in', () => {
      vi.mocked(loadConfig).mockReturnValue(null);
      expect(safeGetApi()).toEqual({ error: 'Not logged in. Run: homer login --api-key <key>' });
    });

    it('returns an authenticated HomerAPI when config exists', () => {
      vi.mocked(loadConfig).mockReturnValue({ apiKey: 'k', serverUrl: 'https://example.com' });
      const result = safeGetApi();
      expect('api' in result && result.api).toBeInstanceOf(HomerAPI);
    });
  });
});
