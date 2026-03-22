import { loadConfig, type HomerConfig } from './config.js';
import { error } from './output.js';

export class HomerAPI {
  private apiKey: string;
  private serverUrl: string;

  constructor(config: HomerConfig) {
    this.apiKey = config.apiKey;
    this.serverUrl = config.serverUrl.replace(/\/+$/, '');
  }

  private async request<T>(method: string, path: string, body?: unknown, contentType?: string): Promise<T> {
    const url = `${this.serverUrl}${path}`;
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.apiKey}`,
    };

    if (contentType) {
      headers['Content-Type'] = contentType;
    } else if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    const init: RequestInit = {
      method,
      headers,
    };

    if (body !== undefined) {
      if (contentType && contentType !== 'application/json') {
        init.body = body as string;
      } else {
        init.body = JSON.stringify(body);
      }
    }

    const res = await fetch(url, init);

    if (!res.ok) {
      let message = `HTTP ${res.status} ${res.statusText}`;
      try {
        const errBody = await res.json() as { message?: string; error?: string };
        message = errBody.message || errBody.error || message;
      } catch {
        // use default message
      }
      throw new Error(message);
    }

    const text = await res.text();
    if (!text) {
      return undefined as T;
    }
    return JSON.parse(text) as T;
  }

  async get<T>(path: string): Promise<T> {
    return this.request<T>('GET', path);
  }

  async post<T>(path: string, body?: unknown, contentType?: string): Promise<T> {
    return this.request<T>('POST', path, body, contentType);
  }

  async put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PUT', path, body);
  }

  async delete<T>(path: string): Promise<T> {
    return this.request<T>('DELETE', path);
  }
}

export function getApi(): HomerAPI {
  const config = loadConfig();
  if (!config) {
    error('Not logged in. Run: homer login --api-key <key>');
    process.exit(1);
  }
  return new HomerAPI(config);
}
