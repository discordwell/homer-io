import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { loadConfig } from '../config.js';
import { HomerAPI } from '../api.js';

/** Write to stderr — safe for MCP stdio servers (never corrupts JSON-RPC on stdout). */
export function log(msg: string): void {
  process.stderr.write(`[homer-mcp] ${msg}\n`);
}

/** Build a successful MCP tool result. */
export function textResult(data: unknown): CallToolResult {
  const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  return { content: [{ type: 'text' as const, text }] };
}

/** Build an MCP tool error result. */
export function errorResult(msg: string): CallToolResult {
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

/**
 * Register an MCP tool with type-safe schema.
 *
 * This wrapper exists because the MCP SDK v1.27+ type overloads trigger TS2589
 * ("type instantiation excessively deep") when using zod v4 with NodeNext module
 * resolution. The wrapper suppresses the error in one place rather than per-tool.
 */
export function registerTool(
  server: McpServer,
  name: string,
  description: string,
  inputSchema: Record<string, unknown> | undefined,
  handler: (args: Record<string, string | undefined>) => Promise<CallToolResult>,
): void {
  if (inputSchema) {
    // @ts-expect-error TS2589 - MCP SDK type depth issue with zod v4 + NodeNext
    server.tool(name, description, inputSchema, handler);
  } else {
    server.tool(name, description, handler as () => Promise<CallToolResult>);
  }
}
