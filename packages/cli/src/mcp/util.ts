import { loadConfig } from '../config.js';
import { HomerAPI } from '../api.js';

/** Write to stderr — safe for MCP stdio servers (never corrupts JSON-RPC on stdout). */
export function log(msg: string): void {
  process.stderr.write(`[homer-mcp] ${msg}\n`);
}

/** Build a successful MCP tool result. */
export function textResult(data: unknown) {
  const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  return { content: [{ type: 'text' as const, text }] };
}

/** Build an MCP tool error result. */
export function errorResult(msg: string) {
  return { content: [{ type: 'text' as const, text: msg }], isError: true as const };
}

/**
 * Get an authenticated HomerAPI instance for MCP tools.
 * Unlike the CLI's getApi(), this does NOT call process.exit or console.log.
 * Returns { api } or { error }.
 */
export function safeGetApi(): { api: HomerAPI } | { error: string } {
  const config = loadConfig();
  if (!config) {
    return { error: 'Not logged in. Run: homer login --api-key <key>' };
  }
  return { api: new HomerAPI(config) };
}
