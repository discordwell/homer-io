import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HomerAPI } from '../api.js';

const jsonResponse = (data: unknown, status = 200, statusText = 'OK') =>
  new Response(JSON.stringify(data), {
    status,
    statusText,
    headers: { 'Content-Type': 'application/json' },
  });

describe('HomerAPI', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  const lastRequest = () => {
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    return { url, init, headers: init.headers as Record<string, string> };
  };

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('strips trailing slashes from the server URL', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));
    const api = new HomerAPI({ apiKey: 'k', serverUrl: 'https://example.com///' });
    await api.get('/api/orders');
    expect(lastRequest().url).toBe('https://example.com/api/orders');
  });

  it('sends the API key as a Bearer token', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}));
    const api = new HomerAPI({ apiKey: 'hio_secret', serverUrl: 'https://example.com' });
    await api.get('/api/orders');
    expect(lastRequest().headers['Authorization']).toBe('Bearer hio_secret');
  });

  it('omits Content-Type on body-less GET requests', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}));
    const api = new HomerAPI({ apiKey: 'k', serverUrl: 'https://example.com' });
    await api.get('/api/orders');
    const { init, headers } = lastRequest();
    expect(init.method).toBe('GET');
    expect(headers['Content-Type']).toBeUndefined();
    expect(init.body).toBeUndefined();
  });

  it('JSON-encodes POST bodies and sets Content-Type', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}));
    const api = new HomerAPI({ apiKey: 'k', serverUrl: 'https://example.com' });
    await api.post('/api/orders', { recipientName: 'A' });
    const { init, headers } = lastRequest();
    expect(headers['Content-Type']).toBe('application/json');
    expect(init.body).toBe(JSON.stringify({ recipientName: 'A' }));
  });

  it('passes raw bodies through for custom content types', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}));
    const api = new HomerAPI({ apiKey: 'k', serverUrl: 'https://example.com' });
    await api.post('/api/orders/import', 'id,name\n1,A', 'text/csv');
    const { init, headers } = lastRequest();
    expect(headers['Content-Type']).toBe('text/csv');
    expect(init.body).toBe('id,name\n1,A');
  });

  it('supports PUT and DELETE methods', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse({})));
    const api = new HomerAPI({ apiKey: 'k', serverUrl: 'https://example.com' });
    await api.put('/api/settings', { a: 1 });
    expect((fetchMock.mock.calls[0][1] as RequestInit).method).toBe('PUT');
    await api.delete('/api/orders/1');
    expect((fetchMock.mock.calls[1][1] as RequestInit).method).toBe('DELETE');
  });

  it('parses JSON responses', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ orders: [{ id: '1' }] }));
    const api = new HomerAPI({ apiKey: 'k', serverUrl: 'https://example.com' });
    await expect(api.get('/api/orders')).resolves.toEqual({ orders: [{ id: '1' }] });
  });

  it('returns undefined for empty response bodies', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
    const api = new HomerAPI({ apiKey: 'k', serverUrl: 'https://example.com' });
    await expect(api.delete('/api/orders/1')).resolves.toBeUndefined();
  });

  it('throws the message field from JSON error bodies', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ message: 'Order not found' }, 404, 'Not Found'));
    const api = new HomerAPI({ apiKey: 'k', serverUrl: 'https://example.com' });
    await expect(api.get('/api/orders/x')).rejects.toThrow('Order not found');
  });

  it('falls back to the error field from JSON error bodies', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: 'Forbidden' }, 403, 'Forbidden'));
    const api = new HomerAPI({ apiKey: 'k', serverUrl: 'https://example.com' });
    await expect(api.get('/api/orders')).rejects.toThrow('Forbidden');
  });

  it('falls back to HTTP status text for non-JSON error bodies', async () => {
    fetchMock.mockResolvedValue(
      new Response('oops', { status: 500, statusText: 'Internal Server Error' }),
    );
    const api = new HomerAPI({ apiKey: 'k', serverUrl: 'https://example.com' });
    await expect(api.get('/api/orders')).rejects.toThrow('HTTP 500 Internal Server Error');
  });
});
